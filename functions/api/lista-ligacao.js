// GET/POST /api/lista-ligacao — POR ONDE COMEÇAR A LIGAR, e o que dizer nos 10 primeiros segundos.
// ─────────────────────────────────────────────────────────────────────────────────────────────
// POR QUE EXISTE: em 2026-08-22 o banco mostrou 311 prospects com telefone e **ZERO abordados**.
// O motor estava pronto havia semanas e o funil nunca tinha sido entrado. O que faltava não era
// gente na lista — era saber por onde começar e com que frase abrir.
//
// A ORDEM NÃO É ALFABÉTICA NEM POR DATA: é por DOR MEDIDA. Cada linha traz o achado mais grave
// que o X-Ray já encontrou naquele negócio ("144h por semana com o telefone sem ninguém"), para
// a ligação abrir com um fato DELE em vez de "somos uma empresa de IA".
//
// GATE: crachá do vendedor (só vê a própria carteira) OU senha do /admin OU INGEST (vê tudo).

import { json, safeEq } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { verifySession } from "../lib/sellerSession.js";

async function tratar(request, env) {
  const url = new URL(request.url);
  const b = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const tok = (b.token || url.searchParams.get("secret") || request.headers.get("x-guileo-secret") || "").toString();
  const sid = (b.sid || url.searchParams.get("sid") || "").toString();

  let vendedor = null, tudo = false;
  if (env.INGEST_SECRET && safeEq(tok, env.INGEST_SECRET)) tudo = true;
  if (!tudo && tok) {
    const a = await svcJson(env, "_admin_ok", { p_token: tok }).catch(() => null);
    if (a === true || a?.ok === true) tudo = true;   // o CORPO, não o status
  }
  if (!tudo && sid) {
    const s = await verifySession(env, sid).catch(() => null);
    // O vendedor vê a CARTEIRA DELE. Sem este escopo, um crachá viraria a lista da casa inteira.
    if (s?.email) vendedor = String(s.email).toLowerCase();
  }
  if (!tudo && !vendedor) return json({ error: "unauthorized" }, 401);
  if (!env.INGEST_SECRET) return json({ ok: false, motivo: "sem INGEST_SECRET" }, 503);

  const lista = await svcJson(env, "lista_de_ligacao", {
    p_secret: env.INGEST_SECRET,
    p_seller: tudo ? (b.seller || url.searchParams.get("seller") || null) : vendedor,
    p_limit: Math.min(parseInt(b.limite || url.searchParams.get("limite"), 10) || 30, 100),
  }).catch(() => null);

  // Lista ausente NÃO é "ninguém para ligar" (lei do fallback). Sem esta distinção, uma falha de
  // leitura mandaria o vendedor dormir achando que a carteira acabou.
  if (!Array.isArray(lista)) return json({ ok: false, lista: null, motivo: "não consegui ler a lista — isto NÃO é 'ninguém para ligar'" }, 503);

  return json({
    ok: true, total: lista.length, escopo: tudo ? "todos" : vendedor, lista,
    // Um resumo honesto: quantos já têm dor medida. Ligar sem dor medida é ligar no escuro —
    // funciona, mas é outra conversa, e o vendedor merece saber em qual das duas ele está.
    com_dor_medida: lista.filter((x) => x?.dor_titulo).length,
  });
}

export const onRequestGet = (c) => tratar(c.request, c.env);
export const onRequestPost = (c) => tratar(c.request, c.env);
