// functions/lib/failure.js — structured failure-event bus.
// Turns every silent catch / unchecked critical step into a VISIBLE event in /admin, so a "paid-but-
// nothing" or "revenue lost" failure is caught in seconds instead of via a customer's money-back request.
// Writes to the platform feed (admin_all_events reads it) under the OWNER email, with the affected client
// named in the summary. Uses the existing ingest_client_event RPC → no new table/SQL required.
import { svcRpc } from "./sb.js";

// emitFailure(env, type, affectedEmail, detail, payload?) — never throws, never blocks the caller.
export async function emitFailure(env, type, affectedEmail, detail, payload = {}) {
  try {
    // structured log line (surfaces in Cloudflare logs even if the DB write fails)
    try { console.error(JSON.stringify({ failure: type, client: affectedEmail || "", detail: (detail || "").toString().slice(0, 300) })); } catch { /* */ }
    if (!env.INGEST_SECRET) return;
    const owner = (env.OWNER_EMAIL || "smart@guileoai.com").toString().split(",")[0].trim().toLowerCase();
    await svcRpc(env, "ingest_client_event", {
      p_secret: env.INGEST_SECRET, p_email: owner, p_type: "failure", p_channel: "system",
      p_summary: `⚠️ ${type}${affectedEmail ? " · " + affectedEmail : ""}${detail ? " · " + detail : ""}`.slice(0, 300),
      p_amount: 0, p_payload: { failure_type: type, client: affectedEmail || "", ...payload },
    });
  } catch { /* failure-bus is itself best-effort — never break the caller */ }
}
