/* Split out of Portal.jsx (performance): Campaigns tab view.
   TRUST FIX: a REAL (signed-in, connected) client now sees ONLY their real campaigns —
   the real engine is /api/coupons (campaign_list + campaign_send/campaign_mark_sent). No
   fabricated revenue or open-rate is ever rendered to a real client: the campaign spine has
   no revenue/opened columns, so those figures are HIDDEN in real mode (not faked). The sample
   list + demo banner stay ONLY when the tab is not connected (demo/tour). */
import { useEffect, useState } from "react";
import NoSeuPlano from "./NoSeuPlano.jsx";
import { toast, portalApi, loadDataKey } from "../lib/portalApi.js";
import { waLink } from "../data/contact.js";
import { loadCreated, genCampaigns, pushCreated, vnum, MiniStats, Card, tr, Empty, Drawer, SectionSkeleton } from "../pages/Portal.jsx";

/* Seam to the real coupons/campaigns engine. Every answer carries its OWN verdict (`_ok`):
   the previous version returned `null` on any failure and the list fell back to `[]`, so a 401
   (expired connection code) or a network blip rendered as "No campaigns yet — build one in
   Coupons & Campaigns". The owner concluded their campaigns had vanished. Failure and emptiness
   are opposite states and must never share a screen. */
async function couponsApi(body) {
  try {
    const r = await fetch("/api/coupons", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    return { ...(d && typeof d === "object" ? d : {}), _ok: r.ok && d?.ok !== false };
  } catch (e) { return { _ok: false, error: String(e).slice(0, 120) }; }
}

/* ⚡ FLASH CAMPAIGN (1-click reactivation blitz) — the owner types a short offer, previews EXACTLY
   who'd get it (POST /api/reactivate dryRun:true), then confirms an honest "this sends REAL messages"
   step to fire the same POST for real. Credentials come from portalApi.session() (email) +
   loadDataKey() (connection code) — the same pair sibling tabs receive as props (Campaigns doesn't,
   so we read them directly). Demo mode (no session/key) = simulated preview, send disabled. */
function FlashCampaign({ V }) {
  const [me, setMe] = useState(null);
  const [offer, setOffer] = useState("");
  const [channel, setChannel] = useState("sms");
  const [preview, setPreview] = useState(null);  // dry-run result
  const [result, setResult] = useState(null);    // real-send result
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { let alive = true; portalApi.session().then((s) => { if (alive) setMe(s); }); return () => { alive = false; }; }, []);
  const key = loadDataKey();
  const demo = !key || !me?.email || me?.demo === true;
  const CH = [["sms", "SMS"], ["call", tr("Call")], ["both", tr("SMS + Call")]];

  const post = async (dryRun) => {
    setErr("");
    setBusy(true);
    try {
      const r = await fetch("/api/reactivate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: key, email: me.email, channel, offer: offer.trim(), dryRun }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.ok) { setErr(d?.error || tr("Preview failed — check your connection code in Settings.")); return null; }
      return d;
    } catch { setErr(tr("Network error — try again.")); return null; }
    finally { setBusy(false); }
  };

  const doPreview = async () => {
    setResult(null);
    if (demo) {
      // DEMO: clearly simulated — deterministic numbers, no send possible.
      const n = vnum(V.label, "flash", 14, 68);
      setPreview({ dryRun: true, demo: true, pulled: n, sms: channel !== "call" ? n : 0, calls: channel !== "sms" ? Math.min(n, 60) : 0, skipped: 0,
        sample: [{ to: "+1 55…21", name: "Maria", msg: `Hi Maria! We've missed you 🌱 ${offer.trim() || "Want to come back this week? Just reply here!"}` }] });
      return;
    }
    const d = await post(true);
    if (d) setPreview(d);
  };

  const doSend = async () => {
    const d = await post(false);
    if (d) { setResult(d); setPreview(null); toast(`⚡ ${tr("Flash campaign sent")} — ${d.sms} SMS · ${d.calls} ${tr("calls")}`); }
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 flex justify-between items-center">
        <span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("⚡ Flash campaign")}</span>
        {demo && <span className="text-[10px] font-bold uppercase tracking-wide text-g-muted">{tr("Demo — preview only")}</span>}
      </div>
      <div className="p-5 space-y-3">
        <div className="text-[12px] text-g-muted">{tr("Type a short offer and Gui reactivates your lapsed customers — 1:1, by name, in minutes.")}</div>
        <input
          value={offer} onChange={(e) => { setOffer(e.target.value); setPreview(null); setResult(null); }}
          maxLength={160} placeholder={tr('e.g. "Tuesday: 20% off"')}
          className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-g-word placeholder:text-g-muted/60 outline-none focus:border-g-gold/50"
        />
        <div className="flex items-center gap-2 flex-wrap">
          {CH.map(([v, label]) => (
            <button key={v} onClick={() => { setChannel(v); setPreview(null); }}
              className="text-[11px] font-bold px-3 py-1.5 rounded-full border transition"
              style={channel === v ? { background: "#D6C29A22", borderColor: "#D6C29A", color: "#D6C29A" } : { borderColor: "rgba(255,255,255,.12)", color: "inherit", opacity: 0.7 }}>
              {label}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={doPreview} disabled={busy} className="btn-ghost text-sm">{busy && !preview ? "…" : tr("👁 Preview")}</button>
        </div>
        {err && <div className="text-[12px] font-bold" style={{ color: "#E2533F" }}>{err}</div>}

        {preview && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
            <div className="text-sm font-bold text-g-word">
              {preview.pulled} {tr(preview.pulled === 1 ? "lapsed customer would be reached" : "lapsed customers would be reached")}
              <span className="text-[11px] font-bold text-g-muted"> · {preview.sms} SMS{preview.calls ? ` · ${preview.calls} ${tr("calls")}` : ""}{preview.skipped ? ` · ${preview.skipped} ${tr("skipped (opt-out/invalid)")}` : ""}</span>
            </div>
            {(preview.sample || []).map((s, i) => (
              <div key={i} className="text-[12px] text-g-muted border-l-2 border-g-gold/40 pl-3">
                <span className="font-bold text-g-word">{s.to}</span> — “{s.msg}”
              </div>
            ))}
            {preview.pulled === 0 && <div className="text-[12px] text-g-muted">{tr("No lapsed customers in the win-back window right now — nothing would be sent.")}</div>}
            {preview.demo && <div className="text-[11px] font-bold text-g-muted">{tr("Simulated preview — connect your account to send for real.")}</div>}
            {!demo && preview.pulled > 0 && (
              <div className="rounded-lg p-3 space-y-2" style={{ background: "#E2533F14", border: "1px solid #E2533F44" }}>
                <div className="text-[12px] font-bold" style={{ color: "#E2533F" }}>
                  ⚠️ {tr(channel === "both" ? "This sends REAL messages and calls to" : channel === "call" ? "This sends REAL calls to" : "This sends REAL messages to")} {preview.pulled} {tr(preview.pulled === 1 ? "customer" : "customers")}. {tr("It can't be undone.")}
                </div>
                <button onClick={doSend} disabled={busy} className="btn-bright text-sm w-full">{busy ? tr("Sending…") : `⚡ ${tr("Yes — send to")} ${preview.pulled} ${tr("customers now")}`}</button>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="rounded-xl border p-4 text-sm font-bold" style={{ borderColor: "#3E946855", background: "#3E946814", color: "#3E9468" }}>
            ✓ {tr("Sent")} — {result.sms} SMS · {result.calls} {tr("calls")} · {result.skipped} {tr("skipped")}. {tr("Replies land in your Inbox.")}
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Real-campaign status badge (spine statuses: draft | scheduled | sent) ──
const statusMeta = (s) => {
  const k = (s || "draft").toString().toLowerCase();
  if (k === "sent") return { label: tr("Sent"), color: "#3E9468" };
  if (k === "scheduled") return { label: tr("Scheduled"), color: "#D6C29A" };
  return { label: tr("Draft"), color: "#9a958c" };
};
const kindLabel = (c) => (c.template || c.kind || "promo").toString();

// ── REAL campaigns view — reads the client's true campaign spine (/api/coupons campaign_list).
// Renders ONLY real fields (name · type · status · messages sent). No revenue / open-rate is shown
// because the spine doesn't carry them — an honest gap beats a fabricated number. ──
function RealCampaigns({ V, onNav, email, dataKey }) {
  const [rows, setRows] = useState(null);   // null = fetch in flight
  const [ready, setReady] = useState(true);
  const [readErr, setReadErr] = useState(false);
  const [sel, setSel] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    couponsApi({ action: "campaign_list", token: dataKey, email }).then((d) => {
      if (!alive) return;
      setReadErr(!d._ok);
      setReady(d.ready !== false);
      setRows(Array.isArray(d.campaigns) ? d.campaigns : []);
    });
    return () => { alive = false; };
  }, [dataKey, email]);

  const sentTotal = (rows || []).reduce((s, c) => s + (Number(c.sent_count) || 0), 0);

  // Send now — real POST; only toasts success on a real ok:true with a real count, else honest.
  const sendNow = async (c) => {
    if (!c?.id || sending) return;
    setSending(true);
    const d = await couponsApi({ action: "campaign_send", token: dataKey, email, campaign_id: c.id });
    setSending(false);
    if (!d._ok) { toast(d.note || tr("I couldn't send that — check your connection and try again.")); return; }
    if (typeof d.sent === "number" && d.sent > 0) {
      setRows((cs) => (cs || []).map((x) => (x.id === c.id ? { ...x, status: "sent", sent_count: d.sent } : x)));
      setSel((s) => (s && s.id === c.id ? { ...s, status: "sent", sent_count: d.sent } : s));
      const spent = typeof d.credits_spent === "number" ? d.credits_spent : d.sent;
      toast(`${tr("Campaign sent ✓ — in your brand")} · ${d.sent} ${tr("emails")} · ${spent} ${tr("credits")}`);
    } else if ((d.audience || 0) === 0) {
      toast(tr("No customers matched that audience yet — nothing was sent."));
    } else {
      toast(d.note ? d.note : tr("Queued — email sending isn't fully connected yet, so nothing went out."));
    }
  };

  if (rows === null) {
    return (
      <div className="space-y-4 stagger">
        <FlashCampaign V={V} />
        <SectionSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-4 stagger">
      {/* Real, honest KPIs only — campaigns count + total messages actually sent. */}
      <MiniStats items={[["Campaigns", `${rows.length}`], ["Messages sent", sentTotal.toLocaleString()]]} />
      <FlashCampaign V={V} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex justify-between items-center">
          <span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Campaigns")}</span>
          <button onClick={() => onNav?.("coupons")} className="text-[11px] font-bold text-g-gold hover:underline">{tr("New campaign →")}</button>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((c, i) => {
            const st = statusMeta(c.status);
            return (
              <button key={c.id || i} onClick={() => setSel(c)} className="w-full text-left flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.04] transition">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-g-word truncate">{c.name || c.subject || tr("Untitled campaign")}</div>
                  <div className="text-[11px] text-g-muted truncate">{kindLabel(c)}{c.audience ? ` · ${c.audience}` : ""} · {(Number(c.sent_count) || 0).toLocaleString()} {tr("sent")}</div>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: st.color + "22", color: st.color }}>{st.label}</span>
              </button>
            );
          })}
          {rows.length === 0 && (
            <Empty icon={readErr ? "⚠️" : "📣"} text={readErr
              ? tr("I couldn't read your campaigns just now — this is a connection problem, not an empty list. Reload in a moment.")
              : ready
              ? tr("No campaigns yet — build one in Coupons & Campaigns and it'll show up here, in your brand.")
              : tr("Campaigns aren't switched on yet — once activated, every promo you send appears here.")} />
          )}
        </div>
      </Card>
      {sel && (() => {
        const st = statusMeta(sel.status);
        const isSent = (sel.status || "").toString().toLowerCase() === "sent";
        return (
          <Drawer
            title={sel.name || sel.subject || tr("Campaign")}
            subtitle={`${kindLabel(sel)}${sel.audience ? ` · ${sel.audience}` : ""}`}
            badge={<span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: st.color + "22", color: st.color }}>{st.label}</span>}
            fields={[["Type", kindLabel(sel)], ["Audience", sel.audience || tr("All customers")], ["Status", st.label], ["Messages sent", (Number(sel.sent_count) || 0).toLocaleString()]]}
            note={tr("Sent in YOUR brand — your logo, your color, your name — with a discreet “powered by Guileo”.")}
            actions={<>
              {!isSent && <button onClick={() => sendNow(sel)} disabled={sending} className="btn-bright text-sm">{sending ? tr("Sending…") : `📣 ${tr("Send now")}`}</button>}
              <button onClick={() => { setSel(null); onNav?.("coupons"); }} className="btn-ghost text-sm">✏️ {tr("Open composer")}</button>
            </>}
            onClose={() => setSel(null)}
          />
        );
      })()}
    </div>
  );
}

function Campaigns({ V, onNav, real = null, email: emailProp = "", dataKey: dataKeyProp = "" }) {
  // Real-mode credentials — prefer props (sibling-tab contract); fall back to session + saved key
  // so a connected client never gets fabricated data even if this tab isn't wired with props.
  const [sessEmail, setSessEmail] = useState("");
  const [sessDone, setSessDone] = useState(false);
  const key = dataKeyProp || loadDataKey();
  useEffect(() => {
    if (emailProp) return;
    let alive = true;
    portalApi.session().then((s) => { if (!alive) return; if (s?.email && s?.demo !== true) setSessEmail(s.email); setSessDone(true); });
    return () => { alive = false; };
  }, [emailProp]);
  const email = emailProp || sessEmail;
  const live = !!(key && email);
  const resolving = !!key && !email && !emailProp && !sessDone;   // connected but session not resolved yet → avoid sample flash

  if (live) return <RealCampaigns V={V} onNav={onNav} email={email} dataKey={key} />;
  if (resolving) return <div className="space-y-4 stagger"><FlashCampaign V={V} /><SectionSkeleton rows={4} /></div>;
  return <DemoCampaigns V={V} onNav={onNav} />;
}

// ── DEMO / not-connected: the sample tour, clearly labelled as sample data. ──
function DemoCampaigns({ V, onNav }) {
  const [sel, setSel] = useState(null);
  const rows = [...loadCreated(V.label, "campaigns"), ...(V.campaigns || genCampaigns(V))];
  const buildAudience = (c) => { pushCreated(V.label, "audiences", { name: `${c.name} · engagers`, size: vnum(V.label, c.name, 1200, 9000), source: "CRM" }); setSel(null); toast(`Audience built from "${c.name}" ✓ — see it in Ad Audiences`); onNav?.("audiences"); };
  const sent = rows.reduce((s, c) => s + c.sent, 0);
  const rev = rows.reduce((s, c) => s + c.revenue, 0);
  // Divisão por zero devolvia NaN e a tela imprimia "Avg. open rate NaN%" — número
  // impossível apresentado como métrica. Lista vazia = "—", que é a verdade.
  const open = rows.length ? Math.round(rows.reduce((s, c) => s + (Number(c.opened) || 0), 0) / rows.length) : null;
  return (
    <>
     <NoSeuPlano real={real} produto="reactivation" />
   <div className="space-y-4 stagger">
      <div className="rounded-xl border border-g-gold/25 bg-g-gold/[0.06] px-4 py-2.5 text-[11px] font-bold text-g-muted">{tr("Demo — sample data. Connect your account in Settings to see your real campaigns here.")}</div>
      <MiniStats items={[["Campaigns", `${rows.length}`], ["Messages sent", sent.toLocaleString()], ["Avg. open rate", open == null ? "—" : `${open}%`, "good"], ["Revenue", `$${rev.toLocaleString()}`, "good"]]} />
      <FlashCampaign V={V} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Campaigns")}</span><a href={waLink("I'd like to launch a campaign")} target="_blank" rel="noopener" className="text-[11px] font-bold text-g-gold hover:underline">{tr("New campaign →")}</a></div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((c, i) => (
            <button key={i} onClick={() => setSel(c)} className="w-full text-left flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.04] transition">
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate flex items-center gap-1.5">{c.name}{c.fromChat && <span className="text-[8px] font-black uppercase tracking-wide text-g-gold bg-g-gold/15 rounded px-1 py-0.5">{tr("new")}</span>}</div><div className="text-[11px] text-g-muted">{c.channel} · {c.sent} sent · {c.opened}% opened</div></div>
              <span className="text-sm font-extrabold text-g-green">${c.revenue.toLocaleString()}</span>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: (c.status === "Active" ? "#3E9468" : "#D6C29A") + "22", color: c.status === "Active" ? "#3E9468" : "#D6C29A" }}>{c.status}</span>
            </button>
          ))}
          {rows.length === 0 && <Empty icon="📣" text={tr("No campaigns yet — say the word and I'll launch one, then watch the revenue land right here.")} />}
        </div>
      </Card>
      {sel && (
        <Drawer
          title={sel.name}
          subtitle={`${sel.channel} campaign`}
          badge={<span className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ background: (sel.status === "Active" ? "#3E9468" : "#D6C29A") + "22", color: sel.status === "Active" ? "#3E9468" : "#D6C29A" }}>{sel.status}</span>}
          fields={[["Channel", sel.channel], ["Sent", sel.sent.toLocaleString()], ["Open rate", `${sel.opened}%`], ["Revenue", `$${sel.revenue.toLocaleString()}`], ["ROI", `${(sel.revenue / (sel.sent * 0.05) || 0).toFixed(1)}×`]]}
          note={`Run automatically by Guileo. ${sel.status === "Active" ? "Live now — driving revenue while you focus on the business." : "Scheduled — will launch and optimize itself."}`}
          actions={<><button onClick={() => { toast("Campaign duplicated ✓"); setSel(null); }} className="btn-bright text-sm">⧉ Duplicate</button><button onClick={() => buildAudience(sel)} className="btn-ghost text-sm">🎯 Build audience</button><button onClick={() => { toast(sel.status === "Active" ? "Campaign paused" : "Campaign resumed"); setSel(null); }} className="btn-ghost text-sm">{sel.status === "Active" ? "⏸ Pause" : "▶ Resume"}</button></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
   </>
  );
}

export default Campaigns;
