// Cloudflare Pages Function — POST /api/lead-vitrine
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// O PEDIDO FEITO NO SITE RECONSTRUÍDO DE UM PROSPECT (/novo/:slug).
//
// POR QUE EXISTE (24/08, e a origem é constrangedora): os cinco sites que eu construí hoje
// postavam em /api/marketplace-leads, que exige um TENANT com chave — e prospect não é cliente,
// então respondia 401. Pior: o `catch` do formulário engolia a falha e a tela dizia
// "Request received". Eu tinha acabado de provar que o formulário do SR General não entrega a
// ninguém, e o meu fazia a mesma coisa: mostrava sucesso sobre o vazio.
//
// Onde o pedido vai parar: um evento no tenant da CASA. O negócio ainda não é cliente, e inventar
// um tenant pra ele seria sujar a base — então o lead chega pra NÓS, e a gente entrega na mão
// dele. Isso não é contorno: um pedido real capturado pelo site novo é o melhor argumento de venda
// que existe ("seu site novo já pegou um serviço").
//
// Portão: sameOrigin + limite por IP. É formulário público — não pode ter segredo no navegador.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";

const s = (v, n = 400) => (v == null ? "" : v.toString().slice(0, n).trim());

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ ok: false, error: "forbidden" }, 403);
  if (await rateLimited(request, env, "lead-vitrine", 12)) return json({ ok: false, error: "too many requests" }, 429);

  const b = await request.json().catch(() => ({}));
  const negocio = s(b.negocio, 120);
  const slug = s(b.slug, 60);
  const nome = s(b.nome, 120);
  const tel = s(b.telefone, 40);
  const msg = s(b.mensagem, 800);
  if (!negocio || !nome || !tel) return json({ ok: false, error: "faltam nome e telefone" }, 400);

  const r = await svcRpc(env, "ingest_client_event", {
    p_secret: env.INGEST_SECRET || "",
    p_email: "smart@guileoai.com",           // o tenant da CASA — o prospect ainda não é cliente
    p_type: "lead_vitrine",
    p_channel: "site",
    p_summary: `${negocio}: ${nome} · ${tel}`,
    p_amount: 0,
    p_payload: { negocio, slug, nome, telefone: tel, mensagem: msg },
  });
  // ⚠️ A RESPOSTA DECIDE, NÃO O STATUS. E se falhou, o formulário PRECISA saber: dizer "recebido"
  // sobre uma gravação que não aconteceu é o defeito que este arquivo existe para não repetir.
  if (!r || !r.ok) {
    let corpo = ""; try { corpo = (await r.text()).slice(0, 160); } catch { /* */ }
    return json({ ok: false, error: `nao gravou${corpo ? `: ${corpo}` : ""}` }, 503);
  }
  /* ── O MOTOR DE ATIVAÇÃO DE LEADS (Luis, 25/08) ────────────────────────────────────────────
     «os formulários sempre ativos pra IA ligar de volta — essa é uma das partes mais
     importantes». Capturar e parar é formulário morto com etiqueta viva. Se o site-demo do
     prospect tem a ligação de volta LIGADA (client_sites.config.ligar_de_volta = true), o
     mesmo envio dispara a IA DAQUELE negócio ligando pro telefone digitado — o visitante
     preenche, o telefone toca, e é o salão dele falando. É a demo que fecha sozinha.

     Salvaguardas, porque ligação de saída custa dinheiro e toca no mundo real:
     • OPT-IN por slug (config no banco; padrão desligado) — o Luis liga por demo, não por padrão.
     • O tenant vem do SERVIDOR (client_site_owner), nunca do corpo — mesmo desenho do voice-web.
     • O /api/call é o portão blindado de discagem (DNC + caps + rate) — nada é rediscado aqui.
     • Falha na discagem NÃO desfaz a captura: o lead já está gravado; a resposta diz as duas
       verdades separadas (recebido ✓, ligação ✗ e por quê). */
  /* 🚨 "desligada" NÃO PODE SIGNIFICAR DUAS COISAS (achado 27/08). Este era o valor inicial, então
     a resposta dizia "desligada" tanto quando o dono escolheu não ligar quanto quando eu não
     consegui LER a configuração — e eu perdi tempo caçando o motivo errado. O caso real: o slug
     existia com `ligar_de_volta:true` mas `published=false`, e a RPC devolvia {found:false}.
     Agora cada estado tem nome próprio; "não sei" jamais se disfarça de "não". */
  let ligacao = "desligada";
  try {
    const cfgR = await svcRpc(env, "client_site_public", { p_slug: slug });
    const cfg = cfgR && cfgR.ok ? await cfgR.json().catch(() => null) : null;
    if (!cfg) ligacao = "nao consegui ler a config do site";
    else if (cfg.found !== true) ligacao = "slug nao encontrado ou nao publicado";
    else if (cfg.config && cfg.config.ligar_de_volta === true) {
      const donoR = await svcRpc(env, "client_site_owner", { p_secret: env.INGEST_SECRET || "", p_slug: slug });
      const dono = donoR && donoR.ok ? ((await donoR.json()) || "").toString().trim().toLowerCase() : "";
      if (dono && env.DIGEST_TOKEN) {
        const cr = await fetch(new URL("/api/call", request.url).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: new URL(request.url).origin,
            "x-guileo-internal": env.DIGEST_TOKEN },
          body: JSON.stringify({ phone: tel, name: nome, business: negocio,
            client_email: dono, need: msg || "asked for a time on the new site", lang: "en" }),
        });
        const cd = await cr.json().catch(() => null);
        ligacao = cd && (cd.ok || cd.queued || cd.sid) ? "disparada"
          : `falhou: ${(cd && (cd.error || cd.motivo)) || `HTTP ${cr.status}`}`.slice(0, 120);
      } else ligacao = dono ? "sem token interno" : "slug sem dono";
    }
  } catch (e) { ligacao = `falhou: ${String(e).slice(0, 80)}`; }

  return json({ ok: true, recebido: true, ligacao });
}
