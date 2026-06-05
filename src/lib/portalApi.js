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

// ── Background sync to Supabase (localStorage stays the synchronous source of truth;
// the cloud is mirrored so state persists across devices). Writes are debounced. ──
let _uid = null;                       // current auth user id (set on hydrate)
const _pending = new Map();            // key -> value awaiting upsert
let _flushTimer = null;
function _queueUpsert(key, value) {
  if (!supabase || !_uid) return;
  _pending.set(key, value);
  if (_flushTimer) return;
  _flushTimer = setTimeout(_flush, 800);
}
async function _flush() {
  _flushTimer = null;
  if (!supabase || !_uid || _pending.size === 0) return;
  const rows = [..._pending.entries()].map(([k, v]) => ({ user_id: _uid, k, v }));
  _pending.clear();
  try { await supabase.from("app_kv").upsert(rows); } catch { /* offline — localStorage already has it */ }
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

  /** Sign in. Real backend = passwordless magic link (no passwords handled). Demo = any creds. */
  async login(email) {
    if (supabase) {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/portal` } });
      return { pending: true, email, error: error?.message || null };
    }
    await wait();
    const sess = { email: email || "demo@guileo.ai", name: "Jane Staff", role: "Staff", demo: true, at: Date.now() };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(sess)); } catch { /* private mode */ }
    return sess;
  },

  async logout() {
    if (supabase) { try { await supabase.auth.signOut(); } catch { /* */ } }
    _uid = null;
    try { localStorage.removeItem(SESSION_KEY); } catch { /* private mode */ }
    return true;
  },

  /** Pull this user's saved state from Supabase into localStorage (one-time, on sign-in),
   *  so the synchronous loadState() reads work instantly afterward. Returns row count. */
  async hydrate() {
    if (!supabase) return 0;
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return 0;
    _uid = u.user.id;
    const { data, error } = await supabase.from("app_kv").select("k,v");
    if (error || !data) return 0;
    data.forEach(({ k, v }) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } });
    return data.length;
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
