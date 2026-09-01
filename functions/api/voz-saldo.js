// Cloudflare Pages Function — GET/POST /api/voz-saldo?token=DIGEST_TOKEN
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// O ALARME DE SALDO DA VOZ — o motor que faltava quando a linha de um cliente caiu em silêncio.
//
// POR QUE ELE EXISTE (incidente real, 21/08 02:50–02:54 UTC):
// Seis ligações para a linha da Natura Spa — cliente PAGANTE — morreram com
// `termination_reason: "This request cannot be processed due to a payment issue"`. A pendência era
// da NOSSA conta na ElevenLabs, não do plano dela. Ninguém foi avisado. Só descobri 11 dias depois,
// lendo transcrições por outro motivo. Enquanto isso, seis pessoas ligaram para um salão e não
// foram atendidas — e o dono não soube que perdeu.
//
// A LIÇÃO QUE ELE CODIFICA: uma pendência financeira NOSSA derruba a operação do CLIENTE, e o
// caminho da descoberta era o cliente reclamar. Todo motor que depende de saldo externo precisa de
// alguém olhando o saldo — senão o produto tem um interruptor que qualquer boleto atrasado desliga.
//
// DUAS SONDAS, e a segunda é a que realmente importa:
//   1. SALDO — quanto resta da cota de caracteres/créditos e se a assinatura está ativa. É o AVISO
//      (chega antes de quebrar).
//   2. LIGAÇÕES MORTAS POR PAGAMENTO — varre as conversas recentes procurando o termination_reason
//      exato do incidente. É o FLAGRANTE (já quebrou, e diz quantas ligações custou).
//   A sonda 1 sozinha não bastaria: a cota pode estar cheia e a conta ainda ser recusada por cartão.
//   A sonda 2 sozinha chegaria tarde. Juntas, uma avisa e a outra confere.
//
// 🚨 SEM FALLBACK VERDE. Se a API não responde, o estado é `desconhecido`, NUNCA `ok`. Um monitor
// que reporta saúde quando está cego é o "canário verde, cérebro morto" — o defeito que este
// arquivo existe para não repetir. `ok:false` no JSON quando qualquer sonda não pôde ser lida.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import { json, safeEq } from "../lib/guard.js";
import { sbKey } from "../lib/sb.js";
import { opsAlertEmail } from "../lib/emailTemplates.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const API = "https://api.elevenlabs.io";
const TIMEOUT_MS = 10000;

// Abaixo disto o saldo vira alarme. 15% de uma cota mensal é ~4 dias de operação num volume
// modesto — tempo suficiente para pagar antes de alguém ligar e não ser atendido.
const LIMIAR_SALDO = 0.15;
// Janela do flagrante. 26h (não 24) para nunca abrir buraco entre dois tiques de hora em hora.
const JANELA_HORAS = 26;
// A frase exata que a ElevenLabs devolveu no incidente. Guardada literal porque foi ela que
// apareceu no transcript — casar por "payment" sozinho pegaria falha de pagamento DO CLIENTE
// (pay-link recusado), que é outro problema, com outro dono e outro alarme.
const MARCA_PAGAMENTO = "payment issue";

async function rpc(env, fn, args) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", ...args }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

const H = (env) => ({ "xi-api-key": env.ELEVENLABS_API_KEY || "" });

// ── SONDA 1: o saldo ────────────────────────────────────────────────────────────────────────────
// Devolve SEMPRE um objeto com `lido` — a diferença entre "li e está bom" e "não consegui ler" é a
// única coisa que separa um monitor de um enfeite.
async function sondaSaldo(env) {
  if (!env.ELEVENLABS_API_KEY) return { lido: false, motivo: "ELEVENLABS_API_KEY ausente no ambiente" };
  try {
    const r = await fetch(`${API}/v1/user/subscription`, { headers: H(env), signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!r.ok) return { lido: false, motivo: `assinatura HTTP ${r.status}` };
    const s = await r.json();
    const usado = Number(s.character_count ?? 0);
    const limite = Number(s.character_limit ?? 0);
    // Limite zero não é "100% livre": é leitura que não dá para interpretar. Dizer isso.
    if (!limite) return { lido: false, motivo: "character_limit veio 0 ou ausente", status: s.status || null };
    const restante = Math.max(0, limite - usado);
    const fracao = restante / limite;
    return {
      lido: true,
      status: s.status || "desconhecido",
      tier: s.tier || null,
      usado, limite, restante,
      pct_restante: Math.round(fracao * 1000) / 10,
      renova_em: s.next_character_count_reset_unix
        ? new Date(s.next_character_count_reset_unix * 1000).toISOString() : null,
      // Dois motivos independentes de alarme: pouco saldo OU assinatura fora de "active"
      // (é aqui que um cartão recusado aparece antes de derrubar ligação).
      baixo: fracao < LIMIAR_SALDO,
      inativa: !!s.status && String(s.status).toLowerCase() !== "active",
    };
  } catch (e) { return { lido: false, motivo: `falha ao ler assinatura: ${String(e).slice(0, 120)}` }; }
}

// ── SONDA 2: o flagrante ────────────────────────────────────────────────────────────────────────
// Varre as conversas recentes procurando ligações que MORRERAM por pagamento. É a sonda que teria
// avisado no dia 21 — e que devolve o dado que interessa ao dono: quantas ligações, em qual linha.
async function sondaLigacoesMortas(env) {
  if (!env.ELEVENLABS_API_KEY) return { lido: false, motivo: "ELEVENLABS_API_KEY ausente no ambiente" };
  const desde = Math.floor(Date.now() / 1000) - JANELA_HORAS * 3600;
  try {
    const r = await fetch(
      `${API}/v1/convai/conversations?page_size=100&call_start_after_unix=${desde}`,
      { headers: H(env), signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!r.ok) return { lido: false, motivo: `conversas HTTP ${r.status}` };
    const data = await r.json();
    const lista = Array.isArray(data.conversations) ? data.conversations : [];
    const mortas = lista.filter((c) =>
      String(c.termination_reason || "").toLowerCase().includes(MARCA_PAGAMENTO));
    // Agrupar por agente: o dono não quer saber "6 ligações", quer saber "6 ligações NA LINHA DA
    // NATURA" — é isso que decide se ele liga para o cliente pedindo desculpa.
    const porAgente = {};
    for (const c of mortas) {
      const k = c.agent_name || c.agent_id || "agente desconhecido";
      porAgente[k] = (porAgente[k] || 0) + 1;
    }
    return {
      lido: true,
      janela_horas: JANELA_HORAS,
      total_conversas: lista.length,
      mortas_por_pagamento: mortas.length,
      por_agente: porAgente,
      exemplos: mortas.slice(0, 5).map((c) => ({
        conversation_id: c.conversation_id,
        agente: c.agent_name || c.agent_id,
        quando: c.start_time_unix_secs ? new Date(c.start_time_unix_secs * 1000).toISOString() : null,
      })),
    };
  } catch (e) { return { lido: false, motivo: `falha ao ler conversas: ${String(e).slice(0, 120)}` }; }
}

// ── O aviso ─────────────────────────────────────────────────────────────────────────────────────
// Balde de 6h por TIPO: o flagrante e o saldo baixo são problemas diferentes e não podem calar um
// ao outro. Sem a trava, um saldo baixo persistente mandaria e-mail de hora em hora e treinaria o
// dono a ignorar — que é como um alarme morre sem ninguém desligar.
async function avisar(env, out, tipo, detalhe) {
  if (!env.RESEND_API_KEY) { out.email = { enviado: false, motivo: "RESEND_API_KEY ausente" }; return; }
  const OWNER = (env.OWNER_EMAIL || "smart@guileoai.com").toString().split(",")[0].trim();
  const agora = new Date();
  const balde = `${agora.toISOString().slice(0, 10)}-${Math.floor(agora.getUTCHours() / 6)}`;
  const claimed = await rpc(env, "health_claim", { p_email: OWNER.toLowerCase(), p_kind: `voz_saldo_${tipo}_${balde}` });
  if (claimed === null) { out.email = { enviado: false, motivo: "health_claims.sql não colado" }; out.alertReady = false; return; }
  if (claimed !== true) { out.email = { enviado: false, motivo: "já avisado neste balde de 6h" }; return; }
  try {
    const { subject, html } = opsAlertEmail({
      type: `voz_${tipo}`, client: "Guileo (conta de voz — afeta TODOS os clientes)", detail: detalhe,
      cta: "Abrir a conta da ElevenLabs →", ctaUrl: "https://elevenlabs.io/app/subscription",
    });
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: OWNER, subject, html }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // Conferir o `ok`: alarme que a Resend recusou é o mesmo silêncio que este arquivo veio matar.
    if (!r.ok) { out.email = { enviado: false, motivo: `resend HTTP ${r.status}` }; console.error(JSON.stringify({ voz_saldo_email: tipo, resend: r.status })); return; }
    out.email = { enviado: true, tipo, para: OWNER };
  } catch (e) {
    out.email = { enviado: false, motivo: String(e).slice(0, 120) };
    console.error(JSON.stringify({ voz_saldo_email: tipo, erro: String(e).slice(0, 120) }));
  }
}

async function run(request, env) {
  const url = new URL(request.url);
  const tok = url.searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
  const ok = (env.DIGEST_TOKEN && safeEq(tok, env.DIGEST_TOKEN)) || (env.ADMIN_PASS && safeEq(tok, env.ADMIN_PASS));
  if (!ok) return json({ error: "unauthorized", dica: "use o token do cron OU a senha do /admin" }, 401);

  const out = { ok: true, alertReady: true, quando: new Date().toISOString() };
  const [saldo, ligacoes] = await Promise.all([sondaSaldo(env), sondaLigacoesMortas(env)]);
  out.saldo = saldo;
  out.ligacoes = ligacoes;

  // Cego é DIFERENTE de saudável. Se qualquer sonda não pôde ser lida, o motor não diz que está bom.
  if (!saldo.lido || !ligacoes.lido) {
    out.ok = false;
    out.estado = "desconhecido";
    out.porque = [!saldo.lido && `saldo: ${saldo.motivo}`, !ligacoes.lido && `ligações: ${ligacoes.motivo}`]
      .filter(Boolean).join(" · ");
  }

  // O FLAGRANTE tem prioridade: ligação perdida já é dano no cliente, saldo baixo ainda é aviso.
  if (ligacoes.lido && ligacoes.mortas_por_pagamento > 0) {
    out.estado = "quebrado";
    out.ok = false;
    const onde = Object.entries(ligacoes.por_agente).map(([a, n]) => `${a}: ${n}`).join(" · ");
    await avisar(env, out, "ligacoes_mortas",
      `${ligacoes.mortas_por_pagamento} ligação(ões) morreram por pendência de pagamento na conta de voz nas últimas ${JANELA_HORAS}h. ` +
      `Onde: ${onde}. Estas pessoas ligaram para um cliente e NÃO foram atendidas. ` +
      `Regularize a conta e avise o cliente afetado antes que ele descubra sozinho.`);
  } else if (saldo.lido && (saldo.baixo || saldo.inativa)) {
    out.estado = "atencao";
    const motivo = saldo.inativa
      ? `assinatura com status "${saldo.status}" (não está ativa)`
      : `restam ${saldo.pct_restante}% da cota (${saldo.restante.toLocaleString("pt-BR")} de ${saldo.limite.toLocaleString("pt-BR")})`;
    await avisar(env, out, saldo.inativa ? "assinatura_inativa" : "saldo_baixo",
      `${motivo}. Quando isso zera, as ligações de TODOS os clientes param de ser atendidas — e o modo de falha é silencioso: ` +
      `a ligação cai, o cliente não sabe, e quem liga para ele desiste. ${saldo.renova_em ? `Renova em ${saldo.renova_em}.` : ""}`);
  } else if (out.ok) {
    out.estado = "ok";
  }

  return json(out);
}

export const onRequestGet = ({ request, env }) => run(request, env);
export const onRequestPost = ({ request, env }) => run(request, env);
