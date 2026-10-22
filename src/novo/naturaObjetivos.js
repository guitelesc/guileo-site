/* NATURA — ENTRADA POR OBJETIVO ("What do you need today?") (Luis, 2026-10-05)
   A cliente chega com um objetivo — relaxar, soltar tensão, pele, cabelo, um evento, o Med Spa — e não
   com o nome do serviço. Cada objetivo aponta para serviços que EXISTEM no MENU de NaturaSpa.jsx, com o
   preço "from" calculado do próprio MENU (nada digitado aqui). O teste (naturaObjetivos.test.mjs) lê o
   MENU da página e falha se um nome daqui sumir de lá — serviço inventado não passa.
   É um ACRÉSCIMO: nada do site original sai. */

export const OBJETIVOS = [
  { id: "unwind", nome: "Unwind", sente: "Let the week go — warm hands, a quiet room and nowhere else to be.",
    cat: "body", foto: "g-unwind", alt: "A therapist’s hands on a guest’s temples during a relaxing massage.",
    servicos: ["Natura Spa Signature", "Swedish", "Hot Stone"] },
  { id: "tension", nome: "Ease tension", sente: "Work out the knots in your neck, shoulders and back.",
    cat: "body", foto: "g-tension", alt: "A therapist working on a guest’s shoulders and back.",
    servicos: ["Deep Tissue", "Sports", "Reflexology"], parceiro: 1 },
  { id: "glow", nome: "Glow", sente: "Clean, calm skin that looks rested — from a quick reset to a full ritual.",
    cat: "face", foto: "svc-facial", alt: "A guest relaxing with a facial mask while a therapist massages her face.",
    servicos: ["Natura Spa Signature Facial", "Hydraglowing", "Organic Facial by Eminence"] },
  { id: "hair", nome: "Refresh my hair", sente: "A fresh blowout, softer color or smooth, easy hair for weeks.",
    cat: "hair", foto: "svc-balayage", alt: "Soft blonde balayage waves.",
    servicos: ["Wash + Blow Dry", "Balayage (Partial)", "Brazilian Keratin"] },
  { id: "bigday", nome: "Get ready for a big day", sente: "Hair and makeup that last from the first photo to the last dance.",
    cat: "hair", foto: "svc-bridal-makeup", alt: "Soft bridal makeup with a glowing finish.",
    servicos: ["Up Do", "Make Up", "Bridal Make Up"] },
  { id: "confidence", nome: "Feel more confident", sente: "Botox, fillers and CoolSculpting at our Med Spa — always starting with a free consultation.",
    medspa: true, foto: "med-1", alt: "The calm lounge at Natura Med Spa on the Upper East Side." },
];

/* Preço de um item do MENU numa coluna (1 = Astoria, 2 = Upper East Side) → o menor valor, ou null.
   Formatos do MENU: número · [mín, máx] · { "60 min": 118, … } · null. */
export function menorPreco(p) {
  if (p == null) return null;
  if (typeof p === "number") return p;
  if (Array.isArray(p)) return typeof p[0] === "number" ? p[0] : null;
  if (typeof p === "object") { const v = Object.values(p).filter((x) => typeof x === "number"); return v.length ? Math.min(...v) : null; }
  return null;
}

/* Acha o item pelo nome dentro da categoria (primeiro que casar, como o cardápio mostra). */
export function itemDoMenu(menu, cat, nome) {
  const c = (menu || []).find((x) => x.id === cat);
  for (const g of (c && c.grupos) || []) for (const it of g.itens) if (it[0] === nome) return it;
  return null;
}

/* Os serviços de um objetivo para a unidade escolhida: preço da unidade; se ela não tem, o da outra
   (com o nome da unidade junto, para ninguém chegar na unidade errada). */
export function servicosDoObjetivo(obj, menu, loc) {
  if (!obj || obj.medspa) return [];
  const col = loc === "ues" ? 2 : 1;
  const outra = col === 1 ? 2 : 1;
  return obj.servicos.map((nome) => {
    const it = itemDoMenu(menu, obj.cat, nome);
    if (!it) return null;
    const aqui = menorPreco(it[col]);
    if (aqui != null) return { nome, desde: aqui, so: "" };
    const la = menorPreco(it[outra]);
    return la != null ? { nome, desde: la, so: outra === 1 ? "Astoria" : "Upper East Side" } : null;
  }).filter(Boolean);
}

/* Em qual unidade abrir o cardápio: a escolhida, se ela tem a maioria dos serviços; senão a outra. */
export function unidadeDoObjetivo(obj, menu, loc) {
  if (!obj || obj.medspa) return loc;
  const lista = servicosDoObjetivo(obj, menu, loc);
  const fora = lista.filter((s) => s.so).length;
  if (fora * 2 <= lista.length) return loc === "med" ? "astoria" : loc;
  return loc === "ues" ? "astoria" : "ues";
}
