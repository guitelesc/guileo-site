/* MEU MÊS (2026-10-05) — o cartão da profissional no /balcao (código "bal_…" de papel profissional).
   /api/desk-eu action "meu_mes": SÓ os números dela (o servidor usa o pro_id do acesso conferido), no mês
   corrente até agora, no fuso do negócio. Mesma régua do "quem vende mais" dos Relatórios: o que passou no
   caixa com o nome dela; comissão = o % gravado em cada venda. É ESTIMATIVA — a folha da dona é o valor final. */
import { useState, useEffect } from "react";
import { tx, lang, dinheiro } from "./deskApi.js";

const T = {
  title: { en: "My month so far", pt: "Meu mês até agora", es: "Mi mes hasta ahora" },
  est: { en: "estimate", pt: "estimativa", es: "estimación" },
  done: { en: "Completed", pt: "Atendimentos", es: "Atenciones" },
  noShow: { en: "No-shows", pt: "Faltas", es: "Inasistencias" },
  services: { en: "Services", pt: "Serviços", es: "Servicios" },
  products: { en: "Products", pt: "Produtos", es: "Productos" },
  tips: { en: "Tips", pt: "Gorjetas", es: "Propinas" },
  commission: { en: "Commission", pt: "Comissão", es: "Comisión" },
  rate: { en: "on services", pt: "nos serviços", es: "en servicios" },
  unpaid: { en: "completed without checkout — not counted yet", pt: "concluídos sem caixa — ainda não contam", es: "terminadas sin cobro — aún no cuentan" },
  note: { en: "Counts what went through checkout under your name. Your final pay is the owner's payroll.", pt: "Conta o que passou no caixa com o seu nome. O valor final é o da folha da dona.", es: "Cuenta lo que pasó por caja con tu nombre. El valor final es la nómina de la dueña." },
  readFail: { en: "Couldn't load your month.", pt: "Não consegui abrir o seu mês.", es: "No pude abrir tu mes." },
  retry: { en: "Try again", pt: "Tentar de novo", es: "Reintentar" },
};

export default function DeskMeuMes({ email, dataKey }) {
  const [st, setSt] = useState({ fase: "lendo", d: null });
  const [seq, setSeq] = useState(0);
  useEffect(() => {
    let vivo = true;
    fetch("/api/desk-eu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, key: dataKey, lang: lang(), action: "meu_mes" }) })
      .then((r) => r.json().catch(() => null)).catch(() => null)
      .then((d) => { if (vivo) setSt(d?.ok === true ? { fase: "ok", d } : { fase: "erro", d: null }); });
    return () => { vivo = false; };
  }, [email, dataKey, seq]);

  if (st.fase === "lendo") return <div className="h-28 animate-pulse rounded-2xl bg-white/[0.04]" />;
  if (st.fase === "erro") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-g-muted">
        {tx(T.readFail)} <button onClick={() => setSeq((n) => n + 1)} className="ml-2 font-bold text-g-word underline">{tx(T.retry)}</button>
      </div>
    );
  }
  const d = st.d, tz = d.tz;
  const caixa = (k, v, destaque) => (
    <div className="min-w-0">
      <div className="truncate text-[11px] font-bold uppercase tracking-wide text-g-muted">{tx(k)}</div>
      <div className={`truncate font-extrabold num ${destaque ? "text-xl text-g-green" : "text-lg text-g-word"}`}>{v}</div>
    </div>
  );
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-extrabold text-g-word">{tx(T.title)}</div>
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-g-muted">{tx(T.est)}</span>
      </div>
      {/* A comissão é o número que ela procura: largura toda, sem cortar no celular. */}
      <div className="rounded-xl border border-g-green/25 bg-g-green/[0.06] px-3 py-2.5">
        <div className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{tx(T.commission)}</div>
        <div className="text-3xl font-extrabold text-g-green num">{dinheiro(d.comissao_cents, tz)}</div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {caixa(T.done, d.concluidos)}
        {caixa(T.noShow, d.faltas)}
        {caixa(T.services, dinheiro(d.servicos_cents, tz, { casas: 0 }))}
        {caixa(T.products, dinheiro(d.produtos_cents, tz, { zeroTraco: true, casas: 0 }))}
        {caixa(T.tips, dinheiro(d.gorjetas_cents, tz, { zeroTraco: true, casas: 0 }))}
      </div>
      {d.concluidos_sem_caixa > 0 && <div className="text-xs font-bold text-g-gold">⚠ {d.concluidos_sem_caixa} {tx(T.unpaid)}</div>}
      <p className="text-[11px] leading-snug text-g-muted">{d.pct_servico > 0 ? `${d.pct_servico}% ${tx(T.rate)} · ` : ""}{tx(T.note)}</p>
    </div>
  );
}
