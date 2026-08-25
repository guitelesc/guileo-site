// OUVIR O RECADO DE VOZ DO WHATSAPP — áudio que chega vira texto para o cérebro.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE EXISTE (2026-08-25, pedido do Luis: "conversar no whats por comando de voz")
// O webhook já aceitava `type:"audio"`, mas só lia `msg.audio.caption` — e recado de voz não tem
// legenda. Resultado: o áudio chegava, o texto saía vazio, e o cérebro respondia como se a pessoa
// não tivesse dito nada. Não era erro visível: era silêncio educado, que é pior.
//
// Aqui a gente faz o caminho inteiro: media_id → URL temporária no Graph → bytes → transcrição.
//
// ⚠️ DUAS COISAS QUE NÃO SÃO ÓBVIAS NA API DA META:
//   1. `GET /{media_id}` NÃO devolve o arquivo — devolve uma URL. E essa URL exige o MESMO token
//      no header: sem Authorization ela responde 401 e você recebe uma página de erro achando que
//      recebeu áudio.
//   2. A URL expira em minutos. Baixar na hora do webhook é obrigatório; guardar o link é lixo.
const GRAPH = "https://graph.facebook.com/v21.0";
const TETO_BYTES = 12 * 1024 * 1024;   // recado de voz é curto; acima disso é outra coisa

// A frase que a pessoa ouve quando não deu para entender. NUNCA silêncio: quem mandou áudio e não
// recebe nada conclui que o número está morto — e some. É a mesma regra do comprovante.
export function recadoDeFalha(lang = "pt") {
  const L = (lang || "pt").toString().slice(0, 2).toLowerCase();
  if (L === "en") return "Sorry — I couldn't hear that audio clearly. Could you type it for me?";
  if (L === "es") return "Perdón — no pude escuchar bien ese audio. ¿Me lo puedes escribir?";
  return "Desculpa — não consegui ouvir bem esse áudio. Pode me escrever?";
}

// ── 1. BAIXAR ────────────────────────────────────────────────────────────────────────────────
export async function baixarMidia(env, mediaId, token) {
  if (!mediaId || !token) return { ok: false, motivo: "sem media_id ou token" };
  try {
    const meta = await fetch(`${GRAPH}/${encodeURIComponent(mediaId)}`, { headers: { Authorization: `Bearer ${token}` } });
    const md = await meta.json().catch(() => ({}));
    if (!meta.ok || !md.url) {
      return { ok: false, motivo: `Graph recusou o media_id: ${(md?.error?.message) || `HTTP ${meta.status}`}`.slice(0, 180) };
    }
    // O download exige o token de novo — a URL sozinha responde 401.
    const bin = await fetch(md.url, { headers: { Authorization: `Bearer ${token}` } });
    if (!bin.ok) return { ok: false, motivo: `download falhou: HTTP ${bin.status}` };
    const buf = await bin.arrayBuffer();
    if (!buf.byteLength) return { ok: false, motivo: "arquivo vazio" };
    if (buf.byteLength > TETO_BYTES) return { ok: false, motivo: `áudio grande demais (${Math.round(buf.byteLength / 1024)}KB)` };
    return { ok: true, bytes: buf, mime: md.mime_type || "audio/ogg", tamanho: buf.byteLength };
  } catch (e) { return { ok: false, motivo: `rede: ${String(e).slice(0, 120)}` }; }
}

// ── 2. TRANSCREVER ───────────────────────────────────────────────────────────────────────────
// ElevenLabs (o MESMO fornecedor da voz — não entra dependência nova, e não passa pela Anthropic:
// ouvir continua funcionando mesmo com o cérebro sem saldo).
export async function transcrever(env, bytes, mime = "audio/ogg") {
  if (!env.ELEVENLABS_API_KEY) return { ok: false, motivo: "ELEVENLABS_API_KEY ausente" };
  try {
    const fd = new FormData();
    fd.append("file", new Blob([bytes], { type: mime }), "recado.ogg");
    fd.append("model_id", "scribe_v1");
    const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST", headers: { "xi-api-key": env.ELEVENLABS_API_KEY }, body: fd,
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, motivo: `ElevenLabs ${r.status}: ${JSON.stringify(d).slice(0, 160)}` };
    const texto = (d.text || "").toString().trim();
    // "200 com texto vazio" é falha, não sucesso — e sem esta linha ela viraria uma pergunta vazia
    // entregue ao cérebro, que responderia qualquer coisa. Já vi esse filme.
    if (!texto) return { ok: false, motivo: "200 sem texto (áudio mudo ou não reconhecido)" };
    return { ok: true, texto, idioma: d.language_code || "" };
  } catch (e) { return { ok: false, motivo: `rede: ${String(e).slice(0, 120)}` }; }
}

// ── 3. O CAMINHO INTEIRO ─────────────────────────────────────────────────────────────────────
export async function ouvirRecado(env, { mediaId, token, lang }) {
  const baixado = await baixarMidia(env, mediaId, token);
  if (!baixado.ok) return { ok: false, motivo: baixado.motivo, fala: recadoDeFalha(lang) };
  const t = await transcrever(env, baixado.bytes, baixado.mime);
  if (!t.ok) return { ok: false, motivo: t.motivo, fala: recadoDeFalha(lang), tamanho: baixado.tamanho };
  return { ok: true, texto: t.texto, idioma: t.idioma, tamanho: baixado.tamanho };
}
