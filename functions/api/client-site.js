// Cloudflare Pages Function — GET /api/client-site?slug=<slug>
//
// Leitura PÚBLICA do site de um cliente. É a única superfície da plataforma que responde
// sem credencial — porque é literalmente a internet lendo um site. Toda a proteção mora na
// RPC client_site_public: allowlist explícita de campos, e só quando published = true.
// Nada aqui monta o payload à mão, justamente pra não existir um segundo lugar onde alguém
// possa acidentalmente incluir um campo privado.
import { json } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

export async function onRequestGet(context) {
  const { request } = context;
  try {
    const slug = (new URL(request.url).searchParams.get("slug") || "").trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) return json({ found: false }, 404);

    const r = await fetch(`${SB}/rest/v1/rpc/client_site_public`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_slug: slug }),
    });
    if (!r.ok) return json({ found: false }, 502);
    const d = await r.json().catch(() => null);
    if (!d || d.found !== true) return json({ found: false }, 404);

    // Cache curto na borda: um site de negócio local muda pouco, mas o dono precisa ver
    // a edição dele no ar em segundos — não no dia seguinte.
    return new Response(JSON.stringify(d), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60, s-maxage=60" },
    });
  } catch { return json({ found: false }, 500); }
}

// ── POST: o DONO editando o próprio site (cockpit) ────────────────────────────
// Portão por tenant (e-mail + chave de conexão via get_client_data), o mesmo do resto do
// cockpit. Nunca aceita o e-mail sozinho: um e-mail sem a chave não move nada.
//   action = "get"  → devolve slug/published/config, INCLUSIVE rascunho
//   action = "save" → grava e publica/despublica
async function tenantOk(email, key) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !key) return false;
  try {
    const r = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!r.ok) return false;
    const d = await r.json().catch(() => null);
    return !!d && typeof d === "object" && Array.isArray(d.events);
  } catch { return false; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const email = (b.email || "").toString().trim().toLowerCase();
    if (!(await tenantOk(email, (b.key || "").toString()))) return json({ error: "unauthorized" }, 401);
    const action = (b.action || "get").toString();

    if (action === "get") {
      const r = await svcRpc(env, "client_site_get", { p_secret: env.INGEST_SECRET || "", p_email: email });
      if (!r || !r.ok) return json({ error: "leitura falhou" }, 500);
      return json({ ok: true, site: await r.json().catch(() => ({ exists: false })) });
    }

    if (action === "save") {
      // Sugestão de slug a partir do nome do negócio quando o dono não escolheu um.
      const slug = (b.slug || "").toString().trim().toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")   // tira acento: "café" → "cafe"
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
      const cfg = {};
      for (const k of ["headline", "about", "color", "logo_url", "hero_url"]) {
        if (b[k] != null) cfg[k] = String(b[k]).slice(0, k === "about" ? 600 : 200);
      }
      const r = await svcRpc(env, "client_site_upsert", {
        p_secret: env.INGEST_SECRET || "", p_email: email, p_slug: slug,
        p_published: b.published === true, p_config: cfg,
      });
      if (!r || !r.ok) return json({ error: "gravação falhou" }, 500);
      const out = await r.json().catch(() => ({ ok: false }));
      // A RPC recusa slug inválido / já usado por outro cliente — repassar o motivo REAL,
      // não um "erro ao salvar" genérico que deixa o dono sem saber o que corrigir.
      if (!out || out.ok !== true) return json({ error: out?.error || "slug inválido" }, 400);
      return json({ ok: true, slug: out.slug, url: `https://guileoai.com/site/${out.slug}` });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) { return json({ error: String(e).slice(0, 140) }, 400); }
}
