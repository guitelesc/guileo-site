// GET /api/review-link?q=<nome + endereço> · x-guileo-secret: INGEST
// O LINK DE AVALIAÇÃO DO GOOGLE, ACHADO — não digitado (2026-09-28).
// A Natura tinha `review_link = https://g.page/r/naturaspa/review` no cadastro: parece um link do
// Google, mas não existe — cai na página inicial do google.com. O motor de avaliação mandaria o
// cliente feliz pra lugar nenhum, no momento exato em que ele queria elogiar. Link de avaliação real
// tem o place_id do Google; este endpoint busca o negócio no Places e devolve o link oficial
// (search.google.com/local/writereview?placeid=…) junto com nome/endereço/nota, pra conferir ANTES
// de gravar. Só leitura: gravar no cadastro é um passo separado e consciente.
import { json, safeEq } from "../lib/guard.js";

export async function onRequestGet({ request, env }) {
  const tok = request.headers.get("x-guileo-secret") || "";
  if (!env.INGEST_SECRET || !safeEq(tok, env.INGEST_SECRET)) return json({ error: "unauthorized" }, 401);
  if (!env.GOOGLE_PLACES_KEY) return json({ ok: false, erro: "sem_chave", motivo: "GOOGLE_PLACES_KEY não está neste ambiente" }, 503);
  const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 200);
  if (q.length < 4) return json({ ok: false, erro: "sem_busca" }, 400);
  const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": env.GOOGLE_PLACES_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri" },
    body: JSON.stringify({ textQuery: q, maxResultCount: 5 }),
  });
  if (!r.ok) return json({ ok: false, erro: "google", motivo: `HTTP ${r.status}` }, 502);
  const d = await r.json().catch(() => ({}));
  const lugares = (Array.isArray(d?.places) ? d.places : []).map((p) => ({
    nome: p?.displayName?.text || "", endereco: p?.formattedAddress || "", nota: p?.rating ?? null, avaliacoes: p?.userRatingCount ?? 0,
    place_id: p?.id || "", review_link: p?.id ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(p.id)}` : "",
    maps: p?.googleMapsUri || "",
  }));
  return json({ ok: true, q, lugares });
}
