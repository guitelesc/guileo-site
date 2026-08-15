// Cloudflare Pages Function — POST /api/elevenlabs-webhook
// ElevenLabs post-call webhook → REAL client_events in the Guileo data layer.
// Configure in ElevenLabs (Conversational AI → Settings → Webhooks):
//   https://guileoai.com/api/elevenlabs-webhook?secret=ELEVEN_WEBHOOK_SECRET
// Each finished call lands as a `call` event (plus a `booking`/`sale` when the
// analysis detects one) for the client identified by dynamic_variables.client_email.
import { json, safeEq } from "../lib/guard.js";
import { callAlertEmail } from "../lib/emailTemplates.js";
import { sbKey, svcRpc } from "../lib/sb.js";
import { emitFailure } from "../lib/failure.js";

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

// #6 — per-call sentiment + intent. Classifies the transcript with Claude Haiku (fast/cheap).
// Turns every call into tone/intent data (the substrate for the Business Brain, H3).
// CADEIA de modelos, não um só. A versão anterior chamava `claude-fable-5` e, em QUALQUER
// falha (modelo indisponível pra chave, 429, erro de rede), devolvia null calado — foi por
// isso que a 1ª ligação real da Natura ficou com sentiment/intent NULL e o painel do dono
// não tinha leitura nenhuma da conversa. Agora tenta a cadeia e, se TODOS falharem, grita.
const CLASSIFY_CHAIN = ["claude-fable-5", "claude-sonnet-5", "claude-haiku-4-5-20251001"];
async function classifyCall(env, transcript, email) {
  if (!env.ANTHROPIC_API_KEY || !transcript || transcript.length < 20) return null;
  let lastStatus = 0, lastDetail = "";
  for (const model of CLASSIFY_CHAIN) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model, max_tokens: 150,
          messages: [{ role: "user", content: `Classify this phone call. Reply ONLY compact JSON, no prose: {"sentiment":"positive|neutral|negative","intent":"2-4 words","note":"one short line"}\n\nTRANSCRIPT:\n${transcript.slice(0, 6000)}` }],
        }),
      });
      if (r.ok) {
        const j = await r.json();
        const m = (j?.content?.[0]?.text || "").match(/\{[\s\S]*\}/);
        if (m) { try { return JSON.parse(m[0]); } catch { /* tenta o próximo modelo */ } }
        lastStatus = 200; lastDetail = "resposta sem JSON";
      } else {
        lastStatus = r.status; lastDetail = (await r.text().catch(() => "")).slice(0, 160);
        if (r.status === 401 || r.status === 402) break; // chave/saldo: outro modelo não resolve
      }
    } catch (e) { lastStatus = 0; lastDetail = String(e).slice(0, 120); }
  }
  // Falha TOTAL: sem isto o dono simplesmente não vê o humor das ligações e ninguém percebe.
  try {
    await emitFailure(env, "call_classify_failed", email || "",
      `Não consegui classificar a ligação (${lastStatus}): ${lastDetail}`, { status: lastStatus });
  } catch { /* nunca bloqueia o webhook */ }
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

    const summary = d?.analysis?.transcript_summary || d?.analysis?.call_summary_title || "AI call completed";
    const ok = d?.analysis?.call_successful;
    const dur = d?.metadata?.call_duration_secs;

    // #6 — classify sentiment + intent from the transcript (best-effort; never blocks the event)
    const tx = Array.isArray(d?.transcript)
      ? d.transcript.map((t) => `${t.role === "agent" ? "Gui" : "Customer"}: ${(t.message || "").trim()}`).filter((x) => x.length > 5).join("\n")
      : "";
    const cls = await classifyCall(env, tx, email);
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
