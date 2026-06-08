import { useState } from "react";
import { waLink } from "../data/contact";
import logo from "../assets/guileo-mark.png";

// /quiz — "AI Growth Score" funnel. Industry → 5 readiness Qs → what you need →
// SCORE + monthly leak + RECOMMENDED GUILEO STACK (covers all products & services) →
// lead capture. Plus a partner path for agencies. Branded (guileoai.com aesthetic).

const INDUSTRIES = [
  { name: "Clinic / Dental", base: 5400 }, { name: "Law Firm", base: 8200 }, { name: "Real Estate", base: 9200 },
  { name: "Restaurant", base: 3500 }, { name: "E-commerce / Retail", base: 6100 }, { name: "Trades (Plumbing/HVAC)", base: 7600 },
  { name: "Gym / Fitness", base: 4200 }, { name: "Auto Dealership", base: 11000 }, { name: "Agency / Reseller", base: 0, partner: true }, { name: "Other / Services", base: 5000 },
];

const QUESTIONS = [
  { q: "When a customer calls or messages, how fast do you respond?", a: [["Instantly, 24/7", 3], ["Within an hour", 2], ["Same day", 1], ["We often miss them", 0]] },
  { q: "Do you follow up with every lead?", a: [["Always — automatically", 3], ["Usually", 2], ["Sometimes", 1], ["No real system", 0]] },
  { q: "How many channels do customers reach you on?", a: [["All in one place", 3], ["2–3, handled manually", 2], ["Several — it's chaos", 1], ["Can't keep up", 0]] },
  { q: "Hours/week spent on repetitive admin (booking, replies, follow-up)?", a: [["Under 5", 3], ["5–15", 2], ["15–30", 1], ["30+", 0]] },
  { q: "Is your marketing bringing leads consistently?", a: [["Yes — systemized", 3], ["On and off", 2], ["Rarely", 1], ["Not really", 0]] },
];

// what you want Guileo to handle → recommended products/services (covers the full catalog)
const NEEDS = [
  { label: "📞 Answer every call & message", recs: ["🎙️ Voice AI", "💬 Text & WhatsApp AI"] },
  { label: "📅 Booking & scheduling", recs: ["📅 Booking system"] },
  { label: "🔄 Never lose a lead (follow-up)", recs: ["🔄 Automations", "📊 Dashboards & CRM"] },
  { label: "🌐 Website / app / software", recs: ["🌐 Website", "📱 App", "⚙️ Custom software"] },
  { label: "🛒 Sell online", recs: ["🛒 E-commerce / Shopify"] },
  { label: "📣 More leads & marketing", recs: ["📣 Ads & marketing", "📈 Growth & analytics"] },
  { label: "⭐ Reviews & reputation", recs: ["⭐ Reviews & reputation"] },
  { label: "🚀 Everything — run my whole operation", recs: ["🎙️ Voice AI", "🌐 Website", "📣 Ads & marketing", "🔄 Automations", "📊 Dashboards & CRM", "⭐ Reviews & reputation"] },
];

const fmt = (n) => "$" + Math.round(n / 50) * 50;
const NEEDS_STEP = QUESTIONS.length + 1; // 6

export default function Quiz() {
  const [step, setStep] = useState(-1); // -1 intro · 0 industry · 1..5 Qs · 6 needs · 99 result
  const [ind, setInd] = useState(null);
  const [ans, setAns] = useState([]);
  const [needs, setNeeds] = useState([]);
  const [lead, setLead] = useState({ name: "", contact: "" });
  const [sent, setSent] = useState(false);

  const total = QUESTIONS.length;
  const partner = INDUSTRIES[ind]?.partner;
  const score = ans.reduce((s, v) => s + (v ?? 0), 0);
  const readiness = Math.round((score / (total * 3)) * 100);
  const base = INDUSTRIES[ind]?.base || 5000;
  const leak = Math.max(300, Math.round(base * (1 - readiness / 100)));
  const stack = [...new Set(needs.flatMap((i) => NEEDS[i].recs))];
  const tier = readiness <= 40 ? { t: "Major leaks", c: "text-[#e0855f]", m: "You're leaving serious money on the table — and it's fixable fast." }
    : readiness <= 70 ? { t: "Solid — with gaps", c: "text-g-gold", m: "You're doing well; Gui can plug the leaks and compound it." }
    : { t: "Strong", c: "text-g-green", m: "You're ahead — Gui can take you even further, on autopilot." };

  function pick(points) {
    const next = [...ans]; next[step - 1] = points; setAns(next);
    setStep(step < total ? step + 1 : NEEDS_STEP);
  }
  function toggleNeed(i) { setNeeds((n) => (n.includes(i) ? n.filter((x) => x !== i) : [...n, i])); }
  async function submit(e) {
    e.preventDefault();
    if (!lead.name || !lead.contact) return;
    try { await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...lead, industry: INDUSTRIES[ind]?.name, score: readiness, leak, message: (partner ? "PARTNER · " : "") + "wants: " + stack.join(", "), source: partner ? "quiz-partner" : "ai-growth-quiz" }) }); } catch { /* graceful */ }
    setSent(true);
  }
  const progress = step < 0 ? 0 : step === 99 ? 100 : Math.round((step / (total + 2)) * 100);

  return (
    <div className="min-h-screen text-g-word">
      <style>{`@keyframes qfade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes qshine{to{background-position:220% center}}`}</style>
      <div className="flex items-center justify-between px-5 py-4">
        <a href="/" className="flex items-center gap-2"><img src={logo} alt="" className="h-7 w-7 object-contain" /><span className="font-black">Guileo</span></a>
        <span className="text-[11px] font-bold uppercase tracking-wider text-g-muted">AI Growth Score · 60 sec</span>
      </div>
      <div className="h-1 w-full bg-white/5"><div className="h-full bg-gradient-to-r from-g-green to-g-gold transition-all duration-500" style={{ width: `${progress}%` }} /></div>

      <div className="mx-auto flex min-h-[80vh] max-w-xl flex-col justify-center px-5 py-12">
        {step === -1 && (
          <div key="intro" style={{ animation: "qfade .5s ease both" }} className="text-center">
            <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">Free · 60 seconds</div>
            <h1 className="mt-4 font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2.2rem,6vw,3.4rem)" }}>
              <span className="text-g-word">What's your business </span>
              <span className="bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "qshine 7s linear infinite" }}>leaking?</span>
            </h1>
            <p className="mx-auto mt-4 max-w-md text-[15px] text-g-ink">Answer a few quick questions → get your <span className="font-semibold text-g-word">AI Growth Score</span>, how much you could recover monthly, and the exact <span className="font-semibold text-g-green">Guileo stack</span> for you.</p>
            <button onClick={() => setStep(0)} className="mt-8 rounded-full bg-gradient-to-r from-g-green to-g-dark px-8 py-3.5 text-[15px] font-bold text-white shadow-[0_18px_50px_-14px_rgba(62,148,104,0.7)] transition hover:brightness-110">Get my score →</button>
            <div className="mt-4 text-[12px] text-g-muted">No login. Instant result.</div>
          </div>
        )}

        {step === 0 && (
          <div key="ind" style={{ animation: "qfade .4s ease both" }}>
            <div className="text-[12px] font-bold text-g-muted">Step 1 of {total + 2}</div>
            <h2 className="mt-2 text-[24px] font-bold text-g-word">What kind of business do you run?</h2>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {INDUSTRIES.map((x, i) => (
                <button key={x.name} onClick={() => { setInd(i); setStep(1); }} className={`rounded-xl border px-4 py-3 text-left text-[14px] font-semibold transition hover:-translate-y-0.5 hover:border-g-green/40 hover:bg-white/[0.06] ${x.partner ? "border-g-gold/40 bg-g-gold/[0.06] text-g-gold" : "border-g-line bg-white/[0.03] text-g-ink"}`}>{x.name}</button>
              ))}
            </div>
          </div>
        )}

        {step >= 1 && step <= total && (
          <div key={`q${step}`} style={{ animation: "qfade .4s ease both" }}>
            <div className="text-[12px] font-bold text-g-muted">Step {step + 1} of {total + 2}</div>
            <h2 className="mt-2 text-[24px] font-bold leading-snug text-g-word">{QUESTIONS[step - 1].q}</h2>
            <div className="mt-5 space-y-2.5">
              {QUESTIONS[step - 1].a.map(([label, pts]) => (
                <button key={label} onClick={() => pick(pts)} className="flex w-full items-center justify-between rounded-xl border border-g-line bg-white/[0.03] px-4 py-3.5 text-left text-[15px] font-semibold text-g-ink transition hover:-translate-y-0.5 hover:border-g-green/40 hover:bg-white/[0.06]">
                  {label} <span className="text-g-green">→</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* NEEDS — drives the recommended stack (all products/services) */}
        {step === NEEDS_STEP && (
          <div key="needs" style={{ animation: "qfade .4s ease both" }}>
            <div className="text-[12px] font-bold text-g-muted">Step {total + 2} of {total + 2}</div>
            <h2 className="mt-2 text-[24px] font-bold leading-snug text-g-word">What do you want Guileo to handle? <span className="text-g-muted">(pick all)</span></h2>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {NEEDS.map((n, i) => {
                const on = needs.includes(i);
                return (
                  <button key={n.label} onClick={() => toggleNeed(i)} className={`rounded-xl border px-4 py-3.5 text-left text-[14px] font-semibold transition ${on ? "border-g-green/50 bg-g-green/15 text-g-word" : "border-g-line bg-white/[0.03] text-g-ink hover:bg-white/[0.06]"}`}>
                    <span className="mr-1">{on ? "✓" : ""}</span>{n.label}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setStep(99)} disabled={!needs.length} className="mt-6 w-full rounded-full bg-gradient-to-r from-g-green to-g-dark px-8 py-3.5 text-[15px] font-bold text-white shadow-[0_18px_50px_-14px_rgba(62,148,104,0.7)] transition hover:brightness-110 disabled:opacity-50">See my result →</button>
          </div>
        )}

        {step === 99 && (
          <div key="res" style={{ animation: "qfade .5s ease both" }} className="text-center">
            <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">Your AI Growth Score</div>
            <div className="mt-3 text-[64px] font-black leading-none">
              <span className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-transparent">{readiness}<span className="text-[28px]">/100</span></span>
            </div>
            <div className={`mt-2 text-[18px] font-bold ${tier.c}`}>{tier.t}</div>
            <p className="mx-auto mt-2 max-w-md text-[14px] text-g-ink">{tier.m}</p>

            {!partner && (
              <div className="mx-auto mt-6 max-w-md rounded-2xl border border-[#d8916e]/30 bg-[#d8916e]/[0.06] p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#d8916e]">Estimated leak, every month</div>
                <div className="mt-1 text-[40px] font-black text-[#e0855f]">{fmt(leak)}</div>
                <div className="text-[13px] text-g-muted">walking out the door — that Gui can recover.</div>
              </div>
            )}

            {/* recommended stack */}
            {stack.length > 0 && (
              <div className="mx-auto mt-5 max-w-md rounded-2xl border border-g-green/30 bg-g-green/[0.06] p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-g-green">Your recommended Guileo stack</div>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {stack.map((c) => <span key={c} className="rounded-full border border-g-green/30 bg-white/[0.04] px-3 py-1 text-[12.5px] font-semibold text-g-word">{c}</span>)}
                </div>
              </div>
            )}

            {partner && (
              <div className="mx-auto mt-5 max-w-md rounded-2xl border border-g-gold/40 bg-g-gold/[0.07] p-5 text-[14px] text-g-ink">
                🤝 <span className="font-bold text-g-word">Guileo Partner Program</span> — resell our AI, websites & marketing white-label. We build & run, you own the client. Leave your contact for partner terms.
              </div>
            )}

            {sent ? (
              <div className="mx-auto mt-6 max-w-md rounded-2xl border border-g-green/30 bg-g-green/[0.07] p-6">
                <div className="text-3xl">🌱</div>
                <div className="mt-2 text-[17px] font-bold text-g-word">{partner ? "Partner request received" : "Your free plan is on its way"}, {lead.name.split(" ")[0]}!</div>
                <p className="mt-1 text-[13.5px] text-g-ink">A real human will reach out shortly{partner ? " with partner terms" : " with exactly how to plug these leaks"}.</p>
                <a href={waLink("Hi Guileo! I just took the AI Growth Score quiz.")} target="_blank" rel="noreferrer" className="mt-4 inline-block text-[13px] font-bold text-g-green">Message us now on WhatsApp →</a>
              </div>
            ) : (
              <form onSubmit={submit} className="mx-auto mt-6 max-w-md space-y-3 rounded-2xl border border-g-line bg-white/[0.04] p-6 text-left">
                <div className="text-center text-[15px] font-bold text-g-word">{partner ? "Get partner terms" : "Get your free AI growth plan"}</div>
                <input value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} required placeholder="Your name" className="w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
                <input value={lead.contact} onChange={(e) => setLead({ ...lead, contact: e.target.value })} required placeholder="WhatsApp, phone or email" className="w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
                <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-g-green to-g-dark px-5 py-3.5 text-[15px] font-bold text-white shadow-[0_18px_50px_-14px_rgba(62,148,104,0.7)] transition hover:brightness-110">{partner ? "Become a partner →" : "Send me my plan →"}</button>
                <p className="text-center text-[11px] text-g-muted">No spam. Live in under 7 days · 30-day money-back.</p>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
