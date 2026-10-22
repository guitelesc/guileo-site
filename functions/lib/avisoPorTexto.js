// O AVISO QUE CHEGA NO CELULAR — confirmação e lembrete por WhatsApp/SMS (2026-09-30)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Quem marca por telefone quase nunca dá e-mail. Hoje essa pessoa não recebe confirmação nem
// lembrete: os dois só saem por e-mail. O SMS está parado na aprovação das operadoras (A2P) e o
// WhatsApp na aprovação da Meta — mas o código que mandaria NÃO EXISTIA: no dia da aprovação,
// ligar a chave não mudaria nada. Este arquivo é esse código.
//
// A ORDEM: WhatsApp do próprio negócio (com modelo aprovado) → SMS. E-mail não é daqui: quem tem
// e-mail já recebe por lá, e o texto é para quem NÃO tem.
//
// O QUE PRECISA ESTAR VERDE PARA SAIR (tudo, senão não sai — e o motivo volta escrito):
//   • o canal está liberado: WhatsApp = o negócio conectou o número E cadastrou o nome do modelo
//     aprovado; SMS = SMS_A2P_APROVADO=1 e credenciais da Twilio;
//   • o número é válido e de um país que a casa atende (contato.js);
//   • a pessoa NÃO está na lista de não-contato — e se eu não conseguir conferir, NÃO mando;
//   • lembrete respeita o silêncio: só entre 8h e 21h no fuso do negócio. Confirmação sai na hora,
//     porque a pessoa acabou de pedir.
// SÓ TRANSACIONAL. Campanha, volta e aniversário não passam por aqui: texto de marketing exige
// consentimento próprio, e esse registro ainda não existe.
import { avaliarContato, paraE164, destinoPermitido } from "./contato.js";

const ligado = (v) => v === "1" || v === 1 || v === true || String(v || "").toLowerCase() === "true";
const curto = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);
const L3 = (lang) => { const l = String(lang || "").toLowerCase().slice(0, 2); return l === "pt" || l === "es" ? l : "en"; };

/** O texto do SMS. Curto, com o nome do negócio na frente e a saída (STOP) no fim. */
export function textoDoAviso(kind, d = {}, lang = "en") {
  const l = L3(lang);
  const neg = curto(d.business, 40) || (l === "pt" ? "Seu agendamento" : l === "es" ? "Su cita" : "Your appointment");
  const serv = curto(d.service, 40);
  const quando = curto(d.whenLabel, 40);
  const onde = curto(d.location, 30);
  const ref = curto(d.ref, 12);
  const base = {
    en: {
      book: `${neg}: you're confirmed${serv ? ` for ${serv}` : ""}${quando ? ` on ${quando}` : ""}${onde ? ` (${onde})` : ""}.${ref ? ` Ref ${ref}.` : ""} Need to change it? Just reply here.`,
      hold: `${neg}: we received your request${serv ? ` for ${serv}` : ""}${quando ? ` on ${quando}` : ""}. The team will confirm it with you.`,
      reminder: `${neg}: reminder of your ${serv || "appointment"}${quando ? ` on ${quando}` : ""}${onde ? ` (${onde})` : ""}. Reply C to confirm, or tell us if you need to change it.`,
      deposit: `${neg}: to secure your ${serv || "appointment"}${quando ? ` on ${quando}` : ""}, pay the ${curto(d.amount, 12)} deposit (it comes off the price): ${String(d.link || "").trim().slice(0, 400)}`,
      stop: " Reply STOP to opt out.",
    },
    pt: {
      book: `${neg}: confirmado${serv ? ` — ${serv}` : ""}${quando ? `, ${quando}` : ""}${onde ? ` (${onde})` : ""}.${ref ? ` Ref ${ref}.` : ""} Precisa mudar? É só responder aqui.`,
      hold: `${neg}: recebemos seu pedido${serv ? ` de ${serv}` : ""}${quando ? ` para ${quando}` : ""}. A equipe confirma com você.`,
      reminder: `${neg}: lembrete do seu ${serv || "horário"}${quando ? `, ${quando}` : ""}${onde ? ` (${onde})` : ""}. Responda C para confirmar, ou avise se precisar mudar.`,
      deposit: `${neg}: para garantir ${serv || "seu horário"}${quando ? ` (${quando})` : ""}, pague o sinal de ${curto(d.amount, 12)} (sai do valor do serviço): ${String(d.link || "").trim().slice(0, 400)}`,
      stop: " Responda SAIR para não receber.",
    },
    es: {
      book: `${neg}: confirmado${serv ? ` — ${serv}` : ""}${quando ? `, ${quando}` : ""}${onde ? ` (${onde})` : ""}.${ref ? ` Ref ${ref}.` : ""} ¿Necesita cambiarlo? Responda aquí.`,
      hold: `${neg}: recibimos su solicitud${serv ? ` de ${serv}` : ""}${quando ? ` para ${quando}` : ""}. El equipo se lo confirma.`,
      reminder: `${neg}: recordatorio de su ${serv || "cita"}${quando ? `, ${quando}` : ""}${onde ? ` (${onde})` : ""}. Responda C para confirmar, o avise si necesita cambiarla.`,
      deposit: `${neg}: para asegurar ${serv || "su cita"}${quando ? ` (${quando})` : ""}, pague el depósito de ${curto(d.amount, 12)} (se descuenta del precio): ${String(d.link || "").trim().slice(0, 400)}`,
      stop: " Responda STOP para no recibir.",
    },
  }[l];
  const corpo = base[kind === "hold" ? "hold" : kind === "reminder" ? "reminder" : kind === "deposit" ? "deposit" : "book"];
  // o link do sinal NÃO pode ser cortado no meio (cortado = link quebrado): ele vai inteiro, o STOP encolhe.
  if (kind === "deposit") return corpo.length + base.stop.length <= 480 ? corpo + base.stop : corpo;
  return (corpo + base.stop).slice(0, 320);
}

/** 8h–21h no fuso do negócio. Fuso inválido = trata como Nova York (o mercado da casa). */
export function horaDeSilencio(tz, agora = new Date()) {
  let h;
  try { h = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz || "America/New_York", hour: "numeric", hourCycle: "h23" }).format(agora)); }
  catch { h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(agora)); }
  return !(h >= 8 && h < 21);
}

// Os parâmetros do modelo do WhatsApp, SEMPRE nesta ordem: {{1}} nome, {{2}} serviço, {{3}} quando,
// {{4}} unidade. O modelo cadastrado na Meta tem que usar a mesma ordem (ver ROTA-TEXTO).
export function parametrosDoModelo(d = {}) {
  const v = (s, reserva) => ({ type: "text", text: curto(s, 60) || reserva });
  const p = [v(String(d.name || "").split(/\s+/)[0], "there"), v(d.service, "your appointment"), v(d.whenLabel, "—"), v(d.location, "—")];
  // modelo do SINAL: {{5}} valor e {{6}} link (o modelo "deposit" cadastrado na Meta usa essa ordem)
  if (d.link) p.push(v(d.amount, "—"), { type: "text", text: String(d.link).slice(0, 300) });
  return [{ type: "body", parameters: p }];
}

/**
 * PARTE PURA: dado o que está liberado, por onde sai — ou por que não sai.
 *   whatsapp = tokens do negócio no WhatsApp Cloud (ou null) · dnc = true/false/null (null = não consegui conferir)
 * Devolve { canal:"whatsapp"|"sms"|null, destino, modelo?, motivos:{whatsapp,sms} }.
 */
export function planoDoAviso(env, { kind = "book", phone = "", whatsapp = null, dnc = null, tz = "", agora = new Date() } = {}) {
  const motivos = {};
  const fone = avaliarContato(phone).ok ? paraE164(phone) : null;
  if (!fone) return { canal: null, destino: "", motivos: { whatsapp: "telefone inválido", sms: "telefone inválido" } };
  if (!destinoPermitido(fone, env && env.CALL_DDI_EXTRA).ok) return { canal: null, destino: "", motivos: { whatsapp: "país fora do mercado", sms: "país fora do mercado" } };
  if (dnc !== false) { const m = dnc === true ? "a pessoa pediu para não receber (STOP)" : "não consegui conferir a lista de não-contato"; return { canal: null, destino: fone, motivos: { whatsapp: m, sms: m } }; }
  if (kind === "reminder" && horaDeSilencio(tz, agora)) return { canal: null, destino: fone, adiar: true, motivos: { whatsapp: "fora do horário (8h–21h)", sms: "fora do horário (8h–21h)" } };

  const w = whatsapp && typeof whatsapp === "object" ? whatsapp : null;
  const modelo = w && w.templates && typeof w.templates === "object" ? String(w.templates[kind] || "") : "";
  if (!w || !w.phone_number_id || !w.access_token) motivos.whatsapp = "WhatsApp do negócio não conectado";
  else if (!/^[a-z0-9_]{1,80}$/.test(modelo)) motivos.whatsapp = `sem modelo aprovado cadastrado para "${kind}"`;
  else return { canal: "whatsapp", destino: fone, modelo, idioma: String(w.template_lang || "en_US"), motivos };

  if (!ligado(env && env.SMS_A2P_APROVADO)) motivos.sms = "SMS bloqueado — campanha A2P 10DLC não aprovada";
  else if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM) motivos.sms = "credenciais Twilio ausentes";
  else return { canal: "sms", destino: fone, motivos };
  return { canal: null, destino: fone, motivos };
}

/**
 * Confere as travas, manda, e devolve o que aconteceu DE VERDADE:
 *   { sent:true, canal, id }  ·  { sent:false, adiar?, motivo, motivos }
 * `deps` existe para o teste trocar a rede; em produção não se passa nada.
 */
export async function entregarAviso(env, { tenant = "", phone = "", kind = "book", dados = {}, lang = "en", tz = "", de = "" } = {}, deps = {}) {
  const svc = deps.svcJson || (await import("./sb.js")).svcJson;
  const fone = avaliarContato(phone).ok ? paraE164(phone) : "";
  let dnc = null, whatsapp = null;
  if (fone) {
    const r = await svc(env, "is_dnc", { p_secret: env.INGEST_SECRET || "", p_phone: fone });
    dnc = r === true ? true : r === false ? false : null;   // qualquer outra coisa = não sei → não manda
    const w = await svc(env, "whatsapp_cloud_creds_lookup", { p_secret: env.INGEST_SECRET || "", p_email: tenant });
    if (w && typeof w === "object" && !w.erro_http && w.phone_number_id) whatsapp = w;
  }
  const agora = deps.agora || new Date();
  const plano = planoDoAviso(env, { kind, phone, whatsapp, dnc, tz, agora });
  if (!plano.canal) return { sent: false, adiar: !!plano.adiar, motivo: plano.motivos.sms || plano.motivos.whatsapp || "sem canal", motivos: plano.motivos };

  if (plano.canal === "whatsapp") {
    const enviar = deps.sendWhatsAppTemplate || (await import("../api/whatsapp-cloud.js")).sendWhatsAppTemplate;
    const r = await enviar(env, whatsapp, plano.destino, plano.modelo, plano.idioma, parametrosDoModelo(dados));
    if (r && r.ok && r.id) return { sent: true, canal: "whatsapp", id: r.id };
    // O modelo foi recusado (nome errado, não aprovado, janela): tenta o SMS se ele estiver liberado.
    const segundo = planoDoAviso(env, { kind, phone, whatsapp: null, dnc, tz, agora });
    if (segundo.canal !== "sms") return { sent: false, motivo: "WhatsApp recusou o modelo e o SMS não está liberado", motivos: { ...plano.motivos, whatsapp: "a Meta recusou o envio do modelo", sms: segundo.motivos.sms } };
  }
  const mandar = deps.sendText || (await import("./twilio.js")).sendText;
  const r = await mandar(env, plano.destino, textoDoAviso(kind, dados, lang), { channel: "sms", from: de });
  if (r && r.sent && r.sid) return { sent: true, canal: "sms", id: r.sid };
  return { sent: false, motivo: (r && r.reason) || "a Twilio não aceitou", motivos: plano.motivos };
}
