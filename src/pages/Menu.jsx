import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/guileo-mark.png";

// ─────────────────────────────────────────────────────────────────────────────
// /menu — ARMA DE PITCH (não linkada no site). O cardápio done-for-you por
// módulo: cada motor que a Guileo JÁ tem rodando vira um produto nomeado com
// âncora de preço. O vendedor abre na reunião, marca os módulos que o negócio
// precisa e gera a proposta na hora. Preços = âncora do trilho sob medida —
// NÃO conflitam com os planos self-service ($149/$897/$1.997): aqui é outro
// produto (construído, operado e otimizado pelo nosso time, por módulo).
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  pt: {
    kicker: "CARDÁPIO DONE-FOR-YOU · uso interno / pitch",
    h1a: "Cada motor é um produto.",
    h1b: "Todos já construídos.",
    sub: "Não é promessa de agência: cada módulo abaixo já roda em produção na Guileo hoje. Você escolhe os que o negócio precisa, a gente instala, opera e otimiza — por módulo, todo mês.",
    total: "Cardápio completo",
    totalNote: "— e um negócio típico precisa de 2 ou 3 módulos.",
    pick: "Marque os módulos do pitch",
    sum: "Seleção",
    propose: "📄 Gerar proposta com essa seleção",
    proof: "prova",
    live: "RODANDO",
    how: "Como usar na reunião: marque 2–3 módulos que atacam a dor que o dono te contou, mostre a soma — e feche com a demo da Gui ligando pra ele. O preço final é sob medida: esses valores são a régua, não a tabela.",
    back: "← Cola de bolso",
    rule: "Regra da casa: esse link não vai pro cliente. O que vai é a PROPOSTA gerada aqui.",
  },
  en: {
    kicker: "DONE-FOR-YOU MENU · internal / pitch use",
    h1a: "Every engine is a product.",
    h1b: "All already built.",
    sub: "Not an agency promise: every module below already runs in production at Guileo today. Pick the ones the business needs — we install, operate and optimize, per module, every month.",
    total: "Full menu",
    totalNote: "— and a typical business needs 2 or 3 modules.",
    pick: "Check the modules for this pitch",
    sum: "Selection",
    propose: "📄 Generate proposal with this selection",
    proof: "proof",
    live: "LIVE",
    how: "How to use it in the meeting: check 2–3 modules that hit the pain the owner told you about, show the sum — then close with Gui calling them live. Final price is tailored: these numbers are the ruler, not the price list.",
    back: "← Pocket card",
    rule: "House rule: this link never goes to the client. The PROPOSAL generated here does.",
  },
};

// price = monthly anchor (USD). proof = live route/feature that shows it's real.
const MODULES = [
  { icon: "💗", price: 49, pt: ["Guileo Pulse", "Mede a experiência do cliente DELE a partir dos sinais que já captamos (ligação, review, agenda) — retenção, conversão de oferta e a avaliação de tudo, sem survey chato."], en: ["Guileo Pulse", "Measures HIS customers' experience from signals we already capture (calls, reviews, bookings) — retention, offer conversion and the score of everything, with no survey friction."], proof: "/pulse" },
  { icon: "🤖", price: 2500, pt: ["Recepcionista de Voz IA", "Atende toda ligação 24/7 no nome do negócio, agenda e responde como a melhor recepcionista — em 4 idiomas."], en: ["AI Voice Receptionist", "Answers every call 24/7 in the business's name, books and responds like your best front desk — in 4 languages."], proof: "/demo" },
  { icon: "📞", price: 500, pt: ["Missed-Call Text-Back + Retorno", "Perdeu a ligação? Texto na hora e a IA liga de volta sozinha. Nenhum cliente esfria."], en: ["Missed-Call Text-Back + Auto-Return", "Missed the call? Instant text and the AI calls back on its own. No lead goes cold."], proof: "/produtos" },
  { icon: "⭐", price: 750, pt: ["Máquina de Reviews", "Pede, coleta e responde avaliações 5★ no automático. Reputação vira funil."], en: ["Review Machine", "Requests, collects and answers 5★ reviews automatically. Reputation becomes a funnel."], proof: "/produtos" },
  { icon: "📋", price: 1500, pt: ["Follow-Up de Leads", "Todo lead perseguido até resposta: ligação, SMS, e-mail — sequência que não esquece ninguém."], en: ["Lead Follow-Up System", "Every lead chased to an answer: call, SMS, email — a sequence that forgets no one."], proof: "/produtos" },
  { icon: "🔁", price: 1500, pt: ["Reengajamento + Anti-Churn", "Detecta o cliente fiel sumindo e o traz de volta antes de virar ex-cliente."], en: ["Re-Engagement + Churn Shield", "Detects the loyal customer drifting away and wins them back before they're gone."], proof: "/produtos" },
  { icon: "📅", price: 800, pt: ["Lembretes + Escudo No-Show", "Confirmações inteligentes + risco de falta calculado por cliente. Agenda cheia de verdade."], en: ["Reminders + No-Show Shield", "Smart confirmations + per-customer no-show risk. A schedule that actually holds."], proof: "/produtos" },
  { icon: "⚡", price: 2000, pt: ["Speed-to-Lead 60s", "Lead novo (site, Yelp, formulário) recebe ligação da IA em ~60 segundos. Velocidade fecha."], en: ["Speed-to-Lead 60s", "New lead (site, Yelp, form) gets an AI call in ~60 seconds. Speed closes."], proof: "/produtos" },
  { icon: "🏗️", price: 3000, pt: ["CRM Completo (Company OS)", "Toda conversa vira cadastro, histórico e próximo passo — o negócio inteiro numa espinha só."], en: ["Full Backend CRM (Company OS)", "Every conversation becomes a record, history and next step — the whole business on one spine."], proof: "/portal" },
  { icon: "📊", price: 1500, pt: ["Growth Cockpit", "~30 telas de operação real: ligações, agenda, pagamentos, campanhas. O dono VÊ funcionando."], en: ["Growth Cockpit Dashboard", "~30 screens of live operation: calls, schedule, payments, campaigns. The owner SEES it working."], proof: "/portal" },
  { icon: "📐", price: 1800, pt: ["Motor de Orçamento", "A IA liga, coleta os dados do serviço e manda o orçamento por SMS+e-mail com link pra aprovar e agendar. Acima do teto, o escritório aprova antes de sair."], en: ["AI Quote Engine", "The AI calls, collects the job details and sends the quote by SMS+email with a link to approve and book. Above a set amount, the office approves before it goes out."], proof: "/produtos" },
  { icon: "🧾", price: 700, pt: ["Cobrança na Ligação", "Fechou no telefone? Link de pagamento por SMS ali mesmo. Orçamento perseguido até pagar."], en: ["Collect-on-the-Call", "Closed on the phone? Payment link by SMS right there. Quotes chased until paid."], proof: "/produtos" },
];

const fmt = (n) => "$" + n.toLocaleString("en-US");

export default function Menu() {
  const [lang, setLang] = useState("pt");
  const [sel, setSel] = useState(() => new Set());
  const t = T[lang];
  const total = useMemo(() => MODULES.reduce((s, m) => s + m.price, 0), []);
  const selTotal = useMemo(() => MODULES.filter((_, i) => sel.has(i)).reduce((s, m) => s + m.price, 0), [sel]);
  const toggle = (i) => setSel((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const propostaLink = useMemo(() => {
    const items = MODULES.filter((_, i) => sel.has(i)).map((m) => m[lang][0]).join(",");
    const p = new URLSearchParams({ to: lang === "pt" ? "Cliente" : "Client", pkg: lang === "pt" ? "Sob medida" : "Tailored", price: String(selTotal || 449), recover: "3900" });
    if (items) p.set("items", items);
    return `/proposta?${p.toString()}`;
  }, [sel, selTotal, lang]);

  return (
    <div className="min-h-screen surface-real text-g-ink" style={{ background: "#161512" }}>
      <div className="mx-auto max-w-3xl px-5 py-10">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/cola" className="flex items-center gap-2 text-[13px] text-g-muted hover:text-g-ink">{t.back}</Link>
          <div className="flex gap-1 rounded-full border border-white/10 p-1">
            {["pt", "en"].map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`rounded-full px-3 py-1 text-[12px] font-bold ${lang === l ? "bg-g-green text-white" : "text-g-muted"}`}>{l === "pt" ? "🇧🇷" : "🇺🇸"}</button>
            ))}
          </div>
        </div>

        <p className="mb-2 text-[11px] font-black tracking-[0.18em] text-g-gold">{t.kicker}</p>
        <h1 className="text-3xl font-black leading-tight sm:text-4xl">{t.h1a}<br /><span className="text-g-green">{t.h1b}</span></h1>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-g-muted">{t.sub}</p>

        <div className="mt-6 rounded-2xl border border-g-gold/25 bg-g-gold/[0.06] px-4 py-3 text-[13.5px]">
          <b className="text-g-gold">{t.total}: {fmt(total)}/mo</b> <span className="text-g-muted">{t.totalNote}</span>
        </div>

        <p className="mt-8 mb-3 text-[12px] font-black tracking-[0.14em] text-g-muted">{t.pick.toUpperCase()}</p>
        <div className="space-y-3">
          {MODULES.map((m, i) => (
            <button key={i} onClick={() => toggle(i)} className={`block w-full rounded-2xl border p-4 text-left transition ${sel.has(i) ? "border-g-green/60 bg-g-green/[0.08]" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="text-xl">{m.icon}</span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-black">{m[lang][0]}</span>
                      <span className="rounded-full bg-g-green/15 px-2 py-0.5 text-[10px] font-black tracking-wide text-g-green">● {t.live}</span>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-g-muted">{m[lang][1]}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[16px] font-black text-g-gold">{fmt(m.price)}<span className="text-[11px] text-g-muted">/mo</span></div>
                  <div className={`mt-2 inline-flex h-5 w-5 items-center justify-center rounded-md border text-[12px] ${sel.has(i) ? "border-g-green bg-g-green text-white" : "border-white/20 text-transparent"}`}>✓</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="sticky bottom-4 mt-6 rounded-2xl border border-white/10 bg-[#1d1b17]/95 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[14px]"><span className="text-g-muted">{t.sum}:</span> <b className="text-g-green">{sel.size ? `${fmt(selTotal)}/mo` : "—"}</b> <span className="text-g-muted">({sel.size} mod.)</span></div>
            <Link to={propostaLink} className={`rounded-xl px-4 py-2.5 text-[13px] font-black ${sel.size ? "bg-g-green text-white" : "pointer-events-none bg-white/10 text-g-muted"}`}>{t.propose}</Link>
          </div>
        </div>

        <p className="mt-6 text-[12.5px] leading-relaxed text-g-muted">💡 {t.how}</p>
        <p className="mt-3 text-[11.5px] text-g-muted/70">🔒 {t.rule}</p>
        <div className="mt-10 flex items-center gap-2 opacity-60"><img src={logo} alt="" className="h-5 w-5" /><span className="text-[11px] text-g-muted">Guileo · done-for-you, por módulo, operado pelo nosso time</span></div>
      </div>
    </div>
  );
}
