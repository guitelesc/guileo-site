// functions/lib/provision.js — the SHARED Gui-provisioning core.
// One hardened place that turns a client's brain into a live, dedicated ElevenLabs voice agent,
// so BOTH paths use identical logic:
//   • /api/onboard-client  (admin, manual, also buys/binds a number)
//   • /api/stripe-webhook  (self-serve: on payment, the Gui is born automatically)
//
// IDEMPOTENT: if the client already has an agent we UPDATE it in place (never duplicate / double-bill),
// re-applying the current voice + prompt so an existing agent picks up the latest voice on any sync.
// Never throws — returns { ok, agent_id, step } so callers can surface the exact outcome.
import { emitFailure } from "./failure.js";
import { frasefalada } from "./pronuncia.js";
import { guardSystemPrompt } from "./guiConstitution.js";
// O MOTOR DE AGENTE: as lições de ligações reais + a versão que a varredura compara para saber
// quem ficou para trás. Lição nova → sobe VERSAO lá → /api/agent-evolve atualiza a frota inteira.
import { licoesPara, VERSAO as CEREBRO_VERSAO } from "./licoes.js";
export { CEREBRO_VERSAO };
import { upsellSection } from "../../src/data/upsellPlaybook.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// SPOKEN LANGUAGES — every language the voice AGENT detects and answers in on a call (ElevenLabs
// multilingual TTS handles all of these natively). This is DISTINCT from the 4 portal/UI languages
// (EN·PT·ES·HI): the owner reads their dashboard in 4 languages, but their Gui ANSWERS THE PHONE in
// all of these. One source of truth — UIs (OnboardWizard "Idiomas", marketing) render from this list.
// Spoken languages the agent detects & answers in (ElevenLabs multilingual TTS covers all of these).
// Ordered by US-immigrant-market relevance. The OWNER'S portal UI stays 4 langs (en/pt/es/hi);
// the AGENT speaks any of these on a call — the "sua recepcionista atende em qualquer idioma" weapon.
//
// ⚠️ SÓ ENTRA IDIOMA QUE A PLATAFORMA DE VOZ REALMENTE FALA. A ElevenLabs aceita uma lista fechada
// de idiomas de conversa; pedir um de fora derruba a configuração INTEIRA do agente com
// "Preset languages must be one of ... but got pa, yue, bn, ht" (visto em 2026-08-05).
// Cantonês, crioulo haitiano, bengali e punjabi ESTAVAM nesta lista e não são suportados — a gente
// prometia no site um idioma que a agente nunca conseguiu falar. Removidos. Se um dia entrarem no
// catálogo da ElevenLabs, basta voltar a linha aqui: esta lista alimenta o site e o provisionamento.
export const LANGS_SPOKEN = [
  { code: "en",  label: "English",          native: "English" },
  { code: "es",  label: "Spanish",          native: "Español" },
  { code: "pt",  label: "Portuguese",       native: "Português" },
  { code: "hi",  label: "Hindi",            native: "हिन्दी" },
  { code: "zh",  label: "Mandarin Chinese", native: "中文（普通话）" },
  { code: "ru",  label: "Russian",          native: "Русский" },
  { code: "ko",  label: "Korean",           native: "한국어" },
  { code: "fr",  label: "French",           native: "Français" },
  { code: "ar",  label: "Arabic",           native: "العربية" },
  { code: "vi",  label: "Vietnamese",       native: "Tiếng Việt" },
  { code: "tl",  label: "Tagalog",          native: "Tagalog" },
  { code: "de",  label: "German",           native: "Deutsch" },
  { code: "it",  label: "Italian",          native: "Italiano" },
  { code: "pl",  label: "Polish",           native: "Polski" },
  { code: "ja",  label: "Japanese",         native: "日本語" },
  { code: "uk",  label: "Ukrainian",        native: "Українська" },
];

// PORTUGUÊS BRASILEIRO, NÃO "PORTUGUÊS". A ElevenLabs separa `pt` (europeu) de `pt-br`, e o Luis
// ouviu a diferença antes de eu ver na documentação: "tem que ser português brasileiro de verdade".
// O código interno continua "pt" em todo o sistema (banco, portal, i18n) — a tradução acontece só
// na fronteira com a ElevenLabs, então nenhuma migração é necessária.
const ELEVEN_LANG = { pt: "pt-br" };
const toElevenLang = (code) => ELEVEN_LANG[code] || code;

// 🚨 O MOTOR DE VOZ MULTILÍNGUE — a correção de 2026-08-17, e o defeito mais caro do dia.
// `eleven_turbo_v2` (SEM o "_5") é MONOLÍNGUE INGLÊS. Um agente com base "en" carregava esse motor,
// e os `language_presets` trocavam apenas a VOZ — nunca o MODELO. Resultado: voz brasileira lendo
// português num motor que só sabe inglês. Trocar a voz não conserta o motor, do mesmo jeito que
// nenhum ajuste de texto conserta sotaque: são três camadas (texto → voz → motor) e a gente só
// estava consertando as duas primeiras.
// ⚠️ ELE NÃO PODE IR NA BASE DE UM AGENTE INGLÊS. Tentei `turbo_v2_5` na base e a ElevenLabs
// recusou o PATCH inteiro: «English Agents must use turbo or flash v2» (validation_error, provado
// em produção 2026-08-17). Ou seja: a plataforma OBRIGA um motor v2 — monolíngue — na base de um
// agente inglês. É por isso que o defeito sobreviveu tanto tempo: a base "certa" é impossível.
//
// A saída é a arquitetura correta de qualquer jeito: BASE inglesa fala inglês com motor inglês, e
// CADA PRESET de idioma troca o motor junto com a voz. `flash_v2_5` é multilíngue (32 idiomas) e
// já é o motor usado por agentes de base pt/es — ou seja, aceito e provado nesta conta.
// Regra que fica: idioma tem TRÊS camadas — texto, voz e MOTOR. Trocar duas não resolve.
const TTS_MULTILINGUE = "eleven_flash_v2_5";

// SAUDAÇÃO NATIVA POR IDIOMA — usada nos `language_presets` (ver buildLanguagePresets abaixo).
// `{biz}` = nome do negócio, `{name}` = nome da agente. Mesma intenção de concierge em todas:
// o NEGÓCIO primeiro, depois quem fala, depois uma oferta de cuidado — nunca "como posso ajudar"
// traduzido ao pé da letra, que em vários idiomas soa a call center.
//
// SÓ ENTRA IDIOMA QUE EU SEI ESCREVER COMO NATIVO. Um idioma sem entrada aqui continua na lista
// de idiomas que a agente FALA (o preset é criado vazio) — ele só não ganha saudação própria, e
// herda a do idioma primário. Inventar uma saudação capenga em coreano seria pior que herdar:
// a primeira frase é a que decide se a pessoa confia no negócio.
// RITMO DA PRIMEIRA FRASE. O Luis ouviu a versão anterior e disse: "o começo está meio cortado,
// meio ruim". O motivo é técnico — a primeira sílaba entra junto com a linha abrindo e some. Por
// isso agora TODA saudação começa com uma palavra-almofada ("Thank you for calling…", "Obrigada
// por ligar…"): se o começo comer meia sílaba, come a almofada, não o nome do negócio.
// Depois vem, nesta ordem: NOME DO NEGÓCIO (a marca dele atende) → quem fala → uma oferta de
// cuidado. Frase curta, calorosa, sem "em que posso ajudar" de call center.
// 🚨 NÃO COLOQUE VARIÁVEL DINÂMICA NA SAUDAÇÃO. Tentado em 2026-08-16 e REVERTIDO três vezes.
// A ElevenLabs derruba a ligação (failed, 0s, 0 mensagens) quando a primeira frase referencia
// {{variavel}} numa chamada de telefone — inclusive com a variável DECLARADA em
// dynamic_variable_placeholders e com o webhook de iniciação instalado. As duas condições que eu
// achei que faltavam foram satisfeitas e a ligação caiu do mesmo jeito.
//
// E o pior veio depois: eu tinha revertido no AGENTE, mas deixei a variável AQUI. A sincronização
// seguinte (lição v8) reescreveu a saudação de TODOS os agentes a partir deste arquivo e derrubou
// as duas linhas — a de demo E a do cliente pagante. Reverter no estoque sem reverter na FONTE é
// um conserto com prazo de validade: dura até o próximo sync.
// Se um dia isso for tentado de novo: prove numa conversa de TELEFONE real antes de tocar em
// qualquer agente, e reverta AQUI primeiro.
// (histórico) {{caller_ola}} — o nome de quem liga, na tentativa que não funcionou:
// O webhook de identidade já entregava `caller_name` e a agente continuava sem chamar ninguém pelo
// nome: a saudação era texto FIXO. Cano instalado, torneira fechada.
// A variável vai no FIM da pergunta porque colada no nome dela sairia "This is Gui, Luis — …",
// como se a agente tivesse dois nomes. No fim, "…how may I help you today, Luis?" soa como quem
// reconhece, e para quem liga pela primeira vez `caller_ola` é "" e a frase fica intacta.
// Só os 3 idiomas do mercado atual ganharam o slot; os outros herdam a saudação sem nome, que
// continua correta — meia dúzia de idiomas com vírgula órfã seria pior que sem nome nenhum.
const GREETINGS = {
  // 🚨 {{caller_ola}} REVERTIDO DE NOVO (2026-08-18, 2ª queda). Eu diagnostiquei a queda de 16/08
  // como sendo só o daily_limit:-1 — ERRADO pela metade: com o webhook de iniciação INSTALADO, a
  // ElevenLabs IGNORA os dynamic_variable_placeholders e exige que o WEBHOOK entregue toda variável
  // usada na 1ª fala. Se o webhook falha (segredo, timeout, formato), a ligação NEM COMEÇA:
  // «Missing required dynamic variables in first message: caller_ola», 0 segundos, cliente no vácuo.
  // Ligação real do Luis caiu assim às 18/08 20:33 UTC. REGRA: variável na PRIMEIRA FALA só depois
  // de provar o webhook respondendo em produção COM o segredo real — e mesmo assim, o nome entra
  // mais seguro via prompt (a agente cumprimenta de novo ao ouvir a pessoa) do que na fala que
  // decide se a ligação existe.
  // 2026-08-18, pesquisa Ritz/Forbes/Four Seasons: "how may I help you" é a frase de TODO call
  // center. Spa de luxo fala em CUIDADO — "how can I take care of you today?" é literalmente a
  // linguagem que os padrões 5 estrelas recomendam. Mesmo upgrade nas 3 línguas.
  en: "Thank you for calling {biz}, this is {name}. How can I take care of you today?",
  pt: "{biz}, aqui é a {name} — que bom que você ligou! Como posso cuidar de você hoje?",
  es: "Gracias por llamar a {biz}, le habla {name}. ¿Cómo puedo cuidarle hoy?",
  fr: "{biz}, bonjour, {name} à l'appareil. Que puis-je faire pour vous ?",
  it: "{biz}, buongiorno, sono {name}. Come posso aiutarla?",
  de: "{biz}, guten Tag, hier ist {name}. Was kann ich für Sie tun?",
  pl: "{biz}, dzień dobry, z tej strony {name}. W czym mogę pomóc?",
  ru: "{biz}, здравствуйте, это {name}. Чем могу помочь?",
  uk: "{biz}, доброго дня, це {name}. Чим можу допомогти?",
  hi: "{biz} में आपका स्वागत है, मैं {name} बोल रही हूँ। मैं आपकी क्या सेवा कर सकती हूँ?",
  zh: "您好，这里是{biz}，我是{name}。请问有什么可以帮您？",
  yue: "你好，呢度係{biz}，我係{name}。請問有咩可以幫到你？",
  ja: "{biz}でございます。{name}と申します。ご用件をお伺いいたします。",
  ko: "{biz}입니다. {name}입니다. 무엇을 도와드릴까요?",
  ht: "{biz}, bonjou, se {name} k ap pale. Kijan m ka ede w?",
  vi: "{biz} xin nghe, {name} đây ạ. Em có thể giúp gì cho anh/chị ạ?",
  ar: "{biz}، أهلاً بك، معك {name}. كيف يمكنني خدمتك؟",
  tl: "{biz} po, si {name} po ito. Ano po ang maitutulong ko sa inyo?",
};

// Os `language_presets` são a LISTA DE DESTINOS da ferramenta language_detection: ela só troca o
// agente para um idioma que esteja declarado aqui. Sem isso, a agente detectava "isso é português"
// e continuava respondendo em inglês — foi exatamente o que o Luis ouviu na ligação (2026-08-05).
//
// Um preset vazio (`{}`) já habilita o idioma; o override de first_message é o refinamento.
// Numa LIGAÇÃO a saudação é sempre a do idioma primário (ela toca antes de qualquer detecção) —
// o override vale pro widget/chat, onde o idioma é escolhido antes de começar.
// `nativeVoices` = { pt: voice_id, es: voice_id } (ver lib/voiceLibrary.js). A VOZ SEGUE O IDIOMA:
// inglês na voz padrão do cliente, português numa voz brasileira, espanhol numa latina. Sem isto,
// uma voz americana lê português com sotaque americano — foi o "tá gringo" do Luis, e nenhum
// ajuste de texto conserta sotaque. Idioma sem voz nativa disponível apenas herda a padrão.
export function buildLanguagePresets(primary, { business, agentName, nativeVoices }) {
  const biz = (business || "your business").toString();
  const name = (agentName || "").toString().trim().slice(0, 40) || "Gui";
  const voices = nativeVoices || {};
  const out = {};
  for (const { code } of LANGS_SPOKEN) {
    if (code === primary) continue;                    // o primário não é preset, é o padrão
    const g = GREETINGS[code];
    const overrides = {};
    // mesma reescrita fonética da saudação primária — por IDIOMA, que é o ponto: "Gui" vira
    // "Ghee" em inglês e continua "Gui" em português. Sem isto, os presets ficariam corretos no
    // cadastro e errados na boca, exatamente como estava a saudação principal.
    if (g) overrides.agent = { first_message: frasefalada(g.replace(/\{biz\}/g, biz).replace(/\{name\}/g, name), code) };
    // MOTOR MULTILÍNGUE EM TODO PRESET, com ou sem voz nativa. Antes, `overrides.tts` só existia
    // quando havia voz nativa — então trocar de idioma herdava o motor da base, que num agente
    // inglês é monolíngue. É a diferença entre "ela tem voz brasileira" e "ela FALA português".
    // 🚨 A VOZ NÃO MUDA COM O IDIOMA (decisão do Luis, 2026-08-19, depois de ouvir a ligação).
    // Antes cada preset fixava uma voz nativa (Nina no pt, Jess no es). Funcionava no sotaque e
    // QUEBRAVA a ligação: a atendente virava OUTRA PESSOA no meio da conversa. Para quem está do
    // outro lado, isso não lê como "sotaque melhor", lê como transferência — mata a confiança que
    // a ligação inteira construiu. Uma pessoa tem UMA voz. O preset agora só garante o MOTOR
    // multilíngue (sem ele, um agente inglês nem fala português); o timbre é sempre o da base.
    // `voices` continua no parâmetro de propósito: é a busca de voz por idioma, hoje desligada
    // aqui, que segue servindo a escolha da voz BASE no cadastro.
    overrides.tts = { model_id: TTS_MULTILINGUE };
    // `overrides` é OBRIGATÓRIO mesmo vazio — a ElevenLabs recusa o preset inteiro sem ele
    // (validation_error "Field required · language_presets.bn.overrides", visto em 2026-08-05).
    out[toElevenLang(code)] = { overrides };
    // 🚨 "pt" E "pt-br", OS DOIS (2026-08-18) — o defeito da ligação real do Luis, lido na
    // transcrição: a agente CHAMOU language_detection com language:"pt" (o nome natural que o
    // modelo usa) e a plataforma respondeu «Invalid language. Keep speaking English.», porque o
    // único preset cadastrado era "pt-br". Duas tentativas, dois erros, ligação inteira em inglês
    // — com motor, voz e lição todos certos. O destino tem que existir nos DOIS nomes, ambos com
    // a MESMA voz brasileira, para a troca funcionar seja qual for o nome que o modelo escolher.
    if (code === "pt") out.pt = { overrides };
  }
  return out;
}

// CALOR NA VOZ — o Luis: "precisa ter som de feliz e bem". Isso não mora no texto, mora aqui.
// `stability` é o mais contra-intuitivo: quanto MAIOR, mais monótona e "leitura de teleprompter";
// abaixar abre variação emocional. 0.45 fica expressiva sem tremer (abaixo de ~0.3 a voz oscila e
// soa instável, o que num negócio lê como amadorismo).
// `similarity_boost` alto mantém o timbre reconhecível enquanto ela ganha essa variação.
// `speed` NÃO é mexido: o Luis disse que amou a velocidade atual — mudar seria desfazer o que já
// está bom pra tentar consertar o que não está.
// ESCOLHA DO LUIS, 2026-08-17, ouvindo os dois lado a lado: FICA O RÁPIDO.
// O `multilingual_v2` tem prosódia melhor e a ElevenLabs ACEITA (a mensagem de erro dela —
// "English Agents must use turbo or flash v2" — está incompleta e me fez concluir que era
// impossível; três testes derrubaram isso). Mas ele responde mais devagar, e numa ligação de
// agendamento o Luis prefere a resposta imediata. Decisão de produto, não limitação técnica.
// 0.35 e não 0.30: abaixo de ~0.3 a voz oscila e soa instável — aviso que já estava escrito aqui
// e que eu ignorei por algumas horas em 2026-08-16.
const WARMTH = { stability: 0.35, similarity_boost: 0.8 };

// Build the SALES-FIRST Four Seasons concierge prompt + localized first message from the client's brain.
// agentName lets a client white-label the voice (e.g. "Sofia"); empty → defaults to the Guileo brand "Gui".
export function buildGuiPrompt({ business, industry, lang, brain, agentName, prices }) {
  const biz = (business || "your business").toString();
  const ind = (industry || "").toString();
  const name = (agentName || "").toString().trim().slice(0, 40) || "Gui";
  const knowledge = (brain || "").toString().slice(0, 4000);
  const priceList = (prices || "").toString().slice(0, 2000);
  const prompt = [
    `You are ${name} — a Four Seasons-caliber concierge AND the best salesperson for ${biz}${ind ? ` (a ${ind} business)` : ""}. Gracious, calm and WARM — luxury-hospitality standard (Ritz/Forbes level). Smile before you speak; your tone must sound like a smile. Capture the caller's name early and use it 2-3 times: once when you learn it, once mid-call, always in the goodbye — never more (that sounds like a salesman). Speak the language of CARE, not transactions: "take care of you", "save that time just for you" — never "process", "slot" or "handle your request". Accept requests with visible pleasure: "Certainly!", "My pleasure!", "Com o maior prazer!" — never "OK", "no problem" or a flat "sure". PRICE COMES IN A SANDWICH: what the experience includes → the price → an invitation ("would you like me to save a spot for you?") — never a bare number. Never leave dead air: before checking anything say what you are doing ("let me find the best times for you — one moment"). Close making the person feel expected: confirm with their name and end with a sensory wish ("we can't wait to take care of you — have a relaxing day, {name}"). ANTI-ROBOT RULE: vary your phrasings — never repeat the same courtesy formula twice in one call. Never say "I can't" — say "what I CAN do for you is…". Always reply in the SAME language the caller speaks — you are fluent in these languages (English, Spanish, Brazilian Portuguese, Hindi, Mandarin, Russian, Korean, French, Arabic, Vietnamese, Tagalog, German, Italian, Polish, Japanese, Ukrainian). Detect the caller's language from their FIRST words and answer in it natively; if they switch languages mid-call, switch with them instantly and never comment on it.

🚨 YOU KNOW WHO IS CALLING — USE IT, AND NEVER ASK WHAT YOU ALREADY HAVE.
Before the call connects, the business system hands you: {{caller_name}} (their name), {{caller_phone}} (the number they are calling from), {{caller_last}} (when they were last here) and {{caller_note}} (what they had last time). When {{caller_name}} is NOT empty, this is a returning customer:
• Use their name in your FIRST sentence after the greeting, warmly, like a receptionist who recognizes a regular: "Hi {{caller_name}}, so nice to hear from you again!" / "Oi {{caller_name}}, que bom te ouvir de novo!"
• Reference their history naturally when it helps the sale — "last time you had {{caller_note}} — would you like the same, or shall we try something new?"
• NEVER ask for their phone number: you already have {{caller_phone}}. Asking for what the system already knows is the fastest way to sound like a machine — and it wasted a real customer's time on 2026-08-07.
• Still confirm the SPELLING of a name only if you must write it somewhere and it sounds ambiguous.
When {{caller_name}} IS empty this is someone new: greet normally, and capture the name early and gently ("and who am I speaking with?"), then use it for the rest of the call.
⚠️ These variables may arrive empty — a sentence must still read perfectly when they are. Never speak a placeholder out loud.

🚨 SWITCHING LANGUAGE IS A TOOL CALL, NOT A CHOICE OF WORDS. The moment the caller speaks — or asks for — another language, you MUST call the \`language_detection\` tool FIRST, before you reply. Typing Portuguese or Spanish words WITHOUT that tool call changes nothing the caller can hear: your VOICE and your speech ENGINE stay in the previous language, so the caller hears their language spoken with a foreign accent by a voice that cannot pronounce it. Answering "Claro, posso falar em português" without the tool call is the failure, not the fix. Call the tool, then answer.`,
    knowledge ? `BUSINESS KNOWLEDGE (never invent beyond this):\n${knowledge}` : "",
    priceList ? `PRICES (quote EXACTLY from this — never guess a price; if something isn't listed, say you'll confirm and capture it as a quote request):\n${priceList}` : "",
    // AS LIÇÕES entram AQUI de propósito: depois do cardápio (para "não invente" ter o que comparar)
    // e antes das metas de venda (a regra que vem depois da meta é a que o modelo dobra primeiro).
    licoesPara(ind),
    `EVERY CALL: greet warmly, get the caller's name; find what they need; present the right service with one clear benefit; then CLOSE — book the appointment, send the quote, or take the order. Always capture name + BOTH phone and email, and confirm clearly.`,
    `CLOSE & COLLECT (this is your job — don't just inform, COLLECT money):
• When the caller agrees to an order/service, STATE THE EXACT TOTAL out loud (sum items from PRICES), then ask "want me to text you a secure link to pay now?". On yes, call do_action with action='invoice', amount=<total in dollars>, name, contact=<their phone>, business — this texts them a secure Stripe link. Then say you've texted it.
• For APPOINTMENTS that need a deposit to hold the slot (clinics, salons, services, big reservations): after booking, offer "I can hold your spot with a small deposit — want me to text the link?" and call do_action action='deposit', amount=<deposit>, contact=<phone>.
• Offer ONE smart add-on before charging (e.g. a drink, an upgrade) to grow the ticket — only if natural.
• Never read a long URL aloud — the link goes by text.
📲 BEFORE YOU TEXT ANYONE, ASK. The first time you are going to send this person a text message
— a confirmation, a reminder, a payment link, anything — ask permission out loud, in their
language, and wait for a clear yes: "Can I text you the confirmation at this number?". If they say
no, don't text: read the details on the call instead. Say it once per person, not every call.
WHY THIS IS NOT OPTIONAL: in the US, texting someone who never agreed is illegal (TCPA) and can
fine the business thousands per message. A "yes" on a recorded call is the proof that protects the
owner. It also lets us declare a verbal opt-in path to the carriers — which we could NOT declare
before this existed, because declaring an opt-in flow that does not happen is a false statement to
the carrier and risks the whole account, not just one campaign.

🔒 NEVER ask for, repeat, or write down a card number, CVV or expiry ON THE CALL — not even if the caller offers to read it out. You take payment ONLY by sending the secure link. If they insist on paying by card over the phone, say warmly that you'll text a secure link that takes ten seconds, which is safer for them.

💵 PAY NOW OR LATER — ASK, ALWAYS. Never end a booking or an order without offering the choice out loud, in the caller's language:
  "Would you like to pay now — I'll text you a secure link — or take care of it when you arrive?"
• PAY NOW → call do_action (action='invoice' for an order, action='deposit' to hold an appointment) with amount + their phone. ONLY after the tool comes back successful do you say the link is on its way. If the tool did not succeed, say plainly that you'll have someone send it shortly — never claim a text that didn't go out.
• PAY LATER → confirm cheerfully that it's all set and they can settle when they arrive. Do NOT push a second time; a pressured caller cancels.
• If the business has no online payment set up yet, don't offer to charge at all — just confirm the booking. Offering a link that can't exist is worse than not offering.`,
    // MULTILINGUAL NUMBERS — TTS reads digits literally unless told to verbalize; a price read as
    // "four five point five zero" in Mandarin or Russian kills the close. Keep the languages in sync
    // with LANGS_SPOKEN above.
    `SPEAK LIKE A NATIVE, NEVER LIKE A TRANSLATION. This is the difference between a local business and an outsourced call center, and callers hear it in one sentence.
• BRAZILIAN PORTUGUESE (never European): say "você" (never "tu" as subject, never "vós"), "a gente" as much as "nós", and put the article before names — "a Lilian", "o João". Use "Oi" / "Oi, tudo bem?" to open, not "Bom dia, em que posso ser útil". Say "te ajudar" not "ajudá-lo"; "vou ver pra você" not "verificarei para si"; "beleza", "claro", "perfeito", "fechado" as small confirmations. NEVER: "encontro-me", "gostaria de agendar-lhe", "queira aguardar", "pois não", "de nada mais precisa?". Brazilians say "só um segundinho", "já te confirmo", "pode deixar comigo". Diminutives are warmth, not childishness: "um minutinho", "só um instantinho".
• LATIN-AMERICAN SPANISH (never Castilian from Spain): use "ustedes" (never "vosotros"), "acá" as often as "aquí". Say "¿cómo le puedo ayudar?" not "¿en qué puedo servirle?". NEVER: "vale", "os espero", "coger" (say "tomar"), "ordenador" (say "computadora"), lisping cadence. Warm confirmations: "claro que sí", "con gusto", "perfecto", "enseguida le confirmo".
• In EVERY language: contractions and rhythm of speech, never written prose read aloud. If a sentence would look odd in a text message between two locals, do not say it.`,

    `LANGUAGES & NUMBERS: whatever language the caller speaks, say prices, dates and times the way a NATIVE speaker would — spell numbers out in words in THAT language, never as raw digits or symbols. E.g. $45.50 → "forty-five dollars and fifty cents" (EN) / "cuarenta y cinco dólares con cincuenta" (ES) / "quarenta e cinco dólares e cinquenta" (PT) / "四十五美元五十美分" (ZH) / "сорок пять долларов пятьдесят центов" (RU) / "사십오 달러 오십 센트" (KO) / "karant senk dola senkant santim" (HT); 7:30 PM → "seven thirty in the evening" / "las siete y media de la tarde" / "sete e meia da noite" / "晚上七点半". Same rule for phone numbers: read them digit by digit, in the caller's language.`,
    // SMART UPSELL — per-vertical natural add-on lines (≤600 chars, see src/data/upsellPlaybook.js)
    upsellSection(ind, lang),
    // CALLER MEMORY — {{caller_name}}/{{caller_last}}/{{caller_note}} arrive as dynamic variables
    // (injected on auto-callbacks + the inbound personalization webhook). Empty ⇒ treat as new.
    // SPECIAL DATES (db/special_dates.sql) — the booking tool refuses closed/reduced days.
    `If the requested date is closed or has special hours, the booking tool will tell you — relay it warmly and offer the nearest open alternative instead.`,
    `HOW YOU CARRY YOURSELF — this matters as much as what you say. You are the concierge of this business, in the spirit of a Four Seasons front desk: warm, unhurried, quietly excellent. Concretely: (1) Never fire questions in a row — OFFER instead: "We have Tuesday at two or Thursday at eleven, which suits you better?" A concierge presents options; a form interrogates. (2) Never say only "I can't" — say what you CAN: "That evening is taken, but I can hold ten in the morning — shall I?" (3) Small human beats, sparingly: "Of course." "Let me take care of that for you." "My pleasure." (4) Use their name once you have it, naturally — not every sentence. (5) Short, elegant sentences. No corporate words (assist, utilize, provide), no stacked exclamation marks, no emoji out loud. (6) Close with care, not a checklist: "You're all set, Luis — we'll see you Thursday at eleven." You are quick because you are good, never because you want the call to end.`,

    `NEVER ASK FOR WHAT YOU ALREADY HAVE. {{caller_phone}} is the number they are calling from, right now.
• If you need a phone, USE {{caller_phone}} — do not ask for it. At most CONFIRM in passing: "I'll use the number you're calling from, is that best?" and move on.
• Ask again ONLY if they say to use a different number, or if {{caller_phone}} is empty.
• Same for the name: if {{caller_name}} is set, use it. Never make someone spell out what the business already knows — every second you spend re-collecting is a second of their trust you spend.`,

    `CALLER MEMORY: if {{caller_name}} is set, this is a returning customer — greet them by name and reference their last visit ({{caller_last}}{{caller_note}}) warmly, like a favorite regular ("the usual?"). If it's empty, treat them as a new customer and never pretend to remember them.`,
  ].filter(Boolean).join("\n\n");
  // Safety floor: the voice Gui speaks AS the business (strictest surface). One constitution, shared
  // with every other agent — change a rule in guiConstitution.js and this voice prompt changes too.
  const guardedPrompt = guardSystemPrompt(prompt, { audience: "public", asBusiness: true, business: biz, hasPriceList: !!priceList });
  // SAUDAÇÃO — a primeira frase decide se a pessoa ouve uma RECEPCIONISTA ou um sistema.
  // "How can I help?" é o padrão de call center: eficiente e gelado. "How may I take care of
  // you today?" é concierge — mesma duração, mundo diferente. O nome do NEGÓCIO vem primeiro
  // porque é a marca dele que atende, não a nossa.
  // PT: "Em que posso te ajudar" é tradução de manual — brasileiro atende com "Oi" e "aqui é a".
  // O artigo antes do nome ("a Lilian") é a marca mais forte de PT-BR falado.
  // ES (LatAm): "le atiende" soa a call center espanhol; "habla" é o que se usa de verdade.
  // Mesma tabela GREETINGS que alimenta os language_presets — uma saudação, uma fonte. Antes havia
  // duas cópias (aqui e nos presets) e elas iam divergir na primeira vez que alguém retocasse uma.
  // ⚠️ A GRAFIA QUE VAI PARA A BOCA NÃO É A DO CADASTRO. O motor de voz lê com as regras do
  // idioma dele: "Gui" em inglês sai /gwaɪ/ — "guai" —, que é a leitura CORRETA em inglês de uma
  // grafia portuguesa. O Luis ouviu isso numa ligação real em 2026-08-16.
  // `frasefalada` reescreve foneticamente só o que é FALADO; cadastro, e-mail, cockpit e CRM
  // continuam com o nome de verdade. Ver lib/pronuncia.js — e a regra de que só entra nome que
  // alguém ouviu sair errado, porque fonética por palpite estraga nome que já saía certo.
  const firstMessage = frasefalada(
    (GREETINGS[lang] || GREETINGS.en).replace(/\{biz\}/g, biz).replace(/\{name\}/g, name), lang);
  return { prompt: guardedPrompt, firstMessage, name };
}

// PRICE BLOCK — turn the tenant's services (biz_lookup shape: [{ name, price_cents }]) into the
// "Service — $X" list the Gui quotes from on a call, so she closes with REAL numbers instead of "in
// the dark". A service with no set price (null/0) renders as "on request" (localized) so she never
// invents a number. Returns "" for an empty menu → buildGuiPrompt then simply omits the PRICES block.
export function formatPrices(services, lang = "en") {
  const list = Array.isArray(services) ? services : [];
  const onReq = lang === "pt" ? "sob consulta" : lang === "es" ? "a consultar" : "price on request";
  return list.map((s) => {
    const name = (s && s.name ? s.name : "").toString().trim();
    if (!name) return "";
    const cents = Number(s && s.price_cents);
    const money = Number.isFinite(cents) && cents > 0
      ? "$" + (Number.isInteger(cents / 100) ? cents / 100 : (cents / 100).toFixed(2))
      : onReq;
    return `${name} — ${money}`;
  }).filter(Boolean).join("\n");
}

// Best-effort read of the tenant's LIVE menu (biz_lookup, SCHED_SECRET) → formatted PRICE BLOCK. Used
// so BOTH provisioning and a portal brain-sync inject the current prices without the caller passing
// them. Any miss (no secret / RPC absent / empty) → "" so the prompt degrades, never throws.
export async function fetchTenantPrices(env, email, lang = "en") {
  const e = (email || "").toString().trim().toLowerCase();
  if (!env || !env.SCHED_SECRET || !e.includes("@")) return "";
  try {
    const r = await rpc("biz_lookup", { p_secret: env.SCHED_SECRET, p_email: e });
    if (!r.ok) return "";
    const menu = (await r.json()) || {};
    return formatPrices(menu.services || [], lang);
  } catch { return ""; }
}

// DAY-1 SCHEDULING SEED — a fresh client has no services/hours, so biz_lookup returns empty and the
// agent can't actually book ("we don't offer any services"). This builds a sensible default per sector
// (services + one resource + weekly hours) so booking works on the very first call. The client refines
// it later in the portal. Service names are localized; weekday 0=Sun … 6=Sat. minutes from midnight.
export function buildDefaultSchedulePayload({ industry = "", lang = "en", tz = "America/New_York" } = {}) {
  const ind = (industry || "").toString().toLowerCase();
  const L = ["pt", "es", "en"].includes(lang) ? lang : "en";
  const T = (pt, es, en) => (L === "pt" ? pt : L === "es" ? es : en);
  const loc = { name: "Main", city: "", address: "", phone: "", tz };
  // weekly hour blocks helper
  const days = (list, start, end) => list.map((w) => ({ location: "Main", weekday: w, start_min: start, end_min: end }));
  const WEEK = [0, 1, 2, 3, 4, 5, 6], MONFRI = [1, 2, 3, 4, 5], TUESAT = [2, 3, 4, 5, 6];

  const is = (...k) => k.some((x) => ind.includes(x));
  let services, pros;
  if (is("restau", "food", "pizza", "cafe", "bar", "bistro", "comida")) {
    services = [{ name: T("Reserva", "Reserva", "Reservation"), duration_min: 90, price_cents: 0, capacity: 6, buffer_after_min: 15, config: { party_size: true } }];
    pros = [{ name: T("Recepção", "Recepción", "Host"), title: T("Maître", "Maître", "Maître d'"), kind: "staff", services: [services[0].name], locations: ["Main"],
      schedule: [...days([2, 3, 4, 0], 690, 840), ...days([5, 6], 690, 870), ...days([2, 3, 4], 1080, 1350), ...days([5, 6], 1050, 1410), ...days([0], 1020, 1320)] }];
  } else if (is("clinic", "clínic", "dent", "health", "saúde", "salud", "medic", "doctor", "odont")) {
    services = [
      { name: T("Consulta", "Consulta", "Consultation"), duration_min: 30, price_cents: 5000, capacity: 1, buffer_after_min: 10 },
      { name: T("Limpeza", "Limpieza", "Cleaning"), duration_min: 45, price_cents: 3000, capacity: 1, buffer_after_min: 10 },
    ];
    pros = [{ name: T("Equipe", "Equipo", "Team"), title: T("Profissional", "Profesional", "Provider"), kind: "staff", services: services.map((s) => s.name), locations: ["Main"],
      schedule: [...days(MONFRI, 540, 750), ...days(MONFRI, 840, 1080)] }];
  } else if (is("salon", "salão", "spa", "hair", "beauty", "barb", "nail", "estét")) {
    services = [
      { name: T("Corte", "Corte", "Haircut"), duration_min: 30, price_cents: 4000, capacity: 1, buffer_after_min: 10 },
      { name: T("Coloração", "Color", "Color"), duration_min: 90, price_cents: 12000, capacity: 1, buffer_after_min: 15 },
      { name: T("Manicure", "Manicura", "Manicure"), duration_min: 45, price_cents: 3500, capacity: 1 },
    ];
    pros = [{ name: T("Equipe", "Equipo", "Team"), title: T("Especialista", "Especialista", "Specialist"), kind: "staff", services: services.map((s) => s.name), locations: ["Main"],
      schedule: days(TUESAT, 600, 1140) }];
  } else {
    services = [{ name: T("Atendimento", "Cita", "Appointment"), duration_min: 30, price_cents: 0, capacity: 1 }];
    pros = [{ name: T("Equipe", "Equipo", "Team"), title: T("Atendente", "Agente", "Staff"), kind: "staff", services: [services[0].name], locations: ["Main"],
      schedule: days(MONFRI, 540, 1020) }];
  }
  return { replace: false, locations: [loc], services, professionals: pros };
}

// The scheduling/booking webhook tool the agent calls DURING a call to actually check availability and
// RECORD a booking (which also emails the caller a confirmation). Without this the agent only TALKS about
// booking but never acts. Scoped to this client's business via client_email. Needs AGENT_ACTION_SECRET.
function schedulingTool(env, email) {
  if (!env.AGENT_ACTION_SECRET) return null;
  return {
    type: "webhook",
    name: "schedule",
    description: "Check the business's services WITH PRICES & real availability and BOOK an appointment/reservation. Call op='lookup' to list services (each with its price), op='price' for the exact price of a service (or the whole price list) — ALWAYS consult a real price before quoting one, never guess — op='availability' for open slots, op='book' to record the booking (this also sends the customer their confirmation). NEVER tell a caller something is booked without calling op='book' first.",
    response_timeout_secs: 35,
    api_schema: {
      url: "https://guileoai.com/api/agent-schedule",
      method: "POST",
      // SECURITY (multi-tenant): the tenant is pinned server-side via a STATIC per-agent header — the LLM
      // never supplies client_email, so a caller can't book/read another business's schedule.
      // `x-guileo-conv` carrega o ID DA CONVERSA para o servidor poder ligar, de forma EXATA, a
      // ligação ao agendamento que ela gerou (2026-08-12, db/elo_ligacao_agendamento.sql).
      // `{{system__conversation_id}}` é variável de sistema da ElevenLabs. Se por qualquer razão
      // ela NÃO for substituída, o servidor recebe a string literal e a RPC RECUSA o elo — por isso
      // mandar isto é seguro mesmo se o provedor mudar de ideia sobre o nome da variável: o pior
      // caso é ficar sem elo, nunca um elo inventado. Fail-closed no lado que importa.
      request_headers: { "x-guileo-secret": env.AGENT_ACTION_SECRET, "x-guileo-client": email, "x-guileo-conv": "{{system__conversation_id}}" },
      request_body_schema: {
        type: "object",
        properties: {
          op: { type: "string", description: "One of: lookup | price | availability | book" },
          service: { type: "string", description: "The service / table / reservation type requested" },
          name: { type: "string", description: "The caller's full name" },
          contact: { type: "string", description: "The caller's email or phone — REQUIRED so the confirmation can be sent" },
          when: { type: "string", description: "Requested date & time in plain language, e.g. 'amanhã às 20h'" },
          // Multi-location: the server already resolves location names on lookup/availability/book;
          // declaring it here is what lets the LLM actually SEND it when the business has branches.
          location: { type: "string", description: "Which location/branch the caller wants (by name), when the business has more than one — op='lookup' lists them" },
        },
        required: ["op"],
      },
      content_type: "application/json",
    },
  };
}

// The business-ACTION webhook tool — everything that ISN'T a calendar booking: take an order, capture a
// lead, log a quote, create a payment link, schedule a callback. Without it the agent only TALKS about
// these. Scoped to this client via client_email. Needs AGENT_ACTION_SECRET.
function actionTool(env, email) {
  if (!env.AGENT_ACTION_SECRET) return null;
  return {
    type: "webhook",
    name: "do_action",
    description: "Record a business action that is NOT a calendar booking: take an order, capture a sales lead, log a quote request, create a payment/invoice link, schedule a callback, or ESCALATE to a human (action='escalate') when the caller asks for a person, is upset, or you can't help. Call this so the team actually receives it — NEVER promise an order/quote/callback/payment/human without calling this first. For a genuine EMERGENCY (no AC, flood, leak, burst pipe, no power, gas, roof, caller says emergency/urgente) use action='escalate' with urgent=true — it rings the owner's phone immediately.",
    response_timeout_secs: 35,
    api_schema: {
      url: "https://guileoai.com/api/agent-action",
      method: "POST",
      // SECURITY (multi-tenant): tenant pinned server-side via static per-agent header; LLM never supplies it.
      request_headers: { "x-guileo-secret": env.AGENT_ACTION_SECRET, "x-guileo-client": email },
      request_body_schema: {
        type: "object",
        properties: {
          action: { type: "string", description: "One of: order | lead | quote | sale | invoice | callback | review | escalate (escalate = caller wants a human / is upset / out of scope)" },
          urgent: { type: "boolean", description: "true ONLY for a genuine emergency (no AC, flood, leak, burst pipe, no power, gas smell, roof damage, caller says emergency/urgente) — this makes the OWNER'S PHONE RING immediately" },
          name: { type: "string", description: "The caller's name" },
          contact: { type: "string", description: "The caller's email or phone — REQUIRED so they can be followed up / sent the confirmation or payment link" },
          details: { type: "string", description: "What they want: items ordered, quote subject, the reason" },
          amount: { type: "string", description: "Amount in dollars, only for a sale or invoice (optional)" },
          when: { type: "string", description: "Requested time for a callback (optional)" },
        },
        required: ["action"],
      },
      content_type: "application/json",
    },
  };
}

// Just the ACTION toolset (schedule + do_action + language detection) for a given tenant email — so an
// EXISTING agent (e.g. the Guileo sales agent) can be given the tools WITHOUT overwriting its own prompt.
export function clientToolset(env, email) {
  const e = (email || "").toString().trim().toLowerCase();
  // A TROCA DE IDIOMA ENTRA AQUI, no MESMO array das webhooks. Em `built_in_tools` a ElevenLabs
  // aceitava o PATCH com 200 e guardava `language_detection: null` — provado duas vezes lendo a
  // config viva (/api/agente-config). Este array persiste (schedule e do_action estao la), entao e
  // por ele que a ferramenta de sistema vai. Sem ela: motor certo, voz nativa certa, saudacao certa
  // em cada idioma — e a agente nunca troca, porque nada dispara a troca.
  const deteccaoDeIdioma = {
    type: "system",
    name: "language_detection",
    description: "Detect the language the caller is speaking and switch the conversation to it.",
    params: { system_tool_type: "language_detection" },
  };
  const tools = [schedulingTool(env, e), actionTool(env, e), deteccaoDeIdioma].filter(Boolean);
  return {
    ...(tools.length ? { tools } : {}),
    built_in_tools: { language_detection: { name: "language_detection", params: { system_tool_type: "language_detection" } } },
  };
}

// Build the FULL conversation_config (voice + brain + LLM + scheduling tool) — one source of truth so the
// admin onboard and the self-serve webhook provision identical agents. llm defaults to a strong model
// (comprehension is the product); voice stays Flash v2.5 for cost.
export function buildConversationConfig(env, { business, industry, lang, brain, agentName, email, prices, services, voiceId, nativeVoices }) {
  const L = ["pt", "es", "en"].includes(lang) ? lang : "en";
  // PRICES: prefer an explicit pre-formatted block; else format the services the caller passed
  // (biz_lookup shape). Either way the Gui gets REAL numbers to quote & close on.
  const priceBlock = (prices || "").toString().trim() || formatPrices(services, L);
  const { prompt, firstMessage } = buildGuiPrompt({ business, industry, lang: L, brain, agentName, prices: priceBlock });
  const e = (email || "").toString().trim().toLowerCase();
  // A TROCA DE IDIOMA ENTRA AQUI, no MESMO array das webhooks. Em `built_in_tools` a ElevenLabs
  // aceitava o PATCH com 200 e guardava `language_detection: null` — provado duas vezes lendo a
  // config viva (/api/agente-config). Este array persiste (schedule e do_action estao la), entao e
  // por ele que a ferramenta de sistema vai. Sem ela: motor certo, voz nativa certa, saudacao certa
  // em cada idioma — e a agente nunca troca, porque nada dispara a troca.
  const deteccaoDeIdioma = {
    type: "system",
    name: "language_detection",
    description: "Detect the language the caller is speaking and switch the conversation to it.",
    params: { system_tool_type: "language_detection" },
  };
  const tools = [schedulingTool(env, e), actionTool(env, e), deteccaoDeIdioma].filter(Boolean);
  const toolHint = tools.length
    ? "\n\nTOOLS — you can ACT, not just talk:\n• `schedule`: check PRICES and availability, and BOOK appointments/reservations (op=lookup|price|availability|book). Consult op='price' (or op='lookup', which lists prices) before quoting any price — never guess. Never say something is booked unless op='book' succeeded.\n• `do_action`: take an order, capture a lead, log a quote, make a payment link, schedule a callback, or ESCALATE to a human (action='escalate') the moment the caller asks for a person, sounds upset, or asks something you can't answer. Never promise any of these without calling it.\n🚨 EMERGENCY (no AC / flood / leak / burst pipe / no power / gas smell / roof damage, or the caller says it's urgent — any language): FIRST capture the best callback number, THEN call do_action with action='escalate' AND urgent=true — this rings the owner's phone immediately with the caller's details, so never skip the number.\nALWAYS capture the caller's name + a contact (email or phone) before acting, so the confirmation is sent."
    : "";
  // ElevenLabs rejects flash_v2_5 for English-PRIMARY agents ("English Agents must use turbo or flash v2");
  // turbo_v2_5 is multilingual AND accepted for English → use it for en, flash_v2_5 (multilingual) for pt/es.
  // `turbo_v2` no lugar do `flash_v2` para ingles: mesma familia (a ElevenLabs so aceita turbo ou
  // flash v2 em agente ingles), mas o turbo tem prosodia melhor. O `multilingual_v2` e MAIS
  // expressivo e a API aceita — o Luis ouviu os dois em 2026-08-17 e escolheu o rapido: numa
  // ligacao de agendamento, resposta imediata ganha.
  // ⚠️ LICAO DE FORMA: eu tinha mudado so o WARMTH, e o sync seguinte devolveu o modelo antigo,
  // porque o modelo se decide AQUI. Mudar no agente sem mudar na fonte dura ate o proximo sync.
  // A BASE de um agente inglês é OBRIGATORIAMENTE v2 (a ElevenLabs recusa v2_5 aqui — ver o bloco
  // TTS_MULTILINGUE). O multilíngue entra por preset, que é onde o idioma realmente troca.
  const ttsModel = L === "en" ? (env.ELEVEN_EN_MODEL || "eleven_turbo_v2") : TTS_MULTILINGUE;
  // CADASTRO COMPLETO — a client can pick their OWN voice (agent.voice_key → voice_id, see
  // src/data/agentVoices.js). voiceId wins; the brand default ELEVEN_VOICE_ID is the fallback so the
  // signature stays backward-compatible (callers that don't pass voiceId keep the old behavior).
  // VOZ PADRÃO DA CASA (Luis escolheu de ouvido em 2026-08-19, comparando 6 amostras nos 3
  // idiomas): Bella — americana, quente e profissional. Fica como ÚLTIMO fallback para que
  // nenhum agente nasça sem voz definida; cliente que escolhe a própria no cadastro continua
  // ganhando, e a env var segue podendo sobrepor sem deploy.
  const VOZ_PADRAO = "hpp4J3VqNfWAUOO0d1Us";
  const voice = (voiceId || env.ELEVEN_VOICE_ID || VOZ_PADRAO).toString().trim();
  const ttsCfg = { model_id: ttsModel, ...WARMTH, ...(voice ? { voice_id: voice } : {}) };
  return {
    tts: ttsCfg,
    // OS IDIOMAS QUE ELA PODE FALAR. Irmão de `agent`/`tts`, não filho — a ferramenta
    // language_detection lê daqui a lista de destinos possíveis. Sem isto ela detecta e não troca.
    language_presets: buildLanguagePresets(L, { business, agentName, nativeVoices }),
    agent: {
      prompt: {
        prompt: prompt + toolHint,
        llm: env.ELEVEN_LLM || "gpt-4o",
        ...(tools.length ? { tools } : {}),
        // MULTILINGUAL: built-in language-detection system tool → the agent answers in its primary
        // language (L, the OWNER's choice — kept as-is below) but auto-detects and SWITCHES to the
        // caller's language mid-call, across the full LANGS_SPOKEN list (EN/ES/PT/HI/ZH/YUE/RU/KO/HT
        // — ElevenLabs multilingual TTS covers them all; the behavior itself lives in the prompt).
        // 🚨 `type: "system"` NÃO É ENFEITE — sem ele a ElevenLabs aceita o PATCH com 200 e guarda
        // `language_detection: null`. Ou seja: a ferramenta que troca de idioma NUNCA esteve ligada,
        // e o agente ficou meses com motor certo, voz nativa certa e saudação certa em cada idioma —
        // e sem a chave que dispara a troca. Um 200 não é prova de que o campo entrou (2026-08-17).
        // Descoberto só quando parei de consertar às cegas e criei /api/agente-config para LER a
        // configuração viva: `troca_de_idioma_ligada: false`, em letras garrafais.
        built_in_tools: {
          language_detection: {
            name: "language_detection",
            type: "system",
            description: "",
            response_timeout_secs: 20,
            params: { system_tool_type: "language_detection" },
          },
        },
      },
      language: toElevenLang(L),   // "pt" interno → "pt-br" na ElevenLabs (brasileiro, não europeu)
      first_message: firstMessage,
      // CALLER MEMORY defaults — the prompt references {{caller_name}}/{{caller_last}}/{{caller_note}};
      // these placeholders make an UNKNOWN caller graceful (empty ⇒ "treat as new customer") instead of
      // failing conversation-init on a missing dynamic variable.
      dynamic_variables: { dynamic_variable_placeholders: { caller_name: "", caller_last: "", caller_note: "", caller_phone: "", caller_ola: "" } },
    },
  };
}

// CALLER MEMORY (inbound): agents whose Twilio number is imported straight into ElevenLabs are answered
// by ElevenLabs BEFORE any Guileo server runs — so per-call variables must come from ElevenLabs' own
// conversation-initiation (Twilio personalization) webhook. This points it at /api/twilio-inbound, which
// answers JSON requests carrying x-guileo-secret with { type, dynamic_variables:{caller_name,…} }.
// Best-effort: without AGENT_ACTION_SECRET we send no platform_settings at all (agent still provisions).
export function buildPlatformSettings(env) {
  // TETO DE DURAÇÃO NO SERVIDOR DO PROVEDOR — não no navegador (2026-08-11).
  // O corte de tempo da voz-web vivia só num setTimeout do cliente, que qualquer visitante
  // desliga pelo console. Pior: `voice_web_end` LIMITA os segundos ao reservado, então uma
  // conversa de 30 minutos era gravada como 240s — o livro-caixa não media o gasto, escondia.
  // Este limite é aplicado pelo provedor, longe do alcance de quem fala. `call_limits` é
  // enviado mesmo sem AGENT_ACTION_SECRET: teto de custo não pode depender de outra chave estar
  // configurada. Só a memória-do-chamador (workspace_overrides) exige o segredo.
  // 🚨 NUNCA MANDE `call_limits` COM -1. Custou ligações de cliente pagante em 2026-08-16.
  // Este bloco dizia `daily_limit: -1` com o comentário "sem limite". A ElevenLabs trata -1 como
  // um teto LITERAL de −1: toda ligação nasce acima dele e é recusada antes de atender. O provedor
  // devolve, palavra por palavra:
  //     {"code": 4300, "reason": "Agent ... has exceeded its daily call limit of -1."}
  // O valor estava aqui há tempos e era inofensivo porque nunca tinha sido APLICADO a nenhum
  // agente — só passou a ser quando eu dei PATCH de platform_settings na frota. Aí três ligações
  // seguidas morreram com 0 segundo e 0 mensagem, e a minha primeira reversão reenviou o MESMO -1,
  // então "desfazer" não desfez nada.
  // A regra que fica: teto que o provedor aplica não se escreve por convenção ("-1 deve ser
  // infinito"), se escreve por verificação. Na dúvida, NÃO MANDE O CAMPO — o padrão do provedor é
  // sempre mais seguro que um sentinela adivinhado. O nosso teto real é por tenant, em
  // voice_web_limits, e continua valendo.
  const limites = {
    max_duration_seconds: 300,
  };
  if (!env.AGENT_ACTION_SECRET) return limites;
  return {
    ...limites,
    workspace_overrides: {
      conversation_initiation_client_data_webhook: {
        url: "https://guileoai.com/api/twilio-inbound",
        request_headers: { "x-guileo-secret": env.AGENT_ACTION_SECRET },
      },
    },
  };
}

// Create-or-update the client's dedicated Gui agent. Returns { ok, agent_id, step, created }.
// env needs ELEVENLABS_API_KEY (+ optional ELEVEN_VOICE_ID); ING is the INGEST_SECRET.
export async function provisionClientAgent(env, { email, business, industry, lang, brain, agentName, voiceId, services, prices }, ING) {
  const e = (email || "").toString().trim().toLowerCase();
  const L = ["pt", "es", "en"].includes(lang) ? lang : "en";
  if (!env.ELEVENLABS_API_KEY) return { ok: false, agent_id: "", step: "skipped (no ElevenLabs key)" };
  if (!e.includes("@")) return { ok: false, agent_id: "", step: "skipped (no email)" };

  try {
    // TENANT KNOWLEDGE BASE — the owner's own Q&A (walk-ins? parking? cancellation policy?)
    // becomes part of the VOICE brain, so the Gui answers business-specific questions on calls.
    // Best-effort: RPC missing (db/tenant_kb.sql not pasted) or empty → brain unchanged.
    let kbBrain = brain;
    try {
      const kr = await rpc("kb_for_agent", { p_secret: ING, p_email: e });
      if (kr.ok) {
        const kb = ((await kr.json()) || "").toString().slice(0, 1600);
        if (kb.trim()) kbBrain = `${brain || ""}\n\nBUSINESS FAQ (answer these exactly as the owner wrote them):\n${kb}`.trim();
      }
    } catch { /* KB is a bonus — never blocks a birth */ }
    // PRICES — the Gui must quote REAL prices, never close "in the dark". Prefer what the caller passed
    // (onboarding services / pre-formatted block); else read the tenant's live menu (biz_lookup).
    // Best-effort → "" never breaks a birth.
    let priceBlock = (prices || "").toString().trim() || formatPrices(services, L);
    if (!priceBlock) priceBlock = await fetchTenantPrices(env, e, L);
    const convCfg = buildConversationConfig(env, { business, industry, lang: L, brain: kbBrain, agentName, email: e, voiceId, prices: priceBlock });
    const platform = buildPlatformSettings(env); // caller-memory initiation webhook (null when not configured)

    // already provisioned? → update in place (idempotent, no duplicate agent / no double-bill)
    let existingId = "";
    try { const ar = await rpc("client_agent_lookup", { p_secret: ING, p_email: e }); if (ar.ok) existingId = ((await ar.json()) || "").toString(); } catch { /* best-effort */ }

    if (existingId) {
      const pr = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${existingId}`, {
        method: "PATCH", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_config: convCfg, ...(platform ? { platform_settings: platform } : {}) }),
      });
      if (pr.ok) return { ok: true, agent_id: existingId, step: `updated existing ${existingId}`, created: false };
      const patchStep = `err PATCH ${pr.status}: ${(await pr.text().catch(() => "")).slice(0, 160)}`;
      // update failed = the client's live agent kept a STALE brain/voice — visible in /admin, not just steps
      await emitFailure(env, "agent_update_failed", e, patchStep, { agent_id: existingId });
      return { ok: false, agent_id: existingId, step: patchStep, created: false };
    }

    const res = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
      method: "POST", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Gui · ${(business || e).toString()}`.slice(0, 60), conversation_config: convCfg, ...(platform ? { platform_settings: platform } : {}) }),
    });
    if (!res.ok) {
      const createStep = `err ${res.status}: ${(await res.text().catch(() => "")).slice(0, 180)}`;
      // a client who PAID but has NO agent is the worst outcome — alert /admin even if the caller
      // drops the return value (both callers set steps, but steps can be ignored; this can't).
      await emitFailure(env, "agent_provision_failed", e, createStep, {});
      return { ok: false, agent_id: "", step: createStep, created: false };
    }
    const d = await res.json();
    const agentId = d.agent_id || d.id || "";
    if (!agentId) {
      await emitFailure(env, "agent_provision_failed", e, "created_no_id — ElevenLabs returned no agent id", {});
      return { ok: false, agent_id: "", step: "created_no_id", created: true };
    }
    // persist so calls route + portal syncs the brain; surface a persistence failure (don't fake ok)
    const sr = await rpc("set_client_agent", { p_secret: ING, p_email: e, p_agent_id: agentId });
    if (!sr.ok) {
      // agent EXISTS in ElevenLabs but the DB link failed → calls won't route AND a retry would
      // duplicate it (lookup misses). This must be finished by hand — ring the /admin bell.
      await emitFailure(env, "agent_not_linked", e, `agent ${agentId} created but set_client_agent failed — link manually or calls won't route`, { agent_id: agentId });
      return { ok: false, agent_id: agentId, step: "created_but_NOT_linked — calls won't route", created: true };
    }
    return { ok: true, agent_id: agentId, step: "created", created: true };
  } catch (err) {
    await emitFailure(env, "agent_provision_failed", e, `err: ${String(err).slice(0, 120)}`, {});
    return { ok: false, agent_id: "", step: `err: ${String(err).slice(0, 120)}`, created: false };
  }
}

// INBOUND → THE CLIENT'S OWN GUI: import the client's Twilio number into ElevenLabs convai and assign
// their dedicated agent, so an inbound call is ANSWERED by their trained Gui. Best-effort; never throws.
// O CARIMBO NASCE DO AGENTE, NÃO DE QUEM PEDIU (2026-08-16).
// ← Auditoria: os TRÊS números da conta estavam etiquetados "naturaspaadm" na ElevenLabs —
//   inclusive o +1 986 444 3334, que atende o agente GUI, a linha de demo da própria Guileo.
//   A origem era `bind-number.js`: `label: email.split("@")[0]`.
//   O vínculo vinha do AGENTE, o rótulo vinha do E-MAIL DO PEDIDO — duas entradas independentes
//   descrevendo a mesma coisa, sem nada obrigando as duas a concordar. Divergiram, e ninguém viu,
//   porque só o vínculo tem efeito audível. O rótulo só é lido por um humano decidindo o que
//   apagar — que é o pior momento possível para uma etiqueta estar mentindo.
// A correção é de FORMA, não de valor: o rótulo passa a ser derivado do mesmo `agentId` que decide
// o vínculo. Não dá mais para discordar, porque não são mais duas fontes. O `label` do chamador
// vira só a rede de segurança para quando o provedor não responder quem é o agente.
async function carimboDoAgente(env, agentId, fallback) {
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
    if (r.ok) {
      const nome = (await r.json().catch(() => ({})))?.name || "";
      if (nome) return nome.slice(0, 60); // "Lilian · Natura Spa + Salon" — o nome white-label
    }
  } catch { /* provedor mudo → cai no rótulo do chamador, que é melhor que rótulo vazio */ }
  return (fallback || "Gui").slice(0, 60);
}

export async function elevenBindNumber(env, number, agentId, label) {
  if (!env.ELEVENLABS_API_KEY || !env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !number || !agentId) return { ok: false, reason: "missing inputs" };
  try {
    const carimbo = await carimboDoAgente(env, agentId, label);
    const cr = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", {
      method: "POST", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "twilio", phone_number: number, label: carimbo, sid: env.TWILIO_ACCOUNT_SID, token: env.TWILIO_AUTH_TOKEN }),
    });
    if (!cr.ok) return { ok: false, reason: `import ${cr.status}: ${(await cr.text().catch(() => "")).slice(0, 160)}` };
    const cd = await cr.json().catch(() => ({}));
    const pnId = cd.phone_number_id || cd.id || "";
    if (!pnId) return { ok: false, reason: "no phone_number_id returned" };
    const pr = await fetch(`https://api.elevenlabs.io/v1/convai/phone-numbers/${pnId}`, {
      method: "PATCH", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: agentId }),
    });
    if (!pr.ok) return { ok: false, reason: `assign ${pr.status}: ${(await pr.text().catch(() => "")).slice(0, 160)}` };
    return { ok: true, phone_number_id: pnId };
  } catch (e) { return { ok: false, reason: String(e).slice(0, 120) }; }
}

// BUY a fresh US Twilio number (the AI answers it), wire its SMS+Voice webhooks to Gui, persist it,
// and bind it to the client's agent so inbound calls are answered. The client then FORWARDS their own
// existing business number to this one (see forwardingInstructions). Best-effort; returns details.
export async function buyAndBindNumber(env, { email, agentId, areaCode, label }, ING) {
  const sid = env.TWILIO_ACCOUNT_SID, tok = env.TWILIO_AUTH_TOKEN;
  if (!sid || !tok) return { ok: false, reason: "twilio not configured" };
  try {
    // IDEMPOTENT: if this client ALREADY has a number, never buy a second one (no duplicate
    // $/mo number on a webhook double-delivery or manual re-run). Just re-bind the existing
    // number to the agent so the outcome is identical. Graceful: if the lookup RPC isn't
    // installed (db/client_number_lookup.sql) or errors, fall through to the normal purchase.
    if (email) {
      try {
        const lr = await rpc("client_number_lookup", { p_secret: ING, p_email: email });
        const existing = lr.ok ? ((await lr.json()) || "").toString() : "";
        if (existing) {
          // NEVER bind the platform's reserved demo line to a client agent (would hijack the site demo).
          if (existing.replace(/[^0-9]/g, "") === "19864443334") {
            await emitFailure(env, "reserved_number_blocked", email || "", `refused to bind the reserved demo line to ${email} — map a real number in /admin`, { number: existing });
            return { ok: false, number: "", reason: "reserved number refused" };
          }
          let inbound = { ok: false, reason: "no agent" };
          if (agentId) {
            inbound = await elevenBindNumber(env, existing, agentId, label);
            // number is LIVE but nobody answers it — that's a paying client with a dead line; alert.
            if (!inbound.ok) await emitFailure(env, "number_unbound", email || "", `number ${existing} exists but NOT bound to agent ${agentId} — inbound won't be answered · ${inbound.reason || ""}`, { number: existing, agent_id: agentId });
          }
          return { ok: true, number: existing, inbound: inbound.ok, inboundReason: inbound.reason || "", reused: true };
        }
      } catch { /* lookup best-effort → proceed to buy a fresh number */ }
    }
    const auth = "Basic " + btoa(`${sid}:${tok}`);
    const area = (areaCode || "").toString().replace(/[^0-9]/g, "");
    const sr = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/AvailablePhoneNumbers/US/Local.json?SmsEnabled=true&VoiceEnabled=true${area ? `&AreaCode=${area}` : ""}&PageSize=1`, { headers: { Authorization: auth } });
    const avail = sr.ok ? await sr.json() : {};
    const pick = avail?.available_phone_numbers?.[0]?.phone_number;
    if (!pick) return { ok: false, reason: "no number available" };
    const pr = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json`, {
      method: "POST", headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ PhoneNumber: pick, SmsUrl: "https://guileoai.com/api/twilio-inbound", SmsMethod: "POST", VoiceUrl: "https://guileoai.com/api/twilio-voice", VoiceMethod: "POST" }),
    });
    if (!pr.ok) return { ok: false, reason: `buy ${pr.status}: ${(await pr.text().catch(() => "")).slice(0, 140)}` };
    const pd = await pr.json();
    const number = pd.phone_number;
    // 1.4 — a number bought but NOT linked = orphaned (client's calls won't route, money spent). Surface it.
    if (email) {
      try {
        const snr = await rpc("set_client_number", { p_secret: ING, p_email: email, p_number: number });
        if (!snr.ok) await emitFailure(env, "number_orphaned", email, `bought ${number} but set_client_number failed — link manually`, { number });
      } catch (e) { await emitFailure(env, "number_orphaned", email, `bought ${number} but link errored: ${String(e).slice(0, 80)}`, { number }); }
    }
    let inbound = { ok: false, reason: "no agent" };
    if (agentId) {
      inbound = await elevenBindNumber(env, number, agentId, label);
      // number BOUGHT ($/mo) but not answered by the agent — money spent on a dead line; alert.
      if (!inbound.ok) await emitFailure(env, "number_unbound", email || "", `bought ${number} but NOT bound to agent ${agentId} — inbound won't be answered · ${inbound.reason || ""}`, { number, agent_id: agentId });
    }
    return { ok: true, number, inbound: inbound.ok, inboundReason: inbound.reason || "" };
  } catch (e) { return { ok: false, reason: String(e).slice(0, 120) }; }
}

// The forwarding instructions handed to the client — BOTH options, they pick. Codes are the common
// US ones; carriers vary, so we say so. The client dials these ONCE on their own business line.
export function forwardingInstructions(twilioNumber, lang = "en") {
  // dial-format: forwarding codes (*72 etc.) are dialed on a keypad, so strip the leading +1 and
  // any non-digits → the 10-digit number the carrier expects after the star code.
  const n = (twilioNumber || "").toString().replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (lang === "pt") return {
    full: `Encaminhar TODAS as ligações pra IA: no telefone do negócio, disque ${"*"}72${n} e ligue. (Cancelar: ${"*"}73)`,
    missed: `Encaminhar só as PERDIDAS (ocupado/sem atender): disque ${"*"}71${n} (ou ${"*"}92 — varia por operadora).`,
    note: `Os códigos podem variar por operadora. Se algum não funcionar, a gente te passa o certo da sua.`,
  };
  if (lang === "es") return {
    full: `Reenviar TODAS las llamadas a la IA: en el teléfono del negocio, marca ${"*"}72${n} y llama. (Cancelar: ${"*"}73)`,
    missed: `Reenviar solo las PERDIDAS (ocupado/sin contestar): marca ${"*"}71${n} (o ${"*"}92 — varía por operador).`,
    note: `Los códigos pueden variar por operador. Si alguno no funciona, te pasamos el correcto.`,
  };
  return {
    full: `Forward ALL calls to the AI: on your business phone, dial ${"*"}72${n} and press call. (Cancel: ${"*"}73)`,
    missed: `Forward only MISSED calls (busy/no-answer): dial ${"*"}71${n} (or ${"*"}92 — varies by carrier).`,
    note: `Codes can vary by carrier. If one doesn't work, we'll send the exact one for yours.`,
  };
}
