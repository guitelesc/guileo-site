// Cloudflare Pages Function — POST /api/cerebro   · "POR QUE a IA não respondeu?"
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ESTA ROTA EXISTE
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 2026-08-24: o semáforo público mostrava `canary:gui_chat=failed` e `canary:widget_chat=failed`
// — vermelho, correto, e MUDO. Ele dizia que o cérebro de texto tinha caído, mas não dizia se
// era chave ausente, saldo zerado, teto de orçamento ou modelo fora do ar. Cada uma dessas pede
// uma ação completamente diferente, e sem o motivo o dono fica adivinhando.
//
// O `askClaude` já sabe a resposta: ele aceita um array `diag` e escreve nele o motivo REAL de
// cada tentativa, modelo por modelo. Só que ninguém expunha esse array. Esta rota é a janela.
//
// ⚠️ Gasta o MÍNIMO possível: um "ping" com teto de 5 tokens. Se o saldo acabou, nem isso passa —
// e é exatamente essa recusa que a gente quer ler.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { askClaude, MODEL_CHAIN } from "../lib/guiBrain.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "cerebro", 6)) return json({ error: "too many requests" }, 429);

    const b = await request.json().catch(() => ({}));
    const gate = await fetch(`${SB}/rest/v1/rpc/blitz_stats`, {
      method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: (b.token || "").toString().slice(0, 200), p_email: "" }),
    });
    if (!gate.ok) return json({ error: "unauthorized" }, 401);

    const diag = [];
    const t0 = Date.now();
    const resposta = await askClaude(env, {
      system: "Answer with the single word: ok",
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 5, diag,
    });
    const ms = Date.now() - t0;

    // A leitura acontece AQUI e não na tela: quem lê o painel não deve precisar interpretar
    // código de status HTTP pra saber o que fazer.
    const primeiro = diag[0] || {};
    const status = diag.map((d) => d.status).filter(Boolean);
    let causa = "desconhecida", acao = "";
    if (primeiro.erro === "ANTHROPIC_API_KEY ausente") {
      causa = "chave ausente"; acao = "Cloudflare Pages → Variables → ANTHROPIC_API_KEY (e REDEPLOY: secret novo só vale no próximo deploy).";
    } else if (diag.some((d) => d.bloqueado)) {
      causa = "teto de orçamento"; acao = "O teto diário de tokens bloqueou a chamada. Ver agent_orcamento.";
    } else if (status.some((s) => s === 401)) {
      causa = "chave inválida"; acao = "A Anthropic recusou a credencial. Gerar chave nova e redeployar.";
    } else if (status.some((s) => s === 400 || s === 402)) {
      causa = "saldo zerado"; acao = "A Anthropic devolve 400/402 quando os créditos acabam. Recarregar a conta.";
    } else if (status.some((s) => s === 429)) {
      causa = "limite de taxa"; acao = "Rate limit da Anthropic. Costuma passar sozinho.";
    } else if (resposta) {
      causa = "nenhuma — respondeu"; acao = "";
    }

    return json({
      ok: !!resposta, vivo: !!resposta, ms,
      causa, acao,
      cadeia: MODEL_CHAIN,
      // O diag INTEIRO vai junto: o resumo acima é conveniência, não substituto. Já me enganei
      // resumindo erro de provedor — a frase original é a única que nunca mente.
      tentativas: diag,
    });
  } catch (e) {
    return json({ error: String(e).slice(0, 200) }, 500);
  }
}
