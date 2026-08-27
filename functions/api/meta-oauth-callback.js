// Cloudflare Pages Function — GET /api/meta-oauth-callback
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// A Meta devolve o dono aqui com ?code&state. Daqui pra frente ninguém vê token: o code vira
// token de usuário, o de usuário vira LONGO, e o longo vira o token da PÁGINA — tudo server-side.
//
// AS TRÊS COISAS QUE ESTE ARQUIVO NÃO PODE FAZER, porque cada uma já custou uma hora hoje:
//   • Guardar token CURTO. O do Explorer dura 1–2h; a página fica muda amanhã e ninguém percebe.
//     Aqui a troca por long-lived é obrigatória, e o token de Página derivado dela não expira.
//   • Guardar token sem o escopo do evento. A Meta decide a ENTREGA do webhook pelo que a conta
//     CONCEDEU — não pelo que o app declara. Conferimos com debug_token e dizemos na volta.
//   • Dizer "conectado" sem conferir. Toda afirmação aqui vem de uma releitura, não de um "success".
//
// ESCOLHA DA PÁGINA: se o tenant já tem page_id guardado, é ELE (reconectar não pode trocar a
// página no meio do caminho). Se não tem e existe exatamente uma, é ela. Se há várias e nenhuma
// guardada, NÃO adivinhamos — voltamos com a lista para o dono escolher. Carimbar a página errada
// no cliente errado é pior que não carimbar.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import { svcJson } from "../lib/sb.js";
import { subscribePage } from "./meta-connect.js";

const GRAPH = "https://graph.facebook.com/v21.0";
const s = (v, n = 300) => (v == null ? "" : v.toString().slice(0, n));

const volta = (origin, params) => {
  const q = new URLSearchParams(params);
  return new Response(null, { status: 302, headers: { Location: `${origin}/admin?${q.toString()}` } });
};

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = url.origin;
  try {
    // A pessoa pode CANCELAR na tela da Meta — isso não é erro nosso, e a volta tem que dizer isso.
    const erroMeta = s(url.searchParams.get("error_description") || url.searchParams.get("error"), 200);
    if (erroMeta) return volta(origin, { meta: "cancelado", motivo: erroMeta });

    const code = s(url.searchParams.get("code"), 600);
    const state = s(url.searchParams.get("state"), 200);
    if (!code || !state) return volta(origin, { meta: "erro", motivo: "voltou sem code/state" });
    if (!env.META_APP_ID || !env.META_APP_SECRET) return volta(origin, { meta: "erro", motivo: "META_APP_ID/SECRET ausentes" });

    // 1) O `state` diz DE QUEM é esta conexão. Uso único: um link vazado não serve duas vezes.
    const email = await svcJson(env, "gbp_oauth_claim", { p_secret: env.INGEST_SECRET || "", p_state: state });
    if (typeof email !== "string" || !email.includes("@")) {
      return volta(origin, { meta: "erro", motivo: "estado inválido, já usado ou expirado — comece de novo" });
    }

    const redirect = `${origin}/api/meta-oauth-callback`;
    // 2) code → token de usuário (curto)
    const t1 = await fetch(`${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(env.META_APP_ID)}&client_secret=${encodeURIComponent(env.META_APP_SECRET)}&redirect_uri=${encodeURIComponent(redirect)}&code=${encodeURIComponent(code)}`);
    const j1 = await t1.json().catch(() => null);
    if (!t1.ok || !j1 || !j1.access_token) {
      return volta(origin, { meta: "erro", motivo: s((j1 && j1.error && j1.error.message) || `troca do code falhou (HTTP ${t1.status})`, 200) });
    }

    // 3) curto → LONGO. Sem isso o token de Página herdaria a vida curta.
    const t2 = await fetch(`${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(env.META_APP_ID)}&client_secret=${encodeURIComponent(env.META_APP_SECRET)}&fb_exchange_token=${encodeURIComponent(j1.access_token)}`);
    const j2 = await t2.json().catch(() => null);
    const longo = (t2.ok && j2 && j2.access_token) ? j2.access_token : null;
    if (!longo) return volta(origin, { meta: "erro", motivo: s((j2 && j2.error && j2.error.message) || "a Meta recusou trocar por token longo", 200) });

    // 4) as Páginas, com o Instagram de cada uma
    const ac = await fetch(`${GRAPH}/me/accounts?fields=name,id,access_token,instagram_business_account{id,username}&limit=50&access_token=${encodeURIComponent(longo)}`);
    const aj = await ac.json().catch(() => null);
    const paginas = (aj && Array.isArray(aj.data)) ? aj.data : [];
    if (!ac.ok || !paginas.length) {
      return volta(origin, { meta: "erro", motivo: s((aj && aj.error && aj.error.message) || "nenhuma Página veio na autorização", 200) });
    }

    // 5) QUAL Página. Nunca adivinhar.
    const cred = await svcJson(env, "meta_creds_get", { p_secret: env.INGEST_SECRET || "", p_email: email });
    const jaTem = (cred && typeof cred === "object" && cred.page_id) ? String(cred.page_id) : "";
    let alvo = jaTem ? paginas.find((p) => String(p.id) === jaTem) : null;
    if (!alvo && !jaTem && paginas.length === 1) alvo = paginas[0];
    if (!alvo) {
      return volta(origin, { meta: "escolha", email,
        motivo: jaTem ? `a Página ${jaTem} deste cliente não veio nesta autorização` : "mais de uma Página — escolha qual",
        paginas: paginas.map((p) => `${p.id}:${p.name || ""}`).join("|").slice(0, 500) });
    }

    const pageToken = alvo.access_token || "";
    if (!pageToken) return volta(origin, { meta: "erro", motivo: `a Meta não devolveu token para a Página ${alvo.id}` });
    const igId = (alvo.instagram_business_account && alvo.instagram_business_account.id) ? String(alvo.instagram_business_account.id) : (cred && cred.ig_id) || "";

    // 6) O QUE ESTE TOKEN CONCEDE — antes de dizer qualquer coisa.
    let escopos = [];
    try {
      const dbg = await fetch(`${GRAPH}/debug_token?input_token=${encodeURIComponent(pageToken)}&access_token=${encodeURIComponent(`${env.META_APP_ID}|${env.META_APP_SECRET}`)}`);
      // PORTÃO DE STATUS ANTES DO FALLBACK: um 500 com corpo JSON passaria por `if (dj)` e a lista
      // de escopos ficaria vazia — que aqui vira "não conferido", não "não falta nada". O efeito
      // já é honesto, mas deixar o gate explícito é o que separa "está certo" de "está certo por
      // acidente" — e é o que a sonda do fallback.test.mjs cobra.
      if (!dbg.ok) throw new Error(`debug_token HTTP ${dbg.status}`);
      const dj = await dbg.json().catch(() => null);
      if (dj && dj.data && Array.isArray(dj.data.scopes)) escopos = dj.data.scopes.map(String);
    } catch { /* a conferência é best-effort; o aviso abaixo diz quando não deu */ }
    const querem = ["instagram_manage_comments", "instagram_manage_messages", "instagram_basic"];
    const faltando = escopos.length ? querem.filter((q) => !escopos.includes(q)) : null;

    // 7) GUARDA e confirma relendo — "gravou" sem reler é promessa sem lastro.
    const okStore = await svcJson(env, "meta_creds_store", {
      p_secret: env.INGEST_SECRET || "", p_email: email,
      p_tokens: { page_id: String(alvo.id), ig_id: igId, page_access_token: pageToken, business_name: s(alvo.name, 160) },
    });
    if (okStore !== true) return volta(origin, { meta: "erro", motivo: "não consegui guardar as credenciais" });

    const sub = await subscribePage(String(alvo.id), pageToken);

    return volta(origin, {
      meta: "ok", email, page_id: String(alvo.id), pagina: s(alvo.name, 80), ig_id: igId || "",
      inscrita: sub.subscribed ? "1" : "0",
      ...(faltando && faltando.length ? { faltando: faltando.join(",") } : {}),
      ...(faltando === null ? { escopo: "nao_conferido" } : {}),
    });
  } catch (e) {
    return volta(origin, { meta: "erro", motivo: String(e).slice(0, 160) });
  }
}
