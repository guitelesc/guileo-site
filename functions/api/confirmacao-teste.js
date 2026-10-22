// GET /api/confirmacao-teste?tenant=<e-mail do negócio>&kind=book|hold · x-guileo-secret: INGEST
// Manda a confirmação de agendamento PELO MESMO CAMINHO de uma reserva real (sendApptEmail: marca do
// negócio, remetente com o nome dele, reply_to pro negócio, Resend) — mas SÓ para o e-mail do dono da
// Guileo. Existe porque "o template renderiza" não prova que o cliente recebe; o id do Resend prova.
// Destinatário FIXO de propósito: uma rota de teste que aceitasse `to=` viraria disparador de e-mail.
import { json, safeEq } from "../lib/guard.js";
import { sendApptEmail } from "./agent-schedule.js";

const PARA = "luistelesc@gmail.com";

export async function onRequestGet({ request, env }) {
  if (!env.INGEST_SECRET || !safeEq(request.headers.get("x-guileo-secret") || "", env.INGEST_SECRET)) return json({ error: "unauthorized" }, 401);
  const q = new URL(request.url).searchParams;
  const tenant = (q.get("tenant") || "naturaspaadm@gmail.com").toLowerCase().slice(0, 120);
  const kind = q.get("kind") === "hold" ? "hold" : "book";
  const p = { tenant, contact: "+19295350191", email: PARA, name: "Luis", service: "Deep Tissue Massage 60min",
    whenLabel: "Tue, Sep 29 · 6:00 PM", location: "Astoria", address: "30-79 Steinway Street, Astoria, NY 11103",
    locPhone: "(718) 956-5530", ref: "GUI-TEST", lang: "en",
    // `&a=<id de um agendamento do tenant>` → o e-mail sai com o link "quando é o seu aniversário?"
    apptId: (q.get("a") || "").slice(0, 40) };
  const ok = await sendApptEmail(env, kind, p);
  return json({ ok, kind, recibo: p.recibo || null });
}
