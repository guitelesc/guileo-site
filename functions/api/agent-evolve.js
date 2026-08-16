// Cloudflare Pages Function — GET/POST /api/agent-evolve?token=DIGEST_TOKEN
//
// O MOTOR DE EVOLUÇÃO — a peça que faz um conserto chegar em TODOS os agentes, sozinho.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// O PROBLEMA QUE ELE RESOLVE
// O cérebro tem uma fonte só (functions/lib/licoes.js + buildGuiPrompt). Mas o cérebro que cada
// agente REALMENTE usa vive na ElevenLabs, e só muda quando alguém roda o sync daquele cliente.
// Resultado antes disto: eu consertava o idioma, e o agente de quem entrou mês passado continuava
// falando errado — para sempre, porque ninguém ia lembrar de re-sincronizar cliente por cliente.
// A frota se espalhava em versões diferentes e o produto piorava com o tempo em vez de melhorar.
//
// A REGRA QUE ISTO CRIA
//   agente novo  ⊇  agente antigo, SEMPRE.
//   Lição nova → sobe VERSAO em licoes.js → esta varredura acha quem ficou para trás e atualiza.
//   Ninguém precisa lembrar de nada. É o oposto de manutenção manual: é manutenção que acontece.
//
// POR QUE ELE NÃO RECONSTRÓI O CÉREBRO SOZINHO
// Ele chama /api/sync-agent, que já é o caminho oficial (KB + preços + voz nativa + nome da marca +
// as travas fail-closed). Duplicar essa lógica aqui criaria um segundo caminho que divergiria do
// primeiro no dia seguinte — e o agente atualizado pela varredura sairia diferente do agente
// atualizado pelo portal. Um motor que produz dois resultados não é motor, é sorteio.
//
// GATE: DIGEST_TOKEN (é o cron quem chama, não o navegador).
import { json, safeEq } from "../lib/guard.js";
import { svcJson, sbKey, SB_URL } from "../lib/sb.js";
import { CEREBRO_VERSAO, buildPlatformSettings } from "../lib/provision.js";

async function evoluir(request, env) {
  const url = new URL(request.url);
  const tok = url.searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
  // ── PORTÃO DUPLO (2026-08-12) ────────────────────────────────────────────────────────────────
  // Era só DIGEST_TOKEN, e isso tornou a ferramenta INUTILIZÁVEL — inclusive para o dono. Segredo
  // do Cloudflare Pages é gravado CRIPTOGRAFADO: ninguém lê de volta, nem pelo painel. Eu construí
  // um verificador que nem o Luis conseguia rodar, e só percebi quando ele perguntou "como faz?".
  // Trancar bem e trancar demais têm o mesmo diff e resultados opostos: o segundo vira um recurso
  // que existe e não serve — a mesma família da página órfã de hoje mais cedo.
  // Agora aceita QUALQUER um dos dois: o token do cron (automação) OU a senha do /admin (gente).
  // Mesmo padrão já usado em platform-status.js e admin-blitz.js — `_admin_ok` levanta exceção com
  // senha errada, então !ok = recusado. Nenhum caminho novo de autenticação foi inventado.
  let autorizado = !!env.DIGEST_TOKEN && safeEq(tok, env.DIGEST_TOKEN);
  if (!autorizado && tok) {
    const a = await svcJson(env, "_admin_ok", { p_token: tok }).catch(() => null);
    autorizado = a === true || a?.ok === true;
  }
  if (!autorizado) return json({ error: "unauthorized", dica: "use o token do cron OU a senha do /admin" }, 401);
  if (!env.INGEST_SECRET) return json({ ok: false, error: "INGEST_SECRET ausente — varredura recusada" }, 503);

  // `seco=1` mostra QUEM seria atualizado sem tocar em agente nenhum. Existe porque a alternativa é
  // testar uma varredura que reescreve o cérebro de todos os clientes de uma vez — e isso se testa
  // uma vez só, depois se pede desculpa.
  // ── `conferir=1` — PERGUNTA AO PROVEDOR, não ao nosso banco (2026-08-12) ──────────────────────
  // O buraco que isto fecha: `brain_version = 6` no nosso banco significa que NÓS gravamos 6. Não
  // significa que a ElevenLabs TEM a lição. Entre um e outro existe um PATCH por HTTP que pode ter
  // falhado, sido revertido, ou editado à mão no painel deles — e o nosso número continuaria
  // dizendo 6, tranquilo. É exatamente o formato de erro que persegui a sessão inteira: um valor
  // verdadeiro sobre a coisa errada.
  //
  // O Luis pediu "liga e testa". Eu não tenho microfone — não conduzo uma ligação. Mas o que a
  // ligação provaria (a lição está na boca da agente?) dá para perguntar direto ao provedor, que é
  // quem guarda o prompt. E vira melhor que a ligação: é repetível, não gasta minuto de voz, e
  // qualquer um pode rodar depois de qualquer mudança.
  //
  // Read-only: um GET por agente. Procura a FRASE-ÂNCORA da lição mais nova no prompt que está
  // realmente lá. Sem chave da ElevenLabs → devolve "não deu para provar" (nunca um falso ok).
  // ── `numeros=1` — DE QUEM É CADA NÚMERO (2026-08-16) ────────────────────────────────────────
  // O `conferir=1` mostrou DOIS números amarrados ao agente do Natura: o +1 929 828 8170, que está
  // no nosso `client_agents`, e um +1 406 800 0052 (Montana) que NÃO existe em nenhuma tabela nossa
  // — varri todas as colunas de texto/jsonb do banco procurando "4068000052" e deu zero.
  //
  // Um número desconhecido tocando num agente de CLIENTE PAGANTE não é curiosidade: quem discar
  // nele é atendido como se fosse o Natura, e a conta de voz sai do bolso do Luis. Achar o dono
  // exige perguntar às TRÊS fontes e mostrar as três respostas lado a lado — é exatamente por não
  // fazer isso que o alerta 📵 mentiu por semanas (ver o comentário do bloco do telefone abaixo).
  //
  // SÓ LEITURA. Esta rota não desamarra nada: desamarrar número de cliente pagante é decisão do
  // dono, e um diagnóstico que também age é um diagnóstico em que ninguém confia.
  // ── `identidade=1` — A AGENTE SABE QUEM ESTÁ LIGANDO? (2026-08-16) ──────────────────────────
  // O Luis ligou hoje e a agente pediu nome e telefone. O CRM tem ele: `+1 929 535 0191`, nome
  // "Luis", 14 visitas, atualizado por essa mesma ligação. Gravar funciona; ENTREGAR não.
  // O caminho existe: o agente é provisionado com `conversation_initiation_client_data_webhook`
  // apontando para /api/twilio-inbound, que devolve caller_name/caller_last/caller_note. Mas esse
  // bloco só é enviado quando AGENT_ACTION_SECRET existe na hora do provisionamento — quem nasceu
  // antes da chave nunca recebeu, e nada nunca conferiu. Esta sonda pergunta ao PROVEDOR.
  if (url.searchParams.get("identidade") === "1") {
    if (!env.ELEVENLABS_API_KEY) return json({ ok: false, nota: "sem ELEVENLABS_API_KEY" }, 503);
    // `cru=1&agente=ID` despeja o platform_settings INTEIRO. Quando a ligação cai e existem duas
    // hipóteses, adivinhar é o caminho mais caro — o provedor guarda a resposta, basta perguntar.
    // `conversas=1` — as últimas conversas do agente NO PROVEDOR, com status e motivo de término.
    // Quando o cliente diz "chama e cai", isto responde se a conversa chegou a existir e como
    // morreu. Sem isto, "cai" é um sintoma sem lugar: pode ser operadora, Twilio, ou aqui.
    if (url.searchParams.get("conversas") === "1") {
      const alvo = url.searchParams.get("agente") || "";
      const g = await fetch(`https://api.elevenlabs.io/v1/convai/conversations?agent_id=${alvo}&page_size=8`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
      if (!g.ok) return json({ ok: false, erro: `HTTP ${g.status}`, corpo: (await g.text().catch(()=> "")).slice(0,200) }, 502);
      const d = await g.json();
      return json({ ok: true, conversas: (d.conversations || []).map((c) => ({
        id: c.conversation_id, inicio: c.start_time_unix_secs, segundos: c.call_duration_secs,
        status: c.status, sucesso: c.call_successful, mensagens: c.message_count, direcao: c.direction,
      })) });
    }
    // `porque=ID` — o detalhe de UMA conversa. "failed, 0 segundos" é sintoma; o provedor guarda
    // o motivo. Perguntar é sempre mais barato que deduzir — e hoje eu já deduzi errado duas vezes.
    // `destravar=1` — REPARO DE EMERGÊNCIA do teto diário -1 (2026-08-16).
    // Manda call_limits com um teto POSITIVO de verdade. Não dá para "remover" o campo por PATCH
    // (a ElevenLabs faz merge), então o conserto é sobrescrever com um número que existe.
    // 5000/dia é folgado para qualquer negócio local e continua sendo um teto real — nenhum
    // tenant nosso chega perto, e ele protege contra loop de discagem.
    // `saudacao=1` — abre a torneira num agente JÁ EXISTENTE: insere {{caller_ola}} no fim da
    // primeira frase. Agente novo já nasce assim (GREETINGS em provision.js); este é o estoque.
    // Genérico de propósito: pega a frase que está lá e encaixa antes do "?" — não reescreve a
    // saudação do cliente, que pode ter sido ajustada à mão.
    if (url.searchParams.get("saudacao") === "1") {
      const so2 = (url.searchParams.get("so") || "").toLowerCase();
      const todos = await svcJson(env, "agentes_atrasados", { p_secret: env.INGEST_SECRET, p_versao: 999999, p_limite: 25 });
      const out = [];
      for (const a2 of ((todos && todos.lista) || [])) {
        if (!a2.agente || (so2 && (a2.cliente || "").toLowerCase() !== so2)) continue;
        const g = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${a2.agente}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
        if (!g.ok) { out.push({ cliente: a2.cliente, erro: `HTTP ${g.status}` }); continue; }
        const atual = (await g.json())?.conversation_config?.agent?.first_message || "";
        // DESFAZER É TÃO IMPORTANTE QUANTO FAZER — e hoje eu já precisei duas vezes.
        // `reverter=1` tira o {{caller_ola}} da frase. A ElevenLabs derruba a ligação quando a
        // saudação referencia uma variável dinâmica que ela não consegue resolver no início da
        // chamada: sem valor, a frase não renderiza e a conversa morre antes de atender.
        if (url.searchParams.get("reverter") === "1") {
          if (!atual.includes("caller_ola")) { out.push({ cliente: a2.cliente, ja_estava: "sem a variavel" }); continue; }
          const limpa = atual.replace(/\{\{caller_ola\}\}/g, "");
          const upr = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${a2.agente}`, {
            method: "PATCH", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ conversation_config: { agent: { first_message: limpa } } }),
          });
          let ficou = null;
          if (upr.ok) {
            const v = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${a2.agente}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
            if (v.ok) ficou = (await v.json())?.conversation_config?.agent?.first_message || "";
          }
          out.push({ cliente: a2.cliente, para: ficou,
            veredito: ficou && !ficou.includes("caller_ola") ? "✅ revertido (confirmado na releitura)" : `⚠️ NAO confirmado (${upr.status})` });
          continue;
        }
        if (atual.includes("caller_ola")) { out.push({ cliente: a2.cliente, ja_tinha: true, frase: atual }); continue; }

        // 🚨 TRAVA: NÃO ESCREVA {{variável}} NUMA SAUDAÇÃO SEM ELA ESTAR DECLARADA NO AGENTE.
        // Em 2026-08-16 eu pus {{caller_ola}} na primeira frase depois de declarar a variável em
        // provision.js — que é o código que NASCE agentes novos. O agente que já existia continuou
        // declarando só caller_name/last/note/phone, a ElevenLabs não conseguiu renderizar a frase,
        // e a ligação morreu antes de atender. Terceira vez no mesmo dia que eu conserto a causa e
        // esqueço o estoque; as duas anteriores só deixaram dado feio, esta derruba receita.
        // Por isso a ordem é DECLARAR → PROVAR QUE FICOU → só então usar. E se a prova falhar, a
        // saudação não é tocada: melhor ficar sem o nome do que sem a ligação.
        const jaTem = (g2) => Object.keys(g2?.conversation_config?.agent?.dynamic_variables?.dynamic_variable_placeholders || {});
        const decl = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${a2.agente}`, {
          method: "PATCH", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ conversation_config: { agent: { dynamic_variables: { dynamic_variable_placeholders: {
            caller_name: "", caller_last: "", caller_note: "", caller_phone: "", caller_ola: "",
          } } } } }),
        });
        let declaradas = [];
        if (decl.ok) {
          const v0 = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${a2.agente}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
          if (v0.ok) declaradas = jaTem(await v0.json());
        }
        if (!declaradas.includes("caller_ola")) {
          out.push({ cliente: a2.cliente, veredito: "🚫 RECUSADO — caller_ola não ficou declarada; saudação NÃO foi tocada", declaradas });
          continue;
        }
        // encaixa antes do último "?" (ou no fim, se a frase não terminar em pergunta)
        const i = atual.lastIndexOf("?");
        const nova = i >= 0 ? atual.slice(0, i) + "{{caller_ola}}" + atual.slice(i) : atual + "{{caller_ola}}";
        const up = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${a2.agente}`, {
          method: "PATCH", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ conversation_config: { agent: { first_message: nova } } }),
        });
        // relê: PATCH 200 não é prova de nada (a ElevenLabs faz merge e já me enganou hoje)
        let ficou = null;
        if (up.ok) {
          const v = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${a2.agente}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
          if (v.ok) ficou = (await v.json())?.conversation_config?.agent?.first_message || "";
        }
        out.push({ cliente: a2.cliente, de: atual, para: ficou,
          veredito: ficou && ficou.includes("caller_ola") ? "✅ nome encaixado" : `⚠️ não confirmado (${up.status})` });
      }
      return json({ ok: true, saudacao: true, agentes: out });
    }
    if (url.searchParams.get("destravar") === "1") {
      const todos = await svcJson(env, "agentes_atrasados", { p_secret: env.INGEST_SECRET, p_versao: 999999, p_limite: 25 });
      const out = [];
      for (const a2 of ((todos && todos.lista) || [])) {
        if (!a2.agente) continue;
        const up = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${a2.agente}`, {
          method: "PATCH", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ platform_settings: { call_limits: { daily_limit: 5000, agent_concurrency_limit: 10, bursting_enabled: true } } }),
        });
        // NUNCA confie no 200: relê e mostra o teto que ficou de verdade.
        let teto = null;
        if (up.ok) {
          const v = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${a2.agente}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
          if (v.ok) teto = (await v.json())?.platform_settings?.call_limits?.daily_limit ?? null;
        }
        out.push({ cliente: a2.cliente, patch: up.ok ? "ok" : `HTTP ${up.status}`, teto_agora: teto,
          veredito: teto === 5000 ? "✅ destravado" : teto === -1 ? "🚨 AINDA -1 — continua recusando ligação" : `⚠️ teto=${teto}` });
      }
      return json({ ok: true, destravar: true, agentes: out });
    }
    if (url.searchParams.get("porque")) {
      const cid = url.searchParams.get("porque");
      const g = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${cid}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
      const txt = await g.text().catch(() => "");
      if (!g.ok) return json({ ok: false, erro: `HTTP ${g.status}`, corpo: txt.slice(0, 400) }, 502);
      let d = {}; try { d = JSON.parse(txt); } catch {}
      return json({ ok: true, conversa: cid, status: d.status,
        metadata: d.metadata ?? null, erro: d.error ?? d.failure_reason ?? null,
        inicio: d.metadata?.start_time_unix_secs ?? null,
        motivo_fim: d.metadata?.termination_reason ?? d.metadata?.error ?? null });
    }
    if (url.searchParams.get("cru") === "1") {
      const alvo = url.searchParams.get("agente") || "";
      const g = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${alvo}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
      if (!g.ok) return json({ ok: false, erro: `HTTP ${g.status}` }, 502);
      const d = await g.json();
      // `cru=1` agora traz o AGENTE INTEIRO em resumo — não só o pedaço que eu mexi. Olhar só onde
      // você mexeu é como procurar a chave debaixo do poste: em 2026-08-16 a ligação continuou
      // caindo depois de eu desfazer a minha mudança, e a causa estava fora do meu recorte.
      const cc = d?.conversation_config || {};
      return json({ ok: true, agente: alvo,
        resumo: {
          nome: d?.name || "",
          voz: cc?.tts?.voice_id || null, modelo_voz: cc?.tts?.model_id || null,
          idioma: cc?.agent?.language || null,
          primeira_fala: cc?.agent?.first_message || "",  // INTEIRA: cortar em 80 me fez ler '...' como 'não tem variável' e dar um ✅ falso
          tamanho_prompt: (cc?.agent?.prompt?.prompt || "").length,
          llm: cc?.agent?.prompt?.llm || null,
          ferramentas: (cc?.agent?.prompt?.tool_ids || []).length,
          base_conhecimento: (cc?.agent?.prompt?.knowledge_base || []).length,
          duracao_max: cc?.conversation?.max_duration_seconds ?? null,
          // AS VARIÁVEIS QUE O AGENTE DECLARA. Se a saudação usar uma que não está aqui, a
          // ElevenLabs não consegue renderizar a primeira frase e a LIGAÇÃO MORRE antes de atender
          // — foi o que aconteceu em 2026-08-16 com {{caller_ola}}.
          variaveis_declaradas: Object.keys(cc?.agent?.dynamic_variables?.dynamic_variable_placeholders || {}),
          text_only: cc?.conversation?.text_only ?? null,
        },
        platform_settings: d?.platform_settings ?? null });
    }
    const todos = await svcJson(env, "agentes_atrasados", { p_secret: env.INGEST_SECRET, p_versao: 999999, p_limite: 25 });
    const linhas = [];
    // `so=<email>` limita a ação a UM cliente. Existe porque em 2026-08-16 eu apliquei uma
    // configuração inédita na frota inteira — incluindo o cliente pagante — e derrubei as ligações.
    // Cobaia primeiro, cliente depois; e a cobaia precisa ter TELEFONE para a prova ser uma ligação
    // de verdade (o e2e-test não tem, então a cobaia é a linha de demo da própria Guileo).
    const so = (url.searchParams.get("so") || "").toLowerCase();
    for (const a of ((todos && todos.lista) || [])) {
      if (!a.agente) continue;
      if (so && (a.cliente || "").toLowerCase() !== so) continue;
      try {
        const g = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${a.agente}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
        if (!g.ok) { linhas.push({ cliente: a.cliente, erro: `HTTP ${g.status}` }); continue; }
        const d = await g.json();
        const w = d?.platform_settings?.workspace_overrides?.conversation_initiation_client_data_webhook;
        linhas.push({
          cliente: a.cliente, agente: a.agente,
          webhook_de_identidade: w?.url || null,
          tem_segredo: !!(w?.request_headers && Object.keys(w.request_headers).length),
          // sem o webhook, os placeholders chegam vazios e a agente PERGUNTA o que já sabemos
          veredito: w?.url ? "recebe quem está ligando" : "❌ NÃO recebe — vai perguntar nome e telefone",
        });
        // `corrigir=1` instala o bloco nos que estão sem. Usa buildPlatformSettings — o MESMO
        // construtor do provisionamento — porque uma segunda versão do payload aqui divergiria da
        // primeira no dia seguinte, e aí agente novo e agente consertado sairiam diferentes.
        // `reverter=1` TIRA o bloco. Existe porque em 2026-08-16, minutos depois de instalar, a
        // ligação passou a CAIR: se o webhook de iniciação não responde do jeito que a ElevenLabs
        // espera, ela não inicia a conversa — e o cliente ouve o telefone cair. Restaurar serviço
        // vem antes de entender a causa; o desfazer tem que ser tão rápido quanto o fazer.
        if (w?.url && url.searchParams.get("reverter") === "1") {
          // ⚠️ OMITIR NÃO APAGA. A 1ª tentativa mandou platform_settings SEM workspace_overrides e
          // a ElevenLabs devolveu 200 — mas ela faz MERGE, não substituição, e o webhook continuou
          // lá. "PATCH ok" descrevia a requisição, não o estado. Só a releitura pegou. Para apagar
          // é preciso mandar o campo explicitamente nulo.
          const up = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${a.agente}`, {
            method: "PATCH", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ platform_settings: { ...buildPlatformSettings(env), workspace_overrides: { conversation_initiation_client_data_webhook: null } } }),
          });
          // E o veredito NÃO é o status: relê o agente e confirma que sumiu de verdade.
          let sumiu = null;
          if (up.ok) {
            const v = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${a.agente}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
            if (v.ok) sumiu = !((await v.json())?.platform_settings?.workspace_overrides?.conversation_initiation_client_data_webhook?.url);
          }
          linhas[linhas.length - 1].correcao = !up.ok ? `recusou HTTP ${up.status}`
            : sumiu === true ? "revertido (confirmado na releitura)"
            : sumiu === false ? "⚠️ PATCH aceito MAS o webhook continua lá"
            : "PATCH aceito, não deu para reler";
        }
        if (!w?.url && url.searchParams.get("corrigir") === "1") {
          const ps = buildPlatformSettings(env);
          if (!ps.workspace_overrides) { linhas[linhas.length - 1].correcao = "sem AGENT_ACTION_SECRET — não dá para instalar"; }
          else {
            const up = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${a.agente}`, {
              method: "PATCH", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
              body: JSON.stringify({ platform_settings: ps }),
            });
            linhas[linhas.length - 1].correcao = up.ok ? "instalado" : `recusado HTTP ${up.status}: ${(await up.text().catch(() => "")).slice(0, 140)}`;
          }
        }
      } catch (e) { linhas.push({ cliente: a.cliente, erro: String(e).slice(0, 80) }); }
    }
    return json({ ok: true, identidade: true, agentes: linhas });
  }

  if (url.searchParams.get("numeros") === "1") {
    if (!env.ELEVENLABS_API_KEY) return json({ ok: false, nota: "sem ELEVENLABS_API_KEY" }, 503);
    const out = { ok: true, numeros: true, elevenlabs: null, twilio: null, banco: null, veredito: [] };

    // 1ª FONTE — o provedor de voz: quem toca quando alguém disca.
    try {
      const p = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
      if (!p.ok) out.elevenlabs = { erro: `HTTP ${p.status}` };
      else {
        const arr = await p.json();
        out.elevenlabs = (Array.isArray(arr) ? arr : []).map((n) => ({
          numero: n?.phone_number || "?", id: n?.phone_number_id || "",
          provedor: n?.provider || "?", rotulo: n?.label || "",
          agente: n?.assigned_agent?.agent_id || null, agente_nome: n?.assigned_agent?.agent_name || "",
        }));
      }
    } catch (e) { out.elevenlabs = { erro: String(e).slice(0, 90) }; }

    // 2ª FONTE — a operadora: o número foi COMPRADO nesta conta? Se não estiver aqui, ele entrou
    // na ElevenLabs por outra conta Twilio ou por SIP, e aí o dono é outra pessoa.
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
      try {
        const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
        const t = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json?PageSize=100`,
          { headers: { Authorization: `Basic ${auth}` } });
        if (!t.ok) out.twilio = { erro: `HTTP ${t.status}`, conta: env.TWILIO_ACCOUNT_SID.slice(0, 10) + "…" };
        else {
          const d = await t.json();
          out.twilio = { conta: env.TWILIO_ACCOUNT_SID.slice(0, 10) + "…",
            // voice_url É O QUE FAZ O TELEFONE TOCAR NA ELEVENLABS. Sem ele, ou apontando pro
            // lugar errado, a chamada chega na Twilio e MORRE — o cliente ouve "chama e cai".
            // Estava faltando neste relatório justamente no dia em que a ligação começou a cair.
            numeros: (d.incoming_phone_numbers || []).map((n) => ({ numero: n.phone_number, apelido: n.friendly_name, comprado: n.date_created, voice_url: n.voice_url || "", voice_method: n.voice_method || "", status_url: n.status_callback || "" })) };
        }
      } catch (e) { out.twilio = { erro: String(e).slice(0, 90) }; }
    } else out.twilio = { erro: "sem TWILIO_ACCOUNT_SID/AUTH_TOKEN neste ambiente" };

    // 3ª FONTE — nós: o que a Guileo acha que comprou e para quem.
    // ⚠️ LISTA VAZIA NÃO É "NÃO ACHEI" — É "NÃO LI". A 1ª versão usava `clients_list`, que NÃO
    // devolve o campo `number`: veio `[]`, o cruzamento comparou contra um conjunto vazio e os TRÊS
    // números receberam "ninguém no banco reivindica" — uma acusação inventada, porque o
    // `client_agents` tem o +1 929 828 8170 do Natura gravado. Foi o `fallback_esconde_erro`
    // acontecendo dentro do próprio diagnóstico que existe para achar erro. Agora: fonte que volta
    // vazia vira `null`, e `null` nunca vira veredito.
    let nosso = null;
    try {
      const k = sbKey(env);
      const r = await fetch(`${SB_URL}/rest/v1/client_agents?select=client_email,number`, {
        headers: { apikey: k, Authorization: `Bearer ${k}` },
      });
      if (r.ok) { const d = await r.json(); if (Array.isArray(d) && d.length) nosso = d; }
    } catch { /* fonte muda vira null, não vira zero */ }
    out.banco = nosso ? nosso.filter((c) => c && c.number).map((c) => ({ cliente: c.client_email, numero: c.number })) : null;

    // O CRUZAMENTO. Cada número do provedor recebe um veredito com as três respostas — nunca uma
    // conclusão sem mostrar de onde ela saiu.
    const soDigitos = (s) => (s || "").toString().replace(/\D/g, "");
    const naTwilio = new Set((out.twilio?.numeros || []).map((n) => soDigitos(n.numero)));
    const noBanco = new Set((out.banco || []).map((n) => soDigitos(n.numero)));
    for (const n of (Array.isArray(out.elevenlabs) ? out.elevenlabs : [])) {
      const d = soDigitos(n.numero);
      const t = out.twilio?.numeros ? naTwilio.has(d) : null;
      const b = out.banco ? noBanco.has(d) : null;
      out.veredito.push({
        numero: n.numero, provedor: n.provedor, rotulo: n.rotulo, agente: n.agente,
        na_nossa_twilio: t, no_nosso_banco: b,
        conclusao: t === false && b === false ? "ÓRFÃO — não é da nossa Twilio nem do nosso banco; entrou por fora"
          : t === false && b === true ? "no nosso banco mas NÃO na nossa Twilio — provavelmente da conta Twilio ANTIGA"
          : t === true && b === false ? "é nosso na Twilio mas ninguém no banco reivindica"
          : t === true && b === true ? "coerente nas três fontes"
          : "não deu para provar (alguma fonte não respondeu)",
      });
    }
    return json(out);
  }

  if (url.searchParams.get("conferir") === "1") {
    // ⚠️ A ÂNCORA TEM QUE SER A FRASE DA VERSÃO ATUAL — subiu VERSAO em licoes.js, troque aqui.
    // Em 2026-08-16 a v7 subiu e esta linha ficou na frase da v6: a conferência devolveu 4/4 ✅
    // provando que a frota tinha uma lição ANTIGA, e passaria igual se a nova não tivesse entrado.
    // Uma conferência que não pode falhar não é conferência — é decoração cara.
    const ancora = "PEÇA O E-MAIL QUANDO SÓ TIVER O TELEFONE";
    if (!env.ELEVENLABS_API_KEY) return json({ ok: false, conferir: true, nota: "sem ELEVENLABS_API_KEY — não deu para provar" }, 503);
    // ⚠️ NÃO INVENTE NOME DE RPC. Minha 1ª versão chamava `agent_ids_all`, que NÃO EXISTE — o mesmo
    // erro que cometi hoje de manhã com `agent_evals_latest` e que deixou o painel mentindo por 3
    // semanas. Peguei antes de subir porque conferi no pg_proc em vez de confiar na memória.
    // Aqui não precisa de função nova: pedir ao `agentes_atrasados` uma versão-alvo absurdamente
    // alta faz ele devolver a FROTA INTEIRA com id, versão e cliente. Reusar o que já existe é
    // sempre melhor que criar mais uma superfície para desatualizar.
    const todos = await svcJson(env, "agentes_atrasados", { p_secret: env.INGEST_SECRET, p_versao: 999999, p_limite: 25 });
    const ids = (todos && Array.isArray(todos.lista)) ? todos.lista : [];

    // ── O TELEFONE (2026-08-14) ────────────────────────────────────────────────────────────────
    // Segunda pergunta, mesma natureza da primeira: o nosso `client_agents.number` diz que a Lilian
    // atende no +1 929 828 8170. Isso significa que NÓS gravamos esse número — não que a ElevenLabs
    // tenha o número amarrado ao agente. O `el_phone_number_id` está NULO nos quatro, e foi por isso
    // que o alerta 📵 e o banco discordaram: um lia o vínculo do provedor, o outro o nosso registro.
    // Duas fontes discordando não se resolvem escolhendo a mais conveniente — se pergunta a quem
    // manda. Quem manda no toque do telefone é o provedor.
    //
    // ⚠️ `fetch` NÃO LEVANTA em erro HTTP (a lição que abriu 4 travas de uma vez no provisionamento).
    // Sem o `.ok`, um 401 viraria `lista vazia` → "nenhum agente tem número", que é uma acusação
    // grave feita a partir de uma chave errada. Falha aqui vira `null`, e `null` nunca vira veredito.
    let mapaTel = null, telErro = "";
    try {
      const p = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
      if (!p.ok) telErro = `HTTP ${p.status}`;
      else {
        const arr = await p.json();
        mapaTel = {};
        for (const n of (Array.isArray(arr) ? arr : [])) {
          const dono = n?.assigned_agent?.agent_id || "__sem_agente__";
          (mapaTel[dono] ||= []).push(n?.phone_number || n?.phone_number_id || "?");
        }
      }
    } catch (e) { telErro = String(e).slice(0, 80); }

    const linhas = [];
    for (const a of ids) {
      const id = a.agente;
      if (!id) continue;
      let temAncora = null, versaoBanco = a.versao ?? null, detalhe = "";
      try {
        const g = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${id}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
        if (!g.ok) { detalhe = `HTTP ${g.status}`; }
        else {
          const d = await g.json();
          const prompt = d?.conversation_config?.agent?.prompt?.prompt || "";
          temAncora = prompt.includes(ancora);
          detalhe = `prompt ${prompt.length} chars`;
        }
      } catch (e) { detalhe = String(e).slice(0, 80); }
      // `null` = não deu para provar (chave recusada, rede caiu). Vazio = provado que NÃO tem número.
      const tels = mapaTel === null ? null : (mapaTel[id] || []);
      linhas.push({
        cliente: a.cliente || "?", agente: id, banco_diz: versaoBanco,
        provedor_tem_a_licao: temAncora, detalhe,
        provedor_tem_numero: tels === null ? null : tels.length > 0,
        numeros: tels,
      });
    }
    // ── O SALDO DA VOZ (2026-08-14) ───────────────────────────────────────────────────────────
    // No mesmo dia em que a Anthropic zerou e derrubou TODA a IA de texto sem um alerta sequer,
    // a pergunta óbvia virou: e a voz? Ela roda em OUTRA conta, com OUTRO saldo, e o telefone é
    // o produto — se a ElevenLabs acabar, o cliente pagante para de ser atendido de verdade.
    // Ler agentes (acima) prova só que a CHAVE vale; não prova que sobrou caractere pra falar.
    // Aqui a gente pergunta a cota de fato, e devolve `null` se não der pra ler — nunca um ok.
    let saldo = null;
    try {
      const s = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
      if (s.ok) {
        const d = await s.json();
        const usados = Number(d?.character_count ?? 0), teto = Number(d?.character_limit ?? 0);
        saldo = {
          plano: d?.tier || "?", usados, teto,
          restam: teto ? teto - usados : null,
          usado_pct: teto ? Math.round((usados / teto) * 100) : null,
          renova_em: d?.next_character_count_reset_unix ? new Date(d.next_character_count_reset_unix * 1000).toISOString().slice(0, 10) : null,
        };
      } else saldo = { erro: `HTTP ${s.status}` };
    } catch (e) { saldo = { erro: String(e).slice(0, 80) }; }

    const provados = linhas.filter((l) => l.provedor_tem_a_licao === true).length;
    const negados = linhas.filter((l) => l.provedor_tem_a_licao === false).length;
    const mudos = linhas.filter((l) => l.provedor_tem_numero === false).length;
    return json({
      ok: negados === 0, conferir: true, versao_atual: CEREBRO_VERSAO, ancora,
      total: linhas.length, com_a_licao: provados, sem_a_licao: negados,
      nao_deu_pra_provar: linhas.length - provados - negados,
      saldo_voz: saldo,
      telefone: mapaTel === null
        ? { conferido: false, motivo: telErro || "sem resposta do provedor" }
        : { conferido: true, agentes_sem_numero: mudos, orfaos: mapaTel.__sem_agente__ || [] },
      agentes: linhas,
    });
  }

  const seco = url.searchParams.get("seco") === "1";
  // Teto por rodada: a ElevenLabs é um serviço de terceiro e uma frota grande de uma vez vira
  // rate-limit no meio, deixando metade atualizada e metade não — sem ninguém saber qual metade.
  // Como a lista vem ordenada pelos mais atrasados, parar no teto é seguro: a próxima rodada pega
  // o resto, e quem estava pior já subiu.
  const teto = Math.min(100, Math.max(1, Number(url.searchParams.get("teto")) || 25));

  const r = await svcJson(env, "agentes_atrasados", { p_secret: env.INGEST_SECRET, p_versao: CEREBRO_VERSAO, p_limite: teto });
  if (!r || r.erro_http || !r.ok) {
    return json({ ok: false, error: `não consegui ler quem está atrasado (${r?.erro_http || r?.detalhe || "?"})` }, 502);
  }
  const lista = Array.isArray(r.lista) ? r.lista : [];

  if (seco) {
    return json({ ok: true, seco: true, versao_atual: CEREBRO_VERSAO, total_atrasados: r.total_atrasados, nesta_rodada: lista.length, previa: lista });
  }
  if (!lista.length) return json({ ok: true, versao_atual: CEREBRO_VERSAO, atualizados: 0, nota: "frota inteira já está na versão atual" });

  const origem = url.origin;
  const atualizados = [], falhas = [];
  // SEQUENCIAL de propósito. Em paralelo, um rate-limit da ElevenLabs derrubaria vários syncs de uma
  // vez e as falhas viriam todas juntas sem dizer se o problema era o cliente ou o volume.
  for (const item of lista) {
    const cliente = (item?.cliente || "").toString();
    if (!cliente) continue;
    try {
      const sr = await fetch(`${origem}/api/sync-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guileo-secret": env.INGEST_SECRET },
        body: JSON.stringify({ email: cliente }),
      });
      // fetch NÃO lança em erro HTTP — sem esta leitura, um 502 da ElevenLabs contaria como sucesso
      // e o cliente ficaria marcado como atualizado carregando o cérebro velho. Já perdi um dia
      // inteiro com essa exata armadilha em outra rota.
      const corpo = await sr.json().catch(() => ({}));
      // O CARIMBO é a prova, não o HTTP 200: quem carimba é o sync, e só depois de a ElevenLabs
      // aceitar. Se `cerebro_versao` não voltou, alguma coisa passou sem atualizar de verdade.
      if (sr.ok && corpo?.ok && corpo?.cerebro_versao === CEREBRO_VERSAO) {
        atualizados.push({ cliente, de: item.versao, para: CEREBRO_VERSAO });
      } else {
        falhas.push({ cliente, http: sr.status, motivo: (corpo?.error || corpo?.detail || "sync não carimbou a versão").toString().slice(0, 160) });
      }
    } catch (e) {
      falhas.push({ cliente, motivo: String(e).slice(0, 120) });
    }
  }

  // AS FALHAS VOLTAM JUNTO e o total de atrasados também: uma varredura que só reporta sucesso
  // faz parecer trabalho concluído numa frota onde metade dos agentes continua velha.
  return json({
    ok: true,
    versao_atual: CEREBRO_VERSAO,
    total_atrasados_antes: r.total_atrasados,
    atualizados: atualizados.length,
    detalhe: atualizados,
    falhas,
    restam: Math.max(0, Number(r.total_atrasados || 0) - atualizados.length),
  });
}

export const onRequestGet = ({ request, env }) => evoluir(request, env);
export const onRequestPost = ({ request, env }) => evoluir(request, env);
