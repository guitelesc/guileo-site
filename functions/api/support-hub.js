// Cloudflare Pages Function — POST /api/support-hub
// ═════════════════════════════════════════════════════════════════════════════
// O MOTOR DE SUPORTE EM 2 NÍVEIS (db/support_tiers.sql):
//
//   TIER 1 · ATENDIMENTO  → hub do VENDEDOR. Ele é a PRIMEIRA LINHA do cliente que
//     ele assinou: vê os chamados dos clientes DELE, responde, e ESCALA pro técnico
//     o que for problema de plataforma. Auth = sellerAuthFull (mesmo gate do hub).
//     A fila é escopada NO SQL pelo e-mail AUTENTICADO do vendedor (support_queue_seller
//     cruza com onboard_drafts.assigned_seller) — um vendedor nunca vê o cliente do outro.
//
//   TIER 2 · TÉCNICO → hub da EQUIPE DE DEV (backend/frontend/integrações). Fila global
//     de chamados técnicos, urgente-primeiro/mais-antigo-primeiro, com stats de SLA
//     (abertos, urgentes, envelhecendo >24h) pra atender 24h sem nada ficar parado.
//     Auth = TECH_ROSTER (JSON por pessoa) OU TECH_TEAM_CODE (env) — NUNCA um código
//     commitado. Sem env configurado, só o token de admin abre (fail-closed): o hub
//     nasce inerte e acende quando Luis define a chave.
//
// Todo acesso a dado é service_role (svcRpc) em RPCs SECURITY DEFINER que NÃO são
// concedidas ao anon. Nenhuma ação confia em e-mail vindo do body sem autenticar antes.
// ═════════════════════════════════════════════════════════════════════════════
import { json, sameOrigin, rateLimited, safeEq } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";
import { supportRepliedEmail } from "../lib/emailTemplates.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const anonRpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// ── SELLER auth (idêntico a seller-prospects/seller-leads: roster DB → roster env → código de time) ──
const BOOTSTRAP = [
  { email: "luistelesc@gmail.com", code: "GUILEO-DONO", name: "Luis Teles", ref: "luis" },
  { email: "smart@guileoai.com", code: "GUILEO-DONO", name: "Guileo", ref: "guileo" },
];
const TEAM_CODE_DEFAULT = "GUILEO-TIME-2026";
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
function roster(env) {
  try { if (env && env.SELLER_ROSTER) { const a = JSON.parse(env.SELLER_ROSTER); if (Array.isArray(a) && a.length) return a; } } catch { /* fall back */ }
  return BOOTSTRAP;
}
function sellerAuth(env, email, code) {
  const e = (email || "").toString().trim().toLowerCase();
  const c = (code || "").toString().trim();
  if (!e || !c) return null;
  const m = roster(env).find((s) => (s.email || "").trim().toLowerCase() === e && safeEq(String(s.code || ""), c));
  if (m) return { email: e, name: m.name || e.split("@")[0], ref: (m.ref || e.split("@")[0]).toString().slice(0, 40), roster: true };
  const team = (env && env.TEAM_INVITE_CODE) || TEAM_CODE_DEFAULT;
  if (safeEq(c, team)) return { email: e, name: e.split("@")[0], ref: slug(e.split("@")[0]) || "team", roster: false };
  return null;
}
async function sellerAuthDB(env, email, code) {
  const e = (email || "").toString().trim().toLowerCase();
  const c = (code || "").toString().trim();
  if (!e || !c || !env.INGEST_SECRET) return null;
  try {
    const r = await svcRpc(env, "seller_auth_check", { p_secret: env.INGEST_SECRET, p_email: e, p_code: c });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    if (!d || !d.ok) return null;
    return { email: e, name: d.name || e.split("@")[0], ref: (d.ref || e.split("@")[0]).toString().slice(0, 40), roster: true };
  } catch { return null; }
}
const sellerAuthFull = async (env, email, code) => (await sellerAuthDB(env, email, code)) || sellerAuth(env, email, code);

// ── TECH auth — equipe de dev. FAIL-CLOSED: sem env de time, só admin entra. ──────────
async function adminOk(token) {
  try { const r = await anonRpc("blitz_stats", { p_token: (token || "").toString(), p_email: "" }); return r.ok; }
  catch { return false; }
}
function techRoster(env) {
  try { if (env && env.TECH_ROSTER) { const a = JSON.parse(env.TECH_ROSTER); if (Array.isArray(a) && a.length) return a; } } catch { /* none */ }
  return [];
}
// Retorna { email, name } quando a pessoa é do time técnico; null caso contrário.
async function techAuth(env, email, code, token) {
  const e = (email || "").toString().trim().toLowerCase();
  const c = (code || "").toString().trim();
  // 1) pessoa nomeada no TECH_ROSTER (rastreável — sabemos QUEM mexeu)
  const m = techRoster(env).find((t) => (t.email || "").trim().toLowerCase() === e && safeEq(String(t.code || ""), c));
  if (m) return { email: e, name: m.name || e.split("@")[0], via: "roster" };
  // 2) código único do time (env TECH_TEAM_CODE) — nunca um literal commitado
  if (env && env.TECH_TEAM_CODE && c && safeEq(c, String(env.TECH_TEAM_CODE)) && e.includes("@")) {
    return { email: e, name: e.split("@")[0], via: "team" };
  }
  // 3) o dono, com a senha do /admin (sempre entra)
  if (token && (await adminOk(token))) return { email: "admin", name: "Admin", via: "admin" };
  return null;
}

const clean = (s, n = 4000) => (s == null ? "" : String(s).slice(0, n));
const isUuid = (s) => /^[0-9a-f-]{36}$/i.test(String(s || ""));

// ── "CHAMADO RESPONDIDO" CHEGA NO CLIENTE (2026-08-25) ────────────────────────────────────────
// O buraco: o vendedor ou o técnico respondia, a resposta entrava na thread, e o CLIENTE só
// descobriria se lembrasse de voltar no portal e abrir a aba. Na prática, resposta rápida nossa
// virava demora sentida por ele — o pior tipo de bug de suporte, porque é invisível dos dois lados.
// Best-effort e SEMPRE depois da gravação: o e-mail nunca pode fazer a resposta se perder.
// ⚠️ GÊMEO EM broto.js (ticket_reply) — o BROTO responde os mesmos chamados por outra porta.
// Mexeu aqui, mexa lá no mesmo commit.
async function avisaCliente(env, ticketId, replyText) {
  try {
    if (!env.RESEND_API_KEY || !env.SCHED_SECRET) return false;
    // Quem é o dono do chamado e qual era o assunto: a RPC de lista com p_email:'' devolve a fila
    // inteira (é a mesma que o BROTO usa) e a filtramos pelo id.
    const lr = await svcRpc(env, "support_ticket_list", { p_secret: env.SCHED_SECRET, p_email: "", p_limit: 1000 });
    if (!lr.ok) return false;
    const lista = (await lr.json().catch(() => [])) || [];
    const t = (Array.isArray(lista) ? lista : []).find((x) => String(x.id) === String(ticketId));
    const to = ((t && t.client_email) || "").toString().trim().toLowerCase();
    if (!to.includes("@")) return false;
    // Idioma do cliente — sem perfil legível cai em pt (o cockpit nasce em pt), nunca em inglês
    // silencioso para quem não fala inglês.
    let lang = "pt", name = "";
    try {
      const pr = await svcRpc(env, "get_client_profile", { p_secret: env.INGEST_SECRET || "", p_email: to });
      if (pr.ok) {
        const p = await pr.json().catch(() => null);
        if (p && typeof p === "object") {
          lang = ["pt", "es", "en", "hi"].includes(p.lang) ? p.lang : "pt";
          name = (p.owner || p.business_name || "").toString().slice(0, 80);
        }
      }
    } catch { /* defaults */ }
    const { subject, html } = supportRepliedEmail({
      name, lang, ticketSubject: (t && t.subject) || "", replyPreview: String(replyText || "").slice(0, 400),
    });
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to, subject, html }),
    });
    // Conferir o `ok`: "avisei o cliente" sem olhar a resposta da Resend é a promessa sem lastro
    // que já custou dois bugs invisíveis neste repo.
    if (!r.ok) { console.error(JSON.stringify({ aviso_chamado: ticketId, resend: r.status })); return false; }
    return true;
  } catch (e) { console.error(JSON.stringify({ aviso_chamado: ticketId, erro: String(e).slice(0, 120) })); return false; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "support-hub", 120)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const action = (b.action || "").toString();
    const ING = env.INGEST_SECRET || ""; // fail-closed: sem segredo, as RPCs recusam

    // ─────────── TIER 1 · VENDEDOR (primeira linha do cliente dele) ───────────
    if (action.startsWith("seller_")) {
      const seller = await sellerAuthFull(env, b.seller_email || (b.seller && b.seller.email), b.seller_code || b.token);
      if (!seller) return json({ error: "unauthorized" }, 401);

      // FIX #1 (revisor 2026-07-31): o código de TIME compartilhado aceita QUALQUER e-mail digitado —
      // não prova identidade. Como estes dados são PII de cliente (threads de suporte, e-mails, receita),
      // só vendedor do ROSTER (código pessoal, identidade vinculada) passa daqui. Team-code → 403 honesto.
      if (!seller.roster) {
        return json({ error: "personal_code_required", note: "Use seu código pessoal (o do time não abre dados de cliente)." }, 403);
      }

      // FIX #2: "UUID sozinho nunca autoriza nada" — antes de QUALQUER mutação num chamado, o chamado
      // precisa ser de um cliente da carteira DESTE vendedor. Sem isso, um UUID vazado deixava responder
      // ou escalar o chamado de outro vendedor.
      const ownsTicket = async (id) => {
        try {
          const r = await svcRpc(env, "support_ticket_owned_by_seller", { p_secret: ING, p_id: id, p_seller_email: seller.email });
          return r.ok && (await r.json().catch(() => false)) === true;
        } catch { return false; }
      };

      // Visão geral de MARKETING da CARTEIRA dele (mesma RPC do hub de marketing, escopada
      // pelo e-mail autenticado — o vendedor vê a performance só dos clientes que ele assinou).
      if (action === "seller_marketing") {
        try {
          const r = await svcRpc(env, "marketing_hub_stats", { p_secret: ING, p_seller_email: seller.email, p_days: Math.min(Math.max(parseInt(b.days, 10) || 30, 1), 365) });
          const d = r.ok ? await r.json().catch(() => null) : null;
          return json({ ok: true, ready: r.ok, data: d || {} });
        } catch { return json({ ok: true, ready: false, data: {} }); }
      }

      if (action === "seller_queue") {
        try {
          const r = await svcRpc(env, "support_queue_seller", { p_secret: ING, p_seller_email: seller.email, p_limit: 100 });
          const rows = r.ok ? await r.json().catch(() => []) : [];
          return json({ ok: true, ready: r.ok, tickets: Array.isArray(rows) ? rows : [] });
        } catch { return json({ ok: true, ready: false, tickets: [] }); }
      }

      // Responder o cliente — entra no thread do chamado como "humano" (o vendedor).
      if (action === "seller_reply") {
        if (!isUuid(b.id) || !clean(b.text, 2000).trim()) return json({ error: "id + text" }, 400);
        if (!(await ownsTicket(b.id))) return json({ error: "not your ticket" }, 403);
        try {
          // FIX #7: support_ticket_reply é gated por _gui_sched_ok → SCHED_SECRET. O fallback pro INGEST
          // fazia a RPC recusar em silêncio se SCHED faltasse. Sem SCHED → erro honesto, nunca falso-ok.
          if (!env.SCHED_SECRET) return json({ ok: false, note: "SCHED_SECRET ausente — resposta não enviada." });
          const r = await svcRpc(env, "support_ticket_reply", { p_secret: env.SCHED_SECRET, p_id: b.id, p_role: "human", p_text: `${seller.name}: ${clean(b.text, 2000)}` });
          // 🚨 REVISOR 2026-08-25: support_ticket_reply é BOOLEANA (returns found). `r.ok` é o
          // status HTTP — 200 com `false` quando o UPDATE não achou o ticket. Ler o HTTP aqui
          // mostrava "✓ enviado" (e mandava o e-mail "te respondemos"!) sobre resposta que não
          // entrou na thread. O gêmeo do broto.js sempre parseou o booleano; agora este também.
          const okv = r.ok ? (await r.json().catch(() => false)) === true : false;
          const avisado = okv ? await avisaCliente(env, b.id, clean(b.text, 2000)) : false;
          return json({ ok: okv, avisado });
        } catch { return json({ ok: false }); }
      }

      // Escalar pro técnico — o vendedor decide o que é problema de plataforma.
      if (action === "seller_escalate") {
        if (!isUuid(b.id)) return json({ error: "id" }, 400);
        if (!(await ownsTicket(b.id))) return json({ error: "not your ticket" }, 403);
        try {
          const r = await svcRpc(env, "support_escalate", { p_secret: ING, p_id: b.id, p_tier: "tecnico", p_by: seller.name || seller.email, p_note: clean(b.note, 300) });
          return json({ ok: r.ok && !!(await r.json().catch(() => false)) });
        } catch { return json({ ok: false }); }
      }
      return json({ error: "unknown action" }, 400);
    }

    // ─────────── TIER 2 · TÉCNICO (equipe de dev, fila global) ───────────
    if (action.startsWith("tech_")) {
      const tech = await techAuth(env, b.tech_email || b.email, b.tech_code || b.code, b.token);
      if (!tech) {
        // Honesto: diz se o hub ainda não foi configurado (nenhuma chave de time definida).
        const configured = !!(env.TECH_ROSTER || env.TECH_TEAM_CODE);
        return json({ error: "unauthorized", configured }, 401);
      }

      if (action === "tech_queue") {
        try {
          const [q, s] = await Promise.all([
            svcRpc(env, "support_queue_tech", { p_secret: ING, p_limit: 200 }),
            svcRpc(env, "support_tech_stats", { p_secret: ING }),
          ]);
          const tickets = q.ok ? await q.json().catch(() => []) : [];
          const stats = s.ok ? await s.json().catch(() => ({})) : {};
          return json({ ok: true, ready: q.ok, who: tech.name, tickets: Array.isArray(tickets) ? tickets : [], stats: stats || {} });
        } catch { return json({ ok: true, ready: false, tickets: [], stats: {} }); }
      }

      if (action === "tech_reply") {
        if (!isUuid(b.id) || !clean(b.text, 4000).trim()) return json({ error: "id + text" }, 400);
        try {
          if (!env.SCHED_SECRET) return json({ ok: false, note: "SCHED_SECRET ausente — resposta não enviada." });
          const r = await svcRpc(env, "support_ticket_reply", { p_secret: env.SCHED_SECRET, p_id: b.id, p_role: "human", p_text: `[téc] ${tech.name}: ${clean(b.text, 4000)}` });
          // mesmo conserto do seller_reply (revisor 2026-08-25): a RPC é booleana; e o tier
          // técnico nem passa por ownsTicket, então uuid de ticket apagado dava "✓" falso.
          const okv = r.ok ? (await r.json().catch(() => false)) === true : false;
          const avisado = okv ? await avisaCliente(env, b.id, clean(b.text, 4000)) : false;
          return json({ ok: okv, avisado });
        } catch { return json({ ok: false }); }
      }

      // Mudar status / atribuir / registrar a resolução.
      if (action === "tech_set") {
        if (!isUuid(b.id)) return json({ error: "id" }, 400);
        const status = clean(b.status, 24).toLowerCase();
        const ok = ["", "open", "aberto", "in_progress", "andamento", "waiting", "aguardando", "closed", "fechado", "resolved", "resolvido"].includes(status);
        if (!ok) return json({ error: "invalid status" }, 400);
        try {
          if (!env.SCHED_SECRET) return json({ ok: false, note: "SCHED_SECRET ausente — mudança não salva." });
          const r = await svcRpc(env, "support_ticket_set", {
            p_secret: env.SCHED_SECRET, p_id: b.id,
            p_status: status || null, p_resolution: clean(b.resolution, 2000) || null,
            // FIX #7b: só reatribui quando quem clicou MANDOU um responsável. Antes, "✓ Resolvido"
            // roubava silenciosamente a titularidade do chamado pra quem clicou.
            p_assigned: clean(b.assigned, 120) || null,
          });
          return json({ ok: r.ok });
        } catch { return json({ ok: false }); }
      }

      // Devolver pra primeira linha (não era técnico).
      if (action === "tech_return") {
        if (!isUuid(b.id)) return json({ error: "id" }, 400);
        try {
          const r = await svcRpc(env, "support_escalate", { p_secret: ING, p_id: b.id, p_tier: "atendimento", p_by: tech.name, p_note: clean(b.note, 300) });
          return json({ ok: r.ok && !!(await r.json().catch(() => false)) });
        } catch { return json({ ok: false }); }
      }
      return json({ error: "unknown action" }, 400);
    }

    // ─────────── HUB DE MARKETING / ADS / PERFORMANCE (visão da EMPRESA) ───────────
    // Auth: MARKETING_TEAM_CODE (env) OU o time técnico OU o dono (admin). Fail-closed igual:
    // sem env de time configurado, só o admin abre.
    if (action.startsWith("mkt_")) {
      const e = (b.email || "").toString().trim().toLowerCase();
      const c = (b.code || "").toString().trim();
      let who = null;
      if (env && env.MARKETING_TEAM_CODE && c && safeEq(c, String(env.MARKETING_TEAM_CODE)) && e.includes("@")) {
        who = { email: e, name: e.split("@")[0], via: "marketing" };
      }
      if (!who) who = await techAuth(env, e, c, b.token); // time técnico ou admin também entram
      if (!who) {
        const configured = !!(env.MARKETING_TEAM_CODE || env.TECH_ROSTER || env.TECH_TEAM_CODE);
        return json({ error: "unauthorized", configured }, 401);
      }

      if (action === "mkt_stats") {
        try {
          const days = Math.min(Math.max(parseInt(b.days, 10) || 30, 1), 365);
          const r = await svcRpc(env, "marketing_hub_stats", { p_secret: ING, p_seller_email: "", p_days: days });
          const d = r.ok ? await r.json().catch(() => null) : null;
          return json({ ok: true, ready: r.ok, who: who.name, data: d || {} });
        } catch { return json({ ok: true, ready: false, data: {} }); }
      }
      return json({ error: "unknown action" }, 400);
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 140) }, 500);
  }
}
