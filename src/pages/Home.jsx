import { useEffect, lazy, Suspense } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Intro from "../components/Intro.jsx";
import LeadForm from "../components/LeadForm.jsx";
import { Reveal, Magnetic, Accordion } from "../lib/ui.jsx";
import HeroOS, { abrirGui, copyTelefone } from "../components/HeroOS.jsx"; // 2026-09-09: o hero "AI Company OS" + agente ElevenLabs (voz+texto)
import ResultsV2 from "../components/ResultsV2";
import PillarsProducts from "../components/PillarsProducts.jsx";
import EngineV2 from "../components/EngineV2.jsx";
import CompanyOS from "../components/CompanyOS.jsx"; // 2026-09-10: os 8 departamentos que o eyebrow promete
import CockpitShots from "../components/CockpitShots.jsx"; // 2026-09-10: telas reais do cockpit
import XRaySection from "../components/XRaySection.jsx"; // 2026-09-10: o Raio-X de volta — a porta da venda // 2026-09-09 (noite): o Luis pediu de volta a animação do "rio de conversas"; título virou "data is the fuel"
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
  const tel = copyTelefone(lang); // promessa de ligação atrás de UMA chave (TELEFONE_NO_AR, HeroOS.jsx)
  useSeo({
    // O SEO falava SÓ da IA — e a Guileo também faz anúncios, marketing, site e software. Quem
    // procurava "agência de marketing" ou "quem faz meu site" no Google nunca nos encontrava, e
    // quem chegava pela IA não descobria o resto. A palavra que não está no título não existe na
    // busca. Auditoria 2026-08-11.
    // HONESTIDADE: "anúncios conduzidos por gente" é o que de fato acontece (o time cria e gere as
    // campanhas — functions/api/google-ads.js diz isso explicitamente). App e software entram como
    // PROJETO sob medida, nunca como item do mensal, porque é isso que são.
    // hi entrou em 2026-09-27: a tela em hindi levava <title> e description em inglês — o resto da
    // página já estava traduzido, só a aba do navegador e o snippet de busca denunciavam.
    title: lang === "pt" ? "Guileo — IA, anúncios e criação para o seu negócio · atende 24/7, e ainda faz seu site" : lang === "es" ? "Guileo — IA, anuncios y creación para tu negocio · atiende 24/7, y hace tu sitio" : lang === "hi" ? "Guileo — आपके बिज़नेस के लिए AI, विज्ञापन और क्रिएटिव · 24/7 जवाब, और आपकी वेबसाइट भी" : "Guileo — AI, ads & creative for your business · answers 24/7, and builds your site",
    description: lang === "hi" ? "एक ही घर: AI कॉल और मैसेज का जवाब देती है, बुकिंग और बिक्री करती है — 24/7, 16 भाषाओं में — और टीम आपके विज्ञापन, मार्केटिंग और कंटेंट चलाती है, और वेबसाइट, ऐप और कस्टम सॉफ़्टवेयर बनाती है। 7 दिनों में लाइव। $149/माह से, 30-दिन मनी-बैक।" : lang === "pt" ? "Uma casa só: a IA atende ligações e mensagens, agenda e vende 24/7 em 16 idiomas — e o time conduz seus anúncios, marketing e conteúdo, e constrói site, app e software sob medida. No ar em até 7 dias. A partir de $149/mês, 30 dias de garantia." : lang === "es" ? "Una sola casa: la IA atiende llamadas y mensajes, agenda y vende 24/7 en 16 idiomas — y el equipo conduce tus anuncios, marketing y contenido, y construye sitio, app y software a medida. En marcha en 7 días. Desde $149/mes, 30 días de garantía." : "One house: the AI answers calls and messages, books and sells 24/7 in 16 languages — and the team runs your ads, marketing and content, and builds your site, app and custom software. Live in 7 days. From $149/mo, 30-day money-back.",
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
    // O index.html já traz um FAQPage estático (para robô que não roda JavaScript). Dois FAQPage
    // na mesma página é erro de dado estruturado no Search Console — e o estático tem 5 perguntas
    // em inglês, enquanto a tela mostra 10 no idioma do visitante. O daqui espelha o que está
    // VISÍVEL, então ele substitui o estático em vez de somar.
    document.getElementById("faq-jsonld-estatico")?.remove();
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
    // "/#gui" — é para onde o "Começar" do menu manda quem está numa página SEM o widget
    // (/privacy, /servicos, /planos…). Chegando aqui, a conversa abre sozinha assim que o widget
    // monta os botões dele. Sem rolagem: o widget é fixo no canto, não há para onde rolar.
    if (id === "gui") {
      let n = 0;
      const espera = setInterval(() => {
        const pronto = document.querySelector("elevenlabs-convai")?.shadowRoot?.querySelector("button");
        if (pronto) { clearInterval(espera); abrirGui("texto"); }
        else if (++n > 40) clearInterval(espera); // 10s — script de terceiro pode não carregar; a página segue de pé
      }, 250);
      return () => clearInterval(espera);
    }
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
    <div className="tex-vivo min-h-screen text-g-ink">
      <Intro />
      <Navbar />

      {/* ── Tightened single-buyer funnel: Hook → Problem/Result → Solution → How → Proof → Demo → Offer → Close ── */}
      <HeroOS />              {/* 2026-09-09 — "Stop running your business. Start leading it." + agente ElevenLabs no canto */}
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
      {/* LegsV2 (as 3 pernas) SAIU — Luis, 2026-09-09: "tirar a 6" */}

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
      {/* ServicesGrid SAIU (2026-09-10): os 18 serviços moram dentro dos 3 pilares (PillarsProducts) */}

      <PillarsProducts />
      <CompanyOS />
      <CockpitShots />    {/* The WHAT — each pillar's REAL products → result → value (replaces WholePicture + old ProductResults; aligns landing to the platform) */}
      <ChannelsStrip />      {/* Reach — a slim logo strip (folded from the old full ChannelsV2 phone section) */}

      {/* ⛔ "VEJA NA SUA MARCA" SAIU (Luis, 2026-08-25: «apagar isso aqui») ──────────────────
          Era o campo "digite seu site ou @" que montava uma prévia na marca do visitante
          (<DemoEngine surface="public" />). Saiu da landing; o motor continua vivo e é o mesmo
          que serve /vitrine/:token e o vendedor — só perdeu a vitrine pública.
          ↩️ Para voltar: reimportar o lazy DemoEngine e devolver a <section id="veja"> aqui. */}

      <MethodV2 />
      <XRaySection />           {/* How you start — live in under 7 days, human-led */}
      {/* ProofV2 (selos) desceu pra antes do rodapé — Luis, 2026-09-09: "volta a versão 4K e deixa lá embaixo" */}
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
      {/* ÂNCORA #try — a seção LiveCall saiu em 2026-09-09 e levou o id junto, mas o endereço
          continuou sendo usado: /demo, /demonstracao e /demostracion (public/_redirects), o botão da
          página 404, /servicos, os posts do blog e /heroi apontam todos para "/#try". O link abria
          a home no topo, sem dizer nada. A âncora volta aqui, no convite "ouça a Gui trabalhar" —
          que é o que sobrou da demo. Elemento vazio: não muda um pixel da página. */}
      <span id="try" aria-hidden="true" className="block scroll-mt-24" />
      <Reveal variant="scale" className="relative wrap py-12 text-center">
        <div className="mx-auto h-px w-40 bg-gradient-to-r from-transparent via-g-gold/55 to-transparent" />
        <p className="mt-6 mx-auto max-w-2xl font-black leading-[1.05] tracking-tight" style={{ fontSize: "clamp(1.5rem,3.4vw,2.4rem)" }}>
          <span className="text-g-word">{lang === "pt" ? "Agora pare de ler. " : lang === "es" ? "Ahora deja de leer. " : lang === "hi" ? "अब पढ़ना बंद करें। " : "Now stop reading. "}</span>
          <span style={{ color: "#FF8A33", textShadow: "0 0 30px rgba(255,138,51,0.40)" }}>{lang === "pt" ? "Ouça a Gui trabalhar." : lang === "es" ? "Escucha a Gui trabajar." : lang === "hi" ? "Gui को काम करते सुनें।" : "Hear Gui work."}</span>
        </p>
        <div className="mt-6 mx-auto h-px w-40 bg-gradient-to-r from-transparent via-g-gold/55 to-transparent" />
      </Reveal>

      {/* LiveCall (#try, "Now stop reading. Hear Gui work.") SAIU — Luis, 2026-09-09: "tirar". O "fale com a Gui" é o widget do hero. */}

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
      {/* Comparação (Guileo vs agência vs contratar) SAIU — Luis, 2026-09-09: a objeção vai pro widget e pra FAQ. */}

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
          <a href="#gui" onClick={(e) => { e.preventDefault(); abrirGui("texto"); }}
            className="btn-bright inline-flex"><span className="relative flex h-2 w-2 mr-1"><span className="absolute inline-flex h-full w-full rounded-full bg-black/40 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-black/60" /></span>{/* O botão dizia "Deixe a Gui te ligar" e abria o CHAT — e com o telefone fora do ar a ligação nem existe. O texto agora sai de copyTelefone(): vira "te ligar" de novo quando TELEFONE_NO_AR for true. */}<span aria-hidden="true">{tel.icone}</span> {tel.duvida}</a>
        </div>
      </section>

      {/* MANIFESTO — the closing line that sells the dream */}
      {/* Manifesto (a citação) SAIU — 7ª repetição da promessa. No lugar, os SELOS em 4K, o fecho de confiança antes do rodapé. */}
      <ProofV2 />

      <Footer />
      {/* spacer so the mobile sticky CTA never covers the footer's last line (safe-area) */}
      <div aria-hidden className="h-20 sm:hidden" />
      {/* VoiceAgent SAIU — substituído pelo widget da ElevenLabs montado pelo HeroOS (dois balões no canto é erro) */}
      {/* ExitIntent SAIU — pop-up de saída brigava com o widget da Gui */}
      {/* StickyCtaMobile SAIU (2026-09-09): no celular ela e o balão da Gui disputavam o rodapé — o balão é o CTA */}
    </div>
  );
}
