import { useEffect, useState } from "react";
import { useLang } from "../i18n.jsx";

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
  },
};

export default function EngineV2() {
  const { lang } = useLang();
  const E = EV[lang] || EV.en;             // reserva SEMPRE inglês, nunca o idioma do autor
  const [act, setAct] = useState(0);
  const [parado, setParado] = useState(false);

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

        {/* A MÁQUINA */}
        <div className="relative mx-auto mt-12 w-full max-w-[420px]">
          <svg viewBox="0 0 340 340" className="block w-full" aria-hidden="true">
            <circle cx="170" cy="170" r={R} fill="none" stroke="rgba(214,194,154,0.16)" strokeWidth="1.5" />
            {/* arco aceso girando junto com a estação ativa */}
            <circle cx="170" cy="170" r={R} fill="none" stroke={`rgba(${ANEL[act].rgb},0.85)`} strokeWidth="3"
              strokeLinecap="round" strokeDasharray={`${(2 * Math.PI * R) / ANEL.length * 0.55} ${2 * Math.PI * R}`}
              style={{ transformOrigin: "170px 170px", transform: `rotate(${(act / ANEL.length) * 360 - 90}deg)`, transition: "transform .9s cubic-bezier(.22,1,.36,1)" }} />
            {/* ⚡ O COMBUSTÍVEL — pedido do Luis (2026-08-20): «mais realismo, tipo o combustível
                de uma pra outra». Sem isto o anel era um mostruário de seis ícones; com isto ele é
                uma MÁQUINA: dá para ver a energia saindo de uma estação e entrando na próxima.
                Implementado como rotação de um grupo (não `animateMotion`), porque assim a transição
                é interpolada pelo navegador e a bolinha DESLIZA pelo arco em vez de saltar. */}
            <g style={{ transformOrigin: "170px 170px",
                        transform: `rotate(${(act / ANEL.length) * 360 - 90}deg)`,
                        transition: parado ? "none" : "transform 1.1s cubic-bezier(.45,0,.25,1)" }}>
              <circle cx={170 + R} cy="170" r="6" fill={`rgb(${ANEL[act].rgb})`}
                style={{ filter: `drop-shadow(0 0 14px rgb(${ANEL[act].rgb}))`, transition: "fill .6s ease" }} />
              <circle cx={170 + R} cy="170" r="12" fill="none" stroke={`rgba(${ANEL[act].rgb},0.45)`} strokeWidth="1.5"
                style={{ transition: "stroke .6s ease" }} />
            </g>

            {ANEL.map((s, i) => {
              const { x, y } = pos(i);
              const on = i === act || parado;
              return (
                <g key={s.id} style={{ transition: "opacity .5s ease", opacity: on ? 1 : 0.38 }}>
                  <circle cx={x} cy={y} r="26" fill={`rgba(${s.rgb},${on ? 0.16 : 0.07})`} stroke={`rgba(${s.rgb},${on ? 0.7 : 0.28})`} strokeWidth="1.5"
                    style={{ filter: on ? `drop-shadow(0 0 16px rgba(${s.rgb},0.55))` : "none", transition: "all .5s ease" }} />
                  <text x={x} y={y + 8} textAnchor="middle" fontSize="22">{s.icon}</text>
                  <text x={x} y={y + 44} textAnchor="middle" fontSize="12" fontWeight="800"
                    fill={on ? `rgb(${s.rgb})` : "rgba(255,255,255,0.42)"}>{E.nomes[i]}</text>
                </g>
              );
            })}
            <text x="170" y="182" textAnchor="middle" fontSize="42"
              style={{ transformOrigin: "170px 170px", animation: parado ? "none" : "engbreathe 3.2s ease-in-out infinite" }}>♻️</text>
          </svg>
        </div>

        {/* UMA linha por vez — a explicação da estação acesa */}
        <div className="mx-auto mt-6 min-h-[64px] max-w-xl text-center">
          {parado ? (
            <ul className="space-y-1.5 text-[13.5px] leading-relaxed text-g-ink">
              {E.linhas.map((l, i) => <li key={i}><span className="font-bold text-g-word">{E.nomes[i]}:</span> {l}</li>)}
            </ul>
          ) : (
            <p key={act} className="text-[15px] leading-relaxed text-g-ink" style={{ animation: "engreveal .5s ease both" }}>
              <span className="font-black" style={{ color: `rgb(${ANEL[act].rgb})` }}>{E.nomes[act]}</span>
              {" — "}{E.linhas[act]}
            </p>
          )}
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center text-[13.5px] font-semibold text-g-muted">{E.loop}</p>
      </div>
    </section>
  );
}
