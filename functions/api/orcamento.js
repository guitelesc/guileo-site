// Cloudflare Pages Function — /api/orcamento · MOTOR DE ORÇAMENTO (o módulo de $1.800/mês)
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// O QUE ISTO FAZ: a Gui coleta os dados do serviço na ligação/chat e chama `criar`. O BANCO decide
// o destino (db/quote_engine.sql): abaixo do teto do tenant sai sozinho; acima dele — ou com
// `auto_enviar=false` — entra na FILA e só sai depois que o escritório aprova com 1 clique.
// Este arquivo NÃO reimplementa essa regra: ele lê o `status` que a RPC devolveu e obedece. Ter
// duas cabeças decidindo o mesmo (uma no banco, outra aqui) é como um orçamento sai duas vezes.
//
// ⚠️ NÃO confundir com /api/photo-quote (db/capture_tools.sql): lá o CLIENTE manda foto e o dono
// precifica na mão. Aqui a IA monta o orçamento e o sistema decide se manda ou se pede aprovação.
//
// AÇÕES (POST, campo `action`):
//   criar     — servidor-a-servidor (header `x-guileo-secret` = INGEST_SECRET) OU sessão do tenant.
//               Cria, e se voltar `aprovado` + auto-envio ligado, ENVIA e marca enviado.
//   fila      — a fila de aprovação do tenant (sessão do tenant)
//   lista     — últimos orçamentos do tenant (sessão do tenant)
//   decidir   — aprovar/recusar; aprovar ENVIA e marca enviado (sessão do tenant)
//   config    — lê/grava teto + chave de auto-envio (sessão do tenant)
//   ver       — público por token (sameOrigin + rate-limit) → quote_por_token
//   responder — público por token (sameOrigin + rate-limit) → quote_resposta_cliente
//
// GET ?t=<token>[&r=aceitar|recusar] — a PÁGINA que o cliente final abre pelo link do e-mail.
// Serve HTML direto daqui (mesmo padrão de /api/nps): sem isso o botão do e-mail apontaria para
// uma rota de SPA que não existe — link quebrado é pior que orçamento não enviado.
//
// ── CANAL: SÓ E-MAIL, E ISSO É VERDADE, NÃO LIMITAÇÃO ESCONDIDA ──────────────────────────────────
// SMS US está BLOQUEADO (campanha A2P 10DLC reprovada, erro 30034) e o WhatsApp de saída depende do
// app publicado na Meta. Então o envio é e-mail e ponto. Quando um deles acender, é UMA LINHA em
// CANAIS_DE_ENVIO abaixo (o resto do fluxo — decidir → enviar → marcar — não muda). Nunca escrever
// código que finge mandar SMS: o comprovante que não sai é o defeito mais caro desta base.
// ─────────────────────────────────────────────────────────────────────────────────────────────────
import { json, sameOrigin, rateLimited, safeEq } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";
import { brandFor } from "../lib/clientBrand.js";
import { quoteToCustomerEmail } from "../lib/emailTemplates.js";

const s = (v, n = 200) => (v == null ? "" : v.toString().slice(0, n));
const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s(v));
const isToken = (v) => /^[0-9a-f]{16,80}$/i.test(s(v, 90));
const ehEmail = (v) => /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(s(v).trim());
const langNorm = (v) => (["pt", "es"].includes(s(v, 5).slice(0, 2).toLowerCase()) ? s(v, 5).slice(0, 2).toLowerCase() : "en");

// A RESPOSTA DA RPC, NÃO O 200 DO HTTP. `svcRpc` devolve a Response; quem olha só `r.ok` está lendo
// "o Postgres respondeu", não "o orçamento existe". Aqui a distinção vale dinheiro: um orçamento
// dado como enviado sem linha no banco é um cliente esperando um e-mail que nunca saiu.
async function rpc(env, fn, body) {
  try {
    const r = await svcRpc(env, fn, body);
    const txt = await r.text();
    if (!r.ok) return { ok: false, status: r.status, detalhe: txt.slice(0, 200) };
    if (!txt) return { ok: false, status: r.status, detalhe: "resposta vazia" };
    try { return { ok: true, dados: JSON.parse(txt) }; } catch { return { ok: false, detalhe: `nao-JSON: ${txt.slice(0, 120)}` }; }
  } catch (e) { return { ok: false, detalhe: String(e).slice(0, 160) }; }
}
// `quote_create`/`quote_decidir` devolvem UMA linha; `quote_fila`/`quote_list` devolvem um array.
const primeira = (d) => (Array.isArray(d) ? d[0] || null : d && typeof d === "object" ? d : null);
// A RPC não existe = SQL não colado. Estado HONESTO ("cole o SQL"), nunca lista vazia fingindo calma.
const semSql = (r) => !r.ok && (r.status === 404 || /PGRST202|does not exist|schema cache/i.test(s(r.detalhe, 200)));
const NOTA_SQL = "Cole db/quote_engine.sql no Supabase para ligar o Motor de Orçamento.";

// O que o cliente final NÃO precisa ver. `quote_por_token` já devolve o tenant (o e-mail do negócio)
// porque quem chama do servidor precisa da marca — mas nada disso pode atravessar para o navegador.
const publico = (q) => (!q ? null : {
  customer_name: q.customer_name || "", resumo: q.resumo || "",
  itens: Array.isArray(q.itens) ? q.itens : [], total_cents: Number(q.total_cents) || 0,
  moeda: q.moeda || "usd", status: q.status || "",
});

// ── CANAIS DE ENVIO ──────────────────────────────────────────────────────────────────────────────
// Hoje UM. Ligar sms/whatsapp = acrescentar um objeto aqui com seu próprio `disponivel()` — é a
// "uma linha" prometida no cabeçalho. Nada mais no arquivo muda.
const CANAIS_DE_ENVIO = [
  {
    canal: "email",
    disponivel: (env, q) => {
      if (!ehEmail(q.customer_email)) return { ok: false, motivo: "o cliente não deixou e-mail" };
      if (!env || !env.RESEND_API_KEY) return { ok: false, motivo: "RESEND_API_KEY não configurada" };
      return { ok: true };
    },
    enviar: enviarPorEmail,
  },
];

function linkDoCliente(request, token) {
  let origem = "https://guileoai.com";
  try { origem = new URL(request.url).origin; } catch { /* mantém o padrão */ }
  return `${origem}/api/orcamento?t=${encodeURIComponent(token)}`;
}

// E-MAIL SEMPRE via emailTemplates.js — lei do repositório. Zero HTML aqui.
async function enviarPorEmail(env, request, q) {
  const brand = await brandFor(env, q.client_email).catch(() => null);
  const lang = langNorm((brand && brand.lang) || "en");
  const { subject, html } = quoteToCustomerEmail({
    brand, business: (brand && brand.business) || "", customerName: q.customer_name || "",
    resumo: q.resumo || "", itens: Array.isArray(q.itens) ? q.itens : [],
    totalCents: Number(q.total_cents) || 0, moeda: q.moeda || "usd",
    link: q.token ? linkDoCliente(request, q.token) : "", lang,
  });
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: q.customer_email, subject, html }),
  });
  // 200 do Resend = "recebi o pedido de envio". Não é "chegou" — e 4xx (domínio não verificado,
  // endereço ruim, rate limit) tem que virar falha VISÍVEL, nunca um "enviado" de mentira.
  if (r.ok) return { aceito: true, motivo: "" };
  const corpo = await r.text().catch(() => "");
  return { aceito: false, motivo: `resend ${r.status}${corpo ? ": " + corpo.slice(0, 120) : ""}` };
}

// ENVIA + MARCA. As duas coisas juntas, nesta ordem: marcar antes de enviar criaria "enviado" sem
// e-mail. Devolve o que REALMENTE aconteceu — quem chama nunca precisa adivinhar.
async function enviarOrcamento(env, request, q) {
  const bloqueios = [];
  for (const c of CANAIS_DE_ENVIO) {
    const d = c.disponivel(env, q);
    if (!d.ok) { bloqueios.push({ canal: c.canal, motivo: d.motivo }); continue; }
    const r = await c.enviar(env, request, q);
    if (!r.aceito) { bloqueios.push({ canal: c.canal, motivo: r.motivo }); continue; }
    const marc = await rpc(env, "quote_marcar_enviado", { p_secret: env.INGEST_SECRET || "", p_id: q.id, p_canal: c.canal });
    // O e-mail saiu; se a marcação falhou o dono precisa saber (a fila mostraria o mesmo orçamento
    // de novo e ele mandaria duas vezes). Por isso `marcado` viaja na resposta, separado de `enviado`.
    return { enviado: true, canal: c.canal, marcado: !!marc.ok, quote: primeira(marc.dados) || q, bloqueios };
  }
  return { enviado: false, canal: null, marcado: false, quote: q, bloqueios };
}

// ── PORTÃO DO TENANT (padrão photo-quote): e-mail + chave de conexão do cockpit ───────────────────
async function tenantOk(env, email, key) {
  if (!ehEmail(email) || !key) return false;
  const r = await rpc(env, "get_client_data", { p_email: email, p_key: key });
  const d = r.ok ? r.dados : null;
  return !!(d && typeof d === "object" && Array.isArray(d.events));
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    const action = s(b.action || "fila", 24);
    const ING = env.INGEST_SECRET || "";

    // ── PÚBLICO por token: o cliente final vendo/respondendo o próprio orçamento ──
    if (action === "ver" || action === "responder") {
      if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
      if (await rateLimited(request, env, "orcamento-pub", 20)) return json({ error: "too many requests" }, 429);
      const token = s(b.token, 90);
      if (!isToken(token)) return json({ error: "bad token" }, 400);
      if (action === "responder") {
        const r = await rpc(env, "quote_resposta_cliente", { p_token: token, p_aceitar: b.aceitar === true });
        if (semSql(r)) return json({ ok: false, ready: false, note: NOTA_SQL });
        if (!r.ok) return json({ ok: false, error: "nao consegui registrar sua resposta" }, 502);
        return json({ ok: true, ready: true, status: s(r.dados, 20) }); // "aceito" | "recusado" | "ja_respondido"
      }
      const r = await rpc(env, "quote_por_token", { p_token: token });
      if (semSql(r)) return json({ ok: false, ready: false, note: NOTA_SQL });
      if (!r.ok) return json({ ok: false, error: "orcamento indisponivel" }, 502);
      const q = publico(primeira(r.dados));
      if (!q) return json({ ok: false, found: false }, 404);
      return json({ ok: true, ready: true, quote: q });
    }

    // ── CRIAR: a Gui (servidor-a-servidor) ou o próprio cockpit ──
    if (action === "criar") {
      const header = s(request.headers.get("x-guileo-secret") || "", 120);
      const email = s(b.email).trim().toLowerCase();
      const confiavel = !!(ING && safeEq(header, ING));
      if (!confiavel && !(await tenantOk(env, email, s(b.token || b.key).trim()))) return json({ error: "unauthorized" }, 401);
      if (!ehEmail(email)) return json({ error: "bad tenant" }, 400);
      const cents = Math.round(Number(b.total_cents) || 0);
      if (!(cents > 0)) return json({ error: "total_cents obrigatorio" }, 400);
      const itens = Array.isArray(b.itens) ? b.itens.slice(0, 50) : [];

      const r = await rpc(env, "quote_create", {
        p_secret: ING, p_email: email, p_total_cents: cents,
        p_customer_name: s(b.customer_name, 120), p_customer_phone: s(b.customer_phone, 40),
        p_customer_email: s(b.customer_email, 160), p_resumo: s(b.resumo, 500),
        p_itens: itens, p_origem: s(b.origem, 20) || "ai",
      });
      if (semSql(r)) return json({ ok: false, ready: false, note: NOTA_SQL });
      const q = primeira(r.dados);
      // Sucesso precisa de comprovante: sem `id` de volta, não houve orçamento — e dizer que houve
      // é a promessa sem lastro que já mordeu esta base (agendamento, pay-link, envio).
      if (!r.ok || !q || !q.id) return json({ ok: false, criado: false, error: s(r.detalhe, 160) || "nao criou" }, 502);

      // AQUI ESTÁ A BIFURCAÇÃO INTEIRA. Não recalculamos teto nenhum: o banco já decidiu.
      if (q.status !== "aprovado") {
        return json({ ok: true, ready: true, criado: true, id: q.id, status: q.status, motivo: q.motivo || "",
          enviado: false, aguarda_aprovacao: true,
          message: "Orçamento criado e esperando a aprovação do escritório — nada foi enviado ao cliente." });
      }
      const envio = await enviarOrcamento(env, request, q);
      return json({ ok: true, ready: true, criado: true, id: q.id, status: envio.enviado ? "enviado" : q.status,
        enviado: envio.enviado, canal: envio.canal, marcado: envio.marcado, bloqueios: envio.bloqueios,
        aguarda_aprovacao: false });
    }

    // ── DAQUI PARA BAIXO: só o dono do negócio (sessão do cockpit) ──
    const email = s(b.email).trim().toLowerCase();
    if (!(await tenantOk(env, email, s(b.token || b.key).trim()))) return json({ error: "unauthorized" }, 401);

    if (action === "decidir") {
      const id = s(b.id, 40);
      if (!isUuid(id)) return json({ error: "bad id" }, 400);
      const aprovar = b.aprovar === true;
      const r = await rpc(env, "quote_decidir", {
        p_secret: ING, p_email: email, p_id: id, p_aprovar: aprovar,
        p_quem: s(b.quem, 120) || email, p_motivo: s(b.motivo, 300),
      });
      if (semSql(r)) return json({ ok: false, ready: false, note: NOTA_SQL });
      const q = primeira(r.dados);
      // A RPC levanta erro quando o id não é da fila DESTE tenant — id solto nunca autoriza nada.
      if (!r.ok || !q || !q.id) return json({ ok: false, decidido: false, error: "este orçamento não está na fila do seu negócio" }, 409);
      if (!aprovar) return json({ ok: true, ready: true, decidido: true, status: q.status, enviado: false });
      const envio = await enviarOrcamento(env, request, q);
      return json({ ok: true, ready: true, decidido: true, status: envio.enviado ? "enviado" : q.status,
        enviado: envio.enviado, canal: envio.canal, marcado: envio.marcado, bloqueios: envio.bloqueios });
    }

    if (action === "config") {
      // Sem teto/auto no corpo = LEITURA (a RPC faz upsert com os padrões e devolve a linha).
      const teto = b.teto_cents == null ? null : Math.max(0, Math.round(Number(b.teto_cents) || 0));
      const auto = typeof b.auto === "boolean" ? b.auto : null;
      const r = await rpc(env, "quote_config", { p_secret: ING, p_email: email, p_teto_cents: teto, p_auto: auto });
      if (semSql(r)) return json({ ok: false, ready: false, note: NOTA_SQL });
      const c = primeira(r.dados);
      if (!r.ok || !c) return json({ ok: false, ready: false, note: NOTA_SQL });
      return json({ ok: true, ready: true, config: { teto_cents: Number(c.teto_cents) || 0, auto_enviar: c.auto_enviar !== false } });
    }

    if (action === "lista") {
      const r = await rpc(env, "quote_list", { p_secret: ING, p_email: email, p_limite: Math.min(200, Math.max(1, Math.round(Number(b.limite) || 50))) });
      // Falha de SQL-não-colado e falha de banco são coisas DIFERENTES: dizer "cole o SQL" quando o
      // Postgres caiu manda o dono resolver o problema errado.
      if (!r.ok) return json({ ok: false, ready: false, note: semSql(r) ? NOTA_SQL : `não consegui ler os orçamentos (${s(r.detalhe, 100)})`, quotes: [] });
      return json({ ok: true, ready: true, quotes: Array.isArray(r.dados) ? r.dados : [] });
    }

    // default: "fila"
    const r = await rpc(env, "quote_fila", { p_secret: ING, p_email: email });
    if (!r.ok) return json({ ok: false, ready: false, note: semSql(r) ? NOTA_SQL : `não consegui ler a fila (${s(r.detalhe, 100)})`, fila: [] });
    return json({ ok: true, ready: true, fila: Array.isArray(r.dados) ? r.dados : [] });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}

// ── A PÁGINA DO CLIENTE FINAL (GET ?t=token) ─────────────────────────────────────────────────────
// Mesmo padrão de /api/nps: HTML curto servido pela própria função, porque o link do e-mail tem que
// ABRIR. `&r=aceitar|recusar` é o clique de resposta — 1 toque, sem login, sem formulário.
const htmlResp = (body, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
const escH = (v) => s(v, 400).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// A PÁGINA FALA O IDIOMA DE QUEM ABRE. Sem isto o cliente de um encanador que atende em espanhol
// recebe uma tela em inglês — e o status cru do banco ("aceito") vaza português dentro da frase.
const PG = {
  en: { quote: "Quote", seu: "Your quote", total: "Total", aceitar: "Accept", recusar: "Decline",
        respondido: (st) => `Already answered (${st}).`, rodape: "Prepared by the business's AI assistant and reviewed by a person when the amount calls for it.",
        invalido: "Invalid link", sumiu: "This quote is no longer available.",
        ok_aceito: "Quote accepted — the business has been notified.", ok_recusado: "Quote declined. Thank you for letting us know.",
        ja: "You already responded to this quote.", falhou: "We couldn't record your answer — please reply to the email instead.",
        st: { aceito: "accepted", recusado: "declined", enviado: "sent", aprovado: "approved", aguardando_aprovacao: "under review" } },
  pt: { quote: "Orçamento", seu: "Seu orçamento", total: "Total", aceitar: "Aceitar", recusar: "Recusar",
        respondido: (st) => `Você já respondeu (${st}).`, rodape: "Preparado pelo assistente de IA do negócio e revisado por uma pessoa quando o valor pede.",
        invalido: "Link inválido", sumiu: "Este orçamento não está mais disponível.",
        ok_aceito: "Orçamento aceito — o negócio já foi avisado.", ok_recusado: "Orçamento recusado. Obrigado por avisar.",
        ja: "Você já respondeu a este orçamento.", falhou: "Não consegui registrar sua resposta — responda o e-mail, por favor.",
        st: { aceito: "aceito", recusado: "recusado", enviado: "enviado", aprovado: "aprovado", aguardando_aprovacao: "em análise" } },
  es: { quote: "Presupuesto", seu: "Tu presupuesto", total: "Total", aceitar: "Aceptar", recusar: "Rechazar",
        respondido: (st) => `Ya respondiste (${st}).`, rodape: "Preparado por el asistente de IA del negocio y revisado por una persona cuando el monto lo pide.",
        invalido: "Enlace inválido", sumiu: "Este presupuesto ya no está disponible.",
        ok_aceito: "Presupuesto aceptado — el negocio ya fue avisado.", ok_recusado: "Presupuesto rechazado. Gracias por avisar.",
        ja: "Ya respondiste a este presupuesto.", falhou: "No pude registrar tu respuesta — responde el correo, por favor.",
        st: { aceito: "aceptado", recusado: "rechazado", enviado: "enviado", aprovado: "aprobado", aguardando_aprovacao: "en revisión" } },
};
// O idioma vem do navegador de QUEM ABRE o link — a tabela `quotes` ainda não guarda idioma.
const idiomaDaPagina = (request) => {
  const al = s(request.headers.get("accept-language") || "", 60).toLowerCase();
  return al.startsWith("pt") ? "pt" : al.startsWith("es") ? "es" : "en";
};
const LOCALE = { en: "en-US", pt: "pt-BR", es: "es-US" };
const dinheiro = (cents, moeda, lang = "en") => {
  const v = Math.max(0, Number(cents) || 0) / 100;
  try { return new Intl.NumberFormat(LOCALE[lang] || "en-US", { style: "currency", currency: String(moeda || "usd").toUpperCase().slice(0, 3) }).format(v); }
  catch { return `$${v.toFixed(2)}`; }
};
function pagina(inner, lang = "en") {
  const t = PG[lang] || PG.en;
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Guileo · ${t.quote}</title></head>
<body style="margin:0;background:#0e0d0b;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;color:#ede7dc;">
<div style="max-width:480px;margin:10vh auto 0;padding:32px 26px;background:#161512;border:1px solid #2b2720;border-radius:22px;box-shadow:0 40px 100px -45px rgba(0,0,0,.92);">${inner}</div></body></html>`;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const token = s(url.searchParams.get("t") || "", 90);
  const lang = idiomaDaPagina(request);
  const T = PG[lang] || PG.en;
  if (!isToken(token)) return htmlResp(pagina(`<h1 style="font-size:20px;margin:0;">${T.invalido}</h1>`, lang), 400);

  const resposta = s(url.searchParams.get("r") || "", 10).toLowerCase();
  if (resposta === "aceitar" || resposta === "recusar") {
    const r = await rpc(env, "quote_resposta_cliente", { p_token: token, p_aceitar: resposta === "aceitar" });
    const st = r.ok ? s(r.dados, 20) : "";
    const msg = st === "aceito" ? T.ok_aceito : st === "recusado" ? T.ok_recusado : st === "ja_respondido" ? T.ja : T.falhou;
    return htmlResp(pagina(`<div style="font-size:34px;line-height:1;">${st === "aceito" ? "✅" : st === "recusado" ? "✔️" : "⚠️"}</div>
      <p style="font-size:16px;line-height:1.7;color:#c5beb0;margin:16px 0 0;">${escH(msg)}</p>`, lang), r.ok ? 200 : 502);
  }

  const r = await rpc(env, "quote_por_token", { p_token: token });
  const q = r.ok ? primeira(r.dados) : null;
  if (!q) return htmlResp(pagina(`<h1 style="font-size:20px;margin:0;">${T.sumiu}</h1>`, lang), 404);
  const itens = (Array.isArray(q.itens) ? q.itens : []).slice(0, 30).map((it) => {
    const nome = escH((it && (it.nome || it.name || it.descricao || it.description)) || "—");
    const c = it && (it.valor_cents ?? it.preco_cents ?? it.total_cents ?? it.cents);
    const val = c == null || !Number.isFinite(Number(c)) ? "—" : dinheiro(Number(c), q.moeda, lang);
    return `<tr><td style="padding:9px 0;border-bottom:1px solid #2b2720;font-size:14px;color:#ede7dc;">${nome}</td>
      <td align="right" style="padding:9px 0;border-bottom:1px solid #2b2720;font-size:14px;font-weight:800;">${escH(val)}</td></tr>`;
  }).join("");
  const jaRespondeu = q.status !== "enviado";
  const base = `${url.origin}/api/orcamento?t=${encodeURIComponent(token)}`;
  return htmlResp(pagina(`
    <div style="font-size:10.5px;letter-spacing:3px;text-transform:uppercase;color:#c2a878;font-weight:800;">${T.quote}</div>
    <h1 style="font-size:22px;font-weight:800;margin:8px 0 4px;">${escH(q.customer_name || T.seu)}</h1>
    ${q.resumo ? `<p style="font-size:14px;color:#c5beb0;margin:0 0 14px;line-height:1.6;">${escH(q.resumo)}</p>` : ""}
    <table width="100%" style="border-collapse:collapse;margin-top:8px;">${itens}
      <tr><td style="padding-top:14px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9c9485;font-weight:800;">${T.total}</td>
      <td align="right" style="padding-top:14px;font-size:24px;font-weight:900;color:#d6c29a;">${escH(dinheiro(q.total_cents, q.moeda, lang))}</td></tr></table>
    ${jaRespondeu
      ? `<p style="margin:20px 0 0;font-size:14px;color:#9c9485;">${escH(T.respondido(T.st[q.status] || q.status))}</p>`
      : `<div style="margin-top:22px;display:flex;gap:10px;">
          <a href="${escH(base)}&amp;r=aceitar" style="flex:1;text-align:center;padding:13px 18px;border-radius:999px;background:#3e9468;color:#fff;font-weight:800;text-decoration:none;font-size:14px;">${T.aceitar}</a>
          <a href="${escH(base)}&amp;r=recusar" style="flex:1;text-align:center;padding:13px 18px;border-radius:999px;border:1px solid #2b2720;color:#9c9485;font-weight:700;text-decoration:none;font-size:14px;">${T.recusar}</a>
        </div>`}
    <p style="margin:18px 0 0;font-size:12px;color:#6a655b;line-height:1.6;">${T.rodape}</p>`, lang));
}
