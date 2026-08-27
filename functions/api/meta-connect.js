// Cloudflare Pages Function — POST /api/meta-connect
// ADMIN-ONLY. Liga uma Página do Facebook / conta Instagram a um cliente do Guileo: guarda o
// Page Access Token (segredo do dono) + mapeia page_id/ig_id → client_email, pra o webhook
// (functions/api/meta-webhook.js) saber DE QUEM é a mensagem e a Gui poder RESPONDER.
//   { action:"connect", token, email, page_id, page_access_token, ig_id?, business? } -> { ok }
//   { action:"status",  token, email }  -> { ok, connected, page_id, ig_id, business }
// Gate: mesmo blitz_stats das outras admin (onboard-client/company-finance). O token da página é
// COLADO pelo dono (Claude nunca digita segredo) e vai direto pro meta_creds_store (INGEST-gated).
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, { method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const s = (v, n = 400) => (v == null ? "" : v.toString().trim().slice(0, n));
const GRAPH = "https://graph.facebook.com/v21.0";
const SUBSCRIBE_FIELDS = "messages,messaging_postbacks"; // campos válidos p/ Messenger (provado 2026-07-24)

// Subscribe THIS page to the app's webhook so Meta actually DELIVERS inbound DMs to our webhook.
// Without this, the page has the token but Meta never POSTs the message → the Gui never sees it.
// Uses the page's OWN access token (server-side only, never echoed). Best-effort: returns a small
// status object; a failure never breaks connect (the owner can also toggle it in the dashboard).
// ── A INSCRIÇÃO TEM DOIS NÍVEIS, E ISSO CUSTOU UM TESTE REAL (2026-08-27) ────────────────────
// (1) APP → OBJETO: `/{app_id}/subscriptions` com object=instagram e fields=comments,messages.
// (2) PÁGINA → APP: esta função. A Meta só entrega evento de uma conta quando os DOIS existem.
// O `empresas.js` responde "inscrita no webhook ✓" olhando só se EXISTE app inscrito — nunca
// olhou QUAIS campos. E a constante do projeto sempre foi "messages,messaging_postbacks": uma
// Página inscrita sem `comments` recebe DM e ignora comentário, com o painel dizendo verde.
//
// 🚨 `subscribed_fields` SOBRESCREVE a lista inteira, igual ao nível do app. Passar só `comments`
// aqui APAGARIA `messages` e mataria a DM. Por isso: lê o que já está lá, manda a UNIÃO, e relê
// para devolver antes/depois. Nunca escreve às cegas.
async function subscribePage(pageId, pageToken, fields) {
  if (!pageId || !pageToken) return { subscribed: false, reason: "missing page_id/token" };
  if (!/^\d+$/.test(String(pageId))) return { subscribed: false, reason: "page_id inválido (só números)" };
  const lerCampos = async () => {
    try {
      const g = await fetch(`${GRAPH}/${encodeURIComponent(pageId)}/subscribed_apps?access_token=${encodeURIComponent(pageToken)}`);
      if (!g.ok) return null;
      const d = await g.json().catch(() => null);
      const linhas = (d && Array.isArray(d.data)) ? d.data : [];
      const meu = linhas[0] || null;   // o token é da Página; a lista traz o(s) app(s) inscrito(s)
      return meu && Array.isArray(meu.subscribed_fields) ? meu.subscribed_fields.map(String) : [];
    } catch { return null; }
  };
  try {
    const pedidos = String(fields || SUBSCRIBE_FIELDS).split(",").map((f) => f.trim()).filter(Boolean);
    const antes = await lerCampos();
    if (antes === null) return { subscribed: false, reason: "não consegui LER os campos atuais — não escrevi nada (fail-closed)" };
    const uniao = [...new Set([...antes, ...pedidos])];
    if (antes.length && pedidos.every((f) => antes.includes(f))) {
      return { subscribed: true, ja_estava: true, antes, depois: antes };
    }
    const r = await fetch(`${GRAPH}/${encodeURIComponent(pageId)}/subscribed_apps`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ subscribed_fields: uniao.join(","), access_token: pageToken }).toString(),
    });
    const d = await r.json().catch(() => ({}));
    if (!(r.ok && d && d.success)) {
      return { subscribed: false, antes, tentou: uniao, reason: s((d && d.error && d.error.message) || `HTTP ${r.status}`, 160) };
    }
    const depois = (await lerCampos()) || [];
    const faltou = uniao.filter((f) => !depois.includes(f));
    return { subscribed: faltou.length === 0, antes, depois, adicionados: pedidos.filter((f) => !antes.includes(f)),
      ...(faltou.length ? { aviso: `a Meta disse success mas ao reler faltou: ${faltou.join(", ")}` } : {}) };
  } catch (e) { return { subscribed: false, reason: s(e, 120) }; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "meta-connect", 30)) return json({ error: "too many requests" }, 429);
    // ── ACEITA JSON **OU** FORMULÁRIO ────────────────────────────────────────────────────────
    // POR QUE (25/08): a linha com JSON dentro de aspas simples travou o terminal do Luis DUAS
    // vezes em `quote>` — aspa dentro de aspa, comando longo, colagem duplicada. Um contrato que
    // só aceita JSON transfere para quem chama um problema de citação que é nosso de resolver.
    // Com formulário, `curl -d action=auto -d user_token=EAA...` é UMA linha, sem aspa nenhuma,
    // impossível de quebrar na colagem.
    const ct = (request.headers.get("content-type") || "").toLowerCase();
    let b = {};
    if (ct.includes("application/x-www-form-urlencoded")) {
      const f = await request.formData().catch(() => null);
      if (f) for (const [k, v] of f.entries()) b[k] = typeof v === "string" ? v : "";
      // Formulário não tem booleano: "true"/"1" viram true, para `gravar` funcionar igual.
      if (b.gravar === "true" || b.gravar === "1") b.gravar = true;
    } else {
      b = await request.json().catch(() => ({}));
    }
    const ING = env.INGEST_SECRET || "";
    // ADMIN gate (mesma RPC do onboard-client). Token errado → non-200 → 401.
    const gate = await rpc("blitz_stats", { p_token: s(b.token, 200), p_email: "" });
    if (!gate.ok) return json({ error: "unauthorized" }, 401);

    const email = s(b.email, 160).toLowerCase();
    const action = (b.action || "connect").toString();
    // ⚠️ `auto` NÃO é sobre um tenant: ele lê as Páginas da conta inteira e grava pelo `mapa`.
    // Exigir e-mail aqui fazia a chamada morrer com "email inválido" antes de qualquer trabalho —
    // uma validação copiada das outras ações que não pertence a esta.
    if (action !== "auto" && !email.includes("@")) return json({ error: "email inválido" }, 400);

    if (action === "status") {
      const r = await rpc("meta_creds_get", { p_secret: ING, p_email: email }).catch(() => null);
      const t = r && r.ok ? await r.json().catch(() => null) : null;
      const tok = t && typeof t === "object" ? t : {};
      const guardado = !!(tok.page_id || tok.ig_id);

      // ⚠️ "CONECTADO" PASSA A SIGNIFICAR "A META ACEITA", não "existe um token no nosso banco".
      // Encontrado em 25/08: o painel dizia conectado para o Natura enquanto a Meta respondia
      // «Error validating access token: the session has been invalidated because the user changed
      // their password». Ou seja, a página estava MUDA e a tela dizia que estava no ar — a mesma
      // doença do WhatsApp em agosto (chave presente ≠ chave viva). Regra da casa desde então:
      // sinal de canal se pergunta ao PROVEDOR.
      // TRÊS ESTADOS, nunca dois: vivo / morto (com o motivo da Meta) / não deu para checar.
      let vivo = null, motivo = "";
      if (guardado && tok.has_token && tok.page_id) {
        try {
          const tr = await svcJson(env, "meta_token_for_email", { p_secret: ING, p_email: email }).catch(() => null);
          const tkn = (typeof tr === "string") ? tr : "";
          if (!tkn) { vivo = false; motivo = "o token não está mais guardado"; }
          else {
            // /me com token de Página = a própria Página, e funciona com escopo mínimo. Ler
            // `/{page_id}?fields=name` exigia escopo que estes tokens não têm e devolvia
            // `(#100) Object does not exist` para conexão VIVA — vermelho falso.
            const g = await fetch(`${GRAPH}/me?fields=id,name&access_token=${encodeURIComponent(tkn)}`);
            const gj = await g.json().catch(() => null);
            if (g.ok && gj && !gj.error) { vivo = true; motivo = gj.name ? `a Meta confirma: ${gj.name}` : "a Meta aceitou o token"; }
            else { vivo = false; motivo = s((gj && gj.error && gj.error.message) || `a Meta recusou (HTTP ${g.status})`, 240); }
          }
        } catch { vivo = null; motivo = "não consegui falar com a Meta agora — isto NÃO é um ok"; }
      } else if (guardado) { vivo = false; motivo = "página mapeada mas sem token guardado"; }

      return json({
        ok: true,
        connected: vivo === true,          // só é conectado se a META disser que sim
        guardado, vivo, motivo,
        instagram_mapeado: !!tok.ig_id,    // sem isto, DM do Instagram não acha o dono
        page_id: tok.page_id || "", ig_id: tok.ig_id || "", business: tok.business_name || "",
      });
    }

    // ── auto: UM TOKEN DE USUÁRIO E O RESTO É NOSSO ─────────────────────────────────────────────
    // POR QUE (25/08): o caminho manual tem seis passos e cada um tem uma armadilha. A pior: o
    // token que o Explorer entrega por padrão dura 1-2 HORAS, e o nosso `connect` o RECUSA de
    // propósito (token curto = página muda amanhã sem ninguém perceber). Trocar por um longo exige
    // o APP SECRET — que mora aqui no servidor, não na mão do dono. Então o servidor faz:
    //   1. troca o token de usuário CURTO por um LONGO (fb_exchange_token, com APP_ID+APP_SECRET);
    //   2. lê `me/accounts` — os tokens de Página derivados de um usuário longo NÃO EXPIRAM;
    //   3. traz junto o `instagram_business_account` de cada Página — é o `ig_id` que nunca foi
    //      preenchido e sem o qual a DM do Instagram some sem rastro;
    //   4. devolve a lista pronta. Guardar é o passo seguinte (`connect`), com o dono ciente.
    // NUNCA devolve o token de usuário nem os de Página no corpo — só nomes, ids e um resumo.
    if (action === "auto") {
      const userToken = s(b.user_token, 600);
      if (!userToken) return json({ ok: false, motivo: "cole o Token de Usuário do Explorer" }, 400);
      if (!env.META_APP_ID || !env.META_APP_SECRET) return json({ ok: false, motivo: "META_APP_ID/META_APP_SECRET ausentes no ambiente" }, 200);

      // 1) curto → longo. Se já for longo, a Meta devolve outro longo: a troca é idempotente.
      const ex = await fetch(`${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(env.META_APP_ID)}&client_secret=${encodeURIComponent(env.META_APP_SECRET)}&fb_exchange_token=${encodeURIComponent(userToken)}`);
      const ej = await ex.json().catch(() => null);
      if (!ex.ok || !ej || !ej.access_token) {
        return json({ ok: false, motivo: "a Meta recusou trocar por um token longo", detalhe: s((ej && ej.error && ej.error.message) || `HTTP ${ex.status}`, 240) }, 200);
      }
      const longo = ej.access_token;

      // 2+3) as Páginas, com o Instagram de cada uma.
      const ac = await fetch(`${GRAPH}/me/accounts?fields=name,id,access_token,instagram_business_account{id,username,name}&limit=50&access_token=${encodeURIComponent(longo)}`);
      const aj = await ac.json().catch(() => null);
      if (!ac.ok || !aj || aj.error) {
        return json({ ok: false, motivo: "a Meta recusou listar as Páginas", detalhe: s((aj && aj.error && aj.error.message) || `HTTP ${ac.status}`, 240),
          dica: "o token precisa de pages_show_list (e instagram_basic para trazer o Instagram)" }, 200);
      }
      const paginas = (Array.isArray(aj.data) ? aj.data : []).map((p) => ({
        page_id: p.id, nome: p.name || "",
        tem_token: !!p.access_token,
        instagram: p.instagram_business_account
          ? { id: p.instagram_business_account.id, usuario: p.instagram_business_account.username || "", nome: p.instagram_business_account.name || "" }
          : null,
      }));

      // 4) GUARDA, se pedido. Sem `gravar:true` isto é só um raio-x — ver antes de escrever é a
      // diferença entre conectar e conectar a coisa certa no cliente certo.
      // ── MAPA NOMEADO ────────────────────────────────────────────────────────────────────────
      // `mapa=nossas` evita mandar um array de JSON na linha de comando — que foi exatamente o que
      // travou o terminal. As empresas do Luis e suas Páginas (lidas da Meta em 25/08) ficam aqui,
      // onde dá para conferir, em vez de serem redigitadas a cada vez. Empresa nova: uma linha.
      const MAPA_NOSSAS = [
        { page_id: "1077756798764895", email: "smart@guileoai.com" },   // Guileo AI
        { page_id: "1088591857680829", email: "dr@medmundobr.com" },    // MED MUNDO BR
        { page_id: "473513109188564", email: "visa@chigotravels.com" }, // Chigo Turismo e Negócios
      ];
      let mapa = Array.isArray(b.mapa) ? b.mapa : null;
      if (!mapa && String(b.mapa || "") === "nossas") mapa = MAPA_NOSSAS;

      let gravados = null;
      if (b.gravar === true && Array.isArray(mapa)) {
        gravados = [];
        for (const m of mapa) {
          const alvoEmail = s(m.email, 160).toLowerCase();
          const p = (Array.isArray(aj.data) ? aj.data : []).find((x) => String(x.id) === String(m.page_id));
          if (!alvoEmail.includes("@") || !p || !p.access_token) { gravados.push({ page_id: m.page_id, ok: false, motivo: "página não encontrada ou sem token" }); continue; }
          const igId = p.instagram_business_account?.id || "";
          const r = await rpc("meta_creds_store", { p_secret: ING, p_email: alvoEmail,
            p_tokens: { page_id: String(p.id), ig_id: String(igId), page_access_token: p.access_token, business_name: p.name || "" } });
          const okS = r.ok ? await r.json().catch(() => null) : null;
          gravados.push({ page_id: p.id, nome: p.name, email: alvoEmail, ig_id: igId || null, ok: okS === true,
            motivo: okS === true ? (igId ? "Página + Instagram mapeados ✓" : "Página mapeada (esta Página não tem Instagram ligado)") : "não gravou" });
        }
      }

      return json({ ok: true, paginas, total: paginas.length, gravados,
        recado: paginas.length ? "confira a lista e mande de novo com gravar=true e mapa=nossas" : "nenhuma Página — falta pages_show_list no token, ou esta conta não administra Páginas" });
    }

    // ── auditar: PERGUNTA À META de quem é a página, e descobre o Instagram sozinho ────────────
    // POR QUE (25/08): a DM de Instagram nunca foi roteada — não por defeito de código, mas porque
    // o `ig_id` nunca foi preenchido na conexão. E numa DM do Instagram o `recipient.id` é o ID do
    // INSTAGRAM, não o da Página: sem essa linha no mapa, nada casa e a mensagem some em silêncio.
    // Fazer o dono caçar esse número no painel da Meta é pedir para ele errar. A Meta sabe: basta
    // perguntar `instagram_business_account` com o token que já está guardado.
    // Também confronta MAPA × CREDENCIAL: o mapa pode apontar para um tenant que não tem token
    // (foi o estado real encontrado hoje), e aí a mensagem cai no cliente errado, mudo.
    // Só leitura — não escreve nada. Quem conserta é o `connect`, com o dono ciente.
    if (action === "auditar") {
      const r = await rpc("meta_creds_get", { p_secret: ING, p_email: email }).catch(() => null);
      const t = (r && r.ok) ? await r.json().catch(() => null) : null;
      const tok = (t && typeof t === "object") ? t : {};
      const pageId = s(tok.page_id, 60);
      // ⚠️ O TOKEN NÃO VEM DE `meta_creds_get` DE PROPÓSITO: aquela RPC devolve só `has_token`,
      // porque o resultado dela vai para uma tela. Aqui o servidor precisa do token de verdade
      // para PERGUNTAR À META — então usa a leitura server-only (`meta_token_for_email`, revogada
      // de anon). O token é usado e descartado: ele nunca entra na resposta deste endpoint.
      const tr = await svcJson(env, "meta_token_for_email", { p_secret: ING, p_email: email }).catch(() => null);
      const token = (typeof tr === "string") ? tr : "";
      if (!pageId || !token) return json({ ok: false, motivo: `${email} não tem página + token guardados (página: ${pageId ? "sim" : "não"}, token: ${token ? "sim" : "não"}) — conecte primeiro` }, 409);

      // A FONTE É A META, não o nosso banco. Pergunta o nome da página e o Instagram ligado a ela.
      const g = await fetch(`${GRAPH}/me?fields=id,name,instagram_business_account{id,username,name}&access_token=${encodeURIComponent(token)}`);
      const gj = await g.json().catch(() => null);
      if (!g.ok || !gj || gj.error) {
        // ⚠️ NÃO USAR 502 AQUI. O Cloudflare SUBSTITUI o corpo de um 502 pela página de erro dele
        // — a explicação que a gente escreveu com cuidado nunca chega em quem chamou. Foi o que
        // aconteceu na primeira execução desta auditoria (e antes, no cadastro de cliente).
        // Motivo que precisa ser LIDO viaja em 200 com `ok:false`, ou em 409.
        return json({ ok: false, motivo: `a Meta recusou a leitura da página (HTTP ${g.status})`, detalhe: s((gj && gj.error && gj.error.message) || "", 220) }, 200);
      }
      const iba = gj.instagram_business_account || null;

      // Quem o MAPA diz que é o dono deste id (pode não ser este email — é justamente o que caça).
      const dono = await rpc("meta_tenant_for_page", { p_secret: ING, p_page_id: pageId }).catch(() => null);
      const dj = (dono && dono.ok) ? await dono.json().catch(() => null) : null;

      return json({
        ok: true, email,
        pagina: { id: pageId, nome: gj.name || "", segundo_a_meta: true },
        instagram: iba ? { id: iba.id, usuario: iba.username || "", nome: iba.name || "" } : null,
        ig_id_guardado: tok.ig_id || "",
        // 🚨 os dois desencontros que fazem a DM sumir sem rastro:
        falta_mapear_instagram: !!(iba && iba.id && String(tok.ig_id || "") !== String(iba.id)),
        mapa_aponta_para: dj?.client_email || null,
        mapa_diverge: !!(dj?.client_email && dj.client_email !== email),
        recado: !iba ? "esta Página não tem conta do Instagram ligada — conecte o Instagram à Página no painel da Meta antes"
          : (String(tok.ig_id || "") !== String(iba.id)
            ? `o Instagram @${iba.username || iba.id} existe mas NÃO está mapeado — refaça o connect incluindo ig_id=${iba.id}`
            : "Instagram mapeado ✓"),
      });
    }

    // ── mapear_ig: liga o Instagram descoberto pela auditoria, SEM pedir o token de novo ────────
    // A auditoria já perguntou à Meta qual é o `instagram_business_account` da Página. Obrigar o
    // dono a gerar e colar o token outra vez só para gravar um número que nós já sabemos é
    // convidar ao erro (é onde ele desiste, ou cola um token curto que morre amanhã).
    // `meta_creds_store` MESCLA o jsonb (`tokens || excluded`), então mandar só o `ig_id` preserva
    // page_id e token — e a própria RPC cria a linha `ig` no mapa, que é o que faltava para uma DM
    // do Instagram achar o dono.
    if (action === "mapear_ig") {
      const ig_id = s(b.ig_id, 60);
      if (!ig_id) return json({ ok: false, motivo: "informe o ig_id" }, 400);
      const r0 = await rpc("meta_creds_get", { p_secret: ING, p_email: email }).catch(() => null);
      const t0 = (r0 && r0.ok) ? await r0.json().catch(() => null) : null;
      // Sem página conectada antes, mapear só o Instagram deixaria um mapa órfão (sem token para
      // responder). Melhor recusar e mandar conectar a Página primeiro.
      if (!t0 || !t0.page_id) return json({ ok: false, motivo: `${email} não tem Página conectada — conecte a Página primeiro, depois o Instagram` }, 409);
      const r = await rpc("meta_creds_store", { p_secret: ING, p_email: email, p_tokens: { ig_id } });
      const okStored = r.ok ? await r.json().catch(() => null) : null;
      if (okStored !== true) return json({ ok: false, motivo: "não consegui gravar o ig_id" }, 200);
      // CONFERE relendo — "gravou" sem reler é promessa sem lastro.
      const r2 = await rpc("meta_creds_get", { p_secret: ING, p_email: email }).catch(() => null);
      const t2 = (r2 && r2.ok) ? await r2.json().catch(() => null) : null;
      const gravado = String(t2?.ig_id || "");
      return json({ ok: gravado === ig_id, ig_id: gravado, page_id: t2?.page_id || "",
        motivo: gravado === ig_id ? "Instagram mapeado ✓ — a DM já acha o dono" : `gravei mas ao reler veio "${gravado}"` });
    }

    // descobrir_ig — PERGUNTA À META qual conta do Instagram está ligada à Página já conectada.
    // Só LÊ; quem grava é o `mapear_ig` acima, de propósito: ver antes de escrever é a diferença
    // entre mapear o Instagram certo e carimbar o errado no cliente errado.
    //
    // POR QUE ISSO PRECISOU EXISTIR (2026-08-27): o `ig_id` estava vazio nos três tenants, e o
    // único caminho documentado para descobri-lo era esperar alguém comentar/mandar DM e ler o
    // `meta_pagina_nao_mapeada`. Ou seja: para o Instagram funcionar, alguém tinha que primeiro
    // usar o Instagram e falhar. Isso não é descoberta, é armadilha — o número está a uma
    // pergunta de distância da própria Meta, com o token que já guardamos.
    //
    // ⚠️ O ESCOPO É A PARTE DIFÍCIL. `/{page_id}?fields=…` e `/me?fields=name` já devolveram
    // "(#100) requires pages_read_engagement" para tokens PERFEITAMENTE VIVOS (ver empresas.js).
    // Por isso tentamos as duas formas e devolvemos o erro REAL de cada uma — vermelho falso manda
    // consertar o que não está quebrado.
    if (action === "descobrir_ig") {
      // ⚠️ svcJson (SERVICE ROLE), não o `rpc` anônimo daqui de cima. `meta_token_for_email` é
      // servidor-only de propósito — o anon leva 401 e devolve null. Na 1ª versão eu usei o anon e
      // a resposta virou "não tem token guardado" para três tenants que TÊM token: a mensagem
      // acusou o dado em vez de acusar o acesso, que é o diagnóstico falso clássico deste projeto.
      // Agora os dois casos têm frases diferentes, porque o conserto de cada um é diferente.
      const tkn = await svcJson(env, "meta_token_for_email", { p_secret: ING, p_email: email });
      if (typeof tkn !== "string" || !tkn) {
        const httpErro = tkn && typeof tkn === "object" ? tkn.erro_http : null;
        return json({
          ok: false,
          motivo: httpErro
            ? `não consegui LER o token guardado (RPC respondeu ${httpErro}) — o token pode existir; o acesso é que falhou`
            : `${email} não tem token de Página guardado — conecte a Página primeiro`,
          detalhe: (tkn && typeof tkn === "object" && tkn.detalhe) || null,
        }, 409);
      }
      const cred = await svcJson(env, "meta_creds_get", { p_secret: ING, p_email: email });
      const pageId = s(cred && typeof cred === "object" ? cred.page_id : "", 60);

      const tentativas = [];
      const perguntar = async (rotulo, caminho) => {
        try {
          const r = await fetch(`${GRAPH}/${caminho}${caminho.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(tkn)}`);
          const d = await r.json().catch(() => null);
          if (!r.ok || !d || d.error) {
            tentativas.push({ via: rotulo, erro: s((d && d.error && d.error.message) || `HTTP ${r.status}`, 200) });
            return null;
          }
          const ig = d.instagram_business_account;
          if (!ig || !ig.id) { tentativas.push({ via: rotulo, erro: "a Meta respondeu, mas esta Página não tem Instagram ligado" }); return null; }
          return { id: String(ig.id), usuario: s(ig.username, 60), nome: s(ig.name, 120), via: rotulo };
        } catch (e) { tentativas.push({ via: rotulo, erro: s(e, 160) }); return null; }
      };

      // `/me` primeiro: o token de Página É a Página, e essa forma passa com escopo mínimo.
      let achado = await perguntar("/me", "me?fields=instagram_business_account{id,username,name}");
      if (!achado && pageId) achado = await perguntar("/{page_id}", `${encodeURIComponent(pageId)}?fields=instagram_business_account{id,username,name}`);

      if (!achado) {
        return json({ ok: false, motivo: "não consegui descobrir o Instagram desta Página", tentativas, page_id: pageId || null });
      }
      return json({
        ok: true, ig_id: achado.id, usuario: achado.usuario, nome: achado.nome,
        page_id: pageId || null, descoberto_por: achado.via,
        ja_mapeado: String((cred && typeof cred === "object" && cred.ig_id) || "") === achado.id,
        proximo_passo: `action:"mapear_ig" com ig_id:"${achado.id}" para gravar`,
      });
    }

    // subscribe — (re)inscreve a página JÁ conectada no webhook do app, usando o token guardado.
    // Resolve o token via meta_tenant_for_page (o mesmo RPC do webhook). Nunca expõe o token.
    // Passe page_id no body; se faltar, tenta o valor colado em b.page_id.
    if (action === "subscribe") {
      const pid = s(b.page_id, 60);
      if (!pid) return json({ error: "informe o page_id" }, 400);
      const r = await rpc("meta_tenant_for_page", { p_secret: ING, p_page_id: pid }).catch(() => null);
      const t = r && r.ok ? await r.json().catch(() => null) : null;
      const tok = t && typeof t === "object" ? t : {};
      if (!tok.page_access_token) return json({ error: "essa página não tem token guardado (reconecte)" }, 400);
      const fields = s(b.fields, 300) || SUBSCRIBE_FIELDS;
      const sub = await subscribePage(pid, tok.page_access_token, fields);
      return json({ ok: sub.subscribed, ...sub, page_id: pid, fields });
    }

    // app_subscribe — inscreve o APP (não a página) no webhook de um OBJETO da Meta.
    // É a 2ª inscrição que a Meta exige (a página→app é o subscribe acima; esta é app→objeto).
    // Roda 100% server-side com o app-token = META_APP_ID|META_APP_SECRET — o secret NUNCA é exposto.
    //
    //   { action:"app_subscribe" }                                     → object "page"  (Messenger)
    //   { action:"app_subscribe", object:"instagram", fields:"comments" } → comentário do Instagram
    //
    // 🚨 UNIÃO, NUNCA SUBSTITUIÇÃO (2026-08-27). O parâmetro `fields` deste endpoint da Meta
    // SOBRESCREVE a lista inteira do objeto. Mandar `fields=comments` em `instagram` APAGARIA
    // `messages` — e a Gui pararia de responder direct, em silêncio, sem erro em lugar nenhum.
    // Por isso lemos a inscrição atual primeiro e mandamos a UNIÃO. Um campo que já está no ar
    // nunca sai por causa de uma chamada que só queria acrescentar outro.
    if (action === "app_subscribe") {
      const appId = s(env.META_APP_ID, 60), appSecret = env.META_APP_SECRET, verify = s(env.META_VERIFY_TOKEN, 200);
      if (!appId || !appSecret) return json({ error: "META_APP_ID/META_APP_SECRET não estão setados no Cloudflare" }, 400);
      const appTok = `${appId}|${appSecret}`;
      const objeto = s(b.object, 30) || "page";
      const callback = s(b.callback, 300) || "https://guileoai.com/api/meta-webhook";
      const pedidos = (s(b.fields, 200) || SUBSCRIBE_FIELDS).split(",").map((f) => f.trim()).filter(Boolean);
      try {
        // 1) O QUE JÁ ESTÁ NO AR. Falha aqui é fail-CLOSED: sem saber o estado atual não dá para
        //    montar a união com segurança, e escrever às cegas é justamente o risco.
        const gr = await fetch(`${GRAPH}/${appId}/subscriptions?access_token=${encodeURIComponent(appTok)}`);
        if (!gr.ok) {
          const cru = await gr.text().catch(() => "");
          return json({ ok: false, motivo: `não consegui LER a inscrição atual (HTTP ${gr.status}) — não escrevi nada`, cru: s(cru, 200) });
        }
        const atual = await gr.json().catch(() => null);
        const linha = ((atual && atual.data) || []).find((x) => x && x.object === objeto) || null;
        const antes = ((linha && linha.fields) || []).map((f) => (typeof f === "string" ? f : f && f.name)).filter(Boolean);
        const uniao = [...new Set([...antes, ...pedidos])];

        // 2) NADA A FAZER É UMA RESPOSTA. Reescrever à toa é chance de estragar de graça.
        if (antes.length && pedidos.every((f) => antes.includes(f))) {
          return json({ ok: true, ja_estava: true, object: objeto, fields: antes, callback: linha && linha.callback_url });
        }

        const r = await fetch(`${GRAPH}/${appId}/subscriptions`, {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ object: objeto, callback_url: callback, verify_token: verify, fields: uniao.join(","), access_token: appTok }).toString(),
        });
        const d = await r.json().catch(() => ({}));
        if (!(r.ok && d && d.success)) {
          return json({ ok: false, app_subscribed: false, object: objeto, tentou: uniao, reason: s((d && d.error && d.error.message) || `HTTP ${r.status}`, 200) });
        }
        // 3) COMPROVANTE: reler da Meta. "success:true" é o que ELA diz ter feito; a releitura é o
        //    que de fato ficou. Sucesso sem conferir já custou caro neste projeto.
        const vr = await fetch(`${GRAPH}/${appId}/subscriptions?access_token=${encodeURIComponent(appTok)}`);
        const vd = vr.ok ? await vr.json().catch(() => null) : null;
        const vlinha = ((vd && vd.data) || []).find((x) => x && x.object === objeto) || null;
        const depois = ((vlinha && vlinha.fields) || []).map((f) => (typeof f === "string" ? f : f && f.name)).filter(Boolean);
        const faltou = uniao.filter((f) => !depois.includes(f));
        return json({
          ok: faltou.length === 0, app_subscribed: true, object: objeto,
          antes, depois, adicionados: pedidos.filter((f) => !antes.includes(f)),
          callback: (vlinha && vlinha.callback_url) || callback,
          ...(faltou.length ? { aviso: `a Meta disse success mas ao reler faltou: ${faltou.join(", ")}` } : {}),
        });
      } catch (e) { return json({ error: s(e, 160) }, 500); }
    }

    // connect — o dono cola o page_access_token; guardamos + mapeamos a página ao tenant.
    const page_id = s(b.page_id, 60);
    const page_access_token = s(b.page_access_token, 4000);
    const ig_id = s(b.ig_id, 60);
    const business = s(b.business, 160);
    if (!page_id && !ig_id) return json({ error: "informe o ID da Página (page_id) ou do Instagram (ig_id)" }, 400);
    if (!page_access_token) return json({ error: "cole o Page Access Token" }, 400);

    // ── CONFERIR O TOKEN COM A META ANTES DE GUARDAR ────────────────────────────────────────
    // O token que o explorador da Meta entrega POR PADRÃO dura 1 a 2 horas. Sem esta checagem o
    // dono conectava, via funcionar, e no dia seguinte a página ficava MUDA — sem erro em lugar
    // nenhum, com o painel ainda dizendo "conectado". É a mesma doença do "sucesso" falso: o
    // sistema afirmando um estado que não é mais verdade.
    // Perguntamos à própria Meta (debug_token, autenticado com o token do APP) três coisas:
    // é válido? expira quando? Se expira em menos de 30 dias, RECUSAMOS — melhor não conectar
    // do que conectar por uma tarde. Token de Página derivado de um token longo não expira
    // (expires_at = 0), que é exatamente o que queremos guardar.
    if (env.META_APP_ID && env.META_APP_SECRET) {
      try {
        const app = `${env.META_APP_ID}|${env.META_APP_SECRET}`;
        const dbg = await fetch(`${GRAPH}/debug_token?input_token=${encodeURIComponent(page_access_token)}&access_token=${encodeURIComponent(app)}`);
        const dj = await dbg.json().catch(() => null);
        const info = dj && dj.data;
        if (!info || info.is_valid !== true) {
          return json({ error: "a Meta recusou este token (inválido ou de outro app). Gere de novo em Ferramentas → Graph API Explorer com o app Guileo selecionado.",
                        detalhe: s((dj && dj.error && dj.error.message) || (info && info.error && info.error.message) || "", 200) }, 400);
        }
        const exp = Number(info.expires_at || 0);           // 0 = não expira, que é o alvo
        if (exp > 0) {
          const horas = Math.round((exp * 1000 - Date.now()) / 3600000);
          return json({
            error: `este token EXPIRA em ~${horas}h — se eu guardar, a página fica muda amanhã e ninguém percebe.`,
            como_resolver: "No Graph API Explorer, troque por um token LONGO antes de colar: pegue o User Token, troque por long-lived, e só então leia me/accounts — o token de Página que vem daí não expira.",
            expira_em_horas: horas,
          }, 400);
        }
      } catch { /* a Meta fora do ar não pode impedir uma conexão legítima — segue e guarda */ }
    }

    const tokens = { page_id, ig_id, page_access_token, business_name: business };
    const r = await rpc("meta_creds_store", { p_secret: ING, p_email: email, p_tokens: tokens });
    if (!r.ok) return json({ error: "falha ao guardar (aplique db/meta_integration.sql?)" }, 500);
    const okStored = await r.json().catch(() => null);
    if (okStored !== true) return json({ error: "meta_creds_store recusou" }, 500);
    // AUTO-SUBSCRIBE: liga a entrega de DMs pro webhook agora (o passo que faltava). Best-effort.
    const sub = page_id ? await subscribePage(page_id, page_access_token) : { subscribed: false, reason: "sem page_id" };
    return json({ ok: true, connected: true, page_id, ig_id, business, subscribed: sub.subscribed, subscribe_note: sub.reason || null, note: `Página ${page_id || ig_id} ligada a ${email}${sub.subscribed ? " e inscrita no webhook ✓ — a Gui já recebe e responde." : " — token guardado, mas a inscrição no webhook falhou: " + (sub.reason || "?") + " (verifique no painel Meta)."}` });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
