import { PRODUCTS } from "../data/productSystem.js";
import { useLang } from "../i18n.jsx";

// A LISTRA DOS SERVIÇOS — 2026-08-17, a pedido do Luis.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// O PROBLEMA QUE ELA RESOLVE
// «tem que estar claro que desenvolvemos sites, apps, softwares, e fazemos os anúncios,
//  automações etc — tipo aquela listra que passava antes.»
// Ele estava certo, e o mais irônico: o site JÁ dizia tudo isso. `PillarsProducts` traz "sites,
// apps, loja e software" em quatro idiomas. Só que mora depois de duas seções inteiras — e quem
// chega pelo anúncio decide o que a gente é na PRIMEIRA tela. Conteúdo correto abaixo da dobra é,
// para efeito de venda, conteúdo que não existe.
//
// POR QUE UMA LISTRA E NÃO MAIS UM BLOCO
// Amplitude de catálogo é a única coisa que uma lista longa comunica melhor que um parágrafo — e
// uma lista longa PARADA vira uma parede de texto que ninguém lê. Em movimento, ela se lê como
// "tem mais coisa do que cabe na tela", que é exatamente a impressão verdadeira: são 17 serviços.
// Custa uma faixa de ~44px logo abaixo do herói, sem empurrar nada para baixo.
//
// ⚠️ A FONTE É `productSystem.js`, NUNCA UMA LISTA ESCRITA AQUI. Foi assim que a landing já
// prometeu serviço que não existia e, na correção, APAGOU serviço que existia (o episódio dos
// três — social, SEO, CRM/e-mail — está contado dentro do productSystem). Enquanto esta faixa ler
// do catálogo, ela não pode divergir: produto novo entra sozinho, produto que sai some sozinho.
//
// A COR NÃO É ENFEITE: cada item herda o `accent` do seu pilar, então a listra ensina a leitura
// Brain · AD · Build por repetição, sem legenda, antes mesmo de a pessoa chegar na seção que
// explica os três. É o mesmo alfabeto de cor que o resto da página usa.

// Os MESMOS accents de productSystem.js / PillarsProducts / HeroV2.
const COR = { brain: "#FF8A33", ad: "#4C9AFF", build: "#9AA0FF" };

const PILAR_LABEL = {
  brain: { en: "Brain", pt: "Brain", es: "Brain", hi: "Brain" },
  ad: { en: "AD", pt: "AD", es: "AD", hi: "AD" },
  build: { en: "Build", pt: "Build", es: "Build", hi: "Build" },
};

// O que cada pilar é dono — as mesmas palavras que viviam no herói, que agora moram aqui.
const OWNS = {
  brain: { en: "performance", pt: "performance", es: "rendimiento", hi: "परफ़ॉर्मेंस" },
  ad:    { en: "growth",      pt: "crescimento", es: "crecimiento", hi: "ग्रोथ" },
  build: { en: "foundation",  pt: "fundação",    es: "base",        hi: "नींव" },
};

const INTRO = {
  en: "Everything we build and run for you",
  pt: "Tudo o que a gente constrói e opera pra você",
  es: "Todo lo que construimos y operamos para ti",
  hi: "वह सब जो हम आपके लिए बनाते और चलाते हैं",
};

export default function ServicesMarquee() {
  const { lang } = useLang();
  const L = ["en", "pt", "es", "hi"].includes(lang) ? lang : "en";

  // Ordem Brain → AD → Build: é a mesma sequência do resto da página (o funcionário que atende,
  // o marketing que traz, a base onde tudo roda). Listra fora de ordem obrigaria a pessoa a
  // remontar o modelo mental duas vezes.
  const ordem = { brain: 0, ad: 1, build: 2 };
  const itens = [...PRODUCTS].sort((a, b) => (ordem[a.pilar] ?? 9) - (ordem[b.pilar] ?? 9));

  // A faixa é duplicada e a animação anda -50%: no fim do primeiro conjunto o segundo está
  // exatamente onde o primeiro começou, então o laço é invisível. `aria-hidden` na cópia para o
  // leitor de tela não anunciar 17 serviços duas vezes.
  // ⚠️ O RÓTULO DO PILAR SÓ APARECE QUANDO O PILAR MUDA (corrigido na primeira olhada em tela).
  // Na versão anterior cada item carregava o seu — "Speed-to-Lead 60s BRAIN · No-show Shield BRAIN
  // · Reactivation BRAIN" — e a palavra repetida sete vezes seguidas virava o elemento mais forte
  // da faixa, competindo com o nome do serviço, que é o que interessa. Repetido, um rótulo deixa de
  // classificar e vira ruído; usado como CABEÇALHO DE GRUPO, ele volta a ensinar a divisão
  // Brain · AD · Build enquanto a faixa passa, de graça, sem legenda nenhuma.
  const Faixa = ({ copia = false }) => (
    <div className="flex shrink-0 items-center gap-6 pr-6" aria-hidden={copia || undefined}>
      {itens.map((p, i) => {
        // O cabeçalho de grupo que rolava aqui SAIU (2026-08-17): o trio agora é fixo à esquerda,
        // e repetir "BRAIN / AD / BUILD" passando de novo seria a mesma palavra duas vezes na
        // mesma faixa. A cor de cada item continua ensinando a que pilar ele pertence — o sinal
        // que ficou é o que não compete com nada.
        return (
          <span key={`${copia ? "b" : "a"}-${p.id}`} className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <span className="text-[14px] leading-none">{p.icon}</span>
            <span className="text-[13px] font-semibold tracking-tight text-g-ink">{p.name?.[L] || p.name?.en}</span>
            <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: p.accent, opacity: 0.85 }} />
          </span>
        );
      })}
    </div>
  );

  return (
    <section className="relative overflow-hidden border-y border-g-gold/10 bg-white/[0.02] py-3">
      <style>{`
        @keyframes gsvcs{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .gsvcs-track{animation:gsvcs 34s linear infinite;will-change:transform}
        /* Parar no hover é acessibilidade, não charme: em movimento contínuo não dá pra LER um
           item específico, e quem parou o mouse ali é justamente quem quis ler. */
        .gsvcs-wrap:hover .gsvcs-track{animation-play-state:paused}
        @media (prefers-reduced-motion: reduce){
          .gsvcs-track{animation:none;transform:none}
        }
      `}</style>

      {/* Rótulo fixo à esquerda: sem ele a faixa parece um carrossel de logos de parceiro. Uma
          frase curta transforma a mesma lista em "isto é o nosso catálogo". Some no celular,
          onde rouba metade da largura da própria listra. */}
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 sm:flex-row sm:items-center sm:gap-5">
        {/* ── O TRIO VIROU O RÓTULO DA LISTRA (2026-08-17, Luis) ─────────────────────────────
            Ele estava no herói, solto acima do botão; aqui vira a LEGENDA da faixa — e a faixa
            está agrupada por pilar, então os dois se explicam sem uma linha de texto extra.
            Trocou "Everything we build and run for you", que era uma frase bonita dizendo o
            óbvio; o trio diz a mesma coisa e ainda ensina os três nomes que a gente quer vender.
            ⚠️ Em telas pequenas ele NÃO some (era `hidden sm:block` antes): vira uma linha
            própria acima da faixa. Depois de sair do herói, esta é a única aparição de
            Brain·AD·Build antes da seção dos pilares — escondê-la no celular apagaria o alfabeto
            justamente onde o dono de negócio local navega. */}
        <span className="flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px]">
          {["brain", "ad", "build"].map((k, i) => (
            <span key={k} className="flex items-center gap-2.5 whitespace-nowrap">
              {i > 0 && <span className="text-g-muted/60">→</span>}
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: COR[k], boxShadow: `0 0 8px ${COR[k]}` }} />
                <b className="font-black uppercase tracking-[0.12em]" style={{ color: COR[k] }}>{PILAR_LABEL[k]?.[L] || k}</b>
                <span className="text-[11px] font-medium text-g-ink/75">{OWNS[k]?.[L] || OWNS[k]?.en}</span>
              </span>
            </span>
          ))}
        </span>
        <div className="gsvcs-wrap relative min-w-0 flex-1 overflow-hidden">
          {/* Máscara nas duas pontas — sem ela o texto nasce e morre com corte seco na borda, que
              é o detalhe que faz uma listra parecer amadora. */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-g-deep to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-g-deep to-transparent" />
          <div className="gsvcs-track flex w-max items-center">
            <Faixa />
            <Faixa copia />
          </div>
        </div>
      </div>
    </section>
  );
}
