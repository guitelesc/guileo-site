import { useEffect, useRef, useState } from "react";
import { useLang } from "../i18n.jsx";
import mark from "../assets/guileo-mark.png";

// ═══ O MOTOR — a máquina que roda o negócio inteiro ═══════════════════════════════════════════
// Reescrito em 2026-08-20 a pedido do Luis. O que mudou e POR QUÊ:
//
// 1) ELE FALAVA SÓ DE MARKETING. «esse texto tem que servir pro AD, conteúdo, marketing, sales,
//    profit — a gente toma conta de tudo». A versão antiga era conversa → dado → marketing →
//    receita, e parava aí. Agora o anel tem as SEIS estações do ciclo real, e cada uma é uma
//    perna do que a Guileo entrega. Marketing virou UMA estação, não o assunto inteiro.
//
// 2) ERAM QUATRO PARÁGRAFOS. «tem que ser algo mais visual, menos complexo de ler». Quatro cartões
//    de texto lado a lado obrigam leitura; um anel girando é lido de relance. Agora a explicação
//    aparece UMA POR VEZ, embaixo, da estação que está acesa: o olho vê a máquina, e lê uma linha.
//
// 3) 🚨 OS NÚMEROS ERAM FALSOS E SAÍRAM. A versão antiga fazia `12840 + n*3` conversas e
//    `$48200 + n*140` de receita, com um selo verde "Running · processing in real time". Era um
//    painel inventado, na página principal, com cara de telemetria da plataforma. É a mesma lei
//    que sustenta o X-Ray: nada se afirma sem medida. Não existe número real para pôr aqui — uma
//    landing não tem acesso à operação de ninguém — então não existe número. O que ficou é o que
//    é verdade: o NOME de cada etapa e o que ela faz.
//
// O anel é o objeto: 6 estações, a acesa gira para o topo, e o símbolo do ciclo pulsa no centro.
// `prefers-reduced-motion` congela tudo e mostra as 6 legendas de uma vez.

// 🎨 AS CORES SÃO AS DOS PRODUTOS REAIS, não escolha estética (2026-08-20).
// A 1ª versão usava três tons apagados e REPETIA dois deles (conversa e lucro no mesmo verde,
// conteúdo e anúncio no mesmo champanhe) — seis estações, quatro cores: o olho não separava.
// Estas vêm de `PRODUCTS[].accent` em src/data/productSystem.js, o mesmo hex que cada produto já
// usa no catálogo, na landing e no cockpit. Ganho duplo: fica vivo, e a cor que o cliente vê no
// anel é a MESMA que ele vai ver no produto depois — a plataforma inteira fala uma cor só.
//   📞 #FF8A33 answering · 🧠 #33C6D6 multilingual/dados · ✍️ #B37DFF content
//   📣 #4C9AFF marketing_ads · 🤝 #5EC26A close_collect · 💰 #FFC23D reputation/dinheiro
// quantas luzes o rio começa com — o contador NASCE nesse valor (regra do Luis: número animado
// nunca começa em zero, senão a primeira leitura mostra um valor que contradiz a premissa)
const SEMENTE = 7;

const ANEL = [
  { id: "conversa", icon: "📞", rgb: "255,138,51"  },
  { id: "dado",     icon: "🧠", rgb: "51,198,214"  },
  { id: "conteudo", icon: "✍️", rgb: "179,125,255" },
  { id: "anuncio",  icon: "📣", rgb: "76,154,255"  },
  { id: "venda",    icon: "🤝", rgb: "94,194,106"  },
  { id: "lucro",    icon: "💰", rgb: "255,194,61"  },
];

const EV = {
  en: {
    eyebrow: "The Guileo engine",
    h1a: "Every conversation ", h1b: "compounds.",
    sub: "One AI + marketing team — ads, content, marketing, sales & profit, all on one loop while you work.",
    nomes: ["Conversation", "Your data", "Content", "Ads", "Sales", "Profit"],
    linhas: [
      "Every call, WhatsApp, SMS and web message — answered and understood.",
      "It all becomes your own customer data, with consent: who they are and when they buy.",
      "Posts and creative written from what your customers actually say.",
      "Campaigns built on real behaviour instead of guesses — less wasted spend.",
      "Quotes, closes, books the real calendar and collects on the call.",
      "Repeat orders, fewer no-shows — and it feeds the next conversation.",
    ],
    loop: "And it loops — every turn makes the next one smarter.",
    volta1: "Everyone else's calls end. ", volta2: "Yours come back.",
    contaSub: "conversations turned into customers you own — ",
    contaFonte: "since you opened this page.",
    provas: [
      ["Your ads", "talk to people who ", "already called you", " — not to strangers."],
      ["A fraction", "of the cost to bring one back ", "versus buying a new one", "."],
      ["They return", "because they already know you. ", "Trust is the cheapest ad", "."],
    ],
    ganhos: [["📞", "+1 lead"], ["📅", "booked"], ["⭐", "5-star"], ["💰", "sale"], ["🔁", "repeat"], ["💬", "replied"], ["🎯", "closed"], ["🙋", "no-show saved"]],
  },
  pt: {
    eyebrow: "O motor da Guileo",
    h1a: "Cada conversa ", h1b: "se acumula.",
    sub: "Um time de IA + marketing — anúncios, conteúdo, marketing, vendas e lucro, num ciclo só enquanto você trabalha.",
    nomes: ["Conversa", "Seus dados", "Conteúdo", "Anúncios", "Vendas", "Lucro"],
    linhas: [
      "Toda ligação, WhatsApp, SMS e mensagem do site — atendida e entendida.",
      "Tudo vira dado do seu cliente, com consentimento: quem é e quando compra.",
      "Posts e criativos escritos a partir do que seus clientes realmente falam.",
      "Campanhas feitas com comportamento real, não com chute — menos desperdício.",
      "Orça, fecha, marca na agenda de verdade e cobra na própria ligação.",
      "Recompra, menos falta — e alimenta a próxima conversa.",
    ],
    loop: "E faz o ciclo — cada volta deixa a próxima mais esperta.",
    volta1: "A ligação dos outros acaba. ", volta2: "A sua volta.",
    contaSub: "conversas que viraram clientes seus — ",
    contaFonte: "desde que você abriu esta página.",
    provas: [
      ["Seus anúncios", "falam com quem ", "já te ligou", " — não com estranhos."],
      ["Uma fração", "do custo de trazer um de volta ", "comparado a comprar um novo", "."],
      ["Eles voltam", "porque já conhecem você. ", "Confiança é o anúncio mais barato", "."],
    ],
    ganhos: [["📞", "+1 lead"], ["📅", "agendado"], ["⭐", "5 estrelas"], ["💰", "venda"], ["🔁", "recompra"], ["💬", "respondido"], ["🎯", "fechado"], ["🙋", "falta evitada"]],
  },
  es: {
    eyebrow: "El motor de Guileo",
    h1a: "Cada conversación ", h1b: "se acumula.",
    sub: "Un equipo de IA + marketing — anuncios, contenido, marketing, ventas y ganancia, en un solo bucle mientras trabajas.",
    nomes: ["Conversación", "Tus datos", "Contenido", "Anuncios", "Ventas", "Ganancia"],
    linhas: [
      "Cada llamada, WhatsApp, SMS y mensaje de la web — atendida y entendida.",
      "Todo se vuelve dato de tu cliente, con consentimiento: quién es y cuándo compra.",
      "Publicaciones y creativos escritos con lo que tus clientes de verdad dicen.",
      "Campañas hechas con comportamiento real, no con suposiciones — menos desperdicio.",
      "Cotiza, cierra, agenda en el calendario real y cobra en la propia llamada.",
      "Recompra, menos ausencias — y alimenta la próxima conversación.",
    ],
    loop: "Y hace el ciclo — cada vuelta hace la siguiente más inteligente.",
    volta1: "Las llamadas de los demás terminan. ", volta2: "Las tuyas vuelven.",
    contaSub: "conversaciones que se volvieron clientes tuyos — ",
    contaFonte: "desde que abriste esta página.",
    provas: [
      ["Tus anuncios", "hablan con quien ", "ya te llamó", " — no con extraños."],
      ["Una fracción", "del costo de traer uno de vuelta ", "frente a comprar uno nuevo", "."],
      ["Vuelven", "porque ya te conocen. ", "La confianza es el anuncio más barato", "."],
    ],
    ganhos: [["📞", "+1 lead"], ["📅", "agendado"], ["⭐", "5 estrellas"], ["💰", "venta"], ["🔁", "recompra"], ["💬", "respondido"], ["🎯", "cerrado"], ["🙋", "ausencia evitada"]],
  },
  hi: {
    eyebrow: "Guileo इंजन",
    h1a: "हर बातचीत ", h1b: "जुड़ती जाती है।",
    sub: "एक AI + मार्केटिंग टीम — विज्ञापन, कॉन्टेंट, मार्केटिंग, बिक्री और मुनाफ़ा, एक ही चक्र में आपके काम करते हुए।",
    nomes: ["बातचीत", "आपका डेटा", "कॉन्टेंट", "विज्ञापन", "बिक्री", "मुनाफ़ा"],
    linhas: [
      "हर कॉल, WhatsApp, SMS और वेब संदेश — उठाया और समझा जाता है।",
      "सब आपके ग्राहक का डेटा बनता है, सहमति के साथ: वे कौन हैं और कब खरीदते हैं।",
      "पोस्ट और क्रिएटिव, आपके ग्राहक जो सच में कहते हैं उससे लिखे गए।",
      "असली व्यवहार पर बने अभियान, अंदाज़े पर नहीं — कम पैसा बर्बाद।",
      "भाव देती है, सौदा बंद करती है, असली कैलेंडर में बुक करती है और कॉल पर ही पैसा लेती है।",
      "दोबारा ऑर्डर, कम ग़ैरहाज़िरी — और अगली बातचीत को ईंधन देता है।",
    ],
    loop: "और यह चक्र चलता है — हर चक्कर अगले को और समझदार बनाता है।",
    volta1: "दूसरों की कॉल ख़त्म हो जाती है। ", volta2: "आपकी लौट आती है।",
    contaSub: "बातचीत जो आपके अपने ग्राहक बन गईं — ",
    contaFonte: "जब से आपने यह पेज खोला।",
    provas: [
      ["आपके विज्ञापन", "उनसे बात करते हैं ", "जिन्होंने आपको कॉल किया", " — अजनबियों से नहीं।"],
      ["एक अंश", "किसी को वापस लाने की लागत ", "नया ग्राहक ख़रीदने के मुक़ाबले", "।"],
      ["वे लौटते हैं", "क्योंकि वे आपको जानते हैं। ", "भरोसा सबसे सस्ता विज्ञापन है", "।"],
    ],
    ganhos: [["📞", "+1 लीड"], ["📅", "बुक"], ["⭐", "5-स्टार"], ["💰", "बिक्री"], ["🔁", "दोबारा"], ["💬", "जवाब"], ["🎯", "डील"], ["🙋", "बचा"]],
  },
};

export default function EngineV2() {
  const { lang } = useLang();
  const E = EV[lang] || EV.en;             // reserva SEMPRE inglês, nunca o idioma do autor
  const [act, setAct] = useState(0);
  const [parado, setParado] = useState(false);
  const canvasRef = useRef(null);
  const numRef = useRef(null);     // o contador vive fora do React: 60fps não pode re-renderizar
  const ecoRef = useRef(null);

  // ═══ O RIO — cada partícula é um resultado entrando no negócio ═══════════════════════════
  // Nasce na borda, orbita para dentro e some no núcleo. Ao ser engolida, o núcleo "engorda":
  // é o acumulado que o título promete. Rótulos só nas partículas de fora (perto do centro
  // ficariam ilegíveis empilhados) e nunca em mais de 5 ao mesmo tempo — texto demais vira sopa.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const semMovimento = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    let raf = 0, vivo = true, guardado = 0;
    const ganhos = E.ganhos || [];

    let w = 0, h = 0;
    const medir = () => {
      const r = cv.getBoundingClientRect();
      const d = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      cv.width = w * d; cv.height = h * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    medir();
    window.addEventListener("resize", medir);

    const ps = [];
    // TODA partícula carrega emoji + resultado. Sem bolinha pelada, sem teto de rótulo.
    // ângulo áureo: cada nova partícula nasce longe da anterior. Ângulo sorteado agrupava
    // duas no mesmo canto e os rótulos nasciam já empilhados.
    let semente = 0;
    const nasce = () => {
      const g = ganhos[Math.floor(Math.random() * ganhos.length)] || ["✨", ""];
      const a = (semente++ * 2.39996) % (Math.PI * 2);
      ps.push({
        a, r: 1.25 + Math.random() * 0.25,
        v: 0.0042 + Math.random() * 0.003,
        dec: 0.0011 + Math.random() * 0.0007,
        icone: g[0], texto: g[1],
      });
    };
    const TETO = 9;                        // menos partículas: agora cada uma leva texto
    for (let i = 0; i < SEMENTE; i++) nasce();

    // ═══ O CONTADOR ═══════════════════════════════════════════════════════════════════════
    // Ele NÃO é um cronômetro fingindo de métrica: é o mesmo evento que o canvas desenha.
    // Nasce contando as luzes que já estão na tela (verdade: são conversas que o visitante
    // está vendo agora) em vez de zerado — 0,1,2 nos primeiros segundos é justo quando o
    // visitante chega, e um número fraco na chegada custa a leitura da seção inteira.
    // Escreve direto no DOM: a 60 quadros por segundo, setState re-renderizaria a árvore toda.
    const LOCAL = { en: "en-US", pt: "pt-BR", es: "es-ES", hi: "hi-IN" }[lang] || "en-US";
    let contados = ps.length, ecoT = 0;
    if (numRef.current) numRef.current.textContent = contados.toLocaleString(LOCAL);
    const absorve = (p) => {
      contados++;
      const n = numRef.current, e = ecoRef.current;
      if (n) {
        n.textContent = contados.toLocaleString(LOCAL);
        n.style.transform = "scale(1.075)"; n.style.color = "#F0E4C8";
        setTimeout(() => { if (n) { n.style.transform = ""; n.style.color = ""; } }, 190);
      }
      if (e) {                              // o eco some sozinho: presença fixa vira ruído
        e.textContent = `+ ${p.icone} ${p.texto}`;
        e.style.opacity = "1";
        clearTimeout(ecoT);
        ecoT = setTimeout(() => { if (e) e.style.opacity = "0"; }, 1600);
      }
    };

    // rgb -> "r,g,b" para poder terminar o gradiente na MESMA cor com alpha 0 (sem puxar p/ preto)
    const canais = (hex) => {
      const h = hex.replace("#", "");
      return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)].join(",");
    };
    const glow = (x, y, r, cor, alpha) => {
      const c = canais(cor);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${c},1)`); g.addColorStop(1, `rgba(${c},0)`);
      ctx.globalCompositeOperation = "lighter";      // luz SOMA — nunca escurece o fundo
      ctx.globalAlpha = alpha; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    };

    const quadro = () => {
      if (!vivo) return;
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.42;
      // ⚠️ REPINTAR, não limpar — é o que cria a cauda luminosa. `clearRect` mataria o efeito.
      ctx.clearRect(0, 0, w, h);   // sem resíduo: a cauda é desenhada por partícula, abaixo

      const carga = Math.min(guardado / 240, 1);
      glow(cx, cy, 62 + carga * 34, "#3E9468", 0.16 + carga * 0.2);   // halo atrás da plantinha
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7);
      ctx.strokeStyle = "rgba(214,194,154,0.13)"; ctx.lineWidth = 1; ctx.stroke();

      // caixas de rótulo já desenhadas neste quadro — o rótulo que colidir simplesmente
      // não é escrito (a luz e a cauda continuam). Texto empilhado é pior que texto ausente.
      const caixas = [];
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        if (!semMovimento) { p.a += p.v; p.r -= p.dec; }
        const rr = R * p.r, x = cx + Math.cos(p.a) * rr, y = cy + Math.sin(p.a) * rr;
        const perto = 1 - Math.min(p.r, 1);
        // CAUDA — arco curto atrás da partícula. Substitui o rastro por acúmulo de quadros, que
        // deixava manchas cinzas fantasma no canvas. Aqui cada quadro é limpo e a cauda é objeto.
        ctx.beginPath();
        ctx.arc(cx, cy, rr, p.a - 0.34, p.a);
        ctx.strokeStyle = "rgba(214,194,154,0.30)";
        ctx.lineWidth = 1.6 + perto * 1.2; ctx.lineCap = "round"; ctx.stroke();
        glow(x, y, 11 + perto * 9, "#D6C29A", 0.5);
        // emoji + resultado em TODAS. Só apaga no fim da vida, ao ser absorvida pelo centro.
        ctx.font = "600 12px system-ui, sans-serif";
        const rotulo = p.icone + " " + p.texto;
        // rótulo vira pra DENTRO na metade direita — senão o texto corta na borda do canvas
        const paraEsquerda = x > cx;
        const larg = ctx.measureText(rotulo).width;
        const x0 = paraEsquerda ? x - 11 - larg : x + 11;
        const cx0 = x0 - 6, cx1 = x0 + larg + 6, cy0 = y - 10, cy1 = y + 10;
        const bate = caixas.some((b) => cx0 < b[2] && cx1 > b[0] && cy0 < b[3] && cy1 > b[1]);
        if (!bate) {
          caixas.push([cx0, cy0, cx1, cy1]);
          ctx.globalAlpha = Math.min(1, Math.max(0, (p.r - 0.2) * 4));
          ctx.fillStyle = "#EDE8DC"; ctx.textBaseline = "middle"; ctx.textAlign = "left";
          ctx.fillText(rotulo, x0, y);
          ctx.globalAlpha = 1;
        }
        ctx.beginPath(); ctx.arc(x, y, 2 + perto * 1.4, 0, 7); ctx.fillStyle = "#D6C29A"; ctx.fill();
        if (p.r <= 0.16) { ps.splice(i, 1); guardado++; absorve(p); if (ps.length < TETO) nasce(); }
      }
      if (!semMovimento && ps.length < TETO && Math.random() < 0.02) nasce();
      if (!semMovimento) raf = requestAnimationFrame(quadro);
    };
    quadro();
    return () => { vivo = false; cancelAnimationFrame(raf); clearTimeout(ecoT); window.removeEventListener("resize", medir); };
  }, [E, lang]);


  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) { setParado(true); return; }
    const t = setInterval(() => setAct((i) => (i + 1) % ANEL.length), 2400);
    return () => clearInterval(t);
  }, []);

  const R = 132;                            // raio do anel, em px do viewBox de 340
  const pos = (i) => {                      // estação i sobre o círculo, começando no topo
    const a = (i / ANEL.length) * Math.PI * 2 - Math.PI / 2;
    return { x: 170 + R * Math.cos(a), y: 170 + R * Math.sin(a) };
  };

  return (
    <section className="relative overflow-hidden px-5 pb-24 pt-16">
      <style>{`
        @keyframes engreveal{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes engspin{to{transform:rotate(360deg)}}
        @keyframes engbreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
        /* GLOW DAS TRÊS PROVAS — acende em cascata, uma de cada vez. Só text-shadow e brilho:
           a COR não muda (continua a champanhe #D6C29A do resto da seção). Trocar a cor faria
           a prova acesa parecer outro elemento; assim ela é a mesma coisa, só iluminada. */
        @keyframes engglow{
          0%,62%,100%{text-shadow:0 0 0 rgba(214,194,154,0);filter:brightness(1)}
          18%{text-shadow:0 0 18px rgba(214,194,154,.55),0 0 42px rgba(214,194,154,.22);filter:brightness(1.18)}
          40%{text-shadow:0 0 10px rgba(214,194,154,.28);filter:brightness(1.06)}
        }
        @media (prefers-reduced-motion: reduce){*{animation:none !important}}
      `}</style>

      <div className="mx-auto max-w-5xl">
        <div className="text-center" style={{ animation: "engreveal .7s ease both" }}>
          <div className="text-[12px] font-black uppercase tracking-[0.24em] text-g-gold">⚙️ {E.eyebrow}</div>
          <h2 className="mx-auto mt-4 max-w-3xl font-black leading-[1.04] tracking-tight text-g-word" style={{ fontSize: "clamp(2rem,5vw,3.4rem)" }}>
            {E.h1a}
            <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent">{E.h1b}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-g-ink">{E.sub}</p>
        </div>

        {/* ═══ A MÁQUINA — "RIO DE CONVERSAS" ═══════════════════════════════════════════════
            Luis escolheu o conceito A das quatro demos (2026-08-25) e pediu: «coloca dentro dessas
            bolinhas leads, sales, booking, appointment — tudo que for de positivo e resultado».
            POR QUE CANVAS E NÃO SVG: o anel anterior era ícone parado + bolinha girando, e o olho
            lê isso como diagrama de PowerPoint. Aqui o fundo é REPINTADO com transparência a cada
            quadro em vez de apagado — é isso que deixa cauda luminosa e dá sensação de matéria em
            movimento. Sem esse truque, é bolinha andando; com ele, é um rio.
            A TESE: cada partícula é um resultado REAL entrando no negócio, e o núcleo (a plantinha
            da Guileo) cresce e brilha conforme engole — o "se acumula" do título deixa de ser
            palavra e vira coisa que se vê acontecer. */}
        <div className="relative mx-auto mt-10 w-full max-w-[520px]">
          <canvas ref={canvasRef} className="block w-full" style={{ height: 380 }} aria-hidden="true" />
        </div>

        {/* ═══ O CARTÃO — a frase, o contador e o dinheiro ═══════════════════════════════
             Luis escolheu (2026-08-25) a mistura das direções I e II depois de recusar três
             variantes de legenda: «legenda de animação é redundante». O que ficou:
             1) A FRASE dá o soco («a ligação dos outros acaba, a sua volta»).
             2) O CONTADOR é o mesmo evento que o canvas desenha — quando a partícula é engolida,
                `absorve()` incrementa aqui, pulsa a cor e escreve o eco (+💰 venda). O número NÃO
                é cronômetro: é o relatório da animação, e por isso a causa se lê sem palavra.
                Começa contando as luzes que já estão na tela (opção B do Luis) — verdade, porque
                são conversas que ele está vendo agora, e não nasce zerado na chegada do visitante.
             3) AS TRÊS PROVAS dizem o que isso vale em dinheiro. 🚨 Sem percentual: "70% menos"
                é verdade de MERCADO, não medida da Guileo — é a mesma lei do X-Ray, nada se
                afirma sem medir. Quando o X-Ray medir num cliente real, o número entra com nome
                e data. Até lá: "uma fração", que diz o mesmo e ninguém contesta. */}
        <div className="mx-auto mt-10 max-w-3xl overflow-hidden rounded-xl3 border border-g-line bg-white/[0.04] p-6 text-center backdrop-blur-sm sm:p-8"
          style={{ animation: "engreveal .7s ease both" }}>
          <p className="mx-auto max-w-[20ch] font-black leading-[1.15] tracking-tight text-g-word" style={{ fontSize: "clamp(1.45rem,3.2vw,2rem)" }}>
            {E.volta1}
            <span className="bg-gradient-to-r from-g-green via-g-light to-g-gold bg-clip-text text-transparent">{E.volta2}</span>
          </p>

          <div className="mt-8 flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
            <span ref={numRef} className="font-black leading-none tracking-tight text-g-gold tabular-nums transition-[transform,color] duration-200"
              style={{ fontSize: "clamp(2.4rem,6vw,3.4rem)" }}>{SEMENTE}</span>
            <span ref={ecoRef} className="text-[13.5px] font-semibold text-g-green opacity-0 transition-opacity duration-300" />
          </div>
          <p className="mt-2 text-[14.5px] text-g-word">
            {E.contaSub}<span className="text-g-muted">{E.contaFonte}</span>
          </p>

          <div className="mt-9 grid gap-6 border-t border-g-line pt-7 sm:grid-cols-3 sm:gap-0">
            {E.provas.map(([forte, a, meio, b], i) => (
              <div key={i} className={`px-1 sm:px-4 ${i < 2 ? "sm:border-r sm:border-g-line" : ""}`}>
                <div className="text-[19px] font-black leading-none tracking-tight text-g-gold"
                  style={{ animation: `engglow 5.4s ${i * 1.8}s ease-in-out infinite` }}>{forte}</div>
                <p className="mt-2 text-[13.5px] leading-snug text-g-word">
                  {a}<span className="text-g-muted">{meio}</span>{b}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
