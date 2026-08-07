// SEO route: /for/:vertical/:city — per-vertical×city combo OG/title/description.
// Title/desc pattern copied from src/pages/VerticalCity.jsx so the social preview
// matches what the SPA renders.
import { langFromUrl, pick, rewriteOg, SITE, DEFAULT_IMAGE } from "../../lib/ogMeta.js";
import { getSeoVertical } from "../../../src/data/seoVerticals.js";
import { getSeoCity } from "../../../src/data/seoCities.js";

const RECEPT = { en: "AI Receptionist for", pt: "Recepcionista de IA para", es: "Recepcionista de IA para" };
const IN_CITY = { en: "in", pt: "em", es: "en" };

export async function onRequestGet(context) {
  try {
    const v = getSeoVertical(context.params.vertical);
    const c = getSeoCity(context.params.city);
    // Unknown combo → REAL 404 (not a soft-404 200) so crawl budget stays on the real pages.
    if (!v || !c) {
      const res = await context.next();
      return new Response(res.body, { status: 404, headers: res.headers });
    }

    const lang = langFromUrl(context.request.url);
    const vName = pick(v.name, lang);
    const recept = RECEPT[lang] || RECEPT.en;
    const inCity = IN_CITY[lang] || IN_CITY.en;
    const result = pick(v.result, lang);

    const title = `${recept} ${vName} ${inCity} ${c.city} | Guileo`;

    // City-specific tail (first neighborhoods + local area code) so raw-HTML descriptions
    // genuinely differ per city instead of being a pure name swap.
    const n1 = c.neighborhoods?.[0];
    const n2 = c.neighborhoods?.[1];
    const ac = c.areaCodes?.[0];
    const acLabel = ac ? (c.country === "BR" ? `DDD ${ac}` : `(${ac})`) : "";
    const tail = n1 && n2 ? {
      en: ` From ${n1} to ${n2}${acLabel ? ` — every ${acLabel} call answered` : ""}.`,
      pt: ` De ${n1} a ${n2}${acLabel ? ` — toda ligação ${acLabel} atendida` : ""}.`,
      es: ` De ${n1} a ${n2}${acLabel ? ` — cada llamada ${acLabel} atendida` : ""}.`,
    } : { en: "", pt: "", es: "" };

    const desc = {
      en: `Guileo's AI answers, books and follows up 24/7 for ${vName.toLowerCase()} in ${c.city} — voice, WhatsApp & SMS in 16 languages. ${result} Live in 7 days.${tail.en}`,
      pt: `A IA da Guileo atende, agenda e faz follow-up 24/7 para ${vName.toLowerCase()} em ${c.city} — voz, WhatsApp e SMS em 16 idiomas. ${result} No ar em 7 dias.${tail.pt}`,
      es: `La IA de Guileo atiende, agenda y da seguimiento 24/7 para ${vName.toLowerCase()} en ${c.city} — voz, WhatsApp y SMS en 16 idiomas. ${result} Activo en 7 días.${tail.es}`,
    };

    return rewriteOg(context, {
      title,
      description: desc[lang] || desc.en,
      url: `${SITE}/for/${v.slug}/${c.slug}`,
      image: DEFAULT_IMAGE,
    });
  } catch {
    return context.next();
  }
}

export const onRequest = (c) => (c.request.method === "GET" ? onRequestGet(c) : c.next());
