import { SELF_SERVE_PLANS } from "../data/selfServePlans.js";
import { productById } from "../data/productSystem.js";
import { inferPlanIndex } from "./Billing.jsx";
import { tr, UI_LANG } from "../pages/Portal.jsx";

/* ═══ ESTE RECURSO NÃO ESTÁ NO SEU PLANO — E A GENTE DIZ ═════════════════════════════════════
   O cockpit não tranca nada por plano: quem paga $149 vê as mesmas telas de quem paga $1.997.
   Deixar assim e não dizer nada tem dois problemas opostos: o cliente do plano de entrada acha
   que já tem tudo (e nunca sobe), e o do topo não vê pelo que está pagando.

   🚨 CONVITE, NUNCA CADEADO. Não removo funcionalidade de ninguém — tirar acesso de quem já usa
   é o caminho mais curto para o cancelamento, e bloquear é decisão de dono, não de código.
   Isto apenas DIZ, no lugar onde o recurso vive, que ele pertence ao degrau de cima.

   🚨 SÓ EM MODO REAL E COM PLANO CONHECIDO. Em demonstração o cockpit inteiro é vitrine; e sem
   saber o plano do cliente, dizer "não está no seu plano" seria uma acusação sem base — pior que
   silêncio, porque ele pode estar pagando por isso. */
export default function NoSeuPlano({ real, produto }) {
  if (!real || !produto) return null;
  const p = productById(produto);
  if (!p) return null;

  const idx = inferPlanIndex(real.plan, undefined);
  if (idx < 0) return null;                                  // plano desconhecido → cala a boca
  const atual = SELF_SERVE_PLANS[idx];
  const planos = Array.isArray(p.plans) ? p.plans : [];
  if (!planos.length || planos.includes(atual.id)) return null;   // já tem → nada a dizer

  // o degrau MAIS BARATO que inclui este recurso — nunca empurra o topo por reflexo
  const destino = SELF_SERVE_PLANS.find((sp) => planos.includes(sp.id));
  if (!destino) return null;

  const nome = (p.name && (p.name[UI_LANG] || p.name.en)) || "";
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-g-gold/30 bg-g-gold/[0.06] px-3.5 py-2.5 backdrop-blur-sm">
      <span className="text-[15px] leading-none">{p.icon || "✨"}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-bold text-g-word">{nome}</div>
        <div className="text-[11.5px] text-g-muted">
          {tr("Runs on")} {destino.name} — {tr("you're on")} {atual.name}
        </div>
      </div>
      <a href={destino.url || "https://guileoai.com/planos"} target="_blank" rel="noopener"
        className="inline-flex min-h-[40px] shrink-0 items-center rounded-full bg-g-gold px-3.5 text-[12px] font-black text-black hover:opacity-90">
        ${destino.price}/{tr("mo")} →
      </a>
    </div>
  );
}
