// Cloudflare Pages Function — POST /api/meta-comentarios  ·  COMENTÁRIO → DM (cockpit do cliente)
// ═════════════════════════════════════════════════════════════════════════════════════════════
// O dono cria aqui as campanhas que o webhook (functions/api/meta-webhook.js) executa:
// "quem comentar PREÇO neste reel recebe isto no direct". Um CRUD, nada mais — a decisão de
// mandar ou não mandar mora no banco (db/meta_comment_dm.sql), atômica, porque é lá que o
// freio anti-spam consegue ser exato entre invocações concorrentes do Worker.
//
//   POST { email, token }                          → { ok, ready, campanhas:[...], stats }
//   POST { email, token, action:"salvar", campanha:{...} } → { ok, id }
//   POST { email, token, action:"apagar", id }     → { ok, apagadas }
//
// PORTÃO: o MESMO de noshow-radar.js — get_client_data(email, key) amarra o e-mail do cockpit à
// chave de conexão. Sem fallback de OWNER_EMAIL. E a validação confere o FORMATO da resposta,
// não só o status: uma RPC que devolve `false` com HTTP 200 passa por `r.ok` — foi assim que o
// envio de e-mail ficou aberto pra qualquer um. Status HTTP não é autenticação.
//
// INERTE HONESTO: sem db/meta_comment_dm.sql colado, as RPCs não existem → devolve
// { ready:false, nota } em vez de 500. A tela mostra o motivo real, nunca uma lista vazia que
// finge que está tudo certo (lista vazia é o disfarce favorito de erro neste projeto).
import { json } from "../lib/guard.js";
// A FONTE ÚNICA DE IDIOMA. Importar daqui (e não redigitar a lista) é o que impede este arquivo
// de virar a QUARTA lista de idiomas do sistema — depois de LANGS_SPOKEN, do i18n da landing e
// do dicionário do cockpit. Lista repetida diverge; a que diverge em silêncio é a pior.
import { LANG_CODES } from "../../src/data/langs.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CODIGOS_IDIOMA = LANG_CODES;

/**
 * Limpa um mapa {idioma: texto} vindo da tela.
 *
 * `null` (campo AUSENTE no corpo) devolve null de propósito: no banco isso significa "não mexi
 * nisso" e preserva o que já está lá. Uma tela antiga — ou uma chamada de API que não conhece o
 * campo — não pode APAGAR as traduções do dono só por não ter mandado nada.
 *
 * Idioma fora de LANGS_SPOKEN é DESCARTADO, não rejeitado: guardar texto num idioma que a Gui
 * não fala criaria uma promessa que o telefone não cumpre.
 */
function mapaIdiomas(v, teto = 900) {
  if (v === undefined || v === null) return null;
  if (typeof v !== "object" || Array.isArray(v)) return {};
  const out = {};
  for (const [k, txt] of Object.entries(v)) {
    const code = String(k || "").toLowerCase().slice(0, 2);
    if (!CODIGOS_IDIOMA.has(code)) continue;
    const t = String(txt == null ? "" : txt).trim();
    if (t) out[code] = t.slice(0, teto);
  }
  return out;
}

async function rpc(nome, corpo) {
  return fetch(`${SB}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);

    // ── PORTÃO DO TENANT ──────────────────────────────────────────────────────────────────────
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    // ⚠️ o `Array.isArray(gdj.events)` NÃO é paranoia: get_client_data devolve 200 com um valor
    // falsy quando a chave não bate, e `gd.ok` sozinho deixaria qualquer um entrar.
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    const segredo = env.INGEST_SECRET || "";
    if (!segredo) return json({ ok: true, ready: false, campanhas: [], nota: "INGEST_SECRET não configurado no ambiente" });

    const action = (b.action || "").toString();

    // ── SALVAR ────────────────────────────────────────────────────────────────────────────────
    if (action === "salvar") {
      const c = (b.campanha && typeof b.campanha === "object") ? b.campanha : {};
      const id = (c.id || "").toString().trim();
      const igId = (c.ig_id || "").toString().trim();
      const dmText = (c.dm_text || "").toString().trim();
      // As palavras-chave chegam como o dono digitou (com acento). A normalização é do
      // comentarios.js na hora de comparar — guardar normalizado apagaria o que ele escreveu
      // e a tela mostraria "preco" pra quem digitou "preço".
      const keywords = (Array.isArray(c.keywords) ? c.keywords : String(c.keywords || "").split(","))
        .map((k) => String(k).trim()).filter(Boolean).slice(0, 20);
      if (!igId || !dmText) return json({ ok: false, error: "ig_id e dm_text são obrigatórios" }, 400);
      if (!keywords.length) return json({ ok: false, error: "pelo menos uma palavra-chave" }, 400);
      if (id && !UUID_RE.test(id)) return json({ ok: false, error: "id inválido" }, 400);

      const r = await rpc("meta_campanha_salvar", {
        p_secret: segredo, p_email: email, p_id: id || null, p_ig_id: igId,
        p_nome: (c.nome || "Campanha").toString().slice(0, 80),
        p_media_id: (c.media_id || "").toString().trim() || null,
        p_keywords: keywords,
        p_match_mode: c.match_mode === "contem" ? "contem" : "palavra",
        p_dm_text: dmText.slice(0, 900),
        p_public_reply: (c.public_reply || "").toString().slice(0, 280) || null,
        p_link_url: (c.link_url || "").toString().slice(0, 500) || null,
        p_active: c.active === false ? false : true,
        // ── IDIOMA ────────────────────────────────────────────────────────────────────────────
        p_dm_i18n: mapaIdiomas(c.dm_i18n),
        p_public_reply_i18n: mapaIdiomas(c.public_reply_i18n, 280),
        // O padrão é a queda quando a detecção não decide (palavra ambígua como "valor", que
        // serve a PT e ES) ou quando falta tradução. Fora de LANGS_SPOKEN vira null = preserva.
        p_lang_padrao: CODIGOS_IDIOMA.has(String(c.lang_padrao || "").toLowerCase().slice(0, 2))
          ? String(c.lang_padrao).toLowerCase().slice(0, 2) : null,
      });
      if (!r.ok) return json({ ok: false, ready: false, nota: `cole db/meta_comment_dm.sql (rpc ${r.status})` });
      const v = await r.json().catch(() => null);
      // Devolve o id do que foi gravado — "ok" sem comprovante é promessa sem lastro.
      return json(v && typeof v === "object" ? v : { ok: false, error: "resposta inesperada" });
    }

    // ── APAGAR ────────────────────────────────────────────────────────────────────────────────
    if (action === "apagar") {
      const id = (b.id || "").toString().trim();
      if (!UUID_RE.test(id)) return json({ ok: false, error: "id inválido" }, 400);
      const r = await rpc("meta_campanha_apagar", { p_secret: segredo, p_email: email, p_id: id });
      if (!r.ok) return json({ ok: false, ready: false, nota: `cole db/meta_comment_dm.sql (rpc ${r.status})` });
      const v = await r.json().catch(() => null);
      return json(v && typeof v === "object" ? v : { ok: false, error: "resposta inesperada" });
    }

    // ── LISTAR (padrão) ───────────────────────────────────────────────────────────────────────
    const r = await rpc("meta_campanhas_listar", { p_secret: segredo, p_email: email });
    if (!r.ok) {
      return json({ ok: true, ready: false, campanhas: [], nota: `cole db/meta_comment_dm.sql no Supabase (rpc ${r.status})` });
    }
    const campanhas = await r.json().catch(() => null);
    let stats = {};
    try {
      const s = await rpc("meta_comment_stats", { p_secret: segredo, p_email: email, p_dias: 30 });
      if (s.ok) stats = (await s.json().catch(() => ({}))) || {};
    } catch { /* estatística é extra, nunca derruba a lista */ }
    return json({ ok: true, ready: true, campanhas: Array.isArray(campanhas) ? campanhas : [], stats });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 160) }, 500);
  }
}
