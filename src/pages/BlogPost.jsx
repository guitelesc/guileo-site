import { useEffect } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import VoiceAgent from "../components/VoiceAgent";
import { Magnetic } from "../lib/ui.jsx";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";
import { findPost } from "../data/blogPosts.js";
import { SEO_VERTICALS } from "../data/seoVerticals.js";

// Renders an article from structured blocks as pure React elements (no raw-HTML injection at all).
function Inline({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i} className="font-bold text-g-word">{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>
  );
}

function Block({ b }) {
  if (b.t === "h2") return <h2 className="mt-9 mb-2 text-2xl font-black tracking-tight text-g-word"><Inline text={b.x} /></h2>;
  if (b.t === "h3") return <h3 className="mt-6 mb-1.5 text-lg font-black text-g-word"><Inline text={b.x} /></h3>;
  if (b.t === "ul") return <ul className="my-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-g-ink marker:text-g-green">{b.items.map((it, j) => <li key={j}><Inline text={it} /></li>)}</ul>;
  if (b.t === "ol") return <ol className="my-3 list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed text-g-ink marker:text-g-gold">{b.items.map((it, j) => <li key={j}><Inline text={it} /></li>)}</ol>;
  return <p className="my-3 text-[15px] leading-relaxed text-g-ink"><Inline text={b.x} /></p>;
}

export default function BlogPost() {
  const { slug } = useParams();
  const { lang } = useLang();
  const post = findPost(slug, lang);

  useSeo({
    title: post ? `${post.title} | Guileo` : "Guileo Blog",
    description: post ? post.metaDesc : "Insights on AI for local business — never miss a call, a lead, or a sale.",
    path: post ? `/blog/${post.slug}` : "/blog",
  });

  // BlogPosting JSON-LD (rich results: shows date + publisher in Google). Removed on unmount.
  useEffect(() => {
    if (!post) return;
    const url = `https://guileoai.com/blog/${post.slug}`;
    const ld = {
      "@context": "https://schema.org", "@type": "BlogPosting",
      headline: post.title, description: post.metaDesc,
      inLanguage: post.lang, datePublished: post.date, dateModified: post.date,
      keywords: Array.isArray(post.keywords) ? post.keywords.join(", ") : undefined,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      image: "https://guileoai.com/og.jpg",
      author: { "@type": "Person", name: post.author || "Luis Teles", url: "https://guileoai.com/nossa-gente" },
      publisher: { "@type": "Organization", name: "Guileo", logo: { "@type": "ImageObject", url: "https://guileoai.com/apple-touch-icon.png" } },
    };
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.id = "blogpost-jsonld";
    s.textContent = JSON.stringify(ld);
    document.head.appendChild(s);
    return () => { document.getElementById("blogpost-jsonld")?.remove(); };
  }, [post]);

  if (!post) return <Navigate to="/blog" replace />;

  return (
    <div className="min-h-screen text-g-ink">
      <Navbar />
      <article className="wrap pt-28 pb-16">
        <div className="mx-auto max-w-2xl">
          <Link to="/blog" className="text-[12px] font-bold text-g-gold hover:underline">← {lang === "pt" ? "Voltar ao blog" : lang === "es" ? "Volver al blog" : "Back to blog"}</Link>
          <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-g-word sm:text-[2.4rem]">{post.title}</h1>
          <div className="mt-2 text-[12px] text-g-muted">Guileo · {post.date}</div>
          <div className="mt-6">
            {post.body.map((b, i) => <Block key={i} b={b} />)}
          </div>
          {/* closing CTA */}
          <div className="mt-10 rounded-2xl border border-g-gold/25 bg-white/[0.03] p-6 text-center backdrop-blur-sm">
            <p className="text-[15px] font-bold text-g-word">{lang === "pt" ? "Pare de perder ligações — deixe a Gui atender 24/7." : lang === "es" ? "Deja de perder llamadas — deja que Gui atienda 24/7." : "Stop losing calls — let Gui answer 24/7."}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Magnetic><a href="/#try" className="btn-bright text-sm">🎙️ {lang === "pt" ? "Ouça a Gui ao vivo" : lang === "es" ? "Escucha a Gui en vivo" : "Hear Gui live"}</a></Magnetic>
              <a href="/#pricing" className="btn-ghost text-sm">{lang === "pt" ? "Montar meu pacote" : lang === "es" ? "Armar mi paquete" : "Build my package"}</a>
            </div>
          </div>
          {/* internal links → vertical SEO pages */}
          <div className="mt-8">
            <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{lang === "pt" ? "Veja a Gui no seu setor" : lang === "es" ? "Ve a Gui en tu sector" : "See Gui in your industry"}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {SEO_VERTICALS.slice(0, 6).map((v) => (
                <a key={v.slug} href={`/for/${v.slug}`} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-g-ink transition hover:border-g-gold/40 hover:text-g-word">{v.icon} {v.name[lang] || v.name.en}</a>
              ))}
            </div>
          </div>
        </div>
      </article>
      <Footer />
      <VoiceAgent />
    </div>
  );
}
