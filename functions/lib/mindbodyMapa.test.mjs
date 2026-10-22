// Teste do mapa Guileo ↔ MindBody. Roda com: node functions/lib/mindbodyMapa.test.mjs
//
// POR QUE EXISTE: o código antigo mandava o UUID da Guileo como LocationId/StaffId do MindBody e
// só achava o serviço se alguém tivesse colado um mapa à mão. Este teste prende as três coisas
// que o mapa novo promete: (1) propõe o par certo pelo nome, inclusive com a unidade depois do
// "·"; (2) onde há dúvida, DIZ — não escolhe; (3) o que não está no mapa não vira id nenhum.
//
// O catálogo abaixo tem a forma do primeiro cliente: 3 unidades da Guileo em 2 sites do MindBody.
import { normNome, partirNome, compararNomes, sugerirMapa, limparMapa, resolverIds, coberturaDoMapa } from "./mindbodyMapa.js";

const falhas = [];
let n = 0;
const igual = (obtido, esperado, nome) => { n++; if (JSON.stringify(obtido) !== JSON.stringify(esperado)) falhas.push(`${nome}\n     esperado: ${JSON.stringify(esperado)}\n     obtido:   ${JSON.stringify(obtido)}`); };
const u = (k) => `00000000-0000-4000-8000-${String(k).padStart(12, "0")}`;

// ── Guileo ──
const L = { astoria: u(1), salon: u(2), med: u(3) };
const S = { facialAst: u(11), massUes: u(12), hairUes: u(13), massage: u(14), mystery: u(15), manicure: u(16), mascara: u(17), yoga: u(18) };
const P = { ana: u(21), bia: u(22), carla: u(23), davi: u(24) };
const guileo = {
  locations: [{ id: L.astoria, name: "Astoria" }, { id: L.salon, name: "UES Salon" }, { id: L.med, name: "UES Med Spa" }],
  services: [
    { id: S.facialAst, name: "Facial · Astoria" }, { id: S.massUes, name: "Massage 60min · UES Med Spa" },
    { id: S.hairUes, name: "Haircut · UES" }, { id: S.massage, name: "Massage" }, { id: S.mystery, name: "Mystery Peel" },
    { id: S.manicure, name: "Manicure" }, { id: S.mascara, name: "MÁSCARA FACIAL · astoria" }, { id: S.yoga, name: "Yoga Class · Astoria" },
  ],
  professionals: [
    { id: P.ana, name: "Ana", services: [S.facialAst, S.massage, S.mascara], locations: [L.astoria] },
    { id: P.bia, name: "Bia Lima", services: [S.hairUes], locations: [L.salon] },
    { id: P.carla, name: "Carla", services: [S.massUes], locations: [L.med] },
    { id: P.davi, name: "Davi", services: [], locations: [L.astoria] },
  ],
};
// ── MindBody (formas de GET /site/locations, /site/sessiontypes, /staff/staff) ──
const mindbody = { sites: [
  { site_id: "767008", nome: "Natura Astoria", tz: "America/New_York",
    locations: [{ Id: 1, Name: "Natura Spa Astoria" }],
    sessionTypes: [
      { Id: 11, Name: "Facial", Type: "Appointment", DefaultTimeLength: 60 }, { Id: 12, Name: "Massage", Type: "Appointment", DefaultTimeLength: 60 },
      { Id: 13, Name: "Manicure Classic", Type: "Appointment" }, { Id: 14, Name: "Manicure Gel", Type: "Appointment" },
      { Id: 15, Name: "Yoga Class", Type: "Class" }, { Id: 16, Name: "Mascara Facial", Type: "Appointment", DefaultTimeLength: 45 },
    ],
    staff: [{ Id: 100, FirstName: "Ana", LastName: "Souza", Name: "Ana Souza" }] },
  { site_id: "5734109", nome: "Natura UES", tz: "America/New_York",
    locations: [{ Id: 1, Name: "Natura Upper East Side" }],
    sessionTypes: [{ Id: 21, Name: "Massage 60 Min", Type: "Appointment", DefaultTimeLength: 60 }, { Id: 22, Name: "Haircut", Type: "Appointment", DefaultTimeLength: 45 }, { Id: 23, Name: "Facial", Type: "Appointment" }],
    staff: [{ Id: 200, FirstName: "Bia", LastName: "Lima" }, { Id: 201, FirstName: "Carla", LastName: "Dias" }, { Id: 202, FirstName: "Carla", LastName: "Mendes" }] },
] };

// ── 1. normalização ─────────────────────────────────────────────────────────────────────────
igual(normNome("  MÁSCARA  Facial "), "mascara facial", "acento e caixa somem");
igual(normNome("Massage 60min"), normNome("massage 60 MIN"), "'60min' e '60 min' são o mesmo nome");
igual(partirNome("Massage 60min · UES Med Spa"), { base: "Massage 60min", sufixo: "UES Med Spa" }, "o que vem depois do · é a unidade");
igual(partirNome("Deep-Tissue / Sports"), { base: "Deep-Tissue / Sports", sufixo: "" }, "hífen e barra NÃO separam unidade");
igual(compararNomes("Facial", "facial"), "exato", "exato");
igual(compararNomes("UES Salon", "Natura Upper East Side"), "parcial", "sigla de um trecho: UES ↔ Upper East Side");
igual(compararNomes("Facial", "Facials Deluxe"), null, "PLANTADO: parecido por LETRAS não é par — 'Facial' não casa com 'Facials Deluxe'");

// ── 2. sugestão ─────────────────────────────────────────────────────────────────────────────
const { mapa, pendencias } = sugerirMapa(guileo, mindbody);
const pend = (id) => pendencias.filter((p) => p.id === id).map((p) => p.situacao).join(",");

igual(mapa.locations[L.astoria], { site_id: "767008", location_id: 1, nome: "Natura Spa Astoria" }, "unidade Astoria → site 767008");
igual([mapa.locations[L.salon]?.site_id, mapa.locations[L.med]?.site_id], ["5734109", "5734109"], "as duas unidades UES → o mesmo site 5734109");
igual(pend(L.astoria), "conferir", "par por casamento parcial vem pré-selecionado E sinalizado para conferir");

igual(mapa.services[S.facialAst], { site_id: "767008", session_type_id: 11, nome: "Facial", location_id: 1, duracao_min: 60 }, "'Facial · Astoria' → sessão Facial do site de ASTORIA, com a unidade");
// PLANTADO: existe um "Facial" idêntico no outro site. O sufixo tem que decidir o site.
n++; if (mapa.services[S.facialAst]?.session_type_id === 23) falhas.push("PLANTADO: 'Facial · Astoria' foi parar no Facial do site UES — o sufixo de unidade foi ignorado");
igual(mapa.services[S.massUes], { site_id: "5734109", session_type_id: 21, nome: "Massage 60 Min", location_id: 1, duracao_min: 60 }, "'Massage 60min · UES Med Spa' → 'Massage 60 Min' do site UES");
igual([mapa.services[S.hairUes]?.site_id, mapa.services[S.hairUes]?.session_type_id, mapa.services[S.hairUes]?.location_id], ["5734109", 22, undefined], "'Haircut · UES': a unidade é ambígua (duas UES), mas as duas são do MESMO site → o site decide; unidade fica sem palpite");
igual([mapa.services[S.massage]?.site_id, mapa.services[S.massage]?.session_type_id], ["767008", 12], "'Massage' sem sufixo → o site de QUEM FAZ o serviço (Ana, Astoria)");
igual(mapa.services[S.mascara]?.session_type_id, 16, "acento e caixa: 'MÁSCARA FACIAL · astoria' → 'Mascara Facial'");
igual([mapa.services[S.mystery], pend(S.mystery)], [undefined, "sem_par"], "PLANTADO: serviço sem par fica SEM PAR — não ganha o primeiro da lista");
igual([mapa.services[S.manicure], pend(S.manicure)], [undefined, "ambiguo"], "PLANTADO: dois candidatos ('Manicure Classic' / 'Manicure Gel') → ambíguo, não escolhe");
igual(pendencias.find((p) => p.id === S.manicure)?.candidatos?.map((c) => c.id), [13, 14], "o ambíguo lista os candidatos para a dona escolher");
igual([mapa.services[S.yoga], pend(S.yoga)], [undefined, "sem_par"], "sessão do tipo Class não é sugerida para um serviço de agenda");

igual(mapa.staff[P.ana], { site_id: "767008", staff_id: 100, nome: "Ana Souza" }, "'Ana' → Ana Souza (única no site dela)");
igual(mapa.staff[P.bia]?.staff_id, 200, "'Bia Lima' → exato por FirstName + LastName");
igual([mapa.staff[P.carla], pend(P.carla)], [undefined, "ambiguo"], "PLANTADO: duas Carlas no site → ambíguo, não escolhe a primeira");
igual([mapa.staff[P.davi], pend(P.davi)], [undefined, "sem_par"], "profissional que não existe no MindBody → sem par");

// ── 3. o que vem da tela é conferido antes de gravar ────────────────────────────────────────
{
  const daTela = {
    locations: { [L.astoria]: { site_id: "767008", location_id: 1 }, [L.salon]: { site_id: "999999", location_id: 1 } },
    services: {
      [S.facialAst]: { site_id: "767008", session_type_id: "11", location_id: 1 },       // id como texto vira número
      [S.massage]: { site_id: "767008", session_type_id: 21 },                            // 21 é do OUTRO site
      [u(999)]: { site_id: "767008", session_type_id: 11 },                               // serviço que não é deste negócio
      "nao-e-uuid": { site_id: "767008", session_type_id: 11 },
    },
    staff: { [P.ana]: { site_id: "767008", staff_id: 100 }, [P.bia]: { site_id: "5734109", staff_id: L.astoria } }, // UUID como StaffId
  };
  const r = limparMapa(daTela, guileo, mindbody);
  igual(r.mapa.services[S.facialAst], { site_id: "767008", session_type_id: 11, nome: "Facial", location_id: 1, duracao_min: 60 }, "par válido é gravado com o id NUMÉRICO e o nome do MindBody");
  igual(Object.keys(r.mapa.services), [S.facialAst], "só o par válido entra");
  igual(r.recusados.map((x) => `${x.tipo}:${x.motivo}`).sort(), ["location:site_nao_conectado", "service:id_nao_existe_no_site", "service:nao_e_deste_negocio", "service:nao_e_deste_negocio", "staff:id_nao_existe_no_site"], "PLANTADO: site de outra empresa, id de outro site, serviço de outro negócio e UUID no lugar de id são RECUSADOS com motivo");
  igual(Object.keys(r.mapa.staff), [P.ana], "UUID da Guileo nunca vira StaffId");
  igual(r.mapa.sites["767008"], { nome: "Natura Astoria", tz: "America/New_York" }, "o fuso do site acompanha o mapa");
}

// ── 4. id da Guileo → ids do MindBody ───────────────────────────────────────────────────────
{
  const ok = resolverIds(mapa, { service_id: S.facialAst, location_id: L.astoria, professional_id: P.ana });
  igual(ok, { ok: true, site_id: "767008", session_type_id: 11, location_id: 1, staff_id: 100, duracao_min: 60, tz: "America/New_York" }, "serviço + unidade + profissional resolvidos, tudo do mesmo site");
  // PLANTADO: nenhum id devolvido pode ser o UUID da Guileo
  n++; if ([ok.session_type_id, ok.location_id, ok.staff_id].some((v) => typeof v !== "number")) falhas.push("PLANTADO: resolverIds devolveu algo que não é id numérico do MindBody");
  igual(resolverIds(mapa, { service_id: S.massUes }), { ok: true, site_id: "5734109", session_type_id: 21, location_id: 1, staff_id: null, duracao_min: 60, tz: "America/New_York" }, "só o serviço: unidade vem do próprio par, profissional fica em aberto");
  igual(resolverIds(mapa, { service_id: S.mystery }), { ok: false, motivo: "servico_sem_par" }, "PLANTADO: serviço fora do mapa → servico_sem_par (nunca um id 'provável')");
  igual(resolverIds(mapa, { service_id: S.facialAst, location_id: L.med }), { ok: false, motivo: "unidade_de_outro_site" }, "PLANTADO: unidade de outro site é recusada — ids só valem dentro do site");
  igual(resolverIds(mapa, { service_id: S.facialAst, professional_id: P.bia }), { ok: false, motivo: "profissional_de_outro_site" }, "profissional de outro site é recusado");
  igual(resolverIds(mapa, { service_id: S.facialAst, professional_id: P.carla }), { ok: false, motivo: "profissional_sem_par" }, "profissional pedido e não mapeado → motivo, não 'qualquer um'");
  igual(resolverIds({ services: {} }, { service_id: S.facialAst }), { ok: false, motivo: "sem_mapa" }, "mapa vazio → sem_mapa");
  igual(resolverIds(null, { service_id: S.facialAst }), { ok: false, motivo: "sem_mapa" }, "sem mapa → sem_mapa");
}
igual(coberturaDoMapa(mapa, guileo).services.map((x) => x.nome).sort(), ["Manicure", "Mystery Peel", "Yoga Class · Astoria"], "cobertura: a lista do que ainda falta é a mesma que a tela mostra");

for (const f of falhas) console.log(`❌ ${f}`);
console.log(falhas.length ? `\n${falhas.length} de ${n} caso(s) falharam — o mapa Guileo↔MindBody está errando par` : `✅ mindbodyMapa · ${n} casos · nome normalizado, sufixo de unidade, ambíguo não escolhe, id fora do mapa não existe`);
if (falhas.length) process.exit(1);
