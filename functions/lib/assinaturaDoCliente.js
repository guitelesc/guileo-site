// functions/lib/assinaturaDoCliente.js — A ASSINATURA É DO CLIENTE DO NEGÓCIO, NÃO DA GUILEO (2026-10-01)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// O negócio vende uma mensalidade ao cliente DELE (packages.js marca a assinatura no Stripe com
// metadata { guileo:"membership", client_email:<negócio>, id:<mensalidade> }). Quando esse cliente
// cancelava ou o cartão falhava, o webhook tratava o evento como cobrança da GUILEO: o assinante
// continuava "ativo" no painel do negócio e o cliente final recebia o e-mail de cobrança da Guileo.
// Esta função só LÊ o evento e diz de quem ele é. Devolve null quando não é assinatura de cliente —
// aí o webhook segue o caminho de sempre (a cobrança da própria Guileo).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assinaturaDoCliente(type, obj) {
  const o = obj || {};
  let meta = null, subId = "", status = "";
  if (type === "customer.subscription.deleted") {
    meta = o.metadata; subId = o.id; status = "canceled";
  } else if (type === "invoice.payment_failed") {
    // A fatura carrega a metadata da assinatura em um de dois lugares, conforme a versão da API.
    const det = o.subscription_details || (o.parent && o.parent.subscription_details) || {};
    meta = det.metadata; subId = o.subscription || det.subscription; status = "past_due";
  } else return null;
  if (!meta || meta.guileo !== "membership") return null;
  const tenant = (meta.client_email || "").toString().trim().toLowerCase();
  const id = (meta.id || "").toString().trim();
  subId = (subId && typeof subId === "object" ? subId.id : subId || "").toString().trim();
  // Sem os três não dá para saber QUAL assinante mudar — e palpite aqui cancelaria a pessoa errada.
  if (!tenant.includes("@") || !UUID.test(id) || !/^sub_[A-Za-z0-9]+$/.test(subId)) return { incompleta: true, tenant, subId };
  return { tenant, id, subId, status };
}
