// src/lib/voiceWeb.js — a conversa por VOZ da Gui dentro do navegador. Zero dependência.
//
// POR QUE ESCRITO À MÃO E NÃO COM O SDK DO PROVEDOR
// A voz é trocável por contrato desta casa (ElevenLabs hoje, outro amanhã) — o cérebro é nosso.
// Um SDK de provedor no bundle da landing amarra as duas coisas e ainda entra no chunk global.
// O protocolo daqui é um WebSocket com mensagens JSON: cabe em um arquivo, é auditável, e trocar
// de provedor vira trocar este arquivo, não a página.
//
// O CAMINHO DO SOM, em uma frase: microfone → PCM 16-bit na taxa que o servidor pediu → base64 →
// WebSocket; e de volta: base64 → PCM → fila de reprodução agendada (sem estalo entre pedaços).
//
// A URL ASSINADA VEM DO NOSSO SERVIDOR (/api/voice-web) e vale 15 minutos pra UM agente. A chave
// da conta nunca passa por aqui — se um dia passar, é bug de segurança, não otimização.

const API = "/api/voice-web";

// ── SUPORTE DO NAVEGADOR ───────────────────────────────────────────────────────────────────
// Devolve o motivo EXATO quando não dá — a tela mostra o que fazer, e o caminho de texto/telefone
// continua à vista. Um botão de voz que não fala é pior que nenhum botão.
export function suporteDeVoz() {
  if (typeof window === "undefined") return { ok: false, motivo: "sem_navegador" };
  const seguro = window.isSecureContext || location.hostname === "localhost";
  if (!seguro) return { ok: false, motivo: "inseguro" };            // microfone exige https
  if (typeof WebSocket === "undefined") return { ok: false, motivo: "sem_ws" };
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return { ok: false, motivo: "sem_audio" };
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return { ok: false, motivo: "sem_mic" };
  return { ok: true, motivo: "" };
}

// ── base64 ↔ bytes ─────────────────────────────────────────────────────────────────────────
function paraB64(bytes) {
  let s = "";
  const passo = 0x8000; // String.fromCharCode estoura a pilha com arrays grandes
  for (let i = 0; i < bytes.length; i += passo) s += String.fromCharCode.apply(null, bytes.subarray(i, i + passo));
  return btoa(s);
}
function deB64(str) {
  const bin = atob(str);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}

// ── μ-law (só se o agente estiver configurado em ulaw_8000; PCM é o caminho normal) ─────────
function ulawParaPcm(u) {
  u = ~u & 0xff;
  const sinal = u & 0x80, exp = (u >> 4) & 0x07, man = u & 0x0f;
  // G.711: ((mantissa*8) + BIAS) << expoente, menos o BIAS. A versão "de memória" deste cálculo
  // (com 33 no lugar de 0x84) devolve um sinal 4× fora de escala — e ninguém vê, só ouve chiado.
  let v = (((man << 3) + 0x84) << exp) - 0x84;
  return sinal ? -v : v;
}
function pcmParaUlaw(s) {
  const BIAS = 0x84, MAX = 32635;
  let sinal = (s >> 8) & 0x80;
  if (sinal) s = -s;
  if (s > MAX) s = MAX;
  s += BIAS;
  let exp = 7;
  for (let m = 0x4000; (s & m) === 0 && exp > 0; exp--, m >>= 1);
  const man = (s >> (exp + 3)) & 0x0f;
  return ~(sinal | (exp << 4) | man) & 0xff;
}

// "pcm_16000" | "ulaw_8000" → { tipo, taxa }
function lerFormato(txt, padrao = { tipo: "pcm", taxa: 16000 }) {
  const m = /^(pcm|ulaw)_(\d+)$/.exec((txt || "").toString());
  return m ? { tipo: m[1], taxa: parseInt(m[2], 10) } : padrao;
}

// Superfície de teste (functions/lib/vozWeb.test.mjs). Áudio errado não estoura: sai silêncio,
// chiado ou voz de robô — coisas que só aparecem numa ligação real com um cliente na linha.
// Por isso a matemática do som é testada fora do navegador.
export const _interno = { lerFormato, ulawParaPcm, pcmParaUlaw, paraB64, deB64 };

// ── INICIAR ────────────────────────────────────────────────────────────────────────────────
// iniciarVoz({ slug, onEstado, onFala, onFim })
//   onEstado("pedindo_mic" | "conectando" | "ouvindo" | "falando")
//   onFala({ quem: "gui" | "pessoa", texto })
//   onFim({ motivo, detalhe })   motivo: "encerrado" | "tempo" | "erro" | "recusado"
// Devolve { encerrar, segundos, maxSegundos } — ou lança { reason } quando o servidor recusa
// (no_key / no_agent / no_site / rate_limited / daily_minutes / …), pra tela dizer a verdade.
export async function iniciarVoz({ slug, onEstado = () => {}, onFala = () => {}, onFim = () => {} }) {
  const sup = suporteDeVoz();
  if (!sup.ok) { const e = new Error(sup.motivo); e.reason = sup.motivo; throw e; }

  // 1) O SERVIDOR decide de quem é a voz, se pode gastar minuto, e emite a credencial curta.
  const r = await fetch(API, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "start", slug }),
  }).catch(() => null);
  const d = r ? await r.json().catch(() => null) : null;
  if (!d || d.ok !== true) {
    const e = new Error(d?.reason || "sem_resposta");
    e.reason = d?.reason || "sem_resposta";
    e.restante = d?.restante_hoje ?? null;
    throw e;
  }

  const sessao = d.session_id;
  const maxSegundos = Math.max(30, Math.min(parseInt(d.max_seconds, 10) || 240, 1800));

  // 2) Microfone. A recusa do usuário é um estado legítimo, não um erro do produto.
  onEstado("pedindo_mic");
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch { const e = new Error("mic_negado"); e.reason = "mic_negado"; throw e; }

  const AC = window.AudioContext || window.webkitAudioContext;
  const ctxIn = new AC();
  const ctxOut = new AC();
  try { await ctxIn.resume(); await ctxOut.resume(); } catch { /* alguns navegadores só retomam no gesto — já estamos em um */ }

  let ws = null, no, fonte = null, worklet = null, script = null;
  let vivo = true, comecou = Date.now(), fim = null;
  let fmtEnvio = { tipo: "pcm", taxa: 16000 };
  let fmtVolta = { tipo: "pcm", taxa: 16000 };
  let cursor = 0;                    // quando o próximo pedaço de fala deve tocar
  let tocando = [];                  // fontes agendadas (pra cortar na interrupção)
  let resto = new Float32Array(0);   // sobra da reamostragem entre pedaços
  let relogio = null, limite = null;

  const segundos = () => Math.round((Date.now() - comecou) / 1000);

  // Fecha tudo UMA vez e devolve o minuto não usado pro livro-caixa. Este avisa o servidor
  // mesmo quando a aba morre (sendBeacon), senão a cota do cliente ficaria presa no teto.
  function encerrar(motivo = "encerrado", detalhe = "") {
    if (!vivo) return;
    vivo = false;
    const usados = segundos();
    try { clearInterval(relogio); } catch { /* */ }
    try { clearTimeout(limite); } catch { /* */ }
    try { tocando.forEach((s) => { try { s.stop(); } catch { /* */ } }); } catch { /* */ }
    tocando = [];
    try { if (worklet) { worklet.port.onmessage = null; worklet.disconnect(); } } catch { /* */ }
    try { if (script) { script.onaudioprocess = null; script.disconnect(); } } catch { /* */ }
    try { if (fonte) fonte.disconnect(); } catch { /* */ }
    try { stream.getTracks().forEach((t) => t.stop()); } catch { /* */ }
    try { if (ws && ws.readyState <= 1) ws.close(); } catch { /* */ }
    try { ctxIn.close(); } catch { /* */ }
    try { ctxOut.close(); } catch { /* */ }
    window.removeEventListener("pagehide", aoSair);
    const corpo = JSON.stringify({ action: "end", session_id: sessao, seconds: usados, conversation_id: fim || "" });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon(API, new Blob([corpo], { type: "application/json" }));
      else fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: corpo, keepalive: true }).catch(() => {});
    } catch { /* a reserva expira sozinha no fim do dia; nunca travar a UI por isto */ }
    onFim({ motivo, detalhe, segundos: usados });
  }
  const aoSair = () => encerrar("encerrado");
  window.addEventListener("pagehide", aoSair);

  // ── ENVIO: reamostra pro que o servidor pediu e manda em pedaços curtos (latência baixa) ──
  function mandarAudio(f32) {
    if (!vivo || !ws || ws.readyState !== 1) return;
    const razao = ctxIn.sampleRate / fmtEnvio.taxa;
    const total = resto.length + f32.length;
    const junto = new Float32Array(total);
    junto.set(resto, 0); junto.set(f32, resto.length);
    const saida = new Int16Array(Math.floor(total / razao));
    let n = 0, p = 0;
    while (Math.floor(p + razao) < total) {
      // média da janela: um decimador cru vira chiado em taxa alta (48k → 16k)
      let soma = 0, c = 0;
      for (let i = Math.floor(p); i < Math.floor(p + razao) && i < total; i++) { soma += junto[i]; c++; }
      const v = c ? soma / c : 0;
      saida[n++] = Math.max(-1, Math.min(1, v)) * 0x7fff;
      p += razao;
    }
    const consumido = Math.floor(p);
    resto = junto.slice(consumido);
    if (!n) return;
    const usada = saida.subarray(0, n);
    let bytes;
    if (fmtEnvio.tipo === "ulaw") {
      bytes = new Uint8Array(n);
      for (let i = 0; i < n; i++) bytes[i] = pcmParaUlaw(usada[i]);
    } else {
      bytes = new Uint8Array(usada.buffer, usada.byteOffset, n * 2); // little-endian: o do navegador
    }
    try { ws.send(JSON.stringify({ user_audio_chunk: paraB64(bytes) })); } catch { /* socket caindo */ }
  }

  // ── RECEBIMENTO: agenda cada pedaço na fila, sem buraco entre eles ────────────────────────
  function tocar(b64) {
    if (!vivo) return;
    const bytes = deB64(b64);
    let f32;
    if (fmtVolta.tipo === "ulaw") {
      f32 = new Float32Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) f32[i] = ulawParaPcm(bytes[i]) / 32768;
    } else {
      const n = Math.floor(bytes.length / 2);
      const dv = new DataView(bytes.buffer, bytes.byteOffset, n * 2);
      f32 = new Float32Array(n);
      for (let i = 0; i < n; i++) f32[i] = dv.getInt16(i * 2, true) / 32768;
    }
    if (!f32.length) return;
    const buf = ctxOut.createBuffer(1, f32.length, fmtVolta.taxa);
    buf.getChannelData(0).set(f32);
    const src = ctxOut.createBufferSource();
    src.buffer = buf;
    src.connect(ctxOut.destination);
    const agora = ctxOut.currentTime;
    if (cursor < agora) cursor = agora + 0.05;   // pequena folga contra estalo no 1º pedaço
    src.start(cursor);
    cursor += buf.duration;
    tocando.push(src);
    src.onended = () => { tocando = tocando.filter((s) => s !== src); };
  }

  // ── SOCKET ───────────────────────────────────────────────────────────────────────────────
  onEstado("conectando");
  ws = new WebSocket(d.signed_url);

  ws.onopen = () => {
    // Nada de override de prompt/voz daqui: o cérebro do agente é do SERVIDOR. O navegador só
    // se apresenta. Mandar override exigiria destravar isso no painel do provedor — ou seja,
    // deixar qualquer visitante reescrever o prompt do agente pelo console.
    try { ws.send(JSON.stringify({ type: "conversation_initiation_client_data", source_info: { source: "guileo_web", version: "1" } })); } catch { /* */ }
  };

  ws.onmessage = (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    switch (m.type) {
      case "conversation_initiation_metadata": {
        const meta = m.conversation_initiation_metadata_event || {};
        fmtEnvio = lerFormato(meta.user_input_audio_format, fmtEnvio);
        fmtVolta = lerFormato(meta.agent_output_audio_format, fmtVolta);
        fim = (meta.conversation_id || "").toString().slice(0, 80);
        onEstado("ouvindo");
        break;
      }
      case "audio":
        onEstado("falando");
        tocar((m.audio_event && m.audio_event.audio_base_64) || "");
        break;
      case "agent_response":
        onFala({ quem: "gui", texto: ((m.agent_response_event && m.agent_response_event.agent_response) || "").toString() });
        break;
      case "user_transcript":
        onFala({ quem: "pessoa", texto: ((m.user_transcription_event && m.user_transcription_event.user_transcript) || "").toString() });
        break;
      case "agent_response_complete":
        onEstado("ouvindo");
        break;
      case "interruption":
        // A pessoa falou por cima: cala a fila NA HORA, senão a Gui continua respondendo sozinha.
        tocando.forEach((s) => { try { s.stop(); } catch { /* */ } });
        tocando = []; cursor = 0;
        onEstado("ouvindo");
        break;
      case "ping":
        try { ws.send(JSON.stringify({ type: "pong", event_id: m.ping_event && m.ping_event.event_id })); } catch { /* */ }
        break;
      default:
        break;
    }
  };

  ws.onerror = () => { if (vivo) encerrar("erro", "conexão"); };
  ws.onclose = () => { if (vivo) encerrar("encerrado", "fim"); };

  // ── CAPTURA ──────────────────────────────────────────────────────────────────────────────
  fonte = ctxIn.createMediaStreamSource(stream);
  const codigoWorklet = `class GuiCap extends AudioWorkletProcessor{
    process(inputs){const c=inputs[0]&&inputs[0][0];if(c&&c.length)this.port.postMessage(new Float32Array(c));return true}
  }registerProcessor('gui-cap',GuiCap)`;
  let usouWorklet = false;
  if (ctxIn.audioWorklet) {
    try {
      const url = URL.createObjectURL(new Blob([codigoWorklet], { type: "application/javascript" }));
      await ctxIn.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      worklet = new AudioWorkletNode(ctxIn, "gui-cap");
      worklet.port.onmessage = (e) => mandarAudio(e.data);
      fonte.connect(worklet);
      // Worklet sem destino é podado em alguns navegadores; ganho zero mantém vivo e mudo.
      no = ctxIn.createGain(); no.gain.value = 0;
      worklet.connect(no); no.connect(ctxIn.destination);
      usouWorklet = true;
    } catch { usouWorklet = false; }
  }
  if (!usouWorklet) {
    // Caminho antigo (depreciado, mas ainda o único em alguns navegadores) — melhor um pouco
    // mais de latência do que um botão que não fala.
    script = ctxIn.createScriptProcessor(4096, 1, 1);
    script.onaudioprocess = (e) => mandarAudio(new Float32Array(e.inputBuffer.getChannelData(0)));
    fonte.connect(script);
    no = ctxIn.createGain(); no.gain.value = 0;
    script.connect(no); no.connect(ctxIn.destination);
  }

  // ── TETO DE TEMPO ────────────────────────────────────────────────────────────────────────
  // O teto real mora no banco (a reserva já foi debitada); este é o corte educado na tela, pra
  // conversa terminar com aviso em vez de sumir.
  limite = setTimeout(() => encerrar("tempo"), maxSegundos * 1000);

  return {
    encerrar: () => encerrar("encerrado"),
    segundos,
    maxSegundos,
    marca: { business: d.business || "", lang: d.lang || "", color: d.color || "", logo: d.logo || "", phone: d.phone || "" },
  };
}
