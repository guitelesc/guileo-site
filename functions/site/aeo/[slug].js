// functions/site/aeo/:slug — A PÁGINA DE RESPOSTAS DO NEGÓCIO DO CLIENTE.
//
// ── O QUE É ─────────────────────────────────────────────────────────────────────────────────────
//   GET /site/aeo/:slug        → HTML puro, renderizado NO SERVIDOR, com as respostas + JSON-LD
//   GET /site/aeo/:slug.txt    → o mesmo conteúdo em llms.txt (formato llmstxt.org)
//   GET /site/aeo/:slug.json   → só o JSON-LD (para conferir/validar sem ler HTML)
//
// ── POR QUE UMA ROTA NOVA, E NÃO DENTRO DE /site/:slug ──────────────────────────────────────────
// São dois trabalhos diferentes e conflitantes:
//   • /site/:slug é a página de VENDA do cliente — manchete, foto, um botão. O trabalho dela é
//     converter quem já chegou. Enfiar 30 blocos de pergunta-e-resposta ali destrói exatamente o
//     que faz ela funcionar, e ainda por cima ela é React (o conteúdo só existe depois do JS).
//   • Esta página é o DOCUMENTO DE RESPOSTA. O trabalho dela é ser lida por quem não executa
//     JavaScript e responder em texto liso: onde fica, que horas abre, quanto custa. Um fato por
//     título, sem adjetivo, sem carrossel. É feia de propósito e completa de propósito.
// Separadas, cada uma faz o seu trabalho bem, e esta pode ser citada com URL própria.
// O JSON-LD, esse sim, vai NAS DUAS (a de venda recebe pelo patch do SSR — ver o relatório).
//
// ── ROTEAMENTO ──────────────────────────────────────────────────────────────────────────────────
// Segmento estático "aeo" tem precedência sobre o dinâmico, então /site/aeo/x cai aqui e não em
// functions/site/[slug].js. Mesmíssimo padrão já em produção de /site/manifest/:slug e
// /site/sw/:slug. Nada precisa mudar no _middleware.js (o primeiro segmento "site" já é conhecido)
// nem no App.jsx (esta rota nunca chama context.next(): ela devolve o próprio HTML).
//
// ── HONESTIDADE ────────────────────────────────────────────────────────────────────────────────
// • Site não publicado / slug inexistente → 404 de verdade, corpo vazio. Nada é gerado.
// • Nenhum fato → nenhuma seção. Se o negócio não cadastrou endereço, não existe seção de
//   endereço; se não tem preço com moeda determinável, não existe preço. Nada é preenchido com
//   texto genérico só para a página parecer cheia.
// • Nenhuma frase promete posição, ranking ou citação. Ver o rodapé: ele diz ao dono, por escrito,
//   o que esta página faz e o que ela NÃO faz.
//
// ── FAQ DO DONO: POR QUE QUASE NADA APARECE AQUI ────────────────────────────────────────────────
// client_kb parece uma FAQ e NÃO é: é o manual de operação do agente (persona, regra de preço,
// regra de escalada, "NEVER invent"). Publicá-la inteira entregaria o funcionamento interno do
// cliente para a internet. Então só entra a linha marcada com aeo_publico=true, uma a uma, por
// decisão humana. O motivo longo e a auditoria estão em db/aeo.sql.
import { carregarSite } from "../../lib/sitePwa.js";
import { svcJson } from "../../lib/sb.js";
import { blocoJsonLd, grafoDoNegocio, escaparJsonLd, escaparHtml, perguntas, llmsTxt, textos } from "../../lib/dadosEstruturados.js";

const SITE = "https://guileoai.com";
// Cache curto na borda: o dono muda um preço e quer ver no ar em minutos, não no dia seguinte.
// É a mesma janela que /api/client-site já pratica.
const CACHE = "public, max-age=300, s-maxage=300";

const naoAchei = () => new Response("", { status: 404 });

// Busca o complemento (horário + FAQ liberada + fuso). Falhou? A página sai SEM horário e SEM
// preço — nunca com horário chutado. Um dado a menos é honesto; um dado inventado não é.
async function complemento(env, slug) {
  const d = await svcJson(env, "client_site_aeo", { p_secret: env?.INGEST_SECRET || "", p_slug: slug });
  if (!d || d.ok !== true || d.found !== true) return { hours: {}, faqPublico: [], tz: "" };
  return { hours: d.hours || {}, faqPublico: Array.isArray(d.faq_publico) ? d.faq_publico : [], tz: d.tz || "" };
}

function paginaHtml(site, extra) {
  const d = site.bruto || {};
  const t = textos(d.lang || site.lang);
  const base = `${SITE}/site/${site.slug}`;
  const aqui = `${SITE}/site/aeo/${site.slug}`;
  const qs = perguntas(site, extra);
  const titulo = t.titulo(site.nome);

  const secoes = qs.map((p) => `      <section>
        <h2>${escaparHtml(p.q)}</h2>
        <ul>
${p.blocos.map((b) => `          <li>${escaparHtml(b)}</li>`).join("\n")}
        </ul>
      </section>`).join("\n");

  // Sem nenhuma pergunta respondível, a página existe mas não mente sobre ter conteúdo.
  const corpo = secoes || `      <p>${escaparHtml(t.aviso)}</p>`;

  return `<!doctype html>
<html lang="${escaparHtml((d.lang || site.lang || "pt").slice(0, 2))}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escaparHtml(titulo)}</title>
<meta name="description" content="${escaparHtml(`${titulo} — ${t.atualizado}.`).slice(0, 300)}" />
<link rel="canonical" href="${escaparHtml(aqui)}" />
<meta name="robots" content="index, follow" />
<meta name="theme-color" content="${escaparHtml(site.cor)}" />
<meta property="og:title" content="${escaparHtml(titulo)}" />
<meta property="og:url" content="${escaparHtml(aqui)}" />
<meta property="og:type" content="website" />
<link rel="alternate" type="text/markdown" href="${escaparHtml(aqui)}.txt" />
${blocoJsonLd(site, extra)}
<style>
  :root { color-scheme: light dark; }
  body { margin: 0 auto; padding: 2rem 1.25rem 4rem; max-width: 46rem; line-height: 1.6;
         font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  h1 { font-size: 1.6rem; margin: 0 0 .25rem; }
  h2 { font-size: 1.1rem; margin: 2rem 0 .5rem; }
  ul { margin: 0; padding-left: 1.2rem; }
  li { margin: .25rem 0; }
  a { color: ${escaparHtml(site.cor)}; }
  .nota { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #8884; font-size: .82rem; opacity: .75; }
</style>
</head>
<body>
  <main>
    <h1>${escaparHtml(site.nome)}</h1>
    <p>${escaparHtml(titulo)}</p>
${corpo}
    <p><a href="${escaparHtml(base)}">${escaparHtml(t.voltar)}</a></p>
  </main>
  <p class="nota">${escaparHtml(t.aviso)}</p>
</body>
</html>
`;
}

export async function onRequestGet(context) {
  try {
    const bruto = String(context.params.slug || "").toLowerCase();
    // /site/aeo/x, /site/aeo/x.txt e /site/aeo/x.json caem todos no mesmo [slug].
    const formato = bruto.endsWith(".txt") ? "txt" : bruto.endsWith(".json") ? "json" : "html";
    const slug = bruto.replace(/\.(txt|json)$/, "");

    const site = await carregarSite(slug);
    if (!site) return naoAchei();          // não publicado / não existe → 404 honesto

    const extra = await complemento(context.env, slug);

    if (formato === "txt") {
      return new Response(llmsTxt(site, extra), {
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": CACHE },
      });
    }
    if (formato === "json") {
      const g = grafoDoNegocio(site, extra);
      if (!g) return naoAchei();           // nenhum fato → nenhum documento
      return new Response(escaparJsonLd(g), {
        headers: { "content-type": "application/ld+json; charset=utf-8", "cache-control": CACHE },
      });
    }
    return new Response(paginaHtml(site, extra), {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": CACHE },
    });
  } catch {
    // Falha nossa NUNCA vira uma página meia-boca com dado pela metade.
    return naoAchei();
  }
}

export const onRequest = (c) => (c.request.method === "GET" ? onRequestGet(c) : c.next());
