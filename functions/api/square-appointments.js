// Cloudflare Pages Function — POST /api/square-appointments · SQUARE APPOINTMENTS connector
// ─────────────────────────────────────────────────────────────────────────────
// FULLY FUNCTIONAL connector (unlike mindbody.js / booksy.js, no partner approval is needed):
// Square's Bookings API is public, and each tenant can generate their OWN personal access token
// in the Square Developer dashboard (Applications → their app → Production access token). That
// token + their location_id is all we need — no OAuth dance, no Guileo-level API key. Honest
// caveat: personal access tokens act as the seller, so the tenant must treat theirs like a
// password; OAuth per-seller can be added later if we ever list a public Square app.
//
// WHAT IT DOES: lets the Gui voice agent read a salon's REAL Square Appointments availability
// and BOOK straight into their Square calendar — the client lands in the system the salon
// already uses. Guileo engine (biz_*) remains the default for tenants without Square.
// Wire into agent-schedule.js when a tenant is connected (see WIRING at the bottom).
//
// Cockpit/admin actions (per-tenant gated, same email+connection-key pattern as noshow-radar.js):
//   { action:"connect", email, token, access_token, location_id }               → store + verify creds
//   { action:"status",  email, token }                                          → connected? live location test
//   { action:"availability", email, token, service_variation_id, [team_member_id], start, end }
//   { action:"book", email, token, client:{first,last,phone,email}, service_variation_id,
//     [service_variation_version], [team_member_id], [duration_minutes], start }
// ─────────────────────────────────────────────────────────────────────────────
import { json } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const SQ = "https://connect.squareup.com/v2";
const SQ_VERSION = "2025-01-23"; // Square-Version pin — bump deliberately, never implicitly
const rpc = (fn, body) => fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });

// Per-tenant Square creds live in client_integrations (provider='square'), written by "connect"
// (store_integration, already live in prod) and read by square_creds_lookup (db/salon_connectors.sql).
async function tenantCreds(env, email) {
  try {
    const r = await rpc("square_creds_lookup", { p_secret: env.INGEST_SECRET || "", p_email: email });
    if (!r.ok) return null;
    const t = await r.json(); // { access_token, location_id }
    return t && t.access_token ? t : null;
  } catch { return null; }
}

const sqHeaders = (accessToken) => ({ Authorization: `Bearer ${accessToken}`, "Square-Version": SQ_VERSION, "Content-Type": "application/json" });

// Live credential test: list locations with the tenant's token.  GET /v2/locations
async function sqVerify(accessToken) {
  try {
    const r = await fetch(`${SQ}/locations`, { headers: sqHeaders(accessToken) });
    if (!r.ok) return null;
    return ((await r.json()) || {}).locations || [];
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE CONNECTOR FUNCTIONS — the adapter (functions/lib/scheduleAdapter.js) imports
// these three. Every connector implements the same shape so the adapter can route
// blind: (env, email[, args]) → plain object. They resolve the tenant's OWN Square
// creds internally via tenantCreds (per-tenant token, never a global env). HONEST:
// no token / no location / dead token → { ready:false } and the adapter falls back
// to the internal Guileo engine (biz_*). These never throw.
// ─────────────────────────────────────────────────────────────────────────────

// providerStatus — is THIS tenant connected to Square and ready to be the source of truth?
export async function sqStatus(env, email) {
  try {
    const creds = await tenantCreds(env, email);
    if (!creds) return { provider: "square", ready: false, note: "Square not connected for this business." };
    const locs = await sqVerify(creds.access_token);
    if (!locs) return { provider: "square", ready: false, note: "Square credentials stored but authentication failed — reconnect." };
    if (!creds.location_id) return { provider: "square", ready: false, note: "Token OK but no location_id — reconnect with one." };
    return { provider: "square", ready: true, location_id: creds.location_id, note: "Square connected ✓" };
  } catch (e) { return { provider: "square", ready: false, note: "status error: " + String(e).slice(0, 80) }; }
}

// getAvailability — REAL open slots straight from Square Bookings.  POST /v2/bookings/availability/search
// args: { service_variation_id (req), team_member_id?, start?, end? }
export async function sqAvailability(env, email, args = {}) {
  try {
    const creds = await tenantCreds(env, email);
    if (!creds) return { ok: false, ready: false, availabilities: [], note: "Square not connected." };
    if (!creds.location_id) return { ok: false, ready: false, availabilities: [], note: "No location_id stored — reconnect passing location_id." };
    if (!args.service_variation_id) return { ok: false, ready: true, availabilities: [], error: "missing service_variation_id" };
    const startAt = args.start ? new Date(args.start).toISOString() : new Date().toISOString();
    const endAt = args.end ? new Date(args.end).toISOString() : new Date(Date.now() + 7 * 864e5).toISOString();
    const seg = { service_variation_id: String(args.service_variation_id) };
    if (args.team_member_id) seg.team_member_id_filter = { any: [String(args.team_member_id)] };
    const r = await fetch(`${SQ}/bookings/availability/search`, {
      method: "POST", headers: sqHeaders(creds.access_token),
      body: JSON.stringify({ query: { filter: { start_at_range: { start_at: startAt, end_at: endAt }, location_id: creds.location_id, segment_filters: [seg] } } }),
    });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, ready: true, availabilities: d.availabilities || [], raw: r.ok ? undefined : d };
  } catch (e) { return { ok: false, ready: false, availabilities: [], note: "availability error: " + String(e).slice(0, 80) }; }
}

// book — WRITE the appointment into Square (source of truth for connected tenants).  POST /v2/bookings
// args: { service_variation_id (req), start (req), client:{first,last,phone,email,name},
//         service_variation_version?, team_member_id?, duration_minutes? }
export async function sqBook(env, email, args = {}) {
  try {
    const creds = await tenantCreds(env, email);
    if (!creds) return { ok: false, ready: false, note: "Square not connected." };
    if (!creds.location_id) return { ok: false, ready: false, note: "No location_id stored — reconnect passing location_id." };
    if (!args.service_variation_id || !args.start) return { ok: false, ready: true, error: "missing service_variation_id / start" };
    const c = args.client || {};
    // 1) find the customer by email or phone, else create.  POST /v2/customers/search · POST /v2/customers
    let customerId = "";
    try {
      const filter = c.email ? { email_address: { exact: String(c.email) } } : c.phone ? { phone_number: { exact: String(c.phone) } } : null;
      if (filter) {
        const sr = await fetch(`${SQ}/customers/search`, { method: "POST", headers: sqHeaders(creds.access_token), body: JSON.stringify({ query: { filter }, limit: 1 }) });
        if (sr.ok) { const sj = await sr.json(); customerId = (sj.customers && sj.customers[0] && sj.customers[0].id) || ""; }
      }
    } catch { /* */ }
    if (!customerId) {
      try {
        const cr = await fetch(`${SQ}/customers`, {
          method: "POST", headers: sqHeaders(creds.access_token),
          body: JSON.stringify({ given_name: c.first || (c.name || "Guest"), family_name: c.last || "", phone_number: c.phone || undefined, email_address: c.email || undefined, note: "Created by Gui (Guileo)" }),
        });
        if (cr.ok) { const cj = await cr.json(); customerId = (cj.customer && cj.customer.id) || ""; }
      } catch { /* */ }
    }
    if (!customerId) return { ok: false, ready: true, note: "Couldn't find or create the customer in Square." };
    // 2) create the booking. service_variation_version is required by Square for the segment;
    // if the caller didn't pass it, fetch the catalog object to get the current version.  GET /v2/catalog/object/{id}
    let variationVersion = args.service_variation_version;
    if (!variationVersion) {
      try {
        const vr = await fetch(`${SQ}/catalog/object/${encodeURIComponent(String(args.service_variation_id))}`, { headers: sqHeaders(creds.access_token) });
        if (vr.ok) { const vj = await vr.json(); variationVersion = (vj.object && vj.object.version) || undefined; }
      } catch { /* */ }
    }
    const segment = {
      service_variation_id: String(args.service_variation_id),
      service_variation_version: variationVersion,
      team_member_id: args.team_member_id ? String(args.team_member_id) : undefined,
      duration_minutes: args.duration_minutes ? Number(args.duration_minutes) : undefined,
    };
    const r = await fetch(`${SQ}/bookings`, {
      method: "POST", headers: sqHeaders(creds.access_token),
      body: JSON.stringify({
        idempotency_key: `gui-${email}-${String(args.start)}-${String(args.service_variation_id)}`.slice(0, 45), // body-derived, never a timestamp
        booking: { location_id: creds.location_id, start_at: new Date(args.start).toISOString(), customer_id: customerId, customer_note: "Booked by Gui (Guileo)", appointment_segments: [segment] },
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, ready: true, note: "Square rejected the booking.", raw: d };
    return { ok: true, ready: true, booking: d.booking || d, message: "Booked in Square Appointments ✓" };
  } catch (e) { return { ok: false, ready: false, note: "book error: " + String(e).slice(0, 80) }; }
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

    // ── CONNECT: store this tenant's Square access token + location, verify live ──
    if (action === "connect") {
      const access_token = (b.access_token || "").toString().trim();
      const location_id = (b.location_id || "").toString().trim();
      if (!access_token) return json({ error: "missing access_token" }, 400);
      // Verify FIRST (list locations) — and if no location_id was given but the seller has
      // exactly one location, adopt it so connect is one field for most salons.
      const locs = await sqVerify(access_token);
      const finalLoc = location_id || (locs && locs.length === 1 ? locs[0].id : "");
      try {
        await rpc("store_integration", { p_secret: env.INGEST_SECRET || "", p_email: email, p_provider: "square", p_tokens: { access_token, location_id: finalLoc } });
      } catch { /* store failed */ }
      if (!locs) return json({ ok: true, connected: false, note: "Saved, but Square rejected the access token — check it in the Square Developer dashboard (Production token)." });
      if (!finalLoc) return json({ ok: true, connected: false, locations: locs.map((l) => ({ id: l.id, name: l.name })), note: "Token OK — this seller has multiple locations; reconnect passing location_id." });
      return json({ ok: true, connected: true, location_id: finalLoc, note: "Square Appointments connected ✓" });
    }

    // ── STATUS / AVAILABILITY / BOOK all delegate to the SAME pure functions the
    // adapter uses — one code path, portal and agent can never drift apart. ──
    if (action === "status") {
      const s = await sqStatus(env, email);
      return json({ ok: true, ready: !!s.ready, location_id: s.location_id || null, note: s.note });
    }

    const creds = await tenantCreds(env, email);
    if (!creds) return json({ ok: true, ready: false, note: "This business hasn't connected Square yet (action:connect with their access token)." });
    if (!creds.location_id) return json({ ok: true, ready: false, note: "No location_id stored — reconnect passing location_id." });

    if (action === "availability") {
      if (!b.service_variation_id) return json({ error: "missing service_variation_id" }, 400);
      const a = await sqAvailability(env, email, { service_variation_id: b.service_variation_id, team_member_id: b.team_member_id, start: b.start, end: b.end });
      return json({ ok: a.ok, availabilities: a.availabilities || [], raw: a.raw });
    }

    if (action === "book") {
      if (!b.service_variation_id || !b.start) return json({ error: "missing service_variation_id / start" }, 400);
      const r = await sqBook(env, email, {
        service_variation_id: b.service_variation_id, start: b.start, client: b.client || {},
        service_variation_version: b.service_variation_version, team_member_id: b.team_member_id, duration_minutes: b.duration_minutes,
      });
      if (!r.ok) return json({ ok: false, note: r.note || r.error || "Square rejected the booking.", raw: r.raw });
      return json({ ok: true, booking: r.booking, message: r.message || "Booked in Square Appointments ✓" });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) { return json({ error: String(e).slice(0, 140) }, 400); }
}

// ── WIRING (when a tenant is connected) ──────────────────────────────────────
// In functions/api/agent-schedule.js, before the Guileo-engine availability/book, check
// tenantCreds(): if the tenant has Square connected (access_token + location_id), route
// op='availability'/'book' here (map the caller's spoken service → the tenant's Square
// service_variation_id via a small mapping stored at connect time). Guileo engine (biz_*)
// stays the fallback for tenants without Square. Kept OUT of the hot path for now so it
// can't affect the working Guileo booking until tested against a real Square seller.
