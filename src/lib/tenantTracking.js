// ─────────────────────────────────────────────────────────────────────────────────────────────
// DOMÍNIO DO CLIENTE no navegador — quem é o cliente deste host, e o RASTREIO DELE.
//
// 1) lerTenant()
//    No domínio de um cliente o servidor (functions/_middleware.js) escreve no <head> um bloco de
//    DADOS: <script type="application/json" id="tenant-boot">{slug, kind, host, indexable,
//    pixelMeta, tagGoogle}</script>. É dado, não script inline — a CSP do site não tem
//    'unsafe-inline'. lerTenant() lê esse bloco uma vez e o publica em window.__GUILEO_TENANT__.
//    Em guileoai.com o bloco não existe: devolve null e nada aqui roda.
//
// 2) O rastreio do cliente (Meta Pixel / tag do Google DELE — nunca os IDs da Guileo)
//    REGRA DE CONSENTIMENTO — a mesma de src/lib/analytics.js: OPT-IN EM TODO LUGAR. Nada carrega
//    antes de um "aceito" explícito do visitante. Hoje NENHUMA tela pede esse aceite (o banner foi
//    removido em 2026-07-28), então, no ar, o pixel do cliente fica DESLIGADO até existir um
//    pedido de consentimento. O carregador está pronto: no instante em que alguém chamar
//
//        grantTenantConsent()          // ou, de fora do bundle: window.guileoTenant.grantConsent()
//
//    a decisão é gravada (180 dias) e os rastreadores do cliente carregam na mesma sessão.
//    denyTenantConsent() grava "só o essencial" e nada carrega.
//
//    A chave de consentimento é PRÓPRIA ("tenant_consent"), diferente da "guileo_consent" do
//    analytics.js. É de propósito: o aceite dado aqui nunca acende o pixel da Guileo no domínio do
//    cliente, porque o analytics.js só olha a chave dele.
// ─────────────────────────────────────────────────────────────────────────────────────────────

const CONSENT_KEY = "tenant_consent";      // { v: "granted" | "essential", at }
const CONSENT_TTL_MS = 180 * 864e5;
const temJanela = () => typeof window !== "undefined" && typeof document !== "undefined";

const PIXEL = /^[0-9]{5,20}$/;
const TAG = /^(G|AW|GTM)-[A-Z0-9]{4,20}$/;
const HOST = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
const SLUG = /^[a-z0-9]([a-z0-9-]{0,48}[a-z0-9])?$/;

/** O cliente deste host ({slug, kind, host, indexable, pixelMeta, tagGoogle}) ou null. */
export function lerTenant() {
  if (!temJanela()) return null;
  if (window.__GUILEO_TENANT__ !== undefined) return window.__GUILEO_TENANT__;
  let t = null;
  try {
    const el = document.getElementById("tenant-boot");
    const d = el ? JSON.parse(el.textContent || "null") : null;
    if (d && SLUG.test(String(d.slug || "")) && HOST.test(String(d.host || ""))) {
      t = Object.freeze({
        slug: d.slug,
        kind: String(d.kind || "vitrine"),
        host: d.host,
        indexable: d.indexable === true,
        pixelMeta: PIXEL.test(String(d.pixelMeta || "")) ? String(d.pixelMeta) : "",
        tagGoogle: TAG.test(String(d.tagGoogle || "")) ? String(d.tagGoogle) : "",
      });
    }
  } catch { /* bloco torto = sem cliente; o app sobe como Guileo e o servidor já negou a rota */ }
  window.__GUILEO_TENANT__ = t;
  return t;
}

// ── consentimento ────────────────────────────────────────────────────────────────────────────
/** "granted" | "essential" | null (o visitante ainda não escolheu, ou a escolha venceu). */
export function tenantConsent() {
  if (!temJanela()) return null;
  try {
    const raw = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null");
    if (!raw || !raw.at || Date.now() - raw.at > CONSENT_TTL_MS) return null;
    return raw.v === "granted" ? "granted" : "essential";
  } catch { return null; }
}
function gravar(v) {
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ v, at: Date.now() })); } catch { /* modo privado */ }
}

// ── carregadores (só rodam com consentimento) ────────────────────────────────────────────────
function pixelMeta(id) {
  if (window.fbq) return; // já existe um pixel nesta página: nunca dois
  !(function (f, b, e, v, n, t, s) {
    n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  window.fbq("init", id);
  window.fbq("track", "PageView");
}

function tagGoogle(id) {
  if (window.gtag || window.google_tag_manager) return;
  window.dataLayer = window.dataLayer || [];
  const s = document.createElement("script");
  s.async = true;
  if (id.startsWith("GTM-")) {
    window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
    s.src = "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(id);
    document.head.appendChild(s);
    return;
  }
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
  document.head.appendChild(s);
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", id);
}

let carregado = false;
function carregar() {
  const t = lerTenant();
  if (!t || carregado) return;
  if (tenantConsent() !== "granted") return; // nunca sem um aceite explícito
  carregado = true;
  try {
    if (t.pixelMeta) pixelMeta(t.pixelMeta);
    if (t.tagGoogle) tagGoogle(t.tagGoogle);
  } catch { /* rastreio nunca derruba a página do cliente */ }
}

/** O visitante ACEITOU: grava a escolha e carrega os rastreadores do cliente agora. */
export function grantTenantConsent() {
  if (!temJanela() || !lerTenant()) return;
  gravar("granted");
  carregar();
}

/** O visitante quis só o essencial: grava; nada carrega. */
export function denyTenantConsent() {
  if (!temJanela() || !lerTenant()) return;
  gravar("essential");
}

/** Chamar UMA vez quando a página do cliente sobe. Carrega só se o aceite já existe de uma visita
    anterior; expõe window.guileoTenant para um banner (ou um script do cliente) conceder depois. */
export function initTenantTracking() {
  const t = lerTenant();
  if (!t) return;
  window.guileoTenant = Object.freeze({
    grantConsent: grantTenantConsent,
    denyConsent: denyTenantConsent,
    consent: tenantConsent,
  });
  carregar();
}
