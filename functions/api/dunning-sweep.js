// Cloudflare Pages Function — GET/POST /api/dunning-sweep?token=DIGEST_TOKEN
// GRACE-PERIOD ENFORCER — closes the "deadbeat forever" leak. Today a client whose
// card fails keeps their Gui + phone number + monthly cost indefinitely: the Stripe
// webhook deliberately never touches provisioning ("grace is a business decision for
// Luis"). This sweep is that decision, made repeatable and deduped.
//
// Two stages, driven purely by how many days a tenant has been past-due
// (dunning_candidates computes days_overdue from the first UNRESOLVED failure — it
// resets to nothing the instant they pay):
//   • stage 1  (>= GRACE_DAYS):      one branded "last-call" reminder to the CLIENT
//                                    via dunningEmail (emailTemplates.js — never ad-hoc).
//   • stage 2  (>= GRACE_DAYS * 2):  PAUSE. There is NO automated teardown API in this
//                                    codebase (offboard.js never cancels; the webhook
//                                    never unbinds a number) — so, honestly, "pause"
//                                    here = a LOUD ops_alert in the client feed + an
//                                    emitFailure to the owner ("⏸️ pausado por
//                                    inadimplência") telling Luis to cancel in Stripe /
//                                    unbind the number. We do NOT fake a technical
//                                    switch-off that doesn't exist.
//
// SAFETY:
//   • DRY-RUN BY DEFAULT — with dunning_enforce !== "1" the sweep only REPORTS what it
//     WOULD do (no email, no ops_alert, no claim burned). O valor vem do BANCO
//     (platform_settings, editável em /admin → "⚙️ Regras de cobrança") e cai na env
//     DUNNING_ENFORCE quando a tabela não existe. Ver lerSettings() abaixo.
//   • PAUSAR UM CLIENTE À MÃO é outro caminho, de propósito: /api/admin-comando
//     {action:"pause_client"} (botão na lista de vencidos do /admin). Este interruptor
//     aqui liga a pausa para TODOS; cortar um cliente é decisão comercial, um a um.
//   • Idempotent — a 7-day atomic claim per (email, kind) is taken BEFORE acting, so the
//     15-min cron never spams or double-pauses. Claim is only taken when enforcing.
//   • Cap 10 tenants/run (oldest-delinquent first) — bounded subrequests.
//   • Token-gated (DIGEST_TOKEN + safeEq), same as the other cron sweeps.
import { json, safeEq } from "../lib/guard.js";
import { emitFailure } from "../lib/failure.js";
import { dunningEmail } from "../lib/emailTemplates.js";
import { sbKey } from "../lib/sb.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const MAX_PER_RUN = 10; // subrequest budget: ~2–3 RPCs + maybe 1 email per tenant

// INGEST-gated RPC helper (same shape health-monitor / automations use). null on any error.
async function rpc(env, fn, args) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", ...args }),
    });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

// ── A REGRA VEM DO BANCO PRIMEIRO, DA ENV DEPOIS (2026-08-25) ─────────────────────────────────
// GRACE_DAYS e DUNNING_ENFORCE são decisões de NEGÓCIO ("quantos dias de tolerância eu dou antes
// de pausar") e estavam presas como env var no Cloudflare: mudar exigia acesso ao painel e só
// valia no PRÓXIMO deploy (feedback_secret_exige_redeploy). Agora o dono edita em
// /admin → "⚙️ Regras de cobrança" e vale no ciclo seguinte do cron.
// ⚠️ A ENV CONTINUA VALENDO COMO FALLBACK, de propósito: enquanto db/platform_settings.sql não
// estiver colado, a tabela não existe, `platform_settings_get` degrada para {} e a cobrança segue
// com a regra atual. Nenhuma janela sem regra — a paste liga, não troca.
async function lerSettings(env) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/platform_settings_get`, {
      method: "POST",
      headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.INGEST_SECRET || "" }),
    });
    if (!r.ok) return {};                       // SQL não colado / indisponível → env manda
    const d = await r.json().catch(() => null);
    return (d && typeof d === "object" && !Array.isArray(d)) ? d : {};
  } catch { return {}; }
}

async function sweep(env) {
  const cfg = await lerSettings(env);
  const grace = Math.max(1, parseInt(cfg.grace_days ?? env.GRACE_DAYS, 10) || 10);
  const grace2 = grace * 2;
  const enforce = String(cfg.dunning_enforce ?? env.DUNNING_ENFORCE ?? "") === "1";
  // `fonte` aparece na resposta do cron: saber SE a regra veio do banco ou da env é o que evita o
  // próximo "mudei e não mudou nada" (a env sem redeploy).
  const fonte = {
    grace: cfg.grace_days != null ? "banco" : "env",
    enforce: cfg.dunning_enforce != null ? "banco" : "env",
  };
  const out = { ready: true, enforce, grace, fonte, candidatesReady: true, claimReady: true, actions: [] };

  const candidates = await rpc(env, "dunning_candidates", { p_grace_days: grace });
  if (!Array.isArray(candidates)) { out.ready = false; out.candidatesReady = false; return out; } // db/dunning_grace.sql not pasted

  for (const c of candidates.slice(0, MAX_PER_RUN)) {
    const email = ((c && c.client_email) || "").toString().trim().toLowerCase();
    if (!email.includes("@")) continue;
    const days = Math.max(0, parseInt(c.days_overdue, 10) || 0);
    const business = (c.business_name || email).toString();
    const amount = (c.last_amount || "").toString();
    const stage = days >= grace2 ? "pause" : "email";
    const kind = stage === "pause" ? "dunning_pause" : "dunning_email";
    const rec = { email, days, stage, business, acted: false };

    if (!enforce) { rec.wouldDo = stage === "pause" ? "⏸️ pause (ops_alert + owner failure)" : "✉️ last-call email"; out.actions.push(rec); continue; }

    // ATOMIC 7-day claim BEFORE acting — true = we own it, false = already done this week, null = SQL not pasted.
    const claimed = await rpc(env, "dunning_claim", { p_email: email, p_kind: kind });
    if (claimed === null) { out.claimReady = false; out.actions.push(rec); continue; }
    if (claimed !== true) { rec.skipped = "already actioned this week"; out.actions.push(rec); continue; }

    if (stage === "email") {
      // STAGE 1 — branded last-call reminder to the CLIENT (concierge tone, CTA → Billing tab).
      // Best-effort profile for owner name + language; falls back to business/en.
      let name = "there", lang = "en";
      try {
        const p = await rpc(env, "get_client_profile", { p_email: email });
        if (p && typeof p === "object") {
          name = (p.owner_name || p.owner || p.contact_name || name).toString().split(" ")[0] || name;
          lang = (p.lang || p.language || lang).toString().slice(0, 2) || lang;
        }
      } catch { /* profile is best-effort — email still sends with fallbacks */ }
      let emailed = false;
      if (env.RESEND_API_KEY) {
        const tpl = dunningEmail({ name, business, amountLabel: amount, lang });
        const sr = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [email], subject: tpl.subject, html: tpl.html }),
        }).catch(() => null);
        emailed = !!(sr && sr.ok);
      } else rec.note = "no RESEND_API_KEY — email skipped";
      rec.acted = emailed;
      if (!emailed) await emitFailure(env, "dunning_email_failed", email, `stage-1 dunning email did not send (${days}d overdue) — claim already burned`, { days });
    } else {
      // STAGE 2 — PAUSE (real, reversible). Now actually flips the tenant's `paused` flag so Gui
      // STOPS taking money/booking actions for the deadbeat (agent-action.js gate) — automatically
      // un-paused by the next successful payment (stripe/mp webhooks). Still LOUD too:
      // (a) set_client_paused(true), (b) ops_alert in the client feed, (c) emitFailure to the owner.
      // NOTE: inbound voice keeps answering (no ElevenLabs teardown API) but can no longer ACT;
      //       full teardown (cancel in Stripe / unbind number) remains a manual owner step.
      const pausedRes = await rpc(env, "set_client_paused", { p_email: email, p_paused: true, p_reason: `past_due_${days}d` });
      rec.paused_flag = pausedRes && pausedRes.paused === true;
      const summary = `⏸️ Pausado por inadimplência — ${days}d sem pagamento${amount ? ` (${amount})` : ""}. Gui não age mais (reativa no próximo pagamento). Cancelar no Stripe / desvincular número se for definitivo.`;
      const ir = await rpc(env, "ingest_client_event", {
        p_email: email, p_type: "ops_alert", p_channel: "system",
        p_summary: summary.slice(0, 300), p_amount: 0,
        p_payload: { kind: "dunning_pause", days, amount, note: "no automated teardown — manual cancel/unbind" },
      });
      await emitFailure(env, "dunning_paused", email, `⏸️ ${business} pausado por inadimplência (${days}d) — cancelar assinatura no Stripe e desvincular o número`, { days, amount });
      rec.acted = ir !== null;
    }
    out.actions.push(rec);
  }
  return out;
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    const tok = new URL(request.url).searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
    if (!env.DIGEST_TOKEN || !safeEq(tok, env.DIGEST_TOKEN)) return json({ error: "unauthorized" }, 401);
    const result = await sweep(env);
    return json({ ok: true, ...result });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 140) }, 500);
  }
}
