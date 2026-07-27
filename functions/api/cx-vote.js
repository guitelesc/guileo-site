// Cloudflare Pages Function — /api/cx-vote  (XM: the customer's 1-tap survey landing)
// ═════════════════════════════════════════════════════════════════════════════
// A CLIENT's own customer taps a metric button in the post-visit survey email/message and lands
// here. Mirrors functions/api/nps.js vote-mode EXACTLY — the HMAC IS the auth (no token), so a vote
// can't be forged or aimed at another tenant.
//
//   GET /api/cx-vote?v=<raw>&m=<metric>&e=<b64url tenantEmail>&c=<b64url contactRef>&s=<hmac>&l=<lang>
//     s = base64url( HMAC-SHA256(`cx:${email}:${contactRef}`, key = INGEST_SECRET) )
//     metric ∈ nps | csat | ces.  raw = the tapped value (0–10 for nps, 1–5 for csat/ces).
//     On a valid signature: normalize → segment → cx_vote, then a branded cement/champagne
//     thank-you page. Low score → asks what to fix (with a one-line textarea). High → invites a
//     review/referral.
//
//   POST /api/cx-vote   (same fields as JSON, plus `comment`)
//     The thank-you textarea posts back here: re-verify the SAME signature, extract a driver theme
//     (cxEngine.extractTheme), and re-record the vote WITH the comment+theme. One tenant, one contact.
//
// Dependency-free (Web Crypto). HONEST: cx_vote null (db/experience.sql not pasted) still shows a
// graceful thank-you — the vote just isn't persisted yet; nothing is faked.
import { safeEq } from "../lib/guard.js";
import { rpc, normalizeScore, segmentOf, extractTheme } from "../lib/cxEngine.js";

const SITE = "https://guileoai.com";
const METRICS = new Set(["nps", "csat", "ces"]);

// ── base64url + HMAC (Web Crypto — no deps), byte-for-byte the nps.js helpers ─────────────────────
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64uDecode = (s) => {
  const b = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return atob(b);
};
async function voteSig(env, email, contactRef) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.INGEST_SECRET || ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`cx:${email}:${contactRef}`));
  return b64u(mac);
}

const langNorm = (v) => { const l = (v || "").toString().toLowerCase().slice(0, 2); return l === "pt" ? "pt" : l === "es" ? "es" : l === "hi" ? "hi" : "en"; };

// raw range per metric (nps 0–10, csat/ces 1–5) — reject anything off-scale.
function rawInRange(metric, raw) {
  if (!Number.isFinite(raw)) return false;
  if (metric === "nps") return raw >= 0 && raw <= 10;
  return raw >= 1 && raw <= 5; // csat / ces
}

// ── the tiny branded thank-you page (same cement/champagne world as nps.js thanksPage) ──
function thanksPage({ metric, raw, score, segment, lang, params, withComment }) {
  const T = {
    pt: { title: "Obrigado!", body: "Sua resposta foi registrada. Isso ajuda demais.",
      low: "O que a gente pode melhorar? Conta em uma linha — a gente lê tudo.",
      high: "Que bom! 🌱 Se puder, deixe uma avaliação ou indique pra um amigo — significa muito.",
      ph: "O que faltou? (opcional)", send: "Enviar", sent: "Enviado ✓" },
    es: { title: "¡Gracias!", body: "Su respuesta quedó registrada. Nos ayuda muchísimo.",
      low: "¿Qué podemos mejorar? Cuéntenos en una línea — lo leemos todo.",
      high: "¡Qué bien! 🌱 Si puede, deje una reseña o recomiéndenos a un amigo — significa mucho.",
      ph: "¿Qué faltó? (opcional)", send: "Enviar", sent: "Enviado ✓" },
    hi: { title: "धन्यवाद!", body: "आपका उत्तर दर्ज हो गया। इससे बहुत मदद मिलती है।",
      low: "हम क्या बेहतर कर सकते हैं? एक पंक्ति में बताइए।",
      high: "बढ़िया! 🌱 हो सके तो एक समीक्षा दें या किसी मित्र को सुझाएँ।",
      ph: "क्या कमी रही? (वैकल्पिक)", send: "भेजें", sent: "भेजा गया ✓" },
    en: { title: "Thank you!", body: "Your answer is in. This helps more than you know.",
      low: "What could we do better? Tell us in one line — we read everything.",
      high: "Love it! 🌱 If you can, leave a review or send a friend our way — it means the world.",
      ph: "What was missing? (optional)", send: "Send", sent: "Sent ✓" },
  };
  const t = T[lang] || T.en;
  const note = segment === "detractor" ? t.low : segment === "promoter" ? t.high : "";
  const tone = segment === "promoter" ? "#5fbe8d" : segment === "passive" ? "#d6c29a" : "#e0855f";
  const shown = metric === "nps" ? `${raw}` : `${raw}/5`;

  // A low/passive score offers a one-line comment box that POSTs back to THIS endpoint with the
  // SAME signed params, so a driver theme can be captured without a second signature.
  const commentBlock = (segment !== "promoter" && withComment) ? `
  <form id="cxc" style="margin-top:18px;text-align:left;" onsubmit="return false;">
    <textarea id="cxcbody" rows="2" maxlength="500" placeholder="${t.ph}" style="width:100%;box-sizing:border-box;resize:vertical;background:#0e0d0b;border:1px solid #2b2720;border-radius:12px;color:#ede7dc;font-family:inherit;font-size:14px;padding:11px 13px;"></textarea>
    <button id="cxcbtn" type="submit" style="margin-top:10px;width:100%;cursor:pointer;border:1px solid #4a3f2a;background:rgba(255,138,51,.12);color:#e0b877;font-weight:800;font-size:13px;border-radius:999px;padding:11px 12px;">${t.send}</button>
  </form>
  <script>(function(){
    var f=document.getElementById('cxc'),b=document.getElementById('cxcbtn'),ta=document.getElementById('cxcbody');
    if(!f)return;
    f.addEventListener('submit',function(){
      var c=(ta.value||'').trim(); if(!c){return;} b.disabled=true;
      fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify(params)} && Object.assign(${JSON.stringify(params)},{comment:c}))})
        .then(function(){b.textContent=${JSON.stringify(t.sent)};ta.disabled=true;})
        .catch(function(){b.disabled=false;});
    });
  })();</script>` : "";

  return `<!doctype html><html lang="${lang === "pt" ? "pt-BR" : lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guileo · Experience</title></head>
<body style="margin:0;background:#0e0d0b;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;color:#ede7dc;">
<div style="max-width:440px;margin:12vh auto 0;padding:36px 28px;background:#161512;border:1px solid #2b2720;border-radius:22px;text-align:center;box-shadow:0 40px 100px -45px rgba(0,0,0,.92);">
  <div style="font-size:44px;font-weight:900;color:${tone};line-height:1;">${shown}</div>
  <h1 style="font-size:22px;font-weight:800;color:#f4f1ea;margin:14px 0 6px;">${t.title}</h1>
  <p style="font-size:15px;color:#c5beb0;line-height:1.7;margin:0;">${t.body}</p>
  ${note ? `<p style="font-size:13.5px;color:#9c9485;line-height:1.7;margin:16px 0 0;padding-top:14px;border-top:1px solid #2b2720;">${note}</p>` : ""}
  ${commentBlock}
  <div style="margin-top:22px;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#c2a878;font-weight:700;">Guileo</div>
</div></body></html>`;
}

const html = (body, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

// Decode + validate the shared, signed fields from either query (GET) or JSON body (POST).
async function resolve(env, src) {
  const metric = (src.m || "").toString().toLowerCase();
  const raw = parseInt(src.v, 10);
  const lang = langNorm(src.l);
  let email = "", contactRef = "";
  try { email = b64uDecode((src.e || "").toString()).trim().toLowerCase(); } catch { /* fall through */ }
  try { contactRef = b64uDecode((src.c || "").toString()).trim(); } catch { /* fall through */ }
  const sig = (src.s || "").toString();

  if (!METRICS.has(metric)) return { error: "invalid metric" };
  if (!rawInRange(metric, raw)) return { error: "invalid value" };
  if (!email.includes("@") || !contactRef) return { error: "invalid link" };
  if (!env.INGEST_SECRET || !safeEq(sig, await voteSig(env, email, contactRef))) return { error: "invalid link" };

  return { metric, raw, lang, email, contactRef, sig };
}

// Store the vote (idempotent upsert in SQL, latest value per contact per metric). null = SQL not
// pasted → we still show a graceful thank-you; the vote just isn't persisted.
async function storeVote(env, { email, contactRef, metric, raw, comment, theme }) {
  // cx_vote(p_secret,p_email,p_contact_ref,p_metric,p_raw,p_comment,p_theme) — the SQL normalizes
  // raw→score and derives the segment itself, so we send ONLY raw (no p_score/p_segment, which don't
  // exist on the RPC and would 404 at PostgREST, silently dropping the vote).
  return rpc(env, "cx_vote", {
    p_email: email, p_contact_ref: contactRef, p_metric: metric, p_raw: raw,
    p_comment: (comment || "").toString().slice(0, 500), p_theme: (theme || "").toString().slice(0, 40),
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    if (request.method === "GET") {
      const url = new URL(request.url);
      const src = Object.fromEntries(url.searchParams.entries());
      const r = await resolve(env, src);
      if (r.error) return html(`<h1>${r.error}</h1>`, r.error === "invalid link" ? 403 : 400);

      const score = normalizeScore(r.metric, r.raw);
      const segment = segmentOf(r.metric, r.raw);
      await storeVote(env, { ...r, score, segment });

      // params echoed to the thank-you page so its comment textarea can POST back with the SAME sig.
      const params = { v: String(r.raw), m: r.metric, e: src.e, c: src.c, s: r.sig, l: r.lang };
      return html(thanksPage({ metric: r.metric, raw: r.raw, score, segment, lang: r.lang, params, withComment: true }));
    }

    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const r = await resolve(env, body);
      if (r.error) return new Response(JSON.stringify({ ok: false, error: r.error }), { status: r.error === "invalid link" ? 403 : 400, headers: { "Content-Type": "application/json" } });

      const comment = (body.comment || "").toString().trim().slice(0, 500);
      const score = normalizeScore(r.metric, r.raw);
      const segment = segmentOf(r.metric, r.raw);
      // Comment path: derive a driver theme (guarded, anti-injection) then re-record with comment+theme.
      const theme = comment ? await extractTheme(env, comment, r.lang) : "";
      await storeVote(env, { ...r, score, segment, comment, theme });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }

    return html("<h1>method</h1>", 405);
  } catch (e) {
    return html(`<h1>error</h1><!--${String(e).slice(0, 120)}-->`, 500);
  }
}
