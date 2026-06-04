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
};
