// functions/lib/scheduleAdapter.js
// ═════════════════════════════════════════════════════════════════════════════
// THE UNIFIED SCHEDULING BRAIN — one interface, every calendar.
//
// Luis's vision: Guileo IS the client's system AND speaks to whatever they already run.
// Given a tenant (client_email) this module discovers which external booking system the
// tenant has CONNECTED and READY (client_integrations.provider ∈ mindbody|square|vagaro|
// booksy) and ROUTES availability/book to it. If none is connected — or the external one
// falls over — it hands control back to the INTERNAL Guileo engine (biz_* in Supabase),
// which is the always-present source of truth.
//
// GOLDEN ANTI-CLASH RULE:
//   • External connected + ready → availability comes FROM the external (the salon's real
//     truth) and the booking is WRITTEN into the external, then MIRRORED into biz_appointments
//     so the cockpit has the record.
//   • No external (or the external is DOWN) → the INTERNAL engine is the source of truth.
//   • We NEVER book internally "on top of" a connected external without checking the external
//     first (= double-booking). That is why a *reachable* external that returns "no slots" or
//     "rejected" is treated as the TRUTH (handled) — only an UNREACHABLE/not-ready/unmappable
//     external falls through to internal.
//
// HONEST + INERT: a connector with no credential / no platform env key = not ready → the
// adapter resolves to 'internal' and nothing breaks. Zero regression for the Natura-style
// tenant that has no external connected: resolveScheduler → 'internal', and agent-schedule.js
// runs its existing internal path byte-for-byte.
//
// HOW IT TALKS TO THE CONNECTORS: the per-provider connectors (functions/api/mindbody.js,
// square-appointments.js, booksy.js) only export an HTTP handler today (they gate on the
// tenant's connection key via get_client_data). Rather than duplicate their token/auth logic,
// the adapter calls them SAME-ORIGIN and supplies the tenant's connection key, which it fetches
// server-side via the INGEST-gated `client_key_for` RPC (same one stripe-webhook.js uses). This
// keeps each connector the single source of truth for its provider.
//   → If a connector owner later exports pure functions (mbAvailability/mbBook/…), swap the
//     fetch calls for direct imports; the interface here does not change.
// ═════════════════════════════════════════════════════════════════════════════

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const norm = (s) => (s || "").toString().trim().toLowerCase();

async function sbRpc(fn, body) {
  const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r;
}

// INGEST-gated read of a tenant's stored provider credentials (client_integrations.tokens).
// Returns the tokens object (or null). Never throws.
async function credsLookup(fn, env, email) {
  try {
    const r = await sbRpc(fn, { p_secret: env.INGEST_SECRET || "", p_email: email });
    if (!r.ok) return null;
    const t = await r.json().catch(() => null);
    return t && typeof t === "object" ? t : null;
  } catch { return null; }
}

// Fetch the tenant's own connection key server-side (INGEST-gated). The connectors gate on
// email + this key (get_client_data). Best-effort: "" if unavailable → external path is skipped
// and we fall back to internal (honest — we won't call a connector we can't authenticate to).
async function tenantKey(env, email) {
  try {
    const r = await sbRpc("client_key_for", { p_secret: env.INGEST_SECRET || "", p_email: email });
    if (!r.ok) return "";
    return ((await r.json()) || "").toString();
  } catch { return ""; }
}

// ── resolveScheduler ─────────────────────────────────────────────────────────
// The routing decision. Consults each connected provider (INGEST-gated creds lookup) plus the
// platform-level requirement (env key) and returns the WINNER by fixed priority:
//   mindbody > square > vagaro > booksy > internal
// "ready" means: creds present AND everything needed to actually reach the provider is in place.
// A provider whose creds are stored but which can't be reached (no platform API key, no public
// API) is NOT ready → we keep walking down to 'internal'.
//
// Returns: { provider, ready, creds, reason }
export async function resolveScheduler(env, email) {
  const e = norm(email);
  if (!e || !e.includes("@")) return { provider: "internal", ready: true, creds: null, reason: "no-tenant" };

  // 1) MINDBODY — needs the platform developer key (MINDBODY_API_KEY) + per-tenant site creds.
  //    No platform key → the connector is inert → NOT the source of truth (Natura falls through
  //    here today: creds may be stored, but without MINDBODY_API_KEY we route to internal).
  if (env.MINDBODY_API_KEY) {
    const c = await credsLookup("mb_creds_lookup", env, e);
    if (c && c.site_id) return { provider: "mindbody", ready: true, creds: c, reason: "mindbody-connected" };
  }

  // 2) SQUARE — fully public: per-tenant access_token + location_id is all it takes (no platform key).
  {
    const c = await credsLookup("square_creds_lookup", env, e);
    if (c && c.access_token && c.location_id) return { provider: "square", ready: true, creds: c, reason: "square-connected" };
  }

  // 3) VAGARO — no connector exists yet (no public partner API wired). Reserved slot in the
  //    priority ladder; resolves as not-ready so it never blocks internal. Honest: not built.

  // 4) BOOKSY — creds may be stored, but Booksy has NO public API → never ready (booksy.js is
  //    an honest inert scaffold). We do NOT route here; the internal engine captures the booking.

  // 5) INTERNAL — the always-present Guileo engine (biz_*). Source of truth when nothing external
  //    is connected+ready. This is the zero-regression default.
  return { provider: "internal", ready: true, creds: null, reason: "no-external-ready" };
}

// Resolve a spoken service name → the provider's own service id, using a name→id map the tenant
// stored at connect time in client_integrations.tokens.service_map (honest: no map / no match →
// null → the caller falls back to the internal engine rather than GUESSING an external id).
function mapServiceId(creds, serviceName) {
  // accept every shape a connector stores the name→id map under: service_map (adapter contract),
  // session_types (MindBody's own connect shape), services (Square). Blocker fix: the connectors
  // and the adapter disagreed on the key, so the map was always null → every external booking
  // silently fell through to a BLIND internal booking (double-book). Read all three.
  const map = creds && typeof creds === "object"
    ? (creds.service_map || creds.session_types || creds.services || null)
    : null;
  if (!map || typeof map !== "object") return null;
  const n = norm(serviceName);
  for (const k of Object.keys(map)) {
    if (norm(k) === n || norm(k).includes(n) || n.includes(norm(k))) return map[k];
  }
  return null;
}

// POST to a same-origin connector endpoint with the tenant's connection key. Returns parsed JSON
// or null on any transport error (→ the caller treats null as "external down" → internal fallback).
async function callConnector(origin, path, key, email, payload) {
  try {
    const r = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token: key, ...payload }),
    });
    return await r.json().catch(() => null);
  } catch { return null; }
}

// ── getAvailability ──────────────────────────────────────────────────────────
// args: { origin, service, location_id, professional_id, start, end }
// Returns:
//   { handled:true, slots:[{start, pro, location}] }   external is the truth (even if empty)
//   { handled:false, reason }                            external down/not-ready/unmappable → internal
export async function getAvailability(env, email, resolved, args) {
  const r = resolved || (await resolveScheduler(env, email));
  if (r.provider === "internal" || !r.ready) return { handled: false, reason: r.reason || "internal" };
  const key = await tenantKey(env, email);
  if (!key) return { handled: false, reason: "no-tenant-key" };
  const origin = args.origin;
  const start = args.start || new Date().toISOString();
  const end = args.end || new Date(Date.now() + 14 * 864e5).toISOString();

  if (r.provider === "mindbody") {
    const sid = mapServiceId(r.creds, args.service);
    if (!sid) return { handled: false, reason: "no-service-map" };
    const d = await callConnector(origin, "/api/mindbody", key, email, {
      action: "availability", session_type_id: sid, location_id: args.location_id || undefined,
      staff_id: args.professional_id || undefined, start, end,
    });
    if (!d || d.ready === false || d.ok === false) return { handled: false, reason: "mindbody-down" };
    const slots = (d.availabilities || []).map((a) => ({
      start: a.StartDateTime || a.startDateTime || a.start, pro: a.StaffName || a.staff || "", location: a.LocationName || "",
      pro_id: a.StaffId || a.staffId || null, location_id: a.LocationId || null,
    })).filter((s) => s.start);
    return { handled: true, slots };
  }

  if (r.provider === "square") {
    const sid = mapServiceId(r.creds, args.service);
    if (!sid) return { handled: false, reason: "no-service-map" };
    const d = await callConnector(origin, "/api/square-appointments", key, email, {
      action: "availability", service_variation_id: sid, team_member_id: args.professional_id || undefined, start, end,
    });
    if (!d || d.ready === false || d.ok === false) return { handled: false, reason: "square-down" };
    const slots = (d.availabilities || []).map((a) => {
      const seg = (a.appointment_segments || [])[0] || {};
      return { start: a.start_at, pro: seg.team_member_id || "", location: a.location_id || "", pro_id: seg.team_member_id || null, location_id: a.location_id || null };
    }).filter((s) => s.start);
    return { handled: true, slots };
  }

  return { handled: false, reason: "unrouted" };
}

// ── book ─────────────────────────────────────────────────────────────────────
// args: { origin, service, service_name, location_id, professional_id, start, name, contact,
//         duration_min, attributes, mirror:{ pro, location } }
// Returns:
//   { handled:true,  ok:true,  external_ref, raw }   booked externally + mirrored → success
//   { handled:true,  ok:false, reason, raw }         external REJECTED (e.g. slot taken) — do NOT
//                                                    book internally (would double-book)
//   { handled:false, reason }                        external down/not-ready/unmappable → internal
export async function book(env, email, resolved, args) {
  const r = resolved || (await resolveScheduler(env, email));
  if (r.provider === "internal" || !r.ready) return { handled: false, reason: r.reason || "internal" };
  const key = await tenantKey(env, email);
  if (!key) return { handled: false, reason: "no-tenant-key" };
  const origin = args.origin;
  const [first, ...rest] = (args.name || "Guest").toString().trim().split(/\s+/);
  const client = { first: first || "Guest", last: rest.join(" ") || ".", name: args.name || "", phone: /^[0-9+]/.test((args.contact || "")) ? args.contact : "", email: /.+@.+\..+/.test(args.contact || "") ? args.contact : "" };

  if (r.provider === "mindbody") {
    const sid = mapServiceId(r.creds, args.service);
    // FAIL-SAFE: external is the truth. If we can't map the service or reach it, NEVER book internally
    // on top of a calendar we can't see — capture and let the front desk confirm (no double-book).
    if (!sid) return { handled: true, ok: false, needsFrontdesk: true, reason: "no-service-map" };
    const d = await callConnector(origin, "/api/mindbody", key, email, {
      action: "book", client, session_type_id: sid, staff_id: args.professional_id || undefined,
      location_id: args.location_id || undefined, start: args.start,
    });
    if (!d || d.ready === false) return { handled: true, ok: false, needsFrontdesk: true, reason: "mindbody-down" };
    if (d.ok !== true) return { handled: true, ok: false, reason: d.note || "mindbody-rejected", raw: d };
    const ref = (d.appointment && (d.appointment.Id || d.appointment.AppointmentId)) || null;
    await mirrorExternalBooking(env, email, "mindbody", { external_ref: ref, service: args.service, start: args.start, duration_min: args.duration_min, name: args.name, contact: args.contact, location_id: args.location_id, pro: args.mirror?.pro, location: args.mirror?.location });
    return { handled: true, ok: true, external_ref: ref, raw: d };
  }

  if (r.provider === "square") {
    const sid = mapServiceId(r.creds, args.service);
    if (!sid) return { handled: true, ok: false, needsFrontdesk: true, reason: "no-service-map" };
    const d = await callConnector(origin, "/api/square-appointments", key, email, {
      action: "book", client, service_variation_id: sid, team_member_id: args.professional_id || undefined,
      duration_minutes: args.duration_min || undefined, start: args.start,
    });
    if (!d || d.ready === false) return { handled: true, ok: false, needsFrontdesk: true, reason: "square-down" };
    if (d.ok !== true) return { handled: true, ok: false, reason: d.note || "square-rejected", raw: d };
    const ref = (d.booking && d.booking.id) || null;
    await mirrorExternalBooking(env, email, "square", { external_ref: ref, service: args.service, start: args.start, duration_min: args.duration_min, name: args.name, contact: args.contact, location_id: args.location_id, pro: args.mirror?.pro, location: args.mirror?.location });
    return { handled: true, ok: true, external_ref: ref, raw: d };
  }

  return { handled: false, reason: "unrouted" };
}

// ── mirrorExternalBooking ──────────────────────────────────────────────────────
// After a successful EXTERNAL booking, drop a record into biz_appointments so the cockpit /portal
// shows it. SCHED-gated RPC `biz_mirror_external` (described in db/schedule_adapter.sql — a small
// INSERT with pro_id NULL to sidestep the internal EXCLUDE constraint, source=<provider>, idempotent
// on the external ref). BEST-EFFORT + graceful: if the RPC isn't pasted yet (PGRST202) it silently
// no-ops — the external booking already succeeded; the mirror is a bonus, never a blocker.
export async function mirrorExternalBooking(env, email, provider, data) {
  try {
    const startMs = Date.parse(data.start);
    const endIso = isFinite(startMs) ? new Date(startMs + (data.duration_min || 60) * 60000).toISOString() : null;
    await sbRpc("biz_mirror_external", {
      p_secret: env.SCHED_SECRET || "", p_email: email, p_provider: provider,
      p_external_ref: (data.external_ref || "").toString().slice(0, 200),
      p_service: (data.service || "").toString(), p_start: data.start, p_end: endIso,
      p_name: (data.name || "").toString(), p_contact: (data.contact || "").toString(),
      p_location_id: data.location_id || null,
      p_attributes: { pro: data.pro || "", location: data.location || "", origin: provider },
    });
  } catch { /* mirror is best-effort — the external booking already stands */ }
}
