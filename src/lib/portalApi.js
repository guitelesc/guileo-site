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
      await this.saveClient(partial);
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

  async list(table, fallback = []) {
    // CONNECT: const { data } = await supabase.from(table).select("*"); return data;
    await wait(200);
    return fallback;
  },

  async sendMessage(channel, conversationId, text) {
    // CONNECT: await supabase.from("messages").insert({ channel, conversation_id: conversationId, body: text, from: "human" });
    await wait(150);
    return { ok: true, id: Date.now(), text, at: Date.now() };
  },

  async updateStatus(table, id, status) {
    // CONNECT: await supabase.from(table).update({ status }).eq("id", id);
    await wait(120);
    return { ok: true, id, status };
  },

  async resolveAlert(id) {
    // CONNECT: await supabase.from("alerts").update({ resolved_at: new Date() }).eq("id", id);
    await wait(120);
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
