// Cloudflare Pages Function — POST /api/agent-backfill  · ADMIN tool (one-off backfill)
// ─────────────────────────────────────────────────────────────────────────────
// Fills db/client_agents for an EXISTING client whose agent_id was never written to an
// accessible table (created on the legacy/inaccessible project). Uses the SERVER-SIDE
// ELEVENLABS_API_KEY (never exposed) to find the client's agent by number OR name, then
// writes client_agent_upsert(email, agent_id, phone_number_id, number). So /api/call can
// dial speed-to-lead callbacks AS that client's own Gui.
//
//   POST { token:<admin>, email, match_number?, match_name?, apply?:true }
//     default (dry): returns the matched agent WITHOUT writing (so Luis confirms it's the right one).
//     apply:true    : writes it to client_agents.
//
// Match priority: match_number (or the client's number on file) → the ElevenLabs phone-number entry
// (gives agent_id + phone_number_id). Else match_name → the agent whose name/label contains it
// (agent_id only; caller-ID stays platform until a number is registered). Admin-gated (blitz_stats).
import { json } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (env, fn, args) => fetch(`${SB}/rest/v1/rpc/${fn}`, {
  method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", ...args }),
});
const digits = (s) => (s || "").toString().replace(/[^0-9]/g, "");

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    // ADMIN gate — validate the admin token via blitz_stats. Direct fetch (NOT the rpc helper, which
    // would inject p_secret and 404 the function — blitz_stats takes only p_token/p_email).
    const av = await fetch(`${SB}/rest/v1/rpc/blitz_stats`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: (b.token || "").toString(), p_email: "" }),
    }).then((r) => r.ok).catch(() => false);
    if (!av) return json({ error: "unauthorized" }, 401);
    if (!env.ELEVENLABS_API_KEY) return json({ ok: false, ready: false, note: "ELEVENLABS_API_KEY not set on server." });

    // DEBUG — list the account's agents + phone numbers so an admin can see the real names/ids to match.
    if (b.list === true || b.list === "true") {
      const [ar, pr] = await Promise.all([
        fetch("https://api.elevenlabs.io/v1/convai/agents?page_size=200", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } }).then((r) => r.ok ? r.json() : ({ err: r.status })).catch((e) => ({ err: String(e).slice(0, 80) })),
        fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } }).then((r) => r.ok ? r.json() : ({ err: r.status })).catch((e) => ({ err: String(e).slice(0, 80) })),
      ]);
      const agentsArr = ar.agents || ar.items || (Array.isArray(ar) ? ar : []);
      const phonesArr = pr.phone_numbers || pr.items || (Array.isArray(pr) ? pr : []);
      return json({
        ok: true, debug: true,
        agents: (agentsArr || []).slice(0, 60).map((a) => ({ agent_id: a.agent_id || a.id, name: a.name || a.agent_name })),
        phone_numbers: (phonesArr || []).slice(0, 60).map((p) => ({ phone_number: p.phone_number || p.number, phone_number_id: p.phone_number_id || p.id, agent_id: p.assigned_agent?.agent_id || p.agent_id || p.assigned_agent_id, label: p.label })),
        raw_agents_err: ar.err || null, raw_phones_err: pr.err || null,
      });
    }

    const email = (b.email || "").toString().trim().toLowerCase();
    if (!email.includes("@")) return json({ error: "email required" }, 400);
    const apply = b.apply === true || b.apply === "true";
    const matchName = (b.match_name || "").toString().trim().toLowerCase();

    // the number to match: explicit hint, else whatever is on file for this tenant.
    let number = digits(b.match_number);
    if (!number) { try { const lr = await rpc(env, "client_number_lookup", { p_email: email }); if (lr.ok) number = digits(await lr.json()); } catch { /* none on file */ } }

    let agent_id = "", phone_number_id = "", matchedBy = "", matchedLabel = "";

    // 1) BY NUMBER — the ElevenLabs phone-number entry carries both agent_id and phone_number_id.
    if (number) {
      const pr = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
      if (pr.ok) {
        const list = await pr.json().catch(() => []);
        const arr = Array.isArray(list) ? list : (list.phone_numbers || list.items || []);
        const hit = arr.find((p) => digits(p.phone_number || p.number).endsWith(number.slice(-10)));
        if (hit) {
          agent_id = (hit.assigned_agent?.agent_id || hit.agent_id || hit.assigned_agent_id || "").toString();
          phone_number_id = (hit.phone_number_id || hit.id || "").toString();
          matchedBy = "number"; matchedLabel = (hit.label || hit.phone_number || "").toString();
        }
      }
    }

    // 2) BY NAME — list agents, find the one whose name/label contains match_name.
    if (!agent_id && matchName) {
      const ar = await fetch("https://api.elevenlabs.io/v1/convai/agents?page_size=200", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
      if (ar.ok) {
        const list = await ar.json().catch(() => ({}));
        const arr = list.agents || list.items || (Array.isArray(list) ? list : []);
        const cands = arr.filter((a) => ((a.name || a.agent_name || "") + "").toLowerCase().includes(matchName));
        if (cands.length === 1) { agent_id = (cands[0].agent_id || cands[0].id || "").toString(); matchedBy = "name"; matchedLabel = (cands[0].name || "").toString(); }
        else if (cands.length > 1) return json({ ok: false, ambiguous: true, note: `${cands.length} agents match "${matchName}" — pass match_number to disambiguate`, candidates: cands.slice(0, 10).map((a) => ({ agent_id: a.agent_id || a.id, name: a.name })) });
      }
    }

    if (!agent_id) return json({ ok: false, found: false, note: "No agent matched. Pass match_number (the client's ElevenLabs-imported number) or a distinctive match_name.", number: number || null });

    const preview = { email, agent_id, phone_number_id: phone_number_id || null, number: number ? ("+" + number) : null, matchedBy, matchedLabel };
    if (!apply) return json({ ok: true, dry: true, would_write: preview, note: "Confirm this is the right agent, then re-POST with apply:true." });

    const wr = await rpc(env, "client_agent_upsert", { p_email: email, p_agent_id: agent_id, p_el_phone_number_id: phone_number_id || "", p_number: number ? ("+" + number) : "" });
    return json({ ok: wr.ok, written: preview });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
