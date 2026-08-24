// Cloudflare Pages Function — GET/POST /api/canary?token=DIGEST_TOKEN
// ─────────────────────────────────────────────────────────────────────────────
// SYNTHETIC CANARY OF THE MONEY FUNNEL. The bug this defends against is the same one
// health-monitor.js's RPC probes defend against — a revenue path can DIE silently and
// nobody notices until a prospect complains (the demo call not ringing, the pay link
// 404ing, the concierge returning empty, the dial-gate suddenly accepting garbage).
// Instead of trusting the funnel is fine, this actually EXERCISES it end-to-end with
// ZERO real side effects and watches what comes back.
//
// DIGEST-gated (same token cron-tick/health-monitor use) so only the cron/owner can run
// it. Driven by the cron-worker fan-out (add a target in cron-tick.js when wiring).
//
// PROBES (all read-only / self-refusing — no real call, no real lead, no charge):
//   (a) gui-chat  — POST /api/gui-chat with a tiny question → expect 200 + non-empty text.
//   (b) pay-links — GET each live Stripe Payment Link from SELF_SERVE_PLANS → expect 200
//                    on buy.stripe.com (follows redirects). Empty url = notReady (not minted).
//   (c) call-gate — POST /api/call with a DELIBERATELY INVALID phone ("123") → expect the
//                    gate to REFUSE (4xx). This proves the hardened dial point is alive:
//                    the phone-regex trips BEFORE any provider call, so no real call is placed.
//                    A 200/ok here would mean the gate accepts garbage → CRITICAL page.
//                    (We do NOT touch lead.js — not this file's to own; the /api/call refusal
//                    is the equivalent proof that the funnel's money-spending gate lives.)
//   (d) widget-chat — POST /api/widget-chat for the first real tenant with a non-empty history
//                    (→ isStart=false, so NO cockpit event is ingested) and a contact-free
//                    "ping" message (→ no CRM/lead side effect) → expect 200 + non-empty text.
//
// FAILURE → owner alert reusing health-monitor.js's EXACT mechanism: an atomic health_claim
// (db/health_claims.sql) then an ops_alert ingested into the owner's feed.
//
// DEDUP CHOICE (documented per the brief): the requested cadence is ~6h, but health_claim's
// TTL is 7 DAYS (per db/health_claims.sql — it's a weekly churn/ops dedup, not an hourly one).
// Rather than add a new claim RPC, we make the claim KEY day-scoped: p_kind =
// `canary_<probe>_<YYYY-MM-DD>`. A 7-day claim on a key that changes each UTC day therefore
// fires AT MOST ONCE PER DAY per probe — quieter than 6h, but never noisier, and it needs no
// new SQL. If a same-day re-page is ever wanted, narrow the suffix to the 6h bucket
// (`_<YYYY-MM-DD>-<0..3>`); the 7-day TTL still auto-expires the stale keys.
import { json, safeEq, rateLimited } from "../lib/guard.js";
import { sbKey } from "../lib/sb.js";
import { SELF_SERVE_PLANS } from "../../src/data/selfServePlans.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const PROBE_TIMEOUT_MS = 8000; // sondas de HTTP puro (pay-links, call-gate): rápidas por natureza

// ── ORÇAMENTO DE TEMPO DAS SONDAS DE IA (2026-08-11) ────────────────────────────────
// Medido em produção com a pergunta EXATA da sonda: 6.5s / 6.0s / 5.9s. O teto era 8s.
// Uma margem de 1.5s num caminho que atravessa um modelo de linguagem não é margem — é um
// SORTEIO, refeito a cada tique. Foi isso que produziu os dois "defeitos" que persegui hoje:
// widget_chat vermelho de manhã, gui_chat vermelho à tarde, motor 200 nas duas vezes. A sonda
// não estava medindo a saúde do chat; estava medindo quem ganhou a corrida contra o relógio.
//
// Pior que o painel errado: quando uma sonda "falha", o canary MANDA ALERTA PRO DONO. Alarme
// falso semanal é como se desaprende a olhar o alarme — e aí o vermelho de verdade não chega.
//
// A pergunta certa não é "quanto tempo é aceitável pra mim", é QUANDO O VISITANTE DESISTE.
// Num chat, quem espera mais de ~20s já fechou a aba: passou disso, está quebrado de fato,
// mesmo que uma resposta chegue depois. Daí os dois limites — e são limites DIFERENTES:
//   ≤ LENTO_IA_MS ....... verde  (normal)
//   entre os dois ....... "slow" → AMARELO, sem alerta: respondeu, só devagar. É informação
//                         de verdade (degradação começando), não emergência.
//   > IA_TIMEOUT_MS ..... failed → VERMELHO + alerta. Aqui o cliente foi embora.
const IA_TIMEOUT_MS = 20000; // o ponto em que um visitante real já desistiu
const LENTO_IA_MS = 10000;   // acima disso está degradando, mas ainda responde

// INGEST-gated RPC helper (same shape as health-monitor.js). null on any non-2xx / config gap.
async function rpc(env, fn, args) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", ...args }),
    });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

// fetch with a per-probe abort so one hung dependency can't stall the whole canary.
async function timedFetch(url, opts = {}, ms = PROBE_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
}

// FAILURE ALERT — health-monitor.js's mechanism verbatim: atomic day-scoped health_claim, then
// ingest an ops_alert into the OWNER's feed. claimed===null → db/health_claims.sql not pasted
// (report-only, alertReady:false). claimed===false → already paged today (correct dedup). Returns
// { alerted, claimed } so the JSON can prove whether the page actually landed.
async function alertFail(env, out, probe, summary, payload = {}) {
  const OWNER = (env.OWNER_EMAIL || "smart@guileoai.com").toString().split(",")[0].trim().toLowerCase();
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC) → once/day per probe
  const kind = `canary_${probe}_${day}`;
  const claimed = await rpc(env, "health_claim", { p_email: OWNER, p_kind: kind });
  if (claimed === null) { out.alertReady = false; return { alerted: false, claimed: null }; }
  if (claimed !== true) return { alerted: false, claimed: false }; // already paged today
  const ir = await rpc(env, "ingest_client_event", {
    p_email: OWNER, p_type: "ops_alert", p_channel: "system",
    p_summary: `🐤 CANÁRIO: ${summary}`.slice(0, 300),
    p_amount: 0, p_payload: { kind: `canary_${probe}`, probe, ...payload },
  });
  return { alerted: ir !== null, claimed: true };
}

// Classifica uma sonda de IA que RESPONDEU 200, pelo tempo que levou. Separado das sondas porque
// as duas (gui-chat público e widget do cliente) têm que responder a MESMA pergunta do mesmo jeito
// — foi justamente por medirem diferente que uma ficou vermelha de manhã e a outra à tarde.
function classificarIA(ms, base) {
  if (ms > LENTO_IA_MS) return { ...base, status: "slow", ms, detail: `respondeu em ${(ms / 1000).toFixed(1)}s (acima de ${LENTO_IA_MS / 1000}s) — degradando, ainda não quebrado` };
  return { ...base, status: "ok", ms };
}

// ── (a) gui-chat — the public landing concierge ────────────────────────────────
// sameOrigin gate on gui-chat needs an on-site Origin header; we send our own origin (which is
// guileoai.com / *.pages.dev — both pass okOrigin). 200 + non-empty answer = healthy.
async function probeGuiChat(env, origin) {
  const t0 = Date.now();
  try {
    const r = await timedFetch(`${origin}/api/gui-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ message: "What is Guileo, in one line?", lang: "en" }),
    }, IA_TIMEOUT_MS);
    if (!r.ok) return { status: "failed", httpStatus: r.status, ms: Date.now() - t0, detail: (await r.text().catch(() => "")).slice(0, 160) };
    const d = await r.json().catch(() => ({}));
    const answer = (d && (d.answer || "")).toString().trim();
    if (!answer) return { status: "failed", httpStatus: r.status, ms: Date.now() - t0, detail: "empty answer" };
    // 🚨 "RESPONDEU" NÃO É "O CÉREBRO RESPONDEU" (24/08). O critério aqui era 200 + texto — e a
    // frase enlatada do gui-chat satisfaz os dois. Resultado: o saldo Anthropic acabou, o chat
    // passou a responder enlatado em inglês para perguntas em português, e este canário seguiu
    // VERDE. Era o mesmo defeito do `.then(r => r.ok)` sobre RPC que devolve booleano: ler o
    // envelope e chamar de conteúdo. Agora, sem `cerebro:true`, é falha.
    if (d && d.cerebro === false) {
      return { status: "failed", httpStatus: r.status, ms: Date.now() - t0, detail: "resposta enlatada — o cerebro nao respondeu (saldo/modelo)" };
    }
    return classificarIA(Date.now() - t0, { httpStatus: r.status, sample: answer.slice(0, 80) });
  } catch (e) {
    // Estourou IA_TIMEOUT_MS (ou a rede caiu): aqui é falha DE VERDADE — o visitante já foi embora.
    return { status: "failed", httpStatus: 0, ms: Date.now() - t0, detail: String(e).slice(0, 160) };
  }
}

// ── (b) pay-links — the three self-serve Stripe checkout links ──────────────────
// GET each (follows the buy.stripe.com redirect) → 200 = live. Empty url = notReady (not minted),
// NOT a failure. Any non-200 on a live link = the checkout is dead → prospect can't pay → page.
async function probePayLinks(env) {
  const results = [];
  let anyFailed = false, anyNotReady = false;
  for (const p of SELF_SERVE_PLANS) {
    const url = (p && p.url) || "";
    if (!url) { anyNotReady = true; results.push({ id: p.id, status: "notReady" }); continue; }
    try {
      const r = await timedFetch(url, { method: "GET", redirect: "follow" });
      if (r.ok) results.push({ id: p.id, status: "ok", httpStatus: r.status });
      else { anyFailed = true; results.push({ id: p.id, status: "failed", httpStatus: r.status }); }
    } catch (e) { anyFailed = true; results.push({ id: p.id, status: "failed", httpStatus: 0, detail: String(e).slice(0, 120) }); }
  }
  return { status: anyFailed ? "failed" : anyNotReady ? "notReady" : "ok", links: results };
}

// ── (c) call-gate — the hardened outbound dial point MUST refuse garbage ─────────
// We POST a deliberately INVALID phone ("123": trips /^\+?[1-9]\d{7,14}$/ BEFORE any provider
// call → zero real call). A 4xx = the gate is alive (the correct refusal). A 200/ok = the
// validation gate is DOWN and would dial arbitrary numbers → CRITICAL. 501 = calling simply not
// configured yet (honest notReady, not a crash).
async function probeCallGate(env, origin) {
  try {
    const r = await timedFetch(`${origin}/api/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ phone: "123" }), // invalid on purpose — no real call is ever placed
    });
    if (r.status === 501) return { status: "notReady", httpStatus: 501, detail: "outbound calling not configured" };
    if (r.status === 429) return { status: "ok", httpStatus: 429, refused: true, note: "rate-limited pre-validation (inconclusive but safe)" };
    if (r.status >= 400 && r.status < 500) return { status: "ok", httpStatus: r.status, refused: true };
    // 200 (accepted!) or 5xx → the money-spending gate is not refusing garbage → page.
    const body = (await r.text().catch(() => "")).slice(0, 160);
    return { status: "failed", httpStatus: r.status, detail: r.status === 200 ? `gate ACCEPTED invalid phone: ${body}` : body };
  } catch (e) { return { status: "failed", httpStatus: 0, detail: String(e).slice(0, 160) }; }
}

// ── (d) widget-chat — the embeddable tenant concierge ───────────────────────────
// Resolve the first REAL provisioned tenant (clients_list, like health-monitor) so we hit a 200
// path, not a 404. Non-empty history → isStart=false → NO cockpit event ingested. Contact-free
// "ping" → no CRM/lead. Only side effects: a small LLM spend + a per-session KV counter (harmless).
async function probeWidgetChat(env, origin) {
  const clients = await rpc(env, "clients_list", {});
  if (!Array.isArray(clients) || !clients.length) return { status: "notReady", detail: "no tenants" };
  const client = ((clients[0] && clients[0].client_email) || "").toString().trim().toLowerCase();
  if (!client.includes("@")) return { status: "notReady", detail: "no tenant email" };
  // ── SESSÃO ÚNICA POR RODADA, NÃO POR DIA (2026-08-12) ──────────────────────────────────────
  // Era `canary-${day}`: um sessionId FIXO o dia inteiro, escolhido para não poluir os eventos do
  // cliente. Mas o widget limita 40 mensagens POR SESSÃO (widget-chat.js), para um visitante não
  // drenar o crédito do dono. O cron roda a cada 15 min → 96 chamadas/dia na MESMA sessão: a sonda
  // estoura o próprio teto por volta das 10h UTC e passa o resto do dia gritando que o widget caiu.
  // Foi exatamente o que aconteceu — verde de manhã, vermelho à tarde, e o widget respondendo 200
  // em 5,5s o tempo todo. Duas proteções corretas que ninguém tinha posto uma ao lado da outra.
  //
  // Trocar por sessão única NÃO polui nada: a sonda já manda `history` não-vazio de propósito, o
  // que faz `isStart:false` e impede QUALQUER ingestão de evento. O custo de uma sessão nova é
  // zero; o custo da sessão fixa era um alarme falso permanente meio dia por dia.
  // (A dedup do alerta continua por dia — ela vive no health_claim, não aqui.)
  const day = new Date().toISOString().slice(0, 10);
  const agora = new Date();
  const sess = `canary-${day}-${String(agora.getUTCHours()).padStart(2, "0")}${String(agora.getUTCMinutes()).padStart(2, "0")}`;
  const t0 = Date.now();
  try {
    const r = await timedFetch(`${origin}/api/widget-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({
        client, sessionId: sess, message: "ping",
        // non-empty history ⇒ isStart:false ⇒ no ingest; no phone/email ⇒ no CRM/lead.
        history: [{ role: "user", text: "hi" }, { role: "assistant", text: "hello" }],
      }),
    }, IA_TIMEOUT_MS);
    if (r.status === 404) return { status: "failed", httpStatus: 404, detail: `tenant ${client} rejected as unknown` };
    if (!r.ok) return { status: "failed", httpStatus: r.status, detail: (await r.text().catch(() => "")).slice(0, 160) };
    const d = await r.json().catch(() => ({}));
    const answer = (d && (d.answer || d.reply || "")).toString().trim();
    if (!answer) return { status: "failed", httpStatus: r.status, detail: "empty answer" };
    // Mesma trava do gui_chat: sem `cerebro:true` é resposta de emergência, não saúde.
    if (d && d.cerebro === false) return { status: "failed", httpStatus: r.status, ms: Date.now() - t0, detail: "resposta enlatada — o cerebro nao respondeu (saldo/modelo)" };
    return classificarIA(Date.now() - t0, { httpStatus: r.status, tenant: client, sample: answer.slice(0, 80) });
  } catch (e) { return { status: "failed", httpStatus: 0, ms: Date.now() - t0, detail: String(e).slice(0, 160) }; }
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    // DIGEST-gated — same token cron-tick/health-monitor use. Light rate-limit as a backstop.
    if (await rateLimited(request, env, "canary", 6)) return json({ error: "too many requests" }, 429);
    const tok = new URL(request.url).searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
    if (!env.DIGEST_TOKEN || !safeEq(tok, env.DIGEST_TOKEN)) return json({ error: "unauthorized" }, 401);

    const origin = new URL(request.url).origin;
    const out = { alertReady: true }; // flipped false if db/health_claims.sql isn't pasted

    // Run all four probes together — one slow dependency can't serialize the rest.
    const [guiChat, payLinks, callGate, widgetChat] = await Promise.all([
      probeGuiChat(env, origin).catch((e) => ({ status: "failed", httpStatus: 0, detail: String(e).slice(0, 120) })),
      probePayLinks(env).catch((e) => ({ status: "failed", detail: String(e).slice(0, 120) })),
      probeCallGate(env, origin).catch((e) => ({ status: "failed", httpStatus: 0, detail: String(e).slice(0, 120) })),
      probeWidgetChat(env, origin).catch((e) => ({ status: "failed", detail: String(e).slice(0, 120) })),
    ]);

    const probes = { gui_chat: guiChat, pay_links: payLinks, call_gate: callGate, widget_chat: widgetChat };

    // Any probe that truly FAILED (not merely notReady) → page the owner, deduped once/day.
    for (const [name, res] of Object.entries(probes)) {
      if (!res || res.status !== "failed") continue;
      const detail = name === "pay_links"
        ? `link(s) de pagamento fora do ar: ${JSON.stringify(res.links).slice(0, 180)}`
        : `HTTP ${res.httpStatus ?? "?"} — ${res.detail || "sem detalhe"}`;
      const a = await alertFail(env, out, name, `probe ${name} FALHOU no funil — ${detail}`, {
        httpStatus: res.httpStatus, detail: (res.detail || "").toString().slice(0, 200),
      });
      res.alerted = a.alerted;
    }

    const failed = Object.entries(probes).filter(([, r]) => r && r.status === "failed").map(([n]) => n);
    return json({ ok: failed.length === 0, failed, alertReady: out.alertReady, probes });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 160) }, 500);
  }
}
