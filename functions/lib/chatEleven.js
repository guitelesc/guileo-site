// CHAT MODE — A MESMA GUI DA VOZ, RESPONDENDO POR TEXTO
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ISTO EXISTE (2026-08-25, ideia do Luis)
// A plataforma tinha DUAS Guis: a da voz (ElevenLabs — com o KB do cliente, os preços, as lições
// versionadas e as ferramentas de agendar/cobrar) e a do texto (Anthropic — com um prompt montado
// à parte). Duas mentes para a mesma pessoa é ruim de duas maneiras: o cliente conhece
// personalidades diferentes conforme o canal, e cada melhoria precisa ser feita duas vezes.
//
// Na madrugada de 25/08 o defeito virou apagão: a conta da Anthropic zerou e TODO canal de texto
// passou a responder a frase de handoff — inclusive para um áudio de WhatsApp que a plataforma
// tinha acabado de transcrever corretamente. A voz, ao lado, continuava perfeita.
//
// O «Chat Mode» da ElevenLabs é o MESMO motor do agente sem áudio. Não confundir com
// `simulate-conversation`: aquele é o avaliador e FINGE as ferramentas — ele escreveria "agendei"
// sem tocar no nosso webhook, que é o pior defeito imaginável nesta casa. Aqui as ferramentas
// executam de verdade, porque é o agente de produção atendendo.
//
// ── AS TRÊS ARMADILHAS QUE ESTE ARQUIVO TRATA ────────────────────────────────────────────────────
// 1. PRAZO. Um WebSocket sem relógio pendura a resposta do canal inteiro. Tudo aqui corre contra um
//    teto e devolve `{ ok:false, motivo }` — nunca uma promessa que não chega.
// 2. OVERRIDE PODE SER PROIBIDO. `text_only` só vale se o agente permitir sobrescrita; se não
//    permitir, a conexão é RECUSADA. Então tentamos com override e, se cair, repetimos sem ele e
//    simplesmente ignoramos os pedaços de áudio — o texto vem igual.
// 3. TEXTO VAZIO É FALHA. Conexão aberta e zero `agent_response` é fracasso, não sucesso silencioso.
//    Devolver "" faria o canal mandar mensagem em branco para um cliente real.

const API = "https://api.elevenlabs.io";

// A URL assinada é o caminho documentado para servidor: a chave nunca viaja no upgrade do socket.
async function urlAssinada(env, agentId) {
  try {
    const r = await fetch(`${API}/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
    if (!r.ok) return { erro: `assinatura recusada (HTTP ${r.status})`, detalhe: (await r.text().catch(() => "")).slice(0, 200) };
    const d = await r.json().catch(() => null);
    return d?.signed_url ? { url: d.signed_url } : { erro: "assinatura veio sem signed_url" };
  } catch (e) { return { erro: `assinatura falhou: ${(e && e.message) || "rede"}` }; }
}

// Abre o socket no runtime do Cloudflare. `fetch` com Upgrade devolve o socket em `resp.webSocket`
// — não existe construtor `new WebSocket()` aqui, e essa é a pegadinha número um de quem porta
// código de Node para Worker.
async function abrir(url) {
  // ⚠️ `wss://` NÃO PASSA no fetch do Cloudflare — ele responde "Fetch API cannot load" e parece
  // erro de credencial. O upgrade se pede em `https://`; o protocolo do socket é o mesmo. Foi
  // exatamente isto que quebrou a 1ª prova em produção, com a URL assinada já válida na mão.
  const resp = await fetch(url.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://"),
    { headers: { Upgrade: "websocket" } });
  if (!resp.webSocket) throw new Error(`sem socket (HTTP ${resp.status})`);
  resp.webSocket.accept();
  return resp.webSocket;
}

function umaRodada(ws, { texto, vars, override, tetoMs }) {
  return new Promise((resolve) => {
    let pedacos = [];
    let convId = null;
    let acabou = false;
    const fim = (r) => { if (acabou) return; acabou = true; clearTimeout(relogio); try { ws.close(1000, "fim"); } catch { /* já fechado */ } resolve(r); };
    const relogio = setTimeout(() => {
      // Estourou o prazo COM texto na mão? Entrega o que tem — meia resposta serve, silêncio não.
      fim(pedacos.length ? { ok: true, texto: pedacos.join(" ").trim(), conversation_id: convId, parcial: true }
        : { ok: false, motivo: `sem resposta em ${Math.round(tetoMs / 1000)}s` });
    }, tetoMs);

    ws.addEventListener("error", () => fim({ ok: false, motivo: "socket caiu" }));
    ws.addEventListener("close", (ev) => {
      // Fechar ANTES de qualquer `agent_response` normalmente é override proibido — o chamador
      // precisa distinguir isso de "o agente não teve o que dizer" para poder tentar de novo.
      if (pedacos.length) return fim({ ok: true, texto: pedacos.join(" ").trim(), conversation_id: convId });
      fim({ ok: false, motivo: `fechou sem responder (code ${ev?.code ?? "?"})`, recusou: (ev?.code ?? 0) !== 1000 });
    });

    ws.addEventListener("message", (ev) => {
      let m; try { m = JSON.parse(typeof ev.data === "string" ? ev.data : ""); } catch { return; }
      if (!m || !m.type) return;
      // O ping É obrigatório: sem o pong o servidor derruba a conexão no meio da resposta.
      if (m.type === "ping") { try { ws.send(JSON.stringify({ type: "pong", event_id: m.ping_event?.event_id })); } catch { /* já caiu */ } return; }
      if (m.type === "conversation_initiation_metadata") { convId = m.conversation_initiation_metadata_event?.conversation_id || null; return; }
      if (m.type === "agent_response") {
        const t = (m.agent_response_event?.agent_response || "").toString().trim();
        if (t) pedacos.push(t);
        return;
      }
      // Turno encerrado: é aqui que a gente sai, não no timeout.
      if (m.type === "agent_response_complete" && pedacos.length) {
        fim({ ok: true, texto: pedacos.join(" ").trim(), conversation_id: convId });
      }
      // `audio`, `user_transcript`, `vad_score`, `internal_*` → ignorados de propósito.
    });

    try {
      const init = { type: "conversation_initiation_client_data", dynamic_variables: vars || {} };
      if (override) init.conversation_config_override = { conversation: { text_only: true } };
      ws.send(JSON.stringify(init));
      ws.send(JSON.stringify({ type: "user_message", text: texto, source_medium: "text" }));
    } catch (e) { fim({ ok: false, motivo: `não consegui enviar: ${(e && e.message) || "?"}` }); }
  });
}

/**
 * Pergunta ao agente de VOZ do cliente, por texto.
 * @returns {Promise<{ok:boolean, texto?:string, conversation_id?:string|null, motivo?:string, tentativas:string[]}>}
 * `ok:false` é sempre acompanhado de `motivo` legível — nunca de uma string vazia passando por sucesso.
 */
export async function falarComAgente(env, { agentId, texto, vars = {}, tetoMs = 20000 } = {}) {
  const tentativas = [];
  if (!env?.ELEVENLABS_API_KEY) return { ok: false, motivo: "ELEVENLABS_API_KEY ausente", tentativas };
  if (!agentId) return { ok: false, motivo: "sem agent_id", tentativas };
  const msg = (texto || "").toString().trim().slice(0, 2000);
  if (!msg) return { ok: false, motivo: "mensagem vazia", tentativas };

  const a = await urlAssinada(env, agentId);
  if (a.erro) return { ok: false, motivo: a.erro, detalhe: a.detalhe, tentativas };

  // 1ª tentativa COM override (não gasta áudio). 2ª sem ele, para agentes que proíbem sobrescrita.
  for (const override of [true, false]) {
    let ws;
    try { ws = await abrir(a.url); }
    catch (e) { tentativas.push(`${override ? "com" : "sem"} override: ${(e && e.message) || "abrir falhou"}`); continue; }
    const r = await umaRodada(ws, { texto: msg, vars, override, tetoMs });
    if (r.ok) return { ...r, override_usado: override, tentativas };
    tentativas.push(`${override ? "com" : "sem"} override: ${r.motivo}`);
    // Só vale repetir se a RECUSA veio do override; um estouro de prazo repetido dobra a espera.
    if (!r.recusou) break;
  }
  return { ok: false, motivo: tentativas[tentativas.length - 1] || "não consegui falar com o agente", tentativas };
}
