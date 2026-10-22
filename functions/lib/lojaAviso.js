// O SALÃO FICA SABENDO DO PEDIDO DA LOJA (2026-10-04)
// Sem isto o pedido pago só aparecia no painel: ninguém no balcão separava a retirada, e a cliente
// chegava para buscar algo que ninguém sabia que existia. Mesmo caminho do aviso de NOVA RESERVA
// (agent-schedule.js): e-mail pela Resend no endereço do negócio + texto (WhatsApp, cai para SMS) no
// telefone de alerta que o dono cadastrou (client_notify_phone_lookup). Melhor esforço: o aviso
// nunca derruba o registro da venda — devolve o que saiu para o webhook decidir se alarma.
import { ownerAlertEmail } from "./emailTemplates.js";
import { sendOrFlag } from "./twilio.js";
import { textoDoPedido } from "./loja.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

export async function avisarPedidoLoja(env, { tenant = "", negocio = "", cliente = "", itens = [], entrega = "", endereco = "", cents = 0 } = {}) {
  const saiu = { email: false, texto: false };
  if (!String(tenant).includes("@")) return saiu;
  const { texto, detalhes } = textoDoPedido({ cliente, itens, entrega, endereco, cents });

  if (env.RESEND_API_KEY) {
    try {
      const { subject, html } = ownerAlertEmail({ kind: "loja", customer: cliente, business: negocio, details: detalhes, amount: cents ? (cents / 100).toFixed(2) : "", lang: "en" });
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: tenant, subject, html }),
      });
      saiu.email = r.ok;
    } catch { /* segue para o texto */ }
  }

  if (env.INGEST_SECRET) {
    try {
      // INGEST-gated: PostgREST direto com o INGEST_SECRET (o mesmo cuidado do agent-schedule.js).
      const pr = await fetch(`${SB_URL}/rest/v1/rpc/client_notify_phone_lookup`, {
        method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_secret: env.INGEST_SECRET, p_email: tenant }),
      });
      const tel = pr.ok ? ((await pr.json()) || "").toString() : "";
      if (/^[0-9+]{8,}$/.test(tel)) {
        const r = await sendOrFlag(env, { to: tel, body: texto, opts: { channel: "whatsapp" }, tenant, motivo: "aviso de pedido da loja ao dono" });
        saiu.texto = !!(r && r.sent);
      }
    } catch { /* o e-mail (se saiu) já cobre */ }
  }
  return saiu;
}
