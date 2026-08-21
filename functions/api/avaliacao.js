// Cloudflare Pages Function — O MOTOR DE AVALIAÇÃO DE NEGÓCIO (2026-08-18)
//
// Estende o /api/diagnostico: mesma família, régua nova. O diagnóstico é a análise-ferida da
// demo; a AVALIAÇÃO é o documento de venda completo — score por aspecto, previsões com premissa,
// estratégia produto-a-produto. Todo prospect recebe na página de apresentação/quote; todo
// cliente recebe de novo em modo fundo (dados internos). Histórico gravado = evolução do score.
//
// ── AS DUAS PORTAS (mesmo desenho do /api/diagnostico) ──────────────────────────────────────
//   POST {site, cliente_email?, ...} + sid/token → FECHADA. Avalia, GRAVA, devolve o JSON + link.
//   GET  ?id=<uuid>                              → ABERTA (rate-limited). Devolve o JSON gravado.
//                                                  O uuid v4 é o segredo do link.
//
// MODO CLIENTE: `cliente_email` presente → busca o snapshot interno (catálogo com preço real,
// ligações, agenda, pacotes) pela RPC avaliacao_client_snapshot. Sem o e-mail, é modo prospect
// (só o público). O snapshot vem gated pelo INGEST — nada disso vaza pra fora do POST fechado.
//
// ⚠️ ZERO MODELO: heurística determinística (lib/avaliacao.js). Funciona com a Anthropic zerada.
import { json, rateLimited, safeEq } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { avaliarNegocio, normLang } from "../lib/avaliacao.js";
import { verifySession } from "../lib/sellerSession.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // ── PORTA ABERTA: ler uma avaliação gravada ────────────────────────────────────────────────
  const id = url.searchParams.get("id");
  if (id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "link inválido" }, 400);
    // uuid é o segredo, mas link vaza — 30/min por IP corta enumeração e scraping em massa.
    if (await rateLimited(request, env, "avaliacao-get", 30)) return json({ error: "rate" }, 429);
    const d = await svcJson(env, "avaliacao_get", { p_id: id, p_marcar: true });
    if (!d || !d.payload) return json({ error: "avaliação não encontrada" }, 404);
    return json({ ok: true, id, avaliado_em: d.created_at, avaliacao: d.payload });
  }

  // ── PORTA FECHADA: gerar ───────────────────────────────────────────────────────────────────
  if (request.method !== "POST") return json({ error: "method" }, 405);
  const b = await request.json().catch(() => ({}));

  // Aceita: crachá do vendedor (sid) · senha do /admin · DIGEST_TOKEN (body ou header interno).
  // ⚠️ LÊ A RESPOSTA da RPC, não o status HTTP — a lição do /api/encaminhar (2026-08-15).
  const tok = (b.token || request.headers.get("x-guileo-secret") || "").toString();
  let ok = !!(await verifySession(env, (b.sid || "").toString()));
  // PORTA DE SERVIÇO (mesma dos irmãos sync-agent/agent-eval): o INGEST também entra — quem o tem
  // já grava a avaliação na RPC de qualquer forma; recusar aqui só quebrava a operação interna.
  if (!ok) ok = !!env.INGEST_SECRET && safeEq((b.token || request.headers.get("x-guileo-secret") || "").toString(), env.INGEST_SECRET);
  if (!ok && tok) {
    if (env.DIGEST_TOKEN && safeEq(tok, env.DIGEST_TOKEN)) ok = true;
    else {
      const a = await svcJson(env, "_admin_ok", { p_token: tok }).catch(() => null);
      ok = a === true || a?.ok === true;
    }
  }
  if (!ok) return json({ error: "unauthorized", dica: "crachá de vendedor (sid), senha do /admin ou DIGEST_TOKEN" }, 401);

  const site = (b.site || "").toString().trim().slice(0, 300);
  if (!site) return json({ error: "informe o site" }, 400);
  // aceita `cliente_email` (nome de casa) e `client_email` (nome usado pelos scripts/ferramentas)
  const clienteEmail = (b.cliente_email || b.client_email || "").toString().trim().toLowerCase().slice(0, 160);

  // MODO CLIENTE: snapshot interno. Falha do snapshot NÃO derruba a avaliação — degrada para
  // prospect e DIZ que degradou (interno_motivo), nunca silêncio (lição fallback-esconde-erro).
  let interno = null, internoMotivo = null;
  if (clienteEmail) {
    const s = await svcJson(env, "avaliacao_client_snapshot", { p_secret: env.INGEST_SECRET || "", p_email: clienteEmail });
    if (s && s.ok) interno = s;
    else internoMotivo = s?.detalhe || (s?.erro_http ? `HTTP ${s.erro_http}` : null) || "snapshot interno indisponível — avaliado só com dados públicos";
  }

  // IDIOMA DA PROSA (2026-08-18): body OU query, pt|en|es, padrão pt. Sem isto o relatório de um
  // cliente que fala inglês saía com o conteúdo em português (defeito visto no Growth Report da
  // Natura Spa). O idioma escolhido fica GRAVADO no payload — a página só renderiza.
  const lang = normLang(b.lang || b.idioma || url.searchParams.get("lang") || "pt");

  const av = await avaliarNegocio({ site, env, negocio: (b.negocio || b.brand || b.business || "").toString().slice(0, 120), interno, lang });
  if (!av.ok) return json({ ok: false, erro: "nao_deu_pra_ler", motivo: av.motivo }, 409);
  if (internoMotivo) av.nota_fonte = [av.nota_fonte, `modo cliente degradado: ${internoMotivo}`].filter(Boolean).join(" · ");

  const salvo = await svcJson(env, "avaliacao_save", {
    p_secret: env.INGEST_SECRET || "",
    p_site: site, p_business: av.business || "", p_client_email: clienteEmail || null,
    p_modo: av.modo, p_score: av.score_geral, p_payload: av,
    p_seller: (b.seller || "").toString().slice(0, 160), p_contato: (b.contato || "").toString().slice(0, 160),
  });
  // "ok" sem id é promessa sem lastro (regra da casa) — sem id gravado, reporta que não gravou.
  if (!salvo?.id) return json({ ok: false, erro: "nao_gravou", avaliacao: av }, 500);

  return json({ ok: true, id: salvo.id, link: `${url.origin}/api/avaliacao?id=${salvo.id}`, avaliacao: av });
}
