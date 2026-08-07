// Cloudflare Pages Function — /api/testimonial
//
// O ciclo de PROVA SOCIAL REAL: o cliente escreve → o Luis aprova → a landing mostra.
//
// POR QUE: a landing tem QUOTES=[] — honesto, não inventa depoimento, mas por isso
// ficava vazia pra sempre. Prova social é o maior furo de conversão que sobrou, e é o
// único que código nenhum resolve sozinho: precisa de um cliente falando. O que o
// código faz é tornar o pedido fácil e a publicação segura.
//
// GET  ?lang=pt        → público: SÓ os aprovados (é o que a landing lê)
// POST {action:"submit", email, key, ...}  → o DONO manda o depoimento dele (portão de tenant)
// POST {action:"queue"|"approve", token}   → o Luis revisa (portão de admin)
//
// LEI: nada vai pro site sem aprovação explícita. Depoimento é a palavra de outra
// pessoa — publicar sem revisar seria fabricar prova social.
import { json } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ""));

// GET público — a landing chama isto. Cache curto: aprovou, aparece em ~1 min.
export async function onRequestGet(context) {
  try {
    const lang = (new URL(context.request.url).searchParams.get("lang") || "").trim().slice(0, 5);
    const r = await fetch(`${SB}/rest/v1/rpc/testimonials_public`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_lang: lang || null }),
    });
    const d = r.ok ? await r.json().catch(() => []) : [];
    return new Response(JSON.stringify(Array.isArray(d) ? d : []), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60, s-maxage=60" },
    });
  } catch { return json([]); }
}

// Portão do tenant — o mesmo par (e-mail + chave de conexão) do resto do cockpit.
async function tenantOk(email, key) {
  if (!isEmail(email) || !key) return false;
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
    const action = (b.action || "submit").toString();

    if (action === "submit") {
      const email = (b.email || "").toString().trim().toLowerCase();
      if (!(await tenantOk(email, (b.key || "").toString()))) return json({ error: "unauthorized" }, 401);
      const r = await svcRpc(env, "testimonial_submit", {
        p_secret: env.INGEST_SECRET || "", p_email: email,
        p_author: (b.author || "").toString(), p_role: (b.role || "").toString(),
        p_quote: (b.quote || "").toString(), p_lang: (b.lang || "en").toString(),
      });
      if (!r || !r.ok) return json({ error: "não consegui salvar" }, 500);
      const out = await r.json().catch(() => ({ ok: false }));
      // A RPC recusa depoimento curto — repassar o motivo REAL, não um erro genérico.
      if (!out?.ok) return json({ error: out?.error || "depoimento inválido" }, 400);
      return json({ ok: true, note: "recebido — vai pro ar depois da revisão da Guileo" });
    }

    // ── admin (Luis) ──
    const vr = await fetch(`${SB}/rest/v1/rpc/blitz_stats`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: (b.token || "").toString(), p_email: "" }),
    });
    if (!vr.ok) return json({ error: "unauthorized" }, 401);

    if (action === "queue") {
      const r = await svcRpc(env, "testimonials_queue", { p_secret: env.INGEST_SECRET || "" });
      if (!r || !r.ok) return json({ error: "leitura falhou" }, 500);
      return json({ ok: true, items: await r.json().catch(() => []) });
    }

    if (action === "approve") {
      const r = await svcRpc(env, "testimonial_approve", {
        p_secret: env.INGEST_SECRET || "", p_id: (b.id || "").toString(),
        p_approved: b.approved === true, p_featured: b.featured === true,
      });
      if (!r || !r.ok) return json({ error: "não consegui aprovar" }, 500);
      return json({ ok: (await r.json().catch(() => false)) === true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) { return json({ error: String(e).slice(0, 140) }, 400); }
}
