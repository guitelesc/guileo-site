// POST /api/evento — A MEDIDA DA LANDING (2026-09-10). Primeira mão, sem pixel, sem PII.
// GET  /api/evento?secret=…&dias=7 — o resumo (funil: pageview → gui_aberta → chamada/mensagem → lead).
// Por que existe: até hoje ninguém sabia quantos abrem a Gui, quantos ligam, quantos pedem o Raio-X.
// Sem número, toda mudança na página é achismo. Mesma porta de sempre: same-origin + freio por IP
// na escrita; INGEST_SECRET na leitura. O IP vira um hash curto (dedupe grosso), nunca é guardado.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js"; // svcRpc devolve a Response HTTP, não o JSON — a armadilha documentada no sb.js

const NOMES = new Set(["pageview", "gui_aberta", "gui_chamada", "gui_mensagem", "xray_enviado", "lead_enviado", "cta_hero", "cta_menu"]);

function safeEq(a, b) { const x = String(a || ""), y = String(b || ""); if (!x || !y || x.length !== y.length) return false; let d = 0; for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i); return d === 0; }
async function hashCurto(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s + "|guileo-evt")); return [...new Uint8Array(b)].slice(0, 8).map((x) => x.toString(16).padStart(2, "0")).join(""); }

export async function onRequestPost(context) {
  try { return await post(context); } catch (e) { return json({ ok: false, erro: "exceção na rota", detalhe: String(e && e.stack || e).slice(0, 600) }, 500); }
}
async function post(context) {
  const { request, env } = context;
  if (!sameOrigin(request)) return new Response(null, { status: 204 });
  if (await rateLimited(request, env, "evento", 60)) return new Response(null, { status: 204 });
  const body = await request.json().catch(() => ({}));
  const nome = String(body.nome || "").slice(0, 40);
  if (!NOMES.has(nome)) return new Response(null, { status: 204 });
  const ip = request.headers.get("cf-connecting-ip") || "";
  const ip_hash = ip ? await hashCurto(ip) : "";
  const meta = body.meta && typeof body.meta === "object" ? body.meta : {};
  // grava e RESPONDE o id — "ok" sem comprovante é promessa sem lastro. O beacon do navegador não lê
  // a resposta, mas o curl de prova lê.
  const r = await svcJson(env, "site_evento_log", { p_secret: env.INGEST_SECRET || "", p_nome: nome, p_caminho: String(body.caminho || "").slice(0, 200), p_lang: String(body.lang || "").slice(0, 8), p_meta: meta, p_ip_hash: ip_hash });
  if (r == null || (typeof r === "object" && r.ok === false)) return json({ ok: false, erro: "não gravou", detalhe: r && (r.detalhe || r.erro_http) }, 503);
  return json({ ok: true, id: r });
}

export async function onRequestGet(context) {
  try { return await get(context); } catch (e) { return json({ ok: false, erro: "exceção na rota", detalhe: String(e && e.stack || e).slice(0, 600) }, 500); }
}
async function get(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const tok = request.headers.get("x-guileo-secret") || url.searchParams.get("secret") || "";
  if (!env.INGEST_SECRET || !safeEq(tok, env.INGEST_SECRET)) return json({ error: "unauthorized" }, 401);
  const dias = Math.max(1, Math.min(90, parseInt(url.searchParams.get("dias") || "7", 10) || 7));
  const r = await svcJson(env, "site_eventos_resumo", { p_secret: env.INGEST_SECRET, p_dias: dias });
  if (r == null || r.ok === false) return json({ ok: false, erro: "não leu", detalhe: r && (r.detalhe || r.erro_http) }, 503);
  return json({ ok: true, ...r });
}
