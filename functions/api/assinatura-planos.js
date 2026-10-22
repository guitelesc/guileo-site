// Cloudflare Pages Function — GET /api/assinatura-planos?slug=natura-spa   (ASSINATURA DO SITE · leitura pública)
// A seção "Membership" (src/novo/NaturaMembership.jsx) lê daqui os planos que o salão cadastrou no portal
// (Crescimento → Recorrência, tabela `memberships`). Público como um cardápio: só plano ATIVO e com preço.
// O número de assinantes e o e-mail da conta NÃO saem (naturaAssinatura.js → planosPublicos).
// O preço daqui é só para MOSTRAR — quem cobra relê o banco em /api/assinatura-checkout.
//
//   → { ok:true, aoVivo, planos:[{ id, name, price_cents, interval, perks }] }
//   → falha de leitura: { ok:false, code } com 503 (nunca lista vazia com 200: a página diria "sem plano").
import { json, rateLimited } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { lojaDe } from "../lib/loja.js";
import { ASSINATURA, planosPublicos } from "../../src/novo/naturaAssinatura.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    if (await rateLimited(request, env, "assinatura-planos", 60, 60)) return json({ ok: false, code: "devagar" }, 429);
    const loja = lojaDe(new URL(request.url).searchParams.get("slug"));
    if (!loja) return json({ ok: false, code: "sem_salao" }, 404);
    const lista = await svcJson(env, "membership_list", { p_secret: env.INGEST_SECRET || "", p_client_email: loja.email });
    if (!Array.isArray(lista)) return json({ ok: false, code: "planos" }, 503);
    return json({ ok: true, aoVivo: ASSINATURA.aoVivo === true, planos: planosPublicos(lista) });
  } catch {
    return json({ ok: false, code: "planos" }, 503);
  }
}
