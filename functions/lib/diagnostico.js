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
function achados({ html, perfil, horas }) {
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
      titulo: `${piso ? "Pelo menos " : ""}${horas.fechadas}h por semana com o telefone sem ninguém`,
      evidencia: `Horário publicado no site (${horas.dias} dia(s) lido(s)): ${horas.resumo}`,
      dor: "Quem liga fora desse intervalo cai na caixa postal — e a maioria não liga de novo, liga pro próximo da lista.",
      gui: "A agente atende 24 horas, nos 7 dias, e marca no mesmo telefone de hoje.",
    });
  }

  // 2. SEM AGENDAMENTO ONLINE — atrito puro; todo agendamento passa por uma pessoa.
  if (!temAgenda) {
    out.push({
      id: "sem_agendamento", gravidade: "alta",
      titulo: "Não dá para marcar sem falar com alguém",
      evidencia: "Nenhum sistema de agendamento online encontrado no site.",
      dor: "Cada marcação ocupa uma pessoa da equipe, e quem liga na hora cheia desiste.",
      gui: "A agente marca durante a própria ligação, já conferindo a agenda real.",
    });
  }

  // 3. FORMULÁRIO SEM TELEFONE — o lead escreve e espera. É o padrão que mais mata lead novo.
  if (temForm && !temTel) {
    out.push({
      id: "so_formulario", gravidade: "alta",
      titulo: "O contato principal é um formulário",
      evidencia: "O site tem formulário de contato e nenhum link de telefone clicável.",
      dor: "Lead preenche e fica esperando. Quem responde primeiro fica com o cliente — normalmente em minutos, não horas.",
      gui: "Formulário preenchido vira ligação da agente em cerca de 60 segundos.",
    });
  }

  // 4. UM IDIOMA SÓ — em NY e Miami isso é dinheiro na mesa, não detalhe.
  const alternos = conta(/hreflang=/gi, html);
  if (alternos < 2) {
    out.push({
      id: "um_idioma", gravidade: "media",
      titulo: `Site só em ${perfil.idioma ? perfil.idioma.toUpperCase() : "um idioma"}`,
      evidencia: alternos ? "Só uma versão de idioma declarada." : "Nenhuma versão alternativa de idioma no site.",
      dor: "Quem liga e não é atendido na própria língua desliga — e nunca vira estatística, porque não deixa recado.",
      gui: "A agente reconhece e responde em 16 idiomas, com voz nativa em cada um.",
    });
  }

  // 5. AVALIAÇÃO SEM CAMINHO — sem link, o cliente satisfeito nunca vira nota pública.
  if (!REVIEW.test(html)) {
    out.push({
      id: "sem_review", gravidade: "media",
      titulo: "Nenhum caminho para o cliente avaliar",
      evidencia: "Nenhum link de avaliação (Google/Yelp) encontrado no site.",
      dor: "Cliente satisfeito vai embora calado; o insatisfeito acha o caminho sozinho.",
      gui: "Depois do atendimento a agente pede a avaliação e responde as que chegam.",
    });
  }

  // 6. VÁRIAS UNIDADES, UMA LINHA — descoberto no Natura: 3 unidades, 2 linhas, 1 número nosso.
  const tels = new Set((html.match(/href=["']tel:([^"']{6,25})/gi) || [])
    .map((m) => m.replace(/\D/g, "").slice(-10)).filter((d) => d.length === 10));
  if (perfil.unidades > 1 && tels.size < perfil.unidades) {
    out.push({
      id: "unidades_sem_linha", gravidade: "media",
      titulo: `${perfil.unidades} unidades para ${tels.size || 1} telefone`,
      evidencia: `${perfil.unidades} endereços no site, ${tels.size || 1} número(s) de telefone.`,
      dor: "Quem liga querendo uma unidade cai na outra, e a ligação vira transferência ou desistência.",
      gui: "A agente pergunta a unidade, responde pela agenda daquela loja e marca no lugar certo.",
    });
  }

  // 7. SEM CANAL DE TEXTO — quem não quer ligar simplesmente não fala com o negócio.
  if (!CHAT.test(html) && !WHATS.test(html)) {
    out.push({
      id: "sem_texto", gravidade: "baixa",
      titulo: "Nenhum canal de texto",
      evidencia: "Nenhum chat no site e nenhum link de WhatsApp.",
      dor: "Uma parte dos clientes não liga em hipótese nenhuma — se só existe telefone, eles vão embora sem contato.",
      gui: "A mesma agente atende no chat do site e no WhatsApp, com a mesma agenda.",
    });
  }

  return out;
}


/**
 * Analisa o site de um prospect e devolve o diagnóstico pronto.
 * Nunca levanta: erro de rede/SSRF volta como { ok:false, motivo }.
 */
export async function diagnosticar(siteUrl, env = null, dica = "") {
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
        titulo: `${piso ? "Pelo menos " : ""}${horasG.fechadas}h por semana com o telefone sem ninguém`,
        evidencia: `Horário na ficha do Google (${horasG.dias} dia(s) aberto(s)): ${horasG.resumo}`,
        dor: "Quem liga fora desse intervalo cai na caixa postal — e a maioria não liga de novo, liga pro próximo da lista.",
        gui: "A agente atende 24 horas, nos 7 dias, e marca no mesmo telefone de hoje.",
      });
    }
    const av = achadoDeAvaliacoes(f);
    if (av) lista.push(av);

    return {
      ok: true, site: siteUrl, fonte: "google",
      // O aviso é para o VENDEDOR, e vai impresso na página: ele precisa saber que não lemos o
      // site antes de dizer qualquer coisa sobre o site na frente do prospect.
      nota_fonte: "O site não abriu para leitura automática (proteção anti-bot). Estes pontos vêm da ficha pública do Google.",
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
  const lista = achados({ html, perfil, horas });

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
