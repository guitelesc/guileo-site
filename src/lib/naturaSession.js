// Session helpers for the Natura channels module (/natura). Separate from src/lib/portalApi.js's
// session handling — this module's login never touches the main site's Supabase Auth.
const SESSION_KEY = "natura_module_session";

export function naturaSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}
export function naturaSaveSession(session) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* private mode */ }
}
export function naturaSignOut() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* private mode */ }
}
