// Cloudflare Pages Function — GET /api/loja-catalogo?slug=natura-spa   (LOJA DA VITRINE · leitura pública)
// A vitrine (src/novo/NaturaStore.jsx) lê daqui os produtos que o salão cadastrou em biz_products
// (/api/produtos, db/produtos.sql). É público como uma prateleira: só produto ATIVO e com preço.
//
// O QUE NÃO SAI DAQUI
//   • estoque exato: sai no máximo LOJA.qtdMax (o teto da sacola). A vitrine só precisa saber "dá
//     para pôr N na sacola" — o concorrente não precisa saber quantas unidades o salão tem.
//   • produto "sob consulta" (preço 0): não se vende online, então não aparece.
//   • datas, location_id, e-mail do tenant: nada que a vitrine não use.
// O preço daqui é só para MOSTRAR — quem cobra relê o banco em /api/loja-checkout.
//
//   → { ok:true, aoVivo, produtos:[{ id, name, brand, description, price_cents, stock }] }
//   → falha de leitura: { ok:false, code } com 503 (nunca lista vazia com 200: a vitrine diria
//     "sem produtos" para quem tem a prateleira cheia).
import { json, rateLimited } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { lojaDe } from "../lib/loja.js";

export function prateleira(lista, qtdMax) {
  return (Array.isArray(lista) ? lista : [])
    .filter((p) => p && p.active !== false && Number.isInteger(p.price_cents) && p.price_cents > 0 && typeof p.id === "string" && String(p.name || "").trim())
    .map((p) => ({
      id: p.id, name: String(p.name).trim(), brand: p.brand ? String(p.brand) : "", description: p.description ? String(p.description) : "",
      price_cents: p.price_cents,
      stock: p.stock === null || p.stock === undefined || p.stock === "" ? null : Math.max(0, Math.min(qtdMax, Math.floor(Number(p.stock)) || 0)),
    }));
}

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    if (await rateLimited(request, env, "loja-catalogo", 60, 60)) return json({ ok: false, code: "devagar" }, 429);
    const loja = lojaDe(new URL(request.url).searchParams.get("slug"));
    if (!loja) return json({ ok: false, code: "sem_loja" }, 404);
    const lista = await svcJson(env, "product_list", { p_secret: env.INGEST_SECRET || "", p_email: loja.email, p_only_active: true });
    if (!Array.isArray(lista)) return json({ ok: false, code: "catalogo" }, 503);
    return json({ ok: true, aoVivo: loja.config.aoVivo === true, produtos: prateleira(lista, loja.config.qtdMax) });
  } catch {
    return json({ ok: false, code: "catalogo" }, 503);
  }
}
