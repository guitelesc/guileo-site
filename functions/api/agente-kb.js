// Cloudflare Pages Function — POST /api/agente-kb
// O CATÁLOGO DO NEGÓCIO VIRA CONHECIMENTO DO AGENTE, SOZINHO.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Mecanismo em `lib/agentKB.js` (lá está o porquê de ser KB e não prompt, e a paranoia do PATCH).
// Aqui mora a COMPOSIÇÃO: quais camadas cada agente herda e o texto de cada uma.
//
//   guileo     → o nosso Gui: a companhia inteira, montada de `productFacts` (que por sua vez lê
//                `GUILEO_PLANS`). Zero cópia à mão — preço tem uma fonte e várias bocas.
//   vertical   → "Gui Spa", "Gui Plumber": o playbook do RAMO (db/playbooks/*.md), enviado no corpo
//                da requisição. Não fica embutido no bundle de propósito: são ~20 mil caracteres
//                cada, sobem UMA vez e passam a viver na ElevenLabs, herdados por todo cliente do
//                ramo. Guardar 250 KB de manual no Worker para escrever uma vez seria carregar o
//                arquivo inteiro para sempre por causa de um envio.
//   cliente    → serviços/preços (`biz_lookup`) + o FAQ que o dono escreveu (`client_kb`).
//
// ⚠️ `simular: true` monta e DEVOLVE o texto sem tocar em agente nenhum. Existe porque este é o
// molde dos 13 verticais: o primeiro tem que sair perfeito, e revisar depois de escrever no cérebro
// de um agente que atende cliente pagante é revisar tarde.
import { json, sameOrigin } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { kbSincronizar, acharDoc } from "../lib/agentKB.js";
import { factsBlock } from "../lib/productFacts.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const dinheiro = (c) => `$${(Number(c || 0) / 100).toFixed(2).replace(/\.00$/, "")}`;

// ── CAMADA CLIENTE ──────────────────────────────────────────────────────────────────────────────
// Escrito para ser LIDO POR UM MODELO durante uma ligação: título por seção, uma linha por item,
// nada de prosa. E o preço zero aparece como "sob consulta" em vez de "$0" — um agente que anuncia
// "$0" para um serviço que o dono não precificou dá o serviço de graça no telefone.
async function camadaCliente(env, email) {
  const [menu, faq] = await Promise.all([
    svcJson(env, "biz_lookup", { p_secret: env.SCHED_SECRET || "", p_email: email }).catch(() => null),
    svcJson(env, "kb_for_agent", { p_secret: env.INGEST_SECRET || "", p_email: email }).catch(() => null),
  ]);
  const servicos = Array.isArray(menu?.services) ? menu.services : [];
  const locais = Array.isArray(menu?.locations) ? menu.locations : [];

  const linhas = [];
  if (servicos.length) {
    linhas.push("## SERVICES AND PRICES (the only prices you may quote)");
    for (const s of servicos) {
      if (s?.active === false) continue;
      const preco = Number(s?.price_cents || 0) > 0 ? dinheiro(s.price_cents) : "price on request — ask the customer to hold while you check";
      const dur = s?.duration_min ? ` · ${s.duration_min} min` : "";
      linhas.push(`- ${s?.name || "(unnamed)"} — ${preco}${dur}`);
    }
    linhas.push("", "If a customer asks for something NOT on this list, say you'll confirm with the team. Never invent a price.");
  }
  if (locais.length) {
    linhas.push("", "## LOCATIONS");
    for (const L of locais) linhas.push(`- ${L?.name || "Main"}${L?.address ? ` — ${L.address}` : ""}${L?.phone ? ` · ${L.phone}` : ""}`);
  }
  const fq = (typeof faq === "string" ? faq : "").trim();
  if (fq) linhas.push("", "## THE OWNER'S OWN ANSWERS (use these words)", fq.slice(0, 12000));

  return linhas.join("\n").trim();
}

export async function onRequestPost({ request, env }) {
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    const b = await request.json().catch(() => ({}));
    // ⚠️ LÊ O CORPO da RPC, não o status: `_admin_ok` devolve `false` com HTTP 200.
    const a = await svcJson(env, "_admin_ok", { p_token: (b.token || "").toString().slice(0, 200) }).catch(() => null);
    if (!(a === true || a?.ok === true)) return json({ error: "unauthorized" }, 401);
    if (!env.ELEVENLABS_API_KEY) return json({ error: "sem ELEVENLABS_API_KEY" }, 503);

    const email = (b.email || "").toString().trim().toLowerCase();
    const simular = b.simular === true;

    // ── SUBIR UM PLAYBOOK DE VERTICAL (uma vez por ramo) ──────────────────────────────────────
    if (b.acao === "vertical") {
      const vert = (b.vertical || "").toString().trim().slice(0, 40);
      const texto = (b.texto || "").toString();
      if (!vert || !texto.trim()) return json({ error: "informe vertical e texto" }, 400);
      const nome = `playbook-${vert}`;
      if (simular) return json({ ok: true, simulado: true, nome, chars: texto.length, amostra: texto.slice(0, 600) });
      const r = await kbSincronizar(env, { agentId: (b.agente || "").toString(), camadas: [{ nome, texto }] });
      return json({ acao: "vertical", vertical: vert, ...r });
    }

    // ── SINCRONIZAR UM AGENTE (a operação normal) ─────────────────────────────────────────────
    if (!email.includes("@")) return json({ error: "informe o email do tenant" }, 400);

    const perfil = await svcJson(env, "get_client_profile", { p_secret: env.INGEST_SECRET || "", p_email: email }).catch(() => null);
    const negocio = (perfil?.business_name || "").toString();
    const camadas = [];

    // A Guileo é o único tenant que herda o catálogo da própria companhia — para todo o resto,
    // falar de planos da Guileo seria vazamento de identidade (a constituição barra, e com razão).
    if (/guileo/i.test(negocio) || /@guileoai\.com$/i.test(email)) {
      camadas.push({ nome: "guileo-catalogo", texto: `# GUILEO — OFFICIAL CATALOG (single source: guileoPlans.js)\n\n${factsBlock({ audience: "client" })}` });
    }

    const cli = await camadaCliente(env, email);
    if (cli) camadas.push({ nome: `catalogo-${email}`, texto: `# ${negocio || email} — CATALOG\n\n${cli}` });

    // Vertical: o documento já vive na ElevenLabs; aqui só re-anexamos pelo nome.
    const vert = (b.vertical || "").toString().trim().slice(0, 40);
    let verticalDoc = null;
    if (vert) {
      const f = await acharDoc(env, `playbook-${vert}`);
      if (f.doc) verticalDoc = { id: f.doc.id, nome: f.doc.name };
    }

    if (!camadas.length && !verticalDoc) return json({ ok: false, motivo: "este tenant não tem catálogo nem FAQ para sincronizar — sem isso eu não escrevo nada" });

    if (simular) {
      return json({ ok: true, simulado: true, negocio,
        camadas: camadas.map((c) => ({ nome: c.nome, chars: c.texto.length, texto: c.texto })),
        vertical: verticalDoc });
    }

    let agentId = (b.agente || "").toString();
    if (!agentId) {
      const ag = await svcJson(env, "client_agent_resolve", { p_secret: env.INGEST_SECRET || "", p_email: email }).catch(() => null);
      agentId = (ag && ag.agent_id) ? String(ag.agent_id) : "";
    }
    if (!agentId) return json({ ok: false, motivo: "não achei o agente deste tenant" }, 404);

    const r = await kbSincronizar(env, { agentId, camadas });
    // O playbook do ramo é anexado junto, sem ser recriado.
    if (verticalDoc && r.ok) {
      const { kbAnexar } = await import("../lib/agentKB.js");
      const v = await kbAnexar(env, { agentId, docs: [verticalDoc] });
      r.vertical = v;
    }
    return json({ acao: "sincronizar", email, negocio, agente: agentId, ...r });
  } catch (e) {
    return json({ error: String(e).slice(0, 200) }, 500);
  }
}
