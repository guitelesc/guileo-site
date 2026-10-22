// Cloudflare Pages Function — POST /api/proactive?token=DIGEST_TOKEN  (called by the cron worker)
// The AUTONOMOUS engine (H2): Gui acts without being asked. TCPA-safe — reactivation goes by EMAIL
// (winbackCustomerEmail, na marca DO CLIENTE) to dormant customers who have an email; it never auto-dials.
// TODO e-mail de marketing daqui respeita email_suppressions (fail-closed) e leva link de descadastro
// + endereço postal do negócio (CAN-SPAM). Lembrete de horário é transacional e é a única exceção. Reminders for
// upcoming appointments are collected (biz_reminders_due) and emailed where an email exists (SMS lights
// up at A2P). Per-business; iterates the configured client list (PROACTIVE_EMAILS) or the demo set.
// Desde 2026-08-17 este arquivo também é a casa do PEDIDO DE AVALIAÇÃO (biz_review_due), o último dos
// três "motores mortos" — e o único que precisou nascer em vez de ser podado.
import { json, safeEq } from "../lib/guard.js";
import { sbKey, svcJson } from "../lib/sb.js";
import { entregarAviso } from "../lib/avisoPorTexto.js";
import { winbackCustomerEmail, appointmentReminderEmail, birthdayEmail, anniversaryEmail, recallEmail, loyaltyMilestoneEmail, welcomeFirstVisitEmail, rebookEmail, returnCycleEmail, promoEmail, moneyRecoveredEmail, reviewRequestEmail } from "../lib/emailTemplates.js";
import { brandFor } from "../lib/clientBrand.js";
import { unsubUrl } from "../lib/unsub.js";
import { visitaUrl, preferenciasUrl } from "../lib/visita.js";
import { servicoDeCuidado } from "../lib/preferencias.js";
import { motoresAtivos } from "./cron-tick.js";

// Data NO FUSO DA UNIDADE e no IDIOMA do cliente (2026-09-28). O fmtWhen abaixo formata em UTC com dia
// em português — "Ter 29/09 · 16:00" num e-mail em inglês pra um horário de 12:00 em Nova York.
const fmtLocal = (iso, tz, lang) => {
  try {
    const loc = lang === "pt" ? "pt-BR" : lang === "es" ? "es-US" : "en-US";
    return new Intl.DateTimeFormat(loc, { timeZone: tz || "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  } catch { return fmtWhen(iso); }
};
// Friendly date label from an ISO timestamp (UTC) — "Sex 20/06 · 14:30".
const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const fmtWhen = (iso) => { try { const d = new Date(iso); return `${DOW[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")} · ${d.toISOString().slice(11, 16)}`; } catch { return ""; } };

const SCHED_SB = "https://ynihodbknhjirkdogxby.supabase.co";
const SCHED_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const isEmail = (s) => /.+@.+\..+/.test((s || "").toString());
// After-hours heuristic on a captured event timestamp (UTC): call before 08:00, at/after 18:00, or on
// a weekend. Approximation (we don't hold the tenant's timezone) — feeds only the DISCLOSED estimate in
// moneyRecoveredEmail, never presented as cash. Mirrors growth-intel.js money_proof.
// (a régua de "fora do horário" agora mora na fila do relatório mensal, no fuso do negócio — db/relatorio_mensal_fila.sql)
// Customer emails go out in the CLIENT profile's language — pt / es / en supported (same rule as automations.js).
const langNorm = (v) => { const l = (v || "").toString().toLowerCase().slice(0, 2); return l === "pt" ? "pt" : l === "es" ? "es" : "en"; };

// ⚠️ FALHA VIRA `error`, NUNCA `{}` (2026-09-28). Isto era `.catch(() => ({}))`: 10 de 14 negócios
// recebiam `{}` a cada rodada, e `{}` sem `due` se lê "ninguém para lembrar" — o motor de lembrete
// NUNCA tinha mandado um e-mail na história da plataforma (max(reminded_at) = null) e o tique dizia 200.
// Agora a falha carrega o motivo e entra em rpcRecusou, que o tique expõe.
const rpc = (env, fn, body) => fetch(`${SCHED_SB}/rest/v1/rpc/${fn}`, {
  method: "POST", headers: { apikey: SCHED_ANON, Authorization: `Bearer ${SCHED_ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify({ ...body, p_secret: env.SCHED_SECRET || "" }),
}).then(async (r) => {
  const t = await r.text();
  try { const j = JSON.parse(t); return (!r.ok && j && typeof j === "object" && !j.error) ? { ...j, error: `http${r.status}` } : j; }
  catch { return { error: `nao_json_http${r.status}` }; }
}).catch((e) => ({ error: `rede:${String((e && e.message) || e).slice(0, 60)}` }));

// E-MAIL DE QUEM MARCOU POR TELEFONE (2026-09-28). Na ligação o agendamento guarda o BINA em
// customer_contact; o e-mail que a agente pede no fechamento mora no CRM. Sem esta ponte, o lembrete
// e o pedido de avaliação pulavam TODA reserva feita por voz ("sem e-mail") — que é quase todas.
// Cache por execução: o mesmo cliente aparece no lembrete e na avaliação.
const _emailCache = new Map();
async function emailDoContato(env, tenant, contato) {
  if (isEmail(contato)) return String(contato).trim();
  const fone = (contato || "").toString().replace(/[^0-9+]/g, "");
  if (fone.replace(/\D/g, "").length < 10) return "";
  const k = `${tenant}|${fone}`;
  if (_emailCache.has(k)) return _emailCache.get(k);
  let v = "";
  try { const r = await svcJson(env, "crm_contact_email", { p_secret: env.SCHED_SECRET || "", p_email: tenant, p_phone: fone }); v = isEmail(r) ? String(r) : ""; } catch { v = ""; }
  _emailCache.set(k, v);
  return v;
}

// The DATES/growth RPCs (marketing_*, crm_birthday_contacts, marketing_date_claim, db/growth_dates.sql)
// are INGEST-gated, not SCHED-gated — so they get the INGEST secret. Graceful: missing key → {} no-op.
const ingRpc = (env, fn, body) => fetch(`${SCHED_SB}/rest/v1/rpc/${fn}`, {
  method: "POST", headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
  body: JSON.stringify({ ...body, p_secret: env.INGEST_SECRET || "" }),
}).then((r) => r.json()).catch(() => ({}));

// "CHECAR RETORNO DE ENVIO" (auditoria A4, 2026-08-11): esta função disparava o fetch e devolvia
// `true` SEM olhar a resposta do Resend. Consequência real: um 4xx/5xx (quota, domínio, destinatário
// inválido) contava como enviado — o relatório do cron dizia "reminded: 12" com zero e-mail entregue,
// E, pior, o motor a montante já tinha marcado o lembrete como enviado / queimado o claim do
// aniversário. O cliente nunca recebia e o sistema jurava que sim. Agora só é sucesso com 2xx.
async function sendEmail(env, to, subject, html, marca = null) {
  if (!env.RESEND_API_KEY || !isEmail(to)) return false;
  try {
    // `marca` = { nome, responder }: o cliente do spa recebe "Natura Spa + Salon", e a resposta vai pro spa.
    const base = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
    const nome = marca && marca.nome ? String(marca.nome).replace(/["<>\r\n]/g, "").trim().slice(0, 60) : "";
    const from = nome && nome !== "Guileo" ? `${nome} <${(base.match(/<([^>]+)>/) || [])[1] || base}>` : base;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, ...(marca && isEmail(marca.responder) ? { reply_to: marca.responder } : {}) }),
    });
    return r.ok;
  } catch { return false; }
}

// ── PASSADA DE VISITAS (2026-09-28): lembrete + pedido de avaliação, de TODOS os negócios ─────────
// O laço antigo gastava ~10 chamadas por negócio antes do lembrete e o Worker estourava o teto de
// subrequests no 4º; os outros recebiam erro lido como "nada a fazer". Aqui a fila é UMA consulta
// global e só quem tem visita vencendo gasta chamada. TETO conservador abaixo do limite do Worker:
// o que não couber fica na fila (não é marcado) e sai no próximo tique.
async function passadaDeVisitas(env, { motoresOff }) {
  const TETO = 36;
  const textoPodeEstarLiberado = ["1", "true"].includes(String(env.SMS_A2P_APROVADO || "").toLowerCase()) || !!env.WHATSAPP_APP_SECRET;
  const out = { lembretes: 0, porTexto: 0, avaliacoes: 0, retornos: 0, retornoFalhou: 0, semEmail: 0, envioFalhou: 0, semLink: 0, suprimidos: 0, pausados: 0, adiados: 0, gasto: 0, erros: [] };
  const cabe = (n) => out.gasto + n <= TETO;
  const gasta = (n = 1) => { out.gasto += n; };
  const rem = await rpc(env, "biz_reminders_due_all", { p_hours: 26, p_limit: 60 }); gasta();
  if (rem && rem.error) out.erros.push(`lembrete:${rem.error}`);
  let rev = { due: [] };
  if (!motoresOff) { rev = await rpc(env, "biz_review_due_all", { p_after_hours: 3, p_max_days: 7, p_limit: 60 }); gasta(); if (rev && rev.error) out.erros.push(`avaliacao:${rev.error}`); }
  // "Me liga de volta" (retorno de orçamento): iniciativa nossa que DISCA → só com os motores ligados.
  let orc = { due: [] };
  if (!motoresOff) { orc = await rpc(env, "biz_quotes_due_all", { p_min_idade_min: 10, p_max_tentativas: 3, p_limit: 10 }); gasta(); if (orc && orc.error) out.erros.push(`retorno:${orc.error}`); }
  const lembrar = Array.isArray(rem?.due) ? rem.due : [];
  const avaliar = Array.isArray(rev?.due) ? rev.due : [];
  const retornar = Array.isArray(orc?.due) ? orc.due : [];
  if (!lembrar.length && !avaliar.length && !retornar.length) return out;
  let pausados = new Set();
  try { const autos = await ingRpc(env, "autonomy_all", {}); gasta(); if (Array.isArray(autos)) pausados = new Set(autos.filter((a) => a && a.level === "off").map((a) => (a.client_email || "").toLowerCase())); } catch { /* fail-open: e-mail é seguro */ }
  const ctx = new Map();
  const doNegocio = async (tenant, precisaMkt) => {
    let c = ctx.get(tenant);
    if (!c) {
      if (!cabe(4)) return null;
      const profile = (await ingRpc(env, "get_client_profile", { p_email: tenant })) || {}; gasta();
      const brand = await brandFor(env, tenant).catch(() => null); gasta(2);
      c = { profile, brand, L: langNorm(profile.lang), address: "", supressos: null, mktLido: false };
      ctx.set(tenant, c);
    }
    if (precisaMkt && !c.mktLido) {
      if (!cabe(2)) return null;
      c.mktLido = true;
      try { const a = await svcJson(env, "client_postal_address", { p_secret: env.INGEST_SECRET || "", p_client_email: tenant }); if (typeof a === "string") c.address = a.trim().slice(0, 200); } catch { /* */ } gasta();
      try { const sup = await svcJson(env, "email_suppressed_list", { p_secret: env.INGEST_SECRET || "", p_client_email: tenant }); if (Array.isArray(sup)) c.supressos = new Set(sup.map((x) => String(x).toLowerCase())); } catch { /* fail-closed abaixo */ } gasta();
    }
    return c;
  };
  for (const a of lembrar) {
    const tenant = String(a.tenant || "").toLowerCase();
    if (pausados.has(tenant)) { out.pausados++; continue; }
    const c = await doNegocio(tenant, false);
    if (!c || !cabe(3)) { out.adiados++; continue; }
    const para = await emailDoContato(env, tenant, a.contact); if (!isEmail(a.contact)) gasta();
    if (!para) {
      // SEM E-MAIL → TEXTO (2026-09-30). Quem marca por telefone quase nunca dá e-mail, e ficava
      // sem lembrete. Só tenta se algum canal de texto pode estar liberado (senão gastaria três
      // chamadas por pessoa para ouvir "A2P não aprovado"); as travas de verdade — aprovação,
      // STOP, horário — moram em avisoPorTexto.js. Adiado por horário NÃO é marcado: sai na
      // próxima passada (a rodada é de hora em hora).
      if (!textoPodeEstarLiberado || !cabe(5)) { out.semEmail++; continue; }
      if (c.fone === undefined) { c.fone = ""; try { const ag = await svcJson(env, "client_agent_resolve", { p_secret: env.INGEST_SECRET || "", p_email: tenant }); if (ag && ag.number) c.fone = String(ag.number); } catch { /* sem número do negócio: sai do remetente da plataforma */ } gasta(); }
      const av = await entregarAviso(env, { tenant, phone: a.contact, kind: "reminder", lang: c.L, tz: a.tz, de: c.fone,
        dados: { name: a.name, business: (c.brand && c.brand.business) || "", service: a.service || "", whenLabel: fmtLocal(a.when, a.tz, c.L), location: a.location || "", ref: a.ref || "" } }); gasta(3);
      if (av.sent) { out.lembretes++; out.porTexto++; await rpc(env, "biz_reminder_mark", { p_email: tenant, p_id: a.id, p_channel: av.canal }); gasta(); }
      else if (av.adiar) out.adiados++;
      else out.semEmail++;
      continue;
    }
    // "ainda dá tempo de contar como você prefere" (2026-10-05) — só serviço de cuidado; sem id, sem link
    const prefsUrl = a.id && servicoDeCuidado(a.service) ? await preferenciasUrl(env, tenant, a.id).catch(() => "") : "";
    const { subject, html } = appointmentReminderEmail({ name: a.name || "there", business: (c.brand && c.brand.business) || "", service: a.service || "", whenLabel: fmtLocal(a.when, a.tz, c.L), ref: a.ref || "", lang: c.L, bizEmail: tenant, brand: c.brand, address: c.address, prefsUrl });
    const ok = await sendEmail(env, para, subject, html, { nome: c.brand && c.brand.business, responder: tenant }); gasta();
    if (!ok) { out.envioFalhou++; continue; }
    out.lembretes++;
    await rpc(env, "biz_reminder_mark", { p_email: tenant, p_id: a.id, p_channel: "email" }); gasta();
  }
  for (const a of avaliar) {
    const tenant = String(a.tenant || "").toLowerCase();
    if (pausados.has(tenant)) { out.pausados++; continue; }
    const c = await doNegocio(tenant, true);
    if (!c || !cabe(3)) { out.adiados++; continue; }
    const geral = String(c.profile.review_link || "").trim();
    const porUnidade = c.profile.review_links && typeof c.profile.review_links === "object" ? c.profile.review_links : {};
    const link = (a.location && /^https:\/\//.test(String(porUnidade[a.location] || ""))) ? String(porUnidade[a.location]) : geral;
    if (!/^https:\/\//.test(link)) { out.semLink++; continue; }
    const para = await emailDoContato(env, tenant, a.contact); if (!isEmail(a.contact)) gasta();
    if (!para) { out.semEmail++; continue; }
    // Marketing: sem lista de supressão lida, NÃO manda (fail-closed, como o laço diário).
    if (!(c.supressos instanceof Set) || c.supressos.has(para.toLowerCase())) { out.suprimidos++; continue; }
    const unsub = await unsubUrl(env, "https://guileoai.com", tenant, para.toLowerCase()).catch(() => "");
    // O canal privado vai para TODOS, junto do mesmo link de avaliação (lib/visita.js) — não é desvio.
    const feedbackUrl = await visitaUrl(env, tenant, a.id).catch(() => "");
    const { subject, html } = reviewRequestEmail({ name: a.name || "there", business: (c.brand && c.brand.business) || "", service: a.service || "", link, lang: c.L, brand: c.brand, unsub, address: c.address, feedbackUrl });
    const ok = await sendEmail(env, para, subject, html, { nome: c.brand && c.brand.business, responder: tenant }); gasta();
    if (!ok) { out.envioFalhou++; continue; }
    out.avaliacoes++;
    await rpc(env, "biz_review_mark", { p_email: tenant, p_id: a.id, p_channel: "email" }); gasta();
  }
  // Mesmo portão de discagem de sempre (/api/call: DNC, destino +1/+55, tetos). A tentativa só é
  // carimbada se a ligação foi ACEITA — falha de rede não pode virar "já tentamos".
  // HORÁRIO DE LIGAR: a rodada é de hora em hora, dia e noite, e não sabemos o fuso de quem pediu o
  // orçamento. Mesma janela conservadora do reengajamento (cron-tick.js): 16:00–00:59 UTC ≈ 8h no
  // Pacífico até 21h no Leste. Fora dela o pedido fica para a próxima rodada — não é carimbado.
  const horaUtc = new Date().getUTCHours();
  const horaDeLigar = horaUtc >= 16 || horaUtc === 0;
  for (const q of retornar) {
    const tenant = String(q.tenant || "").toLowerCase();
    if (!horaDeLigar) { out.adiados++; continue; }
    if (pausados.has(tenant)) { out.pausados++; continue; }
    if (!q.phone || !cabe(2)) { out.adiados++; continue; }
    let ligou = false;
    try {
      // O portão exige Origin do próprio site, e só o cabeçalho interno faz a ligação sair como a
      // agente DO NEGÓCIO (2026-10-01: sem os dois, toda tentativa voltava 403 e nada discava).
      const cr = await fetch("https://guileoai.com/api/call", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://guileoai.com", "x-guileo-internal": env.DIGEST_TOKEN || "" },
        body: JSON.stringify({ phone: q.phone, client_email: tenant, motivo: "orcamento", servico: q.servico, lang: q.lang || "en" }) }); gasta();
      const cd = await cr.json().catch(() => ({}));
      ligou = cr.ok && cd.ok !== false;
      if (!ligou) out.erros.push(`retorno-ligacao:${cd.reason || cd.error || cr.status}`);
    } catch { out.erros.push("retorno-ligacao:rede"); }
    if (ligou) { out.retornos++; await rpc(env, "biz_quote_mark", { p_email: tenant, p_id: q.id, p_tentou: true }); gasta(); }
    else out.retornoFalhou++;
  }
  return out;
}

// ── RELATÓRIO MENSAL DE VALOR (2026-09-30): o mês que FECHOU, para o dono ─────────────────────
// A fila (db/relatorio_mensal_fila.sql) devolve quem ainda não recebeu o mês anterior, com os
// números já contados no fuso do negócio e só do `live_desde` em diante.
// MESMA BARRA DE ANTES para mandar: dinheiro recebido OU agendamento de verdade no mês. Só ligação
// não dispara e-mail — senão todo prospect com linha de demonstração receberia "você recuperou $X".
// Mês sem nada a mostrar é carimbado sem envio (o mês acabou; não há o que esperar).
// Com envio: carimbo só DEPOIS do Resend aceitar — falhou, fica na fila de amanhã (dias 1 a 7).
async function passadaDoRelatorioMensal(env, { soTenant = "", agora = null } = {}) {
  const TETO = 40;
  const out = { enviados: 0, semDado: 0, naFila: 0, envioFalhou: 0, carimboFalhou: 0, pausados: 0, adiados: 0, gasto: 0, erros: [] };
  const cabe = (n) => out.gasto + n <= TETO;
  const gasta = (n = 1) => { out.gasto += n; };
  const fila = await svcJson(env, "value_report_due_all", { p_secret: env.SCHED_SECRET || "", p_limit: 8, p_so_tenant: soTenant || null, p_agora: agora }); gasta();
  if (!fila || fila.ok !== true || !Array.isArray(fila.due)) { out.erros.push(`fila:${(fila && (fila.erro_http || fila.reason || fila.detalhe)) || "resposta ilegível"}`); return out; }
  out.naFila = fila.due.length;
  if (!fila.due.length) return out;
  let pausados = new Set();
  try { const autos = await ingRpc(env, "autonomy_all", {}); gasta(); if (Array.isArray(autos)) pausados = new Set(autos.filter((a) => a && a.level === "off").map((a) => (a.client_email || "").toLowerCase())); } catch { /* fail-open */ }
  const ML = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (const r of fila.due) {
    const tenant = String(r.tenant || "").toLowerCase();
    if (!isEmail(tenant) || !/^\d{4}-\d{2}$/.test(String(r.period || ""))) continue;
    if (pausados.has(tenant)) { out.pausados++; continue; }
    const carimbar = async () => { const c = await ingRpc(env, "marketing_date_claim", { p_client_email: tenant, p_kind: "value_report", p_ref: "owner", p_period: r.period }); gasta(); return c === true; };
    const cents = Math.max(0, Math.round(Number(r.collected_cents) || 0));
    const agend = Math.max(0, Math.round(Number(r.bookings) || 0));
    if (!(cents > 0 || agend > 0)) {
      if (!cabe(1)) { out.adiados++; continue; }
      out.semDado++; if (!(await carimbar())) out.carimboFalhou++;
      continue;
    }
    if (!cabe(4)) { out.adiados++; continue; }
    const brand = await brandFor(env, tenant).catch(() => null); gasta(2);
    const [ano, mes] = String(r.period).split("-").map(Number);
    const { subject, html } = moneyRecoveredEmail({ business: (brand && brand.business) || "", logo: brand && brand.logo_url, brandColor: brand && brand.accent,
      month: `${ML[mes - 1]} ${ano}`, callsAfterHours: r.calls_after_hours, bookings: agend, collectedCents: cents, noShowsPrevented: 0, remindersSent: r.reminders, lang: brand && brand.lang });
    const ok = await sendEmail(env, tenant, subject, html); gasta();
    if (!ok) { out.envioFalhou++; continue; }
    out.enviados++;
    if (!(await carimbar())) out.carimboFalhou++;
  }
  return out;
}

// ── PASSADA DE RELACIONAMENTO (2026-09-30): a volta no tempo certo + o aniversário ───────────────
// Uma fila global (db/relacionamento_fila.sql) em vez de duas consultas por negócio dentro do laço
// diário, que estoura o teto de subrequests no 3º negócio. A fila já vem com o E-MAIL resolvido pelo
// CRM — quem marcou por telefone entra, que é quase toda reserva de voz.
// O carimbo (marketing_date_claim, o mesmo livro de sempre) só é gravado DEPOIS do envio aceito:
// quem não pôde receber hoje continua na fila até a janela de 21 dias fechar.
// `soTenant` restringe a um negócio — é como a prova roda num tenant de teste sem tocar nos outros.
async function passadaDeRelacionamento(env, { soTenant = "" } = {}) {
  const TETO = 40;
  const out = { voltas: 0, aniversarios: 0, naFila: 0, semEmail: 0, suprimidos: 0, envioFalhou: 0, carimboFalhou: 0, pausados: 0, adiados: 0, gasto: 0, erros: [] };
  const cabe = (n) => out.gasto + n <= TETO;
  const gasta = (n = 1) => { out.gasto += n; };
  const fila = await svcJson(env, "relacionamento_due_all", { p_secret: env.SCHED_SECRET || "", p_limit: 60, p_so_tenant: soTenant || null }); gasta();
  // Recusa do banco NUNCA vira "ninguém para chamar de volta" — é um erro com nome.
  if (!fila || !Array.isArray(fila.due)) { out.erros.push(`fila:${(fila && (fila.erro_http || fila.detalhe)) || JSON.stringify(fila || null).slice(0, 60)}`); return out; }
  out.naFila = fila.due.length;
  if (!fila.due.length) return out;
  let pausados = new Set();
  try { const autos = await ingRpc(env, "autonomy_all", {}); gasta(); if (Array.isArray(autos)) pausados = new Set(autos.filter((a) => a && a.level === "off").map((a) => (a.client_email || "").toLowerCase())); } catch { /* fail-open: e-mail é seguro */ }
  const ctx = new Map();
  const doNegocio = async (tenant) => {
    let c = ctx.get(tenant);
    if (c) return c;
    if (!cabe(6)) return null;
    const profile = (await ingRpc(env, "get_client_profile", { p_email: tenant })) || {}; gasta();
    const brand = await brandFor(env, tenant).catch(() => null); gasta(2);
    c = { profile, brand, L: langNorm(profile.lang), address: "", supressos: null, fone: "" };
    try { const a = await svcJson(env, "client_postal_address", { p_secret: env.INGEST_SECRET || "", p_client_email: tenant }); if (typeof a === "string") c.address = a.trim().slice(0, 200); } catch { /* */ } gasta();
    try { const sup = await svcJson(env, "email_suppressed_list", { p_secret: env.INGEST_SECRET || "", p_client_email: tenant }); if (Array.isArray(sup)) c.supressos = new Set(sup.map((x) => String(x).toLowerCase())); } catch { /* fail-closed abaixo */ } gasta();
    // A linha que atende (a agente): quem prefere ligar tem o número no próprio e-mail.
    try { const ag = await svcJson(env, "client_agent_resolve", { p_secret: env.INGEST_SECRET || "", p_email: tenant }); if (ag && ag.number) c.fone = String(ag.number); } catch { /* sem número, sem linha de telefone */ } gasta();
    ctx.set(tenant, c);
    return c;
  };
  for (const a of fila.due) {
    const tenant = String(a.tenant || "").toLowerCase();
    if (!tenant.includes("@")) continue;
    if (pausados.has(tenant)) { out.pausados++; continue; }
    if (!a.tem_email || !isEmail(a.email)) { out.semEmail++; continue; }
    const c = await doNegocio(tenant);
    if (!c || !cabe(2)) { out.adiados++; continue; }
    const para = String(a.email).toLowerCase();
    // Marketing: sem lista de supressão lida, NÃO manda (fail-closed, como todo o resto da casa).
    if (!(c.supressos instanceof Set) || c.supressos.has(para)) { out.suprimidos++; continue; }
    const unsub = await unsubUrl(env, "https://guileoai.com", tenant, para).catch(() => "");
    const negocio = (c.brand && c.brand.business) || "";
    const primeiro = String(a.name || "").trim().split(/\s+/)[0] || "there";
    const { subject, html } = a.kind === "birthday"
      ? birthdayEmail({ name: primeiro, business: negocio, lang: c.L, brand: c.brand, unsub, address: c.address, message: a.message || "", offer: a.offer || "" })
      : returnCycleEmail({ name: primeiro, business: negocio, service: a.service || "", days: a.ciclo || 28, lang: c.L, bizEmail: tenant, brand: c.brand, unsub, address: c.address, phone: c.fone });
    const ok = await sendEmail(env, para, subject, html, { nome: negocio, responder: tenant }); gasta();
    if (!ok) { out.envioFalhou++; continue; }
    if (a.kind === "birthday") out.aniversarios++; else out.voltas++;
    const carimbo = await ingRpc(env, "marketing_date_claim", { p_client_email: tenant, p_kind: a.kind === "birthday" ? "birthday" : "rebook", p_ref: String(a.ref || ""), p_period: String(a.period || "-") }); gasta();
    // O e-mail JÁ saiu. Carimbo que falha = a pessoa recebe de novo amanhã: vira número visível.
    if (carimbo !== true) out.carimboFalhou++;
  }
  return out;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  // PROVA ESCOPADA: `?apenas=relacionamento&so=<negócio>` com o segredo de servidor no cabeçalho roda
  // a passada para UM negócio (o de teste). Sem `so` este atalho não existe — a rodada de todos os
  // negócios continua exigindo o token do cron.
  const soTenant = (url.searchParams.get("so") || "").trim().toLowerCase();
  if (url.searchParams.get("apenas") === "relacionamento" && soTenant.includes("@") && env.INGEST_SECRET
      && safeEq(request.headers.get("x-guileo-secret") || "", env.INGEST_SECRET)) {
    if (!env.SCHED_SECRET) return json({ ok: false, ready: false, error: "scheduling not configured" });
    const r = await passadaDeRelacionamento(env, { soTenant }).catch((e) => ({ erros: [`passada:${String(e).slice(0, 80)}`] }));
    return json({ ok: !(r.erros && r.erros.length), relacionamento: r });
  }
  // Mesma prova escopada para o relatório mensal. `agora` só vale aqui (simular "dia 1 do mês").
  if (url.searchParams.get("apenas") === "relatorio-mensal" && soTenant.includes("@") && env.INGEST_SECRET
      && safeEq(request.headers.get("x-guileo-secret") || "", env.INGEST_SECRET)) {
    if (!env.SCHED_SECRET) return json({ ok: false, ready: false, error: "scheduling not configured" });
    const quando = url.searchParams.get("agora");
    const r = await passadaDoRelatorioMensal(env, { soTenant, agora: quando && !Number.isNaN(Date.parse(quando)) ? new Date(quando).toISOString() : null }).catch((e) => ({ erros: [`passada:${String(e).slice(0, 80)}`] }));
    return json({ ok: !(r.erros && r.erros.length), relatorio_mensal: r });
  }
  if (!env.DIGEST_TOKEN || !safeEq(url.searchParams.get("token") || "", env.DIGEST_TOKEN)) return json({ error: "forbidden" }, 401);
  // ── `?apenas=lembretes` — A PASSADA DE HORA EM HORA (2026-08-16) ─────────────────────────────
  // Este endpoint roda 1×/dia (13h/14h UTC) e faz MUITO mais que lembrete: aniversário, win-back,
  // NPS, rebooking. Rodá-lo de hora em hora viraria spam na caixa de quem paga.
  // Mas manter só o diário deixa um buraco que ninguém veria: reserva criada às 14h para o dia
  // seguinte às 10h nunca cai em janela nenhuma — a próxima rodada é às 13h, DEPOIS do horário.
  // O cliente simplesmente não é lembrado, e o no-show é lido como "cliente que não apareceu".
  // Com este modo, o cron chama de hora em hora só a parte transacional (lembrete de horário
  // marcado, que a pessoa PEDIU), e o marketing continua uma vez por dia.
  const soLembretes = url.searchParams.get("apenas") === "lembretes";
  // ── INTERRUPTOR GERAL (auditoria de lançamento, 2026-09-22) ──────────────────────────────────
  // Lido AQUI e não só no cron: o cron deixar de chamar não impede ninguém de chamar à mão com o
  // token. Desligado, a rodada completa se recusa inteira (`desligado:true`).
  // A passada `?apenas=lembretes` CONTINUA — lembrete de horário já marcado é transacional — mas
  // passa a fazer SÓ isso. E aqui mora um achado: "só lembretes" nunca foi só lembretes. O
  // `if (soLembretes) continue` fica DEPOIS do relatório de valor, do win-back, do churn-save e do
  // retorno de orçamento (que DISCA), e o bloco cross-tenant do fim (VIP + nutrição de lead) nem
  // olha a flag. Com os motores ligados nada disso muda (são deduplicados e o retorno de orçamento
  // depende dessa cadência); com eles desligados, `motoresOff` pula todos.
  const motoresOff = !(await motoresAtivos(env));
  if (motoresOff && !soLembretes) return json({ ok: true, desligado: true, motivo: "motores_proativos=off — nenhuma mensagem saiu (lembrete de horário segue em ?apenas=lembretes)" });
  if (!env.SCHED_SECRET) return json({ ok: true, note: "scheduling not configured" });
  // `?apenas=relacionamento` — a volta e o aniversário, numa chamada SÓ DELES (orçamento de
  // subrequests inteiro). É iniciativa nossa: obedece ao interruptor geral (já conferido acima).
  if (url.searchParams.get("apenas") === "relacionamento") {
    const r = await passadaDeRelacionamento(env, {}).catch((e) => ({ erros: [`passada:${String(e).slice(0, 80)}`] }));
    return json({ ok: !(r.erros && r.erros.length), relacionamento: r });
  }
  if (url.searchParams.get("apenas") === "relatorio-mensal") {
    const r = await passadaDoRelatorioMensal(env, {}).catch((e) => ({ erros: [`passada:${String(e).slice(0, 80)}`] }));
    return json({ ok: !(r.erros && r.erros.length), relatorio_mensal: r });
  }
  // A passada de visitas roda PRIMEIRO, com o orçamento de subrequests ainda inteiro.
  const visitas = soLembretes ? await passadaDeVisitas(env, { motoresOff }).catch((e) => ({ erros: [`passada:${String(e).slice(0, 80)}`] })) : null;

  // Enumerate live tenants dynamically (same INGEST-gated clients_list RPC nps.js/health-monitor.js
  // use) so every new client joins the birthday/rebooking/dates engines on their own — no env edit.
  // Fallback to the configured env list (or the demo pair) if the RPC is empty/unavailable.
  const envList = (env.PROACTIVE_EMAILS || "clinica@teste.com,salao@teste.com").split(",").map((s) => s.trim()).filter(Boolean);
  const roster = await ingRpc(env, "clients_list", {});
  const listed = (Array.isArray(roster) ? roster : []).map((c) => ((c && c.client_email) || "").toString().trim().toLowerCase()).filter((e) => e.includes("@"));
  const allBizRaw = listed.length ? [...new Set(listed)] : envList;
  // AUTONOMY GUARDRAIL — the owner can pause a client's autonomous actions (level='off'). We read all
  // overrides once (autonomy_all) and SKIP the 'off' tenants; unset/'safe'/'full' still act (email is
  // safe). Money/voice/SMS are NEVER auto here regardless of level — this engine is email-only.
  let offSet = new Set();
  try {
    const autos = await ingRpc(env, "autonomy_all", {});
    if (Array.isArray(autos)) offSet = new Set(autos.filter((a) => a && a.level === "off").map((a) => (a.client_email || "").toLowerCase()));
  } catch { /* fail-open to 'safe' — an autonomy read error must not silently pause everyone */ }
  const allBiz = allBizRaw.filter((e) => !offSet.has(e));
  // ROTATING OFFSET — start the sweep at index (day-of-year % len) so a run that hits the per-run
  // send cap doesn't always starve the SAME tail of the roster; over a week every tenant gets served.
  const doy = Math.floor((Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 0)) / 86400000);
  const off = allBiz.length ? doy % allBiz.length : 0;
  const businesses = off ? [...allBiz.slice(off), ...allBiz.slice(0, off)] : allBiz;
  // PER-RUN SEND CAP — one cron tick sends at most MAX_SENDS emails total (protects the Resend quota
  // and stops a huge roster from timing out mid-sweep). capSend() closes over the counter; once the
  // cap is hit every further send is a no-op and the outer loop breaks.
  const MAX_SENDS = 40;
  let sends = 0;
  const capSend = async (to, subject, html) => {
    if (sends >= MAX_SENDS) return false;
    const ok = await sendEmail(env, to, subject, html);
    if (ok) sends++;
    return ok;
  };
  // Onde o lembrete para, por etapa (2026-09-28): "0 lembrados" sozinho não diz se não havia nada
  // vencendo, se faltou e-mail ou se o Resend recusou — as três caras eram idênticas.
  const lembreteDiag = { tenantsVistos: 0, vencidos: 0, semEmail: 0, envioFalhou: 0, formatos: {} };
  let reactivated = 0, reminded = 0, birthdays = 0, anniversaries = 0, recalls = 0, loyalty = 0, welcomes = 0, rebooks = 0;
  // retornos de orçamento disparados nesta rodada (motor novo de 2026-08-17)
  let orcamentosRetornados = 0;
  // MOTOR DE AVALIAÇÃO (2026-08-17). `semLinkReview` não é estatística: é a lista de tenants cujo
  // motor está PARADO por falta do link de avaliação no cadastro. Sem ela, zero pedidos leria como
  // "nenhuma visita" — o mesmo fallback silencioso que deixou três motores mortos rodando 96×/dia.
  let reviewsAsked = 0, reviewMarcaFalhou = 0;
  const semLinkReview = [];
  // Recusas do banco (segredo/permissão) por motor+tenant. Nunca some dentro de um `|| []`.
  const rpcRecusou = [];
  // DATES + GROWTH (db/growth_dates.sql): crm_contacts.birth_date birthdays, per-client commemorative
  // dates (biz_marketing_dates), and post-service rebooking nudges. All dedup atomically; EMAIL now.
  let crmBirthdays = 0, marketingDates = 0, rebookNudges = 0;
  // MONTHLY VALUE EMAIL to the OWNER — counted separately from customer sends.
  let valueReports = 0;
  const yr = String(new Date().getUTCFullYear());

  for (const email of businesses) {
    if (sends >= MAX_SENDS) break; // per-run cap reached — the rotating offset serves the rest next run
    // Per-tenant language — every lifecycle email below renders in the CLIENT profile's language (was hardcoded).
    const profile = (await ingRpc(env, "get_client_profile", { p_email: email })) || {};
    const L = langNorm(profile.lang);

    // ── CONFORMIDADE + MARCA (auditoria A4, 2026-08-11) ─────────────────────────────────────
    // Tudo daqui pra baixo é e-mail para o CLIENTE DO CLIENTE. Faltavam três coisas, e as três
    // batem no mesmo lugar: a reputação de envio COMPARTILHADA (um remetente para todos os tenants).
    //  1. SUPRESSÃO: quem clicou "descadastrar" numa campanha continuava recebendo aniversário,
    //     promoção de data comemorativa, recall e win-back — porque só coupons.js consultava a
    //     lista. Um opt-out que não vale para todos os motores não é opt-out; é spam com botão.
    //  2. LINK DE DESCADASTRO: nenhum destes e-mails tinha um. CAN-SPAM exige um mecanismo claro.
    //  3. MARCA: iam com a casca da GUILEO e rodapé "you started with Guileo" — falso para quem
    //     nunca ouviu falar da Guileo, e some com a marca pela qual o dono paga. Agora vão com
    //     logo/cor/nome do negócio e o endereço postal dele.
    const brand = await brandFor(env, email).catch(() => null);
    let address = "";
    try {
      const a = await svcJson(env, "client_postal_address", { p_secret: env.INGEST_SECRET || "", p_client_email: email });
      if (typeof a === "string" && a.trim()) address = a.trim().slice(0, 200);
    } catch { /* endereço ausente nunca bloqueia o sweep */ }
    // Lista de supressão do tenant. FAIL-CLOSED: se a leitura falhar, NÃO mandamos marketing nesta
    // volta — reenviar para quem pediu descadastro custa mais caro que atrasar um aniversário.
    let supressos = null;
    try {
      const sup = await svcJson(env, "email_suppressed_list", { p_secret: env.INGEST_SECRET || "", p_client_email: email });
      if (Array.isArray(sup)) supressos = new Set(sup.map((x) => String(x).toLowerCase()));
    } catch { /* supressos fica null → marketing pula este tenant nesta volta */ }
    // podeMkt = destinatário válido E não suprimido. Lembrete de horário é TRANSACIONAL (a pessoa
    // marcou; não é marketing) → usa isEmail direto, exceção legítima e explícita.
    const podeMkt = (to) => isEmail(to) && supressos instanceof Set && !supressos.has(String(to).trim().toLowerCase());
    const unsubDe = (to) => unsubUrl(env, "https://guileoai.com", email, String(to || "").toLowerCase()).catch(() => "");
    // QUEM MARCOU POR TELEFONE TAMBÉM É CLIENTE (2026-09-30). As campanhas abaixo testavam o
    // `contact` do agendamento direto — e na reserva por voz esse campo é o NÚMERO. Resultado:
    // boas-vindas, fidelidade, recall e win-back pulavam quase todo mundo que ligou. `destino`
    // resolve o e-mail pelo CRM (emailDoContato, com cache) e só devolve quem pode receber.
    const destino = async (contato) => { const e = await emailDoContato(env, email, contato); return podeMkt(e) ? e : ""; };

    // Tudo dentro deste bloco é iniciativa NOSSA (ninguém pediu): obedece ao interruptor geral.
    if (!motoresOff) {
    // O RELATÓRIO MENSAL DE VALOR saiu daqui em 2026-09-30 → `passadaDoRelatorioMensal` (fila global,
    // mês FECHADO, fuso do negócio, respeitando o live_desde). Aqui ele reservava o mês no primeiro
    // dia com qualquer dado e mandava um relatório de 1–2 dias.

    // #9 churn-save — email a branded win-back to customers dormant 60+ days (only those with an email).
    // TCPA-safe: NEVER auto-dials; email only.
    const dorm = await rpc(env, "biz_dormant_customers", { p_email: email, p_days: 60, p_limit: 25 });
    for (const c of (dorm?.dormant || [])) {
      const para = await destino(c.contact); if (!para) continue;
      const { subject, html } = winbackCustomerEmail({ name: c.name || "there", business: (brand && brand.business) || "", lang: L, bizEmail: email, brand, unsub: await unsubDe(para), address });
      if (await capSend(para, subject, html)) {
        reactivated++;
        // FIX (audit HIGH): log a winback event so (a) the churn block below dedups against it in the
        // SAME run (no double reengageEmail to a dormant+at-risk customer), and (b) biz_dormant_customers
        // — now filtered on this same winback — won't re-email daily. One shared dedup ledger.
        await ingRpc(env, "ingest_client_event", { p_email: email, p_type: "winback", p_channel: "email",
          p_summary: `♻️ Reativação (dormente 60d) → ${c.name || "cliente"}`.slice(0, 300), p_amount: 0,
          p_payload: { contact: para.toLowerCase(), kind: "dormant" } });
      }
    }

    // CHURN-SAVE (cadence-based, SMARTER than the flat 60-day dormant): catches a LOYAL customer who
    // broke THEIR own rhythm (3× past their usual cadence) BEFORE they go fully dormant. Email-only,
    // TCPA-safe (never auto-dials). churn_reengage_candidates refreshes scores + returns only emailable
    // high-risk NOT reengaged in 30d (deduped vs the winback event we log below). Same cap/rotation.
    const churn = await ingRpc(env, "churn_reengage_candidates", { p_email: email, p_limit: 15 });
    for (const c of (Array.isArray(churn) ? churn : [])) {
      if (!podeMkt(c.email)) continue;
      const { subject, html } = winbackCustomerEmail({ name: c.name || "there", business: (brand && brand.business) || "", lang: L, bizEmail: email, brand, unsub: await unsubDe(c.email), address });
      if (await capSend(c.email, subject, html)) {
        reactivated++;
        // log the winback so the next sweep dedupes this contact for 30d (payload.contact = email)
        await ingRpc(env, "ingest_client_event", { p_email: email, p_type: "winback", p_channel: "email",
          p_summary: `♻️ Gui reativou ${c.name || "cliente"} (risco ${c.risk}%) por email`.slice(0, 300),
          p_amount: 0, p_payload: { contact: (c.email || "").toLowerCase(), kind: "churn", risk: c.risk } });
      }
    }

    // ── LEMBRETE: LISTAR → ENVIAR → MARCAR SÓ QUEM RECEBEU (2026-08-16) ────────────────────────
    // A RPC antiga (`biz_due_reminders`) fazia SELECT e logo em seguida `update ... set reminded=true`
    // para TODOS os vencendo — antes de qualquer envio. E o laço abaixo pula quem não tem e-mail.
    // Resultado: contato por TELEFONE saía marcado como lembrado e nunca era lembrado, para sempre.
    // Não era um caso raro: é o caminho do GUI-42F0, o primeiro agendamento real da plataforma.
    // Marcar antes de fazer é a mesma família de "sucesso sem comprovante" que me perseguiu o dia
    // inteiro — só que aqui o registro falso apaga a segunda chance.
    //
    // Agora são duas RPCs: `biz_reminders_due` só LÊ, e `biz_reminder_mark` carimba UMA linha
    // depois de o envio ter sido confirmado. Quem não pôde ser lembrado continua na fila da próxima
    // rodada — e a rodada agora é DE HORA EM HORA (ver cron-tick), com janela de 26h.
    // A janela de 24h com rodada diária tinha um buraco silencioso: reserva criada DEPOIS da rodada
    // do dia para o dia seguinte nunca caía em janela nenhuma. As 2h a mais cobrem a folga.
    // ── RETORNO DE ORÇAMENTO (2026-08-17) ───────────────────────────────────────────────────────
    // Fecha a promessa que a agente faz quando não tem o preço: "deixa eu confirmar e já te
    // retorno". Até hoje essa frase morria na conversa — o telefone entrava no CRM sem serviço e
    // sem motivo, e ninguém retornava. Agora a fila `biz_quote_requests` guarda QUEM pediu O QUÊ,
    // e a Gui liga de volta pelo mesmo portão de discagem de sempre (/api/call: DNC + tetos).
    //
    // ⚠️ ESPERA 10 MINUTOS ANTES DE LIGAR. A conversa pode continuar e virar agendamento sozinha;
    // ligar em cima de quem ainda está digitando é a pior primeira impressão possível.
    // ⚠️ E A TENTATIVA SÓ É CARIMBADA SE A LIGAÇÃO FOI ACEITA. Marcar antes transformaria falha de
    // rede em "já tentamos 3 vezes" e a pessoa nunca mais receberia retorno — o defeito que este
    // arquivo inteiro existe para não cometer.
    // 2026-09-28: o retorno de orçamento saiu daqui para a passada de visitas (fila global, de hora em
    // hora). Aqui ele estourava o teto de subrequests a partir do 4º negócio e ninguém era retornado.
    const orc = { due: [] };
    if (orc && orc.error) rpcRecusou.push(`orcamento:${email}:${orc.error}`);
    for (const q of (orc?.due || [])) {
      if (!q.phone) continue;
      let ligou = false;
      try {
        const cr = await fetch(`${url.origin}/api/call`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: q.phone, client_email: email, motivo: "orcamento", servico: q.servico, lang: q.lang || "en" }),
        });
        const cd = await cr.json().catch(() => ({}));
        ligou = cr.ok && cd.ok !== false;
        if (!ligou) rpcRecusou.push(`orcamento-ligacao:${email}:${(cd.reason || cd.error || cr.status)}`);
      } catch (e) { rpcRecusou.push(`orcamento-ligacao:${email}:rede`); }
      if (ligou) {
        orcamentosRetornados++;
        await rpc(env, "biz_quote_mark", { p_email: email, p_id: q.id, p_tentou: true });
      }
    }

    } // fim do bloco que obedece ao interruptor geral — daqui para baixo é o LEMBRETE (transacional)

    lembreteDiag.tenantsVistos++;
    // Na passada horária o lembrete JÁ saiu pela passada de visitas (fila global) — não gastar de novo.
    const rem = soLembretes ? { due: [] } : await rpc(env, "biz_reminders_due", { p_email: email, p_hours: 26, p_limit: 50 });
    // mesma guarda do motor de avaliação: recusa do banco não pode virar "ninguém para lembrar".
    // Este é o motor mais caro de todos para falhar em silêncio — lembrete que não sai é falta.
    if (rem && rem.error) rpcRecusou.push(`lembrete:${email}:${rem.error}`);
    lembreteDiag.vencidos += (rem?.due || []).length;
    { const f = rem && typeof rem === "object" ? (Array.isArray(rem) ? "array" : Object.keys(rem).sort().join(",") || "{}") : typeof rem;
      lembreteDiag.formatos[f] = (lembreteDiag.formatos[f] || 0) + 1; }
    for (const a of (rem?.due || [])) {
      // Sem e-mail não há como lembrar hoje (o SMS está preso no A2P) — e por isso NÃO marcamos:
      // no dia em que o A2P sair, ou em que o cliente der o e-mail, esta pessoa ainda está na fila.
      const para = await emailDoContato(env, email, a.contact);
      if (!para) { lembreteDiag.semEmail++; continue; }
      const prefsUrl = a.id && servicoDeCuidado(a.service) ? await preferenciasUrl(env, email, a.id).catch(() => "") : "";
      const { subject, html } = appointmentReminderEmail({ name: a.name || "there", business: (brand && brand.business) || "", service: a.service || "", whenLabel: fmtWhen(a.when), ref: a.ref || "", lang: L, bizEmail: email, brand, address, prefsUrl });
      if (!(await capSend(para, subject, html))) lembreteDiag.envioFalhou++;
      else {
        reminded++;
        // só agora. Se o carimbo falhar, o pior caso é um lembrete repetido — muito melhor que
        // um lembrete que nunca sai porque foi dado como enviado.
        await rpc(env, "biz_reminder_mark", { p_email: email, p_id: a.id, p_channel: "email" });
      }
    }

    // Na passada horária o trabalho acaba aqui: daqui para baixo é MARKETING (aniversário,
    // win-back, NPS, rebooking), e marketing tem cadência diária de propósito.
    if (soLembretes) continue;

    // ── PEDIDO DE AVALIAÇÃO (motor novo, 2026-08-17 — db/motor_review.sql) ────────────────────
    // O semáforo acusava `due_review_requests` como motor morto. Ao abrir, não era um motor
    // quebrado: era um motor que NUNCA existiu — sem RPC, sem template, sem chamador. Os outros
    // dois mortos (lembrete e win-back) eram duplicatas do que ESTE arquivo já fazia certo, e
    // foram removidos do automations.js; só este virou código novo.
    //
    // Por que aqui e não lá: review é o motor que devolve lead pela ENTRADA (mais avaliação →
    // melhor posição no Maps → mais ligação, que a Gui já atende). Mora junto dos outros e-mails
    // de ciclo de vida, com a mesma marca, a mesma supressão e o mesmo teto de envio.
    //
    // SEM LINK DE AVALIAÇÃO NÃO HÁ E-MAIL — e isso APARECE. Mandar "avalie a gente" sem lugar para
    // avaliar é pior que não mandar, e um contador zerado leria como "ninguém para pedir" quando
    // na verdade falta um campo no cadastro do cliente.
    const reviewLink = (profile.review_link || "").toString().trim();
    if (!reviewLink) {
      semLinkReview.push(email);
    } else {
      const rv = await rpc(env, "biz_review_due", { p_email: email, p_after_hours: 3, p_max_days: 7, p_limit: 50 });
      // ⚠️ `rv?.due || []` SOZINHO recria o defeito que este trabalho veio matar. Segredo errado
      // devolve {"error":"unauthorized"} — sem campo `due` — e o `|| []` transformaria "o banco me
      // recusou" em "nenhuma visita para pedir avaliação". Motor parado com cara de dia parado é
      // exatamente como os três morreram sem ninguém notar. Recusa é um número separado.
      if (rv && rv.error) rpcRecusou.push(`review:${email}:${rv.error}`);
      for (const a of (rv?.due || [])) {
        // Reserva por voz guarda o telefone — o e-mail vem do CRM (emailDoContato).
        const para = await emailDoContato(env, email, a.contact);
        if (!para) continue;
        // Marketing: respeita a lista de supressão (o lembrete não respeitava porque é transacional).
        if (!podeMkt(para)) continue;
        // LINK DA UNIDADE ONDE A PESSOA FOI (2026-09-28): a Natura tem 3 fichas no Google; a Med Spa
        // tinha 18 avaliações e nunca recebia nenhuma porque todo pedido ia pro link de Astoria.
        const porUnidade = profile.review_links && typeof profile.review_links === "object" ? profile.review_links : {};
        const linkDaVisita = (a.location && /^https:\/\//.test(String(porUnidade[a.location] || ""))) ? String(porUnidade[a.location]) : reviewLink;
        const { subject, html } = reviewRequestEmail({ name: a.name || "there", business: (brand && brand.business) || "", service: a.service || "", link: linkDaVisita, lang: L, brand, unsub: await unsubDe(para), address, feedbackUrl: await visitaUrl(env, email, a.id).catch(() => "") });
        if (await capSend(para, subject, html)) {
          reviewsAsked++;
          // Carimbo SÓ depois do envio confirmado, uma linha por vez — a disciplina que o bug do
          // lembrete ensinou. Quem não pôde receber hoje continua na fila até a janela fechar.
          // E o carimbo devolve boolean de propósito: se ele falhar, o e-mail JÁ saiu e a pessoa
          // seria convidada de novo amanhã. Isso vira contador visível em vez de e-mail repetido
          // que ninguém explica.
          if (await rpc(env, "biz_review_mark", { p_email: email, p_id: a.id, p_channel: "email" }) !== true) reviewMarcaFalhou++;
        }
      }
    }

    // BIRTHDAY — Gui never forgets. Celebrate every customer whose birthday is today (email).
    const bd = await rpc(env, "biz_birthdays", { p_email: email, p_within: 0, p_limit: 100 });
    for (const c of (bd?.birthdays || [])) {
      const para = await destino(c.contact); if (!para) continue;
      const { subject, html } = birthdayEmail({ name: c.name || "there", business: (brand && brand.business) || "", lang: L, brand, unsub: await unsubDe(para), address });
      if (await capSend(para, subject, html)) birthdays++;
    }

    // CLIENT ANNIVERSARY — "X years since your first visit, thank you" (email).
    const anv = await rpc(env, "biz_anniversaries", { p_email: email, p_limit: 100 });
    for (const c of (anv?.anniversaries || [])) {
      const para = await destino(c.contact); if (!para) continue;
      const { subject, html } = anniversaryEmail({ name: c.name || "there", business: (brand && brand.business) || "", years: c.years || 1, lang: L, brand, unsub: await unsubDe(para), address });
      if (await capSend(para, subject, html)) anniversaries++;
    }

    // RECALL — return-by-cadence (e.g. ~6-month routine). Fires once per visit cycle (RPC dedups).
    const rc = await rpc(env, "biz_recall_due", { p_email: email, p_days: 180, p_limit: 100 });
    for (const c of (rc?.recall || [])) {
      const para = await destino(c.contact); if (!para) continue;
      const { subject, html } = recallEmail({ name: c.name || "there", business: (brand && brand.business) || "", lang: L, bizEmail: email, brand, unsub: await unsubDe(para), address });
      if (await capSend(para, subject, html)) recalls++;
    }

    // LOYALTY MILESTONE — reward every 10th visit (RPC dedups per milestone).
    const ly = await rpc(env, "biz_loyalty_due", { p_email: email, p_step: 10, p_limit: 100 });
    for (const c of (ly?.loyalty || [])) {
      const para = await destino(c.contact); if (!para) continue;
      const { subject, html } = loyaltyMilestoneEmail({ name: c.name || "there", business: (brand && brand.business) || "", milestone: c.milestone || 10, lang: L, brand, unsub: await unsubDe(para), address });
      if (await capSend(para, subject, html)) {
        loyalty++;
        // log a 'loyalty' event so the autonomous VIP-thank below (company_crm_vips) dedups against this
        // milestone send — a customer never gets BOTH a milestone AND a VIP thank in the same window.
        await ingRpc(env, "ingest_client_event", { p_email: email, p_type: "loyalty", p_channel: "email",
          p_summary: `Loyalty milestone → ${c.name || "cliente"}`.slice(0, 300), p_amount: 0,
          p_payload: { contact: para.toLowerCase(), kind: "milestone" } });
      }
    }

    // WELCOME — warm welcome after a customer's first visit (fires once).
    const wc = await rpc(env, "biz_welcome_due", { p_email: email, p_limit: 100 });
    for (const c of (wc?.welcome || [])) {
      const para = await destino(c.contact); if (!para) continue;
      const { subject, html } = welcomeFirstVisitEmail({ name: c.name || "there", business: (brand && brand.business) || "", lang: L, brand, unsub: await unsubDe(para), address });
      if (await capSend(para, subject, html)) welcomes++;
    }

    // REBOOK — follow up customers who asked to reschedule, to lock a new time (fires once).
    const rb = await rpc(env, "biz_rebook_due", { p_email: email, p_limit: 100 });
    for (const c of (rb?.rebook || [])) {
      const para = await destino(c.contact); if (!para) continue;
      const { subject, html } = rebookEmail({ name: c.name || "there", business: (brand && brand.business) || "", service: c.service || "", lang: L, bizEmail: email, brand, unsub: await unsubDe(para), address });
      if (await capSend(para, subject, html)) rebooks++;
    }

    // ── DATES ENGINE (db/growth_dates.sql) — all INGEST-gated; graceful no-op until pasted ──
    // O ANIVERSÁRIO pelo cadastro (crm_contacts.birth_date) saiu daqui em 2026-09-30: agora roda na
    // passada de relacionamento (fila global), respeitando o botão e a mensagem da tela de Datas.

    // COMMEMORATIVE DATES — each active biz_marketing_dates row that lands today FIRES marketing to the
    // client's recent contacts. Per-recipient claim (kind=row.kind, ref=dateId, period=year:contactId).
    const today = await ingRpc(env, "marketing_dates_today", { p_client_email: email });
    // ⚠️ A linha kind='birthday' guarda o BOTÃO e a MENSAGEM de aniversário (tela de Datas) — o
    // mês/dia dela é só preenchimento obrigatório da tabela. Tratada como data comemorativa, no dia
    // em que esse mês/dia chegasse o "feliz aniversário, {name}" iria para TODOS os contatos.
    const dates = (today?.dates || []).filter((d) => d && d.kind !== "birthday");
    if (dates.length) {
      const rcp = await ingRpc(env, "crm_marketing_recipients", { p_client_email: email, p_days: 180, p_limit: 400 });
      const recipients = rcp?.contacts || [];
      for (const dt of dates) {
        for (const c of recipients) {
          if (!podeMkt(c.email)) continue;
          const claimed = await ingRpc(env, "marketing_date_claim", { p_client_email: email, p_kind: (dt.kind || "holiday").toString(), p_ref: (dt.id || "").toString(), p_period: `${yr}:${(c.id || c.email).toString()}` });
          if (claimed !== true) continue;
          const { subject, html } = promoEmail({ name: c.name || "there", business: (brand && brand.business) || "", headline: dt.label || "", message: dt.message || "", offer: dt.offer || "", lang: L, bizEmail: email, brand, unsub: await unsubDe(c.email), address });
          if (await capSend(c.email, subject, html)) marketingDates++;
        }
      }
    }

    // O LEMBRETE DE VOLTA saiu daqui em 2026-09-30 (crm_rebook_due → relacionamento_due_all, na
    // passada de relacionamento): aqui ele usava o ciclo fixo de 28 dias para todo serviço, pulava
    // quem marcou por telefone e mandava o texto de REMARCAÇÃO ("você pediu pra remarcar") a quem
    // tinha sido atendido.
  }

  // ── GAP #1 — as filas do Company OS agora rodam SOZINHAS (não só 1-clique). Cross-tenant, email-only,
  // respeitam o dial (pula 'off' via offSet), capadas pelo mesmo capSend, e deduped pelas próprias RPCs
  // (NOT EXISTS loyalty/nurture na janela) + logam o evento → sem double-send com os blocos acima (que
  // rodaram ANTES e já marcaram winback/loyalty; a RPC exclui quem já foi tocado). Só o que o resto NÃO fez.
  let vipThanks = 0, leadNurtures = 0;
  // `!motoresOff`: este bloco roda também na passada de lembretes (não olha `soLembretes`), então
  // é aqui que o interruptor geral precisa segurá-lo.
  if (env.INGEST_SECRET && !motoresOff) {
    // Estes dois laços são CROSS-TENANT (cada linha traz o seu `tenant`), então a supressão/marca/
    // endereço não podem vir do laço por-tenant acima — resolvemos por tenant, com cache, e o mesmo
    // fail-closed: sem lista de supressão confirmada, não mandamos marketing pra aquele tenant.
    const cacheTenant = new Map();
    const ctx = async (t) => {
      const k = String(t || "").toLowerCase();
      if (!k.includes("@")) return null;
      if (cacheTenant.has(k)) return cacheTenant.get(k);
      const br = await brandFor(env, k).catch(() => null);
      let ad = "", sup = null;
      try { const a = await svcJson(env, "client_postal_address", { p_secret: env.INGEST_SECRET || "", p_client_email: k }); if (typeof a === "string" && a.trim()) ad = a.trim().slice(0, 200); } catch { /* sem endereço */ }
      try { const s2 = await svcJson(env, "email_suppressed_list", { p_secret: env.INGEST_SECRET || "", p_client_email: k }); if (Array.isArray(s2)) sup = new Set(s2.map((x) => String(x).toLowerCase())); } catch { /* sup null → pula */ }
      const v = { brand: br, address: ad, sup, lang: langNorm(br && br.lang) };
      cacheTenant.set(k, v);
      return v;
    };
    const podeCross = (c, to) => c && c.sup instanceof Set && isEmail(to) && !c.sup.has(String(to).trim().toLowerCase());

    // 🗂️ CRM — agradece os VIPs (maior LTV, saudáveis, não agradecidos em 60d)
    const vips = await ingRpc(env, "company_crm_vips", { p_limit: 40 });
    for (const c of (Array.isArray(vips) ? vips : [])) {
      if (sends >= 40 || !isEmail(c.email) || offSet.has((c.tenant || "").toLowerCase())) continue;
      const cx = await ctx(c.tenant);
      if (!podeCross(cx, c.email)) continue;
      const { subject, html } = loyaltyMilestoneEmail({ name: c.name || "there", business: (cx.brand && cx.brand.business) || "", milestone: c.visits || 10, lang: cx.lang, brand: cx.brand, unsub: await unsubUrl(env, "https://guileoai.com", String(c.tenant).toLowerCase(), String(c.email).toLowerCase()).catch(() => ""), address: cx.address });
      if (await capSend(c.email, subject, html)) {
        vipThanks++;
        await ingRpc(env, "ingest_client_event", { p_email: c.tenant, p_type: "loyalty", p_channel: "email",
          p_summary: `🗂️ Gui agradeceu ${c.name || "VIP"} (autônomo)`.slice(0, 300), p_amount: 0,
          p_payload: { contact: (c.email || "").toLowerCase(), kind: "loyalty" } });
      }
    }
    // 📣 MARKETING — nutre os leads (não nutridos em 14d) que o drip por-idade não pegou.
    // ⚠️ ERA proposalEmail (auditoria A4, 2026-08-11): a PROPOSTA COMERCIAL DA GUILEO, com o bloco
    // das 8 frentes ("site, app & software", "gestão de redes sociais"…). Esses leads são leads DO
    // CLIENTE — gente que ligou pro salão. Recebiam um deck B2B da Guileo assinado pelo salão.
    // Agora recebem o que faz sentido: um convite da PRÓPRIA casa pra marcar um horário.
    const leads = await ingRpc(env, "company_marketing_leads", { p_limit: 40 });
    for (const l of (Array.isArray(leads) ? leads : [])) {
      if (sends >= 40 || !isEmail(l.email) || offSet.has((l.tenant || "").toLowerCase())) continue;
      const cx = await ctx(l.tenant);
      if (!podeCross(cx, l.email)) continue;
      const { subject, html } = promoEmail({ name: l.name || "there", business: (cx.brand && cx.brand.business) || "", lang: cx.lang, bizEmail: l.tenant, brand: cx.brand, unsub: await unsubUrl(env, "https://guileoai.com", String(l.tenant).toLowerCase(), String(l.email).toLowerCase()).catch(() => ""), address: cx.address });
      if (await capSend(l.email, subject, html)) {
        leadNurtures++;
        await ingRpc(env, "ingest_client_event", { p_email: l.tenant, p_type: "nurture", p_channel: "email",
          p_summary: `📣 Gui nutriu o lead ${l.name || ""} (autônomo)`.slice(0, 300), p_amount: 0,
          p_payload: { contact: (l.email || "").toLowerCase(), kind: "nurture" } });
      }
    }
  }

  return json({ ok: true, visitas, lembreteDiag, orcamentosRetornados, reactivated, reminded: reminded + ((visitas && visitas.lembretes) || 0), reviewsAsked, reviewMarcaFalhou, semLinkReview, rpcRecusou, birthdays, anniversaries, recalls, loyalty, welcomes, rebooks, crmBirthdays, marketingDates, rebookNudges, valueReports, vipThanks, leadNurtures, businesses: businesses.length,
    ...(motoresOff ? { desligado: true, motivo: "motores_proativos=off — só lembrete de horário marcado rodou" } : {}) });
}
