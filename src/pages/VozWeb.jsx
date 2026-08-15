// /voz/:slug — a página de VOZ do negócio. Uma tela só, na marca do cliente.
//
// POR QUE UMA PÁGINA PRÓPRIA, além do bloco dentro de /site/:slug:
//   • é um LINK. Cabe na bio do Instagram, no QR do balcão, no rodapé do e-mail, no botão do
//     widget que roda no domínio do cliente — tudo sem precisar embutir código nenhum;
//   • o widget (public/gui-widget.js) é um arquivo vanilla, sem build, servido para sites de
//     terceiros. Abrir esta página numa janela é como ele ganha voz hoje, sem virar bundler.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import VoiceWeb from "../components/VoiceWeb.jsx";

const T = {
  pt: { carregando: "Carregando…", naoachei: "Negócio não encontrado.", form: "Prefere escrever? Abrir o site",
        rodape: "Atendimento por voz", ligar: "Ligar" },
  en: { carregando: "Loading…", naoachei: "Business not found.", form: "Prefer to write? Open the site",
        rodape: "Voice support", ligar: "Call" },
  es: { carregando: "Cargando…", naoachei: "Negocio no encontrado.", form: "¿Prefieres escribir? Abrir el sitio",
        rodape: "Atención por voz", ligar: "Llamar" },
};

export default function VozWeb() {
  const { slug } = useParams();
  const [d, setD] = useState(null);
  const [estado, setEstado] = useState("loading"); // loading | ok | 404

  useEffect(() => {
    let vivo = true;
    fetch(`/api/client-site?slug=${encodeURIComponent(slug || "")}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!vivo) return; if (j && j.found) { setD(j); setEstado("ok"); } else setEstado("404"); })
      .catch(() => { if (vivo) setEstado("404"); });
    return () => { vivo = false; };
  }, [slug]);

  const lang = (d?.lang || "pt").slice(0, 2);
  const t = T[lang] || T.pt;
  const brand = d?.config?.color || "#2F6F4E";
  const nome = d?.business_name || "";
  const fone = (d?.locations || []).map((l) => l?.phone).find(Boolean) || "";

  useEffect(() => { if (estado === "ok" && nome) document.title = `${nome} · ${t.rodape}`; }, [estado, nome, t]);

  if (estado === "loading") return <div style={{ padding: 80, textAlign: "center", color: "#777" }}>{T.pt.carregando}</div>;
  if (estado === "404") return <div style={{ padding: 80, textAlign: "center", color: "#777" }}>{T.pt.naoachei}</div>;

  return (
    <div style={{ minHeight: "100vh", background: "#fff", color: "#1a1a1a", fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      <header style={{ background: `linear-gradient(160deg, ${brand} 0%, ${brand}dd 100%)`, color: "#fff", padding: "40px 20px 34px", textAlign: "center" }}>
        {d?.config?.logo_url ? <img src={d.config.logo_url} alt={nome} style={{ height: 44, marginBottom: 14 }} /> : null}
        <h1 style={{ margin: 0, fontSize: "clamp(1.5rem, 4vw, 2.1rem)", fontWeight: 700 }}>{nome}</h1>
      </header>

      <main style={{ padding: "28px 16px 40px" }}>
        <VoiceWeb slug={slug} brand={brand} business={nome} lang={lang} phone={fone} />

        {/* Sempre à vista: os caminhos que NÃO dependem de voz. */}
        <div style={{ textAlign: "center", marginTop: 20, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href={`/site/${encodeURIComponent(slug || "")}#gui-contato`} style={{ color: brand, fontWeight: 600, textDecoration: "none" }}>{t.form} →</a>
          {fone ? <a href={`tel:${fone}`} style={{ color: brand, fontWeight: 600, textDecoration: "none" }}>📞 {t.ligar}</a> : null}
        </div>
      </main>

      <footer style={{ padding: "24px 0 40px", textAlign: "center", color: "#999", fontSize: ".82rem" }}>
        <a href="https://guileoai.com" style={{ color: "#999" }}>powered by Guileo</a>
      </footer>
    </div>
  );
}
