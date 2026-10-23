// Cloudflare Pages Function — POST /api/agent-schedule
// The scheduling "tools" the Gui voice agent calls on a call. Accepts human NAMES (the agent speaks
// in names, not UUIDs) and resolves them against the live business profile, then hits the motor:
//   op = "lookup"       → the business menu (services, locations, professionals)
//   op = "availability" → real free slots for a service (optionally a location/professional)
//   op = "book"         → book a slot (DB EXCLUDE constraint blocks double-booking)
//   op = "add_service"  → add a service to the caller's EXISTING appointment, booked right before/after it
//                          and linked to it (attributes.parent_appointment_id) — see lib/adicionarServico.js
// Gated by the agent secret (x-guileo-secret / ?secret). Talks to the scheduling DB with SCHED_SECRET.
import { safeEq } from "../lib/guard.js";
import { feriadosDaqui } from "../lib/feriados.js";
import { emitFailure } from "../lib/failure.js";
import { appointmentEmail, ownerAlertEmail } from "../lib/emailTemplates.js";
import { sendOrFlag } from "../lib/twilio.js";
// THE UNIFIED SCHEDULING BRAIN — routes availability/book to a connected external calendar
// (MindBody/Square/…) when the tenant has one ready, else to the internal biz_* engine. See
// functions/lib/scheduleAdapter.js. Falls back to internal on ANY external error → zero regression.
// ⚠️ MINDBODY (2026-09-30): erro do MindBody NÃO cai mais no motor interno — a agente diz que não
// consegue ver a agenda e anota o recado (falaAgendaExterna). Só o Square mantém a queda antiga.
import { resolveScheduler, getAvailability as adapterAvailability, book as adapterBook, cancel as adapterCancel, mirrorOf as adapterMirror, rescheduleOptions as adapterRescheduleOptions, reschedule as adapterReschedule, falaAgendaExterna, diaDoPedido } from "../lib/scheduleAdapter.js";
import { brandFor } from "../lib/clientBrand.js";
import { resolveSlot, oQueAPessoaDisse } from "../lib/slotResolver.js";
import { resolveServicoLocal } from "../lib/bizMatch.js";
import { avaliarContato, pedirContatoMsg, numeroFalado, contatoDaLigacao, emailFalado, variantesDoContato } from "../lib/contato.js";
import { svcRpc, svcJson } from "../lib/sb.js";
import { oferecerVaga } from "../lib/filaDeEspera.js";
import { registrar } from "../lib/registro.js";
import { aniversarioUrl, reservaUrl, preferenciasUrl } from "../lib/visita.js";
import { servicoDeCuidado } from "../lib/preferencias.js";

// Send a branded confirmation to the CUSTOMER (email now; SMS lights up when A2P clears). Best-effort.
const isEmail = (s) => /.+@.+\..+/.test((s || "").toString());
// Devolve o melhor e-mail para ESTE cliente: o que ele deu agora, ou — se ele deu só o telefone —
// o que já está no cadastro dele. Sem isto, marcar por telefone não gerava confirmação NENHUMA
// (o SMS está bloqueado pela campanha A2P), e a pessoa desligava sem nada na mão. Foi exatamente
// a reclamação do Luis em 2026-08-05: "não chegou e-mail nada".
export async function emailDoCliente(env, tenant, contato) {
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

// "Natura Spa <noreply@guileoai.com>" — o endereço continua o nosso (domínio verificado no Resend),
// só o NOME muda. Aspas e <> saem do nome pra não quebrar o cabeçalho.
function remetenteDoNegocio(env, brand) {
  const base = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
  const nome = ((brand && brand.business) || "").toString().replace(/["<>\r\n]/g, "").trim().slice(0, 60);
  if (!nome || nome === "Guileo") return base;
  const end = (base.match(/<([^>]+)>/) || [])[1] || base;
  return `${nome} <${end}>`;
}

export async function sendApptEmail(env, kind, p) {
  if (!env.RESEND_API_KEY) return false;
  // o destinatário pode vir do cadastro quando a pessoa só deu o telefone
  const destino = isEmail(p.email) ? p.email : await emailDoCliente(env, p.tenant, p.contact);
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
      // "quando é o seu aniversário?" — link assinado para ESTE agendamento; sem id, sem linha.
      birthdayUrl: p.apptId ? await aniversarioUrl(env, p.tenant, p.apptId).catch(() => "") : "",
      // "remarcar ou cancelar" sozinha (2026-10-05) — link assinado para ESTE agendamento.
      manageUrl: p.apptId ? await reservaUrl(env, p.tenant, p.apptId).catch(() => "") : "",
      // "como você prefere?" (2026-10-05) — só em serviço de cuidado (massagem, facial, cabelo…).
      prefsUrl: p.apptId && servicoDeCuidado(p.service) ? await preferenciasUrl(env, p.tenant, p.apptId).catch(() => "") : "",
    });
    // r.ok matters: Resend answers 4xx on an unverified domain / bad address / rate limit.
    // Returning true regardless would tell the caller a confirmation went out when it didn't.
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      // O RODAPÉ DIZ "responda este e-mail" — então a resposta tem que chegar NO NEGÓCIO, não no
      // noreply da Guileo (2026-09-28). E quem assina é o spa: o cliente marcou com a Natura, não com a gente.
      body: JSON.stringify({ from: remetenteDoNegocio(env, brand), to: destino, subject, html, ...(isEmail(p.tenant) ? { reply_to: p.tenant } : {}) }),
    });
    // Comprovante pra quem pediu (a rota de prova lê isto): o id do Resend, não só "ok".
    if (p && typeof p === "object") { const j = await r.clone().json().catch(() => ({})); p.recibo = { http: r.status, id: j.id || null, de: remetenteDoNegocio(env, brand), para: destino, erro: r.ok ? null : (j.message || j.name || null) }; }
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
  if (ok) return true;

  // SEM E-MAIL → TEXTO (2026-09-30). A confirmação de quem marcou por telefone só tinha um
  // caminho (e-mail) e ele quase nunca existe. Aqui ela tenta WhatsApp do negócio e depois SMS —
  // e só SAI se o canal estiver aprovado, a pessoa não tiver pedido STOP e o número for válido
  // (lib/avisoPorTexto.js). Hoje os dois canais estão fechados, então isto devolve "não enviado"
  // e o aviso ao dono abaixo continua valendo; no dia da aprovação passa a entregar sozinho.
  if ((kind === "book" || kind === "hold") && !isEmail(p.contact) && p.contact) {
    try {
      const { entregarAviso } = await import("../lib/avisoPorTexto.js");
      const { svcJson } = await import("../lib/sb.js");
      let de = "";
      try { const ag = await svcJson(env, "client_agent_resolve", { p_secret: env.INGEST_SECRET || "", p_email: tenantEmail }); if (ag && ag.number) de = String(ag.number); } catch { /* remetente da plataforma */ }
      const av = await entregarAviso(env, { tenant: tenantEmail, phone: p.contact, kind, lang: p.lang || "en", de,
        // o nome do negócio abre a mensagem (as operadoras exigem que o remetente se identifique)
        dados: { name: p.name, business: p.business || ((await brandFor(env, tenantEmail).catch(() => null)) || {}).business || "", service: p.service, whenLabel: p.whenLabel, location: p.location, ref: p.ref } });
      if (av.sent) {
        p.recibo = { canal: av.canal, id: av.id, para: String(p.contact) };
        return true;
      }
    } catch { /* o texto é tentativa; o aviso ao dono abaixo cobre a falha */ }
  }

  // ⚠️ RESERVA SEM COMPROVANTE NA MÃO DO CLIENTE NÃO PODE SAIR CALADA (2026-08-16).
  // Esta função tinha `if (ok || !isEmail(p.contact)) return ok;` — reserva feita por TELEFONE
  // saía em silêncio, tratada como "pulo legítimo". Era legítima quando o SMS funcionava: o
  // cliente recebia por lá. Com a campanha A2P bloqueada, telefone-só virou o caminho onde o
  // cliente NÃO RECEBE NADA e ninguém fica sabendo.
  // Foi exatamente o que aconteceu no GUI-42F0, o primeiro agendamento real: o contato era um
  // telefone (ainda por cima quebrado), o e-mail não tinha para onde ir, e o único registro na
  // trilha foi a agente anotando "Send confirmation text". Nada saiu. Nenhum aviso.
  // O horário está reservado, o cliente acha que vai receber algo, e a única pessoa que poderia
  // salvar a visita — o dono — não sabe que precisa. É a regra do comprovante aplicada ao ELO
  // FINAL: não basta o agendamento existir no nosso banco, ele tem que chegar em quem vai ao spa.
  const porTelefone = !isEmail(p.contact);
  try {
    await svcRpc(env, "ingest_client_event", {
      p_secret: env.INGEST_SECRET || "", p_email: tenantEmail, p_type: "message", p_channel: porTelefone ? "Phone" : "Email",
      p_summary: porTelefone
        ? `⚠️ ${["book", "hold"].includes(kind) ? "Agendamento" : kind} de ${p.name || "cliente"} SEM confirmação entregue — só temos o telefone ${p.contact} e o SMS está bloqueado. Ligue ou peça o e-mail.`
        : `⚠️ E-mail de ${["book", "hold"].includes(kind) ? "confirmação" : kind} NÃO foi entregue a ${p.contact} — confirme com o cliente`,
      p_amount: 0, p_payload: { delivery: "failed", kind, to: String(p.contact || ""), motivo: porTelefone ? "sem_email_sms_bloqueado" : "resend_recusou", ref: String(p.ref || "") },
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
// ⚠️ DOIS APPS OAuth podem ter emitido este refresh_token: o antigo de calendário
// (GOOGLE_CLIENT_ID, fluxo /api/gcal-connect) e o unificado (GOOGLE_BUSINESS_CLIENT_ID, o login
// único que liga agenda + avaliações). Um refresh_token só é renovável pelo MESMO client que o
// emitiu — refrescar com o app errado devolve invalid_client e o push morre em silêncio, com a
// tela dizendo "conectado". Por isso tentamos os dois apps configurados, nesta ordem.
function gcalApps(env) {
  const list = [];
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) list.push({ id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET });
  if (env.GOOGLE_BUSINESS_CLIENT_ID && env.GOOGLE_BUSINESS_CLIENT_SECRET) list.push({ id: env.GOOGLE_BUSINESS_CLIENT_ID, secret: env.GOOGLE_BUSINESS_CLIENT_SECRET });
  return list;
}

async function gcalPush(env, email, ev) {
  const apps = gcalApps(env);
  if (!apps.length || !env.INGEST_SECRET) return;
  try {
    const lr = await fetch(`${SB}/rest/v1/rpc/gcal_token_lookup`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.INGEST_SECRET, p_email: email }),
    });
    const refresh = lr.ok ? ((await lr.json()) || "").toString() : "";
    if (!refresh || refresh.length < 10) return; // not connected
    let at = "";
    for (const a of apps) {
      const tr = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: a.id, client_secret: a.secret, refresh_token: refresh, grant_type: "refresh_token" }),
      });
      if (!tr.ok) continue;                       // app errado → tenta o próximo
      at = (((await tr.json()) || {}).access_token) || "";
      if (at) break;
    }
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

// ── O AGENDAMENTO TEM QUE APARECER NA CENTRAL (incidente 2026-09-28) ──────────────────────────
// A Central conta agendamentos pelos client_events de type "booking". Este motor marcava a
// reserva, mandava o comprovante, avisava o dono, gravava no CRM (crm_log_event) — e NUNCA
// gravava o evento `booking` no feed. O dono abria o painel e lia "0 agendamentos" com a agenda
// cheia: 2 eventos `booking` na plataforma inteira, os dois de junho.
//
// REGRAS:
//  · só depois de reserva CONFIRMADA (id na mão, não-hold) — nunca em tentativa, recusa ou hold;
//  · UMA vez por reserva: a ElevenLabs re-tenta a ferramenta e a vitrine re-envia no duplo
//    clique. A trava é do banco (índice único em payload.dedupe, db/booking_event_once.sql),
//    não um "já existe?" lido antes de gravar;
//  · não custa crédito e grava amount 0: reserva feita não é dinheiro recebido, e my_company_os
//    soma `amount` de booking como "receita coletada". O preço vai em payload.price_cents;
//  · NÃO roda em prova/simulação (x-guileo-test ou `prova:true`): 41 das 57 reservas do banco
//    são de sonda ("PROVA", "Simulado") — contá-las inflaria o KPI do cliente com teste nosso;
//  · nunca derruba a reserva: falhou gravar o evento, a reserva continua de pé e o defeito vira
//    alarme (emitFailure), não silêncio.
const CANAIS_DO_PEDIDO = ["voice", "phone", "web", "webchat", "whatsapp", "sms", "instagram", "messenger", "email"];
export function canalDoPedido(b, request) {
  const c = String((b && (b.channel || b.canal)) || (request && request.headers && request.headers.get("x-guileo-canal")) || "").trim().toLowerCase();
  return CANAIS_DO_PEDIDO.includes(c) ? c : "voice";   // quem chama sem dizer o canal é o agente de voz
}
// A chave da trava: o id da reserva quando existe; na agenda externa, a referência de lá.
export function chaveDoAgendamento({ appointmentId, provider, externalRef }) {
  if (appointmentId) return `appt:${appointmentId}`;
  if (externalRef) return `ext:${provider || "externo"}:${externalRef}`;
  return "";
}
async function eventoDeAgendamento(env, email, d) {
  try {
    const chave = chaveDoAgendamento(d);
    if (!chave) return { ok: false, motivo: "sem_chave" };
    const r = await svcRpc(env, "ingest_booking_event", {
      p_secret: env.INGEST_SECRET || "", p_email: email, p_dedupe: chave, p_channel: d.canal || "voice",
      p_summary: `Booked ${d.service || "appointment"} for ${d.whenLabel || d.start || ""}${d.provider ? ` (via ${d.provider})` : ""}`.slice(0, 400),
      p_payload: {
        appointment_id: d.appointmentId || null, service: d.service || "", start: d.start || "",
        ...(d.ref ? { ref: String(d.ref) } : {}), ...(d.externalRef ? { external_ref: String(d.externalRef), provider: d.provider || "" } : {}),
        ...(Number.isFinite(d.priceCents) && d.priceCents > 0 ? { price_cents: d.priceCents } : {}),
      },
    });
    const j = r.ok ? await r.json().catch(() => null) : null;
    if (!j || j.ok !== true) {
      await emitFailure(env, "booking_sem_evento_no_feed", email, `reserva feita (${d.service || "?"} · ${d.whenLabel || d.start || "?"}) mas o evento booking NÃO entrou no feed da Central (HTTP ${r.status}${j && j.motivo ? ` · ${j.motivo}` : ""})`, { chave }).catch(() => {});
      return { ok: false, motivo: (j && j.motivo) || `http_${r.status}` };
    }
    return { ok: true, novo: j.novo === true, id: j.id || null };
  } catch (e) { return { ok: false, motivo: String(e).slice(0, 80) }; }   // a reserva vale mais que o log
}

export async function onRequestPost(context) {
  const { request, env } = context;
  // 🚨 O IDIOMA MORA FORA DO `try` (2026-09-28). O `catch` lá embaixo respondia `diz("soluco", b.lang)`
  // — mas `b` nasce DENTRO do `try` e não existe no `catch`. O próprio tratador de erro levantava
  // ReferenceError: em vez da frase de "tive um soluço, vamos de novo", a agente recebia um 500
  // cru no meio da ligação. O defeito só aparece quando outra coisa já deu errado, por isso nunca
  // apareceu em teste — e é justamente nessa hora que a frase certa segura o cliente na linha.
  let idiomaDoPedido = "en";
  try {
    const b = await request.json().catch(() => null);
    if (!b) return json({ error: "bad request" }, 400);
    idiomaDoPedido = b.lang || "en";

    // ── COCKPIT ACTIONS (special dates) — per-tenant gate (email + connection key via
    // get_client_data, same pattern as noshow-radar.js). Handled BEFORE the agent-secret
    // gate; every agent op below still requires AGENT_ACTION_SECRET exactly as before.
    const cockpitAction = (b.action || "").toString();
    if (cockpitAction === "special_list" || cockpitAction === "special_set" || cockpitAction === "special_holidays") return specialDates(env, b, cockpitAction);
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
      // duration_min e category entram para a página pública de agendamento (2026-10-05) — campos a mais, nada muda para a agente.
      const priced = services.map((s) => ({ name: s.name, price: money(s.price_cents), price_cents: s.price_cents ?? null, duration_min: s.duration_min ?? null, category: s.config?.category || s.category || null }));
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

    // CR-02 (2026-10-08): a agente agora chama find/reschedule/cancel. Numa LIGAÇÃO ela pode mandar o
    // contato vazio ou o NOME da variável ("{{caller_phone}}") — o mesmo tropeço do book (28/09). Só
    // nesse caso entra o BINA (x-guileo-caller); um telefone/e-mail DITADO vence, porque o agendamento
    // pode estar no número de outra pessoa da casa.
    if (op === "find" || op === "cancel" || op === "reschedule") {
      const dito = (b.contact || "").toString().trim();
      // vazio, nome de variável, ou frase sem número nem e-mail ("the number they are calling from",
      // visto na simulação de 08/10) → o BINA, quando houver
      if (!dito || /\{\{|caller_phone|caller_id/i.test(dito) || !variantesDoContato(dito).length) {
        const cl = contatoDaLigacao("", request.headers.get("x-guileo-caller"));
        b.contact = cl.contato || "";
      }
      // O MESMO número em outra grafia ("+1 917 555 0143" × "+19175550143") — a busca é por texto
      // exato; tenta as formas do mesmo contato e fixa a que achou, para cancel/reschedule usarem igual.
      const formas = variantesDoContato(b.contact);
      if (formas.length > 1) {
        for (const c of formas) {
          const f0 = await rpc(env, "biz_find_appointments", { p_email: email, p_contact: c });
          if ((f0.appointments || []).length) { b.contact = c; break; }
        }
      }
    }
    // find a caller's upcoming appointment by their phone/email (for reschedule/cancel by voice)
    // `ref` (o código que a pessoa lê do comprovante, ex. GUI-4F2A) só casa DENTRO dos agendamentos
    // do contato dela — nunca abre o agendamento de outra pessoa pelo código.
    const findApptId = async () => {
      if (b.appointment_id) return b.appointment_id;
      if (!b.contact) return null;
      const f = await rpc(env, "biz_find_appointments", { p_email: email, p_contact: (b.contact || "").toString() });
      const lista = f.appointments || [];
      const ref = (b.ref || "").toString().trim().toLowerCase();
      if (ref) return lista.find((a) => (a.ref || "").toString().toLowerCase() === ref)?.id || null;
      return lista[0]?.id || null;
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
      // AGENDA EXTERNA (MindBody): se este agendamento é ESPELHO, cancela LÁ primeiro. Antes o
      // cancelamento só mexia no espelho: a cliente ouvia "cancelado" e o horário continuava
      // ocupado no sistema do spa. Se o MindBody não confirmar, NADA é cancelado aqui — dizer
      // "cancelado" sem ter cancelado é a promessa sem lastro de sempre.
      // handled:false = agendamento do motor interno → segue o caminho de sempre, intocado.
      {
        const scC = await scheduler();
        if (scC.provider === "mindbody") {
          const alvoC = await adapterMirror(env, email, scC, id);
          if (alvoC.handled) {
            // simulação não cancela nada no sistema do cliente (mesma regra do book)
            if (alvoC.ok && testMode) return json({ ok: true, dry_run: true, source: "mindbody" });
            const cx = alvoC.ok ? await adapterCancel(env, email, scC, { mirror: alvoC.mirror }) : alvoC;
            if (!cx.ok) {
              await logRecusa(env, email, op, `mindbody_nao_cancelou:${cx.reason || "?"}`, id);
              return json({ ok: false, source: "mindbody", reason: "agenda_externa_indisponivel", message: falaAgendaExterna("nao_cancelei", b.lang) });
            }
          }
        }
      }
      const r = await rpc(env, "biz_cancel", { p_email: email, p_appointment_id: id });
      // Quem cancelou (2026-10-05): a taxa de cancelamento em cima da hora precisa saber. Best-effort.
      if (r.ok) await svcJson(env, "desk_cancelled_by_svc", { p_tenant: email, p_id: id, p_by: "ia" }).catch(() => null);
      // Give reserved stock/capacity back to the shelf (no-op unless this booking consumed inventory).
      if (r.ok) { try { await rpc(env, "rpc_reserve_release_by_appt", { p_email: email, p_appointment_id: id }); } catch { /* best-effort */ } }
      if (r.ok) if (!testMode) await apptEmailOrFlag(env, email, "cancel", { contact: (b.contact || "").toString(), name: (b.name || "").toString(), lang: b.lang });
      // WAITLIST AUTO-FILL — the freed slot goes to the next person waiting for that service/location.
      // biz_waitlist_fill_on_cancel pops + marks them notified (dedup); we reach out by email now / WA
      // when approved. Best-effort: NEVER blocks the cancel; graceful no-op until the waitlist is pasted.
      // Mesmo módulo do Balcão e do link da cliente (lib/filaDeEspera.js): envio com comprovante e
      // "ligue pra oferecer" no feed do dono quando não chega.
      if (r.ok && !testMode) await oferecerVaga(env, { tenant: email, appointmentId: id, lang: b.lang }, { motor: (fn, body) => rpc(env, fn, body) });
      return json({ ok: !!r.ok, message: diz(r.ok ? "cancelado" : "nao_achei_cancelar", b.lang) });
    }
    if (op === "reschedule") {
      const when = (b.when || b.start || "").toString();
      const id = await findApptId();
      if (!id || !when) return json({ message: diz("telefone_e_horario", b.lang) });

      // AGENDA EXTERNA (MindBody): espelho é remarcado LÁ, contra a disponibilidade de lá, no fuso
      // do site. handled:false = agendamento do motor interno → segue o caminho de sempre abaixo.
      {
        const scR = await scheduler();
        if (scR.provider === "mindbody") {
          const alvo = await adapterMirror(env, email, scR, id);
          if (alvo.handled) {
            const naoDeu = async (motivo) => { await logRecusa(env, email, op, `mindbody_nao_remarcou:${motivo || "?"}`, when); return json({ ok: false, source: "mindbody", reason: "agenda_externa_indisponivel", message: falaAgendaExterna("nao_remarquei", b.lang) }); };
            if (!alvo.ok) return naoDeu(alvo.reason);
            if (testMode) return json({ ok: true, dry_run: true, source: "mindbody" });   // simulação não remarca no sistema do cliente
            const avx = await adapterRescheduleOptions(env, email, scR, { mirror: alvo.mirror, tz: bizTz });
            if (!avx.ok) return naoDeu(avx.reason);
            const mx = resolveSlot(when, avx.slots, avx.tz);
            if (!mx) {
              const alts = avx.slots.slice(0, 3).map((s2) => fmt(s2.start, avx.tz, b.lang)).join("; ");
              await logRecusa(env, email, op, avx.slots.length ? "horario_pedido_indisponivel" : "sem_vaga_nenhuma", when);
              return json({ ok: false, source: "mindbody", slots: avx.slots.slice(0, 6).map((s2) => ({ start: s2.start, pro: s2.pro, location: s2.location })), message: ocupadoMsg(b.lang, alts) });
            }
            const rr = await adapterReschedule(env, email, scR, { mirror: alvo.mirror, slot: { ...mx, tz: avx.tz }, tz: avx.tz });
            if (!rr.ok) {
              if (rr.horario_tomado) { await logRecusa(env, email, op, "horario_tomado_na_hora", when); return json({ ok: false, source: "mindbody", message: diz("novo_horario_ocupado", b.lang) }); }
              return naoDeu(rr.reason);
            }
            if (!testMode) await apptEmailOrFlag(env, email, "reschedule", { contact: (b.contact || alvo.mirror.contact || "").toString(), name: (b.name || alvo.mirror.name || "").toString(), whenLabel: fmt(rr.start, avx.tz), lang: b.lang });
            await logTool(env, email, op, "OK", `mindbody ${alvo.mirror.external_ref} → ${fmt(rr.start, avx.tz)}`);
            return json({ ok: true, source: "mindbody", message: movidoMsg(b.lang, fmt(rr.start, avx.tz, b.lang)) });
          }
        }
      }

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
      return json({ ok: !!r.ok, message: r.ok ? movidoMsg(b.lang, fmt(novoIso, bizTz, b.lang)) : diz(r.reason === "slot_taken" || r.reason === "resource_unavailable" ? "novo_horario_ocupado" : "nao_movi", b.lang) });
    }

    // ── ADD-ON: ADICIONAR UM SERVIÇO A UM AGENDAMENTO QUE JÁ EXISTE (2026-10-07) ──────────────
    // Contrato do Natura: "a cliente com massagem marcada pede um facial junto → marca, se a
    // profissional e a sala estiverem livres". A decisão (qual é o pai, quais vagas são coladas)
    // mora em lib/adicionarServico.js e é testada sem rede; aqui só busca, decide e reserva.
    // Leis: o horário sai SEMPRE de um slot do motor (expediente/intervalos/capacidade/sala já
    // aplicados); "pronto" só com id da reserva na mão; MindBody primeiro e espelho depois, como
    // no `book`; sem vaga colada, as alternativas reais do mesmo dia — nunca um "não" seco.
    // `return await`: sem o await, uma exceção lá dentro escaparia do catch deste try (soluço vira 500).
    if (op === "add_service") return await adicionarServicoOp();
    async function adicionarServicoOp() {
      const A = await import("../lib/adicionarServico.js");
      // 1) O CONTATO que acha o agendamento: o que a agente mandou e, numa ligação, o BINA.
      //    `find` casa por igualdade exata com o que o `book` gravou — por isso tentamos os dois.
      const cl = contatoDaLigacao(b.contact, request.headers.get("x-guileo-caller"));
      const contatos = [...new Set([(b.contact || "").toString().trim(), cl.contato, emailFalado(b.email)].filter((c) => c && !/\{\{|caller_phone|caller_id/i.test(c)))];
      if (!contatos.length) return json({ ok: false, reason: "sem_contato", message: (await logRecusa(env, email, op, "sem_contato", b.service || ""), diz("qual_telefone", b.lang)) });
      let appts = [], contatoDoPai = "";
      for (const c of contatos) {
        const f = await rpc(env, "biz_find_appointments", { p_email: email, p_contact: c });
        if (f && f.error) return json({ ok: false, message: diz("agenda_fora_do_ar", b.lang) });
        if ((f.appointments || []).length) { appts = f.appointments; contatoDoPai = c; break; }
      }
      // 2) O SERVIÇO NOVO — antes do pai, para a pergunta "qual agendamento?" já dizer o que vai entrar.
      const nomeAddon = (b.service || b.addon_service || "").toString();
      if (!nomeAddon) return json({ ok: false, reason: "sem_servico", message: servicoIndefinidoMsg(b.lang, services.map((s) => s.name).join(", ")) });
      const esc = A.escolherAgendamentoPai(appts, { appointmentId: (b.appointment_id || b.parent_appointment_id || "").toString(), servicoExistente: (b.existing_service || b.parent_service || "").toString(), ref: (b.ref || "").toString(), servicoNovo: nomeAddon });
      if (!esc.ok) {
        await logRecusa(env, email, op, `pai_${esc.motivo}`, contatos.join("|"));
        if (esc.motivo === "nenhum") return json({ ok: false, reason: "sem_agendamento", appointments: [], message: A.addonSemAgendamentoMsg(b.lang, nomeAddon) });
        const lista = esc.opcoes.slice(0, 3).map((a) => `${a.service} — ${fmt(a.start, bizTz, b.lang)}`).join("; ");
        return json({ ok: false, reason: "qual_agendamento", appointments: esc.opcoes.slice(0, 5), message: A.addonQualAgendamentoMsg(b.lang, { addon: nomeAddon, lista }) });
      }
      const pai = esc.pai;
      const locPai = pai.location ? (locations.find((l) => norm(l.name) === norm(pai.location)) || null) : (locations.length === 1 ? locations[0] : null);
      const proPai = pai.pro ? (pros.find((p) => norm(p.name) === norm(pai.pro)) || null) : null;
      const svcPai = pai.service ? (services.find((s) => norm(s.name) === norm(pai.service)) || null) : null;
      const tzPai = (locPai && locPai.tz) || bizTz;
      // a DURAÇÃO do pai define onde ele termina. Sem ela não há como saber o que é "logo depois":
      // pergunta ao motor (biz_availability devolve duration_min) antes de chutar.
      let durPai = Number(svcPai && svcPai.duration_min) || 0;
      if (!durPai && svcPai) { const d0 = await rpc(env, "biz_availability", { p_email: email, p_service_id: svcPai.id, p_limit: 1, p_days: 1 }); durPai = Number(d0 && d0.duration_min) || 0; }
      if (!durPai) return json({ ok: false, reason: "duracao_do_pai_desconhecida", message: (await logRecusa(env, email, op, "duracao_do_pai_desconhecida", pai.service || ""), diz("nao_consegui_travar", b.lang)) });
      const paiIni = new Date(pai.start).toISOString();
      const paiFim = new Date(Date.parse(pai.start) + durPai * 60000).toISOString();
      // 3) O SERVIÇO NOVO NA UNIDADE DO PAI (a pessoa não está em dois endereços). Gêmeo por unidade
      //    ("Facial · UES") é resolvido pelo mesmo cruzamento do book.
      const { svc: svcAdd } = resolveServicoLocal(services, locations, pros, nomeAddon, locPai ? locPai.name : "");
      if (!svcAdd) return json({ ok: false, reason: "servico_nao_identificado", message: servicoIndefinidoMsg(b.lang, services.map((s) => s.name).join(", ")) });
      const proPedido = (b.professional || b.pro) ? pick(pros, b.professional || b.pro) : null;
      // os OUTROS agendamentos da pessoa também bloqueiam (duração pelo cardápio; sem ela, 60 min)
      const ocupados = appts.filter((a) => a.id !== pai.id).map((a) => { const s0 = services.find((s) => norm(s.name) === norm(a.service)); return { start: a.start, end: new Date(Date.parse(a.start) + (Number(s0 && s0.duration_min) || 60) * 60000).toISOString() }; });
      const posicao = ["after", "before"].includes(String(b.position || "")) ? String(b.position) : "any";
      const folgaMaxMin = Number(b.max_gap_min) > 0 ? Number(b.max_gap_min) : A.FOLGA_PADRAO_MIN;
      const diaDe = (t) => new Date(t).toLocaleDateString("en-CA", { timeZone: tzPai });
      const hora = (iso) => { try { return new Date(iso).toLocaleTimeString({ pt: "pt-BR", es: "es-ES", hi: "hi-IN" }[L2(b.lang)] || "en-US", { hour: "numeric", minute: "2-digit", timeZone: tzPai }); } catch { return iso; } };
      const requestId = `addon:${pai.id}:${svcAdd.id}`;
      const elo = { parent_appointment_id: pai.id, parent_ref: pai.ref || "", parent_service: pai.service || "", add_on: true };
      const prova = b.dry_run === true || b.dryRun === true || b.prova === true;

      // 4) De onde vêm as vagas: MindBody (agenda do spa) ou o motor interno. Square/outros: não
      //    sabemos encaixar com segurança → anota e a recepção confirma (honesto, com rastro).
      const sc = await scheduler();
      let slots; let fonte = "internal", mesmoPro = (s) => !!(proPai && (s.pro_id ? String(s.pro_id) === String(proPai.id) : norm(s.pro) === norm(proPai.name))), alvoMb = null, mirrorPai = null, tzSlots = tzPai;
      if (sc.provider === "mindbody") {
        fonte = "mindbody";
        const mp = await adapterMirror(env, email, sc, pai.id);
        if (mp.handled && !mp.ok) { await logRecusa(env, email, op, `mindbody_espelho:${mp.reason || "?"}`, pai.id); return json({ ok: false, source: "mindbody", reason: "agenda_externa_indisponivel", message: falaAgendaExterna("nao_vejo", b.lang) }); }
        mirrorPai = mp.handled ? mp.mirror : null;
        const mbPai = (mirrorPai && mirrorPai.attributes && mirrorPai.attributes.mb) || {};
        const tzMb = mbPai.tz || tzPai;
        alvoMb = { service_id: svcAdd.id, location_id: locPai?.id || mirrorPai?.location_id || null, professional_id: proPedido?.id || null, tz: tzMb };
        const av = await adapterAvailability(env, email, sc, { ...alvoMb, dia: diaDoPedido(paiIni.replace(/\.\d{3}Z$/, "Z"), tzMb) || undefined });
        if (!av.ok) { await logRecusa(env, email, op, `mindbody_indisponivel:${av.reason || "?"}`, `${svcAdd.name} · ${pai.id}`); return json({ ok: false, source: "mindbody", reason: "agenda_externa_indisponivel", message: falaAgendaExterna("nao_vejo", b.lang) }); }
        slots = av.slots || []; tzSlots = av.tz || tzMb;
        if (mbPai.staff_id != null) mesmoPro = (s) => s.staff_id != null && Number(s.staff_id) === Number(mbPai.staff_id);
      } else if (sc.provider !== "internal") {
        await logRecusa(env, email, op, `externo_sem_add_on:${sc.provider}`, `${svcAdd.name} · ${pai.id}`);
        try { await svcRpc(env, "ingest_client_event", { p_secret: env.INGEST_SECRET || "", p_email: email, p_type: "message", p_channel: "Phone", p_summary: `➕ Pedido de ${svcAdd.name} junto com ${pai.service} (${fmt(pai.start, bizTz)}) — encaixe na agenda ${sc.provider} e confirme com o cliente ${contatoDoPai}`.slice(0, 300), p_amount: 0, p_payload: { kind: "add_on_request", parent_appointment_id: pai.id, service: svcAdd.name, contact: contatoDoPai } }); } catch { /* o recado ao dono é tentativa; a frase abaixo não promete reserva */ }
        return json({ ok: false, source: sc.provider, captured: true, message: anotadoMsg(b.lang, svcAdd.name, fmtDay(paiIni, tzPai, b.lang)) });
      } else {
        // motor interno: a janela tem que alcançar o dia do pai (biz_availability conta de hoje)
        const LIM = 1500;
        const av = await rpc(env, "biz_availability", { p_email: email, p_service_id: svcAdd.id, p_location_id: locPai?.id || null, p_pro_id: proPedido?.id || null, p_days: A.diasAte(paiIni), p_limit: LIM });
        if (!av || av.error) return json({ ok: false, message: (await logRecusa(env, email, op, `disponibilidade_falhou:${(av && av.error) || "?"}`, svcAdd.name), diz("agenda_fora_do_ar", b.lang)) });
        slots = av.slots || [];
        // CORTE DO MOTOR: se a lista veio cheia e não chegou ao dia do pai, "sem vaga" seria mentira.
        if (slots.length >= LIM && Date.parse(slots[slots.length - 1].start) < Date.parse(paiFim)) {
          await logRecusa(env, email, op, "janela_truncada", `${svcAdd.name} · ${pai.start}`);
          return json({ ok: false, reason: "janela_truncada", message: diz("nao_consegui_travar", b.lang) });
        }
      }
      const { coladas, mesmoDia } = A.vagasColadas(slots, { start: paiIni, end: paiFim }, { duracaoMin: Number(svcAdd.duration_min) || 60, posicao, folgaMaxMin, mesmoPro, ocupados, diaDe });
      // a pessoa escolheu uma das alternativas que ofertamos ("às 4 então") → vale, e segue ligada ao pai
      let fila = coladas;
      const quandoPedido = (b.when || b.start || "").toString();
      if (quandoPedido) {
        const m = resolveSlot(quandoPedido, [...coladas, ...mesmoDia], tzSlots);
        if (!m) {
          const altsW = [...coladas, ...mesmoDia].slice(0, 3).map((s) => `${fmt(s.start, tzSlots, b.lang)}${comQuem(b.lang, s.pro)}`).join("; ");
          await logRecusa(env, email, op, "horario_pedido_indisponivel", quandoPedido);
          return json({ ok: false, source: fonte, slots: [...coladas, ...mesmoDia].slice(0, 6).map((s) => ({ start: s.start, pro: s.pro, position: s.posicao })), message: ocupadoMsg(b.lang, altsW) });
        }
        fila = [m];
      }
      if (!fila.length) {
        const alts = mesmoDia.slice(0, 3).map((s) => `${fmt(s.start, tzSlots, b.lang)}${comQuem(b.lang, s.pro)}`).join("; ");
        await logRecusa(env, email, op, mesmoDia.length ? "sem_vaga_colada" : "sem_vaga_no_dia", `${svcAdd.name} · ${pai.service} ${pai.start}`);
        return json({ ok: false, reason: "sem_vaga_colada", source: fonte, parent_appointment_id: pai.id,
          alternatives: mesmoDia.slice(0, 6).map((s) => ({ start: s.start, pro: s.pro, position: s.posicao, gap_min: s.distancia_min })),
          message: A.addonSemColadoMsg(b.lang, { addon: svcAdd.name, pai: pai.service || "", dia: fmtDay(paiIni, tzPai, b.lang), alts }) });
      }
      // PROVA/SIMULAÇÃO: decide, não escreve (no MindBody nem o x-guileo-test escreve — mesma regra do book)
      if (prova || (fonte === "mindbody" && testMode)) {
        const c0 = fila[0];
        return json({ ok: true, dry_run: true, decision: { would_book: true, service: svcAdd.name, service_id: svcAdd.id, slot: c0.start, position: c0.posicao, same_professional: !!c0.mesmo_profissional, pro: c0.pro || "", parent_appointment_id: pai.id, source: fonte } });
      }

      // 5) RESERVA — tenta a melhor; se alguém levou o horário no meio do caminho, a próxima (até 3).
      let feito = null, ultimoMotivo = "";
      for (const c of fila.slice(0, 3)) {
        if (fonte === "mindbody") {
          const ext = await adapterBook(env, email, sc, { ...alvoMb, slot: c, name: (b.name || mirrorPai?.name || "").toString(), contact: contatoDoPai, email: emailFalado(b.email) || "", request_id: requestId, notes: `Add-on to ${pai.service || "appointment"}${pai.ref ? ` (${pai.ref})` : ""}`, attributes: elo });
          if (ext.ok) { feito = { appointment_id: ext.appointment_id || null, ref: ext.ref_falado || ext.external_ref, external_ref: ext.external_ref, start: new Date(ext.start || c.start).toISOString(), slot: c }; break; }
          ultimoMotivo = `${ext.etapa || "book"}:${ext.reason || "?"}`;
          if (!(ext.horario_tomado || ext.reason === "cliente_ja_agendado")) { await logRecusa(env, email, op, `mindbody_nao_agendou:${ultimoMotivo}`, c.start); return json({ ok: false, source: "mindbody", reason: "agenda_externa_indisponivel", message: falaAgendaExterna("nao_vejo", b.lang) }); }
        } else {
          const res = await bookIdem(env, { p_email: email, p_pro_id: c.pro_id || null, p_location_id: c.location_id || locPai?.id || null, p_service_id: svcAdd.id, p_name: (b.name || "").toString(), p_contact: contatoDoPai, p_start: c.start, p_attributes: { ...elo, position: c.posicao } }, requestId);
          if (res?.ok && res.appointment_id && res.status !== "hold") {
            // retentativa da ElevenLabs: o request_id devolve a MESMA reserva — o horário que vale é o dela
            const ja = res.idempotent ? (await rpc(env, "biz_find_appointments", { p_email: email, p_contact: contatoDoPai })).appointments?.find((a) => a.id === res.appointment_id) : null;
            feito = { appointment_id: res.appointment_id, ref: res.ref, start: new Date(ja ? ja.start : c.start).toISOString(), // a reserva que JÁ existia manda: posição e profissional saem dela, não do candidato de agora
              slot: ja ? { ...c, start: new Date(ja.start).toISOString(), pro: ja.pro, posicao: Date.parse(ja.start) >= Date.parse(paiFim) ? "after" : "before", mesmo_profissional: !!(pai.pro && norm(ja.pro) === norm(pai.pro)) } : c, idempotent: !!res.idempotent };
            break;
          }
          if (res?.ok && !res.appointment_id) { await emitFailure(env, "book_sem_id", email, "biz_book (add_service) devolveu ok sem appointment_id — NÃO confirmado ao cliente", { slot: c.start, service: svcAdd.name }).catch(() => {}); ultimoMotivo = "book_sem_id"; break; }
          ultimoMotivo = res?.reason || "reserva_nao_travou";
          if (!["slot_taken", "resource_unavailable"].includes(ultimoMotivo)) break;
        }
      }
      if (!feito) {
        await logRecusa(env, email, op, `add_on_nao_travou:${ultimoMotivo}`, `${svcAdd.name} · ${pai.id}`);
        return json({ ok: false, reason: ultimoMotivo || "reserva_nao_travou", source: fonte, message: diz(ultimoMotivo === "slot_taken" || ultimoMotivo === "resource_unavailable" || ultimoMotivo.includes("horario") ? "acabou_de_sair" : "nao_consegui_travar", b.lang) });
      }

      // 6) DEPOIS DO ID NA MÃO: comprovante com OS DOIS serviços, aviso ao dono, CRM, feed, elo da ligação.
      const c = feito.slot;
      const itens = [{ service: pai.service || "", start: paiIni }, { service: svcAdd.name, start: feito.start }];
      const whenLabel = A.rotuloQuando(itens, (iso) => fmt(iso, tzSlots, b.lang), hora);
      const proTxt = [...new Set([pai.pro, c.pro].filter(Boolean))].join(" · ");
      const refTxt = refMsg(b.lang, feito.ref);
      if (!testMode && !feito.idempotent) {
        await apptEmailOrFlag(env, email, "book", { contact: contatoDoPai, email: emailFalado(b.email) || "", name: (b.name || "").toString(), service: A.rotuloServicos(itens), whenLabel, pro: proTxt, location: locPai?.name || pai.location || "", address: locPai?.address || "", locPhone: locPai?.phone || "", ref: [pai.ref, feito.ref].filter(Boolean).join(" + "), lang: b.lang, apptId: feito.appointment_id || "" });
        if (!env.N8N_WEBHOOK && env.RESEND_API_KEY) {
          try {
            const { subject, html } = ownerAlertEmail({ kind: "booking", customer: (b.name || "").toString(), details: `➕ ${svcAdd.name}${c.pro ? ` · ${c.pro}` : ""} (add-on to ${pai.service}${pai.ref ? ` ${pai.ref}` : ""})${fonte !== "internal" ? ` · via ${fonte}` : ""}`, when: fmt(feito.start, tzSlots), lang: b.lang });
            await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: email, subject, html }) });
          } catch { /* best-effort */ }
        }
        if (fonte === "internal") await gcalPush(env, email, { summary: `${svcAdd.name} — ${(b.name || "cliente").toString()} (+ ${pai.service})`, description: `Add-on booked by Gui${c.pro ? ` · ${c.pro}` : ""}${feito.ref ? ` · ref ${feito.ref}` : ""}. Contact: ${contatoDoPai}`, location: (locPai?.address || locPai?.name || "").toString(), startIso: feito.start, durationMin: svcAdd.duration_min || 60, tz: tzSlots });
        try {
          const isEm = isEmail(contatoDoPai);
          const ur = await svcRpc(env, "crm_upsert_contact", { p_secret: env.SCHED_SECRET || "", p_email: email, p_phone: isEm ? "" : contatoDoPai, p_contact_email: isEm ? contatoDoPai : (emailFalado(b.email) || ""), p_name: (b.name || "").toString(), p_source: `gui:add_service:${fonte}`, p_amount_cents: 0 });
          const cid = ur.ok ? await ur.json().catch(() => null) : null;
          if (typeof cid === "string" && cid) await rpc(env, "crm_log_event", { p_email: email, p_contact_id: cid, p_type: "booking", p_channel: "Phone", p_summary: `Added ${svcAdd.name} to ${pai.service} — ${fmt(feito.start, tzSlots)}`.slice(0, 400), p_amount_cents: Math.max(0, svcAdd.price_cents || 0), p_dedupe: `book:${feito.appointment_id || feito.external_ref}`, p_payload: { ref: feito.ref || "", parent_appointment_id: pai.id, add_on: true } });
        } catch { /* CRM best-effort */ }
        if (b.prova !== true) await eventoDeAgendamento(env, email, { appointmentId: feito.appointment_id, provider: fonte === "internal" ? "" : fonte, externalRef: feito.external_ref, service: svcAdd.name, start: feito.start, whenLabel: fmt(feito.start, tzSlots), ref: feito.ref, canal: canalDoPedido(b, request), priceCents: Math.max(0, svcAdd.price_cents || 0) });
      }
      const convId = (request.headers.get("x-guileo-conv") || b.conversation_id || "").toString().trim();
      if (fonte === "internal" && feito.appointment_id && convId) { try { await rpc(env, "call_booking_link", { p_email: email, p_conv: convId, p_appointment: feito.appointment_id }); } catch { /* best-effort */ } }
      await logTool(env, email, op, "OK", `${svcAdd.name} ${c.posicao === "before" ? "antes" : "depois"} de ${pai.service} · ${fmt(feito.start, tzSlots)} · ref ${feito.ref || "—"} · pai ${pai.id}`);
      return json({ ok: true, source: fonte, appointment_id: feito.appointment_id, ref: feito.ref, ...(feito.external_ref ? { external_ref: feito.external_ref } : {}),
        parent_appointment_id: pai.id, start: feito.start, position: c.posicao, same_professional: !!c.mesmo_profissional, pro: c.pro || "",
        message: A.addonFeitoMsg(b.lang, { addon: svcAdd.name, pai: pai.service || "", posicao: c.posicao, quando: fmt(feito.start, tzSlots, b.lang), pro: c.pro || "", refTxt }) });
    }

    // resolve names → records
    // SERVIÇO E UNIDADE SAEM JUNTOS (bizMatch.js). Separados, "corte no Upper East Side" perdia as
    // duas pontas: a unidade não casava com nome nenhum (null → busca em tudo → oferece Astoria) e
    // o serviço genérico ganhava do gêmeo da unidade certa. 14 ligações do Natura, 0 agendamentos.
    const { svc, loc, unidadesPossiveis } = resolveServicoLocal(services, locations, pros, b.service, b.location);
    // PROFISSIONAL POR ID (2026-10-22, /agendar com escolha de profissional): a página pública manda o id
    // EXATO de quem a cliente escolheu (nome pode repetir). Id que não existe → recusa, nunca "qualquer uma".
    // Sem pro_id (agente, booking-intent) nada muda: segue o nome falado.
    const proPorId = b.pro_id ? pros.find((x) => String(x.id) === String(b.pro_id)) || null : null;
    if (b.pro_id && !proPorId) return json({ ok: false, reason: "pro_not_found", slots: [] });
    const pro = proPorId || pick(pros, b.professional || b.pro);
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
      // MINDBODY — a disponibilidade é a DELE, em horários reais no fuso do site. Se ele não
      // responder, NÃO existe plano B de horários: oferecer os do motor interno seria oferecer
      // horários que não estão na agenda de verdade do negócio. A agente diz que não consegue ver
      // a agenda e anota o recado; o motivo fica na trilha.
      if (sc.provider === "mindbody") {
        const av = await adapterAvailability(env, email, sc, { service_id: svc.id, location_id: loc?.id || null, professional_id: pro?.id || null, tz: loc?.tz || bizTz });
        if (!av.ok) {
          await logRecusa(env, email, op, `mindbody_indisponivel:${av.reason || "?"}`, `${svc.name}${loc?.name ? ` · ${loc.name}` : ""}`);
          return json({ ok: false, source: "mindbody", reason: "agenda_externa_indisponivel", slots: [], message: falaAgendaExterna("nao_vejo", b.lang) });
        }
        const slotsMb = av.slots.slice(0, 8).map((s) => ({ start: s.start, pro: s.pro, location: s.location }));
        if (!slotsMb.length) return json({ message: semVagaMsg(b.lang, svc.name, loc ? emOnde(b.lang, loc.name) : ""), slots: [], source: "mindbody" });
        const humanMb = slotsMb.slice(0, 4).map((s) => `${fmt(s.start, av.tz, b.lang)}${comQuem(b.lang, s.pro)}${loc ? "" : emOnde(b.lang, s.location)}`).join("; ");
        return json({ slots: slotsMb, source: "mindbody", message: opcoesMsg(b.lang, svc.name, loc ? emOnde(b.lang, loc.name) : "", humanMb) });
      }
      if (sc.provider !== "internal") {
        const ext = await adapterAvailability(env, email, sc, { origin, service: svc.name, location_id: loc?.id || null, professional_id: pro?.id || null });
        if (ext.handled) {
          const slots = ext.slots || [];
          if (!slots.length) return json({ message: semVagaMsg(b.lang, svc.name, loc ? emOnde(b.lang, loc.name) : ""), slots: [], source: sc.provider });
          const human = slots.slice(0, 4).map((s) => `${fmt(s.start, bizTz, b.lang)}${comQuem(b.lang, s.pro)}`).join("; ");
          return json({ slots, source: sc.provider, message: opcoesMsg(b.lang, svc.name, loc ? emOnde(b.lang, loc.name) : "", human) });
        }
      }
      // A agente pede 6 vagas (fala poucas opções). A página pública de agendamento pede uma janela
      // maior (`days`/`limit`) para montar o calendário — só quem manda os campos recebe mais.
      const pedeJanela = Number.isFinite(Number(b.limit)) && Number(b.limit) > 6;
      const av = await rpc(env, "biz_availability", {
        p_email: email, p_service_id: svc.id, p_location_id: loc?.id || null, p_pro_id: pro?.id || null,
        p_limit: pedeJanela ? Math.min(Number(b.limit), 300) : 6,
        ...(pedeJanela ? { p_days: Math.min(Math.max(parseInt(b.days, 10) || 14, 1), 30) } : {}),
      });
      // a página pública (janela longa) recebe também QUEM e QUANTO TEMPO (a duração dela, regra profissional × serviço)
      const slots = (av.slots || []).map((s) => ({ start: s.start, pro: s.pro, location: s.location, ...(pedeJanela ? { pro_id: s.pro_id || null, duration_min: s.duration_min || null } : {}) }));
      if (pedeJanela) return json({ slots, tz: loc?.tz || bizTz });
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
      // BINA (2026-09-28, ligação do Luis conv_9201…): a Lilian mandou `contact: "caller_phone"` — o
      // NOME da variável, porque o número de quem ligava não chegou nela — e depois o número por
      // extenso. Duas recusas, cliente sem horário. Agora o servidor não depende da agente: a
      // ElevenLabs manda o número de quem liga no cabeçalho `x-guileo-caller` ({{system__caller_id}})
      // e ele entra sempre que o contato vier vazio, com placeholder, ou quebrado. Número falado
      // ("nine two nine…") vira dígitos antes de tudo (lib/contato.js numeroFalado).
      // Telefone numa ligação: o BINA vence o ditado (lib/contato.js contatoDaLigacao).
      const cl = contatoDaLigacao(b.contact, request.headers.get("x-guileo-caller"));
      const contatoBruto = cl.contato;
      b.contact = contatoBruto;
      // E-MAIL SEPARADO DO TELEFONE (2026-09-28): na ligação o BINA ocupa `contact`, então o e-mail do
      // comprovante precisa de campo próprio — senão um apaga o outro. Vale também se ele veio em `contact`.
      b.email = emailFalado(b.email) || (isEmail(b.contact) ? String(b.contact).trim().toLowerCase() : "");
      if (cl.ditado) b.notes = `${(b.notes || "").toString()}${b.notes ? " · " : ""}caller also gave another number: ${cl.ditado}`.slice(0, 500);
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
        let startX = (b.when || b.start || "").toString();
        if (!startX) return json({ message: (await logRecusa(env, email, op, "sem_dia_nem_hora", b.when || b.start || ""), diz("qual_dia_e_hora", b.lang)) });
        let ext, extTz = bizTz;
        if (scB.provider === "mindbody") {
          // O QUE A PESSOA FALOU NUNCA VAI CRU PARA O MINDBODY. "amanhã às 10" ia como StartDateTime
          // e para o espelho — a mesma família do defeito que o resolveSlot matou no motor interno.
          // Agora: disponibilidade REAL do MindBody (no fuso do site) → resolveSlot sobre ELA → o
          // slot escolhido já carrega profissional e unidade do próprio MindBody. Sem casamento,
          // oferece as opções reais; MindBody fora, diz que não consegue ver a agenda.
          const naoVejo = async (motivo) => { await logRecusa(env, email, op, `mindbody_indisponivel:${motivo || "?"}`, startX); return json({ ok: false, source: "mindbody", reason: "agenda_externa_indisponivel", message: falaAgendaExterna("nao_vejo", b.lang) }); };
          const alvoMb = { service_id: svc.id, location_id: loc?.id || null, professional_id: pro?.id || null, tz: loc?.tz || bizTz };
          // `quando`: se o pedido já veio como instante ISO, o adaptador busca só aquele dia
          const avB = await adapterAvailability(env, email, scB, { ...alvoMb, quando: startX });
          if (!avB.ok) return naoVejo(avB.reason);
          extTz = avB.tz;
          const matchB = resolveSlot(startX, avB.slots, extTz);
          if (!matchB) {
            const altsB = avB.slots.slice(0, 3).map((s) => `${fmt(s.start, extTz, b.lang)}${comQuem(b.lang, s.pro)}`).join("; ");
            const disseB = oQueAPessoaDisse(startX, extTz, avB.slots);
            const slotsB = avB.slots.slice(0, 6).map((s) => ({ start: s.start, pro: s.pro, location: s.location }));
            if (!disseB.disse_dia && !disseB.disse_hora) {
              await logRecusa(env, email, op, "sem_dia_nem_hora", startX);
              return json({ ok: false, source: "mindbody", reason: "sem_horario_pedido", slots: slotsB, message: semHorarioMsg(b.lang, altsB) });
            }
            await logRecusa(env, email, op, avB.slots.length ? "horario_pedido_indisponivel" : "sem_vaga_nenhuma", startX);
            return json({ ok: false, source: "mindbody", slots: slotsB, message: ocupadoMsg(b.lang, altsB) });
          }
          // PROVA/SIMULAÇÃO NUNCA ESCREVE NO SISTEMA DO CLIENTE. No motor interno um teste vira uma
          // linha nossa, que dá para esconder; no MindBody vira um agendamento de verdade na agenda
          // do spa. Por isso dry_run, `prova:true` e x-guileo-test param AQUI, com a decisão.
          if (b.dry_run === true || b.dryRun === true || b.prova === true || testMode) {
            return json({ ok: true, dry_run: true, decision: { would_book: true, service: svc.name, service_id: svc.id, slot: matchB.start, source: "mindbody", reason_code: "slot_available" } });
          }
          startX = matchB.start;   // instante real (ISO UTC) — é o que fmt(), o e-mail e o CRM usam abaixo
          ext = await adapterBook(env, email, scB, {
            ...alvoMb, slot: matchB, name: (b.name || "").toString(), contact: (b.contact || "").toString(), email: b.email || "",
            request_id: (b.request_id || b.idempotency_key || "").toString(), notes: (b.notes || b.intake || "").toString(),
          });
          if (!ext.ok) {
            if (ext.horario_tomado || ext.reason === "cliente_ja_agendado") return json({ ok: false, source: "mindbody", message: (await logRecusa(env, email, op, `horario_tomado_na_hora:${ext.reason}`, b.when || b.start || ""), diz("acabou_de_sair", b.lang)) });
            return naoVejo(`${ext.etapa || "book"}:${ext.reason}`);
          }
        } else {
          ext = await adapterBook(env, email, scB, {
            origin, service: svc.name, start: startX,
            name: (b.name || "").toString(), contact: (b.contact || "").toString(),
            professional_id: b.staff_id || b.provider_staff_id || null,
            location_id: b.location_id || b.provider_location_id || null,
            duration_min: svc.duration_min || 60,
            mirror: { pro: pro?.name || "", location: loc?.name || "" },
          });
        }
        if (ext.handled && ext.ok) {
          // no MindBody o número falado é o id do agendamento; a referência guardada leva o site junto
          const refTxt = refMsg(b.lang, ext.ref_falado || ext.external_ref);
          if (!testMode) {
            // Same customer-facing confirmation + owner alert + CRM as the internal path. No gcalPush:
            // the external calendar IS the tenant's system of record, so there's nothing to mirror to Google.
            await apptEmailOrFlag(env, email, "book", { contact: (b.contact || "").toString(), email: b.email || "", name: (b.name || "").toString(), service: svc.name, whenLabel: fmt(startX, extTz), pro: pro?.name || "", location: loc?.name || "", address: loc?.address || "", locPhone: loc?.phone || "", ref: ext.ref_falado || ext.external_ref, lang: b.lang });
            if (!env.N8N_WEBHOOK && env.RESEND_API_KEY && email.includes("@")) { // n8n ligado = aviso vem pelo registro
              try {
                const { subject, html } = ownerAlertEmail({ kind: "booking", customer: (b.name || "").toString(), details: `${svc.name}${pro?.name ? ` · ${pro.name}` : ""}${loc?.name ? ` · ${loc.name}` : ""} · via ${scB.provider}`, when: fmt(startX, extTz), lang: b.lang });
                await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: email, subject, html }) });
              } catch { /* best-effort */ }
            }
            await rpc(env, "biz_customer_touch", { p_email: email, p_contact: (b.contact || "").toString(), p_name: (b.name || "").toString(), p_points: 10, p_visit: true });
            try {
              const c = (b.contact || "").toString(); const isEm = /.+@.+\..+/.test(c);
              const ur = await svcRpc(env, "crm_upsert_contact", { p_secret: env.SCHED_SECRET || "", p_email: email, p_phone: isEm ? "" : c, p_contact_email: isEm ? c : (b.email || ""), p_name: (b.name || "").toString(), p_source: `gui:book:${scB.provider}`, p_amount_cents: 0 });
              const cid = ur.ok ? await ur.json().catch(() => null) : null;
              if (typeof cid === "string" && cid) {
                await rpc(env, "crm_log_event", { p_email: email, p_contact_id: cid, p_type: "booking", p_channel: "Phone", p_summary: `Booked ${svc.name} for ${fmt(startX, extTz)} (via ${scB.provider})`.slice(0, 400), p_amount_cents: Math.max(0, svc.price_cents || 0), p_dedupe: `book:${scB.provider}:${ext.external_ref || startX}`, p_payload: { ref: ext.external_ref || "", source: scB.provider } });
                await rpc(env, "crm_deal_upsert", { p_email: email, p_contact_id: cid, p_title: `${svc.name}`.slice(0, 80), p_value_cents: Math.max(0, svc.price_cents || 0), p_stage: "booked", p_source: `gui-${scB.provider}` });
              }
            } catch { /* CRM best-effort */ }
            // FEED DA CENTRAL — uma vez por reserva (ver eventoDeAgendamento).
            if (b.prova !== true) await eventoDeAgendamento(env, email, { appointmentId: ext.appointment_id || null, provider: scB.provider, externalRef: ext.external_ref, service: svc.name, start: startX, whenLabel: fmt(startX, extTz), canal: canalDoPedido(b, request), priceCents: Math.max(0, svc.price_cents || 0) });
          }
          { const t = registrar(env, { cliente: email, tipo: "agendamento", nome: (b.name || "").toString(), telefone: /^\+?\d[\d\s()-]{6,}$/.test(String(b.contact || "")) ? String(b.contact) : "", email: b.email || (/@/.test(String(b.contact || "")) ? String(b.contact) : ""),
              servico: `${svc.name}${loc?.name ? ` · ${loc.name}` : ""}${pro?.name ? ` · ${pro.name}` : ""}`, quando: fmt(startX, extTz), canal: scB.provider, ref: `book:${ext.external_ref || startX}`,
              confirmacao: { name: (b.name || "").toString(), service: svc.name, whenLabel: fmt(startX, extTz), pro: pro?.name || "", location: loc?.name || "", address: loc?.address || "", locPhone: loc?.phone || "", ref: ext.ref_falado || ext.external_ref || "", lang: b.lang || "en" } });
            if (context && typeof context.waitUntil === "function") context.waitUntil(t); else await t; }
          return json({ ok: true, source: scB.provider, ref: ext.ref_falado || ext.external_ref, external_ref: ext.external_ref, message: confirmadoMsg(b.lang, { servico: svc.name, quando: fmt(startX, extTz, b.lang), segurado: false, refTxt }) });
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
            return json({ ok: false, source: scB.provider, captured: true, message: anotadoMsg(b.lang, svc.name, fmt(startX, extTz, b.lang)) });
          }
          return json({ ok: false, source: scB.provider, message: (await logRecusa(env, email, op, "horario_tomado_na_hora", b.when || b.start || ""), diz("acabou_de_sair", b.lang)) });
        }
        // ext.handled === false → external unreachable/unmappable → internal engine takes over below.
        // (só o Square chega aqui: no MindBody todo desfecho já respondeu acima — trava de segurança)
        if (scB.provider === "mindbody") return json({ ok: false, source: "mindbody", reason: "agenda_externa_indisponivel", message: (await logRecusa(env, email, op, "mindbody_sem_desfecho", startX), falaAgendaExterna("nao_vejo", b.lang)) });
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
        // 🚨 O PROFISSIONAL PEDIDO TEM QUE ENTRAR NA BUSCA (2026-08-16).
        // Esta linha buscava horário SEM `p_pro_id` e três linhas abaixo fazia
        // `proId = proId || match.pro_id` — mantendo quem a pessoa PEDIU sobre um slot que podia
        // ser de OUTRO. Quem liga e diz "com a Ana às 14h" saía marcado COM A ANA num horário que
        // era do Bruno: no dia, ou a Ana não está, ou dois clientes chegam para o mesmo barbeiro.
        // Acontece na ligação de MAIOR intenção de compra — a de quem já sabe com quem quer ir.
        //
        // POR QUE NUNCA APARECEU: o Natura tem 3 times em 3 unidades, um em cada, então o filtro
        // por unidade já sobrava um profissional só e o defeito ficava mascarado. Ele acorda na
        // primeira barbearia, salão ou clínica com duas pessoas no mesmo endereço — a maior parte
        // do mercado. Prova viva em functions/lib/agendaCenarios.js (Barbearia Dois Irmãos).
        const av = await rpc(env, "biz_availability", { p_email: email, p_service_id: svc.id, p_location_id: locId, p_pro_id: proId || null, p_limit: 30 });
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
        // PRÉ-RESERVA TAMBÉM AVISA O CLIENTE (2026-09-28): o hold não mandava NADA — a pessoa desligava
        // sem comprovante. Agora recebe "pedido recebido, a equipe confirma"; o resto segue só no book.
        if (res.status === "hold" && !testMode) await apptEmailOrFlag(env, email, "hold", { contact: (b.contact || "").toString(), email: b.email || "", name: (b.name || "").toString(), service: svc.name, whenLabel: fmt(startIso, bizTz), pro: pro?.name || "", location: loc?.name || "", address: loc?.address || "", locPhone: loc?.phone || "", ref: res.ref, lang: b.lang, apptId: res.appointment_id || "" });
        if (res.status !== "hold") {
          if (!testMode) await apptEmailOrFlag(env, email, "book", { contact: (b.contact || "").toString(), email: b.email || "", name: (b.name || "").toString(), service: svc.name, whenLabel: fmt(startIso, bizTz), pro: pro?.name || "", location: loc?.name || "", address: loc?.address || "", locPhone: loc?.phone || "", ref: res.ref, lang: b.lang, apptId: res.appointment_id || "" });
          // OWNER ALERT — ping the business owner (tenant) the instant a booking comes in, so they
          // don't have to watch the cockpit. Best-effort; tenant is pinned server-side.
          // Com o n8n ligado o dono já recebe o e-mail do registro (o MESMO que o cliente vê) — este
          // aviso vira duplicata. Sem n8n, ele continua sendo o aviso do dono.
          if (!testMode && !env.N8N_WEBHOOK && env.RESEND_API_KEY && email.includes("@")) {
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
            const ur = await svcRpc(env, "crm_upsert_contact", { p_secret: env.SCHED_SECRET || "", p_email: email, p_phone: isEm ? "" : c, p_contact_email: isEm ? c : (b.email || ""), p_name: (b.name || "").toString(), p_source: "gui:book", p_amount_cents: 0 });
            const cid = ur.ok ? await ur.json().catch(() => null) : null;
            if (typeof cid === "string" && cid) {
              await rpc(env, "crm_log_event", { p_email: email, p_contact_id: cid, p_type: "booking", p_channel: "Phone", p_summary: `Booked ${svc.name} for ${fmt(startIso, bizTz)}`.slice(0, 400), p_amount_cents: Math.max(0, svc.price_cents || 0), p_dedupe: `book:${res.appointment_id}`, p_payload: { ref: res.ref || "" } });
              await rpc(env, "crm_deal_upsert", { p_email: email, p_contact_id: cid, p_title: `${svc.name}`.slice(0, 80), p_value_cents: Math.max(0, svc.price_cents || 0), p_stage: "booked", p_source: "gui-schedule" });
            }
          } catch { /* CRM not live yet → never block the booking */ }
          // FEED DA CENTRAL — uma vez por reserva (ver eventoDeAgendamento). Só chega aqui com
          // res.ok + appointment_id + status ≠ hold: o "ok sem id" já saiu como falha lá em cima.
          if (!testMode && b.prova !== true) await eventoDeAgendamento(env, email, { appointmentId: res.appointment_id, service: svc.name, start: startIso, whenLabel: fmt(startIso, bizTz), ref: res.ref, canal: canalDoPedido(b, request), priceCents: Math.max(0, svc.price_cents || 0) });
        }
        // desfecho REAL da reserva na trilha — é o registro que faltava pra saber se a
        // ligação virou agendamento ou morreu no caminho.
        await logTool(env, email, "book", "OK", `${svc.name} · ${fmt(startIso, bizTz)} · ref ${res.ref || "—"}`);
        if (!testMode) { const t = registrar(env, { cliente: email, tipo: "agendamento", nome: (b.name || "").toString(), telefone: /^\+?\d[\d\s()-]{6,}$/.test(String(b.contact || "")) ? String(b.contact) : "", email: b.email || (/@/.test(String(b.contact || "")) ? String(b.contact) : ""),
            servico: `${svc.name}${loc?.name ? ` · ${loc.name}` : ""}${pro?.name ? ` · ${pro.name}` : ""}`, quando: fmt(startIso, bizTz), canal: "guileo", resumo: res.status === "hold" ? "Pending — spot held, confirm with the customer" : "", ref: `book:${res.appointment_id || res.ref || startIso}`,
            confirmacao: { kind: res.status === "hold" ? "hold" : "book", name: (b.name || "").toString(), service: svc.name, whenLabel: fmt(startIso, bizTz), pro: pro?.name || "", location: loc?.name || "", address: loc?.address || "", locPhone: loc?.phone || "", ref: res.ref || "", lang: b.lang || "en" } });
          if (context && typeof context.waitUntil === "function") context.waitUntil(t); else await t; }
        // SINAL (2026-10-05): serviço com sinal → o SERVIDOR gera o link no Stripe do negócio e manda
        // (texto e/ou e-mail). A frase só diz "mandei" com comprovante (lib/sinal.js fraseDoSinal);
        // sem comprovante a agente não promete link e o dono fica sabendo. Teto de 6s: a pessoa está
        // na linha. Modo de teste/prova não manda nada.
        let sinal = null, fraseSinal = "";
        // biz_lookup NÃO traz o sinal do serviço: quem decide é lib/sinal.js, que lê o cadastro no banco
        // (desk_deposit_info_svc) e só chama o Stripe quando o serviço tem sinal.
        if (res.status !== "hold" && !testMode && b.prova !== true && res.appointment_id) {
          try {
            const { mandarLinkDoSinal, fraseDoSinal } = await import("../lib/sinal.js");
            let de = "";
            try { const ag = await svcJson(env, "client_agent_resolve", { p_secret: env.INGEST_SECRET || "", p_email: email }); if (ag && ag.number) de = String(ag.number); } catch { /* remetente da plataforma */ }
            const marca = await brandFor(env, email).catch(() => null);
            sinal = await Promise.race([
              mandarLinkDoSinal(env, { tenant: email, appointmentId: res.appointment_id, contact: String(b.contact || ""), email: String(b.email || ""), name: String(b.name || ""),
                service: svc.name, whenLabel: fmt(startIso, bizTz, b.lang), business: (marca && marca.business) || "", lang: b.lang || "en", tz: loc?.tz || bizTz, de }),
              new Promise((r) => setTimeout(() => r({ ok: false, reason: "timeout", cents: 0 }), 6000)),
            ]);
            fraseSinal = fraseDoSinal(b.lang, sinal);
            // Site (/agendar): sem contato para mandar o link NÃO é falha — a própria página mostra o botão do sinal
            // (vitrine-agenda.js → sinalNaTela). Erro do Stripe no site continua avisando a dona.
            const naTela = canalDoPedido(b, request) === "web" && sinal && sinal.reason === "not_delivered";
            if (sinal && !sinal.ok && sinal.cents > 0 && !naTela && !["trusted", "already_paid", "already_sent", "no_deposit_configured", "payments_not_connected", "not_found"].includes(sinal.reason)) {
              await svcRpc(env, "ingest_client_event", { p_secret: env.INGEST_SECRET || "", p_email: email, p_type: "message", p_channel: "Phone",
                p_summary: `💳 Sinal NÃO enviado (${sinal.reason}) — ${svc.name} · ${fmt(startIso, bizTz)} · ${String(b.name || "cliente")}: mande o link pelo Balcão`.slice(0, 300),
                p_amount: 0, p_payload: { kind: "deposit_not_sent", reason: sinal.reason, appointment_id: res.appointment_id } }).catch(() => {});
            }
          } catch { /* sinal é complemento: a reserva já está de pé */ }
        }
        return json({ ok: true, appointment_id: res.appointment_id, ref: res.ref, status: res.status,
          ...(sinal ? { deposit: { cents: sinal.cents || 0, sent: !!sinal.ok, reason: sinal.reason || null, canal: sinal.ok ? (sinal.enviado?.texto?.sent ? sinal.enviado.texto.canal : "email") : null } } : {}),
          message: confirmadoMsg(b.lang, { servico: svc.name, quando: fmt(startIso, bizTz, b.lang), segurado: res.status === "hold", refTxt, extra: held }) + fraseSinal });
      }
      if (res?.reason === "slot_taken") return json({ ok: false, message: (await logRecusa(env, email, op, "horario_tomado_na_hora", b.when || b.start || ""), diz("acabou_de_sair", b.lang)) });
      // Sala/equipamento ocupado (motor de salas, 2026-10-05): para quem liga é o mesmo que o horário sair —
      // a disponibilidade não oferece horário sem sala livre, então isto só acontece numa corrida.
      if (res?.reason === "resource_unavailable") return json({ ok: false, message: (await logRecusa(env, email, op, "sala_ocupada_na_hora", b.when || b.start || ""), diz("acabou_de_sair", b.lang)) });
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
        // 🚨 O PROFISSIONAL PEDIDO TEM QUE ENTRAR NA BUSCA (2026-08-16).
        // Esta linha buscava horário SEM `p_pro_id` e três linhas abaixo fazia
        // `proId = proId || match.pro_id` — mantendo quem a pessoa PEDIU sobre um slot que podia
        // ser de OUTRO. Quem liga e diz "com a Ana às 14h" saía marcado COM A ANA num horário que
        // era do Bruno: no dia, ou a Ana não está, ou dois clientes chegam para o mesmo barbeiro.
        // Acontece na ligação de MAIOR intenção de compra — a de quem já sabe com quem quer ir.
        //
        // POR QUE NUNCA APARECEU: o Natura tem 3 times em 3 unidades, um em cada, então o filtro
        // por unidade já sobrava um profissional só e o defeito ficava mascarado. Ele acorda na
        // primeira barbearia, salão ou clínica com duas pessoas no mesmo endereço — a maior parte
        // do mercado. Prova viva em functions/lib/agendaCenarios.js (Barbearia Dois Irmãos).
        const av = await rpc(env, "biz_availability", { p_email: email, p_service_id: svc.id, p_location_id: locId, p_pro_id: proId || null, p_limit: 30 });
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
    return json({ message: diz("soluco", idiomaDoPedido) }, 200);
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

  // ── SUGESTÃO DE FERIADOS (2026-08-22) ────────────────────────────────────────────────────────
  // A tabela de datas especiais estava VAZIA para todo mundo: o motor existia e ninguém alimentou.
  // Aqui os feriados do país chegam prontos, marcados com o que o dono JÁ salvou — mas nada é
  // aplicado sozinho. Fechar a loja de alguém por conta própria seria recusar dinheiro que ele
  // queria receber (salão em véspera de feriado é o dia mais cheio). Ele aprova o que quiser.
  if (action === "special_holidays") {
    const pais = (b.country || "US").toString().trim().toUpperCase();
    const lista = await feriadosDaqui(pais);
    // null = NÃO DEU PRA SABER. Devolver [] aqui faria a tela dizer "nenhum feriado este ano",
    // que é mentira com cara de dado. O motivo vai junto, com chave pra traduzir sem casar texto.
    if (lista === null) {
      return json({ ok: false, ready: true, holidays: null,
        reasonKey: "feriados_indisponivel",
        reason: `não consegui consultar os feriados de ${pais} agora — isto NÃO é "não há feriados"` });
    }
    // Cruza com o que já existe pro dono não reaprovar o que já aprovou.
    let jaTem = new Set();
    try {
      const r = await fetch(`${SB}/rest/v1/rpc/biz_list_special_dates`, {
        method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_secret: env.SCHED_SECRET || "", p_email: email, p_days: 730 }),
      });
      if (r.ok) {
        const rj = await r.json().catch(() => null);
        if (Array.isArray(rj?.dates)) jaTem = new Set(rj.dates.map((d) => String(d?.date || d)));
      }
    } catch { /* não saber o que já existe só faz sugerir de novo — nunca esconde feriado */ }
    return json({
      ok: true, ready: true, country: pais,
      // `nomeLocal` é TEXTO DE TERCEIRO: vai pra tela como conteúdo, nunca pra prompt sem cerca.
      holidays: lista.slice(0, 40).map((f) => ({ ...f, ja_salvo: jaTem.has(f.date) })),
      nota: "sugestão — nada foi aplicado. O dono escolhe o que fecha.",
    });
  }

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
