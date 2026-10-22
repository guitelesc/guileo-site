// Cloudflare Pages Function — POST /api/support
// Gui Suporte (client) + BROTO (admin). Instant resolution comes from the client-side scenario
// library (src/data/supportKB.js); this endpoint persists tickets, lists the queue, manages
// inventory, and provides the AI FALLBACK (Claude) for the rare question the library doesn't cover.
import { factsBlock } from "../lib/productFacts.js";
import { guardSystemPrompt } from "../lib/guiConstitution.js";
import { json, rateLimited } from "../lib/guard.js";
import { svcRpc, svcJson } from "../lib/sb.js";
import { emitFailure } from "../lib/failure.js";
import { supportReceivedEmail } from "../lib/emailTemplates.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });

// The CURRENT feature map Gui Support answers from — kept in sync with the cockpit so the AI never
// gives stale facts. Grouped so both the "support" and "trainer" contexts share one source of truth.
const FEATURE_FACTS = `GUILEO COCKPIT — what the owner actually has (answer from THIS, never invent a feature):
• GUILEO DESK (menu "Balcão" / tab "desk"): the front-desk app. Tabs: Agenda (day/week per provider; tap an empty slot to book; drag or "Move" to reschedule; buttons "Bloquear horário" for lunch/time off and "Alguém faltou" when a provider is out), Caixa (checkout: services, products, packages, gift cards, tips, split payment, receipts), Clientes (client card, alerts, history), Equipe e serviços (providers, hours, breaks, services, prices, deposits, commissions), Fechamento (end-of-day close by payment method and provider, CSV), Relatórios (occupancy, rebooking, busiest hours, top sellers), Importar (MindBody/Booker CSV). "Instalar o app" puts Guileo Desk on the iPad/phone home screen.
• The AI assistant (round 3D avatar, bottom-right) opens today's summary and can book, confirm, mark arrived/no-show, open checkout, find a client, show reports — by text or voice.
• Your AI: a 24/7 AI receptionist (Gui) answers every call, replies on WhatsApp/SMS/web-chat, books appointments, quotes your real prices, and closes & collects (pay-links/deposits). "Train your AI" (brain) + "Cérebro do negócio" (Knowledge Base — your own Q&A) shape what Gui says.
• Operations: live Schedule, Risk Radar (ranks upcoming appointments by no-show risk so you over-confirm the risky ones), Storm Mode (1-tap close+notify+reopen for a hurricane/emergency), LiveOrders/Kitchen where relevant.
• Customers: CRM 360 (every lead+contact with a full timeline), Leads do dia, Marketplace leads (Yelp/Angi/Thumbtack → Gui calls in ~60s).
• Grow revenue: Finance (real revenue from the ledger), Marketing, Datas & Aniversários (birthday/commemorative campaigns), Cupons & Campanhas (your own branded coupons), Inteligência (LTV, lead sources, forecast, abandoned bookings), Captura (intake forms + photo-quote), packages/memberships/gift cards (Recurring). A weekly value report emails you the ROI every Monday.
• Referrals: refer another business → both sides get credit when they subscribe.
• Billing: plans + credit top-ups; your credit balance and the "connection code" that links this cockpit live in Settings; contracts/invoices in Documents.
• Channels honesty: voice, SMS, web-chat and email are LIVE; WhatsApp/Instagram/Google/Ads light up when their API is connected (shown with an amber badge until then).`;

// Model fallback chain (same discipline as pitch-ai.js/widget-chat.js): a transient failure on one
// model must NOT drop the owner to a naked error. Try each in order; auth/billing stops early.
// MODEL_CHAIN vem de ../lib/guiBrain.js — NÃO declare outra aqui (2026-08-12).
// Eram DEZ cópias idênticas da mesma lista de modelos, uma por arquivo. Idênticas HOJE: conferi as
// dez antes de mexer, e é exatamente por estarem iguais que a hora de unificar é agora — depois que
// uma diverge, alguém já foi atendido pelo modelo errado e ninguém sabe qual superfície foi.
// É o padrão que esta sessão inteira perseguiu: cópia sem vínculo com a fonte.
import { askClaude } from "../lib/guiBrain.js";

// AI answer — Gui answers a Guileo support/training question warmly + flags if it needs a human.
// context: "support" (default) or "trainer" (the in-cockpit Treinadora teaching the owner to use it).
export async function aiAnswer(env, question, lang, context = "support") {
  if ((!env.ANTHROPIC_API_KEY && !env.ELEVENLABS_API_KEY) || !question) return null;
  const langName = lang === "pt" ? "Brazilian Portuguese" : lang === "es" ? "LatAm Spanish" : lang === "hi" ? "Hindi" : "English";
  const persona = context === "trainer"
    ? `You are Gui, the friendly onboarding Trainer inside the Guileo cockpit. The owner is LEARNING to use the platform. Answer their "how do I…?" question concretely in ${langName}, first person as Gui, 2-4 warm sentences, and when useful name the EXACT tab/button to tap. Tie the answer to what they GAIN (more bookings, fewer no-shows, faster follow-up). Only set escalate:true if it's truly a billing/refund/account issue you can't teach.`
    : `You are Gui Support, the warm concierge AI for Guileo. Answer the owner's support question concretely in ${langName}, first person as Gui, 2-4 sentences, calm and helpful. If the request is a refund, cancellation, account deletion, legal/privacy request, or billing dispute, briefly help AND set escalate:true (a human teammate picks it up).`;
  const system = `${guardSystemPrompt(persona, { audience: "client" })}\n\n${FEATURE_FACTS}\n\n${factsBlock()}\n\nReply ONLY compact JSON: {"answer":"...","escalate":true|false}`;
  // 2026-10-05: sem chamada direta à Anthropic — askClaude usa o Escritor da ElevenLabs quando ela está desligada.
  const txt = await askClaude(env, { system, maxTokens: 340, messages: [{ role: "user", content: question.slice(0, 1500) }] });
  if (txt) {
    // JSON quebrado antes caía no catch e tentava o próximo modelo; agora é uma chamada só → null, sem levantar.
    try {
      const m = txt.match(/\{[\s\S]*\}/);
      return m ? JSON.parse(m[0]) : { answer: txt.slice(0, 600), escalate: false };
    } catch { /* JSON inválido → mesmo destino de antes quando todos falhavam */ }
  }
  return null;
}

// ── "RECEBEMOS O SEU CHAMADO" — o comprovante que fica com o CLIENTE (2026-09-27) ─────────────
// Sai DEPOIS da gravação (o id já existe) e nunca derruba a criação do chamado: e-mail recusado
// vira `ok:false` com o motivo no recibo + uma linha no feed, e o chamado continua aberto.
// Devolve { ok, id?, motivo? } — `ok:true` SÓ com o id da Resend na mão. A tela usa este recibo
// para decidir se pode dizer "te mandamos um e-mail": sem id, ela não diz.
const IDIOMAS_EMAIL = ["pt", "es", "en"];
async function confirmaAoCliente(env, { email, ticketId, subject, body, langPedido }) {
  const falhou = async (motivo, extra = {}) => {
    // Tipo de propósito FORA da lista de urgentes do failure.js: é registro no feed, não alarme.
    await emitFailure(env, "suporte_confirmacao_nao_enviada", email, motivo, { ticket_id: ticketId, ...extra }).catch(() => {});
    return { ok: false, motivo };
  };
  try {
    if (!env.RESEND_API_KEY) return await falhou("RESEND_API_KEY ausente — e-mail de confirmação não saiu");
    // Idioma: 1º o perfil do cliente (é a língua em que ele contratou), 2º o que a tela mandou,
    // 3º pt (o cockpit nasce em pt — mesma regra do `avisaCliente` em support-hub.js).
    let lang = "", name = "", business = "";
    const p = await svcJson(env, "get_client_profile", { p_secret: env.INGEST_SECRET || "", p_email: email }).catch(() => null);
    if (p && typeof p === "object" && p.ok !== false) {
      if (IDIOMAS_EMAIL.includes(p.lang)) lang = p.lang;
      name = (p.owner || "").toString().slice(0, 80);
      business = (p.business_name || "").toString().slice(0, 80);
    }
    if (!lang) lang = IDIOMAS_EMAIL.includes(langPedido) ? langPedido : (langPedido === "hi" ? "en" : "pt");
    const resumo = (body || subject || "").toString().slice(0, 400);
    const { subject: assunto, html } = supportReceivedEmail({ name, business, lang, ticketId, summary: resumo });
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: email, subject: assunto, html }),
      signal: AbortSignal.timeout(8000),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return await falhou(`Resend recusou (HTTP ${r.status})${d && d.message ? `: ${String(d.message).slice(0, 120)}` : ""}`, { resend_status: r.status });
    // 200 sem id é "aceitei" sem comprovante — não conta como enviado.
    if (!d || !d.id) return await falhou("Resend respondeu 200 sem id — envio sem comprovante", { resend_status: r.status });
    return { ok: true, id: d.id, lang };
  } catch (e) { return await falhou(`erro ao enviar a confirmação: ${String(e).slice(0, 120)}`); }
}

// O recibo do aviso ao dono, na versão que pode ir para a TELA DO CLIENTE: só sim/não por canal.
// O recibo completo (caixa do dono, telefone, motivo da Meta) fica no feed do /admin — a tabela
// support_tickets não tem coluna de payload/notas, e a `thread` é lida pelo cliente, então gravar
// o recibo lá exporia dado interno. Sem mudar o schema, o lugar dele é a resposta + o feed.
function avisoPublico(r) {
  if (!r || typeof r !== "object") return { urgente: true, chegou: false, feed: false, email: false, whatsapp: false };
  return { urgente: !!r.urgente, chegou: !!r.chegou, feed: !!(r.feed && r.feed.ok), email: !!(r.email && r.email.ok), whatsapp: !!(r.whatsapp && r.whatsapp.ok) };
}

// ── FRASES QUE CHEGAM NA TELA DO CLIENTE (2026-09-28) ─────────────────────────────────────────
// Todo `motivo`/`note` deste arquivo era português fixo, lido por um cliente de interface em
// inglês. Agora sai no idioma do pedido (`lang` no corpo), padrão en. O motivo técnico (nome da
// RPC, status HTTP) vai em `detalhe_tecnico`, nunca misturado na frase.
const idiomaTela = (v) => { const l = String(v || "").toLowerCase().slice(0, 2); return ["en", "pt", "es", "hi"].includes(l) ? l : "en"; };
const FRASES_SUPORTE = {
  indisponivel: { en: "Support is not available right now. Please try again in a moment.", pt: "O suporte não está disponível agora. Tente de novo em instantes.", es: "El soporte no está disponible ahora. Inténtelo de nuevo en un momento.", hi: "सहायता अभी उपलब्ध नहीं है। कृपया थोड़ी देर में फिर कोशिश करें।" },
  nao_gravou_chamado: { en: "Your request was not saved — please try again.", pt: "O chamado não foi gravado — tente de novo.", es: "Su solicitud no se guardó — inténtelo de nuevo.", hi: "आपका अनुरोध सहेजा नहीं गया — कृपया फिर कोशिश करें।" },
  nao_e_seu: { en: "This request does not belong to your account.", pt: "Este chamado não é da sua conta.", es: "Esta solicitud no pertenece a su cuenta.", hi: "यह अनुरोध आपके खाते का नहीं है।" },
  nao_gravou_resposta: { en: "I couldn't save your reply. Please try again.", pt: "Não consegui gravar a resposta. Tente de novo.", es: "No pude guardar su respuesta. Inténtelo de nuevo.", hi: "मैं आपका उत्तर सहेज नहीं सका। कृपया फिर कोशिश करें।" },
  nao_atualizou: { en: "I couldn't update this request. Please try again.", pt: "Não consegui atualizar o chamado. Tente de novo.", es: "No pude actualizar la solicitud. Inténtelo de nuevo.", hi: "मैं इस अनुरोध को अपडेट नहीं कर सका। कृपया फिर कोशिश करें।" },
  so_admin: { en: "This action is not available in your account.", pt: "Esta ação não está disponível na sua conta.", es: "Esta acción no está disponible en su cuenta.", hi: "यह कार्रवाई आपके खाते में उपलब्ध नहीं है।" },
  nao_leu_conversa: { en: "I couldn't load the conversation. Please try again.", pt: "Não consegui ler a conversa. Tente de novo.", es: "No pude cargar la conversación. Inténtelo de nuevo.", hi: "मैं बातचीत लोड नहीं कर सका। कृपया फिर कोशिश करें।" },
  sem_texto: { en: "Write a message first.", pt: "Escreva uma mensagem primeiro.", es: "Escriba un mensaje primero.", hi: "पहले एक संदेश लिखें।" },
  nao_enviou: { en: "I couldn't send your message. Please try again.", pt: "Não consegui enviar a mensagem. Tente de novo.", es: "No pude enviar su mensaje. Inténtelo de nuevo.", hi: "मैं आपका संदेश नहीं भेज सका। कृपया फिर कोशिश करें।" },
  nao_leu_consultor: { en: "I couldn't load your consultant. Please try again.", pt: "Não consegui ler o seu consultor. Tente de novo.", es: "No pude cargar a su consultor. Inténtelo de nuevo.", hi: "मैं आपके सलाहकार की जानकारी लोड नहीं कर सका। कृपया फिर कोशिश करें।" },
  sem_consultor: { en: "No consultant is assigned to your account yet.", pt: "Ainda sem consultor atribuído à sua conta.", es: "Aún no hay un consultor asignado a su cuenta.", hi: "आपके खाते के लिए अभी कोई सलाहकार नियुक्त नहीं है।" },
  nota_invalida: { en: "The rating must be from 1 to 5.", pt: "A nota tem que ser de 1 a 5.", es: "La calificación debe ser de 1 a 5.", hi: "रेटिंग 1 से 5 के बीच होनी चाहिए।" },
  nao_gravou_nota: { en: "I couldn't save your rating. Please try again.", pt: "Não consegui registrar a nota. Tente de novo.", es: "No pude guardar su calificación. Inténtelo de nuevo.", hi: "मैं आपकी रेटिंग सहेज नहीं सका। कृपया फिर कोशिश करें।" },
};
// Os dois textos reais do banco (lidos no pg_proc em 2026-09-28): "...ainda nao tem vendedor
// atribuido" (chat_cliente_enviar) e "...ainda nao tem consultor atribuido" (consultor_nota_dar).
const semConsultor = (motivo) => /nao tem (vendedor|consultor) atribuido/i.test(String(motivo || ""));
export const fraseSuporte = (k, lang) => (FRASES_SUPORTE[k] && (FRASES_SUPORTE[k][lang] || FRASES_SUPORTE[k].en)) || "";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (await rateLimited(request, env, "support", 40)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const action = (b.action || "list").toString();
    const secret = env.SCHED_SECRET || "";
    // 🚨 DOIS PORTÕES, DOIS SEGREDOS (incidente 2026-09-28): os chamados (support_ticket_*) são
    // gated por SCHED, mas a família do RELACIONAMENTO — seller_of_client, chat_ler,
    // chat_cliente_enviar, consultor_nota_dar — confere o literal INGEST (lido no pg_proc, uma a
    // uma). Este arquivo mandava SCHED para todas: o banco respondia 403 "unauthorized", a rota
    // devolvia 502 e a aba Relacionamento do cliente nunca abriu o consultor nem o chat.
    const ingest = env.INGEST_SECRET || "";
    // Idioma das frases que chegam na tela: o do pedido; sem ele, inglês (o cliente que paga
    // hoje usa a Central em inglês e lia "não consegui ler a conversa").
    const lang = idiomaTela(b.lang);
    const m = (k, extra = "") => fraseSuporte(k, lang) + extra;

    // PER-TENANT GATE: get_client_data binds email↔connection-key (rejects a mismatch), so a token
    // can only ever touch its OWN tenant's tickets. No OWNER_EMAIL fallback. (BROTO's whole-queue
    // view is admin-gated separately via /api/broto.)
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);
    const gd = await rpc("get_client_data", { p_email: email, p_key: key });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    if (action === "ai") {
      const ctx = b.context === "trainer" ? "trainer" : "support";
      const ans = await aiAnswer(env, (b.question || "").toString(), (b.lang || "en").toString(), ctx);
      return json({ ok: true, ...(ans || { answer: null, escalate: true }) });
    }

    if (action === "create") {
      const escalado = (b.status || "open") === "escalated" || (b.priority || "normal") === "high";
      const r = await rpc("support_ticket_create", { p_secret: secret, p_email: email, p_subject: b.subject || null, p_category: b.category || "other", p_body: b.body || "", p_ai_handled: b.ai_handled === true, p_status: b.status || "open", p_kb_id: b.kb_id || null, p_priority: b.priority || "normal" });
      if (!r.ok) return json({ ok: true, ready: false, note: m("indisponivel"), detalhe_tecnico: `support_ticket_create HTTP ${r.status} (db/support.sql)` });
      const id = await r.json().catch(() => null);
      // 🚨 "ok" sem id é promessa sem lastro — e aqui a promessa é "escalei para um humano".
      if (!id) return json({ ok: false, motivo: m("nao_gravou_chamado") }, 503);

      // 🚨 NINGUÉM ERA NOTIFICADO (auditoria da área do cliente, 2026-08-20).
      // A tela imprimia "✓ Escalado para um humano" e NÃO saía e-mail nem SMS deste arquivo. Um
      // chamado urgente às 2h da manhã não acordava ninguém, e o único sinal existente era uma
      // CONTAGEM agregada no brief do Company OS — que ninguém lê às 2h.
      // `emitFailure` é o canal de alerta que a plataforma já usa e que já chega no dono.
      // Só escala o que É urgente (escalado ou prioridade alta): avisar de tudo vira alerta que
      // ninguém lê, e alerta ignorado é o mesmo que alerta nenhum.
      //
      // (2026-09-27) TRÊS CONSERTOS NO MESMO PONTO:
      //  · `semTrava` — a trava de 6h do avisarDono é por (tipo + cliente): o SEGUNDO chamado
      //    urgente do mesmo cliente em 6h era calado. Dois pedidos de socorro são dois avisos.
      //  · `ignoraMudo` — com `emails_dono=off` e o WhatsApp do dono fora, o chamado caía só no
      //    feed. Gente pedindo ajuda não é "alerta de plataforma": o e-mail sai mesmo no mudo.
      //  · o RECIBO — `emitFailure` agora devolve o que aconteceu por canal; antes era jogado fora
      //    e a rota respondia `ok` sem saber se alguém foi avisado.
      // O freio contra abuso continua sendo o rateLimited do topo (40 por janela) + a autenticação
      // por chave do tenant: só um cliente real, na própria conta, consegue disparar isto.
      //
      // A confirmação ao cliente só sai para chamado que ESPERA GENTE. O chat grava também cada
      // pergunta resolvida na hora (status "resolved"): mandar e-mail "recebemos seu chamado" a
      // cada pergunta respondida seria spam nosso na caixa de quem paga.
      const esperaGente = escalado || (b.status || "open") !== "resolved";
      const [alerta, confirmacao] = await Promise.all([
        escalado
          ? emitFailure(env, "chamado_escalado", email,
            `${email} escalou um chamado: ${(b.subject || "(sem assunto)").toString().slice(0, 140)}`,
            { ticket_id: id, categoria: b.category || "other", prioridade: b.priority || "normal",
              corpo: (b.body || "").toString().slice(0, 500) },
            { semTrava: true, ignoraMudo: true }).catch(() => null)
          : Promise.resolve(null),
        esperaGente
          ? confirmaAoCliente(env, { email, ticketId: id, subject: b.subject, body: b.body, langPedido: (b.lang || "").toString().slice(0, 5).toLowerCase() })
            .catch((e) => ({ ok: false, motivo: String(e).slice(0, 120) }))
          : Promise.resolve({ ok: false, pulado: true, motivo: "chamado resolvido na hora — sem e-mail de confirmação" }),
      ]);
      return json({
        ok: true, ready: true, id,
        ...(escalado ? { aviso: avisoPublico(alerta) } : {}),
        confirmacao: { ok: confirmacao.ok === true, ...(confirmacao.id ? { id: confirmacao.id } : {}), ...(confirmacao.pulado ? { pulado: true } : {}), ...(confirmacao.motivo ? { motivo: confirmacao.motivo } : {}) },
      });
    }
    // 🚨 "UUID SOZINHO NUNCA AUTORIZA NADA" (a lição já estava escrita em support-hub.js:117 e
    // nunca chegou aqui). `support_ticket_reply` e `support_ticket_set` fazem `where id = p_id`
    // sem cruzar com o dono: com um UUID de outro negócio, um cliente injetava mensagem na thread
    // de suporte alheia — podendo escolher `p_role:"gui"`, ou seja, se passando por NÓS — e fechava
    // o chamado do outro. O portão é o mesmo e-mail que já foi autenticado no topo deste arquivo.
    const chamadoEhDele = async (id) => {
      if (!id) return false;
      const r = await svcRpc(env, "support_ticket_list", { p_secret: secret, p_email: email, p_limit: 1000 });
      if (!r.ok) return false;                      // não deu pra confirmar → NEGA (fail-closed)
      const lista = (await r.json().catch(() => [])) || [];
      return Array.isArray(lista) && lista.some((t) => String(t?.id) === String(id));
    };

    if (action === "reply") {
      if (!(await chamadoEhDele(b.id))) return json({ error: "forbidden", motivo: m("nao_e_seu") }, 403);
      // O papel também é travado: quem escreve por este endpoint é o CLIENTE. Aceitar `p_role`
      // do corpo deixava ele publicar como "gui" e forjar uma resposta nossa.
      // 🚨 `p_email` É OBRIGATÓRIO AQUI (2026-09-28): existem DUAS support_ticket_reply no banco
      // (4 e 5 argumentos). Chamando com 4, o PostgREST devolve PGRST203 "could not choose the
      // best candidate function" — toda resposta de cliente num chamado falhava. Com `p_email` a
      // chamada cai na versão que TAMBÉM filtra pelo dono dentro do banco (cinto e suspensório
      // com o chamadoEhDele acima).
      const r = await svcRpc(env, "support_ticket_reply", { p_secret: secret, p_id: b.id, p_role: "client", p_text: b.text || "", p_email: email });
      if (!r.ok) return json({ ok: false, motivo: m("nao_gravou_resposta"), detalhe_tecnico: `support_ticket_reply HTTP ${r.status}` }, 503);
      const gravou = await r.json().catch(() => false);   // a RPC devolve BOOLEANO: `r.ok` não prova nada
      return json({ ok: gravou === true, replied: gravou === true });
    }
    if (action === "set") {
      if (!(await chamadoEhDele(b.id))) return json({ error: "forbidden", motivo: m("nao_e_seu") }, 403);
      // Cliente pode FECHAR o próprio chamado; atribuir responsável é do time, não dele.
      // `p_email` pelo mesmo motivo do reply: duas sobrecargas (5 e 6 args) → PGRST203 sem ele.
      const r = await svcRpc(env, "support_ticket_set", { p_secret: secret, p_id: b.id, p_status: b.status || null, p_resolution: b.resolution || null, p_assigned: null, p_email: email });
      if (!r.ok) return json({ ok: false, motivo: m("nao_atualizou"), detalhe_tecnico: `support_ticket_set HTTP ${r.status}` }, 503);
      const mudou = await r.json().catch(() => false);
      return json({ ok: mudou === true, updated: mudou === true });
    }
    // 🚨 VAZAMENTO MULTI-TENANT FECHADO (2026-08-20, auditoria da área do cliente).
    // `inventory_list` e `inventory_upsert` são RPCs de ADMINISTRADOR: elas leem
    // `platform_inventory` SEM filtro nenhum e devolvem `assigned_to`, que é o e-mail do cliente
    // dono de cada número/conta. Estavam expostas aqui, num endpoint autenticado por CLIENTE — ou
    // seja, qualquer cliente pagante, com a PRÓPRIA chave, fazia um POST e recebia os telefones,
    // hardware, contas e os E-MAILS de todos os outros negócios da plataforma. E o `upsert` deixava
    // reatribuir a si mesmo o número de outro negócio, ou marcá-lo inativo.
    // Elas já existem no `/api/broto`, que é gated pela senha do /admin. É lá que pertencem.
    // Nenhuma tela de cliente chamava isto (conferido com grep em src/): remover não quebra nada.
    if (action === "inventory_list" || action === "inventory_upsert") {
      return json({ error: "forbidden", motivo: m("so_admin"), detalhe_tecnico: "inventário é ação de administrador — use /api/broto" }, 403);
    }

    // ── QUEM É O MEU CONSULTOR ────────────────────────────────────────────────────────────────
    // Pedido do Luis: a aba Relacionamento mostra o consultor do cliente e um chat que chega
    // DIRETO nele. Sem isto o cliente pede socorro para "a Guileo" — uma entidade — em vez de
    // falar com a pessoa que assinou a conta dele. O e-mail do consultor NÃO vai para a tela:
    // o contato acontece pelo chamado, que já é escopado e auditado.
    // ── CHAT DIRETO COM QUEM VENDEU (2026-08-20) ──────────────────────────────────────────────
    // O suporte responde sobre o PRODUTO. Isto é a RELAÇÃO: o cliente fala com a pessoa que vendeu
    // pra ele. O e-mail do cliente é o AUTENTICADO desta sessão; o vendedor é resolvido no banco
    // por `seller_of_client` — o cliente nunca escolhe pra qual vendedor escreve.
    if (action === "chat_ler") {
      const r = await svcRpc(env, "chat_ler", { p_secret: ingest, p_client_email: email, p_seller_email: "" });
      if (!r.ok) return json({ ok: false, motivo: m("nao_leu_conversa"), detalhe_tecnico: `chat_ler HTTP ${r.status}` }, 503);
      const d = await r.json().catch(() => null);
      if (!d?.ok) return json({ ok: false, motivo: m("nao_leu_conversa"), detalhe_tecnico: `chat_ler: ${d?.motivo || "resposta inesperada"}` }, 503);
      return json({ ok: true, mensagens: d.mensagens || [] });
    }
    if (action === "chat_enviar") {
      const texto = (b.texto || "").toString().trim();
      if (!texto) return json({ ok: false, motivo: m("sem_texto") }, 400);
      const r = await svcRpc(env, "chat_cliente_enviar", { p_secret: ingest, p_client_email: email, p_texto: texto.slice(0, 2000) });
      if (!r.ok) return json({ ok: false, motivo: m("nao_enviou"), detalhe_tecnico: `chat_cliente_enviar HTTP ${r.status}` }, 503);
      const d = await r.json().catch(() => null);
      // "Sem consultor atribuído" NÃO é pane nossa: é estado da conta. O banco devolve o motivo
      // em texto livre PT ("este cliente ainda nao tem vendedor atribuido") — a tela recebe a
      // frase no idioma dela + a marca estável `sem_consultor:true`, e status 409 (não 503).
      if (d && d.ok === false && semConsultor(d.motivo)) return json({ ok: false, sem_consultor: true, motivo: m("sem_consultor") }, 409);
      if (!d?.ok || !d.id) return json({ ok: false, motivo: m("nao_enviou"), detalhe_tecnico: `chat_cliente_enviar: ${d?.motivo || "sem id"}` }, 503);
      return json({ ok: true, id: d.id });
    }

    if (action === "consultor") {
      const r = await svcRpc(env, "seller_of_client", { p_secret: ingest, p_client_email: email });
      if (!r.ok) return json({ ok: false, motivo: m("nao_leu_consultor"), detalhe_tecnico: `seller_of_client HTTP ${r.status}` }, 503);
      const c = await r.json().catch(() => null);
      if (!c || !c.email) return json({ ok: true, consultor: null, sem_consultor: true, motivo: m("sem_consultor") });
      return json({ ok: true, consultor: { nome: c.name || "", idioma: c.lang || "en" } });
    }

    // ── O CLIENTE AVALIA O CONSULTOR ──────────────────────────────────────────────────────────
    // O vendedor vê média e tendência, NUNCA quem deu (decisão do Luis: "a nota sem o nome").
    // O anonimato é reforçado no banco: comentário sai sem data exata, e o resumo se recusa a
    // mostrar comentário com menos de 3 votos — em carteira pequena, um comentário sozinho
    // identifica quem falou, e anonimato que vaza é pior que nota aberta.
    if (action === "avaliar") {
      const nota = parseInt(b.nota, 10);
      const r = await svcRpc(env, "consultor_nota_dar", {
        p_secret: ingest, p_client_email: email, p_nota: Number.isFinite(nota) ? nota : 0,
        p_comentario: (b.comentario || "").toString().slice(0, 800) || null,
        p_ticket: b.ticket_id || null,
      });
      if (!r.ok) return json({ ok: false, motivo: m("nao_gravou_nota"), detalhe_tecnico: `consultor_nota_dar HTTP ${r.status}` }, 503);
      const d = await r.json().catch(() => null);
      if (d && d.ok === false && semConsultor(d.motivo)) return json({ ok: false, sem_consultor: true, motivo: m("sem_consultor") }, 409);
      if (d && d.ok === false && /1 a 5/.test(String(d.motivo || ""))) return json({ ok: false, motivo: m("nota_invalida") }, 400);
      // "ok" sem id é promessa sem lastro — devolve o comprovante ou declara a falha.
      if (!d || d.ok !== true || !d.id) return json({ ok: false, motivo: m("nao_gravou_nota"), detalhe_tecnico: `consultor_nota_dar: ${d?.motivo || "sem id"}` }, 503);
      return json({ ok: true, id: d.id });
    }

    // default: list tickets — ALWAYS scoped to the caller's own email. The whole cross-tenant
    // queue is admin-only and served by /api/broto (admin-password gated). A client token must
    // never be able to read another tenant's tickets, so `all:true` is intentionally ignored here.
    const r = await svcRpc(env, "support_ticket_list", { p_secret: secret, p_email: email, p_limit: Math.min(Math.max(parseInt(b.limit, 10) || 200, 1), 1000) });
    // Instrução de engenharia ("Paste db/support.sql") não é frase para cliente: vai a frase
    // segura na tela e o detalhe técnico num campo à parte, para o admin.
    if (!r.ok) return json({ ok: true, ready: false, note: m("indisponivel"), detalhe_tecnico: `support_ticket_list HTTP ${r.status} (db/support.sql)`, tickets: [] });
    const tickets = (await r.json()) || [];
    return json({ ok: true, ready: true, count: tickets.length, tickets });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
