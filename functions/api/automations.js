// Cloudflare Pages Function — GET/POST /api/automations?token=DIGEST_TOKEN
// O que ainda mora aqui (2026-08-17, depois da poda dos motores mortos):
//   0. HOLDS     — solta reserva provisória vencida, mesmo em dia parado
//   4. RISK      — confirmação extra automática para horário com risco alto de falta
//   5. SLOW-DAY  — promoção opt-in para encher dia de baixa ocupação
// Lembrete, avaliação e win-back NÃO estão mais aqui: moram no /api/proactive (veja o bloco
// "OS TRÊS MOTORES MORTOS" abaixo — é a história inteira de por quê).
// Wire into the guileo-digest-cron Worker alongside /api/backup. Idempotent:
// the DB RPCs only return rows not yet handled, and we only mark/ingest AFTER
// a real Twilio send — so before Twilio is configured every run is a no-op
// that reports skipped counts instead of burning the one-shot flags.
import { json, safeEq } from "../lib/guard.js";
import { sendText } from "../lib/twilio.js";
import { promoEmail } from "../lib/emailTemplates.js";
import { svcRpc, svcJson, sbKey } from "../lib/sb.js";
import { unsubUrl } from "../lib/unsub.js";
import { emitFailure } from "../lib/failure.js";
import { motoresAtivos } from "./cron-tick.js";

const isEmailAddr = (s) => /.+@.+\..+/.test((s || "").toString());
// Slow-day promos reach customers TODAY by email (SMS/WhatsApp light up at A2P). Best-effort.
async function sendPromoEmail(env, to, subject, html) {
  if (!env.RESEND_API_KEY || !isEmailAddr(to)) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to, subject, html }),
    });
    // "Enviado" só com o comprovante do provedor (o id da mensagem). Antes contava como enviado
    // qualquer resposta, inclusive 4xx/5xx — o contador de promoções mentia.
    if (!r.ok) return false;
    const d = await r.json().catch(() => null);
    return !!(d && d.id);
  } catch { return false; }
}

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const MAX_SENDS = 60; // hard cap per run — protects against bad data blasting hundreds of texts

async function rpc(env, fn, args) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", ...args }),
  });
  return r.ok ? await r.json() : null;
}

const ingest = (env, email, type, channel, summary, payload) =>
  rpc(env, "ingest_client_event", { p_email: email, p_type: type, p_channel: channel, p_summary: (summary || "").slice(0, 300), p_amount: 0, p_payload: payload || {} });

// Profile lookups are cached per run — many bookings share one client.
async function profileFor(env, cache, email) {
  if (!cache.has(email)) cache.set(email, (await rpc(env, "get_client_profile", { p_email: email })) || {});
  return cache.get(email);
}

// v1 keeps times in UTC ("HH:MM") — per-client timezones come with the profile later.
const hhmm = (iso) => { try { return new Date(iso).toISOString().slice(11, 16); } catch { return ""; } };
// "20/06 às 14:30" (pt) / "20/06 a las 14:30" (es) / "06/20 at 14:30" (en) — when-label for the risk nudge.
const whenLabel = (iso, lang) => {
  try {
    const d = new Date(iso);
    const dd = String(d.getUTCDate()).padStart(2, "0"), mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    return lang === "pt" ? `${dd}/${mm} às ${hhmm(iso)}` : lang === "es" ? `${dd}/${mm} a las ${hhmm(iso)}` : `${mm}/${dd} at ${hhmm(iso)}`;
  } catch { return ""; }
};
// Customer texts go out in the CLIENT profile's language — pt / es / en supported.
const langNorm = (v) => { const l = (v || "").toString().toLowerCase().slice(0, 2); return l === "pt" ? "pt" : l === "es" ? "es" : "en"; };

// ── NÃO-PERTURBE: TRÊS RESPOSTAS, NÃO DUAS (auditoria de lançamento, 2026-09-22) ────────────────
// Antes: `try { if ((await rpc("is_dnc")) === true) pula } catch { /* fail-open */ }`. E o `rpc`
// daqui devolve `null` quando o banco recusa — `null === true` é falso, então "não consegui ler a
// lista" e "a pessoa NÃO pediu para parar" davam no mesmo: manda. Numa varredura automática isso
// é o pior fail-open possível, porque ninguém pediu a mensagem e ela sai em lote.
// Agora: true = pediu para parar · false = liberado · null = NÃO SEI → não manda (fail-closed).
// A assimetria com o caminho público do call.js é de propósito e está explicada lá: aqui nunca
// há uma pessoa esperando a mensagem naquele instante, então atrasar custa pouco e errar custa caro.
async function dncLe(env, phone) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/is_dnc`, {
      method: "POST",
      headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", p_phone: phone }),
    });
    if (!r.ok) return { sabe: false, motivo: `is_dnc http ${r.status}` };
    const v = await r.json().catch(() => undefined);
    if (v === true || v === false) return { sabe: true, bloqueado: v };
    return { sabe: false, motivo: "is_dnc respondeu algo que não é sim/não" };
  } catch (e) { return { sabe: false, motivo: `is_dnc fora do ar: ${String(e).slice(0, 80)}` }; }
}

// The scheduling RPCs (noshow_risk) are gated by SCHED_SECRET, not INGEST_SECRET.
async function schedRpc(env, fn, args) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: env.SCHED_SECRET || "", ...args }),
  });
  return r.ok ? await r.json() : null;
}


// ── OS TRÊS MOTORES MORTOS FORAM RESOLVIDOS (2026-08-17) ────────────────────────────────────────
// O aviso longo abaixo (de 2026-08-12) descreve o defeito; ficou por inteiro porque a lição vale
// mais que o código que ele guardava. O que mudou hoje: ao abrir os três, eram problemas
// DIFERENTES, e só um pedia código novo.
//
//   · due_reminders       DUPLICATA. O proactive.js já lembra pelas RPCs certas, de hora em hora.
//   · due_winback         DUPLICATA. O proactive.js já reativa (dormentes 60d + quebra de cadência).
//   · due_review_requests NUNCA EXISTIU. Sem RPC, sem template, sem motor — ninguém pedia avaliação.
//
// Duplicata morta não se conserta ligando: apontá-las para as RPCs `biz_*` faria o cliente receber
// o MESMO lembrete duas vezes. O conserto certo de código morto duplicado é a tesoura — foi o que
// aconteceu com ENGINE 1, 2 e 3 deste arquivo. O terceiro virou motor de verdade em outro lugar:
// db/motor_review.sql + reviewRequestEmail + o bloco de avaliação no proactive.js, onde moram os
// outros e-mails de ciclo de vida (mesma marca, mesma supressão, mesmo teto de envio).
//
// `mark_booking` saiu junto: era chamada só por esses motores e também não existe neste banco.
// A sonda do platform-status parou de vigiar os três nomes fantasma e passou a vigiar as funções
// vivas — sondar um nome que ninguém mais chama é manter um alarme tocando por um cômodo demolido.
//
// ── (2026-08-12) POR QUE ELES ESTAVAM MORTOS ────────────────────────────────────────────────────
// Auditoria completa "toda RPC que o código chama × pg_proc" (198 nomes) revelou que TRÊS motores
// deste arquivo chamam funções que NÃO EXISTEM neste banco: `due_reminders`, `due_review_requests`
// e `due_winback` (mais `mark_booking`). São nomes da geração ANTERIOR do schema — o projeto de
// dados antigo. Quando a plataforma migrou, o motor de agenda foi reescrito com o prefixo `biz_`
// (`biz_due_reminders` etc.) e ESTE arquivo ficou para trás.
//
// O QUE ISSO FAZIA: `(await rpc(...)) || []` transforma "a função não existe" em ZERO LINHAS, que
// se lê como "nada vencendo hoje". O cron chama isto a cada 15 minutos — 96 vezes por dia
// reportando sucesso sem fazer nada. É o `fallback esconde erro` na forma mais cara: um motor
// morto que parece um dia tranquilo.
//
// ⚠️ E O MAIS REVELADOR: quatro linhas ACIMA, o `biz_holds_expire` já era tratado do jeito certo —
// `else out.holdsReady = false; // reported, not silent`. O padrão honesto e o silencioso convivem
// no MESMO arquivo. Quem escreveu aquele else conhecia o risco; faltou a varredura.
//
// POR QUE NÃO MIGREI PARA `biz_*`: o `proactive.js` JÁ manda esses lembretes usando as funções
// certas, e ele TAMBÉM está no cron. Apontar este arquivo para as mesmas RPCs faria o cliente
// receber o lembrete DUAS VEZES. Consertar um motor morto criando spam seria trocar um problema
// invisível por um visível na caixa de entrada de quem paga.
// Então: o silêncio vira RUÍDO. Cada motor sem RPC se declara `notReady` na resposta, o vigia vê,
// e a decisão de aposentar este arquivo (ou reescrevê-lo) passa a ser tomada com o fato à vista.

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "method" }, 405);
  const tok = new URL(request.url).searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
  if (!env.DIGEST_TOKEN || !safeEq(tok, env.DIGEST_TOKEN)) return json({ error: "unauthorized" }, 401);

  const configured = !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM);
  // reminders24/reminders2/reviews/winback saíram da resposta junto com os motores: campo que só
  // sabe devolver zero é pior que campo ausente — parece um dia parado em vez de código removido.
  const out = { holdsReleased: 0, holdsReady: true, riskConfirm: 0, riskClaimedDupe: 0, riskSkipped: 0, riskReady: true, slowday: 0, slowdayReady: true, sent: 0, skipped: 0, dncIlegivel: 0, configured };
  const profiles = new Map();
  const budget = () => out.sent < MAX_SENDS; // shared cap across all three engines

  // INTERRUPTOR GERAL (2026-09-22) — lido AQUI, e não só no cron, para que uma chamada manual com
  // o token não fure o desligamento. Desligado, a rota ainda solta reserva vencida (ENGINE 0, que
  // não fala com ninguém) e pula os dois motores que escrevem para cliente (4 e 5).
  const ligados = await motoresAtivos(env);

  // DNC ilegível: UM aviso por rodada, não um por destinatário — com o banco fora seriam 60
  // falhas iguais no feed, e falha repetida 60 vezes é a que ninguém lê.
  let dncAvisado = false;
  const dncLiberado = async (phone, motor) => {
    const d = await dncLe(env, phone);
    if (d.sabe) return d.bloqueado === false;
    out.dncIlegivel++;
    if (!dncAvisado) {
      dncAvisado = true;
      await emitFailure(env, "dnc_check_unavailable", "", `automations (${motor}): não consegui ler a lista de não-perturbe (${d.motivo}) — envio recusado nesta rodada`, { motor, motivo: d.motivo });
    }
    return false;
  };

  // ENGINE 0 — RELEASE EXPIRED HOLDS. Slots put on 'hold' (deposit-to-book) are cleaned
  // lazily by the biz_* RPCs, but only when the next booking touches that service — on a
  // quiet day an expired hold blocks its slot for hours. This tick sweeps them regardless
  // of traffic via the SCHED-gated wrapper (db/holds_release.sql). Best-effort, no sends,
  // never blocks the revenue loops; graceful until the wrapper is pasted (holdsReady:false).
  try {
    const hr = await schedRpc(env, "biz_holds_expire", {});
    if (hr && typeof hr.released === "number") out.holdsReleased = hr.released;
    else out.holdsReady = false; // wrapper not pasted (or RPC unreachable) → reported, not silent
  } catch { out.holdsReady = false; }

  // ENGINE 4 — RISK-RADAR AUTO-CONFIRM (Superpower #3 acting on its own):
  // for every client with upcoming bookings, score them with noshow_risk (p_days=2) and send
  // ONE warm extra-confirmation WhatsApp to appointments with risk ≥ 60 in the next ~36h.
  // Idempotent via risk_confirm_claim (ATOMIC 7-day claim, db/risk_autoconfirm.sql) claimed
  // BEFORE the send; DNC-checked via the same is_dnc the dial gate uses; capped at 30/run.
  // Graceful: until db/risk_autoconfirm.sql is pasted, risk_clients is null → riskReady:false, no-op.
  if (ligados) try {
    const RISK_CAP = 30;             // per-run ceiling across ALL clients for this engine
    const RISK_MIN = 60;             // only genuinely risky appointments get the extra touch
    const RISK_WINDOW_MS = 36 * 3600 * 1000; // ~36h horizon — close enough to matter
    const clients = await rpc(env, "risk_clients", {});
    if (!Array.isArray(clients)) out.riskReady = false;
    else if (configured) {           // no Twilio yet → don't burn claims; retry next run
      let riskSent = 0;
      for (const c of clients) {
        if (riskSent >= RISK_CAP || !budget()) break;
        const email = ((c && c.client_email) || "").toString().trim().toLowerCase();
        if (!email.includes("@")) continue;
        const _nsr = await svcRpc(env, "noshow_risk", { p_secret: env.SCHED_SECRET || "", p_email: email, p_days: 2 });
        const _nsd = _nsr.ok ? await _nsr.json().catch(() => []) : [];
        const rows = Array.isArray(_nsd) ? _nsd : [];
        const p = await profileFor(env, profiles, email);
        // PT default preserved — this engine is BR-first; explicit en/es profiles get their language.
        const L = p.lang === "en" ? "en" : (p.lang || "").toString().toLowerCase().slice(0, 2) === "es" ? "es" : "pt";
        for (const a of rows) {
          if (riskSent >= RISK_CAP || !budget()) break;
          if ((a.risk || 0) < RISK_MIN) continue;
          const startMs = new Date(a.starts_at).getTime();
          if (!(startMs > Date.now() && startMs - Date.now() < RISK_WINDOW_MS)) continue;
          const phone = (a.customer_contact || "").toString().replace(/[^0-9+]/g, "");
          if (!/^\+?[1-9]\d{7,14}$/.test(phone)) { out.riskSkipped++; continue; } // contact is an email or junk
          // COMPLIANCE — same suppression list the hardened dial gate honors. Never text a STOP.
          // FAIL-CLOSED: lista ilegível = não manda (ver dncLe). O horário não é reservado nem
          // queimado — a próxima rodada, com o banco de volta, ainda pega este agendamento.
          if (!(await dncLiberado(phone, "risco de falta"))) { out.riskSkipped++; continue; }
          const nome = a.customer_name || (L === "pt" ? "tudo bem" : "there");
          const hola = `¡Hola${a.customer_name ? ` ${a.customer_name}` : ""}!`;
          const biz = p.business_name || (L === "pt" ? "nosso espaço" : L === "es" ? "nuestro local" : "our place");
          const quando = whenLabel(a.starts_at, L);
          const msg = L === "pt"
            ? `Oi ${nome}! Confirmando seu horário ${quando} na ${biz} 🌱 Responde SIM pra confirmar ou me avisa se precisar remarcar.`
            : L === "es"
              ? `${hola} Confirmando tu cita ${quando} en ${biz} 🌱 Responde SÍ para confirmar o avísame si necesitas reprogramar.`
              : `Hi ${nome}! Just confirming your appointment ${quando} at ${biz} 🌱 Reply YES to confirm or let me know if you need to reschedule.`;
          const r = await sendText(env, phone, msg, { channel: "whatsapp" });
          if (r.sent) {
            // ATOMIC claim ONLY AFTER a confirmed send — mirror ENGINE 1's mark-after-send discipline. A
            // failed send never burns the 7-day lock; the tiny double-send window on a racing run is the
            // same risk the 24h/2h reminder engine already accepts.
            const claimed = await rpc(env, "risk_confirm_claim", { p_email: email, p_appointment_id: a.appointment_id });
            if (claimed !== true) { out.riskClaimedDupe++; continue; }
            riskSent++; out.riskConfirm++; out.sent++;
            await ingest(env, email, "confirm", "whatsapp",
              `🛡️ confirmação extra automática — risco de falta ${a.risk || 0}%`,
              { appointment_id: a.appointment_id, phone, risk: a.risk || 0 });
          } else out.riskSkipped++; // unsent → no claim burned; the appointment retries next run
        }
      }
    }
  } catch { /* isolated — risk engine failing must never block the revenue loops */ }

  // ENGINE 5 — SLOW-DAY PROMO (OPT-IN, off by default like collections_auto). For every opted-in tenant
  // (slowday_auto_list, db/growth_dates.sql) find days in the next ~72h with low occupancy vs capacity
  // (slowday_candidates) and fire a flash promo to recent customers to fill them. EMAIL now (reaches
  // customers today), WhatsApp/SMS when A2P clears. Per-recipient claim (marketing_date_claim, kind
  // 'slowday') dedups so nobody is spammed. Capped per run. Graceful: no opt-ins / no keys → no-op.
  if (ligados) try {
    const SLOW_CAP = 40;                        // hard ceiling across all tenants for this engine
    const PER_DAY = 15;                          // at most N recent customers per soft day
    const optedIn = await rpc(env, "slowday_auto_list", {});
    if (!Array.isArray(optedIn)) out.slowdayReady = false;
    else {
      let slowSent = 0;
      for (const row of optedIn) {
        if (slowSent >= SLOW_CAP || !budget()) break;
        const email = ((row && row.client_email) || "").toString().trim().toLowerCase();
        if (!email.includes("@")) continue;
        const cand = await schedRpc(env, "slowday_candidates", { p_email: email, p_hours: 72, p_max_occ: 0.4, p_limit: 4 });
        const days = (cand && cand.days) || [];
        if (!days.length) continue;
        const rcp = await rpc(env, "crm_marketing_recipients", { p_client_email: email, p_days: 120, p_limit: 200 });
        const recipients = (rcp && rcp.contacts) || [];
        // PROMOÇÃO É MARKETING (2026-10-01): este ramo de e-mail saía sem consultar a lista de
        // descadastro, sem link de descadastro e sem endereço — o resto da casa (proactive.js) já
        // fazia os três. FAIL-CLOSED igual lá: lista que não foi lida = nenhum e-mail deste negócio
        // nesta volta. `supressos === null` desliga só o ramo de e-mail; o de WhatsApp tem a própria trava.
        let supressos = null, endereco = "";
        try {
          const sup = await svcJson(env, "email_suppressed_list", { p_secret: env.INGEST_SECRET || "", p_client_email: email });
          if (Array.isArray(sup)) supressos = new Set(sup.map((x) => String(x).toLowerCase()));
        } catch { /* fica null → e-mail deste negócio não sai nesta volta */ }
        try {
          const a = await svcJson(env, "client_postal_address", { p_secret: env.INGEST_SECRET || "", p_client_email: email });
          if (typeof a === "string" && a.trim()) endereco = a.trim().slice(0, 200);
        } catch { /* endereço ausente não bloqueia; a lista de descadastro, sim */ }
        const p = await profileFor(env, profiles, email);
        const L = langNorm(p.lang);
        const biz = p.business_name || (L === "pt" ? "nosso espaço" : L === "es" ? "nuestro local" : "our place");
        const headline = L === "pt" ? "Uma vaga de última hora pra você 🌱" : L === "es" ? "Un lugar de última hora para ti 🌱" : "A last-minute opening for you 🌱";
        const message = L === "pt" ? `Temos horários abertos essa semana na ${biz} — adoraríamos te receber. Quer que eu encaixe você?` : L === "es" ? `Tenemos horarios libres esta semana en ${biz} — nos encantaría recibirte. ¿Te encajo un horario?` : `We have openings this week at ${biz} — we'd love to have you in. Want me to fit you in?`;
        for (const dd of days) {
          for (const c of recipients.slice(0, PER_DAY)) {
            if (slowSent >= SLOW_CAP || !budget()) break;
            const who = (c.id || c.email || c.phone || "").toString();
            const claimed = await rpc(env, "marketing_date_claim", { p_client_email: email, p_kind: "slowday", p_ref: `${dd.location_id}:${dd.day}`, p_period: who });
            if (claimed !== true) continue;         // already invited to this day (or racing run owns it)
            if (isEmailAddr(c.email)) {
              const para = String(c.email).trim().toLowerCase();
              // Sem lista lida, ou pessoa que pediu para sair: não manda. (A reserva do dia já foi
              // gasta acima — convite perdido é barato perto de promoção para quem descadastrou.)
              if (!(supressos instanceof Set) || supressos.has(para)) { out.skipped++; continue; }
              const unsub = await unsubUrl(env, "https://guileoai.com", email, para).catch(() => "");
              if (!unsub) { out.skipped++; continue; }   // sem link de descadastro não é e-mail de marketing que se mande
              const { subject, html } = promoEmail({ name: c.name || (L === "pt" ? "tudo bem" : "there"), business: "", headline, message, offer: "", lang: L, bizEmail: email, unsub, address: endereco });
              if (await sendPromoEmail(env, c.email, subject, html)) { slowSent++; out.slowday++; out.sent++; } else out.skipped++;
            } else {
              const phone = (c.phone || "").toString().replace(/[^0-9+]/g, "");
              if (!/^\+?[1-9]\d{7,14}$/.test(phone)) continue;
              // ⚠️ ESTE RAMO MANDAVA WHATSAPP SEM CONSULTAR O NÃO-PERTURBE (achado em 2026-09-22).
              // Só o motor de risco consultava; a promoção — marketing puro — ia para o telefone
              // de quem tinha mandado STOP. Fail-closed como o resto do arquivo: lista ilegível =
              // não manda. A consulta vem DEPOIS da reserva de propósito: antes dela seria uma
              // consulta por destinatário por tique (a rota roda a cada 15 min) mesmo para quem já
              // foi convidado. O custo é o convite deste dia ficar queimado numa queda do banco —
              // barato perto de promoção para quem pediu para parar.
              if (!(await dncLiberado(phone, "dia fraco"))) { out.skipped++; continue; }
              const r = await sendText(env, phone, `🌱 ${headline} ${message}`.slice(0, 300), { channel: "whatsapp" });
              if (r.sent) { slowSent++; out.slowday++; out.sent++; } else out.skipped++;
            }
          }
        }
      }
    }
  } catch { /* isolated — slow-day engine failing must never block the revenue loops */ }

  if (!ligados) return json({ ok: true, desligado: true, motivo: "motores_proativos=off — só a soltura de reserva vencida rodou; nenhuma mensagem saiu", ...out });
  return json(out);
}
