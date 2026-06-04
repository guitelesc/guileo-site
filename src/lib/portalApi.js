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

const SB_URL = import.meta?.env?.VITE_SUPABASE_URL || "";
const SB_KEY = import.meta?.env?.VITE_SUPABASE_ANON_KEY || "";

/** True once real backend keys are present. UI shows "Demo" until then. */
export const CONNECTED = Boolean(SB_URL && SB_KEY);

const wait = (ms = 320) => new Promise((r) => setTimeout(r, ms));
const SESSION_KEY = "guileo_portal_session";

// ── Tiny toast bus (action feedback across every screen) ──
let _toastListeners = [];
export const toast = (text) => _toastListeners.forEach((l) => l(text));
export const onToast = (fn) => { _toastListeners.push(fn); return () => { _toastListeners = _toastListeners.filter((x) => x !== fn); }; };

export const portalApi = {
  connected: CONNECTED,

  /** Current session (or null). */
  async session() {
    // CONNECT: return (await supabase.auth.getSession()).data.session
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
  },

  /** Sign in. In demo mode any credentials work. */
  async login(email) {
    await wait();
    // CONNECT: const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    const sess = { email: email || "demo@guileo.ai", name: "Jane Staff", role: "Staff", demo: !CONNECTED, at: Date.now() };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(sess)); } catch { /* private mode */ }
    return sess;
  },

  async logout() {
    // CONNECT: await supabase.auth.signOut()
    try { localStorage.removeItem(SESSION_KEY); } catch { /* private mode */ }
    return true;
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
    // CONNECT: await supabase.from("kb_entries").upsert(entries.map(e => ({ ...e, vertical })));
    try { localStorage.setItem(`guileo_kb_${vertical}`, JSON.stringify(entries)); } catch { /* private mode */ }
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
    // CONNECT: await supabase.from("business_profile").upsert({ ...profile, vertical });
    try { localStorage.setItem(`guileo_profile_${vertical}`, JSON.stringify(profile)); } catch { /* private mode */ }
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
    // CONNECT: upsert into `ui_state` (tenant, key, value)
    try { localStorage.setItem(`guileo_state_${key}`, JSON.stringify(value)); } catch { /* private mode */ }
    return { ok: true };
  },
};
