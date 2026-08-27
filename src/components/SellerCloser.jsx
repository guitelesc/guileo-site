import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { GUILEO_PLANS, planByKey, payLink } from "../data/guileoPlans.js";

// ── "Fechamento na mesa" — the seller's closing weapon inside /vendedor ────────────────────────
// Three tools a seller opens right in front of the prospect:
//   (a) LIVE ROI CALCULATOR — honest sliders (missed calls/day, ticket, close %) → what Gui recovers
//       per month vs the plan cost, with the conservative 0.6 attend-factor shown out loud (honesty).
//   (b) GUIDED LIVE DEMO — real buttons (call Gui, open the portal, open the chat) each with the exact
//       line the seller should say, so the prospect feels the product on the spot.
//   (c) MARKET SELECTOR US 🇺🇸 / BR 🇧🇷 (persisted) — flips currency + plan prices (price vs priceBR)
//       AND the close: US = direct pay-link (/planos?email=&ref=); BR = honest PIX/Mercado Pago +
//       WhatsApp close message (the MP plan pay-link is still generated with the team — say so).
// Design follows the hub: cement #161512 + Gui signals (green #3E9468 / gold #D6C29A / orange #FF8A33).

const MARKET_KEY = "guileo_seller_market";
const GUI_DEMO_PHONE = "+19864443334"; // the platform's reserved demo number — safe to dial live.
const GUI_ORANGE = "#FF8A33";          // Gui signal orange (no tailwind token — arbitrary value).

// Honest conservative attend-factor: not every recoverable call actually converts once handled.
const ATTEND_FACTOR = 0.6;
const WORK_DAYS = 26;

const TXT = {
  pt: {
    title: "Fechamento na mesa",
    sub: "As três armas pra fechar na frente do cliente: a calculadora de ROI ao vivo, a demo guiada e o fechamento certo pro mercado.",
    marketLabel: "Mercado", us: "🇺🇸 EUA", br: "🇧🇷 Brasil",
    // ROI
    roiTitle: "🧮 Calculadora de ROI ao vivo", roiSub: "Mexa os controles na frente do cliente. Números honestos — mostramos o fator conservador.",
    missed: "Ligações perdidas por dia", ticket: "Ticket médio", closePct: "% que fecharia se atendido",
    factorNote: `Fator conservador de atendimento: ×${ATTEND_FACTOR} (nem toda ligação recuperada vira venda) · ${WORK_DAYS} dias/mês.`,
    resRecovers: "A Gui recupera", perMonth: "/mês", planCosts: "o plano custa", returnOf: "retorno de", times: "x",
    barRecovered: "Recuperado", barCost: "Custo do plano",
    copyWa: "📋 Copiar resumo pro WhatsApp", copied: "Copiado ✓",
    waSummary: (r, plan, planCost, mult) => `Oi! Fiz uma conta rápida com você:\n\nHoje você perde ligações que dariam vendas. Com a Gui atendendo 24/7, a estimativa (conservadora) é recuperar cerca de ${r}/mês.\nO plano ${plan} custa ${planCost}/mês — ou seja, um retorno estimado de ~${mult}x.\n\nQuer que eu já deixe a sua Gui pronta?`,
    // DEMO
    demoTitle: "🎬 Demo ao vivo (SOS na mesa)", demoSub: "Faça o cliente SENTIR a Gui agora. Cada passo já vem com a sua fala pronta.",
    step1Btn: "📞 Liga pra Gui agora", step1Say: "Fala assim: “Deixa eu te mostrar uma coisa — vou ligar pra minha assistente de IA agora, ouve como ela atende.” Coloca no viva-voz e deixa a Gui atender você.",
    step2Btn: "🌐 Mostra o portal", step2Say: "Fala assim: “Esse é o painel que você recebe — cada ligação, cada agendamento, cada cliente aparece aqui em tempo real.” Abre numa aba e passeia pelas abas.",
    step3Btn: "💬 Mostra o chat", step3Say: "Fala assim: “E no seu site fica isso aqui — o cliente pergunta e a Gui responde e agenda sozinha.” Abre o chat e digita uma pergunta de teste.",
    theSay: "O que dizer",
    // CLOSE
    closeTitle: "✅ Fechar agora", closeSub: "Escolha do mercado acima. O botão e o script mudam pra fechar do jeito certo.",
    clientEmail: "E-mail do cliente", clientEmailPh: "cliente@negocio.com",
    clientWa: "WhatsApp do cliente", clientWaPh: "Ex: 11 98888-7777",
    plansTitle: "Planos", credits: "créditos",
    // US close
    usCloseBtn: "🔗 Abrir link de pagamento →", usNeedEmail: "Escreva o e-mail do cliente pra gerar o link.",
    usScriptTitle: "Script de fechamento (direto ao ponto)",
    usScript: "“Faz sentido pra você? Então é simples: eu te mando o link agora, você completa o pagamento e a sua Gui nasce automaticamente — em minutos você recebe o acesso por e-mail. Bora começar hoje?”",
    // BR close
    brCloseBtn: "💬 Mandar fechamento no WhatsApp →", brNeedWa: "Escreva o WhatsApp do cliente pra abrir a conversa.",
    brScriptTitle: "Script de fechamento (relacional · WhatsApp)",
    brScript: "“Adorei conversar com você! Vou te mandar tudo certinho no WhatsApp — o valor, como funciona o PIX e o link de pagamento. Aí você fecha com calma e a sua Gui já começa a trabalhar. Pode ser?”",
    brWaMsg: (plan, price, link) => `Oi! Foi ótimo falar com você 🙌\n\nComo combinamos, o plano ${plan} sai por ${price} — pode pagar via PIX / Mercado Pago.\n${link ? `Aqui está o link de pagamento: ${link}` : "Já te mando o link de pagamento pra fechar."}\nQualquer dúvida é só chamar aqui!`,
    brMpNote: "Nota: o link de pagamento do plano em R$ (Mercado Pago/PIX) é gerado com o time — mande a mensagem e o time libera o link na hora (até o pay-link BR de plano ficar self-serve).",
    brGenBtn: "💳 Gerar link PIX/cartão (R$)", brGenLoading: "Gerando…",
    brNeedEmail: "Escreva o e-mail do cliente pra gerar o link em R$.",
    brLinkTitle: "Link de pagamento (R$)", brCopyLink: "📋 Copiar link", brLinkCopied: "Copiado ✓",
    brWhy: "Motivo",
    openWa: "Abrir WhatsApp",
    toCadastro: "Cadastrar cliente agora →",
  },
  en: {
    title: "Close on the table",
    sub: "The three weapons to close in front of the client: the live ROI calculator, the guided demo, and the right close per market.",
    marketLabel: "Market", us: "🇺🇸 US", br: "🇧🇷 Brazil",
    roiTitle: "🧮 Live ROI calculator", roiSub: "Move the sliders in front of the client. Honest numbers — we show the conservative factor.",
    missed: "Missed calls per day", ticket: "Average ticket", closePct: "% that would close if answered",
    factorNote: `Conservative attend factor: ×${ATTEND_FACTOR} (not every recovered call becomes a sale) · ${WORK_DAYS} days/mo.`,
    resRecovers: "Gui recovers", perMonth: "/mo", planCosts: "the plan costs", returnOf: "return of", times: "x",
    barRecovered: "Recovered", barCost: "Plan cost",
    copyWa: "📋 Copy summary for WhatsApp", copied: "Copied ✓",
    waSummary: (r, plan, planCost, mult) => `Hi! I ran a quick number with you:\n\nRight now you're losing calls that would become sales. With Gui answering 24/7, the (conservative) estimate is recovering about ${r}/mo.\nThe ${plan} plan costs ${planCost}/mo — an estimated return of ~${mult}x.\n\nWant me to get your Gui ready?`,
    demoTitle: "🎬 Live demo (SOS on the table)", demoSub: "Make the client FEEL Gui now. Each step comes with your ready line.",
    step1Btn: "📞 Call Gui now", step1Say: "Say: “Let me show you something — I'll call my AI assistant right now, listen to how she answers.” Put it on speaker and let Gui answer you.",
    step2Btn: "🌐 Show the portal", step2Say: "Say: “This is the dashboard you get — every call, every booking, every customer shows up here in real time.” Open a tab and walk through it.",
    step3Btn: "💬 Show the chat", step3Say: "Say: “And on your website this lives here — the customer asks and Gui answers and books on her own.” Open the chat and type a test question.",
    theSay: "What to say",
    closeTitle: "✅ Close now", closeSub: "Picked from the market above. The button and script change to close the right way.",
    clientEmail: "Client email", clientEmailPh: "client@business.com",
    clientWa: "Client WhatsApp", clientWaPh: "e.g. +1 305 555-1234",
    plansTitle: "Plans", credits: "credits",
    usCloseBtn: "🔗 Open payment link →", usNeedEmail: "Type the client's email to generate the link.",
    usScriptTitle: "Closing script (straight to the point)",
    usScript: "“Does this make sense for you? Then it's simple: I send you the link now, you complete the payment and your Gui is born automatically — in minutes you get access by email. Shall we start today?”",
    brCloseBtn: "💬 Send close on WhatsApp →", brNeedWa: "Type the client's WhatsApp to open the chat.",
    brScriptTitle: "Closing script (relational · WhatsApp)",
    brScript: "“Loved talking with you! I'll send everything on WhatsApp — the price, how PIX works, and the payment link. You close at your pace and your Gui starts working. Sound good?”",
    brWaMsg: (plan, price, link) => `Hi! It was great talking to you 🙌\n\nAs we discussed, the ${plan} plan is ${price} — you can pay via PIX / Mercado Pago.\n${link ? `Here is the payment link: ${link}` : "I'll send you the payment link to close."}\nAny questions, just reach out here!`,
    brMpNote: "Note: the BRL plan payment link (Mercado Pago/PIX) is generated with the team — send the message and the team releases the link right away (until the BR plan pay-link is self-serve).",
    brGenBtn: "💳 Generate PIX/card link (R$)", brGenLoading: "Generating…",
    brNeedEmail: "Type the client's email to generate the BRL link.",
    brLinkTitle: "Payment link (R$)", brCopyLink: "📋 Copy link", brLinkCopied: "Copied ✓",
    brWhy: "Reason",
    openWa: "Open WhatsApp",
    toCadastro: "Register client now →",
  },
  es: {
    title: "Cierre en la mesa",
    sub: "Las tres armas para cerrar frente al cliente: la calculadora de ROI en vivo, la demo guiada y el cierre correcto por mercado.",
    marketLabel: "Mercado", us: "🇺🇸 EE.UU.", br: "🇧🇷 Brasil",
    roiTitle: "🧮 Calculadora de ROI en vivo", roiSub: "Mueve los controles frente al cliente. Números honestos — mostramos el factor conservador.",
    missed: "Llamadas perdidas por día", ticket: "Ticket promedio", closePct: "% que cerraría si se atiende",
    factorNote: `Factor conservador de atención: ×${ATTEND_FACTOR} (no toda llamada recuperada se convierte) · ${WORK_DAYS} días/mes.`,
    resRecovers: "Gui recupera", perMonth: "/mes", planCosts: "el plan cuesta", returnOf: "retorno de", times: "x",
    barRecovered: "Recuperado", barCost: "Costo del plan",
    copyWa: "📋 Copiar resumen para WhatsApp", copied: "Copiado ✓",
    waSummary: (r, plan, planCost, mult) => `¡Hola! Hice un número rápido contigo:\n\nHoy pierdes llamadas que serían ventas. Con Gui atendiendo 24/7, la estimación (conservadora) es recuperar cerca de ${r}/mes.\nEl plan ${plan} cuesta ${planCost}/mes — un retorno estimado de ~${mult}x.\n\n¿Quieres que deje tu Gui lista?`,
    demoTitle: "🎬 Demo en vivo (SOS en la mesa)", demoSub: "Haz que el cliente SIENTA a Gui ahora. Cada paso viene con tu frase lista.",
    step1Btn: "📞 Llama a Gui ahora", step1Say: "Di: “Déjame mostrarte algo — voy a llamar a mi asistente de IA ahora, escucha cómo atiende.” Ponlo en altavoz y deja que Gui te atienda.",
    step2Btn: "🌐 Muestra el portal", step2Say: "Di: “Este es el panel que recibes — cada llamada, cada reserva, cada cliente aparece aquí en tiempo real.” Abre una pestaña y recórrelo.",
    step3Btn: "💬 Muestra el chat", step3Say: "Di: “Y en tu sitio vive esto — el cliente pregunta y Gui responde y agenda sola.” Abre el chat y escribe una pregunta de prueba.",
    theSay: "Qué decir",
    closeTitle: "✅ Cerrar ahora", closeSub: "Elegido del mercado de arriba. El botón y el script cambian para cerrar de la forma correcta.",
    clientEmail: "Email del cliente", clientEmailPh: "cliente@negocio.com",
    clientWa: "WhatsApp del cliente", clientWaPh: "Ej: +52 55 5555-1234",
    plansTitle: "Planes", credits: "créditos",
    usCloseBtn: "🔗 Abrir link de pago →", usNeedEmail: "Escribe el email del cliente para generar el link.",
    usScriptTitle: "Script de cierre (directo al punto)",
    usScript: "“¿Te hace sentido? Entonces es simple: te mando el link ahora, completas el pago y tu Gui nace automáticamente — en minutos recibes el acceso por email. ¿Empezamos hoy?”",
    brCloseBtn: "💬 Enviar cierre por WhatsApp →", brNeedWa: "Escribe el WhatsApp del cliente para abrir el chat.",
    brScriptTitle: "Script de cierre (relacional · WhatsApp)",
    brScript: "“¡Me encantó hablar contigo! Te mando todo por WhatsApp — el precio, cómo funciona PIX y el link de pago. Cierras con calma y tu Gui empieza a trabajar. ¿Te parece?”",
    brWaMsg: (plan, price, link) => `¡Hola! Fue genial hablar contigo 🙌\n\nComo hablamos, el plan ${plan} sale por ${price} — puedes pagar vía PIX / Mercado Pago.\n${link ? `Aquí está el link de pago: ${link}` : "Ya te mando el link de pago para cerrar."}\n¡Cualquier duda me avisas aquí!`,
    brMpNote: "Nota: el link de pago del plan en R$ (Mercado Pago/PIX) se genera con el equipo — manda el mensaje y el equipo libera el link al instante (hasta que el pay-link BR sea self-serve).",
    brGenBtn: "💳 Generar link PIX/tarjeta (R$)", brGenLoading: "Generando…",
    brNeedEmail: "Escribe el email del cliente para generar el link en R$.",
    brLinkTitle: "Link de pago (R$)", brCopyLink: "📋 Copiar link", brLinkCopied: "Copiado ✓",
    brWhy: "Motivo",
    openWa: "Abrir WhatsApp",
    toCadastro: "Registrar cliente ahora →",
  },
};
TXT.hi = { ...TXT.en, title: "टेबल पर क्लोज़", marketLabel: "मार्केट" };

// Normalize the global market prop ("us"/"br" per the interactivity contract, any case)
// into this component's internal "US"/"BR" token — also tolerates already-uppercase input.
const normMarket = (m) => (String(m || "").toLowerCase() === "br" ? "BR" : "US");

// Currency formatter — BR uses pt-BR grouping (R$ 2.499), US uses en-US ($2,499).
const fmtMoney = (market, n) => {
  const v = Math.round(Number(n) || 0);
  return market === "BR" ? `R$ ${v.toLocaleString("pt-BR")}` : `$${v.toLocaleString("en-US")}`;
};

// wa.me link — keep only digits (WhatsApp wants the international number, no +/spaces).
const waLink = (phone, msg) => `https://wa.me/${(phone || "").replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;

export default function SellerCloser({ lang = "pt", seller, market: marketProp, nav, handoff }) {
  const t = TXT[lang] || TXT.pt;

  // Market — the GLOBAL hub header owns it when the `market` prop is wired.
  // Contract: if `market` comes in it MANDA; the internal selector becomes a mere
  // reflection (hidden, since there's no upward callback) and we still mirror the
  // choice into localStorage so anything reading MARKET_KEY stays compatible.
  const marketControlled = marketProp != null;
  const readStored = () => { try { return localStorage.getItem(MARKET_KEY) === "BR" ? "BR" : "US"; } catch { return "US"; } };
  // Local fallback state — only used when the prop is absent (current behavior).
  const [localMarket, setLocalMarket] = useState(readStored);
  const setMarket = setLocalMarket; // legacy name kept for the internal selector below.
  const market = marketControlled ? normMarket(marketProp) : localMarket;
  // Mirror the effective market to localStorage (keeps MARKET_KEY readers in sync).
  useEffect(() => { try { localStorage.setItem(MARKET_KEY, market); } catch { /* private mode */ } }, [market]);

  // Handoff (payload delivered by the last nav() into this tab). No shape is defined
  // FOR "fechar" in the contract, so we consume defensively: seed the close inputs from
  // whatever identifying fields arrived. Component remounts on tab change (key={tab}) →
  // reading at mount applies it exactly once.
  const hoEmail = handoff?.email || handoff?.clientEmail
    || (typeof handoff?.client === "string" && handoff.client.includes("@") ? handoff.client : "") || "";
  const hoWa = handoff?.phone || handoff?.whatsapp || handoff?.clientWa || "";

  // ROI sliders.
  const [missed, setMissed] = useState(8);
  const [ticket, setTicket] = useState((marketControlled ? normMarket(marketProp) : readStored()) === "BR" ? 150 : 80);
  const [closePct, setClosePct] = useState(30);
  const [copied, setCopied] = useState(false);

  // Close inputs.
  const [clientEmail, setClientEmail] = useState(seller?.clientEmail || hoEmail || "");
  const [clientWa, setClientWa] = useState(hoWa || "");

  // The plan we anchor ROI + close on = the featured "Personalized" (growth).
  const growth = planByKey("growth");
  const planCost = market === "BR" ? growth.amountBR : growth.amount;
  const planPrice = market === "BR" ? growth.priceBR : growth.price;

  // Honest recovery: missed × workdays × ticket × close% × conservative attend factor.
  const recovered = useMemo(
    () => missed * WORK_DAYS * ticket * (closePct / 100) * ATTEND_FACTOR,
    [missed, ticket, closePct]
  );
  const mult = planCost > 0 ? recovered / planCost : 0;
  const multLabel = mult >= 10 ? Math.round(mult) : mult.toFixed(1);
  // Visual bar: cost width relative to recovered (recovered is the 100% reference).
  const costPct = recovered > 0 ? Math.min(100, (planCost / recovered) * 100) : 100;

  const ticketMax = market === "BR" ? 2000 : 1000;
  const ticketStep = market === "BR" ? 10 : 5;

  const copySummary = () => {
    const txt = t.waSummary(fmtMoney(market, recovered), growth.name, fmtMoney(market, planCost), multLabel);
    try { navigator.clipboard?.writeText(txt); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* ignore */ }
  };

  // ── PAY-LINK BR SELF-SERVE ────────────────────────────────────────────────────────────────
  // O vendedor gera o link em REAL (PIX/cartão) na hora, sem depender do time. O valor NUNCA sai
  // daqui: quem decide o preço é `guileoPlans.js`, lido no servidor. Três respostas possíveis e
  // TODAS aparecem na tela — link, "falta credencial" (503) e "falta preço" (configurado:false).
  // Nunca fingimos que gerou: sem URL real, o vendedor vê o motivo e o caminho antigo (falar com
  // o time) continua ali como saída.
  const [brPay, setBrPay] = useState(null);     // { url } quando deu certo
  const [brPayErr, setBrPayErr] = useState(""); // motivo REAL quando não deu
  const [brPayLoading, setBrPayLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const gerarLinkBR = async () => {
    setBrPayLoading(true); setBrPayErr(""); setBrPay(null);
    try {
      const r = await fetch("/api/pay-link-br", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sid: seller?.sid || "", seller_email: seller?.email || "", seller_code: seller?.code || "",
          tenant: clientEmail.trim(), plan: growth.key,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (d?.ok && d.url) setBrPay({ url: d.url });
      // inerte-que-acende: 503 {ready:false} = falta credencial · {configurado:false} = falta preço.
      else setBrPayErr(d?.motivo || d?.note || d?.error || `HTTP ${r.status}`);
    } catch (e) { setBrPayErr(String(e).slice(0, 140)); }
    setBrPayLoading(false);
  };

  const copyLink = () => {
    if (!brPay?.url) return;
    try { navigator.clipboard?.writeText(brPay.url); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1600); } catch { /* ignore */ }
  };

  const usUrl = payLink(clientEmail.trim(), seller?.ref || "");
  // O link gerado ENTRA na mensagem de WhatsApp — o fechamento sai completo numa tacada só.
  const brUrl = waLink(clientWa, t.brWaMsg(growth.name, planPrice, brPay?.url || ""));

  const inp = "w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-[14px] text-g-word placeholder:text-g-muted/60 focus:outline-none focus:border-g-green/50";
  const lbl = "mb-1.5 text-[11px] font-bold uppercase tracking-wide text-g-muted";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-g-word">💰 {t.title}</h2>
        <p className="text-[13px] text-g-muted mt-1 max-w-2xl">{t.sub}</p>
      </div>

      {/* ── Market selector (persisted) — only when NOT globally controlled ─────────── */}
      {/* When the hub header drives `market`, this local toggle is hidden: the global   */}
      {/* choice is the single source of truth (still mirrored to MARKET_KEY above).     */}
      {!marketControlled && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{t.marketLabel}</span>
          <div className="flex gap-1.5">
            {[["US", t.us], ["BR", t.br]].map(([k, lb]) => (
              <button key={k} onClick={() => setMarket(k)}
                className={`rounded-full px-4 py-2 text-[13px] font-bold transition ${market === k ? "bg-g-green/15 text-g-word ring-1 ring-g-green/45" : "bg-white/[0.04] text-g-muted ring-1 ring-white/10 hover:text-g-word"}`}>
                {lb}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── (a) LIVE ROI CALCULATOR ───────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{t.roiTitle}</div>
        <p className="mt-1 text-[12.5px] text-g-muted">{t.roiSub}</p>

        <div className="mt-4 space-y-5">
          <Slider label={t.missed} value={missed} min={1} max={30} step={1} onChange={setMissed} display={missed} />
          <Slider label={t.ticket} value={ticket} min={ticketStep} max={ticketMax} step={ticketStep} onChange={setTicket} display={fmtMoney(market, ticket)} />
          <Slider label={t.closePct} value={closePct} min={5} max={80} step={5} onChange={setClosePct} display={`${closePct}%`} />
        </div>

        <p className="mt-4 text-[11.5px] leading-relaxed text-g-muted">🛡️ {t.factorNote}</p>

        {/* result — the big number */}
        <div className="mt-4 rounded-2xl border p-5" style={{ borderColor: `${GUI_ORANGE}44`, background: `${GUI_ORANGE}0d` }}>
          <div className="text-[13px] font-bold text-g-word">
            {t.resRecovers} <span className="text-[26px] font-black align-middle" style={{ color: GUI_ORANGE }}>{fmtMoney(market, recovered)}</span>
            <span className="text-[13px] font-semibold text-g-muted">{t.perMonth}</span>
          </div>
          <div className="mt-1 text-[13px] text-g-ink">
            {t.planCosts} <span className="font-bold text-g-word">{fmtMoney(market, planCost)}{t.perMonth}</span> · {t.returnOf} <span className="font-black text-g-green">{multLabel}{t.times}</span>
          </div>

          {/* visual bars */}
          <div className="mt-4 space-y-2">
            <div>
              <div className="flex justify-between text-[10.5px] font-bold text-g-muted"><span>{t.barRecovered}</span><span>{fmtMoney(market, recovered)}</span></div>
              <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 0.5 }} className="h-full rounded-full" style={{ background: GUI_ORANGE }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10.5px] font-bold text-g-muted"><span>{t.barCost}</span><span>{fmtMoney(market, planCost)}</span></div>
              <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div initial={{ width: 0 }} animate={{ width: `${costPct}%` }} transition={{ duration: 0.5 }} className="h-full rounded-full bg-g-green" />
              </div>
            </div>
          </div>

          <button onClick={copySummary} className="btn-ghost text-[12.5px] mt-4">{copied ? t.copied : t.copyWa}</button>
        </div>
      </div>

      {/* ── (b) GUIDED LIVE DEMO ──────────────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{t.demoTitle}</div>
        <p className="mt-1 text-[12.5px] text-g-muted">{t.demoSub}</p>

        {/* ── DOIS DOS TRÊS PASSOS ESTAVAM QUEBRADOS (auditoria 2026-08-17) ──────────────────
            Esta é a demo que o vendedor roda AO VIVO, na frente do prospect. Dois dos três botões
            não levavam a lugar nenhum:
              · o passo 2 apontava para /portal?demo=1 — e o Portal lê `tab`, `v`, `code` e `speak`,
                NUNCA `demo`. O prospect clicava e via TELA DE SENHA. Agora vai para /vitrine, que
                é a vitrine na marca do cliente, feita exatamente pra mostrar a prospect.
              · o passo 3 apontava para /#chat — e o chat foi REMOVIDO da landing de propósito
                (gastava Anthropic numa demo errada). O roteiro nunca foi atualizado, então o
                âncora não tinha alvo: a página só rolava pro topo. Passo apagado em vez de
                apontado pra qualquer coisa — demo com passo inventado é pior que demo com dois.
            ⚠️ A LIÇÃO: quando se remove uma superfície, o que APONTAVA pra ela não reclama. Link
            morto não dá erro, não aparece em build, não aparece em teste — só aparece na hora em
            que o vendedor está com o cliente na frente. */}
        <div className="mt-4 space-y-3">
          <DemoStep n="1" btn={<a href={`tel:${GUI_DEMO_PHONE}`} className="btn-bright text-[13px]">{t.step1Btn}</a>} say={t.step1Say} theSay={t.theSay} />
          <DemoStep n="2" btn={<a href="/vitrine" target="_blank" rel="noopener" className="btn-ghost text-[13px]">{t.step2Btn}</a>} say={t.step2Say} theSay={t.theSay} />
        </div>
      </div>

      {/* ── (c) CLOSE — changes per market ────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{t.closeTitle}</div>
        <p className="mt-1 text-[12.5px] text-g-muted">{t.closeSub}</p>

        {/* plans row (price flips with market) */}
        <div className="mt-4">
          <div className={lbl}>{t.plansTitle}</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {GUILEO_PLANS.map((p) => (
              <div key={p.key} className={`rounded-xl border p-3 ${p.featured ? "border-g-green/40 bg-g-green/[0.05]" : "border-white/10 bg-white/[0.03]"}`}>
                <div className="text-[13px] font-black text-g-word">{p.name}</div>
                <div className="text-[15px] font-black" style={{ color: p.featured ? "#3E9468" : undefined }}>{market === "BR" ? p.priceBR : p.price}</div>
                <div className="text-[11px] text-g-muted">{p.credits.toLocaleString(market === "BR" ? "pt-BR" : "en-US")} {t.credits}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Handoff to the cadastro wizard — closed client → born Gui (only when nav is wired). */}
        {typeof nav === "function" && (
          <button
            onClick={() => nav("cadastro", { email: clientEmail.trim() || undefined, phone: clientWa.trim() || undefined, market })}
            className="btn-ghost mt-4 text-[12.5px]"
          >
            {t.toCadastro}
          </button>
        )}

        {market === "US" ? (
          <div className="mt-5 space-y-3">
            <div>
              <div className={lbl}>{t.clientEmail}</div>
              <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder={t.clientEmailPh} className={inp + " max-w-md"} />
            </div>
            {clientEmail.trim() ? (
              <a href={usUrl} target="_blank" rel="noopener" className="btn-bright text-[14px]">{t.usCloseBtn}</a>
            ) : (
              <div className="text-[12.5px] text-g-gold">{t.usNeedEmail}</div>
            )}
            <div className="rounded-2xl border border-g-green/25 bg-g-green/[0.05] p-4">
              <div className="text-[10.5px] font-black uppercase tracking-wider text-g-green">{t.usScriptTitle}</div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-g-word">{t.usScript}</p>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <div>
              <div className={lbl}>{t.clientEmail}</div>
              <input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder={t.clientEmailPh} className={inp + " max-w-md"} />
            </div>
            <div>
              <div className={lbl}>{t.clientWa}</div>
              <input value={clientWa} onChange={(e) => setClientWa(e.target.value)} placeholder={t.clientWaPh} className={inp + " max-w-md"} />
            </div>

            {/* GERAR O LINK EM R$ — self-serve. Sem e-mail do cliente não há tenant pra amarrar. */}
            {clientEmail.trim() ? (
              <button onClick={gerarLinkBR} disabled={brPayLoading} className="btn-ghost text-[13px] disabled:opacity-60">
                {brPayLoading ? t.brGenLoading : t.brGenBtn}
              </button>
            ) : (
              <div className="text-[12.5px] text-g-gold">{t.brNeedEmail}</div>
            )}

            {brPay?.url && (
              <div className="rounded-2xl border border-g-green/30 bg-g-green/[0.06] p-4">
                <div className="text-[10.5px] font-black uppercase tracking-wider text-g-green">{t.brLinkTitle}</div>
                <a href={brPay.url} target="_blank" rel="noopener" className="mt-2 block break-all text-[12.5px] font-semibold text-g-word underline decoration-g-green/50">{brPay.url}</a>
                <button onClick={copyLink} className="btn-ghost mt-3 text-[12px]">{linkCopied ? t.brLinkCopied : t.brCopyLink}</button>
              </div>
            )}

            {clientWa.replace(/\D/g, "") ? (
              <a href={brUrl} target="_blank" rel="noopener" className="btn-bright text-[14px]">{t.brCloseBtn}</a>
            ) : (
              <div className="text-[12.5px] text-g-gold">{t.brNeedWa}</div>
            )}

            {/* FALLBACK HONESTO: não gerou → o caminho antigo (falar com o time) + o motivo REAL. */}
            {(!brPay?.url) && (
              <p className="text-[11.5px] leading-relaxed text-g-muted">
                🛡️ {t.brMpNote}
                {brPayErr ? <span className="block mt-1 text-g-gold">{t.brWhy}: {brPayErr}</span> : null}
              </p>
            )}
            <div className="rounded-2xl border border-g-green/25 bg-g-green/[0.05] p-4">
              <div className="text-[10.5px] font-black uppercase tracking-wider text-g-green">{t.brScriptTitle}</div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-g-word">{t.brScript}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Pretty range slider row — label + live value badge on top of the native input.
function Slider({ label, value, min, max, step, onChange, display }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-bold text-g-word">{label}</span>
        <span className="rounded-full bg-g-green/15 px-2.5 py-0.5 text-[12px] font-black text-g-green ring-1 ring-g-green/25">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-g-green" />
    </div>
  );
}

// One demo step — big action button + the exact line the seller should say.
function DemoStep({ n, btn, say, theSay }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-g-gold/15 text-[12px] font-black text-g-gold ring-1 ring-g-gold/25">{n}</span>
        {btn}
      </div>
      <div className="mt-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-g-green">{theSay}: </span>
        <span className="text-[13px] leading-relaxed text-g-ink">{say}</span>
      </div>
    </div>
  );
}
