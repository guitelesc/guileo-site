// Cloudflare Pages Function — POST /api/seller-leads
// Server side of the LEAD BOSS mini-CRM (src/data/leadBoss.js + SellerProspect.jsx). Persists each
// seller's status/notes/activity-log for the seeded prospect bench so it survives across devices
// (localStorage stays as an offline cache/fallback client-side).
//
// AÇÕES:
//   • list/save   → o quadro do Lead Boss (bench semeado) do vendedor
//   • inbound     → 📥 A CAIXA DE ENTRADA: os leads que CHEGARAM pra ele (gui_actions, atribuídos
//                   pelo `👤ref:` por EXTRAÇÃO EXATA — db/seller_inbound_leads.sql). Era o buraco
//                   nº 1 da plataforma: nenhuma tela mostrava ao vendedor o lead que entrou.
//   • all/motors  → agregados de admin (token)
//
// AUTH:
//   • seller actions (list/save/inbound) → sellerAuthFull (SAME roster + team-code gate as onboard-draft /
//     seller-prospects). The AUTHENTICATED seller.email is the ONLY scope passed to the RPC — a
//     seller can only ever read/write their OWN board.
//   • admin action (all) → blitz_stats(token) admin gate (same as seller-admin) → aggregate view.
// All DB access is via service_role (svcRpc) against SECURITY DEFINER RPCs that are NOT granted to
// anon (db/seller_lead_crm.sql), gated server-side by INGEST_SECRET. Nothing tenant-crossing.
import { json, sameOrigin, rateLimited, safeEq } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const anonRpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// ── SELLER auth (mirrors seller-prospects.js: DB roster → env roster / shared team code) ──────────
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
  if (safeEq(c, teamCode)) return { email: e, name: e.split("@")[0], ref: slug(e.split("@")[0]) || "team", roster: false };
  return null;
}
async function sellerAuthDB(env, email, code) {
  const e = (email || "").toString().trim().toLowerCase();
  const c = (code || "").toString().trim();
  const ING = env && env.INGEST_SECRET;
  if (!e || !c || !ING) return null;
  try {
    const r = await svcRpc(env, "seller_auth_check", { p_secret: ING, p_email: e, p_code: c });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    if (!d || !d.ok) return null;
    return { email: e, name: d.name || e.split("@")[0], ref: (d.ref || e.split("@")[0]).toString().slice(0, 40), roster: true };
  } catch { return null; }
}
async function sellerAuthFull(env, email, code) {
  return (await sellerAuthDB(env, email, code)) || sellerAuth(env, email, code);
}

// Admin gate — same RPC as seller-admin / onboard-client. Wrong token raises → non-200.
async function adminOk(token) {
  try { const r = await anonRpc("blitz_stats", { p_token: (token || "").toString(), p_email: "" }); return r.ok; }
  catch { return false; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "seller-leads", 120)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const action = (b.action || "list").toString();
    const ING = env.INGEST_SECRET || ""; // fail-closed: no secret literal fallback shipped

    /* ── MANDAR O WEBSITE UPGRADE DESTE LEAD ───────────────────────────────────────────────────
       Luis (24/08): «o botão do e-mail já com o manual do business, dali mesmo, um clique faz
       tudo do lead». O e-mail completo já existia em /api/enviar-upgrade, mas aquele endpoint é
       gated pelo INGEST — segredo de servidor, que NUNCA pode ir para o navegador do vendedor.
       Então a ponte é aqui: o vendedor está autenticado pela sessão dele, e é o SERVIDOR que
       acrescenta o segredo e chama o motor. Um clique na ficha, zero segredo no cliente.
       ⚠️ Manda para uma PESSOA REAL: exige e-mail válido e devolve o id do Resend. "ok" sem id
       seria promessa sem lastro — e um e-mail dado como enviado sem ter saído é a forma mais
       silenciosa de perder um lead. */
    if (action === "upgrade") {
      const para = (b.para || "").toString().trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(para)) return json({ ok: false, error: "email invalido" }, 400);
      const orig = new URL(request.url).origin;
      const corpo = { ...(b.dados && typeof b.dados === "object" ? b.dados : {}), to: para };
      const r = await fetch(`${orig}/api/enviar-upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guileo-secret": ING },
        body: JSON.stringify(corpo),
      });
      const txt = await r.text().catch(() => "");
      if (!r.ok) return json({ ok: false, motivo: `envio respondeu ${r.status}: ${txt.slice(0, 140)}` }, 502);
      let d = {}; try { d = JSON.parse(txt) || {}; } catch { /* */ }
      if (!d.id) return json({ ok: false, motivo: "aceito sem id — nao considero enviado" }, 502);
      return json({ ok: true, enviado: true, id: d.id, para, assunto: d.assunto || "" });
    }

    // ADMIN aggregate — never touches per-seller identity.
    if (action === "all") {
      if (!await adminOk(b.token)) return json({ error: "unauthorized" }, 401);
      // ERRO NUNCA VIRA VAZIO: "ok:true, rows:[]" depois de uma falha de leitura lê como "não há
      // nada", e quem olha a tela para de olhar. Falhou → diz que falhou, com o motivo.
      try {
        const r = await svcRpc(env, "seller_lead_crm_all", { p_secret: ING });
        if (!r.ok) return json({ ok: false, motivo: `banco respondeu ${r.status}` }, 502);
        const rows = await r.json().catch(() => null);
        if (!Array.isArray(rows)) return json({ ok: false, motivo: "resposta do banco nao e lista" }, 502);
        return json({ ok: true, rows });
      } catch (e) { return json({ ok: false, motivo: String(e).slice(0, 140) }, 502); }
    }

    // ADMIN — platform-wide stats for the motors built this session (email suppression/campaigns +
    // client & seller lead activity). Read-only aggregate, no per-tenant identity.
    if (action === "motors") {
      if (!await adminOk(b.token)) return json({ error: "unauthorized" }, 401);
      try {
        const r = await svcRpc(env, "platform_motor_stats", { p_secret: ING });
        if (!r.ok) return json({ ok: false, motivo: `banco respondeu ${r.status}` }, 502);
        const stats = await r.json().catch(() => null);
        if (!stats || typeof stats !== "object") return json({ ok: false, motivo: "resposta do banco vazia/nao-JSON" }, 502);
        return json({ ok: true, stats });
      } catch (e) { return json({ ok: false, motivo: String(e).slice(0, 140) }, 502); }
    }

    // SELLER actions — the authenticated email is the ONLY scope.
    const seller = await sellerAuthFull(env, b.seller_email || (b.seller && b.seller.email), b.seller_code || b.token);
    if (!seller) return json({ error: "unauthorized" }, 401);

    // SECURITY (adversarial review 2026-07-30): the shared TEAM code (roster:false) accepts ANY typed
    // email with no identity binding — so a team member could pass another seller's email and read/poison
    // their DB board. Only ROSTER sellers (personal code, identity-bound) get the server-side sync; team-
    // code sellers keep their localStorage board only (the component already falls back to it). No cross-
    // seller DB access via the shared code.
    if ((action === "list" || action === "save") && !seller.roster) {
      return json(action === "list" ? { ok: true, crm: {}, local: true } : { ok: true, local: true });
    }
    // A caixa de entrada é DADO DE OUTRO VENDEDOR se o ref não for identidade provada: o código de
    // TIME aceita qualquer e-mail digitado, então o `ref` derivado dele não prova nada. Recusa —
    // com o motivo EXATO (`team_code`, igual seller-prospects.js), pra tela dizer "peça seu código
    // pessoal" em vez de um "não autorizado" genérico que faz o vendedor achar que perdeu o login.
    if (action === "inbound" && !seller.roster) return json({ error: "team_code" }, 401);

    if (action === "list") {
      try {
        const r = await svcRpc(env, "seller_lead_crm_list", { p_secret: ING, p_seller_email: seller.email });
        if (!r.ok) return json({ ok: false, motivo: `banco respondeu ${r.status}` }, 502);
        const crm = await r.json().catch(() => null);
        if (!crm || typeof crm !== "object") return json({ ok: false, motivo: "resposta do banco vazia/nao-JSON" }, 502);
        return json({ ok: true, crm });
      } catch (e) { return json({ ok: false, motivo: String(e).slice(0, 140) }, 502); }
    }

    // ── 📥 CAIXA DE ENTRADA DO VENDEDOR — os leads que CHEGARAM pra ele ────────────────────────
    // Lead entra por 3 portas (/raio-x público, formulários do site, speed-to-lead) e todas param
    // em gui_actions. Até hoje só o /admin enxergava: o vendedor trabalhava às cegas, e lead pago
    // em anúncio que ninguém trabalha é receita descartada. Aqui ele finalmente vê o que é dele.
    //
    // ESCOPO: o ref vem da SESSÃO autenticada (seller.ref), NUNCA do corpo — senão qualquer
    // vendedor leria a caixa do vizinho só trocando uma string. A RPC casa o ref por extração
    // EXATA (db/seller_inbound_leads.sql), nunca por prefixo.
    if (action === "inbound") {
      if (!ING) return json({ ok: false, motivo: "INGEST_SECRET ausente no ambiente" }, 500);
      const dias = Math.max(1, Math.min(parseInt(b.dias, 10) || 30, 365));
      const limite = Math.max(1, Math.min(parseInt(b.limit, 10) || 200, 500));
      const ref = (seller.ref || "").toString().trim();
      if (!ref) return json({ ok: false, motivo: "vendedor sem ref cadastrado" }, 400);
      try {
        const r = await svcRpc(env, "seller_inbound_leads", { p_secret: ING, p_ref: ref, p_dias: dias, p_limit: limite });
        if (!r.ok) return json({ ok: false, motivo: `banco respondeu ${r.status}` }, 502);
        const d = await r.json().catch(() => null);
        // A RPC devolve {ok:false, motivo} quando ela mesma falha — repassar é o contrato honesto.
        if (!d || typeof d !== "object") return json({ ok: false, motivo: "resposta do banco vazia/nao-JSON" }, 502);
        if (d.ok !== true) return json({ ok: false, motivo: (d.motivo || "leitura nao confirmada").toString().slice(0, 200) }, 502);
        return json({
          ok: true, ref: d.ref || ref, dias,
          rows: Array.isArray(d.rows) ? d.rows : [],
          contagens: d.contagens && typeof d.contagens === "object" ? d.contagens : null,
        });
      } catch (e) { return json({ ok: false, motivo: String(e).slice(0, 140) }, 502); }
    }

    if (action === "save") {
      const leadId = (b.lead_id || "").toString().slice(0, 80);
      if (!leadId) return json({ error: "lead_id required" }, 400);
      const status = (b.status || "novo").toString();
      const notes = (b.notes || "").toString().slice(0, 2000);
      const log = Array.isArray(b.log) ? b.log.slice(0, 40) : [];
      try {
        const r = await svcRpc(env, "seller_lead_crm_upsert", {
          p_secret: ING, p_seller_email: seller.email, p_lead_id: leadId, p_status: status, p_notes: notes, p_log: log,
        });
        if (!r.ok) return json({ ok: false, motivo: `banco respondeu ${r.status}` }, 502);
        const gravou = !!(await r.json().catch(() => null));
        return json(gravou ? { ok: true } : { ok: false, motivo: "o banco nao confirmou a gravacao" }, gravou ? 200 : 502);
      } catch (e) { return json({ ok: false, motivo: String(e).slice(0, 140) }, 502); }
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 140) }, 500);
  }
}
