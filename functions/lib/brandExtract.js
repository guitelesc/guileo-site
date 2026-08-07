// functions/lib/brandExtract.js — A IDENTIDADE DO CLIENTE, TIRADA DO SITE DELE.
//
// POR QUE EXISTE: o e-mail de confirmação que o cliente do NEGÓCIO recebe precisa ter a cara do
// negócio — logo e cor dele. Preencher isso à mão, cliente por cliente, não escala: cada novo
// cliente viraria uma tarefa minha, e o Luis foi direto ao ponto — "assim como cada cliente".
// O site do próprio negócio já carrega a identidade dele. Basta ler.
//
// ── AS TRAVAS ────────────────────────────────────────────────────────────────
//  1. NUNCA INVENTA. Só sai daqui o que estava no HTML do site. Não achou logo? devolve vazio, e o
//     e-mail usa o monograma com a inicial — que sempre renderiza. Cor "aproximada" seria mentira
//     visual: o dono abre o e-mail e vê uma marca que não é a dele.
//  2. NADA DE SVG. Gmail, Outlook e Apple Mail não renderizam <img src="...svg"> — seria um quadrado
//     quebrado no topo da confirmação, pior que não ter logo. Só png/jpg/webp.
//  3. SEM REDE INTERNA. Recusa host local/IP privado: este código busca uma URL que veio do cadastro
//     do cliente, e uma URL apontando pra dentro da infra seria SSRF.
//  4. TETO DE TEMPO E TAMANHO. 12s e 600KB. Um site lento não pode segurar o provisionamento.
//  5. NÃO SOBRESCREVE O DONO. Quem chama só grava em campo VAZIO — escolha manual sempre vence.

const BAD_HOST = /^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|\[?::1\]?$|0\.0\.0\.0$)/i;

function safeUrl(raw) {
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (BAD_HOST.test(u.hostname)) return null;
    return u;
  } catch { return null; }
}

// Absolutiza uma URL de imagem relativa contra a página, e recusa o que e-mail não renderiza.
function pickImage(src, base) {
  if (!src) return "";
  let abs;
  try { abs = new URL(src, base).toString(); } catch { return ""; }
  if (!/^https?:\/\//i.test(abs)) return "";
  if (!/\.(png|jpe?g|webp)(\?|#|$)/i.test(abs)) return "";   // svg/gif/ico fora — ver trava 2
  return abs.slice(0, 400);
}

// O LOGO. Procura na ordem em que um site costuma declarar a marca de verdade:
// og:image é o que o próprio site escolheu pra se representar quando compartilhado; depois
// <img> cujo nome/alt diz "logo"; por fim o apple-touch-icon (quase sempre um PNG quadrado).
function findLogo(html, base) {
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const cands = [];
  if (og) cands.push(og[1]);
  const imgs = html.match(/<img[^>]+>/gi) || [];
  for (const tag of imgs) {
    if (!/logo|brand/i.test(tag)) continue;
    const m = tag.match(/\bsrc=["']([^"']+)["']/i) || tag.match(/\bdata-src=["']([^"']+)["']/i);
    if (m) cands.push(m[1]);
  }
  const touch = html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i);
  if (touch) cands.push(touch[1]);
  for (const c of cands) { const u = pickImage(c, base); if (u) return u; }
  return "";
}

// A COR. Preferimos o que o site DECLARA como cor de tema (<meta name="theme-color">) — é uma
// afirmação explícita da marca. Sem isso, a cor mais repetida no CSS da página, ignorando neutros
// (preto/branco/cinza), que aparecem em qualquer site e não dizem nada sobre a marca.
function findAccent(html) {
  const meta = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i);
  if (meta && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(meta[1].trim())) return meta[1].trim().toLowerCase();

  const counts = new Map();
  for (const m of html.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    const hex = m[1].toLowerCase();
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    // neutro (cinza/preto/branco) → não é cor de marca. Saturação baixa OU muito claro/escuro.
    if (max - min < 40 || max < 40 || min > 215) continue;
    counts.set(hex, (counts.get(hex) || 0) + 1);
  }
  let best = "", n = 0;
  // desempate estável pelo próprio hex: o mesmo site devolve sempre a mesma cor
  for (const [hex, c] of [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    if (c > n) { best = hex; n = c; }
  }
  return best ? `#${best}` : "";
}

// brandFromSite(siteUrl) → { logo_url, accent, source } · {} em qualquer falha.
// NUNCA lança: um site fora do ar não pode derrubar o provisionamento de um cliente.
export async function brandFromSite(siteUrl) {
  const u = safeUrl(String(siteUrl || "").trim());
  if (!u) return { why: "url-invalida-ou-interna" };
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 12000);
    // Muitos sites redirecionam (sem-www → www, / no fim). Pedimos `follow` explicitamente e, se
    // ainda assim vier uma página minúscula com Location, seguimos UM salto na mão. O sintoma sem
    // isso é traiçoeiro: a resposta é 200 text/html, mas com 174 bytes — a casca do redirect. Foi
    // exatamente o que aconteceu com naturaspanyc.com (2026-08-05): o extrator "funcionava" em
    // teste local (curl -L segue sozinho) e voltava vazio em produção.
    const get = (url) => fetch(url, {
      signal: ctl.signal, redirect: "follow",
      headers: { "User-Agent": "GuileoBrandBot/1.0 (+https://guileoai.com)", Accept: "text/html" },
    });
    let r = await get(u.toString()).finally(() => clearTimeout(timer));
    if (!r.ok) return { why: `http-${r.status}` };          // fetch não lança em 4xx/5xx
    if (!/text\/html/i.test(r.headers.get("content-type") || "")) return { why: `tipo-${(r.headers.get("content-type")||"vazio").slice(0,40)}` };
    let html = (await r.text()).slice(0, 600_000);          // teto de tamanho (trava 4)
    let base = r.url || u.toString();
    if (html.length < 2000) {
      const loc = (html.match(/https?:\/\/[^"'<>\s]+/) || [])[0];
      const nxt = loc && safeUrl(loc);                      // o destino passa pelas MESMAS travas
      if (nxt && nxt.toString() !== base) {
        const r2 = await get(nxt.toString());
        if (r2.ok && /text\/html/i.test(r2.headers.get("content-type") || "")) {
          html = (await r2.text()).slice(0, 600_000);
          base = r2.url || nxt.toString();
        }
      }
    }
    // PROTEÇÃO ANTI-ROBÔ. Muitas hospedagens (SiteGround, Cloudflare, Sucuri) respondem 200 com uma
    // casca de CAPTCHA/desafio quando o pedido vem de um datacenter. Não se contorna CAPTCHA — nem
    // devemos. Reconhecer e dizer o nome disso é o que permite o cockpit pedir a logo ao dono em vez
    // de ficar tentando pra sempre. (naturaspanyc.com responde assim ao nosso Worker, 2026-08-05.)
    if (/sgcaptcha|\/cdn-cgi\/challenge|captcha|__cf_chl|sucuri_cloudproxy/i.test(html)) {
      return { why: "site-protegido-por-captcha" };
    }
    const logo_url = findLogo(html, base);
    const accent = findAccent(html);
    if (!logo_url && !accent) {
      // Mostra o INÍCIO do que chegou. Só "174 bytes" não diz se é redirect, challenge de bot ou
      // página vazia — e cada um pede um conserto diferente.
      const amostra = html.replace(/\s+/g, " ").slice(0, 150);
      return { why: `html-${html.length}b · ${amostra}` };
    }
    return { ...(logo_url ? { logo_url } : {}), ...(accent ? { accent } : {}), source: base };
  } catch (e) { return { why: `erro-${String(e && e.name || e).slice(0, 40)}` }; }
}
