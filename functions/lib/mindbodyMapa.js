// functions/lib/mindbodyMapa.js — O DICIONÁRIO ENTRE A GUILEO E O MINDBODY. Funções PURAS.
//
// O DEFEITO QUE ISTO CONSERTA: o código antigo mandava o UUID da Guileo (biz_locations.id,
// biz_professionals.id) como LocationId/StaffId do MindBody, que são inteiros de outro sistema.
// E o serviço só casava se alguém tivesse colado um mapa nome→id à mão no banco. Sem mapa, toda
// reserva virava "a recepção confirma".
//
// O QUE ESTE ARQUIVO FAZ:
//   sugerirMapa()   olha os dois catálogos e PROPÕE o par de cada item, por nome normalizado.
//                   Propõe; quem grava é a dona, na tela. Onde não há par único, ele DIZ — nunca
//                   escolhe entre dois candidatos.
//   limparMapa()    o que chega da tela é conferido contra o catálogo real antes de gravar.
//   resolverIds()   id da Guileo → ids do MindBody, a partir do mapa gravado.
//
// FORMA DO MAPA GRAVADO (mb_mapping.mapping):
//   { v: 2, ativo: true,
//     sites:     { "<site_id>": { nome, tz } },
//     locations: { "<biz_locations.id>":     { site_id, location_id, nome } },
//     services:  { "<biz_services.id>":      { site_id, session_type_id, location_id?, nome, duracao_min? } },
//     staff:     { "<biz_professionals.id>": { site_id, staff_id, nome } } }
//
// UM CLIENTE, VÁRIOS SITES: o primeiro cliente tem 3 unidades em 2 sites do MindBody. Ids de
// sessão, de profissional e de unidade só valem DENTRO de um site — por isso todo par carrega o
// site_id junto, e nada é resolvido "no site padrão".

// minúsculas, sem acento, dígito separado de letra ("60min" → "60 min"), só letras e números.
export function normNome(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/(\d)([a-z])/g, "$1 $2").replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
const tokensDe = (s) => normNome(s).split(" ").filter(Boolean);
const sigla = (s) => tokensDe(s).map((t) => t[0]).join("");

// "Massage 60min · UES Med Spa" → { base:"Massage 60min", sufixo:"UES Med Spa" }.
// Só o ponto médio separa: hífen e barra aparecem dentro de nome de serviço de verdade.
export function partirNome(nome) {
  const s = String(nome || "");
  const i = s.lastIndexOf("·");
  if (i < 0) return { base: s.trim(), sufixo: "" };
  return { base: s.slice(0, i).trim(), sufixo: s.slice(i + 1).trim() };
}

// Compara dois nomes. "exato" = iguais depois de normalizar. "parcial" = mesmo conjunto de
// palavras em outra ordem, um contido no outro por palavras inteiras, ou sigla ("Upper East Side"
// ↔ "UES"). Nada de semelhança por letras: "Facial" não casa com "Facials Deluxe" por acaso.
export function compararNomes(a, b) {
  const na = normNome(a), nb = normNome(b);
  if (!na || !nb) return null;
  if (na === nb) return "exato";
  const ta = tokensDe(a), tb = tokensDe(b);
  const sub = (x, y) => x.length > 0 && x.every((t) => y.includes(t));
  if (sub(ta, tb) || sub(tb, ta)) return "parcial";
  const sa = sigla(a), sb = sigla(b);
  if (sa.length >= 2 && tb.includes(sa)) return "parcial";
  if (sb.length >= 2 && ta.includes(sb)) return "parcial";
  // sigla de um TRECHO: "UES Salon" ↔ "Natura Upper East Side" (u-e-s são três palavras seguidas).
  // Só para siglas de 3+ letras — com duas, "de" casaria com "Day Evening" por acidente.
  const trecho = (curtos, longos) => curtos.some((t) => {
    if (t.length < 3 || /\d/.test(t)) return false;
    for (let i = 0; i + t.length <= longos.length; i++) {
      if (longos.slice(i, i + t.length).map((x) => x[0]).join("") === t) return true;
    }
    return false;
  });
  if (trecho(ta, tb) || trecho(tb, ta)) return "parcial";
  return null;
}

// Procura `nome` numa lista de candidatos [{ rotulo(s), ... }]. Devolve:
//   { tipo:"exato"|"parcial", item }   um candidato único
//   { tipo:"ambiguo", candidatos }     dois ou mais no mesmo nível — NÃO escolhe
//   { tipo:"nenhum" }
function casarUnico(nome, candidatos, rotulosDe) {
  const exatos = [], parciais = [];
  for (const c of candidatos) {
    let melhor = null;
    for (const r of rotulosDe(c)) {
      const q = compararNomes(nome, r);
      if (q === "exato") { melhor = "exato"; break; }
      if (q === "parcial") melhor = "parcial";
    }
    if (melhor === "exato") exatos.push(c); else if (melhor === "parcial") parciais.push(c);
  }
  if (exatos.length === 1) return { tipo: "exato", item: exatos[0] };
  if (exatos.length > 1) return { tipo: "ambiguo", candidatos: exatos };
  if (parciais.length === 1) return { tipo: "parcial", item: parciais[0] };
  if (parciais.length > 1) return { tipo: "ambiguo", candidatos: parciais };
  return { tipo: "nenhum" };
}

const nomeDoStaff = (s) => String((s && (s.Name || [s.FirstName, s.LastName].filter(Boolean).join(" ") || s.DisplayName)) || "").trim();
const rotulosDoStaff = (s) => [nomeDoStaff(s), s && s.DisplayName, s && [s.FirstName, s.LastName].filter(Boolean).join(" ")].filter(Boolean);
const ehAtendimento = (st) => !st || st.Type == null || st.Type === "" || String(st.Type) === "Appointment" || String(st.Type) === "All";

/**
 * PROPÕE o mapa. Entradas:
 *   guileo   = { services:[{id,name,duration_min}], locations:[{id,name}], professionals:[{id,name,services:[],locations:[]}] }
 *   mindbody = { sites:[{ site_id, nome, tz, locations:[{Id,Name}], sessionTypes:[{Id,Name,Type,DefaultTimeLength}], staff:[{Id,FirstName,LastName,DisplayName,Name}] }] }
 * Saída:
 *   { mapa:{sites,locations,services,staff}, pendencias:[{ tipo, id, nome, situacao:"sem_par"|"ambiguo"|"conferir", candidatos? }] }
 * `conferir` = achei UM candidato, mas por casamento parcial: vem pré-selecionado e sinalizado.
 */
export function sugerirMapa(guileo, mindbody) {
  const g = guileo || {}, sites = Array.isArray(mindbody && mindbody.sites) ? mindbody.sites : [];
  const mapa = { v: 2, sites: {}, locations: {}, services: {}, staff: {} };
  const pendencias = [];
  for (const s of sites) mapa.sites[String(s.site_id)] = { nome: String(s.nome || ""), tz: s.tz || "" };

  // ── UNIDADES ────────────────────────────────────────────────────────────────────────────────
  const locsMb = sites.flatMap((s) => (s.locations || []).map((l) => ({ site_id: String(s.site_id), l })));
  for (const loc of g.locations || []) {
    let r = casarUnico(loc.name, locsMb, (c) => [c.l.Name]);
    // Site com UMA unidade só e nome que não bate em lugar nenhum: se além disso só existe um site,
    // o par é forçoso — mas segue como "conferir", porque quem confirma é a dona.
    if (r.tipo === "nenhum" && locsMb.length === 1) r = { tipo: "parcial", item: locsMb[0] };
    if (r.tipo === "exato" || r.tipo === "parcial") {
      mapa.locations[loc.id] = { site_id: r.item.site_id, location_id: r.item.l.Id, nome: String(r.item.l.Name || "") };
      if (r.tipo === "parcial") pendencias.push({ tipo: "location", id: loc.id, nome: loc.name, situacao: "conferir" });
    } else {
      pendencias.push({ tipo: "location", id: loc.id, nome: loc.name, situacao: r.tipo === "ambiguo" ? "ambiguo" : "sem_par",
        ...(r.candidatos ? { candidatos: r.candidatos.map((c) => ({ site_id: c.site_id, id: c.l.Id, nome: c.l.Name })) } : {}) });
    }
  }

  const sitesDasUnidades = (ids) => [...new Set((ids || []).map((id) => mapa.locations[id] && mapa.locations[id].site_id).filter(Boolean))];
  const pros = Array.isArray(g.professionals) ? g.professionals : [];

  // ── SERVIÇOS ────────────────────────────────────────────────────────────────────────────────
  for (const svc of g.services || []) {
    const { base, sufixo } = partirNome(svc.name);
    let sitesAlvo = null, locSufixo = null;
    if (sufixo) {
      // o sufixo depois do "·" É a unidade — casa contra as unidades da Guileo, e dela vem o site
      const r = casarUnico(sufixo, g.locations || [], (l) => [l.name]);
      // "· UES" casa com "UES Salon" E "UES Med Spa": a unidade é ambígua, mas se as duas moram no
      // MESMO site do MindBody o site está decidido — e é só dele que o serviço precisa.
      const doMesmoSite = r.tipo === "ambiguo" ? sitesDasUnidades(r.candidatos.map((c) => c.id)) : [];
      const todasMapeadas = r.tipo === "ambiguo" && r.candidatos.every((c) => mapa.locations[c.id]);
      if ((r.tipo === "exato" || r.tipo === "parcial") && mapa.locations[r.item.id]) {
        locSufixo = mapa.locations[r.item.id];
        sitesAlvo = [locSufixo.site_id];
      } else if (todasMapeadas && doMesmoSite.length === 1) {
        sitesAlvo = doMesmoSite;
      } else {
        pendencias.push({ tipo: "service", id: svc.id, nome: svc.name, situacao: r.tipo === "ambiguo" ? "ambiguo" : "sem_par", motivo: "unidade_do_sufixo" });
        continue;
      }
    } else {
      // sem sufixo: a unidade vem de QUEM FAZ o serviço (profissional → unidades → site)
      const doServico = pros.filter((p) => (p.services || []).map(String).includes(String(svc.id)));
      const s2 = sitesDasUnidades(doServico.flatMap((p) => p.locations || []));
      sitesAlvo = s2.length ? s2 : sites.map((s) => String(s.site_id));
    }
    const tipos = sites.filter((s) => sitesAlvo.includes(String(s.site_id)))
      .flatMap((s) => (s.sessionTypes || []).filter(ehAtendimento).map((st) => ({ site_id: String(s.site_id), st })));
    const r = casarUnico(base, tipos, (c) => [c.st.Name]);
    if (r.tipo === "exato" || r.tipo === "parcial") {
      mapa.services[svc.id] = {
        site_id: r.item.site_id, session_type_id: r.item.st.Id, nome: String(r.item.st.Name || ""),
        ...(locSufixo && locSufixo.site_id === r.item.site_id ? { location_id: locSufixo.location_id } : {}),
        ...(Number(r.item.st.DefaultTimeLength) > 0 ? { duracao_min: Number(r.item.st.DefaultTimeLength) } : {}),
      };
      if (r.tipo === "parcial") pendencias.push({ tipo: "service", id: svc.id, nome: svc.name, situacao: "conferir" });
    } else {
      pendencias.push({ tipo: "service", id: svc.id, nome: svc.name, situacao: r.tipo === "ambiguo" ? "ambiguo" : "sem_par",
        ...(r.candidatos ? { candidatos: r.candidatos.map((c) => ({ site_id: c.site_id, id: c.st.Id, nome: c.st.Name })) } : {}) });
    }
  }

  // ── PROFISSIONAIS ───────────────────────────────────────────────────────────────────────────
  for (const pro of pros) {
    const s2 = sitesDasUnidades(pro.locations || []);
    const alvo = s2.length ? s2 : sites.map((s) => String(s.site_id));
    const equipe = sites.filter((s) => alvo.includes(String(s.site_id)))
      .flatMap((s) => (s.staff || []).map((st) => ({ site_id: String(s.site_id), st })));
    const r = casarUnico(pro.name, equipe, (c) => rotulosDoStaff(c.st));
    if (r.tipo === "exato" || r.tipo === "parcial") {
      mapa.staff[pro.id] = { site_id: r.item.site_id, staff_id: r.item.st.Id, nome: nomeDoStaff(r.item.st) };
      if (r.tipo === "parcial") pendencias.push({ tipo: "staff", id: pro.id, nome: pro.name, situacao: "conferir" });
    } else {
      pendencias.push({ tipo: "staff", id: pro.id, nome: pro.name, situacao: r.tipo === "ambiguo" ? "ambiguo" : "sem_par",
        ...(r.candidatos ? { candidatos: r.candidatos.map((c) => ({ site_id: c.site_id, id: c.st.Id, nome: nomeDoStaff(c.st) })) } : {}) });
    }
  }
  return { mapa, pendencias };
}

const idMb = (v) => { const n = Number(v); return Number.isInteger(n) && String(v).trim() !== "" ? n : null; };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * O QUE VEM DA TELA É CONFERIDO ANTES DE GRAVAR.
 *   entrada   = o mapa que a tela mandou
 *   guileo    = catálogo da Guileo DESTE tenant (só ids dele entram)
 *   mindbody  = catálogo lido do MindBody agora (só ids que existem NAQUELE site entram)
 * Devolve { mapa, recusados:[{tipo,id,motivo}] }. Par que aponta para um site que o tenant não
 * conectou, ou para um id que não existe no site, é RECUSADO — nunca gravado "para ver se pega".
 */
export function limparMapa(entrada, guileo, mindbody) {
  const e = entrada && typeof entrada === "object" ? entrada : {};
  const g = guileo || {}, sites = Array.isArray(mindbody && mindbody.sites) ? mindbody.sites : [];
  const site = (id) => sites.find((s) => String(s.site_id) === String(id));
  const mapa = { v: 2, sites: {}, locations: {}, services: {}, staff: {} };
  const recusados = [];
  for (const s of sites) mapa.sites[String(s.site_id)] = { nome: String(s.nome || ""), tz: s.tz || "" };
  const donoDe = (lista) => new Set((lista || []).map((x) => String(x.id)));
  const meus = { locations: donoDe(g.locations), services: donoDe(g.services), staff: donoDe(g.professionals) };
  const recusa = (tipo, id, motivo) => recusados.push({ tipo, id, motivo });

  for (const [gid, v] of Object.entries(e.locations || {})) {
    if (!v) continue;
    const s = site(v.site_id), lid = idMb(v.location_id);
    if (!UUID.test(gid) || !meus.locations.has(gid)) { recusa("location", gid, "nao_e_deste_negocio"); continue; }
    const achado = s && lid != null && (s.locations || []).find((l) => Number(l.Id) === lid);
    if (!achado) { recusa("location", gid, s ? "id_nao_existe_no_site" : "site_nao_conectado"); continue; }
    mapa.locations[gid] = { site_id: String(s.site_id), location_id: lid, nome: String(achado.Name || "") };
  }
  for (const [gid, v] of Object.entries(e.services || {})) {
    if (!v) continue;
    const s = site(v.site_id), sid = idMb(v.session_type_id);
    if (!UUID.test(gid) || !meus.services.has(gid)) { recusa("service", gid, "nao_e_deste_negocio"); continue; }
    const achado = s && sid != null && (s.sessionTypes || []).find((t) => Number(t.Id) === sid);
    if (!achado) { recusa("service", gid, s ? "id_nao_existe_no_site" : "site_nao_conectado"); continue; }
    const lid = idMb(v.location_id);
    const locOk = lid != null && (s.locations || []).some((l) => Number(l.Id) === lid);
    mapa.services[gid] = {
      site_id: String(s.site_id), session_type_id: sid, nome: String(achado.Name || ""),
      ...(locOk ? { location_id: lid } : {}),
      ...(Number(achado.DefaultTimeLength) > 0 ? { duracao_min: Number(achado.DefaultTimeLength) } : {}),
    };
  }
  for (const [gid, v] of Object.entries(e.staff || {})) {
    if (!v) continue;
    const s = site(v.site_id), sid = idMb(v.staff_id);
    if (!UUID.test(gid) || !meus.staff.has(gid)) { recusa("staff", gid, "nao_e_deste_negocio"); continue; }
    const achado = s && sid != null && (s.staff || []).find((t) => Number(t.Id) === sid);
    if (!achado) { recusa("staff", gid, s ? "id_nao_existe_no_site" : "site_nao_conectado"); continue; }
    mapa.staff[gid] = { site_id: String(s.site_id), staff_id: sid, nome: nomeDoStaff(achado) };
  }
  return { mapa, recusados };
}

/**
 * ID DA GUILEO → IDS DO MINDBODY.
 *   pedido = { service_id, location_id?, professional_id? }   (UUIDs da Guileo)
 * Devolve { ok:true, site_id, session_type_id, location_id|null, staff_id|null, duracao_min|null }
 * ou { ok:false, motivo } com o motivo EXATO:
 *   sem_mapa · servico_sem_par · unidade_sem_par · profissional_sem_par ·
 *   unidade_de_outro_site · profissional_de_outro_site
 * Nunca devolve um id "provável": o que não está no mapa não existe.
 */
export function resolverIds(mapa, pedido = {}) {
  const m = mapa && typeof mapa === "object" ? mapa : null;
  if (!m || !m.services || !Object.keys(m.services).length) return { ok: false, motivo: "sem_mapa" };
  const svc = pedido.service_id ? m.services[pedido.service_id] : null;
  if (!svc || idMb(svc.session_type_id) == null || !svc.site_id) return { ok: false, motivo: "servico_sem_par" };
  const site_id = String(svc.site_id);
  let location_id = idMb(svc.location_id), staff_id = null;
  if (pedido.location_id) {
    const loc = (m.locations || {})[pedido.location_id];
    if (!loc || idMb(loc.location_id) == null) return { ok: false, motivo: "unidade_sem_par" };
    if (String(loc.site_id) !== site_id) return { ok: false, motivo: "unidade_de_outro_site" };
    location_id = idMb(loc.location_id);
  }
  if (pedido.professional_id) {
    const st = (m.staff || {})[pedido.professional_id];
    if (!st || idMb(st.staff_id) == null) return { ok: false, motivo: "profissional_sem_par" };
    if (String(st.site_id) !== site_id) return { ok: false, motivo: "profissional_de_outro_site" };
    staff_id = idMb(st.staff_id);
  }
  return {
    ok: true, site_id, session_type_id: idMb(svc.session_type_id), location_id, staff_id,
    duracao_min: Number(svc.duracao_min) > 0 ? Number(svc.duracao_min) : null,
    tz: (m.sites && m.sites[site_id] && m.sites[site_id].tz) || "",
  };
}

// Quantos itens da Guileo ainda não têm par — a tela e o status usam o mesmo número.
export function coberturaDoMapa(mapa, guileo) {
  const m = mapa || {}, g = guileo || {};
  const falta = (lista, grupo) => (lista || []).filter((x) => !(m[grupo] || {})[x.id]).map((x) => ({ id: x.id, nome: x.name }));
  return { services: falta(g.services, "services"), locations: falta(g.locations, "locations"), staff: falta(g.professionals, "staff") };
}
