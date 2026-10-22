// Cloudflare Pages Function — POST /api/provision-number  (admin-token gated)
//
// PROVISIONAR UM NÚMERO PRO CLIENTE, EM 1 CLIQUE — reusando antes de comprar.
//
// POR QUE: hoje cada cliente novo exige o Luis comprar um número na Twilio à mão e
// mapear. Com 10 clientes isso vira o gargalo dele. Mas esta é a ÚNICA rota da
// plataforma que GASTA DINHEIRO SOZINHA, então ela é construída ao contrário do
// resto: cada trava vem antes da compra, e a compra é o último recurso.
//
// ── AS TRAVAS DE DINHEIRO (nesta ordem) ──────────────────────────────────────
//  1. REUSA ANTES DE COMPRAR. A conta tem números ociosos (comprados e sem tenant).
//     Se existe um livre, usamos ele e o custo é ZERO. Comprar é o último recurso.
//  2. SALDO MÍNIMO. Abaixo do piso, recusa. Comprar número com saldo curto derruba
//     as ligações dos clientes que JÁ pagam pra pagar por um que ainda não usou.
//  3. TETO DIÁRIO. No máximo N compras por dia (env PROVISION_MAX_PER_DAY, padrão 3).
//     Um bug de laço não pode comprar 500 números às 3 da manhã.
//  4. IDEMPOTÊNCIA POR TENANT. Cliente que já tem número NUNCA compra outro. Sem isso,
//     dois cliques no botão = dois números cobrados pra sempre.
//  5. `dry_run` PADRÃO. Sem `confirm:true` explícito, ele só MOSTRA o que faria.
//     Quem gasta dinheiro tem que dizer que quer gastar.
//  6. ADMIN APENAS. Mesmo portão do /admin (blitz_stats). Nem agente nem tenant.
//
// ── O QUE O REVISOR ADVERSARIAL QUEBROU (2026-08-04) ─────────────────────────
// A primeira versão escrevia as travas 3 e 4 como `try/catch` em volta de `fetch`.
// Mas `fetch` NÃO lança em erro HTTP: um 401/500 do banco caía no caminho feliz com
// `taken = []` e `boughtToday = 0`. As quatro travas abriam JUNTAS, e o pior resultado
// nem era comprar demais — era oferecer o número JÁ EM USO de um cliente pagante como
// "ocioso, custo zero", derrubando a linha dele. Agora: TODA leitura que sustenta uma
// trava é fail-closed (`!r.ok` → recusa), e nenhuma delas depende de exceção.
// A trava 4 também estava morta por contrato: `client_agent_lookup` devolve o agent_id
// (texto), então `cur.number` era sempre `undefined`. Trocada por `client_number_for`.
// E a contagem+escolha viraram uma RESERVA ATÔMICA no banco (`provision_claim`), porque
// contar e depois gastar, sem reservar no meio, é corrida — dois cliques simultâneos
// passavam os dois.
import { json, rateLimited } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";
import { emitFailure } from "../lib/failure.js";
import { isReserved } from "../lib/reserved.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (fn, body) => fetch(`${SB}/rest/v1/rpc/${fn}`, {
  method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ""));
const norm = (s) => String(s || "").replace(/[^0-9+]/g, "");
const tw = (env) => ({
  sid: env.TWILIO_ACCOUNT_SID, tok: env.TWILIO_AUTH_TOKEN,
  auth: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`,
});

// Uma leitura que sustenta uma trava de dinheiro: ou responde, ou a rota para.
// Devolve `undefined` quando falhou — quem chama traduz isso em recusa 503.
async function readOrRefuse(env, fn, body) {
  let r = null;
  try { r = await svcRpc(env, fn, body); } catch { return undefined; }
  if (!r || !r.ok) return undefined;
  try { return await r.json(); } catch { return undefined; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // O token de admin é um literal estático e esta rota gasta dinheiro: sem limite de
    // taxa, dá pra tentar adivinhar o token na velocidade da rede. Fail-closed.
    if (await rateLimited(request, env, "provision", 6, 300, true)) {
      return json({ error: "muitas tentativas — espere alguns minutos" }, 429);
    }

    const b = await request.json().catch(() => ({}));

    // TRAVA 6 — admin apenas. (blitz_stats responde 403 a token errado → vr.ok false.)
    const vr = await rpc("blitz_stats", { p_token: (b.token || "").toString(), p_email: "" });
    if (!vr.ok) return json({ error: "unauthorized" }, 401);

    const email = (b.email || "").toString().trim().toLowerCase();
    if (!isEmail(email)) return json({ error: "informe o e-mail do cliente" }, 400);
    const t = tw(env);
    if (!t.sid || !t.tok) return json({ error: "Twilio não configurado", ready: false }, 503);

    // TRAVA 5 — só gasta com confirmação explícita.
    const confirm = b.confirm === true;
    const areaCode = (b.area_code || "").toString().replace(/[^0-9]/g, "").slice(0, 3);
    const secret = env.INGEST_SECRET || "";

    // TRAVA 4 — esse cliente já tem número? Então nunca compra outro.
    // Fail-closed: se eu não CONSIGO saber, não posso afirmar que ele não tem.
    const mine = await readOrRefuse(env, "client_number_for", { p_secret: secret, p_email: email });
    if (mine === undefined) {
      return json({ ok: false, blocked: "idempotencia_indisponivel", note: "não consigo verificar se este cliente já tem número — recuso pra não comprar um segundo" }, 503);
    }
    if (mine && String(mine).trim()) {
      return json({ ok: true, already: true, number: String(mine).trim(), note: "cliente já tem número — nada comprado" });
    }

    // Números que a conta JÁ possui.
    const listR = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${t.sid}/IncomingPhoneNumbers.json?PageSize=100`, { headers: { Authorization: t.auth } });
    if (!listR.ok) return json({ error: `twilio ${listR.status}` }, 503);
    const owned = ((await listR.json().catch(() => ({}))).incoming_phone_numbers) || [];

    // Quais já estão com um cliente? O registro é a verdade, não a Twilio.
    // Fail-closed e sem exceção: um 500 aqui virava lista vazia → TODO número parecia
    // ocioso → a rota entregava a linha viva de um cliente pagante pra outro.
    const taken = await readOrRefuse(env, "client_agents_numbers", { p_secret: secret });
    if (!Array.isArray(taken)) {
      return json({ ok: false, blocked: "registro_indisponivel", note: "não consigo ler quais números já são de clientes — recuso pra não entregar a linha de um cliente a outro" }, 503);
    }
    const takenSet = new Set(taken.map(norm));

    // TERCEIRA FONTE DE VERDADE: a ElevenLabs. Descoberto em produção 2026-08-04 — o
    // +14068000052 já tocava no agente da Natura e NÃO existia em client_agents, nem em
    // client_integrations, nem em provision_log. Ou seja: o banco o considerava livre e esta
    // rota o entregaria a outro cliente como "ocioso, custo zero", derrubando a linha viva de
    // quem paga. Unir as 3 fontes do banco não bastava porque a verdade dele mora aqui.
    // Fail-closed: se não consigo LER a ElevenLabs, não reuso nada (comprar segue permitido —
    // número novo não pertence a ninguém).
    let elevenOk = false;
    if (env.ELEVENLABS_API_KEY) {
      try {
        const er = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
        if (er.ok) {
          const ed = await er.json().catch(() => null);
          const list = Array.isArray(ed) ? ed : (ed && ed.phone_numbers) || null;
          if (Array.isArray(list)) {
            elevenOk = true;
            list.forEach((p) => { if (p && p.phone_number) takenSet.add(norm(p.phone_number)); });
          }
        }
      } catch { /* elevenOk fica false → não reusa */ }
    }

    // Ocioso = da conta, com voz, sem dono e não reservado pela plataforma.
    // Sem a confirmação da ElevenLabs, `idle` fica VAZIO de propósito: prefiro comprar $1.15
    // a arriscar entregar a linha de um cliente que já paga.
    const idle = elevenOk
      ? owned.filter((n) => n.capabilities?.voice && !takenSet.has(norm(n.phone_number)) && !isReserved(n.phone_number))
      : [];

    // TRAVA 1 — REUSA ANTES DE COMPRAR. Custo zero.
    // A reserva é atômica: duas requisições simultâneas não levam o mesmo número.
    if (idle.length && !confirm) {
      return json({
        ok: true, dry_run: true, source: "reuse", would_reuse: idle[0].phone_number, cost_usd: 0,
        idle_total: idle.length, note: "NADA foi reservado. Reenvie com confirm:true pra reservar este número pro cliente.",
      });
    }
    for (const pick of idle) {
      const cl = await readOrRefuse(env, "provision_claim", { p_secret: secret, p_email: email, p_number: pick.phone_number, p_max: 0, p_source: "reuse" });
      if (cl === undefined) return json({ ok: false, blocked: "reserva_indisponivel", note: "não consigo reservar no banco — recuso pra não dar o mesmo número a dois clientes" }, 503);
      if (cl.ok) {
        return json({
          ok: true, source: "reuse", cost_usd: 0, number: pick.phone_number, sid: pick.sid,
          idle_remaining: idle.length - 1,
          note: "número JÁ da conta, reservado pra este cliente — custo zero. Ligue a voz com /api/bind-number (email + number).",
        });
      }
      // Outra requisição levou este; tenta o próximo ocioso.
    }

    // Daqui pra baixo é COMPRA. Todas as travas restantes valem.
    const FLOOR = Number(env.PROVISION_BALANCE_FLOOR_USD) || 25;
    const balR = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${t.sid}/Balance.json`, { headers: { Authorization: t.auth } });
    const bal = Number(((await balR.json().catch(() => ({}))) || {}).balance);
    // TRAVA 2 — saldo. Se não dá pra LER o saldo, também recusa: comprar às cegas é pior.
    if (!Number.isFinite(bal) || bal < FLOOR) {
      return json({
        ok: false, blocked: "saldo_baixo", balance: Number.isFinite(bal) ? bal : null, floor: FLOOR,
        note: `Sem número ocioso e saldo ${Number.isFinite(bal) ? "$" + bal.toFixed(2) : "ilegível"} < piso $${FLOOR}. Recarregue antes — comprar agora arrisca derrubar quem já paga.`,
      }, 409);
    }

    const MAX_DAY = Number(env.PROVISION_MAX_PER_DAY) || 3;

    // Procura um número à venda.
    const q = new URLSearchParams({ VoiceEnabled: "true", SmsEnabled: "true", PageSize: "5" });
    if (areaCode) q.set("AreaCode", areaCode);
    const availR = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${t.sid}/AvailablePhoneNumbers/US/Local.json?${q}`, { headers: { Authorization: t.auth } });
    const avail = (((await availR.json().catch(() => ({}))).available_phone_numbers) || []).filter((a) => !isReserved(a.phone_number));
    if (!avail.length) return json({ ok: false, blocked: "sem_numero_disponivel", area_code: areaCode || null }, 404);

    const candidate = avail[0].phone_number;
    // O preço vem da Twilio quando ela informa; 1.15 é só o padrão US local. Gravar um
    // número inventado no log de custo é o mesmo que não ter log.
    const priceUsd = Number(avail[0]?.price ?? avail[0]?.current_price);
    const costUsd = Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : 1.15;

    // TRAVA 5 — sem confirm, PARA AQUI e só mostra. Nada é reservado nem contado.
    if (!confirm) {
      const seen = await readOrRefuse(env, "provision_count_today", { p_secret: secret });
      return json({
        ok: true, dry_run: true, would_buy: candidate, cost_usd: costUsd, balance: bal,
        bought_today: typeof seen === "number" ? seen : null, max_per_day: MAX_DAY,
        note: "NADA foi comprado. Reenvie com confirm:true pra efetivar.",
      });
    }

    // TRAVA 3 — teto diário + reserva do número, no MESMO instante e sob trava do banco.
    // Contar e depois comprar deixava a janela em que N requisições passavam juntas.
    const claim = await readOrRefuse(env, "provision_claim", { p_secret: secret, p_email: email, p_number: candidate, p_max: MAX_DAY, p_source: "purchase" });
    if (claim === undefined) {
      return json({ ok: false, blocked: "reserva_indisponivel", note: "não consigo reservar/contar no banco — recuso pra não estourar o teto diário às cegas" }, 503);
    }
    if (!claim.ok) {
      const st = claim.reason === "teto_diario" ? 429 : 409;
      return json({ ok: false, blocked: claim.reason, bought_today: claim.count ?? null, max: MAX_DAY }, st);
    }

    // COMPRA.
    let buyR = null, bought = {};
    try {
      buyR = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${t.sid}/IncomingPhoneNumbers.json`, {
        method: "POST", headers: { Authorization: t.auth, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ PhoneNumber: candidate, FriendlyName: `Guileo · ${email}` }),
      });
      bought = await buyR.json().catch(() => ({}));
    } catch (e) {
      // A rede caiu no meio: pode ter comprado. A reserva FICA (não solto), porque soltar
      // liberaria o teto pra uma segunda compra do mesmo número já cobrado.
      await emitFailure(env, "provision_buy_unknown", email,
        `Compra de ${candidate} sem resposta (${String(e).slice(0, 80)}) — confira em console.twilio.com ANTES de tentar de novo`, { candidate });
      return json({ ok: false, error: "sem resposta da Twilio — confira no console antes de repetir", candidate }, 504);
    }

    if (!buyR.ok || !bought.sid) {
      // Falha limpa (a Twilio respondeu que não comprou): solta a reserva pra não travar
      // o número nem consumir o teto do dia.
      await svcRpc(env, "provision_settle", { p_secret: secret, p_number: candidate, p_ok: false, p_sid: "", p_cost_cents: 0 }).catch(() => {});
      await emitFailure(env, "provision_buy_failed", email,
        `Compra de número FALHOU (${buyR.status}): ${bought?.message || ""} — confira em console.twilio.com se o número foi cobrado`,
        { candidate, status: buyR.status });
      return json({ ok: false, error: `twilio ${buyR.status}: ${(bought?.message || "").slice(0, 160)}` }, 503);
    }

    // Confirma a reserva. Se ISSO falhar, o dinheiro saiu e o registro não existe —
    // nunca silencioso: o teto do dia passa a subestimar e a auditoria de custo fica cega.
    const stR = await svcRpc(env, "provision_settle", {
      p_secret: secret, p_number: bought.phone_number, p_ok: true,
      p_sid: bought.sid, p_cost_cents: Math.round(costUsd * 100),
    }).catch(() => null);
    const recorded = !!(stR && stR.ok);
    if (!recorded) {
      await emitFailure(env, "provision_record_failed", email,
        `COMPRA FEITA (${bought.phone_number}, $${costUsd.toFixed(2)}) mas NÃO confirmada no registro (${stR && stR.status}) — o teto diário vai subestimar`,
        { number: bought.phone_number, sid: bought.sid });
    }

    return json({
      ok: true, source: "purchased", number: bought.phone_number, sid: bought.sid,
      cost_usd: costUsd, balance_before: bal, recorded,
      note: "comprado. Agora ligue a voz com /api/bind-number (email + number).",
    });
  } catch (e) { return json({ error: String(e).slice(0, 140) }, 400); }
}
