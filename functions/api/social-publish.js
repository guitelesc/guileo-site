// Cloudflare Pages Function — POST /api/social-publish  ·  Meta/Social A+B publishing motor
// ─────────────────────────────────────────────────────────────────────────────
// The SAME Gui brain that answers voice/webchat/SMS (one brain, many channels) also WRITES the
// business's social posts — in THAT tenant's brand tone, from the real product facts + profile.
// This connector generates the post and moves it through its lifecycle with a HUMAN-IN-THE-LOOP:
//
//   MODE (per-tenant, client_integrations provider='meta' → tokens.publish_mode):
//     • "auto"    → generate AND publish straight to Meta (draft → published).
//     • "approve" → generate a DRAFT (status='pending_approval'); NOTHING is public until the owner
//                   approves it in the cockpit → then it publishes. DEFAULT when unset (public
//                   content is safest human-gated).
//
//   ACTIONS: draft (generate) · approve (publish an approved/pending draft) · schedule ·
//            list · get · set_mode · status.
//
// SAFETY (this posts PUBLICLY, on someone else's behalf):
//   • Per-tenant HTTP gate (get_client_data email↔key) — a token only ever touches its OWN posts.
//   • The generator is FORBIDDEN to promise refunds/discounts/guarantees or state any fact not in
//     the tenant's real facts (productFacts + profile + menu). It writes marketing copy, not claims.
//   • Every generated post carries an honest provenance flag (meta.generated_by='guileo').
//   • In "approve" mode NOTHING publishes without the human OK. In "auto" mode a 'published' row is
//     written ONLY after Meta actually accepts the post (external_id proof) — never optimistically.
//   • No META_APP_ID/SECRET env OR no connected tenant (page/IG token) → { ready:false, note } and
//     nothing goes out. Honest degradation, never a fake "posted".
//
// Two ways to call this file, like google-business.js:
//   1) HTTP handler (onRequestPost) — cockpit/admin.
//   2) PURE functions (generatePost / publishToMeta) — exported so a cron/proactive engine can
//      import them directly (no HTTP hop) to draft+publish on a schedule.
// ─────────────────────────────────────────────────────────────────────────────
import { json, rateLimited } from "../lib/guard.js";
import { factsBlock } from "../lib/productFacts.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const GRAPH = "https://graph.facebook.com/v20.0";
const rpc = (fn, body) => fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const s = (v, n = 400) => (v == null ? "" : v.toString().slice(0, n));
const MODEL_CHAIN = ["claude-fable-5", "claude-sonnet-5", "claude-haiku-4-5-20251001"];

// ── Per-tenant Meta integration blob (provider='meta'): publish_mode + page/IG tokens. ──
//    Shape: { publish_mode:'auto'|'approve', ig_user_id, page_id, page_access_token }
export async function tenantMeta(env, email) {
  try {
    const r = await rpc("social_meta_lookup", { p_secret: env.INGEST_SECRET || "", p_email: (email || "").toString().trim().toLowerCase() });
    if (!r.ok) return null;
    const t = await r.json().catch(() => null);
    return (t && typeof t === "object") ? t : null;
  } catch { return null; }
}
// Mode is a per-tenant choice; DEFAULT 'approve' (human-in-the-loop) when the tenant hasn't opted in.
function modeOf(meta) {
  return (meta && String(meta.publish_mode || "").toLowerCase() === "auto") ? "auto" : "approve";
}

// ── Tenant brand context for the generator (business name / industry / tone / real menu) — the
//    SAME sources the voice+webchat brain uses, so a post sounds like the business, not a bot. ──
async function brandContext(env, email) {
  const ctx = { business: "", industry: "", tone: "", brain: "", menu: [] };
  try {
    const r = await rpc("get_client_profile", { p_secret: env.INGEST_SECRET || "", p_email: email });
    if (r.ok) {
      const p = await r.json().catch(() => null);
      if (p && typeof p === "object") {
        const x = (p.extras && typeof p.extras === "object") ? p.extras : {};
        ctx.business = s(p.business_name || x.business_name, 160);
        ctx.industry = s(p.industry || x.industry, 80);
        ctx.tone = s(p.tone || x.tone || x.brand_voice, 200);
      }
    }
  } catch { /* profile optional */ }
  try {
    const g = await rpc("get_pending_onboarding", { p_secret: env.PEND_SECRET || "gx_pend_7Qk2mZ9vR4tLpW8n_cit3l3s", p_email: email });
    if (g.ok) { const rows = await g.json().catch(() => null); const row = Array.isArray(rows) ? rows[0] : rows; if (row) { ctx.brain = s(row.brain, 2500); ctx.business = ctx.business || s(row.business, 160); ctx.industry = ctx.industry || s(row.industry, 80); } }
  } catch { /* brain optional */ }
  try {
    const m = await rpc("biz_lookup", { p_secret: env.SCHED_SECRET || "", p_email: email });
    if (m.ok) { const menu = await m.json().catch(() => null); if (menu && Array.isArray(menu.services)) ctx.menu = menu.services.filter((v) => v && v.name).slice(0, 20); }
  } catch { /* menu optional */ }
  return ctx;
}

// ── PURE: GENERATE a post in the tenant's brand tone. Returns { content, media_url } or null.
//    HARD safety rules live in the system prompt: no invented facts, no unauthorized promises. ──
export async function generatePost(env, email, opts = {}) {
  if (!env.ANTHROPIC_API_KEY) return null;
  const ctx = await brandContext(env, email);
  const channel = (String(opts.channel || "instagram").toLowerCase() === "facebook") ? "facebook" : "instagram";
  const lang = ["en", "pt", "es", "hi"].includes(opts.lang) ? opts.lang : (ctx.lang || "en");
  const langName = lang === "pt" ? "Brazilian Portuguese" : lang === "es" ? "LatAm Spanish" : lang === "hi" ? "Hindi" : "English";
  const menuLines = ctx.menu.map((v) => `• ${v.name}${v.price_cents ? ` — $${(v.price_cents / 100).toFixed(0)}` : ""}`).join("\n");
  const system = [
    `You are Gui, writing an ${channel === "facebook" ? "Facebook" : "Instagram"} post FOR the business "${ctx.business || "this business"}"${ctx.industry ? ` (a ${ctx.industry} business)` : ""}, in ${langName}.`,
    `Write ONE short, warm, on-brand caption (2-4 sentences) that a real owner would be proud to post. ${channel === "instagram" ? "You may add up to 5 relevant hashtags at the end." : "No hashtags."}`,
    ctx.tone ? `Brand voice: ${ctx.tone}.` : `Voice: friendly, human, concrete — never corporate or spammy.`,
    ``,
    `SAFETY RULES (non-negotiable — this posts PUBLICLY in the business's name):`,
    `• NEVER promise a refund, discount, price, guarantee, giveaway, or any offer unless the user's brief EXPLICITLY provided that exact offer. Do not invent numbers.`,
    `• NEVER state a fact about the business you were not given below. If you don't know it, don't claim it.`,
    `• No medical/legal/financial claims. No superlatives you can't back ("the best", "#1") unless given.`,
    `• Marketing copy that INVITES (come in, book, ask us) is fine; a fabricated PROMISE is not.`,
    ``,
    ctx.brain ? `BUSINESS KNOWLEDGE (only real source of facts):\n${ctx.brain}` : ``,
    menuLines ? `SERVICES & PRICES (the only prices you may mention):\n${menuLines}` : ``,
    `\nGuileo product context (do NOT mention Guileo in the post — this is background only):\n${factsBlock()}`,
    `\nReply with ONLY the caption text — no preamble, no quotes, no JSON.`,
  ].filter(Boolean).join("\n");
  const brief = s(opts.prompt || opts.topic || "Write an inviting post that fits the business right now.", 800);
  for (const model of MODEL_CHAIN) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 380, system, messages: [{ role: "user", content: brief }] }),
      });
      if (r.ok) { const d = await r.json().catch(() => ({})); const txt = (d?.content?.[0]?.text || "").trim(); if (txt) return { content: txt.slice(0, 2200), media_url: s(opts.media_url, 600) || null, channel, lang, tone: ctx.tone || "" }; }
      else if (r.status === 401 || r.status === 402) break; // auth/billing won't improve with another model
    } catch { /* try next model */ }
  }
  return null;
}

// ── PURE: PUBLISH one already-created row to Meta. INERT (ready:false) until META_APP_* env AND the
//    tenant has connected page/IG tokens. Returns { ready, ok, external_id, note }. Never fakes it. ──
export async function publishToMeta(env, meta, post) {
  if (!env.META_APP_ID || !env.META_APP_SECRET) return { ready: false, ok: false, note: "Meta app ainda não aprovado — defina META_APP_ID/SECRET no Cloudflare (Business verification). Aguardando API." };
  if (!meta) return { ready: false, ok: false, note: "Este negócio ainda não conectou o Instagram/Facebook." };
  const token = s(meta.page_access_token, 500);
  if (!token) return { ready: false, ok: false, note: "Sem page_access_token — reconecte o Instagram/Facebook." };
  const channel = (String(post.channel || "instagram").toLowerCase() === "facebook") ? "facebook" : "instagram";
  const caption = s(post.content, 2200);
  if (!caption && !post.media_url) return { ready: true, ok: false, note: "post vazio" };
  try {
    if (channel === "instagram") {
      const ig = s(meta.ig_user_id, 64);
      if (!ig) return { ready: false, ok: false, note: "Sem ig_user_id conectado." };
      if (!post.media_url) return { ready: true, ok: false, note: "Instagram exige uma imagem (media_url)." };
      // 2-step IG content publishing: create a media container, then publish it.
      const c = await fetch(`${GRAPH}/${encodeURIComponent(ig)}/media`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_url: post.media_url, caption, access_token: token }) });
      const cd = await c.json().catch(() => ({}));
      if (!c.ok || !cd.id) return { ready: true, ok: false, note: "Instagram recusou a criação do post.", raw: cd };
      const pub = await fetch(`${GRAPH}/${encodeURIComponent(ig)}/media_publish`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creation_id: cd.id, access_token: token }) });
      const pd = await pub.json().catch(() => ({}));
      if (!pub.ok || !pd.id) return { ready: true, ok: false, note: "Instagram recusou a publicação.", raw: pd };
      return { ready: true, ok: true, external_id: String(pd.id), note: "Publicado no Instagram ✓" };
    }
    // Facebook Page feed post.
    const pageId = s(meta.page_id, 64);
    if (!pageId) return { ready: false, ok: false, note: "Sem page_id conectado." };
    const body = { message: caption, access_token: token };
    if (post.media_url) body.link = post.media_url;
    const r = await fetch(`${GRAPH}/${encodeURIComponent(pageId)}/feed`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.id) return { ready: true, ok: false, note: "Facebook recusou a publicação.", raw: d };
    return { ready: true, ok: true, external_id: String(d.id), note: "Publicado no Facebook ✓" };
  } catch (e) { return { ready: true, ok: false, note: String(e).slice(0, 140) }; }
}

// ── Helper: publish a stored row and record the outcome (published/failed) in social_posts. ──
async function publishRow(env, email, meta, row) {
  const res = await publishToMeta(env, meta, row);
  if (res.ok && res.external_id) {
    try { const r = await rpc("social_post_publish", { p_secret: env.INGEST_SECRET || "", p_email: email, p_id: row.id, p_external_id: res.external_id }); if (r.ok) { const updated = await r.json().catch(() => null); if (updated) row = updated; } } catch { /* row update best-effort */ }
    return { ...res, post: row };
  }
  // Only mark 'failed' when we actually TRIED and Meta rejected (ready:true). If the motor is inert
  // (ready:false — no env/creds), leave the row as-is so it publishes later when the app is live.
  if (res.ready) { try { await rpc("social_post_fail", { p_secret: env.INGEST_SECRET || "", p_email: email, p_id: row.id, p_error: res.note || "publish failed" }); } catch { /* best-effort */ } }
  return { ...res, post: row };
}

// ── HTTP handler — cockpit/admin: draft · approve · schedule · list · get · set_mode · status. ──
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (await rateLimited(request, env, "social-publish", 30)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const email = s(b.email).trim().toLowerCase();
    const key = s(b.token || b.key).trim();
    const action = (b.action || "list").toString();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);

    // PER-TENANT GATE — email ↔ connection key (get_client_data), identical to google-business.js / support.js.
    const gd = await rpc("get_client_data", { p_email: email, p_key: key });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    const meta = await tenantMeta(env, email);
    const mode = modeOf(meta);
    const connected = !!(meta && (meta.ig_user_id || meta.page_id));
    const live = !!(env.META_APP_ID && env.META_APP_SECRET);

    // ── SET_MODE — the owner chooses auto vs approve (A vs B). Never clobbers stored tokens. ──
    if (action === "set_mode") {
      const r = await rpc("social_set_mode", { p_secret: env.INGEST_SECRET || "", p_email: email, p_mode: s(b.mode, 12) });
      if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/social_posts.sql to activate social publishing." });
      const out = await r.json().catch(() => ({}));
      return json({ ok: true, mode: out.publish_mode || mode, note: (out.publish_mode === "auto" ? "Modo AUTO: a Gui publica direto." : "Modo APROVAR: a Gui cria o rascunho e só publica com o seu OK.") });
    }

    // ── LIST — tenant's posts (optional status filter). ──
    if (action === "list") {
      const r = await rpc("social_post_list", { p_secret: env.INGEST_SECRET || "", p_email: email, p_status: b.status ? s(b.status, 24) : null, p_limit: parseInt(b.limit, 10) || 100 });
      if (!r.ok) return json({ ok: true, ready: false, mode, connected, note: "Paste db/social_posts.sql to activate social publishing.", posts: [] });
      const posts = (await r.json().catch(() => [])) || [];
      return json({ ok: true, ready: live && connected, mode, connected, count: posts.length, posts });
    }

    // ── GET — one post (tenant-bound). ──
    if (action === "get") {
      if (!b.id) return json({ error: "missing id" }, 400);
      const r = await rpc("social_post_get", { p_secret: env.INGEST_SECRET || "", p_email: email, p_id: b.id });
      const post = r.ok ? await r.json().catch(() => null) : null;
      if (!post) return json({ error: "not found" }, 404);
      return json({ ok: true, mode, post });
    }

    // ── DRAFT — Gui GENERATES a post. In "approve" mode it's parked pending_approval (human OK
    //    required before it goes public). In "auto" mode it's created ready and published now. ──
    if (action === "draft" || action === "generate") {
      const gen = await generatePost(env, email, { channel: b.channel, lang: b.lang, prompt: b.prompt || b.topic, media_url: b.media_url, topic: b.topic });
      if (!gen) return json({ ok: true, ready: false, note: "Content generation unavailable (no ANTHROPIC_API_KEY) — try again shortly." });
      // Allow the owner to force a mode for THIS post (b.mode), else the tenant default.
      const thisMode = b.mode === "auto" ? "auto" : b.mode === "approve" ? "approve" : mode;
      const status = thisMode === "auto" ? "draft" : "pending_approval";
      const cr = await rpc("social_post_create", { p_secret: env.INGEST_SECRET || "", p_email: email, p_channel: gen.channel, p_content: gen.content, p_media_url: gen.media_url, p_status: status, p_scheduled_at: null, p_meta: { mode: thisMode, tone: gen.tone, source: "cockpit" } });
      if (!cr.ok) return json({ ok: true, ready: false, note: "Paste db/social_posts.sql to activate social publishing.", draft: gen });
      let row = await cr.json().catch(() => null);
      if (!row) return json({ ok: true, ready: false, note: "Paste db/social_posts.sql to activate social publishing.", draft: gen });
      // APPROVE mode → stop here: the owner must approve in the cockpit before anything is public.
      if (thisMode !== "auto") return json({ ok: true, mode: "approve", status: "pending_approval", post: row, note: "Rascunho criado — publica assim que você aprovar." });
      // AUTO mode → publish now (inert & honest if the app isn't live / not connected).
      const pub = await publishRow(env, email, meta, row);
      return json({ ok: true, mode: "auto", ready: pub.ready, published: !!pub.ok, post: pub.post, note: pub.note });
    }

    // ── APPROVE — the human OK in "approve" mode. Transitions pending_approval → then publishes. ──
    if (action === "approve") {
      if (!b.id) return json({ error: "missing id" }, 400);
      const ap = await rpc("social_post_approve", { p_secret: env.INGEST_SECRET || "", p_email: email, p_id: b.id });
      const row = ap.ok ? await ap.json().catch(() => null) : null;
      if (!row) return json({ error: "not found or not pending approval" }, 409);
      const pub = await publishRow(env, email, meta, row);
      return json({ ok: true, approved: true, ready: pub.ready, published: !!pub.ok, post: pub.post, note: pub.note });
    }

    // ── SCHEDULE — park a generated post for a future time (a cron sweep claims + publishes it). ──
    if (action === "schedule") {
      const when = s(b.scheduled_at, 40);
      if (!when) return json({ error: "missing scheduled_at" }, 400);
      let content = s(b.content, 2200); let media_url = s(b.media_url, 600) || null; let channel = b.channel;
      if (!content) { const gen = await generatePost(env, email, { channel: b.channel, lang: b.lang, prompt: b.prompt || b.topic, media_url: b.media_url }); if (gen) { content = gen.content; media_url = gen.media_url; channel = gen.channel; } }
      if (!content) return json({ ok: true, ready: false, note: "Nothing to schedule (no content and generation unavailable)." });
      const cr = await rpc("social_post_create", { p_secret: env.INGEST_SECRET || "", p_email: email, p_channel: channel, p_content: content, p_media_url: media_url, p_status: "scheduled", p_scheduled_at: when, p_meta: { mode, source: "schedule" } });
      if (!cr.ok) return json({ ok: true, ready: false, note: "Paste db/social_posts.sql to activate social publishing." });
      const row = await cr.json().catch(() => null);
      return json({ ok: true, scheduled: true, post: row, note: `Agendado para ${when}. ${mode === "approve" ? "Vai pedir sua aprovação antes de publicar." : "Publica automaticamente no horário."}` });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}

// ── WIRING (when live) ────────────────────────────────────────────────────────
// A cron/proactive engine imports { tenantMeta, generatePost, publishToMeta } from this file.
// Scheduled-post sweep: social_posts_claim_due (db/social_posts.sql) flips due 'scheduled' rows to
// 'draft'; for each, if the tenant mode is 'auto' → publishToMeta + social_post_publish; if 'approve'
// → leave as a pending draft the owner approves in the cockpit. Without META_APP_* env OR a connected
// tenant, publishToMeta returns { ready:false } and nothing goes public. Guileo never posts a
// fabricated promise, and in approve mode never posts without the owner's explicit OK.
