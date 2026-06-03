import { useState, useEffect } from "react";
import { FaGaugeHigh } from "react-icons/fa6";
import logo from "../assets/guileo-logo.png";
import { useLang } from "../i18n.jsx";
import { ScrollProgress } from "../lib/ui.jsx";

const LANGS = [["en","🇺🇸"],["pt","🇧🇷"],["es","🇪🇸"],["hi","🇮🇳"]];

export default function Navbar() {
  const { lang, setLang, t } = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", h); return () => window.removeEventListener("scroll", h);
  }, []);
  const LINKS = [[t.nav.solutions,"/#pillars"],[t.nav.engine,"/#engine"],[t.nav.industries,"/#industries"],[t.nav.results,"/#results"],[t.nav.academy,"/#academy"],[t.nav.pricing,"/#pricing"],[t.nav.services,"/servicos"]];
  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "bg-g-cream/80 backdrop-blur-xl shadow-soft border-b border-white/5" : "bg-transparent"}`}>
      <ScrollProgress />
      <nav className={`wrap flex items-center justify-between transition-all duration-300 ${scrolled ? "h-14" : "h-16"}`}>
        <a href="/" className="flex items-center gap-2 group"><img src={logo} alt="Guileo" className={`object-contain transition-all duration-300 group-hover:rotate-6 ${scrolled ? "h-8 w-8" : "h-9 w-9"}`} /><span className="text-lg font-extrabold text-g-word">Guileo</span></a>
        <div className="hidden lg:flex items-center gap-6">
          {LINKS.map(([t2,h]) => <a key={h} href={h} className="navlink text-sm font-semibold text-g-muted hover:text-g-word transition-colors">{t2}</a>)}
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 rounded-full border border-g-line bg-white/[0.06] px-1 py-1">
            {LANGS.map(([code,flag]) => (
              <button key={code} onClick={() => setLang(code)} title={code.toUpperCase()}
                className={`h-7 w-7 rounded-full text-sm transition ${lang===code ? "bg-g-green/15 scale-110" : "opacity-60 hover:opacity-100"}`}>{flag}</button>
            ))}
          </div>
          <a href="/experience.html" className="hidden xl:inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-bold text-g-muted hover:text-g-gold hover:border-g-gold/40 transition">✨ {t.nav.exp}</a>
          <a href="/portal" className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-g-gold/45 bg-g-gold/[0.08] px-3.5 py-1.5 text-xs font-extrabold text-g-gold hover:bg-g-gold/[0.18] hover:shadow-gold transition-all"><FaGaugeHigh size={13} /> {t.nav.cockpit}</a>
          <a href="#contact" className="btn text-sm hidden sm:inline-flex">{t.nav.cta}</a>
          <button onClick={() => setOpen(!open)} className="lg:hidden p-2 text-g-word" aria-label="Menu"><svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
        </div>
      </nav>
      {open && (
        <div className="lg:hidden bg-white/[0.05] backdrop-blur-md border-t border-g-line px-5 py-3 flex flex-col gap-3">
          {LINKS.map(([t2,h]) => <a key={h} href={h} onClick={()=>setOpen(false)} className="text-sm font-semibold text-g-word py-1">{t2}</a>)}
          <a href="/portal" onClick={()=>setOpen(false)} className="inline-flex items-center gap-2 text-sm font-extrabold text-g-gold py-1"><FaGaugeHigh size={13} /> {t.nav.cockpit}</a>
          <a href="/experience.html" onClick={()=>setOpen(false)} className="text-sm font-semibold text-g-muted py-1">✨ {t.nav.exp}</a>
          <a href="#contact" onClick={()=>setOpen(false)} className="btn text-sm mt-1 justify-center">{t.nav.cta}</a>
          <div className="flex gap-2 pt-2">{LANGS.map(([c,f])=><button key={c} onClick={()=>setLang(c)} className="text-lg">{f}</button>)}</div>
        </div>
      )}
    </header>
  );
}
