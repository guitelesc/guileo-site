// Customers tab: full customer list with search + a detail panel showing everything we know
// about one person (contact info, consent, last-contacted-per-channel, related leads) — real
// columns only, straight from the customers + master_leads tables.
import { useMemo, useState } from "react";
import { FaUser, FaMagnifyingGlass, FaPhone, FaEnvelope, FaLocationDot, FaLanguage, FaCircleCheck, FaCircleXmark } from "react-icons/fa6";
import { useNaturaTable } from "../useNaturaTable.js";
import { Card, ErrorNote, timeAgo } from "../Card.jsx";
import DateRangeFilter, { useDateRange } from "../DateRangeFilter.jsx";

const CONSENT_CHANNELS = ["sms", "whatsapp", "email", "voice_marketing"];
// `navKey` is the channel key NaturaDashboard's nav state expects (messenger, not facebook) -
// the customers table's own column prefixes stay "facebook_"/"instagram_"/etc per the schema.
const LAST_CONTACTED_FIELDS = [
  { key: "voice_last_contacted_at", label: "Voice", navKey: "voice" },
  { key: "sms_last_contacted_at", label: "SMS", navKey: "sms" },
  { key: "whatsapp_last_contacted_at", label: "WhatsApp", navKey: "whatsapp" },
  { key: "email_last_contacted_at", label: "Email", navKey: "email" },
  { key: "instagram_last_contacted_at", label: "Instagram", navKey: "instagram" },
  { key: "facebook_last_contacted_at", label: "Facebook", navKey: "messenger" },
];
const CHANNEL_INSIGHT_FIELDS = [
  { prefix: "voice", label: "Voice", navKey: "voice" },
  { prefix: "sms", label: "SMS", navKey: "sms" },
  { prefix: "whatsapp", label: "WhatsApp", navKey: "whatsapp" },
  { prefix: "email", label: "Email", navKey: "email" },
  { prefix: "instagram", label: "Instagram", navKey: "instagram" },
  { prefix: "facebook", label: "Facebook", navKey: "messenger" },
];
const SENTIMENT_TONE = { positive: "text-g-green", negative: "text-red-400", neutral: "text-g-muted" };

function matches(c, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  return [c.name, c.phone, c.email, c.instagram_handle, c.preferred_location, c.mindbody_client_id]
    .filter(Boolean).some((v) => String(v).toLowerCase().includes(s));
}

export default function Customers({ session, onNavigateToChannel }) {
  const { since, until, presetKey, setPresetKey } = useDateRange();
  const customers = useNaturaTable(session, "customers", { since, until });
  const leads = useNaturaTable(session, "master_leads");
  const loading = customers.loading;
  const error = customers.error;
  const [q, setQ] = useState("");
  const [activeId, setActiveId] = useState(null);

  const filtered = useMemo(() => customers.rows.filter((c) => matches(c, q)), [customers.rows, q]);
  const active = filtered.find((c) => c.id === activeId) || filtered[0] || null;
  const activeLeads = useMemo(() => leads.rows.filter((l) => l.customer_id === active?.id), [leads.rows, active]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-g-word">Customers</h1>
        <p className="mt-1 text-[13px] text-g-muted">Everyone on file, merged across every channel — filtered by when they were first added</p>
      </div>

      <DateRangeFilter presetKey={presetKey} onChange={setPresetKey} />

      <ErrorNote error={error} label="customers" />

      <div className="mb-4 flex items-center gap-2 rounded-full border border-g-line bg-g-creamd/40 px-4 py-2.5">
        <FaMagnifyingGlass size={13} className="text-g-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, phone, email, Instagram, location…"
          className="w-full bg-transparent text-[13px] text-g-word outline-none placeholder:text-g-muted"
        />
      </div>

      {loading ? (
        <Card><div className="py-10 text-center text-[12px] text-g-muted">Loading…</div></Card>
      ) : filtered.length === 0 ? (
        <Card><div className="py-10 text-center text-[12px] text-g-muted">{q ? "No customers match your search." : "No customers yet."}</div></Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          <Card className="max-h-[640px] overflow-y-auto scroll-clean !p-2">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${(active?.id === c.id) ? "bg-g-cream" : "hover:bg-white/[0.03]"}`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.07] text-g-muted"><FaUser size={14} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-g-word">{c.name || "(no name)"}</span>
                  <span className="block truncate text-[11px] text-g-muted">{c.phone || c.email || "—"}</span>
                </span>
              </button>
            ))}
          </Card>

          {active && (
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-extrabold text-g-word">{active.name || "(no name)"}</div>
                  <div className="mt-1 text-[11px] text-g-muted">Customer since {timeAgo(active.created_at)} · first seen on {active.channel_first_seen || "—"}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2 text-[13px] text-g-word"><FaPhone size={12} className="text-g-muted" /> {active.phone || "—"}</div>
                <div className="flex items-center gap-2 text-[13px] text-g-word"><FaEnvelope size={12} className="text-g-muted" /> {active.email || "—"}</div>
                <div className="flex items-center gap-2 text-[13px] text-g-word"><FaLocationDot size={12} className="text-g-muted" /> {active.preferred_location || "—"}</div>
                <div className="flex items-center gap-2 text-[13px] text-g-word"><FaLanguage size={12} className="text-g-muted" /> {active.language || "en"}</div>
                {active.instagram_handle && <div className="text-[13px] text-g-word">@{active.instagram_handle}</div>}
                {active.mindbody_client_id && <div className="text-[13px] text-g-muted">MindBody: {active.mindbody_client_id}</div>}
              </div>

              <div className="mt-5">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-g-muted">Consent</div>
                <div className="flex flex-wrap gap-2">
                  {CONSENT_CHANNELS.map((key) => {
                    const on = !!active.consent?.[key];
                    return (
                      <span key={key} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${on ? "border-g-green/40 text-g-green" : "border-g-line text-g-muted"}`}>
                        {on ? <FaCircleCheck size={10} /> : <FaCircleXmark size={10} />} {key.replace("_", " ")}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-g-muted">Last Contacted</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {LAST_CONTACTED_FIELDS.map((f) => {
                    const Tag = onNavigateToChannel ? "button" : "div";
                    return (
                      <Tag
                        key={f.key}
                        onClick={Tag === "button" ? () => onNavigateToChannel(f.navKey, "chat") : undefined}
                        className={`rounded-lg border border-g-line bg-g-cream/50 px-2.5 py-2 text-left ${Tag === "button" ? "cursor-pointer transition hover:border-g-gold/50 hover:bg-g-cream" : ""}`}
                      >
                        <div className="text-[10px] uppercase text-g-muted">{f.label}</div>
                        <div className="text-[12px] font-bold text-g-word">{active[f.key] ? timeAgo(active[f.key]) : "—"}</div>
                      </Tag>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-g-muted">Sentiment & Status by Channel</div>
                {(() => {
                  const withData = CHANNEL_INSIGHT_FIELDS.filter(
                    (f) => active[`${f.prefix}_lead_status`] || active[`${f.prefix}_sentiment`] || active[`${f.prefix}_note`]
                  );
                  if (withData.length === 0) return <div className="text-[12px] text-g-muted">No status or sentiment recorded yet.</div>;
                  return (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {withData.map((f) => {
                        const status = active[`${f.prefix}_lead_status`];
                        const sentiment = active[`${f.prefix}_sentiment`];
                        const note = active[`${f.prefix}_note`];
                        const Tag = onNavigateToChannel ? "button" : "div";
                        return (
                          <Tag
                            key={f.prefix}
                            onClick={Tag === "button" ? () => onNavigateToChannel(f.navKey, "chat") : undefined}
                            className={`rounded-lg border border-g-line bg-g-cream/50 px-3 py-2 text-left ${Tag === "button" ? "w-full cursor-pointer transition hover:border-g-gold/50 hover:bg-g-cream" : ""}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[10px] font-bold uppercase text-g-muted">{f.label}</div>
                              <div className="flex gap-1.5">
                                {status && <span className="rounded-full border border-g-line px-2 py-0.5 text-[10px] font-bold capitalize text-g-word">{status}</span>}
                                {sentiment && <span className={`rounded-full border border-g-line px-2 py-0.5 text-[10px] font-bold capitalize ${SENTIMENT_TONE[sentiment] || "text-g-word"}`}>{sentiment}</span>}
                              </div>
                            </div>
                            {note && <p className="mt-1.5 text-[11.5px] leading-relaxed text-g-muted">{note}</p>}
                          </Tag>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div className="mt-5">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-g-muted">Leads ({activeLeads.length})</div>
                {activeLeads.length === 0 ? (
                  <div className="text-[12px] text-g-muted">No leads on file for this customer.</div>
                ) : (
                  <div className="grid gap-2">
                    {activeLeads.map((l) => (
                      <div key={l.id} className="flex items-center justify-between gap-2 rounded-lg border border-g-line bg-g-cream/50 px-3 py-2">
                        <div className="min-w-0">
                          <div className="truncate text-[12.5px] font-bold text-g-word">{l.service_interest || l.intent || "(no detail)"}</div>
                          <div className="text-[10px] text-g-muted">via {l.source_channel || "—"} · {timeAgo(l.updated_at)}</div>
                        </div>
                        <span className="shrink-0 rounded-full border border-g-line px-2 py-0.5 text-[10px] text-g-ink">{l.stage}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
