// functions/lib/scheduleAdapter.js
// ═════════════════════════════════════════════════════════════════════════════
// THE UNIFIED SCHEDULING BRAIN — one interface, every calendar.
//
// Given a tenant (client_email) this module discovers which external booking system the tenant
// has CONNECTED and READY (mindbody | square) and ROUTES availability/book/cancel/reschedule to
// it. If none is connected it hands control to the INTERNAL Guileo engine (biz_* in Supabase).
//
// GOLDEN ANTI-CLASH RULE:
//   • External connected + ready → availability comes FROM the external (the salon's real truth)
//     and the booking is WRITTEN into the external, then MIRRORED into biz_appointments.
//   • No external → the INTERNAL engine is the source of truth.
//   • We NEVER book internally "on top of" a connected external.
//
// ── MINDBODY (reescrito em 2026-09-30) ───────────────────────────────────────────────────────
// A regra que mudou: **erro do MindBody é erro, com motivo.** A versão anterior devolvia
// `handled:false` quando o MindBody falhava na disponibilidade, e o chamador caía nos horários do
// motor INTERNO — a agente oferecia, para um spa que vive no MindBody, horários que não existem
// na agenda de verdade. Agora todo desfecho do caminho MindBody é `handled:true`:
//     { handled:true, ok:true,  … }                 funcionou
//     { handled:true, ok:false, reason, detail }    não funcionou — a agente diz que não consegue
//                                                   ver a agenda e anota o recado
// `handled:false` no MindBody só existe para cancelar/remarcar um agendamento que NÃO é espelho
// (foi feito no motor interno, antes da integração ligar): aí o interno resolve, e é o certo.
//
// O que mais mudou, e por quê (cada item era um defeito provado na revisão):
//   · o horário falado é resolvido contra a disponibilidade REAL do MindBody, no fuso do site —
//     quem resolve é o chamador com resolveSlot, sobre a lista que getAvailability devolve;
//   · os ids que vão para o MindBody saem do MAPA (mb_mapping), nunca de um UUID da Guileo;
//   · as janelas de bookableitems viram inícios reserváveis (mindbodyTempo.expandirJanelas);
//   · cliente achado por telefone/e-mail exatos, agendamento idempotente (mindbodyApi);
//   · cancelar e remarcar chegam ao MindBody; o espelho guarda site + ids para achar de volta.
//
// QUANDO O MINDBODY ESTÁ "LIGADO" PARA UM TENANT: chave da plataforma (MINDBODY_API_KEY) +
// credenciais com login + MAPA SALVO E ATIVO. Conectar sem salvar o mapa não desliga o motor
// interno — configuração pela metade é pior que nenhuma (lição de 2026-08-16, mantida abaixo).
//
// SQUARE: inalterado — segue chamando o conector same-origin com a chave do tenant.
// ═════════════════════════════════════════════════════════════════════════════
import { svcRpc } from "./sb.js";
import { emitFailure } from "./failure.js";
import { resolverIds } from "./mindbodyMapa.js";
import { zonaValida, diaLocal, expandirJanelas, horariosAtivos, localParaInstante, somarMinutosLocais, instanteParaLocal } from "./mindbodyTempo.js";
import { janelasReservaveis, horariosDeSessao, acharOuCriarCliente, agendarUmaVez, cancelarAgendamento, remarcarAgendamento } from "./mindbodyApi.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const norm = (s) => (s || "").toString().trim().toLowerCase();

async function sbRpc(fn, body) {
  const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r;
}

// INGEST-gated read of a tenant's stored provider credentials (client_integrations.tokens).
// Returns the tokens object (or null). Never throws. (Square.)
async function credsLookup(fn, env, email) {
  try {
    const r = await sbRpc(fn, { p_secret: env.INGEST_SECRET || "", p_email: email });
    if (!r.ok) return null;
    const t = await r.json().catch(() => null);
    return t && typeof t === "object" ? t : null;
  } catch { return null; }
}

// Fetch the tenant's own connection key server-side (INGEST-gated). (Square connector gate.)
async function tenantKey(env, email) {
  try {
    const r = await sbRpc("client_key_for", { p_secret: env.INGEST_SECRET || "", p_email: email });
    if (!r.ok) return "";
    return ((await r.json()) || "").toString();
  } catch { return ""; }
}

// ═════════════════════════════════════════════════════════════════════════════
// MINDBODY — configuração do tenant
// ═════════════════════════════════════════════════════════════════════════════
// RPC do MindBody: só o service_role executa (db/mindbody_v2.sql). Devolve SEMPRE
// { ok:true, data } ou { ok:false, status, reason, detail } — nunca null que pareça "vazio".
export async function mbRpc(env, fn, body) {
  try {
    const r = await svcRpc(env, fn, { p_secret: env.INGEST_SECRET || "", ...body });
    const texto = await r.text();
    if (!r.ok) {
      const ausente = r.status === 404 || /PGRST202/.test(texto);
      return { ok: false, status: r.status, reason: ausente ? "sql_nao_aplicado" : (r.status === 401 || r.status === 403 ? "banco_sem_permissao" : "banco_fora"), detail: texto.slice(0, 160) };
    }
    let data = null;
    if (texto) { try { data = JSON.parse(texto); } catch { return { ok: false, status: r.status, reason: "banco_resposta_ilegivel", detail: texto.slice(0, 120) }; } }
    return { ok: true, data };
  } catch (e) { return { ok: false, status: 0, reason: "banco_fora", detail: String(e && e.message || e).slice(0, 160) }; }
}

// Os sites do MindBody que ESTE tenant conectou (um cliente pode ter mais de um).
export function sitesDoTenant(creds) {
  const c = creds && typeof creds === "object" ? creds : {};
  const ids = [c.site_id, ...(Array.isArray(c.site_ids) ? c.site_ids : []), ...Object.values(c.sites && typeof c.sites === "object" ? c.sites : {})];
  return [...new Set(ids.map((x) => String(x == null ? "" : x).trim()).filter((x) => /^-?\d+$/.test(x)))];
}

// A credencial de UM site: login próprio do site (creds.logins[site]) → login padrão do tenant
// → login da plataforma no env. A doc do usertoken/issue exige um usuário staff/owner que exista
// NAQUELE site, por isso o login pode variar por site.
export function conexaoDoSite(env, creds, siteId) {
  const c = creds && typeof creds === "object" ? creds : {};
  const proprio = (c.logins && c.logins[String(siteId)]) || {};
  return {
    site_id: String(siteId || "").trim(),
    username: String(proprio.username || c.source_name || env.MINDBODY_SOURCE_NAME || "").trim(),
    password: String(proprio.password || c.source_password || env.MINDBODY_SOURCE_PASSWORD || ""),
  };
}

export async function lerConfigMindbody(env, email) {
  const r = await mbRpc(env, "mb_config", { p_email: norm(email) });
  if (!r.ok) return r;
  const d = r.data && typeof r.data === "object" ? r.data : {};
  return { ok: true, creds: d.creds && typeof d.creds === "object" ? d.creds : null, mapping: d.mapping && typeof d.mapping === "object" ? d.mapping : null, synced_at: d.synced_at || null };
}

const mapaAtivo = (m) => !!(m && m.ativo === true && m.services && Object.keys(m.services).length);

// ── resolveScheduler ─────────────────────────────────────────────────────────
// The routing decision: mindbody > square > internal.
// Returns: { provider, ready, creds, mapping?, reason, detail? }
export async function resolveScheduler(env, email) {
  const e = norm(email);
  if (!e || !e.includes("@")) return { provider: "internal", ready: true, creds: null, reason: "no-tenant" };

  // 1) MINDBODY — chave da plataforma + credenciais com login + mapa salvo e ativo.
  // ⚠️ `site_id` SOZINHO NÃO É PRONTIDÃO — foi o defeito mais caro da plataforma (2026-08-16): o
  // Natura tinha os site_id gravados e login vazio; o roteador respondia "mindbody", o book não
  // autenticava, e a agente dizia "a recepção confirma" em 7 ligações seguidas. Meia configuração
  // desliga o motor que funciona e liga um que não responde. Por isso, SEM login ou SEM mapa
  // ativo, o tenant continua no motor interno, com o motivo escrito.
  if (env.MINDBODY_API_KEY) {
    const cfg = await lerConfigMindbody(env, e);
    // O ÚLTIMO ESTADO CONHECIDO (revisão 2026-09-30). A falha fechada abaixo é certa para quem USA
    // o MindBody — e errada para todos os outros: um soluço do banco faria a agente de um negócio
    // que nunca ligou o MindBody dizer "não consigo ver a agenda" no meio de uma ligação. Cada
    // leitura boa grava no KV se este negócio está com o MindBody ATIVO; na leitura que falha, só
    // quem estava ativo cai na falha fechada. Quem não estava (ou nunca foi lido) segue no motor
    // interno, que é onde a agenda dele realmente mora.
    const kv = env.RATE_LIMIT;
    const chave = `mb:ativo:${e}`;
    if (cfg.ok && kv) {
      const ativo = !!(cfg.creds && sitesDoTenant(cfg.creds).length && mapaAtivo(cfg.mapping));
      try { await kv.put(chave, ativo ? "1" : "0", { expirationTtl: 7 * 86400 }); } catch { /* memória é bônus */ }
    }
    if (!cfg.ok && cfg.reason !== "sql_nao_aplicado") {
      let estavaAtivo = false;
      try { estavaAtivo = !!kv && (await kv.get(chave)) === "1"; } catch { /* sem KV: trata como não ativo */ }
      if (!estavaAtivo) return { provider: "internal", ready: true, creds: null, reason: "mindbody-config-ilegivel-sem-uso-conhecido", detail: `${cfg.reason}${cfg.status ? ` (HTTP ${cfg.status})` : ""}` };
    }
    if (!cfg.ok) {
      // As funções ainda não existem no banco → ninguém pode estar com o MindBody ligado.
      if (cfg.reason !== "sql_nao_aplicado") {
        // Não deu para LER se este tenant usa MindBody. Cair no interno aqui seria agendar às
        // cegas em cima de uma agenda externa que pode existir — o defeito que este arquivo
        // proíbe. Falha fechada, com motivo; o chamador diz que não consegue ver a agenda.
        return { provider: "mindbody", ready: false, creds: null, mapping: null, reason: "mindbody-config-ilegivel", detail: `${cfg.reason}${cfg.status ? ` (HTTP ${cfg.status})` : ""}` };
      }
    } else if (cfg.creds && sitesDoTenant(cfg.creds).length) {
      const temLogin = sitesDoTenant(cfg.creds).every((s) => { const c = conexaoDoSite(env, cfg.creds, s); return !!(c.username && c.password); });
      if (temLogin && mapaAtivo(cfg.mapping)) return { provider: "mindbody", ready: true, creds: cfg.creds, mapping: cfg.mapping, reason: "mindbody-connected" };
      return { provider: "internal", ready: true, creds: null, reason: temLogin ? "mindbody-sem-mapa" : "mindbody-sem-credencial" };
    }
  }

  // 2) SQUARE — per-tenant access_token + location_id is all it takes (no platform key).
  {
    const c = await credsLookup("square_creds_lookup", env, e);
    if (c && c.access_token && c.location_id) return { provider: "square", ready: true, creds: c, reason: "square-connected" };
  }

  // 3) VAGARO / 4) BOOKSY — sem API pública; nunca prontos.
  // 5) INTERNAL — the always-present Guileo engine (biz_*).
  return { provider: "internal", ready: true, creds: null, reason: "no-external-ready" };
}

// ═════════════════════════════════════════════════════════════════════════════
// MINDBODY — operações
// ═════════════════════════════════════════════════════════════════════════════
const falhaMb = (reason, extra = {}) => ({ handled: true, ok: false, provider: "mindbody", reason, ...extra });
const daApi = (r, etapa) => falhaMb(r.reason || "mindbody_falhou", { detail: r.detail || "", status: r.status || 0, code: r.code || "", etapa, ...(r.horario_tomado ? { horario_tomado: true } : {}) });

// Traduz o pedido (ids da Guileo) em alvo do MindBody + conexão do site certo + fuso.
function alvoMindbody(env, r, { service_id, location_id, professional_id, tz, direto }) {
  if (!r || r.provider !== "mindbody") return falhaMb("nao_e_mindbody");
  if (!r.ready) return falhaMb(r.reason || "mindbody_indisponivel", { detail: r.detail || "" });
  // `direto` = ids do MindBody que já estão gravados no ESPELHO de um agendamento existente
  // (remarcar): valem mais que o mapa de hoje, porque dizem onde o agendamento realmente mora.
  const ids = direto && direto.site_id && direto.session_type_id != null
    ? { ok: true, site_id: String(direto.site_id), session_type_id: Number(direto.session_type_id), location_id: direto.location_id ?? null, staff_id: direto.staff_id ?? null, duracao_min: null, tz: direto.tz || "" }
    : resolverIds(r.mapping, { service_id, location_id, professional_id });
  if (!ids.ok) return falhaMb(ids.motivo);
  if (!sitesDoTenant(r.creds).includes(ids.site_id)) return falhaMb("site_nao_conectado", { detail: `site ${ids.site_id}` });
  // O fuso é o do SITE (salvo no mapa). O da unidade da Guileo só entra se o mapa não tiver.
  const fuso = zonaValida(ids.tz) ? ids.tz : (zonaValida(tz) ? tz : "");
  if (!fuso) return falhaMb("fuso_desconhecido");
  return { ok: true, ids, tz: fuso, conn: conexaoDoSite(env, r.creds, ids.site_id) };
}

// Disponibilidade REAL do MindBody, em inícios reserváveis, no fuso do site.
//   args: { service_id, location_id?, professional_id?, tz, dias?, dia?, ignorarAgendamento?, duracaoMin? }
//   → { handled:true, ok:true, slots:[{ start(ISO UTC), local, pro, location, staff_id,
//        mb_location_id, session_type_id, site_id, duration_min }], tz, grade }
async function mbAvailability(env, r, args) {
  const a = alvoMindbody(env, r, args);
  if (!a.ok) return a;
  const { ids, tz, conn } = a;
  const agora = Date.now();
  const dias = Math.min(Math.max(Number(args.dias) || 14, 1), 31);
  // pedido que já veio como instante ISO (`quando`) → só o dia dele, no fuso do site: menos
  // chamadas e resposta mais rápida no meio da ligação
  const umDia = /^\d{4}-\d{2}-\d{2}$/.test(String(args.dia || "")) ? String(args.dia) : diaDoPedido(args.quando, tz);
  const inicio = umDia || diaLocal(agora, tz);
  const fim = umDia || diaLocal(agora + dias * 864e5, tz);

  const [jan, ast] = await Promise.all([
    janelasReservaveis(env, conn, { sessionTypeId: ids.session_type_id, inicio, fim, locationId: ids.location_id, staffId: ids.staff_id, ignorarAgendamento: args.ignorarAgendamento }),
    horariosDeSessao(env, conn, ids.session_type_id),
  ]);
  if (!jan.ok) return daApi(jan, "disponibilidade");
  // Os horários ativos dizem EM QUE MINUTOS o site deixa começar uma sessão. Se essa leitura
  // falhar, a disponibilidade continua valendo (as janelas vieram) e os inícios saem de 30 em 30
  // min a partir do começo da janela — e o resultado DIZ que usou a grade reserva.
  const ativos = ast.ok ? horariosAtivos(ast.itens).minutos : null;
  const usaAtivos = !!(ativos && ativos.size);
  const exp = expandirJanelas(jan.itens, {
    tz, duracaoMin: ids.duracao_min || args.duracaoMin || null,
    passoMin: Number(r.mapping && r.mapping.passo_min) || 30,
    minutosAtivos: usaAtivos ? ativos : null, agoraMs: agora, antecedenciaMin: 30,
  });
  if (!exp.ok) return falhaMb(exp.motivo === "fuso" ? "fuso_desconhecido" : "janelas_ilegiveis");
  // janelas vieram e NENHUMA deu para ler → isso não é "sem horário", é resposta que não entendi
  if (jan.itens.length && exp.descartadas === jan.itens.length) return falhaMb("janelas_ilegiveis", { detail: `${exp.descartadas} janela(s) sem data/profissional/duração legíveis` });
  const slots = exp.slots.map((s) => ({ ...s, site_id: ids.site_id, session_type_id: s.session_type_id ?? ids.session_type_id }));
  return { handled: true, ok: true, provider: "mindbody", slots, tz, site_id: ids.site_id, grade: usaAtivos ? "horarios_do_site" : "passo_reserva", janelas: jan.itens.length, ...(jan.truncado ? { truncado: true } : {}) };
}

const ehEmail = (s) => /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(String(s || "").trim());
const partirRef = (ref) => { const m = /^(-?\d+):(\d+)$/.exec(String(ref || "")); return m ? { site_id: m[1], id: Number(m[2]) } : null; };

// Grava/atualiza o espelho. O resultado é LIDO: espelho que não gravou vira alarme, porque sem
// ele o agendamento existe no MindBody e a Central (lembrete, no-show, cancelar por voz) não sabe.
async function espelhar(env, email, d) {
  const r = await mbRpc(env, "mb_mirror_upsert", {
    p_email: email, p_external_ref: d.external_ref, p_service_id: d.service_id || null, p_location_id: d.location_id || null,
    p_start: d.start, p_end: d.end, p_name: (d.name || "").toString(), p_contact: (d.contact || "").toString(), p_attributes: d.attributes || {},
  });
  const ok = r.ok && r.data && r.data.ok === true;
  if (!ok) {
    await emitFailure(env, "mindbody_espelho_nao_gravou", email, `agendamento ${d.external_ref} existe no MindBody mas NÃO entrou na Central (${r.ok ? (r.data && r.data.motivo) || "sem ok" : r.reason})`, { ref: d.external_ref }).catch(() => {});
    return { ok: false, motivo: r.ok ? (r.data && r.data.motivo) || "sem_ok" : r.reason };
  }
  return { ok: true, id: r.data.id || null };
}

// Agenda NO MindBody o slot que veio de mbAvailability.
//   args: { slot, service_id, location_id?, professional_id?, tz, name, contact, email, request_id, notes }
async function mbBook(env, email, r, args) {
  const a = alvoMindbody(env, r, args);
  if (!a.ok) return a;
  const { ids, tz, conn } = a;
  const slot = args.slot || {};
  const inst = localParaInstante(slot.local, tz);
  // o slot tem que ser um início REAL: hora local + profissional + unidade vindos do MindBody
  if (!inst.ok || slot.staff_id == null) return falhaMb("horario_nao_resolvido");
  const locationId = slot.mb_location_id != null ? slot.mb_location_id : ids.location_id;
  if (locationId == null) return falhaMb("unidade_sem_par");

  const contato = (args.contact || "").toString().trim();
  const pessoa = { nome: (args.name || "").toString(), telefone: ehEmail(contato) ? "" : contato, email: ehEmail(args.email) ? String(args.email).trim() : (ehEmail(contato) ? contato : "") };
  // Índice local (importação): dica de quais Client.Id já têm este telefone/e-mail. É só dica —
  // quem confirma é o MindBody — e sem ela a busca segue pelos caminhos documentados.
  const dica = await mbRpc(env, "mb_client_ids", { p_email: email, p_site_id: ids.site_id, p_phone: pessoa.telefone, p_contact_email: pessoa.email });
  const cli = await acharOuCriarCliente(env, conn, { ...pessoa, idsConhecidos: dica.ok && Array.isArray(dica.data) ? dica.data : [] });
  if (!cli.ok) return daApi(cli, "cliente");

  const chave = `${email}|${(args.request_id || "").toString().trim() || `${contato || pessoa.nome}|${args.service_id}|${slot.local}`}`;
  const ag = await agendarUmaVez(env, conn, {
    clientId: cli.client_id, sessionTypeId: slot.session_type_id ?? ids.session_type_id, staffId: slot.staff_id, locationId,
    inicioLocal: slot.local, staffPedido: !!args.professional_id, chave,
    notas: `Booked by Gui (Guileo)${args.notes ? ` — ${String(args.notes).slice(0, 300)}` : ""}`,
  });
  if (!ag.ok) return daApi(ag, "agendamento");

  // O horário que vale é o que o MindBody CONFIRMOU (se devolveu); senão, o que pedimos.
  const ap = ag.appointment || {};
  const iniLocal = ap.StartDateTime || slot.local;
  const dur = Number(ap.Duration) > 0 ? Number(ap.Duration) : (Number(slot.duration_min) || 60);
  const fimLocal = ap.EndDateTime || somarMinutosLocais(iniLocal, dur);
  const ini = localParaInstante(iniLocal, tz), fim = localParaInstante(fimLocal, tz);
  const external_ref = `${ids.site_id}:${ag.appointment_id}`;
  const esp = await espelhar(env, email, {
    external_ref, service_id: args.service_id, location_id: args.location_id || null,
    start: ini.ok ? ini.iso : inst.iso, end: fim.ok ? fim.iso : new Date((ini.ok ? ini.ms : inst.ms) + dur * 60000).toISOString(),
    name: args.name, contact: contato,
    // `extra` (2026-10-07, op add_service): o elo com o agendamento-pai entra no espelho. Só um
    // objeto simples, e as chaves do próprio espelho (origin/pro/location/mb) vencem — o extra
    // nunca reescreve onde o agendamento mora.
    attributes: { ...(args.attributes && typeof args.attributes === "object" && !Array.isArray(args.attributes) ? args.attributes : {}),
      origin: "mindbody", pro: slot.pro || "", location: slot.location || "", staff_pedido: !!args.professional_id,
      mb: { site_id: ids.site_id, appointment_id: ag.appointment_id, client_id: cli.client_id, session_type_id: slot.session_type_id ?? ids.session_type_id, staff_id: slot.staff_id, location_id: locationId, tz } },
  });
  await mbRpc(env, "mb_client_put", { p_email: email, p_site_id: ids.site_id, p_mb_client_id: cli.client_id, p_phone: pessoa.telefone, p_contact_email: pessoa.email, p_name: pessoa.nome });
  return {
    handled: true, ok: true, provider: "mindbody",
    external_ref, ref_falado: String(ag.appointment_id), appointment_id: esp.ok ? esp.id : null,
    start: ini.ok ? ini.iso : inst.iso, tz, reutilizado: !!ag.reutilizado, cliente_criado: !!cli.criado, espelho: esp.ok,
  };
}

// O agendamento (id da Guileo) é espelho do MindBody?
//   { handled:false }                     não é — o motor interno resolve
//   { handled:true, ok:true, mirror }     é: { id, site_id, mb_id, service_id, location_id, start, attributes }
//   { handled:true, ok:false, reason }    não deu para saber → NÃO mexe em nada
export async function mirrorOf(env, email, resolved, appointmentId) {
  if (!resolved || resolved.provider !== "mindbody") return { handled: false };
  if (!resolved.ready) return falhaMb(resolved.reason || "mindbody_indisponivel", { detail: resolved.detail || "" });
  const r = await mbRpc(env, "mb_mirror_get", { p_email: email, p_appointment_id: appointmentId });
  if (!r.ok) return falhaMb("espelho_ilegivel", { detail: r.reason });
  const d = r.data || {};
  if (!d.found || d.source !== "mindbody" || !d.external_ref) return { handled: false };
  const ref = partirRef(d.external_ref);
  if (!ref) return falhaMb("espelho_sem_site", { detail: "external_ref fora do formato site:id" });
  if (!sitesDoTenant(resolved.creds).includes(ref.site_id)) return falhaMb("site_nao_conectado", { detail: `site ${ref.site_id}` });
  return { handled: true, ok: true, mirror: { id: d.id, site_id: ref.site_id, mb_id: ref.id, external_ref: d.external_ref, service_id: d.service_id, location_id: d.location_id, start: d.start, end: d.end, name: d.customer_name || "", contact: d.customer_contact || "", attributes: d.attributes || {} } };
}

// ── cancel ───────────────────────────────────────────────────────────────────
// Cancela NO MindBody. O espelho local é cancelado por quem chama (biz_cancel), só depois do ok.
export async function cancel(env, email, resolved, args) {
  const m = args.mirror ? { handled: true, ok: true, mirror: args.mirror } : await mirrorOf(env, email, resolved, args.appointment_id);
  if (!m.handled || !m.ok) return m;
  const conn = conexaoDoSite(env, resolved.creds, m.mirror.site_id);
  const c = await cancelarAgendamento(env, conn, m.mirror.mb_id);
  if (!c.ok) return daApi(c, "cancelamento");
  return { handled: true, ok: true, provider: "mindbody", external_ref: m.mirror.external_ref, status: c.status };
}

// ── reschedule ───────────────────────────────────────────────────────────────
// Dois passos, para o chamador resolver a fala entre eles:
//   rescheduleOptions(mirror)        → a disponibilidade real para a MESMA sessão (o próprio
//                                       agendamento não conta como ocupado)
//   reschedule(mirror, slot)         → move no MindBody e atualiza o espelho
export async function rescheduleOptions(env, email, resolved, args) {
  const mi = args.mirror;
  const mb = (mi.attributes && mi.attributes.mb) || {};
  const tz = zonaValida(mb.tz) ? mb.tz : args.tz;
  const pedido = !!(mi.attributes && mi.attributes.staff_pedido);
  return mbAvailability(env, resolved, {
    service_id: mi.service_id, location_id: mi.location_id || null, professional_id: null, tz,
    // os ids do MindBody gravados no espelho; quem pediu um profissional pelo nome continua com
    // ele, senão qualquer um livre para a mesma sessão serve
    direto: mb.session_type_id != null ? { site_id: mi.site_id, session_type_id: mb.session_type_id, location_id: mb.location_id ?? null, staff_id: pedido ? (mb.staff_id ?? null) : null, tz } : null,
    dias: args.dias, dia: args.dia, ignorarAgendamento: mi.mb_id,
  });
}
export async function reschedule(env, email, resolved, args) {
  const mi = args.mirror, slot = args.slot || {};
  if (!resolved || resolved.provider !== "mindbody" || !resolved.ready) return falhaMb((resolved && resolved.reason) || "mindbody_indisponivel");
  const mb = (mi.attributes && mi.attributes.mb) || {};
  const tz = zonaValida(slot.tz) ? slot.tz : (zonaValida(mb.tz) ? mb.tz : args.tz);
  const inst = localParaInstante(slot.local, tz);
  if (!inst.ok || slot.staff_id == null) return falhaMb("horario_nao_resolvido");
  const conn = conexaoDoSite(env, resolved.creds, mi.site_id);
  const trocaStaff = mb.staff_id != null && Number(mb.staff_id) !== Number(slot.staff_id);
  const rr = await remarcarAgendamento(env, conn, mi.mb_id, { inicioLocal: slot.local, ...(trocaStaff || mb.staff_id == null ? { staffId: slot.staff_id } : {}) });
  if (!rr.ok) return daApi(rr, "remarcacao");
  const ap = rr.appointment || {};
  const iniLocal = ap.StartDateTime || slot.local;
  const dur = Number(ap.Duration) > 0 ? Number(ap.Duration) : (Number(slot.duration_min) || 60);
  const ini = localParaInstante(iniLocal, tz), fim = localParaInstante(ap.EndDateTime || somarMinutosLocais(iniLocal, dur), tz);
  const start = ini.ok ? ini.iso : inst.iso;
  const esp = await espelhar(env, email, {
    external_ref: mi.external_ref, service_id: mi.service_id, location_id: mi.location_id,
    start, end: fim.ok ? fim.iso : new Date(Date.parse(start) + dur * 60000).toISOString(), name: "", contact: "",
    attributes: { pro: slot.pro || "", mb: { ...mb, staff_id: slot.staff_id, tz } },
  });
  return { handled: true, ok: true, provider: "mindbody", external_ref: mi.external_ref, start, tz, espelho: esp.ok };
}

// ── O QUE A AGENTE FALA QUANDO A AGENDA EXTERNA NÃO RESPONDE ─────────────────
// Nunca "não tem horário" (não sabemos) e nunca horário do motor interno (não é a agenda do
// negócio). A verdade: não consigo ver a agenda agora — deixa o recado que a equipe retorna.
const FALA_EXTERNA = {
  nao_vejo: {
    en: "I'm not able to see the calendar right now, so I can't confirm a time this minute. Let me take your name and the best number, and the team will call you back to book it.",
    pt: "Não estou conseguindo ver a agenda agora, então não consigo confirmar um horário neste minuto. Me passa seu nome e o melhor telefone que a equipe te retorna para marcar.",
    es: "Ahora mismo no puedo ver la agenda, así que no puedo confirmar un horario en este momento. Deme su nombre y el mejor teléfono y el equipo le llama para agendar.",
    hi: "अभी मैं कैलेंडर नहीं देख पा रही हूँ, इसलिए इस समय कोई समय पक्का नहीं कर सकती। अपना नाम और सही नंबर बता दीजिए, टीम आपको कॉल करके बुक कर देगी।",
  },
  nao_cancelei: {
    en: "I couldn't reach the calendar to cancel that just now. I'll pass your cancellation to the team and they'll confirm it with you.",
    pt: "Não consegui acessar a agenda para cancelar agora. Vou passar o seu cancelamento para a equipe e eles confirmam com você.",
    es: "No pude acceder a la agenda para cancelar ahora. Le paso su cancelación al equipo y ellos se lo confirman.",
    hi: "अभी रद्द करने के लिए कैलेंडर तक नहीं पहुँच पाई। मैं आपका अनुरोध टीम को दे रही हूँ, वे आपसे पुष्टि करेंगे।",
  },
  nao_remarquei: {
    en: "I couldn't reach the calendar to move that just now. I'll pass your request to the team and they'll confirm the new time with you.",
    pt: "Não consegui acessar a agenda para remarcar agora. Vou passar o seu pedido para a equipe e eles confirmam o novo horário com você.",
    es: "No pude acceder a la agenda para cambiar la cita ahora. Le paso su solicitud al equipo y ellos le confirman el nuevo horario.",
    hi: "अभी समय बदलने के लिए कैलेंडर तक नहीं पहुँच पाई। मैं आपका अनुरोध टीम को दे रही हूँ, वे नया समय आपसे पक्का करेंगे।",
  },
};
export function falaAgendaExterna(tipo, lang) {
  const L = ["pt", "es", "hi"].includes(String(lang || "").slice(0, 2)) ? String(lang).slice(0, 2) : "en";
  const t = FALA_EXTERNA[tipo] || FALA_EXTERNA.nao_vejo;
  return t[L] || t.en;
}
// "2026-10-01T13:00:00Z" + fuso → o dia local, para a busca de um pedido que já veio em ISO.
export function diaDoPedido(quando, tz) {
  const s = String(quando || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(s) || !zonaValida(tz)) return null;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? (instanteParaLocal(ms, tz) || "").slice(0, 10) || null : null;
}

// ═════════════════════════════════════════════════════════════════════════════
// SQUARE (inalterado)
// ═════════════════════════════════════════════════════════════════════════════
// Resolve a spoken service name → the provider's own service id, using a name→id map the tenant
// stored at connect time (honest: no map / no match → null → caller falls back to internal).
function mapServiceId(creds, serviceName) {
  const map = creds && typeof creds === "object"
    ? (creds.service_map || creds.session_types || creds.services || null)
    : null;
  if (!map || typeof map !== "object") return null;
  const n = norm(serviceName);
  for (const k of Object.keys(map)) {
    if (norm(k) === n || norm(k).includes(n) || n.includes(norm(k))) return map[k];
  }
  return null;
}

// POST to a same-origin connector endpoint with the tenant's connection key. Returns parsed JSON
// or null on any transport error.
async function callConnector(origin, path, key, email, payload) {
  try {
    const r = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token: key, ...payload }),
    });
    return await r.json().catch(() => null);
  } catch { return null; }
}

// ── getAvailability ──────────────────────────────────────────────────────────
// MINDBODY args: { service_id, location_id?, professional_id?, tz, dias?, dia?, ignorarAgendamento? }
//   → sempre handled:true (ver topo do arquivo).
// SQUARE args:   { origin, service, location_id, professional_id, start, end }
//   { handled:true, slots:[…] } | { handled:false, reason } → internal
export async function getAvailability(env, email, resolved, args) {
  const r = resolved || (await resolveScheduler(env, email));
  if (r.provider === "mindbody") return mbAvailability(env, r, args || {});
  if (r.provider === "internal" || !r.ready) return { handled: false, reason: r.reason || "internal" };
  const key = await tenantKey(env, email);
  if (!key) return { handled: false, reason: "no-tenant-key" };
  const origin = args.origin;
  const start = args.start || new Date().toISOString();
  const end = args.end || new Date(Date.now() + 14 * 864e5).toISOString();

  if (r.provider === "square") {
    const sid = mapServiceId(r.creds, args.service);
    if (!sid) return { handled: false, reason: "no-service-map" };
    const d = await callConnector(origin, "/api/square-appointments", key, email, {
      action: "availability", service_variation_id: sid, team_member_id: args.professional_id || undefined, start, end,
    });
    if (!d || d.ready === false || d.ok === false) return { handled: false, reason: "square-down" };
    const slots = (d.availabilities || []).map((a) => {
      const seg = (a.appointment_segments || [])[0] || {};
      return { start: a.start_at, pro: seg.team_member_id || "", location: a.location_id || "", pro_id: seg.team_member_id || null, location_id: a.location_id || null };
    }).filter((s) => s.start);
    return { handled: true, slots };
  }

  return { handled: false, reason: "unrouted" };
}

// ── book ─────────────────────────────────────────────────────────────────────
// MINDBODY args: { slot, service_id, location_id?, professional_id?, tz, name, contact, email, request_id, notes, attributes? }   (attributes = extras do espelho, ex.: elo do add-on)
//   → sempre handled:true.
// SQUARE args:   { origin, service, location_id, professional_id, start, name, contact, duration_min, mirror }
export async function book(env, email, resolved, args) {
  const r = resolved || (await resolveScheduler(env, email));
  if (r.provider === "mindbody") return mbBook(env, email, r, args || {});
  if (r.provider === "internal" || !r.ready) return { handled: false, reason: r.reason || "internal" };
  const key = await tenantKey(env, email);
  if (!key) return { handled: false, reason: "no-tenant-key" };
  const origin = args.origin;
  const [first, ...rest] = (args.name || "Guest").toString().trim().split(/\s+/);
  const client = { first: first || "Guest", last: rest.join(" ") || ".", name: args.name || "", phone: /^[0-9+]/.test((args.contact || "")) ? args.contact : "", email: /.+@.+\..+/.test(args.contact || "") ? args.contact : "" };

  if (r.provider === "square") {
    const sid = mapServiceId(r.creds, args.service);
    if (!sid) return { handled: true, ok: false, needsFrontdesk: true, reason: "no-service-map" };
    const d = await callConnector(origin, "/api/square-appointments", key, email, {
      action: "book", client, service_variation_id: sid, team_member_id: args.professional_id || undefined,
      duration_minutes: args.duration_min || undefined, start: args.start,
    });
    if (!d || d.ready === false) return { handled: true, ok: false, needsFrontdesk: true, reason: "square-down" };
    if (d.ok !== true) return { handled: true, ok: false, reason: d.note || "square-rejected", raw: d };
    const ref = (d.booking && d.booking.id) || null;
    await mirrorExternalBooking(env, email, "square", { external_ref: ref, service: args.service, start: args.start, duration_min: args.duration_min, name: args.name, contact: args.contact, location_id: args.location_id, pro: args.mirror?.pro, location: args.mirror?.location });
    return { handled: true, ok: true, external_ref: ref, raw: d };
  }

  return { handled: false, reason: "unrouted" };
}

// ── mirrorExternalBooking (Square) ─────────────────────────────────────────────
// SCHED-gated RPC `biz_mirror_external` (db/schedule_adapter.sql). Best-effort.
// O MindBody NÃO usa isto: o espelho dele é `espelhar()` acima, com resultado conferido.
export async function mirrorExternalBooking(env, email, provider, data) {
  try {
    const startMs = Date.parse(data.start);
    const endIso = isFinite(startMs) ? new Date(startMs + (data.duration_min || 60) * 60000).toISOString() : null;
    await sbRpc("biz_mirror_external", {
      p_secret: env.SCHED_SECRET || "", p_email: email, p_provider: provider,
      p_external_ref: (data.external_ref || "").toString().slice(0, 200),
      p_service: (data.service || "").toString(), p_start: data.start, p_end: endIso,
      p_name: (data.name || "").toString(), p_contact: (data.contact || "").toString(),
      p_location_id: data.location_id || null,
      p_attributes: { pro: data.pro || "", location: data.location || "", origin: provider },
    });
  } catch { /* mirror is best-effort — the external booking already stands */ }
}
