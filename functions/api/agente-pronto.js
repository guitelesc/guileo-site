// Cloudflare Pages Function — POST /api/agente-pronto · MOTOR DE AGENTE PRONTO
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// O que o Luis pediu (24/08): "o vendedor coloca os dados do X-Ray / Guileo Pulse e o link do
// site, e já cria um agente automático, personalizado, com poucos cliques — PRA O CLIENTE VER, e
// depois a gente só executa e finaliza."
//
// O QUE ISTO É: o agente do cliente montado A PARTIR DO SITE DELE, em uma tela, antes de existir
// de verdade. O dono lê a saudação com o nome do NEGÓCIO dele, os serviços dele, os preços dele —
// e decide olhando, não imaginando. Mesma lógica do Website Upgrade, aplicada ao agente.
//
// O QUE ISTO NÃO É: não cria agente na ElevenLabs, não compra número, não cobra nada. Montar é de
// graça e reversível; nascer custa (número + minutos) e continua sendo um passo separado e
// deliberado (/api/provision-agent). Confundir os dois é como o botão que comprava um número sem
// ninguém pedir — já pago nesta base.
//
// AS LEIS QUE ELE OBEDECE (todas custaram dinheiro antes):
//   • NUNCA INVENTA PREÇO. Serviço sem preço no site aparece como LACUNA gritando, não como
//     número plausível. Um exemplo com número vira cotação falsa na boca da agente ($118 de outro
//     serviço, 17/08).
//   • AUSÊNCIA APARECE. O que o site não disse vira uma lista de pendências que o vendedor
//     PRECISA preencher — nunca um campo bonito preenchido por chute. `|| []` aqui seria mentira.
//   • O agente herda a constituição e as lições (functions/lib/licoes.js) quando nascer de verdade;
//     esta tela mostra isso ao dono em vez de fingir que o prompt é só a saudação.
//
// Armazenamento: reusa `demo_save`/`demo_get` (blob JSON + token) — o Motor de Demo já resolveu
// isso e criar tabela nova pra guardar a mesma coisa seria dívida sem motivo.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import { json, sameOrigin, rateLimited } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (fn, body) => fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const s = (v, n = 400) => (v == null ? "" : v.toString().slice(0, n));

// A saudação é a primeira coisa que o dono lê — e a única frase da agente que ele julga em 2s.
const SAUDACAO = {
  en: (b) => `Thanks for calling ${b}! This is Gui — how can I help you today?`,
  pt: (b) => `${b}, bom dia! Aqui é a Gui — como posso ajudar?`,
  es: (b) => `¡${b}, buenos días! Habla Gui — ¿en qué puedo ayudarle?`,
};

// O que a agente SABE FAZER numa ligação. Não é marketing: cada item vira uma ferramenta real.
const HABILIDADES = {
  en: ["Answers every call, 24/7, in your business's name", "Books, reschedules and confirms appointments",
       "Quotes only the prices you approved — never invents one", "Takes the caller's name and number on every call",
       "Escalates an emergency to a human instead of booking it"],
  pt: ["Atende toda ligação, 24h, no nome do seu negócio", "Agenda, remarca e confirma horários",
       "Cota só os preços que você aprovou — nunca inventa um", "Anota nome e telefone de quem liga, sempre",
       "Passa emergência pra uma pessoa em vez de agendar"],
  es: ["Atiende cada llamada, 24/7, en nombre de su negocio", "Agenda, reprograma y confirma citas",
       "Cotiza solo los precios que usted aprobó — nunca inventa", "Toma nombre y teléfono en cada llamada",
       "Escala una emergencia a una persona en vez de agendarla"],
};

// AS LACUNAS. Este é o coração honesto do motor: o que o site NÃO disse tem que aparecer como
// pendência, porque é exatamente o que faz a agente inventar quando ela nasce sem saber.
function lacunas(kit, lang) {
  const L = [];
  const T = {
    en: { nome: "Business name — not found on the site", serv: "No service list found — the agent needs to know what you sell",
          preco: (n) => `${n} service${n > 1 ? "s" : ""} with no price — the agent will say “I'll have someone confirm” instead of quoting`,
          fatos: "No hours / location / specialties — the agent can't answer “are you open?”" },
    pt: { nome: "Nome do negócio — não achei no site", serv: "Nenhum serviço encontrado — a agente precisa saber o que você vende",
          preco: (n) => `${n} serviço${n > 1 ? "s" : ""} sem preço — a agente vai dizer “confirmo com a equipe” em vez de cotar`,
          fatos: "Sem horário / endereço / especialidades — a agente não responde “vocês estão abertos?”" },
    es: { nome: "Nombre del negocio — no lo encontré en el sitio", serv: "Sin lista de servicios — la agente necesita saber qué vende",
          preco: (n) => `${n} servicio${n > 1 ? "s" : ""} sin precio — la agente dirá “lo confirmo” en vez de cotizar`,
          fatos: "Sin horario / dirección / especialidades — la agente no responde “¿están abiertos?”" },
  }[lang] || {};
  if (!s(kit.name)) L.push(T.nome);
  const serv = Array.isArray(kit.services) ? kit.services : [];
  if (!serv.length) L.push(T.serv);
  const semPreco = serv.filter((x) => !s(x && x.price).trim()).length;
  if (semPreco) L.push(T.preco(semPreco));
  if (!s(kit.facts)) L.push(T.fatos);
  return L.filter(Boolean);
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
  const b = await request.json().catch(() => ({}));
  const action = s(b.action, 20) || "ver";
  const lang = ["pt", "es"].includes(s(b.lang, 2)) ? s(b.lang, 2) : "en";

  // ── VER: o cliente abrindo o link. Público, só leitura. ───────────────────────────────────
  if (action === "ver") {
    const token = s(b.token, 200).trim();
    if (!token) return json({ ok: false, error: "no token" }, 400);
    const r = await rpc("demo_get", { p_secret: env.INGEST_SECRET || "", p_token: token });
    if (!r.ok) return json({ ok: false, error: "indisponivel" }, 503);
    const d = await r.json().catch(() => null);
    const kit = Array.isArray(d) ? d[0] : d;
    // `|| {}` aqui viraria uma tela vazia fingindo agente; token morto é 404, não é calmaria.
    if (!kit || typeof kit !== "object" || !kit._agente) return json({ ok: false, found: false }, 404);
    return json({ ok: true, agente: kit._agente });
  }

  // ── MONTAR: o vendedor cola a URL. Custa uma chamada de modelo, então tem freio. ───────────
  if (action === "montar") {
    if (await rateLimited(request, env, "agente-pronto", 12)) return json({ error: "too many requests" }, 429);
    const url = s(b.url, 300).trim();
    if (!/^https?:\/\//i.test(url)) return json({ ok: false, error: "url invalida" }, 400);

    // Reusa o extrator de marca do Motor de Demo em vez de escrever um segundo — um extrator que
    // diverge do outro é como dois painéis com o mesmo número diferente.
    const orig = new URL(request.url).origin;
    const br = await fetch(`${orig}/api/demo`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: orig },
      body: JSON.stringify({ action: "brand", url }),
    }).catch(() => null);
    if (!br || !br.ok) return json({ ok: false, error: "nao consegui ler o site" }, 503);
    const kit = await br.json().catch(() => null);
    const marca = (kit && (kit.brand || kit)) || null;
    if (!marca || typeof marca !== "object") return json({ ok: false, error: "site sem conteudo legivel" }, 503);

    // 🚨 O AVISO DO EXTRATOR NÃO PODE SER IGNORADO (achado 24/08, antes de qualquer cliente ver).
    // Quando o site não abre pra nós (WordPress atrás de proteção, SPA, timeout), o Motor de Demo
    // preenche com um modelo TÍPICO DO SETOR e marca `generic: true`. Para uma DEMO de marketing
    // isso é aceitável — a tela nunca fica vazia. Para o AGENTE é mentira: na 1ª prova, uma
    // empresa de encanamento veio com "Table reservation, Takeout order, Catering". Se o dono
    // abre isso, a venda morre na primeira linha, e com razão.
    // Aqui o modelo genérico é DESCARTADO e vira lacuna. Prefiro a tela dizendo "não consegui ler
    // seu site" a dizer com confiança uma coisa que não é do negócio dele.
    const cego = marca.generic === true;
    const negocio = s(marca.name, 120).trim();
    const servicos = cego ? [] : (Array.isArray(marca.services) ? marca.services : []).slice(0, 10)
      .map((x) => ({ nome: s(x && x.name, 90), preco: s(x && x.price, 40).trim() }))
      .filter((x) => x.nome);

    const agente = {
      negocio, site: url, lang,
      tagline: cego ? "" : s(marca.tagline, 200),
      logo: /^https?:\/\//i.test(s(marca.logo, 400)) ? s(marca.logo, 400) : "",
      cor: /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s(marca.accent || marca.color, 9)) ? s(marca.accent || marca.color, 9) : "",
      saudacao: negocio ? (SAUDACAO[lang] || SAUDACAO.en)(negocio) : "",
      servicos,
      cerebro: cego ? "" : s(marca.facts, 2000),
      habilidades: HABILIDADES[lang] || HABILIDADES.en,
      // O X-Ray / Pulse que o vendedor digitou. Texto livre do vendedor, guardado como o que é.
      notas: s(b.notas, 1200).trim(),
      lacunas: [
        ...(cego ? [{ pt: "Não consegui LER o site daqui (proteção anti-robô ou site que só monta no navegador) — nome, serviços e preços precisam ser digitados à mão antes de mostrar pro dono",
                      en: "I couldn't READ the site from here (bot protection, or a site that only renders in a browser) — name, services and prices must be typed in by hand before showing the owner",
                      es: "No pude LEER el sitio desde aquí (protección anti-bot o sitio que solo se arma en el navegador) — nombre, servicios y precios deben escribirse a mano antes de mostrarlo" }[lang]] : []),
        ...lacunas({ name: negocio, services: servicos.map((x) => ({ price: x.preco })), facts: cego ? "" : marca.facts }, lang),
      ],
      leu_o_site: !cego,
      criado_em: new Date().toISOString(),
      // ⚠️ ESTADO EXPLÍCITO. Enquanto for `previa`, nada existe na ElevenLabs e nenhum número foi
      // comprado. Quem lê a tela tem que saber disso sem perguntar.
      estado: "previa",
    };

    const sv = await rpc("demo_save", { p_secret: env.INGEST_SECRET || "", p_brand: { ...marca, _agente: agente } });
    if (!sv.ok) return json({ ok: false, error: "nao consegui salvar" }, 503);
    const token = s(await sv.json(), 200).replace(/^"|"$/g, "");
    if (!token) return json({ ok: false, error: "nao consegui salvar" }, 503);
    return json({ ok: true, token, link: `${orig}/agente/${token}`, agente });
  }

  return json({ error: "acao desconhecida" }, 400);
}
