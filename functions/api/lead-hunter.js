// Cloudflare Pages Function — POST /api/lead-hunter  (admin-token gated)
//
// O CAÇADOR DE LEADS — enche o pipeline de cada vendedor sozinho, com negócio REAL.
//
// POR QUE EXISTE: em 2026-08-05 eu montei a lista de prospects do Kendall e do Darwin
// pesquisando na mão, uma busca de cada vez. Deu 33 e 17 — e travou, porque busca pública
// devolve NOME e quase nunca telefone (Yelp e Google bloqueiam raspagem de propósito).
// Isso não escala: cada vendedor novo exigiria uma tarde minha, e o resultado seria uma
// lista pela metade. A API oficial do Google Places resolve por dentro: nome, telefone,
// endereço, site e nota, com licença pra usar.
//
// ── AS TRAVAS ────────────────────────────────────────────────────────────────
//  1. NUNCA INVENTA. Só entra o que a API devolveu. Sem telefone → campo vazio e a nota diz
//     "confirmar contato". Lista curta e verdadeira vale mais que longa e furada — vendedor
//     que liga em número errado duas vezes para de confiar na lista inteira.
//  2. NÃO DUPLICA. `place_id` é único por prospect: rodar de novo na mesma área só traz o
//     que é novo. O vendedor nunca vê o mesmo negócio duas vezes.
//  3. TETO DE GASTO. `max` limita quantos lugares buscar por chamada (padrão 60). A API é
//     paga por consulta; laço sem teto vira fatura surpresa.
//  4. `dry_run` PADRÃO. Sem `confirm:true` ele MOSTRA o que gravaria, e não grava nada.
//  5. ADMIN APENAS + inerte sem a chave: sem GOOGLE_PLACES_KEY responde `ready:false` e
//     explica — nunca finge que buscou.
import { json, rateLimited } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const adminOk = (token) => fetch(`${SB}/rest/v1/rpc/blitz_stats`, {
  method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify({ p_token: (token || "").toString(), p_email: "" }),
});

// Os tipos que a Guileo atende de verdade. Não adianta trazer posto de gasolina.
const TYPES = ["hair_care", "beauty_salon", "spa", "dentist", "physiotherapist",
  "veterinary_care", "restaurant", "gym", "lawyer", "real_estate_agency"];

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (await rateLimited(request, env, "lead-hunter", 10, 300, true)) return json({ error: "muitas tentativas" }, 429);
    const b = await request.json().catch(() => ({}));

    const vr = await adminOk(b.token);
    if (!vr.ok) return json({ error: "unauthorized" }, 401);

    if (!env.GOOGLE_PLACES_KEY) {
      return json({ ok: false, ready: false,
        note: "GOOGLE_PLACES_KEY não configurada. Crie em console.cloud.google.com → APIs → Places API (New) e cole no Cloudflare. Sem ela eu NÃO busco nada (não invento lead)." }, 503);
    }

    const seller = (b.seller_email || "").toString().trim().toLowerCase();
    const area = (b.area || "").toString().trim();          // ex.: "Murray Hill, Manhattan, NY"
    const types = Array.isArray(b.types) && b.types.length ? b.types.filter((t) => TYPES.includes(t)) : TYPES;
    const max = Math.min(Math.max(Number(b.max) || 60, 1), 120);
    const confirm = b.confirm === true;
    if (!seller.includes("@") || !area) return json({ error: "seller_email + area obrigatórios" }, 400);

    // BUSCA — Places API (New), textSearch. Pedimos só os campos que usamos: pagar por
    // campo que não vai pro banco é desperdício puro.
    const found = [];
    for (const t of types) {
      if (found.length >= max) break;
      try {
        const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": env.GOOGLE_PLACES_KEY,
            "X-Goog-FieldMask": "places.id,places.displayName,places.nationalPhoneNumber,places.internationalPhoneNumber,places.formattedAddress,places.websiteUri,places.rating,places.userRatingCount",
          },
          body: JSON.stringify({ textQuery: `${t.replace(/_/g, " ")} in ${area}`, maxResultCount: 20 }),
        });
        if (!r.ok) continue;                     // um tipo falhou → segue os outros
        const d = await r.json().catch(() => ({}));
        (d.places || []).forEach((p) => {
          if (found.length >= max) return;
          if (!p?.id || !p?.displayName?.text) return;
          found.push({
            place_id: p.id,
            business: p.displayName.text,
            // telefone SÓ se a API devolveu. Nunca deduzir do endereço nem completar.
            phone: (p.internationalPhoneNumber || p.nationalPhoneNumber || "").replace(/[^0-9+]/g, "") || null,
            note: [area, p.formattedAddress, p.websiteUri,
                   p.rating ? `${p.rating}★ (${p.userRatingCount || 0})` : ""].filter(Boolean).join(" · ").slice(0, 400),
          });
        });
      } catch { /* tipo com erro não derruba a varredura */ }
    }

    // dedup dentro da própria resposta (o mesmo lugar aparece em mais de um tipo)
    const seen = new Set(); const uniq = found.filter((f) => !seen.has(f.place_id) && seen.add(f.place_id));

    if (!confirm) {
      return json({ ok: true, dry_run: true, area, seller_email: seller,
        encontrados: uniq.length, com_telefone: uniq.filter((u) => u.phone).length,
        amostra: uniq.slice(0, 5).map((u) => ({ business: u.business, phone: u.phone || "—" })),
        note: "NADA foi gravado. Reenvie com confirm:true pra inserir no pipeline." });
    }

    const ins = await svcRpc(env, "seller_prospects_bulk", {
      p_secret: env.INGEST_SECRET || "", p_seller_email: seller, p_rows: uniq,
    });
    if (!ins || !ins.ok) return json({ ok: false, error: `gravação falhou (${ins && ins.status})` }, 502);
    const out = await ins.json().catch(() => ({}));
    return json({ ok: true, area, seller_email: seller, encontrados: uniq.length,
      com_telefone: uniq.filter((u) => u.phone).length, ...out });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
