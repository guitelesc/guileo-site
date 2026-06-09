import logo from "../assets/guileo-mark.png";
import { useLang } from "../i18n.jsx";
import { CONTACT, waLink, bookLink } from "../data/contact.js";
const SOCIAL = [["Instagram","instagram"],["LinkedIn","linkedin"],["TikTok","tiktok"],["YouTube","youtube"],["Telegram","telegram"],["X","x"],["Google Business","google"]];
export default function Footer() {
  const { t } = useLang();
  return (
    <footer className="bg-g-deep text-white">
      <div className="wrap py-16">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-2 mb-3"><img src={logo} alt="Guileo" className="h-9 w-9 object-contain" /><span className="text-lg font-extrabold">Guileo</span></div>
            <p className="text-white/70 text-sm max-w-sm leading-relaxed">{t.footer.tagline}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a href={waLink(t.more.lead.wamsg)} target="_blank" rel="noopener" className="btn text-sm">💬 WhatsApp</a>
              <a href={bookLink()} target="_blank" rel="noopener" className="btn-gold text-sm">📅 {t.final.demo.replace(/^📅\s*/,'')}</a>
            </div>
          </div>
          <div className="md:col-span-3">
            <div className="text-xs font-bold uppercase tracking-wide text-g-light mb-3">{t.footer.company}</div>
            <ul className="space-y-2 text-sm text-white/70">
              <li><a href="/#pillars" className="inline-block hover:text-white hover:translate-x-1 transition-all">{t.footer.solutions}</a></li>
              <li><a href="/servicos" className="inline-block hover:text-white hover:translate-x-1 transition-all">{t.footer.svc}</a></li>
              <li><a href="/#academy" className="inline-block hover:text-white hover:translate-x-1 transition-all">{t.footer.academy}</a></li>
              <li><a href="/#faq" className="inline-block hover:text-white hover:translate-x-1 transition-all">{t.footer.faq}</a></li>
            </ul>
          </div>
          <div className="md:col-span-4">
            <div className="text-xs font-bold uppercase tracking-wide text-g-light mb-3">{t.footer.findus}</div>
            <div className="flex flex-wrap gap-2">
              {/* only show socials that have a real URL — no dead '#' links */}
              {SOCIAL.filter(([,k]) => CONTACT.socials[k] && CONTACT.socials[k] !== "#").map(([n,k]) => <a key={n} href={CONTACT.socials[k]} target="_blank" rel="noopener" className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:border-g-gold/60 hover:text-g-gold hover:-translate-y-0.5 transition-all">{n}</a>)}
              {/* fallback while socials aren't set: WhatsApp so the section is never empty/dead */}
              {SOCIAL.every(([,k]) => !CONTACT.socials[k] || CONTACT.socials[k] === "#") && (
                <a href={waLink("Hi Guileo!")} target="_blank" rel="noopener" className="rounded-full border border-g-green/40 bg-g-green/10 px-3 py-1 text-xs font-bold text-g-light hover:border-g-green/70 transition-all">💬 WhatsApp us</a>
              )}
            </div>
            <div className="mt-4 text-sm text-white/60"><div>📧 <a href={`mailto:${CONTACT.email}`} className="hover:text-white">{CONTACT.email}</a></div><div>🗽 New York · 🇧🇷 Cuiabá, MT</div></div>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between gap-2 text-xs text-white/50">
          <span>© 2026 Guileo · Tribeca Global Inc. · Luis Teles</span>
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <a href="/privacy" className="hover:text-white">Privacy</a>
            <a href="/terms" className="hover:text-white">Terms</a>
            <span className="text-white/30">EN · PT · ES · HI · Voice-first AI</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
