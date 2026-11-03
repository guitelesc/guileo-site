import { useMemo } from "react";
import { FaUsers, FaPaperPlane, FaEnvelope, FaWhatsapp, FaPhone, FaCommentSms, FaFacebook, FaInstagram, FaChartLine, FaChartPie } from "react-icons/fa6";
import { useNaturaTable } from "../useNaturaTable.js";
import { Card, Kpi, ErrorNote } from "../Card.jsx";
import { LineChart, DonutChart, Legend } from "../charts.jsx";
import { dailySeries, replyRate, CHANNEL_COLOR, CHANNEL_LABEL } from "../metrics.js";
import DateRangeFilter, { useDateRange } from "../DateRangeFilter.jsx";

const CHANNEL_ICON = { email: FaEnvelope, whatsapp: FaWhatsapp, voice: FaPhone, sms: FaCommentSms, messenger: FaFacebook, instagram: FaInstagram };
const CONVERSATION_COLUMN = {
  whatsapp: "whatsapp_conversation", sms: "sms_conversation", voice: "voice_conversation",
  email: "email_conversation", instagram: "instagram_conversation", messenger: "facebook_conversation",
};

export default function Master({ session }) {
  const { since, until, presetKey, label: rangeLabel, setPresetKey } = useDateRange();
  const WINDOW_DAYS = useMemo(() => (since ? Math.ceil((Date.now() - new Date(since).getTime()) / 86400000) : 90), [since]);
  const leads = useNaturaTable(session, "master_leads", { since, until });
  // No server-side channel filter: a voice call's SMS/email confirmation lives on that call's own
  // inbound_leads row (channel='voice'), not a separate row - same reasoning as ChannelDashboard.
  const inbound = useNaturaTable(session, "inbound_leads", { since, until });
  const outbound = useNaturaTable(session, "outbound_leads", { since, until });

  const loading = leads.loading || inbound.loading || outbound.loading;
  const error = leads.error || inbound.error || outbound.error;

  const stats = useMemo(() => {
    const byChannel = {};
    for (const key of Object.keys(CHANNEL_LABEL)) byChannel[key] = { sent: 0, replies: 0, customers: new Set() };

    for (const r of outbound.rows) {
      if (!byChannel[r.channel]) continue;
      if (r.direction === "outbound") byChannel[r.channel].sent++;
      else if (r.direction === "inbound") byChannel[r.channel].replies++;
      if (r.customer_id) byChannel[r.channel].customers.add(r.customer_id);
    }

    // Voice calls are inbound_leads rows in their own right (not outbound sends) - count them
    // directly, and also pull any confirmation entries folded into inbound_leads rows (e.g. a
    // voice call's SMS/email confirmation) into that channel's sent/replies/unique-customer counts.
    let voiceCalls = 0;
    const voiceCustomers = new Set();
    for (const r of inbound.rows) {
      if (r.channel === "voice") {
        voiceCalls++;
        if (r.customer_id) voiceCustomers.add(r.customer_id);
      }
      for (const ch of Object.keys(CONVERSATION_COLUMN)) {
        if (ch === "voice" || ch === r.channel) continue; // own-channel rows already counted via outbound_leads
        const conv = r[CONVERSATION_COLUMN[ch]];
        if (!Array.isArray(conv)) continue;
        let hasRealEntry = false;
        for (const entry of conv) {
          if (!entry || entry.event === "status_callback" || entry.event) continue;
          hasRealEntry = true;
          if (entry.direction === "outbound") byChannel[ch].sent++;
          else if (entry.direction === "inbound") byChannel[ch].replies++;
        }
        if (hasRealEntry && r.customer_id) byChannel[ch].customers.add(r.customer_id);
      }
    }

    // Unique leads contacted per channel is the headline number (not message count) - a customer
    // who got 24 WhatsApp messages is still 1 lead, not 24.
    const perChannel = Object.keys(CHANNEL_LABEL).map((key) => ({
      key,
      label: CHANNEL_LABEL[key],
      color: CHANNEL_COLOR[key],
      sent: byChannel[key].sent,
      replies: byChannel[key].replies,
      rate: replyRate(byChannel[key].sent, byChannel[key].replies),
      uniqueLeads: byChannel[key].customers.size,
    }));

    const mix = perChannel
      .map((c) => ({ label: c.label, value: c.key === "voice" ? voiceCustomers.size : c.uniqueLeads, color: c.color }))
      .filter((s) => s.value > 0);

    return {
      totalLeads: leads.rows.length,
      voiceCalls,
      voiceLeads: voiceCustomers.size,
      perChannel,
      mix,
      acquisition: dailySeries(leads.rows, "created_at", WINDOW_DAYS),
    };
  }, [leads.rows, inbound.rows, outbound.rows, WINDOW_DAYS]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-g-word">Master Overview</h1>
        <p className="mt-1 text-[13px] text-g-muted">Combined performance across all channels — {rangeLabel.toLowerCase()}</p>
      </div>

      <DateRangeFilter presetKey={presetKey} onChange={setPresetKey} />

      <ErrorNote error={error} label="overview data" />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <Kpi label="Total Leads" value={loading ? "…" : stats.totalLeads} sub="From master_leads" Icon={FaUsers} />
        {stats.perChannel.map((c) => {
          const isVoice = c.key === "voice";
          return (
            <Kpi
              key={c.key}
              label={`${c.label} Leads`}
              value={loading ? "…" : (isVoice ? stats.voiceLeads : c.uniqueLeads)}
              sub={loading ? "" : (isVoice ? `${stats.voiceCalls} calls` : `${c.sent} sent · ${c.replies} replies · ${c.rate}%`)}
              Icon={CHANNEL_ICON[c.key] || FaPaperPlane}
              tone={!isVoice && c.uniqueLeads > 0 ? "green" : undefined}
            />
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-g-green/10 text-g-green"><FaChartLine size={14} /></span>
            <div>
              <div className="text-sm font-extrabold text-g-word">Lead Acquisition</div>
              <div className="text-[11px] text-g-muted">Daily new leads</div>
            </div>
          </div>
          {loading ? <div className="py-10 text-center text-[12px] text-g-muted">Loading…</div> : <LineChart points={stats.acquisition} color="#3FB4FF" />}
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-g-gold/10 text-g-gold"><FaChartPie size={14} /></span>
            <div>
              <div className="text-sm font-extrabold text-g-word">Channel Mix</div>
              <div className="text-[11px] text-g-muted">Outreach distribution</div>
            </div>
          </div>
          {loading ? (
            <div className="py-10 text-center text-[12px] text-g-muted">Loading…</div>
          ) : stats.mix.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-g-muted">No outreach in this window yet.</div>
          ) : (
            <div className="grid place-items-center gap-4">
              <DonutChart slices={stats.mix} />
              <Legend slices={stats.mix} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
