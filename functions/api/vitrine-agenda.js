// Cloudflare Pages Function — POST /api/vitrine-agenda
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// AGENDAR NO NOSSO DOMÍNIO, NA VITRINE DO PROSPECT.
//
// POR QUE EXISTE (Luis, 25/08): «o click do booking abre outra página com outro domínio». A
// vitrine existe para o dono ver O SITE DELE fazendo tudo — mandar o visitante para
// go.booker.com no meio do caminho quebra exatamente isso, e ainda entrega a conversão pra
// plataforma do concorrente. O motor de agenda da casa (biz_*) já existe e já está semeado com
// o catálogo REAL deste prospect; faltava só a porta que o navegador pode bater.
//
// DESENHO DE SEGURANÇA — o mesmo do /api/voice-web, e pelas mesmas razões:
//   · O TENANT NUNCA VEM DO CORPO. O corpo manda `slug` (identidade pública, já na URL); quem
//     traduz slug → e-mail é o SERVIDOR (client_site_owner, INGEST-gated). Sem isso, qualquer
//     um postaria o e-mail de outro negócio e leria/gravaria na agenda dele.
//   · sameOrigin + limite por IP: é rota pública, não pode ter segredo no navegador.
//   · O segredo do motor (SCHED_SECRET/INGEST) fica no servidor e nunca é ecoado.
//
// OPERAÇÕES
//   { slug, op:"menu" }                                  → serviços reais do tenant (+ `equipe`: quem o site pode mostrar)
//   { slug, op:"horarios", servico, dia?, pro_id? }      → vagas REAIS do motor (com a profissional, se escolhida)
//   { slug, op:"marcar", servico, quando, nome, telefone, pro_id? } → marca de verdade
//
// ESCOLHER A PROFISSIONAL (2026-10-22, desk_v16): `equipe` vem de vitrine_pros (só equipe ativa que a dona não
// tirou do site; nome, título, cor e a duração DELA por serviço — nunca contato). Quem a dona marcou "não marca
// pelo site" some da escolha E do "Sem preferência": os horários dela são filtrados aqui. Sem preferência, a
// marcação tenta as profissionais visíveis livres naquele horário, uma a uma — quem não escolhe não perde vaga.
// Com pro_id, marca com ELA (antes a tela mostrava "10:00 · Bia" e o motor podia marcar a Ana às 10:00).
//
// ADICIONAIS (2026-10-23, desk_v17): `menu.adicionais` vem de vitrine_addons; `horarios`/`marcar` aceitam `adicionais`
// (ids). O SERVIDOR confere os ids contra a lista e soma os minutos (nunca o navegador): os horários saem só os que
// CABEM com o tempo a mais (biz_availability_x) e a marcação manda os ids ao motor (attributes.addons → biz_book
// valida, grava o retrato e soma os minutos).
//        (+ `deposito:{url,cents,janela_h?}` quando o serviço tem sinal e o negócio cobra online)
//
// ⚠️ "marcar" devolve o COMPROVANTE (id da reserva) ou uma falha honesta. "ok" sem id é promessa
// sem lastro — foi assim que a agente já disse "marcado" sobre o vazio.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { svcRpc, svcJson } from "../lib/sb.js";
import { sinalNaTela } from "../lib/sinal.js";

const s = (v, n = 200) => (v == null ? "" : v.toString().slice(0, n).trim());
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Quem o site pode mostrar (desk_v16). null = NÃO SEI (rota sem o SQL, banco fora) → a página segue como antes,
// sem escolha e sem filtro; [] = a dona tirou todo mundo do site.
// Adicionais que o site pode oferecer (desk_v17). null = não sei (sem o SQL) → a página não oferece nenhum.
async function adicionaisDoSite(env, dono) {
  try {
    const r = await svcRpc(env, "vitrine_addons", { p_tenant: dono });
    if (!r || !r.ok) return null;
    const d = await r.json().catch(() => null);
    return Array.isArray(d) ? d : null;
  } catch { return null; }
}
// ids pedidos ∩ lista do servidor → { ids, minutos }
async function conferirAdicionais(env, dono, pedidos) {
  const lista = Array.isArray(pedidos) && pedidos.length ? await adicionaisDoSite(env, dono) : null;
  const validos = (lista || []).filter((a) => pedidos.map((x) => String(x).toLowerCase()).includes(String(a.id).toLowerCase())).slice(0, 5);
  return { ids: validos.map((a) => a.id), minutos: validos.reduce((s, a) => s + (Number(a.duration_min) || 0), 0) };
}

async function equipeDoSite(env, dono) {
  try {
    const r = await svcRpc(env, "vitrine_pros", { p_tenant: dono });
    if (!r || !r.ok) return null;
    const d = await r.json().catch(() => null);
    return Array.isArray(d) ? d : null;
  } catch { return null; }
}

async function donoDoSlug(env, slug) {
  try {
    const r = await svcRpc(env, "client_site_owner", { p_secret: env.INGEST_SECRET || "", p_slug: slug });
    if (!r || !r.ok) return null;                      // null = NÃO SEI (nunca "não existe")
    return ((await r.json()) || "").toString().trim().toLowerCase() || "";
  } catch { return null; }
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ ok: false, error: "forbidden" }, 403);
  if (await rateLimited(request, env, "vitrine-agenda", 20)) return json({ ok: false, error: "too many requests" }, 429);

  const b = await request.json().catch(() => ({}));
  const slug = s(b.slug, 60).toLowerCase();
  const op = s(b.op, 20);
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return json({ ok: false, error: "bad_slug" }, 400);

  const dono = await donoDoSlug(env, slug);
  if (dono === null) return json({ ok: false, error: "nao consegui resolver o negocio" }, 503);
  if (!dono) return json({ ok: false, error: "slug sem dono" }, 404);

  // A chamada ao motor sai daqui COM o segredo do servidor — o navegador nunca o vê.
  const motor = (corpo) => fetch(new URL("/api/agent-schedule", request.url).toString(), {
    method: "POST",
    // ⚠️ AGENT_ACTION_SECRET, NÃO INGEST_SECRET (corrigido 2026-08-27). O /api/agent-schedule
    // gateia em `safeEq(provided, env.AGENT_ACTION_SECRET)` — é o segredo que guiBrain.js e
    // provision.js usam para falar com ele. Esta rota mandava o INGEST e levava 401 em TODA
    // chamada: a vitrine nunca listou um serviço nem marcou um horário em produção.
    // Achado provando o deploy: o menu do three-degrees devolvia "motor respondeu 401" também
    // no deployment sem nenhuma alteração minha, o que descartou regressão e apontou para cá.
    // O NEGÓCIO vai no cabeçalho x-guileo-client (2026-10-05): o agent-schedule usa `b.email` como reserva
    // para descobrir o negócio. Com o e-mail da CLIENTE no corpo, sem este cabeçalho, a reserva iria para
    // o "negócio" com o e-mail dela. O cabeçalho vence o corpo (ver feedback "Cabeçalho vence corpo").
    headers: { "Content-Type": "application/json", "x-guileo-secret": env.AGENT_ACTION_SECRET || "", "x-guileo-client": dono },
    body: JSON.stringify({ email: dono, ...corpo }),
  });

  try {
    if (op === "menu") {
      const r = await motor({ op: "lookup" });
      // ⚠️ PORTÃO DE STATUS ANTES DO FALLBACK (fallback.test.mjs cobra este).
      // `r.json().catch(()=>null)` só pega corpo ILEGÍVEL. Um 500 com corpo JSON passa
      // reto por `if (!d)` — e no "menu" isso virava `ok:true, servicos: []`: a vitrine
      // dizia "não temos serviços" quando o motor tinha caído. Erro tem que parecer erro.
      if (!r.ok) return json({ ok: false, error: `motor respondeu ${r.status}` }, 503);
      const d = await r.json().catch(() => null);
      if (!d) return json({ ok: false, error: "motor nao respondeu" }, 503);
      const [equipe, adicionais] = await Promise.all([equipeDoSite(env, dono), adicionaisDoSite(env, dono)]);
      return json({ ok: true, ...(adicionais && adicionais.length ? { adicionais: adicionais.map((a) => ({ id: a.id, name: a.name, duration_min: Number(a.duration_min) || 0, price_cents: a.price_cents ?? null })) } : {}), servicos: d.services || d.servicos || [], precos: Array.isArray(d.priced) ? d.priced : [], profissionais: d.professionals || [],
        ...(equipe ? { equipe: equipe.map((p) => ({ id: p.id, name: p.name, title: p.title || "", color: p.color || "", services: (p.services || []).map((x) => ({ name: x.name, duration_min: x.duration_min, service_duration_min: x.service_duration_min })) })) } : {}) });
    }
    if (op === "horarios") {
      const servico = s(b.servico, 120);
      if (!servico) return json({ ok: false, error: "servico obrigatorio" }, 400);
      // ⚠️ SEM FILTRO DE DIA, E ISSO É DE PROPÓSITO (2026-08-27). Este `motor()` mandava
      // `day: s(b.dia,30)`, mas o op "availability" do agent-schedule.js NÃO aceita data: ele
      // chama biz_availability com serviço/unidade/profissional/limite e devolve as próximas
      // vagas, ponto. O parâmetro não filtrava nada — só parecia que filtrava.
      // Hoje ninguém é enganado porque as telas de booking não mandam `dia`. Mas um parâmetro que
      // finge existir é armadilha para o próximo: quem colocar um seletor de data na vitrine vai
      // confiar nele e mostrar sexta para quem pediu sábado. Melhor não existir do que mentir.
      // Para filtrar por dia de verdade, o filtro tem que nascer no motor (e no biz_availability).
      // DIA DE VERDADE (2026-10-05): o motor agora aceita `days`/`limit` e devolve o fuso; o filtro
      // por dia é feito AQUI, no fuso do negócio — não no navegador de quem marca.
      const dia = /^\d{4}-\d{2}-\d{2}$/.test(s(b.dia, 10)) ? s(b.dia, 10) : "";
      const proId = UUID.test(s(b.pro_id, 40)) ? s(b.pro_id, 40).toLowerCase() : "";
      const equipe = await equipeDoSite(env, dono);
      const visiveis = equipe ? new Set(equipe.map((p) => String(p.id).toLowerCase())) : null;
      if (proId && visiveis && !visiveis.has(proId)) return json({ ok: false, error: "pro_not_found" }, 404);
      const extras = await conferirAdicionais(env, dono, b.adicionais);
      const r = await motor({ op: "availability", service: servico, days: 30, limit: 300, pro_id: proId || undefined, extra_min: extras.minutos || undefined });
      if (!r.ok) return json({ ok: false, error: `motor respondeu ${r.status}` }, 503);
      const d = await r.json().catch(() => null);
      if (!d) return json({ ok: false, error: "motor nao respondeu" }, 503);
      // Lista ausente NÃO é "sem vaga" — a tela precisa saber a diferença.
      if (d.reason === "pro_not_found") return json({ ok: false, error: "pro_not_found" }, 404);
      if (!Array.isArray(d.slots)) return json({ ok: false, error: d.message || "nao consegui ler a agenda" }, 503);
      // escolha só existe quando cada vaga diz de quem é (motor interno) e a lista do site respondeu
      const escolha = !!visiveis && d.slots.length > 0 && d.slots.every((x) => x && x.pro_id);
      if (escolha) d.slots = d.slots.filter((x) => visiveis.has(String(x.pro_id).toLowerCase()));
      const tz = d.tz || "America/New_York";
      const diaDe = (iso) => { try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)); } catch { return ""; } };
      const dias = [...new Set(d.slots.map((x) => diaDe(x.start)).filter(Boolean))];   // dias com vaga (para o calendário)
      const slots = dia ? d.slots.filter((x) => diaDe(x.start) === dia) : d.slots.slice(0, 12);
      return json({ ok: true, slots, dias, tz, escolha });
    }
    if (op === "marcar") {
      const nome = s(b.nome, 120), tel = s(b.telefone, 40), servico = s(b.servico, 120), quando = s(b.quando, 60);
      // e-mail opcional (2026-10-05): com ele a confirmação também sai por e-mail, que hoje é o único
      // canal liberado (SMS espera A2P). Só aceita formato de e-mail; o resto vira vazio.
      const emailCliente = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s(b.email, 160)) ? s(b.email, 160).toLowerCase() : "";
      if (!nome || !tel || !servico || !quando) return json({ ok: false, error: "faltam dados" }, 400);
      // GUILEO DESK (2026-10-05): a recepção pode tirar de uma cliente o direito de marcar sozinha
      // (ficha da cliente → "pode marcar online"). Quem decide é o banco; na dúvida, deixa marcar.
      try {
        const pode = await svcRpc(env, "desk_can_book_online", { p_tenant: dono, p_contact: tel });
        if (pode && pode.ok && (await pode.json().catch(() => true)) === false) {
          return json({ ok: false, error: "call_to_book", nota: "Para este agendamento, fale com a recepção." });
        }
      } catch { /* sem resposta → segue o fluxo normal */ }
      // ⚠️ OS NOMES DOS CAMPOS SÃO O CONTRATO (corrigido 2026-08-27). Este bloco mandava
      // `customer_name`/`customer_phone` — nomes que NÃO existem em agent-schedule.js, que lê
      // `b.name` e `b.contact`. O motor gravava a reserva com nome e contato VAZIOS: o horário
      // ficava preso na agenda e o negócio não tinha quem chamar. E como o motor devolvia um id
      // de verdade, o comprovante exigido logo abaixo passava e a tela dizia "agendado".
      // Comprovante certo sobre o campo errado é o pior tipo de falha: ela se parece com sucesso.
      // O contrato agora é travado por vitrine-agenda.test.mjs, que compara o que sai daqui
      // com o que o motor realmente lê.
      // `channel:"web"`: sem ele o motor assume voz e o agendamento da vitrine entrava no feed
      // da Central como se fosse ligação (2026-09-28).
      // `email` aqui é o da CLIENTE (ou vazio). O negócio está no cabeçalho x-guileo-client, que vence.
      // QUEM ATENDE: escolhida → ela. Sem preferência → as profissionais VISÍVEIS livres neste horário, em ordem,
      // até uma aceitar (nunca uma que a dona tirou do site). Sem lista/sem escolha → como antes (o motor decide).
      const proId = UUID.test(s(b.pro_id, 40)) ? s(b.pro_id, 40).toLowerCase() : "";
      const equipe = await equipeDoSite(env, dono);
      const visiveis = equipe ? new Set(equipe.map((p) => String(p.id).toLowerCase())) : null;
      if (proId && visiveis && !visiveis.has(proId)) return json({ ok: false, error: "pro_not_found" }, 404);
      const extras = await conferirAdicionais(env, dono, b.adicionais);
      const comAdicionais = extras.ids.length ? { addons: extras.ids } : undefined;
      let candidatas = proId ? [proId] : [null];
      if (!proId && visiveis) {
        const ra = await motor({ op: "availability", service: servico, days: 30, limit: 300, extra_min: extras.minutos || undefined });
        const da = ra.ok ? await ra.json().catch(() => null) : null;
        const alvo = new Date(quando).getTime();
        const livres = Array.isArray(da?.slots) && da.slots.every((x) => x && x.pro_id)
          ? [...new Set(da.slots.filter((x) => new Date(x.start).getTime() === alvo && visiveis.has(String(x.pro_id).toLowerCase())).map((x) => String(x.pro_id).toLowerCase()))]
          : null;
        if (livres) {
          if (!livres.length) return json({ ok: false, error: "a agenda recusou", slots: (da.slots || []).filter((x) => visiveis.has(String(x.pro_id).toLowerCase())).slice(0, 12) }, 409);
          candidatas = livres.slice(0, 3);
        }
      }
      const nomeDe = (id) => (equipe || []).find((p) => String(p.id).toLowerCase() === id)?.name || "";
      let r = null, d = null, id = null, quem = "";
      for (const c of candidatas) {
        r = await motor({ op: "book", service: servico, when: quando, name: nome, contact: tel, channel: "web", email: emailCliente, pro_id: c || undefined, attributes: comAdicionais });
        if (!r.ok) return json({ ok: false, error: `motor respondeu ${r.status}` }, 503);
        d = await r.json().catch(() => null);
        id = d && (d.appointment_id || d.id || d.booking_id);
        if (d && d.ok === true && id) { quem = c ? nomeDe(c) : ""; break; }
      }
      // 🚨 COMPROVANTE OU NADA.
      if (!d || d.ok !== true || !id) {
        return json({ ok: false, error: (d && (d.message || d.error)) || "a agenda recusou", slots: (d && d.slots) || null }, 409);
      }
      // CONSENTIMENTO REGISTRADO (CR-11, 2026-10-13): a caixa "podem me mandar ofertas" da página de agendamento.
      // Só grava quando a pessoa MARCOU; desmarcada = nada gravado e nada presumido (db/consentimento.sql).
      // Registro que falha NUNCA derruba a reserva — ela já está comprovada acima.
      const cons = b.consentimento && typeof b.consentimento === "object" ? b.consentimento : null;
      if (cons && env.INGEST_SECRET) {
        const prova = `Caixa marcada na página de agendamento (${new Date().toISOString()}) · reserva ${id}`;
        for (const canal of ["sms", "call"]) {
          if (cons[canal] !== true) continue;
          try { await svcJson(env, "consent_record", { p_secret: env.INGEST_SECRET, p_email: dono, p_contact: tel, p_channel: canal, p_granted: true, p_source: "site_agendamento", p_evidence: prova }); }
          catch { /* não registrou → não presume; a campanha só lê o registro */ }
        }
      }
      // SINAL NA TELA (2026-10-05). A ligação pedia o sinal; o site não — a cliente marcava um serviço com
      // sinal e ninguém pedia nada. Agora, com a reserva JÁ comprovada acima, o servidor abre o link do sinal
      // no Stripe DO NEGÓCIO (lib/sinal.js sinalNaTela → criarLinkDoSinal, as mesmas regras da agente) e a
      // página mostra o botão. Sem sinal, cliente de confiança, sinal pago ou sem Stripe ligado → nada muda,
      // nenhuma etapa falsa. `hold` (horário segurado, a confirmar) não pede sinal — igual à agente.
      // ⚠️ A RESERVA NUNCA CAI POR CAUSA DO SINAL: teto curto e qualquer falha vira "sem etapa de sinal".
      let deposito = null;
      if (d.status !== "hold") {
        let relogio = null;
        try {
          const prazo = Math.min(Math.max(Number(env.SINAL_TELA_MS) || 5000, 1), 8000);
          const sn = await Promise.race([
            sinalNaTela(env, { tenant: dono, appointmentId: String(id), volta: slug, lang: s(b.lang, 5) }),
            new Promise((r) => { relogio = setTimeout(() => r(null), prazo); }),
          ]);
          if (sn && sn.ok === true && sn.url && sn.cents > 0) deposito = { url: sn.url, cents: sn.cents, ...(sn.janela_h > 0 ? { janela_h: sn.janela_h } : {}) };
        } catch { /* sinal é complemento: a reserva já está de pé */ }
        finally { if (relogio) clearTimeout(relogio); }
      }
      return json({ ok: true, id, quando: d.when || quando, servico, ...(quem ? { profissional: quem } : {}), ...(deposito ? { deposito } : {}) });
    }
    return json({ ok: false, error: "op invalida" }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 120) }, 503);
  }
}
