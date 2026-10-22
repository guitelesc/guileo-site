// functions/lib/mindbodyApi.js — CLIENTE DA PUBLIC API v6 DO MINDBODY.
//
// ESCRITO CONTRA A DOCUMENTAÇÃO OFICIAL (lida em 2026-09-30), não contra a API viva — este
// ambiente não tem chave. Fontes, para quem for conferir:
//   · OpenAPI:  https://api.mindbodyonline.com/public/v6/swagger/doc
//   · Portal:   https://developers.mindbodyonline.com/ui/documentation/public-api
//               (Pagination · Handling Dates and Times · Handling Errors · Request Deduplication)
// O que a documentação NÃO confirma está marcado com «NÃO VERIFICADO» no ponto exato do código.
//
// TRÊS REGRAS DESTE ARQUIVO
//   1) NADA LEVANTA. Toda função devolve { ok:true, … } ou { ok:false, status, reason, detail, code }.
//   2) FALHA NUNCA VIRA LISTA VAZIA. Página que falhou, campo que não veio, corpo ilegível → é
//      falha com motivo. "Não tem horário" só existe quando o MindBody respondeu 200 e disse isso.
//   3) SEGREDO NÃO SAI DAQUI. Senha, chave da plataforma e token não entram em `detail`, em log,
//      nem em resposta — `semSegredo()` apaga qualquer ocorrência antes de devolver.
import { mesmoMinutoLocal, partesLocais } from "./mindbodyTempo.js";

export const MB_BASE = "https://api.mindbodyonline.com/public/v6";
const TIMEOUT_MS = 9000;          // a ferramenta de voz não espera mais que isso por chamada
const LIMITE_PAGINA = 200;        // doc "Pagination": Default 100 · Maximum 200
const TOKEN_TTL_MAX = 23 * 3600;  // doc usertoken/issue: "Current lifetime: 24hrs"
const TOKEN_TTL_SEM_EXPIRES = 6 * 3600;

export const falha = (status, reason, detail = "", extra = {}) => ({ ok: false, status: Number(status) || 0, reason, detail: String(detail || "").slice(0, 300), ...extra });

// ── segredo fora de qualquer texto que sai ───────────────────────────────────────────────────
function semSegredo(texto, env, conn, token) {
  let s = String(texto == null ? "" : texto);
  for (const seg of [conn && conn.password, env && env.MINDBODY_API_KEY, token, env && env.MINDBODY_SOURCE_PASSWORD]) {
    const v = String(seg || "");
    if (v.length >= 4) s = s.split(v).join("•••");
  }
  return s;
}

async function sha(texto) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(texto)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

// ── CACHE: memória do isolate (L1) + KV quando existe (L2) ───────────────────────────────────
// O token de staff vale 24h; pedir um por chamada era 1 requisição paga a mais em TODA operação
// e o caminho mais curto para o 429. O valor guardado é um segredo: nunca é logado, e a chave do
// cache é um hash (não carrega usuário nem site legíveis).
const _mem = new Map();
export function _limparCacheDeTeste() { _mem.clear(); }
async function cacheLer(env, chave) {
  const m = _mem.get(chave);
  if (m && m.exp > Date.now()) return m.v;
  if (m) _mem.delete(chave);
  const kv = env && env.RATE_LIMIT;
  if (kv && typeof kv.get === "function") {
    try {
      const bruto = await kv.get(chave);
      if (bruto) {
        const o = JSON.parse(bruto);
        if (o && o.exp > Date.now()) { _mem.set(chave, o); return o.v; }
      }
    } catch { /* KV fora → segue sem cache; nunca derruba a chamada */ }
  }
  return null;
}
async function cacheGravar(env, chave, v, ttlSeg) {
  const ttl = Math.max(60, Math.floor(ttlSeg));
  const o = { v, exp: Date.now() + ttl * 1000 };
  _mem.set(chave, o);
  const kv = env && env.RATE_LIMIT;
  if (kv && typeof kv.put === "function") { try { await kv.put(chave, JSON.stringify(o), { expirationTtl: ttl }); } catch { /* idem */ } }
}
async function cacheApagar(env, chave) {
  _mem.delete(chave);
  const kv = env && env.RATE_LIMIT;
  if (kv && typeof kv.delete === "function") { try { await kv.delete(chave); } catch { /* idem */ } }
}

// ── A CHAMADA CRUA ───────────────────────────────────────────────────────────────────────────
// Cabeçalhos conforme a doc: `Api-Key`, `SiteId`, `authorization: {staffUserToken}` (o exemplo da
// doc manda o token CRU, sem "Bearer") e User-Agent com o nome do app (`-A '{yourAppName}'`).
// «NÃO VERIFICADO»: se a API viva exigir "Bearer ", basta MINDBODY_TOKEN_PREFIX="Bearer " no env.
// Parâmetros de consulta: o OpenAPI nomeia `request.limit`, `request.sessionTypeIds` etc., com
// listas em collectionFormat "multi" (chave repetida). É o que mandamos.
const MOTIVO_HTTP = (st) => (st === 401 || st === 403 ? "nao_autorizado" : st === 404 ? "nao_encontrado"
  : st === 409 ? "duplicado_em_andamento" : st === 429 ? "limite_de_chamadas" : st >= 500 ? "mindbody_fora" : "pedido_recusado");

export async function mbFetch(env, conn, req) {
  const e = env || {}, c = conn || {};
  if (!e.MINDBODY_API_KEY) return falha(0, "sem_chave_da_plataforma", "MINDBODY_API_KEY ausente");
  if (!req.semSite && !String(c.site_id || "").trim()) return falha(0, "sem_site", "site_id ausente");
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query || {})) {
    if (v == null || v === "") continue;
    if (Array.isArray(v)) { for (const x of v) if (x != null && x !== "") qs.append(k, String(x)); } else qs.append(k, String(v));
  }
  const url = `${MB_BASE}${req.path}${qs.toString() ? `?${qs}` : ""}`;
  const headers = { "Api-Key": e.MINDBODY_API_KEY, Accept: "application/json", "User-Agent": String(e.MINDBODY_APP_NAME || "Guileo") };
  if (!req.semSite) headers.SiteId = String(c.site_id).trim();
  if (req.token) headers.authorization = `${e.MINDBODY_TOKEN_PREFIX || ""}${req.token}`;
  if (req.body !== undefined) headers["Content-Type"] = "application/json";

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), req.timeoutMs || TIMEOUT_MS);
  let r, texto;
  try {
    r = await fetch(url, { method: req.method || "GET", headers, signal: ctl.signal, ...(req.body !== undefined ? { body: JSON.stringify(req.body) } : {}) });
    texto = await r.text();
  } catch (err) {
    const abortou = err && (err.name === "AbortError" || /abort/i.test(String(err.message || "")));
    return falha(0, abortou ? "tempo_esgotado" : "rede", semSegredo(abortou ? `sem resposta em ${req.timeoutMs || TIMEOUT_MS}ms` : String(err && err.message || err), e, c, req.token));
  } finally { clearTimeout(timer); }

  let data = null;
  if (texto) { try { data = JSON.parse(texto); } catch { data = null; } }
  if (!r.ok) {
    // doc "Handling Errors": { "Error": { "Message": "...", "Code": "ClientNotFound" } }
    const er = (data && data.Error) || {};
    const code = String(er.Code || "");
    const msg = er.Message || (data ? "" : String(texto || "").slice(0, 160));
    return falha(r.status, MOTIVO_HTTP(r.status), semSegredo(`${code ? `${code}: ` : ""}${msg || `HTTP ${r.status}`}`, e, c, req.token), { code });
  }
  if (data == null || typeof data !== "object") return falha(r.status, "resposta_ilegivel", "corpo vazio ou não-JSON num 2xx");
  return { ok: true, status: r.status, data };
}

// ── TOKEN DE STAFF (POST /usertoken/issue) ───────────────────────────────────────────────────
// Doc: "The username and password must belong to a staff, owner, or admin user that exists on the
// site in the SiteId header." 403 = credencial inválida ou staff não existe NAQUELE site
// (StaffMemberNotFound — "Do not retry with the same credentials").
// Resposta: { TokenType, AccessToken, Expires (UTC), User }.
// «NÃO VERIFICADO»: o atalho antigo de "source credentials" (_NomeDoSource + senha do source) não
// aparece na doc atual. O que a tela chama de "Source / API username" vai em Username como veio.
async function chaveDoToken(conn) { return `mb:tok:${await sha(`${conn.site_id}|${conn.username}`)}`; }

export async function obterToken(env, conn, opts = {}) {
  const c = conn || {};
  if (!String(c.username || "").trim() || !String(c.password || "")) return falha(0, "sem_login", "usuário/senha do MindBody não cadastrados");
  const chave = await chaveDoToken(c);
  if (!opts.forcar) {
    const guardado = await cacheLer(env, chave);
    if (guardado && guardado.token) return { ok: true, token: guardado.token, do_cache: true };
    // login recusado há menos de 1 min: não martela (cada tentativa é uma chamada paga e a doc
    // manda NÃO repetir com a mesma credencial)
    if (guardado && guardado.recusa) return falha(guardado.recusa.status, guardado.recusa.reason, guardado.recusa.detail, { code: guardado.recusa.code, do_cache: true });
  }
  const r = await mbFetch(env, c, { method: "POST", path: "/usertoken/issue", body: { Username: String(c.username), Password: String(c.password) } });
  if (!r.ok) {
    const f = (r.status === 401 || r.status === 403 || r.status === 400)
      ? falha(r.status, "login_recusado", r.detail, { code: r.code })
      : r;
    if (f.reason === "login_recusado") await cacheGravar(env, chave, { recusa: { status: f.status, reason: f.reason, detail: f.detail, code: f.code } }, 60);
    return f;
  }
  const token = String(r.data.AccessToken || "");
  if (!token) return falha(r.status, "token_ausente", "usertoken/issue respondeu 200 sem AccessToken");
  let ttl = TOKEN_TTL_SEM_EXPIRES;
  const exp = String(r.data.Expires || "");
  if (exp) {
    // "Token expiration in UTC" — sem designador, então lemos como UTC explicitamente.
    const ms = Date.parse(/(Z|[+-]\d{2}:?\d{2})$/i.test(exp) ? exp : `${exp}Z`);
    if (Number.isFinite(ms)) ttl = Math.floor((ms - Date.now()) / 1000) - 600;   // 10 min de folga
  }
  if (ttl > 60) await cacheGravar(env, chave, { token }, Math.min(ttl, TOKEN_TTL_MAX));
  return { ok: true, token, do_cache: false };
}

// Chamada autenticada. Com login cadastrado, SEMPRE vai com token (GET /client/clients exige, e
// GET /staff/staff devolve dados reduzidos sem ele). 401 com token do cache → pede um novo, uma vez.
export async function chamar(env, conn, req) {
  let token = null;
  if (String((conn || {}).username || "").trim()) {
    const t = await obterToken(env, conn);
    if (!t.ok) return t;
    token = t.token;
    const r = await mbFetch(env, conn, { ...req, token });
    if (r.ok || r.status !== 401 || !t.do_cache) return r;
    await cacheApagar(env, await chaveDoToken(conn));
    const t2 = await obterToken(env, conn, { forcar: true });
    if (!t2.ok) return t2;
    return mbFetch(env, conn, { ...req, token: t2.token });
  }
  return mbFetch(env, conn, req);
}

// ── GET PAGINADO ─────────────────────────────────────────────────────────────────────────────
// Doc "Pagination": limit (máx 200) + offset; a resposta traz
//   PaginationResponse { RequestedLimit, RequestedOffset, PageSize, TotalResults }.
// Anda pelo que VEIO (offset += itens da página), não pelo que pediu: se o servidor aplicar outro
// limite, a conta continua certa. Página com erro derruba a leitura inteira — meia lista lida
// como lista inteira é o defeito que esta função existe para impedir.
export async function paginar(env, conn, { path, query = {}, chave, porPagina = LIMITE_PAGINA, maxPaginas = 25, offsetInicial = 0 }) {
  const itens = []; let offset = Math.max(0, Number(offsetInicial) || 0), total = null, paginas = 0, primeiroAnterior = null;
  for (;;) {
    if (paginas >= maxPaginas) return { ok: true, itens, total, paginas, truncado: true, proximo_offset: offset };
    const r = await chamar(env, conn, { path, query: { ...query, "request.limit": porPagina, "request.offset": offset } });
    if (!r.ok) return { ...r, lidos_antes_da_falha: itens.length };
    const arr = r.data[chave];
    if (!Array.isArray(arr)) return falha(r.status, "resposta_inesperada", `a resposta de ${path} veio sem o campo ${chave}`);
    paginas++;
    const pg = r.data.PaginationResponse;
    total = pg && Number.isFinite(Number(pg.TotalResults)) ? Number(pg.TotalResults) : total;
    if (!arr.length) break;
    // servidor ignorando o offset devolveria a MESMA página para sempre
    const primeiro = JSON.stringify(arr[0]);
    if (paginas > 1 && primeiro === primeiroAnterior) return falha(r.status, "paginacao_ignorada", `${path} devolveu a mesma página duas vezes`);
    primeiroAnterior = primeiro;
    itens.push(...arr);
    offset += arr.length;
    if (total != null ? offset >= total : arr.length < porPagina) break;
  }
  return { ok: true, itens, total: total == null ? itens.length : total, paginas, truncado: false, proximo_offset: offset };
}

// ── LEITURAS TIPADAS ─────────────────────────────────────────────────────────────────────────
export const listarSessionTypes = (env, conn) => paginar(env, conn, { path: "/site/sessiontypes", chave: "SessionTypes" });
export const listarLocations = (env, conn) => paginar(env, conn, { path: "/site/locations", chave: "Locations" });
export const listarStaff = (env, conn) => paginar(env, conn, { path: "/staff/staff", chave: "StaffMembers" });

// GET /site/sites com UM SiteId devolve o detalhe do site — inclusive `TimeZone`.
export async function lerSite(env, conn) {
  const r = await chamar(env, conn, { path: "/site/sites", query: { "request.siteIds": [conn.site_id] } });
  if (!r.ok) return r;
  const lista = r.data.Sites;
  if (!Array.isArray(lista)) return falha(r.status, "resposta_inesperada", "site/sites veio sem o campo Sites");
  const s = lista.find((x) => String(x.Id) === String(conn.site_id)) || null;
  if (!s) return falha(r.status, "site_sem_acesso", "a chave da plataforma não enxerga este site (ativação pendente?)");
  return { ok: true, site: { id: s.Id, nome: String(s.Name || ""), tz: String(s.TimeZone || "") } };
}

// GET /client/requiredclientfields — o que o site EXIGE para criar um cliente. AddClient valida
// contra isso; se o site exigir endereço ou nascimento, a agente não consegue criar cliente novo
// só com nome+telefone, e a tela precisa dizer isso ANTES da primeira ligação.
export async function camposObrigatorios(env, conn) {
  const r = await chamar(env, conn, { path: "/client/requiredclientfields" });
  if (!r.ok) return r;
  if (!Array.isArray(r.data.RequiredClientFields)) return falha(r.status, "resposta_inesperada", "sem RequiredClientFields");
  return { ok: true, campos: r.data.RequiredClientFields.map(String) };
}

// GET /site/activationcode — código + link que a DONA do site usa para liberar o acesso.
// Doc: só funciona depois de o developer account ser aprovado para produção; um site por chamada.
// «NÃO VERIFICADO»: o OpenAPI lista só `authorization` como cabeçalho; o texto diz "one site per
// call", então mandamos o SiteId do site pedido.
export async function codigoDeAtivacao(env, siteId) {
  const r = await mbFetch(env, { site_id: siteId }, { path: "/site/activationcode" });
  if (!r.ok) return r;
  if (!r.data.ActivationCode && !r.data.ActivationLink) return falha(r.status, "resposta_inesperada", "sem ActivationCode/ActivationLink");
  return { ok: true, codigo: String(r.data.ActivationCode || ""), link: String(r.data.ActivationLink || "") };
}

// GET /appointment/bookableitems — JANELAS de disponibilidade (não horários). sessionTypeIds é
// obrigatório. startDate/endDate em data LOCAL do site. appointmentId "filters out the appointment
// with this ID" — é o que deixa uma remarcação enxergar o próprio horário como livre.
export function janelasReservaveis(env, conn, { sessionTypeId, inicio, fim, locationId, staffId, ignorarAgendamento }) {
  return paginar(env, conn, {
    path: "/appointment/bookableitems", chave: "Availabilities", maxPaginas: 15,
    query: {
      "request.sessionTypeIds": [sessionTypeId], "request.startDate": inicio, "request.endDate": fim,
      ...(locationId != null ? { "request.locationIds": [locationId] } : {}),
      ...(staffId != null ? { "request.staffIds": [staffId] } : {}),
      ...(ignorarAgendamento != null ? { "request.appointmentId": ignorarAgendamento } : {}),
    },
  });
}

// GET /appointment/activesessiontimes — "which increments services can be booked at". Lista de
// strings de hora-do-dia. «NÃO VERIFICADO»: o formato exato das strings (tratadas em
// mindbodyTempo.horariosAtivos, que aceita HH:mm, HH:mm:ss e data-base + hora).
// É configuração do site (muda raramente): resposta BOA fica 6h em cache. Falha nunca é guardada.
export async function horariosDeSessao(env, conn, sessionTypeId) {
  const chave = `mb:ast:${await sha(`${conn.site_id}|${sessionTypeId}`)}`;
  const g = await cacheLer(env, chave);
  if (g && Array.isArray(g.itens)) return { ok: true, itens: g.itens, do_cache: true };
  const r = await paginar(env, conn, { path: "/appointment/activesessiontimes", chave: "ActiveSessionTimes", query: { "request.sessionTypeIds": [sessionTypeId] }, maxPaginas: 5 });
  if (r.ok && r.itens.length) await cacheGravar(env, chave, { itens: r.itens }, 6 * 3600);
  return r;
}

// GET /appointment/staffappointments
export function agendamentos(env, conn, { inicio, fim, clientId, ids, staffIds }) {
  return paginar(env, conn, {
    path: "/appointment/staffappointments", chave: "Appointments", maxPaginas: 10,
    query: {
      "request.startDate": inicio, "request.endDate": fim,
      ...(clientId ? { "request.clientId": clientId } : {}),
      ...(Array.isArray(ids) && ids.length ? { "request.appointmentIds": ids } : {}),
      ...(Array.isArray(staffIds) && staffIds.length ? { "request.staffIds": staffIds } : {}),
    },
  });
}

// ── CLIENTES ─────────────────────────────────────────────────────────────────────────────────
// Mesma chave do banco (_gui_phone_key): só dígitos; 11 começando com 1 → os 10 finais.
export function chaveTelefone(s) {
  const d = String(s || "").replace(/\D/g, "");
  if (!d) return "";
  return d.length === 11 && d[0] === "1" ? d.slice(1) : d;
}
const emailLimpo = (s) => { const v = String(s || "").trim().toLowerCase(); return /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(v) ? v : ""; };

// O cliente É a pessoa? Só por telefone normalizado ou e-mail — nunca por nome.
export function clienteCasa(c, alvo) {
  if (!c) return null;
  const fones = [c.MobilePhone, c.HomePhone, c.WorkPhone].map(chaveTelefone).filter((x) => x.length >= 7);
  const porFone = !!alvo.fone && alvo.fone.length >= 7 && fones.includes(alvo.fone);
  const porEmail = !!alvo.email && emailLimpo(c.Email) === alvo.email;
  return porFone || porEmail ? { porFone, porEmail } : null;
}

// Cliente do MindBody → linha do CRM da Guileo (usada na importação).
export function linhaDoCliente(c) {
  if (!c || c.Id == null || String(c.Id) === "") return null;
  let nasc = null;
  const p = partesLocais(c.BirthDate);
  if (p && p.y >= 1900 && p.y <= new Date().getUTCFullYear()) nasc = `${p.y}-${String(p.mo).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
  const fone = [c.MobilePhone, c.HomePhone, c.WorkPhone].map((x) => String(x || "").trim()).find((x) => chaveTelefone(x).length >= 7) || "";
  return {
    mb_id: String(c.Id),
    nome: [c.FirstName, c.LastName].map((x) => String(x || "").trim()).filter((x) => x && x !== "." && x !== "-").join(" "),
    telefone: fone, email: emailLimpo(c.Email), nascimento: nasc,
    ativo: c.Active !== false,
    // consentimento vem do que a pessoa marcou NO MINDBODY; ausente = não consentiu
    aceita_sms: c.SendPromotionalTexts === true,
    aceita_email: c.SendPromotionalEmails === true,
  };
}

// GET /client/clients em páginas — a importação chama em lotes e retoma pelo offset.
export const listarClientes = (env, conn, { offset = 0, maxPaginas = 5 } = {}) =>
  paginar(env, conn, { path: "/client/clients", chave: "Clients", offsetInicial: offset, maxPaginas });

const buscaTexto = (env, conn, texto) =>
  paginar(env, conn, { path: "/client/clients", chave: "Clients", query: { "request.searchText": texto, "request.includeInactive": true }, maxPaginas: 2 });

/**
 * ACHA O CLIENTE — OU CRIA. Nunca escolhe pelo nome.
 *
 *   pessoa = { nome, telefone, email, idsConhecidos?: [Client.Id já visto no índice local] }
 *
 * Ordem:
 *   1) ids que o índice local (importação) já associa a este telefone/e-mail — conferidos no
 *      MindBody por GET /client/clients?clientIDs= (documentado, até 20 por chamada);
 *   2) searchText por e-mail (documentado: "Can include FirstName, LastName, and Email");
 *   3) searchText pelos dígitos do telefone — «NÃO VERIFICADO»: a doc NÃO lista telefone entre os
 *      campos pesquisados; se não achar nada, só custou uma chamada;
 *   4) searchText pelo nome — o nome serve para TRAZER candidatos; quem decide é o telefone/e-mail.
 * Em todas, só vale quem tem telefone normalizado OU e-mail IGUAL ao da pessoa.
 * Qualquer busca que FALHE interrompe tudo: criar cliente em cima de uma busca que não rodou é
 * como nasce o cadastro duplicado no sistema do spa.
 *
 * Devolve { ok:true, client_id, criado, por:"telefone"|"email", varios? } ou falha.
 */
export async function acharOuCriarCliente(env, conn, pessoa = {}) {
  const alvo = { fone: chaveTelefone(pessoa.telefone), email: emailLimpo(pessoa.email) };
  if (alvo.fone.length < 7) alvo.fone = "";
  if (!alvo.fone && !alvo.email) return falha(0, "sem_contato", "sem telefone nem e-mail não dá para identificar o cliente");
  const nome = String(pessoa.nome || "").trim().replace(/\s+/g, " ");
  const achados = new Map();   // Client.Id → { c, m }
  const guardar = (lista) => { for (const c of lista) { const m = clienteCasa(c, alvo); if (m && c.Id != null && String(c.Id) !== "") achados.set(String(c.Id), { c, m }); } };

  const ids = [...new Set((pessoa.idsConhecidos || []).map(String).filter(Boolean))].slice(0, 20);
  if (ids.length) {
    const r = await paginar(env, conn, { path: "/client/clients", chave: "Clients", query: { "request.clientIDs": ids, "request.includeInactive": true }, maxPaginas: 1 });
    if (!r.ok) return r;
    guardar(r.itens);
  }
  const consultas = [];
  if (alvo.email) consultas.push(alvo.email);
  if (alvo.fone) consultas.push(alvo.fone);
  if (nome) consultas.push(nome);
  for (const q of consultas) {
    if (achados.size) break;
    const r = await buscaTexto(env, conn, q);
    if (!r.ok) return r;
    guardar(r.itens);
  }

  if (achados.size) {
    const lista = [...achados.values()];
    const primeiroNome = nome.split(" ")[0].toLowerCase();
    // desempate SÓ entre quem já casou por telefone/e-mail: os dois canais batendo > ativo > nome igual
    lista.sort((a, b) => (Number(b.m.porFone && b.m.porEmail) - Number(a.m.porFone && a.m.porEmail))
      || (Number(b.c.Active !== false) - Number(a.c.Active !== false))
      || (Number(String(b.c.FirstName || "").toLowerCase() === primeiroNome) - Number(String(a.c.FirstName || "").toLowerCase() === primeiroNome)));
    const e = lista[0];
    return { ok: true, client_id: String(e.c.Id), criado: false, por: e.m.porFone ? "telefone" : "email", ...(lista.length > 1 ? { varios: lista.length } : {}) };
  }

  // ── criar ── doc AddClient: FirstName e LastName sempre obrigatórios; o site pode exigir mais
  // (GetRequiredClientFields). «NÃO VERIFICADO»: LastName "." para quem só disse o primeiro nome.
  const partes = (nome || "Guest").split(" ");
  const corpo = { FirstName: partes[0] || "Guest", LastName: partes.slice(1).join(" ") || ".", ...(pessoa.telefone ? { MobilePhone: String(pessoa.telefone) } : {}), ...(alvo.email ? { Email: alvo.email } : {}) };
  const r = await chamar(env, conn, { method: "POST", path: "/client/addclient", body: corpo });
  if (r.ok) {
    const id = r.data.Client && r.data.Client.Id;
    if (id == null || String(id) === "") return falha(r.status, "resposta_inesperada", "addclient respondeu 200 sem Client.Id");
    return { ok: true, client_id: String(id), criado: true, por: alvo.fone ? "telefone" : "email" };
  }
  // doc: duplicata = mesmo FirstName + LastName + Email → InvalidClientCreation. O registro que
  // já existe sai por GET /client/clientduplicates (casamento exato dos três campos).
  if (r.code === "InvalidClientCreation" && alvo.email) {
    const d = await paginar(env, conn, { path: "/client/clientduplicates", chave: "ClientDuplicates", query: { "request.firstName": corpo.FirstName, "request.lastName": corpo.LastName, "request.email": alvo.email }, maxPaginas: 1 });
    if (!d.ok) return d;
    const dup = d.itens.find((x) => emailLimpo(x.Email) === alvo.email && x.Id != null);
    if (dup) return { ok: true, client_id: String(dup.Id), criado: false, por: "email" };
  }
  if (r.code === "MissingRequiredFields" || r.code === "ValidationFailed") return falha(r.status, "cliente_campos_obrigatorios", r.detail, { code: r.code });
  return falha(r.status, "cliente_nao_criado", r.detail, { code: r.code });
}

// ── AGENDAR, SEM NUNCA AGENDAR DUAS VEZES ────────────────────────────────────────────────────
// A ElevenLabs re-tenta a ferramenta quando a resposta demora. A deduplicação do próprio MindBody
// só cobre pedidos idênticos ENQUANTO o primeiro ainda está em andamento (doc "Request
// Deduplication": depois que o primeiro termina, o repetido "is treated as new") — ou seja, ela
// NÃO protege do retry que chega 3 segundos depois. Três camadas aqui:
//   1) chave do pedido em cache (KV/memória): pedido já concluído devolve o MESMO agendamento;
//   2) antes de criar, lê a agenda do cliente naquele dia: mesma sessão no mesmo minuto = já existe;
//   3) 409 / timeout / 5xx no POST → relê a agenda antes de dizer que falhou.
// Se a leitura (2) falhar, NÃO cria: agendar sem ter conseguido olhar é o caminho da reserva dupla.
const CANCELADOS = new Set(["Cancelled", "LateCancelled"]);
// códigos (doc "Handling Errors") que significam "este horário não dá" — a agente oferece outro
const HORARIO_NAO_DA = new Set(["InvalidBookingTime", "SchedulingRestrictionsViolated", "SchedulingWindowViolated", "StaffIsInactive"]);

function mesmoAgendamento(a, p) {
  return a && !CANCELADOS.has(String(a.Status || "")) && String(a.ClientId) === String(p.clientId)
    && Number(a.SessionTypeId) === Number(p.sessionTypeId) && mesmoMinutoLocal(a.StartDateTime, p.inicioLocal);
}

export async function agendarUmaVez(env, conn, p, opts = {}) {
  for (const k of ["clientId", "sessionTypeId", "staffId", "locationId", "inicioLocal"]) {
    if (p[k] == null || p[k] === "") return falha(0, "pedido_incompleto", `falta ${k}`);
  }
  if (!partesLocais(p.inicioLocal)) return falha(0, "pedido_incompleto", "inicioLocal não é YYYY-MM-DDTHH:mm:ss");
  const chaveReq = `mb:req:${await sha(`${conn.site_id}|${p.chave || `${p.clientId}|${p.sessionTypeId}|${p.inicioLocal}`}`)}`;
  const feito = await cacheLer(env, chaveReq);
  if (feito && feito.appointment_id != null) return { ok: true, appointment_id: feito.appointment_id, reutilizado: true, por: "chave_do_pedido" };

  const dia = String(p.inicioLocal).slice(0, 10);
  const jaExiste = async () => {
    const r = await agendamentos(env, conn, { inicio: dia, fim: dia, clientId: p.clientId });
    if (!r.ok) return r;
    return { ok: true, appt: r.itens.find((a) => mesmoAgendamento(a, p)) || null };
  };
  const guardar = async (id) => { await cacheGravar(env, chaveReq, { appointment_id: id }, 24 * 3600); };

  const antes = await jaExiste();
  if (!antes.ok) return { ...antes, etapa: "conferir_antes_de_agendar" };
  if (antes.appt) { await guardar(antes.appt.Id); return { ok: true, appointment_id: antes.appt.Id, reutilizado: true, por: "agenda_do_cliente", appointment: antes.appt }; }

  // Corpo conforme AddAppointmentRequest (modelo "legacy": SessionTypeId + StaffId + StartDateTime
  // na raiz). StartDateTime em HORA LOCAL do site, sem designador. ApplyPayment e SendEmail ficam
  // no padrão da API (true / false). «NÃO VERIFICADO»: comportamento de ApplyPayment=true quando o
  // cliente não tem pacote que pague a sessão.
  const corpo = {
    ClientId: String(p.clientId), LocationId: Number(p.locationId), SessionTypeId: Number(p.sessionTypeId),
    StaffId: Number(p.staffId), StartDateTime: String(p.inicioLocal),
    ...(p.staffPedido ? { StaffRequested: true } : {}),
    Notes: String(p.notas || "Booked by Gui (Guileo)").slice(0, 400),
  };
  const r = await chamar(env, conn, { method: "POST", path: "/appointment/addappointment", body: corpo });
  if (r.ok) {
    const a = r.data.Appointment;
    if (a && a.Id != null) { await guardar(a.Id); return { ok: true, appointment_id: a.Id, reutilizado: false, appointment: a }; }
  }
  const incerto = r.ok || r.status === 409 || r.reason === "tempo_esgotado" || r.reason === "rede" || r.reason === "mindbody_fora";
  if (incerto) {
    if (!r.ok && r.status === 409 && opts.esperaMs !== 0) await new Promise((ok) => setTimeout(ok, opts.esperaMs || 1500));
    const depois = await jaExiste();
    if (depois.ok && depois.appt) { await guardar(depois.appt.Id); return { ok: true, appointment_id: depois.appt.Id, reutilizado: true, por: "conferido_apos_falha", appointment: depois.appt }; }
    if (r.ok) return falha(r.status, "resposta_inesperada", "addappointment respondeu 200 sem Appointment.Id e a agenda não mostra o horário");
    return { ...r, incerto: !depois.ok };
  }
  if (r.code === "ClientIsAlreadyBooked") return falha(r.status, "cliente_ja_agendado", r.detail, { code: r.code });
  if (HORARIO_NAO_DA.has(r.code)) return falha(r.status, "horario_indisponivel", r.detail, { code: r.code, horario_tomado: true });
  return r;
}

// POST /appointment/updateappointment — doc: só StartDateTime, EndDateTime, StaffId, Notes e
// SessionTypeId podem mudar; `Execute` aceita confirm, unconfirm, arrive, unarrive, cancel,
// latecancel, complete.
export async function cancelarAgendamento(env, conn, appointmentId, { tardio = false } = {}) {
  if (appointmentId == null || !Number.isFinite(Number(appointmentId))) return falha(0, "pedido_incompleto", "sem AppointmentId");
  const r = await chamar(env, conn, { method: "POST", path: "/appointment/updateappointment", body: { AppointmentId: Number(appointmentId), Execute: tardio ? "latecancel" : "cancel" } });
  if (!r.ok) return r;
  const st = String((r.data.Appointment || {}).Status || "");
  // 200 que não diz "cancelado" não é comprovante de cancelamento
  if (st && !CANCELADOS.has(st)) return falha(r.status, "cancelamento_nao_confirmado", `o MindBody devolveu Status=${st}`);
  return { ok: true, appointment_id: Number(appointmentId), status: st || "Cancelled", confirmado: !!st };
}

export async function remarcarAgendamento(env, conn, appointmentId, { inicioLocal, staffId } = {}) {
  if (appointmentId == null || !Number.isFinite(Number(appointmentId)) || !partesLocais(inicioLocal)) return falha(0, "pedido_incompleto", "sem AppointmentId ou novo horário");
  // EndDateTime de fora: o padrão da API é "StartDateTime + duração padrão do profissional".
  const r = await chamar(env, conn, { method: "POST", path: "/appointment/updateappointment", body: { AppointmentId: Number(appointmentId), StartDateTime: String(inicioLocal), ...(staffId != null ? { StaffId: Number(staffId) } : {}) } });
  if (!r.ok) {
    if (HORARIO_NAO_DA.has(r.code)) return falha(r.status, "horario_indisponivel", r.detail, { code: r.code, horario_tomado: true });
    return r;
  }
  const a = r.data.Appointment || {};
  if (a.StartDateTime && !mesmoMinutoLocal(a.StartDateTime, inicioLocal)) return falha(r.status, "remarcacao_nao_confirmada", "o MindBody respondeu 200 mas o horário devolvido não é o pedido");
  return { ok: true, appointment_id: Number(appointmentId), appointment: a, confirmado: !!a.StartDateTime };
}

// Estado atual de agendamentos espelhados (para a sincronização de volta).
// Devolve { ok, porId: Map(id → Appointment), pedidos } — quem NÃO veio não está em `porId`.
export async function estadoDosAgendamentos(env, conn, { ids, inicio, fim }) {
  const lista = [...new Set((ids || []).map(Number).filter(Number.isFinite))];
  if (!lista.length) return { ok: true, porId: new Map(), pedidos: 0 };
  const r = await agendamentos(env, conn, { inicio, fim, ids: lista });
  if (!r.ok) return r;
  const porId = new Map();
  for (const a of r.itens) if (a && a.Id != null && lista.includes(Number(a.Id))) porId.set(Number(a.Id), a);
  // `truncado`: a leitura parou antes do fim → quem não veio pode só não ter sido LIDO.
  return { ok: true, porId, pedidos: lista.length, devolvidos: r.itens.length, truncado: !!r.truncado };
}
