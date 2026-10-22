// Cloudflare Pages Function — GET/POST /api/cron-tick · O DESPERTADOR da plataforma.
// ─────────────────────────────────────────────────────────────────────────────
// Pages não tem cron nativo, então um Worker minúsculo (cron-worker/) com cron trigger
// chama ESTE endpoint a cada 15 min. Ele faz o fan-out para todos os sweeps internos
// usando env.DIGEST_TOKEN do lado do servidor — o Worker não carrega segredo nenhum.
//
// SEGURANÇA (por que pode ser público): cada sweep chamado aqui é IDEMPOTENTE por
// construção (drip_claim / marketing_date_claim / risk_confirm_claim / janela única do
// reconcile / opt-in do collections) — um atacante martelando isto no máximo ADIANTA
// um envio que já ia acontecer, nunca duplica nem dispara nada novo. Ainda assim:
// rate-limit forte (4/h por IP) + os endpoints de destino continuam token-gated.
//
// Cadência: o Worker chama a cada 15 min; os pesados (proactive/nps/reconcile) só
// rodam na janela horária certa pra não desperdiçar subrequests.
import { json, rateLimited } from "../lib/guard.js";
import { svcRpc, svcJson } from "../lib/sb.js";
import { avisarDono } from "../lib/avisarDono.js";
import { semeiaFila, drenaFila, semeiaEval, drenaEval, semeiaRelatorios, drenaRelatorios } from "../lib/filaAgente.js";

// ── O INTERRUPTOR GERAL DOS MOTORES PROATIVOS (auditoria de lançamento, 2026-09-22) ─────────────
// POR QUE EXISTE: entre 03 e 09/09 um ataque de fraude de tarifa (+972) zerou a Twilio, e em 22/09
// a conta seguia suspensa (401) com a Anthropic sem saldo. Nessa hora a pergunta certa é "como eu
// paro TUDO que fala com o cliente final por conta própria, agora, sem deploy?" — e não havia
// resposta: cada motor tinha (quando tinha) o seu interruptor por tenant, nenhum tinha o geral.
//
// O QUE ELE DESLIGA — só o que escreve/liga para o CLIENTE FINAL sem ninguém ter pedido:
//   proactive (aniversário, win-back, datas, retorno de orçamento) · cx-survey · nps ·
//   automations (texto de risco de falta + promoção de dia fraco) · phoneReengageSweep (discagem).
// O QUE ELE NÃO DESLIGA: lembrete de horário JÁ MARCADO (transacional — a pessoa pediu), soltura
// de reserva vencida, monitores, backup, alarmes ao dono. Desligar lembrete troca spam por no-show.
//
// DOIS LUGARES, UM SENTIDO: env `MOTORES_PROATIVOS=off` (Cloudflare — não depende de banco) OU
// platform_settings `motores_proativos = "off"` (banco — sem deploy). Qualquer um dos dois desliga.
//
// PADRÃO = LIGADO. Setting ausente não muda comportamento nenhum: um interruptor novo que nasce
// desligado seria uma mudança silenciosa de produto no dia do deploy. E leitura que FALHA também
// fica ligada, mas com a `fonte` dizendo "ilegivel" — "não consegui ler" e "está ligado" não podem
// ter a mesma cara na resposta. Quem precisa de garantia com o banco fora usa a env.
export async function motoresEstado(env) {
  try {
    if (String((env && env.MOTORES_PROATIVOS) || "").trim().toLowerCase() === "off") return { ativos: false, fonte: "env" };
    if (!env || !env.INGEST_SECRET) return { ativos: true, fonte: "padrao (sem INGEST_SECRET, banco não consultado)" };
    const s = await svcJson(env, "platform_settings_get", { p_secret: env.INGEST_SECRET }).catch(() => null);
    // svcJson devolve {ok:false, erro_http} em falha de transporte — isso NÃO é um settings vazio.
    if (!s || typeof s !== "object" || Array.isArray(s) || s.ok === false) return { ativos: true, fonte: "ilegivel" };
    const v = String(s.motores_proativos ?? "").trim().toLowerCase();
    if (v === "off") return { ativos: false, fonte: "banco" };
    return { ativos: true, fonte: v ? "banco" : "padrao" };
  } catch { return { ativos: true, fonte: "ilegivel" }; }
}
export async function motoresAtivos(env) {
  return (await motoresEstado(env)).ativos;
}

// ── 200 NÃO É "DEU CERTO" (auditoria de lançamento, 2026-09-22) ─────────────────────────────────
// O cron lia só o status HTTP de cada alvo. O lifecycle respondeu 200 com `{ok:false, error:"lead
// store unreachable"}` por 12 DIAS (ADMIN_TOKEN errado) e o cron o listou como saudável em todos
// os ~1.150 tiques. É a armadilha que sb.js já descreve para RPC, só que um andar acima: `r.ok`
// é o "deu 200?" do HTTP, não o `ok` que a rota escreveu no corpo.
//
// TRÊS ESTADOS, não dois — porque alarme que toca todo dia por motivo conhecido é alarme que
// ninguém mais lê:
//   · falhou   → HTTP não-2xx, OU 200 com `ok:false`. Entra em `falhas` e avisa o dono.
//   · inerte   → `ok:false` com `ready:false`/`pronto:false`: o motor se declara NÃO LIGADO (chave
//                externa que falta, SQL não colado). É o "honesto-inerte" da casa: aparece na
//                resposta (`inertes`), não acorda ninguém.
//   · calado   → `desligado` / `mudo` / `skipped` / `pulou`: alguém DECIDIU que não rodasse
//                (interruptor geral, e-mails do dono mudos, trava do dia). Não é falha.
// Função pura e exportada de propósito: dá para provar com `node` sem subir servidor.
export function leAlvo(status, httpOk, texto) {
  const st = Number(status) || 0;
  let corpo = null;
  try { corpo = texto ? JSON.parse(texto) : null; } catch { corpo = null; }
  const obj = corpo && typeof corpo === "object" && !Array.isArray(corpo) ? corpo : null;
  const motivoDe = (o) => (o && (o.error || o.erro || o.motivo || o.reason || o.nota || o.note) || "").toString().slice(0, 120);
  if (!httpOk) {
    // O motivo curto vai junto: "500" sozinho é o mesmo silêncio com outro número.
    return { marca: st, falhou: true, inerte: false, motivo: st ? (motivoDe(obj) || String(texto || "").slice(0, 120)) : "sem resposta (fetch lançou)" };
  }
  if (!obj) return { marca: st, falhou: false, inerte: false, motivo: "" };
  if (obj.desligado === true) return { marca: `${st} desligado`, falhou: false, inerte: false, motivo: "" };
  if (obj.ok !== false) return { marca: st, falhou: false, inerte: false, motivo: "" };
  if (obj.mudo || obj.skipped || obj.pulou) return { marca: `${st} calado`, falhou: false, inerte: false, motivo: motivoDe(obj) };
  if (obj.ready === false || obj.pronto === false) return { marca: `${st} inerte`, falhou: false, inerte: true, motivo: motivoDe(obj) };
  return { marca: `${st} ok:false`, falhou: true, inerte: false, motivo: motivoDe(obj) || "a rota respondeu ok:false sem dizer o motivo" };
}

// PHONE RE-ENGAGEMENT EXECUTOR (#19) — turns a queued churn-reengage / booking-recovery
// client_event that carries a PHONE (not an email) into a REAL Gui callback through the single
// hardened /api/call gate. The email path already fires instantly in growth-intel.js; phone-only
// intents were logged ("queued") but nothing ever dialed them. This sweep closes that gap.
// SAFETY, in layers:
//   • CLAIM-DEDUPED — phone_reengage_claim wins each event exactly once, so a re-run (or a
//     concurrent tick) can NEVER double-dial the same intent. We claim BEFORE dialing so a failed
//     dial doesn't cause a retry storm and no other tick can also grab it.
//   • TCPA — only dials inside a conservative US calling window (16:00–00:59 UTC ≈ 8am PT–9pm ET,
//     DST-safe) because we don't capture each callee's timezone; the /api/call gate still enforces
//     the DNC / STOP opt-out list + a per-destination cooldown on top of this.
//   • PER-TENANT — dials AS the client's OWN Gui (client_email → server-side agent resolve in call.js),
//     never a cross-tenant leak: the event's client_email IS the tenant.
//   • COST — shares speed-to-lead's global daily auto-call cap (KV callday:<date>, 150) + a per-tick cap.
// service_role only (svcRpc): the RPCs return phone PII cross-tenant AND trigger paid calls, so they
// are NOT granted to anon. Inert no-op (honest note, never a fake "dialed") until db/phone_reengage.sql
// is pasted AND SUPABASE_SERVICE_ROLE is set.
async function phoneReengageSweep(env, base, hourUTC) {
  const out = { due: 0, dialed: 0, skipped: 0 };
  if (!env.INGEST_SECRET) return { ...out, note: "INGEST_SECRET missing" };
  // TCPA calling-window guard — outside it we place no unsolicited calls.
  if (!(hourUTC >= 16 || hourUTC < 1)) return { ...out, note: "outside call window" };
  let rows;
  try {
    const r = await svcRpc(env, "phone_reengage_due", { p_secret: env.INGEST_SECRET, p_limit: 30 });
    if (!r.ok) return { ...out, note: "phone_reengage_due unavailable (paste db/phone_reengage.sql / set SUPABASE_SERVICE_ROLE)" };
    rows = await r.json().catch(() => null);
  } catch { return { ...out, note: "read failed" }; }
  if (!Array.isArray(rows) || !rows.length) return out;
  out.due = rows.length;

  const MAX_DIALS = 15;                                    // per-tick ceiling (backstop to the daily cap)
  const dayKey = `callday:${new Date().toISOString().slice(0, 10)}`;
  for (const row of rows) {
    if (out.dialed >= MAX_DIALS) break;
    const email = ((row && row.client_email) || "").toString().trim().toLowerCase();
    const phone = ((row && row.contact) || "").toString().replace(/[^0-9+]/g, "");
    const evId = ((row && row.event_id) || "").toString();
    if (!email.includes("@") || !/^\+?[1-9]\d{7,14}$/.test(phone) || !evId) { out.skipped++; continue; }

    // GLOBAL DAILY CAP (shared with lead.js speed-to-lead) — a hard ceiling on autonomous outbound calls.
    if (env.RATE_LIMIT) {
      try { if (parseInt((await env.RATE_LIMIT.get(dayKey)) || "0", 10) >= 150) { out.skipped++; break; } }
      catch { /* KV down → call.js fail-closed caps backstop */ }
    }

    // CLAIM FIRST — win the event before dialing. Only the winner proceeds (idempotent across ticks).
    let won = false;
    try {
      const cr = await svcRpc(env, "phone_reengage_claim", { p_secret: env.INGEST_SECRET, p_event_id: evId, p_client_email: email });
      won = cr.ok && (await cr.json().catch(() => false)) === true;
    } catch { won = false; }
    if (!won) { out.skipped++; continue; }

    // DIAL through the single hardened gate — DNC + per-destination cooldown enforced inside call.js;
    // Origin + x-guileo-internal (== DIGEST_TOKEN) are required by that gate for an internal dial.
    try {
      const cr = await fetch(`${base}/api/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: base, "x-guileo-internal": env.DIGEST_TOKEN || "" },
        body: JSON.stringify({
          phone,
          client_email: email,                              // → the client's own Gui (per-tenant agent resolve)
          name: ((row && row.name) || "").toString().slice(0, 120),
          need: (row && row.kind) === "booking-recovery" ? "Retomar o agendamento que ficou pela metade" : "Reativar cliente (risco de perder)",
          lang: "auto",
        }),
      });
      if (cr.ok) {
        out.dialed++;
        if (env.RATE_LIMIT) { try { const n = parseInt((await env.RATE_LIMIT.get(dayKey)) || "0", 10); await env.RATE_LIMIT.put(dayKey, String(n + 1), { expirationTtl: 172800 }); } catch { /* KV down → IP caps backstop */ } }
      } else { out.skipped++; }
    } catch { out.skipped++; }
  }
  return out;
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    if (await rateLimited(request, env, "cron-tick", 4)) return json({ error: "too many requests" }, 429);
    if (!env.DIGEST_TOKEN) return json({ ok: false, note: "DIGEST_TOKEN not configured" }, 501);

    // `?semaforo=1` força a leitura AGORA, fora do tique da hora. Existe porque a pergunta
    // "está tudo funcionando?" se faz na hora em que se decide receber cliente — não na hora
    // em que o relógio permite. É leitura pura, e o rate-limit de 4/h por IP já segura abuso.
    const url = new URL(request.url);
    const forcarSemaforo = url.searchParams.get("semaforo") === "1";
    // `?fila=1` força o ciclo da fila fora do tique da hora. Motor que só dá para provar
    // esperando a virada da hora é motor que ninguém prova — e o que não se prova, apodrece.
    const forcarFila = url.searchParams.get("fila") === "1";
    const base = "https://guileoai.com";
    const t = encodeURIComponent(env.DIGEST_TOKEN);
    const hourUTC = new Date().getUTCHours();
    const minute = new Date().getUTCMinutes();
    // ⚠️ DECLARADO AQUI, NÃO LÁ EMBAIXO (2026-09-09). `evalSemente` era um `let` declarado DEPOIS
    // do bloco das 00h que o atribui — zona morta temporal: todo tique da meia-noite estourava
    // ReferenceError antes de chamar alvo nenhum, o catch final devolvia 500, e o Worker (que
    // ignora a resposta) seguia feliz. Uma hora inteira de cron morta todo dia, sem uma linha
    // acusando. Achado ao ler o arquivo para ligar o alarme de alvo falho — o próprio alarme teria
    // apontado isto no primeiro dia.
    let evalSemente = null;

    // O interruptor geral é lido UMA vez por tique (uma consulta) e vale para o tique inteiro.
    const motores = await motoresEstado(env);

    // every tick (15 min): operational engines (all claim-protected)
    const targets = [
    // VARREDURA SOCIAL — TODO TIQUE (15 min), não de hora em hora.
    // Publica o post agendado que venceu e o que o dono aprovou enquanto a Meta estava inerte.
    // Sem ela o motor social era decorativo: `social_posts_claim_due` existia, ninguém chamava, e
    // o cockpit dizia "Agendado" para um post que nunca sairia.
    // POR QUE TODO TIQUE: post agendado tem HORA. No bloco horário, um post marcado para 14:30 só
    // sairia às 15:00 — até 60 min atrasado, e o dono veria "Agendado" o tempo todo sem entender.
    // A 15 min o atraso máximo é 15. Rodar mais vezes é barato: sem nada pendente, é uma consulta
    // que volta vazia.
    // SÓ PÔDE SER LIGADA depois que a reserva virou porta única dentro de publishRow(): antes,
    // ligar a varredura republicaria o post que o cockpit estava publicando naquele instante.
    // Reserva ANTES de enviar → re-rodar nunca publica duas vezes. Inerte e honesta sem META_APP_*.
      // ⚠️ `automations` CONTINUA NA LISTA mesmo com os motores proativos desligados, de propósito:
      // a mesma rota solta a reserva provisória vencida (ENGINE 0), que não fala com ninguém e, se
      // parar, deixa horário bloqueado por horas. Quem obedece ao interruptor é a própria rota —
      // ela pula os dois motores de mensagem e responde `desligado:true`.
      { name: "automations", url: `${base}/api/automations?token=${t}` },
      // LEMBRETE DE HORÁRIO, DE HORA EM HORA (2026-08-16). Só a parte transacional — o marketing
      // continua na rodada diária das 13h. Antes, o lembrete só existia 1×/dia com janela de 24h,
      // então reserva criada depois da rodada para o dia seguinte NUNCA era lembrada. No-show é a
      // perda mais cara depois da venda perdida, e essa era invisível: o dono lia como "faltou".
      // Barato quando não há nada vencendo: uma consulta que volta vazia.
      // MINDBODY — o que mudou LÁ volta para cá ANTES do lembrete (2026-09-30): horário cancelado
      // ou remarcado dentro do MindBody não pode receber lembrete nem pedido de avaliação. Sem
      // negócio com MindBody ativo é uma consulta que volta vazia.
      { name: "mindbody-sync", url: `${base}/api/mindbody?sync=1&token=${t}` },
      { name: "lembretes", url: `${base}/api/proactive?apenas=lembretes&token=${t}` },
      { name: "lifecycle", url: `${base}/api/lifecycle?token=${t}` },
      { name: "social-sweep", url: `${base}/api/social-publish?sweep=1&token=${t}` },
      // REDE DO COMENTÁRIO→DM, todo tique (2026-08-28). O motor depende de a Meta ENTREGAR o
      // webhook; ela reentrega, mas até certo ponto. Quando desiste, o comentário some sem deixar
      // linha nenhuma — "ninguém comentou" e "perdemos" ficam com a MESMA cara. Esta varredura lê
      // os comentários recentes e processa os que escaparam, pela MESMA função do webhook.
      // POR QUE TODO TIQUE E NÃO DE HORA EM HORA: a promessa é responder em segundos. Recuperar 50
      // minutos depois é tarde para quem perguntou preço. A 15 min o atraso máximo é 15.
      // BARATA quando não há nada: janela de 6h, e comentário já tratado morre na reserva atômica
      // (unique index por comment_id) sem virar DM. Inerte sem campanha ativa — devolve na hora.
      { name: "comentarios-sweep", url: `${base}/api/comentarios-varredura?token=${t}` },
    ];
    // hourly (first tick of the hour): health + collections opt-in + dunning grace sweep
    if (minute < 15) {
      targets.push({ name: "health-monitor", url: `${base}/api/health-monitor?token=${t}` });
      // funnel canary: proves chat/pay-links/call-gate/widget are ALIVE every hour (no side effects)
      targets.push({ name: "canary", url: `${base}/api/canary?token=${t}` });
      // SINAL PAGO NA CONTA PRÓPRIA DO NEGÓCIO (2026-10-05): confere quem pagou e fechou a aba antes
      // de voltar — o webhook da plataforma não recebe esses pagamentos. Sem pendente, volta vazio.
      targets.push({ name: "sinal-reconcile", url: `${base}/api/sinal-reconcile?token=${t}` });
      // Venda online de pacote/vale/assinatura no Stripe DO NEGÓCIO (2026-10-05): o webhook daquela conta não chega
      // aqui — a volta da compradora (/api/venda-paga) entrega, e esta conferência de hora em hora pega quem fechou a aba.
      targets.push({ name: "venda-online-reconcile", url: `${base}/api/venda-online-reconcile?token=${t}` });
      // ☀️ RESUMO DA MANHÃ DO DESK (2026-10-05): DE HORA EM HORA, não só às 13h — cada negócio recebe
      // na hora LOCAL que escolheu (≈7h no fuso da unidade), e as 7h de NY, de SP e de Delhi caem em
      // horas UTC diferentes. Opt-in (padrão desligado) e reservado por dia no banco: rodar de novo
      // nunca manda duas vezes. Ninguém ligou → uma consulta que volta vazia.
      targets.push({ name: "resumo-manha", url: `${base}/api/resumo-manha?token=${t}` });
      // 💬 ACOMPANHAMENTO DE CONSULTA (2026-10-13, Natura Parte 4): quem fez a consulta grátis e não marcou nada
      // em N dias recebe UM e-mail da assistente, das 9h às 20h locais. Carimbo por consulta no banco: de hora em
      // hora nunca manda em dobro; ninguém devido → uma consulta que volta vazia.
      targets.push({ name: "consulta-retorno", url: `${base}/api/consulta-retorno?token=${t}` });
      // Relatório mensal (2026-10-05): mesma cadência — o dia 1 às 7h locais cai em horas UTC diferentes por negócio.
      targets.push({ name: "relatorio-mensal", url: `${base}/api/relatorio-mensal?token=${t}` });
      // Gui replies to new Google reviews (inert until GOOGLE_BUSINESS_* + a tenant connects)
      targets.push({ name: "review-responder", url: `${base}/api/review-responder?token=${t}` });
      targets.push({ name: "collections", url: `${base}/api/collections?sweep=1&token=${t}` });
      // 🚨 ÓRFÃO DESDE QUE NASCEU (achado da auditoria, 2026-08-25). O cabeçalho de
      // credit-alerts.js diz «driven by the */15 cron» — e NENHUM cron jamais o chamou. Ou seja:
      // desde o dia em que foi escrito, o cliente que zerava os créditos via o Gui parar de ligar
      // e NUNCA recebia o aviso do porquê. Motor pronto, testado, e desligado da tomada.
      // De hora em hora (não a cada 15 min): o endpoint é latch-dedupado por cliente
      // (mark_credit_alerted), então re-rodar nunca duplica; e 24 varreduras/dia já entregam o
      // aviso com folga sobre um saldo que leva dias para cair.
      // Agora também faz o PRÉ-alerta de 20% — avisar só no zero é avisar depois que parou.
      targets.push({ name: "credit-alerts", url: `${base}/api/credit-alerts?token=${t}` });
      // SALDO DA VOZ — o crédito do CLIENTE tem alarme desde sempre (credit-alerts, acima); o
      // saldo da NOSSA conta de voz não tinha nenhum. Em 21/08 seis ligações para a linha da
      // Natura morreram com "payment issue" na nossa conta ElevenLabs e ninguém foi avisado: o
      // caminho da descoberta era o cliente reclamar. De hora em hora porque a sonda do flagrante
      // olha uma janela de 26h — ligação perdida por pagamento não pode esperar o dia virar.
      targets.push({ name: "voz-saldo", url: `${base}/api/voz-saldo?token=${t}` });
      // dunning grace-period sweep — dry-run until DUNNING_ENFORCE='1'; claim-deduped so an
      // hourly re-run never spams the last-call email or double-pauses (safe to run every hour).
      targets.push({ name: "dunning-sweep", url: `${base}/api/dunning-sweep?token=${t}` });
      // ⚠️ PASSOU DE 1×/DIA PARA DE HORA EM HORA (2026-08-17), e o motivo é um incidente real.
      // Enquanto isto rodava só às 13h UTC, "atrasado" também significava só "lição nova". O catálogo
      // do Natura foi corrigido às 18h e a Lilian seguiu cotando o preço velho AO TELEFONE — o
      // conserto existia no banco e não chegava em quem atende. Agora `agentes_atrasados` também
      // acusa CATÁLOGO e CONHECIMENTO mexidos depois do último sync (achou 3 agentes que o critério
      // antigo jurava estarem em dia), e a varredura roda toda hora para que a distância entre
      // "o dono mudou o preço" e "a agente sabe" seja no máximo 60 minutos, não 24 horas.
      // Continua barato quando não há nada: a rota devolve na hora se a lista vier vazia, e o sync
      // só toca em quem realmente mudou.
      targets.push({ name: "agent-evolve", url: `${base}/api/agent-evolve?token=${t}` });
      // QUALIDADE DA GUI — roda o golden set (genérico + os 13 casos POR VERTICAL) contra o
      // cérebro real e grava a nota em agent_evals. Só na 1ª hora do dia (00h UTC) pra não
      // gastar modelo de hora em hora; é medição, não operação.
      // ZERO efeito colateral: o harness chama só a geração de texto pura, contra o tenant
      // sandbox. Nada de ligar, cobrar ou gravar no cliente.
      // Existe porque a nota só valia se alguém rodasse à mão — e ninguém roda à mão. Agora a
      // regressão de qualidade aparece sozinha no histórico, como qualquer outro monitor.
      // `cadeia=1` = o lote chama o próximo até o conjunto acabar. SEM isto, o cron rodava só o
      // 1º lote (2 casos de 40) e ia embora — os 13 verticais e as travas de dinheiro nunca foram
      // medidos por cron uma única vez. Ver o comentário longo em agent-eval.js.
      // DUAS CHANCES (00h E 01h), pelo mesmo motivo já escrito no bloco das 13h/14h: o eval tinha
      // UMA janela por dia, e um tick perdido custava a noite inteira — foi o que aconteceu em
      // 07/08, 13/08 e 14/08. A 2ª chance é grátis: `ops_run_claim` (janela de 20h) devolve
      // "ja_rodou_hoje" e sai sem chamar modelo se a 1ª tiver dado certo.
      // ⏸️ DESLIGADO A PEDIDO DO LUIS (2026-08-18): o eval noturno gasta crédito Anthropic todo
      // dia para medir o cérebro de TEXTO — e a ligação telefônica, que é o produto, roda inteira
      // na ElevenLabs (LLM gpt-4o de lá) sem tocar em Anthropic. Em 17/08 as rodadas repetidas do
      // harness ZERARAM o saldo e derrubaram o chat do site no fallback. Medição não pode custar a
      // operação. Religar = descomentar; rodada manual continua possível via /api/agent-eval.
      // ▶️ RELIGADO PARTIDO EM DOIS (2026-08-22), com a razão do desligamento respeitada.
      // O que estava errado não era medir — era medir 48 casos TODA noite para vigiar os 20 que
      // decidem a nota de segurança. Ficou assim:
      //   • TODA noite → `risco=1`: os 29 casos marcados `adversarial` ou `risco` no próprio dado —
      //     13 verticais (gás, alergia, queimadura, conselho médico/jurídico), 8 adversariais
      //     (injeção, dados de outro cliente, coerção) e 8 travas de dinheiro/emergência
      //     (cobrança acima do limite, pay-link sem Stripe, dupla-reserva, escalar emergência).
      //   • DOMINGO   → o conjunto inteiro (48), para tom, idioma e formato não sumirem do radar.
      // Semana: 29×6 + 48 = 222 rodadas de caso, contra 336 antes — um terço a menos, e NENHUM
      // caso de dano esperando o domingo. A 1ª versão cortava 20 e parecia melhor: tinha deixado
      // de fora a escalada de emergência. Economia que apaga o alarme não é economia.
      // ⚠️ UMA CHANCE POR NOITE, não duas. A 2ª chance era grátis quando `ops_run_claim` segurava,
      // mas em 17/08 foram rodadas REPETIDAS que zeraram o saldo Anthropic e derrubaram o chat do
      // site no fallback — o modo de falha aqui não é "perdi uma noite", é "a operação caiu por
      // causa do medidor". Perder uma noite é barato; derrubar o site não é.
      // ▶️ MIGRADO PARA A FILA (2026-08-22). O `cadeia=1` sumiu daqui de propósito: era ele que
      // fazia cada lote chamar o próximo, e foi essa avalanche que zerou o saldo em 17/08.
      // Agora a semente roda UM caso (reservando o dia, como antes) e o resto vira fila, drenada
      // aos poucos e presa ao teto de tokens. Se o teto bater, a varredura PAUSA e retoma no
      // tique seguinte com o mesmo run_id — em vez de morrer e perder a noite.
      // A rodada manual com `cadeia=1` continua existindo em /api/agent-eval para quem quiser.
      if (hourUTC === 0) {
        const domingo = new Date().getUTCDay() === 0;
        try { evalSemente = await semeiaEval(env, { base, risco: !domingo }); }
        catch (e) { evalSemente = { ok: false, motivo: String(e).slice(0, 120) }; }
      }
      // O AVISO DO EVAL, ÀS 02h UTC (22h NY) — uma hora depois da 2ª chance do eval.
      // Luis, 2026-08-17: «me avisa quando o eval rodar». A resposta certa não é eu lembrar: é o
      // servidor mandar o e-mail todas as noites, para sempre, sem depender de sessão nenhuma.
      // POR QUE 02h E NÃO 00h: o eval tem duas chances (00h e 01h). Se o aviso saísse às 00h,
      // numa noite em que a 1ª falhasse ele relataria a rodada de ONTEM com a data de hoje — e
      // relatório que erra a data é pior que nenhum, porque parece confiável. Às 02h as duas
      // chances já passaram.
      // O endpoint tem trava de 20h (ops_run_claim), então o bloco horário não repete o aviso; e
      // se a última rodada tiver mais de 6h ele muda o assunto para "o eval NÃO rodou" em vez de
      // reenviar nota velha como novidade.
      if (hourUTC === 2) targets.push({ name: "eval-report", url: `${base}/api/eval-report?token=${t}` });
    }
    // daily ~13:00 UTC (9am ET): dates/birthdays/rebooking + NPS + money reconcile
    // two chances (13h AND 14h): a single failed tick must not skip the whole day/week —
    // every daily/weekly target below is claim-protected/idempotent, so the 2nd tick is safe.
    if ((hourUTC === 13 || hourUTC === 14) && minute < 15) {
      // Os três alvos abaixo marcados com `motores.ativos` escrevem para cliente por conta própria:
      // com o interruptor geral em "off" eles nem são chamados (e, chamados à mão, se recusam).
      // RELACIONAMENTO (2026-09-30): a volta no tempo certo de cada serviço + o aniversário, numa
      // chamada SÓ DELES e ANTES da rodada grande — que gasta ~20 chamadas por negócio e estoura o
      // teto de subrequests no 3º. Fila global, carimbo depois do envio: as duas chances (13h e
      // 14h) são seguras.
      if (motores.ativos) targets.push({ name: "relacionamento", url: `${base}/api/proactive?apenas=relacionamento&token=${t}` });
      // RELATÓRIO MENSAL DE VALOR: só nos dias 1 a 7 (o mês anterior já fechou; 8 negócios por
      // chamada, então a primeira semana cobre todos). Depois do dia 7 nem é chamado.
      if (motores.ativos && new Date().getUTCDate() <= 7) targets.push({ name: "relatorio-mensal", url: `${base}/api/proactive?apenas=relatorio-mensal&token=${t}` });
      if (motores.ativos) targets.push({ name: "proactive", url: `${base}/api/proactive?token=${t}` });
      // CLASSIFICAÇÃO DO CRM antes dos motores de retenção do dia: aniversário, win-back e
      // churn LEEM lifecycle/LTV/risco. Se a varredura não rodar primeiro, eles decidem em
      // cima da foto de ontem — ou, como era até 2026-08-04, em cima de campo vazio.
      targets.push({ name: "crm-classify", url: `${base}/api/crm-classify?token=${t}` });
      if (motores.ativos) targets.push({ name: "nps", url: `${base}/api/nps?token=${t}` });
      // XM active survey: Gui asks each client's OWN recent customers "how was it?" (1-tap NPS/CSAT),
      // ON by default per tenant (they can disable it in the Experience tab). Claim-deduped (30-day
      // window) + capped + email-only, so the daily re-run never double-surveys anyone.
      if (motores.ativos) targets.push({ name: "cx-survey", url: `${base}/api/cx-survey?token=${t}` });
      targets.push({ name: "money-reconcile", url: `${base}/api/money-reconcile?token=${t}` });
      // ONBOARDING MACHINE step 7: day-30/60/90 one-question check-in. Atomic-claimed per milestone
      // (onboard_checkin_due), so the daily re-run never re-sends — safe every day.
      targets.push({ name: "onboarding-checkin", url: `${base}/api/onboarding?sweep=checkin&token=${t}` });
      // ONBOARDING MACHINE step 6: monthly ROI report. Claimed per calendar month (onboard_report_due)
      // and fired on the 1st @13h only (not the 14h retry) → exactly one ROI report per client per month.
      // DESLIGADO (2026-09-22): o step "report" mandava ao cliente PAGANTE o e-mail de prospect
      // ("~$4.500/mês em risco · ver planos", onboarding.js:135). Volta quando ler o client-report real.
      // if (hourUTC === 13 && new Date().getUTCDate() === 1) targets.push({ name: "onboarding-report", url: `${base}/api/onboarding?sweep=report&token=${t}` });
      // Data-cannot-lie: nightly cross-department invariant sweep; alerts if any HIGH contradiction.
      targets.push({ name: "integrity-sweep", url: `${base}/api/integrity-sweep?token=${t}` });
      // weekly (Monday 13:00 UTC): the "Your Gui this week" value report — skipped clients with
      // zero events, so a Monday-only fan-out is enough (was orphaned: never wired to any cron).
      if (new Date().getUTCDay() === 1) targets.push({ name: "client-report", url: `${base}/api/client-report?token=${t}` });
      // Monday: the SELLER's weekly mirror — wallet, commission, balance due, play of the week.
      if (new Date().getUTCDay() === 1) targets.push({ name: "seller-report", url: `${base}/api/seller-report?token=${t}` });
      // VIGIA DE ANÚNCIOS (segundas): varre as campanhas de todos os clientes e avisa quem tem
      // decisão a tomar — dinheiro queimando ou campanha que merece mais orçamento. É o que
      // separa agência de painel: chega antes do prejuízo virar mês fechado. Silencioso quando
      // não há nada a decidir, de propósito.
      // ⚠️ ELE RODA NAS DUAS JANELAS (13h E 14h) DE PROPÓSITO — e só depois de 2026-08-25 isso é
      // seguro: até então o vigia NÃO era claim-dedupado e cada cliente com alerta recebia o mesmo
      // e-mail DUAS vezes toda segunda. A trava agora mora no próprio endpoint (`ops_run_claim`,
      // janela de 20h), que é onde ela protege também a chamada manual. Mantido nas duas janelas
      // porque um tique falho não pode custar a semana inteira do aviso.
      if (new Date().getUTCDay() === 1) targets.push({ name: "ads-vigia", url: `${base}/api/ads-vigia?token=${t}` });
      // MOTOR DE AGENTE (diário, 13h) — encontra os agentes que ficaram numa versão de cérebro
      // antiga e os atualiza. É o que transforma "consertei uma lição" em "a frota inteira
      // aprendeu", sem ninguém lembrar de nada.
      // DIÁRIO e não semanal de propósito: uma lição nasce de um cliente perdido: esperar sete
      // dias para o resto da frota parar de cometer o mesmo erro é aceitar perder os próximos.
      // Só às 13h (não na repetição das 14h): não é claim-dedupado, e re-sincronizar a frota
      // duas vezes seguidas gasta chamada de terceiro à toa. Se falhar, o dia seguinte pega —
      // quem não sincroniza não recebe carimbo, então continua aparecendo como atrasado.
      // No-op barato quando não há atrasados: a rota devolve na hora sem tocar em agente nenhum.
      // Company OS owner brief — "sua empresa se operou hoje". 13h ONLY (not the 14h retry) so the
      // owner gets exactly ONE daily brief (it isn't claim-deduped; a missed day is harmless).
      if (hourUTC === 13) targets.push({ name: "company-os-brief", url: `${base}/api/company-os-brief?token=${t}` });
      // 🚨 O OUTRO ÓRFÃO (auditoria 2026-08-25): /api/daily-digest existe, é token-gated
      // (DIGEST_TOKEN via `safeEq`) e NUNCA foi chamado por cron nenhum. O resumo dos leads das
      // últimas 24h — o e-mail que diz "estes procuraram você ontem" — simplesmente não saía.
      // 13h APENAS (não na repetição das 14h): o endpoint NÃO é claim-dedupado — ele varre uma
      // janela fixa de 24h e manda. Na repetição das 14h o dono receberia o MESMO digest duas
      // vezes por dia, com quase os mesmos leads. Um dia perdido é barato; digest duplicado
      // treina o dono a ignorar o e-mail que existe para ele abrir.
      // Silencioso quando não há lead: a rota devolve `sent:false` sem mandar nada.
      // `lang=pt` explícito: o padrão da rota é "en" e quem lê este digest é o Luis. Digest em
      // inglês para leitor de português é o mesmo "meio em inglês" que a lei de i18n proíbe.
      if (hourUTC === 13) targets.push({ name: "daily-digest", url: `${base}/api/daily-digest?lang=pt&token=${t}` });
      // BACKUP DIÁRIO (2026-09-09). /api/backup existia desde o começo — o cabeçalho dele dizia
      // «wired into the guileo-digest-cron Worker» e NENHUM cron jamais o chamou. A cópia de
      // segurança que "saía todo dia" nunca saiu uma vez. Duas chances (13h e 14h) como os outros;
      // o endpoint reserva o dia com `ops_run_claim('backup', 20h)` e responde `ja_rodou_hoje` na
      // repetição, então a 2ª chance nunca manda dois anexos.
      targets.push({ name: "backup", url: `${base}/api/backup?token=${t}` });
    }

    // ── ALVO QUE FALHA CONFESSA (2026-09-09) ────────────────────────────────────────────────
    // Antes: `results[nome] = 0` quando o alvo estourava, e um 500 do alvo ficava gravado como
    // "500" numa resposta que só o Worker lia — e o Worker ignora a resposta. Um sweep podia
    // morrer por semanas com o cron "verde". Agora todo alvo não-2xx (ou que lançou) entra em
    // `falhas`, e UM aviso deduplicado (6h) sai pelo avisarDono com nome + status de cada um.
    // Não-bloqueante: o fan-out continua igual; o aviso é disparado depois do laço e entregue em
    // `waitUntil` quando a plataforma oferece (a resposta não espera a Resend/Twilio).
    const results = {};
    const falhas = [];
    const inertes = [];
    const contagens = {};
    for (const tg of targets) {
      try {
        const r = await fetch(tg.url, { method: "POST" }).catch(() => null);
        // A 2ª tentativa por GET existe para rota que não aceita POST (405 e primos 4xx) ou quando
        // o POST nem voltou. Em 5xx ela NÃO repete mais (2026-09-22): 5xx quer dizer que a rota
        // RODOU e falhou — repetir era executar o motor duas vezes por tique (o lifecycle, que
        // agora responde 502 sem ADMIN_TOKEN, rodaria em dobro 96×/dia) e gastar subrequest à toa.
        const repete = !r || (r.status >= 400 && r.status < 500);
        const r2 = repete ? await fetch(tg.url).catch(() => null) : r;
        // O CORPO É LIDO SEMPRE, não só no erro: é nele que mora o `ok:false` de um 200 (ver leAlvo).
        const texto = r2 ? await r2.text().catch(() => "") : "";
        const v = leAlvo(r2 ? r2.status : 0, !!(r2 && r2.ok), texto);
        results[tg.name] = v.marca;
        // O LEMBRETE NUNCA TINHA SAÍDO (2026-09-28: max(reminded_at) = null na base inteira) e o tique
        // só guardava "200". Status não é medida: guarda os CONTADORES do motor — só números e o
        // código da recusa, sem e-mail de ninguém (esta rota é pública).
        if (tg.name === "lembretes") {
          try {
            const j = JSON.parse(texto || "{}");
            contagens.lembretes = { negocios: j.businesses ?? null, lembrados: j.reminded ?? null,
              recusas: Array.isArray(j.rpcRecusou) ? j.rpcRecusou.length : null,
              codigos: Array.isArray(j.rpcRecusou) ? [...new Set(j.rpcRecusou.map((x) => String(x).split(":")[0] + ":" + String(x).split(":").slice(-1)[0]))].slice(0, 8) : [],
              nota: j.note || j.motivo || null, visitas: j.visitas || null };
          } catch { contagens.lembretes = { ilegivel: String(texto || "").slice(0, 80) }; }
        }
        // Mesma régua para a passada de relacionamento: só números e o nome do erro.
        if (tg.name === "relacionamento") {
          try {
            const j = JSON.parse(texto || "{}"); const r = j.relacionamento || {};
            contagens.relacionamento = { naFila: r.naFila ?? null, voltas: r.voltas ?? null, aniversarios: r.aniversarios ?? null,
              semEmail: r.semEmail ?? null, suprimidos: r.suprimidos ?? null, envioFalhou: r.envioFalhou ?? null,
              carimboFalhou: r.carimboFalhou ?? null, adiados: r.adiados ?? null,
              erros: Array.isArray(r.erros) ? r.erros.map((x) => String(x).slice(0, 60)).slice(0, 4) : [], nota: j.motivo || null };
          } catch { contagens.relacionamento = { ilegivel: String(texto || "").slice(0, 80) }; }
        }
        if (v.falhou) falhas.push({ alvo: tg.name, status: v.marca, motivo: v.motivo });
        else if (v.inerte) inertes.push({ alvo: tg.name, motivo: v.motivo });
      } catch (e) { results[tg.name] = 0; falhas.push({ alvo: tg.name, status: 0, motivo: String(e).slice(0, 120) }); }
    }
    let avisoFalhas = null;
    if (falhas.length) {
      const lista = falhas.map((f) => `${f.alvo} → ${f.status || "sem resposta"}`).join(" · ");
      const p = avisarDono(env, {
        kind: "cron_alvo_falhou",
        summary: `${falhas.length} alvo(s) do cron falharam: ${lista}`,
        detail: falhas.map((f) => `${f.alvo}: HTTP ${f.status} — ${f.motivo}`).join("\n"),
        cliente: "Guileo (cron)", link: "https://guileoai.com/admin", payload: { falhas },
        // A chave carrega os NOMES: duas falhas diferentes no mesmo balde de 6h não se calam.
        chave: `cron_alvo:${falhas.map((f) => f.alvo).sort().join(",").slice(0, 60)}`,
      });
      if (context.waitUntil) { context.waitUntil(p); avisoFalhas = { disparado: true, alvos: falhas.map((f) => f.alvo) }; }
      else avisoFalhas = await p;
    }
    // ── O SEMÁFORO, EXPOSTO ──────────────────────────────────────────────────────────────────
    // `/api/platform-status` já responde "está tudo funcionando?" num semáforo por área
    // (voz · dinheiro · agenda · agentes). Mas é DIGEST-gated: só o cron enxergava, e verificação
    // que o dono não consegue abrir não serve para decidir se pode receber cliente.
    // Aqui o cron — que TEM o token do lado do servidor — chama a rota e devolve só o VEREDITO
    // (cores, sem detalhe sensível). Assim `POST /api/cron-tick` vira a pergunta única, pública e
    // sem segredo: uma chamada, e você vê se alguma máquina caiu.
    // Só no tique da hora: é agregação de sondas, não precisa rodar de 15 em 15 minutos.
    let semaforo = null;
    if (minute < 15 || forcarSemaforo) {
      try {
        const pr = await fetch(`${base}/api/platform-status?token=${t}`, { method: "POST" });
        // fetch não lança em erro HTTP — sem esta leitura, uma falha viraria "sem semáforo" calado
        if (pr.ok) { const pj = await pr.json().catch(() => null); semaforo = pj?.slo || null; }
        else semaforo = { overall: "unknown", nota: `platform-status http ${pr.status}` };
      } catch (e) { semaforo = { overall: "unknown", nota: String(e).slice(0, 80) }; }

      // ── AS LINHAS ATENDEM? (2026-08-16) ─────────────────────────────────────────────────────
      // O buraco que isto fecha: o semáforo media chat, links de pagamento e widget — tudo que dá
      // para testar com um fetch — e NÃO media a única coisa que dá nome à empresa: o telefone
      // atender. Neste dia a plataforma passou horas verde com a linha do cliente PAGANTE recusando
      // toda ligação (teto diário -1), e o dono só descobriu discando.
      // Medir o que era fácil de medir em vez do que dá dinheiro é a mesma família dos enganos do
      // dia: uma medição verdadeira respondendo a pergunta errada.
      //
      // PÚBLICO E SEM SEGREDO, de propósito — a pergunta "está de pé?" se faz do celular, às 2h,
      // sem senha. Por isso aqui vai só a CONTAGEM: nada de nome de cliente, número ou
      // configuração. Quem quiser saber QUAL e POR QUÊ usa /api/agente-prova, que é gated.
      try {
        const lr = await fetch(`${base}/api/agente-prova?token=${t}`);
        if (lr.ok) {
          const lj = await lr.json().catch(() => null);
          const r = lj?.resumo;
          if (r) {
            semaforo = semaforo || {};
            semaforo.linhas = {
              atendem: r.atenderiam ?? null,
              de: r.linhas ?? null,
              // `estado` existe para quem lê no celular não precisar comparar dois números.
              // null (não deu para provar) NUNCA vira verde — é o erro que este dia inteiro ensinou.
              estado: r.ok === true ? "verde" : r.ok === false ? "vermelho" : "cinza",
            };
            // Uma linha caída derruba o semáforo GERAL. Antes, o telefone podia estar morto e o
            // `overall` continuava "ok" porque ninguém o consultava.
            if (r.ok === false) semaforo.overall = "down";
            else if (r.ok === null && semaforo.overall === "ok") semaforo.overall = "unknown";
          }
        } else if (semaforo) semaforo.linhas = { estado: "cinza", nota: `agente-prova http ${lr.status}` };
      } catch (e) { if (semaforo) semaforo.linhas = { estado: "cinza", nota: String(e).slice(0, 60) }; }

      // ── OS CANAIS DE TEXTO RESPONDEM? (2026-08-22) ──────────────────────────────────────────
      // O buraco: o semáforo media voz, dinheiro, agenda e agentes — e NADA media SMS e WhatsApp.
      // O WhatsApp passou 19 dias respondendo para o vazio (token temporário expirado, code 190)
      // sem uma única cor mudar, porque a entrada funcionava e ninguém olhava a SAÍDA.
      // Cor apenas, sem segredo: o detalhe (motivo, campanha reprovada, código da Meta) sai em
      // /api/canais-prova, que é gated.
      try {
        const cr = await fetch(`${base}/api/canais-prova?token=${t}`);
        if (cr.ok) {
          const cj = await cr.json().catch(() => null);
          if (cj?.resumo) {
            semaforo = semaforo || {};
            semaforo.mensagens = cj.resumo;
            // Canal de texto caído NÃO derruba o geral (voz é o produto), mas cinza nunca vira
            // verde: "não medido" continua sendo uma resposta diferente de "está bom".
            if (semaforo.overall === "ok" && (cj.resumo.sms === "vermelho" || cj.resumo.whatsapp === "vermelho")) {
              semaforo.overall = "degraded";
            }
          }
        } else if (semaforo) semaforo.mensagens = { nota: `canais-prova http ${cr.status}` };

        // 🚨 O ALARME QUE NÃO EXISTIA. Gravar evento não bastou: o WhatsApp passou 19 dias
        // falhando com eventos gravados no banco que ninguém leu. Alarme que fica dentro da
        // plataforma é alarme que não existe. Este SAI — por e-mail, para o dono.
        // Uma vez por dia POR CANAL: a varredura roda de hora em hora e 24 avisos iguais viram
        // ruído, e ruído é como um alarme morre no dia em que importa.
        // (2026-09-09) Porta única: avisarDono. A trava `alarme_uma_vez` daqui exigia service_role
        // (anon revogado) e, sem ele, `pode !== true` calava o alarme PARA SEMPRE — o anti-spam
        // virando o silêncio. avisarDono só cala com `false` explícito; trava ilegível deixa sair.
        const m = semaforo && semaforo.mensagens;
        if (m) {
          semaforo.avisos = semaforo.avisos || {};
          for (const canal of ["sms", "whatsapp"]) {
            if (m[canal] !== "vermelho") continue;
            semaforo.avisos[`canal_${canal}`] = await avisarDono(env, {
              kind: `canal_caido_${canal}`,
              summary: `${canal === "sms" ? "SMS" : "WhatsApp"} respondendo para o vazio — ${(canal === "sms" ? m.falta_sms : m.falta_whatsapp) || "sem motivo lido"}`,
              cliente: "Guileo (canais)", link: "https://guileoai.com/admin",
            });
          }
        }
      } catch (e) { if (semaforo) semaforo.mensagens = { nota: String(e).slice(0, 60) }; }

      // ── ORÇAMENTO DO AGENTE ESTOUROU? (2026-08-22) ──────────────────────────────────────────
      // O freio só serve se alguém souber que ele pisou. Sem este aviso, "o agente parou por
      // falta de teto" e "o agente quebrou" chegariam ao dono do mesmo jeito: silêncio.
      try {
        const orc = await svcJson(env, "orcamento_estado", { p_secret: env.INGEST_SECRET || "" }).catch(() => null);
        const hoje = new Date().toISOString().slice(0, 10);
        const barrados = Array.isArray(orc) ? orc.filter((x) => x.dia === hoje && (x.bloqueios || 0) > 0) : [];
        if (semaforo) semaforo.orcamento = Array.isArray(orc) ? { barrados: barrados.length } : { nota: "não deu para ler" };
        // (2026-09-09) Mesma porta única do bloco dos canais, mesmo motivo (a trava antiga calava
        // sem service_role). O balde de 6h é suficiente: o teto vira uma vez por dia.
        for (const x of barrados) {
          if (semaforo) { semaforo.avisos = semaforo.avisos || {}; }
          const r = await avisarDono(env, {
            kind: `orcamento_${(x.proposito || "geral").toString().slice(0, 30)}`,
            summary: `o agente "${x.proposito}" bateu no teto de orçamento — teto ${x.teto} tokens · usado ${x.usado} · recusas hoje: ${x.bloqueios}`,
            cliente: "Guileo (orçamento do agente)",
          });
          if (semaforo) semaforo.avisos[`orcamento_${x.proposito}`] = r;
        }
        // Item preso em voo há mais de 30 min volta pra fila — worker morto não pode aposentar trabalho.
        await svcJson(env, "fila_destrava", { p_secret: env.INGEST_SECRET || "" }).catch(() => {});
        // FALTA AUTOMÁTICA do Desk (desk_v12): pano de fundo a cada 15 min; a leitura da agenda é a varredura viva.
        await svcJson(env, "desk_auto_noshow_sweep", { p_secret: env.SCHED_SECRET || "" }).catch(() => {});
      } catch (e) { console.error(JSON.stringify({ alarme_orcamento: "geral", erro: String(e).slice(0, 80) })); }

      // ── O PRÓPRIO CRON ENTRA NO SEMÁFORO (2026-09-22) ───────────────────────────────────────
      // O semáforo media voz, dinheiro, agenda, canais — e não media os motores que o cron
      // acabou de chamar. Um alvo falho (inclusive o 200 com `ok:false`) ficava em `falhas`, num
      // canto da resposta, com o `overall` ainda "ok". Alvo falho não derruba o geral para "down"
      // (voz é o produto), mas verde ele não fica: "ok" vira "degraded".
      if (semaforo) {
        semaforo.cron = falhas.length
          ? { estado: "vermelho", falhas: falhas.length, alvos: falhas.map((f) => f.alvo) }
          : { estado: "verde", falhas: 0 };
        if (falhas.length && semaforo.overall === "ok") semaforo.overall = "degraded";
      }
    }

    // PHONE RE-ENGAGEMENT EXECUTOR (#19) — once per hour, dial the queued phone-contact
    // churn/booking-recovery intents (claim-deduped + TCPA-windowed inside the sweep).
    // ── O AGENTE DECIDE O QUE OLHAR (2026-08-22) ────────────────────────────────────────────
    // Semeia a fila com sinais REAIS e mastiga um punhado. É o que fecha o ciclo: até aqui a
    // fila era atômica e provada, mas quem decidia o próximo trabalho era um cron fixo.
    // Lote pequeno de propósito — cada item é chamada paga ao Google. Fila que esvazia rápido
    // demais é conta de terceiro subindo sem ninguém olhar.
    let fila = null;
    if (minute < 15 || forcarFila) {
      try {
        const semeou = await semeiaFila(env, { teto: 25 });
        const drenou = await drenaFila(env, { base, n: 5 });
        // O eval drena em TODO tique da hora, não só à meia-noite: é assim que a varredura
        // atravessa o dia sem pico. Lote pequeno — cada caso é uma chamada paga ao juiz.
        const eval_ = await drenaEval(env, { base, n: 3 });
        // Relatório no idioma errado é peça de venda que não pode ser enviada. Semeia uma vez
        // (a lista esvazia sozinha quando todos viram EN) e mastiga poucos por tique — cada um é
        // raspagem + chamada ao Google.
        const semRel = await semeiaRelatorios(env, { teto: 60 });
        // 8 por tique: cada um é raspagem + Google, mas são 296 esperando e relatório em português
        // não pode ser enviado. Ainda é lote — não varredura.
        const relEn = await drenaRelatorios(env, { base, n: 8 });
        fila = { semeou, drenou, eval: eval_, relatorios: { semeou: semRel, drenou: relEn } };
      } catch (e) { fila = { erro: String(e).slice(0, 120) }; }
    }

    let reengage = null;
    if (minute < 15) {
      // Discagem automática é o motor mais caro de errar (foi por discagem que a Twilio zerou):
      // com o interruptor geral em "off" a varredura nem lê a fila — nada é reservado, nada é
      // queimado, e os pedidos continuam lá para quando religar.
      if (!motores.ativos) reengage = { desligado: true, motivo: `motores_proativos=off (${motores.fonte})` };
      else {
        try { reengage = await phoneReengageSweep(env, base, hourUTC); }
        catch (e) { reengage = { error: String(e).slice(0, 80) }; }
      }
    }
    // `ok` agora diz a verdade: alvo falho = tique com problema (a resposta continua 200 para o
    // Worker; quem lê o JSON vê `falhas` com nome + status e `avisoFalhas` com o recibo do aviso).
    // ── A ÚLTIMA RODADA, GUARDADA (2026-10-14) ───────────────────────────────────────────────
    // "Onde estão as automações e como sei que funcionam?" — a resposta vivia só neste JSON, que ninguém
    // lia. Cada alvo grava o seu último resultado em KV (3 dias): hora, estado, motivo curto. Alvo de hora
    // em hora e diário mantém o último resultado entre os tiques de 15 min. Lido por GET /api/automacoes
    // (público, sem segredo) e mostrado no /admin → ⚙️ Automações. KV fora NUNCA derruba o tique.
    if (env.RATE_LIMIT) {
      try {
        const agora = new Date().toISOString();
        let alvos = {};
        try { alvos = JSON.parse((await env.RATE_LIMIT.get("cron:alvos")) || "{}") || {}; } catch { alvos = {}; }
        for (const [nome, st] of Object.entries(results || {})) {
          const f = falhas.find((x) => x.alvo === nome); const i = inertes.find((x) => x.alvo === nome);
          alvos[nome] = { at: agora, status: String(st), estado: f ? "falhou" : i ? "inerte" : /calado|desligado/.test(String(st)) ? "calado" : "ok", motivo: String((f && f.motivo) || (i && i.motivo) || "").slice(0, 160) };
        }
        await env.RATE_LIMIT.put("cron:alvos", JSON.stringify(alvos), { expirationTtl: 3 * 86400 });
        await env.RATE_LIMIT.put("cron:ultimo", JSON.stringify({ at: agora, hourUTC, minute, ok: falhas.length === 0, falhas, inertes, semaforo, alvos_no_tique: Object.keys(results || {}).length }), { expirationTtl: 3 * 86400 });
      } catch { /* KV fora: o registro falha, o tique não */ }
    }
    return json({
      ok: falhas.length === 0, semaforo, ran: results, contagens, falhas, inertes, avisoFalhas,
      motores_proativos: motores.ativos ? "on" : "off", motores_proativos_fonte: motores.fonte,
      reengage, fila, evalSemente, hourUTC, minute,
    });
  } catch (e) {
    return json({ error: String(e).slice(0, 140) }, 500);
  }
}
