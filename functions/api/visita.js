// /api/visita — O CANAL PRIVADO DE UMA VISITA (2026-09-30)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// O e-mail de avaliação leva, para TODO cliente, dois caminhos: o botão do Google e "algo não foi
// como você esperava? fale direto com a gente". Este endpoint é o segundo.
//   GET  ?t=<e-mail do negócio>&a=<id da visita>&s=<token>  → a página com a caixa de texto
//   POST {t, a, s, comment}                                  → grava e AVISA A DONA do negócio
//
// 🚨 NÃO É REVIEW GATING, e não pode virar. O link de avaliação do Google continua no e-mail de
// todos e continua NESTA página, antes e depois do envio. Quem reclama aqui não perde o direito nem
// o caminho de avaliar em público. (Política do Google: não desencorajar avaliação negativa nem
// pedir avaliação só a quem está satisfeito.)
//
// POR QUE O AVISO SÓ SAI NO POST: leitor de e-mail e antivírus corporativo ABREM os links de uma
// mensagem sozinhos. Se o GET avisasse a dona, cada e-mail entregue viraria uma reclamação falsa.
// O GET só mostra a página; quem escreve e aperta "enviar" é uma pessoa.
//
// SEGURANÇA: o token (lib/visita.js) prende o link a UM negócio e UMA visita; a RPC confere de novo
// que a visita é daquele negócio (uuid sozinho não autoriza nada). Sem token válido: 404, sem dica.
import { json, rateLimited } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { visitaConfere } from "../lib/visita.js";
import { brandFor } from "../lib/clientBrand.js";
import { visitFeedbackEmail } from "../lib/emailTemplates.js";
import { emitFailure } from "../lib/failure.js";

const isEmail = (s) => /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test((s || "").toString().trim());
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const langOf = (v) => { const l = (v || "").toString().toLowerCase().slice(0, 2); return l === "pt" ? "pt" : l === "es" ? "es" : "en"; };
const html = (body, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" } });

const T = {
  en: { title: "Tell us what happened", lead: (b) => `Your message goes straight to the team${b ? ` at ${b}` : ""}. It is not public.`, ph: "What was not as you expected?", send: "Send to the team", sending: "Sending…", sent: "Sent. Thank you for telling us — the team will read it today.", err: "We could not send it. Please try again.", short: "Write a few words first.", pub: "You can also leave a public review", gone: "This link is no longer valid." },
  pt: { title: "Conte o que aconteceu", lead: (b) => `Sua mensagem vai direto para a equipe${b ? ` da ${b}` : ""}. Não é pública.`, ph: "O que não foi como você esperava?", send: "Enviar para a equipe", sending: "Enviando…", sent: "Enviado. Obrigado por contar — a equipe lê hoje.", err: "Não conseguimos enviar. Tente de novo.", short: "Escreva algumas palavras primeiro.", pub: "Você também pode deixar uma avaliação pública", gone: "Este link não é mais válido." },
  es: { title: "Cuéntenos qué pasó", lead: (b) => `Su mensaje va directo al equipo${b ? ` de ${b}` : ""}. No es público.`, ph: "¿Qué no fue como esperaba?", send: "Enviar al equipo", sending: "Enviando…", sent: "Enviado. Gracias por contarnos — el equipo lo lee hoy.", err: "No pudimos enviarlo. Inténtelo de nuevo.", short: "Escriba unas palabras primero.", pub: "También puede dejar una reseña pública", gone: "Este enlace ya no es válido." },
};

// O link de avaliação da UNIDADE da visita (perfil.review_links[unidade]) ou o geral. "" = não tem.
function linkDeAvaliacao(perfil, unidade) {
  const p = perfil && typeof perfil === "object" ? perfil : {};
  const porUnidade = p.review_links && typeof p.review_links === "object" ? p.review_links : {};
  const daUnidade = unidade ? String(porUnidade[unidade] || "") : "";
  const geral = String(p.review_link || "");
  return /^https:\/\//.test(daUnidade) ? daUnidade : /^https:\/\//.test(geral) ? geral : "";
}

function pagina({ L, negocio, logo, accent, review, params }) {
  const t = T[L];
  const cor = /^#[0-9a-f]{6}$/i.test(accent || "") ? accent : "#d9b26a";
  return `<!doctype html><html lang="${L === "pt" ? "pt-BR" : L}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(negocio || "Feedback")}</title></head>
<body style="margin:0;background:#0e0d0b;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;color:#ede7dc;">
<div style="max-width:460px;margin:8vh auto 0;padding:32px 26px;background:#161512;border:1px solid #2b2720;border-radius:22px;">
  ${logo ? `<div style="text-align:center;margin-bottom:14px;"><img src="${esc(logo)}" alt="" style="max-height:64px;max-width:200px;"></div>` : ""}
  ${negocio ? `<div style="text-align:center;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:${cor};font-weight:700;">${esc(negocio)}</div>` : ""}
  <h1 style="font-size:23px;font-weight:800;color:#f4f1ea;margin:12px 0 8px;text-align:center;">${t.title}</h1>
  <p style="font-size:15px;color:#c5beb0;line-height:1.7;margin:0 0 18px;text-align:center;">${esc(t.lead(negocio))}</p>
  <form id="f" onsubmit="return false;">
    <label for="c" style="position:absolute;left:-9999px;">${t.ph}</label>
    <textarea id="c" rows="5" maxlength="1000" placeholder="${t.ph}" style="width:100%;box-sizing:border-box;resize:vertical;background:#0e0d0b;border:1px solid #3a352c;border-radius:12px;color:#f4f1ea;font:inherit;font-size:15px;line-height:1.5;padding:12px 14px;"></textarea>
    <button id="b" type="submit" style="margin-top:12px;width:100%;cursor:pointer;border:0;background:${cor};color:#161512;font-weight:800;font-size:15px;border-radius:12px;padding:13px 16px;">${t.send}</button>
    <p id="m" role="status" style="font-size:14px;color:#c5beb0;line-height:1.6;margin:12px 0 0;text-align:center;min-height:1.6em;"></p>
  </form>
  ${review ? `<p style="font-size:13px;color:#9c9485;line-height:1.7;margin:16px 0 0;padding-top:14px;border-top:1px solid #2b2720;text-align:center;">${t.pub}: <a href="${esc(review)}" rel="noopener" style="color:${cor};font-weight:700;">Google →</a></p>` : ""}
</div>
<script>(function(){
  var f=document.getElementById('f'),b=document.getElementById('b'),c=document.getElementById('c'),m=document.getElementById('m');
  var P=${JSON.stringify(params)},TX=${JSON.stringify({ sending: t.sending, sent: t.sent, err: t.err, short: t.short, send: t.send })};
  f.addEventListener('submit',function(){
    var v=(c.value||'').trim(); if(v.length<3){m.textContent=TX.short;return;}
    b.disabled=true;b.textContent=TX.sending;m.textContent='';
    fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:P.t,a:P.a,s:P.s,comment:v})})
      .then(function(r){return r.json().catch(function(){return {};}).then(function(d){return {ok:r.ok&&d&&d.ok===true};});})
      .then(function(x){ if(x.ok){m.textContent=TX.sent;c.disabled=true;b.style.display='none';} else {b.disabled=false;b.textContent=TX.send;m.textContent=TX.err;} })
      .catch(function(){b.disabled=false;b.textContent=TX.send;m.textContent=TX.err;});
  });
})();</script>
</body></html>`;
}

const recusa = (L = "en") => html(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0e0d0b;color:#c5beb0;font-family:Helvetica,Arial,sans-serif;"><p style="max-width:420px;margin:20vh auto;padding:0 24px;text-align:center;">${T[L].gone}</p></body>`, 404);

// Confere o link e lê a visita. Devolve null quando não é para abrir (token, id ou negócio errado).
async function abrir(env, src, comentario) {
  const t = (src.t || "").toString().trim().toLowerCase();
  const a = (src.a || "").toString().trim().toLowerCase();
  const s = (src.s || "").toString().trim().toLowerCase();
  if (!env.SCHED_SECRET || !(await visitaConfere(env, t, a, s))) return null;
  const v = await svcJson(env, "biz_visit_feedback", { p_secret: env.SCHED_SECRET, p_email: t, p_id: a, p_comment: comentario ?? null });
  if (!v || v.ok !== true) return null;
  return { t, a, s, v };
}

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const x = await abrir(env, { t: q.get("t"), a: q.get("a"), s: q.get("s") }, null);
  if (!x) return recusa();
  const [perfil, brand] = await Promise.all([
    svcJson(env, "get_client_profile", { p_secret: env.INGEST_SECRET || "", p_email: x.t }).catch(() => null),
    brandFor(env, x.t).catch(() => null),
  ]);
  const L = langOf(perfil && perfil.lang);
  return html(pagina({ L, negocio: (brand && brand.business) || "", logo: brand && /^https:\/\//.test(brand.logo_url || "") && !/\.svg(\?|#|$)/i.test(brand.logo_url) ? brand.logo_url : "",
    accent: brand && brand.accent, review: linkDeAvaliacao(perfil, x.v.location), params: { t: x.t, a: x.a, s: x.s } }));
}

export async function onRequestPost({ request, env }) {
  if (await rateLimited(request, env, "visita", 8)) return json({ ok: false, erro: "muitas_tentativas" }, 429);
  const b = await request.json().catch(() => ({}));
  const comentario = (b.comment || "").toString().trim().slice(0, 1000);
  if (comentario.length < 3) return json({ ok: false, erro: "vazio" }, 400);
  const x = await abrir(env, b, comentario);
  if (!x) return json({ ok: false, erro: "link_invalido" }, 404);

  // AVISA A DONA — só na PRIMEIRA mensagem desta visita (a pessoa pode reenviar; o texto novo fica
  // gravado, mas a caixa de entrada dela não vira alvo). Falha de envio vira evento no /admin: um
  // recado que o cliente acha que entregou e ninguém recebeu é a pior versão deste recurso.
  let aviso = { enviado: false, motivo: "ja_avisada" };
  if (x.v.first) {
    aviso = { enviado: false, motivo: "sem_resend" };
    if (env.RESEND_API_KEY && isEmail(x.t)) {
      const [perfil, brand] = await Promise.all([
        svcJson(env, "get_client_profile", { p_secret: env.INGEST_SECRET || "", p_email: x.t }).catch(() => null),
        brandFor(env, x.t).catch(() => null),
      ]);
      const L = langOf(perfil && perfil.lang);
      let quando = "";
      try { quando = new Intl.DateTimeFormat(L === "pt" ? "pt-BR" : L === "es" ? "es-US" : "en-US", { timeZone: x.v.tz || "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(x.v.when)); } catch { /* sem data formatada */ }
      // Responder o aviso escreve para o CLIENTE: o e-mail dele vem do contato da visita ou do CRM.
      let cliente = isEmail(x.v.contact) ? String(x.v.contact).trim() : "";
      if (!cliente && x.v.contact) {
        const e = await svcJson(env, "crm_contact_email", { p_secret: env.SCHED_SECRET, p_email: x.t, p_phone: String(x.v.contact).replace(/[^0-9+]/g, "") }).catch(() => "");
        if (isEmail(e)) cliente = String(e);
      }
      const { subject, html: corpo } = visitFeedbackEmail({ business: (brand && brand.business) || "", customer: x.v.name || "", contact: [x.v.contact, cliente && cliente !== x.v.contact ? cliente : ""].filter(Boolean).join(" · "),
        service: x.v.service || "", location: x.v.location || "", whenLabel: quando, comment: comentario, lang: L });
      try {
        const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: x.t, subject, html: corpo, ...(cliente ? { reply_to: cliente } : {}) }) });
        const d = await r.json().catch(() => ({}));
        aviso = r.ok && d.id ? { enviado: true, id: d.id } : { enviado: false, motivo: `resend_${r.status}` };
      } catch (e) { aviso = { enviado: false, motivo: "rede" }; }
    }
    if (!aviso.enviado) { try { await emitFailure(env, "feedback_sem_aviso", x.t, `recado privado da visita ${x.v.ref || x.a} gravado, mas a dona NÃO foi avisada (${aviso.motivo})`, { appointment_id: x.a }); } catch { /* */ } }
  }
  // Para o cliente, "ok" = o recado foi GRAVADO (isso é verdade mesmo se o e-mail à dona falhar —
  // e a falha já virou alerta). O id do aviso não volta para o navegador.
  return json({ ok: true, avisou: aviso.enviado });
}
