// Cloudflare Pages Function — POST /api/growth-intel  (GROWTH INTELLIGENCE cockpit)
// Per-tenant cockpit reader for the "Inteligência" tab: LTV, lead-source attribution,
// 7-day forecast, and the abandoned-booking recovery queue.
//   POST { token, email, action:"ltv" }       -> { ok, ready, ltv:{...} }
//   POST { token, email, action:"sources", days? } -> { ok, ready, sources:[...] }
//   POST { token, email, action:"forecast" }  -> { ok, ready, forecast:{...} }
//   POST { token, email, action:"abandoned", older_min? } -> { ok, ready, count, intents:[...] }
//   POST { token, email, action:"recover", intent_id, name?, contact? } -> { ok, claimed }
//   POST { token, email, action:"money_proof" } -> { ok, ready, month, since, proof:{...}, real:{...} }
// Reads via growth_intel.sql RPCs (INGEST-gated server-side). Same proven per-tenant
// gate call-logs/crm/noshow-radar use: get_client_data binds email↔connection-key and
// returns null on a mismatch, so one tenant's key can NEVER read another tenant's data.
// No OWNER_EMAIL fallback. Falha de RPC → { ok:false, ready:false, note, error, erro,
// detalhe_tecnico } em HTTP 200 (as telas descartam corpo de resposta não-2xx; ver `fora`).
import { json } from "../lib/guard.js";
import { winbackCustomerEmail } from "../lib/emailTemplates.js";
import { sbKey, svcJson } from "../lib/sb.js";
import { brandFor } from "../lib/clientBrand.js";
import { unsubUrl } from "../lib/unsub.js";

const isEmailAddr = (s) => /.+@.+\..+/.test((s || "").toString());
// After-hours heuristic on a captured event timestamp: a call landing before 08:00, at/after
// 18:00, or on a weekend (UTC). This is an APPROXIMATION (we don't hold the tenant's timezone/
// business-hours) → the figures it feeds are always labeled as an estimate, never as cash.
const isAfterHours = (iso) => { try { const d = new Date(iso); const h = d.getUTCHours(); const wd = d.getUTCDay(); return wd === 0 || wd === 6 || h < 8 || h >= 18; } catch { return false; } };
// WIN-BACK 1-CLIQUE — três defeitos corrigidos de uma vez (auditoria A4, 2026-08-11):
//  (a) mandava `reengageEmail`, que é a PEÇA DE VENDA DA GUILEO ("your AI Growth Score awaits you",
//      CTA pro quiz do guileoai.com). O destinatário aqui é o CLIENTE DO CLIENTE — uma pessoa que
//      fez uma massagem, não um dono de negócio. Agora vai winbackCustomerEmail, na marca do cliente.
//  (b) devolvia `true` sem olhar a resposta do Resend → o cockpit escrevia "Gui reativou por email"
//      e gravava o client_event de winback mesmo quando o envio falhou. Agora só com 2xx.
//  (c) idioma fixo "en" e sem supressão: quem pediu descadastro voltava a receber por este botão.
async function sendReengageEmail(env, tenant, to, name) {
  if (!env.RESEND_API_KEY || !isEmailAddr(to)) return false;
  const alvo = String(to).trim().toLowerCase();
  try {
    // SUPRESSÃO fail-closed: sem lista confirmada, não mandamos.
    const sup = await svcJson(env, "email_suppressed_list", { p_secret: env.INGEST_SECRET || "", p_client_email: tenant });
    if (!Array.isArray(sup)) return false;
    if (sup.map((x) => String(x).toLowerCase()).includes(alvo)) return false;

    const brand = await brandFor(env, tenant).catch(() => null);
    let address = "";
    try { const a = await svcJson(env, "client_postal_address", { p_secret: env.INGEST_SECRET || "", p_client_email: tenant }); if (typeof a === "string" && a.trim()) address = a.trim().slice(0, 200); } catch { /* sem endereço */ }
    const unsub = await unsubUrl(env, "https://guileoai.com", tenant, alvo).catch(() => "");
    const lang = (brand && brand.lang) || "en";
    const { subject, html } = winbackCustomerEmail({ name: name || "there", business: (brand && brand.business) || "", lang, bizEmail: tenant, brand, unsub, address });
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to, subject, html,
        headers: unsub ? { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined,
      }),
    });
    return r.ok;
  } catch { return false; }
}

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);

    // PER-TENANT GATE
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    const secret = env.INGEST_SECRET || "";
    const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
      method: "POST", headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // 🚨 "PASTE db/growth_intel.sql" ERA MENTIRA E ERA PARA O CLIENTE (incidente 2026-09-28).
    // As RPCs EXISTEM. O que falhava era o NOME DO PARÂMETRO: este arquivo mandava `p_email` e
    // crm_lead_sources / crm_forecast / booking_intents_abandoned / intent_recovery_claim recebem
    // `p_client_email` (conferido no pg_proc). O PostgREST devolvia 404 "function not found", a
    // rota traduzia qualquer falha em "cole o SQL" com ok:true, e o dono do spa lia uma instrução
    // de engenharia na aba Inteligência. Agora: frase segura no idioma da tela, `ok:false`, e o
    // motivo real em `detalhe_tecnico`.
    // HTTP 200 DE PROPÓSITO: GrowthIntel/Followups/Overview fazem `if (!r.ok) return null` — um
    // 503 aqui jogaria a frase fora e a tela voltaria a adivinhar.
    const tela = ["en", "pt", "es", "hi"].includes(String(b.lang || "").toLowerCase().slice(0, 2))
      ? String(b.lang).toLowerCase().slice(0, 2)
      : (["en", "pt", "es", "hi"].includes(String((gdj.identity && gdj.identity.lang) || "").slice(0, 2)) ? String(gdj.identity.lang).slice(0, 2) : "en");
    const FRASE_FORA = {
      en: "I couldn't load this data right now. Please try again in a moment.",
      pt: "Não consegui carregar estes dados agora. Tente de novo em instantes.",
      es: "No pude cargar estos datos ahora. Inténtelo de nuevo en un momento.",
      hi: "मैं अभी यह डेटा लोड नहीं कर सका। कृपया थोड़ी देर में फिर कोशिश करें।",
    }[tela];
    const fora = async (nome, r, extra = {}) => {
      let cru = ""; try { cru = (await r.text()).slice(0, 200); } catch { /* corpo já lido */ }
      return json({ ok: false, ready: false, note: FRASE_FORA, error: FRASE_FORA, erro: FRASE_FORA, detalhe_tecnico: `${nome} HTTP ${r.status}: ${cru}`, ...extra });
    };
    const notPasted = { ok: false, ready: false, note: FRASE_FORA, error: FRASE_FORA, erro: FRASE_FORA };

    const action = (b.action || "ltv").toString();

    if (action === "sources") {
      const days = Math.min(Math.max(parseInt(b.days, 10) || 90, 7), 365);
      const r = await rpc("crm_lead_sources", { p_secret: secret, p_client_email: email, p_days: days });
      if (!r.ok) return fora("crm_lead_sources", r, { sources: [] });
      const sources = await r.json().catch(() => null);
      // lista ausente ≠ lista vazia: `|| []` diria "nenhuma origem" quando a leitura falhou.
      if (!Array.isArray(sources)) return json({ ...notPasted, detalhe_tecnico: "crm_lead_sources: resposta não é lista", sources: [] });
      return json({ ok: true, ready: true, sources });
    }

    if (action === "forecast") {
      const r = await rpc("crm_forecast", { p_secret: secret, p_client_email: email });
      if (!r.ok) return fora("crm_forecast", r, { forecast: null });
      const forecast = await r.json().catch(() => null);
      if (!forecast || typeof forecast !== "object") return json({ ...notPasted, detalhe_tecnico: "crm_forecast: resposta ilegível", forecast: null });
      return json({ ok: true, ready: true, forecast });
    }

    if (action === "abandoned") {
      const older = Math.min(Math.max(parseInt(b.older_min, 10) || 30, 5), 1440);
      const r = await rpc("booking_intents_abandoned", { p_secret: secret, p_client_email: email, p_older_min: older, p_limit: 50 });
      if (!r.ok) return fora("booking_intents_abandoned", r, { count: 0, intents: [] });
      const intents = await r.json().catch(() => null);
      if (!Array.isArray(intents)) return json({ ...notPasted, detalhe_tecnico: "booking_intents_abandoned: resposta não é lista", count: 0, intents: [] });
      return json({ ok: true, ready: true, count: intents.length, intents });
    }

    if (action === "recover") {
      // 1-click Gui follow-up on an abandoned booking: claim it (dedup) then log a
      // client_event so it shows in the live feed and Gui's callback picks it up.
      const intentId = (b.intent_id || "").toString().trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(intentId)) return json({ error: "bad intent_id" }, 400);
      // mesmo defeito de nome: a RPC recebe `p_client_email` — com `p_email` o "recuperar" nunca
      // reivindicou um agendamento abandonado sequer.
      const cr = await rpc("intent_recovery_claim", { p_secret: secret, p_client_email: email, p_intent_id: intentId });
      if (!cr.ok) return fora("intent_recovery_claim", cr, { claimed: false });
      const claimed = await cr.json().catch(() => false);
      if (claimed === true) {
        const who = (b.name || "").toString().slice(0, 120) || "Cliente";
        await rpc("ingest_client_event", {
          p_secret: secret, p_email: email, p_type: "message", p_channel: "Portal",
          p_summary: `Recuperação de agendamento: Gui vai chamar ${who} de volta`.slice(0, 300),
          p_amount: 0,
          p_payload: { kind: "booking-recovery", intent_id: intentId, contact: (b.contact || "").toString().slice(0, 160) },
        });
      }
      return json({ ok: true, claimed: claimed === true });
    }

    if (action === "churn") {
      // Clientes fiéis prestes a sumir: pontua 0-100 quem tem PADRÃO real (≥3 visitas, ≥14d),
      // devolve top em risco (>=50) com ação sugerida (call/sms/watch). Nunca cria falso-positivo.
      const r = await rpc("churn_risk_scan", { p_secret: secret, p_email: email, p_limit: Math.min(Math.max(parseInt(b.limit, 10) || 25, 1), 100) });
      if (!r.ok) return fora("churn_risk_scan", r, { atRisk: [] });
      const atRisk = (await r.json()) || [];
      return json({ ok: true, ready: true, count: Array.isArray(atRisk) ? atRisk.length : 0, atRisk });
    }

    if (action === "reengage") {
      // 1-clique: a Gui reativa sozinha um cliente em risco. Loga um client_event que o motor
      // de callback (call.js / win-back) captura → a Gui liga ou manda SMS de volta. Mesmo padrão do recover.
      const who = (b.name || "").toString().slice(0, 120) || "Cliente";
      const contact = (b.contact || "").toString().slice(0, 160);
      if (!contact) return json({ error: "contact required" }, 400);
      const suggested = ["call", "sms", "watch"].includes((b.suggested || "").toString()) ? b.suggested : "sms";
      // If the contact is an EMAIL, Gui reactivates RIGHT NOW (branded reengageEmail, works today).
      // Phone-only routes to SMS/call when A2P/opt-in is live — logged either way so it's in the feed.
      const emailed = isEmailAddr(contact) ? await sendReengageEmail(env, email, contact, who) : false;
      const via = emailed ? "email" : suggested;
      await rpc("ingest_client_event", {
        p_secret: secret, p_email: email, p_type: emailed ? "winback" : (suggested === "call" ? "call" : "message"),
        p_channel: emailed ? "email" : "Portal",
        p_summary: (emailed ? `♻️ Gui reativou ${who} por email (risco de perder)` : `Reativação: Gui vai ${suggested === "call" ? "ligar para" : "mandar SMS para"} ${who} (risco de perder)`).slice(0, 300),
        p_amount: 0,
        // "SMS" NÃO PODE VIRAR LIGAÇÃO (2026-10-01). A varredura que disca (cron-tick → phone_reengage_due)
        // só pula `suggested: "watch"`; o pedido de SMS entrava com "sms" e a pessoa recebia uma LIGAÇÃO
        // enquanto a tela dizia "a Gui vai mandar mensagem". Quem pediu texto fica fora da fila de
        // discagem (`suggested: "watch"`) e o pedido original fica em `pedido`, para o motor de texto.
        p_payload: { kind: "churn-reengage", contact: emailed ? contact.toLowerCase() : contact, suggested: (!emailed && suggested === "sms") ? "watch" : suggested, pedido: suggested, via, risk: Number(b.risk) || null },
      });
      return json({ ok: true, queued: true, via, sent: emailed });
    }

    if (action === "money_proof") {
      // MONEY-RECOVERED PROOF — the monthly "here's what Gui recovered for you" deliverable that
      // justifies the subscription. REAL per-tenant numbers only, from data already captured:
      //   • collected_cents ← revenue_month (the authoritative money spine, in cents; same RPC the
      //     cockpit + weekly report use — excludes cancelled/no-show).
      //   • bookings ← client_events_since, counting type='booking' this calendar month (same rule as
      //     client-report.js).
      // after_hours = call events whose timestamp lands outside 08:00–18:00 or on a weekend (UTC
      // approximation — see isAfterHours; labeled estimate, never cash). estimated_value_cents is a
      // conservative benchmark vs a human receptionist using the SAME disclosed rates moneyRecoveredEmail
      // discloses ($75/booking, $40/after-hours call) PLUS the exact collected cash — real:estimated is
      // true whenever any input is real, but it is NEVER presented as collected money. no-show prevented
      // stays 0/real:false (the no-show engine tracks ones that HAPPENED, not prevented). A cron/portal
      // renders/sends via moneyRecoveredEmail using these figures.
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
      const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthLabel = `${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
      const [revR, evR] = await Promise.all([
        rpc("revenue_month", { p_secret: secret, p_email: email, p_since: monthStart }),
        rpc("client_events_since", { p_secret: secret, p_email: email, p_since: monthStart }),
      ]);
      const rev = revR.ok ? await revR.json().catch(() => null) : null;
      const evsRaw = evR.ok ? await evR.json().catch(() => null) : null;
      const evs = Array.isArray(evsRaw) ? evsRaw : [];
      const eventsReal = evR.ok && Array.isArray(evsRaw);
      const collectedReal = !!(rev && typeof rev.total_cents === "number");
      const collected_cents = collectedReal ? Math.max(0, Math.round(rev.total_cents)) : 0;
      const bookings = eventsReal ? evs.filter((e) => e && e.type === "booking").length : 0;
      const calls_answered = eventsReal ? evs.filter((e) => e && e.type === "call").length : 0;
      const calls_after_hours = eventsReal ? evs.filter((e) => e && e.type === "call" && isAfterHours(e.created_at)).length : 0;
      // Benchmarked-value estimate (cents): exact collected cash + $75/booking + $40/after-hours call.
      // SAME disclosed rates moneyRecoveredEmail uses. NEVER a substitute for collected — it's the
      // "value recovered vs a receptionist" figure, returned with real.estimated so the UI can label it.
      const estimated_value_cents = collected_cents + bookings * 7500 + calls_after_hours * 4000;
      const proof = {
        month: monthLabel,
        calls_after_hours,      // real: derived from captured call timestamps (UTC after-hours heuristic)
        calls_answered,         // real total calls answered this month (truthful bonus figure)
        bookings,
        collected_cents,
        estimated_value_cents,  // benchmarked estimate — NEVER presented as collected cash
        noshows_prevented: 0,   // no captured "prevented" signal → honest 0 (see `real`)
      };
      const real = {
        calls_after_hours: eventsReal, // now derived from captured call timestamps
        calls_answered: eventsReal,
        bookings: eventsReal,
        collected_cents: collectedReal,
        estimated: eventsReal || collectedReal, // the benchmarked total is real whenever any input is real
        noshows_prevented: false, // no-show engine tracks occurred, not prevented
      };
      const ready = collectedReal || eventsReal;
      return json({ ok: true, ready, month: monthLabel, since: monthStart, proof, real, ...(ready ? {} : { note: notPasted.note }) });
    }

    // default: ltv
    const r = await rpc("crm_ltv", { p_secret: secret, p_client_email: email, p_key: key });
    if (!r.ok) return fora("crm_ltv", r, { ltv: null });
    const ltv = await r.json().catch(() => null);
    return json({ ok: true, ready: true, ltv });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
