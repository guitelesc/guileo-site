// Cloudflare Pages Function — GET/POST /api/consulta-retorno · ACOMPANHAMENTO DE CONSULTA (2026-10-13)
// "Lilian follows up Med Spa consultations that did not book" — contrato do Natura, Anexo A, Parte 4 (planejado).
//
// DUAS PORTAS NA MESMA ROTA
//   1. CRON (cron-tick.js, bloco da hora): ?token=DIGEST_TOKEN (safeEq). Roda para todos os negócios.
//   2. PROVA ESCOPADA: ?so=<negócio> + cabeçalho x-guileo-secret = INGEST_SECRET → só aquele negócio (o de teste).
//
// COMO FUNCIONA
//   A fila é UMA consulta (consulta_followup_due_all, db/consulta_retorno.sql): quem fez um serviço com
//   `config.followup_days` (a consulta grátis do Med Spa) e não marcou nada depois dele. Por pessoa:
//   e-mail na marca do negócio (consultFollowupEmail) → carimbo biz_marketing_sent (kind consult_followup,
//   ref = id da consulta) SÓ depois de o Resend devolver um id → linha no feed do negócio.
//   · Sem e-mail no cadastro → `semEmail` (SMS entra quando o A2P sair). Nada é inventado.
//   · Lista de supressão não lida → NÃO manda (fail-closed, como todo marketing da casa).
//   · Só entre 9h e 20h no fuso da unidade: fora disso fica na fila (não é carimbado) e sai no próximo tique.
//   · Falha do banco NUNCA vira "ninguém para acompanhar": é erro com nome e ok:false (o cron-tick avisa).
import { json, safeEq } from "../lib/guard.js";
import { sbKey, svcJson } from "../lib/sb.js";
import { consultFollowupEmail } from "../lib/emailTemplates.js";
import { brandFor } from "../lib/clientBrand.js";
import { unsubUrl } from "../lib/unsub.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ""));
const langNorm = (v) => { const l = String(v || "").toLowerCase().slice(0, 2); return l === "pt" ? "pt" : l === "es" ? "es" : "en"; };
const TETO = 40;   // subrequests por rodada (o Worker corta em 50): o que não couber sai no próximo tique

const ingRpc = (env, fn, body) => fetch(`${SB}/rest/v1/rpc/${fn}`, {
  method: "POST", headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
  body: JSON.stringify({ ...body, p_secret: env.INGEST_SECRET || "" }),
}).then((r) => r.json()).catch(() => ({}));

// hora local da unidade (0–23); sem fuso legível, assume Nova York
function horaLocal(tz) {
  try { return Number(new Intl.DateTimeFormat("en-US", { timeZone: tz || "America/New_York", hour: "numeric", hour12: false }).format(new Date())) % 24; }
  catch { return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date())) % 24; }
}

// Envio pela Resend: `ok` SÓ com o id devolvido (lei "sucesso precisa de comprovante").
async function enviar(env, to, subject, html, marca) {
  if (!env.RESEND_API_KEY || !isEmail(to)) return { ok: false, id: null, motivo: "sem RESEND_API_KEY ou destinatário inválido" };
  try {
    const base = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
    const nome = marca && marca.nome ? String(marca.nome).replace(/["<>\r\n]/g, "").trim().slice(0, 60) : "";
    const from = nome && nome !== "Guileo" ? `${nome} <${(base.match(/<([^>]+)>/) || [])[1] || base}>` : base;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, ...(marca && isEmail(marca.responder) ? { reply_to: marca.responder } : {}) }),
    });
    const d = await r.json().catch(() => null);
    const id = d && d.id ? String(d.id) : null;
    return r.ok && id ? { ok: true, id } : { ok: false, id: null, motivo: `Resend HTTP ${r.status}${d && d.message ? ` · ${String(d.message).slice(0, 120)}` : ""}` };
  } catch (e) { return { ok: false, id: null, motivo: String(e).slice(0, 120) }; }
}

async function passada(env, { soTenant = "" } = {}) {
  const out = { ok: true, naFila: 0, enviados: 0, semEmail: 0, suprimidos: 0, foraDeHora: 0, envioFalhou: 0, carimboFalhou: 0, adiados: 0, gasto: 0, erros: [], detalhe: [] };
  const cabe = (n) => out.gasto + n <= TETO;
  const gasta = (n = 1) => { out.gasto += n; };
  const fila = await svcJson(env, "consulta_followup_due_all", { p_secret: env.SCHED_SECRET || "", p_limit: 40, p_so_tenant: soTenant || null }); gasta();
  if (!fila || !Array.isArray(fila.due)) {
    out.ok = false; out.erros.push(`fila:${(fila && (fila.erro_http || fila.error || fila.detalhe)) || JSON.stringify(fila || null).slice(0, 80)}`); return out;
  }
  out.naFila = fila.due.length;
  if (!fila.due.length) return out;

  const ctx = new Map();
  const doNegocio = async (tenant) => {
    let c = ctx.get(tenant); if (c) return c;
    if (!cabe(5)) return null;
    const profile = (await ingRpc(env, "get_client_profile", { p_email: tenant })) || {}; gasta();
    const brand = await brandFor(env, tenant).catch(() => null); gasta(2);
    c = { profile, brand, L: langNorm(profile.lang), address: "", supressos: null, fone: "" };
    try { const a = await svcJson(env, "client_postal_address", { p_secret: env.INGEST_SECRET || "", p_client_email: tenant }); if (typeof a === "string") c.address = a.trim().slice(0, 200); } catch { /* sem endereço postal */ } gasta();
    try { const sup = await svcJson(env, "email_suppressed_list", { p_secret: env.INGEST_SECRET || "", p_client_email: tenant }); if (Array.isArray(sup)) c.supressos = new Set(sup.map((x) => String(x).toLowerCase())); } catch { /* lista não lida → fail-closed abaixo */ } gasta();
    // A linha que atende (a assistente): o botão do e-mail liga para ela.
    try { const ag = await svcJson(env, "client_agent_resolve", { p_secret: env.INGEST_SECRET || "", p_email: tenant }); if (ag && ag.number) c.fone = String(ag.number); } catch { /* sem linha: o CTA vira "responder" */ } gasta();
    ctx.set(tenant, c); return c;
  };

  for (const a of fila.due) {
    const tenant = String(a.tenant || "").toLowerCase();
    if (!tenant.includes("@")) continue;
    if (!a.tem_email || !isEmail(a.email)) { out.semEmail++; continue; }
    const h = horaLocal(a.tz);
    if (h < 9 || h >= 20) { out.foraDeHora++; continue; }
    const c = await doNegocio(tenant);
    if (!c || !cabe(3)) { out.adiados++; continue; }
    const para = String(a.email).toLowerCase();
    if (!(c.supressos instanceof Set) || c.supressos.has(para)) { out.suprimidos++; continue; }
    const unsub = await unsubUrl(env, "https://guileoai.com", tenant, para).catch(() => "");
    const negocio = (c.brand && c.brand.business) || "";
    const primeiro = String(a.name || "").trim().split(/\s+/)[0] || "there";
    const { subject, html } = consultFollowupEmail({ name: primeiro, business: negocio, service: a.service || "", lang: c.L, bizEmail: tenant, brand: c.brand, unsub, address: c.address, phone: c.fone });
    const envio = await enviar(env, para, subject, html, { nome: negocio, responder: tenant }); gasta();
    if (!envio.ok) { out.envioFalhou++; out.detalhe.push({ ref: a.ref, motivo: envio.motivo }); continue; }
    out.enviados++;
    // O e-mail JÁ saiu. Carimbo que falha = a pessoa receberia de novo: vira número visível.
    const carimbo = await ingRpc(env, "marketing_date_claim", { p_client_email: tenant, p_kind: "consult_followup", p_ref: String(a.ref || ""), p_period: "-" }); gasta();
    if (carimbo !== true) out.carimboFalhou++;
    await ingRpc(env, "ingest_client_event", { p_email: tenant, p_type: "followup", p_channel: "email",
      p_summary: `💬 Acompanhamento da consulta → ${primeiro}${a.service ? ` (${a.service})` : ""}`.slice(0, 300), p_amount: 0,
      p_payload: { kind: "consult_followup", ref: a.ref, contact: para, envio_id: envio.id } }); gasta();
    out.detalhe.push({ ref: a.ref, para: `${para.slice(0, 3)}…`, envio_id: envio.id, carimbo: carimbo === true });
  }
  return out;
}

async function handle({ request, env }) {
  const url = new URL(request.url);
  const so = (url.searchParams.get("so") || "").trim().toLowerCase();
  const prova = so.includes("@") && !!env.INGEST_SECRET && safeEq(request.headers.get("x-guileo-secret") || "", env.INGEST_SECRET);
  const cron = !!env.DIGEST_TOKEN && safeEq(url.searchParams.get("token") || "", env.DIGEST_TOKEN);
  if (!prova && !cron) return json({ error: "unauthorized" }, 401);
  if (!env.SCHED_SECRET) return json({ ok: false, ready: false, error: "scheduling not configured" });
  const r = await passada(env, { soTenant: prova ? so : "" }).catch((e) => ({ ok: false, erros: [`passada:${String(e).slice(0, 100)}`] }));
  return json(prova ? { ...r, so } : r);
}
export const onRequestGet = handle;
export const onRequestPost = handle;
