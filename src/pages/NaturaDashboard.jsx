// /natura-channels/dashboard — multi-channel outreach cockpit for Lilian (Natura Spa + Salon).
// Standalone page (own route, own file) — does NOT import from or modify Portal.jsx/portalApi.js,
// so the main site's cockpit is untouched. All reads go through /api/natura-data (server-side,
// service_role key) instead of querying Supabase directly from the browser: every table here has
// RLS enabled with no public policy (see supabase/001_schema.sql), so the anon key the browser
// would otherwise use can never read them — this route is the only way the UI sees real rows.
// Layout: left sidebar (Master + one collapsible group per channel, each with
// Dashboard/Chat/Leads/Analytics) + Leads/Credentials at the bottom, main pane renders the
// selected section. Visual language matches the existing cockpit: cimento-quente dark theme.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaGrip, FaEnvelope, FaWhatsapp, FaPhone, FaCommentSms, FaFacebook, FaInstagram,
  FaArrowRightFromBracket, FaChevronDown, FaGaugeHigh, FaComments, FaUsers, FaChartLine, FaKey, FaAddressBook,
} from "react-icons/fa6";
import { naturaSession, naturaSignOut } from "../lib/naturaSession.js";
import Master from "../natura/sections/Master.jsx";
import ChannelDashboard from "../natura/sections/ChannelDashboard.jsx";
import ChannelChat from "../natura/sections/ChannelChat.jsx";
import VoiceCallLogs from "../natura/sections/VoiceCallLogs.jsx";
import ChannelLeads from "../natura/sections/ChannelLeads.jsx";
import ChannelAnalytics from "../natura/sections/ChannelAnalytics.jsx";
import Credentials from "../natura/sections/Credentials.jsx";
import Customers from "../natura/sections/Customers.jsx";
import "../natura/scroll-clean.css";

const CHANNELS = [
  { key: "email",     label: "Email",      Icon: FaEnvelope,   color: "#3FB4FF" },
  { key: "whatsapp",  label: "WhatsApp",   Icon: FaWhatsapp,   color: "#3E9468" },
  { key: "voice",     label: "Voice",      Icon: FaPhone,      color: "#D6C29A" },
  { key: "sms",       label: "SMS",        Icon: FaCommentSms, color: "#FFC23D" },
  { key: "messenger", label: "Facebook",   Icon: FaFacebook,   color: "#4267B2" },
  { key: "instagram", label: "Instagram",  Icon: FaInstagram,  color: "#E0855F" },
];

const SUBPAGES = [
  { key: "dashboard", label: "Dashboard", Icon: FaGaugeHigh },
  { key: "chat",      label: "Chat",      Icon: FaComments },
  { key: "leads",     label: "Leads",     Icon: FaUsers },
  { key: "analytics", label: "Analytics", Icon: FaChartLine },
];

function NavGroup({ channel, open, onToggle, active, onPick }) {
  const isActiveGroup = active.scope === "channel" && active.channel === channel.key;
  return (
    <div>
      <button
        onClick={onToggle}
        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${isActiveGroup ? "bg-g-creamd text-g-word" : "text-g-muted hover:bg-white/[0.03] hover:text-g-word"}`}
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.06]" style={{ color: channel.color }}>
          <channel.Icon size={13} />
        </span>
        <span className="flex-1 text-[13px] font-bold">{channel.label}</span>
        <FaChevronDown size={10} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="ml-4 mt-1 grid gap-0.5 border-l border-g-line pl-3">
          {SUBPAGES.map((sp) => {
            const isActive = isActiveGroup && active.subpage === sp.key;
            const label = sp.key === "chat" && channel.key === "voice" ? "Call Logs" : sp.label;
            return (
              <button
                key={sp.key}
                onClick={() => onPick(channel.key, sp.key)}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] font-semibold transition ${isActive ? "bg-g-cream text-g-word" : "text-g-muted hover:text-g-word"}`}
              >
                <sp.Icon size={11} /> {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function NaturaDashboard() {
  const nav = useNavigate();
  const [session] = useState(() => naturaSession());
  const [openGroup, setOpenGroup] = useState(null);
  const [active, setActive] = useState({ scope: "master" }); // {scope:"master"} | {scope:"channel", channel, subpage} | {scope:"credentials"}

  useEffect(() => {
    if (!session) nav("/natura-channels");
  }, [session, nav]);

  const signOut = () => { naturaSignOut(); nav("/natura-channels"); };
  const pickChannel = (channel, subpage) => setActive({ scope: "channel", channel, subpage });
  const toggleGroup = (key) => {
    setOpenGroup((g) => (g === key ? null : key));
    if (openGroup !== key) pickChannel(key, "dashboard");
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-g-cream text-g-word flex">
      <aside className="flex w-64 shrink-0 flex-col border-r border-g-line bg-g-creamd/40">
        <div className="border-b border-g-line px-4 py-4">
          <div className="text-[10px] uppercase tracking-wide text-g-muted">Natura Spa + Salon</div>
          <div className="text-sm font-extrabold text-g-word">Lilian Channels</div>
        </div>

        <div className="flex-1 overflow-y-auto scroll-clean px-3 py-3">
          <div className="px-1 pb-2 text-[10px] font-bold uppercase tracking-wide text-g-muted">Channels</div>
          <button
            onClick={() => { setActive({ scope: "master" }); setOpenGroup(null); }}
            className={`mb-2 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${active.scope === "master" ? "bg-g-creamd text-g-word" : "text-g-muted hover:bg-white/[0.03] hover:text-g-word"}`}
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-g-gold/10 text-g-gold"><FaGrip size={13} /></span>
            <span className="text-[13px] font-bold">Master</span>
          </button>

          <button
            onClick={() => { setActive({ scope: "customers" }); setOpenGroup(null); }}
            className={`mb-2 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${active.scope === "customers" ? "bg-g-creamd text-g-word" : "text-g-muted hover:bg-white/[0.03] hover:text-g-word"}`}
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.06] text-g-muted"><FaAddressBook size={13} /></span>
            <span className="text-[13px] font-bold">Customers</span>
          </button>

          <div className="grid gap-1">
            {CHANNELS.map((c) => (
              <NavGroup
                key={c.key}
                channel={c}
                open={openGroup === c.key}
                onToggle={() => toggleGroup(c.key)}
                active={active}
                onPick={pickChannel}
              />
            ))}
          </div>

          <div className="mt-4 border-t border-g-line pt-3">
            <button
              onClick={() => { setActive({ scope: "credentials" }); setOpenGroup(null); }}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${active.scope === "credentials" ? "bg-g-creamd text-g-word" : "text-g-muted hover:bg-white/[0.03] hover:text-g-word"}`}
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.06] text-g-muted"><FaKey size={13} /></span>
              <span className="text-[13px] font-bold">Credentials</span>
            </button>
          </div>
        </div>

        <div className="border-t border-g-line p-3">
          <div className="mb-2 px-1 text-[11px] text-g-muted">{session.name || session.email}</div>
          <button onClick={signOut} className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#e0855f]/30 bg-[#e0855f]/10 px-3 py-2 text-[12px] font-bold text-[#e0855f] hover:bg-[#e0855f]/20">
            <FaArrowRightFromBracket size={12} /> Sign Out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto scroll-clean p-6">
        {active.scope === "master" && <Master session={session} />}
        {active.scope === "customers" && <Customers session={session} onNavigateToChannel={pickChannel} />}
        {active.scope === "credentials" && <Credentials session={session} />}
        {active.scope === "channel" && active.subpage === "dashboard" && <ChannelDashboard session={session} channel={active.channel} />}
        {active.scope === "channel" && active.subpage === "chat" && active.channel === "voice" && <VoiceCallLogs session={session} />}
        {active.scope === "channel" && active.subpage === "chat" && active.channel !== "voice" && <ChannelChat session={session} channel={active.channel} />}
        {active.scope === "channel" && active.subpage === "leads" && <ChannelLeads session={session} channel={active.channel} />}
        {active.scope === "channel" && active.subpage === "analytics" && <ChannelAnalytics session={session} channel={active.channel} />}
      </main>
    </div>
  );
}
