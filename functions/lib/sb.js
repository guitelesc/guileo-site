// Supabase REST helper with SERVER-ONLY auth. Tenant RPCs that are ALSO called by the agent/webhooks
// (no client key to assert) are being migrated to require the service_role: only our own server holds
// it (env.SUPABASE_SERVICE_ROLE, never shipped to the browser), so once anon EXECUTE is revoked on
// those RPCs, the committed literal + public anon JWT become useless to an attacker.
//
// SAFETY: falls back to the anon key when SUPABASE_SERVICE_ROLE is not set, so a Worker keeps working
// during the migration window (before the env var propagates / before anon is revoked). After anon is
// revoked on a given RPC, the fallback path simply 401s — by then the service_role is confirmed live.
const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

// The key a server-side RPC call should authenticate with: service_role when present, else anon.
export function sbKey(env) {
  return (env && env.SUPABASE_SERVICE_ROLE && String(env.SUPABASE_SERVICE_ROLE).trim()) || SB_ANON;
}

// Server-side RPC call using the service_role (falls back to anon). Same shape as the inline rpc
// helpers across functions/api, but with the elevated key so it survives an anon-execute revoke.
export function svcRpc(env, name, body) {
  const k = sbKey(env);
  return fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: k, Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export { SB_URL };
