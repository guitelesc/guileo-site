// Contract/quote BODY builder — turns a (scope, template, language, counterparty) into the frozen
// JSON snapshot stored in the `contracts` row and rendered by <ContractDoc>. Trilingual (pt|en|es).
import { CLAUSES, GUILEO_CLIENT, CLIENT_CUSTOMER, QUOTE, DISCLAIMER } from "../data/contractTemplates.js";

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

export function buildBody({ scope = "guileo_client", code, lang = "pt", kind = "contract", provider = {}, counterparty = {}, amount = "" } = {}) {
  const t = findTemplate(scope, code);
  const date = new Date().toLocaleDateString(lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US");
  const vals = { counterparty, amount, date };
  const clauseSet = (CLAUSES[lang] || CLAUSES.pt || []).map(([n, tt, txt]) => [n, tt, fill(txt, vals)]);
  return {
    scope, kind, template_code: t.code, icon: t.icon || "📄", lang, date,
    title: L(t.name, lang),
    provider: { name: provider.name || "Tribeca Global Inc. · Guileo", ...provider },
    counterparty,
    summary: L(t.summary, lang),
    deliverables: scope === "guileo_client" ? (L(t.deliverables, lang) || []) : null,
    timeline: scope === "guileo_client" ? L(t.timeline, lang) : null,
    payment: scope === "guileo_client" ? L(t.payment, lang) : null,
    bodyText: scope === "client_customer" ? fill(L(t.body, lang), vals) : null,
    amount,
    clauses: kind === "quote" ? null : clauseSet,
    quoteIntro: kind === "quote" ? fill(L(QUOTE.intro, lang), vals) : null,
    quoteTerms: kind === "quote" ? (L(QUOTE.terms, lang) || []) : null,
    disclaimer: L(DISCLAIMER, lang),
  };
}
