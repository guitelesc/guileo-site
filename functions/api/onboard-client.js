// Cloudflare Pages Function — POST /api/onboard-client
// THE ONBOARDING ENGINE: turns a new client live in one call. Admin-token gated; all
// secrets stay server-side. Does, in order:
//   1. saves the client profile (business, lang, review link, forward number)
//   2. creates the credits row + plan (also mints the connection code)
//   3. provisions a dedicated, SALES-FIRST ElevenLabs voice agent from their brain
//   4. number: maps an existing Twilio number OR buys a fresh one — and wires its
//      SMS + Voice webhooks to Gui automatically
//   5. returns the connection code, agent id and number so Luis hands them over.
import { json } from "../lib/guard.js";
// preço canônico por plano — o MESMO arquivo que a landing, o hub e o orçamento leem. Ler daqui
// é o que garante que "US$50" vira a mesma coisa nos três lugares.
import { GUILEO_PLANS } from "../../src/data/guileoPlans.js";
import { buildConversationConfig, forwardingInstructions, buildDefaultSchedulePayload, elevenBindNumber } from "../lib/provision.js";
import { resolveNativeVoices } from "../lib/voiceLibrary.js";
import { emitFailure } from "../lib/failure.js";
import { svcRpc } from "../lib/sb.js";
import { welcomeSelfServeEmail, sellerClientLiveEmail, teamKickoffBriefEmail } from "../lib/emailTemplates.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// RESERVED platform line — the demo/outbound number of the site (ELEVENLABS_PHONE_NUMBER_ID). It must
// NEVER be mapped/bound to a client agent, or approving that client SEQUESTERS the site demo's Gui.
// Same Set as bind-number.js:25 (single source of truth for the rule). Digits-only compare.
const RESERVED_NUMBERS = new Set(["19864443334"]);
const isReserved = (n) => RESERVED_NUMBERS.has((n || "").toString().replace(/[^0-9]/g, ""));

// Build the PRICE LIST the Gui is born knowing (FIX A contract): so it quotes EXACT prices on the first
// call. Accepts an explicit b.prices string, else derives one from the rich scheduling payload services
// (name — $price). Returns "" when nothing priced is available (agent then captures a quote request).
function buildPricesText(b) {
  const explicit = (b && b.prices != null) ? b.prices : "";
  if (typeof explicit === "string" && explicit.trim()) return explicit.slice(0, 2000);
  if (Array.isArray(explicit) && explicit.length) {
    return explicit.map((p) => {
      const nm = (p?.name || "").toString().trim();
      const pr = (p?.price != null ? p.price : (p?.price_cents != null ? (Number(p.price_cents) / 100) : "")).toString().trim();
      return nm ? `${nm}${pr ? ` — $${pr}` : ""}` : "";
    }).filter(Boolean).join("\n").slice(0, 2000);
  }
  const svcs = b?.payload && Array.isArray(b.payload.services) ? b.payload.services : [];
  if (svcs.length) {
    return svcs.map((s) => {
      const nm = (s?.name || "").toString().trim();
      const cents = Number(s?.price_cents);
      const pr = Number.isFinite(cents) && cents > 0 ? `$${(cents / 100).toFixed(2)}` : "";
      return nm ? `${nm}${pr ? ` — ${pr}` : ""}` : "";
    }).filter(Boolean).join("\n").slice(0, 2000);
  }
  return "";
}

async function configureTwilioWebhooks(env, numberSid) {
  const sid = env.TWILIO_ACCOUNT_SID, tok = env.TWILIO_AUTH_TOKEN;
  const body = new URLSearchParams({ SmsUrl: "https://guileoai.com/api/twilio-inbound", SmsMethod: "POST", VoiceUrl: "https://guileoai.com/api/twilio-voice", VoiceMethod: "POST" });
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${numberSid}.json`, {
    method: "POST", headers: { Authorization: "Basic " + btoa(`${sid}:${tok}`), "Content-Type": "application/x-www-form-urlencoded" }, body,
  });
}

// A CÓPIA LOCAL DE `elevenBindNumber` FOI REMOVIDA EM 2026-08-16.
// Este arquivo tinha a função duplicada, byte a byte igual à de lib/provision.js. Quando o carimbo
// do número foi corrigido lá (passou a nascer do AGENTE, não do e-mail de quem pediu), esta cópia
// teria continuado carimbando errado — e metade dos clientes novos nasceria com a etiqueta velha,
// que é exatamente a doença que a correção veio curar. Função duplicada não é redundância: é uma
// bomba-relógio que dispara no dia em que alguém conserta só uma das duas.

// ─────────────────────────────────────────────────────────────────────────────
// SELF-SERVE AUTONOMY HELPERS (#14) — additive, only ever invoked when b.self_serve===true.
// Two capabilities so a self-serve buyer goes live WITHOUT an admin step:
//   (1) AUTO-BUILD KB — scrape the buyer's OWN website for REAL business facts (reuses the proven
//       demo.js scrape approach: SSRF-guarded fetch → text → Claude fact-extract). HONESTY GATE:
//       a thin scrape is NEVER injected as truth — the client is flagged 'needs KB review' instead.
//   (2) AUTO-ASSIGN a free POOLED number from the account's OWN live stock (same enumeration as
//       twilio-numbers.js: Twilio numbers minus ElevenLabs-bound minus reserved), atomically
//       claimed (pool_claim_number) so two concurrent onboards can never grab the same line.
// Everything below is best-effort and never throws into the money/birth path.
// ─────────────────────────────────────────────────────────────────────────────
// MODEL_CHAIN vem de ../lib/guiBrain.js — NÃO declare outra aqui (2026-08-12).
// Eram DEZ cópias idênticas da mesma lista de modelos, uma por arquivo. Idênticas HOJE: conferi as
// dez antes de mexer, e é exatamente por estarem iguais que a hora de unificar é agora — depois que
// uma diverge, alguém já foi atendido pelo modelo errado e ninguém sabe qual superfície foi.
// É o padrão que esta sessão inteira perseguiu: cópia sem vínculo com a fonte.
import { MODEL_CHAIN } from "../lib/guiBrain.js";

// Normalize a raw input into a fetchable https URL, or "" — with the SAME SSRF guard as demo.js
// (block loopback/link-local/private/metadata so a crafted URL can't probe internal addresses).
function normalizeUrl(raw) {
  let v = (raw == null ? "" : raw.toString()).slice(0, 300).trim();
  if (!v) return "";
  if (v.startsWith("@")) return "";
  if (!/^https?:\/\//i.test(v)) { if (/\s/.test(v) || !v.includes(".")) return ""; v = "https://" + v; }
  try {
    const u = new URL(v);
    const h = u.hostname.toLowerCase();
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    if (h === "localhost" || h.endsWith(".localhost") || h === "0.0.0.0" || h === "[::1]" || h === "::1") return "";
    if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return "";
    if (!h.includes(".")) return "";
    return u.toString();
  } catch { return ""; }
}

// Strip HTML → readable text for the fact-extractor.
function htmlToText(html) {
  return (html || "").toString().slice(0, 400000)
    .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, 12000);
}

// Fetch the site (hard timeout) and extract a factual kit {name,tagline,facts,services} via Claude.
// Returns {} on any miss — the caller's completeness gate then decides inject vs needs-review.
async function scrapeBusinessFacts(env, url, hintName) {
  if (!env.ANTHROPIC_API_KEY) return {};
  let html = "";
  try {
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const resp = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; GuileoOnboardBot/1.0; +https://guileoai.com)", Accept: "text/html" }, cf: { cacheTtl: 300 }, signal: ctrl.signal });
      if (resp.ok) html = await resp.text();
    } finally { clearTimeout(timer); }
  } catch { return {}; }
  const text = htmlToText(html);
  if (text.length < 80) return {};
  const system = `You extract a factual brand kit from a business website's text. Reply with ONLY valid JSON, no markdown, no preamble. Shape:
{"name":"","tagline":"","facts":"","services":[{"name":"","price":""}]}
RULES: Use ONLY information present in the text. If a field is not found, use "" (or [] for services). NEVER invent a business name, service, or price. "facts" = a compact factual paragraph (hours, location, specialties, what to know) usable as an AI receptionist's brain. "services" = up to 8 real offerings; include "price" only if a price actually appears.`;
  const deadline = Date.now() + 9000;
  for (const model of MODEL_CHAIN) {
    const remaining = deadline - Date.now(); if (remaining <= 500) break;
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), remaining);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 900, system, messages: [{ role: "user", content: `Website text${hintName ? ` for "${hintName}"` : ""}:\n\n${text}` }] }),
        signal: ctrl.signal,
      });
      if (r.ok) { const d = await r.json().catch(() => ({})); const m = ((d?.content?.[0]?.text || "").trim()).match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch { /* try next */ } } }
      else if (r.status === 401 || r.status === 402) break;
    } catch { /* abort/network — next model if budget remains */ }
    finally { clearTimeout(timer); }
  }
  return {};
}

// Completeness gate: only inject auto-collected facts when they're substantive — else needs-review.
function assessKbFacts(kit) {
  const facts = (kit?.facts || "").toString().trim();
  const services = Array.isArray(kit?.services) ? kit.services.filter((x) => x && x.name).map((x) => ({ name: (x.name || "").toString().slice(0, 120), price: (x.price || "").toString().slice(0, 40) })).slice(0, 8) : [];
  const name = (kit?.name || "").toString().trim();
  let score = 0;
  if (name) score += 1;
  if (facts.length >= 140) score += 2; else if (facts.length >= 60) score += 1;
  if (services.length >= 3) score += 2; else if (services.length >= 1) score += 1;
  if ((kit?.tagline || "").toString().trim()) score += 1;
  const complete = facts.length >= 140 && services.length >= 1 && score >= 4;
  return { complete, score, facts, services, name };
}

// The live "pool": numbers ON the account that are FREE — not the reserved demo line and not already
// bound to any ElevenLabs agent. If we CAN'T read the ElevenLabs bindings we return [] (never risk
// handing out a number that's already answering for another tenant). Same truth as twilio-numbers.js.
async function listFreeAccountNumbers(env) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return [];
  const auth = "Basic " + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
  let nums = [];
  try {
    const tr = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json?PageSize=100`, { headers: { Authorization: auth } });
    if (!tr.ok) return [];
    const td = await tr.json().catch(() => ({}));
    nums = (td.incoming_phone_numbers || []).map((n) => ({ number: n.phone_number, sid: n.sid }));
  } catch { return []; }
  if (!env.ELEVENLABS_API_KEY) return []; // can't verify bindings → don't risk a double-assign
  const bound = new Set();
  try {
    const er = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
    if (!er.ok) return [];
    const ed = await er.json().catch(() => []);
    (Array.isArray(ed) ? ed : (ed.phone_numbers || [])).forEach((p) => { if (p && p.phone_number) bound.add(p.phone_number.replace(/[^0-9]/g, "")); });
  } catch { return []; }
  return nums.filter((n) => { const d = (n.number || "").replace(/[^0-9]/g, ""); return d && !isReserved(d) && !bound.has(d); });
}

// Atomically claim the first free pooled number for this tenant. pool_claim_number (db/number_pool.sql)
// is the mutex: only one concurrent onboard wins a given line. Returns {number,sid} or null.
// Until the SQL is pasted the RPC 404s → we assign NOTHING (safe: honest fallback to pending).
async function tryAssignPooledNumber(env, email, ING) {
  const free = await listFreeAccountNumbers(env);
  for (const cand of free) {
    let won = false;
    try { const cr = await svcRpc(env, "pool_claim_number", { p_secret: ING, p_email: email, p_number: cand.number }); if (cr.ok) won = (await cr.json()) === true; } catch { won = false; }
    if (won) return cand;
  }
  return null;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json();
    const token = (b.token || "").toString();
    // AUTH FIRST — verify the admin token before validating fields, so an unauthenticated
    // probe always gets 401 (never a 400 that leaks the expected request shape).
    const vr = await rpc("blitz_stats", { p_token: token, p_email: "" });
    if (!vr.ok) return json({ error: "unauthorized" }, 401);

    const email = (b.email || "").toString().trim().toLowerCase();
    if (!email.includes("@") || !b.business) return json({ error: "email + business required" }, 400);

    const ING = env.INGEST_SECRET || "";

    // 🚨 TRAVA DE CLIENTE JÁ EXISTENTE (2026-08-20). O agente e o número deste fluxo são
    // idempotentes — mas `add_client_credits` SOMA (credits = credits + novos) e sobrescreve o
    // plano. Rodar isto de novo num cliente vivo não dá erro: dá crédito a mais e troca o plano
    // dele em silêncio. Quase aconteceu com a primeira cliente real, por um e-mail digitado no
    // formulário de cima em vez do de baixo. Fail-closed: só passa com `reativar: true` explícito.
    // 🚨 SERVICE_ROLE, NÃO ANON (corrigido 25/08). Estas três RPCs foram REVOGADAS do anon na
    // faxina de segurança, e este arquivo continuou chamando com a chave anon. Resultado:
    // `client_ja_existe` devolvia 401, o portão é fail-closed, e **cadastrar cliente novo estava
    // quebrado em produção** — para qualquer um, não só para este. Ninguém percebeu porque a
    // resposta saía como 502 e o Cloudflare TROCA o corpo de um 502 pela página de erro dele: a
    // nossa frase "não consegui verificar, não vou ativar no escuro" nunca chegou a ninguém.
    // Lição dupla: (1) revogar do anon exige varrer quem chamava; (2) 502 é status mudo — motivo
    // que precisa ser lido não pode viajar nele.
    if (!(b.reativar === true || b.reativar === "true")) {
      const jr = await svcRpc(env, "client_ja_existe", { p_secret: ING, p_email: email });
      if (jr.ok) {
        const j = await jr.json().catch(() => null);
        if (j && j.existe === true) {
          return json({
            error: "cliente_ja_existe",
            motivo: `${email} já é cliente (plano ${j.plano || "—"}, ${j.creditos} créditos). Ativar de novo SOMARIA créditos e trocaria o plano. Para reenviar o acesso use "Reenviar e-mail de acesso"; para ativar mesmo assim, marque reativar.`,
            plano: j.plano || "", creditos: j.creditos,
          }, 409);
        }
      }
      // jr.ok falso = não consegui perguntar. Não sigo no escuro: escrever aqui é irreversível.
      else return json({ error: "checagem_falhou", motivo: `não consegui verificar se ${email} já é cliente (HTTP ${jr.status}) — não vou ativar no escuro` }, 409);
    }

    const business = b.business.toString().slice(0, 160);
    const lang = ["pt", "es", "en"].includes(b.lang) ? b.lang : "en";
    // agent_name lets a client white-label the voice (e.g. "Sofia"); empty → defaults to the Guileo brand "Gui".
    const agentName = (b.agent_name || "").toString().trim().slice(0, 40) || "Gui";
    // SELF-SERVE gate (#14): the two autonomous behaviors (auto-KB, auto-assign pooled number) run
    // ONLY for a self-serve buyer. Admin/seller onboarding never sets this → their path is byte-for-
    // byte unchanged. bornBrain is the brain the Gui is BORN with — the KB step may augment it below.
    const selfServe = b.self_serve === true || b.self_serve === "true";
    let bornBrain = (b.brain || "").toString().slice(0, 4000);
    const result = { ok: true, steps: {} };

    // 1) profile — greeting/lang/brand of the Gui. A silent failure here = the agent is born with the
    //    wrong name/language and the cockpit shows nothing; check .ok AND emitFailure (never silent).
    try {
      const prf = await rpc("set_client_profile", { p_secret: ING, p_email: email, p_profile: {
        business_name: business, industry: (b.industry || "").toString().slice(0, 80), lang,
        review_link: (b.review_link || "").toString().slice(0, 300), forward_number: (b.forward_number || "").toString().replace(/[^0-9+]/g, ""),
      } });
      result.steps.profile = prf.ok ? "ok" : "err: profile NOT stored";
      if (!prf.ok) await emitFailure(env, "profile_set_failed", email, `set_client_profile ${prf.status} — greeting/lang/brand missing, re-run`, { lang, business });
    } catch (e) { result.steps.profile = "err"; await emitFailure(env, "profile_set_failed", email, `set_client_profile threw: ${String(e).slice(0, 120)} — greeting/lang/brand missing`); }

    // 1.2) OWNER ALERT PHONE — the number the owner's phone RINGS on a real emergency / escalation
    //      (the flagship "the owner's phone rings" feature is INERT without it). Captured in the
    //      wizard (notify_phone), plumbed here. Without this, emergency dispatch degrades to email-only.
    const notifyPhone = (b.notify_phone || "").toString().replace(/[^0-9+]/g, "").slice(0, 20);
    if (notifyPhone) {
      try {
        const nr = await rpc("set_client_notify_phone", { p_secret: ING, p_email: email, p_phone: notifyPhone });
        result.steps.notify_phone = nr.ok ? "ok" : "err";
        if (!nr.ok) await emitFailure(env, "notify_phone_set_failed", email, `set_client_notify_phone ${nr.status} — emergency dispatch can't ring the owner`, {});
      } catch { result.steps.notify_phone = "err"; await emitFailure(env, "notify_phone_set_failed", email, "set_client_notify_phone threw — emergency can't ring the owner"); }
    } else {
      result.steps.notify_phone = "skipped (none captured)";
      await emitFailure(env, "notify_phone_missing", email, `${business} activated WITHOUT an owner alert phone — emergency dispatch & owner-text are email-only until set`, {});
    }

    // 1.5) CADASTRO COMPLETO extras — the white-label bits the base profile RPC doesn't carry:
    //      logo, accent, agent name/voice, the channels map + social/support links. Stored as a jsonb
    //      'extras' blob (db/onboard_completo.sql · profile_extras_set) so the cockpit widget can render
    //      THEIR logo/brand. Best-effort — never blocks the birth of the agent.
    try {
      const ch = (b.channels && typeof b.channels === "object") ? b.channels : {};
      const extras = {
        logo_url: (b.logo_url || "").toString().slice(0, 500),
        accent: (b.accent || "").toString().slice(0, 16),
        agent_name: agentName,
        voice_key: (b.voice_key || "").toString().slice(0, 40),
        channels: ch,
        support_link: (b.support_link || "").toString().slice(0, 300),
        review_link: (b.review_link || "").toString().slice(0, 300),
        social: {
          instagram: ch.instagram?.handle || "", facebook: ch.facebook?.handle || "",
          linkedin: ch.linkedin?.url || "", tiktok: ch.tiktok?.handle || "",
          youtube: ch.youtube?.url || "", google_business: ch.google_business?.url || "",
        },
      };
      const er = await rpc("profile_extras_set", { p_secret: ING, p_email: email, p_extras: extras });
      result.steps.extras = er.ok ? "ok" : "err: extras NOT stored (paste db/onboard_completo.sql)";
      // silent loss of logo/accent/agent-voice/channels = the white-label brand vanishes with no trace.
      if (!er.ok) await emitFailure(env, "profile_extras_failed", email, `profile_extras_set ${er.status} — logo/accent/voice/channels NOT stored (paste db/onboard_completo.sql)`);
    } catch (e) { result.steps.extras = "err"; await emitFailure(env, "profile_extras_failed", email, `profile_extras_set threw: ${String(e).slice(0, 120)} — white-label brand not stored`); }

    // 1.6) PENDING CHANNELS — capture the handle/link NOW (activates when that platform's API is approved,
    //      same wired-but-inert pattern as WhatsApp). One client_integrations placeholder per present
    //      channel (status 'pending') so the cockpit shows it as "aguardando". LIVE channels
    //      (phone/voice, sms, web widget, email) are provisioned elsewhere — never placeholdered here.
    try {
      const ch = (b.channels && typeof b.channels === "object") ? b.channels : {};
      const PENDING = {
        whatsapp: ch.whatsapp?.number, instagram: ch.instagram?.handle, facebook: ch.facebook?.handle,
        linkedin: ch.linkedin?.url, tiktok: ch.tiktok?.handle, youtube: ch.youtube?.url,
        google_business: ch.google_business?.url, ads: ch.ads?.enabled ? "enabled" : "",
        reviews: ch.reviews?.link || b.review_link,
      };
      const pending = [];
      for (const [provider, val] of Object.entries(PENDING)) {
        const handle = (val || "").toString().trim();
        if (!handle) continue;
        try {
          await rpc("store_integration", { p_secret: ING, p_email: email, p_provider: provider, p_tokens: { status: "pending", handle } });
          pending.push(provider);
        } catch { /* best-effort per channel */ }
      }
      result.steps.channels = pending.length ? `aguardando: ${pending.join(", ")}` : "none";
    } catch { result.steps.channels = "err"; }

    // 2) credits row + connection code
    try {
      // credits are what the client PAID for — check the RPC actually landed (fetch doesn't throw on
      // non-2xx, so the old unchecked await could report "ok" while storing nothing = paid-but-nothing).
      // ── O $50 PROMETIDO AO LEAD, HONRADO SOZINHO (2026-08-20) ──────────────────────────────
      // O e-mail do vendedor promete "$50 de crédito no primeiro mês" e o hub grava a promessa na
      // ficha do lead, com data. Sem este bloco, honrar dependia de alguém lembrar de somar
      // créditos à mão na ativação — e promessa que depende de memória humana é promessa quebrada
      // na frente do cliente que acabou de pagar.
      // 🚨 O VALOR É CALCULADO, NÃO CHUTADO. O crédito custa diferente por plano ($0,298 no
      // Essential, $0,225 no Personalized, $0,167 no Full Operation). Dar um número fixo daria
      // $50 em um plano e outra coisa em outro — e a conta do cliente não bateria com a promessa.
      let bonus = 0, promessa = null;
      try {
        const pr = await svcRpc(env, "promessa_do_lead", { p_secret: ING, p_email: email, p_business: business });
        if (pr.ok) {
          const pd = await pr.json().catch(() => null);
          if (pd?.tem === true) {
            const plano = GUILEO_PLANS.find((x) => x.key === (b.plan || "")) || null;
            const precoNum = plano ? parseFloat(String(plano.price).replace(/[^0-9.]/g, "")) : 0;
            const porCredito = plano && plano.credits > 0 && precoNum > 0 ? precoNum / plano.credits : 0;
            // sem preço confiável do plano, NÃO invento crédito: registro a promessa e deixo visível.
            bonus = porCredito > 0 ? Math.round(50 / porCredito) : 0;
            promessa = { ...pd, bonus_creditos: bonus, plano: b.plan || "" };
          }
        }
      } catch { /* a promessa não pode derrubar a ativação; ela aparece no resultado como não-lida */ }

      const cr = await rpc("add_client_credits", { p_secret: ING, p_email: email, p_credits: (Number(b.credits) || 0) + bonus, p_plan: (b.plan || "").toString().slice(0, 80) });
      if (promessa) {
        result.steps.promessa_50 = bonus > 0
          ? `honrada: +${bonus} créditos (US$50 no plano ${promessa.plano})`
          : "promessa encontrada mas SEM preço de plano — some os créditos à mão";
        await emitFailure(env, "promessa_50_honrada", email,
          `US$50 prometido por ${promessa.vendedor} ao lead ${promessa.negocio} — ${bonus > 0 ? `+${bonus} créditos aplicados` : "NÃO aplicado, sem preço de plano"}`,
          { prospect: promessa.prospect, bonus }).catch(() => {});
      }
      const kr = await rpc("admin_get_client_key", { p_token: token, p_email: email });
      result.connection_code = kr.ok ? await kr.json() : null;
      result.steps.credits = cr.ok ? "ok" : "err: credits NOT stored — re-run";
      if (!cr.ok) { result.ok = false; await emitFailure(env, "credits_not_stored", email, "add_client_credits failed during onboarding — re-run", { plan: (b.plan || "").toString() }); }
      // no code = the client can NEVER activate their portal — loudest possible failure
      if (!result.connection_code) await emitFailure(env, "connection_code_missing", email, "admin_get_client_key returned nothing — client has no activation key");
    } catch { result.steps.credits = "err"; result.ok = false; await emitFailure(env, "credits_not_stored", email, "credits step threw during onboarding — re-run"); }

    // 2.2) BIRTH EMAIL moved AFTER the number step (5.5) — it used to fire here, before
    //      result.number existed, so every welcome email shipped with an empty Gui number.

    // 2.5) DAY-1 SCHEDULING SEED — give the business default services + hours so the Gui can actually
    //      check availability and BOOK from the first call. Idempotent: only seeds when the schedule is
    //      empty (so re-onboarding never duplicates). Uses SCHED_SECRET. Best-effort; never blocks.
    if (env.SCHED_SECRET) {
      try {
        const lk = await fetch(`${SB_URL}/rest/v1/rpc/biz_lookup`, {
          method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
          body: JSON.stringify({ p_secret: env.SCHED_SECRET, p_email: email }),
        });
        const menu = lk.ok ? await lk.json() : {};
        const hasServices = Array.isArray(menu?.services) && menu.services.length > 0;
        // CADASTRO COMPLETO — if the seller captured a rich scheduling payload (locations + hours +
        // services with price/deposit), import it VERBATIM; otherwise fall back to the day-1 default seed.
        const richPayload = b.payload && typeof b.payload === "object" ? b.payload : null;
        if (richPayload) {
          const sr = await fetch(`${SB_URL}/rest/v1/rpc/biz_admin_import`, {
            method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
            body: JSON.stringify({ p_secret: env.SCHED_SECRET, p_email: email, p_payload: richPayload }),
          });
          const out = sr.ok ? await sr.json().catch(() => ({})) : {};
          // seed failure = the Gui is born WITHOUT services → it can't quote or book (dead core). Alert loud.
          if (!sr.ok || out?.error) {
            result.steps.scheduling = `err: ${out?.error || `import ${sr.status}`}`;
            await emitFailure(env, "scheduling_seed_failed", email, `biz_admin_import (rich) failed — Gui born with NO services, can't book/quote · ${out?.error || sr.status}`, { mode: "rich" });
          } else { result.steps.scheduling = `imported (${out.services ?? "?"} serviços)`; }
        } else if (!hasServices) {
          const payload = buildDefaultSchedulePayload({ industry: b.industry, lang, tz: (b.tz || "America/New_York").toString() });
          const sr = await fetch(`${SB_URL}/rest/v1/rpc/biz_admin_import`, {
            method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
            body: JSON.stringify({ p_secret: env.SCHED_SECRET, p_email: email, p_payload: payload }),
          });
          const out = sr.ok ? await sr.json().catch(() => ({})) : {};
          if (!sr.ok || out?.error) {
            result.steps.scheduling = `err: ${out?.error || `seed ${sr.status}`}`;
            await emitFailure(env, "scheduling_seed_failed", email, `default schedule seed failed — Gui born with NO services, can't book/quote · ${out?.error || sr.status}`, { mode: "default" });
          } else { result.steps.scheduling = `seeded (${out.services ?? "?"} serviços)`; }
        } else { result.steps.scheduling = "already had services"; }
      } catch (e) { result.steps.scheduling = `err: ${String(e).slice(0, 80)}`; await emitFailure(env, "scheduling_seed_failed", email, `scheduling seed threw: ${String(e).slice(0, 120)} — Gui may have no services`); }
    } else { result.steps.scheduling = "skipped (no SCHED_SECRET)"; }

    // 2.8) AUTO-BUILD KB (self-serve only) — a self-serve buyer who never wrote a brain/KB would get a
    //      confidently-empty Gui. Scrape their OWN website for REAL business facts so Gui can answer on
    //      call #1. HONESTY GATE: a thin scrape is NEVER injected as truth — the client is flagged
    //      'needs KB review' so a human enriches it (better silent-honest than confidently-wrong).
    //      Strictly self-serve-gated + best-effort: never blocks the birth, never touches admin paths.
    if (selfServe) {
      try {
        const ch = (b.channels && typeof b.channels === "object") ? b.channels : {};
        const siteRaw = (b.website || ch.website?.url || (typeof ch.website === "string" ? ch.website : "") || ch.google_business?.url || "").toString();
        const siteUrl = normalizeUrl(siteRaw);
        // does the client ALREADY have real knowledge (owner-typed brain or curated KB)? → don't overwrite.
        let kbThin = true;
        try { const kr = await rpc("kb_for_agent", { p_secret: ING, p_email: email }); if (kr.ok) { const kb = ((await kr.json()) || "").toString(); if (kb.trim().length > 200) kbThin = false; } } catch { /* KB RPC missing → treat as thin */ }
        const brainThin = bornBrain.trim().length < 400;
        if (!kbThin || !brainThin) {
          result.steps.kb = "skipped (already has knowledge)";
        } else if (!siteUrl) {
          // no site AND no brain/KB → the Gui would be born blind. Flag for review, inject nothing.
          result.steps.kb = "needs review (no website + thin brain)";
          await emitFailure(env, "kb_review_needed", email, `${business} self-serve without website/brain — Gui born thin, needs KB review before it's confidently wrong`, {});
        } else if (!env.ANTHROPIC_API_KEY) {
          result.steps.kb = "skipped (no ANTHROPIC_API_KEY)";
        } else {
          const kit = await scrapeBusinessFacts(env, siteUrl, business);
          const a = assessKbFacts(kit);
          if (a.complete) {
            const svcLines = a.services.length ? `\nSERVICES:\n${a.services.map((x) => `- ${x.name}${x.price ? ` — ${x.price}` : ""}`).join("\n")}` : "";
            const host = (() => { try { return new URL(siteUrl).host; } catch { return siteUrl; } })();
            // inject into the brain the Gui is BORN with (step 3 reads bornBrain)
            bornBrain = `${bornBrain}\n\nBUSINESS FACTS (auto-collected from ${host}; owner should verify):\n${a.facts}${svcLines}`.trim().slice(0, 4000);
            // persist as tenant KB so future portal brain-syncs re-inject it (kb_for_agent)
            try { await rpc("kb_upsert", { p_secret: ING, p_email: email, p_id: null, p_question: `About ${business}`.slice(0, 400), p_answer: a.facts.slice(0, 2000), p_category: "general", p_active: true }); } catch { /* KB persist best-effort */ }
            if (a.services.length) { try { await rpc("kb_upsert", { p_secret: ING, p_email: email, p_id: null, p_question: "What services and prices do you offer?", p_answer: a.services.map((x) => `${x.name}${x.price ? ` — ${x.price}` : ""}`).join("; ").slice(0, 2000), p_category: "services", p_active: true }); } catch { /* best-effort */ } }
            result.steps.kb = `built from site (${a.services.length} services)`;
          } else {
            // thin scrape — DO NOT inject guesses; flag for human review (honesty over autonomy).
            try { await rpc("store_integration", { p_secret: ING, p_email: email, p_provider: "kb_review", p_tokens: { status: "pending", reason: "thin_scrape", url: siteUrl, score: a.score } }); } catch { /* flag best-effort */ }
            await emitFailure(env, "kb_review_needed", email, `${business} auto-scrape too thin (score ${a.score}) — Gui NOT given guessed facts; enrich KB in /admin`, { url: siteUrl });
            result.steps.kb = "needs review (thin scrape — not injected)";
          }
        }
      } catch (e) { result.steps.kb = `err: ${String(e).slice(0, 80)}`; }
    }

    // 3) provision a dedicated sales-first ElevenLabs agent — IDEMPOTENT: if this client already has
    //    one, UPDATE it in place (so re-running onboarding never duplicates the agent or double-bills),
    //    and the update re-applies the current voice + prompt (so existing agents pick up the new voice).
    if (env.ELEVENLABS_API_KEY) {
      try {
        // bornBrain = the owner brain, augmented by any auto-collected website facts (self-serve KB step).
        const brain = bornBrain;
        // ONE source of truth: strong LLM (comprehension) + Flash voice + scheduling/booking tool so the
        // Gui actually RECORDS bookings and sends confirmations — not just talks about them.
        // FIX A contract — the Gui must be BORN knowing exact prices so it quotes/closes on call #1.
        const prices = buildPricesText(b);
        // Cliente NOVO já nasce com voz nativa em português/espanhol (mesmo resolvedor do sync).
        const nativeVoices = await resolveNativeVoices(env).catch(() => ({}));
        const convCfg = buildConversationConfig(env, { business, industry: b.industry, lang, brain, agentName, email, prices, voiceId: (b.voice_id || "").toString().trim(), nativeVoices });
        // does this client already have a dedicated agent?
        let existingId = "";
        try { const ar = await rpc("client_agent_lookup", { p_secret: ING, p_email: email }); if (ar.ok) existingId = ((await ar.json()) || "").toString(); } catch { /* best-effort */ }
        if (existingId) {
          const pr = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${existingId}`, {
            method: "PATCH", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ conversation_config: convCfg }),
          });
          if (pr.ok) { result.agent_id = existingId; result.steps.agent = `updated existing ${existingId}`; }
          else { result.steps.agent = `err PATCH ${pr.status}: ${(await pr.text().catch(() => "")).slice(0, 500)}`; result.ok = false; await emitFailure(env, "agent_provision_failed", email, `agent PATCH ${pr.status} — client paid, agent NOT updated`, { agent_id: existingId }); }
        } else {
          const res = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
            method: "POST", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ name: `${agentName} · ${business}`.slice(0, 60), conversation_config: convCfg }),
          });
          if (res.ok) {
            const d = await res.json(); result.agent_id = d.agent_id || d.id || ""; result.steps.agent = "ok";
            // persist the agent_id so calls route + portal syncs the brain; surface persistence failures.
            if (result.agent_id) {
              const sr2 = await rpc("set_client_agent", { p_secret: ING, p_email: email, p_agent_id: result.agent_id });
              if (!sr2.ok) { result.steps.agent = "created_but_NOT_linked — calls won't route"; result.ok = false; await emitFailure(env, "agent_provision_failed", email, `agent ${result.agent_id} created but set_client_agent failed — calls won't route, link manually`, { agent_id: result.agent_id }); }
              // register the tenant→agent map (accessible registry) so speed-to-lead callbacks dial AS
              // their Gui even on a shared number; the number-bind step later adds their el_phone_number_id.
              try { await rpc("client_agent_upsert", { p_secret: ING, p_email: email, p_agent_id: result.agent_id }); } catch { /* best-effort */ }
            } else { result.steps.agent = "created_no_id"; result.ok = false; await emitFailure(env, "agent_provision_failed", email, "agent created but ElevenLabs returned no id — client paid, no routable agent"); }
          } else { result.steps.agent = `err ${res.status}: ${(await res.text().catch(() => "")).slice(0, 500)}`; result.ok = false; await emitFailure(env, "agent_provision_failed", email, `agent create ${res.status} — client paid, NO agent born`); }
        }
      } catch (e) { result.steps.agent = `err: ${String(e).slice(0, 120)}`; result.ok = false; await emitFailure(env, "agent_provision_failed", email, `agent step threw: ${String(e).slice(0, 120)}`); }
    } else { result.steps.agent = "skipped (no ElevenLabs key)"; }

    // 4) number — map existing, or buy a fresh one, then wire webhooks
    const mode = b.number_mode || "shared";
    try {
      if (mode === "existing" && b.existing_number) {
        const num = b.existing_number.toString().replace(/[^0-9+]/g, "");
        // GUARD: refuse the platform's RESERVED demo line — mapping it here would HIJACK the site demo's
        // Gui onto this client (same rule as bind-number.js). Never bind/persist it.
        if (isReserved(num)) {
          result.steps.number = "🚫 recusado: número RESERVADO do demo — mapeie um número livre pro cliente";
          await emitFailure(env, "reserved_number_blocked", email, `tried to map RESERVED demo line ${num} to client — refused (would hijack site demo)`, { number: num });
        } else {
          const snr = await rpc("set_client_number", { p_secret: ING, p_email: email, p_number: num });
          result.number = num; result.steps.number = snr.ok ? "mapped" : `mapped-but-NOT-persisted ${snr.status}`;
          if (!snr.ok) await emitFailure(env, "number_orphaned", email, `set_client_number failed for ${num} — link manually`, { number: num });
        }
      } else if (mode === "buy" && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
        const sid = env.TWILIO_ACCOUNT_SID, tok = env.TWILIO_AUTH_TOKEN;
        const area = (b.area_code || "").toString().replace(/[^0-9]/g, "");
        const auth = "Basic " + btoa(`${sid}:${tok}`);
        // IDEMPOTENT (crítico $): before spending money on a NEW number, check if this client already has
        // one (provision.js:370 does the same). A re-clicked approve / webhook re-delivery must NOT buy a
        // 2nd $/mo line. If found, reuse it — step 5 re-binds it to the agent (identical outcome).
        let already = "";
        try { const lr = await svcRpc(env, "client_number_lookup", { p_secret: ING, p_email: email }); if (lr.ok) already = ((await lr.json()) || "").toString(); } catch { /* lookup best-effort → proceed to buy */ }
        if (already) {
          result.number = already; result.steps.number = "reused (client já tinha número — não comprei outro)";
        } else {
        // find one available US local number
        const sr = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/AvailablePhoneNumbers/US/Local.json?SmsEnabled=true&VoiceEnabled=true${area ? `&AreaCode=${area}` : ""}&PageSize=1`, { headers: { Authorization: auth } });
        const avail = sr.ok ? await sr.json() : {};
        const pick = avail?.available_phone_numbers?.[0]?.phone_number;
        if (pick) {
          const pr = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json`, {
            method: "POST", headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ PhoneNumber: pick, SmsUrl: "https://guileoai.com/api/twilio-inbound", SmsMethod: "POST", VoiceUrl: "https://guileoai.com/api/twilio-voice", VoiceMethod: "POST" }),
          });
          if (pr.ok) {
            const pd = await pr.json();
            result.number = pd.phone_number;
            // a number BOUGHT but not linked = orphaned $ + calls that won't route — surface, never fake "wired"
            const snr = await rpc("set_client_number", { p_secret: ING, p_email: email, p_number: pd.phone_number });
            if (snr.ok) { result.steps.number = "bought+wired"; }
            else { result.steps.number = `bought ${pd.phone_number} but NOT linked — link manually`; await emitFailure(env, "number_orphaned", email, `bought ${pd.phone_number} but set_client_number failed — link manually`, { number: pd.phone_number }); }
          }
          else { result.steps.number = "buy_failed"; await emitFailure(env, "number_provision_failed", email, `Twilio buy failed for ${pick}`, { number: pick }); }
        } else { result.steps.number = "none_available"; await emitFailure(env, "number_provision_failed", email, `no US number available${area ? ` (area ${area})` : ""} — map one manually`, {}); }
        }
      } else if (mode === "pool" || (selfServe && (!b.number_mode || mode === "shared"))) {
        // AUTO-ASSIGN (self-serve, #14) — claim a FREE number from the account's own live stock so a
        // self-serve buyer gets a working line with NO admin 'Mapear número' step. Reuses the proven
        // set_client_number path here + the elevenBindNumber/client_agent_upsert bind in step 5. If the
        // pool is empty (or the claim RPC isn't live yet) we fall back HONESTLY to shared — never fake.
        const claimed = await tryAssignPooledNumber(env, email, ING);
        if (claimed && claimed.number) {
          const snr = await rpc("set_client_number", { p_secret: ING, p_email: email, p_number: claimed.number });
          result.number = claimed.number;
          if (snr.ok) {
            result.steps.number = "auto-assigned from pool";
            // ensure SMS→twilio-inbound is wired (elevenBindNumber in step 5 handles the voice import).
            try { if (claimed.sid) await configureTwilioWebhooks(env, claimed.sid); } catch { /* webhook wiring best-effort */ }
          } else {
            // claimed the line but couldn't link it → release-and-retry territory; never fake "wired".
            result.steps.number = `pool ${claimed.number} claimed but NOT persisted ${snr.status}`;
            await emitFailure(env, "number_orphaned", email, `pool number ${claimed.number} claimed but set_client_number failed — release (pool_release_number) + retry`, { number: claimed.number });
          }
        } else {
          result.steps.number = "shared (nenhum número livre no pool — map/buy later for A2P routing)";
        }
      } else {
        result.steps.number = "shared (inbound falls to owner; map/buy later for A2P routing)";
      }
    } catch (e) { result.steps.number = "err"; await emitFailure(env, "number_provision_failed", email, `number step threw (mode=${mode}): ${String(e).slice(0, 120)}`); }

    // 5) INBOUND → THE CLIENT'S OWN GUI: with a number AND a dedicated agent, bind them in ElevenLabs
    // so an inbound call is ANSWERED by the client's trained Gui — not merely forwarded or texted back.
    if (result.number && isReserved(result.number)) {
      // last-line guard: never bind the RESERVED demo line to a client agent (would hijack the site demo).
      result.steps.inbound = "🚫 recusado: número RESERVADO do demo — não vinculado";
      await emitFailure(env, "reserved_number_blocked", email, `refused to bind RESERVED demo line ${result.number} to agent ${result.agent_id} (would hijack site demo)`, { number: result.number, agent_id: result.agent_id || "" });
    } else if (result.number && result.agent_id) {
      const bind = await elevenBindNumber(env, result.number, result.agent_id, `${agentName} · ${business}`);
      result.steps.inbound = bind.ok ? "their Gui answers inbound ✅" : `NOT bound: ${bind.reason}`;
      // a number that exists but isn't bound = paid line that never answers — surface it loudly
      if (!bind.ok) { result.ok = false; await emitFailure(env, "inbound_bind_failed", email, `number ${result.number} NOT bound to agent ${result.agent_id}: ${bind.reason}`, { number: result.number, agent_id: result.agent_id }); }
      // PERSIST the tenant→agent map in the ACCESSIBLE registry so /api/call can dial speed-to-lead
      // callbacks AS this client's OWN Gui (their agent + their caller-ID). Best-effort; never blocks.
      try { await rpc("client_agent_upsert", { p_secret: ING, p_email: email, p_agent_id: result.agent_id, p_el_phone_number_id: bind.phone_number_id || "", p_number: result.number }); } catch { /* registry write best-effort */ }
    } else if (result.number) { result.steps.inbound = "skipped (no dedicated agent created)"; }

    // call-forwarding instructions (both options — client picks) so the client routes their own
    // existing business line into this AI number. Surfaced in /admin to hand to the client.
    if (result.number) result.forwarding = forwardingInstructions(result.number, lang);

    // 5.5) BIRTH EMAIL — the strategic first-login moment. The CLIENT automatically receives the
    //      branded welcome with their ACTIVATION KEY (connection code) + their Gui NUMBER (now that
    //      it exists) + first steps, so the handoff scales without Luis copy-pasting codes.
    //      Best-effort: a mail hiccup never blocks activation — but it alerts, never silent.
    try {
      if (env.RESEND_API_KEY && result.connection_code) {
        const { subject, html } = welcomeSelfServeEmail({
          name: (b.owner_name || b.agent_name || "").toString() || email.split("@")[0],
          business: (b.business || "").toString(), lang: (b.lang || "pt").toString(),
          plan: (b.plan || "Personalizado").toString(), code: result.connection_code,
          credits: Number(b.credits) || 0, number: result.number || "",
        });
        const mr = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [email], subject, html }),
        });
        result.steps.birth_email = mr.ok ? "ok" : `err ${mr.status}`;
        // the birth email carries the ACTIVATION KEY — if it fails the client never gets in
        if (!mr.ok) await emitFailure(env, "birth_email_failed", email, `Resend ${mr.status} — activation key never reached the client, resend manually`, { code: result.connection_code });
      } else result.steps.birth_email = "skipped (no RESEND/code)";
    } catch { result.steps.birth_email = "err"; await emitFailure(env, "birth_email_failed", email, "birth email threw — activation key never reached the client, resend manually"); }

    // log the onboarding as a real event
    try { await svcRpc(env, "ingest_client_event", { p_secret: ING, p_email: email, p_type: "provision", p_channel: "system", p_summary: `🚀 Cliente ativado: ${business}${result.number ? " · " + result.number : ""}`, p_amount: 0, p_payload: { agent_id: result.agent_id || "" } }); } catch { /* */ }

    // ONBOARDING NURTURE SEED — admin-onboarded clients do NOT pass through stripe-webhook, so they
    // would never enter the onboarding machine. Stamp access + stash name/lang here too, so the cron
    // nurture (check-in 30/60/90 + monthly ROI, which fire off the 'access' stamp) reaches them —
    // and greets them by name in their language. Best-effort; never blocks activation.
    try {
      await rpc("onboard_advance", { p_secret: ING, p_email: email, p_step: "invoice" });
      await rpc("onboard_advance", { p_secret: ING, p_email: email, p_step: "access" });
      await rpc("onboard_set_meta", { p_secret: ING, p_email: email, p_meta: { name: (b.owner_name || b.agent_name || "").toString() || email.split("@")[0], lang: (b.lang || "pt").toString(), business: (b.business || "").toString() } });
    } catch { /* nurture seed best-effort */ }

    // TEAM KICKOFF BRIEF — the team gets an AI-generated one-page launch plan for this new client
    // (internal, to OWNER_EMAIL — never the client). Deduped once per client so a re-run of onboarding
    // never re-sends. Best-effort; never blocks activation.
    try {
      if (env.RESEND_API_KEY) {
        const owner = (env.OWNER_EMAIL || "smart@guileoai.com").split(",")[0].trim();
        const claim = await rpc("claim_credit_event", { p_secret: env.PEND_SECRET || "gx_pend_7Qk2mZ9vR4tLpW8n_cit3l3s", p_event_id: `team_brief:${email}`, p_email: email });
        const fresh = claim.ok ? (await claim.json()) === true : false;
        if (fresh && owner) {
          const origin = new URL(request.url).origin;
          const br = await fetch(`${origin}/api/onboarding`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "brief", client_email: email, secret: ING, lang: (b.lang || "pt").toString() }),
          });
          const brief = br.ok ? ((await br.json())?.brief || "") : "";
          if (brief) {
            const { subject, html } = teamKickoffBriefEmail({ business: (b.business || "").toString() || email.split("@")[0], brief, lang: (b.lang || "pt").toString() });
            await fetch("https://api.resend.com/emails", {
              method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [owner], subject, html }),
            });
            result.steps.team_brief = "ok";
          } else result.steps.team_brief = "skipped (no brief)";
        }
      }
    } catch { result.steps.team_brief = "err"; /* team brief is best-effort */ }

    // golden moment for the SELLER: their wallet client just went LIVE — best-effort, awaited.
    try {
      if (env.RESEND_API_KEY) {
        const sr = await rpc("seller_of_client", { p_secret: ING, p_client_email: email });
        const seller = sr.ok ? await sr.json().catch(() => null) : null;
        if (seller && seller.email) {
          const { subject, html } = sellerClientLiveEmail({
            sellerName: seller.name || "", business: (b.business || "").toString() || email.split("@")[0],
            // ⚠️ O IDIOMA VEM DO VENDEDOR, não cravado (2026-08-20). Era `lang:"pt"` fixo, então
            // kendall — que cobre Baltimore, DC e Philadelphia — recebia em português a notícia de
            // que o cliente dele entrou no ar. `seller_of_client` agora devolve `lang`, e NULL no
            // banco já vira 'en' lá dentro: reserva é o idioma da plataforma, não o do autor.
            clientEmail: email, lang: seller.lang || "en",
          });
          const mr = await fetch("https://api.resend.com/emails", {
            method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [seller.email], subject, html }),
          });
          result.steps.seller_email = mr.ok ? "ok" : `err ${mr.status}`;
        } else result.steps.seller_email = "skipped (no seller in wallet)";
      }
    } catch { result.steps.seller_email = "err"; }

    return json(result);
  } catch (e) {
    return json({ error: String(e).slice(0, 140) }, 400);
  }
}
