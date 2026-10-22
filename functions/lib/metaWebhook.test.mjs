// ⚠️ MORA EM functions/lib/ E NÃO AO LADO DO QUE TESTA — de propósito.
// functions/api/ é o diretório de ROTAS do Cloudflare Pages: todo arquivo ali entra no bundle do
// Worker. Este teste usa só `node:crypto` (que existe no runtime do Workers) e por isso sobreviveu
// deployado, mas o vizinho que importava `node:fs` derrubou o bundle e fez /api/vitrine-agenda
// devolver 502 do EDGE em produção, em 27/08 — sem erro de build, de lint ou de deploy.
// Um `node:fs` acrescentado aqui um dia derrubaria o webhook do Instagram do mesmo jeito.
// Regra: teste nenhum mora em functions/api/. Os que leem arquivo vivem aqui ou em functions/site/.
// COMENTÁRIO → DM: a prova de que o payload da Meta atravessa o webhook e vira direct.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ESTE TESTE EXISTE
// comentarios.test.mjs prova a REGRA (o que casa, o que freia). Isso não prova nada sobre o
// caminho: um `field` escrito errado, um `entry.id` lido do lugar errado, ou o ramo de changes[]
// não sendo percorrido fazem a regra certa nunca ser chamada — e o sintoma é silêncio absoluto,
// idêntico a "ninguém comentou". Foi exatamente assim que o roteamento de Instagram ficou morto
// por semanas: a RPC gravava certo, mas o id nunca casava.
//
// Aqui entra o payload EXATO que a Meta manda, com assinatura HMAC de verdade, e a asserção é
// sobre a chamada que sai pro Graph: URL, recipient.comment_id e o texto do DM.
import crypto from "node:crypto";

const APP_SECRET = "segredo-de-teste";
const INGEST = "glo_ing_c7f2a9e4b8d16350";
const IG_CONTA = "17841400000000001";   // a conta do cliente (entry.id)
const PESSOA = "9988776655";            // quem comentou
const COMMENT_ID = "17999999999999999";

let falhas = 0;
const ok = (c, o) => { if (!c) { falhas++; console.log("  ✗ " + o); } else console.log("  ✓ " + o); };

// ── captura tudo que sai pela rede ───────────────────────────────────────────────────────────
const chamadas = [];
// Ajustáveis por cenário: o contexto de quem escreve (null = pessoa nova) e a resposta da reserva.
let contextoMock = null;
let anthropicResponde = false;   // false = o modelo devolve vazio (cai na frase segura)
let claimMock = { ok: true, id: "22222222-2222-2222-2222-222222222222" };
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  let body = {};
  try { body = JSON.parse(init.body || "{}"); } catch { /* corpo em form/texto */ }
  chamadas.push({ url: u, body });

  if (u.includes("/rpc/meta_tenant_for_page")) {
    return new Response(JSON.stringify({
      client_email: "cliente@exemplo.com", page_access_token: "TOKEN_DO_CLIENTE",
      ig_id: IG_CONTA, page_id: "PAGINA", business: "Salão Exemplo",
    }), { status: 200 });
  }
  if (u.includes("/rpc/meta_campanhas_ativas")) {
    return new Response(JSON.stringify([{
      id: "11111111-1111-1111-1111-111111111111", active: true, media_id: "POST_DO_REEL",
      keywords: ["preço"], match_mode: "palavra", created_at: "2026-08-01",
      dm_text: "Oi {nome}! O preço é R$120. Quer que a gente te ligue?",
      link_url: "https://www.guileoai.com/lp/salao", public_reply: "te mandei no direct 💛",
    }]), { status: 200 });
  }
  if (u.includes("/rpc/get_client_profile")) {
    return new Response(JSON.stringify({ business_name: "Salão Exemplo", lang: "pt" }), { status: 200 });
  }
  if (u.includes("/rpc/meta_comment_claim")) {
    return new Response(JSON.stringify(claimMock), { status: 200 });
  }
  if (anthropicResponde && u.includes("api.anthropic.com")) {
    return new Response(JSON.stringify({ content: [{ type: "text", text: "Para 2 pessoas fica R$240 — quer agendar?" }], stop_reason: "end_turn" }), { status: 200 });
  }
  if (u.includes("/rpc/direct_contexto_pessoa")) {
    return new Response(JSON.stringify(contextoMock), { status: 200 });
  }
  // qualquer outra RPC (ingest_client_event, crm_upsert_contact, …) e o Graph
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};

const { onRequestPost } = await import("../api/meta-webhook.js");

// ── o payload EXATO de um comentário de Instagram ────────────────────────────────────────────
function payloadComentario(texto, extra = {}) {
  return JSON.stringify({
    object: "instagram",
    entry: [{
      id: IG_CONTA, time: 1756200000,
      changes: [{
        field: "comments",
        value: {
          id: COMMENT_ID, text: texto,
          from: { id: PESSOA, username: "ana.silva" },
          media: { id: "POST_DO_REEL", media_product_type: "REELS", ...(extra.media || {}) },
        },
      }],
    }],
  });
}

async function dispara(raw) {
  chamadas.length = 0;
  const sig = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(raw).digest("hex");
  const req = new Request("https://www.guileoai.com/api/meta-webhook", {
    method: "POST", headers: { "X-Hub-Signature-256": sig, "Content-Type": "application/json" }, body: raw,
  });
  const espera = [];
  const res = await onRequestPost({
    request: req,
    env: { META_APP_ID: "app", META_APP_SECRET: APP_SECRET, INGEST_SECRET: INGEST, SCHED_SECRET: "x" },
    waitUntil: (p) => espera.push(p),
  });
  await Promise.all(espera); // o trabalho roda DEPOIS do 200 — sem isto o teste mede o nada
  return res;
}

const dmEnviado = () => chamadas.find((c) => /\/messages\?access_token=/.test(c.url) && c.body?.recipient?.comment_id);

console.log("\n— o caminho feliz: comentou a palavra, recebeu o direct —");
let res = await dispara(payloadComentario("Quanto é o preço?"));
ok(res.status === 200, "a Meta recebe 200 (senão ela reentrega e depois para de entregar)");
const dm = dmEnviado();
ok(!!dm, "saiu um private reply pro Graph");
// ⚠️ O NÓ CERTO É O page_id, e isso foi MEDIDO, não escolhido (2026-08-27, 10:54). O 1º DM real
// recusou em /{ig_id}/messages com "(#3) Application does not have the capability to make this API
// call" — que é o que a Meta devolve quando se chama o nó do OUTRO caminho de conexão. No nosso
// (Instagram Messaging via Facebook Login, token de Página) o nó é a PÁGINA. O ig_id continua no
// código como reserva, para o dia de um cliente conectado via Instagram Login.
ok(dm && dm.url.includes("/PAGINA/messages"), "private reply endereçado à PÁGINA (o nó do caminho Facebook-Login)");
ok(dm && !dm.url.includes("/me/messages"), "e nunca a /me, que é o caminho da DM normal");
ok(dm && dm.body.recipient.comment_id === COMMENT_ID, "o destinatário é o COMENTÁRIO (recipient.comment_id)");
ok(dm && dm.body.message.text.startsWith("Oi @ana.silva!"), "{nome} virou o @ de quem comentou");
ok(dm && dm.body.message.text.includes("https://www.guileoai.com/lp/salao"), "o link entrou no DM");
ok(chamadas.some((c) => /\/POST_DO_REEL|\/17999999999999999\/replies/.test(c.url)), "a resposta pública foi publicada sob o comentário");
ok(chamadas.some((c) => c.url.includes("/rpc/meta_comment_claim")), "passou pela reserva atômica ANTES de enviar");

console.log("\n— o que NÃO pode virar DM —");
res = await dispara(payloadComentario("que reel lindo, parabéns!"));
ok(res.status === 200 && !dmEnviado(), "comentário sem palavra-chave: 200 e NENHUM direct");

res = await dispara(JSON.stringify({
  object: "instagram",
  entry: [{ id: IG_CONTA, changes: [{ field: "comments", value: {
    id: COMMENT_ID, text: "preço", from: { id: IG_CONTA, username: "o_proprio_salao" },
    media: { id: "POST_DO_REEL" } } }] }],
}));
ok(!dmEnviado(), "o próprio dono comentando NÃO dispara (a Meta recusa DM pra si mesmo)");

console.log("\n— assinatura: o portão que impede um DM forjado —");
const raw = payloadComentario("preço");
const reqRuim = new Request("https://www.guileoai.com/api/meta-webhook", {
  method: "POST", headers: { "X-Hub-Signature-256": "sha256=" + "0".repeat(64) }, body: raw,
});
chamadas.length = 0;
const esperaRuim = [];
const resRuim = await onRequestPost({
  request: reqRuim, env: { META_APP_ID: "app", META_APP_SECRET: APP_SECRET, INGEST_SECRET: INGEST },
  waitUntil: (p) => esperaRuim.push(p),
});
await Promise.all(esperaRuim);
ok(resRuim.status === 401, "assinatura errada → 401, e nada é processado");
ok(!dmEnviado(), "payload forjado não gera direct nenhum");
// 🚨 O 401 MUDO foi o que escondeu a falha do 1º teste real (27/08): a Meta entregava, a
// assinatura não batia, e o resultado era idêntico a "ninguém comentou". Recusar é certo;
// recusar em silêncio não é.
ok(chamadas.some((c) => JSON.stringify(c.body || {}).includes("meta_assinatura_recusada")),
   "a recusa por assinatura GRITA (emitFailure), em vez de sumir");

console.log("\n— o post IMPULSIONADO (o dia em que o dono anuncia) —");
res = await dispara(payloadComentario("preço", { media: { id: "MEDIA_DO_ANUNCIO", original_media_id: "POST_DO_REEL" } }));
ok(!!dmEnviado(), "comentário no post promovido AINDA dispara, pelo original_media_id");

console.log("\n— REGRESSÃO: a DM normal (o que já estava no ar) continua funcionando —");
res = await dispara(JSON.stringify({
  object: "instagram",
  entry: [{ id: IG_CONTA, messaging: [{
    sender: { id: PESSOA }, recipient: { id: IG_CONTA },
    message: { mid: "mid.abc", text: "oi, vocês abrem sábado?" },
  }] }],
}));
ok(res.status === 200, "DM de entrada ainda responde 200");
ok(chamadas.some((c) => c.url.includes("/rpc/meta_tenant_for_page")), "o caminho de DM ainda descobre o tenant — o ramo novo não roubou o antigo");
ok(!dmEnviado(), "a DM normal NÃO usa private-reply (ela vai por /me/messages, caminho separado)");

console.log("\n— REEL COMPARTILHADO: a pergunta de preço chega inteira ao cérebro —");
// Nasceu de 02/09: 4 compartilhamentos no @chigotravels, 4 respostas "não consigo abrir".
async function disparaCom(raw, extraEnv = {}) {
  chamadas.length = 0;
  const sig = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(raw).digest("hex");
  const req = new Request("https://www.guileoai.com/api/meta-webhook", {
    method: "POST", headers: { "X-Hub-Signature-256": sig, "Content-Type": "application/json" }, body: raw,
  });
  const espera = [];
  const r = await onRequestPost({
    request: req,
    env: { META_APP_ID: "app", META_APP_SECRET: APP_SECRET, INGEST_SECRET: INGEST, SCHED_SECRET: "x", ...extraEnv },
    waitUntil: (pr) => espera.push(pr),
  });
  await Promise.all(espera);
  return r;
}
const dmDeEntrada = (message) => JSON.stringify({
  object: "instagram",
  entry: [{ id: IG_CONTA, messaging: [{ sender: { id: PESSOA }, recipient: { id: IG_CONTA }, message }] }],
});
const REEL = { type: "ig_reel", payload: { title: "Pacote Cancún 7 noites", url: "https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=1&signature=segredo", reel_video_id: "998877" } };
const aoModelo = () => chamadas.filter((c) => c.url.includes("api.anthropic.com")).map((c) => JSON.stringify(c.body?.messages || [])).join(" ");

res = await disparaCom(dmDeEntrada({ mid: "mid.reel1", text: "quanto custa isso?", attachments: [REEL] }), { ANTHROPIC_API_KEY: "chave-teste" });
ok(res.status === 200, "DM com reel responde 200");
ok(aoModelo().length > 0, "🚨 texto + reel VAI ao cérebro (antes o reel era descartado em silêncio)");
ok(aoModelo().includes("quanto custa isso?") && aoModelo().includes("Pacote Cancún 7 noites"), "o modelo recebe a pergunta E a legenda do reel");
ok(chamadas.some((c) => /\/me\/messages\?access_token=/.test(c.url) && c.body?.recipient?.id === PESSOA), "a resposta sai pelo direct de quem perguntou");
const janela = chamadas.find((c) => c.url.includes("/rpc/ingest_client_event") && JSON.stringify(c.body || {}).includes("reel_video_id"));
ok(!!janela, "a janela: o formato real do anexo fica gravado no evento");
ok(!JSON.stringify(janela?.body || {}).includes("signature=segredo"), "…sem gravar a URL assinada da CDN");
const eventosEntrada = chamadas.filter((c) => c.url.includes("/rpc/ingest_client_event") && JSON.stringify(c.body || {}).includes("quanto custa isso?"));
ok(eventosEntrada.length === 1, "a mensagem aparece UMA vez no painel (o adapter grava; o webhook não duplica)");

res = await disparaCom(dmDeEntrada({ mid: "mid.reel2", attachments: [REEL] }), { ANTHROPIC_API_KEY: "chave-teste" });
ok(aoModelo().includes("Cancún"), "reel SOZINHO (sem texto) também vira pergunta com contexto");

console.log("\n— REGRESSÃO: foto continua no recado honesto (não finge que viu) —");
res = await disparaCom(dmDeEntrada({ mid: "mid.foto1", attachments: [{ type: "image", payload: { url: "https://lookaside.fbsbx.com/foto" } }] }), { ANTHROPIC_API_KEY: "chave-teste" });
ok(aoModelo().length === 0, "foto NÃO vai ao modelo (pergunta vazia vira resposta sem sentido)");
ok(chamadas.some((c) => /\/me\/messages\?access_token=/.test(c.url)), "…mas a pessoa ainda recebe o recado");

console.log("\n— STANDBY: outro app controla a conversa → a Gui NÃO fala por cima, mas o fato fica gravado —");
// Nasceu de 10/09: um reel mandado pro @chigotravels sumiu sem uma linha, e "a Meta não entregou"
// e "a Meta entregou pra outro app" eram o MESMO silêncio.
const emStandby = (message) => JSON.stringify({
  object: "instagram",
  entry: [{ id: IG_CONTA, standby: [{ sender: { id: PESSOA }, recipient: { id: IG_CONTA }, message }] }],
});
res = await disparaCom(emStandby({ mid: "mid.sb1", text: "quanto custa?", attachments: [REEL] }), { ANTHROPIC_API_KEY: "chave-teste" });
ok(res.status === 200, "standby responde 200 (a Meta não pode reentregar em loop)");
ok(!chamadas.some((c) => /\/me\/messages\?access_token=/.test(c.url)), "standby NÃO responde no direct — o fio é de outro app");
ok(aoModelo().length === 0, "…e não gasta modelo");
const gritoStandby = chamadas.find((c) => JSON.stringify(c.body || {}).includes("meta_standby"));
ok(!!gritoStandby, "…mas GRAVA meta_standby em vez de sumir");
ok(JSON.stringify(gritoStandby?.body || {}).includes("ig_reel"), "…com o tipo do anexo, pra saber o que se perdeu");
res = await disparaCom(emStandby({ mid: "mid.sb2", text: "eco nosso", is_echo: true }));
ok(!chamadas.some((c) => JSON.stringify(c.body || {}).includes("meta_standby")), "eco em standby não vira alarme falso");

console.log("\n— GUILEO DIRECT: cada porta do funil vira uma linha com nome fixo —");
const etapas = () => chamadas.filter((c) => c.url.includes("/rpc/direct_evento")).map((c) => c.body);
const etapa = (nome) => etapas().find((b) => b.p_etapa === nome);
res = await dispara(payloadComentario("qual o preço?"));
ok(["comentario", "casou", "dm_enviado", "publica_ok"].every((e) => etapa(e)), "comentário que casou grava: comentario → casou → dm_enviado → publica_ok");
ok(etapa("casou")?.p_palavra === "preço" && etapa("casou")?.p_lang && etapa("casou")?.p_lang_via, "o 'casou' já nasce com a palavra, o idioma e o porquê do idioma");
ok(etapa("dm_enviado")?.p_campaign_id === "11111111-1111-1111-1111-111111111111", "…amarrado à campanha (é o que dá o funil POR campanha)");
ok(Number.isFinite(etapa("dm_enviado")?.p_ms), "…com o tempo nosso entre receber e entregar");
ok(etapas().every((b) => b.p_secret === INGEST && b.p_email === "cliente@exemplo.com"), "toda linha vai pro tenant certo, com o portão");
ok(!JSON.stringify(etapa("comentario") || {}).includes("qual o preço"), "o denominador NÃO grava o texto do comentário (só conta)");

console.log("\n— o carimbo: o lead que vem do DM deixa de chegar órfão —");
const textoDm = dmEnviado()?.body?.message?.text || "";
ok(textoDm.includes("utm_medium=direct") && textoDm.includes("utm_source=instagram"), "o link do DM sai carimbado como Direct");
ok(textoDm.includes("utm_campaign=11111111-1111-1111-1111-111111111111"), "…com o id da campanha (lead_attribution conta por campanha)");

console.log("\n— o freio segurou: vira porta 'segurado' com o motivo —");
claimMock = { ok: false, motivo: "muito_cedo" };
res = await dispara(payloadComentario("preço"));
ok(etapa("segurado")?.p_motivo === "muito_cedo" && !etapa("dm_enviado"), "segurado grava o motivo e NÃO finge envio");
claimMock = { ok: false, motivo: "duplicado" };
res = await dispara(payloadComentario("preço"));
ok(!etapa("segurado"), "reentrega da Meta (duplicado) não vira 'segurado' — não é notícia");
claimMock = { ok: true, id: "22222222-2222-2222-2222-222222222222" };

res = await dispara(payloadComentario("que lindo esse reel"));
ok(etapa("comentario") && !etapa("casou"), "comentário sem palavra-chave conta no denominador e para ali");

console.log("\n— a conversa: a Gui sabe de onde a pessoa veio —");
const dmDireto = (mid, text) => JSON.stringify({ object: "instagram",
  entry: [{ id: IG_CONTA, messaging: [{ sender: { id: PESSOA }, recipient: { id: IG_CONTA }, message: { mid, text } }] }] });
contextoMock = { quando: new Date(Date.now() - 3600e3).toISOString(), palavra: "preço", campanha: "Preço do corte" };
anthropicResponde = true;
res = await disparaCom(dmDireto("mid.ctx1", "e pra 2 pessoas?"), { ANTHROPIC_API_KEY: "chave-teste" });
anthropicResponde = false;
const sysEnviado = chamadas.filter((c) => c.url.includes("api.anthropic.com")).map((c) => String(c.body?.system || "")).join(" ");
ok(sysEnviado.includes("HOW THIS CONVERSATION STARTED") && sysEnviado.includes("Preço do corte"), "quem veio do comentário chega ao cérebro COM a origem, no prompt de sistema");
const msgsUser = chamadas.filter((c) => c.url.includes("api.anthropic.com")).map((c) => JSON.stringify(c.body?.messages || [])).join(" ");
ok(!msgsUser.includes("HOW THIS CONVERSATION STARTED"), "…e a origem NÃO entra como fala da cliente (nem vai pro feed do dono)");
ok(etapa("dm_recebida")?.p_pessoa === PESSOA, "a DM recebida grava QUEM — é o que liga comentário → conversa");
ok(etapa("dm_respondida")?.p_motivo === "anthropic" && Number.isFinite(etapa("dm_respondida")?.p_ms), "a resposta grava QUAL cérebro respondeu e em quanto tempo");

contextoMock = null;
res = await disparaCom(dmDireto("mid.ctx2", "oi, vocês abrem sábado?"), { ANTHROPIC_API_KEY: "chave-teste" });
ok(etapa("dm_respondida")?.p_motivo === "frase_segura", "modelo mudo → o funil diz 'frase_segura', não finge que a IA respondeu");
const sys2 = chamadas.filter((c) => c.url.includes("api.anthropic.com")).map((c) => String(c.body?.system || "")).join(" ");
ok(!sys2.includes("HOW THIS CONVERSATION STARTED"), "quem escreveu direto (sem comentário) não ganha origem inventada");

res = await disparaCom(JSON.stringify({ object: "instagram",
  entry: [{ id: IG_CONTA, standby: [{ sender: { id: PESSOA }, recipient: { id: IG_CONTA }, message: { mid: "mid.sb9", text: "oi" } }] }] }));
ok(etapa("standby"), "standby também é porta do funil (DM sem resposta por causa de OUTRO app, não nossa)");

console.log(falhas ? `\n❌ ${falhas} falha(s)\n` : "\n✅ meta-webhook: comentário → DM provado ponta a ponta\n");
process.exit(falhas ? 1 : 0);
