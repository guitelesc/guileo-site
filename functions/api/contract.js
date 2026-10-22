// Cloudflare Pages Function — POST /api/contract  (COMPANY OS · ADMIN/LEGAL: contracts & quotes)
// Admin/portal actions (list, upsert) are gated by the same blitz_stats token as the other ops
// endpoints. The signer path (by_token, sign) needs NO login — the per-doc sign_token is the
// capability. Gracefully reports ready:false until db/contracts.sql is pasted.
import { json, rateLimited, safeEq } from "../lib/guard.js";
// a venda tem que voltar para quem a fez: assinatura avisa o vendedor e o dono.
import { emitFailure } from "../lib/failure.js";
import { svcJson, svcRpc } from "../lib/sb.js";
import { ownerAlertEmail, signedCopyEmail } from "../lib/emailTemplates.js";

// ── IMPRESSÃO DIGITAL DO DOCUMENTO (2026-10-04, assinatura própria v2) ──────────────────────────
// SHA-256 do JSON CANÔNICO de { body, title, lang }: chaves de objeto em ordem alfabética (em todos
// os níveis), sem espaços, arrays na ordem em que estão. Mesmo conteúdo → mesmo hash, não importa
// a ordem em que as chaves foram escritas. `body` inclui `translations`, então o hash cobre as
// duas línguas. A página /sign roda o MESMO algoritmo no navegador para conferir (Sign.jsx →
// canonicalJSON) — se um dia mudar aqui, muda lá no mesmo commit, senão o selo "confere" mente.
export function canonicalJSON(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return Number.isFinite(v) ? JSON.stringify(v) : "null";
  if (typeof v === "boolean" || typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map((x) => (x === undefined || typeof x === "function" ? "null" : canonicalJSON(x))).join(",") + "]";
  if (typeof v === "object") {
    const ks = Object.keys(v).filter((k) => v[k] !== undefined && typeof v[k] !== "function").sort();
    return "{" + ks.map((k) => JSON.stringify(k) + ":" + canonicalJSON(v[k])).join(",") + "}";
  }
  return "null";
}
export async function sha256Hex(texto) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(texto)));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export const docHash = (doc) => sha256Hex(canonicalJSON({ body: doc?.body ?? {}, title: doc?.title ?? null, lang: doc?.lang ?? null }));

// "a função nova ainda não existe" (SQL v2 não colado) ou "o servidor não tem a chave de serviço":
// só nesses dois casos o caminho antigo assume. Qualquer outra falha é falha — e aparece.
const v2Ausente = (status) => status === 404 || status === 401 || status === 403;
const SITE = "https://guileoai.com";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

// ── SELLER auth (espelha /api/seller-prospects: roster do banco → roster do env / código do time) ──
// POR QUE EXISTE: o gerador de contrato do vendedor (SellerContract.jsx) precisava GRAVAR, e o único
// portão daqui era o `blitz_stats` de admin — que o vendedor não tem. Sem isto o contrato morria na
// tela. O e-mail AUTENTICADO é o único escopo usado; o e-mail do corpo é ignorado de propósito.
const BOOTSTRAP = [
  { email: "luistelesc@gmail.com", code: "GUILEO-DONO", name: "Luis Teles", ref: "luis" },
  { email: "smart@guileoai.com", code: "GUILEO-DONO", name: "Guileo", ref: "guileo" },
];
const TEAM_CODE_DEFAULT = "GUILEO-TIME-2026";
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
function roster(env) {
  try { if (env && env.SELLER_ROSTER) { const arr = JSON.parse(env.SELLER_ROSTER); if (Array.isArray(arr) && arr.length) return arr; } } catch { /* fall back */ }
  return BOOTSTRAP;
}
function sellerAuthEnv(env, email, code) {
  const e = (email || "").toString().trim().toLowerCase();
  const c = (code || "").toString().trim();
  if (!e || !c) return null;
  const match = roster(env).find((s) => (s.email || "").trim().toLowerCase() === e && safeEq(String(s.code || ""), c));
  if (match) return { email: e, name: match.name || e.split("@")[0], ref: (match.ref || e.split("@")[0]).toString().slice(0, 40), roster: true };
  const teamCode = (env && env.TEAM_INVITE_CODE) || TEAM_CODE_DEFAULT;
  if (safeEq(c, teamCode)) return { email: e, name: e.split("@")[0], ref: slug(e.split("@")[0]) || "team", roster: false };
  return null;
}
async function sellerAuthDB(env, email, code) {
  const e = (email || "").toString().trim().toLowerCase();
  const c = (code || "").toString().trim();
  const ING = env && env.INGEST_SECRET;
  if (!e || !c || !ING) return null;
  try {
    const r = await rpc("seller_auth_check", { p_secret: ING, p_email: e, p_code: c });
    if (!r.ok) return null;
    const d = await r.json().catch(() => null);
    if (!d || !d.ok) return null;
    return { email: e, name: d.name || e.split("@")[0], ref: (d.ref || e.split("@")[0]).toString().slice(0, 40), roster: true };
  } catch { return null; }
}
async function sellerAuthFull(env, email, code) {
  return (await sellerAuthDB(env, email, code)) || sellerAuthEnv(env, email, code);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    if (await rateLimited(request, env, "contract", 40)) return json({ error: "too many requests" }, 429);
    const b = await request.json().catch(() => ({}));
    const action = (b.action || "list").toString();
    const secret = env.SCHED_SECRET || "";

    // ── PUBLIC (capability token) — the counterparty signs without any login ──
    if (action === "by_token") {
      const tok = (b.sign_token || "").toString();
      // 1º o registro avançado (hash + assinatura do prestador). Sem o SQL v2, cai no de hoje.
      const r2 = await svcRpc(env, "contract_by_token_v2", { p_token: tok });
      if (r2.ok) {
        const rows = await r2.json().catch(() => null);
        if (!Array.isArray(rows)) return json({ ok: false, ready: false, motivo: "indisponivel", doc: null }, 503);
        return json({ ok: true, ready: true, avancado: true, doc: rows[0] || null });
      }
      if (!v2Ausente(r2.status)) return json({ ok: false, ready: false, motivo: "indisponivel", detalhe_tecnico: `contract_by_token_v2 HTTP ${r2.status}`, doc: null }, 503);
      const r = await rpc("contract_by_token", { p_token: tok });
      // ⚠️ banco fora ≠ "documento não existe": antes isto voltava doc:null com 200 e a página dizia
      // "link expirado" para uma queda de rede. Agora é 503 e a página manda tentar de novo.
      if (!r.ok) return json({ ok: false, ready: false, motivo: "indisponivel", note: "Paste db/contracts.sql to activate contracts.", doc: null }, 503);
      const rows = await r.json().catch(() => null);
      if (!Array.isArray(rows)) return json({ ok: false, ready: false, motivo: "indisponivel", doc: null }, 503);
      return json({ ok: true, ready: true, avancado: false, doc: rows[0] || null });
    }
    if (action === "sign") {
      const ip = (request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "").split(",")[0].trim();
      const ua = (request.headers.get("user-agent") || "").slice(0, 400);
      const tok = (b.sign_token || "").toString();
      const nome = (b.signer_name || "").toString();
      let rec = null;
      let avancado = false;
      let tema = ""; // body.theme do documento (ex.: "natura-deck") — a via por e-mail veste a mesma roupa
      // ── CAMINHO AVANÇADO (SQL v2): o servidor lê o documento, calcula o SHA-256 do que está na
      // tela da pessoa, e o banco só aceita se (a) o prestador já assinou quando o documento exige,
      // (b) nada mudou desde a leitura (updated_at) e (c) o hash bate com o que o prestador assinou.
      const r0 = await svcRpc(env, "contract_by_token_v2", { p_token: tok });
      if (r0.ok) {
        const rows = await r0.json().catch(() => null);
        if (!Array.isArray(rows)) return json({ ok: false, signed: false, motivo: "indisponivel" }, 503);
        const doc = rows[0];
        if (!doc) return json({ ok: true, signed: false, motivo: "link_invalido_ou_ja_assinado" });
        const hash = await docHash(doc);
        rec = await svcJson(env, "contrato_assinar_v2", { p_token: tok, p_signer_name: nome, p_ip: ip, p_user_agent: ua, p_body_sha256: hash, p_expected_updated_at: doc.updated_at });
        // svcJson devolve {ok:false, erro_http} para falha de transporte: isso é indisponibilidade,
        // não recusa — a pessoa tem que ouvir "tente de novo", não "link inválido".
        if (!rec || (rec.ok !== true && !rec.motivo)) return json({ ok: false, signed: false, motivo: "indisponivel" }, 503);
        if (rec.ok !== true) return json({ ok: true, signed: false, motivo: rec.motivo });
        avancado = true;
        tema = doc.body && typeof doc.body === "object" && typeof doc.body.theme === "string" ? doc.body.theme : "";
      } else if (v2Ausente(r0.status)) {
        // ── CAMINHO DE HOJE (SQL v2 ainda não colado) — idêntico ao que estava no ar.
        // `contrato_assinar` devolve o RECIBO (dono, cliente, valor), não só um booleano — é ele
        // que permite avisar as pessoas certas sem uma segunda leitura no instante da venda.
        const r = await rpc("contrato_assinar", { p_token: tok, p_signer_name: nome, p_ip: ip });
        // ⚠️ A RECUSA PRECISA TER MOTIVO E STATUS (2026-08-17). Antes, banco fora do ar devolvia
        // {ok:false,signed:false} com HTTP 200 — indistinguível de "token inválido" — e a página
        // reagia igual aos dois: voltava o botão ao normal e não dizia nada. No instante da
        // ASSINATURA, que é onde o dinheiro entra. Agora o motivo viaja e a tela fala.
        if (!r.ok) return json({ ok: false, signed: false, motivo: "indisponivel" }, 503);
        rec = await r.json().catch(() => null);
        if (!rec || rec.ok !== true) return json({ ok: true, signed: false, motivo: rec?.motivo || "link_invalido_ou_ja_assinado" });
      } else {
        return json({ ok: false, signed: false, motivo: "indisponivel" }, 503);
      }

      // ── A VENDA VOLTA PARA QUEM A FEZ (2026-08-21) ────────────────────────────────────────
      // Antes daqui, assinar era um carimbo mudo no banco. Agora o vendedor dono do contrato e o
      // dono da empresa recebem a notícia no minuto em que ela acontece — porque contrato assinado
      // que ninguém vê é ativação que não começa, e cliente que assinou e ficou esperando é o
      // primeiro cliente a pedir reembolso.
      // Best-effort DEPOIS de a assinatura já estar gravada: falha de e-mail não pode desfazer,
      // nem esconder, uma assinatura que o banco já aceitou.
      // ── ASSINOU → O RASCUNHO DE ATIVAÇÃO JÁ NASCE ────────────────────────────────────────
      // Antes daqui o funil parava: alguém tinha que REDIGITAR no /admin o nome, o e-mail e o
      // plano que o contrato já continha. Entre assinar e o agente nascer havia uma pessoa
      // lembrando de fazer uma coisa — e é aí que o cliente novo fica esperando.
      // 🚨 RASCUNHO, NUNCA ATIVAÇÃO. Ativar cria agente, compra número e credita: dinheiro e
      // recursos externos, que continuam exigindo o clique humano. Automatizamos a transcrição,
      // não a decisão.
      let rascunho = null;
      try {
        // 🚨 CHAVE DE SERVIÇO, NÃO `anon`. `rascunho_do_contrato` é REVOGADA do anon de propósito
        // (ela escreve na fila de ativação). O helper `rpc` deste arquivo fala como anon — chamar
        // por ele devolvia 401 silencioso e o rascunho simplesmente não nascia, com a assinatura
        // dizendo "ok". Foi exatamente o que o primeiro teste mostrou: `rascunho: null`.
        rascunho = await svcJson(env, "rascunho_do_contrato", { p_secret: env.INGEST_SECRET || "", p_contrato: rec.id });
      } catch { /* o rascunho é conveniência; a assinatura já está gravada */ }

      try {
        await emitFailure(env, "contrato_assinado", rec.dono || "",
          `✍️ ${rec.cliente || "cliente"} assinou "${rec.titulo || ""}" — US$ ${rec.valor} · assinado por ${rec.assinante}`,
          { contrato: rec.id, valor: rec.valor }).catch(() => {});
        if (env.RESEND_API_KEY) {
          const dono = (env.OWNER_EMAIL || "smart@guileoai.com").toString().split(",")[0].trim();
          // o VENDEDOR primeiro (é a venda dele), o dono da empresa em cópia — sem duplicar quando
          // são a mesma pessoa.
          const para = [...new Set([rec.dono, dono].filter((x) => x && String(x).includes("@")))];
          const tpl = ownerAlertEmail({
            kind: "sale", business: rec.cliente || "", customer: rec.assinante || "",
            amount: `US$ ${rec.valor}`, when: rec.quando || new Date().toISOString(), lang: "pt",
            // a frase muda conforme o rascunho existir: mandar "vá criar" quando já está criado
            // faz a pessoa procurar o que já está pronto — e desconfiar do aviso da próxima vez.
            details: `${rec.cliente} assinou "${rec.titulo}". ${rascunho?.ok
              ? (rascunho.ja_existia ? "O rascunho de ativação já estava no /admin — é só conferir e ativar."
                                     : "O rascunho de ativação JÁ FOI CRIADO no /admin: confira e aperte ativar.")
              : (rascunho?.motivo === "ja_e_cliente" ? "Este e-mail já é cliente — nada a ativar."
                                                     : "Próximo passo: cadastrar e ativar o cliente no /admin.")}`,
          });
          const mr = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: para,
              subject: `✍️ Contrato assinado — ${rec.cliente} · US$ ${rec.valor}`, html: tpl.html }),
          });
          if (!mr.ok) await emitFailure(env, "aviso_assinatura_nao_saiu", rec.dono || "", `o aviso de contrato assinado NÃO saiu (HTTP ${mr.status})`, { contrato: rec.id }).catch(() => {});
        }
      } catch { /* a assinatura já está gravada; o aviso é um extra que nunca a desfaz */ }

      // ── A VIA DAS DUAS PARTES (2026-10-04) ────────────────────────────────────────────────
      // Quem assinou recebe a própria via, e o dono também: título, as duas assinaturas (nome,
      // hora UTC, IP), o SHA-256 e o link permanente da via assinada. Best-effort DEPOIS da
      // assinatura gravada — e-mail que falha NUNCA desfaz a assinatura, mas também nunca some:
      // vira evento no /admin e a resposta diz qual via saiu (com o id do Resend) e qual não.
      const copia = { cliente: null, dono: null, motivo: null };
      if (avancado) {
        const link = `${SITE}/sign?t=${encodeURIComponent(tok)}`;
        const dados = {
          title: rec.titulo || "", counterparty: rec.cliente || "", link, hash: rec.hash || "",
          provider: rec.prestador_quando ? { entity: rec.prestador_entidade || "", name: rec.prestador_nome || "", title: rec.prestador_cargo || "", at: rec.prestador_quando, ip: rec.prestador_ip || "" } : null,
          signer: { name: rec.assinante || "", at: rec.quando, ip: rec.ip || "" },
        };
        const enviar = async (para, lang, quem) => {
          const tpl = signedCopyEmail({ ...dados, lang, audience: quem, theme: tema });
          const mr = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: env.EMAIL_FROM || "Guileo <noreply@guileoai.com>", to: [para], subject: tpl.subject, html: tpl.html }),
          });
          const mj = await mr.json().catch(() => null);
          // 🚨 COMPROVANTE: "200" sem id do Resend não é e-mail enviado.
          if (!mr.ok || !mj || typeof mj.id !== "string") throw new Error(`HTTP ${mr.status}`);
          return mj.id;
        };
        if (!env.RESEND_API_KEY) {
          copia.motivo = "sem_resend";
          await emitFailure(env, "copia_assinatura_nao_saiu", rec.dono || "", `as vias de "${rec.titulo || ""}" NÃO saíram: RESEND_API_KEY ausente`, { contrato: rec.id }).catch(() => {});
        } else {
          const emailCliente = String(rec.cliente_email || "").trim();
          if (emailCliente.includes("@")) {
            try { copia.cliente = await enviar(emailCliente, rec.lang || "en", "signer"); }
            catch (e) { await emitFailure(env, "copia_assinatura_nao_saiu", rec.dono || "", `a via do CLIENTE (${emailCliente}) de "${rec.titulo || ""}" NÃO saiu (${String(e).slice(0, 60)})`, { contrato: rec.id }).catch(() => {}); }
          } else {
            copia.motivo = "cliente_sem_email";
            await emitFailure(env, "copia_assinatura_nao_saiu", rec.dono || "", `"${rec.titulo || ""}" foi assinado mas o contrato não tem counterparty_email — a via do cliente não saiu`, { contrato: rec.id }).catch(() => {});
          }
          const dono = (env.OWNER_EMAIL || "smart@guileoai.com").toString().split(",")[0].trim();
          try { copia.dono = await enviar(dono, "pt", "owner"); }
          catch (e) { await emitFailure(env, "copia_assinatura_nao_saiu", rec.dono || "", `a via do DONO de "${rec.titulo || ""}" NÃO saiu (${String(e).slice(0, 60)})`, { contrato: rec.id }).catch(() => {}); }
        }
      }

      return json({
        ok: true, signed: true, motivo: null, avancado,
        recibo: avancado ? { id: rec.id, hash: rec.hash, quando: rec.quando, ip: rec.ip } : { id: rec.id, quando: rec.quando },
        copia: avancado ? { cliente: !!copia.cliente, dono: !!copia.dono, motivo: copia.motivo } : null,
        rascunho: rascunho?.ok ? { id: rascunho.id, ja_existia: !!rascunho.ja_existia } : null,
      });
    }

    // ── PORTÃO: VENDEDOR ou ADMIN ────────────────────────────────────────────────────────────────
    // 1) vendedor logado (seller_email + seller_code) → o tenant é o E-MAIL DELE, sempre. Nunca o
    //    e-mail do corpo: um vendedor jamais lê/escreve o contrato de outro.
    // 2) admin/portal → o mesmo token blitz de /api/crm.
    let email = "";
    let viaVendedor = false;
    if (b.seller_email || b.seller_code) {
      viaVendedor = true;
      const seller = await sellerAuthFull(env, b.seller_email, b.seller_code);
      if (!seller) return json({ error: "unauthorized", motivo: "login_vendedor" }, 401);
      // O código de time (roster:false) aceita qualquer e-mail digitado → não pode virar dono de
      // contrato. Contrato exige código PESSOAL, como o CRM de prospects.
      if (!seller.roster) return json({ error: "team_code", motivo: "peca_o_codigo_pessoal" }, 401);
      email = seller.email;
    } else {
      const vr = await rpc("blitz_stats", { p_token: (b.token || "").toString(), p_email: "" });
      // ── 3) O CLIENTE LENDO OS PRÓPRIOS DOCUMENTOS (2026-09-28) ────────────────────────────────
      // Até hoje só existiam os portões 1 e 2. A Central manda `list` com a CHAVE DO TENANT no
      // campo `token`; o blitz_stats (senha de admin) recusava, a rota devolvia 401 e a tela
      // Documentos mostrava "No documents yet" para quem tinha contrato assinado.
      // Este ramo abre SÓ a leitura (`list`), SÓ quando e-mail↔chave casam no get_client_data, e
      // SÓ para documentos em que o próprio tenant é dono ou contraparte (contract_list_tenant,
      // db/contract_list_tenant.sql). upsert/performance continuam exigindo admin ou vendedor.
      if (!vr.ok && action === "list") {
        const mail = (b.email || "").toString().trim().toLowerCase();
        const chave = (b.token || b.key || "").toString().trim();
        if (!mail.includes("@") || !chave) return json({ error: "unauthorized" }, 401);
        const gd = await rpc("get_client_data", { p_email: mail, p_key: chave });
        if (!gd.ok) return json({ error: "unauthorized" }, 401);
        const gdj = await gd.json().catch(() => null);
        if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);
        const tela = ["en", "pt", "es", "hi"].includes(String(b.lang || (gdj.identity && gdj.identity.lang) || "").toLowerCase().slice(0, 2))
          ? String(b.lang || gdj.identity.lang).toLowerCase().slice(0, 2) : "en";
        const FORA = {
          en: "I couldn't load your documents right now. Please try again in a moment.",
          pt: "Não consegui carregar seus documentos agora. Tente de novo em instantes.",
          es: "No pude cargar sus documentos ahora. Inténtelo de nuevo en un momento.",
          hi: "मैं अभी आपके दस्तावेज़ लोड नहीं कर सका। कृपया थोड़ी देर में फिर कोशिश करें।",
        }[tela];
        const lr = await svcRpc(env, "contract_list_tenant", { p_secret: secret, p_email: mail, p_limit: Math.min(Math.max(parseInt(b.limit, 10) || 200, 1), 1000) });
        // Falha de leitura NUNCA vira "nenhum documento": `docs: []` com ok:true foi exatamente
        // o que escondeu este defeito. 503 (não 502 — a Cloudflare troca o corpo do 502).
        if (!lr.ok) return json({ ok: false, ready: false, note: FORA, error: FORA, erro: FORA, detalhe_tecnico: `contract_list_tenant HTTP ${lr.status}` }, 503);
        const linhas = await lr.json().catch(() => null);
        if (!Array.isArray(linhas)) return json({ ok: false, ready: false, note: FORA, error: FORA, erro: FORA, detalhe_tecnico: "contract_list_tenant: resposta não é lista" }, 503);
        return json({ ok: true, ready: true, escopo: "tenant", count: linhas.length, docs: linhas });
      }
      if (!vr.ok) return json({ error: "unauthorized" }, 401);
      // require a real email — no OWNER_EMAIL fallback (a blank email must never default to the
      // owner's contracts). Dual-path per-tenant binding for `list` is tracked in docs/GO-LIVE.md.
      email = (b.email || "").toString().trim().toLowerCase();
      if (!email.includes("@")) return json({ error: "unauthorized" }, 401);
    }

    // ── O PRESTADOR ASSINA PRIMEIRO (2026-10-04) — SÓ ADMIN ──────────────────────────────────────
    // ORIGEM LTDA (d/b/a Guileo AI) assina antes do cliente. O servidor lê o documento, calcula o
    // SHA-256 e o banco grava nome, cargo, hora, IP e o hash — e a partir daí o documento trava
    // (gatilho contracts_trava): o cliente vai assinar EXATAMENTE este texto, ou o banco recusa.
    if (action === "provider_sign") {
      if (viaVendedor) return json({ ok: false, error: "forbidden", motivo: "so_admin", erro: "Só o administrador assina pela ORIGEM LTDA." }, 403);
      const id = (b.id || "").toString();
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, motivo: "id_invalido", erro: "Informe o id (uuid) do contrato." }, 400);
      const gr = await svcRpc(env, "contract_get", { p_secret: secret, p_email: email, p_id: id });
      if (v2Ausente(gr.status)) return json({ ok: false, ready: false, motivo: "sql_v2_ausente", erro: "A assinatura do prestador ainda não está ativa: cole db/contracts_esign_v2.sql no Supabase (e confira SUPABASE_SERVICE_ROLE no Cloudflare)." }, 503);
      if (!gr.ok) return json({ ok: false, motivo: "indisponivel", detalhe_tecnico: `contract_get HTTP ${gr.status}` }, 503);
      const rows = await gr.json().catch(() => null);
      if (!Array.isArray(rows)) return json({ ok: false, motivo: "indisponivel", detalhe_tecnico: "contract_get: resposta não é lista" }, 503);
      const doc = rows[0];
      if (!doc) return json({ ok: false, motivo: "nao_encontrado", erro: "Contrato não encontrado para este e-mail." }, 404);
      const hash = await docHash(doc);
      const ip = (request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "").split(",")[0].trim();
      const rec = await svcJson(env, "contract_provider_sign", {
        p_secret: secret, p_email: email, p_id: id,
        p_entity: (b.entity || "ORIGEM LTDA").toString().slice(0, 160),
        p_signer_name: (b.signer_name || "Luis Teles").toString().slice(0, 120),
        p_signer_title: (b.signer_title || "Managing Partner").toString().slice(0, 120),
        p_ip: ip, p_user_agent: (request.headers.get("user-agent") || "").slice(0, 400),
        p_body_sha256: hash, p_expected_updated_at: doc.updated_at,
      });
      if (!rec || (rec.ok !== true && !rec.motivo)) return json({ ok: false, motivo: "indisponivel", detalhe_tecnico: rec?.detalhe || "" }, 503);
      if (rec.ok !== true) return json({ ok: false, motivo: rec.motivo, quando: rec.quando || null, hash: rec.hash || null }, 409);
      // 🚨 COMPROVANTE: o hash que o banco gravou tem que ser o que calculamos aqui.
      if (rec.hash !== hash || !rec.quando) return json({ ok: false, motivo: "recibo_divergente", erro: "O banco não devolveu o recibo esperado." }, 503);
      return json({ ok: true, id: rec.id, quando: rec.quando, hash: rec.hash, status: rec.status, link: `${SITE}/sign?t=${encodeURIComponent(rec.sign_token)}` });
    }

    if (action === "upsert") {
      // service_role (com recuo para anon enquanto a env não existir): o PASSO 2 do SQL v2 tira o
      // contract_upsert do anon, e esta chamada continua funcionando.
      const r = await svcRpc(env, "contract_upsert", {
        p_secret: secret, p_email: email, p_id: b.id || null, p_kind: b.kind || "contract", p_scope: b.scope || "guileo_client",
        p_template: b.template || null, p_lang: b.lang || "pt", p_title: b.title || null, p_counterparty_name: b.counterparty_name || null,
        p_counterparty_email: b.counterparty_email || null, p_amount_cents: parseInt(b.amount_cents, 10) || 0, p_body: b.body || {}, p_status: b.status || "draft", p_contact_id: b.contact_id || null,
      });
      if (!r.ok) {
        const cru = await r.text().catch(() => "");
        // A TRAVA FALA (gatilho contracts_trava): documento assinado não muda — a recusa diz isso
        // com todas as letras, em vez de um "503 recusou" que parece banco fora do ar.
        if (/contrato_travado/.test(cru)) {
          let msg = "contrato_travado";
          try { msg = JSON.parse(cru).message || msg; } catch { /* mantém o código */ }
          return json({ ok: false, motivo: "contrato_travado", erro: msg.replace(/^contrato_travado:\s*/, "") }, 409);
        }
        return json({ ok: false, ready: false, erro: "contract_upsert recusou", cru: cru.slice(0, 300) }, 503);
      }
      const id = await r.json().catch(() => null);
      // 🚨 COMPROVANTE: sem id não houve gravação. Devolver ok:true aqui é o que faz a tela dizer
      // "salvo" sobre um banco vazio — a falha exata que este repo já teve. 200 sem id vira 502.
      if (typeof id !== "string" || id.length < 10) return json({ ok: false, erro: "contract_upsert não devolveu id", cru: String(id).slice(0, 120) }, 503);
      return json({ ok: true, ready: true, id });
    }

    // ── QUAL CAMPANHA VIROU ASSINATURA (2026-08-17) ─────────────────────────────────────────────
    // Fecha o ciclo do dinheiro: sem isto o motor de anúncio otimiza por LEAD, que é métrica de meio
    // de funil. Duas campanhas com o mesmo custo por lead podem fechar em taxas 5× diferentes — e o
    // reinvestimento escolhe a errada com dado verdadeiro na mão.
    // ⚠️ NÃO usa `|| {}` no retorno: relatório ausente é ERRO, não "nenhuma venda". Um zero
    // inventado aqui vira decisão de cortar a campanha que estava vendendo.
    if (action === "performance") {
      const r = await rpc("contract_performance", { p_secret: secret, p_email: email, p_days: Math.min(Math.max(parseInt(b.days, 10) || 90, 1), 730) });
      if (!r.ok) return json({ ok: true, ready: false, note: "Cole db/contract_performance.sql para ativar o relatório por campanha." });
      const rel = await r.json().catch(() => null);
      if (!rel || typeof rel !== "object") return json({ ok: false, erro: "contract_performance não devolveu objeto" }, 503);
      return json({ ok: true, ready: true, relatorio: rel });
    }

    // default: list
    const r = await rpc("contract_list", { p_secret: secret, p_email: email, p_limit: Math.min(Math.max(parseInt(b.limit, 10) || 200, 1), 1000) });
    if (!r.ok) return json({ ok: true, ready: false, note: "Paste db/contracts.sql to activate contracts.", docs: [] });
    const docs = (await r.json()) || [];
    return json({ ok: true, ready: true, count: docs.length, docs });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
