// Cloudflare Pages Function — POST /api/seller-admin
// ADMIN-ONLY management of the seller roster (db/seller_roster.sql). Kills the SELLER_ROSTER env var
// and the shared team-code hole: sellers become DB rows Luis edits from /admin (SellerManager).
//   • list    → every seller incl. their personal_code (+ live conversions per ref)
//   • upsert  → create/update a seller; DB mints a personal GUI-XXXX-9999 code when blank
//   • disable → deactivate (p_active:false) or re-enable (p_active:true) a seller
// AUTH: the SAME admin gate as /api/onboard-client & /api/onboard-draft — blitz_stats(token) raises on
// a wrong token → non-200 → we return 401. A seller can NEVER reach this endpoint. All DB access is
// through INGEST-gated SECURITY DEFINER RPCs; the browser never sees a secret.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { sellerWelcomeEmail } from "../lib/emailTemplates.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// Admin gate — same RPC as onboard-client / onboard-draft. A wrong token raises → non-200.
async function adminOk(token) {
  const vr = await rpc("blitz_stats", { p_token: (token || "").toString(), p_email: "" });
  return vr.ok;
}

// TRUTHFUL conversion signal per seller (db/seller_conversions.sql) — joins the seller's attributed
// leads to registered payments. Returns { converted, paid } or null on any error / until pasted.
async function conversions(ING, ref) {
  if (!ING || !ref) return null;
  try {
    const r = await rpc("seller_conversions", { p_secret: ING, p_ref: ref });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    return d && typeof d.converted === "number" ? { converted: d.converted, paid: Number(d.paid) || 0 } : null;
  } catch { return null; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "seller-admin", 40)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const action = (b.action || "").toString();
    const ING = env.INGEST_SECRET || "";

    // EVERY action here is admin-only.
    if (!await adminOk(b.token)) return json({ error: "unauthorized" }, 401);

    // ── LEADERBOARD — the whole team ranked by refund-net commission (💰). For each seller we
    //    reuse the SAME verified RPCs the individual hub reads (seller_dashboard for the wallet
    //    count + this-month conversions, seller_commission_ledger for the authoritative refund-net
    //    commission + paying-client count). Never recompute money differently — read & reuse.
    //    Admin-gated above; ANON never sees another seller's email/code (we return only display bits).
    if (action === "leaderboard") {
      const lr = await rpc("seller_list", { p_secret: ING });
      if (!lr.ok) return json({ error: "roster unavailable (paste db/seller_roster.sql)" }, 500);
      let sellers = await lr.json().catch(() => []);
      if (!Array.isArray(sellers)) sellers = [];
      // only ranked sellers = active ones (mirror seller_leaderboard's `where s.active`)
      const active = sellers.filter((s) => s && s.active && s.email).slice(0, 200);
      const board = await Promise.all(active.map(async (s) => {
        const email = (s.email || "").toString().toLowerCase();
        const ref = (s.ref || "").toString();
        const [dr, cr] = await Promise.all([
          rpc("seller_dashboard", { p_secret: ING, p_seller_email: email, p_ref: ref }),
          rpc("seller_commission_ledger", { p_secret: ING, p_seller_email: email, p_ref: ref }),
        ]);
        const dash = dr.ok ? await dr.json().catch(() => null) : null;
        const led = cr.ok ? await cr.json().catch(() => null) : null;
        return {
          name: (s.name || "").toString() || email.split("@")[0],
          email,                                                     // admin-only view; safe here
          ref,
          wallet: Number(dash?.clients?.total || 0),                 // clientes na carteira
          paying: Number(led?.totals?.clients || 0),                 // pagantes (refund-net)
          commission: Number(led?.totals?.commission || 0),          // 💰 refund-net commission
          converted_month: Number(dash?.converted_month || 0),       // conversões do mês
        };
      }));
      // rank by commission, then paying clients, then wallet — highest first
      board.sort((a, b) => b.commission - a.commission || b.paying - a.paying || b.wallet - a.wallet);
      return json({ ok: true, count: board.length, board });
    }

    // ── LIST — all sellers (incl. personal_code) + live conversions per ref ──────────────────────────
    if (action === "list") {
      const r = await rpc("seller_list", { p_secret: ING });
      if (!r.ok) return json({ error: "roster unavailable (paste db/seller_roster.sql)" }, 500);
      let rows = await r.json().catch(() => []);
      if (!Array.isArray(rows)) rows = [];
      // enrich with conversions (bounded) — browser stays secret-free; done server-side.
      const out = [];
      for (const s of rows.slice(0, 200)) {
        out.push({ ...s, conversions: await conversions(ING, s.ref) });
      }
      return json({ ok: true, count: out.length, rows: out });
    }

    // ── LEDGER — the owner's ACCOUNTS-PAYABLE view for one seller: the same refund-net
    //    commission ledger the seller sees in their hub (seller_commission_ledger, verified)
    //    + that seller's client wallet rows. Admin-gated above; display-only, no mutation. ──
    if (action === "ledger") {
      const email = (b.email || "").toString().trim().toLowerCase();
      if (!email.includes("@")) return json({ error: "email required" }, 400);
      const [lr, wr] = await Promise.all([
        rpc("seller_commission_ledger", { p_secret: ING, p_seller_email: email, p_ref: "" }),
        rpc("seller_wallet", { p_secret: ING, p_seller_email: email }),
      ]);
      const ledger = lr.ok ? await lr.json().catch(() => null) : null;
      const wallet = wr.ok ? await wr.json().catch(() => []) : [];
      if (!ledger) return json({ error: "ledger unavailable (paste db/seller_finance.sql)" }, 500);
      return json({ ok: true, ledger, wallet: Array.isArray(wallet) ? wallet : [] });
    }

    // ── UPSERT — create/update; DB mints a GUI-XXXX-9999 code when blank. Returns ONLY this seller. ──
    if (action === "upsert") {
      const email = (b.email || "").toString().trim().toLowerCase();
      if (!email.includes("@")) return json({ error: "email inválido" }, 400);
      const r = await rpc("seller_upsert", {
        p_secret: ING, p_email: email,
        p_name: (b.name || "").toString().slice(0, 80),
        p_ref: (b.ref || "").toString().slice(0, 40),
        p_code: (b.code || "").toString().slice(0, 40),
        p_commission_pct: b.commission_pct == null ? 10 : Number(b.commission_pct),
      });
      if (!r.ok) return json({ error: "upsert falhou (paste db/seller_roster.sql)" }, 500);
      const seller = await r.json().catch(() => null);
      if (!seller || !seller.email) return json({ error: "upsert falhou" }, 500);
      return json({ ok: true, seller });
    }

    // ── INVITE — email a rostered seller their access (login link + personal code) + the tools to
    //    start. The code is looked up server-side via seller_list and NEVER returned to the browser.
    //    Branded template only (emailTemplates.js). Requires RESEND_API_KEY. ──────────────────────────
    if (action === "invite") {
      const email = (b.email || "").toString().trim().toLowerCase();
      if (!email.includes("@")) return json({ error: "email inválido" }, 400);
      if (!env.RESEND_API_KEY) return json({ error: "email not configured (set RESEND_API_KEY)" }, 503);
      const lr = await rpc("seller_list", { p_secret: ING });
      if (!lr.ok) return json({ error: "roster unavailable (paste db/seller_roster.sql)" }, 500);
      const rows = await lr.json().catch(() => []);
      const s = (Array.isArray(rows) ? rows : []).find((x) => (x.email || "").toString().toLowerCase() === email);
      if (!s) return json({ error: "seller not found in roster" }, 404);
      if (s.active === false) return json({ error: "seller is disabled — re-enable before inviting" }, 409);
      const lang = (b.lang || "pt").toString() === "en" ? "en" : "pt";
      const tpl = sellerWelcomeEmail({ name: s.name || email.split("@")[0], email, code: s.personal_code || "", ref: s.ref || "", lang });
      const mr = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [email], subject: tpl.subject, html: tpl.html }),
      });
      if (!mr.ok) return json({ error: `email send failed (${mr.status})` }, 502);
      // redacted confirmation — never echo the personal code back to the browser
      return json({ ok: true, sent: true, to: email, name: s.name || null, had_code: !!s.personal_code, lang });
    }

    // ── DISABLE / RE-ENABLE ─────────────────────────────────────────────────────────────────────────
    if (action === "disable") {
      const email = (b.email || "").toString().trim().toLowerCase();
      if (!email.includes("@")) return json({ error: "email inválido" }, 400);
      const active = b.active === true; // default false = disable
      const r = await rpc("seller_disable", { p_secret: ING, p_email: email, p_active: active });
      if (!r.ok) return json({ error: "toggle falhou" }, 500);
      return json({ ok: true, active, changed: await r.json().catch(() => true) });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
