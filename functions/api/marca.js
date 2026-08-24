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

// A COR DENTRO DO FAVICON (24/08). O nearmeplumbingastoria.site tem 2.384 bytes, ZERO <img> e
// nenhum og:image — mas o favicon é um SVG embutido no HTML com `fill='%23da2c2c'`, que é o
// vermelho da marca deles. O extrator só olhava CSS, então a cor existia publicada e a gente
// devolvia "nada aproveitável". Site pequeno demais para ter CSS de marca ainda tem ícone, e o
// ícone é onde o dono coloca a cor dele. Pego só o que passa em `corDeMarca`, e o primeiro que
// passar: num ícone de duas cores, a saturada é a marca e a escura é o fundo.
function corDoFavicon(html) {
  const m = /rel="[^"]*icon[^"]*"[^>]*href="(data:image\/svg\+xml[^"]+)"/i.exec(html || "");
  if (!m) return "";
  let svg = m[1];
  try { svg = decodeURIComponent(svg); } catch { /* já legível */ }
  // ⚠️ A PRIMEIRA QUE PASSA NÃO É A CERTA. Neste ícone vinham #0f2744 (o fundo azul-marinho) e
  // #da2c2c (o vermelho do encanamento) — os dois passam no filtro, e eu ficava no primeiro,
  // devolvendo o FUNDO como cor de marca. Num ícone de duas cores o destaque é o mais saturado e
  // de luminosidade média; o fundo é escuro de propósito. E accent quase preto some no relatório,
  // que já é escuro: escolher errado aqui é o mesmo que não ter cor.
  const cores = [...new Set((svg.match(/#[0-9a-f]{6}/gi) || []).map((c) => c.toLowerCase()))].filter(corDeMarca);
  if (!cores.length) return "";
  const pontua = (hex) => {
    const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    const sat = mx === mn ? 0 : (mx - mn) / (l > 0.5 ? 2 - mx - mn : mx + mn);
    return sat - Math.abs(l - 0.5);          // saturado E nem escuro nem estourado
  };
  return cores.sort((a, b) => pontua(b) - pontua(a))[0];
}

export async function onRequestGet({ request, env }) {
  const site = new URL(request.url).searchParams.get("site") || "";
  if (!/^https?:\/\//i.test(site)) return json({ ok: false, logo: "", accent: "", motivo: "site invalido" }, 400);
  if (await rateLimited(request, env, "marca", 30)) return json({ ok: false, logo: "", accent: "", motivo: "rate" }, 429);
  try {
    const mk = await brandFromSite(site);
    if (!mk || mk.why) return json({ ok: false, logo: "", accent: "", motivo: (mk && mk.why) || "sem marca" });
    const logo = /^https?:\/\//i.test(mk.logo_url || "") && !/\.svg(\?|#|$)/i.test(mk.logo_url || "") ? mk.logo_url : "";
    let accent = corDeMarca(mk.accent) ? mk.accent : "";
    if (!accent) {
      // 2ª tentativa antes de desistir: a cor que o dono pôs no ícone do site.
      try {
        const r = await fetch(site, { redirect: "follow", signal: AbortSignal.timeout(7000),
          headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0 Safari/537.36" } });
        if (r.ok) accent = corDoFavicon((await r.text()).slice(0, 200000));
      } catch { /* sem 2ª chance: segue vazio e a página assume o champanhe */ }
    }
    return json({ ok: true, logo, accent, motivo: logo || accent ? "" : "nada aproveitavel" });
  } catch (e) {
    return json({ ok: false, logo: "", accent: "", motivo: String(e).slice(0, 90) });
  }
}
