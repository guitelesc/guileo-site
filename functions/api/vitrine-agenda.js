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
//   { slug, op:"menu" }                                  → serviços reais do tenant
//   { slug, op:"horarios", servico, dia? }               → vagas REAIS do motor
//   { slug, op:"marcar", servico, quando, nome, telefone } → marca de verdade
//
// ⚠️ "marcar" devolve o COMPROVANTE (id da reserva) ou uma falha honesta. "ok" sem id é promessa
// sem lastro — foi assim que a agente já disse "marcado" sobre o vazio.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";

const s = (v, n = 200) => (v == null ? "" : v.toString().slice(0, n).trim());

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
    headers: { "Content-Type": "application/json", "x-guileo-secret": env.INGEST_SECRET || "" },
    body: JSON.stringify({ email: dono, ...corpo }),
  });

  try {
    if (op === "menu") {
      const r = await motor({ op: "lookup" });
      // ⚠️ PORTÃO DE STATUS ANTES DO FALLBACK (fallback.test.mjs cobra este).
      // `r.json().catch(()=>null)` só pega corpo ILEGÍVEL. Um 500 com corpo JSON passa
      // reto por `if (!d)` — e no "menu" isso virava `ok:true, servicos: []`: a vitrine
      // dizia "não temos serviços" quando o motor tinha caído. Erro tem que parecer erro.
      if (!r.ok) return json({ ok: false, error: `motor respondeu ${r.status}` }, 502);
      const d = await r.json().catch(() => null);
      if (!d) return json({ ok: false, error: "motor nao respondeu" }, 502);
      return json({ ok: true, servicos: d.services || d.servicos || [], profissionais: d.professionals || [] });
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
      const r = await motor({ op: "availability", service: servico });
      if (!r.ok) return json({ ok: false, error: `motor respondeu ${r.status}` }, 502);
      const d = await r.json().catch(() => null);
      if (!d) return json({ ok: false, error: "motor nao respondeu" }, 502);
      // Lista ausente NÃO é "sem vaga" — a tela precisa saber a diferença.
      if (!Array.isArray(d.slots)) return json({ ok: false, error: d.message || "nao consegui ler a agenda" }, 502);
      return json({ ok: true, slots: d.slots.slice(0, 12) });
    }
    if (op === "marcar") {
      const nome = s(b.nome, 120), tel = s(b.telefone, 40), servico = s(b.servico, 120), quando = s(b.quando, 60);
      if (!nome || !tel || !servico || !quando) return json({ ok: false, error: "faltam dados" }, 400);
      // ⚠️ OS NOMES DOS CAMPOS SÃO O CONTRATO (corrigido 2026-08-27). Este bloco mandava
      // `customer_name`/`customer_phone` — nomes que NÃO existem em agent-schedule.js, que lê
      // `b.name` e `b.contact`. O motor gravava a reserva com nome e contato VAZIOS: o horário
      // ficava preso na agenda e o negócio não tinha quem chamar. E como o motor devolvia um id
      // de verdade, o comprovante exigido logo abaixo passava e a tela dizia "agendado".
      // Comprovante certo sobre o campo errado é o pior tipo de falha: ela se parece com sucesso.
      // O contrato agora é travado por vitrine-agenda.test.mjs, que compara o que sai daqui
      // com o que o motor realmente lê.
      const r = await motor({ op: "book", service: servico, when: quando, name: nome, contact: tel });
      if (!r.ok) return json({ ok: false, error: `motor respondeu ${r.status}` }, 502);
      const d = await r.json().catch(() => null);
      const id = d && (d.appointment_id || d.id || d.booking_id);
      // 🚨 COMPROVANTE OU NADA.
      if (!d || d.ok !== true || !id) {
        return json({ ok: false, error: (d && (d.message || d.error)) || "a agenda recusou", slots: (d && d.slots) || null }, 409);
      }
      return json({ ok: true, id, quando: d.when || quando, servico });
    }
    return json({ ok: false, error: "op invalida" }, 400);
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 120) }, 502);
  }
}
