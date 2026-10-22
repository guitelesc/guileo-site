// Cloudflare Pages Function — POST /api/booksy · BOOKSY connector
// ─────────────────────────────────────────────────────────────────────────────
// HONEST INERT SCAFFOLD (exact mindbody.js pattern). Booksy has NO public API today —
// there is no developer program, no partner-accessible Bookings endpoint. So this
// connector cannot book into Booksy yet, and it never pretends to: every data action
// returns { ready:false, note } with the honest state. What it DOES do now:
//   • "connect" stores whatever identifiers the salon has (business_id / booksy URL /
//     api_key if they ever get one) in client_integrations provider='booksy' — so the
//     day Booksy opens an API or a partnership, tenants light up with zero re-onboarding.
//   • "status" returns ready:false + the honest note. Meanwhile the salon captures
//     bookings via Gui (widget/phone) into the Guileo engine (biz_*), which stays default.
//
// Interface for scheduleAdapter.js (pure, importable — SAME contract as mindbody/vagaro so the
// adapter treats every provider identically; Booksy's just always report ready:false today):
//   bkStatus(env, email)                 → { ok, ready:false, stored, note }
//   bkAvailability(env, email, args)     → { ok, ready:false, availabilities:[], note }
//   bkBook(env, email, args)             → { ok, ready:false, booked:false, note }
//
// Cockpit/admin actions (per-tenant gated, same email+connection-key pattern as noshow-radar.js):
//   { action:"connect", email, token, business_id, [booksy_url], [api_key] }  → store creds
//   { action:"status",  email, token }                                        → ready:false + note
//   { action:"availability" | "book", ... }                                   → ready:false + note
// ─────────────────────────────────────────────────────────────────────────────
import { json } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (fn, body) => fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });

// ── A NOTA NO IDIOMA DA TELA (incidente 2026-09-28) ───────────────────────────────────────────
// Era uma constante em português, lida pelo dono de um salão numa interface em inglês. Agora sai
// em en/pt/es/hi — `lang` do corpo (ou de `args.lang` nas funções puras), padrão en.
const idiomaTela = (v) => { const l = String(v || "").toLowerCase().slice(0, 2); return ["en", "pt", "es", "hi"].includes(l) ? l : "en"; };
const NOTA = {
  en: "Booksy has no public API yet — in the meantime, bookings are captured by Gui (widget/phone). Any details you save here are kept, and the integration switches on the day Booksy opens an API or partnership.",
  pt: "A Booksy ainda não tem API pública — enquanto isso, os agendamentos entram pela Gui (widget/telefone). Os dados que você salvar aqui ficam guardados, e a integração acende no dia em que a Booksy abrir API ou parceria.",
  es: "Booksy aún no tiene API pública — mientras tanto, las reservas entran por Gui (widget/teléfono). Los datos que guarde aquí se conservan, y la integración se activa el día que Booksy abra una API o alianza.",
  hi: "Booksy का अभी कोई सार्वजनिक API नहीं है — तब तक बुकिंग Gui (विजेट/फ़ोन) से ली जाती हैं। आप यहाँ जो जानकारी सहेजेंगे वह सुरक्षित रहेगी, और जिस दिन Booksy API या साझेदारी खोलेगा, इंटीग्रेशन चालू हो जाएगा।",
};
const SALVO = { en: "Details saved ✓ — ", pt: "Dados salvos ✓ — ", es: "Datos guardados ✓ — ", hi: "जानकारी सहेजी गई ✓ — " };
const NAO_SALVO = {
  en: "I couldn't save your Booksy details right now. Please try again.",
  pt: "Não consegui salvar seus dados da Booksy agora. Tente de novo.",
  es: "No pude guardar sus datos de Booksy ahora. Inténtelo de nuevo.",
  hi: "मैं अभी आपकी Booksy जानकारी सहेज नहीं सका। कृपया फिर कोशिश करें।",
};
export const notaBooksy = (lang) => NOTA[idiomaTela(lang)];

// Per-tenant Booksy identifiers live in client_integrations (provider='booksy'), written by
// "connect" (store_integration, already live in prod) and read by booksy_creds_lookup
// (db/salon_connectors.sql).
async function tenantCreds(env, email) {
  try {
    const r = await rpc("booksy_creds_lookup", { p_secret: env.INGEST_SECRET || "", p_email: email });
    if (!r.ok) return null;
    const t = await r.json(); // { business_id, booksy_url, api_key }
    return t && (t.business_id || t.booksy_url || t.api_key) ? t : null;
  } catch { return null; }
}

// ── PURE FUNCTIONS for scheduleAdapter.js ────────────────────────────────────────
// Booksy has no public API today, so all three always return ready:false — this is the honest
// signal the adapter uses to fall back to the internal Guileo engine. The interface matches
// mindbody/vagaro exactly so the adapter needs zero special-casing; the day Booksy opens an API,
// only the bodies below change (not the adapter, not the signatures).
export async function bkStatus(env, email, lang = "en") {
  const creds = await tenantCreds(env, email);
  return { ok: true, ready: false, stored: !!creds, business_id: (creds && creds.business_id) || null, note: notaBooksy(lang) };
}
export async function bkAvailability(env, email, _args = {}) {
  const creds = await tenantCreds(env, email);
  return { ok: true, ready: false, stored: !!creds, availabilities: [], note: notaBooksy(_args && _args.lang) };
}
export async function bkBook(env, email, _args = {}) {
  const creds = await tenantCreds(env, email);
  return { ok: true, ready: false, stored: !!creds, booked: false, note: notaBooksy(_args && _args.lang) };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    const action = (b.action || "status").toString();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);

    // PER-TENANT GATE — email↔connection-key (get_client_data), identical to noshow-radar.js.
    const gd = await rpc("get_client_data", { p_email: email, p_key: key });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);
    const lang = idiomaTela(b.lang || (gdj.identity && gdj.identity.lang));

    // ── CONNECT: store the salon's Booksy identifiers for the day the API opens ──
    if (action === "connect") {
      const business_id = (b.business_id || "").toString().trim();
      const booksy_url = (b.booksy_url || "").toString().trim();
      const api_key = (b.api_key || "").toString().trim();
      if (!business_id && !booksy_url && !api_key) return json({ error: "missing business_id / booksy_url" }, 400);
      // 🚨 "Dados salvos ✓" SAÍA SEM OLHAR A RESPOSTA (2026-09-28): o `catch {}` engolia a falha e
      // o `fetch` nem lança em erro HTTP — a tela confirmava `stored:true` sobre nada gravado.
      // Agora só diz "salvo" com o banco respondendo 2xx; senão, 503 com a frase e o motivo.
      let gravou = false, motivo = "";
      try {
        const sr = await rpc("store_integration", { p_secret: env.INGEST_SECRET || "", p_email: email, p_provider: "booksy", p_tokens: { business_id, booksy_url, api_key } });
        gravou = sr.ok; if (!sr.ok) motivo = `store_integration HTTP ${sr.status}`;
      } catch (e) { motivo = String(e).slice(0, 120); }
      if (!gravou) return json({ ok: false, connected: false, stored: false, ready: false, note: NAO_SALVO[lang], error: NAO_SALVO[lang], erro: NAO_SALVO[lang], detalhe_tecnico: motivo }, 503);
      return json({ ok: true, connected: false, stored: true, ready: false, note: `${SALVO[lang]}${notaBooksy(lang)}` });
    }

    if (action === "status") return json(await bkStatus(env, email, lang));
    if (action === "availability") return json(await bkAvailability(env, email, b));
    if (action === "book") return json(await bkBook(env, email, b));

    return json({ error: "unknown action" }, 400);
  } catch (e) { return json({ error: String(e).slice(0, 140) }, 400); }
}

// ── WIRING (the day Booksy opens an API) ─────────────────────────────────────
// Mirror square-appointments.js: implement availability/book against the real endpoints,
// then in functions/api/agent-schedule.js route op='availability'/'book' here for tenants
// with tenantCreds() present. Until then this file must stay inert — agent-schedule.js
// should NOT check Booksy at all (there is nothing to route to).
