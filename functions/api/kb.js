// Cloudflare Pages Function — POST /api/kb  (the tenant's "Cérebro do negócio")
// CRUD for a client's own Knowledge Base — the business-specific Q&A Gui answers FROM on calls
// and web chat ("Do you take walk-ins? Parking? Cancellation policy?"). Needs db/tenant_kb.sql;
// until pasted, every action returns a graceful {ready:false} note instead of a 500.
//   POST { token, email, action:"list" }                                          -> { ok, ready, count, items:[...] }
//   POST { token, email, action:"upsert", id?, question, answer?, category?, active? } -> { ok, ready, id, agente }
//   POST { token, email, action:"delete", id }                                     -> { ok, deleted }
// FALHA DE BANCO (qualquer ação) -> { ok:false, erro:"sem permissão" | "banco indisponível" | "pedido recusado", http }
//   — e SÓ "função não existe" (404 / PGRST202) vira { ready:false }. Ver `motivoDaFalha` abaixo.
//
// PER-TENANT GATE: get_client_data binds email↔connection-key (rejects a mismatch), exactly like
// noshow-radar.js — a token can only ever touch its OWN tenant's KB. The kb_* RPCs are then called
// with the server-held INGEST secret and the AUTHENTICATED email (never a caller-supplied one).
import { json } from "../lib/guard.js";

const SB = "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const rpc = (name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
  method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/* ── TODA FALHA VIRAVA "COLE O SQL" (2026-09-27) ───────────────────────────────────────────────
   Qualquer `!r.ok` — 401, 403, 500, 503 — era devolvido como `{ok:true, ready:false}` com a nota
   "Paste db/tenant_kb.sql". Três mentiras numa resposta só:
     · `ok:true` sobre uma chamada que falhou;
     · "ainda não ativado" para uma base que ESTÁ ativada e só perdeu permissão (é o que acontece
       no dia em que o anon é revogado numa RPC — ver db/ANON_REVOKE_PLANO.md) ou caiu;
     · e quem fosse consertar colaria de novo um SQL que já estava colado, sem efeito nenhum,
       enquanto o defeito real (permissão / banco fora) seguia invisível.
   Agora cada causa tem o seu nome. "Não ativado" é SÓ função ausente: o PostgREST responde 404
   com code PGRST202 (ou 42883, função inexistente no Postgres).
   O corpo é lido UMA vez aqui — depois disto `r` não pode mais ser lido por quem chamou. */
async function motivoDaFalha(r) {
  const texto = await r.text().catch(() => "");
  let code = "";
  try { code = (JSON.parse(texto)?.code || "").toString(); } catch { /* corpo não-JSON: decide pelo status */ }
  if (r.status === 404 || code === "PGRST202" || code === "42883") return { tipo: "ausente" };
  // 28000 = o `raise ... errcode '28000'` das próprias RPCs (segredo/chave não confere);
  // 42501 = permission denied (EXECUTE revogado para o papel que chamou).
  if (r.status === 401 || r.status === 403 || code === "28000" || code === "42501") return { tipo: "permissao", erro: "sem permissão", http: r.status, code };
  if (r.status >= 500) return { tipo: "indisponivel", erro: "banco indisponível", http: r.status, code };
  return { tipo: "recusado", erro: "pedido recusado", http: r.status, code };
}
const NOTA_AUSENTE = "Paste db/tenant_kb.sql in Supabase to activate your Knowledge Base.";
// Resposta de falha. "ausente" mantém o contrato antigo (HTTP 200 + ready:false) — a tela já sabe
// lê-lo. O resto sai como 502: a chave do CLIENTE já passou no portão lá em cima, então quem
// falhou foi a NOSSA perna com o banco, não o pedido dele. `extra` carrega os campos vazios que
// cada ação devolvia (items/count/deleted) para nenhuma tela quebrar lendo `undefined`.
function respostaDeFalha(f, acao, extra = {}) {
  if (f.tipo === "ausente") return json({ ok: true, ready: false, note: NOTA_AUSENTE, ...extra });
  try { console.error(JSON.stringify({ kb_falha: acao, erro: f.erro, http: f.http, code: f.code || "" })); } catch { /* */ }
  return json({ ok: false, erro: f.erro, http: f.http, ...extra }, 503);
}

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const b = await request.json().catch(() => ({}));
    // PER-TENANT GATE — bind the cockpit email to its connection key (get_client_data rejects a
    // mismatch) so a token can't read/write another tenant's KB. No OWNER_EMAIL fallback.
    const email = (b.email || "").toString().trim().toLowerCase();
    const key = (b.token || b.key || "").toString().trim();
    if (!email.includes("@") || !key) return json({ error: "unauthorized" }, 401);
    const gd = await rpc("get_client_data", { p_email: email, p_key: key });
    if (!gd.ok) return json({ error: "unauthorized" }, 401);
    const gdj = await gd.json().catch(() => null);
    if (!(gdj && typeof gdj === "object" && Array.isArray(gdj.events))) return json({ error: "unauthorized" }, 401);

    const ING = env.INGEST_SECRET || "";
    const action = (b.action || "list").toString();

    if (action === "upsert") {
      const id = (b.id || "").toString().trim();
      if (id && !UUID_RX.test(id)) return json({ error: "bad id" }, 400);
      const question = (b.question || "").toString().trim().slice(0, 400);
      if (!question) return json({ error: "question required" }, 400);
      const answer = (b.answer || "").toString().slice(0, 2000);
      const category = (b.category || "general").toString().trim().slice(0, 40) || "general";
      const active = b.active === undefined ? true : b.active === true;
      const r = await rpc("kb_upsert", { p_secret: ING, p_email: email, p_id: id || null, p_question: question, p_answer: answer, p_category: category, p_active: active });
      if (!r.ok) return respostaDeFalha(await motivoDaFalha(r), "upsert");
      // 🚨 "ok" sem id é promessa sem lastro: a RPC devolve o uuid da linha gravada. HTTP 200 com
      // corpo ilegível/nulo NÃO prova que a resposta foi salva.
      const gravado = await r.json().catch(() => null);
      if (!gravado) return json({ ok: false, erro: "a resposta não foi gravada — tente de novo" }, 503);
      // ── SINCRONIZAR A AGENTE DE VOZ: DELIBERADAMENTE **NÃO** LIGADO AQUI (2026-09-27) ──────────
      // A ideia era disparar /api/sync-agent pela porta de serviço (x-guileo-secret = INGEST_SECRET,
      // corpo {email}) num context.waitUntil. Li o sync antes de ligar, e ele NÃO é seguro para
      // rodar a cada resposta salva:
      //   1. `brain` vem SÓ do corpo da requisição (sync-agent.js: `b.brain || ""`). Pela porta de
      //      serviço ele chega vazio, e o prompt é reconstruído com brain = "" + esta base. Tudo que
      //      a dona ensinou na aba "Train your AI" (que mora no navegador dela, não no servidor)
      //      SAIRIA da agente ao vivo, em silêncio, a cada pergunta nova salva aqui. É a família
      //      "regerar perde a marca": consertar um dado apagando outro.
      //   2. o sync não é só prompt: ele também solta/religa números de telefone e faz vários PATCH
      //      na ElevenLabs. Uma dona cadastrando dez perguntas em dois minutos dispararia dez
      //      reconstruções concorrentes da agente que está atendendo cliente.
      // Então a verdade vai NA RESPOSTA: `agente:"pendente"` = gravado na base (o chat do site lê
      // daqui direto), e a agente de VOZ recebe no próximo sync dela. Quem desenha a tela decide a
      // frase — mas não pode mais dizer "já responde com isso" no telefone.
      // PARA LIGAR DE VERDADE: primeiro o sync precisa ler o `brain` do servidor (guardar o que a aba
      // Train your AI envia), e ter um modo "só prompt". Aí sim: waitUntil + conferir `.ok` E o
      // `cerebro_versao` da resposta + emitFailure("kb_sync_falhou", email, …) na falha.
      return json({ ok: true, ready: true, id: gravado, agente: "pendente" });
    }

    if (action === "delete") {
      const id = (b.id || "").toString().trim();
      if (!UUID_RX.test(id)) return json({ error: "bad id" }, 400);
      const r = await rpc("kb_delete", { p_secret: ING, p_email: email, p_id: id });
      if (!r.ok) return respostaDeFalha(await motivoDaFalha(r), "delete", { deleted: false });
      return json({ ok: true, ready: true, deleted: (await r.json().catch(() => false)) === true });
    }

    // default: list
    const r = await rpc("kb_list", { p_secret: ING, p_email: email, p_key: key });
    if (!r.ok) return respostaDeFalha(await motivoDaFalha(r), "list", { count: 0, items: [] });
    // `|| []` aqui juntaria "não consegui ler" com "não tem nada" — e a dona veria a base dela
    // vazia. Corpo ilegível ou que não é lista = falha, com nome.
    // `null` LIDO com sucesso é base vazia (a RPC pode devolver null sem linhas); corpo que não
    // parseia, ou que não é lista, é falha.
    let items;
    try { items = JSON.parse(await r.text()); } catch { items = undefined; }
    if (items === null) items = [];
    if (!Array.isArray(items)) return json({ ok: false, erro: "resposta ilegível do banco", count: 0, items: [] }, 503);
    return json({ ok: true, ready: true, count: items.length, items });
  } catch (e) { return json({ error: String(e).slice(0, 160) }, 400); }
}
