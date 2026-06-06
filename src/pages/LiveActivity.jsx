import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

// /live — a real-time feed of everything Gui does (bookings, leads, reviews, sales) across calls.
// Reads the public `gui_actions` table (anon, RLS-protected). Polls so new actions appear live.
const ICON = { book: "📅", reschedule: "🔁", cancel: "✖️", lead: "🎯", callback: "📞", review: "⭐", sale: "💳", quote: "🧾" };
const LABEL = { book: "Booked", reschedule: "Rescheduled", cancel: "Cancelled", lead: "Lead captured", callback: "Callback set", review: "Review requested", sale: "Sale logged", quote: "Quote requested" };

export default function LiveActivity() {
  const [rows, setRows] = useState([]);
  const [state, setState] = useState("loading"); // loading | ok | needsetup | nodb

  useEffect(() => {
    if (!supabase) { setState("nodb"); return; }
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.from("gui_actions").select("*").order("created_at", { ascending: false }).limit(50);
      if (!alive) return;
      if (error) { setState(error.code === "42P01" || /relation .* does not exist/i.test(error.message) ? "needsetup" : "ok"); return; }
      setRows(data || []); setState("ok");
    };
    load();
    const id = setInterval(load, 4000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <div className="min-h-screen bg-g-cream text-g-ink">
      <div className="mx-auto max-w-2xl px-5 py-12">
        <a href="/" className="inline-flex items-center gap-2 mb-6 text-sm font-bold text-g-muted hover:text-g-word">← Guileo</a>
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-g-green"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-g-green/50 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-g-green" /></span>Live</span>
        </div>
        <h1 className="text-3xl font-black text-g-word">Everything Gui does — live</h1>
        <p className="mt-2 text-sm text-g-muted">Every booking, lead, review and sale your AI handles on a call lands here in real time.</p>

        {state === "loading" && <div className="mt-10 text-center text-g-muted text-sm">Loading…</div>}

        {state === "nodb" && <div className="mt-8 rounded-xl2 border border-g-line bg-white/[0.04] p-5 text-sm text-g-muted">The activity store isn't connected yet.</div>}

        {state === "needsetup" && (
          <div className="mt-8 rounded-xl2 border border-g-gold/30 bg-g-gold/[0.06] p-5 text-sm text-g-word">
            <div className="font-bold mb-1">One-time setup needed</div>
            <p className="text-g-muted">The <code>gui_actions</code> table doesn't exist yet. Run the SQL snippet in your Supabase SQL editor, then refresh — Gui's actions will stream in here.</p>
          </div>
        )}

        {state === "ok" && rows.length === 0 && (
          <div className="mt-8 rounded-xl2 border border-g-line bg-white/[0.04] p-8 text-center text-sm text-g-muted">
            🪄 Waiting for Gui's first action… ask it to book something on a call.
          </div>
        )}

        {state === "ok" && rows.length > 0 && (
          <div className="mt-8 space-y-2.5">
            {rows.map((r) => (
              <div key={r.id} className="flex items-start gap-3 rounded-xl2 border border-g-line bg-white/[0.05] p-4">
                <span className="text-xl shrink-0">{ICON[r.action] || "✅"}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-g-word">{LABEL[r.action] || r.action}{r.name ? ` · ${r.name}` : ""}</div>
                  <div className="text-[13px] text-g-muted leading-snug">
                    {[r.business, r.slot, r.details, r.amount && `$${r.amount}`].filter(Boolean).join(" · ")}
                  </div>
                  {r.contact && <div className="text-[11px] text-g-muted/80 mt-0.5">{r.contact}</div>}
                </div>
                <span className="text-[11px] text-g-muted whitespace-nowrap shrink-0">{timeAgo(r.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function timeAgo(iso) {
  try {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  } catch { return ""; }
}
