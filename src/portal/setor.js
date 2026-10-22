// setor.js — texto livre do cadastro → um ramo que a Central conhece.
//
// O cadastro guarda o ramo como o vendedor escreveu: "salon", "hair salon", "dental clinic",
// "restaurante", "agência de viagens…". A Central tem 12 ramos com menu próprio. Sem esta ponte,
// quem chegava pelo link de acesso (e por isso pulava o assistente) ficava no ramo padrão —
// dona de spa com menu de restaurante (2026-09-28).
//
// ⚠️ SEM CORRESPONDÊNCIA → null. Adivinhar ramo é pior que manter o que está: o menu errado
// esconde a tela que o cliente precisa. Ordem importa: o mais específico antes.
import { VERTICALS } from "../data/verticals.js";

const REGRAS = [
  // "educação médica" é ESCOLA, não consultório: ensino vem antes de saúde.
  ["education", /school|education|educa|course|curso|tutor|preparat/],
  ["clinic", /dental|dentist|odont|clinic|cl[ií]nica/],
  ["medical", /medical|m[eé]dic|doctor|health|sa[uú]de/],
  ["salon", /salon|sal[aã]o|\bspa\b|hair|beauty|beleza|barber|nail|lash|est[eé]tica/],
  ["restaurant", /restaurant|restaurante|caf[eé]|bakery|padaria|pizz|food|\bbar\b|bistr/],
  ["law", /\blaw\b|legal|attorney|advoc|jur[ií]d/],
  ["realestate", /real ?estate|imobili|realtor|broker|corretor/],
  ["gym", /\bgym\b|fitness|academia|pilates|yoga|crossfit/],
  ["homeservices", /plumb|hvac|electric|cleaning|home ?service|encanad|eletricist|limpeza|landscap|roof/],
  ["auto", /\bauto|\bcar\b|mechanic|mec[aâ]nic|oficina|dealership/],
  ["construction", /construct|constru|contractor|remodel|reforma/],
  ["ecommerce", /e-?commerce|\bstore\b|\bloja\b|\bshop\b|retail/],
];

export function setorParaVertical(setor) {
  const t = (setor || "").toString().trim().toLowerCase();
  if (!t) return null;
  if (VERTICALS[t]) return t;                       // já é um id nosso ("salon")
  for (const [id, re] of REGRAS) if (re.test(t) && VERTICALS[id]) return id;
  return null;
}
