// Cloudflare Pages Function — GET/POST /api/crm-classify?token=DIGEST_TOKEN
//
// O MOTOR DE CLASSIFICAÇÃO DO CRM, rodando sozinho todo dia.
//
// POR QUE EXISTE: a Gui já criava a ficha do cliente e a história dele, mas os campos que
// CLASSIFICAM a pessoa (lifecycle, LTV, risco de sumir, etiquetas) ficavam vazios pra sempre.
// O Luis tinha 3 ligações desde julho e continuava "lead", LTV $0. E TODOS os motores de
// retenção — aniversário, win-back, reativação, churn — leem exatamente esses campos. Ou seja:
// a plataforma tinha os motores prontos e o tanque vazio, e ninguém percebia porque nada
// quebrava; simplesmente nunca disparava.
//
// O que a varredura faz (fatos, nunca palpite): LTV = soma dos atendimentos concluídos;
// lifecycle lead→customer→loyal→dormant; churn_risk pela recência; etiquetas de unidade e
// serviço preferidos. Quem nunca foi atendido continua "lead", por mais que tenha ligado.
//
// Idempotente e barata: só escreve na ficha que mudou de verdade.
import { json, safeEq } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";

export async function onRequest(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
    const tok = (body.token || url.searchParams.get("token") || "").toString();
    if (!env.DIGEST_TOKEN || !safeEq(tok, env.DIGEST_TOKEN)) return json({ error: "unauthorized" }, 401);

    // sem e-mail = todos os tenants (é o modo do cron)
    const email = (body.email || url.searchParams.get("email") || "").toString().trim().toLowerCase() || null;

    const r = await svcRpc(env, "crm_classify_sweep", { p_secret: env.INGEST_SECRET || "", p_email: email });
    // Falha aqui não pode ser silenciosa: sem classificação, os motores de retenção param de
    // disparar e ninguém nota — exatamente o buraco que esta rota veio fechar.
    if (!r || !r.ok) return json({ ok: false, error: `classificação falhou (${r && r.status})` }, 503);
    return json({ ok: true, scope: email || "todos os clientes", ...(await r.json().catch(() => ({}))) });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
