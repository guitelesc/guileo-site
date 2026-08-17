import { useEffect, useMemo } from "react";
import logo from "../assets/guileo-mark.png";
import { waLink } from "../data/contact.js";
import { useLang } from "../i18n.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// /proposta — the close-to-cash bridge. A tailored, print-friendly proposal the
// Growth Partner sends after the pitch. Everything is driven by URL query params,
// so a personalized link is generated in seconds — no admin panel needed:
//
//   /proposta?to=Tony&biz=Tony's Pizza&pkg=Performance + Sales&price=1497
//            &setup=990&credits=440&recover=3900&by=Luis
//            &items=Voice AI 24/7,WhatsApp,Anúncios,Agenda&pay=https://buy.stripe.com/xxxx
//
// `pay` = a Stripe Payment Link the partner creates for THIS price (Luis's action —
// no credential ever touches the code). If absent, "Aceitar e pagar" falls back to
// WhatsApp so the proposal is always actionable.
// ─────────────────────────────────────────────────────────────────────────────

const LANGS = [["en", "🇺🇸"], ["pt", "🇧🇷"], ["es", "🇪🇸"], ["hi", "🇮🇳"]];
const LANG_NAMES = { en: "English", pt: "Português", es: "Español", hi: "हिन्दी" };

// Default included items, per language (used only when ?items= is absent).
const DEFAULT_ITEMS = {
  en: ["Voice AI agent 24/7", "WhatsApp & SMS AI", "Lead capture & qualification", "Automatic follow-up", "Ads & content", "Growth Cockpit dashboard"],
  pt: ["Voice AI agent 24/7", "WhatsApp & SMS AI", "Captura e qualificação de leads", "Follow-up automático", "Anúncios & conteúdo", "Painel Growth Cockpit"],
  es: ["Agente Voice AI 24/7", "IA de WhatsApp & SMS", "Captura y calificación de leads", "Seguimiento automático", "Anuncios & contenido", "Panel Growth Cockpit"],
  hi: ["Voice AI एजेंट 24/7", "WhatsApp & SMS AI", "लीड कैप्चर और क्वालिफिकेशन", "स्वचालित फ़ॉलो-अप", "विज्ञापन & कंटेंट", "Growth Cockpit डैशबोर्ड"],
};

// Per-page 4-lang dict — PT copy preserved exactly as before.
const UI = {
  docTitle: { en: "Guileo Proposal", pt: "Proposta Guileo", es: "Propuesta Guileo", hi: "Guileo प्रस्ताव" },
  headKicker: { en: "Business proposal", pt: "Proposta comercial", es: "Propuesta comercial", hi: "व्यावसायिक प्रस्ताव" },
  headValid: { en: "valid for 7 days", pt: "válida por 7 dias", es: "válida por 7 días", hi: "7 दिनों तक मान्य" },
  propFor: { en: "Proposal", pt: "Proposta", es: "Propuesta", hi: "प्रस्ताव" },
  forWord: { en: "for", pt: "para", es: "para", hi: "के लिए —" },
  h1a: { en: "A growth system tailor-made for", pt: "Um sistema de crescimento sob medida para", es: "Un sistema de crecimiento a la medida para", hi: "एक कस्टम ग्रोथ सिस्टम, खास" },
  h1aTail: { en: ".", pt: ".", es: ".", hi: " के लिए।" },
  h1Generic: { en: "A growth system tailor-made for your business.", pt: "Um sistema de crescimento sob medida para o seu negócio.", es: "Un sistema de crecimiento a la medida para tu negocio.", hi: "आपके बिज़नेस के लिए बना कस्टम ग्रोथ सिस्टम।" },
  intro: {
    en: "Guileo installs an AI + marketing team that answers, sells and grows your business on its own, 24/7. Below, the package we designed for you — and the return it typically brings.",
    pt: "A Guileo instala um time de IA + marketing que atende, vende e faz crescer o seu negócio sozinho, 24/7. Abaixo, o pacote que desenhamos pra você — e o retorno que ele costuma trazer.",
    es: "Guileo instala un equipo de IA + marketing que atiende, vende y hace crecer tu negocio solo, 24/7. Abajo, el paquete que diseñamos para ti — y el retorno que suele traer.",
    hi: "Guileo एक AI + मार्केटिंग टीम इंस्टॉल करती है जो 24/7 खुद जवाब देती, बेचती और आपका बिज़नेस बढ़ाती है। नीचे वह पैकेज है जो हमने आपके लिए बनाया — और उससे मिलने वाला सामान्य रिटर्न।",
  },
  yourPkg: { en: "Your package", pt: "Seu pacote", es: "Tu paquete", hi: "आपका पैकेज" },
  perMonth: { en: "/mo", pt: "/mês", es: "/mes", hi: "/माह" },
  setupOnce: { en: "one-time setup", pt: "setup único", es: "setup único", hi: "एक-बार सेटअप" },
  included: { en: "What's included", pt: "O que está incluído", es: "Qué está incluido", hi: "क्या शामिल है" },
  creditsMo: { en: "Gui credits / mo", pt: "Créditos Gui / mês", es: "Créditos Gui / mes", hi: "गुई क्रेडिट / माह" },
  recovers: { en: "Typically recovers", pt: "Recupera tipicamente", es: "Recupera típicamente", hi: "आम तौर पर वापस लाती है" },
  netReturn: { en: "Estimated net return", pt: "Retorno líquido estimado", es: "Retorno neto estimado", hi: "अनुमानित शुद्ध रिटर्न" },
  seals: {
    en: [["🌱", "Live in 7 days", "From signature to a running system."], ["🛡️", "30-day guarantee", "Not happy? We refund."], ["🤝", "A human with you", "A founder runs it alongside you."]],
    pt: [["🌱", "No ar em 7 dias", "Da assinatura ao sistema rodando."], ["🛡️", "Garantia de 30 dias", "Não gostou? Devolvemos."], ["🤝", "Humano com você", "Um fundador toca junto."]],
    es: [["🌱", "En vivo en 7 días", "De la firma al sistema funcionando."], ["🛡️", "Garantía de 30 días", "¿No te gustó? Devolvemos."], ["🤝", "Humano contigo", "Un fundador lo lleva contigo."]],
    hi: [["🌱", "7 दिनों में लाइव", "साइन से चलते सिस्टम तक।"], ["🛡️", "30-दिन गारंटी", "पसंद नहीं आया? पैसा वापस।"], ["🤝", "आपके साथ इंसान", "एक फ़ाउंडर साथ चलाता है।"]],
  },
  ready: { en: "Ready to start", pt: "Pronto pra começar", es: "¿Listo para empezar", hi: "शुरू करने के लिए तैयार" },
  readyQ: { en: "?", pt: "?", es: "?", hi: "?" },
  ctaPay: { en: "Confirm below and activate your system. Secure payment.", pt: "Confirme abaixo e ative seu sistema. Pagamento seguro.", es: "Confirma abajo y activa tu sistema. Pago seguro.", hi: "नीचे पुष्टि करें और अपना सिस्टम चालू करें। सुरक्षित भुगतान।" },
  ctaWa: { en: "Confirm below and we arrange payment and kick off within 7 days.", pt: "Confirme abaixo e a gente combina o pagamento e dá início em 7 dias.", es: "Confirma abajo y coordinamos el pago y arrancamos en 7 días.", hi: "नीचे पुष्टि करें — हम भुगतान तय करेंगे और 7 दिनों में शुरुआत होगी।" },
  acceptPay: { en: "✅ Accept and pay", pt: "✅ Aceitar e pagar", es: "✅ Aceptar y pagar", hi: "✅ स्वीकारें और भुगतान करें" },
  acceptStart: { en: "✅ Accept and start", pt: "✅ Aceitar e começar", es: "✅ Aceptar y empezar", hi: "✅ स्वीकारें और शुरू करें" },
  doubt: { en: "💬 I have a question", pt: "💬 Tenho uma dúvida", es: "💬 Tengo una duda", hi: "💬 मेरा एक सवाल है" },
  print: { en: "🖨️ Print / PDF", pt: "🖨️ Imprimir / PDF", es: "🖨️ Imprimir / PDF", hi: "🖨️ प्रिंट / PDF" },
  preparedBy: { en: "Prepared by", pt: "Preparado por", es: "Preparada por", hi: "तैयारकर्ता:" },
  sig: { en: "Guileo · ORIGEM LTDA", pt: "Guileo · ORIGEM LTDA", es: "Guileo · ORIGEM LTDA", hi: "Guileo · ORIGEM LTDA" },
  waAccept: {
    en: (biz, pkg, price) => `Hi Guileo! I accept the proposal${biz ? " for " + biz : ""} (${pkg} · ${price}/mo). I want to start.`,
    pt: (biz, pkg, price) => `Oi Guileo! Aceito a proposta${biz ? " da " + biz : ""} (${pkg} · ${price}/mês). Quero começar.`,
    es: (biz, pkg, price) => `¡Hola Guileo! Acepto la propuesta${biz ? " de " + biz : ""} (${pkg} · ${price}/mes). Quiero empezar.`,
    hi: (biz, pkg, price) => `Hi Guileo! I accept the proposal${biz ? " for " + biz : ""} (${pkg} · ${price}/mo). I want to start.`,
  },
  waDoubt: {
    en: (biz) => `Hi Guileo! I have a question about the proposal${biz ? " for " + biz : ""}.`,
    pt: (biz) => `Oi Guileo! Tenho dúvida sobre a proposta${biz ? " da " + biz : ""}.`,
    es: (biz) => `¡Hola Guileo! Tengo una duda sobre la propuesta${biz ? " de " + biz : ""}.`,
    hi: (biz) => `Hi Guileo! I have a question about the proposal${biz ? " for " + biz : ""}.`,
  },
};

// Coerce a URL param to a finite number — partners hand-craft these proposal URLs in the field,
// so a typo like ?price=149o or an empty ?credits= must NEVER render "$NaN" to a prospect.
const num = (v, d = 0) => (String(v ?? "").trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : d);
const money = (v) => "$" + num(v, 0).toLocaleString("en-US");

export default function Proposta() {
  const { lang, setLang } = useLang();
  const u = (k) => (UI[k] && (UI[k][lang] || UI[k].en)) || "";
  const p = useMemo(() => new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""), []);
  const to = p.get("to") || "";
  const biz = p.get("biz") || "";
  const pkg = p.get("pkg") || "Performance + Sales";
  const price = p.get("price") || "1497";
  const setup = p.get("setup") || "";
  const credits = p.get("credits") || "440";
  const recover = p.get("recover") || "3900";
  const by = p.get("by") || "";
  const items = (p.get("items") ? p.get("items").split(",").map((s) => s.trim()).filter(Boolean) : (DEFAULT_ITEMS[lang] || DEFAULT_ITEMS.en));
  // ONLY an explicit per-deal pay link (?pay=) is used — it must match the quoted price.
  // No auto tier link (those mismatched the quote, e.g. quote $1,497 → charged $1,997).
  // Without an explicit link, "Accept" closes via WhatsApp at the EXACT quoted value.
  const payLink = p.get("pay") || "";

  // ROI line: if Gui recovers `recover`/mo and costs `price`/mo, show the net.
  const net = num(recover, 0) - num(price, 0);

  useEffect(() => { document.title = `${u("docTitle")}${to ? " · " + to : ""}`; }, [to, lang]);

  const acceptHref = payLink || waLink((UI.waAccept[lang] || UI.waAccept.en)(biz, pkg, money(price)));
  const seals = UI.seals[lang] || UI.seals.en;

  return (
    <div className="surface-real min-h-screen px-5 py-10 text-g-ink sm:py-16">
      <style>{`@media print{.no-print{display:none !important}body{background:#fff}}`}</style>

      <div className="relative z-10 mx-auto max-w-3xl">
        {/* header */}
        <div className="flex items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-2"><img src={logo} alt="Guileo" className="h-9 w-9 object-contain" /><span className="text-lg font-extrabold text-g-word">Guileo</span></a>
          <div className="flex items-center gap-3">
            <div className="no-print flex items-center gap-0.5 rounded-full border border-white/10 bg-white/[0.05] px-1 py-1">
              {LANGS.map(([code, flag]) => (
                <button key={code} onClick={() => setLang(code)} title={LANG_NAMES[code]} aria-label={LANG_NAMES[code]} aria-pressed={lang === code}
                  className={`grid h-8 w-8 place-items-center rounded-full text-sm transition ${lang === code ? "scale-110 bg-g-green/15 ring-1 ring-g-green/30" : "opacity-60 hover:opacity-100"}`}>{flag}</button>
              ))}
            </div>
            <div className="text-right text-[11px] font-bold uppercase tracking-wider text-g-muted">
              {u("headKicker")}<br /><span className="text-g-gold">{u("headValid")}</span>
            </div>
          </div>
        </div>

        {/* title */}
        <div className="mt-10">
          <div className="text-[12px] font-bold uppercase tracking-[0.22em] text-g-gold">{u("propFor")} {to ? `${u("forWord")} ${to}` : ""}</div>
          <h1 className="mt-2 font-black leading-tight text-g-word" style={{ fontSize: "clamp(1.7rem,4vw,2.6rem)" }}>
            {biz ? <>{u("h1a")} <span className="text-g-green">{biz}</span>{u("h1aTail")}</> : u("h1Generic")}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-g-ink">
            {u("intro")}
          </p>
        </div>

        {/* the package card */}
        <div className="mt-8 overflow-hidden rounded-xl3 border border-g-gold/30 bg-white/[0.04] shadow-lift">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 bg-g-gold/[0.05] p-6">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-g-gold">{u("yourPkg")}</div>
              <div className="text-2xl font-black text-g-word">{pkg}</div>
            </div>
            <div className="text-right">
              <div className="text-[34px] font-black leading-none text-g-word">{money(price)}<span className="text-base font-bold text-g-muted">{u("perMonth")}</span></div>
              {setup && <div className="mt-1 text-[12px] text-g-muted">+ {money(setup)} {u("setupOnce")}</div>}
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:grid-cols-[1.3fr_1fr]">
            {/* included */}
            <div>
              <div className="text-[12px] font-bold uppercase tracking-wider text-g-muted">{u("included")}</div>
              <ul className="mt-3 space-y-2">
                {items.map((it) => (
                  <li key={it} className="flex items-start gap-2 text-[14px] text-g-word"><span className="text-g-green">✓</span> {it}</li>
                ))}
              </ul>
            </div>
            {/* meters / ROI */}
            <div className="rounded-2xl border border-g-line bg-white/[0.03] p-5">
              <div className="flex items-baseline justify-between border-b border-white/10 pb-2">
                <span className="text-[12px] text-g-muted">{u("creditsMo")}</span>
                <span className="text-lg font-black text-g-word">{num(credits, 440).toLocaleString()}</span>
              </div>
              <div className="flex items-baseline justify-between border-b border-white/10 py-2">
                <span className="text-[12px] text-g-muted">{u("recovers")}</span>
                <span className="text-lg font-black text-g-green">{money(recover)}{u("perMonth")}</span>
              </div>
              {net > 0 && (
                <div className="mt-3 rounded-lg bg-g-green/10 p-3 text-center">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-g-green">{u("netReturn")}</div>
                  <div className="text-xl font-black text-g-word">+{money(net)}{u("perMonth")}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* timeline + guarantee */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {seals.map(([ic, t, d]) => (
            <div key={t} className="rounded-2xl border border-g-line bg-white/[0.03] p-4 text-center">
              <div className="text-2xl">{ic}</div>
              <div className="mt-2 text-[13px] font-black text-g-word">{t}</div>
              <p className="mt-1 text-[11.5px] leading-snug text-g-muted">{d}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="no-print mt-9 rounded-xl3 border border-g-green/30 bg-g-green/[0.06] p-7 text-center">
          <div className="text-lg font-black text-g-word">{u("ready")}{to ? `, ${to}` : ""}{u("readyQ")}</div>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-g-muted">
            {payLink ? u("ctaPay") : u("ctaWa")}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <a href={acceptHref} target="_blank" rel="noopener" className="btn-gold text-base">{payLink ? u("acceptPay") : u("acceptStart")}</a>
            <a href={waLink((UI.waDoubt[lang] || UI.waDoubt.en)(biz))} target="_blank" rel="noopener" className="btn text-sm">{u("doubt")}</a>
            <button onClick={() => window.print()} className="btn-ghost text-sm">{u("print")}</button>
          </div>
        </div>

        {/* signature line */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-5 text-[12px] text-g-muted">
          <span>{by ? `${u("preparedBy")} ${by} · Guileo` : u("sig")}</span>
          <span>📧 smart@guileoai.com</span>
        </div>
      </div>
    </div>
  );
}
