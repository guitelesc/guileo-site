// Cloudflare Pages Function — POST /api/sync-agent
// Loop 2: when a client edits their AI brain in the portal, push it to their LIVE
// ElevenLabs voice agent's prompt — so "Train your AI" actually trains the real agent.
//   POST { email, key, brain, business?, industry?, lang? }
// Auth: the connection code (key) must match the client (verified via get_client_data).
import { json, isOwnerEmail } from "../lib/guard.js";
import { buildConversationConfig, fetchTenantPrices } from "../lib/provision.js";
import { appointmentEmail } from "../lib/emailTemplates.js";
import { brandFor } from "../lib/clientBrand.js";
import { isReserved } from "../lib/reserved.js";
import { resolveNativeVoices } from "../lib/voiceLibrary.js";
import { svcRpc } from "../lib/sb.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!env.ELEVENLABS_API_KEY) return json({ ready: false, error: "elevenlabs not configured" }, 501);
    const b = await request.json();
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "email + key required" }, 400);

    // AUTH — the connection code must belong to this client (get_client_data rejects a mismatch).
    const gr = await rpc("get_client_data", { p_email: email, p_key: key });
    if (!gr.ok) return json({ error: "unauthorized" }, 401);

    // find this client's dedicated agent (server-side, ingest-secret gated)
    const ar = await rpc("client_agent_lookup", { p_secret: env.INGEST_SECRET || "", p_email: email });
    const agentId = ar.ok ? ((await ar.json()) || "").toString() : "";
    if (!agentId) return json({ ok: false, error: "no agent provisioned for this client yet" }, 404);

    // NOME DO NEGÓCIO — nunca pode chegar vazio aqui. Em 2026-08-05 rodei este sync passando
    // só {email,key} e o nome caiu pra "" → o construtor usou o placeholder e a agente passou a
    // atender "Thanks for calling YOUR BUSINESS!" em TODA ligação da Natura. Um sync de rotina
    // apagou a marca do cliente e ninguém percebeu até ele ligar. É a MESMA família do bug de
    // 2026-07-22 (o sync que perdia o agentName): confiar no corpo da requisição pra um dado
    // que o servidor já conhece. Agora tem cadeia de resgate e, se tudo falhar, RECUSA o sync —
    // melhor não sincronizar do que despersonalizar o agente de quem paga.
    let business = (b.business || "").toString().slice(0, 160);
    const industry = (b.industry || "").toString().slice(0, 80);
    const lang = ["pt", "es", "en"].includes(b.lang) ? b.lang : "en";
    const brain = (b.brain || "").toString().slice(0, 4000);

    // KB — re-inject the tenant's own Q&A (client_kb) so a brain sync NEVER strips the business
    // knowledge the way provisioning injects it. Best-effort; empty/missing → brain unchanged.
    let kbBrain = brain;
    try {
      const kr = await rpc("kb_for_agent", { p_secret: env.INGEST_SECRET || "", p_email: email });
      if (kr.ok) { const kb = ((await kr.json()) || "").toString().slice(0, 1600); if (kb.trim()) kbBrain = `${brain || ""}\n\nBUSINESS FAQ (answer these exactly as the owner wrote them):\n${kb}`.trim(); }
    } catch { /* KB is a bonus — never blocks a sync */ }

    // PRICES — inject the tenant's REAL live menu so editing the brain never strips the prices the Gui
    // quotes on a call (biz_lookup, SCHED_SECRET; best-effort "" on any miss).
    const prices = await fetchTenantPrices(env, email, lang);

    // Preserve whatever VOICE + NAME the agent currently uses — read them off the live agent so a brain
    // sync never reverts the voice OR resets the white-label name to the brand-default "Gui" (the root
    // cause of "answered as Gui": sync used to drop agentName, so buildGuiPrompt fell back to "Gui").
    let voiceId = "", liveName = "";
    try {
      const gv = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
      if (gv.ok) { const gd = await gv.json().catch(() => ({})); voiceId = (gd?.conversation_config?.tts?.voice_id || "").toString(); liveName = (gd?.name || "").toString(); }
    } catch { /* fall back to env default inside buildConversationConfig */ }
    // explicit name from the caller wins; else keep the agent's current white-label name ("{name} · {business}")
    let agentName = (b.agent_name || "").toString().trim().slice(0, 40);
    if (!agentName && liveName.includes(" · ")) agentName = liveName.split(" · ")[0].trim();

    // resgate 1: o próprio agente já carrega "{Nome} · {Negócio}" no nome
    if (!business && liveName.includes(" · ")) business = liveName.split(" · ").slice(1).join(" · ").trim().slice(0, 160);
    // resgate 2: o perfil do cliente no banco
    if (!business) {
      try {
        const prf = await rpc("get_client_profile", { p_secret: env.INGEST_SECRET || "", p_email: email });
        if (prf.ok) { const pj = await prf.json().catch(() => null); business = (pj?.business_name || "").toString().slice(0, 160); }
      } catch { /* cai na recusa abaixo */ }
    }
    // fail-closed: sincronizar sem o nome do negócio DESPERSONALIZA a agente em produção.
    if (!business) {
      return json({ ok: false, error: "não consegui resolver o nome do negócio — sync recusado para não trocar a marca do cliente por um placeholder" }, 409);
    }

    // ONE source of truth — the SAME builder provisioning uses. Rebuilding the prompt inline here used to
    // (1) DROP the tools + toolHint (schedule/do_action) AND the 🚨 emergency-escalation protocol, and
    // (2) PATCH a FIXED tts.model_id=flash_v2_5, which ElevenLabs REJECTS for English-PRIMARY agents
    // ("English Agents must use turbo or flash v2") → a 502 where the brain edit silently never landed.
    // buildConversationConfig keeps the tools + protocol AND picks the tts model by language, so editing
    // the brain in the portal never again breaks the agent.
    // VOZ NATIVA POR IDIOMA — garante (e adiciona, se faltar) uma voz brasileira e uma latina na
    // conta, para que a agente não leia português com sotaque americano. Idempotente e fail-soft:
    // se a biblioteca não responder, o mapa vem vazio e o agente sincroniza com a voz de sempre.
    const nativeVoices = await resolveNativeVoices(env).catch(() => ({}));
    const convCfg = buildConversationConfig(env, { business, industry, lang, brain: kbBrain, agentName, email, prices, voiceId, nativeVoices });
    const pr = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
      method: "PATCH",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      // also persist the agent NAME so the white-label sticks across the ElevenLabs dashboard too
      body: JSON.stringify({ conversation_config: convCfg, ...(agentName && business ? { name: `${agentName} · ${business}`.slice(0, 60) } : {}) }),
    });
    // O MOTIVO VAI JUNTO. Um 502 "agent update failed" sem razão me custou uma rodada inteira de
    // diagnóstico: o console.log some se ninguém estiver com o tail aberto no segundo exato. A
    // mensagem da ElevenLabs é validação de schema (nunca segredo), e quem chama esta rota já
    // provou a chave de conexão do cliente.
    if (!pr.ok) {
      const detail = await pr.text().catch(() => "");
      console.log("sync-agent error", detail.slice(0, 300));
      return json({ error: "agent update failed", status: pr.status, detail: detail.slice(0, 400) }, 502);
    }

    // log the retrain as a (free) event for the client's timeline
    try { await svcRpc(env, "ingest_client_event", { p_secret: env.INGEST_SECRET || "", p_email: email, p_type: "train", p_channel: "system", p_summary: "AI brain synced to your live voice agent", p_amount: 0, p_payload: { agent_id: agentId } }); } catch { /* */ }

    // LEITURA DE VOLTA — um 200 no PATCH diz que a requisição foi aceita, não que o agente ficou como
    // eu quis. Devolver os idiomas que o agente REALMENTE declara transforma "sincronizei" em prova
    // verificável, e é o que responde na hora a pergunta "ela fala português?".
    let languages = null;
    try {
      const rb = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
      if (rb.ok) {
        const rd = await rb.json().catch(() => ({}));
        const cc = rd?.conversation_config || {};
        const presets = cc?.language_presets || {};
        languages = {
          primary: cc?.agent?.language || null,
          voice: cc?.tts?.voice_id || null,
          stability: cc?.tts?.stability ?? null,
          switchable: Object.keys(presets).sort(),
          // qual VOZ cada idioma usa — é isso que prova que o português não sai com sotaque gringo
          voice_by_lang: Object.fromEntries(Object.keys(presets).sort()
            .map((k) => [k, presets[k]?.overrides?.tts?.voice_id || "(herda a padrão)"])
            .filter(([, v]) => v !== "(herda a padrão)")),
        };
        // NOME E SOTAQUE DA VOZ, não só o id. Um id não prova nada: "pt-br usa fs3nd19K" pode ser
        // uma voz portuguesa e eu não saberia. Trocar id por "Ana · brazilian" é o que torna a
        // prova legível — e o que teria pego na hora se a busca escolhesse a voz errada.
        const vl = await fetch("https://api.elevenlabs.io/v1/voices", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
        if (vl.ok) {
          const vd = await vl.json().catch(() => ({}));
          const byId = Object.fromEntries((vd.voices || []).map((v) => [v.voice_id,
            `${v.name}${v.labels?.accent ? ` · ${v.labels.accent}` : ""}${v.labels?.language ? ` (${v.labels.language})` : ""}`]));
          languages.voice_named = byId[languages.voice] || languages.voice;
        // NÚMERO QUE REALMENTE ATENDE. O banco guarda um número por cliente, mas quem atende de
        // verdade é o que está ligado ao agente na ElevenLabs. Os dois podem divergir (troca de
        // conta Twilio, número comprado fora do fluxo) — e aí o cockpit mostra um número que não
        // toca. Ler o vínculo real é a única forma de saber.
        try {
          const pn = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
          if (pn.ok) {
            const list = await pn.json().catch(() => []);
            languages.numero_que_atende = (Array.isArray(list) ? list : [])
              .filter((n) => n.assigned_agent && n.assigned_agent.agent_id === agentId)
              .map((n) => n.phone_number);
          }
        } catch { /* prova é bônus */ }
          languages.voice_by_lang = Object.fromEntries(Object.entries(languages.voice_by_lang)
            .map(([k, id]) => [k, byId[id] || id]));
        }
      }
    } catch { /* a prova é bônus — nunca invalida um sync que deu certo */ }
    // ── CADA AGENTE SÓ FICA COM O NÚMERO QUE É DELE ─────────────────────────────────────────
    // Em 2026-08-06 os TRÊS números da conta estavam vinculados ao agente da Natura — inclusive a
    // linha de demo da plataforma (+1 986 444 3334), a que os vendedores discam AO VIVO na frente
    // do prospect. Resultado: o demo da Guileo era atendido por um spa em Astoria, e o agente de
    // vendas da Guileo não tinha número nenhum. Ninguém percebeu porque nada nunca comparou o
    // vínculo real com o que o banco diz.
    //
    // Este passo é conservador de propósito: ele só SOLTA (agent_id: null) um número que
    // comprovadamente não é deste cliente — reservado da plataforma, ou atribuído a outro e-mail
    // no banco. Se a dona não puder ser determinada, NÃO MEXE: religar errado é pior que deixar.
    const numeros_soltos = [];
    try {
      const pl = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
      if (pl.ok) {
        const list = await pl.json().catch(() => []);
        const meus = (Array.isArray(list) ? list : []).filter((n) => n?.assigned_agent?.agent_id === agentId);
        // o número que o BANCO diz ser deste cliente (vazio → não sabemos, e aí não soltamos nada)
        const nr = await rpc("client_number_for", { p_secret: env.INGEST_SECRET || "", p_email: email });
        const meuNumero = nr.ok ? String((await nr.json()) || "").replace(/[^0-9]/g, "") : "";
        for (const n of meus) {
          const d = String(n.phone_number || "").replace(/[^0-9]/g, "");
          if (!d) continue;
          const ehMeu = meuNumero && d === meuNumero;
          const ehReservado = isReserved(n.phone_number);
          // solta só o que é claramente de outro dono
          if (ehMeu) continue;
          if (!ehReservado && !meuNumero) continue;      // sem referência → não arrisca
          const up = await fetch(`https://api.elevenlabs.io/v1/convai/phone-numbers/${n.phone_number_id}`, {
            method: "PATCH",
            headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ agent_id: null }),
          });
          numeros_soltos.push({ numero: n.phone_number, motivo: ehReservado ? "linha reservada da plataforma" : "pertence a outro cliente", ok: up.ok });
        }
      }
      // A LINHA DE DEMO PRECISA DE DONO. Soltar sem religar deixa o número mudo — e o vendedor
      // disca ao vivo na frente do prospect. Quando quem sincroniza é a PRÓPRIA Guileo, o agente
      // dela adota as linhas reservadas que estiverem órfãs.
      if (isOwnerEmail(email, env)) {
        const pl2 = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
        if (pl2.ok) {
          const all = await pl2.json().catch(() => []);
          for (const n of (Array.isArray(all) ? all : [])) {
            if (!isReserved(n?.phone_number) || n?.assigned_agent?.agent_id) continue;   // só as órfãs
            const up = await fetch(`https://api.elevenlabs.io/v1/convai/phone-numbers/${n.phone_number_id}`, {
              method: "PATCH",
              headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
              body: JSON.stringify({ agent_id: agentId }),
            });
            numeros_soltos.push({ numero: n.phone_number, motivo: "linha da plataforma adotada pelo agente da Guileo", ok: up.ok });
          }
        }
      }
    } catch { /* limpeza é bônus — nunca derruba o sync */ }

    // IDENTIDADE DO CLIENTE — sincronizar o agente é exatamente o momento de atualizar a marca que
    // vai nos e-mails dele (brandFor extrai do site do negócio na primeira vez e guarda). Devolver
    // isso torna verificável a pergunta "o e-mail sai com o logo do CLIENTE?" — sem abrir a caixa.
    const brand = await brandFor(env, email).catch(() => null);

    // ── PROVA DE PONTA A PONTA (selftest:true) ───────────────────────────────────────────────
    // Roda o MESMO caminho HTTP que a agente usa para marcar — availability e depois book em
    // dry-run — falando como gente ("amanhã às 10"). Existe porque eu não consigo chamar
    // /api/agent-schedule de fora (o segredo é da agente), e "o código parece certo" não é prova:
    // o bug que derrubou TODA marcação por telefone vivia exatamente nessa costura.
    // O servidor chama a si mesmo com o segredo que já tem — nada é exposto.
    // dry_run: decide sem gravar, sem e-mail, sem gastar. Prova a decisão, não o efeito.
    let selftest = null; let ciclo = null;
    if (b.selftest === true) {
      const origin = new URL(request.url).origin;
      const chamar = (corpo) => fetch(`${origin}/api/agent-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guileo-secret": env.AGENT_ACTION_SECRET || "" },
        body: JSON.stringify({ email, ...corpo }),
      }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) })).catch((e) => ({ status: 0, body: { erro: String(e).slice(0, 80) } }));

      const bizTzSelftest = "America/New_York";
      const disp = await chamar({ op: "availability" });
      // A PERGUNTA VEM DO DADO VIVO. Fixar "amanhã às 10" faz o teste depender do relógio: passa
      // num horário e falha noutro, sem nada ter quebrado. Pegamos o PRIMEIRO horário realmente
      // livre e perguntamos por ele em linguagem falada — assim o caminho de linguagem natural é
      // exercitado de verdade, e o resultado esperado é sempre conhecido.
      const primeiro = (disp.body.slots || [])[0]?.start || null;
      let falado = (b.selftest_when || "").toString();
      if (!falado && primeiro) {
        const p = new Intl.DateTimeFormat("en-CA", { timeZone: bizTzSelftest, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(primeiro));
        const g = (t) => (p.find((x) => x.type === t) || {}).value;
        const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: bizTzSelftest, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
        const dia = `${g("year")}-${g("month")}-${g("day")}`;
        falado = `${dia === hoje ? "hoje" : "amanha"} as ${Number(g("hour"))}:${g("minute")}`;
      }
      const marca = falado
        ? await chamar({ op: "book", when: falado, name: "PROVA", contact: "prova@guileoai.com", dry_run: true })
        : { status: 0, body: {} };

      // ── CICLO COMPLETO (selftest_ciclo:true) ────────────────────────────────────────────────
      // Marca DE VERDADE, remarca FALANDO, confere que moveu para o horário certo, e cancela.
      // Existe porque o remarcar mandava a frase falada crua para o banco — e nenhum teste em
      // dry-run pegaria isso, já que o dry-run nem chega a remarcar. O ciclo é o único jeito.
      // A limpeza roda em `finally`: um teste que deixa lixo na agenda de um cliente é pior que
      // nenhum teste.
      if (b.selftest_ciclo === true && falado) {
        const contato = "prova-ciclo@guileoai.com";
        let feito = null;
        try {
          feito = await chamar({ op: "book", when: falado, name: "PROVA CICLO", contact: contato });
          const segundo = (disp.body.slots || [])[1]?.start || null;
          let remarcado = null, faladoNovo = null;
          if (feito.body?.ok && segundo) {
            const p2 = new Intl.DateTimeFormat("en-CA", { timeZone: bizTzSelftest, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(segundo));
            const g2 = (t) => (p2.find((x) => x.type === t) || {}).value;
            const hoje2 = new Intl.DateTimeFormat("en-CA", { timeZone: bizTzSelftest, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
            faladoNovo = `${`${g2("year")}-${g2("month")}-${g2("day")}` === hoje2 ? "hoje" : "amanha"} as ${Number(g2("hour"))}:${g2("minute")}`;
            remarcado = await chamar({ op: "reschedule", when: faladoNovo, contact: contato });
          }
          ciclo = {
            marcou: !!feito.body?.ok, ref: feito.body?.ref || null,
            // resposta crua: deduzir de um booleano já me custou duas rodadas
            resposta_marcar: JSON.stringify(feito.body || {}).slice(0, 220),
            remarcou_falando: faladoNovo,
            remarcou: !!remarcado?.body?.ok,
            resposta: (remarcado?.body?.message || "").slice(0, 90),
            passou: !!feito.body?.ok && !!remarcado?.body?.ok,
          };
        } catch (e) { ciclo = { erro: String(e).slice(0, 90), passou: false }; }
        finally {
          // limpa SEMPRE — mesmo se algo acima explodiu
          try { await chamar({ op: "cancel", contact: contato }); } catch { /* nada a fazer */ }
        }
      }
      selftest = {
        disponibilidade: { status: disp.status, horarios: (disp.body.slots || []).length, primeiro },
        pediu_falando: falado,
        marcacao: { status: marca.status, decidiu: marca.body?.decision?.slot || null, recusou: marca.body?.ok === false ? (marca.body.message || "").slice(0, 90) : null },
        // o veredito em uma linha: ou ela escolheu um horário real, ou não marcou
        // O teste tem que exigir um CARIMBO DE DATA, não "algum valor". A primeira versão só
        // checava se `slot` existia e deu verde para a frase falada crua ("amanhã às 10") —
        // um teste frouxo é pior que nenhum, porque dá permissão para embarcar o defeito.
        passou: marca.status === 200 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(marca.body?.decision?.slot || "")),
      };
    }

    // PROVA DO E-MAIL — `email_test:true` renderiza a confirmação REAL (mesmo template que a agente
    // usa ao marcar) e MANDA. Existe porque "o e-mail sai bonito" só vale se ele chegar: render
    // local prova o HTML, não a entrega. Erro de domínio não verificado no Resend, por exemplo,
    // só aparece aqui.
    //
    // ── SEGURANÇA ──
    // O destino é SEMPRE o e-mail do próprio cliente autenticado — quem chama já provou a chave de
    // conexão dele. Não aceita destinatário livre: um endpoint de teste que manda pra qualquer
    // endereço é relay de phishing com outro nome.
    let email_test = null;
    if (b.email_test === true) {
      if (!env.RESEND_API_KEY) email_test = { enviado: false, motivo: "RESEND_API_KEY não configurada" };
      else {
        // endereço + telefone do primeiro local ativo, pra prova sair com dado real do negócio
        let addr = "", locPhone = "", locName = "";
        try {
          const lr = await rpc("biz_lookup", { p_secret: env.SCHED_SECRET || "", p_email: email });
          if (lr.ok) { const d = await lr.json().catch(() => null); const L = (d && d.locations || [])[0];
            if (L) { addr = L.address || ""; locPhone = L.phone || ""; locName = L.name || ""; } }
        } catch { /* prova segue sem endereço */ }
        const tpl = appointmentEmail({
          kind: "book", name: agentName || "there", business,
          service: "TESTE — confirmação de agendamento", whenLabel: "amostra",
          location: locName, address: addr, locPhone, ref: "TESTE", lang, brand,
        });
        const mr = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [email], subject: tpl.subject, html: tpl.html }),
        });
        // checar o retorno É o ponto: "mandei" sem conferir foi o que criou este problema.
        const detail = mr.ok ? "" : (await mr.text().catch(() => "")).slice(0, 200);
        email_test = { enviado: mr.ok, para: email, assunto: tpl.subject, status: mr.status, ...(detail ? { detail } : {}) };
      }
    }
    return json({ ok: true, agent_id: agentId, languages, brand, ...(numeros_soltos.length ? { numeros_soltos } : {}), ...(selftest ? { selftest } : {}), ...(typeof ciclo !== "undefined" && ciclo ? { ciclo } : {}), ...(email_test ? { email_test } : {}) });
  } catch (e) { return json({ error: String(e).slice(0, 140) }, 400); }
}
