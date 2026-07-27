// Cloudflare Pages Function — POST /api/photo-quote  · CAPTURE TOOLS: photo → quote (home services)
// ─────────────────────────────────────────────────────────────────────────────
// LIVE. A homeowner sends a PHOTO URL + a short description of the job; it lands as a "pending"
// photo-quote the owner sees in the cockpit "Captura" tab and prices with one tap. Each submission
// best-effort becomes a CRM lead (inside photo_quote_create). Backend: db/capture_tools.sql.
//
//   • CUSTOMER (public, NO tenant auth — sameOrigin + rate-limit):
//       { action:"create", email(tenant), contact, name, photo_url, note, website? }
//     NOTE ON UPLOAD: photo_url is accepted as a STRING for now (customer pastes/links an image, or a
//     future upload step returns a URL). Actual file upload/storage (R2 / signed upload) is a later step.
//   • OWNER (cockpit) — per-tenant gated (email + connection key via get_client_data):
//       { action:"list",  email, token, status? }
//       { action:"quote", email, token, id, quote_cents, status? }
// ─────────────────────────────────────────────────────────────────────────────
import { json, sameOrigin, rateLimited } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (fn, body) => fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((v || "").toString());
const s = (v, n = 200) => (v == null ? "" : v.toString().slice(0, n));

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const action = (b.action || "create").toString();
    const ING = env.INGEST_SECRET || "";

    // ── PUBLIC: a customer submits a photo + description for a quote ──
    if (action === "create") {
      if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
      if (await rateLimited(request, env, "photo-quote", 10)) return json({ error: "too many requests" }, 429);
      if (s(b.website).trim()) return json({ ok: true, stored: false }); // honeypot
      const email = s(b.email).trim().toLowerCase();
      if (!email.includes("@")) return json({ error: "bad tenant" }, 400);
      const photoUrl = s(b.photo_url, 600);
      const contact = s(b.contact, 160);
      const name = s(b.name, 120);
      const note = s(b.note, 800);
      if (!photoUrl && !note) return json({ error: "Need a photo or a description" }, 400);
      if (!contact && !name) return json({ error: "Need a way to reach you" }, 400);
      const r = await rpc("photo_quote_create", { p_secret: ING, p_email: email, p_contact: contact, p_name: name, p_photo_url: photoUrl, p_note: note });
      if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/capture_tools.sql in Supabase to activate photo-quotes." });
      const id = await r.json().catch(() => null);
      return json({ ok: true, stored: true, id, message: "Recebemos sua foto — em breve te enviamos o orçamento." });
    }

    // ── OWNER actions — per-tenant gate (email ↔ connection key). ──
    const email = s(b.email).trim().toLowerCase();
    const key = s(b.token || b.key).trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);
    const gd = await rpc("get_client_data", { p_email: email, p_key: key });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    if (action === "quote") {
      const id = s(b.id);
      if (!isUuid(id)) return json({ error: "bad id" }, 400);
      const cents = Math.max(0, Math.round(Number(b.quote_cents) || 0));
      const status = ["pending", "quoted", "won", "lost"].includes(s(b.status)) ? s(b.status) : "quoted";
      const r = await rpc("photo_quote_quote", { p_secret: ING, p_email: email, p_id: id, p_quote_cents: cents, p_status: status });
      if (!r.ok) return json({ ok: false, saved: false, note: "Paste db/capture_tools.sql in Supabase to activate photo-quotes." });
      const saved = await r.json().catch(() => false);
      return json({ ok: true, saved: saved === true });
    }

    // default / "list"
    const status = ["pending", "quoted", "won", "lost"].includes(s(b.status)) ? s(b.status) : null;
    const r = await rpc("photo_quote_list", { p_secret: ING, p_email: email, p_status: status, p_limit: 300 });
    if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/capture_tools.sql in Supabase to activate photo-quotes.", quotes: [] });
    const quotes = await r.json().catch(() => []);
    return json({ ok: true, ready: true, quotes: Array.isArray(quotes) ? quotes : [] });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
