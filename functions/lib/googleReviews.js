// functions/lib/googleReviews.js — as regras PURAS das avaliações do Google (sem rede, sem banco).
// ─────────────────────────────────────────────────────────────────────────────────────────────
// POR QUE EXISTE (revisão de 2026-09-30): a tela lia `r.stars / r.name / r.text / r.replied` e a
// API v4 devolve `starRating` ("ONE".."FIVE"), `reviewer.displayName`, `comment`, `reviewReply` e
// `name` = caminho do recurso. Com dado real o painel mostraria 0 estrela, média "—", o autor como
// "accounts/…/reviews/…" e "aguardando resposta" em avaliação já respondida. Nada disso quebra
// build nem aparece em log: é a classe de defeito que só um teste com a forma DOCUMENTADA pega.
//
// Tudo aqui é função pura para poder ser provado sem a API (que o Google ainda não aprovou):
//   1. normalizeReview      — Review v4 → a forma que as telas usam
//   2. reviewStats & cia    — média, contagens, distribuição (nunca 0 por falta de leitura)
//   3. matchLocations       — ficha do Google ↔ biz_locations do tenant (sem chutar)
//   4. checkReply           — o que uma resposta PODE e NÃO PODE conter
//   5. connectionState      — o estado honesto da conexão (uma fonte, servidor e tela)
//   6. classifyGoogleError / redact — erro do Google em código estável, sem token no texto
//
// FONTES (documentação oficial, lidas em 2026-09-30):
//   Review / Reviewer / StarRating / ReviewReply →
//     developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews
//   Account / AccountType → …/accountmanagement/rest/v1/accounts
//   Location / PostalAddress / Metadata → …/businessinformation/rest/v1/accounts.locations
// ─────────────────────────────────────────────────────────────────────────────────────────────
import { validateOutput } from "./guiConstitution.js";

const str = (v, n = 4000) => (v == null ? "" : String(v).slice(0, n));

// ── 1. NORMALIZAÇÃO ──────────────────────────────────────────────────────────────────────────
// StarRating é ENUM de texto. `STAR_RATING_UNSPECIFIED` e qualquer valor desconhecido viram
// `null` — NUNCA 0. "Nota 0" é uma acusação contra o negócio; "não sei" é só a verdade.
const STAR = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
export function starsOf(v) {
  if (typeof v === "number") return Number.isInteger(v) && v >= 1 && v <= 5 ? v : null;
  const k = str(v, 40).trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(STAR, k) ? STAR[k] : null;
}

// `name` tem a forma accounts/{accountId}/locations/{locationId}/reviews/{reviewId}.
export function parseReviewName(name) {
  const m = /^accounts\/([^/]+)\/locations\/([^/]+)\/reviews\/([^/]+)$/.exec(str(name, 600).trim());
  return m ? { accountId: m[1], locationId: m[2], reviewId: m[3] } : null;
}
export function reviewIdOf(rv) {
  if (!rv || typeof rv !== "object") return "";
  if (rv.reviewId) return str(rv.reviewId, 300);
  const p = parseReviewName(rv.name);
  return p ? p.reviewId : "";
}

const iso = (v) => { const t = Date.parse(str(v, 60)); return Number.isFinite(t) ? new Date(t).toISOString() : null; };

/** Review v4 → { id, location, stars, reviewer, text, createdAt, updatedAt, replied, replyText, replyAt, … }.
 *  `loc` é a ficha de onde a avaliação foi lida: { location_id, account_id, title, biz_location_id, label }. */
export function normalizeReview(rv, loc = null) {
  if (!rv || typeof rv !== "object") return null;
  const id = reviewIdOf(rv);
  if (!id) return null;                        // sem id não dá para responder nem deduplicar
  const path = parseReviewName(rv.name);
  const reply = rv.reviewReply && typeof rv.reviewReply === "object" ? rv.reviewReply : null;
  const replyText = reply ? str(reply.comment, 4096).trim() : "";
  const reviewer = rv.reviewer && typeof rv.reviewer === "object" ? rv.reviewer : {};
  const anonymous = reviewer.isAnonymous === true;
  return {
    id,
    location: str((loc && loc.location_id) || (path && path.locationId) || "", 120),
    accountId: str((loc && loc.account_id) || (path && path.accountId) || "", 120),
    locationLabel: str((loc && (loc.label || loc.title)) || "", 160),
    bizLocationId: (loc && loc.biz_location_id) || null,
    stars: starsOf(rv.starRating),
    // "Only populated with the reviewer's real name if isAnonymous is false" — anônimo fica vazio
    // e a TELA decide a palavra ("Anonymous"); nunca o caminho do recurso no lugar do nome.
    reviewer: anonymous ? "" : str(reviewer.displayName, 120).trim(),
    anonymous,
    text: str(rv.comment, 6000).trim(),
    createdAt: iso(rv.createTime),
    updatedAt: iso(rv.updateTime),
    replied: !!replyText,
    replyText,
    replyAt: reply ? iso(reply.updateTime) : null,
    replyState: reply ? (str(reply.reviewReplyState, 40) || null) : null,   // PENDING | REJECTED | APPROVED
  };
}

// ── 2. NÚMEROS ───────────────────────────────────────────────────────────────────────────────
/** Estatística do que foi LIDO. `average` é null sem nota lida — a tela mostra "—", não 0. */
export function reviewStats(reviews) {
  const list = (Array.isArray(reviews) ? reviews : []).filter(Boolean);
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let soma = 0, rated = 0, replied = 0;
  for (const r of list) {
    if (r.stars != null) { dist[r.stars]++; soma += r.stars; rated++; }
    if (r.replied) replied++;
  }
  return {
    count: list.length, rated,
    average: rated ? Math.round((soma / rated) * 10) / 10 : null,
    dist, replied, unanswered: list.length - replied,
  };
}

/** Média geral a partir dos números que o PRÓPRIO Google devolve por ficha (averageRating +
 *  totalReviewCount, sobre TODAS as avaliações — não só as lidas). Ponderada pelo total de cada
 *  ficha. Ficha que falhou ou veio sem número fica FORA da conta (e é dita em `missing`). */
export function overallFromGoogle(perLocation) {
  let peso = 0, soma = 0, total = 0, conhecidas = 0; const missing = [];
  for (const p of Array.isArray(perLocation) ? perLocation : []) {
    const n = p && p.ok && p.totalReviewCount != null ? Number(p.totalReviewCount) : NaN;
    const avg = p && p.averageRating != null ? Number(p.averageRating) : NaN;
    if (!Number.isFinite(n) || n < 0) { missing.push(p ? p.location_id : ""); continue; }
    conhecidas++; total += n;
    if (n > 0 && Number.isFinite(avg) && avg >= 1 && avg <= 5) { peso += n; soma += avg * n; }
    else if (n > 0) missing.push(p.location_id);
  }
  return { average: peso ? Math.round((soma / peso) * 10) / 10 : null, total: conhecidas ? total : null, missing };
}

// ── 3. FICHA DO GOOGLE ↔ UNIDADE DO TENANT ───────────────────────────────────────────────────
const fold = (s) => str(s, 400).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const ABBR = {
  street: "st", avenue: "ave", av: "ave", avenida: "ave", boulevard: "blvd", road: "rd", drive: "dr",
  lane: "ln", place: "pl", court: "ct", highway: "hwy", parkway: "pkwy", square: "sq", terrace: "ter",
  east: "e", west: "w", north: "n", south: "s", rua: "r",
};
/** "31-15 Ditmars Boulevard, Suite 2" → "3115|ditmars blvd". Sem número de porta → null
 *  (rua sem número não identifica um endereço; melhor não casar do que casar o quarteirão). */
export function addressKey(line) {
  let a = fold(str(line, 300).split(/[,\n]/)[0]).replace(/[^a-z0-9#\s-]/g, " ").replace(/\s+/g, " ").trim();
  a = a.replace(/\s*(?:\d+(?:st|nd|rd|th)?\s+)?(?:#|\b(?:suite|ste|unit|apt|apartment|floor|fl|room|rm|sala|loja)\b).*$/, "").trim();
  const toks = a.split(" ").filter(Boolean).map((t) => ABBR[t] || t).map((t) => t.replace(/^(\d+)(st|nd|rd|th)$/, "$1"));
  const i = toks.findIndex((t) => /^\d[\d-]*[a-z]?$/.test(t));
  if (i < 0) return null;
  const numero = toks[i].replace(/-/g, "");
  const rua = toks.filter((_, j) => j !== i).join(" ").trim();
  return rua ? `${numero}|${rua}` : null;
}
const zipOf = (s) => { const m = str(s, 300).match(/\b\d{5}\b/g); return m ? m[m.length - 1] : ""; };
const STOP = new Set(["the", "and", "of", "de", "da", "do", "la", "el", "at", "a", "e", "y", "llc", "inc", "co"]);
const tokens = (s) => new Set(fold(s).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t && !STOP.has(t)));
const overlap = (a, b) => { let n = 0; for (const t of a) if (b.has(t)) n++; return n; };

function sameAddress(g, b) {
  if (!g.key || !b.key) return false;
  const [gn, gr] = g.key.split("|"), [bn, br] = b.key.split("|");
  if (gn !== bn) return false;
  if (!(gr === br || gr.startsWith(br + " ") || br.startsWith(gr + " "))) return false;
  if (g.zip && b.zip && g.zip !== b.zip) return false;   // mesma rua e número em CEPs diferentes = outro lugar
  return true;
}

/** Forma guardada de uma Location (Business Information v1) — só o que a plataforma usa. */
export function normalizeGoogleLocation(loc, accountId = "") {
  if (!loc || typeof loc !== "object") return null;
  const id = str(loc.name, 200).replace(/^locations\//, "").trim();
  if (!id) return null;
  const ad = loc.storefrontAddress && typeof loc.storefrontAddress === "object" ? loc.storefrontAddress : {};
  const lines = Array.isArray(ad.addressLines) ? ad.addressLines.map((l) => str(l, 160).trim()).filter(Boolean) : [];
  const md = loc.metadata && typeof loc.metadata === "object" ? loc.metadata : {};
  const address = [lines.join(", "), str(ad.locality, 80), [str(ad.administrativeArea, 40), str(ad.postalCode, 20)].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return {
    account_id: str(accountId, 120).replace(/^accounts\//, ""),
    location_id: id,
    title: str(loc.title, 160).trim(),
    address,
    street: lines[0] || "",
    locality: str(ad.locality, 80).trim(),
    sublocality: str(ad.sublocality, 80).trim(),
    postal: str(ad.postalCode, 20).trim(),
    phone: str(loc.phoneNumbers && loc.phoneNumbers.primaryPhone, 40).trim(),
    maps_uri: str(md.mapsUri, 300),
    // A leitura de avaliações "is only valid if the specified location is verified". O campo que
    // ACHAMOS que indica isso é metadata.hasVoiceOfMerchant — não confirmado contra a API viva,
    // então é só informativo: nunca usado para pular uma ficha.
    verified: typeof md.hasVoiceOfMerchant === "boolean" ? md.hasVoiceOfMerchant : null,
  };
}

/** Casa fichas do Google com as unidades do tenant. NÃO CHUTA: empate vira `ambiguous`, sem par
 *  vira `unmatched`, e duas fichas disputando a mesma unidade ficam as duas `ambiguous`.
 *  googleLocs: [{location_id, title, street|address, locality, postal}]
 *  bizLocs:    [{id, name, address, city}]
 *  → { results:[{location_id, biz_location_id, match:'auto'|'ambiguous'|'unmatched', by, candidates}], matched, unmatched, ambiguous } */
export function matchLocations(googleLocs, bizLocs) {
  const G = (Array.isArray(googleLocs) ? googleLocs : []).filter((g) => g && g.location_id).map((g) => ({
    id: String(g.location_id), key: addressKey(g.street || g.address), zip: str(g.postal, 20).slice(0, 5) || zipOf(g.address),
    nome: tokens(g.title), lugar: tokens(`${g.title || ""} ${g.locality || ""} ${g.sublocality || ""}`),
  }));
  const B = (Array.isArray(bizLocs) ? bizLocs : []).filter((b) => b && b.id && b.active !== false).map((b) => ({
    id: String(b.id), key: addressKey(b.address), zip: zipOf(b.address), nome: tokens(b.name),
  }));
  const results = G.map((g) => {
    const porEndereco = B.filter((b) => sameAddress(g, b));
    if (porEndereco.length === 1) return { location_id: g.id, biz_location_id: porEndereco[0].id, match: "auto", by: "address", candidates: [] };
    if (porEndereco.length > 1) {
      // mesmo endereço, várias unidades (salão e med spa no mesmo prédio): o NOME desempata —
      // só se houver um vencedor único e com pelo menos uma palavra em comum.
      const pts = porEndereco.map((b) => ({ b, n: overlap(b.nome, g.nome) })).sort((x, y) => y.n - x.n);
      if (pts[0].n > 0 && pts[0].n > pts[1].n) return { location_id: g.id, biz_location_id: pts[0].b.id, match: "auto", by: "address+name", candidates: [] };
      return { location_id: g.id, biz_location_id: null, match: "ambiguous", by: "address", candidates: porEndereco.map((b) => b.id) };
    }
    // Sem endereço em comum: o nome INTEIRO da unidade tem que estar no título/bairro da ficha.
    // E se os dois lados TÊM endereço e eles discordam, o nome não passa por cima disso.
    const porNome = B.filter((b) => b.nome.size > 0 && overlap(b.nome, g.lugar) === b.nome.size && !(g.key && b.key));
    if (porNome.length === 1) return { location_id: g.id, biz_location_id: porNome[0].id, match: "auto", by: "name", candidates: [] };
    if (porNome.length > 1) return { location_id: g.id, biz_location_id: null, match: "ambiguous", by: "name", candidates: porNome.map((b) => b.id) };
    return { location_id: g.id, biz_location_id: null, match: "unmatched", by: "", candidates: [] };
  });
  // Uma unidade não pode ser de duas fichas: a disputa derruba as duas para "ambiguous".
  const uso = new Map();
  for (const r of results) if (r.biz_location_id) uso.set(r.biz_location_id, (uso.get(r.biz_location_id) || 0) + 1);
  for (const r of results) {
    if (r.biz_location_id && uso.get(r.biz_location_id) > 1) { r.candidates = [r.biz_location_id]; r.biz_location_id = null; r.match = "ambiguous"; r.by = "collision"; }
  }
  return {
    results,
    matched: results.filter((r) => r.match === "auto").map((r) => r.location_id),
    unmatched: results.filter((r) => r.match === "unmatched").map((r) => r.location_id),
    ambiguous: results.filter((r) => r.match === "ambiguous").map((r) => r.location_id),
  };
}

/** Junta a descoberta nova com o que já estava guardado. A decisão do DONO (match:'owner')
 *  sobrevive a uma re-descoberta e a um novo consentimento; só o casamento automático é refeito. */
export function mergeLocations(discovered, previous, matchResult) {
  const prev = new Map((Array.isArray(previous) ? previous : []).filter((p) => p && p.location_id).map((p) => [String(p.location_id), p]));
  const res = new Map(((matchResult && matchResult.results) || []).map((r) => [String(r.location_id), r]));
  return (Array.isArray(discovered) ? discovered : []).filter((d) => d && d.location_id).map((d) => {
    const p = prev.get(String(d.location_id));
    if (p && p.match === "owner") return { ...d, biz_location_id: p.biz_location_id || null, match: "owner", include: p.include === true, candidates: [] };
    const r = res.get(String(d.location_id)) || { match: "unmatched", biz_location_id: null, candidates: [] };
    return { ...d, biz_location_id: r.biz_location_id || null, match: r.match, by: r.by || "", include: r.match === "auto", candidates: r.candidates || [] };
  });
}

/** O dono confirma/corrige. `edits`: [{location_id, biz_location_id|null, include}]. Recusa ficha
 *  que não é desta conexão e unidade que não é deste tenant — id digitado não autoriza nada. */
export function applyOwnerMapping(locations, edits, bizLocs) {
  const locs = (Array.isArray(locations) ? locations : []).map((l) => ({ ...l }));
  const byId = new Map(locs.map((l) => [String(l.location_id), l]));
  const biz = new Set((Array.isArray(bizLocs) ? bizLocs : []).map((b) => String(b.id)));
  const errors = [];
  if (!Array.isArray(edits) || !edits.length) return { ok: false, errors: ["no_edits"], locations: locs };
  for (const e of edits.slice(0, 200)) {
    const l = byId.get(str(e && e.location_id, 120));
    if (!l) { errors.push(`unknown_location:${str(e && e.location_id, 40)}`); continue; }
    const bid = e.biz_location_id ? str(e.biz_location_id, 60) : null;
    if (bid && !biz.has(bid)) { errors.push(`unknown_biz_location:${bid.slice(0, 40)}`); continue; }
    l.biz_location_id = bid; l.match = "owner"; l.include = e.include !== false; l.candidates = []; l.by = "owner";
  }
  // duas fichas incluídas apontando para a mesma unidade → recusa (a média por unidade ficaria errada)
  const vistos = new Map();
  for (const l of locs) if (l.include && l.biz_location_id) { if (vistos.has(l.biz_location_id)) errors.push(`duplicate_biz_location:${String(l.biz_location_id).slice(0, 40)}`); vistos.set(l.biz_location_id, 1); }
  return { ok: errors.length === 0, errors, locations: locs };
}

export const includedLocations = (blob) => (blob && Array.isArray(blob.locations) ? blob.locations.filter((l) => l && l.location_id && l.account_id && l.include === true) : []);

/** O que pode sair numa resposta HTTP sobre as fichas: nunca o blob, nunca token. */
export function publicLocations(blob, bizLocs) {
  const nome = new Map((Array.isArray(bizLocs) ? bizLocs : []).map((b) => [String(b.id), str(b.name, 120)]));
  return (blob && Array.isArray(blob.locations) ? blob.locations : []).filter((l) => l && l.location_id).map((l) => ({
    location_id: str(l.location_id, 120), title: str(l.title, 160), address: str(l.address, 300),
    biz_location_id: l.biz_location_id || null, biz_name: l.biz_location_id ? (nome.get(String(l.biz_location_id)) || "") : "",
    match: str(l.match, 20) || "unmatched", include: l.include === true,
    candidates: Array.isArray(l.candidates) ? l.candidates.slice(0, 10) : [], verified: typeof l.verified === "boolean" ? l.verified : null,
    label: (l.biz_location_id && nome.get(String(l.biz_location_id))) || str(l.title, 160) || str(l.address, 160),
  }));
}

// ── 5. ESTADO DA CONEXÃO ─────────────────────────────────────────────────────────────────────
// Um estado só, calculado do que está GRAVADO — a revisão achou o callback dizendo "conectado"
// enquanto o Hub dizia "Não conectado" (tenantCreds exigia location_id). Os dois leem daqui.
//   not_connected   · sem refresh_token
//   needs_reconsent · o Google devolveu invalid_grant (o dono revogou/expirou) → só ele resolve
//   api_pending     · conectado, mas o Google ainda não liberou a API para ESTE projeto
//   needs_scope     · conectado sem a permissão business.manage → reconectar marcando a caixa
//   needs_discovery · conectado, fichas ainda não buscadas · discovery_failed = buscou e falhou
//   no_locations    · a conta do Google não tem ficha nenhuma
//   needs_mapping   · há fichas, nenhuma confirmada como sendo deste negócio
//   ready           · pelo menos uma ficha confirmada
const API_PENDING_CODES = new Set(["api_not_enabled", "quota", "permission_denied"]);
export function connectionState({ apiConfigured = false, blob = null } = {}) {
  const b = blob && typeof blob === "object" ? blob : {};
  if (str(b.refresh_token, 600).length < 10) return "not_connected";
  if (b.needs_reconsent === true) return "needs_reconsent";
  if (!apiConfigured) return "api_pending";
  if (b.app && b.app !== "business") return "needs_scope";
  if (!str(b.scope, 1000).includes("business.manage")) return "needs_scope";
  const d = b.discovery && typeof b.discovery === "object" ? b.discovery : null;
  if (!d || !d.at) return "needs_discovery";
  if (d.ok !== true) return API_PENDING_CODES.has(str(d.code, 40)) ? "api_pending" : "discovery_failed";
  const locs = Array.isArray(b.locations) ? b.locations : [];
  if (!locs.length) return "no_locations";
  return includedLocations(b).length ? "ready" : "needs_mapping";
}

// ── 6. ERROS DO GOOGLE, SEM SEGREDO ──────────────────────────────────────────────────────────
/** Tira qualquer coisa com cara de token do Google antes de um texto ir para log/resposta. */
export function redact(s) {
  return str(s, 2000)
    .replace(/ya29\.[A-Za-z0-9._-]+/g, "[redacted]")
    .replace(/1\/\/[A-Za-z0-9._-]{6,}/g, "[redacted]")
    .replace(/(access_token|refresh_token|client_secret|id_token|code)(["'=:\s]+)[A-Za-z0-9._/-]{8,}/gi, "$1$2[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]{8,}/gi, "Bearer [redacted]");
}
/** Status + corpo de erro do Google → { code, detail }. `code` é estável (a tela decide a frase);
 *  `detail` é a mensagem do Google, cortada e sem token — vai em `detalhe_tecnico`, nunca na frase. */
export function classifyGoogleError(status, body) {
  const e = body && typeof body === "object" && body.error && typeof body.error === "object" ? body.error : {};
  const st = str(e.status, 60), msg = redact(str(e.message, 300));
  const reasons = (Array.isArray(e.details) ? e.details : []).map((d) => str(d && d.reason, 60)).join(",") + "," + (Array.isArray(e.errors) ? e.errors : []).map((d) => str(d && d.reason, 60)).join(",");
  let code = "google_error";
  if (status === 401 || st === "UNAUTHENTICATED") code = "unauthenticated";
  else if (status === 403 && /SERVICE_DISABLED|accessNotConfigured|API_NOT_ENABLED/i.test(reasons + msg) || /has not been used in project|is disabled/i.test(msg)) code = "api_not_enabled";
  else if (status === 429 || st === "RESOURCE_EXHAUSTED") code = "quota";
  else if (status === 403 || st === "PERMISSION_DENIED") code = "permission_denied";
  else if (status === 404 || st === "NOT_FOUND") code = "not_found";
  else if (status === 400 || st === "INVALID_ARGUMENT" || st === "FAILED_PRECONDITION") code = "invalid";
  else if (status >= 500) code = "google_unavailable";
  return { code, status: Number(status) || 0, detail: msg };
}

// ── 4. O QUE UMA RESPOSTA PODE CONTER ────────────────────────────────────────────────────────
const soDigitos = (s) => str(s, 80).replace(/\D/g, "");
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const URL_RE = /(?:https?:\/\/|www\.)\S+|(?<![@\w.-])[a-z0-9-]+\.(?:com|net|org|io|page|app|co|me|ly|gl|link)\b(?:\/\S*)?/gi;

/** O contato PRIVADO que uma resposta a avaliação negativa pode oferecer: telefone ou e-mail
 *  REAL do negócio. O link de avaliação NUNCA é contato (a revisão achou o motor mandando o
 *  cliente insatisfeito, em público, para o link de avaliar). Sem telefone nem e-mail → null, e
 *  a resposta não oferece canal nenhum. */
export function privateContact(profile) {
  const p = profile && typeof profile === "object" ? profile : {};
  const fone = str(p.phone || p.business_phone || "", 40).trim();
  const d = soDigitos(fone);
  if (d.length >= 10 && d.length <= 15 && !/https?:|www\./i.test(fone)) return { kind: "phone", value: fone };
  const mail = str(p.contact_email || p.public_email || p.business_email || "", 160).trim();
  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(mail)) return { kind: "email", value: mail };
  return null;
}

const OFFER_RE = new RegExp([
  "refund", "reembols\\w*", "money[- ]back", "discount", "descont\\w*", "descuent\\w*", "\\d+\\s?% ?off", "\\bcoupon", "\\bcupom", "\\bcup[oó]n",
  "voucher", "gift ?card", "vale[- ]presente", "complimentary", "cortesia", "on the house", "por (?:nossa|nuestra) conta", "por cuenta de la casa",
  "free of charge", "(?<!feel )(?<!-)\\bfree\\b", "\\bgr[aá]tis\\b", "de gra[çc]a", "gratuit\\w*", "store credit", "account credit", "credit (?:on|to) your", "cr[eé]dito (?:na|em|en) (?:sua|seu|su|tu)",
  "compensat\\w*", "compensa[çc][aã]o", "indeniz\\w*", "we(?:'ll| will) (?:pay|cover|waive|comp)\\b", "no charge", "sem custo", "sin costo",
].join("|"), "i");
const MEDICAL_RE = new RegExp([
  "\\bcur(?:e|es|ed|ar|a|amos)\\b", "\\bheal(?:s|ed)?\\b", "diagnos\\w*", "diagn[oó]stic\\w*", "clinically (?:proven|tested)", "clinicamente (?:comprovad|testad)\\w*", "cl[ií]nicamente (?:probad|comprobad)\\w*",
  "\\bfda\\b", "\\banvisa\\b", "side[- ]effects?", "efeitos? colaterais?", "efectos? secundarios?", "symptom\\w*", "sintoma\\w*", "s[ií]ntoma\\w*",
  "guarantee\\w* (?:results?|outcome)", "results? (?:are |is )?guaranteed", "resultados? garantid\\w*", "garantimos (?:o )?resultado", "medical advice", "prescri\\w*", "\\bmedicat\\w*", "\\bmedicament\\w*",
  "(?:will|can|does) (?:eliminate|remove|fix|reverse|prevent|treat) (?:your|the|any) (?:pain|acne|wrinkles|scars?|condition|infection|disease|cellulite)",
  "100% safe", "completely safe", "totalmente segur\\w*", "no risks?\\b", "sem riscos?\\b", "sin riesgos?\\b", "permanent results?", "resultados? permanentes?",
].join("|"), "i");
// Termos que REVELAM o que a pessoa fez/pagou. Só são aceitos se a própria pessoa escreveu na
// avaliação — confirmar em público um procedimento que ela não citou é expor dado dela.
const SENSITIVE = [
  "botox", "filler", "fillers", "preenchimento", "relleno", "laser", "injection", "injections", "injectable", "injectables", "peel", "peeling", "surgery", "cirurgia", "cirugia",
  "lipo", "liposuction", "semaglutide", "ozempic", "prp", "microneedling", "iv therapy", "hormone", "hormonal", "pregnan", "gravidez", "embarazo",
  "your card", "your payment", "your invoice", "your bill", "your balance", "your charge", "seu cartao", "seu pagamento", "sua fatura", "su tarjeta", "su pago", "su factura",
  "your medical", "your health", "your condition", "your skin condition", "sua saude", "su salud", "your appointment on", "your visit on", "sua visita no dia", "su cita del",
];
const REVIEW_LINK_RE = /g\.page\/r\/|writereview|search\.google\.[a-z.]+\/local\/(?:write)?reviews?|google\.[a-z.]+\/maps\/.*reviews?|maps\.app\.goo\.gl|goo\.gl\/maps|placeid=/i;
const linkNorm = (u) => fold(u).replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#.,;)\s]+$/, "");

/** Decide se um texto pode virar resposta pública.
 *  ctx: { stars, reviewText, reviewLink, contact:{kind,value}|null, business, author:'ai'|'owner' }
 *  → { ok, blocks:[{code,detail}], warnings:[{code,detail}] }
 *  RASCUNHO DA IA (author 'ai'): tudo abaixo BLOQUEIA — a IA não tem autoridade para prometer,
 *  afirmar resultado clínico nem expor nada. TEXTO DO DONO (author 'owner'): o dono é a
 *  autoridade sobre oferta e sobre o que dizer; para ele o link de avaliação, texto vazio e o
 *  limite de tamanho do Google continuam bloqueando, e o resto vira AVISO antes de publicar. */
export function checkReply(text, ctx = {}) {
  const t = str(text, 20000).trim();
  const author = ctx.author === "owner" ? "owner" : "ai";
  const blocks = [], warnings = [];
  const soft = (code, detail) => (author === "owner" ? warnings : blocks).push({ code, detail });
  const hard = (code, detail) => blocks.push({ code, detail });
  if (!t) { hard("empty", "Reply text is empty."); return { ok: false, blocks, warnings }; }
  // "The maximum length is 4096 bytes." — bytes, não caracteres.
  if (new TextEncoder().encode(t).length > 4096) hard("too_long", "Reply is longer than Google's 4096-byte limit.");

  const dobrado = fold(t);
  // (a) O LINK DE AVALIAÇÃO — nunca, de ninguém.
  const links = t.match(URL_RE) || [];
  const rl = ctx.reviewLink ? linkNorm(ctx.reviewLink) : "";
  const ehLinkDeAvaliacao = (u) => REVIEW_LINK_RE.test(u) || (rl && (linkNorm(u) === rl || linkNorm(u).includes(rl) || rl.includes(linkNorm(u)) && linkNorm(u).length > 8));
  if (links.some(ehLinkDeAvaliacao) || (rl && dobrado.includes(rl))) hard("review_link", "Reply contains the review link — a public reply never points a reviewer at the review link.");
  else if (links.length) soft("link", "Reply contains a link.");

  // (b) OFERTA / REEMBOLSO / DESCONTO
  if (OFFER_RE.test(t)) soft("offer", "Reply offers a refund, discount, credit or something free.");
  // (c) ALEGAÇÃO MÉDICA
  if (MEDICAL_RE.test(t)) soft("medical_claim", "Reply makes a medical or guaranteed-result claim.");

  // (d) CONTATO — só o telefone/e-mail REAL do negócio. Qualquer outro número/e-mail ou é
  //     inventado ou é dado de alguém (talvez do próprio cliente).
  const contato = ctx.contact && ctx.contact.value ? ctx.contact : null;
  const foneOk = contato && contato.kind === "phone" ? soDigitos(contato.value) : "";
  const mailOk = contato && contato.kind === "email" ? contato.value.toLowerCase() : "";
  const fones = (t.match(PHONE_RE) || []).map(soDigitos).filter((d) => d.length >= 7);
  const mails = (t.match(EMAIL_RE) || []).map((m) => m.toLowerCase());
  const foneEstranho = fones.some((d) => !(foneOk && (d === foneOk || foneOk.endsWith(d) || d.endsWith(foneOk))));
  const mailEstranho = mails.some((m) => m !== mailOk);
  if (foneEstranho || mailEstranho) {
    soft(contato ? "unknown_contact" : "contact_without_source", contato
      ? "Reply contains a phone number or e-mail that is not the business's own contact."
      : "Reply offers a phone number or e-mail, but the business has no phone or e-mail on file.");
  }

  // (e) DETALHE PRIVADO do cliente que ele mesmo não escreveu.
  const avaliacao = fold(ctx.reviewText || "");
  const vazou = SENSITIVE.filter((w) => new RegExp(`\\b${w.replace(/ /g, "\\s+")}`, "i").test(dobrado) && !avaliacao.includes(w));
  if (vazou.length) soft("private_detail", `Reply mentions something the reviewer did not write: ${vazou.slice(0, 3).join(", ")}.`);

  // (f) O PISO DA CASA — promessa não autorizada, vazamento de identidade, eco de injeção.
  const piso = validateOutput(t, { audience: "public", asBusiness: true, business: ctx.business || "", channel: "review" });
  for (const f of piso.flags) {
    if (f.code === "unauthorized_promise") { if (![...blocks, ...warnings].some((x) => x.code === "offer")) soft("offer", f.detail); }
    else soft(f.code, f.detail);
  }
  return { ok: blocks.length === 0, blocks, warnings };
}

/** Nome do avaliador como DADO para o modelo: uma linha, curto, sem nada que pareça instrução. */
export function safeReviewerName(name) {
  return str(name, 200).replace(/[\r\n\t"`<>{}[\]\\]/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 3).join(" ").slice(0, 40);
}
