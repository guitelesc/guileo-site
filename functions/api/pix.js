// Cloudflare Pages Function — POST /api/pix
//
// A boca do motor de PIX (functions/lib/pix.js). Três ações, DOIS portões diferentes:
//
//   connect | status   → portão do TENANT (email + chave de conexão via get_client_data,
//                        mesmo padrão do noshow-radar). É o dono conectando a conta dele.
//   charge             → portão do AGENTE (AGENT_ACTION_SECRET). É a Gui cobrando na conversa.
//
// Nenhuma ação aqui toca crédito Guileo. O dinheiro é sempre do cliente.
import { json, safeEq } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";
import { mintPix, tenantMp, pixMessage } from "../lib/pix.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ""));

// Liga o e-mail do cockpit à chave de conexão dele. Sem isso, um tenant poderia conectar
// (ou ler) a conta de pagamento de outro só trocando o e-mail no corpo do request.
async function tenantOk(email, key) {
  if (!isEmail(email) || !key) return false;
  try {
    const r = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!r.ok) return false;
    const d = await r.json().catch(() => null);
    return !!d && (Array.isArray(d) ? d.length > 0 : typeof d === "object");
  } catch { return false; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const action = (b.action || "").toString();
    const email = (b.email || b.client_email || "").toString().trim().toLowerCase();

    // ── AÇÕES DO DONO (cockpit) ────────────────────────────────────────────────
    if (action === "connect" || action === "status") {
      if (!(await tenantOk(email, (b.key || "").toString()))) return json({ error: "unauthorized" }, 401);

      if (action === "status") {
        const mp = await tenantMp(env, email);
        return json({ ok: true, ready: !!mp.ready, label: mp.label || "" });
      }

      const token = (b.token || "").toString().trim();
      // Sanidade mínima: token de produção do MP começa com APP_USR-. Um valor colado errado
      // (chave pública, token de teste) falharia só na hora da venda — checar agora é barato.
      if (!token.startsWith("APP_USR-")) {
        return json({ error: "token inválido — cole o Access Token de PRODUÇÃO do Mercado Pago (começa com APP_USR-)" }, 400);
      }
      // Verifica CONTRA O MERCADO PAGO antes de guardar. Guardar um token quebrado seria
      // exatamente o tipo de falha silenciosa que a plataforma acabou de varrer: o dono veria
      // "conectado ✅" e só descobriria o erro quando uma venda real não fosse cobrada.
      const probe = await fetch("https://api.mercadopago.com/users/me", { headers: { Authorization: `Bearer ${token}` } });
      if (!probe.ok) return json({ error: `o Mercado Pago recusou esse token (${probe.status}) — confira e cole de novo` }, 400);
      const me = await probe.json().catch(() => ({}));
      const label = [me.nickname, me.email].filter(Boolean).join(" · ").slice(0, 80);

      const r = await svcRpc(env, "mp_tenant_connect", {
        p_secret: env.INGEST_SECRET || "", p_email: email, p_token: token, p_label: label,
      });
      if (!r || !r.ok) return json({ error: "não consegui guardar a conexão — tente de novo" }, 500);
      return json({ ok: true, ready: true, label });
    }

    // ── AÇÃO DO AGENTE (a Gui cobrando) ────────────────────────────────────────
    if (action === "charge") {
      const provided = request.headers.get("x-guileo-secret") || new URL(request.url).searchParams.get("secret") || "";
      if (!env.AGENT_ACTION_SECRET || !safeEq(provided, env.AGENT_ACTION_SECRET)) return json({ error: "unauthorized" }, 401);
      if (!isEmail(email)) return json({ error: "tenant required" }, 400);

      // Valor SEMPRE em centavos inteiros. Aceitamos `amount` em reais por conveniência do
      // agente, mas convertemos uma vez só e seguimos em inteiro daqui pra frente.
      const cents = b.amount_cents != null ? Math.round(Number(b.amount_cents)) : Math.round(Number(b.amount) * 100);
      // ref identifica o PEDIDO e é a chave de idempotência ponta a ponta (MP + banco).
      const ref = (b.ref || b.request_id || "").toString().trim();
      if (!ref) return json({ error: "ref required (identificador do pedido)" }, 400);

      const out = await mintPix(env, email, {
        amountCents: cents, description: b.description, payerEmail: b.payer_email,
        payerName: b.payer_name, ref, expiresMin: Number(b.expires_min) || 30,
      });
      if (!out.ok) return json({ ok: false, reason: out.reason, detail: out.detail || "" }, out.reason === "mp_not_connected" ? 409 : 400);

      return json({
        ok: true, id: out.id, amount_cents: out.amountCents, expires_at: out.expiresAt,
        copia_e_cola: out.copiaECola, qr_base64: out.qrBase64, ticket_url: out.ticketUrl,
        // Texto pronto pro canal — o copia-e-cola sozinho na última linha.
        message: pixMessage({
          business: (b.business || "").toString(), amountCents: out.amountCents,
          description: b.description, copiaECola: out.copiaECola, expiresMin: Number(b.expires_min) || 30,
        }),
      });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) { return json({ error: String(e).slice(0, 140) }, 400); }
}
