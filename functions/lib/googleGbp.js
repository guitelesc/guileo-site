// functions/lib/googleGbp.js — a parte COM REDE do Perfil de Empresa no Google.
// ─────────────────────────────────────────────────────────────────────────────────────────────
// As regras vivem em googleReviews.js (puro, testado). Aqui ficam só as chamadas:
//   • token de acesso com CACHE (antes: um refresh_token trocado a CADA chamada) e tratamento de
//     `invalid_grant` — o dono revogou o acesso; a conexão é marcada "precisa reautorizar" e as
//     telas dizem exatamente isso, em vez de um "não conectado" que ninguém entende.
//   • descoberta de TODAS as contas (inclusive grupo de locais) e TODAS as fichas, paginada.
//   • leitura de avaliações por ficha, paginada, com teto.
//   • o PUT da resposta — chamado SÓ pela ação de publicar do painel (functions/api/google-business.js),
//     depois da aprovação do dono. O cron (review-responder.js) não importa `putReply`.
//
// 🔒 TOKEN NUNCA SAI DAQUI: nenhuma função devolve access/refresh token para quem vai montar
// resposta HTTP ou log; todo texto de erro passa por `redact`.
//
// ENDPOINTS (documentação oficial, lida em 2026-09-30 — nada disto foi chamado de verdade ainda):
//   GET  mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize≤20&pageToken
//   GET  mybusinessbusinessinformation.googleapis.com/v1/accounts/{a}/locations?readMask(obrig.)&pageSize≤100&pageToken
//   GET  mybusiness.googleapis.com/v4/accounts/{a}/locations/{l}/reviews?pageSize≤50&pageToken&orderBy
//   PUT  mybusiness.googleapis.com/v4/accounts/{a}/locations/{l}/reviews/{r}/reply   corpo: ReviewReply {comment}
// ─────────────────────────────────────────────────────────────────────────────────────────────
import { svcRpc, svcJson } from "./sb.js";
import {
  classifyGoogleError, redact, normalizeGoogleLocation, matchLocations, mergeLocations,
  includedLocations, normalizeReview, connectionState,
} from "./googleReviews.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ACCOUNTS_URL = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts";
const INFO_URL = "https://mybusinessbusinessinformation.googleapis.com/v1";
const GBP_V4 = "https://mybusiness.googleapis.com/v4";
const READ_MASK = "name,title,storefrontAddress,phoneNumbers,metadata";

const str = (v, n = 400) => (v == null ? "" : String(v).slice(0, n));
const lower = (e) => str(e, 160).trim().toLowerCase();

export const apiConfigured = (env) => !!(env && env.GOOGLE_BUSINESS_CLIENT_ID && env.GOOGLE_BUSINESS_CLIENT_SECRET);
export const stateOf = (env, blob) => connectionState({ apiConfigured: apiConfigured(env), blob });

// ── credenciais do tenant ────────────────────────────────────────────────────────────────────
// Falha de leitura NÃO é "não conectado": devolve { ok:false } e quem chama diz "não deu para
// verificar". (svcJson: falha = { ok:false, erro_http, detalhe } — nunca ler `.error` nele.)
export async function loadCreds(env, email) {
  const em = lower(email);
  if (!(env && env.INGEST_SECRET)) return { ok: false, error: "INGEST_SECRET missing" };
  const r = await svcJson(env, "gb_creds_lookup", { p_secret: env.INGEST_SECRET, p_email: em });
  if (r && typeof r === "object" && r.ok === false && ("erro_http" in r || "detalhe" in r)) {
    // a função devolve NULL quando não há linha → o PostgREST manda corpo vazio/"null"
    if (r.detalhe === "resposta vazia") return { ok: true, email: em, blob: null };
    return { ok: false, error: `gb_creds_lookup ${r.erro_http || ""} ${redact(r.detalhe || "")}`.trim().slice(0, 160) };
  }
  const blob = r && typeof r === "object" && !Array.isArray(r) ? r : null;
  return { ok: true, email: em, blob };
}

/** Grava o blob inteiro e CONFERE lendo de volta (marca `rev`). Gravação que não conferiu é erro —
 *  antes a ação `connect` engolia a falha e respondia "conectado ✓". */
export async function storeCreds(env, email, blob) {
  const em = lower(email);
  if (!(env && env.INGEST_SECRET)) return { ok: false, error: "INGEST_SECRET missing" };
  const rev = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const tokens = { ...blob, rev };
  try {
    const r = await svcRpc(env, "store_integration", { p_secret: env.INGEST_SECRET, p_email: em, p_provider: "google_business", p_tokens: tokens });
    if (!r.ok) return { ok: false, error: `store_integration http ${r.status}` };
  } catch (e) { return { ok: false, error: `store_integration: ${redact(String(e)).slice(0, 100)}` }; }
  const back = await loadCreds(env, em);
  if (!back.ok) return { ok: false, error: `readback: ${back.error}` };
  if (!(back.blob && back.blob.rev === rev)) return { ok: false, error: "readback_mismatch" };
  return { ok: true, blob: back.blob };
}

// ── token de acesso, com cache ───────────────────────────────────────────────────────────────
// Cache em memória do isolate (o token NÃO vai para banco nem KV — menos um lugar para vazar).
// Vale até ~2 min antes do `expires_in`. Isolates diferentes não compartilham: o ganho é dentro
// de uma varredura/tela (dezenas de chamadas → uma troca), que é onde doía.
const CACHE = new Map();
const fp = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const cacheKey = (email, rt) => `${lower(email)}|${fp(String(rt))}`;
export function _clearTokenCache() { CACHE.clear(); }

/** → { ok:true, token } | { ok:false, code, detail }
 *  code: 'api_pending' (sem chave do app) · 'not_connected' · 'needs_reconsent' (invalid_grant) ·
 *        'token_error' (o Google recusou por outro motivo) · 'network' */
export async function accessToken(env, ctx, { fresh = false } = {}) {
  if (!apiConfigured(env)) return { ok: false, code: "api_pending" };
  const rt = str(ctx && ctx.blob && ctx.blob.refresh_token, 600);
  if (rt.length < 10) return { ok: false, code: "not_connected" };
  const k = cacheKey(ctx.email, rt);
  const hit = CACHE.get(k);
  if (!fresh && hit && hit.exp > Date.now()) return { ok: true, token: hit.token, cached: true };
  CACHE.delete(k);
  let r, d;
  try {
    r = await fetch(TOKEN_URL, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env.GOOGLE_BUSINESS_CLIENT_ID, client_secret: env.GOOGLE_BUSINESS_CLIENT_SECRET, refresh_token: rt, grant_type: "refresh_token" }).toString(),
    });
    d = await r.json().catch(() => null);
  } catch (e) { return { ok: false, code: "network", detail: redact(String(e)).slice(0, 120) }; }
  if (!r.ok || !(d && d.access_token)) {
    const erro = str(d && d.error, 60);
    if (erro === "invalid_grant") {
      // O dono revogou (ou o token expirou/foi trocado). Só um novo consentimento resolve.
      const marked = await markReconsent(env, ctx);
      return { ok: false, code: "needs_reconsent", marked };
    }
    return { ok: false, code: "token_error", status: r.status, detail: redact(`${erro} ${str(d && d.error_description, 160)}`).trim() };
  }
  const vida = Number(d.expires_in);
  const ttl = Number.isFinite(vida) && vida > 0 ? Math.max(0, vida - 120) : 300;
  if (ttl > 0) CACHE.set(k, { token: String(d.access_token), exp: Date.now() + ttl * 1000 });
  return { ok: true, token: String(d.access_token), cached: false };
}

async function markReconsent(env, ctx) {
  if (!(ctx && ctx.email && ctx.blob)) return false;
  if (ctx.blob.needs_reconsent === true) return true;
  const novo = { ...ctx.blob, needs_reconsent: true, reconsent_at: new Date().toISOString() };
  const s = await storeCreds(env, ctx.email, novo);
  if (s.ok) ctx.blob = s.blob;
  return s.ok;
}

/** Uma chamada autenticada ao Google. Devolve SEMPRE o veredito:
 *  { ok:true, status, data } | { ok:false, code, status, detail }. Um 401 derruba o cache e tenta
 *  uma vez com token novo. `fetch` não lança em erro HTTP — o status é conferido aqui, uma vez. */
export async function googleCall(env, ctx, url, init = {}) {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const t = await accessToken(env, ctx, { fresh: tentativa > 0 });
    if (!t.ok) return { ok: false, code: t.code, status: t.status || 0, detail: t.detail || "" };
    const res = await rawCall(t.token, url, init);
    if (res.status === 401 && tentativa === 0) continue;
    return res;
  }
  return { ok: false, code: "unauthenticated", status: 401, detail: "" };
}
async function rawCall(token, url, init = {}) {
  let r;
  try {
    r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) } });
  } catch (e) { return { ok: false, code: "network", status: 0, detail: redact(String(e)).slice(0, 120) }; }
  const texto = await r.text().catch(() => "");
  let data = null;
  if (texto) { try { data = JSON.parse(texto); } catch { data = null; } }
  if (!r.ok) return { ok: false, ...classifyGoogleError(r.status, data) };
  if (texto && data === null) return { ok: false, code: "google_error", status: r.status, detail: "non-JSON body" };
  return { ok: true, status: r.status, data: data || {} };
}
/** `call(url)` a partir de um access_token já em mãos (o callback acabou de trocar o code). */
export const callWithToken = (token) => (url, init) => rawCall(token, url, init);

// ── unidades do tenant (biz_locations) ───────────────────────────────────────────────────────
export async function fetchBizLocations(env, email) {
  if (!(env && env.SCHED_SECRET)) return { ok: false, locations: [], error: "SCHED_SECRET missing" };
  const r = await svcJson(env, "biz_locations_admin_list", { p_secret: env.SCHED_SECRET, p_email: lower(email) });
  if (!(r && Array.isArray(r.locations))) return { ok: false, locations: [], error: redact(str(r && (r.detalhe || r.erro_http || "unexpected shape"), 120)) };
  return { ok: true, locations: r.locations.map((l) => ({ id: String(l.id), name: str(l.name, 120), address: str(l.address, 300), city: str(l.city, 80), active: l.active !== false })) };
}

// ── descoberta: TODAS as contas, TODAS as fichas ─────────────────────────────────────────────
// A revisão achou: accounts[0] + pageSize=1. Se as fichas ficam num GRUPO DE LOCAIS
// (type LOCATION_GROUP), accounts[0] — "the personal account … will always be the first item" —
// pode não ter ficha nenhuma. E para conta PERSONAL a listagem devolve só as fichas que ela
// possui diretamente. Por isso: todas as contas, paginadas; para cada uma, todas as fichas.
const MAX_ACCOUNT_PAGES = 10, MAX_LOCATION_PAGES = 10, MAX_LOCATIONS = 300;
export async function discoverAll(call) {
  const accounts = [], locations = [], errors = [], vistos = new Set();
  let pageToken = "", truncated = false;
  for (let p = 0; ; p++) {
    if (p >= MAX_ACCOUNT_PAGES) { truncated = true; break; }
    const q = new URLSearchParams({ pageSize: "20" }); if (pageToken) q.set("pageToken", pageToken);
    const r = await call(`${ACCOUNTS_URL}?${q.toString()}`);
    if (!r.ok) return { ok: false, code: r.code, status: r.status, detail: r.detail || "", accounts, locations, errors: [{ where: "accounts.list", code: r.code, status: r.status }] };
    for (const a of Array.isArray(r.data.accounts) ? r.data.accounts : []) {
      const id = str(a && a.name, 120).replace(/^accounts\//, "");
      if (id) accounts.push({ id, name: str(a.accountName, 160), type: str(a.type, 40), role: str(a.role, 40) });
    }
    pageToken = str(r.data.nextPageToken, 600);
    if (!pageToken) break;
  }
  for (const a of accounts) {
    let tok = "";
    for (let p = 0; ; p++) {
      if (p >= MAX_LOCATION_PAGES || locations.length >= MAX_LOCATIONS) { truncated = true; break; }
      const q = new URLSearchParams({ readMask: READ_MASK, pageSize: "100" }); if (tok) q.set("pageToken", tok);
      const r = await call(`${INFO_URL}/accounts/${encodeURIComponent(a.id)}/locations?${q.toString()}`);
      if (!r.ok) { errors.push({ where: `locations.list:${a.type || "?"}`, code: r.code, status: r.status }); break; }
      for (const l of Array.isArray(r.data.locations) ? r.data.locations : []) {
        const n = normalizeGoogleLocation(l, a.id);
        if (n && !vistos.has(n.location_id)) { vistos.add(n.location_id); locations.push(n); }
      }
      tok = str(r.data.nextPageToken, 600);
      if (!tok) break;
    }
  }
  // Nenhuma ficha E houve erro listando → não dá para afirmar "esta conta não tem ficha".
  if (!locations.length && errors.length) return { ok: false, code: errors[0].code, status: errors[0].status, detail: "", accounts, locations, errors };
  return { ok: true, accounts, locations, errors, truncated, partial: errors.length > 0 || truncated };
}

/** Roda a descoberta, casa com as unidades do tenant e devolve o blob NOVO (sem gravar).
 *  `previous` = blob anterior (para preservar o que o DONO já confirmou). */
export async function buildDiscoveredBlob(env, email, base, call, previous = null) {
  const at = new Date().toISOString();
  const d = await discoverAll(call);
  if (!d.ok) {
    return { blob: { ...base, accounts: d.accounts.slice(0, 50), locations: (previous && Array.isArray(previous.locations) ? previous.locations : []), discovery: { ok: false, at, code: d.code, status: d.status || 0, detail: redact(d.detail || "").slice(0, 200) } }, discovery: d, mapping: null };
  }
  const biz = await fetchBizLocations(env, email);
  const m = matchLocations(d.locations, biz.ok ? biz.locations : []);
  const locations = mergeLocations(d.locations, previous && previous.locations, m);
  const primeira = locations.find((l) => l.include) || locations[0] || null;
  return {
    blob: {
      ...base, accounts: d.accounts.slice(0, 50), locations,
      // legado: google-oauth-start.js (status) ainda lê account_id/location_id soltos
      account_id: primeira ? primeira.account_id : "", location_id: primeira ? primeira.location_id : "",
      discovery: { ok: true, at, partial: !!d.partial, errors: d.errors.slice(0, 10), biz_locations_read: biz.ok },
    },
    discovery: d, mapping: m, biz,
  };
}

// ── avaliações ───────────────────────────────────────────────────────────────────────────────
const locPath = (loc) => `accounts/${encodeURIComponent(str(loc.account_id, 120))}/locations/${encodeURIComponent(str(loc.location_id, 120))}`;

/** Todas as páginas de UMA ficha, até `maxPages` (50 por página, o máximo documentado). */
export async function listLocationReviews(env, ctx, loc, { maxPages = 4, orderBy = "updateTime desc" } = {}) {
  const raw = []; let tok = "", averageRating = null, totalReviewCount = null, pages = 0, truncated = false;
  for (;;) {
    if (pages >= maxPages) { truncated = true; break; }
    const q = new URLSearchParams({ pageSize: "50", orderBy }); if (tok) q.set("pageToken", tok);
    const r = await googleCall(env, ctx, `${GBP_V4}/${locPath(loc)}/reviews?${q.toString()}`);
    if (!r.ok) return { ok: false, code: r.code, status: r.status, detail: r.detail || "", reviews: raw, pages };
    pages++;
    if (Array.isArray(r.data.reviews)) raw.push(...r.data.reviews);
    if (typeof r.data.averageRating === "number") averageRating = r.data.averageRating;
    if (Number.isFinite(Number(r.data.totalReviewCount)) && r.data.totalReviewCount != null) totalReviewCount = Number(r.data.totalReviewCount);
    tok = str(r.data.nextPageToken, 600);
    if (!tok) break;
  }
  // resposta {} (sem `reviews` nem total) = ficha sem avaliação → zero de verdade, lido com sucesso
  if (totalReviewCount == null && !truncated) totalReviewCount = raw.length;
  return { ok: true, reviews: raw, averageRating, totalReviewCount, pages, truncated };
}

/** Lê TODAS as fichas confirmadas. Uma ficha que falha não esconde as outras nem vira "zero":
 *  cada uma carrega o próprio veredito em `per_location`. */
export async function listAllReviews(env, ctx, { locationId = "", maxPages = 4, labels = null } = {}) {
  const locs = includedLocations(ctx.blob).filter((l) => !locationId || String(l.location_id) === String(locationId));
  const reviews = [], per_location = [];
  for (const loc of locs) {
    const label = (labels && labels.get(String(loc.location_id))) || loc.title || loc.address || "";
    const r = await listLocationReviews(env, ctx, loc, { maxPages });
    if (!r.ok) {
      per_location.push({ location_id: loc.location_id, label, ok: false, code: r.code, detalhe_tecnico: r.detail || "" });
      if (r.code === "needs_reconsent" || r.code === "api_pending" || r.code === "not_connected") break;   // nenhuma outra vai passar
      continue;
    }
    const norm = r.reviews.map((rv) => normalizeReview(rv, { ...loc, label })).filter(Boolean);
    reviews.push(...norm);
    per_location.push({ location_id: loc.location_id, label, ok: true, averageRating: r.averageRating, totalReviewCount: r.totalReviewCount, read: norm.length, truncated: r.truncated });
  }
  return { reviews, per_location, locations_read: per_location.filter((p) => p.ok).length, locations_total: locs.length };
}

/** PUT da resposta ("A reply is created if one does not exist"). Devolve o ReviewReply do Google. */
export async function putReply(env, ctx, loc, reviewId, comment) {
  const rid = str(reviewId, 300).trim();
  if (!rid || !str(comment, 5000).trim()) return { ok: false, code: "invalid", status: 0, detail: "missing review id or comment" };
  return googleCall(env, ctx, `${GBP_V4}/${locPath(loc)}/reviews/${encodeURIComponent(rid)}/reply`, { method: "PUT", body: JSON.stringify({ comment: String(comment) }) });
}
