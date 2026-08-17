// Contract/quote BODY builder — turns a (scope, template, language, counterparty) into the frozen
// JSON snapshot stored in the `contracts` row and rendered by <ContractDoc>. Trilingual (pt|en|es).
import { CLAUSES, GUILEO_CLIENT, CLIENT_CUSTOMER, QUOTE, DISCLAIMER } from "../data/contractTemplates.js";
import { entidadePorIdioma, qualificacao, pendencias } from "../data/empresa.js";

export const L = (o, lang) => (o && (o[lang] || o.pt || o.en)) || "";
export const TEMPLATES = { guileo_client: GUILEO_CLIENT, client_customer: CLIENT_CUSTOMER };

export function findTemplate(scope, code) {
  const list = TEMPLATES[scope] || GUILEO_CLIENT;
  return list.find((t) => t.code === code) || list[0];
}

// Replace [BRACKET] fill-in fields. Tolerant of PT/EN/ES token spellings.
function fill(text, vals) {
  if (!text) return text || "";
  const cp = vals.counterparty || {};
  return String(text)
    .replace(/\[(CLIENTE|CLIENT|NOME|NAME|CONTRATANTE)\]/g, cp.name || "[____]")
    .replace(/\[(VALOR|AMOUNT|VALUE|PRE[ÇC]O|PRICE)\]/g, vals.amount || "[____]")
    .replace(/\[(DATA|DATE|FECHA)\]/g, vals.date || "[____]")
    .replace(/\[(ENDERE[ÇC]O|ADDRESS|DIRECCI[ÓO]N)\]/g, cp.address || "[____]")
    .replace(/\[(EMAIL|E-MAIL|CORREO)\]/g, cp.email || "[____]");
}

// Troca SÓ a cifra da frente da linha de pagamento pelo valor realmente acordado. Casa "US$ 449/mês",
// "R$ 2.400/mês", "$999/mo" — e não encosta em nada que não comece com dinheiro, então as 8 formas
// de pagamento sem cifra ("50% na assinatura, 50% na entrega") passam intactas.
const PRECO_NA_FRENTE = /^\s*(?:US\$|R\$|\$|USD|BRL|€|EUR)\s?[\d.,]+\s*(?:\/\s*(?:m[êe]s|mo|month|mensal))?\s*\.?\s*/i;
function precoUnico(texto, amount) {
  const t = String(texto || "");
  const v = String(amount || "").trim();
  if (!v || !PRECO_NA_FRENTE.test(t)) return t;
  return (v.replace(/\s*$/, "") + ". " + t.replace(PRECO_NA_FRENTE, "")).trim();
}

export function buildBody({ scope = "guileo_client", code, lang = "pt", kind = "contract", provider = {}, counterparty = {}, amount = "" } = {}) {
  const t = findTemplate(scope, code);
  const date = new Date().toLocaleDateString(lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US");
  const vals = { counterparty, amount, date };
  const clauseSet = (CLAUSES[lang] || CLAUSES.pt || []).map(([n, tt, txt]) => [n, tt, fill(txt, vals)]);
  return {
    scope, kind, template_code: t.code, icon: t.icon || "📄", lang, date,
    title: L(t.name, lang),
    // ── QUEM ASSINA, QUALIFICADO ──────────────────────────────────────────────────────────────
    // Antes era só um NOME ("Tribeca Global Inc. · Guileo"). Contrato sem qualificação da parte
    // parece completo e não identifica ninguém: na hora de cobrar, um nome solto sem registro e sem
    // endereço é alegação, não parte. A ironia é que os modelos que a Guileo VENDE pro cliente usar
    // com o consumidor dele já pedem [CNPJ]/[TAX ID]/[ENDEREÇO] — só o contrato da própria casa não
    // tinha. Agora a entidade certa entra pelo idioma (pt → ORIGEM LTDA; en/es → a Inc.) e a linha
    // de qualificação imprime SÓ o que existe de verdade: enquanto faltar CNPJ ou endereço, o
    // documento fica incompleto de forma visível, nunca completo e errado.
    provider: (() => {
      const e = provider.entidade || entidadePorIdioma(lang);
      return {
        name: provider.name || `${e.razaoSocial}${e.fantasia ? " · " + e.fantasia : ""}`,
        qualificacao: qualificacao(e, lang),
        pendencias: pendencias(e),   // fica gravado no snapshot: dá pra auditar o que faltava no dia
        entidade_id: e.id,
        ...provider,
      };
    })(),
    counterparty,
    summary: L(t.summary, lang),
    deliverables: scope === "guileo_client" ? (L(t.deliverables, lang) || []).map((d) => fill(d, vals)) : null,
    timeline: scope === "guileo_client" ? fill(L(t.timeline, lang), vals) : null,
    // ⚠️ UM CONTRATO NÃO PODE TER DOIS PREÇOS (2026-08-17).
    // Os modelos de plano (GUI-ESSENTIAL/PRO/FULL) cravam o preço de tabela no campo de pagamento
    // — "US$ 449/mês. Garantia de 30 dias…". Quando o vendedor fecha um valor NEGOCIADO, o
    // documento saía com o preço de tabela no pagamento E o valor real no total: dois números
    // diferentes no mesmo instrumento, que é convite a disputa e some com a força do contrato.
    // (Encontrado gerando o 1º documento de verdade — o mesmo defeito de preço-âncora que já tinha
    // feito a agente cotar $118 de outro serviço numa ligação real.)
    // Quando há valor explícito, ele MANDA: a cifra da frente é trocada e o resto — que carrega a
    // garantia de 30 dias — fica intacto. Sem valor explícito, o preço de tabela continua valendo,
    // que é o comportamento certo pra quem só quer o plano padrão.
    payment: scope === "guileo_client" ? precoUnico(fill(L(t.payment, lang), vals), amount) : null,
    bodyText: scope === "client_customer" ? fill(L(t.body, lang), vals) : null,
    amount,
    clauses: kind === "quote" ? null : clauseSet,
    quoteIntro: kind === "quote" ? fill(L(QUOTE.intro, lang), vals) : null,
    quoteTerms: kind === "quote" ? (L(QUOTE.terms, lang) || []) : null,
    disclaimer: L(DISCLAIMER, lang),
  };
}
