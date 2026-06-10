import { useState } from "react";
import { useLang } from "../i18n.jsx";

// "Build your package" — the client picks OUTCOMES, describes their business in their own
// words, leaves contact, and Guileo assembles a tailored package live (smart tier + credits
// + value) then SENDS a real quote request to /api/lead (lands in /admin). Bilingual.

const OUTCOMES = [
  { ic: "📞", en: "Never miss a call", pt: "Nunca perder ligação", credits: 120, value: 900 },
  { ic: "💰", en: "Recover lost sales", pt: "Recuperar vendas", credits: 140, value: 1400 },
  { ic: "📅", en: "Fill my calendar", pt: "Lotar a agenda", credits: 100, value: 800 },
  { ic: "🎯", en: "More leads (ads)", pt: "Mais leads (ads)", credits: 180, value: 1600 },
  { ic: "🎬", en: "Content & social", pt: "Conteúdo & redes", credits: 160, value: 700 },
  { ic: "🌐", en: "Website / app / software", pt: "Site / app / software", credits: 200, value: 1200 },
  { ic: "💬", en: "WhatsApp & SMS replies", pt: "Respostas WhatsApp & SMS", credits: 110, value: 850 },
  { ic: "⭐", en: "More 5★ reviews", pt: "Mais avaliações 5★", credits: 80, value: 500 },
  { ic: "🤖", en: "Automate the busywork", pt: "Automatizar tarefas", credits: 120, value: 1000 },
  { ic: "🛒", en: "Online store / e-commerce", pt: "Loja online / e-commerce", credits: 180, value: 1300 },
  { ic: "📊", en: "Dashboards & CRM", pt: "Dashboards & CRM", credits: 90, value: 600 },
  { ic: "📈", en: "Track & grow profit", pt: "Medir & crescer o lucro", credits: 90, value: 1100 },
];
const TIERS = [
  { name: "Essential", rgb: "62,148,104", noteEn: "a focused start", notePt: "um começo focado" },
  { name: "Personalized", rgb: "214,194,154", noteEn: "marketing + AI, working together", notePt: "marketing + IA, juntos" },
  { name: "Full Operation", rgb: "194,168,120", noteEn: "full build + we run it all", notePt: "construção completa + a gente roda tudo" },
];

export default function PricingConfigurator() {
  const { lang } = useLang();
  const pt = lang === "pt";
  const [sel, setSel] = useState(() => new Set(["📞", "💰", "🎯"]));
  const [biz, setBiz] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | done
  const [website, setWebsite] = useState(""); // honeypot — hidden from humans, bots fill it
  const toggle = (k) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const chosen = OUTCOMES.filter((o) => sel.has(o.ic));
  const credits = chosen.reduce((a, o) => a + o.credits, 0);
  const value = chosen.reduce((a, o) => a + o.value, 0);
  const hasBuild = sel.has("🌐") || sel.has("🛒");
  const hasGrowth = sel.has("🎯") || sel.has("🎬");
  const tIdx = chosen.length === 0 ? 0 : hasBuild || chosen.length >= 6 ? 2 : chosen.length >= 3 || hasGrowth ? 1 : 0;
  const tier = TIERS[tIdx];
  const rgb = tier.rgb;

  const submit = async (e) => {
    e.preventDefault();
    if (!contact.trim()) return;
    setState("sending");
    const wants = chosen.map((o) => o.en).join(", ");
    const lead = {
      name: name.trim() || (pt ? "Pedido de orçamento" : "Quote request"),
      contact: contact.trim(), phone: contact.trim(),
      business: biz.trim().slice(0, 160),
      // message carries everything Luis needs to quote — it lands in the /admin feed details
      message: `Wants: ${wants} → ${tier.name} (~${credits} cr/mo · est $${value}/mo).${biz.trim() ? ` Notes: ${biz.trim()}` : ""}`,
      channel: "Pricing configurator", source: "configurator", lang, website,
    };
    try { await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) }); } catch { /* graceful */ }
    setState("done");
  };

  const field = "w-full rounded-xl border border-white/12 bg-black/20 px-4 py-3 text-[14px] text-g-word placeholder:text-g-muted outline-none focus:border-g-green/60 transition";

  return (
    <section className="relative overflow-hidden px-5 py-4">
      <style>{`
        @keyframes cfgpop{0%{transform:scale(.9)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
        @keyframes cfgglow{0%,100%{opacity:.55}50%{opacity:1}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      <form onSubmit={submit} className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        {/* honeypot: invisible to humans, bots auto-fill it → server silently drops */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
          value={website} onChange={(e) => setWebsite(e.target.value)}
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
        {/* LEFT — pick outcomes + describe + contact */}
        <div className="rounded-xl3 border border-white/10 bg-white/[0.03] p-6 shadow-lift backdrop-blur-xl sm:p-7">
          {/* STEP 1 — numbered badge anchors the 1→2→3 flow */}
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-g-green/50 bg-g-green/15 text-[13px] font-black text-g-green shadow-[0_0_16px_rgba(62,148,104,0.35)]">1</span>
            <span className="text-[12px] font-black uppercase tracking-wider text-g-green">{pt ? "O que você quer crescer?" : "What do you want to grow?"}</span>
          </div>
          <p className="mt-1.5 pl-[38px] text-[13px] text-g-ink">{pt ? "Toque em tudo que faz sentido." : "Tap everything that fits."}</p>
          <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {OUTCOMES.map((o) => {
              const on = sel.has(o.ic);
              return (
                <button type="button" key={o.ic} onClick={() => toggle(o.ic)} className={`group flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-[13px] font-semibold transition-all duration-200 active:scale-[0.97] ${on ? "border-g-green/55 bg-g-green/[0.12] text-g-word shadow-[0_10px_30px_-16px_rgba(62,148,104,0.85)]" : "border-white/10 bg-white/[0.03] text-g-ink hover:-translate-y-0.5 hover:border-g-green/35 hover:bg-g-green/[0.04] hover:text-g-word"}`}>
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-base ring-1 transition ${on ? "bg-g-green/20 ring-g-green/40" : "bg-white/[0.05] ring-white/10 group-hover:ring-g-green/30"}`} style={on ? { animation: "cfgpop .3s ease" } : undefined}>{o.ic}</span>
                  <span className="flex-1 leading-tight">{pt ? o.pt : o.en}</span>
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-black transition ${on ? "bg-g-green text-black shadow-[0_0_10px_rgba(62,148,104,0.7)]" : "bg-white/[0.06] text-g-muted group-hover:bg-g-green/30 group-hover:text-g-word"}`}>{on ? "✓" : "+"}</span>
                </button>
              );
            })}
          </div>

          {/* describe your business / needs in your own words */}
          {/* STEP 2 */}
          <div className="mt-6 flex items-center gap-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-g-gold/50 bg-g-gold/15 text-[13px] font-black text-g-gold shadow-[0_0_16px_rgba(214,194,154,0.3)]">2</span>
            <span className="text-[12px] font-black uppercase tracking-wider text-g-gold">{pt ? "Conte do seu negócio" : "Tell us about your business"}</span>
          </div>
          <textarea value={biz} onChange={(e) => setBiz(e.target.value)} rows={3} placeholder={pt ? "Ex: tenho uma clínica, perco ligações fora do horário e quero lotar a agenda + recuperar pacientes antigos…" : "E.g. I run a clinic, I miss after-hours calls and want to fill the calendar + win back old patients…"} className={`${field} mt-2 resize-none`} />
        </div>

        {/* RIGHT — live package + send */}
        <div className="relative overflow-hidden rounded-xl3 border p-6 backdrop-blur-xl transition-colors duration-500 sm:p-7"
          style={{ borderColor: `rgba(${rgb},0.4)`, background: `linear-gradient(180deg, rgba(${rgb},0.10), rgba(255,255,255,0.02))`, boxShadow: `0 44px 100px -34px rgba(${rgb},0.5)` }}>
          <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full blur-3xl" style={{ background: `rgba(${rgb},0.22)`, animation: "cfgglow 3s ease-in-out infinite" }} />
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/[0.08] to-transparent" />

          {state === "done" ? (
            <div className="relative flex min-h-[420px] flex-col items-center justify-center text-center">
              <div className="text-5xl">🎉</div>
              <div className="mt-3 text-xl font-black text-g-word">{pt ? "Recebido!" : "Got it!"}</div>
              <p className="mt-2 max-w-xs text-sm text-g-muted">{pt ? `Um humano vai montar seu orçamento ${tier.name} e te chamar em ${contact.trim()} — geralmente em horas.` : `A human will build your ${tier.name} quote and reach you at ${contact.trim()} — usually within hours.`}</p>
              <a href="/portal" className="btn-ghost mt-5 text-sm">{pt ? "Enquanto isso, ver o painel →" : "Meanwhile, see the dashboard →"}</a>
            </div>
          ) : (
            <>
              <div className="relative flex items-center justify-between">
                <div className="inline-flex items-center gap-2.5 text-[11px] font-black uppercase tracking-wider" style={{ color: `rgb(${rgb})` }}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[13px] font-black" style={{ borderColor: `rgba(${rgb},0.5)`, background: `rgba(${rgb},0.15)`, color: `rgb(${rgb})`, boxShadow: `0 0 16px rgba(${rgb},0.35)` }}>3</span>
                  {pt ? "Seu pacote Guileo" : "Your Guileo package"}
                  <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full" style={{ background: `rgba(${rgb},0.5)` }} /><span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: `rgb(${rgb})` }} /></span>
                </div>
                <span className="rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider" style={{ borderColor: `rgba(${rgb},0.4)`, color: `rgb(${rgb})` }}>{pt ? "recomendado" : "recommended"}</span>
              </div>
              <div className="relative mt-2 text-[26px] font-black text-g-word">{tier.name}</div>
              <div className="text-[13px] text-g-muted">{pt ? tier.notePt : tier.noteEn}.</div>

              {chosen.length > 0 && (
                <div className="relative mt-4 flex flex-wrap gap-1.5">
                  {chosen.map((o) => <span key={o.ic} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold text-g-light" style={{ borderColor: `rgba(${rgb},0.35)`, background: `rgba(${rgb},0.08)`, animation: "cfgpop .3s ease" }}>{o.ic} {pt ? o.pt : o.en}</span>)}
                </div>
              )}

              <div className="relative mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-g-muted">{pt ? "Créditos/mês ~" : "Credits/mo ~"}</div>
                  <div className="text-[24px] font-black tabular-nums text-g-word">{credits.toLocaleString("en-US")}</div>
                </div>
                {/* recovered money is ALWAYS green — money back = green, period */}
                <div className="rounded-2xl border border-g-green/40 p-3.5" style={{ background: "rgba(62,148,104,0.08)" }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-g-green/90">{pt ? "Costuma recuperar" : "Typically recovers"}</div>
                  <div className="text-[24px] font-black tabular-nums text-g-green" style={{ textShadow: "0 0 22px rgba(62,148,104,0.5)" }}><span className="text-[14px]">▲</span> ${value.toLocaleString("en-US")}<span className="text-[11px] font-bold text-g-ink">{pt ? "/mês" : "/mo"}</span></div>
                </div>
              </div>

              {/* contact — where to send the quote */}
              <div className="relative mt-5 space-y-2.5">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={pt ? "Seu nome" : "Your name"} className={field} />
                <input required value={contact} onChange={(e) => setContact(e.target.value)} placeholder={pt ? "WhatsApp / telefone / e-mail" : "WhatsApp / phone / email"} className={field} />
              </div>

              <button type="submit" disabled={state === "sending" || !contact.trim()} className="btn-bright relative mt-4 w-full justify-center disabled:opacity-60">
                {state === "sending" ? (pt ? "Enviando…" : "Sending…") : (pt ? "Receber meu orçamento →" : "Get my tailored quote →")}
              </button>
              <p className="relative mt-3 text-center text-[11px] text-g-muted">{pt ? "Sem spam · um humano revisa com você · garantia de 30 dias" : "No spam · a human reviews it with you · 30-day money-back"}</p>
            </>
          )}
        </div>
      </form>
    </section>
  );
}
