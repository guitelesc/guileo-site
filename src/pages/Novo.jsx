import { Suspense, lazy, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import GuiLayer from "../novo/GuiLayer.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// /novo/:slug — o MOTOR WEBSITE-PORTA. Cada slug é um site reconstruído
// nível-2026 (modelo de referência ou reconstrução real de prospect), hospedado
// num link compartilhável da Guileo. Os modelos são negócios FICTÍCIOS de
// demonstração — cada um com linguagem visual própria (nada clonado).
// Para adicionar um site novo: criar src/novo/<Nome>.jsx e registrar abaixo.
// ─────────────────────────────────────────────────────────────────────────────

const REGISTRY = {
  "clareza-dental": lazy(() => import("../novo/ClarezaDental.jsx")), // clínica dental — modelo
  "nonstop-plumbers": lazy(() => import("../novo/NonstopPlumbers.jsx")), // PROSPECT REAL — reconstrução nonstopplumbers.com
};

export default function Novo() {
  const { slug } = useParams();

  // O index.html carrega o JSON-LD da GUILEO (Organization/WebSite/Service/FAQPage) em toda
  // rota do SPA. Num site reconstruído de cliente isso é defeito de SEO: o Google leria a
  // página do Nonstop como sendo da Guileo, e ficariam DOIS FAQPage brigando. Aqui os
  // estáticos são desativados enquanto o /novo está montado — e voltam ao sair.
  useEffect(() => {
    // Só os da GUILEO, marcados com data-guileo-global no index.html. Filtrar por tipo
    // derrubaria o schema do cliente (o efeito do filho roda antes do pai) e filtrar por
    // conteúdo também: as imagens DELE estão hospedadas no nosso domínio.
    const statics = Array.from(document.querySelectorAll('script[data-guileo-global]'));
    statics.forEach((el) => { el.type = "application/ld+json-disabled"; });
    return () => statics.forEach((el) => { el.type = "application/ld+json"; });
  }, []);
  const Page = REGISTRY[slug];
  if (!Page) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#161512] text-center text-[#C5BEB0]">
        <p className="text-4xl">🏗️</p>
        <p className="text-lg font-black text-[#EDE7DC]">Este link ainda não existe.</p>
        <Link to="/" className="text-sm text-[#3E9468] underline">guileoai.com</Link>
      </div>
    );
  }
  // Cada site tem sua IA com a marca E o mascote DO NEGÓCIO (nunca robozinho genérico).
  const AI = {
    "clareza-dental": { business: "Clareza Dental", label: "Ask Clareza", accent: "#0e6e6a", surface: "#10201f", phone: "+19295550107",
      mascot: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0e6e6a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5.5c-2.2-1.6-5.5-1.3-6.4 1.4-.8 2.4.4 4.6.9 7.2.3 1.7.4 3.9 1.8 3.9 1.3 0 1.4-2.3 2-4 .4-1.2 1.9-1.2 2.3 0 .6 1.7.7 4 2 4 1.4 0 1.5-2.2 1.8-3.9.5-2.6 1.7-4.8.9-7.2-.9-2.7-4.2-3-6.3-1.4Z"/></svg> },
    "nonstop-plumbers": { business: "Nonstop Plumbers", label: "Ask Nonstop", accent: "#d92a28", surface: "#0c1a2e", phone: "+12125672000",
      mascot: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d92a28" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12.5" r="7.5"/><path d="M12 8.5v4.2l2.6 1.6M9 3.2h6"/></svg> },
  };
  const cfg = AI[slug] || { business: "this business", label: "Ask us", accent: "#3E9468" };
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0e0d0b] text-[#948C7B]">…</div>}>
      <Page />
      <GuiLayer {...cfg} />
    </Suspense>
  );
}
