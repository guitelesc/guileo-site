// /api/aniversario — A CLIENTE CONTA O DIA DO ANIVERSÁRIO (2026-09-30)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// O motor de aniversário existia e nunca mandou um parabéns: em toda a plataforma havia ZERO
// clientes com data de nascimento (crm_contacts.birth_date). Ninguém perguntava. O e-mail de
// confirmação agora leva um link discreto — "quando é o seu aniversário?" — que abre esta página.
//   GET  ?t=<e-mail do negócio>&a=<id do agendamento>&s=<token>  → a página (mês e dia)
//   POST {t, a, s, month, day}                                    → grava no cadastro da pessoa
//
// SÓ DIA E MÊS. Ninguém precisa dizer a idade para ganhar um parabéns, e é um dado a menos guardado.
// O GET NÃO GRAVA NADA: leitor de e-mail e antivírus abrem links sozinhos.
// SEGURANÇA: o token (lib/visita.js, propósito "aniversario") prende o link a UM negócio e UM
// agendamento; a RPC confere de novo que o agendamento é daquele negócio e acha a pessoa pelo
// contato DELE. Sem token válido: 404, sem dica.
import { json, rateLimited } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { visitaConfere } from "../lib/visita.js";
import { brandFor } from "../lib/clientBrand.js";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const langOf = (v) => { const l = (v || "").toString().toLowerCase().slice(0, 2); return l === "pt" ? "pt" : l === "es" ? "es" : "en"; };
const html = (body, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" } });

const T = {
  en: { title: "When is your birthday?", lead: (b) => `Just the day and month — so${b ? ` ${b}` : " we"} can celebrate you. No year needed.`, month: "Month", day: "Day", send: "Save my birthday", sending: "Saving…", sent: "Saved. Thank you — we will remember it.", err: "We could not save it. Please try again.", pick: "Choose the month and the day first.", bad: "That date does not exist. Check the day.", gone: "This link is no longer valid.",
    meses: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] },
  pt: { title: "Quando é o seu aniversário?", lead: (b) => `Só o dia e o mês — para${b ? ` a ${b}` : " a gente"} comemorar com você. Não precisa do ano.`, month: "Mês", day: "Dia", send: "Salvar meu aniversário", sending: "Salvando…", sent: "Salvo. Obrigado — vamos lembrar.", err: "Não conseguimos salvar. Tente de novo.", pick: "Escolha o mês e o dia primeiro.", bad: "Essa data não existe. Confira o dia.", gone: "Este link não é mais válido.",
    meses: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"] },
  es: { title: "¿Cuándo es su cumpleaños?", lead: (b) => `Solo el día y el mes — para que${b ? ` ${b}` : " nosotros"} lo celebre con usted. No hace falta el año.`, month: "Mes", day: "Día", send: "Guardar mi cumpleaños", sending: "Guardando…", sent: "Guardado. Gracias — lo recordaremos.", err: "No pudimos guardarlo. Inténtelo de nuevo.", pick: "Elija primero el mes y el día.", bad: "Esa fecha no existe. Revise el día.", gone: "Este enlace ya no es válido.",
    meses: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"] },
};

function pagina({ L, negocio, logo, accent, params }) {
  const t = T[L];
  const cor = /^#[0-9a-f]{6}$/i.test(accent || "") ? accent : "#d9b26a";
  const campo = "width:100%;box-sizing:border-box;background:#0e0d0b;border:1px solid #3a352c;border-radius:12px;color:#f4f1ea;font:inherit;font-size:16px;padding:12px 14px;";
  const meses = t.meses.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("");
  const dias = Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
  return `<!doctype html><html lang="${L === "pt" ? "pt-BR" : L}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(negocio || t.title)}</title></head>
<body style="margin:0;background:#0e0d0b;font-family:'Inter','SF Pro Display','Segoe UI',Helvetica,Arial,sans-serif;color:#ede7dc;">
<div style="max-width:460px;margin:8vh auto 0;padding:32px 26px;background:#161512;border:1px solid #2b2720;border-radius:22px;">
  ${logo ? `<div style="text-align:center;margin-bottom:14px;"><img src="${esc(logo)}" alt="" style="max-height:64px;max-width:200px;"></div>` : ""}
  ${negocio ? `<div style="text-align:center;font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:${cor};font-weight:700;">${esc(negocio)}</div>` : ""}
  <h1 style="font-size:23px;font-weight:800;color:#f4f1ea;margin:12px 0 8px;text-align:center;">${t.title}</h1>
  <p style="font-size:15px;color:#c5beb0;line-height:1.7;margin:0 0 18px;text-align:center;">${esc(t.lead(negocio))}</p>
  <form id="f" onsubmit="return false;">
    <div style="display:flex;gap:10px;">
      <div style="flex:2;min-width:0;"><label for="mo" style="display:block;font-size:12px;color:#9c9485;margin:0 0 6px;">${t.month}</label><select id="mo" style="${campo}"><option value="">—</option>${meses}</select></div>
      <div style="flex:1;min-width:0;"><label for="da" style="display:block;font-size:12px;color:#9c9485;margin:0 0 6px;">${t.day}</label><select id="da" style="${campo}"><option value="">—</option>${dias}</select></div>
    </div>
    <button id="b" type="submit" style="margin-top:14px;width:100%;cursor:pointer;border:0;background:${cor};color:#161512;font-weight:800;font-size:15px;border-radius:12px;padding:13px 16px;">${t.send}</button>
    <p id="m" role="status" style="font-size:14px;color:#c5beb0;line-height:1.6;margin:12px 0 0;text-align:center;min-height:1.6em;"></p>
  </form>
</div>
<script>(function(){
  var f=document.getElementById('f'),b=document.getElementById('b'),mo=document.getElementById('mo'),da=document.getElementById('da'),m=document.getElementById('m');
  var P=${JSON.stringify(params)},TX=${JSON.stringify({ sending: t.sending, sent: t.sent, err: t.err, pick: t.pick, bad: t.bad, send: t.send })};
  f.addEventListener('submit',function(){
    var mm=parseInt(mo.value,10),dd=parseInt(da.value,10); if(!mm||!dd){m.textContent=TX.pick;return;}
    b.disabled=true;b.textContent=TX.sending;m.textContent='';
    fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({t:P.t,a:P.a,s:P.s,month:mm,day:dd})})
      .then(function(r){return r.json().catch(function(){return {};}).then(function(d){return {ok:r.ok&&d&&d.ok===true,erro:d&&d.erro};});})
      .then(function(x){ if(x.ok){m.textContent=TX.sent;mo.disabled=true;da.disabled=true;b.style.display='none';} else {b.disabled=false;b.textContent=TX.send;m.textContent=x.erro==='data_invalida'?TX.bad:TX.err;} })
      .catch(function(){b.disabled=false;b.textContent=TX.send;m.textContent=TX.err;});
  });
})();</script>
</body></html>`;
}

const recusa = (L = "en") => html(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0e0d0b;color:#c5beb0;font-family:Helvetica,Arial,sans-serif;"><p style="max-width:420px;margin:20vh auto;padding:0 24px;text-align:center;">${T[L].gone}</p></body>`, 404);

const ler = (src) => ({
  t: (src.t || "").toString().trim().toLowerCase(),
  a: (src.a || "").toString().trim().toLowerCase(),
  s: (src.s || "").toString().trim().toLowerCase(),
});

export async function onRequestGet({ request, env }) {
  const q = new URL(request.url).searchParams;
  const x = ler({ t: q.get("t"), a: q.get("a"), s: q.get("s") });
  if (!(await visitaConfere(env, x.t, x.a, x.s, "aniversario"))) return recusa();
  const [perfil, brand] = await Promise.all([
    svcJson(env, "get_client_profile", { p_secret: env.INGEST_SECRET || "", p_email: x.t }).catch(() => null),
    brandFor(env, x.t).catch(() => null),
  ]);
  const L = langOf(perfil && perfil.lang);
  return html(pagina({ L, negocio: (brand && brand.business) || "",
    logo: brand && /^https:\/\//.test(brand.logo_url || "") && !/\.svg(\?|#|$)/i.test(brand.logo_url) ? brand.logo_url : "",
    accent: brand && brand.accent, params: x }));
}

export async function onRequestPost({ request, env }) {
  if (await rateLimited(request, env, "aniversario", 8)) return json({ ok: false, erro: "muitas_tentativas" }, 429);
  const b = await request.json().catch(() => ({}));
  const x = ler(b);
  if (!env.SCHED_SECRET || !(await visitaConfere(env, x.t, x.a, x.s, "aniversario"))) return json({ ok: false, erro: "link_invalido" }, 404);
  const month = parseInt(b.month, 10), day = parseInt(b.day, 10);
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return json({ ok: false, erro: "data_invalida" }, 400);
  const r = await svcJson(env, "crm_birthday_set", { p_secret: env.SCHED_SECRET, p_email: x.t, p_appointment_id: x.a, p_month: month, p_day: day });
  // "ok" só com o comprovante do banco (o id do cadastro que recebeu a data) — nunca pelo HTTP.
  if (r && r.ok === true && r.id) return json({ ok: true });
  if (r && r.reason === "invalid_date") return json({ ok: false, erro: "data_invalida" }, 400);
  if (r && r.reason === "not_found") return json({ ok: false, erro: "link_invalido" }, 404);
  return json({ ok: false, erro: "nao_gravou" }, 503);
}
