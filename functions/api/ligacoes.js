// Cloudflare Pages Function — POST /api/ligacoes
//
// "EU LIGUEI. CADÊ OS DADOS?"  — a rota que responde ONDE a cadeia arrebentou.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// Em 2026-08-08 o Luis ligou e o banco não tinha absolutamente nada. Olhando só o banco existem
// DUAS explicações opostas para a mesma tela vazia:
//
//   (a) a ligação NUNCA CHEGOU  — operadora bloqueou, número sem agente, linha muda;
//   (b) a ligação ACONTECEU e NÃO FOI GRAVADA — webhook pós-ligação desligado ou falhando.
//
// As duas pedem consertos completamente diferentes, e o banco sozinho não distingue: ele é
// justamente a coisa sob suspeita. Perguntar para o banco se o banco recebeu é raciocínio
// circular. A saída é confrontar TRÊS FONTES INDEPENDENTES e achar o degrau que falta:
//
//   1. TWILIO      → o telefone chegou a tocar? (a operadora é dona desta verdade)
//   2. ELEVENLABS  → a agente atendeu e conversou? (a plataforma de voz é dona desta)
//   3. NOSSO BANCO → sobrou registro? (só aqui somos donos — e só aqui podemos ter errado)
//
// O diagnóstico sai da COMPARAÇÃO, não de nenhuma delas isolada:
//   · conversa na ElevenLabs sem linha no banco  → o webhook pós-ligação está quebrado;
//   · chamada na Twilio sem conversa na ElevenLabs → a ligação não chegou na agente;
//   · nada em lugar nenhum                        → a ligação não saiu do lado de quem discou.
//
// Só LÊ. Não liga, não grava, não gasta. Diagnóstico, nunca ação.
//
// ── ACESSO ───────────────────────────────────────────────────────────────────────────────────
// Porta do dono (mesma do /api/prontidao). Devolve metadado de ligação — quem ligou, quando,
// quanto durou. NUNCA transcrição: o conteúdo da conversa é do cliente do cliente, e um endpoint
// de diagnóstico não é lugar para dado de paciente.
import { json, isOwnerEmail, sameOrigin, rateLimited } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

// fetch NÃO lança em 4xx/5xx. Sem isto, uma chave errada viraria "nenhuma ligação encontrada" —
// a MESMA tela de "não ligou nenhuma vez". Confundir erro de leitura com ausência de dado é o
// jeito mais rápido de um diagnóstico apontar para o lugar errado.
async function ler(url, headers) {
  try {
    const r = await fetch(url, { headers });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, d };
  } catch (e) { return { ok: false, status: 0, d: { erro: String(e).slice(0, 120) } }; }
}

const hora = (ts) => {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/New_York", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
};

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "ligacoes", 20)) return json({ error: "muitas tentativas" }, 429);
    const b = await request.json().catch(() => ({}));
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.key || "").toString().trim();
    if (!isOwnerEmail(email, env)) return json({ error: "unauthorized" }, 401);
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);

    // ── DETALHE DE UMA CONVERSA (por que ela terminou assim?) ─────────────────────────────
    // METADADO DE ENCERRAMENTO, NUNCA TRANSCRIÇÃO. Saber que uma ligação morreu em 6 segundos não
    // serve de nada sem o MOTIVO; mas o que foi dito pertence ao cliente do cliente, e um
    // endpoint de diagnóstico não é lugar para isso. A linha é: por que terminou, sim; o que
    // falaram, não.
    if (b.detalhe) {
      if (!env.ELEVENLABS_API_KEY) return json({ error: "ELEVENLABS_API_KEY ausente" }, 501);
      const id = String(b.detalhe).slice(0, 80);
      const r = await ler(`https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(id)}`, { "xi-api-key": env.ELEVENLABS_API_KEY });
      if (!r.ok) return json({ error: `ElevenLabs recusou (HTTP ${r.status})` }, 502);
      const d = r.d || {};
      const meta = d.metadata || {};
      return json({
        conversa: id,
        agente: d.agent_id || null,
        situacao: d.status || null,
        segundos: meta.call_duration_secs ?? null,
        // O CAMPO QUE EXPLICA TUDO quando a ligação morre cedo: quem desligou e por quê.
        motivo_do_fim: meta.termination_reason || meta.call_termination_reason || null,
        erro_relatado: meta.error || null,
        // O NÚMERO DISCADO — é ele que diz de qual anúncio a pessoa veio, quando cada campanha
        // tem a sua própria linha. Vem com nome diferente conforme o caminho da chamada, então
        // tentamos a cadeia conhecida em vez de fixar um campo que some numa atualização.
        numero_discado: meta.phone_call?.agent_number || meta.phone_call?.to_number
          || meta.phone_call?.called_number || meta.phone_call?.twilio_to || null,
        quem_ligou: meta.phone_call?.external_number || null,
        // As CHAVES do objeto (sem os valores): permite descobrir o nome certo do campo sem
        // despejar dado pessoal num endpoint de diagnóstico.
        campos_da_chamada: meta.phone_call ? Object.keys(meta.phone_call) : [],
        trocas: Array.isArray(d.transcript) ? d.transcript.length : null,
        // Quem falou em cada troca, sem o QUE foi falado — mostra se a agente chegou a abrir a
        // boca ou se a ligação caiu antes da saudação.
        quem_falou: Array.isArray(d.transcript) ? d.transcript.slice(0, 12).map((t) => t.role) : [],
        avaliacao_da_plataforma: d.analysis?.call_successful ?? null,
        ferramentas_chamadas: Array.isArray(d.transcript)
          ? d.transcript.flatMap((t) => (t.tool_calls || []).map((x) => x.tool_name || x.name)).slice(0, 10)
          : [],
      });
    }

    const horas = Math.min(72, Math.max(1, Number(b.horas) || 24));
    const desde = Date.now() - horas * 3600000;

    // ── FONTE 1: TWILIO — o telefone tocou? ────────────────────────────────────────────────
    let twilio = { lido: false, motivo: "credenciais Twilio não configuradas", chamadas: [] };
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
      const auth = "Basic " + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
      const r = await ler(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls.json?PageSize=50`, { Authorization: auth });
      if (!r.ok) twilio = { lido: false, motivo: `Twilio recusou a leitura (HTTP ${r.status}): ${(r.d?.message || "").slice(0, 120)}`, chamadas: [] };
      else {
        const todas = (r.d?.calls || []).filter((c) => new Date(c.date_created).getTime() >= desde);
        twilio = {
          lido: true,
          chamadas: todas.map((c) => ({
            quando: hora(c.date_created), de: c.from, para: c.to,
            direcao: c.direction, situacao: c.status, segundos: Number(c.duration || 0),
          })),
        };
      }
    }

    // ── FONTE 2: ELEVENLABS — a agente atendeu e conversou? ────────────────────────────────
    let eleven = { lido: false, motivo: "ELEVENLABS_API_KEY não configurada", conversas: [] };
    if (env.ELEVENLABS_API_KEY) {
      const r = await ler("https://api.elevenlabs.io/v1/convai/conversations?page_size=50", { "xi-api-key": env.ELEVENLABS_API_KEY });
      if (!r.ok) eleven = { lido: false, motivo: `ElevenLabs recusou a leitura (HTTP ${r.status})`, conversas: [] };
      else {
        const todas = (r.d?.conversations || []).filter((c) => (Number(c.start_time_unix_secs || 0) * 1000) >= desde);
        eleven = {
          lido: true,
          conversas: todas.map((c) => ({
            id: c.conversation_id,
            quando: hora(Number(c.start_time_unix_secs || 0) * 1000),
            agente: c.agent_name || c.agent_id,
            segundos: Number(c.call_duration_secs || 0),
            mensagens: Number(c.message_count || 0),
            situacao: c.status,
            // A ElevenLabs opina se a ligação "deu certo". É opinião dela, não veredito nosso —
            // vai crua para quem lê poder discordar.
            avaliacao_da_plataforma: c.call_successful ?? null,
          })),
        };
      }
    }

    // ── FONTE 3: NOSSO BANCO — sobrou registro? ────────────────────────────────────────────
    const rpc = (fn, args) => fetch(`${SB}/rest/v1/rpc/${fn}`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    let banco = { lido: false, motivo: "", eventos: [] };
    try {
      const r = await rpc("call_events_recentes", { p_secret: env.INGEST_SECRET || "", p_horas: horas });
      if (r.ok) { banco = { lido: true, eventos: (await r.json().catch(() => [])) || [] }; }
      else banco = { lido: false, motivo: `RPC call_events_recentes indisponível (HTTP ${r.status}) — falta db/ligacoes_diag.sql`, eventos: [] };
    } catch (e) { banco = { lido: false, motivo: String(e).slice(0, 120), eventos: [] }; }

    // ── O DIAGNÓSTICO SAI DA COMPARAÇÃO ───────────────────────────────────────────────────
    // Cada degrau só é acusado quando o degrau ANTERIOR foi lido com sucesso. Sem essa regra, uma
    // chave inválida na Twilio faria o relatório afirmar "a ligação nunca chegou" — trocando um
    // problema de credencial por um diagnóstico de produto, que é o erro mais caro deste arquivo.
    const nTw = twilio.chamadas.length, nEl = eleven.conversas.length, nBc = banco.eventos.length;
    let onde_arrebentou = null, veredito = "";

    if (!twilio.lido && !eleven.lido) {
      veredito = "NÃO DEU PARA DIAGNOSTICAR — não consegui ler nem a Twilio nem a ElevenLabs; sem elas, banco vazio não prova nada";
    } else if (!banco.lido) {
      // EU MESMO CAÍ NESTA, na primeira execução: o banco devolveu 401 (não lido) e a regra
      // abaixo, que só olhava `nBc === 0`, acusou o webhook pós-ligação de estar quebrado. Ele
      // estava perfeito — os registros existiam. Um diagnóstico que confunde "não consegui ler"
      // com "não tem dado" acusa o inocente com a mesma confiança com que acusaria o culpado,
      // e manda consertar o que está bom. Fonte não lida NUNCA vira acusação.
      veredito = `NÃO DEU PARA DIAGNOSTICAR o último degrau — a leitura do banco falhou (${banco.motivo}). Twilio: ${twilio.lido ? nTw : "não lida"}, ElevenLabs: ${eleven.lido ? nEl : "não lida"}`;
    } else if (nEl > 0 && nBc === 0) {
      onde_arrebentou = "webhook_pos_ligacao";
      veredito = `a ligação ACONTECEU (${nEl} conversa(s) na ElevenLabs) mas NADA foi gravado — o webhook pós-ligação não está entregando`;
    } else if (nTw > 0 && nEl === 0 && eleven.lido) {
      onde_arrebentou = "chamada_nao_chegou_na_agente";
      veredito = `o telefone tocou (${nTw} chamada(s) na Twilio) mas a agente nunca atendeu — número sem agente vinculado, ou a chamada morreu antes`;
    } else if (nTw === 0 && nEl === 0 && twilio.lido && eleven.lido) {
      onde_arrebentou = "nenhuma_ligacao_registrada";
      veredito = `nenhuma ligação nas últimas ${horas}h em NENHUMA das duas plataformas — a chamada não saiu de quem discou (operadora barrou, ou discou para um número que não é nosso)`;
    } else if (nEl > 0 && nBc > 0) {
      veredito = `cadeia inteira fechada: ${nEl} conversa(s) e ${nBc} registro(s) no banco`;
    } else {
      veredito = `leitura parcial — Twilio ${twilio.lido ? nTw : "não lida"}, ElevenLabs ${eleven.lido ? nEl : "não lida"}, banco ${banco.lido ? nBc : "não lido"}`;
    }

    // O DESFECHO COMERCIAL, ao lado do diagnóstico técnico. Os degraus abaixo respondem "a ligação
    // chegou?"; isto responde "a ligação VALEU?". Sem os dois juntos, uma cadeia tecnicamente
    // perfeita com zero agendamento continua parecendo saúde — foi o que aconteceu no Natura por
    // 14 ligações seguidas. `success` da ElevenLabs vai junto de propósito: ver o número que
    // mentia encostado no verdadeiro é o que faz alguém acreditar no verdadeiro.
    let desfecho = null;
    try {
      const dr = await svcRpc(env, "call_outcome_truth", { p_secret: env.SCHED_SECRET || "", p_email: email, p_days: 30 });
      if (dr.ok) { const d = await dr.json().catch(() => null); if (d && !d.error) desfecho = d; }
    } catch { /* diagnóstico técnico vale por si; o desfecho é um a mais */ }

    return json({
      janela_horas: horas,
      veredito,
      onde_arrebentou,
      desfecho_30d: desfecho,
      degraus: {
        "1_telefone_tocou_twilio": twilio.lido ? nTw : `NÃO LIDO — ${twilio.motivo}`,
        "2_agente_atendeu_elevenlabs": eleven.lido ? nEl : `NÃO LIDO — ${eleven.motivo}`,
        "3_ficou_gravado_no_banco": banco.lido ? nBc : `NÃO LIDO — ${banco.motivo}`,
      },
      twilio: twilio.chamadas,
      elevenlabs: eleven.conversas,
      banco: banco.eventos,
    });
  } catch (e) {
    return json({ error: String(e).slice(0, 200) }, 500);
  }
}
