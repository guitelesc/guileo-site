// Cloudflare Pages Function — GET/POST /api/credit-alerts?token=DIGEST_TOKEN
// Loop 5 (real-time): when a client's Gui credits hit 0 (depleted_at stamped by the
// consume path), email the CLIENT a branded "top up" alert + heads-up Luis, once.
// Chamado DE HORA EM HORA pelo cron-tick (o fan-out foi ligado em 2026-08-25 — este endpoint
// nasceu órfão e passou a vida inteira sem ser chamado por cron nenhum). Re-arma sozinho quando
// o cliente recarrega (add_client_credits limpa depleted_at/alerted_at).
// SEGUNDO FLUXO, mesma rota: o PRÉ-alerta de 20% (`preAlertaBaixo` abaixo) — avisar só no zero é
// avisar depois que o Gui já parou.
import { json, isOwnerEmail, safeEq } from "../lib/guard.js";
import { creditDepletedEmail, creditDepletedUpgradeEmail, creditLowEmail, autoTopupLinkEmail } from "../lib/emailTemplates.js";
import { emitFailure } from "../lib/failure.js";
import { SELF_SERVE_PLANS, TOPUPS } from "../../src/data/selfServePlans.js";

// Infer the NEXT plan up from the stored plan label (e.g. "Growth") so the depleted-credits
// alert carries a DIRECT live Stripe upgrade link (paying it = instant upgrade, credits are
// ADDED on top by add_client_credits). Returns null when not inferable or already on top.
function nextPlanUp(planLabel) {
  const lower = (planLabel || "").toString().toLowerCase();
  const i = SELF_SERVE_PLANS.findIndex((p) => lower.includes(p.id) || lower.includes(p.name.toLowerCase()));
  return i >= 0 ? SELF_SERVE_PLANS[i + 1] || null : null;
}

// O plano do cliente, resolvido pelo rótulo guardado em client_credits.plan. É a MESMA leitura de
// `nextPlanUp` — separada porque aqui o que interessa é o TAMANHO do balde do mês (p.credits), que
// é o denominador da porcentagem. Sem plano reconhecível devolve null e o pré-alerta não acontece:
// porcentagem sem denominador conhecido é número inventado, e número inventado é a lei nº 5.
function planoDoCliente(planLabel) {
  const lower = (planLabel || "").toString().toLowerCase();
  return SELF_SERVE_PLANS.find((p) => lower.includes(p.id) || lower.includes(p.name.toLowerCase())) || null;
}

// ── PRÉ-ALERTA DE 20% ────────────────────────────────────────────────────────────────────────
// O fluxo do ZERO (acima) é a ambulância; este é o aviso na descida. Varre `clients_list` (que já
// devolve saldo + plano + a marca `internal`), calcula a porcentagem contra o balde do plano e
// avisa quem está entre 1% e 20% — uma vez por descida, pela trava atômica `credit_low_claim`
// (db/credit_low_alerts.sql).
// FAIL-CLOSED sem a trava: se a RPC ainda não foi colada, NÃO manda nada e reporta
// `low.claimReady:false` no JSON da rota. Um e-mail de upsell repetido de hora em hora não é um aviso, é spam —
// e o cliente que recebe spam nosso deixa de abrir o e-mail que importa (o do zero).
const LOW_PCT = 20;
const LOW_MAX = 40; // orçamento de subrequests: no máximo 40 clientes por rodada

async function preAlertaBaixo(env, ING, OWNER) {
  const out = { checked: 0, low: 0, sent: 0, failed: 0, claimReady: true, skippedNoPlan: 0, reset: 0 };
  if (!env.RESEND_API_KEY) { out.reason = "no mailer"; return out; }
  const lr = await rpc("clients_list", { p_secret: ING });
  // ⚠️ `: []` E `.catch(() => [])` transformavam DUAS falhas distintas (HTTP não-200 e corpo
  // ilegível) na MESMA resposta vazia — e uma lista vazia aqui se lê como "conferi todos e
  // ninguém está baixo". O ramo de erro logo abaixo virou código morto: o banco podia estar
  // fora há horas e a rota respondia `checked:0` de hora em hora, com cara de rodada limpa.
  // É a lição "fallback esconde erro" no lugar mais caro: o aviso que gera upgrade.
  const lista = lr.ok ? await lr.json().catch(() => null) : null;
  if (!Array.isArray(lista)) { out.reason = `clients_list indisponível (http ${lr.status})`; return out; }

  for (const c of lista.slice(0, LOW_MAX)) {
    const email = ((c && c.client_email) || "").toString().trim().toLowerCase();
    if (!email.includes("@")) continue;
    if (c && c.internal === true) continue;          // conta nossa não recebe upsell nosso
    const saldo = Number(c && c.credits);
    if (!Number.isFinite(saldo) || saldo <= 0) continue; // zero é o outro fluxo, não este
    const plano = planoDoCliente(c && c.plan);
    if (!plano || !(plano.credits > 0)) { out.skippedNoPlan++; continue; }
    out.checked++;
    const pct = Math.round((saldo / plano.credits) * 100);
    // ── RE-ARMAR NO ESTADO SAUDÁVEL ───────────────────────────────────────────────────────────
    // O `credit_low_claim` re-arma comparando o saldo de HOJE com o saldo do momento do claim — e
    // aquele saldo era, por definição, ≤20% do balde. Quem recarregou e desceu de novo dentro dos
    // mesmos 30 dias podia nunca receber o segundo aviso: o saldo novo na descida ainda era MENOR
    // que o do claim antigo, então a trava continuava fechada. Apagar a trava quando o cliente
    // está claramente saudável (≥50% do balde = recarregou ou virou o ciclo) fecha esse buraco no
    // ponto certo — o estado, não o relógio. Best-effort: se a RPC não existir, o pior caso é o
    // comportamento de antes.
    if (pct >= 50) {
      try { await rpc("credit_low_reset", { p_secret: ING, p_email: email }).then((r) => { if (r.ok) out.reset++; }); }
      catch { /* re-arme é conforto, nunca pode derrubar a varredura */ }
      continue;
    }
    if (pct > LOW_PCT) continue;
    out.low++;

    // Trava ANTES de mandar: reivindicar depois abriria a janela para dois tiques mandarem juntos.
    const cr = await rpc("credit_low_claim", { p_secret: ING, p_email: email, p_credits: Math.round(saldo) });
    if (!cr.ok) { out.claimReady = false; console.error(JSON.stringify({ credit_low: "rpc ausente", http: cr.status })); continue; }
    const pode = await cr.json().catch(() => false);
    if (pode !== true) continue;                      // já avisado nesta descida

    let lang = "pt", name = "tudo bem", business = "";
    try {
      const pr = await rpc("get_client_profile", { p_secret: ING, p_email: email });
      if (pr.ok) {
        const p = await pr.json();
        if (p && typeof p === "object") {
          business = p.business_name || "";
          lang = ["pt", "es", "en", "hi"].includes(p.lang) ? p.lang : "pt";
          name = p.owner || (lang === "en" ? "there" : "tudo bem");
        }
      }
    } catch { /* defaults */ }

    const up = nextPlanUp(c && c.plan);
    const tpl = creditLowEmail({
      name, business, lang, credits: Math.round(saldo), pct, planName: plano.name,
      upgradeName: up ? up.name : "", upgradePrice: up ? up.price : 0,
      upgradeUrl: (up && up.url) || "https://guileoai.com/planos",
    });
    const r = await send(env, email, tpl.subject, tpl.html);
    // Conferir o retorno do envio: a trava já foi queimada, então um envio perdido em silêncio
    // significaria que este cliente NÃO é avisado neste ciclo e ninguém saberia.
    if (r && r.ok) out.sent++;
    else {
      out.failed++;
      console.error(JSON.stringify({ credit_low_email: email, resend: r ? r.status : 0 }));
      // O dono fica sabendo: aviso que não chegou é receita de upgrade que não acontece.
      await send(env, OWNER, `⚠️ ${business || email} está em ${pct}% de crédito e NÃO recebeu o aviso`,
        `<div style="font-family:system-ui,sans-serif;max-width:520px"><b>${business || email}</b> (${email}) está com <b>${Math.round(saldo)}</b> créditos (${pct}% do plano ${plano.name}) e o e-mail de aviso <b style="color:#b91c1c">falhou</b>. Vale um toque antes de zerar.</div>`).catch(() => {});
    }
  }
  return out;
}

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const send = (env, to, subject, html) => fetch("https://api.resend.com/emails", {
  method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [to], subject, html }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// RECARGA COM 1 CLIQUE — o que o botão do cockpit passou a significar de verdade (2026-08-25)
// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⚠️ ISTO NÃO COBRA NINGUÉM. Cobrança off-session de verdade exige mandato salvo (Stripe
// SetupIntent + payment method off_session, com consentimento explícito e registrado do cliente)
// — próximo passo, não este. Passar o cartão de alguém a partir de um toggle que ele marcou meses
// atrás, sem mandato, é risco de contestação e de confiança, e não se faz.
//
// O que a preferência (`client_autotopup`, db/auto_topup.sql) liga é ISTO: quando o saldo ZERA,
// além do aviso de sempre sai um segundo e-mail com o LINK DE PAGAMENTO do pacote, pronto para
// um clique. Honesto e útil: tira do dono o trabalho de procurar onde recarrega, sem prometer uma
// automação que não existe.

// Quem ligou a preferência. Devolve um Map(email → pack) com `.motivo` quando não deu para ler —
// um Map vazio silencioso seria "ninguém ligou", e a diferença entre isso e "não consegui ler" é
// exatamente o fallback que já escondeu erro nesta base.
async function lerAutoTopup(env, ING) {
  const m = new Map();
  m.motivo = "";
  try {
    const r = await rpc("client_autotopup_enabled", { p_secret: ING });
    if (!r.ok) { m.motivo = `client_autotopup_enabled http ${r.status} — cole db/auto_topup.sql`; return m; }
    const d = await r.json().catch(() => null);
    if (!d || d.ok !== true || !Array.isArray(d.clientes)) { m.motivo = d?.erro || "resposta inesperada"; return m; }
    for (const c of d.clientes) {
      const e = ((c && c.email) || "").toString().trim().toLowerCase();
      if (e.includes("@")) m.set(e, (c.pack || "recarga_500").toString());
    }
  } catch (e) { m.motivo = String(e).slice(0, 120); }
  return m;
}

// O pacote → o link REAL do Stripe. Sem link cadastrado, cai no /planos com o e-mail (o mesmo
// caminho que os outros e-mails usam). NUNCA inventa URL: botão que leva a lugar nenhum num
// e-mail de dinheiro é pior que e-mail nenhum.
function linkDoPacote(email, pack) {
  const alvo = pack === "recarga_1500" ? "topup1500" : "topup500";
  const t = TOPUPS.find((x) => x.id === alvo) || null;
  if (t && t.url) return { url: t.url, credits: t.credits, price: t.price };
  return { url: `https://guileoai.com/planos?email=${encodeURIComponent(email)}`, credits: t ? t.credits : 0, price: t ? t.price : 0 };
}

// Manda o e-mail do link. Devolve true SÓ se a Resend aceitou — "mandei" sem conferir já produziu
// dois defeitos invisíveis nesta base. Latch próprio (`alarme_uma_vez`, 7 dias) porque o fluxo do
// zero agora RE-TENTA quando o aviso principal falha: sem trava própria, o segundo e-mail sairia
// junto de cada re-tentativa.
async function autoTopupEmail(env, email, { name, business, lang, pack }) {
  try {
    if (!env.RESEND_API_KEY) return false;
    const podeR = await rpc("alarme_uma_vez", { p_secret: env.INGEST_SECRET || "", p_chave: `autotopup:${email}`, p_minutos: 10080 });
    // A REGRA DO "NÃO SEI": só o `false` explícito ("já mandei") cala o e-mail. Trava inconsultável
    // não pode calar um aviso de dinheiro — no máximo repete, e repetir aqui é barato.
    if (podeR.ok && (await podeR.json().catch(() => null)) === false) return false;
    const { url, credits, price } = linkDoPacote(email, pack);
    const tpl = autoTopupLinkEmail({ name, business, lang, credits, price, url });
    const r = await send(env, email, tpl.subject, tpl.html);
    if (r && r.ok) return true;
    console.error(JSON.stringify({ autotopup_email: email, resend: r ? r.status : 0 }));
    return false;
  } catch (e) { console.error(JSON.stringify({ autotopup_email: email, erro: String(e).slice(0, 120) })); return false; }
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    const tok = new URL(request.url).searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
    if (!env.DIGEST_TOKEN || !safeEq(tok, env.DIGEST_TOKEN)) return json({ error: "unauthorized" }, 401);
    const ING = env.INGEST_SECRET || "";

    const OWNER = (env.OWNER_EMAIL && isOwnerEmail(env.OWNER_EMAIL, env)) ? env.OWNER_EMAIL : "smart@guileoai.com";

    const dr = await rpc("due_credit_alerts", { p_secret: ING });
    const due = dr.ok ? await dr.json() : [];
    // O pré-alerta de 20% roda SEMPRE, mesmo quando ninguém zerou — antes este `return` antecipado
    // encerrava a rota no caso mais comum (ninguém no zero), que é justamente quando ainda dá tempo
    // de avisar quem está descendo. Isolado: uma falha nele não pode derrubar o fluxo do zero.
    const rodaBaixo = async () => {
      try { return await preAlertaBaixo(env, ING, OWNER); }
      catch (e) { return { erro: String(e).slice(0, 120) }; }
    };
    if (!Array.isArray(due) || due.length === 0) return json({ ok: true, alerted: 0, low: await rodaBaixo() });

    let sent = 0, failed = 0, semMailer = 0, topupEnviados = 0;
    // QUEM LIGOU A RECARGA COM 1 CLIQUE — UMA leitura por rodada, não uma por cliente (a varredura
    // roda de hora em hora e tem orçamento de subrequests). Mapa vazio = ninguém ligou OU não deu
    // para ler; o motivo vai no JSON da rota (`autotopup`), nunca some.
    const autoTopup = await lerAutoTopup(env, ING);
    for (const c of due) {
      const email = (c.client_email || "").toString();
      if (!email.includes("@")) { await rpc("mark_credit_alerted", { p_secret: ING, p_email: email }); continue; }

      // profile for a personal greeting + the client's language
      let business = "seu negócio", lang = "pt", name = "tudo bem";
      try {
        const pr = await rpc("get_client_profile", { p_secret: ING, p_email: email });
        if (pr.ok) { const p = await pr.json(); if (p && typeof p === "object") { business = p.business_name || business; lang = ["pt", "es", "en"].includes(p.lang) ? p.lang : "pt"; name = p.owner || (lang === "en" ? "there" : "tudo bem"); } }
      } catch { /* defaults */ }

      // Only a DELIVERED alert may mark the client as alerted. mark_credit_alerted is a
      // one-shot latch: once set, this client is never warned again. Marking it after a
      // failed (or skipped, when RESEND_API_KEY is absent) send meant the client's Gui went
      // quiet — no calls, no follow-ups — and they were never told why. Leaving it unmarked
      // costs nothing: the next cron run simply retries.
      let clientAlerted = false;

      // ── SEM MAILER NÃO SE MARCA NADA ──────────────────────────────────────────────────────
      // `mark_credit_alerted` é um latch de uma vez só: marcado, este cliente nunca mais é
      // avisado nesta descida. Marcar sem ter tentado enviar queimava o aviso para sempre — o
      // Gui do cliente ficava mudo e ele nunca soube por quê. Não marcar não custa nada: a
      // rodada seguinte tenta de novo.
      if (!env.RESEND_API_KEY) {
        semMailer++;
        await emitFailure(env, "credito_zerado", email, `${business} zerou os créditos e NÃO há RESEND_API_KEY — nenhum aviso saiu.`);
        continue;
      }

      {
        // Conversion path: the alert carries the DIRECT upgrade link of the next plan up
        // (live Stripe payment link → webhook adds the credits instantly). Not inferable /
        // already on top → same branded alert with a /planos fallback (creditDepletedEmail).
        const up = nextPlanUp(c.plan);
        const tpl = up
          ? creditDepletedUpgradeEmail({ name, business, lang, upgradeName: up.name, upgradePrice: up.price, upgradeCredits: up.credits, upgradeUrl: up.url || "https://guileoai.com/planos" })
          : creditDepletedEmail({ name, business, lang });
        const r = await send(env, email, tpl.subject, tpl.html);                        // client (branded)
        clientAlerted = !!(r && r.ok);
        // O LINK DE RECARGA DE QUEM PEDIU POR ELE. Só sai para quem LIGOU a preferência no
        // cockpit, só quando o saldo é ZERO, e o e-mail diz na cara que ninguém passa o cartão
        // sozinho. Ver `autoTopupEmail` abaixo.
        if (autoTopup.has(email)) topupEnviados += await autoTopupEmail(env, email, { name, business, lang, pack: autoTopup.get(email) }) ? 1 : 0;
        // Aviso ao dono SÓ no caminho feliz. O caminho triste virou `emitFailure` (dedupado por
        // 6h) porque agora a rodada seguinte RE-TENTA o envio: sem o dedupe, o dono receberia o
        // mesmo 🚨 de hora em hora até alguém consertar o mailer — e alarme que repete é alarme
        // que se aprende a ignorar.
        if (clientAlerted) await send(env, OWNER,
          `⚡ ${business} (${email}) zerou os créditos do Gui`,
          `<div style="font-family:system-ui,sans-serif;max-width:520px"><b>${business}</b> (${email}) ficou sem créditos — o Gui pausou as tarefas pagas (ligações, mensagens, follow-ups). O cliente recebeu o aviso pra recarregar${up ? ` com o link direto do upgrade pro <b>${up.name}</b> ($${up.price}/mês)` : ""}.${autoTopup.has(email) ? " Ele tem a recarga com 1 clique LIGADA, então também recebeu o link do pacote." : ""} Plano: ${c.plan || "—"}. Vale dar um toque.</div>`);
      }
      // ── SÓ O ENVIO ENTREGUE MARCA ─────────────────────────────────────────────────────────
      // Este bloco dizia "always latch" três linhas depois do comentário lá em cima dizer "only a
      // DELIVERED alert may mark the client as alerted". Os dois não podiam estar certos, e quem
      // valia era o código: um 4xx da Resend (domínio, endereço inválido, rate limit) queimava o
      // latch para sempre e o cliente ficava com o Gui parado sem nunca ser avisado.
      // Agora: entregue → marca; falhou → NÃO marca, e a rodada da hora seguinte tenta de novo.
      // O medo antigo (aviso repetido de 15 em 15 minutos para o dono) morreu junto: o alarme sai
      // por `emitFailure`, que é dedupado por (tipo + cliente) a cada 6h.
      if (clientAlerted) { await rpc("mark_credit_alerted", { p_secret: ING, p_email: email }); sent++; }
      else {
        failed++;
        await emitFailure(env, "credito_zerado", email, `${business} (${email}) zerou os créditos e o e-mail de aviso FALHOU — ele não sabe que o Gui parou. Vai ser tentado de novo na próxima hora.`);
      }
    }
    return json({ ok: true, alerted: sent, failed, sem_mailer: semMailer, autotopup: { ligados: autoTopup.size, enviados: topupEnviados, motivo: autoTopup.motivo || "" }, low: await rodaBaixo() });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 120) }, 500);
  }
}
