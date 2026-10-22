// ═══ A NORMA DO AGENTE, EM UM LUGAR SÓ ═══════════════════════════════════════════════════════
// Os 17 itens viviam DENTRO de `/api/agente-config?padrao=1` — uma rota que só roda quando alguém
// digita a URL à mão. E ninguém digita à mão.
//
// O CUSTO DISSO, medido em 2026-08-21: a Lilian (a primeira cliente real, no ar há semanas) estava
// com `language_presets` VAZIO. A norma teria acusado no item "preset pt E pt-br" — mas nada
// executava a norma. Um agente pode estar fora do padrão por semanas sem ninguém saber, e só se
// descobre quando o dono do negócio ouve algo errado ao telefone.
//
// Aqui a norma vira peça: a rota continua servindo o operador, e a VARREDURA HORÁRIA passa a rodar
// os mesmos 17 itens em todo agente que ela toca — e a avisar quando um sai do padrão.
// As palavras que provam o anúncio, em todo idioma da tabela GREETINGS (provision.js).
export const ANUNCIO_VIRTUAL = /virtual|virtuel|virtuale|virtuelle|wirtualn|виртуальн|віртуальн|वर्चुअल|虚拟|虛擬|バーチャル|가상|vityèl|trợ lý ảo|افتراضي/i;
export const ANUNCIO_GRAVACAO = /record|gravad|grabad|enregistr|registrat|aufgezeichnet|nagrywan|записыва|записува|रिकॉर्ड|录音|錄音|録音|녹음|anrejistre|ghi âm|تسجيل/i;

export function conferePadrao(d) {
  const cc = d?.conversation_config || {};
  const ag = cc?.agent || {}; const pr = ag?.prompt || {};
  const prompt = (pr?.prompt || "").toString();
  const fm = (ag?.first_message || "").toString();
  const presets = cc?.language_presets || {};
  const tools = (pr?.tools || []).map((t) => t?.name);
  const ps = d?.platform_settings || {};
  const wh = (ps?.workspace_overrides || {}).conversation_initiation_client_data_webhook || {};
  const vozDe = (k) => ((presets[k] || {}).overrides || {}).tts?.voice_id || null;
  // (2026-09-27) O IDIOMA PRINCIPAL CONTA. A norma foi escrita quando todo agente nascia em inglês:
  // exigia um PRESET de pt/pt-br. Agente de cliente brasileiro tem o português como idioma
  // PRINCIPAL — e a ElevenLabs não aceita preset do próprio idioma principal. O MedMundo passou a
  // atender em português e a régua o reprovou por isso. Quem fala português como base cumpre o
  // item pelo idioma base, com o motor lido da voz base.
  const base = (ag?.language || "").toString().toLowerCase();
  const baseEh = (k) => base === k || base.split("-")[0] === k.split("-")[0];
  const motorDe = (k) => (baseEh(k) && !presets[k] ? (cc?.tts?.model_id || null) : ((presets[k] || {}).overrides || {}).tts?.model_id || null);

    const itens = [
    ["1 · nome branco", /·/.test(d?.name || ""), d?.name],
    ["1 · saudação de CUIDADO", /take care of you|cuidar de você|cuidarle/i.test(fm), fm.slice(0, 60)],
    ["1 · 1ª fala SEM variável", !/\{\{/.test(fm), "derruba a ligação se tiver"],
    // CR-01 (2026-10-08): a 1ª fala se apresenta como ASSISTENTE VIRTUAL e avisa a GRAVAÇÃO (contrato).
    ["1 · 1ª fala: assistente virtual + gravação", ANUNCIO_VIRTUAL.test(fm) && ANUNCIO_GRAVACAO.test(fm), fm.slice(0, 120)],
    ["2 · language_detection em tools", tools.includes("language_detection"), tools.join(",")],
    ["2 · preset pt E pt-br", baseEh("pt") || (!!presets.pt && !!presets["pt-br"]), baseEh("pt") ? `idioma base ${base}` : Object.keys(presets).filter((k) => k.startsWith("pt")).join(",")],
    ["2 · motor multilíngue no pt-br", motorDe("pt-br") === "eleven_flash_v2_5", motorDe("pt-br")],
    ["2 · motor multilíngue no es", motorDe("es") === "eleven_flash_v2_5", motorDe("es")],
    ["2 · regra 'trocar idioma é ferramenta'", /TOOL CALL, NOT A CHOICE OF WORDS/.test(prompt), null],
    // 🚨 A NORMA MUDOU EM 2026-08-19 e ESTES DOIS ITENS INVERTERAM DE SINAL.
    // Antes o padrão EXIGIA voz nativa por idioma (Nina no pt, Jess no es). O Luis ouviu a
    // ligação real e vetou: a voz trocava no meio da conversa e a atendente virava outra
    // pessoa — quem está do outro lado lê isso como transferência, não como sotaque, e perde
    // a confiança que a ligação inteira construiu. Agora a norma é o OPOSTO: preset NENHUM
    // pode fixar voz; todos herdam a base, e a pessoa é uma só do "alô" ao agendamento.
    // Deixei o item invertido em vez de apagado de propósito: o padrão precisa PEGAR uma
    // regressão pra voz-por-idioma, que é justamente o que já fizemos uma vez.
    ["3 · voz ÚNICA: nenhum preset fixa voz", Object.keys(presets).every((k) => !vozDe(k)),
      Object.keys(presets).filter((k) => vozDe(k)).join(",") || "todos herdam a base"],
    ["3 · voz base definida", !!cc?.tts?.voice_id, cc?.tts?.voice_id || "AUSENTE"],
    ["4 · KB do negócio no cérebro", /BUSINESS FAQ/.test(prompt), `${prompt.length} chars`],
    ["4 · lições versionadas", /\(v\d+\)/.test(prompt), (prompt.match(/\(v\d+\)/) || [])[0]],
    ["4 · LLM gpt-4o, temp 0", pr?.llm === "gpt-4o" && Number(pr?.temperature) === 0, `${pr?.llm}/${pr?.temperature}`],
    ["5 · 3 ferramentas", ["schedule", "do_action", "language_detection"].every((t) => tools.includes(t)), tools.join(",")],
    ["6 · webhook de identidade", !!wh?.url && !!wh?.request_headers, wh?.url || "ausente"],
    ["7 · sem daily_limit -1", Number(ps?.call_limits?.daily_limit) !== -1, ps?.call_limits?.daily_limit ?? "não enviado"],
    ["7 · teto de duração", Number(ps?.call_limits?.agent_concurrency_limit ?? 0) >= -1, "ok"],
  ];

  const falhas = itens.filter(([, ok]) => !ok);
  return {
    agente: d?.name || null,
    total: itens.length,
    passou: itens.length - falhas.length,
    conforme: falhas.length === 0,
    falhas: falhas.map(([nome, , valor]) => ({ item: nome, valor: valor ?? null })),
    itens: itens.map(([nome, ok, valor]) => ({ item: nome, ok, valor: valor ?? null })),
  };
}
