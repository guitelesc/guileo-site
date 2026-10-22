// FILA DE ESPERA — quem avisa a próxima pessoa quando uma vaga abre (2026-10-05).
//
// Antes só o cancelamento PELA IA (agent-schedule op=cancel) oferecia a vaga. Cancelar no Balcão ou
// pelo link "remarcar/cancelar" da cliente deixava a vaga vazia e a lista parada — a apresentação do
// Natura promete o contrário ("abriu vaga, a Lilian oferece pra quem está esperando").
//
// biz_waitlist_fill_on_cancel ESCOLHE e MARCA a próxima pessoa como avisada antes do envio. Por isso
// todo envio aqui devolve comprovante, e se não chegar o dono recebe no feed "ligue pra oferecer" —
// a vaga não pode sumir em silêncio.
import { waitlistOfferEmail } from "./emailTemplates.js";
import { sendText } from "./twilio.js";
import { svcJson } from "./sb.js";
import { brandFor } from "./clientBrand.js";

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ""));
const isFone = (s) => /^[0-9+][0-9\s()\-]{6,}$/.test(String(s || ""));

const TEXTO = {
  pt: (s, n) => `🌱 ${n || "Olá"}: abriu uma vaga${s ? ` pra ${s}` : ""}! Você estava na lista de espera — quer que eu reserve? É só responder.`,
  es: (s, n) => `🌱 ${n || "Hola"}: ¡se liberó un lugar${s ? ` para ${s}` : ""}! Estabas en la lista de espera — ¿lo reservo? Solo responde.`,
  en: (s, n) => `🌱 ${n || "Hi"}: a spot just opened${s ? ` for ${s}` : ""}! You were on the waitlist — want me to hold it? Just reply.`,
};

async function avisaDono(env, tenant, resumo, payload) {
  await svcJson(env, "ingest_client_event", {
    p_secret: env.INGEST_SECRET || "", p_email: tenant, p_type: "message", p_channel: "waitlist",
    p_summary: resumo.slice(0, 300), p_amount: 0, p_payload: { kind: "waitlist_offer", ...payload },
  }).catch(() => null);
}

// deps.motor(fn, body) chama o motor de agenda COM o segredo do servidor (cada rota já tem o seu).
// Devolve { offered:false, reason } ou { offered:true, via, to, receipt } — nunca lança.
export async function oferecerVaga(env, { tenant, appointmentId, lang = "en" }, deps = {}) {
  try {
    const w = await deps.motor("biz_waitlist_fill_on_cancel", { p_email: tenant, p_appointment_id: appointmentId });
    if (!w?.ok) return { offered: false, reason: w?.error || w?.reason || "motor_failed" };
    if (!w.filled || !w.contact) return { offered: false, reason: "nobody_waiting" };
    const contato = String(w.contact).trim();
    const L = ["pt", "es"].includes(lang) ? lang : "en";
    const marca = await (deps.brandFor || brandFor)(env, tenant).catch(() => null);
    const negocio = marca?.name && marca.name !== "Guileo" ? marca.name : "";

    if (isEmail(contato)) {
      if (!env.RESEND_API_KEY) {
        await avisaDono(env, tenant, `⚠️ Abriu vaga${w.service ? ` de ${w.service}` : ""} e ${w.name || contato} está na fila, mas o e-mail não está ligado — ligue pra oferecer`, { delivery: "failed", to: contato, reason: "email_off" });
        return { offered: false, reason: "email_off", to: contato };
      }
      const { subject, html } = waitlistOfferEmail({ name: w.name || "", business: negocio, service: w.service || "", lang: L, bizEmail: tenant, brand: marca });
      const r = await (deps.fetch || fetch)("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: contato, reply_to: tenant, subject, html }),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.id) {
        await avisaDono(env, tenant, `🌱 Vaga${w.service ? ` de ${w.service}` : ""} oferecida a ${w.name || contato} (lista de espera) por e-mail`, { delivery: "sent", via: "email", to: contato, receipt: j.id });
        return { offered: true, via: "email", to: contato, receipt: j.id };
      }
      await avisaDono(env, tenant, `⚠️ Oferta da vaga NÃO chegou a ${w.name || contato} (e-mail recusado) — ligue pra oferecer`, { delivery: "failed", to: contato, status: r.status });
      return { offered: false, reason: "email_failed", to: contato };
    }
    if (isFone(contato)) {
      const ph = contato.replace(/[^0-9+]/g, "");
      const t = await (deps.sendText || sendText)(env, ph, TEXTO[L](w.service, negocio).slice(0, 300), { channel: "whatsapp" });
      if (t?.sent) {
        await avisaDono(env, tenant, `🌱 Vaga${w.service ? ` de ${w.service}` : ""} oferecida a ${w.name || ph} (lista de espera) por mensagem`, { delivery: "sent", via: t.channel || "text", to: ph, receipt: t.sid || t.id || null });
        return { offered: true, via: t.channel || "text", to: ph, receipt: t.sid || t.id || null };
      }
      await avisaDono(env, tenant, `⚠️ Oferta da vaga NÃO chegou em ${ph} (${t?.reason || `HTTP ${t?.status || "?"}`}) — ligue pra oferecer`, { delivery: "failed", to: ph, reason: t?.reason || null });
      return { offered: false, reason: t?.reason || "text_failed", to: ph };
    }
    await avisaDono(env, tenant, `⚠️ Abriu vaga e ${w.name || "alguém"} está na fila com um contato que não entendi (${contato.slice(0, 40)}) — ligue pra oferecer`, { delivery: "failed", to: contato, reason: "bad_contact" });
    return { offered: false, reason: "bad_contact" };
  } catch (e) {
    return { offered: false, reason: "error", detail: String(e?.message || e).slice(0, 120) };
  }
}
