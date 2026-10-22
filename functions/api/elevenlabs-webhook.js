// Cloudflare Pages Function — POST /api/elevenlabs-webhook
// ElevenLabs post-call webhook → REAL client_events in the Guileo data layer.
// Configure in ElevenLabs (Conversational AI → Settings → Webhooks):
//   https://guileoai.com/api/elevenlabs-webhook?secret=ELEVEN_WEBHOOK_SECRET
// Each finished call lands as a `call` event (plus a `booking`/`sale` when the
// analysis detects one) for the client identified by dynamic_variables.client_email.
import { leituraDaLigacao } from "../lib/analiseDaLigacao.js";
import { json, safeEq } from "../lib/guard.js";
import { callAlertEmail, ownerAlertEmail } from "../lib/emailTemplates.js";
import { sbKey, svcRpc, svcJson } from "../lib/sb.js";

// Quanto vale uma ligação atendida. A tabela de planos fala em "~5 créditos por tarefa" — uma
// ligação atendida É a tarefa. Fica como constante nomeada e não como número solto no meio do
// código, para o dia em que o preço mudar não virar caça ao 5.
const CREDITOS_POR_LIGACAO = 5;
import { emitFailure } from "../lib/failure.js";
import { registrar } from "../lib/registro.js";

const isEmail = (s) => /.+@.+\..+/.test((s || "").toString());
const fmtDur = (s) => s == null ? "" : (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

// Scheduling/data project Luis OWNS — where the full call transcript + analysis lives so the
// portal can read it (the legacy data project above is on an account we can't administer).
const SCHED_SB = "https://ynihodbknhjirkdogxby.supabase.co";
const SCHED_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// Mirror the call (with full transcript) into the owned project's call_logs — best-effort.
async function logCall(env, row) {
  if (!env.SCHED_SECRET) return;
  try {
    await fetch(`${SCHED_SB}/rest/v1/rpc/log_call`, {
      method: "POST", headers: { apikey: SCHED_ANON, Authorization: `Bearer ${SCHED_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.SCHED_SECRET, ...row }),
    });
  } catch { /* never block the webhook on the mirror */ }
}

// #6 — humor + intenção + nota de cada ligação. Desde 2026-10-05 quem lê é a PRÓPRIA ElevenLabs, pelos
// campos de análise do agente (lib/analiseDaLigacao.js) — sem Anthropic (proibida pelo Luis; e sem saldo
// desde 03/10, quando toda ligação ficou sem humor e o alerta de cliente insatisfeita parou calado).
// Ligação real com conversa e SEM os campos = agente sem configuração: avisa (uma falha por ligação, que o
// painel agrupa), nunca inventa humor.
async function classifyCall(env, analysis, transcript, email, agentId, extra = null) {
  const r = leituraDaLigacao(analysis, extra);
  if (r) return r;
  if (transcript && transcript.length >= 20) {
    try {
      await emitFailure(env, "call_classify_failed", email || "",
        `A ligação chegou sem a leitura da ElevenLabs (humor/intenção): o agente ${agentId || "?"} está sem os campos de análise — reaplicar CAMPOS_DA_LIGACAO.`, { agent_id: agentId || null });
    } catch { /* nunca bloqueia o webhook */ }
  }
  return null;
}

// COST LEDGER (unit economics) — record what THIS call cost Guileo at the voice provider.
// Honest by design: we NEVER guess a rate. Only when the owner sets VOICE_COST_CENTS_PER_MIN
// (the real per-minute cost in cents) do we write a cost_event; otherwise unit-economics stays
// "parcial" instead of inventing a margin. Idempotent by (provider,ref=conversation_id) at the DB
// (cost_events unique index), so an ElevenLabs re-delivery can't double-charge. Best-effort.
async function recordVoiceCost(env, email, convId, durSecs) {
  const perMin = Number(env.VOICE_COST_CENTS_PER_MIN);
  if (!Number.isFinite(perMin) || perMin <= 0 || !durSecs || durSecs <= 0) return;
  const cents = Math.round((durSecs / 60) * perMin);
  if (cents <= 0) return;
  try {
    await rpc("record_cost_event", {
      p_secret: env.INGEST_SECRET || "", p_email: email, p_provider: "elevenlabs",
      p_kind: "voice_call", p_cost_cents: cents, p_ref: convId || null,
      p_meta: { duration_secs: Math.round(durSecs) },
    });
  } catch { /* cost telemetry never blocks the webhook */ }
}

async function ingest(env, email, type, channel, summary, amount, payload) {
  const r = await svcRpc(env, "ingest_client_event", {
    p_secret: env.INGEST_SECRET || "",
    p_email: email, p_type: type, p_channel: channel,
    p_summary: (summary || "").slice(0, 1200), p_amount: amount || 0,
    p_payload: payload || {},
  });
  return r.ok;
}

// Idempotency: TRUE = first time (process), FALSE = duplicate delivery (skip). Fail-open
// (process) when there's no id or the check errors — never drop a real call over a hiccup.
async function isFresh(env, provider, id) {
  if (!id) return true;
  try { const r = await rpc("mark_webhook_seen", { p_secret: env.INGEST_SECRET || "", p_provider: provider, p_event_id: id }); if (!r.ok) return true; return (await r.json()) === true; } catch { return true; }
}
// Reverse-map an agent_id → its client email (so a real client's call lands in THEIR portal).
async function clientByAgent(env, agentId) {
  if (!agentId) return "";
  try { const r = await rpc("client_by_agent", { p_secret: env.INGEST_SECRET || "", p_agent_id: agentId }); if (!r.ok) return ""; return ((await r.json()) || "").toString(); } catch { return ""; }
}

// De quem é esta conversa quando o agent_id não resolve — o carimbo do NOSSO servidor.
// `voice_web_owner` (db/voice_web.sql) só conhece conversation_id que passou por /api/voice-web,
// então não há como um navegador reivindicar a conversa de outro negócio: o índice único em
// `voice_web_sessions.conv_id` garante uma dona só. service_role, nunca a chave anônima.
async function voiceWebOwner(env, convId) {
  if (!convId) return "";
  try {
    const r = await svcRpc(env, "voice_web_owner", { p_secret: env.INGEST_SECRET || "", p_conv: convId });
    if (!r.ok) return "";
    return ((await r.json()) || "").toString();
  } catch { return ""; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // shared-secret gate (header or query) — reject everything if not configured
    const provided = request.headers.get("x-guileo-secret") || new URL(request.url).searchParams.get("secret") || "";
    if (!env.ELEVEN_WEBHOOK_SECRET || !safeEq(provided, env.ELEVEN_WEBHOOK_SECRET)) {
      return json({ error: "unauthorized" }, 401);
    }

    const body = await request.json();
    const d = body.data || body;
    const vars = d?.conversation_initiation_client_data?.dynamic_variables || {};
    const convId = (d?.conversation_id || "").toString();
    const agentId = (d?.agent_id || "").toString();

    // Idempotency — ElevenLabs can re-deliver the same call; only record it once.
    if (!(await isFresh(env, "elevenlabs", convId))) return json({ ok: true, duplicate: true });

    // ── DE QUEM É ESTA CONVERSA — ORDEM INVERTIDA EM 2026-08-11 ────────────────────────────────
    // A ordem era: `vars.client_email` (dito por quem abriu a conversa) → agent_id → dono.
    // Isso era seguro enquanto TODA conversa nascia no nosso servidor (Twilio, nossa discagem).
    // Com a voz no navegador, `dynamic_variables` passou a ser digitado pelo VISITANTE: quem tem
    // a URL assinada abre a conversa declarando `client_email` de outro negócio, e o custo de voz,
    // a transcrição e o contato caem na conta da vítima. A linha não mudou — o mundo em volta dela
    // mudou, que é a classe de defeito mais difícil de ver num diff.
    //
    // Agora manda quem NÃO é forjável, nesta ordem:
    //   1) agent_id — vem da URL assinada, escopada a UM agente pelo nosso servidor;
    //   2) voice_web_owner — o conversation_id que o NOSSO servidor carimbou ao abrir a sessão;
    //   3) vars.client_email — só quando nenhum dos dois resolve (ligação telefônica antiga);
    //   4) dono da plataforma, último recurso.
    let email = await clientByAgent(env, agentId);
    if (!email) email = await voiceWebOwner(env, convId);
    if (!email) email = (vars.client_email || "").toString().trim();
    if (!email) email = (env.OWNER_EMAIL || "smart@guileoai.com").toString();

    // O resumo no idioma de quem ligou (campo "resumo" da análise) vem antes do resumo padrão, que é sempre em inglês.
    const summary = leituraDaLigacao(d?.analysis)?.resumo || d?.analysis?.transcript_summary || d?.analysis?.call_summary_title || "AI call completed";
    const ok = d?.analysis?.call_successful;
    const dur = d?.metadata?.call_duration_secs;

    // ── TEXTO PELO AGENTE NÃO É LIGAÇÃO (2026-09-09) ────────────────────────────────────────────
    // Com o agente de voz virando o cérebro PRINCIPAL do texto (widget, WhatsApp, SMS), toda
    // mensagem de chat passou a chegar aqui pelo mesmo webhook de fim-de-conversa — e este arquivo
    // só conhecia ligação: gravava `call`, cobrava CREDITOS_POR_LIGACAO, abria contato de CRM com
    // "quem ligou" e somava no custo de voz. Provado em produção no mesmo dia: 6 mensagens de teste
    // viraram 6 "ligações" no feed do Natura — e teriam zerado o "silencioso há 12 dias" como se
    // um cliente tivesse ligado. Medir a si mesmo, de novo.
    // A marca vem do NOSSO servidor: `pelaVozDoCliente()` abre a conversa com `canal:"texto"`.
    // Segunda pista, não forjável: chat não tem `metadata.phone_call` nem duração de áudio.
    const ehTexto = String(vars.canal || "") === "texto" || (!d?.metadata?.phone_call && !dur);

    // #6 — classify sentiment + intent from the transcript (best-effort; never blocks the event)
    const tx = Array.isArray(d?.transcript)
      ? d.transcript.map((t) => `${t.role === "agent" ? "Gui" : "Customer"}: ${(t.message || "").trim()}`).filter((x) => x.length > 5).join("\n")
      : "";
    const cls = ehTexto ? leituraDaLigacao(d?.analysis, d) : await classifyCall(env, d?.analysis, tx, email, agentId, d);
    const mood = cls ? ({ positive: "😊", neutral: "😐", negative: "😞" }[cls.sentiment] || "") : "";

    // Compact, bounded transcript for the portal drawer: last 60 turns, role + text only.
    // Bounded so the JSONB payload stays small no matter how long the call ran.
    const turns = Array.isArray(d?.transcript)
      ? d.transcript
          .filter((t) => (t?.message || "").trim().length > 0)
          .slice(-60)
          .map((t) => ({ r: t.role === "agent" ? "gui" : "cust", t: (t.message || "").trim().slice(0, 280) }))
      : [];
    // why the call ended (e.g. "Client disconnected: 1000", or a quota/error reason) — the
    // honest operational signal behind "a ligação caiu".
    const endReason = d?.metadata?.termination_reason || d?.metadata?.end_reason || null;

    // ── ALARME DE VOZ BLOQUEADA (2026-08-21) ──────────────────────────────────────────────────
    // Em 21/08 a linha da Natura ficou 7 ligações no ar SEM ATENDER: cada chamada morria em 1
    // segundo com "This request cannot be processed due to a payment issue" — a ElevenLabs
    // recusando gerar voz. Nada no nosso lado estava quebrado: Twilio entregou, o número estava
    // amarrado, o agente existia, o webhook gravou tudo. A plataforma funcionou perfeitamente
    // para registrar o próprio fracasso, e ninguém foi avisado. O Luis descobriu TENTANDO LIGAR.
    //
    // 🚨 ISTO É FALHA DE PLATAFORMA, NÃO DE CLIENTE. Um cliente sem crédito é assunto dele; a
    // conta de voz bloqueada derruba TODOS os agentes ao mesmo tempo — e cada minuto disso é um
    // cliente do cliente ouvindo silêncio e desligando.
    const BLOQUEIO_DE_PLATAFORMA = /payment|billing|quota|insufficient|subscription|suspend/i;
    if (endReason && BLOQUEIO_DE_PLATAFORMA.test(endReason)) {
      try {
        // uma vez por hora, decidido pelo BANCO: sete webhooks chegam em paralelo e um
        // "já avisei?" lido em JavaScript diria "não" nas sete vezes ao mesmo tempo.
        const pode = await svcJson(env, "alarme_uma_vez", {
          p_secret: env.INGEST_SECRET || "", p_chave: "voz_bloqueada", p_minutos: 60,
        }).catch(() => false);
        if (pode === true) {
          await emitFailure(env, "voz_bloqueada", email || "",
            `A ElevenLabs recusou a chamada: "${String(endReason).slice(0, 120)}" — TODOS os agentes estão mudos até o pagamento ser regularizado`,
            { end_reason: endReason, agent_id: agentId }).catch(() => {});
          if (env.RESEND_API_KEY) {
            const dono = (env.OWNER_EMAIL || "smart@guileoai.com").toString().split(",")[0].trim();
            const tpl = ownerAlertEmail({
              kind: "alert", business: "Guileo · plataforma de voz", customer: email || "",
              details: `A ElevenLabs recusou a chamada com "${String(endReason).slice(0, 140)}". Enquanto isso durar, TODA ligação para qualquer agente é atendida e cai em 1 segundo. Regularize o pagamento em elevenlabs.io → Billing.`,
              when: new Date().toISOString(), lang: "pt",
            });
            const mr = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [dono], subject: "🚨 A voz está bloqueada — nenhum agente está atendendo", html: tpl.html }),
            });
            // o alarme também precisa de comprovante: se o e-mail não sai, isso vira uma falha.
            if (!mr.ok) await emitFailure(env, "alarme_nao_enviado", "", `o alarme de voz bloqueada NÃO saiu por e-mail (HTTP ${mr.status})`, {}).catch(() => {});
          }
        }
      } catch { /* o alarme nunca pode derrubar a ingestão da ligação */ }
    }

    // Chat: o widget/canal JÁ gravou o evento do visitante ("💬 Webchat lead…") — e `ingest_client_event`
    // cobra 2 créditos por `message`. Gravar o resumo do agente aqui como segundo `message` dobrava o
    // custo de cada turno (provado: −4 por pergunta). Então o chat NÃO grava nada aqui: fim de conversa
    // de texto é só confirmação, nunca evento nem cobrança. O resumo vai na resposta do webhook (log).
    if (ehTexto) {
      return json({ ok: true, chat: true, conversation_id: convId, email, resumo: (summary || "").slice(0, 200),
        note: "texto pelo agente: sem evento, sem crédito de ligação, sem custo de voz — o canal já registrou o lead" });
    }
    await ingest(env, email, "call", "voice",
      `${mood ? mood + " " : ""}${summary}${dur ? ` · ${Math.round(dur)}s` : ""}${ok === "success" ? " ✓" : ""}`,
      0, {
        conversation_id: convId, agent_id: agentId,
        sentiment: cls?.sentiment || null, intent: cls?.intent || null, note: cls?.note || null,
        duration_secs: dur ? Math.round(dur) : null, success: ok || null, end_reason: endReason,
        summary_clean: (summary || "").slice(0, 1200), transcript: turns,
      });

    // COST LEDGER — record the voice-provider cost of this call (only if the rate env is set).
    await recordVoiceCost(env, email, convId, dur);

    // ═══ MEDIDOR DE CRÉDITO — decisão do Luis (2026-08-20) ═══════════════════════════════════
    // Até hoje NENHUMA ligação debitava crédito: `call.js` e este webhook não mediam nada, então o
    // saldo do cockpit e todo o ROI eram ficção — o cliente via 1.715 créditos que nunca desciam.
    //
    // 🚨 A LEI: ISTO MEDE, NUNCA BLOQUEIA. Se o medidor falhar, a ligação JÁ ACONTECEU e o evento
    // JÁ foi gravado — engolir a ligação por causa de contabilidade seria trocar o produto pela
    // planilha. Por isso vem DEPOIS do `ingest` e é `try/catch` que só registra.
    // O Luis decidiu: saldo pode ficar NEGATIVO e a agente continua atendendo. Telefone mudo mata a
    // conta do cliente; saldo negativo se cobra depois.
    // A referência é o `conversation_id`: reentrega do webhook não cobra duas vezes.
    try {
      const cr = await svcRpc(env, "consumir_creditos", {
        p_secret: env.INGEST_SECRET || "", p_email: email,
        p_credits: CREDITOS_POR_LIGACAO, p_kind: "call", p_ref: convId,
      });
      const cd = cr.ok ? await cr.json().catch(() => null) : null;
      // `cruzou_zero` é true SÓ na transição — o aviso sai uma vez, não a cada ligação.
      if (cd && cd.cruzou_zero) {
        await emitFailure(env, "credito_zerado", email,
          `Créditos de ${email} chegaram a ${cd.saldo}. A agente CONTINUA atendendo (decisão do Luis) — cobre a recarga.`,
          { saldo: cd.saldo, antes: cd.antes, conversation_id: convId });
      } else if (!cd || cd.ok !== true) {
        // Medição falhou: a ligação vale, o registro do consumo não. Declara, não inventa.
        await emitFailure(env, "credito_nao_medido", email,
          `Não consegui debitar o crédito da ligação ${convId}: ${cd?.motivo || `HTTP ${cr.status}`}`, { conversation_id: convId });
      }
    } catch (e) {
      await emitFailure(env, "credito_nao_medido", email, `Falha ao medir crédito de ${convId}: ${String(e).slice(0, 140)}`, {}).catch(() => {});
    }

    // Mirror into the owned project so the portal can show the analysis + full transcript.
    await logCall(env, {
      p_email: email, p_conv: convId, p_summary: (summary || "").slice(0, 1200),
      p_sentiment: cls?.sentiment || null, p_intent: cls?.intent || null, p_note: cls?.note || null,
      p_duration: dur ? Math.round(dur) : null, p_success: ok || null, p_end_reason: endReason,
      p_amount: 0, p_transcript: turns,
    });

    // COMPANY OS — stitch the answered call into the caller's 360° contact timeline (best-effort).
    let cxContactId = null;
    if (env.SCHED_SECRET) {
      const caller = (vars.system__caller_id || vars.caller_id || vars.from || d?.metadata?.phone_call?.external_number || "").toString().trim();

      // DE QUAL ANÚNCIO VEIO ESTA LIGAÇÃO. O motor de anúncios media o lead de FORMULÁRIO e era
      // cego para o de TELEFONE — justamente o caminho principal de um negócio local, e o que a
      // Guileo tem de diferente. Quando a linha discada pertence a uma campanha (db/ads_engine),
      // quem ligou é creditado a ela sem cookie, sem formulário, sem nada no navegador.
      // `agent_number` é o campo real, confirmado numa ligação de verdade em 2026-08-09.
      // Best-effort: perder a atribuição é ruim, perder o registro da LIGAÇÃO seria muito pior.
      try {
        const discado = (d?.metadata?.phone_call?.agent_number || "").toString().trim();
        if (discado && caller) {
          await svcRpc(env, "ads_attr_from_call", {
            p_secret: env.INGEST_SECRET || "", p_email: email,
            p_numero_discado: discado, p_quem_ligou: caller,
          });
        }
      } catch { /* atribuição é bônus — nunca derruba o registro da ligação */ }

      if (caller) {
        try {
          const crmRpc = (fn, body) => fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_secret: env.SCHED_SECRET, ...body }) });
          const ur = await crmRpc("crm_upsert_contact", { p_email: email, p_phone: caller, p_contact_email: "", p_name: (vars.caller_name || vars.customer_name || "").toString().slice(0, 80), p_source: "voice", p_amount_cents: 0 });
          const contactId = ur.ok ? await ur.json() : null;
          if (contactId) {
            cxContactId = contactId;
            await crmRpc("crm_log_event", { p_email: email, p_contact_id: contactId, p_type: "call", p_channel: "Voice", p_summary: `${mood ? mood + " " : ""}${summary}${dur ? ` · ${Math.round(dur)}s` : ""}`.slice(0, 400), p_amount_cents: 0, p_dedupe: `call:${convId}`, p_payload: { sentiment: cls?.sentiment || null, intent: cls?.intent || null } }).catch(() => {});
          }
        } catch { /* never block the webhook */ }
      }
    }

    // REGISTRO (2026-09-28) — a ligação sai da plataforma pra onde o dono olha (planilha/ClickUp).
    // Em segundo plano: a ElevenLabs não espera a planilha, e uma planilha lenta nunca derruba o log.
    if (isEmail(email)) {
      const quem = (vars.system__caller_id || vars.caller_id || vars.from || d?.metadata?.phone_call?.external_number || "").toString().trim();
      const tarefa = registrar(env, { cliente: email, tipo: ehTexto ? "conversa_texto" : "ligacao", nome: (vars.caller_name || vars.customer_name || "").toString(),
        telefone: quem, duracao_s: dur, sentimento: cls?.sentiment || "", resumo: `${summary}${cls?.intent ? ` [${cls.intent}]` : ""}`, canal: ehTexto ? "texto" : "voz", ref: `call:${convId}`, conversation_id: convId,
        agente: (d?.agent_name || vars.agent_name || "Agent").toString(),
        transcricao: (Array.isArray(d?.transcript) ? d.transcript : []).filter((t) => (t?.message || "").trim())
          .map((t) => `${t.role === "agent" ? "Agent" : "Caller"}: ${(t.message || "").trim()}`).join("\n") });
      if (context && typeof context.waitUntil === "function") context.waitUntil(tarefa); else await tarefa;
    }

    // XM (experience) — unify this call's sentiment into cx_signals, so the client's Experience tab
    // measures how THEIR customers feel from what already happens. Idempotent on ref='call:<convId>'.
    if (isEmail(email) && cls?.sentiment) {
      const cxScore = cls.sentiment === "positive" ? 90 : cls.sentiment === "negative" ? 20 : 60;
      await rpc("cx_signal_upsert", {
        p_secret: env.INGEST_SECRET || "", p_email: email, p_contact_id: cxContactId, p_source: "call",
        p_score: cxScore, p_raw_score: cls.sentiment, p_sentiment: cls.sentiment,
        p_theme: cls?.intent ? cls.intent.slice(0, 40) : null,
        p_comment: (cls?.note || summary || "").slice(0, 500), p_ref: `call:${convId}`,
        p_occurred_at: new Date().toISOString(),
      }).catch(() => {});
    }

    // #1 — UNHAPPY-CALL ALERT: a negative call → email the business owner immediately so they
    // can win the customer back. Best-effort, never blocks the webhook. Email only (TCPA-safe).
    if (cls?.sentiment === "negative" && env.RESEND_API_KEY && isEmail(email)) {
      try {
        const lang = (vars.lang || "en").toString().toLowerCase().startsWith("pt") ? "pt" : (vars.lang || "").toString().toLowerCase().startsWith("es") ? "es" : "en";
        const { subject, html } = callAlertEmail({
          name: (vars.business_name || email.split("@")[0]), business: (vars.business_name || ""), lang,
          intent: cls?.intent || "", note: cls?.note || "", durationLabel: fmtDur(dur ? Math.round(dur) : null), transcript: turns,
        });
        await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: email, subject, html }),
        });
      } catch { /* alert is best-effort */ }
    }

    // if the analysis captured a booking/sale via data-collection fields, record it too
    const dc = d?.analysis?.data_collection_results || {};
    const booked = dc.booking || dc.appointment || null;
    if (booked && (booked.value || booked) !== "none") {
      await ingest(env, email, "booking", "voice", `Booked via AI call · ${String(booked.value || booked).slice(0, 120)}`, 0, {});
    }

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 120) }, 400);
  }
}
