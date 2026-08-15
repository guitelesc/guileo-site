// Cloudflare Pages Function — POST /api/prontidao
//
// "ESTÁ TUDO LIGADO?" — respondido por quem sabe: as próprias contas externas.
//
// POR QUE EXISTE: em 2026-08-06 o Luis pediu "faz o Stripe Connect e o A2P". Nenhum dos dois é
// código: um é um botão no painel do Stripe, o outro é um registro LEGAL da empresa na Twilio
// (EIN, endereço, representante). Eu não entro em conta de ninguém. Mas ficar adivinhando o que
// falta clicar é pior ainda — a ATIVACOES.md já apontou coisa que estava ligada e coisa que não.
// Esta rota pergunta pro Stripe e pra Twilio o estado REAL e devolve o próximo clique exato.
//
// Só LÊ. Não cria conta conectada, não submete registro, não gasta. Diagnóstico, não ação.
//
// ── ACESSO ──
// Gated pela chave de conexão do tenant DONO (guard.isOwnerEmail). É a conta da própria Guileo,
// não de cliente — e o conteúdo (status de faturamento/compliance da plataforma) é do dono.
import { json, isOwnerEmail, sameOrigin, rateLimited } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

// fetch NÃO lança em 4xx/5xx — cada leitura devolve {ok, d} e quem chama decide.
async function ler(url, headers) {
  try {
    const r = await fetch(url, { headers });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, d };
  } catch (e) { return { ok: false, status: 0, d: { erro: String(e).slice(0, 80) } }; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "prontidao", 20)) return json({ error: "muitas tentativas" }, 429);
    const b = await request.json().catch(() => ({}));
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.key || "").toString().trim();
    if (!isOwnerEmail(email, env)) return json({ error: "unauthorized" }, 401);
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);

    const out = {};

    // ── STRIPE: o Connect está habilitado na plataforma? ──────────────────────────────────────
    // Listar contas conectadas é a pergunta mais barata: se o Connect não estiver ligado, o
    // Stripe recusa com uma mensagem que diz exatamente isso.
    if (!env.STRIPE_SECRET_KEY) out.stripe = { pronto: false, motivo: "STRIPE_SECRET_KEY não configurada" };
    else {
      const r = await ler("https://api.stripe.com/v1/accounts?limit=1", { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` });
      out.stripe = r.ok
        ? { pronto: true, connect_ligado: true, contas_conectadas: (r.d.data || []).length }
        : { pronto: false, connect_ligado: false, status: r.status,
            motivo: (r.d?.error?.message || "").slice(0, 200),
            clique: "Stripe → Connect → Get started (habilitar Connect na plataforma)" };
    }

    // ── TWILIO: o registro A2P 10DLC (o que libera SMS nos EUA) ───────────────────────────────
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) out.twilio = { pronto: false, motivo: "credenciais Twilio não configuradas" };
    else {
      const auth = "Basic " + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
      const conta = await ler(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}.json`, { Authorization: auth });
      const marca = await ler("https://messaging.twilio.com/v1/a2p/BrandRegistrations", { Authorization: auth });
      const perfis = await ler("https://trusthub.twilio.com/v1/CustomerProfiles", { Authorization: auth });
      const brands = (marca.d?.data || marca.d?.brand_registrations || []);
      // MARCA APROVADA NÃO É SMS LIBERADO. O painel mostrava erro 30034 ("mensagem de número não
      // registrado") COM a marca já aprovada — porque falta o passo seguinte: uma CAMPANHA (use
      // case) e o número dentro do Messaging Service. Parar na marca é o erro clássico de A2P.
      const svcs = await ler("https://messaging.twilio.com/v1/Services", { Authorization: auth });
      const servicos = [];
      for (const sv of (svcs.d?.services || []).slice(0, 5)) {
        const nums = await ler(`https://messaging.twilio.com/v1/Services/${sv.sid}/PhoneNumbers`, { Authorization: auth });
        const camp = await ler(`https://messaging.twilio.com/v1/Services/${sv.sid}/Compliance/Usa2p`, { Authorization: auth });
        const itens = camp.d?.compliance || camp.d?.us_app_to_person || [];
        servicos.push({
          nome: sv.friendly_name,
          numeros_dentro: (nums.d?.phone_numbers || []).map((n) => n.phone_number),
          campanha: (Array.isArray(itens) ? itens : []).map((c) => c.campaign_status),
          // O MOTIVO da reprovação é o que transforma "falhou" em "conserte isto". Sem ele o dono
          // reenvia a mesma campanha e ela falha de novo.
          motivo_falha: (Array.isArray(itens) ? itens : []).flatMap((c) => c.errors || c.rejection_reason || []).slice(0, 3),
        });
      }
      out.twilio = {
        servicos_de_mensagem: servicos,
        // a conta que o SISTEMA usa — se não bater com a do painel, é outra conta
        conta_do_sistema: (env.TWILIO_ACCOUNT_SID || "").slice(0, 10) + "…",
        conta_alcancada: conta.ok,
        nome_da_conta: conta.d?.friendly_name || null,
        situacao: conta.d?.status || null,
        perfil_de_negocio: (perfis.d?.results || []).map((p) => ({ nome: p.friendly_name, status: p.status })),
        marca_a2p: brands.map((x) => ({ status: x.status, falha: x.failure_reason || null })),
        // SMS só está liberado com marca aprovada E campanha verificada E número no pool. Olhar
        // só a marca (o que eu fiz primeiro) devolvia "pronto" com a campanha reprovada.
        pronto_para_sms: brands.some((x) => String(x.status).toUpperCase() === "APPROVED")
          && servicos.some((s2) => (s2.campanha || []).some((c) => String(c).toUpperCase() === "VERIFIED") && s2.numeros_dentro.length > 0),
        // A dica segue o DADO. Um texto fixo mandaria "termine o registro" com a marca já
        // aprovada — conselho errado com cara de certo.
        clique: !brands.length
          ? "Twilio → Messaging → Regulatory Compliance → A2P 10DLC → começar o registro (EIN + endereço + representante)"
          : !brands.some((x) => String(x.status).toUpperCase() === "APPROVED")
            ? "Twilio → A2P 10DLC: registro enviado, aguardando aprovação"
            : servicos.some((s2) => (s2.campanha || []).some((c) => String(c).toUpperCase() === "VERIFIED"))
              ? (servicos.some((s2) => s2.numeros_dentro.length) ? "nada — SMS liberado" : "Twilio → Messaging Service → adicionar o número ao Sender Pool")
              : "Twilio → Messaging → Messaging Services → criar/registrar a CAMPANHA (use case) e pôr o número no Sender Pool",
      };
    }
    // ── OS DEMAIS MOTORES ────────────────────────────────────────────────────────────────────
    // Cada um é lido na FONTE, nunca num documento. A ATIVACOES.md já apontou como ligado algo
    // que não estava, e como pendente algo que já funcionava — documento envelhece, conta não.
    const rpc = (fn, args) => fetch(`${SB}/rest/v1/rpc/${fn}`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

    // VOZ — a agente existe na ElevenLabs e tem número que atende?
    if (env.ELEVENLABS_API_KEY) {
      const ag = await ler("https://api.elevenlabs.io/v1/convai/agents?page_size=30", { "xi-api-key": env.ELEVENLABS_API_KEY });
      const pn = await ler("https://api.elevenlabs.io/v1/convai/phone-numbers", { "xi-api-key": env.ELEVENLABS_API_KEY });
      const nums = Array.isArray(pn.d) ? pn.d : [];
      out.voz = {
        agentes: (ag.d?.agents || []).length,
        numeros: nums.length,
        numeros_sem_agente: nums.filter((n) => !n?.assigned_agent?.agent_id).map((n) => n.phone_number),
        pronto: (ag.d?.agents || []).length > 0 && nums.some((n) => n?.assigned_agent?.agent_id),
      };
    } else out.voz = { pronto: false, motivo: "ELEVENLABS_API_KEY ausente" };

    // AGENDA — o motor responde e existe horário livre? (usa o tenant DONO como sonda)
    // A sonda precisa passar um SERVIÇO real: biz_availability exige um, e sem ele devolve
    // "service not found" — o que parece motor quebrado e não é. Um painel que erra o diagnóstico
    // é pior que nenhum: manda consertar o que está bom.
    const menu = await rpc("biz_lookup", { p_secret: env.SCHED_SECRET || "", p_email: email }).catch(() => null);
    const svc1 = (menu?.services || [])[0] || null;
    const disp = svc1 ? await rpc("biz_availability", {
      p_secret: env.SCHED_SECRET || "", p_email: email,
      p_service_id: svc1.id, p_location_id: null, p_pro_id: null, p_days: 7, p_limit: 3,
    }).catch(() => null) : { error: "tenant sem serviço cadastrado" };
    out.agenda = disp && !disp.error
      ? { pronto: Array.isArray(disp.slots), horarios_livres: (disp.slots || []).length, servico_sondado: svc1?.name || null }
      : { pronto: false, motivo: disp?.error || "motor de agenda não respondeu" };

    // E-MAIL — a chave do Resend é válida? (lista domínios: leitura, não envia nada)
    if (env.RESEND_API_KEY) {
      const r = await ler("https://api.resend.com/domains", { Authorization: `Bearer ${env.RESEND_API_KEY}` });
      const doms = (r.d?.data || []);
      out.email = {
        pronto: r.ok && doms.some((d) => String(d.status).toLowerCase() === "verified"),
        dominios: doms.map((d) => `${d.name}:${d.status}`),
        remetente: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>",
      };
      // Domínio não verificado = e-mail sai mas cai em spam ou é recusado. Não é "quase pronto".
      if (r.ok && !out.email.pronto) out.email.clique = "Resend → Domains → verificar guileoai.com (SPF/DKIM no Cloudflare)";
    } else out.email = { pronto: false, motivo: "RESEND_API_KEY ausente" };

    // WHATSAPP / META — o app está publicado? (sem isso a ENTRADA funciona e a SAÍDA não)
    out.whatsapp = env.META_APP_ID && env.META_APP_SECRET
      ? { configurado: true, pronto: null, nota: "entrada provada; saída depende do app publicado na Meta — só o painel da Meta responde isso" }
      : { configurado: false, pronto: false, motivo: "META_APP_ID/SECRET ausentes" };

    // GOOGLE AGENDA — algum cliente realmente conectou?
    const gc = await rpc("client_integrations_count", { p_secret: env.INGEST_SECRET || "", p_provider: "gcal" }).catch(() => null);
    out.google_agenda = { clientes_conectados: typeof gc === "number" ? gc : null,
      pronto: typeof gc === "number" ? gc > 0 : null,
      nota: "sem isso a Gui marca no banco da Guileo e a recepção não vê na agenda dela" };

    // ── VEREDITO ÚNICO ───────────────────────────────────────────────────────────────────────
    // "Está tudo perfeito?" só tem resposta honesta quando alguém EXECUTA cada motor. Ler
    // configuração diz que a chave existe; não diz que o motor gira. Este bloco separa as duas
    // coisas de propósito: `configurado` é leitura, `provado` é execução. Só o segundo conta.
    const provas = {};
    if (b.testar === true) {
      const origin = new URL(request.url).origin;
      const eu = { email, key };
      const post = (rota, corpo) => fetch(`${origin}${rota}`, {
        method: "POST", headers: { "Content-Type": "application/json", Origin: origin, Referer: origin + "/" },
        body: JSON.stringify(corpo),
      }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) })).catch((e) => ({ status: 0, body: { erro: String(e).slice(0, 80) } }));

      // AGENDA + VOZ: o ciclo real de marcação, falando como gente (dry-run, não grava).
      const sa = await post("/api/sync-agent", { ...eu, business: "Guileo AI", lang: "en", selftest: true });
      provas.marcar_falando = { passou: !!sa.body?.selftest?.passou, pediu: sa.body?.selftest?.pediu_falando || null };

      // MEMÓRIA: o sistema reconhece quem liga? (é o que faz a agente chamar pelo nome)
      const mem = await rpc("crm_caller_lookup", { p_secret: env.INGEST_SECRET || "", p_email: email, p_phone: "+19295350191" });
      provas.reconhece_quem_liga = { passou: Array.isArray(mem) ? !!mem[0]?.full_name : !!mem?.full_name,
        nome: (Array.isArray(mem) ? mem[0]?.full_name : mem?.full_name) || null };

      // E-MAIL: envia de verdade para o PRÓPRIO dono (destino travado; nunca terceiros).
      const em = await post("/api/sync-agent", { ...eu, business: "Guileo AI", lang: "en", email_test: true });
      provas.email_chega = { passou: !!em.body?.email_test?.enviado, detalhe: em.body?.email_test?.detail || null };
    }

    // Um motor só é VERDE quando a execução prova. Configuração sozinha é amarelo.
    const veredito = b.testar === true ? {
      voz_e_agenda: provas.marcar_falando?.passou ? "verde" : "vermelho",
      memoria: provas.reconhece_quem_liga?.passou ? "verde" : "vermelho",
      email: provas.email_chega?.passou ? "verde" : "vermelho",
      sms: out.twilio?.pronto_para_sms ? "verde" : "vermelho (campanha A2P)",
      pagamento: out.stripe?.pronto ? "verde" : "vermelho",
      google_agenda: out.google_agenda?.pronto ? "verde" : "vermelho (nenhum cliente conectado)",
    } : null;

    return json({ ok: true, ...out, ...(Object.keys(provas).length ? { provas } : {}), ...(veredito ? { veredito } : {}) });
  } catch (e) { return json({ error: String(e).slice(0, 140) }, 400); }
}
