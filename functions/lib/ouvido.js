// functions/lib/ouvido.js — O OUVIDO DA AGENTE (2026-09-28)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE EXISTE: o Luis pediu Botox por telefone e o reconhecimento de fala entregou "bath". A
// Lilian respondeu "we do not offer baths" — negou um serviço de US$12/unidade por causa de um ruído.
// O agente vivo tinha `asr.keywords: []`: o ouvido nunca soube que palavras este negócio vende.
//
// COMO ESCOLHE (sem adivinhar): de um vocabulário de termos DIFÍCEIS DE OUVIR (marca, técnica, nome
// estrangeiro), entram só os que APARECEM no texto do próprio cliente — treino (KB) e tabela de
// preços. Spa que não faz Kybella não ganha "Kybella"; encanador não ganha "balayage". Somam-se as
// palavras dos nomes dos serviços do catálogo e o nome do negócio e da agente.
const VOCABULARIO = [
  // estética médica
  "Botox", "Xeomin", "Dysport", "Juvederm", "Restylane", "Sculptra", "Radiesse", "Kybella", "PRP",
  "CoolSculpting", "neurotoxin", "filler", "microneedling", "microchanneling", "dermaplane", "HydraFacial",
  "microdermabrasion", "cavitation", "lymphatic",
  // salão e spa
  "balayage", "keratin", "Olaplex", "Kerastase", "Eminence", "microblading", "lamination", "threading",
  "waxing", "blowout", "highlights", "acupuncture", "reflexology", "Swedish",
  // saúde / odonto / casa (os outros verticais da casa)
  "Invisalign", "veneers", "whitening", "chiropractic", "HVAC", "drywall", "backsplash",
];
const COMUNS = new Set(["with", "from", "this", "that", "your", "free", "full", "mini", "team", "para", "como", "with", "session", "sessions", "treatment", "minutes"]);

/** palavrasDoOuvido({ textos: [kb…], precos: "Nome — $X\n…", nomes: [negócio, agente] }) → até `max` palavras únicas. */
export function palavrasDoOuvido({ textos = [], precos = "", nomes = [], max = 40 } = {}) {
  const tabela = (precos || "").toString();
  const tudo = [...textos.map((t) => (t || "").toString()), tabela].join("\n");
  const baixo = tudo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const out = []; const visto = new Set();
  const poe = (w) => { const k = w.toLowerCase(); if (w.length < 3 || visto.has(k) || out.length >= max) return; visto.add(k); out.push(w); };
  // 1) o que é difícil de ouvir E este negócio menciona
  for (const v of VOCABULARIO) if (new RegExp(`(^|[^a-z])${v.toLowerCase()}([^a-z]|$)`).test(baixo)) poe(v);
  // 2) nome do negócio e da agente (nome próprio é o que o ouvido mais erra)
  for (const n of nomes) for (const w of (n || "").toString().split(/[^\p{L}]+/u)) if (w.length >= 4 && !COMUNS.has(w.toLowerCase())) poe(w);
  // 3) palavras dos nomes dos serviços — a tabela vem de formatPrices: uma linha "Nome — preço" por serviço
  for (const linha of tabela.split("\n")) {
    const nome = linha.split(" — ")[0] || "";
    for (const w of nome.split(/[^\p{L}]+/u)) if (w.length >= 5 && !COMUNS.has(w.toLowerCase())) poe(w);
  }
  return out;
}
