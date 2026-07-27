import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import VoiceAgent from "../components/VoiceAgent";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";
import { Reveal, Stagger, Item } from "../lib/ui.jsx";
import { indexForLang } from "../data/blogIndex.js"; // light metadata only — keeps article bodies out of this page's bundle

// ─────────────────────────────────────────────────────────────
// Guileo Blog — index. SEO content that ranks for the pains we
// solve (missed calls, speed-to-lead) and routes readers into the
// product. Shows posts in the current site language; falls back to
// English when a language has no posts yet.
// ─────────────────────────────────────────────────────────────

const T = {
  en: {
    seoTitle: "Guileo Blog — AI, calls, leads & growth for local business",
    seoDesc:
      "Practical guides on missed calls, speed-to-lead and AI automation for restaurants, clinics and service businesses. Stop the leaks, win more customers.",
    eyebrow: "Guileo Blog",
    h1: "Guileo Blog",
    sub: "Practical, no-fluff guides on calls, leads, speed and AI — so you stop losing customers and start winning more.",
    read: "Read article →",
    empty: "New articles are on the way.",
  },
  pt: {
    seoTitle: "Blog Guileo — IA, ligações, leads e crescimento pro seu negócio",
    seoDesc:
      "Guias práticos sobre ligações perdidas, speed-to-lead e automação com IA para restaurantes, clínicas e serviços. Pare os vazamentos, ganhe mais clientes.",
    eyebrow: "Blog Guileo",
    h1: "Blog Guileo",
    sub: "Guias práticos e diretos sobre ligações, leads, velocidade e IA — pra você parar de perder cliente e começar a ganhar mais.",
    read: "Ler artigo →",
    empty: "Novos artigos estão a caminho.",
  },
  es: {
    seoTitle: "Blog Guileo — IA, llamadas, leads y crecimiento para tu negocio",
    seoDesc:
      "Guías prácticas sobre llamadas perdidas, speed-to-lead y automatización con IA para restaurantes, clínicas y servicios. Tapa las fugas, gana más clientes.",
    eyebrow: "Blog Guileo",
    h1: "Blog Guileo",
    sub: "Guías prácticas y directas sobre llamadas, leads, velocidad e IA — para que dejes de perder clientes y ganes más.",
    read: "Leer artículo →",
    empty: "Nuevos artículos están en camino.",
  },
  hi: {
    seoTitle: "Guileo Blog — आपके व्यवसाय के लिए AI, कॉल, लीड और ग्रोथ",
    seoDesc:
      "मिस्ड कॉल, speed-to-lead और AI ऑटोमेशन पर व्यावहारिक गाइड — रेस्टोरेंट, क्लिनिक और सेवाओं के लिए।",
    eyebrow: "Guileo Blog",
    h1: "Guileo Blog",
    sub: "कॉल, लीड, गति और AI पर व्यावहारिक गाइड — ताकि आप ग्राहक खोना बंद करें और ज़्यादा जीतें।",
    read: "लेख पढ़ें →",
    empty: "नए लेख जल्द आ रहे हैं।",
  },
};

const LOCALE = { en: "en-US", pt: "pt-BR", es: "es-ES", hi: "hi-IN" };

function formatDate(iso, lang) {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString(LOCALE[lang] || "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function Blog() {
  const { lang } = useLang();
  const L = T[lang] || T.en;
  const posts = indexForLang(lang);

  useSeo({ title: L.seoTitle, description: L.seoDesc, path: "/blog" });

  return (
    <div className="min-h-screen text-g-ink">
      <Navbar />
      <main className="max-w-6xl mx-auto px-5 sm:px-8 pt-28 pb-20">

        {/* Hero */}
        <section className="text-center max-w-3xl mx-auto">
          <Reveal variant="blur">
            <span className="inline-block text-[11px] font-black uppercase tracking-[0.14em] text-g-gold border border-g-gold/25 bg-g-gold/[0.08] rounded-full px-3 py-1">{L.eyebrow}</span>
            <h1 className="mt-5 text-4xl sm:text-6xl font-black text-g-word tracking-tight leading-[1.05]">{L.h1}</h1>
            <p className="mt-5 text-base sm:text-lg text-g-light/85 leading-relaxed max-w-2xl mx-auto">{L.sub}</p>
          </Reveal>
        </section>

        {/* Post grid */}
        <section className="mt-16 sm:mt-20">
          {posts.length === 0 ? (
            <p className="text-center text-g-muted">{L.empty}</p>
          ) : (
            <Stagger className="grid sm:grid-cols-2 gap-5">
              {posts.map((p) => (
                <Item key={`${p.slug}-${p.lang}`}>
                  <Link
                    to={`/blog/${p.slug}`}
                    className="group flex h-full flex-col rounded-3xl border border-white/15 bg-white/[0.03] backdrop-blur p-6 sm:p-7 transition-all hover:border-g-gold/40 hover:bg-white/[0.05]"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-g-muted">{formatDate(p.date, lang)}</span>
                    <h2 className="mt-3 text-xl font-extrabold text-g-word leading-snug group-hover:text-g-gold transition-colors">{p.title}</h2>
                    <p className="mt-3 text-sm text-g-light/85 leading-relaxed flex-1">{p.excerpt}</p>
                    <span className="mt-5 inline-block text-sm font-bold text-g-gold">{L.read}</span>
                  </Link>
                </Item>
              ))}
            </Stagger>
          )}
        </section>

      </main>
      <Footer />
      <VoiceAgent />
    </div>
  );
}
