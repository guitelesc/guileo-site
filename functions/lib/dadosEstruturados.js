// functions/lib/dadosEstruturados.js — OS FATOS DO NEGÓCIO, EM FORMATO DE MÁQUINA.
//
// ── POR QUE ISTO EXISTE ─────────────────────────────────────────────────────────────────────────
// Quando alguém pergunta ao ChatGPT/Perplexity/Google "qual o melhor salão em Astoria?", o modelo
// responde com o que ele CONSEGUIU LER. O site do cliente é React: sem renderização no servidor,
// o que existe no HTML cru é uma casca vazia. Para um leitor que não executa JavaScript, o negócio
// do cliente literalmente NÃO TEM endereço, NÃO TEM preço e NÃO TEM horário.
//
// Este arquivo transforma o cadastro REAL do tenant (biz_locations, biz_services, biz_schedules)
// em duas coisas que um leitor-máquina entende sem rodar JS:
//   1. JSON-LD schema.org (LocalBusiness + OfferCatalog + horários) → entra no HTML pelo SSR
//   2. Texto de resposta ("quanto custa X", "abre domingo?", "onde fica") → a página /site/aeo/:slug
//
// ── A REGRA QUE MANDA EM TUDO AQUI: SEM FATO, SEM CAMPO ─────────────────────────────────────────
// Toda função abaixo OMITE o que não sabe. Sem endereço cadastrado → nenhuma propriedade address.
// Sem preço → nenhuma Offer. Sem moeda determinável → o preço NÃO SAI (dizer "$118" para um preço
// de R$118 é inventar um fato, e um dado estruturado errado é pior que dado estruturado nenhum:
// ele é uma mentira que a máquina repete com confiança). Nada aqui gera texto de marketing.
//
// ── O QUE ISTO NÃO FAZ ──────────────────────────────────────────────────────────────────────────
// Não compra ranking. Ninguém — nem a Guileo, nem a Google — controla o que um modelo cita.
// O que este arquivo entrega é a condição NECESSÁRIA (os dados legíveis, estruturados e
// verdadeiros), nunca a condição suficiente. Qualquer texto de venda que saia daqui diz isso.
//
// ── FONTES (pesquisadas em 2026-08-11) ──────────────────────────────────────────────────────────
// • Google LocalBusiness structured data (página atualizada 2025-12-10):
//   https://developers.google.com/search/docs/appearance/structured-data/local-business
//   Obrigatórios: name + address. Recomendados/usados: geo, openingHoursSpecification, telephone,
//   url, priceRange (máx 100 chars), aggregateRating, review, menu, department, servesCuisine.
//   ⚠️ areaServed e sameAs NÃO estão na lista do LocalBusiness (sameAs vale em Organization).
// • schema.org/LocalBusiness v30.0 (2026-03-19) — https://schema.org/LocalBusiness
// • schema.org/OfferCatalog e /Offer v30.0 (2026-03-19) — hasOfferCatalog tem domínio
//   Organization|Person|Service e alcance OfferCatalog; OfferCatalog herda de ItemList e o
//   itemListElement aceita Thing (logo, um Offer nu é válido); Offer.itemOffered aceita Service.
//   `price` NÃO foi substituído por `priceSpecification` — são complementares.
//   https://schema.org/OfferCatalog · https://schema.org/Offer
// • openingHoursSpecification: dayOfWeek "Monday".."Sunday", opens/closes em hh:mm 24h;
//   fechado o dia todo = opens e closes ambos "00:00" (Google LocalBusiness, 2025-12-10).
// • ⚠️ FAQPage foi DESCONTINUADO no Google: o rich result parou de aparecer em 2026-05-07 e a
//   documentação foi removida (changelog da página, atualizada 2026-07-29):
//   https://developers.google.com/search/docs/appearance/structured-data/faqpage
//   → Não emitimos FAQPage. Emitir não é penalizado, mas não entrega nada no Google, e não há
//     fonte primária dizendo que motor de IA pesa FAQPage. Preferimos texto legível de verdade.
// • Colocação do JSON-LD: <head> NÃO é obrigatório, <body> é explicitamente aceito
//   (https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data,
//   atualizada 2025-12-10). @graph vs múltiplos <script>: nenhuma preferência documentada.
// • Crawlers de IA e JavaScript: NENHUM dos fornecedores (OpenAI, Perplexity, Anthropic) declara
//   se executa JS. A única medição citável é a da Vercel (2024-12-17):
//   https://vercel.com/blog/the-rise-of-the-ai-crawler — "none of the major AI crawlers currently
//   render JavaScript". Dado de ~20 meses e não-oficial → tratado como NÃO VERIFICADO.
//   A conclusão operacional não depende dele: servir no HTML cru é seguro nos dois cenários.

// ── Escapes ─────────────────────────────────────────────────────────────────────────────────────

// JSON-LD vai DENTRO de <script>. Uma string do cadastro contendo "</script>" fecharia a tag e o
// resto viraria HTML executável. Escapar <, > e & na saída JSON fecha isso sem alterar o valor
// (\u003c é o MESMO caractere para qualquer parser JSON).
export const escaparJsonLd = (obj) =>
  JSON.stringify(obj).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

export const escaparHtml = (v) =>
  String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Remove chaves vazias/nulas recursivamente. É o executor da regra "sem fato, sem campo":
// em vez de cada montador lembrar de checar, ele monta e o que não tinha valor some.
export function semVazios(v) {
  if (Array.isArray(v)) {
    const a = v.map(semVazios).filter((x) => x !== undefined);
    return a.length ? a : undefined;
  }
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, val] of Object.entries(v)) {
      const lim = semVazios(val);
      if (lim !== undefined) o[k] = lim;
    }
    // Um objeto que só sobrou com @type não é um fato, é uma casca.
    return Object.keys(o).filter((k) => k !== "@type").length ? o : undefined;
  }
  if (typeof v === "string") { const s = v.trim(); return s ? s : undefined; }
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  return v == null ? undefined : v;
}

// ── Moeda ───────────────────────────────────────────────────────────────────────────────────────
// biz_services guarda `price_cents` e NÃO guarda moeda. Um preço sem moeda é ambíguo, e chutar
// "USD" num negócio brasileiro publicaria "$118" onde o certo é "R$118" — um fato inventado.
// A única pista confiável no cadastro é o fuso da unidade (biz_locations.tz), que o onboarding
// preenche. Mapa EXPLÍCITO: fuso não listado → moeda desconhecida → o preço não é publicado.
const MOEDA_POR_FUSO = {
  "America/New_York": "USD", "America/Chicago": "USD", "America/Denver": "USD",
  "America/Phoenix": "USD", "America/Los_Angeles": "USD", "America/Anchorage": "USD",
  "Pacific/Honolulu": "USD", "America/Detroit": "USD", "America/Puerto_Rico": "USD",
  "America/Sao_Paulo": "BRL", "America/Bahia": "BRL", "America/Fortaleza": "BRL",
  "America/Recife": "BRL", "America/Manaus": "BRL", "America/Belem": "BRL",
  "America/Toronto": "CAD", "America/Vancouver": "CAD", "America/Edmonton": "CAD",
  "America/Mexico_City": "MXN", "America/Bogota": "COP", "America/Lima": "PEN",
  "America/Argentina/Buenos_Aires": "ARS", "America/Santiago": "CLP",
  "Europe/Lisbon": "EUR", "Europe/Madrid": "EUR", "Europe/Paris": "EUR",
  "Europe/Berlin": "EUR", "Europe/Rome": "EUR", "Europe/Dublin": "EUR",
  "Europe/London": "GBP",
};
export const moedaDoFuso = (tz) => MOEDA_POR_FUSO[String(tz || "").trim()] || null;

// ── MOEDA PELO PAÍS DO ENDEREÇO — o resgate quando o fuso não foi cadastrado ─────────────────
// Descoberto na PRIMEIRA publicação real (Natura Spa, 2026-08-11): 20 serviços com preço no
// cadastro e ZERO preço no dado estruturado, porque o perfil não tinha `tz`. A trava de moeda
// estava certa (preço sem moeda é ambíguo), mas ela escondia justamente o dado que as pessoas
// mais perguntam à IA: "quanto custa".
//
// Isto NÃO é chute: o país já está no registro e já é PUBLICADO no JSON-LD como `addressCountry`
// — o mesmo endereço que diz "NY 11103" é o que diz "US". Usar um fato que já sai na página não
// inventa nada; deixar de usá-lo é que estava custando o preço inteiro do cliente.
// País desconhecido continua sem moeda, e sem moeda o preço continua não saindo.
const MOEDA_POR_PAIS = { US: "USD", BR: "BRL", CA: "CAD", MX: "MXN", PT: "EUR", ES: "EUR", GB: "GBP" };
export const moedaDoPais = (pais) => MOEDA_POR_PAIS[String(pais || "").trim().toUpperCase()] || null;

// Símbolo só para o TEXTO humano. Se a moeda for desconhecida nada disso é chamado.
const SIMBOLO = { USD: "$", CAD: "CA$", BRL: "R$", EUR: "€", GBP: "£", MXN: "MX$", ARS: "AR$", CLP: "CLP$", COP: "COP$", PEN: "S/" };

// ⚠️ A ARMADILHA QUE CUSTOU UM BUG AQUI (pego pelo teste em 2026-08-11):
// `Number(null)` é **0**, não NaN. `price_cents: null` (serviço sem preço — a Natura tem 3:
// CoolSculpting, Laser, Acupuntura) passava direto por `Number.isFinite` e era publicado como
// **"0.00"**, ou seja, GRÁTIS, em dado estruturado, para o mundo inteiro ler. Era exatamente o
// tipo de fato inventado que este arquivo existe para impedir — e do jeito mais caro possível.
// Por isso a conversão passa por AQUI e só aqui: null/undefined/"" viram null, nunca zero.
//
// ── E O ZERO TAMBÉM NÃO É "GRÁTIS" (corrigido 2026-08-11, revisão adversarial) ────────────────
// A versão anterior deste comentário dizia: "price_cents = 0 significa de graça, e isso é um
// fato". Não é. Olhando a produção: `luistelesc@gmail.com` tem 4 serviços com 0 e
// `smart@guileoai.com` tem 1 — todos usados como "ainda não cadastrei o preço", nenhum como
// cortesia. O campo é `not null default 0` em boa parte dos cadastros, então zero é o que sobra
// de quem não preencheu, não uma decisão comercial.
// Publicar "R$ 0,00" em dado estruturado é anunciar serviço gratuito para o mundo inteiro, e
// dado estruturado não se despublica: uma vez lido pelo modelo, não volta atrás.
// Regra: **zero é ausência de preço, não preço zero.** Cortesia de verdade é caso raro e se
// anuncia com palavra ("primeira sessão por nossa conta"), não com um campo numérico que também
// é o valor padrão de quem não preencheu. Errar para omissão custa uma linha a menos no JSON;
// errar para grátis custa o cliente aparecendo e cobrando o que foi anunciado.
export function centavos(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;   // ≤ 0 → sem preço, jamais "grátis"
  return n;
}

// 6000 centavos → "60.00" (o formato que schema.org/Offer.price espera: número decimal simples).
export const precoDecimal = (v) => {
  const c = centavos(v);
  return c === null ? null : (c / 100).toFixed(2);
};

// 6000 + USD → "$60". Centavos exatos aparecem quando existem ("$59.50"), nunca ".00" inútil.
export function precoHumano(v, moeda) {
  const cents = centavos(v);
  if (cents === null || !moeda) return null;
  const s = SIMBOLO[moeda] || `${moeda} `;
  return cents % 100 === 0 ? `${s}${cents / 100}` : `${s}${(cents / 100).toFixed(2)}`;
}

// ── Endereço ────────────────────────────────────────────────────────────────────────────────────
// biz_locations.address é UMA string livre ("30-79 Steinway Street, Astoria, NY 11103") e
// schema.org quer as partes separadas. A quebra abaixo é conservadora: ela só promove uma parte a
// addressRegion/postalCode/addressCountry quando o formato BATE com um padrão inequívoco.
// Não bateu → o endereço inteiro vira streetAddress (que é verdade, só menos granular) e a
// localidade vem do campo `city`, que é dado próprio. NUNCA se inventa um CEP nem um país.
const US_FIM = /^([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/;              // "NY 11103"
const BR_FIM = /^(\d{5}-?\d{3})$/;                                // "01310-100"
const BR_UF = /^([A-Z]{2})$/;

export function enderecoPostal(loc) {
  const bruto = String(loc?.address || "").trim();
  const cidadeCampo = String(loc?.city || "").trim();
  // `city` costuma vir como "Astoria, NY" — a última vírgula carrega a região.
  let cidade = cidadeCampo, regiao = "";
  const mc = cidadeCampo.match(/^(.+),\s*([A-Za-z]{2})$/);
  if (mc) { cidade = mc[1].trim(); regiao = mc[2].toUpperCase(); }

  if (!bruto) {
    // Sem endereço cadastrado não existe PostalAddress. Um LocalBusiness sem address não é
    // elegível ao rich result do Google (address é 1 dos 2 campos obrigatórios) — e é assim
    // que tem que ser: a alternativa seria publicar um endereço que não existe.
    return semVazios({ "@type": "PostalAddress", addressLocality: cidade, addressRegion: regiao });
  }

  const partes = bruto.split(",").map((s) => s.trim()).filter(Boolean);
  const fim = partes.length > 1 ? partes[partes.length - 1] : "";

  const us = fim.match(US_FIM);
  if (us && partes.length >= 2) {
    return semVazios({
      "@type": "PostalAddress",
      streetAddress: partes.slice(0, -2).join(", ") || partes[0],
      addressLocality: (partes.length >= 3 ? partes[partes.length - 2] : cidade) || cidade,
      addressRegion: us[1],
      postalCode: us[2],
      addressCountry: "US",
    });
  }
  const br = fim.match(BR_FIM);
  if (br && partes.length >= 2) {
    const antes = partes[partes.length - 2] || "";
    const muf = antes.match(/^(.+)\s*[-/]\s*([A-Z]{2})$/) || (BR_UF.test(antes) ? [null, "", antes] : null);
    return semVazios({
      "@type": "PostalAddress",
      streetAddress: partes.slice(0, muf && muf[1] ? -2 : -1).join(", ") || partes[0],
      addressLocality: (muf && muf[1] ? muf[1].trim() : cidade) || cidade,
      addressRegion: muf ? muf[2] : regiao,
      postalCode: br[1],
      addressCountry: "BR",
    });
  }

  // Formato não reconhecido: guarda a verdade inteira em streetAddress. Sem país, sem CEP.
  return semVazios({
    "@type": "PostalAddress",
    streetAddress: bruto,
    addressLocality: cidade,
    addressRegion: regiao,
  });
}

// ── Horários ────────────────────────────────────────────────────────────────────────────────────
// A fonte é biz_schedules (weekday, start_min, end_min) — a agenda REAL por unidade, a mesma que
// a Gui consulta para marcar. Não é uma "vitrine de horário" digitada à parte que envelhece: é
// quando o negócio de fato aceita cliente. Se a agenda mudar, isto muda junto.
//
// weekday 0 = DOMINGO. Verificado contra o texto de horário do próprio cliente em 2026-08-11:
// nas 3 unidades da Natura, weekday 0 bateu exatamente com o domingo declarado (Astoria
// 660–1140 min = 11h–19h = "Sun 11am–7pm") e 1..6 com "Mon–Sat". Convenção idêntica à do
// EXTRACT(DOW) do Postgres e do getDay() do JavaScript.
const DIAS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const hhmm = (min) => {
  const m = Math.max(0, Math.min(1439, Math.round(Number(min))));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

// Agrupa dias com o MESMO par abre/fecha num único spec (dayOfWeek aceita array) — 7 specs
// idênticos poluem o grafo sem acrescentar informação.
export function horariosSpec(linhas) {
  const porFaixa = new Map();
  for (const l of Array.isArray(linhas) ? linhas : []) {
    const d = Number(l?.weekday), a = Number(l?.start_min), f = Number(l?.end_min);
    if (!Number.isInteger(d) || d < 0 || d > 6) continue;
    if (!Number.isFinite(a) || !Number.isFinite(f) || f <= a) continue;   // faixa impossível → fora
    const k = `${hhmm(a)}|${hhmm(f)}`;
    if (!porFaixa.has(k)) porFaixa.set(k, new Set());
    porFaixa.get(k).add(d);
  }
  if (!porFaixa.size) return undefined;   // sem agenda → nenhuma propriedade de horário
  const specs = [];
  for (const [k, dias] of porFaixa) {
    const [opens, closes] = k.split("|");
    const lista = [...dias].sort((x, y) => x - y).map((d) => DIAS[d]);
    specs.push({ "@type": "OpeningHoursSpecification", dayOfWeek: lista.length === 1 ? lista[0] : lista, opens, closes });
  }
  return specs;
}

// ── Tipo schema.org do negócio ──────────────────────────────────────────────────────────────────
// Só sobe de LocalBusiness para um subtipo quando o ramo cadastrado é inequívoco. Chutar
// "MedicalClinic" num negócio que é outra coisa é dado errado — LocalBusiness sempre é verdade.
const TIPO_POR_RAMO = {
  salon: "HealthAndBeautyBusiness", "salons-spas": "HealthAndBeautyBusiness", spa: "DaySpa",
  spas: "DaySpa", barbershop: "HairSalon", restaurante: "Restaurant", restaurant: "Restaurant",
  restaurants: "Restaurant", cafe: "CafeOrCoffeeShop", bakery: "Bakery", bar: "BarOrPub",
  dental: "Dentist", "dental-clinics": "Dentist", clinic: "MedicalClinic",
  "medical-clinics": "MedicalClinic", "veterinary-clinics": "VeterinaryCare",
  gym: "ExerciseGym", "gyms-fitness": "ExerciseGym", "law-firms": "LegalService",
  accountants: "AccountingService", "real-estate": "RealEstateAgent",
  "auto-dealerships": "AutoDealer", "plumbing-hvac": "Plumber",
  "cleaning-services": "HomeAndConstructionBusiness", "home-contractors": "GeneralContractor",
};
export const tipoDoNegocio = (ramo) => TIPO_POR_RAMO[String(ramo || "").trim().toLowerCase()] || "LocalBusiness";

// ── Catálogo de serviços ────────────────────────────────────────────────────────────────────────
// Serviço SEM preço continua no catálogo (o serviço existe — é fato), só sem Offer.price.
// Serviço com preço mas sem moeda determinável entra SEM preço: ver a nota em MOEDA_POR_FUSO.
export function catalogo(servicos, moeda, urlBase) {
  const itens = (Array.isArray(servicos) ? servicos : [])
    .filter((s) => s && String(s.name || "").trim())
    .map((s) => {
      const dur = Number(s.duration_min);
      const preco = moeda ? precoDecimal(s.price_cents) : null;
      return semVazios({
        "@type": "Offer",
        itemOffered: semVazios({
          "@type": "Service",
          name: String(s.name).trim(),
          // Duração é fato do cadastro e não tem propriedade própria em Service — vai como texto.
          description: Number.isFinite(dur) && dur > 0 ? `${dur} min` : undefined,
        }),
        price: preco || undefined,
        priceCurrency: preco ? moeda : undefined,
        url: urlBase || undefined,
      });
    })
    .filter(Boolean);
  if (!itens.length) return undefined;
  return { "@type": "OfferCatalog", name: "Services", numberOfItems: itens.length, itemListElement: itens };
}

// priceRange do Google é Text, máx 100 chars. Só sai quando há preço COM moeda conhecida.
export function faixaDePreco(servicos, moeda) {
  if (!moeda) return undefined;
  const v = (Array.isArray(servicos) ? servicos : [])
    .map((s) => centavos(s?.price_cents)).filter((n) => n !== null && n > 0);
  if (!v.length) return undefined;
  const min = Math.min(...v), max = Math.max(...v);
  const a = precoHumano(min, moeda), b = precoHumano(max, moeda);
  return (min === max ? a : `${a}–${b}`).slice(0, 100);
}

// ── O grafo ─────────────────────────────────────────────────────────────────────────────────────
// site  = objeto de carregarSite() (functions/lib/sitePwa.js) — já traz `bruto` = resposta crua da
//         RPC pública client_site_public.
// extra = { hours: { "<nome da unidade>": [ {weekday,start_min,end_min}, ... ] }, tz }
//
// Uma unidade  → um nó LocalBusiness (o negócio É o lugar).
// Duas ou mais → um nó Organization (a marca, dona do catálogo) + um LocalBusiness POR unidade,
//   cada um com o SEU endereço, o SEU telefone e o SEU horário, apontando de volta com
//   parentOrganization. É a modelagem honesta: os preços da Natura mudam entre Astoria e a UES,
//   então fingir que existe "um endereço" seria escolher um e apagar dois.

// O país que os PRÓPRIOS endereços do cliente já afirmam (o mesmo que sai como addressCountry no
// JSON-LD). Só devolve quando TODAS as unidades concordam: negócio com endereço em dois países
// não tem "a" moeda, e aí o preço volta a não sair — que continua sendo o comportamento certo.
export function paisDasUnidades(locais) {
  const paises = new Set();
  for (const l of (Array.isArray(locais) ? locais : [])) {
    const e = enderecoPostal(l);
    if (e && e.addressCountry) paises.add(e.addressCountry);
  }
  return paises.size === 1 ? [...paises][0] : null;
}

export function grafoDoNegocio(site, extra = {}) {
  const d = site?.bruto || {};
  const base = `https://guileoai.com/site/${site.slug}`;
  const locais = (Array.isArray(d.locations) ? d.locations : []).filter((l) => l && (l.address || l.city || l.phone));
  // Fuso primeiro (mais preciso); país do endereço como resgate. Ver a nota em MOEDA_POR_PAIS:
  // sem isto, o Natura publicou 20 serviços e ZERO preços na primeira publicação real.
  const moeda = moedaDoFuso(extra.tz) || moedaDoPais(paisDasUnidades(locais));
  const tipo = tipoDoNegocio(d.industry);
  const horas = extra.hours || {};

  const imagem = d.config?.hero_url || d.config?.logo_url || undefined;
  const cat = catalogo(d.services, moeda, base);
  const faixa = faixaDePreco(d.services, moeda);
  // review_link é um perfil do negócio em OUTRO site (Google/Yelp) — exatamente o que `sameAs`
  // descreve. Vale em Organization; NÃO está na lista do LocalBusiness do Google, então só é
  // emitido no nó que o suporta de verdade (e no LocalBusiness único, onde o nó É a organização).
  const perfil = String(d.review_link || "").trim() || undefined;

  const noDeLugar = (l, i, paiId) => semVazios({
    "@type": tipo,
    "@id": `${base}#local-${i}`,
    name: locais.length > 1 && String(l.name || "").trim()
      ? `${site.nome} — ${String(l.name).trim()}` : site.nome,
    address: enderecoPostal(l),
    telephone: String(l.phone || "").trim() || undefined,
    openingHoursSpecification: horariosSpec(horas[String(l.name || "")] || horas[String(l.name || "").trim()]),
    url: base,
    image: imagem,
    priceRange: faixa,
    parentOrganization: paiId ? { "@id": paiId } : undefined,
  });

  const nos = [];

  if (locais.length <= 1) {
    const l = locais[0] || {};
    nos.push(semVazios({
      "@type": tipo,
      "@id": `${base}#negocio`,
      name: site.nome,
      description: String(d.config?.about || "").trim() || undefined,
      address: enderecoPostal(l),
      telephone: String(l.phone || site.telefone || "").trim() || undefined,
      openingHoursSpecification: horariosSpec(horas[String(l.name || "")] || Object.values(horas)[0]),
      url: base,
      image: imagem,
      priceRange: faixa,
      sameAs: perfil ? [perfil] : undefined,
      hasOfferCatalog: cat,
    }));
  } else {
    const orgId = `${base}#negocio`;
    nos.push(semVazios({
      "@type": "Organization",
      "@id": orgId,
      name: site.nome,
      description: String(d.config?.about || "").trim() || undefined,
      url: base,
      image: imagem,
      sameAs: perfil ? [perfil] : undefined,
      hasOfferCatalog: cat,
    }));
    locais.forEach((l, i) => { const n = noDeLugar(l, i, orgId); if (n) nos.push(n); });
  }

  const limpos = nos.filter(Boolean);
  return limpos.length ? { "@context": "https://schema.org", "@graph": limpos } : null;
}

// O <script> pronto para injetar no HTML. Devolve "" quando não há fato nenhum — página sem
// dados não ganha uma tag vazia.
export function blocoJsonLd(site, extra) {
  const g = grafoDoNegocio(site, extra);
  return g ? `<script type="application/ld+json">${escaparJsonLd(g)}</script>` : "";
}

// ── As respostas em texto ───────────────────────────────────────────────────────────────────────
// O que faz um negócio ser CITADO não é a tag: é a resposta estar escrita em algum lugar legível.
// Estas são as perguntas que gente de verdade digita, respondidas SÓ com o cadastro do tenant.
// Cada bloco só nasce se o fato existir. Nenhuma frase adjetiva o negócio ("o melhor", "o mais
// aconchegante") — o texto informa, não elogia.
const T = {
  pt: {
    titulo: (n) => `Perguntas frequentes sobre ${n}`,
    onde: "Onde fica", ondeQ: (n) => `Onde fica ${n}?`,
    tel: "Telefone", telQ: (n) => `Qual o telefone de ${n}?`,
    horas: "Horário de funcionamento", horasQ: (n) => `Que horas ${n} abre e fecha?`,
    precos: "Serviços e preços", precosQ: (n) => `Quanto custa cada serviço em ${n}?`,
    quais: "Serviços oferecidos", quaisQ: (n) => `Quais serviços ${n} oferece?`,
    de: "das", ate: "às", fechado: "fechado",
    dias: ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"],
    apartir: "a partir de", min: "min", semPreco: "preço confirmado no atendimento",
    voltar: "Ver o site", atualizado: "Dados do cadastro do próprio negócio",
    aviso: "Esta página é gerada automaticamente a partir do cadastro do negócio. Só aparece aqui o que o negócio informou.",
  },
  en: {
    titulo: (n) => `Frequently asked questions about ${n}`,
    onde: "Where it is", ondeQ: (n) => `Where is ${n} located?`,
    tel: "Phone", telQ: (n) => `What is the phone number for ${n}?`,
    horas: "Opening hours", horasQ: (n) => `What time does ${n} open and close?`,
    precos: "Services and prices", precosQ: (n) => `How much does each service cost at ${n}?`,
    quais: "Services offered", quaisQ: (n) => `What services does ${n} offer?`,
    de: "from", ate: "to", fechado: "closed",
    dias: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    apartir: "from", min: "min", semPreco: "price confirmed when you book",
    voltar: "Visit the site", atualizado: "Data from the business's own records",
    aviso: "This page is generated automatically from the business's own records. Only what the business provided appears here.",
  },
  es: {
    titulo: (n) => `Preguntas frecuentes sobre ${n}`,
    onde: "Dónde está", ondeQ: (n) => `¿Dónde está ${n}?`,
    tel: "Teléfono", telQ: (n) => `¿Cuál es el teléfono de ${n}?`,
    horas: "Horario", horasQ: (n) => `¿A qué hora abre y cierra ${n}?`,
    precos: "Servicios y precios", precosQ: (n) => `¿Cuánto cuesta cada servicio en ${n}?`,
    quais: "Servicios ofrecidos", quaisQ: (n) => `¿Qué servicios ofrece ${n}?`,
    de: "de", ate: "a", fechado: "cerrado",
    dias: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
    apartir: "desde", min: "min", semPreco: "precio confirmado al reservar",
    voltar: "Ver el sitio", atualizado: "Datos del propio registro del negocio",
    aviso: "Esta página se genera automáticamente a partir del registro del negocio. Solo aparece aquí lo que el negocio informó.",
  },
};
export const textos = (lang) => T[String(lang || "").slice(0, 2).toLowerCase()] || T.pt;

// Horário de UMA unidade em prosa: "segunda a sábado das 10:00 às 20:00; domingo das 11:00 às 19:00"
export function horarioEmTexto(linhas, t) {
  const specs = horariosSpec(linhas);
  if (!specs) return null;
  const nomeDia = (rotulo) => t.dias[DIAS.indexOf(rotulo)] || rotulo;
  return specs.map((s) => {
    const dias = Array.isArray(s.dayOfWeek) ? s.dayOfWeek : [s.dayOfWeek];
    const idx = dias.map((d) => DIAS.indexOf(d)).sort((a, b) => a - b);
    // Sequência contígua vira intervalo ("segunda a sábado"); senão, lista.
    const contigua = idx.length > 2 && idx.every((n, i) => i === 0 || n === idx[i - 1] + 1);
    const rotulo = contigua
      ? `${nomeDia(DIAS[idx[0]])} – ${nomeDia(DIAS[idx[idx.length - 1]])}`
      : idx.map((n) => nomeDia(DIAS[n])).join(", ");
    return `${rotulo}: ${t.de} ${s.opens} ${t.ate} ${s.closes}`;
  });
}

// perguntas(site, extra) → [{ q, blocos: [string] }] — só o que tem fato por trás.
export function perguntas(site, extra = {}) {
  const d = site?.bruto || {};
  const t = textos(d.lang || site.lang);
  const nome = site.nome;
  const locais = (Array.isArray(d.locations) ? d.locations : []).filter(Boolean);
  const moeda = moedaDoFuso(extra.tz) || moedaDoPais(paisDasUnidades(locais));
  const horas = extra.hours || {};
  const servicos = (Array.isArray(d.services) ? d.services : []).filter((s) => s && String(s.name || "").trim());
  const out = [];

  const comEndereco = locais.filter((l) => String(l.address || "").trim() || String(l.city || "").trim());
  if (comEndereco.length) {
    out.push({
      q: t.ondeQ(nome),
      blocos: comEndereco.map((l) => {
        const rot = locais.length > 1 && String(l.name || "").trim() ? `${String(l.name).trim()}: ` : "";
        return rot + (String(l.address || "").trim() || String(l.city || "").trim());
      }),
    });
  }

  const comTel = locais.filter((l) => String(l.phone || "").trim());
  if (comTel.length) {
    out.push({
      q: t.telQ(nome),
      blocos: comTel.map((l) => {
        const rot = locais.length > 1 && String(l.name || "").trim() ? `${String(l.name).trim()}: ` : "";
        return rot + String(l.phone).trim();
      }),
    });
  }

  const blocosHora = [];
  for (const l of locais) {
    const linhas = horas[String(l.name || "")];
    const texto = horarioEmTexto(linhas, t);
    if (!texto) continue;
    const rot = locais.length > 1 && String(l.name || "").trim() ? `${String(l.name).trim()} — ` : "";
    blocosHora.push(rot + texto.join("; "));
  }
  if (blocosHora.length) out.push({ q: t.horasQ(nome), blocos: blocosHora });

  if (servicos.length) {
    // Um serviço por item. Juntar tudo numa linha com separador quebra aqui: os PRÓPRIOS nomes
    // costumam trazer separador ("Haircut · Astoria"), e o resultado vira uma parede ilegível
    // tanto para gente quanto para máquina.
    out.push({ q: t.quaisQ(nome), blocos: servicos.map((s) => String(s.name).trim()) });
    // O bloco de PREÇO só existe se houver preço publicável (valor + moeda conhecida).
    const comPreco = moeda ? servicos.filter((s) => centavos(s.price_cents) !== null) : [];
    if (comPreco.length) {
      out.push({
        q: t.precosQ(nome),
        blocos: comPreco.map((s) => {
          const dur = Number(s.duration_min);
          const dr = Number.isFinite(dur) && dur > 0 ? ` (${dur} ${t.min})` : "";
          return `${String(s.name).trim()}${dr}: ${t.apartir} ${precoHumano(s.price_cents, moeda)}`;
        }),
      });
    }
  }

  // FAQ do próprio dono — SÓ o que ele marcou como público. Ver a nota longa em
  // functions/site/aeo/[slug].js sobre por que client_kb NÃO é uma FAQ pública.
  for (const f of Array.isArray(extra.faqPublico) ? extra.faqPublico : []) {
    const q = String(f?.q || "").trim(), a = String(f?.a || "").trim();
    if (q && a) out.push({ q, blocos: [a] });
  }

  return out;
}

// ── llms.txt ────────────────────────────────────────────────────────────────────────────────────
// Formato conforme llmstxt.org (spec v2, atualizada 2026-08-10): H1 obrigatório com o nome →
// blockquote de resumo → markdown livre → seções H2 com listas de links.
//
// ⚠️ HONESTIDADE SOBRE ESTE ARQUIVO (pesquisado 2026-08-11): NENHUMA empresa de IA declarou que
// seus crawlers leem llms.txt, e há evidência de log contra. Ahrefs analisou 137.210 domínios
// (2026-06-15): 97% dos llms.txt publicados receberam ZERO requisições no mês; bots de
// recuperação de IA foram 1,1% dos acessos (https://ahrefs.com/blog/llmstxt-study/). A Otterly.ai
// mediu 84 de 62.100+ visitas de bot de IA = 0,1% (https://otterly.ai/blog/the-llms-txt-experiment/).
// John Mueller (Google) chamou de "puramente especulativo" e comparou à meta keywords
// (https://www.searchenginejournal.com/google-says-llms-txt-is-purely-speculative-for-now/577576/).
// Único consumidor real e documentado: o Lighthouse do Chrome, que desde 2026-05-07 audita a
// existência do arquivo (https://developer.chrome.com/docs/lighthouse/agentic-browsing/scoring).
//
// Limitação a mais no NOSSO caso: a convenção é ancorada na RAIZ da origem (site.com/llms.txt).
// O site de um tenant vive em guileoai.com/site/:slug, então ele NÃO PODE ter a raiz. Este
// arquivo vive em /site/aeo/:slug.txt, um caminho que agente nenhum descobre por convenção — só
// por link. Ou seja: o benefício realista aqui é ainda menor que o do arquivo na raiz, que já é
// quase zero. Foi construído porque custa perto de nada e o conteúdo é o mesmo fato já apurado;
// NÃO porque vá trazer citação. O que traz citação é a página em HTML e o JSON-LD.
export function llmsTxt(site, extra = {}) {
  const d = site?.bruto || {};
  const t = textos(d.lang || site.lang);
  const base = `https://guileoai.com/site/${site.slug}`;
  const L = [`# ${site.nome}`, ""];

  const resumo = String(d.config?.about || "").trim()
    || [site.nome, site.cidade].filter(Boolean).join(" · ");
  L.push(`> ${resumo.replace(/\s+/g, " ")}`, "");
  L.push(t.aviso, "");

  for (const p of perguntas(site, extra)) {
    L.push(`## ${p.q}`, "");
    for (const b of p.blocos) L.push(`- ${b}`);
    L.push("");
  }

  L.push("## Links", "");
  L.push(`- [${t.voltar}](${base})`);
  const perfil = String(d.review_link || "").trim();
  if (perfil) L.push(`- [${site.nome}](${perfil})`);
  L.push("");
  return L.join("\n");
}
