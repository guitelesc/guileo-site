import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// /admin — Luis's private command center. Simple password gate (basic, frontend-level —
// good enough to keep casual access out of a monitoring view; real auth comes with the
// backend later). Reads the same public gui_actions feed as /live, plus totals.

const supabase = createClient(
  "https://fccwbafkbhkyrvauzshl.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjY3diYWZrYmhreXJ2YXV6c2hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTU3NzQsImV4cCI6MjA5NDI5MTc3NH0.knDpHzK_cfpqmUzpLI4rTndAumn1yepCiRwCSAqwSNs",
  { auth: { persistSession: false } }
);

// Second, lightweight client for the AUTH project (ynihodbknhjirkdogxby) where the
// `clients` table lives. Anon key copied from src/lib/supabase.js — public by design.
// NOTE: the `clients` RLS policies only let an `authenticated` user read their OWN row,
// so this anon read will return nothing until Luis adds an admin-read RLS policy (or a
// service-role-backed function). We do NOT put service-role keys in the frontend.
const authSupabase = createClient(
  "https://ynihodbknhjirkdogxby.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E",
  { auth: { persistSession: false } }
);

const ADMIN_PASS = "guileo2026"; // change anytime; basic gate only
const ICON = { book: "📅", reschedule: "🔁", cancel: "✖️", lead: "🎯", callback: "📞", review: "⭐", sale: "💳", quote: "🧾", order: "🛒", invoice: "🔗", qualify: "🎯", confirm: "✅", winback: "💚", noshow: "🔄", info: "💬" };
const LABEL = { book: "Booked", reschedule: "Rescheduled", cancel: "Cancelled", lead: "Lead", callback: "Callback", review: "Review", sale: "Sale", quote: "Quote", order: "Order", invoice: "Payment link", qualify: "Qualified", confirm: "Confirmed", winback: "Win-back", noshow: "No-show", info: "Info" };

export default function Admin() {
  const [unlocked, setUnlocked] = useState(() => { try { return sessionStorage.getItem("guileo_admin") === "1"; } catch { return false; } });
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [state, setState] = useState("loading");
  const [clients, setClients] = useState([]);
  const [clientsState, setClientsState] = useState("loading"); // loading | ok | err
  const [sentMap, setSentMap] = useState({}); // `${id}:${step}` -> "sending" | "ok" | "err"

  // 1-click: send a branded nurture email (welcome/proof/proposal/reengage) to a lead.
  const nurture = async (r, step) => {
    const to = (r.contact || "").trim();
    if (!to.includes("@")) return;
    const k = `${r.id}:${step}`;
    setSentMap((m) => ({ ...m, [k]: "sending" }));
    try {
      const res = await fetch("/api/nurture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to, name: r.name || "there", business: r.business || "your business", lang: "pt", step }) });
      const d = await res.json().catch(() => ({}));
      setSentMap((m) => ({ ...m, [k]: d.ok ? "ok" : "err" }));
    } catch { setSentMap((m) => ({ ...m, [k]: "err" })); }
  };

  useEffect(() => {
    if (!unlocked) return;
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.from("gui_actions").select("*").order("created_at", { ascending: false }).limit(200);
      if (!alive) return;
      if (error) { setState("err"); return; }
      setRows(data || []); setState("ok");
    };
    load();
    const id = setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [unlocked]);

  // Registered clients (AUTH project). Graceful: anon reads are blocked by the current
  // RLS policies, so this falls back to a muted "not set up yet" note until an admin-read
  // policy (or service-role function) exists.
  useEffect(() => {
    if (!unlocked) return;
    let alive = true;
    const loadClients = async () => {
      try {
        const { data, error } = await authSupabase
          .from("clients")
          .select("uid,email,name,business,sector,plan,created_at")
          .order("created_at", { ascending: false })
          .limit(100);
        if (!alive) return;
        if (error) { setClientsState("err"); return; }
        setClients(data || []); setClientsState("ok");
      } catch { if (alive) setClientsState("err"); }
    };
    loadClients();
    const id = setInterval(loadClients, 15000);
    return () => { alive = false; clearInterval(id); };
  }, [unlocked]);

  if (!unlocked) {
    return (
      <div className="grid min-h-screen place-items-center bg-g-cream px-5 text-g-word">
        <form onSubmit={(e) => { e.preventDefault(); if (pass === ADMIN_PASS) { try { sessionStorage.setItem("guileo_admin", "1"); } catch {} setUnlocked(true); } else setErr("Wrong password"); }}
          className="w-full max-w-sm rounded-2xl border border-g-line bg-white/[0.04] p-7 text-center backdrop-blur-sm">
          <div className="text-3xl">🛡️</div>
          <div className="mt-2 text-[20px] font-black">Guileo Admin</div>
          <p className="mt-1 text-[13px] text-g-muted">Private command center.</p>
          <input type="password" value={pass} onChange={(e) => { setPass(e.target.value); setErr(""); }} placeholder="Password" autoFocus
            className="mt-5 w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-center text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
          {err && <div className="mt-2 text-[12px] text-[#e0855f]">{err}</div>}
          <button type="submit" className="mt-3 w-full rounded-xl bg-gradient-to-r from-g-green to-g-dark px-5 py-3 text-[14px] font-bold text-white">Enter →</button>
          <a href="/" className="mt-4 inline-block text-[12px] text-g-muted hover:text-g-word">← Back to site</a>
        </form>
      </div>
    );
  }

  const counts = rows.reduce((m, r) => { m[r.action] = (m[r.action] || 0) + 1; return m; }, {});
  const revenue = rows.filter((r) => ["sale", "order", "invoice"].includes(r.action)).reduce((s, r) => s + (parseFloat(String(r.amount).replace(/[^0-9.]/g, "")) || 0), 0);
  const top = ["lead", "book", "sale", "review", "callback", "quote"];

  return (
    <div className="min-h-screen bg-g-cream px-5 py-8 text-g-word">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-g-green">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-g-green/50" /><span className="relative inline-flex h-2 w-2 rounded-full bg-g-green" /></span> Live
            </div>
            <h1 className="text-2xl font-black">🛡️ Guileo Admin</h1>
            <p className="text-[13px] text-g-muted">Everything Gui does, across every client — in real time.</p>
          </div>
          <button onClick={() => { try { sessionStorage.removeItem("guileo_admin"); } catch {} setUnlocked(false); }} className="rounded-full border border-g-line px-3 py-1.5 text-[12px] font-bold text-g-muted hover:text-g-word">Lock</button>
        </div>

        {/* totals */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total actions" value={rows.length} />
          <Stat label="Leads captured" value={counts.lead || 0} />
          <Stat label="Bookings" value={counts.book || 0} />
          <Stat label="Revenue logged" value={"$" + revenue.toLocaleString("en-US")} />
        </div>

        {/* by type */}
        <div className="mt-3 flex flex-wrap gap-2">
          {top.map((k) => counts[k] ? <span key={k} className="rounded-full border border-g-line bg-white/[0.04] px-3 py-1 text-[12px] font-semibold text-g-ink">{ICON[k] || "•"} {LABEL[k] || k}: <span className="text-g-word">{counts[k]}</span></span> : null)}
        </div>

        {/* feed */}
        <div className="mt-6">
          <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-g-muted">Live activity</div>
          {state === "loading" && <div className="text-center text-sm text-g-muted">Loading…</div>}
          {state === "err" && <div className="rounded-xl border border-g-line bg-white/[0.04] p-4 text-sm text-g-muted">Activity store not reachable.</div>}
          {state === "ok" && rows.length === 0 && <div className="rounded-xl border border-g-line bg-white/[0.04] p-6 text-center text-sm text-g-muted">No actions yet — ask Gui to do something on a call.</div>}
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="flex items-start gap-3 rounded-xl border border-g-line bg-white/[0.04] p-3.5">
                <span className="text-lg">{ICON[r.action] || "✅"}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-g-word">{LABEL[r.action] || r.action}{r.name ? ` · ${r.name}` : ""}</div>
                  <div className="text-[12px] text-g-muted">{[r.business, r.slot, r.details, r.amount && `$${r.amount}`].filter(Boolean).join(" · ")}</div>
                  {r.contact && <div className="text-[11px] text-g-muted/80">{r.contact}</div>}
                  {String(r.contact || "").includes("@") && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {[["welcome", "👋 Boas-vindas"], ["proof", "📊 Prova"], ["proposal", "💼 Proposta"], ["reengage", "🔁 Re-engaja"]].map(([step, label]) => {
                        const st = sentMap[`${r.id}:${step}`];
                        return (
                          <button key={step} onClick={() => nurture(r, step)} disabled={st === "sending" || st === "ok"}
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${st === "ok" ? "border-g-green/40 bg-g-green/10 text-g-green" : st === "err" ? "border-[#e0855f]/40 text-[#e0855f]" : "border-g-line bg-white/[0.04] text-g-ink hover:text-g-word hover:border-g-green/40"}`}>
                            {st === "sending" ? "…" : st === "ok" ? "✓ enviado" : st === "err" ? "✕ erro" : label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <span className="whitespace-nowrap text-[11px] text-g-muted">{timeAgo(r.created_at)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* registered clients */}
        <div className="mt-8">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-g-muted">
            Registered clients
            {clientsState === "ok" && <span className="rounded-full border border-g-line bg-white/[0.04] px-2 py-0.5 text-[11px] text-g-word">{clients.length}</span>}
          </div>
          {clientsState === "loading" && <div className="text-center text-sm text-g-muted">Loading…</div>}
          {clientsState === "err" && (
            <div className="rounded-xl border border-g-line bg-white/[0.04] p-4 text-sm text-g-muted">
              Clients registry not available with current policies — run <span className="font-mono text-g-word">db/clients.sql</span> and add an admin-read RLS policy to list all clients.
            </div>
          )}
          {clientsState === "ok" && clients.length === 0 && (
            <div className="rounded-xl border border-g-line bg-white/[0.04] p-6 text-center text-sm text-g-muted">
              No clients visible yet — anon reads are blocked by RLS. Add an admin-read policy (or run <span className="font-mono text-g-word">db/clients.sql</span>) to populate this list.
            </div>
          )}
          {clientsState === "ok" && clients.length > 0 && (
            <div className="space-y-2">
              {clients.map((c) => (
                <div key={c.uid} className="flex items-start gap-3 rounded-xl border border-g-line bg-white/[0.04] p-3.5">
                  <span className="text-lg">👤</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-g-word">{[c.name, c.business].filter(Boolean).join(" · ") || c.email}</div>
                    <div className="text-[12px] text-g-muted">{[c.email, c.sector, c.plan].filter(Boolean).join(" · ")}</div>
                  </div>
                  <span className="whitespace-nowrap text-[11px] text-g-muted">{timeAgo(c.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-g-line bg-white/[0.04] p-4">
      <div className="text-[24px] font-black text-g-word">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-g-muted">{label}</div>
    </div>
  );
}

function timeAgo(iso) {
  try {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "now";
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  } catch { return ""; }
}
