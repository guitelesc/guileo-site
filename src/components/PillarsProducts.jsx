import { useState } from "react";
import { useLang } from "../i18n.jsx";
import { Reveal, Stagger, Item } from "../lib/ui.jsx";
import { productsForPilar } from "../data/productSystem.js";

// PillarsProducts — the aligned product spine (Luis, 2026-07-24): the landing must MIRROR the real
// platform's three pillars, and the products must CORRESPOND to what the client actually buys, each
// tied to a RESULT and a VALUE. Replaces the old redundant WholePicture + flat ProductResults grid.
//   🧠 Guileo Brain — the AI employee (answers/books/sells/collects)         → recovers $/mo
//   📈 Guileo AD    — marketing that runs daily (hybrid: AI every day + a real team on the craft)
//   🏗️ Guileo Build — the foundation, built once (done-for-you by the team)
// Honesty (CLAUDE.md law): AD is explicitly HYBRID (AI + human team) — never "fully automated".
// Locked cement + neon-realista signal system; landing-scoped; Faena restraint (no loud motion).
//
// ── UMA PALETA SÓ PARA OS TRÊS PILARES (2026-08-17, Luis) ──────────────────────────────────────
// O site tinha DUAS paletas para os MESMOS três pilares: aqui era laranja/azul/violeta, e o LegsV2
// — a seção logo acima, com o cérebro, o gráfico e o foguete — usava verde/champanhe/cobre.
// Duas cores para a mesma coisa é o mesmo defeito do "Performance→Sales→Growth" vs "Brain·AD·Build"
// que arrumei hoje, só que na camada visual: a pessoa rola de uma seção para a outra e não sabe
// que está vendo o mesmo Brain. Cor é nome sem palavra — trocar a cor troca o nome.
// Venceu a paleta do LegsV2 (a que o Luis apontou): ela é a família quente do resto da marca,
// enquanto o azul/violeta vinha de outro lugar e brigava com o cimento.
//   Brain #3E9468 (rgb 62,148,104) · AD #D6C29A (214,194,154) · Build #BE7F35 (190,127,53)
//
// ⚠️ O BUILD FOI ESCURECIDO (2026-08-17, 2ª passada). Copiar a paleta do LegsV2 ao pé da letra
// dava Build #C2A878 (194,168,120) — a DISTÂNCIA 47 do champanhe do AD no espaço RGB, ou seja,
// perceptualmente a mesma cor. No LegsV2 isso não incomoda porque os três ficam longe um do outro,
// com ilustração grande separando; aqui os três cards são LADO A LADO e o do meio e o da direita
// liam como um só — o Luis olhou e perguntou "cadê as cores".
// O cobre novo foi escolhido por MEDIÇÃO, não por gosto: distância 124 do AD (era 47), 139 do
// verde do Brain, e contraste 5.46 contra o cimento #161512 — acima do mínimo de 4.5 da WCAG AA,
// que importa porque este é o NOME do pilar, a coisa que a página inteira quer que grude.


// ── A LANDING VOLTOU A LER O SISTEMA (2026-08-11) ───────────────────────────────────────────────
// Antes, cada pilar trazia um `products: [...]` escrito à mão — e repetido nos QUATRO idiomas.
// Doze listas mantidas a dedo, contra dez produtos que já vivem traduzidos em productSystem.js.
// Elas já haviam divergido: o AD anunciava "Marketing · Ads · Content creation · Media management ·
// SEO · Email / CRM", seis nomes que não existem como produto em lugar nenhum da plataforma.
// Pior: `ProductResultsV2` — o componente que LÊ a fonte e faz do RESULTADO o herói — nem estava
// mais na Home. O sistema estava certo e o cliente via outra coisa.
// Agora o nome do produto vem de `productsForPilar(pilar)`; mudar um produto muda a landing
// sozinha, nos quatro idiomas, sem ninguém traduzir nada.
//
// ── E A RESERVA FOI EMBORA (mesma sessão, 2026-08-11) ──────────────────────────────────────────
// Numa primeira versão eu mantive as listas à mão como RESERVA, argumentando que "o pior caso é a
// lista antiga, não um vazio". Estava errado, e uma varredura no site inteiro mostrou por quê: a
// reserva guardava justamente "Gestão de mídia", "SEO" e "E-mail/CRM" — os três nomes que NÃO
// existem em produto nenhum. Ou seja, o pior caso não era "a lista antiga": era **a mentira
// voltando sozinha** no dia em que a fonte falhasse, sem ninguém notar.
// Reserva plausível é a mesma armadilha do coalesce que transforma erro em zero: some com o
// sintoma e preserva a causa. Agora um pilar sem produto na fonte renderiza VAZIO — alto e óbvio,
// como o preço que quebra o build em vez de publicar um valor fantasma.
// ── A ETIQUETA TEM QUE DIZER O QUE ELE FAZ, NÃO COMO SE CHAMA (2026-08-12) ─────────────────────
// Luis: «os produtos e serviços precisam ficar melhor na landing, está um pouco confuso».
// Estava — e a causa era concreta: sete etiquetas em fila com NOMES INTERNOS e zero significado.
// "Escudo Anti-falta" é um nome que existe para NÓS; o dono de salão não sabe o que é. Sete deles
// viram uma parede: acrescentam comprimento sem acrescentar entendimento, que é a definição de
// confuso. E os três cards ficavam 7 · 4 · 2, fazendo parecer que um pilar importa e dois sobram.
//
// A informação que faltava JÁ ESTAVA na fonte: todo produto carrega um `resultMetric`
// ⚠️ HISTÓRICO: o Brain exibia "+$2k–11k /mês recuperado" (e "+R$10k–55k" no pt). REMOVIDO em
// 2026-08-20: era a ÚNICA perna com cifra, e sem premissa nenhuma. Os irmãos vendem sem número —
// AD diz "mais leads", Build diz "1× build" — e a pesquisa de vendas confirmou que enquadramento
// de valor sem lastro tem efeito quase nulo (r=.03); o que convence é o FATO MEDIDO. O número
// medido de verdade vive no relatório X-Ray de CADA cliente, com a premissa escrita ao lado.
// Se alguém quiser cifra aqui de novo, ela precisa de premissa na mesma linha.
// (histórico: +$2k–11k /mês recuperado · 21× mais conversões · −10–20% faltas). A landing mostrava só o nome
// e escondia o número — mostrando a parte que não vende e escondendo a que vende.
//
// TETO DE 4: acima disso o olho para de ler item e passa a ver "lista". O "+N" mantém a promessa
// honesta (o resto existe) sem transformar o card num inventário — e equilibra os três visualmente,
// que era metade da confusão.
const MAX_CHIPS = 4;
// Rótulo do estado aberto. Fora do dicionário grande de propósito: é a única string que nasceu
// com o botão, e mantê-la colada nele evita que a próxima pessoa mexa num sem lembrar do outro.
const MENOS = { en: "− less", pt: "− menos", es: "− menos", hi: "− कम" };
const produtosDoPilar = (pilar, lang, tudo = false) => {
  const todos = productsForPilar(pilar);
  const itens = (tudo ? todos : todos.slice(0, MAX_CHIPS)).map((p) => {
    const rm = p.resultMetric || {};
    const unidade = (rm.unit && (rm.unit[lang] || rm.unit.en)) || "";
    return {
      nome: (p.name && (p.name[lang] || p.name.en)) || "",
      valor: rm.value || "",
      // a unidade completa vira `title` — quem quiser o detalhe passa o mouse; quem só passa o
      // olho leva o número. Informação em camadas, não tudo gritando junto.
      detalhe: [rm.value, unidade].filter(Boolean).join(" "),
    };
  }).filter((x) => x.nome);
  return { itens, resto: Math.max(0, todos.length - itens.length) };
};

// ⚠️ EXPORTADO (2026-08-18): o Growth Report (/apresentacao/:id) espelha os TRÊS PILARES com as
// MESMAS palavras — Luis: "padrão no nível da landing, com o mesmo design". Reescrever badge,
// "owns" e a linha de cada pilar num segundo arquivo é a armadilha que este arquivo inteiro
// documenta (a lista à mão que divergiu da fonte e passou a prometer serviço inexistente).
// A landing continua sendo a fonte da PALAVRA; o relatório só troca a cor pelo accent do cliente
// e acrescenta os números MEDIDOS daquele negócio embaixo de cada pilar.
export const PILLAR_COPY = {
  en: {
    eyebrow: "Three pillars · one system",
    equipe: {
      eyebrow: "One team · always on",
      h1a: "The whole team you'd hire. ", h1b: "Already working.",
      sub: "Customer service, sales, ads, marketing, content, automations, training and metrics — <b>twelve jobs, three engines, no payroll.</b>",
      fechoA: "Twelve jobs. Three engines. ", fechoB: "One invoice.",
      fechoSub: "The team runs while you work. A human supervises. You keep the only job that was ever yours.",
      resultado: { brain: "Nobody waits", ad: "Nothing is guessed", build: "Built once, runs forever" },
      funcoes: {
        brain: [
          ["📞", "Customer service", "every call & message, 24/7, 16 languages", "gui"],
          ["🤝", "Sales & follow-up", "quotes, closes, collects on the call", "feito"],
          ["📅", "Booking & reminders", "fills the real calendar, kills no-shows", "info"],
          ["🔁", "Win-back", "calls the client who stopped coming", "live"],
        ],
        ad: [
          ["📣", "Ads & marketing", "aimed at people who already called you", "info"],
          ["✍️", "Content creation", "posts, creative and video in your voice", "live"],
          ["⚡", "Automations", "every channel wired into one brain", "feito"],
          ["📊", "Metrics", "what each dollar brought back — by name", "amber"],
        ],
        build: [
          ["🌐", "Site, app & store", "built to book and sell, not to look pretty", "info"],
          ["🔌", "Systems & integrations", "plugs into what you already use", "feito"],
          ["🎓", "Training", "your team taught to run it — free Academy", "amber"],
          ["🛡️", "A human supervises", "real people behind the machine, every day", "gui"],
        ],
      },
    },
    h1a: "Your conversations became ",
    h1b: "your most valuable asset.",
    sub: "Not features — pillars. Each owns a job, delivers a result, and pays for itself.",
    hybrid: "AI every day · a real human team on the craft",
    ai: "AI-run · a human supervises",
    dfy: "Done-for-you by the Guileo team",
    resultLabel: "The result",
    wins: {"brain": ["Every call & message answered", "More bookings, fewer no-shows", "Lapsed clients won back"], "ad": ["More leads, every channel", "More 5-star reviews", "Birthday & win-back reminders"], "build": ["A site that books & sells", "Your own app & online store", "Everything on autopilot"]},
    pillars: [
      { pilar: "brain", badge: "Guileo Brain", icon: "🧠", accent: "#3E9468", owns: "Your performance", line: "The AI employee that runs the front desk — answers every call & message, books, quotes, closes and collects. 24/7, 16 languages.", result: "Every call answered", unit: "· 24/7, no busy signal", tone: "ai" },
      { pilar: "ad", badge: "Guileo AD", icon: "📈", accent: "#D6C29A", owns: "Your growth", line: "Marketing that runs every day so you reach more people, close more deals and waste less ad money.", result: "More leads", unit: "· less wasted ad spend", tone: "hybrid" },
      { pilar: "build", badge: "Guileo Build", icon: "🏗️", accent: "#BE7F35", owns: "Your foundation", line: "The websites, apps, store and software your whole operation runs on — built once, runs forever.", result: "1× build", unit: "· runs forever", tone: "dfy" },
    ],
  },
  pt: {
    eyebrow: "Três pilares · um sistema",
    equipe: {
      eyebrow: "Um time só · sempre de plantão",
      h1a: "O time inteiro que você contrataria. ", h1b: "Já trabalhando.",
      sub: "Atendimento, vendas, anúncios, marketing, conteúdo, automações, treinamento e métricas — <b>doze funções, três motores, zero folha de pagamento.</b>",
      fechoA: "Doze funções. Três motores. ", fechoB: "Uma fatura só.",
      fechoSub: "O time roda enquanto você trabalha. Um humano supervisiona. Você fica só com o trabalho que sempre foi seu.",
      resultado: { brain: "Ninguém espera", ad: "Nada é no chute", build: "Feito uma vez, roda pra sempre" },
      funcoes: {
        brain: [
          ["📞", "Atendimento", "toda ligação e mensagem, 24/7, 16 idiomas", "gui"],
          ["🤝", "Vendas e follow-up", "orça, fecha e cobra na própria ligação", "feito"],
          ["📅", "Agenda e lembretes", "enche a agenda de verdade e mata a falta", "info"],
          ["🔁", "Retorno de cliente", "liga pro cliente que parou de vir", "live"],
        ],
        ad: [
          ["📣", "Anúncios e marketing", "mirados em quem já te ligou", "info"],
          ["✍️", "Criação de conteúdo", "posts, criativo e vídeo na sua voz", "live"],
          ["⚡", "Automações", "todo canal ligado num cérebro só", "feito"],
          ["📊", "Métricas", "quanto cada real trouxe de volta — com nome", "amber"],
        ],
        build: [
          ["🌐", "Site, app e loja", "feito pra agendar e vender, não pra enfeitar", "info"],
          ["🔌", "Sistemas e integrações", "conecta no que você já usa", "feito"],
          ["🎓", "Treinamento", "seu time aprende a operar — Academia grátis", "amber"],
          ["🛡️", "Humano supervisiona", "gente de verdade atrás da máquina, todo dia", "gui"],
        ],
      },
    },
    h1a: "Suas conversas viraram ",
    h1b: "seu ativo mais valioso.",
    sub: "Não são recursos — são pilares. Cada um tem um trabalho, entrega um resultado e se paga.",
    hybrid: "IA todo dia · um time humano na arte",
    ai: "IA opera · um humano supervisiona",
    dfy: "Feito pra você pelo time Guileo",
    resultLabel: "O resultado",
    wins: {"brain": ["Toda ligação e mensagem atendida", "Mais agendamentos, menos faltas", "Clientes sumidos de volta"], "ad": ["Mais leads, em todo canal", "Mais avaliações 5 estrelas", "Lembrete de aniversário e retorno"], "build": ["Um site que agenda e vende", "Seu app e loja online", "Tudo no piloto automático"]},
    pillars: [
      { pilar: "brain", badge: "Guileo Brain", icon: "🧠", accent: "#3E9468", owns: "Sua performance", line: "O funcionário-IA que cuida da recepção — atende toda ligação e mensagem, agenda, orça, fecha e cobra. 24/7, 16 idiomas.", result: "Toda ligação atendida", unit: "· 24/7, sem dar ocupado", tone: "ai" },
      { pilar: "ad", badge: "Guileo AD", icon: "📈", accent: "#D6C29A", owns: "Seu crescimento", line: "Marketing rodando todo dia pra você alcançar mais gente, fechar mais e desperdiçar menos em anúncio.", result: "Mais leads", unit: "· menos verba desperdiçada", tone: "hybrid" },
      { pilar: "build", badge: "Guileo Build", icon: "🏗️", accent: "#BE7F35", owns: "Sua fundação", line: "Os sites, apps, loja e software onde toda a operação roda — construído uma vez, roda pra sempre.", result: "1× build", unit: "· roda pra sempre", tone: "dfy" },
    ],
  },
  es: {
    eyebrow: "Tres pilares · un sistema",
    equipe: {
      eyebrow: "Un solo equipo · siempre activo",
      h1a: "El equipo entero que contratarías. ", h1b: "Ya trabajando.",
      sub: "Atención, ventas, anuncios, marketing, contenido, automatizaciones, formación y métricas — <b>doce funciones, tres motores, cero nómina.</b>",
      fechoA: "Doce funciones. Tres motores. ", fechoB: "Una sola factura.",
      fechoSub: "El equipo trabaja mientras tú trabajas. Un humano supervisa. Te quedas solo con el trabajo que siempre fue tuyo.",
      resultado: { brain: "Nadie espera", ad: "Nada al azar", build: "Hecho una vez, corre siempre" },
      funcoes: {
        brain: [
          ["📞", "Atención al cliente", "cada llamada y mensaje, 24/7, 16 idiomas", "gui"],
          ["🤝", "Ventas y seguimiento", "cotiza, cierra y cobra en la misma llamada", "feito"],
          ["📅", "Agenda y recordatorios", "llena el calendario real y mata la ausencia", "info"],
          ["🔁", "Recuperación de clientes", "llama al cliente que dejó de venir", "live"],
        ],
        ad: [
          ["📣", "Anuncios y marketing", "apuntados a quien ya te llamó", "info"],
          ["✍️", "Creación de contenido", "posts, creativos y video con tu voz", "live"],
          ["⚡", "Automatizaciones", "cada canal conectado a un solo cerebro", "feito"],
          ["📊", "Métricas", "cuánto devolvió cada dólar — con nombre", "amber"],
        ],
        build: [
          ["🌐", "Sitio, app y tienda", "hecho para agendar y vender, no para adornar", "info"],
          ["🔌", "Sistemas e integraciones", "se conecta con lo que ya usas", "feito"],
          ["🎓", "Formación", "tu equipo aprende a operarlo — Academia gratis", "amber"],
          ["🛡️", "Un humano supervisa", "personas reales detrás de la máquina, cada día", "gui"],
        ],
      },
    },
    h1a: "Tus conversaciones se volvieron ",
    h1b: "tu activo más valioso.",
    sub: "No son funciones — son pilares. Cada uno tiene un trabajo, entrega un resultado y se paga solo.",
    hybrid: "IA cada día · un equipo humano en el arte",
    ai: "IA opera · un humano supervisa",
    dfy: "Hecho para ti por el equipo Guileo",
    resultLabel: "El resultado",
    wins: {"brain": ["Cada llamada y mensaje atendido", "Más reservas, menos ausencias", "Clientes perdidos recuperados"], "ad": ["Más leads, en todo canal", "Más reseñas 5 estrellas", "Recordatorio de cumpleaños y retorno"], "build": ["Un sitio que agenda y vende", "Tu app y tienda online", "Todo en piloto automático"]},
    pillars: [
      { pilar: "brain", badge: "Guileo Brain", icon: "🧠", accent: "#3E9468", owns: "Tu performance", line: "El empleado-IA que atiende la recepción — contesta cada llamada y mensaje, agenda, cotiza, cierra y cobra. 24/7, 16 idiomas.", result: "Cada llamada atendida", unit: "· 24/7, sin dar ocupado", tone: "ai" },
      { pilar: "ad", badge: "Guileo AD", icon: "📈", accent: "#D6C29A", owns: "Tu crecimiento", line: "Marketing corriendo cada día para llegar a más gente, cerrar más y desperdiciar menos en anuncios.", result: "Más leads", unit: "· menos gasto perdido", tone: "hybrid" },
      { pilar: "build", badge: "Guileo Build", icon: "🏗️", accent: "#BE7F35", owns: "Tu base", line: "Las webs, apps, tienda y software donde corre toda tu operación — construido una vez, corre siempre.", result: "1× build", unit: "· corre siempre", tone: "dfy" },
    ],
  },
  hi: {
    eyebrow: "तीन स्तंभ · एक सिस्टम",
    equipe: {
      eyebrow: "एक ही टीम · हमेशा तैनात",
      h1a: "पूरी टीम जिसे आप रखते। ", h1b: "पहले से काम पर।",
      sub: "ग्राहक सेवा, बिक्री, विज्ञापन, मार्केटिंग, कॉन्टेंट, ऑटोमेशन, ट्रेनिंग और मेट्रिक्स — <b>बारह काम, तीन इंजन, कोई पेरोल नहीं।</b>",
      fechoA: "बारह काम। तीन इंजन। ", fechoB: "एक ही बिल।",
      fechoSub: "आपके काम करते हुए टीम चलती रहती है। एक इंसान निगरानी करता है। आपके पास वही काम बचता है जो हमेशा आपका था।",
      resultado: { brain: "कोई इंतज़ार नहीं", ad: "कुछ भी अंदाज़े पर नहीं", build: "एक बार बना, हमेशा चले" },
      funcoes: {
        brain: [
          ["📞", "ग्राहक सेवा", "हर कॉल और मैसेज, 24/7, 16 भाषाएँ", "gui"],
          ["🤝", "बिक्री और फ़ॉलो-अप", "भाव देती है, सौदा बंद करती है, कॉल पर वसूलती है", "feito"],
          ["📅", "बुकिंग और रिमाइंडर", "असली कैलेंडर भरती है, ग़ैरहाज़िरी ख़त्म", "info"],
          ["🔁", "वापसी", "उस ग्राहक को कॉल जो आना बंद कर चुका", "live"],
        ],
        ad: [
          ["📣", "विज्ञापन और मार्केटिंग", "उन्हीं पर लक्षित जिन्होंने आपको कॉल किया", "info"],
          ["✍️", "कॉन्टेंट निर्माण", "पोस्ट, क्रिएटिव और वीडियो — आपकी आवाज़ में", "live"],
          ["⚡", "ऑटोमेशन", "हर चैनल एक ही दिमाग़ से जुड़ा", "feito"],
          ["📊", "मेट्रिक्स", "हर रुपया कितना लौटाया — नाम के साथ", "amber"],
        ],
        build: [
          ["🌐", "साइट, ऐप और स्टोर", "बुकिंग और बिक्री के लिए बना, सजावट के लिए नहीं", "info"],
          ["🔌", "सिस्टम और इंटीग्रेशन", "जो आप पहले से इस्तेमाल करते हैं उससे जुड़ता है", "feito"],
          ["🎓", "ट्रेनिंग", "आपकी टीम चलाना सीखती है — मुफ़्त Academy", "amber"],
          ["🛡️", "इंसान निगरानी करता है", "मशीन के पीछे असली लोग, हर दिन", "gui"],
        ],
      },
    },
    h1a: "आपकी बातचीत बन गई ",
    h1b: "आपकी सबसे मूल्यवान संपत्ति।",
    sub: "फ़ीचर नहीं — स्तंभ। हर एक का एक काम, एक नतीजा, और खुद की कीमत निकालता है।",
    hybrid: "रोज़ AI · कारीगरी पर असली मानव टीम",
    ai: "AI चलाता है · मानव निगरानी करता है",
    dfy: "Guileo टीम आपके लिए बनाती है",
    resultLabel: "नतीजा",
    wins: {"brain": ["हर कॉल और मैसेज का जवाब", "ज़्यादा बुकिंग, कम ग़ैरहाज़िरी", "खोए ग्राहक वापस"], "ad": ["हर चैनल पर ज़्यादा लीड", "ज़्यादा 5-स्टार रिव्यू", "जन्मदिन और वापसी रिमाइंडर"], "build": ["साइट जो बुक और बिक्री करे", "आपका ऐप और ऑनलाइन स्टोर", "सब कुछ ऑटोपायलट पर"]},
    pillars: [
      { pilar: "brain", badge: "Guileo Brain", icon: "🧠", accent: "#3E9468", owns: "आपकी परफ़ॉर्मेंस", line: "AI कर्मचारी जो रिसेप्शन संभालता है — हर कॉल और मैसेज का जवाब, बुकिंग, कोटेशन, डील बंद और वसूली। 24/7, 16 भाषाएँ।", result: "हर कॉल का जवाब", unit: "· 24/7, कभी बिज़ी नहीं", tone: "ai" },
      { pilar: "ad", badge: "Guileo AD", icon: "📈", accent: "#D6C29A", owns: "आपकी ग्रोथ", line: "मार्केटिंग जो हर दिन चलती है — ज़्यादा लोगों तक पहुँच, ज़्यादा डील, कम विज्ञापन बर्बादी।", result: "ज़्यादा लीड", unit: "· कम बर्बादी", tone: "hybrid" },
      { pilar: "build", badge: "Guileo Build", icon: "🏗️", accent: "#BE7F35", owns: "आपकी नींव", line: "वेबसाइट, ऐप, स्टोर और सॉफ़्टवेयर जिन पर पूरा ऑपरेशन चलता है — एक बार बनता है, हमेशा चलता है।", result: "1× बिल्ड", unit: "· हमेशा चलता है", tone: "dfy" },
    ],
  },
};

// ── OS SINAIS (paleta neon-realista oficial) ────────────────────────────────────────────────
// Cada função carrega um sinal com SIGNIFICADO, não uma cor bonita em rodízio. Ciclar cores por
// ordem vira arco-íris; aqui 🟠 é a Gui agindo, 🟢 é fechado/feito, 🔵 é informação, 🌸 é o que
// acontece sozinho ao vivo, 🟡 é o que cobra você (a métrica). Fonte: signal palette 2026-06-18.
const SINAL = {
  gui:   "255,138,51",    // a Gui operando
  feito: "47,227,154",    // fechado / ganho
  info:  "63,180,255",    // informação
  live:  "255,61,139",    // acontece agora, sozinho
  amber: "255,194,61",    // atenção — precisa de você
};

const hexToRgb = (hex) => {
  const h = (hex || "#FF8A33").replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

export default function PillarsProducts() {
  const { lang } = useLang();
  const t = PILLAR_COPY[lang] || PILLAR_COPY.en;
  const e = t.equipe || PILLAR_COPY.en.equipe;   // reserva SEMPRE inglês, nunca o idioma do autor
  // Qual pilar está aberto (um por vez). Um-por-vez e não vários: com dois cards expandidos as
  // alturas divergem e a fileira perde o alinhamento do bloco 'O RESULTADO', que é o que ancora
  // a leitura horizontal dos três.
  const [aberto, setAberto] = useState(null);
  const toneLabel = (tone) => (tone === "hybrid" ? t.hybrid : tone === "dfy" ? t.dfy : t.ai);

  return (
    <section className="relative overflow-hidden px-5 py-20">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(760px_380px_at_20%_-5%,rgba(255,138,51,0.07),transparent),radial-gradient(760px_380px_at_85%_105%,rgba(154,160,255,0.07),transparent)]" />
      <div className="mx-auto max-w-6xl">
        {/* ═══ CABEÇALHO ═══════════════════════════════════════════════════════════════════
            Luis (2026-08-25) aprovou virar esta seção de CATÁLOGO em TIME: o dono de negócio local
            não compara a Guileo com outro software, compara com CONTRATAR — ele já pediu esses
            orçamentos e já disse não. Por isso a seção lista as VAGAS que ele não vai abrir, e
            Brain·AD·Build passam a ser a resposta de QUEM executa cada uma.
            ⚠️ O título antigo ("Suas conversas viraram seu ativo mais valioso") continua vivo em
            `t.h1a`/`t.h1b` nos 4 idiomas — não foi apagado. Para voltar, troque `e.h1a/e.h1b` por
            `t.h1a/t.h1b` aqui embaixo e nada mais. */}
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="font-mono text-[11.5px] font-bold uppercase tracking-[0.28em] text-g-gold">◆ {e.eyebrow}</div>
          <h2 className="mt-4 font-black leading-[1.04] tracking-tight text-g-word" style={{ fontSize: "clamp(2rem,4.2vw,3rem)" }}>
            {e.h1a}
            <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "prshine 6s linear infinite" }}>{e.h1b}</span>
          </h2>
          <p className="mx-auto mt-5 max-w-[56ch] text-[15.5px] leading-relaxed text-g-ink"
            dangerouslySetInnerHTML={{ __html: e.sub }} />
        </Reveal>

        <style>{`
          @keyframes prshine{to{background-position:220% center}}
          @keyframes pwin{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
          @keyframes psinal{0%,100%{transform:scale(.85);filter:brightness(.85)}50%{transform:scale(1.15);filter:brightness(1.35)}}
        `}</style>

        {/* ═══ OS TRÊS MOTORES ═════════════════════════════════════════════════════════════
            Cada painel: barra colorida no cabeçalho (a receita de ÊNFASE que o Luis aprovou —
            saturada, nunca sutil, porque brilho de 6% ele não enxerga), orbe com halo, e cada
            função num CARTÃO próprio que levanta ao passar o mouse: linha de lista lê como
            catálogo, cartão com relevo lê como objeto. O resultado fecha centralizado. */}
        <Stagger className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-3" gap={0.1}>
          {t.pillars.map((p) => {
            const rgb = hexToRgb(p.accent);
            const fns = e.funcoes?.[p.pilar] || [];
            return (
              <Item key={p.badge} variant="up">
                <article className="relative flex h-full flex-col overflow-hidden rounded-[20px] border border-white/10 backdrop-blur-sm"
                  style={{
                    background: `linear-gradient(180deg, rgba(${rgb},0.16), rgba(28,26,22,0.62) 44%, rgba(22,21,18,0.93))`,
                    // ⛔ SEM boxShadow AQUI (2026-08-25). Sombra inline VENCE a regra global do
                    // index.css (`:where()` tem especificidade zero), e era assim que cada seção
                    // acabava com a sua própria sombra — o oposto de uniformizar. O `backdrop-blur-sm`
                    // na classe é o que matricula o cartão no sistema 4K: verniz diagonal, aro claro
                    // em cima, aro escuro embaixo, sombra de contato + sombra de ambiente.
                  }}>
                  {/* barra + orbe: o halo do orbe só tem volume porque a barra tingida dá o fundo */}
                  <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3.5"
                    style={{ background: `rgba(${rgb},0.18)` }}>
                    <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[14px] border border-white/[0.14] text-[20px]"
                      style={{ background: `rgba(${rgb},0.24)`, boxShadow: `0 0 24px rgba(${rgb},0.4), inset 0 1px 0 rgba(255,255,255,0.16)` }}>{p.icon}</span>
                    <div>
                      <div className="text-[17px] font-black leading-none tracking-tight text-g-word">{p.badge}</div>
                      <div className="mt-[3px] font-mono text-[9.5px] font-bold uppercase tracking-[0.16em]" style={{ color: p.accent }}>{p.owns}</div>
                    </div>
                  </div>

                  <div className="grid flex-1 gap-2 px-3 pb-1 pt-3">
                    {fns.map(([ico, nome, desc, sig], fi) => (
                      <div key={fi}
                        className="flex items-center gap-2.5 rounded-[13px] border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 transition-[transform,background,border-color] duration-[250ms] hover:-translate-y-0.5 hover:border-white/[0.15] hover:bg-white/[0.06]"
                        style={{ animation: `pwin .6s cubic-bezier(.2,.7,.2,1) ${0.15 + fi * 0.1}s both` }}>
                        <span aria-hidden="true" className="w-[21px] shrink-0 text-center text-[17px]">{ico}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold leading-snug text-g-word">{nome}</p>
                          <p className="mt-[3px] text-[12px] leading-snug text-g-muted">{desc}</p>
                        </div>
                        <span aria-hidden="true" className="h-[9px] w-[9px] shrink-0 rounded-full"
                          style={{
                            background: `rgb(${SINAL[sig] || SINAL.gui})`,
                            boxShadow: `0 0 10px rgba(${SINAL[sig] || SINAL.gui},0.9), 0 0 22px rgba(${SINAL[sig] || SINAL.gui},0.45)`,
                            animation: `psinal 2.6s ease-in-out ${fi * 0.35}s infinite`,
                          }} />
                      </div>
                    ))}
                  </div>

                  {/* o resultado — centralizado, alinhado entre os três porque o corpo é flex-1 */}
                  <div className="mx-3 mb-4 mt-3 rounded-[14px] border border-white/[0.09] px-3.5 py-3.5 text-center"
                    style={{ background: "rgba(0,0,0,0.34)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}>
                    <div className="mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-g-muted">{t.resultLabel}</div>
                    {/* MAIÚSCULA (Luis, 2026-08-25). O tracking sobe junto: caixa-alta sem folga
                        entre letras fecha a palavra e perde legibilidade — quanto maior o peso,
                        mais respiro ela pede. No hindi o uppercase é inócuo (devanágari não tem
                        caixa), então a mesma regra serve aos 4 idiomas sem exceção. */}
                    <div className="text-[17px] font-black uppercase leading-tight tracking-[0.04em]"
                      style={{ color: p.accent, textShadow: `0 4px 22px rgba(${rgb},0.35)` }}>{e.resultado?.[p.pilar]}</div>
                  </div>
                </article>
              </Item>
            );
          })}
        </Stagger>

        {/* o fecho — a conta que o dono faz sozinho: doze vagas contra uma fatura */}
        <Reveal className="mx-auto mt-9 max-w-[760px] rounded-[18px] border border-white/10 px-7 py-6 text-center"
          style={{ background: "rgba(0,0,0,0.3)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}>
          <p className="text-[21px] font-extrabold leading-snug tracking-tight text-g-word">
            {e.fechoA}
            <span className="bg-gradient-to-r from-g-green to-g-gold bg-clip-text text-transparent">{e.fechoB}</span>
          </p>
          <p className="mt-2 text-[13px] text-g-muted">{e.fechoSub}</p>
        </Reveal>
      </div>
    </section>
  );
}
