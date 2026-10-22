import { useEffect, useRef } from "react";
import { useParams, Navigate } from "react-router-dom";
import LiveCall from "../components/LiveCall.jsx";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";
import { getCampaign, CAMPAIGN_BULLETS } from "../data/campaigns.js";
import mark from "../assets/guileo-mark.png";
import { planByKey } from "../data/guileoPlans.js";

// Lean UI chrome shared by every campaign page, in the 4 UI languages (EN·PT·ES·HI).
// Campaign-specific copy (headline, sub, bullets) lives in src/data/campaigns.js.
const UI = {
  en: {
    badge: "Live demo", proofGuarantee: "30-day money-back", proofHuman: "A real human supervises",
    howTitle: "How it works", how: [
      ["📞", "Drop your number", "Enter your number above and Gui calls your phone in seconds — try the product on yourself."],
      ["🤝", "Gui answers, books & sells", "She talks like your best rep: answers, qualifies, books with reminders and collects on the call."],
      ["🚀", "Live in 7 days", "Done-for-you goes live in under 7 days; self-serve in minutes. A real human supervises everything."],
    ],
    priceKicker: "Plans from", priceUnit: "/mo", priceNote: "30-day money-back · cancel anytime · no setup fee on self-serve",
    priceCta: "See plans", ctaFinalTitle: "Stop losing the calls you can't answer.", ctaFinal: "Let Gui call you now",
    footRights: "AI systems for local business.", footPlans: "Plans", footPrivacy: "Privacy", footTerms: "Terms",
  },
  pt: {
    badge: "Demo ao vivo", proofGuarantee: "30 dias de garantia", proofHuman: "Um humano real supervisiona",
    howTitle: "Como funciona", how: [
      ["📞", "Coloque seu número", "Digite seu número acima e a Gui liga pro seu celular em segundos — teste o produto em você."],
      ["🤝", "A Gui atende, agenda & vende", "Ela fala como seu melhor vendedor: atende, qualifica, marca com lembrete e cobra na ligação."],
      ["🚀", "No ar em 7 dias", "O feito-pra-você entra no ar em menos de 7 dias; o self-service em minutos. Um humano real supervisiona tudo."],
    ],
    priceKicker: "Planos a partir de", priceUnit: "/mês", priceNote: "30 dias de garantia · cancele quando quiser · sem taxa de setup no self-service",
    priceCta: "Ver planos", ctaFinalTitle: "Pare de perder as ligações que você não consegue atender.", ctaFinal: "Deixe a Gui te ligar agora",
    footRights: "Sistemas de IA para negócios locais.", footPlans: "Planos", footPrivacy: "Privacidade", footTerms: "Termos",
  },
  es: {
    badge: "Demo en vivo", proofGuarantee: "30 días de garantía", proofHuman: "Un humano real supervisa",
    howTitle: "Cómo funciona", how: [
      ["📞", "Pon tu número", "Escribe tu número arriba y Gui llama a tu teléfono en segundos — prueba el producto en ti."],
      ["🤝", "Gui contesta, agenda & vende", "Habla como tu mejor vendedor: contesta, califica, agenda con recordatorio y cobra en la llamada."],
      ["🚀", "En marcha en 7 días", "El hecho-para-ti entra en marcha en menos de 7 días; el self-service en minutos. Un humano real supervisa todo."],
    ],
    priceKicker: "Planes desde", priceUnit: "/mes", priceNote: "30 días de garantía · cancela cuando quieras · sin costo de setup en self-service",
    priceCta: "Ver planes", ctaFinalTitle: "Deja de perder las llamadas que no puedes contestar.", ctaFinal: "Deja que Gui te llame ahora",
    footRights: "Sistemas de IA para negocios locales.", footPlans: "Planes", footPrivacy: "Privacidad", footTerms: "Términos",
  },
  hi: {
    badge: "लाइव डेमो", proofGuarantee: "30-दिन मनी-बैक", proofHuman: "एक असली इंसान निगरानी करता है",
    howTitle: "यह कैसे काम करता है", how: [
      ["📞", "अपना नंबर डालें", "ऊपर अपना नंबर डालें और Gui सेकंडों में आपके फ़ोन पर कॉल करती है — उत्पाद खुद पर आज़माएँ।"],
      ["🤝", "Gui जवाब देती, बुक करती & बेचती है", "वह आपके बेहतरीन रेप जैसी बात करती है: जवाब देती, क्वालिफाई करती, रिमाइंडर के साथ बुक करती और कॉल पर भुगतान लेती है।"],
      ["🚀", "7 दिनों में लाइव", "डन-फ़ॉर-यू 7 दिनों से कम में लाइव; सेल्फ़-सर्व मिनटों में। एक असली इंसान सब कुछ देखता है।"],
    ],
    priceKicker: "प्लान शुरू", priceUnit: "/माह", priceNote: "30-दिन मनी-बैक · कभी भी रद्द करें · सेल्फ़-सर्व पर कोई सेटअप शुल्क नहीं",
    priceCta: "प्लान देखें", ctaFinalTitle: "जिन कॉलों को आप नहीं उठा पाते, उन्हें खोना बंद करें।", ctaFinal: "Gui को अभी कॉल करने दें",
    footRights: "स्थानीय व्यवसायों के लिए AI सिस्टम।", footPlans: "प्लान", footPrivacy: "गोपनीयता", footTerms: "शर्तें",
  },
};

// Paid-traffic campaign landing page (/lp/:slug). Ultra-lean by design: no Navbar, no
// heavy widgets, zero images beyond the mark — pure speed. ONE dominant CTA: the live
// demo that CALLS the visitor (LiveCall). noindex (paid traffic, not for organic search).
export default function CampaignLP() {
  const { slug } = useParams();
  const c = getCampaign(slug);
  const { lang, setLang } = useLang();
  const applied = useRef(false);

  // Campaign default language: apply the ad's language ONCE on arrival, unless the URL
  // carries an explicit ?lang= override (the visitor/hreflang chose deliberately). The
  // flag switcher still works afterwards — this only sets the first-paint language.
  useEffect(() => {
    if (applied.current || !c) return;
    applied.current = true;
    try {
      const q = new URLSearchParams(window.location.search).get("lang");
      if (!q && c.lang && c.lang !== lang) setLang(c.lang);
    } catch { /* SSR / private mode */ }
  }, [c]); // eslint-disable-line react-hooks/exhaustive-deps

  const L = (o) => (o && (o[lang] || o.en)) || "";

  useSeo({
    title: c ? `${L(c.headline)} | Guileo` : "Guileo",
    description: c ? L(c.sub) : "",
    path: c ? `/lp/${c.slug}` : "/lp",
  });

  // noindex,nofollow — paid-traffic pages must never compete with the organic /for/* SEO
  // pages. Injected into <head> on mount, removed on unmount so other routes stay indexable.
  useEffect(() => {
    const m = document.createElement("meta");
    m.name = "robots";
    m.content = "noindex,nofollow";
    m.id = "campaign-noindex";
    document.head.appendChild(m);
    return () => { document.getElementById("campaign-noindex")?.remove(); };
  }, []);

  if (!c) return <Navigate to="/servicos" replace />;

  const u = UI[lang] || UI.en;
  const bullets = c.bullets.map((k) => CAMPAIGN_BULLETS[k]).filter(Boolean);

  return (
    <div className="min-h-screen text-g-ink">
      {/* minimal top bar — just the brand, no nav (keeps the page single-minded) */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <a href="/" className="flex items-center gap-2">
          <img src={mark} alt="Guileo" className="h-8 w-8 object-contain" />
          <span className="text-lg font-black tracking-tight text-g-word">Guileo</span>
        </a>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-g-green/30 bg-g-green/[0.08] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-g-green">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-g-green/60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-g-green" /></span>
          {u.badge}
        </span>
      </header>

      {/* HERO — pain-first headline → gain → the ONE dominant CTA (the demo that calls) */}
      <section className="relative overflow-hidden px-5 pt-8 pb-14">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1100px_500px_at_72%_-10%,rgba(62,148,104,0.12),transparent),radial-gradient(700px_360px_at_8%_15%,rgba(214,194,154,0.06),transparent)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-g-gold/25 bg-g-gold/[0.08] px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-g-gold">
              <span className="text-base">{c.icon}</span> Guileo AI
            </span>
            <h1 className="mt-5 text-3xl font-black leading-[1.06] tracking-tight text-g-word sm:text-[2.7rem]">{L(c.headline)}</h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-g-light/85 sm:text-lg">{L(c.sub)}</p>

            {/* the 3 gain bullets — every one grounded in productFacts.js */}
            <ul className="mt-6 space-y-2.5">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-[14.5px] leading-relaxed text-g-light/90">
                  <span className="mt-[1px] shrink-0 text-lg leading-none">{b.icon}</span>
                  <span>{b[lang] || b.en}</span>
                </li>
              ))}
            </ul>

            {/* proof strip — guarantee + human supervision */}
            <div className="mt-7 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-g-green/30 bg-g-green/[0.07] px-3 py-1.5 text-[12.5px] font-semibold text-g-light">🛡️ {u.proofGuarantee}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[12.5px] font-semibold text-g-light">👤 {u.proofHuman}</span>
            </div>
          </div>

          {/* THE dominant CTA — the live demo that calls the visitor */}
          <div id="try" className="relative min-w-0 scroll-mt-20">
            <LiveCall />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — 3 lean steps */}
      <section className="px-5 py-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{u.howTitle}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {u.how.map(([ic, tt, dd], i) => (
              <div key={i} className="rounded-xl3 border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-g-green/10 text-lg ring-1 ring-g-green/25">{ic}</span>
                  <span className="text-[11px] font-black uppercase tracking-wider text-g-green">{i + 1}</span>
                </div>
                <h3 className="mt-3 text-[16px] font-black text-g-word">{tt}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-g-light/85">{dd}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICE ANCHOR — from $149 */}
      <section className="px-5 py-12">
        <div className="mx-auto max-w-2xl rounded-xl3 border border-g-gold/20 bg-g-gold/[0.05] p-8 text-center backdrop-blur-xl">
          <div className="text-[12px] font-bold uppercase tracking-[0.2em] text-g-gold">{u.priceKicker}</div>
          <div className="mt-2 text-5xl font-black text-g-word">${planByKey("starter").amount}<span className="text-lg font-bold text-g-muted">{u.priceUnit}</span></div>
          <p className="mt-3 text-[13px] text-g-muted">{u.priceNote}</p>
          <a href="/planos" className="btn-ghost mt-5 inline-flex text-sm">{u.priceCta} →</a>
        </div>
      </section>

      {/* FINAL CTA — back to the demo */}
      <section className="px-5 pb-16 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-black tracking-tight text-g-word sm:text-3xl">{u.ctaFinalTitle}</h2>
          <a href="#try" className="btn-bright mt-6 inline-flex text-sm">📞 {L(c.cta) || u.ctaFinal}</a>
        </div>
      </section>

      {/* minimal footer */}
      <footer className="border-t border-white/10 px-5 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-[12.5px] text-g-muted sm:flex-row">
          <div className="flex items-center gap-2">
            <img src={mark} alt="" className="h-5 w-5 object-contain opacity-80" />
            <span>© {new Date().getFullYear()} Guileo · {u.footRights}</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/planos" className="hover:text-g-word transition">{u.footPlans}</a>
            <a href="/privacy" className="hover:text-g-word transition">{u.footPrivacy}</a>
            <a href="/terms" className="hover:text-g-word transition">{u.footTerms}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
