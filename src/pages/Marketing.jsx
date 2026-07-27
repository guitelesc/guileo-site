import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import VoiceAgent from "../components/VoiceAgent";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";

// /marketing — Guileo AD: the dedicated growth page. Details social media management, video
// production, paid ads & content — all framed around SALES & GROWTH. Same animated, glassy,
// realistic design language as the landing.

const SERVICES = [
  {
    ic: "🎬", rgb: "214,194,154",
    en: { tag: "Video", title: "Video that sells", desc: "Scroll-stopping reels, ads & brand films — shot, edited and optimized to convert, not just to look pretty.",
      does: ["Reels & short-form, weekly", "Ad creatives that convert", "Brand & product films", "Captions, hooks & thumbnails"], drives: "more attention → more sales" },
    pt: { tag: "Vídeo", title: "Vídeo que vende", desc: "Reels, anúncios e filmes de marca — gravados, editados e otimizados pra converter, não só pra ficar bonito.",
      does: ["Reels & short-form, toda semana", "Criativos de anúncio que convertem", "Filmes de marca & produto", "Legendas, ganchos & thumbnails"], drives: "mais atenção → mais vendas" },
    es: { tag: "Video", title: "Video que vende", desc: "Reels, anuncios y films de marca — grabados, editados y optimizados para convertir, no solo para verse bien.",
      does: ["Reels & short-form, cada semana", "Creativos de anuncio que convierten", "Films de marca & producto", "Subtítulos, ganchos & miniaturas"], drives: "más atención → más ventas" },
    hi: { tag: "वीडियो", title: "वीडियो जो बिकता है", desc: "रील्स, विज्ञापन और ब्रांड फिल्में — सिर्फ खूबसूरत दिखने के लिए नहीं, कन्वर्ट करने के लिए शूट, एडिट और ऑप्टिमाइज़ की गईं।",
      does: ["हर हफ्ते रील्स & शॉर्ट-फॉर्म", "कन्वर्ट करने वाले विज्ञापन क्रिएटिव", "ब्रांड & प्रोडक्ट फिल्में", "कैप्शन, हुक & थंबनेल"], drives: "ज़्यादा ध्यान → ज़्यादा बिक्री" },
  },
  {
    ic: "📱", rgb: "62,148,104",
    en: { tag: "Social", title: "Social, fully managed", desc: "Every channel posted, scheduled and answered for you — your AI replies to DMs & comments and turns followers into customers.",
      does: ["Posts on every platform", "DMs & comments answered 24/7", "Community & engagement", "Calendar planned for you"], drives: "followers → repeat buyers" },
    pt: { tag: "Redes", title: "Redes, 100% geridas", desc: "Cada canal postado, agendado e respondido por você — sua IA responde DMs & comentários e transforma seguidor em cliente.",
      does: ["Posts em toda plataforma", "DMs & comentários respondidos 24/7", "Comunidade & engajamento", "Calendário planejado pra você"], drives: "seguidores → clientes recorrentes" },
    es: { tag: "Redes", title: "Redes, 100% gestionadas", desc: "Cada canal publicado, programado y respondido por ti — tu IA responde DMs & comentarios y convierte seguidores en clientes.",
      does: ["Posts en cada plataforma", "DMs & comentarios respondidos 24/7", "Comunidad & engagement", "Calendario planificado para ti"], drives: "seguidores → clientes recurrentes" },
    hi: { tag: "सोशल", title: "सोशल, पूरी तरह संभाला हुआ", desc: "हर चैनल पर पोस्ट, शेड्यूल और जवाब — आपके लिए। आपकी AI DMs & कमेंट्स का जवाब देती है और फॉलोअर्स को ग्राहक बनाती है।",
      does: ["हर प्लेटफॉर्म पर पोस्ट", "DMs & कमेंट्स का 24/7 जवाब", "कम्युनिटी & एंगेजमेंट", "आपके लिए तैयार कैलेंडर"], drives: "फॉलोअर्स → बार-बार खरीदार" },
  },
  {
    ic: "📣", rgb: "194,168,120",
    en: { tag: "Ads", title: "Ads that pay back", desc: "Paid campaigns built from your real customer data — not guesses. We cut wasted spend and chase only buyers.",
      does: ["Meta · Google · TikTok ads", "Audiences from YOUR data", "−40% wasted spend", "Tracked to real revenue"], drives: "spend → measurable revenue" },
    pt: { tag: "Anúncios", title: "Anúncios que pagam", desc: "Campanhas pagas montadas com os dados reais dos seus clientes — não no chute. Cortamos desperdício e perseguimos só quem compra.",
      does: ["Anúncios Meta · Google · TikTok", "Públicos dos SEUS dados", "−40% de gasto desperdiçado", "Medido até a receita real"], drives: "investimento → receita medível" },
    es: { tag: "Anuncios", title: "Anuncios que pagan", desc: "Campañas pagadas armadas con los datos reales de tus clientes — no a ciegas. Cortamos el gasto desperdiciado y vamos solo por quien compra.",
      does: ["Anuncios Meta · Google · TikTok", "Públicos de TUS datos", "−40% de gasto desperdiciado", "Medido hasta el ingreso real"], drives: "inversión → ingreso medible" },
    hi: { tag: "विज्ञापन", title: "विज्ञापन जो खुद चुकाते हैं", desc: "आपके असली ग्राहक डेटा से बनाए गए पेड कैंपेन — अंदाज़े से नहीं। हम बर्बाद होने वाला खर्च घटाते हैं और सिर्फ खरीदारों के पीछे जाते हैं।",
      does: ["Meta · Google · TikTok विज्ञापन", "आपके डेटा से ऑडियंस", "−40% बर्बाद खर्च", "असली राजस्व तक ट्रैक"], drives: "खर्च → मापने योग्य राजस्व" },
  },
  {
    ic: "✍️", rgb: "111,184,146",
    en: { tag: "Content", title: "Content on autopilot", desc: "Posts, emails, blogs, offers & funnels — written in your voice, on schedule, designed to bring people back to buy.",
      does: ["Posts, emails & blogs", "Offers & promos that sell", "Funnels & follow-ups", "SEO & growth copy"], drives: "presence → leads → loyalty" },
    pt: { tag: "Conteúdo", title: "Conteúdo no automático", desc: "Posts, e-mails, blogs, ofertas & funis — escritos na sua voz, no calendário, feitos pra trazer gente de volta pra comprar.",
      does: ["Posts, e-mails & blogs", "Ofertas & promos que vendem", "Funis & follow-ups", "SEO & copy de crescimento"], drives: "presença → leads → fidelidade" },
    es: { tag: "Contenido", title: "Contenido en piloto automático", desc: "Posts, emails, blogs, ofertas y embudos — escritos en tu voz, en calendario, hechos para traer gente de vuelta a comprar.",
      does: ["Posts, emails & blogs", "Ofertas & promos que venden", "Embudos & follow-ups", "SEO & copy de crecimiento"], drives: "presencia → leads → fidelidad" },
    hi: { tag: "कंटेंट", title: "कंटेंट ऑटोपायलट पर", desc: "पोस्ट, ईमेल, ब्लॉग, ऑफर & फनल — आपकी आवाज़ में, तय शेड्यूल पर, लोगों को वापस खरीदने के लिए लाने को बनाए गए।",
      does: ["पोस्ट, ईमेल & ब्लॉग", "बिकने वाले ऑफर & प्रोमो", "फनल & फॉलो-अप", "SEO & ग्रोथ कॉपी"], drives: "मौजूदगी → लीड्स → वफ़ादारी" },
  },
];

const FLOW = [
  { ic: "🎬", en: ["We create", "Video, posts, ads & content — daily, in your voice."], pt: ["A gente cria", "Vídeo, posts, anúncios & conteúdo — diário, na sua voz."], es: ["Creamos", "Video, posts, anuncios & contenido — diario, en tu voz."], hi: ["हम बनाते हैं", "वीडियो, पोस्ट, विज्ञापन & कंटेंट — रोज़, आपकी आवाज़ में।"] },
  { ic: "📣", en: ["We publish", "Across every channel, scheduled & optimized."], pt: ["A gente publica", "Em todo canal, agendado & otimizado."], es: ["Publicamos", "En cada canal, programado & optimizado."], hi: ["हम प्रकाशित करते हैं", "हर चैनल पर, शेड्यूल & ऑप्टिमाइज़ किया हुआ।"] },
  { ic: "🎯", en: ["We capture", "Attention becomes leads — Gui replies & qualifies."], pt: ["A gente capta", "Atenção vira lead — o Gui responde & qualifica."], es: ["Captamos", "La atención se vuelve leads — Gui responde & califica."], hi: ["हम पकड़ते हैं", "ध्यान लीड बनता है — Gui जवाब देता है & क्वालिफाई करता है।"] },
  { ic: "💰", en: ["You grow", "Leads become sales, sales become repeat revenue."], pt: ["Você cresce", "Lead vira venda, venda vira receita recorrente."], es: ["Tú creces", "Los leads se vuelven ventas, las ventas ingreso recurrente."], hi: ["आप बढ़ते हैं", "लीड्स बिक्री बनती हैं, बिक्री बार-बार आने वाला राजस्व।"] },
];

export default function Marketing() {
  const { lang } = useLang();
  useSeo({
    title: lang === "hi" ? "Guileo AD — वीडियो, सोशल, विज्ञापन & कंटेंट जो बिकते हैं" : lang === "pt" ? "Guileo AD — vídeo, redes, anúncios e conteúdo que vendem" : lang === "es" ? "Guileo AD — video, redes, anuncios y contenido que venden" : "Guileo AD — Video, Social, Ads & Content That Sell",
    description: lang === "hi" ? "Guileo द्वारा संचालित ग्रोथ मार्केटिंग: रील्स & वीडियो, पूरी तरह प्रबंधित सोशल, Meta/Google/TikTok विज्ञापन और कंटेंट — सब बिक्री के लिए बना, ऐसी AI के साथ जो जवाब देती और लीड्स क्वालिफाई करती है।" : lang === "pt" ? "Marketing de crescimento gerido pela Guileo: reels e vídeos, redes sociais 100% geridas, anúncios Meta/Google/TikTok e conteúdo — tudo voltado pra vendas, com IA que responde e qualifica." : lang === "es" ? "Marketing de crecimiento gestionado por Guileo: reels y video, redes 100% gestionadas, anuncios Meta/Google/TikTok y contenido — todo enfocado en ventas, con IA que responde y califica." : "Growth marketing run by Guileo: reels & video, fully-managed social, Meta/Google/TikTok ads and content — all built for sales, with AI that replies and qualifies leads.",
    path: "/marketing",
  });
  const pt = lang === "pt";
  const es = lang === "es";
  const hi = lang === "hi";
  const [act, setAct] = useState(0);
  useEffect(() => { const t = setInterval(() => setAct((i) => (i + 1) % FLOW.length), 1700); return () => clearInterval(t); }, []);

  return (
    <div className="min-h-screen text-g-word">
      <style>{`
        @keyframes mkreveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes mkshine{to{background-position:220% center}}
        @keyframes mkfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes mkflow{0%{left:-8%;opacity:0}12%{opacity:1}88%{opacity:1}100%{left:104%;opacity:0}}
        @media (prefers-reduced-motion:reduce){*{animation-duration:.001ms !important}}
      `}</style>
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden px-5 pb-12 pt-28">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(800px_400px_at_50%_-5%,rgba(214,194,154,0.12),transparent),radial-gradient(700px_360px_at_80%_100%,rgba(62,148,104,0.10),transparent)]" />
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-g-gold/30 bg-g-gold/[0.08] px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-g-gold" style={{ animation: "mkreveal .7s ease both" }}>
            <span className="inline-block" style={{ animation: "mkfloat 4s ease-in-out infinite" }}>♻️</span> Guileo AD · Marketing & Growth
          </div>
          <h1 className="mt-5 font-black leading-[0.96] tracking-tight" style={{ fontSize: "clamp(2.4rem,6vw,4rem)" }}>
            <span className="block text-g-word" style={{ animation: "mkreveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>{hi ? "हम सिर्फ पोस्ट नहीं करते।" : es ? "No solo publicamos." : pt ? "A gente não posta." : "We don't just post."}</span>
            <span className="block bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "mkreveal .8s cubic-bezier(.2,.7,.2,1) .2s both, mkshine 7s linear infinite" }}>{hi ? "हम आपके व्यवसाय को बढ़ाते हैं।" : es ? "Hacemos crecer tu negocio." : pt ? "A gente faz você crescer." : "We grow your business."}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-g-ink" style={{ animation: "mkreveal .8s ease .35s both" }}>
            {hi
              ? <>वीडियो, सोशल मीडिया, विज्ञापन और कंटेंट — आपके लिए <span className="font-semibold text-g-word">बनाया, प्रकाशित & प्रबंधित</span>। सब कुछ एक ही चीज़ से जुड़ा: <span className="font-semibold text-g-green">ज़्यादा बिक्री और ग्रोथ</span>।</>
              : es
              ? <>Video, redes sociales, anuncios y contenido — <span className="font-semibold text-g-word">creados, publicados y gestionados</span> para ti. Todo atado a una sola cosa: <span className="font-semibold text-g-green">más ventas y crecimiento</span>.</>
              : pt
              ? <>Vídeo, redes sociais, anúncios e conteúdo — <span className="font-semibold text-g-word">criados, publicados e geridos</span> pra você. Tudo amarrado numa só coisa: <span className="font-semibold text-g-green">mais venda e crescimento</span>.</>
              : <>Video, social, ads & content — <span className="font-semibold text-g-word">created, published & managed</span> for you. All tied to one thing: <span className="font-semibold text-g-green">more sales and growth</span>.</>}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3" style={{ animation: "mkreveal .8s ease .5s both" }}>
            <a href="/#pricing" className="btn-bright text-base">{hi ? "मेरा पैकेज बनाएं →" : es ? "Armar mi paquete →" : pt ? "Montar meu pacote →" : "Build my package →"}</a>
            <a href="/servicos" className="btn-ghost text-base">{hi ? "हम जो करते हैं वो सब देखें" : es ? "Ver todo lo que hacemos" : pt ? "Ver tudo que fazemos" : "See everything we do"}</a>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="px-5 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="text-[12px] font-black uppercase tracking-[0.24em] text-g-green">{hi ? "हम क्या चलाते हैं" : es ? "Lo que operamos" : pt ? "O que a gente roda" : "What we run"}</div>
            <h2 className="mt-3 font-black tracking-tight" style={{ fontSize: "clamp(1.8rem,3.6vw,2.6rem)" }}>{hi ? "ग्रोथ के चार इंजन" : es ? "Cuatro motores de crecimiento" : pt ? "Quatro motores de crescimento" : "Four growth engines"}</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {SERVICES.map((s, i) => {
              const c = hi ? s.hi : es ? s.es : pt ? s.pt : s.en;
              return (
                <div key={c.title} className="group relative overflow-hidden rounded-xl3 border border-white/10 bg-white/[0.03] p-7 shadow-lift backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5"
                  style={{ animation: `mkreveal .7s cubic-bezier(.2,.7,.2,1) ${0.1 + i * 0.1}s both` }}>
                  <span aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full blur-3xl transition-opacity duration-300 group-hover:opacity-100" style={{ background: `rgba(${s.rgb},0.16)`, opacity: 0.6 }} />
                  <div className="relative flex items-center gap-3">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br text-3xl ring-1 drop-shadow-[0_3px_8px_rgba(0,0,0,0.5)]" style={{ background: `linear-gradient(135deg, rgba(${s.rgb},0.5), rgba(${s.rgb},0.15))`, boxShadow: `inset 0 0 0 1px rgba(${s.rgb},0.4)` }}>{s.ic}</div>
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-wider" style={{ color: `rgb(${s.rgb})` }}>{c.tag}</div>
                      <div className="text-[20px] font-black text-g-word">{c.title}</div>
                    </div>
                  </div>
                  <p className="relative mt-3 text-[14px] leading-relaxed text-g-ink">{c.desc}</p>
                  <ul className="relative mt-4 grid grid-cols-2 gap-x-3 gap-y-2">
                    {c.does.map((d) => <li key={d} className="flex items-start gap-1.5 text-[12.5px] font-semibold text-g-word"><span style={{ color: `rgb(${s.rgb})` }}>✓</span>{d}</li>)}
                  </ul>
                  <div className="relative mt-5 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-bold" style={{ borderColor: `rgba(${s.rgb},0.35)`, background: `rgba(${s.rgb},0.07)`, color: `rgb(${s.rgb})` }}>
                    📈 {c.drives}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FLOW — how it drives sales & growth */}
      <section className="px-5 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="text-[12px] font-black uppercase tracking-[0.24em] text-g-gold">{hi ? "यह बिक्री कैसे बनता है" : es ? "Cómo se vuelve venta" : pt ? "Como vira venda" : "How it becomes sales"}</div>
            <h2 className="mt-3 font-black tracking-tight" style={{ fontSize: "clamp(1.8rem,3.6vw,2.6rem)" }}>{hi ? "हर हिस्सा एक सेल्सपर्सन है" : es ? "Cada pieza es un vendedor" : pt ? "Toda peça é um vendedor" : "Every piece is a salesperson"}</h2>
          </div>
          <div className="relative overflow-hidden rounded-xl3 border border-g-gold/30 bg-white/[0.03] p-6 shadow-lift backdrop-blur-xl sm:p-8">
            <div className="pointer-events-none absolute inset-x-8 top-1/2 z-0 hidden h-px -translate-y-2 lg:block" style={{ background: "linear-gradient(90deg,transparent,rgba(214,194,154,0.3),rgba(62,148,104,0.3),transparent)" }}>
              <span className="absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-g-gold shadow-[0_0_16px_4px_rgba(214,194,154,0.55)]" style={{ animation: "mkflow 3.4s linear infinite" }} />
            </div>
            <div className="relative z-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {FLOW.map((f, i) => {
                const on = i === act; const c = hi ? f.hi : es ? f.es : pt ? f.pt : f.en;
                return (
                  <div key={i} className="relative">
                    <div className={`h-full rounded-2xl border p-5 transition-all duration-500 ${on ? "-translate-y-1 border-g-gold/50 bg-g-gold/[0.08] shadow-gold" : "border-g-line bg-white/[0.03]"}`}>
                      <div className={`grid h-11 w-11 place-items-center rounded-xl text-xl ring-1 ring-white/10 transition ${on ? "bg-g-gold/25" : "bg-white/[0.05]"}`}>{f.ic}</div>
                      <div className="mt-3 text-[14px] font-black uppercase tracking-wide text-g-word">{c[0]}</div>
                      <p className="mt-1.5 text-[12.5px] leading-snug text-g-ink">{c[1]}</p>
                    </div>
                    {i < FLOW.length - 1 && <span className={`absolute -right-2.5 top-1/2 z-20 hidden -translate-y-1/2 text-lg transition lg:block ${on ? "scale-125 text-g-gold" : "text-g-gold/40"}`}>→</span>}
                  </div>
                );
              })}
            </div>
            <div className="relative mx-auto mt-6 max-w-2xl rounded-full border border-g-green/25 bg-g-green/[0.06] px-5 py-2.5 text-center text-[13.5px] text-g-ink">
              {hi ? <><span className="font-semibold text-g-green">और यह दोहराता है</span> — हर ग्राहक डेटा बनता है, हर डेटा मार्केटिंग को और स्मार्ट बनाता है। इंजन हर महीने तेज़ घूमता है।</> : es ? <><span className="font-semibold text-g-green">Y se repite</span> — cada cliente se vuelve dato, cada dato hace un marketing más inteligente. El motor gira más rápido cada mes.</> : pt ? <><span className="font-semibold text-g-green">E repete</span> — cada cliente vira dado, cada dado vira marketing melhor. O motor gira mais rápido todo mês.</> : <><span className="font-semibold text-g-green">And it loops</span> — every customer becomes data, every data makes smarter marketing. The engine spins faster every month.</>}
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="px-5 py-12">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
          {[["−40%", hi ? "बर्बाद विज्ञापन खर्च" : es ? "gasto en ads desperdiciado" : pt ? "gasto em ads desperdiçado" : "wasted ad spend"], ["3×", hi ? "ज़्यादा पहुंच" : es ? "más alcance" : pt ? "mais alcance" : "more reach"], ["24/7", hi ? "हमेशा प्रकाशित" : es ? "siempre publicando" : pt ? "sempre publicando" : "always publishing"], ["1", hi ? "टीम, एक बिल" : es ? "equipo, una cuenta" : pt ? "time, uma conta" : "team, one bill"]].map(([n, l]) => (
            <div key={l} className="rounded-2xl border border-g-line bg-white/[0.03] p-5 text-center">
              <div className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-[30px] font-black text-transparent">{n}</div>
              <div className="mt-1 text-[11.5px] font-semibold uppercase tracking-wide text-g-muted">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-20">
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-xl3 border border-white/10 bg-gradient-to-b from-g-green/[0.08] to-white/[0.02] p-10 text-center shadow-lift backdrop-blur-xl">
          <span aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-g-green/15 blur-3xl" style={{ animation: "mkfloat 6s ease-in-out infinite" }} />
          <h2 className="relative font-black tracking-tight" style={{ fontSize: "clamp(1.8rem,4vw,2.8rem)" }}>{hi ? "सच में बढ़ने के लिए तैयार हैं?" : es ? "¿Listo para crecer de verdad?" : pt ? "Pronto pra crescer de verdade?" : "Ready to actually grow?"}</h2>
          <p className="relative mx-auto mt-3 max-w-lg text-[15px] text-g-ink">{hi ? "सेकंडों में अपना पैकेज बनाएं — हम आपकी पूरी मार्केटिंग संभालते हैं जबकि आप व्यवसाय चलाते हैं।" : es ? "Arma tu paquete en segundos — nosotros llevamos todo tu marketing mientras tú llevas el negocio." : pt ? "Monte seu pacote em segundos — a gente cuida do marketing inteiro enquanto você toca o negócio." : "Build your package in seconds — we run your whole marketing while you run the business."}</p>
          <div className="relative mt-7 flex flex-wrap justify-center gap-3">
            <a href="/#pricing" className="btn-bright text-base">{hi ? "मेरा पैकेज बनाएं →" : es ? "Armar mi paquete →" : pt ? "Montar meu pacote →" : "Build my package →"}</a>
            <a href="/portal" className="btn-ghost text-base">{hi ? "डैशबोर्ड देखें" : es ? "Ver el panel" : pt ? "Ver o painel" : "See the dashboard"}</a>
          </div>
        </div>
      </section>

      <Footer />
      <VoiceAgent />
    </div>
  );
}
