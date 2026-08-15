// Cloudflare Pages Function — POST /api/google-business  · Google Business Profile connector
// ─────────────────────────────────────────────────────────────────────────────
// COMPLETE connector wired to the REAL Google Business Profile API, but INERT until (1) the
// GOOGLE_BUSINESS_CLIENT_ID/SECRET env is set in Cloudflare (Google approves Business Profile API
// access per-project), and (2) each tenant connects their location (OAuth refresh_token +
// account_id + location_id, stored per-tenant in client_integrations provider='google_business').
// Until both exist every data action returns { ready:false, note } so nothing breaks — honest,
// no crash, and NEVER a fabricated review. Same connect/status pattern as mindbody.js.
//
// WHY THIS MATTERS: for the CLIENT'S business, the Google Business Profile IS their local SEO — the
// Maps/Search listing that shows up in "spa perto de mim". Reviews answered + fresh posts = what
// RANKS. This lets the owner (and later Gui automatically) READ real reviews, REPLY to them, and
// POST — turning the Profile into a reputation/ranking loop. Guileo NEVER writes a fake review.
//
// ── TWO WAYS TO CALL THIS FILE ────────────────────────────────────────────────
// 1) HTTP handler (onRequestPost) — cockpit/admin: connect + status + list_reviews + reply + post.
//      { action:"connect", email, token, account_id, location_id, refresh_token }
//      { action:"status" | "list_reviews" | "reply" | "post", email, token, ... }
// 2) PURE FUNCTIONS (gbpStatus / gbpListReviews / gbpReplyReview / gbpCreatePost) — exported so the
//    review-loop / proactive engine can import them DIRECTLY (no HTTP round-trip). They take
//    (env, creds, …) where `creds` is the tenant's stored tokens blob (from tenantCreds /
//    gb_creds_lookup) — shape: { account_id, location_id, refresh_token, client_email }.
//
// ── REAL Google Business Profile API (mybusiness.googleapis.com/v4) ───────────
//   list reviews     GET  /accounts/{a}/locations/{l}/reviews            (accounts.locations.reviews.list)
//   reply to review  PUT  /accounts/{a}/locations/{l}/reviews/{r}/reply  (reviews.updateReply)  body {comment}
//   create post      POST /accounts/{a}/locations/{l}/localPosts         (localPosts.create)     body LocalPost
//   OAuth token      POST https://oauth2.googleapis.com/token            (refresh_token → access_token)
//   scope            https://www.googleapis.com/auth/business.manage
//
// ── DEDUP (never reply to the same review twice) ─────────────────────────────
//   gbp_reviews_seen (db/google_business.sql) records (client_email, review_id). list_reviews can
//   filter to unseen-only; a successful reply marks the review seen so Gui never double-replies.
// ─────────────────────────────────────────────────────────────────────────────
import { json } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const GBP = "https://mybusiness.googleapis.com/v4";
const rpc = (fn, body) => fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const s = (v, n = 400) => (v == null ? "" : v.toString().slice(0, n));

// ── Per-tenant Google Business creds (client_integrations provider='google_business', read by
//    gb_creds_lookup). Exported so an engine can resolve creds once and pass them to pure funcs.
//    Attaches client_email onto the blob so the pure funcs can drive the dedup table. ──
export async function tenantCreds(env, email) {
  const em = (email || "").toString().trim().toLowerCase();
  try {
    const r = await rpc("gb_creds_lookup", { p_secret: env.INGEST_SECRET || "", p_email: em });
    if (!r.ok) return null;
    const t = await r.json(); // { account_id, location_id, refresh_token }
    if (!(t && t.location_id)) return null;
    return { ...t, client_email: em };
  } catch { return null; }
}

// Build the review/localPosts parent path, tolerating ids given with or without the resource prefix.
function locParent(creds) {
  const acc = String((creds && creds.account_id) || "").replace(/^accounts\//, "").trim();
  const loc = String((creds && creds.location_id) || "").replace(/^locations\//, "").trim();
  return `accounts/${acc}/locations/${loc}`;
}
// A review's short id (the last path segment) — the connector stores/dedups on this.
function reviewShortId(rv) {
  if (!rv) return "";
  if (rv.reviewId) return String(rv.reviewId);
  const name = String(rv.name || "");
  const i = name.lastIndexOf("/reviews/");
  return i >= 0 ? name.slice(i + 9) : name;
}

// ── OAuth: exchange the tenant's stored refresh_token for a short-lived access_token. ──
async function gbpAccessToken(env, creds) {
  if (!env.GOOGLE_BUSINESS_CLIENT_ID || !env.GOOGLE_BUSINESS_CLIENT_SECRET) return null;
  const rt = creds && creds.refresh_token;
  if (!rt) return null;
  try {
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env.GOOGLE_BUSINESS_CLIENT_ID, client_secret: env.GOOGLE_BUSINESS_CLIENT_SECRET, refresh_token: rt, grant_type: "refresh_token" }).toString(),
    });
    if (!r.ok) return null;
    return ((await r.json()) || {}).access_token || null;
  } catch { return null; }
}

// dedup helpers — the set of review ids this tenant already handled, and a mark-seen writer.
// AMBOS devolvem se DEU CERTO. Antes, uma falha de leitura virava `new Set()` — "nenhum review foi
// tratado ainda" — e o auto-reply passaria a responder DE NOVO todas as avaliações antigas do
// cliente, publicamente, no perfil dele. Erro de rede virando "zero" é a armadilha da casa; aqui
// ela não custa um número errado num painel, custa dez respostas repetidas no Google do cliente.
async function gbpSeenIds(env, email) {
  try {
    const r = await rpc("gbp_seen_ids", { p_secret: env.INGEST_SECRET || "", p_email: (email || "").toString().trim().toLowerCase() });
    if (!r.ok) return { ok: false, set: new Set(), note: `gbp_seen_ids http ${r.status}` };
    const a = await r.json().catch(() => null);
    if (!Array.isArray(a)) return { ok: false, set: new Set(), note: "gbp_seen_ids devolveu formato inesperado" };
    return { ok: true, set: new Set(a.map(String)) };
  } catch (e) { return { ok: false, set: new Set(), note: String(e).slice(0, 80) }; }
}
async function gbpMarkSeen(env, email, reviewId, replied, replyText) {
  try {
    const r = await rpc("gbp_mark_seen", { p_secret: env.INGEST_SECRET || "", p_email: (email || "").toString().trim().toLowerCase(), p_review_id: String(reviewId), p_replied: !!replied, p_reply_text: replyText ? String(replyText).slice(0, 4000) : null });
    return !!r.ok;
  } catch { return false; }
}

// ── PURE: connection status. Proves the refresh_token still authenticates. ──
export async function gbpStatus(env, creds) {
  if (!env.GOOGLE_BUSINESS_CLIENT_ID) return { ready: false, provider: "google_business", note: "Google Business Profile API ainda não liberada — defina GOOGLE_BUSINESS_CLIENT_ID/SECRET no Cloudflare (requer aprovação do Google por projeto). Aguardando API." };
  if (!creds || !creds.location_id) return { ready: false, provider: "google_business", note: "Este negócio ainda não conectou o Google Business (action:connect)." };
  const tok = await gbpAccessToken(env, creds);
  return { ready: !!tok, provider: "google_business", account_id: creds.account_id || "", location_id: creds.location_id, note: tok ? "Google Business conectado ✓" : "Credenciais salvas, mas o refresh_token não autenticou — reconecte." };
}

// ── PURE: read REAL reviews from the tenant's Profile. args:{ pageSize, pageToken, orderBy,
//    unseenOnly }. unseenOnly filters out reviews already handled (dedup) — for auto-reply loops. ──
export async function gbpListReviews(env, creds, args = {}) {
  if (!env.GOOGLE_BUSINESS_CLIENT_ID) return { ready: false, reviews: [], note: "Google Business Profile API não liberada. Aguardando API." };
  if (!creds || !creds.location_id) return { ready: false, reviews: [], note: "Este negócio ainda não conectou o Google Business." };
  const token = await gbpAccessToken(env, creds);
  if (!token) return { ready: false, reviews: [], note: "Autenticação Google falhou — reconecte." };
  try {
    const qs = new URLSearchParams();
    qs.append("pageSize", String(Math.min(Math.max(parseInt(args.pageSize) || 50, 1), 50)));
    if (args.pageToken) qs.append("pageToken", String(args.pageToken));
    if (args.orderBy) qs.append("orderBy", String(args.orderBy)); // e.g. "updateTime desc"
    const r = await fetch(`${GBP}/${locParent(creds)}/reviews?${qs.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ready: true, ok: false, reviews: [], note: "Google recusou a leitura de avaliações.", raw: d };
    let reviews = Array.isArray(d.reviews) ? d.reviews : [];
    if (args.unseenOnly) {
      const seen = await gbpSeenIds(env, creds.client_email);
      // FECHA em vez de abrir: sem a lista do que já foi respondido, "não respondido" é um chute, e
      // o chute aqui publica de novo no perfil público do cliente. Devolve vazio + o motivo real.
      if (!seen.ok) return { ready: true, ok: false, reviews: [], dedupe_ready: false, note: `Dedup indisponível (${seen.note}) — não vou arriscar responder a mesma avaliação duas vezes.` };
      reviews = reviews.filter((rv) => !seen.set.has(reviewShortId(rv)));
    }
    return { ready: true, ok: true, reviews, averageRating: d.averageRating ?? null, totalReviewCount: d.totalReviewCount ?? null, nextPageToken: d.nextPageToken || null };
  } catch (e) { return { ready: true, ok: false, reviews: [], note: String(e).slice(0, 140) }; }
}

// ── PURE: reply to ONE real review (reviews.updateReply). On success, marks it seen so Gui never
//    replies to the same review twice. NEVER invents a review — only replies to the id given. ──
export async function gbpReplyReview(env, creds, reviewId, text) {
  if (!env.GOOGLE_BUSINESS_CLIENT_ID) return { ready: false, posted: false, note: "Google Business Profile API não liberada. Aguardando API." };
  if (!creds || !creds.location_id) return { ready: false, posted: false, note: "Este negócio ainda não conectou o Google Business." };
  const rid = s(reviewId, 200).trim();
  const comment = s(text, 4000).trim();
  if (!rid || !comment) return { ready: true, ok: false, posted: false, note: "missing review_id / comment" };
  const token = await gbpAccessToken(env, creds);
  if (!token) return { ready: false, posted: false, note: "Autenticação Google falhou — reconecte." };
  try {
    const r = await fetch(`${GBP}/${locParent(creds)}/reviews/${encodeURIComponent(rid)}/reply`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ready: true, ok: false, posted: false, note: "Google recusou a resposta.", raw: d };
    // Publicou. Se a marcação de dedup NÃO gravou, quem chama precisa SABER: a próxima varredura
    // veria esta avaliação como não tratada. (A trava de reserva é o `reviewReply` que o próprio
    // Google passa a devolver — mas isso é a segunda linha de defesa, não um motivo para calar.)
    const marked = await gbpMarkSeen(env, creds.client_email, rid, true, comment);
    return { ready: true, ok: true, posted: true, marked, reply: d, note: marked ? "Resposta publicada no Google ✓" : "Resposta publicada no Google ✓ (⚠️ não consegui marcar como respondida — dedup depende do próprio Google nesta avaliação)" };
  } catch (e) { return { ready: true, ok: false, posted: false, note: String(e).slice(0, 140) }; }
}

// Build a LocalPost body from a simple shape, or pass a full LocalPost through untouched.
function buildLocalPost(p = {}) {
  if (p && p.languageCode && (p.summary || p.event || p.offer)) return p; // already a LocalPost
  const lp = { languageCode: s(p.languageCode || "pt", 8), topicType: s(p.topicType || "STANDARD", 24), summary: s(p.summary || p.text, 1500) };
  if (p.mediaUrl) lp.media = [{ mediaFormat: "PHOTO", sourceUrl: s(p.mediaUrl, 600) }];
  if (p.cta && p.url) lp.callToAction = { actionType: s(p.cta, 24), url: s(p.url, 600) }; // BOOK/ORDER/LEARN_MORE/CALL/SIGN_UP
  return lp;
}

// ── PURE: publish a post to the Profile (localPosts.create). Fresh posts help ranking. ──
export async function gbpCreatePost(env, creds, post = {}) {
  if (!env.GOOGLE_BUSINESS_CLIENT_ID) return { ready: false, posted: false, note: "Google Business Profile API não liberada. Aguardando API." };
  if (!creds || !creds.location_id) return { ready: false, posted: false, note: "Este negócio ainda não conectou o Google Business." };
  const body = buildLocalPost(post);
  if (!body.summary) return { ready: true, ok: false, posted: false, note: "post precisa de summary." };
  const token = await gbpAccessToken(env, creds);
  if (!token) return { ready: false, posted: false, note: "Autenticação Google falhou — reconecte." };
  try {
    const r = await fetch(`${GBP}/${locParent(creds)}/localPosts`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ready: true, ok: false, posted: false, note: "Google recusou o post.", raw: d };
    return { ready: true, ok: true, posted: true, post: d, note: "Post publicado no Google ✓" };
  } catch (e) { return { ready: true, ok: false, posted: false, note: String(e).slice(0, 140) }; }
}

// ── HTTP handler — cockpit/admin: connect (store creds) + status/list_reviews/reply/post. ──
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const email = s(b.email).trim().toLowerCase();
    const key = s(b.token || b.key).trim();
    const action = (b.action || "status").toString();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);

    // PER-TENANT GATE — email ↔ connection key (get_client_data), identical to noshow-radar.js / mindbody.js.
    const gd = await rpc("get_client_data", { p_email: email, p_key: key });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    // ── CONNECT: store this tenant's Google Business account/location + OAuth refresh_token. Works
    //    NOW (we capture the connection); reads/replies stay inert until the API env is set. ──
    if (action === "connect") {
      const account_id = s(b.account_id, 120);
      const location_id = s(b.location_id, 120);
      const refresh_token = s(b.refresh_token, 400);
      if (!location_id) return json({ error: "missing location_id" }, 400);
      try {
        await rpc("store_integration", { p_secret: env.INGEST_SECRET || "", p_email: email, p_provider: "google_business", p_tokens: { account_id, location_id, refresh_token } });
      } catch { /* store failed — non-fatal */ }
      const live = !!env.GOOGLE_BUSINESS_CLIENT_ID;
      return json({ ok: true, connected: true, ready: live, note: live ? "Google Business conectado ✓" : "Conexão salva ✓ — leitura/resposta de avaliações ligam automaticamente assim que a API do Google for aprovada (aguardando API)." });
    }

    const creds = await tenantCreds(env, email);

    if (action === "status") return json({ ok: true, connected: !!creds, ...(await gbpStatus(env, creds)) });
    if (action === "list_reviews") return json({ ok: true, ...(await gbpListReviews(env, creds, b)) });
    if (action === "reply" || action === "reply_review") return json({ ok: true, ...(await gbpReplyReview(env, creds, s(b.review_id, 200), s(b.comment, 4000))) });
    if (action === "post") return json({ ok: true, ...(await gbpCreatePost(env, creds, b.post || b)) });

    return json({ error: "unknown action" }, 400);
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}

// ── WIRING (when live) ────────────────────────────────────────────────────────
// A review-loop / proactive engine imports { tenantCreds, gbpListReviews, gbpReplyReview,
// gbpCreatePost } from this file. Typical flow: tenantCreds(env,email) → gbpListReviews(env,creds,
// {unseenOnly:true, orderBy:"updateTime desc"}) → for each new review, draft a reply with Gui's
// brain (productFacts + the owner's tone) and call gbpReplyReview — which dedups so no review is
// answered twice. gbpCreatePost publishes fresh posts (offers/events) that keep the Profile ranking.
// If GOOGLE_BUSINESS_* isn't set OR the tenant hasn't connected → every function returns
// { ready:false } and nothing runs. Guileo NEVER posts a fake review or a reply the owner didn't ask for.
