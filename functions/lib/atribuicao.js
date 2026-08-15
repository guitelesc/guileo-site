// functions/lib/atribuicao.js — DE QUAL ANÚNCIO VEIO ESTA PESSOA.
//
// A origem é capturada no primeiro clique (src/lib/analytics.js) e viaja num cookie PRIMÁRIO
// `gui_attr`. Este arquivo é o lado servidor: lê o cookie de qualquer requisição e grava a
// atribuição ancorada na CHAVE CANÔNICA do telefone, para o motor de anúncios poder responder a
// única pergunta que o dono do negócio faz — "gastei X, voltou quanto?".
//
// POR QUE COOKIE E NÃO PAYLOAD: são ~10 lugares que enviam lead hoje. Costurar a atribuição em
// cada um deixaria o 11º nascer sem, e ninguém perceberia — o lead entra normal, só chega órfão.
// O cookie viaja sozinho para o nosso domínio, então toda rota recebe de graça, hoje e amanhã.

/** Lê o cookie gui_attr da requisição. Devolve null quando a visita não veio de anúncio. */
export function atribuicaoDoPedido(request) {
  try {
    const bruto = request.headers.get("cookie") || "";
    const m = bruto.match(/(?:^|;\s*)gui_attr=([^;]+)/);
    if (!m) return null;
    const d = JSON.parse(decodeURIComponent(m[1]));
    if (!d || typeof d !== "object") return null;
    const lim = (v, n) => (v == null ? null : String(v).slice(0, n));
    const out = {
      source: lim(d.s, 60), campaign: lim(d.c, 80), medium: lim(d.m, 60),
      gclid: lim(d.g, 120), fbclid: lim(d.f, 120),
    };
    // Sem NADA de origem não é atribuição — devolver um objeto vazio faria toda visita direta
    // virar uma linha "(sem campanha)" e esse canal fantasma dominaria o relatório do cliente.
    return (out.source || out.campaign || out.gclid || out.fbclid) ? out : null;
  } catch { return null; }
}

/**
 * Grava a atribuição (primeiro toque vence, 90 dias — a RPC cuida disso).
 * Best-effort por decisão: perder a atribuição é ruim; perder o LEAD porque a atribuição falhou
 * seria muito pior. Mas a falha não some — ela é devolvida para quem chamou poder registrar.
 */
export async function gravarAtribuicao(env, { tenant, phone, contactEmail, attr, landing }) {
  if (!attr || !tenant) return { ok: false, reason: "sem atribuicao ou sem tenant" };
  try {
    // svcJson, NÃO svcRpc: `svcRpc` devolve a Response, então `r.ok` seria o 200 do HTTP e esta
    // função confirmaria a atribuição sem nunca ter lido o que o banco respondeu.
    const { svcJson } = await import("./sb.js");
    const r = await svcJson(env, "ads_attr_record", {
      p_secret: env.INGEST_SECRET || "", p_email: tenant,
      p_phone: phone || null, p_contact_email: contactEmail || null,
      p_source: attr.source || null, p_medium: attr.medium || null, p_campaign: attr.campaign || null,
      p_term: null, p_content: null,
      p_gclid: attr.gclid || null, p_fbclid: attr.fbclid || null, p_landing: landing || null,
    });
    // "ok" sem confirmação da RPC não é sucesso — a lição de 2026-08-07, aplicada aqui também.
    return r && r.ok ? r : { ok: false, reason: (r && r.reason) || "RPC nao confirmou" };
  } catch (e) { return { ok: false, reason: String(e).slice(0, 120) }; }
}
