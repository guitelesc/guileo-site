// functions/lib/avisarDono.js — O ÚNICO CAMINHO por onde um alarme de operação chega ao dono.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE EXISTE (2026-09-09): a plataforma sabia dizer "estou bem" e não sabia dizer "quebrei".
// Cada monitor (canary, health-monitor, voz-saldo, cron-tick, failure.js) tinha a SUA cópia de
// "manda e-mail pro dono" — cinco cópias, cinco defaults, e todas mandavam para
// `smart@guileoai.com`, uma caixa que o Luis não abre de madrugada. Nenhuma mandava WhatsApp.
// Alarme que chega numa caixa que ninguém abre é a mesma coisa que alarme que fica no feed:
// "alarme que fica dentro da plataforma é alarme que não existe" (cron-tick.js, lei da casa).
//
// O QUE ESTE HELPER FAZ, SEMPRE NA MESMA ORDEM, E SEMPRE DEVOLVENDO O QUE ACONTECEU:
//   1. TRAVA de 6h por `kind` (health_claim, TTL 7d, chave com balde de 6h — o mesmo truque que o
//      canary e o voz-saldo já usavam). `false` explícito = "já avisei" → cala. Qualquer OUTRA
//      resposta (RPC fora, banco fora, segredo faltando) → AVISA MESMO ASSIM. Um alarme repetido é
//      chato; um alarme mudo por causa do próprio anti-spam é a falha silenciosa que este arquivo
//      existe para acabar (regra do "não sei", herdada de failure.js).
//   2. FEED do /admin (ingest_client_event no tenant da plataforma) — a auditoria.
//   3. E-MAIL para o dono (opsAlertEmail — o template da casa; nunca HTML ad-hoc).
//   4. WHATSAPP para o dono (sendText canal whatsapp, número em client_notify_phone_lookup do
//      tenant da plataforma — o MESMO caminho que avisa o dono de um cliente sobre reserva nova).
//   Cada canal confere o `.ok` da resposta e grava o status REAL. "Enviado" sem conferir a
//   resposta é a promessa sem lastro que já custou 3 semanas de WhatsApp mudo.
//
// NUNCA LANÇA. Devolve um recibo: { kind, chave, pulado?, feed, email, whatsapp }. Quem chama
// decide se põe o recibo na resposta (deve) — é o recibo que prova que o alarme saiu.
//
// ⚠️ DESTINATÁRIO: o padrão é `luistelesc@gmail.com` (a caixa que o dono LÊ). `OWNER_EMAIL` no
// ambiente sobrescreve. O TENANT do feed continua `smart@guileoai.com` (dono do banco), que é
// onde o /admin lê — são duas coisas diferentes e este arquivo não as mistura.
import { svcJson } from "./sb.js";
import { opsAlertEmail } from "./emailTemplates.js";
import { sendText } from "./twilio.js";
import { sendWhatsApp, sendWhatsAppTemplate } from "../api/whatsapp-cloud.js";

// A caixa que o dono lê. OWNER_EMAIL (1º da lista) vence; sem ela, o Gmail do Luis.
export function donoEmail(env) {
  return ((env && env.OWNER_EMAIL) || "luistelesc@gmail.com").toString().split(",")[0].trim().toLowerCase();
}
// O tenant onde o feed de operação é gravado e onde mora o telefone de aviso do dono.
export const TENANT_PLATAFORMA = "smart@guileoai.com";

// ── O SILENCIADOR (2026-09-22) ─────────────────────────────────────────────────────────────────
// O Luis pediu: "pare os e-mails de alerta da plataforma". Um interruptor só, lido de dois lugares:
// env `EMAILS_DONO=off` (Cloudflare) OU platform_settings `emails_dono = "off"` (banco, sem deploy).
// Cala APENAS o e-mail ao dono (alarmes, digest diário, eval, brief, churn). O feed do /admin e o
// WhatsApp continuam — o alarme não some, só para de chegar na caixa. Erro ao ler = NÃO está mudo
// (a regra do "não sei" deste arquivo: o próprio interruptor não pode virar falha silenciosa).
//
// ⚠️ A ÚNICA EXCEÇÃO AO SILENCIADOR (2026-09-27): `ignoraMudo: true`.
// O interruptor foi pedido para calar ALARME DE PLATAFORMA (canário, digest, eval, churn) — ruído
// de máquina. Um CLIENTE pedindo socorro não é alarme de plataforma: é uma pessoa esperando gente.
// Com o mudo ligado e o WhatsApp do dono fora (lista de teste da Meta + Twilio 401), o chamado
// urgente caía SÓ no feed do /admin — que ninguém abre de madrugada. Então o canal de e-mail
// atravessa o mudo quando, E SOMENTE quando, as DUAS condições valem:
//   1. quem chama pediu explicitamente `ignoraMudo: true`; e
//   2. o `kind` contém "chamado_escalado" ou "emergency" (lista fechada em PODE_FURAR_MUDO).
// A segunda trava é de propósito: sem ela, qualquer monitor passaria `ignoraMudo` "só desta vez"
// e o interruptor que o Luis pediu deixaria de significar alguma coisa. Tipo novo que mereça furar
// o mudo entra NA LISTA, com o porquê escrito aqui — nunca por um `true` solto no chamador.
//   • "formulario-cliente" (2026-10-22): a Natura mandou o checklist de implantação em 19/10 e o
//     aviso morreu no mudo — o Luis só soube 3 dias depois. Resposta de cliente é gente, não máquina.
//   • "voz_" (2026-11-03): a conta ElevenLabs zerou (2 créditos), a Lilian caiu em TODOS os canais e
//     2 ligações reais da Natura falharam em 01/11. O alarme de saldo existia e morreu no mudo — o
//     Luis descobriu pelo widget 2 dias depois. Saldo da voz é o único alarme que derruba cliente pagante.
const PODE_FURAR_MUDO = ["chamado_escalado", "emergency", "formulario-cliente", "voz_"];
export function furaMudo(kind, ignoraMudo) {
  const k = (kind || "").toString().toLowerCase();
  return ignoraMudo === true && PODE_FURAR_MUDO.some((p) => k.includes(p));
}
export async function emailsDoDonoMudos(env) {
  try {
    if (String((env && env.EMAILS_DONO) || "").toLowerCase() === "off") return true;
    if (!env || !env.INGEST_SECRET) return false;
    const s = await svcJson(env, "platform_settings_get", { p_secret: env.INGEST_SECRET }).catch(() => null);
    return !!s && typeof s === "object" && String(s.emails_dono || "").toLowerCase() === "off";
  } catch { return false; }
}

const TIMEOUT_MS = 8000;
const BALDE_HORAS = 6;

// balde de 6h: "2026-09-09-2" — chave nova a cada 6h ⇒ no máximo 1 aviso por kind por balde.
function baldeAtual() {
  const agora = new Date();
  return `${agora.toISOString().slice(0, 10)}-${Math.floor(agora.getUTCHours() / BALDE_HORAS)}`;
}

// ── a trava ─────────────────────────────────────────────────────────────────────────────────
// Devolve { pode: boolean, motivo }. Só `false` do banco cala; "não sei" deixa passar.
async function trava(env, chave) {
  if (!env.INGEST_SECRET) return { pode: true, motivo: "sem INGEST_SECRET — trava não consultada, aviso sai" };
  const r = await svcJson(env, "health_claim", {
    p_secret: env.INGEST_SECRET, p_email: TENANT_PLATAFORMA, p_kind: chave.slice(0, 120),
  }).catch((e) => ({ ok: false, detalhe: String(e).slice(0, 100) }));
  if (r === false) return { pode: false, motivo: `já avisado neste balde de ${BALDE_HORAS}h` };
  if (r === true) return { pode: true, motivo: "trava obtida" };
  return { pode: true, motivo: `trava ilegível (${(r && (r.detalhe || r.erro_http)) || "?"}) — aviso sai mesmo assim` };
}

// ── canal 1: o feed ─────────────────────────────────────────────────────────────────────────
async function feed(env, { kind, summary, detail, cliente, payload }) {
  if (!env.INGEST_SECRET) return { ok: false, motivo: "sem INGEST_SECRET" };
  const r = await svcJson(env, "ingest_client_event", {
    p_secret: env.INGEST_SECRET, p_email: TENANT_PLATAFORMA, p_type: "ops_alert", p_channel: "system",
    p_summary: `🚨 ${kind}: ${summary}${cliente ? ` · ${cliente}` : ""}`.slice(0, 300),
    p_amount: 0, p_payload: { kind, cliente: cliente || "", detail: (detail || "").toString().slice(0, 500), ...(payload || {}) },
  }).catch((e) => ({ ok: false, detalhe: String(e).slice(0, 100) }));
  // ingest_client_event devolve o id (ou true) quando grava; objeto {ok:false} é falha de transporte.
  if (r && typeof r === "object" && r.ok === false) return { ok: false, motivo: `http ${r.erro_http || "?"} ${r.detalhe || ""}`.trim() };
  return { ok: true, id: (r && typeof r !== "object") ? r : (r && r.id) || null };
}

// ── canal 2: o e-mail ───────────────────────────────────────────────────────────────────────
async function email(env, { kind, summary, detail, cliente, link, ignoraMudo = false }) {
  if (!env.RESEND_API_KEY) return { ok: false, motivo: "RESEND_API_KEY ausente" };
  // Pedido de socorro de cliente atravessa o mudo (ver a exceção documentada no silenciador).
  // O recibo MARCA que atravessou: se o dono perguntar "por que chegou e-mail com o mudo ligado?",
  // a resposta está escrita no próprio comprovante, não na memória de quem programou.
  const atravessa = furaMudo(kind, ignoraMudo);
  if (!atravessa && await emailsDoDonoMudos(env)) return { ok: false, mudo: true, motivo: "e-mails ao dono desligados (emails_dono=off)" };
  const to = donoEmail(env);
  try {
    const { subject, html } = opsAlertEmail({
      type: kind, client: cliente || "Guileo (plataforma)",
      detail: `${summary}${detail ? `\n\n${detail}` : ""}`,
      cta: link ? "Abrir →" : "", ctaUrl: link || "",
    });
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to, subject, html }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, para: to, status: r.status, motivo: (d && d.message) || `resend http ${r.status}` };
    return { ok: true, para: to, id: (d && d.id) || null, ...(atravessa ? { ignorouMudo: true } : {}) };
  } catch (e) { return { ok: false, para: to, motivo: String(e).slice(0, 120) }; }
}

// ── canal 3: o WhatsApp ─────────────────────────────────────────────────────────────────────
// O número vem de client_notify_phone_lookup do tenant da plataforma — o mesmo lugar onde o dono
// de um cliente cadastra o número que recebe "nova reserva". Sem linha lá, o recibo DIZ que não
// há número (e como cadastrar), em vez de fingir que mandou.
//
// "USA O QUE JÁ TEM" (Luis, 2026-09-10). O Twilio respondia 401 (segredos da conta antiga) e a
// única linha de WhatsApp viva na casa é a do Meta Cloud API (a que o semáforo marca verde).
// Então a escada é: 1) Cloud texto livre — só entra na janela de 24h depois que o dono escreveu
// pra linha; 2) Cloud TEMPLATE (`OWNER_WA_TEMPLATE`, padrão `hello_world`, que toda conta de
// teste da Meta tem pronto) — chega fora da janela, mas com texto fixo: é um "toque" que manda
// o dono ler o e-mail; 3) Twilio, como era. O recibo conta em qual degrau parou e por quê.
// ⚠️ Linha de TESTE da Meta só entrega para números cadastrados como destinatários de teste no
// app — se a Meta recusar (131030), o recibo diz isso em vez de "desconhecido".
async function linhaCloud(env) {
  const saude = await svcJson(env, "whatsapp_cloud_saude", { p_secret: env.INGEST_SECRET }).catch(() => null);
  const linhas = Array.isArray(saude) ? saude : [];
  const alvo = (env.OWNER_WA_TENANT
    ? linhas.find((l) => String(l.client_email || "").toLowerCase() === String(env.OWNER_WA_TENANT).toLowerCase())
    : null) || linhas.find((l) => l.env !== "test") || linhas[0];
  if (!alvo || !alvo.phone_number_id) return null;
  const t = await svcJson(env, "whatsapp_cloud_tenant_by_pnid", { p_secret: env.INGEST_SECRET, p_phone_number_id: String(alvo.phone_number_id) }).catch(() => null);
  return t && t.tokens ? { ...t, label: alvo.label || "", display: alvo.display_number || "", envio: alvo.env || "" } : null;
}
function motivoMeta(raw) {
  const e = raw && raw.error ? raw.error : {};
  const code = e.code, msg = String(e.message || "").slice(0, 120);
  if (code === 131047 || /24 ?h|re-engagement/i.test(msg)) return "fora da janela de 24h (o dono precisa escrever pra linha primeiro)";
  if (code === 131030) return "número não está na lista de destinatários de teste da Meta";
  if (code === 132001) return "template não existe/aprovado nesta conta";
  return code ? `meta ${code}: ${msg}` : (msg || "recusado sem motivo");
}
async function whatsapp(env, { kind, summary, link }) {
  if (!env.INGEST_SECRET) return { ok: false, motivo: "sem INGEST_SECRET" };
  const ph = await svcJson(env, "client_notify_phone_lookup", { p_secret: env.INGEST_SECRET, p_email: TENANT_PLATAFORMA })
    .catch((e) => ({ ok: false, detalhe: String(e).slice(0, 100) }));
  const tel = (typeof ph === "string" ? ph : "").replace(/[^0-9+]/g, "");
  if (!/^\+?[1-9]\d{7,14}$/.test(tel)) {
    return { ok: false, motivo: `sem telefone de aviso para ${TENANT_PLATAFORMA} (cadastre via /api/notify-phone ou db/notify_phone.sql)` };
  }
  const para = tel.slice(0, 5) + "…";
  const corpo = `🚨 Guileo · ${kind}\n${summary}${link ? `\n${link}` : ""}`.slice(0, 600);
  const degraus = [];

  // 1 + 2) Meta Cloud API — a linha que já funciona na casa.
  const linha = await linhaCloud(env);
  if (linha) {
    const r1 = await sendWhatsApp(env, linha, tel, corpo).catch((e) => ({ ok: false, reason: String(e).slice(0, 80) }));
    if (r1 && r1.ok) return { ok: true, para, via: `cloud:${linha.display || linha.label}`, id: r1.id, degraus };
    degraus.push({ degrau: "cloud_texto", motivo: r1 && r1.raw ? motivoMeta(r1.raw) : (r1 && r1.reason) || "falhou" });
    const tpl = (env.OWNER_WA_TEMPLATE || "hello_world").toString();
    const r2 = await sendWhatsAppTemplate(env, linha, tel, tpl, env.OWNER_WA_TEMPLATE_LANG || "en_US").catch((e) => ({ ok: false, reason: String(e).slice(0, 80) }));
    if (r2 && r2.ok) return { ok: true, para, via: `cloud:template:${tpl}`, id: r2.id, degraus, nota: "fora da janela: foi o template fixo — o conteúdo está no e-mail" };
    degraus.push({ degrau: `cloud_template:${tpl}`, motivo: r2 && r2.raw ? motivoMeta(r2.raw) : (r2 && r2.reason) || "falhou" });
  } else degraus.push({ degrau: "cloud", motivo: "nenhuma linha de WhatsApp Cloud cadastrada" });

  // 3) Twilio, como era.
  const r3 = await sendText(env, tel, corpo, { channel: "whatsapp" });
  if (r3 && r3.sent) return { ok: true, para, via: "twilio", status: r3.status, degraus };
  degraus.push({ degrau: "twilio", motivo: (r3 && (r3.reason || `twilio http ${r3.status}`)) || "desconhecido" });
  return { ok: false, para, motivo: degraus.map((d) => `${d.degrau}: ${d.motivo}`).join(" · "), degraus };
}

// ── a porta única ───────────────────────────────────────────────────────────────────────────
// avisarDono(env, { kind, summary, detail?, cliente?, link?, payload?, chave? })
//   kind    — curto e estável: é a chave da trava e o assunto do e-mail ("canario_pay_links").
//   summary — uma frase em linguagem de negócio (é o que vai no WhatsApp).
//   chave   — sobrescreve a chave da trava (ex.: incluir o cliente afetado). Padrão: o kind.
//   semTrava — `true` pula a trava de 6h. Existe para o que NÃO é repetição de um mesmo alarme:
//     dois chamados urgentes do mesmo cliente em 6h são DOIS pedidos de socorro, e a trava (feita
//     para canário que dispara a cada 5 min) calava o segundo. É opção explícita, não truque na
//     chave: quem lê o chamador vê que a trava foi dispensada de propósito.
//   ignoraMudo — `true` deixa o E-MAIL sair com `emails_dono=off`, mas só para os kinds da lista
//     PODE_FURAR_MUDO (ver o silenciador). Em qualquer outro kind a opção é ignorada.
export async function avisarDono(env, { kind, summary, detail = "", cliente = "", link = "", payload = {}, chave = "", semTrava = false, ignoraMudo = false } = {}) {
  const k = (kind || "falha").toString().slice(0, 60);
  const s = (summary || "").toString().slice(0, 300);
  const chaveTrava = `dono:${(chave || k).toString().slice(0, 80)}:${baldeAtual()}`;
  const recibo = { kind: k, chave: chaveTrava, quando: new Date().toISOString() };
  try {
    const t = semTrava === true
      ? { pode: true, motivo: "trava dispensada pelo chamador (semTrava) — cada ocorrência avisa" }
      : await trava(env, chaveTrava);
    recibo.trava = t.motivo;
    if (!t.pode) { recibo.pulado = t.motivo; return recibo; }
    // Os três canais em paralelo e ISOLADOS: um canal caído não cala os outros.
    const [f, e, w] = await Promise.all([
      feed(env, { kind: k, summary: s, detail, cliente, payload }).catch((x) => ({ ok: false, motivo: String(x).slice(0, 100) })),
      email(env, { kind: k, summary: s, detail, cliente, link, ignoraMudo }).catch((x) => ({ ok: false, motivo: String(x).slice(0, 100) })),
      whatsapp(env, { kind: k, summary: s, link }).catch((x) => ({ ok: false, motivo: String(x).slice(0, 100) })),
    ]);
    recibo.feed = f; recibo.email = e; recibo.whatsapp = w;
    recibo.chegou = !!(e.ok || w.ok);
    // Uma linha estruturada no log: é o que sobra quando nem o feed nem o e-mail saíram.
    try { console.error(JSON.stringify({ avisarDono: k, feed: f.ok, email: e.ok, whatsapp: w.ok, motivos: [f.motivo, e.motivo, w.motivo].filter(Boolean) })); } catch { /* */ }
  } catch (e) {
    recibo.erro = String(e).slice(0, 160);
    try { console.error(JSON.stringify({ avisarDono: k, erro: recibo.erro })); } catch { /* */ }
  }
  return recibo;
}
