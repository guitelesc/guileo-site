// Cloudflare Pages Function — POST /api/onboard-draft
// CADASTRO COMPLETO — the seller (in /vendedor) fills ONE complete intake capturing everything about a
// client business + ALL channels and SAVES it as a DRAFT. Luis then approves it with 1-click in /admin,
// which invokes the existing provisioner (/api/onboard-client) server-side — giving birth to the client's
// OWN dedicated agent (own name, voice, brain, schedule, number, branded web widget).
//
// AUTH — two gates, never crossed:
//   • SELLER (save / their own list / delete their own) → verified against the same roster + team code as
//     /api/seller-login (email + code; the code never ships to the browser bundle).
//   • ADMIN  (list ALL / approve / delete any) → verified server-side via the blitz_stats RPC (same admin
//     gate as /api/onboard-client and /api/setup-business). A seller can NEVER approve.
//
// All DB access is through INGEST-gated SECURITY DEFINER RPCs (db/onboard_completo.sql); the browser never
// sees a secret. Same SB/ANON constants + json() helper pattern as the other functions/api files.
import { json, sameOrigin, rateLimited, safeEq } from "../lib/guard.js";
import { voiceByKey } from "../../src/data/agentVoices.js";
import { tentarAutoAprovar } from "../lib/autoApprove.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// ── SELLER auth (mirrors /api/seller-login: roster personal code, else shared team code) ──────────────
const BOOTSTRAP = [
  { email: "luistelesc@gmail.com", code: "GUILEO-DONO", name: "Luis Teles", ref: "luis" },
  { email: "smart@guileoai.com", code: "GUILEO-DONO", name: "Guileo", ref: "guileo" },
];
const TEAM_CODE_DEFAULT = "GUILEO-TIME-2026";
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
function roster(env) {
  try { if (env && env.SELLER_ROSTER) { const arr = JSON.parse(env.SELLER_ROSTER); if (Array.isArray(arr) && arr.length) return arr; } } catch { /* fall back */ }
  return BOOTSTRAP;
}
function sellerAuth(env, email, code) {
  const e = (email || "").toString().trim().toLowerCase();
  const c = (code || "").toString().trim();
  if (!e || !c) return null;
  const match = roster(env).find((s) => (s.email || "").trim().toLowerCase() === e && safeEq(String(s.code || ""), c));
  if (match) return { email: e, name: match.name || e.split("@")[0], ref: (match.ref || e.split("@")[0]).toString().slice(0, 40), roster: true };
  const teamCode = (env && env.TEAM_INVITE_CODE) || TEAM_CODE_DEFAULT;
  // team-code sellers are real but unverified (anyone with the shared code can claim any email),
  // so live credentials (connection_code) are masked for them — full code needs a personal roster code.
  if (safeEq(c, teamCode)) return { email: e, name: e.split("@")[0], ref: slug(e.split("@")[0]) || "team", roster: false };
  return null;
}

// DB roster (db/seller_roster.sql) — the source of truth when present, managed from /admin. Tried
// BEFORE the env/team-code flow: an RPC 404/error just falls through, NEVER breaks the existing login.
// A DB seller is roster:true (full connection_code in the wallet, like a personal-code roster seller).
async function sellerAuthDB(env, email, code) {
  const e = (email || "").toString().trim().toLowerCase();
  const c = (code || "").toString().trim();
  const ING = env && env.INGEST_SECRET;
  if (!e || !c || !ING) return null;
  try {
    const r = await rpc("seller_auth_check", { p_secret: ING, p_email: e, p_code: c });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    if (!d || !d.ok) return null;
    return { email: e, name: d.name || e.split("@")[0], ref: (d.ref || e.split("@")[0]).toString().slice(0, 40), roster: true };
  } catch { return null; }
}
// Unified seller auth: DB roster first (best-effort), then env roster / shared team code.
async function sellerAuthFull(env, email, code) {
  return (await sellerAuthDB(env, email, code)) || sellerAuth(env, email, code);
}

// ── ADMIN auth (same RPC as onboard-client / setup-business) ──────────────────────────────────────────
async function adminOk(token) {
  const vr = await rpc("blitz_stats", { p_token: (token || "").toString(), p_email: "" });
  return vr.ok;
}

// Map the canonical intake payload → the /api/onboard-client body (incl. voice_id, logo_url, accent,
// agent_name, a rich scheduling payload, channels + social/support links).
function mapDraftToOnboard(draft) {
  const d = draft || {};
  const agent = d.agent || {};
  const brand = d.brand || {};
  const ch = d.channels || {};
  const phone = ch.phone || {};
  const voice_id = ((voiceByKey(agent.voice_key) || {}).voice_id) || "";
  // number: canonical mode 'buy'|'map'|'none' → onboard-client number_mode 'buy'|'existing'|'shared'
  const number_mode = phone.mode === "buy" ? "buy" : phone.mode === "map" ? "existing" : "shared";
  // scheduling payload: canonical locations(+hours) + services + team → biz_admin_import shape.
  const locations = Array.isArray(d.locations) ? d.locations : [];
  const services = Array.isArray(d.services) ? d.services : [];
  const team = Array.isArray(d.team) ? d.team : [];
  let payload = null;
  if (locations.length || services.length) {
    const locNames = locations.map((l) => l.name).filter(Boolean);
    const svcNames = services.map((s) => s.name).filter(Boolean);
    // per-location weekly hour blocks (canonical open_min/close_min → start_min/end_min)
    const hoursFor = (locName) => {
      const loc = locations.find((l) => l.name === locName) || locations[0] || {};
      return (Array.isArray(loc.hours) ? loc.hours : []).map((h) => ({
        location: locName, weekday: Number(h.weekday) || 0,
        start_min: Number(h.open_min) || 0, end_min: Number(h.close_min) || 0,
      }));
    };
    const proFrom = (t) => {
      const pLocs = (Array.isArray(t.locations) && t.locations.length ? t.locations : locNames);
      const schedule = pLocs.flatMap((ln) => hoursFor(ln));
      return {
        name: t.name || "Equipe", title: t.title || "", kind: "staff",
        services: (Array.isArray(t.services) && t.services.length ? t.services : svcNames),
        locations: pLocs, schedule,
      };
    };
    const professionals = team.length ? team.map(proFrom)
      : [proFrom({ name: "Equipe", services: svcNames, locations: locNames })];
    payload = {
      replace: false,
      locations: locations.map((l) => ({ name: l.name, city: "", address: l.address || "", phone: l.phone || "", tz: l.tz || "America/New_York" })),
      services: services.map((s) => ({ name: s.name, duration_min: Number(s.duration_min) || 30, price_cents: (s.price_cents == null ? null : Number(s.price_cents)) })),
      professionals,
    };
  }
  // languages (#7): the spoken-language checkboxes are a REAL feature — the agent answers calls in each
  // (mirrors LANGS_SPOKEN in functions/lib/provision.js). So we PLUMB them (not drop them): normalize to
  // clean lowercase codes, always include the primary `lang`, de-dupe. onboard-client passes this on to
  // provisioning so the born agent genuinely speaks the chosen set.
  const primary = ["pt", "es", "en", "hi"].includes(d.lang) ? d.lang : "en";
  const languages = Array.from(new Set([
    primary,
    ...(Array.isArray(d.languages) ? d.languages : [])
      .map((x) => (x || "").toString().trim().toLowerCase())
      .filter((x) => /^[a-z]{2,3}$/.test(x)),
  ])).slice(0, 24);
  return {
    email: (d.client_email || "").toString().trim().toLowerCase(),
    business: (d.business || "").toString(),
    lang: primary,
    // notify_phone (FIX D / #4): the owner's alert/emergency number captured in the wizard. onboard-client
    // persists it via set_client_notify_phone so emergency dispatch + owner alerts have a real number to
    // RING (born NULL = alerts silently degrade to email-only across the whole tenant).
    notify_phone: (d.notify_phone || "").toString().replace(/[^0-9+]/g, "").slice(0, 20),
    languages,
    industry: (Array.isArray(d.verticals) && d.verticals[0]) || (d.description || "").toString().slice(0, 80),
    brain: (d.description || "").toString().slice(0, 4000),
    agent_name: (agent.name || "").toString().slice(0, 40),
    voice_id, voice_key: (agent.voice_key || "").toString().slice(0, 40),
    logo_url: (brand.logo_url || "").toString().slice(0, 500),
    accent: (brand.accent || "").toString().slice(0, 16),
    channels: ch,
    support_link: (d.support_link || "").toString().slice(0, 300),
    review_link: (d.review_link || ch.reviews?.link || "").toString().slice(0, 300),
    plan: (d.plan || "").toString().slice(0, 40),
    credits: Number(d.credits) || 0,
    number_mode,
    area_code: (phone.area_code || "").toString().replace(/[^0-9]/g, ""),
    existing_number: (phone.existing_number || "").toString().replace(/[^0-9+]/g, ""),
    forward_number: (phone.forward || "").toString().replace(/[^0-9+]/g, ""),
    ...(payload ? { payload } : {}),
  };
}

const widgetSnippet = (clientEmail, lang) =>
  `<script src="https://guileoai.com/gui-widget.js" data-guileo="${(clientEmail || "").toString()}" data-lang="${(lang || "pt").toString()}" defer></script>`;

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "onboard-draft", 30)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const action = (b.action || "").toString();
    const ING = env.INGEST_SECRET || "";

    // ── SAVE (seller) ──────────────────────────────────────────────────────────────────────────────
    if (action === "save") {
      const seller = await sellerAuthFull(env, b.seller_email || (b.seller && b.seller.email), b.token || b.seller_code);
      if (!seller) return json({ error: "unauthorized" }, 401);
      const draft = (b.draft && typeof b.draft === "object") ? b.draft : null;
      if (!draft || !draft.business) return json({ error: "draft.business required" }, 400);
      const clientEmail = (draft.client_email || "").toString().trim().toLowerCase();
      const r = await rpc("draft_save", {
        p_secret: ING, p_seller_email: seller.email, p_client_email: clientEmail,
        p_business: (draft.business || "").toString().slice(0, 160), p_payload: draft,
      });
      if (!r.ok) return json({ error: "save failed (paste db/onboard_completo.sql)" }, 500);
      const id = await r.json().catch(() => null);
      // ═══ O CAMINHO INVERSO: o cliente JÁ PAGOU e o cadastro chegou depois ═══════════════════
      // O gancho do Stripe cobre "pagou com o cadastro pronto". Falta o contrário, que é comum:
      // o cliente paga primeiro (self-serve) e o vendedor só termina o cadastro completo horas
      // depois. Sem isto, esse cadastro rico ficaria parado na fila esperando um clique enquanto
      // o cliente já pagou — o mesmo buraco, invertido.
      // `cents: 999999` porque aqui o pagamento NÃO é uma promessa a validar: client_has_paid só
      // devolve true com SALDO real em client_credits (dinheiro que já entrou). O piso de valor
      // existe para separar recarga de plano no webhook; aqui essa pergunta já está respondida.
      // BEST-EFFORT DE VERDADE: nada disto pode atrasar ou derrubar a resposta do save — o
      // vendedor precisa ver "salvo" na hora, tenha a auto-aprovação funcionado ou não.
      if (clientEmail && ING) {
        const autoAprovar = async () => {
          try {
            const pago = await rpc("client_has_paid", { p_secret: ING, p_email: clientEmail });
            if (!pago.ok) return;                       // sem leitura = "não sei" → não age
            if ((await pago.json().catch(() => false)) !== true) return;
            await tentarAutoAprovar(env, request, { email: clientEmail, source: "draft_save", cents: 999999 });
          } catch { /* nunca toca a resposta do save */ }
        };
        if (context && typeof context.waitUntil === "function") context.waitUntil(autoAprovar());
        else await autoAprovar();
      }
      return json({ ok: true, id });
    }

    // ── LIST (seller → own · admin → all) ──────────────────────────────────────────────────────────
    if (action === "list") {
      if (await adminOk(b.token)) {
        const r = await rpc("draft_list", { p_secret: ING, p_seller_email: "" });
        return json({ ok: true, scope: "all", rows: r.ok ? await r.json() : [] });
      }
      const seller = await sellerAuthFull(env, b.seller_email || (b.seller && b.seller.email), b.seller_code);
      if (!seller) return json({ error: "unauthorized" }, 401);
      if (!seller.roster) return json({ error: "unauthorized" }, 401); // shared team code can't list another seller's drafts
      const r = await rpc("draft_list", { p_secret: ING, p_seller_email: seller.email });
      return json({ ok: true, scope: "seller", rows: r.ok ? await r.json() : [] });
    }

    // ── GET (full payload) — admin OR the owning seller ────────────────────────────────────────────
    if (action === "get") {
      const id = (b.id || "").toString();
      if (!id) return json({ error: "id required" }, 400);
      const isAdmin = await adminOk(b.token);
      const seller = isAdmin ? null : await sellerAuthFull(env, b.seller_email || (b.seller && b.seller.email), b.seller_code);
      if (!isAdmin && !seller) return json({ error: "unauthorized" }, 401);
      if (!isAdmin && !seller.roster) return json({ error: "unauthorized" }, 401); // shared team code can't read another seller's draft
      const r = await rpc("draft_get", { p_secret: ING, p_id: id, p_seller_email: isAdmin ? "" : seller.email });
      if (!r.ok) return json({ error: "not found" }, 404);
      const row = await r.json().catch(() => null);
      if (!row) return json({ error: "not found" }, 404);
      return json({ ok: true, draft: row });
    }

    // ── APPROVE (ADMIN ONLY) → provision via /api/onboard-client, then mark the draft live ──────────
    if (action === "approve") {
      const token = (b.token || "").toString();
      if (!await adminOk(token)) return json({ error: "unauthorized" }, 401);
      const id = (b.id || "").toString();
      if (!id) return json({ error: "id required" }, 400);
      const gr = await rpc("draft_get", { p_secret: ING, p_id: id, p_seller_email: "" });
      if (!gr.ok) return json({ error: "not found" }, 404);
      const row = await gr.json().catch(() => null);
      const draft = row && row.payload ? row.payload : row;
      // ═══ PORTÃO DO NÚMERO NO SERVIDOR (2026-08-25) ═══════════════════════════════════════
      // Antes o pré-check de número compartilhado era um window.confirm no NAVEGADOR e o
      // approve seguia mesmo se a checagem falhasse — exatamente o meio-provisionado que o
      // health-monitor depois acusa (e o incidente real: a linha de demo atendendo pelo spa).
      // Número compartilhado é decisão CONSCIENTE, não default: o front manda confirm:true só
      // depois do humano confirmar, e "não sei" (precheck falhou) nunca é mais permissivo que
      // "sei que tem problema".
      const modoNumero = ((draft && draft.number_mode) || "shared").toString();
      if ((modoNumero === "shared" || b.precheck === "falhou") && b.confirm !== true) {
        return json({ error: "confirm_required",
          motivo: "Este cadastro iria ao ar no número COMPARTILHADO (ou o pré-check falhou). Reenvie com confirm:true para assumir isso." }, 409);
      }
      if (!draft || !draft.business) return json({ error: "draft not found" }, 404);
      const body = mapDraftToOnboard(draft);
      if (!body.email || !body.email.includes("@")) return json({ error: "draft is missing client_email" }, 400);
      // provision through the SAME hardened engine — reuse the caller's verified admin token.
      const onboardUrl = new URL("/api/onboard-client", request.url).toString();
      const pr = await fetch(onboardUrl, {
        method: "POST", headers: { "Content-Type": "application/json", Origin: new URL(request.url).origin },
        body: JSON.stringify({ token, ...body }),
      });
      const out = await pr.json().catch(() => ({}));
      if (!pr.ok || out.error) return json({ error: out.error || `provision failed (${pr.status})`, steps: out.steps }, 503);
      // mark the draft live + persist what was born — incl. the connection_code, so the seller's
      // permanent wallet (action=wallet below) can show it forever (best-effort).
      try {
        const mk = { p_secret: ING, p_id: id, p_agent_id: (out.agent_id || "").toString(), p_number: (out.number || "").toString() };
        const mr = await rpc("draft_approve_mark", { ...mk, p_code: (out.connection_code || "").toString() });
        // legacy 4-arg RPC (seller_wallet.sql not pasted yet) — WITHOUT this retry the draft never
        // flips to 'live', stays in the approve queue, and a re-click re-provisions (buys a 2nd number).
        if (!mr.ok) await rpc("draft_approve_mark", mk);
      } catch { /* */ }
      return json({ ok: true, agent_id: out.agent_id || "", number: out.number || "", steps: out.steps, forwarding: out.forwarding, connection_code: out.connection_code, widget_snippet: widgetSnippet(body.email, body.lang) });
    }

    // ── WALLET — the seller's PERMANENT client book (Luis's rule: whoever signs the client owns
    //    them forever; assigned_seller only changes via admin). Seller → own wallet · admin → all,
    //    each row carrying its seller_email. Same auth as save/list. ─────────────────────────────────
    if (action === "wallet") {
      if (await adminOk(b.token)) {
        const r = await rpc("seller_wallet", { p_secret: ING, p_seller_email: "" });
        // ⚠️ ERA `rows: r.ok ? await r.json() : []` (auditoria 2026-08-17): a falha da RPC virava
        // LISTA VAZIA com ok:true, e a carteira do /admin dizia "nenhum cliente na carteira ainda"
        // para um dono que tem clientes pagando. Sete linhas abaixo, o caminho do VENDEDOR já
        // devolvia 500 no mesmo caso — o padrão honesto e o silencioso conviviam no mesmo arquivo,
        // separados por sete linhas. É o mesmo pecado dos três motores mortos: erro lido como zero.
        if (!r.ok) return json({ error: "wallet unavailable (paste db/seller_wallet.sql)" }, 500);
        return json({ ok: true, scope: "all", rows: await r.json().catch(() => []) });
      }
      const seller = await sellerAuthFull(env, b.seller_email || (b.seller && b.seller.email), b.seller_code);
      if (!seller) return json({ error: "unauthorized" }, 401);
      const r = await rpc("seller_wallet", { p_secret: ING, p_seller_email: seller.email });
      if (!r.ok) return json({ error: "wallet unavailable (paste db/seller_wallet.sql)" }, 500);
      let rows = await r.json().catch(() => []);
      // connection_code is a live tenant credential; the shared team code can't prove WHO is asking,
      // so mask it (the client gets the full code by birth email; roster/admin see it whole).
      if (!seller.roster && Array.isArray(rows)) {
        rows = rows.map((row) => ({ ...row, connection_code: row.connection_code ? "••••" + String(row.connection_code).slice(-4) : "" }));
      }
      return json({ ok: true, scope: "seller", rows });
    }

    // ── DELETE (soft) — admin OR the owning seller ─────────────────────────────────────────────────
    if (action === "delete") {
      const id = (b.id || "").toString();
      if (!id) return json({ error: "id required" }, 400);
      const isAdmin = await adminOk(b.token);
      const seller = isAdmin ? null : await sellerAuthFull(env, b.seller_email || (b.seller && b.seller.email), b.seller_code);
      if (!isAdmin && !seller) return json({ error: "unauthorized" }, 401);
      const r = await rpc("draft_delete", { p_secret: ING, p_id: id, p_seller_email: isAdmin ? "" : seller.email });
      if (!r.ok) return json({ error: "delete failed" }, 500);
      return json({ ok: true, deleted: await r.json().catch(() => true) });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
