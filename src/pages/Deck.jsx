import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useSeo } from "../lib/seo.js";
import { MASTER_SENTENCE, OBJECTION_KILLERS, PRICING } from "../data/salesKit.js";
import { useLang } from "../i18n.jsx";
import { NOME_DO_PAINEL } from "../portal/nome.js";

// Collaborator deck — narrative hangs on the ONE master sentence (src/data/salesKit.js):
// problem (missed calls = lost money) → THE SENTENCE → how it works (3 steps) →
// business model (2 tracks + commission) → the ask. ←/→ keys, notes, grid overview.
// Quadrilingual EN·PT·ES·HI via useLang() — PT copy preserved verbatim; HI uses
// Hindi tags/titles/chrome with EN bodies (permitted long-tail fallback).
const logo = new URL("../assets/guileo-mark.png", import.meta.url).href;

const LANGS = [["en", "🇺🇸"], ["pt", "🇧🇷"], ["es", "🇪🇸"], ["hi", "🇮🇳"]];
const LANG_NAMES = { en: "English", pt: "Português", es: "Español", hi: "हिन्दी" };

const dfy = PRICING.doneForYou;
const [starter, growth, scale] = PRICING.selfServe;
const dfyContract = dfy.setup + dfy.monthly * 3; // setup + 3 months
const dfyComm = Math.round(dfyContract * 0.2);
const growthComm = Math.round(growth.price * 3 * 0.2);

// ── Chrome (page furniture) per language ────────────────────────────────────
export const UI = {
  seoTitle: { en: "Collaborator Deck · Guileo", pt: "Deck do Colaborador · Guileo", es: "Deck del Colaborador · Guileo", hi: "सहयोगी डेक · Guileo" },
  seoDesc: {
    en: "The kit to refer, sell and earn commission with Guileo — no tech skills needed. The sentence, the demo, the 2 tracks, the 5 questions, the objections and the 15-minute script.",
    pt: "O kit pra indicar, vender e ganhar comissão com a Guileo — sem ser técnico. A frase, a demo, os 2 trilhos, as 5 perguntas, as objeções e o roteiro de 15 minutos.",
    es: "El kit para referir, vender y ganar comisión con Guileo — sin ser técnico. La frase, la demo, los 2 rieles, las 5 preguntas, las objeciones y el guion de 15 minutos.",
    hi: "Guileo के साथ रेफ़र करने, बेचने और कमीशन कमाने की किट — बिना तकनीकी ज्ञान के।",
  },
  deckName: { en: "Collaborator Deck", pt: "Deck do Colaborador", es: "Deck del Colaborador", hi: "सहयोगी डेक" },
  all: { en: "▦ All", pt: "▦ Todos", es: "▦ Todos", hi: "▦ सभी" },
  notes: { en: "🎤 Notes", pt: "🎤 Notas", es: "🎤 Notas", hi: "🎤 नोट्स" },
  academy: { en: "Academy →", pt: "Academia →", es: "Academia →", hi: "Academy →" },
  presenterNote: { en: "🎤 Presenter note", pt: "🎤 Nota do apresentador", es: "🎤 Nota del presentador", hi: "🎤 प्रस्तुतकर्ता नोट" },
  prev: { en: "← Previous", pt: "← Anterior", es: "← Anterior", hi: "← पिछला" },
  next: { en: "Next →", pt: "Próximo →", es: "Siguiente →", hi: "अगला →" },
  slideWord: { en: "Slide", pt: "Slide", es: "Diapositiva", hi: "स्लाइड" },
};

// ── Slides, per language — PT is the original copy, untouched ───────────────
const SLIDES_PT = [
  { tag: "Capa", title: "Guileo", sub: "Um funcionário de IA que atende, vende e cobra por um negócio — 24/7.",
    body: [["p", "Você não vende tecnologia. Você devolve dinheiro e tempo pra donos de negócio."]],
    note: "Abertura. Não explique nada ainda. Diga só: \"Em 12 minutos você vai saber tudo o que precisa pra indicar a Guileo e ganhar com isso. E o melhor: a própria IA faz a venda — você só abre a porta.\" Sorria. Vira o slide." },
  { tag: "Problema", title: "O dinheiro está vazando",
    body: [["p", "Todo dia, no negócio do seu cliente:"], ["ul", ["Liga no almoço → ninguém atende → cliente liga pro concorrente.", "Manda WhatsApp 21h → responde no outro dia → lead frio.", "Pede orçamento → some → ninguém ligou de volta.", "Cliente antigo não volta → porque ninguém chamou."]], ["hi", "Cada ligação perdida vale uns $50–$100. Faça a conta do mês."]],
    note: "Pinte a dor ANTES da frase. O dono SENTE isso todo dia mas nunca somou. Sua frase mágica: \"Quanto você acha que isso vira por mês?\" Deixa ele fazer a conta na cabeça. O silêncio dele é a venda começando." },
  { tag: "A frase", title: "A espinha de tudo",
    body: [["quote", MASTER_SENTENCE.pt], ["p", "Se você esquecer todo o resto, lembra DESSA frase."]],
    note: "Leia a frase em voz alta, devagar. Toda objeção, todo email, toda reunião volta pra cá. \"COBRA por você\" — esse é o coração: ela não só atende, ela fecha e recebe o pagamento na ligação. E \"menos que um dia de garçom\" mata a objeção de preço antes de nascer." },
  { tag: "Como funciona", title: "Como funciona (3 passos)",
    body: [["ol", ["Você abre a porta: 15 minutos e a Gui liga pro celular do dono, ao vivo.", "Ele paga no Stripe → a Gui dele nasce sozinha, em minutos, já treinada no negócio dele.", "Ela atende, agenda, vende e COBRA 24/7 — e ele vê tudo no painel em tempo real."]], ["hi", "Sem instalação, sem projeto de meses. Pagou, nasceu, atendeu."]],
    note: "Três passos, sem tecniquês. O ponto que ninguém acredita (e por isso vende): a Gui nasce SOZINHA depois do pagamento. Não tem \"projeto de implantação\". É a demo → o pagamento → o funcionário no ar." },
  { tag: "Mindset", title: "A verdade sobre vender isso",
    body: [["ul", ["Negócio nenhum compra \"ferramenta\". Compra RESULTADO.", "Lidere pelo resultado: mais agendamentos, lead recuperado, tempo de volta, dinheiro que para de vazar.", "Preço pelo tamanho do problema, não pelo custo da ferramenta.", "A prova não é PowerPoint. A prova é a demo ao vivo: a Gui liga pro celular do cara na hora."]]],
    note: "Esse é o slide que muda sua cabeça. Pare de falar \"inteligência artificial\", \"automação\", \"tecnologia\". Fale \"você está perdendo X por mês e eu paro esse vazamento\". Quem vende resultado nunca briga por preço." },
  { tag: "O produto", title: "O que a Guileo faz",
    body: [["ul", ["Atende toda ligação e mensagem, 24/7.", "Missed-call text-back: perdeu a ligação? manda texto na hora.", "Speed-to-Lead: liga pro lead novo em ~60 segundos.", "Agendamento + lembretes que cortam no-show — com sinal pago pra reservar.", "COBRA na ligação: fechou, manda o link de pagamento por SMS ali mesmo.", "Reativação / win-back de quem sumiu.", "Máquina de reviews (mais avaliações 5 estrelas).", "Tudo trilíngue EN / PT / ES — ouro no mercado imigrante."]]],
    note: "Não liste tudo de uma vez na reunião real — escolha os 2-3 que batem na dor DELE. Aqui é pra VOCÊ saber o arsenal. O \"cobra na ligação\" e o trilíngue são os diferenciais que nenhum concorrente tem." },
  { tag: "Prova", title: `A ${NOME_DO_PAINEL}`,
    body: [["ul", [`O painel da Guileo = a "${NOME_DO_PAINEL}" (~30 telas).`, "O dono vê as ligações atendidas, leads recuperados, agendamentos, reviews — em tempo real.", "Não é \"confia em mim\". É \"olha aqui funcionando\"."]]],
    note: `Donos desconfiam de IA porque parece caixa-preta. A ${NOME_DO_PAINEL} resolve: ele vê o trabalho acontecendo. Na demo, mostre a tela ligada à dor dele.` },
  { tag: "A arma", title: "A demo é a sua arma",
    body: [["ul", ["Você não explica a Gui. Você deixa ela se apresentar.", "No meio da reunião: a Gui liga pro celular do prospect.", "Você fica em silêncio e deixa ele ouvir.", "Vende sozinho. Sempre."]], ["hi", "guileoai.com → o visitante coloca o telefone e a Gui liga na hora."]],
    note: "Essa é a jogada que separa a Guileo de qualquer concorrente. Treine UMA coisa: ficar quieto enquanto a Gui fala. Sua boca fechada é seu melhor argumento." },
  { tag: "Modelo", title: "Os 2 trilhos + sua comissão",
    body: [["h", "Trilho A — Self-service (começar simples)"], ["ul", [`Essential $${starter.price} / Personalized $${growth.price} / Full Operation $${scale.price} por mês (créditos inclusos).`, "Sua comissão: RECORRENTE — 10% a 20% da mensalidade, todo mês, enquanto o cliente pagar."]], ["h", "Trilho B — Done-for-you (negócio que perde dinheiro real)"], ["ul", ["SEM preço de tabela: a proposta é cotada depois de estudar o negócio (guia interno típico: setup + $1.5k–3k/mês).", "Sua comissão: 20% RECORRENTE da mensalidade (+ 20% do setup, uma vez)."]]],
    note: "Dois trilhos = você atende qualquer negócio. O pequeno entra pelo A. O grande, que sangra dinheiro, vai pro B — e é ali que sua comissão fica gorda." },
  { tag: "$$$", title: "Quanto você ganha",
    body: [["h", `Trilho A — Personalized $${growth.price}/mês (o mais vendido)`], ["ul", [`Closer (20%): $${Math.round(growth.price * 0.2)}/mês POR cliente, todo mês, enquanto ele pagar.`, `10 clientes na carteira = ~$${Math.round(growth.price * 0.2 * 10).toLocaleString("en-US")}/mês recorrentes.`]], ["h", "Trilho B — sob medida (cotado por negócio)"], ["ul", ["Ex: retainer de $1.500/mês → $300/mês pra você, todo mês.", "Mais 20% do setup, uma vez."]], ["hi", "Regra de bolso: reclama de ligação perdida + fatura > $20k/mês → Trilho B. Resto → Trilho A. Na dúvida, agenda a demo."]],
    note: "Não force trilho. Deixa o tamanho do problema escolher. Clínica cheia que perde 10 ligações/dia é Trilho B. Barbearia começando é Trilho A. A demo resolve a dúvida." },
  { tag: "Descoberta", title: "As 5 perguntas de ouro",
    body: [["p", "Faça essas 5 e deixe ELE falar:"], ["ol", ["Quantas ligações vocês perdem por dia — almoço, noite, domingo?", "Quem responde o WhatsApp quando vocês fecham?", "O que acontece com quem pede orçamento e some?", "Quantos clientes deixam de voltar porque ninguém chamou de volta?", "Se cada ligação perdida vale uns $50–100… quanto vaza por mês?"]]],
    note: "Essas 5 perguntas fazem o dono se vender sozinho. Você não acusa, você pergunta. A pergunta 5 é a chave: ele faz a conta e o problema vira número." },
  { tag: "Objeções", title: "As 8 objeções (resposta de 1 linha)",
    body: [["dl", OBJECTION_KILLERS.map((o) => [o.q.pt, o.short.pt])]],
    note: "Toda objeção termina na demo ou na garantia. Decore o padrão, não as frases: concorde (\"claro\", \"entendo\") e redirecione. As respostas completas, de 2-3 frases pra ler em voz alta, estão no /roteiro e no Hub do Vendedor." },
  { tag: "Roteiro", title: "O roteiro de 15 minutos",
    body: [["dl", [["0–3 min", "Quebra-gelo + as 5 perguntas. Deixa ELE falar."], ["3–5 min", "A frase + \"deixa eu te mostrar em vez de explicar\"."], ["5–9 min", "A DEMO: a Gui liga pro celular dele. Silêncio. Deixa ouvir. Vende sozinho."], ["9–12 min", `Mostra a ${NOME_DO_PAINEL} ligada à dor dele.`], ["12–15 min", "Próximo passo: proposta + garantia 30 dias, no ar em 7 dias."]]]],
    note: "15 minutos basta porque a demo carrega o peso. Não enrole. Quanto menos você fala depois da demo, mais rápido fecha. Marque a próxima etapa ANTES de sair." },
  { tag: "Ética", title: "A regra da venda honesta",
    body: [["h", "NUNCA prometa:"], ["ul", ["Que a IA não erra.", "Resultado exato em $.", "Prazo menor que 7 dias.", "Algo fora do pacote."]], ["hi", "SEMPRE ofereça: garantia de 30 dias."]],
    note: "Honestidade vende mais e protege seu nome. \"A Gui erra às vezes — por isso tem humano supervisionando e 30 dias de garantia.\" Isso constrói confiança, não destrói." },
  { tag: "Ação", title: "Como começar hoje",
    body: [["p", "Comece pela sua rede. Pense em 5 donos de negócio que você conhece:"], ["ol", ["___________ (restaurante / lanchonete?)", "___________ (clínica / dentista / estética?)", "___________ (barbearia / salão?)", "___________ (imobiliária / corretor?)", "___________ (serviço — encanador, mecânico, advogado?)"]], ["hi", "Manda a 1ª mensagem (tem modelo no kit) → marca 15 min → deixa a Gui ligar."]],
    note: "A venda mais fácil é pra quem já confia em você. Não comece com estranhos. Comece com os 5 nomes que vêm na cabeça AGORA." },
  { tag: "FAQ", title: "FAQ do parceiro",
    body: [["dl", [["Preciso entender de tecnologia?", "Não. Você abre a porta, a demo vende, a Guileo instala."], ["E se perguntarem algo técnico que não sei?", "\"Ótima pergunta — quem instala te explica certinho na proposta.\" Nunca invente."], ["Quando recebo a comissão?", "Sobre as mensalidades pagas (A: 3 primeiras; B: setup + 3 meses)."], ["E se o cliente cancelar?", "Tem garantia de 30 dias. Por isso a demo importa: quem entra sabendo, fica."], ["Posso indicar qualquer negócio?", "Sim, mas mira em quem perde ligação e tem movimento. Esses fecham."], ["Quem dá suporte depois?", "A Guileo. Você indica e ganha; instalação e suporte são nossos."]]]],
    note: "Esse slide tira o medo. O colaborador não precisa ser técnico, não precisa dar suporte, não precisa prometer nada. Só 5 nomes e coragem de mandar a 1ª mensagem." },
  { tag: "Fechamento", title: "Você escolhe os clientes. A Gui faz a venda. A Guileo entrega.",
    body: [["p", "Seu próximo passo: escolha 1 nome da sua lista e mande a mensagem hoje."], ["big", "guileoai.com"]],
    note: "Termine com ação, não com aplauso. \"Não saia daqui com a lista vazia. Um nome. Uma mensagem. Hoje.\" Aperte a mão e mande pra rua." },
];

const SLIDES_EN = [
  { tag: "Cover", title: "Guileo", sub: "An AI employee that answers, sells and collects for a business — 24/7.",
    body: [["p", "You don't sell technology. You give business owners their money and time back."]],
    note: "Opening. Don't explain anything yet. Just say: \"In 12 minutes you'll know everything you need to refer Guileo and earn from it. Best part: the AI itself makes the sale — you just open the door.\" Smile. Next slide." },
  { tag: "Problem", title: "The money is leaking",
    body: [["p", "Every day, in your client's business:"], ["ul", ["Calls at lunch → nobody answers → customer calls the competitor.", "WhatsApp at 9pm → answered the next day → cold lead.", "Asks for a quote → disappears → nobody called back.", "Old customer doesn't return → because nobody reached out."]], ["hi", "Every missed call is worth about $50–$100. Do the monthly math."]],
    note: "Paint the pain BEFORE the sentence. The owner FEELS this every day but never added it up. Your magic question: \"What do you think that adds up to per month?\" Let him do the math in his head. His silence is the sale starting." },
  { tag: "The sentence", title: "The spine of everything",
    body: [["quote", MASTER_SENTENCE.en], ["p", "If you forget everything else, remember THIS sentence."]],
    note: "Read the sentence out loud, slowly. Every objection, every email, every meeting comes back here. \"COLLECTS for you\" — that's the heart: she doesn't just answer, she closes and takes the payment on the call. And \"less than a day of one waiter's pay\" kills the price objection before it's born." },
  { tag: "How it works", title: "How it works (3 steps)",
    body: [["ol", ["You open the door: 15 minutes and Gui calls the owner's phone, live.", "He pays on Stripe → his Gui is born on her own, in minutes, already trained on his business.", "She answers, books, sells and COLLECTS 24/7 — and he sees everything on the dashboard in real time."]], ["hi", "No installation, no months-long project. Paid, born, answering."]],
    note: "Three steps, no tech-speak. The point nobody believes (and that's why it sells): Gui is born ON HER OWN after payment. There's no \"implementation project\". It's the demo → the payment → the employee live." },
  { tag: "Mindset", title: "The truth about selling this",
    body: [["ul", ["No business buys a \"tool\". They buy RESULTS.", "Lead with the result: more bookings, recovered leads, time back, money that stops leaking.", "Price by the size of the problem, not the cost of the tool.", "The proof isn't PowerPoint. The proof is the live demo: Gui calls the guy's phone on the spot."]]],
    note: "This is the slide that changes your head. Stop saying \"artificial intelligence\", \"automation\", \"technology\". Say \"you're losing X per month and I stop that leak\". Whoever sells results never fights over price." },
  { tag: "The product", title: "What Guileo does",
    body: [["ul", ["Answers every call and message, 24/7.", "Missed-call text-back: missed the call? sends a text instantly.", "Speed-to-Lead: calls a new lead in ~60 seconds.", "Booking + reminders that cut no-shows — with a paid deposit to reserve.", "COLLECTS on the call: deal closed, sends the payment link by SMS right there.", "Reactivation / win-back of customers who vanished.", "Review machine (more 5-star ratings).", "Speaks 16 languages on the call (EN/ES/PT-BR/中文/русский/한국어/Tiếng Việt/العربية…) — gold in the immigrant market."]]],
    note: "Don't list everything at once in the real meeting — pick the 2-3 that hit HIS pain. This is for YOU to know the arsenal. \"Collects on the call\" and the 20-language bit are the differentiators no competitor has." },
  { tag: "Proof", title: `The ${NOME_DO_PAINEL}`,
    body: [["ul", [`Guileo's dashboard = the "${NOME_DO_PAINEL}" (~30 screens).`, "The owner sees calls answered, leads recovered, bookings, reviews — in real time.", "It's not \"trust me\". It's \"look at it working\"."]]],
    note: `Owners distrust AI because it feels like a black box. The ${NOME_DO_PAINEL} fixes that: he sees the work happening. In the demo, show the screen tied to his pain.` },
  { tag: "The weapon", title: "The demo is your weapon",
    body: [["ul", ["You don't explain Gui. You let her introduce herself.", "Mid-meeting: Gui calls the prospect's phone.", "You stay silent and let him listen.", "It sells itself. Every time."]], ["hi", "guileoai.com → the visitor enters their phone and Gui calls right away."]],
    note: "This is the play that separates Guileo from any competitor. Train ONE thing: staying quiet while Gui talks. Your closed mouth is your best argument." },
  { tag: "Model", title: "The 2 tracks + your commission",
    body: [["h", "Track A — Self-service (start simple)"], ["ul", [`Essential $${starter.price} / Personalized $${growth.price} / Full Operation $${scale.price} per month (credits included).`, "Your commission: 20% of the first 3 monthly payments."]], ["h", "Track B — Done-for-you (business losing real money)"], ["ul", [`From $${dfy.setup} setup + $${dfy.monthly.toLocaleString("en-US")}+/mo.`, `Your commission: 20% of the contract (setup + 3 months) ≈ ~$${dfyComm.toLocaleString("en-US")} per sale.`]]],
    note: "Two tracks = you serve any business. The small one enters through A. The big one, bleeding money, goes to B — and that's where your commission gets fat." },
  { tag: "$$$", title: "How much you earn",
    body: [["h", `Track A — Growth $${growth.price}/mo`], ["ul", [`20% × 3 months = 20% × $${(growth.price * 3).toLocaleString("en-US")} = ~$${growthComm} per sale.`, `Closed 5 in a month? ~$${(growthComm * 5).toLocaleString("en-US")}.`]], ["h", `Track B — setup $${dfy.setup} + $${dfy.monthly.toLocaleString("en-US")}/mo`], ["ul", [`Contract (setup + 3 months) = $${dfyContract.toLocaleString("en-US")}.`, `20% = ~$${dfyComm.toLocaleString("en-US")} per sale.`, `Closed 2 in a month? ~$${(dfyComm * 2).toLocaleString("en-US")}.`]], ["hi", "Rule of thumb: complains about missed calls + revenue > $20k/mo → Track B. Everyone else → Track A. In doubt, book the demo."]],
    note: "Don't force a track. Let the size of the problem choose. A busy clinic missing 10 calls/day is Track B. A barbershop just starting is Track A. The demo settles any doubt." },
  { tag: "Discovery", title: "The 5 golden questions",
    body: [["p", "Ask these 5 and let HIM talk:"], ["ol", ["How many calls do you miss per day — lunch, night, Sunday?", "Who answers WhatsApp when you're closed?", "What happens to whoever asks for a quote and disappears?", "How many customers never return because nobody called back?", "If every missed call is worth $50–100… how much leaks per month?"]]],
    note: "These 5 questions make the owner sell himself. You don't accuse, you ask. Question 5 is the key: he does the math and the problem becomes a number." },
  { tag: "Objections", title: "The 8 objections (1-line answer)",
    body: [["dl", OBJECTION_KILLERS.map((o) => [o.q.en, o.short.en])]],
    note: "Every objection ends at the demo or the guarantee. Memorize the pattern, not the phrases: agree (\"of course\", \"I get it\") and redirect. The full 2-3 sentence answers to read aloud are in /roteiro and the Seller Hub." },
  { tag: "Script", title: "The 15-minute script",
    body: [["dl", [["0–3 min", "Icebreaker + the 5 questions. Let HIM talk."], ["3–5 min", "The sentence + \"let me show you instead of explaining\"."], ["5–9 min", "The DEMO: Gui calls his phone. Silence. Let him listen. It sells itself."], ["9–12 min", `Show the ${NOME_DO_PAINEL} tied to his pain.`], ["12–15 min", "Next step: proposal + 30-day guarantee, live in 7 days."]]]],
    note: "15 minutes is enough because the demo carries the weight. Don't ramble. The less you talk after the demo, the faster it closes. Book the next step BEFORE you leave." },
  { tag: "Ethics", title: "The honest-sale rule",
    body: [["h", "NEVER promise:"], ["ul", ["That the AI never makes mistakes.", "An exact result in $.", "Less than 7 days to launch.", "Anything outside the package."]], ["hi", "ALWAYS offer: the 30-day guarantee."]],
    note: "Honesty sells more and protects your name. \"Gui makes mistakes sometimes — that's why there's a human supervising and a 30-day guarantee.\" That builds trust, not destroys it." },
  { tag: "Action", title: "How to start today",
    body: [["p", "Start with your network. Think of 5 business owners you know:"], ["ol", ["___________ (restaurant / diner?)", "___________ (clinic / dentist / aesthetics?)", "___________ (barbershop / salon?)", "___________ (real estate / broker?)", "___________ (services — plumber, mechanic, lawyer?)"]], ["hi", "Send the 1st message (there's a template in the kit) → book 15 min → let Gui call."]],
    note: "The easiest sale is to whoever already trusts you. Don't start with strangers. Start with the 5 names that come to mind RIGHT NOW." },
  { tag: "FAQ", title: "Partner FAQ",
    body: [["dl", [["Do I need to understand technology?", "No. You open the door, the demo sells, Guileo installs."], ["What if they ask something technical I don't know?", "\"Great question — the installer explains it properly in the proposal.\" Never make it up."], ["When do I get the commission?", "On the paid monthly fees (A: first 3; B: setup + 3 months)."], ["What if the client cancels?", "There's a 30-day guarantee. That's why the demo matters: whoever enters knowing, stays."], ["Can I refer any business?", "Yes, but aim at whoever misses calls and has traffic. Those close."], ["Who does support afterwards?", "Guileo. You refer and earn; installation and support are ours."]]]],
    note: "This slide removes the fear. The collaborator doesn't need to be technical, doesn't need to give support, doesn't need to promise anything. Just 5 names and the courage to send the 1st message." },
  { tag: "Close", title: "You pick the clients. Gui makes the sale. Guileo delivers.",
    body: [["p", "Your next step: pick 1 name from your list and send the message today."], ["big", "guileoai.com"]],
    note: "End with action, not applause. \"Don't leave here with an empty list. One name. One message. Today.\" Shake hands and send them out." },
];

const SLIDES_ES = [
  { tag: "Portada", title: "Guileo", sub: "Un empleado de IA que contesta, vende y cobra para un negocio — 24/7.",
    body: [["p", "No vendes tecnología. Devuelves dinero y tiempo a dueños de negocio."]],
    note: "Apertura. No expliques nada todavía. Di solo: \"En 12 minutos sabrás todo lo que necesitas para referir Guileo y ganar con ello. Lo mejor: la propia IA hace la venta — tú solo abres la puerta.\" Sonríe. Pasa la diapositiva." },
  { tag: "Problema", title: "El dinero se está fugando",
    body: [["p", "Cada día, en el negocio de tu cliente:"], ["ul", ["Llama a la hora del almuerzo → nadie contesta → el cliente llama al competidor.", "Manda WhatsApp a las 9pm → responden al otro día → lead frío.", "Pide presupuesto → desaparece → nadie llamó de vuelta.", "El cliente antiguo no vuelve → porque nadie lo llamó."]], ["hi", "Cada llamada perdida vale unos $50–$100. Haz la cuenta del mes."]],
    note: "Pinta el dolor ANTES de la frase. El dueño SIENTE esto todos los días pero nunca lo sumó. Tu frase mágica: \"¿Cuánto crees que suma eso al mes?\" Deja que haga la cuenta en su cabeza. Su silencio es la venta empezando." },
  { tag: "La frase", title: "La columna de todo",
    body: [["quote", MASTER_SENTENCE.es], ["p", "Si olvidas todo lo demás, recuerda ESTA frase."]],
    note: "Lee la frase en voz alta, despacio. Toda objeción, todo email, toda reunión vuelve aquí. \"COBRA por ti\" — ese es el corazón: no solo contesta, cierra y recibe el pago en la llamada. Y \"menos que un día de sueldo de un mesero\" mata la objeción de precio antes de nacer." },
  { tag: "Cómo funciona", title: "Cómo funciona (3 pasos)",
    body: [["ol", ["Tú abres la puerta: 15 minutos y Gui llama al celular del dueño, en vivo.", "Él paga en Stripe → su Gui nace sola, en minutos, ya entrenada en su negocio.", "Ella contesta, agenda, vende y COBRA 24/7 — y él ve todo en el panel en tiempo real."]], ["hi", "Sin instalación, sin proyecto de meses. Pagó, nació, contestó."]],
    note: "Tres pasos, sin tecnicismos. El punto que nadie cree (y por eso vende): Gui nace SOLA después del pago. No hay \"proyecto de implementación\". Es la demo → el pago → el empleado al aire." },
  { tag: "Mindset", title: "La verdad sobre vender esto",
    body: [["ul", ["Ningún negocio compra \"herramienta\". Compra RESULTADO.", "Lidera con el resultado: más citas, lead recuperado, tiempo de vuelta, dinero que deja de fugarse.", "Precio por el tamaño del problema, no por el costo de la herramienta.", "La prueba no es PowerPoint. La prueba es la demo en vivo: Gui llama al celular del tipo en el momento."]]],
    note: "Esta es la diapositiva que te cambia la cabeza. Deja de decir \"inteligencia artificial\", \"automatización\", \"tecnología\". Di \"estás perdiendo X al mes y yo paro esa fuga\". Quien vende resultado nunca pelea por precio." },
  { tag: "El producto", title: "Qué hace Guileo",
    body: [["ul", ["Contesta toda llamada y mensaje, 24/7.", "Missed-call text-back: ¿perdiste la llamada? manda texto al instante.", "Speed-to-Lead: llama al lead nuevo en ~60 segundos.", "Agenda + recordatorios que cortan ausencias — con seña pagada para reservar.", "COBRA en la llamada: cerró, manda el link de pago por SMS ahí mismo.", "Reactivación / win-back de quien desapareció.", "Máquina de reseñas (más calificaciones 5 estrellas).", "Todo trilingüe EN / PT / ES — oro en el mercado inmigrante."]]],
    note: "No listes todo de una vez en la reunión real — elige los 2-3 que golpean SU dolor. Esto es para que TÚ conozcas el arsenal. El \"cobra en la llamada\" y el trilingüe son los diferenciales que ningún competidor tiene." },
  { tag: "Prueba", title: `La ${NOME_DO_PAINEL}`,
    body: [["ul", [`El panel de Guileo = la "${NOME_DO_PAINEL}" (~30 pantallas).`, "El dueño ve las llamadas contestadas, leads recuperados, citas, reseñas — en tiempo real.", "No es \"confía en mí\". Es \"mira cómo funciona\"."]]],
    note: `Los dueños desconfían de la IA porque parece caja negra. La ${NOME_DO_PAINEL} lo resuelve: él ve el trabajo sucediendo. En la demo, muestra la pantalla ligada a su dolor.` },
  { tag: "El arma", title: "La demo es tu arma",
    body: [["ul", ["No explicas a Gui. La dejas presentarse sola.", "En medio de la reunión: Gui llama al celular del prospecto.", "Tú te quedas en silencio y lo dejas escuchar.", "Se vende sola. Siempre."]], ["hi", "guileoai.com → el visitante pone su teléfono y Gui llama al instante."]],
    note: "Esta es la jugada que separa a Guileo de cualquier competidor. Entrena UNA cosa: quedarte callado mientras Gui habla. Tu boca cerrada es tu mejor argumento." },
  { tag: "Modelo", title: "Los 2 rieles + tu comisión",
    body: [["h", "Riel A — Self-service (empezar simple)"], ["ul", [`Essential $${starter.price} / Personalized $${growth.price} / Full Operation $${scale.price} por mes (créditos incluidos).`, "Tu comisión: 20% de las 3 primeras mensualidades."]], ["h", "Riel B — Done-for-you (negocio que pierde dinero real)"], ["ul", [`Desde $${dfy.setup} setup + $${dfy.monthly.toLocaleString("en-US")}+/mes.`, `Tu comisión: 20% del contrato (setup + 3 meses) ≈ ~$${dfyComm.toLocaleString("en-US")} por venta.`]]],
    note: "Dos rieles = atiendes cualquier negocio. El pequeño entra por A. El grande, que sangra dinero, va al B — y ahí es donde tu comisión engorda." },
  { tag: "$$$", title: "Cuánto ganas",
    body: [["h", `Riel A — Growth $${growth.price}/mes`], ["ul", [`20% × 3 meses = 20% × $${(growth.price * 3).toLocaleString("en-US")} = ~$${growthComm} por venta.`, `¿Cerraste 5 en el mes? ~$${(growthComm * 5).toLocaleString("en-US")}.`]], ["h", `Riel B — setup $${dfy.setup} + $${dfy.monthly.toLocaleString("en-US")}/mes`], ["ul", [`Contrato (setup + 3 meses) = $${dfyContract.toLocaleString("en-US")}.`, `20% = ~$${dfyComm.toLocaleString("en-US")} por venta.`, `¿Cerraste 2 en el mes? ~$${(dfyComm * 2).toLocaleString("en-US")}.`]], ["hi", "Regla de bolsillo: se queja de llamadas perdidas + factura > $20k/mes → Riel B. El resto → Riel A. En la duda, agenda la demo."]],
    note: "No fuerces el riel. Deja que el tamaño del problema elija. Una clínica llena que pierde 10 llamadas/día es Riel B. Una barbería empezando es Riel A. La demo resuelve la duda." },
  { tag: "Descubrimiento", title: "Las 5 preguntas de oro",
    body: [["p", "Haz estas 5 y deja que ÉL hable:"], ["ol", ["¿Cuántas llamadas pierden por día — almuerzo, noche, domingo?", "¿Quién responde el WhatsApp cuando cierran?", "¿Qué pasa con quien pide presupuesto y desaparece?", "¿Cuántos clientes dejan de volver porque nadie llamó de vuelta?", "Si cada llamada perdida vale unos $50–100… ¿cuánto se fuga al mes?"]]],
    note: "Estas 5 preguntas hacen que el dueño se venda solo. No acusas, preguntas. La pregunta 5 es la clave: él hace la cuenta y el problema se vuelve número." },
  { tag: "Objeciones", title: "Las 8 objeciones (respuesta de 1 línea)",
    body: [["dl", OBJECTION_KILLERS.map((o) => [o.q.es, o.short.es])]],
    note: "Toda objeción termina en la demo o en la garantía. Memoriza el patrón, no las frases: acuerda (\"claro\", \"entiendo\") y redirige. Las respuestas completas, de 2-3 frases para leer en voz alta, están en /roteiro y en el Hub del Vendedor." },
  { tag: "Guion", title: "El guion de 15 minutos",
    body: [["dl", [["0–3 min", "Rompehielos + las 5 preguntas. Deja que ÉL hable."], ["3–5 min", "La frase + \"déjame mostrarte en vez de explicar\"."], ["5–9 min", "La DEMO: Gui llama a su celular. Silencio. Déjalo escuchar. Se vende sola."], ["9–12 min", `Muestra la ${NOME_DO_PAINEL} ligada a su dolor.`], ["12–15 min", "Próximo paso: propuesta + garantía 30 días, en vivo en 7 días."]]]],
    note: "15 minutos bastan porque la demo carga el peso. No des vueltas. Cuanto menos hablas después de la demo, más rápido cierras. Agenda el próximo paso ANTES de irte." },
  { tag: "Ética", title: "La regla de la venta honesta",
    body: [["h", "NUNCA prometas:"], ["ul", ["Que la IA no se equivoca.", "Resultado exacto en $.", "Plazo menor a 7 días.", "Algo fuera del paquete."]], ["hi", "SIEMPRE ofrece: garantía de 30 días."]],
    note: "La honestidad vende más y protege tu nombre. \"Gui se equivoca a veces — por eso hay un humano supervisando y 30 días de garantía.\" Eso construye confianza, no la destruye." },
  { tag: "Acción", title: "Cómo empezar hoy",
    body: [["p", "Empieza por tu red. Piensa en 5 dueños de negocio que conoces:"], ["ol", ["___________ (¿restaurante / lonchería?)", "___________ (¿clínica / dentista / estética?)", "___________ (¿barbería / salón?)", "___________ (¿inmobiliaria / corredor?)", "___________ (¿servicio — plomero, mecánico, abogado?)"]], ["hi", "Manda el 1er mensaje (hay plantilla en el kit) → agenda 15 min → deja que Gui llame."]],
    note: "La venta más fácil es a quien ya confía en ti. No empieces con extraños. Empieza con los 5 nombres que te vienen a la cabeza AHORA." },
  { tag: "FAQ", title: "FAQ del socio",
    body: [["dl", [["¿Necesito entender de tecnología?", "No. Tú abres la puerta, la demo vende, Guileo instala."], ["¿Y si preguntan algo técnico que no sé?", "\"Excelente pregunta — quien instala te lo explica bien en la propuesta.\" Nunca inventes."], ["¿Cuándo recibo la comisión?", "Sobre las mensualidades pagadas (A: 3 primeras; B: setup + 3 meses)."], ["¿Y si el cliente cancela?", "Hay garantía de 30 días. Por eso importa la demo: quien entra sabiendo, se queda."], ["¿Puedo referir cualquier negocio?", "Sí, pero apunta a quien pierde llamadas y tiene movimiento. Esos cierran."], ["¿Quién da soporte después?", "Guileo. Tú refieres y ganas; instalación y soporte son nuestros."]]]],
    note: "Esta diapositiva quita el miedo. El colaborador no necesita ser técnico, no necesita dar soporte, no necesita prometer nada. Solo 5 nombres y el coraje de mandar el 1er mensaje." },
  { tag: "Cierre", title: "Tú eliges los clientes. Gui hace la venta. Guileo entrega.",
    body: [["p", "Tu próximo paso: elige 1 nombre de tu lista y manda el mensaje hoy."], ["big", "guileoai.com"]],
    note: "Termina con acción, no con aplausos. \"No salgas de aquí con la lista vacía. Un nombre. Un mensaje. Hoy.\" Aprieta la mano y mándalos a la calle." },
];

// Hindi: real Hindi tags/titles (core headings), EN bodies/notes (permitted long-tail fallback).
const HI_META = [
  ["कवर", "Guileo"],
  ["समस्या", "पैसा रिस रहा है"],
  ["वह वाक्य", "हर चीज़ की रीढ़"],
  ["कैसे काम करता है", "कैसे काम करता है (3 कदम)"],
  ["माइंडसेट", "इसे बेचने का सच"],
  ["प्रोडक्ट", "Guileo क्या करती है"],
  ["प्रमाण", NOME_DO_PAINEL],
  ["हथियार", "डेमो ही आपका हथियार है"],
  ["मॉडल", "2 ट्रैक + आपका कमीशन"],
  ["$$$", "आप कितना कमाते हैं"],
  ["खोज", "5 सुनहरे सवाल"],
  ["आपत्तियाँ", "8 आपत्तियाँ (1-लाइन जवाब)"],
  ["स्क्रिप्ट", "15 मिनट की स्क्रिप्ट"],
  ["नैतिकता", "ईमानदार बिक्री का नियम"],
  ["एक्शन", "आज कैसे शुरू करें"],
  ["FAQ", "पार्टनर FAQ"],
  ["समापन", "क्लाइंट आप चुनते हैं। बिक्री गुई करती है। डिलीवरी Guileo करती है।"],
];
const SLIDES_HI = SLIDES_EN.map((s, i) => ({ ...s, tag: HI_META[i][0], title: HI_META[i][1] }));

export const SLIDES_BY_LANG = { pt: SLIDES_PT, en: SLIDES_EN, es: SLIDES_ES, hi: SLIDES_HI };

export function Block({ b }) {
  const [kind, payload] = b;
  if (kind === "p") return <p className="text-base sm:text-lg text-g-light/90 leading-relaxed">{payload}</p>;
  if (kind === "h") return <p className="text-sm font-black uppercase tracking-wide text-g-gold mt-3">{payload}</p>;
  if (kind === "big") return <p className="text-3xl sm:text-4xl font-black text-g-green tracking-tight">{payload}</p>;
  if (kind === "quote") return <blockquote className="border-l-2 border-g-gold/60 pl-4 text-xl sm:text-2xl font-bold text-g-word leading-snug italic">{payload}</blockquote>;
  if (kind === "hi") return <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-3 text-base font-bold text-g-word">{payload}</div>;
  if (kind === "ul") return <ul className="space-y-2">{payload.map((t, i) => <li key={i} className="flex gap-2.5 text-base text-g-light/90 leading-snug"><span className="text-g-green mt-0.5 shrink-0">✓</span><span>{t}</span></li>)}</ul>;
  if (kind === "ol") return <ol className="space-y-2">{payload.map((t, i) => <li key={i} className="flex gap-2.5 text-base text-g-light/90 leading-snug"><span className="grid place-items-center h-5 w-5 shrink-0 rounded-full bg-g-gold/15 text-g-gold text-[11px] font-black">{i + 1}</span><span>{t}</span></li>)}</ol>;
  if (kind === "dl") return <div className="space-y-2.5">{payload.map(([q, a], i) => <div key={i} className="rounded-xl2 border border-white/10 bg-white/[0.03] p-3"><div className="text-sm font-black text-g-gold">{q}</div><div className="text-sm text-g-light/85 mt-0.5 leading-snug">{a}</div></div>)}</div>;
  return null;
}

export default function Deck() {
  const { lang, setLang } = useLang();
  const u = (k) => (UI[k] && (UI[k][lang] || UI[k].en)) || "";
  const SLIDES = SLIDES_BY_LANG[lang] || SLIDES_BY_LANG.en;
  useSeo({ title: u("seoTitle"), description: u("seoDesc"), path: "/deck" });
  const [i, setI] = useState(0);
  const [notes, setNotes] = useState(true);
  const [grid, setGrid] = useState(false);
  const total = SLIDES.length;
  const go = useCallback((n) => setI((c) => Math.max(0, Math.min(total - 1, typeof n === "function" ? n(c) : n))), [total]);
  useEffect(() => {
    const h = (e) => {
      if (grid) { if (e.key === "Escape") setGrid(false); return; }
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); go((c) => c + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); go((c) => c - 1); }
      if (e.key.toLowerCase() === "n") setNotes((v) => !v);
      if (e.key.toLowerCase() === "g") setGrid((v) => !v);
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [go, grid]);
  const s = SLIDES[i];

  return (
    <div className="min-h-screen text-g-ink flex flex-col">
      {/* top bar */}
      <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-white/10 bg-white/[0.02] backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <img src={logo} alt="Guileo" className="h-7 w-7 object-contain" />
          <span className="text-sm font-extrabold text-g-word truncate">{u("deckName")}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-0.5 rounded-full border border-white/15 bg-white/[0.04] px-1 py-0.5">
            {LANGS.map(([code, flag]) => (
              <button key={code} onClick={() => setLang(code)} title={LANG_NAMES[code]} aria-label={LANG_NAMES[code]} aria-pressed={lang === code}
                className={`grid h-6 w-6 place-items-center rounded-full text-[12px] transition ${lang === code ? "scale-110 bg-g-green/15 ring-1 ring-g-green/30" : "opacity-60 hover:opacity-100"}`}>{flag}</button>
            ))}
          </div>
          <button onClick={() => setGrid((v) => !v)} className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 font-bold text-g-word hover:border-g-gold/40 transition">{u("all")}</button>
          <button onClick={() => setNotes((v) => !v)} className={`rounded-full border px-3 py-1.5 font-bold transition ${notes ? "border-g-gold/40 bg-g-gold/10 text-g-gold" : "border-white/15 bg-white/[0.04] text-g-muted"}`}>{u("notes")}</button>
          <Link to="/academia" className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 font-bold text-g-word hover:border-g-gold/40 transition">{u("academy")}</Link>
        </div>
      </header>

      {/* progress */}
      <div className="h-1 w-full bg-white/5"><div className="h-full bg-gradient-to-r from-g-green to-g-gold transition-all duration-300" style={{ width: `${((i + 1) / total) * 100}%` }} /></div>

      {grid ? (
        <div className="flex-1 p-4 sm:p-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {SLIDES.map((sl, idx) => (
              <button key={idx} onClick={() => { setI(idx); setGrid(false); }} className="text-left rounded-2xl border border-white/10 bg-white/[0.03] hover:border-g-gold/40 hover:bg-white/[0.06] transition p-4 min-h-[120px]">
                <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-wide text-g-gold">{sl.tag}</span><span className="text-[10px] text-g-muted">{idx + 1}/{total}</span></div>
                <div className="mt-2 text-sm font-extrabold text-g-word leading-snug">{sl.title}</div>
                {sl.sub && <div className="mt-1 text-[11px] text-g-muted line-clamp-2">{sl.sub}</div>}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <main className="flex-1 grid lg:grid-cols-[1fr] gap-0">
          <div className="relative flex-1 grid place-items-center p-5 sm:p-10">
            <AnimatePresence mode="wait">
              <motion.div key={`${lang}-${i}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28 }}
                className="w-full max-w-3xl">
                <div className="rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-xl p-6 sm:p-10 shadow-lift">
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-g-gold"><span className="h-1.5 w-1.5 rounded-full bg-g-gold" />{s.tag} · {i + 1}/{total}</div>
                  <h1 className="mt-3 text-2xl sm:text-4xl font-black text-g-word tracking-tight leading-tight">{s.title}</h1>
                  {s.sub && <p className="mt-2 text-lg sm:text-xl text-g-light/90 font-semibold">{s.sub}</p>}
                  <div className="mt-5 space-y-3.5">{s.body.map((b, k) => <Block key={k} b={b} />)}</div>
                  {notes && (
                    <div className="mt-6 rounded-xl2 border border-g-green/25 bg-g-green/[0.06] p-4">
                      <div className="text-[10px] font-black uppercase tracking-wide text-g-green">{u("presenterNote")}</div>
                      <p className="mt-1 text-sm text-g-light/85 leading-relaxed">{s.note}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* nav */}
          <div className="sticky bottom-0 flex items-center justify-between gap-3 px-5 sm:px-10 py-4 border-t border-white/10 bg-white/[0.02] backdrop-blur-md">
            <button onClick={() => go((c) => c - 1)} disabled={i === 0} className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-bold text-g-word hover:border-g-gold/40 transition disabled:opacity-40">{u("prev")}</button>
            <div className="flex items-center gap-1.5">{SLIDES.map((_, idx) => <button key={idx} onClick={() => setI(idx)} aria-label={`${u("slideWord")} ${idx + 1}`} className={`h-1.5 rounded-full transition-all ${idx === i ? "w-5 bg-g-gold" : "w-1.5 bg-white/20 hover:bg-white/40"}`} />)}</div>
            {i === total - 1
              ? <a href="https://guileoai.com" target="_blank" rel="noopener" className="rounded-full bg-gradient-to-br from-g-green to-g-dark text-white px-4 py-2 text-sm font-bold hover:scale-[1.03] transition">guileoai.com →</a>
              : <button onClick={() => go((c) => c + 1)} className="rounded-full bg-gradient-to-br from-g-green to-g-dark text-white px-4 py-2 text-sm font-bold hover:scale-[1.03] transition">{u("next")}</button>}
          </div>
        </main>
      )}
    </div>
  );
}
