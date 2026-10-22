// Cloudflare Pages Function — POST /api/my-company-os
// O Company OS do PRÓPRIO CLIENTE: os 8 departamentos DELE (/portal), tudo escopado por client_email.
// Mesmo gate per-tenant que growth-intel/crm/call-logs usam: get_client_data(email,key) liga email↔key
// e devolve null num mismatch → a chave de um cliente NUNCA lê o dado de outro. Sem fallback OWNER.
//   POST { token|key, email, lang? } -> { ok, lang, departments:[{key,label,icon,accent,kpi_value,kpi_label,ready}] }
//   `lang` = en|pt|es|hi. Sem ele: idioma do cadastro (get_client_profile) → "en".
import { json } from "../lib/guard.js";
import { svcRpc, svcJson } from "../lib/sb.js";

// ── RÓTULOS NO IDIOMA DA TELA (incidente 2026-09-28) ──────────────────────────────────────────
// A RPC my_company_os monta `label`/`kpi_label` em português FIXO dentro do banco ("Finanças",
// "receita coletada (30d)", "tickets abertos") e o cliente de interface em inglês lia isso no
// painel dele. A tradução mora AQUI, por `key` (estável), não por texto: mexer na assinatura da
// RPC criaria uma segunda sobrecarga — e sobrecarga ambígua já derrubou support_ticket_reply.
// A parte DINÂMICA do rótulo (valor de LTV, nº no pipeline, origem campeã) é extraída do texto do
// banco e reencaixada; se o formato mudar e a extração falhar, o rótulo sai SEM o pedaço dinâmico
// — nunca com português vazando nem com número inventado.
const LANGS = ["en", "pt", "es", "hi"];
export const idiomaDe = (v) => { const l = String(v || "").toLowerCase().slice(0, 2); return LANGS.includes(l) ? l : ""; };
const depoisDoPonto = (t) => { const i = String(t || "").indexOf("· "); return i >= 0 ? String(t).slice(i + 2).trim() : ""; };
const ROTULOS = {
  finance: { label: { en: "Finance", pt: "Finanças", es: "Finanzas", hi: "वित्त" },
    kpi: () => ({ en: "revenue collected (30d)", pt: "receita coletada (30d)", es: "ingresos cobrados (30d)", hi: "प्राप्त राजस्व (30 दिन)" }) },
  crm: { label: { en: "Customers", pt: "Clientes", es: "Clientes", hi: "ग्राहक" },
    kpi: (t) => { const v = depoisDoPonto(t).replace(/\s*LTV$/, ""); const x = v ? ` · ${v} LTV` : ""; return { en: `contacts${x}`, pt: `contatos${x}`, es: `contactos${x}`, hi: `संपर्क${x}` }; } },
  sales: { label: { en: "Sales", pt: "Vendas", es: "Ventas", hi: "बिक्री" },
    kpi: (t) => { const n = (String(t || "").match(/^\d+/) || [""])[0]; const x = n ? `${n} ` : ""; return { en: `${x}in the pipeline`, pt: `${x}no pipeline`, es: `${x}en el pipeline`, hi: `${x}पाइपलाइन में` }; } },
  marketing: { label: { en: "Marketing", pt: "Marketing", es: "Marketing", hi: "मार्केटिंग" },
    kpi: (t) => { const o = depoisDoPonto(t); const x = o ? ` · ${o}` : ""; return { en: `leads${x}`, pt: `leads${x}`, es: `leads${x}`, hi: `लीड${x}` }; } },
  operations: { label: { en: "Operations", pt: "Operações", es: "Operaciones", hi: "संचालन" },
    kpi: () => ({ en: "upcoming appointments", pt: "agendamentos futuros", es: "citas próximas", hi: "आने वाली अपॉइंटमेंट" }) },
  growth: { label: { en: "Growth", pt: "Crescimento", es: "Crecimiento", hi: "वृद्धि" },
    kpi: () => ({ en: "customers at risk", pt: "clientes em risco", es: "clientes en riesgo", hi: "जोखिम में ग्राहक" }) },
  support: { label: { en: "Support", pt: "Suporte", es: "Soporte", hi: "सहायता" },
    kpi: () => ({ en: "open tickets", pt: "tickets abertos", es: "tickets abiertos", hi: "खुले टिकट" }) },
  intelligence: { label: { en: "Intelligence", pt: "Inteligência", es: "Inteligencia", hi: "इंटेलिजेंस" },
    kpi: () => ({ en: "Gui actions (30d)", pt: "ações da Gui (30d)", es: "acciones de Gui (30d)", hi: "Gui की कार्रवाइयाँ (30 दिन)" }) },
};
const AGUARDANDO = { en: "waiting for data", pt: "aguardando dados", es: "esperando datos", hi: "डेटा की प्रतीक्षा" };
export function traduzDepartamento(d, lang) {
  const r = d && ROTULOS[d.key];
  if (!r) return d;                                   // departamento novo no banco: passa como veio
  const lg = LANGS.includes(lang) ? lang : "en";
  const kpi = d.ready === false ? AGUARDANDO : r.kpi(d.kpi_label);
  return { ...d, label: r.label[lg], kpi_label: kpi[lg] };
}

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
    // Idioma: o do pedido → o do cadastro (get_client_profile) → o da identidade → "en".
    let lang = idiomaDe(b.lang);
    if (!lang) {
      const p = await svcJson(env, "get_client_profile", { p_secret: env.INGEST_SECRET || "", p_email: email }).catch(() => null);
      lang = idiomaDe(p && typeof p === "object" ? p.lang : "") || idiomaDe(gdj.identity && gdj.identity.lang) || "en";
    }
    const FORA = {
      en: "I couldn't load your departments right now. Please try again in a moment.",
      pt: "Não consegui carregar seus departamentos agora. Tente de novo em instantes.",
      es: "No pude cargar sus departamentos ahora. Inténtelo de nuevo en un momento.",
      hi: "मैं अभी आपके विभाग लोड नहीं कर सका। कृपया थोड़ी देर में फिर कोशिश करें।",
    }[lang];
    // HTTP 200 mantido: o painel lê `ready:false` e mostra o aviso; o motivo técnico vai à parte.
    if (!r || !r.ok) return json({ ok: false, ready: false, lang, departments: [], note: FORA, error: FORA, erro: FORA, detalhe_tecnico: `my_company_os HTTP ${r && r.status}` });
    const rows = await r.json().catch(() => null);
    if (!Array.isArray(rows)) return json({ ok: false, ready: false, lang, departments: [], note: FORA, error: FORA, erro: FORA, detalhe_tecnico: `my_company_os: ${rows && rows.error ? String(rows.error).slice(0, 160) : "resposta não é lista"}` });
    return json({ ok: true, ready: true, lang, departments: rows.map((d) => traduzDepartamento(d, lang)) });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
