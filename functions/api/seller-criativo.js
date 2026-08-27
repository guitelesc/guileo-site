// Cloudflare Pages Function — POST /api/seller-criativo
//
// O CRIATIVO NA MÃO DO VENDEDOR — a arma de pitch que não depende de o prospect existir.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// Numa reunião, mostrar O ANÚNCIO QUE RODARIA PARA AQUELE NEGÓCIO, escrito na hora, vale mais que
// qualquer slide. O motor já existia (`lib/criativoAds.js`), mas as duas portas que o alcançavam
// eram do CLIENTE (chave do cockpit) e do ADMIN. O vendedor ficava de fora justamente na hora em
// que a peça vende.
//
//   POST { sid, negocio, setor?, canais?, objetivo?, lang? } -> { ok, kit..., demonstracao:true, cota }
//
// ── POR QUE ROTA PRÓPRIA, E NÃO UM `action` EM /api/criativo ─────────────────────────────────
// /api/criativo tem uma porta de vendedor, mas ela NÃO repassa o contexto digitado ao motor: chama
// `gerarKitCampanha(env, email, {...})` sem `contexto`, então um prospect que ainda não é cliente
// sai como negócio vazio. Além disso o teto de lá é por IP (12/h), e o que precisa de teto aqui é
// o VENDEDOR (o custo do modelo é da Guileo, e mil vendedores × cliques repetidos é uma conta, não
// um pitch). Rota própria = contexto que chega ao motor + teto por pessoa, sem tocar no caminho do
// cliente pagante.
//
// ── HONESTIDADE ──────────────────────────────────────────────────────────────────────────────
// TUDO que sai daqui é `demonstracao: true`. Uma peça escrita a partir de uma descrição solta não
// tem os preços e serviços reais do negócio por trás — é amostra, não o kit dele. A tela imprime
// esse selo; deixar as duas indistinguíveis criaria o pior mal-entendido possível numa venda.
//
// ── ACESSO ───────────────────────────────────────────────────────────────────────────────────
// Crachá assinado do vendedor (`sid`, HMAC de sellerSession.js — o mesmo que /api/pitch-ai exige).
// `sameOrigin` + limite por IP não são autenticação: sem o crachá, qualquer visitante da
// guileoai.com abriria o console e gastaria modelo pago pela Guileo.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { verifySession } from "../lib/sellerSession.js";
import { gerarKitCampanha, normalizarCanal } from "../lib/criativoAds.js";

// Teto DIÁRIO por vendedor. 5 é o número de uma agenda de reuniões, não de um brinquedo: quem
// precisa da sexta peça no mesmo dia está testando o gerador, não vendendo.
const COTA_DIA = 5;

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ ok: false, error: "forbidden" }, 403);
    // Teto por IP TAMBÉM: a cota por vendedor mora no banco, e se a RPC ainda não estiver colada
    // este é o único freio de pé que sobra.
    if (await rateLimited(request, env, "seller-criativo", 20)) return json({ ok: false, error: "muitas tentativas" }, 429);

    const b = await request.json().catch(() => ({}));
    const vend = await verifySession(env, (b.sid || "").toString());
    if (!vend) return json({ ok: false, error: "unauthorized" }, 401);

    const negocio = (b.negocio || b.business || "").toString().trim().slice(0, 160);
    const setor = (b.setor || b.industry || "").toString().trim().slice(0, 80);
    if (!negocio) return json({ ok: false, error: "nome do negócio é obrigatório" }, 400);

    // ── A COTA, ANTES DE GASTAR MODELO ────────────────────────────────────────────────────────
    // Reivindicar DEPOIS de gerar seria contar o que já foi pago. A RPC é atômica (um insert com
    // on conflict), então dois cliques simultâneos nunca contam como um.
    // FAIL-OPEN CONSCIENTE: se a RPC não estiver colada, o `erro_http` chega aqui e a geração
    // SEGUE — com `cota.pronta:false` na resposta, para ninguém achar que há teto onde não há.
    // Um vendedor sem peça na frente do cliente custa mais que cinco chamadas de modelo.
    let cota = { pronta: false, usadas: null, teto: COTA_DIA, motivo: "" };
    const cr = await svcJson(env, "seller_criativo_claim", {
      p_secret: env.INGEST_SECRET || "", p_email: vend, p_teto: COTA_DIA,
    });
    if (cr && cr.ok === true) {
      cota = { pronta: true, usadas: Number(cr.usadas) || 0, teto: Number(cr.teto) || COTA_DIA, motivo: "" };
      if (cr.pode !== true) {
        return json({ ok: false, error: "cota", cota, mensagem: `Você já gerou ${cota.usadas} peças hoje (teto ${cota.teto}). O contador zera à meia-noite UTC.` }, 429);
      }
    } else {
      cota.motivo = cr?.erro || cr?.detalhe || (cr?.erro_http ? `RPC indisponível (${cr.erro_http})` : "motivo desconhecido");
    }

    const pedidos = Array.isArray(b.canais) && b.canais.length ? b.canais : ["google", "meta"];
    const canais = [...new Set(pedidos.map(normalizarCanal))].slice(0, 4);

    // O CONTEXTO DIGITADO CHEGA AO MOTOR. Sem `contexto`, `contextoDoNegocio` iria ao banco buscar
    // um e-mail que não existe e a peça sairia sobre "this business".
    const kit = await gerarKitCampanha(env, "", {
      canais, lang: b.lang, objetivo: (b.objetivo || "").toString().slice(0, 300),
      contexto: { business: negocio, industry: setor, lang: (b.lang || "pt").toString(), notas: (b.notas || "").toString().slice(0, 1200) },
    });
    if (!kit) return json({ ok: false, error: "IA não configurada (ANTHROPIC_API_KEY)" }, 501);

    // TODOS os canais falharam = falha de verdade, e ela tem que PARECER falha. 200 com peças
    // vazias é o desfecho que faz o vendedor abrir a tela na frente do cliente e não ter nada.
    const vivas = kit.pecas.filter((p) => !p.erro);
    if (!vivas.length) {
      return json({ ok: false, error: `a IA não escreveu nenhuma peça — ${kit.pecas.map((p) => `${p.canal}: ${p.erro}`).join(" · ")}`, cota }, 502);
    }

    return json({ ok: true, ...kit, demonstracao: true, porta: "vendedor", cota });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 200) }, 500);
  }
}
