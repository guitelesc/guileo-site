// functions/lib/provaAgente.js — "ESTE AGENTE ATENDERIA UMA LIGAÇÃO AGORA?"
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ISTO EXISTE
// Até hoje a ÚNICA forma de saber se um agente de voz funciona era o dono pegar o telefone e
// discar. Em 2026-08-16 três mudanças minhas derrubaram a linha — inclusive a do único cliente
// PAGANTE — e ele descobriu ligando. Um produto de voz sem um jeito de perguntar "está de pé?"
// sem gastar uma ligação é um produto que só avisa que quebrou depois que o cliente já ouviu.
//
// A REGRA QUE ESTE ARQUIVO SEGUE (e que os incidentes de hoje escreveram)
//   1. "NÃO DEU PARA PROVAR" ≠ "ESTÁ BOM". Toda checagem que não conseguiu LER devolve
//      `nao_deu_pra_provar`, nunca um ✅. Confundir os dois foi o erro-mãe do dia: `[]` lido como
//      "não achei" quando era "não li"; `200` de PATCH lido como "mudou" quando era "recebi".
//   2. VALOR SENTINELA SÓ VIRA VEREDITO COM PROVA. `daily_limit: -1` tinha o comentário "sem
//      limite" e a ElevenLabs recusava TODA ligação com erro 4300 ("exceeded its daily call limit
//      of -1"). Onde eu TENHO a prova (o erro, palavra por palavra), o veredito é duro. Onde eu
//      não tenho — `agent_concurrency_limit: -1`, por exemplo, que pode mesmo significar "sem
//      limite" — o valor é reportado como SUSPEITO, não como defeito. Adivinhar o significado de
//      um sentinela é exatamente o que criou o incidente.
//   3. TODO PROBLEMA CARREGA O QUE FOI LIDO. `lido: { campo, valor }` mostra o dado cru do
//      provedor. Um diagnóstico sem a leitura ao lado é uma acusação, e hoje uma acusação
//      inventada ("ninguém no banco reivindica este número") já saiu de uma lista vazia.
//
// SEVERIDADE = EFEITO NA LIGAÇÃO, não gravidade sentimental:
//   · "derruba"    → a ligação NÃO acontece (ou morre com 0 segundo).
//   · "degrada"    → a ligação acontece e o negócio sai pior (inventa, não agenda, esquece quem é).
//   · "cosmetico"  → incomoda, não custa ligação nem venda.
//
// Este arquivo é PURO: não faz rede. Quem lê os provedores é functions/api/agente-prova.js.
// Assim o veredito é testável sem gastar ligação, sem chave e sem tocar em produção.
import { VERSAO } from "./licoes.js";

export const SEVERIDADE_PESO = { derruba: 3, degrada: 2, cosmetico: 1 };

// As checagens SEM as quais um "atenderia" seria chute. Se qualquer uma delas não pôde ser lida,
// o veredito é `null` (não deu para provar) — nunca `true`.
export const CHECAGENS_ESSENCIAIS = ["agente_lido", "teto_diario", "primeira_fala", "telefone_vinculado"];

// OS DESTINOS QUE REALMENTE ATENDEM. Não basta "contém elevenlabs".
// ⚠️ A 1ª versão exigia /elevenlabs/i no voice_url e teria acusado de MORTA a linha do único
// cliente pagante: o nosso próprio provisionamento grava `guileoai.com/api/twilio-voice`
// (provision.js) quando a chamada passa pelo nosso webhook antes da voz, e `twilio-numbers.js`
// já trata esse host como válido. Um verificador que reprova a configuração que a própria
// plataforma escreve não é rigor — é um alarme que ninguém vai acreditar da segunda vez.
// Destino fora desta lista continua sendo "derruba": aí é mesmo um número apontando para o nada.
const HOSTS_QUE_ATENDEM = ["elevenlabs.io", "guileoai.com/api/twilio-voice", "guileoai.com/api/twilio-inbound"];

// ── A ÂNCORA DA LIÇÃO ────────────────────────────────────────────────────────────────────────
// agent-evolve.js guarda a frase-âncora escrita à mão, e em 2026-08-16 ela ficou na frase da v6
// enquanto licoes.js já estava na v7: a conferência devolveu 4/4 ✅ provando uma lição ANTIGA.
// Aqui a âncora é DERIVADA da versão — o cabeçalho que `licoesPara()` sempre injeta traz `(vN)`.
// Não tem como esquecer de atualizar uma coisa que se atualiza sozinha.
export function ancoraLicao(versao = VERSAO) {
  return `LIGAÇÕES REAIS (v${versao})`;
}

// Variáveis {{assim}} que o texto usa. `system__*` são resolvidas pela própria ElevenLabs
// (system__caller_id, system__time…) e NÃO precisam ser declaradas — incluí-las aqui produziria
// acusação falsa em todo agente saudável.
export function variaveisDe(texto) {
  const achadas = new Set();
  for (const m of String(texto || "").matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
    if (!m[1].startsWith("system__")) achadas.add(m[1]);
  }
  return [...achadas];
}

const soDigitos = (s) => String(s || "").replace(/\D/g, "");

// ── O VERIFICADOR ────────────────────────────────────────────────────────────────────────────
// `leitura` é o que os provedores responderam (só GET). Formato:
//   {
//     cliente, agente_id,
//     agente:    { lido: bool, erro?: string, dados?: <JSON cru do GET /v1/convai/agents/:id> },
//     telefones: { lido: bool, erro?: string, lista?: [ {phone_number, assigned_agent:{agent_id}} ] },
//     twilio:    { lido: bool, erro?: string, numeros?: [ {phone_number, voice_url} ] },
//     saldo:     { lido: bool, erro?: string, usados?: n, teto?: n },
//     banco:     { versao?: n }
//   }
// Cada fonte traz `lido` explícito porque ausência de dado NÃO pode virar ausência de problema.
export function analisarAgente(leitura = {}, opcoes = {}) {
  const ancora = opcoes.ancora || ancoraLicao();
  // Um agente de voz-web (a demo do site) legitimamente não tem número. Quem chama decide.
  const esperaTelefone = opcoes.esperaTelefone !== false;

  const problemas = [];
  const naoProvado = [];
  const prob = (chave, severidade, o_que, campo, valor, provado_por) =>
    problemas.push({ chave, severidade, o_que, lido: { campo, valor }, provado_por });
  const semProva = (chave, motivo, campo, valor) =>
    naoProvado.push({ chave, motivo, ...(campo ? { lido: { campo, valor } } : {}) });

  const A = leitura.agente || {};
  const d = A.dados || {};
  const cc = d.conversation_config || {};
  const ps = d.platform_settings || {};

  if (!A.lido) {
    // Sem o agente não há checagem nenhuma: NÃO devolver problemas inventados nem um ok vazio.
    semProva("agente_lido", A.erro || "não deu para ler o agente no provedor");
    for (const c of CHECAGENS_ESSENCIAIS) if (c !== "agente_lido") semProva(c, "depende de ler o agente");
    return montar(leitura, problemas, naoProvado, ancora);
  }

  // ── 1. TETO DIÁRIO — o defeito que recusou TODA ligação em 2026-08-16 ──────────────────────
  const dl = ps?.call_limits?.daily_limit;
  if (dl === undefined || dl === null) {
    // Campo ausente = o provedor aplica o padrão dele. É o estado MAIS seguro (ver provision.js:
    // "na dúvida, NÃO MANDE O CAMPO"), então isto não é problema.
  } else if (typeof dl !== "number" || Number.isNaN(dl)) {
    semProva("teto_diario", "daily_limit veio num formato que não sei ler", "platform_settings.call_limits.daily_limit", dl);
  } else if (dl < 0) {
    prob("teto_diario", "derruba",
      "teto diário NEGATIVO: a ElevenLabs trata o valor como teto LITERAL e recusa toda ligação antes de atender",
      "platform_settings.call_limits.daily_limit", dl,
      'incidente 2026-08-16 — o provedor devolveu {"code":4300,"reason":"...exceeded its daily call limit of -1."}');
  } else if (dl === 0) {
    prob("teto_diario", "derruba", "teto diário ZERO: nenhuma ligação cabe abaixo dele",
      "platform_settings.call_limits.daily_limit", dl, "mesma mecânica do -1 (erro 4300)");
  } else if (dl < 5) {
    prob("teto_diario", "degrada", `teto diário de ${dl} ligação(ões)/dia — o negócio para no meio do dia`,
      "platform_settings.call_limits.daily_limit", dl, "leitura direta");
  }

  // Concorrência: -1 AQUI pode mesmo ser "sem limite" — eu NÃO confirmei com o provedor. Depois do
  // que o -1 do daily_limit custou, um sentinela não verificado vira SUSPEITA, nunca veredito.
  const cl = ps?.call_limits?.agent_concurrency_limit;
  if (typeof cl === "number" && cl <= 0) {
    semProva("concorrencia", "valor sentinela não verificado com o provedor — pode ser 'sem limite' ou um teto literal como o do daily_limit",
      "platform_settings.call_limits.agent_concurrency_limit", cl);
  }

  // ── 2. PRIMEIRA FALA — variável não declarada mata a ligação com 0 segundo ─────────────────
  const primeira = cc?.agent?.first_message ?? null;
  const declaradas = Object.keys(cc?.agent?.dynamic_variables?.dynamic_variable_placeholders || {});
  if (primeira === null || primeira === undefined) {
    semProva("primeira_fala", "o provedor não devolveu first_message", "conversation_config.agent.first_message", primeira);
  } else {
    const usadas = variaveisDe(primeira);
    const orfas = usadas.filter((v) => !declaradas.includes(v));
    if (orfas.length) {
      prob("primeira_fala", "derruba",
        `a saudação usa ${orfas.map((v) => `{{${v}}}`).join(", ")} que o agente NÃO declara — sem valor a frase não renderiza e a conversa morre antes de atender`,
        "conversation_config.agent.first_message", primeira,
        "incidente 2026-08-16 — {{caller_ola}} inserido sem placeholder: 3 ligações seguidas com 0 segundo e 0 mensagem");
    } else if (!String(primeira).trim()) {
      prob("primeira_fala", "degrada", "saudação vazia: o agente atende e fica mudo esperando a pessoa falar primeiro",
        "conversation_config.agent.first_message", primeira, "leitura direta");
    }
  }

  // ── 3. O CÉREBRO ──────────────────────────────────────────────────────────────────────────
  const prompt = cc?.agent?.prompt?.prompt;
  if (typeof prompt !== "string") {
    semProva("prompt", "o provedor não devolveu o prompt", "conversation_config.agent.prompt.prompt", prompt);
    semProva("licao_atual", "depende de ler o prompt");
  } else {
    // POR QUE prompt vazio é "degrada" e não "derruba": a ligação ACONTECE. O agente atende sem
    // saber nada do negócio e inventa — foi exatamente a ligação da Lilian (ofereceu serviço de
    // unhas num spa que não faz unhas). Custa cliente, não custa a chamada. Chamar de "derruba"
    // seria a mesma doença de hoje: um veredito verdadeiro sobre a coisa errada.
    if (!prompt.trim()) {
      prob("prompt", "degrada", "prompt VAZIO: o agente atende sem conhecimento nenhum do negócio e inventa serviço e preço",
        "conversation_config.agent.prompt.prompt", "", "ligação da Lilian 2026-08-07");
    } else if (prompt.length < 400) {
      prob("prompt", "degrada", `prompt de ${prompt.length} caracteres — curto demais para carregar conhecimento + preços + lições`,
        "conversation_config.agent.prompt.prompt (tamanho)", prompt.length, "buildGuiPrompt saudável passa de 6000 caracteres");
    }
    const orfasPrompt = variaveisDe(prompt).filter((v) => !declaradas.includes(v));
    if (orfasPrompt.length) {
      // Na saudação isto é PROVADO que derruba. No corpo do prompt eu não reproduzi o incidente —
      // então reporto o mesmo achado com a severidade que consigo sustentar, e digo isso na cara.
      prob("prompt_variaveis", "degrada",
        `o prompt usa ${orfasPrompt.map((v) => `{{${v}}}`).join(", ")} sem declarar — na saudação isso derruba a ligação; aqui não reproduzi o efeito`,
        "conversation_config.agent.prompt.prompt (variáveis)", orfasPrompt, "efeito NÃO confirmado com o provedor — tratar como suspeita forte");
    }
    if (!prompt.includes(ancora)) {
      prob("licao_atual", "degrada",
        `o cérebro no provedor não traz a lição mais recente (procurei "${ancora}") — este agente está falando por um caderno velho`,
        "conversation_config.agent.prompt.prompt (âncora)", ancora, "âncora derivada de licoes.js VERSAO, não escrita à mão");
    }
  }

  // ── 4. TELEFONE — ninguém liga para um agente sem número ───────────────────────────────────
  const T = leitura.telefones || {};
  let meusNumeros = [];
  if (!T.lido) {
    semProva("telefone_vinculado", T.erro || "não deu para listar os números no provedor de voz");
  } else {
    meusNumeros = (Array.isArray(T.lista) ? T.lista : [])
      .filter((n) => (n?.assigned_agent?.agent_id || "") === leitura.agente_id);
    if (!meusNumeros.length) {
      // ⚠️ SEM LINHA NÃO É LINHA QUEBRADA. Marcar isto como "derruba" fazia os 2 agentes internos
      // (que nunca tiveram número, por desenho) ficarem vermelhos para sempre, e a frota inteira
      // sair `ok:false` todo dia. Alarme que vive vermelho é alarme que se aprende a ignorar —
      // e aí ele deixa de servir justamente no dia em que a linha do pagante cai de verdade.
      // Vira um ESTADO próprio: este agente não é uma linha, então não entra na conta de quem
      // atende nem de quem caiu. Se um dia ele ganhar número, passa a ser cobrado como os outros.
      // Só é "sem linha" quando ESPERÁVAMOS um telefone. O agente de voz-web (a demo do site)
      // legitimamente não tem número e mesmo assim ATENDE — pelo navegador. Marcá-lo como
      // sem-linha apagaria a única coisa que ele sabe fazer.
      if (esperaTelefone) leitura.sem_linha = true;
    }
  }

  // ── 5. voice_url da Twilio — a chamada chega na operadora e MORRE se não apontar pra voz ───
  const W = leitura.twilio || {};
  if (meusNumeros.length) {
    if (!W.lido) {
      semProva("voice_url", W.erro || "não deu para ler os números na Twilio", "números do agente", meusNumeros.map((n) => n.phone_number));
    } else {
      const porDigito = new Map((Array.isArray(W.numeros) ? W.numeros : []).map((n) => [soDigitos(n.phone_number), n]));
      for (const n of meusNumeros) {
        const t = porDigito.get(soDigitos(n.phone_number));
        if (!t) {
          // NÃO É DEFEITO: o número pode ter entrado por SIP ou por outra conta Twilio. Acusar aqui
          // seria repetir a acusação inventada que a lista vazia produziu em 2026-08-16.
          semProva(`voice_url:${n.phone_number}`, "número não está NESTA conta Twilio (pode ser SIP ou conta antiga) — não dá para conferir o voice_url");
          continue;
        }
        const vu = String(t.voice_url || "");
        if (!vu) {
          prob("voice_url", "derruba", `${n.phone_number}: voice_url VAZIO na Twilio — quem discar cai antes de chegar na voz`,
            "twilio.incoming_phone_numbers.voice_url", "", "leitura direta da operadora");
        } else if (!HOSTS_QUE_ATENDEM.some((h) => vu.includes(h))) {
          prob("voice_url", "derruba", `${n.phone_number}: voice_url aponta para um destino DESCONHECIDO — a chamada chega na operadora e morre lá`,
            "twilio.incoming_phone_numbers.voice_url", vu, "leitura direta da operadora");
        }
      }
    }
  }

  // ── 6. O QUE DEGRADA (a ligação acontece, o negócio sai pior) ──────────────────────────────
  if (cc?.conversation?.text_only === true) {
    prob("text_only", "derruba", "agente marcado como SÓ TEXTO — não fala em ligação nenhuma",
      "conversation_config.conversation.text_only", true, "leitura direta");
  }
  const dur = cc?.conversation?.max_duration_seconds;
  if (typeof dur === "number" && dur <= 0) {
    semProva("duracao_max", "valor sentinela não verificado (0/negativo pode ser 'sem limite' ou corte imediato)",
      "conversation_config.conversation.max_duration_seconds", dur);
  } else if (typeof dur === "number" && dur < 60) {
    prob("duracao_max", "degrada", `a ligação é cortada em ${dur}s — não dá tempo de agendar`,
      "conversation_config.conversation.max_duration_seconds", dur, "leitura direta");
  }

  const ferramentas = (cc?.agent?.prompt?.tools || []).length + (cc?.agent?.prompt?.tool_ids || []).length;
  if (prompt !== undefined && ferramentas === 0) {
    prob("ferramentas", "degrada", "agente sem NENHUMA ferramenta: ele conversa mas não consulta preço, não checa agenda e não marca nada",
      "conversation_config.agent.prompt.tools/tool_ids", 0, "leitura direta");
  }

  const presets = cc?.language_presets;
  if (presets !== undefined && presets !== null && Object.keys(presets || {}).length === 0) {
    prob("idiomas", "degrada", "sem language_presets: o agente DETECTA o idioma do cliente e não consegue trocar — responde na língua errada",
      "conversation_config.language_presets", {}, "incidente dos idiomas (a Gui não trocava de idioma)");
  }

  const webhookId = ps?.workspace_overrides?.conversation_initiation_client_data_webhook?.url;
  if (!webhookId) {
    prob("identidade_do_chamador", "degrada", "sem webhook de iniciação: o agente não recebe quem está ligando e vai PERGUNTAR nome e telefone que o CRM já tem",
      "platform_settings.workspace_overrides.conversation_initiation_client_data_webhook.url", null, "ligação do Luis 2026-08-16");
  }

  if (!cc?.tts?.voice_id) {
    prob("voz", "cosmetico", "sem voice_id explícito — o agente fala com a voz padrão da conta, não com a voz escolhida pelo cliente",
      "conversation_config.tts.voice_id", cc?.tts?.voice_id ?? null, "leitura direta");
  }

  // ── 7. SALDO DA VOZ — vale para a frota inteira, não só para este agente ───────────────────
  const S = leitura.saldo || {};
  if (!S.lido) {
    semProva("saldo_voz", S.erro || "não deu para ler a cota da conta de voz");
  } else {
    const teto = Number(S.teto || 0), usados = Number(S.usados || 0);
    if (teto > 0 && usados >= teto) {
      prob("saldo_voz", "derruba", "a conta de voz ZEROU: não sobrou caractere para falar — nenhum agente atende",
        "GET /v1/user/subscription", { usados, teto }, "leitura direta do provedor");
    } else if (teto > 0 && usados / teto >= 0.9) {
      prob("saldo_voz", "degrada", `cota de voz em ${Math.round((usados / teto) * 100)}% — vai acabar no meio de uma ligação`,
        "GET /v1/user/subscription", { usados, teto }, "leitura direta do provedor");
    }
  }

  return montar(leitura, problemas, naoProvado, ancora);
}

function montar(leitura, problemas, naoProvado, ancora) {
  problemas.sort((a, b) => SEVERIDADE_PESO[b.severidade] - SEVERIDADE_PESO[a.severidade]);
  const derruba = problemas.filter((p) => p.severidade === "derruba");
  const essenciaisSemProva = naoProvado.filter((n) => CHECAGENS_ESSENCIAIS.includes(n.chave));

  // A ORDEM IMPORTA: "derruba" ganha de "não deu para provar" (um defeito PROVADO já responde a
  // pergunta), mas "não deu para provar" SEMPRE ganha de "está bom".
  // AGENTE SEM LINHA NÃO ENTRA NA CONTA. Ele não é uma linha que caiu — é uma linha que não
  // existe (agente de teste, agente de voz-web). Contá-lo como "não atende" pinta a frota de
  // vermelho todo dia e treina o dono a ignorar o alarme, que é como um alarme morre.
  const semLinha = leitura.sem_linha === true;
  const atende_agora = semLinha ? null
    : derruba.length ? false
    : essenciaisSemProva.length ? null : true;

  return {
    cliente: leitura.cliente || null,
    agente: leitura.agente_id || null,
    sem_linha: semLinha,
    atende_agora,
    veredito: semLinha ? "— sem número: ninguém consegue discar para este agente (não é uma linha)"
      : atende_agora === false ? "❌ NÃO atenderia uma ligação agora"
      : atende_agora === null ? "❓ não deu para provar — leitura incompleta, isto NÃO é um ok"
      : problemas.length ? "✅ atenderia — mas com defeitos que custam venda"
      : "✅ atenderia",
    ancora_usada: ancora,
    banco_diz_versao: leitura.banco?.versao ?? null,
    derruba_a_ligacao: derruba,
    degrada: problemas.filter((p) => p.severidade === "degrada"),
    cosmetico: problemas.filter((p) => p.severidade === "cosmetico"),
    nao_deu_pra_provar: naoProvado,
  };
}

// Resumo de frota. `ok` só é true quando NINGUÉM está caído E não sobrou checagem essencial sem
// leitura: uma frota "ok" com metade não lida é a mentira mais cara que este arquivo pode contar.
export function resumirFrota(resultados = []) {
  const linhas = resultados.filter((r) => !r.sem_linha);
  const semLinha = resultados.filter((r) => r.sem_linha);
  const caidos = linhas.filter((r) => r.atende_agora === false);
  const incertos = linhas.filter((r) => r.atende_agora === null);
  const dePe = linhas.filter((r) => r.atende_agora === true);
  return {
    // ⚠️ FROTA VAZIA NÃO É FROTA SAUDÁVEL. `caidos.length === 0` é verdade quando não há ninguém —
    // e um painel que fica verde por não ter lido nada é o mesmo engano que me custou o dia:
    // `[]` lido como "não achei" quando era "não li". Sem resultado, `ok` é null (não deu para
    // provar), nunca true. Quem chama tem que saber a diferença entre "está tudo de pé" e
    // "eu não consegui olhar".
    ok: linhas.length === 0 ? null : (caidos.length === 0 && incertos.length === 0),
    total: resultados.length,
    linhas: linhas.length,
    sem_linha: semLinha.length,
    atenderiam: dePe.length,
    nao_atenderiam: caidos.length,
    nao_deu_pra_provar: incertos.length,
    com_defeito_que_degrada: dePe.filter((r) => r.degrada.length).length,
    quem_nao_atenderia: caidos.map((r) => ({ cliente: r.cliente, agente: r.agente, por_que: r.derruba_a_ligacao.map((p) => p.o_que) })),
  };
}
