// /api/preferencias — "COMO VOCÊ PREFERE?" ANTES DA VISITA (2026-10-05)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// O e-mail de confirmação e o lembrete de um serviço de cuidado levam este link. A cliente escolhe
// conversa ou silêncio, pressão (massagem), temperatura, aroma, onde focar, alergias e um recado.
//   GET  ?t=<e-mail do negócio>&a=<id da visita>&s=<token>  → a página (já preenchida, se respondeu)
//   POST {t, a, s, prefs}                                    → grava, AVISA O SALÃO e registra no painel
//
// POR QUE NADA ACONTECE NO GET: leitor de e-mail e antivírus corporativo ABREM os links sozinhos.
// Só quem escolhe e aperta "enviar" é uma pessoa — o aviso ao salão sai no POST.
// SEGURANÇA: o token (lib/visita.js, proposito "preferencias") prende o link a UM negócio e UMA
// visita; a RPC confere de novo que a visita é daquele negócio. Sem token válido: 404, sem dica.
// Depois que a visita começou, a página agradece e não grava mais (não há o que preparar).
import { json, rateLimited } from "../lib/guard.js";
import { svcJson, svcRpc } from "../lib/sb.js";
import { visitaConfere } from "../lib/visita.js";
import { brandFor } from "../lib/clientBrand.js";
import { visitPrefsEmail } from "../lib/emailTemplates.js";
import { emitFailure } from "../lib/failure.js";
import { limparPrefs, resumoPrefs, resumoCurto, ehMassagem, ROTULOS, ESCOLHAS, corDoBotao } from "../lib/preferencias.js";

const isEmail = (s) => /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test((s || "").toString().trim());
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const langOf = (v) => { const l = (v || "").toString().toLowerCase().slice(0, 2); return l === "pt" ? "pt" : l === "es" ? "es" : "en"; };
const html = (body, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" } });

const T = {
  en: { title: "How do you like it?", lead: "Tell us before you arrive and we'll have everything ready. Skip anything that doesn't apply.", send: "Send to the team", sending: "Sending…", sent: "Thank you — the team will have everything ready for you.", again: "You can update your answers anytime before your visit.", err: "We couldn't send it. Please try again.", empty: "Choose or write at least one thing.", gone: "This link is no longer valid.", closed: "This visit has already started or ended — thank you for choosing us.", medical: "For anything medical, please also tell your provider at the visit.", ptl: "Your choices" },
  pt: { title: "Como você prefere?", lead: "Conte antes de chegar e deixamos tudo pronto. Pule o que não se aplicar.", send: "Enviar para a equipe", sending: "Enviando…", sent: "Obrigado — a equipe vai deixar tudo pronto para você.", again: "Você pode mudar as respostas até a hora da visita.", err: "Não conseguimos enviar. Tente de novo.", empty: "Escolha ou escreva pelo menos uma coisa.", gone: "Este link não é mais válido.", closed: "Esta visita já começou ou terminou — obrigado por escolher a gente.", medical: "Para qualquer questão médica, avise também o profissional na visita.", ptl: "Suas escolhas" },
  es: { title: "¿Cómo lo prefiere?", lead: "Díganos antes de llegar y tendremos todo listo. Omita lo que no aplique.", send: "Enviar al equipo", sending: "Enviando…", sent: "Gracias — el equipo tendrá todo listo para usted.", again: "Puede cambiar sus respuestas hasta la hora de la visita.", err: "No pudimos enviarlo. Inténtelo de nuevo.", empty: "Elija o escriba al menos una cosa.", gone: "Este enlace ya no es válido.", closed: "Esta visita ya comenzó o terminó — gracias por elegirnos.", medical: "Para cualquier tema médico, avise también a su profesional en la visita.", ptl: "Sus elecciones" },
};

function quandoDe(iso, tz, L) {
  try { return new Intl.DateTimeFormat(L === "pt" ? "pt-BR" : L === "es" ? "es-US" : "en-US", { timeZone: tz || "America/New_York", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso)); } catch { return ""; }
}

function pagina({ L, negocio, logo, accent, v, params }) {
  const t = T[L]; const R = ROTULOS[L];
  const cor = corDoBotao(accent);   // texto branco no botão e nas escolhas marcadas: ≥ 4,5:1
  const atual = v.prefs && typeof v.prefs === "object" ? v.prefs : {};
  const massagem = ehMassagem(v.service);
  const grupos = ["conversation", ...(massagem ? ["pressure"] : []), "temperature", "scent"];
  const chips = (k) => `<fieldset class="g"><legend>${esc(R[k][0])}</legend><div class="c">${ESCOLHAS[k].map((val) =>
    `<label><input type="radio" name="${k}" value="${val}"${atual[k] === val ? " checked" : ""}><span>${esc(R[k][1][val])}</span></label>`).join("")}</div></fieldset>`;
  const campo = (k, area) => `<div class="g"><label class="t" for="${k}">${esc(R[k][0])}</label>${area
    ? `<textarea id="${k}" name="${k}" rows="3" maxlength="500" placeholder="${esc(R[k][1])}">${esc(atual[k] || "")}</textarea>`
    : `<input id="${k}" name="${k}" maxlength="${k === "focus" ? 200 : 300}" placeholder="${esc(R[k][1])}" value="${esc(atual[k] || "")}">`}</div>`;
  const quando = quandoDe(v.start, v.tz, L);
  return `<!doctype html><html lang="${L === "pt" ? "pt-BR" : L}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(negocio || t.title)}</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#F6F0E8;font-family:'Inter','SF Pro Text','Segoe UI',Helvetica,Arial,sans-serif;color:#1C1C1C}
.k{max-width:520px;margin:5vh auto 6vh;padding:34px 26px 28px;background:#fff;border-radius:40px 14px 40px 14px;box-shadow:0 1px 2px rgba(28,28,28,.06),0 30px 60px -34px rgba(60,40,30,.35)}
.n{text-align:center;font-size:11px;letter-spacing:2.6px;text-transform:uppercase;color:${cor};font-weight:700}
h1{font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:32px;line-height:1.15;text-align:center;margin:12px 0 6px}
.q{text-align:center;font-size:14px;color:#5A5A5A;margin:0 0 6px}.l{text-align:center;font-size:15px;color:#5A5A5A;line-height:1.6;margin:0 0 22px}
.g{border:0;margin:0 0 18px;padding:0}legend,.t{display:block;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#1C1C1C;margin:0 0 9px;padding:0}
.c{display:flex;flex-wrap:wrap;gap:8px}.c label{cursor:pointer}.c input{position:absolute;opacity:0;width:1px;height:1px}
.c span{display:inline-block;padding:10px 16px;min-height:44px;line-height:22px;border-radius:999px;font-size:14.5px;color:#1C1C1C;box-shadow:inset 0 0 0 1px rgba(28,28,28,.16);transition:box-shadow .2s,background .2s,color .2s}
.c input:checked+span{background:${cor};color:#fff;box-shadow:inset 0 0 0 1px ${cor}}.c input:focus-visible+span{outline:2px solid ${cor};outline-offset:2px}
input[type=text],input:not([type]),textarea{width:100%;font:inherit;font-size:15px;color:#1C1C1C;background:#FBF8F6;border:1px solid rgba(28,28,28,.14);border-radius:14px;padding:12px 14px;resize:vertical}
input:focus,textarea:focus{outline:2px solid ${cor};outline-offset:1px}
button{margin-top:6px;width:100%;min-height:52px;cursor:pointer;border:0;border-radius:999px;background:${cor};color:#fff;font:inherit;font-weight:600;font-size:15px}
button[disabled]{opacity:.6;cursor:default}.m{font-size:14px;color:#5A5A5A;line-height:1.6;text-align:center;min-height:1.6em;margin:12px 0 0}.x{font-size:12px;color:#7a7a7a;text-align:center;margin:14px 0 0}
</style></head>
<body><main class="k">
  ${logo ? `<div style="text-align:center;margin-bottom:12px"><img src="${esc(logo)}" alt="" style="max-height:56px;max-width:190px"></div>` : ""}
  ${negocio ? `<div class="n">${esc(negocio)}</div>` : ""}
  <h1>${t.title}</h1>
  ${v.service || quando ? `<p class="q">${esc([v.service, quando].filter(Boolean).join(" · "))}</p>` : ""}
  <p class="l">${t.lead}</p>
  <form id="f" novalidate>
    ${grupos.map(chips).join("")}
    ${massagem ? campo("focus") : ""}
    ${campo("allergies")}
    ${campo("notes", true)}
    <button id="b" type="submit">${t.send}</button>
    <p id="m" class="m" role="status">${v.prefs ? esc(t.again) : ""}</p>
  </form>
  <p class="x">${t.medical}</p>
</main>
<script>(function(){
  var f=document.getElementById('f'),b=document.getElementById('b'),m=document.getElementById('m');
  var P=${JSON.stringify(params)},TX=${JSON.stringify({ sending: t.sending, sent: t.sent, err: t.err, empty: t.empty, send: t.send })};
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var d={},fd=new FormData(f); fd.forEach(function(v,k){ if(String(v).trim()) d[k]=String(v).trim(); });
    if(!Object.keys(d).length){ m.textContent=TX.empty; return; }
    b.disabled=true;b.textContent=TX.sending;m.textContent='';
    fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:P.t,a:P.a,s:P.s,prefs:d})})
      .then(function(r){return r.json().catch(function(){return {};}).then(function(j){return {ok:r.ok&&j&&j.ok===true};});})
      .then(function(x){ b.disabled=false;b.textContent=TX.send; m.textContent=x.ok?TX.sent:TX.err; })
      .catch(function(){ b.disabled=false;b.textContent=TX.send;m.textContent=TX.err; });
  });
})();</script>
</body></html>`;
}

const aviso = (L, chave, status = 404) => html(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><body style="margin:0;background:#F6F0E8;color:#5A5A5A;font-family:Helvetica,Arial,sans-serif;"><p style="max-width:420px;margin:20vh auto;padding:0 24px;text-align:center;line-height:1.6;">${T[L][chave]}</p></body>`, status);

/* Confere o link e lê (ou grava) a visita. null = não abre (token, id ou negócio errado). */
async function abrir(env, src, prefs) {
  const t = (src.t || "").toString().trim().toLowerCase();
  const a = (src.a || "").toString().trim().toLowerCase();
  const s = (src.s || "").toString().trim().toLowerCase();
  if (!env.SCHED_SECRET || !(await visitaConfere(env, t, a, s, "preferencias"))) return null;
  const v = await svcJson(env, "biz_visit_prefs", { p_secret: env.SCHED_SECRET, p_email: t, p_id: a, p_prefs: prefs ?? null });
  if (!v || (v.ok !== true && v.reason !== "closed")) return null;
  return { t, a, s, v };
}

const idiomaDoNegocio = async (env, tenant) => {
  const perfil = await svcJson(env, "get_client_profile", { p_secret: env.INGEST_SECRET || "", p_email: tenant }).catch(() => null);
  return langOf(perfil && perfil.lang);
};

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const x = await abrir(env, { t: q.get("t"), a: q.get("a"), s: q.get("s") }, null);
  if (!x) return aviso("en", "gone");
  const [L, brand] = await Promise.all([idiomaDoNegocio(env, x.t), brandFor(env, x.t).catch(() => null)]);
  if (x.v.closed) return aviso(L, "closed", 200);
  return html(pagina({ L, negocio: (brand && brand.business) || "", accent: brand && brand.accent,
    logo: brand && /^https:\/\//.test(brand.logo_url || "") && !/\.svg(\?|#|$)/i.test(brand.logo_url) ? brand.logo_url : "",
    v: x.v, params: { t: x.t, a: x.a, s: x.s } }));
}

export async function onRequestPost({ request, env }) {
  if (await rateLimited(request, env, "preferencias", 8)) return json({ ok: false, erro: "muitas_tentativas" }, 429);
  const b = await request.json().catch(() => ({}));
  const limpo = limparPrefs(b.prefs);
  if (!limpo.ok) return json({ ok: false, erro: "vazio" }, 400);
  const x = await abrir(env, b, limpo.prefs);
  if (!x) return json({ ok: false, erro: "link_invalido" }, 404);
  if (x.v.ok !== true) return json({ ok: false, erro: "visita_encerrada" }, 409);

  const [L, brand] = await Promise.all([idiomaDoNegocio(env, x.t), brandFor(env, x.t).catch(() => null)]);
  const negocio = (brand && brand.business) || "";
  const linhas = resumoPrefs(limpo.prefs, L);

  // O SALÃO FICA SABENDO — e-mail para o negócio, com responder-para a cliente quando há e-mail dela.
  let avisou = false, motivo = "sem_resend";
  if (env.RESEND_API_KEY && isEmail(x.t)) {
    const cliente = isEmail(x.v.contact) ? String(x.v.contact).trim() : "";
    const { subject, html: corpo } = visitPrefsEmail({ business: negocio, customer: x.v.name || "", contact: x.v.contact || "", service: x.v.service || "",
      whenLabel: quandoDe(x.v.start, x.v.tz, L), location: x.v.location || "", linhas, alergia: limpo.prefs.allergies || "", atualizou: !x.v.first, lang: L });
    try {
      const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: x.t, subject, html: corpo, ...(cliente ? { reply_to: cliente } : {}) }) });
      const d = await r.json().catch(() => ({}));
      avisou = r.ok && !!d.id; motivo = avisou ? "" : `resend_${r.status}`;
    } catch { motivo = "rede"; }
  }
  // no painel do negócio (tipo 'booking' não gasta crédito)
  try {
    await svcRpc(env, "ingest_client_event", { p_secret: env.INGEST_SECRET || "", p_email: x.t, p_type: "booking", p_channel: "web",
      p_summary: resumoCurto(limpo.prefs, x.v.name, x.v.service), p_payload: { kind: "prefs", appointment_id: x.a, ref: x.v.ref || null, prefs: limpo.prefs } });
  } catch { /* o e-mail e a visita já guardam */ }
  if (!avisou) { try { await emitFailure(env, "preferencias_sem_aviso", x.t, `preferências da visita ${x.v.ref || x.a} gravadas, mas o salão NÃO foi avisado por e-mail (${motivo})`, { appointment_id: x.a }); } catch { /* */ } }
  // Para a cliente, "ok" = GRAVADO (é verdade mesmo se o e-mail ao salão falhar — a falha virou alerta).
  return json({ ok: true });
}
