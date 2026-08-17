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

// ⚠️ ESTA CONSTANTE ESTAVA COM A PALETA VELHA (laranja/azul/violeta) — sobra de quando o trio
// morava aqui e foi apagado. Constante órfã com valor errado é pior que constante ausente: ela
// não quebra nada, só desenha a cor de ontem, e ninguém procura defeito no que "já foi trocado".
// Agora são os MESMOS três dos cards, incluindo o cobre escurecido por medição (distância 124 do
// champanhe do AD, contra os 47 que os deixavam indistinguíveis lado a lado).
// ⚠️ APAGADO COMO ÓRFÃO E PRECISOU VOLTAR — 3ª vez hoje que este ciclo me pega (o PILAR_COR do
// herói derrubou a produção do mesmo jeito). A lição não é "não limpe órfão": é que remover e
// re-adicionar são a MESMA operação vista de dois lados, e o build passa nas duas — só a página
// aberta reclama. Por isso este arquivo agora declara o rótulo ANTES de qualquer uso, no topo,
// longe de bloco removível.
const PILAR_LABEL = {
  brain: { en: "Brain", pt: "Brain", es: "Brain", hi: "Brain" },
  ad:    { en: "AD",    pt: "AD",    es: "AD",    hi: "AD" },
  build: { en: "Build", pt: "Build", es: "Build", hi: "Build" },
};

const COR = { brain: "#3E9468", ad: "#D6C29A", build: "#BE7F35" };


// O que cada pilar é dono — as mesmas palavras que viviam no herói, que agora moram aqui.



// ── O RÓTULO VOLTOU, MAS COM A CONTAGEM (Luis, 2026-08-17: "essa parte tá faltando… ou algo assim")
// A faixa ficou sem rótulo quando a frase "tudo o que a gente constrói e opera pra você" subiu pro
// herói. Sem nada à esquerda ela lê como carrossel de logo de parceiro — o olho não sabe que aquilo
// é o CATÁLOGO.
// ⚠️ Mas repetir a mesma frase nos dois lugares seria o pecado que passei o dia consertando neste
// arquivo e no herói: repetição na dobra de cima não soa a ênfase, soa a quem só tem uma coisa pra
// dizer. Então o rótulo daqui carrega o NÚMERO — que o herói não diz e que é o argumento mais forte
// que esta faixa tem: são 16 serviços, não três. O número vem do próprio catálogo, então ele nunca
// mente sobre o tamanho da lista que está passando ao lado.
const ROTULO = {
  en: (n) => `${n} services`,
  pt: (n) => `${n} serviços`,
  es: (n) => `${n} servicios`,
  hi: (n) => `${n} सेवाएँ`,
};
// ── O TRIO VOLTOU, JUNTO COM A CONTAGEM (Luis, 2026-08-17) ────────────────────────────────────
// Ele viveu no herói, virou rótulo desta faixa, foi apagado por decisão do Luis, e volta agora —
// no mesmo lugar, ao lado do número. Registro a ida e a volta porque isso é informação: quem
// mexer nisto depois precisa saber que a linha já foi movida três vezes, e que o motivo de ela
// existir é ser o ÚNICO ponto da primeira tela onde as três cores aparecem juntas. É assim que a
// pessoa aprende o alfabeto Brain·AD·Build antes de chegar na seção que o explica.
// Só o NOME entra aqui, sem o "performance/growth/foundation" que a versão do herói tinha: ao lado
// de uma lista de 16 serviços passando, três palavras a mais viram ruído — e a seção dos pilares,
// logo abaixo, já diz o que cada um é dono com espaço para isso.
const PILARES_TRIO = ["brain", "ad", "build"];

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
        /* ⚠️ SEM will-change, DE PROPOSITO (2026-08-17). Ele promove a faixa a uma camada grafica
           PERMANENTE — e esta faixa anima pra sempre, inclusive fora da tela. will-change serve pra
           avisar o navegador de uma mudanca que VEM, nao pra ficar ligado eternamente: numa pagina
           de 42.900px com varias faixas animadas, cada camada dessas custa memoria de GPU e ajuda a
           deixar a rolagem pesada. A animacao e de transform, que o compositor ja acelera sozinho.
           ⚠️ ESTE BLOCO VIVE DENTRO DE UM TEMPLATE LITERAL: nenhum acento grave pode entrar aqui,
           nem dentro de comentario — eu quebrei o build DUAS vezes seguidas escrevendo o nome da
           propriedade entre acentos graves. Aspas simples, se precisar citar algo. */
        .gsvcs-track{animation:gsvcs 34s linear infinite}
        /* Parar no hover é acessibilidade, não charme: em movimento contínuo não dá pra LER um
           item específico, e quem parou o mouse ali é justamente quem quis ler. */
        .gsvcs-wrap:hover .gsvcs-track{animation-play-state:paused}
        @media (prefers-reduced-motion: reduce){
          .gsvcs-track{animation:none;transform:none}
        }
      `}</style>

      {/* ── SEM RÓTULO, DE PROPÓSITO (2026-08-17) ────────────────────────────────────────────
          Aqui já moraram duas coisas: a frase "tudo o que a gente constrói e opera pra você" e,
          por vinte minutos, o trio Brain·AD·Build. As duas saíram por decisão do Luis — a frase
          subiu para o herói, logo abaixo do título, e o trio foi apagado do herói e daqui.
          A faixa ficou só com os serviços, e ganhou: sem rótulo fixo ela usa a largura inteira,
          então cabem mais nomes por passada — e o nome do serviço é o argumento; o rótulo era
          moldura. */}
      <div className="mx-auto flex max-w-6xl flex-col gap-1.5 px-5 sm:flex-row sm:items-center sm:gap-5">
        {/* Em telas pequenas vira linha própria em vez de sumir: era `hidden sm:block` antes, e
            esconder o rótulo no celular deixava a faixa sem identidade justamente onde o dono de
            negócio local navega. */}
        <span className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] font-black uppercase tracking-[0.16em]">
          {PILARES_TRIO.map((k, i) => (
            <span key={k} className="flex items-center gap-1.5 whitespace-nowrap">
              {i > 0 && <span className="text-g-muted/50">·</span>}
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: COR[k], boxShadow: `0 0 8px ${COR[k]}` }} />
              <span style={{ color: COR[k] }}>{PILAR_LABEL[k]?.[L] || k}</span>
            </span>
          ))}
          <span className="text-g-muted/50">—</span>
          <span className="whitespace-nowrap text-g-gold/80">{(ROTULO[L] || ROTULO.en)(itens.length)}</span>
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
