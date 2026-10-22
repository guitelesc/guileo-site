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
  // ── CORRIGIR A NOTA DE UM PROSPECT ────────────────────────────────────────────────────────
  // Regerar uma avaliação cria um relatório NOVO com id novo — e a nota do CRM continua apontando
  // pro antigo. Foi assim que três prospects ficaram com um link que dizia 100/100 depois de a
  // nota certa já existir. Link velho num CRM não avisa que envelheceu: ele abre.
  if ((b.acao || "") === "nota") {
    const alvo = (b.id || "").toString().trim();
    const nota = (b.nota || "").toString().slice(0, 1500);
    if (!alvo || !vendedor) return json({ ok: false, error: "id e seller obrigatorios" }, 400);
    // O e-mail tambem: o do CRM (hello@astoriaplumbers.nyc) vive no dominio cujo site esta
    // quebrado; os diretorios publicam outro. Depois do bounce do Nonstop, endereco nao
    // confirmado nao vale envio — corrigir o cadastro faz parte do trabalho, nao e detalhe.
    const args = { p_secret: ING, p_seller_email: vendedor, p_id: alvo, p_note: nota };
    if (b.email) args.p_email = String(b.email).slice(0, 200);
    const r = await svcRpc(env, "sp_upsert", args);
    if (!r.ok) return json({ ok: false, motivo: `banco respondeu ${r.status}` }, 503);
    const row = await r.json().catch(() => null);
    // Sem a linha de volta não houve gravação — "ok" sem o registro é promessa sem lastro.
    if (!row) return json({ ok: false, motivo: "nao gravou (id nao e desse vendedor?)" }, 404);
    return json({ ok: true, gravado: true, id: alvo });
  }

  const tipo = (b.tipo || "").toString();          // "prospects" | "" (crm)
  const fn = tipo === "prospects" ? "sp_list" : vendedor ? "seller_lead_crm_list" : "seller_lead_crm_all";
  const args = tipo === "prospects" ? { p_secret: ING, p_seller_email: vendedor }
             : vendedor ? { p_secret: ING, p_seller_email: vendedor } : { p_secret: ING };
  // try/catch explícito: sem ele qualquer exceção vira o 502 genérico do Cloudflare, que não diz
  // NADA — e diagnosticar um 502 mudo custou mais tempo hoje que o erro em si.
  let r;
  try { r = await svcRpc(env, fn, args); }
  catch (e) { return json({ ok: false, motivo: `svcRpc lancou: ${String(e).slice(0, 160)}` }, 503); }
  if (!r.ok) {
    let corpo = ""; try { corpo = (await r.text()).slice(0, 200); } catch { /* */ }
    return json({ ok: false, motivo: `banco respondeu ${r.status}: ${corpo}` }, 503);
  }
  let rows = null;
  try { rows = await r.json(); } catch (e) { return json({ ok: false, motivo: `resposta ilegivel: ${String(e).slice(0, 120)}` }, 503); }
  // Lista ausente é ERRO, não "carteira vazia" — `|| []` aqui inventaria calma.
  if (!Array.isArray(rows)) return json({ ok: false, motivo: "resposta do banco nao e lista" }, 503);
  return json({ ok: true, fonte: fn, total: rows.length, leads: rows });
}
