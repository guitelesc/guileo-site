// GUARDA DO AGENDAMENTO — o serviço e a unidade certos, ou não há venda nenhuma.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ESTE TESTE EXISTE
// Em 2026-08-16 uma auditoria do BANCO (não uma reclamação) mostrou: 53 agendamentos na
// plataforma inteira, 53 sintéticos, ZERO de cliente real. O Natura Spa teve 14 ligações reais,
// 4 com intenção clara de marcar — 118s a 174s de conversa — e nenhuma virou linha no banco.
//
// A causa não estava no motor de agenda (que responde certo) nem no modelo (que se comportou).
// Estava na COSTURA: o código resolvia serviço e unidade separados,
//     const svc = pick(services, b.service);
//     const loc = pick(locations, b.location);
// e o Natura tem três unidades — Astoria, "UES Salon" e "UES Med Spa" — com a unidade morando no
// NOME do serviço ("Massage" vs "Massage 60min · UES Med Spa"). Daí saíam duas falhas:
//   • "Upper East Side" não casava com unidade nenhuma → null → busca em tudo → oferecia Astoria;
//   • "massagem" casava exato com o genérico (só Astoria) e o gêmeo do UES nunca era considerado
//     → a agente ANUNCIAVA que o UES não tinha horário. Tinha.
//
// Negar horário que existe é o defeito mais caro que este produto pode ter: a pessoa desliga e
// liga pro concorrente, e o painel registra a ligação como "sucesso".
//
// OS CASOS ABAIXO SÃO LIGAÇÕES REAIS, com data. Não são hipóteses. Se algum voltar a falhar, a
// plataforma voltou a recusar dinheiro que estava na mesa.
import { resolveServicoLocal, casaNome } from "./bizMatch.js";

// Catálogo REAL do Natura (biz_lookup, lido do banco em 2026-08-16). Os ids são os de produção,
// encurtados — o que importa é a topologia: um time por unidade, e serviços gêmeos com nomes
// diferentes. Repare que o time do UES Salon NÃO faz facial e o Med Spa NÃO corta cabelo: é essa
// assimetria que desfaz a ambiguidade das duas unidades "UES".
const L = { AST: "loc-astoria", SAL: "loc-ues-salon", MED: "loc-ues-medspa" };
const S = {
  mas: "svc-massage", fac: "svc-facial", hcA: "svc-haircut-astoria", hcU: "svc-haircut-ues",
  facU: "svc-facial-ues", mas60: "svc-massage60-ues", mas90: "svc-massage90-ues",
  dtU: "svc-deeptissue-ues", dtA: "svc-deeptissue-astoria",
};
const locations = [
  { id: L.AST, name: "Astoria" }, { id: L.SAL, name: "UES Salon" }, { id: L.MED, name: "UES Med Spa" },
];
const services = [
  { id: S.mas, name: "Massage" }, { id: S.fac, name: "Facial" },
  { id: S.hcA, name: "Haircut · Astoria" }, { id: S.hcU, name: "Haircut · UES" },
  { id: S.facU, name: "Facial · UES Med Spa" },
  { id: S.mas60, name: "Massage 60min · UES Med Spa" }, { id: S.mas90, name: "Massage 90min · UES Med Spa" },
  { id: S.dtU, name: "Deep Tissue 60min · UES Med Spa" }, { id: S.dtA, name: "Deep Tissue 60min · Astoria" },
];
const pros = [
  { id: "p1", name: "Astoria Team", services: [S.mas, S.fac, S.hcA, S.dtA], locations: [L.AST] },
  { id: "p2", name: "UES Salon Team", services: [S.hcU], locations: [L.SAL] },
  { id: "p3", name: "Med Spa Team", services: [S.facU, S.mas60, S.mas90, S.dtU], locations: [L.MED] },
];

const nome = (o) => (o ? o.name : "—");
let falhas = 0;

// [o que a pessoa falou] → [serviço esperado, unidade esperada]
const CASOS = [
  // ── AS TRÊS LIGAÇÕES QUE SE PERDERAM. Cada uma custou um cliente pronto.
  ["ligação 23/07 — corte no Upper East Side", "haircut", "Upper East Side", "Haircut · UES", "UES Salon"],
  ["ligação 05/08 — massagem no Upper East Side", "massage", "Upper East Side", "Massage 60min · UES Med Spa", "UES Med Spa"],
  ["ligação 08/08 — facial no UES", "facial", "UES", "Facial · UES Med Spa", "UES Med Spa"],

  // ── NÃO PODE PIORAR O QUE JÁ FUNCIONAVA. Com a unidade dita por extenso, o nome exato manda:
  //    quem pede "massagem em Astoria" quer o `Massage` de lá, não um parente de outro nome.
  ["unidade explícita mantém o nome exato", "massage", "Astoria", "Massage", "Astoria"],
  ["unidade explícita escolhe o gêmeo certo", "haircut", "Astoria", "Haircut · Astoria", "Astoria"],

  // ── A SIGLA É COMO O CLIENTE FALA O BAIRRO. "Upper East Side" e "UES" são a mesma coisa para
  //    quem liga, e eram coisas diferentes para o código.
  ["sigla resolve o bairro", "deep tissue", "Upper East Side", "Deep Tissue 60min · UES Med Spa", "UES Med Spa"],

  // ── SEM UNIDADE DITA, NÃO ESCOLHA POR ELA. Massagem existe em duas unidades; fixar uma
  //    escondia a outra. `loc` null faz a busca ampla oferecer horários dizendo onde é cada um.
  ["sem unidade fica em aberto", "massage", "", "Massage", "—"],

  // ── SERVIÇO QUE NÃO EXISTE continua não existindo — a unidade dita é preservada para o motor
  //    responder "sem horário" com a verdade, em vez de marcar em outro lugar.
  ["serviço inexistente não vira outro", "tatuagem", "Astoria", "—", "Astoria"],
];

for (const [titulo, falaServico, falaLocal, espServico, espLocal] of CASOS) {
  const r = resolveServicoLocal(services, locations, pros, falaServico, falaLocal);
  if (nome(r.svc) !== espServico || nome(r.loc) !== espLocal) {
    falhas++;
    console.log(`❌ ${titulo}`);
    console.log(`     falou    serviço=${JSON.stringify(falaServico)} unidade=${JSON.stringify(falaLocal)}`);
    console.log(`     esperado ${espServico} @ ${espLocal}`);
    console.log(`     obtido   ${nome(r.svc)} @ ${nome(r.loc)}`);
  }
}

// O casador de nomes sozinho: é ele que faz "Upper East Side" encontrar "UES Salon". Testado à
// parte porque um falso POSITIVO aqui é pior que um falso negativo — casar "UES" com "Astoria"
// mandaria a pessoa para o bairro errado, e isso só apareceria no balcão.
const CASOS_NOME = [
  ["UES Salon", "Upper East Side", true], ["UES Med Spa", "ues", true],
  ["Astoria", "Astoria", true], ["UES Salon", "salon", true],
  ["Astoria", "Upper East Side", false], ["UES Salon", "Astoria", false],
  ["Astoria", "", false],
];
for (const [nomeReal, falado, esperado] of CASOS_NOME) {
  const obtido = casaNome(nomeReal, falado);
  if (obtido !== esperado) {
    falhas++;
    console.log(`❌ casaNome(${JSON.stringify(nomeReal)}, ${JSON.stringify(falado)}) — esperado ${esperado}, obtido ${obtido}`);
  }
}

const TOTAL = CASOS.length + CASOS_NOME.length;
if (falhas) {
  console.log(`\n${falhas}/${TOTAL} casos errados. Serviço ou unidade errados significam UMA coisa na ligação:`);
  console.log("   a agente anuncia que não há horário — para um horário que existe — e o cliente liga pro concorrente.");
  process.exit(1);
}
console.log(`✅ ${TOTAL}/${TOTAL} — serviço e unidade saem juntos; as 3 ligações perdidas do Natura agora resolvem`);
