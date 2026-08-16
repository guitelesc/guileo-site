// RESOLVEDOR CONJUNTO DE SERVIÇO + UNIDADE — 2026-08-16.
//
// POR QUE ISTO EXISTE (o defeito que ele mata, com prova):
// O Natura Spa tem TRÊS unidades — Astoria, "UES Salon" e "UES Med Spa" — e um catálogo onde a
// unidade mora no NOME do serviço ("Haircut", "Haircut · UES", "Massage 60min · UES Med Spa").
// O código antigo resolvia as duas coisas separado:
//     const svc = pick(services, b.service);
//     const loc = pick(locations, b.location);
// e isso produzia DUAS falhas reais, medidas em 14 ligações do Natura com 0 agendamentos:
//
//   1) "Upper East Side" não casava com unidade NENHUMA (nem exato nem por includes: "ues salon"
//      não contém "upper east side"). Com 2+ opções o pick devolvia null → a busca rodava em TODAS
//      as unidades → voltava Astoria → a Lilian dizia "só tenho em Astoria". Ligação de 23/07.
//   2) "massagem" casava EXATO com o serviço genérico `Massage`, que só está ligado ao time de
//      Astoria. O gêmeo `Massage 60min · UES Med Spa` nunca era considerado. A agente então
//      anunciava que o UES não tinha horário — sendo que tinha. Ligação de 05/08.
//
// A CORREÇÃO NÃO É UM MATCHER MELHOR, É A ORDEM: escolher serviço e unidade JUNTOS, mantendo só os
// pares que o negócio realmente atende. É o que a recepcionista humana faz — "corte no Upper East
// Side" é ambíguo entre duas unidades UES, mas só uma corta cabelo, e a dúvida morre sozinha.
//
// SEM CONSULTA NOVA: o biz_lookup já devolve cada profissional com services[] e locations[]; o par
// (serviço, unidade) é atendível quando existe um profissional que faz aquele serviço E trabalha
// naquela unidade. Conferido em 2026-08-16 que biz_pro_locations bate com as unidades das agendas
// reais (biz_schedules) nos 3 profissionais do Natura — senão eu estaria filtrando por dado morto.

const norm = (s) => (s || "").toString().trim().toLowerCase();
const tokens = (s) => norm(s).split(/[^a-z0-9á-ú]+/i).filter(Boolean);
// Iniciais: "Upper East Side" → "ues". É assim que o cliente fala o bairro e assim que o negócio
// batiza a unidade; sem isto os dois nunca se encontram.
const sigla = (s) => tokens(s).map((t) => t[0]).join("");

// Um nome "casa" com o que a pessoa falou por qualquer um destes caminhos, do mais forte ao mais
// fraco. Tudo simétrico: tanto faz quem é o texto curto.
export function casaNome(nome, falado) {
  const a = norm(nome), b = norm(falado);
  if (!b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const ta = tokens(a), tb = tokens(b);
  // subconjunto de palavras: "ues" está em ["ues","salon"]
  if (tb.length && tb.every((t) => ta.includes(t))) return true;
  if (ta.length && ta.every((t) => tb.includes(t))) return true;
  // sigla: "upper east side" → "ues", que é uma palavra de "UES Salon"
  const sb = sigla(b), sa = sigla(a);
  if (sb.length >= 2 && (ta.includes(sb) || a.replace(/\s+/g, "") === sb)) return true;
  if (sa.length >= 2 && (tb.includes(sa) || b.replace(/\s+/g, "") === sa)) return true;
  return false;
}

// Candidatos: TODOS os que casam, sem podar.
// ⚠️ NÃO filtre aqui pelo casamento exato. Foi o primeiro jeito que eu escrevi e o teste com os
// dados reais do Natura derrubou: "massage" casa exato com o genérico `Massage` (só Astoria), e
// isso eliminava `Massage 60min · UES Med Spa` da disputa ANTES do cruzamento com a unidade —
// reproduzindo o bug que este arquivo existe pra matar. Preferir o nome exato é DESEMPATE no fim,
// depois que a unidade já filtrou, e está em resolveServicoLocal.
const candidatos = (lista, falado) => {
  const arr = Array.isArray(lista) ? lista : [];
  if (!falado) return arr;
  return arr.filter((x) => casaNome(x.name, falado));
};

// O par (serviço, unidade) é atendível? Existe profissional que faz o serviço E trabalha na unidade.
const atendivel = (pros, svcId, locId) =>
  (Array.isArray(pros) ? pros : []).some((p) => {
    const svcs = Array.isArray(p.services) ? p.services.map(String) : [];
    const locs = Array.isArray(p.locations) ? p.locations.map(String) : [];
    return svcs.includes(String(svcId)) && locs.includes(String(locId));
  });

/**
 * Resolve serviço e unidade JUNTOS.
 * Devolve { svc, loc, unidadesPossiveis } — `unidadesPossiveis` são as unidades que sobraram quando
 * a dúvida não pôde ser desfeita, para quem chama poder perguntar em vez de chutar.
 *
 * Regra de ouro: NUNCA fica pior que o comportamento antigo. Se o cruzamento não resolve, cai no
 * mesmo resultado de antes (primeiro candidato / null), porque uma busca ampla devolvendo horário
 * de outra unidade é ruim, mas recusar um serviço que existe é pior.
 */
export function resolveServicoLocal(services, locations, pros, faladoServico, faladoLocal) {
  const svcCands = candidatos(services, faladoServico);
  const locCands = candidatos(locations, faladoLocal);

  // Sem serviço identificável não há o que cruzar — devolve como antes.
  if (!svcCands.length) return { svc: null, loc: locCands.length === 1 ? locCands[0] : null, unidadesPossiveis: locCands };

  // Só os pares que o negócio realmente atende. Este é o cruzamento que não existia.
  const pares = [];
  for (const s of svcCands) for (const l of locCands) if (atendivel(pros, s.id, l.id)) pares.push({ s, l });

  if (pares.length) {
    // A UNIDADE SAI PRIMEIRO, e do conjunto INTEIRO de pares atendíveis — nunca de um subconjunto
    // já podado por nome. É isto que faz "corte no Upper East Side" virar UES Salon: das duas
    // unidades UES, só uma corta cabelo, então sobra uma e a dúvida morre. Sobrando duas, fica
    // null de propósito: a busca ampla oferece horários dizendo a unidade de cada um, que é
    // honesto, em vez de eu escolher no lugar de quem ligou.
    const unidades = [...new Map(pares.map((p) => [p.l.id, p.l])).values()];
    const loc = unidades.length === 1 ? unidades[0] : null;

    // O SERVIÇO SAI DEPOIS, já dentro da unidade resolvida. Só aqui o nome exato vale como
    // desempate: "massagem em Astoria" deve dar o `Massage` de lá, não um parente de outro nome.
    const naUnidade = loc ? pares.filter((p) => p.l.id === loc.id) : pares;
    const exato = naUnidade.find((p) => norm(p.s.name) === norm(faladoServico));
    return { svc: (exato || naUnidade[0]).s, loc, unidadesPossiveis: loc ? [] : unidades };
  }

  // NENHUM par atendível. Duas leituras possíveis, e as duas pedem o mesmo cuidado: não inventar.
  // Se a pessoa nomeou uma unidade e o serviço não é feito lá, devolver a unidade faz o motor
  // responder "sem horário" — que é a VERDADE, e melhor que marcar no lugar errado.
  return {
    svc: svcCands[0] || null,
    loc: locCands.length === 1 ? locCands[0] : null,
    unidadesPossiveis: locCands.length > 1 ? locCands : [],
  };
}
