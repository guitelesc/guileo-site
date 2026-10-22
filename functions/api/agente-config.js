// GET /api/agente-config?email=…  — A JANELA PARA O AGENTE REAL (2026-08-17)
// ─────────────────────────────────────────────────────────────────────────────
// Por que isto existe: eu estava consertando o agente ÀS CEGAS. A chave da ElevenLabs mora no
// servidor (correto), então eu só conseguia ESCREVER a configuração e ler de volta os poucos
// campos que eu mesmo tinha programado o sync a devolver. Quando o Luis dizia "não está
// funcionando", eu não tinha como olhar: nem o modelo de LLM, nem as ferramentas, nem a primeira
// fala, nem o prompt que de fato está lá.
//
// É a lição do dia repetida numa camada acima: durante meses o motor de voz monolíngue passou
// despercebido porque a prova mostrava a VOZ e não o MOTOR. Um instrumento que mostra só o que
// alguém lembrou de expor esconde exatamente o campo que quebrou. Aqui a resposta é o objeto
// CRU — nada de curadoria minha —, mais um resumo dos pontos que já quebraram de verdade.
//
// SEGURANÇA: mesma porta de serviço do sync (INGEST_SECRET, fail-closed — a verdade do env vem
// ANTES da comparação, senão string vazia == string vazia abriria a porta). É LEITURA APENAS:
// nenhum PATCH, nenhuma escrita, nenhum efeito no agente. A chave nunca é ecoada.
import { json } from "../lib/guard.js";
// A NORMA DOS 17 ITENS, compartilhada com a varredura horária: uma regra, dois leitores.
import { conferePadrao } from "../lib/padraoAgente.js";

import { svcRpc } from "../lib/sb.js";  // RPC server-only usa service_role, não anon
const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

// comparação de segredo em tempo constante-ish; o ponto principal é o fail-closed do env.
function safeEq(a, b) {
  const x = String(a || ""), y = String(b || "");
  if (!x || !y || x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

async function lerAgentIdPorEmail(email) {
  const r = await fetch(`${SB}/rest/v1/client_agents?client_email=eq.${encodeURIComponent(email)}&select=agent_id,brain_version,brain_synced_at`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  if (!r.ok) return null;
  const rows = await r.json().catch(() => []);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const tok = request.headers.get("x-guileo-secret") || url.searchParams.get("secret") || "";

  // fail-closed: sem segredo NO SERVIDOR, ninguém entra (nem com string vazia dos dois lados).
  if (!env.INGEST_SECRET || !safeEq(tok, env.INGEST_SECRET)) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!env.ELEVENLABS_API_KEY) {
    // "não deu pra ler" NUNCA pode sair como um objeto vazio que o olho lê como "está tudo certo".
    return json({ ok: false, nao_deu_pra_ler: true, motivo: "sem ELEVENLABS_API_KEY neste ambiente — isto NÃO é um ok" }, 503);
  }

  // ══════════════════════════════════════════════════════════════════════════════════════
  // REFERÊNCIA-OURO — congelar o que está bom e VOLTAR em um comando (2026-08-19)
  // Nasce de "não posso mais voltar aqui pela mesma coisa" (Luis). O problema não era mudar o
  // agente: era mudar e não ter como desfazer, porque a versão boa vivia só na ElevenLabs e
  // sumia na mudança seguinte. Agora a config inteira vira linha em agent_snapshots.
  //   ?congelar=1&agent_id=…[&ouro=1][&rotulo=…]   grava o estado ATUAL (ouro=1 → aprovado)
  //   ?voltar=1&agent_id=…                          reaplica a última referência-ouro
  // ══════════════════════════════════════════════════════════════════════════════════════
  const eCongelar = url.searchParams.get("congelar") === "1";
  const eVoltar = url.searchParams.get("voltar") === "1";
  if (eCongelar || eVoltar) {
    const alvo = (url.searchParams.get("agent_id") || "").trim();
    if (!alvo) return json({ error: "agent_id obrigatório" }, 400);
    const h = { "xi-api-key": env.ELEVENLABS_API_KEY };
    const seg = env.INGEST_SECRET || "";

    if (eCongelar) {
      const r = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(alvo)}`, { headers: h });
      if (!r.ok) return json({ ok: false, erro: `não consegui LER o agente: HTTP ${r.status}` }, 503);
      const d = await r.json().catch(() => null);
      // guardo só o que a API aceita de volta num PATCH — guardar o envelope inteiro faria a
      // volta falhar em campos read-only, e uma volta que falha é pior que não ter volta.
      const config = { conversation_config: d?.conversation_config || {}, platform_settings: d?.platform_settings || {}, name: d?.name };
      if (!config.conversation_config || !Object.keys(config.conversation_config).length) {
        return json({ ok: false, erro: "li o agente mas veio sem conversation_config — NÃO gravei um snapshot vazio" }, 503);
      }
      const sr = await svcRpc(env, "agent_snapshot_save", {
        p_secret: seg, p_agent_id: alvo, p_config: config,
        p_rotulo: (url.searchParams.get("rotulo") || "").slice(0, 120),
        p_aprovado: url.searchParams.get("ouro") === "1", p_nota: null,
      });
      const id = await sr.json().catch(() => null);
      if (!sr.ok || !id) return json({ ok: false, erro: `gravei nada: HTTP ${sr.status}`, resposta: id }, 503);
      return json({ ok: true, congelado: true, snapshot_id: id, agente: d?.name,
        ouro: url.searchParams.get("ouro") === "1",
        recado: "estado gravado. pra voltar: ?voltar=1&agent_id=" + alvo });
    }

    // VOLTAR
    const lr = await svcRpc(env, "agent_snapshot_last", { p_secret: seg, p_agent_id: alvo, p_somente_ouro: true });
    const snap = await lr.json().catch(() => null);
    // null = nunca houve referência-ouro. Dizer isso é obrigatório: um "ok" aqui seria a pior
    // mentira possível — o dono acharia que voltou e o agente seguiria quebrado.
    if (!lr.ok || !snap || !snap.config) {
      return json({ ok: false, nao_havia_ouro: true,
        erro: "não existe referência-ouro para este agente — nada foi alterado. Congele uma primeira com ?congelar=1&ouro=1" }, 409);
    }
    // ⚠️ MANDA DE VOLTA SÓ O QUE A API ACEITA ESCREVER.
    // O snapshot guarda o agente inteiro (bom pra auditar), mas devolver o envelope todo num
    // PATCH leva junto campo read-only/computado e a chamada morre — a primeira volta que
    // tentei derrubou o worker. `conversation_config` + `name` é o que de fato define o agente.
    // ⚠️ A VOLTA RESTAURA SÓ VOZ + PRESETS DE IDIOMA — de propósito.
    // Descobri tentando: mandar o conversation_config inteiro (o prompt sozinho tem dezenas de
    // milhares de caracteres) derruba a chamada. Mas isso expôs o desenho certo: o CÉREBRO já é
    // reconstruível a partir da fonte — é exatamente o que `POST /api/sync-agent` faz, com as
    // lições versionadas, o KB e as ferramentas. O que o sync NÃO restaura é a voz (ele preserva
    // a que está viva, pra não atropelar escolha do cliente) nem os presets. Então a
    // referência-ouro cobre justamente o buraco, e a rota completa é:
    //   1) ?voltar=1        → voz e idiomas de volta ao aprovado
    //   2) POST /api/sync-agent → cérebro reconstruído da fonte
    //   3) ?padrao=1        → prova, 17/17
    const ccOuro = snap.config.conversation_config || {};
    const ccVolta = {};
    if (ccOuro.tts) ccVolta.tts = ccOuro.tts;
    if (ccOuro.language_presets) ccVolta.language_presets = ccOuro.language_presets;
    if (!Object.keys(ccVolta).length) {
      return json({ ok: false, erro: "a referência-ouro não tem voz nem presets — nada foi alterado" }, 409);
    }
    const corpoVolta = { conversation_config: ccVolta };
    let pr2;
    try {
      pr2 = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(alvo)}`, {
        method: "PATCH", headers: { ...h, "Content-Type": "application/json" }, body: JSON.stringify(corpoVolta),
      });
    } catch (e) {
      return json({ ok: false, erro: `PATCH não saiu: ${(e && e.message) || e}` }, 503);
    }
    if (!pr2.ok) {
      const corpo = await pr2.text().catch(() => "");
      return json({ ok: false, erro: `PATCH falhou: HTTP ${pr2.status}`, corpo: corpo.slice(0, 300) }, 503);
    }
    // RELEITURA — a ElevenLabs já respondeu 200 e guardou null (foi assim que o language_detection
    // sumiu). "Voltou" só vale com o agente lido DEPOIS de aplicar.
    const vr = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(alvo)}`, { headers: h });
    // PORTÃO DE STATUS antes do fallback: sem ele um 500 da ElevenLabs vira `{}`, e `{}` vira
    // "voz: null" — a tela diria que o rollback apagou a voz quando na verdade não deu pra LER.
    if (!vr.ok) return json({ ok: false, voltou: true, verificado: false,
      motivo: `não deu pra reler o agente (ElevenLabs HTTP ${vr.status}) — o rollback foi aplicado, mas não confirmei` });
    const vd = await vr.json().catch(() => ({}));
    const vozAgora = vd?.conversation_config?.tts?.voice_id || null;
    const vozOuro = snap.config?.conversation_config?.tts?.voice_id || null;
    return json({ ok: true, voltou: true, snapshot_id: snap.id, congelado_em: snap.criado_em, rotulo: snap.rotulo,
      prova: { voz_esperada: vozOuro, voz_agora: vozAgora, bateu: vozAgora === vozOuro },
      falta_fazer: "cérebro NÃO foi tocado aqui: rode POST /api/sync-agent para reconstruí-lo da fonte, depois ?padrao=1 para provar",
      recado: "confira também ?padrao=1&agent_id=" + alvo });
  }

  // ?padrao=1&agent_id=… — O AGENTE ESTÁ DENTRO DA NORMA? (2026-08-18)
  // Nasce do pedido do Luis: "criar um padrão e o que mudar onde mudar, pra parar de ficar mudando
  // toda hora". A norma escrita vive em AGENTE-PADRAO.md; ESTE código é a mesma norma EXECUTÁVEL —
  // cada item aqui saiu de um incidente real que custou ligação. Documento que ninguém consegue
  // rodar vira decoração; por isso o padrão tem um comando.
  // Agente novo só vai ao ar com 100%.
  if (url.searchParams.get("padrao") === "1") {
    const alvo = (url.searchParams.get("agent_id") || "").trim();
    if (!alvo) return json({ error: "agent_id obrigatório" }, 400);
    const h = { "xi-api-key": env.ELEVENLABS_API_KEY };
    const r = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(alvo)}`, { headers: h });
    if (!r.ok) return json({ ok: false, erro: `HTTP ${r.status}` }, 503);
    const d = await r.json().catch(() => ({}));
    // A NORMA MORA EM `lib/padraoAgente.js` (2026-08-21). Ela vivia aqui dentro — e uma regra que
    // só roda quando alguém digita a URL à mão nunca rodou. Agora esta rota e a VARREDURA HORÁRIA
    // leem os MESMOS 17 itens: uma norma, dois leitores, zero chance de divergirem.
    const p2 = conferePadrao(d);
    return json({
      ok: true, agente: p2.agente, agent_id: alvo,
      conforme: p2.conforme,
      placar: `${p2.passou}/${p2.total}`,
      falhas: p2.falhas,
      itens: p2.itens,
      norma: "AGENTE-PADRAO.md",
    });
  }

  // ?vozes=pt — CANDIDATAS de voz na biblioteca pública, ESTÚDIO primeiro (2026-08-18).
  // Existe porque "essa voz tem eco" não aparece em metadado nenhum: a escolha final é do ouvido
  // do dono. Isto lista as melhores candidatas COM o link de prévia, para escolher ouvindo.
  const vozesLang = url.searchParams.get("vozes");
  if (vozesLang) {
    const qs = new URLSearchParams({ page_size: "40", language: vozesLang, gender: "female" });
    const r = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${qs}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
    // Sem portão, falha de rede devolveria lista VAZIA — e "nenhuma voz disponível" é uma acusação
    // sobre o catálogo da ElevenLabs feita a partir de um erro nosso.
    if (!r.ok) return json({ ok: false, vozes: [], motivo: `catálogo de vozes indisponível (HTTP ${r.status})` });
    const d = await r.json().catch(() => ({}));
    const all = Array.isArray(d?.voices) ? d.voices : [];
    const br = all.filter((v) => /brazil|brasil/i.test(`${v.accent || ""} ${v.name || ""} ${v.description || ""}`));
    const studio = (v) => (String(v.category || "") === "professional" ? 1 : 0);
    br.sort((a, b) => studio(b) - studio(a) || (b.cloned_by_count || 0) - (a.cloned_by_count || 0));
    return json({ ok: true, lang: vozesLang, candidatas: br.slice(0, 8).map((v) => ({
      voice_id: v.voice_id, nome: v.name, categoria: v.category,
      sotaque: v.accent || null, idade: v.age || null, usos: v.cloned_by_count || 0,
      descricao: (v.description || "").slice(0, 140), previa: v.preview_url || null,
    })) });
  }

  // ?adicionar_voz=<voice_id> — TRAZ uma voz pública PARA A CONTA (2026-08-18).
  // ⚠️ FIXAR UM voice_id NÃO BASTA. Eu fixei a Nina no código, o agente passou a declarar o id
  // dela, e a ligação saiu com VOZ MASCULINA: voz pública que não foi adicionada à conta não
  // toca, e a ElevenLabs cai na voz BASE do agente (no agente de demo, um homem). O id no
  // cadastro parecia certo e o ouvido dizia outra coisa — de novo a diferença entre "configurado"
  // e "funciona". Adicionar é obrigatório e é isto que esta rota faz, com prova na leitura de volta.
  const addVoice = url.searchParams.get("adicionar_voz");
  if (addVoice) {
    const h = { "xi-api-key": env.ELEVENLABS_API_KEY };
    // 1) achar o dono público (a API de adicionar exige public_owner_id + voice_id)
    const lang = url.searchParams.get("lang") || "pt";
    // busca nas DUAS listas (com e sem filtro de gênero): a biblioteca é paginada e a voz
    // escolhida veio da lista feminina — procurar só na genérica devolvia "não encontrada".
    let alvo = null;
    for (const extra of [{ gender: "female" }, {}]) {
      const qs = new URLSearchParams({ page_size: "80", language: lang, ...extra });
      const sr = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${qs}`, { headers: h });
      // 200 é obrigatório para concluir "não achei essa voz". Sem o portão, um 429 (limite de taxa)
      // seria lido como "a voz não existe" e o agente ficaria sem a voz escolhida, calado.
      if (!sr.ok) continue;
      const sd = await sr.json().catch(() => ({}));
      alvo = (sd?.voices || []).find((v) => v.voice_id === addVoice);
      if (alvo) break;
    }
    if (!alvo) return json({ ok: false, erro: "voz não encontrada na biblioteca pública", voice_id: addVoice }, 404);
    const nome = (url.searchParams.get("nome") || `Guileo ${lang} v3 · ${alvo.name}`).slice(0, 60);
    // 2) adicionar à conta
    const ar = await fetch(`https://api.elevenlabs.io/v1/voices/add/${encodeURIComponent(alvo.public_owner_id)}/${encodeURIComponent(addVoice)}`, {
      method: "POST", headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ new_name: nome }),
    });
    const at = await ar.text();
    // 3) PROVA: reler a conta e confirmar que ela está lá de verdade
    const vr = await fetch("https://api.elevenlabs.io/v1/voices", { headers: h });
    const vd = vr.ok ? await vr.json().catch(() => ({})) : {};
    const naConta = (vd?.voices || []).find((v) => v.voice_id === addVoice || (v.name || "").includes(alvo.name));
    return json({
      ok: ar.ok, http: ar.status, detalhe: ar.ok ? undefined : at.slice(0, 300),
      pedida: { voice_id: addVoice, nome: alvo.name, sotaque: alvo.accent },
      na_conta: naConta ? { voice_id: naConta.voice_id, nome: naConta.name } : null,
      veredito: naConta ? "está na conta — pode ser usada" : "⚠️ NÃO apareceu na conta",
    });
  }

  // ?frota=1 — QUEM ATENDE CADA NÚMERO, e o estado de idioma de CADA agente.
  // Nasceu de um erro meu: consertei um agente e disse "pronto", mas quem atende a ligação é o
  // agente VINCULADO AO NÚMERO — e já houve um caso em que os números apontavam para outro dono.
  // Consertar o agente certo e ligar para o número errado dá exatamente o mesmo sintoma de "não
  // funcionou", e nenhuma quantidade de conserto no agente errado resolve.
  if (url.searchParams.get("frota") === "1") {
    const h = { "xi-api-key": env.ELEVENLABS_API_KEY };
    const [pnR, agR] = await Promise.all([
      fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", { headers: h }),
      fetch("https://api.elevenlabs.io/v1/convai/agents?page_size=100", { headers: h }),
    ]);
    const pn = pnR.ok ? await pnR.json().catch(() => []) : [];
    const ag = agR.ok ? await agR.json().catch(() => ({})) : {};
    const lista = Array.isArray(ag?.agents) ? ag.agents : [];
    // o estado de idioma exige abrir cada agente — a listagem não traz conversation_config
    const detalhes = await Promise.all(lista.slice(0, 25).map(async (a) => {
      const r = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${a.agent_id}`, { headers: h });
      if (!r.ok) return { agent_id: a.agent_id, nome: a.name, erro: `HTTP ${r.status}` };
      const j = await r.json().catch(() => ({}));
      const cc = j?.conversation_config || {};
      const p = cc?.agent?.prompt || {};
      return {
        agent_id: a.agent_id, nome: a.name,
        idioma_base: cc?.agent?.language || null,
        motor_base: cc?.tts?.model_id || null,
        troca_de_idioma: !!(p?.built_in_tools?.language_detection
          || (p?.tools || []).some((t) => t?.name === "language_detection")),
        idiomas: Object.keys(cc?.language_presets || {}).length,
        prompt_chars: (p?.prompt || "").length,
      };
    }));
    return json({
      ok: true,
      numeros: (Array.isArray(pn) ? pn : []).map((n) => ({
        numero: n.phone_number, rotulo: n.label || null,
        atendido_por: n.assigned_agent?.agent_id || null,
        nome_do_agente: n.assigned_agent?.agent_name || null,
      })),
      agentes: detalhes,
    });
  }

  // ?ligacao=1[&agent_id=…] — A TRANSCRIÇÃO DA ÚLTIMA LIGAÇÃO, com o IDIOMA de cada fala.
  // Existe porque "não funcionou" não é diagnóstico: sem ler o que a pessoa FALOU e o que a agente
  // RESPONDEU, eu fico trocando configuração no escuro e devolvendo "arrumei" três vezes seguidas.
  // O campo que importa é o idioma detectado por turno — é ele que diz se a troca disparou, se
  // disparou para a língua errada, ou se nunca foi tentada.
  if (url.searchParams.get("ligacao") === "1") {
    const h = { "xi-api-key": env.ELEVENLABS_API_KEY };
    const alvo = (url.searchParams.get("agent_id") || "").trim();
    const lr = await fetch(`https://api.elevenlabs.io/v1/convai/conversations?page_size=${alvo ? 20 : 10}${alvo ? `&agent_id=${encodeURIComponent(alvo)}` : ""}`, { headers: h });
    if (!lr.ok) return json({ ok: false, erro: `lista HTTP ${lr.status}`, detalhe: (await lr.text().catch(() => "")).slice(0, 300) }, 503);
    const lista = (await lr.json().catch(() => ({})))?.conversations || [];
    if (!lista.length) return json({ ok: true, nenhuma_ligacao: true, agent_id: alvo || null });
    const quantas = Math.min(Number(url.searchParams.get("n") || 1) || 1, 5);
    const detalhes = await Promise.all(lista.slice(0, quantas).map(async (c) => {
      const r = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(c.conversation_id)}`, { headers: h });
      if (!r.ok) return { id: c.conversation_id, erro: `HTTP ${r.status}` };
      const d = await r.json().catch(() => ({}));
      const tr = Array.isArray(d.transcript) ? d.transcript : [];
      return {
        id: c.conversation_id,
        agente: c.agent_name || null,
        quando_unix: c.start_time_unix_secs || null,
        duracao_s: c.call_duration_secs ?? null,
        status: d.status || c.status || null,
        // idioma por turno + o texto: é a prova de que a troca aconteceu (ou não)
        falas: tr.map((t) => ({
          quem: t.role,
          idioma: t.language || t.detected_language || null,
          texto: String(t.message || "").slice(0, 220),
          ferramentas: (t.tool_calls || []).map((x) => x.tool_name || x.name),
        })),
        idiomas_vistos: [...new Set(tr.map((t) => t.language || t.detected_language).filter(Boolean))],
        ferramentas_usadas: [...new Set(tr.flatMap((t) => (t.tool_calls || []).map((x) => x.tool_name || x.name)))],
      };
    }));
    return json({ ok: true, ligacoes: detalhes });
  }

  const email = (url.searchParams.get("email") || "").trim().toLowerCase();
  let agentId = (url.searchParams.get("agent_id") || "").trim();
  let banco = null;
  if (!agentId) {
    if (!email) return json({ error: "email ou agent_id obrigatório" }, 400);
    banco = await lerAgentIdPorEmail(email);
    agentId = banco?.agent_id || "";
    if (!agentId) return json({ error: "cliente sem agente vinculado", email }, 404);
  }

  const r = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
    headers: { "xi-api-key": env.ELEVENLABS_API_KEY },
  });
  const txt = await r.text().catch(() => "");
  if (!r.ok) return json({ ok: false, erro_do_provedor: `HTTP ${r.status}`, detalhe: txt.slice(0, 500) }, 503);

  let bruto;
  try { bruto = JSON.parse(txt); } catch { return json({ ok: false, erro: "resposta não-JSON do provedor", amostra: txt.slice(0, 200) }, 503); }

  const cc = bruto?.conversation_config || {};
  const presets = cc?.language_presets || {};
  const prompt = cc?.agent?.prompt?.prompt || "";

  // RESUMO DOS PONTOS QUE JÁ QUEBRARAM DE VERDADE — cada linha aqui nasceu de um defeito real,
  // não de "seria bom ver". O objeto cru vai junto para eu nunca depender só deste resumo.
  const resumo = {
    nome_na_elevenlabs: bruto?.name || null,
    idioma_base: cc?.agent?.language || null,
    motor_base: cc?.tts?.model_id || null,               // o monolíngue inglês morava AQUI
    voz_base: cc?.tts?.voice_id || null,
    llm: cc?.agent?.prompt?.llm || null,                 // qual cérebro pensa (afeta multilíngue)
    temperatura: cc?.agent?.prompt?.temperature ?? null,
    primeira_fala: cc?.agent?.first_message || null,
    troca_de_idioma_ligada: !!(cc?.agent?.prompt?.built_in_tools?.language_detection
      || cc?.agent?.built_in_tools?.language_detection),  // sem isto, detecta e não troca
    idiomas: Object.keys(presets).sort(),
    por_idioma: Object.fromEntries(Object.keys(presets).sort().map((k) => [k, {
      motor: presets[k]?.overrides?.tts?.model_id || "(herda a base)",
      voz: presets[k]?.overrides?.tts?.voice_id || "(herda a base)",
      primeira_fala: presets[k]?.overrides?.agent?.first_message || "(herda a base)",
    }])),
    ferramentas: (cc?.agent?.prompt?.tools || []).map((t) => t?.name || t?.type || "?"),
    tamanho_do_prompt: prompt.length,
    base_de_conhecimento: (cc?.agent?.prompt?.knowledge_base || []).length,
  };

  return json({ ok: true, agent_id: agentId, email: email || null, banco, resumo, bruto });
}
