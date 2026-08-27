import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { STAGES } from "./SellerFollowup.jsx";
import { pernaMeta, PERNAS } from "./RelatorioEspelho.jsx";
import { NOT_MEASURED, GANHO, aspectLabel } from "../lib/reportScale.js";
import { waTo } from "../data/contact.js";

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 📥 SellerLeads — A TELA PRINCIPAL DO HUB. Não é uma lista: é um DOSSIÊ por pessoa.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Luis (2026-08-20): «junta leads e follow-up numa coisa só» · «os leads têm que ser lindos, suaves,
// perfeitos, inteligentes — como páginas de livro, não tiras. Ali vive o lead: cadastro, escrita,
// notes, tudo. Fechar vendas com cliques, baixar a dor deles e posicionar nossas ferramentas
// cirurgicamente em 3 palavras.»
//
// A TESE DE DESENHO: tira serve para escanear 200 itens; PÁGINA serve para FECHAR UM. Um lead que
// CHEGOU e um prospect que o vendedor ADICIONOU são a MESMA pessoa em etapas diferentes da mesma
// vida — a etapa é PROPRIEDADE do lead, nunca o endereço dele. Por isso UMA fila só, alimentada por
// duas fontes, e a etapa mudando dentro da própria página.
//
// ── AS 4 CAMADAS DE CADA PÁGINA (na ordem da conversa) ────────────────────────────────────────
//   1. QUEM É e HÁ QUANTO TEMPO CHEGOU  → o cronômetro, com peso tipográfico de destaque
//   2. A DOR MEDIDA                     → /api/avaliacao?id= (score, ficha do Google, evidências)
//   3. AS 3 PALAVRAS                    → cada dor medida ligada a UMA perna (Brain·AD·Build)
//   4. A VIDA                           → nota, etapa, próximo toque, histórico — tudo aqui dentro
//
// ── O QUE A PESQUISA MANDOU (2026-08-20) ──────────────────────────────────────────────────────
//  • ORDEM = RECÊNCIA, NUNCA "score"/probabilidade. A evidência sobre TEMPO é forte (MIT/InsideSales
//    2007: odds de contato caem ~100× de 5min→30min; HBR 2011: responder em 1h ≈ 7× mais chance de
//    qualificar). A evidência de que ordenar por score vende mais é INEXISTENTE — não há experimento
//    publicado comparando as duas. Então o mais recente vem primeiro, sempre. Sem exceção, sem
//    "prioridade inteligente": inventar uma régua sem prova é o mesmo defeito de inventar um número.
//  • O CRONÔMETRO É O HERÓI DA TELA. É o achado mais bem sustentado da pesquisa inteira — então ele
//    tem tamanho de manchete e cor que esquenta, não uma legenda cinza no canto.
//  • A TELA AVANÇA SOZINHA. Padrão do HubSpot Sales Workspace (e de Salesforce/Apollo/Outreach/Gong):
//    ninguém de primeira linha entrega uma LISTA — todos entregam UMA FILA COM UM PRÓXIMO. Aqui a
//    lista existe para ESCOLHER; depois de agir (etapa, nota, entrou no funil) a página AVANÇA para
//    o próximo lead sozinha. As duas coisas convivem: escolher é da lista, trabalhar é da fila.
//  • ALVO DE TOQUE 48px (Material especifica 48dp, "larger is even better"; os 44pt da Apple HIG são
//    o tamanho PADRÃO, não o mínimo; a WCAG AA exige só 24px). 48 é o número de quem usa na rua.
//  • TODO input/textarea com font-size ≥ 16px — abaixo disso o Safari iOS dá zoom no foco e quebra
//    o layout. O campo de nota é o principal risco. (Comportamento reproduzível; não é norma citável.)
//
// ── E DUAS COISAS QUE A EVIDÊNCIA PROÍBE ──────────────────────────────────────────────────────
//  ✗ NÃO CONTAR CLIQUES. A "regra dos 3 cliques" é mito (UIE: 44 usuários, 8.000 cliques, ZERO
//    correlação com sucesso; NN/g confirma). O que pesa é número de CAMPOS. Nada de sacrificar
//    clareza para economizar um toque.
//  ✗ NÃO ENQUADRAR COMO "QUANTO VOCÊ ESTÁ PERDENDO". Meta-análise de 93 estudos: ganho vs perda dá
//    r = .03, praticamente nulo. O que faz o raio-X funcionar é o FATO MEDIDO — o número dele e a
//    comparação com a vizinhança. Por isso as 3 palavras e o e-mail carregam número, nunca retórica
//    de perda; e por isso `PERDA` (o vermelho semântico) NÃO é importado aqui.
//
// ── AS LEIS DE HONESTIDADE (skill growth-report §3, valem igual nesta tela) ────────────────────
//  • `null` é NÃO MEDIDO — nunca 0, sempre cinza (`NOT_MEASURED`). Campo ausente vira "não informado".
//  • BLOCO SEM DADO NÃO DESENHA. Lead sem `avaliacao_id` simplesmente não tem a camada 2 nem a 3.
//  • ERRO NUNCA VIRA LISTA VAZIA. "Você não tem lead nenhum" e "não consegui ler" são coisas
//    diferentes, com soluções opostas — a tela diz qual das duas, e mostra o `motivo` CRU.
//  • COMPROVANTE: só diz "salvo" depois de ler `ok:true` **com o `id` da linha**. `r.ok` do fetch não
//    basta — este repo já teve confete de "fechou!" antes de qualquer confirmação do banco.
//  • Ícone/nome/cor das pernas vêm de `pernaMeta` (❤️ no AD é o override do relatório). Nada de hex
//    redigitado: o vendedor explica com um símbolo e o documento que ele manda mostra o mesmo.
//
// Props: { lang, seller, market, nav, handoff }.
// ═══════════════════════════════════════════════════════════════════════════════════════════════

// ── SINAIS DE URGÊNCIA ────────────────────────────────────────────────────────────────────────
// Os sinais Guileo já existentes (ARQUITETURA.md §6) — laranja da Gui, âmbar de atenção, azul de
// informação, taupe de "parado". Nada de paleta nova: o cronômetro esquenta na língua da casa.
const URGENCIA = [
  { max: 15,        hex: "#FF8A33", k: "agora"  }, // ≤15min — a janela de ouro da pesquisa
  { max: 60,        hex: "#f2b23e", k: "hoje"   }, // ≤1h    — ainda ~7× mais chance de qualificar
  { max: 60 * 24,   hex: "#5B9BD5", k: "dia"    }, // ≤24h
  { max: Infinity,  hex: "#948C7B", k: "antigo" },
];
const urgencia = (min) => (min == null ? { hex: NOT_MEASURED, k: "semData" } : URGENCIA.find((u) => min <= u.max));

const LOCALE = { pt: "pt-BR", en: "en-US", es: "es-ES", hi: "hi-IN" };

// aspecto medido → perna que resolve. O critério é QUEM EXECUTA (o mesmo do catálogo):
//   atendimento → 🧠 Brain (o cérebro atende)
//   descoberta / redes_sociais / prova_social → ❤️ AD (o coração traz prova e movimento)
//   captura_de_leads / vendas_digitais / presenca_web → 🏗️ Build (o corpo vende e cobra)
/* 🚨 A PERNA VEM DE QUEM EXECUTA, e este mapa discordava do catálogo (24/08).
   `vendas_digitais` é "nada fecha sem uma pessoa no telefone" — quem resolve isso é o AGENTE
   cotando, fechando e cobrando na ligação, e em src/data/productSystem.js `close_collect` e
   `answering` são **brain**. Estava marcado como build, e o efeito era que a BRAIN — a perna que
   a Guileo mais vende — desaparecia da ficha da maioria dos leads: só sobrava quando o aspecto
   "cobertura do telefone" vinha vermelho.
   `captura_de_leads` fica em build de propósito: o buraco ali é o site não ter formulário, e o
   formulário é obra. O que o agente faz DEPOIS (ligar em 60s) só existe se a captura existir. */

/* ── O PITCH: uma frase, a mais importante para AQUELE negócio ────────────────────────────────
   Luis (24/08): «o pitch mais importante de cada business, personalizado, pra e-mail e ligação».
   Sai da PIOR dor MEDIDA — não de um roteiro genérico — porque é isso que o dono reconhece na
   primeira frase. Serve nos dois canais de propósito: repetir a mesma frase no e-mail e na
   ligação é o que faz o dono lembrar de onde já ouviu aquilo.
   ⚠️ Sem dor medida não há pitch: a ficha mostra o aviso de medir, nunca uma frase inventada.
   O `%s` é o nome do negócio. */
const PITCH = {
  atendimento: {
    pt: (n) => `Liguei pra ${n} pra ver o que acontece com a chamada fora do horário — é por isso que estou te ligando.`,
    en: (n) => `I called ${n} to see what happens to a call after hours — that's actually why I'm calling you.`,
    es: (n) => `Llamé a ${n} para ver qué pasa con la llamada fuera de horario — por eso te estoy llamando.`,
    hi: (n) => `${n} पर कॉल करके देखा कि समय के बाद कॉल का क्या होता है — इसीलिए मैं कॉल कर रहा हूँ।`,
  },
  captura_de_leads: {
    pt: (n) => `No site do ${n} não tem como alguém falar com vocês sem pegar o telefone. Quem não liga, some.`,
    en: (n) => `On the ${n} site there's no way to reach you without picking up the phone. Whoever won't call just leaves.`,
    es: (n) => `En el sitio de ${n} no hay forma de contactarlos sin llamar. Quien no llama, se va.`,
    hi: (n) => `${n} की साइट पर फ़ोन किए बिना संपर्क का कोई रास्ता नहीं है।`,
  },
  vendas_digitais: {
    pt: (n) => `Nada no site do ${n} fecha sozinho — todo pedido precisa de uma pessoa no telefone.`,
    en: (n) => `Nothing on the ${n} site closes on its own — every job needs a person on the phone.`,
    es: (n) => `Nada en el sitio de ${n} cierra solo — cada trabajo necesita una persona al teléfono.`,
    hi: (n) => `${n} की साइट पर कुछ भी अपने आप बंद नहीं होता।`,
  },
  descoberta: {
    pt: (n) => `Procurei ${n} do jeito que um cliente procura, e vocês aparecem tarde demais.`,
    en: (n) => `I searched for ${n} the way a customer does, and you show up too late.`,
    es: (n) => `Busqué ${n} como lo hace un cliente, y aparecen demasiado tarde.`,
    hi: (n) => `मैंने ${n} को ग्राहक की तरह खोजा — आप बहुत देर से दिखते हैं।`,
  },
  redes_sociais: {
    pt: (n) => `Vocês fazem um trabalho bom e quase nada disso aparece onde as pessoas olham antes de ligar.`,
    en: (n) => `You do great work and almost none of it shows up where people look before they call.`,
    es: (n) => `Hacen un gran trabajo y casi nada aparece donde la gente mira antes de llamar.`,
    hi: (n) => `आपका काम बढ़िया है, पर वह वहाँ नहीं दिखता जहाँ लोग कॉल से पहले देखते हैं।`,
  },
  presenca_web: {
    pt: (n) => `Digitei o endereço do site do ${n} e ele não abriu direito. Quem procurou hoje, desistiu.`,
    en: (n) => `I typed the ${n} website address and it didn't open properly. Anyone who looked today gave up.`,
    es: (n) => `Escribí la dirección del sitio de ${n} y no abrió bien. Quien buscó hoy, se rindió.`,
    hi: (n) => `${n} की वेबसाइट खुली ही नहीं। जिसने आज देखा, वह चला गया।`,
  },
};

/* 🚨 O BOTÃO DO WEBSITE UPGRADE SÓ APARECE COM O SITE PRONTO (24/08). Aquele e-mail diz, na
   primeira linha, "a gente reconstruiu o seu site — está no ar". Mandá-lo sem o site construído
   seria a pior mentira possível: o dono clica e não acha nada, e a única chance de primeiro
   contato morre no clique. Enquanto não há reconstrução, a ficha oferece o e-mail do X-Ray, que
   é verdadeiro (mede, mostra e aponta o relatório). Chave = slug em src/pages/Novo.jsx. */
const SITE_RECONSTRUIDO = {
  "nonstopplumbers.com": "nonstop-plumbers",
  "astoriaplumbers.nyc": "astoria-plumbers",
  "astoriaplumbers.com": "astoria-plumbers",   // o .com deles redireciona pra uma pagina estacionada
  "queensnyplumber.com": "queens-plumber",
  "siderisplumbingandheating.com": "sideris-plumbing",
  "srgeneralconstructionnyc.com": "sr-general",
  "pennplazadental.com": "penn-plaza-dental",
};
const siteNovoDe = (site) => {
  const d = String(site || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
  const slug = SITE_RECONSTRUIDO[d];
  return slug ? `https://guileoai.com/novo/${slug}` : "";
};

const PERNA_DO_ASPECTO = {
  atendimento: "brain",
  vendas_digitais: "brain",
  descoberta: "ad",
  redes_sociais: "ad",
  prova_social: "ad",
  captura_de_leads: "build",
  presenca_web: "build",
};

const D = {
  en: {
    title: "📥 Leads", sub: "Every lead that arrived and every target you added — one queue, newest first. Open one and the whole dossier is here: their measured numbers, what to say, and the stage.",
    refresh: "↻ Refresh", loading: "Loading your queue…",
    kTotal: "In the queue", k24h: "Last 24h", kFunil: "In the funnel", kSoltos: "Untouched",
    errInboxT: "Couldn't read the leads that arrived", errFunilT: "Couldn't read your funnel",
    errTeamT: "The funnel needs your PERSONAL code",
    errTeamP: "You are signed in with the shared team code, and it cannot open another seller's private funnel. Ask Luis for your personal code and sign in again.",
    errSessT: "Your session expired", errSessP: "Sign out and back in to load your queue.",
    soLocalT: "Saved in THIS browser only",
    soLocalP: "You are signed in with the shared team code, so the server does not store your board. Ask Luis for your personal code — otherwise this work is lost when you change device.",
    errNet: "Network error — couldn't reach the server.",
    reason: "Reason", retry: "Try again",
    emptyT: "Nothing in your queue.", emptyP: "No lead is attributed to your link in the last 12 months. Leads only land here when they arrive through a link carrying your ?ref= — otherwise they sit unowned in admin.",
    filterAll: "All", filterNew: "Just arrived",
    now: "just now", minAgo: (n) => `${n} min ago`, hAgo: (n) => `${n}h ago`, dAgo: (n) => `${n}d ago`,
    uAgora: "Call now", uHoje: "Still warm", uDia: "Today", uAntigo: "Cooling", uSemData: "No arrival time",
    arrived: "Arrived", channel: "Channel", unknown: "not informed",
    canalAlvo: "target you added", canalPronto: "★ preview live — just send it", aPreview: "👁 Open the preview",
    buscaPh: "Search — name, email, phone, site, anything", buscaLimpa: "clear", buscaN: (n, m) => `${n} of ${m}`, buscaVazia: (q) => `Nothing matches "${q}". Try part of the name, the area code, or the domain.`,
    open: "Open", close: "Close", next: "Next lead →", queueEnd: "That was the last one in the queue.",
    dorT: "What we measured", score: "Overall score", notMeasured: "not measured",
    ficha: "Google profile", fichaNota: "rating", fichaAv: (n) => `${n} reviews`,
    hood: "Neighborhood median", hoodOf: (n) => `${n} businesses nearby`,
    loadingAval: "Reading the measured report…", avalErr: "Couldn't read this lead's report",
    sacadaT: "Say this", sacadaP: "One measured gap, one leg. Read the number, then the line.",
    legs: {
      brain: "Answers every call",
      ad: "Brings reviews and traffic",
      build: "Sells and collects online",
    },
    vidaT: "This lead's life", noteL: "Notes", notePh: "What happened? What's the next step?",
    save: "Save", saving: "Saving…", savedId: (id) => `Saved ✓ (#${id})`, saveFail: "Not saved",
    stageL: "Stage", nextL: "Next touch", clear: "clear",
    stages: { abordado: "Approached", conversa: "Talking", demo: "Demo", proposta: "Proposal", fechado: "Closed", perdido: "Lost" },
    addFunil: "➕ Add to funnel", adding: "Adding…", inFunil: "In the funnel",
    lastUpdate: "Last update", summary: "What they said",
    pitchT: "This business's pitch", aUpgrade: "🚀 Send the Website Upgrade", upSending: "Sending…", upOk: "Sent ✓", upErr: "did not go out — check the address", aCall: "📞 Call", aWa: "💬 WhatsApp", aMail: "✉️ Email", aReport: "📄 Report", aCopy: "📋 Copy link", copied: "Copied ✓", aNoWay: "No phone or email on this lead — ask for it on the call", aMeasure: "🩻 Measure with X-Ray", fones: "📞 Fill in phone + email", perto: "📍 Nearest me", pertoOn: "📍 By distance", geoNegado: "you did not allow location — the queue stays in arrival order", geoIndisp: "this device has no location", semLocal: "location unknown", aGmail: "📧 Gmail", aCopiarMail: "📋 Copy the email", aCopiadoMail: "Copied ✓", aQuote: "🧾 Quote", aContract: "📄 Contract", logMail: "email sent · promised $50 credit on month 1",
    waMsg: (n, b) => `Hi ${n || "there"}! This is Guileo${b ? ` — about ${b}` : ""}. You reached out about the AI receptionist that answers every call and books for you. Do you have 2 minutes?`,
    mailSubj: (b) => `${b || "Your business"} — I measured what your neighbors publish`,
    mailHi: (n) => `Hi ${n || "there"},`,
    mailIntro: "I run Guileo, here in the neighborhood. Before writing I measured your business the same way a customer sees it — Google profile, hours, site — and compared it with the businesses around you. Nothing private, all public data:",
    mailScore: (s) => `• Overall score: ${s}/100`,
    mailFicha: (r, c) => `• Your Google profile: ${r}★${c != null ? ` · ${c} reviews` : ""}`,
    mailHood: (m, n) => `• The businesses around you: ${m} reviews (median of ${n} nearby)`,
    mailLink: "The full report, with what I would fix first:",
    mailEnd: "Two things, no strings: the report above is yours to keep either way. And if we work together, I put $50 of credit on your first month — my way of paying for the first calls Gui answers for you.\n\nWorth two minutes on the phone? Reply with a time and I call you.",
  },
  pt: {
    title: "📥 Leads", sub: "Todo lead que chegou e todo alvo que você adicionou — uma fila só, o mais novo primeiro. Abra um e o dossiê inteiro está aqui: os números medidos dele, o que dizer, e a etapa.",
    refresh: "↻ Atualizar", loading: "Carregando sua fila…",
    kTotal: "Na fila", k24h: "Últimas 24h", kFunil: "No funil", kSoltos: "Sem toque",
    errInboxT: "Não consegui ler os leads que chegaram", errFunilT: "Não consegui ler o seu funil",
    errTeamT: "O funil exige o seu código PESSOAL",
    errTeamP: "Você entrou com o código de time, e ele não pode abrir o funil particular de outro vendedor. Peça o seu código pessoal ao Luis e entre de novo.",
    errSessT: "Sua sessão expirou", errSessP: "Saia e entre de novo pra carregar a fila.",
    soLocalT: "Salvo só NESTE navegador",
    soLocalP: "Você entrou com o código de time (compartilhado), então o servidor não guarda o seu quadro. Peça o seu código pessoal ao Luis — senão este trabalho some quando você trocar de aparelho.",
    errNet: "Erro de rede — não deu pra falar com o servidor.",
    reason: "Motivo", retry: "Tentar de novo",
    emptyT: "Nada na sua fila.", emptyP: "Nenhum lead atribuído ao seu link nos últimos 12 meses. Lead só cai aqui quando chega por um link com o seu ?ref= — sem isso ele fica sem dono no admin.",
    filterAll: "Todos", filterNew: "Acabou de chegar",
    now: "agora mesmo", minAgo: (n) => `há ${n} min`, hAgo: (n) => `há ${n}h`, dAgo: (n) => `há ${n}d`,
    uAgora: "Liga agora", uHoje: "Ainda quente", uDia: "Hoje", uAntigo: "Esfriando", uSemData: "Sem hora de chegada",
    arrived: "Chegou", channel: "Canal", unknown: "não informado",
    canalAlvo: "alvo que você adicionou", canalPronto: "★ preview no ar — é só mandar", aPreview: "👁 Abrir o preview",
    buscaPh: "Buscar — nome, e-mail, telefone, site, qualquer coisa", buscaLimpa: "limpar", buscaN: (n, m) => `${n} de ${m}`, buscaVazia: (q) => `Nada casa com "${q}". Tente parte do nome, o DDD, ou o domínio.`,
    open: "Abrir", close: "Fechar", next: "Próximo lead →", queueEnd: "Esse era o último da fila.",
    dorT: "O que a gente mediu", score: "Score geral", notMeasured: "não medido",
    ficha: "Ficha do Google", fichaNota: "nota", fichaAv: (n) => `${n} avaliações`,
    hood: "Mediana da vizinhança", hoodOf: (n) => `${n} negócios na volta`,
    loadingAval: "Lendo o relatório medido…", avalErr: "Não consegui ler o relatório deste lead",
    sacadaT: "Fale isto", sacadaP: "Uma dor medida, uma perna. Diga o número, depois a linha.",
    legs: {
      brain: "Atende toda ligação",
      ad: "Traz avaliação e movimento",
      build: "Vende e cobra online",
    },
    vidaT: "A vida deste lead", noteL: "Notas", notePh: "O que rolou? Qual o próximo passo?",
    save: "Salvar", saving: "Salvando…", savedId: (id) => `Salvo ✓ (#${id})`, saveFail: "Não salvou",
    stageL: "Etapa", nextL: "Próximo toque", clear: "limpar",
    stages: { abordado: "Abordado", conversa: "Conversa", demo: "Demo", proposta: "Proposta", fechado: "Fechado", perdido: "Perdido" },
    addFunil: "➕ Colocar no funil", adding: "Colocando…", inFunil: "No funil",
    lastUpdate: "Última atualização", summary: "O que ele falou",
    pitchT: "O pitch deste negócio", aUpgrade: "🚀 Mandar o Website Upgrade", upSending: "Enviando…", upOk: "Enviado ✓", upErr: "não saiu — confira o e-mail", aCall: "📞 Ligar", aWa: "💬 WhatsApp", aMail: "✉️ E-mail", aReport: "📄 Relatório", aCopy: "📋 Copiar link", copied: "Copiado ✓", aNoWay: "Sem telefone nem e-mail — peça na ligação", aMeasure: "🩻 Medir no X-Ray", fones: "📞 Completar telefone + e-mail", perto: "📍 Mais perto de mim", pertoOn: "📍 Por distância", geoNegado: "você não permitiu a localização — a fila fica na ordem de chegada", geoIndisp: "este aparelho não tem localização", semLocal: "sem local conhecido", aGmail: "📧 Gmail", aCopiarMail: "📋 Copiar o e-mail", aCopiadoMail: "Copiado ✓", aQuote: "🧾 Orçamento", aContract: "📄 Contrato", logMail: "e-mail enviado · prometido $50 de crédito no 1º mês",
    waMsg: (n, b) => `Oi ${n || ""}! Aqui é da Guileo${b ? ` — sobre o ${b}` : ""}. Você chamou a gente sobre a recepcionista de IA que atende toda ligação e agenda por você. Tem 2 minutinhos?`,
    mailSubj: (b) => `${b || "Seu negócio"} — medi o que os seus vizinhos publicam`,
    mailHi: (n) => `Oi ${n || ""},`,
    mailIntro: "Sou da Guileo, aqui da região. Antes de escrever, medi o seu negócio do jeito que um cliente vê — perfil no Google, horário, site — e comparei com os negócios da sua volta. Nada privado, tudo dado público:",
    mailScore: (s) => `• Score geral: ${s}/100`,
    mailFicha: (r, c) => `• Seu perfil no Google: ${r}★${c != null ? ` · ${c} avaliações` : ""}`,
    mailHood: (m, n) => `• Os negócios da sua volta: ${m} avaliações (mediana de ${n} por perto)`,
    mailLink: "O relatório completo, com o que eu arrumaria primeiro:",
    mailEnd: "Duas coisas, sem compromisso: o relatório acima é seu de qualquer jeito. E se a gente trabalhar junto, eu ponho $50 de crédito no seu primeiro mês — é a minha forma de pagar as primeiras ligações que a Gui atender por você.\n\nVale dois minutos no telefone? Me responde com um horário que eu ligo.",
  },
  es: {
    title: "📥 Leads", sub: "Cada lead que llegó y cada objetivo que agregaste — una sola fila, el más nuevo primero. Abre uno y el expediente completo está aquí: sus números medidos, qué decir, y la etapa.",
    refresh: "↻ Actualizar", loading: "Cargando tu fila…",
    kTotal: "En la fila", k24h: "Últimas 24h", kFunil: "En el embudo", kSoltos: "Sin contacto",
    errInboxT: "No pude leer los leads que llegaron", errFunilT: "No pude leer tu embudo",
    errTeamT: "El embudo exige tu código PERSONAL",
    errTeamP: "Entraste con el código de equipo, y no puede abrir el embudo privado de otro vendedor. Pídele a Luis tu código personal y vuelve a entrar.",
    errSessT: "Tu sesión expiró", errSessP: "Sal y entra de nuevo para cargar la fila.",
    soLocalT: "Guardado solo en ESTE navegador",
    soLocalP: "Entraste con el código de equipo (compartido), así que el servidor no guarda tu tablero. Pide tu código personal a Luis — si no, este trabajo se pierde al cambiar de dispositivo.",
    errNet: "Error de red — no se pudo hablar con el servidor.",
    reason: "Motivo", retry: "Intentar de nuevo",
    emptyT: "Nada en tu fila.", emptyP: "Ningún lead atribuido a tu enlace en los últimos 12 meses. Un lead solo cae aquí cuando llega por un enlace con tu ?ref= — sin eso queda sin dueño en el admin.",
    filterAll: "Todos", filterNew: "Recién llegado",
    now: "ahora mismo", minAgo: (n) => `hace ${n} min`, hAgo: (n) => `hace ${n}h`, dAgo: (n) => `hace ${n}d`,
    uAgora: "Llama ya", uHoje: "Aún caliente", uDia: "Hoy", uAntigo: "Enfriándose", uSemData: "Sin hora de llegada",
    arrived: "Llegó", channel: "Canal", unknown: "no informado",
    open: "Abrir", close: "Cerrar", next: "Próximo lead →", queueEnd: "Ese era el último de la fila.",
    dorT: "Lo que medimos", score: "Score general", notMeasured: "no medido",
    ficha: "Ficha de Google", fichaNota: "calificación", fichaAv: (n) => `${n} reseñas`,
    hood: "Mediana del vecindario", hoodOf: (n) => `${n} negocios alrededor`,
    loadingAval: "Leyendo el informe medido…", avalErr: "No pude leer el informe de este lead",
    sacadaT: "Di esto", sacadaP: "Una falla medida, una pierna. Di el número, luego la línea.",
    legs: {
      brain: "Contesta cada llamada",
      ad: "Trae reseñas y tráfico",
      build: "Vende y cobra online",
    },
    vidaT: "La vida de este lead", noteL: "Notas", notePh: "¿Qué pasó? ¿Cuál es el próximo paso?",
    save: "Guardar", saving: "Guardando…", savedId: (id) => `Guardado ✓ (#${id})`, saveFail: "No se guardó",
    stageL: "Etapa", nextL: "Próximo toque", clear: "limpiar",
    stages: { abordado: "Abordado", conversa: "Conversación", demo: "Demo", proposta: "Propuesta", fechado: "Cerrado", perdido: "Perdido" },
    addFunil: "➕ Poner en el embudo", adding: "Agregando…", inFunil: "En el embudo",
    lastUpdate: "Última actualización", summary: "Lo que dijo",
    pitchT: "El pitch de este negocio", aUpgrade: "🚀 Enviar el Website Upgrade", upSending: "Enviando…", upOk: "Enviado ✓", upErr: "no salió — revisa el correo", aCall: "📞 Llamar", aWa: "💬 WhatsApp", aMail: "✉️ Correo", aReport: "📄 Informe", aCopy: "📋 Copiar enlace", copied: "Copiado ✓", aNoWay: "Sin teléfono ni correo — pídelo en la llamada", aMeasure: "🩻 Medir con X-Ray", fones: "📞 Completar teléfono + correo", perto: "📍 Más cerca de mí", pertoOn: "📍 Por distancia", geoNegado: "no permitiste la ubicación — la fila queda en orden de llegada", geoIndisp: "este equipo no tiene ubicación", semLocal: "sin ubicación conocida", aGmail: "📧 Gmail", aCopiarMail: "📋 Copiar el correo", aCopiadoMail: "Copiado ✓", aQuote: "🧾 Presupuesto", aContract: "📄 Contrato", logMail: "correo enviado · prometido $50 de crédito en el 1er mes",
    waMsg: (n, b) => `¡Hola ${n || ""}! Somos de Guileo${b ? ` — sobre ${b}` : ""}. Nos escribiste por la recepcionista de IA que contesta cada llamada y agenda por ti. ¿Tienes 2 minutos?`,
    mailSubj: (b) => `${b || "Tu negocio"} — medí lo que publican tus vecinos`,
    mailHi: (n) => `Hola ${n || ""},`,
    mailIntro: "Soy de Guileo, aquí de la zona. Antes de escribir medí tu negocio como lo ve un cliente — perfil de Google, horarios, sitio — y lo comparé con los negocios de tu alrededor. Nada privado, todo dato público:",
    mailScore: (s) => `• Score general: ${s}/100`,
    mailFicha: (r, c) => `• Tu perfil de Google: ${r}★${c != null ? ` · ${c} reseñas` : ""}`,
    mailHood: (m, n) => `• Los negocios de tu alrededor: ${m} reseñas (mediana de ${n} cerca)`,
    mailLink: "El informe completo, con lo que yo arreglaría primero:",
    mailEnd: "Dos cosas, sin compromiso: el informe de arriba es tuyo igual. Y si trabajamos juntos, pongo $50 de crédito en tu primer mes — es mi forma de pagar las primeras llamadas que Gui conteste por ti.\n\n¿Vale dos minutos por teléfono? Respóndeme con un horario y te llamo.",
  },
  hi: {
    title: "📥 लीड्स", sub: "हर लीड जो आई और हर लक्ष्य जो आपने जोड़ा — एक ही कतार, सबसे नया पहले। एक खोलिए और पूरा डोज़ियर यहीं है: उसके मापे गए आँकड़े, क्या कहना है, और स्टेज।",
    refresh: "↻ रिफ्रेश", loading: "आपकी कतार लोड हो रही है…",
    kTotal: "कतार में", k24h: "पिछले 24 घंटे", kFunil: "फ़नल में", kSoltos: "बिना संपर्क",
    errInboxT: "आई हुई लीड्स पढ़ी नहीं जा सकीं", errFunilT: "आपका फ़नल पढ़ा नहीं जा सका",
    errTeamT: "फ़नल के लिए आपका निजी कोड चाहिए",
    errTeamP: "आपने टीम कोड से लॉगिन किया है, जो किसी और सेलर का निजी फ़नल नहीं खोल सकता। Luis से अपना निजी कोड लेकर दोबारा लॉगिन करें।",
    errSessT: "आपका सेशन समाप्त हो गया", errSessP: "लॉगआउट करके दोबारा लॉगिन करें।",
    soLocalT: "सिर्फ़ इसी ब्राउज़र में सेव",
    soLocalP: "आपने साझा टीम कोड से लॉगिन किया है, इसलिए सर्वर आपका बोर्ड नहीं रखता। Luis से अपना निजी कोड माँगें — वरना डिवाइस बदलते ही यह काम खो जाएगा।",
    errNet: "नेटवर्क त्रुटि — सर्वर से बात नहीं हो सकी।",
    reason: "कारण", retry: "दोबारा कोशिश करें",
    emptyT: "आपकी कतार खाली है।", emptyP: "पिछले 12 महीनों में आपके लिंक से कोई लीड नहीं आई। लीड यहाँ तभी आती है जब वह आपके ?ref= वाले लिंक से आए — वरना वह बिना मालिक के admin में रह जाती है।",
    filterAll: "सभी", filterNew: "अभी-अभी आई",
    now: "अभी", minAgo: (n) => `${n} मिनट पहले`, hAgo: (n) => `${n} घंटे पहले`, dAgo: (n) => `${n} दिन पहले`,
    uAgora: "अभी कॉल करें", uHoje: "अब भी गर्म", uDia: "आज", uAntigo: "ठंडी हो रही", uSemData: "आने का समय नहीं",
    arrived: "आई", channel: "चैनल", unknown: "जानकारी नहीं",
    open: "खोलें", close: "बंद करें", next: "अगली लीड →", queueEnd: "यह कतार की आख़िरी थी।",
    dorT: "हमने क्या मापा", score: "कुल स्कोर", notMeasured: "मापा नहीं गया",
    ficha: "Google प्रोफ़ाइल", fichaNota: "रेटिंग", fichaAv: (n) => `${n} रिव्यू`,
    hood: "पड़ोस का माध्य", hoodOf: (n) => `आसपास ${n} व्यवसाय`,
    loadingAval: "मापी गई रिपोर्ट पढ़ी जा रही है…", avalErr: "इस लीड की रिपोर्ट पढ़ी नहीं जा सकी",
    sacadaT: "यह कहिए", sacadaP: "एक मापी गई कमी, एक स्तंभ। पहले नंबर, फिर लाइन।",
    legs: {
      brain: "हर कॉल उठाती है",
      ad: "रिव्यू और ट्रैफ़िक लाता है",
      build: "ऑनलाइन बेचता और वसूलता है",
    },
    vidaT: "इस लीड की ज़िंदगी", noteL: "नोट्स", notePh: "क्या हुआ? अगला कदम क्या है?",
    save: "सेव करें", saving: "सेव हो रहा…", savedId: (id) => `सेव हुआ ✓ (#${id})`, saveFail: "सेव नहीं हुआ",
    stageL: "स्टेज", nextL: "अगला टच", clear: "साफ़ करें",
    stages: { abordado: "संपर्क किया", conversa: "बातचीत", demo: "डेमो", proposta: "प्रस्ताव", fechado: "बंद", perdido: "खोया" },
    addFunil: "➕ फ़नल में डालें", adding: "जोड़ा जा रहा…", inFunil: "फ़नल में",
    lastUpdate: "अंतिम अपडेट", summary: "उसने क्या कहा",
    pitchT: "इस व्यवसाय का पिच", aUpgrade: "🚀 Website Upgrade भेजें", upSending: "भेजा जा रहा…", upOk: "भेजा ✓", upErr: "नहीं गया — ईमेल जाँचें", aCall: "📞 कॉल", aWa: "💬 WhatsApp", aMail: "✉️ ईमेल", aReport: "📄 रिपोर्ट", aCopy: "📋 लिंक कॉपी", copied: "कॉपी ✓", aNoWay: "फ़ोन या ईमेल नहीं — कॉल पर माँगें", aMeasure: "🩻 X-Ray से मापें", fones: "📞 फ़ोन + ईमेल भरें", perto: "📍 मेरे पास", pertoOn: "📍 दूरी से", geoNegado: "आपने स्थान की अनुमति नहीं दी — सूची आगमन क्रम में रहेगी", geoIndisp: "इस डिवाइस में स्थान नहीं है", semLocal: "स्थान अज्ञात", aGmail: "📧 Gmail", aCopiarMail: "📋 ईमेल कॉपी करें", aCopiadoMail: "कॉपी ✓", aQuote: "🧾 कोटेशन", aContract: "📄 अनुबंध", logMail: "ईमेल भेजा · पहले महीने $50 क्रेडिट का वादा",
    waMsg: (n, b) => `Hi ${n || "there"}! This is Guileo${b ? ` — about ${b}` : ""}. You reached out about the AI receptionist that answers every call and books for you. Do you have 2 minutes?`,
    mailSubj: (b) => `${b || "आपका व्यवसाय"} — मैंने मापा कि आपके पड़ोसी क्या दिखाते हैं`,
    mailHi: (n) => `Hi ${n || "there"},`,
    mailIntro: "मैं Guileo से हूँ, इसी इलाक़े का। लिखने से पहले मैंने आपके व्यवसाय को वैसे मापा जैसे ग्राहक देखता है — Google प्रोफ़ाइल, समय, साइट — और आस-पास के व्यवसायों से तुलना की। कुछ भी निजी नहीं, सब सार्वजनिक डेटा:",
    mailScore: (s) => `• Overall score: ${s}/100`,
    mailFicha: (r, c) => `• आपकी Google प्रोफ़ाइल: ${r}★${c != null ? ` · ${c} समीक्षाएँ` : ""}`,
    mailHood: (m, n) => `• आस-पास के व्यवसाय: ${m} समीक्षाएँ (${n} में मध्यमान)`,
    mailLink: "पूरी रिपोर्ट, और मैं सबसे पहले क्या ठीक करता:",
    mailEnd: "दो बातें, बिना शर्त: ऊपर की रिपोर्ट वैसे भी आपकी है। और अगर हम साथ काम करें, तो मैं आपके पहले महीने में $50 क्रेडिट डालता हूँ — पहली कॉलों का खर्च मेरी तरफ़ से।\n\nदो मिनट फ़ोन पर? समय बताइए, मैं कॉल करता हूँ।",
  },
};
// RESERVA SEMPRE `en`, NUNCA `pt` — e sempre explícita. Chave ausente em JS devolve `undefined` e o
// React desenha NADA: neste repo isso já deixou um botão inteiro sem rótulo por semanas.
const dic = (lang) => D[lang] || D.en;

// ── normalizadores da DEDUPLICAÇÃO ────────────────────────────────────────────────────────────
// Um lead que CHEGOU e o mesmo negócio JÁ NO FUNIL não podem virar duas linhas: o vendedor ligaria
// duas vezes pra mesma pessoa (foi exatamente o defeito que matou a aba `nyc`). Cruzamos por três
// chaves, na ordem de confiança: telefone > e-mail > nome do negócio.
const soDigitos = (v) => String(v || "").replace(/[^0-9]/g, "");
// últimos 10 dígitos: "+1 (929) 535-0191" e "9295350191" são a MESMA linha. A lição da identidade
// de quem liga — telefone sem chave canônica parte uma pessoa em duas.
const chaveFone = (v) => { const d = soDigitos(v); return d.length >= 8 ? d.slice(-10) : ""; };
const chaveMail = (v) => String(v || "").trim().toLowerCase();
const chaveBiz = (v) => String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const ehEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
// A nota do prospect carrega "Site: https://..." desde a importação da fila. Ler dali é reaproveitar
// um dado que já está na mão — perguntar de novo ao Google seria pagar duas vezes pelo mesmo fato.
// 🚨 A LINHA "Site:", NUNCA "a primeira URL". A nota traz o RELATÓRIO antes do site
// ("Relatório: https://guileoai.com/apresentacao/…"), então pegar a primeira URL mandaria o motor
// procurar a Guileo no Google em vez do negócio do cliente — e voltaria um telefone que não é dele.
// Nome e número da mesma linha: aqui, o site tem que vir da linha que diz que é o site.
// O id da avaliação mora no link do relatório: /apresentacao/<uuid>. Ancorado no caminho, não em
// "qualquer uuid do texto" — uuid solto numa nota pode ser outra coisa, e ligar o lead à medição
// ERRADA seria pior que não ligar: o vendedor abriria a dor de outro negócio.
const avalIdDaNota = (nota) => {
  const m = String(nota || "").match(/\/apresentacao\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return m ? m[1] : null;
};
// Cada linha "• 20/08 15:40 — texto" vira um tópico. Linha sem data (nota antiga, escrita antes
// deste formato) NÃO é descartada: entra sem carimbo, porque perder histórico é pior que exibi-lo
// sem data. O mais novo em cima — a última coisa dita é a que muda a próxima ligação.
const linhasDaNota = (nota) => String(nota || "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
  const m = l.match(/^[•·-]\s*(\d{1,2}\/\d{1,2}(?:\s+\d{1,2}:\d{2})?)\s*[—–-]\s*(.+)$/);
  return m ? { data: m[1], texto: m[2] } : { data: "", texto: l.replace(/^[•·-]\s*/, "") };
});

// ANEXA, nunca substitui. O carimbo é curto de propósito (dia/mês hora): o ano polui a leitura
// numa lista que o vendedor varre em segundos antes de discar.
const anexaApontamento = (notaAtual, texto, locale) => {
  const t2 = String(texto || "").trim();
  if (!t2) return String(notaAtual || "");
  const d = new Date();
  const carimbo = `${d.toLocaleDateString(locale || "pt-BR", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString(locale || "pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  const linha = `• ${carimbo} — ${t2.replace(/\n+/g, " ")}`;
  const antigo = String(notaAtual || "").trim();
  return antigo ? `${linha}\n${antigo}` : linha;
};

// Distância em linha reta (Haversine). Não é a distância de CARRO — e é honesto que não seja:
// para ordenar uma rota a pé/de carro num bairro, a linha reta acerta a vizinhança e não custa
// uma chamada paga de rotas a cada lead. O número aparece arredondado, sem falsa precisão.
const kmEntre = (a, b) => {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

const siteDaNota = (nota) => {
  const m = String(nota || "").match(/^\s*Site:\s*(https?:\/\/\S+)/mi);
  return m ? m[1].slice(0, 300) : "";
};

const msTs = (v) => { if (!v) return null; const t = Date.parse(v); return Number.isNaN(t) ? null : t; };

// mediana das avaliações da vizinhança. PISO DE 3: sem amostra que sustente não existe mediana
// honesta — a mesma regra da aba de prospecção. Abaixo disso devolve null e o bloco não desenha.
const medianaVizinhanca = (concorrentes) => {
  const ns = (Array.isArray(concorrentes) ? concorrentes : [])
    .map((c) => (typeof c?.avaliacoes === "number" ? c.avaliacoes : null))
    .filter((n) => n != null)
    .sort((a, b) => a - b);
  if (ns.length < 3) return null;
  const m = Math.floor(ns.length / 2);
  return { valor: ns.length % 2 ? ns[m] : Math.round((ns[m - 1] + ns[m]) / 2), amostra: ns.length };
};

// ═══════════════════════════════════════════════════════════════════════════════════════════════
export default function SellerLeads({ lang = "pt", seller, market = "us", nav, handoff }) {
  const t = dic(lang);
  const locale = LOCALE[lang] || LOCALE.en;

  // Duas fontes, DOIS estados independentes. Juntar os dois num só faria a falha de uma apagar a
  // outra — e a tela mentiria por omissão sobre metade da fila.
  const [inbox, setInbox] = useState({ estado: "loading" });  // {estado:'loading'|'ok'|'err', rows, contagens, motivo, tipo}
  // 🚨 ESTE BLOCO ESTAVA NO COMPONENTE ERRADO (consertado 2026-08-22).
  // `meuLocal`/`geoEstado`/`pedirLocal` viviam dentro de `PaginaDoLead` e eram usados aqui,
  // em `SellerLeads` — dois componentes diferentes. Resultado: `ReferenceError: meuLocal is
  // not defined` e o HUB DO VENDEDOR INTEIRO caindo em "Opa, algo saiu do trilho" para quem
  // tinha sessão. Quem não estava logado via a tela de entrada e não percebia nada — por isso
  // passou. Estado mora no componente que o usa.
  // bairro, volta, atravessa de novo. Ordenar por distância é a diferença entre 6 visitas e 12
  // no mesmo dia.
  // 🚨 A LOCALIZAÇÃO É PEDIDA, NUNCA TOMADA. Só quando ele aperta o botão, e o navegador mostra
  // o próprio pedido. Negar não quebra nada: a fila volta à ordem de sempre, com o motivo dito.
  const [meuLocal, setMeuLocal] = useState(null);      // {lat,lng}
  const [geoEstado, setGeoEstado] = useState("idle");  // idle | pedindo | ok | negado | indisponivel
  const pedirLocal = () => {
    if (!navigator.geolocation) { setGeoEstado("indisponivel"); return; }
    setGeoEstado("pedindo");
    navigator.geolocation.getCurrentPosition(
      (p) => { setMeuLocal({ lat: p.coords.latitude, lng: p.coords.longitude }); setGeoEstado("ok"); },
      () => setGeoEstado("negado"),
      { timeout: 10000, maximumAge: 300000 },
    );
  };
  const [funil, setFunil] = useState({ estado: "loading" });  // {estado:'loading'|'ok'|'err', rows, stats, motivo, tipo}
  const [filtro, setFiltro] = useState(null);                 // null=todos · 'novos' · etapa
  const [aberto, setAberto] = useState(null);                 // chave do dossiê aberto
  const [avals, setAvals] = useState({});                     // { [avaliacao_id]: {estado, dados, motivo} }
  const [agora, setAgora] = useState(() => Date.now());
  // comprovantes vivem NO PAI, por identidade natural — ver a nota do `idNatural` acima.
  const [recibos, setRecibos] = useState({});
  const abertoRef = useRef(null);

  // ── COMPLETAR TELEFONE (2026-08-20) ───────────────────────────────────────────────────────
  // A fila herdou negócios medidos ANTES de o telefone entrar na máscara do Google — reais,
  // ordenados pelo buraco, e sem como ligar. Uma fila sem telefone é uma lista de leitura.
  // Isto pergunta o contato ao Google e grava no prospect. A trava do xará mora no backend:
  // se o nome que voltou não for o mesmo, ele recusa — ficha errada é pior que ficha vazia.
  const [buscandoFone, setBuscandoFone] = useState(null); // null | {feitos, total, achados, recusados}
  const sidLocal = () => { try { return (JSON.parse(localStorage.getItem("guileo_seller") || "null") || {}).sid || ""; } catch { return ""; } };

  // 🚨 `local:true` NÃO É SUCESSO (2026-08-25). /api/seller-leads responde {ok:true, local:true}
  // quando quem chamou entrou pelo CÓDIGO DE TIME: o servidor RECUSA gravar (decisão de segurança
  // correta — o código compartilhado aceita qualquer e-mail digitado), mas o `ok:true` fazia esta
  // tela comemorar em cima de um banco que não recebeu nada. O mesmo defeito que o SellerProspect
  // já tinha corrigido: um "ok" que ninguém confere é promessa sem lastro, e aqui custava o
  // pipeline inteiro na troca de aparelho. Toda resposta passa por aqui, então o aviso vale para
  // qualquer ação (list/save/inbound/upgrade) sem repetir a checagem em cada botão.
  const [soNesteNavegador, setSoNesteNavegador] = useState(false);
  const post = useCallback(async (url, body) => {
    const r = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, seller_email: seller?.email, seller_code: seller?.code || "", seller: { name: seller?.name, email: seller?.email, ref: seller?.ref } }),
    });
    const d = await r.json().catch(() => null);
    if (d && d.local === true) setSoNesteNavegador(true);
    return { r, d };
  }, [seller?.email, seller?.code, seller?.name, seller?.ref]);

  // ── ADAPTADOR DEFENSIVO ───────────────────────────────────────────────────────────────────
  // O endpoint da caixa de entrada está sendo escrito em paralelo. O contrato acordado fala em
  // `leads[]` com `ts/nome/contato/email/telefone/canal/resumo`; o que o backend já devolve hoje é
  // `rows[]` com `quando/nome/contato/contato_tipo/canal/resumo/negocio`. Os DOIS passam por aqui:
  // ler forma diferente NÃO pode quebrar a tela nem inventar dado. Campo que não veio fica null e
  // desenha "não informado" em cinza — nunca uma string vazia com cara de resposta.
  const normalizaInbound = (l) => {
    if (!l || typeof l !== "object") return null;
    const contato = l.contato ?? l.contact ?? "";
    // `telefone`/`email` explícitos vencem; senão o tipo declarado; senão a forma do próprio valor.
    const email = l.email || (l.contato_tipo === "email" ? contato : "") || (ehEmail(contato) ? contato : "");
    const telefone = l.telefone || l.phone || (l.contato_tipo === "telefone" ? contato : "") || (!ehEmail(contato) && chaveFone(contato) ? contato : "");
    return {
      idInbound: l.id ?? null,
      chegou: msTs(l.ts ?? l.quando ?? l.created_at ?? null),
      nome: l.nome || l.name || "",
      negocio: l.negocio || l.business || "",
      email: email || "",
      telefone: telefone || "",
      canal: l.canal || l.source || "",
      resumo: l.resumo || l.summary || "",
      setor: l.setor || "",
      avaliacaoId: l.avaliacao_id || l.avaliacaoId || null,
      noFunil: l.no_funil === true,
    };
  };

  const carregaInbox = useCallback(async () => {
    try {
      // 🚨 JANELA DE 365 DIAS, NÃO 30 (corrigido 2026-08-20, olhando o hub com dado real).
      // O padrão do endpoint é 30 dias. Os leads reais do Luis eram de 43 dias atrás: o backend
      // devolvia certo, a tela mostrava ZERO, e a frase dizia "nenhum lead AINDA" — o vendedor
      // conclui que nunca teve lead nenhum e para de abrir a aba. Lead velho não é lead que não
      // existe: é lead que ninguém trabalhou, que é exatamente o que esta tela existe para achar.
      const { r, d } = await post("/api/seller-leads", { action: "inbound", dias: 365 });
      if (r.status === 401) {
        // Dois 401 com soluções OPOSTAS. `team_code` = código pessoal faltando; qualquer outro =
        // sessão. Erro genérico faz o vendedor tentar a coisa errada e desistir.
        const tipo = d?.error === "team_code" ? "team" : "sessao";
        setInbox({ estado: "err", tipo, motivo: d?.motivo || d?.error || `HTTP 401` });
        return;
      }
      // 🚨 STATUS HTTP NÃO É RESPOSTA. Ler `r.ok` e ignorar o corpo já abriu buraco neste repo.
      if (!d || d.ok !== true) {
        setInbox({ estado: "err", tipo: "leitura", motivo: (d?.motivo || d?.error || `HTTP ${r.status}`).toString() });
        return;
      }
      const brutos = Array.isArray(d.leads) ? d.leads : Array.isArray(d.rows) ? d.rows : null;
      if (!brutos) { setInbox({ estado: "err", tipo: "leitura", motivo: "resposta sem lista de leads" }); return; }
      setInbox({ estado: "ok", rows: brutos.map(normalizaInbound).filter(Boolean), contagens: (d.contagens && typeof d.contagens === "object") ? d.contagens : null });
    } catch (e) {
      setInbox({ estado: "err", tipo: "rede", motivo: String(e).slice(0, 160) });
    }
  }, [post]);

  const carregaFunil = useCallback(async () => {
    try {
      const { r, d } = await post("/api/seller-prospects", { action: "list" });
      if (r.status === 401) {
        setFunil({ estado: "err", tipo: d?.error === "team_code" ? "team" : "sessao", motivo: d?.error || "HTTP 401" });
        return;
      }
      if (!d || d.ok !== true || !Array.isArray(d.rows)) {
        setFunil({ estado: "err", tipo: "leitura", motivo: (d?.motivo || d?.error || `HTTP ${r.status}`).toString() });
        return;
      }
      setFunil({ estado: "ok", rows: d.rows, stats: d.stats && typeof d.stats === "object" ? d.stats : {} });
    } catch (e) {
      setFunil({ estado: "err", tipo: "rede", motivo: String(e).slice(0, 160) });
    }
  }, [post]);

  const recarrega = useCallback(() => { carregaInbox(); carregaFunil(); }, [carregaInbox, carregaFunil]);


  useEffect(() => {
    if (!seller?.email) return;
    recarrega();
    const iv = setInterval(recarrega, 60000);
    const onFocus = () => recarrega();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(iv); window.removeEventListener("focus", onFocus); };
  }, [seller?.email, recarrega]);

  // o cronômetro é o herói: ele PRECISA andar sozinho. 30s é o passo mais grosso que ainda deixa
  // "há 3 min" virar "há 4 min" sem o vendedor duvidar do relógio.
  useEffect(() => { const iv = setInterval(() => setAgora(Date.now()), 30000); return () => clearInterval(iv); }, []);

  // handoff: outra aba pode mandar um negócio pra cá (nav("leads", {business})) — a fila abre já
  // filtrada nele. Consumido uma vez, na montagem.
  const [busca, setBusca] = useState(() => (handoff?.business || "").toString());

  // ── A FILA UNIFICADA ───────────────────────────────────────────────────────────────────────
  const fila = useMemo(() => {
    const prospects = funil.estado === "ok" ? funil.rows : [];
    const entradas = inbox.estado === "ok" ? inbox.rows : [];

    // índice do funil pelas três chaves
    const porFone = new Map(), porMail = new Map(), porBiz = new Map();
    const itens = prospects.map((p) => {
      const item = {
        chave: `p:${p.id}`,
        // 🧾 IDENTIDADE QUE SOBREVIVE À TRANSIÇÃO. Quando um lead da caixa de entrada entra no funil
        // ele deixa de ser `i:…` e vira `p:<uuid>` — o React desmonta o card e remonta outro, e o
        // COMPROVANTE do salvamento morria junto, no exato instante em que ele importa. A chave
        // natural (telefone > e-mail > nome) é a mesma da deduplicação e atravessa a mudança.
        idNatural: chaveFone(p.phone) || chaveMail(p.email) || chaveBiz(p.business) || `p:${p.id}`,
        prospectId: p.id,
        negocio: p.business || "",
        nome: p.contact_name || "",
        telefone: p.phone || "",
        email: p.email || "",
        /* ⚠️ "não informado" ao lado de um botão de LIGAR que funciona foi o defeito nº1 da
           auditoria do hub (Luis 26/08: «o hub tá falando coisa»). Este campo é o CANAL de
           chegada — prospect não chega por canal, foi você que adicionou. Dizer isso é honesto;
           "não informado" faz o vendedor achar que a ficha está vazia e pular o lead pronto. */
        canal: (p.note || "").includes("PRONTO:") ? t.canalPronto : t.canalAlvo,
        previewSite: ((p.note || "").match(/site (https:\/\/guileoai\.com\/novo\/[a-z0-9-]+)/) || [])[1] || "",
        resumo: "",
        // 🚨 O FIO QUE LIGA O LEAD À MEDIÇÃO (2026-08-20). Isto era `null` fixo — e `avaliacaoId`
        // é a chave de CINCO blocos do dossiê: a dor medida, os 3 Guileos (Brain·AD·Build) daquele
        // negócio, o botão do relatório, o copiar-link e o corpo do e-mail com os números. Um campo
        // vazio derrubava a metade que convence, e a tela parecia "esvaziada" sem nada ter sido
        // removido. O prospect carrega o link do relatório na nota desde a importação: o id está
        // ali, escrito. Ler dali é reconectar o que já existe — não inventar dado.
        avaliacaoId: avalIdDaNota(p.note),
        // ONDE FICA — é o que transforma a fila numa ROTA. `null` = não sei onde fica, e isso
        // manda o prospect para o FIM da lista com o motivo dito, nunca para o começo.
        lat: typeof p.lat === "number" ? p.lat : null,
        lng: typeof p.lng === "number" ? p.lng : null,
        stage: p.stage || STAGES[0],
        note: p.note || "",
        nextAt: p.next_at || "",
        market: p.market || market,
        chegou: msTs(p.created_at),
        atualizado: msTs(p.updated_at),
        noFunil: true,
      };
      const kf = chaveFone(p.phone); if (kf && !porFone.has(kf)) porFone.set(kf, item);
      const km = chaveMail(p.email); if (km && !porMail.has(km)) porMail.set(km, item);
      const kb = chaveBiz(p.business); if (kb && !porBiz.has(kb)) porBiz.set(kb, item);
      return item;
    });

    for (const e of entradas) {
      const alvo = porFone.get(chaveFone(e.telefone)) || porMail.get(chaveMail(e.email)) || porBiz.get(chaveBiz(e.negocio || e.nome));
      if (alvo) {
        // MESMA PESSOA, duas fontes: o funil manda na etapa/nota (é o que o vendedor escreveu), a
        // caixa de entrada manda no relógio, no canal e no que ele falou (é o que o lead trouxe).
        alvo.chegou = alvo.chegou == null ? e.chegou : (e.chegou != null ? Math.max(alvo.chegou, e.chegou) : alvo.chegou);
        alvo.canal = alvo.canal || e.canal;
        alvo.resumo = alvo.resumo || e.resumo;
        alvo.avaliacaoId = alvo.avaliacaoId || e.avaliacaoId;
        alvo.telefone = alvo.telefone || e.telefone;
        alvo.email = alvo.email || e.email;
        alvo.nome = alvo.nome || e.nome;
        continue;
      }
      itens.push({
        chave: `i:${e.idInbound ?? `${chaveFone(e.telefone) || chaveMail(e.email) || chaveBiz(e.negocio)}-${e.chegou ?? "s"}`}`,
        idNatural: chaveFone(e.telefone) || chaveMail(e.email) || chaveBiz(e.negocio) || `i:${e.idInbound ?? e.chegou ?? "s"}`,
        prospectId: null,
        negocio: e.negocio || "",
        nome: e.nome || "",
        telefone: e.telefone || "",
        email: e.email || "",
        canal: e.canal || "",
        resumo: e.resumo || "",
        avaliacaoId: e.avaliacaoId || null,
        stage: null, note: "", nextAt: "",
        market,
        chegou: e.chegou,
        atualizado: e.chegou,
        noFunil: false,
      });
    }

    // ⏱️ ORDEM = RECÊNCIA. Sem "score", sem probabilidade, sem heurística de prioridade: só existe
    // evidência forte para o TEMPO. Quem não tem hora de chegada vai para o fim (não some).
    // ── A ORDEM: rota quando ele pediu, chegada quando não ────────────────────────────────
    // 🚨 SEM COORDENADA VAI PARA O FIM, NUNCA PARA O COMEÇO. `null` é "não sei onde fica", e um
    // desconhecido no topo da rota faz o vendedor atravessar o bairro atrás de um endereço que
    // ninguém mediu. Ausência não compete com medição — a mesma regra do buraco na fila de ataque.
    if (meuLocal) {
      for (const it of itens) it.distanciaKm = (it.lat != null && it.lng != null) ? kmEntre(meuLocal, it) : null;
      itens.sort((a, b) => (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity));
    } else {
      itens.sort((a, b) => (b.chegou ?? -Infinity) - (a.chegou ?? -Infinity));
    }
    return itens;
  }, [inbox, funil, market, meuLocal, t.canalAlvo, t.canalPronto]);

  const visiveis = useMemo(() => {
    let l = fila;
    if (filtro === "novos") l = l.filter((x) => !x.noFunil);
    else if (filtro) l = l.filter((x) => x.stage === filtro);
    const q = busca.trim().toLowerCase();
    if (q) {
      /* ⚠️ O TELEFONE CASA POR DÍGITO. O lead está gravado "+12122548174" e o vendedor digita
         "(212) 254-8174" ou "212 254" — comparar as strings cruas não acha NADA e a tela parece
         vazia de leads em vez de vazia de resultado. Mesma lição da chave canônica de telefone.
         E o palheiro inclui SITE e NOTA: é por "threedegreesnyc.com" que ele lembra do lead. */
      const dig = q.replace(/\D/g, "");
      l = l.filter((x) => {
        const texto = `${x.negocio} ${x.nome} ${x.email} ${x.telefone} ${x.previewSite || ""} ${x.note || ""} ${x.canal || ""}`.toLowerCase();
        if (texto.includes(q)) return true;
        return dig.length >= 3 && `${x.telefone || ""}`.replace(/\D/g, "").includes(dig);
      });
    }
    return l;
  }, [fila, filtro, busca]);

  // ── A TELA AVANÇA SOZINHA (padrão HubSpot Sales Workspace) ─────────────────────────────────
  // Depois de AGIR (mudou etapa, salvou nota, entrou no funil) o dossiê fecha e o PRÓXIMO abre.
  // A lista continua existindo para ESCOLHER — mas trabalhar é seguir a fila.
  // Percorre a fila e completa quem está sem telefone. Sequencial de propósito: cada busca é uma
  // chamada PAGA ao Google, e disparar 30 de uma vez é conta alta e risco de limite.

  const avancar = useCallback((chaveAtual) => {
    const i = visiveis.findIndex((x) => x.chave === chaveAtual);
    const prox = i >= 0 ? visiveis[i + 1] : null;
    setAberto(prox ? prox.chave : "__fim__");
    abertoRef.current = prox ? prox.chave : null;
  }, [visiveis]);

  // ── a avaliação de um lead (camada 2) — buscada só quando o dossiê abre ────────────────────
  const carregaAval = useCallback(async (id) => {
    if (!id) return;
    setAvals((s) => (s[id] ? s : { ...s, [id]: { estado: "busy" } }));
    try {
      const r = await fetch(`/api/avaliacao?id=${encodeURIComponent(id)}`);
      const d = await r.json().catch(() => null);
      if (!d || d.ok !== true || !d.avaliacao) {
        setAvals((s) => ({ ...s, [id]: { estado: "err", motivo: (d?.error || d?.motivo || `HTTP ${r.status}`).toString() } }));
        return;
      }
      setAvals((s) => ({ ...s, [id]: { estado: "ok", dados: d.avaliacao } }));
    } catch (e) {
      setAvals((s) => ({ ...s, [id]: { estado: "err", motivo: String(e).slice(0, 140) } }));
    }
  }, []);

  const abrir = (item) => {
    const nova = aberto === item.chave ? null : item.chave;
    setAberto(nova);
    abertoRef.current = nova;
    if (nova && item.avaliacaoId && !avals[item.avaliacaoId]) carregaAval(item.avaliacaoId);
  };

  // ── ESCRITA COM COMPROVANTE ────────────────────────────────────────────────────────────────
  // Só devolve sucesso depois de ler `ok:true` **com o `id` da linha**. `r.ok` do fetch é só "o
  // servidor respondeu" — o repo já teve confete disparando antes de qualquer confirmação.
  const salvar = useCallback(async (item, patch) => {
    const corpo = {
      id: item.prospectId || "",
      business: item.negocio || item.nome || "",
      contact_name: item.nome || "",
      phone: item.telefone || "",
      email: item.email || "",
      stage: item.stage || STAGES[0],
      note: item.note || "",
      next_at: item.nextAt || "",
      market: item.market || market,
      ...patch,
    };
    try {
      const { r, d } = await post("/api/seller-prospects", { action: "upsert", prospect: corpo });
      if (r.status === 401) return { ok: false, motivo: d?.error === "team_code" ? t.errTeamT : t.errSessT };
      const id = d?.prospect?.id || d?.id || null;
      if (d?.ok !== true || !id) return { ok: false, motivo: (d?.motivo || d?.error || `HTTP ${r.status}`).toString() };
      await carregaFunil();
      return { ok: true, id: String(id) };
    } catch (e) {
      return { ok: false, motivo: String(e).slice(0, 140) };
    }
  }, [post, market, carregaFunil, t.errTeamT, t.errSessT]);

  const completarTelefones = useCallback(async (alvos) => {
    const semFone = alvos.filter((x) => (!x.telefone || !x.email) && x.prospectId && (x.negocio || x.nome));
    if (!semFone.length) return;
    setBuscandoFone({ feitos: 0, total: semFone.length, achados: 0, recusados: 0 });
    const sid = sidLocal();
    let achados = 0, recusados = 0;
    for (let i = 0; i < semFone.length; i++) {
      const it = semFone[i];
      try {
        const r = await fetch("/api/prospeccao", {
          method: "POST", headers: { "Content-Type": "application/json" },
          // O SITE VAI JUNTO quando a nota o carrega: o backend tenta o DOMÍNIO primeiro, que é
          // fato, e só cai no nome depois. Foi o nome-título-de-SEO que fez 10 recusas legítimas.
          body: JSON.stringify({ acao: "contato", nome: it.negocio || it.nome, site: siteDaNota(it.note), local: "New York, NY", sid }),
        });
        const d = await r.json().catch(() => ({}));
        // 🚨 O ESTÁGIO VAI EXPLÍCITO. `salvar` faz `item.stage || STAGES[0]`, e STAGES[0] é
        // "abordado" — então preencher um telefone marcava 18 leads como JÁ ABORDADOS.
        // Funil que mente sobre quem já foi chamado é pior que funil vazio: o vendedor pula
        // justamente quem nunca ouviu falar da gente. Completar contato NÃO é ter falado.
        // Telefone E e-mail: o e-mail é o que faz o MODELO DE E-MAIL pronto aparecer no dossiê.
        // Grava o que veio — se só o telefone voltou, grava só ele. Nunca apaga o que já existia.
        if (d?.ok && (d.telefone || d.email)) {
          const patch = { stage: it.stage || "" };
          if (d.telefone) patch.phone = d.telefone;
          if (d.email) patch.email = d.email;
          await salvar(it, patch); achados++;
        } else recusados++;
      } catch { recusados++; }
      setBuscandoFone({ feitos: i + 1, total: semFone.length, achados, recusados });
    }
    await carregaFunil();
    setTimeout(() => setBuscandoFone(null), 4000);
  }, [salvar, carregaFunil]); // eslint-disable-line react-hooks/exhaustive-deps

  const carregando = inbox.estado === "loading" && funil.estado === "loading";
  const tudoFalhou = inbox.estado === "err" && funil.estado === "err";
  const vazioDeVerdade = inbox.estado === "ok" && funil.estado === "ok" && fila.length === 0;
  const c = inbox.estado === "ok" ? inbox.contagens : null;
  const mesmaCulpa = (inbox.estado === "err" && funil.estado === "err" && inbox.tipo === funil.tipo
    && (inbox.tipo === "team" || inbox.tipo === "sessao")) ? inbox.tipo : null;

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-extrabold text-g-word">{t.title}</div>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-g-muted">{t.sub}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* 📞 COMPLETAR TELEFONES — só aparece quando existe alguém sem telefone na fila.
              Botão que não tem trabalho pra fazer é ruído; ele some sozinho quando acaba. */}
          {fila.some((x) => (!x.telefone || !x.email) && x.prospectId) && (
            <button type="button" disabled={!!buscandoFone} onClick={() => completarTelefones(fila)}
              className="inline-flex min-h-[48px] items-center rounded-full bg-g-green/15 px-4 text-[12.5px] font-bold text-g-green ring-1 ring-g-green/40 hover:bg-g-green/25 disabled:opacity-60">
              {buscandoFone ? `${buscandoFone.feitos}/${buscandoFone.total} · ${buscandoFone.achados} ✓` : t.fones}
            </button>
          )}
          {/* 📍 A ROTA. A localização é PEDIDA, nunca tomada: só quando ele aperta, e o próprio
              navegador mostra o pedido. Negar não quebra nada — a fila volta à ordem de chegada. */}
          <button type="button" onClick={pedirLocal} disabled={geoEstado === "pedindo"}
            className={`inline-flex min-h-[48px] items-center rounded-full px-4 text-[12.5px] font-bold ring-1 transition ${
              meuLocal ? "bg-g-green/15 text-g-green ring-g-green/40" : "bg-white/[0.04] text-g-muted ring-white/15 hover:text-g-word"}`}>
            {geoEstado === "pedindo" ? "…" : meuLocal ? t.pertoOn : t.perto}
          </button>
          <button type="button" onClick={recarrega}
            className="inline-flex min-h-[48px] shrink-0 items-center rounded-full border border-white/15 px-4 text-[12.5px] font-bold text-g-muted hover:text-g-word">
            {t.refresh}
          </button>
        </div>
      </div>

      {/* ⚠️ O SERVIDOR AVISOU QUE NÃO GRAVOU — e agora a tela fala (mesmo aviso do SellerProspect). */}
      {soNesteNavegador && (
        <div className="mb-3 rounded-xl border border-g-gold/30 bg-g-gold/[0.06] px-3.5 py-2.5">
          <div className="text-[12.5px] font-bold text-g-gold">⚠️ {t.soLocalT}</div>
          <p className="mt-1 text-[12px] leading-relaxed text-g-muted">{t.soLocalP}</p>
        </div>
      )}

      {(geoEstado === "negado" || geoEstado === "indisponivel") && (
        <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[12px]" style={{ color: NOT_MEASURED }}>
          {geoEstado === "negado" ? t.geoNegado : t.geoIndisp}
        </div>
      )}

      {/* ── CONTADORES — só desenham o que veio medido. `null` fica cinza, nunca 0. ─────────── */}
      {(inbox.estado === "ok" || funil.estado === "ok") && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {/* 🚨 OS QUATRO CONTAM A MESMA POPULAÇÃO (corrigido 2026-08-21).
              "Na fila" vinha da lista MESCLADA (leads que chegaram + prospects que o vendedor
              adicionou) enquanto "No funil" e "Sem toque" vinham só da caixa de entrada. Lado a
              lado eles diziam "30 na fila · 0 no funil" com 28 prospects no funil — e ninguém lê
              quatro números empilhados como quatro populações diferentes: lê como um quadro.
              Números que não descrevem o mesmo conjunto não podem ficar juntos. Agora todos saem
              de `fila`, que é exatamente o que o vendedor está vendo abaixo. */}
          <Kpi label={t.kTotal} v={fila.length} />
          <Kpi label={t.k24h} v={fila.filter((x) => x.chegou != null && (agora - x.chegou) < 864e5).length} />
          <Kpi label={t.kFunil} v={fila.filter((x) => x.noFunil && x.stage && x.stage !== "new").length} />
          <Kpi label={t.kSoltos} v={fila.filter((x) => !x.stage || x.stage === "new").length} />
        </div>
      )}

      {/* ── FALHAS DE LEITURA — cada fonte diz a SUA. Nunca vira lista vazia. ──────────────── */}
      {/* As duas fontes falham pela MESMA porta quando o problema é de crachá (código de time /
          sessão). Repetir o mesmo aviso duas vezes não acrescenta informação — só faz parecer que
          são dois problemas diferentes. Uma causa, um aviso. */}
      {mesmaCulpa ? (
        <Falha t={t} titulo={mesmaCulpa === "team" ? t.errTeamT : t.errSessT}
          corpo={mesmaCulpa === "team" ? t.errTeamP : t.errSessP} motivo={null} onRetry={recarrega} />
      ) : (<>
      {inbox.estado === "err" && <Falha t={t} titulo={inbox.tipo === "team" ? t.errTeamT : inbox.tipo === "sessao" ? t.errSessT : t.errInboxT}
        corpo={inbox.tipo === "team" ? t.errTeamP : inbox.tipo === "sessao" ? t.errSessP : null}
        motivo={inbox.tipo === "team" || inbox.tipo === "sessao" ? null : inbox.motivo} onRetry={carregaInbox} />}
      {funil.estado === "err" && <Falha t={t} titulo={funil.tipo === "team" ? t.errTeamT : funil.tipo === "sessao" ? t.errSessT : t.errFunilT}
        corpo={funil.tipo === "team" ? t.errTeamP : funil.tipo === "sessao" ? t.errSessP : null}
        motivo={funil.tipo === "team" || funil.tipo === "sessao" ? null : funil.motivo} onRetry={carregaFunil} />}
      </>)}

      {/* ── BUSCA ───────────────────────────────────────────────────────────────────────────
          Luis 26/08: «tem que ter o search bar». O filtro por texto já existia por dentro (o
          handoff de outra aba o usava) — só não havia campo. Fila de 40+ sem busca obriga o
          vendedor a rolar procurando com o olho, e o lead que ele quer é justamente o que o
          cliente acabou de citar no telefone. */}
      {fila.length > 0 && (
        <div className="relative mb-3">
          <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] opacity-60">🔎</span>
          <input
            type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder={t.buscaPh} aria-label={t.buscaPh}
            className="min-h-[48px] w-full rounded-full border border-white/12 bg-white/[0.04] pl-11 pr-24 text-[14px] text-g-word placeholder:text-g-muted/60 focus:border-g-green/50 focus:outline-none"
          />
          {busca.trim() && (
            <span className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
              <span className="text-[11.5px] font-bold tabular-nums text-g-muted">{t.buscaN(visiveis.length, fila.length)}</span>
              <button type="button" onClick={() => setBusca("")} aria-label={t.buscaLimpa}
                className="rounded-full px-2 py-1 text-[13px] text-g-muted hover:text-g-word">✕</button>
            </span>
          )}
        </div>
      )}

      {/* ── FILTROS ────────────────────────────────────────────────────────────────────────── */}
      {fila.length > 0 && (
        <div className="mb-3 -mx-1 flex flex-wrap gap-2 px-1">
          {/* handoff de outra aba (nav("leads", {business})) — a fila abre já naquele negócio.
              Sempre com o ✕: filtro que o vendedor não consegue tirar vira "sumiu tudo". */}
          <Chip ativo={filtro === null} onClick={() => setFiltro(null)} label={t.filterAll} n={fila.length} />
          <Chip ativo={filtro === "novos"} onClick={() => setFiltro(filtro === "novos" ? null : "novos")}
            label={t.filterNew} n={fila.filter((x) => !x.noFunil).length} hex="#FF8A33" />
          {STAGES.map((s) => {
            const n = fila.filter((x) => x.stage === s).length;
            if (!n) return null; // etapa sem ninguém não vira botão morto
            return <Chip key={s} ativo={filtro === s} onClick={() => setFiltro(filtro === s ? null : s)} label={t.stages[s] || s} n={n} />;
          })}
        </div>
      )}

      {carregando && (
        <div className="space-y-2.5">
          <div className="text-[12.5px] text-g-muted">{t.loading}</div>
          {[0, 1, 2].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl" />)}
        </div>
      )}

      {vazioDeVerdade && (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center backdrop-blur-xl">
          <div className="text-3xl">📭</div>
          <div className="mt-1.5 text-[14px] font-extrabold text-g-word">{t.emptyT}</div>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-g-muted">{t.emptyP}</p>
        </div>
      )}

      {/* ⚠️ VAZIO DE BUSCA ≠ VAZIO DE FILA. Sem este estado a lista some inteira e o vendedor lê
          "acabaram meus leads" — o pânico errado. Diz o que foi buscado e como tentar de novo. */}
      {!carregando && !tudoFalhou && fila.length > 0 && visiveis.length === 0 && busca.trim() && (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center backdrop-blur-xl">
          <div className="text-3xl">🔎</div>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-g-muted">{t.buscaVazia(busca.trim())}</p>
          <button type="button" onClick={() => setBusca("")}
            className="mt-3 inline-flex min-h-[44px] items-center rounded-full border border-white/15 bg-white/[0.04] px-4 text-[13px] font-bold text-g-word hover:border-g-green/40">
            ✕ {t.buscaLimpa}
          </button>
        </div>
      )}

      {!carregando && !tudoFalhou && visiveis.length > 0 && (
        <div className="space-y-2.5">
          {visiveis.map((item) => (
            <PaginaDoLead
              key={item.chave} t={t} lang={lang} locale={locale} item={item}
              agora={agora} aberto={aberto === item.chave}
              onAbrir={() => abrir(item)}
              aval={item.avaliacaoId ? avals[item.avaliacaoId] : null}
              salvar={(patch) => salvar(item, patch)}
              recibo={recibos[item.idNatural] || null}
              setRecibo={(r) => setRecibos((m) => ({ ...m, [item.idNatural]: r }))}
              avancar={() => avancar(item.chave)}
              nav={nav}
            />
          ))}
          {aberto === "__fim__" && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-[12.5px] text-g-muted backdrop-blur-xl">{t.queueEnd}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── contador ───────────────────────────────────────────────────────────────────────────────────
function Kpi({ label, v, nm }) {
  // `null`/ausente é NÃO MEDIDO em cinza. Nunca 0: "nenhum" e "não deu pra contar" são coisas
  // diferentes, e o `|| 0` que as junta é o fallback que já escondeu erro cinco vezes neste repo.
  const naoMedido = v == null;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 min-w-0 backdrop-blur-xl">
      <div className="truncate text-[10.5px] font-bold uppercase tracking-wide text-g-muted">{label}</div>
      {naoMedido
        ? <div className="mt-0.5 truncate text-[12px] font-bold" style={{ color: NOT_MEASURED }}>— {nm}</div>
        : <div className="mt-0.5 text-[20px] font-black tabular-nums text-g-word">{v}</div>}
    </div>
  );
}

function Chip({ ativo, onClick, label, n, hex = "#D6C29A" }) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex min-h-[48px] items-center gap-1.5 rounded-full px-4 text-[12.5px] font-bold ring-1 transition ${ativo ? "text-g-word" : "text-g-muted hover:text-g-word"}`}
      style={ativo ? { background: `${hex}22`, "--tw-ring-color": `${hex}80` } : { background: "rgba(255,255,255,0.03)", "--tw-ring-color": "rgba(255,255,255,0.10)" }}>
      {label}
      <span className="rounded-full bg-black/30 px-1.5 py-0.5 text-[10.5px] font-black tabular-nums" style={{ color: hex }}>{n}</span>
    </button>
  );
}

function Falha({ t, titulo, corpo, motivo, onRetry }) {
  return (
    <div className="mb-3 rounded-2xl border border-g-gold/35 bg-g-gold/[0.07] p-4">
      <div className="text-[13px] font-extrabold text-g-gold">⚠️ {titulo}</div>
      {corpo && <p className="mt-1 text-[12px] leading-relaxed text-g-muted">{corpo}</p>}
      {/* MOTIVO CRU. Traduzir/embelezar o erro do servidor é apagar a única pista que existe. */}
      {motivo && <p className="mt-2 break-words rounded-lg border border-white/10 bg-black/25 px-3 py-2 font-mono text-[11.5px] text-g-muted">{t.reason}: {motivo}</p>}
      <button type="button" onClick={onRetry} className="mt-3 inline-flex min-h-[48px] items-center rounded-full border border-white/15 px-4 text-[12.5px] font-bold text-g-word hover:border-g-gold/50">{t.retry}</button>
    </div>
  );
}

// ═══ A PÁGINA DE UM LEAD ═══════════════════════════════════════════════════════════════════════
function PaginaDoLead({ t, lang, locale, item, agora, aberto, onAbrir, aval, salvar, avancar, nav, recibo, setRecibo }) {
  const [note, setNote] = useState(item.note || "");
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [mailCopiado, setMailCopiado] = useState(false);
  const [pitchCopiado, setPitchCopiado] = useState(false);
  const [enviandoUp, setEnviandoUp] = useState(false);
  const [upMsg, setUpMsg] = useState("");
  const upgradeUrl = siteNovoDe(item.site);
  const [apontamento, setApontamento] = useState("");
  // ── PERTO DE MIM (2026-08-21) ─────────────────────────────────────────────────────────────
  // A fila vinha por ordem de chegada — o pior roteiro possível na rua: o vendedor atravessa o
  // A nota segue o BANCO quando o banco muda, e SÓ então — o padrão "ajustar estado quando uma
  // prop muda", em render, sem efeito. Com um `useEffect([item.note])` cada refetch de 60s
  // reescreveria o campo; aqui `notaBase` só se move quando o valor gravado realmente mudou, então
  // o que o vendedor está digitando sobrevive ao ciclo de atualização.
  const [notaBase, setNotaBase] = useState(item.note || "");
  if ((item.note || "") !== notaBase) { setNotaBase(item.note || ""); setNote(item.note || ""); }

  // ── CAMADA 1: o cronômetro ────────────────────────────────────────────────────────────────
  const min = item.chegou == null ? null : Math.max(0, Math.floor((agora - item.chegou) / 60000));
  const u = urgencia(min);
  const relogio = min == null ? t.uSemData
    : min < 1 ? t.now
    : min < 60 ? t.minAgo(min)
    : min < 60 * 24 ? t.hAgo(Math.floor(min / 60))
    : t.dAgo(Math.floor(min / 1440));
  const selo = { agora: t.uAgora, hoje: t.uHoje, dia: t.uDia, antigo: t.uAntigo, semData: t.uSemData }[u.k];
  const quem = item.negocio || item.nome || "—";

  // ── CAMADA 2: a dor medida ────────────────────────────────────────────────────────────────
  const av = aval?.estado === "ok" ? aval.dados : null;
  const score = av?.score_geral;
  const ficha = av?.minha_ficha || null;
  const hood = av ? medianaVizinhanca(av.concorrentes) : null;
  // dores = aspectos MEDIDOS na banda vermelha. Se nenhum for vermelho, a banda âmbar entra —
  // mas `null` (não medido) NUNCA vira dor: ausência de medição não é um defeito do negócio.
  const dores = useMemo(() => {
    const as = Array.isArray(av?.aspectos) ? av.aspectos.filter((a) => a && a.score != null) : [];
    const vermelhos = as.filter((a) => a.score < 50);
    return (vermelhos.length ? vermelhos : as.filter((a) => a.score < 90)).sort((a, b) => a.score - b.score).slice(0, 3);
  }, [av]);

  /* O PITCH DESTE LEAD — a pior dor MEDIDA vira a primeira frase. Mesma frase na ligação e no
     e-mail: repetição entre canais é o que faz o dono lembrar de onde já ouviu aquilo. */
  const pitch = useMemo(() => {
    const pior = dores[0];
    const f = pior && PITCH[pior.nome] && (PITCH[pior.nome][lang] || PITCH[pior.nome].en);
    return f ? f(item.negocio || item.nome || "") : "";
  }, [dores, lang, item.negocio, item.nome]);

  // ── CAMADA 3: as 3 palavras — dor medida → perna. Nada redigitado: cor/ícone/nome de pernaMeta.
  const sacadas = useMemo(() => {
    const vistos = new Set();
    const out = [];
    for (const d of dores) {
      const key = PERNA_DO_ASPECTO[d.nome];
      if (!key || vistos.has(key)) continue;
      const meta = pernaMeta(lang, key);
      if (!meta) continue;
      vistos.add(key);
      out.push({ key, meta, aspecto: d, evidencia: (d.evidencias || []).find((e) => typeof e === "string" && e.startsWith("✗")) || null });
    }
    // poucas avaliações medidas contra a mediana da vizinhança → ❤️ AD, mesmo sem aspecto vermelho.
    if (!vistos.has("ad") && ficha?.avaliacoes != null && hood && ficha.avaliacoes < hood.valor) {
      const meta = pernaMeta(lang, "ad");
      if (meta) out.push({ key: "ad", meta, aspecto: null, evidencia: `${t.fichaAv(ficha.avaliacoes)} · ${t.hood}: ${hood.valor}` });
    }
    return out.sort((a, b) => PERNAS.indexOf(a.key) - PERNAS.indexOf(b.key));
  }, [dores, ficha, hood, lang, t]);

  const relatorio = item.avaliacaoId
    ? `${typeof window !== "undefined" ? window.location.origin : "https://guileoai.com"}/apresentacao/${item.avaliacaoId}`
    : "";

  // ── E-MAIL: mailto, do cliente do PRÓPRIO vendedor ────────────────────────────────────────
  // Não existe endpoint pra mandar e-mail a um lead e não dá pra criar um (functions/ é de outro
  // dono nesta onda). `mailto:` é melhor de qualquer jeito: sai da caixa dele, com a assinatura
  // dele, e a entrega/consentimento ficam onde devem estar.
  // O CORPO SÓ CARREGA NÚMERO MEDIDO — e a comparação com a vizinhança. Nada de "quanto você está
  // perdendo": ganho-vs-perda dá r=.03 numa meta-análise de 93 estudos; o que convence é o fato.

  const mailtoPartes = useMemo(() => {
    // 🚨 O TEXTO NÃO DEPENDE DO ENDEREÇO (24/08). Este `if (!item.email) return null` escondia o
    // MODELO DE E-MAIL inteiro de quem não tem e-mail cadastrado — e são 256 dos 269 prospects da
    // carteira. O vendedor abria a ficha do encanador e não via nada, achando que a ferramenta não
    // existia para ele. `mailto:` e Gmail precisam mesmo de endereço; COPIAR não precisa: o texto
    // serve para colar no formulário de contato do site dele (que costuma ser a única porta —
    // provado no Nonstop, onde o e-mail ditado voltou e o formulário entregou), no WhatsApp, ou
    // para ler durante a ligação.
    // BLOCO SEM DADO NÃO DESENHA — vale para o e-mail também: sem nenhum número medido, a frase
    // "segue o que a gente mediu" ficaria pendurada sobre o vazio, prometendo medição que não houve.
    const medidos = [];
    if (score != null) medidos.push(t.mailScore(score));
    if (ficha?.nota != null) medidos.push(t.mailFicha(ficha.nota, ficha.avaliacoes ?? null));
    if (hood) medidos.push(t.mailHood(hood.valor, hood.amostra));
    const linhas = [t.mailHi(item.nome), ""];
    if (medidos.length) linhas.push(t.mailIntro, ...medidos);
    if (relatorio) linhas.push("", `${t.mailLink} ${relatorio}`);
    linhas.push("", t.mailEnd);
    return { assunto: t.mailSubj(item.negocio || item.nome), corpo: linhas.join("\n") };
  }, [item.email, item.nome, item.negocio, score, ficha, hood, relatorio, t]);

  // UMA mensagem, TRÊS caminhos: app de e-mail, Gmail no navegador, e copiar.
  const mailto = mailtoPartes ? `mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent(mailtoPartes.assunto)}&body=${encodeURIComponent(mailtoPartes.corpo)}` : "";

  // 🚨 `mailto:` NÃO ABRE NADA em quem usa webmail (2026-08-20). O link estava certo o tempo todo
  // e o Luis via "o e-mail não funciona" — porque no Mac dele não há app de e-mail configurado.
  // Um canal que depende de configuração alheia não é um canal: é uma aposta. Três caminhos para
  // a MESMA mensagem — app de e-mail, Gmail no navegador, e copiar — e um deles sempre serve.
  const gmailLink = useMemo(() => {
    if (!item.email || !mailtoPartes) return "";
    const q = new URLSearchParams({ view: "cm", fs: "1", to: item.email, su: mailtoPartes.assunto, body: mailtoPartes.corpo });
    return `https://mail.google.com/mail/?${q.toString()}`;
  }, [item.email, mailtoPartes]); // eslint-disable-line react-hooks/exhaustive-deps

  const waMsg = t.waMsg(item.nome, item.negocio);
  const telHref = `tel:${String(item.telefone || "").replace(/[^0-9+]/g, "")}`;

  // 🚨 O PRESENTE DE $50 PRECISA DE LASTRO. O e-mail promete crédito no primeiro mês — e promessa
  // que só existe na caixa de saída do vendedor ninguém honra na ativação. Ao abrir o e-mail, o
  // apontamento entra na ficha com data: quem ativar o cliente lê ali o que foi prometido.
  // Registrar NÃO pode atrapalhar o envio: se a gravação falhar, o e-mail abre do mesmo jeito.
  const registraEnvio = () => {
    try {
      const nova = anexaApontamento(note, t.logMail, locale);
      setNote(nova);
      salvar(item, { note: nova });
    } catch { /* o canal é mais importante que o registro */ }
  };

  const comRecibo = async (patch, seguir) => {
    setSalvando(true); setRecibo(null);
    const r = await salvar(patch);
    setSalvando(false);
    setRecibo(r.ok ? { ok: true, id: String(r.id).slice(0, 8) } : { ok: false, motivo: r.motivo });
    // A tela só AVANÇA quando o banco confirmou. Avançar em cima de uma falha faria o vendedor
    // acreditar num estado que o banco não tem — o defeito exato que já aconteceu aqui.
    if (r.ok && seguir) setTimeout(avancar, 900);
  };

  return (
    <motion.div layout className="overflow-hidden rounded-2xl border bg-white/[0.04] min-w-0 backdrop-blur-xl"
      style={{ borderColor: aberto ? `${u.hex}55` : "rgba(255,255,255,0.10)" }}>
      {/* ── CAPA (a tira que se escolhe) — o relógio é o herói ────────────────────────────── */}
      <button type="button" onClick={onAbrir}
        className="flex w-full min-h-[72px] items-center gap-3 p-4 text-left">
        <span className="relative inline-flex h-3 w-3 shrink-0">
          {u.k === "agora" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden" style={{ background: u.hex }} />}
          <span className="relative inline-flex h-3 w-3 rounded-full" style={{ background: u.hex, boxShadow: `0 0 10px ${u.hex}` }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-extrabold text-g-word">{quem}</span>
          <span className="mt-0.5 block truncate text-[11.5px] text-g-muted">
            {item.nome && item.negocio ? `${item.nome} · ` : ""}
            {item.canal || <span style={{ color: NOT_MEASURED }}>{t.unknown}</span>}
            {item.noFunil && item.stage ? ` · ${t.stages[item.stage] || item.stage}` : ""}
          </span>
        </span>
        <span className="shrink-0 text-right">
          {/* PESO DE MANCHETE, não legenda de canto: o achado mais bem sustentado da pesquisa. */}
          <span className="block text-[17px] font-black leading-none tabular-nums" style={{ color: u.hex }}>{relogio}</span>
          <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider" style={{ color: u.hex, opacity: 0.85 }}>{selo}</span>
          {item.distanciaKm != null && (
            <span className="mt-1 block text-[10.5px] font-bold tabular-nums text-g-muted">📍 {item.distanciaKm < 1 ? `${Math.round(item.distanciaKm * 1000)} m` : `${item.distanciaKm.toFixed(1)} km`}</span>
          )}
        </span>
      </button>

      {/* ── AS AÇÕES, NA CAPA (2026-08-20) ────────────────────────────────────────────────
          O Luis abriu o hub e perguntou "cadê os botões pra ligar?" — e tinha razão: a capa
          virou nome + relógio, e para telefonar era preciso ABRIR o dossiê primeiro. Um lead
          quente que exige dois toques a mais é um lead que esfria enquanto se navega.
          🚨 FORA do <button> da capa, de propósito: <button> dentro de <button> é HTML inválido
          e o navegador engole o clique de dentro. E cada ação só desenha se o dado EXISTE —
          botão de ligar sobre um lead sem telefone é uma promessa que quebra na mão dele. */}
      {(item.telefone || item.email) ? (
        <div className="flex flex-wrap gap-2 border-t border-white/10 px-4 py-3">
          {item.telefone && (
            <a href={`tel:${soDigitos(item.telefone)}`} onClick={(e) => e.stopPropagation()}
              className="inline-flex min-h-[48px] items-center gap-1.5 rounded-full bg-g-green/15 px-4 text-[12.5px] font-bold text-g-green ring-1 ring-g-green/40 hover:bg-g-green/25">
              {t.aCall}
            </a>
          )}
          {item.telefone && (
            // 🚨 A MENSAGEM PRONTA VAI JUNTO. Eu tinha posto `wa.me/<numero>` cru aqui — abria o
            // WhatsApp com a caixa VAZIA, e o vendedor tinha que inventar a primeira frase na hora.
            // O dossiê sempre mandou `waMsg` (nome + negócio + a frase de abertura). Capa e dossiê
            // precisam abrir a MESMA conversa: dois caminhos para a mesma ação com textos
            // diferentes é onde a padronização do time se perde.
            <a href={waTo(item.telefone, waMsg)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
              className="inline-flex min-h-[48px] items-center gap-1.5 rounded-full bg-white/[0.05] px-4 text-[12.5px] font-bold text-g-word ring-1 ring-white/15 hover:bg-white/[0.09]">
              {t.aWa}
            </a>
          )}
          {item.email && mailto && (
            <a href={mailto} onClick={(e) => { e.stopPropagation(); registraEnvio(); }}
              className="inline-flex min-h-[48px] items-center gap-1.5 rounded-full bg-white/[0.05] px-4 text-[12.5px] font-bold text-g-word ring-1 ring-white/15 hover:bg-white/[0.09]">
              {t.aMail}
            </a>
          )}
          {/* O PREVIEW NA CAPA. O lead já atendeu e está ESPERANDO isto — se o link mora dentro
              do dossiê, o vendedor liga sem ter o que mandar. Verde, não dourado: é outra coisa. */}
          {item.previewSite && (
            <a href={item.previewSite} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
              className="inline-flex min-h-[48px] items-center gap-1.5 rounded-full bg-g-green/15 px-4 text-[12.5px] font-bold text-g-green ring-1 ring-g-green/40 hover:bg-g-green/25">
              {t.aPreview}
            </a>
          )}
          {/* O RELATÓRIO NA CAPA. Ele é o motivo da ligação ("medi o seu negócio, olha o que achei")
              — exigir abrir o dossiê pra alcançá-lo põe um clique entre o vendedor e o argumento. */}
          {relatorio && (
            <a href={relatorio} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
              className="inline-flex min-h-[48px] items-center gap-1.5 rounded-full bg-g-gold/12 px-4 text-[12.5px] font-bold text-g-gold ring-1 ring-g-gold/35 hover:bg-g-gold/20">
              {t.aReport}
            </a>
          )}
        </div>
      ) : (
        <div className="border-t border-white/10 px-4 py-2.5 text-[11.5px]" style={{ color: NOT_MEASURED }}>{t.aNoWay}</div>
      )}

      {/* ── O DOSSIÊ ──────────────────────────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }} className="border-t border-white/10">
            <div className="space-y-5 p-4">

              {/* 1 · quem é + o que ele falou */}
              {item.resumo && (
                <div>
                  <div className="text-[10.5px] font-bold uppercase tracking-wide text-g-muted">{t.summary}</div>
                  <p className="mt-1 whitespace-pre-line break-words rounded-xl border border-white/10 bg-black/20 p-3 text-[13px] leading-relaxed text-g-ink backdrop-blur-xl">{item.resumo}</p>
                </div>
              )}

              {/* AÇÕES — cada canal só aparece se o dado existir. Botão morto é pior que ausência. */}
              <div className="flex flex-wrap gap-2">
                {item.telefone && <Acao href={telHref}>{t.aCall}</Acao>}
                {item.telefone && <Acao href={waTo(item.telefone, waMsg)} externo verde>{t.aWa}</Acao>}
                {item.email && <Acao href={mailto} aoClicar={registraEnvio}>{t.aMail}</Acao>}
                {/* Gmail e copiar existem porque `mailto:` depende de um app configurado na máquina
                    do vendedor — e 1.000 vendedores na rua não têm a mesma máquina. */}
                {item.email && gmailLink && <Acao href={gmailLink} externo aoClicar={registraEnvio}>{t.aGmail}</Acao>}
                {mailtoPartes && (
                  <button type="button"
                    onClick={() => { navigator.clipboard?.writeText(`${mailtoPartes.assunto}\n\n${mailtoPartes.corpo}`); setMailCopiado(true); setTimeout(() => setMailCopiado(false), 1600); }}
                    className="inline-flex min-h-[48px] items-center rounded-full border border-white/15 bg-white/[0.04] px-4 text-[13px] font-bold text-g-word hover:border-g-gold/40">
                    {mailCopiado ? t.aCopiadoMail : t.aCopiarMail}
                  </button>
                )}
                {upgradeUrl && item.email && (
                  <button type="button" disabled={enviandoUp}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setEnviandoUp(true); setUpMsg("");
                      // A RESPOSTA MANDA, não o status HTTP: o motor só devolve id quando o
                      // Resend aceitou de verdade. Sem id eu digo que NÃO enviou.
                      const { d } = await post("/api/seller-leads", {
                        action: "upgrade", para: item.email,
                        dados: { business: item.negocio || item.nome, link: upgradeUrl, lang, site: item.site || "" },
                      });
                      setEnviandoUp(false);
                      setUpMsg(d?.ok && d?.id ? t.upOk : (d?.motivo || d?.error || t.upErr));
                    }}
                    className="inline-flex min-h-[48px] items-center rounded-full border border-g-gold/40 bg-g-gold/10 px-4 text-[13px] font-bold text-g-gold hover:bg-g-gold/20 disabled:opacity-50">
                    {enviandoUp ? t.upSending : t.aUpgrade}
                  </button>
                )}
                {relatorio && <Acao href={relatorio} externo>{t.aReport}</Acao>}
                {/* O resultado NA TELA: clicar e não saber se saiu é o mesmo que não ter clicado. */}
                {upMsg && <span className="inline-flex min-h-[48px] items-center text-[12.5px] font-bold text-g-muted">{upMsg}</span>}
                {relatorio && (
                  <button type="button" onClick={() => { navigator.clipboard?.writeText(relatorio); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }}
                    className="inline-flex min-h-[48px] items-center rounded-full border border-white/15 bg-white/[0.04] px-4 text-[13px] font-bold text-g-word hover:border-g-gold/40">
                    {copiado ? t.copied : t.aCopy}
                  </button>
                )}
                {/* SEM RELATÓRIO NÃO É SILÊNCIO, É CONVITE (2026-08-20). Antes, um lead sem avaliação
                    simplesmente não desenhava os botões de relatório — e quem olhava não conseguia
                    distinguir "a ferramenta sumiu" de "este lead não tem o dado". Ausência não se vê.
                    Agora vira um caminho: leva pro X-Ray com o negócio JÁ preenchido. */}
                {!relatorio && (
                  <button type="button" onClick={() => nav("raiox", { business: item.negocio || item.nome || "", site: "" })}
                    className="inline-flex min-h-[48px] items-center rounded-full border border-g-gold/40 bg-g-gold/10 px-4 text-[13px] font-bold text-g-gold hover:bg-g-gold/20">
                    {t.aMeasure}
                  </button>
                )}
              </div>
              {!item.telefone && !item.email && (
                <p className="text-[12px]" style={{ color: NOT_MEASURED }}>📵 {t.unknown}</p>
              )}

              {/* 2 · A DOR MEDIDA — sem avaliacao_id este bloco simplesmente NÃO existe. */}
              {item.avaliacaoId && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-xl">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{t.dorT}</div>
                  {aval?.estado === "busy" && (
                    <div className="mt-2 inline-flex items-center gap-2 text-[12px] text-g-muted">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-g-green/30 border-t-g-green" />{t.loadingAval}
                    </div>
                  )}
                  {aval?.estado === "err" && (
                    <p className="mt-2 break-words text-[12px] text-g-gold">⚠️ {t.avalErr} — <span className="font-mono text-g-muted">{aval.motivo}</span></p>
                  )}
                  {av && (
                    <>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 backdrop-blur-xl">
                          <div className="text-[10.5px] font-bold uppercase tracking-wide text-g-muted">{t.score}</div>
                          {score == null
                            ? <div className="mt-0.5 text-[13px] font-black" style={{ color: NOT_MEASURED }}>— {t.notMeasured}</div>
                            : <div className="mt-0.5 text-[24px] font-black tabular-nums text-g-word">{score}<span className="text-[12px] font-bold text-g-muted">/100</span></div>}
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 backdrop-blur-xl">
                          <div className="text-[10.5px] font-bold uppercase tracking-wide text-g-muted">{t.ficha}</div>
                          {/* ficha só existe com a identidade PROVADA no motor; sem ela, cinza. */}
                          {ficha && (ficha.nota != null || ficha.avaliacoes != null) ? (
                            <div className="mt-0.5 text-[13.5px] font-bold text-g-word">
                              {ficha.nota != null ? `${ficha.nota}★` : <span style={{ color: NOT_MEASURED }}>—</span>}
                              {ficha.avaliacoes != null && <span className="text-g-muted"> · {t.fichaAv(ficha.avaliacoes)}</span>}
                            </div>
                          ) : <div className="mt-0.5 text-[13px] font-black" style={{ color: NOT_MEASURED }}>— {t.notMeasured}</div>}
                          {hood && <div className="mt-0.5 text-[11px] text-g-muted">{t.hood}: <span className="font-bold tabular-nums text-g-word">{hood.valor}</span> · {t.hoodOf(hood.amostra)}</div>}
                        </div>
                      </div>
                      {dores.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          {dores.map((d) => (
                            <div key={d.nome} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 backdrop-blur-xl">
                              <div className="flex items-center justify-between gap-2">
                                <span className="min-w-0 truncate text-[12.5px] font-bold text-g-word">{aspectLabel(d.nome, lang)}</span>
                                <span className="shrink-0 text-[12px] font-black tabular-nums text-g-muted">{d.score}/100</span>
                              </div>
                              {(d.evidencias || []).filter((e) => typeof e === "string" && e.startsWith("✗")).slice(0, 2).map((e, i) => (
                                <div key={i} className="mt-0.5 break-words text-[11.5px] leading-snug text-g-muted">{e}</div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* O PITCH — a primeira frase, a mesma na ligação e no e-mail. Vai ANTES das 3 pernas
                  porque é o que se fala primeiro: as pernas explicam o conserto, o pitch abre a
                  porta. Copiável em um toque: na rua ninguém transcreve frase de tela. */}
              {pitch && (
                <div className="rounded-xl border border-g-gold/30 bg-g-gold/[0.06] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-g-gold">{t.pitchT}</span>
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(pitch); setPitchCopiado(true); setTimeout(() => setPitchCopiado(false), 1600); }}
                      className="inline-flex min-h-[44px] shrink-0 items-center rounded-full border border-white/15 px-3.5 text-[11px] font-bold text-g-word hover:border-g-gold/50">
                      {pitchCopiado ? t.copied : t.aCopy}
                    </button>
                  </div>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-g-word">“{pitch}”</p>
                </div>
              )}

              {/* 3 · AS 3 PALAVRAS — ícone/nome/cor de pernaMeta (❤️ no AD é o override do relatório) */}
              {sacadas.length > 0 && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{t.sacadaT}</div>
                  <p className="mt-0.5 text-[11.5px] text-g-muted">{t.sacadaP}</p>
                  <div className="mt-2 space-y-2">
                    {sacadas.map((s) => (
                      <div key={s.key} className="flex items-start gap-3 rounded-xl border px-3 py-2.5"
                        style={{ borderColor: `rgba(${s.meta.rgb},0.35)`, background: `rgba(${s.meta.rgb},0.07)` }}>
                        <span className="text-[18px] leading-none" aria-hidden="true">{s.meta.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-black" style={{ color: s.meta.accent }}>{s.meta.badge}</div>
                          {/* 3–4 palavras. O dicionário manda; nada escrito à mão aqui. */}
                          <div className="text-[14px] font-extrabold leading-tight text-g-word">{(t.legs || {})[s.key] || ""}</div>
                          {s.evidencia && <div className="mt-0.5 break-words text-[11.5px] leading-snug text-g-muted">{s.evidencia}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4 · A VIDA DO LEAD */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 backdrop-blur-xl">
                <div className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{t.vidaT}</div>

                {!item.noFunil ? (
                  // ainda não é do funil: um toque o adota na 1ª etapa, e a tela segue pro próximo.
                  <button type="button" disabled={salvando}
                    onClick={() => comRecibo({ stage: STAGES[0], note }, true)}
                    className="btn-bright mt-3 inline-flex min-h-[48px] items-center px-5 text-[13.5px] disabled:opacity-50">
                    {salvando ? t.adding : t.addFunil}
                  </button>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="flex min-w-0 items-center gap-2 text-[11.5px] text-g-muted">
                      {t.stageL}
                      <select value={item.stage || STAGES[0]} disabled={salvando}
                        onChange={(e) => comRecibo({ stage: e.target.value, note }, true)}
                        className="min-h-[48px] rounded-xl border border-white/15 bg-[#0d0c0a] px-3 text-[16px] font-bold text-g-word focus:border-g-green/50 focus:outline-none">
                        {STAGES.map((s) => <option key={s} value={s} style={{ color: "#EDE7DC", background: "#161512" }}>{t.stages[s] || s}</option>)}
                      </select>
                    </label>
                    <label className="flex min-w-0 items-center gap-2 text-[11.5px] text-g-muted">
                      {t.nextL}
                      <input type="date" value={item.nextAt ? String(item.nextAt).slice(0, 10) : ""} disabled={salvando}
                        onChange={(e) => comRecibo({ next_at: e.target.value || "", note }, false)}
                        className="min-h-[48px] rounded-xl border border-white/15 bg-[#0d0c0a] px-3 text-[16px] text-g-word focus:border-g-green/50 focus:outline-none" />
                    </label>
                  </div>
                )}

                {/* NOTA — 16px obrigatórios: abaixo disso o Safari iOS dá zoom no foco e quebra tudo. */}
                <div className="mt-3">
                  <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-g-muted">{t.noteL}</div>

                  {/* ── O HISTÓRICO, EM TÓPICOS COM DATA (2026-08-20) ──────────────────────────
                      A nota era um bloco de texto solto: cada visita o vendedor apagava ou empurrava
                      o que estava lá, e a memória do lead virava um parágrafo sem tempo. Quem ligou
                      ontem não lembra o que disse; quem assume o lead não sabe o que já foi tentado.
                      Agora cada apontamento é uma LINHA com data. O mais novo primeiro, porque a
                      última coisa dita é a que muda a próxima ligação.
                      🚨 NADA É REESCRITO: o novo apontamento é ANEXADO ao que já existe. Salvar não
                      pode apagar histórico — histórico apagado não volta, e é justamente o que o
                      vendedor precisa reler antes de discar. */}
                  {linhasDaNota(note).length > 0 && (
                    <ul className="mb-2 space-y-1.5">
                      {linhasDaNota(note).map((l, i) => (
                        <li key={i} className="flex gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
                          {l.data && <span className="shrink-0 text-[10.5px] font-bold tabular-nums text-g-muted">{l.data}</span>}
                          <span className="min-w-0 break-words text-[12.5px] leading-relaxed text-g-ink">{l.texto}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <textarea value={apontamento} onChange={(e) => setApontamento(e.target.value)} rows={2} placeholder={t.notePh}
                    className="w-full rounded-xl border border-white/15 bg-[#0d0c0a] p-3 text-[16px] leading-relaxed text-g-word placeholder:text-g-muted/60 focus:border-g-green/50 focus:outline-none" />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button type="button" disabled={salvando || !apontamento.trim()}
                      onClick={() => { const nova = anexaApontamento(note, apontamento, locale); setNote(nova); setApontamento(""); comRecibo({ note: nova }, false); }}
                      className="inline-flex min-h-[48px] items-center rounded-full bg-g-green/15 px-4 text-[13px] font-bold text-g-green ring-1 ring-g-green/30 hover:bg-g-green/25 disabled:opacity-50">
                      {salvando ? t.saving : t.save}
                    </button>
                    {/* 🧾 COMPROVANTE: o `id` que o banco devolveu. "ok" sem id é promessa sem lastro. */}
                    {recibo?.ok && <span className="text-[12px] font-bold" style={{ color: GANHO }}>{t.savedId(recibo.id)}</span>}
                    {recibo && !recibo.ok && <span className="break-words text-[12px] font-bold text-g-gold">{t.saveFail}: <span className="font-mono font-normal text-g-muted">{recibo.motivo}</span></span>}
                  </div>
                </div>

                {/* histórico do que já se sabe — só o que existe medido/gravado */}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-g-muted">
                  <span>{t.arrived}: {item.chegou ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(item.chegou) : <span style={{ color: NOT_MEASURED }}>{t.unknown}</span>}</span>
                  {item.atualizado && <span>{t.lastUpdate}: {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(item.atualizado)}</span>}
                  {item.canal && <span>{t.channel}: {item.canal}</span>}
                </div>
              </div>

              {/* a fila continua: seguir para o próximo sem voltar para a lista */}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={avancar}
                  className="inline-flex min-h-[48px] items-center rounded-full border border-white/15 bg-white/[0.04] px-5 text-[13px] font-bold text-g-word hover:border-g-green/40">{t.next}</button>
                <button type="button" onClick={onAbrir}
                  className="inline-flex min-h-[48px] items-center rounded-full border border-white/15 px-4 text-[13px] font-bold text-g-muted hover:text-g-word">{t.close}</button>
                {/* DO LEAD DIRETO PARA O DOCUMENTO, com o negócio, e-mail e telefone já na mão.
                    O handoff evita o pior momento da venda: o vendedor no telefone, redigitando. */}
                {nav && item.negocio && (
                  <>
                    <button type="button" onClick={() => nav("quote", { client: item.negocio, business: item.negocio, email: item.email || "", phone: item.telefone || "" })}
                      className="inline-flex min-h-[48px] items-center rounded-full border border-white/15 bg-white/[0.04] px-4 text-[13px] font-bold text-g-word hover:border-g-gold/40">
                      {t.aQuote}
                    </button>
                    <button type="button" onClick={() => nav("contrato", { client: item.negocio, business: item.negocio, email: item.email || "", phone: item.telefone || "" })}
                      className="inline-flex min-h-[48px] items-center rounded-full border border-white/15 bg-white/[0.04] px-4 text-[13px] font-bold text-g-word hover:border-g-gold/40">
                      {t.aContract}
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// alvo de toque 48px em TODA ação — o número de quem usa o hub na rua, não sentado.
function Acao({ href, externo, verde, children, aoClicar }) {
  return (
    <a href={href} onClick={(e) => { e.stopPropagation(); aoClicar?.(); }} {...(externo ? { target: "_blank", rel: "noopener" } : {})}
      className={`inline-flex min-h-[48px] items-center rounded-full px-4 text-[13px] font-bold ${verde ? "bg-g-green/15 text-g-green ring-1 ring-g-green/30 hover:bg-g-green/25" : "border border-white/15 bg-white/[0.04] text-g-word hover:border-g-green/40"}`}>
      {children}
    </a>
  );
}
