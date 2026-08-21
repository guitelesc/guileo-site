// Cloudflare Pages Function — POST /api/seller-relacionamento
// O ELO COM O CLIENTE, DO LADO DO VENDEDOR (2026-08-20).
//
// O backend disto existia há semanas e não tinha porta nenhuma: o cliente já podia avaliar o
// consultor (`consultor_nota_dar`, em /api/support) e o banco já sabia resumir (`consultor_nota_resumo`)
// e listar a carteira (`seller_wallet`). O vendedor não via nada. Nota que ninguém lê não corrige
// comportamento nenhum — é medição jogada fora.
//
// 🚨 A NOTA SEM O NOME (decisão do Luis). O vendedor vê média, quantidade e tendência — NUNCA quem
// deu. O anonimato é reforçado no próprio banco: o resumo se recusa a mostrar comentário com menos
// de 3 votos, porque em carteira pequena um comentário sozinho identifica quem falou. Anonimato que
// vaza é pior que nota aberta: quebra a confiança do cliente E a do vendedor de uma vez.
//
// AUTH: o MESMO portão de /api/seller-prospects. O e-mail AUTENTICADO é o único escopo — o corpo
// nunca escolhe de quem são os dados, senão qualquer vendedor lia a nota do outro.
import { json, sameOrigin, rateLimited, safeEq } from "../lib/guard.js";
// 🚨 LEITURA PELA CHAVE DE SERVIÇO, NÃO PELO `anon`. `consultor_nota_resumo` está fechada ao
// anon de propósito (o repo está fechando essas portas, não abrindo). Abrir mais uma para fazer
// esta tela funcionar seria pagar a conta errada: a função já é SECURITY DEFINER e já exige o
// segredo — o caminho certo é o Worker falar como serviço, que é o que ele é.
import { svcRpc } from "../lib/sb.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

const BOOTSTRAP = [
  { email: "luistelesc@gmail.com", code: "GUILEO-DONO", name: "Luis Teles", ref: "luis" },
  { email: "smart@guileoai.com", code: "GUILEO-DONO", name: "Guileo", ref: "guileo" },
];
function roster(env) {
  try { if (env && env.SELLER_ROSTER) { const a = JSON.parse(env.SELLER_ROSTER); if (Array.isArray(a) && a.length) return a; } } catch { /* */ }
  return BOOTSTRAP;
}
function sellerAuth(env, email, code) {
  const e = (email || "").toString().trim().toLowerCase(), c = (code || "").toString().trim();
  if (!e || !c) return null;
  const m = roster(env).find((s) => (s.email || "").trim().toLowerCase() === e && safeEq(String(s.code || ""), c));
  return m ? { email: e, name: m.name || e.split("@")[0], roster: true } : null;
}
async function sellerAuthDB(env, email, code) {
  const e = (email || "").toString().trim().toLowerCase(), c = (code || "").toString().trim();
  if (!e || !c || !env?.INGEST_SECRET) return null;
  try {
    const r = await rpc("seller_auth_check", { p_secret: env.INGEST_SECRET, p_email: e, p_code: c });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    return (d && d.ok) ? { email: e, name: d.name || e.split("@")[0], roster: true } : null;
  } catch { return null; }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "seller-relacionamento", 60)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const ING = env.INGEST_SECRET || "";

    const seller = (await sellerAuthDB(env, b.seller_email || b.seller?.email, b.seller_code || b.token))
      || sellerAuth(env, b.seller_email || b.seller?.email, b.seller_code || b.token);
    if (!seller) return json({ error: "unauthorized" }, 401);
    // nota e carteira são PRIVADAS do vendedor: código de time (que aceita qualquer e-mail digitado)
    // não pode abrir a nota de outra pessoa.
    if (!seller.roster) return json({ error: "team_code" }, 401);

    const acao = (b.acao || "").toString();

    // ── CHAT: o vendedor lê a própria caixa e responde ────────────────────────────────────────
    // O e-mail do vendedor é o AUTENTICADO, nunca o do corpo — senão um vendedor lia a conversa
    // do outro. O do cliente vem do corpo porque é ele que escolhe QUAL conversa abrir, e o banco
    // recusa cliente que não está na caixa dele (`chat_vendedor_enviar` verifica antes de gravar).
    if (acao === "chat_ler") {
      const r = await svcRpc(env, "chat_ler", { p_secret: ING, p_client_email: "", p_seller_email: seller.email });
      if (!r.ok) return json({ ok: false, motivo: `não consegui ler as conversas (HTTP ${r.status})` }, 502);
      const d = await r.json().catch(() => null);
      if (!d?.ok) return json({ ok: false, motivo: d?.motivo || "resposta inesperada" }, 502);
      return json({ ok: true, mensagens: d.mensagens || [] });
    }

    if (acao === "chat_enviar") {
      const cliente = (b.cliente || "").toString().trim().toLowerCase();
      const texto = (b.texto || "").toString().trim();
      if (!cliente || !texto) return json({ ok: false, motivo: "faltou cliente ou texto" }, 400);
      const r = await svcRpc(env, "chat_vendedor_enviar", {
        p_secret: ING, p_seller_email: seller.email, p_client_email: cliente, p_texto: texto.slice(0, 2000),
      });
      if (!r.ok) return json({ ok: false, motivo: `não consegui enviar (HTTP ${r.status})` }, 502);
      const d = await r.json().catch(() => null);
      // 🚨 comprovante: só declaro enviado com o id da linha gravada.
      if (!d?.ok || !d.id) return json({ ok: false, motivo: d?.motivo || "não gravou a mensagem" }, 502);
      return json({ ok: true, id: d.id });
    }

    const dias = Math.min(Math.max(parseInt(b.dias, 10) || 90, 7), 365);

    // Duas leituras independentes, em paralelo. Uma falhar NÃO some com a outra: cada bloco
    // declara o próprio estado, porque "não consegui ler a nota" e "você não tem nota" são
    // coisas diferentes e o `|| {}` que as junta já produziu diagnóstico falso neste repo.
    const [rn, rc] = await Promise.all([
      svcRpc(env, "consultor_nota_resumo", { p_secret: ING, p_seller_email: seller.email, p_dias: dias }).catch(() => null),
      svcRpc(env, "seller_wallet", { p_secret: ING, p_seller_email: seller.email }).catch(() => null),
    ]);

    const nota = rn && rn.ok ? await rn.json().catch(() => null) : null;
    const carteira = rc && rc.ok ? await rc.json().catch(() => null) : null;

    return json({
      ok: true,
      dias,
      nota: nota ?? null,
      nota_erro: rn && rn.ok ? null : `não consegui ler a sua nota${rn ? ` (HTTP ${rn.status})` : ""}`,
      carteira: Array.isArray(carteira) ? carteira : (carteira ?? null),
      carteira_erro: rc && rc.ok ? null : `não consegui ler a sua carteira${rc ? ` (HTTP ${rc.status})` : ""}`,
    });
  } catch (e) { return json({ ok: false, motivo: String(e).slice(0, 160) }, 400); }
}
