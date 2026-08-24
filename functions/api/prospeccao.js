// prospeccao.js — A FILA DE ATAQUE. O motor do X-Ray virado para FORA.
//
// A SACADA (Luis aprovou 2026-08-19): o bloco de concorrentes do relatório e o motor de
// prospecção são A MESMA COISA rodando para dois lados. Para provar o buraco da Natura, o motor
// mediu 9 salões reais do bairro dela — com nome, nota, contagem de avaliações e SITE. Essa lista
// é, literalmente, a lista de prospects mais quentes que existe: mesma categoria, mesma rua, já
// medidos, de graça, sem pedir licença a ninguém.
//
// 🚨 A LEI DO RANKING — ordena pelo BURACO MEDIDO, nunca por dinheiro estimado.
// A tentação era ranquear por "$ perdido por mês". NÃO DÁ para fazer isso com honestidade: o
// `$ em risco` do X-Ray sai de ligações/mês × ticket médio, dois dados INTERNOS que só existem
// em cliente nosso. Num prospect frio não temos nenhum dos dois. Ranquear por dinheiro seria
// inventar o número exatamente na tela onde o vendedor mais confia nele — e o dono confere em
// dez segundos. Então a fila ordena por sinal MEDIDO e verificável:
//   distância da mediana de avaliações · nota · horas sem ninguém · sem preço · sem agendar.
// "Você tem 16 avaliações e a sua rua tem 195" abre mais porta que um "$1.900" sem lastro.
//
// ⚖️ ISTO MEDE, NÃO CONTATA. Nenhuma linha aqui manda mensagem, liga ou cria lead. Medir dado
// público é uma coisa; abordar é outra, tem regra (consentimento, TCPA) e passa pelo funil que
// já existe. Misturar os dois num endpoint só é como a plataforma arruma processo.
import { json, rateLimited } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { avaliarNegocio, normLang } from "../lib/avaliacao.js";
import { fichaDoGoogle, vizinhos } from "../lib/googleBusiness.js";
import { verifySession } from "../lib/sellerSession.js";

const s = (v, n) => String(v ?? "").trim().slice(0, n);
const dominio = (u) => { try { return new URL(u.startsWith("http") ? u : `https://${u}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };

// Quantos sites medimos por chamada. O Worker tem teto de CPU e cada medição abre um site de
// verdade; 3 cabe com folga. A tela chama de novo para continuar a fila — progresso visível
// vale mais que uma chamada longa que pode morrer no meio e não entregar nada.
const POR_LOTE = 3;

// ── O E-MAIL PÚBLICO DO PRÓPRIO SITE DO NEGÓCIO ──────────────────────────────────────────────
// O Google publica telefone, não e-mail. Mas quase todo negócio local põe o e-mail de contato no
// próprio site — é dado público, na página que ele mesmo publicou para ser encontrado.
// 🚨 FILTRO DE RUÍDO, SENÃO O VENDEDOR ESCREVE PARA A AGÊNCIA. Página de negócio local costuma
// carregar e-mail de plataforma (wix, squarespace, sentry, godaddy), do desenvolvedor, ou um
// endereço de exemplo. Mandar proposta para o fornecedor do site do cliente é pior que não mandar:
// queima o lead e ainda avisa um concorrente. Só passa e-mail no MESMO domínio do negócio, ou um
// provedor comum (gmail/hotmail/yahoo), que é o que o dono de negócio local usa de verdade.
const LIXO = /(sentry|wixpress|squarespace|godaddy|shopify|example|domain|yourname|email@|no-?reply|postmaster|abuse|privacy|\.png|\.jpg|\.webp|\.gif)/i;
const PROVEDOR_COMUM = /@(gmail|hotmail|outlook|yahoo|icloud|aol|live|msn)\./i;
// ── UMA PÁGINA SÓ, E ELA QUASE NUNCA TEM O E-MAIL ────────────────────────────────────────────
// 17 dos 34 leads ficaram sem e-mail porque olhávamos apenas a HOME. Negócio local raramente põe
// e-mail na home — ele mora em /contact, /contato, /about. Duas páginas a mais por negócio custa
// pouco e é a diferença entre ter um segundo canal e não ter.
// 🚨 TETO DE 3 PÁGINAS E 6s CADA, sequencial. Rastrear o site inteiro de um prospect seria abusar
// do servidor de alguém que nunca nos pediu nada — e um lote que trava não completa lote nenhum.
async function emailDoSiteProfundo(base, dominio) {
  const raiz = base.startsWith("http") ? base.replace(/\/+$/, "") : `https://${dominio}`;
  const candidatas = [raiz, `${raiz}/contact`, `${raiz}/contato`];
  for (const u of candidatas) {
    const achado = await emailDoSite(u, dominio);
    if (achado) return achado;   // a primeira que resolve encerra: não há prêmio por insistir
  }
  return "";
}

async function emailDoSite(url, dominio) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000); // site lento não pode travar o lote
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "GuileoBot/1.0 (+https://guileoai.com)" } });
    clearTimeout(timer);
    if (!r.ok) return "";
    const html = (await r.text()).slice(0, 400000); // teto: página gigante não estoura o Worker
    const achados = [...new Set((html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,10}/g) || []))]
      .map((e) => e.toLowerCase())
      .filter((e) => !LIXO.test(e))
      .filter((e) => e.endsWith("@" + dominio) || PROVEDOR_COMUM.test(e));
    // o do próprio domínio vence o provedor comum: é o canal oficial do negócio
    return achados.find((e) => e.endsWith("@" + dominio)) || achados[0] || "";
  } catch { return ""; }
}

/* ── OS TEXTOS DA FILA, NOS 4 IDIOMAS ─────────────────────────────────────────────────────────
   A 1ª versão escrevia as feridas em português cru dentro da função. Numa tela do hub em inglês
   isso aparecia em português — a regra do Luis quebrada exatamente onde ele mais olha
   ("nada de texto EN numa página PT, nem o contrário", e vale para toda superfície).
   Consertado AQUI e não na tela de propósito: o texto nasce junto do número que o justifica, e
   uma tela nunca deveria remontar a frase a partir de um valor solto — é assim que nome e número
   se separam e a ficha vira mentira (lição de hoje). Uma fonte, quatro idiomas. */
const T = {
  pt: { prova: (n, m) => `${n} avaliações — a mediana da vizinhança é ${m}`,
        provaF: (n, m) => `${n} avaliações, acima da mediana da vizinhança (${m})`,
        nota: (v) => `nota ${v}/100 no X-Ray`, notaF: (v) => `nota ${v}/100 no X-Ray — está bem`,
        rot: { atendimento: "telefone descoberto", vendas_digitais: "não vende pelo site", captura_de_leads: "não captura quem visita" },
        rotF: { atendimento: "telefone coberto", vendas_digitais: "vende pelo site", captura_de_leads: "captura quem visita" },
        semSinal: "nenhum sinal medido — não dá para ranquear",
        umSinalSo: "só um sinal medido — não dá para ranquear com isso" },
  en: { prova: (n, m) => `${n} reviews — the neighborhood median is ${m}`,
        provaF: (n, m) => `${n} reviews, above the neighborhood median (${m})`,
        nota: (v) => `${v}/100 on the X-Ray`, notaF: (v) => `${v}/100 on the X-Ray — doing well`,
        rot: { atendimento: "phone left uncovered", vendas_digitais: "the site does not sell", captura_de_leads: "does not capture visitors" },
        rotF: { atendimento: "phone covered", vendas_digitais: "the site sells", captura_de_leads: "captures visitors" },
        semSinal: "nothing measured — cannot rank this one",
        umSinalSo: "only one signal measured — not enough to rank" },
  es: { prova: (n, m) => `${n} reseñas — la mediana del vecindario es ${m}`,
        provaF: (n, m) => `${n} reseñas, por encima de la mediana del vecindario (${m})`,
        nota: (v) => `${v}/100 en la Radiografía`, notaF: (v) => `${v}/100 en la Radiografía — está bien`,
        rot: { atendimento: "teléfono sin cubrir", vendas_digitais: "el sitio no vende", captura_de_leads: "no captura a quien visita" },
        rotF: { atendimento: "teléfono cubierto", vendas_digitais: "el sitio vende", captura_de_leads: "captura a quien visita" },
        semSinal: "no se midió nada — no se puede clasificar",
        umSinalSo: "solo una señal medida — no alcanza para clasificar" },
  hi: { prova: (n, m) => `${n} रिव्यू — आस-पड़ोस की मध्यिका ${m} है`,
        provaF: (n, m) => `${n} रिव्यू, पड़ोस की मध्यिका (${m}) से ऊपर`,
        nota: (v) => `X-Ray में ${v}/100`, notaF: (v) => `X-Ray में ${v}/100 — अच्छा है`,
        rot: { atendimento: "फ़ोन बिना कवर", vendas_digitais: "साइट बिक्री नहीं करती", captura_de_leads: "आगंतुक कैप्चर नहीं होते" },
        rotF: { atendimento: "फ़ोन कवर", vendas_digitais: "साइट बिक्री करती है", captura_de_leads: "आगंतुक कैप्चर होते हैं" },
        semSinal: "कुछ मापा नहीं गया — रैंक नहीं कर सकते",
        umSinalSo: "सिर्फ़ एक संकेत मापा गया — रैंक के लिए पर्याप्त नहीं" },
};
const txt = (lang) => T[lang] || T.en;


/* O BURACO MEDIDO, 0–100. Só entra sinal que veio de medição; o que não foi medido não
   pontua (nem para cima nem para baixo) e sai declarado em `sinais`. */
function buracoMedido(av, medianaAvaliacoes, doVizinho = null, lang = "pt") {
  const t = txt(lang);
  // 🚨 BURACO E FORÇA SÃO LISTAS SEPARADAS (corrigido 2026-08-19, na 1ª rodada real).
  // A 1ª versão jogava tudo em `sinais`. O HoneyBliss saiu com "450 avaliações vs mediana 195"
  // no topo da lista de sinais — e isso é uma FORÇA dele, não uma ferida: ele está 2x acima da
  // rua. A conta pontuava 0 certinho, mas o vendedor lê a lista, não a conta, e ia abrir a
  // conversa elogiando o buraco ou cutucando o ponto forte. Um número só vale se o lado dele
  // estiver escrito junto — a mesma lei de PERDA/GANHO do relatório.
  const buracos = [], forcas = [];
  let pontos = 0, peso = 0;
  const conta = (p, w, chave, txtBuraco, txtForca) => {
    pontos += p * w; peso += w;
    (p > 0 ? buracos : forcas).push({ chave, valor: p, texto: p > 0 ? txtBuraco : txtForca });
  };

  // 🚨 O `||` PEGAVA O OBJETO E PERDIA O NÚMERO (corrigido 2026-08-24, mesma família do defeito da
  // vizinhança). `av.minha_ficha` costuma existir com endereço e categoria e SEM `avaliacoes`;
  // sendo um objeto verdadeiro, o `||` parava nele e a contagem que veio da listagem do vizinho
  // (a mesma consulta ao Google, com o número ao lado do nome) nunca era olhada. Resultado: a
  // prova social ora não pontuava, ora pontuava sobre o número errado — e o CARD, que usa
  // `?? entrada.avaliacoes`, mostrava um número que não era o do cálculo. Dois números diferentes
  // para a mesma coisa na mesma tela: o defeito mais caro desta base.
  // Agora escolho pelo CAMPO, não pelo objeto.
  const contagem = [av?.minha_ficha?.avaliacoes, doVizinho?.avaliacoes].find((v) => Number.isFinite(v));
  if (Number.isFinite(contagem) && Number.isFinite(medianaAvaliacoes) && medianaAvaliacoes > 0) {
    const p = Math.round((1 - Math.min(1, contagem / medianaAvaliacoes)) * 100);
    conta(p, 3, "prova_social", t.prova(contagem, medianaAvaliacoes), t.provaF(contagem, medianaAvaliacoes));
  }
  if (av?.score_geral != null) {
    conta(100 - av.score_geral, 2, "nota_geral", t.nota(av.score_geral), t.notaF(av.score_geral));
  }
  for (const a of av?.aspectos || []) {
    if (a?.score == null) continue;                      // não medido não pontua nem aparece
    if (!t.rot[a.nome]) continue;
    conta(100 - a.score, 1, a.nome, `${t.rot[a.nome]} (${a.score}/100)`, `${t.rotF[a.nome]} (${a.score}/100)`);
  }
  if (!peso) return { buraco: null, buracos, forcas, sinais: 0, motivo: t.semSinal };

  // 🚨 UM SINAL SÓ NÃO É UM BURACO (2026-08-24). Quando a avaliação não trouxe `score_geral` nem
  // aspectos, sobrava a prova social sozinha — e sozinha ela vira 100 sem nada que a contradiga.
  // Foi assim que Solace, Powerhouse Gym e Astoria Plumbers apareceram com buraco 100 tendo
  // score 100 e ZERO aspectos reprovados: o número era real e a leitura ("é o maior potencial da
  // carteira") era ficção. Um vendedor ligaria primeiro justamente para quem não tem o que
  // consertar — e queimaria a lista.
  // Com um sinal só o número não sai: sai o motivo. Medida incompleta declarada vale mais que
  // medida completa inventada.
  const sinais = buracos.length + forcas.length;
  if (sinais < 2) return { buraco: null, buracos, forcas, sinais, motivo: t.umSinalSo };

  buracos.sort((a, b) => b.valor - a.valor);             // a ferida maior primeiro: é a abertura
  return { buraco: Math.round(pontos / peso), buracos, forcas, sinais, motivo: null };
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return json({ error: "method" }, 405);
  if (await rateLimited(request, env, "prospeccao", 20)) return json({ error: "rate" }, 429);

  const b = await request.json().catch(() => ({}));

  // PORTÃO — segredo de ingestão, senha do /admin, ou crachá de vendedor. Fail-closed: sem um
  // dos três, nada roda. Medir custa chamada paga ao Google; portão aberto é conta de terceiro.
  const tok = s(b.token || request.headers.get("x-guileo-secret"), 200);
  let ok = !!env.INGEST_SECRET && tok === env.INGEST_SECRET;
  if (!ok && tok) ok = (await svcJson(env, "_admin_ok", { p_token: tok }).catch(() => null)) === true;
  if (!ok && b.sid) ok = !!(await verifySession(env, s(b.sid, 400)).catch(() => null));
  if (!ok) return json({ ok: false, erro: "sem_permissao" }, 401);

  const acao = s(b.acao, 20) || "vizinhanca";
  const lang = normLang(b.lang || "pt");

  // ── 1) VIZINHANÇA — de um site semente, quem são os vizinhos e onde eles estão ────────────
  if (acao === "vizinhanca") {
    const semente = s(b.site, 300);
    if (!semente) return json({ ok: false, erro: "sem_site", motivo: "preciso de um site semente" });
    if (!env.GOOGLE_PLACES_KEY) return json({ ok: false, erro: "sem_chave", motivo: "GOOGLE_PLACES_KEY não está neste ambiente" });

    const ficha = await fichaDoGoogle(env, semente.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]);
    if (!ficha.ok) return json({ ok: false, erro: "sem_ficha", motivo: ficha.motivo });

    const categoria = ficha.categoria || ficha.tipo || "";
    const viz = await vizinhos(env, {
      tipo: categoria, endereco: ficha.endereco,
      excluirNome: ficha.nome || "", excluirSite: ficha.site || semente, cidade: true,
    });
    if (!viz.ok) return json({ ok: false, erro: "sem_vizinhos", motivo: viz.motivo, categoria });

    const nums = viz.lista.map((p) => p?.userRatingCount).filter((n) => typeof n === "number").sort((a, c) => a - c);
    const mediana = nums.length ? (nums.length % 2 ? nums[nums.length >> 1] : Math.round((nums[(nums.length >> 1) - 1] + nums[nums.length >> 1]) / 2)) : null;

    return json({
      ok: true, categoria, consulta: viz.consulta,
      // mediana só com amostra que a sustente — o mesmo piso de 3 do bloco da vizinhança
      mediana_avaliacoes: nums.length >= 3 ? mediana : null,
      amostra: nums.length,
      piso_atingido: nums.length >= 3,
      vizinhos: viz.lista.map((p) => ({
        nome: p?.displayName?.text || "",
        site: p?.websiteUri || "",
        nota: typeof p?.rating === "number" ? p.rating : null,
        avaliacoes: typeof p?.userRatingCount === "number" ? p.userRatingCount : null,
        telefone: p?.nationalPhoneNumber || "",
        endereco: p?.formattedAddress || "",
        lat: typeof p?.location?.latitude === "number" ? p.location.latitude : null,
        lng: typeof p?.location?.longitude === "number" ? p.location.longitude : null,
        // sem site não dá para medir: o X-Ray lê o site. Fica declarado, não sumido.
        mensuravel: !!p?.websiteUri,
      })),
    });
  }

  // ── 1b) BUSCA — a fila de NYC sem precisar de um site semente ─────────────────────────────
  // Até hoje o motor só sabia partir de um negócio conhecido ("quem são os vizinhos DELE"). Isso
  // serve para atacar a rua de um cliente — e não serve para abrir um bairro novo, que é o que o
  // vendedor faz quando o território é "NYC, todos os bairros". A busca do Google já aceitava
  // categoria + lugar; ninguém tinha exposto essa porta.
  // 🚨 `cidade: false` DE PROPÓSITO: aqui o `local` JÁ é o bairro que o vendedor escolheu. O corte
  // "pega as duas últimas partes do endereço" existe para limpar rua e número de uma ficha do
  // Google — aplicado a "Astoria, Queens, NY" ele jogaria o bairro fora e devolveria a cidade
  // inteira, misturando a fila deste vendedor com a de outro.
  if (acao === "busca") {
    const categoria = s(b.categoria, 80);
    const local = s(b.local, 120);
    if (!categoria) return json({ ok: false, erro: "sem_categoria", motivo: "preciso do tipo de negócio (ex: dentist, plumber, restaurant)" });
    if (!local) return json({ ok: false, erro: "sem_local", motivo: "preciso do bairro ou cidade (ex: Astoria, Queens, NY)" });
    if (!env.GOOGLE_PLACES_KEY) return json({ ok: false, erro: "sem_chave", motivo: "GOOGLE_PLACES_KEY não está neste ambiente" });

    const viz = await vizinhos(env, { tipo: categoria, endereco: local, cidade: false });
    if (!viz.ok) return json({ ok: false, erro: "sem_resultado", motivo: viz.motivo, categoria, local });

    const nums = viz.lista.map((p) => p?.userRatingCount).filter((n) => typeof n === "number").sort((a, c) => a - c);
    const mediana = nums.length ? (nums.length % 2 ? nums[nums.length >> 1] : Math.round((nums[(nums.length >> 1) - 1] + nums[nums.length >> 1]) / 2)) : null;

    return json({
      ok: true, categoria, local, consulta: viz.consulta,
      mediana_avaliacoes: nums.length >= 3 ? mediana : null,
      amostra: nums.length, piso_atingido: nums.length >= 3,
      vizinhos: viz.lista.map((p) => ({
        nome: p?.displayName?.text || "",
        site: p?.websiteUri || "",
        telefone: p?.nationalPhoneNumber || "",
        endereco: p?.formattedAddress || "",
        // a coordenada viaja junto do resto da ficha: é ela que vira ROTA na fila do vendedor
        lat: typeof p?.location?.latitude === "number" ? p.location.latitude : null,
        lng: typeof p?.location?.longitude === "number" ? p.location.longitude : null,
        nota: typeof p?.rating === "number" ? p.rating : null,
        avaliacoes: typeof p?.userRatingCount === "number" ? p.userRatingCount : null,
        mensuravel: !!p?.websiteUri,
      })),
    });
  }

  // ── 1c) CONTATO — o telefone de um negócio que já está na fila ────────────────────────────
  // As medições antigas foram salvas antes de o telefone entrar na máscara do Google, então a
  // fila herdou 30 negócios reais SEM como ligar — uma lista de leitura. Isto completa a ficha.
  // 🚨 A TRAVA DO XARÁ: só devolvo o telefone quando o nome que o Google respondeu é o MESMO que
  // eu perguntei (normalizado, ou um contendo o outro). "Bon Bon Salon" com o número do MK Salon
  // é pior que nenhum número: o vendedor liga e chama o dono pelo nome do vizinho. Sem casar o
  // nome, devolvo `ok:false` com motivo — ausência declarada, nunca ficha errada com cara de certa.
  if (acao === "contato") {
    const nome = s(b.nome, 160);
    const local = s(b.local, 120) || "New York, NY";
    const siteDica = s(b.site, 300);
    if (!nome && !siteDica) return json({ ok: false, erro: "sem_nome" });
    if (!env.GOOGLE_PLACES_KEY) return json({ ok: false, erro: "sem_chave" });

    // 🚨 O DOMÍNIO PRIMEIRO, QUANDO EXISTE. Dez negócios da fila foram recusados pela trava do
    // xará porque o nome guardado é TÍTULO DE SEO ("Best Korean Hair Salon NYC, Japanese
    // Straightening NYC") — o Google responde outro negócio e a trava, certíssima, recusa.
    // O domínio não tem esse problema: ele é FATO, não texto de marketing. `fichaDoGoogle` busca
    // por domínio e já devolve o telefone que o Google publica. Quando o domínio resolve, ele
    // vence — nome bonito não vale mais que endereço verificável.
    if (siteDica) {
      const dom = siteDica.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
      const f = await fichaDoGoogle(env, dom).catch(() => null);
      if (f?.ok && f.telefone) {
        const alvo = (f.site || siteDica).startsWith("http") ? (f.site || siteDica) : `https://${dom}`;
        const mail = await emailDoSiteProfundo(alvo, dom);
        return json({
          ok: true, via: "dominio",
          nome_no_google: f.nome || "", telefone: f.telefone, email: mail, site: f.site || siteDica,
          endereco: f.endereco || "", nota: f.nota ?? null, avaliacoes: f.avaliacoes ?? null,
        });
      }
    }
    if (!nome) return json({ ok: false, erro: "sem_resultado", motivo: "o domínio não resolveu e não veio nome" });
    try {
      const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json", "X-Goog-Api-Key": env.GOOGLE_PLACES_KEY,
          "X-Goog-FieldMask": "places.displayName,places.nationalPhoneNumber,places.websiteUri,places.formattedAddress,places.rating,places.userRatingCount",
        },
        body: JSON.stringify({ textQuery: `${nome} ${local}`.slice(0, 200), maxResultCount: 1 }),
      });
      if (!r.ok) return json({ ok: false, erro: "google", motivo: `HTTP ${r.status}` });
      const d = await r.json().catch(() => ({}));
      const p0 = Array.isArray(d?.places) ? d.places[0] : null;
      if (!p0) return json({ ok: false, erro: "sem_resultado", motivo: "o Google não achou este negócio" });

      const norm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
      const a = norm(nome), c = norm(p0?.displayName?.text);
      const casa = !!a && !!c && (a === c || a.includes(c) || c.includes(a));
      if (!casa) return json({ ok: false, erro: "nome_nao_casa", motivo: `o Google respondeu "${p0?.displayName?.text || "?"}" — não é o mesmo negócio`, nome_no_google: p0?.displayName?.text || "" });

      const siteAchado = p0?.websiteUri || siteDica || "";
      const domAchado = siteAchado.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
      const mailAchado = siteAchado ? await emailDoSiteProfundo(siteAchado.startsWith("http") ? siteAchado : `https://${domAchado}`, domAchado) : "";
      return json({
        ok: true,
        nome_no_google: p0?.displayName?.text || "",
        telefone: p0?.nationalPhoneNumber || "",
        email: mailAchado,
        site: p0?.websiteUri || "",
        endereco: p0?.formattedAddress || "",
        nota: typeof p0?.rating === "number" ? p0.rating : null,
        avaliacoes: typeof p0?.userRatingCount === "number" ? p0.userRatingCount : null,
      });
    } catch (e) { return json({ ok: false, erro: "excecao", motivo: String(e).slice(0, 140) }); }
  }

  // ── 1d) REPARAR A VIZINHANÇA de relatórios JÁ ENTREGUES ───────────────────────────────────
  // 79 relatórios que já estão na mão dos vendedores saíram sem a régua da vizinhança — não por
  // falta de medição, mas porque o endereço vinha do SITE do negócio e muito site local não
  // publica endereço. A régua é o argumento mais forte que temos ("você tem 63 avaliações, a sua
  // rua tem 43"), e o relatório a recalcula sozinho a partir de `payload.concorrentes`.
  // Então o reparo NÃO remede nada: busca a ficha do Google (endereço + categoria), roda a busca
  // de vizinhos e grava só esse pedaço de volta. Um X-Ray inteiro custaria muito mais.
  // 🚨 SÓ REPARA QUEM ESTÁ VAZIO. Reescrever a vizinhança de um relatório que já tem a régua
  // trocaria uma medição feita na data certa por outra feita hoje — o cliente pode ter o PDF
  // antigo na mão, e dois números diferentes para a mesma frase destroem a confiança na medição.
  if (acao === "reparar_vizinhanca") {
    if (!env.GOOGLE_PLACES_KEY) return json({ ok: false, erro: "sem_chave" });
    const ids = (Array.isArray(b.ids) ? b.ids : []).map((x) => s(x, 40)).filter(Boolean).slice(0, POR_LOTE);
    if (!ids.length) return json({ ok: false, erro: "sem_ids" });

    const saida = [];
    for (const id of ids) {
      try {
        const d = await svcJson(env, "avaliacao_get", { p_id: id, p_marcar: false });
        const av = d?.payload;
        if (!av) { saida.push({ id, ok: false, motivo: "avaliação não encontrada" }); continue; }
        if (Array.isArray(av.concorrentes) && av.concorrentes.length >= 3) {
          saida.push({ id, ok: false, motivo: "já tem régua — não mexo", ja_tinha: av.concorrentes.length }); continue;
        }
        const site = av.site || "";
        const dom = String(site).replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
        if (!dom) { saida.push({ id, ok: false, motivo: "sem site guardado" }); continue; }

        // endereço: primeiro o que a ficha guardada já tem; só consulta o Google se faltar
        let endereco = av.minha_ficha?.endereco || "";
        let categoria = av.minha_ficha?.categoria || "";
        if (!endereco || !categoria) {
          const f = await fichaDoGoogle(env, dom).catch(() => null);
          if (!f?.ok) { saida.push({ id, ok: false, motivo: f?.motivo || "o Google não achou este negócio" }); continue; }
          endereco = endereco || f.endereco || "";
          categoria = categoria || f.categoria || f.tipo || "";
        }
        if (!endereco || !categoria) { saida.push({ id, ok: false, motivo: "sem endereço ou categoria — a busca acharia xará" }); continue; }

        const viz = await vizinhos(env, { tipo: categoria, endereco, excluirNome: av.business || "", excluirSite: site, cidade: true });
        if (!viz.ok) { saida.push({ id, ok: false, motivo: viz.motivo }); continue; }
        // piso de 3: com menos que isso a mediana não se sustenta e a régua se recusa a desenhar.
        if (!Array.isArray(viz.lista) || viz.lista.length < 3) {
          saida.push({ id, ok: false, motivo: `só ${viz.lista?.length || 0} vizinho(s) — abaixo do piso de 3` }); continue;
        }
        const concorrentes = viz.lista.map((p) => ({
          nome: p?.displayName?.text || "", site: p?.websiteUri || "",
          nota: typeof p?.rating === "number" ? p.rating : null,
          avaliacoes: typeof p?.userRatingCount === "number" ? p.userRatingCount : null,
          horarios: p?.regularOpeningHours?.weekdayDescriptions || [],
        }));
        const novo = { ...av, concorrentes };
        const g = await svcJson(env, "avaliacao_payload_set", { p_secret: env.INGEST_SECRET || "", p_id: id, p_payload: novo });
        // 🚨 comprovante: só declaro reparado se o banco confirmou a gravação.
        if (g?.ok !== true) { saida.push({ id, ok: false, motivo: g?.motivo || "mediu os vizinhos mas não gravou" }); continue; }
        saida.push({ id, ok: true, vizinhos: concorrentes.length, business: av.business || dom });
      } catch (e) { saida.push({ id, ok: false, motivo: String(e).slice(0, 140) }); }
    }
    return json({ ok: true, reparados: saida.filter((x) => x.ok).length, total: saida.length, itens: saida });
  }

  // ── 2) MEDIR — roda o X-Ray num lote de sites e devolve o buraco medido de cada um ────────
  if (acao === "medir") {
    // Aceita ou lista de sites, ou os objetos que o passo `vizinhanca` já devolveu. Preferir os
    // objetos: eles CARREGAM a ficha do Google (nome, nota, avaliações) que aquele passo já pagou.
    // Sem isso a gente joga fora um dado que estava na mão e o prospect volta sem número — e é o
    // número que abre a porta ("você tem X, a sua rua tem 195").
    const entradas = (Array.isArray(b.vizinhos) && b.vizinhos.length ? b.vizinhos : (Array.isArray(b.sites) ? b.sites : []))
      .map((x) => (typeof x === "string" ? { site: s(x, 300) } : {
        site: s(x?.site, 300), nome: s(x?.nome, 160),
        // o telefone vem da MESMA linha que trouxe o nome e os números — nunca de outra consulta.
        // Foi juntar duas fontes que colou "Bon Bon Salon" nos números do MK Salon.
        telefone: s(x?.telefone, 40), endereco: s(x?.endereco, 240),
        lat: typeof x?.lat === "number" ? x.lat : null, lng: typeof x?.lng === "number" ? x.lng : null,
        nota: typeof x?.nota === "number" ? x.nota : null,
        avaliacoes: typeof x?.avaliacoes === "number" ? x.avaliacoes : null,
      }))
      .filter((x) => x.site).slice(0, POR_LOTE);
    if (!entradas.length) return json({ ok: false, erro: "sem_sites" });
    const sites = entradas.map((x) => x.site);
    const mediana = Number(b.mediana_avaliacoes) > 0 ? Number(b.mediana_avaliacoes) : null;

    const saida = [];
    for (const entrada of entradas) {
      const site = entrada.site;
      const canonico = site.startsWith("http") ? site : `https://${site}`;
      const dom = dominio(canonico);
      try {
        // reaproveita medição recente do mesmo domínio — não vira scanner de si mesmo
        let av = null, id = null, reaproveitado = false;
        const hist = await svcJson(env, "avaliacao_historico", { p_secret: env.INGEST_SECRET || "", p_site: canonico }).catch(() => null);
        if (Array.isArray(hist) && hist.length) {
          const r = hist.filter((h) => h?.id && h?.created_at).sort((a, c) => new Date(c.created_at) - new Date(a.created_at))[0];
          if (r && (Date.now() - new Date(r.created_at).getTime()) < 7 * 864e5) {
            const d = await svcJson(env, "avaliacao_get", { p_id: r.id, p_marcar: false }).catch(() => null);
            if (d?.payload) { av = d.payload; id = r.id; reaproveitado = true; }
          }
        }
        if (!av) {
          // 🚨 O RELATÓRIO FALA O IDIOMA DO PROSPECT, NÃO O DE QUEM CLICOU (2026-08-22).
          // 295 relatórios de encanadores de Nova York saíram em PORTUGUÊS porque `lang` vinha da
          // interface do Luis. Mandar assim queima o prospect na primeira linha — e o link já
          // estava gerado, esperando para ser enviado.
          // Regra: domínio/mercado manda. `.br` → pt; qualquer outro TLD dos EUA → en. Quem quiser
          // forçar passa `lang_relatorio` explicitamente.
          const langRel = normLang(
            (b.lang_relatorio || "").toString()
            || (/\.br(\/|$)/i.test(canonico) ? "pt" : "en")
          );
          av = await avaliarNegocio({ site: canonico, env, lang: langRel });
          if (!av.ok) { saida.push({ site: canonico, dominio: dom, ok: false, motivo: av.motivo }); continue; }
          const salvo = await svcJson(env, "avaliacao_save", {
            p_secret: env.INGEST_SECRET || "",
            p_site: canonico, p_business: av.business || "", p_client_email: null,
            p_modo: av.modo, p_score: av.score_geral, p_payload: av,
            p_seller: "prospeccao", p_contato: "",
          });
          if (!salvo?.id) { saida.push({ site: canonico, dominio: dom, ok: false, motivo: "mediu mas não gravou" }); continue; }
          id = salvo.id;
        }

        const { buraco, buracos, forcas, motivo } = buracoMedido(av, mediana, entrada, lang);
        // 🚨 NOME: só o CONFIRMADO pelo Google serve para chamar alguém.
        // Sem confirmação, `av.business` é o <title> do site — e na 1ª rodada real isso virou
        // "Best Salon in Manhattan, NYC" e "Best Hair Salon in Midtown", que são texto de SEO,
        // não nome de empresa. O vendedor ligaria chamando o dono por um slogan. Sem confirmar,
        // o identificador é o DOMÍNIO (que é fato) e o nome raspado vai à parte, rotulado.
        // A ficha do vizinho vinda do passo `vizinhanca` vale como identificação: é a MESMA
        // consulta ao Google que listou o negócio ali, com o site dele publicado ao lado do nome.
        // Não é adivinhação — é o mesmo dado, carregado em vez de re-perguntado.
        const daVizinhanca = entrada.nome && (entrada.nota != null || entrada.avaliacoes != null);
        const confirmado = av.identificacao?.confirmada === true || !!daVizinhanca;
        const notaG = av.minha_ficha?.nota ?? entrada.nota ?? null;
        const avalG = av.minha_ficha?.avaliacoes ?? entrada.avaliacoes ?? null;
        saida.push({
          ok: true, site: canonico, dominio: dom, id, reaproveitado,
          // 🚨 NOME E NÚMERO VÊM DA MESMA LINHA, SEMPRE (bug real, 2026-08-19).
          // A 1ª versão fazia `nome_no_google || entrada.nome`. Mas `nome_no_google` continua
          // preenchido quando a identidade NÃO foi confirmada — é o negócio errado que a busca
          // por domínio encontrou. Resultado: saiu "Bon Bon Salon · 4.7★ · 96 avaliações", com o
          // nome do Bon Bon colado nos números do MK Salon. Ficha que parece completa e está
          // errada é pior que ficha vazia: o vendedor liga chamando o dono pelo nome do vizinho.
          // Regra: a busca direta só nomeia quando ela mesma se confirmou; senão nomeia a
          // listagem da vizinhança, que é a linha que trouxe os números.
          business: av.identificacao?.confirmada === true
            ? (av.identificacao.nome_no_google || dom)
            : (daVizinhanca ? entrada.nome : dom),
          telefone: entrada.telefone || null,
          endereco: entrada.endereco || null,
          lat: entrada.lat ?? null, lng: entrada.lng ?? null,
          fonte_da_ficha: av.minha_ficha ? "busca direta" : (daVizinhanca ? "listagem da vizinhança" : null),
          nome_confirmado: confirmado,
          nome_no_site: confirmado ? null : (av.business || null),
          score: av.score_geral ?? null,
          nota: notaG, avaliacoes: avalG,
          // a identificação vem junto: sem ela, o nome na tela pode ser de outro negócio
          identificacao: av.identificacao || null,
          buraco, buracos, forcas, buraco_motivo: motivo,
          link: `/apresentacao/${id}`,
        });
      } catch (e) {
        saida.push({ site: canonico, dominio: dom, ok: false, motivo: String(e).slice(0, 140) });
      }
    }

    // fila: maior buraco primeiro. Quem não pôde ser medido vai para o fim COM o motivo — some
    // da fila é pior que aparecer com defeito declarado.
    saida.sort((a, c) => (c.buraco ?? -1) - (a.buraco ?? -1));
    return json({ ok: true, medidos: saida.filter((x) => x.ok).length, total: saida.length, fila: saida });
  }

  return json({ ok: false, erro: "acao_desconhecida" }, 400);
}
