// GET /site/icon/<slug>-192.png  ·  /site/icon/<slug>-512.png — O ÍCONE DO APP DO CLIENTE.
//
// O ícone que fica na tela inicial do celular do cliente FINAL. Ele é a marca do negócio ali,
// não a nossa: sem logo própria desenhamos o monograma na cor da marca dele (appIcon.js), e a
// logo da Guileo NUNCA entra no app de outro negócio — é a regra desta casa.
//
// Por que não usamos a logo do cliente aqui: o Worker não tem canvas, então não dá para
// redimensionar/recortar uma imagem de terceiro para o quadrado exato que o Android e o iOS
// exigem. Uma logo larga esticada no ícone ficaria pior que o monograma. A logo dele continua
// aparecendo no topo do site (ClientSite.jsx) — só o ícone é gerado.
//
// Site não publicado → 404, igual ao manifest e ao SW.
import { carregarSite } from "../../lib/sitePwa.js";
import { iconePng } from "../../lib/appIcon.js";

const TAMANHOS = new Set([192, 512]);

export async function onRequestGet(context) {
  const bruto = String(context.params.slug || "").toLowerCase();
  const m = bruto.match(/^(.+)-(\d{2,4})\.png$/);
  if (!m) return new Response("formato esperado: <slug>-192.png", { status: 404 });
  const slug = m[1];
  const size = Number(m[2]);
  if (!TAMANHOS.has(size)) return new Response("tamanho não gerado", { status: 404 });

  const site = await carregarSite(slug);
  if (!site) return new Response("site não publicado", { status: 404 });

  const png = iconePng({ nome: site.nome, cor: site.cor, size });
  return new Response(png, {
    headers: {
      "content-type": "image/png",
      // O ícone só muda se o dono mudar nome ou cor. 1 dia de borda + revalidação barata.
      "cache-control": "public, max-age=86400, s-maxage=86400",
      "x-content-type-options": "nosniff",
    },
  });
}

export const onRequest = (c) => (c.request.method === "GET" ? onRequestGet(c) : new Response("method not allowed", { status: 405 }));
