import logo from "../assets/guileo-mark.png";
import { useLang } from "../i18n.jsx";
import { CONTACT, waLink, bookLink } from "../data/contact.js";
import { SEO_VERTICALS } from "../data/seoVerticals.js";
const SOCIAL = [["Instagram","instagram"],["Instagram · AD","instagramAd"],["LinkedIn","linkedin"],["TikTok","tiktok"],["YouTube","youtube"],["Telegram","telegram"],["X","x"],["Google Business","google"]];
export default function Footer() {
  const { t, lang } = useLang();
  const tx = (en, pt, es, hi) => (lang === "pt" ? pt : lang === "es" ? es : lang === "hi" ? (hi ?? en) : en);
  const vName = (v) => v.name[lang] || v.name.en;
  return (
    <footer className="bg-g-deep text-white">
      <div className="wrap py-16">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="flex items-center gap-2 mb-3"><img src={logo} alt="Guileo" className="h-9 w-9 object-contain" /><span className="text-lg font-extrabold">Guileo</span></div>
            <p className="text-white/70 text-sm max-w-sm leading-relaxed">{t.footer.tagline}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a href={waLink(t.more.lead.wamsg)} target="_blank" rel="noopener" className="btn text-sm">💬 WhatsApp</a>
              <a href={bookLink()} target="_blank" rel="noopener" className="btn-gold text-sm">📅 {t.final.demo.replace(/^📅\s*/,'')}</a>
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="text-xs font-bold uppercase tracking-wide text-g-light mb-3">{t.footer.company}</div>
            <ul className="space-y-2 text-sm text-white/70">
              {/* ⚠️ UM DESTINO, UM NOME. O rodapé chamava /#industries de "Soluções" e /servicos de
                  "Serviços & Preços"; o menu chama as MESMAS páginas de "Setores" e "Serviços".
                  Dois nomes para o mesmo lugar fazem o visitante procurar uma terceira página que
                  não existe. Ficaram os nomes do MENU (é o rótulo que a pessoa vê primeiro e o que
                  sai nos prints/anúncios), lidos do MESMO dicionário do Navbar — não de uma cópia
                  em `footer.*` que voltaria a divergir. Reserva explícita em `en`, nunca em pt. */}
              <li><a href="/#industries" className="inline-block hover:text-white hover:translate-x-1 transition-all">{t.nav?.industries || "Industries"}</a></li>
              <li><a href="/servicos" className="inline-block hover:text-white hover:translate-x-1 transition-all">{t.nav?.services || "Services"}</a></li>
              <li><a href="/lead-generation" className="inline-block hover:text-white hover:translate-x-1 transition-all">🧲 {tx("Lead generation","Geração de leads","Generación de leads","लीड जनरेशन")}</a></li>
              <li><a href="/calculator" className="inline-block hover:text-white hover:translate-x-1 transition-all">🧮 {tx("Lost-lead calculator","Calculadora de leads perdidos","Calculadora de leads perdidos","खोए-लीड कैलकुलेटर")}</a></li>
              <li><a href="/blog" className="inline-block hover:text-white hover:translate-x-1 transition-all">Blog</a></li>
              <li><a href="/go-live" className="inline-block hover:text-white hover:translate-x-1 transition-all">🚀 {tx("Activate your Gui","Ativar sua Gui","Activa tu Gui","अपनी Gui एक्टिवेट करें")}</a></li>
              <li><a href="/academia" className="inline-block hover:text-white hover:translate-x-1 transition-all">{t.footer.academy}</a></li>
              <li><a href="/vendedor" className="inline-block hover:text-white hover:translate-x-1 transition-all">🧰 {tx("Seller hub","Hub do vendedor","Hub del vendedor","सेलर हब")}</a></li>
              <li><a href="/parceiro" className="inline-block hover:text-white hover:translate-x-1 transition-all">🤝 {tx("Become a partner","Seja parceiro","Sé socio","पार्टनर बनें")}</a></li>
              <li><a href="/cola" className="inline-block hover:text-white hover:translate-x-1 transition-all">📱 {tx("Pocket card","Cola de bolso","Tarjeta de bolsillo","पॉकेट कार्ड")}</a></li>
              <li><a href="/#faq" className="inline-block hover:text-white hover:translate-x-1 transition-all">{t.footer.faq}</a></li>
            </ul>
          </div>

          {/* By industry — internal links to every vertical SEO page (crawlable from every page) */}
          <div className="md:col-span-3">
            <div className="text-xs font-bold uppercase tracking-wide text-g-light mb-3">{tx("By industry","Por setor","Por industria","उद्योग अनुसार")}</div>
            <ul className="grid grid-cols-1 gap-y-2 text-sm text-white/70 sm:grid-cols-2 md:grid-cols-1">
              {SEO_VERTICALS.map((v) => (
                <li key={v.slug}><a href={`/for/${v.slug}`} className="inline-flex items-center gap-1.5 hover:text-white hover:translate-x-1 transition-all"><span aria-hidden="true">{v.icon}</span> {vName(v)}</a></li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <div className="text-xs font-bold uppercase tracking-wide text-g-light mb-3">{t.footer.findus}</div>
            <div className="flex flex-wrap gap-2">
              {SOCIAL.filter(([,k]) => CONTACT.socials[k] && CONTACT.socials[k] !== "#").map(([n,k]) => <a key={n} href={CONTACT.socials[k]} target="_blank" rel="noopener" className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:border-g-gold/60 hover:text-g-gold hover:-translate-y-0.5 transition-all">{n}</a>)}
              {SOCIAL.every(([,k]) => !CONTACT.socials[k] || CONTACT.socials[k] === "#") && (
                <a href={waLink("Hi Guileo!")} target="_blank" rel="noopener" className="rounded-full border border-g-green/40 bg-g-green/10 px-3 py-1 text-xs font-bold text-g-light hover:border-g-green/70 transition-all">💬 {tx("WhatsApp us", "Fale no WhatsApp", "Escríbenos por WhatsApp", "हमें WhatsApp करें")}</a>
              )}
            </div>
            <div className="mt-4 text-sm text-white/60"><div>📧 <a href={`mailto:${CONTACT.email}`} className="hover:text-white">{CONTACT.email}</a></div><div>🗽 New York · 🇧🇷 Cuiabá, MT</div></div>
          </div>
        </div>
        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between gap-2 text-xs text-white/60">
          <span>© 2026 Guileo · ORIGEM LTDA · Luis Teles</span>
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <a href="/privacy" className="hover:text-white">{tx("Privacy","Privacidade","Privacidad","गोपनीयता")}</a>
            <a href="/terms" className="hover:text-white">{tx("Terms","Termos","Términos","शर्तें")}</a>
            <a href="/refunds" className="hover:text-white">{tx("Refunds","Reembolso","Reembolsos","रिफ़ंड")}</a>
            <a href="/contact" className="hover:text-white">{tx("Contact","Contato","Contacto","संपर्क")}</a>
            <span className="text-white/60">EN · PT · ES · HI · {tx("Voice-first AI", "IA por voz", "IA por voz", "वॉइस-फ़र्स्ट AI")}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
