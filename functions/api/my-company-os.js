// Cloudflare Pages Function — POST /api/my-company-os
// O Company OS do PRÓPRIO CLIENTE: os 8 departamentos DELE (/portal), tudo escopado por client_email.
// Mesmo gate per-tenant que growth-intel/crm/call-logs usam: get_client_data(email,key) liga email↔key
// e devolve null num mismatch → a chave de um cliente NUNCA lê o dado de outro. Sem fallback OWNER.
//   POST { token|key, email } -> { ok, departments:[{key,label,icon,accent,kpi_value,kpi_label,ready}] }
import { json } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);

    // PER-TENANT GATE (idêntico ao growth-intel): valida email↔key.
    const gd = await rpc("get_client_data", { p_email: email, p_key: key });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    // LOTE 2 do fechamento do anon: esta leitura passa pela service_role (só o servidor a tem),
    // então `my_company_os` pode ser revogada do anon. O portão de tenant acima continua no anon
    // de propósito — `get_client_data` é o par email↔chave que o cockpit usa, e sai num lote depois.
    const r = await svcRpc(env, "my_company_os", { p_secret: env.INGEST_SECRET || "", p_email: email });
    // `ready:false` aqui é degradação honesta (o painel mostra vazio, não um erro falso), mas
    // silencia falha: se ISSO começar a vir vazio pra todo mundo, suspeite da chave, não do dado.
    if (!r || !r.ok) return json({ ok: true, ready: false, departments: [], note: `leitura indisponível (${r && r.status})` });
    const rows = await r.json().catch(() => []);
    if (rows && rows.error) return json({ ok: true, ready: false, departments: [] });
    return json({ ok: true, departments: Array.isArray(rows) ? rows : [] });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
