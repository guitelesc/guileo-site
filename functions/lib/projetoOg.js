// /projeto?t=<token> — PRÉVIA DO LINK do acompanhamento de projeto (2026-10-08). Mesmo mecanismo do
// /sign (signOg.js): os robôs de prévia não rodam JS, então o servidor reescreve só o <head>.
//   · projeto com tema "natura-deck" → capa "Natura Spa × Guileo AI · Build to Go-Live";
//   · token inválido / outro tema / banco lento → cartão neutro.
// Nenhum dado do projeto vai para o HTML: a consulta só escolhe QUAL cartão (textos fixos daqui).
import { svcRpc } from "./sb.js";
import { SITE, DEFAULT_IMAGE } from "./ogMeta.js";
import { reescreverSign } from "./signOg.js";

const PRAZO_MS = 2000;
const TOKEN_OK = /^[A-Za-z0-9_-]{24,128}$/;

export const CARTAO_PROJETO_NATURA = {
  title: "Natura Spa × Guileo AI — Build to Go-Live",
  description: "Project checklist for Origem and Scale Pods · Go-Live October 29, 2026.",
  image: SITE + "/og/natura-guileo-build.png", imageW: "1200", imageH: "630", imageType: "image/png",
  imageAlt: "Natura Spa × Guileo AI — Build to Go-Live, project checklist",
};
export const CARTAO_PROJETO = {
  title: "Project checklist · Guileo AI",
  description: "Shared project checklist.",
  image: DEFAULT_IMAGE, imageW: "1200", imageH: "630", imageType: "image/jpeg",
  imageAlt: "Guileo AI — project checklist",
};

export async function buscarTema(env, tok) {
  try {
    const r = await Promise.race([
      svcRpc(env, "projeto_tema_por_token", { p_token: tok }),
      new Promise((res) => setTimeout(() => res(null), PRAZO_MS)),
    ]);
    if (!r || !r.ok) return null;
    const v = await r.json().catch(() => null);
    return typeof v === "string" ? v : null;
  } catch { return null; }
}

export async function projetoOg(context, buscar = buscarTema) {
  const res = await context.next();
  try {
    const ct = res.headers.get("content-type") || "";
    if (res.status !== 200 || !ct.includes("text/html")) return res;
    const u = new URL(context.request.url);
    const tok = (u.searchParams.get("t") || "").trim();
    const valido = TOKEN_OK.test(tok);
    const tema = valido ? await buscar(context.env, tok) : null;
    const url = valido ? `${SITE}/projeto?t=${encodeURIComponent(tok)}` : `${SITE}/projeto`;
    const html = reescreverSign(await res.clone().text(), tema === "natura-deck" ? CARTAO_PROJETO_NATURA : CARTAO_PROJETO, url);
    const headers = new Headers(res.headers);
    ["content-length", "content-encoding", "etag"].forEach((n) => headers.delete(n));
    headers.set("content-type", "text/html; charset=utf-8");
    return new Response(html, { status: 200, headers });
  } catch {
    return res; // qualquer surpresa: a casca de sempre
  }
}

// /natura-setup — o checklist que a Natura preenche (2026-10-18). Cartão FIXO no tema do deck.
// Fonte da imagem: scripts/og_natura_setup.html → Chrome headless 1200×630 → public/og/natura-guileo-setup.png.
export const CARTAO_NATURA_SETUP = {
  title: "Natura Spa × Guileo AI — Your setup checklist",
  description: "Everything we need from Natura, platform by platform · one tap per item · Go-Live October 29, 2026.",
  image: SITE + "/og/natura-guileo-setup.png", imageW: "1200", imageH: "630", imageType: "image/png",
  imageAlt: "Natura Spa × Guileo AI — setup checklist for the Go-Live on October 29, 2026",
};

export async function cartaoFixoOg(context, cartao, url) {
  const res = await context.next();
  try {
    const ct = res.headers.get("content-type") || "";
    if (res.status !== 200 || !ct.includes("text/html")) return res;
    const html = reescreverSign(await res.clone().text(), cartao, url);
    const headers = new Headers(res.headers);
    ["content-length", "content-encoding", "etag"].forEach((n) => headers.delete(n));
    headers.set("content-type", "text/html; charset=utf-8");
    return new Response(html, { status: 200, headers });
  } catch {
    return res;
  }
}
