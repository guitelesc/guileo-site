import { useEffect, useMemo, useState } from "react";
import { useSeo } from "../lib/seo.js";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import VoiceAgent from "../components/VoiceAgent";
import { Reveal } from "../lib/ui.jsx";
import { waLink } from "../data/contact.js";
import LeadForm from "../components/LeadForm.jsx";
import { useLang } from "../i18n.jsx";
import { CATALOG, CATALOG_TOTAL } from "../data/serviceCatalog.js";
import { SEO_VERTICALS } from "../data/seoVerticals.js";
import { NOME_DO_PAINEL } from "../portal/nome.js";

// Per-group accent — from the official neon-realista signal palette
// (Gui = orange, info = blue, attention = amber, done = green) + champagne brand tones.
const GROUP_COLOR = ["#FF8A33", "#D6C29A", "#3E9468", "#F0B429", "#5CA8E8", "#C2A878"];
const GUI_ORANGE = "#FF8A33";

// Main verticals for the per-sector CTA row (each links to its /for/:slug SEO page).
const CTA_VERTICAL_SLUGS = ["restaurants", "dental-clinics", "medical-clinics", "law-firms", "real-estate", "salons-spas", "gyms-fitness", "plumbing-hvac"];

// UI chrome strings, quadrilingual (EN·PT·ES·HI) — content itself lives in serviceCatalog.js.
const UI = {
  eyebrow: { en: "The complete catalog", pt: "O catálogo completo", es: "El catálogo completo", hi: "पूरा कैटलॉग" },
  h1: { en: "Everything Gui does for your business", pt: "Tudo que a Gui faz pelo seu negócio", es: "Todo lo que Gui hace por tu negocio", hi: "गुई आपके बिज़नेस के लिए जो कुछ करती है" },
  sub: {
    en: "services across 6 areas — what each one does, what you gain, and the result you can expect. No fine print.",
    pt: "serviços em 6 áreas — o que cada um faz, o que você ganha e o resultado que pode esperar. Sem letra miúda.",
    es: "servicios en 6 áreas — qué hace cada uno, qué ganas y el resultado que puedes esperar. Sin letra pequeña.",
    hi: "6 क्षेत्रों में सेवाएँ — हर एक क्या करती है, आपको क्या मिलता है और कैसा नतीजा उम्मीद कर सकते हैं।",
  },
  search: { en: "🔍  Search a service — “reminders”, “upsell”, “CRM”…", pt: "🔍  Busque um serviço — “lembretes”, “upsell”, “CRM”…", es: "🔍  Busca un servicio — “recordatorios”, “upsell”, “CRM”…", hi: "🔍  सेवा खोजें — “रिमाइंडर”, “CRM”…" },
  noMatch: { en: "No match — try another word.", pt: "Nada encontrado — tente outra palavra.", es: "Sin resultados — prueba otra palabra.", hi: "कुछ नहीं मिला — दूसरा शब्द आज़माएँ।" },
  servicesWord: { en: "services", pt: "serviços", es: "servicios", hi: "सेवाएँ" },
  does: { en: "What it does", pt: "O que faz", es: "Qué hace", hi: "क्या करती है" },
  gain: { en: "You gain", pt: "Você ganha", es: "Tú ganas", hi: "आपको मिलता है" },
  result: { en: "Result", pt: "Resultado", es: "Resultado", hi: "नतीजा" },
  estimate: { en: "sector market estimate", pt: "estimativa de mercado por setor", es: "estimación de mercado por sector", hi: "सेक्टर बाज़ार अनुमान" },
  honesty: {
    en: "Honesty note: figures marked “estimate” are market estimates by sector — not a promise. Your weekly report shows the real value Gui generates for you.",
    pt: "Nota de honestidade: números marcados como “estimativa” são estimativas de mercado por setor — não uma promessa. Seu relatório semanal mostra o valor real que a Gui gera pra você.",
    es: "Nota de honestidad: las cifras marcadas como “estimación” son estimaciones de mercado por sector — no una promesa. Tu reporte semanal muestra el valor real que Gui genera para ti.",
    hi: "ईमानदारी की बात: “अनुमान” चिह्नित आँकड़े सेक्टर के बाज़ार अनुमान हैं — कोई वादा नहीं। साप्ताहिक रिपोर्ट में गुई की असली वैल्यू दिखती है।",
  },
  sectorTitle: { en: "See Gui at work in your sector", pt: "Veja a Gui trabalhando no seu setor", es: "Mira a Gui trabajando en tu sector", hi: "अपने सेक्टर में गुई को काम करते देखें" },
  sectorSub: { en: "Every service above, tuned to your business type.", pt: "Cada serviço acima, afinado pro seu tipo de negócio.", es: "Cada servicio de arriba, afinado a tu tipo de negocio.", hi: "ऊपर की हर सेवा, आपके बिज़नेस के हिसाब से।" },
  priceTitle: { en: "All of this, from $149/mo", pt: "Tudo isso, a partir de US$ 149/mês", es: "Todo esto, desde $149/mes", hi: "यह सब, $149/माह से" },
  priceSub: {
    en: "Self-service plans, live in minutes. Cancel anytime, 30-day money-back.",
    pt: "Planos de auto-serviço, no ar em minutos. Cancele quando quiser, 30 dias de garantia.",
    es: "Planes de autoservicio, en marcha en minutos. Cancela cuando quieras, 30 días de garantía.",
    hi: "सेल्फ़-सर्विस प्लान, मिनटों में लाइव। कभी भी रद्द करें, 30 दिन की गारंटी।",
  },
  priceCta: { en: "See plans →", pt: "Ver planos →", es: "Ver planes →", hi: "प्लान देखें →" },
  demoTitle: { en: "Easier to hear it than read it?", pt: "Mais fácil ouvir do que ler?", es: "¿Más fácil escucharlo que leerlo?", hi: "पढ़ने से आसान सुनना?" },
  demoCta: { en: "Let Gui call you — free live demo →", pt: "Deixe a Gui te ligar — demo grátis ao vivo →", es: "Deja que Gui te llame — demo gratis en vivo →", hi: "गुई को कॉल करने दें — मुफ़्त लाइव डेमो →" },
  notSure: { en: "Not sure where to start?", pt: "Não sabe por onde começar?", es: "¿No sabes por dónde empezar?", hi: "समझ नहीं आ रहा कहाँ से शुरू करें?" },
  notSureSub: {
    en: "Tell us your goal — a real human designs the right mix and quotes it. No generic packages.",
    pt: "Conte seu objetivo — uma pessoa de verdade monta o mix certo e orça. Nada de pacote genérico.",
    es: "Cuéntanos tu meta — una persona real arma la mezcla correcta y la cotiza. Nada de paquetes genéricos.",
    hi: "अपना लक्ष्य बताएँ — एक असली इंसान सही मिश्रण बनाकर कोटेशन देगा। कोई जेनेरिक पैकेज नहीं।",
  },
  waTalk: { en: "💬 Talk on WhatsApp", pt: "💬 Falar no WhatsApp", es: "💬 Hablar por WhatsApp", hi: "💬 WhatsApp पर बात करें" },
};

// ── OS 6 GRUPOS AGORA MORAM DENTRO DOS 3 PILARES (2026-08-12) ──────────────────────────────────
// Luis: «unifica as duas». Esta página mostrava DUAS classificações ao mesmo tempo — os pilares
// (como vendemos) e os 6 grupos (como se organiza). Nenhuma errada, e era isso que confundia: o
// visitante tinha que descobrir sozinho que eram VISTAS da mesma coisa, não coisas diferentes.
// Agora é uma árvore: PILAR → grupo → serviço. O `pilar` vem de serviceCatalog.js (grupo ou, no
// Guarda-chuva que é misto, do próprio serviço) — nunca de uma lista escrita aqui.
const PILAR_INFO = {
  brain: { emoji: "🧠", rgb: "255,138,51",
    nome: { en: "Guileo Brain", pt: "Guileo Brain", es: "Guileo Brain", hi: "Guileo Brain" },
    linha: { en: "What the AI employee does on its own", pt: "O que a agente faz sozinha",
             es: "Lo que la agente hace sola", hi: "एजेंट खुद क्या करती है" } },
  ad: { emoji: "📈", rgb: "76,154,255",
    nome: { en: "Guileo AD", pt: "Guileo AD", es: "Guileo AD", hi: "Guileo AD" },
    linha: { en: "What the marketing team runs for you", pt: "O que o time de marketing roda pra você",
             es: "Lo que el equipo de marketing hace por ti", hi: "मार्केटिंग टीम आपके लिए क्या चलाती है" } },
  build: { emoji: "🏗️", rgb: "154,160,255",
    nome: { en: "Guileo Build", pt: "Guileo Build", es: "Guileo Build", hi: "Guileo Build" },
    linha: { en: "What the engineering team builds once", pt: "O que o time de engenharia constrói uma vez",
             es: "Lo que ingeniería construye una vez", hi: "इंजीनियरिंग टीम एक बार क्या बनाती है" } },
};
const ORDEM_PILARES = ["brain", "ad", "build"];
// Reagrupa o catálogo já filtrado pela busca: pilar → grupos (com só os serviços daquele pilar).
// Um grupo misto (o Guarda-chuva) aparece nos DOIS pilares, cada vez com os serviços que são dele
// — o que é a leitura correta: ele nunca foi um bloco só, era uma gaveta com duas coisas dentro.
function porPilar(grupos) {
  return ORDEM_PILARES.map((pilar) => {
    const gs = grupos.map((g) => {
      const servs = (g.services || []).filter((s) => (s.pilar || g.pilar) === pilar);
      return servs.length ? { ...g, services: servs } : null;
    }).filter(Boolean);
    const total = gs.reduce((n, g) => n + g.services.length, 0);
    return total ? { pilar, grupos: gs, total } : null;
  }).filter(Boolean);
}

export default function Servicos() {
  const { lang } = useLang();
  const L = (o) => (o && (o[lang] || o.en)) || "";
  const u = (k) => L(UI[k]);
  useSeo({
    title:
      lang === "pt" ? "Serviços Guileo — tudo que a IA Gui faz: atende, agenda, vende, cobra e cresce seu negócio"
      : lang === "es" ? "Servicios Guileo — todo lo que la IA Gui hace: atiende, agenda, vende, cobra y crece tu negocio"
      : "Guileo Services — everything Gui the AI does: answers, books, sells, collects & grows your business",
    description:
      lang === "pt" ? `O catálogo completo: atendimento 24/7, agendamento com lembretes, fechamento com cobrança no próprio Stripe, win-back, ${NOME_DO_PAINEL} com relatório de valor real — e o guarda-chuva Guileo de sites, apps e marketing. A partir de US$ 149/mês.`
      : lang === "es" ? `El catálogo completo: atención 24/7, agenda con recordatorios, cierre con cobro a tu propio Stripe, win-back, ${NOME_DO_PAINEL} con reporte de valor real — y el paraguas Guileo de sitios, apps y marketing. Desde $149/mes.`
      : `The complete catalog: 24/7 answering, booking with reminders, close & collect into your own Stripe, win-back, a ${NOME_DO_PAINEL} with real-value reporting — plus the Guileo umbrella of websites, apps and marketing. From $149/mo.`,
    path: "/servicos",
  });

  // Service structured data — same safe pattern as Planos.jsx: <script> + textContent (no innerHTML).
  useEffect(() => {
    const graph = [
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: "Guileo AI Receptionist & Business Growth Platform",
        description: "AI that answers calls 24/7, books appointments, sells, collects payment and grows local businesses.",
        provider: { "@type": "Organization", name: "Guileo", url: "https://guileoai.com" },
        areaServed: "US",
        url: "https://guileoai.com/servicos",
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Guileo Services Catalog",
          itemListElement: CATALOG.map((g) => ({
            "@type": "OfferCatalog",
            name: g.group.en,
            itemListElement: g.services.map((s) => ({
              "@type": "Offer",
              itemOffered: { "@type": "Service", name: s.name.en, description: s.does.en },
            })),
          })),
        },
      },
    ];
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.id = "servicos-jsonld";
    s.textContent = JSON.stringify(graph);
    document.head.appendChild(s);
    return () => { document.getElementById("servicos-jsonld")?.remove(); };
  }, []);

  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return CATALOG;
    return CATALOG.map((g) => ({
      ...g,
      services: g.services.filter((s) =>
        (L(s.name) + " " + L(s.does) + " " + L(s.gain) + " " + L(s.result) + " " + L(g.group)).toLowerCase().includes(ql)
      ),
    })).filter((g) => g.services.length > 0);
  }, [q, lang]);

  const wa = waLink(lang === "pt" ? "Oi Guileo! Quero montar o mix certo pro meu negócio." : lang === "es" ? "¡Hola Guileo! Quiero armar la mezcla correcta para mi negocio." : "Hi Guileo! I'd like to design the right mix for my business.");
  const verticals = CTA_VERTICAL_SLUGS.map((slug) => SEO_VERTICALS.find((v) => v.slug === slug)).filter(Boolean);

  return (
    <div className="min-h-screen text-g-ink">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header className="pt-28 pb-10 bg-white/[0.05] backdrop-blur-md border-b border-g-line relative overflow-hidden">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full blur-3xl pointer-events-none" style={{ background: GUI_ORANGE + "14" }} />
        <div className="wrap relative">
          <span className="eyebrow mb-3">{u("eyebrow")}</span>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-g-word max-w-3xl">{u("h1")}</h1>
          <p className="mt-3 text-g-muted max-w-2xl">{CATALOG_TOTAL} {u("sub")}</p>
          <div className="mt-6 max-w-xl">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label={u("search")} placeholder={u("search")}
              className="w-full rounded-full border border-g-line bg-white/[0.035] px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-gold" />
          </div>
          {/* Group index — anchors down the page */}
          <div className="mt-5 flex flex-wrap gap-2">
            {CATALOG.map((g, i) => (
              <a key={i} href={`#grupo-${i}`} className="inline-flex items-center gap-1.5 rounded-full border border-g-line bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-g-ink hover:text-g-word transition" style={{ borderColor: GROUP_COLOR[i] + "40" }}>
                <span>{g.icon}</span> {L(g.group)}
              </a>
            ))}
          </div>
        </div>
      </header>

      {/* Lead the services page with the SAME 3-pillar story as the landing (ecosystem coherence) */}
      {/* ── O BLOCO DOS PILARES SAIU DAQUI (2026-08-12) ────────────────────────────────────────
          Ele era a SEGUNDA taxonomia da página — a razão de o Luis pedir "unifica as duas". Agora
          que os 6 grupos do catálogo moram DENTRO dos 3 pilares (pilar → grupo → serviço), manter
          um bloco separado que também apresenta os pilares é dizer a mesma coisa duas vezes na
          mesma rolagem: primeiro em resumo, depois em detalhe. O visitante lia as duas para
          descobrir que eram uma.
          Ele continua na LANDING, que é onde os pilares fazem o trabalho de VENDER. Aqui, onde o
          trabalho é DETALHAR, o pilar já é o título de cada seção — apresentá-lo de novo antes
          seria um índice do que vem logo abaixo. Unificar não foi juntar os dois blocos: foi
          descobrir que um deles virou a estrutura do outro. */}

      <div className="wrap py-10">
        {groups.length === 0 && <div role="status" className="text-center py-20 text-g-muted">{u("noMatch")}</div>}

        {/* ── Group sections ─────────────────────────────────────────────── */}
        {porPilar(groups).map((bloco) => {
          const info = PILAR_INFO[bloco.pilar];
          return (
        <div key={bloco.pilar} className="mb-16">
          {/* O PILAR é o título de nível 1 — a taxonomia única desta página. */}
          <Reveal>
            <div className="mb-6 flex items-baseline gap-3 border-b pb-3" style={{ borderColor: `rgba(${info.rgb},0.28)` }}>
              <span className="text-2xl">{info.emoji}</span>
              <h2 className="text-[26px] font-black tracking-tight" style={{ color: `rgb(${info.rgb})` }}>{L(info.nome)}</h2>
              <span className="text-[13px] text-g-muted">{L(info.linha)}</span>
              <span className="ml-auto text-[11px] font-black tabular-nums" style={{ color: `rgb(${info.rgb})` }}>{bloco.total}</span>
            </div>
          </Reveal>
        {bloco.grupos.map((g) => {
          const gi = CATALOG.indexOf(CATALOG.find((c) => c.group.en === g.group.en));
          const color = GROUP_COLOR[gi] || GUI_ORANGE;
          return (
            <section key={g.group.en} id={`grupo-${gi}`} className="mb-14 scroll-mt-24">
              <Reveal>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-3xl">{g.icon}</span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-g-word">{L(g.group)}</h2>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full mt-1" style={{ background: color + "1A", color }}>{g.services.length} {u("servicesWord")}</span>
                </div>
                <p className="text-sm text-g-muted mb-6 ml-12" style={{ color: color + "CC" }}>{L(g.tagline)}</p>
              </Reveal>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {g.services.map((s, si) => (
                  <Reveal key={si}>
                    <article className="h-full rounded-xl3 bg-white/[0.05] backdrop-blur-md border border-g-line shadow-soft p-5 flex flex-col" style={{ borderTop: `3px solid ${color}` }}>
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl shrink-0">{s.icon}</span>
                        <h3 className="font-extrabold text-g-word text-[15px] leading-snug">{L(s.name)}</h3>
                      </div>
                      <p className="mt-3 text-[13px] leading-relaxed text-g-ink">{L(s.does)}</p>
                      {/* ── UMA VOZ ALTA, UMA BAIXA (2026-08-12) ──────────────────────────────────
                          Antes cada um dos 35 cards trazia DOIS blocos rotulados em caixa alta —
                          "VOCÊ GANHA" e "RESULTADO" — com o mesmo peso visual. Medi o conteúdo:
                          33 dos 35 `result` apenas RE-DIZEM o `gain` com outras palavras ("uma
                          vitrine que de fato vende" × "sua presença trabalha tanto quanto seu
                          balcão"). Multiplicado por 35, viram 13 mil caracteres e 70 rótulos
                          gritando. A página não confundia por falta de informação: confundia
                          porque se repetia 35 vezes, e duas afirmações do mesmo tamanho competindo
                          fazem o olho ler as duas para descobrir que eram uma.
                          ⚠️ POR QUE NÃO APAGUEI O `result`: os outros 2 carregam informação
                          COMERCIAL que não está em lugar nenhum — "orçado por trabalho, não
                          incluído no mensal" (vídeo) e o número de ligações perdidas. Corte cego
                          teria destruído justamente o aviso que evita mal-entendido na assinatura.
                          Então é hierarquia, não exclusão: o GANHO fala alto (é o que vende), o
                          resultado vira eco discreto. Os 2 informativos continuam legíveis porque
                          são distintos; os 33 poéticos param de disputar. */}
                      <div className="mt-3 rounded-lg px-3 py-2 text-[13px] font-bold text-g-light bg-g-green/[0.10] border border-g-green/25">
                        {L(s.gain)}
                      </div>
                      <div className="mt-auto pt-3">
                        <p className="text-[12px] leading-relaxed text-g-muted">{L(s.result)}</p>
                        {s.resultIsEstimate && (
                          <p className="mt-1 text-[11px] italic text-g-muted">※ {u("estimate")}</p>
                        )}
                      </div>
                    </article>
                  </Reveal>
                ))}
              </div>
            </section>
          );
        })}
        </div>
          );
        })}

        {/* Honesty note — Guileo's signature transparency style */}
        <Reveal>
          <p className="text-[12px] text-g-muted italic border-l-2 border-g-gold/40 pl-4 max-w-2xl">{u("honesty")}</p>
        </Reveal>

        {/* ── Per-sector CTA row ─────────────────────────────────────────── */}
        <Reveal>
          <section className="mt-14 rounded-xl3 bg-white/[0.03] backdrop-blur-md border border-g-line p-7 sm:p-9">
            <h2 className="text-xl sm:text-2xl font-extrabold text-g-word">{u("sectorTitle")}</h2>
            <p className="mt-1 text-sm text-g-muted">{u("sectorSub")}</p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              {verticals.map((v) => (
                <a key={v.slug} href={`/for/${v.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-g-line bg-white/[0.05] px-4 py-2 text-sm font-bold text-g-ink hover:text-g-word hover:border-g-gold/50 transition">
                  <span>{v.icon}</span> {L(v.name)} <span className="text-g-muted font-normal">→</span>
                </a>
              ))}
            </div>
          </section>
        </Reveal>

        {/* ── Pricing bridge + live demo ─────────────────────────────────── */}
        <Reveal>
          <section className="mt-8 grid md:grid-cols-2 gap-5">
            <div className="rounded-xl3 border border-g-gold/30 bg-gradient-to-b from-g-gold/[0.10] to-white/[0.03] p-7 flex flex-col">
              <h2 className="text-xl font-extrabold text-g-word">{u("priceTitle")}</h2>
              <p className="mt-2 text-sm text-g-muted flex-1">{u("priceSub")}</p>
              <a href="/planos" className="btn mt-5 self-start text-sm" style={{ background: "#D6C29A", color: "#161512" }}>{u("priceCta")}</a>
            </div>
            <div className="rounded-xl3 border p-7 flex flex-col" style={{ borderColor: GUI_ORANGE + "45", background: GUI_ORANGE + "0D" }}>
              <h2 className="text-xl font-extrabold text-g-word">{u("demoTitle")}</h2>
              <p className="mt-2 text-sm text-g-muted flex-1">{L({ en: "Enter your number and Gui calls you in seconds — a live demo of everything on this page.", pt: "Digite seu número e a Gui te liga em segundos — uma demo ao vivo de tudo desta página.", es: "Escribe tu número y Gui te llama en segundos — una demo en vivo de todo lo de esta página.", hi: "अपना नंबर डालें और गुई सेकंडों में कॉल करेगी — इस पेज की हर चीज़ का लाइव डेमो।" })}</p>
              <a href="/#try" className="btn mt-5 self-start text-sm" style={{ background: GUI_ORANGE, color: "#161512" }}>{u("demoCta")}</a>
            </div>
          </section>
        </Reveal>

        {/* ── "Not sure" lead capture — preserved from the original page ──── */}
        <div id="contact" className="mt-12 scroll-mt-24 rounded-xl3 bg-white/[0.03] backdrop-blur-xl border border-white/10 p-8 sm:p-12 shadow-lift relative overflow-hidden">
          <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-g-green/15 blur-3xl animate-aurora pointer-events-none" />
          <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-g-gold/15 blur-3xl animate-aurora pointer-events-none" style={{ animationDelay: "-6s" }} />
          <div className="relative max-w-2xl mx-auto">
            <div className="text-center">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-g-word">{u("notSure")}</h3>
              <p className="mt-2 text-sm text-g-muted">{u("notSureSub")}</p>
            </div>
            <div className="mt-7"><LeadForm source="services-page" /></div>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <a href={wa} target="_blank" rel="noopener" className="btn-ghost text-sm">{u("waTalk")}</a>
              <a href="/planos" className="btn-ghost text-sm">{u("priceCta")}</a>
            </div>
          </div>
        </div>
      </div>

      <Footer />
      <VoiceAgent />
    </div>
  );
}
