// src/data/upsellPlaybook.js — SMART UPSELL prompt material (NOT UI copy).
// Short imperative lines Gui weaves into calls: each entry = WHEN trigger → the natural offer.
// Consumed by functions/lib/provision.js (buildGuiPrompt) to append a compact per-vertical
// "## UPSELL" section to every provisioned agent's prompt. en/pt/es. Keep lines SHORT —
// the whole rendered section must stay ≤ 600 chars, so 2-3 lines per vertical, ~90 chars each.

// Keys are matched against the client's free-text `industry` via the keyword lists below.
export const UPSELL_PLAYBOOK = {
  restaurant: {
    match: ["restau", "food", "pizza", "cafe", "bar", "bistro", "comida", "burger", "taco", "sushi"],
    en: [
      "Large pizza/entrée ordered → offer the stuffed crust or a side for a few dollars more.",
      "Order without drinks → suggest a drink or dessert to complete it.",
      "Party of 4+ booking → mention the sharing platter or prix-fixe for groups.",
    ],
    pt: [
      "Pediu pizza grande/prato principal → ofereça borda recheada ou acompanhamento por poucos dólares.",
      "Pedido sem bebida → sugira uma bebida ou sobremesa pra completar.",
      "Reserva de 4+ pessoas → mencione a porção pra compartilhar ou o menu fechado de grupo.",
    ],
    es: [
      "Pidió pizza grande/plato fuerte → ofrece el borde relleno o una guarnición por unos dólares más.",
      "Pedido sin bebida → sugiere una bebida o postre para completar.",
      "Reserva de 4+ personas → menciona el platillo para compartir o el menú de grupo.",
    ],
  },
  clinic: {
    match: ["clinic", "clínic", "dent", "health", "saúde", "salud", "medic", "doctor", "odont"],
    en: [
      "Cleaning booked → gently remind about whitening or a check-up if it's been a while.",
      "New patient → offer to bundle the consultation with the first cleaning.",
    ],
    pt: [
      "Marcou limpeza → lembre com jeito do clareamento ou do check-up se faz tempo.",
      "Paciente novo → ofereça juntar a consulta com a primeira limpeza.",
    ],
    es: [
      "Agendó limpieza → recuerda con tacto el blanqueamiento o el chequeo si hace tiempo.",
      "Paciente nuevo → ofrece combinar la consulta con la primera limpieza.",
    ],
  },
  salon: {
    match: ["salon", "salão", "spa", "hair", "beauty", "barb", "nail", "estét", "beleza"],
    en: [
      "Haircut booked → \"add a deep-conditioning treatment, done in the same visit\".",
      "Color service → suggest the gloss/toner finish that keeps it vibrant longer.",
      "Manicure → offer the matching pedicure at a small combo discount.",
    ],
    pt: [
      "Marcou corte → \"com hidratação fica pronto no mesmo horário\".",
      "Coloração → sugira o gloss/matizador que segura a cor por mais tempo.",
      "Manicure → ofereça o pé junto com um descontinho de combo.",
    ],
    es: [
      "Agendó corte → \"con hidratación queda listo en la misma cita\".",
      "Color → sugiere el gloss/matizador que mantiene el color más tiempo.",
      "Manicura → ofrece la pedicura juntas con un pequeño descuento.",
    ],
  },
  plumbing: {
    match: ["plumb", "hvac", "encanad", "plomer", "electric", "elétric", "handyman", "repair", "conserto"],
    en: [
      "Repair booked → offer the annual maintenance plan so this doesn't happen again.",
      "Emergency fix → suggest a whole-system inspection while the tech is already there.",
    ],
    pt: [
      "Agendou conserto → ofereça o plano de manutenção anual pra não acontecer de novo.",
      "Emergência → sugira a inspeção geral já que o técnico vai estar lá.",
    ],
    es: [
      "Agendó reparación → ofrece el plan de mantenimiento anual para que no se repita.",
      "Emergencia → sugiere la inspección general ya que el técnico estará ahí.",
    ],
  },
  gym: {
    match: ["gym", "fitness", "academia", "gimnasio", "crossfit", "pilates", "yoga", "trainer"],
    en: [
      "Class/trial booked → mention the personal-training intro pack.",
      "Membership question → offer the family/partner plan upgrade.",
    ],
    pt: [
      "Marcou aula/experimental → mencione o pacote inicial de personal.",
      "Perguntou de plano → ofereça o upgrade pro plano família/dupla.",
    ],
    es: [
      "Agendó clase/prueba → menciona el paquete inicial de entrenador personal.",
      "Preguntó por planes → ofrece el upgrade al plan familiar/pareja.",
    ],
  },
  auto: {
    match: ["auto", "car", "carro", "mechanic", "mecânic", "mecánic", "oficina", "dealership", "tire", "oil"],
    en: [
      "Oil change booked → offer tire rotation or the multi-point inspection same visit.",
      "Repair quote → mention the detailing/wash add-on while the car is in.",
    ],
    pt: [
      "Marcou troca de óleo → ofereça rodízio de pneus ou a revisão geral na mesma visita.",
      "Orçamento de conserto → mencione a lavagem/estética já que o carro vai estar lá.",
    ],
    es: [
      "Agendó cambio de aceite → ofrece rotación de llantas o la revisión general en la misma visita.",
      "Cotización de reparación → menciona el lavado/detallado ya que el auto estará ahí.",
    ],
  },
  law: {
    match: ["law", "legal", "advoca", "abogad", "attorney", "jurídic", "juridic"],
    en: [
      "Consultation booked → mention the flat-fee document-review add-on.",
      "One matter resolved → offer a quick check of related documents (will, contracts).",
    ],
    pt: [
      "Marcou consulta → mencione a revisão de documentos por preço fixo.",
      "Resolveu um assunto → ofereça revisar documentos ligados (testamento, contratos).",
    ],
    es: [
      "Agendó consulta → menciona la revisión de documentos por tarifa fija.",
      "Resolvió un asunto → ofrece revisar documentos relacionados (testamento, contratos).",
    ],
  },
  realestate: {
    match: ["real estate", "imobili", "inmobili", "realtor", "property", "imóve", "inmueble"],
    en: [
      "Showing booked → offer the free valuation of their current home.",
      "Buyer inquiry → mention the mortgage pre-approval partner to move faster.",
    ],
    pt: [
      "Marcou visita → ofereça a avaliação grátis do imóvel atual deles.",
      "Comprador interessado → mencione o parceiro de pré-aprovação pra agilizar.",
    ],
    es: [
      "Agendó visita → ofrece la valuación gratis de su propiedad actual.",
      "Comprador interesado → menciona el socio de pre-aprobación hipotecaria para avanzar rápido.",
    ],
  },
  education: {
    match: ["educa", "school", "escola", "escuela", "tutor", "course", "curso", "class", "aula"],
    en: [
      "One subject enrolled → suggest the sibling/second-subject discount.",
      "Trial class booked → mention the monthly package that lowers the per-class price.",
    ],
    pt: [
      "Matriculou numa matéria → sugira o desconto de irmão/segunda matéria.",
      "Aula experimental → mencione o pacote mensal que baixa o preço por aula.",
    ],
    es: [
      "Inscribió una materia → sugiere el descuento de hermano/segunda materia.",
      "Clase de prueba → menciona el paquete mensual que baja el precio por clase.",
    ],
  },
  retail: {
    match: ["commerce", "shop", "store", "loja", "tienda", "retail", "boutique", "market"],
    en: [
      "Item ordered → suggest the accessory/refill that goes with it.",
      "Big purchase → mention free delivery or the care/warranty add-on.",
    ],
    pt: [
      "Pediu um item → sugira o acessório/refil que combina com ele.",
      "Compra grande → mencione a entrega grátis ou a garantia estendida.",
    ],
    es: [
      "Pidió un artículo → sugiere el accesorio/repuesto que lo acompaña.",
      "Compra grande → menciona el envío gratis o la garantía extendida.",
    ],
  },
};

// Generic fallback when the industry matches nothing — still gives Gui one natural motion.
const GENERIC = {
  en: ["Service booked → offer ONE related add-on or the recurring plan, only if natural."],
  pt: ["Serviço fechado → ofereça UM adicional ligado ou o plano recorrente, só se for natural."],
  es: ["Servicio agendado → ofrece UN adicional relacionado o el plan recurrente, solo si es natural."],
};

// Lines for a client's industry+lang. Always returns a non-empty array.
export function upsellLinesFor(industry, lang) {
  const ind = (industry || "").toString().toLowerCase();
  const L = ["pt", "es", "en"].includes(lang) ? lang : "en";
  for (const key of Object.keys(UPSELL_PLAYBOOK)) {
    const v = UPSELL_PLAYBOOK[key];
    if (v.match.some((m) => ind.includes(m))) return v[L] || v.en;
  }
  return GENERIC[L] || GENERIC.en;
}

// The compact prompt section (≤ 600 chars) appended to buildGuiPrompt.
export function upsellSection(industry, lang) {
  const lines = upsellLinesFor(industry, lang).slice(0, 3);
  let out = `## UPSELL — offer naturally, never pushy, max once per call\n${lines.map((l) => `• ${l}`).join("\n")}`;
  if (out.length > 600) out = out.slice(0, 597) + "…";
  return out;
}
