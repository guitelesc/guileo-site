// Cloudflare Pages Function — POST /api/call → triggers a real outbound AI phone call.
// PRIMARY: ElevenLabs Conversational AI (same "Gui" agent as the web widget).
//   Secrets in Cloudflare: ELEVENLABS_API_KEY, ELEVENLABS_PHONE_NUMBER_ID
//   (ELEVENLABS_AGENT_ID optional — defaults to the live Gui agent below).
// FALLBACK: Vapi (VAPI_API_KEY, VAPI_ASSISTANT_ID, VAPI_PHONE_NUMBER_ID).
// The caller's context (name/business/industry/need/lang) is passed as dynamic variables so the
// agent greets by name and acts on it — reference {{name}} {{business}} {{need}} in the prompt.
import { sameOrigin, rateLimited, safeEq } from "../lib/guard.js";
import { emitFailure } from "../lib/failure.js";
import { paraE164, destinoPermitido } from "../lib/contato.js";

const ELEVEN_AGENT_ID = "agent_5901ktdkev68f5kb161fmeax1rdm";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    // SECURITY: outbound calls cost real money — only our own site may trigger them, and the
    // number must be a valid E.164 phone (blocks abuse / robocalling arbitrary numbers).
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    // INTERNAL server-to-server dial (speed-to-lead from /api/lead) carries the shared DIGEST_TOKEN.
    // It bypasses ONLY the per-IP caps below (a legit edge fetch shares one IP and would trip them),
    // never the per-destination cooldown, the global daily cap in lead.js, or the DNC check — those
    // still bound abuse and cost on this path.
    const internal = safeEq(request.headers.get("x-guileo-internal") || "", env.DIGEST_TOKEN || "");
    // Outbound calls cost real money — fail-CLOSED rate limits (deny if KV can't run, so the
    // limiter can't be bypassed by knocking out KV). Two per-IP brakes: 2/min burst + 10/day.
    // NOTE: sameOrigin is forgeable and these are per-IP only — a CAPTCHA/Turnstile challenge
    // on the form is the recommended stronger fix against distributed/headless abuse.
    if (!internal) {
      if (await rateLimited(request, env, "call", 2, 60, /*failClosed*/ true)) return json({ error: "too many requests" }, 429);
      if (await rateLimited(request, env, "call-day", 25, 86400, /*failClosed*/ true)) return json({ error: "too many requests" }, 429);
    }
    const body = await request.json();
    const phone = (body.phone || "").toString().trim();
    if (!phone) return json({ error: "Missing phone" }, 400);
    if (!/^\+?[1-9]\d{7,14}$/.test(phone.replace(/[\s()-]/g, ""))) return json({ error: "Invalid phone" }, 400);

    // ⚠️ A REGEX ACIMA VALIDA FORMA, NÃO DISCABILIDADE — e a diferença custou uma ligação real.
    // "9295350191" (dez dígitos, sem código de país) passa nela e é REJEITADO pela Twilio, que só
    // fala E.164. Em 2026-08-25 o Luis pediu a ligação pelo herói do site: o lead entrou no banco,
    // o telefone nunca tocou, e não sobrou UM registro explicando o porquê. Este é o portão único
    // de discagem, então a conversão mora aqui — vale para o herói, a barra flutuante, o formulário
    // longo e o speed-to-lead do servidor de uma vez só.
    const dial = paraE164(phone);
    if (!dial) {
      // A recusa fala o idioma de quem está lendo — o visitante PT/ES não conserta um erro em inglês.
      const L = (body.lang || "en").toString().slice(0, 2);
      const diga = { pt: "inclui o código do país (ex.: +1 929 535 0191)",
                     es: "incluye el código de país (ej.: +1 929 535 0191)",
                     en: "include the country code (e.g. +1 929 535 0191)" };
      return json({ error: "phone needs country code", reason: diga[L] || diga.en }, 400);
    }

    // ── TRAVA DE DESTINO (IRSF, 2026-09-10) — antes de QUALQUER custo ou consulta ────────────────
    // 717 ligações para +972 em 48h zeraram a Twilio e suspenderam o telefone de todos os clientes.
    // Por IP e por destino não seguram um robô que gira os dois; o país do destino ele não gira.
    // Vale para os DOIS caminhos (público e interno): o speed-to-lead foi justamente a porta usada.
    // Mercado novo = acrescentar o DDI em CALL_DDI_EXTRA no Cloudflare (ex.: "+44,+351"), não aqui.
    if (!destinoPermitido(dial, env.CALL_DDI_EXTRA).ok) {
      const L = (body.lang || "en").toString().slice(0, 2);
      const diga = { pt: "a Gui liga para números dos EUA, Canadá e Brasil",
                     es: "Gui llama a números de EE. UU., Canadá y Brasil",
                     en: "Gui calls US, Canada and Brazil numbers" };
      return json({ error: "destination not allowed", reason: diga[L] || diga.en }, 403);
    }

    // TETO GLOBAL do caminho PÚBLICO — o limite por IP é por IP; um enxame de IPs soma sem teto.
    // O interno já tem o seu (150/dia em lead.js). Fail-CLOSED como os outros freios de custo.
    if (!internal) {
      try {
        if (!env.RATE_LIMIT) return json({ error: "too many requests" }, 429);
        const gk = `callpub:${new Date().toISOString().slice(0, 10)}`;
        const gn = parseInt((await env.RATE_LIMIT.get(gk)) || "0", 10);
        if (gn >= 60) {
          if (gn === 60) await emitFailure(env, "call_public_cap", dial, "teto diário de 60 ligações do caminho público atingido — possível enxame", {});
          await env.RATE_LIMIT.put(gk, String(gn + 1), { expirationTtl: 172800 });
          return json({ error: "too many requests" }, 429);
        }
        await env.RATE_LIMIT.put(gk, String(gn + 1), { expirationTtl: 172800 });
      } catch { return json({ error: "too many requests" }, 429); }
    }

    // COMPLIANCE: this is the single hardened dial point — EVERY call path (front-end direct +
    // server-side speed-to-lead from /api/lead) funnels through here, so the do-not-contact (TCPA
    // STOP / DNC) check lives here, not just in lead.js. Never dial a number that opted out.
    //
    // ── A ASSIMETRIA É DE PROPÓSITO (auditoria de lançamento, 2026-09-22) ────────────────────────
    // Quando a lista de não-perturbe NÃO PODE SER LIDA (rede, banco fora, resposta ilegível):
    //   · caminho INTERNO (cron, speed-to-lead, reengajamento) → FAIL-CLOSED: não disca.
    //   · caminho PÚBLICO (a pessoa no site pedindo a ligação)  → fail-open, como sempre foi.
    // POR QUÊ: no público, quem digitou o número está pedindo a ligação AGORA — é consentimento
    // fresco, e o caminho tem freio por IP (2/min, 25/dia), teto global (60/dia) e cooldown por
    // destino. Um soluço do banco não pode matar a demonstração, que é a venda.
    // No interno NINGUÉM está pedindo nada naquele instante: é a máquina decidindo ligar, sem freio
    // por IP (o token interno pula esses freios), às vezes dias depois do contato. Ali, "não
    // consegui conferir o opt-out" e "pode ligar" não podem ser a mesma coisa — ligar para quem
    // mandou STOP é passivo de TCPA por ligação, e uma máquina repete o erro em lote. A ligação
    // que deixou de sair fica registrada como falha (dnc_check_unavailable) e dá para refazer; a
    // ligação indevida não tem volta.
    const SB_URL = env.GUI_ACTIONS_SUPABASE_URL || "https://ynihodbknhjirkdogxby.supabase.co";
    const SB_ANON = env.GUI_ACTIONS_SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
    // FAIL-CLOSED on config: without INGEST_SECRET we can NEVER verify the do-not-contact list, so on
    // the DIALING path we must refuse to call rather than silently dial a possibly-opted-out number
    // (a fail-OPEN here would be a TCPA liability, not a transient blip). A transient RPC error on
    // the PUBLIC path still falls open; on the INTERNAL path it refuses (see the asymmetry above).
    if (!env.INGEST_SECRET) {
      await emitFailure(env, "dnc_check_unavailable", (paraE164(phone) || phone), "INGEST_SECRET missing on dial path — refusing to call (cannot verify DNC/opt-out)", {});
      return json({ error: "cannot verify do-not-call list" }, 503);
    }
    {
      // `is_dnc` devolve boolean. Só `false` LIDO libera o caminho interno; qualquer outra coisa
      // (HTTP não-2xx, corpo que não é boolean, fetch que lançou) é "não sei" — e guarda o motivo.
      let dncLido = false, dncMotivo = "";
      try {
        const e164 = dial;
        const dr = await fetch(`${SB_URL}/rest/v1/rpc/is_dnc`, {
          method: "POST",
          headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
          body: JSON.stringify({ p_secret: env.INGEST_SECRET, p_phone: e164 }),
        });
        if (dr.ok) {
          const dv = await dr.json().catch(() => undefined);
          if (dv === true) return json({ error: "opted out" }, 403);
          if (dv === false) dncLido = true;
          else dncMotivo = "is_dnc respondeu algo que não é sim/não";
        } else dncMotivo = `is_dnc http ${dr.status}`;
      } catch (e) { dncMotivo = `is_dnc fora do ar: ${String(e).slice(0, 80)}`; }
      if (!dncLido && internal) {
        // Uma falha por ligação recusada (este é o único ponto de saída deste ramo). O cooldown
        // por destino ainda NÃO foi gravado aqui, então ele não bloqueia uma nova tentativa.
        await emitFailure(env, "dnc_check_unavailable", dial,
          `não consegui ler a lista de não-perturbe (${dncMotivo}) — discagem INTERNA recusada`,
          { caminho: "interno", motivo: dncMotivo, client_email: (body.client_email || "").toString().slice(0, 120) });
        return json({ error: "cannot verify do-not-call list", reason: dncMotivo }, 503);
      }
      // público + DNC ilegível → segue (fail-open de propósito; ver "A ASSIMETRIA" acima).
    }

    // PER-DESTINATION cooldown — bounds abuse that the per-IP caps miss (one victim dialed from
    // many IPs, or a double-submit). At most one call per number per 10 min on this hardened path.
    // Best-effort: if KV is down we don't block the call (per-IP caps remain the backstop).
    if (env.RATE_LIMIT) {
      try {
        const dest = dial;
        if (await env.RATE_LIMIT.get(`calldest:${dest}`)) return json({ ok: true, skipped: "recently called" });
        await env.RATE_LIMIT.put(`calldest:${dest}`, "1", { expirationTtl: 600 });
      } catch { /* KV blip → proceed; IP caps backstop */ }
    }

    const vars = {
      name: (body.name || "").toString().slice(0, 120),
      business: (body.business || "").toString().slice(0, 160),
      industry: (body.industry || "").toString().slice(0, 80),
      need: (body.need || "").toString().slice(0, 300),
      lang: (body.lang || "auto").toString().slice(0, 8),
    };

    // ── PER-TENANT AGENT (internal dial path only) ──
    // A speed-to-lead callback can dial AS the client's OWN Gui (their voice/name/prices/KB, and
    // their own caller-ID when their number is registered). SECURITY: we NEVER trust a client-supplied
    // agent_id (format != authorization). The agent is resolved SERVER-SIDE from the tenant email via
    // the INGEST-gated client_agent_resolve, and ONLY on the INTERNAL path (x-guileo-internal ==
    // DIGEST_TOKEN). A public caller (no internal token) always gets the platform agent — it cannot
    // request another tenant's agent. Unknown/absent tenant → platform agent (no regression).
    let agentId = env.ELEVENLABS_AGENT_ID || ELEVEN_AGENT_ID;
    let agentPhoneId = env.ELEVENLABS_PHONE_NUMBER_ID;
    if (internal && body.client_email && /.+@.+\..+/.test(String(body.client_email))) {
      try {
        const rr = await fetch(`${SB_URL}/rest/v1/rpc/client_agent_resolve`, {
          method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
          body: JSON.stringify({ p_secret: env.INGEST_SECRET, p_email: String(body.client_email).toLowerCase() }),
        });
        if (rr.ok) {
          const a = await rr.json().catch(() => null);
          if (a && a.agent_id) agentId = a.agent_id;                          // the client's own Gui
          if (a && a.el_phone_number_id) agentPhoneId = a.el_phone_number_id;  // their caller-ID (same ElevenLabs workspace)
        }
      } catch { /* resolve down → platform agent (no regression) */ }
    }

    // ── A ABERTURA DE UMA LIGAÇÃO DE SAÍDA NÃO É A DE UMA DE ENTRADA ─────────────────────────────
    // Quem ATENDE cumprimenta e pergunta em que pode ajudar. Quem LIGA já sabe por que ligou — e
    // quem pediu a demo no site levantou a mão, não está pedindo informação. Em 25/08 a primeira
    // ligação de saída de verdade abriu com "How can I take care of you today?" e o Luis resumiu o
    // problema: «não é focado em ser inteligente, soluções, vender». Uma recepcionista educada
    // desperdiça o único momento em que o prospect está com a mão levantada.
    //
    // ⚠️ SÓ VALE PARA A LINHA DA GUILEO. Se o dial é interno (speed-to-lead com o agente do
    // CLIENTE), o agente é o negócio DELE — abrir vendendo Guileo no telefone de um spa seria o
    // pior defeito de marca imaginável. Por isso a trava é dupla: caminho público E agente da
    // plataforma. Na dúvida, não sobrescreve nada e o agente segue como sempre foi.
    const daGuileo = !internal && agentId === (env.ELEVENLABS_AGENT_ID || ELEVEN_AGENT_ID);
    const L = ["pt", "es"].includes(vars.lang.slice(0, 2)) ? vars.lang.slice(0, 2) : "en";
    const quem = vars.name ? vars.name.split(" ")[0] : "";
    // CR-01 (2026-10-08): a abertura de saída também se apresenta como assistente VIRTUAL e avisa a gravação.
    const ABERTURA = {
      pt: quem
        ? `Oi ${quem}, aqui é a Gui, assistente virtual da Guileo — esta ligação pode ser gravada. Você acabou de pedir a demonstração no nosso site. Não vou tomar seu tempo com apresentação: me conta o que o seu negócio faz, que eu te digo onde você está perdendo dinheiro hoje e o que eu faria a respeito.`
        : `Oi, aqui é a Gui, assistente virtual da Guileo — esta ligação pode ser gravada. Você acabou de pedir a demonstração no nosso site. Rapidinho: qual é o seu nome e o que o seu negócio faz? Com isso eu já te digo onde você está perdendo dinheiro e o que eu faria a respeito.`,
      es: quem
        ? `Hola ${quem}, soy Gui, asistente virtual de Guileo; esta llamada puede ser grabada. Acabas de pedir la demostración en nuestro sitio. No te voy a robar tiempo con presentaciones: cuéntame qué hace tu negocio y te digo dónde estás perdiendo dinero hoy y qué haría yo al respecto.`
        : `Hola, soy Gui, asistente virtual de Guileo; esta llamada puede ser grabada. Acabas de pedir la demostración en nuestro sitio. Rápido: ¿cómo te llamas y qué hace tu negocio? Con eso te digo dónde estás perdiendo dinero y qué haría yo al respecto.`,
      en: quem
        ? `Hey ${quem}, this is Gui, Guileo's virtual assistant — this call may be recorded. You just asked for the demo on our site. I won't waste your time with an intro: tell me what your business does, and I'll tell you exactly where you're losing money right now and what I'd do about it.`
        : `Hey, this is Gui, Guileo's virtual assistant — this call may be recorded. You just asked for the demo on our site. Quick one: what's your name, and what does your business do? Then I'll tell you exactly where you're losing money and what I'd do about it.`,
    };
    // O `need` é a variável que o prompt já lê. Numa ligação de saída ela deixa de ser "o que o
    // cliente quer" e passa a ser a MISSÃO da chamada — ler o negócio, propor e fechar.
    const MISSAO = {
      pt: "LIGAÇÃO DE SAÍDA DE VENDA. Objetivo: entender o negócio da pessoa, apontar 2 perdas concretas (ligação perdida, resposta lenta, no-show), propor a solução da Guileo em cima disso, capturar NOME e E-MAIL, e fechar em orçamento ou demonstração agendada. Seja inteligente e direto, venda soluções, nunca pergunte 'em que posso ajudar'.",
      es: "LLAMADA SALIENTE DE VENTA. Objetivo: entender el negocio, señalar 2 pérdidas concretas, proponer la solución de Guileo, capturar NOMBRE y CORREO, y cerrar en presupuesto o demostración agendada. Inteligente y directo, vende soluciones, nunca preguntes 'en qué puedo ayudarte'.",
      en: "OUTBOUND SALES CALL. Goal: understand their business, name 2 concrete leaks (missed calls, slow lead response, no-shows), pitch the Guileo fix on top of that, capture NAME and EMAIL, and close on a quote or a booked demo. Be smart and direct, sell solutions, never ask 'how can I help you'.",
    };
    if (daGuileo && !vars.need) vars.need = MISSAO[L];

    // ── PRIMARY: ElevenLabs Conversational AI outbound call (via Twilio) ──
    if (env.ELEVENLABS_API_KEY && agentPhoneId) {
      const res = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound-call", {
        method: "POST",
        headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          agent_phone_number_id: agentPhoneId,
          to_number: dial,
          conversation_initiation_client_data: {
            dynamic_variables: vars,
            // Sobrescreve SÓ a abertura — nunca o prompt inteiro, que carrega o KB, os preços e as
            // lições versionadas. Trocar o prompt para mudar a primeira frase seria jogar fora o
            // cérebro para consertar a boca.
            ...(daGuileo ? { conversation_config_override: { agent: { first_message: ABERTURA[L] } } } : {}),
          },
        }),
      });
      // ⚠️ ANTES ISTO SÓ FAZIA console.log — e um log de edge que ninguém lê é o mesmo que silêncio.
      // Foi assim que a recusa da Twilio pelo número sem código de país não deixou rastro nenhum.
      if (!res.ok) {
        const det = await res.text().catch(() => "");
        await emitFailure(env, "call_provider_error", dial, `ElevenLabs recusou a discagem (HTTP ${res.status})`, { detalhe: det.slice(0, 300), agent_id: agentId });
        return json({ error: "call provider error", reason: `provedor recusou (HTTP ${res.status})` }, 503);
      }
      return json({ ok: true, provider: "elevenlabs" });
    }

    // ── FALLBACK: Vapi ──
    if (env.VAPI_API_KEY && env.VAPI_ASSISTANT_ID && env.VAPI_PHONE_NUMBER_ID) {
      const res = await fetch("https://api.vapi.ai/call", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.VAPI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          assistantId: env.VAPI_ASSISTANT_ID,
          phoneNumberId: env.VAPI_PHONE_NUMBER_ID,
          customer: { number: dial, name: vars.name || undefined },
          assistantOverrides: { variableValues: vars },
        }),
      });
      if (!res.ok) {
        await emitFailure(env, "call_provider_error", dial, `Vapi recusou a discagem (HTTP ${res.status})`, {});
        return json({ error: "call provider error", reason: `provedor recusou (HTTP ${res.status})` }, 503);
      }
      return json({ ok: true, provider: "vapi" });
    }

    return json({ error: "Outbound calling not configured yet" }, 501);
  } catch {
    return json({ error: "bad request" }, 400);
  }
}
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });
