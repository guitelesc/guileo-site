// src/lib/intl.js — tiny, dependency-free input-internationalization helpers.
// Markets: US first + Brazil + Spanish-speaking US. No locale libs, no data downloads.
//
// Philosophy: NEVER silently reject a phone number. When we have to guess the country,
// we guess, return ok:true, and expose a human `hint` ("assumimos Brasil +55 — confere?")
// so the visitor can correct us instead of being blocked.

const HINTS = {
  br: {
    en: "we assumed Brazil +55 — is that right?",
    pt: "assumimos Brasil +55 — confere?",
    es: "asumimos Brasil +55 — ¿correcto?",
    hi: "हमने Brazil +55 माना — सही है?",
  },
  us: {
    en: "we assumed US +1 — is that right?",
    pt: "assumimos EUA +1 — confere?",
    es: "asumimos EE. UU. +1 — ¿correcto?",
    hi: "हमने US +1 माना — सही है?",
  },
  cc: {
    en: "couldn't detect the country — if this looks wrong, add a code like +1 or +55",
    pt: "não deu pra detectar o país — se estiver errado, inclua o código, ex.: +1 ou +55",
    es: "no pudimos detectar el país — si está mal, agrega el código, ej.: +1 o +55",
    hi: "देश का पता नहीं चला — गलत लगे तो +1 या +91 जैसा कोड जोड़ें",
  },
};
const hintFor = (key, lang) => HINTS[key][lang] || HINTS[key].en;

// A US/Canada number typed with its leading 1: "1" + area code 2-9… . Anything 11-digit that
// fails this can't be NANP (BR mobiles like 11 91234-5678 start with "11" and would false-match
// a naive startsWith("1") check — São Paulo's area code IS 1x).
const isNanp11 = (d) => /^1[2-9]\d{9}$/.test(d);

/**
 * Normalize a raw phone string to E.164 (best effort, no metadata tables).
 * Rules, in order:
 *   1. starts with "+"                          → trust it as-is (any lang)
 *   2. valid NANP with leading 1 (1[2-9]…, 11d) → +1XXXXXXXXXX + "assumed US" hint
 *   3. lang 'pt', 12-13 digits starting "55"    → +55… (BR typed with country code, no +)
 *   4. lang 'pt', 10-11 digits                  → +55… (BR landline/mobile) + "assumed BR" hint
 *   5. 10 digits                                → +1…  (US default market)  + "assumed US" hint
 *   6. anything else                            → "+"+digits, ok:true, "add a code" hint
 * @returns {{e164: string, ok: boolean, hint: string}}
 */
export function normalizePhone(raw, lang = "en") {
  const s = String(raw || "").trim();
  const digits = s.replace(/\D/g, "");
  if (!digits) return { e164: "", ok: false, hint: "" };
  if (s.startsWith("+")) return { e164: "+" + digits, ok: true, hint: "" };
  if (isNanp11(digits)) return { e164: "+" + digits, ok: true, hint: hintFor("us", lang) };
  if (lang === "pt") {
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return { e164: "+" + digits, ok: true, hint: hintFor("br", lang) };
    if (digits.length === 10 || digits.length === 11) return { e164: "+55" + digits, ok: true, hint: hintFor("br", lang) };
  }
  if (digits.length === 10) return { e164: "+1" + digits, ok: true, hint: hintFor("us", lang) };
  // Ambiguous — never silently reject: keep the digits and softly ask for a country code.
  return { e164: "+" + digits, ok: true, hint: hintFor("cc", lang) };
}

/**
 * Same as normalizePhone but for inputs that sit next to an explicit country-code <select>
 * (LiveCall). The selected code IS the country code, so no assumption (and no hint) is needed —
 * EXCEPT when the typed number can't belong to it: a PT visitor typing an 11-digit Brazilian
 * mobile while the selector still shows the +1 default gets rescued to +55, with the hint.
 */
export function normalizePhoneWithCc(raw, cc, lang = "en") {
  const s = String(raw || "").trim();
  const digits = s.replace(/\D/g, "");
  if (!digits) return { e164: "", ok: false, hint: "" };
  if (s.startsWith("+")) return normalizePhone(s, lang); // typed their own code — it wins over the select
  if (cc === "+1") {
    if (isNanp11(digits)) return { e164: "+" + digits, ok: true, hint: "" }; // typed the 1 again
    // 11 digits (or 10 with a 0/1 "area code") can't be NANP → almost certainly a BR number
    // typed by a PT visitor who didn't touch the +1 default. Rescue it, say so.
    if (lang === "pt" && (digits.length === 11 || (digits.length === 10 && /^[01]/.test(digits)))) {
      return { e164: "+55" + digits, ok: true, hint: hintFor("br", lang) };
    }
  }
  if (cc === "+55" && digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return { e164: "+" + digits, ok: true, hint: "" }; // typed the 55 again
  }
  return { e164: cc + digits, ok: true, hint: "" };
}

/** Locale-aware phone placeholder. PT shows BOTH formats — Brazilians in the US are a real segment. */
export function phonePlaceholder(lang = "en") {
  if (lang === "pt") return "+55 (11) 91234-5678 ou +1 917…";
  if (lang === "es") return "+1 (305) 123-4567";
  return "+1 (555) 123-4567";
}

/**
 * Format a USD amount for display. Pricing IS in dollars everywhere; for 'pt' we render
 * "US$ 149" because Brazilians read a bare "$" as R$ — a real, costly confusion.
 * Other langs keep "$149". Thousands separator follows the locale (pt: 1.000 / en-es-US: 1,000).
 */
export function fmtMoneyUSD(n, lang = "en") {
  const num = Number(n) || 0;
  const locale = lang === "pt" ? "pt-BR" : "en-US";
  let s;
  try {
    s = num.toLocaleString(locale, { maximumFractionDigits: Number.isInteger(num) ? 0 : 2 });
  } catch {
    s = String(num);
  }
  return lang === "pt" ? `US$ ${s}` : `$${s}`;
}
