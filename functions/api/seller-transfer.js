// Cloudflare Pages Function — POST /api/seller-transfer
// TRANSFERÊNCIA DE CARTEIRA (ADMIN-ONLY). Regra do Luis: o cliente é do vendedor PRA SEMPRE; a troca
// só acontece se o CLIENTE desejar — e mesmo assim SÓ o admin executa, com MOTIVO obrigatório e trilha
// permanente. Nenhum vendedor alcança este endpoint.
//   • transfer → reatribui um cliente a outro vendedor ativo (motivo obrigatório) + grava auditoria.
//   • history  → a trilha de trocas de um cliente (para a carteira mostrar o passado).
//
// AUTH: o MESMO gate admin de /api/onboard-draft & /api/seller-admin — blitz_stats(token) levanta em
// token errado → non-200 → 401. Todo acesso ao banco é via RPC SECURITY DEFINER gated pelo INGEST
// (db/seller_transfer.sql); o navegador nunca vê um segredo. Mesma constante SB/ANON + helper json().
import { json, sameOrigin, rateLimited } from "../lib/guard.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// Admin gate — same RPC as onboard-draft / seller-admin. A wrong token raises → non-200.
async function adminOk(token) {
  const vr = await rpc("blitz_stats", { p_token: (token || "").toString(), p_email: "" });
  return vr.ok;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "seller-transfer", 30)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const action = (b.action || "").toString();
    const ING = env.INGEST_SECRET || "";

    // EVERY action here is admin-only.
    if (!await adminOk(b.token)) return json({ error: "unauthorized" }, 401);

    // ── TRANSFER — reatribui o cliente a outro vendedor ativo (motivo obrigatório) ──────────────────
    if (action === "transfer") {
      const clientEmail = (b.client_email || "").toString().trim().toLowerCase();
      const toSeller = (b.to_seller || "").toString().trim().toLowerCase();
      const reason = (b.reason || "").toString().trim();
      if (!clientEmail || !clientEmail.includes("@")) return json({ error: "client_email required" }, 400);
      if (!toSeller || !toSeller.includes("@")) return json({ error: "to_seller required" }, 400);
      if (!reason) return json({ error: "reason required" }, 400); // MOTIVO obrigatório (regra do Luis)
      const r = await rpc("seller_wallet_transfer", {
        p_secret: ING, p_client_email: clientEmail, p_to_seller_email: toSeller, p_reason: reason.slice(0, 500),
      });
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        // motivo/vendedor inválido volta como 22023 do banco → 400 claro; senão 500 (falta colar SQL).
        const bad = /22023|not found|inactive|reason required|bad /i.test(txt);
        return json({ error: bad ? "transfer rejected (seller inactive/unknown or reason missing)" : "transfer failed (paste db/seller_transfer.sql)" }, bad ? 400 : 500);
      }
      const out = await r.json().catch(() => ({}));
      return json({ ok: true, from: out.from || null, to: out.to || toSeller, noop: !!out.noop, moved: out.moved });
    }

    // ── HISTORY — a trilha de trocas de um cliente ──────────────────────────────────────────────────
    if (action === "history") {
      const clientEmail = (b.client_email || "").toString().trim().toLowerCase();
      if (!clientEmail || !clientEmail.includes("@")) return json({ error: "client_email required" }, 400);
      const r = await rpc("seller_wallet_transfer_history", { p_secret: ING, p_client_email: clientEmail });
      if (!r.ok) return json({ ok: true, rows: [] }); // degrada: sem histórico, nunca quebra a carteira
      const rows = await r.json().catch(() => []);
      return json({ ok: true, rows: Array.isArray(rows) ? rows : [] });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
