// functions/lib/sitePwa.js — A IDENTIDADE DO APP DE UM CLIENTE, NUM LUGAR SÓ.
//
// O PWA do cliente tem três bocas que precisam falar a MESMA verdade: o manifest
// (/site/manifest/:slug.webmanifest), o service worker (/site/sw/:slug.js) e o ícone
// (/site/icon/:slug-192.png). Se cada uma lesse o banco do seu jeito, um dia o manifest diria
// verde e o ícone sairia vermelho. Então leem daqui.
//
// A fonte é a MESMA RPC pública que o site usa (client_site_public) — a única superfície da
// plataforma que responde sem credencial, porque é literalmente a internet lendo um site. Ela só
// devolve dado quando published = true, e é isso que dá a honestidade de estado exigida:
// site não publicado → não existe manifest, não existe SW, não existe ícone. 404 de verdade.
//
// Multi-tenant: tudo aqui é função do SLUG pedido. Nada é lembrado entre chamadas, nada é
// compartilhado entre slugs.

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

// O MESMO formato de slug aceito por functions/api/client-site.js e functions/site/[slug].js.
export const SLUG_OK = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

export const CORPADRAO = "#2F6F4E";   // idêntico ao fallback de src/pages/ClientSite.jsx

const ehHex = (s) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(s || "").trim());

// Corta um nome longo sem picar palavra ao meio — "short_name" some da tela inicial do Android
// depois de ~12 caracteres, e "Restaurante Do…" é melhor que "Restaurante D".
function curto(nome, max = 12) {
  const n = String(nome || "").trim();
  if (n.length <= max) return n;
  const corte = n.slice(0, max);
  const esp = corte.lastIndexOf(" ");
  return (esp >= 4 ? corte.slice(0, esp) : corte).trim();
}

// carregarSite(slug) → null (não publicado / não existe) ou a identidade do app.
// NUNCA lança: uma falha de rede vira null, e null vira 404 honesto lá em cima.
export async function carregarSite(slug) {
  const s = String(slug || "").toLowerCase();
  if (!SLUG_OK.test(s)) return null;
  let d;
  try {
    const r = await fetch(`${SB}/rest/v1/rpc/client_site_public`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_slug: s }),
    });
    if (!r.ok) return null;
    d = await r.json().catch(() => null);
  } catch { return null; }
  if (!d || d.found !== true || !d.business_name) return null;

  const cfg = d.config || {};
  const loc = Array.isArray(d.locations) ? d.locations : [];
  const nome = String(d.business_name).trim();
  return {
    slug: s,
    nome,
    curto: curto(nome),
    // A cor do app é a MESMA que a página pinta no topo — se divergissem, o app abriria com uma
    // barra de uma cor e o conteúdo de outra.
    cor: ehHex(cfg.color) ? String(cfg.color).trim() : CORPADRAO,
    // O <body> do site é branco; background_color é a tela de abertura do Android, então branco
    // aqui evita o "flash" preto antes do primeiro pixel.
    fundo: "#ffffff",
    sobre: String(cfg.about || "").trim(),
    manchete: String(cfg.headline || "").trim(),
    telefone: loc.map((l) => l && l.phone).find(Boolean) || "",
    cidade: (loc[0] && loc[0].city) || "",
    lang: (String(d.lang || "pt").slice(0, 2).toLowerCase() || "pt"),
    // A resposta crua da RPC, para quem precisa de mais que a identidade do app (o SEO da rota
    // usa serviços e hero_url). Assim o HTML do site faz UMA leitura só, não duas.
    bruto: d,
  };
}

// Descrição do app: texto do PRÓPRIO dono quando existe; senão um resumo só de fato.
// Mesma regra do OG em functions/site/[slug].js — nada de frase de marketing inventada.
export function descricao(site) {
  if (site.sobre) return site.sobre.slice(0, 300);
  return (site.cidade ? `${site.nome} · ${site.cidade}` : site.nome).slice(0, 300);
}

// Caminhos do PWA de UM slug. Um só lugar decide as URLs — o manifest, o SW e o <head> do HTML
// precisam concordar byte a byte, senão o navegador considera o app "outro app".
export const caminhos = (slug) => ({
  inicio: `/site/${slug}`,
  escopo: `/site/${slug}`,
  manifest: `/site/manifest/${slug}.webmanifest`,
  sw: `/site/sw/${slug}.js`,
  icone192: `/site/icon/${slug}-192.png`,
  icone512: `/site/icon/${slug}-512.png`,
});
