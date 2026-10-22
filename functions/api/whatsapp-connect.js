// Cloudflare Pages Function — POST /api/whatsapp-connect
// ADMIN-ONLY. O dono COLA o token do WhatsApp Cloud (Usuário do Sistema, permanente) e ele vai
// direto pro banco — nunca passa pelo chat, nunca aparece na tela depois de salvo.
//   { action:"connect", token, email, access_token, phone_number_id?, waba_id?, label? } -> { ok, numero, verificado }
//   { action:"testar",  token, email }  -> { ok, vivo, numero, motivo }   (não grava nada)
//   { action:"status",  token, email }  -> { ok, conectado, phone_number_id, token_kind, ... }
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// A REGRA QUE ESTA ROTA EXISTE PRA IMPOR: token não-provado NÃO É GRAVADO.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// Em 2026-08-17 o Luis mandou "oi" no WhatsApp e o banco registrou, em 270ms: entrada ✓, cérebro
// ✓, e "⚠️ Resposta da Gui NÃO foi entregue: Authentication Error". O token de 03/08 tinha
// vencido e ninguém sabia — porque guardar um token nunca foi a mesma coisa que ele funcionar.
// Aqui a ordem é invertida de propósito: PRIMEIRO perguntamos ao Graph quem é esse número com
// esse token; só se ele responder 200 é que gravamos. Guardar antes de provar é como responder
// "ok" sem o id do que foi criado — promessa sem lastro.
//
// ⚠️ store_integration SUBSTITUI o jsonb inteiro (li a definição: `set tokens = excluded.tokens`).
// É o oposto do PATCH da ElevenLabs, que faz merge. Então gravar só o access_token APAGARIA
// phone_number_id e waba_id, e o webhook perderia a rota do tenant. Por isso lemos, mesclamos em
// memória e gravamos o objeto COMPLETO.
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const GRAPH = "https://graph.facebook.com/v21.0";

const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const s = (v, n = 400) => (v == null ? "" : v.toString().trim().slice(0, n));

// Pergunta ao Graph "quem é este número?" usando o token. É de LEITURA — não manda mensagem
// pra ninguém, então pode rodar quantas vezes quiser sem incomodar cliente nenhum.
// O token vai no header, nunca na querystring: URL vaza em log de proxy e em histórico.
async function conferirToken(pnid, accessToken) {
  if (!pnid) return { vivo: false, motivo: "sem phone_number_id — não dá pra conferir o token" };
  if (!accessToken) return { vivo: false, motivo: "sem token" };
  try {
    const r = await fetch(`${GRAPH}/${encodeURIComponent(pnid)}?fields=display_phone_number,verified_name`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d && d.id) return { vivo: true, numero: d.display_phone_number || "", nome: d.verified_name || "" };
    // A mensagem da Meta vai INTEIRA pra tela: "Authentication Error" e "número não pertence a
    // este app" pedem ações completamente diferentes, e resumir as duas pra "falhou" apaga a
    // diferença exatamente pra quem precisa dela.
    return { vivo: false, motivo: s((d && d.error && d.error.message) || `HTTP ${r.status}`, 200) };
  } catch (e) { return { vivo: false, motivo: `rede: ${s(e, 120)}` }; }
}

// ── LER AS CREDENCIAIS ────────────────────────────────────────────────────────────────────────
// Vai pelo SERVICE_ROLE, não pela chave anon: `whatsapp_cloud_creds_lookup` devolve o access_token
// do cliente e por isso é (corretamente) FECHADA para anon. A 1ª versão desta rota chamava pela
// anon, tomava 401 do PostgREST e respondia "conectado: false" — dizendo que o cliente não tinha
// WhatsApp quando ele tinha. Erro de leitura virando "não existe" é o mesmo defeito que já deu 5
// diagnósticos falsos num dia só.
//
// Por isso o retorno é de TRÊS estados e não um objeto-ou-null: "ok" (tem), "vazio" (não tem) e
// "erro" (não consegui saber). Quem chama é obrigado a tratar o terceiro em vez de confundi-lo
// com o segundo.
async function lerCreds(env, ING, email) {
  const t = await svcJson(env, "whatsapp_cloud_creds_lookup", { p_secret: ING, p_email: email });
  if (t && typeof t === "object" && (t.erro_http || (t.ok === false && t.detalhe))) {
    return { estado: "erro", motivo: `não consegui ler o banco: ${t.erro_http || ""} ${t.detalhe || ""}`.trim() };
  }
  if (!t || typeof t !== "object") return { estado: "vazio" };
  return { estado: "ok", tokens: t };
}

// O que PODE sair pela resposta. O access_token nunca — nem mascarado com os últimos 4, que já
// bastam pra confirmar um token vazado por outro caminho.
const publico = (t) => ({
  phone_number_id: t.phone_number_id || "", waba_id: t.waba_id || "",
  display_number: t.display_number || "", label: t.label || "", env: t.env || "",
  token_kind: t.token_kind || "", token_len: (t.access_token || "").length,
  validado_em: t.validated_at || "",
});

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "whatsapp-connect", 20)) return json({ error: "too many requests" }, 429);

    const b = await request.json().catch(() => ({}));
    const ING = env.INGEST_SECRET || "";
    const gate = await rpc("blitz_stats", { p_token: s(b.token, 200), p_email: "" });
    if (!gate.ok) return json({ error: "unauthorized" }, 401);

    const email = s(b.email, 160).toLowerCase();
    const action = (b.action || "connect").toString();
    // `auditar` é da PLATAFORMA inteira, não de um cliente — exigir e-mail aqui obrigaria o painel
    // a inventar um, e e-mail inventado é a porta pra medir o tenant errado.
    if (action !== "auditar" && !email.includes("@")) return json({ error: "email inválido" }, 400);

    const lido = action === "auditar" ? { estado: "vazio" } : await lerCreds(env, ING, email);
    // "Não consegui ler" NUNCA vira "não tem". Falha de leitura sai como falha, com o motivo.
    if (lido.estado === "erro") return json({ ok: false, error: lido.motivo }, 503);
    const atual = lido.estado === "ok" ? lido.tokens : null;

    if (action === "status") {
      if (!atual) return json({ ok: true, conectado: false });
      return json({ ok: true, conectado: true, ...publico(atual) });
    }

    // ── TESTAR: só pergunta, não grava. É o botão que responde "ainda está funcionando?" ──────
    if (action === "testar") {
      if (!atual || !atual.access_token) return json({ ok: true, vivo: false, motivo: "nenhum token guardado para este cliente" });
      const v = await conferirToken(atual.phone_number_id, atual.access_token);
      return json({ ok: true, ...v, ...publico(atual) });
    }


    // ── AUDITAR: todos os tenants com WhatsApp, cada token conferido no Graph ────────────────
    // É o que o painel "Estado dos canais" passou a usar. Antes ele lia PRESENÇA de env var e
    // pintava 🟢 — e ficou verde por três semanas com a saída morta. Presença de chave não é
    // chave funcionando; a única resposta honesta vem de perguntar ao Graph, um token por vez.
    if (action === "auditar") {
      const lista = await svcJson(env, "whatsapp_cloud_list_tenants", { p_secret: ING });
      if (!Array.isArray(lista)) {
        return json({ ok: false, error: `não consegui listar: ${JSON.stringify(lista).slice(0, 160)}` }, 503);
      }
      const linhas = await Promise.all(lista.map(async (t) => {
        if (!t.tem_token) return { ...t, vivo: false, motivo: "nenhum token guardado" };
        const creds = await lerCreds(env, ING, t.client_email);
        if (creds.estado !== "ok") return { ...t, vivo: false, motivo: creds.motivo || "não consegui ler" };
        const v = await conferirToken(t.phone_number_id, creds.tokens.access_token);
        return { ...t, vivo: v.vivo, motivo: v.motivo || "", numero: v.numero || t.display_number || "" };
      }));
      const vivos = linhas.filter((l) => l.vivo).length;
      return json({
        ok: true, total: linhas.length, vivos, mortos: linhas.length - vivos,
        // `estado` é o que o card pinta. "sem_credencial" NÃO é verde nem vermelho: ninguém
        // conectou ainda, e chamar isso de falha assustaria por nada.
        estado: linhas.length === 0 ? "sem_credencial" : (vivos === linhas.length ? "ok" : "vencido"),
        tenants: linhas.map(({ ...l }) => l),
      });
    }

    // ── CONECTAR ─────────────────────────────────────────────────────────────────────────────
    const access_token = s(b.access_token, 1000);
    if (!access_token) return json({ error: "cole o token" }, 400);
    if (!access_token.startsWith("EAA")) return json({ error: "isso não parece um token da Meta (os dela começam com EAA)" }, 400);

    // Os ids herdam do que já está guardado quando não vierem no corpo — trocar SÓ o token é o
    // caso comum (o número não muda quando a credencial vence).
    const phone_number_id = s(b.phone_number_id, 40) || (atual && atual.phone_number_id) || "";
    const waba_id = s(b.waba_id, 40) || (atual && atual.waba_id) || "";
    if (!phone_number_id) return json({ error: "informe o phone_number_id (não há nenhum guardado para este cliente)" }, 400);

    // A PROVA ANTES DA GRAVAÇÃO.
    const v = await conferirToken(phone_number_id, access_token);
    if (!v.vivo) return json({ ok: false, error: `token recusado pela Meta — NADA foi gravado. Motivo: ${v.motivo}` }, 400);

    const tokens = {
      ...(atual || {}),
      access_token, phone_number_id, waba_id,
      token_kind: s(b.token_kind, 40) || "system_user",
      display_number: v.numero || (atual && atual.display_number) || "",
      label: s(b.label, 120) || (atual && atual.label) || v.nome || "",
      env: s(b.env, 20) || (atual && atual.env) || "",
      validated_at: new Date().toISOString(),
    };

    const w = await svcJson(env, "store_integration", { p_secret: ING, p_email: email, p_provider: "whatsapp_cloud", p_tokens: tokens });
    if (w !== true) return json({ error: `store_integration não confirmou: ${JSON.stringify(w).slice(0, 160)}` }, 500);

    // RELEITURA: o `true` acima é o que a função DISSE. Isto é o que o banco TEM — e é com o que
    // o webhook vai responder o próximo cliente. Já perdi um dia acreditando no primeiro.
    const rel = await lerCreds(env, ING, email);
    const depois = rel.estado === "ok" ? rel.tokens : null;
    const persistiu = !!(depois && depois.access_token === access_token);
    const reconfere = persistiu
      ? await conferirToken(depois.phone_number_id, depois.access_token)
      : { vivo: false, motivo: rel.motivo || "não persistiu" };

    return json({
      ok: persistiu && reconfere.vivo,
      numero: reconfere.numero || v.numero || "",
      nome: reconfere.nome || v.nome || "",
      ...publico(depois || tokens),
      note: persistiu && reconfere.vivo
        ? `Token guardado e PROVADO no número ${reconfere.numero || phone_number_id}. A Gui já pode responder por este WhatsApp.`
        : `Gravou, mas a releitura não confirmou (${reconfere.motivo || "?"}) — não considere ligado.`,
    });
  } catch (e) {
    return json({ error: s(e, 200) }, 500);
  }
}
