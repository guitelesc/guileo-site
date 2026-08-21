// Cloudflare Pages Function — GET /api/google-oauth-callback · fecha o login do Google
// ─────────────────────────────────────────────────────────────────────────────
// O Google devolve o dono (ou a cliente sentada com o vendedor) aqui com ?code&state.
// Resolvemos o tenant pelo `state` no servidor (gbp_oauth_claim — uso único, TTL 10 min),
// trocamos o code por refresh_token, e GRAVAMOS por tenant:
//   • provider 'google_business' → { account_id, location_id, refresh_token, scope, … }
//   • provider 'gcal'            → { refresh_token, scope, app } — SÓ se o escopo de agenda
//                                   foi realmente concedido (é o que agent-schedule.js lê)
//
// 🚨 O GOOGLE PODE CONCEDER MENOS DO QUE PEDIMOS. Na tela de consentimento a pessoa pode
// desmarcar a agenda; o token volta sem ela. Se a gente não OLHAR o campo `scope` da resposta,
// a tela diz "conectado ✓" e o primeiro agendamento da primeira ligação falha em silêncio — o
// pior resultado possível (é a mesma família de defeito do `fetch` que não lança em 404). Por
// isso: guardamos o escopo CONCEDIDO junto do token, só gravamos 'gcal' quando a agenda veio
// de verdade, e voltamos com google=partial&granted=… quando veio pela metade.
//
// HONESTO-INERTE: sem GOOGLE_BUSINESS_CLIENT_ID/SECRET (nem GOOGLE_CLIENT_ID/SECRET) não há
// troca de token pra fazer — voltamos com google=error&reason=api_not_ready. Nunca inventamos
// credencial.
// ─────────────────────────────────────────────────────────────────────────────
import { googleApp, SCOPE_CALENDAR, SCOPE_BUSINESS } from "./google-oauth-start.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (fn, body) => fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const s = (v, n = 400) => (v == null ? "" : v.toString().slice(0, n));

const APP = "https://guileoai.com";

// Devolve a pessoa pra tela de onde ela saiu, com um status que a UI sabe ler.
//   surface: "portal" (cliente) | "vendedor"
const back = (surface, status, extra = {}) => {
  const q = new URLSearchParams({ google: status, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v)) });
  const path = surface === "vendedor" ? "/vendedor" : "/portal";
  return Response.redirect(`${APP}${path}?${q.toString()}`, 302);
};

export async function onRequestGet(context) {
  const { request, env } = context;
  let surface = "portal";
  try {
    const u = new URL(request.url);
    const code = s(u.searchParams.get("code"), 800);
    const rawState = s(u.searchParams.get("state"), 220);
    const err = s(u.searchParams.get("error"), 120);
    // sufixo ".v" = começou no hub do vendedor (o claim usa só a parte antes do ponto)
    const [state, mark] = rawState.split(".");
    surface = mark === "v" ? "vendedor" : "portal";
    if (err) return back(surface, "error", { reason: err });          // negou / erro do Google
    if (!code || !state) return back(surface, "error", { reason: "missing_params" });

    // Tenant a partir do state (uso único). Ruim/usado/expirado → null.
    let email = "";
    try {
      const r = await rpc("gbp_oauth_claim", { p_secret: env.INGEST_SECRET || "", p_state: state });
      if (r.ok) email = s(await r.json(), 160).trim().toLowerCase();
    } catch { /* non-fatal */ }
    if (!email.includes("@")) return back(surface, "error", { reason: "invalid_state" });

    const app = googleApp(env);
    if (!app) return back(surface, "error", { reason: "api_not_ready" });

    // Troca do código por refresh_token — e pelo `scope` REALMENTE concedido.
    let refresh_token = "", access_token = "", granted = "", tokenHttp = 0;
    try {
      const tr = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: app.id, client_secret: app.secret, redirect_uri: app.redirect, grant_type: "authorization_code" }).toString(),
      });
      // O STATUS PRIMEIRO: `fetch` não lança em 400/401. Sem esta linha, um invalid_client vira
      // corpo vazio e a pessoa voltaria com um erro genérico em vez do motivo real.
      tokenHttp = tr.status;
      if (tr.ok) {
        const td = await tr.json().catch(() => ({}));
        refresh_token = s(td.refresh_token, 400);
        access_token = s(td.access_token, 800);
        granted = s(td.scope, 800);
      }
    } catch { /* cai no reason abaixo */ }
    if (!refresh_token) return back(surface, "error", { reason: tokenHttp && tokenHttp >= 400 ? `token_http_${tokenHttp}` : "no_refresh_token" });

    const gotCalendar = granted.includes(SCOPE_CALENDAR) || /auth\/calendar(\s|$)/.test(granted);
    const gotBusiness = granted.includes(SCOPE_BUSINESS);

    // Best-effort: QUAL conta e QUAL calendário (a tela promete mostrar isso). O calendário
    // primário responde com id = e-mail da conta. Se o Google recusar (escopo curto), fica em
    // branco e a tela simplesmente não mostra a linha — nunca inventa um endereço.
    let google_email = "", calendar_id = "";
    if (access_token && gotCalendar) {
      try {
        const cr = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary", { headers: { Authorization: `Bearer ${access_token}` } });
        if (cr.ok) { const cd = await cr.json().catch(() => ({})); calendar_id = s(cd.id, 160); google_email = calendar_id.includes("@") ? calendar_id : ""; }
      } catch { /* opcional */ }
    }

    // Best-effort: conta + local do Business Profile (só faz sentido com business.manage).
    let account_id = "", location_id = "";
    if (access_token && gotBusiness) {
      try {
        const ar = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", { headers: { Authorization: `Bearer ${access_token}` } });
        const ad = ar.ok ? await ar.json().catch(() => ({})) : {};
        const acc = Array.isArray(ad.accounts) && ad.accounts[0] && ad.accounts[0].name; // "accounts/123"
        if (acc) {
          account_id = String(acc).replace(/^accounts\//, "");
          const lr = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${acc}/locations?readMask=name&pageSize=1`, { headers: { Authorization: `Bearer ${access_token}` } });
          const ld = lr.ok ? await lr.json().catch(() => ({})) : {};
          const loc = Array.isArray(ld.locations) && ld.locations[0] && ld.locations[0].name; // "locations/456"
          if (loc) location_id = String(loc).replace(/^locations\//, "");
        }
      } catch { /* descoberta é opcional — o refresh_token já está capturado */ }
    }

    // GRAVAR E CONFERIR. `fetch` NÃO lança em erro HTTP: com só o try/catch, um 404/500 do
    // PostgREST (RPC ausente, gate errado, banco fora) passava batido e a tela dizia
    // "google=connected" com ZERO credencial guardada. Conectado = gravado, provado pela leitura.
    const tokens = {
      account_id, location_id, refresh_token,
      scope: granted, app: app.kind,
      google_email, calendar_id,
      connected_at: new Date().toISOString(),
    };
    let guardou = false;
    try {
      const sr = await rpc("store_integration", { p_secret: env.INGEST_SECRET || "", p_email: email, p_provider: "google_business", p_tokens: tokens });
      guardou = sr.ok;
    } catch { guardou = false; }
    if (guardou) {
      try {
        const vr = await rpc("gb_creds_lookup", { p_secret: env.INGEST_SECRET || "", p_email: email });
        const v = vr.ok ? await vr.json().catch(() => null) : null;
        if (!(v && typeof v === "object" && String(v.refresh_token || "").length > 0)) guardou = false;
      } catch { guardou = false; }
    }
    if (!guardou) return back(surface, "error", { reason: "store_failed" });

    // AGENDA — só grava o provider 'gcal' (o que agent-schedule.js lê pra jogar o agendamento no
    // Google Calendar) quando o escopo de agenda foi CONCEDIDO. Gravar sem o escopo seria criar
    // um "conectado" que falha na primeira ligação.
    let calendarOk = false;
    if (gotCalendar) {
      try {
        const sr = await rpc("store_integration", { p_secret: env.INGEST_SECRET || "", p_email: email, p_provider: "gcal", p_tokens: { refresh_token, scope: granted, app: app.kind, calendar_id } });
        calendarOk = sr.ok;
      } catch { calendarOk = false; }
      if (calendarOk) {
        try {
          const vr = await rpc("gcal_token_lookup", { p_secret: env.INGEST_SECRET || "", p_email: email });
          const v = vr.ok ? s(await vr.json().catch(() => ""), 400) : "";
          if (v.length < 10) calendarOk = false;
        } catch { calendarOk = false; }
      }
      if (!calendarOk) return back(surface, "error", { reason: "store_calendar_failed" });
    }

    const grantedList = [calendarOk ? "cal" : "", gotBusiness ? "gb" : ""].filter(Boolean).join(",");
    // "connected" só quando a agenda entrou (é a promessa que o dono fez) E, quando o app é o de
    // Business, as avaliações também. Qualquer coisa a menos volta como PARCIAL, com o que veio.
    const full = calendarOk && (app.kind !== "business" || gotBusiness);
    return back(surface, full ? "connected" : "partial", {
      granted: grantedList,
      reason: !calendarOk ? "no_calendar_scope" : (!gotBusiness && app.kind === "business" ? "no_business_scope" : (location_id ? "" : "needs_location")),
    });
  } catch (e) { return back(surface, "error", { reason: s(e, 60).replace(/[^a-z0-9_]/gi, "") }); }
}
