// Cloudflare Pages Function — POST /api/orcamentos  (MOTOR DE ORÇAMENTO no painel do cliente)
// ─────────────────────────────────────────────────────────────────────────────────────────────
// POR QUE EXISTE (incidente 2026-09-28): a tela Orçamentos da Central (src/portal/QuoteEngine.jsx)
// chamava POST /api/orcamento — SINGULAR — com actions `fila`/`config`/`decidir`. Só que
// /api/orcamento é o teto de TOKENS do agente, gated por senha do /admin: todo tenant levava 401
// e a tela do módulo de US$ 1.800/mês nunca leu uma linha real. O motor existia inteiro no banco
// (db/quote_engine.sql: quote_fila · quote_config · quote_decidir · quote_list ·
// quote_marcar_enviado) e NENHUM endpoint o chamava — "criar ≠ executar" outra vez.
// Este arquivo é o endpoint que faltava. O /api/orcamento do admin fica intocado.
//
// GATE: Tenant HTTP — amarra e-mail ↔ chave de conexão via get_client_data (padrão
// noshow-radar.js). O literal INGEST fica só no servidor; o e-mail que escopa TODA RPC é o que
// passou no portão, nunca outro campo do corpo. UUID sozinho não autoriza nada: quote_decidir
// filtra por (id, client_email).
//
//   POST { token, email, action:"fila",   lang? }                     -> { ok, ready, count, fila:[quote] }
//   POST { token, email, action:"lista",  limite?, lang? }            -> { ok, ready, count, lista:[quote] }
//   POST { token, email, action:"config", teto_cents?, auto_enviar? } -> { ok, ready, config:{teto_cents, auto_enviar, updated_at} }
//   POST { token, email, action:"decidir", id, aprovar, motivo? }     -> { ok, decidido, status, enviado, marcado, canal, bloqueios:[{canal,motivo}] }
//   POST { token, email, action:"reenviar", id }                      -> { ok, enviado, marcado, canal, bloqueios }
//
// HONESTIDADE: falha de leitura NUNCA vira lista vazia (`ready:false` + `note`); "enviado" só sai
// com o provedor de e-mail aceitando; e o `token` do link do cliente final NUNCA volta pra tela.
// Falha nossa de upstream sai 503, não 502: a Cloudflare troca o corpo de todo 502 por texto puro
// "error code: 502" e o motivo nunca chega na tela (provado em /api/support, 2026-09-28).
import { json, rateLimited } from "../lib/guard.js";
import { svcRpc } from "../lib/sb.js";
import { quoteToCustomerEmail } from "../lib/emailTemplates.js";
import { brandFor } from "../lib/clientBrand.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ehEmail = (s) => /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(String(s || "").trim());
export const idioma = (v) => { const l = String(v || "").toLowerCase().slice(0, 2); return ["en", "pt", "es", "hi"].includes(l) ? l : ""; };

// Frases que chegam na tela do CLIENTE — nos 4 idiomas da interface, padrão en. Nenhuma delas
// carrega instrução de engenharia ("cole o SQL", "set ENV"): isso vai em `detalhe_tecnico`.
const FRASES = {
  indisponivel: {
    en: "The quote engine is not available right now. Please try again in a moment.",
    pt: "O motor de orçamento não está disponível agora. Tente de novo em instantes.",
    es: "El motor de presupuestos no está disponible ahora. Inténtelo de nuevo en un momento.",
    hi: "कोटेशन इंजन अभी उपलब्ध नहीं है। कृपया थोड़ी देर में फिर कोशिश करें।",
  },
  fora_da_fila: {
    en: "This quote is no longer waiting for approval.",
    pt: "Este orçamento não está mais aguardando aprovação.",
    es: "Este presupuesto ya no está esperando aprobación.",
    hi: "यह कोटेशन अब स्वीकृति की प्रतीक्षा में नहीं है।",
  },
  id_invalido: { en: "Invalid quote id.", pt: "Identificador de orçamento inválido.", es: "Identificador de presupuesto no válido.", hi: "कोटेशन आईडी अमान्य है।" },
  valor_invalido: { en: "Enter a valid amount.", pt: "Informe um valor válido.", es: "Introduzca un importe válido.", hi: "कृपया मान्य राशि दर्ज करें।" },
  sem_email: {
    en: "this customer has no email on file",
    pt: "este cliente não tem e-mail no cadastro",
    es: "este cliente no tiene correo registrado",
    hi: "इस ग्राहक का ईमेल दर्ज नहीं है",
  },
  email_desligado: {
    en: "email sending is not set up for this account yet",
    pt: "o envio de e-mail ainda não está ligado para esta conta",
    es: "el envío de correo aún no está activado para esta cuenta",
    hi: "इस खाते के लिए ईमेल भेजना अभी चालू नहीं है",
  },
  email_recusado: {
    en: "the email provider refused the message",
    pt: "o provedor de e-mail recusou a mensagem",
    es: "el proveedor de correo rechazó el mensaje",
    hi: "ईमेल प्रदाता ने संदेश अस्वीकार कर दिया",
  },
  nao_aprovado: {
    en: "Only an approved quote that has not been sent yet can be re-sent.",
    pt: "Só dá para reenviar um orçamento aprovado que ainda não saiu.",
    es: "Solo se puede reenviar un presupuesto aprobado que aún no se envió.",
    hi: "केवल वही स्वीकृत कोटेशन दोबारा भेजा जा सकता है जो अभी तक नहीं भेजा गया।",
  },
};
export const frase = (k, lang) => (FRASES[k] && (FRASES[k][lang] || FRASES[k].en)) || "";

// O `token` da linha é a CAPACIDADE do link do cliente final (quote_por_token aceita só ele).
// Devolver pra tela do dono não ganha nada e espalha um segredo por log/print — sai daqui.
export const semToken = (q) => { if (!q || typeof q !== "object") return q; const c = { ...q }; delete c.token; return c; };

async function ler(env, nome, corpo) {
  try {
    const r = await svcRpc(env, nome, corpo);
    const texto = await r.text();
    let d = null; try { d = texto ? JSON.parse(texto) : null; } catch { d = null; }
    return { http: r.status, ok: r.ok, d, cru: texto.slice(0, 240) };
  } catch (e) { return { http: 0, ok: false, d: null, cru: String(e).slice(0, 160) }; }
}

// Envia o orçamento na MARCA DO NEGÓCIO. Devolve recibo — `enviado` só com o provedor aceitando
// (r.ok), e mesmo assim isso é "aceito pelo provedor", não "chegou" (ver lib/comprovante.js).
async function enviar(env, tenant, q, lang) {
  const bloqueios = [];
  const para = String(q.customer_email || "").trim();
  if (!ehEmail(para)) { bloqueios.push({ canal: "email", motivo: frase("sem_email", lang) }); return { enviado: false, canal: null, bloqueios }; }
  if (!env.RESEND_API_KEY) { bloqueios.push({ canal: "email", motivo: frase("email_desligado", lang), detalhe_tecnico: "RESEND_API_KEY ausente" }); return { enviado: false, canal: null, bloqueios }; }
  try {
    const brand = await brandFor(env, tenant).catch(() => null);
    // Idioma do E-MAIL = idioma do NEGÓCIO (quem lê é o cliente dele), não o da tela do dono.
    const lg = idioma(brand && brand.lang) || lang || "en";
    // `link` vazio de propósito: ainda não existe página pública para o token deste motor
    // (/orcamento/:token lê seller_quotes, outra tabela). Botão apontando pra 404 seria promessa
    // sem lastro — o e-mail sai sem CTA e convida a responder.
    const { subject, html } = quoteToCustomerEmail({
      brand, customerName: q.customer_name || "", resumo: q.resumo || "",
      itens: Array.isArray(q.itens) ? q.itens : [], totalCents: q.total_cents, moeda: q.moeda || "usd", link: "", lang: lg,
    });
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: para, reply_to: tenant, subject, html }),
    });
    if (!r.ok) { bloqueios.push({ canal: "email", motivo: frase("email_recusado", lang), detalhe_tecnico: `Resend HTTP ${r.status}` }); return { enviado: false, canal: null, bloqueios }; }
    return { enviado: true, canal: "email", bloqueios, entrega_confirmada: false };
  } catch (e) {
    bloqueios.push({ canal: "email", motivo: frase("email_recusado", lang), detalhe_tecnico: String(e).slice(0, 120) });
    return { enviado: false, canal: null, bloqueios };
  }
}

// Carimba `enviado` no banco. Falhar aqui NÃO desfaz o envio (o e-mail já saiu) — por isso a
// resposta separa `enviado` de `marcado` e a tela mostra "registro pendente".
async function marcar(env, S, id, canal) {
  const m = await ler(env, "quote_marcar_enviado", { p_secret: S, p_id: id, p_canal: canal });
  return !!(m.ok && m.d && typeof m.d === "object" && m.d.id);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let lang = "en";
  try {
    if (await rateLimited(request, env, "orcamentos", 90)) return json({ ok: false, error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    lang = idioma(b.lang) || "en";

    // ── PORTÃO DO TENANT ────────────────────────────────────────────────────────────────────
    const email = String(b.email || "").trim().toLowerCase();
    const key = String(b.token || b.key || "").trim();
    if (!email.includes("@") || !key) return json({ ok: false, error: "unauthorized" }, 401);
    const gd = await fetch(`${SB}/rest/v1/rpc/get_client_data`, {
      method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!gd.ok) return json({ ok: false, error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ ok: false, error: "unauthorized" }, 401);
    if (!idioma(b.lang)) lang = idioma(gdj.identity && gdj.identity.lang) || "en";

    const S = env.INGEST_SECRET || "";
    const fora = (detalhe, extra = {}) => json({ ok: false, ready: false, note: frase("indisponivel", lang), error: frase("indisponivel", lang), erro: frase("indisponivel", lang), detalhe_tecnico: detalhe, ...extra }, 503);
    if (!S) return fora("INGEST_SECRET ausente no ambiente");

    const action = String(b.action || "fila").slice(0, 20);

    if (action === "fila" || action === "lista") {
      const r = action === "fila"
        ? await ler(env, "quote_fila", { p_secret: S, p_email: email })
        : await ler(env, "quote_list", { p_secret: S, p_email: email, p_limite: Math.min(Math.max(parseInt(b.limite ?? b.limit, 10) || 50, 1), 200) });
      // lista ausente é ERRO, não "nenhum orçamento" — `|| []` aqui diria ao dono que está tudo calmo.
      if (!r.ok || !Array.isArray(r.d)) return fora(`${action === "fila" ? "quote_fila" : "quote_list"} HTTP ${r.http}: ${r.cru}`);
      const linhas = r.d.map(semToken);
      return json({ ok: true, ready: true, count: linhas.length, [action]: linhas });
    }

    if (action === "config") {
      let teto = null;
      if (b.teto_cents != null && b.teto_cents !== "") {
        const n = Number(b.teto_cents);
        // integer do Postgres estoura em 2^31; teto negativo mandaria TUDO pra fila sem avisar.
        if (!Number.isFinite(n) || n < 0 || n > 2000000000) return json({ ok: false, ready: true, note: frase("valor_invalido", lang), error: frase("valor_invalido", lang) }, 400);
        teto = Math.round(n);
      }
      const auto = typeof b.auto_enviar === "boolean" ? b.auto_enviar : typeof b.auto === "boolean" ? b.auto : null;
      const r = await ler(env, "quote_config", { p_secret: S, p_email: email, p_teto_cents: teto, p_auto: auto });
      if (!r.ok || !r.d || typeof r.d !== "object" || r.d.teto_cents == null) return fora(`quote_config HTTP ${r.http}: ${r.cru}`);
      return json({ ok: true, ready: true, config: { teto_cents: r.d.teto_cents, auto_enviar: r.d.auto_enviar, updated_at: r.d.updated_at } });
    }

    if (action === "decidir") {
      const id = String(b.id || "").trim();
      if (!UUID_RE.test(id)) return json({ ok: false, decidido: false, note: frase("id_invalido", lang), error: frase("id_invalido", lang) }, 400);
      if (typeof b.aprovar !== "boolean") return json({ ok: false, decidido: false, error: "aprovar must be true or false" }, 400);
      // `quem` é SEMPRE o e-mail que passou no portão — o campo do corpo é ignorado de propósito
      // (trilha de aprovação com nome digitado pelo navegador não é trilha).
      const r = await ler(env, "quote_decidir", { p_secret: S, p_email: email, p_id: id, p_aprovar: b.aprovar, p_quem: email, p_motivo: b.motivo ? String(b.motivo).slice(0, 300) : null });
      if (!r.ok) {
        // P0002 = não está na fila DESTE negócio (já decidido, ou id de outro tenant). Resposta
        // idêntica nos dois casos: não confirmo a existência de orçamento alheio.
        if (r.d && r.d.code === "P0002") return json({ ok: false, decidido: false, note: frase("fora_da_fila", lang), error: frase("fora_da_fila", lang) }, 409);
        return fora(`quote_decidir HTTP ${r.http}: ${r.cru}`, { decidido: false });
      }
      const q = r.d;
      if (!q || typeof q !== "object" || q.id !== id) return fora("quote_decidir não devolveu a linha decidida", { decidido: false });
      if (!b.aprovar) return json({ ok: true, decidido: true, status: q.status, enviado: false, marcado: false, canal: null, bloqueios: [] });
      const env1 = await enviar(env, email, q, lang);
      const marcado = env1.enviado ? await marcar(env, S, id, env1.canal) : false;
      return json({ ok: true, decidido: true, status: marcado ? "enviado" : q.status, enviado: env1.enviado, marcado, canal: env1.canal, entrega_confirmada: false, bloqueios: env1.bloqueios });
    }

    if (action === "reenviar") {
      // Aprovado cujo e-mail não saiu (cliente sem e-mail na hora, provedor recusou): sem esta
      // porta o orçamento aprovado ficava preso em "aprovado" para sempre, sem segunda tentativa.
      const id = String(b.id || "").trim();
      if (!UUID_RE.test(id)) return json({ ok: false, enviado: false, note: frase("id_invalido", lang), error: frase("id_invalido", lang) }, 400);
      const l = await ler(env, "quote_list", { p_secret: S, p_email: email, p_limite: 200 });
      if (!l.ok || !Array.isArray(l.d)) return fora(`quote_list HTTP ${l.http}: ${l.cru}`, { enviado: false });
      const q = l.d.find((x) => x && x.id === id);
      if (!q || q.status !== "aprovado") return json({ ok: false, enviado: false, note: frase("nao_aprovado", lang), error: frase("nao_aprovado", lang) }, 409);
      const env1 = await enviar(env, email, q, lang);
      const marcado = env1.enviado ? await marcar(env, S, id, env1.canal) : false;
      return json({ ok: true, enviado: env1.enviado, marcado, canal: env1.canal, entrega_confirmada: false, bloqueios: env1.bloqueios });
    }

    return json({ ok: false, error: "unknown action", acoes: ["fila", "lista", "config", "decidir", "reenviar"] }, 400);
  } catch (e) {
    return json({ ok: false, ready: false, note: frase("indisponivel", lang), error: frase("indisponivel", lang), detalhe_tecnico: String(e).slice(0, 160) }, 500);
  }
}
