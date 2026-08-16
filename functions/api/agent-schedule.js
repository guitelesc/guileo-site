// Cloudflare Pages Function — POST /api/agent-schedule
// The scheduling "tools" the Gui voice agent calls on a call. Accepts human NAMES (the agent speaks
// in names, not UUIDs) and resolves them against the live business profile, then hits the motor:
//   op = "lookup"       → the business menu (services, locations, professionals)
//   op = "availability" → real free slots for a service (optionally a location/professional)
//   op = "book"         → book a slot (DB EXCLUDE constraint blocks double-booking)
// Gated by the agent secret (x-guileo-secret / ?secret). Talks to the scheduling DB with SCHED_SECRET.
import { safeEq } from "../lib/guard.js";
import { emitFailure } from "../lib/failure.js";
import { appointmentEmail, ownerAlertEmail, waitlistOfferEmail } from "../lib/emailTemplates.js";
import { sendText, sendOrFlag } from "../lib/twilio.js";
// THE UNIFIED SCHEDULING BRAIN — routes availability/book to a connected external calendar
// (MindBody/Square/…) when the tenant has one ready, else to the internal biz_* engine. See
// functions/lib/scheduleAdapter.js. Falls back to internal on ANY external error → zero regression.
import { resolveScheduler, getAvailability as adapterAvailability, book as adapterBook } from "../lib/scheduleAdapter.js";
import { brandFor } from "../lib/clientBrand.js";
import { resolveSlot, oQueAPessoaDisse } from "../lib/slotResolver.js";
import { resolveServicoLocal } from "../lib/bizMatch.js";
import { avaliarContato, pedirContatoMsg } from "../lib/contato.js";
import { svcRpc } from "../lib/sb.js";

// Send a branded confirmation to the CUSTOMER (email now; SMS lights up when A2P clears). Best-effort.
const isEmail = (s) => /.+@.+\..+/.test((s || "").toString());
// Devolve o melhor e-mail para ESTE cliente: o que ele deu agora, ou — se ele deu só o telefone —
// o que já está no cadastro dele. Sem isto, marcar por telefone não gerava confirmação NENHUMA
// (o SMS está bloqueado pela campanha A2P), e a pessoa desligava sem nada na mão. Foi exatamente
// a reclamação do Luis em 2026-08-05: "não chegou e-mail nada".
async function emailDoCliente(env, tenant, contato) {
  if (isEmail(contato)) return contato;
  const fone = (contato || "").toString().replace(/[^0-9+]/g, "");
  if (!fone || !tenant) return "";
  try {
    const r = await svcRpc(env, "crm_contact_email", { p_secret: env.SCHED_SECRET || "", p_email: tenant, p_phone: fone });
    if (!r || !r.ok) return "";
    const v = await r.json().catch(() => "");
    return isEmail(v) ? v : "";
  } catch { return ""; }
}

async function sendApptEmail(env, kind, p) {
  if (!env.RESEND_API_KEY) return false;
  // o destinatário pode vir do cadastro quando a pessoa só deu o telefone
  const destino = await emailDoCliente(env, p.tenant, p.contact);
  if (!isEmail(destino)) return false;
  try {
    // MARCA DO CLIENTE — o e-mail que confirma o horário é a primeira coisa que o cliente do NEGÓCIO
    // recebe. Saía com o logo da Guileo: parece que outra empresa marcou pra ele. Agora sai com o
    // logo, a cor e o nome do negócio, e a Guileo desce pro rodapé como "powered by".
    // Falha ao carregar a marca não pode impedir a confirmação — cai no visual Guileo, que funciona.
    const brand = await brandFor(env, p.tenant).catch(() => null);
    const { subject, html } = appointmentEmail({
      kind, name: p.name, business: p.business || (brand && brand.business) || "",
      service: p.service, whenLabel: p.whenLabel, pro: p.pro, location: p.location,
      // ENDEREÇO E TELEFONE: já estavam em biz_locations e nunca chegavam ao e-mail. Sem eles a
      // pessoa confirma um horário sem saber PARA ONDE ir — e liga de novo pra perguntar.
      address: p.address || "", locPhone: p.locPhone || "",
      ref: p.ref, lang: p.lang || "en", brand,
    });
    // r.ok matters: Resend answers 4xx on an unverified domain / bad address / rate limit.
    // Returning true regardless would tell the caller a confirmation went out when it didn't.
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: destino, subject, html }),
    });
    return r.ok;
  } catch { return false; }
}

// Send the customer-facing appointment email AND make a failure visible. Gui tells the
// customer on the call "I've sent you the confirmation" — if Resend refuses (unverified
// domain, bad address, rate limit) that promise silently breaks: the customer waits for an
// email that never comes, forgets, and no-shows. The owner must see it in the cockpit.
// A non-email contact (phone-only booking) is a legitimate skip, not a failure.
async function apptEmailOrFlag(env, tenantEmail, kind, p) {
  const ok = await sendApptEmail(env, kind, { ...p, tenant: tenantEmail });
  if (ok || !isEmail(p.contact)) return ok;
  try {
    await svcRpc(env, "ingest_client_event", {
      p_secret: env.INGEST_SECRET || "", p_email: tenantEmail, p_type: "message", p_channel: "Email",
      p_summary: `⚠️ E-mail de ${kind === "book" ? "confirmação" : kind} NÃO foi entregue a ${p.contact} — confirme com o cliente`,
      p_amount: 0, p_payload: { delivery: "failed", kind, to: String(p.contact || "") },
    });
  } catch { /* logging must never break a booking that already succeeded */ }
  return false;
}

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

// GOOGLE CALENDAR PUSH — when the tenant connected their Google (gcal-connect stored a refresh_token
// in client_integrations, read via gcal_token_lookup, INGEST-gated), drop the booking straight into
// their Google Calendar so the spa SEES it in the tool they already use — no MindBody needed.
// Best-effort: no keys / not connected / bad token → silent no-op. NEVER blocks the booking.
async function gcalPush(env, email, ev) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.INGEST_SECRET) return;
  try {
    const lr = await fetch(`${SB}/rest/v1/rpc/gcal_token_lookup`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.INGEST_SECRET, p_email: email }),
    });
    const refresh = lr.ok ? ((await lr.json()) || "").toString() : "";
    if (!refresh || refresh.length < 10) return; // not connected
    const tr = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: refresh, grant_type: "refresh_token" }),
    });
    if (!tr.ok) return;
    const at = ((await tr.json()) || {}).access_token;
    if (!at) return;
    const startMs = Date.parse(ev.startIso);
    if (!isFinite(startMs)) return;
    const endIso = new Date(startMs + (ev.durationMin || 60) * 60000).toISOString();
    await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST", headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: ev.summary, description: ev.description || "", location: ev.location || "",
        start: { dateTime: ev.startIso, timeZone: ev.tz || "America/New_York" },
        end: { dateTime: endIso, timeZone: ev.tz || "America/New_York" },
      }),
    });
  } catch { /* best-effort — never block the booking */ }
}

// Format a service's price (dollars from cents) so the Gui can quote it out loud. "" when there's no
// set price (null/0) → the agent says "on request" and captures it as a quote, never invents a number.
const money = (cents) => {
  const c = Number(cents);
  if (!Number.isFinite(c) || c <= 0) return "";
  const d = c / 100;
  return "$" + (Number.isInteger(d) ? d : d.toFixed(2));
};
const norm = (s) => (s || "").toString().trim().toLowerCase();
// Acha o item pelo nome falado. Quando o nome NÃO vem e só existe UMA opção, devolve essa —
// perguntar "qual serviço?" a um negócio que tem um serviço só é queimar o tempo de quem ligou
// com uma pergunta cuja resposta o sistema já tem. Vale para serviço, local e profissional.
// Com duas ou mais opções continua devolvendo null, e aí perguntar é o certo.
const pick = (arr, name) => {
  const lista = Array.isArray(arr) ? arr : [];
  if (!name) return lista.length === 1 ? lista[0] : null;
  const n = norm(name);
  return lista.find((x) => norm(x.name) === n) || lista.find((x) => norm(x.name).includes(n) || n.includes(norm(x.name))) || (lista.length === 1 ? lista[0] : null);
};

async function rpc(env, fn, body) {
  const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, p_secret: env.SCHED_SECRET || "" }),
  });
  return r.json();
}

// TRILHA DAS FERRAMENTAS — 2026-08-04. A Lilian disse "anotei seu pedido" e nada foi marcado,
// e não deu pra saber se ela chamou op='book' e falhou, ou se nunca chamou: as chamadas de
// ferramenta não eram registradas em lugar nenhum. Sem essa trilha, todo diagnóstico de
// "por que a IA não fez X" vira adivinhação. Best-effort e nunca bloqueia a ligação.
// TODA RECUSA DEIXA RASTRO — com o MOTIVO.
//
// Em 2026-08-08 uma ligação real de 154 segundos chamou `availability` e depois `book`, e não
// marcou nada. O log tinha "book → chamada" e mais nada: o sucesso escrevia "OK", a recusa não
// escrevia coisa alguma. Levou uma hora de escavação em três sistemas para concluir que o motivo
// era irrecuperável — ele nunca foi gravado.
//
// Um motor que só registra o que deu certo produz exatamente a evidência que não serve: mostra os
// casos que já sabemos que funcionam e apaga os que precisamos entender. Daqui pra frente, a
// recusa é gravada com a razão e com o que a pessoa pediu — que é o par mínimo para reproduzir.
async function logRecusa(env, email, op, motivo, pedido) {
  await logTool(env, email, op, `RECUSA:${motivo}`, `pediu: ${String(pedido || "—").slice(0, 100)}`);
}

async function logTool(env, email, op, outcome, detail) {
  try {
    await svcRpc(env, "ingest_client_event", {
      p_secret: env.INGEST_SECRET || "", p_email: email,
      p_type: "agent_tool", p_channel: "voice",
      p_summary: `🔧 ${op} → ${outcome}${detail ? ` · ${String(detail).slice(0, 120)}` : ""}`,
      p_amount: 0, p_payload: { op, outcome, detail: String(detail || "").slice(0, 200) },
    });
  } catch { /* a ligação vale mais que o log */ }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => null);
    if (!b) return json({ error: "bad request" }, 400);

    // ── COCKPIT ACTIONS (special dates) — per-tenant gate (email + connection key via
    // get_client_data, same pattern as noshow-radar.js). Handled BEFORE the agent-secret
    // gate; every agent op below still requires AGENT_ACTION_SECRET exactly as before.
    const cockpitAction = (b.action || "").toString();
    if (cockpitAction === "special_list" || cockpitAction === "special_set") return specialDates(env, b, cockpitAction);
    if (cockpitAction === "loc_list" || cockpitAction === "loc_set") return locActions(env, b, cockpitAction);

    const provided = request.headers.get("x-guileo-secret") || new URL(request.url).searchParams.get("secret") || "";
    if (!env.AGENT_ACTION_SECRET || !safeEq(provided, env.AGENT_ACTION_SECRET)) return json({ error: "unauthorized" }, 401);
    const testMode = (request.headers.get("x-guileo-test") || "") === "1"; // dry-run: send NO real email
    if (!env.SCHED_SECRET) return json({ message: "Scheduling isn't set up yet." }, 200);
    const op = (b.op || "lookup").toString();
    // MULTI-TENANT: the business is pinned by the agent's STATIC header (x-guileo-client), set at
    // provision time — NEVER trust a caller-supplied client_email. No demo/owner fallback: if we can't
    // resolve the tenant, reject so a misconfigured agent never writes into the wrong business.
    const email = ((request.headers.get("x-guileo-client") || b.client_email || b.email || "").toString()).trim().toLowerCase();
    if (!email || !email.includes("@")) return json({ error: "client_email could not be resolved for this agent" }, 400);

    // registra a TENTATIVA antes de qualquer coisa poder falhar em silêncio
    await logTool(env, email, op, "chamada");

    const menu = await rpc(env, "biz_lookup", { p_email: email });
    if (menu?.error) return json({ message: diz("agenda_fora_do_ar", b.lang) }, 200);
    const services = menu.services || [], locations = menu.locations || [], pros = menu.professionals || [];
    // 2.12 — speak times in the BUSINESS's timezone (not hardcoded NY) so a Lisbon/São Paulo client
    // hears correct hours. Passed explicitly to fmt() to stay concurrency-safe under volume.
    const bizTz = (locations[0] && locations[0].tz) || "America/New_York";
    // UNIFIED ADAPTER — lazily resolve which scheduler owns this tenant (external ready > internal).
    // Only availability/book consult it; every other op is untouched. Resolution is memoized so a
    // single request does at most one lookup. origin lets the adapter call the connectors same-origin.
    const origin = new URL(request.url).origin;
    let _sched = null;
    const scheduler = async () => (_sched ||= await resolveScheduler(env, email));

    if (op === "lookup") {
      // include the PRICE with each service so the Gui quotes real numbers and can close on the call.
      const priced = services.map((s) => ({ name: s.name, price: money(s.price_cents), price_cents: s.price_cents ?? null }));
      const spoken = priced.map((s) => (s.price ? `${s.name} — ${s.price}` : s.name)).join(", ");
      return json({
        services: services.map((s) => s.name), // back-compat: plain names
        priced,                                 // name + formatted price + raw cents
        locations: locations.map((l) => l.name),
        professionals: pros.map((p) => p.name),
        message: `We offer ${spoken || "our services"}${locations.length > 1 ? `, across ${locations.length} locations (${locations.map((l) => l.name).join(", ")})` : ""}.`,
      });
    }

    // PRICE — the Gui consults this BEFORE quoting a price on a call (so she never guesses). With a
    // `service` name → that one service's price; without → the whole tenant price list. Same SCHED-gated
    // biz_lookup already fetched above; no new gate.
    if (op === "price") {
      const only = pick(services, b.service);
      const rows = (only ? [only] : services).map((s) => ({ name: s.name, price: money(s.price_cents), price_cents: s.price_cents ?? null }));
      if (!rows.length) return json({ prices: [], message: diz("sem_precos", b.lang) });
      const spoken = rows.map((s) => (s.price ? `${s.name} is ${s.price}` : `${s.name} is priced on request`)).join("; ");
      return json({ prices: rows, message: `${spoken}.` });
    }

    // ADMIN: bulk-onboard a whole business from a JSON payload (operator/onboarding, not the agent)
    if (op === "import") {
      const r = await rpc(env, "biz_admin_import", { p_email: email, p_payload: b.payload || {} });
      return json(r);
    }

    // find a caller's upcoming appointment by their phone/email (for reschedule/cancel by voice)
    const findApptId = async () => {
      if (b.appointment_id) return b.appointment_id;
      if (!b.contact) return null;
      const f = await rpc(env, "biz_find_appointments", { p_email: email, p_contact: (b.contact || "").toString() });
      return (f.appointments || [])[0]?.id || null;
    };

    if (op === "points") {
      const r = await rpc(env, "biz_customer_points", { p_email: email, p_contact: (b.contact || "").toString() });
      return json({ points: r.points || 0, visits: r.visits || 0, message: pontosMsg(b.lang, r.points || 0, r.visits || 0) });
    }
    if (op === "find") {
      const f = await rpc(env, "biz_find_appointments", { p_email: email, p_contact: (b.contact || "").toString() });
      const appts = f.appointments || [];
      if (!appts.length) return json({ appointments: [], message: diz("sem_agendamentos", b.lang) });
      return json({ appointments: appts, message: encontreiMsg(b.lang, appts.slice(0, 3).map((a) => `${a.service} — ${fmt(a.start, bizTz, b.lang)}${comQuem(b.lang, a.pro)}`).join("; ")) });
    }

    // ops on an existing appointment (by id from this call, or looked up by the caller's contact)
    if (op === "confirm") {
      const r = await rpc(env, "biz_confirm", { p_email: email, p_appointment_id: b.appointment_id });
      return json({ ok: !!r.ok, message: r.ok ? "Confirmed — you're all set! Anything else?" : "I couldn't find that hold to confirm." });
    }
    if (op === "cancel") {
      const id = await findApptId();
      if (!id) return json({ message: diz("qual_telefone", b.lang) });
      const r = await rpc(env, "biz_cancel", { p_email: email, p_appointment_id: id });
      // Give reserved stock/capacity back to the shelf (no-op unless this booking consumed inventory).
      if (r.ok) { try { await rpc(env, "rpc_reserve_release_by_appt", { p_email: email, p_appointment_id: id }); } catch { /* best-effort */ } }
      if (r.ok) if (!testMode) await apptEmailOrFlag(env, email, "cancel", { contact: (b.contact || "").toString(), name: (b.name || "").toString(), lang: b.lang });
      // WAITLIST AUTO-FILL — the freed slot goes to the next person waiting for that service/location.
      // biz_waitlist_fill_on_cancel pops + marks them notified (dedup); we reach out by email now / WA
      // when approved. Best-effort: NEVER blocks the cancel; graceful no-op until the waitlist is pasted.
      if (r.ok && !testMode) {
        try {
          const w = await rpc(env, "biz_waitlist_fill_on_cancel", { p_email: email, p_appointment_id: id });
          if (w?.ok && w.filled && w.contact) {
            const wc = (w.contact || "").toString();
            if (isEmail(wc) && env.RESEND_API_KEY) {
              const { subject, html } = waitlistOfferEmail({ name: (w.name || "").toString(), business: "", service: (w.service || "").toString(), lang: b.lang, bizEmail: email });
              await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: wc, subject, html }) });
            } else if (/^[0-9+][0-9\s()\-]{6,}$/.test(wc)) {
              const ph = wc.replace(/[^0-9+]/g, "");
              const msg = `🌱 Guileo: uma vaga${w.service ? ` pra ${w.service}` : ""} acabou de abrir! Você estava na lista de espera — quer que eu reserve? É só responder.`.slice(0, 300);
              const wt = await sendText(env, ph, msg, { channel: "whatsapp" });
              if (!wt?.sent) {
                // The slot is already released and the waitlisted customer was picked — if the
                // offer never reached them, that slot just goes empty. Surface it so the owner
                // can call. Silence here = lost revenue nobody can see.
                try {
                  await svcRpc(env, "ingest_client_event", {
                    p_secret: env.INGEST_SECRET || "", p_email: email, p_type: "message", p_channel: "WhatsApp",
                    p_summary: `⚠️ Oferta de vaga da lista de espera NÃO chegou em ${ph} (${wt?.reason || `HTTP ${wt?.status || "?"}`}) — ligue pra oferecer`,
                    p_amount: 0, p_payload: { delivery: "failed", to: ph, kind: "waitlist_offer" },
                  });
                } catch { /* the cancel already succeeded */ }
              }
            }
          }
        } catch { /* waitlist fill is a bonus — the cancel already succeeded */ }
      }
      return json({ ok: !!r.ok, message: diz(r.ok ? "cancelado" : "nao_achei_cancelar", b.lang) });
    }
    if (op === "reschedule") {
      const when = (b.when || b.start || "").toString();
      const id = await findApptId();
      if (!id || !when) return json({ message: diz("telefone_e_horario", b.lang) });

      // MESMO DEFEITO DO BOOK, e aqui era pior: a frase falada ("amanhã às 3") ia CRUA para o
      // banco como se fosse um carimbo de data. Ou o Postgres recusava, ou — se o texto por acaso
      // fosse interpretável — o agendamento era MOVIDO PARA O DIA ERRADO e a pessoa só descobria
      // faltando. Remarcar nunca funcionou por telefone, e ninguém tinha percebido.
      // Agora resolvemos contra a agenda REAL do mesmo serviço, e só então movemos.
      const f = await rpc(env, "biz_find_appointments", { p_email: email, p_contact: (b.contact || "").toString() });
      const atual = (f.appointments || []).find((a) => a.id === id) || (f.appointments || [])[0] || null;
      const svcAtual = atual ? pick(services, atual.service) : null;
      let novoIso = when;
      if (svcAtual) {
        const av = await rpc(env, "biz_availability", { p_email: email, p_service_id: svcAtual.id, p_limit: 30 });
        const m = resolveSlot(when, av.slots || [], bizTz);
        if (!m) {
          const alts = (av.slots || []).slice(0, 3).map((s2) => fmt(s2.start, bizTz, b.lang)).join("; ");
          return json({ ok: false, slots: av.slots || [], message: alts ? `That time isn't open — I have ${alts}. Which works?` : `I couldn't find that time — want me to check another day?` });
        }
        novoIso = m.start;
      } else if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(when)) {
        // sem saber o serviço não dá pra resolver a fala — melhor perguntar que mover às cegas
        return json({ ok: false, message: (await logRecusa(env, email, op, "servico_nao_identificado", b.service || ""), diz("qual_servico", b.lang)) });
      }
      const r = await rpc(env, "biz_reschedule", { p_email: email, p_appointment_id: id, p_new_start: novoIso });
      if (r.ok) if (!testMode) await apptEmailOrFlag(env, email, "reschedule", { contact: (b.contact || "").toString(), name: (b.name || "").toString(), whenLabel: fmt(novoIso, bizTz), lang: b.lang });
      if (!r.ok && r.reason === "closed_date") return json({ ok: false, reason: "closed_date", message: closedMsg(b.lang, fmtDay(novoIso, bizTz, b.lang), r.note, "") });
      return json({ ok: !!r.ok, message: r.ok ? movidoMsg(b.lang, fmt(novoIso, bizTz, b.lang)) : diz(r.reason === "slot_taken" ? "novo_horario_ocupado" : "nao_movi", b.lang) });
    }

    // resolve names → records
    // SERVIÇO E UNIDADE SAEM JUNTOS (bizMatch.js). Separados, "corte no Upper East Side" perdia as
    // duas pontas: a unidade não casava com nome nenhum (null → busca em tudo → oferece Astoria) e
    // o serviço genérico ganhava do gêmeo da unidade certa. 14 ligações do Natura, 0 agendamentos.
    const { svc, loc, unidadesPossiveis } = resolveServicoLocal(services, locations, pros, b.service, b.location);
    const pro = pick(pros, b.professional || b.pro);
    if (!svc) return json({ message: servicoIndefinidoMsg(b.lang, services.map((s) => s.name).join(", ")) });

    // O SERVIÇO EXISTE EM MAIS DE UMA UNIDADE E NINGUÉM DISSE QUAL. Pergunte antes de procurar.
    // Sem isto o serviço escolhido carrega uma unidade escondida junto (o `Massage` do Natura é o
    // de Astoria), a busca só devolve horário de lá, e a outra unidade some da ligação — receita
    // que existe e nunca é oferecida. Não vale para `lookup` (é o cardápio, não uma escolha) nem
    // para as operações que já trabalham sobre um agendamento existente.
    if (unidadesPossiveis.length > 1 && (op === "availability" || op === "book" || op === "recurring")) {
      await logRecusa(env, email, op, "unidade_ambigua", unidadesPossiveis.map((u) => u.name).join("|"));
      return json({ ok: false, reason: "unidade_ambigua", locations: unidadesPossiveis,
        message: qualUnidadeMsg(b.lang, svc.name, unidadesPossiveis) });
    }

    if (op === "availability") {
      // EXTERNAL FIRST (golden rule): if the tenant has a connected+ready external calendar, its
      // free slots are the real truth. handled:false (no external / external down / unmappable) →
      // fall straight through to the internal engine below, IDENTICAL to before.
      const sc = await scheduler();
      if (sc.provider !== "internal") {
        const ext = await adapterAvailability(env, email, sc, { origin, service: svc.name, location_id: loc?.id || null, professional_id: pro?.id || null });
        if (ext.handled) {
          const slots = ext.slots || [];
          if (!slots.length) return json({ message: semVagaMsg(b.lang, svc.name, loc ? emOnde(b.lang, loc.name) : ""), slots: [], source: sc.provider });
          const human = slots.slice(0, 4).map((s) => `${fmt(s.start, bizTz, b.lang)}${comQuem(b.lang, s.pro)}`).join("; ");
          return json({ slots, source: sc.provider, message: opcoesMsg(b.lang, svc.name, loc ? emOnde(b.lang, loc.name) : "", human) });
        }
      }
      const av = await rpc(env, "biz_availability", {
        p_email: email, p_service_id: svc.id, p_location_id: loc?.id || null, p_pro_id: pro?.id || null, p_limit: 6,
      });
      const slots = (av.slots || []).map((s) => ({ start: s.start, pro: s.pro, location: s.location }));
      if (!slots.length) return json({ message: semVagaMsg(b.lang, svc.name, loc ? emOnde(b.lang, loc.name) : ""), slots: [] });
      const human = slots.slice(0, 4).map((s) => `${fmt(s.start, bizTz, b.lang)}${comQuem(b.lang, s.pro)}${loc ? "" : emOnde(b.lang, s.location)}`).join("; ");
      return json({ slots, message: opcoesMsg(b.lang, svc.name, loc ? emOnde(b.lang, loc.name) : "", human) });
    }

    if (op === "book") {
      // O CONTATO PRECISA PODER SER CHAMADO DE VOLTA (ver lib/contato.js).
      // ← GUI-42F0, o PRIMEIRO agendamento real da plataforma: gravado com "929-535-191", nove
      //   dígitos, um zero perdido de ouvido. Horário reservado e o spa sem como avisar ninguém.
      // Só recusa quando o contato VEIO e está quebrado — contato vazio segue o caminho de antes,
      // porque endurecer isso agora bloquearia reservas que hoje funcionam, e a regra do dia é
      // não trocar um problema por outro. Devolve uma pergunta, não um erro: a pessoa está na
      // linha AGORA, e este é o único momento em que consertar o número é de graça.
      const contatoBruto = (b.contact || "").toString().trim();
      if (contatoBruto) {
        const av = avaliarContato(contatoBruto);
        if (!av.ok) {
          await logRecusa(env, email, op, `contato_invalido:${av.motivo || av.tipo}`, contatoBruto);
          return json({ ok: false, reason: "contato_invalido", message: pedirContatoMsg(b.lang, av.tipo) });
        }
      }
      // EXTERNAL FIRST (golden rule): if a connected+ready external calendar owns this tenant, WRITE
      // the booking there (the salon's real system) — the adapter mirrors it into biz_appointments for
      // the cockpit. handled:false → external down/unmappable → fall through to the internal engine,
      // byte-for-byte as before. handled+!ok → external REJECTED (slot taken); we do NOT then book
      // internally (that would double-book against the source of truth).
      const scB = await scheduler();
      if (scB.provider !== "internal") {
        const startX = (b.when || b.start || "").toString();
        if (!startX) return json({ message: (await logRecusa(env, email, op, "sem_dia_nem_hora", b.when || b.start || ""), diz("qual_dia_e_hora", b.lang)) });
        const ext = await adapterBook(env, email, scB, {
          origin, service: svc.name, start: startX,
          name: (b.name || "").toString(), contact: (b.contact || "").toString(),
          professional_id: b.staff_id || b.provider_staff_id || null,
          location_id: b.location_id || b.provider_location_id || null,
          duration_min: svc.duration_min || 60,
          mirror: { pro: pro?.name || "", location: loc?.name || "" },
        });
        if (ext.handled && ext.ok) {
          const refTxt = refMsg(b.lang, ext.external_ref);
          if (!testMode) {
            // Same customer-facing confirmation + owner alert + CRM as the internal path. No gcalPush:
            // the external calendar IS the tenant's system of record, so there's nothing to mirror to Google.
            await apptEmailOrFlag(env, email, "book", { contact: (b.contact || "").toString(), name: (b.name || "").toString(), service: svc.name, whenLabel: fmt(startX, bizTz), pro: pro?.name || "", location: loc?.name || "", address: loc?.address || "", locPhone: loc?.phone || "", ref: ext.external_ref, lang: b.lang });
            if (env.RESEND_API_KEY && email.includes("@")) {
              try {
                const { subject, html } = ownerAlertEmail({ kind: "booking", customer: (b.name || "").toString(), details: `${svc.name}${pro?.name ? ` · ${pro.name}` : ""}${loc?.name ? ` · ${loc.name}` : ""} · via ${scB.provider}`, when: fmt(startX, bizTz), lang: b.lang });
                await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: email, subject, html }) });
              } catch { /* best-effort */ }
            }
            await rpc(env, "biz_customer_touch", { p_email: email, p_contact: (b.contact || "").toString(), p_name: (b.name || "").toString(), p_points: 10, p_visit: true });
            try {
              const c = (b.contact || "").toString(); const isEm = /.+@.+\..+/.test(c);
              const ur = await svcRpc(env, "crm_upsert_contact", { p_secret: env.SCHED_SECRET || "", p_email: email, p_phone: isEm ? "" : c, p_contact_email: isEm ? c : "", p_name: (b.name || "").toString(), p_source: `gui:book:${scB.provider}`, p_amount_cents: 0 });
              const cid = ur.ok ? await ur.json().catch(() => null) : null;
              if (typeof cid === "string" && cid) {
                await rpc(env, "crm_log_event", { p_email: email, p_contact_id: cid, p_type: "booking", p_channel: "Phone", p_summary: `Booked ${svc.name} for ${fmt(startX, bizTz)} (via ${scB.provider})`.slice(0, 400), p_amount_cents: Math.max(0, svc.price_cents || 0), p_dedupe: `book:${scB.provider}:${ext.external_ref || startX}`, p_payload: { ref: ext.external_ref || "", source: scB.provider } });
                await rpc(env, "crm_deal_upsert", { p_email: email, p_contact_id: cid, p_title: `${svc.name}`.slice(0, 80), p_value_cents: Math.max(0, svc.price_cents || 0), p_stage: "booked", p_source: `gui-${scB.provider}` });
              }
            } catch { /* CRM best-effort */ }
          }
          return json({ ok: true, source: scB.provider, ref: ext.external_ref, external_ref: ext.external_ref, message: confirmadoMsg(b.lang, { servico: svc.name, quando: fmt(startX, bizTz, b.lang), segurado: false, refTxt }) });
        }
        if (ext.handled && ext.ok === false) {
          // External is the truth — we do NOT internal-book on top of it. Two honest cases:
          //  • needsFrontdesk: we couldn't map/reach the external → capture + front desk confirms
          //    (NEVER book blind — that's the double-book the audit caught).
          //  • otherwise: the external rejected the slot (taken) → offer the next opening.
          if (ext.needsFrontdesk) {
            // ⚠️ ESTE ERA O ÚNICO DESFECHO SEM RASTRO — e por isso o mais caro de diagnosticar.
            // A trilha da ligação do Luis (16/08) mostrava `book → chamada` e MAIS NADA: nem OK,
            // nem RECUSA. Sem o motivo escrito, "não agendou" vira adivinhação, e eu quase culpei
            // o comportamento da agente por uma frase que sai daqui, do nosso próprio código.
            await logRecusa(env, email, op, `externo_nao_confirmou:${scB.provider}`, b.when || b.start || "");
            return json({ ok: false, source: scB.provider, captured: true, message: anotadoMsg(b.lang, svc.name, fmt(startX, bizTz, b.lang)) });
          }
          return json({ ok: false, source: scB.provider, message: (await logRecusa(env, email, op, "horario_tomado_na_hora", b.when || b.start || ""), diz("acabou_de_sair", b.lang)) });
        }
        // ext.handled === false → external unreachable/unmappable → internal engine takes over below.
      }
      // resolve the pro: explicit, else the one free at that time from a fresh availability check
      let proId = pro?.id || null, locId = loc?.id || null, startIso = (b.when || b.start || "").toString();
      if (!startIso) return json({ message: (await logRecusa(env, email, op, "sem_dia_nem_hora", b.when || b.start || ""), diz("qual_dia_e_hora", b.lang)) });
      // O HORÁRIO SEMPRE PRECISA SER RESOLVIDO. Antes isto só rodava quando o profissional era
      // desconhecido — e no dia em que o profissional passou a ser escolhido sozinho (negócio com
      // um profissional só), a resolução foi PULADA e a frase falada ("amanhã às 10") seguiria
      // crua para o banco como se fosse um carimbo de data. O que a pessoa fala nunca é um
      // timestamp; resolver não é opcional.
      {
        const av = await rpc(env, "biz_availability", { p_email: email, p_service_id: svc.id, p_location_id: locId, p_limit: 30 });
        // A agente fala como gente ("amanhã às 9") — a ferramenta pede isso na própria descrição.
        // O código antigo fazia Date.parse desse texto e comparava com o instante do slot. Duas
        // formas de falhar, as duas silenciosas: NaN (nunca casa) ou uma data INVENTADA
        // (Date.parse("amanhã às 9") = 2001-09-01). Por isso NENHUM cliente conseguia marcar por
        // telefone — a agente tentava 5 vezes e escalava, com a agenda vazia do outro lado.
        // resolveSlot só devolve um horário que ESTÁ nesta lista; na dúvida devolve null e a
        // agente oferece as opções reais. Ver functions/lib/slotResolver.test.mjs.
        const match = resolveSlot(startIso, av.slots || [], bizTz);
        if (!match) {
          const alts = (av.slots || []).slice(0, 3).map((s) => `${fmt(s.start, bizTz, b.lang)}${comQuem(b.lang, s.pro)}`).join("; ");
          // SPECIAL DATES: if the requested day is closed (vacation/holiday), say WHY — not just "taken".
          const sp = await specialFor(env, email, startIso, bizTz);
          if (sp) return json({ ok: false, reason: "closed_date", slots: av.slots || [], message: closedMsg(b.lang, fmtDay(startIso, bizTz, b.lang), sp.note, alts) });
          // O MOTIVO DA RECUSA TEM QUE SER VERDADE. Antes, QUALQUER falha em resolver o horário
          // respondia "esse horário não está mais livre" — inclusive quando a pessoa não tinha
          // dito horário nenhum ("quero marcar"). A Gui inventava um fato para justificar uma
          // recusa correta, e quem ligou percebe na hora que não foi escutado. Agora: se ela não
          // disse dia nem hora, perguntamos; se disse e não dá, aí sim oferecemos alternativas.
          const disse = oQueAPessoaDisse(startIso, bizTz, av.slots || []);
          if (!disse.disse_dia && !disse.disse_hora) {
            await logRecusa(env, email, "book", "sem_dia_nem_hora", startIso);
            return json({ ok: false, reason: "sem_horario_pedido", slots: av.slots || [],
              message: semHorarioMsg(b.lang, alts) });
          }
          // Distinguir os dois é o que transforma o log em diagnóstico: "pediu horário que não
          // existe na agenda" e "pediu horário que existe mas está ocupado" pedem consertos
          // diferentes — um é expediente/serviço mal cadastrado, o outro é agenda cheia.
          await logRecusa(env, email, "book", (av.slots || []).length ? "horario_pedido_indisponivel" : "sem_vaga_nenhuma", startIso);
          return json({ ok: false, slots: av.slots || [], message: ocupadoMsg(b.lang, alts) });
        }
        // o profissional/local explícito continua valendo; o horário vem sempre do slot real
        proId = proId || match.pro_id; locId = locId || match.location_id; startIso = match.start;
      }
      // capture per-vertical attributes the agent collected (party size, address, intake notes, etc.)
      const attrs = {};
      if (b.party_size) attrs.party_size = b.party_size;
      if (b.address) attrs.address = (b.address || "").toString();
      if (b.notes || b.intake) attrs.notes = (b.notes || b.intake || "").toString();
      if (b.attributes && typeof b.attributes === "object") Object.assign(attrs, b.attributes);
      // ── DRY-RUN (eval harness) — the availability check above already resolved a real free slot (or
      // returned "not available" for a taken one). Report the WOULD-book decision with NO commit: no
      // reserve, no biz_book, no email. Same resolution code the live path runs → the golden set proves
      // Gui won't double-book a taken slot or book an 86'd service before it can hurt a real tenant.
      if (b.dry_run === true || b.dryRun === true) {
        return json({ ok: true, dry_run: true, decision: {
          would_book: true, service: svc.name, service_id: svc.id,
          price_cents: (svc.price_cents ?? svc.price ?? null), slot: startIso,
          pro_id: proId, location_id: locId, reason_code: "slot_available",
        } });
      }

      // ── ATOMIC RESERVE (Action Integrity) ────────────────────────────────────────────────────────
      // If this service consumes physical inventory (item_skus) or a finite resource (resource_kind),
      // reserve stock+capacity ATOMICALLY before we commit the booking — so two callers can't both grab
      // the last unit under concurrency. Idempotent by (tenant, ref). Gated on those fields being
      // present, so ordinary appointment traffic (which sends neither) is completely unaffected.
      // Idempotency ref for BOTH the atomic reserve and bookIdem. It must distinguish two different
      // parties booking the same service+slot, or the 2nd caller gets the 1st's cached ok:true with no
      // stock decrement (overbook). Contact is the natural party key; when absent, fall back to the name
      // then an agent-supplied request id so contactless bookings that DO have a name no longer collide.
      // Never null (a null-ref reserve leaves no row to release on book failure) — the all-empty case
      // keeps the prior deterministic key, which is retry-safe and release-safe; the residual collision
      // needs anonymous + stock-consuming + same slot + two parties, and biz_book's EXCLUDE still blocks
      // the actual slot double-book. Real fix for the common contactless path; edge stays bounded.
      const _party = (b.contact || "").toString().trim()
        || (b.name || "").toString().trim()
        || (b.request_id || b.idempotency_key || "").toString().trim();
      const reserveRef = `${email}:${_party}:${svc.id}:${startIso}`;
      const skus = Array.isArray(b.item_skus) ? b.item_skus.map((s) => (s || "").toString()).filter(Boolean) : [];
      const needsReserve = skus.length > 0 || !!b.resource_kind;
      if (needsReserve) {
        const rv = await rpc(env, "rpc_reserve_atomic", {
          p_email: email, p_contact_id: null, p_service_id: svc.id,
          p_slot_start: startIso, p_slot_end: (b.slot_end || b.end || null),
          p_units: Number(b.party_size) > 0 ? Number(b.party_size) : 1,
          p_item_skus: skus, p_ref: reserveRef,
        });
        const rvj = rv && rv.ok !== false ? rv : null;
        if (!rvj || rvj.ok === false) {
          const reason = rvj?.reason || rv?.reason;
          if (reason === "out_of_stock") return json({ ok: false, reason, message: b.lang === "pt" ? "Esse item esgotou pra esse horário — quer que eu veja uma alternativa?" : b.lang === "es" ? "Ese artículo se agotó para ese horario — ¿busco una alternativa?" : "That item just sold out for this slot — want me to find an alternative?" });
          if (reason === "no_capacity") return json({ ok: false, reason, message: b.lang === "pt" ? "Esse horário lotou — tenho outros bem pertinho, quer ver?" : b.lang === "es" ? "Ese horario se llenó — tengo otros cerquita, ¿los ves?" : "That slot just filled up — I have others close by, want to see them?" });
          // RPC unreachable (SQL not pasted) → don't block the booking; proceed as before (honest degrade).
        }
      }
      let res;
      try {
        res = await bookIdem(env, {
          p_email: email, p_pro_id: proId, p_location_id: locId, p_service_id: svc.id,
          p_name: (b.name || "").toString(), p_contact: (b.contact || "").toString(), p_start: startIso,
          p_attributes: attrs, p_hold_min: b.hold ? 5 : null,
        }, reserveRef);
      } catch (bookErr) {
        // bookIdem THREW (e.g. Supabase unreachable) → the reserved stock would be orphaned with no
        // appointment. Give it back before propagating, so a slot never reads out-of-stock forever.
        if (needsReserve) { try { await rpc(env, "rpc_reserve_release", { p_email: email, p_ref: reserveRef }); } catch { /* best-effort */ } }
        throw bookErr;
      }
      // If we reserved stock but the booking itself failed, release the reservation so it isn't orphaned.
      if (needsReserve && !res?.ok) {
        try { await rpc(env, "rpc_reserve_release", { p_email: email, p_ref: reserveRef }); } catch { /* best-effort */ }
      }
      // Booking committed AND consumed stock → tie the reservation to the appointment so a later
      // cancel/no-show can give the stock back (rpc_reserve_release_by_appt). Best-effort, never blocks.
      if (needsReserve && res?.ok && res.appointment_id) {
        try { await rpc(env, "ops_reservation_link", { p_email: email, p_ref: reserveRef, p_appointment_id: res.appointment_id }); } catch { /* best-effort */ }
      }

      // ── O ELO EXATO LIGAÇÃO → AGENDAMENTO (2026-08-12) ───────────────────────────────────────
      // Fecha o último item aberto do motor de agente (JORNADA.md): «não existe elo exato
      // ligação→agendamento… enquanto não houver, 'resultado confirmado' só afirma dinheiro».
      // Amarrar por telefone + janela de tempo foi recusado com razão — no dia em que duas ligações
      // do mesmo número acontecem perto, casa a pessoa errada, e num negócio movimentado isso é
      // terça-feira. O elo verdadeiro é o id da conversa, que só o provedor sabe.
      //
      // DEPOIS do book, best-effort e fail-soft, EXATAMENTE como o ops_reservation_link acima: se
      // esta escrita falhar, o cliente segue agendado e só o relatório fica sem o elo. A falha cai
      // no lado barato — nunca no lado do dinheiro.
      // O `call_booking_link` RECUSA id fora do formato `conv_…`: se a ElevenLabs não substituir o
      // placeholder, chega a string literal e a RPC devolve `ligado:false`. Elo falso é pior que
      // elo nenhum — ele afirma com confiança que aquela ligação gerou aquele agendamento.
      const convId = (request.headers.get("x-guileo-conv") || b.conversation_id || "").toString().trim();
      if (res?.ok && res.appointment_id && convId) {
        try {
          await rpc(env, "call_booking_link", { p_email: email, p_conv: convId, p_appointment: res.appointment_id });
        } catch { /* best-effort — o agendamento já está feito */ }
      }
      // ── NUNCA DIZER "AGENDADO" SEM AGENDAMENTO ───────────────────────────────────────────────
      // Em 2026-08-07 a prova de ciclo capturou a resposta crua:
      //   {"ok":true,"appointment_id":null,"ref":null,"message":"Done — booked for Fri, Aug 7…"}
      // ok=true, agendamento NULO, e a agente dizia "pronto". A pessoa desliga confiando, aparece
      // no dia e não existe nada — é o dano máximo que este produto pode causar a um cliente.
      // Um "ok" sem id não é sucesso: é uma promessa sem lastro. Aqui isso vira falha explícita.
      if (res?.ok && !res.appointment_id && res.status !== "hold") {
        await emitFailure(env, "book_sem_id", email, "biz_book devolveu ok sem appointment_id — marcação NÃO confirmada ao cliente", { slot: startIso, service: svc?.name || "" }).catch(() => {});
        return json({ ok: false, reason: "book_unconfirmed",
          message: b.lang === "pt" ? "Não consegui confirmar essa reserva agora — prefiro não te garantir um horário que não ficou de pé. Posso pedir para alguém da equipe te confirmar em minutos?"
            : b.lang === "es" ? "No pude confirmar esa reserva ahora — prefiero no prometerle un horario que no quedó. ¿Puedo pedir que alguien del equipo se lo confirme en minutos?"
            : "I couldn't confirm that booking just now — I'd rather not promise you a time that didn't hold. Can I have someone from the team confirm it with you in a few minutes?" });
      }
      if (res?.ok) {
        const held = res.status === "hold" ? seguradoMsg(b.lang) : "";
        const refTxt = refMsg(b.lang, res.ref);
        // send the branded confirmation (email now if they gave an email; SMS lights up once A2P clears)
        if (res.status !== "hold") {
          if (!testMode) await apptEmailOrFlag(env, email, "book", { contact: (b.contact || "").toString(), name: (b.name || "").toString(), service: svc.name, whenLabel: fmt(startIso, bizTz), pro: pro?.name || "", location: loc?.name || "", address: loc?.address || "", locPhone: loc?.phone || "", ref: res.ref, lang: b.lang });
          // OWNER ALERT — ping the business owner (tenant) the instant a booking comes in, so they
          // don't have to watch the cockpit. Best-effort; tenant is pinned server-side.
          if (!testMode && env.RESEND_API_KEY && email.includes("@")) {
            try {
              const { subject, html } = ownerAlertEmail({ kind: "booking", customer: (b.name || "").toString(), details: `${svc.name}${pro?.name ? ` · ${pro.name}` : ""}${loc?.name ? ` · ${loc.name}` : ""}`, when: fmt(startIso, bizTz), lang: b.lang });
              await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: email, subject, html }) });
            } catch { /* best-effort — never block the booking */ }
          }
          // OWNER TEXT — instant if they set an alert phone (db/notify_phone.sql). Prefers WhatsApp
          // when TWILIO_WHATSAPP_FROM is approved (no A2P needed); sendText falls back to SMS. Graceful.
          if (!testMode && env.INGEST_SECRET) {
            try {
              // client_notify_phone_lookup is INGEST-gated. Call PostgREST DIRECTLY with INGEST_SECRET —
              // the rpc() helper force-injects SCHED_SECRET, which this RPC rejects (unauthorized swallowed
              // → the owner never got the booking alert). Same direct pattern as agent-action.js.
              const pr = await fetch(`${SB}/rest/v1/rpc/client_notify_phone_lookup`, {
                method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
                body: JSON.stringify({ p_secret: env.INGEST_SECRET, p_email: email }),
              });
              const ph = pr.ok ? ((await pr.json()) || "").toString() : "";
              if (/^[0-9+]{8,}$/.test(ph)) await sendOrFlag(env, { to: ph, body: `🔔 Guileo: nova reserva — ${(b.name || "cliente").toString()} · ${svc.name} · ${fmt(startIso, bizTz)}. guileoai.com/portal`.slice(0, 300), opts: { channel: "whatsapp" }, tenant: email, motivo: "aviso de nova reserva ao dono" });
            } catch { /* text best-effort */ }
          }
          // GOOGLE CALENDAR — drop the booking into the owner's Google Calendar if they connected it
          // (gcal-connect). This is the MindBody-free path: the spa sees the appointment in Google.
          if (!testMode) await gcalPush(env, email, {
            summary: `${svc.name} — ${(b.name || "cliente").toString()}`,
            description: `Booked by Gui${pro?.name ? ` · ${pro.name}` : ""}${res.ref ? ` · ref ${res.ref}` : ""}. Contact: ${(b.contact || "").toString()}`,
            location: (loc?.address || loc?.name || "").toString(), startIso, durationMin: svc.duration_min || 60, tz: bizTz,
          });
          // #5 — record the customer + award loyalty points (best-effort)
          await rpc(env, "biz_customer_touch", { p_email: email, p_contact: (b.contact || "").toString(), p_name: (b.name || "").toString(), p_points: 10, p_visit: true });
          // CRM SPINE (Company OS) — every booking builds the contact + a 360° timeline event + a "booked" deal.
          // Best-effort + graceful: no-op until crm_spine.sql / crm_phase2.sql are pasted; never blocks the booking.
          try {
            const c = (b.contact || "").toString();
            const isEm = /.+@.+\..+/.test(c);
            const ur = await svcRpc(env, "crm_upsert_contact", { p_secret: env.SCHED_SECRET || "", p_email: email, p_phone: isEm ? "" : c, p_contact_email: isEm ? c : "", p_name: (b.name || "").toString(), p_source: "gui:book", p_amount_cents: 0 });
            const cid = ur.ok ? await ur.json().catch(() => null) : null;
            if (typeof cid === "string" && cid) {
              await rpc(env, "crm_log_event", { p_email: email, p_contact_id: cid, p_type: "booking", p_channel: "Phone", p_summary: `Booked ${svc.name} for ${fmt(startIso, bizTz)}`.slice(0, 400), p_amount_cents: Math.max(0, svc.price_cents || 0), p_dedupe: `book:${res.appointment_id}`, p_payload: { ref: res.ref || "" } });
              await rpc(env, "crm_deal_upsert", { p_email: email, p_contact_id: cid, p_title: `${svc.name}`.slice(0, 80), p_value_cents: Math.max(0, svc.price_cents || 0), p_stage: "booked", p_source: "gui-schedule" });
            }
          } catch { /* CRM not live yet → never block the booking */ }
        }
        // desfecho REAL da reserva na trilha — é o registro que faltava pra saber se a
        // ligação virou agendamento ou morreu no caminho.
        await logTool(env, email, "book", "OK", `${svc.name} · ${fmt(startIso, bizTz)} · ref ${res.ref || "—"}`);
        return json({ ok: true, appointment_id: res.appointment_id, ref: res.ref, status: res.status, message: confirmadoMsg(b.lang, { servico: svc.name, quando: fmt(startIso, bizTz, b.lang), segurado: res.status === "hold", refTxt, extra: held }) });
      }
      if (res?.reason === "slot_taken") return json({ ok: false, message: (await logRecusa(env, email, op, "horario_tomado_na_hora", b.when || b.start || ""), diz("acabou_de_sair", b.lang)) });
      // SPECIAL DATES: the DB guard (db/special_dates.sql) rejected a closed/reduced day —
      // tell the caller warmly WHY + the nearest open slot (one cheap availability call).
      if (res?.reason === "closed_date") {
        let alts = "";
        try {
          const av2 = await rpc(env, "biz_availability", { p_email: email, p_service_id: svc.id, p_location_id: locId, p_limit: 3 });
          alts = (av2.slots || []).slice(0, 3).map((s) => `${fmt(s.start, bizTz, b.lang)}${comQuem(b.lang, s.pro)}`).join("; ");
        } catch { /* alts are a bonus — the closed message stands alone */ }
        return json({ ok: false, reason: "closed_date", message: closedMsg(b.lang, fmtDay(startIso, bizTz, b.lang), res.note, alts) });
      }
      return json({ ok: false, message: (await logRecusa(env, email, op, "reserva_nao_travou", b.when || b.start || ""), diz("nao_consegui_travar", b.lang)) });
    }

    // #10 — add to the waitlist (auto-offered when a slot frees up)
    if (op === "waitlist") {
      const r = await rpc(env, "biz_waitlist_add", { p_email: email, p_service_id: svc.id, p_location_id: loc?.id || null, p_contact: (b.contact || "").toString(), p_name: (b.name || "").toString() });
      return json({ ok: !!r.ok, message: r.ok ? `You're on the waitlist for ${svc.name}${loc ? ` at ${loc.name}` : ""} — I'll reach out the moment a spot opens. Anything else?` : `I couldn't add you to the waitlist just now.` });
    }

    // #4 — recurring booking: book the same weekly slot for N weeks
    if (op === "recurring") {
      const weeks = Math.min(Math.max(parseInt(b.weeks || "4", 10) || 4, 1), 12);
      let startIso = (b.when || b.start || "").toString();
      if (!startIso) return json({ message: diz("inicio_recorrente", b.lang) });
      // resolve a pro for the first slot
      let proId = pro?.id || null, locId = loc?.id || null;
      if (!proId) {
        const av = await rpc(env, "biz_availability", { p_email: email, p_service_id: svc.id, p_location_id: locId, p_limit: 30 });
        // MESMO conserto do book (ver slotResolver.js) — e aqui o antigo era ainda pior: quando o
        // horário não casava, ele caía em `|| slots[0]` e marcava o PRIMEIRO livre em silêncio.
        // Quem pediu "terça às 18h" saía com 12 semanas marcadas no horário errado, sem aviso.
        // Marcar errado calado é pior que não marcar: agora recusa e oferece as opções reais.
        const m = resolveSlot(startIso, av.slots || [], bizTz);
        if (!m) {
          const alts = (av.slots || []).slice(0, 3).map((s2) => fmt(s2.start, bizTz, b.lang)).join("; ");
          return json({ ok: false, slots: av.slots || [], message: alts ? `I couldn't find that exact time — I have ${alts}. Which works?` : `I couldn't find that time — want me to check another day?` });
        }
        proId = m.pro_id; locId = m.location_id; startIso = m.start;
      }
      const base = new Date(startIso);
      // Cinto de segurança: startIso aqui SEMPRE vem de um slot real do motor. Se algum dia
      // deixar de vir, `new Date` daria Invalid Date e a série inteira sairia como NaN.
      if (Number.isNaN(base.getTime())) return json({ ok: false, message: diz("nao_entendi_inicio", b.lang) });
      const booked = [];
      for (let i = 0; i < weeks; i++) {
        const when = new Date(base.getTime() + i * 7 * 86400000).toISOString();
        const r = await bookIdem(env, { p_email: email, p_pro_id: proId, p_location_id: locId, p_service_id: svc.id, p_name: (b.name || "").toString(), p_contact: (b.contact || "").toString(), p_start: when }, `${email}:${(b.contact || "").toString()}:${svc.id}:${when}`);
        if (r.ok) booked.push(fmt(when, bizTz));
      }
      if (booked.length) await rpc(env, "biz_customer_touch", { p_email: email, p_contact: (b.contact || "").toString(), p_name: (b.name || "").toString(), p_points: 10 * booked.length, p_visit: true });
      return json({ ok: booked.length > 0, booked: booked.length, message: booked.length ? `Set up ${booked.length} weekly ${svc.name} appointments, starting ${booked[0]}. You'll get a confirmation. Anything else?` : `I couldn't set up the recurring appointment — let me try another time.` });
    }

    return json({ message: "Unknown scheduling request." });
  } catch {
    return json({ message: diz("soluco", b.lang) }, 200);
  }
}

// ── SPECIAL DATES (cockpit) — the owner manages vacation/holiday/reduced-hours days.
// PER-TENANT GATE: bind the cockpit email to its connection key via get_client_data (rejects a
// mismatch) — copied from noshow-radar.js. SCHED_SECRET stays server-side. Graceful ready:false
// until db/special_dates.sql is pasted in Supabase.
async function specialDates(env, b, action) {
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
  const notReady = { ok: true, ready: false, note: "Paste db/special_dates.sql in Supabase to activate special dates.", dates: [] };

  if (action === "special_set") {
    const date = (b.date || "").toString().trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: "bad date" }, 400);
    const closed = b.closed !== false; // default: closed all day
    const mins = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 && n <= 1440 ? n : null; };
    const r = await fetch(`${SB}/rest/v1/rpc/biz_set_special_date`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_secret: env.SCHED_SECRET || "", p_email: email, p_date: date,
        p_closed: closed, p_open_min: closed ? null : mins(b.open_min), p_close_min: closed ? null : mins(b.close_min),
        p_note: (b.note || "").toString().slice(0, 160), p_remove: b.remove === true,
      }),
    });
    if (!r.ok) return json(notReady); // RPC not pasted yet → honest note, never a 500
    const rj = await r.json().catch(() => ({}));
    return json({ ok: rj?.ok === true, ready: true, reason: rj?.reason || null });
  }
  // special_list
  const r = await fetch(`${SB}/rest/v1/rpc/biz_list_special_dates`, {
    method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: env.SCHED_SECRET || "", p_email: email, p_days: 365 }),
  });
  if (!r.ok) return json(notReady);
  const rj = await r.json().catch(() => ({}));
  return json({ ok: true, ready: true, dates: Array.isArray(rj?.dates) ? rj.dates : [] });
}

// ── LOCATIONS (cockpit) — the owner adds/edits/deactivates business units (multi-location).
// PER-TENANT GATE: identical to specialDates above (email + connection key via get_client_data;
// SCHED_SECRET stays server-side). Graceful ready:false until db/multi_location.sql is pasted.
async function locActions(env, b, action) {
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
  const notReady = { ok: true, ready: false, note: "Paste db/multi_location.sql in Supabase to activate location management.", locations: [] };

  if (action === "loc_set") {
    const name = (b.name || "").toString().trim().slice(0, 80);
    const id = (b.id || "").toString().trim();
    if (!id && !name) return json({ error: "name required" }, 400);
    const r = await fetch(`${SB}/rest/v1/rpc/biz_location_set`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_secret: env.SCHED_SECRET || "", p_email: email, p_id: id || null,
        p_name: name || null, p_address: (b.address || "").toString().slice(0, 160) || null,
        p_city: (b.city || "").toString().slice(0, 80) || null, p_phone: (b.phone || "").toString().slice(0, 40) || null,
        p_tz: (b.tz || "").toString().slice(0, 64) || null,
        p_active: typeof b.active === "boolean" ? b.active : null,
      }),
    });
    if (!r.ok) return json(notReady); // RPC not pasted yet → honest note, never a 500
    const rj = await r.json().catch(() => ({}));
    return json({ ok: rj?.ok === true, ready: true, id: rj?.id || null, reason: rj?.reason || null });
  }
  // loc_list
  const r = await fetch(`${SB}/rest/v1/rpc/biz_locations_admin_list`, {
    method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: env.SCHED_SECRET || "", p_email: email }),
  });
  if (!r.ok) return json(notReady);
  const rj = await r.json().catch(() => ({}));
  return json({ ok: true, ready: true, locations: Array.isArray(rj?.locations) ? rj.locations : [] });
}

// Is the requested start on a closed special date? (agent path; cheap + graceful: null until SQL pasted)
async function specialFor(env, email, iso, tz) {
  try {
    const day = new Date(iso).toLocaleDateString("en-CA", { timeZone: tz || "America/New_York" }); // YYYY-MM-DD
    const r = await rpc(env, "biz_list_special_dates", { p_email: email, p_days: 365 });
    return (r?.dates || []).find((d) => d.date === day && d.closed) || null;
  } catch { return null; }
}

// The agent-speakable "we're closed that day" line — in the caller's language (en/pt/es/hi).
function closedMsg(lang, dateLabel, note, alts) {
  const n = note ? ` — ${note}` : "";
  const L = (lang || "en").toString().slice(0, 2);
  if (L === "pt") return `Estamos fechados em ${dateLabel}${n}.${alts ? ` O horário livre mais próximo é ${alts}. Algum desses funciona?` : " Qual outro dia funciona pra você?"}`;
  if (L === "es") return `Estamos cerrados el ${dateLabel}${n}.${alts ? ` El horario libre más cercano es ${alts}. ¿Le sirve alguno?` : " ¿Qué otro día le viene bien?"}`;
  if (L === "hi") return `${dateLabel} को हम बंद हैं${n}।${alts ? ` सबसे नज़दीकी खुला समय है ${alts}। क्या इनमें से कोई ठीक रहेगा?` : " कौन सा दूसरा दिन आपके लिए ठीक रहेगा?"}`;
  return `We're closed on ${dateLabel}${n}.${alts ? ` The nearest open slot is ${alts}. Would one of those work?` : " What other day works for you?"}`;
}

// Conectores da fala. Sem eles a frase fica "9:30 AM with Ana" dentro de um português perfeito.
const L2 = (lang) => (lang || "en").toString().slice(0, 2);
const comQuem = (lang, pro) => (!pro ? "" : ({ pt: ` com ${pro}`, es: ` con ${pro}`, hi: ` ${pro} के साथ` }[L2(lang)] || ` with ${pro}`));
const emOnde = (lang, loc) => (!loc ? "" : ({ pt: ` em ${loc}`, es: ` en ${loc}`, hi: ` ${loc} में` }[L2(lang)] || ` at ${loc}`));

// A CONFIRMAÇÃO — a frase mais importante da ligação inteira. É o que a pessoa leva embora.
function confirmadoMsg(lang, { servico, quando, segurado, refTxt, extra }) {
  const L = L2(lang);
  const r = refTxt || "", ex = extra || "";
  if (L === "pt") return `Pronto — ${servico} ${segurado ? "reservado" : "agendado"} para ${quando}${ex}.${r} Você vai receber a confirmação. Mais alguma coisa?`;
  if (L === "es") return `Listo — ${servico} ${segurado ? "reservado" : "agendado"} para ${quando}${ex}.${r} Le llegará la confirmación. ¿Algo más?`;
  if (L === "hi") return `हो गया — ${servico} ${quando} के लिए ${segurado ? "रोक दिया" : "बुक कर दिया"}${ex}।${r} आपको पुष्टि मिल जाएगी। और कुछ?`;
  return `Done — ${servico} ${segurado ? "held" : "booked"} for ${quando}${ex}.${r} You'll get a confirmation. Anything else?`;
}

// Os dois PEDAÇOS que continuavam em inglês no meio da confirmação já traduzida: o número de
// confirmação e o aviso de reserva temporária. A sonda de idioma só olhava a disponibilidade e
// deu verde com "Pronto — ... agendado para sáb., 8 de ago. Your confirmation number is GUI-B0B6."
// Verde estreito engana igual a verde falso: a sonda passou a cobrir a confirmação também.
function refMsg(lang, ref) {
  if (!ref) return "";
  const L = L2(lang);
  if (L === "pt") return ` Seu número de confirmação é ${ref}.`;
  if (L === "es") return ` Su número de confirmación es ${ref}.`;
  if (L === "hi") return ` आपका पुष्टि नंबर ${ref} है।`;
  return ` Your confirmation number is ${ref}.`;
}

function seguradoMsg(lang) {
  const L = L2(lang);
  if (L === "pt") return " (reservado por 5 min enquanto confirmamos)";
  if (L === "es") return " (reservado 5 min mientras confirmamos)";
  if (L === "hi") return " (पुष्टि होने तक 5 मिनट के लिए रोका गया)";
  return " (held for 5 min while we confirm)";
}

function movidoMsg(lang, quando) {
  const L = L2(lang);
  if (L === "pt") return `Movido para ${quando}. Você vai receber a nova confirmação.`;
  if (L === "es") return `Movido a ${quando}. Le llegará la nueva confirmación.`;
  if (L === "hi") return `${quando} पर बदल दिया। आपको नई पुष्टि मिल जाएगी।`;
  return `Moved to ${quando}. You'll get a new confirmation.`;
}

function opcoesMsg(lang, servico, ondeTxt, human) {
  const L = L2(lang);
  if (L === "pt") return `Para ${servico}${ondeTxt}, tenho: ${human}. Qual funciona melhor pra você?`;
  if (L === "es") return `Para ${servico}${ondeTxt}, tengo: ${human}. ¿Cuál le viene mejor?`;
  if (L === "hi") return `${servico}${ondeTxt} के लिए मेरे पास: ${human}। कौन सा ठीक रहेगा?`;
  return `For ${servico}${ondeTxt}, I have: ${human}. Which works?`;
}

// SEM VAGA é uma resposta que o cliente ouve inteira — e era a única em inglês fixo no caminho de
// disponibilidade. Oferece saída em vez de fechar a porta: outro local, ou alguém liga de volta.
function semVagaMsg(lang, servico, ondeTxt) {
  const L = L2(lang);
  if (L === "pt") return `Não estou vendo horário para ${servico}${ondeTxt} nas próximas duas semanas — quer que eu veja outro local, ou prefere que alguém te ligue?`;
  if (L === "es") return `No veo horarios para ${servico}${ondeTxt} en las próximas dos semanas — ¿reviso otra sede, o prefiere que le llamen?`;
  if (L === "hi") return `अगले दो हफ़्तों में ${servico}${ondeTxt} के लिए जगह नहीं दिख रही — क्या मैं दूसरी जगह देखूँ, या कोई आपको कॉल करे?`;
  return `I don't see openings for ${servico}${ondeTxt} in the next two weeks — want me to check another location or have someone call you?`;
}

// ── O QUE A AGENTE FALA, EM CADA IDIOMA ──────────────────────────────────────────────────────
// Um dicionário, não dezoito funções. Quando a varredura de 2026-08-08 achou 18 frases fixas em
// inglês, ficou claro que o padrão "uma função por frase" não escala: a décima nona nasce em
// inglês de novo porque escrever a função dá mais trabalho que escrever a string. Com a tabela,
// o caminho preguiçoso passa a ser o certo — e o que falta aparece na hora, olhando as colunas.
// Sem entrada no idioma pedido, cai no inglês: melhor uma frase entendível que um buraco.
const FALA = {
  agenda_fora_do_ar:  { en: "I couldn't reach the schedule just now.", pt: "Não consegui acessar a agenda agora.", es: "No pude acceder a la agenda ahora.", hi: "अभी शेड्यूल तक नहीं पहुँच पाया।" },
  sem_precos:         { en: "I don't have prices listed yet — I'll confirm that and get right back to you.", pt: "Ainda não tenho os preços aqui — vou confirmar e já te retorno.", es: "Todavía no tengo los precios — lo confirmo y le aviso enseguida.", hi: "अभी कीमतें नहीं हैं — पुष्टि करके तुरंत बताता हूँ।" },
  sem_agendamentos:   { en: "I don't see any upcoming appointments under that number.", pt: "Não estou vendo nenhum agendamento nesse número.", es: "No veo ninguna cita con ese número.", hi: "इस नंबर पर कोई अपॉइंटमेंट नहीं दिख रहा।" },
  qual_telefone:      { en: "What's the phone number the appointment is under?", pt: "Qual é o telefone que está no agendamento?", es: "¿Con qué teléfono está la cita?", hi: "अपॉइंटमेंट किस नंबर पर है?" },
  telefone_e_horario: { en: "What's the phone number it's under, and the new day and time?", pt: "Qual é o telefone do agendamento, e o novo dia e horário?", es: "¿Con qué teléfono está, y qué nuevo día y hora?", hi: "किस नंबर पर है, और नया दिन और समय क्या?" },
  qual_servico:       { en: "Which service is it for? I'll find the next opening.", pt: "Para qual serviço? Já procuro o próximo horário.", es: "¿Para qué servicio? Busco el próximo hueco.", hi: "किस सेवा के लिए? मैं अगला समय देखता हूँ।" },
  qual_dia_e_hora:    { en: "What day and time would you like?", pt: "Que dia e horário você prefere?", es: "¿Qué día y hora prefiere?", hi: "कौन सा दिन और समय चाहेंगे?" },
  acabou_de_sair:     { en: "That time was just taken — want me to check the next opening?", pt: "Esse horário acabou de ser preenchido — quer que eu veja o próximo?", es: "Ese horario acaba de ocuparse — ¿reviso el siguiente?", hi: "वह समय अभी भर गया — क्या अगला देखूँ?" },
  nao_consegui_travar:{ en: "I couldn't lock that in — let me grab you another time.", pt: "Não consegui garantir esse horário — deixa eu pegar outro pra você.", es: "No pude asegurar ese horario — le busco otro.", hi: "वह समय पक्का नहीं कर पाया — दूसरा देखता हूँ।" },
  inicio_recorrente:  { en: "What day and time should the recurring appointment start?", pt: "Em que dia e horário o agendamento recorrente deve começar?", es: "¿Qué día y hora empieza la cita recurrente?", hi: "नियमित अपॉइंटमेंट कब से शुरू हो?" },
  nao_entendi_inicio: { en: "I couldn't pin that start time — which day and time would you like?", pt: "Não consegui entender esse horário de início — que dia e hora você prefere?", es: "No entendí esa hora de inicio — ¿qué día y hora prefiere?", hi: "शुरू का समय समझ नहीं आया — कौन सा दिन और समय?" },
  soluco:             { en: "Sorry, the schedule hiccuped — could you say that again?", pt: "Desculpa, a agenda travou aqui — pode repetir?", es: "Perdón, la agenda falló — ¿me lo repite?", hi: "माफ़ कीजिए, शेड्यूल अटक गया — फिर से बताएँगे?" },
  nao_achei_cancelar: { en: "I couldn't find that appointment to cancel.", pt: "Não encontrei esse agendamento para cancelar.", es: "No encontré esa cita para cancelar.", hi: "रद्द करने के लिए वह अपॉइंटमेंट नहीं मिला।" },
  cancelado:          { en: "Done — that's cancelled. Anything else?", pt: "Pronto — cancelado. Mais alguma coisa?", es: "Listo — cancelado. ¿Algo más?", hi: "हो गया — रद्द कर दिया। और कुछ?" },
  novo_horario_ocupado:{ en: "That new time's taken — want another?", pt: "Esse novo horário está ocupado — quer outro?", es: "Ese nuevo horario está ocupado — ¿otro?", hi: "वह नया समय भरा है — कोई और?" },
  nao_movi:           { en: "I couldn't move that one.", pt: "Não consegui mudar esse agendamento.", es: "No pude mover esa cita.", hi: "उसे बदल नहीं पाया।" },
};
const diz = (id, lang) => (FALA[id] || {})[L2(lang)] || (FALA[id] || {}).en || "";

// "Encontrei: X, Y" — precisa da lista montada, então não cabe na tabela.
function encontreiMsg(lang, lista) {
  const L = L2(lang);
  if (L === "pt") return `Encontrei: ${lista}.`;
  if (L === "es") return `Encontré: ${lista}.`;
  if (L === "hi") return `मुझे मिला: ${lista}।`;
  return `I found: ${lista}.`;
}

// Pontos de fidelidade — número no meio da frase.
function pontosMsg(lang, pontos, visitas) {
  const L = L2(lang);
  const v = visitas ? (L === "pt" ? ` de ${visitas} visita${visitas === 1 ? "" : "s"}` : L === "es" ? ` de ${visitas} visita${visitas === 1 ? "" : "s"}` : L === "hi" ? ` ${visitas} विज़िट से` : ` from ${visitas} visit${visitas === 1 ? "" : "s"}`) : "";
  if (L === "pt") return `Você tem ${pontos} pontos de fidelidade${v}.`;
  if (L === "es") return `Tiene ${pontos} puntos de fidelidad${v}.`;
  if (L === "hi") return `आपके ${pontos} लॉयल्टी पॉइंट हैं${v}।`;
  return `You have ${pontos} loyalty points${v}.`;
}

// DUAS UNIDADES FAZEM ISSO — pergunte, não escolha.
// ← 2026-08-16: o Natura faz massagem em Astoria E no med spa do Upper East Side, com nomes de
//   serviço diferentes. Quem liga e não diz onde quer só era oferecido Astoria, e a segunda
//   unidade ficava invisível — receita existindo e não sendo mostrada. Escolher calado pela
//   pessoa é o mesmo pecado de marcar no horário errado: pode acertar, e quando erra ela só
//   descobre no balcão. Uma pergunta de cinco palavras resolve e ainda vende a outra unidade.
function qualUnidadeMsg(lang, servico, unidades) {
  const L = L2(lang);
  const lista = unidades.map((u) => u.name).join(L === "pt" ? " ou " : L === "es" ? " o " : L === "hi" ? " या " : " or ");
  if (L === "pt") return `A gente faz ${servico} na ${lista}. Qual fica melhor pra você?`;
  if (L === "es") return `Hacemos ${servico} en ${lista}. ¿Cuál le queda mejor?`;
  if (L === "hi") return `हम ${servico} ${lista} में करते हैं। कौन सा आपके लिए बेहतर है?`;
  return `We do ${servico} at ${lista}. Which is better for you?`;
}

// "Não entendi qual serviço" — lista o cardápio real em vez de pedir de novo no vazio.
function servicoIndefinidoMsg(lang, lista) {
  const L = L2(lang);
  if (L === "pt") return `Não peguei qual serviço — temos ${lista}. Qual deles?`;
  if (L === "es") return `No entendí qué servicio — tenemos ${lista}. ¿Cuál?`;
  if (L === "hi") return `कौन सी सेवा समझ नहीं आई — हमारे पास ${lista} है। कौन सी?`;
  return `I didn't catch which service — we have ${lista}. Which one?`;
}

// A agenda externa aceitou o pedido mas não garantiu o encaixe. Dizer "agendado" aqui seria a
// mesma promessa sem lastro que já custou caro: o certo é anotar e avisar que alguém confirma.
function anotadoMsg(lang, servico, quando) {
  const L = L2(lang);
  if (L === "pt") return `Anotei seu pedido de ${servico} para ${quando} — a recepção confirma o horário exato com você em seguida. Mais alguma coisa?`;
  if (L === "es") return `Anoté su solicitud de ${servico} para ${quando} — recepción le confirma el horario exacto enseguida. ¿Algo más?`;
  if (L === "hi") return `${quando} के लिए ${servico} का अनुरोध नोट कर लिया — रिसेप्शन सही समय की पुष्टि कर देगा। और कुछ?`;
  return `Got it — I've noted your request for ${servico} at ${quando} and our front desk will confirm the exact spot with you shortly. Anything else I can help with?`;
}

// A PESSOA NÃO DISSE QUANDO. Perguntar, e já adiantar as opções reais — assim a ligação anda em
// vez de virar um ping-pong de "quando você quer?" / "quando tem?".
function semHorarioMsg(lang, alts) {
  const L = (lang || "en").toString().slice(0, 2);
  if (L === "pt") return `Claro! Pra qual dia e horário você quer?${alts ? ` Tenho ${alts}.` : ""}`;
  if (L === "es") return `¡Claro! ¿Para qué día y hora lo quiere?${alts ? ` Tengo ${alts}.` : ""}`;
  if (L === "hi") return `ज़रूर! किस दिन और समय के लिए चाहिए?${alts ? ` मेरे पास ${alts} है।` : ""}`;
  return `Of course — what day and time works for you?${alts ? ` I have ${alts}.` : ""}`;
}

// A PESSOA DISSE QUANDO, E AQUELE HORÁRIO NÃO DÁ. Aqui "não está livre" é verdade.
function ocupadoMsg(lang, alts) {
  const L = (lang || "en").toString().slice(0, 2);
  if (L === "pt") return alts ? `Esse horário não está livre — tenho ${alts}. Algum desses serve?` : `Esse horário não está livre. Quer que eu veja outro dia?`;
  if (L === "es") return alts ? `Ese horario no está libre — tengo ${alts}. ¿Le sirve alguno?` : `Ese horario no está libre. ¿Reviso otro día?`;
  if (L === "hi") return alts ? `वह समय उपलब्ध नहीं है — मेरे पास ${alts} है। क्या इनमें से कोई ठीक रहेगा?` : `वह समय उपलब्ध नहीं है। क्या मैं कोई और दिन देखूँ?`;
  return alts ? `That time isn't open — I have ${alts}. Want one of those?` : `That time isn't available — want me to check another day?`;
}

// date-only label ("Thu, Nov 26") in the business's timezone, localized so the agent can SAY it
function fmtDay(iso, tz = "America/New_York", lang = "en") {
  const loc = { pt: "pt-BR", es: "es", hi: "hi-IN" }[(lang || "en").toString().slice(0, 2)] || "en-US";
  try { return new Date(iso).toLocaleDateString(loc, { weekday: "short", month: "short", day: "numeric", timeZone: tz || "America/New_York" }); }
  catch { return (iso || "").toString().slice(0, 10); }
}

// Book with idempotency: pass a stable request_id so a retried/double-fired tool call returns the SAME
// booking. RESILIENT: if the DB still has the old biz_book (no p_request_id param yet, before the
// idempotency migration is pasted), it transparently retries without it — never breaks booking.
async function bookIdem(env, params, reqId) {
  let r = await rpc(env, "biz_book", { ...params, p_request_id: (reqId || "").toString().slice(0, 160) });
  if (r && (r.code === "PGRST202" || (typeof r.message === "string" && /p_request_id|could not find|function .*biz_book/i.test(r.message)))) {
    r = await rpc(env, "biz_book", params); // legacy function without the idempotency param
  }
  return r;
}

// O HORÁRIO FALADO, NO IDIOMA DE QUEM LIGOU. Isto era "en-US" fixo — então um cliente brasileiro
// ouvia "Sat, Aug 8, 9:30 AM" no meio de uma frase em português. A simulação de 2026-08-08 expôs
// a costura: "Esse horário não está livre — tenho Sat, Aug 8, 9:30 AM with Ana". Metade da frase
// em cada língua soa a sistema improvisado, e é a primeira coisa que o cliente do cliente percebe.
// O padrão continua "en" de propósito: nenhuma chamada existente muda de comportamento.
function fmt(iso, tz = "America/New_York", lang = "en") {
  const loc = { pt: "pt-BR", es: "es-ES", hi: "hi-IN" }[(lang || "en").toString().slice(0, 2)] || "en-US";
  try {
    const d = new Date(iso);
    return d.toLocaleString(loc, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz || "America/New_York" });
  } catch { return iso; }
}
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });
