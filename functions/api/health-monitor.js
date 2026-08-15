// Cloudflare Pages Function — GET/POST /api/health-monitor?token=DIGEST_TOKEN
// CHURN DEFENSE (retention is the real business — AI apps keep only ~21% of clients).
// Compares each client's events this week vs last week; if activity dropped sharply, emails
// Luis an alert so he can reach out BEFORE the client thinks of cancelling (3x more
// effective than waiting). Driven by the weekly cron.
import { json, isOwnerEmail, safeEq } from "../lib/guard.js";
import { sbKey } from "../lib/sb.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

// INGEST-gated RPC helper (same pattern as /api/automations — that file iterates the same
// client enumeration; the pattern is copied, automations.js itself is untouched).
async function rpc(env, fn, args) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", ...args }),
  });
  return r.ok ? await r.json() : null;
}

// ── SILENT-CLIENT SWEEP — churn/breakage nobody notices ─────────────────────────────
// A client who PAID and got provisioned (agent + phone number) but produces ZERO
// call/booking/message events for ≥ SILENT_DAYS is either broken (agent down, number
// wrong, line not forwarded) or quietly churning. Enumerates the same clients_list RPC
// the weekly report cron uses, checks agent+number lookups, then scans a 30-day event
// window. Idempotent: an ATOMIC 7-day claim (silent_claim, db/silent_claim.sql) is taken
// BEFORE the ops_alert is ingested — no claim RPC pasted yet → report-only, never ingest.
const SILENT_TYPES = ["call", "booking", "message"];
const SILENT_LOOKBACK_DAYS = 30; // beyond this we can only truthfully say "30+ days"
const SILENT_MAX_CLIENTS = 40;   // subrequest budget: ~4 RPCs per client

// CONFIG-BROKEN ALERT — atomic 7-day claim per (email, kind) via health_claim
// (db/health_claims.sql). true → ingest the ops_alert; null → SQL not pasted (report-only).
async function opsAlert(env, out, email, kind, summary, payload = {}) {
  let alerted = false;
  const claimed = await rpc(env, "health_claim", { p_email: email, p_kind: kind });
  if (claimed === true) {
    // claim is burned for 7d, so a failed ingest must be visible — alerted:false in the JSON
    const ir = await rpc(env, "ingest_client_event", {
      p_email: email, p_type: "ops_alert", p_channel: "system",
      p_summary: summary.slice(0, 300), p_amount: 0, p_payload: { kind, ...payload },
    });
    alerted = ir !== null;
  } else if (claimed === null) out.configClaimReady = false; // db/health_claims.sql not pasted
  out.config.push({ email, kind, alerted });
}

async function silentSweep(env) {
  const days = Math.max(1, parseInt(env.SILENT_DAYS, 10) || 5);
  const out = { ready: true, claimReady: true, configClaimReady: true, days, silent: [], config: [] };
  const clients = await rpc(env, "clients_list", {});
  if (!Array.isArray(clients)) { out.ready = false; return out; }
  const sinceISO = new Date(Date.now() - SILENT_LOOKBACK_DAYS * 864e5).toISOString();
  for (const c of clients.slice(0, SILENT_MAX_CLIENTS)) {
    const email = ((c && c.client_email) || "").toString().trim().toLowerCase();
    if (!email.includes("@")) continue;
    // CONTA INTERNA NÃO É CLIENTE (2026-08-14). `luistelesc@`, `e2e-test@`, `sim@` são nossas —
    // gritar "📵 tem agente mas nenhum número" sobre a conta de teste é ruído diário sobre uma
    // conta que nunca deveria ter número. E ruído diário treina a gente a ignorar o painel, que é
    // como um alerta verdadeiro passa batido no meio. A marca já existia em client_credits.internal
    // (do trabalho de métrica honesta); só não chegava aqui porque clients_list não a devolvia.
    if (c && c.internal === true) { out.config.push({ email, kind: "interno", alerted: false }); continue; }
    const agent = await rpc(env, "client_agent_lookup", { p_email: email });
    const number = await rpc(env, "client_number_lookup", { p_email: email });
    // HALF-PROVISIONED — an agent nobody can call, or a number nobody answers. Both are a
    // paying client whose phone silently doesn't work; alert (7d-deduped) instead of skipping.
    if (agent && !number) {
      await opsAlert(env, out, email, "no_number", `📵 ${email} tem agente mas NENHUM número — ligações não chegam na Gui`, { agent: String(agent).slice(0, 60) });
      continue;
    }
    if (!agent && number) {
      await opsAlert(env, out, email, "no_agent", `🤖 ${email} tem número ${String(number).slice(0, 24)} mas NENHUM agente — ligações não são atendidas`, { number: String(number).slice(0, 24) });
      continue;
    }
    if (!agent) continue; // not provisioned at all — just "not live yet"
    const events = (await rpc(env, "client_events_since", { p_email: email, p_since: sinceISO })) || [];
    const times = (Array.isArray(events) ? events : [])
      .filter((e) => SILENT_TYPES.includes(e.type))
      .map((e) => new Date(e.created_at).getTime()).filter((t) => t > 0);
    const last = times.length ? Math.max(...times) : 0;
    const silentDays = last ? Math.floor((Date.now() - last) / 864e5) : SILENT_LOOKBACK_DAYS;
    if (silentDays < days) continue;
    const label = last ? String(silentDays) : `${SILENT_LOOKBACK_DAYS}+`;
    // ATOMIC 7-day claim BEFORE ingesting — false = already alerted this week, null = SQL not pasted.
    let alerted = false;
    const claimed = await rpc(env, "silent_claim", { p_email: email });
    if (claimed === true) {
      await rpc(env, "ingest_client_event", {
        p_email: email, p_type: "ops_alert", p_channel: "system",
        p_summary: `🔇 ${email} silencioso há ${label} dias — agente quebrado? número errado? churn?`,
        p_amount: 0, p_payload: { days: silentDays, threshold: days, agent: String(agent).slice(0, 60), number: String(number).slice(0, 24) },
      });
      alerted = true;
    } else if (claimed === null) out.claimReady = false; // db/silent_claim.sql not pasted → report-only
    out.silent.push({ email, days: silentDays, capped: !last, alerted });
  }
  // BROKEN CONFIG post-approval — a draft marked 'live' whose agent link is EMPTY means the
  // /admin approve half-failed: client "live" on paper with no Gui answering. draft_list('') = all.
  try {
    const drafts = await rpc(env, "draft_list", { p_seller_email: "" });
    for (const d of (Array.isArray(drafts) ? drafts : []).slice(0, 60)) {
      if (!d || d.status !== "live") continue;
      const em = ((d.client_email || "")).toString().trim().toLowerCase();
      if (!em.includes("@")) continue;
      if (((d.agent_id || "")).toString().trim()) continue;
      // confirm against the live link — approve may have linked the agent without stamping the draft
      const ag = await rpc(env, "client_agent_lookup", { p_email: em });
      if (ag) continue;
      await opsAlert(env, out, em, "approved_no_agent", `⚠️ ${em} aprovado no /admin mas sem agent_id — cliente ativo sem Gui`, { draft_id: (d.id || "").toString() });
    }
  } catch { /* drafts check is best-effort — never blocks the sweep */ }
  return out;
}

// ── RPC LIVE PROBES — the bug this defends against: noshow_risk CRASHED for weeks and nobody
// saw it (a dead tab fails silently). Instead of trusting the SQL is fine, we actually CALL each
// critical RPC with a REAL tenant (first of clients_list, like the rest of this file) and watch
// what comes back. Success = HTTP 200 — an EMPTY list is still success. A Postgres exception
// (PostgREST maps it to a 4xx/5xx WITH an error body) = FAILURE → owner alert reusing this file's
// exact mechanism (health_claim 7d dedup + ingest_client_event to the owner). A 404/PGRST202 only
// means the SQL isn't pasted yet — an honest "not ready", NOT a crash — so it's bucketed apart and
// never pages Luis. Read-only RPCs only (*_list / *_status / *_risk): probing has zero side effects.
const SEC_SCHED = "SCHED"; // gated by env.SCHED_SECRET (REDACTED)
const SEC_ING = "INGEST";  // gated by env.INGEST_SECRET (REDACTED)
export const RPC_PROBES = [
  { name: "noshow_risk",          secret: SEC_SCHED, args: (e) => ({ p_email: e, p_days: 2 }) },
  { name: "storm_status",         secret: SEC_ING,   args: (e) => ({ p_email: e }) },
  { name: "mkt_leads_list",       secret: SEC_ING,   args: (e) => ({ p_email: e, p_limit: 1 }) },
  { name: "emergency_list",       secret: SEC_ING,   args: (e) => ({ p_client_email: e }) },
  { name: "package_list",         secret: SEC_ING,   args: (e) => ({ p_client_email: e }) },
  { name: "finance_overdue_list", secret: SEC_ING,   args: (e) => ({ p_email: e, p_limit: 1 }) },
];
const PROBE_TIMEOUT_MS = 6000; // per-probe abort; all probes run together in Promise.all

async function runRpcProbes(env) {
  const out = { ok: [], failed: [], notReady: [], claimReady: true };
  const clients = await rpc(env, "clients_list", {});
  if (!Array.isArray(clients) || !clients.length) { out.skipped = "no tenants"; return out; }
  const email = ((clients[0] && clients[0].client_email) || "").toString().trim().toLowerCase();
  if (!email.includes("@")) { out.skipped = "no tenant email"; return out; }

  const call = async (p) => {
    const secret = p.secret === SEC_SCHED ? (env.SCHED_SECRET || "") : (env.INGEST_SECRET || "");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    try {
      const r = await fetch(`${SB_URL}/rest/v1/rpc/${p.name}`, {
        method: "POST",
        headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_secret: secret, ...p.args(email) }),
        signal: ctrl.signal,
      });
      if (r.ok) return { name: p.name, status: "ok" }; // 200 — empty list counts as healthy
      const body = (await r.text().catch(() => "")) || "";
      let code = ""; try { code = (JSON.parse(body) || {}).code || ""; } catch { /* non-JSON body */ }
      // function simply not deployed → honest "not ready", NOT a silent crash
      if (r.status === 404 || code === "PGRST202") return { name: p.name, status: "notReady" };
      // 42501 = "permission denied for function". O MOTOR NÃO ESTÁ QUEBRADO — a SONDA é que não
      // tem permissão. Aconteceu em 2026-08-10: a onda que revogou o `anon` de centenas de RPCs
      // (segurança correta) tirou o acesso de noshow_risk e package_list, e o monitor passou a
      // pintar "dinheiro" e "agenda" de VERMELHO PERMANENTE. Duas semanas assim e todo mundo
      // aprende a ignorar o semáforo — aí o vermelho de verdade não significa mais nada.
      // Nem verde (seria mentir), nem vermelho (alarme falso): é o CINZA — "não deu para provar".
      // Mesmo terceiro estado do /api/simular. E fica RUIDOSO no motivo, para ser consertado e
      // não virar paisagem: quem lê sabe que existe um motor sem cobertura de teste.
      if (r.status === 401 || r.status === 403 || code === "42501") {
        return { name: p.name, status: "noAccess", httpStatus: r.status,
                 error: "sonda sem permissão — motor NÃO testado (revise o grant ou a chave do monitor)" };
      }
      return { name: p.name, status: "failed", httpStatus: r.status, error: body.slice(0, 200) };
    } catch (e) {
      // abort/timeout or network — treat as failed so a hung RPC also surfaces
      return { name: p.name, status: "failed", httpStatus: 0, error: String(e).slice(0, 200) };
    } finally { clearTimeout(timer); }
  };

  const results = await Promise.all(RPC_PROBES.map(call));
  const OWNER = (env.OWNER_EMAIL && isOwnerEmail(env.OWNER_EMAIL, env)) ? env.OWNER_EMAIL : "smart@guileoai.com";
  for (const res of results) {
    if (res.status === "ok") { out.ok.push(res.name); continue; }
    if (res.status === "notReady") { out.notReady.push(res.name); continue; }
    // FAILURE — same alert mechanism the file already uses: atomic 7-day claim per (owner, kind)
    // then ingest an ops_alert into the owner's feed. claimed===null → db/health_claims.sql not pasted.
    const kind = `rpc_probe_${res.name}`;
    const claimed = await rpc(env, "health_claim", { p_email: OWNER, p_kind: kind });
    let alerted = false;
    if (claimed === true) {
      // like opsAlert above: record whether the ingest actually landed — the 7-day claim is
      // already burned, so a silently-lost alert must at least be visible in the response.
      const ir = await rpc(env, "ingest_client_event", {
        p_email: OWNER, p_type: "ops_alert", p_channel: "system",
        p_summary: `🚨 RPC ${res.name} FALHOU na sonda viva (HTTP ${res.httpStatus}) — aba pode estar morta há dias: ${res.error}`.slice(0, 300),
        p_amount: 0, p_payload: { kind, rpc: res.name, httpStatus: res.httpStatus, error: res.error, tenant: email },
      });
      alerted = ir !== null;
    } else if (claimed === null) out.claimReady = false;
    out.failed.push({ name: res.name, httpStatus: res.httpStatus, error: res.error, alerted });
  }
  return out;
}

// ── SALDO DOS PROVEDORES ──────────────────────────────────────────────────────
// POR QUE EXISTE: sem saldo na Twilio o telefone do cliente simplesmente PARA de
// atender — e hoje só se descobre quando o cliente reclama. É a mesma família de
// falha silenciosa do resto da plataforma: nada quebra, nada loga, o produto só
// emagrece. Aqui o dono é avisado ANTES de acabar, com dias de antecedência.
// Honesto-inerte: sem a chave, marca "notReady" e não inventa número.
async function runBalanceChecks(env) {
  const out = { ok: [], low: [], notReady: [] };
  const OWNER = (env.OWNER_EMAIL && isOwnerEmail(env.OWNER_EMAIL, env)) ? env.OWNER_EMAIL : "smart@guileoai.com";
  // Piso configurável: abaixo disso o dono é avisado. $20 dá ~2 dias de folga numa
  // operação pequena — tempo de recarregar sem ninguém perder ligação.
  const FLOOR = Number(env.TWILIO_BALANCE_FLOOR_USD) || 20;

  const alert = async (kind, summary, payload) => {
    const claimed = await rpc(env, "health_claim", { p_email: OWNER, p_kind: kind });
    if (claimed !== true) return false;                       // já avisou nos últimos 7 dias
    const ir = await rpc(env, "ingest_client_event", {
      p_email: OWNER, p_type: "ops_alert", p_channel: "system",
      p_summary: summary.slice(0, 300), p_amount: 0, p_payload: payload,
    });
    return ir !== null;
  };

  // Twilio: saldo em dólares da conta.
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
    try {
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Balance.json`, {
        headers: { Authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}` },
        signal: AbortSignal.timeout(6000),
      });
      const d = await r.json().catch(() => ({}));
      const bal = Number(d?.balance);
      if (!r.ok || !Number.isFinite(bal)) out.notReady.push({ provider: "twilio", why: `HTTP ${r.status}` });
      else if (bal < FLOOR) {
        const alerted = await alert("balance_twilio_low",
          `🔴 SALDO TWILIO BAIXO: $${bal.toFixed(2)} (piso $${FLOOR}). Sem saldo o telefone dos clientes PARA de atender — recarregue em console.twilio.com → Billing.`,
          { provider: "twilio", balance: bal, floor: FLOOR });
        out.low.push({ provider: "twilio", balance: bal, alerted });
      } else out.ok.push({ provider: "twilio", balance: bal });
    } catch (e) { out.notReady.push({ provider: "twilio", why: String(e).slice(0, 80) }); }
  } else out.notReady.push({ provider: "twilio", why: "sem credencial" });

  // ElevenLabs: cota de caracteres da assinatura (a voz para quando estoura).
  if (env.ELEVENLABS_API_KEY) {
    try {
      const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", {
        headers: { "xi-api-key": env.ELEVENLABS_API_KEY }, signal: AbortSignal.timeout(6000),
      });
      const d = await r.json().catch(() => ({}));
      const used = Number(d?.character_count), limit = Number(d?.character_limit);
      if (!r.ok || !Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) {
        out.notReady.push({ provider: "elevenlabs", why: `HTTP ${r.status}` });
      } else {
        const pct = Math.round((used / limit) * 100);
        if (pct >= 85) {
          const alerted = await alert("balance_elevenlabs_low",
            `🔴 COTA DE VOZ EM ${pct}% (${used.toLocaleString()}/${limit.toLocaleString()} caracteres). Ao estourar, a Gui para de falar nas ligações.`,
            { provider: "elevenlabs", used, limit, pct });
          out.low.push({ provider: "elevenlabs", pct, alerted });
        } else out.ok.push({ provider: "elevenlabs", pct });
      }
    } catch (e) { out.notReady.push({ provider: "elevenlabs", why: String(e).slice(0, 80) }); }
  } else out.notReady.push({ provider: "elevenlabs", why: "sem credencial" });

  return out;
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    const tok = new URL(request.url).searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
    if (!env.DIGEST_TOKEN || !safeEq(tok, env.DIGEST_TOKEN)) return json({ error: "unauthorized" }, 401);

    // silent-client sweep first — isolated so it can never block the churn-drop email below
    let sweep = { ready: false, claimReady: false, configClaimReady: false, days: 5, silent: [], config: [] };
    try { sweep = await silentSweep(env); } catch { /* isolated */ }
    // RPC live probes — isolated too: a probe failure alerts, but must never break the sweep/email.
    let probes = { ok: [], failed: [], notReady: [], claimReady: true };
    try { probes = await runRpcProbes(env); } catch (e) { probes = { ok: [], failed: [], notReady: [], claimReady: true, error: String(e).slice(0, 120) }; }
    const rpcProbes = { ok: probes.ok, failed: probes.failed, notReady: probes.notReady, claimReady: probes.claimReady, ...(probes.skipped ? { skipped: probes.skipped } : {}), ...(probes.error ? { error: probes.error } : {}) };
    // Saldo dos provedores — isolado como os outros: uma API fora do ar não pode
    // derrubar o monitor inteiro (senão o monitor vira a próxima falha silenciosa).
    let balances = { ok: [], low: [], notReady: [] };
    try { balances = await runBalanceChecks(env); } catch (e) { balances = { ok: [], low: [], notReady: [{ provider: "all", why: String(e).slice(0, 80) }] }; }
    const silentOut = { silent: sweep.silent, silentReady: sweep.ready, silentClaimReady: sweep.claimReady, silentDays: sweep.days, config: sweep.config, configClaimReady: sweep.configClaimReady, rpcProbes, balances };

    const hr = await fetch(`${SB_URL}/rest/v1/rpc/client_health`, {
      method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.INGEST_SECRET || "" }),
    });
    const rows = hr.ok ? await hr.json() : [];
    // at risk: had real activity last week AND dropped 40%+ (or went silent this week)
    const atRisk = (Array.isArray(rows) ? rows : []).filter((r) => Number(r.last_week) >= 3 && Number(r.drop_pct) >= 40);

    if (atRisk.length === 0) return json({ ok: true, atRisk: 0, ...silentOut });
    if (!env.RESEND_API_KEY) return json({ ok: false, reason: "no mailer", atRisk: atRisk.length, ...silentOut });

    const OWNER = (env.OWNER_EMAIL && isOwnerEmail(env.OWNER_EMAIL, env)) ? env.OWNER_EMAIL : "smart@guileoai.com";
    const FROM = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
    const list = atRisk.sort((a, b) => b.drop_pct - a.drop_pct).map((r) =>
      `<tr><td style="padding:6px 12px 6px 0;font-weight:700">${r.client_email}</td><td style="padding:6px 0;color:#c0392b;font-weight:700">−${r.drop_pct}%</td><td style="padding:6px 0 6px 12px;color:#888">${r.this_week} esta semana · ${r.last_week} antes</td></tr>`).join("");

    await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [OWNER], subject: `🩺 ${atRisk.length} cliente(s) em risco de churn — aja agora`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:560px"><h2 style="color:#3E9468;margin:0 0 4px">Monitor de saúde · risco de cancelamento</h2><p style="color:#888;margin:0 0 14px">A atividade destes clientes caiu forte. Falar com eles AGORA é 3x mais eficaz que esperar. Liga, manda um "como posso ajudar?", mostra o resultado.</p><table style="font-size:14px;width:100%">${list}</table></div>` }),
    });
    return json({ ok: true, atRisk: atRisk.length, ...silentOut });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 120) }, 500);
  }
}
