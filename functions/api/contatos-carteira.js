// Cloudflare Pages Function — POST /api/contatos-carteira
// COMPLETA TELEFONE E E-MAIL DA CARTEIRA INTEIRA, de um lugar só.
//
// POR QUE EXISTE: o motor de contato já está no hub de cada vendedor — mas 342 dos 353 prospects
// seguiam sem e-mail, porque depender de 5 pessoas clicarem é depender de 5 pessoas lembrarem.
// Um canal que existe e ninguém liga é o mesmo que canal inexistente.
//
// AUTH: administrador. É a única ação do sistema que escreve na carteira de TODOS os vendedores.
//
// 🚨 UM LOTE POR CHAMADA, DE PROPÓSITO. Cada negócio custa até 2 consultas pagas ao Google + a
// leitura do site dele. Varrer 350 numa requisição estoura o teto de CPU do Worker e deixa o Luis
// sem saber quantos foram feitos quando cair. A tela chama de novo até acabar, e o progresso é
// REAL: só sobe quando o lote volta.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { svcJson, svcRpc } from "../lib/sb.js";
import { fichaDoGoogle } from "../lib/googleBusiness.js";

const LOTE = 5;

// Mesmo filtro do motor da fila: e-mail de plataforma/agência é pior que e-mail nenhum — manda a
// proposta pro fornecedor do site do cliente e ainda avisa um concorrente.
const LIXO = /(sentry|wixpress|squarespace|godaddy|shopify|example|domain|yourname|email@|no-?reply|postmaster|abuse|privacy|\.png|\.jpg|\.webp|\.gif)/i;
const PROVEDOR = /@(gmail|hotmail|outlook|yahoo|icloud|aol|live|msn)\./i;

// mesma regra da fila: home raramente tem e-mail; /contact e /contato têm. Teto de 3 páginas.
async function emailDoSiteProfundo(base, dominio) {
  const raiz = base.startsWith("http") ? base.replace(/\/+$/, "") : `https://${dominio}`;
  for (const u of [raiz, `${raiz}/contact`, `${raiz}/contato`]) {
    const achado = await emailDoSite(u, dominio);
    if (achado) return achado;
  }
  return "";
}

async function emailDoSite(url, dominio) {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "GuileoBot/1.0 (+https://guileoai.com)" } });
    clearTimeout(timer);
    if (!r.ok) return "";
    const html = (await r.text()).slice(0, 400000);
    const achados = [...new Set((html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,10}/g) || []))]
      .map((e) => e.toLowerCase()).filter((e) => !LIXO.test(e))
      .filter((e) => e.endsWith("@" + dominio) || PROVEDOR.test(e));
    return achados.find((e) => e.endsWith("@" + dominio)) || achados[0] || "";
  } catch { return ""; }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "contatos-carteira", 30)) return json({ error: "rate" }, 429);
    const b = await request.json().catch(() => ({}));

    // portão do /admin — o mesmo `blitz_stats` das outras ações administrativas
    const vr = await svcRpc(env, "blitz_stats", { p_token: (b.token || "").toString(), p_email: "" });
    if (!vr.ok) return json({ error: "unauthorized" }, 401);
    if (!env.GOOGLE_PLACES_KEY) return json({ ok: false, motivo: "GOOGLE_PLACES_KEY não está neste ambiente" }, 503);

    const ING = env.INGEST_SECRET || "";
    const lista = await svcJson(env, "prospects_sem_contato", { p_secret: ING, p_limit: LOTE });
    if (!Array.isArray(lista)) return json({ ok: false, motivo: "não consegui ler a carteira" }, 503);
    if (!lista.length) return json({ ok: true, fim: true, feitos: 0, restam: 0, itens: [] });

    const itens = [];
    for (const p of lista) {
      const nome = (p.business || "").toString();
      const site = (p.site || "").toString();
      const dom = site.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
      try {
        // domínio primeiro (é fato); o nome é reserva, porque nome cadastrado costuma ser
        // título de SEO e o Google responde outro negócio — a trava do xará mora aqui.
        let f = dom ? await fichaDoGoogle(env, dom).catch(() => null) : null;
        if (!f?.ok && nome) f = await fichaDoGoogle(env, `${nome} New York, NY`).catch(() => null);
        const telefone = f?.ok ? (f.telefone || "") : "";
        const alvo = site || (f?.ok && f.site) || "";
        const mail = alvo ? await emailDoSiteProfundo(alvo.startsWith("http") ? alvo : `https://${dom}`, dom || (alvo.replace(/^https?:\/\/(www\.)?/, "").split("/")[0])) : "";

        if (!telefone && !mail) { itens.push({ id: p.id, ok: false, motivo: "sem telefone nem e-mail publicados", business: nome }); continue; }
        const g = await svcJson(env, "prospect_contato_set", { p_secret: ING, p_id: p.id, p_phone: telefone, p_email: mail });
        // 🚨 só declaro gravado com o retorno do banco na mão.
        if (g?.ok !== true) { itens.push({ id: p.id, ok: false, motivo: g?.motivo || "não gravou", business: nome }); continue; }
        itens.push({ id: p.id, ok: true, business: nome, telefone: !!telefone, email: !!mail, seller: p.seller });
      } catch (e) { itens.push({ id: p.id, ok: false, motivo: String(e).slice(0, 120), business: nome }); }
    }

    const restam = await svcJson(env, "prospects_sem_contato", { p_secret: ING, p_limit: 200 });
    return json({
      ok: true, fim: false,
      feitos: itens.filter((x) => x.ok).length, total: itens.length,
      restam: Array.isArray(restam) ? restam.length : null,
      itens,
    });
  } catch (e) { return json({ ok: false, motivo: String(e).slice(0, 160) }, 400); }
}
