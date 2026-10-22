// POST /api/sinal-reconcile (x-guileo-secret = INGEST_SECRET) — confere, na conta PRÓPRIA de cada
// negócio, os sinais com link enviado e ainda não pagos (últimos 3 dias). Pega a cliente que pagou e
// fechou a aba antes de voltar. Chamado pelo cron-tick de hora em hora.
// 2026-10-05: também confere as sessões de "Salvar cartão" e "Vender assinatura" do balcão
// (desk_stripe_pending_svc, db/desk_v5_cartao.sql) — mesma regra: só grava o que o Stripe diz.
// 2026-10-05 (v6): e confere o STATUS das assinaturas vendidas no Stripe do negócio (cancelada, pagamento
// atrasado, ativa) — até 50 por rodada, a conferida há mais tempo primeiro (lib/stripeDoNegocio.js
// conferirAssinaturas, db/desk_v6_cancelamento.sql). Mudou → feed do dono. Não deu para ler → feed também.
import { json, safeEq } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { conferirSessaoDoSinal, conferirSessaoDoDesk } from "../lib/sinalPago.js";
import { conferirAssinaturas } from "../lib/stripeDoNegocio.js";

// Porta: o cron chama com ?token=DIGEST_TOKEN (igual aos outros alvos); à mão, x-guileo-secret = INGEST_SECRET.
const autorizado = (request, env) => {
  const tk = new URL(request.url).searchParams.get("token") || "";
  if (env.DIGEST_TOKEN && tk && safeEq(tk, env.DIGEST_TOKEN)) return true;
  const h = request.headers.get("x-guileo-secret") || "";
  return !!(env.INGEST_SECRET && h && safeEq(h, env.INGEST_SECRET));
};
export const onRequestGet = (ctx) => onRequestPost(ctx);
export async function onRequestPost({ request, env }) {
  if (!autorizado(request, env)) return json({ ok: false, error: "unauthorized" }, 401);
  const lista = await svcJson(env, "desk_deposit_pending_svc", {});
  if (!Array.isArray(lista)) return json({ ok: false, error: "nao consegui ler os pendentes", detalhe: lista }, 503);
  let pagos = 0, abertos = 0, falhas = 0;
  for (const p of lista.slice(0, 200)) {
    const r = await conferirSessaoDoSinal(env, { tenant: p.tenant, sessionId: p.session });
    if (r.ok) pagos++; else if (r.reason === "nao_pago") abertos++; else falhas++;
  }
  // cartão salvo / assinatura (lista à parte: falha de leitura aqui não apaga o resultado dos sinais)
  const outras = await svcJson(env, "desk_stripe_pending_svc", {});
  const balcao = { conferidos: 0, confirmados: 0, abertos: 0, falhas: 0, leitura: Array.isArray(outras) ? "ok" : "falhou" };
  for (const p of (Array.isArray(outras) ? outras : []).slice(0, 200)) {
    balcao.conferidos++;
    const r = await conferirSessaoDoDesk(env, { tenant: p.tenant, sessionId: p.session });
    if (r.ok) balcao.confirmados++; else if (r.reason === "nao_pago") balcao.abertos++; else balcao.falhas++;
  }
  // assinaturas (lista à parte, mesma regra: falha aqui não apaga o resultado acima; nunca lança)
  const assinaturas = await conferirAssinaturas(env).catch((e) => ({ ok: false, leitura: "erro", detalhe: String(e).slice(0, 120) }));
  return json({ ok: true, conferidos: Math.min(lista.length, 200), pagos, abertos, falhas, balcao, assinaturas });
}
