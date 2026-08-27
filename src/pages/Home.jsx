import { useEffect, lazy, Suspense } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import VoiceAgent from "../components/VoiceAgent";
import ExitIntent from "../components/ExitIntent.jsx";
import LiveCall from "../components/LiveCall.jsx";
import Intro from "../components/Intro.jsx";
import LeadForm from "../components/LeadForm.jsx";
import StickyCtaMobile from "../components/StickyCtaMobile.jsx";
import { Reveal, Magnetic, Accordion } from "../lib/ui.jsx";
import HeroV2 from "../components/HeroV2";
import ServicesMarquee from "../components/ServicesMarquee.jsx";
import ResultsV2 from "../components/ResultsV2";
import PillarsProducts from "../components/PillarsProducts.jsx";
import LegsV2 from "../components/LegsV2";
import EngineV2 from "../components/EngineV2.jsx";
import ChannelsStrip from "../components/ChannelsStrip.jsx";
import MethodV2 from "../components/MethodV2";
import ProofV2 from "../components/ProofV2";
import FounderProof from "../components/FounderProof";
import PulseSection from "../components/PulseSection"; // GUILEO PULSE — standalone XM/satisfaction product wedge ($49/mo flat)
import TrustStrip from "../components/TrustStrip.jsx";
import PricingTiers from "../components/PricingTiers.jsx";
import AddOnsV2 from "../components/AddOnsV2";
import { waLink, bookLink } from "../data/contact.js";
import { FaCheck, FaMinus, FaXmark } from "react-icons/fa6";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";

// Personalized-brand demo (heavy: AI brand pull + preview surfaces) — lazy so it ships as its own
// chunk and never bloats the landing's first paint. The visitor types their site → sees THEIR
// business with Gui → becomes a captured lead feeding the onboarding funnel.
const DemoEngine = lazy(() => import("../components/DemoEngine.jsx"));


/* A MARCA DA TABELA — disco com glifo vetorial. Três estados e uma regra: quem FAZ é verde
   nítido, quem faz EM PARTE é âmbar (a cor de "precisa de você"), quem NÃO faz é cinza apagado —
   o vazio é a informação. `forte` só engrossa o da coluna da Guileo. */
function CompMarca({ k, forte = false }) {
  const M = {
    sim:   { Ico: FaCheck,  c: "47,227,154" },
    parte: { Ico: FaMinus,  c: "255,194,61" },
    nao:   { Ico: FaXmark,  c: "148,140,123" },
  }[k] || { Ico: FaMinus, c: "148,140,123" };
  const { Ico, c } = M;
  const apagado = k === "nao";
  return (
    <span aria-hidden="true" className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[11px]"
      style={{ color: `rgba(${c},${apagado ? 0.5 : 1})`,
               background: `rgba(${c},${apagado ? 0.06 : forte ? 0.16 : 0.11})`,
               boxShadow: `inset 0 0 0 1px rgba(${c},${apagado ? 0.22 : forte ? 0.6 : 0.4})` }}>
      <Ico />
    </span>
  );
}

/* Shared section header — the LegsV2/MethodV2 pattern: mono uppercase champagne eyebrow
   → big font-black headline (one shimmer phrase) → short greige sub. One language everywhere. */
function SectionHead({ eyebrow, h2, sub, className = "mb-10", subMax = "max-w-xl" }) {
  return (
    <Reveal className={`mx-auto max-w-2xl text-center ${className}`}>
      <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{eyebrow}</div>
      <h2 className="mt-4 font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)" }}>
        <span className="bg-gradient-to-r from-g-word via-g-gold to-g-word bg-[length:220%_auto] bg-clip-text text-transparent animate-shimmer">{h2}</span>
      </h2>
      {sub && <p className={`mx-auto mt-4 ${subMax} text-[15px] leading-relaxed text-g-ink`}>{sub}</p>}
    </Reveal>
  );
}

/* Primary CTA — the silver/platinum pill from LegsV2 (the approved primary-CTA language). */
function SilverCta({ href = "#contact", children }) {
  return (
    <a href={href} className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-7 py-3 text-[14px] font-extrabold tracking-tight text-[#1a1a1a] ring-1 ring-white/40 shadow-[0_16px_42px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.85)] transition-transform duration-300 hover:scale-[1.03]"
      style={{ background: "linear-gradient(180deg,#f5f6f8 0%,#dde1e7 42%,#bcc2cc 100%)" }}>
      <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-[120%] bg-gradient-to-r from-transparent via-white/80 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[120%]" />
      <span className="relative">{children}</span>
      <span className="relative text-g-green transition-transform duration-300 group-hover:translate-x-0.5">→</span>
    </a>
  );
}

export default function Home() {
  const { t, lang } = useLang();
  useSeo({
    // O SEO falava SÓ da IA — e a Guileo também faz anúncios, marketing, site e software. Quem
    // procurava "agência de marketing" ou "quem faz meu site" no Google nunca nos encontrava, e
    // quem chegava pela IA não descobria o resto. A palavra que não está no título não existe na
    // busca. Auditoria 2026-08-11.
    // HONESTIDADE: "anúncios conduzidos por gente" é o que de fato acontece (o time cria e gere as
    // campanhas — functions/api/google-ads.js diz isso explicitamente). App e software entram como
    // PROJETO sob medida, nunca como item do mensal, porque é isso que são.
    title: lang === "pt" ? "Guileo — IA, anúncios e criação para o seu negócio · atende 24/7, e ainda faz seu site" : lang === "es" ? "Guileo — IA, anuncios y creación para tu negocio · atiende 24/7, y hace tu sitio" : "Guileo — AI, ads & creative for your business · answers 24/7, and builds your site",
    description: lang === "pt" ? "Uma casa só: a IA atende ligações e mensagens, agenda e vende 24/7 em 16 idiomas — e o time conduz seus anúncios, marketing e conteúdo, e constrói site, app e software sob medida. No ar em até 7 dias. A partir de $149/mês, 30 dias de garantia." : lang === "es" ? "Una sola casa: la IA atiende llamadas y mensajes, agenda y vende 24/7 en 16 idiomas — y el equipo conduce tus anuncios, marketing y contenido, y construye sitio, app y software a medida. En marcha en 7 días. Desde $149/mes, 30 días de garantía." : "One house: the AI answers calls and messages, books and sells 24/7 in 16 languages — and the team runs your ads, marketing and content, and builds your site, app and custom software. Live in 7 days. From $149/mo, 30-day money-back.",
    path: "/",
  });
  // FAQPage JSON-LD built from the SAME items the Accordion renders, so the schema always matches
  // the visible FAQ (Google's requirement) and can surface FAQ rich results in search.
  useEffect(() => {
    const items = t?.faq?.items || [];
    if (!items.length) return;
    const ld = {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: items.map(([q, a]) => ({
        "@type": "Question", name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    };
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.id = "home-faq-jsonld";
    s.textContent = JSON.stringify(ld);
    document.head.appendChild(s);
    return () => { document.getElementById("home-faq-jsonld")?.remove(); };
  }, [t]);

  // Cross-page anchors (/#try from 404/planos/navbar on another route): Home is lazy-loaded, so the
  // browser's native anchor jump fires before the section exists. Scroll once the content mounts.
  useEffect(() => {
    const id = (window.location.hash || "").slice(1);
    if (!id) return;
    // small retry loop — sections below the hero mount progressively
    let tries = 0;
    const tick = setInterval(() => {
      const el = document.getElementById(id);
      if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); clearInterval(tick); }
      else if (++tries > 20) clearInterval(tick);
    }, 150);
    return () => clearInterval(tick);
  }, []);
  return (
    <div className="min-h-screen text-g-ink">
      <Intro />
      <Navbar />

      {/* ── Tightened single-buyer funnel: Hook → Problem/Result → Solution → How → Proof → Demo → Offer → Close ── */}
      <HeroV2 />              {/* Hook — never miss a call, a lead, or a sale */}
      <TrustStrip />          {/* Honest trust bar HIGH on the page — money-back · human-supervised · 7-day launch · 20+ langs */}

      {/* ── O SIMULADOR SAIU (Luis, 2026-08-11: "tá muito nada, ve") ──────────────────────────
          Ele tinha SUBIDO pra cá hoje mesmo, e a mudança de posição foi certa — o problema era o
          conteúdo, não o lugar. Um simulador é uma conversa que já aconteceu: o visitante escolhe
          um tipo de negócio e assiste um roteiro rodar. Ao lado de duas coisas que a Gui faz DE
          VERDADE — o DemoEngine e a ligação ao vivo, que devolve o telefone dele tocando — a
          simulação lê como enfeite. "Nada" é a palavra exata: parece interação e não é.
          Tirar foi mais honesto que melhorar. Componente preservado em components/CallSimulator.jsx
          (só o uso na Home saiu), então volta com uma linha se um dia fizer sentido. */}

      <ResultsV2 />          {/* Problem + promise — you buy results; here's the leak (id=industries anchor) */}
      <LegsV2 />             {/* The WHY — the 3 pillars own performance / sales / growth (the emotional spine) */}

      {/* ═══ O MOTOR DE MARKETING — de volta à Home, PRESO no fio que sai da planta ═══════════
          Luis (2026-08-20): «o motor marketing tá horrível! o texto tá lindo mas precisa ser algo
          único... talvez um motor de círculo do marketing — tinha antes, algo bem legal».
          Tinha mesmo: EngineV2 existia, funcionava e estava FORA da Home (foi feito para o /v2 e
          nunca voltou). «Cada conversa se acumula: ligação vira dado, dado vira marketing mais
          esperto, marketing vira recompra — num ciclo.»
          A POSIÇÃO É O PONTO: entra IMEDIATAMENTE depois do LegsV2 porque o fio que sai por baixo
          da logo desce e morre exatamente aqui. Qualquer seção entre os dois quebra a emenda e a
          página volta a parecer três assuntos empilhados em vez de uma planta crescendo. */}
      <EngineV2 />

      {/* ═══ A LISTRA DOS 18 SERVIÇOS — MUDOU DE LUGAR (Luis, 2026-08-20) ═══════════════════
          «essa parte Brain · AD · Build — 18 services … vai no meio ali, transfere ela e adapta».
          Ficava logo abaixo do herói. Agora fica entre o MOTOR e os TRÊS PILARES, e a ordem passa
          a contar uma história em vez de listar coisas:
             o motor mostra COMO funciona → a listra mostra TUDO que existe → os pilares AGRUPAM e
             entregam o resultado.
          Também preenche o vazio que havia entre as duas seções, que era o que parecia buraco.
          ⚠️ CUSTO DECLARADO: a amplitude do catálogo sai da PRIMEIRA tela. Existe uma regra antiga
          na casa dizendo que ela deve estar acima da dobra — quem chega por anúncio decidia ali o
          que a Guileo é. Foi decisão explícita do dono; se o topo esfriar, é aqui que se volta. */}
      <ServicesMarquee />

      <PillarsProducts />    {/* The WHAT — each pillar's REAL products → result → value (replaces WholePicture + old ProductResults; aligns landing to the platform) */}
      <ChannelsStrip />      {/* Reach — a slim logo strip (folded from the old full ChannelsV2 phone section) */}

      {/* ⛔ "VEJA NA SUA MARCA" SAIU (Luis, 2026-08-25: «apagar isso aqui») ──────────────────
          Era o campo "digite seu site ou @" que montava uma prévia na marca do visitante
          (<DemoEngine surface="public" />). Saiu da landing; o motor continua vivo e é o mesmo
          que serve /vitrine/:token e o vendedor — só perdeu a vitrine pública.
          ↩️ Para voltar: reimportar o lazy DemoEngine e devolver a <section id="veja"> aqui. */}

      <MethodV2 />           {/* How you start — live in under 7 days, human-led */}
      <ProofV2 />            {/* Trust badges, right before the demo + offer */}
      <FounderProof />       {/* Founder note + (future) real client quotes — the human voice before the demo */}
      {/* (GUILEO PULSE desceu para DEPOIS do preço — ver a nota na nova posição.) */}

      {/* ↩️ A CHAMADA AO VIVO VOLTOU (Luis, 2026-08-25: «volta o LiveCall melhorado») ─────────
          Tinha saído horas antes na limpeza («deleta isso»); a volta é decisão do dono e vem com
          quatro melhorias em vez de restauração seca:
          1. POSIÇÃO — antes morava no fim da página, depois de tudo. Agora vem logo após o
             Método, cujo passo 2 promete literalmente "você vê: sua Gui atendendo, AO VIVO".
             A ligação é a prova imediata dessa promessa — promessa e prova coladas.
          2. O divisor Faena voltou enxuto (uma linha, dois filetes) — ele entrega o palco.
          3. O cartão entrou na lei do vidro 4K (era a única superfície com gradiente colorido
             pesado e sombra própria — ver LiveCall.jsx).
          4. Chips de emoji viraram glifos vetoriais (a regra da casa).
          Com isso a landing recupera sua captura de telefone mais quente (consentimento TCPA +
          speed-to-lead) que a limpeza tinha custado. */}
      <Reveal variant="scale" className="relative wrap py-12 text-center">
        <div className="mx-auto h-px w-40 bg-gradient-to-r from-transparent via-g-gold/55 to-transparent" />
        <p className="mt-6 mx-auto max-w-2xl font-black leading-[1.05] tracking-tight" style={{ fontSize: "clamp(1.5rem,3.4vw,2.4rem)" }}>
          <span className="text-g-word">{lang === "pt" ? "Agora pare de ler. " : lang === "es" ? "Ahora deja de leer. " : lang === "hi" ? "अब पढ़ना बंद करें। " : "Now stop reading. "}</span>
          <span style={{ color: "#FF8A33", textShadow: "0 0 30px rgba(255,138,51,0.40)" }}>{lang === "pt" ? "Ouça a Gui trabalhar." : lang === "es" ? "Escucha a Gui trabajar." : lang === "hi" ? "Gui को काम करते सुनें।" : "Hear Gui work."}</span>
        </p>
        <div className="mt-6 mx-auto h-px w-40 bg-gradient-to-r from-transparent via-g-gold/55 to-transparent" />
      </Reveal>

      <section id="try" className="relative px-5 pb-20 pt-4">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(700px_360px_at_50%_0%,rgba(62,148,104,0.10),transparent)]" />
        <LiveCall />
      </section>

      {/* REAL PRICE — the 3 canonical tiers with the actual number (audit: the price was hidden on /planos) */}
      {/* ═══ GUILEO PULSE, DE VOLTA ANTES DO PREÇO (Luis, 2026-08-25: «inverter de lugar com
          os planos») ═══════════════════════════════════════════════════════════════════════
          ⚠️ ISSO REVERTE UMA DECISÃO DOCUMENTADA EM 2026-08-11, e o argumento de lá continua
          verdadeiro: ver $49 antes de $149–$999 não posiciona o Pulse como porta de entrada,
          DESQUALIFICA o resto ("então o outro é caro"). O barato ao lado do caro não vende — apaga.
          O que muda agora e torna a inversão defensável: o Pulse foi reescrito como DEGRAU, não
          como produto concorrente — ele diz explicitamente que o valor vira crédito no plano. Uma
          escada lida de baixo para cima funciona; dois produtos lado a lado, não.
          👉 Se a conversão do plano cair, é AQUI que se volta. */}
      <PulseSection />
      {/* REAL PRICE — os 3 planos canônicos, agora DEPOIS do degrau de $49 */}
      <PricingTiers />

      {/* BUILD-YOUR-PACKAGE — the interactive configurator to tailor + close */}
      {/* ── O CONFIGURADOR SAIU (Luis, 2026-08-11: "essas duas têm que melhorar, talvez deixar
          só a segunda") ────────────────────────────────────────────────────────────────────────
          Eram DOIS jeitos de comprar, um debaixo do outro: o configurador de 2 passos (marque o
          que dói → conte do seu negócio → sai um pacote com créditos e ROI estimado) e, logo
          abaixo, o quadro de 3 planos com o preço real. Duas máquinas de decisão coladas não
          somam — dividem: o visitante que já tinha escolhido um plano volta a ficar em dúvida, e
          quem estava montando o pacote descobre que existia um cardápio pronto o tempo todo.
          Ficou o quadro de planos, que é o que fecha, com o caminho SOB MEDIDA ao lado (agora sem
          número — pede a conversa). Componente vivo em components/PricingConfigurator.jsx; ele
          serve melhor numa página própria, onde é o assunto e não o concorrente do preço. */}

      {/* ⛔ OS ADD-ONS SAÍRAM (Luis, 2026-08-25: «deleta isso») ─────────────────────────────
          Sete cartões de "+$97/mês", "+$197/mês", "setup $297" depois do quadro de planos. A
          objeção que ele já tinha levantado em 2026-08-12 ("tá só ocupando espaço") nunca foi
          resolvida: a seção somava preço em cima de preço na cabeça de quem acabou de decidir.
          ↩️ Componente vivo em components/AddOnsV2.jsx; os add-ons continuam existindo como
          PRODUTO (productSystem.js) e são vendidos pelo vendedor no /vendedor — só saíram da
          vitrine da landing. */}

      {/* ── GUILEO PULSE, AGORA DEPOIS DO PREÇO (Luis, 2026-08-11) ────────────────────────────
          Ele estava ANTES dos planos, e o problema não era a seção — era a ARITMÉTICA que ela
          criava na cabeça do visitante. O Pulse custa $49. O plano custa $149, $449, $999. Ver o
          $49 primeiro não posiciona o Pulse como porta de entrada: DESQUALIFICA o resto. Ninguém
          compra o de $449 logo depois de ler que existe um de $49 — a pessoa não conclui "esse é
          menor", conclui "então o outro é caro". O barato não vende ao lado do caro; ele apaga.
          Depois do preço, a mesma seção muda de papel: quem já viu $149–$999 e achou cedo demais
          agora encontra uma porta de $49 em vez de fechar a aba. De concorrente do plano, virou
          rede de segurança dele.
          Luis: "isso pode baratear tudo, ninguém vai querer o caro — mas gostei que já é super
          hot lead". Por isso o formulário "me liga" continua exatamente como está: é a captura
          mais quente da página. Só o LUGAR mudou.
          ⏳ AINDA ABERTO: a seção continua LONGA e confusa (herói + 4 cartões + estatística +
          comparação + preço + formulário = uma landing dentro da landing). Encurtar é o próximo
          passo, e é mudança de conteúdo — não misturei com a de posição, uma variável por vez. */}

      {/* ═══ A COMPARAÇÃO, AGORA LEGÍVEL (Luis, 2026-08-25: «não tá nada intuitivo pra ninguém»)
          Três defeitos consertados de uma vez:
          1) AS LINHAS ERAM NOMES DE RECURSO ("Turns calls into marketing data"). Ninguém acorda
             querendo "dado de marketing" — o dono pensa em PERGUNTA: "atende domingo às 21h?".
             Pergunta se responde sozinha; nome de recurso precisa ser traduzido na cabeça dele.
          2) OS SINAIS ERAM EMOJI (✅⚠️❌), que mudam de desenho por sistema e não aceitam cor.
             Agora são glifos vetoriais em disco: verde=faz · âmbar=em parte · cinza=não faz.
          3) A COLUNA DA GUILEO NÃO GANHAVA. Agora ela tem fundo próprio, borda lateral verde e
             fica grudada no topo ao rolar — o olho não perde qual coluna é a nossa.
          As células viram "sim|nota", "parte|nota", "nao|nota" ou "txt|valor" — o código decide o
          desenho, a nota (opcional) explica a exceção sem virar outra linha. ═══════════════════ */}
      <section className="wrap py-20">
        <SectionHead eyebrow={t.more.comp.eyebrow} h2={t.more.comp.h2} sub={t.more.comp.sub} className="mb-6" subMax="max-w-2xl" />

        {/* a legenda vem ANTES e usa os MESMOS discos da tabela — legenda que não parece com o
            que explica obriga o leitor a fazer a tradução duas vezes */}
        <div className="mb-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 text-[12px] font-semibold">
          {[["sim", lang === "pt" ? "faz" : lang === "es" ? "lo hace" : lang === "hi" ? "करता है" : "does it"],
            ["parte", lang === "pt" ? "em parte" : lang === "es" ? "en parte" : lang === "hi" ? "आंशिक" : "partly"],
            ["nao", lang === "pt" ? "não faz" : lang === "es" ? "no lo hace" : lang === "hi" ? "नहीं करता" : "doesn't"]].map(([k, rot]) => (
            <span key={k} className="inline-flex items-center gap-2 text-g-ink">
              <CompMarca k={k} /><span>{rot}</span>
            </span>
          ))}
        </div>

        <Reveal>
          {/* a moldura herda o vidro global (index.css) — sem sombra própria, senão a tabela
              vira a única superfície da página com outra profundidade */}
          <div className="overflow-x-auto rounded-xl3 border border-white/10 bg-white/[0.035] backdrop-blur-sm">
            <table className="w-full min-w-full text-sm md:min-w-[720px]">
              <thead>
                <tr>
                  {t.more.comp.cols.map((c, i) => (
                    <th key={i} scope="col"
                      className={`sticky top-0 z-10 p-4 text-[13px] font-black backdrop-blur-md ${i === 0 ? "text-left text-g-muted" : "text-center"} ${i === 1 ? "text-g-word" : "text-g-muted"}`}
                      style={i === 1
                        ? { background: "rgba(62,148,104,0.16)", boxShadow: "inset 1px 0 0 rgba(62,148,104,0.45), inset -1px 0 0 rgba(62,148,104,0.45), inset 0 -1px 0 rgba(62,148,104,0.5)" }
                        : { background: "rgba(22,21,18,0.85)", boxShadow: "inset 0 -1px 0 rgba(255,255,255,0.08)" }}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.more.comp.rows.map((r, i) => (
                  <tr key={i} className="border-t border-white/[0.06] transition-colors duration-200 hover:bg-white/[0.035]">
                    {r.map((cell, j) => {
                      const [cod, nota] = String(cell).split("|");
                      const guileo = j === 1;
                      if (j === 0) return <th key={j} scope="row" className="p-4 text-left text-[13.5px] font-semibold text-g-word">{cell}</th>;
                      return (
                        <td key={j} className="p-4 text-center align-middle"
                          style={guileo ? { background: "rgba(62,148,104,0.07)", boxShadow: "inset 1px 0 0 rgba(62,148,104,0.3), inset -1px 0 0 rgba(62,148,104,0.3)" } : undefined}>
                          {cod === "txt" ? (
                            <span className={`text-[13px] font-bold ${guileo ? "text-g-light" : "text-g-muted"}`}>{nota}</span>
                          ) : (
                            <span className="inline-flex flex-col items-center gap-1">
                              <CompMarca k={cod} forte={guileo} />
                              {nota && <span className="text-[10.5px] leading-tight text-g-muted">{nota}</span>}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
        <div className="text-center mt-8"><Magnetic><SilverCta>{t.more.comp.cta}</SilverCta></Magnetic></div>
      </section>

      {/* CTA + LEAD CAPTURE (capture the lead while intent is hot) */}
      <section id="contact" className="wrap py-20 scroll-mt-24">
        <div className="rounded-xl3 bg-white/[0.03] backdrop-blur-xl border border-white/10 p-8 sm:p-12 shadow-lift relative overflow-hidden">
          <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-g-green/15 blur-3xl animate-aurora pointer-events-none" />
          <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-g-gold/15 blur-3xl animate-aurora pointer-events-none" style={{ animationDelay: "-6s" }} />
          <div className="relative max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{t.more.lead.title}</div>
              <h2 className="mt-4 font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)" }}>
                <span className="bg-gradient-to-r from-g-word via-g-gold to-g-word bg-[length:220%_auto] bg-clip-text text-transparent animate-shimmer">{t.final.h2}</span>
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-g-ink max-w-xl mx-auto">{t.more.lead.sub}</p>
            </div>
            <div className="mt-7"><LeadForm source="final-cta" /></div>
            <div className="mt-6 flex items-center gap-3 text-xs text-g-muted">
              <div className="h-px flex-1 bg-g-line" />{t.final.sub}<div className="h-px flex-1 bg-g-line" />
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <a href={waLink(t.more.lead.wamsg)} target="_blank" rel="noopener" className="btn-ghost text-sm">{t.final.wa}</a>
              <a href={bookLink()} target="_blank" rel="noopener" className="btn-ghost text-sm">{t.final.demo}</a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ — last, right before the closing manifesto */}
      <section id="faq" className="wrap pb-20">
        <SectionHead eyebrow={t.faq.eyebrow} h2={t.faq.h2} className="mb-8" />
        <Accordion items={t.faq.items} />
        <div className="mt-8 text-center">
          <a href="#try" onClick={(e)=>{ e.preventDefault(); document.getElementById("try")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
            className="btn-bright inline-flex"><span className="relative flex h-2 w-2 mr-1"><span className="absolute inline-flex h-full w-full rounded-full bg-black/40 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-black/60" /></span>📞 {lang === "pt" ? "Ainda tem dúvidas? Deixe a Gui te ligar" : lang === "es" ? "¿Aún tienes dudas? Deja que Gui te llame" : lang === "hi" ? "अब भी सवाल हैं? Gui से कॉल करवाएँ" : "Still have questions? Let Gui call you"}</a>
        </div>
      </section>

      {/* MANIFESTO — the closing line that sells the dream */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-g-gold/[0.04] to-transparent pointer-events-none" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-72 w-72 rounded-full bg-g-green/10 blur-3xl pointer-events-none animate-breathe" />
        <Reveal variant="scale" className="relative wrap text-center max-w-3xl mx-auto">
          <span className="text-5xl text-g-gold/40 leading-none">“</span>
          <p className="mt-1 text-2xl sm:text-4xl font-black leading-tight tracking-tight bg-gradient-to-r from-g-word via-g-gold to-g-word bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">
            {t.manifesto.quote}
          </p>
          <p className="mt-5 text-sm sm:text-base font-bold text-g-light">{t.manifesto.tag}</p>
          <div className="mt-6 mx-auto h-px w-24 bg-gradient-to-r from-transparent via-g-gold/60 to-transparent" />
          <div className="mt-3 text-xs font-bold uppercase tracking-[0.3em] text-g-muted">Guileo</div>
        </Reveal>
      </section>

      <Footer />
      {/* spacer so the mobile sticky CTA never covers the footer's last line (safe-area) */}
      <div aria-hidden className="h-20 sm:hidden" />
      <VoiceAgent />
      <ExitIntent />
      <StickyCtaMobile />
    </div>
  );
}
