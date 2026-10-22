// /sign?t=<token> — a PRÉVIA DO LINK (iMessage / WhatsApp / Slack) no HTML cru (2026-10-08).
//
// Quem cola o link de assinatura numa conversa recebia o cartão genérico do site ("Work Smart. Grow
// Faster…" / og.jpg): os robôs de prévia não rodam JS, então leem a casca estática do index.html.
// Aqui o servidor reescreve SÓ o <head> (title, og:*, twitter:*, canonical, robots) da página /sign:
//   · contrato da Natura (body.theme "natura-deck" ou parte "Natura Spa…") → capa da parceria;
//   · qualquer outro token, token inválido ou consulta que falhou → cartão NEUTRO de assinatura.
// O corpo, o #root e os scripts passam intocados: no navegador a página monta exatamente como antes.
//
// TRAVAS
//   · NUNCA preço, valor, nome de quem assina, e-mail ou qualquer dado pessoal no meta — só textos fixos
//     daqui. O documento serve só para escolher QUAL cartão; nenhum campo dele vai para o HTML.
//   · A consulta tem prazo (PRAZO_MS). Banco lento/fora = cartão neutro, e a página sai igual.
//   · Qualquer exceção aqui = a casca original, sem reescrita (zero downtime).
import { svcRpc } from "./sb.js";
import { SITE, DEFAULT_IMAGE } from "./ogMeta.js";

const PRAZO_MS = 2000;
const TOKEN_OK = /^[A-Za-z0-9_-]{24,128}$/;

export const NATURA_IMAGE = SITE + "/og/natura-guileo-contract.png";

export const CARTAO_NATURA = {
  title: "Natura Spa × Guileo AI — Partnership Agreement",
  description: "Ready to sign · Every point you asked for is marked ★ Requested by Natura Spa.",
  image: NATURA_IMAGE, imageW: "1200", imageH: "630", imageType: "image/png",
  imageAlt: "Natura Spa × Guileo AI — Partnership Agreement, ready to sign",
};

export const CARTAO_NEUTRO = {
  title: "Document for signature · Guileo AI",
  description: "Review the document and sign it securely online.",
  image: DEFAULT_IMAGE, imageW: "1200", imageH: "630", imageType: "image/jpeg",
  imageAlt: "Guileo AI — document for signature",
};

// Só decide QUAL cartão — nenhum campo do documento sai daqui.
export function ehNatura(doc) {
  if (!doc || typeof doc !== "object") return false;
  const body = doc.body && typeof doc.body === "object" ? doc.body : {};
  if (body.theme === "natura-deck") return true;
  return /natura\s*spa/i.test(String(doc.counterparty_name || ""));
}

export function cartaoDoDoc(doc) {
  return ehNatura(doc) ? CARTAO_NATURA : CARTAO_NEUTRO;
}

const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/[<>"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const reKey = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Troca o content="" de <meta name|property="key" content="…"> (as duas ordens de atributo).
// Se a tag não existe na casca, acrescenta antes do </head>.
function setMeta(html, key, value, attr = "property") {
  const v = esc(value);
  const a = new RegExp(`(<meta\\s+(?:name|property)="${reKey(key)}"\\s+content=")[^"]*(")`, "i");
  if (a.test(html)) return html.replace(a, (_m, x, y) => x + v + y);
  const b = new RegExp(`(<meta\\s+content=")[^"]*("\\s+(?:name|property)="${reKey(key)}")`, "i");
  if (b.test(html)) return html.replace(b, (_m, x, y) => x + v + y);
  return html.replace(/<\/head>/i, () => `    <meta ${attr}="${key}" content="${v}" />\n  </head>`);
}

// Pura (testável sem rede): casca do SPA + cartão + url → casca com o <head> do /sign.
export function reescreverSign(html, cartao, url) {
  const t = esc(cartao.title);
  html = html.replace(/<title>[^<]*<\/title>/i, () => `<title>${t}</title>`);
  html = setMeta(html, "description", cartao.description, "name");
  html = setMeta(html, "robots", "noindex, nofollow", "name"); // documento privado: fora do Google
  html = setMeta(html, "og:type", "website");
  html = setMeta(html, "og:title", cartao.title);
  html = setMeta(html, "og:description", cartao.description);
  html = setMeta(html, "og:url", url);
  html = setMeta(html, "og:image", cartao.image);
  html = setMeta(html, "og:image:type", cartao.imageType);
  html = setMeta(html, "og:image:width", cartao.imageW);
  html = setMeta(html, "og:image:height", cartao.imageH);
  html = setMeta(html, "og:image:alt", cartao.imageAlt);
  html = setMeta(html, "twitter:card", "summary_large_image", "name");
  html = setMeta(html, "twitter:title", cartao.title, "name");
  html = setMeta(html, "twitter:description", cartao.description, "name");
  html = setMeta(html, "twitter:image", cartao.image, "name");
  html = setMeta(html, "twitter:image:alt", cartao.imageAlt, "name");
  html = html.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/i, (_m, a, b) => a + esc(url) + b);
  // hreflang da casca aponta para a HOME — numa página privada, simplesmente some.
  html = html.replace(/[ \t]*<link\s+rel="alternate"\s+hreflang="[^"]+"\s+href="[^"]*"\s*\/?>\s*\n?/gi, "");
  return html;
}

// Consulta padrão: a MESMA RPC do /api/contract (by_token), com a chave de serviço e prazo.
// Devolve o documento ou null — nunca lança.
export async function buscarDoc(env, tok) {
  try {
    const r = await Promise.race([
      svcRpc(env, "contract_by_token_v2", { p_token: tok }),
      new Promise((res) => setTimeout(() => res(null), PRAZO_MS)),
    ]);
    if (!r || !r.ok) return null;
    const rows = await r.json().catch(() => null);
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch { return null; }
}

// Handler: chamado pelo middleware só para GET /sign. `buscar` é injetável (teste sem banco).
export async function signOg(context, buscar = buscarDoc) {
  const res = await context.next();
  try {
    const ct = res.headers.get("content-type") || "";
    if (res.status !== 200 || !ct.includes("text/html")) return res;
    const u = new URL(context.request.url);
    const tok = (u.searchParams.get("t") || "").trim();
    const valido = TOKEN_OK.test(tok);
    const doc = valido ? await buscar(context.env, tok) : null;
    const url = valido ? `${SITE}/sign?t=${encodeURIComponent(tok)}` : `${SITE}/sign`;
    const html = reescreverSign(await res.clone().text(), cartaoDoDoc(doc), url);
    const headers = new Headers(res.headers);
    ["content-length", "content-encoding", "etag"].forEach((n) => headers.delete(n));
    headers.set("content-type", "text/html; charset=utf-8");
    return new Response(html, { status: 200, headers });
  } catch {
    return res; // qualquer surpresa: a casca de sempre
  }
}
