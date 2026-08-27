// AVISO DE LEAD INBOUND PRO VENDEDOR — o lead que chega pelo `?ref=` de um vendedor tem que
// ACORDAR esse vendedor, não esperar mudo até ele lembrar de abrir a aba.
//
// POR QUE ESTE ARQUIVO EXISTE (e é uma lib, não código dentro do /api/lead):
//   O lead nasce em functions/api/lead.js — ele grava o "👤ref:<slug>" no `details` do gui_actions,
//   que é o que TODA a atribuição de vendedor lê depois. Esse é o ponto de escrita, e é lá que o
//   aviso tem que sair. Mas /api/lead é a via de maior tráfego do site: quanto menos corpo estranho
//   ele carregar, melhor. Aqui fica a regra inteira; lá fica uma linha.
//
// LEIS RESPEITADAS:
//   • e-mail SEMPRE por emailTemplates.js (nunca HTML ad-hoc);
//   • o destinatário vem do ROSTER (RPC seller_by_ref, INGEST-gated) — jamais de um endereço
//     digitado num formulário público; um ref desconhecido simplesmente não manda nada;
//   • CHECAR O RETORNO DO ENVIO: `await send()` sem conferir `ok` já escondeu dois bugs neste
//     repo. Falhou → emitFailure, com o motivo real;
//   • best-effort: NADA aqui pode derrubar ou atrasar a captura do lead.
import { sellerLeadInboundEmail } from "./emailTemplates.js";
import { emitFailure } from "./failure.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

// Devolve { ok, motivo? } — quem chama pode logar, mas nunca deve depender disto pra responder.
export async function avisaVendedorDoLead(env, { ref = "", name = "", phone = "", source = "", lang = "pt" } = {}) {
  const slug = (ref || "").toString().trim().slice(0, 40);
  const ING = env && env.INGEST_SECRET;
  if (!slug) return { ok: false, motivo: "sem_ref" };
  if (!ING) return { ok: false, motivo: "sem_ingest" };
  if (!env.RESEND_API_KEY) return { ok: false, motivo: "sem_resend" };
  try {
    const r = await fetch(`${SB}/rest/v1/rpc/seller_by_ref`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: ING, p_ref: slug }),
    });
    if (!r.ok) return { ok: false, motivo: `seller_by_ref respondeu ${r.status}` };
    const seller = await r.json().catch(() => null);
    // ref que não é de vendedor nenhum (campanha, apelido antigo) → não é erro, é só nada a fazer.
    if (!seller || !seller.email || !String(seller.email).includes("@")) return { ok: false, motivo: "ref_sem_vendedor" };

    const { subject, html } = sellerLeadInboundEmail({
      sellerName: seller.name || "", leadName: name || "", leadPhone: phone || "",
      veio_de: source || "", lang: lang === "en" ? "en" : "pt",
    });
    const er = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [seller.email], subject, html }),
    });
    // 🚨 "await" NÃO É "enviado". Sem conferir o retorno, um lead quente vira silêncio e ninguém
    // fica sabendo que o aviso não saiu — que é justamente o defeito que este aviso corrige.
    if (!er.ok) {
      const cru = await er.text().catch(() => "");
      await emitFailure(env, "aviso_lead_vendedor_nao_saiu", seller.email,
        `o aviso de LEAD NOVO não saiu (HTTP ${er.status}) — ligue você mesmo`, { ref: slug, cru: cru.slice(0, 160) }).catch(() => {});
      return { ok: false, motivo: `resend ${er.status}` };
    }
    return { ok: true, para: seller.email };
  } catch (e) {
    return { ok: false, motivo: String(e).slice(0, 140) };
  }
}
