// Cloudflare Pages Function — POST /api/meta-oauth-start
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// CONECTAR O INSTAGRAM SEM NINGUÉM COLAR TOKEN.
//
// POR QUE ISTO EXISTE (2026-08-27): até hoje ligar uma conta significava ir ao Graph API Explorer,
// gerar um Page Access Token e COLAR no /admin. Isso tem três defeitos, e os três apareceram no
// mesmo dia:
//   1. Token colado é credencial passando pela mão de gente (e por tela, e por chat). O caminho
//      certo é a Meta entregar direto ao NOSSO servidor, e mais ninguém ver.
//   2. O token do Explorer nasce curto (1–2h) por padrão. Guardar isso deixa a página muda no dia
//      seguinte — o connect recusa, e a pessoa tenta de novo do mesmo jeito.
//   3. O escopo CONGELA no instante da autorização. Adicionar permissão no app depois não reemite
//      nada: foi assim que `instagram_manage_comments` ficou fora e o comentário nunca era
//      entregue, com o painel verde em dois lugares.
// Um consentimento de verdade resolve os três de uma vez — e é o único caminho possível para
// CLIENTE: nenhum dono de salão vai gerar Page Token em painel de desenvolvedor.
//
// O `state` é o MESMO mecanismo do Google (gbp_oauth_begin/claim): opaco, uso único, TTL 10 min.
// Reusado, não reinventado.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const s = (v, n = 200) => (v == null ? "" : v.toString().slice(0, n));

// O QUE PEDIMOS, E POR QUE CADA UM. Pedir demais assusta e atrasa a App Review; pedir de menos
// produz o silêncio que a gente acabou de caçar por uma hora.
export const META_SCOPES = [
  "pages_show_list",            // listar as Páginas que a pessoa administra
  "pages_read_engagement",      // ler metadados da Página (rota do webhook até o tenant)
  "pages_manage_metadata",      // inscrever a Página no nosso webhook
  "pages_messaging",            // responder no Messenger
  "instagram_basic",            // identificar a conta profissional ligada à Página
  "instagram_manage_messages",  // o DM — private reply e a conversa da Gui
  "instagram_manage_comments",  // LER comentário e responder publicamente (o comentário→DM)
  "business_management",        // a Página vive dentro de um Business
].join(",");

export function metaOauthUrl(appId, redirectUri, state) {
  const q = new URLSearchParams({
    client_id: appId, redirect_uri: redirectUri, state,
    response_type: "code", scope: META_SCOPES,
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${q.toString()}`;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "meta-oauth-start", 20)) return json({ error: "rate" }, 429);
    const b = await request.json().catch(() => ({}));

    // ADMIN gate — o mesmo do meta-connect (blitz_stats). Token errado → 401.
    const g = await fetch(`${SB}/rest/v1/rpc/blitz_stats`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: s(b.token), p_email: "" }),
    });
    if (!g.ok) return json({ error: "unauthorized" }, 401);

    const email = s(b.email, 160).trim().toLowerCase();
    if (!email.includes("@")) return json({ error: "informe o e-mail do cliente" }, 400);

    // INERTE HONESTO: sem app configurado não há consentimento a montar.
    if (!env.META_APP_ID) return json({ ok: false, ready: false, note: "META_APP_ID ausente no Cloudflare" }, 503);

    const state = await svcJson(env, "gbp_oauth_begin", { p_secret: env.INGEST_SECRET || "", p_email: email });
    if (typeof state !== "string" || state.length < 32) {
      return json({ ok: false, motivo: "não consegui criar o estado do consentimento (db/google_oauth.sql aplicado?)" }, 500);
    }
    const redirect = `${new URL(request.url).origin}/api/meta-oauth-callback`;
    return json({ ok: true, url: metaOauthUrl(env.META_APP_ID, redirect, state), redirect_uri: redirect, escopos: META_SCOPES.split(",") });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 500); }
}
