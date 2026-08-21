// Cloudflare Pages Function — GET /api/capa?site=<url>
//
// A CAPA DO SITE DO CLIENTE, PARA O GROWTH REPORT (/apresentacao/:id).
// Luis (2026-08-18): «capa e perfil do site dela no topo — automático com o que já temos. Tente a
// capa (og:image/hero); se o site dela bloquear robô, caia num fundo da marca dela em vez de
// quebrar. NUNCA invente imagem.»
//
// ── AS TRAVAS (as mesmas de functions/lib/brandExtract.js, que faz o irmão disto para a LOGO) ──
//  1. NUNCA INVENTA. Só sai daqui uma URL que estava no HTML DAQUELE site. Não achou? `capa: ""`
//     e o `motivo` diz por quê — a página então desenha o degradê da cor da marca. Um fundo de
//     banco de imagem seria "uma foto qualquer vendida como o negócio dele", que é pior que nada.
//  2. SEM REDE INTERNA (SSRF). A URL vem de um payload; host local/privado é recusado na porta.
//  3. TETO DE TEMPO E TAMANHO. Site lento não pode segurar o relatório: 8s, 400KB de HTML.
//  4. SÓ IMAGEM QUE NAVEGADOR RENDERIZA COMO FOTO — png/jpg/webp. Nada de svg/gif/ico/data:.
//  5. LEITURA PURA. Sem gravação, sem segredo, sem tenant: é a mesma informação que qualquer
//     pessoa vê no "compartilhar" daquele site. Mesmo assim vai com rate-limit por IP, porque um
//     endpoint que busca URL arbitrária é um proxy se ninguém contar as chamadas.
import { json, rateLimited } from "../lib/guard.js";

const BAD_HOST = /^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|\[?::1\]?$|0\.0\.0\.0$)/i;

function safeUrl(raw) {
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (BAD_HOST.test(u.hostname)) return null;
    if (!u.hostname.includes(".")) return null;
    return u;
  } catch { return null; }
}

const absImg = (src, base) => {
  if (!src) return "";
  let abs;
  try { abs = new URL(src, base).toString(); } catch { return ""; }
  if (!/^https?:\/\//i.test(abs)) return "";
  if (!/\.(png|jpe?g|webp)(\?|#|$)/i.test(abs)) return "";
  return abs.slice(0, 500);
};

const meta = (html, re) => {
  const m = html.match(re);
  return m ? m[1] : "";
};

/* A ORDEM É A DA CONFIANÇA, não a da conveniência:
   1. og:image      — a imagem que o PRÓPRIO site escolheu para se representar quando compartilhado
   2. twitter:image — o mesmo conceito, do outro protocolo (muito site preenche só este)
   3. herói         — a maior foto da página inicial, e SÓ quando o nome do arquivo não cheira a
                      logo/ícone/sprite. Uma logo esticada como capa fica horrível e, pior, mente
                      sobre o que a foto é. */
const LIXO = /(logo|icon|favicon|sprite|placeholder|avatar|badge|button|arrow|pixel|spacer)/i;

function acharCapa(html, base) {
  const og = absImg(meta(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || meta(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i), base);
  if (og && !LIXO.test(og)) return { capa: og, fonte: "og:image" };

  const tw = absImg(meta(html, /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    || meta(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i), base);
  if (tw && !LIXO.test(tw)) return { capa: tw, fonte: "twitter:image" };

  // herói: a primeira imagem grande da página que não parece elemento de interface
  for (const tag of (html.match(/<img[^>]+>/gi) || []).slice(0, 60)) {
    const src = (tag.match(/\bsrc=["']([^"']+)["']/i) || tag.match(/\bdata-src=["']([^"']+)["']/i) || [])[1];
    const u = absImg(src, base);
    if (!u || LIXO.test(u)) continue;
    const w = Number((tag.match(/\bwidth=["']?(\d+)/i) || [])[1] || 0);
    // sem width declarada aceitamos assim mesmo (site moderno raramente declara); com width, exige
    // que seja grande — imagem de 80px é ícone, não capa.
    if (w && w < 600) continue;
    return { capa: u, fonte: "hero" };
  }
  // og:image que caiu no filtro de lixo ainda é melhor que nada? NÃO: uma logo como capa é
  // exatamente o caso em que a faixa da marca (logo + cor, bem composta) fica melhor. Devolve vazio.
  return { capa: "", fonte: "", motivo: og || tw ? "so-logo" : "sem-capa-no-site" };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const u = safeUrl((new URL(request.url).searchParams.get("site") || "").trim().slice(0, 300));
  if (!u) return json({ ok: false, capa: "", motivo: "site-invalido" }, 400);
  if (await rateLimited(request, env, "capa", 30)) return json({ ok: false, capa: "", motivo: "rate" }, 429);

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(u.toString(), {
      signal: ctrl.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; GuileoBot/1.0; +https://guileoai.com)", accept: "text/html" },
      redirect: "follow",
    });
    // ⚠️ STATUS RUIM É MOTIVO, NÃO EXCEÇÃO SILENCIOSA. "403 do WAF" e "site sem capa" levam ao
    // MESMO desenho na página, mas a "por que não apareceu" só tem resposta se a diferença for
    // registrada aqui. Foi assim que fallback virou diagnóstico falso mais de uma vez neste repo.
    if (!r.ok) return json({ ok: false, capa: "", motivo: `http-${r.status}` });
    const html = (await r.text()).slice(0, 400000);
    const achado = acharCapa(html, u.toString());
    return new Response(JSON.stringify({ ok: !!achado.capa, ...achado, site: u.toString() }), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=3600, s-maxage=86400" },
    });
  } catch (e) {
    return json({ ok: false, capa: "", motivo: e?.name === "AbortError" ? "timeout" : "fetch-falhou" });
  } finally { clearTimeout(t); }
}
