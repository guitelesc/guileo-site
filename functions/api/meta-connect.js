// Cloudflare Pages Function — POST /api/meta-connect
// ADMIN-ONLY. Liga uma Página do Facebook / conta Instagram a um cliente do Guileo: guarda o
// Page Access Token (segredo do dono) + mapeia page_id/ig_id → client_email, pra o webhook
// (functions/api/meta-webhook.js) saber DE QUEM é a mensagem e a Gui poder RESPONDER.
//   { action:"connect", token, email, page_id, page_access_token, ig_id?, business? } -> { ok }
//   { action:"status",  token, email }  -> { ok, connected, page_id, ig_id, business }
// Gate: mesmo blitz_stats das outras admin (onboard-client/company-finance). O token da página é
// COLADO pelo dono (Claude nunca digita segredo) e vai direto pro meta_creds_store (INGEST-gated).
import { json, sameOrigin, rateLimited } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const s = (v, n = 400) => (v == null ? "" : v.toString().trim().slice(0, n));
const GRAPH = "https://graph.facebook.com/v21.0";
const SUBSCRIBE_FIELDS = "messages,messaging_postbacks"; // campos válidos p/ Messenger (provado 2026-07-24)

// Subscribe THIS page to the app's webhook so Meta actually DELIVERS inbound DMs to our webhook.
// Without this, the page has the token but Meta never POSTs the message → the Gui never sees it.
// Uses the page's OWN access token (server-side only, never echoed). Best-effort: returns a small
// status object; a failure never breaks connect (the owner can also toggle it in the dashboard).
async function subscribePage(pageId, pageToken, fields) {
  if (!pageId || !pageToken) return { subscribed: false, reason: "missing page_id/token" };
  if (!/^\d+$/.test(String(pageId))) return { subscribed: false, reason: "page_id inválido (só números)" };
  try {
    const r = await fetch(`${GRAPH}/${encodeURIComponent(pageId)}/subscribed_apps`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ subscribed_fields: fields || SUBSCRIBE_FIELDS, access_token: pageToken }).toString(),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d && d.success) return { subscribed: true };
    return { subscribed: false, reason: s((d && d.error && d.error.message) || `HTTP ${r.status}`, 160) };
  } catch (e) { return { subscribed: false, reason: s(e, 120) }; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "meta-connect", 30)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const ING = env.INGEST_SECRET || "";
    // ADMIN gate (mesma RPC do onboard-client). Token errado → non-200 → 401.
    const gate = await rpc("blitz_stats", { p_token: s(b.token, 200), p_email: "" });
    if (!gate.ok) return json({ error: "unauthorized" }, 401);

    const email = s(b.email, 160).toLowerCase();
    if (!email.includes("@")) return json({ error: "email inválido" }, 400);
    const action = (b.action || "connect").toString();

    if (action === "status") {
      const r = await rpc("meta_creds_get", { p_secret: ING, p_email: email }).catch(() => null);
      const t = r && r.ok ? await r.json().catch(() => null) : null;
      const tok = t && typeof t === "object" ? t : {};
      return json({ ok: true, connected: !!(tok.page_id || tok.ig_id), page_id: tok.page_id || "", ig_id: tok.ig_id || "", business: tok.business_name || "" });
    }

    // subscribe — (re)inscreve a página JÁ conectada no webhook do app, usando o token guardado.
    // Resolve o token via meta_tenant_for_page (o mesmo RPC do webhook). Nunca expõe o token.
    // Passe page_id no body; se faltar, tenta o valor colado em b.page_id.
    if (action === "subscribe") {
      const pid = s(b.page_id, 60);
      if (!pid) return json({ error: "informe o page_id" }, 400);
      const r = await rpc("meta_tenant_for_page", { p_secret: ING, p_page_id: pid }).catch(() => null);
      const t = r && r.ok ? await r.json().catch(() => null) : null;
      const tok = t && typeof t === "object" ? t : {};
      if (!tok.page_access_token) return json({ error: "essa página não tem token guardado (reconecte)" }, 400);
      const fields = s(b.fields, 300) || SUBSCRIBE_FIELDS;
      const sub = await subscribePage(pid, tok.page_access_token, fields);
      return json({ ok: sub.subscribed, ...sub, page_id: pid, fields });
    }

    // app_subscribe — inscreve o APP (não a página) no webhook do objeto 'page' pro campo `messages`.
    // É a 2ª inscrição que a Meta exige (a página→app é o subscribe acima; esta é app→messages).
    // Roda 100% server-side com o app-token = META_APP_ID|META_APP_SECRET — o secret NUNCA é exposto.
    if (action === "app_subscribe") {
      const appId = s(env.META_APP_ID, 60), appSecret = env.META_APP_SECRET, verify = s(env.META_VERIFY_TOKEN, 200);
      if (!appId || !appSecret) return json({ error: "META_APP_ID/META_APP_SECRET não estão setados no Cloudflare" }, 400);
      const callback = s(b.callback, 300) || "https://guileoai.com/api/meta-webhook";
      const fields = s(b.fields, 200) || SUBSCRIBE_FIELDS;
      try {
        const r = await fetch(`${GRAPH}/${appId}/subscriptions`, {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ object: "page", callback_url: callback, verify_token: verify, fields, access_token: `${appId}|${appSecret}` }).toString(),
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d && d.success) return json({ ok: true, app_subscribed: true, object: "page", fields, callback });
        return json({ ok: false, app_subscribed: false, reason: s((d && d.error && d.error.message) || `HTTP ${r.status}`, 200) });
      } catch (e) { return json({ error: s(e, 160) }, 500); }
    }

    // connect — o dono cola o page_access_token; guardamos + mapeamos a página ao tenant.
    const page_id = s(b.page_id, 60);
    const page_access_token = s(b.page_access_token, 4000);
    const ig_id = s(b.ig_id, 60);
    const business = s(b.business, 160);
    if (!page_id && !ig_id) return json({ error: "informe o ID da Página (page_id) ou do Instagram (ig_id)" }, 400);
    if (!page_access_token) return json({ error: "cole o Page Access Token" }, 400);

    // ── CONFERIR O TOKEN COM A META ANTES DE GUARDAR ────────────────────────────────────────
    // O token que o explorador da Meta entrega POR PADRÃO dura 1 a 2 horas. Sem esta checagem o
    // dono conectava, via funcionar, e no dia seguinte a página ficava MUDA — sem erro em lugar
    // nenhum, com o painel ainda dizendo "conectado". É a mesma doença do "sucesso" falso: o
    // sistema afirmando um estado que não é mais verdade.
    // Perguntamos à própria Meta (debug_token, autenticado com o token do APP) três coisas:
    // é válido? expira quando? Se expira em menos de 30 dias, RECUSAMOS — melhor não conectar
    // do que conectar por uma tarde. Token de Página derivado de um token longo não expira
    // (expires_at = 0), que é exatamente o que queremos guardar.
    if (env.META_APP_ID && env.META_APP_SECRET) {
      try {
        const app = `${env.META_APP_ID}|${env.META_APP_SECRET}`;
        const dbg = await fetch(`${GRAPH}/debug_token?input_token=${encodeURIComponent(page_access_token)}&access_token=${encodeURIComponent(app)}`);
        const dj = await dbg.json().catch(() => null);
        const info = dj && dj.data;
        if (!info || info.is_valid !== true) {
          return json({ error: "a Meta recusou este token (inválido ou de outro app). Gere de novo em Ferramentas → Graph API Explorer com o app Guileo selecionado.",
                        detalhe: s((dj && dj.error && dj.error.message) || (info && info.error && info.error.message) || "", 200) }, 400);
        }
        const exp = Number(info.expires_at || 0);           // 0 = não expira, que é o alvo
        if (exp > 0) {
          const horas = Math.round((exp * 1000 - Date.now()) / 3600000);
          return json({
            error: `este token EXPIRA em ~${horas}h — se eu guardar, a página fica muda amanhã e ninguém percebe.`,
            como_resolver: "No Graph API Explorer, troque por um token LONGO antes de colar: pegue o User Token, troque por long-lived, e só então leia me/accounts — o token de Página que vem daí não expira.",
            expira_em_horas: horas,
          }, 400);
        }
      } catch { /* a Meta fora do ar não pode impedir uma conexão legítima — segue e guarda */ }
    }

    const tokens = { page_id, ig_id, page_access_token, business_name: business };
    const r = await rpc("meta_creds_store", { p_secret: ING, p_email: email, p_tokens: tokens });
    if (!r.ok) return json({ error: "falha ao guardar (aplique db/meta_integration.sql?)" }, 500);
    const okStored = await r.json().catch(() => null);
    if (okStored !== true) return json({ error: "meta_creds_store recusou" }, 500);
    // AUTO-SUBSCRIBE: liga a entrega de DMs pro webhook agora (o passo que faltava). Best-effort.
    const sub = page_id ? await subscribePage(page_id, page_access_token) : { subscribed: false, reason: "sem page_id" };
    return json({ ok: true, connected: true, page_id, ig_id, business, subscribed: sub.subscribed, subscribe_note: sub.reason || null, note: `Página ${page_id || ig_id} ligada a ${email}${sub.subscribed ? " e inscrita no webhook ✓ — a Gui já recebe e responde." : " — token guardado, mas a inscrição no webhook falhou: " + (sub.reason || "?") + " (verifique no painel Meta)."}` });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
