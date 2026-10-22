// node --test functions/lib/resumoManha.test.mjs — o "☀️ resumo da manhã" do Guileo Desk (2026-10-05).
// Prova: (1) quem cabe AGORA pela hora local do negócio e pelo dia já enviado; (2) o e-mail OMITE a
// seção sem dado e diz "agenda vazia" em vez de inventar um resumo; (3) "enviado" só com id da Resend,
// e falha vira linha no feed do negócio — nunca silêncio.
import { test } from "node:test";
import assert from "node:assert/strict";
import { escolheDevidos, relogioLocal, langDoResumo } from "./resumoManha.js";
import { deskMorningSummaryEmail } from "./emailTemplates.js";
import { enviarResumo, rodada } from "../api/resumo-manha.js";

// 2026-10-05 11:05 UTC = 07:05 em Nova York (EDT, -4) = 08:05 em São Paulo = 16:35 em Delhi
const AGORA = new Date("2026-10-05T11:05:00Z");

test("relogioLocal: hora e dia na parede do fuso", () => {
  assert.deepEqual(relogioLocal("America/New_York", AGORA), { dia: "2026-10-05", hora: 7 });
  assert.deepEqual(relogioLocal("America/Sao_Paulo", AGORA), { dia: "2026-10-05", hora: 8 });
  assert.deepEqual(relogioLocal("Asia/Kolkata", new Date("2026-10-05T01:35:00Z")), { dia: "2026-10-05", hora: 7 });
  assert.equal(relogioLocal("Fuso/Inventado", AGORA), null);
});

test("escolheDevidos: só a hora local escolhida, uma vez por dia", () => {
  const c = [
    { client_email: "ny@x.com", hora: 7, tz: "America/New_York", ultimo_dia: null, lang: "pt" },
    { client_email: "sp@x.com", hora: 7, tz: "America/Sao_Paulo", ultimo_dia: null },          // 8h lá → não
    { client_email: "sp8@x.com", hora: 8, tz: "America/Sao_Paulo", ultimo_dia: "2026-10-04" }, // ontem foi → hoje sim
    { client_email: "ja@x.com", hora: 7, tz: "America/New_York", ultimo_dia: "2026-10-05" },   // hoje já foi → não
    { client_email: "ruim@x.com", hora: 7, tz: "Fuso/Inventado" },                              // fuso ruim → não chuta
    { client_email: "NY@x.com", hora: 7, tz: "America/New_York" },                              // repetido → uma vez
    { client_email: "semhora@x.com", tz: "America/New_York", email_destino: "dona@x.com" },     // sem hora = 7
    { client_email: "nao-e-email", hora: 7, tz: "America/New_York" },
  ];
  const r = escolheDevidos(c, AGORA);
  assert.deepEqual(r.map((x) => x.email), ["ny@x.com", "sp8@x.com", "semhora@x.com"]);
  assert.equal(r[0].dia, "2026-10-05");
  assert.equal(r[0].lang, "pt");
  assert.equal(r[0].destino, "ny@x.com");                 // sem destino → o e-mail do negócio
  assert.equal(r[2].destino, "dona@x.com");
  assert.equal(r[1].lang, "en");
});

test("escolheDevidos: lote fechado", () => {
  const muitos = Array.from({ length: 60 }, (_, i) => ({ client_email: `t${i}@x.com`, hora: 7, tz: "America/New_York" }));
  assert.equal(escolheDevidos(muitos, AGORA, 25).length, 25);
  assert.equal(escolheDevidos(null, AGORA).length, 0);
});

test("langDoResumo", () => {
  assert.equal(langDoResumo("", null, "PT"), "pt");
  assert.equal(langDoResumo("fr"), "en");
  assert.equal(langDoResumo("hi"), "hi");
});

// ── o e-mail ───────────────────────────────────────────────────────────────────────────────────
const CHEIO = {
  ok: true, tz: "America/New_York", business: "Natura Spa", hoje: "2026-10-05",
  unidades: [
    { id: "a", name: "Astoria", tz: "America/New_York", count: 8, first: "2026-10-05T13:00:00Z", confirmed: 6, unconfirmed: 2 },
    { id: "b", name: "Manhattan", tz: "America/New_York", count: 0, first: null, confirmed: 0, unconfirmed: 0 },
  ],
  sem_unidade: { count: 0, first: null, confirmed: 0 },
  alertas: [{ name: "Maria", start: "2026-10-05T14:00:00Z", alert: "Látex", tz: "America/New_York" }],
  sinais: { count: 1, cents: 3000, itens: [{ name: "Joana", start: "2026-10-06T15:00:00Z", service: "Facial", cents: 3000, tz: "America/New_York" }] },
  ontem: { booked: 5, visits: 4, no_show: 1, cancelled: 0, new_clients: 2 },
  caixa_ontem: { sales: 3, collected_cents: 54000, tip_cents: 2000 },
  fila: 3,
};
const VAZIO = { ok: true, tz: "America/New_York", business: "", unidades: [{ id: "a", name: "Astoria", tz: "America/New_York", count: 0, confirmed: 0 }], sem_unidade: { count: 0 }, alertas: [], sinais: { count: 0, cents: 0, itens: [] }, ontem: null, caixa_ontem: null, fila: 0 };

test("e-mail cheio (pt): cada seção com o dado de verdade, no fuso da unidade", () => {
  const { subject, html } = deskMorningSummaryEmail({ dados: CHEIO, lang: "pt" });
  assert.match(subject, /Hoje: 8 horários · Natura Spa/);
  assert.match(html, /Bom dia, Natura Spa/);
  assert.match(html, /Astoria<\/strong> — <strong[^>]*>8 horários<\/strong> · primeiro às 0?9:00 · 6 confirmados, 2 sem confirmar/);
  assert.match(html, /Manhattan<\/strong> — nada marcado/);
  assert.match(html, /10:00<\/strong> · Maria — ⚠️ Látex/);
  assert.match(html, /Sinais pendentes/);
  assert.match(html, /US\$\s?30,00/);
  assert.match(html, /4 atendimentos · 1 falta · 2 clientes novas/);
  assert.doesNotMatch(html, /cancelado/);                       // 0 cancelados → não inventa a linha
  assert.match(html, /US\$\s?540,00 entrou no caixa em 3 vendas/);
  assert.match(html, /3 pessoas esperando/);
  assert.match(html, /portal\?tab=desk&aba=agenda/);
  assert.match(html, /portal\?tab=desk"/);
  assert.doesNotMatch(html, /undefined|NaN|null/);
});

test("e-mail vazio: uma linha 'agenda vazia', nenhuma seção inventada", () => {
  const { subject, html } = deskMorningSummaryEmail({ dados: VAZIO, lang: "pt" });
  assert.match(subject, /Agenda vazia hoje/);
  assert.match(html, /Agenda vazia hoje\./);
  for (const s of ["Atenção hoje", "Sinais pendentes", "Ontem", "Fila de espera", "entrou no caixa", ">0 "]) assert.ok(!html.includes(s), `não devia ter "${s}"`);
  assert.doesNotMatch(html, /undefined|NaN/);
});

test("ontem só com zeros não vira seção; caixa sozinho vira", () => {
  const z = { ...VAZIO, ontem: { booked: 0, visits: 0, no_show: 0, cancelled: 0, new_clients: 0 } };
  assert.ok(!deskMorningSummaryEmail({ dados: z, lang: "en" }).html.includes("Yesterday"));
  const c = { ...VAZIO, caixa_ontem: { sales: 1, collected_cents: 10000, tip_cents: 0 } };
  const h = deskMorningSummaryEmail({ dados: c, lang: "en" }).html;
  assert.match(h, /Yesterday/);
  assert.match(h, /\$100\.00 collected in 1 sale/);
  assert.doesNotMatch(h, /in tips/);
});

test("4 idiomas, teste marcado, nome hostil escapado", () => {
  for (const [l, frase] of [["en", "Good morning"], ["es", "Buenos días"], ["hi", "सुप्रभात"], ["pt", "Bom dia"]]) {
    assert.ok(deskMorningSummaryEmail({ dados: CHEIO, lang: l }).html.includes(frase), l);
  }
  assert.match(deskMorningSummaryEmail({ dados: CHEIO, lang: "en", teste: true }).html, /This is a test send/);
  const mau = { ...CHEIO, business: '"><img src=x onerror=alert(1)>', alertas: [{ name: "<script>x</script>", start: "2026-10-05T14:00:00Z", alert: "<b>a</b>" }] };
  const h = deskMorningSummaryEmail({ dados: mau, lang: "en" }).html;
  assert.doesNotMatch(h, /<img src=x|<script>x|<b>a<\/b>/);
  assert.doesNotThrow(() => deskMorningSummaryEmail());
});

// ── o envio, com a rede simulada ───────────────────────────────────────────────────────────────
function rede({ resend = { status: 200, body: { id: "re_abc" } }, rpc = {} } = {}) {
  const chamadas = [];
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    const corpo = opts.body ? JSON.parse(opts.body) : null;
    chamadas.push({ u, corpo });
    const resp = (status, obj) => ({ ok: status >= 200 && status < 300, status, text: async () => (obj === undefined ? "" : JSON.stringify(obj)), json: async () => obj });
    if (u.includes("api.resend.com")) return resp(resend.status, resend.body);
    const nome = u.split("/rpc/")[1];
    if (nome in rpc) return resp(200, typeof rpc[nome] === "function" ? rpc[nome](corpo) : rpc[nome]);
    return resp(404, { message: "rpc desconhecida no teste" });
  };
  return chamadas;
}
const ENV = { RESEND_API_KEY: "re_test", SUPABASE_SERVICE_ROLE: "svc_test", INGEST_SECRET: "ing_test" };
const ID = "11111111-2222-4333-8444-555555555555";

test("enviado só com o id da Resend — e é marcado com ele", async () => {
  const ch = rede({ rpc: { desk_resumo_dados_svc: CHEIO, desk_resumo_marcar_svc: true } });
  const r = await enviarResumo(ENV, { email: "e2e-test@guileoai.com", destino: "", lang: "pt", id: ID });
  assert.equal(r.ok, true);
  assert.equal(r.resend_id, "re_abc");
  assert.equal(r.para, "e2e-test@guileoai.com");
  const marca = ch.find((c) => c.u.endsWith("desk_resumo_marcar_svc"));
  assert.equal(marca.corpo.p_estado, "enviado");
  assert.equal(marca.corpo.p_resend_id, "re_abc");
  assert.ok(!ch.some((c) => c.u.endsWith("ingest_client_event")));
});

test("Resend 200 SEM id = falhou, marcado e no feed do negócio", async () => {
  const ch = rede({ resend: { status: 200, body: {} }, rpc: { desk_resumo_dados_svc: CHEIO, desk_resumo_marcar_svc: true, ingest_client_event: "99999999-2222-4333-8444-555555555555" } });
  const r = await enviarResumo(ENV, { email: "e2e-test@guileoai.com", destino: "dona@guileoai.com", lang: "pt", id: ID });
  assert.equal(r.ok, false);
  assert.match(r.motivo, /sem id/);
  assert.equal(r.para, "dona@guileoai.com");
  assert.equal(ch.find((c) => c.u.endsWith("desk_resumo_marcar_svc")).corpo.p_estado, "falhou");
  const feed = ch.find((c) => c.u.endsWith("ingest_client_event"));
  assert.equal(feed.corpo.p_email, "e2e-test@guileoai.com");
  assert.equal(feed.corpo.p_type, "failure");
  assert.match(feed.corpo.p_summary, /Resumo da manhã NÃO saiu/);
  assert.ok(r.feed);
});

test("dados ilegíveis = falha declarada, a Resend nem é chamada", async () => {
  const ch = rede({ rpc: { desk_resumo_dados_svc: { ok: false, reason: "tenant_not_found" }, desk_resumo_marcar_svc: true, ingest_client_event: "99999999-2222-4333-8444-555555555555" } });
  const r = await enviarResumo(ENV, { email: "e2e-test@guileoai.com", lang: "pt", id: ID });
  assert.equal(r.ok, false);
  assert.ok(!ch.some((c) => c.u.includes("resend")));
});

test("rodada: reserva perdida (já enviado) não manda; inerte sem chave", async () => {
  const ch = rede({ rpc: {
    desk_resumo_candidatos_svc: [{ client_email: "e2e-test@guileoai.com", hora: relogioLocal("America/New_York").hora, tz: "America/New_York", ultimo_dia: null }],
    desk_plano_svc: null, desk_resumo_reservar_svc: null,
  } });
  const r = await rodada(ENV);
  assert.equal(r.ok, true);
  assert.equal(r.devidos, 1);
  assert.equal(r.pulados, 1);
  assert.equal(r.enviados, 0);
  assert.ok(!ch.some((c) => c.u.includes("resend")));
  const sem = await rodada({ ...ENV, RESEND_API_KEY: "" });
  assert.equal(sem.ready, false);
});

test("rodada: falha de envio deixa a rodada ok:false (o cron-tick avisa)", async () => {
  rede({ resend: { status: 500, body: { message: "boom" } }, rpc: {
    desk_resumo_candidatos_svc: [{ client_email: "e2e-test@guileoai.com", hora: relogioLocal("America/New_York").hora, tz: "America/New_York" }],
    desk_plano_svc: null, desk_resumo_reservar_svc: ID, desk_resumo_dados_svc: VAZIO, desk_resumo_marcar_svc: true,
    ingest_client_event: "99999999-2222-4333-8444-555555555555",
  } });
  const r = await rodada(ENV);
  assert.equal(r.ok, false);
  assert.equal(r.falhas, 1);
  assert.ok(!JSON.stringify(r).includes("e2e-test@"), "a resposta do cron não leva e-mail de ninguém");
});

test("rodada: leitura que falha não vira 'ninguém ligou'", async () => {
  rede({ rpc: {} });
  const r = await rodada(ENV);
  assert.equal(r.ok, false);
  assert.match(r.erro, /não consegui ler/);
});
