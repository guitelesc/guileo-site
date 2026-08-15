// src/lib/pwa.js — O LADO NAVEGADOR DO APP DO CLIENTE.
//
// O <head> do primeiro carregamento já vem certo do servidor (functions/site/[slug].js). Este
// arquivo cobre o resto: navegação dentro do SPA (o React troca de página sem recarregar, e o
// <head> continuaria o da página anterior), registro do service worker por slug, e o convite de
// instalação.
//
// ── A REGRA DO CONVITE (honestidade) ────────────────────────────────────────────────────────────
// Botão que não faz nada é pior que botão nenhum. Então:
//   • Android/Chrome/Edge: só mostramos "Instalar" DEPOIS que o navegador disparou
//     `beforeinstallprompt` — ou seja, quando ele de fato aceita instalar. Aí o botão abre o
//     diálogo nativo de verdade.
//   • iOS/iPadOS: o Safari NUNCA dispara esse evento e não existe API de instalação. Mostramos a
//     instrução real (Compartilhar → Adicionar à Tela de Início), não um botão morto.
//   • Já instalado (rodando em standalone): não mostramos nada.
//   • Qualquer outro caso (desktop sem suporte, navegador que não aceita): nada.

// Espelha functions/lib/sitePwa.js — se um lado mudar, o navegador acha que é OUTRO app.
export const caminhosPwa = (slug) => ({
  inicio: `/site/${slug}`,
  escopo: `/site/${slug}`,
  manifest: `/site/manifest/${slug}.webmanifest`,
  sw: `/site/sw/${slug}.js`,
  icone192: `/site/icon/${slug}-192.png`,
});

// Os valores da CASA, que o index.html carrega. Ao sair da rota do cliente voltamos a eles —
// senão o visitante sai de /site/pizzaria para /planos com o manifesto e o ícone da pizzaria
// pendurados, e o navegador chega a oferecer "instalar a pizzaria" numa página da Guileo.
const CASA = { icone: "/apple-touch-icon.png", cor: "#161512" };

function acha(sel, criar) {
  let el = document.head.querySelector(sel);
  if (!el) { el = criar(); document.head.appendChild(el); }
  return el;
}
const meta = (nome) => acha(`meta[name="${nome}"]`, () => Object.assign(document.createElement("meta"), { name: nome }));
const link = (rel) => acha(`link[rel="${rel}"]`, () => Object.assign(document.createElement("link"), { rel }));

// Põe a identidade do NEGÓCIO no <head> — inclusive quando o usuário chegou aqui navegando por
// dentro do SPA e o servidor não teve chance de reescrever nada.
// Devolve a função que desfaz.
export function cabecaDoApp({ slug, nome, cor }) {
  if (typeof document === "undefined" || !slug) return () => {};
  const p = caminhosPwa(slug);

  link("manifest").href = p.manifest;
  link("apple-touch-icon").href = p.icone192;
  meta("theme-color").content = cor || CASA.cor;
  meta("apple-mobile-web-app-capable").content = "yes";
  meta("mobile-web-app-capable").content = "yes";
  if (nome) meta("apple-mobile-web-app-title").content = nome;

  return () => {
    document.head.querySelector('link[rel="manifest"]')?.remove();
    document.head.querySelector('meta[name="apple-mobile-web-app-title"]')?.remove();
    const ati = document.head.querySelector('link[rel="apple-touch-icon"]');
    if (ati) ati.href = CASA.icone;
    const tc = document.head.querySelector('meta[name="theme-color"]');
    if (tc) tc.content = CASA.cor;
  };
}

// Registra o service worker DESTE slug, no escopo DESTE slug. O servidor manda
// `Service-Worker-Allowed: /site/`, que é o que permite um arquivo em /site/sw/ controlar
// /site/<slug>. Falha de registro é silenciosa de propósito: o site continua funcionando
// perfeitamente sem app — o PWA é um bônus, nunca um requisito para ver a página.
export function registrarSw(slug) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !slug) return;
  const p = caminhosPwa(slug);
  navigator.serviceWorker.register(p.sw, { scope: p.escopo }).catch(() => {});
}

// ── Convite de instalação ───────────────────────────────────────────────────────────────────────
// O `beforeinstallprompt` pode disparar antes do React montar o botão. Guardamos o evento assim
// que este módulo carrega e o entregamos a quem perguntar depois.
let guardado = null;
const ouvintes = new Set();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();                       // sem isto o Chrome mostra a barra dele por cima
    guardado = e;
    ouvintes.forEach((f) => f());
  });
  window.addEventListener("appinstalled", () => { guardado = null; ouvintes.forEach((f) => f()); });
}

export const ehIos = () => typeof navigator !== "undefined" && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  // iPadOS 13+ se apresenta como Mac; o toque é o que o entrega.
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
);

export const jaInstalado = () => typeof window !== "undefined" && (
  window.matchMedia?.("(display-mode: standalone)").matches === true ||
  window.navigator?.standalone === true
);

export const temPrompt = () => !!guardado;

// Abre o diálogo NATIVO de instalação. Devolve "aceito" | "recusado" | "indisponivel" — quem
// chama não precisa adivinhar o que aconteceu.
export async function instalarAgora() {
  if (!guardado) return "indisponivel";
  const e = guardado;
  guardado = null;
  try {
    e.prompt();
    const r = await e.userChoice;
    ouvintes.forEach((f) => f());
    return r && r.outcome === "accepted" ? "aceito" : "recusado";
  } catch { ouvintes.forEach((f) => f()); return "indisponivel"; }
}

// Assina mudanças de estado (evento chegou / app instalado). Devolve a função de cancelar.
export function aoMudarInstalacao(fn) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}
