// Cloudflare Pages Function — POST /api/raio-x · O PEDIDO PÚBLICO DO GUILEO X-RAY
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// O MOTOR DE AQUISIÇÃO. Até hoje o Guileo X-Ray (o relatório de /apresentacao/:id) era peça que o
// Luis gerava à mão para um prospect escolhido. Aqui ele vira porta de entrada: QUALQUER dono de
// negócio pede o dele, de graça, em troca de responder um quiz curto e marcar 15 minutos.
//
// POR QUE PODE SER GRÁTIS EM ESCALA: o motor (lib/avaliacao.js) é DETERMINÍSTICO — mede site,
// canais, telefone, catálogo. Não chama Anthropic nem nenhuma IA paga. Custo por unidade ≈ zero
// (uma leitura de HTML). ⚠️ NUNCA introduza chamada de modelo neste fluxo: mataria a economia do
// produto, que é justamente o que permite dar de graça no anúncio.
//
// ── AS 3 AÇÕES (todas POST, todas same-origin) ────────────────────────────────────────────────
//   { acao:"gerar",    site, nome, contato, negocio?, lang?, quiz:{...} } → gera/reaproveita o X-Ray,
//        grava o lead no funil que já existe (/api/lead → gui_actions + CRM + atribuição de
//        anúncio + speed-to-lead) e devolve o link de /apresentacao/<uuid>.
//   { acao:"horarios", lang? }                          → vagas REAIS da agenda da Guileo
//   { acao:"marcar",   quando, nome, contato, lang?, id? } → marca a call de 15 min no motor real
//
// ── ANTI-ABUSO (obrigatório: rota pública que dispara varredura de site de terceiro) ──────────
//   1. sameOrigin  — só o nosso próprio site posta (bloqueia curl sem cabeçalho).
//   2. por IP      — 5 pedidos/hora (rateLimited, KV).
//   3. por DOMÍNIO — 3 varreduras/dia do MESMO site, venha de onde vier o pedido.
//   4. IDEMPOTÊNCIA por domínio — o mesmo site pedido de novo em até 7 dias REAPROVEITA a
//      avaliação recente em vez de re-escanear. É o que impede a gente de virar scanner grátis de
//      terceiro: dez pessoas pedindo o mesmo domínio = uma leitura só.
//   A leitura do site em si já passa pelas travas de SSRF/redirect/tamanho do buscarHtml().
//
// ── HONESTIDADE ───────────────────────────────────────────────────────────────────────────────
//   O quiz não é enfeite nem é medição: cada resposta entra como DECLARADA (payload.declarado) e
//   só alimenta as previsões, com a premissa dizendo por extenso que o número veio da boca do
//   dono. O score por aspecto continua sendo só o que NÓS medimos. Ver lib/avaliacao.js.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import { json, rateLimited, sameOrigin } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { avaliarNegocio, normLang } from "../lib/avaliacao.js";
import { emitFailure } from "../lib/failure.js";

const s = (v, n = 200) => (v == null ? "" : v.toString().trim().slice(0, n));
const num = (v) => { const n = Number(String(v ?? "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) && n > 0 ? n : null; };

// Tenant da própria Guileo — a agenda da call de 15 min é a NOSSA agenda, no mesmo motor biz_*
// que todo cliente usa (a Guileo rodando na Guileo). Nunca um calendário paralelo.
const guileoTenant = (env) => (env.OWNER_EMAIL || "smart@guileoai.com").toString().split(",")[0].trim().toLowerCase();
// A call tem 15 minutos. Se o serviço de 15 min ainda não estiver cadastrado (db/xray.sql), cai
// no "Guileo Demo" que já existe — e a página mostra a duração que o motor DEVOLVEU, não a que a
// gente prometeu. Prometer 15 e marcar 30 seria a primeira mentira do relacionamento.
const SERVICOS_CALL = ["Guileo X-Ray (15 min)", "Guileo Demo"];

// Domínio canônico: é a CHAVE de idempotência e do limite por site. Sem canonizar, "site.com",
// "www.site.com/" e "https://SITE.com" seriam três varreduras do mesmo servidor.
// ── DE QUEM É ESTE LEAD ──────────────────────────────────────────────────────────────────────
// O resto da plataforma atribui vendedor por `?ref=<slug>` (App.jsx guarda 90 dias e injeta o ref
// em TODA chamada a /api/lead; lead.js grava "👤ref:<slug>" no details, que é o que as funções de
// comissão e a caixa de entrada do vendedor leem).
//
// O /raio-x ficava FORA disso por dois motivos que se somavam: a página posta em /api/raio-x (o
// wrapper do App.jsx só costura /api/lead), e o encaminhamento pro funil acontece SERVIDOR→SERVIDOR
// (nenhum wrapper de browser alcança). Resultado: visitante que chegou pelo link do vendedor virava
// lead público e avaliação com `seller = "raio-x-publico"` — dono nenhum, comissão nenhuma.
//
// Onde o ref pode estar HOJE (nesta ordem):
//   1. corpo   — `ref` (o caminho que a tela deve usar; já aceito aqui pra funcionar no dia 1)
//   2. query   — ?ref= na própria chamada
//   3. Referer — a URL da página que postou: guileoai.com/raio-x?ref=luis (funciona AGORA, sem
//                tocar em src/, porque o browser manda o Referer completo na mesma origem)
// O cookie `gui_attr` NÃO serve: ele carrega origem de anúncio (source/campaign/gclid/fbclid) e
// nunca o ref do vendedor — ver functions/lib/atribuicao.js. Sem ref → segue público. Não se
// inventa dono: dono errado é pior que dono nenhum (paga comissão pra quem não trabalhou).
function refDoPedido(request, url, b) {
  const limpa = (v) => {
    const t = (v == null ? "" : v.toString().trim()).slice(0, 40);
    // slug/base64url apenas: nunca espaço nem "·", que são justamente os separadores do details.
    return /^[A-Za-z0-9._-]{1,40}$/.test(t) ? t : "";
  };
  const doCorpo = limpa(b && b.ref);
  if (doCorpo) return doCorpo;
  const daQuery = limpa(url.searchParams.get("ref"));
  if (daQuery) return daQuery;
  try {
    const ref = request.headers.get("Referer") || "";
    if (ref) return limpa(new URL(ref).searchParams.get("ref"));
  } catch { /* Referer estranho → sem ref, e o lead segue público */ }
  return "";
}

function canonizar(bruto) {
  let t = s(bruto, 300).replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  t = t.split(/[/?#]/)[0].toLowerCase();
  if (!t || !t.includes(".") || /\s/.test(t)) return null;
  if (/^(localhost|\d+\.\d+\.\d+\.\d+|\[)/.test(t)) return null; // interno/IP → nunca varre
  return t;
}

// Limite POR DOMÍNIO (o rateLimited da casa é por IP). Fail-open igual ao irmão: KV fora do ar
// nunca pode impedir um pedido legítimo — as outras 3 travas continuam de pé.
async function dominioEstourou(env, dominio, limite = 3, janelaSec = 86400) {
  try {
    const kv = env && env.RATE_LIMIT;
    if (!kv) return false;
    const key = `rl:xray-dom:${dominio}:${Math.floor(Date.now() / (janelaSec * 1000))}`;
    const n = parseInt((await kv.get(key)) || "0", 10) + 1;
    if (n > limite) return true;
    await kv.put(key, String(n), { expirationTtl: janelaSec * 2 });
    return false;
  } catch { return false; }
}

// Fala com a agenda REAL pelo mesmo portão do agente de voz (/api/agent-schedule).
// Sem AGENT_ACTION_SECRET a agenda simplesmente não está disponível — e a página DIZ isso,
// em vez de desenhar um calendário de mentira.
async function agenda(env, origin, corpo) {
  if (!env.AGENT_ACTION_SECRET) return { indisponivel: "sem AGENT_ACTION_SECRET" };
  try {
    const r = await fetch(`${origin}/api/agent-schedule`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-guileo-secret": env.AGENT_ACTION_SECRET,
        "x-guileo-client": guileoTenant(env), // o tenant é PINADO aqui, nunca vem do visitante
      },
      body: JSON.stringify(corpo),
    });
    const txt = await r.text();
    if (!r.ok) return { indisponivel: `agenda respondeu ${r.status}`, detalhe: txt.slice(0, 160) };
    try { return JSON.parse(txt); } catch { return { indisponivel: "agenda respondeu nao-JSON" }; }
  } catch (e) { return { indisponivel: String(e).slice(0, 140) }; }
}

// Qual serviço a call usa HOJE: pergunta o cardápio real e escolhe o primeiro da preferência.
async function servicoDaCall(env, origin) {
  const menu = await agenda(env, origin, { op: "lookup" });
  if (menu.indisponivel) return { erro: menu.indisponivel };
  // op=lookup devolve `services` como lista de NOMES (string) e `priced` como objetos — aceitar as
  // duas formas evita quebrar se o contrato do irmão mudar de lado.
  const nomes = (menu.services || []).map((x) => (typeof x === "string" ? x : x?.name)).filter(Boolean);
  const escolhido = SERVICOS_CALL.find((n) => nomes.includes(n)) || nomes[0];
  if (!escolhido) return { erro: "nenhum serviço cadastrado na agenda da Guileo" };
  return { nome: escolhido };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = url.origin;
  try {
    // TRAVA 1 — só o nosso site posta.
    if (!sameOrigin(request)) return json({ ok: false, erro: "forbidden" }, 403);
    const b = await request.json().catch(() => ({}));
    const acao = s(b.acao || b.action || "gerar", 20);
    const lang = s(b.lang, 5).toLowerCase();
    // O MOTOR fala 3 idiomas (pt·en·es); a PÁGINA fala 4. Visitante em hindi recebe o relatório em
    // inglês — e a página diz isso na cara dele, antes de pedir. Traduzir o motor "no chute" para
    // um 4º idioma seria pior: prosa de venda ruim em documento assinado.
    const langMotor = normLang(lang === "hi" ? "en" : lang);

    // ── AGENDA: vagas reais ───────────────────────────────────────────────────────────────────
    if (acao === "horarios") {
      if (await rateLimited(request, env, "raio-x-hor", 20)) return json({ ok: false, erro: "rate" }, 429);
      const svc = await servicoDaCall(env, origin);
      if (svc.erro) return json({ ok: false, agenda_indisponivel: svc.erro });
      const r = await agenda(env, origin, { op: "availability", service: svc.nome, lang: langMotor });
      if (r.indisponivel) return json({ ok: false, agenda_indisponivel: r.indisponivel });
      return json({ ok: true, servico: svc.nome, slots: r.slots || [], mensagem: r.message || "" });
    }

    // ── AGENDA: marcar a call de 15 minutos ───────────────────────────────────────────────────
    if (acao === "marcar") {
      if (await rateLimited(request, env, "raio-x-marcar", 6)) return json({ ok: false, erro: "rate" }, 429);
      const quando = s(b.quando || b.when, 40);
      const nome = s(b.nome || b.name, 120);
      const contato = s(b.contato || b.contact, 160);
      if (!quando || !contato) return json({ ok: false, erro: "informe horário e contato" }, 400);
      const svc = await servicoDaCall(env, origin);
      if (svc.erro) return json({ ok: false, agenda_indisponivel: svc.erro });
      const r = await agenda(env, origin, { op: "book", service: svc.nome, when: quando, name: nome, contact: contato, lang: langMotor, channel: "web" });
      if (r.indisponivel) return json({ ok: false, agenda_indisponivel: r.indisponivel });
      // "ok" sem comprovante é promessa sem lastro (regra da casa): sem `ref`/`ok` da agenda, isto
      // NÃO virou horário marcado — e quem chamou precisa saber para não escrever "confirmado".
      const marcou = r.ok === true || !!r.ref;
      if (!marcou) return json({ ok: false, motivo: r.reason || "nao_marcou", mensagem: r.message || "" });
      return json({ ok: true, ref: r.ref || null, servico: svc.nome, mensagem: r.message || "" });
    }

    // ── GERAR O X-RAY ─────────────────────────────────────────────────────────────────────────
    if (acao !== "gerar") return json({ ok: false, erro: "ação desconhecida" }, 400);

    // TRAVA 2 — por IP.
    if (await rateLimited(request, env, "raio-x", 5, 3600)) return json({ ok: false, erro: "rate", mensagem: "muitos pedidos deste dispositivo — tente de novo em uma hora" }, 429);

    const dominio = canonizar(b.site);
    if (!dominio) return json({ ok: false, erro: "site_invalido" }, 400);
    const siteCanonico = `https://${dominio}`;
    const nome = s(b.nome || b.name, 120);
    const contato = s(b.contato || b.contact || b.email || b.telefone, 160);
    if (!contato) return json({ ok: false, erro: "sem_contato" }, 400);
    // Existindo ref, o lead (e a avaliação) NASCEM com dono. Não existindo, seguem públicos.
    const ref = refDoPedido(request, url, b);

    // O QUIZ — cada resposta com destino declarado. `dor` e `quem_atende` não viram número:
    // são contexto da call e ficam gravados no payload.
    const q = b.quiz && typeof b.quiz === "object" ? b.quiz : {};
    const declarado = {
      horas_abertas_semana: num(q.horas_abertas_semana),
      ligacoes_semana: num(q.ligacoes_semana),
      ticket_medio: num(q.ticket_medio),
      quem_atende: s(q.quem_atende, 40) || null,
      dor: s(q.dor, 400) || null,
      respondido_em: new Date().toISOString(),
      fonte: "quiz do Guileo X-Ray (/raio-x) — declarado pelo dono, não medido por nós",
    };

    // TRAVA 4 — IDEMPOTÊNCIA. Antes de gastar uma leitura, pergunta se já existe avaliação recente
    // deste domínio. Reaproveitar é o que impede dez pedidos do mesmo site virarem dez varreduras.
    let id = null, reaproveitado = false, avaliacao = null;
    const hist = await svcJson(env, "avaliacao_historico", { p_secret: env.INGEST_SECRET || "", p_site: siteCanonico });
    if (Array.isArray(hist) && hist.length) {
      const recente = hist.filter((h) => h && h.id && h.created_at)
        .sort((a, c) => new Date(c.created_at) - new Date(a.created_at))[0];
      if (recente && (Date.now() - new Date(recente.created_at).getTime()) < 7 * 864e5) {
        id = recente.id; reaproveitado = true;
      }
    }

    if (!id) {
      // TRAVA 3 — por domínio (só antes de uma varredura NOVA; reaproveitar não conta).
      if (await dominioEstourou(env, dominio)) return json({ ok: false, erro: "rate_dominio", mensagem: "este site já foi analisado várias vezes hoje" }, 429);

      const av = await avaliarNegocio({
        site: siteCanonico, env, negocio: s(b.negocio || b.business, 120), lang: langMotor, declarado,
      });
      if (!av.ok) return json({ ok: false, erro: "nao_deu_pra_ler", motivo: av.motivo });
      const salvo = await svcJson(env, "avaliacao_save", {
        p_secret: env.INGEST_SECRET || "",
        p_site: siteCanonico, p_business: av.business || s(b.negocio || b.business, 120), p_client_email: null,
        p_modo: av.modo, p_score: av.score_geral, p_payload: av,
        // dono real quando veio por link de vendedor; "raio-x-publico" só quando não veio.
        p_seller: ref || "raio-x-publico", p_contato: contato,
      });
      // sem id gravado não há link — e sem link não há entrega. Nunca devolver "ok" nesse caso.
      if (!salvo?.id) {
        await emitFailure(env, "xray_nao_gravou", "", `pedido público de ${dominio} avaliou mas não gravou`, { detalhe: salvo?.detalhe || salvo?.erro_http || "" });
        return json({ ok: false, erro: "nao_gravou" }, 500);
      }
      id = salvo.id; avaliacao = av;
    }

    // Reaproveitado: lê o que está GRAVADO para a tela de confirmação não inventar score nem
    // prometer um idioma que o relatório antigo não tem.
    if (reaproveitado) {
      const d = await svcJson(env, "avaliacao_get", { p_id: id, p_marcar: false });
      if (d && d.payload) avaliacao = d.payload;
    }

    const link = `${origin}/apresentacao/${id}`;

    // ── O LEAD ENTRA NO FUNIL QUE JÁ EXISTE ───────────────────────────────────────────────────
    // /api/lead é a porta única: gui_actions (feed do /admin) + CRM da Guileo + atribuição de
    // anúncio (cookie gui_attr, encaminhado aqui) + consentimento + speed-to-lead (a Gui liga).
    // Reencaminhar em vez de duplicar 100 linhas é o que garante que o 11º formulário não nasça
    // órfão — e é exatamente o motivo de a atribuição morar num cookie.
    let leadOk = false;
    try {
      const detalhes = [
        `X-Ray: ${link}`,
        declarado.quem_atende ? `quem atende hoje: ${declarado.quem_atende}` : "",
        declarado.ligacoes_semana ? `${declarado.ligacoes_semana} ligações/semana (declarado)` : "",
        declarado.ticket_medio ? `ticket declarado ${declarado.ticket_medio}` : "",
        declarado.dor ? `dor: ${declarado.dor}` : "",
      ].filter(Boolean).join(" · ");
      const r = await fetch(`${origin}/api/lead`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://guileoai.com",             // chamada interna: satisfaz o sameOrigin do irmão
          Cookie: request.headers.get("cookie") || "", // leva o gui_attr → o lead não nasce órfão
        },
        body: JSON.stringify({
          name: nome, contact: contato, business: s(b.negocio || b.business, 160),
          message: detalhes, source: "raio-x", lang: lang || langMotor, page: "/raio-x",
          // o wrapper de browser do App.jsx não alcança esta chamada (é servidor→servidor): sem
          // isto o "👤ref:" nunca chegaria ao details e o lead ficaria invisível pro vendedor.
          ...(ref ? { ref } : {}),
          score: avaliacao?.score_geral != null ? String(avaliacao.score_geral) : "",
          consent: b.consent !== false,
        }),
      });
      const j = await r.json().catch(() => ({}));
      leadOk = r.ok && j.ok !== false;
    } catch { leadOk = false; }
    // Lead perdido é dinheiro perdido, e "sucesso sem conferir" já custou caro nesta casa: se o
    // funil não confirmou, o Luis vê o evento no /admin com o link do relatório para recuperar.
    if (!leadOk) await emitFailure(env, "xray_lead_nao_entrou", "", `X-Ray gerado para ${dominio} mas o lead NÃO confirmou no funil`, { link, contato: contato.slice(0, 60) });

    return json({
      ok: true, id, link, reaproveitado, lead_no_funil: leadOk, ref: ref || null,
      score: avaliacao?.score_geral ?? null,
      lang_relatorio: avaliacao?.lang || langMotor,
      business: avaliacao?.business || "",
    });
  } catch (e) {
    return json({ ok: false, erro: "falha", detalhe: String(e).slice(0, 160) }, 500);
  }
}
