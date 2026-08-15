// PROVA DOS DADOS ESTRUTURADOS — roda com:  node functions/lib/dadosEstruturados.test.mjs
//
// POR QUE EXISTE: dado estruturado errado falha CALADO. Ninguém vê. O negócio segue no ar, bonito,
// e a máquina lá fora repete um horário que não é o horário e um preço que não é o preço. Não
// existe tela vermelha para isso — só o cliente que aparece na terça e o lugar está fechado.
//
// O corpo principal do teste roda contra o CADASTRO REAL da Natura Spa + Salon, lido da produção
// (ynihodbknhjirkdogxby) em 2026-08-11: 3 unidades de verdade, 20 serviços de verdade (3 sem
// preço), 21 linhas de agenda de verdade. Fixture de mentira esconde exatamente os defeitos que
// dado real tem: preço nulo, endereço em formato livre, nome de unidade repetido.
//
// A checagem de horário é cruzada: os horários derivados de biz_schedules são comparados com o
// que o PRÓPRIO DONO escreveu por extenso na base de conhecimento ("Astoria: Mon–Sat 10am–8pm,
// Sun 11am–7pm"). Duas fontes independentes que precisam bater — é o que prova que weekday 0 é
// domingo e não segunda.

import {
  grafoDoNegocio, perguntas, llmsTxt, enderecoPostal, horariosSpec, moedaDoFuso,
  precoHumano, faixaDePreco, escaparJsonLd, tipoDoNegocio,
} from "./dadosEstruturados.js";

let falhas = 0;
const ok = (cond, msg) => { if (!cond) { console.log(`❌ ${msg}`); falhas++; } else { console.log(`✅ ${msg}`); } };
const secao = (n) => console.log(`\n── ${n} ─────────────────────────────────────`);

// ── Cadastro REAL da Natura (produção, 2026-08-11) ──────────────────────────────────────────────
const NATURA = {
  slug: "natura-spa", nome: "Natura Spa + Salon", curto: "Natura Spa", cor: "#3E9468",
  sobre: "Spa de bem-estar com atendimento 24/7 pela Gui.", cidade: "Astoria, NY",
  telefone: "+17189565530", lang: "en",
  bruto: {
    found: true, business_name: "Natura Spa + Salon", industry: "salon", lang: "en",
    review_link: "https://g.page/r/naturaspa/review",
    config: { about: "Spa de bem-estar com atendimento 24/7 pela Gui.", color: "#3E9468", headline: "Seu momento de cuidado começa aqui" },
    services: [
      { name: "Haircut · Astoria", price_cents: 6000, duration_min: 60 },
      { name: "Mini Facial · Astoria", price_cents: 7500, duration_min: 30 },
      { name: "Hair Color · Astoria", price_cents: 8000, duration_min: 90 },
      { name: "Haircut · UES", price_cents: 9000, duration_min: 60 },
      { name: "Hair Color · UES", price_cents: 9000, duration_min: 90 },
      { name: "Mini Facial · UES Med Spa", price_cents: 10000, duration_min: 30 },
      { name: "Lashes · Astoria (classic set)", price_cents: 10000, duration_min: 90 },
      { name: "Massage", price_cents: 11800, duration_min: 60 },
      { name: "Facial", price_cents: 11800, duration_min: 60 },
      { name: "Deep Tissue 60min · Astoria", price_cents: 12500, duration_min: 60 },
      { name: "Massage 60min · UES Med Spa", price_cents: 13200, duration_min: 60 },
      { name: "Deep Tissue 60min · UES Med Spa", price_cents: 13200, duration_min: 60 },
      { name: "Facial · UES Med Spa", price_cents: 13500, duration_min: 60 },
      { name: "Deep Pore Cleansing · Astoria", price_cents: 13800, duration_min: 80 },
      { name: "Deep Pore Cleansing · UES Med Spa", price_cents: 14500, duration_min: 80 },
      { name: "Massage 90min · UES Med Spa", price_cents: 16800, duration_min: 90 },
      { name: "Facial + Microdermabrasion · UES", price_cents: 16900, duration_min: 80 },
      { name: "CoolSculpting Elite", price_cents: null, duration_min: 60 },
      { name: "Laser Hair Removal", price_cents: null, duration_min: 30 },
      { name: "Acupuncture", price_cents: null, duration_min: 60 },
    ],
    locations: [
      { name: "Astoria", city: "Astoria, NY", phone: "+17189565530", address: "30-79 Steinway Street, Astoria, NY 11103" },
      { name: "UES Med Spa", city: "New York, NY", phone: "+12122580661", address: "166 East 63rd Street, New York, NY 10065" },
      { name: "UES Salon", city: "New York, NY", phone: "+12122580661", address: "842 Lexington Ave, New York, NY 10065" },
    ],
    // A KB CRUA da produção. Está aqui de propósito, para provar que ela NÃO sai publicada.
    faq: [
      { q: "WHO AM I — my voice and manner (read this first)", a: "You are LILIAN, of Natura Spa + Salon..." },
      { q: "How should I quote prices? (pricing rule)", a: "Salon and spa prices are STARTING prices..." },
      { q: "What services can I offer? (NEVER invent)", a: "WE DO NOT DO NAILS..." },
      { q: "Do you sell gift cards?", a: "Yes, gift cards are available for purchase." },
    ],
  },
};

// biz_schedules real, já consolidado por unidade+dia (o que client_site_aeo devolve).
const HORAS_NATURA = {
  Astoria: [
    { weekday: 0, start_min: 660, end_min: 1140 },
    ...[1, 2, 3, 4, 5, 6].map((d) => ({ weekday: d, start_min: 600, end_min: 1200 })),
  ],
  "UES Med Spa": [
    { weekday: 0, start_min: 600, end_min: 1020 },
    ...[1, 2, 3, 4, 5, 6].map((d) => ({ weekday: d, start_min: 600, end_min: 1140 })),
  ],
  "UES Salon": [
    { weekday: 0, start_min: 600, end_min: 1080 },
    ...[1, 2, 3, 4, 5, 6].map((d) => ({ weekday: d, start_min: 540, end_min: 1140 })),
  ],
};
const EXTRA = { hours: HORAS_NATURA, tz: "America/New_York", faqPublico: [] };

const g = grafoDoNegocio(NATURA, EXTRA);
const nos = g["@graph"];
const org = nos.find((n) => n["@type"] === "Organization");
const lugares = nos.filter((n) => n["@type"] !== "Organization");
const astoria = lugares.find((n) => /Astoria/.test(n.name));

// ── 1. Estrutura do grafo ───────────────────────────────────────────────────────────────────────
secao("1. Estrutura do grafo");
ok(g["@context"] === "https://schema.org", "@context é https://schema.org");
ok(Array.isArray(nos) && nos.length === 4, `@graph tem 4 nós (1 Organization + 3 unidades) — tem ${nos.length}`);
ok(!!org && org.name === "Natura Spa + Salon", "nó Organization com o nome do negócio");
ok(lugares.every((n) => n["@type"] === "HealthAndBeautyBusiness"), "cada unidade é HealthAndBeautyBusiness (ramo 'salon')");
ok(lugares.every((n) => n.parentOrganization && n.parentOrganization["@id"] === org["@id"]), "cada unidade aponta parentOrganization para a Organization");
ok(new Set(lugares.map((n) => n["@id"])).size === 3, "os @id das unidades são únicos");
ok(org.sameAs && org.sameAs[0] === "https://g.page/r/naturaspa/review", "sameAs (perfil externo) fica na Organization");
ok(!lugares.some((n) => n.sameAs), "sameAs NÃO é repetido no LocalBusiness (não está na lista do Google)");

// ── 2. Campos obrigatórios do Google (name + address) ───────────────────────────────────────────
secao("2. Obrigatórios do Google em LocalBusiness");
ok(lugares.every((n) => typeof n.name === "string" && n.name.length > 0), "toda unidade tem name");
ok(lugares.every((n) => n.address && n.address["@type"] === "PostalAddress"), "toda unidade tem address/PostalAddress");
ok(astoria.address.streetAddress === "30-79 Steinway Street", `streetAddress separado corretamente → "${astoria.address.streetAddress}"`);
ok(astoria.address.addressLocality === "Astoria", `addressLocality → "${astoria.address.addressLocality}"`);
ok(astoria.address.addressRegion === "NY", `addressRegion → "${astoria.address.addressRegion}"`);
ok(astoria.address.postalCode === "11103", `postalCode → "${astoria.address.postalCode}"`);
ok(astoria.address.addressCountry === "US", "addressCountry → US (deduzido do padrão UF+ZIP, não chutado)");
ok(astoria.telephone === "+17189565530", "telephone é o da unidade (não o forward_number)");

// ── 3. Horários — cruzados com o que o dono escreveu por extenso ────────────────────────────────
secao("3. openingHoursSpecification × horário declarado pelo dono");
// Dono: "Astoria: Mon–Sat 10am–8pm, Sun 11am–7pm"
const hA = astoria.openingHoursSpecification;
const dom = hA.find((s) => s.dayOfWeek === "Sunday" || (Array.isArray(s.dayOfWeek) && s.dayOfWeek.includes("Sunday")));
const semana = hA.find((s) => Array.isArray(s.dayOfWeek) && s.dayOfWeek.includes("Monday"));
ok(hA.length === 2, `Astoria agrupou em 2 specs (domingo + Mon–Sat) — tem ${hA.length}`);
ok(dom.dayOfWeek === "Sunday" && dom.opens === "11:00" && dom.closes === "19:00", `domingo 11:00–19:00 (dono: "Sun 11am–7pm") → ${dom.opens}–${dom.closes}`);
ok(semana.opens === "10:00" && semana.closes === "20:00", `Mon–Sat 10:00–20:00 (dono: "Mon–Sat 10am–8pm") → ${semana.opens}–${semana.closes}`);
ok(semana.dayOfWeek.join(",") === "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday", "os 6 dias iguais viraram UM spec com array de dayOfWeek");
const salon = lugares.find((n) => /UES Salon/.test(n.name)).openingHoursSpecification;
const salonSem = salon.find((s) => Array.isArray(s.dayOfWeek) && s.dayOfWeek.includes("Monday"));
ok(salonSem.opens === "09:00" && salonSem.closes === "19:00", `UES Salon Mon–Sat 09:00–19:00 (dono: "Mon–Sat 9am–7pm") → ${salonSem.opens}–${salonSem.closes}`);
const med = lugares.find((n) => /Med Spa/.test(n.name)).openingHoursSpecification;
const medDom = med.find((s) => s.dayOfWeek === "Sunday");
ok(medDom.opens === "10:00" && medDom.closes === "17:00", `UES Med Spa domingo 10:00–17:00 (dono: "Sun 10am–5pm") → ${medDom.opens}–${medDom.closes}`);
ok(hA.every((s) => /^\d{2}:\d{2}$/.test(s.opens) && /^\d{2}:\d{2}$/.test(s.closes)), "opens/closes no formato hh:mm 24h");

// ── 4. Catálogo e preço ─────────────────────────────────────────────────────────────────────────
secao("4. OfferCatalog");
const cat = org.hasOfferCatalog;
ok(cat["@type"] === "OfferCatalog", "hasOfferCatalog é um OfferCatalog (na Organization, domínio válido)");
ok(cat.itemListElement.length === 20, `os 20 serviços ativos entraram — ${cat.itemListElement.length}`);
ok(cat.numberOfItems === 20, "numberOfItems bate com a lista");
const corte = cat.itemListElement.find((o) => o.itemOffered.name === "Haircut · Astoria");
ok(corte.price === "60.00" && corte.priceCurrency === "USD", `preço decimal + moeda ISO → ${corte.price} ${corte.priceCurrency}`);
ok(corte.itemOffered["@type"] === "Service", "itemOffered é um Service");
ok(corte.itemOffered.description === "60 min", "duração vira description factual");
const semPreco = cat.itemListElement.find((o) => o.itemOffered.name === "CoolSculpting Elite");
ok(!!semPreco, "serviço SEM preço continua no catálogo (o serviço existe)");
ok(semPreco.price === undefined && semPreco.priceCurrency === undefined, "…mas SEM price e SEM priceCurrency inventados");
// priceRange é definido em LocalBusiness (schema.org), NÃO em Organization — então mora nos nós
// de unidade, e a Organization não pode tê-lo.
ok(org.priceRange === undefined, "Organization NÃO carrega priceRange (a propriedade é de LocalBusiness)");
ok(astoria.priceRange === "$60–$169", `priceRange no LocalBusiness, do menor ao maior preço → ${astoria.priceRange}`);
ok(astoria.priceRange.length <= 100, "priceRange dentro do limite de 100 chars do Google");

// ── 5. A regra da moeda: sem fuso conhecido, NENHUM preço sai ───────────────────────────────────
secao("5. Moeda desconhecida → preço não é publicado");
ok(moedaDoFuso("America/New_York") === "USD" && moedaDoFuso("America/Sao_Paulo") === "BRL", "mapa de fuso→moeda");
ok(moedaDoFuso("Asia/Tokyo") === null && moedaDoFuso("") === null, "fuso não mapeado → null (não chuta USD)");
// ⚠️ CENÁRIO ATUALIZADO EM 2026-08-11. Antes bastava tirar o fuso do NATURA para a moeda ficar
// desconhecida. Hoje não basta — e é de propósito: o país que os PRÓPRIOS endereços afirmam
// ("NY 11103" → US) passou a valer como moeda, porque ele já é publicado no JSON-LD como
// addressCountry. Sem isso, a primeira publicação real (Natura) saiu com 20 serviços e ZERO
// preços — a trava de moeda estava escondendo justamente o dado que mais se pergunta à IA.
// O PRINCÍPIO desta seção não mudou nem um pouco: **sem moeda determinável, nenhum preço sai.**
// O que mudou é o cenário que produz "indeterminável": agora é preciso que nem o fuso nem o país
// sejam conhecidos — endereço que não casa com nenhum padrão de país (aqui, só o nome da rua).
const SEM_PAIS = { ...NATURA, bruto: { ...NATURA.bruto,
  locations: (NATURA.bruto.locations || []).map((l) => ({ ...l, address: "Rua Sem Pais 123", city: "" })) } };
const semFuso = grafoDoNegocio(SEM_PAIS, { hours: HORAS_NATURA, tz: "" });
const orgSF = semFuso["@graph"].find((n) => n["@type"] === "Organization");
ok(orgSF.hasOfferCatalog.itemListElement.length === 20, "os serviços continuam listados (o serviço é fato)");
ok(orgSF.hasOfferCatalog.itemListElement.every((o) => o.price === undefined), "NENHUM preço publicado sem moeda determinável");
ok(!semFuso["@graph"].some((n) => n.priceRange), "nenhum priceRange sem moeda");
ok(!JSON.stringify(semFuso).includes("60.00"), "o número do preço não aparece em lugar nenhum do grafo");
ok(precoHumano(11800, "BRL") === "R$118" && precoHumano(11800, "USD") === "$118", "o MESMO price_cents rende símbolos diferentes — por isso não se chuta");
ok(faixaDePreco(NATURA.bruto.services, null) === undefined, "faixaDePreco sem moeda → undefined");

// ── 6. A KB interna NÃO vira conteúdo público ───────────────────────────────────────────────────
secao("6. client_kb não vaza");
const qs = perguntas(NATURA, EXTRA);
const tudo = JSON.stringify(qs) + llmsTxt(NATURA, EXTRA) + JSON.stringify(g);
ok(!tudo.includes("WHO AM I"), "a persona do agente NÃO aparece");
ok(!tudo.includes("NEVER invent"), "as regras internas NÃO aparecem");
ok(!tudo.includes("WE DO NOT DO NAILS"), "a regra de serviço interna NÃO aparece");
ok(!tudo.includes("pricing rule"), "a estratégia de preço NÃO aparece");
ok(!tudo.includes("LILIAN"), "o nome interno da agente NÃO aparece");
// …e o que o dono LIBEROU explicitamente aparece.
const comLiberada = perguntas(NATURA, { ...EXTRA, faqPublico: [{ q: "Do you sell gift cards?", a: "Yes, gift cards are available for purchase." }] });
ok(comLiberada.some((p) => p.q === "Do you sell gift cards?"), "a linha marcada aeo_publico=true aparece");
ok(comLiberada.length === qs.length + 1, "…e só ela (uma a mais que sem liberação)");

// ── 7. Sem fato → sem seção ─────────────────────────────────────────────────────────────────────
secao("7. Sem fato, sem seção");
const VAZIO = { slug: "vazio", nome: "Negócio Novo", cor: "#000000", sobre: "", cidade: "", telefone: "", lang: "pt",
  bruto: { found: true, business_name: "Negócio Novo", lang: "pt", config: {}, services: [], locations: [], faq: [] } };
const qv = perguntas(VAZIO, {});
ok(qv.length === 0, "tenant sem cadastro → nenhuma pergunta respondida (não inventa)");
const gv = grafoDoNegocio(VAZIO, {});
ok(!JSON.stringify(gv).includes("address"), "nenhuma propriedade address quando não há endereço");
ok(!JSON.stringify(gv).includes("openingHours"), "nenhum horário quando não há agenda");
ok(!JSON.stringify(gv).includes("hasOfferCatalog"), "nenhum catálogo quando não há serviço");
ok(horariosSpec([]) === undefined && horariosSpec(null) === undefined, "agenda vazia → undefined, não [] vazio");
ok(horariosSpec([{ weekday: 2, start_min: 600, end_min: 600 }]) === undefined, "faixa impossível (fecha == abre) é descartada");
ok(horariosSpec([{ weekday: 9, start_min: 600, end_min: 700 }]) === undefined, "weekday fora de 0..6 é descartado");
// Endereço em formato não reconhecido: a verdade inteira vai para streetAddress, sem CEP chutado.
const livre = enderecoPostal({ address: "Rua das Flores, sem número, ao lado da praça", city: "Olinda" });
ok(livre.streetAddress === "Rua das Flores, sem número, ao lado da praça", "endereço livre inteiro preservado em streetAddress");
ok(livre.postalCode === undefined && livre.addressCountry === undefined, "…sem postalCode nem addressCountry inventados");
// Endereço brasileiro reconhecido.
const br = enderecoPostal({ address: "Av. Paulista 1000, São Paulo - SP, 01310-100", city: "São Paulo" });
ok(br.postalCode === "01310-100" && br.addressCountry === "BR" && br.addressRegion === "SP", `CEP brasileiro reconhecido → ${br.postalCode} / ${br.addressRegion} / ${br.addressCountry}`);

// ── 8. Segurança do JSON-LD dentro de <script> ──────────────────────────────────────────────────
secao("8. Escape");
const MAU = { slug: "mau", nome: 'Bar </script><img src=x onerror=alert(1)> "Zé"', cor: "#111111", cidade: "", telefone: "", lang: "pt",
  bruto: { found: true, business_name: "x", lang: "pt", config: {}, services: [], locations: [{ name: "L", address: "Rua A, 1", city: "Y", phone: "+1" }], faq: [] } };
const saida = escaparJsonLd(grafoDoNegocio(MAU, {}));
ok(!saida.includes("</script>"), "nenhum </script> literal na saída");
ok(!saida.includes("<") && !saida.includes(">"), "< e > sempre escapados como \\u003c / \\u003e");
ok(JSON.parse(saida)["@graph"][0].name.includes("</script>"), "…e o valor original sobrevive intacto ao parse");

// ── 9. llms.txt no formato da spec ──────────────────────────────────────────────────────────────
secao("9. llms.txt (llmstxt.org)");
const txt = llmsTxt(NATURA, EXTRA);
const linhas = txt.split("\n");
ok(linhas[0] === "# Natura Spa + Salon", "H1 obrigatório com o nome do negócio");
ok(linhas.some((l) => l.startsWith("> ")), "blockquote de resumo");
ok((txt.match(/^## /gm) || []).length >= 4, "seções H2");
ok(txt.includes("$60") && txt.includes("11:00"), "os fatos (preço e horário) estão no texto");
const txtSemMoeda = llmsTxt(SEM_PAIS, { hours: HORAS_NATURA, tz: "" });
ok(!txtSemMoeda.includes("$60"), "sem moeda determinável, o llms.txt também não publica preço");

// ── 10. Isolamento entre tenants ────────────────────────────────────────────────────────────────
secao("10. Multi-tenant");
const g1 = JSON.stringify(grafoDoNegocio(NATURA, EXTRA));
const g2 = JSON.stringify(grafoDoNegocio(VAZIO, {}));
const g3 = JSON.stringify(grafoDoNegocio(NATURA, EXTRA));
ok(g1 === g3, "mesma entrada → mesma saída (nenhum estado guardado entre chamadas)");
ok(!g2.includes("Natura") && !g2.includes("Steinway") && !g2.includes("718"), "nada da Natura vaza no grafo do outro tenant");
ok(g1.includes("/site/natura-spa") && g2.includes("/site/vazio"), "cada grafo aponta só para a própria URL");
ok(tipoDoNegocio("restaurante") === "Restaurant" && tipoDoNegocio("coisa-que-nao-existe") === "LocalBusiness", "ramo desconhecido cai em LocalBusiness (nunca chuta subtipo)");

console.log(falhas ? `\n💥 ${falhas} falha(s)\n` : "\n🎉 tudo passou\n");
process.exit(falhas ? 1 : 0);
