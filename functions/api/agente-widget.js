// /api/agente-widget — A COR DO WIDGET, DO LADO ONDE ELA MORA (2026-09-09)
// ─────────────────────────────────────────────────────────────────────────────
// Por que existe: o widget da landing nova rendeu PRETO com fundo branco, apesar de
// `platform_settings.widget.btn_color = #3E9468` e `bg_color = #161512` estarem gravados lá.
// Lido o agente cru: a ElevenLabs trocou o esquema — o widget atual lê `widget.styles.{base,
// accent, …}` e os campos antigos (`btn_color`, `bg_color`…) ficam gravados e IGNORADOS. Campo
// certo, esquema velho: a mesma lição de "chave presente ≠ chave viva", agora em cor.
//
// GET  ?secret&agent_id            → lê styles atuais (prova antes)
// POST ?secret&agent_id (JSON {styles}) → PATCH e RELEITURA; devolve antes/depois. "200 no
//   PATCH" não é prova — a ElevenLabs já respondeu 200 e guardou null (language_detection).
// Segurança: INGEST_SECRET fail-closed; a chave nunca é ecoada; só `widget` é enviado.
import { json } from "../lib/guard.js";
import { clientToolset } from "../lib/provision.js";

function safeEq(a, b) {
  const x = String(a || ""), y = String(b || "");
  if (!x || !y || x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

// A PALETA DA CASA (cimento quente, LOCKED) traduzida pro vocabulário do widget.
export const ESTILO_GUILEO = {
  base: "#161512", base_hover: "#1E1C18", base_active: "#24211C", base_border: "#2B2720",
  base_subtle: "#8F877A", base_primary: "#EDE7DC", base_error: "#E0645A",
  accent: "#3E9468", accent_hover: "#4AA877", accent_active: "#35805A", accent_border: "#3E9468",
  accent_subtle: "#2A4A38", accent_primary: "#0E1012",
  button_radius: 999, input_radius: 14, bubble_radius: 16, sheet_radius: 22, compact_sheet_radius: 22,
};

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const tok = request.headers.get("x-guileo-secret") || url.searchParams.get("secret") || "";
  if (!env.INGEST_SECRET || !safeEq(tok, env.INGEST_SECRET)) return json({ error: "unauthorized" }, 401);
  if (!env.ELEVENLABS_API_KEY) return json({ ok: false, nao_deu_pra_ler: true, motivo: "sem ELEVENLABS_API_KEY — isto NÃO é um ok" }, 503);
  const alvo = (url.searchParams.get("agent_id") || "").trim();
  if (!/^agent_[a-z0-9]+$/i.test(alvo)) return json({ ok: false, erro: "agent_id inválido" }, 400);

  const h = { "xi-api-key": env.ELEVENLABS_API_KEY };
  const base = `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(alvo)}`;
  const ler = async () => {
    const r = await fetch(base, { headers: h });
    if (!r.ok) throw new Error(`leitura HTTP ${r.status}`);
    const d = await r.json();
    return d?.platform_settings?.widget || null;
  };

  let antes;
  try { antes = await ler(); } catch (e) { return json({ ok: false, erro: String(e.message || e) }, 503); }
  // ?twilio=1 — o que a TWILIO (com a credencial do Cloudflare) diz dos nossos números: a conta dona
  // (nome + SID mascarado), e por número: existe nesta conta? voice_url aponta pra ElevenLabs?
  // Nunca ecoa token. É o outro lado do "401 Authenticate" que a ElevenLabs reporta.
  if (request.method !== "POST" && url.searchParams.get("twilio") === "1") {
    const sid = env.TWILIO_ACCOUNT_SID, tok = env.TWILIO_AUTH_TOKEN;
    if (!sid || !tok) return json({ ok: false, nao_deu_pra_ler: true, motivo: "sem TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN no Cloudflare" }, 503);
    const th = { Authorization: "Basic " + btoa(`${sid}:${tok}`) };
    const ar = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, { headers: th });
    const ad = ar.ok ? await ar.json().catch(() => ({})) : {};
    const conta = { http: ar.status, nome: ad.friendly_name || null, status: ad.status || null, tipo: ad.type || null, sid_mask: sid.slice(0, 6) + "…" + sid.slice(-4) };
    const nums = [];
    for (const n of ["+19864443334", "+19298288170"]) {
      const nr = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(n)}`, { headers: th });
      const nd = nr.ok ? await nr.json().catch(() => ({})) : {};
      const it = (nd.incoming_phone_numbers || [])[0];
      nums.push({ numero: n, http: nr.status, nesta_conta: !!it, voice_url: it ? it.voice_url : null, sms_url: it ? it.sms_url : null, status_callback: it ? it.status_callback : null });
    }
    return json({ ok: ar.ok, conta, numeros: nums });
  }
  // ?telefones=1 — os números de telefone da conta e a que agente cada um aponta (o "failed 0s" no
  // canal twilio começa aqui: número sem agente, ou apontando pro agente errado).
  if (request.method !== "POST" && url.searchParams.get("telefones") === "1") {
    const pr0 = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", { headers: h });
    if (!pr0.ok) return json({ ok: false, erro: `phone-numbers HTTP ${pr0.status}` }, 503);
    const pd = await pr0.json().catch(() => []); // pr0.ok já conferido acima
    const lista = (Array.isArray(pd) ? pd : pd.phone_numbers || []).map((n) => ({ numero: n.phone_number, label: n.label, provider: n.provider, phone_number_id: n.phone_number_id, agente: n.assigned_agent ? { id: n.assigned_agent.agent_id, nome: n.assigned_agent.agent_name } : null }));
    return json({ ok: true, telefones: lista });
  }
  // ?conversa=<id> — a transcrição + análise de UMA conversa (o que a Gui ouviu e disse, e por que
  // a ElevenLabs marcou failure). Sem isto a gente adivinha; com isto a gente lê.
  // CÉREBRO (2026-09-18) — o agente da Guileo NÃO nasce do motor (banco: null em /api/agente-config):
  // o prompt dele só existe na ElevenLabs. `?voltar=1` restaura voz/presets, não prompt — então
  // antes de mexer no prompt, esta janela devolve o texto INTEIRO pra ser salvo em arquivo.
  if (request.method !== "POST" && url.searchParams.get("cerebro") === "1") {
    const r = await fetch(base, { headers: h }); if (!r.ok) return json({ ok: false, erro: `leitura HTTP ${r.status}` }, 503);
    const d = await r.json().catch(() => ({}));
    const pr = d?.conversation_config?.agent?.prompt || {};
    return json({ ok: true, agent_id: alvo, llm: pr.llm || null, prompt: pr.prompt || "", prompt_chars: (pr.prompt || "").length,
      tools: (pr.tools || []).map((t) => ({ name: t.name, type: t.type, cabecalhos: t.api_schema?.request_headers ? Object.keys(t.api_schema.request_headers) : undefined, caller_vai: t.api_schema?.request_headers ? String(t.api_schema.request_headers['x-guileo-caller'] || '') : undefined })), tool_ids: pr.tool_ids || [],
      built_in_tools: Object.keys(pr.built_in_tools || {}).filter((k) => pr.built_in_tools[k]),
      turn: d?.conversation_config?.turn || null, first_message: d?.conversation_config?.agent?.first_message || null,
      ouvido: d?.conversation_config?.asr || null, idiomas: Object.keys(d?.conversation_config?.language_presets || {}),
      identidade_webhook: { url: d?.platform_settings?.workspace_overrides?.conversation_initiation_client_data_webhook?.url || null,
        ligado: d?.platform_settings?.overrides?.enable_conversation_initiation_client_data_from_webhook ?? null } });
  }
  if (request.method !== "POST" && url.searchParams.get("conversa")) {
    const cid = url.searchParams.get("conversa").replace(/[^a-z0-9_]/gi, "").slice(0, 64);
    const cr = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${cid}`, { headers: h });
    if (!cr.ok) return json({ ok: false, erro: `conversa HTTP ${cr.status}` }, 503);
    const cd = await cr.json().catch(() => ({}));
    const t = (cd.transcript || []).map((m) => ({ quem: m.role, t: m.time_in_call_secs, msg: (m.message || "").slice(0, 300), tool: m.tool_calls && m.tool_calls.length ? m.tool_calls.map((x) => x.tool_name).join(",") : undefined }));
    return json({ ok: true, id: cid, status: cd.status, saudacao_enviada: cd.conversation_initiation_client_data?.conversation_config_override?.agent?.first_message || null,
      identidade: { bina: cd.metadata?.phone_call?.external_number || null, linha: cd.metadata?.phone_call?.agent_number || null, vars: Object.fromEntries(Object.entries(cd.conversation_initiation_client_data?.dynamic_variables || {}).filter(([k]) => /^caller_|^system__caller/.test(k))) }, audio: { has_audio: cd.has_audio ?? null, has_user_audio: cd.has_user_audio ?? null, has_response_audio: cd.has_response_audio ?? null }, meta: { dur: cd.metadata?.call_duration_secs, termination: cd.metadata?.termination_reason, error: cd.metadata?.error, main_language: cd.metadata?.main_language, cost: cd.metadata?.cost }, analise: cd.analysis && { call_successful: cd.analysis.call_successful, resumo: (cd.analysis.transcript_summary || "").slice(0, 600) }, transcript: t.slice(0, 40) });
  }
  // ?conversas=1 — o COMPROVANTE do lado do provedor: as últimas conversas deste agente (id, canal,
  // status, duração, quando). Se o widget "não funciona", isto diz se a chamada chegou na ElevenLabs.
  if (request.method !== "POST" && url.searchParams.get("conversas") === "1") {
    const cr = await fetch(`https://api.elevenlabs.io/v1/convai/conversations?agent_id=${encodeURIComponent(alvo)}&page_size=8`, { headers: h });
    if (!cr.ok) return json({ ok: false, erro: `conversas HTTP ${cr.status}` }, 503);
    const cd = await cr.json().catch(() => ({}));
    const lista = (cd.conversations || []).map((c) => ({ id: c.conversation_id, status: c.status, call_successful: c.call_successful, dur_s: c.call_duration_secs, msgs: c.message_count, inicio: c.start_time_unix_secs ? new Date(c.start_time_unix_secs * 1000).toISOString() : null, canal: c.conversation_initiation_source || c.channel || null }));
    return json({ ok: true, agent_id: alvo, conversas: lista });
  }
  if (request.method !== "POST") {
    // O plano da conta decide o que o widget aceita (disable_banner é gated por tier): mostrar
    // junto, senão a próxima pessoa PATCHa, recebe 200 e acha que aplicou.
    let plano = null;
    try {
      const sr = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: h, signal: AbortSignal.timeout(6000) });
      const sd = await sr.json().catch(() => ({}));
      plano = sr.ok ? { tier: sd?.tier, status: sd?.status } : { erro: `HTTP ${sr.status}` };
    } catch (e) { plano = { erro: String(e.message || e) }; }
    return json({ ok: true, agent_id: alvo, styles: antes?.styles || null, variant: antes?.variant, disable_banner: antes?.disable_banner, plano });
  }

  let corpo = {};
  try { corpo = await request.json(); } catch { corpo = {}; }
  // twilio_reimport (POST {numero, agent_id_destino}) — 2026-09-10. Quando a credencial da Twilia troca,
  // a ElevenLabs continua com a ANTIGA guardada dentro do número (a API só aceita SID/token na criação),
  // e toda chamada morre em "401 Authenticate". O conserto é: apagar o número na ElevenLabs e importar
  // de novo com o SID/token que estão no Cloudflare (env) — o token NUNCA passa pelo chat nem pela
  // resposta. Só roda depois de o Luis atualizar TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN e a prova
  // `?twilio=1` responder 200. Fail-closed: se a Twilio do Cloudflare der 401, não apaga nada.
  if (corpo.twilio_reimport && typeof corpo.twilio_reimport === "object") {
    const { numero, agent_id_destino, label } = corpo.twilio_reimport;
    const sid = env.TWILIO_ACCOUNT_SID, tok = env.TWILIO_AUTH_TOKEN;
    if (!sid || !tok) return json({ ok: false, erro: "sem credencial Twilio no Cloudflare" }, 503);
    if (!/^\+\d{8,15}$/.test(String(numero || ""))) return json({ ok: false, erro: "numero inválido" }, 400);
    const th = { Authorization: "Basic " + btoa(`${sid}:${tok}`) };
    const ar = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(numero)}`, { headers: th });
    if (!ar.ok) return json({ ok: false, erro: `a Twilio do Cloudflare respondeu HTTP ${ar.status} — não apago nada` }, 503);
    const ad = await ar.json().catch(() => ({}));
    if (!(ad.incoming_phone_numbers || []).length) return json({ ok: false, erro: "esse número não está na conta Twilio do Cloudflare — não apago nada" }, 409);
    // 1) achar o registro atual na ElevenLabs
    const lr = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", { headers: h });
    if (!lr.ok) return json({ ok: false, erro: `lista de números HTTP ${lr.status}` }, 503);
    const ld = await lr.json().catch(() => []);
    const atual = (Array.isArray(ld) ? ld : ld.phone_numbers || []).find((n) => n.phone_number === numero);
    const agente = agent_id_destino || (atual && atual.assigned_agent && atual.assigned_agent.agent_id) || null;
    if (atual) { const dr = await fetch(`https://api.elevenlabs.io/v1/convai/phone-numbers/${atual.phone_number_id}`, { method: "DELETE", headers: h }); if (!dr.ok) return json({ ok: false, erro: `DELETE antigo falhou HTTP ${dr.status}` }, 503); }
    // 2) importar de novo com a credencial viva
    const cr = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", { method: "POST", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ phone_number: numero, label: label || (atual && atual.label) || numero, sid, token: tok, provider: "twilio" }) });
    if (!cr.ok) return json({ ok: false, erro: `import falhou HTTP ${cr.status}`, corpo: (await cr.text().catch(() => "")).slice(0, 300) }, 503);
    const cdata = await cr.json().catch(() => ({}));
    const novoId = cdata.phone_number_id;
    // 3) devolver o agente
    let atrib = null;
    if (agente && novoId) { const pr2 = await fetch(`https://api.elevenlabs.io/v1/convai/phone-numbers/${novoId}`, { method: "PATCH", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ agent_id: agente }) }); atrib = pr2.ok; }
    // 4) releitura
    const vr = await fetch(`https://api.elevenlabs.io/v1/convai/phone-numbers/${novoId}`, { headers: h });
    if (!vr.ok) return json({ ok: false, erro: `releitura HTTP ${vr.status}`, phone_number_id_novo: novoId }, 503);
    const vd = await vr.json().catch(() => ({}));
    return json({ ok: vr.ok && (!agente || vd?.assigned_agent?.agent_id === agente), numero, phone_number_id_antigo: atual ? atual.phone_number_id : null, phone_number_id_novo: novoId, agente_lido: vd?.assigned_agent || null, atribuiu: atrib });
  }
  // IDIOMA DO VISITANTE (2026-09-10, lei da casa: nada de EN em tela PT). `presets` = { pt: "primeira
  // frase…", es: …, hi: … } vai pra conversation_config.language_presets.<lang>.overrides.agent.first_message;
  // `widget_presets` = { pt: { text_contents: {...} } } vai pra platform_settings.widget.language_presets.
  // Os dois provados por releitura.
  // LIBERAR A ABERTURA DA LIGAÇÃO DE SAÍDA (2026-09-18). call.js manda
  // conversation_config_override.agent.first_message ("Oi X, você acabou de pedir a demo…"), mas o
  // agente recusava a chamada inteira: "Override for field 'first_message' is not allowed by config"
  // — 729 ligações de 03–05/09 morreram assim. POST {liberar_overrides: ["first_message", "language"]}
  // liga só esses campos em platform_settings.overrides, preservando o que já estava, e prova relendo.
  // CAPTURA NO SITE (2026-09-18) — POST {cerebro_site:{texto}}. Dois defeitos medidos nas conversas
  // reais do widget: (1) a Gui pegou telefone+e-mail ("Louise", 10/09) e NADA foi gravado — o agente
  // não tinha a ferramenta do_action; (2) quem disse tchau 5× ficou ouvindo "você ainda está aí?" —
  // sem end_call ela não consegue desligar. Aqui: o texto entra num bloco MARCADO do prompt (rodar de
  // novo substitui, não duplica), do_action e end_call entram só se faltarem, o resto é preservado.
  if (corpo.cerebro_site && typeof corpo.cerebro_site === "object") {
    const texto = String(corpo.cerebro_site.texto || "").trim();
    if (texto.length < 40) return json({ ok: false, erro: "texto curto demais" }, 400);
    const lr = await fetch(base, { headers: h }); if (!lr.ok) return json({ ok: false, erro: `leitura HTTP ${lr.status}` }, 503);
    const cur = await lr.json().catch(() => ({}));
    const pr = cur?.conversation_config?.agent?.prompt || {};
    const antigo = pr.prompt || "";
    if (antigo.length < 200) return json({ ok: false, erro: "prompt atual vazio/curto — não mexo às cegas" }, 409);
    const INI = "<!-- GUI-SITE-CAPTURA:INICIO -->", FIM = "<!-- GUI-SITE-CAPTURA:FIM -->";
    const blocoNovo = `${INI}\n${texto}\n${FIM}`;
    const re = /<!-- GUI-SITE-CAPTURA:INICIO -->[\s\S]*?<!-- GUI-SITE-CAPTURA:FIM -->/;
    const novoPrompt = re.test(antigo) ? antigo.replace(re, blocoNovo) : `${blocoNovo}\n\n${antigo}`;
    const tools = [...(pr.tools || [])];
    const nomes = new Set(tools.map((t) => t.name));
    const acao = (clientToolset(env, "smart@guileoai.com").tools || []).find((t) => t.name === "do_action");
    if (!acao) return json({ ok: false, erro: "sem AGENT_ACTION_SECRET no Cloudflare — do_action não pode ser montada" }, 503);
    if (!nomes.has("do_action")) tools.push(acao);
    if (!nomes.has("end_call")) tools.push({ type: "system", name: "end_call", description: "End the conversation when the visitor says goodbye, stops responding, or the conversation is clearly over. Say one short goodbye first, then call this.", params: { system_tool_type: "end_call" } });
    // silêncio: -1 = nunca encerra (a origem do "você ainda está aí?" em laço). 10–120 s, opcional.
    const sil = Number(corpo.cerebro_site.silencio_s);
    const turn = Number.isFinite(sil) && sil >= 10 && sil <= 120 ? { silence_end_call_timeout: Math.round(sil) } : null;
    const pp = await fetch(base, { method: "PATCH", headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_config: { agent: { prompt: { prompt: novoPrompt, tools } }, ...(turn ? { turn } : {}) } }) });
    if (!pp.ok) return json({ ok: false, erro: `PATCH HTTP ${pp.status}`, corpo: (await pp.text().catch(() => "")).slice(0, 400) }, 503);
    const vr = await fetch(base, { headers: h }); if (!vr.ok) return json({ ok: false, erro: `releitura HTTP ${vr.status}` }, 503);
    const vd = await vr.json().catch(() => ({}));
    const vp = vd?.conversation_config?.agent?.prompt || {};
    const vn = (vp.tools || []).map((t) => t.name);
    const silLido = vd?.conversation_config?.turn?.silence_end_call_timeout;
    const okTudo = (vp.prompt || "").includes(INI) && (vp.prompt || "").includes(texto.slice(0, 60)) && vn.includes("do_action") && vn.includes("end_call")
      && (!turn || silLido === turn.silence_end_call_timeout);
    return json({ ok: okTudo, agent_id: alvo, prompt_chars_antes: antigo.length, prompt_chars_depois: (vp.prompt || "").length,
      tools_antes: [...nomes], tools_depois: vn, silencio_depois: silLido, ...(okTudo ? {} : { erro: "200 mas a releitura não bate — NÃO aplicado" }) });
  }
  // ligar_identidade (2026-09-28) — a Lilian não disse "Luis" ligando do número salvo: a conversa
  // mostrou só system__caller_id, nenhum caller_*. A URL do webhook estava no agente, mas a ElevenLabs
  // só CHAMA o webhook quando platform_settings.overrides.enable_conversation_initiation_client_data_from_webhook
  // é true. Cano instalado, registro fechado. Liga a chave e prova relendo.
  if (corpo.ligar_identidade === true) {
    const lr = await fetch(base, { headers: h }); if (!lr.ok) return json({ ok: false, erro: `leitura HTTP ${lr.status}` }, 503);
    const cur = await lr.json().catch(() => ({}));
    const ov = cur?.platform_settings?.overrides || {};
    const pr = await fetch(base, { method: "PATCH", headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ platform_settings: { overrides: { ...ov, enable_conversation_initiation_client_data_from_webhook: true } } }) });
    if (!pr.ok) return json({ ok: false, erro: `PATCH HTTP ${pr.status}`, corpo: (await pr.text().catch(() => "")).slice(0, 300) }, 503);
    const vd = await (await fetch(base, { headers: h })).json().catch(() => ({}));
    const lido = vd?.platform_settings?.overrides?.enable_conversation_initiation_client_data_from_webhook;
    return json({ ok: lido === true, agent_id: alvo, antes: ov.enable_conversation_initiation_client_data_from_webhook ?? null, depois: lido ?? null,
      url: vd?.platform_settings?.workspace_overrides?.conversation_initiation_client_data_webhook?.url || null });
  }
  if (Array.isArray(corpo.liberar_overrides)) {
    const OK_CAMPOS = new Set(["first_message", "language", "prompt"]);
    const pedidos = corpo.liberar_overrides.filter((c) => OK_CAMPOS.has(c));
    if (!pedidos.length) return json({ ok: false, erro: "nada permitido em liberar_overrides" }, 400);
    const lr = await fetch(base, { headers: h }); if (!lr.ok) return json({ ok: false, erro: `leitura HTTP ${lr.status}` }, 503);
    const cur = await lr.json().catch(() => ({}));
    const ov = cur?.platform_settings?.overrides || {};
    const cco = ov.conversation_config_override || {};
    const ag = { ...(cco.agent || {}) };
    for (const c of pedidos) if (c !== "prompt") ag[c] = true;
    if (pedidos.includes("prompt")) ag.prompt = { ...(ag.prompt || {}), prompt: true };
    const novo = { ...ov, conversation_config_override: { ...cco, agent: ag } };
    const pr = await fetch(base, { method: "PATCH", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify({ platform_settings: { overrides: novo } }) });
    if (!pr.ok) return json({ ok: false, erro: `PATCH overrides HTTP ${pr.status}`, corpo: (await pr.text().catch(() => "")).slice(0, 300) }, 503);
    const vr = await fetch(base, { headers: h }); if (!vr.ok) return json({ ok: false, erro: `releitura HTTP ${vr.status}` }, 503);
    const vd = await vr.json().catch(() => ({}));
    const lido = vd?.platform_settings?.overrides?.conversation_config_override?.agent || {};
    const okTodos = pedidos.every((c) => c === "prompt" ? lido?.prompt?.prompt === true : lido[c] === true);
    return json({ ok: okTodos, agent_id: alvo, antes: cco.agent || null, depois: lido, ...(okTodos ? {} : { erro: "200 mas a releitura não bate — NÃO aplicado" }) });
  }
  if (corpo.presets && typeof corpo.presets === "object") {
    const lr = await fetch(base, { headers: h }); if (!lr.ok) return json({ ok: false, erro: `leitura HTTP ${lr.status}` }, 503);
    const cur = await lr.json().catch(() => ({}));
    const lp = { ...(cur?.conversation_config?.language_presets || {}) };
    for (const [lang, fm] of Object.entries(corpo.presets)) {
      if (!/^[a-z]{2}(-[a-z]{2})?$/i.test(lang) || typeof fm !== "string") continue;
      const prev = lp[lang] || { overrides: {} };
      lp[lang] = { ...prev, overrides: { ...(prev.overrides || {}), agent: { ...((prev.overrides || {}).agent || {}), first_message: fm.slice(0, 400) } } };
    }
    const wl = corpo.widget_presets && typeof corpo.widget_presets === "object" ? corpo.widget_presets : null;
    const widget = wl ? { ...(antes || {}), language_presets: { ...((antes && antes.language_presets) || {}), ...wl } } : null;
    const body = { conversation_config: { language_presets: lp }, ...(widget ? { platform_settings: { widget } } : {}) };
    const pr1 = await fetch(base, { method: "PATCH", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!pr1.ok) return json({ ok: false, erro: `PATCH presets falhou: HTTP ${pr1.status}`, corpo: (await pr1.text().catch(() => "")).slice(0, 400) }, 503);
    const vr = await fetch(base, { headers: h }); if (!vr.ok) return json({ ok: false, erro: `releitura HTTP ${vr.status}` }, 503);
    const vd = await vr.json().catch(() => ({}));
    const lidos = Object.fromEntries(Object.keys(corpo.presets).map((l) => [l, vd?.conversation_config?.language_presets?.[l]?.overrides?.agent?.first_message || null]));
    const okTodos = Object.entries(corpo.presets).every(([l, fm]) => lidos[l] === String(fm).slice(0, 400));
    const wlidos = vd?.platform_settings?.widget?.language_presets ? Object.keys(vd.platform_settings.widget.language_presets) : [];
    return json({ ok: okTodos, agent_id: alvo, presets_lidos: lidos, widget_presets_lidos: wlidos, ...(okTodos ? {} : { erro: "200 mas a releitura não bate" }) });
  }
  // PRIMEIRA FRASE (2026-09-09): "Thank you for calling Guileo, this is Ghee" era grafia fonética
  // pra VOZ; no chat de texto fica errado. Aceita `first_message` e prova pela releitura.
  if (typeof corpo.first_message === "string" && corpo.first_message.trim()) {
    const fm = corpo.first_message.trim().slice(0, 400);
    const pr0 = await fetch(base, { method: "PATCH", headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_config: { agent: { first_message: fm } } }) });
    if (!pr0.ok) return json({ ok: false, erro: `PATCH first_message falhou: HTTP ${pr0.status}`, corpo: (await pr0.text().catch(() => "")).slice(0, 300) }, 503);
    const vr = await fetch(base, { headers: h });
    if (!vr.ok) return json({ ok: false, erro: `PATCH 200 mas a releitura falhou: HTTP ${vr.status}` }, 503);
    const vd = await vr.json().catch(() => ({}));
    const lido = vd?.conversation_config?.agent?.first_message;
    return json({ ok: lido === fm, agent_id: alvo, first_message: lido, ...(lido === fm ? {} : { erro: "200 mas a releitura não bate — NÃO aplicado" }) });
  }
  const styles = corpo.styles && typeof corpo.styles === "object" ? corpo.styles : ESTILO_GUILEO;
  // Campos de topo do widget (ex.: disable_banner) — lista fechada, nada de mandar o que vier.
  const PERMITIDOS = new Set(["disable_banner", "variant", "placement", "text_input_enabled", "default_expanded"]);
  const campos = Object.fromEntries(Object.entries(corpo.campos || {}).filter(([k]) => PERMITIDOS.has(k)));

  // Envia o widget INTEIRO com styles trocado — um PATCH parcial de objeto aninhado pode virar
  // "substitui o widget por só isto" e apagar avatar/textos. O que foi lido volta igual.
  const widget = { ...(antes || {}), ...campos, styles: { ...(antes?.styles || {}), ...styles } };
  const pr = await fetch(base, {
    method: "PATCH", headers: { ...h, "Content-Type": "application/json" },
    body: JSON.stringify({ platform_settings: { widget } }),
  });
  if (!pr.ok) {
    const t = await pr.text().catch(() => "");
    return json({ ok: false, erro: `PATCH falhou: HTTP ${pr.status}`, corpo: t.slice(0, 400) }, 503);
  }
  let depois;
  try { depois = await ler(); } catch (e) { return json({ ok: false, erro: `PATCH 200 mas releitura falhou: ${e.message}` }, 503); }
  const aplicado = Object.entries(styles).every(([k, v]) => String(depois?.styles?.[k]) === String(v))
    && Object.entries(campos).every(([k, v]) => String(depois?.[k]) === String(v));
  return json({ ok: aplicado, agent_id: alvo, antes: antes?.styles || null, depois: depois?.styles || null,
    campos_depois: Object.fromEntries(Object.keys(campos).map((k) => [k, depois?.[k]])),
    avatar_preservado: JSON.stringify(depois?.avatar) === JSON.stringify(antes?.avatar),
    ...(aplicado ? {} : { erro: "a ElevenLabs respondeu 200 mas a releitura não bate — NÃO está aplicado" }) });
}
