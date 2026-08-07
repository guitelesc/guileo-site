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
  };
}
