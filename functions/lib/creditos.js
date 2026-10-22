// functions/lib/creditos.js — O MEDIDOR DE CRÉDITO DOS CANAIS DE TEXTO.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE EXISTE (auditoria de lançamento, 2026-09-27)
// O plano é vendido como "N créditos/mês", mas só a LIGAÇÃO passava pelo medidor com razão
// (`consumir_creditos` → tabela `credit_usage`, em elevenlabs-webhook.js). Chat do site, SMS,
// WhatsApp e direct não tinham linha de razão nenhuma: o dono não consegue responder "em que
// gastei meus créditos?" para nada que não seja telefone.
//
// A POLÍTICA É A MESMA DA LIGAÇÃO, copiada e não reinventada (decisão do Luis, 2026-08-20):
//   · ISTO MEDE, NUNCA BLOQUEIA. A resposta já saiu quando o medidor roda; se ele falhar, o
//     atendimento vale e só o registro do consumo fica devendo — e isso vira falha visível.
//   · SALDO PODE FICAR NEGATIVO e a Gui continua atendendo. Canal mudo mata a conta do cliente;
//     saldo negativo se cobra depois.
//   · O AVISO DE ZERO SAI UMA VEZ: o banco devolve `cruzou_zero` só na transição.
//   · CONTA INTERNA (sim@, smart@, demo…) não consome — quem decide é o BANCO
//     (`client_credits.internal`), não uma lista copiada aqui que envelheceria.
//
// 🚨 POR QUE NASCE DESLIGADO (`CREDITOS_CANAIS` ≠ 1)
// Ao ler a função REAL no banco, apareceu o que a auditoria não viu: `ingest_client_event` JÁ
// desconta 2 créditos por evento `message`, por dentro, sem razão e sem alarme — é o mesmo
// "medidor escondido" que cobrava a ligação em dobro (db/ingest_nao_cobra_ligacao_duas_vezes.sql).
// Todo canal de texto grava `message` (o SMS grava TRÊS por troca). Ligar este medidor por cima
// cobraria o cliente duas vezes. Então ele fica inerte até a migração que zera `message` no
// medidor escondido entrar; aí `CREDITOS_CANAIS=1` no Cloudflare acende tudo, sem mudar código.
//
// O PREÇO VEM DE UM LUGAR SÓ: `CREDIT_COST` em src/data/productSystem.js — a mesma tabela que a
// calculadora de preço mostra ao cliente. Número redigitado aqui viraria uma segunda verdade.
import { CREDIT_COST } from "../../src/data/productSystem.js";
import { svcRpc, svcJson } from "./sb.js";
import { emitFailure } from "./failure.js";

// Mesma leitura de chave que comprovante.js usa (SMS_A2P_APROVADO, WHATSAPP_APROVADO).
export const ligado = (v) => ["1", "true", "sim", "yes", "on"].includes(String(v == null ? "" : v).trim().toLowerCase());

// ── QUAL TARIFA VALE PARA CADA CANAL ──────────────────────────────────────────────────────────
// A tabela de preço não tem linha para WhatsApp/Instagram/Messenger. Em vez de inventar um número,
// eles pegam emprestada a MENOR tarifa de mensagem que existe (`sms`). Na dúvida sobre dinheiro do
// cliente, cobra-se o menor. No dia em que o dono criar `CREDIT_COST.whatsapp`, a linha direta
// ganha sozinha — nada aqui precisa mudar.
const TARIFA_EMPRESTADA = { whatsapp: "sms", instagram: "sms", messenger: "sms" };

const precoValido = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);

// Custo unitário de um `kind`. 0 = não existe preço → o chamador NÃO debita (nunca se inventa).
export function custoDe(kind) {
  const k = String(kind || "").trim().toLowerCase();
  if (!k) return 0;
  const direto = Object.prototype.hasOwnProperty.call(CREDIT_COST, k) ? precoValido(CREDIT_COST[k]) : 0;
  if (direto) return direto;
  const emprestada = TARIFA_EMPRESTADA[k];
  return emprestada && Object.prototype.hasOwnProperty.call(CREDIT_COST, emprestada) ? precoValido(CREDIT_COST[emprestada]) : 0;
}

// A sonda do canário (functions/api/canary.js) conversa com o widget de um cliente REAL a cada
// 15 min, com sessionId "canary-…". Cobrar isso seria o cliente pagando pelo nosso monitoramento.
export const ehSonda = (sessionId) => /^canary-/i.test(String(sessionId || "").trim());

const diaUTC = (agora) => {
  const d = agora instanceof Date && !Number.isNaN(agora.getTime()) ? agora : new Date();
  return d.toISOString().slice(0, 10);
};
// Só o que é seguro dentro de uma referência: sem espaço, sem quebra, tamanho limitado.
const limpo = (s, n) => String(s == null ? "" : s).trim().replace(/[^a-zA-Z0-9_.@+=\/-]/g, "").slice(0, n);

// ── A REFERÊNCIA DO CHAT: UMA SESSÃO CUSTA UM "CHAT" POR DIA, não um por mensagem ─────────────
// O visitante manda 12 mensagens na mesma conversa → 12 chamadas com a MESMA referência → o banco
// cobra a primeira e devolve `repetido` nas outras 11.
// ⚠️ O TENANT ENTRA NA REFERÊNCIA. `credit_usage.ref` é única no banco INTEIRO, não por cliente,
// e o sessionId é escolhido pelo navegador: sem o e-mail, a sessão "abc" do site A deixaria de
// graça a sessão "abc" do site B.
export function refChat(email, sessionId, agora) {
  const t = limpo(String(email || "").toLowerCase(), 120);
  const s = limpo(sessionId, 64);
  if (!t || !s) return "";
  return `chat:${t}:${s}:${diaUTC(agora)}`;
}

// ── A REFERÊNCIA DA MENSAGEM: o id que o PROVEDOR deu para a mensagem recebida ────────────────
// (MessageSid da Twilio, wamid da Meta, mid do direct). É ele que o provedor repete quando
// reentrega o webhook — então reentrega nunca cobra duas vezes. Sem id não há referência, e sem
// referência não se debita: cobrança que não dá para provar idempotente não sai.
const PREFIXO = { sms: "sms", whatsapp: "wa", instagram: "ig", messenger: "msgr", email: "email" };
export function refMensagem(canal, idDoProvedor) {
  const p = PREFIXO[String(canal || "").trim().toLowerCase()];
  const id = limpo(idDoProvedor, 200);
  if (!p || !id) return "";
  return `${p}:${id}`;
}

const recibo = (ok, debitado, saldo, motivo) => ({ ok, debitado, saldo: saldo == null ? null : saldo, motivo });

// ── debitar ───────────────────────────────────────────────────────────────────────────────────
// debitar(env, { email, kind, ref, qtd }) → { ok, debitado, saldo, motivo }
//   ok       = o medidor está num estado CORRETO (debitou, ou pulou porque devia pular).
//              false = devia ter medido e não mediu.
//   debitado = créditos que saíram AGORA (0 em repetição, conta interna, sonda, desligado).
//   saldo    = saldo depois, quando o banco informou; null quando não houve consulta.
//   motivo   = por quê, em palavra fixa: debitado | cruzou_zero | ja_debitado | conta_interna |
//              sonda | medidor_desligado | sem_tenant | sem_ref | kind_sem_preco | falha_rpc | erro
// NUNCA lança. NUNCA bloqueia a resposta: o chamador usa `debitarDepois` (waitUntil).
// `emitFailure` só sai em falha REAL de medição — "já debitado" é o sistema funcionando.
// ── A CHAVE (2026-09-27) ──────────────────────────────────────────────────────────────────────
// O Luis aprovou: "adota a tarifa da tabela e liga o medidor". A chave mora em DOIS lugares, e
// qualquer um liga: env `CREDITOS_CANAIS=1` (Cloudflare) ou platform_settings `creditos_canais=on`
// (banco — liga/desliga sem deploy, na mesma hora em que a migração zera o medidor escondido).
// Lida do banco no máximo 1×/min por isolate: medir não pode custar uma consulta por mensagem.
// Erro ao ler = DESLIGADO: na dúvida não se cobra (o oposto do silenciador de alarme, de propósito
// — alarme a mais incomoda; cobrança a mais tira dinheiro do cliente).
let CHAVE_CACHE = { em: 0, on: false };
export async function medidorLigado(env) {
  if (ligado(env && env.CREDITOS_CANAIS)) return true;
  if (!env || !env.INGEST_SECRET) return false;
  if (Date.now() - CHAVE_CACHE.em < 60000) return CHAVE_CACHE.on;
  let on = false;
  try {
    const s = await svcJson(env, "platform_settings_get", { p_secret: env.INGEST_SECRET });
    on = !!s && typeof s === "object" && s.ok !== false && ligado(s.creditos_canais);
  } catch { on = false; }
  CHAVE_CACHE = { em: Date.now(), on };
  return on;
}

// ── TETO DIÁRIO DE CHATS POR CLIENTE (2026-09-27) ─────────────────────────────────────────────
// A ref do chat é por SESSÃO, e o sessionId vem do navegador: quem trocar de sessão a cada
// mensagem gera um "chat" novo por mensagem e queima o crédito do dono do site. Passou do teto no
// dia, o chat CONTINUA respondendo (nunca bloqueamos atendimento) mas para de debitar, e o dono da
// plataforma é avisado uma vez. Sem KV o teto não existe — o freio por IP do widget continua.
const TETO_CHATS_DIA = 150;
async function passouDoTeto(env, tenant) {
  try {
    const kv = env && env.RATE_LIMIT;
    if (!kv) return false;
    const chave = `chatdia:${tenant}:${new Date().toISOString().slice(0, 10)}`;
    const n = parseInt((await kv.get(chave)) || "0", 10) + 1;
    await kv.put(chave, String(n), { expirationTtl: 172800 });
    if (n === TETO_CHATS_DIA + 1) {
      await emitFailure(env, "chat_teto_diario", tenant, `${tenant} passou de ${TETO_CHATS_DIA} conversas de chat hoje — possível abuso; o chat segue respondendo, o débito parou até amanhã`, {}).catch(() => {});
    }
    return n > TETO_CHATS_DIA;
  } catch { return false; }
}

export async function debitar(env, { email, kind, ref, qtd = 1 } = {}) {
  try {
    if (!(await medidorLigado(env))) return recibo(true, 0, null, "medidor_desligado");

    const tenant = String(email || "").trim().toLowerCase();
    const k = String(kind || "").trim().toLowerCase();
    const r = String(ref || "").trim();
    if (!tenant.includes("@")) return recibo(false, 0, null, "sem_tenant");
    if (!r) return recibo(false, 0, null, "sem_ref");
    // Cinto e suspensório: o chamador já pula a sonda, mas a regra mora AQUI também, porque o
    // próximo canal a ser ligado vai esquecer.
    if (/(^|:)canary-/i.test(r)) return recibo(true, 0, null, "sonda");

    const unitario = custoDe(k);
    if (!unitario) return recibo(false, 0, null, "kind_sem_preco");
    if (k === "chat" && await passouDoTeto(env, tenant)) return recibo(true, 0, null, "teto_diario");
    // `qtd` é multiplicador inteiro. Teto baixo de propósito: um bug que mande qtd=5000 não pode
    // zerar a conta de ninguém numa chamada só.
    const n = Math.min(20, Math.max(1, Math.floor(Number(qtd)) || 1));
    const creditos = unitario * n;

    const resp = await svcRpc(env, "consumir_creditos", {
      p_secret: (env && env.INGEST_SECRET) || "", p_email: tenant,
      p_credits: creditos, p_kind: k, p_ref: r,
    });
    // `resp.ok` é o "deu 200?" do HTTP, não o `{ok:true}` da função (a armadilha descrita em sb.js).
    const d = resp && resp.ok ? await resp.json().catch(() => null) : null;

    if (!d || d.ok !== true) {
      const porque = (d && d.motivo) || `HTTP ${resp ? resp.status : "?"}`;
      await emitFailure(env, "credito_nao_medido", tenant,
        `Não consegui debitar ${creditos} crédito(s) de ${k} (${r}): ${porque}`, { ref: r, kind: k }).catch(() => {});
      return recibo(false, 0, null, "falha_rpc");
    }
    if (d.repetido) return recibo(true, 0, d.saldo, "ja_debitado");
    if (d.interno) return recibo(true, 0, d.saldo, "conta_interna");

    const cobrado = Number.isFinite(Number(d.cobrado)) ? Number(d.cobrado) : creditos;
    if (d.cruzou_zero) {
      // Mesmo texto e mesmo tipo da ligação: o dono recebe UM aviso por queda, venha de onde vier.
      await emitFailure(env, "credito_zerado", tenant,
        `Créditos de ${tenant} chegaram a ${d.saldo}. A agente CONTINUA atendendo (decisão do Luis) — cobre a recarga.`,
        { saldo: d.saldo, antes: d.antes, ref: r, kind: k }).catch(() => {});
      return recibo(true, cobrado, d.saldo, "cruzou_zero");
    }
    return recibo(true, cobrado, d.saldo, "debitado");
  } catch (e) {
    try {
      await emitFailure(env, "credito_nao_medido", String(email || ""),
        `Falha ao medir crédito (${String(ref || "").slice(0, 80)}): ${String(e).slice(0, 140)}`, {});
    } catch { /* o medidor nunca derruba quem chamou */ }
    return recibo(false, 0, null, "erro");
  }
}

// ── debitarDepois ─────────────────────────────────────────────────────────────────────────────
// O jeito certo de chamar de dentro de uma rota: a medição roda DEPOIS da resposta sair
// (context.waitUntil). Sem waitUntil (teste, runtime antigo) espera a promessa — que nunca lança.
export async function debitarDepois(context, env, args) {
  const p = debitar(env, args);
  if (context && typeof context.waitUntil === "function") { context.waitUntil(p); return null; }
  return p;
}
