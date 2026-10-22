// Cloudflare Pages Function — /api/nps · quarterly NPS engine (send + vote in one endpoint).
//
//   GET/POST /api/nps?token=DIGEST_TOKEN
//     Cron mode: iterates clients (clients_list RPC, same enumeration as /api/health-monitor),
//     and for each ACTIVE client (provisioned: agent + number) not surveyed in the last 90 days
//     takes an ATOMIC claim (nps_claim, db/nps.sql) BEFORE sending the npsEmail — so two racing
//     cron runs can never double-survey. Caps at 30 emails per run. Until db/nps.sql is pasted
//     the endpoint reports ready:false and sends NOTHING (no dedup guard → no spam).
//
//   GET /api/nps?vote=N&e=<base64url email>&s=<hmac>&l=<lang>
//     Vote mode: the email's 0–10 buttons land here. `s` is an HMAC-SHA256 of "nps:"+email keyed
//     by INGEST_SECRET (base64url) — votes can't be forged or aimed at another client's email.
//     Stores via nps_vote (latest score per client per quarter), ingests an '⭐ NPS n'
//     client_event, and answers with a tiny branded thank-you page (≤6 asks what was missing,
//     ≥9 nudges toward a review/referral).
import { json, safeEq } from "../lib/guard.js";
import { npsEmail } from "../lib/emailTemplates.js";
import { sbKey } from "../lib/sb.js";
import { motoresAtivos } from "./cron-tick.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const SITE = "https://guileoai.com";
const MAX_SENDS = 30; // hard cap per run — subrequest + mailer budget

async function rpc(env, fn, args) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", ...args }),
  });
  return r.ok ? await r.json() : null;
}

// ── base64url + HMAC (Web Crypto — no deps) ─────────────────────────────────────────
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uDecode = (s) => {
  const b = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return atob(b);
};
async function voteSig(env, email) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.INGEST_SECRET || ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`nps:${email}`));
  return b64u(mac);
}

const langNorm = (v) => { const l = (v || "").toString().toLowerCase().slice(0, 2); return l === "pt" ? "pt" : l === "es" ? "es" : "en"; };

// Referral slug — the EXACT format the Cockpit ReferralCard uses (src/portal/Grow.jsx):
// btoa(unescape(encodeURIComponent(email))) → URL-safe (-/_), padding stripped. Decoded back
// to the referrer email by db/referrals.sql on conversion, so a promoter's ?ref= link earns them
// (and the friend) the free month through the same motor as the Cockpit card.
const refSlug = (s) => { try { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); } catch { return ""; } };

// ── tiny branded thank-you page (inline, zero deps — same cement/champagne world as the emails) ──
function thanksPage(score, lang, email = "") {
  const T = {
    pt: { title: "Obrigado!", body: "Sua resposta foi registrada. Isso ajuda demais.",
      low: "O que faltou pra ser 10? Responde o email da pesquisa e conta pra gente — a gente lê tudo.",
      high: `Que bom! 🌱 Conhece alguém que precisaria de uma Gui? Indica pra gente — ou conta sua experiência no <a href="${SITE}/portal" style="color:#d6c29a;">seu painel</a>.` },
    es: { title: "¡Gracias!", body: "Su respuesta quedó registrada. Nos ayuda muchísimo.",
      low: "¿Qué faltó para ser un 10? Responda al correo de la encuesta y cuéntenos — lo leemos todo.",
      high: `¡Qué bien! 🌱 ¿Conoce a alguien que necesite una Gui? Recomiéndenos — o cuente su experiencia en <a href="${SITE}/portal" style="color:#d6c29a;">su panel</a>.` },
    en: { title: "Thank you!", body: "Your answer is in. This helps more than you know.",
      low: "What would make it a 10? Just reply to the survey email and tell us — we read everything.",
      high: `Love it! 🌱 Know someone who needs a Gui? Send them our way — or share your story in <a href="${SITE}/portal" style="color:#d6c29a;">your dashboard</a>.` },
  };
  // Promoter referral block (score ≥ 9) — hand the happy client their personal ?ref= link with
  // 1-tap copy + WhatsApp, so a 9/10 rating turns straight into the "1 mês grátis" referral loop.
  const R = {
    pt: { lead: "🎁 Indique um negócio amigo — vocês DOIS ganham 1 mês grátis:", copy: "Copiar link", copied: "Copiado ✓", wa: "📲 WhatsApp", share: (l) => `Conhece a Gui? É uma IA que atende meu telefone 24/7… usa meu link e a gente ganha um mês grátis: ${l}` },
    es: { lead: "🎁 Recomienda a un negocio amigo — ambos ganan 1 mes gratis:", copy: "Copiar enlace", copied: "Copiado ✓", wa: "📲 WhatsApp", share: (l) => `¿Conoces a Gui? Es una IA que contesta mi teléfono 24/7… usa mi enlace y los dos ganamos un mes gratis: ${l}` },
    en: { lead: "🎁 Refer a business friend — you BOTH get one month free:", copy: "Copy link", copied: "Copied ✓", wa: "📲 WhatsApp", share: (l) => `Meet Gui — the AI that answers my phone 24/7. Use my link and we each get a free month: ${l}` },
  };
  const r = R[lang] || R.en;
  const slug = email ? refSlug(email) : "";
  const refLink = `${SITE}?ref=${slug || "demo"}`;
  const t = T[lang] || T.en;
  const note = score <= 6 ? t.low : score >= 9 ? t.high : "";
  const tone = score >= 9 ? "#5fbe8d" : score >= 7 ? "#d6c29a" : "#9c9485";
  const waHref = `https://wa.me/?text=${encodeURIComponent(r.share(refLink))}`;
  const refBlock = score >= 9 && email ? `
  <div style="margin-top:20px;padding-top:16px;border-top:1px solid #2b2720;text-align:left;">
    <div style="font-size:13px;font-weight:700;color:#e7dfd2;line-height:1.5;">${r.lead}</div>
    <div style="margin-top:10px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;color:#c2a878;background:#0e0d0b;border:1px solid #2b2720;border-radius:10px;padding:9px 11px;word-break:break-all;">${refLink}</div>
    <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
      <button id="refcopy" type="button" style="flex:1;min-width:120px;cursor:pointer;border:1px solid #4a3f2a;background:rgba(255,138,51,.1);color:#e0b877;font-weight:700;font-size:12.5px;border-radius:999px;padding:9px 12px;">${r.copy}</button>
      <a href="${waHref}" target="_blank" rel="noopener" style="flex:1;min-width:120px;text-align:center;text-decoration:none;background:linear-gradient(135deg,#5fbe8d,#2f6f4f);color:#0e0d0b;font-weight:800;font-size:12.5px;border-radius:999px;padding:9px 12px;">${r.wa}</a>
    </div>
  </div>
  <script>(function(){var b=document.getElementById('refcopy');if(!b)return;b.addEventListener('click',function(){try{navigator.clipboard.writeText(${JSON.stringify(refLink)}).then(function(){b.textContent=${JSON.stringify(r.copied)};setTimeout(function(){b.textContent=${JSON.stringify(r.copy)};},2000);})}catch(e){}});})();</script>` : "";
  return `<!doctype html><html lang="${lang === "pt" ? "pt-BR" : lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guileo · NPS</title></head>
<body style="margin:0;background:#0e0d0b;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;color:#ede7dc;">
<div style="max-width:440px;margin:12vh auto 0;padding:36px 28px;background:#161512;border:1px solid #2b2720;border-radius:22px;text-align:center;box-shadow:0 40px 100px -45px rgba(0,0,0,.92);">
  <div style="font-size:44px;font-weight:900;color:${tone};line-height:1;">${score}</div>
  <h1 style="font-size:22px;font-weight:800;color:#f4f1ea;margin:14px 0 6px;">${t.title}</h1>
  <p style="font-size:15px;color:#c5beb0;line-height:1.7;margin:0;">${t.body}</p>
  ${note ? `<p style="font-size:13.5px;color:#9c9485;line-height:1.7;margin:16px 0 0;padding-top:14px;border-top:1px solid #2b2720;">${note}</p>` : ""}
  ${refBlock}
  <div style="margin-top:22px;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#c2a878;font-weight:700;">Guileo</div>
</div></body></html>`;
}
const html = (body, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

// ── vote path — signed 1-tap link from the email (no DIGEST_TOKEN; the HMAC is the auth) ──
async function handleVote(env, url) {
  const score = parseInt(url.searchParams.get("vote"), 10);
  if (!(score >= 0 && score <= 10)) return html("<h1>Invalid vote</h1>", 400);
  const lang = langNorm(url.searchParams.get("l"));
  let email = "";
  try { email = b64uDecode(url.searchParams.get("e") || "").trim().toLowerCase(); } catch { /* fall through */ }
  const sig = (url.searchParams.get("s") || "").toString();
  if (!email.includes("@") || !env.INGEST_SECRET || !safeEq(sig, await voteSig(env, email))) return html("<h1>Invalid link</h1>", 403);

  // Store the vote (upsert: latest score this quarter). null = db/nps.sql not pasted — the client
  // still gets a graceful thank-you; the score just isn't persisted yet.
  const stored = await rpc(env, "nps_vote", { p_email: email, p_score: score });
  if (stored === true) {
    await rpc(env, "ingest_client_event", {
      p_email: email, p_type: "nps", p_channel: "email",
      p_summary: `⭐ NPS ${score}`, p_amount: 0, p_payload: { score },
    });
  }
  return html(thanksPage(score, lang, email));
}

// ── survey path — cron-driven quarterly send ─────────────────────────────────────────
async function handleSurvey(env) {
  const out = { ok: true, ready: true, surveyed: 0, skipped: 0, sent: [] };
  if (!env.INGEST_SECRET) return json({ ok: false, ready: false, reason: "no INGEST_SECRET" });
  if (!env.RESEND_API_KEY) return json({ ok: false, ready: false, reason: "no mailer" });

  const clients = await rpc(env, "clients_list", {});
  if (!Array.isArray(clients)) return json({ ok: false, ready: false, reason: "clients_list unavailable" });

  const FROM = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
  for (const c of clients) {
    if (out.surveyed >= MAX_SENDS) break;
    const email = ((c && c.client_email) || "").toString().trim().toLowerCase();
    if (!email.includes("@")) continue;

    // ACTIVE = provisioned (agent + number) — same definition as the health-monitor sweep.
    // A client without a live Gui has nothing to score yet.
    const agent = await rpc(env, "client_agent_lookup", { p_email: email });
    if (!agent) { out.skipped++; continue; }
    const number = await rpc(env, "client_number_lookup", { p_email: email });
    if (!number) { out.skipped++; continue; }

    // ATOMIC 90-day claim BEFORE sending — false = surveyed this quarter, null = SQL not pasted.
    const claimed = await rpc(env, "nps_claim", { p_email: email });
    if (claimed === null) { out.ready = false; break; } // db/nps.sql not pasted → report-only, send nothing
    if (claimed !== true) { out.skipped++; continue; }

    const profile = (await rpc(env, "get_client_profile", { p_email: email })) || {};
    const lang = langNorm(profile.lang);
    const business = profile.business_name || "";
    const name = business || email.split("@")[0];

    const sig = await voteSig(env, email);
    const voteUrlBase = `${SITE}/api/nps?e=${b64u(new TextEncoder().encode(email))}&s=${sig}&l=${lang}`;
    const { subject, html: mail } = npsEmail({ name, business, voteUrlBase, lang });

    const sr = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [email], subject, html: mail }),
    });
    if (sr.ok) { out.surveyed++; out.sent.push(email); } else { out.skipped++; }
  }
  return json(out);
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "method" }, 405);
  try {
    const url = new URL(request.url);

    // 1-tap vote from the email — HMAC-signed, no token.
    if (url.searchParams.has("vote")) return await handleVote(env, url);

    // Cron/send mode — same token gate as /api/daily-digest.
    let p = {};
    if (request.method === "POST") { p = await request.json().catch(() => ({})); }
    const tok = (p.token ?? url.searchParams.get("token") ?? "").toString();
    if (env.DIGEST_TOKEN && !safeEq(tok, env.DIGEST_TOKEN)) return json({ ok: false, error: "unauthorized" }, 401);
    // INTERRUPTOR GERAL (2026-09-22) — só o ENVIO obedece. O voto (acima) segue aberto de
    // propósito: quem recebeu a pesquisa antes do desligamento ainda tem um botão no e-mail, e
    // botão que dá erro é pior que pesquisa que não chega. Vem DEPOIS do token (não revela estado
    // a quem não tem a chave) e ANTES de qualquer reserva (nps_claim de 90 dias não é queimado).
    if (!(await motoresAtivos(env))) return json({ ok: true, desligado: true, motivo: "motores_proativos=off — nenhuma pesquisa enviada" });
    return await handleSurvey(env);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 160) }, 500);
  }
}
