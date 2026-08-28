// src/data/langs.js — A FONTE ÚNICA DOS IDIOMAS QUE A GUI FALA.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Todo idioma que a agente DETECTA e RESPONDE numa ligação. Distinto dos 4 idiomas do portal
// (EN·PT·ES·HI): o dono lê o painel em 4, mas a Gui dele atende o telefone em todos estes.
//
// POR QUE ESTE ARQUIVO EXISTE (2026-08-28): a lista morava em functions/lib/provision.js e era
// COPIADA À MÃO em src/components/OnboardWizard.jsx (LANG_OPTS) e citada em src/data/agentVoices.js.
// O comentário da cópia contava a própria história: em 05/08 quatro idiomas saíram da lista do
// servidor porque a ElevenLabs não os fala, e alguém teve que lembrar de tirá-los da cópia também.
// Uma lista mantida em dois lugares não é uma lista — são duas verdades esperando divergir, e a
// que diverge em silêncio oferece no cadastro um idioma que a agente nunca vai falar.
//
// Fica em src/data/ (e não em functions/lib/) por um motivo prático: o navegador precisa dela na
// tela de campanhas e no cadastro. Importar provision.js no cliente arrastaria a constituição, as
// lições e o playbook de upsell pro bundle. Aqui o servidor importa daqui — nunca o contrário.
//
// 🚨 SÓ ENTRA IDIOMA QUE A PLATAFORMA DE VOZ REALMENTE FALA. A ElevenLabs aceita uma lista fechada;
// pedir um de fora derruba a configuração INTEIRA do agente com "Preset languages must be one of …
// but got pa, yue, bn, ht" (visto em 2026-08-05). Cantonês, crioulo haitiano, bengali e punjabi
// ESTAVAM aqui e não são suportados — a gente prometia no site um idioma que a agente nunca
// conseguiu falar. Se um dia entrarem no catálogo, basta voltar a linha aqui e TUDO acompanha.
//
// Ordenados por relevância no mercado de imigrante dos EUA.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

export const LANGS_SPOKEN = [
  { code: "en", label: "English",          native: "English",     flag: "🇺🇸" },
  { code: "es", label: "Spanish",          native: "Español",     flag: "🇪🇸" },
  { code: "pt", label: "Portuguese",       native: "Português",   flag: "🇧🇷" },
  { code: "hi", label: "Hindi",            native: "हिन्दी",         flag: "🇮🇳" },
  { code: "zh", label: "Mandarin Chinese", native: "中文",         flag: "🇨🇳" },
  { code: "ru", label: "Russian",          native: "Русский",     flag: "🇷🇺" },
  { code: "ko", label: "Korean",           native: "한국어",        flag: "🇰🇷" },
  { code: "fr", label: "French",           native: "Français",    flag: "🇫🇷" },
  { code: "ar", label: "Arabic",           native: "العربية",       flag: "🇸🇦" },
  { code: "vi", label: "Vietnamese",       native: "Tiếng Việt",  flag: "🇻🇳" },
  { code: "tl", label: "Tagalog",          native: "Tagalog",     flag: "🇵🇭" },
  { code: "de", label: "German",           native: "Deutsch",     flag: "🇩🇪" },
  { code: "it", label: "Italian",          native: "Italiano",    flag: "🇮🇹" },
  { code: "pl", label: "Polish",           native: "Polski",      flag: "🇵🇱" },
  { code: "ja", label: "Japanese",         native: "日本語",        flag: "🇯🇵" },
  { code: "uk", label: "Ukrainian",        native: "Українська",  flag: "🇺🇦" },
];

/** Códigos válidos, pra validar entrada sem varrer o array toda vez. */
export const LANG_CODES = new Set(LANGS_SPOKEN.map((l) => l.code));

/** Busca por código. Devolve null pro que não existe — nunca um objeto vazio que finge existir. */
export function lang(code) {
  const c = String(code || "").toLowerCase().slice(0, 2);
  return LANGS_SPOKEN.find((l) => l.code === c) || null;
}

/** "🇧🇷 Português" — o rótulo curto que as telas mostram. Idioma desconhecido devolve o código cru. */
export function rotuloIdioma(code) {
  const l = lang(code);
  return l ? `${l.flag} ${l.native}` : String(code || "");
}

/**
 * A lista na ordem que as telas do Luis usam: os 4 do portal primeiro (são os que ele e os
 * clientes brasileiros escolhem em 95% dos cadastros), o resto na ordem de mercado.
 * DERIVADA, não copiada: idioma que sair de LANGS_SPOKEN some daqui sozinho.
 */
export const UI_LANGS = ["pt", "en", "es", "hi"];
export const LANGS_ORDENADOS = [
  ...UI_LANGS.map((c) => lang(c)).filter(Boolean),
  ...LANGS_SPOKEN.filter((l) => !UI_LANGS.includes(l.code)),
];
