// ───────────────────────────────────────────────────────────────────────────
// Guileo Growth Cockpit — central data / service layer.
//
// THE ONLY PLACE TO "CONNECT THE BACKEND".
// Today it runs in DEMO mode (mock data + simulated latency), but every screen
// already calls through this layer. To go live, set these in Cloudflare env:
//     VITE_SUPABASE_URL        = https://xxxx.supabase.co
//     VITE_SUPABASE_ANON_KEY   = eyJhbGci...
// …then implement the `// CONNECT:` branches below. No screen changes needed.
// ───────────────────────────────────────────────────────────────────────────

import { supabase, hasSupabase } from "./supabase.js";

/** True once real backend keys are present. UI shows "Demo" until then. */
export const CONNECTED = hasSupabase;

const wait = (ms = 320) => new Promise((r) => setTimeout(r, ms));
const SESSION_KEY = "guileo_portal_session";

// ── Background sync to Supabase (NO TABLE / NO SQL needed) ──
// localStorage stays the synchronous source of truth (instant UI); the account's
// config state is mirrored into the user's own Supabase record (user_metadata.kv),
// so it persists across devices. Bulky demo feeds (created:* lists) are NOT synced,
// keeping the blob small. Writes are debounced.
let _uid = null;                       // current auth user id (set on hydrate)
let _cloud = {};                       // full key→value blob mirrored to the cloud
let _flushTimer = null;
const _syncable = (key) => !key.includes(":created:");   // skip bulky demo records
function _queueUpsert(key, value) {
  if (!supabase || !_uid || !_syncable(key)) return;
  _cloud[key] = value;
  if (_flushTimer) return;
  _flushTimer = setTimeout(_flush, 900);
}
let _warnedSync = false;
async function _flush() {
  _flushTimer = null;
  if (!supabase || !_uid) return;
  try { await supabase.auth.updateUser({ data: { kv: _cloud } }); _warnedSync = false; }
  catch { if (!_warnedSync) { _warnedSync = true; toast("Saved locally — couldn't sync to the cloud just now. I'll retry."); } }
}
// Best-effort durability: if the tab closes within the 900ms debounce window, fire the
// pending cloud sync immediately so a just-made change isn't lost (localStorage is already
// written synchronously by saveState — this only rescues the cloud mirror).
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => { if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; _flush(); } });
}

// ── REAL CLIENT DATA — the gui_actions Supabase project (separate from the auth
// project above). URL + anon key are PUBLIC by design (already shipped in /admin
// and /live); the access key in the RPC is what gates each client's data. ──
const DATA_SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const DATA_SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const DATA_KEY_LS = "guileo_data_key";

/** Fetch the logged-in client's REAL data (credits, plan, events) from the backend.
 *  Returns { credits, plan, events:[{id,created_at,type,channel,summary,amount}] }
 *  or null on ANY failure (wrong key, network, malformed) — never throws to the UI. */
export async function fetchRealData(email, key) {
  if (!email || !key) return null;
  try {
    const r = await fetch(`${DATA_SB_URL}/rest/v1/rpc/get_client_data`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: DATA_SB_ANON, Authorization: `Bearer ${DATA_SB_ANON}` },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!r.ok) return null; // includes 'unauthorized' (400/28000) when the key doesn't match
    const data = await r.json();
    if (!data || typeof data !== "object" || !Array.isArray(data.events)) return null;
    return data;
  } catch { return null; }
}

// ── REAL INBOX (client_messages) — four RPCs on the same gui_actions data project,
// gated by the same email+key validator as fetchRealData. All are best-effort: they
// return [] / null on ANY failure (bad key 403/28000, network, malformed) and NEVER
// throw to the UI, so the Inbox can always fall back to the honest empty state. ──
async function _dataRpc(name, body) {
  try {
    const r = await fetch(`${DATA_SB_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: DATA_SB_ANON, Authorization: `Bearer ${DATA_SB_ANON}` },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null; // includes 403 / code 28000 when the key doesn't match
    return await r.json();
  } catch { return null; }
}

// ── Read cache: TTL + in-flight dedupe + stale-while-revalidate ──────────────
// Read-only fetchers below route through _cached(). Same (fn,email,key[,extra])
// within 45s serves the memoized value; concurrent callers share one in-flight
// request (dedupe); a stale entry is returned immediately while it refreshes in
// the background (SWR). Mutations NEVER cache and call _invalidate(domain) to
// drop the memo for their domain so the next read re-fetches fresh.
const _CACHE_TTL = 45000;
const _cache = new Map();     // key -> { at, value }
const _inflight = new Map();  // key -> Promise
// Which domain each cached fetcher belongs to (for targeted invalidation).
const _DOMAIN = {
  fetchConversations: "inbox", fetchThread: "inbox", fetchCallLogs: "inbox",
  fetchCRM: "crm", fetchLeadsToday: "crm", fetchCrmInvoices: "crm", fetchCrmCampaigns: "crm",
  fetchCrmDeals: "crm", fetchCrmTimeline: "crm", fetchMarketingDates: "crm", fetchContracts: "crm",
  fetchNoshowRadar: "noshow", fetchAppointments: "noshow",
};
const _ck = (fn, email, key, extra) => `${fn}|${email || ""}|${key || ""}${extra != null ? "|" + extra : ""}`;

function _cached(fn, email, key, loader, extra) {
  const k = _ck(fn, email, key, extra);
  const hit = _cache.get(k);
  if (hit && Date.now() - hit.at < _CACHE_TTL) return Promise.resolve(hit.value); // fresh
  const infl = _inflight.get(k);
  if (infl) return infl;                                                          // dedupe
  const p = Promise.resolve()
    .then(loader)
    .then((v) => { _cache.set(k, { at: Date.now(), value: v }); _inflight.delete(k); return v; })
    .catch((e) => { _inflight.delete(k); if (hit) return hit.value; throw e; });  // SWR on failure
  _inflight.set(k, p);
  if (hit) return Promise.resolve(hit.value);  // SWR: serve stale now, refresh in background
  return p;
}

function _invalidate(domain) {
  for (const k of [..._cache.keys()]) if (_DOMAIN[k.split("|")[0]] === domain) _cache.delete(k);
  for (const k of [..._inflight.keys()]) if (_DOMAIN[k.split("|")[0]] === domain) _inflight.delete(k);
}

/** All conversation threads for this client → [{channel, contact, last, last_at, unread}] (or []). */
export async function fetchConversations(email, key) {
  if (!email || !key) return [];
  return _cached("fetchConversations", email, key, async () => {
    const data = await _dataRpc("client_conversations", { p_email: email, p_key: key });
    return Array.isArray(data) ? data : [];
  });
}

/** One thread's messages oldest→newest → [{direction, body, created_at}] (or []). */
export async function fetchThread(email, key, channel, contact) {
  if (!email || !key) return [];
  return _cached("fetchThread", email, key, async () => {
    const data = await _dataRpc("client_thread", { p_email: email, p_key: key, p_channel: channel, p_contact: contact });
    return Array.isArray(data) ? data : [];
  }, `${channel}|${contact}`);
}

/** Insert an outbound message → {ok:true} (or null on failure). */
export async function sendRealMessage(email, key, channel, contact, body) {
  if (!email || !key) return null;
  const r = await _dataRpc("client_send_message", { p_email: email, p_key: key, p_channel: channel, p_contact: contact, p_body: body });
  _invalidate("inbox"); // a sent message changes threads/unread → drop stale reads
  return r;
}

/** Mark a thread's inbound messages read → {ok:true} (or null). Best-effort. */
export async function markThreadRead(email, key, channel, contact) {
  if (!email || !key) return null;
  const r = await _dataRpc("client_mark_read", { p_email: email, p_key: key, p_channel: channel, p_contact: contact });
  _invalidate("inbox"); // unread counts changed
  return r;
}

/** Real calls WITH per-call analysis + full transcript → [{id,created_at,summary,sentiment,
 *  intent,note,duration_secs,success,end_reason,amount,transcript}] (or []). Best-effort:
 *  goes through our own /api/call-logs (validates the key, reads the owned project). */
export async function fetchCallLogs(email, key) {
  if (!email || !key) return [];
  return _cached("fetchCallLogs", email, key, async () => {
    try {
      const r = await fetch("/api/call-logs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, key }),
      });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d?.calls) ? d.calls : [];
    } catch { return []; }
  });
}

/** The business's REAL upcoming appointments (booked by Gui) → [{id,when,ends,customer,contact,
 *  service,pro,location,status,ref}] (or []). Best-effort via /api/appointments. */
export async function fetchAppointments(email, key) {
  if (!email || !key) return [];
  return _cached("fetchAppointments", email, key, async () => {
    try {
      const r = await fetch("/api/appointments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, key }),
      });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d?.appointments) ? d.appointments : [];
    } catch { return []; }
  });
}

/** Unified CRM contact spine (the 360° book). POST {token,email} -> {ready,count,contacts}.
 *  Gracefully returns ready:false until db/crm_spine.sql is pasted in Supabase. */
export async function fetchCRM(key, email) {
  if (!key) return { ready: false, count: 0, contacts: [], note: "" };
  return _cached("fetchCRM", email, key, async () => {
    try {
      const r = await fetch("/api/crm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: key, email: email || "" }),
      });
      if (!r.ok) return { ready: false, count: 0, contacts: [], note: "" };
      const d = await r.json();
      return {
        ready: !!d?.ready,
        count: Number(d?.count) || 0,
        contacts: Array.isArray(d?.contacts) ? d.contacts : [],
        note: d?.note || "",
      };
    } catch { return { ready: false, count: 0, contacts: [], note: "" }; }
  });
}

/** Today's NEW leads (crm_leads_today) grouped-ready → {ready,count,leads:[{id,name,phone,
 *  channel,source,created_at,status}]}. Gracefully returns ready:false until the RPC is pasted. */
export async function fetchLeadsToday(key, email) {
  if (!key) return { ready: false, count: 0, leads: [], note: "" };
  return _cached("fetchLeadsToday", email, key, async () => {
    try {
      const r = await fetch("/api/crm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leads_today", token: key, email: email || "" }),
      });
      if (!r.ok) return { ready: false, count: 0, leads: [], note: "" };
      const d = await r.json();
      return {
        ready: !!d?.ready,
        count: Number(d?.count) || 0,
        leads: Array.isArray(d?.leads) ? d.leads : [],
        note: d?.note || "",
      };
    } catch { return { ready: false, count: 0, leads: [], note: "" }; }
  });
}

/** 📞 Ask Gui to call a lead back (crm_lead_callback → logs a client_event 'callback', the same
 *  callback path the funnel uses). Returns {ok} — best-effort, never throws to the UI. */
export async function requestGuiCallback(key, email, lead = {}) {
  if (!key) return { ok: false };
  try {
    const r = await fetch("/api/crm", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lead_callback", token: key, email: email || "", lead_id: lead.id || "", phone: lead.phone || "", name: lead.name || "" }),
    });
    if (!r.ok) return { ok: false };
    const d = await r.json();
    _invalidate("crm"); // callback logs a client_event → lead lists may change
    return { ok: !!d?.ok };
  } catch { return { ok: false }; }
}

/** Marketing dates & birthday config (marketing_dates_list) → {ready,dates:[{id,kind,label,
 *  month,day,message,offer,active}],note}. Birthday config is the row with kind:'birthday'.
 *  Gracefully returns ready:false until db marketing_dates SQL is pasted. */
export async function fetchMarketingDates(key, email) {
  if (!key) return { ready: false, dates: [], note: "" };
  return _cached("fetchMarketingDates", email, key, async () => {
    try {
      const r = await fetch("/api/crm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "marketing_dates", token: key, email: email || "" }),
      });
      if (!r.ok) return { ready: false, dates: [], note: "" };
      const d = await r.json();
      return { ready: !!d?.ready, dates: Array.isArray(d?.dates) ? d.dates : [], note: d?.note || "" };
    } catch { return { ready: false, dates: [], note: "" }; }
  });
}

/** Add / edit a marketing date or birthday config (marketing_dates_set). Pass {id?,kind,label,
 *  month,day,message,offer,active}. Returns {ok,ready,date,note} — best-effort. */
export async function saveMarketingDate(key, email, date = {}) {
  if (!key) return { ok: false, ready: false };
  try {
    const r = await fetch("/api/crm", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "marketing_date_set", token: key, email: email || "", date }),
    });
    if (!r.ok) return { ok: false, ready: false };
    const d = await r.json();
    _invalidate("crm"); // marketing dates changed
    return { ok: !!d?.ok, ready: d?.ready !== false, date: d?.date || null, note: d?.note || "" };
  } catch { return { ok: false, ready: false }; }
}

/** Remove a commemorative date (marketing_dates_delete). Returns {ok} — best-effort. */
export async function deleteMarketingDate(key, email, id) {
  if (!key || !id) return { ok: false };
  try {
    const r = await fetch("/api/crm", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "marketing_date_delete", token: key, email: email || "", id }),
    });
    if (!r.ok) return { ok: false };
    const d = await r.json();
    _invalidate("crm"); // a marketing date was removed
    return { ok: !!d?.ok };
  } catch { return { ok: false }; }
}

/** Contracts & quotes for the tenant (contract_list). Returns [] gracefully. */
export async function fetchContracts(key, email) {
  if (!key) return [];
  return _cached("fetchContracts", email, key, async () => {
    try {
      const r = await fetch("/api/contract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list", token: key, email: email || "" }) });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d?.docs) ? d.docs : [];
    } catch { return []; }
  });
}

/** Finance A/R — invoices (crm_invoices_list). Returns [] gracefully. */
export async function fetchCrmInvoices(key, email) {
  if (!key) return [];
  return _cached("fetchCrmInvoices", email, key, async () => {
    try {
      const r = await fetch("/api/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "invoices", token: key, email: email || "" }) });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d?.invoices) ? d.invoices : [];
    } catch { return []; }
  });
}

/** Marketing — campaigns (crm_campaigns_list). Returns [] gracefully. */
export async function fetchCrmCampaigns(key, email) {
  if (!key) return [];
  return _cached("fetchCrmCampaigns", email, key, async () => {
    try {
      const r = await fetch("/api/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "campaigns", token: key, email: email || "" }) });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d?.campaigns) ? d.campaigns : [];
    } catch { return []; }
  });
}

/** Upcoming appointments ranked by no-show risk (noshow_risk RPC). Returns {ready,highRisk,appointments}. */
export async function fetchNoshowRadar(key, email, days = 7) {
  if (!key) return { ready: false, highRisk: 0, appointments: [] };
  return _cached("fetchNoshowRadar", email, key, async () => {
    try {
      const r = await fetch("/api/noshow-radar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: key, email: email || "", days }),
      });
      if (!r.ok) return { ready: false, highRisk: 0, appointments: [] };
      const d = await r.json();
      return { ready: !!d?.ready, highRisk: Number(d?.highRisk) || 0, appointments: Array.isArray(d?.appointments) ? d.appointments : [] };
    } catch { return { ready: false, highRisk: 0, appointments: [] }; }
  }, days);
}

/** 👻 Mark an appointment as a no-show (feeds the risk model). Returns {ok,marked} — never throws. */
export async function markNoshow(key, email, appointmentId) {
  if (!key || !appointmentId) return { ok: false, marked: false };
  try {
    const r = await fetch("/api/noshow-radar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: key, email: email || "", action: "mark_noshow", appointment_id: appointmentId }),
    });
    if (!r.ok) return { ok: false, marked: false };
    const d = await r.json();
    _invalidate("noshow"); // radar/appointments changed
    return { ok: !!d?.ok, marked: !!d?.marked };
  } catch { return { ok: false, marked: false }; }
}

/** ✅ Log an extra-confirmation nudge (client_event 'confirm-nudge' → shows in the feed). Best-effort. */
export async function confirmNudge(key, email, appointmentId, name) {
  if (!key) return { ok: false };
  try {
    const r = await fetch("/api/noshow-radar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: key, email: email || "", action: "confirm", appointment_id: appointmentId || "", name: name || "" }),
    });
    if (!r.ok) return { ok: false };
    const d = await r.json();
    _invalidate("noshow"); // a confirm-nudge event was logged
    return { ok: !!d?.ok };
  } catch { return { ok: false }; }
}

/** The tenant's sales pipeline (crm_deals via crm_deals_list). Returns [] gracefully. */
export async function fetchCrmDeals(key, email) {
  if (!key) return [];
  return _cached("fetchCrmDeals", email, key, async () => {
    try {
      const r = await fetch("/api/crm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deals", token: key, email: email || "" }),
      });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d?.deals) ? d.deals : [];
    } catch { return []; }
  });
}

/** A single contact's 360° timeline (crm_timeline_events). Returns [] gracefully. */
export async function fetchCrmTimeline(key, email, contactId) {
  if (!key || !contactId) return [];
  return _cached("fetchCrmTimeline", email, key, async () => {
    try {
      const r = await fetch("/api/crm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "timeline", token: key, email: email || "", contact_id: contactId }),
      });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d?.events) ? d.events : [];
    } catch { return []; }
  }, contactId);
}

/** The client's "connection code" (access key Luis hands out at onboarding). */
export function loadDataKey() {
  try {
    const raw = localStorage.getItem(DATA_KEY_LS);
    if (!raw) return "";
    return raw.startsWith('"') ? JSON.parse(raw) : raw; // tolerate the JSON form the cloud hydrate writes
  } catch { return ""; }
}

export function saveDataKey(key) {
  const v = (key || "").trim();
  try { v ? localStorage.setItem(DATA_KEY_LS, v) : localStorage.removeItem(DATA_KEY_LS); } catch { /* private mode */ }
  _queueUpsert(DATA_KEY_LS, v); // mirror into the same cloud-kv blob Settings fields use
  return { ok: true };
}

// ── Tiny toast bus (action feedback across every screen) ──
let _toastListeners = [];
export const toast = (text) => _toastListeners.forEach((l) => l(text));
export const onToast = (fn) => { _toastListeners.push(fn); return () => { _toastListeners = _toastListeners.filter((x) => x !== fn); }; };

export const portalApi = {
  connected: CONNECTED,

  /** Current session (or null). */
  async session() {
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const s = data?.session;
      return s ? { email: s.user.email, name: s.user.user_metadata?.name || s.user.email, role: "Owner", demo: false, at: Date.now(), uid: s.user.id } : null;
    }
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
  },

  /** Sign in with email + password. Real backend = Supabase auth. Demo = any creds. */
  async login(email, password) {
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      if (data?.session) { await this.hydrate(); return { ok: true, uid: data.user.id }; }
      return { error: "Sign-in failed" };
    }
    await wait();
    const sess = { email: email || "demo@guileoai.com", name: "Jane Staff", role: "Staff", demo: true, at: Date.now() };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(sess)); } catch { /* private mode */ }
    return { ok: true, demo: true };
  },

  /** Create an account. If the project requires email confirmation, returns {confirm:true}. */
  async signUp(email, password) {
    if (!supabase) return this.login(email, password);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (data?.session) { await this.hydrate(); return { ok: true, uid: data.user.id }; } // confirmation disabled → instant
    return { confirm: true, email }; // confirmation email sent
  },

  async logout() {
    if (supabase) { try { await supabase.auth.signOut(); } catch { /* */ } }
    _uid = null;
    _cloud = {};                       // drop the cloud mirror so the next user doesn't inherit it
    if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
    try { localStorage.removeItem(SESSION_KEY); } catch { /* private mode */ }
    return true;
  },

  /** Clear a set of state keys from BOTH localStorage and the cloud mirror, then push the
   *  cleared blob — so reset/wipe is durable and deleted data doesn't resurrect on next sync. */
  clearKeys(stateKeys = []) {
    stateKeys.forEach((k) => {
      const full = `guileo_state_${k}`;
      try { localStorage.removeItem(full); } catch { /* */ }
      delete _cloud[full];
    });
    if (supabase && _uid) _flush();    // push the now-smaller blob to the cloud
    return { ok: true };
  },

  /** Pull this user's saved state from Supabase into localStorage (one-time, on sign-in),
   *  so the synchronous loadState() reads work instantly afterward. Returns row count. */
  async hydrate() {
    if (!supabase) return 0;
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return 0;
    _uid = u.user.id;
    const kv = u.user.user_metadata?.kv || {};
    _cloud = { ...kv };
    Object.entries(kv).forEach(([k, v]) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } });
    // Ensure a real `clients` row exists/updates on every sign-in, using whatever
    // profile facts we already know from user_metadata. Fully graceful (table may not exist yet).
    try {
      const md = u.user.user_metadata || {};
      const partial = {};
      if (md.name) partial.name = md.name;
      if (md.business) partial.business = md.business;
      if (md.sector) partial.sector = md.sector;
      if (md.contact) partial.contact = md.contact;
      // Fire-and-forget: don't block sign-in hydrate on the clients upsert (runs in the
      // browser, not the Worker; a failure is already swallowed). Frees the UI sooner.
      this.saveClient(partial).catch(() => { /* never throw from hydrate */ });
    } catch { /* never throw from hydrate */ }
    return Object.keys(kv).length;
  },

  /** Upsert the current user's row into the `clients` table on the AUTH project.
   *  Silent no-op if there's no client/session or the table doesn't exist yet. */
  async saveClient(partial = {}) {
    try {
      if (!supabase) return { ok: false };
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) return { ok: false };
      const row = { uid: user.id, email: user.email, ...partial };
      await supabase.from("clients").upsert(row, { onConflict: "uid" });
      return { ok: true };
    } catch { return { ok: false }; }
  },

  /** Subscribe to auth changes; hydrates on sign-in, then calls cb(session|null). */
  onAuthChange(cb) {
    if (!supabase) return () => {};
    const { data } = supabase.auth.onAuthStateChange(async (_evt, sess) => {
      if (sess?.user) { await this.hydrate(); }
      else { _uid = null; }
      cb?.(sess ? { email: sess.user.email, uid: sess.user.id } : null);
    });
    return () => data?.subscription?.unsubscribe();
  },

  // ── Data reads/writes route through here too (mock now, real later) ──
  // Each screen passes the demo data it already has; when CONNECTED we ignore
  // the fallback and query Supabase instead. Keeping the same shape = zero UI churn.

  // HONESTY NOTE — there is NO real messages/conversations/alerts table or RPC in the
  // client-data backend (it only exposes the read-only `get_client_data` events ledger via
  // fetchRealData). So for a CONNECTED (real) client we must NOT fabricate records: list()
  // returns empty and the write methods return a soft success without inventing rows. The
  // live screens already source their content from the real `events` ledger and render an
  // honest empty state. In DEMO mode (not connected) we keep returning the mock so the demo
  // still looks alive. The day a real inbox table/RPC lands, wire the CONNECTED branch here.

  async list(table, fallback = []) {
    if (CONNECTED) return []; // honest: no real inbox/conversations backend yet — don't fake it
    await wait(200);          // demo-only: simulated latency keeps the mock feeling alive
    return fallback;
  },

  async sendMessage(channel, conversationId, text) {
    if (CONNECTED) return { ok: true, persisted: false }; // soft success — nothing fabricated/stored
    await wait(150);          // demo-only
    return { ok: true, id: Date.now(), text, at: Date.now() };
  },

  async updateStatus(table, id, status) {
    if (CONNECTED) return { ok: true, persisted: false }; // soft success — no real status store yet
    await wait(120);          // demo-only
    return { ok: true, id, status };
  },

  async resolveAlert(id) {
    if (CONNECTED) return { ok: true, persisted: false }; // soft success — no real alerts store yet
    await wait(120);          // demo-only
    return { ok: true, id };
  },

  // ── AI knowledge base (what the client trains their AI on) ──
  // Persists per-vertical. Demo = localStorage; live = a `kb_entries` table
  // keyed by tenant + vertical. The "Test your AI" sandbox reads from here so
  // training has an immediate, visible effect.
  loadKB(vertical, seed = []) {
    // CONNECT: const { data } = await supabase.from("kb_entries").select("*").eq("vertical", vertical); return data?.length ? data : seed;
    try {
      const raw = localStorage.getItem(`guileo_kb_${vertical}`);
      if (raw) return JSON.parse(raw);
    } catch { /* private mode */ }
    return seed;
  },

  saveKB(vertical, entries) {
    try { localStorage.setItem(`guileo_kb_${vertical}`, JSON.stringify(entries)); } catch { /* private mode */ }
    _queueUpsert(`guileo_kb_${vertical}`, entries);
    return { ok: true, count: entries.length };
  },

  // ── Business profile (name / address / hours / phone) ──
  // Single source of truth for the facts the AI repeats most. Editing it in
  // Settings re-syncs the AI's "location" & "hours" answers (see syncProfileIntoKB).
  loadProfile(vertical, seed = {}) {
    // CONNECT: const { data } = await supabase.from("business_profile").select("*").eq("vertical", vertical).single(); return data || seed;
    try {
      const raw = localStorage.getItem(`guileo_profile_${vertical}`);
      if (raw) return { ...seed, ...JSON.parse(raw) };
    } catch { /* private mode */ }
    return seed;
  },

  saveProfile(vertical, profile) {
    try { localStorage.setItem(`guileo_profile_${vertical}`, JSON.stringify(profile)); } catch { /* private mode */ }
    _queueUpsert(`guileo_profile_${vertical}`, profile);
    return { ok: true };
  },

  // ── Durable UI state (resolved alerts, won deals, filled slots, read flags) ──
  // This is what makes the demo behave like a real connected app: an operator's
  // actions persist across reloads instead of dying with component state.
  // Keyed by an arbitrary scope string (e.g. "Restaurant:alerts"). Live backend
  // would store these as per-tenant rows; the seam stays identical.
  loadState(key, fallback) {
    // CONNECT: read from a `ui_state` table by (tenant, key)
    try {
      const raw = localStorage.getItem(`guileo_state_${key}`);
      if (raw != null) return JSON.parse(raw);
    } catch { /* private mode */ }
    return fallback;
  },

  saveState(key, value) {
    try { localStorage.setItem(`guileo_state_${key}`, JSON.stringify(value)); } catch { /* private mode */ }
    _queueUpsert(`guileo_state_${key}`, value);
    return { ok: true };
  },
};
