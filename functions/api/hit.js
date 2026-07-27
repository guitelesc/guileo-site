// Cloudflare Pages Function — POST /api/hit → privacy-first visit beacon.
// Stores page + referrer host + lang + country (from Cloudflare's edge header).
// NO cookies, NO IP, NO fingerprinting — just honest counts for /admin.
import { sameOrigin, rateLimited, json } from "../lib/guard.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ ok: false }, 403);
    if (await rateLimited(request, env, "hit", 30)) return json({ ok: false }, 429);
    const body = await request.json().catch(() => ({}));
    const page = (body.page || "/").toString().slice(0, 120);
    let ref = "";
    try { const r = (body.ref || "").toString(); if (r) ref = new URL(r).hostname.slice(0, 80); } catch { /* keep empty */ }
    const lang = (body.lang || "").toString().slice(0, 5);
    const country = (request.headers.get("CF-IPCountry") || "").slice(0, 2);
    await fetch(`${SB_URL}/rest/v1/site_hits`, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ page, ref, lang, country }),
    });
    return json({ ok: true });
  } catch {
    return json({ ok: false }, 400);
  }
}
