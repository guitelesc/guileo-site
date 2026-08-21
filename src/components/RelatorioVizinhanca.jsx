// RelatorioVizinhanca.jsx — A VIZINHANÇA: onde o cliente está no meio dos concorrentes reais.
//
// POR QUE ESTE ARQUIVO EXISTE (2026-08-19)
// Luis: «adorei a análise do concorrente, isso é importante desse motor». Ela existia, mas
// aparecia como uma <ul> de texto cru — a única parte do relatório sem desenho nenhum. E, pior,
// vinha vazia de sentido: o motor buscava vizinho pelo NOME do próprio negócio (ver a nota em
// googleBusiness.js#vizinhos), então trazia um xará e não a vizinhança.
//
// A LEI DESTE BLOCO — ele NÃO cita nome de vizinho.
// O relatório é um documento que o cliente encaminha. Nome de vizinho aqui vira fofoca do bairro
// e queima quem mandou. O que convence é a POSIÇÃO: quantos estão à frente, qual a mediana, e a
// distância dele até ela. Posição é fato; nome é dedo na cara.
//
// A LEI DA AMOSTRA — piso de 3, e o piso aparece.
// Com menos de 3 vizinhos medidos não existe mediana honesta. Nesse caso o bloco NÃO desenha
// gráfico: ele diz, com todas as letras, que a amostra não sustenta a comparação. Um gráfico
// bonito sobre 1 ponto é exatamente o tipo de sucesso inventado que já nos custou um dia inteiro.
import { useEffect, useRef, useState } from "react";
import { PERDA, GANHO, NOT_MEASURED } from "../lib/reportScale.js";

const T = {
  pt: { eyebrow: "A vizinhança", titulo: (n) => n === 1 ? "Medimos 1 concorrente perto de vocês" : `Medimos ${n} concorrentes perto de vocês`,
        sub: "Mesma categoria, mesma cidade, pelo que cada um publica no Google. Nenhum nome aparece aqui — o que importa é onde vocês estão na fila.",
        nota: "Nota", aval: "Avaliações", voce: "Vocês", mediana: "Mediana da vizinhança",
        afrente: (a, t) => `${a} de ${t} estão à frente de vocês`, lider: (t) => `Vocês estão à frente dos ${t}`,
        atras: "atrás da mediana", frente: "à frente da mediana", empate: "na mediana",
        poucos: (achados, comDado) => comDado === 0
          ? `Achamos ${achados}, mas nenhum publica nota ou contagem de avaliações no Google`
          : `Só ${comDado} de ${achados} publicam os números — abaixo do piso de 3`,
        poucosSub: "Sem três medições não existe mediana honesta, então não desenhamos a comparação. Não é que vocês estejam bem ou mal: é que ainda não dá pra afirmar.",
        semDado: "Sem dado público", gui: (a) => `${a} fecha essa distância no canal que vocês já têm: atende toda ligação, pede avaliação na hora certa e responde as que chegam.` },
  en: { eyebrow: "The neighborhood", titulo: (n) => n === 1 ? "We measured 1 competitor near you" : `We measured ${n} competitors near you`,
        sub: "Same category, same city, from what each one publishes on Google. No names appear here — what matters is where you sit in the line.",
        nota: "Rating", aval: "Reviews", voce: "You", mediana: "Neighborhood median",
        afrente: (a, t) => `${a} of ${t} are ahead of you`, lider: (t) => `You are ahead of all ${t}`,
        atras: "behind the median", frente: "ahead of the median", empate: "at the median",
        poucos: (achados, comDado) => comDado === 0
          ? `We found ${achados}, but none of them publish a rating or review count on Google`
          : `Only ${comDado} of ${achados} publish the numbers — below the floor of 3`,
        poucosSub: "Without three measurements there is no honest median, so we do not draw the comparison. It is not that you are doing well or badly: it is that we cannot yet say.",
        semDado: "No public data", gui: (a) => `${a} closes that gap on the channel you already have: answers every call, asks for the review at the right moment, and replies to the ones that arrive.` },
  es: { eyebrow: "El vecindario", titulo: (n) => n === 1 ? "Medimos 1 competidor cerca de ustedes" : `Medimos ${n} competidores cerca de ustedes`,
        sub: "Misma categoría, misma ciudad, según lo que cada uno publica en Google. Aquí no aparece ningún nombre — lo que importa es en qué lugar de la fila están.",
        nota: "Calificación", aval: "Reseñas", voce: "Ustedes", mediana: "Mediana del vecindario",
        afrente: (a, t) => `${a} de ${t} están por delante de ustedes`, lider: (t) => `Están por delante de los ${t}`,
        atras: "por detrás de la mediana", frente: "por delante de la mediana", empate: "en la mediana",
        poucos: (achados, comDado) => comDado === 0
          ? `Encontramos ${achados}, pero ninguno publica calificación ni conteo de reseñas en Google`
          : `Solo ${comDado} de ${achados} publican los números — por debajo del piso de 3`,
        poucosSub: "Sin tres mediciones no existe una mediana honesta, así que no dibujamos la comparación. No es que estén bien o mal: es que todavía no se puede afirmar.",
        semDado: "Sin dato público", gui: (a) => `${a} cierra esa distancia en el canal que ya tienen: atiende cada llamada, pide la reseña en el momento correcto y responde las que llegan.` },
  hi: { eyebrow: "आस-पड़ोस", titulo: (n) => `हमने आपके पास ${n} प्रतिस्पर्धी मापे`,
        sub: "वही श्रेणी, वही शहर — जो हर कोई Google पर प्रकाशित करता है उसके आधार पर। यहाँ कोई नाम नहीं आता — मायने यह रखता है कि आप कतार में कहाँ हैं।",
        nota: "रेटिंग", aval: "रिव्यू", voce: "आप", mediana: "पड़ोस की मध्यिका",
        afrente: (a, t) => `${t} में से ${a} आपसे आगे हैं`, lider: (t) => `आप सभी ${t} से आगे हैं`,
        atras: "मध्यिका से पीछे", frente: "मध्यिका से आगे", empate: "मध्यिका पर",
        poucos: (achados, comDado) => comDado === 0
          ? `हमें ${achados} मिले, पर उनमें से कोई Google पर रेटिंग या रिव्यू संख्या प्रकाशित नहीं करता`
          : `${achados} में से केवल ${comDado} संख्याएँ प्रकाशित करते हैं — 3 की न्यूनतम सीमा से कम`,
        poucosSub: "तीन मापों के बिना ईमानदार मध्यिका नहीं होती, इसलिए हम तुलना नहीं बनाते। ऐसा नहीं कि आप अच्छे या बुरे हैं: अभी कहा नहीं जा सकता।",
        semDado: "सार्वजनिक डेटा नहीं", gui: (a) => `${a} उसी चैनल पर यह दूरी पाटती है जो आपके पास पहले से है: हर कॉल उठाती है, सही समय पर रिव्यू माँगती है, और आने वाले रिव्यू का जवाब देती है।` },
};

const PISO = 3;
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/* Revela quando entra na tela. Aba de fundo e prefers-reduced-motion revelam na hora — a mesma
   trava dos contadores: animação que não roda não pode deixar o número escondido. */
function useReveal() {
  const ref = useRef(null); const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ||
        document.visibilityState !== "visible" || !("IntersectionObserver" in window)) { setOn(true); return; }
    const t = setTimeout(() => setOn(true), 2500);           // rede de segurança
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { setOn(true); io.disconnect(); clearTimeout(t); } }), { threshold: 0.25 });
    io.observe(el); return () => { io.disconnect(); clearTimeout(t); };
  }, []);
  return [ref, on];
}

/* UMA RÉGUA. Cada vizinho é um traço na escala; o cliente é o marcador aceso; a mediana é a
   linha tracejada. O olho lê "quantos estão à minha direita" sem precisar de legenda — que é
   exatamente a pergunta que o dono do negócio faz. */
function Regua({ label, meu, valores, accent, rgb, fmt = (v) => v, t, on, atraso = 0 }) {
  if (meu == null || valores.length < PISO) return null;
  const todos = [...valores, meu];
  const min = Math.min(...todos), max = Math.max(...todos), span = max - min || 1;
  const pos = (v) => 6 + ((v - min) / span) * 88;            // 6%..94%: marcador nunca vaza a caixa
  const med = mediana(valores);
  const afrente = valores.filter((v) => v > meu).length;
  const lado = meu > med ? GANHO : meu < med ? PERDA : NOT_MEASURED;
  const ladoTxt = meu > med ? t.frente : meu < med ? t.atras : t.empate;

  return (
    <div className="rounded-2xl border border-g-line bg-g-creamd/50 backdrop-blur-xl p-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-g-ink">{label}</span>
        <span className="text-[12.5px] font-semibold tabular-nums" style={{ color: lado }}>{ladoTxt}</span>
      </div>

      <div className="relative mt-7 h-11">
        {/* trilho */}
        <div className="absolute inset-x-0 top-5 h-px bg-g-line" />
        {/* mediana */}
        <div className="absolute top-1.5 h-8 border-l border-dashed border-g-line"
          style={{ left: `${pos(med)}%`, transition: "left .9s cubic-bezier(.22,1,.36,1)", transitionDelay: `${atraso}ms` }} />
        {/* vizinhos — traços neutros: eles não são vilões, são a régua */}
        {valores.map((v, i) => (
          <span key={i} aria-hidden="true" className="absolute top-3.5 h-3 w-px rounded"
            style={{ left: `${on ? pos(v) : 50}%`, background: NOT_MEASURED, opacity: on ? 0.85 : 0,
                     transition: "left .9s cubic-bezier(.22,1,.36,1), opacity .5s ease",
                     transitionDelay: `${atraso + i * 55}ms` }} />
        ))}
        {/* o cliente */}
        <span className="absolute top-[11px] grid h-[18px] w-[18px] -translate-x-1/2 place-items-center rounded-full"
          style={{ left: `${on ? pos(meu) : 50}%`, background: accent,
                   boxShadow: `0 0 0 3px rgba(${rgb},0.22), 0 4px 14px rgba(${rgb},0.55)`,
                   transition: "left 1s cubic-bezier(.22,1,.36,1)", transitionDelay: `${atraso + 120}ms` }} />
        <span className="absolute -top-1 -translate-x-1/2 whitespace-nowrap text-[12.5px] font-black tabular-nums"
          style={{ left: `${on ? pos(meu) : 50}%`, color: accent,
                   transition: "left 1s cubic-bezier(.22,1,.36,1)", transitionDelay: `${atraso + 120}ms` }}>
          {fmt(meu)}
        </span>
        <span className="absolute top-[30px] -translate-x-1/2 whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-wider text-g-muted"
          style={{ left: `${pos(med)}%` }}>{t.mediana} {fmt(med)}</span>
      </div>

      <p className="mt-8 text-[13px] text-g-ink">
        {afrente === 0 ? t.lider(valores.length) : t.afrente(afrente, valores.length)}
      </p>
    </div>
  );
}

export default function RelatorioVizinhanca({ concorrentes = [], meuNota = null, meuAvaliacoes = null,
                                              accent, rgb, lang = "pt", agentName = "Gui" }) {
  const t = T[lang] || T.en;
  const [ref, on] = useReveal();
  if (!concorrentes.length) return null;

  // Só entra na régua quem tem o número PUBLICADO. Vizinho sem nota não vira zero — ele sai da
  // conta, do mesmo jeito que aspecto não medido sai da média do score.
  const notas = concorrentes.map((k) => k?.nota).filter((n) => typeof n === "number");
  const avals = concorrentes.map((k) => k?.avaliacoes).filter((n) => typeof n === "number");
  const temRegua = (meuNota != null && notas.length >= PISO) || (meuAvaliacoes != null && avals.length >= PISO);
  const amostra = Math.max(notas.length, avals.length);

  return (
    <section ref={ref} className="relative mt-16 overflow-hidden rounded-3xl border border-g-line bg-g-creamd/30 backdrop-blur-xl p-6 sm:p-9">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: `linear-gradient(90deg,transparent,rgba(${rgb},0.9),transparent)` }} />
      <div className="text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.26em]" style={{ color: accent }}>{t.eyebrow}</div>
        <h2 className="mx-auto mt-3 max-w-2xl font-black leading-[1.05] tracking-tight text-g-word"
          style={{ fontSize: "clamp(1.5rem,3.4vw,2.1rem)" }}>{t.titulo(concorrentes.length)}</h2>
        <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-g-ink">{t.sub}</p>
      </div>

      {temRegua ? (
        <>
          <div className="mt-9 grid gap-4 sm:grid-cols-2">
            <Regua label={t.nota} meu={meuNota} valores={notas} accent={accent} rgb={rgb} t={t} on={on}
              fmt={(v) => v.toFixed(1)} />
            <Regua label={t.aval} meu={meuAvaliacoes} valores={avals} accent={accent} rgb={rgb} t={t} on={on}
              fmt={(v) => Math.round(v).toLocaleString(lang === "pt" ? "pt-BR" : lang)} atraso={160} />
          </div>
          <p className="mt-7 text-center text-[13.5px] leading-relaxed text-g-ink">{t.gui(agentName)}</p>
        </>
      ) : (
        /* AMOSTRA INSUFICIENTE — dito, não escondido. */
        <div className="mx-auto mt-8 max-w-lg rounded-2xl border border-dashed border-g-line p-5 text-center">
          <div className="text-[14px] font-bold" style={{ color: NOT_MEASURED }}>{t.poucos(concorrentes.length, amostra)}</div>
          <p className="mt-2 text-[13px] leading-relaxed text-g-ink">{t.poucosSub}</p>
        </div>
      )}
    </section>
  );
}
