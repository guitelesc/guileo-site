// Cloudflare Pages Function — POST /api/broto
// BROTO = our internal support/ops console (the team behind Gui). Gated by the ADMIN
// password (verified server-side via admin_site_stats), then it reaches the support +
// inventory RPCs with the server-side SCHED_SECRET. Surfaces the whole ticket queue
// across every tenant, our platform inventory (numbers/hardware/accounts), and health.
import { json, rateLimited, sameOrigin } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    // slow brute-force on the admin password (the gate below verifies it server-side)
    if (await rateLimited(request, env, "broto", 30)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const token = (b.token || "").toString();
    const action = (b.action || "data").toString();
    const secret = env.SCHED_SECRET || "";

    // GATE: verify the admin password the same way /admin does. admin_site_stats raises on a
    // wrong token (→ non-200), so a clean 200 means this caller is our team.
    const gate = await rpc("admin_site_stats", { p_token: token });
    if (!gate.ok) return json({ error: "unauthorized" }, 401);

    if (action === "ticket_set") {
      const r = await rpc("support_ticket_set", { p_secret: secret, p_id: b.id, p_status: b.status || null, p_resolution: b.resolution || null, p_assigned: b.assigned || null });
      const okv = r.ok ? await r.json().catch(() => false) : false; // parse the RPC bool, not the HTTP status
      return json({ ok: okv === true });
    }
    if (action === "ticket_reply") {
      const r = await rpc("support_ticket_reply", { p_secret: secret, p_id: b.id, p_role: b.role || "human", p_text: b.text || "" });
      const okv = r.ok ? await r.json().catch(() => false) : false;
      return json({ ok: okv === true });
    }
    if (action === "inv_upsert") {
      const r = await rpc("inventory_upsert", { p_secret: secret, p_id: b.id || null, p_kind: b.kind || "number", p_label: b.label || "", p_status: b.status || "available", p_assigned: b.assigned || null, p_meta: b.meta || {} });
      return json({ ok: r.ok, id: r.ok ? await r.json() : null });
    }

    // ACTIVATIONS: the live state of each external money-engine key. Returns ONLY presence
    // (a boolean per env var) — never the secret value. Lets BROTO show the true "ligada/apagada"
    // instead of a manual checkbox. Keys with detect:false are provider-side registrations
    // (e.g. A2P 10DLC lives in the Twilio console, not an env var) → the panel marks them "manual".
    if (action === "activations") {
      const has = (k) => !!(env[k] && String(env[k]).trim());
      const req = (arr) => arr.every(has);        // all required vars present
      // REAL Stripe Connect status — GET /v1/accounts succeeds ONLY on a Connect-enabled platform.
      // "off" = key works but Connect not enabled (Stripe says so); "unknown" = no key / network hiccup.
      let stripeConnect = "unknown";
      if (has("STRIPE_SECRET_KEY")) {
        try {
          const sr = await fetch("https://api.stripe.com/v1/accounts?limit=1", { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
          if (sr.ok) stripeConnect = "on";
          else { const e = await sr.json().catch(() => ({})); stripeConnect = /connect/i.test(e?.error?.message || "") ? "off" : "unknown"; }
        } catch { stripeConnect = "unknown"; }
      }
      // ── A2P 10DLC: estado REAL da campanha na Twilio (2026-08-24) ──────────────────────────
      // Este card mostrava "⚪ Registro do provedor" — um encolher de ombros que escondia o fato
      // de que a campanha foi REPROVADA (erro 30909, CTA não verificável). Card que não distingue
      // "ainda não registrei" de "registraram e recusaram" deixa o canal mudo sem ninguém saber,
      // exatamente como o WhatsApp verde com token vencido. Pergunta-se à Twilio, não ao ambiente.
      let a2p = { detect: false, ready: null, nota: "" };
      if (has("TWILIO_ACCOUNT_SID") && has("TWILIO_AUTH_TOKEN")) {
        try {
          const auth = "Basic " + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
          const sr = await fetch("https://messaging.twilio.com/v1/Services", { headers: { Authorization: auth } });
          // ⚠️ PORTÃO DE STATUS ANTES DO FALLBACK. Sem ele um 401/429 da Twilio virava `{}` →
          // `services: []` → "nenhum A2P" — e o painel diria "não registrado" quando a verdade é
          // "não consegui perguntar". É o mesmo engano do WhatsApp verde com token vencido, que
          // esta própria função existe para não repetir.
          if (!sr.ok) {
            a2p = { detect: false, ready: null, nota: `não deu para ler a Twilio (HTTP ${sr.status}) — isto NÃO é "sem A2P"` };
            throw new Error("twilio_indisponivel");
          }
          const sd = await sr.json().catch(() => ({}));
          const svcs = (sd && sd.services) || [];
          let algumAprovado = false, falha = "";
          for (const sv of svcs.slice(0, 5)) {
            const cr = await fetch(`https://messaging.twilio.com/v1/Services/${sv.sid}/Compliance/Usa2p`, { headers: { Authorization: auth } });
            // Mesmo portão: campanha ilegível é "não sei", nunca "não tem".
            if (!cr.ok) { if (!falha) falha = `campanha ilegível (HTTP ${cr.status})`; continue; }
            const cd = await cr.json().catch(() => ({}));
            for (const it of (cd?.compliance || cd?.us_app_to_person || [])) {
              const st = String(it.campaign_status || "").toUpperCase();
              if (st === "VERIFIED" || st === "APPROVED") algumAprovado = true;
              else if (st === "FAILED" && !falha) {
                const m = (it.errors && it.errors[0] && it.errors[0].description) || "campanha reprovada";
                falha = String(m).slice(0, 140);
              }
            }
          }
          if (algumAprovado) a2p = { detect: true, ready: true, nota: "" };
          else if (falha) a2p = { detect: true, ready: false, nota: `campanha REPROVADA — ${falha}` };
          // sem campanha nenhuma: continua ⚪, porque "não registrei ainda" não é falha.
        } catch { /* rede: mantém ⚪ em vez de acusar falha que não medimos */ }
      }

      const engines = [
        // Stripe CONNECT — now detected for real via the live API probe above (stripeConnect).
        // "on" = Connect enabled (money can route to clients); "off" = key works but Connect not on;
        // "unknown" = no key/hiccup → fall back to "verify at provider".
        { id: "stripe",   detect: stripeConnect !== "unknown", ready: stripeConnect === "on", vars: ["STRIPE_WEBHOOK_SECRET"] },
        { id: "a2p",      detect: a2p.detect, ready: a2p.ready, nota: a2p.nota, vars: [] },
        { id: "whats",    detect: true,  ready: req(["META_APP_ID", "META_APP_SECRET", "META_VERIFY_TOKEN", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET"]), vars: ["META_APP_ID", "META_APP_SECRET", "META_VERIFY_TOKEN", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET"] },
        { id: "gbp",      detect: true,  ready: req(["GOOGLE_BUSINESS_CLIENT_ID", "GOOGLE_BUSINESS_CLIENT_SECRET"]), vars: ["GOOGLE_BUSINESS_CLIENT_ID", "GOOGLE_BUSINESS_CLIENT_SECRET"] },
        { id: "mindbody", detect: true,  ready: has("MINDBODY_API_KEY"),       vars: ["MINDBODY_API_KEY"] },
        { id: "voicecost",detect: true,  ready: has("VOICE_COST_CENTS_PER_MIN"),vars: ["VOICE_COST_CENTS_PER_MIN"] },
        { id: "dunning",  detect: true,  ready: String(env.DUNNING_ENFORCE || "") === "1", vars: ["DUNNING_ENFORCE"] },
        // MP credits with the TOKEN alone (the webhook re-fetches the payment from MP as source of
        // truth). MP_WEBHOOK_SECRET is optional signature hardening, NOT a requirement — so readiness
        // is token-presence. Either MP_ACCESS_TOKEN or MERCADOPAGO_TOKEN counts (the webhook reads both).
        { id: "mp",       detect: true,  ready: has("MP_ACCESS_TOKEN") || has("MERCADOPAGO_TOKEN"), vars: ["MP_ACCESS_TOKEN", "MERCADOPAGO_TOKEN", "MP_WEBHOOK_SECRET"] },
      ];
      // per-var presence map (booleans only — safe to send to the browser)
      const present = {};
      engines.forEach((e) => e.vars.forEach((v) => { present[v] = has(v); }));
      const already = { ELEVENLABS_API_KEY: has("ELEVENLABS_API_KEY"), STRIPE_SECRET_KEY: has("STRIPE_SECRET_KEY"), RESEND_API_KEY: has("RESEND_API_KEY"), TWILIO_ACCOUNT_SID: has("TWILIO_ACCOUNT_SID"), DIGEST_TOKEN: has("DIGEST_TOKEN"), INGEST_SECRET: has("INGEST_SECRET") };
      return json({ ok: true, engines: engines.map(({ id, detect, ready, nota }) => ({ id, detect, ready, nota: nota || "" })), present, already });
    }

    // default: the BROTO dashboard payload — whole queue + inventory in one round-trip.
    const [tq, iv] = await Promise.all([
      svcRpc(env, "support_ticket_list", { p_secret: secret, p_email: "", p_limit: 300 }),
      rpc("inventory_list", { p_secret: secret, p_limit: 500 }),
    ]);
    const tickets = tq.ok ? (await tq.json()) || [] : [];
    const inventory = iv.ok ? (await iv.json()) || [] : [];
    const ready = tq.ok || iv.ok;
    return json({ ok: true, ready, tickets, inventory, note: ready ? null : "Paste db/support.sql to activate." });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
