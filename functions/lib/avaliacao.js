// ═══════════════════════════════════════════════════════════════════════════════════════════════
// O MOTOR DE AVALIAÇÃO DE NEGÓCIO — score por aspecto + previsões + estratégia (2026-08-18)
//
// O PEDIDO DO LUIS: avaliar a presença online/digital/vendas de QUALQUER negócio local e devolver
// score por aspecto, métricas, previsões e recomendações. Todo prospect recebe isso na página de
// apresentação; todo cliente recebe de novo, mais fundo, com os dados internos dele.
//
// ⚠️ ISTO ESTENDE O DIAGNÓSTICO, NÃO O SUBSTITUI. O lib/diagnostico.js continua sendo a análise
// da demo (achados-ferida, sem nota). Este motor REUSA o diagnosticar() inteiro — achados, perfil,
// horário, comparação com vizinho — e adiciona por cima a régua de 0-100, as previsões com
// premissa e a estratégia produto-a-produto.
//
// ⚠️ A NOTA SÓ EXISTE PORQUE A RÉGUA É PUBLICADA. O diagnostico.js recusou nota de 0-100 («"72/100"
// parece medida e é chute») — e a recusa estava certa PARA UMA NOTA SEM RÉGUA. Aqui cada aspecto é
// uma lista de VERIFICAÇÕES BINÁRIAS medidas de verdade (o site tem tel: clicável? tem viewport?
// respondeu em <3s?), cada uma com a evidência escrita do lado. O score é a fração das verificações
// que passaram, sobre AS QUE FORAM MEDIDAS — o que não deu pra medir sai do denominador e aparece
// como "não medido", nunca como 0 nem como acerto. A nota é reproduzível: rode duas vezes, dá igual.
//
// ⚠️ PREVISÃO SEM PREMISSA É FRAUDE em página de venda. Toda previsão sai como { valor, premissa }
// e a premissa é a FÓRMULA por extenso, com cada número dizendo de onde veio. Faltou insumo medido
// → valor: null e a premissa explica o que falta. Nunca número órfão.
//
// ⚠️ ZERO MODELO. Igual ao diagnóstico: heurística determinística sobre HTML + banco. Funciona com
// a conta da Anthropic zerada (o apagão de 14/08 é a razão, não teoria).
//
// ⚠️ O MOTOR TEM IDIOMA (2026-08-18). Antes ele emitia TODA string em português fixo — e o relatório
// da Lilian (Natura Spa, NYC, cliente que fala inglês) saía com os títulos em inglês e o conteúdo
// em português. É lei do repo: nada de texto EN em página PT, nem o contrário. Agora `lang`
// (pt · en · es, os 3 idiomas do backend) escolhe o dicionário TXT e TODA prosa nossa sai naquele
// idioma. O que NUNCA é traduzido: dado do negócio (nome de serviço, preço, domínio, nome da ficha
// do Google) — traduzir dado é inventar dado.
//
// DOIS MODOS:
//   prospect → só o que é público (site + ficha do Google se houver chave).
//   cliente  → tudo do prospect + o snapshot interno (catálogo com preços, ligações, agenda,
//              pacotes) vindo da RPC avaliacao_client_snapshot. É a vantagem de ser cliente:
//              a previsão usa o ticket médio REAL do catálogo dele, não um chute de setor.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import { buscarHtml } from "./brandExtract.js";
import { diagnosticar, AGENDA, CHAT, REVIEW, WHATS } from "./diagnostico.js";
import { fichaDoGoogle, vizinhos } from "./googleBusiness.js";

// ── DICIONÁRIO DO MOTOR (mesmo formato dos vizinhos: objeto por idioma, `|| fallback`) ─────────
// Regra: string que a GENTE escreve entra aqui. Dado do negócio nunca entra.
// exportado para ferramentas internas (ex.: traduzir um payload já gravado sem re-medir o site)
export const TXT = {
  pt: {
    fonteSite: "horário publicado no site",
    fonteAgenda: "agenda interna da plataforma",
    // ── DECLARADO PELO DONO (quiz do Guileo X-Ray) ────────────────────────────────────────────
    // Não é medição nossa: é o dono respondendo. Entra SÓ nas previsões (nunca no score, que é a
    // régua de coisas que NÓS medimos) e SEMPRE com a origem escrita na premissa.
    fonteDeclarado: "horário informado por você no formulário",
    premPerdidasDecl: (ligSem, lig30, fe, ab, fonte, p) => `${ligSem} ligações por semana INFORMADAS POR VOCÊ (≈${lig30}/mês) × (${fe}h fechadas ÷ ${ab}h abertas, ${fonte}) = ~${p}/mês caindo na caixa postal sem atendimento 24/7. ⚠️ Parte do que VOCÊ declarou — não foi medido na sua linha. Ligando a linha Guileo, em 30 dias este número deixa de ser declarado e passa a ser medido.`,
    premReceitaDecl: (p, t, r) => `${p} ligações perdidas estimadas/mês × premissa de 1 em 3 ligações virando agendamento × ticket médio de ${t} INFORMADO POR VOCÊ = ~${r}/mês em risco. ⚠️ Duas entradas declaradas por você (volume e ticket) e uma taxa de conversão assumida — nenhuma das três medida por nós ainda.`,
    naoAbriu: (rot, why) => `${rot} — o site não abriu para leitura (${why})`,
    naoMedido: (t) => `— não medido: ${t}`,
    rot: {
      ssl: "SSL", velocidade: "velocidade", titulo: "título", mobile: "adaptação ao celular",
      descricao: "meta description", dados_estruturados: "dados estruturados",
      social_preview: "prévia social (OpenGraph)", instagram: "Instagram", facebook: "Facebook",
      outras_redes: "outras redes", telefone_clicavel: "telefone clicável", formulario: "formulário",
      chat: "chat no site", whatsapp: "WhatsApp", agendamento_online: "agendamento online",
      caminho_de_avaliacao: "caminho de avaliação", pagamento_online: "pagamento online",
      gift_cards_site: "gift cards", pacotes_site: "pacotes/membership",
    },
    sslSim: (u) => `Site servido em HTTPS (${u})`,
    sslNao: (u) => `Site servido em HTTP sem SSL (${u})`,
    velSim: (ms) => `Primeira resposta em ${ms}ms (abaixo de 3s)`,
    velNao: (ms) => `Primeira resposta em ${ms}ms (acima de 3s — visitante móvel desiste)`,
    mobileSim: "Meta viewport presente — a página se adapta ao celular",
    mobileNao: "Sem meta viewport — no celular a página abre em miniatura",
    tituloSim: "Título da página definido",
    tituloNao: "Página sem <title> — o Google mostra a URL crua",
    descSim: "Meta description presente",
    descNao: "Sem meta description — o Google inventa o resumo do negócio",
    dadosSim: "Dados estruturados (schema.org) presentes — o Google lê horário/endereço direto",
    dadosNao: "Sem dados estruturados — o Google adivinha horário e endereço",
    socialSim: "Tags OpenGraph presentes — o link compartilhado sai com foto e título",
    socialNao: "Sem tags OpenGraph — o link compartilhado sai pelado",
    fichaSim: (nome, st) => `Ficha no Google encontrada: "${nome}"${st}`,
    notaSim: (n, a) => `Nota ${n} no Google (${a} avaliações)`,
    notaNM: "nota — a ficha não publica nota",
    horarioSim: "Horário publicado na ficha do Google",
    horarioNao: "Ficha sem horário publicado — o Google mostra 'horário não informado'",
    provaSim: (av, med, n) => `${av} avaliações vs mediana de ${med} entre ${n} concorrentes próximos`,
    provaPoucos: (n) => `prova social vs vizinhos — só ${n} vizinho(s) com contagem publicada (piso: 3)`,
    provaNM: (m) => `prova social vs vizinhos — ${m}`,
    provaSemContagem: "sem contagem de avaliações do prospect",
    fichaNM: (m) => `ficha do Google — ${m}`,
    notaNaoConsultado: "nota do Google — não consultado",
    horarioNaoConsultado: "horário na ficha — não consultado",
    provaNaoConsultado: "prova social vs vizinhos — não consultado",
    avaliarSim: "O site tem link direto para avaliar (Google/Yelp)",
    avaliarNao: "Nenhum caminho para o cliente satisfeito avaliar — só o insatisfeito acha sozinho",
    igSim: "Link para Instagram no site", igNao: "Nenhum link de Instagram no site",
    fbSim: "Link para Facebook no site", fbNao: "Nenhum link de Facebook no site",
    outrasSim: "Outras redes linkadas (TikTok/YouTube/LinkedIn/X)", outrasNao: "Nenhuma outra rede linkada no site",
    telSim: "Telefone clicável (tel:) — um toque liga",
    telNao: "Telefone não é clicável — no celular o visitante tem que decorar o número",
    formSim: "Formulário de contato presente", formNao: "Nenhum formulário — quem não quer ligar não deixa contato",
    chatSim: "Chat/widget de mensagem no site", chatNao: "Nenhum chat no site",
    waSim: "Link de WhatsApp no site", waNao: "Nenhum link de WhatsApp",
    agSim: "Agendamento online presente — dá para marcar sem falar com ninguém",
    agNao: "Sem agendamento online — toda marcação passa por uma pessoa",
    cobertura: (ab, fe, fonte, dias) => `${ab}h abertas / ${fe}h com o telefone sem ninguém, por semana (${fonte}, ${dias} dia(s))`,
    coberturaNM: "cobertura horária — nenhum horário legível publicado nem agenda interna",
    agenteSim: (lig, dur) => `Agente Guileo ativo: ${lig} ligações atendidas nos últimos 30 dias (duração média ${dur}s)`,
    agenteNao: "Agente provisionado mas sem ligação registrada em 30 dias — a linha publicada não encaminha (ver ROTA-ENCAMINHA)",
    agenteNM: "atendimento fora do horário — só medível com dados internos (modo cliente)",
    sentimento: (p, n) => `Sentimento das ligações analisadas: ${p} positivas / ${n} negativas`,
    sentimentoNM: "sentimento — nenhuma ligação com análise de sentimento ainda",
    ligAgenda: (ag, lig) => `${ag} agendamento(s) para ${lig} ligações nos últimos 30 dias`,
    ligAgendaNM: "conversão ligação→agenda — sem volume de ligações para medir",
    pagSim: "Caminho de pagamento online detectado no site",
    pagNao: "Nenhum caminho de pagamento online no site — toda venda exige presença",
    giftSim: "Gift cards oferecidos no site",
    giftNao: "Site não oferece gift card — receita de presente vai pro concorrente que oferece",
    pacSim: "Pacotes/membership mencionados no site",
    pacNao: "Nenhum pacote ou membership no site — só venda avulsa",
    catalogo: (sp, s, falta) => `Catálogo: ${sp} de ${s} serviços com preço definido${falta ? " — serviço sem preço vira cotação inventada na ligação" : ""}`,
    catalogoNM: "catálogo — nenhum serviço cadastrado",
    recorrencia: (p, m, v) => `${p} pacote(s) e ${m} membership(s) configurados na plataforma; ${v} vendido(s)`,
    recAspecto: {
      presenca_web: "Corrigir o básico de SEO técnico (title/description/schema) — é o que o Google lê antes de qualquer visitante.",
      descoberta: "Publicar caminho de avaliação e alimentar a ficha do Google — a lista de busca já vem ordenada por prova social.",
      redes_sociais: "Linkar os perfis ativos no site; perfil que o site não aponta não existe para quem chegou agora.",
      captura_de_leads: "Fechar os buracos de captura: cada canal ausente é um perfil de cliente que vai embora sem deixar contato.",
      atendimento: "Cobrir as horas em que o telefone toca sem ninguém — é onde a receita escapa primeiro.",
      vendas_digitais: "Abrir venda sem presença (pagamento online, gift card, pacote) — receita que entra dormindo.",
    },
    premPerdidas: (lig, fe, ab, fonte, p) => `${lig} ligações registradas na linha nos últimos 30 dias × (${fe}h fechadas ÷ ${ab}h abertas, ${fonte}) = ~${p}/mês que cairiam na caixa postal sem atendimento 24/7. Premissa: demanda uniforme ao longo da semana — na prática, fora do horário concentra ainda mais (quem trabalha liga à noite).`,
    premPerdidasSemVolume: (fonte, fe) => `Não estimado: ${fonte} deixa ${fe}h/semana sem ninguém, mas não há volume REAL de ligações medido para multiplicar (modo prospect não tem linha instrumentada). Ativar a linha Guileo mede isso em 30 dias — número inventado aqui seria chute com cara de medida.`,
    premPerdidasSemNada: "Não estimado: sem horário legível e sem volume de ligações medido.",
    premReceita: (p, t, n, r) => `${p} ligações perdidas estimadas/mês × premissa declarada de 1 em 3 ligações virando agendamento × ticket médio REAL de ${t} (média dos ${n} serviços precificados do catálogo) = ~${r}/mês em risco. A taxa de 1/3 é premissa, não medição — ajuste com a conversão real do funil quando houver 90 dias de dado.`,
    premReceitaSemPerdidas: "Não estimado: depende da estimativa de ligações perdidas (acima).",
    premReceitaSemTicket: "Não estimado: sem ticket médio real (catálogo sem preços) — usar preço inventado aqui é o pecado que derrubou a primeira ligação da Lilian.",
    estr: {
      voz: {
        gap: (fe, fonte) => `${fe}h/semana com o telefone sem ninguém (${fonte})`,
        rec: "Agente de voz 24/7 atendendo no número atual — cobre exatamente a janela em que a ligação hoje vira caixa postal.",
        nome: "Gui — agente de voz 24/7",
      },
      agenda: {
        gap: "Não dá para marcar sem falar com alguém",
        rec: "Agendamento na própria ligação/chat, conferindo a agenda real — marcação deixa de ocupar a equipe.",
        nome: "Motor de Agenda",
      },
      chat: {
        gap: "Nenhum canal de texto",
        rec: "Widget de chat + WhatsApp com a mesma agente e a mesma agenda — captura quem não liga em hipótese nenhuma.",
        nome: "Widget Guileo + WhatsApp",
      },
      speedlead: {
        gap: "Lead escreve e fica esperando",
        rec: "Formulário preenchido vira ligação da agente em ~60 segundos — quem responde primeiro fica com o cliente.",
        nome: "Speed-to-lead",
      },
      cobra: {
        gap: "Venda só acontece com alguém presente",
        rec: "Cobrar na própria ligação (link de pagamento por SMS), pacotes, memberships e gift cards online.",
        nome: "Gui Fecha & Cobra + Pacotes/Gift Cards",
      },
      catalogo: {
        gap: (sp, s) => `Catálogo com serviço sem preço (${sp} de ${s} precificados)`,
        rec: "Precificar todo o catálogo — serviço sem preço vira cotação inventada na ligação (foi a ferida da 1ª ligação real) ou pedido de orçamento que espera humano.",
        nome: "Catálogo precificado + Gui Fecha & Cobra",
      },
      pulse: {
        gap: "Cliente satisfeito vai embora calado",
        rec: "Pedir avaliação após cada atendimento e responder as que chegam — prova social é o critério de escolha na busca local.",
        nome: "Guileo Pulse (XM)",
      },
    },
    // ── FASE 2 · AVANÇAR ────────────────────────────────────────────────────────────────────
    // Todo texto daqui é POTENCIAL DECLARADO, nunca medida. A regra é a mesma do resto do motor:
    // o passo só nasce quando o DADO INTERNO existe, e o ganho sai com a dependência escrita
    // ("depende de X"). Se o dado não sustenta, o passo simplesmente não aparece.
    fase2: {
      recorrencia: {
        gap: (p, pv, m, g) => `Receita recorrente parada: ${p} pacote(s) criado(s) e ${pv} vendido(s), ${m} membership(s), ${g} gift card(s)`,
        rec: "Vender pacote/membership na própria ligação e por link — quem compra pacote volta por contrato, não por lembrança.",
        nome: "Pacotes, Memberships & Gift Cards",
        pot: "cada pacote vendido adianta várias visitas de uma vez — potencial: depende de quantos clientes aceitam pré-pagar e do preço que você definir.",
      },
      reativacao: {
        gap: (lig, ag, dif) => `${lig} ligações registradas e ${ag} agendamento(s): ${dif} pessoa(s) procuraram e não marcaram`,
        rec: "A agente liga de volta para quem procurou e não marcou — e para quem não volta há tempo — com oferta e agenda na mão.",
        nome: "Reativação automática",
        pot: (t) => `cada retorno vale ~${t} no seu ticket médio — potencial: depende de quantas dessas pessoas ainda estão interessadas e atendem a ligação.`,
        potSemTicket: "potencial: depende de quantas dessas pessoas ainda estão interessadas e atendem a ligação.",
      },
      reputacao: {
        gap: (n, q) => `Nota ${n} com ${q} avaliação(ões) publicadas`,
        rec: "Pedir avaliação depois de cada atendimento e responder as que chegam — na busca local, a nota é o critério de escolha.",
        nome: "Reputação & Avaliações",
        pot: "mais avaliações recentes melhoram a posição na busca local — potencial: depende do volume de atendimentos e de quantos clientes aceitam avaliar.",
      },
      campanhas: {
        gap: (lig, ag) => `Hoje a demanda vem só de quem já conhece: ${lig} ligações em 30 dias, ${ag} viraram agendamento`,
        rec: "Campanhas pagas com o lead caindo direto na agente — cada anúncio medido por agendamento, não por clique.",
        nome: "Campanhas (Guileo AD)",
        pot: "abre uma fonte de demanda que hoje não existe — potencial: depende de orçamento, praça e criativo; medimos campanha a campanha depois de ligar.",
      },
    },
    fasesTxt: {
      pararNome: "Parar a perda",
      avancarNome: "Avançar",
      cobrePremissa: (v) => `A única cifra em dinheiro MEDIDA neste relatório é a receita em risco (${v}/mês), que vem das ligações que hoje caem na caixa postal — e o atendimento 24/7 cobre exatamente essa janela. Os outros passos da Fase 1 fecham vazamentos medidos que não têm cifra própria calculada; não somamos número inventado, então eles não entram neste total.`,
      cobreSem: "Este relatório não tem cifra em dinheiro defensável para somar — os passos da Fase 1 fecham vazamentos medidos que não têm valor próprio calculado.",
      avancarAviso: "Todo ganho da Fase 2 é POTENCIAL — depende do que está escrito em cada passo. Nada aqui foi medido no seu negócio ainda.",
    },
    motivos: {
      "sem GOOGLE_PLACES_KEY": "ficha do Google não consultada (integração de busca desligada)",
      "sem GOOGLE_PLACES_KEY — ficha do Google não consultada": "ficha do Google não consultada (integração de busca desligada)",
      "negócio não encontrado no Google": "negócio não encontrado no Google",
      "consulta vazia": "consulta vazia",
      "sem endereço no site — vizinho de verdade exige endereço": "sem endereço no site — comparar com vizinho exige endereço",
      "sem endereço do prospect — não dá pra achar vizinho de verdade": "sem endereço do negócio — comparar com vizinho exige endereço",
      "site-protegido-por-captcha": "site protegido por captcha/bot-check",
      "url-invalida-ou-interna": "endereço inválido ou interno",
    },
  },
  en: {
    fonteSite: "hours published on the website",
    fonteAgenda: "the platform's own calendar",
    fonteDeclarado: "hours you told us in the form",
    premPerdidasDecl: (ligSem, lig30, fe, ab, fonte, p) => `${ligSem} calls a week YOU REPORTED (≈${lig30}/month) × (${fe}h closed ÷ ${ab}h open, ${fonte}) = ~${p}/month hitting voicemail without 24/7 answering. ⚠️ This starts from what YOU declared — it was not measured on your line. Turn the Guileo line on and in 30 days this stops being declared and becomes measured.`,
    premReceitaDecl: (p, t, r) => `${p} estimated missed calls/month × an assumption of 1 in 3 calls becoming a booking × an average ticket of ${t} YOU REPORTED = ~${r}/month at risk. ⚠️ Two inputs declared by you (volume and ticket) and one assumed conversion rate — none of the three measured by us yet.`,
    naoAbriu: (rot, why) => `${rot} — the site did not open for reading (${why})`,
    naoMedido: (t) => `— not measured: ${t}`,
    rot: {
      ssl: "SSL", velocidade: "speed", titulo: "page title", mobile: "mobile adaptation",
      descricao: "meta description", dados_estruturados: "structured data",
      social_preview: "social preview (OpenGraph)", instagram: "Instagram", facebook: "Facebook",
      outras_redes: "other networks", telefone_clicavel: "clickable phone", formulario: "contact form",
      chat: "website chat", whatsapp: "WhatsApp", agendamento_online: "online booking",
      caminho_de_avaliacao: "review path", pagamento_online: "online payment",
      gift_cards_site: "gift cards", pacotes_site: "packages/memberships",
    },
    sslSim: (u) => `Site served over HTTPS (${u})`,
    sslNao: (u) => `Site served over HTTP with no SSL (${u})`,
    velSim: (ms) => `First response in ${ms}ms (under 3s)`,
    velNao: (ms) => `First response in ${ms}ms (over 3s — mobile visitors give up)`,
    mobileSim: "Meta viewport present — the page adapts to phones",
    mobileNao: "No meta viewport — on a phone the page opens shrunk to a thumbnail",
    tituloSim: "Page title is set",
    tituloNao: "Page has no <title> — Google shows the raw URL",
    descSim: "Meta description present",
    descNao: "No meta description — Google makes up the business summary",
    dadosSim: "Structured data (schema.org) present — Google reads hours/address directly",
    dadosNao: "No structured data — Google guesses your hours and address",
    socialSim: "OpenGraph tags present — a shared link carries photo and title",
    socialNao: "No OpenGraph tags — a shared link shows up bare",
    fichaSim: (nome, st) => `Google Business listing found: "${nome}"${st}`,
    notaSim: (n, a) => `${n} rating on Google (${a} reviews)`,
    notaNM: "rating — the listing publishes no rating",
    horarioSim: "Hours published on the Google listing",
    horarioNao: "Listing with no hours published — Google shows 'hours not provided'",
    provaSim: (av, med, n) => `${av} reviews vs a median of ${med} across ${n} nearby competitors`,
    provaPoucos: (n) => `social proof vs neighbors — only ${n} neighbor(s) publish a review count (floor: 3)`,
    provaNM: (m) => `social proof vs neighbors — ${m}`,
    provaSemContagem: "no review count for this business",
    fichaNM: (m) => `Google listing — ${m}`,
    notaNaoConsultado: "Google rating — not queried",
    horarioNaoConsultado: "hours on the listing — not queried",
    provaNaoConsultado: "social proof vs neighbors — not queried",
    avaliarSim: "The site has a direct link to leave a review (Google/Yelp)",
    avaliarNao: "No path for a happy customer to leave a review — only the unhappy one finds it alone",
    igSim: "Instagram link on the site", igNao: "No Instagram link on the site",
    fbSim: "Facebook link on the site", fbNao: "No Facebook link on the site",
    outrasSim: "Other networks linked (TikTok/YouTube/LinkedIn/X)", outrasNao: "No other network linked on the site",
    telSim: "Clickable phone number (tel:) — one tap calls",
    telNao: "Phone number is not clickable — on a phone the visitor has to memorize the number",
    formSim: "Contact form present", formNao: "No form — whoever won't call leaves no contact at all",
    chatSim: "Chat/message widget on the site", chatNao: "No chat on the site",
    waSim: "WhatsApp link on the site", waNao: "No WhatsApp link",
    agSim: "Online booking present — a visitor can book without talking to anyone",
    agNao: "No online booking — every appointment goes through a person",
    cobertura: (ab, fe, fonte, dias) => `${ab}h open / ${fe}h with no one on the phone, per week (${fonte}, ${dias} day(s))`,
    coberturaNM: "hour coverage — no readable published hours and no internal calendar",
    agenteSim: (lig, dur) => `Guileo agent live: ${lig} calls answered in the last 30 days (average duration ${dur}s)`,
    agenteNao: "Agent provisioned but no call recorded in 30 days — the published line is not forwarding (see ROTA-ENCAMINHA)",
    agenteNM: "after-hours answering — only measurable with internal data (client mode)",
    sentimento: (p, n) => `Sentiment of analyzed calls: ${p} positive / ${n} negative`,
    sentimentoNM: "sentiment — no call has been sentiment-analyzed yet",
    ligAgenda: (ag, lig) => `${ag} booking(s) out of ${lig} calls in the last 30 days`,
    ligAgendaNM: "call→booking conversion — not enough call volume to measure",
    pagSim: "Online payment path detected on the site",
    pagNao: "No online payment path on the site — every sale requires someone present",
    giftSim: "Gift cards offered on the site",
    giftNao: "The site offers no gift card — gift revenue goes to the competitor who does",
    pacSim: "Packages/memberships mentioned on the site",
    pacNao: "No package or membership on the site — one-off sales only",
    catalogo: (sp, s, falta) => `Catalog: ${sp} of ${s} services have a set price${falta ? " — a service with no price turns into an invented quote on the call" : ""}`,
    catalogoNM: "catalog — no service registered",
    recorrencia: (p, m, v) => `${p} package(s) and ${m} membership(s) configured on the platform; ${v} sold`,
    recAspecto: {
      presenca_web: "Fix the technical SEO basics (title/description/schema) — it's what Google reads before any visitor does.",
      descoberta: "Publish a review path and feed the Google listing — the search list is already sorted by social proof.",
      redes_sociais: "Link your active profiles on the site; a profile the site doesn't point to doesn't exist for a first-time visitor.",
      captura_de_leads: "Close the capture gaps: every missing channel is a customer type that leaves without a trace.",
      atendimento: "Cover the hours when the phone rings with no one there — that's where revenue escapes first.",
      vendas_digitais: "Open selling without a person present (online payment, gift card, package) — revenue that comes in while you sleep.",
    },
    premPerdidas: (lig, fe, ab, fonte, p) => `${lig} calls recorded on the line in the last 30 days × (${fe}h closed ÷ ${ab}h open, ${fonte}) = ~${p}/month that would hit voicemail without 24/7 answering. Assumption: demand spread evenly through the week — in practice, after-hours concentrates even more (people who work call at night).`,
    premPerdidasSemVolume: (fonte, fe) => `Not estimated: ${fonte} leaves ${fe}h/week with no one there, but there is no REAL measured call volume to multiply by (prospect mode has no instrumented line). Turning the Guileo line on measures this in 30 days — a number invented here would be a guess wearing the face of a measurement.`,
    premPerdidasSemNada: "Not estimated: no readable hours and no measured call volume.",
    premReceita: (p, t, n, r) => `${p} estimated missed calls/month × a stated assumption of 1 in 3 calls becoming a booking × the REAL average ticket of ${t} (average of the ${n} priced services in the catalog) = ~${r}/month at risk. The 1-in-3 rate is an assumption, not a measurement — adjust it with the funnel's real conversion once there are 90 days of data.`,
    premReceitaSemPerdidas: "Not estimated: depends on the missed-calls estimate above.",
    premReceitaSemTicket: "Not estimated: no real average ticket (catalog without prices) — using an invented price here is exactly the sin that broke the first real call.",
    estr: {
      voz: {
        gap: (fe, fonte) => `${fe}h/week with no one on the phone (${fonte})`,
        rec: "A 24/7 voice agent answering on your current number — it covers exactly the window where a call turns into voicemail today.",
        nome: "Gui — 24/7 voice agent",
      },
      agenda: {
        gap: "There is no way to book without talking to someone",
        rec: "Booking inside the call/chat itself, against the real calendar — appointments stop tying up your team.",
        nome: "Booking Engine",
      },
      chat: {
        gap: "No text channel at all",
        rec: "Chat widget + WhatsApp with the same agent and the same calendar — captures the people who will never call.",
        nome: "Guileo Widget + WhatsApp",
      },
      speedlead: {
        gap: "A lead writes in and waits",
        rec: "A submitted form becomes an agent call in ~60 seconds — whoever answers first keeps the customer.",
        nome: "Speed-to-lead",
      },
      cobra: {
        gap: "A sale only happens when someone is there",
        rec: "Collect on the call itself (pay-link by SMS), plus packages, memberships and gift cards online.",
        nome: "Close & Collect + Packages/Gift Cards",
      },
      catalogo: {
        gap: (sp, s) => `Catalog with unpriced services (${sp} of ${s} priced)`,
        rec: "Price the whole catalog — a service with no price becomes an invented quote on the call, or a quote request that waits for a human.",
        nome: "Priced catalog + Close & Collect",
      },
      pulse: {
        gap: "Happy customers leave without saying a word",
        rec: "Ask for a review after every visit and answer the ones that come in — social proof is the choice criterion in local search.",
        nome: "Guileo Pulse (XM)",
      },
    },
    fase2: {
      recorrencia: {
        gap: (p, pv, m, g) => `Recurring revenue sitting idle: ${p} package(s) created and ${pv} sold, ${m} membership(s), ${g} gift card(s)`,
        rec: "Sell packages/memberships on the call itself and by link — a customer who buys a package comes back by contract, not by memory.",
        nome: "Packages, Memberships & Gift Cards",
        pot: "each package sold books several visits at once — potential: depends on how many customers accept prepaying and on the price you set.",
      },
      reativacao: {
        gap: (lig, ag, dif) => `${lig} calls recorded and ${ag} booking(s): ${dif} people reached out and never booked`,
        rec: "The agent calls back everyone who reached out and didn't book — and everyone who hasn't returned in a while — with the offer and the calendar in hand.",
        nome: "Automatic reactivation",
        pot: (t) => `each recovered visit is worth ~${t} at your average ticket — potential: depends on how many of those people are still interested and pick up the phone.`,
        potSemTicket: "potential: depends on how many of those people are still interested and pick up the phone.",
      },
      reputacao: {
        gap: (n, q) => `${n} rating with ${q} published review(s)`,
        rec: "Ask for a review after every visit and answer the ones that come in — in local search, the rating is the choice criterion.",
        nome: "Reputation & Reviews",
        pot: "more recent reviews improve your position in local search — potential: depends on your visit volume and on how many customers agree to review.",
      },
      campanhas: {
        gap: (lig, ag) => `Today demand comes only from people who already know you: ${lig} calls in 30 days, ${ag} became bookings`,
        rec: "Paid campaigns with the lead landing straight on the agent — every ad measured by bookings, not by clicks.",
        nome: "Campaigns (Guileo AD)",
        pot: "opens a demand source that doesn't exist today — potential: depends on budget, market and creative; we measure it campaign by campaign after it's live.",
      },
    },
    fasesTxt: {
      pararNome: "Stop the loss",
      avancarNome: "Advance",
      cobrePremissa: (v) => `The only dollar figure MEASURED in this report is the revenue at risk (${v}/month), which comes from the calls that hit voicemail today — and 24/7 answering covers exactly that window. The other Phase 1 steps close measured gaps that have no dollar figure of their own; we don't add invented numbers, so they are not in this total.`,
      cobreSem: "This report has no defensible dollar figure to sum — the Phase 1 steps close measured gaps that have no calculated value of their own.",
      avancarAviso: "Every Phase 2 gain is POTENTIAL — it depends on what each step states. None of it has been measured in your business yet.",
    },
    motivos: {
      "sem GOOGLE_PLACES_KEY": "Google listing not queried (search integration is off)",
      "sem GOOGLE_PLACES_KEY — ficha do Google não consultada": "Google listing not queried (search integration is off)",
      "negócio não encontrado no Google": "business not found on Google",
      "consulta vazia": "empty query",
      "sem endereço no site — vizinho de verdade exige endereço": "no address on the site — comparing with neighbors requires an address",
      "sem endereço do prospect — não dá pra achar vizinho de verdade": "no business address — comparing with neighbors requires an address",
      "site-protegido-por-captcha": "site protected by captcha/bot-check",
      "url-invalida-ou-interna": "invalid or internal address",
    },
  },
  es: {
    fonteSite: "horario publicado en el sitio",
    fonteAgenda: "la agenda interna de la plataforma",
    fonteDeclarado: "horario que tú indicaste en el formulario",
    premPerdidasDecl: (ligSem, lig30, fe, ab, fonte, p) => `${ligSem} llamadas por semana INFORMADAS POR TI (≈${lig30}/mes) × (${fe}h cerradas ÷ ${ab}h abiertas, ${fonte}) = ~${p}/mes cayendo al buzón sin atención 24/7. ⚠️ Parte de lo que TÚ declaraste — no fue medido en tu línea. Activando la línea Guileo, en 30 días este número deja de ser declarado y pasa a ser medido.`,
    premReceitaDecl: (p, t, r) => `${p} llamadas perdidas estimadas/mes × premisa de 1 de cada 3 llamadas convirtiéndose en reserva × ticket promedio de ${t} INFORMADO POR TI = ~${r}/mes en riesgo. ⚠️ Dos entradas declaradas por ti (volumen y ticket) y una tasa de conversión asumida — ninguna de las tres medida por nosotros todavía.`,
    naoAbriu: (rot, why) => `${rot} — el sitio no abrió para lectura (${why})`,
    naoMedido: (t) => `— no medido: ${t}`,
    rot: {
      ssl: "SSL", velocidade: "velocidad", titulo: "título de la página", mobile: "adaptación al celular",
      descricao: "meta description", dados_estruturados: "datos estructurados",
      social_preview: "vista previa social (OpenGraph)", instagram: "Instagram", facebook: "Facebook",
      outras_redes: "otras redes", telefone_clicavel: "teléfono clicable", formulario: "formulario",
      chat: "chat en el sitio", whatsapp: "WhatsApp", agendamento_online: "reserva en línea",
      caminho_de_avaliacao: "camino de reseña", pagamento_online: "pago en línea",
      gift_cards_site: "gift cards", pacotes_site: "paquetes/membresías",
    },
    sslSim: (u) => `Sitio servido en HTTPS (${u})`,
    sslNao: (u) => `Sitio servido en HTTP sin SSL (${u})`,
    velSim: (ms) => `Primera respuesta en ${ms}ms (menos de 3s)`,
    velNao: (ms) => `Primera respuesta en ${ms}ms (más de 3s — el visitante móvil se va)`,
    mobileSim: "Meta viewport presente — la página se adapta al celular",
    mobileNao: "Sin meta viewport — en el celular la página abre en miniatura",
    tituloSim: "Título de la página definido",
    tituloNao: "Página sin <title> — Google muestra la URL cruda",
    descSim: "Meta description presente",
    descNao: "Sin meta description — Google inventa el resumen del negocio",
    dadosSim: "Datos estructurados (schema.org) presentes — Google lee horario/dirección directo",
    dadosNao: "Sin datos estructurados — Google adivina horario y dirección",
    socialSim: "Etiquetas OpenGraph presentes — el enlace compartido sale con foto y título",
    socialNao: "Sin etiquetas OpenGraph — el enlace compartido sale desnudo",
    fichaSim: (nome, st) => `Ficha de Google encontrada: "${nome}"${st}`,
    notaSim: (n, a) => `Calificación ${n} en Google (${a} reseñas)`,
    notaNM: "calificación — la ficha no publica calificación",
    horarioSim: "Horario publicado en la ficha de Google",
    horarioNao: "Ficha sin horario publicado — Google muestra 'horario no informado'",
    provaSim: (av, med, n) => `${av} reseñas vs una mediana de ${med} entre ${n} competidores cercanos`,
    provaPoucos: (n) => `prueba social vs vecinos — solo ${n} vecino(s) publican conteo de reseñas (mínimo: 3)`,
    provaNM: (m) => `prueba social vs vecinos — ${m}`,
    provaSemContagem: "sin conteo de reseñas del negocio",
    fichaNM: (m) => `ficha de Google — ${m}`,
    notaNaoConsultado: "calificación de Google — no consultada",
    horarioNaoConsultado: "horario en la ficha — no consultado",
    provaNaoConsultado: "prueba social vs vecinos — no consultada",
    avaliarSim: "El sitio tiene enlace directo para dejar reseña (Google/Yelp)",
    avaliarNao: "Ningún camino para que el cliente satisfecho deje reseña — solo el insatisfecho lo encuentra solo",
    igSim: "Enlace a Instagram en el sitio", igNao: "Ningún enlace de Instagram en el sitio",
    fbSim: "Enlace a Facebook en el sitio", fbNao: "Ningún enlace de Facebook en el sitio",
    outrasSim: "Otras redes enlazadas (TikTok/YouTube/LinkedIn/X)", outrasNao: "Ninguna otra red enlazada en el sitio",
    telSim: "Teléfono clicable (tel:) — un toque llama",
    telNao: "El teléfono no es clicable — en el celular el visitante tiene que memorizar el número",
    formSim: "Formulario de contacto presente", formNao: "Ningún formulario — quien no quiere llamar no deja contacto",
    chatSim: "Chat/widget de mensajes en el sitio", chatNao: "Ningún chat en el sitio",
    waSim: "Enlace de WhatsApp en el sitio", waNao: "Ningún enlace de WhatsApp",
    agSim: "Reserva en línea presente — se puede reservar sin hablar con nadie",
    agNao: "Sin reserva en línea — toda cita pasa por una persona",
    cobertura: (ab, fe, fonte, dias) => `${ab}h abiertas / ${fe}h con el teléfono sin nadie, por semana (${fonte}, ${dias} día(s))`,
    coberturaNM: "cobertura horaria — ningún horario legible publicado ni agenda interna",
    agenteSim: (lig, dur) => `Agente Guileo activa: ${lig} llamadas atendidas en los últimos 30 días (duración media ${dur}s)`,
    agenteNao: "Agente aprovisionada pero sin llamadas registradas en 30 días — la línea publicada no reenvía (ver ROTA-ENCAMINHA)",
    agenteNM: "atención fuera de horario — solo medible con datos internos (modo cliente)",
    sentimento: (p, n) => `Sentimiento de las llamadas analizadas: ${p} positivas / ${n} negativas`,
    sentimentoNM: "sentimiento — todavía ninguna llamada con análisis de sentimiento",
    ligAgenda: (ag, lig) => `${ag} reserva(s) para ${lig} llamadas en los últimos 30 días`,
    ligAgendaNM: "conversión llamada→reserva — sin volumen de llamadas para medir",
    pagSim: "Camino de pago en línea detectado en el sitio",
    pagNao: "Ningún camino de pago en línea en el sitio — toda venta exige presencia",
    giftSim: "Gift cards ofrecidas en el sitio",
    giftNao: "El sitio no ofrece gift card — el ingreso de regalo va al competidor que sí ofrece",
    pacSim: "Paquetes/membresías mencionados en el sitio",
    pacNao: "Ningún paquete ni membresía en el sitio — solo venta suelta",
    catalogo: (sp, s, falta) => `Catálogo: ${sp} de ${s} servicios con precio definido${falta ? " — un servicio sin precio se vuelve una cotización inventada en la llamada" : ""}`,
    catalogoNM: "catálogo — ningún servicio registrado",
    recorrencia: (p, m, v) => `${p} paquete(s) y ${m} membresía(s) configurados en la plataforma; ${v} vendido(s)`,
    recAspecto: {
      presenca_web: "Corregir lo básico del SEO técnico (title/description/schema) — es lo que Google lee antes que cualquier visitante.",
      descoberta: "Publicar camino de reseña y alimentar la ficha de Google — la lista de búsqueda ya viene ordenada por prueba social.",
      redes_sociais: "Enlazar los perfiles activos en el sitio; un perfil que el sitio no señala no existe para quien llega ahora.",
      captura_de_leads: "Cerrar los huecos de captura: cada canal ausente es un tipo de cliente que se va sin dejar contacto.",
      atendimento: "Cubrir las horas en que el teléfono suena sin nadie — ahí es donde se escapa primero el ingreso.",
      vendas_digitais: "Abrir la venta sin presencia (pago en línea, gift card, paquete) — ingreso que entra durmiendo.",
    },
    premPerdidas: (lig, fe, ab, fonte, p) => `${lig} llamadas registradas en la línea en los últimos 30 días × (${fe}h cerradas ÷ ${ab}h abiertas, ${fonte}) = ~${p}/mes que caerían al buzón sin atención 24/7. Premisa: demanda uniforme a lo largo de la semana — en la práctica, fuera de horario concentra aún más (quien trabaja llama de noche).`,
    premPerdidasSemVolume: (fonte, fe) => `No estimado: ${fonte} deja ${fe}h/semana sin nadie, pero no hay volumen REAL de llamadas medido para multiplicar (el modo prospect no tiene línea instrumentada). Activar la línea Guileo lo mide en 30 días — un número inventado aquí sería una suposición con cara de medición.`,
    premPerdidasSemNada: "No estimado: sin horario legible y sin volumen de llamadas medido.",
    premReceita: (p, t, n, r) => `${p} llamadas perdidas estimadas/mes × premisa declarada de 1 de cada 3 llamadas convirtiéndose en reserva × ticket promedio REAL de ${t} (promedio de los ${n} servicios con precio del catálogo) = ~${r}/mes en riesgo. La tasa de 1/3 es premisa, no medición — ajústala con la conversión real del embudo cuando haya 90 días de datos.`,
    premReceitaSemPerdidas: "No estimado: depende de la estimación de llamadas perdidas (arriba).",
    premReceitaSemTicket: "No estimado: sin ticket promedio real (catálogo sin precios) — usar un precio inventado aquí es el pecado que arruinó la primera llamada real.",
    estr: {
      voz: {
        gap: (fe, fonte) => `${fe}h/semana con el teléfono sin nadie (${fonte})`,
        rec: "Agente de voz 24/7 atendiendo en el número actual — cubre exactamente la ventana en que hoy la llamada cae al buzón.",
        nome: "Gui — agente de voz 24/7",
      },
      agenda: {
        gap: "No se puede reservar sin hablar con alguien",
        rec: "Reserva en la propia llamada/chat, contra la agenda real — reservar deja de ocupar al equipo.",
        nome: "Motor de Agenda",
      },
      chat: {
        gap: "Ningún canal de texto",
        rec: "Widget de chat + WhatsApp con la misma agente y la misma agenda — captura a quien nunca va a llamar.",
        nome: "Widget Guileo + WhatsApp",
      },
      speedlead: {
        gap: "El lead escribe y se queda esperando",
        rec: "Un formulario enviado se vuelve llamada de la agente en ~60 segundos — quien responde primero se queda con el cliente.",
        nome: "Speed-to-lead",
      },
      cobra: {
        gap: "La venta solo ocurre con alguien presente",
        rec: "Cobrar en la propia llamada (pay-link por SMS), paquetes, membresías y gift cards en línea.",
        nome: "Gui Cierra & Cobra + Paquetes/Gift Cards",
      },
      catalogo: {
        gap: (sp, s) => `Catálogo con servicios sin precio (${sp} de ${s} con precio)`,
        rec: "Ponerle precio a todo el catálogo — un servicio sin precio se vuelve cotización inventada en la llamada o un pedido de presupuesto que espera a un humano.",
        nome: "Catálogo con precios + Gui Cierra & Cobra",
      },
      pulse: {
        gap: "El cliente satisfecho se va callado",
        rec: "Pedir reseña después de cada visita y responder las que llegan — la prueba social es el criterio de elección en la búsqueda local.",
        nome: "Guileo Pulse (XM)",
      },
    },
    fase2: {
      recorrencia: {
        gap: (p, pv, m, g) => `Ingreso recurrente detenido: ${p} paquete(s) creado(s) y ${pv} vendido(s), ${m} membresía(s), ${g} gift card(s)`,
        rec: "Vender paquete/membresía en la propia llamada y por enlace — quien compra un paquete vuelve por contrato, no por recuerdo.",
        nome: "Paquetes, Membresías & Gift Cards",
        pot: "cada paquete vendido adelanta varias visitas de una vez — potencial: depende de cuántos clientes aceptan prepagar y del precio que definas.",
      },
      reativacao: {
        gap: (lig, ag, dif) => `${lig} llamadas registradas y ${ag} reserva(s): ${dif} persona(s) buscaron y no reservaron`,
        rec: "La agente vuelve a llamar a quien buscó y no reservó — y a quien hace tiempo no vuelve — con la oferta y la agenda en la mano.",
        nome: "Reactivación automática",
        pot: (t) => `cada regreso vale ~${t} en tu ticket promedio — potencial: depende de cuántas de esas personas siguen interesadas y contestan la llamada.`,
        potSemTicket: "potencial: depende de cuántas de esas personas siguen interesadas y contestan la llamada.",
      },
      reputacao: {
        gap: (n, q) => `Calificación ${n} con ${q} reseña(s) publicadas`,
        rec: "Pedir reseña después de cada visita y responder las que llegan — en la búsqueda local, la calificación es el criterio de elección.",
        nome: "Reputación & Reseñas",
        pot: "más reseñas recientes mejoran tu posición en la búsqueda local — potencial: depende del volumen de visitas y de cuántos clientes aceptan reseñar.",
      },
      campanhas: {
        gap: (lig, ag) => `Hoy la demanda viene solo de quien ya te conoce: ${lig} llamadas en 30 días, ${ag} se volvieron reserva`,
        rec: "Campañas pagas con el lead cayendo directo en la agente — cada anuncio medido por reserva, no por clic.",
        nome: "Campañas (Guileo AD)",
        pot: "abre una fuente de demanda que hoy no existe — potencial: depende de presupuesto, plaza y creativo; lo medimos campaña por campaña después de encenderlo.",
      },
    },
    fasesTxt: {
      pararNome: "Parar la pérdida",
      avancarNome: "Avanzar",
      cobrePremissa: (v) => `La única cifra en dinero MEDIDA en este informe es el ingreso en riesgo (${v}/mes), que viene de las llamadas que hoy caen al buzón — y la atención 24/7 cubre exactamente esa ventana. Los demás pasos de la Fase 1 cierran fugas medidas que no tienen cifra propia calculada; no sumamos números inventados, así que no entran en este total.`,
      cobreSem: "Este informe no tiene una cifra en dinero defendible para sumar — los pasos de la Fase 1 cierran fugas medidas que no tienen valor propio calculado.",
      avancarAviso: "Toda ganancia de la Fase 2 es POTENCIAL — depende de lo que dice cada paso. Nada de esto se ha medido aún en tu negocio.",
    },
    motivos: {
      "sem GOOGLE_PLACES_KEY": "ficha de Google no consultada (integración de búsqueda apagada)",
      "sem GOOGLE_PLACES_KEY — ficha do Google não consultada": "ficha de Google no consultada (integración de búsqueda apagada)",
      "negócio não encontrado no Google": "negocio no encontrado en Google",
      "consulta vazia": "consulta vacía",
      "sem endereço no site — vizinho de verdade exige endereço": "sin dirección en el sitio — comparar con vecinos exige dirección",
      "sem endereço do prospect — não dá pra achar vizinho de verdade": "sin dirección del negocio — comparar con vecinos exige dirección",
      "site-protegido-por-captcha": "sitio protegido por captcha/bot-check",
      "url-invalida-ou-interna": "dirección inválida o interna",
    },
  },
};

// Idiomas do backend: pt · en · es (mesma régua dos e-mails). Desconhecido → pt (padrão do motor).
export const LANGS = ["pt", "en", "es"];
// ⚠️ hi → en, NUNCA pt (2026-08-19). O site tem 4 idiomas; o motor escreve em 3. Sem esta linha
// um relatório em hindi vinha com a prosa do motor em PORTUGUÊS (o default), porque `hi` caía no
// mesmo balde de "desconhecido". Frase portuguesa dentro de página em hindi é o mesmo defeito da
// moldura EN em página PT, só que menos óbvio de ver. Inglês é o fallback do repo inteiro.
// (`functions/api/raio-x.js` já fazia esse mapa na mão; agora vale para TODA porta do motor,
// inclusive `functions/api/avaliacao.js`, que não fazia.)
const FALLBACK_LANG = { hi: "en" };
export const normLang = (l) => {
  const k = String(l || "").trim().slice(0, 2).toLowerCase();
  if (LANGS.includes(k)) return k;
  return FALLBACK_LANG[k] || "pt";
};
const dict = (lang) => TXT[normLang(lang)];

// ── A UNIDADE DE MEDIDA: a verificação ────────────────────────────────────────────────────────
// ok: true (passou) · false (falhou) · null (NÃO MEDIDO — sai do denominador).
// `evidencia` é obrigatória e FACTUAL: é ela que o vendedor lê em voz alta.
const chk = (id, ok, evidencia) => ({ id, ok, evidencia });

function pontuar(checks) {
  const medidos = checks.filter((c) => c.ok !== null);
  if (!medidos.length) return null;
  return Math.round((100 * medidos.filter((c) => c.ok).length) / medidos.length);
}

// Achata as verificações no formato do contrato: evidências legíveis, com o não-medido nomeado.
function aspecto(nome, checks, recomendacao, T) {
  return {
    nome,
    score: pontuar(checks),
    evidencias: checks.map((c) =>
      c.ok === null ? T.naoMedido(c.evidencia) : `${c.ok ? "✓" : "✗"} ${c.evidencia}`),
    recomendacao,
  };
}

// Pesos dos aspectos no score geral — somam 100. Atendimento pesa mais porque é O produto:
// a avaliação existe para vender atendimento, e o gap de atendimento é o que a Guileo fecha.
const PESOS = { presenca_web: 15, descoberta: 15, redes_sociais: 10, captura_de_leads: 20, atendimento: 25, vendas_digitais: 15 };

const fmtUsd = (n) => `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

// ═══ AS DUAS FASES (2026-08-18) ════════════════════════════════════════════════════════════════
// O plano deixou de ser lista plana e virou ESTRATÉGIA EM DUAS FASES, e a fase sai do MOTOR — o
// layout só desenha o que o motor decidiu. A regra é honesta e curta:
//   FASE 1 "parar"   → o passo fecha um gap que TEM medição neste relatório (horas fechadas,
//                      ligações perdidas, catálogo sem preço, canal ausente verificado no site).
//   FASE 2 "avancar" → crescimento SEM vazamento medido. Todo ganho sai marcado como POTENCIAL,
//                      com a dependência escrita. Nunca número medido.
// Ficam exportadas porque a mesma decisão precisa rodar fora do scan (backfill de payload já
// gravado, quando o site do cliente bloqueia robô e re-escanear não é opção).
export const FASE_POR_PRODUTO = {
  answering: "parar", agenda: "parar", widget_whatsapp: "parar",
  speedlead: "parar", close_collect: "parar", catalog: "parar",
  pulse: "avancar", reactivation: "avancar", reputation: "avancar", marketing_ads: "avancar",
};
// padrão "parar": passo antigo, sem fase gravada, fechava vazamento medido — era só isso que o
// motor emitia antes das fases existirem.
export const faseDoPasso = (produtoId) => FASE_POR_PRODUTO[produtoId] || "parar";

// ── A PERNA DE CADA PASSO — Brain · AD · Build (2026-08-18, pedido do Luis) ────────────────────
// «dividir a Fase 1 e a Fase 2 por GUILEO: o que cada perna vai fazer.» O relatório passou a
// AGRUPAR os passos pelas três pernas, e o agrupamento tinha que sair do DADO — igual ao `fase`,
// que já nasce aqui. Página nenhuma pode decidir a que perna um passo pertence: seriam duas
// verdades no dia em que o catálogo mudasse.
//
// ⚠️ A ATRIBUIÇÃO É A MESMA DO CATÁLOGO (`src/data/productSystem.js` → PRODUCTS[].pilar), e o
// critério dele é "QUEM EXECUTA", não "para que serve". Por isso `close_collect` fica em BRAIN
// mesmo falando de dinheiro: quem cota, fecha e cobra é a AGENTE — e a própria linha do pilar
// Brain na landing diz "answers, books, quotes, closes and collects". Movê-lo para Build faria a
// mesma página afirmar duas coisas diferentes sobre o mesmo produto, que é exatamente o defeito
// que o produto-sistema existe para impedir.
// As três chaves que NÃO são produto vendável (agenda, widget_whatsapp, catalog) recebem a perna
// aqui e a MESMA no PRODUCT_DETAIL do catálogo — `catalog` é Build porque é a fundação de dados
// sobre a qual a operação inteira roda (é o que a agente lê para nunca inventar preço).
export const PERNA_POR_PRODUTO = {
  answering: "brain", agenda: "brain", widget_whatsapp: "brain", speedlead: "brain",
  close_collect: "brain", reactivation: "brain", pulse: "brain", multilingual: "brain",
  reputation: "ad", marketing_ads: "ad", content: "ad", social_manage: "ad", crm_email: "ad", seo_aeo: "ad",
  catalog: "build", websites: "build", apps: "build", ecommerce: "build", automation: "build",
};
// null (e não um chute em "brain") quando a chave é desconhecida: a página então desenha o passo
// FORA dos três grupos, em vez de pendurá-lo na perna errada. Grupo errado é pior que sem grupo.
export const pernaDoPasso = (produtoId) => PERNA_POR_PRODUTO[produtoId] || null;

/** Fase 1 primeiro, prioridade dentro da fase. Teto por fase: 5 e 4 (lista maior vira parede). */
export function ordenarFases(itens) {
  const parar = itens.filter((s) => s.fase !== "avancar").sort((a, b) => a.prioridade - b.prioridade).slice(0, 5);
  const avancar = itens.filter((s) => s.fase === "avancar").sort((a, b) => a.prioridade - b.prioridade).slice(0, 4);
  return [...parar, ...avancar];
}

/**
 * FASE 2 a partir do que JÁ ESTÁ MEDIDO no banco do cliente. Cada item exige o dado que o
 * sustenta — sem o dado, o passo não nasce (nada de "poderia vender pacotes" no vazio).
 * @param {object} interno  snapshot avaliacao_client_snapshot — sem ele, Fase 2 sai vazia
 * @param {object} ficha    ficha do Google (só para o passo de reputação) — opcional
 */
export function passosAvancar({ interno, ficha = null, T }) {
  const F = T.fase2;
  const out = [];
  if (!interno) return out;

  const pacotes = interno.pacotes || 0, vendidos = interno.pacotes_vendidos || 0;
  const memb = interno.memberships || 0, gift = interno.gift_cards || 0;
  // dado que sustenta: existe estrutura de recorrência mas ela NÃO gira (ou nem existe)
  if (vendidos === 0 || memb === 0 || gift === 0) out.push({
    prioridade: 6, fase: "avancar",
    gap: F.recorrencia.gap(pacotes, vendidos, memb, gift),
    recomendacao: F.recorrencia.rec,
    produto_id: "close_collect", produto_guileo: F.recorrencia.nome,
    potencial: F.recorrencia.pot,
  });

  const ligT = interno.ligacoes_total ?? null, agT = interno.agendamentos_total ?? null;
  if (ligT != null && agT != null && ligT > agT) {
    const t = interno.ticket_medio ? Number(interno.ticket_medio) : null;
    out.push({
      prioridade: 7, fase: "avancar",
      gap: F.reativacao.gap(ligT, agT, ligT - agT),
      recomendacao: F.reativacao.rec,
      produto_id: "reactivation", produto_guileo: F.reativacao.nome,
      potencial: t ? F.reativacao.pot(fmtUsd(Math.round(t))) : F.reativacao.potSemTicket,
    });
  }

  // reputação só quando a nota do Google foi REALMENTE consultada (ficha lida + nota presente)
  if (ficha && ficha.ok && ficha.nota != null) out.push({
    prioridade: 8, fase: "avancar",
    gap: F.reputacao.gap(ficha.nota, ficha.avaliacoes ?? "?"),
    recomendacao: F.reputacao.rec,
    produto_id: "reputation", produto_guileo: F.reputacao.nome,
    potencial: F.reputacao.pot,
  });

  // campanhas só quando existe demanda medida QUE CONVERTE — senão é anúncio pra funil furado
  const lig30 = interno.ligacoes_30d ?? 0, ag30 = interno.agendamentos_30d ?? 0;
  if (lig30 > 0 && ag30 > 0) out.push({
    prioridade: 9, fase: "avancar",
    gap: F.campanhas.gap(lig30, ag30),
    recomendacao: F.campanhas.rec,
    produto_id: "marketing_ads", produto_guileo: F.campanhas.nome,
    potencial: F.campanhas.pot,
  });

  return out;
}

/**
 * O TOTAL DA FASE 1 — quanto do dinheiro em risco ela cobre. Soma SÓ o que é defensável:
 * a única cifra em dinheiro medida do relatório é a receita em risco, e ela vem da janela sem
 * atendimento — que é exatamente o que o passo `answering` cobre. Somar os outros passos seria
 * inventar (eles fecham gaps medidos SEM valor próprio calculado) ou contar duas vezes.
 * Sem passo de atendimento ou sem receita medida → valor null + premissa dizendo por quê.
 */
export function resumoFases({ estrategia, previsoes, T }) {
  const F = T.fasesTxt;
  const parar = estrategia.filter((s) => s.fase !== "avancar");
  const avancar = estrategia.filter((s) => s.fase === "avancar");
  const risco = previsoes?.receita_em_risco_estimada_mes || {};
  const temAtendimento = parar.some((s) => s.produto_id === "answering");
  const cobre = temAtendimento && typeof risco.valor === "number"
    ? { valor: risco.valor, moeda: risco.moeda || "USD", premissa: F.cobrePremissa(fmtUsd(risco.valor)) }
    : { valor: null, moeda: null, premissa: F.cobreSem };
  return {
    parar: { nome: F.pararNome, passos: parar.length, cobre },
    avancar: { nome: F.avancarNome, passos: avancar.length, aviso: F.avancarAviso },
  };
}

/**
 * Avalia um negócio local. NUNCA lança — falha vira { ok:false, motivo }.
 * @param {string} site      URL pública do negócio
 * @param {object} env       env do worker (GOOGLE_PLACES_KEY acende a descoberta) — pode ser null
 * @param {string} negocio   dica de nome/tipo (melhora a busca no Google)
 * @param {object} interno   snapshot da RPC avaliacao_client_snapshot (modo cliente) — ou null
 * @param {string} lang      idioma da PROSA emitida: pt (padrão) · en · es. Dado nunca é traduzido.
 * @param {object} declarado  O QUE O DONO RESPONDEU no quiz do Guileo X-Ray (/raio-x):
 *        { horas_abertas_semana, ligacoes_semana, ticket_medio, quem_atende, dor }.
 *        ⚠️ DECLARADO NÃO É MEDIDO. Entra SÓ nas previsões (com a origem escrita na premissa) e
 *        no bloco `declarado` do payload. NUNCA entra no score por aspecto — a régua de 0-100 é
 *        a fração das verificações que NÓS medimos, e misturar declaração ali a transformaria em
 *        auto-avaliação com cara de medição. Dado interno medido SEMPRE vence o declarado.
 */
export async function avaliarNegocio({ site, env = null, negocio = "", interno = null, lang = "pt", declarado = null }) {
  const idioma = normLang(lang);
  const T = dict(idioma);
  // motivo técnico vindo de outra lib (googleBusiness/brandExtract) → texto no idioma quando
  // conhecido; senão passa cru (é código de diagnóstico, não prosa de venda).
  const mot = (m) => T.motivos[String(m || "")] || String(m || "?");

  // ── LEITURA DO SITE (medindo o tempo — a velocidade É uma das verificações) ────────────────
  const t0 = Date.now();
  const got = await buscarHtml(site);
  const ms = Date.now() - t0;
  const html = got.html || "";
  const siteLeu = !!html;
  const why = mot(got.why || "?");

  // O diagnóstico inteiro entra como base: achados, perfil, horário, comparação com vizinho.
  // O idioma do relatório TEM que descer até os achados. Sem isto a moldura traduz e o conteúdo
  // não — foi como "Pelo menos 144h por semana com o telefone sem ninguém" foi parar debaixo de
  // "WHAT WE MEASURED" num relatório mandado para um encanador de Nova York.
  const diag = await diagnosticar(site, env, negocio, lang);
  if (!diag.ok && !siteLeu && !interno) return { ok: false, motivo: diag.motivo || got.why || "nao_deu_pra_ler" };

  const perfil = diag.perfil || {};
  const horas = diag.horas || null;

  // MODO CLIENTE: quando o site não publica horário legível, a AGENDA INTERNA da plataforma
  // (biz_schedules, união de turnos) é o horário real do negócio — dado mais forte, não mais
  // fraco. `fonte` fica escrito na evidência e na premissa: o leitor sabe de onde veio o número.
  const agendaH = interno?.agenda_horas_semana != null ? Number(interno.agenda_horas_semana) : null;
  const horasBase = horas
    ? { ...horas, fonte: T.fonteSite }
    : (agendaH > 0
      ? { abertas: Math.round(agendaH), fechadas: Math.round(168 - agendaH), dias: interno.agenda_dias || null, fonte: T.fonteAgenda }
      : null);

  // ── FICHA + VIZINHOS (só com chave; o diagnosticar não devolve a ficha, então pedimos) ─────
  let ficha = { ok: false, motivo: "sem GOOGLE_PLACES_KEY" };
  let viz = { ok: false, motivo: "sem GOOGLE_PLACES_KEY" };
  if (env?.GOOGLE_PLACES_KEY) {
    const consulta = `${perfil.nome || negocio} ${perfil.endereco || ""}`.trim();
    // ⚠️ SERIAL DE PROPÓSITO — a ficha PRECISA vir antes dos vizinhos.
    // Antes as duas chamadas iam em Promise.all, então a busca de vizinhos não tinha como saber a
    // categoria do negócio e caía em `negocio || perfil.nome`. `negocio` é uma dica opcional que
    // quase sempre chega vazia, e o `||` trocava a pergunta inteira: em vez de "quem são os salões
    // perto dela", o Google recebia o NOME dela e devolvia um xará. Um vizinho é menos que o piso
    // de 3, então a comparação de prova social nem nascia — sem erro nenhum no caminho.
    // Perder o paralelismo custa alguns centésimos; a versão paralela custava a análise inteira.
    ficha = await fichaDoGoogle(env, consulta || site.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]);

    // 🚨 A IDENTIFICAÇÃO PRECISA SER PROVADA, NÃO PRESUMIDA (2026-08-19).
    // Quando o site do negócio bloqueia a leitura (403/captcha), `perfil.nome` chega vazio e a
    // busca no Google vira só o domínio. Aconteceu de verdade com a Natura: o Google devolveu
    // "Natura Med Spa - Upper East Side" — um XARÁ, com 4.5 e 16 avaliações — e o relatório
    // inteiro teria saído sobre OUTRA empresa, com o nome dela na capa, sem nada avisar.
    // O teste é EXATO, não por semelhança: o site que a ficha do Google publica tem que bater com
    // o domínio que a gente foi avaliar. Bateu → identificação confirmada, os números são dele.
    // Não bateu (ou o Google não publica site) → a ficha continua servindo de contexto, mas NADA
    // que dependa de "este negócio é aquele" pode sair como medição dele.
    const dom = (u) => { try { return new URL(u.startsWith("http") ? u : `https://${u}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; } };
    const identidadeConfirmada = !!(ficha.ok && ficha.site && dom(ficha.site) && dom(ficha.site) === dom(site));
    if (ficha.ok && !identidadeConfirmada) {
      ficha = { ...ficha, identidade_confirmada: false, motivo_identidade: siteLeu
        ? "o Google não publica o site deste negócio — não dá pra provar que é o mesmo"
        : "o site bloqueou nossa leitura, então a busca foi só pelo domínio e pode ter caído num xará" };
    } else if (ficha.ok) {
      ficha = { ...ficha, identidade_confirmada: true };
    }
    const categoria = (ficha.ok && (ficha.categoria || ficha.tipo)) || negocio || "";
    // 🚨 O ENDEREÇO DO GOOGLE É RESERVA DO ENDEREÇO DO SITE (2026-08-20).
    // Isto exigia `perfil.endereco`, que é raspado do SITE do negócio. Muito site local não
    // publica endereço, e outros bloqueiam nossa leitura — nesses casos a busca de vizinhos nem
    // era tentada e o relatório saía sem a régua da vizinhança, que é o argumento mais forte que
    // temos ("você tem 63 avaliações, a sua rua tem 43"). 79 relatórios já entregues a vendedores
    // saíram assim. E o dado estava na mão o tempo todo: `fichaDoGoogle` devolve `formattedAddress`
    // na MESMA consulta que já pagamos. Site é fonte frágil; ficha do Google é fonte firme.
    const enderecoDaBusca = perfil.endereco || (ficha.ok ? ficha.endereco : "") || "";
    viz = enderecoDaBusca
      ? await vizinhos(env, {
          tipo: categoria,                                   // CATEGORIA, nunca o nome
          endereco: enderecoDaBusca,
          excluirNome: ficha.nome || perfil.nome || "",
          excluirSite: ficha.site || site || "",             // duas unidades da mesma empresa dividem o site
          cidade: true,
        })
      : { ok: false, motivo: "sem endereço no site nem no Google — vizinho de verdade exige endereço" };
  }

  // helper: verificação que depende do site ter aberto
  const naoLeu = (id) => chk(id, null, T.naoAbriu(T.rot[id] || id, why));
  const noSite = (id, re, simTxt, naoTxt) =>
    siteLeu ? chk(id, re.test(html), re.test(html) ? simTxt : naoTxt) : naoLeu(id);

  // ── ASPECTO 1 · PRESENÇA WEB ───────────────────────────────────────────────────────────────
  const pw = [];
  const baseUrl = got.base || site;
  pw.push(siteLeu
    ? chk("ssl", baseUrl.startsWith("https://"), baseUrl.startsWith("https://") ? T.sslSim(baseUrl) : T.sslNao(baseUrl))
    : naoLeu("ssl"));
  pw.push(siteLeu ? chk("velocidade", ms < 3000, ms < 3000 ? T.velSim(ms) : T.velNao(ms)) : naoLeu("velocidade"));
  pw.push(noSite("mobile", /<meta[^>]+name=["']viewport/i, T.mobileSim, T.mobileNao));
  pw.push(siteLeu
    ? chk("titulo", /<title>[^<]{3,}<\/title>/i.test(html), /<title>[^<]{3,}<\/title>/i.test(html) ? T.tituloSim : T.tituloNao)
    : naoLeu("titulo"));
  pw.push(noSite("descricao", /<meta[^>]+name=["']description/i, T.descSim, T.descNao));
  pw.push(noSite("dados_estruturados", /application\/ld\+json/i, T.dadosSim, T.dadosNao));
  pw.push(noSite("social_preview", /property=["']og:/i, T.socialSim, T.socialNao));

  // ── ASPECTO 2 · DESCOBERTA (Google Business / avaliações) ──────────────────────────────────
  const dc = [];
  if (ficha.ok) {
    dc.push(chk("ficha_google", true, T.fichaSim(ficha.nome, ficha.status === "OPERATIONAL" ? "" : ` (status ${ficha.status})`)));
    dc.push(ficha.nota != null
      ? chk("nota", ficha.nota >= 4.5, T.notaSim(ficha.nota, ficha.avaliacoes ?? "?"))
      : chk("nota", null, T.notaNM));
    dc.push(chk("horario_no_google", !!ficha.horarios, ficha.horarios ? T.horarioSim : T.horarioNao));
    if (viz.ok && ficha.avaliacoes != null) {
      const nums = viz.lista.map((p) => p?.userRatingCount).filter((n) => typeof n === "number");
      if (nums.length >= 3) {
        const mediana = nums.slice().sort((a, b) => a - b)[Math.floor(nums.length / 2)];
        dc.push(chk("prova_social", ficha.avaliacoes >= mediana, T.provaSim(ficha.avaliacoes, mediana, nums.length)));
      } else dc.push(chk("prova_social", null, T.provaPoucos(nums.length)));
    } else dc.push(chk("prova_social", null, T.provaNM(viz.ok ? T.provaSemContagem : mot(viz.motivo))));
  } else {
    dc.push(chk("ficha_google", null, T.fichaNM(mot(ficha.motivo))));
    dc.push(chk("nota", null, T.notaNaoConsultado));
    dc.push(chk("horario_no_google", null, T.horarioNaoConsultado));
    dc.push(chk("prova_social", null, T.provaNaoConsultado));
  }
  dc.push(noSite("caminho_de_avaliacao", REVIEW, T.avaliarSim, T.avaliarNao));

  // ── ASPECTO 3 · REDES SOCIAIS (só o que o site declara — não vasculhamos perfis) ───────────
  const rs = [];
  rs.push(noSite("instagram", /instagram\.com\//i, T.igSim, T.igNao));
  rs.push(noSite("facebook", /facebook\.com\//i, T.fbSim, T.fbNao));
  rs.push(noSite("outras_redes", /tiktok\.com|youtube\.com|linkedin\.com|(twitter|x)\.com/i, T.outrasSim, T.outrasNao));

  // ── ASPECTO 4 · CAPTURA DE LEADS ───────────────────────────────────────────────────────────
  const cl = [];
  cl.push(noSite("telefone_clicavel", /href=["']tel:/i, T.telSim, T.telNao));
  cl.push(noSite("formulario", /<form[\s>]/i, T.formSim, T.formNao));
  cl.push(noSite("chat", CHAT, T.chatSim, T.chatNao));
  cl.push(noSite("whatsapp", WHATS, T.waSim, T.waNao));
  cl.push(noSite("agendamento_online", AGENDA, T.agSim, T.agNao));

  // ── ASPECTO 5 · ATENDIMENTO ────────────────────────────────────────────────────────────────
  const at = [];
  if (horasBase) {
    at.push(chk("cobertura_24_7", horasBase.fechadas === 0,
      T.cobertura(horasBase.abertas, horasBase.fechadas, horasBase.fonte, horasBase.dias ?? "?")));
  } else {
    at.push(chk("cobertura_24_7", null, T.coberturaNM));
  }
  if (interno) {
    const lig = interno.ligacoes_30d || 0;
    at.push(chk("agente_ativo", lig > 0, lig > 0 ? T.agenteSim(lig, interno.dur_media_s ?? "?") : T.agenteNao));
    const lp = interno.lig_positivas || 0, ln = interno.lig_negativas || 0;
    at.push(lp + ln > 0
      ? chk("sentimento", lp >= ln, T.sentimento(lp, ln))
      : chk("sentimento", null, T.sentimentoNM));
    at.push(lig > 0
      ? chk("ligacao_vira_agenda", (interno.agendamentos_30d || 0) > 0, T.ligAgenda(interno.agendamentos_30d || 0, lig))
      : chk("ligacao_vira_agenda", null, T.ligAgendaNM));
  } else {
    at.push(chk("agente_ativo", null, T.agenteNM));
  }

  // ── ASPECTO 6 · VENDAS DIGITAIS ────────────────────────────────────────────────────────────
  const vd = [];
  vd.push(noSite("pagamento_online", /stripe\.com|squareup\.com|checkout|paypal\.com|shopify|add.to.cart/i, T.pagSim, T.pagNao));
  vd.push(noSite("gift_cards_site", /gift ?-?card|vale.presente/i, T.giftSim, T.giftNao));
  vd.push(noSite("pacotes_site", /package|pacote|membership|bundle/i, T.pacSim, T.pacNao));
  if (interno) {
    const s = interno.servicos || 0, sp = interno.servicos_com_preco || 0;
    vd.push(s > 0
      ? chk("catalogo_precificado", sp / s >= 0.9, T.catalogo(sp, s, sp < s))
      : chk("catalogo_precificado", null, T.catalogoNM));
    vd.push(chk("recorrencia_configurada", (interno.pacotes || 0) + (interno.memberships || 0) > 0,
      T.recorrencia(interno.pacotes || 0, interno.memberships || 0, interno.pacotes_vendidos || 0)));
  }

  const aspectos = [
    aspecto("presenca_web", pw, T.recAspecto.presenca_web, T),
    aspecto("descoberta", dc, T.recAspecto.descoberta, T),
    aspecto("redes_sociais", rs, T.recAspecto.redes_sociais, T),
    aspecto("captura_de_leads", cl, T.recAspecto.captura_de_leads, T),
    aspecto("atendimento", at, T.recAspecto.atendimento, T),
    aspecto("vendas_digitais", vd, T.recAspecto.vendas_digitais, T),
  ];

  // Score geral = média ponderada dos aspectos MEDIDOS (aspecto sem nenhuma medição sai da conta).
  let somaP = 0, soma = 0;
  for (const a of aspectos) {
    if (a.score === null) continue;
    const p = PESOS[a.nome] || 10;
    soma += a.score * p; somaP += p;
  }
  const scoreGeral = somaP ? Math.round(soma / somaP) : null;

  // ── CONCORRENTES ───────────────────────────────────────────────────────────────────────────
  // ⚠️ USO INTERNO (vendedor). A página do PROSPECT nunca cita nome de vizinho — regra da
  // ROTA-ANALISE: documento que o prospect encaminha não pode virar fofoca do bairro.
  // ⚠️ INDEXAR DICIONÁRIO SEM FALLBACK É COMO O MOTOR CALA (2026-08-19): idioma fora das 3 chaves
  // devolveria `undefined` e a primeira chamada (`forcaTxt.nota(...)`) derrubaria a avaliação
  // inteira — falha total num bloco secundário. `normLang` já protege, mas o fallback explícito é
  // o que garante que a trava continue valendo se alguém adicionar um idioma amanhã.
  const FORCA = { pt: { nota: (r) => `nota ${r}`, av: (n) => `${n} avaliações`, hor: "horário publicado", nada: "sem dado público" },
                  en: { nota: (r) => `${r} rating`, av: (n) => `${n} reviews`, hor: "hours published", nada: "no public data" },
                  es: { nota: (r) => `calificación ${r}`, av: (n) => `${n} reseñas`, hor: "horario publicado", nada: "sin dato público" } };
  const forcaTxt = FORCA[idioma] || FORCA.en;
  // ⚠️ NÚMERO CRU + a frase. A régua da vizinhança (RelatorioVizinhanca.jsx) precisa de `nota` e
  // `avaliacoes` como NÚMERO para posicionar o marcador e calcular a mediana. Antes só saía a
  // frase pronta ("nota 4.5 · 16 avaliações"), e a única forma de plotar seria fazer a página
  // reparsear texto traduzido — que é exatamente o tipo de instrumento que inventa sucesso.
  // Quem não publicou o número sai como `null`: não vira 0, ele apenas fica fora da conta.
  const concorrentes = viz.ok
    ? viz.lista.slice(0, 9).map((p) => ({
        nome: p?.displayName?.text || "?",
        nota: typeof p?.rating === "number" ? p.rating : null,
        avaliacoes: typeof p?.userRatingCount === "number" ? p.userRatingCount : null,
        forca_aparente: [
          typeof p?.rating === "number" ? forcaTxt.nota(p.rating) : null,
          typeof p?.userRatingCount === "number" ? forcaTxt.av(p.userRatingCount) : null,
          (p?.regularOpeningHours?.weekdayDescriptions || []).length ? forcaTxt.hor : null,
        ].filter(Boolean).join(" · ") || forcaTxt.nada,
      }))
    : [];

  // ── PREVISÕES — SEMPRE { valor, premissa }. Sem insumo medido → valor null. ────────────────
  const lig30 = interno?.ligacoes_30d ?? null;
  const ticket = interno?.ticket_medio ? Number(interno.ticket_medio) : null;

  // ── DECLARADO PELO DONO (quiz do /raio-x) ──────────────────────────────────────────────────
  // Só as previsões olham para cá, e só quando NÃO existe a medição equivalente. O prospect não
  // tem linha instrumentada: sem isto o bloco de dinheiro dele é sempre "não estimado", e um
  // raio-X sem número não move ninguém. Com isto ele tem número — e a premissa diz, com todas as
  // letras, que o volume e o ticket vieram da boca do dono, não da nossa medição.
  const dNum = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
  const dHoras = declarado ? dNum(declarado.horas_abertas_semana) : null;
  const dLigSem = declarado ? dNum(declarado.ligacoes_semana) : null;
  const dTicket = declarado ? dNum(declarado.ticket_medio) : null;
  // horário: medido (site/agenda) vence; declarado só preenche o vazio. Nunca toca nos aspectos.
  const horasPrev = horasBase || (dHoras && dHoras < 168
    ? { abertas: Math.round(dHoras), fechadas: Math.round(168 - dHoras), dias: null, fonte: T.fonteDeclarado, declarado: true }
    : null);
  // ligações/mês declaradas: semana × 4.33 (média de semanas por mês), arredondado.
  const ligDecl30 = dLigSem ? Math.round(dLigSem * 4.33) : null;

  let perdidas = null, premissaPerdidas, perdidasDeclarada = false;
  if (horasPrev && horasPrev.fechadas > 0 && lig30 != null && lig30 > 0 && horasPrev.abertas > 0) {
    perdidas = Math.round(lig30 * (horasPrev.fechadas / horasPrev.abertas));
    premissaPerdidas = T.premPerdidas(lig30, horasPrev.fechadas, horasPrev.abertas, horasPrev.fonte, perdidas);
  } else if (horasPrev && horasPrev.fechadas > 0 && ligDecl30 && horasPrev.abertas > 0) {
    perdidas = Math.round(ligDecl30 * (horasPrev.fechadas / horasPrev.abertas));
    perdidasDeclarada = true;
    premissaPerdidas = T.premPerdidasDecl(dLigSem, ligDecl30, horasPrev.fechadas, horasPrev.abertas, horasPrev.fonte, perdidas);
  } else if (horasPrev && horasPrev.fechadas > 0) {
    premissaPerdidas = T.premPerdidasSemVolume(horasPrev.fonte, horasPrev.fechadas);
  } else {
    premissaPerdidas = T.premPerdidasSemNada;
  }

  let receita = null, premissaReceita, receitaDeclarada = false;
  if (perdidas != null && ticket && !perdidasDeclarada) {
    receita = Math.round(perdidas * (1 / 3) * ticket);
    premissaReceita = T.premReceita(perdidas, fmtUsd(ticket), interno.servicos_com_preco, fmtUsd(receita));
  } else if (perdidas != null && (ticket || dTicket)) {
    const t = ticket || dTicket;
    receita = Math.round(perdidas * (1 / 3) * t);
    receitaDeclarada = true;
    premissaReceita = T.premReceitaDecl(perdidas, fmtUsd(t), fmtUsd(receita));
  } else {
    premissaReceita = perdidas == null ? T.premReceitaSemPerdidas : T.premReceitaSemTicket;
  }

  const previsoes = {
    // `declarado:true` = o número nasceu de uma resposta do dono, não de medição nossa. A premissa
    // já diz isso por extenso; o campo existe para a página poder SELAR visualmente a diferença
    // sem reler prosa (a mesma lógica do ✓ MEDIDO vs ◔ POTENCIAL do relatório).
    ligacoes_perdidas_estimadas_mes: { valor: perdidas, premissa: premissaPerdidas, declarado: perdidasDeclarada || undefined },
    receita_em_risco_estimada_mes: { valor: receita, moeda: receita != null ? "USD" : null, premissa: premissaReceita, declarado: receitaDeclarada || undefined },
  };

  // ── ESTRATÉGIA — cada recomendação liga um GAP MEDIDO a um produto Guileo ──────────────────
  // `produto_id` é a CHAVE ESTÁVEL (não traduzida): é ela que a página usa para buscar a ficha
  // completa do produto no catálogo (src/data/productSystem.js → PRODUCT_DETAIL). O
  // `produto_guileo` continua saindo como texto legível, no idioma, para quem só lê o JSON.
  const falhou = (lista, id) => lista.some((c) => c.id === id && c.ok === false);
  const E = T.estr;
  const estrategia = [];
  if (horasPrev && horasPrev.fechadas > 0) estrategia.push({
    prioridade: 1, gap: E.voz.gap(horasPrev.fechadas, horasPrev.fonte),
    recomendacao: E.voz.rec, produto_id: "answering", produto_guileo: E.voz.nome,
  });
  if (falhou(cl, "agendamento_online")) estrategia.push({
    prioridade: 2, gap: E.agenda.gap, recomendacao: E.agenda.rec,
    produto_id: "agenda", produto_guileo: E.agenda.nome,
  });
  if (falhou(cl, "chat") && falhou(cl, "whatsapp")) estrategia.push({
    prioridade: 3, gap: E.chat.gap, recomendacao: E.chat.rec,
    produto_id: "widget_whatsapp", produto_guileo: E.chat.nome,
  });
  if (falhou(cl, "formulario") || (cl.find((c) => c.id === "formulario")?.ok && falhou(cl, "telefone_clicavel"))) estrategia.push({
    prioridade: 3, gap: E.speedlead.gap, recomendacao: E.speedlead.rec,
    produto_id: "speedlead", produto_guileo: E.speedlead.nome,
  });
  if (falhou(vd, "pagamento_online") || falhou(vd, "recorrencia_configurada") || falhou(vd, "gift_cards_site")) estrategia.push({
    prioridade: 4, gap: E.cobra.gap, recomendacao: E.cobra.rec,
    produto_id: "close_collect", produto_guileo: E.cobra.nome,
  });
  if (falhou(vd, "catalogo_precificado")) estrategia.push({
    prioridade: 4, gap: E.catalogo.gap(interno?.servicos_com_preco ?? "?", interno?.servicos ?? "?"),
    recomendacao: E.catalogo.rec, produto_id: "catalog", produto_guileo: E.catalogo.nome,
  });
  if (falhou(dc, "caminho_de_avaliacao") || falhou(dc, "prova_social")) estrategia.push({
    prioridade: 5, gap: E.pulse.gap, recomendacao: E.pulse.rec,
    produto_id: "pulse", produto_guileo: E.pulse.nome,
  });

  // cada passo acima nasce de um gap MEDIDO → todos são Fase 1 (parar a perda), exceto o Pulse,
  // que é prova social — crescimento, não vazamento com número.
  for (const s of estrategia) s.fase = faseDoPasso(s.produto_id);
  // Fase 2 — só nasce onde o dado interno sustenta (ver passosAvancar).
  const avancar = passosAvancar({ interno, ficha: ficha.ok ? ficha : null, T });
  const estrategiaFinal = ordenarFases([...estrategia, ...avancar]);
  // A PERNA vai junto no payload, em TODO passo (fase 1 e fase 2): é ela que agrupa o plano em
  // 🧠 Brain · 📈 AD · 🏗️ Build na página. Marcado depois de ordenar para pegar as duas listas.
  for (const s of estrategiaFinal) s.perna = pernaDoPasso(s.produto_id);

  return {
    ok: true,
    business: perfil.nome || negocio || "",
    site,
    lang: idioma,
    avaliado_em: new Date().toISOString(),
    modo: interno ? "cliente" : "prospect",
    fonte: siteLeu ? "site" : (diag.fonte || "google"),
    score_geral: scoreGeral,
    aspectos,
    // os achados-ferida do diagnóstico entram inteiros — são a narrativa; o score é a régua
    achados: diag.achados || [],
    concorrentes,
    // A POSIÇÃO DELA na régua da vizinhança. Vem da ficha do Google — a MESMA fonte dos vizinhos,
    // que é o que torna a comparação honesta: comparar a nota dela medida num lugar com a dos
    // vizinhos medida em outro seria comparar duas réguas diferentes. Sem ficha → null, e o bloco
    // simplesmente não desenha (ausência de medição nunca vira zero).
    // Só sai com a identidade PROVADA (o Google publica o mesmo domínio). Colocar a nota de um
    // xará na régua da vizinhança seria pior que não ter régua nenhuma.
    minha_ficha: ficha.ok && ficha.identidade_confirmada
      // `endereco` entra aqui porque é ele que permite REFAZER a busca de vizinhos depois sem
      // pagar uma segunda consulta ao Google. Guardar o que já se pagou é mais barato que repetir.
      ? { nota: ficha.nota ?? null, avaliacoes: ficha.avaliacoes ?? null, categoria: ficha.categoria || ficha.tipo || "", endereco: ficha.endereco || "" }
      : null,
    identificacao: ficha.ok
      ? { confirmada: !!ficha.identidade_confirmada, nome_no_google: ficha.nome || "", motivo: ficha.motivo_identidade || null }
      : { confirmada: false, nome_no_google: "", motivo: ficha.motivo || "negócio não encontrado no Google" },
    previsoes,
    estrategia: estrategiaFinal,
    fases: resumoFases({ estrategia: estrategiaFinal, previsoes, T }),
    metricas_internas: interno || null,
    // O QUE O DONO DECLAROU (quiz do /raio-x). Fica GRAVADO junto do relatório por duas razões:
    // (1) auditoria — daqui a 30 dias dá para confrontar o declarado com o medido, e essa diferença
    // é o produto; (2) contexto da call de 15 minutos (quem atende hoje, o que mais dói).
    declarado: declarado || null,
    nota_fonte: diag.nota_fonte || null,
  };
}
