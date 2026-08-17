import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";
import logo from "../assets/guileo-mark.png";
import { waLink, CONTACT } from "../data/contact.js";
import { PITCH_NICHES, PITCH_CARDS } from "../data/pitchCards.js";
import SellerQuote from "../components/SellerQuote.jsx";
import OnboardWizard from "../components/OnboardWizard.jsx";
import SellerClients from "../components/SellerClients.jsx";
import ActivationRunbook from "../components/ActivationRunbook.jsx";
import SellerProspect from "../components/SellerProspect.jsx";
// A lista de NY já classificada (serviço + pitch). Motor em data/leadClassifier.js — existir sem
// tela é o mesmo que não existir, que foi a lição da página órfã de hoje mais cedo.
import SellerLeadsNYC from "../components/SellerLeadsNYC.jsx";
import SellerDashboard from "../components/SellerDashboard.jsx";
import SellerFollowup from "../components/SellerFollowup.jsx";
import SellerSupport from "../components/SellerSupport.jsx";
import SellerCloser from "../components/SellerCloser.jsx";
import SellerIdeas from "../components/SellerIdeas.jsx";
import SellerContract from "../components/SellerContract.jsx";
import SellerFinance from "../components/SellerFinance.jsx";
import DemoEngine from "../components/DemoEngine.jsx";
import { ACTIVATION_STEPS, ACTIVATION_SECTORS, pickL } from "../data/activation.js";

// Shared hub-wide CSS: the AI-CTA glow (Gui orange #FF8A33, subtle pulse — cement design stays
// intact) + the copilot typing dots. Injected once in the hub root.
const HUB_CSS = `
@keyframes guiAiPulse{0%,100%{box-shadow:0 0 14px rgba(255,138,51,.22),0 0 0 0 rgba(255,138,51,.20)}50%{box-shadow:0 0 24px rgba(255,138,51,.38),0 0 0 4px rgba(255,138,51,0)}}
.ai-cta{position:relative;box-shadow:0 0 14px rgba(255,138,51,.22);animation:guiAiPulse 2.8s ease-in-out infinite;outline:1px solid rgba(255,138,51,.35);outline-offset:-1px}
@keyframes guiDot{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
@media (prefers-reduced-motion:reduce){.ai-cta{animation:none}}
`;

// Tiny **bold** markdown renderer for chat bubbles (copilot replies come back with **highlights**).
function Bold({ text }) {
  // the model escapes literal stars ("\*72") so they don't read as markdown — unescape for display
  const parts = String(text || "").replace(/\\([*_])/g, "$1").split(/\*\*(.+?)\*\*/g);
  return parts.map((p, i) => (i % 2 ? <strong key={i} className="font-extrabold text-g-word">{p}</strong> : p));
}

// Animated 3-dot typing indicator (pure CSS, keyframes in HUB_CSS).
const TypingDots = () => (
  <span className="inline-flex items-center gap-1 px-0.5" aria-label="…">
    {[0, 1, 2].map((i) => (
      <span key={i} className="h-1.5 w-1.5 rounded-full bg-g-muted" style={{ animation: "guiDot 1.1s ease-in-out infinite", animationDelay: `${i * 0.18}s` }} />
    ))}
  </span>
);

// /vendedor — the logged-in SELLER / COLLABORATOR HUB. One place that consolidates the field
// playbook, a Library+AI pitch-card generator, the quote generator, and the lines to support/Luis.
// Per-seller login is validated server-side (/api/seller-login); the seller's ref feeds the
// existing ?ref= attribution so Track-A commissions are credited. Strategy is locked into the copy:
// sell GROWTH as a specialist — problem → solution → gain → beat the competition. Never aggressive.

const SELLER_KEY = "guileo_seller";
const LANGS = [["pt", "🇧🇷"], ["en", "🇺🇸"], ["es", "🇪🇸"], ["hi", "🇮🇳"]];

const T = {
  pt: {
    brand: "Hub do Colaborador", eyebrow: "Área do vendedor",
    loginTitle: "Entrar no Hub", loginSub: "Sua central pra vender com a Guileo — playbook, pitches, orçamentos e suporte, tudo num lugar.",
    nameField: "Seu nome", email: "Seu email", code: "Código de acesso (do time)", enter: "Entrar", entering: "Entrando…",
    invalid: "Email ou código inválido. Fala com o Luis pra liberar seu acesso.", needBoth: "Preencha email e código.",
    logout: "Sair", hi: "Olá",
    nav: { start: "Início", painel: "📊 Painel", alvos: "🎯 Alvos do dia", followup: "🗓️ Follow-up", fechar: "💰 Fechar", demo: "🎬 Demo", cards: "Pitch Cards", quote: "Orçamento", contrato: "📄 Contrato", financeiro: "🧾 Financeiro", cadastro: "➕ Cadastrar cliente", academy: "Academia", metas: "Minhas Metas", treino: "Treino", ativ: "Ativação", jogadas: "💡 Jogadas", support: "Suporte" },
    cadTitle: "Cadastrar cliente", cadSub: "Preencha o cadastro completo do cliente — negócio, agente, unidades, serviços e canais. Salva um rascunho; o Luis aprova e a Gui dedicada nasce.",
    cadMine: "Meus cadastros", cadNone: "Nenhum cadastro ainda — preencha o formulário acima pra criar o primeiro.", cadErr: "⚠️ Não consegui LER seus cadastros (rede ou sessão). Isso NÃO significa que estão vazios — não cadastre de novo. Toque em Atualizar.", cadDraft: "rascunho", cadLive: "no ar", cadRefresh: "↻ Atualizar",
    ativTitle: "Ativação do cliente", ativSub: "Passo a passo pra deixar a Gui do cliente no ar depois que ele paga. Siga em ordem.",
    ativParity: "🛡️ Você vê o mesmo mapa que o dono — a diferença é que o Luis monitora tudo.",
    ativSectorTitle: "Específico por setor",
    ativHelp: "Travou em algum passo? Fala comigo.",
    walletLink: "💼 Ver meus clientes (carteira) →",
    metasTitle: "Minhas Metas", metasSub: "Defina sua meta do mês e acompanhe o progresso. Seus números atualizam sozinhos conforme você usa o hub.",
    yourNumbers: "Seus números", mLogins: "Acessos", mQuotes: "Orçamentos", mPitches: "Pitches c/ IA", mLeads: "Leads atribuídos",
    yourGoals: "Meta do mês", gDemos: "Demos agendadas", gDeals: "Clientes fechados", gRevenue: "Receita (US$)",
    done: "Feito", target: "Meta", save: "Salvar meta", saved: "Salvo ✓", logHint: "Toque + quando agendar uma demo ou fechar um cliente.",
    refTitle: "Seu link de indicação", refSub: "Toda venda que vier por este link conta como sua (comissão Track-A).", copyLink: "Copiar link", linkCopied: "Link copiado ✓", share: "Compartilhar",
    comTitle: "Comissões", comLeads: "Leads atribuídos", comConv: "Conversões confirmadas", comEarned: "Comissão ganha", comPotential: "Comissão potencial (estimativa)",
    comEarnedNote: "sobre os pagamentos registrados dos clientes que vieram pelo seu link.",
    comPotentialNote: "Estimativa se cada lead fechar o plano Growth ($149/mês) — NÃO é dinheiro ganho.",
    comManual: "Conversões são confirmadas pelo Luis — fechou um cliente? Avisa ele pra registrar.",
    objTitle: "Quebra-objeção com IA", objSub: "Digite o que o cliente falou — a IA te dá a resposta calma, sem ser agressivo.", objPh: "Ex: \"tá caro\", \"já tenho recepcionista\", \"vou pensar\"…", objGo: "Me ajuda", objGoing: "Pensando…",
    invTitle: "Convidar o time", invSub: "Mande o link + o código pro seu time entrar no Hub.", invCopy: "Copiar convite", invCopied: "Convite copiado ✓", invWa: "Enviar no WhatsApp",
    trainTitle: "Treino", trainSub: "Pratique com um cliente difícil. A IA faz o dono cético do nicho — você treina o pitch antes da reunião de verdade.",
    trainStart: "Começar treino", trainPh: "Sua fala pro cliente…", trainSend: "Enviar", trainReset: "Recomeçar", trainTyping: "digitando…", trainHint: "Dica: comece pela dor dele, não pelo que a Guileo faz.", trainFirst: "Olá! Em que posso ajudar? Tô meio corrido aqui…",
    trainFeedback: "✨ Ver dicas da IA", trainFeedbackGoing: "Avaliando…", trainTips: "Dicas pra próxima reunião",
    kitLink: "📄 Kit de campo (imprimir)",
    guideTitle: "Como usar (30s)", guideGot: "Entendi 👍",
    guideSteps: ["Pitch Cards — escolha o nicho do cliente e veja exatamente o que falar (dor → solução → ganho).", "Treino — pratique com um cliente difícil (IA) antes da reunião de verdade.", "Orçamento — monte o preço e mande na hora (WhatsApp, PDF ou email).", "Minhas Metas — defina sua meta do mês e acompanhe seus números."],
    // Início
    stratTitle: "A estratégia", stratLine: "Você não vende o que a Guileo faz. Você vende o que o cliente vai GANHAR — e como ele PASSA A CONCORRÊNCIA. A gente é especialista em crescimento.",
    arc: ["A dor dele", "A solução", "O ganho", "Passar a concorrência"],
    sentence: "A Guileo instala um time de IA + marketing que atende, vende e faz crescer o negócio sozinho, 24/7 — o cliente escolhe o resultado, a gente entrega.",
    quickTools: "Atalhos", startHint: "Comece pelo nicho do seu cliente nos Pitch Cards. Monte o orçamento. Feche.",
    // Cards
    cardsTitle: "Biblioteca de Pitch Cards", cardsSub: "Escolha o nicho do cliente. Cada card segue o arco dor → solução → ganho → concorrência. Personalize com IA pro cliente exato.",
    pickNiche: "Nicho do cliente",
    fPain: "A dor que ele sente", fLeak: "O que tá vazando", fSolution: "A solução (o ganho dele)", fGain: "O que ele ganha", fEdge: "Como passa a concorrência", fOpener: "Como abrir (sem ser agressivo)", fDiscovery: "Perguntas que fazem ele perceber", fObjection: "Se ele resistir",
    aiTitle: "Personalizar com IA", aiSub: "Diga o nome/cidade do cliente e o que você sabe — a IA escreve o pitch sob medida.",
    aiBiz: "Nome do negócio", aiCity: "Cidade", aiNotes: "O que você sabe dele (opcional)", aiGo: "Gerar pitch", aiGoing: "Escrevendo…", aiErr: "Não consegui agora. Tenta de novo.", copy: "Copiar", copied: "Copiado ✓",
    // Academy
    acadTitle: "Academia de bolso", acadSub: "O essencial pra qualquer reunião. Os links abaixo abrem o material completo.",
    q5: "As 5 perguntas (deixa ELE falar)", obj: "Objeções (1 linha cada)", plan: "Os 15 minutos", never: "Nunca prometa",
    tracks: "Os dois caminhos", trackA: "Self-service (Track A)", trackADesc: "Planos mensais $49 / $149 / $399. Cliente assina e ativa sozinho. Você ganha % dos primeiros meses.", trackB: "Sob medida (Track B)", trackBDesc: "A partir de $990 setup + $1.497/mês. Você fecha, a gente entrega. Comissão maior.",
    fullMaterial: "Material completo",
    // Support
    supTitle: "Suporte e contato", supSub: "Travou numa reunião? Precisa de algo? Fala com a gente.",
    supLuis: "Falar com o Luis", supLuisD: "Socorro rápido, dúvida ou pra liberar um cliente.", supTeam: "Suporte Guileo", supTeamD: "WhatsApp do time de suporte.", supEmail: "Email", supEmailD: CONTACT.email,
  },
  en: {
    brand: "Collaborator Hub", eyebrow: "Seller area",
    loginTitle: "Sign in to the Hub", loginSub: "Your base to sell with Guileo — playbook, pitches, quotes and support, all in one place.",
    nameField: "Your name", email: "Your email", code: "Access code (from your team)", enter: "Sign in", entering: "Signing in…",
    invalid: "Invalid email or code. Ask Luis to enable your access.", needBoth: "Enter email and code.",
    logout: "Sign out", hi: "Hi",
    nav: { start: "Start", painel: "📊 Panel", alvos: "🎯 Targets", followup: "🗓️ Follow-up", fechar: "💰 Close", demo: "🎬 Demo", cards: "Pitch Cards", quote: "Quote", contrato: "📄 Contract", financeiro: "🧾 Finance", cadastro: "➕ Add client", academy: "Academy", metas: "My Goals", treino: "Practice", ativ: "Activation", jogadas: "💡 Plays", support: "Support" },
    cadTitle: "Add client", cadSub: "Fill the full client intake — business, agent, locations, services and channels. It saves a draft; Luis approves and the dedicated Gui is born.",
    cadMine: "My intakes", cadNone: "No intakes yet — fill the form above to create the first one.", cadErr: "⚠️ Couldn't READ your intakes (network or session). This does NOT mean they're empty — don't re-register. Tap Refresh.", cadDraft: "draft", cadLive: "live", cadRefresh: "↻ Refresh",
    ativTitle: "Client activation", ativSub: "Step by step to get the client's Gui live after they pay. Follow in order.",
    ativParity: "🛡️ You see the same map the owner sees — the difference is Luis monitors everything.",
    ativSectorTitle: "Sector-specific",
    ativHelp: "Stuck on a step? Talk to me.",
    walletLink: "💼 See my clients (wallet) →",
    metasTitle: "My Goals", metasSub: "Set your monthly goal and track progress. Your numbers update on their own as you use the hub.",
    yourNumbers: "Your numbers", mLogins: "Logins", mQuotes: "Quotes", mPitches: "AI pitches", mLeads: "Attributed leads",
    yourGoals: "Monthly goal", gDemos: "Demos booked", gDeals: "Clients closed", gRevenue: "Revenue (US$)",
    done: "Done", target: "Goal", save: "Save goal", saved: "Saved ✓", logHint: "Tap + when you book a demo or close a client.",
    refTitle: "Your referral link", refSub: "Every sale from this link counts as yours (Track-A commission).", copyLink: "Copy link", linkCopied: "Link copied ✓", share: "Share",
    comTitle: "Commissions", comLeads: "Attributed leads", comConv: "Confirmed conversions", comEarned: "Commission earned", comPotential: "Potential commission (estimate)",
    comEarnedNote: "of the registered payments from clients who came through your link.",
    comPotentialNote: "Estimate if every lead closes on the Growth plan ($149/mo) — NOT earned money.",
    comManual: "Conversions are confirmed by Luis — closed a client? Tell him so it gets registered.",
    objTitle: "AI objection-buster", objSub: "Type what the client said — AI gives you the calm, non-aggressive reply.", objPh: "e.g. \"too expensive\", \"I have a receptionist\", \"I'll think about it\"…", objGo: "Help me", objGoing: "Thinking…",
    invTitle: "Invite your team", invSub: "Send the link + code for your team to join the Hub.", invCopy: "Copy invite", invCopied: "Invite copied ✓", invWa: "Send on WhatsApp",
    trainTitle: "Practice", trainSub: "Practice with a tough client. AI plays the skeptical owner of the niche — rehearse your pitch before the real meeting.",
    trainStart: "Start practice", trainPh: "Your line to the client…", trainSend: "Send", trainReset: "Restart", trainTyping: "typing…", trainHint: "Tip: start from their pain, not from what Guileo does.", trainFirst: "Hi! How can I help? I'm a bit busy here…",
    trainFeedback: "✨ Get AI tips", trainFeedbackGoing: "Reviewing…", trainTips: "Tips for next time",
    kitLink: "📄 Field kit (print)",
    guideTitle: "How to use (30s)", guideGot: "Got it 👍",
    guideSteps: ["Pitch Cards — pick the client's niche and see exactly what to say (pain → solution → gain).", "Practice — rehearse with a tough client (AI) before the real meeting.", "Quote — build the price and send it on the spot (WhatsApp, PDF or email).", "My Goals — set your monthly goal and track your numbers."],
    stratTitle: "The strategy", stratLine: "You don't sell what Guileo does. You sell what the client will GAIN — and how they BEAT THE COMPETITION. We're growth specialists.",
    arc: ["Their pain", "The solution", "The gain", "Beat the competition"],
    sentence: "Guileo installs an AI + marketing team that answers, sells and grows the business on its own, 24/7 — the client picks the result, we deliver it.",
    quickTools: "Shortcuts", startHint: "Start from your client's niche in Pitch Cards. Build the quote. Close.",
    cardsTitle: "Pitch Card Library", cardsSub: "Pick the client's niche. Each card follows pain → solution → gain → competition. Personalize with AI for the exact client.",
    pickNiche: "Client niche",
    fPain: "The pain they feel", fLeak: "What's leaking", fSolution: "The solution (their gain)", fGain: "What they gain", fEdge: "How they beat the competition", fOpener: "How to open (non-aggressive)", fDiscovery: "Questions that make them realize", fObjection: "If they resist",
    aiTitle: "Personalize with AI", aiSub: "Give the client's name/city and what you know — AI writes a tailored pitch.",
    aiBiz: "Business name", aiCity: "City", aiNotes: "What you know about them (optional)", aiGo: "Generate pitch", aiGoing: "Writing…", aiErr: "Couldn't right now. Try again.", copy: "Copy", copied: "Copied ✓",
    acadTitle: "Pocket Academy", acadSub: "The essentials for any meeting. The links below open the full material.",
    q5: "The 5 questions (let THEM talk)", obj: "Objections (one line each)", plan: "The 15 minutes", never: "Never promise",
    tracks: "The two paths", trackA: "Self-service (Track A)", trackADesc: "Monthly plans $49 / $149 / $399. Client subscribes and activates alone. You earn % of the first months.", trackB: "Tailored (Track B)", trackBDesc: "From $990 setup + $1,497/mo. You close, we deliver. Higher commission.",
    fullMaterial: "Full material",
    supTitle: "Support & contact", supSub: "Stuck in a meeting? Need something? Talk to us.",
    supLuis: "Message Luis", supLuisD: "Quick help, a question, or to enable a client.", supTeam: "Guileo Support", supTeamD: "Support team WhatsApp.", supEmail: "Email", supEmailD: CONTACT.email,
  },
  es: {
    brand: "Hub del Colaborador", eyebrow: "Área del vendedor",
    loginTitle: "Entrar al Hub", loginSub: "Tu base para vender con Guileo — playbook, pitches, presupuestos y soporte, todo en un lugar.",
    nameField: "Tu nombre", email: "Tu correo", code: "Código de acceso (del equipo)", enter: "Entrar", entering: "Entrando…",
    invalid: "Correo o código inválido. Pídele a Luis que habilite tu acceso.", needBoth: "Completa correo y código.",
    logout: "Salir", hi: "Hola",
    nav: { start: "Inicio", painel: "📊 Panel", alvos: "🎯 Objetivos", followup: "🗓️ Seguimiento", fechar: "💰 Cerrar", demo: "🎬 Demo", cards: "Pitch Cards", quote: "Presupuesto", contrato: "📄 Contrato", financeiro: "🧾 Finanzas", cadastro: "➕ Alta cliente", academy: "Academia", metas: "Mis Metas", treino: "Práctica", ativ: "Activación", jogadas: "💡 Jugadas", support: "Soporte" },
    cadTitle: "Alta de cliente", cadSub: "Completa el alta del cliente — negocio, agente, sucursales, servicios y canales. Guarda un borrador; Luis aprueba y nace la Gui dedicada.",
    cadMine: "Mis altas", cadNone: "Sin altas aún — completa el formulario de arriba para crear la primera.", cadErr: "⚠️ No pude LEER tus altas (red o sesión). Esto NO significa que estén vacías — no des de alta otra vez. Toca Actualizar.", cadDraft: "borrador", cadLive: "en vivo", cadRefresh: "↻ Actualizar",
    ativTitle: "Activación del cliente", ativSub: "Paso a paso para dejar la Gui del cliente en vivo después de que paga. Sigue en orden.",
    ativParity: "🛡️ Ves el mismo mapa que el dueño — la diferencia es que Luis lo monitorea todo.",
    ativSectorTitle: "Por sector",
    ativHelp: "¿Trabado en un paso? Háblame.",
    walletLink: "💼 Ver mis clientes (cartera) →",
    metasTitle: "Mis Metas", metasSub: "Define tu meta del mes y sigue el progreso. Tus números se actualizan solos al usar el hub.",
    yourNumbers: "Tus números", mLogins: "Accesos", mQuotes: "Presupuestos", mPitches: "Pitches con IA", mLeads: "Leads atribuidos",
    yourGoals: "Meta del mes", gDemos: "Demos agendadas", gDeals: "Clientes cerrados", gRevenue: "Ingresos (US$)",
    done: "Hecho", target: "Meta", save: "Guardar meta", saved: "Guardado ✓", logHint: "Toca + cuando agendes una demo o cierres un cliente.",
    refTitle: "Tu enlace de referido", refSub: "Cada venta desde este enlace cuenta como tuya (comisión Track-A).", copyLink: "Copiar enlace", linkCopied: "Enlace copiado ✓", share: "Compartir",
    comTitle: "Comisiones", comLeads: "Leads atribuidos", comConv: "Conversiones confirmadas", comEarned: "Comisión ganada", comPotential: "Comisión potencial (estimación)",
    comEarnedNote: "sobre los pagos registrados de los clientes que llegaron por tu enlace.",
    comPotentialNote: "Estimación si cada lead cierra el plan Growth ($149/mes) — NO es dinero ganado.",
    comManual: "Las conversiones las confirma Luis — ¿cerraste un cliente? Avísale para registrarlo.",
    objTitle: "Rompe-objeciones con IA", objSub: "Escribe lo que dijo el cliente — la IA te da la respuesta calmada, sin ser agresivo.", objPh: "Ej: \"está caro\", \"ya tengo recepcionista\", \"lo pensaré\"…", objGo: "Ayúdame", objGoing: "Pensando…",
    invTitle: "Invitar al equipo", invSub: "Envía el enlace + el código para que tu equipo entre al Hub.", invCopy: "Copiar invitación", invCopied: "Invitación copiada ✓", invWa: "Enviar por WhatsApp",
    trainTitle: "Práctica", trainSub: "Practica con un cliente difícil. La IA hace de dueño escéptico del nicho — ensaya tu pitch antes de la reunión real.",
    trainStart: "Empezar práctica", trainPh: "Tu frase al cliente…", trainSend: "Enviar", trainReset: "Reiniciar", trainTyping: "escribiendo…", trainHint: "Tip: empieza por su dolor, no por lo que hace Guileo.", trainFirst: "¡Hola! ¿En qué te ayudo? Ando algo apurado…",
    trainFeedback: "✨ Ver consejos de IA", trainFeedbackGoing: "Evaluando…", trainTips: "Consejos para la próxima",
    kitLink: "📄 Kit de campo (imprimir)",
    guideTitle: "Cómo usar (30s)", guideGot: "Entendido 👍",
    guideSteps: ["Pitch Cards — elige el nicho del cliente y mira qué decir (dolor → solución → ganancia).", "Práctica — ensaya con un cliente difícil (IA) antes de la reunión real.", "Presupuesto — arma el precio y envíalo al momento (WhatsApp, PDF o correo).", "Mis Metas — define tu meta del mes y sigue tus números."],
    stratTitle: "La estrategia", stratLine: "No vendes lo que hace Guileo. Vendes lo que el cliente va a GANAR — y cómo SUPERA A LA COMPETENCIA. Somos especialistas en crecimiento.",
    arc: ["Su dolor", "La solución", "La ganancia", "Superar a la competencia"],
    sentence: "Guileo instala un equipo de IA + marketing que atiende, vende y hace crecer el negocio solo, 24/7 — el cliente elige el resultado, nosotros lo entregamos.",
    quickTools: "Atajos", startHint: "Empieza por el nicho de tu cliente en los Pitch Cards. Arma el presupuesto. Cierra.",
    cardsTitle: "Biblioteca de Pitch Cards", cardsSub: "Elige el nicho del cliente. Cada card sigue dolor → solución → ganancia → competencia. Personaliza con IA para el cliente exacto.",
    pickNiche: "Nicho del cliente",
    fPain: "El dolor que siente", fLeak: "Lo que se está fugando", fSolution: "La solución (su ganancia)", fGain: "Lo que gana", fEdge: "Cómo supera a la competencia", fOpener: "Cómo abrir (sin ser agresivo)", fDiscovery: "Preguntas que se lo hacen ver", fObjection: "Si se resiste",
    aiTitle: "Personalizar con IA", aiSub: "Da el nombre/ciudad del cliente y lo que sabes — la IA escribe un pitch a medida.",
    aiBiz: "Nombre del negocio", aiCity: "Ciudad", aiNotes: "Lo que sabes de él (opcional)", aiGo: "Generar pitch", aiGoing: "Escribiendo…", aiErr: "No pude ahora. Intenta de nuevo.", copy: "Copiar", copied: "Copiado ✓",
    acadTitle: "Academia de bolsillo", acadSub: "Lo esencial para cualquier reunión. Los enlaces abren el material completo.",
    q5: "Las 5 preguntas (deja que ÉL hable)", obj: "Objeciones (1 línea cada una)", plan: "Los 15 minutos", never: "Nunca prometas",
    tracks: "Los dos caminos", trackA: "Autoservicio (Track A)", trackADesc: "Planes mensuales $49 / $149 / $399. El cliente se suscribe y activa solo. Ganas % de los primeros meses.", trackB: "A medida (Track B)", trackBDesc: "Desde $990 setup + $1,497/mes. Tú cierras, nosotros entregamos. Comisión mayor.",
    fullMaterial: "Material completo",
    supTitle: "Soporte y contacto", supSub: "¿Trabado en una reunión? ¿Necesitas algo? Háblanos.",
    supLuis: "Hablar con Luis", supLuisD: "Ayuda rápida, una duda, o para habilitar un cliente.", supTeam: "Soporte Guileo", supTeamD: "WhatsApp del equipo de soporte.", supEmail: "Correo", supEmailD: CONTACT.email,
  },
};
T.hi = { ...T.en, eyebrow: "विक्रेता क्षेत्र", logout: "साइन आउट", hi: "नमस्ते" };

// Pocket-academy content (sales copy reused from the field cards). pt/en/es; hi falls back to en.
const ACAD = {
  pt: {
    q5: ["Quantas ligações perde por dia?", "Quem responde o WhatsApp à noite?", "E quem pede orçamento e some?", "Quantos clientes ninguém chamou de volta?", "A $50–100 cada… quanto vaza por mês?"],
    obj: [["Sem tempo", "“15 min e a demo é a IA te ligando. Terça ou quarta?”"], ["Quanto custa?", "“Antes do preço, deixa eu mostrar — ela te liga agora?”"], ["IA irrita cliente", "“Ouve a demo. E tem humano supervisionando.”"], ["Já tenho recepcionista", "“Ela cobre o que a recepcionista não alcança: noite, domingo, 3 ligações juntas.”"], ["Vou pensar", "“O que precisaria ser verdade? Te mostro na demo. 30 dias de garantia.”"]],
    plan: ["0-3 · perguntas (ele fala)", "3-5 · a frase", "5-9 · ⚡ GUI LIGA (silêncio!)", "9-12 · cockpit + a dor dele", "12-15 · orçamento + garantia"],
    never: "Que a IA nunca erra · resultado exato em $ · entregar em menos de 7 dias",
  },
  en: {
    q5: ["How many calls do you miss per day?", "Who answers WhatsApp at night?", "What about quote-and-ghost people?", "How many customers never got a call back?", "At $50–100 each… how much leaks per month?"],
    obj: [["No time", "“15 min and the demo is the AI calling you. Tue or Wed?”"], ["How much?", "“Before price, let me show you — can she call you now?”"], ["AI annoys customers", "“Hear the demo. And a human supervises.”"], ["Have a receptionist", "“She covers what they can't: nights, Sunday, 3 calls at once.”"], ["I'll think", "“What would need to be true? I'll show you in the demo. 30-day guarantee.”"]],
    plan: ["0-3 · questions (they talk)", "3-5 · the sentence", "5-9 · ⚡ GUI CALLS (silence!)", "9-12 · cockpit + their pain", "12-15 · quote + guarantee"],
    never: "That the AI never errs · exact $ results · delivering in under 7 days",
  },
  es: {
    q5: ["¿Cuántas llamadas pierdes por día?", "¿Quién responde el WhatsApp de noche?", "¿Y quién pide presupuesto y desaparece?", "¿A cuántos clientes nadie volvió a llamar?", "A $50–100 cada uno… ¿cuánto se fuga por mes?"],
    obj: [["Sin tiempo", "“15 min y la demo es la IA llamándote. ¿Martes o miércoles?”"], ["¿Cuánto cuesta?", "“Antes del precio, déjame mostrarte — ¿te llama ahora?”"], ["La IA molesta", "“Escucha la demo. Y un humano supervisa.”"], ["Ya tengo recepcionista", "“Cubre lo que ella no alcanza: noche, domingo, 3 llamadas a la vez.”"], ["Lo pensaré", "“¿Qué tendría que ser verdad? Te lo muestro en la demo. Garantía de 30 días.”"]],
    plan: ["0-3 · preguntas (él habla)", "3-5 · la frase", "5-9 · ⚡ GUI LLAMA (¡silencio!)", "9-12 · cockpit + su dolor", "12-15 · presupuesto + garantía"],
    never: "Que la IA nunca falla · resultado exacto en $ · entregar en menos de 7 días",
  },
};

const TOOLS = [
  ["/academia", "🎓", "Academia"], ["/cola", "🃏", "Cola"], ["/roteiro", "🎬", "Roteiro"],
  ["/prospects", "🎯", "Prospects"], ["/pitch", "🎤", "Pitch"], ["/deck", "🖥️", "Deck"], ["/parceiro", "🤝", "Parceiro"],
];

function loadSeller() {
  try { return JSON.parse(localStorage.getItem(SELLER_KEY) || "null"); } catch { return null; }
}

// CRACHÁ do vendedor — assinado no /api/seller-login e guardado junto com o perfil.
// As ferramentas de IA (/api/pitch-ai) exigem ele: antes, qualquer visitante do site
// conseguia rodá-las pelo console, gastando modelo pago pela Guileo.
function sellerSid() {
  try { return (JSON.parse(localStorage.getItem(SELLER_KEY) || "null") || {}).sid || ""; } catch { return ""; }
}

// Quem já estava logado ANTES deste crachá existir não tem `sid` — a IA responderia 401 e o
// botão pareceria quebrado. Aqui a sessão velha é limpa e o vendedor só refaz o login uma vez.
function sidExpired(d) {
  if (!d || d.error !== "auth_required") return false;
  try { localStorage.removeItem(SELLER_KEY); } catch { /* ignore */ }
  return true;
}

// Fire-and-forget activity log → /api/seller-stats (powers the seller's own numbers + Luis's
// central panel). Never blocks or breaks the UI.
function logSellerEvent(seller, kind) {
  if (!seller?.email) return;
  try {
    fetch("/api/seller-stats", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "log", kind, email: seller.email, seller: { name: seller.name, ref: seller.ref, code: seller.code || "" } }) }).catch(() => {});
  } catch { /* analytics must never break the hub */ }
}

// ── Login ──────────────────────────────────────────────────────────────────────
function Login({ t, lang, setLang, onIn }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState("idle");
  const [err, setErr] = useState("");
  const field = "w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-[14px] text-g-word placeholder:text-g-muted/50 focus:outline-none focus:border-g-green/50";

  const submit = async (e) => {
    e?.preventDefault();
    if (!email.trim() || !code.trim()) { setErr(t.needBoth); return; }
    setErr(""); setState("go");
    try {
      const r = await fetch("/api/seller-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, code }) });
      const d = await r.json().catch(() => ({}));
      if (d?.ok && d.seller) {
        // Keep the seller's access CODE in their session (not the bundle) so authenticated seller
        // actions like the CADASTRO COMPLETO (/api/onboard-draft) can re-verify email + code.
        const s = { ...d.seller, code: code.trim() };
        try {
          localStorage.setItem(SELLER_KEY, JSON.stringify(s));
          if (s.ref) localStorage.setItem("guileo_ref", JSON.stringify({ ref: s.ref, at: Date.now() }));
        } catch { /* private mode */ }
        onIn(s);
      } else { setErr(t.invalid); setState("idle"); }
    } catch { setErr(t.invalid); setState("idle"); }
  };

  return (
    <div className="surface-real min-h-screen grid place-items-center px-4 py-10 text-g-ink">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-10%] h-[60vh] w-[60vh] -translate-x-1/2 rounded-full bg-g-green/10 blur-[120px]" />
        <div className="absolute right-[10%] bottom-[5%] h-[40vh] w-[40vh] rounded-full bg-g-gold/10 blur-[120px]" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 22, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-xl shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-5">
          <img src={logo} alt="" className="h-10 w-10 object-contain" />
          <div>
            <div className="eyebrow text-[10px]">{t.eyebrow}</div>
            <div className="text-[15px] font-extrabold text-g-word">{t.brand}</div>
          </div>
          <div className="ml-auto flex gap-1">
            {LANGS.map(([c, f]) => <button key={c} onClick={() => setLang(c)} aria-label={`Idioma ${c.toUpperCase()}`} aria-pressed={lang === c} className={`h-7 w-7 rounded-full text-sm ${lang === c ? "bg-g-green/15 ring-1 ring-g-green/30" : "opacity-45"}`}>{f}</button>)}
          </div>
        </div>
        <h1 className="text-2xl font-black text-g-word">{t.loginTitle}</h1>
        <p className="mt-1.5 text-[13px] text-g-muted leading-relaxed">{t.loginSub}</p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.nameField} aria-label={t.nameField} className={field} />
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.email} aria-label={t.email} className={field} />
          <input type="password" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t.code} aria-label={t.code} className={field} />
          {err && <div className="text-[12.5px] text-g-gold">{err}</div>}
          <button type="submit" disabled={state === "go"} className="btn-bright w-full text-[14px]">{state === "go" ? t.entering : t.enter}</button>
        </form>
      </motion.div>
    </div>
  );
}

// ── Pitch Cards (Library + AI) ───────────────────────────────────────────────────
function PitchCards({ t, lang, seller }) {
  const [niche, setNiche] = useState(PITCH_NICHES[0].id);
  const card = PITCH_CARDS[niche] || {};
  const pick = (o) => (o ? (o[lang] || o.en || o.pt || "") : "");
  // AI personalization
  const [biz, setBiz] = useState(""); const [city, setCity] = useState(""); const [notes, setNotes] = useState("");
  const [aiState, setAiState] = useState("idle"); const [aiText, setAiText] = useState(""); const [copied, setCopied] = useState(false);
  // Objection-buster
  const [obj, setObj] = useState(""); const [objState, setObjState] = useState("idle"); const [objText, setObjText] = useState(""); const [objCopied, setObjCopied] = useState(false);
  const runObj = async () => {
    if (!obj.trim()) return;
    setObjState("go"); setObjText("");
    try {
      const r = await fetch("/api/pitch-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sid: sellerSid(), mode: "objection", objection: obj, niche: nicheName, lang }) });
      const d = await r.json().catch(() => ({}));
      if (sidExpired(d)) { setObjText("Sua sessão expirou — entre de novo pra usar a IA."); setObjState("err"); }
      else if (d?.ok && d.text) { setObjText(d.text); setObjState("done"); if (seller) logSellerEvent(seller, "pitch"); } else { setObjState("err"); }
    } catch { setObjState("err"); }
  };
  const nicheName = useMemo(() => pick((PITCH_NICHES.find((n) => n.id === niche) || {}).name), [niche, lang]);

  const runAi = async () => {
    setAiState("go"); setAiText("");
    try {
      const r = await fetch("/api/pitch-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sid: sellerSid(), niche: nicheName, business: biz, city, notes, lang }) });
      const d = await r.json().catch(() => ({}));
      if (sidExpired(d)) { setAiText("Sua sessão expirou — entre de novo pra usar a IA."); setAiState("err"); }
      else if (d?.ok && d.text) { setAiText(d.text); setAiState("done"); if (seller) logSellerEvent(seller, "pitch"); } else { setAiState("err"); }
    } catch { setAiState("err"); }
  };

  const Block = ({ label, children, tone = "word" }) => (
    <div className="card p-4">
      <div className={`text-[10.5px] font-black uppercase tracking-wider ${tone === "gold" ? "text-g-gold" : tone === "green" ? "text-g-green" : "text-g-muted"}`}>{label}</div>
      <div className="mt-1.5 text-[13.5px] leading-relaxed text-g-word">{children}</div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black text-g-word">{t.cardsTitle}</h2>
        <p className="text-[13px] text-g-muted mt-1 max-w-2xl">{t.cardsSub}</p>
      </div>
      {/* niche picker */}
      <div className="flex flex-wrap gap-2">
        {PITCH_NICHES.map((n) => (
          <button key={n.id} onClick={() => { setNiche(n.id); setAiText(""); setAiState("idle"); }}
            className={`rounded-full px-3.5 py-2 text-[12.5px] font-bold transition ${niche === n.id ? "bg-g-green/15 text-g-word ring-1 ring-g-green/40" : "bg-white/[0.04] text-g-muted ring-1 ring-white/10 hover:text-g-word"}`}>
            <span className="mr-1">{n.emoji}</span>{pick(n.name)}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <a href={`/kit/${niche}`} className="inline-flex items-center gap-1.5 rounded-full border border-g-gold/35 bg-g-gold/[0.08] px-3.5 py-1.5 text-[12px] font-bold text-g-gold hover:bg-g-gold/[0.16]">{t.kitLink}</a>
      </div>

      <motion.div key={niche} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="grid gap-3 md:grid-cols-2">
          <Block label={t.fPain} tone="gold">{pick(card.pain)}</Block>
          <Block label={t.fLeak}>{pick(card.leak)}</Block>
          <Block label={t.fSolution} tone="green">{pick(card.solution)}</Block>
          <Block label={t.fGain} tone="green">
            <ul className="space-y-1">{(card.gain || []).map((g, i) => <li key={i} className="flex gap-2"><span className="text-g-green">✓</span>{pick(g)}</li>)}</ul>
          </Block>
          <Block label={t.fEdge} tone="gold">{pick(card.edge)}</Block>
          <Block label={t.fOpener}>“{pick(card.opener)}”</Block>
          <Block label={t.fDiscovery}>
            <ul className="space-y-1">{(card.discovery || []).map((q, i) => <li key={i} className="flex gap-2"><span className="text-g-gold">{i + 1}.</span>{pick(q)}</li>)}</ul>
          </Block>
          <Block label={t.fObjection}>
            <div className="font-bold text-g-word">“{pick(card.objection?.q)}”</div>
            <div className="mt-1 text-g-ink">→ {pick(card.objection?.a)}</div>
          </Block>
      </motion.div>

      {/* AI personalization */}
      <div className="rounded-2xl border border-g-gold/25 bg-g-gold/[0.05] p-5">
        <div className="text-sm font-extrabold text-g-gold">✨ {t.aiTitle}</div>
        <p className="text-[12.5px] text-g-muted mt-1">{t.aiSub}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input value={biz} onChange={(e) => setBiz(e.target.value)} placeholder={t.aiBiz} className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-[13px] text-g-word placeholder:text-g-muted/60 focus:outline-none focus:border-g-gold/50" />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t.aiCity} className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-[13px] text-g-word placeholder:text-g-muted/60 focus:outline-none focus:border-g-gold/50" />
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.aiNotes} className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-[13px] text-g-word placeholder:text-g-muted/60 focus:outline-none focus:border-g-gold/50" />
        </div>
        <button onClick={runAi} disabled={aiState === "go"} className="btn-gold ai-cta text-[13px] mt-3">✨ {aiState === "go" ? t.aiGoing : t.aiGo}</button>
        {aiState === "err" && <div className="text-[12px] text-g-gold mt-2">{t.aiErr}</div>}
        {aiState === "done" && aiText && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl border border-white/10 bg-[#0d0c0a]/40 p-4">
            <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-g-word font-sans">{aiText}</pre>
            <button onClick={() => { navigator.clipboard?.writeText(aiText); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="btn-ghost text-[12px] mt-3">{copied ? t.copied : t.copy}</button>
          </motion.div>
        )}
      </div>

      {/* Objection-buster */}
      <div className="rounded-2xl border border-g-green/25 bg-g-green/[0.05] p-5">
        <div className="text-sm font-extrabold text-g-green">🛡️ {t.objTitle}</div>
        <p className="text-[12.5px] text-g-muted mt-1">{t.objSub}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input value={obj} onChange={(e) => setObj(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runObj(); }} placeholder={t.objPh}
            className="flex-1 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-[13px] text-g-word placeholder:text-g-muted/60 focus:outline-none focus:border-g-green/50" />
          <button onClick={runObj} disabled={objState === "go"} className="btn-bright ai-cta text-[13px] shrink-0">✨ {objState === "go" ? t.objGoing : t.objGo}</button>
        </div>
        {objState === "err" && <div className="text-[12px] text-g-gold mt-2">{t.aiErr}</div>}
        {objState === "done" && objText && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl border border-white/10 bg-[#0d0c0a]/40 p-4">
            <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-g-word font-sans">{objText}</pre>
            <button onClick={() => { navigator.clipboard?.writeText(objText); setObjCopied(true); setTimeout(() => setObjCopied(false), 1500); }} className="btn-ghost text-[12px] mt-3">{objCopied ? t.copied : t.copy}</button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ── Academy (pocket) ─────────────────────────────────────────────────────────────
function Academy({ t, lang }) {
  const a = ACAD[lang] || ACAD.en;
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black text-g-word">{t.acadTitle}</h2>
        <p className="text-[13px] text-g-muted mt-1 max-w-2xl">{t.acadSub}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <div className="text-[11px] font-black uppercase tracking-wider text-g-green">🔍 {t.q5}</div>
          <ol className="mt-2 space-y-1.5">{a.q5.map((q, i) => <li key={i} className="flex gap-2 text-[13px] text-g-word"><span className="font-black text-g-green">{i + 1}.</span>{q}</li>)}</ol>
        </div>
        <div className="card p-5">
          <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">🛡️ {t.obj}</div>
          <div className="mt-2 space-y-2">{a.obj.map(([o, ans]) => <div key={o} className="text-[12.5px] leading-snug"><span className="font-black text-g-word">{o}</span> <span className="text-g-ink">{ans}</span></div>)}</div>
        </div>
        <div className="card p-5">
          <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">📋 {t.plan}</div>
          <div className="mt-2 space-y-1">{a.plan.map((m) => <div key={m} className={`text-[12.5px] font-semibold ${m.includes("⚡") ? "text-g-gold" : "text-g-word"}`}>{m}</div>)}</div>
        </div>
        <div className="rounded-2xl border border-[#d8916e]/25 bg-[#d8916e]/[0.05] p-5">
          <div className="text-[11px] font-black uppercase tracking-wider text-[#d8916e]">🚫 {t.never}</div>
          <p className="mt-2 text-[12.5px] leading-snug text-g-ink">{a.never}</p>
        </div>
      </div>
      {/* tracks */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5">
          <div className="text-[11px] font-black uppercase tracking-wider text-g-green">{t.trackA}</div>
          <p className="mt-1.5 text-[13px] text-g-word leading-relaxed">{t.trackADesc}</p>
        </div>
        <div className="card p-5">
          <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{t.trackB}</div>
          <p className="mt-1.5 text-[13px] text-g-word leading-relaxed">{t.trackBDesc}</p>
        </div>
      </div>
      <div>
        <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-g-muted">{t.fullMaterial}</div>
        <div className="flex flex-wrap gap-2">
          {TOOLS.map(([href, ic, label]) => (
            <a key={href} href={href} className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[12.5px] font-bold text-g-word hover:border-g-green/30">{ic} {label}</a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Support ──────────────────────────────────────────────────────────────────────
function Support({ t }) {
  const [invCopied, setInvCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://guileoai.com";
  const invite = `🧰 ${t.invTitle} — Guileo\n${origin}/vendedor\n👉 ${t.code || "Código"}: GUILEO-TIME-2026`;
  const rows = [
    { ic: "🆘", title: t.supLuis, desc: t.supLuisD, href: waLink("Luis, preciso de uma ajuda rápida:"), cta: "WhatsApp" },
    { ic: "💬", title: t.supTeam, desc: t.supTeamD, href: waLink("Suporte Guileo — preciso de ajuda:"), cta: "WhatsApp" },
    { ic: "✉️", title: t.supEmail, desc: t.supEmailD, href: `mailto:${CONTACT.email}`, cta: t.supEmail },
  ];
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black text-g-word">{t.supTitle}</h2>
        <p className="text-[13px] text-g-muted mt-1 max-w-2xl">{t.supSub}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {rows.map((r) => (
          <a key={r.title} href={r.href} target="_blank" rel="noopener" className="card p-5 block hover:-translate-y-1">
            <div className="text-2xl">{r.ic}</div>
            <div className="mt-2 text-[14px] font-extrabold text-g-word">{r.title}</div>
            <div className="text-[12.5px] text-g-muted mt-0.5">{r.desc}</div>
            <div className="mt-3 inline-flex rounded-full bg-g-green/15 px-3 py-1 text-[11.5px] font-bold text-g-green ring-1 ring-g-green/30">{r.cta} →</div>
          </a>
        ))}
      </div>

      {/* Invite the team */}
      <div className="rounded-2xl border border-g-gold/25 bg-g-gold/[0.05] p-5">
        <div className="text-sm font-extrabold text-g-gold">🤝 {t.invTitle}</div>
        <p className="text-[12.5px] text-g-muted mt-1">{t.invSub}</p>
        <div className="mt-3 rounded-xl border border-white/10 bg-[#0d0c0a]/40 p-3 font-mono text-[12px] leading-relaxed text-g-word whitespace-pre-wrap">{invite}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => { navigator.clipboard?.writeText(invite); setInvCopied(true); setTimeout(() => setInvCopied(false), 1600); }} className="btn-ghost text-[13px]">{invCopied ? t.invCopied : t.invCopy}</button>
          <a href={waLink(invite)} target="_blank" rel="noopener" className="btn-bright text-[13px]">{t.invWa}</a>
        </div>
      </div>
    </div>
  );
}

// ── Start ────────────────────────────────────────────────────────────────────────
function Start({ t, go }) {
  const [showGuide, setShowGuide] = useState(() => { try { return !localStorage.getItem("guileo_seller_guide"); } catch { return true; } });
  const dismissGuide = () => { try { localStorage.setItem("guileo_seller_guide", "1"); } catch { /* ignore */ } setShowGuide(false); };
  return (
    <div className="space-y-6">
      {showGuide && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-g-gold/30 bg-g-gold/[0.06] p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-extrabold text-g-gold">✨ {t.guideTitle}</div>
            <button onClick={dismissGuide} className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-bold text-g-muted hover:text-g-word">{t.guideGot}</button>
          </div>
          <ol className="mt-3 space-y-1.5">
            {t.guideSteps.map((s, i) => <li key={i} className="flex gap-2 text-[13px] text-g-word"><span className="font-black text-g-gold">{i + 1}.</span>{s}</li>)}
          </ol>
        </motion.div>
      )}
      <div className="rounded-2xl border border-g-green/25 bg-g-green/[0.05] p-6">
        <div className="eyebrow text-[10px]">{t.stratTitle}</div>
        <p className="mt-2 text-[15px] font-bold leading-relaxed text-g-word">{t.stratLine}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {t.arc.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className="rounded-full bg-white/[0.05] px-3 py-1.5 text-[12px] font-bold text-g-word ring-1 ring-white/10">{s}</span>
              {i < t.arc.length - 1 && <span className="text-g-gold">→</span>}
            </div>
          ))}
        </div>
      </div>
      <blockquote className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-[14px] font-semibold italic leading-relaxed text-g-word">“{t.sentence}”</blockquote>
      <div className="grid gap-3 sm:grid-cols-3">
        {[["cards", "🃏", t.nav.cards], ["quote", "📄", t.nav.quote], ["academy", "🎓", t.nav.academy]].map(([k, ic, label]) => (
          <button key={k} onClick={() => go(k)} className="card p-5 text-left hover:-translate-y-1">
            <div className="text-2xl">{ic}</div>
            <div className="mt-2 text-[14px] font-extrabold text-g-word">{label}</div>
          </button>
        ))}
      </div>
      <p className="text-[12.5px] text-g-muted">{t.startHint}</p>
    </div>
  );
}

// ── My Goals (per-seller targets + auto-tracked numbers + referral link) ─────────
function Metas({ t, seller }) {
  const [act, setAct] = useState(null);
  const [leads, setLeads] = useState(null);
  const [comm, setComm] = useState(null); // commission block from /api/seller-stats (earned vs potential)
  const [goals, setGoals] = useState({ demos: 0, deals: 0, revenue: 0, doneDemos: 0, doneDeals: 0, doneRevenue: 0 });
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState("");
  const refLink = `${window.location.origin}/?ref=${encodeURIComponent(seller.ref || "")}`;

  // Generate a QR for the referral link — dynamic import keeps qrcode out of the main bundle,
  // and toDataURL renders locally (no external service → CSP-safe).
  useEffect(() => {
    let alive = true;
    import("qrcode").then((m) => (m.default || m).toDataURL(refLink, { margin: 1, width: 220, color: { dark: "#161512", light: "#ffffff" } }))
      .then((url) => { if (alive) setQr(url); }).catch(() => {});
    return () => { alive = false; };
  }, [refLink]);

  const shareRef = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "Guileo", text: t.refSub, url: refLink });
      else { navigator.clipboard?.writeText(refLink); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    } catch { /* user cancelled share */ }
  };

  useEffect(() => {
    fetch("/api/seller-stats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "me", email: seller.email, ref: seller.ref, seller_code: seller.code || "" }) })
      .then((r) => r.json()).then((d) => { setAct(d.act || {}); setLeads(typeof d.attributedLeads === "number" ? d.attributedLeads : null); setComm(d.commissions || null); if (d.goals) setGoals((g) => ({ ...g, ...d.goals })); }).catch(() => setAct({}));
  }, [seller.email]);

  const saveGoals = async () => {
    setSaved(false);
    try {
      await fetch("/api/seller-stats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "goals", email: seller.email, goals, seller_code: seller.code || "" }) });
      setSaved(true); setTimeout(() => setSaved(false), 1600);
    } catch { /* ignore */ }
  };
  const bump = (k, d) => setGoals((g) => ({ ...g, [k]: Math.max(0, (parseInt(g[k], 10) || 0) + d) }));
  const numField = "w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-[14px] text-g-word focus:outline-none focus:border-g-green/50";

  const Stat = ({ label, value }) => (
    <div className="card p-4 text-center"><div className="text-2xl font-black text-g-word">{value ?? "—"}</div><div className="mt-1 text-[11px] uppercase tracking-wide text-g-muted">{label}</div></div>
  );
  const Goal = ({ label, kField, dField, money }) => (
    <div className="card p-4">
      <div className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{label}</div>
      <div className="mt-2 flex items-center gap-2">
        <button onClick={() => bump(dField, -1)} className="h-8 w-8 shrink-0 rounded-full border border-white/15 text-g-word">−</button>
        <div className="flex-1 text-center">
          <span className="text-xl font-black text-g-green">{money ? `$${goals[dField] || 0}` : goals[dField] || 0}</span>
          <span className="text-[12px] text-g-muted"> / {t.target} </span>
          <input type="number" value={goals[kField] || 0} onChange={(e) => setGoals((g) => ({ ...g, [kField]: Math.max(0, parseInt(e.target.value, 10) || 0) }))} className="w-16 rounded border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-center text-[13px] text-g-word" />
        </div>
        <button onClick={() => bump(dField, 1)} className="h-8 w-8 shrink-0 rounded-full border border-g-green/40 bg-g-green/[0.1] text-g-green">+</button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-gradient-to-r from-g-green to-g-light" style={{ width: `${Math.min(100, ((goals[dField] || 0) / Math.max(1, goals[kField] || 0)) * 100)}%` }} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div><h2 className="text-xl font-black text-g-word">{t.metasTitle}</h2><p className="text-[13px] text-g-muted mt-1 max-w-2xl">{t.metasSub}</p></div>

      <div>
        <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-g-gold">{t.yourNumbers}</div>
        <div className={`grid grid-cols-2 gap-3 ${leads != null ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
          <Stat label={t.mLogins} value={act?.logins} /><Stat label={t.mQuotes} value={act?.quotes} /><Stat label={t.mPitches} value={act?.pitches} />
          {leads != null && (
            <div className="card p-4 text-center ring-1 ring-g-green/30 bg-g-green/[0.05]"><div className="text-2xl font-black text-g-green">{leads}</div><div className="mt-1 text-[11px] uppercase tracking-wide text-g-muted">{t.mLeads}</div></div>
          )}
        </div>
      </div>

      {/* 💰 Commissions — EARNED (pct × real registered payments, via seller_conversions) when the
          server can detect it, otherwise a clearly-labeled POTENTIAL estimate. Never fake money. */}
      {comm && (
        <div className={`rounded-2xl border p-5 ${comm.kind === "earned" ? "border-g-green/25 bg-g-green/[0.05]" : "border-g-gold/25 bg-g-gold/[0.05]"}`}>
          <div className={`text-sm font-extrabold ${comm.kind === "earned" ? "text-g-green" : "text-g-gold"}`}>💰 {t.comTitle}</div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="card p-4 text-center"><div className="text-2xl font-black text-g-word">{leads ?? comm.leads ?? "—"}</div><div className="mt-1 text-[11px] uppercase tracking-wide text-g-muted">{t.comLeads}</div></div>
            <div className="card p-4 text-center"><div className="text-2xl font-black text-g-word">{comm.kind === "earned" ? comm.converted : "—"}</div><div className="mt-1 text-[11px] uppercase tracking-wide text-g-muted">{t.comConv}</div></div>
            <div className="card p-4 text-center">
              <div className={`text-2xl font-black ${comm.kind === "earned" ? "text-g-green" : "text-g-gold"}`}>${(comm.kind === "earned" ? comm.earned : comm.potential).toLocaleString("en-US")}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-g-muted">{comm.kind === "earned" ? t.comEarned : t.comPotential}</div>
            </div>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-g-muted">
            {comm.kind === "earned" ? `${comm.pct}% ${t.comEarnedNote}` : `${comm.pct}% · ${t.comPotentialNote}`}
          </p>
          {comm.kind !== "earned" && <p className="mt-1 text-[12px] leading-relaxed text-g-muted">{t.comManual}</p>}
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-g-green">{t.yourGoals}</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Goal label={t.gDemos} kField="demos" dField="doneDemos" />
          <Goal label={t.gDeals} kField="deals" dField="doneDeals" />
          <Goal label={t.gRevenue} kField="revenue" dField="doneRevenue" money />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={saveGoals} className="btn-bright text-[13px]">{saved ? t.saved : t.save}</button>
          <span className="text-[11.5px] text-g-muted">{t.logHint}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-g-gold/25 bg-g-gold/[0.05] p-5">
        <div className="text-sm font-extrabold text-g-gold">🔗 {t.refTitle}</div>
        <p className="text-[12.5px] text-g-muted mt-1">{t.refSub}</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
          {qr && <img src={qr} alt="QR" width="110" height="110" className="h-[110px] w-[110px] shrink-0 rounded-xl border border-white/10 bg-white p-1" />}
          <div className="flex-1 min-w-0">
            <input readOnly value={refLink} onClick={(e) => e.target.select()} aria-label={t.refTitle} className={numField + " w-full font-mono text-[12px]"} />
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => { navigator.clipboard?.writeText(refLink); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="btn-ghost text-[12px]">{copied ? t.linkCopied : t.copyLink}</button>
              <button onClick={shareRef} className="btn-ghost text-[12px]">📲 {t.share}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Treino (roleplay — AI plays a skeptical owner so the seller practices) ───────
function Treino({ t, lang, seller, handoff }) {
  const pick = (o) => (o ? (o[lang] || o.en || o.pt || "") : "");
  // handoff.scenario arrives from a Follow-up card / Targets ("🎭 treinar essa conversa") —
  // seed the niche (when it matches a real one) and auto-start the roleplay in context.
  const sc = handoff?.scenario || null;
  const scNiche = sc && PITCH_NICHES.find((n) => n.id === sc.niche) ? sc.niche : null;
  const [niche, setNiche] = useState(scNiche || PITCH_NICHES[0].id);
  const [started, setStarted] = useState(false);
  const [msgs, setMsgs] = useState([]);            // {role:'client'|'seller', text}
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [fb, setFb] = useState(""); const [fbState, setFbState] = useState("idle");
  const nicheName = pick((PITCH_NICHES.find((n) => n.id === niche) || {}).name);
  const sellerTurns = msgs.filter((m) => m.role === "seller").length;

  const start = () => { setMsgs([{ role: "client", text: t.trainFirst }]); setStarted(true); setFb(""); setFbState("idle"); if (seller) logSellerEvent(seller, "pitch"); };
  // auto-start once when we arrive with a scenario (business/stage context from the pipeline)
  useEffect(() => { if (sc && !started) start(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const reset = () => { setStarted(false); setMsgs([]); setInput(""); setFb(""); setFbState("idle"); };

  const getFeedback = async () => {
    if (fbState === "go" || !sellerTurns) return;
    setFbState("go"); setFb("");
    try {
      const r = await fetch("/api/pitch-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sid: sellerSid(), mode: "feedback", history: msgs, lang }) });
      const d = await r.json().catch(() => ({}));
      if (sidExpired(d)) { setFb("Sua sessão expirou — entre de novo pra usar a IA."); setFbState("err"); }
      else if (d?.ok && d.text) { setFb(d.text); setFbState("done"); } else setFbState("err");
    } catch { setFbState("err"); }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || typing) return;
    const history = msgs.slice();
    setMsgs((m) => [...m, { role: "seller", text }]); setInput(""); setTyping(true);
    try {
      const r = await fetch("/api/pitch-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sid: sellerSid(), mode: "roleplay", niche: nicheName, message: text, history, lang }) });
      const d = await r.json().catch(() => ({}));
      setMsgs((m) => [...m, { role: "client", text: sidExpired(d) ? "Sua sessão expirou — entre de novo pra treinar." : (d?.reply || "…") }]);
    } catch { setMsgs((m) => [...m, { role: "client", text: "…" }]); }
    setTyping(false);
  };

  return (
    <div className="space-y-4">
      <div><h2 className="text-xl font-black text-g-word">🥊 {t.trainTitle}</h2><p className="text-[13px] text-g-muted mt-1 max-w-2xl">{t.trainSub}</p></div>
      {sc && (sc.business || sc.stage) && (
        <div className="rounded-xl border border-g-green/25 bg-g-green/[0.06] px-4 py-2.5 text-[12.5px] text-g-word">
          🎯 {sc.business ? <b>{sc.business}</b> : nicheName}{sc.stage ? <span className="text-g-muted"> · {sc.stage}</span> : ""}{sc.market ? <span className="text-g-muted"> · {sc.market === "br" ? "🇧🇷" : "🇺🇸"}</span> : ""}
        </div>
      )}

      {!started ? (
        <div className="card p-5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-g-muted mb-2">{t.pickNiche}</div>
          <div className="flex flex-wrap gap-2">
            {PITCH_NICHES.map((n) => (
              <button key={n.id} onClick={() => setNiche(n.id)} className={`rounded-full px-3.5 py-2 text-[12.5px] font-bold transition ${niche === n.id ? "bg-g-green/15 text-g-word ring-1 ring-g-green/40" : "bg-white/[0.04] text-g-muted ring-1 ring-white/10 hover:text-g-word"}`}><span className="mr-1">{n.emoji}</span>{pick(n.name)}</button>
            ))}
          </div>
          <button onClick={start} className="btn-bright ai-cta text-[14px] mt-4">✨ {t.trainStart} →</button>
          <p className="text-[11.5px] text-g-muted mt-3">{t.trainHint}</p>
        </div>
      ) : (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] font-bold text-g-word">{PITCH_NICHES.find((n) => n.id === niche)?.emoji} {nicheName}</div>
            <button onClick={reset} className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-bold text-g-muted hover:text-g-word">↻ {t.trainReset}</button>
          </div>
          <div className="max-h-[52vh] overflow-y-auto space-y-2 pr-1" aria-live="polite" aria-label="Conversa de treino">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "seller" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug ${m.role === "seller" ? "bg-g-green/15 text-g-word ring-1 ring-g-green/25" : "bg-white/[0.05] text-g-ink ring-1 ring-white/10"}`}>{m.text}</div>
              </div>
            ))}
            {typing && <div className="flex justify-start"><div className="rounded-2xl bg-white/[0.05] px-3.5 py-2 text-[12px] text-g-muted ring-1 ring-white/10">{t.trainTyping}</div></div>}
          </div>
          <div className="mt-3 flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder={t.trainPh} aria-label={t.trainPh}
              className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-2.5 text-[14px] text-g-word placeholder:text-g-muted/60 focus:outline-none focus:border-g-green/50" />
            <button onClick={send} disabled={typing || !input.trim()} className="btn-bright text-[13px] shrink-0 disabled:opacity-40">{t.trainSend}</button>
          </div>
          {sellerTurns > 0 && (
            <div className="mt-3">
              <button onClick={getFeedback} disabled={fbState === "go"} className="btn-ghost text-[12px] disabled:opacity-50">{fbState === "go" ? t.trainFeedbackGoing : t.trainFeedback}</button>
              {fbState === "err" && <span className="ml-2 text-[12px] text-g-gold">{t.aiErr}</span>}
              {fbState === "done" && fb && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl border border-g-gold/30 bg-g-gold/[0.06] p-4">
                  <div className="text-[11px] font-black uppercase tracking-wide text-g-gold mb-1.5">{t.trainTips}</div>
                  <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-g-word font-sans">{fb}</pre>
                </motion.div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Copiloto de Ativação — AI helper so the rep isn't blocked waiting on Luis. Reuses the hardened
//    /api/activation-assist (fable-5→sonnet→haiku fallback). Local micro-dict keyed by lang. ──
const COPILOT_TXT = {
  pt: { title: "Copiloto de Ativação", sub: "Travou numa ativação? Pergunte aqui — respondo na hora (login do portal, desvio *72, cliente pagou e não conectou, ou escrevo a mensagem pro cliente).", ph: "Ex: o cliente pagou mas o portal está vazio…", send: "Enviar", thinking: "Pensando…", err: "Não consegui responder agora — tente de novo.", copy: "📋 Copiar", copied: "Copiado ✓", more: "Continuar com:", chips: ["💳 Cliente pagou e não conectou", "📞 Como desviar a linha?", "💬 Escreva a mensagem de boas-vindas pro cliente", "☎️ Qual número o cliente disca?"], followups: ["✍️ Escreve isso como mensagem pro cliente", "🧭 E qual é o próximo passo?", "🤔 E se isso não resolver?"] },
  en: { title: "Activation Copilot", sub: "Stuck on an activation? Ask here — instant answers (portal login, *72 forwarding, paid-but-not-connected, or I'll write the message to send the client).", ph: "e.g. the client paid but the portal is empty…", send: "Send", thinking: "Thinking…", err: "Couldn't answer right now — try again.", copy: "📋 Copy", copied: "Copied ✓", more: "Keep going:", chips: ["💳 Client paid but didn't connect", "📞 How do I forward the line?", "💬 Write the welcome message for the client", "☎️ Which number does the client dial?"], followups: ["✍️ Turn that into a message for the client", "🧭 What's the next step?", "🤔 And if that doesn't fix it?"] },
  es: { title: "Copiloto de Activación", sub: "¿Atascado en una activación? Pregunta aquí — respuestas al instante (login del portal, desvío *72, pagó y no conecta, o te escribo el mensaje para el cliente).", ph: "ej: el cliente pagó pero el portal está vacío…", send: "Enviar", thinking: "Pensando…", err: "No pude responder ahora — inténtalo de nuevo.", copy: "📋 Copiar", copied: "Copiado ✓", more: "Seguir con:", chips: ["💳 El cliente pagó pero no conectó", "📞 ¿Cómo desvío la línea?", "💬 Escribe el mensaje de bienvenida para el cliente", "☎️ ¿Qué número marca el cliente?"], followups: ["✍️ Conviértelo en un mensaje para el cliente", "🧭 ¿Cuál es el siguiente paso?", "🤔 ¿Y si eso no lo resuelve?"] },
  hi: { title: "एक्टिवेशन कोपायलट", sub: "एक्टिवेशन में अटक गए? यहाँ पूछें — तुरंत जवाब (पोर्टल लॉगिन, *72 फ़ॉरवर्डिंग, पेमेंट हुआ पर कनेक्ट नहीं, या मैं ग्राहक को भेजने का मैसेज लिख दूँ)।", ph: "जैसे: ग्राहक ने भुगतान किया पर पोर्टल खाली है…", send: "भेजें", thinking: "सोच रहा हूँ…", err: "अभी जवाब नहीं दे सका — फिर से कोशिश करें।", copy: "📋 कॉपी", copied: "कॉपी हो गया ✓", more: "आगे बढ़ें:", chips: ["💳 ग्राहक ने पे किया पर कनेक्ट नहीं", "📞 लाइन कैसे फ़ॉरवर्ड करूँ?", "💬 ग्राहक के लिए वेलकम मैसेज लिखें", "☎️ ग्राहक कौन सा नंबर डायल करे?"], followups: ["✍️ इसे ग्राहक के लिए मैसेज बना दो", "🧭 अगला कदम क्या है?", "🤔 अगर इससे हल न हो तो?"] },
};
function ActivationCopilot({ lang = "pt" }) {
  const c = COPILOT_TXT[lang] || COPILOT_TXT.pt;
  const [msgs, setMsgs] = useState([]); // {role, content}
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedAt, setCopiedAt] = useState(-1);
  const boxRef = useRef(null);
  useEffect(() => { if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight; }, [msgs, busy]);

  async function ask(text) {
    const q = (text || input).trim();
    if (!q || busy) return;
    const next = [...msgs, { role: "user", content: q }];
    setMsgs(next); setInput(""); setBusy(true);
    try {
      const r = await fetch("/api/activation-assist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang, messages: next.slice(-10) }) });
      const d = await r.json().catch(() => ({}));
      setMsgs((m) => [...m, { role: "assistant", content: d.reply || c.err }]);
    } catch { setMsgs((m) => [...m, { role: "assistant", content: c.err }]); }
    setBusy(false);
  }

  const copyReply = (i, text) => {
    navigator.clipboard?.writeText(text);
    setCopiedAt(i); setTimeout(() => setCopiedAt(-1), 1500);
  };
  // Assistant replies that read like a ready-to-forward message get a 📋 copy button.
  const copyable = (text) => text.length > 120 || text.includes("\n");
  const lastIsBot = msgs.length > 0 && msgs[msgs.length - 1].role === "assistant";

  const Avatar = ({ role }) => (
    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] ring-1 ${role === "user" ? "bg-g-green/15 ring-g-green/30" : "bg-[#FF8A33]/15 ring-[#FF8A33]/30"}`}>{role === "user" ? "👤" : "🤖"}</span>
  );

  return (
    <div className="card p-5 border-g-green/25">
      <div className="flex items-center gap-2 text-[14px] font-black text-g-word">
        <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-g-green/50" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-g-green" /></span>
        🤖 {c.title}
      </div>
      <p className="mt-1 text-[12.5px] text-g-muted max-w-2xl">{c.sub}</p>

      {msgs.length > 0 && (
        <div ref={boxRef} className="mt-3 max-h-[320px] space-y-2 overflow-y-auto pr-1" aria-live="polite">
          {msgs.map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className={`flex items-end gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <Avatar role={m.role} />
              <div className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${m.role === "user" ? "bg-g-green/15 text-g-word ring-1 ring-g-green/30" : "bg-white/[0.04] text-g-ink ring-1 ring-g-line"}`}>
                <Bold text={m.content} />
                {m.role === "assistant" && copyable(m.content) && (
                  <div className="mt-2">
                    <button type="button" onClick={() => copyReply(i, m.content)} className="rounded-full border border-white/15 px-2.5 py-0.5 text-[11px] font-bold text-g-muted hover:text-g-word">{copiedAt === i ? c.copied : c.copy}</button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {busy && (
            <div className="flex items-end gap-2">
              <Avatar role="assistant" />
              <div className="rounded-2xl bg-white/[0.04] px-3.5 py-2.5 ring-1 ring-g-line"><TypingDots /></div>
            </div>
          )}
        </div>
      )}

      {/* starter chips before the chat · follow-up chips after each reply */}
      {msgs.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.chips.map((chip) => (
            <button key={chip} onClick={() => ask(chip)} className="rounded-full border border-g-line bg-white/[0.04] px-3 py-1.5 text-[12px] font-semibold text-g-ink transition hover:border-g-green/40 hover:text-g-word">{chip}</button>
          ))}
        </div>
      )}
      {lastIsBot && !busy && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{c.more}</span>
          {c.followups.map((chip) => (
            <button key={chip} onClick={() => ask(chip)} className="rounded-full border border-[#FF8A33]/25 bg-[#FF8A33]/[0.06] px-3 py-1.5 text-[12px] font-semibold text-g-ink transition hover:border-[#FF8A33]/50 hover:text-g-word">{chip}</button>
          ))}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="mt-3 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={c.ph} className="flex-1 rounded-xl border border-g-line bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-g-word placeholder:text-g-muted/70 focus:border-g-green/40 focus:outline-none" />
        <button type="submit" disabled={busy || !input.trim()} className="btn-bright ai-cta shrink-0 px-4 text-[13px] disabled:opacity-50">✨ {busy ? c.thinking : c.send}</button>
      </form>
    </div>
  );
}

// ── Ativação (step-by-step to get a paid client's Gui live) ──────────────────────
function Ativacao({ t, lang, seller }) {
  return (
    <div className="space-y-6">
      <div><h2 className="text-xl font-black text-g-word">🚀 {t.ativTitle}</h2><p className="text-[13px] text-g-muted mt-1 max-w-2xl">{t.ativSub}</p></div>

      {/* 🚀 the 7-step Client #1 runbook — the "how activation works" guide (same in /admin) */}
      <ActivationRunbook lang={lang} />

      {/* 💼 the seller's wallet lives on top — every client, pipeline + connection key */}
      <SellerClients lang={lang} seller={seller} />

      <ActivationCopilot lang={lang} />

      {/* SAME activation map the owner sees in /admin — one source: src/data/activation.js
          (secrets/internal URLs stay admin-only). */}
      <p className="text-[12.5px] font-semibold text-g-muted">{t.ativParity}</p>
      <div className="space-y-3">
        {ACTIVATION_STEPS.map((s, i) => (
          <div key={i} className="card p-5 flex gap-4">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-g-green/15 font-black text-g-green ring-1 ring-g-green/30">{i + 1}</div>
            <div className="min-w-0">
              <div className="text-[14px] font-extrabold text-g-word">{s.icon} {pickL(s.title, lang)}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-g-muted">{pickL(s.body, lang)}</p>
            </div>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-g-gold">{t.ativSectorTitle}</div>
        <div className="grid gap-3 md:grid-cols-3">
          {ACTIVATION_SECTORS.map((s) => (
            <div key={s.icon} className="card p-4">
              <div className="text-[13px] font-extrabold text-g-word">{s.icon} {pickL(s.name, lang)}</div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-g-muted">{pickL(s.note, lang)}</p>
            </div>
          ))}
        </div>
      </div>

      <a href={waLink("Luis, preciso de ajuda na ativação de um cliente:")} target="_blank" rel="noopener" className="btn-bright inline-flex text-[13px]">💬 {t.ativHelp}</a>
    </div>
  );
}

// ── Cadastrar cliente (CADASTRO COMPLETO — OnboardWizard + the seller's own drafts) ─────
function Cadastro({ t, lang, seller, go, handoff }) {
  const [drafts, setDrafts] = useState([]);
  const [state, setState] = useState("loading"); // loading | ok | err
  // handoff arrives from Follow-up ("➕ cadastrar <negócio>") — prefill the wizard with what we know.
  const prefill = handoff && (handoff.business || handoff.email || handoff.contact || handoff.phone)
    ? { business: handoff.business || "", email: handoff.email || "", contact: handoff.contact || "", phone: handoff.phone || "" }
    : null;

  const load = async () => {
    try {
      const r = await fetch("/api/onboard-draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list", seller_email: seller.email, seller_code: seller.code || "", seller: { name: seller.name, email: seller.email, ref: seller.ref } }) });
      const d = await r.json().catch(() => ({}));
      const rows = d.rows || d.drafts;
      if (Array.isArray(rows)) { setDrafts(rows); setState("ok"); } else setState("err");
    } catch { setState("err"); }
  };
  useEffect(() => { load(); }, [seller.email]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      {/* link to the wallet — the full per-client view (pipeline + connection key) lives in Ativação */}
      <button type="button" onClick={() => go && go("ativ")} className="inline-flex items-center gap-1.5 rounded-full border border-g-gold/35 bg-g-gold/[0.08] px-3.5 py-1.5 text-[12px] font-bold text-g-gold hover:bg-g-gold/[0.16]">{t.walletLink}</button>

      <OnboardWizard mode="seller" lang={lang} seller={seller} onSaved={load} prefill={prefill} />

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">📋 {t.cadMine}</div>
          <button type="button" onClick={load} className="rounded-full border border-white/15 px-3 py-1 text-[11.5px] font-bold text-g-muted hover:text-g-word">{t.cadRefresh}</button>
        </div>
        {state === "loading" && <div className="mt-3 text-[13px] text-g-muted">…</div>}
        {/* ⚠️ ERA `t.cadNone` — A MESMA FRASE DO VAZIO (auditoria 2026-08-17). Um 401 (o caso real
            de código de equipe sem roster) ou uma queda de rede dizia "nenhum cadastro ainda,
            preencha o formulário acima" — e o vendedor fazia exatamente isso: CADASTRAVA O
            CLIENTE DE NOVO. Erro lido como vazio virou cliente duplicado no funil. */}
        {state === "err" && <div className="mt-3 rounded-xl border border-g-gold/40 bg-g-gold/10 px-3 py-2 text-[12.5px] font-semibold leading-snug text-g-gold">{t.cadErr || t.cadNone}</div>}
        {state === "ok" && drafts.length === 0 && <div className="mt-3 text-[13px] text-g-muted">{t.cadNone}</div>}
        {state === "ok" && drafts.length > 0 && (
          <div className="mt-3 space-y-2">
            {drafts.map((d) => {
              const live = (d.status || "draft") === "live";
              return (
                <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[13px]">
                  <span className="font-bold text-g-word">{d.business || "—"}</span>
                  {d.plan && <span className="text-[11.5px] text-g-muted">{d.plan}</span>}
                  <span className="ml-auto">
                    {live
                      ? <span className="rounded-full bg-g-green/15 px-2.5 py-0.5 text-[11px] font-black text-g-green ring-1 ring-g-green/30">{t.cadLive}</span>
                      : <span className="rounded-full bg-g-gold/[0.14] px-2.5 py-0.5 text-[11px] font-black text-g-gold ring-1 ring-g-gold/35">{t.cadDraft}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


// ── A NAV EM 6 FAMÍLIAS (2026-08-17, decisão do Luis) ─────────────────────────────────────────
// Eram 19 botões numa fileira plana com rolagem horizontal. Nenhuma tela estava órfã — o problema
// era ACHAR: 19 alvos do mesmo tamanho e da mesma cor não têm hierarquia, então o vendedor decora
// posição em vez de procurar por intenção. Quem entra hoje leva semanas pra saber onde está o que.
//
// O agrupamento é pelo MOMENTO do vendedor, não por tipo de tela: ele não pensa "preciso de um
// componente de contrato", pensa "tô fechando". Por isso "fechar" mora em VENDER junto com o
// follow-up, e o contrato mora em MATERIAL junto com o card e o orçamento.
//
// ⚠️ OS TRÊS RÓTULOS LITERAIS ENTRARAM NO DICIONÁRIO. "🗽 NYC" e "🚨 SUPORTE" eram strings fixas —
// um vendedor com a interface em espanhol via duas palavras em português/inglês no meio da nav.
// A regra do dono é "nada de texto EN numa tela PT, em toda superfície"; a nav é a superfície mais
// vista de todas.
const GRUPOS = [
  { id: "vender",   ico: "🎯", rot: { pt: "Vender",   en: "Sell",     es: "Vender",   hi: "बेचें" },   abas: ["start", "alvos", "nyc", "followup", "fechar"] },
  { id: "material", ico: "📄", rot: { pt: "Material", en: "Material", es: "Material", hi: "सामग्री" }, abas: ["cards", "quote", "contrato", "demo"] },
  { id: "cliente",  ico: "🤝", rot: { pt: "Cliente",  en: "Client",   es: "Cliente",  hi: "क्लाइंट" },  abas: ["cadastro", "ativ"] },
  { id: "meu",      ico: "💰", rot: { pt: "Meu",      en: "Mine",     es: "Mío",      hi: "मेरा" },    abas: ["painel", "financeiro", "metas"] },
  { id: "aprender", ico: "🎓", rot: { pt: "Aprender", en: "Learn",    es: "Aprender", hi: "सीखें" },   abas: ["treino", "jogadas", "academy"] },
  { id: "ajuda",    ico: "🚨", rot: { pt: "Ajuda",    en: "Help",     es: "Ayuda",    hi: "मदद" },     abas: ["suporte", "support"] },
];
// Rótulo de cada aba nos 4 idiomas quando o dicionário não tem (eram os 3 literais).
const ABA_EXTRA = {
  nyc:     { pt: "🗽 Leads NYC", en: "🗽 NYC leads", es: "🗽 Leads NYC", hi: "🗽 NYC लीड्स" },
  suporte: { pt: "🚨 Urgente",   en: "🚨 Urgent",    es: "🚨 Urgente",   hi: "🚨 अर्जेंट" },
  demo:    { pt: "🎬 Demo",      en: "🎬 Demo",      es: "🎬 Demo",      hi: "🎬 डेमो" },
};

export default function Vendedor() {
  const { lang: gLang, setLang } = useLang();
  const lang = T[gLang] ? gLang : "pt";
  const t = T[lang] || T.pt;
  const [seller, setSeller] = useState(loadSeller);
  const [tab, setTab] = useState("start");
  // GLOBAL MARKET — one selector in the header drives the WHOLE hub (prices, scripts, currency).
  const [market, setMarket] = useState(() => { try { return localStorage.getItem("guileo_seller_market") === "br" ? "br" : "us"; } catch { return "us"; } });
  const setMarketG = (m) => { const v = m === "br" ? "br" : "us"; setMarket(v); try { localStorage.setItem("guileo_seller_market", v); } catch { /* */ } };
  // HANDOFF — the payload the last nav() call handed to the destination tab (consumed on mount).
  const [handoff, setHandoff] = useState(null);
  // nav(tab, payload?) — the interactivity spine: jump to a tab AND hand it context.
  const nav = (k, payload = null) => { setHandoff(payload); setTab(k); };
  useSeo({ title: `${t.brand} — Guileo`, description: t.loginSub, path: "/vendedor" });
  useEffect(() => { if (!T[gLang]) setLang("pt"); }, [gLang, setLang]);
  useEffect(() => { if (seller?.email) logSellerEvent(seller, "login"); }, [seller?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!seller) return <Login t={t} lang={lang} setLang={setLang} onIn={setSeller} />;

  const logout = () => { try { localStorage.removeItem(SELLER_KEY); } catch { /* ignore */ } setSeller(null); };
  // 🚨 "suporte" fica logo depois de Alvos e renderiza em VERMELHO: é a prioridade nº1 do
  // vendedor — cliente esperando resposta vem antes de prospectar (regra do Luis).
  const NAV = [["start", t.nav.start], ["painel", t.nav.painel], ["alvos", t.nav.alvos], ["nyc", "🗽 NYC"], ["suporte", "🚨 SUPORTE"], ["followup", t.nav.followup], ["fechar", t.nav.fechar], ["demo", t.nav.demo || "🎬 Demo"], ["cards", t.nav.cards], ["quote", t.nav.quote], ["contrato", t.nav.contrato], ["financeiro", t.nav.financeiro], ["cadastro", t.nav.cadastro], ["treino", t.nav.treino], ["ativ", t.nav.ativ], ["metas", t.nav.metas], ["jogadas", t.nav.jogadas], ["academy", t.nav.academy], ["support", t.nav.support]];

  return (
    <div className="surface-real min-h-screen text-g-ink">
      <style>{HUB_CSS}</style>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#161512]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <img src={logo} alt="" className="h-8 w-8 object-contain" />
          <div className="leading-tight min-w-0">
            <div className="text-[13px] font-extrabold text-g-word truncate">{t.brand}</div>
            <div className="hidden sm:block text-[11px] text-g-muted truncate">{t.hi}, {seller.name} 👋</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {/* GLOBAL market — flips the whole hub (prices, scripts, currency) between US and Brazil */}
            <div className="mr-1 flex items-center rounded-full border border-white/10 bg-white/[0.04] p-0.5">
              {[["us", "🇺🇸"], ["br", "🇧🇷"]].map(([m, f]) => (
                <button key={m} onClick={() => setMarketG(m)} aria-label={`Mercado ${m.toUpperCase()}`} aria-pressed={market === m}
                  className={`rounded-full px-2 py-1 text-[13px] transition ${market === m ? "bg-g-green/20 ring-1 ring-g-green/40" : "opacity-45 hover:opacity-80"}`}>{f}</button>
              ))}
            </div>
            {LANGS.map(([c, f]) => <button key={c} onClick={() => setLang(c)} aria-label={`Idioma ${c.toUpperCase()}`} aria-pressed={lang === c} className={`h-7 w-7 rounded-full text-sm ${lang === c ? "bg-g-green/15 ring-1 ring-g-green/30" : "opacity-45"}`}>{f}</button>)}
            <button onClick={logout} className="ml-1 rounded-full border border-white/15 px-3 py-1.5 text-[12px] font-bold text-g-muted hover:text-g-word">{t.logout}</button>
          </div>
        </div>
        {(() => {
          const rotulo = (k) => (ABA_EXTRA[k] && (ABA_EXTRA[k][lang] || ABA_EXTRA[k].en)) || (NAV.find(([kk]) => kk === k) || [])[1] || k;
          // O grupo mostrado é SEMPRE o que contém a aba aberta — assim um link vindo de outra tela
          // (nav("fechar") a partir do painel) abre o grupo certo sozinho, sem o vendedor se perder.
          const grupoAtivo = GRUPOS.find((g) => g.abas.includes(tab)) || GRUPOS[0];
          return (
            <div className="mx-auto max-w-5xl px-3 pb-2">
              <nav className="flex gap-1 overflow-x-auto" aria-label="grupos">
                {GRUPOS.map((g) => {
                  const on = g.id === grupoAtivo.id;
                  const urgente = g.id === "ajuda";
                  return (
                    <button key={g.id} onClick={() => nav(g.abas[0])} aria-current={on ? "true" : undefined}
                      className={`whitespace-nowrap rounded-full px-4 py-1.5 text-[12.5px] font-black transition ${
                        urgente
                          ? (on ? "bg-[#E5484D]/20 text-[#FF7A7E] ring-1 ring-[#E5484D]/60" : "text-[#E5484D] ring-1 ring-[#E5484D]/35 hover:bg-[#E5484D]/10")
                          : (on ? "bg-g-green/15 text-g-word ring-1 ring-g-green/40" : "text-g-muted hover:text-g-word")
                      }`}>{g.ico} {g.rot[lang] || g.rot.en}</button>
                  );
                })}
              </nav>
              {/* As abas do grupo aberto. Ficam SEMPRE visíveis (não é menu que abre e fecha):
                  esconder o segundo nível atrás de um clique troca "fileira longa" por "caça ao
                  tesouro", que é pior. O custo é uma linha fina; o ganho é ver onde se está. */}
              <div className="mt-1.5 flex gap-1 overflow-x-auto border-t border-white/[0.06] pt-1.5">
                {grupoAtivo.abas.map((k) => (
                  <button key={k} onClick={() => nav(k)} aria-current={tab === k ? "page" : undefined}
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-bold transition ${
                      tab === k ? "bg-white/10 text-g-word ring-1 ring-white/20" : "text-g-muted hover:text-g-word"
                    }`}>{rotulo(k)}</button>
                ))}
              </div>
            </div>
          );
        })()}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Keyed remount on tab change → clean fade-in. (AnimatePresence mode="wait" froze the
            subtree and stopped propagating prop/lang updates, so we remount instead.) */}
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
          {tab === "start" && <Start t={t} go={nav} />}
          {tab === "painel" && <SellerDashboard lang={lang} seller={seller} market={market} nav={nav} />}
          {tab === "alvos" && <SellerProspect lang={lang} seller={seller} market={market} nav={nav} />}
          {tab === "nyc" && <SellerLeadsNYC lang={lang} />}
          {tab === "suporte" && <SellerSupport lang={lang} seller={seller} />}
          {tab === "followup" && <SellerFollowup lang={lang} seller={seller} market={market} nav={nav} handoff={handoff} />}
          {tab === "fechar" && <SellerCloser lang={lang} seller={seller} market={market} nav={nav} handoff={handoff} />}
          {tab === "demo" && <DemoEngine surface="seller" />}
          {tab === "jogadas" && <SellerIdeas lang={lang} seller={seller} market={market} nav={nav} />}
          {tab === "cards" && <PitchCards t={t} lang={lang} seller={seller} />}
          {tab === "quote" && <SellerQuote lang={lang} sellerName={seller.name} sellerEmail={seller.email} onQuote={() => logSellerEvent(seller, "quote")} handoff={handoff} market={market} />}
          {tab === "contrato" && <SellerContract lang={lang} seller={seller} market={market} handoff={handoff} />}
          {tab === "financeiro" && <SellerFinance lang={lang} seller={seller} market={market} nav={nav} />}
          {tab === "cadastro" && <Cadastro t={t} lang={lang} seller={seller} go={nav} handoff={handoff} />}
          {tab === "treino" && <Treino t={t} lang={lang} seller={seller} handoff={handoff} />}
          {tab === "ativ" && <Ativacao t={t} lang={lang} seller={seller} />}
          {tab === "metas" && <Metas t={t} seller={seller} />}
          {tab === "academy" && <Academy t={t} lang={lang} />}
          {tab === "support" && <Support t={t} />}
        </motion.div>
      </main>
    </div>
  );
}
