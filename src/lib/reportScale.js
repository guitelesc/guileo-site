// reportScale.js — A RÉGUA DO RELATÓRIO DE CRESCIMENTO, num lugar só.
//
// POR QUE EXISTE (2026-08-18): o Growth Report deixou de ser UMA página e virou uma página +
// os blocos que espelham a landing (`RelatorioEspelho.jsx`). Os dois desenham a MESMA nota, com
// a MESMA banda de cor, o MESMO rótulo de aspecto e o MESMO "não medido". Copiar isso para o
// segundo arquivo é como a lista de produtos escrita à mão que já mentiu na landing: não erra
// hoje, erra no dia em que alguém mexer num e esquecer do outro — e o defeito seria justamente
// a página mostrando DUAS verdades sobre a mesma nota.
//
// LEI DE HONESTIDADE (a mesma da página): score `null` é "não medido" — nunca 0, nunca some.
// A cor cinza de "não medido" é diferente das três bandas de propósito: cinza não é uma nota
// ruim, é ausência de medição, e as duas coisas não podem parecer a mesma.

/* score band → cor. null = não medido (cinza) — NUNCA mostrado como 0.
   Os cortes seguem a convenção do Lighthouse, que as pessoas já conhecem:
   0–49 vermelho, 50–89 âmbar, 90–100 verde. */
export const NOT_MEASURED = "#948C7B";
export const bandColor = (score) =>
  score == null ? NOT_MEASURED : score >= 90 ? "#34D399" : score >= 50 ? "#FBBF24" : "#F87171";

/* rótulos amigáveis para as chaves de aspecto que o motor emite */
export const ASPECT_LABELS = {
  presenca_web: { pt: "Presença web", en: "Web presence", es: "Presencia web", hi: "वेब उपस्थिति" },
  descoberta: { pt: "Descoberta (Google)", en: "Discovery (Google)", es: "Descubrimiento (Google)", hi: "खोज (Google)" },
  redes_sociais: { pt: "Redes sociais", en: "Social media", es: "Redes sociales", hi: "सोशल मीडिया" },
  captura_de_leads: { pt: "Captura de leads", en: "Lead capture", es: "Captura de leads", hi: "लीड कैप्चर" },
  atendimento: { pt: "Atendimento", en: "Phone coverage", es: "Atención", hi: "फ़ोन सेवा" },
  vendas_digitais: { pt: "Vendas digitais", en: "Digital sales", es: "Ventas digitales", hi: "डिजिटल बिक्री" },
};
export const aspectLabel = (nome, lang) =>
  ASPECT_LABELS[nome]?.[lang] || ASPECT_LABELS[nome]?.en || String(nome || "").replace(/_/g, " ");

/* ⚠️ DINHEIRO SEMPRE COM A MOEDA E O LOCALE DO RELATÓRIO — nunca "$" e "en-US" fixos.
   É o mesmo defeito que já fez a agente falar meia ligação em inglês e a landing escrever
   1,240 numa página portuguesa (onde a vírgula é decimal). Quem chama passa os dois. */
export const fmtMoney = (valor, moeda, locale) => {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: moeda || "USD", maximumFractionDigits: 0 }).format(valor);
  } catch {
    return `${moeda || "USD"} ${valor}`;
  }
};

/* hex → "r,g,b": a receita de vidro/brilho da landing (PillarsProducts) é escrita em rgba(),
   então a cor do cliente precisa chegar como canais. Hex ruim degrada para o verde Guileo. */
export const hexRgb = (hex) => {
  const h = String(hex || "").trim().replace("#", "");
  const f = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  if (!/^[0-9a-f]{6}$/i.test(f)) return "62,148,104";
  const n = parseInt(f, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

/* ── COR SEMÂNTICA: perda vs ganho ────────────────────────────────────────────
   Pedido do Luis (2026-08-19): "o número tem que ser — se ela tiver PERDENDO,
   mostrar o negativo; e os positivos, o que ela vai GANHAR. As cores e o visual
   ajudam muito a entender onde ficar."

   É um QUARTO sistema de cor nesta página, e de propósito ele não conflita com os
   outros três: cor da PERNA diz QUEM faz, accent da cliente diz o que é DELA, selo
   ✓/◔ diz quão CERTO é o número — e agora a cor do número diz DE QUE LADO ele está.
   Número em accent não significa nada; número em vermelho ou verde se explica sozinho
   e guia o olho sem legenda.

   Os tons são os MESMOS já usados por bandColor logo acima, não hex novo: a página
   inteira continua falando uma língua só de cor. */
export const PERDA = "#F87171";   // o que está vazando hoje — medido, nunca estimado sem premissa
export const GANHO = "#34D399";   // o que ela passa a ganhar
