// Cloudflare Pages Function — /api/daily-digest → pulls today's captured leads from the gui_actions
// store and emails the owner the branded daily digest. Designed to be hit once a day by a cron
// (Cloudflare cron worker / cron-job.org / GitHub Action). GET or POST.
//   GET  /api/daily-digest?to=owner@x.com&lang=pt&token=SECRET
//   POST /api/daily-digest  { to, lang, token }
// If DIGEST_TOKEN is set in env, the request must include a matching token (so randoms can't trigger it).
import { dailyLeadsEmail } from "../lib/emailTemplates.js";
import { isOwnerEmail, safeEq } from "../lib/guard.js";
import { emailsDoDonoMudos } from "../lib/avisarDono.js";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = new URL(request.url);
    let p = {};
    if (request.method === "POST") { p = await request.json().catch(() => ({})); }
    const q = (k) => p[k] ?? url.searchParams.get(k);

    if (env.DIGEST_TOKEN && !safeEq((q("token") || "").toString(), env.DIGEST_TOKEN)) return json({ ok: false, error: "unauthorized" }, 401);

    const to = (q("to") || env.OWNER_EMAIL || "smart@guileoai.com").toString().trim();
    // SECURITY: the digest leaks the last 24h of lead data — only deliver to the owner's inbox,
    // so a caller can't exfiltrate leads to an arbitrary address.
    if (!isOwnerEmail(to, env)) return json({ ok: false, error: "recipient not allowed" }, 403);
    const lang = q("lang") === "pt" ? "pt" : "en";
    const name = (q("name") || "there").toString().slice(0, 80);

    // Pull recent leads from the gui_actions store (last 24h).
    const SB_URL = env.GUI_ACTIONS_SUPABASE_URL || "https://ynihodbknhjirkdogxby.supabase.co";
    const SB_ANON = env.GUI_ACTIONS_SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
    const sinceISO = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    // Read leads via the token-gated SECURITY-DEFINER RPC (the base table is RLS-locked against
    // anonymous SELECT). The admin token lives server-side here, never in the client bundle.
    // "NÃO CONSEGUI LER" ≠ "NENHUM LEAD" (2026-09-09). Este bloco engolia qualquer falha da RPC
    // (token errado, 401, banco fora) e seguia com `rows=[]` → a rota respondia 200 "no leads in
    // the last 24h" e o dono lia um dia parado onde havia um digest quebrado. Agora a falha de
    // leitura sai como 502 com o motivo — e o cron-tick, que vigia alvo não-2xx, avisa o dono.
    let rows = [];
    try {
      const r = await fetch(`${SB_URL}/rest/v1/rpc/admin_actions`, {
        method: "POST",
        headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_token: env.ADMIN_TOKEN || "" }),
      });
      if (!r.ok) return json({ ok: false, error: `não consegui ler os leads (admin_actions http ${r.status})`, sent: false }, 503);
      const all = await r.json();
      if (!Array.isArray(all)) return json({ ok: false, error: "não consegui ler os leads (resposta não é lista)", sent: false }, 503);
      rows = all.filter((x) => x.action === "lead" && new Date(x.created_at) >= new Date(sinceISO)).slice(0, 40);
    } catch (e) { return json({ ok: false, error: `não consegui ler os leads: ${String(e).slice(0, 120)}`, sent: false }, 503); }

    // Map gui_actions rows → digest lead cards. Heat is inferred from the source (we don't store it).
    const channelFor = (src) => {
      const s = (src || "").toLowerCase();
      if (s.includes("config") || s.includes("quote")) return "🧮 Quote tool";
      if (s.includes("call") || s.includes("phone") || s.includes("live")) return "📞 Call-back";
      if (s.includes("onboard") || s.includes("portal")) return "🚀 Signup";
      if (s.includes("whats")) return "💬 WhatsApp";
      return "🌐 Website";
    };
    const heatFor = (src) => {
      const s = (src || "").toLowerCase();
      if (s.includes("config") || s.includes("quote") || s.includes("onboard")) return "hot";
      if (s.includes("call") || s.includes("whats")) return "warm";
      return "new";
    };
    const leads = rows.map((x) => ({
      name: x.name || "New contact",
      heat: heatFor(x.source),
      channel: channelFor(x.source),
      want: x.details || x.business || "Reached out — wants to talk.",
      action: lang === "pt" ? "O Gui capturou e qualificou — pronto pra você fechar." : "Gui captured & qualified — ready for you to close.",
    }));

    if (leads.length === 0) return json({ ok: true, sent: false, reason: "no leads in the last 24h" });

    const dateLabel = new Date().toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US", { weekday: "long", month: "short", day: "numeric" });
    const { subject, html } = dailyLeadsEmail({ name, dateLabel, leads, lang });

    const KEY = env.RESEND_API_KEY;
    const FROM = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
    if (!KEY) return json({ ok: false, reason: "no key", leadCount: leads.length });
    if (await emailsDoDonoMudos(env)) return json({ ok: true, mudo: true, reason: "emails_dono=off", leadCount: leads.length });
    const sr = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    });
    const data = await sr.json().catch(() => ({}));
    return json(sr.ok ? { ok: true, sent: true, leadCount: leads.length, id: data?.id || null } : { ok: false, error: data?.message || `HTTP ${sr.status}` });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
}
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...cors, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });
