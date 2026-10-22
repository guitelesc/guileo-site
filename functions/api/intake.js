// Cloudflare Pages Function — POST /api/intake  · CAPTURE TOOLS: pre-visit intake forms
// ─────────────────────────────────────────────────────────────────────────────
// LIVE. Two audiences on one endpoint:
//   • OWNER (cockpit "Captura" tab) — per-tenant gated (email + connection key via get_client_data,
//     same pattern as noshow-radar.js). Manages forms + reads submissions:
//       { action:"list_forms",   email, token }
//       { action:"save_form",    email, token, id?, name, fields:[{key,label,type,required}], active? }
//       { action:"list_subs",    email, token, form_id? }
//   • CUSTOMER (public form link, NO tenant auth) — fills a form. Tenant is derived from form_id
//     inside intake_submit (never trusted from the caller), and the submission best-effort becomes
//     a CRM lead. sameOrigin + rate-limit guard the public path against spam.
//       { action:"submit", form_id, contact:{name,phone,email}, answers:{...}, website? }
// Backend: db/capture_tools.sql (intake_form_upsert / intake_form_list / intake_submit /
// intake_submissions_list). All INGEST-gated (env.INGEST_SECRET).
// ─────────────────────────────────────────────────────────────────────────────
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { avisarDono, TENANT_PLATAFORMA } from "../lib/avisarDono.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (fn, body) => fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((v || "").toString());
const s = (v, n = 200) => (v == null ? "" : v.toString().slice(0, n));

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const action = (b.action || "").toString();
    const ING = env.INGEST_SECRET || "";

    // ── PUBLIC: a página /f/<id> lê nome e campos do formulário (2026-10-05) ──────────────────
    // Faltava: o link que o dono compartilhava abria "página não encontrada". Só devolve o que o
    // formulário mostra (nome, campos, nome do negócio) — nada da conta.
    if (action === "get_form") {
      if (await rateLimited(request, env, "intake-get", 60)) return json({ error: "too many requests" }, 429);
      const formId = s(b.form_id);
      if (!isUuid(formId)) return json({ error: "bad form_id" }, 400);
      const r = await rpc("intake_form_public", { p_form_id: formId });
      if (!r.ok) return json({ ok: false, error: "unavailable" }, 503);
      const d = await r.json().catch(() => null);
      if (!d || !d.ok) return json({ ok: false, error: "not_found" }, 404);
      return json(d);
    }

    // ── DONO: ler as respostas de um formulário DA PLATAFORMA na própria página (2026-10-22) ──────
    // O Luis queria ver o que a Natura marcou "do jeito que enviei pra elas" (/natura-setup?respostas=1).
    // Portão: senha do /admin, lida no CORPO de `_admin_ok` (HTTP 200 não é senha certa). Só o
    // tenant da plataforma: formulário de cliente continua sendo lido pelo cockpit do próprio cliente.
    if (action === "admin_subs") {
      if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
      if (await rateLimited(request, env, "intake-admin", 10)) return json({ error: "too many requests" }, 429);
      const formId = s(b.form_id);
      if (!isUuid(formId)) return json({ error: "bad form_id" }, 400);
      const { svcJson } = await import("../lib/sb.js");
      const a = await svcJson(env, "_admin_ok", { p_token: s(b.senha, 200) }).catch(() => null);
      if (!(a === true || a?.ok === true)) return json({ ok: false, error: "senha" }, 401);
      const r = await rpc("intake_submissions_list", { p_secret: ING, p_email: TENANT_PLATAFORMA, p_form_id: formId, p_limit: 50 });
      if (!r.ok) return json({ ok: false, error: "unavailable" }, 503);
      const subs = await r.json().catch(() => null);
      return json({ ok: true, submissions: Array.isArray(subs) ? subs : [] });
    }

    // ── PUBLIC: a customer submits a filled form (no tenant auth; tenant derived from the form) ──
    if (action === "submit") {
      if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
      if (await rateLimited(request, env, "intake-submit", 12)) return json({ error: "too many requests" }, 429);
      // honeypot: bots fill the hidden "website" field → fake-success, store nothing
      if (s(b.website).trim()) return json({ ok: true, stored: false });
      const formId = s(b.form_id);
      if (!isUuid(formId)) return json({ error: "bad form_id" }, 400);
      const c = b.contact || {};
      const contact = { name: s(c.name, 120), phone: s(c.phone, 40), email: s(c.email, 160) };
      if (!contact.phone && !contact.email && !contact.name) return json({ error: "Need a name or contact" }, 400);
      // keep the answers object small & sane (cap keys + value length)
      const answers = {};
      const src = b.answers && typeof b.answers === "object" ? b.answers : {};
      Object.keys(src).slice(0, 60).forEach((k) => { if (k !== "signature" && k !== "signed_at") answers[s(k, 60)] = s(src[k], 1000); });
      // ASSINATURA (2026-10-05): o corte de 1.000 caracteres destruía a imagem (uma assinatura PNG tem
      // dezenas de milhares). Aceita só imagem PNG em base64, até ~90 KB, e grava a hora em que veio.
      const sig = typeof src.signature === "string" ? src.signature : "";
      if (sig && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(sig) && sig.length <= 90000) {
        answers.signature = sig;
        answers.signed_at = new Date().toISOString();
      }
      const r = await rpc("intake_submit", { p_secret: ING, p_form_id: formId, p_contact: contact, p_answers: answers });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        if (/unknown form/i.test(t)) return json({ ok: false, note: "This form isn't available." }, 404);
        if (/form closed/i.test(t)) return json({ ok: false, note: "This form is no longer accepting responses." }, 410);
        return json({ ok: true, ready: false, note: "Paste db/capture_tools.sql in Supabase to activate intake forms." });
      }
      const sr = await r.json().catch(() => ({}));
      // Formulário da PRÓPRIA Guileo (ex.: /natura-setup, o checklist que o cliente preenche para a
      // implantação): avisa o Luis na hora. Cada envio é um aviso (semTrava) — não é alarme repetido.
      if (sr && sr.tenant === TENANT_PLATAFORMA) {
        context.waitUntil(avisarDono(env, {
          kind: "formulario-cliente", semTrava: true, ignoraMudo: true, link: "/admin",
          summary: `📋 Formulário recebido: ${contact.name || contact.email || "sem nome"}`,
          detail: Object.entries(answers).slice(0, 60).map(([k, v]) => `${k}: ${v}`).join("\n").slice(0, 3000),
          cliente: contact.email || contact.name || "",
        }).catch(() => null));
      }
      const leadPhone = (sr && sr.phone ? sr.phone : contact.phone || "").toString().trim();

      // ── SPEED-TO-LEAD — the moment a form is submitted with a phone, Gui calls the customer back
      //    in ~60s through the SINGLE HARDENED dial gate (/api/call: DNC + fail-closed caps live THERE).
      //    Submitting a contact form IS the customer asking to be contacted (implied consent), same
      //    posture as the marketplace speed-to-lead. Best-effort + waitUntil so the form still returns
      //    instantly. The KV brake shares ONE 50/day + 12h-per-phone budget with lead.js / marketplace.
      let calling = false;
      // Formulário ASSINADO é ficha/termo de quem já é cliente (anamnese antes da massagem), não um
      // pedido de contato: a IA não liga de volta para quem só assinou a ficha (2026-10-05).
      const ehFichaAssinada = !!answers.signature;
      if (leadPhone && !ehFichaAssinada && env.ELEVENLABS_API_KEY && env.ELEVENLABS_PHONE_NUMBER_ID) {
        try {
          let blocked = false;
          if (env.RATE_LIMIT) {
            try {
              if (await env.RATE_LIMIT.get(`callph:${leadPhone}`)) blocked = true;   // 12h per-phone cooldown
              if (!blocked) {
                const dk = `callday:${new Date().toISOString().slice(0, 10)}`;
                const used = parseInt((await env.RATE_LIMIT.get(dk)) || "0", 10) || 0;
                if (used >= 50) blocked = true;                                        // global 50/day auto-call ceiling
                else await env.RATE_LIMIT.put(dk, String(used + 1), { expirationTtl: 90000 });
              }
            } catch { /* KV blip → call.js fail-closed caps backstop */ }
          }
          if (!blocked) {
            if (env.RATE_LIMIT) { try { await env.RATE_LIMIT.put(`callph:${leadPhone}`, "1", { expirationTtl: 43200 }); } catch { /* backstop */ } }
            const origin = new URL(request.url).origin;
            calling = true;
            // waitUntil so the customer's "thanks" returns instantly while Gui dials them.
            // x-guileo-internal (DIGEST) → call.js dials AS this tenant's OWN Gui (client_agent_resolve)
            // and skips the per-IP caps a server would trip; DNC + per-destination cooldown still apply.
            context.waitUntil(fetch(`${origin}/api/call`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Origin: origin, "x-guileo-internal": env.DIGEST_TOKEN || "" },
              body: JSON.stringify({ phone: leadPhone, name: (sr && sr.name) || contact.name || "", need: "returning your request from our website form", lang: "auto", client_email: (sr && sr.tenant) || "" }),
            }).catch(() => {}));
          }
        } catch { /* speed-to-lead is best-effort — the lead is already stored */ }
      }
      return json({ ok: true, stored: true, calling, message: calling ? "Recebido — vamos te ligar já já!" : "Recebido — obrigado! Entraremos em contato." });
    }

    // ── OWNER actions below — per-tenant gate (email ↔ connection key). No OWNER_EMAIL fallback. ──
    const email = s(b.email).trim().toLowerCase();
    const key = s(b.token || b.key).trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);
    const gd = await rpc("get_client_data", { p_email: email, p_key: key });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    if (action === "save_form") {
      const id = isUuid(b.id) ? s(b.id) : null;
      const name = s(b.name, 120) || "Formulário";
      const fields = Array.isArray(b.fields)
        // `options` (2026-10-05): sem ele, o campo de múltipla escolha virava caixa de texto na página pública.
      ? b.fields.slice(0, 30).map((f) => ({ key: s(f.key || f.label, 60), label: s(f.label || f.key, 120), type: s(f.type || "text", 20), required: !!f.required,
          ...(Array.isArray(f.options) ? { options: f.options.slice(0, 30).map((o) => s(o, 120).trim()).filter(Boolean) } : {}) }))
        : [];
      const active = b.active === undefined ? true : !!b.active;
      const r = await rpc("intake_form_upsert", { p_secret: ING, p_email: email, p_id: id, p_name: name, p_fields: fields, p_active: active });
      if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/capture_tools.sql in Supabase to activate intake forms." });
      const newId = await r.json().catch(() => null);
      return json({ ok: true, id: newId });
    }

    if (action === "list_subs") {
      const formId = isUuid(b.form_id) ? s(b.form_id) : null;
      const r = await rpc("intake_submissions_list", { p_secret: ING, p_email: email, p_form_id: formId, p_limit: 300 });
      if (!r.ok) return json({ ok: true, ready: false, submissions: [] });
      const subs = await r.json().catch(() => []);
      return json({ ok: true, ready: true, submissions: Array.isArray(subs) ? subs : [] });
    }

    // default / "list_forms"
    const r = await rpc("intake_form_list", { p_secret: ING, p_email: email });
    if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/capture_tools.sql in Supabase to activate intake forms.", forms: [] });
    const forms = await r.json().catch(() => []);
    return json({ ok: true, ready: true, forms: Array.isArray(forms) ? forms : [] });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
