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
//   POST { admin_token, dias }                     → { ok, clientes:[{email, nomes, metricas|metricas_erro}] }  (/admin)
//   POST { admin_token, email, action:"metricas" } → um cliente, mesma forma do portal              (/admin)
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
import { svcJson, sbKey, SB_URL } from "../lib/sb.js";
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

const diasValidos = (v) => ([7, 30, 90].includes(Number(v)) ? Number(v) : 30);

// ⚠️ ERRO NÃO VIRA ZERO (vale para o cliente E para o /admin — por isso é uma função só).
async function lerMetricasDe(env, segredo, email, dias) {
  const m = await svcJson(env, "direct_metricas", { p_secret: segredo, p_email: email, p_dias: dias }).catch((e) => ({ ok: false, detalhe: String(e).slice(0, 120) }));
  if (!m || typeof m !== "object" || m.ok === false || m.erro || !m.funil) {
    return { metricas: null, metricas_erro: (m && (m.erro || m.detalhe || (m.erro_http && `HTTP ${m.erro_http}`))) || "resposta_estranha" };
  }
  return { metricas: m };
}

// ── A PORTA DO /admin (2026-10-23) ────────────────────────────────────────────────────────────
// O Luis vê TODOS os clientes do Direct num lugar; o cliente continua vendo só o dele no portal.
// Mesma leitura (direct_metricas), outro portão: a senha do /admin via blitz_stats, igual a
// /api/entregas e /api/meta-connect. Quem tem a senha do /admin já vê os leads de todo mundo.
//
// QUEM É CLIENTE DO DIRECT: quem tem conta Meta (meta_accounts) OU campanha (meta_comment_campaigns).
// Lido direto da tabela com a service_role — o mesmo caminho de agent-evolve.js. Sem a service_role
// o sbKey cai na anon, a RLS devolve [] e a tela diria "nenhum cliente": a mentira mais barata deste
// projeto. Por isso sem a chave de serviço a resposta é ERRO, nunca lista vazia.
async function clientesDoDirect(env) {
  if (!(env && env.SUPABASE_SERVICE_ROLE)) return { erro: "SUPABASE_SERVICE_ROLE ausente" };
  const k = sbKey(env);
  const ler = async (q) => {
    const r = await fetch(`${SB_URL}/rest/v1/${q}`, { headers: { apikey: k, Authorization: `Bearer ${k}` } });
    if (!r.ok) throw new Error(`${q.split("?")[0]} HTTP ${r.status}`);
    const v = await r.json();
    if (!Array.isArray(v)) throw new Error(`${q.split("?")[0]} resposta estranha`);
    return v;
  };
  try {
    const [contas, campanhas] = await Promise.all([
      ler("meta_accounts?select=client_email,business_name,ig_username"),
      ler("meta_comment_campaigns?select=client_email"),
    ]);
    const porEmail = new Map();
    const pegar = (e) => {
      const em = String(e || "").trim().toLowerCase();
      if (!em.includes("@")) return null;
      if (!porEmail.has(em)) porEmail.set(em, { email: em, nomes: [] });
      return porEmail.get(em);
    };
    for (const c of contas) {
      const x = pegar(c.client_email);
      const nome = c.business_name || (c.ig_username ? `@${c.ig_username}` : "");
      if (x && nome && !x.nomes.includes(nome)) x.nomes.push(nome);
    }
    for (const c of campanhas) pegar(c.client_email);
    return { clientes: [...porEmail.values()] };
  } catch (e) {
    return { erro: String(e.message || e).slice(0, 160) };
  }
}

async function portaDoAdmin(env, b) {
  const gate = await rpc("blitz_stats", { p_token: String(b.admin_token || "").trim().slice(0, 200), p_email: "" });
  if (!gate.ok) return json({ error: "unauthorized" }, 401);
  const segredo = env.INGEST_SECRET || "";
  if (!segredo) return json({ ok: false, erro: "INGEST_SECRET ausente" }, 503);
  const dias = diasValidos(b.dias);
  const action = String(b.action || "");

  // Um cliente só — é o que a troca de período do painel pede (mesma forma da resposta do portal).
  if (action === "metricas") {
    const email = String(b.email || "").trim().toLowerCase();
    if (!email.includes("@")) return json({ ok: false, erro: "email" }, 400);
    return json({ ok: true, ready: true, dias, ...(await lerMetricasDe(env, segredo, email, dias)) });
  }

  // Visão geral: todos os clientes, cada um com a SUA leitura (uma falha não apaga as outras).
  const lista = await clientesDoDirect(env);
  if (lista.erro) return json({ ok: false, erro: lista.erro });
  const clientes = await Promise.all(lista.clientes.map(async (c) => ({ ...c, ...(await lerMetricasDe(env, segredo, c.email, dias)) })));
  return json({ ok: true, dias, clientes });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    if (b.admin_token) return await portaDoAdmin(env, b);
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

    // ── AS MÉTRICAS DO GUILEO DIRECT (db/direct_metricas.sql) ──────────────────────────────────
    // ⚠️ ERRO NÃO VIRA ZERO. Painel de funil cheio de zero porque a leitura falhou é o diagnóstico
    // falso que este projeto já pagou cinco vezes num dia: o dono conclui "ninguém comenta" quando
    // o certo era "não consegui ler". Falha volta como `metricas: null` + `metricas_erro`, e a tela
    // diz isso com todas as letras.
    const dias = diasValidos(b.dias);
    const lerMetricas = () => lerMetricasDe(env, segredo, email, dias);
    if (action === "metricas") return json({ ok: true, ready: true, dias, ...(await lerMetricas()) });

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
    return json({ ok: true, ready: true, campanhas: Array.isArray(campanhas) ? campanhas : [], stats, dias, ...(await lerMetricas()) });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 160) }, 500);
  }
}
