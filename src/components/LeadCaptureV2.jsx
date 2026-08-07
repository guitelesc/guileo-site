import { useState } from "react";
import { waLink, bookLink } from "../data/contact";
import { useLang } from "../i18n.jsx";
import { trackLead } from "../lib/analytics.js";
import ConsentText from "./ConsentText.jsx";

// LeadCaptureV2 — TEST (/v2) close: "Stop losing customers. Start tonight."
// Multi-channel contact capture (the form Luis loves). Posts to /api/lead; a real human
// follows up. Guileo design system. id="contact" so CTAs across the page jump here.

const CH = [
  { k: "WhatsApp", icon: "💬", ph: "+1 (555) 000-0000" },
  { k: "Phone", icon: "📞", ph: "+1 (555) 000-0000" },
  { k: "Email", icon: "✉️", ph: "you@email.com" },
  { k: "Instagram", icon: "📸", ph: "@yourhandle" },
  { k: "Telegram", icon: "✈️", ph: "@yourhandle" },
  { k: "LinkedIn", icon: "💼", ph: "linkedin.com/in/you" },
  { k: "Messenger", icon: "📘", ph: "facebook.com/you" },
  { k: "X", icon: "✖️", ph: "@yourhandle" },
];

export default function LeadCaptureV2() {
  const { lang } = useLang();
  const [name, setName] = useState("");
  const [ch, setCh] = useState(0);
  const [val, setVal] = useState("");
  const [biz, setBiz] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | done
  const [website, setWebsite] = useState(""); // honeypot — hidden from humans
  const [consent, setConsent] = useState(false); // TCPA — UNCHECKED by default; required affirmative opt-in
  const [err, setErr] = useState(false); // a11y: true when submit fails validation


  const errText = lang === "es" ? "Completa tu nombre y contacto, y acepta el consentimiento." : lang === "pt" ? "Preencha seu nome e contato, e aceite o consentimento." : lang === "hi" ? "अपना नाम और संपर्क भरें, और सहमति बॉक्स चेक करें।" : "Please fill in your name and contact, and check the consent box.";
  const LC = {
    h2a: { en: "Stop losing customers. ", pt: "Pare de perder clientes. ", es: "Deja de perder clientes. ", hi: "ग्राहक खोना बंद करें। " },
    h2b: { en: "Start tonight.", pt: "Comece hoje à noite.", es: "Empieza esta noche.", hi: "आज रात ही शुरू करें।" },
    suba: { en: "Tell us where to reach you. A ", pt: "Diga onde te encontrar. Uma ", es: "Dinos dónde contactarte. Una ", hi: "बताएँ कहाँ संपर्क करें। एक " },
    subHuman: { en: "real human", pt: "pessoa de verdade", es: "persona real", hi: "असली इंसान" },
    subb: { en: " gets back to you fast — usually within hours.", pt: " responde rápido — normalmente em horas.", es: " responde rápido — normalmente en horas.", hi: " जल्दी जवाब देता है — आमतौर पर घंटों में।" },
    trust: { en: "⚡ Live in under 7 days · 🛡️ 30-day money-back · 🎙️ talk to our AI right now", pt: "⚡ No ar em 7 dias · 🛡️ 30 dias de garantia · 🎙️ fale com nossa IA agora", es: "⚡ En marcha en 7 días · 🛡️ 30 días de garantía · 🎙️ habla con nuestra IA ahora", hi: "⚡ 7 दिनों से कम में लाइव · 🛡️ 30-दिन मनी-बैक · 🎙️ अभी हमारी AI से बात करें" },
  };
  const lc = (k) => LC[k][lang] || LC[k].en;
  const nameBad = err && !name.trim();
  const valBad = err && !val.trim();
  const consentBad = err && !consent;

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || !val.trim() || !consent) { setErr(true); return; }
    setErr(false);
    setStatus("sending");
    const c = CH[ch];
    try {
      await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, channel: c.k, contact: val, phone: /phone|whatsapp/i.test(c.k) ? val : "", email: c.k === "Email" ? val : "", business: biz, website, consent, source: "v2-lead", lang }),
      });
    } catch { /* never block the user */ }
    trackLead(); // fire-and-forget; no-ops until pixel IDs are set
    setStatus("done");
  }

  return (
    <section id="contact" className="relative overflow-hidden px-5 py-24">
      <style>{`@keyframes lcreveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}@keyframes lcshine{to{background-position:220% center}}@media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}`}</style>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(800px_400px_at_50%_0%,rgba(62,148,104,0.12),transparent)]" />

      <div className="mx-auto max-w-xl text-center">
        <h2 className="font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2.2rem,5vw,3.6rem)" }}>
          <span className="text-g-word" style={{ animation: "lcreveal .8s cubic-bezier(.2,.7,.2,1) both" }}>{lc("h2a")}</span>
          <span className="bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "lcreveal .8s cubic-bezier(.2,.7,.2,1) .15s both, lcshine 7s linear infinite" }}>{lc("h2b")}</span>
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[15px] text-g-ink" style={{ animation: "lcreveal .8s ease .25s both" }}>
          {lc("suba")}<span className="font-semibold text-g-word">{lc("subHuman")}</span>{lc("subb")}
        </p>
      </div>

      <div className="mx-auto mt-8 max-w-xl rounded-[1.75rem] border border-g-line bg-white/[0.04] p-6 shadow-[0_40px_90px_-50px_rgba(0,0,0,0.85)] backdrop-blur-sm sm:p-8" style={{ animation: "lcreveal .8s ease .35s both" }}>
        {status === "done" ? (
          <div className="py-8 text-center">
            <div className="text-4xl">🌱</div>
            <div className="mt-3 text-[20px] font-bold text-g-word">Got it, {name.split(" ")[0] || "friend"}!</div>
            <p className="mt-1 text-[14px] text-g-ink">A real human will reach out on <span className="font-semibold text-g-green">{CH[ch].k}</span> within hours.</p>
            <a href={waLink("Hi Guileo! I just left my details on your site.")} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-[14px] font-bold text-black">💬 Or message us now on WhatsApp</a>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {/* honeypot: invisible to humans, bots auto-fill it → server silently drops */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
              value={website} onChange={(e) => setWebsite(e.target.value)}
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" aria-label="Your name" aria-invalid={nameBad} aria-describedby={nameBad ? "lcv2-err" : undefined} className="w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />

            <div>
              <div className="mb-2 text-[12px] font-bold uppercase tracking-wider text-g-muted">Where should we reach you?</div>
              <div className="flex flex-wrap gap-1.5">
                {CH.map((c, i) => (
                  /* Mesmo alvo de 44px do LeadForm: este bloco também é um seletor de contato. */
                  <button type="button" key={c.k} onClick={() => { setCh(i); setVal(""); }}
                    className={`inline-flex min-h-11 items-center rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition sm:min-h-0 ${i === ch ? "border-g-green/50 bg-g-green/15 text-g-word" : "border-g-line bg-white/[0.03] text-g-muted hover:text-g-word"}`}>
                    {c.icon} {c.k}
                  </button>
                ))}
              </div>
            </div>

            <input value={val} onChange={(e) => setVal(e.target.value)} required placeholder={CH[ch].ph} aria-label={`${CH[ch].k} contact`} aria-invalid={valBad} aria-describedby={valBad ? "lcv2-err" : undefined} className="w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />
            <input value={biz} onChange={(e) => setBiz(e.target.value)} placeholder="Your business (optional)" aria-label="Your business (optional)" className="w-full rounded-xl border border-g-line bg-white/[0.05] px-4 py-3 text-[15px] text-g-word placeholder:text-g-muted focus:border-g-green/50 focus:outline-none" />

            {/* TCPA consent — REQUIRED, unchecked by default (affirmative opt-in) */}
            <label className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] leading-snug transition ${consentBad ? "border-g-gold/70 bg-g-gold/10 text-g-word" : "border-g-line bg-white/[0.03] text-g-muted"}`}>
              <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)}
                aria-invalid={consentBad} aria-describedby={consentBad ? "lcv2-err" : undefined}
                className="mt-0.5 h-4 w-4 shrink-0 accent-g-green" />
              <span><ConsentText lang={lang} /></span>
            </label>

            {err && <p id="lcv2-err" role="alert" className="text-center text-[12.5px] font-semibold text-g-gold">{errText}</p>}
            <button type="submit" disabled={status === "sending"} className="w-full rounded-xl bg-gradient-to-r from-g-green to-g-dark px-5 py-3.5 text-[15px] font-bold text-white shadow-[0_18px_50px_-14px_rgba(62,148,104,0.7)] transition hover:brightness-110 disabled:opacity-60">
              {status === "sending" ? "Sending…" : "Get my free quote →"}
            </button>
            <p className="text-center text-[11.5px] text-g-muted">No spam. Your info stays private and is only used to contact you.</p>
          </form>
        )}
      </div>

      <div className="mx-auto mt-6 max-w-xl text-center" style={{ animation: "lcreveal .8s ease .5s both" }}>
        <div className="text-[12.5px] font-semibold text-g-muted">{lc("trust")}</div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <a href={waLink("Hi Guileo! I'd like to know more.")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-g-line bg-white/[0.04] px-5 py-2.5 text-[14px] font-bold text-g-word transition hover:border-g-green/40">💬 Start on WhatsApp</a>
          <a href={bookLink()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-g-line bg-white/[0.04] px-5 py-2.5 text-[14px] font-bold text-g-word transition hover:border-g-green/40">📅 Book a demo</a>
        </div>
      </div>
    </section>
  );
}
