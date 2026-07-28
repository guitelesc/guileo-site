// Cloudflare Pages Function — POST /api/kb  (the tenant's "Cérebro do negócio")
// CRUD for a client's own Knowledge Base — the business-specific Q&A Gui answers FROM on calls
// and web chat ("Do you take walk-ins? Parking? Cancellation policy?"). Needs db/tenant_kb.sql;
// until pasted, every action returns a graceful {ready:false} note instead of a 500.
//   POST { token, email, action:"list" }                                          -> { ok, ready, count, items:[...] }
//   POST { token, email, action:"upsert", id?, question, answer?, category?, active? } -> { ok, id }
//   POST { token, email, action:"delete", id }                                     -> { ok, deleted }
//
// PER-TENANT GATE: get_client_data binds email↔connection-key (rejects a mismatch), exactly like
// noshow-radar.js — a token can only ever touch its OWN tenant's KB. The kb_* RPCs are then called
// with the server-held INGEST secret and the AUTHENTICATED email (never a caller-supplied one).
import { json } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    // PER-TENANT GATE — bind the cockpit email to its connection key (get_client_data rejects a
    // mismatch) so a token can't read/write another tenant's KB. No OWNER_EMAIL fallback.
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);
    const gd = await rpc("get_client_data", { p_email: email, p_key: key });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    const ING = env.INGEST_SECRET || "";
    const action = (b.action || "list").toString();

    if (action === "upsert") {
      const id = (b.id || "").toString().trim();
      if (id && !UUID_RX.test(id)) return json({ error: "bad id" }, 400);
      const question = (b.question || "").toString().trim().slice(0, 400);
      if (!question) return json({ error: "question required" }, 400);
      const answer = (b.answer || "").toString().slice(0, 2000);
      const category = (b.category || "general").toString().trim().slice(0, 40) || "general";
      const active = b.active === undefined ? true : b.active === true;
      const r = await rpc("kb_upsert", { p_secret: ING, p_email: email, p_id: id || null, p_question: question, p_answer: answer, p_category: category, p_active: active });
      if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/tenant_kb.sql in Supabase to activate your Knowledge Base." });
      return json({ ok: true, ready: true, id: await r.json().catch(() => null) });
    }

    if (action === "delete") {
      const id = (b.id || "").toString().trim();
      if (!UUID_RX.test(id)) return json({ error: "bad id" }, 400);
      const r = await rpc("kb_delete", { p_secret: ING, p_email: email, p_id: id });
      if (!r.ok) return json({ ok: true, ready: false, deleted: false, note: "Paste db/tenant_kb.sql in Supabase to activate your Knowledge Base." });
      return json({ ok: true, ready: true, deleted: (await r.json().catch(() => false)) === true });
    }

    // default: list
    const r = await rpc("kb_list", { p_secret: ING, p_email: email, p_key: key });
    if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/tenant_kb.sql in Supabase to activate your Knowledge Base.", count: 0, items: [] });
    const items = (await r.json().catch(() => [])) || [];
    return json({ ok: true, ready: true, count: items.length, items });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
