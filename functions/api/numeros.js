// Cloudflare Pages Function — POST /api/numeros
//
// A MÃO do inventário de telefones. O diagnóstico (`/api/agent-evolve?numeros=1`) só LÊ; esta rota
// é a única que MEXE, e as duas são separadas de propósito: um diagnóstico que também age é um
// diagnóstico em que ninguém confia, porque você nunca sabe se o número que ele mostra é o de antes
// ou o de depois.
//
// POR QUE ELA EXISTE (2026-08-16)
// O rastreio achou três coisas na conta do Luis:
//   • +1 406 800 0052 — comprado em 28/mai, DOIS MESES antes de o Natura existir como cliente, e
//     mesmo assim amarrado ao agente da Lilian. Quem discasse era atendido como o spa.
//   • +1 220 244 4449 e +1 363 333 6306 — comprados em 23/mai, sem agente nenhum, assinatura
//     correndo há quase três meses sem tocar uma vez.
//   • os rótulos na ElevenLabs todos escritos "naturaspaadm", inclusive no número da linha de DEMO
//     da própria Guileo. O vínculo do agente está certo; a etiqueta mente — e é a etiqueta que um
//     humano lê na hora de decidir o que apagar.
//
// AS DUAS AÇÕES, E POR QUE UMA É MUITO PIOR QUE A OUTRA
//   `desamarrar` .. tira o número do agente na ElevenLabs. REVERSÍVEL: reimporta e liga de novo.
//   `liberar` .... devolve o número à Twilio. IRREVERSÍVEL DE VERDADE — o número volta para o
//                  estoque e é revendido; não existe "desfazer". Por isso ela exige `confirmar`
//                  com o número inteiro digitado, e recusa qualquer número que esteja amarrado a
//                  um agente. Ninguém deveria conseguir desligar a linha de um cliente pagante
//                  com um clique errado, nem eu.
//
// GATE: senha do /admin ou token do cron — mesmo portão duplo do agent-evolve.
import { json, safeEq } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";

const soDigitos = (s) => (s || "").toString().replace(/\D/g, "");

export async function onRequestPost({ request, env }) {
  try {
    const b = await request.json().catch(() => ({}));
    const tok = (b.token || request.headers.get("x-guileo-secret") || "").toString();

    let ok = !!env.DIGEST_TOKEN && safeEq(tok, env.DIGEST_TOKEN);
    if (!ok && tok) {
      // ⚠️ LER O CORPO, não o status. `_admin_ok` devolve `false` com HTTP 200 — foi assim que um
      // `.then(r => r.ok)` abriu o envio de e-mail para qualquer string. Aqui o preço de repetir o
      // erro seria alguém apagar a linha de um cliente.
      const a = await svcJson(env, "_admin_ok", { p_token: tok }).catch(() => null);
      ok = a === true || a?.ok === true;
    }
    if (!ok) return json({ error: "unauthorized" }, 401);
    if (!env.ELEVENLABS_API_KEY) return json({ error: "sem ELEVENLABS_API_KEY" }, 503);

    const acao = (b.acao || "").toString();

    // ── listar: A PERGUNTA MAIS BÁSICA, QUE FALTAVA ──────────────────────────────────────────────
    // Este arquivo é a "fonte única" dos números e só sabia MEXER neles (desamarrar/liberar/
    // recarimbar) — não sabia DIZER quais existem. Em 2026-08-25 a saída de voz estava caída porque
    // o `ELEVENLABS_PHONE_NUMBER_ID` do Cloudflare apontava para um `phnum_…` já apagado, e não havia
    // um jeito de ler o id certo sem abrir o painel. Um endpoint que só escreve obriga a adivinhar
    // antes de escrever. Só leitura, mesmo portão de admin.
    if (acao === "listar") {
      const lr = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
      if (!lr.ok) return json({ error: `ElevenLabs recusou (HTTP ${lr.status})` }, 503);
      const lista = (await lr.json().catch(() => []) || []).map((n) => ({
        numero: n?.phone_number || "", id: n?.phone_number_id || "", provedor: n?.provider || "",
        agente: n?.assigned_agent?.agent_id || null, agente_nome: n?.assigned_agent?.agent_name || null,
      }));
      // O id configurado é CONFRONTADO com a lista — é exatamente esse desencontro que derruba a
      // discagem em silêncio, e ele não se vê olhando uma fonte de cada vez.
      const cfg = env.ELEVENLABS_PHONE_NUMBER_ID || "";
      return json({ ok: true, numeros: lista, configurado: cfg || null,
        configurado_existe: !!cfg && lista.some((n) => n.id === cfg) });
    }

    const alvo = soDigitos(b.numero);
    if (!alvo) return json({ error: "informe o numero" }, 400);

    // ESTADO ATUAL DAS DUAS FONTES, sempre relido na hora. Agir sobre o retrato que o diagnóstico
    // tirou minutos atrás é como marcar horário conferindo a agenda de ontem.
    const pr = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
    if (!pr.ok) return json({ error: `ElevenLabs recusou (HTTP ${pr.status})` }, 503);
    const naEleven = (await pr.json().catch(() => []) || []).find((n) => soDigitos(n?.phone_number) === alvo) || null;

    if (acao === "desamarrar") {
      if (!naEleven) return json({ ok: false, motivo: "esse número não está na ElevenLabs — nada a desamarrar" });
      if (!naEleven.assigned_agent?.agent_id) return json({ ok: true, ja_estava: true, motivo: "já não tinha agente" });
      const agente = naEleven.assigned_agent.agent_id, nomeAgente = naEleven.assigned_agent.agent_name || "";
      // Remover o número da ElevenLabs desfaz o vínculo E devolve a linha para o estado "só Twilio".
      // Não toca na compra: o número continua seu, e reimportar é um POST.
      const d = await fetch(`https://api.elevenlabs.io/v1/convai/phone-numbers/${naEleven.phone_number_id}`,
        { method: "DELETE", headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
      if (!d.ok) return json({ ok: false, erro: `ElevenLabs recusou (HTTP ${d.status})`, corpo: (await d.text().catch(() => "")).slice(0, 200) }, 503);
      return json({ ok: true, acao: "desamarrar", numero: naEleven.phone_number, era_do_agente: agente, agente_nome: nomeAgente,
        nota: "continua comprado na Twilio; reimportar reata o vínculo" });
    }

    if (acao === "liberar") {
      // TRAVA 1 — digitar o número inteiro. Protege contra clique errado e contra eu mandar a
      // requisição com o alvo de outra linha do relatório.
      if (soDigitos(b.confirmar) !== alvo) {
        return json({ ok: false, erro: "confirme digitando o número inteiro em `confirmar`" }, 400);
      }
      // TRAVA 2 — número amarrado a agente NUNCA é liberado por aqui. Se está atendendo alguém,
      // liberar derruba a linha de um cliente. Desamarre primeiro, de propósito em dois passos.
      if (naEleven?.assigned_agent?.agent_id) {
        return json({ ok: false, erro: "esse número está amarrado a um agente — desamarre antes", agente: naEleven.assigned_agent.agent_id }, 409);
      }
      if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) return json({ error: "sem credenciais Twilio" }, 503);
      const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
      // Precisa do SID da linha, não do número. Buscar aqui (e não confiar num SID vindo de fora)
      // garante que só se apaga algo que ESTA conta realmente possui.
      const lr = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json?PageSize=100`,
        { headers: { Authorization: `Basic ${auth}` } });
      if (!lr.ok) return json({ error: `Twilio recusou a leitura (HTTP ${lr.status})` }, 503);
      const linha = ((await lr.json()).incoming_phone_numbers || []).find((n) => soDigitos(n.phone_number) === alvo);
      if (!linha) return json({ ok: false, erro: "esse número não está nesta conta Twilio" }, 404);

      const del = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers/${linha.sid}.json`,
        { method: "DELETE", headers: { Authorization: `Basic ${auth}` } });
      if (!del.ok) return json({ ok: false, erro: `Twilio recusou (HTTP ${del.status})`, corpo: (await del.text().catch(() => "")).slice(0, 200) }, 503);
      return json({ ok: true, acao: "liberar", numero: linha.phone_number, sid: linha.sid, comprado_em: linha.date_created,
        nota: "devolvido ao estoque da Twilio — não há como recuperar este número" });
    }

    // `recarimbar` — conserta a ETIQUETA dos números que já existem.
    // A correção em provision.js faz o rótulo nascer do agente, mas só para vínculos NOVOS. Os que
    // já estão lá continuariam com o carimbo velho para sempre — e o carimbo velho é justamente o
    // que um humano lê na hora de decidir o que apagar. Conserto de causa sem conserto de estoque
    // deixa a bomba armada; é o mesmo motivo pelo qual o agent-evolve existe para as lições.
    // Mexe SÓ no label. Nunca toca no vínculo: quem atende continua atendendo.
    if (acao === "recarimbar") {
      if (!naEleven) return json({ ok: false, motivo: "número não está na ElevenLabs" });
      const ag = naEleven.assigned_agent?.agent_id;
      if (!ag) return json({ ok: false, motivo: "sem agente — não há de quem derivar o carimbo" });
      const gr = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${ag}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
      if (!gr.ok) return json({ ok: false, erro: `não li o agente (HTTP ${gr.status})` }, 503);
      const novo = ((await gr.json().catch(() => ({})))?.name || "").slice(0, 60);
      if (!novo) return json({ ok: false, erro: "agente sem nome — não invento carimbo" }, 503);
      if (novo === naEleven.label) return json({ ok: true, ja_estava: true, carimbo: novo });
      const up = await fetch(`https://api.elevenlabs.io/v1/convai/phone-numbers/${naEleven.phone_number_id}`, {
        method: "PATCH", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ label: novo }),
      });
      if (!up.ok) return json({ ok: false, erro: `ElevenLabs recusou (HTTP ${up.status})`, corpo: (await up.text().catch(() => "")).slice(0, 200) }, 503);
      return json({ ok: true, acao: "recarimbar", numero: naEleven.phone_number, de: naEleven.label, para: novo });
    }

    return json({ error: "acao deve ser 'desamarrar', 'liberar' ou 'recarimbar'" }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 200) }, 500);
  }
}
