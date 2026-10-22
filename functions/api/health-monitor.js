// Cloudflare Pages Function — GET/POST /api/health-monitor?token=DIGEST_TOKEN
// CHURN DEFENSE (retention is the real business — AI apps keep only ~21% of clients).
// Compares each client's events this week vs last week; if activity dropped sharply, emails
// Luis an alert so he can reach out BEFORE the client thinks of cancelling (3x more
// effective than waiting). Driven by the weekly cron.
import { json, isOwnerEmail, safeEq } from "../lib/guard.js";
import { sbKey } from "../lib/sb.js";
import { avisarDono, donoEmail, emailsDoDonoMudos } from "../lib/avisarDono.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

// INGEST-gated RPC helper (same pattern as /api/automations — that file iterates the same
// client enumeration; the pattern is copied, automations.js itself is untouched).
// `orc` (opcional) é o orçamento de subrequests da rodada — ver "O ORÇAMENTO" abaixo. Conta ANTES
// do fetch: pedido que lançou também gastou a vaga na conta do Cloudflare.
async function rpc(env, fn, args, orc) {
  if (orc) orc.usado++;
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

// ── O ORÇAMENTO DE SUBREQUESTS (auditoria de lançamento, 2026-09-22) ────────────────────────────
// O INCIDENTE: em 15/09 e 19/09 esta rota morreu com "Too many subrequests" — o teto do
// Cloudflare por invocação. E quando ela morre, morre INTEIRA: o saldo da Twilio, o saldo da
// Anthropic e as sondas de RPC não rodam, justamente na hora em que alguma coisa está errada.
//
// POR QUE ESTOURAVA SÓ EM ALGUNS DIAS: o teto antigo (40 clientes, "~4 RPCs por cliente") contava
// a LEITURA e esquecia o ALERTA. Cada alerta custa reserva + feed + avisarDono, e o avisarDono
// sozinho são ~10 pedidos (trava, feed, e-mail, e a escada do WhatsApp). Num dia comum quase
// ninguém alerta; no dia em que as reservas de 7 dias vencem juntas, vários alertam na mesma
// rodada. E a checagem dos rascunhos aprovados fazia até 60 consultas a mais, fora da conta.
// MEDIDO em 27/09: das 14 contas do banco, 5 são internas, 6 são DEMO (vitrine de prospect: tem
// agente, nunca terá número — alertava "sem número" toda semana, para sempre) e 3 são clientes.
// Estourar com 14 contas diz que o teto em vigor é o pequeno (50), não o de 1.000.
//
// O CONSERTO, EM QUATRO PARTES:
//   1. CONTA DEMO NÃO É CLIENTE — sai da varredura antes de custar um pedido (ver `ehDemo`).
//   2. TETO EXPLÍCITO por rodada (`orc`), contado pedido a pedido, alerta incluso. Acabou a folga,
//      a varredura PARA e diz que parou (`cobertura.interrompido`) — nunca estoura.
//   3. RODÍZIO POR HORA: cada rodada olha uma FATIA dos clientes; a rota roda de hora em hora,
//      então todos são cobertos ao longo do dia. "Silencioso há 5 dias" não precisa ser medido
//      24× por dia por cliente.
//   4. O CRÍTICO PRIMEIRO: saldos e sondas rodam ANTES da varredura e ela fica com o que sobrar.
//
// O PADRÃO (45) CABE NO MENOR TETO DO CLOUDFLARE (50, plano Free). Não dá para saber daqui qual
// é o plano, e os dois erros não pesam igual: teto baixo demais só deixa o rodízio mais lento;
// teto alto demais repete o incidente. Em plano Paid (1.000), suba `HEALTH_SUBREQ_TETO` (ex.: 400)
// no Cloudflare e o rodízio passa a cobrir 25 clientes por hora.
const SILENT_MAX_CLIENTS = 25;   // teto de clientes por rodada, por maior que seja o orçamento
const SUBREQ_TETO_PADRAO = 45;
const CUSTO_AVISO = 10;          // avisarDono: trava + feed + e-mail (2) + escada do WhatsApp (até 6)
const CUSTO_CLIENTE = 3;         // agente + número + eventos
const CUSTO_ALERTA = 2 + CUSTO_AVISO; // reserva + feed do cliente + avisarDono
const RESERVA_FINAL = 3;         // client_health + interruptor de e-mail + e-mail de churn
// clients_list + settings + saldos (3) + sondas (6) + draft_list + reserva final + UM aviso.
const CUSTO_FIXO = 1 + 1 + 3 + 6 + 1 + RESERVA_FINAL + CUSTO_AVISO;

function novoOrcamento(env) {
  const pedido = parseInt(env && env.HEALTH_SUBREQ_TETO, 10);
  const teto = Math.min(900, Math.max(30, Number.isFinite(pedido) && pedido > 0 ? pedido : SUBREQ_TETO_PADRAO));
  return { teto, usado: 0 };
}
const cabe = (orc, n, limite) => orc.usado + n <= (limite ?? orc.teto);

// avisarDono contado: aviso que a trava calou custou 1 pedido (a própria trava), não 10.
async function avisarContado(env, orc, dados) {
  const r = await avisarDono(env, dados);
  if (orc) orc.usado += r && r.pulado ? 1 : CUSTO_AVISO;
  return r;
}

// ── CONTA DEMO ──────────────────────────────────────────────────────────────────────────────────
// Duas marcas, e as duas valem: `client_credits.internal` (contas NOSSAS — sim@, smart@, e2e-test@;
// já respeitada aqui desde 14/08) e o ENDEREÇO de demonstração: `*.demo@guileoai.com` é como o
// COMBO MOTOR cadastra a vitrine de um prospect (mesma regra de onboard-client.js), `@teste.com` é
// o par de demonstração do proactive.js, `@example.*` nunca é gente.
// `^demo` sozinho pegaria "demolidora@…" — cliente de verdade sumindo do alarme por causa do nome.
// Por isso a regra exige que "demo" seja a caixa inteira ou venha seguida de número/separador.
export const ehDemo = (email) => /\.demo@|^demo(\d+|[._+-][^@]*)?@|@example\.|@teste\.com$/i.test((email || "").toString().trim());

// A fatia da hora: rodízio SEM estado (nada para gravar, nada para corromper). A hora cheia
// escolhe a fatia; em `fatias` horas todo mundo foi visto uma vez.
export function fatiaDaHora(lista, porRodada, agora = Date.now()) {
  const n = Math.max(1, porRodada);
  const fatias = Math.max(1, Math.ceil(lista.length / n));
  const fatia = Math.floor(agora / 3600e3) % fatias;
  return { lote: lista.slice(fatia * n, (fatia + 1) * n), fatia: fatia + 1, de: fatias };
}

// CONFIG-BROKEN ALERT — atomic 7-day claim per (email, kind) via health_claim
// (db/health_claims.sql). true → ingest the ops_alert; null → SQL not pasted (report-only).
async function opsAlert(env, out, orc, limite, email, kind, summary, payload = {}) {
  // Sem folga para o alerta INTEIRO, nem reserva: reservar e não avisar queimaria 7 dias de
  // silêncio sobre um cliente com o telefone mudo. Fica adiado e volta na próxima fatia dele.
  if (!cabe(orc, CUSTO_ALERTA, limite)) { out.adiados++; out.config.push({ email, kind, alerted: false, adiado: true }); return; }
  let alerted = false;
  const claimed = await rpc(env, "health_claim", { p_email: email, p_kind: kind }, orc);
  let aviso = null;
  if (claimed === true) {
    // claim is burned for 7d, so a failed ingest must be visible — alerted:false in the JSON
    const ir = await rpc(env, "ingest_client_event", {
      p_email: email, p_type: "ops_alert", p_channel: "system",
      p_summary: summary.slice(0, 300), p_amount: 0, p_payload: { kind, ...payload },
    }, orc);
    alerted = ir !== null;
    // E SAI DA PLATAFORMA (2026-09-09): cliente "vivo" sem número ou sem agente é telefone que não
    // toca — ficava só no feed do cliente. Agora o dono é avisado (e-mail + WhatsApp, trava de 6h).
    aviso = await avisarContado(env, orc, { kind: `config_${kind}`, summary, cliente: email, chave: `config_${kind}:${email}`, payload });
  } else if (claimed === null) out.configClaimReady = false; // db/health_claims.sql not pasted
  out.config.push({ email, kind, alerted, ...(aviso ? { aviso } : {}) });
}

async function silentSweep(env, orc, clients, limite) {
  // ⚙️ SILENT_DAYS agora obedece o /admin (platform_settings) com a env como reserva — a própria
  // tela de Regras de cobrança dizia "hoje quem manda é a env"; esta linha fecha essa dívida.
  // Falha na leitura do settings degrada pra env em silêncio: regra de saúde nunca pode parar
  // de rodar porque a tabela de configuração engasgou.
  let cfg = {};
  try { const r = await rpc(env, "platform_settings_get", {}, orc); if (r && typeof r === "object" && !Array.isArray(r)) cfg = r; } catch { /* env manda */ }
  const days = Math.max(1, parseInt(cfg.silent_days ?? env.SILENT_DAYS, 10) || 5);
  const out = { ready: true, claimReady: true, configClaimReady: true, days, silent: [], config: [], adiados: 0, cobertura: null };
  if (!Array.isArray(clients)) { out.ready = false; return out; }
  const sinceISO = new Date(Date.now() - SILENT_LOOKBACK_DAYS * 864e5).toISOString();

  // TRIAGEM SEM CUSTO — quem não é cliente sai antes de gastar um pedido.
  const reais = [], foraDoAlarme = new Set();
  let internos = 0, demos = 0;
  for (const c of clients) {
    const email = ((c && c.client_email) || "").toString().trim().toLowerCase();
    if (!email.includes("@")) continue;
    // CONTA INTERNA NÃO É CLIENTE (2026-08-14). `luistelesc@`, `e2e-test@`, `sim@` são nossas —
    // gritar "📵 tem agente mas nenhum número" sobre a conta de teste é ruído diário sobre uma
    // conta que nunca deveria ter número. E ruído diário treina a gente a ignorar o painel, que é
    // como um alerta verdadeiro passa batido no meio. A marca já existia em client_credits.internal
    // (do trabalho de métrica honesta); só não chegava aqui porque clients_list não a devolvia.
    if (c && c.internal === true) { internos++; foraDoAlarme.add(email); out.config.push({ email, kind: "interno", alerted: false }); continue; }
    // CONTA DEMO TAMBÉM NÃO (2026-09-22) — só a contagem vai na resposta: são dezenas de vitrines
    // e listar uma a uma esconderia o cliente de verdade no meio.
    if (ehDemo(email)) { demos++; foraDoAlarme.add(email); continue; }
    reais.push(email);
  }

  // Tamanho da fatia: sai do TETO (constante), não da folga do momento — fatia que muda de
  // tamanho a cada rodada deixaria cliente sem ser visto por acaso. A folga real ainda é
  // conferida cliente a cliente dentro do laço.
  const porRodada = Math.max(1, Math.min(SILENT_MAX_CLIENTS, Math.floor((orc.teto - CUSTO_FIXO) / CUSTO_CLIENTE)));
  const { lote, fatia, de } = fatiaDaHora(reais, porRodada);
  out.cobertura = { clientes: reais.length, internos, demos, por_rodada: porRodada, fatia, de, examinados: 0, interrompido: false };

  for (const email of lote) {
    if (!cabe(orc, CUSTO_CLIENTE, limite)) { out.cobertura.interrompido = true; break; }
    out.cobertura.examinados++;
    const agent = await rpc(env, "client_agent_lookup", { p_email: email }, orc);
    const number = await rpc(env, "client_number_lookup", { p_email: email }, orc);
    // HALF-PROVISIONED — an agent nobody can call, or a number nobody answers. Both are a
    // paying client whose phone silently doesn't work; alert (7d-deduped) instead of skipping.
    if (agent && !number) {
      await opsAlert(env, out, orc, limite, email, "no_number", `📵 ${email} tem agente mas NENHUM número — ligações não chegam na Gui`, { agent: String(agent).slice(0, 60) });
      continue;
    }
    if (!agent && number) {
      await opsAlert(env, out, orc, limite, email, "no_agent", `🤖 ${email} tem número ${String(number).slice(0, 24)} mas NENHUM agente — ligações não são atendidas`, { number: String(number).slice(0, 24) });
      continue;
    }
    if (!agent) continue; // not provisioned at all — just "not live yet"
    const events = (await rpc(env, "client_events_since", { p_email: email, p_since: sinceISO }, orc)) || [];
    const times = (Array.isArray(events) ? events : [])
      .filter((e) => SILENT_TYPES.includes(e.type))
      .map((e) => new Date(e.created_at).getTime()).filter((t) => t > 0);
    const last = times.length ? Math.max(...times) : 0;
    const silentDays = last ? Math.floor((Date.now() - last) / 864e5) : SILENT_LOOKBACK_DAYS;
    if (silentDays < days) continue;
    const label = last ? String(silentDays) : `${SILENT_LOOKBACK_DAYS}+`;
    // Mesma regra do opsAlert: sem folga para o alerta inteiro, não reserva — adia.
    if (!cabe(orc, CUSTO_ALERTA, limite)) { out.adiados++; out.silent.push({ email, days: silentDays, capped: !last, alerted: false, adiado: true }); continue; }
    // ATOMIC 7-day claim BEFORE ingesting — false = already alerted this week, null = SQL not pasted.
    let alerted = false, aviso = null;
    const claimed = await rpc(env, "silent_claim", { p_email: email }, orc);
    if (claimed === true) {
      const resumo = `🔇 ${email} silencioso há ${label} dias — agente quebrado? número errado? churn?`;
      const ir = await rpc(env, "ingest_client_event", {
        p_email: email, p_type: "ops_alert", p_channel: "system",
        p_summary: resumo,
        p_amount: 0, p_payload: { days: silentDays, threshold: days, agent: String(agent).slice(0, 60), number: String(number).slice(0, 24) },
      }, orc);
      // `alerted` era `true` por fé — agora reflete se o feed gravou. E o dono é AVISADO (2026-09-09):
      // cliente pagante mudo por dias era exatamente o alarme que ficava dentro da plataforma.
      alerted = ir !== null;
      aviso = await avisarContado(env, orc, { kind: "cliente_silencioso", summary: resumo, cliente: email, chave: `cliente_silencioso:${email}`,
        payload: { days: silentDays, threshold: days } });
    } else if (claimed === null) out.claimReady = false; // db/silent_claim.sql not pasted → report-only
    out.silent.push({ email, days: silentDays, capped: !last, alerted, ...(aviso ? { aviso } : {}) });
  }
  // BROKEN CONFIG post-approval — a draft marked 'live' whose agent link is EMPTY means the
  // /admin approve half-failed: client "live" on paper with no Gui answering. draft_list('') = all.
  // (2026-09-22) Eram até 60 consultas por rodada, sem conta. Agora: a triagem (vivo, sem agente,
  // não-demo, não-interno) é feita no que JÁ veio na lista, e só os candidatos entram no rodízio.
  try {
    if (cabe(orc, 1, limite)) {
      const drafts = await rpc(env, "draft_list", { p_seller_email: "" }, orc);
      const candidatos = [];
      for (const d of (Array.isArray(drafts) ? drafts : [])) {
        if (!d || d.status !== "live") continue;
        const em = ((d.client_email || "")).toString().trim().toLowerCase();
        if (!em.includes("@") || foraDoAlarme.has(em) || ehDemo(em)) continue;
        if (((d.agent_id || "")).toString().trim()) continue;
        candidatos.push({ em, id: (d.id || "").toString() });
      }
      const rod = fatiaDaHora(candidatos, Math.max(3, Math.min(20, porRodada)));
      out.cobertura.drafts = { candidatos: candidatos.length, fatia: rod.fatia, de: rod.de, examinados: 0 };
      for (const d of rod.lote) {
        if (!cabe(orc, 1, limite)) { out.cobertura.interrompido = true; break; }
        out.cobertura.drafts.examinados++;
        // confirm against the live link — approve may have linked the agent without stamping the draft
        const ag = await rpc(env, "client_agent_lookup", { p_email: d.em }, orc);
        if (ag) continue;
        await opsAlert(env, out, orc, limite, d.em, "approved_no_agent", `⚠️ ${d.em} aprovado no /admin mas sem agent_id — cliente ativo sem Gui`, { draft_id: d.id });
      }
    } else out.cobertura.interrompido = true;
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

async function runRpcProbes(env, orc, clients) {
  const out = { ok: [], failed: [], notReady: [], claimReady: true };
  // (2026-09-22) A lista de clientes vem de quem chamou: era lida DUAS vezes por rodada (aqui e
  // na varredura), e pedido repetido é o primeiro a cortar quando o teto aperta.
  if (!Array.isArray(clients) || !clients.length) { out.skipped = "no tenants"; return out; }
  const email = ((clients[0] && clients[0].client_email) || "").toString().trim().toLowerCase();
  if (!email.includes("@")) { out.skipped = "no tenant email"; return out; }

  const call = async (p) => {
    const secret = p.secret === SEC_SCHED ? (env.SCHED_SECRET || "") : (env.INGEST_SECRET || "");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    if (orc) orc.usado++;
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
  for (const res of results) {
    if (res.status === "ok") { out.ok.push(res.name); continue; }
    if (res.status === "notReady") { out.notReady.push(res.name); continue; }
    // FAILURE → avisarDono (2026-09-09): feed + e-mail + WhatsApp, trava de 6h por RPC. Antes era
    // só o feed, com trava de 7 dias no tenant `smart@` — uma aba morta ficava 7 dias sem repetir o
    // aviso e o aviso nem saía da plataforma. `alerted` = o feed gravou; o recibo vai inteiro.
    // `noAccess` (sonda sem permissão) NÃO acorda ninguém: é cinza, não vermelho — ver o comentário
    // longo em `call` acima.
    if (res.status === "noAccess") { out.failed.push({ name: res.name, httpStatus: res.httpStatus, error: res.error, alerted: false }); continue; }
    // Sem folga para o aviso: a falha continua NA RESPOSTA (o cron-tick e o semáforo a leem), só o
    // aviso fica para a próxima hora. Estourar o teto aqui derrubaria a rota inteira — e com ela
    // a própria lista de falhas.
    if (orc && !cabe(orc, CUSTO_AVISO + RESERVA_FINAL)) { out.failed.push({ name: res.name, httpStatus: res.httpStatus, error: res.error, alerted: false, adiado: true }); continue; }
    const aviso = await avisarContado(env, orc, {
      kind: `rpc_${res.name}`,
      summary: `🚨 RPC ${res.name} FALHOU na sonda viva (HTTP ${res.httpStatus}) — aba pode estar morta há dias: ${res.error}`,
      cliente: "Guileo (plataforma)", payload: { rpc: res.name, httpStatus: res.httpStatus, tenant: email },
    });
    if (aviso.trava && /ilegível/.test(aviso.trava)) out.claimReady = false;
    out.failed.push({ name: res.name, httpStatus: res.httpStatus, error: res.error, alerted: !!(aviso.feed && aviso.feed.ok), aviso });
  }
  return out;
}

// ── SALDO DOS PROVEDORES ──────────────────────────────────────────────────────
// POR QUE EXISTE: sem saldo na Twilio o telefone do cliente simplesmente PARA de
// atender — e hoje só se descobre quando o cliente reclama. É a mesma família de
// falha silenciosa do resto da plataforma: nada quebra, nada loga, o produto só
// emagrece. Aqui o dono é avisado ANTES de acabar, com dias de antecedência.
// Honesto-inerte: sem a chave, marca "notReady" e não inventa número.
async function runBalanceChecks(env, orc) {
  const out = { ok: [], low: [], notReady: [] };
  const conta = () => { if (orc) orc.usado++; };
  // Piso configurável: abaixo disso o dono é avisado. $20 dá ~2 dias de folga numa
  // operação pequena — tempo de recarregar sem ninguém perder ligação.
  const FLOOR = Number(env.TWILIO_BALANCE_FLOOR_USD) || 20;

  // (2026-09-09) Saldo baixo ficava SÓ no feed, 1×/7 dias. Saldo é o interruptor que desliga o
  // telefone de todos os clientes: agora sai pelo avisarDono (e-mail + WhatsApp, trava de 6h) e o
  // retorno é o recibo, não um booleano de fé.
  const alert = async (kind, summary, payload) => {
    const r = await avisarContado(env, orc, { kind, summary, cliente: "Guileo (plataforma)", payload });
    return r;
  };

  // Twilio: saldo em dólares da conta.
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
    conta();
    try {
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Balance.json`, {
        headers: { Authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}` },
        signal: AbortSignal.timeout(6000),
      });
      const d = await r.json().catch(() => ({}));
      const bal = Number(d?.balance);
      if (!r.ok || !Number.isFinite(bal)) out.notReady.push({ provider: "twilio", why: `HTTP ${r.status}` });
      else if (bal < FLOOR) {
        const aviso = await alert("balance_twilio_low",
          `🔴 SALDO TWILIO BAIXO: $${bal.toFixed(2)} (piso $${FLOOR}). Sem saldo o telefone dos clientes PARA de atender — recarregue em console.twilio.com → Billing.`,
          { provider: "twilio", balance: bal, floor: FLOOR });
        out.low.push({ provider: "twilio", balance: bal, alerted: !!aviso.chegou, aviso });
      } else out.ok.push({ provider: "twilio", balance: bal });
    } catch (e) { out.notReady.push({ provider: "twilio", why: String(e).slice(0, 80) }); }
  } else out.notReady.push({ provider: "twilio", why: "sem credencial" });

  // ElevenLabs: cota de caracteres da assinatura (a voz para quando estoura).
  if (env.ELEVENLABS_API_KEY) {
    conta();
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
          const aviso = await alert("balance_elevenlabs_low",
            `🔴 COTA DE VOZ EM ${pct}% (${used.toLocaleString()}/${limit.toLocaleString()} caracteres). Ao estourar, a Gui para de falar nas ligações.`,
            { provider: "elevenlabs", used, limit, pct });
          out.low.push({ provider: "elevenlabs", pct, alerted: !!aviso.chegou, aviso });
        } else out.ok.push({ provider: "elevenlabs", pct });
      }
    } catch (e) { out.notReady.push({ provider: "elevenlabs", why: String(e).slice(0, 80) }); }
  } else out.notReady.push({ provider: "elevenlabs", why: "sem credencial" });

  // ── ANTHROPIC: O CÉREBRO TEM SALDO? (2026-08-25) ───────────────────────────────────
  // O INCIDENTE REAL, DUAS VEZES: o saldo da Anthropic zerou e TODO canal de texto caiu junto
  // (gui-chat da landing, widget do cliente, suporte, criativo, orçamento) — e o painel ficou
  // VERDE, porque a voz (que roda na ElevenLabs) continuava atendendo do lado. Ninguém foi
  // avisado; descobriu-se pelo chat respondendo enlatado em inglês numa conversa em português.
  //
  // ⚠️ A ANTHROPIC DEVOLVE 400, NÃO 402, QUANDO O SALDO ACABA. É por isso que este bloco não pode
  // se contentar com "não foi 200": um 400 pode ser pedido malformado (culpa nossa, e a sonda é
  // fixa, então não é o caso) — mas um 400 cuja mensagem fala em CRÉDITO/BILLING é a operação
  // parada. Por isso o corpo é LIDO, não só o status.
  //   400 + "credit balance"/"billing"/"quota" → CRÍTICO (cérebro sem saldo)
  //   401/403                                  → CRÍTICO (chave morta/revogada — mesmo efeito prático)
  //   429 / 5xx                                → passageiro: não é falta de saldo, não acorda ninguém
  // Custo da sonda: max_tokens 1 — o menor pedido que ainda prova que a conta responde.
  // Honesto-inerte: sem a chave, "notReady" — nunca verde por ausência.
  if (env.ANTHROPIC_API_KEY) {
    conta();
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) out.ok.push({ provider: "anthropic" });
      else {
        const body = (await r.text().catch(() => "")) || "";
        const semSaldo = r.status === 400 && /credit balance|billing|insufficient|quota/i.test(body);
        const chaveMorta = r.status === 401 || r.status === 403;
        if (semSaldo || chaveMorta) {
          const motivo = semSaldo
            ? "SALDO ZERADO na Anthropic — todo canal de TEXTO (chat do site, widget do cliente, suporte, criativo) está respondendo enlatado ou morto. A VOZ continua funcionando, então o painel parece normal."
            : `CHAVE DA ANTHROPIC RECUSADA (HTTP ${r.status}) — mesmo efeito prático: nenhum canal de texto pensa.`;
          // (2026-09-09) Porta única: avisarDono — feed + e-mail (caixa que o dono lê) + WhatsApp,
          // trava de 6h (era 1×/dia só por e-mail, para `smart@`). `alerted` = a Resend ACEITOU;
          // o recibo inteiro vai em `aviso` para o /admin mostrar por que não chegou, se não chegou.
          const aviso = await avisarContado(env, orc, {
            kind: semSaldo ? "cerebro_sem_saldo" : "chave_anthropic_recusada",
            summary: `🧠 CÉREBRO SEM SALDO — ${motivo}`, detail: `HTTP ${r.status} · ${body.slice(0, 300)}`,
            cliente: "Guileo (plataforma)", link: "https://console.anthropic.com/settings/billing",
            payload: { provider: "anthropic", httpStatus: r.status },
          });
          out.low.push({ provider: "anthropic", httpStatus: r.status, semSaldo, alerted: !!(aviso.email && aviso.email.ok), aviso });
        } else {
          // 429/5xx: a conta existe e responde — só está ocupada. Nem verde nem alarme: "não deu para provar".
          out.notReady.push({ provider: "anthropic", why: `HTTP ${r.status} (passageiro — não é falta de saldo)` });
        }
      }
    } catch (e) { out.notReady.push({ provider: "anthropic", why: String(e).slice(0, 80) }); }
  } else out.notReady.push({ provider: "anthropic", why: "sem credencial" });

  return out;
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    const tok = new URL(request.url).searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
    if (!env.DIGEST_TOKEN || !safeEq(tok, env.DIGEST_TOKEN)) return json({ error: "unauthorized" }, 401);

    // ── A ORDEM É O ORÇAMENTO (2026-09-22) ─────────────────────────────────────────────────────
    // Antes: varredura → sondas → saldos. A varredura é a parte que cresce com o número de
    // clientes, e era ela que estourava o teto de subrequests — levando junto os saldos e as
    // sondas, que vinham DEPOIS. Agora o que é fixo e crítico roda primeiro, e a varredura fica
    // com o que sobrar. Cada bloco continua isolado: um não derruba o outro.
    const orc = novoOrcamento(env);
    // A lista de clientes é lida UMA vez e serve à varredura e às sondas.
    let clients = null;
    try { clients = await rpc(env, "clients_list", {}, orc); } catch { clients = null; }
    // Saldo dos provedores — isolado como os outros: uma API fora do ar não pode
    // derrubar o monitor inteiro (senão o monitor vira a próxima falha silenciosa).
    let balances = { ok: [], low: [], notReady: [] };
    try { balances = await runBalanceChecks(env, orc); } catch (e) { balances = { ok: [], low: [], notReady: [{ provider: "all", why: String(e).slice(0, 80) }] }; }
    // RPC live probes — isolated too: a probe failure alerts, but must never break the sweep/email.
    let probes = { ok: [], failed: [], notReady: [], claimReady: true };
    try { probes = await runRpcProbes(env, orc, clients); } catch (e) { probes = { ok: [], failed: [], notReady: [], claimReady: true, error: String(e).slice(0, 120) }; }
    const rpcProbes = { ok: probes.ok, failed: probes.failed, notReady: probes.notReady, claimReady: probes.claimReady, ...(probes.skipped ? { skipped: probes.skipped } : {}), ...(probes.error ? { error: probes.error } : {}) };
    // silent-client sweep — isolated so it can never block the churn-drop email below. Pode gastar
    // até o teto MENOS a reserva do que ainda vem depois dela (client_health + e-mail de churn).
    let sweep = { ready: false, claimReady: false, configClaimReady: false, days: 5, silent: [], config: [], adiados: 0, cobertura: null };
    try { sweep = await silentSweep(env, orc, clients, orc.teto - RESERVA_FINAL); } catch (e) { sweep.erro = String(e).slice(0, 120); }
    // `orcamento` vai na resposta como PROVA: é o número que diz, a cada rodada, a que distância
    // do teto a rota ficou. É estimativa (o avisarDono é contado pelo pior caso), não medição.
    const orcamento = { teto: orc.teto, usado_estimado: orc.usado, reserva_final: RESERVA_FINAL };
    const silentOut = { silent: sweep.silent, silentReady: sweep.ready, silentClaimReady: sweep.claimReady, silentDays: sweep.days, config: sweep.config, configClaimReady: sweep.configClaimReady, silentCobertura: sweep.cobertura, silentAdiados: sweep.adiados, ...(sweep.erro ? { silentErro: sweep.erro } : {}), rpcProbes, balances, orcamento };

    const hr = await fetch(`${SB_URL}/rest/v1/rpc/client_health`, {
      method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.INGEST_SECRET || "" }),
    });
    // "NÃO CONSEGUI LER" ≠ "NINGUÉM EM RISCO" (2026-09-09). `hr.ok ? json : []` fazia client_health
    // fora do ar virar `atRisk:0` com 200 — o monitor de churn cego respondendo "tudo certo".
    // Agora a leitura falha sai como ok:false + 502, com o motivo; o cron-tick vigia e avisa.
    if (!hr.ok) {
      const churn = { ok: false, lido: false, motivo: `client_health http ${hr.status} — não consegui ler o risco de churn` };
      return json({ ok: false, churn, atRisk: null, ...silentOut }, 503);
    }
    const rows = await hr.json().catch(() => null);
    if (!Array.isArray(rows)) return json({ ok: false, churn: { ok: false, lido: false, motivo: "client_health respondeu algo que não é lista" }, atRisk: null, ...silentOut }, 503);
    // at risk: had real activity last week AND dropped 40%+ (or went silent this week)
    const atRisk = rows.filter((r) => Number(r.last_week) >= 3 && Number(r.drop_pct) >= 40);

    if (atRisk.length === 0) return json({ ok: true, atRisk: 0, ...silentOut });
    if (!env.RESEND_API_KEY) return json({ ok: false, reason: "no mailer", atRisk: atRisk.length, ...silentOut });

    // Destinatário: a caixa que o dono lê (OWNER_EMAIL vence), validada pela lista de donos.
    const OWNER = isOwnerEmail(donoEmail(env), env) ? donoEmail(env) : "luistelesc@gmail.com";
    const FROM = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
    const list = atRisk.sort((a, b) => b.drop_pct - a.drop_pct).map((r) =>
      `<tr><td style="padding:6px 12px 6px 0;font-weight:700">${r.client_email}</td><td style="padding:6px 0;color:#c0392b;font-weight:700">−${r.drop_pct}%</td><td style="padding:6px 0 6px 12px;color:#888">${r.this_week} esta semana · ${r.last_week} antes</td></tr>`).join("");

    if (await emailsDoDonoMudos(env)) return json({ ok: true, atRisk: atRisk.length, churnEmail: { ok: false, mudo: true, motivo: "emails_dono=off" }, ...silentOut });
    const er = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [OWNER], subject: `🩺 ${atRisk.length} cliente(s) em risco de churn — aja agora`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:560px"><h2 style="color:#3E9468;margin:0 0 4px">Monitor de saúde · risco de cancelamento</h2><p style="color:#888;margin:0 0 14px">A atividade destes clientes caiu forte. Falar com eles AGORA é 3x mais eficaz que esperar. Liga, manda um "como posso ajudar?", mostra o resultado.</p><table style="font-size:14px;width:100%">${list}</table></div>` }),
    });
    // Conferir o `.ok`: o e-mail de churn "enviado" que a Resend recusou deixava os clientes em
    // risco sem ninguém ligar — e a rota dizia ok. Agora o recibo (id) vai na resposta.
    const ed = await er.json().catch(() => ({}));
    if (!er.ok) return json({ ok: false, atRisk: atRisk.length, churnEmail: { ok: false, status: er.status, motivo: (ed && ed.message) || "" }, ...silentOut }, 503);
    return json({ ok: true, atRisk: atRisk.length, churnEmail: { ok: true, id: (ed && ed.id) || null, para: OWNER }, ...silentOut });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 120) }, 500);
  }
}
