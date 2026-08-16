// functions/lib/agendaCenarios.js — A BATERIA DE CENÁRIOS DE AGENDAMENTO (sem rede, sem banco).
//
// POR QUE ISTO EXISTE
// ═══════════════════
// Em 2026-08-16 o banco mostrou o número que importa: de 9 ligações reais em que a pessoa QUERIA
// marcar, 1 virou agendamento (GUI-42F0). Duas causas foram corrigidas no mesmo dia — o resolvedor
// conjunto de serviço+unidade (bizMatch.js) e a leitura da hora falada (slotResolver.js) — mas só
// UMA ligação real rodou depois do conserto. Uma ligação não é uma taxa: é uma anedota.
//
// Um conserto provado por uma amostra de tamanho 1 é indistinguível de sorte. Esta bateria existe
// para transformar aquele 1/9 em algo que dá para MEDIR antes de o telefone tocar: cada cenário é
// um negócio inteiro (unidades, serviços, profissionais, agenda) + o que a pessoa falou + o
// desfecho que a plataforma DEVE produzir. Roda em milissegundos, sem Supabase, sem ElevenLabs.
//
// O QUE ESTE ARQUIVO É — E O QUE ELE NÃO É (leia antes de confiar nele)
// ════════════════════════════════════════════════════════════════════
// `decidirAgenda` é um ESPELHO da ordem de decisão de functions/api/agent-schedule.js, não o
// código de produção. O endpoint é um handler de Cloudflare que faz `fetch` em RPC a cada passo —
// não dá para importar sem rede. Então:
//   • o miolo de decisão vem dos módulos REAIS: resolveServicoLocal (bizMatch.js), resolveSlot e
//     oQueAPessoaDisse (slotResolver.js). Se eles regredirem, os cenários caem de verdade.
//   • o que é cópia — a ORDEM dos ifs e a função `pick` do profissional — está marcado, e o teste
//     agendaCenarios.test.mjs LÊ o agent-schedule.js e falha se a cópia divergir do original.
//     Espelho que ninguém confere vira mentira em duas semanas; este avisa quando desalinha.
//   • `vagas()` imita o que o biz_availability devolve (filtra por serviço, unidade e
//     profissional). É modelo, não o motor SQL: um defeito DENTRO do biz_availability não aparece
//     aqui. O que aparece é a costura — que é exatamente onde as 8 ligações morreram.
//
// A REGRA DE OURO DO DINHEIRO, que cada cenário protege por um dos dois lados:
//   • NEGAR horário que existe → a pessoa desliga e liga pro concorrente, e o painel registra a
//     ligação como "sucesso". É o defeito mais caro que este produto pode ter.
//   • PERGUNTAR o que já sabemos → a pessoa desiste no meio do interrogatório. Perguntar "qual
//     unidade?" a um negócio de uma unidade só é queimar a ligação com uma pergunta cuja resposta
//     o sistema já tinha.

import { resolveServicoLocal } from "./bizMatch.js";
import { resolveSlot, oQueAPessoaDisse } from "./slotResolver.js";

// ── CÓPIA VIGIADA ───────────────────────────────────────────────────────────────────────────────
// `pick` é o resolvedor do PROFISSIONAL em agent-schedule.js (o serviço e a unidade já saem juntos
// pelo bizMatch). Copiado byte a byte de propósito, e o texto original mora em FONTE_PICK para o
// teste comparar com o arquivo de produção. Se alguém mudar lá e não aqui, o teste grita.
const norm = (s) => (s || "").toString().trim().toLowerCase();
const pick = (arr, name) => {
  const lista = Array.isArray(arr) ? arr : [];
  if (!name) return lista.length === 1 ? lista[0] : null;
  const n = norm(name);
  return lista.find((x) => norm(x.name) === n) || lista.find((x) => norm(x.name).includes(n) || n.includes(norm(x.name))) || (lista.length === 1 ? lista[0] : null);
};
// O MESMO texto que tem que existir dentro de functions/api/agent-schedule.js.
export const FONTE_PICK = `const pick = (arr, name) => {
  const lista = Array.isArray(arr) ? arr : [];
  if (!name) return lista.length === 1 ? lista[0] : null;
  const n = norm(name);
  return lista.find((x) => norm(x.name) === n) || lista.find((x) => norm(x.name).includes(n) || n.includes(norm(x.name))) || (lista.length === 1 ? lista[0] : null);
};`;

// Marcas da ORDEM de decisão que o espelho reproduz. O teste confere que cada uma continua no
// endpoint. Não provam que a ordem está certa — provam que ela não mudou embaixo do espelho.
export const MARCAS_ORDEM = [
  // 1) serviço e unidade saem JUNTOS, antes de qualquer op
  "resolveServicoLocal(services, locations, pros, b.service, b.location)",
  // 2) serviço não identificado → pergunta o serviço (nunca chuta)
  "if (!svc) return json({ message: servicoIndefinidoMsg",
  // 3) duas unidades possíveis → pergunta a unidade, nas 3 ops que escolhem horário
  'unidadesPossiveis.length > 1 && (op === "availability" || op === "book" || op === "recurring")',
  // 4) o horário falado SEMPRE passa pelo resolvedor (nunca Date.parse cru)
  "resolveSlot(startIso, av.slots || [], bizTz)",
  // 5) o motivo da recusa tem que ser verdade: não disse dia nem hora ≠ horário ocupado
  "oQueAPessoaDisse(startIso, bizTz, av.slots || [])",
];

// ── FUSO: gerar horários de agenda que o resolveSlot enxergue como "amanhã às 10" ───────────────
// Os cenários precisam de horários RELATIVOS a agora (o resolveSlot resolve "amanhã" contra o
// relógio). Gerar `new Date(...+86400000)` e fingir que é 10h local é o tipo de valor interpretado
// que já custou caro: em Nova York isso vira 6h da manhã. Aqui o deslocamento do fuso é MEDIDO no
// instante certo, e o teste confere o resultado com Intl antes de usar.
function deslocamentoMs(tz, quando) {
  const carimbo = (fuso) => {
    const p = new Intl.DateTimeFormat("sv-SE", {
      timeZone: fuso, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    }).format(quando);
    return Date.parse(p.replace(" ", "T") + "Z");
  };
  return carimbo("UTC") - carimbo(tz);
}

/** ISO do instante que, no fuso do negócio, é `dias` à frente de hoje às hora:minuto. */
export function horarioLocal(tz, dias, hora, minuto = 0) {
  const base = new Date(Date.now() + dias * 86400000);
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(base).split("-").map(Number);
  const ingenuo = Date.UTC(y, m - 1, d, hora, minuto);
  // duas passadas: a primeira usa o deslocamento de "agora", a segunda o do instante já corrigido
  // (dia de virada de horário de verão muda o deslocamento no meio do caminho).
  let t = ingenuo + deslocamentoMs(tz, new Date(ingenuo));
  t = ingenuo + deslocamentoMs(tz, new Date(t));
  return new Date(t).toISOString();
}

// ── O MODELO DA AGENDA ──────────────────────────────────────────────────────────────────────────
// Imita o que o biz_availability devolve para (p_service_id, p_location_id, p_pro_id): só horários
// de um profissional que FAZ aquele serviço e TRABALHA naquela unidade. `service_ids` no slot é
// opcional e existe para negócios cujo mesmo profissional tem grade separada por serviço (o
// restaurante não serve jantar ao meio-dia).
export function vagas(negocio, svcId, locId, proId) {
  const pros = negocio.pros || [];
  return (negocio.agenda || []).filter((s) => {
    const p = pros.find((x) => String(x.id) === String(s.pro_id));
    if (!p) return false;
    if (!(p.services || []).map(String).includes(String(svcId))) return false;
    if (!(p.locations || []).map(String).includes(String(s.location_id))) return false;
    if (Array.isArray(s.service_ids) && !s.service_ids.map(String).includes(String(svcId))) return false;
    if (locId && String(s.location_id) !== String(locId)) return false;
    if (proId && String(s.pro_id) !== String(proId)) return false;
    return true;
  }).map((s) => ({
    start: s.start,
    pro: (pros.find((x) => String(x.id) === String(s.pro_id)) || {}).name || "",
    location: (negocio.locations.find((l) => String(l.id) === String(s.location_id)) || {}).name || "",
    pro_id: s.pro_id, location_id: s.location_id,
  }));
}

/**
 * O ESPELHO DA DECISÃO. Recebe o catálogo do negócio e o que a pessoa falou; devolve o desfecho.
 *
 * Desfechos possíveis (o nome é o que a ligação vira na prática):
 *   pergunta_servico     — não deu pra saber o serviço; lista o cardápio real
 *   pergunta_unidade     — o serviço existe em 2+ unidades e ninguém disse qual
 *   pergunta_dia_e_hora  — op=book sem nenhum texto de horário
 *   pergunta_horario     — falou algo, mas não disse dia NEM hora ("quero marcar")
 *   horario_indisponivel — disse quando, e aquele horário não existe/está ocupado
 *   sem_vaga             — op=availability e a combinação pedida não tem horário nenhum
 *   ofereceu             — op=availability com horários reais na mão
 *   agendado             — op=book com um slot REAL escolhido
 */
export function decidirAgenda(negocio, fala) {
  const op = (fala.op || "availability").toString();
  const tz = negocio.tz || "America/New_York";

  // (1) serviço e unidade JUNTOS — a correção que motivou tudo isto
  const { svc, loc, unidadesPossiveis } = resolveServicoLocal(
    negocio.services, negocio.locations, negocio.pros, fala.service, fala.location,
  );
  // (2) profissional pela cópia vigiada de `pick`
  const pro = pick(negocio.pros, fala.professional || fala.pro);
  const base = { servico: svc ? svc.name : null, unidade: loc ? loc.name : null, profissional: pro ? pro.name : null };

  if (!svc) return { ...base, desfecho: "pergunta_servico", unidades: [] };

  if (unidadesPossiveis.length > 1 && (op === "availability" || op === "book" || op === "recurring")) {
    return { ...base, desfecho: "pergunta_unidade", unidades: unidadesPossiveis.map((u) => u.name) };
  }

  // ⚠️ O ESPELHO TEM QUE ERRAR IGUAL À PRODUÇÃO, senão ele esconde o defeito em vez de achar.
  // Em `availability` o endpoint FILTRA por profissional (agent-schedule.js passa p_pro_id).
  // Em `book` ele NÃO passa (agent-schedule.js:489 manda só service+location) e depois faz
  // `proId = proId || match.pro_id` — mantendo o profissional que a pessoa PEDIU num horário
  // que pode ser de OUTRO. Quem liga e diz "com a Ana" sai marcado com a Ana num slot do Bruno.
  // A primeira versão desta bateria filtrava por profissional NAS DUAS operações, ficava verde,
  // e o bug seguia invisível. Um espelho mais correto que o original é um espelho inútil.
  // CONSERTADO EM 2026-08-16: agora a produção TAMBÉM filtra por profissional no book
  // (agent-schedule.js passa p_pro_id). O espelho volta a filtrar nas duas operações — e o cenário
  // "com a Ana às 14h" passa a recusar, que é a resposta certa: as 14h são do Bruno.
  const slots = vagas(negocio, svc.id, loc ? loc.id : null, pro ? pro.id : null);

  if (op === "availability") {
    return slots.length
      ? { ...base, desfecho: "ofereceu", slots, unidades: [] }
      : { ...base, desfecho: "sem_vaga", slots: [], unidades: [] };
  }

  if (op === "book") {
    const texto = (fala.when || fala.start || "").toString();
    if (!texto) return { ...base, desfecho: "pergunta_dia_e_hora", slots, unidades: [] };
    const escolhido = resolveSlot(texto, slots, tz);
    if (!escolhido) {
      const disse = oQueAPessoaDisse(texto, tz, slots);
      if (!disse.disse_dia && !disse.disse_hora) return { ...base, desfecho: "pergunta_horario", slots, unidades: [] };
      return { ...base, desfecho: "horario_indisponivel", slots, unidades: [] };
    }
    return {
      ...base,
      desfecho: "agendado",
      quando: escolhido.start,
      // o profissional/unidade explícitos mandam; o resto vem do slot REAL (igual ao endpoint)
      profissional: base.profissional || escolhido.pro,
      unidade: base.unidade || escolhido.location,
      // DE QUEM O HORÁRIO REALMENTE É. O endpoint não expõe isto — ele grava `profissional` e
      // pronto, e é por isso que o descasamento nunca apareceu para ninguém. Aqui os dois ficam
      // lado a lado para o teste poder comparar: se `profissional` ≠ `dono_do_slot`, a reserva
      // foi gravada no nome de uma pessoa em cima da agenda de outra.
      dono_do_slot: escolhido.pro,
      unidades: [],
    };
  }

  return { ...base, desfecho: "op_desconhecida", unidades: [] };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// OS NEGÓCIOS
// ═══════════════════════════════════════════════════════════════════════════════════════════════

// ── NATURA SPA (REAL) — catálogo lido do banco em 2026-08-16, o mesmo de bizMatch.test.mjs.
// Três unidades, e a unidade morando no NOME do serviço. O time do UES Salon NÃO faz facial e o
// Med Spa NÃO corta cabelo: é essa assimetria que desfaz sozinha a ambiguidade das duas "UES".
const LN = { AST: "loc-astoria", SAL: "loc-ues-salon", MED: "loc-ues-medspa" };
const SN = {
  mas: "svc-massage", fac: "svc-facial", hcA: "svc-haircut-astoria", hcU: "svc-haircut-ues",
  facU: "svc-facial-ues", mas60: "svc-massage60-ues", mas90: "svc-massage90-ues",
  dtU: "svc-deeptissue-ues", dtA: "svc-deeptissue-astoria",
};
const TZ_NY = "America/New_York";
export const NATURA = {
  nome: "Natura Spa (real)",
  tz: TZ_NY,
  locations: [
    { id: LN.AST, name: "Astoria" }, { id: LN.SAL, name: "UES Salon" }, { id: LN.MED, name: "UES Med Spa" },
  ],
  services: [
    { id: SN.mas, name: "Massage" }, { id: SN.fac, name: "Facial" },
    { id: SN.hcA, name: "Haircut · Astoria" }, { id: SN.hcU, name: "Haircut · UES" },
    { id: SN.facU, name: "Facial · UES Med Spa" },
    { id: SN.mas60, name: "Massage 60min · UES Med Spa" }, { id: SN.mas90, name: "Massage 90min · UES Med Spa" },
    { id: SN.dtU, name: "Deep Tissue 60min · UES Med Spa" }, { id: SN.dtA, name: "Deep Tissue 60min · Astoria" },
  ],
  pros: [
    { id: "p1", name: "Astoria Team", services: [SN.mas, SN.fac, SN.hcA, SN.dtA], locations: [LN.AST] },
    { id: "p2", name: "UES Salon Team", services: [SN.hcU], locations: [LN.SAL] },
    { id: "p3", name: "Med Spa Team", services: [SN.facU, SN.mas60, SN.mas90, SN.dtU], locations: [LN.MED] },
  ],
  agenda: [
    { start: horarioLocal(TZ_NY, 1, 10, 0), pro_id: "p1", location_id: LN.AST },
    { start: horarioLocal(TZ_NY, 1, 14, 0), pro_id: "p1", location_id: LN.AST },
    { start: horarioLocal(TZ_NY, 1, 11, 0), pro_id: "p2", location_id: LN.SAL },
    { start: horarioLocal(TZ_NY, 1, 13, 0), pro_id: "p3", location_id: LN.MED },
    { start: horarioLocal(TZ_NY, 2, 9, 0), pro_id: "p3", location_id: LN.MED },
  ],
};

// ── CANTINA DO PORTO — restaurante de UMA unidade só. Vertical diferente de propósito: a lógica
// de unidade não pode ter sido ajustada só para spa de três endereços. O que se prova aqui é o
// SILÊNCIO: um negócio de uma unidade nunca pode ouvir "qual unidade?".
const TZ_SP = "America/Sao_Paulo";
const LC = "loc-cantina";
const SC = { jantar: "svc-jantar", almoco: "svc-almoco" };
export const CANTINA = {
  nome: "Cantina do Porto (restaurante, 1 unidade)",
  tz: TZ_SP,
  locations: [{ id: LC, name: "Cantina do Porto" }],
  services: [{ id: SC.jantar, name: "Jantar" }, { id: SC.almoco, name: "Almoço" }],
  // um salão só, mas com grade separada por serviço — jantar não se serve ao meio-dia
  pros: [{ id: "p-salao", name: "Salão", services: [SC.jantar, SC.almoco], locations: [LC] }],
  agenda: [
    { start: horarioLocal(TZ_SP, 1, 12, 0), pro_id: "p-salao", location_id: LC, service_ids: [SC.almoco] },
    { start: horarioLocal(TZ_SP, 1, 19, 0), pro_id: "p-salao", location_id: LC, service_ids: [SC.jantar] },
    { start: horarioLocal(TZ_SP, 1, 20, 0), pro_id: "p-salao", location_id: LC, service_ids: [SC.jantar] },
  ],
};

// ── CLÍNICA VIDA — duas unidades, serviço gêmeo por unidade e profissionais com nome próprio.
// A clínica é o pior lugar para marcar no endereço errado: a pessoa aparece em jejum no bairro
// errado. Aqui se prova o pedido "com a Dra. Helena" e o serviço que existe mas não naquela unidade.
const LV = { CEN: "loc-vida-centro", ZS: "loc-vida-zonasul" };
const SV = { derm: "svc-derm-centro", dermZ: "svc-derm-zs", botox: "svc-botox-zs" };
export const CLINICA = {
  nome: "Clínica Vida (clínica, 2 unidades)",
  tz: TZ_SP,
  locations: [{ id: LV.CEN, name: "Clínica Vida Centro" }, { id: LV.ZS, name: "Clínica Vida Zona Sul" }],
  services: [
    { id: SV.derm, name: "Consulta Dermatologia" },
    { id: SV.dermZ, name: "Consulta Dermatologia · Zona Sul" },
    { id: SV.botox, name: "Botox · Zona Sul" },
  ],
  pros: [
    { id: "pc1", name: "Dr. Marcos", services: [SV.derm], locations: [LV.CEN] },
    { id: "pc2", name: "Dra. Helena", services: [SV.dermZ, SV.botox], locations: [LV.ZS] },
  ],
  agenda: [
    { start: horarioLocal(TZ_SP, 1, 9, 0), pro_id: "pc1", location_id: LV.CEN },
    { start: horarioLocal(TZ_SP, 1, 15, 0), pro_id: "pc2", location_id: LV.ZS, service_ids: [SV.dermZ] },
    { start: horarioLocal(TZ_SP, 1, 16, 0), pro_id: "pc2", location_id: LV.ZS, service_ids: [SV.botox] },
  ],
};

// ── BARBEARIA DOIS IRMÃOS — DOIS profissionais na MESMA unidade.
// Esta é a forma de negócio que o Natura, por acaso, não tem: os 3 times dele estão em 3 unidades
// diferentes, um em cada, então o filtro por unidade já sobra um profissional só e o defeito do
// profissional fica escondido. Barbearia, salão e clínica de bairro — a maior parte do mercado —
// têm 2+ pessoas atendendo no mesmo endereço. É aqui que o bug acorda.
const LB = "loc-barbearia";
const SB = { corte: "svc-corte", barba: "svc-barba" };
export const BARBEARIA = {
  nome: "Barbearia Dois Irmãos (2 profissionais, 1 unidade)",
  tz: TZ_SP,
  locations: [{ id: LB, name: "Barbearia Dois Irmãos" }],
  services: [{ id: SB.corte, name: "Corte" }, { id: SB.barba, name: "Barba" }],
  pros: [
    { id: "pb1", name: "Ana", services: [SB.corte, SB.barba], locations: [LB] },
    { id: "pb2", name: "Bruno", services: [SB.corte, SB.barba], locations: [LB] },
  ],
  // 14h é do BRUNO e SÓ do Bruno. A Ana não tem 14h. Quem pedir "com a Ana às 14h" está pedindo
  // um horário que ela não tem — e o certo é ouvir isso, não sair marcado por cima do Bruno.
  agenda: [
    { start: horarioLocal(TZ_SP, 1, 10, 0), pro_id: "pb1", location_id: LB },
    { start: horarioLocal(TZ_SP, 1, 14, 0), pro_id: "pb2", location_id: LB },
    { start: horarioLocal(TZ_SP, 1, 16, 0), pro_id: "pb1", location_id: LB },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// OS CENÁRIOS — cada um diz, em `dinheiro`, o que ele protege. Sem isso vira teste decorativo.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
export const CENARIOS = [
  // ── O BUG DO PROFISSIONAL (agent-schedule.js:489). Este cenário DEVE ficar vermelho até o
  //    endpoint ser corrigido — ele é a prova de antes-e-depois do conserto, não uma decoração.
  {
    id: "barbearia · horário de outro profissional — 'com a Ana às 14h'",
    negocio: BARBEARIA,
    fala: { op: "book", service: "corte", professional: "Ana", when: "amanhã às 14h" },
    espera: { desfecho: "horario_indisponivel" },
    dinheiro: "as 14h são do BRUNO. Hoje o endpoint busca o horário SEM filtrar por profissional e depois mantém quem a pessoa pediu: sai marcado 'com a Ana' em cima da agenda do Bruno. No dia, ou a Ana não está, ou dois clientes chegam para o mesmo barbeiro. É a pior falha possível — acontece na ligação de MAIOR intenção de compra, a de quem já sabe com quem quer ir.",
  },
  {
    id: "barbearia · horário que é do profissional pedido — 'com a Ana às 10h'",
    negocio: BARBEARIA,
    fala: { op: "book", service: "corte", professional: "Ana", when: "amanhã às 10h" },
    espera: { desfecho: "agendado", profissional: "Ana", quando: horarioLocal(TZ_SP, 1, 10, 0) },
    dinheiro: "o contra-exemplo: pedir a pessoa certa no horário dela TEM que funcionar. Sem este par, o conserto do caso acima poderia ser 'recusar sempre que pedirem profissional' — que conserta o teste e mata a venda.",
  },
  // ── NATURA: AS LIGAÇÕES QUE SE PERDERAM, agora até o fim (não só o casamento de nomes) ────────
  {
    id: "natura · gêmeo por unidade — massagem no Upper East Side",
    negocio: NATURA,
    fala: { op: "book", service: "massage", location: "Upper East Side", when: "amanhã às 13h" },
    espera: { desfecho: "agendado", servico: "Massage 60min · UES Med Spa", unidade: "UES Med Spa", quando: horarioLocal(TZ_NY, 1, 13, 0) },
    dinheiro: "ligação de 05/08: a agente ANUNCIOU que o UES não tinha horário — tinha. Serviço genérico ganhando do gêmeo da unidade = negar dinheiro que estava na mesa.",
  },
  {
    id: "natura · unidade por extenso — corte no Upper East Side",
    negocio: NATURA,
    fala: { op: "availability", service: "haircut", location: "Upper East Side" },
    espera: { desfecho: "ofereceu", servico: "Haircut · UES", unidade: "UES Salon", slots: 1 },
    dinheiro: "ligação de 23/07: 'Upper East Side' não casava com unidade nenhuma → busca ampla → oferecia Astoria. O cliente do UES ouvia o bairro errado e desligava.",
  },
  {
    id: "natura · unidade por sigla — facial no UES",
    negocio: NATURA,
    fala: { op: "availability", service: "facial", location: "UES" },
    espera: { desfecho: "ofereceu", servico: "Facial · UES Med Spa", unidade: "UES Med Spa", slots: 2 },
    dinheiro: "'UES' e 'Upper East Side' são a mesma coisa para quem liga e eram coisas diferentes para o código. Das duas unidades UES só o Med Spa faz facial — a dúvida morre sozinha, sem gastar uma pergunta.",
  },
  {
    id: "natura · duas unidades fazem massagem e ninguém disse qual",
    negocio: NATURA,
    fala: { op: "book", service: "massage", location: "", when: "amanhã às 13h" },
    espera: { desfecho: "pergunta_unidade", unidades: ["Astoria", "UES Med Spa"] },
    dinheiro: "escolher calado esconde a segunda unidade: receita que existe e nunca é oferecida. Uma pergunta de cinco palavras resolve e ainda vende o outro endereço.",
  },
  {
    id: "natura · serviço que não existe não vira outro serviço",
    negocio: NATURA,
    fala: { op: "book", service: "tatuagem", location: "Astoria", when: "amanhã às 10h" },
    espera: { desfecho: "pergunta_servico" },
    dinheiro: "inventar o serviço mais parecido marca a pessoa para uma coisa que ela não pediu — ela descobre no balcão e o negócio perde o horário E o cliente.",
  },
  {
    id: "natura · serviço existe, mas em nenhuma unidade compatível com a pedida",
    negocio: NATURA,
    fala: { op: "availability", service: "facial", location: "UES Salon" },
    espera: { desfecho: "sem_vaga", servico: "Facial", unidade: "UES Salon" },
    dinheiro: "o time do UES Salon não faz facial. Responder 'sem horário AQUI' é a verdade; oferecer Astoria calado manda a pessoa para o bairro errado.",
  },
  {
    id: "natura · unidade explícita mantém o serviço da casa",
    negocio: NATURA,
    fala: { op: "book", service: "massage", location: "Astoria", when: "amanhã às 14h" },
    espera: { desfecho: "agendado", servico: "Massage", unidade: "Astoria", quando: horarioLocal(TZ_NY, 1, 14, 0) },
    dinheiro: "não pode PIORAR o que já funcionava: quem diz a unidade tem que sair com o serviço daquela unidade, na hora que pediu.",
  },
  {
    id: "natura · 'quero marcar' não é 'esse horário está ocupado'",
    negocio: NATURA,
    fala: { op: "book", service: "massage", location: "Astoria", when: "queria marcar um horário" },
    espera: { desfecho: "pergunta_horario", servico: "Massage", unidade: "Astoria" },
    dinheiro: "motivo falso destrói a confiança mais rápido que a recusa: quem não disse hora percebe na hora que não foi escutado, e não repete o pedido.",
  },
  {
    id: "natura · pediu hora que não existe na grade → oferece as reais",
    negocio: NATURA,
    fala: { op: "book", service: "massage", location: "Astoria", when: "amanhã às 9" },
    espera: { desfecho: "horario_indisponivel", servico: "Massage", unidade: "Astoria" },
    dinheiro: "aqui 'não está livre' é VERDADE — e vem com alternativa. Marcar em 10h quem pediu 9h é o erro silencioso que só aparece na recepção.",
  },

  // ── CANTINA: UMA UNIDADE SÓ. O teste é o silêncio. ────────────────────────────────────────────
  {
    id: "cantina · uma unidade só não pergunta qual unidade",
    negocio: CANTINA,
    fala: { op: "book", service: "jantar", location: "", when: "amanhã às 20h" },
    espera: { desfecho: "agendado", servico: "Jantar", unidade: "Cantina do Porto", quando: horarioLocal(TZ_SP, 1, 20, 0) },
    dinheiro: "cada pergunta desnecessária é uma chance de desligar. Perguntar 'qual unidade?' a quem tem uma só é queimar a reserva com informação que já temos.",
  },
  {
    id: "cantina · grade por serviço: jantar não se serve ao meio-dia",
    negocio: CANTINA,
    fala: { op: "book", service: "jantar", location: "", when: "amanhã ao meio-dia" },
    espera: { desfecho: "horario_indisponivel", servico: "Jantar", unidade: "Cantina do Porto" },
    dinheiro: "mesa marcada num horário em que a cozinha não serve aquele menu = cliente na porta e nada pronto. Recusar com alternativa custa zero.",
  },

  // ── CLÍNICA: outro vertical, e o lugar onde errar endereço dói mais. ──────────────────────────
  {
    id: "clínica · mesma consulta nas duas unidades → pergunta",
    negocio: CLINICA,
    fala: { op: "book", service: "dermatologia", location: "", when: "amanhã às 15h" },
    espera: { desfecho: "pergunta_unidade", unidades: ["Clínica Vida Centro", "Clínica Vida Zona Sul"] },
    dinheiro: "paciente que aparece em jejum no bairro errado não remarca: cancela e procura outra clínica.",
  },
  {
    id: "clínica · unidade dita resolve o gêmeo certo",
    negocio: CLINICA,
    fala: { op: "book", service: "dermatologia", location: "Zona Sul", when: "amanhã às 15h" },
    espera: { desfecho: "agendado", servico: "Consulta Dermatologia · Zona Sul", unidade: "Clínica Vida Zona Sul", profissional: "Dra. Helena", quando: horarioLocal(TZ_SP, 1, 15, 0) },
    dinheiro: "é o mesmo defeito do Natura em outro vertical: sem o cruzamento, o genérico do Centro ganharia e a Zona Sul sumiria da ligação.",
  },
  {
    id: "clínica · profissional pedido pelo nome",
    negocio: CLINICA,
    fala: { op: "book", service: "botox", location: "Zona Sul", professional: "Helena", when: "amanhã às 16h" },
    espera: { desfecho: "agendado", servico: "Botox · Zona Sul", unidade: "Clínica Vida Zona Sul", profissional: "Dra. Helena", quando: horarioLocal(TZ_SP, 1, 16, 0) },
    dinheiro: "quem pede um profissional pelo nome já decidiu comprar. Ignorar o nome e marcar com outro é a forma mais cara de 'quase acertar'.",
  },
  {
    id: "clínica · serviço existe só na outra unidade",
    negocio: CLINICA,
    fala: { op: "availability", service: "botox", location: "Centro" },
    espera: { desfecho: "sem_vaga", servico: "Botox · Zona Sul", unidade: "Clínica Vida Centro" },
    dinheiro: "dizer a verdade ('aqui não temos') deixa a porta aberta para oferecer a outra unidade; marcar no Centro um procedimento que só existe na Zona Sul é dano puro.",
  },
];

// ── RADAR: comportamento ATUAL que eu não considero certo, medido mas SEM travar o conserto ─────
// Não entram na lista de falhas de propósito. Um teste que congela um defeito impede quem for
// consertá-lo; um teste que o IGNORA deixa ele invisível. O meio-termo honesto é medir e imprimir.
export const RADAR = [
  {
    id: "profissional errado num negócio de 1 profissional",
    negocio: CANTINA,
    fala: { op: "availability", service: "jantar", professional: "Dr. João" },
    // pick() cai em `lista.length === 1 ? lista[0] : null` — devolve o ÚNICO profissional mesmo
    // quando o nome falado não bate com nada. Num restaurante isso é inofensivo; numa clínica de
    // um médico só, a pessoa pede "Dra. Ana" e é marcada com outro sem ninguém avisar.
    observado: (r) => `profissional resolvido = ${r.profissional} (nome falado: "Dr. João")`,
  },
  {
    id: "profissional nomeado não desfaz a ambiguidade de unidade",
    negocio: CLINICA,
    fala: { op: "book", service: "dermatologia", professional: "Helena", when: "amanhã às 15h" },
    // A checagem de unidade ambígua roda ANTES de o profissional entrar na conta. A Dra. Helena só
    // atende na Zona Sul: quem pediu por ela JÁ disse a unidade, e mesmo assim ouve "qual unidade?".
    // Pergunta evitável = ligação mais longa e mais chance de desistir.
    observado: (r) => `desfecho = ${r.desfecho}${r.unidades && r.unidades.length ? ` (${r.unidades.join(" | ")})` : ""}`,
  },
  {
    id: 'palavra de ligação ("de") derruba o gêmeo da unidade',
    negocio: CLINICA,
    fala: { op: "availability", service: "consulta de dermatologia", location: "Zona Sul" },
    // ACHADO ENQUANTO EU ESCREVIA ESTES CENÁRIOS, não previsto na tarefa. O casaNome exige que as
    // palavras faladas sejam SUBCONJUNTO das do serviço; "consulta DE dermatologia" — a frase que
    // qualquer paciente fala — carrega o "de", que não existe em "Consulta Dermatologia · Zona
    // Sul". Nenhum dos caminhos (igual / contém / subconjunto / sigla) salva, e o gêmeo da Zona Sul
    // sai da disputa. Com "dermatologia" seco resolve certo — ou seja, o defeito depende de a
    // pessoa falar MENOS. É o mesmo formato da falha do Natura, só que na camada das palavras
    // vazias. Deixo medido aqui em vez de mexer no bizMatch.js, que não é meu arquivo nesta onda.
    observado: (r) => `desfecho = ${r.desfecho} · serviço = ${r.servico} · unidade = ${r.unidade}`,
  },
];
