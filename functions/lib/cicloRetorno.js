// DE QUANTO EM QUANTO TEMPO CADA SERVIÇO PEDE UMA VOLTA (2026-09-30)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// O lembrete de volta lê `biz_services.config.rebook_days` — e nada gravava esse campo. Todo
// serviço caía em 28 dias: Botox (que dura 3–4 meses) e corte de cabelo no mesmo relógio, e uma
// consulta grátis ganhando "hora de voltar".
//
// Isto é a SUGESTÃO inicial, pelo nome do serviço. Ela não decide nada sozinha: o valor é gravado
// no cadastro do serviço, aparece na tela do dono e ele muda quando quiser. 0 = nunca lembrar.
// Na dúvida a resposta é 0 — um lembrete que não sai custa menos que um lembrete errado com o nome
// do spa em cima.
//
// A ORDEM IMPORTA: a primeira regra que casa vence, então o específico vem antes do genérico
// ("facial + microdermabrasion" precisa cair em facial, "lash fill" antes de "lashes").
const REGRAS = [
  // sem volta: consulta, avaliação, pacote e tratamento com plano definido pelo profissional
  [0, /\b(consult\w*|avalia[cç][aã]o|evaluaci[oó]n|assessment|package|pacote|paquete|gift\s*card|vale[- ]presente|voucher)\b/],
  [0, /\b(coolsculpt\w*|kybella|prp|sculptra|vampire)\b/],
  // injetáveis
  [90, /\b(botox|dysport|xeomin|jeuveau|daxxify|neurotoxin\w*|toxina)\b/],
  [180, /\b(filler\w*|preenchimento|relleno|juvederm|restylane|lip\s*(flip|filler))\b/],
  // laser e depilação
  [35, /\b(laser)\b/],
  [28, /\b(wax\w*|depila\w*|sugaring|thread\w*|brow\w*|sobrancelha\w*|cejas?)\b/],
  // cílios
  [21, /\b(lash\w*|c[ií]lios|pesta[nñ]as?)\b/],
  // pele
  [28, /\b(facial\w*|hydrafacial|microderm\w*|microneedling|peel\w*|limpeza|limpieza|pore|dermaplan\w*)\b/],
  // corpo
  [14, /\b(acupunct\w*|acupuntura)\b/],
  [28, /\b(massage\w*|massagem|masaje|deep\s*tissue|swedish|drenagem|drenaje|lymphatic|reflexolog\w*|body\s*(scrub|wrap))\b/],
  // cabelo — cor antes de corte ("cut & color" segue o relógio da cor)
  [49, /\b(colou?r\w*|colora[cç][aã]o|tintura?|tinte|highlight\w*|balayage|luzes|mechas|gloss|root\w*|raiz)\b/],
  [35, /\b(barber\w*|barba|beard|fade)\b/],
  [42, /\b(haircut\w*|hair\s*cut|corte|trim)\b/],
  // unhas
  [21, /\b(manicure\w*|pedicure\w*|mani|pedi|nail\w*|unha\w*|u[nñ]as|gel|acrylic\w*)\b/],
];

const semAcento = (s) => (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Dias sugeridos para a volta de um serviço, pelo nome. 0 = não lembrar. */
export function cicloSugerido(nome) {
  const n = semAcento(nome);
  if (!n.trim()) return 0;
  for (const [dias, rx] of REGRAS) if (rx.test(n)) return dias;
  return 0;
}

/**
 * Para uma lista de serviços [{id,name,days}], devolve só os que AINDA não têm ciclo definido
 * (days == null), com a sugestão — inclusive a sugestão 0, que também é uma decisão a gravar.
 * Quem já tem valor (mesmo 0) foi decidido por alguém e não é tocado.
 */
export function sugestoesParaOsSemCiclo(servicos) {
  return (Array.isArray(servicos) ? servicos : [])
    .filter((s) => s && s.id && (s.days === null || s.days === undefined))
    .map((s) => ({ id: s.id, name: s.name || "", days: cicloSugerido(s.name) }));
}
