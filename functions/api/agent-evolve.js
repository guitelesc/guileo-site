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
import { CEREBRO_VERSAO } from "../lib/provision.js";

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
            numeros: (d.incoming_phone_numbers || []).map((n) => ({ numero: n.phone_number, apelido: n.friendly_name, comprado: n.date_created })) };
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
    const ancora = "NÃO EMPURRE PARA UM HUMANO QUE NINGUÉM AVISOU";
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
