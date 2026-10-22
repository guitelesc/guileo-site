// POST /api/minha-conta — a ÁREA DA CLIENTE do negócio (Guileo Desk, 2026-10-05), como o app de cliente
// do MindBody/Booksy: próximos horários (com o link de remarcar/cancelar), visitas, pacotes e vales.
// SEM SENHA: link mágico por e-mail.
//   { action:"pedir", t, email, lang? } → t = slug da página pública (/agendar/<slug>) ou e-mail do negócio.
//        Manda o link assinado (lib/visita.js contaUrl, propósito "conta", 7 dias) SÓ se o e-mail já é
//        cliente DESTE negócio (desk_conta_existe_svc). A resposta é SEMPRE a mesma — não revela quem é
//        cliente — e o envio corre em waitUntil, então nem o tempo de resposta denuncia.
//   { action:"ver", k }                 → o que a cliente vê (desk_conta_ver_svc). k = o token do link.
// PORTA: o tenant e o e-mail saem do TOKEN assinado, nunca do corpo. As funções do banco são só
// service_role (db/desk_v5_minha_conta.sql). Link vencido com assinatura boa → "expired" + o negócio,
// para a página oferecer outro link na hora.
// COMPROVANTE: "enviado" só com o id da Resend; sem id, o dono vê no feed que o link NÃO chegou.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { contaUrl, contaConfere, reservaUrl } from "../lib/visita.js";
import { minhaContaLinkEmail } from "../lib/emailTemplates.js";
import { brandFor } from "../lib/clientBrand.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG = /^[a-z0-9-]{2,60}$/;
const langOf = (v) => { const l = String(v || "").toLowerCase().slice(0, 2); return l === "pt" ? "pt" : l === "es" ? "es" : "en"; };
// A MESMA resposta para cliente, não-cliente e negócio desconhecido.
const NEUTRO = { ok: true, status: "if_client_sent" };

// Base do link: o domínio de onde a cliente pediu, quando é nosso (produção ou prévia do Pages).
function baseDe(request) {
  try {
    const o = new URL(request.url).origin;
    if (o === "https://guileoai.com" || o === "https://www.guileoai.com" || /^https:\/\/[a-z0-9-]+\.guileoai\.pages\.dev$/.test(o)) return o;
  } catch { /* cai no padrão */ }
  return "https://guileoai.com";
}

// t → e-mail do negócio. "" = não sei / não existe (a resposta continua neutra).
async function negocioDe(env, t) {
  const v = String(t || "").trim().toLowerCase().slice(0, 200);
  if (EMAIL.test(v)) return v;
  if (!SLUG.test(v)) return "";
  const r = await svcJson(env, "client_site_owner", { p_secret: env.INGEST_SECRET || "", p_slug: v });
  return typeof r === "string" && EMAIL.test(r.trim()) ? r.trim().toLowerCase() : "";
}

// Freio por DESTINATÁRIO (além do freio por IP): quem troca de IP não consegue encher a caixa de
// alguém de links. Até 3 por hora por negócio+e-mail. Fail-open como o rateLimited (sem KV, segue).
async function freioDoEmail(env, tenant, email) {
  try {
    const kv = env && env.RATE_LIMIT;
    if (!kv) return false;
    const dig = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${tenant}|${email}`));
    const h = [...new Uint8Array(dig)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
    const key = `rl:conta-email:${h}:${Math.floor(Date.now() / 3600000)}`;
    const n = parseInt((await kv.get(key)) || "0", 10) + 1;
    if (n > 3) return true;
    await kv.put(key, String(n), { expirationTtl: 7200 });
    return false;
  } catch { return false; }
}

function remetente(env, business) {
  const base = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
  const nome = String(business || "").replace(/["<>\r\n]/g, "").trim().slice(0, 60);
  if (!nome || nome === "Guileo") return base;
  const end = (base.match(/<([^>]+)>/) || [])[1] || base;
  return `${nome} <${end}>`;
}

// O envio de verdade. Devolve o comprovante (para o teste e para o feed) — nunca vai para a página.
export async function enviarLinkDaConta(env, { tenant, email, lang, base }) {
  const ex = await svcJson(env, "desk_conta_existe_svc", { p_tenant: tenant, p_email: email });
  if (!ex || ex.ok !== true) return { enviado: false, motivo: "consulta_falhou" };
  if (ex.existe !== true) return { enviado: false, motivo: "nao_cliente" };
  const avisarDono = (motivo) => svcJson(env, "ingest_client_event", { p_secret: env.INGEST_SECRET || "", p_email: tenant, p_type: "message", p_channel: "Email",
    p_summary: `⚠️ ${ex.name || "Uma cliente"} pediu o link da "Minha conta" e o e-mail NÃO saiu (${motivo}) — ${email}`.slice(0, 300),
    p_amount: 0, p_payload: { kind: "minha_conta_link_falhou", to: email, motivo } }).catch(() => null);
  if (!env.RESEND_API_KEY) { await avisarDono("e-mail desligado"); return { enviado: false, motivo: "email_off" }; }
  const link = await contaUrl(env, tenant, email, base, lang);
  if (!link) { await avisarDono("sem chave para assinar"); return { enviado: false, motivo: "sem_assinatura" }; }
  const brand = await brandFor(env, tenant).catch(() => null);
  const business = ex.business || (brand && brand.business !== "Guileo" ? brand.business : "") || "";
  const { subject, html } = minhaContaLinkEmail({ name: ex.name || "", business, link, dias: 7, lang, brand, address: (brand && brand.address) || "" });
  try {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: remetente(env, business), to: email, reply_to: tenant, subject, html }) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.id) { await avisarDono(`Resend ${r.status}`); return { enviado: false, motivo: "envio_recusado", http: r.status }; }
    return { enviado: true, id: j.id };
  } catch { await avisarDono("falha de rede"); return { enviado: false, motivo: "rede" }; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return json({ ok: false, error: "forbidden" }, 403);
  if (await rateLimited(request, env, "minha-conta", 30)) return json({ ok: false, error: "too many requests" }, 429);
  let b; try { b = (await request.json()) || {}; } catch { return json({ ok: false, error: "bad body" }, 400); }
  if (typeof b !== "object") return json({ ok: false, error: "bad body" }, 400);
  const action = String(b.action || "");

  if (action === "pedir") {
    // freio mais apertado por IP para o envio: 5 pedidos a cada 10 minutos
    if (await rateLimited(request, env, "minha-conta-pedir", 5, 600)) return json({ ok: false, error: "too many requests" }, 429);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 200);
    if (!EMAIL.test(email)) return json({ ok: false, error: "bad_email" }, 400);
    if (!String(b.t || "").trim()) return json({ ok: false, error: "missing_business" }, 400);
    const tenant = await negocioDe(env, b.t);
    if (!tenant || (await freioDoEmail(env, tenant, email))) return json(NEUTRO);
    const job = enviarLinkDaConta(env, { tenant, email, lang: langOf(b.lang), base: baseDe(request) }).catch(() => ({ enviado: false, motivo: "erro" }));
    if (typeof context.waitUntil === "function") context.waitUntil(job); else await job;
    return json(NEUTRO);
  }

  if (action === "ver") {
    const c = await contaConfere(env, b.k);
    if (!c.ok) return json(c.motivo === "expired" ? { ok: false, error: "expired", t: c.tenant } : { ok: false, error: "invalid_link" }, 401);
    const r = await svcJson(env, "desk_conta_ver_svc", { p_tenant: c.tenant, p_email: c.email });
    if (!r || typeof r !== "object") return json({ ok: false, error: "unavailable" }, 503);
    if (r.ok !== true) return r.reason === "not_found" ? json({ ok: false, error: "not_found", t: c.tenant }, 404) : json({ ok: false, error: "unavailable" }, 503);
    const base = baseDe(request);
    const slug = r.business && SLUG.test(String(r.business.slug || "")) ? r.business.slug : "";
    const deNovo = (servico, ativo) => (slug && servico && ativo !== false ? `/agendar/${slug}?servico=${encodeURIComponent(servico)}` : "");
    const upcoming = await Promise.all((Array.isArray(r.upcoming) ? r.upcoming : []).map(async (a) => ({
      ...a, manage_url: (await reservaUrl(env, c.tenant, a.id, base).catch(() => "")) || "", rebook_url: deNovo(a.service, true) })));
    const past = (Array.isArray(r.past) ? r.past : []).map((a) => ({ ...a, rebook_url: deNovo(a.service, a.service_active) }));
    return json({ ok: true, name: r.name || "", email: c.email, expires_at: new Date(c.exp * 1000).toISOString(),
      business: { name: (r.business && r.business.name) || "", slug, book_url: slug ? `/agendar/${slug}` : "", locations: (r.business && r.business.locations) || [] },
      upcoming, past, packages: Array.isArray(r.packages) ? r.packages : [], gift_cards: Array.isArray(r.gift_cards) ? r.gift_cards : [] });
  }
  return json({ ok: false, error: "unknown action" }, 400);
}
