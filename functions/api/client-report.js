// Cloudflare Pages Function — GET/POST /api/client-report?token=DIGEST_TOKEN
// Weekly client report: for each real client, pulls the last 7 days of client_events
// and emails the owner-facing "Your Gui this week" report. Wired into the weekly cron Worker.
// Cliente com ZERO evento não recebe o relatório (relatório de zeros não é valor) — recebe o
// e-mail de GUI OCIOSA ("sua linha está encaminhada?"), no máximo 1× a cada 14 dias. Ver o
// comentário longo no laço: pular esse cliente era pular exatamente quem está prestes a sair.
// TEST: ?email=X limits to one client; ?to=Y sends to Y instead of the client, but ONLY
// if Y is an owner inbox (so we can safely preview by emailing ourselves).
import { json, isOwnerEmail, safeEq } from "../lib/guard.js";
import { weeklyReportEmail, valueBlock, guiIdleEmail } from "../lib/emailTemplates.js";
import { emitFailure } from "../lib/failure.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
// Owned project — where the call transcripts + per-call sentiment live (call_logs).
const SCHED_SB = "https://ynihodbknhjirkdogxby.supabase.co";
const SCHED_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

async function rpc(name, args) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  return r.ok ? await r.json() : null;
}

// Weekly call-sentiment summary for a client, from call_logs in the owned project.
// Returns null when off (no secret) or no rated calls — the template then hides the block.
async function callSentiment(env, email, sinceISO) {
  if (!env.SCHED_SECRET) return null;
  try {
    const r = await fetch(`${SCHED_SB}/rest/v1/rpc/get_call_logs`, {
      method: "POST",
      headers: { apikey: SCHED_ANON, Authorization: `Bearer ${SCHED_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: env.SCHED_SECRET, p_email: email, p_limit: 100 }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const calls = (Array.isArray(d?.calls) ? d.calls : []).filter((c) => c.created_at >= sinceISO);
    const rated = calls.filter((c) => ["positive", "neutral", "negative"].includes((c.sentiment || "").toLowerCase()));
    if (!rated.length) return null;
    const tally = rated.reduce((a, c) => { a[(c.sentiment).toLowerCase()]++; return a; }, { positive: 0, neutral: 0, negative: 0 });
    const durs = calls.map((c) => Number(c.duration_secs) || 0).filter(Boolean);
    return {
      total: rated.length,
      positive: tally.positive, neutral: tally.neutral, negative: tally.negative,
      happyPct: Math.round((tally.positive / rated.length) * 100),
      avgSecs: durs.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 0,
    };
  } catch { return null; }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDay = (d) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;

export async function onRequest(context) {
  const { request, env } = context;
  try {
    if (request.method !== "GET" && request.method !== "POST") return json({ error: "method" }, 405);
    const url = new URL(request.url);
    const tok = url.searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
    if (!env.DIGEST_TOKEN || !safeEq(tok, env.DIGEST_TOKEN)) return json({ error: "unauthorized" }, 401);
    if (!env.RESEND_API_KEY) return json({ error: "no mailer" }, 501);

    const onlyEmail = (url.searchParams.get("email") || "").trim().toLowerCase();
    const testTo = (url.searchParams.get("to") || "").trim();
    if (testTo && !isOwnerEmail(testTo, env)) return json({ error: "to must be an owner inbox" }, 401);

    const FROM = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";
    const now = new Date();
    const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sinceISO = since.toISOString();
    const weekLabel = `${fmtDay(since)} – ${fmtDay(now)}`;
    // Month-to-date window for the value block — the SAME client_events_since RPC takes p_since
    // as a parameter (no hard-coded 7 days server-side), so a second call with the 1st of the
    // month is all it needs. No new RPCs, no "week × weeks" extrapolation.
    const monthStartISO = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

    let clients = (await rpc("clients_list", { p_secret: env.INGEST_SECRET || "" })) || [];
    if (!Array.isArray(clients)) clients = [];
    if (onlyEmail) clients = clients.filter((c) => (c.client_email || "").toLowerCase() === onlyEmail);
    clients = clients.slice(0, 50);

    let reports = 0, skipped = 0, idle = 0;
    for (const c of clients) {
      const email = c.client_email;
      if (!email) { skipped++; continue; }

      const events = (await rpc("client_events_since", { p_secret: env.INGEST_SECRET || "", p_email: email, p_since: sinceISO })) || [];
      // ── O CLIENTE OCIOSO NÃO É "NADA A DIZER" (2026-08-25) ──────────────────────────────────
      // Este `continue` existia com a melhor das intenções ("sem evento, não enche a caixa dele") e
      // era exatamente ao contrário: o cliente com ZERO evento na semana é o de MAIOR risco de
      // churn — ou o encaminhamento da linha nunca foi ligado, ou ele desistiu em silêncio. O
      // relatório semanal pulava justamente quem precisava de um toque.
      // Continua NÃO mandando o relatório (relatório de zeros é humilhação, não valor): manda um
      // e-mail DIFERENTE, que pergunta a coisa certa — "a sua linha está encaminhada?" — com um
      // teste de 20 segundos.
      // TRAVA DE 14 DIAS por cliente, pela mesma `alarme_uma_vez` que o cron já usa em produção:
      // semanal seria cobrança, e cobrança semanal sobre silêncio empurra o churn em vez de evitá-lo.
      // Sem poder consultar a trava, NÃO manda (fail-closed): aqui o risco de spam é pior que o de
      // atrasar uma semana — a varredura roda toda segunda de novo.
      if (!Array.isArray(events) || events.length === 0) {
        skipped++;
        // CONTA INTERNA NÃO LEVA CUTUCADA (mesma marca que health-monitor.js respeita): sim@,
        // demo@ e a conta modelo passam semanas sem evento por projeto, e cutucá-las todo mês
        // treina a gente a ignorar este e-mail justamente quando ele for sobre um cliente real.
        if (c && c.internal === true) continue;
        try {
          const pode = await rpc("alarme_uma_vez", { p_secret: env.INGEST_SECRET || "", p_chave: `gui_ociosa:${email}`, p_minutos: 20160 });
          if (pode === true) {
            const prof = (await rpc("get_client_profile", { p_secret: env.INGEST_SECRET || "", p_email: email })) || {};
            const lgRaw = (prof.lang || "").toString().toLowerCase().slice(0, 2);
            const lg = ["pt", "es", "en", "hi"].includes(lgRaw) ? lgRaw : "en";
            const biz = prof.business_name || "";
            // NUNCA INVENTAR NÚMERO: só vai no e-mail o que o banco devolver de verdade.
            const num = await rpc("client_number_lookup", { p_secret: env.INGEST_SECRET || "", p_email: email });
            const tpl = guiIdleEmail({
              name: prof.owner || biz || email.split("@")[0], business: biz, lang: lg,
              agentName: prof.agent_name || "Gui", number: typeof num === "string" ? num : "",
            });
            const ir = await fetch("https://api.resend.com/emails", {
              method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ from: FROM, to: [testTo || email], subject: tpl.subject, html: tpl.html }),
            });
            // Checar o `ok`: um "avisei o ocioso" que a Resend recusou deixaria o cliente de maior
            // risco sem contato E com a trava de 14 dias queimada.
            if (ir.ok) idle++;
            else {
              // 🚨 REVISOR 2026-08-25: a trava de 14 dias já foi queimada ANTES do envio; se a
              // Resend falhar, o cliente mais frio da carteira fica duas semanas sem aviso e
              // ninguém sabe. Falha de envio aqui vira alarme ao dono (o padrão da própria onda).
              console.error(JSON.stringify({ gui_ociosa: email, resend: ir.status }));
              await emitFailure(env, "gui_ociosa_email_failed", email, `Resend ${ir.status} — trava de 14d já queimada`, {});
            }
          }
        } catch (e) { console.error(JSON.stringify({ gui_ociosa: email, erro: String(e).slice(0, 120) })); }
        continue;
      }

      const stats = {
        conversations: events.filter((e) => e.type === "call").length + events.filter((e) => e.type === "message").length,
        bookings: events.filter((e) => e.type === "booking").length,
        leads: events.filter((e) => e.type === "lead").length,
        messages: events.filter((e) => e.type === "message").length,
        revenue: events.reduce((sum, e) => sum + Number(e.amount || 0), 0),
      };
      const highlights = events.map((e) => e.summary).filter(Boolean).slice(0, 6);

      const profile = (await rpc("get_client_profile", { p_secret: env.INGEST_SECRET || "", p_email: email })) || {};
      // pt/es have full weeklyReportEmail copy; anything else (incl. hi) falls back to EN by design.
      const langRaw = (profile.lang || "").toString().toLowerCase().slice(0, 2);
      const lang = langRaw === "pt" ? "pt" : langRaw === "es" ? "es" : "en";
      const business = profile.business_name || "";
      const name = business || email.split("@")[0];

      const sentiment = await callSentiment(env, email, sinceISO);

      // 💰 MONTH-TO-DATE VALUE — read the REAL money spine via revenue_month (sums the
      // public.client_revenue ledger + crm_timeline gap-fill, in cents, excluding
      // cancelled/no-show). client_events is a marketing feed — the money the agent
      // actually collects/books lives in the ledger, so summing client_events yielded ~0.
      // Fallback (RPC not deployed yet → r.ok=false → null): legacy client_events sum, so
      // this degrades honestly instead of breaking. mEv is still needed for guiCost below.
      const REVENUE_TYPES = ["sale", "order", "invoice", "deposit", "booking"];
      const monthEvents = (await rpc("client_events_since", { p_secret: env.INGEST_SECRET || "", p_email: email, p_since: monthStartISO })) || [];
      const mEv = Array.isArray(monthEvents) ? monthEvents : [];
      const rev = await rpc("revenue_month", { p_secret: env.INGEST_SECRET || "", p_email: email, p_since: monthStartISO });
      const totalMonth = (rev && typeof rev.total_cents === "number")
        ? rev.total_cents / 100 // ledger is authoritative, stored in cents → dollars for valueBlock
        : mEv.filter((e) => REVENUE_TYPES.includes(e.type)).reduce((sum, e) => sum + Number(e.amount || 0), 0);
      // guiCost: the profile has no plan-price field, so NEVER guess — derive it from the month's
      // "payment" events (the exact amount they paid Guileo, ingested by stripe-webhook). If they
      // didn't pay this month, valueBlock omits the cost comparison and shows only the value.
      const guiCost = mEv.filter((e) => e.type === "payment").reduce((sum, e) => sum + Number(e.amount || 0), 0);

      // 🎁 REFERRALS — honestly skipped: referral leads (?ref= links) land in `gui_actions`
      // (functions/api/lead.js, details carry "👤ref:<slug>"), NOT in this client's
      // client_events, and gui_actions is insert-only for the anon key (RLS). Counting them
      // here would need a new read RPC — out of scope by design; they're visible in the owner
      // email + /admin feed already.

      // 📣 ANÚNCIOS DA SEMANA — o relatório não falava UMA palavra sobre o dinheiro que o cliente
      // investe em anúncio, que é metade do que ele paga. Agrega os últimos 7 dias do motor
      // (ads_roi). Best-effort: se a leitura falhar, `ads` fica null e a seção simplesmente não
      // aparece — nunca um zero, que ele leria como "o anúncio não deu nada".
      let ads = null;
      try {
        const roi = await rpc("ads_roi", { p_secret: env.INGEST_SECRET || "", p_email: email, p_days: 7 });
        const camps = (roi && Array.isArray(roi.campanhas)) ? roi.campanhas : [];
        const gasto = Number(roi?.total_gasto_cents || 0);
        if (gasto > 0) {
          // O `ads_roi` classifica CADA campanha em recebido / tabela / sem_valor de propósito, e
          // esta função jogava essa classificação fora — somava só `receita_cents` e o e-mail
          // imprimia o retorno em negrito como se fosse caixa realizado. Dois estragos:
          //   · estimativa (preço de tabela) apresentada como dinheiro que entrou;
          //   · agendamento SEM valor lançado somando zero → "cada $1 virou $0.00" → o dono corta
          //     a campanha certa por causa de um preço que ele não cadastrou.
          // Agora as três coisas viajam, e o template decide o que dizer. Corrigido 2026-08-11.
          const semValor = camps.reduce((n, c) => n + Number(c.agendamentos_sem_valor || 0), 0);
          const bases = new Set(camps.filter((c) => Number(c.gasto_cents) > 0).map((c) => c.receita_base).filter(Boolean));
          ads = {
            gasto_cents: gasto,
            receita_cents: camps.reduce((n, c) => n + Number(c.receita_cents || 0), 0),
            agendamentos: camps.reduce((n, c) => n + Number(c.agendamentos || 0), 0),
            agendamentos_sem_valor: semValor,
            // 'recebido' só quando TODA campanha com gasto foi paga de verdade; qualquer mistura
            // vira 'misto' e o e-mail avisa que parte é estimativa. Na dúvida, o rótulo mais fraco.
            receita_base: bases.size === 1 ? [...bases][0] : (bases.size > 1 ? "misto" : null),
          };
        }
      } catch { /* motor de anúncios ausente → relatório sai igual ao de antes */ }

      const { subject, html } = weeklyReportEmail({ name, business, lang, weekLabel, stats, highlights, sentiment, ads });

      // NOTE (owner goal): the "Meta do mês" booking goal lives client-side (portal localStorage +
      // the AUTH project's user_metadata kv mirror) — this function only has RPC access to the data
      // project, so the goal is NOT retrievable server-side. Honestly skipped here; the portal's
      // Overview shows goal progress the moment they land (which the button below takes them to).
      // 🎙️ "Hear my week" — a secondary pill under the main CTA that deep-links to
      // /portal?speak=weekly, where Gui speaks the weekly briefing aloud (~30s).
      const audioLabel = lang === "pt" ? "🎙️ Ouvir minha semana (30s)" : lang === "es" ? "🎙️ Escuchar mi semana (30s)" : "🎙️ Hear my week (30s)";
      const audioBtn = `<div align="center" style="margin-top:12px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td align="center" style="border-radius:999px;background:linear-gradient(180deg,rgba(216,199,155,0.16) 0%,rgba(185,168,120,0.10) 100%);border:1px solid rgba(216,199,155,0.40);"><a href="https://guileoai.com/portal?speak=weekly" style="display:inline-block;padding:11px 24px;font-family:'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:.2px;color:#D8C79B;text-decoration:none;border-radius:999px;">${audioLabel}</a></td></tr></table></div>`;
      // Insert right after the main "See my dashboard" CTA table (still inside its centered div).
      // MUST match weeklyReportEmail's t.cta per language exactly — it's the splice anchor.
      const ctaLabel = lang === "pt" ? "Ver meu painel →" : lang === "es" ? "Ver mi panel →" : "See my dashboard →";
      let htmlOut = html;
      const ci = htmlOut.indexOf(ctaLabel);
      if (ci >= 0) {
        const te = htmlOut.indexOf("</table>", ci);
        if (te >= 0) htmlOut = htmlOut.slice(0, te + 8) + audioBtn + htmlOut.slice(te + 8);
      }
      // 💰 Value block — same splice pattern as the audio pill: insert the month-to-date panel
      // just ABOVE the main CTA (before its centered wrapper div), so it reads as the last
      // stats panel. valueBlock() returns "" when totalMonth ≤ 0 → nothing to splice.
      const vb = valueBlock({ totalMonth, guiCost, lang });
      if (vb) {
        const ci2 = htmlOut.indexOf(ctaLabel);
        const di = ci2 >= 0 ? htmlOut.lastIndexOf('<div align="center">', ci2) : -1;
        if (di >= 0) htmlOut = htmlOut.slice(0, di) + vb + `<div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>` + htmlOut.slice(di);
      }

      const sr = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: [testTo || email], subject, html: htmlOut }),
      });
      if (sr.ok) reports++; else skipped++;
    }

    return json({ ok: true, reports, skipped, idle });
  } catch (e) {
    return json({ error: String(e).slice(0, 120) }, 500);
  }
}
