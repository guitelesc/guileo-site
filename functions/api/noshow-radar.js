// Cloudflare Pages Function — POST /api/noshow-radar  (SUPERPOWER #3: predictive no-show radar)
// Ranks a tenant's upcoming appointments by no-show probability (0-100) so the owner — or a
// future pre-emptive automation — can over-confirm the risky ones BEFORE they ghost.
// Needs the noshow_risk RPC (db/noshow_predictor.sql); until pasted it returns a graceful note.
//   POST { token, email, days? }                                -> { ok, ready, count, highRisk, appointments:[...] }
//   POST { token, email, action:"mark_noshow", appointment_id } -> { ok, marked }   (biz_mark_noshow — feeds the model)
//   POST { token, email, action:"confirm", appointment_id? } -> { ok, sent, queued, via }  (appointment_id → one booking; absent → over-confirm every high-risk row. Branded email if the customer has one, else a queued 'confirm-nudge' the phone engine sends. Deduped per booking.)
import { json } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";
import { appointmentReminderEmail } from "../lib/emailTemplates.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isEmailAddr = (s) => /.+@.+\..+/.test((s || "").toString());
const langNorm = (v) => { const l = (v || "").toString().toLowerCase().slice(0, 2); return l === "pt" ? "pt" : l === "es" ? "es" : "en"; };

// Friendly UTC when-label for the branded reminder (we don't hold each tenant's timezone).
const _DOW = { en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], pt: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"], es: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] };
const _MON = { en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], pt: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"], es: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"] };
const fmtWhen = (iso, lang = "en") => {
  try { const d = new Date(iso); if (Number.isNaN(d.getTime())) return ""; const l = _DOW[lang] ? lang : "en";
    return `${_DOW[l][d.getUTCDay()]}, ${_MON[l][d.getUTCMonth()]} ${d.getUTCDate()} · ${d.toISOString().slice(11, 16)}`;
  } catch { return ""; }
};

// Send the CLIENT-branded confirmation to the customer's email (Resend). Never throws.
async function sendConfirmEmail(env, to, name, business, whenLabel, bizEmail, lang) {
  if (!env.RESEND_API_KEY || !isEmailAddr(to)) return false;
  try {
    const { subject, html } = appointmentReminderEmail({ name: name || "there", business: business || "", whenLabel: whenLabel || "", bizEmail: bizEmail || "", lang });
    // ⚠️ `await fetch(); return true;` — o fetch NÃO lança em erro HTTP. Este `return true` dizia
    // "lembrei" para um 4xx do Resend (domínio não verificado, endereço inválido, rate limit), e o
    // cockpit do CLIENTE estampava "Gui lembrou 3 clientes" com ZERO e-mail entregue. Pior: o claim
    // bloqueia o mesmo agendamento por 7 dias, então o lembrete que falhou nunca era tentado de novo.
    // Mentir para o dono sobre o trabalho feito é a única coisa que este produto não pode fazer:
    // ele existe para o dono confiar no que não viu acontecer.
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to, subject, html }),
    });
    return r.ok;
  } catch { return false; }
}

// ATOMIC per-appointment dedupe (risk_confirm_claim, db/risk_autoconfirm.sql): stamps risk_nudged_at
// and returns TRUE only when the booking hasn't been confirmed in the last 7 days. true = go ahead,
// false = already reminded (skip, no double-send), null = RPC not pasted yet → caller proceeds ungated.
async function claimConfirm(env, email, apptId) {
  try {
    const r = await fetch(`${SB}/rest/v1/rpc/risk_confirm_claim`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", p_email: email, p_appointment_id: apptId }),
    });
    if (!r.ok) return null;
    return (await r.json().catch(() => null)) === true;
  } catch { return null; }
}

// DESFAZ a marca do claim quando o envio falha — sem isto o agendamento fica bloqueado 7 dias
// tendo recebido nada. Escreve direto na coluna que o claim carimba (risk_nudged_at), pelo mesmo
// portão INGEST. Best-effort: se não der, o pior caso é o comportamento antigo, e o evento de
// falha que gravamos ao lado já conta a verdade para o dono.
async function soltarClaim(env, email, apptId) {
  try {
    await fetch(`${SB}/rest/v1/biz_appointments?id=eq.${encodeURIComponent(apptId)}&client_email=eq.${encodeURIComponent(email)}`, {
      method: "PATCH",
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ risk_nudged_at: null }),
    });
  } catch { /* nunca quebra a varredura */ }
}

// Log the action into the live feed (best-effort). kind:'confirm-nudge' on the phone path is what the
// autonomous confirm engine picks up; the email path logs a 'confirm' so the owner sees it went out.
async function logConfirm(env, email, summary, payload) {
  try {
    await fetch(`${SB}/rest/v1/rpc/ingest_client_event`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_secret: env.INGEST_SECRET || "", p_email: email,
        p_type: payload.kind === "confirm-sent" ? "confirm" : "message", p_channel: payload.via === "email" ? "email" : "Portal",
        p_summary: summary.slice(0, 300), p_amount: 0, p_payload: payload,
      }),
    });
  } catch { /* feed logging is best-effort — never fail the confirm on it */ }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    // PER-TENANT GATE — bind the cockpit email to its connection key (get_client_data rejects a
    // mismatch) so a token can't read another tenant's upcoming appointments / customer PII.
    // No OWNER_EMAIL fallback.
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);
    const days = Math.min(Math.max(parseInt(b.days, 10) || 7, 1), 30);
    const bizName = (gdj.business || gdj.business_name || "").toString().slice(0, 120);
    const bizLang = langNorm(gdj.lang || gdj.language);

    // ── ACTIONS (portal Risk Radar buttons) — same per-tenant gate as the read above. ──
    const action = (b.action || "").toString();
    if (action === "mark_noshow") {
      // 👻 "Faltou" — records the no-show via biz_mark_noshow (db/noshow_predictor.sql), which
      // both frees the history AND feeds the risk model. SCHED_SECRET stays server-side.
      const apptId = (b.appointment_id || "").toString().trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(apptId)) return json({ error: "bad appointment_id" }, 400);
      const mr = await fetch(`${SB}/rest/v1/rpc/biz_mark_noshow`, {
        method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_secret: env.SCHED_SECRET || "", p_email: email, p_appointment_id: apptId }),
      });
      if (!mr.ok) return json({ ok: false, marked: false, note: "Paste db/noshow_predictor.sql in Supabase to activate no-show marking." });
      const marked = await mr.json().catch(() => false);
      return json({ ok: true, marked: marked === true });
    }
    if (action === "confirm") {
      // ✅ "Confirmar extra" / "Over-confirm" — ACTUALLY reach the at-risk customer before they ghost.
      // Resolve the appointment(s) SERVER-SIDE from noshow_risk (never trust a client-supplied contact —
      // that would let a tenant email an arbitrary address). Then: branded confirmation email if we have
      // the customer's email, else queue a 'confirm-nudge' the autonomous confirm engine sends by phone.
      // appointment_id present → that one booking; absent → bulk over-confirm every high-risk (≥60) row.
      const apptId = (b.appointment_id || "").toString().trim();
      if (apptId && !UUID_RE.test(apptId)) return json({ error: "bad appointment_id" }, 400);

      const nsr = await svcRpc(env, "noshow_risk", { p_secret: env.SCHED_SECRET || "", p_email: email, p_days: days });
      if (!nsr.ok) {
        // RPC not present yet (SQL not pasted) → honest note, never a fake "sent".
        return json({ ok: true, ready: false, sent: 0, queued: 0, via: null, note: "Paste db/noshow_predictor.sql in Supabase to activate confirmations." });
      }
      const all = (await nsr.json().catch(() => [])) || [];
      const targets = (apptId
        ? all.filter((a) => (a.appointment_id || "") === apptId)
        : all.filter((a) => (Number(a.risk) || 0) >= 60)
      ).slice(0, 50); // safety cap on a bulk over-confirm

      let sent = 0, queued = 0, skipped = 0, via = null;
      for (const a of targets) {
        const aid = (a.appointment_id || "").toString();
        if (!UUID_RE.test(aid)) continue;
        const contact = (a.customer_contact || "").toString().trim();
        const who = (a.customer_name || "").toString().slice(0, 120) || "Customer";

        if (isEmailAddr(contact)) {
          // EMAIL PATH — send NOW, deduped by the atomic 7-day claim (email bookings are never touched
          // by the phone auto-confirm engine, so claiming here starves nothing).
          // ⚠️ A ORDEM: LER o claim (sem gravar) → ENVIAR → só então MARCAR. Antes o claim carimbava
          // ANTES do envio, então um envio que falhava saía bloqueado por 7 dias — o pior dos dois
          // mundos: não lembrou e não vai tentar de novo.
          const claimable = await claimConfirm(env, email, aid);
          if (claimable === false) { skipped++; continue; } // já lembrado nos últimos 7 dias
          const ok = await sendConfirmEmail(env, contact, who, bizName, fmtWhen(a.starts_at, bizLang), email, bizLang);
          if (!ok) {
            // Envio recusado: DESFAZ a marca para a próxima rodada tentar de novo, e deixa o motivo
            // visível. Falha silenciosa aqui vira no-show, e o dono culpa a IA sem saber por quê.
            await soltarClaim(env, email, aid);
            await logConfirm(env, email, `⚠️ NÃO consegui enviar a confirmação para ${who} — o provedor de e-mail recusou. Vou tentar de novo.`, { kind: "confirm-falhou", appointment_id: aid, via: "email" });
          }
          if (ok) {
            sent++; via = via || "email";
            await logConfirm(env, email, `✅ Gui sent an extra confirmation to ${who} (no-show risk ${Number(a.risk) || 0}%)`, { kind: "confirm-sent", appointment_id: aid, via: "email", risk: Number(a.risk) || 0 });
          } else {
            // Resend not configured / send failed → fall back to a queued nudge, honestly reported.
            queued++;
            await logConfirm(env, email, `Extra confirmation queued for ${who} (no-show radar)`, { kind: "confirm-nudge", appointment_id: aid, contact, via: "queued", risk: Number(a.risk) || 0 });
          }
        } else {
          // PHONE / UNKNOWN CONTACT — queue a 'confirm-nudge'; the autonomous confirm engine sends the
          // WhatsApp/SMS reminder (deduped by its OWN risk_confirm_claim), so we DON'T burn the claim here.
          queued++; via = via || "queued";
          await logConfirm(env, email, `Extra confirmation queued for ${who} (no-show radar)`, { kind: "confirm-nudge", appointment_id: aid, contact, via: "queued", risk: Number(a.risk) || 0 });
        }
      }
      // via reflects what actually happened: "email" if at least one branded email went out, else "queued".
      return json({ ok: true, ready: true, sent, queued, skipped, via: via || (targets.length ? "queued" : null) });
    }

    const r = await svcRpc(env, "noshow_risk", { p_secret: env.SCHED_SECRET || "", p_email: email, p_days: days });
    if (!r.ok) {
      // RPC not present yet (SQL not pasted) → graceful, honest note instead of a 500.
      return json({ ok: true, ready: false, note: "Paste db/noshow_predictor.sql in Supabase to activate the risk radar.", count: 0, highRisk: 0, appointments: [] });
    }
    const rows = (await r.json()) || [];
    const high = rows.filter((x) => (x.risk || 0) >= 60).length;
    return json({ ok: true, ready: true, count: rows.length, highRisk: high, appointments: rows.slice(0, 100) });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
