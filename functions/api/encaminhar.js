// Cloudflare Pages Function — o documento de ENCAMINHAMENTO, gerado por tenant.
//
// O PROBLEMA QUE ELE RESOLVE (Natura, 2026-08-14): agente ok, número ok, pipeline ok, e ZERO
// ligação de cliente — porque a linha que o mundo disca (Google, porta, Instagram) nunca foi
// encaminhada pro número novo. É o último metro do go-live, e ele não é código: é alguém
// digitando *92 no aparelho do salão. Um cliente que não faz esse passo paga a mensalidade e
// não recebe nada — churn garantido, e a culpa parece do produto.
//
// POR QUE GERADO E NÃO ESCRITO À MÃO: escrevi a versão do Natura na unha primeiro, e o cadastro
// dele desmentiu duas coisas que eu tinha assumido —
//   1. o idioma do tenant é `en`, e eu tinha escrito em português;
//   2. ele tem TRÊS unidades e DUAS linhas (718…5530 e 212…0661), não uma. Metade das ligações
//      dele continuaria caindo no vazio mesmo com o documento "certo" seguido à risca.
// Um documento escrito à mão é uma foto do que quem escreveu imaginou. Este lê o cadastro.
//
// ── AS DUAS PORTAS ───────────────────────────────────────────────────────────────────────────
//   ?email=…&token=…  → FECHADA (admin/digest). Devolve o link assinado + o que vai no documento.
//   ?t=<assinado>     → ABERTA. Renderiza o HTML. O token é HMAC do e-mail (mesma chave e mesmo
//                       formato do crachá do vendedor) — inadivinhável, expira, e não dá acesso
//                       a nada além desta página. É o que o dono do salão recebe no WhatsApp.
//
// ⚠️ FALHA FECHADA: sem número da Guileo, o documento NÃO nasce. Um passo-a-passo com o campo do
// número vazio é pior que documento nenhum — o cliente encaminha pra lugar nenhum, perde as
// ligações de verdade, e ninguém descobre até ele cancelar.
import { json } from "../lib/guard.js";
import { signSession, verifySession } from "../lib/sellerSession.js";
import { forwardingSetupEmail } from "../lib/emailTemplates.js";
import { sbKey, svcJson } from "../lib/sb.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";

async function rpc(env, fn, args) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: env.INGEST_SECRET || "", ...args }),
  });
  return r.ok ? await r.json().catch(() => null) : null;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// +19298288170 → "+1 929 828 8170" (o dono lê em voz alta pro funcionário; bloco corrido erra)
const bonito = (n) => {
  const d = String(n || "").replace(/\D/g, "");
  return d.length === 11 && d[0] === "1" ? `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}` : String(n || "");
};
// o que se digita depois do *92: 10 dígitos, sem +1 (com o +1 muitos operadores recusam)
const discar = (n) => { const d = String(n || "").replace(/\D/g, ""); return d.length === 11 && d[0] === "1" ? d.slice(1) : d; };

// ── AS LINHAS DO CLIENTE ────────────────────────────────────────────────────────────────────
// Junta TODAS as linhas próprias do tenant: cada unidade em `locations[].phone` mais o
// `channels.phone.forward` do cadastro. Dedup por dígitos — duas unidades dividindo a mesma
// linha (o caso do Natura no UES) viram UMA instrução, senão o dono acha que digitou errado.
// NUNCA inclui o número da Guileo: encaminhar o número dela pra ela mesma é laço infinito.
function linhasDoCliente(payload, numeroGuileo) {
  const vistos = new Set([discar(numeroGuileo)]);
  const fora = [];
  const push = (tel, rotulo) => {
    const k = discar(tel);
    if (!k || k.length < 10 || vistos.has(k)) return;
    vistos.add(k);
    fora.push({ tel, rotulo });
  };
  for (const loc of (payload?.locations || [])) push(loc?.phone, loc?.name || "");
  push(payload?.channels?.phone?.forward, "");
  return fora;
}

const T = {
  pt: {
    titulo: (b) => `Como fazer o telefone do ${b} cair na ${"%A%"}`,
    lede: (a) => `A ${a} já está pronta e atendendo — mas no número novo dela. Enquanto a linha que vocês divulgam não apontar pra lá, ela atende um telefone que ninguém disca. São 5 minutos no aparelho.`,
    numLabel: (a) => `O número da ${a}`, numNota: "É pra este número que vocês vão encaminhar.",
    decidaH: "Antes: decidam quando ela atende", decidaP: "Esta é a única escolha real do processo, e ela não é técnica.",
    opcao: "Opção", oque: "O que acontece", praquem: "Pra quem", recomendado: "RECOMENDADO",
    soSobraT: "Só o que sobra", soSobraD: (a) => `Vocês atendem normalmente. A ${a} entra <strong>só</strong> quando a linha está ocupada ou quando ninguém atende em 4 toques.`,
    soSobraQ: "Quem tem recepção. Ninguém perde o contato humano — ela pega só o que ia virar caixa postal.",
    tudoT: "Tudo", tudoD: (a) => `Toda ligação vai direto pra ${a}, 24 horas.`, tudoQ: "Linha nova, horário fechado, ou quando não há ninguém na recepção.",
    recP: "A recomendação é começar pela primeira. Ela não tira nada de vocês — só devolve as ligações que hoje se perdem.",
    trapT: "A armadilha que faz parecer que não funcionou.",
    trapP: "A caixa postal da operadora também atende por tempo. Se ela pega em 20 segundos e o encaminhamento está em 25, <strong>a caixa postal ganha sempre</strong> — e parece que nada foi configurado. Deixem o encaminhamento em <strong>4 toques (≈20s)</strong> e a caixa postal em 30s ou mais.",
    linhasH: "As linhas de vocês", linhasP1: "Encaminhe esta linha:", linhasPn: "São mais de uma linha — <strong>faça em todas</strong>. Uma linha esquecida continua perdendo ligação exatamente como hoje.",
    qualH: "Qual telefone vocês usam?",
    celT: "Celular ou linha fixa comum →", celD: "Verizon, AT&T, T-Mobile, Spectrum residencial. Resolve digitando um código.",
    voipT: "Telefone de internet / sistema com ramais →", voipD: "RingCentral, Google Voice, Ooma, Vonage, Spectrum Business. Resolve no painel.",
    celH: "Celular ou linha fixa comum",
    celP: "No aparelho de <strong>cada linha listada acima</strong>, digite o código e o número como se fosse uma ligação normal e aperte chamar. Você ouve dois bipes ou uma gravação curta confirmando.",
    ocupado: "Quando a linha está ocupada", naoatende: "Quando ninguém atende",
    facaDois: "Faça os dois. Um cobre o telefone ocupado, o outro cobre a hora em que todo mundo está atendendo cliente — e são justamente essas as ligações que se perdem hoje.",
    tudoH: "Se escolheram “Tudo”", tudoSub: "Um código só, e não precisa dos dois de cima:",
    desligarH: "Para desligar depois", desligar: "Desligar", codigo: "Código",
    dOcup: "o de ocupado", dNao: "o de não atende", dTudo: "o de tudo",
    operadora: (n) => `Alguns operadores usam códigos diferentes. Se der erro, ligue pra operadora e peça exatamente isto: <em>“quero encaminhamento condicional quando ocupado e quando não atendido, para o ${n}, disparando em 4 toques.”</em>`,
    voipH: "Telefone de internet ou sistema com ramais",
    voipP: "Aqui <strong>não use código</strong> — é uma regra no painel de administração, e ela é mais confiável.",
    v1: "Entre no painel e procure <strong>“Call Handling”</strong>, <strong>“Call Forwarding”</strong> ou <strong>“Regras de chamada”</strong>.",
    v2: "Escolha a linha — a que está no Google e na porta.",
    v3: (n) => `Crie a regra: <em>se ocupado</em> <strong>ou</strong> <em>se não atendido após 4 toques</em> → encaminhar para <span class="tel">${n}</span>.`,
    v4: "Confira que essa regra fica <strong>acima</strong> da regra de caixa postal. A primeira que casar é a que vale.",
    v5: "Salve. Repita para cada linha da lista.",
    provaH: "Antes de considerar pronto: 3 ligações",
    provaP: "Configurar não é o mesmo que funcionar. Peça a alguém de fora (outro celular) pra fazer estas três, nesta ordem:",
    p1: (a) => `Liga e <strong>deixa tocar</strong>, sem ninguém atender → a <strong>${a}</strong> tem que atender.`,
    p2: (a) => `Com alguém já falando na linha, liga de novo → a <strong>${a}</strong> tem que atender na hora.`,
    p3: (a) => `Liga e alguém de vocês <strong>atende no 2º toque</strong> → quem atende é a <strong>pessoa</strong>, não a ${a}.`,
    provaN: (a) => `A terceira é a mais importante: prova que a ${a} entra só no que sobra, e não tomou a linha de vocês.`,
    fim: "Feito isso, me avisem. Do meu lado eu confirmo que as três ligações apareceram no painel — se alguma não aparecer, o encaminhamento foi pro número errado e a gente corrige na hora.",
    rodape: "qualquer dúvida, respondam este mesmo contato.",
  },
  en: {
    titulo: (b) => `How to make ${b}'s phone reach ${"%A%"}`,
    lede: (a) => `${a} is live and answering — but on her own new number. Until the line you advertise points there, she is answering a phone nobody dials. This takes 5 minutes on the handset.`,
    numLabel: (a) => `${a}'s number`, numNota: "This is the number you will forward to.",
    decidaH: "First: decide when she answers", decidaP: "This is the only real choice here, and it isn't a technical one.",
    opcao: "Option", oque: "What happens", praquem: "Who it's for", recomendado: "RECOMMENDED",
    soSobraT: "Only the overflow", soSobraD: (a) => `You answer as usual. ${a} steps in <strong>only</strong> when the line is busy or nobody picks up within 4 rings.`,
    soSobraQ: "Anyone with a front desk. Nobody loses the human touch — she catches only what was heading to voicemail.",
    tudoT: "Everything", tudoD: (a) => `Every call goes straight to ${a}, 24 hours a day.`, tudoQ: "A new line, after hours, or when nobody is at the desk.",
    recP: "Start with the first one. It takes nothing away from you — it gives back the calls you lose today.",
    trapT: "The trap that makes this look broken.",
    trapP: "Your carrier's voicemail also answers on a timer. If voicemail picks up at 20 seconds and forwarding is set to 25, <strong>voicemail wins every time</strong> — and it looks like nothing was set up. Set forwarding to <strong>4 rings (≈20s)</strong> and voicemail to 30s or more.",
    linhasH: "Your lines", linhasP1: "Forward this line:", linhasPn: "There is more than one line — <strong>do all of them</strong>. A forgotten line keeps losing calls exactly like today.",
    qualH: "Which phone do you use?",
    celT: "Mobile or regular landline →", celD: "Verizon, AT&T, T-Mobile, Spectrum residential. Fixed by dialing a code.",
    voipT: "Internet phone / system with extensions →", voipD: "RingCentral, Google Voice, Ooma, Vonage, Spectrum Business. Fixed in the admin panel.",
    celH: "Mobile or regular landline",
    celP: "On the handset of <strong>each line listed above</strong>, dial the code and the number like a normal call and press call. You'll hear two beeps or a short confirmation.",
    ocupado: "When the line is busy", naoatende: "When nobody answers",
    facaDois: "Do both. One covers a busy phone, the other covers the hour when everyone is with a client — and those are exactly the calls being lost today.",
    tudoH: "If you chose “Everything”", tudoSub: "One code only, and you don't need the two above:",
    desligarH: "To turn it off later", desligar: "Turn off", codigo: "Code",
    dOcup: "busy forwarding", dNao: "no-answer forwarding", dTudo: "forward everything",
    operadora: (n) => `Some carriers use different codes. If you get an error, call them and ask for exactly this: <em>“I want conditional call forwarding on busy and on no-answer, to ${n}, triggering after 4 rings.”</em>`,
    voipH: "Internet phone or system with extensions",
    voipP: "Here <strong>don't use a code</strong> — it's a rule in the admin panel, and it's more reliable.",
    v1: "Open the panel and look for <strong>“Call Handling”</strong>, <strong>“Call Forwarding”</strong> or <strong>“Call rules”</strong>.",
    v2: "Pick the line — the one on Google and on your door.",
    v3: (n) => `Create the rule: <em>if busy</em> <strong>or</strong> <em>if unanswered after 4 rings</em> → forward to <span class="tel">${n}</span>.`,
    v4: "Make sure that rule sits <strong>above</strong> the voicemail rule. The first match wins.",
    v5: "Save. Repeat for every line on the list.",
    provaH: "Before calling it done: 3 calls",
    provaP: "Setting it up is not the same as it working. Ask someone outside (another mobile) to make these three, in this order:",
    p1: (a) => `Call and <strong>let it ring</strong> with nobody picking up → <strong>${a}</strong> must answer.`,
    p2: (a) => `While someone is on the line, call again → <strong>${a}</strong> must answer right away.`,
    p3: (a) => `Call and have one of you <strong>answer on the 2nd ring</strong> → the <strong>person</strong> answers, not ${a}.`,
    provaN: (a) => `The third is the most important: it proves ${a} only takes the overflow, and hasn't taken your line.`,
    fim: "Once that's done, let me know. On my side I'll confirm all three calls landed in the dashboard — if one is missing, the forwarding went to the wrong number and we fix it on the spot.",
    rodape: "any questions, just reply to this same contact.",
  },
};
T.es = T.en; // ainda sem tradução própria: melhor inglês honesto que espanhol de máquina

function pagina({ business, agentName, numero, linhas, lang, accent }) {
  const t = T[lang] || T.en;
  const A = esc(agentName);
  const nB = bonito(numero), nD = discar(numero);
  const titulo = t.titulo(esc(business)).replace("%A%", A);
  const linhaHtml = linhas.length
    ? `<ul class="lines">${linhas.map((l) => `<li><span class="tel">${esc(bonito(l.tel))}</span>${l.rotulo ? ` <span class="loc">${esc(l.rotulo)}</span>` : ""}</li>`).join("")}</ul>
       <p class="muted">${linhas.length > 1 ? t.linhasPn : t.linhasP1}</p>`
    : "";

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${titulo}</title><style>
:root{--paper:#FBF8F4;--ink:#1C1917;--muted:#6B625A;--line:#E4DCD1;--card:#fff;
 --accent:${accent};--accent-soft:#FDF0E5;--good:#2F7D52;--good-soft:#EAF4EE;--warn:#9C6410;--warn-soft:#FDF3E0;
 --display:ui-serif,Georgia,serif;--body:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
 --keys:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
@media(prefers-color-scheme:dark){:root{--paper:#17150F;--ink:#F0EAE1;--muted:#A69C90;--line:#332D24;
 --card:#201D16;--accent-soft:#2E1F11;--good:#6FCB95;--good-soft:#152318;--warn:#E0A83F;--warn-soft:#2A2010}}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--body);line-height:1.6}
.wrap{max-width:44rem;margin:0 auto;padding:3rem 1.25rem 5rem}p,li{font-size:1.0625rem}
h1,h2,h3{font-family:var(--display);text-wrap:balance;line-height:1.15}
.eyebrow{font-size:.75rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);margin-bottom:.85rem}
h1{font-size:clamp(1.85rem,5.5vw,2.7rem);font-weight:600;margin:0 0 1rem}
.lede{font-size:1.15rem;color:var(--muted);margin:0 0 2.5rem}
h2{font-size:1.35rem;font-weight:600;margin:3rem 0 .75rem;padding-top:1.75rem;border-top:1px solid var(--line)}
h3{font-size:1.05rem;font-weight:600;margin:1.75rem 0 .5rem}
.num{display:inline-flex;align-items:center;justify-content:center;width:1.65rem;height:1.65rem;border-radius:50%;
 background:var(--accent);color:var(--paper);font-family:var(--body);font-size:.85rem;font-weight:700;margin-right:.6rem;vertical-align:.1em}
.code{font-family:var(--keys);font-size:1.5rem;font-weight:600;color:var(--accent);white-space:nowrap}
.tel{font-family:var(--keys);font-weight:600;white-space:nowrap}
.loc{color:var(--muted);font-size:.9rem}
.lines{list-style:none;padding:0;margin:1rem 0}
.lines li{padding:.6rem .9rem;background:var(--card);border:1px solid var(--line);border-radius:8px;margin-bottom:.5rem}
.scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;margin:1.25rem 0;font-size:1rem}
th,td{text-align:left;padding:.7rem .5rem;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700}
td:first-child{white-space:nowrap}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:1.5rem;margin:1.5rem 0}
.flag{border-left:3px solid var(--warn);background:var(--warn-soft);border-radius:0 8px 8px 0;padding:1.15rem 1.35rem;margin:1.5rem 0}
.flag strong{color:var(--warn)}
.proof{border:2px solid var(--good);background:var(--good-soft);border-radius:12px;padding:1.5rem 1.6rem;margin:1.75rem 0}
.proof h3{margin-top:0;color:var(--good)}.proof ol{margin:0;padding-left:1.25rem}.proof li{margin:.7rem 0}
.pick{display:grid;gap:.75rem;margin:1.5rem 0}
.pick a{display:block;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:1rem 1.15rem;
 text-decoration:none;color:var(--ink);transition:border-color .15s}
.pick a:hover{border-color:var(--accent)}.pick b{display:block;font-weight:600}.pick span{color:var(--muted);font-size:.95rem}
a{color:var(--accent)}a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.muted{color:var(--muted)}.rec{color:var(--good);font-weight:600;font-size:.85rem}
footer{margin-top:3.5rem;padding-top:1.5rem;border-top:1px solid var(--line);color:var(--muted);font-size:.9rem}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style></head><body><div class="wrap">

<div class="eyebrow">${esc(business)} · Guileo</div>
<h1>${titulo}</h1>
<p class="lede">${t.lede(A)}</p>

<div class="card">
 <div style="font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700">${t.numLabel(A)}</div>
 <div class="code" style="font-size:1.9rem;margin-top:.4rem">${esc(nB)}</div>
 <p class="muted" style="margin:.6rem 0 0;font-size:.95rem">${t.numNota}</p>
</div>

${linhas.length ? `<h2>${t.linhasH}</h2>${linhaHtml}` : ""}

<h2>${t.decidaH}</h2><p>${t.decidaP}</p>
<div class="scroll"><table>
<tr><th>${t.opcao}</th><th>${t.oque}</th><th>${t.praquem}</th></tr>
<tr><td><strong>${t.soSobraT}</strong><br><span class="rec">${t.recomendado}</span></td><td>${t.soSobraD(A)}</td><td>${t.soSobraQ}</td></tr>
<tr><td><strong>${t.tudoT}</strong></td><td>${t.tudoD(A)}</td><td>${t.tudoQ}</td></tr>
</table></div>
<p>${t.recP}</p>

<div class="flag"><p style="margin:0 0 .5rem"><strong>${t.trapT}</strong></p><p style="margin:0">${t.trapP}</p></div>

<h2>${t.qualH}</h2>
<div class="pick">
 <a href="#cel"><b>${t.celT}</b><span>${t.celD}</span></a>
 <a href="#voip"><b>${t.voipT}</b><span>${t.voipD}</span></a>
</div>

<h2 id="cel">${t.celH}</h2><p>${t.celP}</p>
<h3><span class="num">1</span>${t.ocupado}</h3><p class="code">*90 ${esc(nD)}</p>
<h3><span class="num">2</span>${t.naoatende}</h3><p class="code">*92 ${esc(nD)}</p>
<p class="muted">${t.facaDois}</p>
<h3>${t.tudoH}</h3><p>${t.tudoSub}</p><p class="code">*72 ${esc(nD)}</p>
<h3>${t.desligarH}</h3>
<div class="scroll"><table><tr><th>${t.desligar}</th><th>${t.codigo}</th></tr>
<tr><td>${t.dOcup}</td><td><span class="tel">*91</span></td></tr>
<tr><td>${t.dNao}</td><td><span class="tel">*93</span></td></tr>
<tr><td>${t.dTudo}</td><td><span class="tel">*73</span></td></tr></table></div>
<p class="muted">${t.operadora(esc(nB))}</p>

<h2 id="voip">${t.voipH}</h2><p>${t.voipP}</p>
<ol><li>${t.v1}</li><li>${t.v2}</li><li>${t.v3(esc(nB))}</li><li>${t.v4}</li><li>${t.v5}</li></ol>

<div class="proof"><h3>${t.provaH}</h3><p style="margin:.25rem 0 1rem">${t.provaP}</p>
<ol><li>${t.p1(A)}</li><li>${t.p2(A)}</li><li>${t.p3(A)}</li></ol>
<p style="margin:1rem 0 0">${t.provaN(A)}</p></div>

<p>${t.fim}</p>
<footer>Guileo · ${t.rodape}<br>${t.numLabel(A)}: <span class="tel">${esc(nB)}</span></footer>
</div></body></html>`;
}

async function montar(env, email, langForcado) {
  const perfil = (await rpc(env, "get_client_profile", { p_email: email })) || {};
  const draft = (await rpc(env, "draft_payload_for", { p_email: email })) || {};
  const numero = await rpc(env, "client_number_lookup", { p_email: email });
  // FALHA FECHADA: sem número, o documento não nasce (ver o cabeçalho).
  if (!numero) return { erro: "sem_numero", detalhe: "este cliente não tem número da Guileo — rode a ROTA-PROVISION/ROTA-NUMERO antes" };

  const business = draft.business || perfil.business_name || "";
  if (!business) return { erro: "sem_cadastro", detalhe: "tenant sem nome de negócio — o documento sairia genérico" };

  return {
    business,
    // Sem nome próprio a agente é "Gui" — é o mesmo fallback do prompt, não uma invenção daqui.
    agentName: (draft?.agent?.name || "").toString().trim() || "Gui",
    numero,
    linhas: linhasDoCliente(draft, numero),
    lang: (langForcado || draft.lang || perfil.lang || "en").toString().slice(0, 2).toLowerCase(),
    accent: /^#[0-9a-f]{6}$/i.test(draft?.brand?.accent || "") ? draft.brand.accent : "#C25A12",
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const lang = (url.searchParams.get("lang") || "").slice(0, 2).toLowerCase();

  // ── PORTA ABERTA: o link que o cliente recebe ─────────────────────────────────────────────
  const t = url.searchParams.get("t");
  if (t) {
    const email = await verifySession(env, t);
    if (!email) return new Response("link inválido ou expirado", { status: 401, headers: { "content-type": "text/plain; charset=utf-8" } });
    const d = await montar(env, email, lang);
    if (d.erro) return new Response(`não deu para montar o documento: ${d.detalhe}`, { status: 409, headers: { "content-type": "text/plain; charset=utf-8" } });
    return new Response(pagina(d), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  }

  // ── PORTA FECHADA: gerar o link ───────────────────────────────────────────────────────────
  const tok = (url.searchParams.get("token") || request.headers.get("x-guileo-secret") || "").toString();
  let ok = !!env.DIGEST_TOKEN && tok === env.DIGEST_TOKEN;
  if (!ok && tok) {
    // ⚠️ LÊ A RESPOSTA, NÃO O STATUS. `_admin_ok` com a senha ERRADA devolve `false` — com HTTP
    // 200. A 1ª versão daqui fazia `.then(r => r.ok)`, que é o status HTTP: 200 → autorizado.
    // Qualquer texto abria a porta, e a porta manda e-mail em nome da Guileo pra qualquer
    // endereço. O Luis provou sem querer, colando o placeholder `SUA_SENHA_DO_ADMIN`.
    // É a MESMA armadilha já registrada no provisionamento ("fetch não lança em erro HTTP") —
    // e eu a repeti no mesmo dia copiando o padrão de um vizinho cuja RPC LEVANTA exceção
    // (blitz_stats) para uma RPC que RETORNA booleano. O padrão só era seguro no vizinho.
    const a = await svcJson(env, "_admin_ok", { p_token: tok }).catch(() => null);
    ok = a === true || a?.ok === true;
  }
  if (!ok) return json({ error: "unauthorized", dica: "token do cron OU senha do /admin" }, 401);

  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  if (!email.includes("@")) return json({ error: "email obrigatório" }, 400);
  const d = await montar(env, email, lang);
  if (d.erro) return json({ ok: false, ...d }, 409);

  const assinado = await signSession(env, email);
  if (!assinado) return json({ ok: false, erro: "sem INGEST_SECRET — não dá pra assinar o link" }, 503);
  const link = `${url.origin}/api/encaminhar?t=${assinado}`;

  // ── ENVIAR (só com &enviar=1) ─────────────────────────────────────────────────────────────
  // Gerar o link é inofensivo; mandar e-mail pro cliente é irreversível. Por isso o padrão é
  // NÃO mandar: quem chama vê primeiro o `linhas_a_encaminhar` e confere se a lista está certa.
  // Mandar um passo-a-passo com a linha errada faz o dono desviar o telefone do negócio dele
  // pra um número que não é o dele — o pior desfecho possível desta rota.
  let envio = null;
  if (url.searchParams.get("enviar") === "1") {
    if (!env.RESEND_API_KEY) envio = { ok: false, motivo: "RESEND_API_KEY ausente" };
    else {
      const m = forwardingSetupEmail({
        business: d.business, agentName: d.agentName, number: bonito(d.numero), link, lang: d.lang,
        lines: d.linhas.map((l) => `${bonito(l.tel)}${l.rotulo ? `  ${l.rotulo}` : ""}`),
      });
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: email, subject: m.subject, html: m.html }),
      });
      // ⚠️ CONFERE O RETORNO. `fetch` não levanta em erro HTTP — sem o `.ok` isto vira "enviado"
      // com o e-mail parado no provedor, e a gente esperaria para sempre uma resposta do cliente
      // que nunca recebeu nada. (Regra da casa: todo send confere o resultado real.)
      // COMPROVANTE (2026-09-28): `r.ok` diz que a Resend aceitou; o `id` é o que permite achar o
      // e-mail depois. "Enviado" sem id é promessa — a regra da casa, que eu mesmo tinha furado aqui.
      const recibo = r.ok ? await r.clone().json().catch(() => null) : null;
      envio = r.ok
        ? { ok: true, para: email, assunto: m.subject, envio_id: recibo?.id || null }
        : { ok: false, motivo: `HTTP ${r.status}`, detalhe: (await r.text().catch(() => "")).slice(0, 200) };
      if (envio.ok) {
        await rpc(env, "ingest_client_event", {
          p_email: email, p_type: "message", p_channel: "email",
          p_summary: `📨 Guia de encaminhamento enviado (${d.linhas.length} linha(s))`, p_amount: 0, p_payload: { kind: "forwarding_guide" },
        });
      }
    }
  }

  return json({
    ok: true, link, envio,
    business: d.business, agente: d.agentName, numero_guileo: bonito(d.numero), idioma: d.lang,
    linhas_a_encaminhar: d.linhas.map((l) => `${bonito(l.tel)}${l.rotulo ? ` (${l.rotulo})` : ""}`),
    nota: d.linhas.length > 1 ? `⚠️ ${d.linhas.length} linhas — o documento manda encaminhar TODAS` : null,
  });
}
