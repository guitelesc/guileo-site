// GET /site/manifest/<slug>.webmanifest — O MANIFESTO DO APP DO CLIENTE.
//
// É o arquivo que transforma /site/:slug de "página" em "app instalável": o Android lê daqui o
// nome, o ícone, a cor e a tela em que o app abre. Cada cliente tem o SEU — gerado do perfil real
// do negócio, nunca um template com a marca da Guileo.
//
// HONESTIDADE DE ESTADO (regra da casa): site não publicado → 404. Sem manifesto, o navegador
// simplesmente não oferece instalar. Melhor não existir do que existir uma casca vazia com o nome
// de um negócio que ainda não está no ar.
import { carregarSite, descricao, caminhos } from "../../lib/sitePwa.js";

const nao = (motivo) => new Response(JSON.stringify({ error: motivo }), {
  status: 404, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

export async function onRequestGet(context) {
  // O arquivo se chama <slug>.webmanifest, então o parâmetro chega com a extensão colada.
  const bruto = String(context.params.slug || "").toLowerCase();
  const slug = bruto.replace(/\.webmanifest$/, "");
  if (slug === bruto) return nao("extensão esperada: .webmanifest");

  const site = await carregarSite(slug);
  if (!site) return nao("site não publicado");

  const p = caminhos(slug);
  // Um ícone só, em dois tamanhos, com purpose "any maskable": o quadrado é cheio e a inicial
  // cabe na safe zone (ver functions/lib/appIcon.js), então o mesmo arquivo serve para o ícone
  // normal e para a máscara adaptativa do Android — sem duplicar arquivo nem inventar variante.
  const icone = (url, px) => ({ src: url, sizes: `${px}x${px}`, type: "image/png", purpose: "any maskable" });

  const manifest = {
    id: p.inicio,
    name: site.nome,
    short_name: site.curto,
    description: descricao(site),
    lang: site.lang,
    dir: "ltr",
    // Abre DIRETO na tela do negócio (não numa home genérica). ?app=1 não muda nada do conteúdo:
    // é só a marca de "esta visita veio do ícone instalado", para o dono conseguir separar depois
    // quem abre pelo app de quem abre pelo link. Quem decide o layout de app é o display-mode
    // standalone, lido em src/pages/ClientSite.jsx — não este parâmetro.
    start_url: `${p.inicio}?app=1`,
    scope: p.escopo,
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    theme_color: site.cor,
    background_color: site.fundo,
    categories: ["business"],
    icons: [icone(p.icone192, 192), icone(p.icone512, 512)],
    // Atalho de toque-longo no ícone. Só existe quando há telefone REAL cadastrado — um atalho
    // "Ligar" que não liga seria exatamente o tipo de botão morto que esta casa não publica.
    ...(site.telefone ? {
      shortcuts: [{
        name: { pt: "Ligar agora", es: "Llamar ahora", en: "Call now" }[site.lang] || "Ligar agora",
        url: `${p.inicio}?acao=ligar`,
        icons: [icone(p.icone192, 192)],
      }],
    } : {}),
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      // Curto de propósito: o dono muda a cor/nome no cockpit e quer ver no app hoje, não amanhã.
      "cache-control": "public, max-age=300, s-maxage=300",
      "x-content-type-options": "nosniff",
    },
  });
}

export const onRequest = (c) => (c.request.method === "GET" ? onRequestGet(c) : new Response("method not allowed", { status: 405 }));
