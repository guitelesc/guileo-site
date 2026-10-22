// Cloudflare Pages Function — POST /api/ciclo-retorno   (DE QUANTO EM QUANTO TEMPO CADA SERVIÇO VOLTA)
// O dono define, por serviço, em quantos dias a Gui lembra a cliente de voltar (facial 28, Botox
// 90, consulta 0 = nunca). É o que o lembrete de volta lê (db/relacionamento_fila.sql →
// biz_services.config.rebook_days). Antes nada gravava esse campo e todo serviço usava 28 dias.
//
// PORTÃO POR TENANT — e-mail + chave de conexão via get_client_data, idêntico a packages.js /
// produtos.js: uma chave nunca lê nem muda o serviço de outro negócio. O e-mail que vai para a RPC
// é o MESMO que a chave acabou de provar; a RPC ainda confere `client_email` linha a linha.
//
//   POST { email, token|key, action }
//     list                       -> { ok, services:[{id,name,days,suggested}] }   days null = ainda não decidido
//     set { cycles:[{id,days}] } -> { ok, changed }                                days 0 = nunca lembrar
//
// FALHA ≠ VAZIO: leitura que não respondeu devolve { ok:false } com 503 — nunca uma lista vazia com
// 200, que a tela leria como "você não tem serviços".
import { json } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { cicloSugerido } from "../lib/cicloRetorno.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json().catch(() => ({}));
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ ok: false, error: "unauthorized" }, 401);
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!gd.ok) return json({ ok: false, error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ ok: false, error: "unauthorized" }, 401);
    if (!env.SCHED_SECRET) return json({ ok: false, ready: false, error: "not_ready" }, 503);

    const action = (b.action || "list").toString();
    if (action === "list") {
      const r = await svcJson(env, "biz_service_cycles", { p_secret: env.SCHED_SECRET, p_email: email });
      if (!(r && r.ok === true && Array.isArray(r.services))) return json({ ok: false, ready: false, error: "not_ready", detalhe_tecnico: `biz_service_cycles: ${String((r && (r.reason || r.detalhe || r.erro_http)) || "resposta ilegível").slice(0, 120)}` }, 503);
      // `suggested` é só a sugestão pelo nome — a tela mostra ao lado; nada é gravado aqui.
      return json({ ok: true, services: r.services.map((s) => ({ id: s.id, name: s.name, days: s.days === null || s.days === undefined ? null : Number(s.days), suggested: cicloSugerido(s.name) })) });
    }
    if (action === "set") {
      const cycles = (Array.isArray(b.cycles) ? b.cycles : []).slice(0, 200)
        .map((c) => ({ id: String((c && c.id) || ""), days: Number.parseInt(c && c.days, 10) }))
        .filter((c) => UUID.test(c.id) && Number.isInteger(c.days) && c.days >= 0 && c.days <= 730);
      if (!cycles.length) return json({ ok: false, error: "nothing_to_save" }, 400);
      const r = await svcJson(env, "biz_service_cycles_set", { p_secret: env.SCHED_SECRET, p_email: email, p_cycles: cycles });
      // comprovante: o banco diz quantas linhas DESTE negócio mudou
      if (!(r && r.ok === true && Number.isInteger(r.changed))) return json({ ok: false, error: "not_saved", detalhe_tecnico: String((r && (r.reason || r.detalhe || r.erro_http)) || "").slice(0, 120) }, 503);
      return json({ ok: true, changed: r.changed, asked: cycles.length });
    }
    return json({ ok: false, error: "unknown_action" }, 400);
  } catch (e) {
    return json({ ok: false, error: "server", detalhe_tecnico: String(e).slice(0, 160) }, 503);
  }
}
