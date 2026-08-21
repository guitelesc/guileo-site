// Cloudflare Pages Function — POST /api/support
// Gui Suporte (client) + BROTO (admin). Instant resolution comes from the client-side scenario
// library (src/data/supportKB.js); this endpoint persists tickets, lists the queue, manages
// inventory, and provides the AI FALLBACK (Claude) for the rare question the library doesn't cover.
import { factsBlock } from "../lib/productFacts.js";
import { guardSystemPrompt } from "../lib/guiConstitution.js";
import { json, rateLimited } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";
import { emitFailure } from "../lib/failure.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });

// The CURRENT feature map Gui Support answers from — kept in sync with the cockpit so the AI never
// gives stale facts. Grouped so both the "support" and "trainer" contexts share one source of truth.
const FEATURE_FACTS = `GUILEO COCKPIT — what the owner actually has (answer from THIS, never invent a feature):
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
import { MODEL_CHAIN } from "../lib/guiBrain.js";

// AI answer — Gui answers a Guileo support/training question warmly + flags if it needs a human.
// context: "support" (default) or "trainer" (the in-cockpit Treinadora teaching the owner to use it).
export async function aiAnswer(env, question, lang, context = "support") {
  if (!env.ANTHROPIC_API_KEY || !question) return null;
  const langName = lang === "pt" ? "Brazilian Portuguese" : lang === "es" ? "LatAm Spanish" : lang === "hi" ? "Hindi" : "English";
  const persona = context === "trainer"
    ? `You are Gui, the friendly onboarding Trainer inside the Guileo cockpit. The owner is LEARNING to use the platform. Answer their "how do I…?" question concretely in ${langName}, first person as Gui, 2-4 warm sentences, and when useful name the EXACT tab/button to tap. Tie the answer to what they GAIN (more bookings, fewer no-shows, faster follow-up). Only set escalate:true if it's truly a billing/refund/account issue you can't teach.`
    : `You are Gui Support, the warm concierge AI for Guileo. Answer the owner's support question concretely in ${langName}, first person as Gui, 2-4 sentences, calm and helpful. If the request is a refund, cancellation, account deletion, legal/privacy request, or billing dispute, briefly help AND set escalate:true (a human teammate picks it up).`;
  const system = `${guardSystemPrompt(persona, { audience: "client" })}\n\n${FEATURE_FACTS}\n\n${factsBlock()}\n\nReply ONLY compact JSON: {"answer":"...","escalate":true|false}`;
  for (const model of MODEL_CHAIN) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 340, system, messages: [{ role: "user", content: question.slice(0, 1500) }] }),
      });
      if (r.ok) {
        const d = await r.json().catch(() => ({}));
        const txt = d?.content?.[0]?.text || "";
        if (!txt) continue;
        const m = txt.match(/\{[\s\S]*\}/);
        return m ? JSON.parse(m[0]) : { answer: txt.slice(0, 600), escalate: false };
      }
      if (r.status === 401 || r.status === 402) break; // auth/billing won't improve with another model
    } catch { /* try next model */ }
  }
  return null;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (await rateLimited(request, env, "support", 40)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const action = (b.action || "list").toString();
    const secret = env.SCHED_SECRET || "";

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
      if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/support.sql to activate support." });
      const id = await r.json().catch(() => null);
      // 🚨 "ok" sem id é promessa sem lastro — e aqui a promessa é "escalei para um humano".
      if (!id) return json({ ok: false, motivo: "o chamado não foi gravado — tente de novo" }, 502);

      // 🚨 NINGUÉM ERA NOTIFICADO (auditoria da área do cliente, 2026-08-20).
      // A tela imprimia "✓ Escalado para um humano" e NÃO saía e-mail nem SMS deste arquivo. Um
      // chamado urgente às 2h da manhã não acordava ninguém, e o único sinal existente era uma
      // CONTAGEM agregada no brief do Company OS — que ninguém lê às 2h.
      // `emitFailure` é o canal de alerta que a plataforma já usa e que já chega no dono.
      // Só escala o que É urgente (escalado ou prioridade alta): avisar de tudo vira alerta que
      // ninguém lê, e alerta ignorado é o mesmo que alerta nenhum.
      if (escalado) {
        await emitFailure(env, "chamado_escalado", email,
          `${email} escalou um chamado: ${(b.subject || "(sem assunto)").toString().slice(0, 140)}`,
          { ticket_id: id, categoria: b.category || "other", prioridade: b.priority || "normal",
            corpo: (b.body || "").toString().slice(0, 500) }).catch(() => {});
      }
      return json({ ok: true, ready: true, id });
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
      if (!(await chamadoEhDele(b.id))) return json({ error: "forbidden", motivo: "este chamado não é da sua conta" }, 403);
      // O papel também é travado: quem escreve por este endpoint é o CLIENTE. Aceitar `p_role`
      // do corpo deixava ele publicar como "gui" e forjar uma resposta nossa.
      const r = await rpc("support_ticket_reply", { p_secret: secret, p_id: b.id, p_role: "client", p_text: b.text || "" });
      if (!r.ok) return json({ ok: false, motivo: `não consegui gravar a resposta (HTTP ${r.status})` }, 502);
      const gravou = await r.json().catch(() => false);   // a RPC devolve BOOLEANO: `r.ok` não prova nada
      return json({ ok: gravou === true, replied: gravou === true });
    }
    if (action === "set") {
      if (!(await chamadoEhDele(b.id))) return json({ error: "forbidden", motivo: "este chamado não é da sua conta" }, 403);
      // Cliente pode FECHAR o próprio chamado; atribuir responsável é do time, não dele.
      const r = await rpc("support_ticket_set", { p_secret: secret, p_id: b.id, p_status: b.status || null, p_resolution: b.resolution || null, p_assigned: null });
      if (!r.ok) return json({ ok: false, motivo: `não consegui atualizar (HTTP ${r.status})` }, 502);
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
      return json({ error: "forbidden", motivo: "inventário é ação de administrador — use /api/broto" }, 403);
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
      const r = await svcRpc(env, "chat_ler", { p_secret: secret, p_client_email: email, p_seller_email: "" });
      if (!r.ok) return json({ ok: false, motivo: `não consegui ler a conversa (HTTP ${r.status})` }, 502);
      const d = await r.json().catch(() => null);
      if (!d?.ok) return json({ ok: false, motivo: d?.motivo || "resposta inesperada" }, 502);
      return json({ ok: true, mensagens: d.mensagens || [] });
    }
    if (action === "chat_enviar") {
      const texto = (b.texto || "").toString().trim();
      if (!texto) return json({ ok: false, motivo: "sem texto" }, 400);
      const r = await svcRpc(env, "chat_cliente_enviar", { p_secret: secret, p_client_email: email, p_texto: texto.slice(0, 2000) });
      if (!r.ok) return json({ ok: false, motivo: `não consegui enviar (HTTP ${r.status})` }, 502);
      const d = await r.json().catch(() => null);
      if (!d?.ok || !d.id) return json({ ok: false, motivo: d?.motivo || "não gravou a mensagem" }, 502);
      return json({ ok: true, id: d.id });
    }

    if (action === "consultor") {
      const r = await svcRpc(env, "seller_of_client", { p_secret: secret, p_client_email: email });
      if (!r.ok) return json({ ok: false, motivo: `não consegui ler o seu consultor (HTTP ${r.status})` }, 502);
      const c = await r.json().catch(() => null);
      if (!c || !c.email) return json({ ok: true, consultor: null, motivo: "ainda sem consultor atribuído" });
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
        p_secret: secret, p_client_email: email, p_nota: Number.isFinite(nota) ? nota : 0,
        p_comentario: (b.comentario || "").toString().slice(0, 800) || null,
        p_ticket: b.ticket_id || null,
      });
      if (!r.ok) return json({ ok: false, motivo: `não consegui registrar a nota (HTTP ${r.status})` }, 502);
      const d = await r.json().catch(() => null);
      // "ok" sem id é promessa sem lastro — devolve o comprovante ou declara a falha.
      if (!d || d.ok !== true || !d.id) return json({ ok: false, motivo: d?.motivo || "não gravou a nota" }, 502);
      return json({ ok: true, id: d.id });
    }

    // default: list tickets — ALWAYS scoped to the caller's own email. The whole cross-tenant
    // queue is admin-only and served by /api/broto (admin-password gated). A client token must
    // never be able to read another tenant's tickets, so `all:true` is intentionally ignored here.
    const r = await svcRpc(env, "support_ticket_list", { p_secret: secret, p_email: email, p_limit: Math.min(Math.max(parseInt(b.limit, 10) || 200, 1), 1000) });
    if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/support.sql to activate support.", tickets: [] });
    const tickets = (await r.json()) || [];
    return json({ ok: true, ready: true, count: tickets.length, tickets });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
