/* NATURA — ASSINATURA MENSAL NO SITE (Luis, 2026-10-05: «faz a assinatura mensal no site»)
   As partes PURAS (sem rede): o interruptor, os planos de EXEMPLO e as regras do que aparece.
   Quem usa: src/novo/NaturaMembership.jsx (a tela) e functions/api/assinatura-*.js (o servidor).

   DE ONDE VÊM OS PLANOS: do portal do salão (Crescimento → Recorrência, tabela `memberships`), lidos
   por /api/assinatura-planos. Preço e nome NUNCA vêm da página: quem cobra relê o banco.
   OS EXEMPLOS só aparecem com o interruptor desligado E o banco sem plano, sempre com o selo
   "Preview · example plans". Ligado, exemplo nunca aparece (seção some se não houver plano).
   Os exemplos descrevem só o que está incluído — serviços que EXISTEM no MENU de NaturaSpa.jsx.

     node --test src/novo/naturaAssinatura.test.mjs */

export const ASSINATURA = {
  aoVivo: false,                       // true = "Join" abre o checkout. Só com plano real e Stripe do salão.
  slug: "natura-spa",
  planos: "/api/assinatura-planos",
  checkout: "/api/assinatura-checkout",
};

export const EXEMPLOS = [
  { id: "ex-massage", name: "Monthly Massage", price_cents: 9900, interval: "month",
    perks: "One 60-minute massage every month\nSwedish, Hot Stone or Deep Tissue\nAt Astoria or the Upper East Side" },
  { id: "ex-glow", name: "Monthly Glow", price_cents: 10500, interval: "month",
    perks: "One Natura Spa Signature Facial every month\nAt Astoria or the Upper East Side" },
  { id: "ex-both", name: "Massage + Facial", price_cents: 19900, interval: "month",
    perks: "One 60-minute massage every month\nOne Natura Spa Signature Facial every month\nAt Astoria or the Upper East Side" },
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MIN_CENTS = 50;           // o mínimo que o Stripe cobra em USD

/* O que o banco devolveu → o que a página pode mostrar. Só plano ATIVO, com preço, mensal ou anual.
   Nunca sai daqui o número de assinantes nem o e-mail do salão. Mais barato primeiro. */
export function planosPublicos(lista) {
  return (Array.isArray(lista) ? lista : [])
    .filter((m) => m && m.active !== false && UUID.test(String(m.id || "")) && String(m.name || "").trim()
      && Number.isInteger(m.price_cents) && m.price_cents >= MIN_CENTS && (m.interval === "month" || m.interval === "year"))
    .map((m) => ({ id: m.id, name: String(m.name).trim().slice(0, 100), price_cents: m.price_cents, interval: m.interval, perks: String(m.perks || "").slice(0, 600) }))
    .sort((a, b) => a.price_cents / (a.interval === "year" ? 12 : 1) - b.price_cents / (b.interval === "year" ? 12 : 1));
}

/* O texto livre do portal ("perks") em linhas: uma por quebra de linha, "•" ou ";". No máximo 6. */
export function perksDe(texto) {
  return String(texto || "").split(/\r?\n|•|;/).map((s) => s.replace(/^[\s\-–—*]+/, "").trim()).filter(Boolean).slice(0, 6);
}

/* $99 · $104.50 */
export const valorDe = (cents) => {
  const c = Math.round(Number(cents) || 0);
  return `$${c % 100 ? (c / 100).toFixed(2) : String(c / 100)}`;
};
export const porDe = (interval) => (interval === "year" ? "year" : "month");

/* O que a seção mostra:
     "real"     → planos do banco (Join abre o checkout só se aoVivo)
     "exemplo"  → desligado e banco sem plano (ou fora do ar): os EXEMPLOS com o selo
     "nada"     → ligado e sem plano: a seção não aparece (nunca um exemplo com botão de pagar) */
export function oQueMostrar({ aoVivo, planos }) {
  if (Array.isArray(planos) && planos.length) return "real";
  return aoVivo ? "nada" : "exemplo";
}

export const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || "").trim()) && String(e).trim().length <= 160;
