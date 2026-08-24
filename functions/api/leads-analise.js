// Cloudflare Pages Function — POST /api/leads-analise
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LÊ a carteira inteira de leads pra análise. Existe porque `seller_lead_crm_all` é service-role:
// a lista existia e ninguém fora do cockpit alcançava — o mesmo buraco de /api/eval-ultimo, onde
// o dado estava gravado e a leitura exigia um segredo que ninguém tinha à mão.
// Portão: `x-guileo-secret` = INGEST (servidor-a-servidor). Só LÊ: nada aqui liga, escreve ou envia.
import { json, safeEq } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";

export async function onRequestPost({ request, env }) {
  const ING = (env.INGEST_SECRET || "").toString();
  if (!ING || !safeEq((request.headers.get("x-guileo-secret") || "").toString(), ING)) {
    return json({ error: "unauthorized" }, 401);
  }
  const b = await request.json().catch(() => ({}));
  const vendedor = (b.seller || "").toString().trim().toLowerCase();

  // Sem vendedor: o AGREGADO (quantos leads cada um tem). Com vendedor: a lista dele.
  const tipo = (b.tipo || "").toString();          // "prospects" | "" (crm)
  const fn = tipo === "prospects" ? "sp_list" : vendedor ? "seller_lead_crm_list" : "seller_lead_crm_all";
  const args = tipo === "prospects" ? { p_secret: ING, p_seller_email: vendedor }
             : vendedor ? { p_secret: ING, p_seller_email: vendedor } : { p_secret: ING };
  // try/catch explícito: sem ele qualquer exceção vira o 502 genérico do Cloudflare, que não diz
  // NADA — e diagnosticar um 502 mudo custou mais tempo hoje que o erro em si.
  let r;
  try { r = await svcRpc(env, fn, args); }
  catch (e) { return json({ ok: false, motivo: `svcRpc lancou: ${String(e).slice(0, 160)}` }, 502); }
  if (!r.ok) {
    let corpo = ""; try { corpo = (await r.text()).slice(0, 200); } catch { /* */ }
    return json({ ok: false, motivo: `banco respondeu ${r.status}: ${corpo}` }, 502);
  }
  let rows = null;
  try { rows = await r.json(); } catch (e) { return json({ ok: false, motivo: `resposta ilegivel: ${String(e).slice(0, 120)}` }, 502); }
  // Lista ausente é ERRO, não "carteira vazia" — `|| []` aqui inventaria calma.
  if (!Array.isArray(rows)) return json({ ok: false, motivo: "resposta do banco nao e lista" }, 502);
  return json({ ok: true, fonte: fn, total: rows.length, leads: rows });
}
