// Cloudflare Pages Function — A ANÁLISE QUE O PROSPECT GANHA AO MARCAR A DEMO (2026-08-15)
//
// O PEDIDO: «ele já ganha isso só de marcar a demo — e daí analisamos tudo dele.» Duas pontas da
// MESMA análise: o prospect recebe (valor antes da call, e prova de que a gente já trabalhou por
// ele) e o vendedor lê (entra sabendo onde dói). Guardada no banco justamente para os dois verem
// a MESMA coisa — vendedor e cliente discutindo telas diferentes é pior que não ter tela.
//
// ── AS DUAS PORTAS (mesmo desenho do /api/encaminhar) ────────────────────────────────────────
//   POST {site, contato}  + token  → FECHADA. Analisa, GRAVA e devolve o link + o resumo.
//   GET  ?id=<uuid>                → ABERTA. Renderiza a página. O uuid v4 é o segredo.
//
// ⚠️ ZERO MODELO: o motor (lib/diagnostico.js) é leitura de HTML. Isto funciona HOJE, com a conta
// da Anthropic zerada — foi decisão deliberada depois do apagão de 14/08, não coincidência.
import { json } from "../lib/guard.js";
import { sbKey, svcJson } from "../lib/sb.js";
import { diagnosticar } from "../lib/diagnostico.js";
import { demoAnalysisEmail } from "../lib/emailTemplates.js";
import { verifySession } from "../lib/sellerSession.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const rpc = (env, fn, args) => fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
  method: "POST",
  headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
  body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", ...args }),
}).then((r) => (r.ok ? r.json().catch(() => null) : null)).catch(() => null);

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const COR = { alta: "#C2410C", media: "#A16207", baixa: "#4B5563" };
const ROTULO = { alta: "vazando agora", media: "atrito", baixa: "oportunidade" };

function pagina(d) {
  const p = d.payload || {};
  const nome = esc(p.perfil?.nome || d.business || "seu negócio");
  const altas = p.resumo?.altas || 0;
  const horas = p.resumo?.horas_sem_ninguem;

  const cards = (p.achados || []).map((a) => `
    <article class="card" style="--c:${COR[a.gravidade] || COR.baixa}">
      <div class="tag">${ROTULO[a.gravidade] || ""}</div>
      <h3>${esc(a.titulo)}</h3>
      <p class="ev">${esc(a.evidencia)}</p>
      <p class="dor">${esc(a.dor)}</p>
      <p class="gui"><span>A Gui</span> ${esc(a.gui)}</p>
    </article>`).join("");

  return `<!doctype html><html lang="pt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>O que encontramos em ${nome}</title><style>
:root{--paper:#FBF8F4;--ink:#1C1917;--muted:#6B625A;--line:#E4DCD1;--card:#fff;--accent:#C25A12;
 --display:ui-serif,Georgia,serif;--body:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
 --keys:ui-monospace,SFMono-Regular,Menlo,monospace}
@media(prefers-color-scheme:dark){:root{--paper:#17150F;--ink:#F0EAE1;--muted:#A69C90;--line:#332D24;--card:#201D16;--accent:#FF9A47}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--body);line-height:1.6}
.wrap{max-width:46rem;margin:0 auto;padding:3rem 1.25rem 5rem}
h1,h2,h3{font-family:var(--display);text-wrap:balance;line-height:1.15}
.eyebrow{font-size:.75rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--accent)}
h1{font-size:clamp(1.9rem,5.5vw,2.8rem);font-weight:600;margin:.8rem 0 1rem}
.lede{font-size:1.15rem;color:var(--muted);margin:0 0 2rem}
.placar{display:flex;gap:1rem;flex-wrap:wrap;margin:0 0 2.5rem}
.n{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:1rem 1.25rem;flex:1;min-width:9rem}
.n b{display:block;font-family:var(--keys);font-size:2rem;font-weight:700;color:var(--accent);line-height:1.1}
.n span{font-size:.85rem;color:var(--muted)}
.card{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--c);
 border-radius:0 12px 12px 0;padding:1.4rem 1.5rem;margin:0 0 1rem}
.tag{font-size:.7rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--c)}
.card h3{font-size:1.15rem;font-weight:600;margin:.4rem 0 .6rem}
.ev{font-size:.9rem;color:var(--muted);margin:0 0 .7rem;font-family:var(--keys)}
.dor{margin:0 0 .8rem}
.gui{margin:0;padding-top:.8rem;border-top:1px solid var(--line);font-size:.95rem}
.gui span{font-weight:700;color:var(--accent)}
.fim{margin-top:2.5rem;padding-top:1.5rem;border-top:1px solid var(--line);color:var(--muted);font-size:.9rem}
</style></head><body><div class="wrap">
<div class="eyebrow">Análise gratuita · Guileo</div>
<h1>O que encontramos em ${nome}</h1>
<p class="lede">Lemos o site de vocês antes da conversa. Abaixo está só o que dá para provar —
nada de estimativa. Cada ponto vem com o que a nossa agente faz sobre ele.</p>

<div class="placar">
  <div class="n"><b>${p.resumo?.total ?? 0}</b><span>pontos encontrados</span></div>
  <div class="n"><b>${altas}</b><span>com dinheiro escapando</span></div>
  ${horas != null ? `<div class="n"><b>${horas}h</b><span>por semana sem ninguém no telefone</span></div>` : ""}
</div>

${cards || "<p>Não encontramos pontos abertos legíveis no site — o que já é raro. Na conversa a gente olha os canais que o site não mostra.</p>"}

<p class="fim">Levantado automaticamente a partir de <span class="ev">${esc(d.site)}</span> em
${new Date(d.created_at).toISOString().slice(0, 10)}. O que não estava escrito no site não entrou aqui —
preferimos um relatório curto e verdadeiro a um longo e chutado.</p>
</div></body></html>`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // ── PORTA ABERTA: o link que o prospect recebe ───────────────────────────────────────────────
  const id = url.searchParams.get("id");
  if (id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("link inválido", { status: 400 });
    const d = await rpc(env, "diag_get", { p_id: id, p_marcar: true });
    if (!d || !d.payload) return new Response("análise não encontrada", { status: 404 });
    return new Response(pagina(d), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  }

  // ── PORTA FECHADA: gerar a análise ───────────────────────────────────────────────────────────
  if (request.method !== "POST") return json({ error: "method" }, 405);
  const b = await request.json().catch(() => ({}));
  const tok = (b.token || "").toString();
  // Aceita o crachá do VENDEDOR (é ele quem marca demo) OU a senha do admin.
  // ⚠️ LÊ A RESPOSTA da RPC, não o status HTTP — `_admin_ok` devolve `false` com 200, e ler o
  // status foi exatamente o buraco que deixou o /api/encaminhar aberto hoje mais cedo.
  let ok = !!(await verifySession(env, (b.sid || "").toString()));
  if (!ok && tok) {
    if (env.DIGEST_TOKEN && tok === env.DIGEST_TOKEN) ok = true;
    else {
      const a = await svcJson(env, "_admin_ok", { p_token: tok }).catch(() => null);
      ok = a === true || a?.ok === true;
    }
  }
  if (!ok) return json({ error: "unauthorized", dica: "crachá de vendedor (sid) ou senha do /admin" }, 401);

  const site = (b.site || "").toString().trim().slice(0, 300);
  if (!site) return json({ error: "informe o site" }, 400);

  const an = await diagnosticar(site, env, (b.negocio || b.brand || "").toString().slice(0, 120));
  if (!an.ok) return json({ ok: false, erro: "nao_deu_pra_ler", motivo: an.motivo }, 409);

  const salvo = await rpc(env, "diag_save", {
    p_site: site, p_business: an.perfil?.nome || "", p_contato: (b.contato || "").toString().slice(0, 160),
    p_seller: (b.seller || "").toString().slice(0, 160), p_payload: an,
  });
  if (!salvo?.id) return json({ ok: false, erro: "nao_gravou" }, 500);

  const link = `${url.origin}/api/diagnostico?id=${salvo.id}`;

  // ── MANDAR (só com enviar:true) ──────────────────────────────────────────────────────────────
  // Analisar é inofensivo; e-mail pra prospect é irreversível e é a PRIMEIRA impressão da Guileo.
  // Por isso o padrão é não mandar: quem chama lê `tres_linhas` e confere se o que a gente
  // encontrou faz sentido antes de mandar. Um achado errado no primeiro contato não se desfaz.
  let envio = null;
  if (b.enviar === true && (b.contato || "").includes("@")) {
    if (!env.RESEND_API_KEY) envio = { ok: false, motivo: "RESEND_API_KEY ausente" };
    else {
      const m = demoAnalysisEmail({
        name: (b.nome || "").toString().slice(0, 60), business: an.perfil?.nome || "seu negócio",
        achados: an.achados.slice(0, 3).map((a) => a.titulo), link,
        horas: an.resumo?.horas_sem_ninguem, lang: (b.lang || "en").toString().slice(0, 2),
      });
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: b.contato, subject: m.subject, html: m.html }),
      });
      // confere o retorno real — "enviado" sem checar já custou dois bugs invisíveis nesta casa
      envio = r.ok ? { ok: true, para: b.contato, assunto: m.subject }
        : { ok: false, motivo: `HTTP ${r.status}`, detalhe: (await r.text().catch(() => "")).slice(0, 200) };
    }
  }

  return json({
    ok: true, link, envio,
    negocio: an.perfil?.nome || "",
    resumo: an.resumo, comparacao: an.comparacao,
    // As 3 linhas do e-mail: os achados mais graves, na ordem. É isto que vai no corpo — a página
    // tem o resto. Três é o limite do que alguém lê numa confirmação de reunião.
    tres_linhas: an.achados.slice(0, 3).map((a) => a.titulo),
    achados: an.achados.map((a) => ({ id: a.id, gravidade: a.gravidade, titulo: a.titulo })),
  });
}
