// Cloudflare Pages Function — POST /api/admin-comando
// O painel de comando do dono. Uma leitura só, quatro perguntas:
//   dinheiro entrando? · operação rodou? · vendedores vendendo? · o que precisa da MINHA mão?
// AUTH: senha do /admin. A RPC faz o portão de novo (`_admin_ok`), então nem um bug aqui abriria.
//
// ── E AGORA TAMBÉM AS AÇÕES QUE O PAINEL ACUSAVA E NÃO OFERECIA ────────────────────────────────
// O painel dizia "N cliente(s) no vermelho — cobrar ou recarregar" e não tinha botão nenhum:
// recarregar era SQL na mão. Acusação sem ação treina o dono a ignorar a lista inteira. As ações
// abaixo fecham esse buraco, TODAS atrás do MESMO portão (senha do /admin conferida no banco):
//   { token }                                            -> { ok, painel }            (leitura padrão)
//   { action:"clients_count", token }                     -> { ok, n, fonte }
//   { action:"grant_credits", token, email, amount, reason, request_id? }
//   { action:"dunning_list", token }                      -> { ok, pronto, grace, vencidos[] }
//   { action:"pause_client", token, email, motivo, modo:"fim_do_ciclo"|"agora" }
//   { action:"settings", token }                          -> { ok, valores, efetivo }
//   { action:"settings_set", token, key, value }
//   { action:"subscriptions", token }                     -> { ok, chave:true, mrr, past_due[], churn_30d }
//
// ⚠️ NUNCA ZERO FINGIDO: sem STRIPE_SECRET_KEY a resposta diz `chave:false` e a tela pede a chave.
// Um MRR "$0" por falta de chave é a mesma mentira do canal verde com token vencido.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { svcJson, svcRpc } from "../lib/sb.js";

// ── PORTÃO ÚNICO ──────────────────────────────────────────────────────────────────────────────
// admin_comando LEVANTA com token errado → svcJson devolve {ok:false, erro_http:400}. Ler a
// RESPOSTA, não o status do fetch: é a diferença entre "senha errada" e "o painel está vazio"
// (feedback_status_nao_e_autenticacao — `.then(r=>r.ok)` sobre RPC booleana já abriu um portão).
async function portao(env, token) {
  const d = await svcJson(env, "admin_comando", { p_token: (token || "").toString() });
  return (!d || d.ok === false) ? null : d;
}

// Stripe REST — GET simples. Devolve {ok, dados} ou {ok:false, motivo} com o motivo INTEIRO.
async function stripeGet(env, caminho) {
  try {
    const r = await fetch(`https://api.stripe.com/v1/${caminho}`, {
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, motivo: (d && d.error && d.error.message) || `HTTP ${r.status}` };
    return { ok: true, dados: d };
  } catch (e) { return { ok: false, motivo: String(e).slice(0, 160) }; }
}

// Valor mensal de uma subscription, em centavos. Normaliza o intervalo (anual/semanal/diário)
// para MÊS — somar um plano anual como se fosse mensal infla o MRR em 12×.
function mrrCentsDaSub(sub) {
  let total = 0;
  for (const it of (sub?.items?.data || [])) {
    const preco = it.price || it.plan || {};
    const bruto = Number(preco.unit_amount ?? preco.amount ?? 0) * Number(it.quantity || 1);
    if (!Number.isFinite(bruto) || bruto <= 0) continue;
    const rec = preco.recurring || preco;               // price.recurring.{interval,interval_count} ou plan.{...}
    const intervalo = String(rec.interval || "month");
    const n = Math.max(1, Number(rec.interval_count || 1));
    const porMes = intervalo === "year" ? bruto / (12 * n)
      : intervalo === "week" ? (bruto * 52) / (12 * n)
      : intervalo === "day" ? (bruto * 365) / (12 * n)
      : bruto / n;
    total += porMes;
  }
  return Math.round(total);
}

const nomeDoCliente = (sub) => {
  const c = sub && sub.customer;
  if (c && typeof c === "object") return { nome: c.name || c.email || c.id || "", email: c.email || "" };
  return { nome: (typeof c === "string" ? c : ""), email: "" };
};

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "admin-comando", 60)) return json({ error: "rate" }, 429);
    const b = await request.json().catch(() => ({}));
    const acao = (b.action || "").toString();
    const ING = env.INGEST_SECRET || "";

    const painel = await portao(env, b.token);
    if (!painel) return json({ error: "unauthorized" }, 401);

    // ── CONTAGEM DE CLIENTES — a MESMA fonte do painel (carteira, sem contas internas).
    // O tile "Registered clients" lia a tabela `clients` com a chave anon: o RLS nega e o
    // PostgREST devolve LISTA VAZIA SEM ERRO, então a tela imprimia 0 clientes ao lado da
    // carteira listando os pagantes — dois números divergentes na mesma página, o errado com
    // cara de certeza. Aqui a resposta vem de quem tem autoridade e é UMA só.
    if (acao === "clients_count") {
      return json({ ok: true, n: painel.clientes_reais ?? null, fonte: "carteira (client_credits, sem contas internas)" });
    }

    // ── ➕ CRÉDITOS — o botão que faltava embaixo da acusação "cliente no vermelho". ──────────
    if (acao === "grant_credits") {
      const email = (b.email || "").toString().trim().toLowerCase();
      const amount = Math.trunc(Number(b.amount));
      const motivo = (b.reason || "").toString().trim();
      if (!email.includes("@")) return json({ ok: false, motivo: "e-mail do cliente inválido" }, 400);
      if (!Number.isFinite(amount) || amount === 0) return json({ ok: false, motivo: "quantidade tem que ser diferente de zero" }, 400);
      if (!motivo) return json({ ok: false, motivo: "motivo é obrigatório — crédito sem motivo é dinheiro sem história" }, 400);
      const d = await svcJson(env, "admin_grant_credits", {
        p_secret: ING, p_email: email, p_amount: amount, p_reason: motivo.slice(0, 200),
        p_request_id: (b.request_id || "").toString().slice(0, 80),
      });
      if (!d || d.ok !== true) return json({ ok: false, motivo: (d && (d.detalhe || d.message)) || "o banco recusou o ajuste (db/admin_credit_grant.sql aplicado?)" }, 400);
      return json(d); // devolve saldo NOVO: "ok" sem comprovante é promessa sem lastro
    }

    // ── ⚙️ REGRAS DE COBRANÇA — settings do banco, env como fallback. ─────────────────────────
    if (acao === "settings" || acao === "settings_set") {
      if (acao === "settings_set") {
        const key = (b.key || "").toString().trim().toLowerCase();
        const value = (b.value ?? "").toString().trim();
        const r = await svcJson(env, "platform_settings_set", { p_secret: ING, p_key: key, p_value: value });
        if (!r || r.ok !== true) return json({ ok: false, motivo: (r && (r.detalhe || r.message)) || "o banco recusou (db/platform_settings.sql aplicado?)" }, 400);
      }
      const s = await svcJson(env, "platform_settings_get", { p_secret: ING });
      const pronto = !!s && s.ok !== false && typeof s === "object";
      const v = pronto ? s : {};
      // `efetivo` = o que REALMENTE vale agora, com a origem de cada valor ao lado. Mostrar só o
      // valor do banco esconderia que a env ainda manda enquanto a tabela não existe.
      const efetivo = {
        dunning_enforce: v.dunning_enforce != null
          ? { valor: String(v.dunning_enforce), origem: "banco" }
          : { valor: String(env.DUNNING_ENFORCE || "0"), origem: "env (Cloudflare)" },
        grace_days: v.grace_days != null
          ? { valor: String(v.grace_days), origem: "banco" }
          : { valor: String(parseInt(env.GRACE_DAYS, 10) || 10), origem: "env (Cloudflare)" },
        silent_days: v.silent_days != null
          ? { valor: String(v.silent_days), origem: "banco" }
          // 5 é o MESMO padrão de health-monitor.js (quem realmente lê SILENT_DAYS). Escrever 7
          // aqui faria a tela afirmar um número que nenhum motor usa — dois valores divergentes
          // para a mesma regra, que é exatamente o que este painel existe para não fazer.
          : { valor: String(parseInt(env.SILENT_DAYS, 10) || 5), origem: "env (Cloudflare)" },
      };
      return json({ ok: true, pronto, valores: v, efetivo });
    }

    // ── 📉 VENCIDOS — a MESMA lista que o sweep usa (dunning_candidates), agora na tela. ──────
    if (acao === "dunning_list") {
      const s = await svcJson(env, "platform_settings_get", { p_secret: ING });
      const grace = Math.max(1, parseInt((s && s.grace_days) || env.GRACE_DAYS, 10) || 10);
      const r = await svcRpc(env, "dunning_candidates", { p_secret: ING, p_grace_days: grace });
      if (!r.ok) return json({ ok: true, pronto: false, grace, vencidos: [], motivo: `dunning_candidates não respondeu (HTTP ${r.status}) — db/dunning_grace.sql aplicado?` });
      const linhas = await r.json().catch(() => null);
      // ⚠️ `|| []` aqui viraria "nenhum inadimplente" quando a verdade é "não consegui ler".
      if (!Array.isArray(linhas)) return json({ ok: true, pronto: false, grace, vencidos: [], motivo: "resposta ilegível de dunning_candidates" });
      return json({ ok: true, pronto: true, grace, vencidos: linhas });
    }

    // ── ⏸️ PAUSAR POR INADIMPLÊNCIA — a decisão do dono, cliente a cliente. ───────────────────
    // Por que é manual e não automático: o DUNNING_ENFORCE liga a pausa para TODOS de uma vez.
    // Cortar um cliente é escolha comercial (o que teve um problema de cartão não é o que sumiu),
    // então o botão pausa UM, com motivo, e deixa o interruptor global onde está.
    if (acao === "pause_client") {
      const email = (b.email || "").toString().trim().toLowerCase();
      const motivo = (b.motivo || "").toString().trim() || "inadimplência";
      const agora = (b.modo || "fim_do_ciclo") === "agora";
      if (!email.includes("@")) return json({ ok: false, motivo: "e-mail do cliente inválido" }, 400);

      const passos = { stripe: "não tentado", tenant: "não tentado", auditoria: "não tentado" };

      // (a) Stripe — cancelar a assinatura do cliente. Sem chave, dizemos isso; nunca fingimos.
      let assinatura = null;
      if (!env.STRIPE_SECRET_KEY) {
        passos.stripe = "sem STRIPE_SECRET_KEY — cancelar na mão no painel do Stripe";
      } else {
        const busca = await stripeGet(env, `subscriptions?status=all&limit=100&expand[]=data.customer`);
        if (!busca.ok) passos.stripe = `não consegui ler o Stripe: ${busca.motivo}`;
        else {
          const alvo = (busca.dados.data || []).find((su) => {
            const c = su.customer;
            const em = (c && typeof c === "object" ? c.email : "") || "";
            return em.toLowerCase().trim() === email && ["active", "past_due", "unpaid", "trialing"].includes(su.status);
          });
          if (!alvo) passos.stripe = "nenhuma assinatura ativa/vencida com esse e-mail no Stripe";
          else {
            try {
              const corpo = agora ? null : new URLSearchParams({ cancel_at_period_end: "true" });
              const r = await fetch(`https://api.stripe.com/v1/subscriptions/${alvo.id}`, {
                method: agora ? "DELETE" : "POST",
                headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, ...(corpo ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
                ...(corpo ? { body: corpo } : {}),
              });
              const d = await r.json().catch(() => ({}));
              if (!r.ok) passos.stripe = `o Stripe recusou: ${(d.error && d.error.message) || `HTTP ${r.status}`}`;
              else { assinatura = d.id; passos.stripe = agora ? `cancelada agora (${d.id})` : `cancela no fim do ciclo (${d.id})`; }
            } catch (e) { passos.stripe = `erro ao cancelar: ${String(e).slice(0, 120)}`; }
          }
        }
      }

      // (b) TENANT — o estado live/paused do cliente mora em client_credits (paused_at +
      // pause_reason); set_client_paused é a MESMA função que o stage-2 do sweep usa, e o próximo
      // pagamento bem-sucedido despausa sozinho (webhook). Não inventamos coluna nova.
      const pr = await svcJson(env, "set_client_paused", { p_secret: ING, p_email: email, p_paused: true, p_reason: motivo.slice(0, 120) });
      const pausou = !!(pr && pr.paused === true);
      passos.tenant = pausou ? "pausado (a Gui não age mais; volta no próximo pagamento)" : `NÃO pausei: ${(pr && (pr.detalhe || pr.message)) || "set_client_paused não confirmou"}`;

      // (c) RASTRO — quem pausou, quando e por quê, no feed do próprio cliente.
      const ir = await svcRpc(env, "ingest_client_event", {
        p_secret: ING, p_email: email, p_type: "ops_alert", p_channel: "system",
        p_summary: `⏸️ Pausado por inadimplência pelo /admin — ${motivo}`.slice(0, 300), p_amount: 0,
        p_payload: { kind: "admin_pause", motivo, stripe: passos.stripe, subscription: assinatura, modo: agora ? "agora" : "fim_do_ciclo" },
      });
      passos.auditoria = ir.ok ? "registrado no feed do cliente" : `não registrei (HTTP ${ir.status})`;

      return json({ ok: pausou, email, passos });
    }

    // ── 💰 ASSINATURAS — MRR real · vencidos · churn 30d, direto da API do Stripe. ────────────
    if (acao === "subscriptions") {
      if (!env.STRIPE_SECRET_KEY) {
        return json({ ok: true, chave: false, motivo: "conecte a chave do Stripe (STRIPE_SECRET_KEY) — sem ela não existe MRR para mostrar" });
      }
      const [ativas, vencidas, canceladas] = await Promise.all([
        stripeGet(env, "subscriptions?status=active&limit=100&expand[]=data.customer"),
        stripeGet(env, "subscriptions?status=past_due&limit=100&expand[]=data.customer"),
        stripeGet(env, "subscriptions?status=canceled&limit=100&expand[]=data.customer"),
      ]);
      if (!ativas.ok) return json({ ok: true, chave: true, lido: false, motivo: ativas.motivo });

      const listaAtivas = ativas.dados.data || [];
      const mrr_cents = listaAtivas.reduce((s, su) => s + mrrCentsDaSub(su), 0);

      const corte = Math.floor(Date.now() / 1000) - 30 * 86400;
      const past_due = (vencidas.ok ? (vencidas.dados.data || []) : []).map((su) => {
        const { nome, email } = nomeDoCliente(su);
        const desde = Number(su.current_period_end || su.created || 0);
        return {
          id: su.id, nome, email,
          valor_cents: mrrCentsDaSub(su),
          dias: desde ? Math.max(0, Math.floor((Date.now() / 1000 - desde) / 86400)) : null,
        };
      });
      const churn_30d = (canceladas.ok ? (canceladas.dados.data || []) : [])
        .filter((su) => Number(su.canceled_at || su.ended_at || 0) >= corte).length;

      return json({
        ok: true, chave: true, lido: true,
        mrr_cents, ativas: listaAtivas.length, past_due,
        // "—" na tela em vez de 0 quando uma das duas leituras secundárias falhou.
        past_due_lido: vencidas.ok, churn_lido: canceladas.ok,
        churn_30d: canceladas.ok ? churn_30d : null,
        motivo_parcial: [!vencidas.ok ? `vencidos: ${vencidas.motivo}` : "", !canceladas.ok ? `churn: ${canceladas.motivo}` : ""].filter(Boolean).join(" · "),
      });
    }

    if (acao) return json({ error: "unknown action" }, 400);
    return json({ ok: true, painel });
  } catch (e) { return json({ ok: false, motivo: String(e).slice(0, 160) }, 400); }
}
