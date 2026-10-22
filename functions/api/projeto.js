// Cloudflare Pages Function — POST /api/projeto  (ACOMPANHAMENTO DE PROJETO, 2026-10-08)
//
// Dois portões, como o /api/contract:
//   · PARCEIRO (Scale Pods): { t, action: "ler" | "marcar" | "comentar", ... } — o share_token É a
//     permissão, só para aquele projeto (RPC projeto_parceiro). Marca "feito", prova, nota, bloqueio.
//     Nunca marca "aceito" e não mexe em item aceito (a RPC recusa com erro "aceito").
//   · ADMIN (Origem): { token, action: "admin_listar" | "admin_ler" | "admin_salvar" |
//     "admin_apagar" | "admin_link" | "admin_comentar", slug, ... } — token de admin conferido no
//     blitz_stats (a mesma senha do /admin), depois a RPC projeto_admin com o SCHED_SECRET.
//
// A resposta da RPC é lida com svcJson (o {ok} do BANCO, não o 200 do HTTP). Falha de leitura vira
// 503 com motivo — nunca uma lista vazia que pareça "nada a fazer" (lição: fallback esconde erro).
import { json, rateLimited } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const TOKEN_OK = /^[A-Za-z0-9_-]{24,128}$/;

// mesma checagem de admin do /api/contract: o blitz_stats só responde 200 com a senha certa
async function adminOk(token) {
  if (!token || String(token).length < 6) return false;
  try {
    const r = await fetch(`${SB}/rest/v1/rpc/blitz_stats`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: String(token).trim(), p_email: "" }),
    });
    return r.ok;
  } catch { return false; }
}

// só os campos que cada lado pode mandar — o resto do corpo é ignorado
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o && Object.prototype.hasOwnProperty.call(o, k)).map((k) => [k, o[k]]));
const CAMPOS_PARCEIRO = ["id", "feito", "bloqueado", "prova_url", "nota", "nome"];
const CAMPOS_ADMIN = ["id", "titulo", "titulo_pt", "fase", "dono", "prazo", "prova_url", "nota", "bloqueado", "feito", "aceito", "ordem"];

function resposta(d) {
  if (d && d.ok) return json(d);
  if (d && d.erro) return json(d, d.erro === "token" ? 404 : 409);
  // erro de transporte / RPC ausente (SQL não colado) — 503, não 502 (a Cloudflare troca o corpo do 502)
  return json({ ok: false, erro: "indisponivel", detalhe: d && (d.detalhe || d.erro_http) }, 503);
}

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ ok: false, erro: "json" }, 400); }
  const action = String(b.action || "");

  if (action.startsWith("admin_")) {
    if (await rateLimited(request, env, "projeto-admin", 60)) return json({ ok: false, erro: "devagar" }, 429);
    if (!(await adminOk(b.token))) return json({ ok: false, erro: "unauthorized" }, 401);
    const secret = env.SCHED_SECRET || "";
    const acao = { admin_listar: "listar", admin_ler: "ler", admin_salvar: "salvar", admin_apagar: "apagar", admin_link: "novo_link", admin_comentar: "comentar" }[action];
    if (!acao) return json({ ok: false, erro: "acao" }, 400);
    const dados = { slug: String(b.slug || ""), ...pick(b.item || {}, CAMPOS_ADMIN) };
    if (acao === "comentar") { dados.texto = String(b.texto || ""); dados.item_id = b.item_id || ""; }
    return resposta(await svcJson(env, "projeto_admin", { p_secret: secret, p_acao: acao, p_dados: dados }));
  }

  // ── parceiro ──
  if (await rateLimited(request, env, "projeto-parceiro", 90)) return json({ ok: false, erro: "devagar" }, 429);
  const t = String(b.t || "").trim();
  if (!TOKEN_OK.test(t)) return json({ ok: false, erro: "token" }, 404);
  if (!["ler", "marcar", "comentar"].includes(action)) return json({ ok: false, erro: "acao" }, 400);
  const dados = action === "comentar"
    ? { texto: String(b.texto || ""), item_id: b.item_id || "", nome: b.nome || "" }
    : action === "marcar" ? pick(b.item || {}, CAMPOS_PARCEIRO) : {};
  if (action === "marcar" && b.nome) dados.nome = b.nome;
  return resposta(await svcJson(env, "projeto_parceiro", { p_token: t, p_acao: action, p_dados: dados }));
}
