// Cloudflare Pages Function — GET/POST /api/comentarios-varredura?token=DIGEST_TOKEN|senha do /admin
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// A REDE DE PROTEÇÃO DO COMENTÁRIO→DM.
//
// POR QUE EXISTE (2026-08-28): o motor inteiro depende de a Meta ENTREGAR o webhook. Ela reentrega
// quando a gente não responde 200 — mas até certo ponto. Dois furos, os dois silenciosos:
//   1. a Meta esgota as retentativas e o comentário some. A requisição nunca chegou aqui, então
//      não existe linha nenhuma para investigar: "ninguém comentou" e "perdemos" têm a MESMA cara.
//   2. um surto de 5xx (aconteceu em 28/08, e era da Cloudflare, não nosso) derruba uma janela
//      inteira de entregas de uma vez.
// `canais-prova` passou a DETECTAR o segundo caso (a assinatura desativada). Isto aqui RECUPERA.
//
// COMO NÃO DUPLICA COMPORTAMENTO: não reimplementa nada da decisão. Descobre comentários recentes
// e chama `processCommentChange` — a MESMA função do webhook — com um `value` da mesma forma que a
// Meta manda. Duas verdades sobre "quando mandar DM" seria o erro que o sellerAuth documenta sobre
// autenticação. E a reserva atômica lá dentro (meta_comment_claim, unique index por comment_id) é
// o que garante que recuperar um comentário que o webhook JÁ tratou não manda DM em dobro.
//
// TETOS, porque varredura sem teto é rajada: janela de tempo curta, poucos posts por conta, e um
// máximo duro de ações por passada. Mandar DM sobre um comentário de três dias atrás é pior que
// não mandar — a pessoa já esqueceu, e a conta parece robô atrasado.
//
// GATE: DIGEST_TOKEN (o cron) OU a senha do /admin, lendo o CORPO de `_admin_ok`, nunca o status.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import { json, safeEq } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { escolherCampanha } from "../lib/comentarios.js";
import { processCommentChange } from "./meta-webhook.js";

const GRAPH = "https://graph.facebook.com/v21.0";
const s = (v, n = 200) => (v == null ? "" : v.toString().slice(0, n));

// Os tetos. Conservadores de propósito — esta varredura existe para pegar o que ESCAPOU, não para
// ser o caminho normal. Se ela começar a recuperar muito, o problema é a entrega, não o teto.
const JANELA_HORAS = Number(6);   // comentário mais velho que isso não vira DM: tarde demais
const POSTS_POR_CONTA = 6;        // só as publicações recentes; comentário novo mora nelas
const MAX_ACOES = 15;             // teto duro por passada, somando todas as contas

export async function varrer(request, env) {
  const url = new URL(request.url);
  // ⚠️ CABEÇALHO TAMBÉM (2026-09-02). Só o `?token=` significava que o segredo do operador entrava
  // na URL — e URL vai pra log de acesso, histórico do navegador e Referer. O cron continua
  // podendo usar a query (é como ele foi configurado); quem chama à mão usa o cabeçalho.
  // Mesmo portão duplo, duas portas — igual agent-evolve e canais-prova já fazem.
  const tok = s(url.searchParams.get("token") || request.headers.get("x-guileo-secret"), 200);

  // ── PORTÃO DUPLO (mesmo padrão de canais-prova / agente-prova) ────────────────────────────
  let autorizado = !!(env.DIGEST_TOKEN && tok && safeEq(tok, env.DIGEST_TOKEN));
  if (!autorizado && tok) {
    // ⚠️ lê o CORPO do _admin_ok, nunca o status HTTP: uma RPC que devolve false com 200 passaria
    // por `r.ok` e abriria a varredura para qualquer um.
    const a = await svcJson(env, "_admin_ok", { p_token: tok }).catch(() => null);
    autorizado = (a === true || (a && a.ok === true));
  }
  if (!autorizado) return json({ error: "unauthorized" }, 401);

  const ING = env.INGEST_SECRET || "";
  if (!ING) return json({ ok: false, pronto: false, nota: "INGEST_SECRET ausente" }, 503);

  const contas = await svcJson(env, "meta_campanhas_contas", { p_secret: ING });
  if (!Array.isArray(contas)) {
    return json({ ok: false, pronto: false, nota: "não consegui listar as contas com campanha (cole db/meta_comment_dm.sql?)" });
  }
  if (!contas.length) return json({ ok: true, contas: 0, nota: "nenhuma campanha ativa — nada a varrer" });

  // JANELA AJUSTÁVEL, com teto. Depois de um incidente conhecido ("a Meta ficou 3h sem entregar")
  // o operador precisa varrer mais para trás UMA vez — e sem isso a rede só cobre as últimas 6h.
  // O teto de 48h existe porque DM sobre comentário de três dias é pior que DM nenhum: a pessoa já
  // esqueceu, e a conta parece robô atrasado. Fora da faixa cai no padrão em vez de virar erro.
  // ── MODO "SÓ OLHAR" (?ver=1) ─────────────────────────────────────────────────────────────
  // Nasceu de um ensaio que não disparou (02/09). O comentário existia, a varredura dizia
  // "1 processado, 0 enviado", e não havia rastro nenhum: comentário que não casa palavra é
  // descartado em silêncio DE PROPÓSITO (senão todo "que lindo 😍" viraria linha no painel do
  // dono). O preço desse silêncio é não dar pra investigar — e eu fiquei duas rodadas adivinhando.
  // `ver=1` mostra o que a varredura ENXERGA (post, autor, texto, se casou e com qual palavra)
  // sem chamar processCommentChange, ou seja, sem mandar DM nenhum. Diagnóstico que age é
  // diagnóstico em que ninguém confia — por isso ver e agir são caminhos separados.
  const soOlhar = url.searchParams.get("ver") === "1";
  const pedido = Number(url.searchParams.get("horas"));
  const janela = Number.isFinite(pedido) && pedido > 0 ? Math.min(pedido, 48) : JANELA_HORAS;
  const corte = Date.now() - janela * 3600 * 1000;
  const origin = url.origin;
  let acoes = 0;
  const relatorio = [];

  for (const c of contas) {
    const email = s(c && c.client_email, 160);
    const igId = s(c && c.ig_id, 60);
    if (!email || !igId) continue;
    const linha = { conta: igId, tenant: email, posts: 0, comentarios: 0, processados: 0 };

    // O token é do SERVIDOR e nunca sai daqui.
    // ⚠️ POR CONTA, NÃO POR CLIENTE (2026-08-28). Era meta_token_for_email, que devolve o token da
    // conta PRIMÁRIA do tenant. Com um cliente de duas contas (o MedMundo tem @medmundo.br e
    // @drmedmundo; a Guileo tem @guileoai e @guileo.ad) isso varreria a segunda conta com o token
    // da primeira — e a Meta responderia um 400 de permissão. O operador leria "sem acesso" e iria
    // mexer em escopo, quando o problema era CONTA ERRADA. Erro que aponta pro lugar errado custa
    // mais caro que erro nenhum. meta_token_for_ig resolve pelo ig_id que estamos varrendo.
    const tkn = await svcJson(env, "meta_token_for_ig", { p_secret: ING, p_ig_id: igId });
    if (typeof tkn !== "string" || !tkn) {
      linha.erro = (tkn && typeof tkn === "object" && tkn.erro_http)
        ? `não consegui LER o token (RPC ${tkn.erro_http})`   // acesso, não ausência — a diferença importa
        : "sem token guardado";
      relatorio.push(linha); continue;
    }

    // No modo "só olhar" precisamos das campanhas para dizer se casaria — a decisão é pura.
    let campanhas = [];
    if (soOlhar) {
      try { const cs = await svcJson(env, "meta_campanhas_ativas", { p_secret: ING, p_email: email, p_ig_id: igId }); if (Array.isArray(cs)) campanhas = cs; } catch { /* sem campanha = nada casaria */ }
      linha.campanhas = campanhas.length;
    }

    try {
      const mr = await fetch(`${GRAPH}/${encodeURIComponent(igId)}/media?fields=id,timestamp&limit=${POSTS_POR_CONTA}&access_token=${encodeURIComponent(tkn)}`);
      if (!mr.ok) {                                   // portão de status ANTES do fallback:
        const cru = await mr.text().catch(() => "");  // lista vazia por erro viraria "nada a fazer"
        linha.erro = `a Meta recusou listar as publicações (HTTP ${mr.status}) ${cru.slice(0, 120)}`;
        relatorio.push(linha); continue;
      }
      const mj = await mr.json().catch(() => null);
      const posts = (mj && Array.isArray(mj.data)) ? mj.data : [];
      linha.posts = posts.length;

      for (const post of posts) {
        if (acoes >= MAX_ACOES) break;
        const cr = await fetch(`${GRAPH}/${encodeURIComponent(post.id)}/comments?fields=id,text,timestamp,from{id,username}&limit=25&access_token=${encodeURIComponent(tkn)}`);
        if (!cr.ok) continue;                          // um post ilegível não aborta a conta
        const cj = await cr.json().catch(() => null);
        const comentarios = (cj && Array.isArray(cj.data)) ? cj.data : [];
        for (const com of comentarios) {
          if (acoes >= MAX_ACOES) break;
          const quando = Date.parse(com.timestamp || "");
          if (!Number.isFinite(quando) || quando < corte) continue;   // fora da janela: tarde demais
          linha.comentarios += 1;
          if (soOlhar) {
            // Roda a MESMA decisão do webhook (função pura, sem rede) só para mostrar o veredito.
            const alvo = escolherCampanha(campanhas, { texto: String(com.text || ""), mediaId: String(post.id), originalMediaId: "" });
            const autor = String((com.from && com.from.username) || (com.from && com.from.id) || "?");
            (linha.vistos = linha.vistos || []).push({
              autor,
              texto: String(com.text || "").slice(0, 80),
              casou: alvo ? alvo.palavra : null,
              motivo: alvo ? "casaria" : (String((com.from && com.from.id) || "") === String(igId)
                ? "comentário da PRÓPRIA conta — ignorado de propósito"
                : "nenhuma palavra-chave casou"),
            });
            continue;
          }
          // A MESMA forma que a Meta manda no webhook — e a MESMA função que o webhook chama.
          // A reserva atômica lá dentro descarta o que já foi tratado ('duplicado'), então rodar
          // isto sobre um comentário já respondido é inofensivo por construção.
          await processCommentChange(env, origin, igId, {
            id: String(com.id), text: String(com.text || ""),
            from: { id: String((com.from && com.from.id) || ""), username: String((com.from && com.from.username) || "") },
            media: { id: String(post.id) },
          });
          linha.processados += 1; acoes += 1;
        }
      }
    } catch (e) { linha.erro = s(e, 160); }
    relatorio.push(linha);
  }

  return json({
    ok: true, contas: contas.length, acoes, teto: MAX_ACOES,
    janela_horas: janela, posts_por_conta: POSTS_POR_CONTA,
    // ⚠️ o teto batido entra na resposta: varredura que corta em silêncio se parece com varredura
    // que não achou nada, e as duas pedem ações opostas.
    ...(acoes >= MAX_ACOES ? { aviso: `teto de ${MAX_ACOES} ações atingido — pode ter ficado comentário para trás; rode de novo` } : {}),
    detalhe: relatorio,
  });
}

export const onRequestGet = (c) => varrer(c.request, c.env);
export const onRequestPost = (c) => varrer(c.request, c.env);
