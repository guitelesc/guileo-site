// CONFIRMAÇÃO E LEMBRETE POR TEXTO — só sai com tudo verde, e quando não sai, diz por quê.
import { textoDoAviso, horaDeSilencio, planoDoAviso, parametrosDoModelo, entregarAviso } from "./avisoPorTexto.js";

let falhas = 0, total = 0;
const confere = (nome, cond) => { total++; if (!cond) { falhas++; console.log(`❌ ${nome}`); } };
const D = { name: "Marina Prova", business: "Natura Spa + Salon", service: "Facial", whenLabel: "Tue, Oct 6 · 2:00 PM", location: "Astoria", ref: "GUI-1234" };
const ENV = { SMS_A2P_APROVADO: "1", TWILIO_ACCOUNT_SID: "AC", TWILIO_AUTH_TOKEN: "t", TWILIO_FROM: "+15005550006", INGEST_SECRET: "s" };
const WA = { phone_number_id: "123", access_token: "tok", templates: { book: "appointment_confirmation", reminder: "appointment_reminder" } };
const MEIO_DIA = new Date("2026-10-06T16:00:00Z"); // 12h em Nova York
const MADRUGADA = new Date("2026-10-06T07:00:00Z"); // 3h em Nova York

// ── o texto ──
const t = textoDoAviso("book", D, "en");
confere("confirmação começa pelo nome do negócio", t.startsWith("Natura Spa + Salon: you're confirmed for Facial on Tue, Oct 6 · 2:00 PM (Astoria)."));
confere("toda mensagem ensina a sair", t.endsWith("Reply STOP to opt out.") && textoDoAviso("reminder", D, "pt").endsWith("Responda SAIR para não receber."));
confere("lembrete pede o C de confirmar", textoDoAviso("reminder", D, "en").includes("Reply C to confirm"));
confere("pré-reserva NÃO diz confirmado", !/confirmed/i.test(textoDoAviso("hold", D, "en")) && textoDoAviso("hold", D, "en").includes("will confirm"));
confere("cabe em 2 SMS", textoDoAviso("book", { ...D, service: "x".repeat(300) }, "en").length <= 320);
confere("sem dados não sai 'undefined'", !textoDoAviso("book", {}, "en").includes("undefined"));

// ── silêncio ──
confere("meio-dia em NY não é silêncio", horaDeSilencio("America/New_York", MEIO_DIA) === false);
confere("3h da manhã em NY é silêncio", horaDeSilencio("America/New_York", MADRUGADA) === true);
confere("a mesma hora é dia em São Paulo? 4h — ainda silêncio", horaDeSilencio("America/Sao_Paulo", MADRUGADA) === true);
confere("fuso inválido não quebra", typeof horaDeSilencio("Marte/Base", MEIO_DIA) === "boolean");

// ── o plano ──
const base = { kind: "book", phone: "(929) 535-0191", dnc: false, tz: "America/New_York", agora: MEIO_DIA };
confere("SMS aprovado e sem WhatsApp → SMS em E.164", (() => { const p = planoDoAviso(ENV, base); return p.canal === "sms" && p.destino === "+19295350191"; })());
confere("🚫 SMS NÃO aprovado → não sai, com o motivo", (() => { const p = planoDoAviso({ ...ENV, SMS_A2P_APROVADO: "" }, base); return p.canal === null && /A2P/.test(p.motivos.sms); })());
confere("WhatsApp com modelo cadastrado vem antes do SMS", (() => { const p = planoDoAviso(ENV, { ...base, whatsapp: WA }); return p.canal === "whatsapp" && p.modelo === "appointment_confirmation"; })());
confere("WhatsApp conectado SEM modelo para este aviso → cai no SMS", planoDoAviso(ENV, { ...base, kind: "hold", whatsapp: WA }).canal === "sms");
confere("nome de modelo com caractere estranho não é usado", planoDoAviso(ENV, { ...base, whatsapp: { ...WA, templates: { book: "x; drop" } } }).canal === "sms");
confere("🚫 quem pediu STOP não recebe", planoDoAviso(ENV, { ...base, dnc: true, whatsapp: WA }).canal === null);
confere("🚫 lista de não-contato ilegível = não manda (fail-closed)", (() => { const p = planoDoAviso(ENV, { ...base, dnc: null }); return p.canal === null && /não consegui conferir/.test(p.motivos.sms); })());
confere("lembrete de madrugada é ADIADO, não perdido", (() => { const p = planoDoAviso(ENV, { ...base, kind: "reminder", agora: MADRUGADA }); return p.canal === null && p.adiar === true; })());
confere("confirmação de madrugada sai (a pessoa acabou de marcar)", planoDoAviso(ENV, { ...base, agora: MADRUGADA }).canal === "sms");
confere("telefone de 9 dígitos não recebe nada", planoDoAviso(ENV, { ...base, phone: "929-535-019" }).canal === null);
confere("número de Israel não recebe (trava de destino)", planoDoAviso(ENV, { ...base, phone: "+972 2 555 0100" }).canal === null);
confere("e-mail no lugar do telefone não vira destino", planoDoAviso(ENV, { ...base, phone: "a@b.com" }).canal === null);

// ── os parâmetros do modelo ──
const pm = parametrosDoModelo(D)[0].parameters.map((x) => x.text);
confere("modelo: primeiro nome, serviço, quando, unidade — nesta ordem", pm.join("|") === "Marina|Facial|Tue, Oct 6 · 2:00 PM|Astoria");
confere("parâmetro vazio ganha um texto (a Meta recusa vazio)", parametrosDoModelo({})[0].parameters.every((x) => x.text.length > 0));

// ── a entrega (rede trocada) ──
const svc = (dncV, wa) => async (_e, nome) => (nome === "is_dnc" ? dncV : wa);
let mandou = null;
const sendText = async (_e, to, body, opts) => { mandou = { to, body, opts }; return { sent: true, sid: "SM123" }; };
const r1 = await entregarAviso(ENV, { tenant: "spa@x.com", phone: "929 535 0191", kind: "book", dados: D, de: "+19298288170" }, { svcJson: svc(false, null), sendText });
confere("entrega por SMS devolve o id da Twilio", r1.sent === true && r1.canal === "sms" && r1.id === "SM123");
confere("sai do número DO NEGÓCIO", mandou.opts.from === "+19298288170" && mandou.to === "+19295350191");
const r2 = await entregarAviso(ENV, { tenant: "spa@x.com", phone: "929 535 0191", dados: D }, { svcJson: svc(false, null), sendText: async () => ({ sent: true, sid: null }) });
confere("'aceito' sem id NÃO conta como enviado", r2.sent === false);
const r3 = await entregarAviso(ENV, { tenant: "spa@x.com", phone: "929 535 0191", dados: D }, { svcJson: svc({ ok: false, erro_http: 500 }, null), sendText });
confere("erro ao ler a lista de não-contato → não manda", r3.sent === false);
let modeloUsado = null;
const r4 = await entregarAviso(ENV, { tenant: "spa@x.com", phone: "929 535 0191", kind: "reminder", dados: D, tz: "America/New_York" },
  { agora: MEIO_DIA, svcJson: svc(false, WA), sendText, sendWhatsAppTemplate: async (_e, _w, to, nome) => { modeloUsado = { to, nome }; return { ok: true, id: "wamid.1" }; } });
confere("com WhatsApp e modelo → vai por WhatsApp", r4.sent === true && r4.canal === "whatsapp" && r4.id === "wamid.1" && modeloUsado.nome === "appointment_reminder" && modeloUsado.to === "+19295350191");
const r4b = await entregarAviso(ENV, { tenant: "spa@x.com", phone: "929 535 0191", kind: "reminder", dados: D, tz: "America/New_York" }, { agora: MADRUGADA, svcJson: svc(false, WA), sendText });
confere("lembrete às 3h: nada sai e volta 'adiar'", r4b.sent === false && r4b.adiar === true);
mandou = null;
const r5 = await entregarAviso(ENV, { tenant: "spa@x.com", phone: "929 535 0191", kind: "book", dados: D },
  { svcJson: svc(false, WA), sendText, sendWhatsAppTemplate: async () => ({ ok: false, id: null }) });
confere("Meta recusou o modelo → cai no SMS liberado", r5.sent === true && r5.canal === "sms" && mandou !== null);
const r6 = await entregarAviso({ ...ENV, SMS_A2P_APROVADO: "" }, { tenant: "spa@x.com", phone: "929 535 0191", kind: "book", dados: D },
  { svcJson: svc(false, WA), sendText, sendWhatsAppTemplate: async () => ({ ok: false, id: null }) });
confere("Meta recusou e SMS bloqueado → não enviado, com motivo", r6.sent === false && /WhatsApp recusou/.test(r6.motivo));

if (falhas) { console.log(`\n${falhas} errados.`); process.exit(1); }
console.log(`✅ ${total}/${total} — confirmação e lembrete por texto prontos: só saem com canal aprovado, fora da lista de STOP e em horário decente`);
