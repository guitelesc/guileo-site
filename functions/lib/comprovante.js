// O COMPROVANTE TEM QUE CHEGAR NA MÃO DE QUEM MARCOU.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ISTO EXISTE (2026-08-16, com número de comprovante)
// O PRIMEIRO agendamento real da plataforma — `GUI-42F0` — foi criado, o horário ficou reservado,
// e o cliente NÃO RECEBEU NADA. O contato capturado era um telefone (quebrado, ainda por cima);
// sem e-mail no cadastro e com o SMS recusado pela campanha A2P da Twilio, não havia por onde
// mandar. O único registro na trilha foi a agente anotando "Send confirmation text". Nada saiu.
// E — o pior — ninguém ficou sabendo até alguém ir procurar a mão.
//
// A reserva existir no NOSSO banco não é o produto. O produto é a pessoa chegar no horário. Entre
// as duas coisas existe um elo: o comprovante na mão dela. Este módulo é esse elo, e ele tem três
// obrigações, nesta ordem de importância:
//   1. DECIDIR por qual canal mandar, considerando o que existe para ESTE contato e o que está
//      realmente ligado para ESTE tenant (não o que "deveria" estar);
//   2. Quando NÃO existe canal nenhum, NÃO sair calado — virar tarefa para o dono, com o que ele
//      precisa para salvar a visita (nome, horário, telefone, referência) enquanto dá tempo;
//   3. Registrar o resultado com a palavra CERTA. "Aceito pelo provedor" não é "chegou".
//
// ── A DISTINÇÃO QUE CUSTOU CARO EM OUTRAS FRENTES ──────────────────────────────────────────────
// Um 200 do Resend quer dizer "recebi o pedido de envio", exatamente como um 200 de PATCH da
// ElevenLabs queria dizer "recebi", e não "mudou". Não temos webhook de entrega/abertura ligado,
// então NADA neste arquivo pode afirmar entrega. Por isso o resultado carrega
// `entrega_confirmada: false` SEMPRE, e o estado de sucesso se chama `aceito`, nunca `entregue`.
// Se um dia ligarem o webhook do Resend, quem confirmar de verdade vira o dono de mudar isso.
//
// ── SMS: BLOQUEADO HOJE, OPÇÃO AMANHÃ, SEM REESCRITA ───────────────────────────────────────────
// O SMS não está "removido" — está DESLIGADO por uma condição declarada na tabela CANAIS abaixo.
// Quando o A2P for aprovado, ligar é setar `SMS_A2P_APROVADO=1` no Cloudflare (e ter as credenciais
// da Twilio). A lógica de decisão não muda uma linha. O mesmo vale para o WhatsApp
// (`WHATSAPP_APROVADO=1` + `TWILIO_WHATSAPP_FROM`), que não depende do A2P.
//
// ── O ESTOQUE, NÃO SÓ O NASCIMENTO ─────────────────────────────────────────────────────────────
// Consertar quem nasce agora e esquecer quem já está lá foi um erro caro. Por isso todo registro
// de falha sai com uma marca estável no payload (`comprovante: "pendente"`) e existe
// `repararComprovante()`: quando o dono capturar o e-mail que faltava, o mesmo motor reentrega e
// fecha a pendência. A busca das pendências é de quem for varrer (cron/cockpit) — este módulo
// entrega o formato e o reparo.
import { appointmentEmail } from "./emailTemplates.js";
import { brandFor } from "./clientBrand.js";
import { avaliarContato } from "./contato.js";
import { svcRpc } from "./sb.js";
import { emitFailure } from "./failure.js";
import { sendText } from "./twilio.js";

const ehEmail = (s) => /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(String(s || "").trim());
const ligado = (v) => ["1", "true", "sim", "yes", "on"].includes(String(v == null ? "" : v).trim().toLowerCase());

// ── OS CANAIS, EM ORDEM DE PREFERÊNCIA ─────────────────────────────────────────────────────────
// A ordem não é gosto: o e-mail é o único que carrega o comprovante COMPLETO (serviço, horário,
// profissional, endereço, link do mapa, referência) com a marca do negócio. SMS/WhatsApp são
// lembretes curtos — melhores que nada, piores que o e-mail. Por isso o e-mail vem primeiro
// mesmo quando os três estiverem ligados.
//
// `disponivel(env, contatos)` responde a pergunta que interessa: dá para mandar AGORA, por aqui?
// Ela olha as credenciais reais do ambiente E o destino real do contato — as duas coisas têm que
// existir. Um canal com credencial e sem destino é tão inútil quanto o contrário.
export const CANAIS = [
  {
    canal: "email",
    destino: (c) => (ehEmail(c.email) ? String(c.email).trim() : ""),
    disponivel: (env, c) => {
      if (!ehEmail(c.email)) return { ok: false, motivo: "sem e-mail para este contato" };
      if (!env || !env.RESEND_API_KEY) return { ok: false, motivo: "RESEND_API_KEY não configurada" };
      return { ok: true };
    },
  },
  {
    canal: "whatsapp",
    destino: (c) => telefoneUtil(c.phone),
    // WhatsApp NÃO depende do A2P (é outro trilho). Fica atrás de uma chave própria porque o
    // sender ainda não está publicado na Meta — a entrada já foi provada, a saída não.
    disponivel: (env, c) => {
      if (!telefoneUtil(c.phone)) return { ok: false, motivo: motivoTelefone(c.phone) };
      if (!env || !env.TWILIO_WHATSAPP_FROM) return { ok: false, motivo: "sender de WhatsApp não configurado" };
      if (!ligado(env && env.WHATSAPP_APROVADO)) return { ok: false, motivo: "WhatsApp ainda não publicado (WHATSAPP_APROVADO≠1)" };
      if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return { ok: false, motivo: "credenciais Twilio ausentes" };
      return { ok: true };
    },
  },
  {
    canal: "sms",
    destino: (c) => telefoneUtil(c.phone),
    // 🚫 HOJE ISTO É SEMPRE `false`. A campanha A2P 10DLC foi reprovada (erro 30034) e a Twilio
    // recusa TODO envio — provado nos dois números. Deixar o canal "disponível" faria o motor
    // escolher um caminho que não anda e devolver "aceito" para uma mensagem que morreu.
    // Ligar quando aprovar: SMS_A2P_APROVADO=1. Nenhuma outra linha muda.
    disponivel: (env, c) => {
      if (!telefoneUtil(c.phone)) return { ok: false, motivo: motivoTelefone(c.phone) };
      if (!ligado(env && env.SMS_A2P_APROVADO)) return { ok: false, motivo: "SMS bloqueado — campanha A2P 10DLC não aprovada" };
      if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM) return { ok: false, motivo: "credenciais Twilio ausentes" };
      return { ok: true };
    },
  },
];

// Um telefone só é destino se DER PARA CHAMAR DE VOLTA. Reusa a mesma guarda que nasceu do
// GUI-42F0 (nove dígitos): mandar SMS para um número com um dígito a menos é gastar a única
// chance de aviso num número que não existe — e, pior, registrar isso como "avisado".
function telefoneUtil(bruto) {
  const s = String(bruto || "").trim();
  if (!s || s.includes("@")) return "";
  const r = avaliarContato(s);
  if (!r.ok) return "";
  // ⚠️ VALIDAR NÃO É NORMALIZAR. A versão anterior devolvia a string CRUA — "(929) 535-0191"
  // chegaria assim na Twilio, que responde 400 e o comprovante morre no dia em que o A2P
  // finalmente for aprovado. Pior: o canal já teria sido ESCOLHIDO, então o código acharia que
  // mandou. Aqui sai em E.164, que é o único formato que a operadora aceita.
  const d = s.replace(/\D/g, "");
  if (s.trim().startsWith("+")) return `+${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (d.length === 10) return `+1${d}`;   // sem prefixo assumimos EUA (ver contato.js)
  return `+${d}`;
}
function motivoTelefone(bruto) {
  const s = String(bruto || "").trim();
  if (!s || s.includes("@")) return "sem telefone para este contato";
  const r = avaliarContato(s);
  return r.ok ? "" : `telefone inválido (${r.motivo || "não confere"})`;
}

/**
 * canaisDisponiveis(env, contatos) — o retrato honesto: o que dá para usar, e por que os outros não.
 * `contatos` = { email, phone }. Devolve a lista NA ORDEM DE PREFERÊNCIA, cada item com
 * { canal, ok, destino, motivo }. Quem só quer a decisão usa escolherCanal().
 */
export function canaisDisponiveis(env, contatos = {}) {
  return CANAIS.map((c) => {
    const d = c.disponivel(env || {}, contatos) || { ok: false, motivo: "?" };
    return { canal: c.canal, ok: !!d.ok, destino: d.ok ? c.destino(contatos) : "", motivo: d.ok ? "" : (d.motivo || "") };
  });
}

/**
 * escolherCanal(env, contatos) → { canal, destino, alternativos, bloqueios }
 * `canal: null` quer dizer NÃO TEM POR ONDE MANDAR — que não é "tudo bem", é o caso GUI-42F0 e
 * precisa virar tarefa do dono. `bloqueios` guarda o porquê de cada canal recusado, porque
 * "não mandou" sem motivo vira adivinhação três dias depois.
 */
export function escolherCanal(env, contatos = {}) {
  const lista = canaisDisponiveis(env, contatos);
  const bons = lista.filter((c) => c.ok);
  return {
    canal: bons.length ? bons[0].canal : null,
    destino: bons.length ? bons[0].destino : "",
    alternativos: bons.slice(1).map((c) => c.canal),
    bloqueios: lista.filter((c) => !c.ok).map((c) => ({ canal: c.canal, motivo: c.motivo })),
  };
}

// ── ENVIO REAL POR CANAL ───────────────────────────────────────────────────────────────────────
// ⚠️ O e-mail SÓ pode sair por emailTemplates.js — é lei no repositório. Nenhum HTML aqui.
// Devolve { aceito, motivo }. `aceito` = o provedor recebeu o pedido. NÃO é "chegou".
async function enviarEmailReal(env, destino, p) {
  // A marca é do CLIENTE (logo/cor/nome do negócio). Falhar em carregá-la não pode impedir o
  // comprovante: cai no visual da casa, que renderiza sempre.
  const brand = await brandFor(env, p.tenant).catch(() => null);
  const { subject, html } = appointmentEmail({
    kind: p.kind, name: p.name, business: p.business || (brand && brand.business) || "",
    service: p.service, whenLabel: p.whenLabel, pro: p.pro, location: p.location,
    address: p.address || "", locPhone: p.locPhone || "", ref: p.ref, lang: p.lang || "en", brand,
  });
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: destino, subject, html }),
  });
  // r.ok importa: o Resend responde 4xx em domínio não verificado, endereço ruim e rate limit.
  // Devolver `aceito:true` sem olhar seria a mesma mentira do "200 = mudou".
  if (r.ok) return { aceito: true, motivo: "" };
  const corpo = await r.text().catch(() => "");
  return { aceito: false, motivo: `resend ${r.status}${corpo ? ": " + corpo.slice(0, 120) : ""}` };
}

// Texto curto — SMS/WhatsApp não são o comprovante completo, são o aviso de que ele existe.
export function textoCurto(p) {
  const L = ["pt", "es"].includes(String(p.lang || "").slice(0, 2)) ? String(p.lang).slice(0, 2) : "en";
  const neg = p.business ? ` · ${p.business}` : "";
  if (L === "pt") return `Confirmado${neg}: ${p.service || "seu horário"} em ${p.whenLabel}.${p.location ? " " + p.location + "." : ""}${p.ref ? " Ref " + p.ref + "." : ""}`;
  if (L === "es") return `Confirmado${neg}: ${p.service || "su cita"} el ${p.whenLabel}.${p.location ? " " + p.location + "." : ""}${p.ref ? " Ref " + p.ref + "." : ""}`;
  return `Confirmed${neg}: ${p.service || "your appointment"} on ${p.whenLabel}.${p.location ? " " + p.location + "." : ""}${p.ref ? " Ref " + p.ref + "." : ""}`;
}

async function enviarTextoReal(env, canal, destino, p) {
  const r = await sendText(env, destino, textoCurto(p), { channel: canal === "whatsapp" ? "whatsapp" : "sms" });
  return r && r.sent
    ? { aceito: true, motivo: "" }
    : { aceito: false, motivo: (r && (r.reason || `status ${r.status}`)) || "twilio recusou" };
}

// ── REGISTRO ───────────────────────────────────────────────────────────────────────────────────
// Onde o dono vê: linha na trilha do PRÓPRIO tenant (ingest_client_event → cockpit). Falha grave
// (nenhum canal / provedor recusou) também sobe para o barramento de falhas da plataforma, porque
// o dono do negócio pode não abrir o cockpit hoje — e "hoje" é o prazo de salvar a visita.
async function registrarReal(env, evento) {
  // devolve a Response para o `seguro()` poder olhar o .ok — sem isto, "registrado" era um chute
  if (!env || !env.INGEST_SECRET) return { ok: false };
  return svcRpc(env, "ingest_client_event", {
    p_secret: (env && env.INGEST_SECRET) || "", p_email: evento.tenant,
    p_type: "message", p_channel: evento.canal_label, p_summary: evento.resumo.slice(0, 300),
    p_amount: 0, p_payload: evento.payload,
  });
}

// A frase que o dono lê. Escrita para quem atende o balcão, não para quem lê log: diz o que
// aconteceu, o que falta, e o que fazer — nessa ordem, com o dado na mão.
export function avisoDono(p, motivo) {
  const quem = p.name || "cliente";
  const quando = p.whenLabel ? ` (${p.whenLabel})` : "";
  const ref = p.ref ? ` Ref ${p.ref}.` : "";
  if (motivo === "sem_canal") {
    return `⚠️ ${quem}${quando} agendou e NÃO recebeu comprovante — não temos e-mail e o SMS está bloqueado.`
      + `${p.phone ? ` Ligue para ${p.phone} e peça o e-mail.` : " Não temos nem telefone utilizável."}${ref}`;
  }
  return `⚠️ Comprovante de ${quem}${quando} NÃO saiu — o provedor recusou (${motivo}). Confirme com o cliente por outro caminho.${ref}`;
}

/**
 * entregarComprovante(env, p, deps?) — o motor.
 *
 * p = { tenant, kind, name, email, phone, business, service, whenLabel, pro, location,
 *       address, locPhone, ref, lang }
 *
 * Tenta os canais disponíveis NA ORDEM até um aceitar. Registra sempre — inclusive o sucesso,
 * para que "o cliente diz que não recebeu" tenha resposta com data e canal.
 *
 * Devolve:
 *   { estado: "aceito" | "recusado" | "sem_canal",
 *     canal, destino, entrega_confirmada: false, tentativas: [...], bloqueios: [...],
 *     registrado, avisou_dono, pendencia? }
 *
 * `entrega_confirmada` é SEMPRE false: nenhum provedor aqui nos diz que chegou. Trocar isso exige
 * webhook de entrega — e quem ligar o webhook é quem pode mudar esta linha.
 *
 * `deps` existe para o teste (e para reuso) trocar envio/registro sem tocar em rede.
 */
export async function entregarComprovante(env, p = {}, deps = {}) {
  const enviarEmail = deps.enviarEmail || ((e, d, x) => enviarEmailReal(e, d, x));
  const enviarTexto = deps.enviarTexto || ((e, c, d, x) => enviarTextoReal(e, c, d, x));
  const registrar = deps.registrar || ((e, ev) => registrarReal(e, ev));
  const falha = deps.emitirFalha || ((e, t, c, det, pay) => emitFailure(e, t, c, det, pay));

  const contatos = { email: p.email, phone: p.phone };
  const lista = canaisDisponiveis(env, contatos);
  const bloqueios = lista.filter((c) => !c.ok).map((c) => ({ canal: c.canal, motivo: c.motivo }));
  const tentativas = [];

  let aceito = null;
  for (const c of lista.filter((x) => x.ok)) {
    let r;
    try {
      r = c.canal === "email" ? await enviarEmail(env, c.destino, p) : await enviarTexto(env, c.canal, c.destino, p);
    } catch (e) {
      // Uma exceção do transporte é RECUSA, nunca "deu certo". Sem este catch, um throw do fetch
      // subiria e derrubaria o agendamento que JÁ ESTÁ FEITO — trocar reserva por comprovante é
      // trocar o problema por um pior.
      r = { aceito: false, motivo: String(e).slice(0, 120) };
    }
    tentativas.push({ canal: c.canal, destino: c.destino, aceito: !!(r && r.aceito), motivo: (r && r.motivo) || "" });
    if (r && r.aceito) { aceito = { canal: c.canal, destino: c.destino }; break; }
  }

  const base = {
    entrega_confirmada: false,   // ver o cabeçalho: aceito ≠ chegou
    tentativas, bloqueios,
    canal: aceito ? aceito.canal : null,
    destino: aceito ? aceito.destino : "",
  };

  // ── SUCESSO (aceito pelo provedor) ───────────────────────────────────────────────────────────
  if (aceito) {
    const ev = {
      tenant: p.tenant, canal_label: aceito.canal === "email" ? "Email" : aceito.canal === "whatsapp" ? "WhatsApp" : "SMS",
      resumo: `Comprovante de ${p.kind === "book" ? "agendamento" : p.kind || "agendamento"} enviado a ${p.name || "cliente"} por ${aceito.canal} (${aceito.destino})`,
      payload: {
        comprovante: "enviado", entrega_confirmada: false, canal: aceito.canal,
        to: aceito.destino, kind: p.kind || "book", ref: String(p.ref || ""), tentativas,
      },
    };
    const registrado = await seguro(() => registrar(env, ev));
    return { ...base, estado: "aceito", registrado, avisou_dono: false };
  }

  // ── FRACASSO ─────────────────────────────────────────────────────────────────────────────────
  // Dois fracassos diferentes, e a diferença importa para o dono: "não tinha por onde mandar"
  // (peça o e-mail) é outra ação que "o provedor recusou" (o endereço/domínio está errado).
  const semCanal = tentativas.length === 0;
  const motivo = semCanal ? "sem_canal" : (tentativas[tentativas.length - 1].motivo || "recusado");
  const resumo = avisoDono(p, motivo);
  // A MARCA DO ESTOQUE: `comprovante: "pendente"` é o que uma varredura futura procura para
  // reentregar o que ficou para trás. Sem marca estável, consertar o passado vira arqueologia.
  const pendencia = {
    // ⚠️ DUAS MARCAS PARA O MESMO FATO = UMA VARREDURA QUE ACHA METADE. O estoque REAL que já
    // existe em produção (agent-schedule.js) grava `delivery: "failed"`. Se este módulo gravasse só
    // `comprovante: "pendente"`, a varredura de reparo encontraria apenas os registros NOVOS e
    // deixaria os antigos para trás — exatamente o erro "conserta a causa, esquece o estoque" que
    // me custou o dia. As duas marcas saem juntas: a antiga para compatibilidade, a nova porque diz
    // de qual comprovante se trata.
    delivery: "failed",
    comprovante: "pendente", motivo: semCanal ? "sem_canal" : "provedor_recusou", detalhe: motivo,
    kind: p.kind || "book", ref: String(p.ref || ""), name: String(p.name || ""),
    email: String(p.email || ""), phone: String(p.phone || ""), whenLabel: String(p.whenLabel || ""),
    bloqueios,
  };
  const registrado = await seguro(() => registrar(env, {
    tenant: p.tenant, canal_label: semCanal ? "Phone" : "Email", resumo, payload: { ...pendencia, entrega_confirmada: false },
  }));
  const avisou_dono = await seguro(() => falha(env, semCanal ? "comprovante_sem_canal" : "comprovante_recusado",
    p.tenant, resumo, { ref: String(p.ref || ""), canal_tentado: semCanal ? "" : tentativas[tentativas.length - 1].canal }));

  return { ...base, estado: semCanal ? "sem_canal" : "recusado", motivo, registrado, avisou_dono, pendencia };
}

// Registrar/alertar é BÔNUS: nunca pode derrubar quem chamou (o agendamento já aconteceu).
// Devolve true/false para que o resultado diga a verdade sobre o que foi registrado — um
// `registrado: true` chutado seria a mesma classe de erro que este módulo existe para matar.
// ⚠️ `try { await fn(); return true }` DIZ SUCESSO PARA QUALQUER COISA QUE NÃO LANÇOU.
// `svcRpc` devolve uma Response — um 400 do Supabase (ou INGEST_SECRET ausente) não lança, então
// `registrado: true` saía sobre uma escrita que nunca aconteceu. É o mesmo engano que hoje me fez
// ler `200` de PATCH como "mudou" quando era "recebi": o resultado descrevia a chamada, não o
// efeito. Aqui a função tem que devolver algo verdadeiro sobre o ESTADO, e `false` é o único
// default honesto quando não dá para confirmar.
async function seguro(fn) {
  try {
    const r = await fn();
    if (r && typeof r === "object" && "ok" in r) return !!r.ok;  // Response do svcRpc
    return r !== false;
  } catch { return false; }
}

/**
 * repararComprovante(env, pendencia, extras?, deps?) — O CAMINHO DO ESTOQUE.
 *
 * Quem já está no banco sem comprovante não se conserta sozinho. Quando o dono (ou o CRM) obtém
 * o e-mail que faltava, isto reentrega usando o MESMO motor — nada de segunda lógica paralela,
 * que é como a primeira versão de uma regra e a cópia dela começam a divergir.
 *
 * `extras` traz o que a pendência não guardou (serviço, endereço, telefone da unidade…) e o
 * contato novo: `{ email }` sobrescreve o que falhou.
 * Em caso de sucesso, registra o FECHAMENTO da pendência — senão a varredura tentaria de novo
 * para sempre, e o dono continuaria vendo um alerta já resolvido.
 */
export async function repararComprovante(env, pendencia = {}, extras = {}, deps = {}) {
  const p = {
    tenant: pendencia.tenant || extras.tenant, kind: pendencia.kind || "book",
    name: pendencia.name, whenLabel: pendencia.whenLabel, ref: pendencia.ref,
    phone: pendencia.phone, ...extras,
    email: extras.email || pendencia.email,
  };
  const r = await entregarComprovante(env, p, deps);
  if (r.estado === "aceito") {
    const registrar = deps.registrar || ((e, ev) => registrarReal(e, ev));
    await seguro(() => registrar(env, {
      tenant: p.tenant, canal_label: r.canal === "email" ? "Email" : "SMS",
      resumo: `✅ Pendência de comprovante resolvida — ${p.name || "cliente"} recebeu por ${r.canal} (${r.destino})`,
      payload: { comprovante: "resolvido", ref: String(p.ref || ""), canal: r.canal, to: r.destino, entrega_confirmada: false },
    }));
  }
  return r;
}
