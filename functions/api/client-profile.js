// Cloudflare Pages Function — POST /api/client-profile · the admin wallet's LIVE client profile.
// Admin-gated (blitz_stats, same as onboard-client) → admin_client_profile RPC (db/client_profile.sql):
// intake payload (owner/site/channels/logo), live units + contracted services (scheduling engine),
// credits, 30d pulse, open intents, and the upsell flags (has_packages/memberships/coupons).
import { json, sameOrigin } from "../lib/guard.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    const b = await request.json().catch(() => ({}));
    const email = (b.email || "").toString().trim().toLowerCase();
    if (!email.includes("@")) return json({ error: "email required" }, 400);

    const rpc = (fn, args) => fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });

    // admin gate — the token must open blitz_stats before any profile data moves
    const vr = await rpc("blitz_stats", { p_token: (b.token || "").toString(), p_email: "" });
    if (!vr.ok) return json({ error: "unauthorized" }, 401);

    const r = await rpc("admin_client_profile", { p_secret: env.INGEST_SECRET || "", p_email: email });
    if (!r.ok) return json({ error: "profile unavailable (paste db/client_profile.sql)" }, 500);
    const profile = await r.json().catch(() => ({}));
    return json({ ok: true, profile });
  } catch (e) {
    return json({ error: String(e).slice(0, 140) }, 400);
  }
}
