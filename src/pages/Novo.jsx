import { Suspense, lazy } from "react";
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
  const NAMES = { "clareza-dental": "Clareza Dental", "nonstop-plumbers": "Nonstop Plumbers" };
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0e0d0b] text-[#948C7B]">…</div>}>
      <Page />
      <GuiLayer business={NAMES[slug] || "this business"} />
    </Suspense>
  );
}
