import { useLang } from "../i18n.jsx";
import { productById } from "../data/productSystem.js";

// AddOnsV2 — "Power-ups": add-ons & offers section. Lives right after #pricing.
// Locked design language (GrowthV2/LegsV2): cement bg, glass cards, champagne eyebrow,
// one shimmer phrase, free-floating emojis with colored glow, CSS keyframes only.


// ── TODO ADD-ON DECLARA DE ONDE VEM (2026-08-11) ────────────────────────────────────────────────
// Este arquivo era a TERCEIRA cópia à mão dos mesmos produtos (a 1ª é productSystem.js, a 2ª era
// PillarsProducts.jsx, já derivada). Cópia sem vínculo é como a landing passou a prometer coisas
// que não existiam — "Gestão de mídia", "SEO", "E-mail/CRM" — sem nenhum arquivo reclamar.
//
// A trava não é um teste que roda depois: é a FORMA da linha. Toda linha tem que declarar
//   `pid: "<id em productSystem.js>"`  → o nome vem da fonte, traduzido, e nunca diverge; ou
//   `real: "<onde esse serviço existe>"` → serviço real que não é produto do sistema (WhatsApp
//                                          oficial, compliance, Nossa Gente, blitz de reativação).
// Quem for escrever uma linha nova precisa responder "de onde isto vem?" ANTES de escrever o nome.
// Sem `pid` nem `real`, `nomeDoAddon` devolve `null` e o card NÃO RENDERIZA — some da página em
// vez de virar promessa. É a mesma escolha do preço na landing: onde falhar em silêncio custa
// confiança, o certo é falhar alto.
//
// PREÇO NÃO SE MOVEU: `pr` continua local. Preço é dinheiro, e dinheiro não anda sem revisor
// adversarial. Aqui só o NOME passou a derivar.

// ── A MOEDA TEM QUE SER EXPLÍCITA (2026-08-11) ──────────────────────────────────────────────────
// BUG DE DINHEIRO ACHADO NA VARREDURA: em português a página mostra os PLANOS em reais
// (R$ 799 · R$ 2.499 · R$ 5.499, vindos de guileoPlans.js e casados com o Mercado Pago) e logo
// abaixo os ADD-ONS com "+$97/mês" — cifrão nu, sufixo em português. O brasileiro lê 97 reais.
// São US$ 97 ≈ R$ 500. Cinco vezes mais, e ele só descobre na fatura.
//
// POR QUE NÃO CONVERTI: não existe preço em real para add-on em lugar nenhum do sistema. Inventar
// a conversão seria escolher uma cotação por conta própria e gravá-la numa página — exatamente o
// que a Gui é PROIBIDA de fazer ao telefone ("preço é promessa; só diga o que está na lista").
// A regra vale para a nossa própria vitrine antes de valer para a agente.
//
// O QUE FAZ: em pt/es/hi, um cifrão NU vira "US$". Não muda valor nenhum, elimina a ambiguidade,
// e é reversível em uma linha no dia em que existir tabela em reais. `R$` e `US$` já escritos
// passam intactos — a troca é ancorada em cifrão que não vem precedido de letra.
const moedaExplicita = (pr, lang) => {
  if (!pr || lang === "en") return pr;
  return String(pr).replace(/(^|[^A-Za-z$])\$/g, "$1US$$");
};

const nomeDoAddon = (row, lang) => {
  if (row.pid) {
    const p = productById(row.pid);
    if (!p) return null;                       // id errado → some, não inventa
    return (p.name && (p.name[lang] || p.name.en)) || null;
  }
  if (row.real) return row.n || null;          // serviço real declarado, nome local
  return null;                                 // origem não declarada → não renderiza
};

const AO_COPY = {
  en: {
    eyebrow: "💎 Add-ons · stack your growth",
    h1a: "Your plan ",
    h1b: "grows with you.",
    sub: "Start lean, then stack power-ups when you're ready — each one pays its own way.",
    badge: "🔥 best first step",
    champBadge: "🔥 closes more",
    cta: "Add to my package",
    partnerCta: "Become a partner",
    items: [
      { pid: "noshow", e: "💳", n: "No-show Shield", p: "Gui collects a deposit on every booking — no-shows pay for themselves.", pr: "+$97/mo", tg: "salons · clinics · dental" },
      { pid: "speedlead", e: "⚡", n: "Speed-to-Lead 60s", p: "Every ad & marketplace lead (Yelp, Angi, Thumbtack…) gets a call from Gui within 60 seconds — be the first, win the deal.", pr: "+$197/mo", tg: "kills slow follow-up" },
      { real: "catálogo: Blitz de reativação em massa", e: "♻️", n: "Reactivation Blitz", p: "Your dormant client list, reactivated in one week. You only serve who comes back.", pr: "from $497 · one-time", tg: "instant ROI" },
      { pid: "reputation", e: "⭐", n: "Reputation Machine", p: "Reviews requested, answered in your tone, low ratings flagged instantly.", pr: "+$147/mo", tg: "local SEO" },
      { pid: "content", e: "🎬", n: "Content Autopilot", p: "4 posts a week in your brand's voice — your Instagram never sleeps.", pr: "+$197/mo", tg: "Guileo.AD" },
      { real: "WhatsApp Cloud ligado (entrada provada)", e: "📲", n: "Official WhatsApp", p: "Verified green-badge WhatsApp Business with Gui inside.", pr: "setup $297", tg: "trust seal" },
      { real: "página /compliance", e: "🛡️", n: "Compliance TCPA/A2P", p: "We register, capture consent and auto opt-out — your texts never blocked, you never fined.", pr: "setup $297", tg: "USA legal shield", href: "/compliance" },
      { real: "página /nossa-gente", e: "🌎", n: "Nossa Gente Package", p: "Gui in Portuguese/Spanish/English — built for immigrant-owned & immigrant-serving businesses.", pr: "included", tg: "bilingual edge", href: "/nossa-gente" },
    ],
    wl: { n: "White-label for agencies", p: "Resell Gui under your brand. We run the engine, you keep the relationship — and the margin." },
    an: { n: "Annual plan", p: "Pay yearly, get 2 months free." },
  },
  pt: {
    eyebrow: "💎 Add-ons · turbine seu plano",
    h1a: "Seu plano ",
    h1b: "cresce com você.",
    sub: "Comece enxuto e adicione power-ups quando estiver pronto — cada um se paga sozinho.",
    badge: "🔥 melhor primeiro passo",
    champBadge: "🔥 fecha mais",
    cta: "Adicionar ao meu pacote",
    partnerCta: "Seja parceiro",
    items: [
      { pid: "noshow", e: "💳", n: "Depósito anti-falta", p: "O Gui cobra um depósito em cada agendamento — a falta paga a si mesma.", pr: "+$97/mês", tg: "salões · clínicas · dentistas" },
      { pid: "speedlead", e: "⚡", n: "Resposta em 60 segundos", p: "Todo lead de anúncio e de marketplace (Yelp, Angi, Thumbtack…) recebe uma ligação do Gui em 60 segundos — seja o primeiro, feche a venda.", pr: "+$197/mês", tg: "acaba com o follow-up lento" },
      { real: "catálogo: Blitz de reativação em massa", e: "♻️", n: "Blitz de Reativação", p: "Sua lista de clientes sumidos, reativada em uma semana. Você só atende quem voltar.", pr: "a partir de $497 · único", tg: "ROI imediato" },
      { pid: "reputation", e: "⭐", n: "Máquina de Reputação", p: "Avaliações pedidas e respondidas no seu tom; nota baixa alerta na hora.", pr: "+$147/mês", tg: "SEO local" },
      { pid: "content", e: "🎬", n: "Conteúdo no Automático", p: "4 posts por semana na voz da sua marca — seu Instagram nunca dorme.", pr: "+$197/mês", tg: "Guileo.AD" },
      { real: "WhatsApp Cloud ligado (entrada provada)", e: "📲", n: "WhatsApp Oficial", p: "WhatsApp Business verificado com selo + o Gui dentro.", pr: "setup $297", tg: "selo de confiança" },
      { real: "página /compliance", e: "🛡️", n: "Compliance TCPA/A2P", p: "Registro A2P, consentimento e opt-out automático — mensagem nunca bloqueada, você nunca multado.", pr: "setup $297", tg: "escudo legal EUA", href: "/compliance" },
      { real: "página /nossa-gente", e: "🌎", n: "Nossa Gente", p: "Gui em português/espanhol/inglês — feito pra negócios da nossa comunidade.", pr: "incluso", tg: "vantagem bilíngue", href: "/nossa-gente" },
    ],
    wl: { n: "White-label para agências", p: "Revenda o Gui com a sua marca. A gente roda o motor, você fica com o relacionamento — e a margem." },
    an: { n: "Plano anual", p: "No anual, 2 meses grátis." },
  },
  es: {
    eyebrow: "💎 Add-ons · potencia tu plan",
    h1a: "Tu plan ",
    h1b: "crece contigo.",
    sub: "Empieza ligero y suma power-ups cuando estés listo — cada uno se paga solo.",
    badge: "🔥 mejor primer paso",
    champBadge: "🔥 cierra más",
    cta: "Añadir a mi paquete",
    partnerCta: "Sé socio",
    items: [
      { pid: "noshow", e: "💳", n: "Escudo anti-plantón", p: "Gui cobra un depósito en cada reserva — la ausencia se paga sola.", pr: "+$97/mes", tg: "salones · clínicas · dental" },
      { pid: "speedlead", e: "⚡", n: "Respuesta en 60 segundos", p: "Cada lead de anuncio y de marketplace (Yelp, Angi, Thumbtack…) recibe una llamada de Gui en 60 segundos — sé el primero, cierra la venta.", pr: "+$197/mes", tg: "acaba con el follow-up lento" },
      { real: "catálogo: Blitz de reativação em massa", e: "♻️", n: "Blitz de Reactivación", p: "Tu lista de clientes dormidos, reactivada en una semana. Solo atiendes a quien vuelve.", pr: "desde $497 · único", tg: "ROI inmediato" },
      { pid: "reputation", e: "⭐", n: "Máquina de Reputación", p: "Reseñas pedidas y respondidas en tu tono; nota baja alerta al instante.", pr: "+$147/mes", tg: "SEO local" },
      { pid: "content", e: "🎬", n: "Contenido en Automático", p: "4 posts por semana con la voz de tu marca — tu Instagram nunca duerme.", pr: "+$197/mes", tg: "Guileo.AD" },
      { real: "WhatsApp Cloud ligado (entrada provada)", e: "📲", n: "WhatsApp Oficial", p: "WhatsApp Business verificado con sello + Gui dentro.", pr: "setup $297", tg: "sello de confianza" },
      { real: "página /compliance", e: "🛡️", n: "Compliance TCPA/A2P", p: "Registro A2P, consentimiento y opt-out automático — mensaje nunca bloqueado, tú nunca multado.", pr: "setup $297", tg: "escudo legal EE.UU.", href: "/compliance" },
      { real: "página /nossa-gente", e: "🌎", n: "Nuestra Gente", p: "Gui en portugués/español/inglés — hecho para negocios de nuestra comunidad.", pr: "incluido", tg: "ventaja bilingüe", href: "/nossa-gente" },
    ],
    wl: { n: "White-label para agencias", p: "Revende a Gui con tu marca. Nosotros movemos el motor, tú te quedas con la relación — y el margen." },
    an: { n: "Plan anual", p: "Paga anual y llévate 2 meses gratis." },
  },
  hi: {
    eyebrow: "💎 ऐड-ऑन · अपना प्लान बढ़ाएँ",
    h1a: "आपका प्लान ",
    h1b: "आपके साथ बढ़ता है।",
    sub: "हल्के से शुरू करें, तैयार होने पर पावर-अप जोड़ें — हर एक अपनी कीमत खुद निकालता है।",
    badge: "🔥 सबसे अच्छा पहला कदम",
    champBadge: "🔥 ज़्यादा डील बंद",
    cta: "मेरे पैकेज में जोड़ें",
    partnerCta: "पार्टनर बनें",
    items: [
      { pid: "noshow", e: "💳", n: "नो-शो शील्ड", p: "Gui हर बुकिंग पर डिपॉज़िट लेता है — नो-शो की भरपाई खुद हो जाती है।", pr: "+$97/माह", tg: "सैलून · क्लिनिक · डेंटल" },
      { pid: "speedlead", e: "⚡", n: "60 सेकंड में जवाब", p: "हर ऐड और मार्केटप्लेस लीड (Yelp, Angi, Thumbtack…) को 60 सेकंड में Gui कॉल करता है — पहले बनें, डील जीतें।", pr: "+$197/माह", tg: "धीमे फॉलो-अप का अंत" },
      { real: "catálogo: Blitz de reativação em massa", e: "♻️", n: "रीएक्टिवेशन ब्लिट्ज़", p: "आपकी सोई हुई क्लाइंट लिस्ट, एक हफ्ते में वापस। आप सिर्फ लौटने वालों को सेवा देते हैं।", pr: "$497 से · एक बार", tg: "तुरंत ROI" },
      { pid: "reputation", e: "⭐", n: "रेपुटेशन मशीन", p: "रिव्यू माँगे और आपके अंदाज़ में जवाब; कम रेटिंग पर तुरंत अलर्ट।", pr: "+$147/माह", tg: "लोकल SEO" },
      { pid: "content", e: "🎬", n: "कंटेंट ऑटोपायलट", p: "हफ्ते में 4 पोस्ट, आपके ब्रांड की आवाज़ में — आपका Instagram कभी नहीं सोता।", pr: "+$197/माह", tg: "Guileo.AD" },
      { real: "WhatsApp Cloud ligado (entrada provada)", e: "📲", n: "ऑफिशियल WhatsApp", p: "वेरिफ़ाइड ग्रीन-बैज WhatsApp Business + अंदर Gui।", pr: "सेटअप $297", tg: "भरोसे की मुहर" },
      { real: "página /compliance", e: "🛡️", n: "Compliance TCPA/A2P", p: "A2P रजिस्ट्रेशन, सहमति और ऑटो ऑप्ट-आउट — मैसेज कभी ब्लॉक नहीं, आप पर कभी जुर्माना नहीं।", pr: "सेटअप $297", tg: "USA कानूनी कवच", href: "/compliance" },
      { real: "página /nossa-gente", e: "🌎", n: "हमारे लोग", p: "Gui पुर्तगाली/स्पैनिश/अंग्रेज़ी में — हमारे समुदाय के व्यवसायों के लिए बना।", pr: "शामिल", tg: "द्विभाषी बढ़त", href: "/nossa-gente" },
    ],
    wl: { n: "एजेंसियों के लिए व्हाइट-लेबल", p: "Gui को अपने ब्रांड के नाम से बेचें। इंजन हम चलाते हैं, रिश्ता — और मार्जिन — आपका।" },
    an: { n: "वार्षिक प्लान", p: "सालाना भुगतान करें, 2 महीने मुफ़्त पाएँ।" },
  },
};

// accent rgb + price-pill flavor per card (green = monthly revenue, gold = one-time/premium)
// `champion` = the #1 sales weapon: champagne ring + its own "fecha mais" badge.
// Order optimized for conversion + retention: recurring/instant-ROI lead, one-time/setup trail.
// ── A ORDEM É POR TEMPO ATÉ O PRIMEIRO DÓLAR DE VOLTA (2026-08-15) ──────────────────────────
// A grade tinha OITO cartões de peso igual, e isso é catálogo, não recomendação: o dono de salão
// não sabe se precisa de depósito ou de reativação — ele sabe que perde cliente. Uma seção
// chamada "seu plano cresce com você" tem que MOSTRAR o caminho.
//
// ⚠️ A RÉGUA NÃO É IMPACTO, É VELOCIDADE DE PROVA. O Speed-to-Lead rende mais que os outros dois
// e mesmo assim é o TERCEIRO: ele exige que já exista lead chegando. Add-on que depende de outra
// coisa funcionando antes cria a impressão de que o produto não entrega — e essa impressão custa
// a renovação inteira, não só o add-on. O primeiro upsell não é o que rende mais; é o que prova
// mais rápido.
//   1º Reativação  — vira dinheiro NESTA semana, com a lista que ele já tem, sem depender de nada
//   2º Depósito    — o mais barato e o mais fácil de provar (o cliente vê na primeira falta)
//   3º Speed-to-Lead — o de maior impacto, e o que precisa de tráfego antes
//
// A chave é canônica (pid/href/real), NÃO a posição no array: os textos vivem em 4 idiomas e
// reordenar quatro listas à mão é como se dessincronizam. Aqui a ordem existe uma vez só.
const chaveAddon = (it) => it.pid || (it.href || "").replace("/", "") || ((it.real || "").toLowerCase().includes("blitz") ? "reativacao" : "outro");
const ORDEM_PROVA = ["reativacao", "noshow", "speedlead"];

const META = [
  // 1 · No-show Shield (+$97/mo) — the opener: easiest "yes", self-paying, recurring
  { rgb: "62,148,104", flavor: "green", featured: true },
  // 2 · Speed-to-Lead 60s (+$197/mo) — SALES CHAMPION: 78% stat, recurring
  { rgb: "62,148,104", flavor: "green", featured: true, champion: true },
  // 3 · Reactivation Blitz ($497 one-time) — instant-cash conversion hook
  { rgb: "214,194,154", flavor: "gold", featured: false },
  // 4 · Reputation Machine (+$147/mo) — recurring, sticky
  { rgb: "62,148,104", flavor: "green", featured: false },
  // 5 · Content Autopilot (+$197/mo) — recurring
  { rgb: "62,148,104", flavor: "green", featured: false },
  // 6 · Official WhatsApp (setup) — one-time infrastructure
  { rgb: "194,168,120", flavor: "gold", featured: false },
  // 7 · Compliance (setup) — one-time legal shield
  { rgb: "194,168,120", flavor: "gold", featured: false },
  // 8 · Nossa Gente (included) — differentiator
  { rgb: "62,148,104", flavor: "green", featured: false },
];

export default function AddOnsV2() {
  const { lang } = useLang();
  const A = AO_COPY[lang] || AO_COPY.en;

  const pill = (flavor) =>
    flavor === "green"
      ? "border-g-green/35 bg-g-green/[0.10] text-g-green"
      : "border-g-gold/35 bg-g-gold/[0.10] text-g-gold";

  return (
    <section className="relative overflow-hidden px-5 py-14">
      <style>{`@keyframes aoreveal{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}@keyframes aoshine{to{background-position:220% center}}@keyframes aofloat{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-6px) rotate(3deg)}}@keyframes aospark{0%,100%{opacity:0}5%{opacity:1}13%{opacity:1}22%{opacity:0}}@media (prefers-reduced-motion: reduce){*{animation-duration:.001ms !important}}`}</style>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(700px_360px_at_20%_0%,rgba(214,194,154,0.10),transparent),radial-gradient(700px_360px_at_85%_100%,rgba(62,148,104,0.12),transparent)]" />

      <div className="mx-auto max-w-5xl">
        {/* header — locked pattern: champagne eyebrow → font-black h2 with one shimmer phrase → greige sub */}
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold" style={{ animation: "aoreveal .7s ease both" }}>{A.eyebrow}</div>
          <h2 className="mt-4 font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)" }}>
            <span className="text-g-word" style={{ animation: "aoreveal .8s cubic-bezier(.2,.7,.2,1) .05s both" }}>{A.h1a}</span>
            <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "aoreveal .8s cubic-bezier(.2,.7,.2,1) .2s both, aoshine 6s linear infinite" }}>{A.h1b}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-g-ink" style={{ animation: "aoreveal .8s ease .3s both" }}>{A.sub}</p>
        </div>

        {/* HIERARQUIA: 3 em destaque (ordem de prova) · o resto menor · "incluído" fora da grade.
            O `metaDe` continua lendo o META pela POSIÇÃO ORIGINAL — reordenar a exibição não pode
            trocar a cor/selo de cartão nenhum. */}
        {(() => {
          const idx = new Map(A.items.map((it, i) => [it, i]));
          const metaDe = (it) => META[idx.get(it)] || { rgb: "62,148,104", flavor: "green", featured: false };
          // "included" no meio de preços parece erro de tabela, não vantagem: sai da grade.
          const incluido = A.items.find((x) => (x.href || "") === "/nossa-gente");
          const naGrade = A.items.filter((x) => x !== incluido);
          const destaque = ORDEM_PROVA.map((k) => naGrade.find((x) => chaveAddon(x) === k)).filter(Boolean);
          const resto = naGrade.filter((x) => !destaque.includes(x));
          const cartao = (it, i, grande) => {
            const m = metaDe(it);
            const Card = it.href ? "a" : "div";
            const linkProps = it.href ? { href: it.href } : {};
            // p-5, não p-3.5: com 3.5 os oito cartões ficavam apertados logo depois de seções com
            // p-6, e densidade destoante lê como "outro site" tanto quanto cor errada. O respiro é
            // o que faz o bloco pertencer à mesma página.
            // Nome pela ORIGEM declarada. `null` (pid inexistente ou origem não declarada) faz o
            // card sumir em vez de virar promessa não-lastreada — falhar alto, nunca em silêncio.
            const nome = nomeDoAddon(it, lang);
            if (!nome) return null;
            return (
              <Card key={it.n} {...linkProps}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white/[0.03] p-5 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.05] ${m.featured ? `ring-1 ${m.champion ? "ring-g-gold/60" : "ring-g-gold/50"}` : ""}`}
                style={{ borderColor: m.featured ? "rgba(214,194,154,0.45)" : `rgba(${m.rgb},0.22)`, boxShadow: "0 14px 34px -28px rgba(0,0,0,0.85)", animation: `aoreveal .6s cubic-bezier(.2,.7,.2,1) ${0.2 + i * 0.07}s both` }}>
                <span className="absolute inset-x-0 top-0 h-[3px] opacity-70 transition-opacity duration-300 group-hover:opacity-100" style={{ background: `linear-gradient(90deg,transparent,rgba(${m.rgb},0.85),transparent)` }} />
                {/* christmas-lights chase: each card lights its border + glow in sequence */}
                <span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: `radial-gradient(130% 100% at 50% 0%, rgba(${m.rgb},0.20), transparent 72%)`, boxShadow: `inset 0 0 0 1.5px rgba(${m.rgb},0.95), 0 0 28px rgba(${m.rgb},0.6), 0 20px 54px -6px rgba(${m.rgb},0.7)`, opacity: 0, animation: `aospark 5.6s ease-in-out ${(i * 0.7).toFixed(2)}s infinite` }} />
                <div className="relative flex items-start justify-between gap-1.5">
                  <span className="select-none text-[26px]" style={{ filter: `drop-shadow(0 4px 12px rgba(${m.rgb},0.55))` }}>{it.e}</span>
                  {m.featured && <span className="rounded-full border border-g-gold/40 bg-g-gold/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-g-gold">{m.champion ? (A.champBadge || A.badge) : A.badge}</span>}
                </div>
                <div className={`mt-2 font-black leading-tight tracking-tight text-g-word ${grande ? "text-[16px]" : "text-[14px]"}`}>{nome}</div>
                {/* SEM RETICÊNCIAS. O `line-clamp-2` cortava a promessa no meio ("no-shows pay
                    for…"), que é o pior lugar possível: o leitor para exatamente onde o valor
                    apareceria. No destaque a frase sai inteira; no resto, clamp de 3 linhas. */}
                <p className={`mt-1 text-[11.5px] leading-snug text-g-ink ${grande ? "" : "line-clamp-3"}`}>{it.p}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-extrabold tabular-nums ${pill(m.flavor)}`}>{moedaExplicita(it.pr, lang)}</span>
                  <span className="inline-flex items-center rounded-full border border-g-line bg-white/[0.04] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-g-muted">{it.tg}</span>
                </div>
              </Card>
            );
          };
          return (
            <>
              {/* OS TRÊS — maiores, na ordem de prova, cada um com o passo numerado */}
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {destaque.map((it, i) => (
                  <div key={it.n} className="relative">
                    <span className="absolute -top-2 left-4 z-10 grid h-6 w-6 place-items-center rounded-full bg-g-gold text-[11px] font-black text-g-deep shadow-lift">{i + 1}</span>
                    {cartao(it, i, true)}
                  </div>
                ))}
              </div>
              {/* O RESTO — menor, sem selo, para quem já sabe o que quer */}
              <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {resto.map((it, i) => cartao(it, i + 3, false))}
              </div>
              {/* INCLUÍDO — linha, não cartão. Preço "included" ao lado de $97 lê como erro. */}
              {incluido && (
                <a href={incluido.href} className="mt-3 flex items-center gap-3 rounded-2xl border border-g-green/30 bg-g-green/[0.06] px-4 py-3 transition hover:border-g-green/60">
                  <span className="text-[20px]">{incluido.e}</span>
                  <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-g-ink">
                    <b className="text-g-word">{nomeDoAddon(incluido, lang)}</b> — {incluido.p}
                  </span>
                  <span className="shrink-0 rounded-full border border-g-green/40 bg-g-green/15 px-2.5 py-0.5 text-[11px] font-extrabold text-g-green">{incluido.pr}</span>
                </a>
              )}
            </>
          );
        })()}

        {/* 2 strategic — compact strip */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {/* white-label for agencies */}
          <a href="/parceiro" className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-g-line bg-white/[0.03] p-3.5 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-g-green/40 hover:bg-white/[0.05]"
            style={{ boxShadow: "0 14px 34px -28px rgba(0,0,0,0.85)", animation: "aoreveal .6s cubic-bezier(.2,.7,.2,1) .78s both" }}>
            <span className="select-none text-[26px]" style={{ filter: "drop-shadow(0 4px 12px rgba(62,148,104,0.55))" }}>🤝</span>
            <div className="min-w-0">
              <div className="text-[13.5px] font-black tracking-tight text-g-word">{A.wl.n}</div>
              <p className="line-clamp-2 text-[11.5px] leading-snug text-g-ink">{A.wl.p}</p>
            </div>
            <span aria-hidden className="ml-auto shrink-0 text-[14px] font-extrabold text-g-green transition-transform duration-300 group-hover:translate-x-0.5">→</span>
          </a>
          {/* annual plan — champagne accent */}
          <div className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-g-gold/30 bg-g-gold/[0.07] p-3.5 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-g-gold/50"
            style={{ boxShadow: "0 14px 34px -28px rgba(0,0,0,0.85)", animation: "aoreveal .6s cubic-bezier(.2,.7,.2,1) .85s both" }}>
            <span className="select-none text-[26px]" style={{ filter: "drop-shadow(0 4px 12px rgba(214,194,154,0.55))" }}>📦</span>
            <div className="min-w-0">
              <div className="text-[13.5px] font-black tracking-tight text-g-word">{A.an.n}</div>
              <p className="text-[11.5px] leading-snug text-g-gold/90">{A.an.p}</p>
            </div>
          </div>
        </div>

        {/* bottom CTA — exact silver/platinum pill from LegsV2 */}
        <div className="mt-7 text-center" style={{ animation: "aoreveal .8s ease .95s both" }}>
          <a href="#pricing" className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-7 py-3 text-[14px] font-extrabold tracking-tight text-[#1a1a1a] ring-1 ring-white/40 shadow-[0_16px_42px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.85)] transition-transform duration-300 hover:scale-[1.03]"
            style={{ background: "linear-gradient(180deg,#f5f6f8 0%,#dde1e7 42%,#bcc2cc 100%)" }}>
            <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-[120%] bg-gradient-to-r from-transparent via-white/80 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[120%]" />
            <span className="relative">💎 {A.cta}</span>
            <span className="relative text-g-green transition-transform duration-300 group-hover:translate-x-0.5">→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
