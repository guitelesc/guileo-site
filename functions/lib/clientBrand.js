// Per-client brand loader for the BRANDED email engine ("motor de crescimento PERSONALIZADO").
// Reads the client's white-label brand (logo, accent color, agent name, business name) so that the
// emails/coupons/promos we send on their behalf carry THEIR identity — not Guileo's. The brand lives
// in client_profile_extras (extras jsonb: logo_url, accent, agent_name, …) + the base profile
// (business_name, lang), both reachable only through INGEST-gated SECURITY DEFINER RPCs.
//
// Same Supabase project + anon key + INGEST-gated rpc() pattern as functions/api/reactivate.js.

import { brandFromSite } from "./brandExtract.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (env, fn, args = {}) => fetch(`${SB}/rest/v1/rpc/${fn}`, {
  method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify({ p_secret: (env && env.INGEST_SECRET) || "", ...args }),
}).then((r) => (r.ok ? r.json() : null)).catch(() => null);

// Guileo house defaults — used verbatim when a client has no brand stored yet, so a branded email
// NEVER renders broken: it just falls back to being a clean Guileo-branded email.
export const GUILEO_BRAND = {
  business: "Guileo",
  logo_url: "https://guileoai.com/favicon.png",
  accent: "#FF8A33",      // Gui orange — the house signal color
  agent_name: "Gui",
  lang: "en",
};

// Uma logo só serve se for http(s) E não for SVG (e-mail não renderiza SVG).
const temLogoInicial = (u) => /^https?:\/\//i.test(u) && !/\.svg(\?|#|$)/i.test(u);

const isHex = (s) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(s || "").trim());

// ── LEGIBILIDADE DA COR DA MARCA ────────────────────────────────────────────────────────────────
// A cor do cliente não é só enfeite: emailTemplates.js a usa como COR DE TEXTO (`color:${accent}`)
// no eyebrow, no preço, no valor do vale-presente e no marcador do rodapé — tudo sobre o cartão
// escuro #161512. Uma marca de site escuro (theme-color "#1B1A17", "#111", "#0f0f0f") atravessa o
// isHex sem problema e some: texto invisível no e-mail que o cliente do cliente recebe. Aconteceu
// hoje, de verdade — #1B1A17 sobre #161512, contraste ~1.05:1.
// A saída NÃO é trocar pela laranja da casa na primeira dificuldade (a cor É dele): clareamos a
// MESMA cor — mesmo matiz, mesma saturação — até passar de 4.5:1. Só quando a cor é acinzentada
// demais para clarear sem virar outra coisa é que caímos no padrão da casa.
const FUNDO_EMAIL = "#161512";   // B.card em functions/lib/emailTemplates.js (cartão do e-mail)

function _rgb(hex) {
  let h = String(hex).trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
const _lum = (hex) => {
  const { r, g, b } = _rgb(hex);
  const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
export function contraste(a, b) {
  const l1 = _lum(a), l2 = _lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
// Clareia mantendo matiz/saturação: puxa cada canal na direção do branco em passos pequenos.
const _clarear = (hex, p) => {
  const { r, g, b } = _rgb(hex);
  const m = (v) => Math.round(v + (255 - v) * p).toString(16).padStart(2, "0");
  return `#${m(r)}${m(g)}${m(b)}`;
};

// corLegivel(hex) → { accent, ajustada } · a cor do cliente, garantidamente visível no e-mail.
export function corLegivel(hex, fundo = FUNDO_EMAIL) {
  if (!isHex(hex)) return { accent: GUILEO_BRAND.accent, ajustada: false, motivo: "sem-cor" };
  const base = String(hex).trim().toLowerCase();
  if (contraste(base, fundo) >= 4.5) return { accent: base, ajustada: false, motivo: "" };
  const { r, g, b } = _rgb(base);
  // Acinzentada (quase sem cor)? Clarear só produziria um cinza qualquer, que não é a marca de
  // ninguém — melhor assumir a cor da casa do que fingir que aquele cinza é a identidade dele.
  if (Math.max(r, g, b) - Math.min(r, g, b) < 25) return { accent: GUILEO_BRAND.accent, ajustada: true, motivo: "cor-escura-sem-matiz" };
  for (let p = 0.1; p <= 0.9; p += 0.1) {
    const c = _clarear(base, p);
    if (contraste(c, fundo) >= 4.5) return { accent: c, ajustada: true, motivo: "clareada-para-legibilidade" };
  }
  return { accent: GUILEO_BRAND.accent, ajustada: true, motivo: "impossivel-clarear" };
}

// brandFor(env, clientEmail) → { business, logo_url, accent, agent_name, lang }
// Graceful: any missing piece falls back to the Guileo default; never throws.
export async function brandFor(env, clientEmail) {
  const email = String(clientEmail || "").trim().toLowerCase();
  if (!email || !env || !env.INGEST_SECRET) return { ...GUILEO_BRAND };
  const [extras, profile] = await Promise.all([
    rpc(env, "profile_extras_get", { p_email: email }),
    rpc(env, "get_client_profile", { p_email: email }),
  ]);
  const x = (extras && typeof extras === "object") ? extras : {};
  const p = (profile && typeof profile === "object") ? profile : {};
  let accent = isHex(x.accent) ? String(x.accent).trim() : "";
  let logo = String(x.logo_url || "").trim();

  // IDENTIDADE AUTOMÁTICA — "assim como cada cliente" (Luis, 2026-08-05). Se o negócio ainda não
  // tem logo/cor guardados, lemos do SITE DELE e gravamos uma vez. Preencher isso à mão não escala:
  // cada cliente novo viraria uma tarefa manual, e o e-mail sairia com a marca da Guileo até alguém
  // lembrar. Só grava campo VAZIO — escolha do dono no cockpit sempre vence.
  // SVG não conta como logo válido: e-mail não renderiza (ver emailTemplates.js).
  let origem = temLogoInicial(logo) ? "cadastro" : "";
  const temLogo = temLogoInicial(logo);
  if (!temLogo || !accent) {
    // De onde tiramos o site do negócio, em ordem de confiança. O `support_link` entra por último
    // porque é o MESMO domínio do site (ex.: naturaspanyc.com/contact) — muitos cadastros preenchem
    // só ele, e sem esse resgate a identidade automática nunca dispararia pra esses clientes.
    let site = String(p.site || p.website || x.site || x.website || "").trim();
    if (!site && x.support_link) { try { site = new URL(String(x.support_link)).origin; } catch { /* link torto → sem site */ } }
    origem = site ? `site:${site}` : "sem-site-no-cadastro";
    if (site) {
      const got = await brandFromSite(site);              // nunca lança; {} se não achou nada
      origem = got.logo_url ? `extraido:${site}` : `falhou:${got.why || "?"}`;
      if (!temLogo && got.logo_url) logo = got.logo_url;
      if (!accent && isHex(got.accent)) accent = got.accent;
      // grava pra não buscar o site de novo no próximo e-mail (best-effort)
      if (got.logo_url || got.accent) {
        await rpc(env, "profile_extras_set", {
          p_email: email,
          p_extras: { ...x, ...(!temLogo && got.logo_url ? { logo_url: got.logo_url } : {}), ...(got.accent && !isHex(x.accent) ? { accent: got.accent } : {}) },
        });
      }
    }
  }
  if (!accent) accent = GUILEO_BRAND.accent;
  // A cor guardada pode ser escura demais para virar TEXTO no cartão escuro do e-mail. Ajusta aqui,
  // no ÚNICO ponto por onde toda cor de cliente passa antes de virar e-mail — em vez de esperar que
  // cada um dos ~12 lugares que fazem `color:${accent}` se lembre de conferir contraste.
  const leg = corLegivel(accent);
  accent = leg.accent;
  const business = String(x.business || p.business_name || "").trim() || GUILEO_BRAND.business;
  const langRaw = String(p.lang || "").toLowerCase().slice(0, 2);
  const lang = langRaw === "pt" ? "pt" : langRaw === "es" ? "es" : (langRaw === "en" ? "en" : GUILEO_BRAND.lang);
  return {
    business,
    // Sem logo PRÓPRIA do cliente devolvemos VAZIO, não a logo da Guileo: o e-mail é a marca DELE
    // na frente do cliente dele. A casca então desenha o monograma com a inicial do negócio, que
    // sempre renderiza e nunca atribui o agendamento à empresa errada.
    logo_url: /^https?:\/\//i.test(logo) && !/\.svg(\?|#|$)/i.test(logo) ? logo : "",
    accent,
    agent_name: String(x.agent_name || "").trim() || GUILEO_BRAND.agent_name,
    lang,
    // DE ONDE VEIO A LOGO. Sem isto, "o e-mail está com a marca errada" vira adivinhação.
    origem_logo: origem || "padrao-guileo",
    // E DE ONDE VEIO A COR. Se ela foi mexida para caber no e-mail, o registro diz por quê —
    // "essa não é exatamente a minha cor" precisa ter resposta, não desconfiança.
    accent_ajustada: leg.ajustada, accent_motivo: leg.motivo || "",
  };
}
