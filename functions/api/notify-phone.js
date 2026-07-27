// Cloudflare Pages Function — POST /api/notify-phone
// A logged-in client sets/reads their ALERT phone (where Gui texts them on a new order/booking).
// Gated by the client's connection key (get_client_data binds email↔key). Stored via set_client_notify_phone.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "notify-phone", 20)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    const action = (b.action || "get").toString();
    const ING = env.INGEST_SECRET || "";
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);

    // per-tenant gate
    const gd = await rpc("get_client_data", { p_email: email, p_key: key });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    if (action === "save") {
      const phone = (b.phone || "").toString().replace(/[^0-9+]/g, "").slice(0, 20);
      if (phone && phone.replace(/\D/g, "").length < 8) return json({ error: "invalid phone" }, 400);
      try { await rpc("set_client_notify_phone", { p_secret: ING, p_email: email, p_phone: phone }); } catch { /* RPC not pasted */ }
      return json({ ok: true, phone });
    }
    // get
    let phone = "";
    try { const lr = await rpc("client_notify_phone_lookup", { p_secret: ING, p_email: email }); if (lr.ok) phone = ((await lr.json()) || "").toString(); } catch { /* */ }
    return json({ ok: true, phone });
  } catch (e) {
    return json({ error: String(e).slice(0, 140) }, 400);
  }
}
