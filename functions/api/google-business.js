// Cloudflare Pages Function — POST /api/google-business · Perfil de Empresa no Google (avaliações)
// ─────────────────────────────────────────────────────────────────────────────
// O QUE ESTE ENDPOINT FAZ (reescrito em 2026-09-30, depois da revisão):
//   • lê as avaliações de TODAS as fichas confirmadas do negócio (paginado, com teto);
//   • mostra e deixa o dono CORRIGIR qual ficha do Google é qual unidade dele;
//   • guarda a FILA de respostas (rascunho → aprovado → publicado) e só publica no Google depois
//     de uma ação explícita do dono no painel. Não existe caminho automático até o PUT.
//
// O QUE ELE NÃO FAZ MAIS
//   • `connect` não grava credencial. Antes, qualquer tenant podia sobrescrever o blob do OAuth
//     com ids e token arbitrários (e a falha de gravação era engolida). Token só nasce no
//     /api/google-oauth-callback.
//   • `reply` direto não existe: toda resposta passa pela fila.
//
// HONESTO-INERTE: o Google aprova a API por projeto. Enquanto não aprovar, `state` diz
// `api_pending` e nada é lido — nunca uma avaliação inventada, nunca um "0" no lugar de "não li".
//
// AÇÕES (todas com { email, token } do tenant — portão get_client_data, igual noshow-radar.js):
//   status · discover · map_locations · list_reviews
//   queue_list · queue_write · queue_edit · queue_approve · queue_reject · queue_publish
//
// 🔒 Nenhuma resposta carrega token. Motivo técnico vai em `detalhe_tecnico`, a frase é da tela.
// ─────────────────────────────────────────────────────────────────────────────
import { json, rateLimited } from "../lib/guard.js";
import { svcJson, svcRpc } from "../lib/sb.js";
import {
  apiConfigured, stateOf, loadCreds, storeCreds, accessToken, callWithToken, googleCall,
  fetchBizLocations, buildDiscoveredBlob, listAllReviews, putReply,
} from "../lib/googleGbp.js";
import {
  publicLocations, includedLocations, applyOwnerMapping, reviewStats, overallFromGoogle,
  normalizeReview, checkReply, redact,
} from "../lib/googleReviews.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const GBP_V4 = "https://mybusiness.googleapis.com/v4";
const s = (v, n = 400) => (v == null ? "" : v.toString().slice(0, n));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const WRITES = new Set(["discover", "map_locations", "queue_write", "queue_edit", "queue_approve", "queue_reject", "queue_publish"]);

// ── a fila (db/google_reviews_fila.sql) ──────────────────────────────────────────────────────
// Falha de transporte do svcJson = { ok:false, erro_http, detalhe }. Recusa da função do banco =
// { ok:false, error:'…' }. As duas viram { ok:false, motivo } — nunca uma lista vazia.
export async function fila(env, fn, args) {
  const r = await svcJson(env, fn, { p_secret: env.INGEST_SECRET || "", ...args });
  if (!r || typeof r !== "object") return { ok: false, motivo: "queue_unavailable", detalhe: "empty response" };
  if (r.erro_http || (r.ok === false && r.detalhe)) return { ok: false, motivo: "queue_unavailable", detalhe: redact(`${r.erro_http || ""} ${r.detalhe || ""}`).trim().slice(0, 200) };
  if (r.ok !== true) { const { error: motivo } = r; return { ok: false, motivo: s(motivo, 60) || "queue_error", status: r.status }; }
  return r;
}

async function perfil(env, email) {
  const r = await svcJson(env, "get_client_profile", { p_secret: env.INGEST_SECRET || "", p_email: email });
  return r && typeof r === "object" && !r.erro_http && r.ok !== false ? r : {};
}

function visao(env, blob, biz) {
  const state = stateOf(env, blob);
  const d = blob && blob.discovery && typeof blob.discovery === "object" ? blob.discovery : null;
  const locations = publicLocations(blob, biz && biz.ok ? biz.locations : []);
  return {
    state,
    connected: state !== "not_connected",
    ready: state === "ready",
    api_configured: apiConfigured(env),
    needs_reconsent: state === "needs_reconsent",
    locations,
    included: locations.filter((l) => l.include).length,
    pending_mapping: locations.filter((l) => !l.include && l.match !== "owner").length,
    biz_locations: biz && biz.ok ? biz.locations.filter((b) => b.active !== false).map((b) => ({ id: b.id, name: b.name, address: b.address })) : null,
    accounts: blob && Array.isArray(blob.accounts) ? blob.accounts.length : 0,
    discovery: d ? { ok: d.ok === true, at: s(d.at, 40), code: s(d.code, 40), partial: d.partial === true } : null,
    connected_at: s(blob && blob.connected_at, 40),
  };
}

// ── publicar UMA linha aprovada. Só é chamada pela ação queue_publish (dono, no painel). ──
async function publicar(env, ctx, id) {
  const state = stateOf(env, ctx.blob);
  if (state !== "ready") return { ok: false, published: false, error: "not_ready", state };
  const c = await fila(env, "gbp_fila_claim", { p_email: ctx.email, p_id: id });
  if (!c.ok) return { ok: false, published: false, error: c.motivo, status_da_linha: c.status || null, detalhe_tecnico: c.detalhe || "" };
  const row = c.row;
  const falhou = async (motivo, extra = {}) => {
    const g = await fila(env, "gbp_fila_result", { p_email: ctx.email, p_id: id, p_ok: false, p_google: extra.google || null, p_state: null, p_error: s(motivo, 600) });
    return { ok: false, published: false, error: extra.error || "google_refused", code: extra.code || "", detalhe_tecnico: s(motivo, 300), row: g.ok ? g.row : null, recorded: g.ok };
  };
  // a ficha TEM que ser uma das confirmadas DESTA conexão — o caminho do PUT sai do blob do
  // tenant, nunca do que veio na requisição.
  const loc = includedLocations(ctx.blob).find((l) => String(l.location_id) === String(row.location_id));
  if (!loc) return falhou("location is not one of this account's confirmed Google listings", { error: "location_not_connected" });
  const p = await perfil(env, ctx.email);
  const regra = checkReply(row.draft_text, { author: "owner", reviewLink: p.review_link || "", reviewText: row.review_text || "" });
  if (!regra.ok) return falhou(`blocked: ${regra.blocks.map((x) => x.code).join(",")}`, { error: "blocked", code: regra.blocks[0].code });

  const r = await putReply(env, ctx, loc, row.review_id, row.draft_text);
  if (!r.ok) return { ...(await falhou(`${r.code}${r.status ? ` (http ${r.status})` : ""}${r.detail ? `: ${r.detail}` : ""}`, { code: r.code })), state: stateOf(env, ctx.blob) };
  const reply = r.data && typeof r.data === "object" ? r.data : {};
  const gstate = s(reply.reviewReplyState, 40);
  const google = { comment: s(reply.comment, 4096), updateTime: s(reply.updateTime, 40), reviewReplyState: gstate, policyViolation: s(reply.policyViolation, 80) };
  if (gstate === "REJECTED") return falhou(`rejected by Google${google.policyViolation ? `: ${google.policyViolation}` : ""}`, { code: "rejected_by_google", google });

  const g = await fila(env, "gbp_fila_result", { p_email: ctx.email, p_id: id, p_ok: true, p_google: google, p_state: gstate || null, p_error: null });
  // dedup legado + linha do tempo do cliente: melhor-esforço, e o resultado de cada um é conferido
  let marked;
  try { const m = await svcRpc(env, "gbp_mark_seen", { p_secret: env.INGEST_SECRET || "", p_email: ctx.email, p_review_id: String(row.review_id), p_replied: true, p_reply_text: s(row.draft_text, 4000) }); marked = m.ok; } catch { marked = false; }
  try { await svcRpc(env, "ingest_client_event", { p_secret: env.INGEST_SECRET || "", p_email: ctx.email, p_type: "review_reply", p_channel: "google", p_summary: `Reply published on Google${row.stars ? ` (${row.stars}★ review)` : ""} — approved by the owner`, p_amount: 0, p_payload: { review_id: row.review_id, location_id: row.location_id, stars: row.stars } }); } catch { /* melhor-esforço */ }
  // Publicou de verdade. Se o registro não gravou, a tela PRECISA saber (a linha ficaria "approved").
  return { ok: true, published: true, google_state: gstate || null, recorded: g.ok, row: g.ok ? g.row : null, marked, ...(g.ok ? {} : { detalhe_tecnico: `published, but the queue row was not updated: ${g.motivo}` }) };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (await rateLimited(request, env, "google-business", 90)) return json({ ok: false, error: "too_many_requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const email = s(b.email, 160).trim().toLowerCase();
    const key = s(b.token || b.key, 200).trim();
    const action = s(b.action || "status", 40);
    if (!email.includes("@") || !key) return json({ ok: false, error: "unauthorized" }, 401);

    // PORTÃO DO TENANT — e-mail ↔ chave de conexão.
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_email: email, p_key: key }) });
    if (!gd.ok) return json({ ok: false, error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ ok: false, error: "unauthorized" }, 401);

    if (WRITES.has(action) && await rateLimited(request, env, "google-business-write", 30)) return json({ ok: false, error: "too_many_requests" }, 429);

    // `connect` e `reply` eram as duas portas por onde um tenant gravava credencial arbitrária ou
    // publicava sem fila. Ficam FECHADAS, com o motivo dito.
    if (action === "connect") return json({ ok: false, error: "connect_via_oauth", note: "Google is connected by signing in (Connect button). Credentials are never accepted through this endpoint." }, 400);
    if (action === "reply" || action === "reply_review") return json({ ok: false, error: "use_queue", note: "Replies go through the approval queue: queue_write → queue_approve → queue_publish." }, 400);

    const c = await loadCreds(env, email);
    if (!c.ok) return json({ ok: false, error: "creds_unavailable", detalhe_tecnico: c.error }, 503);
    const ctx = { email, blob: c.blob };

    // ── STATUS — lido do que está GRAVADO. Não chama o Google. ─────────────────────────────
    if (action === "status") {
      const biz = c.blob ? await fetchBizLocations(env, email) : null;
      return json({ ok: true, ...visao(env, ctx.blob, biz) });
    }

    // ── DISCOVER — busca de novo todas as contas e fichas (o dono clica "verificar de novo") ──
    if (action === "discover") {
      const antes = stateOf(env, ctx.blob);
      if (["not_connected", "needs_reconsent", "needs_scope"].includes(antes) || !apiConfigured(env)) return json({ ok: true, discovered: false, ...visao(env, ctx.blob, null) });
      const t = await accessToken(env, ctx);
      if (!t.ok) return json({ ok: true, discovered: false, detalhe_tecnico: `${t.code} ${t.detail || ""}`.trim(), ...visao(env, ctx.blob, null) });
      const built = await buildDiscoveredBlob(env, email, ctx.blob, callWithToken(t.token), ctx.blob);
      const st = await storeCreds(env, email, built.blob);
      if (!st.ok) return json({ ok: false, error: "store_failed", detalhe_tecnico: st.error }, 503);
      return json({ ok: true, discovered: built.discovery.ok === true, ...visao(env, st.blob, built.biz || await fetchBizLocations(env, email)) });
    }

    // ── MAP_LOCATIONS — o dono confirma/corrige qual ficha é qual unidade ───────────────────
    if (action === "map_locations") {
      if (!ctx.blob || !Array.isArray(ctx.blob.locations) || !ctx.blob.locations.length) return json({ ok: false, error: "no_locations" }, 400);
      const edits = (Array.isArray(b.mappings) ? b.mappings : []).slice(0, 200).map((e) => ({ location_id: s(e && e.location_id, 120), biz_location_id: e && e.biz_location_id ? s(e.biz_location_id, 60) : null, include: !(e && e.include === false) }));
      const biz = await fetchBizLocations(env, email);
      // sem conseguir LER as unidades não dá para conferir que a unidade escolhida é deste tenant
      if (!biz.ok && edits.some((e) => e.biz_location_id)) return json({ ok: false, error: "biz_locations_unavailable", detalhe_tecnico: biz.error }, 503);
      const m = applyOwnerMapping(ctx.blob.locations, edits, biz.ok ? biz.locations : []);
      if (!m.ok) return json({ ok: false, error: "invalid_mapping", problems: m.errors.slice(0, 10) }, 400);
      const primeira = m.locations.find((l) => l.include) || m.locations[0];
      const st = await storeCreds(env, email, { ...ctx.blob, locations: m.locations, account_id: primeira ? primeira.account_id : "", location_id: primeira ? primeira.location_id : "", mapped_at: new Date().toISOString() });
      if (!st.ok) return json({ ok: false, error: "store_failed", detalhe_tecnico: st.error }, 503);
      return json({ ok: true, saved: true, ...visao(env, st.blob, biz) });
    }

    // ── LIST_REVIEWS — todas as fichas confirmadas, paginado, normalizado ───────────────────
    if (action === "list_reviews") {
      const state = stateOf(env, ctx.blob);
      if (state !== "ready") return json({ ok: true, state, ready: false, reviews: [], per_location: [] });
      const biz = await fetchBizLocations(env, email);
      const labels = new Map(publicLocations(ctx.blob, biz.ok ? biz.locations : []).map((l) => [String(l.location_id), l.label]));
      const maxPages = Math.min(Math.max(parseInt(b.max_pages, 10) || 4, 1), 6);   // 50/página → até 300 por ficha
      const r = await listAllReviews(env, ctx, { locationId: s(b.location_id, 120), maxPages, labels });
      const depois = stateOf(env, ctx.blob);   // um invalid_grant no meio da leitura muda o estado
      return json({
        ok: true, state: depois, ready: depois === "ready",
        reviews: r.reviews, per_location: r.per_location,
        locations_read: r.locations_read, locations_total: r.locations_total,
        google: overallFromGoogle(r.per_location),          // números do próprio Google (todas as avaliações)
        read: reviewStats(r.reviews),                        // números do que foi lido agora
      });
    }

    // ── A FILA ──────────────────────────────────────────────────────────────────────────────
    if (action === "queue_list") {
      const q = await fila(env, "gbp_fila_list", { p_email: email, p_status: s(b.status, 20) || null, p_limit: 200 });
      if (!q.ok) return json({ ok: false, error: q.motivo, detalhe_tecnico: q.detalhe || "" }, 503);
      return json({ ok: true, rows: Array.isArray(q.rows) ? q.rows : [], counts: q.counts || {} });
    }

    if (action === "queue_write") {
      // O dono escreve uma resposta do zero. A avaliação é BUSCADA no Google pela ficha do
      // próprio tenant: id de avaliação de outro negócio não existe nesse caminho e é recusado.
      const state = stateOf(env, ctx.blob);
      if (state !== "ready") return json({ ok: false, error: "not_ready", state }, 400);
      const text = s(b.text, 6000).trim();
      const loc = includedLocations(ctx.blob).find((l) => String(l.location_id) === s(b.location_id, 120));
      const reviewId = s(b.review_id, 300).trim();
      if (!loc) return json({ ok: false, error: "location_not_connected" }, 400);
      if (!reviewId || /[/?#\s]/.test(reviewId)) return json({ ok: false, error: "bad_review_id" }, 400);
      const g = await googleCall(env, ctx, `${GBP_V4}/accounts/${encodeURIComponent(loc.account_id)}/locations/${encodeURIComponent(loc.location_id)}/reviews/${encodeURIComponent(reviewId)}`);
      if (!g.ok) return json({ ok: false, error: g.code === "not_found" ? "review_not_found" : "google_refused", code: g.code, detalhe_tecnico: g.detail || "", state: stateOf(env, ctx.blob) }, g.code === "not_found" ? 404 : 503);
      const rv = normalizeReview(g.data, loc);
      if (!rv || rv.id !== reviewId) return json({ ok: false, error: "review_not_found" }, 404);
      const p = await perfil(env, email);
      const regra = checkReply(text, { author: "owner", reviewLink: p.review_link || "", reviewText: rv.text, stars: rv.stars });
      if (!regra.ok) return json({ ok: false, error: "blocked", blocks: regra.blocks, warnings: regra.warnings }, 400);
      const biz = await fetchBizLocations(env, email);
      const label = (publicLocations(ctx.blob, biz.ok ? biz.locations : []).find((l) => l.location_id === String(loc.location_id)) || {}).label || "";
      const q = await fila(env, "gbp_fila_write", { p_email: email, p_by: email, p_row: {
        account_id: loc.account_id, location_id: loc.location_id, biz_location_id: loc.biz_location_id && UUID.test(String(loc.biz_location_id)) ? loc.biz_location_id : "",
        location_label: label, review_id: rv.id, stars: rv.stars == null ? "" : String(rv.stars), reviewer: rv.reviewer, review_text: rv.text,
        review_created_at: rv.createdAt || "", review_updated_at: rv.updatedAt || "", draft_text: text,
      } });
      if (!q.ok) return json({ ok: false, error: q.motivo, detalhe_tecnico: q.detalhe || "" }, q.motivo === "queue_unavailable" ? 503 : 409);
      return json({ ok: true, row: q.row, warnings: regra.warnings });
    }

    if (["queue_edit", "queue_approve", "queue_reject", "queue_publish"].includes(action)) {
      const id = s(b.id, 60).trim();
      if (!UUID.test(id)) return json({ ok: false, error: "bad_id" }, 400);

      if (action === "queue_edit") {
        const text = s(b.text, 6000).trim();
        const p = await perfil(env, email);
        const regra = checkReply(text, { author: "owner", reviewLink: p.review_link || "" });
        if (!regra.ok) return json({ ok: false, error: "blocked", blocks: regra.blocks, warnings: regra.warnings }, 400);
        const q = await fila(env, "gbp_fila_edit", { p_email: email, p_id: id, p_text: text, p_by: email });
        if (!q.ok) return json({ ok: false, error: q.motivo, detalhe_tecnico: q.detalhe || "" }, q.motivo === "queue_unavailable" ? 503 : q.motivo === "not_found" ? 404 : 409);
        return json({ ok: true, row: q.row, warnings: regra.warnings });
      }
      if (action === "queue_approve" || action === "queue_reject") {
        const q = await fila(env, "gbp_fila_decide", { p_email: email, p_id: id, p_decision: action === "queue_approve" ? "approved" : "rejected", p_by: email });
        if (!q.ok) return json({ ok: false, error: q.motivo, detalhe_tecnico: q.detalhe || "" }, q.motivo === "queue_unavailable" ? 503 : q.motivo === "not_found" ? 404 : 409);
        return json({ ok: true, row: q.row });
      }
      // queue_publish — a ÚNICA porta até o PUT no Google.
      const r = await publicar(env, ctx, id);
      return json(r, r.ok ? 200 : r.error === "not_found" ? 404 : r.error === "queue_unavailable" ? 503 : 200);
    }

    return json({ ok: false, error: "unknown_action" }, 400);
  } catch (e) { return json({ ok: false, error: "bad_request", detalhe_tecnico: redact(String(e)).slice(0, 160) }, 400); }
}
