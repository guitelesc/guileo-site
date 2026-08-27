// functions/lib/autoApprove.js — AUTO-APROVAÇÃO DE CADASTRO PAGO.
//
// O BURACO QUE ISTO FECHA: o vendedor preenche o cadastro COMPLETO em /vendedor (negócio, agente,
// unidades, serviços com preço, canais, logo) e isso vira um rascunho em onboard_drafts. O cliente
// paga. E aí… nada acontece até o Luis abrir o /admin e clicar "Aprovar". Nesse meio-tempo o
// cliente pagou e não tem produto. Pior: o caminho self-serve do stripe-webhook nasce uma Gui
// MAGRA (sem preços, sem menu — o `thin_agent_born` que o próprio webhook já denuncia) mesmo
// quando existe um cadastro rico esperando na fila.
//
// O QUE ESTE MÓDULO FAZ: pagou → tem rascunho completo com aquele e-mail → aprova pelo MESMO motor
// de sempre (POST /api/onboard-draft action=approve), com o token de admin do servidor.
//
// AS TRAVAS (todas de propósito):
//   · DESLIGADO POR PADRÃO — platform_settings.auto_approve_paid !== '1' → não faz nada.
//   · VALOR MÍNIMO — abaixo de $149 é recarga de crédito, não compra de plano. Recarga não faz
//     nascer agente nenhum.
//   · ZERO RASCUNHO → não faz nada (o caminho self-serve do webhook segue como sempre).
//   · DOIS OU MAIS RASCUNHOS → NÃO ESCOLHE. Alerta o dono e para. Escolher "o mais recente" aqui
//     seria dar à luz o agente errado com o cadastro errado — e ninguém saberia.
//   · CLAIM ANTES DE APROVAR — claim_credit_event('auto_approve:'+draftId). Dois eventos do Stripe
//     sobre o MESMO dinheiro (checkout + invoice, ids diferentes) tentariam aprovar duas vezes, e
//     aprovar duas vezes COMPRA UM SEGUNDO NÚMERO. A trava é a mesma que protege o crédito.
//   · NUNCA MANDA confirm:true — o portão do número compartilhado (409 confirm_required em
//     onboard-draft.js) continua sendo decisão de humano. A máquina faz tudo, menos assumir isso:
//     manda um e-mail "falta 1 clique". (O incidente real: a linha de DEMO da plataforma
//     atendendo pelo spa de um cliente.)
//   · NUNCA LANÇA — este módulo roda dentro de um webhook de pagamento. Uma exceção aqui não pode,
//     em hipótese nenhuma, derrubar o crédito do cliente. Tudo devolve objeto, nada propaga.
//
// SEMPRE devolve um objeto dizendo o que aconteceu (e por que não aconteceu):
//   { skipped:'sem ADMIN_TOKEN' | 'off' | 'valor_baixo' | 'sem_draft' | 'ambiguo' | 'ja_tentado' }
//   { needs_click:true, draft_id } · { approved:true, draft_id, agent_id, number } · { failed:true, erro }
import { emitFailure } from "./failure.js";
import { autoApprovedEmail, autoApproveNeedsClickEmail } from "./emailTemplates.js";
import { sbKey, SB_URL } from "./sb.js";

// Segredo dedicado das RPCs de idempotência (mesmo par env+fallback do stripe-webhook.js).
const PEND_FALLBACK = "gx_pend_7Qk2mZ9vR4tLpW8n_cit3l3s";

// Piso do que faz nascer um agente: o plano mais barato que provisiona custa $149. Abaixo disso é
// recarga/top-up — cliente que JÁ tem Gui comprando crédito solto. Recarga não pare agente.
const MINIMO_CENTAVOS = 14900;

// RPC anon gated por INGEST (mesmo formato de dunning-sweep.js). Devolve null em qualquer erro —
// e quem chama trata null como "não sei", nunca como "não tem".
async function rpc(env, fn, args) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch { return null; }
}

// E-mail ao dono. Confere o retorno da Resend: "enviei" sem olhar a resposta é promessa sem lastro
// (feedback_check_send_results — dois bugs invisíveis vieram exatamente daí).
async function avisarDono(env, { subject, html }, marca) {
  if (!env.RESEND_API_KEY) { console.error(JSON.stringify({ auto_approve_email: marca, erro: "sem RESEND_API_KEY" })); return false; }
  try {
    const to = (env.OWNER_EMAIL || "smart@guileoai.com").toString().split(",")[0].trim();
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [to], subject, html }),
    });
    if (!r.ok) {
      const corpo = await r.text().catch(() => "");
      console.error(JSON.stringify({ auto_approve_email: marca, resend: r.status, corpo: corpo.slice(0, 200) }));
      return false;
    }
    return true;
  } catch (e) {
    console.error(JSON.stringify({ auto_approve_email: marca, erro: String(e).slice(0, 160) }));
    return false;
  }
}

/**
 * tentarAutoAprovar(env, request, { email, source, cents })
 * `request` só é usado para derivar a URL interna (mesma origem) do /api/onboard-draft.
 * `source` entra nos alertas ('stripe' | 'mercadopago' | 'draft_save') para o dono saber de onde veio.
 */
export async function tentarAutoAprovar(env, request, { email, source = "", cents = 0 } = {}) {
  try {
    const alvo = (email || "").toString().trim().toLowerCase();
    if (!alvo || !alvo.includes("@")) return { skipped: "sem_email" };

    // 0) SEM TOKEN DE ADMIN NÃO EXISTE AUTO-APROVAÇÃO. O approve é uma ação de admin, e o único
    //    jeito honesto de o servidor agir como admin é ter o ADMIN_TOKEN. Sem ele: resposta
    //    explícita, nunca uma exceção dentro do webhook de pagamento.
    if (!env.ADMIN_TOKEN) return { skipped: "sem ADMIN_TOKEN" };

    const ING = env.INGEST_SECRET || "";
    if (!ING) return { skipped: "sem INGEST_SECRET" };

    // 1) A CHAVE ESTÁ LIGADA? Ausente = desligado, de propósito (nasce off; ligar é decisão do dono
    //    em /admin → "⚙️ Regras de cobrança"). Falha de leitura também = desligado: aprovar sozinho
    //    porque "não consegui perguntar se podia" é o pior default possível.
    const cfg = await rpc(env, "platform_settings_get", { p_secret: ING });
    const ligado = cfg && typeof cfg === "object" && !Array.isArray(cfg) && String(cfg.auto_approve_paid ?? "") === "1";
    if (!ligado) return { skipped: "off" };

    // 2) VALOR — recarga não faz nascer agente.
    const valor = Number(cents) || 0;
    if (valor < MINIMO_CENTAVOS) return { skipped: "valor_baixo" };

    // 3) EXISTE CADASTRO COMPLETO EM RASCUNHO PARA QUEM PAGOU?
    const achados = await rpc(env, "draft_find_paid", { p_secret: ING, p_client_email: alvo });
    const lista = Array.isArray(achados) ? achados : [];
    if (lista.length === 0) return { skipped: "sem_draft" };
    if (lista.length > 1) {
      // NÃO ESCOLHE. Dois cadastros para o mesmo e-mail é ambiguidade real (vendedor duplicou, ou
      // dois vendedores disputam o cliente) — escolher errado dá à luz o agente errado, calado.
      await emitFailure(env, "auto_approve_ambiguous", alvo,
        `${lista.length} cadastros em rascunho para o mesmo e-mail (${source || "pagamento"} · $${(valor / 100).toFixed(2)}) — NÃO aprovei nenhum; escolha o certo em /admin`,
        { drafts: lista.map((d) => (d && d.id) || "").filter(Boolean).slice(0, 10), source });
      return { skipped: "ambiguo" };
    }

    const draft = lista[0] || {};
    const draftId = (draft.id || "").toString();
    const business = (draft.business || "").toString();
    if (!draftId) return { skipped: "sem_draft" };

    // 4) CLAIM ANTES DE APROVAR (não depois). Aprovar é caro e irreversível: cria agente na
    //    ElevenLabs e pode COMPRAR um número na Twilio. Dois eventos do mesmo dinheiro (o
    //    checkout.session.completed e o invoice.paid da primeira assinatura têm ids diferentes)
    //    chegariam aqui os dois. A chave é o RASCUNHO, não o evento: qualquer caminho (Stripe,
    //    Mercado Pago, o gancho do draft_save) que tente aprovar o MESMO rascunho é barrado.
    //    Assinatura idêntica à usada no stripe-webhook.js.
    const PEND = env.PEND_SECRET || PEND_FALLBACK;
    const claim = await rpc(env, "claim_credit_event", { p_secret: PEND, p_event_id: `auto_approve:${draftId}`, p_email: alvo });
    if (claim === false) return { skipped: "ja_tentado" };
    // claim === null (RPC ausente/banco fora) segue: o pior caso é um 409/erro do approve, e o
    // approve real ainda tem os portões dele. Parar aqui deixaria o cliente pago sem agente.

    // 5) APROVA PELO MOTOR DE SEMPRE — /api/onboard-draft action=approve, SEM confirm.
    //    Reusar o endpoint (em vez de chamar onboard-client direto) mantém UM caminho de
    //    nascimento: o mesmo mapeamento, o mesmo portão do número, a mesma marcação de 'live'.
    const url = new URL("/api/onboard-draft", request.url);
    const origem = url.origin;
    const pr = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origem },   // o portão de mesma-origem do endpoint exige este cabeçalho
      body: JSON.stringify({ action: "approve", token: env.ADMIN_TOKEN, id: draftId }),
    });
    const out = await pr.json().catch(() => ({}));

    // 5a) 409 confirm_required → o número seria o COMPARTILHADO. Fim da linha da máquina.
    if (pr.status === 409 || (out && out.error === "confirm_required")) {
      const enviado = await avisarDono(env, autoApproveNeedsClickEmail({
        business, clientEmail: alvo, motivo: (out && out.motivo) || "", draftId,
      }), "needs_click");
      if (!enviado) {
        // O e-mail é o ÚNICO jeito de o dono saber que tem cliente pago esperando 1 clique. Se ele
        // não saiu, isso vira falha visível no /admin — silêncio aqui é cliente pago esquecido.
        await emitFailure(env, "auto_approve_needs_click_email_failed", alvo,
          `${business || alvo} pagou e o cadastro espera 1 clique, mas o e-mail de aviso NÃO saiu — aprove em /admin`, { draft_id: draftId, source });
      }
      return { needs_click: true, draft_id: draftId, aviso_enviado: enviado };
    }

    // 5b) qualquer outro erro → alto e claro, com o rascunho nomeado.
    if (!pr.ok || (out && out.error)) {
      await emitFailure(env, "auto_approve_failed", alvo,
        `aprovação automática falhou (${(out && out.error) || `HTTP ${pr.status}`}) — ${business || alvo} pagou $${(valor / 100).toFixed(2)} e continua sem agente; aprove à mão em /admin`,
        { draft_id: draftId, source, status: pr.status });
      return { failed: true, draft_id: draftId, erro: (out && out.error) || `HTTP ${pr.status}` };
    }

    // 5c) NASCEU. O e-mail leva o COMPROVANTE (agente, número, passos) — "aprovei" sem dizer o que
    //     nasceu seria exatamente o "ok sem id" que esta casa já pagou caro para aprender.
    await avisarDono(env, autoApprovedEmail({
      business, clientEmail: alvo, agentId: out.agent_id || "", number: out.number || "", steps: out.steps || null, draftId,
    }), "approved");
    return { approved: true, draft_id: draftId, agent_id: out.agent_id || "", number: out.number || "" };
  } catch (e) {
    // A rede de segurança final: um webhook de pagamento NUNCA cai por causa disto.
    try { console.error(JSON.stringify({ auto_approve: "throw", erro: String(e).slice(0, 200) })); } catch { /* */ }
    return { failed: true, erro: String(e).slice(0, 160) };
  }
}
