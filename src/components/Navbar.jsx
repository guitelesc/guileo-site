import { useState, useEffect } from "react";
import { FaGaugeHigh } from "react-icons/fa6";
import logo from "../assets/guileo-mark.png";
import { useLang } from "../i18n.jsx";
import { ScrollProgress } from "../lib/ui.jsx";

const LANGS = [["en", "🇺🇸"], ["pt", "🇧🇷"], ["es", "🇪🇸"], ["hi", "🇮🇳"]];

// SERVICES = the AIs, marketing & creative we run for you. PRODUCTS = the things we build.
const SERVICES = [
  ["📞", "Voice AI agents", "Agentes de voz IA"],
  ["💬", "WhatsApp & SMS AI", "WhatsApp & SMS IA"],
  ["📣", "Ads & marketing", "Anúncios & marketing"],
  ["✍️", "Content creation", "Criação de conteúdo"],
  ["🎬", "Video production", "Produção de vídeo"],
  ["📱", "Social media mgmt", "Gestão de redes"],
  ["🤖", "AI automation", "Automação com IA"],
  ["⭐", "Reviews & reputation", "Reviews & reputação"],
];
const PRODUCTS = [
  ["🌐", "Websites", "Sites"],
  ["📲", "Mobile apps", "Apps"],
  ["⚙️", "Custom software", "Software sob medida"],
  ["🛒", "E-commerce / Shopify", "E-commerce / Shopify"],
  ["📊", "Dashboards & CRM", "Dashboards & CRM"],
  ["📅", "Booking systems", "Agendamentos"],
];

// graphite-glass dropdown (V1 grey + nvidia layered glass)
function NavMenu({ label, items, lang, blurb, to = "/servicos" }) {
  return (
    <div className="group relative">
      <button className="navlink inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-semibold text-g-muted transition-colors hover:text-g-word xl:text-sm">
        {label}
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="mt-0.5 transition-transform duration-300 group-hover:rotate-180" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {/* hover bridge (pt-3) keeps the panel open as the cursor crosses the gap */}
      <div className="invisible absolute left-1/2 top-full z-50 w-[440px] max-w-[92vw] -translate-x-1/2 translate-y-1 pt-3 opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#161512]/90 p-2 ring-1 ring-white/10 shadow-[0_44px_100px_-34px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/[0.06] to-transparent" />
          <div className="relative grid grid-cols-2 gap-0.5">
            {items.map(([ic, en, pt]) => (
              <a key={en} href={to} className="group/i flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.06]">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-lg ring-1 ring-white/10 transition-transform duration-300 group-hover/i:scale-110">{ic}</span>
                <span className="text-[13px] font-semibold text-g-word">{lang === "pt" ? pt : en}</span>
              </a>
            ))}
          </div>
          <a href={to} className="relative mt-1 flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-[12.5px] font-bold text-g-gold transition hover:bg-white/[0.07]">
            {blurb} <span>→</span>
          </a>
        </div>
      </div>
    </div>
  );
}

export default function Navbar() {
  const { lang, setLang, t } = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);
  const isPt = lang === "pt";
  const servicesLabel = t.nav?.services || "Services";
  const productsLabel = isPt ? "Produtos" : "Products";

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "border-b border-white/10 bg-[#161512]/85 shadow-[0_18px_50px_-26px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.06] backdrop-blur-2xl" : "bg-transparent"}`}>
      <ScrollProgress />
      <nav className={`wrap flex items-center justify-between gap-4 transition-all duration-300 ${scrolled ? "h-14" : "h-16"}`}>
        {/* left — logo + grouped nav */}
        <div className="flex min-w-0 items-center gap-6 xl:gap-9">
          <a href="/" className="group flex shrink-0 items-center gap-2"><img src={logo} alt="Guileo" className={`object-contain transition-all duration-300 group-hover:rotate-6 ${scrolled ? "h-8 w-8" : "h-9 w-9"}`} /><span className="text-lg font-extrabold text-g-word">Guileo</span></a>
          <div className="hidden items-center gap-4 lg:flex xl:gap-6">
            <a href="/#try" className="navlink whitespace-nowrap text-[13px] font-semibold text-g-muted transition-colors hover:text-g-word xl:text-sm">Demo</a>
            <NavMenu label={servicesLabel} items={SERVICES} lang={lang} to="/marketing" blurb={isPt ? "Marketing & crescimento →" : "Marketing & growth →"} />
            <NavMenu label={productsLabel} items={PRODUCTS} lang={lang} blurb={isPt ? "Ver tudo que construímos" : "See everything we build"} />
            <a href="/#industries" className="navlink whitespace-nowrap text-[13px] font-semibold text-g-muted transition-colors hover:text-g-word xl:text-sm">{t.nav?.industries || "Industries"}</a>
            <a href="/#pricing" className="navlink whitespace-nowrap text-[13px] font-semibold text-g-muted transition-colors hover:text-g-word xl:text-sm">{t.nav?.pricing || "Pricing"}</a>
          </div>
        </div>
        {/* right — language, experience, cockpit, CTA */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-1 py-1 ring-1 ring-white/[0.04] backdrop-blur-md lg:flex">
            {LANGS.map(([code, flag]) => (
              <button key={code} onClick={() => setLang(code)} title={code.toUpperCase()} aria-label={code.toUpperCase()} aria-pressed={lang === code}
                className={`h-7 w-7 rounded-full text-sm transition ${lang === code ? "scale-110 bg-g-green/15 ring-1 ring-g-green/30" : "opacity-60 hover:opacity-100"}`}>{flag}</button>
            ))}
          </div>
          <a href="/experience.html" className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-bold text-g-muted backdrop-blur-md transition hover:border-g-gold/40 hover:text-g-gold xl:inline-flex">✨ {t.nav?.exp || "Experience"}</a>
          <a href="/portal" className="hidden items-center gap-1.5 rounded-full border border-g-gold/45 bg-g-gold/[0.08] px-3.5 py-1.5 text-xs font-extrabold text-g-gold backdrop-blur-md transition-all hover:bg-g-gold/[0.18] hover:shadow-gold md:inline-flex"><FaGaugeHigh size={13} /> {t.nav?.cockpit || "Growth Cockpit"}</a>
          <a href="#contact" className="btn hidden text-sm sm:inline-flex">{t.nav?.cta || "Get Started"}</a>
          <button onClick={() => setOpen(!open)} className="p-2 text-g-word lg:hidden" aria-label="Menu" aria-expanded={open}><svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg></button>
        </div>
      </nav>

      {/* mobile menu — graphite glass, grouped */}
      {open && (
        <div className="flex flex-col gap-4 border-t border-white/10 bg-[#161512]/95 px-5 py-4 backdrop-blur-2xl lg:hidden">
          <a href="/#try" onClick={() => setOpen(false)} className="text-sm font-semibold text-g-word">Demo</a>
          <div>
            <div className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-g-green">{servicesLabel}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {SERVICES.map(([ic, en, pt]) => <a key={en} href="/servicos" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-2 text-[12.5px] font-semibold text-g-word">{ic} {isPt ? pt : en}</a>)}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-g-gold">{productsLabel}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {PRODUCTS.map(([ic, en, pt]) => <a key={en} href="/servicos" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-2 text-[12.5px] font-semibold text-g-word">{ic} {isPt ? pt : en}</a>)}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/#industries" onClick={() => setOpen(false)} className="text-sm font-semibold text-g-muted">{t.nav?.industries || "Industries"}</a>
            <a href="/#pricing" onClick={() => setOpen(false)} className="text-sm font-semibold text-g-muted">{t.nav?.pricing || "Pricing"}</a>
          </div>
          <a href="/portal" onClick={() => setOpen(false)} className="inline-flex items-center gap-2 text-sm font-extrabold text-g-gold"><FaGaugeHigh size={13} /> {t.nav?.cockpit || "Growth Cockpit"}</a>
          <a href="#contact" onClick={() => setOpen(false)} className="btn mt-1 justify-center text-sm">{t.nav?.cta || "Get Started"}</a>
          <div className="flex gap-2 pt-1">{LANGS.map(([c, f]) => <button key={c} onClick={() => setLang(c)} aria-label={c.toUpperCase()} aria-pressed={lang === c} className="text-lg">{f}</button>)}</div>
        </div>
      )}
    </header>
  );
}
