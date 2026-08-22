// Cloudflare Pages Function — POST /api/entregas  (admin-token gated)
//
// A LISTA VIVA DAS ENTREGAS done-for-you (Website Upgrade + módulos). O webhook da
// Stripe cria a entrega no pagamento (db/dfy_entregas.sql); aqui o /admin LÊ e marca
// os passos da ROTA-FECHAMENTO. Existe porque esta é a única linha de produto cuja
// entrega é humana: sem lista, a venda vira e-mail perdido e o cliente espera um site
// que ninguém começou.
//
// PORTA ÚNICA, FECHADA: mesmo gate dos irmãos (senha do /admin via _admin_ok). Nunca
// aberta — mostra e-mail de cliente pagante e o que falta entregar.
import { json } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";

// mesma porta do resto do /admin (blitz_stats), com as MESMAS constantes — usar
// env.SUPABASE_* aqui devolvia 500 em vez de 401: a variável não existe com esse
// nome e o fetch estourava antes de checar a senha. Portão que erra o código de
// resposta é portão que ninguém consegue auditar.
const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const token = (b.token || "").toString();
    // gate: a senha do /admin (rotaciona; lida do banco, nunca escrita em doc)
    const vr = await fetch(`${SB}/rest/v1/rpc/blitz_stats`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token, p_email: "" }),
    });
    if (!vr.ok) return json({ error: "unauthorized" }, 401);

    const ING = env.INGEST_SECRET || "";
    if (!ING) return json({ ok: false, note: "INGEST_SECRET ausente" }, 503);

    // ação 'passo' marca/desmarca; sem ação, lista.
    if ((b.acao || "").toString() === "passo") {
      const r = await svcRpc(env, "dfy_step_set", {
        p_secret: ING, p_id: (b.id || "").toString(),
        p_step: (b.passo || "").toString(), p_done: !!b.feito,
      });
      // svcRpc devolve o objeto cru da RPC; a linha atualizada volta pro front redesenhar
      return json({ ok: true, entrega: r ?? null });
    }

    const lista = await svcRpc(env, "dfy_list", { p_secret: ING, p_status: (b.status || null) || null });
    // RPC inexistente (SQL ainda não colado) → honesto, não finge lista vazia
    if (lista == null) return json({ ok: false, note: "RPC dfy_list não existe — cole db/dfy_entregas.sql no SQL Editor" });
    return json({ ok: true, entregas: Array.isArray(lista) ? lista : [] });
  } catch (e) {
    return json({ ok: false, error: (e && e.message) || "erro" }, 500);
  }
}
