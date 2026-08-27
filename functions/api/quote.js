// Cloudflare Pages Function — POST /api/quote  (ORÇAMENTO DO VENDEDOR, persistido + link público)
//
// POR QUE EXISTE: o orçamento do /vendedor não existia depois que a aba fechava. A única saída era
// /api/quote-email, que manda o documento PRO PRÓPRIO VENDEDOR (modelo forward) — o cliente nunca
// recebia link nenhum e nada ficava gravado. Sem persistência não há follow-up ("mandei terça, ele
// abriu?"), não há "aceitar" e não há número de orçamento aberto. Este endpoint é a espinha que o
// contrato (/api/contract) já tinha, replicada para o orçamento.
//
// AUTH — duas naturezas, de propósito (mesmo desenho de /api/contract):
//   • save/list  → SESSÃO ASSINADA do vendedor (sid HMAC, functions/lib/sellerSession.js). O e-mail
//     usado como escopo é o QUE ELE ASSINOU; o e-mail do corpo é ignorado de propósito — foi
//     confiar no corpo que transformou /api/quote-email num relé de e-mail de marca.
//   • public/accept → SEM sessão. O token do orçamento É a capacidade (o cliente não tem login).
//
// HONESTIDADE: `ok` só sai com COMPROVANTE. Gravou → devolve id E token; sem eles é 502 com motivo.
// Falha de leitura NUNCA vira lista vazia ("nenhum orçamento" faz o vendedor refazer tudo).
import { json, sameOrigin, rateLimited } from "../lib/guard.js";
import { verifySession } from "../lib/sellerSession.js";
import { quoteAcceptedSellerEmail } from "../lib/emailTemplates.js";
import { emitFailure } from "../lib/failure.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
  method: "POST",
  headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const s = (v, n) => (v == null ? "" : v.toString().slice(0, n));

// Total em centavos SÓ quando dá pra derivar com segurança do texto ("$1,500/mês" → 150000).
// Não deu? devolve 0 e o rótulo textual continua sendo a verdade exibida. Número chutado em
// documento de preço é a falha mais cara deste repo (preço-âncora inventado numa ligação).
function centavos(txt) {
  const m = s(txt, 40).replace(/[^0-9.,]/g, "");
  if (!m) return 0;
  // "1,500.00" (US) e "1.500,00" (BR): o ÚLTIMO separador manda quando ele tem 2 dígitos depois.
  let n = m;
  if (/[.,]\d{2}$/.test(n)) { const sep = n.slice(-3, -2); n = n.replace(new RegExp(`[^0-9${sep === "." ? "." : ","}]`, "g"), "").replace(",", "."); }
  else n = n.replace(/[.,]/g, "");
  const f = Number.parseFloat(n);
  return Number.isFinite(f) && f > 0 && f < 100000000 ? Math.round(f * 100) : 0;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (!sameOrigin(request)) return json({ error: "forbidden" }, 403);
    if (await rateLimited(request, env, "quote", 40)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const action = s(b.action, 20) || "list";
    // 🚨 GATE CORRIGIDO NA INTEGRAÇÃO (2026-08-25): o desenho original apontava para
    // _gui_sched_ok/SCHED_SECRET, mas essa helper NÃO existe no banco vivo (morava num db/
    // nunca aplicado — a lição "criar ≠ executar" de novo). O padrão real de todos os
    // seller_* é o literal INGEST, e as RPCs foram reaplicadas nele.
    const secret = env.INGEST_SECRET || "";
    if (!secret) return json({ ok: false, erro: "INGEST_SECRET ausente no ambiente" }, 500);

    // ── PÚBLICO (token de capacidade) — o cliente abre o orçamento, sem login ──────────────────
    if (action === "public") {
      const token = s(b.token, 120);
      if (token.length < 24) return json({ ok: false, motivo: "link_invalido" }, 400);
      const r = await rpc("seller_quote_by_token", { p_token: token });
      if (!r.ok) return json({ ok: false, motivo: "indisponivel", erro: `banco respondeu ${r.status} (cole db/seller_quotes.sql)` }, 502);
      const doc = await r.json().catch(() => null);
      if (!doc || typeof doc !== "object") return json({ ok: true, ready: true, doc: null, motivo: "nao_encontrado" });
      // "visto" é best-effort: falhar em carimbar NUNCA pode impedir o cliente de ler a proposta.
      try { await rpc("seller_quote_mark_viewed", { p_token: token }); } catch { /* leitura vale mais */ }
      return json({ ok: true, ready: true, doc });
    }

    if (action === "accept") {
      const token = s(b.token, 120);
      const nome = s(b.nome || b.name, 120).trim();
      if (token.length < 24) return json({ ok: false, motivo: "link_invalido" }, 400);
      if (!nome) return json({ ok: false, motivo: "nome_obrigatorio" }, 400);
      const ip = (request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "").split(",")[0].trim();
      const r = await rpc("seller_quote_accept", { p_token: token, p_name: nome, p_ip: ip });
      // ⚠️ A RECUSA PRECISA TER MOTIVO E STATUS (lição da página de assinatura): banco fora do ar
      // devolvendo 200 mudo é indistinguível de "link inválido", e a tela reage igual aos dois —
      // no exato instante em que o cliente diz sim.
      if (!r.ok) return json({ ok: false, aceito: false, motivo: "indisponivel" }, 502);
      const rec = await r.json().catch(() => null);
      if (!rec || rec.ok !== true) return json({ ok: true, aceito: false, motivo: rec?.motivo || "link_invalido_ou_ja_aceito" });

      // ═══ AVISAR O VENDEDOR (revisor 2026-08-25, achado #1) ═══════════════════════════════
      // A página pública promete ao cliente, nos 4 idiomas: "seu contato da Guileo já foi
      // avisado". Ninguém era avisado — o vendedor só descobria abrindo o hub, e uma venda
      // ACEITA esfriava em silêncio com a plataforma afirmando o contrário. O recibo da RPC já
      // trazia `vendedor`/`cliente`/`total` justamente "pra avisar quem precisa saber".
      // Best-effort: falhar o e-mail não pode desfazer um aceite que já está gravado — mas
      // falhar CALADO também não, então falha vira alarme ao dono.
      const avisar = async () => {
        try {
          if (!env.RESEND_API_KEY || !rec.vendedor) return;
          const { subject, html } = quoteAcceptedSellerEmail({
            sellerName: "", clientName: rec.cliente || rec.assinante || "", total: rec.total || "",
            quoteUrl: new URL(`/orcamento/${token}`, request.url).toString(), lang: "pt",
          });
          const er = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [rec.vendedor], subject, html }),
          });
          if (!er.ok) {
            await emitFailure(env, "quote_aceito_aviso_nao_saiu", rec.vendedor,
              `orçamento ACEITO (${rec.total || "?"}) e o aviso não saiu (HTTP ${er.status}) — ligue pro cliente`,
              { quote_id: rec.id }).catch(() => {});
          }
        } catch { /* aceite já gravado; o alarme acima é a rede */ }
      };
      if (context && typeof context.waitUntil === "function") context.waitUntil(avisar()); else await avisar();

      return json({ ok: true, aceito: true, id: rec.id, quando: rec.quando, assinante: rec.assinante });
    }

    // ── VENDEDOR (sessão assinada) ────────────────────────────────────────────────────────────
    const email = (await verifySession(env, s(b.sid, 400)).catch(() => null)) || "";
    if (!email) return json({ error: "unauthorized", motivo: "faça login de novo pra salvar orçamentos" }, 401);

    if (action === "save") {
      const itens = Array.isArray(b.itens) ? b.itens.slice(0, 40).map((x) => s(x, 300)) : [];
      const total = s(b.total, 60);
      const r = await rpc("seller_quote_upsert", {
        p_secret: secret, p_email: email, p_id: s(b.id, 40) || null,
        p_client_name: s(b.client_name, 120), p_client_email: s(b.client_email, 160), p_client_phone: s(b.client_phone, 40),
        p_itens: itens, p_total: total, p_total_cents: centavos(total),
        p_currency: s(b.currency, 8) || "USD", p_status: s(b.status, 16) || "sent",
      });
      if (!r.ok) {
        const cru = await r.text().catch(() => "");
        return json({ ok: false, erro: "seller_quote_upsert recusou (cole db/seller_quotes.sql)", cru: cru.slice(0, 300) }, 502);
      }
      const d = await r.json().catch(() => null);
      // 🚨 COMPROVANTE: sem id E token não houve gravação. "ok" aqui em cima de um banco vazio é
      // exatamente a promessa sem lastro que este repo já pagou caro pra aprender.
      if (!d || d.ok !== true || typeof d.id !== "string" || typeof d.token !== "string" || d.token.length < 24) {
        return json({ ok: false, erro: "o banco não devolveu id/token — não considero salvo", cru: JSON.stringify(d || null).slice(0, 200) }, 502);
      }
      return json({ ok: true, id: d.id, token: d.token, url: `/orcamento/${d.token}` });
    }

    // default: list — os orçamentos DESTE vendedor
    const r = await rpc("seller_quote_list", { p_secret: secret, p_email: email, p_limit: Math.min(Math.max(parseInt(b.limit, 10) || 100, 1), 500) });
    if (!r.ok) return json({ ok: false, motivo: `banco respondeu ${r.status} (cole db/seller_quotes.sql)` }, 502);
    const rows = await r.json().catch(() => null);
    // lista ausente é ERRO, não "nenhum orçamento" — `|| []` aqui apagaria o pipeline na tela.
    if (!Array.isArray(rows)) return json({ ok: false, motivo: "resposta do banco não é lista" }, 502);
    return json({ ok: true, ready: true, count: rows.length, rows });
  } catch (e) {
    return json({ error: String(e).slice(0, 160) }, 400);
  }
}
