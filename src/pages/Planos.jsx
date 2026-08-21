import { useEffect } from "react";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import VoiceAgent from "../components/VoiceAgent";
import { waLink } from "../data/contact.js";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";
import { SELF_SERVE_PLANS } from "../data/selfServePlans.js";
import { trackSubscribe } from "../lib/analytics.js";
import { fmtMoneyUSD } from "../lib/intl.js";
import PricingConfigurator from "../components/PricingConfigurator";
import { Reveal } from "../lib/ui.jsx";

const T = {
  en: { eyebrow: "Self-service · start in minutes", h1: "Start your AI in minutes", sub: "Pick a plan, pay securely, and you're live. Your connection code lands in your inbox — log in and watch Gui work. Cancel anytime, 30-day money-back.", mo: "/mo", credits: "credits / month", subscribe: "Subscribe →", talk: "Talk to us →", guarantee: "30-day money-back · cancel anytime · no setup fee", cardG: "🛡️ 30-day money-back · cancel anytime", bigger: "Need a done-for-you setup, your own number and a dedicated build?", biggerCta: "See the tailored package →", trySub: "Not sure yet?", tryCta: "Let Gui call you first — free live demo →", faqT: "Quick questions", faq: [["What's a credit?", "Roughly one task Gui does for you — an answered call, a booking made, a follow-up sent (~5 credits per call answered). Your plan renews them monthly."], ["Can I cancel anytime?", "Yes — one click, no contract, no cancellation fee. And every plan starts with a 30-day money-back guarantee."], ["How fast am I live?", "Minutes. Pay → your connection code arrives by email → your AI is already trained for your business type."]] },
  pt: { eyebrow: "Auto-serviço · comece em minutos", h1: "Ative sua IA em minutos", sub: "Escolha um plano, pague com segurança e já fica no ar. Seu código de conexão chega no e-mail — entre e veja o Gui trabalhando. Cancele quando quiser, 30 dias de garantia.", mo: "/mês", credits: "créditos / mês", subscribe: "Assinar →", talk: "Falar com a gente →", guarantee: "30 dias de garantia · cancele quando quiser · sem taxa de setup", cardG: "🛡️ 30 dias de garantia · cancele quando quiser", bigger: "Precisa de tudo pronto, número próprio e um projeto sob medida?", biggerCta: "Ver o pacote sob medida →", trySub: "Ainda em dúvida?", tryCta: "Deixe a Gui te ligar primeiro — demo grátis →", faqT: "Perguntas rápidas", faq: [["O que é um crédito?", "Mais ou menos uma tarefa que a Gui faz por você — uma ligação atendida, uma reserva feita, um follow-up enviado (~5 créditos por ligação). Renovam todo mês."], ["Posso cancelar quando quiser?", "Sim — um clique, sem contrato, sem multa. E todo plano começa com 30 dias de garantia."], ["Em quanto tempo fico no ar?", "Minutos. Pagou → o código de conexão chega no e-mail → sua IA já vem treinada pro seu tipo de negócio."]] },
  es: { eyebrow: "Autoservicio · empieza en minutos", h1: "Activa tu IA en minutos", sub: "Elige un plan, paga con seguridad y quedas en marcha. Tu código de conexión llega a tu correo — entra y mira a Gui trabajar. Cancela cuando quieras, 30 días de garantía.", mo: "/mes", credits: "créditos / mes", subscribe: "Suscribirme →", talk: "Hablar con nosotros →", guarantee: "30 días de garantía · cancela cuando quieras · sin cargo de instalación", cardG: "🛡️ 30 días de garantía · cancela cuando quieras", bigger: "¿Necesitas todo hecho por nosotros, tu propio número y un proyecto a medida?", biggerCta: "Ver el paquete a medida →", trySub: "¿Aún con dudas?", tryCta: "Deja que Gui te llame primero — demo gratis →", faqT: "Preguntas rápidas", faq: [["¿Qué es un crédito?", "Más o menos una tarea que Gui hace por ti — una llamada atendida, una reserva hecha, un seguimiento enviado (~5 créditos por llamada). Se renuevan cada mes."], ["¿Puedo cancelar cuando quiera?", "Sí — un clic, sin contrato, sin penalización. Y todo plan empieza con 30 días de garantía."], ["¿Qué tan rápido quedo en marcha?", "Minutos. Pagas → el código de conexión llega a tu correo → tu IA ya viene entrenada para tu tipo de negocio."]] },
  hi: { eyebrow: "सेल्फ़-सर्विस · मिनटों में शुरू", h1: "मिनटों में अपनी AI शुरू करें", sub: "प्लान चुनें, सुरक्षित भुगतान करें और आप लाइव हैं। आपका कनेक्शन कोड ईमेल में आता है — लॉग इन करें और Gui को काम करते देखें। कभी भी रद्द करें, 30-दिन मनी-बैक।", mo: "/माह", credits: "क्रेडिट / माह", subscribe: "सब्सक्राइब करें →", talk: "हमसे बात करें →", guarantee: "30-दिन मनी-बैक · कभी भी रद्द करें · कोई सेटअप शुल्क नहीं", cardG: "🛡️ 30-दिन मनी-बैक · कभी भी रद्द करें", bigger: "सब कुछ तैयार, अपना नंबर और समर्पित सेटअप चाहिए?", biggerCta: "कस्टम पैकेज देखें →", trySub: "अभी पक्का नहीं?", tryCta: "पहले Gui को कॉल करने दें — मुफ़्त लाइव डेमो →", faqT: "झटपट सवाल", faq: [["क्रेडिट क्या है?", "मोटे तौर पर एक काम जो Gui आपके लिए करती है — एक उठाई कॉल, एक बुकिंग, एक भेजा फ़ॉलो-अप (~5 क्रेडिट प्रति कॉल)। प्लान इन्हें हर महीने रिन्यू करता है।"], ["क्या मैं कभी भी रद्द कर सकता हूँ?", "हाँ — एक क्लिक, कोई अनुबंध नहीं, कोई शुल्क नहीं। और हर प्लान 30-दिन मनी-बैक गारंटी से शुरू होता है।"], ["कितनी जल्दी लाइव होता हूँ?", "मिनटों में। भुगतान करें → कनेक्शन कोड ईमेल से आता है → आपकी AI आपके व्यवसाय-प्रकार के लिए पहले से ट्रेन्ड होती है।"]] },
};

export default function Planos() {
  const { lang } = useLang();
  const L = T[lang] || T.en;
  useSeo({
    title: lang === "pt" ? "Planos Guileo — ative sua IA a partir de US$ 149/mês" : lang === "es" ? "Planes Guileo — activa tu IA desde $149/mes" : "Guileo Plans — start your AI from $149/mo",
    description: lang === "pt" ? "Planos de auto-serviço da Guileo: Essential US$ 149, Personalized US$ 897, Full Operation US$ 1.997/mês. IA que atende, agenda e vende 24/7. No ar em minutos, 30 dias de garantia." : "Guileo self-service plans: Essential $149, Personalized $897, Full Operation $1,997/mo. AI that answers, books and sells 24/7. Live in minutes, 30-day money-back.",
    path: "/planos",
  });

  // Product + FAQ structured data — the money page had ZERO schema (SEO audit).
  // Same safe pattern as Vertical.jsx: <script> element with textContent (no innerHTML).
  useEffect(() => {
    const graph = [
      {
        "@context": "https://schema.org", "@type": "Product",
        name: "Guileo AI Receptionist", description: "AI that answers calls 24/7, books appointments, takes orders and sells for local businesses.",
        brand: { "@type": "Brand", name: "Guileo" },
        offers: SELF_SERVE_PLANS.map((p) => ({ "@type": "Offer", name: p.name, price: String(p.price), priceCurrency: "USD", url: "https://guileoai.com/planos", availability: "https://schema.org/InStock" })),
      },
      {
        "@context": "https://schema.org", "@type": "FAQPage",
        mainEntity: T.en.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
      },
    ];
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.id = "planos-jsonld";
    s.textContent = JSON.stringify(graph);
    document.head.appendChild(s);
    return () => { document.getElementById("planos-jsonld")?.remove(); };
  }, []);

  return (
    <div className="min-h-screen text-g-ink">
      <Navbar />
      <main className="max-w-6xl mx-auto px-5 sm:px-8 pt-28 pb-20">
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-block text-[11px] font-black uppercase tracking-[0.14em] text-g-gold border border-g-gold/25 bg-g-gold/[0.08] rounded-full px-3 py-1">{L.eyebrow}</span>
          <h1 className="mt-4 text-4xl sm:text-5xl font-black text-g-word tracking-tight">{L.h1}</h1>
          <p className="mt-4 text-base sm:text-lg text-g-light/85 leading-relaxed">{L.sub}</p>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-5 items-start">
          {SELF_SERVE_PLANS.map((p, i) => {
            const feats = p.features[lang] || p.features.en;
            // Seller/referral hand-off: /planos?email=<client>&ref=<slug> (from the hub's
            // payment-link button OR a referral link ?ref=<b64url(email)>). Prefill the client's
            // email on the Stripe Payment Link so the payer email matches the account, and carry
            // the ref to the checkout.session as client_reference_id — Stripe echoes it back on
            // the webhook, where referral_convert / seller attribution reads it (db/referrals.sql).
            let href = p.url || waLink(`${lang === "pt" ? "Quero o plano" : lang === "es" ? "Quiero el plan" : "I want the"} ${p.name} (${fmtMoneyUSD(p.price, lang)}/${L.mo.replace("/", "")})`);
            try {
              const q = new URLSearchParams(window.location.search);
              const em = (q.get("email") || "").trim();
              let ref = (q.get("ref") || "").trim();
              // guileo_ref has ONE owner contract (App.jsx): JSON {ref, at}, 90-day window.
              // A raw string here would corrupt App.jsx's JSON.parse and break lead attribution.
              if (ref) { try { localStorage.setItem("guileo_ref", JSON.stringify({ ref: ref.slice(0, 60), at: Date.now() })); } catch { /* */ } }
              else {
                try {
                  const s = JSON.parse(localStorage.getItem("guileo_ref") || "null");
                  if (s && s.ref && (!s.at || Date.now() - s.at < 90 * 864e5)) ref = String(s.ref);
                } catch { /* legacy/corrupt value — ignore */ }
              }
              if (p.url) {
                // client_reference_id on Payment Links accepts [A-Za-z0-9_-] (base64url fits), max 200.
                const parts = [];
                if (em) parts.push(`prefilled_email=${encodeURIComponent(em)}`);
                if (ref) parts.push(`client_reference_id=${encodeURIComponent(ref.slice(0, 200))}`);
                if (parts.length) href = `${p.url}${p.url.includes("?") ? "&" : "?"}${parts.join("&")}`;
              }
            } catch { /* SSR/no-window safe */ }
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.08 }}
                className={`relative rounded-3xl border p-6 sm:p-7 backdrop-blur-xl ${p.popular ? "border-g-gold/45 bg-gradient-to-b from-g-gold/[0.1] to-white/[0.03] shadow-lift" : "border-white/10 bg-white/[0.03]"}`}>
                {p.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-wider bg-g-gold text-black rounded-full px-3 py-1 whitespace-nowrap">{p.tagline[lang] || p.tagline.en}</span>}
                <div className="text-sm font-extrabold text-g-word">{p.name}</div>
                {!p.popular && <div className="text-[11px] text-g-muted mt-0.5">{p.tagline[lang] || p.tagline.en}</div>}
                <div className="mt-3 flex items-baseline gap-1">
                  {/* fmtMoneyUSD: PT renders "US$ 149" (bare $ reads as R$ to Brazilians); en/es keep "$149".
                      The JSON-LD offers above stay numeric + priceCurrency USD — untouched. */}
                  <span className={`text-4xl font-black tracking-tight num ${p.popular ? "text-g-gold gold-glow" : "text-g-word"}`}>{fmtMoneyUSD(p.price, lang)}</span>
                  <span className="text-sm text-g-muted">{L.mo}</span>
                </div>
                <div className="mt-1 text-[12px] font-bold text-g-green">{p.credits.toLocaleString()} {L.credits}</div>
                <ul className="mt-4 space-y-2">
                  {feats.map((f, k) => <li key={k} className="flex gap-2 text-[13px] text-g-light/90 leading-snug"><span className="text-g-green mt-0.5 shrink-0">✓</span><span>{f}</span></li>)}
                </ul>
                {/* Guarantee INSIDE the card, right above the money button — where the buying
                    decision happens, not buried in gray text below the grid. */}
                <div className="mt-5 text-center text-[11px] font-semibold text-g-green/90">{L.cardG}</div>
                <a href={href} target={p.url ? "_self" : "_blank"} rel="noopener"
                  onClick={() => { if (p.url) trackSubscribe(p.name, p.price); }}
                  className={`mt-2 flex min-h-[44px] items-center justify-center text-center text-sm font-bold rounded-full py-2.5 transition ${p.popular ? "bg-gradient-to-br from-g-green to-g-dark text-white hover:scale-[1.02]" : "border border-white/15 text-g-word hover:border-g-gold/40 hover:bg-white/[0.05]"}`}>
                  {p.url ? L.subscribe : L.talk}
                </a>
              </motion.div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-[12px] text-g-muted">🛡️ {L.guarantee}</p>

        <div className="mt-14 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center max-w-2xl mx-auto">
          <p className="text-sm text-g-light/85">{L.bigger}</p>
          <a href="/consulting" className="inline-block mt-3 text-sm font-bold text-g-gold hover:underline">{L.biggerCta}</a>
        </div>

        {/* Quick FAQ — visible mirror of the FAQPage JSON-LD above (Google requires the
            schema questions to appear on the page). Same copy, native <details>. */}
        <div className="mt-12 max-w-2xl mx-auto">
          <h2 className="text-center text-lg font-black text-g-word tracking-tight">{L.faqT}</h2>
          <div className="mt-4 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.02]">
            {L.faq.map(([q, a]) => (
              <details key={q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-bold text-g-word">
                  {q}
                  <span aria-hidden className="shrink-0 text-g-green transition-transform duration-200 group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-[13px] leading-relaxed text-g-ink">{a}</p>
              </details>
            ))}
          </div>
        </div>

      {/* ── O CONFIGURADOR ACHOU CASA (2026-08-11) ─────────────────────────────────────────────
          Ele foi TIRADO da landing hoje, e a razão era boa: lá ele ficava colado no quadro dos 3
          planos, e duas máquinas de decisão vizinhas não somam — dividem. Quem já tinha escolhido
          um plano voltava à dúvida; quem montava o pacote descobria que havia cardápio pronto.
          Aqui é diferente e é por isso que ele volta: em /planos o preço JÁ É o assunto. A pessoa
          que rolou a página inteira e não se viu em nenhuma das três caixas é exatamente quem o
          configurador atende — ela não está escolhendo entre ele e um plano, está dizendo que
          nenhum plano serviu. Deixar de fora seria perder essa pessoa em silêncio.
          Tirar da landing não era "este componente é ruim", era "este componente está no lugar
          errado" — e cortar sem dar destino é jogar fora, não editar. */}
      <section className="wrap pb-16">
        <Reveal>
          <div className="mb-6 text-center">
            <div className="text-[11.5px] font-black uppercase tracking-[0.2em] text-g-gold">
              {lang === "pt" ? "✍️ Nenhum dos três serviu?" : lang === "es" ? "✍️ ¿Ninguno de los tres sirvió?" : lang === "hi" ? "✍️ तीनों में से कोई नहीं?" : "✍️ None of the three fit?"}
            </div>
            <h2 className="mt-2 font-black tracking-tight text-g-word" style={{ fontSize: "clamp(1.5rem,3vw,2.1rem)" }}>
              {lang === "pt" ? "Diga o que você quer crescer. A gente desenha o resto." : lang === "es" ? "Dinos qué quieres hacer crecer. Nosotros diseñamos el resto." : lang === "hi" ? "बताइए क्या बढ़ाना है। बाकी हम डिज़ाइन करते हैं।" : "Tell us what you want to grow. We design the rest."}
            </h2>
          </div>
          <PricingConfigurator />
        </Reveal>
      </section>
      </main>
      <Footer />
      <VoiceAgent />
    </div>
  );
}
