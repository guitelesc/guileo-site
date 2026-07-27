/* Split out of Portal.jsx (performance): SettingsView tab view — code moved verbatim. */
import { useState, useEffect } from "react";
import { FaWandMagicSparkles } from "react-icons/fa6";
import { loadDataKey, saveDataKey, toast, portalApi, fetchRealData } from "../lib/portalApi.js";
import { tr, defProfile, syncProfile, Card, Toggle, UI_LANG } from "../pages/Portal.jsx";

// Panel UI ships in 4 languages; the AI agent speaks 20+. (Kills the old "3 idiomas" fossil.)
const LANG_LINE = {
  en: "Panel EN·PT·ES·HI · Gui speaks 20+ languages",
  pt: "Painel EN·PT·ES·HI · Gui atende em 20+ idiomas",
  es: "Panel EN·PT·ES·HI · Gui atiende en 20+ idiomas",
  hi: "पैनल EN·PT·ES·HI · Gui 20+ भाषाओं में बात करती है",
};

function SettingsView({ V, real = null, me = null }) {
  const [toggles, setToggles] = useState({ voice: true, chat: true, reviews: true, recall: true, afterhours: true, marketing: false });
  // Connection code — the access key Luis hands out at onboarding; unlocks REAL data.
  const [dataKey, setDataKey] = useState(() => loadDataKey());
  const [keyDraft, setKeyDraft] = useState(dataKey);
  const saveKey = async () => {
    const v = keyDraft.trim();
    saveDataKey(v); // localStorage `guileo_data_key` + cloud-kv mirror
    setDataKey(v);
    window.dispatchEvent(new Event("gui:datakey")); // Portal re-fetches real data
    if (!v) { toast(tr("Connection code removed — back to demo data")); return; }
    // VALIDATE LOUDLY — a code that belongs to a different email used to fail silently
    // (the portal just kept showing demo data and the client thought Guileo was broken).
    if (me?.email) {
      toast(tr("Connection code saved — syncing your real data…"));
      const ok = await fetchRealData(me.email, v).catch(() => null);
      if (!ok) toast(tr("⚠️ This code doesn't match this email — sign in with the SAME email used at payment/signup, or double-check the code."));
    } else {
      toast(tr("Code saved — now sign in with your account e-mail to activate it."));
    }
  };
  const flip = (k) => setToggles((t) => { const v = !t[k]; toast(`${tr(LBL[k])}: ${v ? tr("On") : tr("Off")}`); return { ...t, [k]: v }; });
  const LBL = { voice: "AI voice agent", chat: "WhatsApp & SMS AI", reviews: "Auto-request reviews", recall: "Recalls & reminders", afterhours: "After-hours coverage", marketing: "Weekly marketing digest" };

  // Editable business profile → feeds the trained AI's location & hours answers.
  const [profile, setProfile] = useState(() => portalApi.loadProfile(V.label, defProfile(V)));
  const [draft, setDraft] = useState(profile);
  useEffect(() => { const p = portalApi.loadProfile(V.label, defProfile(V)); setProfile(p); setDraft(p); }, [V.label]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const saveProfile = () => {
    syncProfile(V.label, V, draft); // persist + re-sync the AI's location & hours answers
    setProfile(draft);
    toast("Business profile saved — your AI is updated ✓");
  };
  const fieldCls = "mt-1 w-full rounded-xl border border-white/15 bg-black/20 px-3.5 py-2.5 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70";
  const PROFILE_FIELDS = [["Business name", "name", "Your business name"], ["Address / location", "place", "123 Main St, City"], ["Opening hours", "hours", "Mon–Sun, 9am–10pm"], ["Public phone", "phone", "(optional)"]];
  // Real, persisted operating settings (shape the AI's behavior + when the owner gets pinged).
  const defS = { tone: "Friendly", greeting: "", on_booking: true, on_missed: true, on_review: true, daily_summary: true, quiet_enabled: false, quiet_start: "21:00", quiet_end: "08:00", after_hours_msg: "", fallback_number: "", require_approval: true, speed_to_lead: true, business_hours_only: false };
  const [st, setSt] = useState(() => ({ ...defS, ...portalApi.loadState(`${V.label}:settings`, {}) }));
  useEffect(() => { setSt({ ...defS, ...portalApi.loadState(`${V.label}:settings`, {}) }); }, [V.label]); // eslint-disable-line
  const setS = (k, v) => setSt((s) => { const n = { ...s, [k]: v }; portalApi.saveState(`${V.label}:settings`, n); return n; });
  const [payg, setPaygS] = useState(() => portalApi.loadState("gui_payg", true));
  const flipPayg = () => setPaygS((p) => { const v = !p; portalApi.saveState("gui_payg", v); window.dispatchEvent(new Event("gui:credits")); toast(v ? "Auto top-up on ✓" : "Auto top-up off"); return v; });
  return (
    <div className="space-y-4 stagger">
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Business profile")}</div>
          <span className="text-[10px] text-g-muted inline-flex items-center gap-1"><FaWandMagicSparkles size={9} className="text-g-green" /> {tr("feeds your AI's answers")}</span>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {PROFILE_FIELDS.map(([label, k, ph]) => (
            <label key={k} className="block px-5 py-3"><span className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{tr(label)}</span>
              <input value={draft[k] || ""} onChange={set(k)} placeholder={ph} className={fieldCls} /></label>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between gap-3">
          <span className="text-[11px] text-g-muted">{dirty ? tr("Unsaved changes") : tr("Your AI uses these facts when customers ask.")}</span>
          <button onClick={saveProfile} disabled={!dirty} className="btn-bright text-sm disabled:opacity-40 disabled:cursor-not-allowed">{tr("Save & update AI")}</button>
        </div>
      </Card>

      {/* CONNECTION CODE — unlocks the client's real backend data in this dashboard */}
      <Card className={`p-0 overflow-hidden ${real ? "border-g-green/30" : ""}`}>
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Connection code")}</span>
          {real && <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-g-green"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span>}
        </div>
        <div className="px-5 py-4">
          <p className="text-[11px] text-g-muted">{tr("Paste the code your Guileo team sent you — it unlocks your business's real data in this dashboard.")}</p>
          {!real && <a href="/go-live" className="inline-flex items-center gap-1 text-[11px] font-bold text-g-light hover:text-g-word transition mt-1.5">🚀 {tr("Don't have a code? Activate Gui →")}</a>}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <input value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveKey()}
              placeholder="GUI-XXXX-XXXX" aria-label={tr("Connection code")} autoComplete="off" spellCheck={false}
              className="flex-1 min-w-[180px] rounded-xl border border-white/15 bg-black/20 px-3.5 py-2.5 text-sm font-mono text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
            <button onClick={saveKey} disabled={keyDraft.trim() === dataKey} className="btn-bright text-sm disabled:opacity-40 disabled:cursor-not-allowed">{tr("Save code")}</button>
            {dataKey && <button onClick={() => { setKeyDraft(""); saveDataKey(""); setDataKey(""); window.dispatchEvent(new Event("gui:datakey")); toast(tr("Connection code removed — back to demo data")); }} className="text-[11px] font-bold text-g-muted hover:text-red-400 transition">{tr("Remove")}</button>}
          </div>
          <p className={`mt-2 text-[11px] ${real ? "text-g-green" : "text-g-muted"}`}>
            {real
              ? tr("Connected — showing your business's real data ✓")
              : dataKey
                ? (me?.email && !me?.demo ? tr("Code saved — no data matched yet. Check the code with your Guileo team.") : tr("Sign in with your account e-mail to activate it."))
                : null}
          </p>
        </div>
      </Card>

      {/* GROWTH — client-facing outreach preferences (persisted to profile; backend reads them later) */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">⚡ {tr("Growth")}</div>
        <p className="px-5 pt-3 text-[11px] text-g-muted">{tr("Tune how Gui reaches out — saved to your profile, applied across every channel.")}</p>
        <div className="mt-1 divide-y divide-white/[0.06]">
          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="pr-3"><div className="text-sm text-g-word font-semibold">⚡ {tr("Speed-to-Lead")}</div><div className="text-[11px] text-g-muted">{tr("Call new leads in 60s")}</div></div>
            <Toggle on={st.speed_to_lead !== false} onClick={() => { const v = st.speed_to_lead === false; setS("speed_to_lead", v); try { localStorage.setItem("guileo_speed_to_lead", v ? "1" : "0"); } catch { /* private */ } toast(tr("Saved ✓")); }} />
          </div>
          <div className="flex items-center justify-between px-5 py-3.5">
            <div className="pr-3"><div className="text-sm text-g-word font-semibold">🌙 {tr("Business hours only")}</div><div className="text-[11px] text-g-muted">{tr("Don't let Gui call or message at 2am.")}</div></div>
            <Toggle on={!!st.business_hours_only} onClick={() => { const v = !st.business_hours_only; setS("business_hours_only", v); toast(tr("Saved ✓")); }} />
          </div>
        </div>
      </Card>

      {/* AI behavior — tone + custom greeting shape every customer interaction */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("AI voice & greeting")}</div>
        <div className="divide-y divide-white/[0.06]">
          <label className="block px-5 py-3"><span className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{tr("Tone")}</span>
            <select value={st.tone} onChange={(e) => setS("tone", e.target.value)} className={fieldCls}>{["Friendly", "Professional", "Warm & casual", "Concise", "Enthusiastic"].map((o) => <option key={o} value={o}>{tr(o)}</option>)}</select></label>
          <label className="block px-5 py-3"><span className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{tr("Custom greeting")}</span>
            <textarea value={st.greeting} onChange={(e) => setS("greeting", e.target.value)} placeholder={`e.g. "Hi! Thanks for contacting ${draft.name || V.business.name} 👋 How can I help?"`} rows={2} className={fieldCls} /></label>
          <div className="flex items-center justify-between px-5 py-3.5"><div><div className="text-sm text-g-word font-semibold">{tr("Hand off to a human on request")}</div><div className="text-[11px] text-g-muted">{tr("When a customer asks for a person, the AI alerts your team.")}</div></div><Toggle on={st.human_handoff !== false} onClick={() => setS("human_handoff", st.human_handoff === false)} /></div>
          <div className="flex items-center justify-between px-5 py-3.5"><div className="pr-3"><div className="text-sm text-g-word font-semibold">{tr("Approve before Gui sends money or customer messages")}</div><div className="text-[11px] text-g-muted">{tr("Invoices, charges, deliveries, social posts and campaigns wait for your one-tap OK. Answers and navigation stay instant.")}</div></div><Toggle on={st.require_approval !== false} onClick={() => setS("require_approval", st.require_approval === false)} /></div>
        </div>
        <div className="px-5 py-2.5 border-t border-white/10 text-[11px] text-g-green">{tr("Saved automatically · your AI uses this on every channel ✓")}</div>
      </Card>

      {/* Notifications & billing — when the owner gets pinged + auto top-up (revenue safety) */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Notifications & billing")}</div>
        <div className="divide-y divide-white/[0.06]">
          {[["on_booking", "New booking or order"], ["on_missed", "Missed call or lead"], ["on_review", "New review"], ["daily_summary", "Daily summary from Gui"]].map(([k, label]) => (
            <div key={k} className="flex items-center justify-between px-5 py-3.5"><span className="text-sm text-g-word font-semibold">{tr(label)}</span><Toggle on={st[k] !== false} onClick={() => setS(k, st[k] === false)} /></div>
          ))}
          <div className="flex items-center justify-between px-5 py-3.5"><div><div className="text-sm text-g-word font-semibold">{tr("Auto top-up Gui credits")}</div><div className="text-[11px] text-g-muted">{tr("Never let the AI pause mid-task — refill when low (pay-as-you-go).")}</div></div><Toggle on={payg} onClick={flipPayg} /></div>
          <div className="flex items-center justify-between px-5 py-3.5"><div className="flex items-center gap-3"><span className="text-sm text-g-word font-semibold">{tr("Quiet hours")}</span></div><Toggle on={!!st.quiet_enabled} onClick={() => setS("quiet_enabled", !st.quiet_enabled)} /></div>
          {st.quiet_enabled && (
            <div className="flex items-center gap-3 px-5 py-3">
              <label className="flex-1"><span className="text-[10px] uppercase tracking-wide text-g-muted">From</span><input type="time" value={st.quiet_start} onChange={(e) => setS("quiet_start", e.target.value)} className={fieldCls} /></label>
              <label className="flex-1"><span className="text-[10px] uppercase tracking-wide text-g-muted">To</span><input type="time" value={st.quiet_end} onChange={(e) => setS("quiet_end", e.target.value)} className={fieldCls} /></label>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Account")}</div>
        <div className="divide-y divide-white/[0.06]">
          {[["Plan", real ? ({ starter: "Essential", growth: "Personalized", scale: "Full Operation" }[real.plan] || real.plan || "—") : (V.plan?.label || "Growth Plan")], ["Languages", LANG_LINE[UI_LANG] || LANG_LINE.en], ["Timezone", "Local"]].map(([k, v], i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3.5"><span className="text-sm text-g-muted">{k}</span><span className="text-sm font-bold text-g-word text-right">{v}</span></div>
          ))}
        </div>
      </Card>
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("What your AI handles")}</div>
        <div className="divide-y divide-white/[0.06]">
          {Object.keys(LBL).map((k) => (
            <div key={k} className="flex items-center justify-between px-5 py-3.5"><span className="text-sm text-g-word font-semibold">{tr(LBL[k])}</span><Toggle on={toggles[k]} onClick={() => flip(k)} /></div>
          ))}
        </div>
      </Card>
      {/* sample-only: fabricated connections/webhooks must never render for a real client */}
      {!real && (
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Integrations & webhooks")}</div>
        <div className="divide-y divide-white/[0.06]">
          {[["📅 Calendar (Google/Apple)", "Connected"], ["💳 Stripe payments", "Connected"], ["🍔 POS / orders", "Connected"], ["📣 Meta & Google Ads", "Connected"], ["🛵 Delivery platforms", "Connected"]].map(([name, st]) => (
            <div key={name} className="flex items-center justify-between px-5 py-3"><span className="text-sm text-g-word font-semibold">{name}</span><span className="text-[10px] font-black uppercase text-g-green inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{st}</span></div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-white/10">
          <div className="text-[10px] font-black uppercase tracking-wide text-g-muted mb-2">{tr("Live webhook events")}</div>
          <div className="space-y-1.5 font-mono text-[10px] text-g-muted">
            {[["order.created", "→ POS · just now"], ["booking.confirmed", "→ Calendar · 2m"], ["payment.succeeded", "→ Stripe · 6m"], ["review.received", "→ Reputation · 11m"]].map(([ev, meta]) => (
              <div key={ev} className="flex items-center gap-2"><span className="text-g-green">●</span><span className="text-g-word">{ev}</span><span className="flex-1" /><span>{meta}</span></div>
            ))}
          </div>
        </div>
      </Card>
      )}
      {!real && (
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="text-sm font-bold text-g-word">{tr("Demo data")}</div><div className="text-[11px] text-g-muted">{tr("Reset resolved alerts, won deals, filled slots & read flags back to the sample state.")}</div></div>
        <button onClick={() => { ["alerts", "fups", "wait", "notifsRead", "created:liveorders", "created:schedule", "created:deliveries", "created:campaigns", "created:impact", "created:audiences", "created:reviewreq", "created:payments", "created:team", "created:locations", "created:giftcards", "integrations", "owndelivery", "loyalty", "goal"].forEach((k) => { try { localStorage.removeItem(`guileo_state_${V.label}:${k}`); } catch { /* ignore */ } }); toast("Demo data reset — reloading…"); setTimeout(() => location.reload(), 600); }} className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-g-muted hover:text-g-word hover:border-g-gold/40 transition shrink-0">{tr("↻ Reset demo data")}</button>
      </Card>
      )}
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="text-sm font-bold text-g-word">{tr("Product tour")}</div><div className="text-[11px] text-g-muted">{tr("Replay the guided walkthrough of your cockpit from the top.")}</div></div>
        <button onClick={() => { ["guileo_tour_done", "guileo_firstvalue_done"].forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } }); toast(tr("Restarting the tour…")); setTimeout(() => location.reload(), 500); }} className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-g-muted hover:text-g-word hover:border-g-gold/40 transition shrink-0">{tr("↻ Re-take the tour")}</button>
      </Card>
      <p className="text-center text-[11px] text-g-muted">{tr("Changes apply instantly. Need something custom? Your team's a tap away. 💬")}</p>
    </div>
  );
}

export default SettingsView;
