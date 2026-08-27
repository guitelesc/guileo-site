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
    // ⚠️ COM PRAZO. Numa queda da ElevenLabs em 25/08 este fetch levou 30 SEGUNDOS para devolver
    // 500 — mais que o teto da conversa inteira. Quem estava do outro lado era alguém esperando uma
    // resposta no WhatsApp: meio minuto de silêncio e a pessoa já foi embora. Falhar rápido não é
    // desistir cedo, é liberar o canal para a frase honesta de handoff enquanto ainda importa.
    const r = await fetch(`${API}/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      { headers: { "xi-api-key": env.ELEVENLABS_API_KEY }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { erro: `assinatura recusada (HTTP ${r.status})`, detalhe: (await r.text().catch(() => "")).slice(0, 200) };
    const d = await r.json().catch(() => null);
    return d?.signed_url ? { url: d.signed_url } : { erro: "assinatura veio sem signed_url" };
  } catch (e) { const n = (e && e.name) === "TimeoutError"; return { erro: n ? "a ElevenLabs não assinou em 8s" : `assinatura falhou: ${(e && e.message) || "rede"}` }; }
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
    const pedacos = [];
    let convId = null;
    let acabou = false;
    // ── POR QUE ESTE ESTADO EXISTE: O AGENTE FALA PRIMEIRO ───────────────────────────────────────
    // Ele foi desenhado para o TELEFONE, onde quem atende cumprimenta antes de ouvir. Então a
    // primeira `agent_response` é a saudação — a resposta à NOSSA pergunta é a segunda. A versão
    // anterior mandava a pergunta junto com a abertura, capturava a saudação e ia embora: devolveu
    // "Thank you for calling Guileo, this is Gui. How can I take care of you today?" para quem
    // tinha perguntado o preço. Rápido (2,1s) e inútil.
    // Agora são duas fases: deixa a saudação passar (e a DESCARTA — num canal de texto ela é ruído,
    // ninguém "ligou"), e só então faz a pergunta. Se o agente não tiver saudação, uma janela curta
    // expira e a pergunta vai do mesmo jeito — nenhum agente fica esperando por algo que não vem.
    let fase = "saudacao";
    let quieto = null, abertura = null;
    const fim = (r) => {
      if (acabou) return; acabou = true;
      clearTimeout(relogio); clearTimeout(quieto); clearTimeout(abertura);
      try { ws.close(1000, "fim"); } catch { /* já fechado */ }
      resolve(r);
    };
    const entregar = () => fim(pedacos.length
      ? { ok: true, texto: pedacos.join(" ").trim(), conversation_id: convId }
      : { ok: false, motivo: "o agente não respondeu à pergunta", conversation_id: convId });

    // Chegou texto → abre uma janela curta; se nada mais vier, o turno acabou. Necessário porque no
    // modo texto o `agent_response_complete` não vem, e esperar por ele custava 25s por mensagem.
    const silencio = () => { clearTimeout(quieto); quieto = setTimeout(entregar, 1800); };

    const perguntar = () => {
      if (fase !== "saudacao" || acabou) return;
      fase = "pergunta";
      clearTimeout(abertura);
      try {
        // ── AVISA QUE ISTO NÃO É UMA LIGAÇÃO ────────────────────────────────────────────────────
        // O agente é o mesmo do telefone e escreve como quem FALA: a 1ª prova devolveu "cento e
        // quarenta e nove dólares" (certo para TTS, errado para WhatsApp, onde se escreve $149) e
        // abriu com "Thank you for calling". `contextual_update` entrega esse contexto SEM gastar um
        // turno e SEM tocar na configuração do agente — nada aqui altera o que atende no telefone,
        // que é justamente o que não pode quebrar. Vale só para esta conversa.
        // ⚠️ O IDIOMA É DITO, NÃO ADIVINHADO. Medido em 25/08 no agente da Chigo (base pt-br): a
        // MESMA pergunta em inglês voltou 2× em inglês e 1× em português. Não é falha, é
        // MOEDA — e no canal de texto o cliente que escreve em inglês e recebe português some.
        // O agente tem a regra "responda no idioma do cliente", mas regra que depende de o modelo
        // reparar é sugestão; às vezes ele cai no idioma-base. Aqui do lado de cá eu JÁ SEI em que
        // idioma a mensagem chegou (o canal informa), então eu nomeio o idioma em vez de torcer.
        // A mensagem ainda manda: se ela vier em outro idioma, ela vence — o `lang` do canal pode
        // ser só o padrão da conta, e o cliente é quem decide como quer ser atendido.
        const IDIOMA = { pt: "Brazilian Portuguese", en: "English", es: "Spanish", hi: "Hindi",
          fr: "French", it: "Italian", de: "German" };
        const alvo = IDIOMA[String(vars?.lang || "").slice(0, 2).toLowerCase()] || "";
        const regraIdioma = alvo
          ? `The customer is writing in ${alvo} — reply in ${alvo}. If their message is clearly in another language, follow the message instead.`
          : "Reply in exactly the same language the customer wrote in.";
        ws.send(JSON.stringify({ type: "contextual_update",
          text: `SYSTEM: this conversation is happening over TEXT (WhatsApp/Instagram/web chat), not a phone call. Never say 'calling' or 'on the line'. Write numbers, prices and times as digits ($149, 2pm), never spelled out. Keep it short — 2 or 3 sentences, no greeting, they already said hello. ${regraIdioma}` }));
        ws.send(JSON.stringify({ type: "user_message", text: texto, source_medium: "text" }));
      } catch (e) { fim({ ok: false, motivo: `não consegui perguntar: ${(e && e.message) || "?"}` }); }
    };

    const relogio = setTimeout(() => {
      fim(pedacos.length ? { ok: true, texto: pedacos.join(" ").trim(), conversation_id: convId, parcial: true }
        : { ok: false, motivo: `sem resposta em ${Math.round(tetoMs / 1000)}s` });
    }, tetoMs);

    ws.addEventListener("error", () => fim({ ok: false, motivo: "socket caiu" }));
    ws.addEventListener("close", (ev) => {
      if (pedacos.length) return fim({ ok: true, texto: pedacos.join(" ").trim(), conversation_id: convId });
      fim({ ok: false, motivo: `fechou sem responder (code ${ev?.code ?? "?"})`, recusou: (ev?.code ?? 0) !== 1000 });
    });

    ws.addEventListener("message", (ev) => {
      let m; try { m = JSON.parse(typeof ev.data === "string" ? ev.data : ""); } catch { return; }
      if (!m || !m.type) return;
      // O pong é obrigatório: sem ele o servidor derruba a conexão no meio da resposta.
      if (m.type === "ping") { try { ws.send(JSON.stringify({ type: "pong", event_id: m.ping_event?.event_id })); } catch { /* já caiu */ } return; }
      if (m.type === "conversation_initiation_metadata") {
        convId = m.conversation_initiation_metadata_event?.conversation_id || null;
        // Agente sem saudação existe. A janela evita ficar esperando um cumprimento que não vem.
        abertura = setTimeout(perguntar, 2500);
        return;
      }
      if (m.type === "agent_response") {
        const t = (m.agent_response_event?.agent_response || "").toString().trim();
        if (fase === "saudacao") { perguntar(); return; }   // saudação descartada de propósito
        if (t) { pedacos.push(t); silencio(); }
        return;
      }
      if (m.type === "agent_response_complete" && pedacos.length) entregar();
    });

    try {
      const init = { type: "conversation_initiation_client_data", dynamic_variables: vars || {} };
      if (override) init.conversation_config_override = { conversation: { text_only: true } };
      ws.send(JSON.stringify(init));
    } catch (e) { fim({ ok: false, motivo: `não consegui abrir: ${(e && e.message) || "?"}` }); }
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
