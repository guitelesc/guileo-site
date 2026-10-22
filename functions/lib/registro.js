// functions/lib/registro.js — O REGISTRO QUE O DONO ENXERGA (2026-09-28)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE EXISTE: a Natura teve 47 ligações em agosto e o Luis achou que "não fica anotado". Estava
// anotado — no call_logs e no painel, dois lugares que ele não abre. Um registro que o dono não vê
// é o mesmo que registro nenhum. Aqui cada ligação/agendamento/lead SAI da plataforma para onde ele
// olha: uma planilha do Google (tudo) e o ClickUp (agendamentos e leads viram tarefa).
//
// DESTINOS (cada um inerte até a chave existir — nada quebra sem ela):
//   · Planilha: env SHEET_WEBHOOK = URL do Apps Script publicado (db/registro/apps-script.gs).
//     O script confere SHEET_TOKEN e grava uma linha por evento, numa aba por cliente.
//   · ClickUp: env CLICKUP_TOKEN (token pessoal "pk_…") + CLICKUP_LIST_ID (a lista de destino).
//     Só "agendamento" e "lead" viram tarefa — ligação sem ação não vira tarefa (viraria ruído).
//
// NUNCA LANÇA. Devolve o recibo por destino ({planilha, clickup}), e falha vira evento no feed do
// /admin (`registro_falhou`) — nunca silêncio (lei: "sucesso precisa de comprovante").
import { emitFailure } from "./failure.js";
import { registroEmail, appointmentEmail } from "./emailTemplates.js";
import { brandFor } from "./clientBrand.js";

const TIMEOUT = 8000;
const cortar = (v, n) => (v == null ? "" : String(v)).slice(0, n);

async function comTempo(url, init) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT);
  try { return await fetch(url, { ...init, signal: ctl.signal }); } finally { clearTimeout(t); }
}

async function paraPlanilha(env, linha) {
  if (!env.SHEET_WEBHOOK) return { ok: false, inerte: true, motivo: "SHEET_WEBHOOK ausente" };
  try {
    const r = await comTempo(env.SHEET_WEBHOOK, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: env.SHEET_TOKEN || "", ...linha }),
    });
    // Apps Script responde 200 mesmo quando o script recusa — então o corpo decide, não o status.
    const d = await r.json().catch(() => null);
    if (!r.ok || !d || d.ok !== true) return { ok: false, motivo: `planilha HTTP ${r.status} ${(d && d.erro) || ""}`.trim() };
    return { ok: true, linha: d.linha || null };
  } catch (e) { return { ok: false, motivo: String(e).slice(0, 120) }; }
}

async function paraClickUp(env, linha) {
  if (!env.CLICKUP_TOKEN || !env.CLICKUP_LIST_ID) return { ok: false, inerte: true, motivo: "CLICKUP_TOKEN/CLICKUP_LIST_ID ausente" };
  if (!["agendamento", "lead"].includes(linha.tipo)) return { ok: true, pulado: "só agendamento e lead viram tarefa" };
  const titulo = linha.tipo === "agendamento"
    ? `📅 ${linha.nome || "Cliente"} — ${linha.servico || "agendamento"}${linha.quando ? ` · ${linha.quando}` : ""}`
    : `🔥 Lead: ${linha.nome || linha.telefone || "sem nome"}${linha.servico ? ` — ${linha.servico}` : ""}`;
  const desc = [
    `Cliente Guileo: ${linha.cliente}`,
    linha.telefone ? `Telefone: ${linha.telefone}` : "",
    linha.email ? `E-mail: ${linha.email}` : "",
    linha.quando ? `Quando: ${linha.quando}` : "",
    linha.resumo ? `\n${linha.resumo}` : "",
    `\nOrigem: ${linha.canal || "voz"} · registrado pela Guileo em ${linha.data}`,
  ].filter(Boolean).join("\n");
  try {
    const r = await comTempo(`https://api.clickup.com/api/v2/list/${encodeURIComponent(env.CLICKUP_LIST_ID)}/task`, {
      method: "POST",
      headers: { Authorization: env.CLICKUP_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ name: cortar(titulo, 200), description: cortar(desc, 4000), tags: [linha.tipo, cortar(linha.cliente.split("@")[0], 40)] }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.id) return { ok: false, motivo: `clickup HTTP ${r.status} ${d.err || ""}`.trim() };
    return { ok: true, id: d.id, url: d.url || null };
  } catch (e) { return { ok: false, motivo: String(e).slice(0, 120) }; }
}

// ── n8n (2026-09-28, decisão do Luis: "A" — a Lilian fica, o n8n vira o painel dele) ──────────────
// env N8N_WEBHOOK = URL do nó "Webhook" (POST) do fluxo dele; N8N_SECRET (opcional) vai no header
// x-guileo-secret pro fluxo conferir. Qualquer 2xx conta como entregue — o n8n responde 200 por padrão.
async function paraN8n(env, linha) {
  if (!env.N8N_WEBHOOK) return { ok: false, inerte: true, motivo: "N8N_WEBHOOK ausente" };
  try {
    const r = await comTempo(env.N8N_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(env.N8N_SECRET ? { "x-guileo-secret": env.N8N_SECRET } : {}) },
      body: JSON.stringify(linha),
    });
    if (!r.ok) return { ok: false, motivo: `n8n HTTP ${r.status}` };
    return { ok: true };
  } catch (e) { return { ok: false, motivo: String(e).slice(0, 120) }; }
}

// Quem recebe a transcrição de CADA ligação por e-mail: só a demo (e o teste do registro).
// env REGISTRO_EMAIL_LIGACAO (csv) troca a lista sem deploy.
function ligacaoPorEmail(env, cliente) {
  const lista = (env.REGISTRO_EMAIL_LIGACAO || "smart@guileoai.com,guileoai@gmail.com,teste@guileoai.com")
    .split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  return lista.includes((cliente || "").toLowerCase());
}

// registrar(env, { cliente, tipo: "ligacao"|"agendamento"|"lead"|…, nome, telefone, email, servico,
//                  quando, duracao_s, sentimento, resumo, canal, ref })
export async function registrar(env, ev = {}) {
  const linha = {
    data: new Date().toISOString(),
    cliente: cortar(ev.cliente, 120).toLowerCase(),
    tipo: cortar(ev.tipo || "evento", 30),
    nome: cortar(ev.nome, 120), telefone: cortar(ev.telefone, 40), email: cortar(ev.email, 160),
    servico: cortar(ev.servico, 160), quando: cortar(ev.quando, 80),
    duracao_s: ev.duracao_s == null ? "" : Math.round(Number(ev.duracao_s) || 0),
    sentimento: cortar(ev.sentimento, 20), resumo: cortar(ev.resumo, 1500),
    canal: cortar(ev.canal, 30), ref: cortar(ev.ref, 120),
    // Transcrição completa (ligações): o Luis montou no Retell "ligação → planilha + e-mail com a
    // transcrição" pelo n8n; aqui chega o mesmo material. Teto de 20k caracteres (~40 min de fala).
    transcricao: cortar(ev.transcricao, 20000),
    agente: cortar(ev.agente, 80), conversation_id: cortar(ev.conversation_id, 80),
  };
  // E-mail pronto, com a marca, no idioma do cliente (padrão inglês — a Natura é de NY). O n8n só
  // entrega `email_assunto`/`email_html`; texto de e-mail nunca mais mora dentro do fluxo.
  let mail = { subject: "", html: "" };
  try {
    // Logo + cor do cliente (a Natura vê a Natura). Teto de 3s: a marca não pode segurar o registro.
    const brand = (ev.marca || linha.cliente) ? await Promise.race([brandFor(env, (ev.marca || linha.cliente).toString().toLowerCase()).catch(() => null), new Promise((r) => setTimeout(() => r(null), 3000))]) : null;
    const lg = ev.lang || (brand && brand.lang) || "en";
    if (ev.confirmacao && typeof ev.confirmacao === "object") {
      // AGENDAMENTO: o dono recebe o MESMO e-mail que o cliente recebe (Luis, 28/09: "tudo perfeito
      // como o cliente receberia") — só o assunto diz que é um agendamento novo, pra ele achar na caixa.
      const c = appointmentEmail({ ...ev.confirmacao, business: (brand && brand.business) || "", lang: ev.confirmacao.lang || lg, brand });
      const quem = ev.confirmacao.name || linha.telefone || "";
      mail = { subject: `📅 New booking${quem ? ` — ${quem}` : ""} · ${c.subject}`.slice(0, 180), html: c.html };
    } else if (linha.tipo === "ligacao" && !ligacaoPorEmail(env, linha.cliente)) {
      // LIGAÇÃO: transcrição por e-mail só na DEMO (Luis, 28/09: "não precisa sempre, deixa só pra
      // mostrar na demo"). Pro cliente a ligação, a transcrição e o áudio ficam no painel dele.
      mail = { subject: "", html: "" };
    } else {
      mail = registroEmail(linha, lg, brand);
    }
  } catch { /* sem e-mail pronto, a linha ainda vai */ }
  const envio = { ...linha, email_assunto: mail.subject, email_html: mail.html };
  const [planilha, clickup, n8n] = await Promise.all([paraPlanilha(env, linha), paraClickUp(env, linha), paraN8n(env, envio)]);
  const falhas = [["planilha", planilha], ["clickup", clickup], ["n8n", n8n]].filter(([, r]) => !r.ok && !r.inerte);
  if (falhas.length) {
    try { await emitFailure(env, "registro_falhou", linha.cliente, falhas.map(([n, r]) => `${n}: ${r.motivo}`).join(" · "), { tipo: linha.tipo, ref: linha.ref }); } catch { /* */ }
  }
  return { planilha, clickup, n8n };
}
