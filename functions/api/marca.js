// Cloudflare Pages Function — GET /api/marca?site=<url>
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// A LOGO E A COR do negócio, lidas do site dele. É o irmão de /api/capa (que traz a FOTO):
// juntos dão a identidade inteira sem ninguém digitar nada.
//
// POR QUE EXISTE (24/08): os 34 relatórios de prospect estavam TODOS sem marca — só o símbolo da
// Guileo no topo. A regra da casa manda carregar logo e cor no link curto, e isso funciona para
// cliente cadastrado; para prospect medido em massa não existe link curto nenhum, então a
// identidade simplesmente não aparecia. Um laudo com o nome do negócio e a cara da Guileo lê-se
// como template — e template é o que o dono descarta em dois segundos.
//
// TRAVAS (as mesmas de /api/capa, que este espelha):
//  · NUNCA INVENTA: só sai o que estava no HTML DAQUELE site; não achou → vazio + motivo.
//  · Sem rede interna (a checagem vive dentro de brandFromSite/buscarHtml).
//  · Leitura pura: sem gravação, sem segredo, sem tenant — a mesma informação do "compartilhar".
//  · ⚠️ COR DE MARCA, NÃO COR QUALQUER: a extração devolveu #ffffff para o Nonstop, que é
//    vermelho. Branco não dá erro — ele pinta o filete e o número de branco e o documento fica
//    sem marca PARECENDO que tem. Falha disfarçada de sucesso é a que ninguém procura. Sem
//    saturação, devolvo vazio e a página usa o champanhe da casa: assumido, não fingido.
import { json, rateLimited } from "../lib/guard.js";
import { brandFromSite } from "../lib/brandExtract.js";

function corDeMarca(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return false;
  const n = parseInt(m[1], 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  const sat = mx === mn ? 0 : (mx - mn) / (l > 0.5 ? 2 - mx - mn : mx + mn);
  return sat >= 0.22 && l >= 0.12 && l <= 0.88;
}

export async function onRequestGet({ request, env }) {
  const site = new URL(request.url).searchParams.get("site") || "";
  if (!/^https?:\/\//i.test(site)) return json({ ok: false, logo: "", accent: "", motivo: "site invalido" }, 400);
  if (await rateLimited(request, env, "marca", 30)) return json({ ok: false, logo: "", accent: "", motivo: "rate" }, 429);
  try {
    const mk = await brandFromSite(site);
    if (!mk || mk.why) return json({ ok: false, logo: "", accent: "", motivo: (mk && mk.why) || "sem marca" });
    const logo = /^https?:\/\//i.test(mk.logo_url || "") && !/\.svg(\?|#|$)/i.test(mk.logo_url || "") ? mk.logo_url : "";
    const accent = corDeMarca(mk.accent) ? mk.accent : "";
    return json({ ok: true, logo, accent, motivo: logo || accent ? "" : "nada aproveitavel" });
  } catch (e) {
    return json({ ok: false, logo: "", accent: "", motivo: String(e).slice(0, 90) });
  }
}
