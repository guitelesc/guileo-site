// SEO da rota /site/:slug — o site do cliente visto por crawler.
//
// POR QUE ISTO EXISTE: WhatsApp, Facebook, LinkedIn e a primeira passada do Google leem o
// HTML CRU. A página é React, então sem isto o link do site de um cliente compartilhado no
// WhatsApp mostraria o título e a descrição da GUILEO — não o negócio dele. Num produto que
// se vende como "o site do seu negócio", isso é o defeito mais visível possível.
//
// Mesmo rewriteOg() usado por /for/* e /blog/* — um só caminho de reescrita, testado.
// Site não publicado / slug inexistente → context.next(): o React renderiza o "não
// encontrado" normalmente, e nenhuma meta de cliente vaza pra uma página que não existe.
import { rewriteOg, SITE, DEFAULT_IMAGE } from "../lib/ogMeta.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

export async function onRequestGet(context) {
  try {
    const slug = String(context.params.slug || "").toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) return context.next();

    const r = await fetch(`${SB}/rest/v1/rpc/client_site_public`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_slug: slug }),
    });
    if (!r.ok) return context.next();
    const d = await r.json().catch(() => null);
    if (!d || d.found !== true || !d.business_name) return context.next();

    const city = d.locations?.[0]?.city || "";
    // A descrição usa o texto do PRÓPRIO dono quando existe; senão, um resumo montado só
    // com fato (cidade + serviços reais). Nunca uma frase de marketing inventada.
    const svc = (d.services || []).slice(0, 3).map((s) => s.name).filter(Boolean).join(", ");
    const desc = (d.config?.about || "").trim()
      || [city ? `${d.business_name} em ${city}.` : `${d.business_name}.`, svc ? `${svc}.` : "", "Fale com a gente — respondemos na hora."]
         .filter(Boolean).join(" ");

    return rewriteOg(context, {
      title: city ? `${d.business_name} · ${city}` : d.business_name,
      description: desc.slice(0, 300),
      url: `${SITE}/site/${slug}`,
      image: d.config?.hero_url || d.config?.logo_url || DEFAULT_IMAGE,
    });
  } catch {
    return context.next();
  }
}

export const onRequest = (c) => (c.request.method === "GET" ? onRequestGet(c) : c.next());
