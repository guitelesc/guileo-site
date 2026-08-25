// Cloudflare Pages Function — POST /api/lead-vitrine
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// O PEDIDO FEITO NO SITE RECONSTRUÍDO DE UM PROSPECT (/novo/:slug).
//
// POR QUE EXISTE (24/08, e a origem é constrangedora): os cinco sites que eu construí hoje
// postavam em /api/marketplace-leads, que exige um TENANT com chave — e prospect não é cliente,
// então respondia 401. Pior: o `catch` do formulário engolia a falha e a tela dizia
// "Request received". Eu tinha acabado de provar que o formulário do SR General não entrega a
// ninguém, e o meu fazia a mesma coisa: mostrava sucesso sobre o vazio.
//
// Onde o pedido vai parar: um evento no tenant da CASA. O negócio ainda não é cliente, e inventar
// um tenant pra ele seria sujar a base — então o lead chega pra NÓS, e a gente entrega na mão
// dele. Isso não é contorno: um pedido real capturado pelo site novo é o melhor argumento de venda
// que existe ("seu site novo já pegou um serviço").
//
// Portão: sameOrigin + limite por IP. É formulário público — não pode ter segredo no navegador.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";

const s = (v, n = 400) => (v == null ? "" : v.toString().slice(0, n).trim());

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ ok: false, error: "forbidden" }, 403);
  if (await rateLimited(request, env, "lead-vitrine", 12)) return json({ ok: false, error: "too many requests" }, 429);

  const b = await request.json().catch(() => ({}));
  const negocio = s(b.negocio, 120);
  const slug = s(b.slug, 60);
  const nome = s(b.nome, 120);
  const tel = s(b.telefone, 40);
  const msg = s(b.mensagem, 800);
  if (!negocio || !nome || !tel) return json({ ok: false, error: "faltam nome e telefone" }, 400);

  const r = await svcRpc(env, "ingest_client_event", {
    p_secret: env.INGEST_SECRET || "",
    p_email: "smart@guileoai.com",           // o tenant da CASA — o prospect ainda não é cliente
    p_type: "lead_vitrine",
    p_channel: "site",
    p_summary: `${negocio}: ${nome} · ${tel}`,
    p_amount: 0,
    p_payload: { negocio, slug, nome, telefone: tel, mensagem: msg },
  });
  // ⚠️ A RESPOSTA DECIDE, NÃO O STATUS. E se falhou, o formulário PRECISA saber: dizer "recebido"
  // sobre uma gravação que não aconteceu é o defeito que este arquivo existe para não repetir.
  if (!r || !r.ok) {
    let corpo = ""; try { corpo = (await r.text()).slice(0, 160); } catch { /* */ }
    return json({ ok: false, error: `nao gravou${corpo ? `: ${corpo}` : ""}` }, 502);
  }
  return json({ ok: true, recebido: true });
}
