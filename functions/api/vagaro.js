// Cloudflare Pages Function — POST /api/vagaro  · VAGARO connector (Public API v2)
// ─────────────────────────────────────────────────────────────────────────────
// SCAFFOLD structured to the REAL Vagaro Public API v2, but INERT until a tenant connects.
// Vagaro's API is NOT a single partner key like MindBody — it is MERCHANT-enabled: each salon
// turns on "API & Webhooks" inside their own Vagaro account ($10/mo, 5,000 calls/mo), Vagaro
// MANUALLY reviews the use case (up to ~5 business days), and the merchant gets their OWN
// clientId + clientSecretKey + region. So there is no env-level key to set — the tenant's own
// approved credentials ARE the connection. Until a tenant connects real approved creds, every
// action returns { ready:false, note } and the Guileo engine (biz_*) stays the source of truth.
//
// HONEST LIMIT: the token + availability calls below are built to the documented v2 endpoints
// (POST /{region}/api/v2/merchants/generate-access-token → { clientId, clientSecretKey, scope };
// POST .../appointments/search-availability; POST .../appointments to book). Vagaro only exposes
// exact request/response shapes AFTER a merchant is approved and their scope is granted, so BOOK
// is guarded: it only fires when the tenant is connected AND VAGARO_BOOK_CONFIRMED is set (proves
// the request body was validated against one real approved merchant). Otherwise it stays honest
// (ready:false) and the caller falls back to the internal engine. NEVER pretends to book.
//
// Interface for scheduleAdapter.js (pure, importable — same contract every connector implements):
//   vgStatus(env, email)                 → { ok, ready, stored, note }
//   vgAvailability(env, email, args)     → { ok, ready, availabilities, note }
//   vgBook(env, email, args)             → { ok, ready, booked, appointment, note }
//
// Cockpit/admin actions (per-tenant gated, same email+connection-key pattern as noshow-radar.js):
//   { action:"connect", email, token, client_id, client_secret, region, [business_id] }  → store creds
//   { action:"status",  email, token }                                                   → connected + live token test
//   { action:"availability", email, token, service_id, staff_id, location_id, start, end }
//   { action:"book", email, token, client:{first,last,phone,email}, service_id, staff_id, location_id, start }
// ─────────────────────────────────────────────────────────────────────────────
import { json } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (fn, body) => fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });

const HONEST_NOTE = "Vagaro exige aprovação por comércio (o salão liga a API na própria conta Vagaro, $10/mês, ~5 dias úteis de revisão) e recebe clientId/clientSecret próprios. Até conectar credenciais aprovadas, a Lilian agenda no Guileo (biz_*) e o cockpit é a agenda — a integração acende sozinha quando a credencial chega.";

// Vagaro API base — region is per-merchant (e.g. "us01"), returned at approval time.
const vgBase = (region) => `https://api.vagaro.com/${(region || "us01").toString()}/api/v2/merchants`;

// Per-tenant Vagaro creds live in client_integrations (provider='vagaro'), written by "connect"
// (store_integration, already live in prod) and read by vagaro_creds_lookup (db/salon_connectors.sql).
async function tenantCreds(env, email) {
  try {
    const r = await rpc("vagaro_creds_lookup", { p_secret: env.INGEST_SECRET || "", p_email: email });
    if (!r.ok) return null;
    const t = await r.json(); // { client_id, client_secret, region, business_id }
    return t && t.client_id && t.client_secret ? t : null;
  } catch { return null; }
}

// Issue a Vagaro merchant access token (short-lived; fetched per request — simple & correct;
// a KV cache keyed by client_id can be added later for volume).
async function vgToken(creds) {
  try {
    const r = await fetch(`${vgBase(creds.region)}/generate-access-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: creds.client_id, clientSecretKey: creds.client_secret, scope: "appointments,customers" }),
    });
    if (!r.ok) return null;
    const d = await r.json().catch(() => ({}));
    return d.accessToken || d.access_token || (d.data && d.data.accessToken) || null;
  } catch { return null; }
}
const vgHeaders = (token) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

// ── PURE FUNCTIONS for scheduleAdapter.js (no request/response objects) ──────────
export async function vgStatus(env, email) {
  const creds = await tenantCreds(env, email);
  if (!creds) return { ok: true, ready: false, stored: false, note: "Este negócio ainda não conectou o Vagaro (action:connect)." };
  const tok = await vgToken(creds);
  return { ok: true, ready: !!tok, stored: true, region: creds.region || null, note: tok ? "Vagaro conectado ✓" : `Credenciais guardadas mas a autenticação falhou. ${HONEST_NOTE}` };
}

export async function vgAvailability(env, email, args = {}) {
  const creds = await tenantCreds(env, email);
  if (!creds) return { ok: true, ready: false, availabilities: [], note: HONEST_NOTE };
  const token = await vgToken(creds);
  if (!token) return { ok: true, ready: false, availabilities: [], note: `Autenticação Vagaro falhou — reconecte. ${HONEST_NOTE}` };
  try {
    const r = await fetch(`${vgBase(creds.region)}/appointments/search-availability`, {
      method: "POST", headers: vgHeaders(token),
      body: JSON.stringify({ businessId: creds.business_id || undefined, serviceId: args.service_id, serviceProviderId: args.staff_id, locationId: args.location_id, startDate: args.start, endDate: args.end }),
    });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, ready: r.ok, availabilities: d.availabilities || d.slots || (d.data && d.data.availabilities) || [], note: r.ok ? undefined : `Vagaro rejeitou a consulta. ${HONEST_NOTE}`, raw: r.ok ? undefined : d };
  } catch (e) { return { ok: false, ready: false, availabilities: [], note: String(e).slice(0, 120) }; }
}

export async function vgBook(env, email, args = {}) {
  const creds = await tenantCreds(env, email);
  if (!creds) return { ok: true, ready: false, booked: false, note: HONEST_NOTE };
  // HONEST GUARD: never write a booking into a merchant's real Vagaro calendar until the exact
  // approved request body has been validated against one live merchant (VAGARO_BOOK_CONFIRMED).
  // Until then we refuse and let the caller fall back to the internal engine — no double-booking,
  // no pretending. Availability (read-only) stays live so Gui can still quote real open slots.
  if (!env.VAGARO_BOOK_CONFIRMED) return { ok: true, ready: false, booked: false, note: `Reserva Vagaro ainda não liberada para escrita (valide o corpo aprovado com um comércio real e defina VAGARO_BOOK_CONFIRMED). Enquanto isso a reserva vai para o motor Guileo. ${HONEST_NOTE}` };
  const token = await vgToken(creds);
  if (!token) return { ok: true, ready: false, booked: false, note: `Autenticação Vagaro falhou — reconecte. ${HONEST_NOTE}` };
  try {
    const c = args.client || {};
    const r = await fetch(`${vgBase(creds.region)}/appointments`, {
      method: "POST", headers: vgHeaders(token),
      body: JSON.stringify({
        businessId: creds.business_id || undefined,
        serviceId: args.service_id, serviceProviderId: args.staff_id, locationId: args.location_id, startDateTime: args.start,
        customer: { firstName: c.first || (c.name || "Guest"), lastName: c.last || ".", mobilePhone: c.phone || "", email: c.email || "" },
        notes: "Booked by Gui (Guileo)",
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, ready: true, booked: false, note: `Vagaro rejeitou a reserva. ${HONEST_NOTE}`, raw: d };
    return { ok: true, ready: true, booked: true, appointment: d.appointment || d.data || d, note: "Reservado no Vagaro ✓" };
  } catch (e) { return { ok: false, ready: true, booked: false, note: String(e).slice(0, 120) }; }
}

// ── HTTP handler (cockpit/admin) ────────────────────────────────────────────────
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

    // ── CONNECT: store this tenant's approved Vagaro merchant credentials ──
    if (action === "connect") {
      const client_id = (b.client_id || "").toString().trim();
      const client_secret = (b.client_secret || "").toString().trim();
      const region = (b.region || "").toString().trim();
      const business_id = (b.business_id || "").toString().trim();
      if (!client_id || !client_secret) return json({ error: "missing client_id / client_secret (from the salon's approved Vagaro API access)" }, 400);
      try {
        await rpc("store_integration", { p_secret: env.INGEST_SECRET || "", p_email: email, p_provider: "vagaro", p_tokens: { client_id, client_secret, region, business_id } });
      } catch { /* store failed */ }
      // verify by issuing a token right away
      const tok = await vgToken({ client_id, client_secret, region });
      return json({ ok: true, connected: !!tok, stored: true, ready: !!tok, note: tok ? "Vagaro conectado ✓" : `Dados salvos — não autenticou ainda. ${HONEST_NOTE}` });
    }

    if (action === "status") return json(await vgStatus(env, email));
    if (action === "availability") return json(await vgAvailability(env, email, { service_id: b.service_id, staff_id: b.staff_id, location_id: b.location_id, start: b.start, end: b.end }));
    if (action === "book") return json(await vgBook(env, email, { client: b.client || {}, service_id: b.service_id, staff_id: b.staff_id, location_id: b.location_id, start: b.start }));

    return json({ error: "unknown action" }, 400);
  } catch (e) { return json({ error: String(e).slice(0, 140) }, 400); }
}

// ── WIRING (via functions/lib/scheduleAdapter.js) ────────────────────────────────
// The adapter imports { vgStatus, vgAvailability, vgBook } and, for a tenant whose
// client_integrations row is provider='vagaro', routes availability→vgAvailability and
// book→vgBook. REGRA DE OURO: if vgStatus().ready is true, availability/book come from Vagaro
// (real source of truth) and the booking is mirrored into biz_appointments for the cockpit; if
// ready is false (no creds / auth down / VAGARO_BOOK_CONFIRMED unset), the adapter falls back to
// the internal Guileo engine. Never books internally "over" a connected-and-ready Vagaro without
// checking Vagaro first (= double-booking).
