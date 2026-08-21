/* Split out of Portal.jsx (performance): Billing tab view — code moved verbatim. */
import { useState, useEffect } from "react";
import { FaGift, FaCircleCheck, FaDownload } from "react-icons/fa6";
import { loadDataKey, toast, portalApi } from "../lib/portalApi.js";
import { waLink } from "../data/contact.js";
import { SELF_SERVE_PLANS, TOPUPS } from "../data/selfServePlans.js";
import { tr, vnum, Card, GuiMark, Toggle, usageByDay, UI_LANG } from "../pages/Portal.jsx";

// Infer the client's current self-serve plan from its label (real.plan / demo label) or,
// failing that, by matching the plan's monthly credits. Returns the index in
// SELF_SERVE_PLANS, or -1 when it can't be inferred (→ UI shows all plans).
export function inferPlanIndex(planLabel, planCredits) {
  const lower = String(planLabel || "").toLowerCase();
  let i = SELF_SERVE_PLANS.findIndex((p) => lower.includes(p.id) || lower.includes(p.name.toLowerCase()));
  if (i < 0) i = SELF_SERVE_PLANS.findIndex((p) => Number(planCredits) === p.credits);
  return i;
}

// Referral slug = the client's email base64url-encoded (raw email never appears in the URL);
// server-side reverse (db/referrals.sql _ref_decode_email) attributes the free month back to
// this exact tenant. SAME contract as src/portal/Grow.jsx b64url() — keep them identical.
const b64url = (s) => { try { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); } catch { return ""; } };

// Plan tiers — the upgrade ladder (display + entitlement basis; real charge = Stripe at launch).
const PLANS = [
  { key: "starter", name: "Essential", price: 149, credits: 500, current: false, features: ["AI on 1 channel", "Bookings & reviews", "500 Gui credits / mo", "Email support"], featuresPt: ["IA em 1 canal", "Agendamentos e avaliações", "500 créditos do Gui / mês", "Suporte por e-mail"], featuresEs: ["IA en 1 canal", "Reservas y reseñas", "500 créditos de Gui / mes", "Soporte por correo"] },
  { key: "growth", name: "Personalized", price: 897, credits: 3000, current: true, features: ["AI on all channels", "Full integrations stack", "3,000 Gui credits / mo", "Automations + radar", "A human managing it"], featuresPt: ["IA em todos os canais", "Stack de integrações completo", "3.000 créditos do Gui / mês", "Automações + radar", "Um humano cuidando"], featuresEs: ["IA en todos los canales", "Stack de integraciones completo", "3.000 créditos de Gui / mes", "Automatizaciones + radar", "Una persona gestionándolo"] },
  { key: "scale", name: "Full Operation", price: 1997, credits: 9000, current: false, features: ["Everything in Personalized", "Multi-location", "9,000 Gui credits / mo", "Priority + phone support", "Custom integrations"], featuresPt: ["Tudo do Personalized", "Multi-unidade", "9.000 créditos do Gui / mês", "Suporte prioritário + telefone", "Integrações sob medida"], featuresEs: ["Todo lo de Personalized", "Multi-sucursal", "9.000 créditos de Gui / mes", "Soporte prioritario + teléfono", "Integraciones a medida"] },
];
function Billing({ V, real = null, onNav = () => {}, email = "" }) {
  // Stripe Billing Portal — for a REAL connected client, open Stripe's hosted portal so they
  // can manage their subscription in-app. Demo mode keeps the WhatsApp upgrade links untouched.
  const [portalBusy, setPortalBusy] = useState(false);
  const openBillingPortal = async () => {
    const key = loadDataKey();
    const mail = (email || "").toString().trim().toLowerCase();
    if (!mail || !key) { toast(tr("Couldn't open billing — contact us on WhatsApp and we'll sort it.")); window.open(waLink("I'd like to manage my Guileo subscription"), "_blank", "noopener"); return; }
    setPortalBusy(true);
    try {
      const r = await fetch("/api/billing-portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: mail, key }) });
      const data = await r.json().catch(() => ({}));
      if (data && data.ok && data.url) { window.open(data.url, "_blank", "noopener"); return; }
      if (data && data.reason === "no_customer") { toast(tr("No subscription on file yet — contact us on WhatsApp to manage your plan.")); window.open(waLink("I'd like to manage my Guileo subscription"), "_blank", "noopener"); return; }
      toast(tr("Couldn't open billing — contact us on WhatsApp and we'll sort it.")); window.open(waLink("I'd like to manage my Guileo subscription"), "_blank", "noopener");
    } catch {
      toast(tr("Couldn't open billing — contact us on WhatsApp and we'll sort it.")); window.open(waLink("I'd like to manage my Guileo subscription"), "_blank", "noopener");
    } finally { setPortalBusy(false); }
  };
  // ── Churn / offboarding flow state — capture the intent, offer rescue, export data.
  // The ACTUAL cancellation stays in Stripe's own portal (openBillingPortal above).
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const [exporting, setExporting] = useState(false);
  const [surveySent, setSurveySent] = useState("");
  // Fire-and-forget: log the churn intent server-side (LOUD client_event + owner email).
  // Best-effort and once per reason — never blocks the client's flow. Demo mode: no call.
  const sendChurnSurvey = (reason, note = "") => {
    if (!real) return;
    const key = loadDataKey();
    const mail = (email || "").toString().trim().toLowerCase();
    if (!mail || !key || surveySent === reason) return;
    setSurveySent(reason);
    fetch("/api/offboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: mail, key, action: "survey", reason, note }) }).catch(() => { /* capture is best-effort */ });
  };
  // Data-export right: download the client's OWN data (events + profile) as a JSON file.
  const exportMyData = async () => {
    const key = loadDataKey();
    const mail = (email || "").toString().trim().toLowerCase();
    if (!real || !mail || !key) { toast(tr("Export failed — message us on WhatsApp and we'll send it.")); window.open(waLink("I'd like an export of my Guileo data"), "_blank", "noopener"); return; }
    setExporting(true);
    try {
      const r = await fetch("/api/offboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: mail, key, action: "export" }) });
      if (!r.ok) throw new Error("export failed");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "guileo-data-export.json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast(tr("Data exported ✓ — it's yours."));
    } catch {
      toast(tr("Export failed — message us on WhatsApp and we'll send it."));
    } finally { setExporting(false); }
  };
  const plan = V.plan || { label: "Growth Plan", used: 1, total: 2000, unit: "Actions this month" };
  const pct = plan.total ? Math.round((plan.used / plan.total) * 100) : 0;
  const includes = ["AI voice agent · 24/7", "WhatsApp, SMS & social replies", "Bookings & reviews automation", "Live dashboard & monthly reports", "A real human managing it for you"];
  const invoices = [["Invoice #0012", "Jun 1, 2026", "Paid"], ["Invoice #0011", "May 1, 2026", "Paid"], ["Invoice #0010", "Apr 1, 2026", "Paid"]];
  // Gui AI credits — same gui_credits store the assistant + its meter read, so they never disagree.
  const [credits, setCredits] = useState(() => portalApi.loadState("gui_credits", 250));
  const [payg, setPayg] = useState(() => portalApi.loadState("gui_payg", true));
  useEffect(() => { const h = () => setCredits(portalApi.loadState("gui_credits", 250)); window.addEventListener("gui:credits", h); return () => window.removeEventListener("gui:credits", h); }, []);
  // REAL value Gui recovered this month — same /api/growth-intel money_proof the Overview hero reads.
  // Powers the honest "return on credits" multiplier below, and doubles as the real usage signal for
  // the upsell when the plan label can't be inferred. Real mode ONLY (demo/no-key never fetches, so
  // it stays zeroed → no multiplier, no fabricated value). Best-effort: any 401/error → stays empty.
  const [mp, setMp] = useState({ collectedUsd: 0, estimatedUsd: 0, bookings: 0, ready: false });
  useEffect(() => {
    const key = loadDataKey();
    const mail = (email || "").toString().trim().toLowerCase();
    if (!mail || !mail.includes("@") || !key) { setMp({ collectedUsd: 0, estimatedUsd: 0, bookings: 0, ready: false }); return; } // demo / not a real client → never fetch, stays empty
    let alive = true;
    fetch("/api/growth-intel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "money_proof", email: mail, token: key }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d || d.ok !== true) return; // 401/error → stay empty, never fabricate
        const p = d.proof || {}, rl = d.real || {};
        setMp({
          collectedUsd: rl.collected_cents ? Math.max(0, Math.round((p.collected_cents || 0) / 100)) : 0,
          estimatedUsd: rl.estimated ? Math.max(0, Math.round((p.estimated_value_cents || 0) / 100)) : 0,
          bookings: rl.bookings ? (p.bookings || 0) : 0,
          ready: !!d.ready,
        });
      })
      .catch(() => { /* transient error → stays empty, never fabricated */ });
    return () => { alive = false; };
  }, [email]);
  const setC = (n) => { setCredits(n); portalApi.saveState("gui_credits", n); window.dispatchEvent(new Event("gui:credits")); };
  const topUp = (n) => { setC(credits + n); toast(`${n} credits added ✓ — ${payg ? "billed to your account (pay-as-you-go)" : "added to your plan"}`); };
  const usedThisMonth = vnum(V.label, "guiused", 60, 320);
  // REAL MODE — balance + plan come straight from the backend; demo numbers step aside.
  const shownCredits = real && Number.isFinite(Number(real.credits)) ? Number(real.credits) : credits;
  const shownPlan = real?.plan || plan.label;
  // Infer the client's real plan (by label) so every meter/percentage below is derived
  // from the real plan's monthly credits — NEVER a fabricated 500/2000/pct in real mode.
  // Demo mode keeps its rich fixed numbers. In real mode: match by label only (the balance
  // is NOT the plan size, so we don't feed it to the matcher as a credits hint).
  const planIdx = inferPlanIndex(shownPlan, real ? undefined : plan.total);
  const shownPlanCredits = planIdx >= 0 ? SELF_SERVE_PLANS[planIdx].credits : null;
  // meter denominator: real → the inferred plan's monthly credits; demo → its rich 500.
  // real + un-inferable plan → no honest denominator, so no proportional bar (null).
  const meterDenom = real ? shownPlanCredits : 500;
  const cpct = meterDenom ? Math.max(2, Math.min(100, Math.round((shownCredits / meterDenom) * 100))) : null;
  const low = shownCredits < 50;
  // Real usage % of the plan (credits consumed). null when un-inferable → we never show a fake %.
  const usedPct = real
    ? (shownPlanCredits ? Math.max(0, Math.min(100, Math.round((1 - shownCredits / shownPlanCredits) * 100))) : null)
    : pct;
  // Which plan tier is the client actually on (real) — drives the "Current" badge honestly.
  const currentPlanId = real ? (planIdx >= 0 ? SELF_SERVE_PLANS[planIdx].id : null) : "growth";
  // Ele JÁ ASSINA quando estamos em modo real E deu para identificar o plano dele. Fora disso
  // (demo, ou plano não inferível) o caminho seguro é o link de pagamento — mandar alguém sem
  // assinatura para o portal da Stripe só produz o beco "no_customer".
  // ⚠️ `real` sozinho não basta: cliente real com plano não identificado não pode ser tratado
  // como assinante, senão o botão vira uma porta que não abre.
  const jaAssina = !!(real && currentPlanId);
  // ── #18 Return on your Gui credits — a REAL multiplier, or nothing at all (never a fake "—").
  // value = money Gui actually collected this month (preferred) or its benchmarked estimate; both
  // come from money_proof (real). spend = credits consumed × the client's own plan rate — which
  // needs a KNOWN plan size (planIdx ≥ 0), else spend is unknowable and the card hides honestly.
  const moneyValueUsd = mp.collectedUsd || mp.estimatedUsd || 0;
  const moneyIsEstimate = !mp.collectedUsd && mp.estimatedUsd > 0;
  const strongRealValue = !!real && moneyValueUsd > 0; // real usage signal that survives an un-inferable plan
  const creditsUsed = real && planIdx >= 0 && shownPlanCredits ? Math.max(0, shownPlanCredits - shownCredits) : null;
  const costPerCredit = planIdx >= 0 ? SELF_SERVE_PLANS[planIdx].price / SELF_SERVE_PLANS[planIdx].credits : null;
  const spendUsd = creditsUsed != null && costPerCredit != null ? creditsUsed * costPerCredit : null;
  // Show only on real, meaningful spend (≥25 credits, ≥$1) AND real recovered value — else null → hidden.
  const roi = real && spendUsd != null && spendUsd >= 1 && creditsUsed >= 25 && moneyValueUsd > 0
    ? Math.round((moneyValueUsd / spendUsd) * 10) / 10
    : null;
  return (
    <div className="space-y-4 stagger">
      <div className="grid lg:grid-cols-3 gap-4">
        <Card tone="gold" className="lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div><div className="text-xs font-bold uppercase tracking-wide text-g-gold flex items-center gap-2">{tr("Current plan")}{real && <span className="inline-flex items-center gap-1 text-[9px] font-black text-g-green normal-case"><span className="h-1 w-1 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span>}</div><div className="text-xl font-extrabold text-g-gold gold-glow mt-1">{shownPlan}</div></div>
            <div className="flex items-center gap-2">
              {real && <button onClick={openBillingPortal} disabled={portalBusy} className="btn-bright text-sm disabled:opacity-60">{portalBusy ? tr("Opening…") : tr("Manage subscription")}</button>}
              <a href={waLink("I'd like to upgrade my Guileo plan")} target="_blank" rel="noopener" className={real ? "btn-ghost text-sm" : "btn-bright text-sm"}>{tr("Upgrade →")}</a>
            </div>
          </div>
          {real
            ? (
              // Real: the fabricated "Actions this month" meter would be fake — the live
              // Gui-credits meter card below is the real usage bar. Show only the honest
              // credits-left line here (bar only when the plan size is known).
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1"><span className="text-g-muted">{tr("Gui credits left")}</span><span className="text-g-word font-bold num">{shownCredits.toLocaleString()}{shownPlanCredits ? ` / ${shownPlanCredits.toLocaleString()}` : ""}</span></div>
                {cpct != null && <div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className={`h-full rounded-full ${low ? "bg-red-500" : "bg-gradient-to-r from-g-green to-g-gold"}`} style={{ width: `${cpct}%` }} /></div>}
              </div>
            )
            : <div className="mt-4"><div className="flex justify-between text-xs mb-1"><span className="text-g-muted">{plan.unit}</span><span className="text-g-word font-bold">{plan.used} / {plan.total.toLocaleString()}</span></div><div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-g-green to-g-gold" style={{ width: `${Math.max(2, pct)}%` }} /></div></div>}
        </Card>
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-2">{tr("What's included")}</div>
          <ul className="space-y-1.5 text-xs text-g-word">{includes.map((x, i) => <li key={i} className="flex gap-2"><span className="text-g-green">✓</span>{x}</li>)}</ul>
        </Card>
      </div>

      {/* Gui AI credits — the assistant's pay-as-you-go meter, managed here */}
      <Card tone="gold" className="border-g-gold/25 bg-gradient-to-br from-g-gold/[0.07] to-transparent">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <GuiMark size={40} />
            <div><div className="text-sm font-extrabold text-g-word">{tr("Gui — AI assistant credits")}</div><div className="text-xs text-g-muted mt-0.5">{tr("Powers every task Gui runs for you · ~5 credits per action")}</div></div>
          </div>
          <div className="text-right"><div className={`text-2xl font-extrabold num ${low ? "text-red-400" : "text-g-gold gold-glow"}`}>{shownCredits.toLocaleString()}</div><div className="text-[10px] uppercase tracking-wide text-g-muted inline-flex items-center gap-1">{real && <span className="h-1 w-1 rounded-full bg-g-green live-dot animate-pulse" />}{tr("credits left")}</div></div>
        </div>
        {cpct != null && <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden"><div className={`h-full rounded-full ${low ? "bg-red-500" : "bg-gradient-to-r from-g-green to-g-gold"}`} style={{ width: `${cpct}%` }} /></div>}
        <div className={`mt-3 grid sm:grid-cols-3 gap-2 ${real ? "hidden" : ""}`}>
          {[["+250", 250, "$9"], ["+500", 500, "$16"], ["+1,200", 1200, "$32"]].map(([label, n, price]) => (
            <button key={n} onClick={() => topUp(n)} className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-center hover:border-g-green/50 hover:bg-white/[0.07] transition">
              <div className="text-sm font-extrabold text-g-word">{label} <span className="text-g-muted font-normal">{tr("credits")}</span></div>
              <div className="text-[10px] text-g-gold font-bold">{price}</div>
            </button>
          ))}
        </div>
        {real && TOPUPS[0]?.url && <a href={TOPUPS[0].url} target="_blank" rel="noopener" className="mt-3 inline-flex btn-bright text-sm">{tr("I'll recharge my meter →")}</a>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          {!real && <div className="flex items-center gap-2"><Toggle on={payg} onClick={() => { const v = !payg; setPayg(v); portalApi.saveState("gui_payg", v); toast(v ? "Pay-as-you-go on — auto-top-up when low" : "Pay-as-you-go off — Gui pauses when out of credits"); }} /><span className="text-g-muted">{tr("Auto top-up (pay-as-you-go)")}</span></div>}
          {!real && <span className="text-g-muted">{usedThisMonth} {tr("credits used this month")}</span>}
        </div>
        <p className="mt-2 text-[10px] text-g-muted">{tr("Top-ups are billed securely to your account on file — we never ask for card details in chat.")}</p>
      </Card>

      {/* 📈 Return on your Gui credits — REAL multiplier only (money_proof value ÷ what the used
          credits cost at the client's own plan rate). Hidden entirely when any input is missing —
          never a fabricated "—" or a guessed number. Real mode only. */}
      {roi != null && (
        <Card className="border-g-green/25 bg-gradient-to-br from-g-green/[0.08] to-transparent">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold uppercase tracking-wide text-g-gold flex items-center gap-2">{tr("Return on your Gui credits")}<span className="inline-flex items-center gap-1 text-[9px] font-black text-g-green normal-case"><span className="h-1 w-1 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span></div>
              <div className="text-sm text-g-word mt-1">{tr("Every $1 in Gui credits you spent brought back about")} <span className="text-g-green font-bold num">${roi.toFixed(2)}</span>{moneyIsEstimate && <span className="text-[10px] uppercase tracking-wide text-g-muted"> · {tr("estimated")}</span>}.</div>
            </div>
            <div className="text-right shrink-0"><div className="text-3xl font-black text-g-green money-glow num">{roi.toFixed(1)}×</div><div className="text-[10px] uppercase tracking-wide text-g-muted">{tr("return on credits")}</div></div>
          </div>
        </Card>
      )}

      {/* ⚡ One-click plan upgrade — the NEXT plan up with its LIVE Stripe payment link.
          Always visible (subtle); turns loud when usage is high (≥80%). Payment auto-provisions
          via the webhook, so the link IS the upgrade. Demo mode: link goes to /planos. */}
      {(() => {
        const curIdx = planIdx;
        const nextPlan = curIdx >= 0 ? SELF_SERVE_PLANS[curIdx + 1] || null : null;
        // #17 — un-inferable custom plan (curIdx < 0): DON'T dump every plan. Essential ($149) would
        // be a downgrade dressed up as an "upgrade", and the usage-based framing would silently
        // vanish. Instead default the path to the tier above the entry plan (Personalized) and up.
        // We still NEVER claim the client's current plan (currentPlanId stays null → no fake badge).
        const fallbackOptions = SELF_SERVE_PLANS.slice(1); // Personalized + Full Operation
        const options = curIdx >= 0 ? (nextPlan ? [nextPlan] : []) : fallbackOptions;
        if (options.length === 0) return null; // already on the top plan — nothing to upsell
        // The plan the "you're growing" framing points at: the real next plan, or (un-inferable) the
        // sensible entry-up default. Never presented AS the client's current plan.
        const upsellTarget = nextPlan || (curIdx < 0 ? fallbackOptions[0] : null);
        // "hot" from REAL usage in real mode (never a fabricated %); low balance is itself hot.
        const hot = (usedPct != null && usedPct >= 80) || (real && low);
        // WINNING trigger — the client is clearly getting value (not distress). Honest real signals
        // only: when the plan IS inferable, heavy use of ANY plan (≥50%) or an entry (starter) client
        // already active (≥30%); when the plan CAN'T be inferred (usedPct null), fall back to the real
        // money_proof value Gui recovered this month (strongRealValue) — still 100% real, never a
        // guessed plan/%. Distress ("hot") always wins the framing.
        const winning = real && !hot && !!upsellTarget && (
          (usedPct != null && (usedPct >= 50 || (currentPlanId === "starter" && usedPct >= 30))) ||
          (usedPct == null && strongRealValue)
        );
        // Carry the SAME prefilled_email param the other upgrade CTAs use (PricingTiers.jsx /
        // Planos.jsx) so Stripe checkout is pre-filled to THIS client → the webhook credits the
        // right tenant. Only when a real session email exists; never mutate the /planos fallback.
        const withEmail = (u) => { const em = (email || "").toString().trim(); return em ? `${u}${u.includes("?") ? "&" : "?"}prefilled_email=${encodeURIComponent(em)}` : u; };
        const linkFor = (p) => (real && p.url ? withEmail(p.url) : "/planos");
        return (
          <Card className={hot ? "border-g-gold/50 bg-g-gold/[0.08]" : winning ? "border-g-green/40 bg-g-green/[0.06]" : "border-white/10"}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={`text-xs font-bold uppercase tracking-wide ${winning ? "text-g-green" : "text-g-gold"}`}>{winning ? "📈" : "⚡"} {tr("Upgrade")}</div>
                <div className="text-sm font-extrabold text-g-word mt-1">{hot ? tr("You're close to your plan limit — upgrade in one click") : winning ? <>{tr("You're growing — move to")} {upsellTarget.name} {tr("for more Gui")}</> : tr("Need more volume? The next plan up is one click away")}</div>
              </div>
              {(hot || winning) && usedPct != null && <span className={`text-[10px] font-black uppercase tracking-wide rounded-full px-2 py-0.5 shrink-0 ${hot ? "bg-g-gold text-black" : "bg-g-green text-black"}`}>{usedPct}%</span>}
            </div>
            <div className={`mt-3 grid gap-2 ${options.length > 1 ? "sm:grid-cols-3" : ""}`}>
              {options.map((p) => (
                <div key={p.id} className="rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[120px]">
                    <div className="text-sm font-extrabold text-g-word">{p.name}</div>
                    <div className="text-[11px] text-g-muted"><span className="text-g-gold font-bold num">${p.price}</span>/{tr("mo")} · {p.credits.toLocaleString()} {tr("credits / month")}</div>
                    {/* annual option — only when its Payment Link actually exists (no fake promises) */}
                    {p.annualUrl && <a href={real ? withEmail(p.annualUrl) : "/planos"} target={real ? "_blank" : "_self"} rel="noopener" className="text-[10px] font-bold text-g-gold underline decoration-g-gold/40 underline-offset-2 hover:text-g-word transition">{tr("annual (2 months free)")}</a>}
                  </div>
                  {/* 🚨 ASSINATURA DUPLA (auditoria 2026-08-20). "Upgrade now" abria um Payment Link
                      NOVO sem cancelar nem fazer proporcional: o cliente passava a pagar OS DOIS
                      planos no mesmo mês, e o texto abaixo só falava dos créditos somados. Quem já
                      assina vai para o portal da Stripe — que é exatamente onde a troca de plano com
                      proporcional é feita, e que este arquivo JÁ sabe abrir (openBillingPortal).
                      Link de pagamento novo só para quem ainda NÃO tem assinatura. */}
                  {jaAssina ? (
                    <button type="button" onClick={openBillingPortal} disabled={portalBusy}
                      className="btn-bright text-sm shrink-0 disabled:opacity-60">
                      {portalBusy ? tr("Opening…") : tr("Switch to this plan →")}
                    </button>
                  ) : (
                    <a href={linkFor(p)} target={real && p.url ? "_blank" : "_self"} rel="noopener" className="btn-bright text-sm shrink-0">{tr("Upgrade now →")}</a>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-g-muted">
              {jaAssina
                ? tr("Switching opens your billing portal, where the change is prorated — you're never charged for two plans at once. Your credit balance carries over.")
                : tr("Upgrade activates instantly — the new plan's credits are added on top of your current balance as soon as the payment lands.")}
            </p>
          </Card>
        );
      })()}

      {/* 🔋 Quick top-up — one-time credit recharges (mode=payment Stripe links minted by
          /api/setup-selfserve, pasted into selfServePlans.js TOPUPS). Empty url → the option
          shows grayed as "available soon" so nothing fake ships. Demo mode → /planos. */}
      <Card className="border-white/10">
        <div className="text-xs font-bold uppercase tracking-wide text-g-gold">🔋 {tr("Quick top-up")}</div>
        <div className="text-sm font-extrabold text-g-word mt-1">{tr("One-off credits, no plan change — they're added the moment payment lands.")}</div>
        <div className="mt-3 grid sm:grid-cols-2 gap-2">
          {TOPUPS.map((t) => (
            <div key={t.id} className={`rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 flex flex-wrap items-center gap-3 ${real && !t.url ? "opacity-60" : ""}`}>
              <div className="flex-1 min-w-[120px]">
                <div className="text-sm font-extrabold text-g-word">+{t.credits.toLocaleString()} <span className="text-g-muted font-normal">{tr("credits")}</span></div>
                <div className="text-[11px] text-g-muted"><span className="text-g-gold font-bold num">${t.price}</span> · {tr("one-time")}</div>
              </div>
              {!real
                ? <a href="/planos" className="btn-bright text-sm shrink-0">{tr("Top up credits →")}</a>
                : t.url
                  ? <a href={t.url} target="_blank" rel="noopener" className="btn-bright text-sm shrink-0">{tr("Top up credits →")}</a>
                  : <span className="text-[11px] font-bold text-g-muted shrink-0">{tr("available soon")}</span>}
            </div>
          ))}
        </div>
      </Card>

      {/* 🤝 Paid setup-assist — closed by a human over WhatsApp; no Stripe link involved. */}
      <Card className="border-g-green/20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="text-xs font-bold uppercase tracking-wide text-g-gold">🤝 {tr("Assisted setup — $199")}</div>
            <div className="text-sm font-extrabold text-g-word mt-1">{tr("We get EVERYTHING ready in 48h — line, menu, training and a live test.")}</div>
          </div>
          <a href={waLink("Quero a configuração assistida ($199)")} target="_blank" rel="noopener" className="btn-bright text-sm shrink-0">{tr("Set it up for me →")}</a>
        </div>
      </Card>

      {/* Gui usage history — what your credits bought, by day */}
      {(() => {
        const days = usageByDay(7);
        const max = Math.max(1, ...days.map((d) => d.total));
        const weekTotal = days.reduce((s, d) => s + d.total, 0);
        const recent = portalApi.loadState("gui_usage", []).slice(0, 6);
        return (
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Gui usage · last 7 days")}</span><span className="text-[11px] text-g-muted">{weekTotal} credits this week</span></div>
            <div className="p-5">
              <div className="flex items-end gap-2 h-24">
                {days.map((d) => (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full flex items-end justify-center" style={{ height: "72px" }}>
                      <div className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-g-green to-g-gold transition-all" style={{ height: `${Math.max(4, Math.round((d.total / max) * 72))}px` }} title={`${d.total} credits`} />
                    </div>
                    <span className="text-[10px] text-g-muted">{d.label}</span>
                  </div>
                ))}
              </div>
              {recent.length > 0 ? (
                <div className="mt-4 divide-y divide-white/[0.05] border-t border-white/[0.06]">
                  {recent.map((u) => (
                    <div key={u._id} className="flex items-center gap-3 py-2"><span className="text-sm">🪄</span><div className="flex-1 min-w-0 text-xs text-g-word truncate">{u.label || "AI task"}</div><span className="text-[11px] text-g-muted shrink-0">{u.day}</span><span className="text-[11px] font-bold text-g-gold shrink-0">−{u.cost} cr</span></div>
                  ))}
                </div>
              ) : <p className="mt-3 text-[11px] text-g-muted text-center">{tr("No Gui activity yet — ask Gui to do something and it'll show up here.")}</p>}
            </div>
          </Card>
        );
      })()}

      {/* Plan tiers — the upgrade ladder */}
      <div>
        <div className="px-1 mb-2 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Plans")}</div>
        <div className="grid sm:grid-cols-3 gap-3">
          {PLANS.map((p) => {
            // Real: "Current" is the plan the client is actually on (derived from real.plan).
            // Demo: keep the showcase default (growth). Un-inferable real plan → none flagged.
            const isCur = p.key === currentPlanId;
            return (
            <Card key={p.key} className={`relative ${isCur ? "border-g-gold/50 bg-g-gold/[0.06]" : ""}`}>
              {isCur && <span className="absolute -top-2 left-4 text-[9px] font-black uppercase tracking-wide bg-g-gold text-black rounded-full px-2 py-0.5">{tr("Current")}</span>}
              <div className="text-sm font-extrabold text-g-word">{p.name}</div>
              <div className="mt-1 flex items-baseline gap-1"><span className={`text-2xl font-extrabold num ${isCur ? "text-g-gold gold-glow" : "text-g-word"}`}>${p.price}</span><span className="text-[11px] text-g-muted">/{tr("mo")}</span></div>
              <ul className="mt-3 space-y-1.5 text-[11px] text-g-word">{(UI_LANG === "es" ? p.featuresEs : UI_LANG === "pt" ? p.featuresPt : p.features).map((f, i) => <li key={i} className="flex gap-1.5"><span className="text-g-green">✓</span>{f}</li>)}</ul>
              {isCur
                ? <div className="mt-3 text-center text-[11px] font-bold text-g-muted">{tr("Your plan")}</div>
                : <a href={waLink(`I'd like the ${p.name} plan ($${p.price}/mo)`)} target="_blank" rel="noopener" className={`mt-3 block text-center text-sm ${p.price > 199 ? "btn-bright" : "btn-ghost"}`}>{p.price > 199 ? tr("Upgrade →") : tr("Switch →")}</a>}
            </Card>
            );
          })}
        </div>
      </div>

      {/* Referral credits — a CAC-reducing growth loop on the existing credit system */}
      {(() => {
        const code = `GUI-${(V.business.name || "GUILEO").replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase()}${vnum(V.label, "refcode", 100, 999)}`;
        const link = `https://guileoai.com/?ref=${code}`;
        const refs = portalApi.loadState("gui_referrals", 0);
        const grant = () => { setC(credits + 250); portalApi.saveState("gui_referrals", refs + 1); toast("250 credits added ✓ — referral reward"); };
        const copy = () => { try { navigator.clipboard.writeText(link); } catch { /* */ } toast("Invite link copied ✓"); };
        // REAL referral link — the client's own ?ref=<b64url(email)>. This is a LIVE loop, not a
        // promise: lead.js captures the ref on any friend's form, App.jsx remembers it 90 days, and
        // stripe-webhook.js converts it (referrer must be an existing tenant → both sides a month
        // free). Same link Grow.jsx already ships. No email on session → honest WhatsApp fallback.
        const refLink = email ? `https://guileoai.com?ref=${b64url(email)}` : "";
        const waRefMsg = `Conhece a Gui? É uma IA que atende meu telefone 24/7… usa meu link e a gente ganha um mês grátis: ${refLink}`;
        const copyReal = () => { try { navigator.clipboard.writeText(refLink); } catch { /* clipboard blocked → the link is visible + select-all */ } toast(tr("Invite link copied ✓")); };
        return (
          <Card className="border-g-gold/25 bg-g-gold/[0.05]">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center h-10 w-10 rounded-xl bg-g-gold/15 text-g-gold"><FaGift /></span>
              <div className="flex-1 min-w-0"><div className="text-sm font-extrabold text-g-word">{real ? tr("Invite a business — you both get a month free") : tr("Give 250, get 250 credits")}</div><div className="text-xs text-g-muted mt-0.5">{real ? tr("Share your personal link — when a friend's business joins Guileo through it, you both get one month free.") : <>{tr("Invite another business — you both get")} <span className="text-g-gold font-bold">{tr("250 free credits")}</span> {tr("when they join.")} {refs > 0 && <span className="text-g-green font-bold">{refs} {tr("joined so far.")}</span>}</>}</div></div>
            </div>
            {real
              ? (
                // Real: the personal ?ref= link is LIVE (b64url of this client's email; converted by
                // stripe-webhook.js when a referred business subscribes). Hand the client THEIR link —
                // copy + WhatsApp share. No session email → honest WhatsApp "refer a business" path.
                refLink
                  ? (
                    <div className="mt-3 flex flex-col sm:flex-row items-stretch gap-2">
                      <div className="flex-1 rounded-full border border-white/15 bg-black/25 px-4 py-2.5 text-xs text-g-light font-mono truncate select-all" title={refLink}>{refLink}</div>
                      <button onClick={copyReal} className="btn-ghost text-sm shrink-0 whitespace-nowrap">{tr("Copy link")}</button>
                      <a href={`https://wa.me/?text=${encodeURIComponent(waRefMsg)}`} target="_blank" rel="noopener" className="btn-bright text-sm shrink-0 inline-flex items-center justify-center whitespace-nowrap">📲 WhatsApp →</a>
                    </div>
                  )
                  : (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <a href={waLink("I'd like to refer another business to Guileo")} target="_blank" rel="noopener" className="btn-bright text-sm">{tr("Refer a business →")}</a>
                    </div>
                  )
              )
              : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <code className="flex-1 min-w-[140px] rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs font-mono text-g-light truncate">{link}</code>
                  <button onClick={copy} className="btn-ghost text-sm">{tr("Copy link")}</button>
                  <button onClick={grant} className="btn-bright text-sm">{tr("Simulate a referral →")}</button>
                </div>
              )}
          </Card>
        );
      })()}

      {/* Your setup progress — self-completes from live state (profile, brain, tool, code) */}
      {(() => {
        const profile = portalApi.loadProfile(V.label, {});
        const kb = portalApi.loadKB(V.label, []);
        const stack = portalApi.loadState(`${V.label}:stack`, {});
        const hasProfile = !!(profile && (profile.name || profile.business));
        const hasBrain = Array.isArray(kb) ? kb.length > 0 : !!kb;
        const hasTool = !!(stack && Object.values(stack).some(Boolean));
        const hasCode = !!loadDataKey();
        const steps = [
          [tr("Set up your business profile"), hasProfile, "settings"],
          [tr("Train your AI brain"), hasBrain, "brain"],
          [tr("Connect your first tool"), hasTool, "integrations"],
          [tr("Link your live data (connection code)"), hasCode, "settings"],
          [tr("Going live — real data flowing"), !!real, null],
        ];
        const done = steps.filter((s) => s[1]).length;
        const pct = Math.round((done / steps.length) * 100);
        return (
          <Card className="p-0 overflow-hidden border-g-gold/25">
            <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("🎯 Your setup progress")}</span>
              <span className="text-[11px] font-black text-g-green num">{done}/{steps.length}</span>
            </div>
            <div className="px-5 pt-3"><div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-g-green to-g-gold transition-all duration-500" style={{ width: `${Math.max(4, pct)}%` }} /></div></div>
            <div className="divide-y divide-white/[0.06] mt-1">
              {steps.map(([label, ok, view]) => (
                <button key={label} disabled={!view || ok} onClick={() => view && onNav(view)}
                  className={`w-full text-left flex items-center gap-3 px-5 py-3 transition ${!view || ok ? "" : "hover:bg-white/[0.04]"}`}>
                  <span className={ok ? "text-g-green" : "text-g-muted"}>{ok ? <FaCircleCheck size={15} /> : "○"}</span>
                  <span className="flex-1 text-sm font-bold text-g-word">{label}</span>
                  {!ok && view && <span className="text-[11px] font-bold text-g-gold shrink-0">{tr("Set up →")}</span>}
                </button>
              ))}
            </div>
          </Card>
        );
      })()}

      {real
        ? (
          // Real: the demo invoice list (Invoice #0012, fake download) would be fabricated.
          // Real invoices + PDFs live in the Stripe Billing Portal — reached via "Manage
          // subscription" above. Point there instead of inventing a table.
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Invoices")}</div>
            <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0"><span className="text-lg">🧾</span><span className="text-[12px] text-g-muted">{tr("Your invoices and receipts live in your billing portal.")}</span></div>
              <button onClick={openBillingPortal} disabled={portalBusy} className="btn-ghost text-sm shrink-0 disabled:opacity-60">{portalBusy ? tr("Opening…") : tr("Open billing portal →")}</button>
            </div>
          </Card>
        )
        : (
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Invoices")}</div>
            <div className="divide-y divide-white/[0.06]">
              {invoices.map(([n, d, s], i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3"><span className="text-lg">🧾</span><div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word">{n}</div><div className="text-[11px] text-g-muted">{d}</div></div><span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-g-green/15 text-g-green">{s}</span><button onClick={() => toast(`${n} downloaded ✓`)} aria-label={`Download ${n}`} className="text-g-gold hover:text-g-word transition"><FaDownload size={12} /></button></div>
              ))}
            </div>
          </Card>
        )}
      <p className="text-center text-[11px] text-g-muted">{tr("Payment is handled securely with your team — we never ask for card details in chat.")}</p>

      {/* Discreet churn / offboarding flow — exit survey → honest rescue offer → data export /
          human / proceed. The actual cancel happens in Stripe's portal (openBillingPortal);
          this flow captures the WHY, tries a save, and honors data-export rights. */}
      {(() => {
        const REASONS = [
          ["expensive", tr("Too expensive"), tr("Talk to us — there's a smaller plan that may fit better.")],
          ["unused", tr("Didn't use it"), tr("Let us set it up with you — 15 minutes and it runs by itself.")],
          ["technical", tr("Technical problems"), tr("Our team will jump on your case now — priority support.")],
          ["closed", tr("I closed the business"), tr("We'll miss you 💚 — export your data below, it's yours to keep.")],
        ];
        const picked = REASONS.find((r) => r[0] === cancelReason);
        return (
          <div className="text-center">
            {!cancelOpen ? (
              <button onClick={() => setCancelOpen(true)} className="text-[11px] text-g-muted underline decoration-white/20 underline-offset-2 hover:text-g-word transition">{tr("Need to cancel?")}</button>
            ) : (
              <Card className="text-left border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-extrabold text-g-word">{tr("Before you go — tell us why, it takes one tap:")}</div>
                  <button onClick={() => { setCancelOpen(false); setCancelReason(""); setCancelNote(""); }} aria-label="Close" className="text-g-muted hover:text-g-word transition">✕</button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {REASONS.map(([key, label]) => (
                    <button key={key} onClick={() => { setCancelReason(key); sendChurnSurvey(key, cancelNote); }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${cancelReason === key ? "border-g-gold/60 bg-g-gold/15 text-g-gold" : "border-white/15 bg-white/[0.04] text-g-word hover:border-white/25"}`}>{label}</button>
                  ))}
                </div>
                <textarea value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} rows={2} placeholder={tr("Anything else you'd like us to know? (optional)")}
                  className="mt-3 w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-xs text-g-word placeholder:text-g-muted outline-none focus:border-g-gold/40" />
                {picked && (
                  <div className="mt-3 rounded-xl border border-g-green/25 bg-g-green/[0.06] px-4 py-3 text-xs text-g-word">
                    <span className="font-extrabold text-g-green">{tr("Wait — one honest offer first:")}</span> {picked[2]}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button onClick={exportMyData} disabled={exporting} className="btn-ghost text-sm disabled:opacity-60">{exporting ? tr("Exporting…") : tr("📥 Export my data")}</button>
                  <a href={waLink("I'm thinking about canceling my Guileo plan — can we talk?")} target="_blank" rel="noopener" className="btn-bright text-sm">{tr("Talk to a human")}</a>
                  <button onClick={() => { sendChurnSurvey(cancelReason || "unspecified", cancelNote); openBillingPortal(); }} disabled={portalBusy} className="ml-auto text-[11px] text-g-muted underline decoration-white/20 underline-offset-2 hover:text-g-word transition disabled:opacity-60">{tr("Continue to cancellation →")}</button>
                </div>
              </Card>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export default Billing;
