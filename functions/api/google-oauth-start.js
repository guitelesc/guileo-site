// Cloudflare Pages Function — POST /api/google-oauth-start · UM login do Google, DOIS usos
// ─────────────────────────────────────────────────────────────────────────────
// O pedido do dono (Luis, 2026-08-20): «pra eu ativar a agenda dela do Google é só logar no
// Google dela através do nosso sistema, e é isso» — e essa ativação tem que existir NOS DOIS
// LADOS: no cockpit do CLIENTE e no hub do VENDEDOR (com a cliente sentada do lado).
//
// ── O ESCOPO ────────────────────────────────────────────────────────────────
// Antes este arquivo pedia SÓ `business.manage` (avaliações do Google). Ou seja: a pessoa
// logava, a tela dizia "conectado" e a AGENDA continuava desligada — a promessa não se cumpria.
// Agora o consentimento pede também `calendar.events`, que é o MENOR escopo do Calendar que
// faz as DUAS coisas de que a Gui precisa:
//   • LER disponibilidade  → events.list / freebusy no calendário primário
//   • GRAVAR agendamento   → events.insert (é o que agent-schedule.js gcalPush já chama)
// (`calendar` completo também daria, mas dá acesso a criar/apagar calendários e mexer em ACL —
//  poder que não usamos. `calendar.events.readonly` só leria. `calendar.events` é o meio-termo
//  exato.) Um ÚNICO consentimento resolve os dois usos porque os dois escopos são pedidos no
// MESMO client OAuth — desde que o projeto do Google Cloud desse client tenha as duas APIs
// habilitadas (Calendar API + Business Profile API). Se o ambiente só tiver o client de
// calendário (GOOGLE_CLIENT_ID) e ainda não o de Business, o botão continua acendendo — mas só
// com o escopo de agenda, e a resposta diz isso na cara (`business_ready:false`).
//
// ── O GOOGLE PODE CONCEDER MENOS DO QUE PEDIMOS ─────────────────────────────
// Na tela de consentimento a pessoa pode DESMARCAR a agenda. O token volta sem ela e, se a
// gente não olhar, a tela diz "conectado ✓" e o primeiro agendamento da primeira ligação falha
// em silêncio — o pior resultado possível. Por isso o callback guarda o `scope` CONCEDIDO junto
// do token e este endpoint devolve `scopes:{calendar,business}` lido do que foi GRAVADO, nunca
// do que foi pedido.
//
// ── SEGURANÇA DO LADO DO VENDEDOR ───────────────────────────────────────────
// O vendedor NÃO digita um e-mail: ele escolhe um cliente e o SERVIDOR confere que aquele
// client_email está na CARTEIRA dele (RPC seller_wallet, mesma do /api/onboard-draft) depois de
// validar o crachá (e-mail + código, roster do banco ou do env). E-mail fora da carteira = 403.
// Sem isso, isto seria uma máquina de phishing com a nossa marca. O vendedor nunca vê o token:
// ele só recebe uma URL de consentimento do próprio Google.
//
// O `state` opaco de uso único com TTL de 10 min (gbp_oauth_begin/claim) é o que já existia —
// reusado, não reinventado. O sufixo ".v" marca "começou no vendedor" só pra saber pra onde
// devolver a pessoa no fim; o claim usa a parte antes do ponto.
// ─────────────────────────────────────────────────────────────────────────────
import { json, sameOrigin, rateLimited, safeEq } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (fn, body) => fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const s = (v, n = 400) => (v == null ? "" : v.toString().slice(0, n));

const REDIRECT_DEFAULT = "https://guileoai.com/api/google-oauth-callback";
export const SCOPE_CALENDAR = "https://www.googleapis.com/auth/calendar.events";
export const SCOPE_BUSINESS = "https://www.googleapis.com/auth/business.manage";

// Qual app OAuth usar. Preferimos o de Business (é o projeto que passou pela aprovação do
// Google e pode carregar os DOIS escopos); sem ele, caímos no app de calendário — a agenda
// liga mesmo antes da aprovação do Business Profile sair. Callback usa a MESMA função, então
// os dois lados escolhem sempre o mesmo app sem precisar carregar isso no `state`.
export function googleApp(env) {
  if (env && env.GOOGLE_BUSINESS_CLIENT_ID && env.GOOGLE_BUSINESS_CLIENT_SECRET) {
    return { kind: "business", id: s(env.GOOGLE_BUSINESS_CLIENT_ID, 300), secret: s(env.GOOGLE_BUSINESS_CLIENT_SECRET, 300), redirect: s(env.GOOGLE_BUSINESS_REDIRECT || REDIRECT_DEFAULT, 300) };
  }
  if (env && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    return { kind: "calendar", id: s(env.GOOGLE_CLIENT_ID, 300), secret: s(env.GOOGLE_CLIENT_SECRET, 300), redirect: s(env.GOOGLE_UNIFIED_REDIRECT || REDIRECT_DEFAULT, 300) };
  }
  return null;
}

// ── AUTENTICAÇÃO DO VENDEDOR (espelha /api/onboard-draft — mesma roster, mesmo código) ──────
const BOOTSTRAP = [
  { email: "luistelesc@gmail.com", code: "GUILEO-DONO", name: "Luis Teles" },
  { email: "smart@guileoai.com", code: "GUILEO-DONO", name: "Guileo" },
];
const TEAM_CODE_DEFAULT = "GUILEO-TIME-2026";
function rosterOf(env) {
  try { if (env && env.SELLER_ROSTER) { const a = JSON.parse(env.SELLER_ROSTER); if (Array.isArray(a) && a.length) return a; } } catch { /* fall back */ }
  return BOOTSTRAP;
}
function sellerEnvAuth(env, email, code) {
  const e = s(email, 160).trim().toLowerCase();
  const c = s(code, 200).trim();
  if (!e || !c) return null;
  const m = rosterOf(env).find((x) => s(x.email, 160).trim().toLowerCase() === e && safeEq(String(x.code || ""), c));
  if (m) return { email: e, roster: true };
  const team = (env && env.TEAM_INVITE_CODE) || TEAM_CODE_DEFAULT;
  if (safeEq(c, team)) return { email: e, roster: false };
  return null;
}
async function sellerDbAuth(env, email, code) {
  const e = s(email, 160).trim().toLowerCase();
  const c = s(code, 200).trim();
  if (!e || !c || !(env && env.INGEST_SECRET)) return null;
  try {
    const r = await rpc("seller_auth_check", { p_secret: env.INGEST_SECRET, p_email: e, p_code: c });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    return d && d.ok ? { email: e, roster: true } : null;
  } catch { return null; }
}
const sellerAuth = async (env, email, code) => (await sellerDbAuth(env, email, code)) || sellerEnvAuth(env, email, code);

// O PORTÃO QUE IMPORTA: o cliente-alvo tem que estar na CARTEIRA deste vendedor.
// Devolve { ok, error } — erro de leitura NUNCA vira "carteira vazia" (isso recusaria um
// vendedor legítimo dizendo que o cliente dele não é dele). Falha de rede = 503 honesto.
async function walletHas(env, sellerEmail, clientEmail) {
  if (!(env && env.INGEST_SECRET)) return { ok: false, error: "INGEST_SECRET ausente no ambiente" };
  let r;
  try { r = await rpc("seller_wallet", { p_secret: env.INGEST_SECRET, p_seller_email: sellerEmail }); }
  catch (e) { return { ok: false, error: `carteira indisponível: ${s(e, 120)}` }; }
  if (!r.ok) return { ok: false, error: `carteira indisponível (http ${r.status}) — paste db/seller_wallet.sql` };
  const rows = await r.json().catch(() => null);
  if (!Array.isArray(rows)) return { ok: false, error: "carteira respondeu num formato inesperado" };
  const hit = rows.find((x) => s(x && x.client_email, 160).trim().toLowerCase() === clientEmail);
  return { ok: true, found: !!hit, business: hit ? s(hit.business, 120) : "", rows };
}

// ── LEITURA DO ESTADO REAL (o que está GRAVADO, não o que foi pedido) ───────────────────────
// Devolve { ok, state } ou { ok:false, error } — o motivo cru sobe pra tela; "não deu pra ler"
// nunca pode aparecer como "não conectado".
async function readState(env, email) {
  if (!(env && env.INGEST_SECRET)) return { ok: false, error: "INGEST_SECRET ausente no ambiente" };
  let tokens = null, gcalRefresh = "";
  try {
    const r = await rpc("gb_creds_lookup", { p_secret: env.INGEST_SECRET, p_email: email });
    if (!r.ok) return { ok: false, error: `gb_creds_lookup http ${r.status}` };
    tokens = await r.json().catch(() => null);
  } catch (e) { return { ok: false, error: `gb_creds_lookup: ${s(e, 120)}` }; }
  try {
    const r = await rpc("gcal_token_lookup", { p_secret: env.INGEST_SECRET, p_email: email });
    if (!r.ok) return { ok: false, error: `gcal_token_lookup http ${r.status}` };
    gcalRefresh = s(await r.json().catch(() => ""), 400);
  } catch (e) { return { ok: false, error: `gcal_token_lookup: ${s(e, 120)}` }; }

  const t = tokens && typeof tokens === "object" ? tokens : {};
  const granted = s(t.scope, 800);
  const hasGbToken = s(t.refresh_token, 400).length > 10;
  const hasCalToken = gcalRefresh.length > 10;
  // Escopo de agenda concedido = escrito no `scope` do token OU (para quem conectou pelo fluxo
  // antigo /api/gcal-connect) um refresh_token gravado no provider 'gcal'.
  const calendar = hasCalToken || /calendar\.events|auth\/calendar(\s|$)/.test(granted);
  const business = hasGbToken && granted.includes("business.manage");
  return {
    ok: true,
    state: {
      connected: hasGbToken || hasCalToken,
      account: s(t.google_email, 160),          // conta Google que autorizou (best-effort)
      calendar_id: s(t.calendar_id, 160),        // qual calendário recebe os agendamentos
      account_id: s(t.account_id, 80),
      location_id: s(t.location_id, 80),
      connected_at: s(t.connected_at, 40),
      granted_scope: granted,
      scopes: { calendar, business },
    },
  };
}

// ── quem está pedindo? { email, via } ou { error, status } ──────────────────────────────────
async function resolveTarget(env, b) {
  const sellerEmail = s(b.seller_email, 160).trim().toLowerCase();
  const sellerCode = s(b.seller_code, 200).trim();

  if (sellerEmail && sellerCode) {
    const seller = await sellerAuth(env, sellerEmail, sellerCode);
    if (!seller) return { error: "unauthorized", status: 401 };
    const target = s(b.client_email, 160).trim().toLowerCase();
    if (!target.includes("@")) return { error: "client_email required", status: 400 };
    const w = await walletHas(env, seller.email, target);
    if (!w.ok) return { error: w.error, status: 503 };
    if (!w.found) return { error: "esse cliente não está na sua carteira", status: 403 };
    return { email: target, via: "seller", business: w.business };
  }

  const email = s(b.email, 160).trim().toLowerCase();
  const key = s(b.token || b.key, 200).trim();
  if (!email.includes("@") || !key) return { error: "unauthorized", status: 401 };
  const gd = await rpc("get_client_data", { p_email: email, p_key: key });
  if (!gd.ok) return { error: "unauthorized", status: 401 };
  const gdj = await gd.json().catch(() => null);
  if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return { error: "unauthorized", status: 401 };
  return { email, via: "client" };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "google-oauth-start", 30)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const action = s(b.action, 20) || "start";

    const who = await resolveTarget(env, b);
    if (who.error) return json({ error: who.error }, who.status || 401);
    const email = who.email;
    const app = googleApp(env);

    // ── STATUS — o estado REAL, lido do que foi gravado ──────────────────────────────────────
    if (action === "status") {
      const r = await readState(env, email);
      if (!r.ok) return json({ ok: false, configured: !!app, error: r.error }, 200);
      return json({
        ok: true, configured: !!app, business_ready: !!(app && app.kind === "business"),
        email, business: who.business || "", ...r.state,
      });
    }

    // ── DISCONNECT — revoga no Google, apaga aqui, e PROVA lendo de volta ───────────────────
    if (action === "disconnect") {
      if (!(env && env.INGEST_SECRET)) return json({ ok: false, error: "INGEST_SECRET ausente no ambiente" }, 200);
      // 1) pega o token pra revogar no próprio Google (best-effort — o que importa é apagar aqui)
      let refresh = "";
      try {
        const r = await rpc("gb_creds_lookup", { p_secret: env.INGEST_SECRET, p_email: email });
        if (r.ok) { const t = await r.json().catch(() => null); refresh = s(t && t.refresh_token, 400); }
      } catch { /* segue */ }
      if (!refresh) {
        try {
          const r = await rpc("gcal_token_lookup", { p_secret: env.INGEST_SECRET, p_email: email });
          if (r.ok) refresh = s(await r.json().catch(() => ""), 400);
        } catch { /* segue */ }
      }
      if (refresh) {
        try { await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: refresh }).toString() }); } catch { /* best-effort */ }
      }
      // 2) apaga as credenciais dos DOIS providers
      let erro = "";
      for (const provider of ["google_business", "gcal"]) {
        try {
          const r = await rpc("store_integration", { p_secret: env.INGEST_SECRET, p_email: email, p_provider: provider, p_tokens: {} });
          if (!r.ok) erro = `store_integration(${provider}) http ${r.status}`;
        } catch (e) { erro = `store_integration(${provider}): ${s(e, 100)}`; }
      }
      if (erro) return json({ ok: false, error: erro }, 200);
      // 3) PROVA: se ainda dá pra ler um refresh_token, NÃO desconectou.
      const after = await readState(env, email);
      if (!after.ok) return json({ ok: false, error: after.error }, 200);
      if (after.state.connected) return json({ ok: false, error: "as credenciais continuam gravadas — não desconectou" }, 200);
      return json({ ok: true, disconnected: true, ...after.state });
    }

    // ── START — monta a URL de consentimento ────────────────────────────────────────────────
    // HONESTO-INERTE: sem chave nenhuma no ambiente não existe o que autorizar. Não desenhamos
    // um botão que não faz nada — a resposta diz o que falta e a tela mostra isso.
    if (!app) {
      return json({ ok: true, ready: false, configured: false, note: "Login do Google ainda não configurado — falta GOOGLE_BUSINESS_CLIENT_ID/SECRET (avaliações + agenda) ou GOOGLE_CLIENT_ID/SECRET (só agenda) no Cloudflare. O botão acende sozinho quando a chave for setada." });
    }

    let state = "";
    try {
      const r = await rpc("gbp_oauth_begin", { p_secret: env.INGEST_SECRET || "", p_email: email });
      if (r.ok) state = s(await r.json(), 200);
    } catch { /* non-fatal */ }
    if (!state) return json({ error: "could not start oauth (state)" }, 500);
    if (who.via === "seller") state += ".v";   // só marca de onde veio, pra devolver a pessoa certa

    const scopes = app.kind === "business" ? [SCOPE_CALENDAR, SCOPE_BUSINESS] : [SCOPE_CALENDAR];
    const p = new URLSearchParams({
      client_id: app.id, redirect_uri: app.redirect, response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline",        // sem isso não vem refresh_token
      prompt: "consent",             // força refresh_token mesmo em re-autorização
      include_granted_scopes: "true",
      state,
    });
    return json({
      ok: true, ready: true, configured: true, single_consent: true,
      business_ready: app.kind === "business", scopes, email,
      url: `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`,
    });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
