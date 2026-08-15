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
//   ACTIONS: draft (generate) · approve (publish an approved/pending draft, optionally with the
//            owner's edited text) · reject (the owner refuses a draft) · schedule ·
//            list · get · set_mode · status · connect (honest connection state, NOT an OAuth lie).
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
import { json, rateLimited, safeEq } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { factsBlock } from "../lib/productFacts.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const GRAPH = "https://graph.facebook.com/v20.0";
const rpc = (fn, body) => fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const s = (v, n = 400) => (v == null ? "" : v.toString().slice(0, n));
// MODEL_CHAIN vem de ../lib/guiBrain.js — NÃO declare outra aqui (2026-08-12).
// Eram DEZ cópias idênticas da mesma lista de modelos, uma por arquivo. Idênticas HOJE: conferi as
// dez antes de mexer, e é exatamente por estarem iguais que a hora de unificar é agora — depois que
// uma diverge, alguém já foi atendido pelo modelo errado e ninguém sabe qual superfície foi.
// É o padrão que esta sessão inteira perseguiu: cópia sem vínculo com a fonte.
import { MODEL_CHAIN } from "../lib/guiBrain.js";

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

// ── Per-network connection state, from what we can actually PROVE:
//    'live'    = the tenant's tokens are stored AND the Meta app env is set → publishing works.
//    'pending' = the tenant's tokens are stored but the Meta app isn't approved/configured yet.
//    'off'     = no token for that surface stored for this tenant.
//    'unknown' = we genuinely can't tell from here. WhatsApp lives in the WhatsApp Cloud motor
//                (client_integrations provider='whatsapp_cloud', only addressable by phone_number_id),
//                so this endpoint must NOT claim it is connected OR disconnected. Saying "off"
//                would be as dishonest as saying "live".
function netsOf(env, meta) {
  const live = !!(env.META_APP_ID && env.META_APP_SECRET);
  const tok = !!(meta && meta.page_access_token);
  const st = (has) => (has && tok ? (live ? "live" : "pending") : "off");
  return { instagram: st(!!(meta && meta.ig_user_id)), facebook: st(!!(meta && meta.page_id)), whatsapp: "unknown" };
}

// Why the motor is not publishing yet, in the owner's words. null = it IS ready.
function blockedNote(live, connected) {
  if (!live) return "App Meta ainda não aprovado (falta META_APP_ID/META_APP_SECRET no Cloudflare). Nada é publicado até lá.";
  if (!connected) return "Esta conta ainda não foi vinculada ao Instagram/Facebook.";
  return null;
}

// One post, tenant-bound (client_email + id). Returns null when it isn't this tenant's.
async function getPost(env, email, id) {
  try {
    const r = await rpc("social_post_get", { p_secret: env.INGEST_SECRET || "", p_email: email, p_id: id });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch { return null; }
}

// ── Tenant brand context for the generator (business name / industry / tone / real menu) — the
//    SAME sources the voice+webchat brain uses, so a post sounds like the business, not a bot. ──
// EXPORTADO de propósito: o criativo de ANÚNCIO (functions/lib/criativoAds.js) precisa do MESMO
// contexto — nome, setor, tom, idioma e cardápio real com preços. Duplicar isso significaria que
// a próxima correção (como a do idioma, que faltava aqui) chegaria só numa das duas cópias.
export async function brandContext(env, email) {
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
        // O IDIOMA DO NEGÓCIO. Faltava esta linha: o gerador tinha o código pronto para escrever
        // em 4 idiomas (`ctx.lang` logo abaixo), mas ninguém preenchia `ctx.lang` — então TODO
        // post saía em inglês, inclusive para salão brasileiro com perfil em pt. Mesma família do
        // `fmt()` com "en-US" fixo: a língua estava cadastrada e não chegava em quem escreve.
        ctx.lang = s(p.lang || x.lang, 5).toLowerCase().slice(0, 2);
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
async function publishRow(env, email, meta, row, jaReservado = false) {
  // ── A PORTA ÚNICA DA PUBLICAÇÃO (2026-08-11) ───────────────────────────────────────────────
  // Antes, o cockpit (aprovar / modo automático) chamava esta função DIRETO, sem reservar, e só a
  // varredura reservava. Como a reserva não muda `status` (a linha segue 'draft' até o recibo), a
  // linha que o cockpit estava publicando continuava elegível para a varredura:
  //     14:00:00 dono clica Aprovar → publishToMeta leva segundos falando com a Meta
  //     14:00:03 a varredura pega a MESMA linha → DOIS posts idênticos no perfil do cliente.
  // A janela era o round-trip inteiro da Meta, em 100% dos aprovar. Agora a reserva mora AQUI:
  // todo caminho passa por ela, e quem já reservou (a varredura) diz `jaReservado`.
  // Reserva perdida = alguém já está publicando esta linha → sai sem enviar nada. Recusar é o
  // comportamento certo: post duplicado na marca do cliente não tem desfazer.
  if (!jaReservado) {
    // service_role, não a chave anônima: `social_post_claim_one` é revogada do anon (é mutação de
    // publicação). Chamá-la com a anônima devolveria 42501, a reserva falharia SEMPRE, e o cockpit
    // recusaria toda publicação dizendo "já está sendo publicado". Mesmo tropeço da varredura,
    // pego na mesma passada — revogar sem seguir quem chamava quebra os dois lados.
    let reservada = null;
    try {
      const c = await svcJson(env, "social_post_claim_one", { p_secret: env.INGEST_SECRET || "", p_email: email, p_id: row.id });
      if (c && !c.erro_http && c.ok !== false) reservada = c;
    } catch { /* trata como não reservada */ }
    if (!reservada || !reservada.id) {
      return { ok: false, ready: true, post: row, skipped: true,
               note: "este post já está sendo publicado (ou já foi) — nada foi enviado de novo" };
    }
    row = reservada;   // segue com a linha reservada, não com a cópia lida antes
  }
  const res = await publishToMeta(env, meta, row);
  if (res.ok && res.external_id) {
    // O RECIBO. Publicar na Meta e não conseguir gravar isso no banco NÃO é sucesso: a linha fica
    // em 'draft' com a Meta já tendo o post, e a varredura (action:'sweep') a pegaria de novo e
    // PUBLICARIA DUAS VEZES no perfil do cliente. Então: tenta gravar, CONFERE que o banco disse
    // 'published' e, se não conseguir, marca a linha como 'failed' com o external_id no texto —
    // deixando de ser republicável e registrando a verdade ("saiu na Meta, o banco não anotou").
    // Antes, `if (r.ok)` sem conferir o corpo bastava para responder published:true. (2026-08-11)
    let recorded = null;
    for (let tent = 0; tent < 2 && !recorded; tent++) {
      try {
        const r = await rpc("social_post_publish", { p_secret: env.INGEST_SECRET || "", p_email: email, p_id: row.id, p_external_id: res.external_id });
        if (r.ok) { const updated = await r.json().catch(() => null); if (updated && updated.status === "published") recorded = updated; }
      } catch { /* tenta de novo */ }
    }
    if (recorded) return { ...res, post: recorded, recorded: true };
    // Não conseguimos gravar o sucesso → tira a linha do caminho da varredura, com a verdade escrita.
    let parked = null;
    try {
      const f = await rpc("social_post_fail", { p_secret: env.INGEST_SECRET || "", p_email: email, p_id: row.id, p_error: `PUBLICADO NA META (external_id=${res.external_id}) mas o banco não registrou — NÃO republicar.` });
      if (f.ok) parked = await f.json().catch(() => null);
    } catch { /* best-effort */ }
    return { ...res, post: parked || row, recorded: false, note: `${res.note || ""} ⚠️ publicado na Meta, mas o registro no banco falhou (external_id=${res.external_id}).` };
  }
  // Only mark 'failed' when we actually TRIED and Meta rejected (ready:true). If the motor is inert
  // (ready:false — no env/creds), leave the row as-is so it publishes later when the app is live.
  if (res.ready) { try { await rpc("social_post_fail", { p_secret: env.INGEST_SECRET || "", p_email: email, p_id: row.id, p_error: res.note || "publish failed" }); } catch { /* best-effort */ } }
  return { ...res, post: row };
}

// ═════════════════════════════════════════════════════════════════════════════════════════════
// A VARREDURA (action:"sweep") — o motor que faltava para um post aprovado realmente sair.
// ─────────────────────────────────────────────────────────────────────────────────────────────
// O rodapé deste arquivo DESCREVIA esta varredura desde que ele foi escrito, e ela existia só ali:
// `social_posts_claim_due` não tinha um único chamador no repo, cron-tick.js não tinha uma linha
// de social, e a própria RPC estourava em runtime (CTE de UPDATE fora do nível de topo — corrigida
// em db/social_sweep.sql). Resultado real, com o cockpit dizendo o contrário na tela:
//   • post AGENDADO nunca virava publicação — ficava 'scheduled' para sempre;
//   • post APROVADO com a Meta ainda inerte parava em 'draft' e morria ali, mesmo depois de a Meta
//     entrar no ar — enquanto o cockpit prometia "sai no instante em que o Meta estiver no ar".
//
// DUAS ETAPAS, nesta ordem:
//   1. agendado vencido → 'draft'  (social_posts_claim_due — reserva atômica)
//   2. 'draft' reservado → publica na Meta  (social_posts_claim_publish — reserva ANTES de enviar)
//
// POR QUE NÃO PUBLICA DUAS VEZES: Instagram/Facebook não aceitam chave de idempotência, então a
// reserva acontece ANTES do envio, num único UPDATE atômico. Dois ticks simultâneos: um leva a
// linha, o outro leva zero. Linha com external_id nunca é reservada.
//
// O QUE ELA NUNCA TOCA: 'pending_approval'. O modo "aprovar antes" continua sendo o dono decidindo;
// a varredura só executa o que já foi aprovado (ou o que o dono pôs em modo auto).
//
// PORTÃO: DIGEST_TOKEN (mesmo de /api/automations e /api/review-responder), nunca o par de tenant.
// `?seco=1` mostra EXATAMENTE o que publicaria, sem reservar e sem enviar nada.
// ═════════════════════════════════════════════════════════════════════════════════════════════
const SWEEP_MAX = 25; // teto por run — um agendamento em massa não vira enxurrada no perfil do cliente

// ── CHAVE DE SERVIÇO, NÃO A ANÔNIMA (corrigido 2026-08-11, achado provando o ciclo de verdade) ──
// Estas quatro RPCs são ENTRE TENANTS por desenho (a varredura roda para a base inteira, sem
// `p_email`). Por isso elas foram revogadas do papel `anon` numa correção de segurança — e a
// varredura, que as chamava com a chave anônima, virou muda no mesmo instante: `social-sweep: 200`
// no relatório do cron, zero linhas tocadas no banco.
//
// A lição é a parte que importa: **fechar permissão sem seguir quem usava aquela porta troca um
// buraco de segurança por um motor que não roda** — e o endpoint continua respondendo 200. Só
// apareceu porque a prova foi olhar o BANCO depois do tique, não o código nem o status HTTP.
// O certo nunca foi reabrir o anon: função que lê a base inteira exige service_role.
async function claimJson(env, fn, limit) {
  if (!env.SUPABASE_SERVICE_ROLE) return { erro: `${fn}: SUPABASE_SERVICE_ROLE ausente — a varredura não roda com chave anônima` };
  try {
    const r = await svcJson(env, fn, { p_secret: env.INGEST_SECRET || "", p_email: null, p_limit: limit });
    // svcJson devolve o JSON já parseado (ou {ok:false, erro_http, detalhe}); NUNCA um `.error`.
    if (!r || r.erro_http || r.ok === false) return { erro: `${fn}: ${r?.erro_http ? `http ${r.erro_http}` : (r?.detalhe || "falhou")}` };
    return { rows: Array.isArray(r) ? r : [] };
  } catch (e) { return { erro: `${fn}: ${String(e).slice(0, 80)}` }; }
}

export async function runSocialSweep(env, { seco = false, limit = SWEEP_MAX } = {}) {
  const out = {
    ok: true, seco, live: !!(env.META_APP_ID && env.META_APP_SECRET),
    // Em modo seco NADA é liberado — por isso os dois campos: `vencidos` é o que existe,
    // `liberados` é o que esta run realmente mudou. Um número só teria de mentir num dos casos.
    agendados_vencidos: 0, agendados_liberados: 0, prontos: 0, publicados: 0, falhas: 0, inertes: 0,
    tenants: 0, amostras: [], nota: "",
  };
  if (!env.INGEST_SECRET) { out.ok = false; out.nota = "INGEST_SECRET ausente — varredura não roda."; return out; }
  const cap = Math.max(1, Math.min(parseInt(limit, 10) || SWEEP_MAX, 100));

  // ETAPA 1 — agendados vencidos. Em modo seco só OLHA (a leitura reserva nada).
  const passo1 = await claimJson(env, seco ? "social_posts_due_scheduled" : "social_posts_claim_due", cap);
  if (passo1.erro) { out.ok = false; out.nota = `${passo1.erro} — aplique db/social_sweep.sql.`; return out; }
  out.agendados_vencidos = passo1.rows.length;
  out.agendados_liberados = seco ? 0 : passo1.rows.length;

  // ETAPA 2 — as linhas prontas para publicar ('draft'). Reserva ANTES de enviar (ou só lê, no seco).
  const passo2 = await claimJson(env, seco ? "social_posts_pending_publish" : "social_posts_claim_publish", cap);
  if (passo2.erro) { out.ok = false; out.nota = `${passo2.erro} — aplique db/social_sweep.sql.`; return out; }
  const rows = passo2.rows;
  out.prontos = rows.length;
  if (!rows.length) { out.nota = "nada pendente."; return out; }

  // Resolve as credenciais UMA vez por tenant (cada linha carrega o seu client_email — é ele, e só
  // ele, que decide de qual conta o post sai; nenhuma linha usa o token de outro negócio).
  const porTenant = new Map();
  for (const row of rows) {
    const email = (row && row.client_email ? String(row.client_email) : "").trim().toLowerCase();
    if (!email.includes("@")) continue;
    if (!porTenant.has(email)) porTenant.set(email, []);
    porTenant.get(email).push(row);
  }
  out.tenants = porTenant.size;

  for (const [email, lista] of porTenant) {
    const meta = await tenantMeta(env, email);
    for (const row of lista) {
      if (seco) {
        if (out.amostras.length < 12) out.amostras.push({ email, id: row.id, canal: row.channel, texto: s(row.content, 140), publicaria: !!(out.live && meta && (meta.ig_user_id || meta.page_id)) });
        continue;
      }
      // `true` = ESTA linha já veio reservada em lote por social_posts_claim_publish, logo acima.
      // Sem esse aviso a varredura tentaria reservar o que já é dela, receberia "não é sua" e
      // recusaria a si mesma — nenhum post sairia nunca.
      const pub = await publishRow(env, email, meta, row, true);
      if (pub.ok) out.publicados++;
      else if (pub.ready) out.falhas++;
      else out.inertes++;   // motor inerte: a linha continua 'draft' e volta na próxima janela
      // `registrado` só faz sentido quando ALGO foi publicado: null = não houve publicação para
      // registrar. Um `true` aqui num post que nunca saiu seria exatamente o tipo de campo
      // tranquilizador que esconde o problema.
      if (out.amostras.length < 12) out.amostras.push({ email, id: row.id, canal: row.channel, ok: !!pub.ok, ready: !!pub.ready, registrado: pub.ok ? pub.recorded !== false : null, nota: s(pub.note, 160) });
    }
  }
  out.nota = seco
    ? `SECO — nada foi reservado nem enviado. ${out.prontos} post(s) prontos, ${out.agendados_vencidos} agendado(s) vencido(s).`
    : `${out.publicados} publicado(s), ${out.falhas} recusado(s) pela Meta, ${out.inertes} aguardando a Meta (continuam na fila).`;
  return out;
}

// ── HTTP handler — cockpit/admin: draft · approve · schedule · list · get · set_mode · status. ──
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (await rateLimited(request, env, "social-publish", 30)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));

    // ── SWEEP (cron) — portão DIGEST, ANTES do par de tenant: quem varre é a plataforma, não um
    //    cliente. Sem DIGEST_TOKEN configurado, 401 (fail-closed), nunca "ok" silencioso. ──
    const u = new URL(request.url);
    if ((b.action || "") === "sweep" || u.searchParams.get("sweep") === "1") {
      const tok = u.searchParams.get("token") || s(b.token, 200) || request.headers.get("x-guileo-secret") || "";
      if (!env.DIGEST_TOKEN || !safeEq(tok, env.DIGEST_TOKEN)) return json({ error: "unauthorized" }, 401);
      const seco = u.searchParams.get("seco") === "1" || b.seco === true || b.seco === 1;
      return json(await runSocialSweep(env, { seco, limit: b.limit }));
    }


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

    // ── STATUS — everything the cockpit's Redes Sociais tab needs in ONE call: per-network
    //    connection state, the A+B mode, whether publishing is actually live, and the drafts
    //    waiting for the owner. Was being called by the UI and did not exist (400 → the drafts
    //    list could never load); it is a real aggregation of list + mode + connection truth.
    //    An unreachable store returns store_ready:false + a note — NEVER a silent empty list. ──
    if (action === "status") {
      const nets = netsOf(env, meta);
      const r = await rpc("social_post_list", { p_secret: env.INGEST_SECRET || "", p_email: email, p_status: null, p_limit: 100 });
      const storeOk = r.ok;
      const posts = storeOk ? ((await r.json().catch(() => [])) || []) : [];
      const drafts = Array.isArray(posts) ? posts.filter((p) => p && p.status === "pending_approval") : [];
      return json({
        ok: true, ready: live && connected, live, connected, mode, nets,
        store_ready: storeOk, drafts, count: Array.isArray(posts) ? posts.length : 0,
        note: storeOk ? blockedNote(live, connected) : "Motor social ainda não instalado no banco (db/social_posts.sql).",
      });
    }

    // ── CONNECT — the honest truth about linking an account. There is NO self-serve Meta OAuth
    //    here: it needs an approved Meta app (META_APP_ID/SECRET) + a reviewed redirect flow, and
    //    inventing an OAuth URL that goes nowhere would be a lie. So this reports the REAL state
    //    and the REAL blocker, and the cockpit shows that reason instead of a fake "connecting…". ──
    if (action === "connect") {
      const nets = netsOf(env, meta);
      const net = ["instagram", "facebook", "whatsapp"].includes(s(b.network, 20).toLowerCase()) ? s(b.network, 20).toLowerCase() : "instagram";
      const state = nets[net] || "off";
      const note = net === "whatsapp"
        ? "WhatsApp é ligado pelo motor WhatsApp Cloud (número + tokens da Meta) — a equipe conclui essa vinculação; este painel não consegue confirmá-la sozinho."
        : !live
          ? "App Meta ainda não aprovado — assim que ele estiver no ar a vinculação abre aqui. Nada é publicado até lá."
          : state === "off"
            ? "App Meta no ar. Falta vincular ESTA conta (tokens da Página/Instagram) — a equipe conclui a vinculação segura com você."
            : "Conta já vinculada ✓";
      return json({
        ok: true, connected: state === "live" || state === "pending", ready: state === "live",
        state, nets, blocked_by: net === "whatsapp" ? "outside_this_panel" : (!live ? "meta_app" : state === "off" ? "tenant_tokens" : null),
        note,
      });
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

    // ── REJECT — the owner refuses a draft. There is no dedicated reject RPC, so this reuses the
    //    existing tenant-bound social_post_fail to park the row in the terminal 'failed' state with
    //    the REAL reason ("recusado pelo dono"), which is exactly what that state is for: this post
    //    will not go out, and it stays readable/recoverable. A published post can never be
    //    "rejected" (409) — we don't rewrite history. Never answers ok:true without a real row. ──
    if (action === "reject" || action === "decline") {
      if (!b.id) return json({ error: "missing id" }, 400);
      const orig = await getPost(env, email, b.id);
      if (!orig) return json({ error: "not found" }, 404);
      if (orig.status === "published") return json({ error: "already published" }, 409);
      const fr = await rpc("social_post_fail", { p_secret: env.INGEST_SECRET || "", p_email: email, p_id: b.id, p_error: "Recusado pelo dono no cockpit — não publicar." });
      const row = fr.ok ? await fr.json().catch(() => null) : null;
      if (!row) return json({ error: "could not record the refusal" }, 409);
      return json({ ok: true, rejected: true, post: row, note: "Recusado — a Gui não publica este post." });
    }

    // ── APPROVE — the human OK in "approve" mode. Transitions pending_approval → then publishes.
    //    If the owner EDITED the caption in the cockpit (b.text), that edit must actually persist:
    //    there is no update-content RPC, so the edited caption is stored as a NEW pending row
    //    (meta.edited_from = original) and the original is retired — never silently dropped, which
    //    would publish the text the owner just changed. ──
    if (action === "approve") {
      if (!b.id) return json({ error: "missing id" }, 400);
      let targetId = b.id;
      let editNote = "";
      const edited = s(b.text, 2200).trim();
      if (edited) {
        const orig = await getPost(env, email, b.id);
        if (!orig) return json({ error: "not found" }, 404);
        // LISTA BRANCA, não lista negra. A guarda anterior era `status === "published"` → recusa,
        // e ela NÃO fechava o retry: no primeiro aprovar-editado o original vira 'failed' (foi
        // aposentado em favor da versão editada) e quem publica é a linha NOVA. No segundo clique,
        // `orig.status` é 'failed', a recusa não dispara, o texto editado continua diferente do
        // original → cunha outra linha → aprova → PUBLICA DE NOVO no Instagram do cliente.
        // Bastava a resposta do primeiro clique se perder (timeout) para o dono tentar outra vez.
        // O caminho SEM edição nunca teve esse furo porque `social_post_approve` exige
        // 'pending_approval' e o segundo clique morria com 409 — a idempotência vinha de graça, e
        // a versão editada a jogou fora. Lista negra sempre esquece um estado; lista branca não.
        // Achado por revisão adversarial 2026-08-11.
        if (orig.status !== "pending_approval") {
          return json({ ok: false, error: orig.status === "published" ? "already published" : `este rascunho não está mais pendente (${orig.status}) — recarregue a lista`, status: orig.status }, 409);
        }
        if (edited !== s(orig.content, 2200).trim()) {
          const cr = await rpc("social_post_create", { p_secret: env.INGEST_SECRET || "", p_email: email, p_channel: orig.channel, p_content: edited, p_media_url: orig.media_url, p_status: "pending_approval", p_scheduled_at: null, p_meta: { mode, tone: (orig.meta && orig.meta.tone) || "", source: "cockpit_edit", edited_from: orig.id } });
          const nrow = cr.ok ? await cr.json().catch(() => null) : null;
          if (!nrow || !nrow.id) return json({ error: "could not save your edit — nothing was approved" }, 409);
          targetId = nrow.id;
          // Retire the original so the owner isn't left with two drafts. Verified, not assumed.
          const rf = await rpc("social_post_fail", { p_secret: env.INGEST_SECRET || "", p_email: email, p_id: orig.id, p_error: "Substituído pela versão editada pelo dono." });
          const retired = rf.ok ? await rf.json().catch(() => null) : null;
          if (!retired) editNote = " (o rascunho original continua na lista — recuse-o quando puder)";
        }
      }
      const ap = await rpc("social_post_approve", { p_secret: env.INGEST_SECRET || "", p_email: email, p_id: targetId });
      const row = ap.ok ? await ap.json().catch(() => null) : null;
      if (!row) return json({ error: "not found or not pending approval" }, 409);
      const pub = await publishRow(env, email, meta, row);
      return json({ ok: true, approved: true, ready: pub.ready, published: !!pub.ok, post: pub.post, note: (pub.note || "") + editNote });
    }

    // ── SCHEDULE — park a generated post for a future time (a cron sweep claims + publishes it). ──
    if (action === "schedule") {
      const when = s(b.scheduled_at, 40);
      if (!when) return json({ error: "missing scheduled_at" }, 400);
      let content = s(b.content, 2200); let media_url = s(b.media_url, 600) || null; let channel = b.channel;
      if (!content) { const gen = await generatePost(env, email, { channel: b.channel, lang: b.lang, prompt: b.prompt || b.topic, media_url: b.media_url }); if (gen) { content = gen.content; media_url = gen.media_url; channel = gen.channel; } }
      if (!content) return json({ ok: true, ready: false, note: "Nothing to schedule (no content and generation unavailable)." });
      // IDEMPOTENTE PELO CONTEÚDO. Dois cliques (ou o retry de um timeout) mandam o MESMO corpo:
      // social_post_schedule_once devolve a linha que já existe em vez de criar uma segunda. Com a
      // varredura ligada, duas linhas 'scheduled' iguais seriam dois posts iguais no perfil do
      // cliente — a mesma falha do aprovar-editado entrando pela porta do agendar. (2026-08-11)
      const cr = await rpc("social_post_schedule_once", { p_secret: env.INGEST_SECRET || "", p_email: email, p_channel: channel, p_content: content, p_media_url: media_url, p_scheduled_at: when, p_meta: { mode, source: "schedule" } });
      if (!cr.ok) return json({ ok: true, ready: false, note: "Paste db/social_sweep.sql to activate scheduling." });
      const row = await cr.json().catch(() => null);
      if (!row) return json({ ok: true, ready: false, note: "Paste db/social_sweep.sql to activate scheduling." });
      const jaExistia = row._duplicado === true;
      return json({
        ok: true, scheduled: true, duplicate: jaExistia, post: row,
        note: jaExistia
          ? `Este post já estava agendado para ${when} — mantive o mesmo (nada foi duplicado).`
          : `Agendado para ${when}. ${mode === "approve" ? "Vai pedir sua aprovação antes de publicar." : "Publica automaticamente no horário."}`,
      });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}

// ── GET — SÓ a varredura (as demais actions precisam de corpo). Existe porque o cron-tick tenta
//    POST e cai para GET, e porque `curl "…/api/social-publish?sweep=1&seco=1&token=…"` é a forma
//    de olhar a fila sem mexer em nada. Mesmo portão DIGEST, mesmo fail-closed. ──
export async function onRequestGet(context) {
  const { request, env } = context;
  const u = new URL(request.url);
  if (u.searchParams.get("sweep") !== "1") return json({ error: "method" }, 405);
  const tok = u.searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
  if (!env.DIGEST_TOKEN || !safeEq(tok, env.DIGEST_TOKEN)) return json({ error: "unauthorized" }, 401);
  return json(await runSocialSweep(env, { seco: u.searchParams.get("seco") === "1", limit: u.searchParams.get("limit") }));
}

// ── WIRING ────────────────────────────────────────────────────────────────────
// A varredura NÃO é mais um comentário: é a action `sweep` deste arquivo (runSocialSweep), gated por
// DIGEST_TOKEN, chamada pelo cron-tick (patch em functions/api/cron-tick.js, dono: orquestrador):
//     targets.push({ name: "social-sweep", url: `${base}/api/social-publish?sweep=1&token=${t}` });
// Ciclo: social_posts_claim_due (agendado vencido → 'draft') → social_posts_claim_publish (reserva
// atômica ANTES de enviar) → publishToMeta → social_post_publish com o external_id da Meta como
// prova. 'pending_approval' NUNCA é tocado: em modo aprovar, só o dono libera. Sem META_APP_* env ou
// sem tenant conectado, publishToMeta devolve { ready:false }, a linha continua na fila e nada vai
// ao ar. Guileo nunca posta uma promessa fabricada nem publica sem o OK explícito do dono.
// Olhar sem mexer: GET /api/social-publish?sweep=1&seco=1&token=$DIGEST_TOKEN
