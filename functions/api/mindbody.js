// Cloudflare Pages Function — POST /api/mindbody · conector MINDBODY (Public API v6)
// ─────────────────────────────────────────────────────────────────────────────
// Reescrito em 2026-09-30 em cima de três bibliotecas:
//   functions/lib/mindbodyApi.js    cliente da API (token em cache, paginação, falha com motivo)
//   functions/lib/mindbodyTempo.js  hora local do site ↔ instante real; janelas → inícios
//   functions/lib/mindbodyMapa.js   serviço/unidade/profissional da Guileo ↔ ids do MindBody
// e do roteador functions/lib/scheduleAdapter.js (as operações de agenda moram LÁ — este arquivo
// não tem uma segunda cópia de "como agendar").
//
// ESTADOS (o que `status` devolve em `estado`):
//   sem_chave        MINDBODY_API_KEY não está no ambiente — passo NOSSO
//   nao_conectado    o negócio ainda não informou site + login
//   falta_login      há site do negócio gravado sem login (ninguém conectou aquele site ainda)
//   login_recusado   o MindBody recusou o login de algum site
//   sem_mapa         conectado, mas o mapa de serviços não foi salvo → a Gui SEGUE no motor interno
//   ativo            mapa salvo: a Gui lê e agenda no MindBody
//
// DOIS PORTÕES
//   1) PORTAL (dono do negócio): e-mail + chave de conexão via get_client_data — idêntico ao que
//      sempre foi. Ações: status · connect · activation · catalog · save_mapping · availability ·
//      book · cancel · reschedule · import_clients.
//   2) SERVIDOR: cabeçalho `x-guileo-secret` = INGEST_SECRET (nunca em URL). Mesmas ações, com o
//      e-mail do tenant no corpo, mais `sync` (sincronização de volta; sem e-mail = todos os
//      tenants com a integração ligada).
//      A sincronização também aceita o formato dos alvos do cron-tick:
//        POST /api/mindbody?sync=1&token=<DIGEST_TOKEN>      ← SÓ a ação sync, nada além dela.
//
// SEGREDO: a senha do login MindBody entra por `connect`, vai para o banco (service_role) e nunca
// volta em resposta nenhuma. Nenhuma resposta deste arquivo carrega credencial, token ou chave.
//
// FORMA DAS RESPOSTAS: sucesso `{ ok:true, … }`. Falha NOSSA ou do MindBody
// `{ ok:false, motivo, detalhe_tecnico }` (HTTP 200 — a tela lê o corpo). Recusa de negócio
// (`login_recusado`, `fuso_obrigatorio`…) vem com `ok` e o estado, sem `detalhe_tecnico`.
// ─────────────────────────────────────────────────────────────────────────────
import { json, safeEq } from "../lib/guard.js";
import { emitFailure } from "../lib/failure.js";
import {
  resolveScheduler, lerConfigMindbody, sitesDoTenant, conexaoDoSite, mbRpc,
  getAvailability, book as adapterBook, cancel as adapterCancel, mirrorOf, rescheduleOptions, reschedule as adapterReschedule,
} from "../lib/scheduleAdapter.js";
import { obterToken, lerSite, listarSessionTypes, listarLocations, listarStaff, camposObrigatorios, codigoDeAtivacao, listarClientes, linhaDoCliente, estadoDosAgendamentos } from "../lib/mindbodyApi.js";
import { sugerirMapa, limparMapa, coberturaDoMapa } from "../lib/mindbodyMapa.js";
import { zonaValida, diaLocal, casarInstante, instanteParaLocal, localParaInstante, mesmoMinutoLocal, somarMinutosLocais } from "../lib/mindbodyTempo.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (fn, body) => fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });

const falhou = (motivo, detalhe, extra = {}) => json({ ok: false, motivo: String(motivo || "falhou"), detalhe_tecnico: String(detalhe || motivo || "").slice(0, 300), ...extra });
const daFalha = (r, extra = {}) => falhou(r.reason || r.motivo || "falhou", `${r.reason || ""}${r.code ? ` · ${r.code}` : ""}${r.status ? ` · HTTP ${r.status}` : ""}${r.detail ? ` · ${r.detail}` : ""}${r.etapa ? ` · etapa ${r.etapa}` : ""}`, { ...(r.horario_tomado ? { horario_tomado: true } : {}), ...extra });
const mapaLigado = (m) => !!(m && m.ativo === true && m.services && Object.keys(m.services).length);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOuNull = (v) => (UUID.test(String(v || "")) ? String(v) : null);

// ── catálogo dos dois lados (tela de mapa e conferência do que a tela manda gravar) ──────────
async function carregarCatalogo(env, email, cfg) {
  const sites = sitesDoTenant(cfg.creds);
  const g = await mbRpc(env, "mb_guileo_catalog", { p_email: email });
  if (!g.ok) return { ok: false, reason: g.reason, detail: g.detail, etapa: "catalogo_guileo" };
  const guileo = { services: g.data?.services || [], locations: g.data?.locations || [], professionals: g.data?.professionals || [] };
  const tzsGuileo = [...new Set(guileo.locations.map((l) => l.tz).filter(zonaValida))];

  const lidos = await Promise.all(sites.map(async (site_id) => {
    const conn = conexaoDoSite(env, cfg.creds, site_id);
    const [site, tipos, locs, staff, campos] = await Promise.all([
      lerSite(env, conn), listarSessionTypes(env, conn), listarLocations(env, conn), listarStaff(env, conn), camposObrigatorios(env, conn),
    ]);
    // qualquer leitura do catálogo que falhe derruba o catálogo do site: mapa montado em cima de
    // meia lista gravaria "sem par" para um serviço que existe
    for (const [nome, r] of [["site", site], ["sessiontypes", tipos], ["locations", locs], ["staff", staff]]) {
      if (!r.ok) return { ok: false, site_id, reason: r.reason, detail: r.detail, status: r.status, code: r.code, etapa: nome };
    }
    const salvo = cfg.mapping && cfg.mapping.sites && cfg.mapping.sites[site_id] ? cfg.mapping.sites[site_id].tz : "";
    // Fuso do site: o que o MindBody informa, se for um nome IANA; senão o já salvo; senão o das
    // unidades da Guileo quando todas concordam. Não existe "padrão Nova York" escondido aqui.
    const tz = zonaValida(site.site.tz) ? site.site.tz : (zonaValida(salvo) ? salvo : (tzsGuileo.length === 1 ? tzsGuileo[0] : ""));
    const tz_origem = zonaValida(site.site.tz) ? "mindbody" : (zonaValida(salvo) ? "salvo" : (tz ? "guileo" : ""));
    return {
      ok: true, site_id, nome: site.site.nome, tz, tz_origem, tz_mindbody: site.site.tz,
      locations: locs.itens, sessionTypes: tipos.itens, staff: staff.itens,
      campos_obrigatorios: campos.ok ? campos.campos : null, campos_erro: campos.ok ? "" : campos.reason,
    };
  }));
  const ruim = lidos.find((x) => !x.ok);
  if (ruim) return ruim;
  return { ok: true, guileo, mindbody: { sites: lidos } };
}

// ── SINCRONIZAÇÃO DE VOLTA ──────────────────────────────────────────────────────────────────
// Agendamento cancelado DENTRO do MindBody (na recepção) precisa cancelar o espelho — senão a
// Guileo manda lembrete e pedido de avaliação de uma visita que não existe mais.
//
// O que marca e o que NÃO marca:
//   · Status Cancelled / LateCancelled → espelho 'cancelled'
//   · Status NoShow                     → espelho 'no_show'
//   · horário diferente                 → espelho movido para o horário do MindBody
//   · agendamento que NÃO VEIO na resposta → só vira 'cancelled' se a MESMA consulta devolveu
//     pelo menos outro dos ids pedidos (controle positivo: prova que o filtro por id funciona) e
//     a leitura não foi truncada. Sem esse controle fica INCONCLUSIVO: nada é marcado, e vira
//     alarme. Cancelar em massa por causa de uma consulta que não respondeu direito seria pior
//     que não sincronizar.
async function sincronizarTenant(env, email) {
  const out = { email, conferidos: 0, cancelados: 0, no_show: 0, movidos: 0, iguais: 0, inconclusivos: 0, falhas: [] };
  const cfg = await lerConfigMindbody(env, email);
  if (!cfg.ok) { out.falhas.push({ etapa: "config", motivo: cfg.reason }); return out; }
  if (!mapaLigado(cfg.mapping) || !cfg.creds) { out.pulado = "integracao_desligada"; return out; }
  const pend = await mbRpc(env, "mb_mirror_pending", { p_email: email, p_limit: 1000 });
  if (!pend.ok || !Array.isArray(pend.data)) { out.falhas.push({ etapa: "espelhos", motivo: pend.ok ? "resposta_inesperada" : pend.reason }); return out; }

  const porSite = new Map();
  for (const m of pend.data) {
    const x = /^(-?\d+):(\d+)$/.exec(String(m.external_ref || ""));
    if (!x) continue;
    if (!porSite.has(x[1])) porSite.set(x[1], []);
    porSite.get(x[1]).push({ ...m, mb_id: Number(x[2]) });
  }
  const conectados = sitesDoTenant(cfg.creds);
  for (const [site_id, espelhos] of porSite) {
    const tz = cfg.mapping.sites && cfg.mapping.sites[site_id] ? cfg.mapping.sites[site_id].tz : "";
    if (!conectados.includes(site_id) || !zonaValida(tz)) { out.falhas.push({ etapa: "site", site_id, motivo: !zonaValida(tz) ? "fuso_desconhecido" : "site_nao_conectado" }); continue; }
    const conn = conexaoDoSite(env, cfg.creds, site_id);
    const inicio = diaLocal(Date.now() - 3 * 864e5, tz), fim = diaLocal(Date.now() + 180 * 864e5, tz);
    for (let i = 0; i < espelhos.length; i += 40) {
      const lote = espelhos.slice(i, i + 40);
      const est = await estadoDosAgendamentos(env, conn, { ids: lote.map((m) => m.mb_id), inicio, fim });
      if (!est.ok) { out.falhas.push({ etapa: "staffappointments", site_id, motivo: est.reason, detalhe: est.detail }); continue; }
      const controle = est.porId.size > 0 && !est.truncado;
      for (const m of lote) {
        out.conferidos++;
        const a = est.porId.get(m.mb_id);
        let marca = null;
        if (!a) {
          if (!controle) { out.inconclusivos++; continue; }
          marca = { status: "cancelled", mb_status: "Ausente" };
        } else if (a.Status === "Cancelled" || a.Status === "LateCancelled") marca = { status: "cancelled", mb_status: a.Status };
        else if (a.Status === "NoShow") marca = { status: "no_show", mb_status: a.Status };
        else {
          const localEspelho = instanteParaLocal(m.start, tz);
          if (a.StartDateTime && localEspelho && !mesmoMinutoLocal(a.StartDateTime, localEspelho)) {
            const ini = localParaInstante(a.StartDateTime, tz);
            const durMs = Math.max(5 * 60000, Date.parse(m.end) - Date.parse(m.start) || 0);
            const fimI = localParaInstante(a.EndDateTime || somarMinutosLocais(a.StartDateTime, durMs / 60000), tz);
            if (ini.ok) marca = { status: "booked", mb_status: String(a.Status || "Booked"), start: ini.iso, end: fimI.ok && fimI.ms > ini.ms ? fimI.iso : new Date(ini.ms + durMs).toISOString(), movido: true };
          }
        }
        if (!marca) { out.iguais++; continue; }
        const w = await mbRpc(env, "mb_mirror_mark", { p_email: email, p_external_ref: m.external_ref, p_status: marca.status, p_start: marca.start || null, p_end: marca.end || null, p_mb_status: marca.mb_status });
        if (!w.ok || !w.data || w.data.ok !== true) { out.falhas.push({ etapa: "gravar", ref: m.external_ref, motivo: w.ok ? "nao_gravou" : w.reason }); continue; }
        if (marca.movido) out.movidos++; else if (marca.status === "cancelled") out.cancelados++; else out.no_show++;
      }
    }
  }
  if (!out.falhas.length) await mbRpc(env, "mb_sync_done", { p_email: email });
  if (out.falhas.length || out.inconclusivos) {
    await emitFailure(env, "mindbody_sync_incompleta", email, `sincronização MindBody: ${out.falhas.length} falha(s), ${out.inconclusivos} inconclusivo(s) — lembretes podem sair para visitas canceladas lá`, { falhas: out.falhas.slice(0, 5) }).catch(() => {});
  }
  return out;
}

async function sincronizar(env, email) {
  let lista = email ? [email] : null;
  if (!lista) {
    const t = await mbRpc(env, "mb_tenants", {});
    if (!t.ok || !Array.isArray(t.data)) return json({ ok: false, motivo: t.ok ? "resposta_inesperada" : t.reason, detalhe_tecnico: t.detail || "mb_tenants" }, 503);
    lista = t.data.map(String).slice(0, 25);
  }
  const resultados = [];
  for (const e of lista) resultados.push(await sincronizarTenant(env, e));
  const comFalha = resultados.filter((r) => r.falhas.length).length;
  // 503 (com corpo) quando algo não sincronizou: o cron-tick avisa todo alvo não-2xx.
  return json({ ok: comFalha === 0, tenants: lista.length, com_falha: comFalha, resultados }, comFalha ? 503 : 200);
}

// ── HTTP ─────────────────────────────────────────────────────────────────────────────────────
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const url = new URL(request.url);

    // PORTÃO DE SERVIDOR — cabeçalho, nunca URL. E o formato do cron-tick, só para `sync`.
    const servidor = !!env.INGEST_SECRET && safeEq(request.headers.get("x-guileo-secret") || "", env.INGEST_SECRET);
    const cron = url.searchParams.get("sync") === "1" && !!env.DIGEST_TOKEN && safeEq(url.searchParams.get("token") || "", env.DIGEST_TOKEN);
    if (cron) {
      if (!env.MINDBODY_API_KEY) return json({ ok: true, pulado: "sem_chave" });
      return sincronizar(env, "");
    }

    const email = (b.email || "").toString().trim().toLowerCase();
    const action = (b.action || "status").toString();

    if (servidor) {
      if (action === "sync") {
        if (!env.MINDBODY_API_KEY) return json({ ok: true, pulado: "sem_chave" });
        return sincronizar(env, email.includes("@") ? email : "");
      }
      if (!email.includes("@")) return json({ error: "missing email" }, 400);
    } else {
      const key = (b.token || b.key || "").toString().trim();
      if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);
      // PER-TENANT GATE — email↔connection-key (get_client_data), identical to noshow-radar.js.
      const gd = await rpc("get_client_data", { p_email: email, p_key: key });
      if (!gd.ok) return json({ error: "unauthorized" }, 401);
      const gdj = await gd.json().catch(() => null);
      if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);
      if (action === "sync") return json({ error: "unauthorized" }, 401);
    }

    // `note` fica por compatibilidade com telas antigas em cache; a tela nova lê `estado`.
    if (!env.MINDBODY_API_KEY) return json({ ok: true, ready: false, estado: "sem_chave", note: "MindBody API key not set." });

    const cfg = await lerConfigMindbody(env, email);
    if (!cfg.ok) return daFalha(cfg, { etapa: "config" });
    const sites = sitesDoTenant(cfg.creds);

    // ── ACTIVATION: código + link para a DONA do site liberar o acesso (doc: "Accessing Business
    // Data From Mindbody"). Não precisa de conexão prévia — é o passo ANTES dela.
    if (action === "activation") {
      const site_id = (b.site_id || "").toString().trim();
      if (!/^-?\d+$/.test(site_id)) return json({ ok: false, estado: "site_invalido" });
      const a = await codigoDeAtivacao(env, site_id);
      if (!a.ok) return daFalha(a);
      return json({ ok: true, site_id, codigo: a.codigo, link: a.link });
    }

    // ── CONNECT: confere o login NO MindBody antes de gravar. Login recusado não é gravado.
    if (action === "connect") {
      const site_id = (b.site_id || "").toString().trim();
      const username = (b.source_name || "").toString().trim(), password = (b.source_password || "").toString();
      if (!/^-?\d+$/.test(site_id) || !username || !password) return json({ error: "missing site_id / credentials" }, 400);
      const conn = { site_id, username, password };
      const tok = await obterToken(env, conn, { forcar: true });
      if (!tok.ok) {
        if (tok.reason === "login_recusado") return json({ ok: true, connected: false, saved: false, estado: "login_recusado", codigo: tok.code || "" });
        return daFalha(tok, { connected: false, saved: false });
      }
      const site = await lerSite(env, conn);
      if (!site.ok && site.reason === "site_sem_acesso") return json({ ok: true, connected: false, saved: false, estado: "site_nao_ativado" });
      const nome = site.ok && site.site.nome ? site.site.nome : site_id;
      const primeiro = !cfg.creds || !sites.length;
      // login padrão do tenant: o primeiro que funcionou. Os outros sites tentam com ele antes de
      // pedir um login próprio (dono com o mesmo acesso nos dois sites é o caso comum).
      const semPadrao = primeiro || !String((cfg.creds || {}).source_name || "").trim() || !String((cfg.creds || {}).source_password || "");
      const g = await mbRpc(env, "mb_creds_save", { p_email: email, p_patch: {
        ...(primeiro ? { site_id } : {}),
        ...(semPadrao ? { source_name: username, source_password: password } : {}),
        site_ids: [site_id], sites: { [nome]: site_id }, logins: { [site_id]: { username, password } },
      } });
      // o detalhe de um erro do banco nunca pode carregar a senha que acabou de ser enviada
      const semSenha = (t) => String(t || "").split(password).join("•••");
      if (!g.ok || !g.data || g.data.ok !== true) return falhou(g.ok ? "nao_gravou" : g.reason, g.ok ? "mb_creds_save sem ok" : semSenha(g.detail), { connected: true, saved: false });
      return json({ ok: true, connected: true, saved: true, estado: mapaLigado(cfg.mapping) ? "ativo" : "sem_mapa", site: { id: site_id, nome, tz: site.ok ? site.site.tz : "" } });
    }

    if (!cfg.creds || !sites.length) return json({ ok: true, ready: false, estado: "nao_conectado" });

    // ── STATUS: o login de cada site (token em cache — não custa chamada quando já foi pedido).
    if (action === "status") {
      const logins = await Promise.all(sites.map(async (s) => {
        const t = await obterToken(env, conexaoDoSite(env, cfg.creds, s));
        return { site_id: s, ok: t.ok, motivo: t.ok ? "" : t.reason, codigo: t.ok ? "" : (t.code || "") };
      }));
      const rotulos = {};
      for (const s of sites) rotulos[(cfg.mapping && cfg.mapping.sites && cfg.mapping.sites[s] && cfg.mapping.sites[s].nome) || Object.keys(cfg.creds.sites || {}).find((k) => String(cfg.creds.sites[k]) === s) || s] = s;
      const loginOk = logins.every((l) => l.ok);
      const semLogin = logins.filter((l) => !l.ok && l.motivo === "sem_login").map((l) => l.site_id);
      const recusado = logins.some((l) => !l.ok && l.motivo === "login_recusado");
      const ativo = mapaLigado(cfg.mapping);
      // login que falhou por rede/MindBody fora não é "recusado": é leitura que não deu
      if (!loginOk && !recusado && !semLogin.length) return falhou(logins.find((l) => !l.ok).motivo, "não consegui conferir o login no MindBody", { sites: rotulos });
      return json({
        ok: true, provider: "mindbody", ready: loginOk, can_write: loginOk, stored: true, sites: rotulos, logins,
        // falta_login: um dos sites do negócio ainda não tem login (ex.: site gravado sem credencial)
        estado: semLogin.length ? "falta_login" : (!loginOk ? "login_recusado" : (ativo ? "ativo" : "sem_mapa")),
        sites_sem_login: semLogin,
        mapa: { ativo, servicos: Object.keys((cfg.mapping || {}).services || {}).length, salvo_em: (cfg.mapping || {}).salvo_em || null },
        sincronizado_em: cfg.synced_at,
      });
    }

    // ── CATALOG: os dois catálogos + a sugestão de mapa + o que já está salvo.
    if (action === "catalog") {
      const cat = await carregarCatalogo(env, email, cfg);
      if (!cat.ok) return daFalha(cat, { site_id: cat.site_id || "" });
      const sug = sugerirMapa(cat.guileo, cat.mindbody);
      return json({
        ok: true, guileo: cat.guileo,
        mindbody: { sites: cat.mindbody.sites.map((s) => ({
          site_id: s.site_id, nome: s.nome, tz: s.tz, tz_origem: s.tz_origem,
          locations: s.locations.map((l) => ({ id: l.Id, nome: String(l.Name || "") })),
          session_types: s.sessionTypes.map((t) => ({ id: t.Id, nome: String(t.Name || ""), tipo: String(t.Type || ""), duracao_min: Number(t.DefaultTimeLength) || null })),
          staff: s.staff.map((t) => ({ id: t.Id, nome: String(t.Name || [t.FirstName, t.LastName].filter(Boolean).join(" ") || t.DisplayName || "").trim() })),
          campos_obrigatorios: s.campos_obrigatorios, campos_erro: s.campos_erro,
        })) },
        sugestao: sug, salvo: cfg.mapping || null,
      });
    }

    // ── SAVE_MAPPING: confere cada par contra o catálogo REAL e só então grava (e liga).
    if (action === "save_mapping") {
      const cat = await carregarCatalogo(env, email, cfg);
      if (!cat.ok) return daFalha(cat, { site_id: cat.site_id || "" });
      const entrada = b.mapping && typeof b.mapping === "object" ? b.mapping : {};
      const { mapa, recusados } = limparMapa(entrada, cat.guileo, cat.mindbody);
      const usados = new Set(Object.values(mapa.services).map((s) => s.site_id));
      const semFuso = [];
      for (const s of cat.mindbody.sites) {
        const pedido = entrada.sites && entrada.sites[s.site_id] ? String(entrada.sites[s.site_id].tz || "").trim() : "";
        const tz = zonaValida(pedido) ? pedido : s.tz;
        mapa.sites[s.site_id] = { nome: s.nome, tz: zonaValida(tz) ? tz : "" };
        if (usados.has(s.site_id) && !zonaValida(tz)) semFuso.push(s.site_id);
      }
      if (!Object.keys(mapa.services).length) return json({ ok: false, estado: "mapa_vazio", recusados });
      if (semFuso.length) return json({ ok: false, estado: "fuso_obrigatorio", sites: semFuso, recusados });
      mapa.ativo = true; mapa.salvo_em = new Date().toISOString();
      if (cfg.mapping && Number(cfg.mapping.passo_min) > 0) mapa.passo_min = Number(cfg.mapping.passo_min);
      const g = await mbRpc(env, "mb_mapping_save", { p_email: email, p_mapping: mapa });
      if (!g.ok || !g.data || g.data.ok !== true) return falhou(g.ok ? (g.data && g.data.motivo) || "nao_gravou" : g.reason, g.ok ? "mb_mapping_save sem ok" : g.detail);
      return json({ ok: true, saved: true, estado: "ativo", recusados, faltando: coberturaDoMapa(mapa, cat.guileo), salvo: mapa });
    }

    // ── IMPORT_CLIENTS: em lotes retomáveis (a tela chama de novo com `proximo_offset`).
    if (action === "import_clients") {
      const site_id = (b.site_id || sites[0]).toString();
      if (!sites.includes(site_id)) return json({ ok: false, estado: "site_nao_conectado" });
      const offset = Math.max(0, Number(b.offset) || 0);
      const r = await listarClientes(env, conexaoDoSite(env, cfg.creds, site_id), { offset, maxPaginas: 3 });
      if (!r.ok) return daFalha(r, { site_id, offset });
      const linhas = r.itens.map(linhaDoCliente).filter(Boolean);
      const soma = { novos: 0, atualizados: 0, sem_contato: 0, erros: 0 };
      for (let i = 0; i < linhas.length; i += 200) {
        const w = await mbRpc(env, "mb_import_clients", { p_email: email, p_site_id: site_id, p_rows: linhas.slice(i, i + 200) });
        if (!w.ok || !w.data || w.data.ok !== true) return falhou(w.ok ? (w.data && w.data.motivo) || "nao_gravou" : w.reason, w.ok ? "mb_import_clients sem ok" : w.detail, { site_id, offset, parcial: soma });
        for (const k of Object.keys(soma)) soma[k] += Number(w.data[k]) || 0;
      }
      const idx = sites.indexOf(site_id);
      return json({ ok: true, site_id, lidos: r.itens.length, ...soma, total: r.total, proximo_offset: r.proximo_offset, fim: !r.truncado, proximo_site: !r.truncado && idx + 1 < sites.length ? sites[idx + 1] : "" });
    }

    // ── AGENDA pelo HTTP (prova no dia da ativação e chamadas servidor-a-servidor). A agente de
    // voz NÃO passa por aqui: agent-schedule.js chama o scheduleAdapter direto.
    if (["availability", "book", "cancel", "reschedule"].includes(action)) {
      const sc = await resolveScheduler(env, email);
      if (sc.provider !== "mindbody" || !sc.ready) return json({ ok: false, estado: sc.provider === "mindbody" ? "indisponivel" : "integracao_desligada", motivo: sc.reason });
      const alvo = { service_id: uuidOuNull(b.service_id), location_id: uuidOuNull(b.location_id), professional_id: uuidOuNull(b.professional_id), tz: "" };
      const enxuto = (s) => ({ start: s.start, local: s.local, pro: s.pro, location: s.location });

      if (action === "availability") {
        const av = await getAvailability(env, email, sc, { ...alvo, dias: b.days });
        if (!av.ok) return daFalha(av);
        return json({ ok: true, tz: av.tz, grade: av.grade, total: av.slots.length, slots: av.slots.slice(0, 40).map(enxuto) });
      }
      if (action === "book") {
        const dia = typeof b.start === "string" ? b.start.slice(0, 10) : "";
        const av = await getAvailability(env, email, sc, { ...alvo, dias: 31 });
        if (!av.ok) return daFalha(av);
        const slot = casarInstante(b.start, av.slots);   // exige instante com offset/Z
        if (!slot) return json({ ok: false, estado: "horario_indisponivel", pedido: dia, slots: av.slots.slice(0, 6).map(enxuto) });
        const r = await adapterBook(env, email, sc, { ...alvo, slot, name: (b.name || "").toString(), contact: (b.contact || "").toString(), email: (b.contact_email || "").toString(), request_id: (b.request_id || "").toString(), notes: (b.notes || "").toString() });
        if (!r.ok) return daFalha(r);
        return json({ ok: true, external_ref: r.external_ref, appointment_id: r.appointment_id, start: r.start, tz: r.tz, reutilizado: r.reutilizado, cliente_criado: r.cliente_criado, espelho: r.espelho });
      }
      const apptId = uuidOuNull(b.appointment_id);
      if (!apptId) return json({ error: "missing appointment_id" }, 400);
      const m = await mirrorOf(env, email, sc, apptId);
      if (!m.handled) return json({ ok: false, estado: "nao_e_espelho_mindbody" });
      if (!m.ok) return daFalha(m);
      if (action === "cancel") {
        const c = await adapterCancel(env, email, sc, { mirror: m.mirror });
        if (!c.ok) return daFalha(c);
        const w = await mbRpc(env, "mb_mirror_mark", { p_email: email, p_external_ref: m.mirror.external_ref, p_status: "cancelled", p_mb_status: c.status });
        return json({ ok: true, external_ref: m.mirror.external_ref, status: c.status, espelho: !!(w.ok && w.data && w.data.ok === true) });
      }
      const av = await rescheduleOptions(env, email, sc, { mirror: m.mirror, dias: 31 });
      if (!av.ok) return daFalha(av);
      const slot = casarInstante(b.start, av.slots);
      if (!slot) return json({ ok: false, estado: "horario_indisponivel", slots: av.slots.slice(0, 6).map(enxuto) });
      const r = await adapterReschedule(env, email, sc, { mirror: m.mirror, slot: { ...slot, tz: av.tz } });
      if (!r.ok) return daFalha(r);
      return json({ ok: true, external_ref: r.external_ref, start: r.start, tz: r.tz, espelho: r.espelho });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) { return json({ ok: false, motivo: "excecao", detalhe_tecnico: String(e && e.message || e).slice(0, 140) }, 400); }
}
