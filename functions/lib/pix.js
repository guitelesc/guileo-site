// PIX — a Gui cobra o cliente-DO-cliente, na conta Mercado Pago DELE.
//
// POR QUE ISTO EXISTE: o caminho "fecha e cobra" da plataforma era Stripe-only. No Brasil
// isso é um beco sem saída — Stripe Connect mal existe pro pequeno negócio, e ninguém paga
// serviço local por checkout de redirect. Paga por PIX copia-e-cola, em 10 segundos, ainda
// na conversa. Sem isto, todo cliente BR caía em "connect Stripe to collect" e a venda morria.
//
// AS LEIS DESTE ARQUIVO (ARQUITETURA.md §💰):
//   • O dinheiro é DO CLIENTE. Cobramos com o token DELE; a Guileo nunca é intermediária.
//   • Este caminho NUNCA credita crédito Guileo — é fisicamente separado do fluxo de planos
//     (endpoint /api/pix-webhook, RPC pix_collect_record). Confundir os dois transformaria a
//     venda de R$799 de um spa em "plano Essential grátis".
//   • external_reference SEMPRE no namespace "cli:<tenant>|<ref>" — é o que impede o webhook
//     de planos de sequer olhar pra esta cobrança.
//   • X-Idempotency-Key obrigatório: um retry de rede não pode gerar dois QR do mesmo pedido.
const MP = "https://api.mercadopago.com";

// Namespace do external_reference. "cli:" = cobrança DO CLIENTE (nunca plano da Guileo).
export const CLI_PREFIX = "cli:";
export const cliRef = (tenant, ref) => `${CLI_PREFIX}${String(tenant || "").toLowerCase()}|${String(ref || "")}`;
export function parseCliRef(extRef) {
  const s = String(extRef || "");
  if (!s.startsWith(CLI_PREFIX)) return null;              // não é cobrança de cliente → não é nosso
  const [tenant, ...rest] = s.slice(CLI_PREFIX.length).split("|");
  const t = (tenant || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return null;  // tenant precisa ser e-mail válido
  return { tenant: t, ref: rest.join("|").trim() };
}

// Credencial MP do tenant (client_integrations, provider 'mercadopago'). Service-role only.
export async function tenantMp(env, tenantEmail) {
  if (!env.INGEST_SECRET || !tenantEmail) return { ready: false };
  try {
    const { svcRpc } = await import("./sb.js");
    const r = await svcRpc(env, "mp_tenant_lookup", { p_secret: env.INGEST_SECRET, p_email: tenantEmail });
    if (!r || !r.ok) return { ready: false };
    const d = await r.json().catch(() => null);
    return d && d.ready ? d : { ready: false };
  } catch { return { ready: false }; }
}

// Cria uma cobrança PIX real e devolve o copia-e-cola + QR.
//   amountCents: inteiro em centavos de BRL (nunca float de reais — evita 0.1+0.2)
//   ref:         identificador do pedido, ÚNICO por tenant (vira a chave de idempotência)
export async function mintPix(env, tenantEmail, { amountCents, description, payerEmail, payerName, ref, expiresMin = 30 }) {
  const cents = Math.round(Number(amountCents));
  if (!Number.isFinite(cents) || cents <= 0) return { ok: false, reason: "bad_amount" };
  // Teto de defesa em profundidade: a Gui é um agente, e um agente pode errar um zero.
  const MAX = Number(env.MAX_CHARGE_BRL) || 100000;              // em REAIS
  if (cents / 100 > MAX) return { ok: false, reason: "over_cap" };
  if (!ref) return { ok: false, reason: "no_ref" };

  const mp = await tenantMp(env, tenantEmail);
  if (!mp.ready) return { ok: false, reason: "mp_not_connected" };

  // O MP exige payer.email. Sem e-mail do comprador (típico numa ligação) usamos um
  // endereço determinístico e ÓBVIO — nunca um e-mail real inventado.
  const payer = { email: (payerEmail || "").trim() || "sem-email@guileoai.com" };
  if (payerName) {
    const [first, ...last] = String(payerName).trim().split(/\s+/);
    payer.first_name = first.slice(0, 40);
    if (last.length) payer.last_name = last.join(" ").slice(0, 40);
  }

  const expires = new Date(Date.now() + Math.max(5, Math.min(1440, expiresMin)) * 60000);
  try {
    const r = await fetch(`${MP}/v1/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mp.access_token}`,
        "Content-Type": "application/json",
        // Idempotência no PROVEDOR: mesmo ref = mesma cobrança, nunca um segundo QR.
        "X-Idempotency-Key": cliRef(tenantEmail, ref).slice(0, 250),
      },
      body: JSON.stringify({
        transaction_amount: Number((cents / 100).toFixed(2)),
        description: String(description || "Pagamento").slice(0, 250),
        payment_method_id: "pix",
        payer,
        external_reference: cliRef(tenantEmail, ref),
        // O tenant vai na URL porque o webhook precisa saber COM QUAL TOKEN buscar o
        // pagamento — e o token só se descobre sabendo o tenant. É uma DICA, não autoridade:
        // o webhook busca o pagamento na conta desse tenant e, se não existir lá, ignora.
        // Um POST forjado com ?t=<vítima> não credita nada, porque o pagamento não está na
        // conta da vítima. E o external_reference tem que bater com o mesmo tenant.
        notification_url: `https://guileoai.com/api/pix-webhook?t=${encodeURIComponent(String(tenantEmail).toLowerCase())}`,
        date_of_expiration: expires.toISOString().replace("Z", "-00:00"), // MP quer offset explícito
      }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, reason: "mp_error", status: r.status, detail: (d && (d.message || d.error)) || "" };
    const tx = d?.point_of_interaction?.transaction_data || {};
    if (!tx.qr_code) return { ok: false, reason: "no_qr", detail: d?.status_detail || "" };
    return {
      ok: true,
      id: String(d.id || ""),
      copiaECola: tx.qr_code,                 // o que o cliente cola no app do banco
      qrBase64: tx.qr_code_base64 || "",      // PNG em base64 (mostrar no cockpit/webchat)
      ticketUrl: tx.ticket_url || "",
      amountCents: cents,
      expiresAt: expires.toISOString(),
    };
  } catch (e) { return { ok: false, reason: "transport", detail: String(e).slice(0, 120) }; }
}

// Texto pronto pro WhatsApp/SMS. O copia-e-cola vai SOZINHO na última linha: qualquer
// caractere colado junto quebra o pagamento no app do banco.
export function pixMessage({ business, amountCents, description, copiaECola, expiresMin = 30 }) {
  const v = (amountCents / 100).toFixed(2).replace(".", ",");
  return `${business ? business + " · " : ""}${description || "Pagamento"}\nValor: R$ ${v}\n\nÉ só copiar o código abaixo e colar no PIX do seu banco (vale ${expiresMin} min):\n\n${copiaECola}`;
}
