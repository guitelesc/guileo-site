// Cloudflare Pages Function — GET/POST /api/eval-report?token=DIGEST_TOKEN
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// O AVISO DO EVAL. Lê a última rodada gravada em `agent_evals` e manda UM e-mail para o dono com
// o que reprovou, o motivo escrito pelo juiz, e a conta contra a rodada anterior.
//
// POR QUE EXISTE (o defeito que ele conserta é humano, não de código)
// O eval já rodava toda noite e já gravava tudo. Só que "gravado" não é "sabido": o caso
// `voice-price-unknown-service` reprovou ONZE NOITES seguidas, com o motivo por extenso no
// `judge_notes` — "não inventou preço, mas não capturou o contato" — e ninguém leu, porque ler
// exigia abrir o /admin e procurar. Medição que depende de alguém ir olhar não é monitor: é
// arquivo morto. O Luis pediu "me avisa quando o eval rodar", e a resposta certa não é eu lembrar
// — é o servidor avisar todas as noites, para sempre, sem depender de nenhuma sessão minha.
//
// ⚠️ POR QUE ÀS 02h UTC E NÃO ÀS 00h: o eval tem DUAS chances (00h e 01h UTC), porque um tique
// perdido custava a noite inteira (aconteceu em 07/08, 13/08 e 14/08). Se o aviso saísse às 00h,
// numa noite em que a 1ª chance falhasse ele relataria a rodada de ONTEM como se fosse a de hoje —
// e um relatório que erra a data é pior que relatório nenhum, porque parece confiável.
// Às 02h as duas chances já passaram.
//
// ⚠️ E ELE SE RECUSA A MENTIR SOBRE A DATA: se a rodada mais recente tiver mais de `MAX_IDADE_H`,
// o e-mail sai dizendo que o eval NÃO RODOU, em vez de reenviar as notas de ontem com a data de
// hoje. Esse é o modo de falha que mais me pegou nesta plataforma: número velho lido como novo.
//
// IDEMPOTENTE: `ops_run_claim` (janela de 20h) garante um aviso por dia mesmo se o cron repetir.
import { json, safeEq } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";
import { evalReportEmail } from "../lib/emailTemplates.js";
import { emailsDoDonoMudos } from "../lib/avisarDono.js";
// ⚠️ O CONJUNTO DECLARADO — a única forma de saber que uma rodada foi PARCIAL. Sem isto o relatório
// só sabe contar o que achou, e "achei 4" é indistinguível de "existem 4". Foi assim que ele
// assinou "média 80,5" sobre 4 casos de 48 por duas semanas.
import { AGENT_EVAL_CASES } from "../../src/data/agentEvalCases.js";
import { VERTICAL_EVAL_CASES } from "../../src/data/verticalEvalCases.js";
import { ACTION_EVAL_CASES } from "../../src/data/actionEvalCases.js";

const TODOS_OS_CASOS = AGENT_EVAL_CASES.concat(VERTICAL_EVAL_CASES, ACTION_EVAL_CASES);

const MAX_IDADE_H = 6; // acima disso a rodada não é "de hoje" e o e-mail passa a dizer isso

// Destinatário: o dono. OWNER_EMAIL quando existir, senão o e-mail que sempre foi o da operação.
const paraODono = (env) => (env.OWNER_EMAIL || "smart@guileoai.com").toString().trim();

async function enviar(env, to, subject, html) {
  if (!env.RESEND_API_KEY) return { ok: false, motivo: "RESEND_API_KEY ausente" };
  if (await emailsDoDonoMudos(env)) return { ok: false, mudo: true, motivo: "emails_dono=off" };
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to, subject, html }),
    });
    // CHECAR O RETORNO: um 4xx da Resend (quota, domínio, destinatário) contava como enviado em
    // dois lugares desta plataforma antes de 11/08. "Disparei" não é "chegou".
    if (!r.ok) return { ok: false, motivo: `resend ${r.status} ${(await r.text().catch(() => "")).slice(0, 140)}` };
    return { ok: true };
  } catch (e) { return { ok: false, motivo: String(e).slice(0, 140) }; }
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const tok = url.searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
  if (!env.DIGEST_TOKEN || !safeEq(tok, env.DIGEST_TOKEN)) return json({ error: "unauthorized" }, 401);

  const seco = url.searchParams.get("seco") === "1"; // lê e devolve, sem mandar e-mail
  // ⚠️ O PADRÃO ERA `voice` — e isso, sozinho, escondia 42 dos 48 casos. O eval mede voz, texto,
  // suporte, review, os 13 verticais e as travas de dinheiro; o aviso noturno relatava UM agente e
  // chamava aquilo de "a rodada". Agora o padrão é a RODADA INTEIRA, e `?agente=` segue existindo
  // pra quem quiser recortar um só à mão.
  const agente = (url.searchParams.get("agente") || "").toString().slice(0, 20).trim();
  const rotuloAgente = agente || "todos os agentes";

  // 1) UM POR DIA. Sem a trava, o bloco horário do cron mandaria o mesmo aviso 24×.
  if (!seco) {
    try {
      const cr = await svcRpc(env, "ops_run_claim", { p_secret: env.INGEST_SECRET || "", p_kind: `eval-report-${agente || "todos"}`, p_hours: 20 });
      const cd = cr.ok ? await cr.json().catch(() => null) : null;
      if (cd === false || (cd && cd.ja_rodou_hoje)) return json({ ok: true, pulou: "ja_avisou_hoje" });
    } catch { /* sem a trava o pior caso é um aviso repetido — não bloqueia o aviso */ }
  }

  // 2) LEITURA. agent_evals_recent devolve as linhas mais novas; agrupo por run_id em memória
  //    porque é o run_id que define "uma rodada" (o run_at varia por linha dentro da mesma).
  const rr = await svcRpc(env, "agent_evals_recent", { p_secret: env.INGEST_SECRET || "", p_limit: 200 });
  if (!rr.ok) return json({ ok: false, erro: `agent_evals_recent ${rr.status}` }, 503);
  const linhas = await rr.json().catch(() => null);
  // ⚠️ `|| []` aqui viraria "nenhum caso reprovou" — o mesmo fallback que deixou três motores
  //    mortos rodando 96×/dia. Lista ausente é ERRO, não rodada limpa.
  if (!Array.isArray(linhas)) return json({ ok: false, erro: "agent_evals_recent não devolveu lista" }, 503);

  const doAgente = linhas.filter((l) => l && l.run_id && (!agente || l.agent === agente));
  if (!doAgente.length) return json({ ok: false, erro: `nenhuma linha para ${rotuloAgente}` }, 200);

  const porRun = new Map();
  for (const l of doAgente) {
    const g = porRun.get(l.run_id) || { run_id: l.run_id, quando: l.run_at, casos: [] };
    if (l.run_at && (!g.quando || l.run_at < g.quando)) g.quando = l.run_at;
    g.casos.push(l);
    porRun.set(l.run_id, g);
  }
  const rodadas = [...porRun.values()].sort((a, b) => String(b.quando).localeCompare(String(a.quando)));
  const atual = rodadas[0];
  const ant = rodadas[1] || null;

  const resumo = (r) => {
    if (!r) return null;
    const n = r.casos.length;
    const rep = r.casos.filter((c) => !c.passed).length;
    const media = n ? Math.round((r.casos.reduce((t, c) => t + (Number(c.score) || 0), 0) / n) * 10) / 10 : 0;
    return { total: n, reprovados: rep, media, quando: r.quando };
  };
  const a = resumo(atual), b = resumo(ant);

  // 3) A RODADA É DE HOJE? Se não for, o e-mail muda de assunto em vez de fingir.
  const idadeH = atual.quando ? (Date.now() - new Date(atual.quando).getTime()) / 3600000 : 999;
  const velha = idadeH > MAX_IDADE_H;

  const fmtNY = (iso) => {
    try { return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/New_York", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
    catch { return String(iso || "").slice(0, 16); }
  };

  const casos = atual.casos.map((c) => ({
    id: c.case_id, passou: !!c.passed, nota: c.score,
    motivo: c.judge_notes || "(o juiz não escreveu motivo)",
  })).sort((x, y) => Number(x.passou) - Number(y.passou) || (x.nota - y.nota));

  // ── COBERTURA: o que o conjunto declara menos o que esta rodada tocou ────────────────────────
  // Nominal, não estatístico: eu quero os IDs. "45 casos não medidos" manda investigar; a LISTA
  // manda consertar — e mostra na hora se o que faltou foi o fim do conjunto (corrente truncada) ou
  // casos espalhados (pulados por falta de chave, que é outro problema).
  const declarados = TODOS_OS_CASOS.filter((c) => c && c.id && (!agente || c.agent === agente));
  const medidos = new Set(atual.casos.map((c) => c.case_id));
  const naoMedidos = declarados.map((c) => c.id).filter((id) => !medidos.has(id));

  const { subject, html } = evalReportEmail({
    dateLabel: fmtNY(atual.quando),
    quandoRodou: fmtNY(atual.quando) + " (NY)",
    agente: rotuloAgente, media: a.media, total: a.total, reprovados: a.reprovados, casos,
    esperado: declarados.length, naoMedidos,
    anterior: b ? { total: b.total, reprovados: b.reprovados, media: b.media } : null,
    lang: "pt",
  });

  // O ASSUNTO AVISA QUANDO O DADO É VELHO. Sem isto, uma noite em que o eval não rodasse mandaria
  // as notas de ontem com cara de novidade — e eu quase cometi exatamente esse erro lendo à mão.
  const assunto = velha
    ? `⚠️ Gui · o eval NÃO rodou (última: ${fmtNY(atual.quando)})`
    : subject;

  const out = {
    ok: true, agente: rotuloAgente, run_id: atual.run_id, quando_ny: fmtNY(atual.quando),
    cobertura: `${a.total}/${declarados.length}`, nao_medidos: naoMedidos,
    idade_horas: Math.round(idadeH * 10) / 10, rodada_de_hoje: !velha,
    atual: a, anterior: b,
    reprovados: casos.filter((c) => !c.passou).map((c) => ({ id: c.id, nota: c.nota })),
    assunto,
  };
  if (seco) return json(out);

  const env_ = await enviar(env, paraODono(env), assunto, html);
  out.email = env_.ok ? "enviado" : `falhou: ${env_.motivo}`;
  return json(out, env_.ok ? 200 : 503);
}
