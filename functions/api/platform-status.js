// Cloudflare Pages Function — GET/POST /api/platform-status?token=DIGEST_TOKEN
// ─────────────────────────────────────────────────────────────────────────────
// FUNDAÇÃO 4 — OBSERVABILIDADE/SLO CONSOLIDADO. The bug this defends against is
// FRAGMENTATION: today "is the platform healthy?" is answered by curl'ing FOUR different
// endpoints (canary for the funnel, health-monitor for the RPCs, admin feeds for failures)
// and eyeballing four JSON shapes. When health lives in four places nobody looks at all four,
// so a dead area (a crashed RPC, a 404'd pay-link) hides in plain sight. This endpoint is the
// ONE place that answers the question: it AGGREGATES the existing probes into a single JSON with
// a simple red/yellow/green SLO per business area (voz · dinheiro · agenda · agentes).
//
// FRONTIER-LAB PRINCIPLE — UMA fonte da verdade. This file does NOT re-implement any probe:
//   • the funnel uptime is REUSED by self-fetching /api/canary (built to be read-only + deduped);
//   • the RPC health REUSES health-monitor.js's RPC_PROBES array as the single source of the probe
//     list (imported, never re-declared — see the 1-line export patch below);
//   • recent failures REUSE admin_all_events (the same feed /api/backup snapshots).
// It only ADDS the aggregation + the SLO roll-up, which is genuinely new and lives nowhere else.
//
// SAFETY / DEGRADAÇÃO HONESTA: every section is best-effort and isolated — a dependency that is
// down, unconfigured (no ADMIN_TOKEN), or not-yet-pasted (SQL missing → PGRST202) degrades that
// area to "unknown"/"yellow" and is labelled as such; it never throws and never turns a
// not-configured gap into a false "red". No PII leaves the box: only counts + area colours.
//
// DIGEST-gated — same token cron-tick/health-monitor/canary/backup use. Read-only aggregation:
// it ingests nothing, alerts nobody, sends no email (the sources it reuses own their own alerts).
//
// ── 1-LINE PATCH FOR THE ORCHESTRATOR (files I don't own) ────────────────────────
//   functions/api/health-monitor.js line 120:
//       - const RPC_PROBES = [
//       + export const RPC_PROBES = [
//   That single `export` turns the probe list into a reusable single-source-of-truth. Until it
//   lands, this file degrades the "rpc" section to notReady (import yields undefined, guarded) —
//   it never breaks. (Optional: add a cron target in cron-tick.js if you want it swept, but it's
//   designed to be pulled on-demand by /admin, not pushed.)
import { json, safeEq } from "../lib/guard.js";
import { sbKey } from "../lib/sb.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
// (a chave anon foi REMOVIDA daqui de propósito: sbKey() já a tem como fallback. Deixar a
//  constante solta neste arquivo é o convite para o próximo `apikey: SB_ANON` nascer.)

// ── O RELÓGIO DE QUEM CHAMA TEM QUE SER MAIOR QUE O DE QUEM É CHAMADO (2026-08-12) ─────────────
// Estava 9s. Horas antes eu aumentei, DENTRO do canary, o orçamento das sondas de IA de 8s para
// 20s — porque uma resposta de modelo leva ~6s e 8s era um sorteio. Consertei o relógio da sonda
// e ESQUECI o relógio de quem a chama: o canary passou a poder demorar 20s, e este arquivo
// continuava desistindo aos 9. Resultado: `widget_chat=failed` no semáforo enquanto o widget
// respondia 200 em 5,5s, verificado na mão.
//
// É o mesmo defeito que persegui o dia inteiro — o observador com o relógio errado — só que uma
// camada acima, e desta vez eu é que o criei. A regra que fica: mudou o teto de tempo de alguma
// coisa, procure QUEM ESPERA por ela. Um timeout nunca é uma decisão local.
// 26s = os 20s da pior sonda de IA + margem para o salto de rede e as outras três em paralelo.
const PROBE_TIMEOUT_MS = 26000;
const RPC_TIMEOUT_MS = 6000;
const FAIL_LOOKBACK_DAYS = 7;
const FAIL_RED_THRESHOLD = 5; // ≥ this many real failures in an area's channels in 7d ⇒ red

// The four business areas the SLO rolls up to (mirrors MOTORES.md's living map).
const AREAS = ["voz", "dinheiro", "agenda", "agentes"];

// ── area attribution — the ONE map from a probe/channel to a business area ──────────
// Canary probe → area. gui/widget chat = the agents; pay = money; call-gate = voice.
const CANARY_AREA = { gui_chat: "agentes", widget_chat: "agentes", pay_links: "dinheiro", call_gate: "voz" };
// RPC probe name → area (names come from the reused RPC_PROBES array, not re-declared here).
const RPC_AREA = {
  noshow_risk: "agenda", storm_status: "voz", mkt_leads_list: "agentes",
  emergency_list: "voz", package_list: "dinheiro", finance_overdue_list: "dinheiro",
};
// A failure/ops_alert event's channel → area, by keyword; anything agent-ish or unknown → agentes.
function channelToArea(channel, summary) {
  const s = `${channel || ""} ${summary || ""}`.toLowerCase();
  if (/\b(voz|voice|call|phone|ligac|dial|twilio)\b/.test(s)) return "voz";
  if (/\b(pay|money|stripe|charge|invoice|billing|cobran|fatura|financ|deposit|refund)\b/.test(s)) return "dinheiro";
  if (/\b(sched|agenda|book|reserv|calendar|slot|no.?show)\b/.test(s)) return "agenda";
  return "agentes";
}

// timed fetch with a per-call abort so one hung dependency can't stall the consolidation.
async function timedFetch(url, opts = {}, ms = RPC_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
}

// INGEST-gated RPC helper (same shape as canary/health-monitor). Returns {ok,status,body}.
//
// ── POR QUE service_role E NÃO anon (2026-08-11) ────────────────────────────────────
// A sonda tem que percorrer o MESMO caminho que a produção percorre. Quem chama estas RPCs de
// verdade — packages.js, noshow-radar.js — é servidor nosso e usa `sbKey(env)`. Este arquivo era
// o último que ainda batia com a chave `anon`, então media um caminho que ninguém usa.
// O estrago: a onda de revogação tirou o `anon` de noshow_risk e package_list (segurança correta,
// produção intacta) e o semáforo pintou "agenda" e "dinheiro" de amarelo — a sonda sem permissão
// virando diagnóstico de motor doente. Confirmado no banco vivo: essas duas são exatamente as
// únicas com anon=false, service_role=true; as quatro verdes ainda têm anon=true. O semáforo
// estava desenhando o progresso da revogação, não a saúde da plataforma.
// O health-monitor.js já tinha sido corrigido; este ficou para trás porque tem a própria CÓPIA do
// helper — que é precisamente o que o comentário lá em cima deste arquivo avisou que aconteceria.
// Nota: com service_role a sonda deixa de detectar "o anon foi reaberto sem querer". Isso é
// certo — reabrir permissão é pergunta de SEGURANÇA (auditoria has_function_privilege), não de
// SAÚDE. Misturar as duas foi o que produziu o alarme falso.
async function rpcRaw(env, fn, args, secret) {
  const k = sbKey(env);
  try {
    const r = await timedFetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: k, Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: secret ?? (env.INGEST_SECRET || ""), ...args }),
    });
    const body = await r.text().catch(() => "");
    return { ok: r.ok, status: r.status, body };
  } catch (e) { return { ok: false, status: 0, body: String(e).slice(0, 160) }; }
}
async function rpcJson(env, fn, args, secret) {
  const r = await rpcRaw(env, fn, args, secret);
  if (!r.ok) return null;
  try { return JSON.parse(r.body); } catch { return null; }
}

// ── (A) FUNNEL UPTIME — REUSE /api/canary verbatim (no re-implementation) ───────────
// canary is DIGEST-gated, read-only and self-deduped; we just call it and read its `probes`.
// If it's unreachable/times out, the section is "unknown" (never a false red).
async function funnelUptime(env, origin) {
  try {
    const r = await timedFetch(`${origin}/api/canary?token=${encodeURIComponent(env.DIGEST_TOKEN || "")}`,
      { method: "POST", headers: { Origin: origin } }, PROBE_TIMEOUT_MS);
    if (!r.ok) return { source: "canary", ok: false, reachable: false, detail: `canary HTTP ${r.status}`, probes: {} };
    const d = await r.json().catch(() => ({}));
    const probes = d && d.probes ? d.probes : {};
    // normalise each probe to a status the SLO understands
    const norm = {};
    for (const [name, p] of Object.entries(probes)) norm[name] = (p && p.status) || "unknown";
    return { source: "canary", ok: !!d.ok, reachable: true, alertReady: d.alertReady, probes: norm, failed: d.failed || [] };
  } catch (e) { return { source: "canary", ok: false, reachable: false, detail: String(e).slice(0, 140), probes: {} }; }
}

// ── (B) RPC HEALTH — REUSE health-monitor.js's RPC_PROBES as the single source ──────
// Dynamic import so a not-yet-patched health-monitor (RPC_PROBES not exported) degrades to
// notReady instead of a link-time crash. We run the SAME definitions read-only, WITHOUT the
// alerting/dedup (that belongs to health-monitor — we only observe). 200 = ok (empty list still
// ok); 404/PGRST202 = SQL not pasted → notReady; anything else = failed.
async function rpcHealth(env) {
  let RPC_PROBES = [];
  try {
    const mod = await import("./health-monitor.js");
    if (Array.isArray(mod.RPC_PROBES)) RPC_PROBES = mod.RPC_PROBES;
  } catch { /* import failure → empty, section reports notReady below */ }
  if (!RPC_PROBES.length) return { source: "health-monitor.RPC_PROBES", reusable: false, note: "RPC_PROBES not exported yet (apply the 1-line patch)", results: [] };

  const clients = await rpcJson(env, "clients_list", {});
  if (!Array.isArray(clients) || !clients.length) return { source: "health-monitor.RPC_PROBES", reusable: true, results: [], note: "no tenants" };
  const email = ((clients[0] && clients[0].client_email) || "").toString().trim().toLowerCase();
  if (!email.includes("@")) return { source: "health-monitor.RPC_PROBES", reusable: true, results: [], note: "no tenant email" };

  const secretFor = (p) => (p.secret === "SCHED" ? (env.SCHED_SECRET || "") : (env.INGEST_SECRET || ""));
  const results = await Promise.all(RPC_PROBES.map(async (p) => {
    const r = await rpcRaw(env, p.name, p.args(email), secretFor(p));
    if (r.ok) return { name: p.name, status: "ok" };
    let code = ""; try { code = (JSON.parse(r.body) || {}).code || ""; } catch { /* non-JSON */ }
    if (r.status === 404 || code === "PGRST202") return { name: p.name, status: "notReady" };
    // 42501 = a SONDA não tem permissão; o motor não foi testado. Ver o comentário longo em
    // health-monitor.js. Este arquivo tem a própria cópia do mapeamento — consertar só um lado
    // deixaria o semáforo vermelho mesmo com o monitor já correto.
    if (r.status === 401 || r.status === 403 || code === "42501") return { name: p.name, status: "noAccess", httpStatus: r.status };
    return { name: p.name, status: "failed", httpStatus: r.status };
  }));
  return { source: "health-monitor.RPC_PROBES", reusable: true, results };
}

// ── (C) RECENT FAILURES — REUSE admin_all_events (the feed /api/backup snapshots) ───
// Count type∈{failure,ops_alert} in the last 7d, bucketed by channel (the category proxy) and
// attributed to a business area. Needs ADMIN_TOKEN; without it the section is honestly notReady.
async function recentFailures(env) {
  if (!env.ADMIN_TOKEN) return { source: "admin_all_events", ready: false, note: "no ADMIN_TOKEN", days: FAIL_LOOKBACK_DAYS, total: 0, byChannel: {}, byArea: {} };
  try {
    const r = await timedFetch(`${SB_URL}/rest/v1/rpc/admin_all_events`, {
      method: "POST",
      headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: env.ADMIN_TOKEN }),
    });
    if (!r.ok) return { source: "admin_all_events", ready: false, note: `HTTP ${r.status}`, days: FAIL_LOOKBACK_DAYS, total: 0, byChannel: {}, byArea: {} };
    const rows = await r.json().catch(() => []);
    const since = Date.now() - FAIL_LOOKBACK_DAYS * 864e5;
    const byChannel = {}, byArea = {};
    let total = 0;
    for (const e of (Array.isArray(rows) ? rows : [])) {
      const type = (e.type || "").toString();
      if (type !== "failure" && type !== "ops_alert") continue;
      const t = new Date(e.created_at).getTime();
      if (!(t >= since)) continue;
      total++;
      const ch = (e.channel || "unknown").toString();
      byChannel[ch] = (byChannel[ch] || 0) + 1;
      const area = channelToArea(e.channel, e.summary);
      byArea[area] = (byArea[area] || 0) + 1;
    }
    return { source: "admin_all_events", ready: true, days: FAIL_LOOKBACK_DAYS, total, byChannel, byArea };
  } catch (e) { return { source: "admin_all_events", ready: false, note: String(e).slice(0, 120), days: FAIL_LOOKBACK_DAYS, total: 0, byChannel: {}, byArea: {} }; }
}

// ── (D) QUALIDADE DOS AGENTES — o harness de evals, LIGADO (2026-08-11) ────────────
// Este bloco era um "placeholder" que sondava `agent_evals_latest` — nome que NUNCA existiu no
// banco. As funções reais sempre se chamaram `agent_evals_summary` / `agent_evals_recent`, vivas
// desde 2026-07-20. Resultado: o semáforo anunciou "harness de evals ainda não implantado"
// durante três semanas de harness implantado, e escondeu o que já havia para ver — a rodada de
// voz de hoje tirou 74 e reprovou 1 de 2 casos.
// É a TERCEIRA vez no mesmo dia que o observador descreve a si mesmo em vez do sistema (sonda com
// chave anon; sonda com relógio curto; agora sonda com nome inventado). O padrão: uma sonda que
// nunca teve sucesso não parece quebrada — parece um recurso que ainda não chegou.
//
// AS CORES, e por que são estas:
//   • segurança < 100 ou adversarial_failed > 0 → VERMELHO. Segurança não tem meio-termo: um
//     agente que falha um caso de segurança está falando com cliente agora.
//   • failed > 0 → AMARELO. Qualidade caiu; ninguém corre risco. É informação, não emergência.
//   • medição velha (> EVAL_VELHO_DIAS) → AMARELO "não medido recentemente" — mesma lógica do
//     noAccess: sem prova recente, verde seria afirmar o que ninguém verificou.
// O limite é generoso DE PROPÓSITO: o harness ainda é disparado à mão, então um número apertado
// deixaria esta área amarela para sempre — e amarelo permanente é o mesmo alarme falso que passei
// o dia consertando. O conserto de raiz é pôr o eval no cron; até lá, o painel diz a idade.
const EVAL_VELHO_DIAS = 30;

async function agentQuality(env) {
  const r = await rpcRaw(env, "agent_evals_summary", {}, env.INGEST_SECRET || "");
  if (!r.ok) {
    let code = ""; try { code = (JSON.parse(r.body) || {}).code || ""; } catch { /* não-JSON */ }
    if (r.status === 404 || code === "PGRST202") return { source: "agent_evals_summary", ready: false, note: "harness de evals não instalado (db/agent_evals.sql)" };
    return { source: "agent_evals_summary", ready: false, note: `HTTP ${r.status}` };
  }
  let linhas = null; try { linhas = JSON.parse(r.body); } catch { /* não-JSON */ }
  if (!Array.isArray(linhas) || !linhas.length) return { source: "agent_evals_summary", ready: false, note: "harness instalado, nenhuma rodada registrada" };

  const agora = Date.now();
  const agentes = linhas.map((l) => {
    const seg = Number(l.avg_safety);
    const reprov = Number(l.failed) || 0;
    const advReprov = Number(l.adversarial_failed) || 0;
    const quando = Date.parse(l.run_at || "");
    // Number(null) é 0, não NaN — um avg_safety ausente viraria "0 de segurança" e pintaria
    // vermelho por dado FALTANDO. Só julgo a segurança quando ela realmente veio um número.
    const segConhecida = Number.isFinite(seg);
    const dias = Number.isFinite(quando) ? Math.floor((agora - quando) / 864e5) : null;
    let cor = "green";
    if ((segConhecida && seg < 100) || advReprov > 0) cor = "red";
    else if (reprov > 0) cor = "yellow";
    else if (dias === null || dias > EVAL_VELHO_DIAS) cor = "yellow";
    return {
      agent: (l.agent || "?").toString(), cor, cases: Number(l.cases) || 0,
      score: Number(l.avg_score), safety: segConhecida ? seg : null,
      passed: Number(l.passed) || 0, failed: reprov, adversarial_failed: advReprov, dias,
    };
  });
  return { source: "agent_evals_summary", ready: true, agentes };
}

// ── SLO ROLL-UP — the ONE new thing: fold every signal into red/yellow/green per area ──
// Rank: green(0) < yellow(1) < red(2). A "notReady" (unconfigured / SQL-not-pasted) is yellow,
// never red — degradação honesta, not a false alarm. Recent failures bump an area to yellow, or
// to red past FAIL_RED_THRESHOLD. An area with zero signals is "unknown" (grey), not green.
const RANK = { green: 0, yellow: 1, red: 2 };
const COLOR = ["green", "yellow", "red"];
function statusToColor(s) {
  if (s === "ok") return "green";
  if (s === "failed") return "red";
  // noAccess = "não deu para provar". Amarelo de propósito: verde seria mentira (ninguém testou)
  // e vermelho seria alarme falso (o motor pode estar ótimo). É o mesmo cinza do /api/simular.
  if (s === "noAccess") return "yellow";
  // "slow" = a sonda de IA respondeu, só passou do limite de conforto (canary.js, LENTO_IA_MS).
  // Amarelo é a resposta certa e a razão importa: verde apagaria a degradação que está começando,
  // vermelho dispararia alerta por algo que ainda ATENDE o cliente. O mapa abaixo já jogaria
  // qualquer status novo em amarelo pelo `return` final — está escrito aqui porque acerto por
  // acidente não sobrevive à próxima edição de quem não souber que era de propósito.
  if (s === "slow") return "yellow";
  if (s === "notReady" || s === "unknown" || s === "degraded") return "yellow";
  return "yellow";
}
function computeSlo(funnel, rpc, failures, agents) {
  // seed every area with no signal
  const acc = {}; for (const a of AREAS) acc[a] = { color: null, signals: [] };
  const bump = (area, color, label) => {
    if (!acc[area]) return; // ignore anything off-map
    acc[area].signals.push({ label, color });
    const cur = acc[area].color;
    if (cur === null || RANK[color] > RANK[cur]) acc[area].color = color;
  };
  // canary probes
  for (const [name, st] of Object.entries(funnel.probes || {})) {
    const area = CANARY_AREA[name]; if (area) bump(area, statusToColor(st), `canary:${name}=${st}`);
  }
  if (funnel.reachable === false) for (const a of AREAS) bump(a, "yellow", "canary:unreachable");
  // rpc probes
  for (const res of (rpc.results || [])) {
    const area = RPC_AREA[res.name]; if (area) bump(area, statusToColor(res.status), `rpc:${res.name}=${res.status}`);
  }
  // recent failures per area
  if (failures.ready) {
    for (const [area, n] of Object.entries(failures.byArea || {})) {
      if (!n) continue;
      bump(area, n >= FAIL_RED_THRESHOLD ? "red" : "yellow", `failures7d:${n}`);
    }
  }
  // agent quality → agentes
  // Cada agente medido entra como SEU PRÓPRIO sinal. Um único "agent_evals=ok" achataria três
  // agentes numa palavra e esconderia exatamente o que o eval existe para mostrar — hoje a voz
  // reprovou 1 de 2 casos enquanto suporte e review passaram limpo. Achatar seria repetir, no
  // painel, o mesmo erro que o horário "das 9 às 2" cometeu no site do cliente.
  if (agents.ready && Array.isArray(agents.agentes)) {
    for (const a of agents.agentes) {
      const idade = a.dias === null ? "sem data" : `${a.dias}d`;
      bump("agentes", a.cor, `eval:${a.agent}=${a.failed ? `${a.failed}/${a.cases} reprovado` : "passou"} score ${a.score} seg ${a.safety === null ? "?" : a.safety} (${idade})`);
    }
  } else {
    bump("agentes", "yellow", `agent_evals:${agents.note || "sem medição"}`);
  }

  const areas = {};
  let worst = 0, anyKnown = false;
  for (const a of AREAS) {
    const color = acc[a].color || "unknown";
    areas[a] = { color, signals: acc[a].signals };
    if (color !== "unknown") { anyKnown = true; worst = Math.max(worst, RANK[color] ?? 0); }
  }
  const overall = anyKnown ? COLOR[worst] : "unknown";
  return { overall, areas };
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    if (request.method !== "GET" && request.method !== "POST") return json({ error: "method" }, 405);
    // Token may arrive in the POST body (the /admin QualityPanel), the query (?token=, cron), or header.
    const reqBody = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    const tok = (reqBody.token || new URL(request.url).searchParams.get("token") || request.headers.get("x-guileo-secret") || "").toString();
    // Accept EITHER the DIGEST_TOKEN (cron/automation) OR a valid admin password (the /admin panel —
    // validated exactly like admin-blitz.js/unit-economics: blitz_stats raises on a wrong token → !ok).
    let authed = !!env.DIGEST_TOKEN && safeEq(tok, env.DIGEST_TOKEN);
    if (!authed && tok) {
      const av = await fetch(`${SB_URL}/rest/v1/rpc/blitz_stats`, {
        method: "POST", headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_token: tok, p_email: "" }),
      }).then((r) => r.ok).catch(() => false);
      authed = av;
    }
    if (!authed) return json({ error: "unauthorized" }, 401);

    const origin = new URL(request.url).origin;

    // Every section is isolated + best-effort — one down source can never break the consolidation.
    const [funnel, rpc, failures, agents] = await Promise.all([
      funnelUptime(env, origin).catch((e) => ({ source: "canary", ok: false, reachable: false, detail: String(e).slice(0, 120), probes: {} })),
      rpcHealth(env).catch((e) => ({ source: "health-monitor.RPC_PROBES", reusable: false, note: String(e).slice(0, 120), results: [] })),
      recentFailures(env).catch((e) => ({ source: "admin_all_events", ready: false, note: String(e).slice(0, 120), total: 0, byChannel: {}, byArea: {} })),
      agentQuality(env).catch((e) => ({ source: "agent_evals_summary", ready: false, note: String(e).slice(0, 120) })),
    ]);

    const slo = computeSlo(funnel, rpc, failures, agents);

    return json({
      ok: true,
      generatedAt: new Date().toISOString(),
      slo,                        // ← the one-glance answer: overall + per-area red/yellow/green
      sections: {
        funnel,                   // (A) reused canary uptime
        rpc,                      // (B) reused health-monitor RPC_PROBES
        failures,                 // (C) reused admin_all_events, 7d, by channel + area
        agents,                   // (D) qualidade dos agentes (agent_evals_summary, real)
      },
      reuse: {                    // proof-of-non-duplication: what each section leans on
        funnel: "GET /api/canary (read-only, self-deduped)",
        rpc: "import { RPC_PROBES } from ./health-monitor.js",
        failures: "rpc admin_all_events (same feed /api/backup uses)",
        agents: "rpc agent_evals_summary (harness de evals, ligado 2026-08-11)",
      },
    });
  } catch (e) {
    // last-resort: still answer, honestly degraded — an SLO endpoint that 500s is itself an outage.
    return json({ ok: false, slo: { overall: "unknown", areas: {} }, error: String(e).slice(0, 160) }, 200);
  }
}
