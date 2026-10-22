// /desk — a página do GUILEO DESK (2026-10-05). Agenda, caixa e clientes com a IA dentro.
// 2026-10-09: sem comparação com o MindBody (a Guileo pede de novo para ser parceira deles; ver MINDBODY-RECUSA.md).
// Planos e preços vêm SÓ de src/data/deskPlans.js. Nenhum número escrito aqui.
// Sem checkout próprio ainda: o botão leva para a demonstração e para falar com a equipe — não finge compra.
import { useState } from "react";
import { motion } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { waLink } from "../data/contact.js";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";
import { fmtMoneyUSD } from "../lib/intl.js";
import { DESK_PLANS, deskTxt } from "../data/deskPlans.js";

const T = {
  pt: {
    eyebrow: "Guileo Desk", h1: "O balcão inteiro do seu salão e spa. Com a IA dentro.",
    sub: "Agenda, caixa, clientes, equipe e relatórios num app só — e uma assistente de IA que abre o seu dia pronto, marca, confirma e cobra com um toque. Sem pagar uma IA à parte: aqui ela já vem.",
    demo: "Ver a demonstração", talk: "Falar com a gente",
    win: "Onde o Desk ganha", wins: [["Sua base é sua", "Exporte suas clientes quando quiser, de graça. Sem taxa de saída."], ["Sem taxa por cliente nova", "Nada de comissão sobre quem chega pela sua própria página."], ["Uma IA só", "A mesma IA que atende o seu telefone marca na sua agenda e conversa com você na Central."]],
    plans: "Planos", perUnit: "/mês por unidade", custom: "Sob consulta", inherits: "Tudo do", plus: ", mais:", depende: "Depende de você", featured: "Mais escolhido", credits: "créditos/mês",
    app: "Instala no iPad e no celular", appSub: "Abra o Balcão e toque em \"Instalar o app\": o Guileo Desk vai para a tela inicial com o ícone dele e abre direto na agenda. Versão na App Store e Play Store: em seguida.",
    note: "Preços em dólar, por unidade (cada endereço). Garantia de 30 dias.",
    wa: (p) => `Oi! Quero o Guileo Desk — plano ${p}.`, sub2: "Assinar", going: "Abrindo o pagamento…", fail: "Não consegui abrir o pagamento agora. Fale com a gente pelo WhatsApp.",
  },
  en: {
    eyebrow: "Guileo Desk", h1: "Your whole salon & spa front desk. With the AI built in.",
    sub: "Calendar, checkout, clients, team and reports in one app — plus an AI assistant that opens your day ready, books, confirms and charges in one tap. No separate AI add-on to pay for: it's included.",
    demo: "See the demo", talk: "Talk to us",
    win: "Where Desk wins", wins: [["Your client list is yours", "Export your clients anytime, free. No exit fee."], ["No fee on new clients", "No commission on people who book through your own page."], ["One AI", "The same AI that answers your phone books into your calendar and talks to you in the dashboard."]],
    plans: "Plans", perUnit: "/mo per location", custom: "Let's talk", inherits: "Everything in", plus: ", plus:", depende: "Depends on you", featured: "Most chosen", credits: "credits/mo",
    app: "Installs on iPad and phone", appSub: "Open the Desk and tap \"Install the Desk app\": Guileo Desk goes to your home screen with its own icon and opens straight on the calendar. App Store and Play Store versions: next.",
    note: "Prices in USD, per location. 30-day money-back.",
    wa: (p) => `Hi! I'd like Guileo Desk — ${p} plan.`, sub2: "Subscribe", going: "Opening checkout…", fail: "Couldn't open checkout right now. Message us on WhatsApp.",
  },
  es: {
    eyebrow: "Guileo Desk", h1: "Toda la recepción de tu salón y spa. Con la IA adentro.",
    sub: "Agenda, caja, clientas, equipo e informes en una sola app — y una asistente de IA que abre tu día listo, agenda, confirma y cobra con un toque. Sin pagar una IA aparte: aquí ya viene.",
    demo: "Ver la demo", talk: "Hablar con nosotros",
    win: "Dónde gana el Desk", wins: [["Tu base es tuya", "Exporta tus clientas cuando quieras, gratis."], ["Sin cuota por clienta nueva", "Sin comisión sobre quien reserva en tu propia página."], ["Una sola IA", "La misma IA que atiende tu teléfono agenda en tu calendario y habla contigo en el panel."]],
    plans: "Planes", perUnit: "/mes por sede", custom: "A consultar", inherits: "Todo lo de", plus: ", más:", depende: "Depende de ti", featured: "El más elegido", credits: "créditos/mes",
    app: "Se instala en iPad y celular", appSub: "Abre el Desk y toca \"Instalar la app\": Guileo Desk va a tu pantalla de inicio con su ícono y abre en la agenda. Versión App Store y Play Store: en seguida.",
    note: "Precios en dólares, por sede. Garantía de 30 días.",
    wa: (p) => `¡Hola! Quiero Guileo Desk — plan ${p}.`, sub2: "Suscribirme", going: "Abriendo el pago…", fail: "No pude abrir el pago ahora. Escríbenos por WhatsApp.",
  },
};

export default function GuileoDesk() {
  const { lang } = useLang();
  const L = T[lang] || T.en;
  const lg = T[lang] ? lang : "en";
  useSeo({
    title: lang === "pt" ? "Guileo Desk — agenda, caixa e IA para salão e spa, a partir de US$ 49/mês" : lang === "es" ? "Guileo Desk — agenda, caja e IA para salón y spa, desde $49/mes" : "Guileo Desk — calendar, checkout and AI for salons & spas, from $49/mo",
    description: L.sub.slice(0, 155),
    path: "/desk",
  });
  const nomeDe = (p) => deskTxt(p.name, lg);
  const [indo, setIndo] = useState("");
  const [falha, setFalha] = useState("");
  // Checkout de verdade: o servidor abre a assinatura no Stripe com o preço de deskPlans.js.
  const assinar = async (key) => {
    setIndo(key); setFalha("");
    try {
      const r = await fetch("/api/desk-checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: key, lang: lg }) });
      const d = await r.json().catch(() => null);
      if (d?.ok && d.url) { window.location.href = d.url; return; }
    } catch { /* cai na mensagem abaixo */ }
    setIndo(""); setFalha(key);
  };
  const porKey = Object.fromEntries(DESK_PLANS.map((p) => [p.key, p]));

  return (
    <div className="min-h-screen text-g-ink">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-28 pb-20 space-y-20">
        <section className="grid gap-10 lg:grid-cols-[1.15fr_1fr] items-center">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-g-gold">{L.eyebrow}</div>
            <h1 className="mt-3 text-4xl sm:text-5xl font-black tracking-tight leading-[1.05] text-balance">{L.h1}</h1>
            <p className="mt-5 max-w-xl text-base sm:text-lg text-g-light/90 leading-relaxed">{L.sub}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="/portal?tab=desk" className="btn-bright text-sm px-6 py-3">{L.demo}</a>
              <a href={waLink(L.wa("Pro"))} target="_blank" rel="noopener" className="rounded-full border border-white/15 px-6 py-3 text-sm font-bold text-g-word hover:border-g-gold/40">{L.talk}</a>
            </div>
          </div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="relative rounded-[28px] border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <img src="/assistente/assistente-3d-160.webp" alt="" width="56" height="56" className="h-14 w-14 rounded-full ring-2 ring-g-green/60 object-cover" />
              <div><div className="text-base font-extrabold">Lilian</div><div className="text-[11px] text-g-muted">{lang === "pt" ? "Assistente de IA · exemplo" : lang === "es" ? "Asistente de IA · ejemplo" : "AI assistant · example"}</div></div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-1.5">
              {[["6", "#3FB4FF"], ["1", "#2FE39A"], ["1", "#FFC23D"], ["$720", "#D6C29A"]].map(([v, c], i) => (
                <div key={i} className="rounded-xl bg-black/25 px-2 py-2.5"><div className="text-lg font-extrabold num" style={{ color: c }}>{v}</div></div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-sm font-extrabold">10:00 · Maria S.</div>
              <div className="text-[11px] font-bold text-amber-200 mt-0.5">⚠ Lavender allergy</div>
              <div className="mt-2 flex gap-1.5"><span className="rounded-full border border-yellow-300/40 px-3 py-1 text-[11px] font-bold text-yellow-200">✓ {lang === "pt" ? "Chegou" : lang === "es" ? "Llegó" : "Arrived"}</span><span className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-bold">💳 {lang === "pt" || lang === "es" ? "Cobrar" : "Charge"}</span></div>
            </div>
          </motion.div>
        </section>

        <section>
          <h2 className="text-2xl font-black">{L.win}</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {L.wins.map(([h, p]) => (
              <div key={h} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="text-sm font-extrabold text-g-word">{h}</div>
                <p className="mt-1.5 text-[13px] text-g-light/85 leading-relaxed">{p}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="planos">
          <h2 className="text-2xl font-black">{L.plans}</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {DESK_PLANS.map((p) => {
              const destaque = !!p.featured;
              const pai = p.inherits ? porKey[p.inherits] : null;
              return (
                <div key={p.key} className={`relative flex flex-col rounded-3xl border p-5 ${destaque ? "border-g-gold/45 bg-gradient-to-b from-g-gold/[0.1] to-white/[0.03]" : "border-white/10 bg-white/[0.03]"}`}>
                  {destaque && <span className="absolute -top-3 left-5 rounded-full bg-g-gold px-3 py-1 text-[10px] font-black uppercase tracking-wider text-black">{L.featured}</span>}
                  <div className="text-sm font-extrabold">{nomeDe(p)}</div>
                  <div className="text-[11px] text-g-muted">{deskTxt(p.tag, lg)}</div>
                  <div className="mt-3 flex items-baseline gap-1">
                    {p.amount != null ? (<><span className={`text-3xl font-black num ${destaque ? "text-g-gold" : ""}`}>{fmtMoneyUSD(p.amount, lang)}</span><span className="text-[11px] text-g-muted">{L.perUnit}</span></>) : <span className="text-2xl font-black">{L.custom}</span>}
                  </div>
                  {p.credits ? <div className="mt-1 text-[11px] font-bold text-g-green">{p.credits.toLocaleString()} {L.credits}</div> : null}
                  {pai && <div className="mt-3 text-[11px] font-bold text-g-muted">{L.inherits} {nomeDe(pai)}{L.plus}</div>}
                  <ul className="mt-2 space-y-1.5 flex-1">
                    {(p.feats[lg] || p.feats.en).map((f) => <li key={f} className="flex gap-2 text-[12.5px] leading-snug text-g-light/90"><span className="text-g-green shrink-0">✓</span><span>{f}</span></li>)}
                  </ul>
                  {p.depende && (
                    <div className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/[0.06] p-2.5 text-[11px] text-amber-100">
                      <div className="font-bold">{L.depende}</div>
                      {(p.depende[lg] || p.depende.en).map((d) => <div key={d}>· {d}</div>)}
                    </div>
                  )}
                  {p.amount != null ? (
                    <button type="button" onClick={() => assinar(p.key)} disabled={!!indo}
                      className={`mt-4 flex min-h-[44px] w-full items-center justify-center rounded-full text-sm font-bold disabled:opacity-60 ${destaque ? "bg-gradient-to-br from-g-green to-g-dark text-white" : "border border-white/15 hover:border-g-gold/40"}`}>{indo === p.key ? L.going : L.sub2}</button>
                  ) : null}
                  <a href={waLink(L.wa(nomeDe(p)))} target="_blank" rel="noopener"
                    className={`${p.amount != null ? "mt-2 text-[12px] text-g-muted hover:text-g-word" : "mt-4 flex min-h-[44px] items-center justify-center rounded-full border border-white/15 text-sm font-bold hover:border-g-gold/40"} text-center`}>{L.talk}</a>
                  {falha === p.key && <div role="alert" className="mt-2 text-[11px] text-red-300">{L.fail}</div>}
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[12px] text-g-muted">{L.note}</p>
        </section>

        <section className="flex flex-col sm:flex-row items-start sm:items-center gap-5 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <img src="/desk-app-192.png" alt="" width="72" height="72" className="h-[72px] w-[72px] rounded-2xl" />
          <div>
            <h2 className="text-xl font-black">{L.app}</h2>
            <p className="mt-1.5 max-w-2xl text-[13px] text-g-light/85 leading-relaxed">{L.appSub}</p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
