// POST /api/reserva — a CLIENTE do negócio vê, remarca ou cancela a própria reserva (2026-10-05).
// Porta: o link assinado do e-mail de confirmação (lib/visita.js, proposito "reserva"): t=negócio,
// a=agendamento, s=assinatura. Sem assinatura válida, nada. O tenant NUNCA vem de outro lugar.
//   { t, a, s, action:"get" }                  → a reserva (serviço, quando, onde, política)
//   { t, a, s, action:"slots", dia? }          → vagas da MESMA profissional (até 21 dias)
//   { t, a, s, action:"reschedule", start }    → muda o horário (motor confere choque/dia fechado)
//   { t, a, s, action:"cancel" }               → cancela (libera para a fila de espera)
// POLÍTICA: dentro da janela de cancelamento do serviço (cancel_window_h) a página NÃO muda nada —
// pede para ligar. Reserva passada, cancelada, falta ou já paga no caixa também não mudam.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { svcJson, SB_URL } from "../lib/sb.js";
import { visitaConfere } from "../lib/visita.js";
import { oferecerVaga } from "../lib/filaDeEspera.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
async function motor(env, fn, body) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_secret: env.SCHED_SECRET || "", ...body }) });
    return { ok: r.ok, data: await r.json().catch(() => null) };
  } catch { return { ok: false, data: null }; }
}

// O que a cliente pode fazer agora, e por quê não (a página mostra o motivo).
function podeMudar(r, agora = Date.now()) {
  if (!r || !r.ok) return { pode: false, motivo: "not_found" };
  if (r.status === "cancelled") return { pode: false, motivo: "cancelled" };
  if (r.status === "no_show" || r.desk_status === "completed") return { pode: false, motivo: "past" };
  const ini = Date.parse(r.start);
  if (!(ini > agora)) return { pode: false, motivo: "past" };
  const janelaH = Number(r.cancel_window_h) || 0;
  if (janelaH > 0 && ini - agora < janelaH * 3600000) return { pode: false, motivo: "inside_window", janela_h: janelaH };
  return { pode: true };
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ ok: false, error: "forbidden" }, 403);
  if (await rateLimited(request, env, "reserva", 30)) return json({ ok: false, error: "too many requests" }, 429);
  let b = {}; try { b = await request.json(); } catch { return json({ ok: false, error: "bad body" }, 400); }
  const tenant = String(b.t || "").trim().toLowerCase().slice(0, 200);
  const id = String(b.a || "").trim().toLowerCase();
  if (!tenant.includes("@") || !UUID.test(id) || !(await visitaConfere(env, tenant, id, b.s, "reserva"))) return json({ ok: false, error: "invalid_link" }, 401);

  const r = await svcJson(env, "desk_self_get_svc", { p_tenant: tenant, p_id: id });
  if (!r || r.ok !== true) return json({ ok: false, error: "not_found" }, 404);
  const regra = podeMudar(r);
  const publico = { ok: true, ref: r.ref, status: r.status === "cancelled" ? "cancelled" : (r.desk_status || r.status), start: r.start, end: r.end,
    customer_name: r.customer_name, service: r.service, duration_min: r.duration_min, pro: r.pro, location: r.location, address: r.address,
    phone: r.phone, tz: r.tz, business: r.business, deposit_paid: r.deposit_paid, cancel_window_h: r.cancel_window_h, pode_mudar: regra.pode, motivo: regra.motivo || null };
  const action = String(b.action || "get");
  if (action === "get") return json(publico);
  if (!regra.pode) return json({ ok: false, error: regra.motivo, ...publico, ok_reserva: true }, 409);
  if (!env.SCHED_SECRET) return json({ ok: false, error: "unavailable" }, 503);

  if (action === "slots") {
    const av = await motor(env, "biz_availability", { p_email: tenant, p_service_id: r.service_id, p_location_id: r.location_id, p_pro_id: r.pro_id, p_days: 21, p_limit: 300 });
    if (!av.ok || !Array.isArray(av.data?.slots)) return json({ ok: false, error: "unavailable" }, 503);
    const fmtDia = (iso) => { try { return new Intl.DateTimeFormat("en-CA", { timeZone: r.tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)); } catch { return ""; } };
    const todas = av.data.slots.filter((x) => x && x.start && x.start !== r.start);
    const dias = [...new Set(todas.map((x) => fmtDia(x.start)))];
    const dia = /^\d{4}-\d{2}-\d{2}$/.test(String(b.dia || "")) ? b.dia : dias[0] || "";
    return json({ ok: true, tz: r.tz, dias, dia, slots: todas.filter((x) => fmtDia(x.start) === dia).map((x) => ({ start: x.start })) });
  }
  if (action === "reschedule") {
    const novo = String(b.start || "");
    if (Number.isNaN(Date.parse(novo)) || Date.parse(novo) % 60000 !== 0 || Date.parse(novo) <= Date.now()) return json({ ok: false, error: "bad_time" }, 400);
    const m = await motor(env, "biz_reschedule", { p_email: tenant, p_appointment_id: id, p_new_start: novo });
    if (!m.ok || m.data?.ok !== true) return json({ ok: false, error: m.data?.reason || "failed" }, 409);
    await svcJson(env, "desk_self_mark_svc", { p_tenant: tenant, p_id: id, p_acao: "reschedule" });
    await svcJson(env, "ingest_client_event", { p_secret: env.INGEST_SECRET || "", p_email: tenant, p_type: "booking", p_channel: "web",
      p_summary: `🔁 ${r.customer_name || "Cliente"} remarcou sozinha: ${r.service || ""} → ${new Date(novo).toLocaleString("en-US", { timeZone: r.tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`.slice(0, 300),
      p_amount: 0, p_payload: { kind: "self_reschedule", appointment_id: id, from: r.start, to: novo } }).catch(() => null);
    // O horário antigo ficou livre — também é vaga para a fila.
    await oferecerVaga(env, { tenant, appointmentId: id, lang: b.lang || "en" }, { motor: async (fn, body) => (await motor(env, fn, body)).data });
    return json({ ok: true, start: novo });
  }
  if (action === "cancel") {
    const m = await motor(env, "biz_cancel", { p_email: tenant, p_appointment_id: id });
    if (!m.ok || m.data?.ok !== true) return json({ ok: false, error: "failed" }, 409);
    await svcJson(env, "desk_self_mark_svc", { p_tenant: tenant, p_id: id, p_acao: "cancel" });
    // Quem cancelou = a cliente, pelo link (o gatilho do banco já guardou QUANDO; db/desk_v6_cancelamento.sql).
    // É o que deixa o balcão cobrar a taxa de cancelamento em cima da hora. Falha aqui não desfaz nada.
    await Promise.resolve(svcJson(env, "desk_cancelled_by_svc", { p_tenant: tenant, p_id: id, p_by: "cliente" })).catch(() => null);
    // Vaga liberada vai para a próxima da fila (lib/filaDeEspera.js: envia com comprovante e avisa o
    // dono se não chegou). Nunca bloqueia o cancelamento.
    const fila = await oferecerVaga(env, { tenant, appointmentId: id, lang: b.lang || "en" }, { motor: async (fn, body) => (await motor(env, fn, body)).data });
    await svcJson(env, "ingest_client_event", { p_secret: env.INGEST_SECRET || "", p_email: tenant, p_type: "booking", p_channel: "web",
      p_summary: `✖ ${r.customer_name || "Cliente"} cancelou sozinha: ${r.service || ""} · ${new Date(r.start).toLocaleString("en-US", { timeZone: r.tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`.slice(0, 300),
      p_amount: 0, p_payload: { kind: "self_cancel", appointment_id: id } }).catch(() => null);
    return json({ ok: true, status: "cancelled", fila: fila.offered ? "offered" : fila.reason });
  }
  return json({ ok: false, error: "unknown action" }, 400);
}
