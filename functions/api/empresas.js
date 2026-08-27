// Cloudflare Pages Function — POST /api/empresas
// O QUE FALTA LIGAR EM CADA UMA DAS NOSSAS EMPRESAS.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE EXISTE (2026-08-25): o Luis tem quatro negócios (Guileo, guileo.ad, MedMundo, Chigo) e
// cada um tem cérebro, voz, Instagram/Messenger e WhatsApp. Isso é uma matriz, e matriz na cabeça
// vira "achei que já tinha ligado". Nesta mesma noite três coisas estavam paradas há semanas sem
// ninguém saber: o Instagram nunca roteou (ig_id nunca preenchido), o token de uma Página estava
// morto com o painel dizendo "conectado", e o cadastro de cliente novo estava quebrado inteiro.
//
// ── AS DUAS LEIS QUE ESTE ARQUIVO OBEDECE ────────────────────────────────────────────────────
// 1. **Pergunta ao PROVEDOR, não ao nosso banco.** "Tem token guardado" não é "o canal funciona".
//    A Meta é quem diz se o token vive; a ElevenLabs é quem diz se o agente existe.
// 2. **TRÊS estados, nunca dois.** 🟢 provado · 🔴 provado que NÃO · ⚪ não consegui checar — e o
//    cinza jamais é pintado de verde. Um "não sei" pintado de ok é como 19 dias de WhatsApp
//    respondendo para o vazio passam despercebidos.
import { json, sameOrigin } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";

const GRAPH = "https://graph.facebook.com/v21.0";
const s = (v, n) => (v == null ? "" : String(v)).trim().slice(0, n);

// As empresas DO LUIS. Lista explícita de propósito: varrer a tabela de tenants traria conta de
// teste, de simulação e de eval, e um placar que conta o que não é cliente mente sobre o negócio
// (foi o defeito de `metrica_honesta`). Empresa nova entra aqui, numa linha.
const NOSSAS = [
  { email: "smart@guileoai.com", nome: "Guileo.AI", instagram: "@guileoai" },
  // ⚠️ VERTENTE SEPARADA POR NECESSIDADE TÉCNICA, não por serem empresas diferentes. As duas
  // vendem a mesma companhia (Guileo.AI entra pelo atendimento, guileo.ad pelos anúncios). Mas
  // `client_integrations` é único por (cliente, provedor): um tenant guarda UMA página da Meta.
  // Com as duas no mesmo e-mail, a segunda conexão SOBRESCREVE o token e o page_id da primeira e
  // um dos Instagram fica mudo sem aviso. Tenant próprio é o que permite Instagram próprio.
  { email: "guileoai@gmail.com", nome: "guileo.ad", instagram: "@guileo.ad" },
  { email: "dr@medmundobr.com", nome: "MedMundo", instagram: "@medmundo.br" },
  { email: "visa@chigotravels.com", nome: "CHIGO Turismo", instagram: "@chigotravels" },
];

async function cerebro(env, email) {
  // AGENTE: resolvido no servidor pelo e-mail, e conferido NA ELEVENLABS (existir no nosso banco
  // não é existir lá — já achamos id apontando para agente apagado nesta casa).
  const a = await svcJson(env, "client_agent_resolve", { p_secret: env.INGEST_SECRET || "", p_email: email }).catch(() => null);
  const agentId = (a && a.agent_id) ? String(a.agent_id) : "";
  if (!agentId) return { estado: false, motivo: "sem agente vinculado" };
  if (!env.ELEVENLABS_API_KEY) return { estado: null, motivo: "sem ELEVENLABS_API_KEY — não dá para conferir" };
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agentId)}`, { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
    if (!r.ok) return { estado: false, motivo: `a ElevenLabs não acha o agente (HTTP ${r.status})`, agente: agentId };
    const d = await r.json().catch(() => null);
    const p = d?.conversation_config?.agent?.prompt || {};
    const kb = Array.isArray(p.knowledge_base) ? p.knowledge_base.length : 0;
    const tools = (Array.isArray(p.tool_ids) ? p.tool_ids.length : 0) || (Array.isArray(p.tools) ? p.tools.length : 0);
    return {
      estado: (p.prompt || "").length > 0,
      motivo: `${d?.name || "sem nome"} · ${(p.prompt || "").length} chars · ${kb} doc(s) no KB · ${tools} ferramenta(s)`,
      agente: agentId, kb, ferramentas: tools,
    };
  } catch (e) { return { estado: null, motivo: `não consegui falar com a ElevenLabs: ${(e && e.message) || "?"}`, agente: agentId }; }
}

async function meta(env, email) {
  const t = await svcJson(env, "meta_creds_get", { p_secret: env.INGEST_SECRET || "", p_email: email }).catch(() => null);
  const tok = (t && typeof t === "object") ? t : {};
  if (!tok.page_id && !tok.ig_id) return { estado: false, motivo: "nunca conectado", instagram_mapeado: false };
  if (!tok.has_token) return { estado: false, motivo: "página mapeada mas sem token", instagram_mapeado: !!tok.ig_id };
  try {
    const tr = await svcJson(env, "meta_token_for_email", { p_secret: env.INGEST_SECRET || "", p_email: email }).catch(() => null);
    const tkn = (typeof tr === "string") ? tr : "";
    if (!tkn) return { estado: false, motivo: "o token não está mais guardado", instagram_mapeado: !!tok.ig_id };
    // ⚠️ PERGUNTAR PELA PÁGINA EXIGE ESCOPO QUE O TOKEN DE PÁGINA NÃO TEM. Ler
    // `/{page_id}?fields=name` devolvia `(#100) Object does not exist, cannot be loaded due to
    // missing permission` para tokens perfeitamente vivos — e o painel pintava 🔴 em conexão boa.
    // Um vermelho falso é tão ruim quanto um verde falso: os dois mandam consertar a coisa errada.
    // O token de Página É a Página, então `/me` é a pergunta certa e funciona com escopo mínimo.
    // ⚠️ MEDIR A COISA CERTA. Duas tentativas erradas antes desta:
    //   `/{page_id}?fields=name` e `/me?fields=name` → ambas devolviam `(#100) ... requires the
    //   'pages_read_engagement' permission`. O token estava VIVO; ele só não podia ler o NOME da
    //   Página — um campo decorativo. O painel pintava 🔴 em conexão boa, e vermelho falso manda
    //   consertar o que não está quebrado.
    // `/me/subscribed_apps` usa `pages_manage_metadata` (que temos) e responde as DUAS coisas que
    // importam de uma vez: o token vive? e a Página está inscrita no NOSSO webhook — que é o que
    // decide se a DM chega.
    const g = await fetch(`${GRAPH}/me/subscribed_apps?access_token=${encodeURIComponent(tkn)}`);
    const gj = await g.json().catch(() => null);
    if (!g.ok || !gj || gj.error) return { estado: false, motivo: s((gj && gj.error && gj.error.message) || `a Meta recusou (HTTP ${g.status})`, 200), instagram_mapeado: !!tok.ig_id };
    const apps = Array.isArray(gj.data) ? gj.data : [];
    const inscrito = apps.length > 0;
    if (!inscrito) return { estado: false, motivo: "token vivo, mas a Página NÃO está inscrita no webhook — a DM não chega", instagram_mapeado: !!tok.ig_id, token_vivo: true };
    // ⚠️ PÁGINA VIVA NÃO É INSTAGRAM LIGADO. São dois estados, e confundi-los foi o que deixou a DM
    // do Instagram sumindo em silêncio: sem `ig_id` no mapa, o `recipient.id` de uma DM não casa
    // com nada. Por isso o Instagram aparece como linha PRÓPRIA no placar.
    return { estado: true, motivo: `token vivo e inscrita no webhook (${apps.map((a) => a.name || a.id).join(", ")})`, instagram_mapeado: !!tok.ig_id, token_vivo: true };
  } catch (e) { return { estado: null, motivo: `não consegui falar com a Meta: ${(e && e.message) || "?"}`, instagram_mapeado: !!tok.ig_id }; }
}

async function whats(env, email) {
  const t = await svcJson(env, "whatsapp_cloud_creds_lookup", { p_secret: env.INGEST_SECRET || "", p_email: email }).catch(() => null);
  if (!t || typeof t !== "object" || (!t.phone_number_id && !t.access_token)) return { estado: false, motivo: "nunca conectado" };
  const tkn = s(t.access_token, 400), pn = s(t.phone_number_id, 60);
  if (!tkn || !pn) return { estado: false, motivo: "credencial incompleta" };
  try {
    const g = await fetch(`${GRAPH}/${encodeURIComponent(pn)}?fields=display_phone_number,verified_name&access_token=${encodeURIComponent(tkn)}`);
    const gj = await g.json().catch(() => null);
    if (!g.ok || !gj || gj.error) return { estado: false, motivo: s((gj && gj.error && gj.error.message) || `a Meta recusou (HTTP ${g.status})`, 200) };
    return { estado: true, motivo: `${gj.display_phone_number || pn}${gj.verified_name ? ` · ${gj.verified_name}` : ""}` };
  } catch (e) { return { estado: null, motivo: `não consegui checar: ${(e && e.message) || "?"}` }; }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    const b = await request.json().catch(() => ({}));
    const a = await svcJson(env, "_admin_ok", { p_token: s(b.token, 200) }).catch(() => null);
    if (!(a === true || a?.ok === true)) return json({ error: "unauthorized" }, 401);

    const alvo = (b.email || "").toString().trim().toLowerCase();
    const lista = alvo ? NOSSAS.filter((x) => x.email === alvo) : NOSSAS;

    const empresas = [];
    for (const e of lista) {
      const [c, m, w] = await Promise.all([cerebro(env, e.email), meta(env, e.email), whats(env, e.email)]);
      const falta = [];
      if (c.estado !== true) falta.push("cérebro");
      if (m.estado !== true) falta.push("Messenger/Página");
      if (!m.instagram_mapeado) falta.push("Instagram (ig_id)");
      if (w.estado !== true) falta.push("WhatsApp");
      empresas.push({
        empresa: e.nome, email: e.email, instagram: e.instagram,
        cerebro: c, meta: m, whatsapp: w,
        // A frase que o Luis lê primeiro. Sem ela o placar é uma tabela; com ela é uma lista de ações.
        falta: falta.length ? falta : null,
        pronta: falta.length === 0,
      });
    }
    // ── OS DESENCONTROS: canal ligado ao DONO ERRADO ─────────────────────────────────────────
    // Um canal pode estar perfeitamente vivo e ainda assim entregar a mensagem no tenant errado —
    // e aí o cliente é atendido pelo cérebro de outro negócio. Aconteceu duas vezes nesta casa:
    //   · o WhatsApp rotulado "Med Mundo" estava sob um e-mail pessoal cujo agente é um
    //     "Restaurante Teste" — a pergunta do dono virou resposta genérica;
    //   · o mapa da Meta apontava uma Página para um tenant que não tinha token nenhum.
    // Nenhum dos dois aparece num placar que só pergunta "está conectado?", porque os dois ESTÃO.
    // Por isso a varredura é separada: ela procura canal cujo dono NÃO é uma das nossas empresas.
    const avisos = [];
    try {
      const nossos = new Set(NOSSAS.map((x) => x.email));
      const linhas = await svcJson(env, "canais_por_dono", { p_secret: env.INGEST_SECRET || "" }).catch(() => null);
      if (Array.isArray(linhas)) {
        for (const l of linhas) {
          const dono = s(l.client_email, 160).toLowerCase();
          if (!dono || nossos.has(dono)) continue;
          avisos.push({
            canal: s(l.provider, 40), dono, rotulo: s(l.rotulo, 120),
            problema: `este canal está ligado a "${dono}", que não é uma das nossas empresas — quem escrever ali é atendido pelo cérebro desse tenant`,
          });
        }
      }
    } catch { /* aviso é bônus: nunca derruba o placar */ }

    return json({ ok: true, empresas, avisos, lidas_em: new Date().toISOString() });
  } catch (e) {
    return json({ error: String(e).slice(0, 200) }, 500);
  }
}
