// Cloudflare Pages Function — GET/POST /api/credit-alerts?token=DIGEST_TOKEN
// Loop 5 (real-time): when a client's Gui credits hit 0 (depleted_at stamped by the
// consume path), email the CLIENT a branded "top up" alert + heads-up Luis, once.
// Driven by the */15 cron. Re-arms automatically when they top up (add_client_credits
// clears depleted_at/alerted_at).
import { json, isOwnerEmail, safeEq } from "../lib/guard.js";
import { creditDepletedEmail, creditDepletedUpgradeEmail } from "../lib/emailTemplates.js";
import { SELF_SERVE_PLANS } from "../../src/data/selfServePlans.js";

// Infer the NEXT plan up from the stored plan label (e.g. "Growth") so the depleted-credits
// alert carries a DIRECT live Stripe upgrade link (paying it = instant upgrade, credits are
// ADDED on top by add_client_credits). Returns null when not inferable or already on top.
function nextPlanUp(planLabel) {
  const lower = (planLabel || "").toString().toLowerCase();
  const i = SELF_SERVE_PLANS.findIndex((p) => lower.includes(p.id) || lower.includes(p.name.toLowerCase()));
  return i >= 0 ? SELF_SERVE_PLANS[i + 1] || null : null;
}

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const send = (env, to, subject, html) => fetch("https://api.resend.com/emails", {
  method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [to], subject, html }),
});

export async function onRequest(context) {
  const { request, env } = context;
  try {
    const tok = new URL(request.url).searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
    if (!env.DIGEST_TOKEN || !safeEq(tok, env.DIGEST_TOKEN)) return json({ error: "unauthorized" }, 401);
    const ING = env.INGEST_SECRET || "";

    const dr = await rpc("due_credit_alerts", { p_secret: ING });
    const due = dr.ok ? await dr.json() : [];
    if (!Array.isArray(due) || due.length === 0) return json({ ok: true, alerted: 0 });

    const OWNER = (env.OWNER_EMAIL && isOwnerEmail(env.OWNER_EMAIL, env)) ? env.OWNER_EMAIL : "smart@guileoai.com";
    let sent = 0, failed = 0;
    for (const c of due) {
      const email = (c.client_email || "").toString();
      if (!email.includes("@")) { await rpc("mark_credit_alerted", { p_secret: ING, p_email: email }); continue; }

      // profile for a personal greeting + the client's language
      let business = "seu negócio", lang = "pt", name = "tudo bem";
      try {
        const pr = await rpc("get_client_profile", { p_secret: ING, p_email: email });
        if (pr.ok) { const p = await pr.json(); if (p && typeof p === "object") { business = p.business_name || business; lang = ["pt", "es", "en"].includes(p.lang) ? p.lang : "pt"; name = p.owner || (lang === "en" ? "there" : "tudo bem"); } }
      } catch { /* defaults */ }

      // Only a DELIVERED alert may mark the client as alerted. mark_credit_alerted is a
      // one-shot latch: once set, this client is never warned again. Marking it after a
      // failed (or skipped, when RESEND_API_KEY is absent) send meant the client's Gui went
      // quiet — no calls, no follow-ups — and they were never told why. Leaving it unmarked
      // costs nothing: the next cron run simply retries.
      let clientAlerted = false;

      if (env.RESEND_API_KEY) {
        // Conversion path: the alert carries the DIRECT upgrade link of the next plan up
        // (live Stripe payment link → webhook adds the credits instantly). Not inferable /
        // already on top → same branded alert with a /planos fallback (creditDepletedEmail).
        const up = nextPlanUp(c.plan);
        const tpl = up
          ? creditDepletedUpgradeEmail({ name, business, lang, upgradeName: up.name, upgradePrice: up.price, upgradeCredits: up.credits, upgradeUrl: up.url || "https://guileoai.com/planos" })
          : creditDepletedEmail({ name, business, lang });
        const r = await send(env, email, tpl.subject, tpl.html);                        // client (branded)
        clientAlerted = !!(r && r.ok);
        // The owner heads-up now states whether the CLIENT was actually reached. When it wasn't,
        // this email IS the safety net — it's the only way anyone learns the client's Gui went
        // quiet without them being told.
        await send(env, OWNER,
          clientAlerted
            ? `⚡ ${business} (${email}) zerou os créditos do Gui`
            : `🚨 ${business} (${email}) zerou os créditos E NÃO recebeu o aviso — LIGUE`,
          `<div style="font-family:system-ui,sans-serif;max-width:520px"><b>${business}</b> (${email}) ficou sem créditos — o Gui pausou as tarefas pagas (ligações, mensagens, follow-ups). ${
            clientAlerted
              ? `O cliente recebeu o aviso pra recarregar${up ? ` com o link direto do upgrade pro <b>${up.name}</b> ($${up.price}/mês)` : ""}.`
              : `<b style="color:#b91c1c">O e-mail pro cliente FALHOU</b> — ele não sabe que o Gui parou. Fale com ele antes que ache que o produto quebrou.`
          } Plano: ${c.plan || "—"}. Vale dar um toque.</div>`);
      }
      // Always latch, even on failure. Leaving it unmarked would make the */15 cron reprocess
      // this client forever — and the owner heads-up above would fire every 15 minutes. The
      // failure isn't swallowed: the owner got the 🚨 version of the email instead.
      await rpc("mark_credit_alerted", { p_secret: ING, p_email: email });
      if (clientAlerted) sent++; else failed++;
    }
    return json({ ok: true, alerted: sent, failed });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 120) }, 500);
  }
}
