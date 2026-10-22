// Cloudflare Pages Function — POST /api/relatorio-produtividade
// RELATÓRIO DE PRODUTIVIDADE do dono do negócio: num período, quais profissionais e quais serviços
// mais venderam. Leitura pura — a conta toda mora na RPC `biz_productivity`
// (db/relatorio_produtividade.sql); aqui ficam o portão do tenant e a validação do período.
//
// PORTÃO POR TENANT — e-mail + chave de conexão via get_client_data (idêntico a packages.js):
// uma chave nunca lê o relatório de outro negócio. O e-mail que vai para a RPC é o MESMO que a
// chave acabou de provar. Sem fallback de OWNER_EMAIL. Chave nunca em URL: tudo no corpo.
//
//   POST { email, token|key, from?, to? }     from/to = ISO; [from, to); sem os dois = mês corrente (UTC)
//   200  { ok:true, ready:true, revenue_basis:"list_price", period, totals,
//          by_professional:[…], by_service:[…], by_location:[…] }
//   400  período inválido · 401 e-mail/chave não conferem · 503 relatório indisponível
//
// FALHA ≠ VAZIO: se a RPC não responde, a resposta é 503 com `detalhe_tecnico` — nunca um
// relatório zerado, que a tela leria como "não houve visitas". (503 e não 502: a Cloudflare troca
// o corpo de todo 502 por texto puro.)
import { json } from "../lib/guard.js";
import { sbKey } from "../lib/sb.js";
import { normalizarPeriodo, PRESETS } from "../lib/produtividade.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const NOTE = "Apply db/relatorio_produtividade.sql (needs db/live_desde.sql and the scheduling engine) and set SUPABASE_SERVICE_ROLE + INGEST_SECRET in Cloudflare.";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    // ── PORTÃO POR TENANT (o mesmo de packages.js / noshow-radar.js / coupons.js) ──
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    // ── PERÍODO: sem from/to = mês de calendário corrente; inválido = 400 dito, nunca "consertado" ──
    const periodo = normalizarPeriodo({ from: b.from, to: b.to });
    if (periodo.erro) return json({ ok: false, error: "invalid_period", detalhe_tecnico: periodo.erro }, 400);

    const k = sbKey(env);
    const r = await fetch(`${SB}/rest/v1/rpc/biz_productivity`, {
      method: "POST", headers: { apikey: k, Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
      // `preset` (este mês / mês passado / 30 dias) → a RPC monta o período no FUSO DO NEGÓCIO;
      // from/to continuam indo, e valem quando não há preset (período livre).
      body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", p_email: email, p_from: periodo.from, p_to: periodo.to, p_preset: PRESETS.includes(b.preset) ? b.preset : null }),
    });
    if (!r.ok) {
      return json({ ok: false, ready: false, error: "report_unavailable", detalhe_tecnico: `biz_productivity HTTP ${r.status}. ${NOTE}` }, 503);
    }
    const rel = await r.json().catch(() => null);
    // comprovante: só é relatório se a RPC disse ok E trouxe totals + as listas
    if (!(rel && typeof rel === "object" && rel.ok === true && rel.totals && typeof rel.totals === "object"
      && Array.isArray(rel.by_professional) && Array.isArray(rel.by_service) && Array.isArray(rel.by_location))) {
      const motivo = rel && typeof rel === "object" && rel.error ? String(rel.error).slice(0, 80) : "unreadable answer";
      const detalhe = rel && typeof rel === "object" && rel.detail ? ` (${String(rel.detail).slice(0, 160)})` : "";
      return json({ ok: false, ready: false, error: "report_unavailable", detalhe_tecnico: `biz_productivity: ${motivo}${detalhe}. ${NOTE}` }, 503);
    }
    return json({ ...rel, ok: true, ready: true });
  } catch (e) {
    return json({ ok: false, error: "report_unavailable", detalhe_tecnico: String(e).slice(0, 160) }, 503);
  }
}
