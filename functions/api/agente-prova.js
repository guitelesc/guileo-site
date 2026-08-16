// Cloudflare Pages Function — GET/POST /api/agente-prova?token=DIGEST_TOKEN|senha do /admin
//
// A PROVA DE VIDA DO AGENTE — "este agente atenderia uma ligação AGORA?" sem gastar uma ligação.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// O PROBLEMA QUE ELE RESOLVE
// Até 2026-08-16, a única forma de saber se um agente de voz estava de pé era o dono discar. Três
// mudanças minhas derrubaram a linha no mesmo dia — uma delas na linha do único cliente PAGANTE —
// e ele descobriu ligando, depois de o telefone já ter caído para clientes de verdade. Testar por
// telefone também não escala: são minutos de voz por tentativa, um humano por vez, e ninguém
// re-testa a frota inteira depois de cada deploy.
//
// O QUE ESTA ROTA FAZ (e o que ela NÃO faz)
// Ela pergunta ao PROVEDOR o estado real de cada agente e confronta com a operadora e com o nosso
// banco. Não é simulação nem opinião sobre o código: é o que a ElevenLabs e a Twilio respondem
// agora. O veredito sai de functions/lib/provaAgente.js, que é puro e testado com payloads
// sintéticos (functions/lib/provaAgente.test.mjs) — inclusive com os quatro defeitos reais de hoje.
//
// 🔒 SÓ LEITURA. Todo fetch aqui é GET. Nenhum PATCH, POST ou DELETE em provedor nenhum, nunca —
// nem "para consertar de passagem". Um diagnóstico que também age é um diagnóstico em que ninguém
// confia: quando ele diz "está ruim", você não sabe se está descrevendo ou se acabou de causar.
// O reparo já tem dono: /api/agent-evolve (destravar, saudação, identidade) e /api/sync-agent.
//
// A REGRA QUE MANDA NO FORMATO DA RESPOSTA
// "não deu para provar" É UMA RESPOSTA DIFERENTE DE "está bom". Chave da ElevenLabs ausente, 401,
// rede caída, RPC muda — tudo isso devolve `atende_agora: null`, nunca `true`. O erro que custou o
// dia foi exatamente esse: `[]` lido como "não achei" quando era "não li".
//
// GATE: portão duplo, igual ao de /api/agent-evolve — DIGEST_TOKEN (o cron) OU a senha do /admin
// (gente). Segredo do Cloudflare é gravado criptografado e ninguém lê de volta: trancar SÓ no token
// produziria um verificador que nem o dono consegue rodar — a mesma armadilha já paga uma vez.
// ⚠️ O portão do /admin lê o CORPO de `_admin_ok`, nunca o status HTTP: em 2026-08-14 um
// `.then(r => r.ok)` sobre uma RPC que devolve booleano abriu um endpoint para qualquer um. HTTP
// 200 significa "a função rodou", não "a senha estava certa".
import { json, safeEq } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { analisarAgente, resumirFrota, ancoraLicao } from "../lib/provaAgente.js";
import { CEREBRO_VERSAO } from "../lib/provision.js";

const EL = "https://api.elevenlabs.io/v1";

// GET que nunca levanta: devolve { lido, erro, dados }. `fetch` NÃO lança em erro HTTP — sem esta
// leitura do `.ok`, um 401 viraria "corpo vazio" e o corpo vazio viraria "não achei problema".
async function ler(url, headers) {
  try {
    const r = await fetch(url, { headers });
    const txt = await r.text().catch(() => "");
    if (!r.ok) return { lido: false, erro: `HTTP ${r.status}${txt ? ` — ${txt.slice(0, 120)}` : ""}` };
    if (!txt) return { lido: false, erro: "resposta vazia do provedor" };
    try { return { lido: true, dados: JSON.parse(txt) }; }
    catch { return { lido: false, erro: `resposta não-JSON: ${txt.slice(0, 100)}` }; }
  } catch (e) { return { lido: false, erro: String(e).slice(0, 140) }; }
}

async function provar(request, env) {
  const url = new URL(request.url);
  const tok = url.searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
  let autorizado = !!env.DIGEST_TOKEN && safeEq(tok, env.DIGEST_TOKEN);
  if (!autorizado && tok) {
    const a = await svcJson(env, "_admin_ok", { p_token: tok }).catch(() => null);
    autorizado = a === true || a?.ok === true;   // o CORPO, não o status
  }
  if (!autorizado) return json({ error: "unauthorized", dica: "use o token do cron OU a senha do /admin" }, 401);

  // Sem chave da voz não existe prova nenhuma — e "sem prova" tem que sair como 503 explícito,
  // não como uma frota vazia que o olho lê como "ninguém com problema".
  if (!env.ELEVENLABS_API_KEY) {
    return json({ ok: false, nao_deu_pra_provar: true, motivo: "sem ELEVENLABS_API_KEY neste ambiente — isto NÃO é um ok" }, 503);
  }
  if (!env.INGEST_SECRET) {
    return json({ ok: false, nao_deu_pra_provar: true, motivo: "sem INGEST_SECRET — não dá para listar a frota. Isto NÃO é um ok" }, 503);
  }

  const H = { "xi-api-key": env.ELEVENLABS_API_KEY };
  const so = (url.searchParams.get("so") || "").trim().toLowerCase();      // um cliente só
  const soAgente = (url.searchParams.get("agente") || "").trim();          // um agent_id só
  const teto = Math.min(100, Math.max(1, Number(url.searchParams.get("teto")) || 25));
  // Agente de voz-web (a demo da landing) legitimamente não tem número. `voz_web=1` desliga a
  // exigência de telefone em vez de produzir um "derruba" falso.
  const esperaTelefone = url.searchParams.get("voz_web") !== "1";

  // ── A FROTA ────────────────────────────────────────────────────────────────────────────────
  // ⚠️ NÃO INVENTE NOME DE RPC (já custou três semanas de painel mentindo). `agentes_atrasados`
  // existe em db/motor_agente.sql; pedir uma versão-alvo absurda faz ele devolver a frota INTEIRA
  // com cliente + agent_id + brain_version. Reusar o que existe é melhor que criar mais uma
  // superfície para desatualizar.
  // ⚠️ FILTRAR DEPOIS DE CORTAR É CORTAR O QUE VOCÊ QUERIA VER.
  // `agentes_atrasados` devolve ordenado por brain_version asc — os mais ATRASADOS primeiro. Com
  // `?so=cliente` e teto 25, o cliente mais bem sincronizado (o que acabou de receber a lição) fica
  // fora da página e a rota responde "não achei esse cliente". É exatamente a consulta que o
  // runbook manda rodar primeiro depois de uma mudança. Quando há filtro, pede-se a frota inteira
  // e o corte acontece só no fim, sobre quem sobrou.
  const filtrando = !!(so || soAgente);
  const frotaR = await svcJson(env, "agentes_atrasados", { p_secret: env.INGEST_SECRET, p_versao: 999999, p_limite: filtrando ? 500 : teto });
  if (!frotaR || frotaR.erro_http || !frotaR.ok || !Array.isArray(frotaR.lista)) {
    // Lista ausente NÃO é frota vazia. Sem isto, "0 agentes com problema" sairia de um 401 do banco.
    return json({ ok: false, nao_deu_pra_provar: true,
      motivo: `não consegui ler a frota (${frotaR?.erro_http || frotaR?.detalhe || "resposta inesperada"}) — isto NÃO é um ok` }, 502);
  }
  let frota = frotaR.lista.filter((a) => a && a.agente);
  if (so) frota = frota.filter((a) => (a.cliente || "").toLowerCase() === so);
  if (soAgente) frota = frota.filter((a) => a.agente === soAgente);
  // FILTRO QUE NÃO CASA NINGUÉM É "NÃO LI", NÃO "ESTÁ TUDO BEM". Um e-mail digitado errado
  // devolveria uma frota vazia e, sem isto, um resumo verde — o pior desfecho possível para a
  // ferramenta que existe justamente para o dono confiar. 404 com o nome do que foi procurado.
  if (filtrando && !frota.length) {
    return json({ ok: null, nao_deu_pra_provar: true,
      motivo: `nenhum agente casa com ${so ? `cliente="${so}"` : `agente="${soAgente}"`} — confira o nome; isto NÃO é um ok`,
      clientes_conhecidos: frotaR.lista.map((a) => a.cliente).filter(Boolean).slice(0, 30) }, 404);
  }
  if (!filtrando) frota = frota.slice(0, teto);

  // ── AS FONTES QUE VALEM PARA TODOS (uma leitura só, não uma por agente) ────────────────────
  // 1) quem toca quando alguém disca, 2) a operadora (o voice_url é o que faz o telefone chegar na
  // voz), 3) a cota da conta de voz — se ela zerar, NENHUM agente atende, por mais saudável que
  // esteja a configuração.
  const tel = await ler(`${EL}/convai/phone-numbers`, H);
  const telefones = tel.lido
    ? { lido: true, lista: Array.isArray(tel.dados) ? tel.dados : [] }
    : { lido: false, erro: tel.erro };

  let twilio = { lido: false, erro: "sem TWILIO_ACCOUNT_SID/AUTH_TOKEN neste ambiente" };
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
    const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
    const t = await ler(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json?PageSize=100`,
      { Authorization: `Basic ${auth}` });
    twilio = t.lido
      ? { lido: true, numeros: (t.dados?.incoming_phone_numbers || []).map((n) => ({ phone_number: n.phone_number, voice_url: n.voice_url || "", friendly_name: n.friendly_name })) }
      : { lido: false, erro: t.erro };
  }

  const s = await ler(`${EL}/user/subscription`, H);
  const saldo = s.lido
    ? { lido: true, usados: Number(s.dados?.character_count ?? 0), teto: Number(s.dados?.character_limit ?? 0), plano: s.dados?.tier || "?" }
    : { lido: false, erro: s.erro };

  // ── AGENTE POR AGENTE ──────────────────────────────────────────────────────────────────────
  // SEQUENCIAL de propósito: em paralelo um rate-limit da ElevenLabs derrubaria várias leituras de
  // uma vez e as falhas viriam juntas sem dizer se o problema era o agente ou o volume — e aí o
  // relatório de saúde vira mais uma coisa que não dá para acreditar.
  const ancora = ancoraLicao();
  const resultados = [];
  for (const a of frota) {
    const g = await ler(`${EL}/convai/agents/${a.agente}`, H);
    resultados.push(analisarAgente({
      cliente: a.cliente || null,
      agente_id: a.agente,
      agente: g.lido ? { lido: true, dados: g.dados } : { lido: false, erro: g.erro },
      telefones, twilio, saldo,
      banco: { versao: a.versao ?? null },
    }, { ancora, esperaTelefone }));
  }

  const resumo = resumirFrota(resultados);
  return json({
    // `ok` = ninguém caído E nada essencial por ler. Uma frota "ok" com metade não lida seria a
    // mentira mais cara que esta rota poderia contar.
    ok: resumo.ok,
    prova: true,
    quando: new Date().toISOString(),
    versao_cerebro_atual: CEREBRO_VERSAO,
    ancora_da_licao: ancora,
    fontes_lidas: {
      elevenlabs_agentes: true,
      elevenlabs_numeros: telefones.lido ? true : telefones.erro,
      twilio_numeros: twilio.lido ? true : twilio.erro,
      cota_de_voz: saldo.lido ? true : saldo.erro,
      frota_no_banco: `${frota.length} de ${frotaR.total_atrasados ?? frotaR.lista.length} (teto=${teto})`,
    },
    resumo,
    agentes: resultados,
  });
}

export const onRequestGet = ({ request, env }) => provar(request, env);
export const onRequestPost = ({ request, env }) => provar(request, env);
