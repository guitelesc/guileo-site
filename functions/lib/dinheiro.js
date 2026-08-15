// functions/lib/dinheiro.js — TEXTO QUE VIRA DINHEIRO. Um lugar só.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ESTE ARQUIVO EXISTE (2026-08-11)
// A conversão "string → centavos" estava escrita TRÊS vezes nesta base, cada uma com uma regra
// diferente, e as três decidem dinheiro real:
//
//   functions/api/ads.js        paraCentavos()  — gasto de anúncio (corrigido, com teste)
//   functions/lib/spendGuard.js parseFloat(replace(/[^0-9.]/g,""))  — a guarda ANTES de cobrar
//   functions/api/google-ads.js toCents()       — o orçamento que o time monta a campanha em cima
//
// A versão `replace(/[^0-9.]/g,"")` não dá erro nunca. Ela dá um número calmo e errado:
//
//     "45,00"  → apaga a vírgula → "4500" → parseFloat 4500  →  US$ 4.500,00   (100× a mais)
//     "1.240"  → mantém o ponto  → 1.24                      →  US$ 1,24       (1000× a menos)
//
// O primeiro caso é o pior: a Gui fala português e espanhol, e "45,00" é como o preço é dito em
// metade dos idiomas que ela atende. Com o teto padrão da política de gasto em US$ 1.000 para
// exigir humano, um serviço de R$ 9,50 vira um link de cobrança de US$ 950 SEM passar por
// ninguém. Não é hipótese de laboratório — é o formato normal de quem digita em pt/es.
//
// A regra desta casa, agora em um lugar só: DESCOBRIR O FORMATO ANTES DE LIMPAR.
//  · os dois separadores presentes → o ÚLTIMO é o decimal, o outro é milhar (serve US e pt-BR);
//  · um só separador seguido de exatamente 3 dígitos até o fim → é MILHAR ("1.500", "1,000");
//  · um só separador, qualquer outra contagem → é DECIMAL ("1500,50", "450.00").
// Valor ilegível vira RECUSA explícita, nunca chute: dinheiro errado contamina toda conta
// derivada, e é melhor a pessoa relançar do que o motor decidir com número inventado.
//
// Testado por functions/lib/dinheiro.test.mjs, que importa DESTE arquivo (e ads.js reexporta,
// para quem já importava de lá continuar funcionando).

/**
 * Texto/número → centavos inteiros. `null` = não deu para ler (recusa explícita).
 * Aceita "1.500", "$1500", "1500,50", "$1,240.00", "12,345.67", "R$ 1.234,56" ou número puro.
 */
export function paraCentavos(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v * 100);
  const bruto = String(v);
  // O SINAL DE MENOS TEM QUE SER VISTO ANTES DA LIMPEZA. A faxina `[^0-9.,]` apagava o "-", então
  // "-50" (crédito/ajuste, comum em export do Google Ads) virava +$50 de GASTO e a guarda `n >= 0`
  // nunca via um negativo para recusar. Recusa em vez de usar o valor absoluto: um crédito não é
  // gasto, e adivinhar a intenção do dono com o dinheiro dele é o que este arquivo não faz.
  if (/-\s*[\d.,]/.test(bruto)) return null;
  let s = bruto.replace(/[^0-9.,]/g, "");
  if (!s) return null;
  const ultPonto = s.lastIndexOf(".");
  const ultVirg = s.lastIndexOf(",");
  let dec = "";                                   // qual caractere é o separador DECIMAL
  if (ultPonto >= 0 && ultVirg >= 0) {
    dec = ultPonto > ultVirg ? "." : ",";         // o último manda
  } else if (ultPonto >= 0 || ultVirg >= 0) {
    const sep = ultPonto >= 0 ? "." : ",";
    const pos = Math.max(ultPonto, ultVirg);
    const depois = s.length - pos - 1;
    dec = depois === 3 ? "" : sep;                // 3 dígitos exatos = milhar
  }
  if (dec) {
    const outro = dec === "." ? /,/g : /\./g;
    s = s.replace(outro, "");                     // some com o milhar
    s = s.replace(dec, ".");                      // decimal vira ponto (só há um, o último)
  } else {
    s = s.replace(/[.,]/g, "");                   // tudo era milhar
  }
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

// A leitura INGÊNUA que ainda vive nos caminhos de cobrança (agent-action.js). Reproduzida aqui
// de propósito: é comparando as duas que se descobre que o texto é ambíguo.
function centavosIngenuo(v) {
  const n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/**
 * A LEITURA PARA QUEM VAI COBRAR. Devolve `{ cents, ambiguo, ingenuo, motivo }`.
 *
 * `ambiguo:true` quando as duas leituras discordam — ou seja, quando o texto pode significar dois
 * valores diferentes ("45,00" é $45 ou $4.500?). Nesse caso quem chama NÃO deve cobrar sozinho:
 * a resposta certa é pedir confirmação humana, não escolher uma das duas em nome do cliente.
 * `cents` volta com a leitura CORRETA (formato descoberto), e `ingenuo` com a que o caminho de
 * cobrança usaria hoje — os dois lado a lado para o alerta poder dizer o tamanho do erro.
 */
export function valorParaCobranca(v) {
  const cents = paraCentavos(v);
  const ingenuo = centavosIngenuo(v);
  if (cents == null) return { cents: null, ingenuo, ambiguo: false, motivo: "valor ilegivel" };

  // ── O QUE É AMBIGUIDADE DE VERDADE ─────────────────────────────────────────────────────────
  // A primeira versão definia ambíguo como "a leitura correta discorda da leitura ingênua". Isso
  // é largo demais: "45,00" discorda (a ingênua lê $4.500), mas NÃO é ambíguo — dois dígitos
  // depois do separador é decimal em qualquer idioma do mundo. O efeito colateral era grave e
  // silencioso: TODO valor com centavos dito em português ou espanhol ("45,00", "9,50", "0,99")
  // caía em revisão humana, e o "Fecha & Cobra" — o motor que fecha venda na ligação — ficava
  // desligado em 2 dos 3 idiomas que a Gui atende. Trocar cobrança errada por venda não fechada
  // é trocar um problema por outro.
  //
  // Ambíguo mesmo é UM caso só: separador único seguido de EXATAMENTE 3 dígitos.
  //   "1.500" / "1,500"  → $1.500,00 (milhar) ou $1,50 / $1,500? A frase não decide.
  // Aqui a diferença é de 1000×, o dono nunca revê, e o certo é parar e perguntar.
  //
  // Quantidade de dígitos após o separador → veredito:
  //   2 dígitos ("45,00")  → decimal, sempre. Sem ambiguidade.
  //   1 ou 4+ ("45,0"/"45,0000") → decimal, sempre (milhar tem exatamente 3).
  //   3 dígitos ("1.500")  → AMBÍGUO. Só este.
  //   dois separadores ("1,234.56") → o último é decimal, resolvido. Sem ambiguidade.
  const txt = String(v == null ? "" : v);
  const soDigitosESep = txt.replace(/[^0-9.,]/g, "");
  const temPonto = soDigitosESep.includes(".");
  const temVirgula = soDigitosESep.includes(",");
  let ambiguo = false;
  if (temPonto !== temVirgula) {                    // exatamente UM tipo de separador
    const sep = temPonto ? "." : ",";
    const ultimo = soDigitosESep.lastIndexOf(sep);
    const depois = soDigitosESep.length - ultimo - 1;
    const quantos = soDigitosESep.split(sep).length - 1;
    // um separador só, com 3 dígitos depois: é o caso que ninguém consegue decidir pelo texto.
    // ("1.234.567" tem dois separadores do mesmo tipo → é milhar sem dúvida nenhuma.)
    ambiguo = quantos === 1 && depois === 3;
  }
  return {
    cents, ingenuo, ambiguo,
    motivo: ambiguo
      ? `valor ambiguo: "${txt.slice(0, 24)}" pode ser $${(cents / 100).toFixed(2)} ou $${((ingenuo == null ? cents : ingenuo) / 100).toFixed(2)} — confirme antes de cobrar`
      : null,
  };
}

// Símbolos de moeda que NÃO são dólar. O motor de anúncios mede tudo em US$ (o preço de serviço,
// a receita, o teto de cobrança), então gasto colado em outra moeda entra como se fosse dólar e
// desalinha o retorno inteiro em silêncio — 5× de erro num export brasileiro, sem nenhum aviso.
const MOEDAS = [
  [/R\$/i, "BRL"], [/€/, "EUR"], [/£/, "GBP"], [/₹/, "INR"],
  [/\bBRL\b/i, "BRL"], [/\bEUR\b/i, "EUR"], [/\bGBP\b/i, "GBP"], [/\bINR\b/i, "INR"],
  [/\bMXN\b/i, "MXN"], [/\bCAD\b/i, "CAD"],
];

/** Devolve o código da moeda quando o texto declara uma que NÃO é dólar; senão null. */
export function moedaNaoDolar(txt) {
  const t = String(txt == null ? "" : txt);
  for (const [re, cod] of MOEDAS) if (re.test(t)) return cod;
  return null;
}
