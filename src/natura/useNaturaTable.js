// Shared data-fetch hook for the Natura channels dashboard. Every read goes through
// /api/natura-data (server-side, service_role key) — see that file's header for why: every
// table has RLS with no public policy, so the browser's anon key can never read them directly.
import { useEffect, useState } from "react";

// *_conversation columns are jsonb arrays, but some rows (written by an n8n Code node that
// JSON.stringify'd the array before handing it to the Supabase node, which then serialized it
// again as a jsonb string) come back double-encoded: a JSON string containing an escaped JSON
// string, e.g. "\"[{...}]\"" instead of [{...}]. PostgREST/the fetch layer hands that back to
// us as a plain string, not an array, so Array.isArray() on it is false and every conversation-
// column consumer silently treats the row as having no data. Normalize once here, at the fetch
// boundary, so every page downstream can keep assuming *_conversation is always a real array.
const CONVERSATION_COLUMNS = [
  "sms_conversation", "voice_conversation", "email_conversation",
  "whatsapp_conversation", "instagram_conversation", "facebook_conversation",
];
function normalizeConversationColumns(row) {
  for (const col of CONVERSATION_COLUMNS) {
    let v = row[col];
    if (typeof v !== "string") continue;
    // Unwrap up to 2 layers of string-encoding (string-of-string-of-array, or just string-of-array).
    for (let i = 0; i < 2 && typeof v === "string"; i++) {
      try { v = JSON.parse(v); } catch { break; }
    }
    row[col] = Array.isArray(v) ? v : (v == null ? [] : row[col]);
  }
  return row;
}

export function useNaturaTable(session, table, params) {
  const [state, setState] = useState({ loading: true, rows: [], error: null });
  const paramsKey = JSON.stringify(params || {});
  useEffect(() => {
    if (!session?.sid) { setState({ loading: false, rows: [], error: "signed_out" }); return; }
    let alive = true;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const qs = new URLSearchParams({ table, ...(params || {}) });
        const r = await fetch(`/api/natura-data?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${session.sid}` },
        });
        const data = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok || !data.ok) { setState({ loading: false, rows: [], error: data.error || "read_failed" }); return; }
        setState({ loading: false, rows: (data.rows || []).map(normalizeConversationColumns), error: null });
      } catch (e) {
        if (alive) setState({ loading: false, rows: [], error: String(e?.message || e) });
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.sid, table, paramsKey]);
  return state;
}

// ISO date N days ago, truncated to a date boundary — stable across re-renders
// when memoized by the caller on `days` alone, matches the `since` the API expects.
export function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
