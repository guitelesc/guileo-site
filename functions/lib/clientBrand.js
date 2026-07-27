// Per-client brand loader for the BRANDED email engine ("motor de crescimento PERSONALIZADO").
// Reads the client's white-label brand (logo, accent color, agent name, business name) so that the
// emails/coupons/promos we send on their behalf carry THEIR identity — not Guileo's. The brand lives
// in client_profile_extras (extras jsonb: logo_url, accent, agent_name, …) + the base profile
// (business_name, lang), both reachable only through INGEST-gated SECURITY DEFINER RPCs.
//
// Same Supabase project + anon key + INGEST-gated rpc() pattern as functions/api/reactivate.js.

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (env, fn, args = {}) => fetch(`${SB}/rest/v1/rpc/${fn}`, {
  method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify({ p_secret: (env && env.INGEST_SECRET) || "", ...args }),
}).then((r) => (r.ok ? r.json() : null)).catch(() => null);

// Guileo house defaults — used verbatim when a client has no brand stored yet, so a branded email
// NEVER renders broken: it just falls back to being a clean Guileo-branded email.
export const GUILEO_BRAND = {
  business: "Guileo",
  logo_url: "https://guileoai.com/favicon.png",
  accent: "#FF8A33",      // Gui orange — the house signal color
  agent_name: "Gui",
  lang: "en",
};

const isHex = (s) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(s || "").trim());

// brandFor(env, clientEmail) → { business, logo_url, accent, agent_name, lang }
// Graceful: any missing piece falls back to the Guileo default; never throws.
export async function brandFor(env, clientEmail) {
  const email = String(clientEmail || "").trim().toLowerCase();
  if (!email || !env || !env.INGEST_SECRET) return { ...GUILEO_BRAND };
  const [extras, profile] = await Promise.all([
    rpc(env, "profile_extras_get", { p_email: email }),
    rpc(env, "get_client_profile", { p_email: email }),
  ]);
  const x = (extras && typeof extras === "object") ? extras : {};
  const p = (profile && typeof profile === "object") ? profile : {};
  const accent = isHex(x.accent) ? String(x.accent).trim() : GUILEO_BRAND.accent;
  const logo = String(x.logo_url || "").trim();
  const business = String(x.business || p.business_name || "").trim() || GUILEO_BRAND.business;
  const langRaw = String(p.lang || "").toLowerCase().slice(0, 2);
  const lang = langRaw === "pt" ? "pt" : langRaw === "es" ? "es" : (langRaw === "en" ? "en" : GUILEO_BRAND.lang);
  return {
    business,
    logo_url: /^https?:\/\//i.test(logo) ? logo : GUILEO_BRAND.logo_url,
    accent,
    agent_name: String(x.agent_name || "").trim() || GUILEO_BRAND.agent_name,
    lang,
  };
}
