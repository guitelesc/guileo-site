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
import { buildConversationConfig } from "../lib/provision.js";
import { verificarSeguroParaCliente } from "../lib/kbCliente.js";

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
      // ⚠️ ZERO É AMBÍGUO e o ensaio a seco pegou isso: no catálogo da Guileo, "Demo $0" e
      // "X-Ray $0" são de GRAÇA de propósito; no catálogo de um spa, um serviço a zero quase sempre
      // é serviço que o dono ainda não precificou. A coluna não distingue os dois casos, e chutar
      // erra caro nas duas direções — anunciar "$0" dá o serviço de graça no telefone, e dizer
      // "consulte" numa isca gratuita mata a isca. Então a linha declara o FATO (não há preço
      // definido) e a instrução de conduta vem UMA vez, embaixo, onde é instrução e não dado.
      // `config.gratis: true` é como o dono diz "este é de graça mesmo" quando quiser.
      const gratis = s?.config && typeof s.config === "object" && s.config.gratis === true;
      const preco = Number(s?.price_cents || 0) > 0 ? dinheiro(s.price_cents) : (gratis ? "free" : "no price set");
      const dur = s?.duration_min ? ` · ${s.duration_min} min` : "";
      linhas.push(`- ${s?.name || "(unnamed)"} — ${preco}${dur}`);
    }
    linhas.push("",
      "RULES: quote ONLY the prices above. An item marked \"free\" is genuinely free — say so.",
      "An item marked \"no price set\" has no confirmed price: never guess and never say \"zero\" or \"free\" —",
      "tell the customer you'll confirm it with the team. If they ask for something not on this list, same answer.");
  }
  if (locais.length) {
    linhas.push("", "## LOCATIONS");
    for (const L of locais) linhas.push(`- ${L?.name || "Main"}${L?.address ? ` — ${L.address}` : ""}${L?.phone ? ` · ${L.phone}` : ""}`);
  }
  const fq = (typeof faq === "string" ? faq : "").trim();
  if (fq) linhas.push("", "## THE OWNER'S OWN ANSWERS (use these words)", fq.slice(0, 12000));

  return linhas.join("\n").trim();
}


// ── O DETECTOR DE CÓPIA VELHA ───────────────────────────────────────────────────────────────────
// POR QUE (25/08, com número): o agente cotava Personalized $449 e Full Operation $999 — os preços
// de ANTES do reajuste — enquanto a fonte canônica dizia $897 e $1.997. Um cliente que fechasse
// pagaria METADE, e com razão: foi o que a agente disse. A causa não era o prompt nem o KB novo:
// era uma resposta escrita à MÃO no FAQ do dono, que o sync injeta como "responda exatamente com
// estas palavras" — a maior autoridade do prompt. O `productFacts.js` já tinha a lei escrita:
// «preço tem UMA fonte e várias bocas; a boca nunca guarda a própria cópia». O FAQ era uma boca
// guardando cópia, e a cópia envelheceu sozinha, sem nada acusar.
//
// Isto não APAGA a frase do dono — as palavras dele são dele, e num cliente de verdade um preço
// fora do catálogo pode ser combinado e legítimo. Ele só ACUSA, com o número na mão, para alguém
// decidir. Silêncio aqui é o que custou o vazamento.
// ⚠️ SEPARADOR DE MILHAR É AMBÍGUO ENTRE IDIOMAS e me mordeu no primeiro teste: "$1,997" (inglês)
// e "1.997 dólares" (português) são o MESMO valor, mas um parser ingênuo lê a vírgula como decimal
// e devolve 1.997 — quase dois mil vira quase dois. O detector então acusava divergência entre um
// número e ele mesmo. Regra: separador seguido de EXATAMENTE 3 dígitos é milhar (sai); separador
// com 1 ou 2 dígitos é decimal (vira ponto). A plataforma é trilíngue — assumir um formato só é
// assumir que o cliente escreve como eu.
function paraNumero(bruto) {
  let x = String(bruto || "").replace(/[^0-9.,]/g, "");
  x = x.replace(/[.,](?=\d{3}(?:\D|$))/g, "");   // milhar, nos dois formatos
  x = x.replace(",", ".");                        // o que sobrou com 1-2 casas é decimal
  const n = Number(x);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function precosDoTexto(t) {
  const achados = new Set();
  const add = (m) => { const n = paraNumero(m); if (n) achados.add(n); };
  for (const m of String(t || "").match(/\$\s?\d[\d.,]*/g) || []) add(m);
  // "449 dólares", "1.997 dollars" — o FAQ falado quase nunca usa cifrão.
  for (const m of String(t || "").match(/\b\d[\d.,]*\s*(?:d[óo]lares|dollars|reais)\b/gi) || []) add(m);
  return achados;
}

function divergencias(faq, autorizados) {
  if (!autorizados.size) return [];
  const fora = [...precosDoTexto(faq)].filter((n) => !autorizados.has(n));
  return fora.map((n) => `o FAQ do dono cita $${n} — não está entre os preços da fonte oficial (${[...autorizados].sort((a, b) => a - b).map((x) => "$" + x).join(", ")})`);
}


// ── OS 13 MOLDES ────────────────────────────────────────────────────────────────────────────────
// Um agente por ramo, pronto antes de existir cliente do ramo. O nome carrega "MOLDE ·" porque a
// lista de agentes vira um cemitério rápido: sem marca no nome, daqui a três meses ninguém sabe
// quais atendem cliente de verdade e quais são gabarito — e alguém apaga o errado.
//
// ⚠️ O MOLDE NASCE INERTE DE PROPÓSITO. As ferramentas (`schedulingTool`/`actionTool`) são criadas
// com o e-mail do tenant; num molde esse e-mail é VAZIO, então ele não consegue agendar nem cobrar
// para ninguém. E nenhum número é amarrado a ele. Um gabarito que pudesse atender uma ligação de
// verdade seria um agente sem dono operando sobre dados de cliente.
const RAMOS = {
  "salons-spas": { nome: "Spa & Salon", industry: "salon spa beauty" },
  "restaurants": { nome: "Restaurant", industry: "restaurant food" },
  "dental-clinics": { nome: "Dental", industry: "dental clinic" },
  "medical-clinics": { nome: "Medical", industry: "medical clinic" },
  "plumbing-hvac": { nome: "Plumbing & HVAC", industry: "plumbing hvac" },
  "home-contractors": { nome: "Home Contractor", industry: "home contractor" },
  "cleaning-services": { nome: "Cleaning", industry: "cleaning services" },
  "law-firms": { nome: "Law Firm", industry: "law firm legal" },
  "accountants": { nome: "Accounting", industry: "accountant bookkeeping" },
  "real-estate": { nome: "Real Estate", industry: "real estate" },
  "auto-dealerships": { nome: "Auto Dealership", industry: "auto dealership" },
  "gyms-fitness": { nome: "Gym & Fitness", industry: "gym fitness" },
  "ecommerce": { nome: "E-commerce", industry: "ecommerce online store" },
};

// Procura pelo NOME: é o que torna a operação repetível sem tabela nova. Rodar duas vezes atualiza
// o molde existente em vez de criar um segundo — 26 agentes com o mesmo nome seria pior que zero.
async function acharAgentePorNome(env, nome) {
  const r = await fetch("https://api.elevenlabs.io/v1/convai/agents?page_size=100", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
  if (!r.ok) return { erro: `não consegui listar os agentes (HTTP ${r.status})` };
  const d = await r.json().catch(() => null);
  const lista = Array.isArray(d?.agents) ? d.agents : [];
  return { agente: lista.find((a) => (a?.name || "") === nome) || null, total: lista.length };
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

      // SEM AGENTE = só publica o documento. O playbook de um ramo nasce ANTES de existir agente
      // daquele ramo — exigir um agente para guardar conhecimento inverteria a ordem natural
      // (primeiro o manual, depois quem lê). Com agente, publica E anexa na mesma chamada.
      const alvo = (b.agente || "").toString();
      if (!alvo) {
        const { kbUpsert, kbApagar } = await import("../lib/agentKB.js");
        const up = await kbUpsert(env, { nome, texto });
        if (!up.ok) return json({ acao: "vertical", vertical: vert, ...up }, 502);
        // Sem agente para conferir, o antigo sai logo — não há anexo para proteger.
        if (up.antigo) await kbApagar(env, up.antigo);
        return json({ acao: "vertical", vertical: vert, ok: true, id: up.id, nome, chars: up.chars, substituiu: up.antigo || null, anexado_em: null });
      }
      const r = await kbSincronizar(env, { agentId: alvo, camadas: [{ nome, texto }] });
      return json({ acao: "vertical", vertical: vert, ...r });
    }

    // ── PLAYBOOK EM LINGUAGEM DE NEGÓCIO (o que pode ir para agente de CLIENTE) ───────────────
    // Documento separado do playbook interno de propósito: são públicos diferentes. O interno diz
    // o que a PLATAFORMA faz; este diz o que a RECEPÇÃO daquele ramo precisa saber. Nome próprio
    // (`kb-{vertical}`) para nunca ser confundido com `playbook-{vertical}` na hora de anexar —
    // trocar os dois seria pôr a nossa especificação na boca da cliente do salão.
    if (b.acao === "vertical-cliente") {
      const vert = (b.vertical || "").toString().trim().slice(0, 40);
      const texto = (b.texto || "").toString();
      if (!vert || !texto.trim()) return json({ error: "informe vertical e texto" }, 400);

      // O PORTÃO. Recusa, não avisa: um KB vaza uma vez só e a confiança não volta.
      const seguro = verificarSeguroParaCliente(texto);
      if (!seguro.ok) {
        return json({ ok: false, motivo: "este texto NÃO pode entrar no cérebro de um agente de cliente", achados: seguro.achados }, 422);
      }

      const nome = `kb-${vert}`;
      if (simular) return json({ ok: true, simulado: true, nome, chars: texto.length, seguro: true, amostra: texto.slice(0, 600) });

      const { kbUpsert, kbApagar, kbAnexar } = await import("../lib/agentKB.js");
      const up = await kbUpsert(env, { nome, texto });
      if (!up.ok) return json({ acao: "vertical-cliente", vertical: vert, ...up }, 502);

      const alvo = (b.agente || "").toString();
      if (!alvo) {
        if (up.antigo) await kbApagar(env, up.antigo);
        return json({ acao: "vertical-cliente", vertical: vert, ok: true, id: up.id, nome, chars: up.chars, anexado_em: null });
      }
      const anexo = await kbAnexar(env, { agentId: alvo, docs: [{ id: up.id, nome }] });
      if (anexo.ok && up.antigo) await kbApagar(env, up.antigo);
      return json({ acao: "vertical-cliente", vertical: vert, id: up.id, nome, chars: up.chars, agente: alvo, ...anexo });
    }

    // ── VER OS MOLDES (só leitura) ────────────────────────────────────────────────────────────
    // Nasceu de uma necessidade boba e reveladora: para PERGUNTAR uma coisa a um molde eu estava
    // chamando de novo a rota que CRIA — só para descobrir o id. Usar uma escrita como leitura é
    // como abrir o cofre para conferir a hora: funciona, custa caro e um dia derruba algo.
    if (b.acao === "moldes") {
      const r = await fetch("https://api.elevenlabs.io/v1/convai/agents?page_size=100", { headers: { "xi-api-key": env.ELEVENLABS_API_KEY } });
      if (!r.ok) return json({ ok: false, motivo: `não consegui listar (HTTP ${r.status})` }, 502);
      const d = await r.json().catch(() => null);
      const todos = Array.isArray(d?.agents) ? d.agents : [];
      const moldes = todos.filter((a) => (a?.name || "").startsWith("MOLDE · "));
      return json({ ok: true, total_agentes: todos.length, moldes: moldes.length,
        lista: moldes.map((a) => ({ nome: a.name, id: a.agent_id || a.id })),
        // Os que NÃO são molde aparecem também: é como se vê, de relance, que criar 13 gabaritos
        // não atropelou nenhum agente que atende cliente de verdade.
        clientes: todos.filter((a) => !(a?.name || "").startsWith("MOLDE · ")).map((a) => a.name) });
    }

    // ── CRIAR (ou atualizar) O MOLDE DE UM RAMO ──────────────────────────────────────────────
    if (b.acao === "molde") {
      const vert = (b.vertical || "").toString().trim();
      const R = RAMOS[vert];
      if (!R) return json({ error: `ramo desconhecido: ${vert}`, conhecidos: Object.keys(RAMOS) }, 400);
      const nome = `MOLDE · Gui ${R.nome}`;

      const doc = await acharDoc(env, `playbook-${vert}`);
      if (doc.erro) return json({ ok: false, motivo: doc.erro }, 502);
      // Sem playbook, o molde não tem razão de existir — seria um agente genérico com nome de ramo,
      // que é a pior coisa: parece pronto e não sabe nada do negócio.
      if (!doc.doc) return json({ ok: false, motivo: `o playbook-${vert} ainda não está no KB — publique ele primeiro` }, 409);

      const cfg = buildConversationConfig(env, {
        business: `Gui ${R.nome}`, industry: R.industry, lang: "en",
        brain: "", agentName: "Gui", email: "", prices: "",
      });

      const achou = await acharAgentePorNome(env, nome);
      if (achou.erro) return json({ ok: false, motivo: achou.erro }, 502);

      let agentId = achou.agente?.agent_id || achou.agente?.id || "";
      let criado = false;
      if (agentId) {
        const pr = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agentId}`, {
          method: "PATCH", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ conversation_config: cfg }),
        });
        if (!pr.ok) return json({ ok: false, motivo: `PATCH do molde recusado (HTTP ${pr.status})`, detalhe: (await pr.text().catch(() => "")).slice(0, 300) }, 502);
      } else {
        const cr = await fetch("https://api.elevenlabs.io/v1/convai/agents/create", {
          method: "POST", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ name: nome, conversation_config: cfg }),
        });
        if (!cr.ok) return json({ ok: false, motivo: `criação recusada (HTTP ${cr.status})`, detalhe: (await cr.text().catch(() => "")).slice(0, 300) }, 502);
        const cd = await cr.json().catch(() => ({}));
        agentId = cd.agent_id || cd.id || "";
        criado = true;
        if (!agentId) return json({ ok: false, motivo: "molde criado sem id" }, 502);
      }

      const { kbAnexar } = await import("../lib/agentKB.js");
      const anexo = await kbAnexar(env, { agentId, docs: [{ id: doc.doc.id, nome: doc.doc.name }] });
      return json({ acao: "molde", vertical: vert, nome, agente: agentId, criado, playbook: doc.doc.name, ...anexo });
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
    // Confronta o que o dono escreveu à mão com a fonte oficial ANTES de qualquer escrita.
    const faqTexto = (await svcJson(env, "kb_for_agent", { p_secret: env.INGEST_SECRET || "", p_email: email }).catch(() => "")) || "";
    // Os dois lados passam pelo MESMO parser — comparar números lidos por regras diferentes foi
    // exatamente o que gerou o primeiro alerta falso.
    const autorizados = precosDoTexto(camadas.map((c) => c.texto).join("\n") + "\n" + cli);
    const alertas = divergencias(typeof faqTexto === "string" ? faqTexto : "", autorizados);
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
      return json({ ok: true, simulado: true, negocio, alertas,
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
    return json({ acao: "sincronizar", email, negocio, agente: agentId, alertas, ...r });
  } catch (e) {
    return json({ error: String(e).slice(0, 200) }, 500);
  }
}
