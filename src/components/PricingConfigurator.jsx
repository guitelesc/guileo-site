import { useState } from "react";
import { useLang } from "../i18n.jsx";
import { productsForPlan } from "../data/productSystem.js";

// The 3 recommended tiers map 1:1 onto the product-system plan keys — so the buyer
// sees the actual RESULT-products included, derived from THE single source of truth.
const TIER_PLAN_KEYS = ["starter", "growth", "scale"];

// Small result-forward "what's included" strip — icon + name + resultMetric value,
// derived ONLY from productSystem (p.plans membership). No prices invented here.
function IncludedProducts({ planKey, rgb, lang, t }) {
  // FIX (audit): skip standalone products (e.g. Guileo Pulse, billed $49 separately) — they showed a
  // PRICE chip inside an outcomes list, implying they were bundled. Only show outcome-metric products.
  const products = productsForPlan(planKey).filter((p) => !p.standalone && p.resultMetric);
  if (!products.length) return null;
  const nm = (o) => (lang === "hi" ? (o.hi ?? o.en) : lang === "es" ? (o.es ?? o.en) : lang === "pt" ? o.pt : o.en);
  return (
    <div className="relative mt-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: `rgb(${rgb})`, opacity: 0.8 }}>
        {t("What's included", "O que vem incluso", "Qué incluye", "क्या शामिल है")} · {products.length}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {products.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold text-g-light"
            style={{ borderColor: `rgba(${rgb},0.3)`, background: `rgba(${rgb},0.06)` }}>
            <span className="text-[13px]" aria-hidden>{p.icon}</span>
            <span className="text-g-word">{nm(p.name)}</span>
            <span className="font-black tabular-nums" style={{ color: p.accent }}>{p.resultMetric?.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// "Build your package" — the client picks OUTCOMES, describes their business in their own
// words, leaves contact, and Guileo assembles a tailored package live (smart tier + credits
// + value) then SENDS a real quote request to /api/lead (lands in /admin). Bilingual.

const OUTCOMES = [
  { ic: "📞", en: "Never miss a call", pt: "Nunca perder ligação", es: "Nunca perder una llamada", hi: "कोई कॉल न छूटे", credits: 120, value: 900 },
  { ic: "💰", en: "Recover lost sales", pt: "Recuperar vendas", es: "Recuperar ventas perdidas", hi: "खोई बिक्री वापस पाएँ", credits: 140, value: 1400 },
  { ic: "📅", en: "Fill my calendar", pt: "Lotar a agenda", es: "Llenar mi agenda", hi: "मेरा कैलेंडर भरें", credits: 100, value: 800 },
  { ic: "🎯", en: "More leads (ads)", pt: "Mais leads (ads)", es: "Más leads (ads)", hi: "ज़्यादा लीड (ऐड्स)", credits: 180, value: 1600 },
  { ic: "🎬", en: "Content & social", pt: "Conteúdo e redes", es: "Contenido y redes", hi: "कंटेंट & सोशल", credits: 160, value: 700 },
  { ic: "🌐", en: "Website / app / software", pt: "Site / app / software", es: "Sitio / app / software", hi: "वेबसाइट / ऐप / सॉफ़्टवेयर", credits: 200, value: 1200 },
  { ic: "💬", en: "WhatsApp & SMS replies", pt: "Respostas WhatsApp e SMS", es: "Respuestas WhatsApp y SMS", hi: "WhatsApp & SMS जवाब", credits: 110, value: 850 },
  { ic: "⭐", en: "More 5★ reviews", pt: "Mais avaliações 5★", es: "Más reseñas 5★", hi: "ज़्यादा 5★ समीक्षाएँ", credits: 80, value: 500 },
  { ic: "🤖", en: "Automate the busywork", pt: "Automatizar tarefas", es: "Automatizar tareas", hi: "बेकार काम ऑटोमेट करें", credits: 120, value: 1000 },
  { ic: "🛒", en: "Online store / e-commerce", pt: "Loja online / e-commerce", es: "Tienda online / e-commerce", hi: "ऑनलाइन स्टोर / ई-कॉमर्स", credits: 180, value: 1300 },
  { ic: "📊", en: "Dashboards & CRM", pt: "Dashboards e CRM", es: "Dashboards y CRM", hi: "डैशबोर्ड & CRM", credits: 90, value: 600 },
  { ic: "📈", en: "Track & grow profit", pt: "Medir e crescer o lucro", es: "Medir y aumentar la ganancia", hi: "मुनाफ़ा मापें & बढ़ाएँ", credits: 90, value: 1100 },
  // (power-up add-ons live in the dedicated AddOns section above — kept out here to fit one screen + avoid duplication)
];
const TIERS = [
  { name: "Essential", rgb: "62,148,104", noteEn: "a focused start", notePt: "um começo focado", noteEs: "un comienzo enfocado", noteHi: "एक केंद्रित शुरुआत" },
  { name: "Personalized", rgb: "214,194,154", noteEn: "marketing + AI, working together", notePt: "marketing + IA, juntos", noteEs: "marketing + IA, trabajando juntos", noteHi: "मार्केटिंग + AI, साथ मिलकर" },
  { name: "Full Operation", rgb: "194,168,120", noteEn: "full build + we run it all", notePt: "construção completa + a gente roda tudo", noteEs: "construcción completa + lo operamos todo", noteHi: "पूरा निर्माण + हम सब चलाते हैं" },
];

export default function PricingConfigurator() {
  const { lang } = useLang();
  const pt = lang === "pt";
  const es = lang === "es";
  const hi = lang === "hi";
  // pick a string by language (es/hi fall back to en if no translation given)
  const t = (en, ptStr, esStr, hiStr) => (hi ? (hiStr ?? en) : es ? (esStr ?? en) : pt ? ptStr : en);
  // pick a localized label off an OUTCOME/TIER-style object
  const lbl = (o) => (hi ? (o.hi ?? o.en) : es ? (o.es ?? o.en) : pt ? o.pt : o.en);
  const [sel, setSel] = useState(() => new Set(["📞", "💰", "🎯"]));
  const [biz, setBiz] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | done
  const [callNow, setCallNow] = useState(false); // explicit TCPA consent → Gui calls them in ~60s
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
      name: name.trim() || t("Quote request", "Pedido de orçamento", "Solicitud de cotización"),
      contact: contact.trim(), phone: contact.trim(),
      business: biz.trim().slice(0, 160),
      // message carries everything Luis needs to quote — it lands in the /admin feed details
      message: `Wants: ${wants} → ${tier.name} (~${credits} cr/mo · est $${value}/mo).${biz.trim() ? ` Notes: ${biz.trim()}` : ""}`,
      channel: "Pricing configurator", source: "configurator", lang, website,
      callNow, consent: true, // checkbox = explicit consent for Gui to call this number now
    };
    try { await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lead) }); } catch { /* graceful */ }
    setState("done");
  };

  const field = "w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-[14px] text-g-word placeholder:text-g-muted outline-none focus:border-g-green/60 transition";

  return (
    <section className="relative overflow-hidden px-5 py-4">
      <style>{`
        @keyframes cfgpop{0%{transform:scale(.9)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
        @keyframes cfgglow{0%,100%{opacity:.55}50%{opacity:1}}
        @media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}
      `}</style>

      {/* colored frame — green→champagne gradient ring that contains & frames the whole builder */}
      <div className="mx-auto max-w-5xl rounded-[2rem] border border-g-green/30 bg-gradient-to-br from-g-green/[0.08] via-white/[0.02] to-g-gold/[0.08] p-3 sm:p-4" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 34px 90px -44px rgba(0,0,0,0.85)" }}>
      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        {/* honeypot: invisible to humans, bots auto-fill it → server silently drops */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true"
          value={website} onChange={(e) => setWebsite(e.target.value)}
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />
        {/* LEFT — pick outcomes + describe + contact */}
        <div className="rounded-[1.55rem] border border-g-green/20 bg-g-green/[0.04] p-6 shadow-lift backdrop-blur-xl sm:p-7">
          {/* STEP 1 — numbered badge anchors the 1→2→3 flow */}
          <div className="flex items-center gap-3">
            <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-g-green/50 bg-g-green/15 text-[16px] font-black text-g-green shadow-[0_0_16px_rgba(62,148,104,0.35)]">
              <span aria-hidden className="absolute inline-flex h-full w-full animate-ping rounded-full bg-g-green/40" />
              <span className="relative">1</span>
            </span>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-g-green/70">{t("Step 1", "Passo 1", "Paso 1", "चरण 1")}</div>
              <div className="text-[13px] font-black uppercase tracking-wide text-g-green">{t("What do you want to grow?", "O que você quer crescer?", "¿Qué quieres hacer crecer?", "आप क्या बढ़ाना चाहते हैं?")}</div>
            </div>
          </div>
          <p className="mt-1.5 pl-[48px] text-[13px] text-g-ink">{t("Tap everything that fits.", "Toque em tudo que faz sentido.", "Toca todo lo que aplique.", "जो भी लागू हो, सब चुनें।")}</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {OUTCOMES.map((o) => {
              const on = sel.has(o.ic);
              return (
                <button type="button" key={o.ic} onClick={() => toggle(o.ic)} aria-pressed={on} className={`group flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[12.5px] font-semibold transition-all duration-200 active:scale-[0.97] ${on ? "border-g-green/55 bg-g-green/[0.12] text-g-word shadow-[0_10px_30px_-16px_rgba(62,148,104,0.85)]" : "border-white/10 bg-white/[0.03] text-g-ink hover:-translate-y-0.5 hover:border-g-green/35 hover:bg-g-green/[0.04] hover:text-g-word"}`}>
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-base ring-1 transition ${on ? "bg-g-green/25 ring-g-green/50" : "bg-g-green/[0.07] ring-g-green/15 group-hover:bg-g-green/15 group-hover:ring-g-green/40"}`} style={on ? { animation: "cfgpop .3s ease" } : undefined}>{o.ic}</span>
                  <span className="flex-1 leading-tight">{lbl(o)}</span>
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-black transition ${on ? "bg-g-green text-black shadow-[0_0_10px_rgba(62,148,104,0.7)]" : "bg-white/[0.06] text-g-muted group-hover:bg-g-green/30 group-hover:text-g-word"}`}>{on ? "✓" : "+"}</span>
                </button>
              );
            })}
          </div>

          {/* describe your business / needs in your own words */}
          {/* STEP 2 */}
          <div className="mt-4 flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-g-gold/50 bg-g-gold/15 text-[16px] font-black text-g-gold shadow-[0_0_16px_rgba(214,194,154,0.3)]">2</span>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-g-gold/70">{t("Step 2", "Passo 2", "Paso 2", "चरण 2")}</div>
              <div className="text-[13px] font-black uppercase tracking-wide text-g-gold">{t("Tell us about your business", "Conte do seu negócio", "Cuéntanos de tu negocio", "अपने व्यवसाय के बारे में बताएँ")}</div>
            </div>
          </div>
          <textarea value={biz} onChange={(e) => setBiz(e.target.value)} rows={2} aria-label={t("Tell us about your business", "Conte do seu negócio", "Cuéntanos de tu negocio", "अपने व्यवसाय के बारे में बताएँ")} placeholder={t("E.g. I run a clinic, I miss after-hours calls and want to fill the calendar + win back old patients…", "Ex: tenho uma clínica, perco ligações fora do horário e quero lotar a agenda + recuperar pacientes antigos…", "Ej: tengo una clínica, pierdo llamadas fuera de horario y quiero llenar la agenda + recuperar pacientes antiguos…", "जैसे: मेरी क्लिनिक है, काम के घंटों के बाद कॉल छूट जाती हैं और मैं कैलेंडर भरना + पुराने मरीज़ वापस लाना चाहता हूँ…")} className={`${field} mt-2 resize-none`} />
        </div>

        {/* RIGHT — live package + send */}
        <div className="relative overflow-hidden rounded-xl3 border p-6 backdrop-blur-xl transition-colors duration-500 sm:p-7"
          style={{ borderColor: `rgba(${rgb},0.4)`, background: `linear-gradient(180deg, rgba(${rgb},0.10), rgba(255,255,255,0.02))`, boxShadow: `0 44px 100px -34px rgba(${rgb},0.5)` }}>
          <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full blur-3xl" style={{ background: `rgba(${rgb},0.22)`, animation: "cfgglow 3s ease-in-out infinite" }} />
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/[0.08] to-transparent" />

          {state === "done" ? (
            <div role="status" className="relative flex min-h-[420px] flex-col items-center justify-center text-center">
              <div className="text-5xl">{callNow ? "📞" : "🎉"}</div>
              <div className="mt-3 text-xl font-black text-g-word">{callNow ? t("Gui is calling you!", "A Gui está te ligando!", "¡Gui te está llamando!", "Gui आपको कॉल कर रही है!") : t("Got it!", "Recebido!", "¡Recibido!", "मिल गया!")}</div>
              <p className="mt-2 max-w-xs text-sm text-g-muted">{callNow
                ? t(`Pick up — Gui is dialing ${contact.trim()} now, live. Your ${tier.name} quote follows by email.`, `Atende — a Gui está ligando pra ${contact.trim()} agora, ao vivo. Seu orçamento ${tier.name} chega por email.`, `Contesta — Gui está llamando a ${contact.trim()} ahora, en vivo. Tu cotización ${tier.name} llega por correo.`, `उठाएँ — Gui अभी ${contact.trim()} पर कॉल कर रही है, लाइव। आपका ${tier.name} कोट ईमेल से आएगा।`)
                : t(`A human will build your ${tier.name} quote and reach you at ${contact.trim()} — usually within hours.`, `Um humano vai montar seu orçamento ${tier.name} e te chamar em ${contact.trim()} — geralmente em horas.`, `Una persona armará tu cotización ${tier.name} y te contactará en ${contact.trim()} — normalmente en horas.`, `एक इंसान आपका ${tier.name} कोट बनाएगा और ${contact.trim()} पर संपर्क करेगा — आमतौर पर घंटों में।`)}</p>
              <a href="/portal" className="btn-ghost mt-5 text-sm">{t("Meanwhile, see the dashboard →", "Enquanto isso, ver o painel →", "Mientras tanto, ver el panel →", "तब तक, डैशबोर्ड देखें →")}</a>
            </div>
          ) : (
            <>
              <div className="relative flex items-center justify-between">
                <div className="inline-flex items-center gap-3 text-[11px] font-black uppercase tracking-wider" style={{ color: `rgb(${rgb})` }}>
                  {/* SEM NÚMERO, DE PROPÓSITO. Este painel era "Passo 3" — e não é passo nenhum,
                      é a RESPOSTA. Numerar o resultado faz o visitante procurar o que ele tem
                      que fazer aqui, e em tela larga o "1" e o "3" ficavam lado a lado com o "2"
                      escondido embaixo dos chips: o olho lia 1 → 3 e concluía que tinha pulado
                      alguma coisa. Era essa a "dificuldade de entender". Agora o lado esquerdo é
                      o que VOCÊ diz (1 e 2) e o direito é o que NÓS desenhamos. */}
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border text-[15px]" style={{ borderColor: `rgba(${rgb},0.5)`, background: `rgba(${rgb},0.15)`, color: `rgb(${rgb})`, boxShadow: `0 0 16px rgba(${rgb},0.35)` }}>✍️</span>
                  <div className="text-left">
                    <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: `rgb(${rgb})`, opacity: 0.7 }}>{t("What we design for you", "O que a gente desenha pra você", "Lo que diseñamos para ti", "हम आपके लिए क्या डिज़ाइन करते हैं")}</div>
                    <div className="flex items-center gap-1.5 text-[13px]">{t("Built around your business", "Feito em volta do seu negócio", "Hecho alrededor de tu negocio", "आपके व्यवसाय के हिसाब से")}<span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full" style={{ background: `rgba(${rgb},0.5)` }} /><span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: `rgb(${rgb})` }} /></span></div>
                  </div>
                </div>
                <span className="rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider" style={{ borderColor: `rgba(${rgb},0.4)`, color: `rgb(${rgb})` }}>{t("recommended", "recomendado", "recomendado", "अनुशंसित")}</span>
              </div>
              <div className="relative mt-2 text-[26px] font-black text-g-word">{tier.name}</div>
              <div className="text-[13px] text-g-muted">{t(tier.noteEn, tier.notePt, tier.noteEs, tier.noteHi)}.</div>

              {chosen.length > 0 && (
                <div className="relative mt-4 flex flex-wrap gap-1.5">
                  {chosen.map((o) => <span key={o.ic} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold text-g-light" style={{ borderColor: `rgba(${rgb},0.35)`, background: `rgba(${rgb},0.08)`, animation: "cfgpop .3s ease" }}>{o.ic} {lbl(o)}</span>)}
                </div>
              )}

              {/* RESULT-products included in this recommended plan — derived from productSystem */}
              <IncludedProducts planKey={TIER_PLAN_KEYS[tIdx]} rgb={rgb} lang={lang} t={t} />

              <div className="relative mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-fuchsia-400/40 p-3.5" style={{ background: "rgba(217,70,239,0.08)" }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-300/90">{t("Credits/mo ~", "Créditos/mês ~", "Créditos/mes ~", "क्रेडिट/माह ~")}</div>
                  <div className="text-[24px] font-black tabular-nums text-fuchsia-300" style={{ textShadow: "0 0 18px rgba(217,70,239,0.6)" }}>{credits.toLocaleString("en-US")}</div>
                </div>
                {/* recovered money is ALWAYS green — money back = green, period */}
                <div className="rounded-2xl border border-g-green/40 p-3.5" style={{ background: "rgba(62,148,104,0.08)" }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-g-green/90">{t("Typically recovers", "Costuma recuperar", "Suele recuperar", "आम तौर पर वापस लाता है")}</div>
                  <div className="text-[24px] font-black tabular-nums text-g-green" style={{ textShadow: "0 0 22px rgba(62,148,104,0.5)" }}><span className="text-[14px]">▲</span> ${value.toLocaleString("en-US")}<span className="text-[11px] font-bold text-g-ink">{t("/mo", "/mês", "/mes", "/माह")}</span></div>
                </div>
              </div>

              {/* how pricing works — the margin-protecting hybrid model (minutes included + outcome-based) */}
              <p className="relative mt-3 text-[11px] leading-relaxed text-g-muted">
                {t(
                  "Monthly plan with AI minutes included + you only pay extra for results Gui actually delivers.",
                  "Plano mensal com minutos de IA inclusos + você só paga a mais pelo que o Gui realmente fizer (resultado).",
                  "Plan mensual con minutos de IA incluidos + solo pagas extra por los resultados que Gui realmente entrega.",
                  "AI मिनटों सहित मासिक प्लान + आप सिर्फ़ उन नतीजों के लिए अतिरिक्त देते हैं जो Gui वाक़ई देती है।")}
              </p>

              {/* contact — where to send the quote */}
              <div className="relative mt-5 space-y-2.5">
                <input value={name} onChange={(e) => setName(e.target.value)} aria-label={t("Your name", "Seu nome", "Tu nombre", "आपका नाम")} placeholder={t("Your name", "Seu nome", "Tu nombre", "आपका नाम")} className={field} />
                <input required value={contact} onChange={(e) => setContact(e.target.value)} aria-label={t("WhatsApp / phone / email", "WhatsApp / telefone / e-mail", "WhatsApp / teléfono / correo", "WhatsApp / फ़ोन / ईमेल")} placeholder={t("WhatsApp / phone / email", "WhatsApp / telefone / e-mail", "WhatsApp / teléfono / correo", "WhatsApp / फ़ोन / ईमेल")} className={field} />
              </div>

              {/* SPEED-TO-LEAD opt-in — explicit consent for an immediate AI call (TCPA-safe) */}
              <label className={`relative mt-2.5 flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-2.5 transition ${callNow ? "border-fuchsia-400/50 bg-fuchsia-500/[0.08]" : "border-white/10 bg-white/[0.02] hover:border-fuchsia-400/30"}`}>
                <input type="checkbox" checked={callNow} onChange={(e) => setCallNow(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-fuchsia-500" />
                <span className="text-[12.5px] leading-snug text-g-light">
                  <span className="font-bold text-g-word">📞 {t("Have Gui call me now", "Quero que a Gui me ligue agora", "Quiero que Gui me llame ahora", "Gui अभी मुझे कॉल करे")}</span>
                  <span className="block text-[11px] text-g-muted">{t("I authorize Gui (AI) to call this number now — hear it live in ~60s.", "Autorizo a Gui (IA) a ligar neste número agora — ouça ao vivo em ~60s.", "Autorizo a Gui (IA) a llamar a este número ahora — escúchalo en vivo en ~60s.", "मैं Gui (AI) को अभी इस नंबर पर कॉल करने की अनुमति देता/देती हूँ — ~60 सेकंड में लाइव सुनें।")}</span>
                </span>
              </label>

              <button type="submit" disabled={state === "sending" || !contact.trim()}
                className="group relative mt-4 w-full overflow-hidden rounded-full py-3.5 text-[15px] font-black tracking-tight text-white shadow-[0_16px_44px_-10px_rgba(217,70,239,0.75)] transition-transform duration-300 hover:scale-[1.02] active:scale-95 disabled:opacity-60"
                style={{ background: "linear-gradient(110deg,#ec4899 0%,#d946ef 45%,#a855f7 100%)" }}>
                <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/45 to-transparent transition-transform duration-[900ms] group-hover:translate-x-full" />
                <span className="relative">{state === "sending" ? t("Sending…", "Enviando…", "Enviando…", "भेज रहे हैं…") : t("Get my tailored quote →", "Receber meu orçamento →", "Recibir mi cotización →", "मेरा अनुकूलित कोट पाएँ →")}</span>
              </button>
              <p className="relative mt-3 text-center text-[11px] text-g-muted">{t("No spam · a human reviews it with you · 30-day money-back", "Sem spam · um humano revisa com você · garantia de 30 dias", "Sin spam · una persona lo revisa contigo · garantía de 30 días", "कोई स्पैम नहीं · एक इंसान आपके साथ इसकी समीक्षा करता है · 30-दिन मनी-बैक")}</p>
            </>
          )}
        </div>
      </form>
      </div>
    </section>
  );
}
