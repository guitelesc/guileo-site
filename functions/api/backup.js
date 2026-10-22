// Cloudflare Pages Function — GET/POST /api/backup?token=DIGEST_TOKEN
// Daily data safety: pulls ALL leads (gui_actions) + ALL real client events and emails
// the owner a CSV snapshot, so even a worst-case database loss costs at most one day of data.
//
// ── 🚨 ÓRFÃO DESDE QUE NASCEU, E MENTIA DUAS VEZES (2026-09-09) ────────────────────────────────
// 1. O cabeçalho dizia «wired into the guileo-digest-cron Worker» — NENHUM cron jamais chamou esta
//    rota. A cópia de segurança "diária" nunca saiu uma única vez. Agora é alvo do cron-tick no
//    bloco das 13h/14h.
// 2. `leadsR.ok ? json : []` — se `admin_actions` recusasse o token (ou o banco caísse), o backup
//    saía com ZERO linhas e assunto "0 leads · 0 eventos", e respondia `ok:true`. Um backup vazio
//    que se apresenta como backup é pior que nenhum: o dia da perda seria o dia da descoberta.
//    Agora leitura falha = `ok:false` + 502 + aviso ao dono (avisarDono), nunca anexo vazio.
// 3. "ok" sem comprovante: a rota devolvia `{ok:true}` sem o id da Resend. Agora devolve o RECIBO
//    (id do e-mail + id do evento gravado no feed do /admin) — `ok` sem recibo é promessa sem lastro.
//
// PORTÃO: DIGEST_TOKEN (o mesmo que o cron-tick passa a todos os alvos). `ADMIN_TOKEN` continua
// sendo o segredo das RPCs `admin_*` do banco — é a credencial do DADO, não do endpoint; sem ele a
// leitura falha em voz alta (não em silêncio, como antes).
// DEDUPE: `ops_run_claim('backup', 20h)` — a 2ª chance do cron (14h) responde `ja_rodou_hoje` sem
// mandar um segundo anexo. Trava ilegível (sem service_role) NÃO impede o backup: um anexo
// repetido é barato; um backup que não sai por causa do próprio anti-spam não é.
import { json, safeEq } from "../lib/guard.js";
import { svcJson } from "../lib/sb.js";
import { avisarDono, donoEmail, TENANT_PLATAFORMA } from "../lib/avisarDono.js";

const SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

// A mesma frase do lifecycle.js, de propósito: o dono lê um motivo só para o mesmo conserto.
const MOTIVO_ADMIN_TOKEN = "ADMIN_TOKEN ausente ou diferente da senha do /admin (Cloudflare → Variables)";

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
const toCsv = (rows, cols) => [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n");

// Lê uma RPC admin_* e DIZ se leu: { ok, rows } ou { ok:false, motivo }. Nunca "[]" por falha.
async function lerAdmin(env, fn) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: env.ADMIN_TOKEN || "" }),
      signal: AbortSignal.timeout(15000),
    });
    // (2026-09-22) O motivo agora é o que o dono consegue CONSERTAR. Antes, com o token presente
    // mas ERRADO, saía só "admin_actions http 403" — verdadeiro e inútil: foi exatamente esse caso
    // (token diferente da senha do /admin) que deixou o lifecycle parado 12 dias. 401/403 aqui é
    // o banco recusando a credencial (errcode 28000), não o banco fora do ar.
    if (!r.ok) {
      const recusou = r.status === 401 || r.status === 403 || !env.ADMIN_TOKEN;
      return { ok: false, recusou, motivo: recusou ? `${fn} http ${r.status} — ${MOTIVO_ADMIN_TOKEN}` : `${fn} http ${r.status}` };
    }
    const rows = await r.json().catch(() => null);
    if (!Array.isArray(rows)) return { ok: false, motivo: `${fn} respondeu algo que não é lista` };
    return { ok: true, rows };
  } catch (e) { return { ok: false, motivo: `${fn}: ${String(e).slice(0, 120)}` }; }
}

export async function onRequest(context) {
  const { request, env } = context;
  try {
    if (request.method !== "GET" && request.method !== "POST") return json({ error: "method" }, 405);
    const url = new URL(request.url);
    const tok = url.searchParams.get("token") || request.headers.get("x-guileo-secret") || "";
    if (!env.DIGEST_TOKEN || !safeEq(tok, env.DIGEST_TOKEN)) return json({ error: "unauthorized" }, 401);
    if (!env.RESEND_API_KEY) return json({ ok: false, error: "no mailer" }, 501);

    // Reserva do dia — antes de ler qualquer coisa (ler o banco inteiro duas vezes é o desperdício
    // que a trava evita). `?forcar=1` pula a trava para prova manual.
    let trava = "não consultada";
    if (url.searchParams.get("forcar") !== "1" && env.INGEST_SECRET) {
      const c = await svcJson(env, "ops_run_claim", { p_secret: env.INGEST_SECRET, p_kind: "backup", p_hours: 20 });
      if (c === false) return json({ ok: true, pulou: "ja_rodou_hoje", trava: "ops_run_claim('backup', 20h) devolveu false" });
      trava = c === true ? "reservado" : `ilegível (${(c && (c.detalhe || c.erro_http)) || "?"}) — backup sai mesmo assim`;
    }

    const [leadsL, eventsL] = await Promise.all([lerAdmin(env, "admin_actions"), lerAdmin(env, "admin_all_events")]);
    if (!leadsL.ok || !eventsL.ok) {
      // As duas leituras usam o MESMO token: recusadas juntas, o motivo sairia duplicado e
      // estouraria o resumo do aviso. Uma frase só, com os nomes das duas funções.
      const falhas = [leadsL, eventsL].filter((x) => !x.ok);
      const motivo = falhas.every((x) => x.recusou)
        ? `${MOTIVO_ADMIN_TOKEN} — recusado em ${[!leadsL.ok && "admin_actions", !eventsL.ok && "admin_all_events"].filter(Boolean).join(" e ")}`
        : falhas.map((x) => x.motivo).join(" · ");
      const aviso = await avisarDono(env, {
        kind: "backup_falhou", summary: `o backup diário NÃO saiu — não consegui ler o banco: ${motivo}`,
        cliente: "Guileo (backup)", link: "https://guileoai.com/admin",
      });
      return json({ ok: false, error: `não consegui ler: ${motivo}`, trava, aviso }, 503);
    }
    const leads = leadsL.rows, events = eventsL.rows;

    const leadsCsv = toCsv(leads, ["created_at", "action", "name", "contact", "business", "industry", "source", "details"]);
    const eventsCsv = toCsv(events, ["created_at", "client_email", "type", "channel", "summary", "amount"]);
    const day = new Date().toISOString().slice(0, 10);
    // (2026-10-11) O Luis pediu: "para os e-mails da Guileo, está incomodando". O backup é a cópia de
    // segurança — não pode parar —, mas não precisa cair no Gmail pessoal todo dia. Vai para a caixa
    // da plataforma (smart@guileoai.com), onde fica guardado sem incomodar. BACKUP_TO sobrescreve.
    const OWNER = (env.BACKUP_TO || TENANT_PLATAFORMA).toString().split(",")[0].trim().toLowerCase();
    const FROM = env.EMAIL_FROM || "Guileo <noreply@guileoai.com>";

    const sr = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM, to: [OWNER],
        subject: `🗄️ Guileo backup diário · ${day} · ${leads.length} leads · ${events.length} eventos`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:520px"><h2 style="color:#3E9468;margin:0 0 6px">Backup diário ✓</h2><p style="color:#888;margin:0 0 12px">${day} — ${leads.length} leads e ${events.length} eventos reais em anexo (CSV). Guarda este email: é a sua cópia de segurança.</p></div>`,
        attachments: [
          { filename: `guileo-leads-${day}.csv`, content: btoa(unescape(encodeURIComponent(leadsCsv))) },
          { filename: `guileo-eventos-${day}.csv`, content: btoa(unescape(encodeURIComponent(eventsCsv))) },
        ],
      }),
    });
    const sd = await sr.json().catch(() => ({}));
    if (!sr.ok) {
      const aviso = await avisarDono(env, {
        kind: "backup_falhou", summary: `o backup diário NÃO saiu — a Resend recusou o e-mail (http ${sr.status}: ${(sd && sd.message) || "?"})`,
        cliente: "Guileo (backup)",
      });
      return json({ ok: false, error: `mailer ${sr.status}`, motivo: (sd && sd.message) || "", leads: leads.length, events: events.length, trava, aviso }, 503);
    }

    // O COMPROVANTE: id da Resend + a linha no feed do /admin (type "backup") com o mesmo id.
    // Se o feed não gravar, o e-mail já saiu — então o `ok` fica, e `feed.ok:false` diz o porquê.
    let feed = { ok: false, motivo: "sem INGEST_SECRET" };
    if (env.INGEST_SECRET) {
      const fr = await svcJson(env, "ingest_client_event", {
        p_secret: env.INGEST_SECRET, p_email: TENANT_PLATAFORMA, p_type: "backup", p_channel: "system",
        p_summary: `🗄️ backup ${day} enviado para ${OWNER} — ${leads.length} leads · ${events.length} eventos · resend ${sd.id || "?"}`.slice(0, 300),
        p_amount: 0, p_payload: { resend_id: sd.id || null, leads: leads.length, events: events.length, day },
      });
      feed = (fr && typeof fr === "object" && fr.ok === false) ? { ok: false, motivo: `http ${fr.erro_http || "?"} ${fr.detalhe || ""}`.trim() } : { ok: true, id: fr };
    }
    return json({ ok: true, leads: leads.length, events: events.length, trava, recibo: { resend_id: sd.id || null, para: OWNER, feed } });
  } catch (e) {
    return json({ ok: false, error: String(e).slice(0, 120) }, 500);
  }
}
