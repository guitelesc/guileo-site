import { useState } from "react";
import { PRODUCT_DETAIL, pilarDoPasso, productDetail } from "../data/productSystem.js";
import { PERNAS, pernaMeta, espelhoCopy } from "./RelatorioEspelho.jsx";
import { GANHO, bandColor } from "../lib/reportScale.js";

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// PROCESSO POR GUILEO — a entrega, VISUAL e PRÁTICA, dentro do hub do vendedor.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// PEDIDO DO LUIS (2026-08-19): «os processos por Guileo também é importante, e tem que ser VISUAL
// e PRÁTICO» — e «o hub seller é o ouro do negócio e o caixa».
//
// O DEFEITO QUE ESTA TELA FECHA: `productSystem.js` é o atlas canônico da entrega (o que cada
// produto É, os bullets do que ele FAZ, e o PRAZO), e `PILLAR_COPY` é a fonte única da palavra e
// da cor das três pernas. Nenhum dos dois era importado por arquivo NENHUM do hub do vendedor.
// Ou seja: o dado existia e a tela não — o vendedor não conseguia explicar a entrega olhando a
// tela, exatamente na superfície onde a explicação vira dinheiro.
//
// ⚠️ NADA AQUI É REDIGITADO. Nome da perna, cor, `owns` e a frase da anatomia vêm de `pernaMeta`
// (que já resolve PILLAR_COPY + o override do ❤️ do relatório); produto, "o que é", bullets e
// prazo vêm de `productDetail`. Se um produto mudar, esta tela muda sozinha nos 4 idiomas.
// O ícone do AD é ❤️ (coração) porque é o que o documento que o vendedor MANDA mostra — explicar
// com 📈 e mandar um PDF com ❤️ quebraria o reconhecimento que a metáfora existe pra criar.
//
// ⚠️ OS DOIS TIPOS DE PRAZO NÃO PODEM PARECER IGUAIS (o ponto inteiro da tela):
//   · "no ar em ~7 dias"  → COMPROMISSO NOSSO. Verde `GANHO` — é o que a Guileo assume.
//   · "precisa do Stripe conectado" → INSUMO DE TERCEIRO. Âmbar de atenção, com o rótulo
//     "depende de:" na frente. O vendedor aprende a COBRAR o insumo na reunião em vez de
//     descobrir o atraso depois e soar como desculpa.
// A distinção é lida do DADO, não de uma lista à mão: a chave `en` do prazo começa com "live in"
// quando é tempo. Um idioma só decide (o `en` é o original de onde os outros três derivam), então
// traduzir nunca troca a cor de um selo.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

// Âmbar de ATENÇÃO — o MESMO da régua do relatório (banda 50–89), não um hex novo. Cor nova para
// dizer "atenção" criaria uma segunda verdade visual sobre o mesmo significado.
const ATENCAO = bandColor(50);

// Tempo ou condição? Lê o original `en` do próprio dado. Sem prazo → null (não desenha selo).
const tipoDePrazo = (id) => {
  const en = PRODUCT_DETAIL[id]?.prazo?.en;
  if (!en) return null;
  return /^live in/i.test(en.trim()) ? "tempo" : "condicao";
};

const D = {
  pt: {
    h: "Processo por Guileo",
    sub: "O que a Guileo entrega, por perna. Cada produto com o que é, o que faz e o prazo — pra você explicar a entrega olhando a tela.",
    entrega: "O que entra",
    prazoTempo: "Prazo",
    dependeDe: "Depende de",
    legTempo: "Prazo — compromisso nosso",
    legCond: "Depende de — insumo do cliente ou de terceiro",
    resumo: "Resumo pra mandar",
    copiar: "📋 Copiar resumo",
    copiado: "Copiado ✓",
  },
  en: {
    h: "The Guileo process",
    sub: "What Guileo delivers, leg by leg. Every product with what it is, what it does and the timeline — so you can explain the delivery straight off the screen.",
    entrega: "What you get",
    prazoTempo: "Timeline",
    dependeDe: "Depends on",
    legTempo: "Timeline — our commitment",
    legCond: "Depends on — an input from the client or a third party",
    resumo: "Summary to send",
    copiar: "📋 Copy summary",
    copiado: "Copied ✓",
  },
  es: {
    h: "Proceso por Guileo",
    sub: "Lo que Guileo entrega, por pilar. Cada producto con qué es, qué hace y el plazo — para explicar la entrega mirando la pantalla.",
    entrega: "Qué entra",
    prazoTempo: "Plazo",
    dependeDe: "Depende de",
    legTempo: "Plazo — compromiso nuestro",
    legCond: "Depende de — insumo del cliente o de un tercero",
    resumo: "Resumen para enviar",
    copiar: "📋 Copiar resumen",
    copiado: "Copiado ✓",
  },
  hi: {
    h: "Guileo की प्रक्रिया",
    sub: "Guileo क्या देती है, हर स्तंभ के हिसाब से। हर प्रोडक्ट के साथ — वह क्या है, क्या करता है और समय-सीमा — ताकि आप स्क्रीन देखकर डिलीवरी समझा सकें।",
    entrega: "क्या मिलता है",
    prazoTempo: "समय-सीमा",
    dependeDe: "किस पर निर्भर",
    legTempo: "समय-सीमा — हमारी प्रतिबद्धता",
    legCond: "निर्भरता — क्लाइंट या किसी तीसरे पक्ष से मिलने वाली चीज़",
    resumo: "भेजने के लिए सारांश",
    copiar: "📋 सारांश कॉपी करें",
    copiado: "कॉपी हो गया ✓",
  },
};

// Os produtos de uma perna, já traduzidos. A perna sai de `pilarDoPasso` — a MESMA resolução que
// o Growth Report usa (PRODUCT_DETAIL.pilar → PRODUCTS.pilar), então tela e documento agrupam
// igual. Produto que não resolve perna simplesmente não aparece: chute é pior que ausência.
const produtosDaPerna = (perna, lang) =>
  Object.keys(PRODUCT_DETAIL)
    .filter((id) => pilarDoPasso(id) === perna)
    .map((id) => ({ ...productDetail(id, lang), tipo: tipoDePrazo(id) }))
    .filter((p) => p && p.name);

// O resumo de UMA linha que o vendedor copia. Montado SÓ com o que está na tela: nome da perna,
// `owns`, a frase da anatomia, os nomes dos produtos e os prazos literais. Zero cifra, zero
// promessa nova — se não está no dado, não entra no texto.
const resumoDaPerna = (meta, produtos, t) => {
  const nomes = produtos.map((p) => p.name).join(" · ");
  const partes = [`${meta.badge} — ${meta.owns}.`, meta.linha, `${t.entrega}: ${nomes}.`];
  const tempo = produtos.filter((p) => p.tipo === "tempo" && p.prazo);
  const cond = produtos.filter((p) => p.tipo === "condicao" && p.prazo);
  if (tempo.length) {
    // agrupa por texto de prazo: quatro produtos com "no ar em ~7 dias" viram uma frase, não quatro.
    const porPrazo = {};
    tempo.forEach((p) => { (porPrazo[p.prazo] = porPrazo[p.prazo] || []).push(p.name); });
    partes.push(`${t.prazoTempo}: ${Object.entries(porPrazo).map(([pz, ns]) => `${pz} (${ns.join(", ")})`).join(" · ")}.`);
  }
  if (cond.length) {
    partes.push(`${t.dependeDe}: ${cond.map((p) => `${p.prazo} (${p.name})`).join(" · ")}.`);
  }
  return partes.filter(Boolean).join(" ");
};

function SeloPrazo({ p, t }) {
  if (!p.prazo || !p.tipo) return null; // sem dado, sem selo — nunca um prazo inventado
  const tempo = p.tipo === "tempo";
  const cor = tempo ? GANHO : ATENCAO;
  return (
    <div className="mt-2.5 inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-lg px-2.5 py-1.5"
      style={{ border: `1px solid ${cor}55`, background: `${cor}14` }}>
      <span className="text-[10.5px] font-black uppercase tracking-wide" style={{ color: cor }}>
        {tempo ? `⏱ ${t.prazoTempo}` : `🔑 ${t.dependeDe}`}
      </span>
      <span className="text-[12px] font-bold" style={{ color: cor }}>{p.prazo}</span>
    </div>
  );
}

export default function SellerProcesso({ lang = "pt" }) {
  const t = D[lang] || D.en;
  // A frase da anatomia vem do relatório (os 4 idiomas já vivem lá) — é a MESMA frase que o
  // cliente lê no documento que o vendedor manda.
  const anatomia = espelhoCopy(lang).anatomia;
  const [copiado, setCopiado] = useState("");

  const copiar = (perna, texto) => {
    navigator.clipboard?.writeText(texto);
    setCopiado(perna);
    setTimeout(() => setCopiado(""), 1600);
  };

  return (
    <div className="min-w-0">
      <div className="card p-5 min-w-0">
        <div className="text-[16px] font-black text-g-word">{t.h}</div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-g-muted">{t.sub}</p>
        <p className="mt-3 text-[12.5px] font-semibold leading-snug text-g-word">{anatomia}</p>
        {/* legenda dos DOIS selos, no topo: a distinção só ensina se o vendedor souber ler a cor */}
        <div className="mt-3 flex flex-wrap gap-2">
          {[[GANHO, `⏱ ${t.legTempo}`], [ATENCAO, `🔑 ${t.legCond}`]].map(([cor, txt]) => (
            <span key={txt} className="rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ border: `1px solid ${cor}55`, background: `${cor}14`, color: cor }}>{txt}</span>
          ))}
        </div>
      </div>

      {PERNAS.map((perna) => {
        const meta = pernaMeta(lang, perna);
        const produtos = produtosDaPerna(perna, lang);
        // perna sem produto no atlas não desenha cabeçalho vazio — bloco sem dado não renderiza
        if (!meta || !produtos.length) return null;
        const resumo = resumoDaPerna(meta, produtos, t);
        return (
          <section key={perna} className="card mt-4 p-5 min-w-0">
            {/* CABEÇALHO DA PERNA — ícone, cor, nome, `owns` e a anatomia, tudo de PILLAR_COPY */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[18px]"
                style={{ background: `rgba(${meta.rgb},0.13)`, boxShadow: `inset 0 0 0 1px rgba(${meta.rgb},0.4)` }}>
                {meta.icon}
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-black tracking-tight" style={{ color: meta.accent }}>{meta.badge}</div>
                <div className="text-[11.5px] font-bold text-g-muted">{meta.owns}</div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-g-word">{meta.linha}</p>
              </div>
            </div>

            {/* OS PRODUTOS DAQUELA PERNA */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {produtos.map((p) => (
                <div key={p.id} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 backdrop-blur-xl"
                  style={{ borderLeft: `3px solid rgba(${meta.rgb},0.55)` }}>
                  <div className="flex items-start gap-2">
                    <span className="text-[15px] leading-none">{p.icon}</span>
                    <div className="min-w-0 text-[13px] font-extrabold leading-snug text-g-word break-words">{p.name}</div>
                  </div>
                  {p.whatIs && <p className="mt-1.5 text-[12px] leading-relaxed text-g-muted break-words">{p.whatIs}</p>}
                  {p.bullets.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {p.bullets.map((b, i) => (
                        <li key={i} className="flex gap-1.5 text-[11.5px] leading-relaxed text-g-muted break-words">
                          <span className="shrink-0" style={{ color: meta.accent }}>•</span>
                          <span className="min-w-0">{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <SeloPrazo p={p} t={t} />
                </div>
              ))}
            </div>

            {/* RESUMO DE 1 LINHA — só o que está acima nesta tela, nada inventado, nenhuma cifra */}
            <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-3 backdrop-blur-xl">
              <div className="text-[10.5px] font-bold uppercase tracking-wide text-g-muted">{t.resumo}</div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-g-word break-words">{resumo}</p>
              <button onClick={() => copiar(perna, resumo)}
                className="btn-ghost mt-2 min-h-[44px] text-[13px]">
                {copiado === perna ? t.copiado : t.copiar}
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
