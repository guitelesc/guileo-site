// ═══════════════════════════════════════════════════════════════════════════════════════════════
// O DIAGNÓSTICO DO PROSPECT — o que ele ganha só por marcar a demo (2026-08-15)
//
// O PEDIDO DO LUIS, depois de ver o anúncio do AutoSEO: «temos que ter isso já de cara pra
// analisar o cliente — ele já ganha isso só de marcar a demo, e daí analisamos tudo dele».
//
// ⚠️ A DECISÃO DE PRODUTO QUE MUDA TUDO: o painel do AutoSEO mostra keyword/dificuldade/volume
// porque o produto DELES é conteúdo. Copiar aquilo entregaria um diagnóstico que aponta pra uma
// dor que a Guileo não resolve — e a call vira "legal, e vocês fazem SEO?". Cada linha daqui tem
// que ser uma FERIDA QUE A DEMO FECHA vinte minutos depois. Por isso todo achado carrega o campo
// `gui`: o que a agente faz sobre aquilo. Achado sem `gui` não entra — seria diagnóstico de
// outra empresa.
//
// ⚠️ NÃO INVENTA, E ISSO CUSTA COLUNAS. Volume e dificuldade de busca exigem dado pago
// (Ahrefs/SEMrush). Não temos. Estimar seria o mesmo pecado do preço inventado que derrubou a
// primeira ligação real da Lilian. O que não dá pra ler, não aparece.
//
// ⚠️ ZERO MODELO. Tudo aqui é leitura de HTML — funciona com a IA fora do ar (o apagão de
// crédito de 14/08 provou que essa distinção é real, não teórica). A camada narrativa da IA é
// separada e acende sozinha quando houver saldo: inerte-que-acende, o padrão da casa.
//
// SEGURANÇA: usa `buscarHtml` do brandExtract — SSRF, redirect, tipo, tamanho e captcha já
// travados e revisados adversarialmente. NUNCA um segundo buscador: dois caminhos de saída pra
// internet significam duas superfícies pra auditar, e a segunda nunca é auditada.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import { buscarHtml, perfilDoSite } from "./brandExtract.js";
import { fichaDoGoogle, achadoDeAvaliacoes, vizinhos, achadoDoVizinho } from "./googleBusiness.js";
import { horasFechadas } from "./horario.js";

// Provedores de agendamento online mais comuns nos verticais que atendemos. Achar QUALQUER um
// significa "o cliente dele consegue marcar sem falar com ninguém" — e aí esse achado NÃO entra.
// EXPORTADOS (2026-08-18): o motor de avaliação (lib/avaliacao.js) pontua os MESMOS sinais.
// Duas cópias destas regex divergiriam em silêncio — regra duplicada é regra que some numa cópia.
export const AGENDA = /mindbody|fresha|booksy|vagaro|squareup\.com\/appointments|square\.site|calendly|acuityscheduling|schedulicity|setmore|simplybook|resy|opentable|tock|zocdoc|housecallpro|jobber|servicetitan/i;
export const CHAT = /intercom|drift|tawk\.to|crisp\.chat|tidio|livechat|zendesk|hubspot.*messages|facebook\.com\/plugins\/customerchat|guileo/i;
export const REVIEW = /g\.page\/r\/|search\.google\.com\/local\/writereview|yelp\.com\/biz|trustpilot\.com\/review/i;
export const WHATS = /wa\.me\/|api\.whatsapp\.com\/send/i;

const conta = (re, s) => (s.match(re) || []).length;

// ── OS ACHADOS ────────────────────────────────────────────────────────────────────────────────
// `gravidade`: alta = dinheiro escapando agora · media = atrito · baixa = oportunidade.
// `evidencia`: o que foi LIDO no site. Sem evidência o achado não nasce — é a diferença entre
// "vi no site de vocês que" e telemarketing (a mesma regra do leadClassifier).
// ⚠️ `lang` ENTRA AQUI, não fica implícito. Na 1ª tentativa eu usei a tabela de tradução dentro
// desta função enquanto o `L` só existia dentro de `diagnosticar` — duas funções diferentes, um
// `L` que não existia neste escopo. O erro não aparecia em teste nenhum porque nada exercita
// este caminho sem rede.
function achados({ html, perfil, horas, lang = "pt" }) {
  const L = tx(lang);
  const out = [];
  const temTel = /href=["']tel:/i.test(html);
  const temForm = /<form[\s>]/i.test(html);
  const temAgenda = AGENDA.test(html);

  // 1. FORA DO HORÁRIO — o achado mais forte que existe pra nós, e o único que vem com número.
  if (horas && horas.fechadas > 0) {
    // ⚠️ "PELO MENOS" QUANDO A LEITURA FOI PARCIAL. Se o site declara 4 dias e os outros vêm num
    // formato que o leitor não pegou, o total fechado sai MAIOR que a verdade — e este é o número
    // que o vendedor fala em voz alta na call. Um dono que sabe que abre sábado ouve "140h sem
    // ninguém", conclui que o relatório é chute, e perde a confiança na análise inteira num
    // segundo. Com menos de 5 dias lidos a frase vira um piso, que é verdade em qualquer caso.
    const piso = horas.dias < 5;
    out.push({
      id: "fora_horario", gravidade: "alta",
      titulo: L.fh_t(piso, horas.fechadas),
      evidencia: L.fh_e_site(horas.dias, horas.resumo),
      dor: L.fh_d, gui: L.fh_g,
    });
  }

  // 2. SEM AGENDAMENTO ONLINE — atrito puro; todo agendamento passa por uma pessoa.
  if (!temAgenda) {
    out.push({
      id: "sem_agendamento", gravidade: "alta",
      titulo: L.sa_t, evidencia: L.sa_e, dor: L.sa_d, gui: L.sa_g,
    });
  }

  // 3. FORMULÁRIO SEM TELEFONE — o lead escreve e espera. É o padrão que mais mata lead novo.
  if (temForm && !temTel) {
    out.push({
      id: "so_formulario", gravidade: "alta",
      titulo: L.sf_t, evidencia: L.sf_e, dor: L.sf_d, gui: L.sf_g,
    });
  }

  // 4. UM IDIOMA SÓ — em NY e Miami isso é dinheiro na mesa, não detalhe.
  const alternos = conta(/hreflang=/gi, html);
  if (alternos < 2) {
    out.push({
      id: "um_idioma", gravidade: "media",
      titulo: L.ui_t(perfil.idioma ? perfil.idioma.toUpperCase() : L.um_idioma),
      evidencia: L.ui_e(!!alternos), dor: L.ui_d, gui: L.ui_g,
    });
  }

  // 5. AVALIAÇÃO SEM CAMINHO — sem link, o cliente satisfeito nunca vira nota pública.
  if (!REVIEW.test(html)) {
    out.push({
      id: "sem_review", gravidade: "media",
      titulo: L.sr_t, evidencia: L.sr_e, dor: L.sr_d, gui: L.sr_g,
    });
  }

  // 6. VÁRIAS UNIDADES, UMA LINHA — descoberto no Natura: 3 unidades, 2 linhas, 1 número nosso.
  const tels = new Set((html.match(/href=["']tel:([^"']{6,25})/gi) || [])
    .map((m) => m.replace(/\D/g, "").slice(-10)).filter((d) => d.length === 10));
  if (perfil.unidades > 1 && tels.size < perfil.unidades) {
    out.push({
      id: "unidades_sem_linha", gravidade: "media",
      titulo: L.ul_t(perfil.unidades, tels.size || 1),
      evidencia: L.ul_e(perfil.unidades, tels.size || 1), dor: L.ul_d, gui: L.ul_g,
    });
  }

  // 7. SEM CANAL DE TEXTO — quem não quer ligar simplesmente não fala com o negócio.
  if (!CHAT.test(html) && !WHATS.test(html)) {
    out.push({
      id: "sem_texto", gravidade: "baixa",
      titulo: L.st_t, evidencia: L.st_e, dor: L.st_d, gui: L.st_g,
    });
  }

  return out;
}


/**
 * Analisa o site de um prospect e devolve o diagnóstico pronto.
 * Nunca levanta: erro de rede/SSRF volta como { ok:false, motivo }.
 */

// ── OS ACHADOS FALAM O IDIOMA DO RELATÓRIO (2026-08-22) ──────────────────────────────────────
// 🚨 ESTE ARQUIVO NÃO CONHECIA IDIOMA NENHUM. Todo achado era português fixo no código — então a
// moldura do Growth Report traduzia e o CONTEÚDO não. Ficava "WHAT WE MEASURED: Pelo menos 144h
// por semana com o telefone sem ninguém" num relatório mandado para um encanador de Nova York.
// O defeito estava enterrado no meio da página; ao tirar a nota 24/100 e promover o achado para
// a primeira dobra, ele virou a PRIMEIRA COISA que o prospect lê. Erro velho, palco novo.
//
// Interpolação fica em função para o número entrar no lugar certo de cada língua — em inglês a
// unidade e a ordem não são as mesmas.
const TX = {
  pt: {
    fh_t: (piso, h) => `${piso ? "Pelo menos " : ""}${h}h por semana com o telefone sem ninguém`,
    fh_e_site: (d, r) => `Horário publicado no site (${d} dia(s) lido(s)): ${r}`,
    fh_e_google: (d, r) => `Horário na ficha do Google (${d} dia(s) aberto(s)): ${r}`,
    fh_d: "Quem liga fora desse intervalo cai na caixa postal — e a maioria não liga de novo, liga pro próximo da lista.",
    fh_g: "A agente atende 24 horas, nos 7 dias, e marca no mesmo telefone de hoje.",
    sa_t: "Não dá para marcar sem falar com alguém",
    sa_e: "Nenhum sistema de agendamento online encontrado no site.",
    sa_d: "Cada marcação ocupa uma pessoa da equipe, e quem liga na hora cheia desiste.",
    sa_g: "A agente marca durante a própria ligação, já conferindo a agenda real.",
    sf_t: "O contato principal é um formulário",
    sf_e: "O site tem formulário de contato e nenhum link de telefone clicável.",
    sf_d: "Lead preenche e fica esperando. Quem responde primeiro fica com o cliente — normalmente em minutos, não horas.",
    sf_g: "Formulário preenchido vira ligação da agente em cerca de 60 segundos.",
    ui_t: (i) => `Site só em ${i}`,
    ui_e: (tem) => tem ? "Só uma versão de idioma declarada." : "Nenhuma versão alternativa de idioma no site.",
    ui_d: "Quem liga e não é atendido na própria língua desliga — e nunca vira estatística, porque não deixa recado.",
    ui_g: "A agente reconhece e responde em 16 idiomas, com voz nativa em cada um.",
    sr_t: "Nenhum caminho para o cliente avaliar",
    sr_e: "Nenhum link de avaliação (Google/Yelp) encontrado no site.",
    sr_d: "Cliente satisfeito vai embora calado; o insatisfeito acha o caminho sozinho.",
    sr_g: "Depois do atendimento a agente pede a avaliação e responde as que chegam.",
    ul_t: (u, t) => `${u} unidades para ${t} telefone`,
    ul_e: (u, t) => `${u} endereços no site, ${t} número(s) de telefone.`,
    ul_d: "Quem liga querendo uma unidade cai na outra, e a ligação vira transferência ou desistência.",
    ul_g: "A agente pergunta a unidade, responde pela agenda daquela loja e marca no lugar certo.",
    st_t: "Nenhum canal de texto",
    st_e: "Nenhum chat no site e nenhum link de WhatsApp.",
    st_d: "Uma parte dos clientes não liga em hipótese nenhuma — se só existe telefone, eles vão embora sem contato.",
    st_g: "A mesma agente atende no chat do site e no WhatsApp, com a mesma agenda.",
    fonte_google: "O site não abriu para leitura automática (proteção anti-bot). Estes pontos vêm da ficha pública do Google.",
    um_idioma: "um idioma",
  },
  en: {
    fh_t: (piso, h) => `${piso ? "At least " : ""}${h} hours a week with nobody on the phone`,
    fh_e_site: (d, r) => `Hours published on the site (${d} day(s) read): ${r}`,
    fh_e_google: (d, r) => `Hours on the Google listing (${d} day(s) open): ${r}`,
    fh_d: "Anyone calling outside that window gets voicemail — and most don't call back, they call the next name on the list.",
    fh_g: "The agent answers 24 hours a day, 7 days a week, and books on the same number you use today.",
    sa_t: "You can't book without talking to someone",
    sa_e: "No online booking system found on the site.",
    sa_d: "Every booking ties up a person on your team, and whoever calls during the rush gives up.",
    sa_g: "The agent books during the call itself, checking the real calendar.",
    sf_t: "Your main contact is a form",
    sf_e: "The site has a contact form and no clickable phone link.",
    sf_d: "The lead fills it in and waits. Whoever answers first keeps the customer — usually in minutes, not hours.",
    sf_g: "A submitted form becomes a call from the agent in about 60 seconds.",
    ui_t: (i) => `Site only in ${i}`,
    ui_e: (tem) => tem ? "Only one language version declared." : "No alternate language version on the site.",
    ui_d: "Someone who calls and isn't served in their own language hangs up — and never shows up in any report, because they leave no message.",
    ui_g: "The agent recognises and answers in 16 languages, with a native voice in each.",
    sr_t: "No way for a customer to leave a review",
    sr_e: "No review link (Google/Yelp) found on the site.",
    sr_d: "The happy customer leaves quietly; the unhappy one finds the way on their own.",
    sr_g: "After the visit the agent asks for the review and replies to the ones that come in.",
    ul_t: (u, t) => `${u} locations for ${t} phone line`,
    ul_e: (u, t) => `${u} addresses on the site, ${t} phone number(s).`,
    ul_d: "Someone calling for one location lands on another, and the call turns into a transfer or a hang-up.",
    ul_g: "The agent asks which location, answers from that store's calendar and books in the right place.",
    st_t: "No text channel",
    st_e: "No chat on the site and no WhatsApp link.",
    st_d: "Some customers will never call. If the phone is the only door, they leave without contacting you.",
    st_g: "The same agent answers on the site chat and on WhatsApp, from the same calendar.",
    fonte_google: "The site did not open for automated reading (anti-bot protection). These points come from the public Google listing.",
    um_idioma: "one language",
  },
};
TX.es = TX.en;   // ES ainda não escrito: cai em EN, que é honesto. PT para um cliente de Miami
                 // seria pior que EN — e inventar espanhol de máquina aqui não é tradução, é chute.
const tx = (lang) => TX[String(lang || "pt").slice(0, 2)] || TX.pt;

export async function diagnosticar(siteUrl, env = null, dica = "", lang = "pt") {
  const L = tx(lang);
  const got = await buscarHtml(siteUrl);

  // ── REDE DE SEGURANÇA: A FICHA DO GOOGLE ────────────────────────────────────────────────────
  // Site recusou (captcha/JS) → tenta o Google, que não tem captcha. `dica` é o nome do negócio
  // (a demo já sabe), porque procurar por domínio no Places acerta menos que procurar por nome.
  //
  // ⚠️ O QUE VEM DO GOOGLE SÓ AFIRMA O QUE O GOOGLE MOSTRA. Aqui NÃO nascem os achados de
  // "sem agendamento online", "só formulário", "um idioma" ou "sem canal de texto" — esses
  // dependem de LER O SITE, e a gente não leu. Afirmar que o prospect não tem agendamento
  // online sem ter aberto o site dele é o mesmo pecado do preço inventado, com a agravante de
  // ser sobre o negócio DELE, na frente dele. Relatório curto e verdadeiro > longo e chutado.
  if (got.why) {
    if (!env) return { ok: false, motivo: got.why };
    const f = await fichaDoGoogle(env, dica || siteUrl.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]);
    if (!f.ok) return { ok: false, motivo: `${got.why} · Google: ${f.motivo}` };

    const horasG = horasFechadas(f.horarios);
    const lista = [];
    if (horasG && horasG.fechadas > 0) {
      const piso = horasG.dias < 5;
      lista.push({
        id: "fora_horario", gravidade: "alta",
        titulo: L.fh_t(piso, horasG.fechadas),
        evidencia: L.fh_e_google(horasG.dias, horasG.resumo),
        dor: L.fh_d, gui: L.fh_g,
      });
    }
    const av = achadoDeAvaliacoes(f);
    if (av) lista.push(av);

    return {
      ok: true, site: siteUrl, fonte: "google",
      // O aviso é para o VENDEDOR, e vai impresso na página: ele precisa saber que não lemos o
      // site antes de dizer qualquer coisa sobre o site na frente do prospect.
      nota_fonte: L.fonte_google,
      perfil: { nome: f.nome, telefone: f.telefone, endereco: f.endereco, horarios: f.horarios, idioma: "", servicos: [], marca: null, unidades: 1 },
      horas: horasG, achados: lista,
      resumo: { total: lista.length, altas: lista.filter((a) => a.gravidade === "alta").length, horas_sem_ninguem: horasG ? horasG.fechadas : null },
    };
  }

  const html = got.html;

  const p = await perfilDoSite(siteUrl).catch(() => ({}));
  const perfil = {
    nome: p?.nome || "", telefone: p?.telefone || "", endereco: p?.endereco || "",
    horarios: p?.horarios || "", idioma: p?.idioma || "",
    servicos: Array.isArray(p?.servicos) ? p.servicos.slice(0, 12) : [],
    marca: p?.marca || null,
    // nº de unidades: endereços distintos declarados no schema (não texto solto — endereço
    // adivinhado no corpo da página põe o vendedor falando de uma loja que não existe)
    unidades: Math.max(1, conta(/"@type"\s*:\s*"PostalAddress"/gi, html) || 1),
  };

  const horas = horasFechadas(perfil.horarios);
  const lista = achados({ html, perfil, horas, lang });

  // ── O VIZINHO ────────────────────────────────────────────────────────────────────────────────
  // ⚠️ ISTO REVISA UMA REGRA QUE EU MESMO ESCREVI ACIMA ("o Google só é chamado quando a leitura
  // do site FALHOU"). A regra era para evitar uma segunda conta de terceiro rodando de enfeite.
  // A comparação com o vizinho muda o cálculo: ela é o achado mais forte da análise inteira, e
  // exige a ficha do prospect (nº de avaliações) + a dos vizinhos, mesmo com o site lido. São 2
  // chamadas por prospect, em volume de demo marcada — barato pelo que entrega.
  // Registro a revisão em vez de apagar a regra: mudar a própria regra em silêncio é como o
  // código fica sem lei. Continua valendo o essencial — só roda com a chave, e nunca sem endereço.
  // Por que a comparação NÃO nasceu fica registrado. "comparacao: null" é igual para três causas
  // (sem chave, sem endereço, amostra curta) — e causa indistinguível é o que faz a gente debugar
  // pelo palpite. Custa um objeto de 3 booleanos e economiza a noite.
  // `tipo` + `tam` separam DUAS causas que dão o mesmo `false`: a variável não chegou ao worker
  // (undefined) ou chegou VAZIA (string de tamanho 0 — o que acontece quando o valor é colado com
  // uma quebra de linha ou o prompt do wrangler recebe enter em branco). O `secret list` mostra as
  // duas iguais, porque ele lista o NOME, não o conteúdo. Nunca expõe o valor: só tipo e tamanho.
  const _k = env?.GOOGLE_PLACES_KEY;
  let comparacao = { tem_chave: !!_k, chave_tipo: typeof _k, chave_tam: typeof _k === "string" ? _k.length : null, tem_endereco: !!perfil.endereco, rodou: false };
  if (env?.GOOGLE_PLACES_KEY && perfil.endereco) {
    comparacao.rodou = true;
    const [f, viz] = await Promise.all([
      fichaDoGoogle(env, `${perfil.nome} ${perfil.endereco}`.trim()),
      vizinhos(env, { tipo: dica || perfil.nome, endereco: perfil.endereco, excluirNome: perfil.nome, cidade: true }),
    ]);
    const extras = achadoDoVizinho(horas, viz, f?.ok ? f.avaliacoes : null) || [];
    for (const e of extras) lista.push(e);
    comparacao = { ...comparacao, vizinhos_lidos: viz?.ok ? viz.lista.length : 0, motivo: viz?.ok ? null : viz?.motivo };
  }

  return {
    ok: true, site: siteUrl, perfil, horas, comparacao,
    achados: lista,
    // O placar é CONTAGEM, não nota de 0 a 100. Uma nota exige uma régua defensável, e a nossa
    // seria arbitrária — "72/100" parece medida e é chute. Buracos contados é o que a gente sabe.
    resumo: {
      total: lista.length,
      altas: lista.filter((a) => a.gravidade === "alta").length,
      horas_sem_ninguem: horas ? horas.fechadas : null,
    },
  };
}
