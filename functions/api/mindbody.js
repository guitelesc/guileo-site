// Cloudflare Pages Function — POST /api/mindbody  · MINDBODY connector (Public API v6)
// ─────────────────────────────────────────────────────────────────────────────
// SCAFFOLD — the code is complete and structured to the real MindBody v6 API, but it is
// INERT until (1) MINDBODY_API_KEY (developer key, requires MindBody partner approval) is set
// in the Cloudflare env, and (2) each tenant connects their site (site_id + source/staff
// credentials, stored per-tenant in client_integrations provider='mindbody'). Until then every
// action returns { ready:false, note } so nothing breaks and the Guileo engine stays the default.
//
// WHAT IT DOES once live: lets the Gui voice agent read a business's REAL MindBody availability
// and BOOK the appointment straight into their MindBody — so the client is booked in the system
// the spa already uses.
//
// ── TWO WAYS TO CALL THIS FILE ────────────────────────────────────────────────
// 1) HTTP handler (onRequestPost) — used by the cockpit/admin to connect + status-check.
//      { action:"connect", email, token, site_id, source_name, source_password, sites?, session_types?, staff? }
//      { action:"status" | "availability" | "book", email, token, ... }
// 2) PURE FUNCTIONS (mbStatus / mbAvailability / mbBook / tenantCreds) — exported so the unified
//    scheduleAdapter.js can import them DIRECTLY (no round-trip HTTP) and route a connected tenant's
//    availability/book to their real MindBody. These take (env, creds, args) where `creds` is the
//    tenant's stored tokens blob (from tenantCreds / mb_creds_lookup). See MULTI-STUDIO below.
//
// ── MULTI-STUDIO (Natura has TWO studios) ─────────────────────────────────────
// MindBody source credentials (source_name/source_password) are issued at the DEVELOPER-ACCOUNT
// level and work across every Site the source is activated on — but each API call must carry the
// right `SiteId` header, and a user-token is issued PER site. So the stored creds shape is:
//   tokens = {
//     source_name, source_password,          // shared source credential
//     site_id: "767008",                       // DEFAULT Site-Id (Natura → Astoria 767008)
//     sites: { "Astoria":"767008",             // biz_location NAME → MindBody Site-Id
//              "UES Salon":"5734109",          //   (Natura → UES studio 5734109)
//              "UES Med Spa":"5734109" },
//     session_types?: { "Massage":123, ... },  // optional: spoken service → MindBody SessionTypeId
//     staff?: { "767008":100012, ... }         // optional: default StaffId per site
//   }
// resolveSite() picks the Site-Id from (args.site_id) → (creds.sites[args.location]) → (creds.site_id).
// ─────────────────────────────────────────────────────────────────────────────
import { json } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const MB = "https://api.mindbodyonline.com/public/v6";
const rpc = (fn, body) => fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });

// ── Per-tenant MindBody creds (client_integrations provider='mindbody', read by mb_creds_lookup).
// Exported so scheduleAdapter.js can resolve creds once and pass them to the pure functions.
export async function tenantCreds(env, email) {
  try {
    const r = await rpc("mb_creds_lookup", { p_secret: env.INGEST_SECRET || "", p_email: (email || "").toString().trim().toLowerCase() });
    if (!r.ok) return null;
    const t = await r.json(); // { site_id, source_name, source_password, sites?, session_types?, staff? }
    return t && (t.site_id || (t.sites && Object.keys(t.sites).length)) ? t : null;
  } catch { return null; }
}

// Pick the right MindBody Site-Id for this request: explicit arg → per-location map → default.
export function resolveSite(creds, args = {}) {
  const c = creds || {}, a = args || {};
  const byLoc = a.location && c.sites ? c.sites[a.location] : null;
  const site_id = String(a.site_id || byLoc || c.site_id || "").trim();
  return { site_id, source_name: c.source_name, source_password: c.source_password };
}
// Resolve a spoken service name → MindBody SessionTypeId, if the tenant mapped one at connect time.
function resolveSessionType(creds, args = {}) {
  if (args.session_type_id) return String(args.session_type_id);
  const map = (creds || {}).session_types || {};
  if (args.service && map[args.service]) return String(map[args.service]);
  return "";
}

// Issue a MindBody staff/source user token for one site (short-lived; fetched per request — simple &
// correct; a KV cache keyed by site can be added later for volume).
async function mbToken(env, site) {
  // Source credentials are per-APP (same across all Sites), so they live in the Cloudflare env
  // (MINDBODY_SOURCE_NAME / MINDBODY_SOURCE_PASSWORD) — never in the browser or per-tenant blob.
  // A per-tenant stored source_name/password still wins if present (rare: a client with its own app).
  const user = site.source_name || env.MINDBODY_SOURCE_NAME || "";
  const pass = site.source_password || env.MINDBODY_SOURCE_PASSWORD || "";
  if (!env.MINDBODY_API_KEY || !site || !site.site_id || !user) return null;
  try {
    const r = await fetch(`${MB}/usertoken/issue`, {
      method: "POST",
      headers: { "Api-Key": env.MINDBODY_API_KEY, SiteId: String(site.site_id), "Content-Type": "application/json" },
      body: JSON.stringify({ Username: user, Password: pass }),
    });
    if (!r.ok) return null;
    return ((await r.json()) || {}).AccessToken || null;
  } catch { return null; }
}
const mbHeaders = (env, site, token) => ({ "Api-Key": env.MINDBODY_API_KEY, SiteId: String(site.site_id), Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

// ── PURE: connection status. Issues a token against the tenant's DEFAULT site to prove it's live.
export async function mbStatus(env, creds) {
  if (!env.MINDBODY_API_KEY) return { ready: false, note: "MindBody API key not set — apply for MindBody developer access, then set MINDBODY_API_KEY in Cloudflare env." };
  const site = resolveSite(creds);
  if (!site.site_id) return { ready: false, note: "This business hasn't connected MindBody yet (action:connect)." };
  // The Api-Key alone authorizes PUBLIC reads (services, availability) — proven against Site -99.
  // A user token is only needed to WRITE (create an appointment). So "connected" = the Api-Key can
  // read this site; booking is attempted with a token and degrades to a callback if it can't write.
  let apiOk = false;
  try {
    const kr = await fetch(`${MB}/site/sites`, { headers: { "Api-Key": env.MINDBODY_API_KEY, SiteId: String(site.site_id) } });
    apiOk = kr.ok;
  } catch { /* network */ }
  const tok = await mbToken(env, site);
  return { ready: apiOk, can_write: !!tok, provider: "mindbody", site_id: site.site_id, sites: (creds || {}).sites || null, note: apiOk ? (tok ? "MindBody connected ✓ (read + write)" : "MindBody connected ✓ (read-only — booking needs a staff token)") : "API key can't read this site yet." };
}

// ── PURE: real open slots from the tenant's MindBody (routes to the right studio via resolveSite).
export async function mbAvailability(env, creds, args = {}) {
  if (!env.MINDBODY_API_KEY) return { ready: false, availabilities: [], note: "MindBody API key not set." };
  const site = resolveSite(creds, args);
  if (!site.site_id) return { ready: false, availabilities: [], note: "MindBody not connected for this business." };
  const token = await mbToken(env, site);
  if (!token) return { ready: false, availabilities: [], note: "MindBody authentication failed — reconnect." };
  try {
    const qs = new URLSearchParams();
    const stid = resolveSessionType(creds, args);
    if (stid) qs.append("SessionTypeIds", stid);
    if (args.location_id) qs.append("LocationIds", String(args.location_id));
    if (args.staff_id) qs.append("StaffIds", String(args.staff_id));
    if (args.start) qs.append("StartDate", String(args.start));
    if (args.end) qs.append("EndDate", String(args.end));
    const r = await fetch(`${MB}/appointment/bookableitems?${qs.toString()}`, { headers: mbHeaders(env, site, token) });
    const d = await r.json().catch(() => ({}));
    return { ready: true, ok: r.ok, site_id: site.site_id, availabilities: d.Availabilities || d.BookableItems || [], raw: r.ok ? undefined : d };
  } catch (e) { return { ready: true, ok: false, availabilities: [], note: String(e).slice(0, 140) }; }
}

// ── PURE: find/create the client, then create the appointment IN the tenant's MindBody studio.
export async function mbBook(env, creds, args = {}) {
  if (!env.MINDBODY_API_KEY) return { ready: false, ok: false, note: "MindBody API key not set." };
  const site = resolveSite(creds, args);
  if (!site.site_id) return { ready: false, ok: false, note: "MindBody not connected for this business." };
  const token = await mbToken(env, site);
  if (!token) return { ready: false, ok: false, note: "MindBody authentication failed — reconnect." };
  const c = args.client || {};
  const session_type_id = resolveSessionType(creds, args);
  if (!session_type_id) return { ready: true, ok: false, note: "No MindBody SessionTypeId for this service — map the service at connect time or pass session_type_id." };
  try {
    // 1) find the client by phone/email, else create
    let clientId = "";
    try {
      const search = encodeURIComponent((c.phone || c.email || "").toString());
      const cr = await fetch(`${MB}/client/clients?SearchText=${search}`, { headers: mbHeaders(env, site, token) });
      if (cr.ok) { const cj = await cr.json(); clientId = (cj.Clients && cj.Clients[0] && (cj.Clients[0].Id || cj.Clients[0].UniqueId)) || ""; }
    } catch { /* */ }
    if (!clientId) {
      const ar = await fetch(`${MB}/client/addclient`, { method: "POST", headers: mbHeaders(env, site, token), body: JSON.stringify({ FirstName: c.first || (c.name || "Guest"), LastName: c.last || ".", MobilePhone: c.phone || "", Email: c.email || "" }) });
      if (ar.ok) { const aj = await ar.json(); clientId = (aj.Client && (aj.Client.Id || aj.Client.UniqueId)) || ""; }
    }
    if (!clientId) return { ready: true, ok: false, note: "Couldn't find or create the client in MindBody." };
    // 2) create the appointment (default StaffId per site if the tenant mapped one)
    const staff_id = args.staff_id || (((creds || {}).staff || {})[site.site_id]) || undefined;
    const r = await fetch(`${MB}/appointment/addappointment`, {
      method: "POST", headers: mbHeaders(env, site, token),
      body: JSON.stringify({ ClientId: clientId, LocationId: args.location_id, SessionTypeId: session_type_id, StaffId: staff_id, StartDateTime: args.start, Notes: "Booked by Gui (Guileo)" }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ready: true, ok: false, note: "MindBody rejected the booking.", raw: d };
    return { ready: true, ok: true, site_id: site.site_id, appointment: d.Appointment || d, external_id: (d.Appointment && (d.Appointment.Id || d.Appointment.AppointmentId)) || null, note: "Booked in MindBody ✓" };
  } catch (e) { return { ready: true, ok: false, note: String(e).slice(0, 140) }; }
}

// ── HTTP handler — cockpit/admin: connect (store creds) + status/availability/book passthrough.
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

    if (!env.MINDBODY_API_KEY) return json({ ok: true, ready: false, note: "MindBody API key not set — apply for MindBody developer access, then set MINDBODY_API_KEY in Cloudflare env." });

    // ── CONNECT: store this tenant's MindBody source creds + (multi-)studio map ──
    if (action === "connect") {
      const site_id = (b.site_id || "").toString().trim();
      if (!site_id || !b.source_name || !b.source_password) return json({ error: "missing site_id / source credentials" }, 400);
      const tokens = { site_id, source_name: (b.source_name || "").toString(), source_password: (b.source_password || "").toString() };
      if (b.sites && typeof b.sites === "object") tokens.sites = b.sites;              // { "Astoria":"767008", ... }
      if (b.session_types && typeof b.session_types === "object") tokens.session_types = b.session_types;
      if (b.staff && typeof b.staff === "object") tokens.staff = b.staff;
      try {
        await rpc("store_integration", { p_secret: env.INGEST_SECRET || "", p_email: email, p_provider: "mindbody", p_tokens: tokens });
      } catch { /* store failed */ }
      // verify by issuing a token against the default site right away
      const tok = await mbToken(env, { site_id, source_name: tokens.source_name, source_password: tokens.source_password });
      return json({ ok: true, connected: !!tok, note: tok ? "MindBody connected ✓" : "Saved, but couldn't authenticate — check the site ID / source credentials." });
    }

    const creds = await tenantCreds(env, email);
    if (!creds) return json({ ok: true, ready: false, note: "This business hasn't connected MindBody yet (action:connect)." });

    if (action === "status") return json({ ok: true, ...(await mbStatus(env, creds)) });
    if (action === "availability") return json({ ok: true, ...(await mbAvailability(env, creds, b)) });
    if (action === "book") return json({ ok: true, ...(await mbBook(env, creds, b)) });

    return json({ error: "unknown action" }, 400);
  } catch (e) { return json({ error: String(e).slice(0, 140) }, 400); }
}

// ── WIRING (when live) ────────────────────────────────────────────────────────
// scheduleAdapter.js: providerStatus/getAvailability/book import { tenantCreds, mbStatus,
// mbAvailability, mbBook } from this file. For a tenant with MindBody connected & ready, the
// adapter routes availability/book here (external = source of truth) and MIRRORS the result into
// biz_appointments for the cockpit. If not connected / not ready → adapter falls back to the
// internal Guileo engine. Pass args.location (biz_location NAME) so resolveSite hits the right
// studio (Natura: Astoria 767008 vs UES 5734109), and args.service so resolveSessionType maps it.
