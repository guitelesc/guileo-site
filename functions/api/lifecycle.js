// Cloudflare Pages Function — GET/POST /api/lifecycle?token=DIGEST_TOKEN
// The AUTOMATIC nurture drip machine — turns the manual /admin nurture buttons into a
// hands-off lifecycle: hit by the existing cron Worker every few hours (same token gate
// as /api/automations and /api/daily-digest).
//
// What one run does:
//   1. Pulls the last 14 days of leads from the gui_actions store (via the token-gated
//      admin_actions RPC — the base table is RLS-locked against anonymous SELECT).
//   2. Keeps only leads with an EMAIL contact that have NOT converted (lead_converted RPC
//      checks client_credits — every paid signup has a row there).
//   3. Sends the drip on lead age: T+1d → 'proof' · T+3d → 'proposal' · T+7d → 'reengage'.
//      ('welcome' is already sent at capture time by /api/lead → leadReceivedEmail.)
//
// IDEMPOTENT by design: drip_claim (db/lifecycle.sql) is an atomic INSERT ON CONFLICT
// marker claimed BEFORE each send — the same step can never reach the same email twice,
// even across racing runs (politeness over repeat, same philosophy as receivables).
// At most ONE step per email per run, so a backlog lead progresses run-by-run instead of
// getting three emails in one blast. Hard cap: MAX_SENDS emails per run.
// Graceful: until Luis pastes db/lifecycle.sql the run reports { ready:false } and sends nothing.
import { json, safeEq } from "../lib/guard.js";
import { sendNurtureStep } from "./nurture.js";
import { avisarDono } from "../lib/avisarDono.js";

// O motivo que o dono consegue CONSERTAR, escrito uma vez só (backup.js usa a mesma frase).
const MOTIVO_ADMIN_TOKEN = "ADMIN_TOKEN ausente ou diferente da senha do /admin (Cloudflare → Variables)";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const MAX_SENDS = 40; // hard cap per run — a bad backlog can never blast hundreds of emails
const DAY = 24 * 3600 * 1000;
// Ordered drip ladder. A lead only advances one rung per run (earliest unsent due step first).
const DRIP = [
  { step: "proof", after: 1 * DAY },
  { step: "proposal", after: 3 * DAY },
  { step: "reengage", after: 7 * DAY },
];

const rpc = (env, fn, args) => fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
  method: "POST",
  headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", ...args }),
});

// contact fields hold "email OR phone OR whatsapp" — only drip real email addresses
const emailOf = (contact) => {
  const c = (contact || "").toString().trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) ? c : "";
};

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "method" }, 405);
  // Same gate as /api/automations / /api/daily-digest: the cron Worker's DIGEST_TOKEN,
  // via ?token= or the x-guileo-secret header. Fails CLOSED when the token isn't set.
  const tok = new URL(request.url).searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
  if (!env.DIGEST_TOKEN || !safeEq(tok, env.DIGEST_TOKEN)) return json({ error: "unauthorized" }, 401);

  const out = { scanned: 0, sent: 0, skipped: 0, claimed_dupe: 0, send_failed: 0, unsubscribed: 0 };
  try {
    // READY PROBE — one throwaway claim proves the db/lifecycle.sql RPCs exist. The probe row
    // ("_probe@lifecycle.internal") is claimed once, forever a dupe after — never emailed.
    const probe = await rpc(env, "drip_claim", { p_email: "_probe@lifecycle.internal", p_step: "probe" });
    if (!probe.ok) return json({ ok: true, ready: false, note: "drip RPCs not installed — paste db/lifecycle.sql in Supabase, then this endpoint starts dripping.", ...out });

    // Pull recent leads via the token-gated admin RPC (same read path as daily-digest).
    const since = Date.now() - 14 * DAY;
    let rows = [];
    const r = await fetch(`${SB_URL}/rest/v1/rpc/admin_actions`, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: env.ADMIN_TOKEN || "" }),
    });
    if (r.ok) {
      const all = await r.json();
      rows = (Array.isArray(all) ? all : []).filter((x) => x.action === "lead" && new Date(x.created_at).getTime() >= since);
    } else {
      // ── 12 DIAS DE NUTRIÇÃO PARADA COM O CRON VERDE (auditoria de lançamento, 2026-09-22) ──────
      // Esta linha respondia `ok:false` com HTTP 200. O cron-tick lia só o status, então listou o
      // lifecycle como saudável por 12 dias enquanto NENHUM lead recebia o passo seguinte — o
      // motivo era o ADMIN_TOKEN do Cloudflare diferente da senha do /admin (o banco recusa com
      // 403, errcode 28000). E "lead store unreachable" não dizia a ninguém o que consertar.
      // Agora: 502 (falha é falha também no status), o motivo que o dono consegue resolver, e o
      // aviso sai pelo avisarDono — que tem trava de 6h, então os 96 tiques do dia viram no
      // máximo 4 avisos. (emitFailure direto gravaria uma linha no feed POR TIQUE: o tipo não é
      // dos "urgentes", então ele não passaria pela trava.)
      const recusou = r.status === 401 || r.status === 403 || !env.ADMIN_TOKEN;
      const motivo = recusou ? MOTIVO_ADMIN_TOKEN : `admin_actions http ${r.status} — o banco não devolveu os leads`;
      const aviso = await avisarDono(env, {
        kind: "lifecycle_parado",
        summary: `a nutrição automática de leads está PARADA — ${motivo}`,
        detail: `admin_actions respondeu HTTP ${r.status}. Enquanto isto não for consertado, nenhum lead recebe prova/proposta/reengajamento.`,
        cliente: "Guileo (lifecycle)", link: "https://guileoai.com/admin", payload: { http: r.status, admin_token_presente: !!env.ADMIN_TOKEN },
      });
      return json({ ok: false, ready: true, error: "lead store unreachable (admin_actions)", motivo, http: r.status, aviso, ...out }, 503);
    }

    // One record per email: the FIRST lead time anchors the schedule; keep the best name/business.
    // lang: /api/lead encodes the form's language into `details` as "🌐lang:pt|es|hi" (gui_actions
    // has no lang column). Parse it back so each drip email goes out in the LEAD's language.
    // Leads captured BEFORE that tag was deployed carry no tag → lang stays "" → EN default.
    const langOf = (x) => { const m = /🌐lang:(pt|es|hi)/.exec((x && x.details) || ""); return m ? m[1] : ""; };
    const leads = new Map();
    for (const x of rows) {
      const email = emailOf(x.contact);
      if (!email) continue;
      const at = new Date(x.created_at).getTime() || Date.now();
      const cur = leads.get(email);
      if (!cur) leads.set(email, { email, at, name: x.name || "", business: x.business || "", lang: langOf(x) });
      else {
        cur.at = Math.min(cur.at, at);
        if (!cur.name && x.name) cur.name = x.name;
        if (!cur.business && x.business) cur.business = x.business;
        if (!cur.lang) cur.lang = langOf(x);
      }
    }
    out.scanned = leads.size;

    // Oldest leads first — they're closest to going cold.
    const ordered = [...leads.values()].sort((a, b) => a.at - b.at);
    for (const lead of ordered) {
      if (out.sent >= MAX_SENDS) break;
      const age = Date.now() - lead.at;
      const due = DRIP.filter((d) => age >= d.after);
      if (due.length === 0) continue;

      // Converted? Then the drip is over — no sales emails to paying clients.
      // (Unreachable check → treat as not converted; a nurture email to a client is
      // annoying but harmless, silently freezing the whole drip would be worse.)
      try {
        const cv = await rpc(env, "lead_converted", { p_email: lead.email });
        if (cv.ok && (await cv.json()) === true) { out.skipped++; continue; }
      } catch { /* keep dripping */ }

      // Earliest unsent due step, ONE per run. Claim BEFORE send: a claimed-but-failed send
      // burns the step rather than ever risking a duplicate email (politeness over repeat).
      for (const d of due) {
        let claimed = false;
        try {
          const c = await rpc(env, "drip_claim", { p_email: lead.email, p_step: d.step });
          if (!c.ok) break; // RPC hiccup mid-run → stop claiming for this lead, next run retries
          claimed = (await c.json()) === true;
        } catch { break; }
        if (!claimed) { out.claimed_dupe++; continue; } // already sent (this run or a past one)
        // lang parsed from the 🌐lang details tag (pt/es render fully; hi/"" → EN in sendNurtureStep).
        const sr = await sendNurtureStep(env, { to: lead.email, name: lead.name, business: lead.business, lang: lead.lang, step: d.step });
        // "descadastrado" NAO e "falha de envio" — misturar os dois faz o painel acusar o mailer
        // por um opt-out respeitado. O degrau ja foi reivindicado, entao o lead nunca reentra.
        if (sr.ok) out.sent++; else if (sr.suppressed) out.unsubscribed++; else out.send_failed++;
        break; // one step per email per run — the next rung goes out on a later run
      }
    }

    return json({ ok: true, ready: true, ...out });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200), ...out }, 500);
  }
}
