// Cloudflare Pages Function — POST /api/voice-web
//
// A GUI ATENDENDO POR VOZ NO NAVEGADOR — sem telefone, sem operadora, sem A2P.
// ─────────────────────────────────────────────────────────────────────────────────────────────
// O destrave: uma ligação telefônica passa por Twilio + operadora (caller-ID não registrado,
// campanha A2P reprovada, saldo, minuto caro). Uma conversa por voz no navegador passa por
// EXATAMENTE dois lugares: este servidor e o navegador do visitante. Nada externo trava.
//
// O QUE ESTA ROTA FAZ (e o que ela deliberadamente NÃO faz):
//   action=start → resolve slug → tenant → agente DELE (servidor), reserva a cota de minutos,
//                  e devolve uma URL ASSINADA de sessão (15 min de validade, um agente só).
//   action=end   → fecha a sessão, devolve os segundos não usados pra cota e carimba o
//                  conversation_id, que é como o webhook pós-chamada sabe de quem é a conversa.
//
// O SEGREDO NUNCA VAI AO NAVEGADOR. `ELEVENLABS_API_KEY` fica no Cloudflare; o navegador só
// recebe a URL assinada — curta, escopada a UM agente, e que a ElevenLabs emite justamente
// pra este caso. Se a chave não existir, a rota responde `no_key` e a página mostra o caminho
// de texto/telefone: nunca um botão que não faz nada.
//
// O TENANT NUNCA VEM DO CORPO. O corpo manda `slug` (a identidade PÚBLICA do site do cliente,
// já visível na URL); quem traduz slug → e-mail → agent_id é o servidor, pelas mesmas RPCs
// service-role que o formulário público do site já usa. Um navegador não consegue pedir a voz
// de outra empresa, porque nunca é ele quem diz de quem é a voz.
//
// TRAVA DE CUSTO EM QUATRO CAMADAS (voz custa por minuto — um botão público sem trava é uma
// torneira aberta): 1) limite por IP nesta rota, FECHANDO em caso de falha; 2) teto por sessão;
// 3) teto diário por cliente; 4) teto diário da plataforma inteira. As três últimas moram no
// banco (db/voice_web.sql) em modelo de RESERVA: abrir já debita o teto, fechar devolve a sobra
// — assim uma aba abandonada custa o teto, não zero.
import { json, rateLimited } from "../lib/guard.js";
import { svcJson, svcRpc } from "../lib/sb.js";
import { emitFailure } from "../lib/failure.js";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
const AGENT_RE = /^agent_[a-zA-Z0-9]+$/;

// ── A GUILEO COMO INQUILINA DE SI MESMA (2026-08-18) ────────────────────────────────────────
// A landing vendia agente de voz e não tinha um. Este slug RESERVADO é como o guileoai.com fala
// pela mesma porta que o site do cliente já usa — sem um segundo endpoint, sem um segundo
// medidor, sem um segundo caminho de erro pra manter em dia.
//
// Por que um slug reservado e não um site de cliente com slug "guileo": a Guileo não tem linha
// em `client_sites` nem em `client_agents`, então `client_site_owner` devolveria vazio e a
// pessoa veria "voz não ativada para este negócio". O atalho acontece ANTES do lookup, o que
// também impede que um cliente publique um site com slug "guileo" e herde o agente de demo.
//
// O agente é o de DEMO da plataforma (mesma constante de call.js/twilio-voice.js — a linha
// +19864443334 aponta pra ele). O tenant do medidor é interno: a cota da Guileo é da Guileo,
// nunca sai do teto de um cliente pagante.
const PLATFORM_SLUG = "guileo";
const PLATFORM_AGENT = "agent_5901ktdkev68f5kb161fmeax1rdm";
const platformEmail = (env) => (env.VOICE_WEB_PLATFORM_EMAIL || "demo@guileoai.com").toString().trim().toLowerCase();
const platformAgent = (env) => {
  const id = (env.ELEVENLABS_AGENT_ID || PLATFORM_AGENT).toString().trim();
  return AGENT_RE.test(id) ? id : "";
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

// Preflight — a rota atende também o site do cliente no domínio DELE (widget), então o
// navegador manda OPTIONS antes do POST com Content-Type: application/json.
export function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

const out = (obj, status = 200) => {
  const r = json(obj, status);
  for (const [k, v] of Object.entries(CORS)) r.headers.set(k, v);
  return r;
};

// IP → hash estável (nunca guardamos o IP cru; o hash só serve pra contar sessões por visitante).
async function ipHash(request, env) {
  try {
    const ip = request.headers.get("CF-Connecting-IP") || "";
    if (!ip) return "";
    const data = new TextEncoder().encode(`${ip}|${env.INGEST_SECRET || "guileo"}`);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch { return ""; }
}

// slug → e-mail do dono. Mesma RPC que o formulário público do site do cliente usa
// (functions/api/marketplace-leads.js): service-role, e só responde site PUBLICADO.
async function donoDoSlug(env, slug) {
  try {
    const r = await svcRpc(env, "client_site_owner", { p_secret: env.INGEST_SECRET || "", p_slug: slug });
    if (!r.ok) return "";
    const owner = ((await r.json().catch(() => "")) || "").toString().trim().toLowerCase();
    return owner.includes("@") ? owner : "";
  } catch { return ""; }
}

// tenant → o agente DELE (nome, voz, idioma, KB, preços já vivem lá dentro).
// Sem agente registrado NÃO caímos no agente genérico: seria a voz da Guileo atendendo como se
// fosse o negócio do cliente. Devolve "" e a página mostra o caminho de texto/telefone.
async function agenteDoTenant(env, email) {
  try {
    const r = await svcRpc(env, "client_agent_resolve", { p_secret: env.INGEST_SECRET || "", p_email: email });
    if (!r.ok) return "";
    const d = await r.json().catch(() => null);
    const id = (d && d.agent_id ? d.agent_id : "").toString().trim();
    return AGENT_RE.test(id) ? id : "";
  } catch { return ""; }
}

// Marca do cliente pra página de voz (nome, cor, logo, idioma) — best-effort: se falhar, a
// página usa o padrão e a conversa acontece do mesmo jeito.
async function marcaDoSlug(env, slug) {
  try {
    const r = await svcRpc(env, "client_site_public", { p_slug: slug });
    if (!r.ok) return {};
    const d = await r.json().catch(() => null);
    if (!d || d.found !== true) return {};
    return {
      business: (d.business_name || "").toString().slice(0, 80),
      lang: (d.lang || "pt").toString().slice(0, 5),
      color: (d.config && d.config.color ? d.config.color : "").toString().slice(0, 24),
      logo: (d.config && d.config.logo_url ? d.config.logo_url : "").toString().slice(0, 300),
      phone: ((d.locations || []).map((l) => l && l.phone).find(Boolean) || "").toString().slice(0, 32),
    };
  } catch { return {}; }
}

// A CREDENCIAL DE SESSÃO. O servidor troca a chave da conta por uma URL assinada de 15 minutos,
// válida pra UM agente. É esse (e só esse) papel que vai ao navegador.
async function urlAssinada(env, agentId) {
  const r = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
    { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } },
  );
  if (!r.ok) return { ok: false, status: r.status, detalhe: (await r.text().catch(() => "")).slice(0, 200) };
  const j = await r.json().catch(() => null);
  const url = (j && j.signed_url ? j.signed_url : "").toString();
  if (!/^wss:\/\//i.test(url)) return { ok: false, status: 200, detalhe: "resposta sem signed_url" };
  return { ok: true, url };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => null);
    if (!b) return out({ ok: false, reason: "bad_request" }, 400);
    const action = (b.action || "start").toString();

    // ── FECHAR ────────────────────────────────────────────────────────────────────────────
    // Chega por fetch keepalive OU sendBeacon quando a aba morre. Nunca 401 por falta de
    // sessão: uma sessão desconhecida simplesmente não devolve minuto nenhum.
    if (action === "end") {
      const sid = (b.session_id || "").toString();
      if (!UUID_RE.test(sid)) return out({ ok: false, reason: "no_session" });
      const seg = Math.max(0, Math.min(parseInt(b.seconds, 10) || 0, 24 * 3600));
      const conv = (b.conversation_id || "").toString().trim().slice(0, 80);
      const r = await svcJson(env, "voice_web_end", {
        p_secret: env.INGEST_SECRET || "", p_session: sid, p_seconds: seg, p_conv: conv || null,
      });
      return out({ ok: r && r.ok === true, reason: (r && r.reason) || null });
    }

    if (action !== "start") return out({ ok: false, reason: "bad_action" }, 400);

    // ── ABRIR ─────────────────────────────────────────────────────────────────────────────
    // Limite por IP FECHANDO: sem KV (ou com KV quebrada) esta rota NEGA. É a única rota do
    // produto que gasta dinheiro de voz sem nenhum humano no meio — aqui "falhar aberto"
    // significa deixar a torneira aberta.
    if (await rateLimited(request, env, "voice-web", 5, 900, true)) {
      return out({ ok: false, reason: "rate_limited" }, 429);
    }

    const slug = (b.slug || "").toString().trim().toLowerCase();
    if (!SLUG_RE.test(slug)) return out({ ok: false, reason: "bad_slug" }, 400);

    // Sem a chave do provedor a voz simplesmente não existe — e a página diz isso, em vez de
    // oferecer um botão que gira pra sempre.
    if (!env.ELEVENLABS_API_KEY) return out({ ok: false, reason: "no_key" });
    if (!env.INGEST_SECRET) return out({ ok: false, reason: "no_key" });

    // O atalho da PRÓPRIA Guileo vem antes do lookup de cliente (ver PLATFORM_SLUG acima).
    const plataforma = slug === PLATFORM_SLUG;
    const email = plataforma ? platformEmail(env) : await donoDoSlug(env, slug);
    if (!email) return out({ ok: false, reason: "no_site" }, 404);

    const agentId = plataforma ? platformAgent(env) : await agenteDoTenant(env, email);
    if (!agentId) return out({ ok: false, reason: "no_agent" });

    // COTA — no banco, atômica, e FECHADA por padrão: se o livro-caixa não responder
    // (db/voice_web.sql não aplicado, banco fora), NÃO abrimos a sessão. Voz sem medidor é
    // exatamente o erro que este arquivo existe pra impedir.
    const res = await svcJson(env, "voice_web_reserve", {
      p_secret: env.INGEST_SECRET, p_email: email, p_slug: slug,
      p_agent_id: agentId, p_ip_hash: await ipHash(request, env),
    });
    if (!res || res.ok !== true) {
      const motivo = (res && res.reason) || "quota_unavailable";
      // Cota estourada é operação normal (o teto funcionando). Livro-caixa AUSENTE é defeito
      // nosso e precisa gritar, senão a voz fica "misteriosamente" desligada pro cliente.
      if (motivo === "quota_unavailable") {
        try { await emitFailure(env, "voice_web_sem_livro", email, "voz no navegador bloqueada: voice_web_reserve não respondeu (aplicar db/voice_web.sql)", { slug }); } catch { /* nunca bloqueia a resposta */ }
      }
      return out({ ok: false, reason: motivo, restante_hoje: (res && res.restante_hoje) ?? null });
    }

    const assinada = await urlAssinada(env, agentId);
    if (!assinada.ok) {
      // Devolve o minuto reservado na hora — um erro do provedor não pode consumir a cota do
      // cliente (era assim que um teto diário sumia sem ninguém ter falado com ninguém).
      await svcJson(env, "voice_web_end", { p_secret: env.INGEST_SECRET, p_session: res.session_id, p_seconds: 0, p_conv: null });
      try { await emitFailure(env, "voice_web_signed_url", email, `ElevenLabs recusou a URL assinada (${assinada.status}): ${assinada.detalhe}`, { agent_id: agentId, slug }); } catch { /* */ }
      return out({ ok: false, reason: "provider" });
    }

    // A marca sai de `client_sites`; a Guileo não tem linha lá, então a landing manda a dela.
    // Inventar um nome de negócio aqui seria escrever "Guileo" num campo que existe pra dizer
    // o nome do CLIENTE — melhor devolver vazio e deixar a página decidir.
    const marca = plataforma ? {} : await marcaDoSlug(env, slug);
    return out({
      ok: true,
      session_id: res.session_id,
      signed_url: assinada.url,
      max_seconds: res.max_seconds || 240,
      restante_hoje: res.restante_hoje ?? null,
      ...marca,
    });
  } catch (e) {
    return out({ ok: false, reason: "erro", detalhe: String(e).slice(0, 120) }, 500);
  }
}
