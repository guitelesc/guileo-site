// ───────────────────────────────────────────────────────────────────────────
// Guileo Growth Cockpit — central data / service layer.
//
// THE ONLY PLACE TO "CONNECT THE BACKEND".
// Today it runs in DEMO mode (mock data + simulated latency), but every screen
// already calls through this layer. To go live, set these in Cloudflare env:
//     VITE_SUPABASE_URL        = https://xxxx.supabase.co
//     VITE_SUPABASE_ANON_KEY   = eyJhbGci...
// …then implement the `// CONNECT:` branches below. No screen changes needed.
// ───────────────────────────────────────────────────────────────────────────

import { supabase, hasSupabase } from "./supabase.js";

/** True once real backend keys are present. UI shows "Demo" until then. */
export const CONNECTED = hasSupabase;

const wait = (ms = 320) => new Promise((r) => setTimeout(r, ms));
const SESSION_KEY = "guileo_portal_session";

// ── LINK DE RECUPERAÇÃO DE SENHA — lido NA CARGA do módulo, de propósito ──────────────────────
// O link do e-mail "esqueci a senha" volta em /portal#access_token=…&type=recovery. O cliente
// Supabase consome esse hash sozinho (detectSessionInUrl) e APAGA o hash em seguida; o evento
// PASSWORD_RECOVERY sai uma vez só, e pode sair ANTES de o Portal montar e se inscrever. Quem
// dependesse só do evento perderia a corrida: a pessoa cairia logada no painel sem nunca ver o
// campo de senha nova — e continuaria sem saber a senha na próxima vez.
// Por isso a marca é guardada aqui (import roda antes de qualquer efeito do React) e o evento,
// quando chega a tempo, só confirma. Link vencido volta como #error_code=otp_expired: guardado
// também, para a tela de login dizer o que houve em vez de parecer que nada aconteceu.
const _hashInicial = (() => { try { return typeof window !== "undefined" ? (window.location.hash || "") : ""; } catch { return ""; } })();
let _recuperacao = /(^|[#&])type=recovery(&|$)/.test(_hashInicial);
// CONTA REAL = existe sessão de verdade (Supabase), tenha ou não a chave de conexão. É síncrono de
// propósito: componentes que não recebem `me` (MorningBriefing, montado pelo Overview) precisam
// saber, NA HORA de desenhar, se estão diante de um visitante da vitrine ou de quem paga — para
// nunca desenhar número de amostra com cara de número do cliente.
let _contaReal = false;
const _erroDoLink = (() => { try { const m = _hashInicial.match(/(?:^|[#&])error_code=([^&]+)/); return m ? decodeURIComponent(m[1]) : ""; } catch { return ""; } })();

// ── Background sync to Supabase (NO TABLE / NO SQL needed) ──
// localStorage stays the synchronous source of truth (instant UI); the account's
// config state is mirrored into the user's own Supabase record (user_metadata.kv),
// so it persists across devices. Bulky demo feeds (created:* lists) are NOT synced,
// keeping the blob small. Writes are debounced.
let _uid = null;                       // current auth user id (set on hydrate)
let _cloud = {};                       // full key→value blob mirrored to the cloud
let _flushTimer = null;
const _syncable = (key) => !key.includes(":created:");   // skip bulky demo records
const _pendentes = new Set();          // chaves na fila que AINDA não subiram para a nuvem
function _queueUpsert(key, value) {
  if (!supabase || !_uid || !_syncable(key)) return;
  _cloud[key] = value;
  _pendentes.add(key);
  if (_flushTimer) return;
  _flushTimer = setTimeout(_flush, 900);
}
let _warnedSync = false;
let _tentativas = 0;
async function _flush() {
  _flushTimer = null;
  if (!supabase || !_uid) return;
  const subindo = [..._pendentes];
  try {
    // 🚨 `updateUser` NÃO LEVANTA em erro de API — ele DEVOLVE `{ error }` (2026-09-28). O `catch`
    // antigo nunca disparava, então a falha de sincronia era muda, e o aviso prometia um "vou
    // tentar de novo" que não existia em lugar nenhum. Agora o erro é lido, e a nova tentativa existe.
    const { error } = await supabase.auth.updateUser({ data: { kv: _cloud } });
    if (error) throw error;
    subindo.forEach((k) => _pendentes.delete(k));
    _warnedSync = false; _tentativas = 0;
  } catch {
    if (!_warnedSync) { _warnedSync = true; toast("Saved locally — couldn't sync to the cloud just now. I'll retry."); }
    if (_tentativas < 3 && !_flushTimer) { _tentativas++; _flushTimer = setTimeout(_flush, 15000 * _tentativas); }
  }
}
// Best-effort durability: if the tab closes within the 900ms debounce window, fire the
// pending cloud sync immediately so a just-made change isn't lost (localStorage is already
// written synchronously by saveState — this only rescues the cloud mirror).
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => { if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; _flush(); } });
}

// ── REAL CLIENT DATA — the gui_actions Supabase project (separate from the auth
// project above). URL + anon key are PUBLIC by design (already shipped in /admin
// and /live); the access key in the RPC is what gates each client's data. ──
const DATA_SB_URL = "https://ynihodbknhjirkdogxby.supabase.co";
const DATA_SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
const DATA_KEY_LS = "guileo_data_key";

// ── ACESSO NOMINAL DE PARCEIRO (CR-03, 2026-10-13) ───────────────────────────────────────────────
// A Scale Pods entra com o usuário dela (Supabase Auth) e, depois do código por e-mail, o navegador
// guarda QUAL cliente ela está operando. session() então devolve o e-mail do CLIENTE (é o que toda
// RPC usa) com o nome do parceiro no cabeçalho — e hydrate() não grava nada na conta do parceiro.
const PARCEIRO_LS = "guileo_parceiro";
export function parceiroAtivo() { try { return JSON.parse(localStorage.getItem(PARCEIRO_LS) || "null"); } catch { return null; } }
export function parceiroEntrar(o) { try { localStorage.setItem(PARCEIRO_LS, JSON.stringify(o)); } catch { /* private mode */ } }
export function parceiroSair() { try { localStorage.removeItem(PARCEIRO_LS); localStorage.removeItem(DATA_KEY_LS); } catch { /* */ } }

/** Fetch the logged-in client's REAL data (credits, plan, events) from the backend.
 *  Returns { credits, plan, events:[{id,created_at,type,channel,summary,amount}] }
 *  or null on ANY failure (wrong key, network, malformed) — never throws to the UI. */
export async function fetchRealData(email, key) {
  const r = await fetchRealDataDetalhado(email, key);
  return r.data;                                   // contrato antigo, intacto para quem já chama
}

/* 🚨 POR QUE ESTA VERSÃO EXISTE (2026-08-20, auditoria da área do cliente).
   A original devolvia `null` em QUALQUER falha — rede caída, 500 do banco, JSON quebrado e chave
   ERRADA eram indistinguíveis. E `null` desliga a camada de honestidade INTEIRA do cockpit de uma
   vez: os KPIs voltam a ser `V.kpis`, a receita vira `V.impact.total`, a agenda vira exemplo, e os
   selos vermelhos reaparecem. Ou seja, UM PISCAR DE REDE fazia um cliente PAGANTE ler números
   fabricados como se fossem dele — e o aviso ainda o culpava: "cole seu código de conexão", para
   quem já tinha colado.
   Agora o motivo vem junto. Quem chama decide o que dizer: chave errada é uma conversa,
   rede caída é outra, e nenhuma das duas é "seus números são estes". */
export async function fetchRealDataDetalhado(email, key) {
  if (!email || !key) return { data: null, motivo: "sem_credencial" };
  try {
    const r = await fetch(`${DATA_SB_URL}/rest/v1/rpc/get_client_data`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: DATA_SB_ANON, Authorization: `Bearer ${DATA_SB_ANON}` },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    // 400/401/403 = a chave não confere. 5xx = o banco caiu. São problemas DIFERENTES.
    if (!r.ok) return { data: null, motivo: r.status >= 500 ? "servidor" : "chave_invalida", http: r.status };
    const data = await r.json();
    if (!data || typeof data !== "object" || !Array.isArray(data.events)) return { data: null, motivo: "resposta_estranha" };
    return { data, motivo: null };
  } catch (e) { return { data: null, motivo: "rede", detalhe: String(e).slice(0, 120) }; }
}

/* ── EQUIPE E FILA DE ESPERA REAIS (2026-08-20) ────────────────────────────────────────────────
   Duas telas do cockpit desenhavam gente gerada enquanto o banco já tinha a coisa real:
   `biz_professionals` (11 profissionais cadastrados) e `biz_waitlist` (com motor de entrada).
   🚨 DEVOLVEM {dados, motivo}, nunca `[]` seco. "Não consegui ler" e "não tem ninguém" são
   estados DIFERENTES: o primeiro pede tentar de novo, o segundo é a verdade do negócio. Foi o
   `|| []` juntando os dois que já produziu cinco diagnósticos falsos neste repositório. */
async function _bizLista(rpc, email, key) {
  if (!email || !key) return { dados: null, motivo: "sem_credencial" };
  try {
    const r = await fetch(`${DATA_SB_URL}/rest/v1/rpc/${rpc}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: DATA_SB_ANON, Authorization: `Bearer ${DATA_SB_ANON}` },
      body: JSON.stringify({ p_email: email, p_key: key }),
    });
    if (!r.ok) return { dados: null, motivo: r.status >= 500 ? "servidor" : "chave_invalida" };
    const d = await r.json();
    return Array.isArray(d) ? { dados: d, motivo: null } : { dados: null, motivo: "resposta_estranha" };
  } catch { return { dados: null, motivo: "rede" }; }
}
export const fetchEquipe   = (email, key) => _bizLista("biz_team_list", email, key);
export const fetchFilaEspera = (email, key) => _bizLista("biz_waitlist_list", email, key);
export const fetchPedidos  = (email, key) => _bizLista("biz_orders_list", email, key);
export const fetchCatalogo = (email, key) => _bizLista("biz_catalogo_list", email, key);
export const fetchCanais   = (email, key) => _bizLista("biz_canais_list", email, key);

/** Move um pedido de coluna na Cozinha. Devolve {ok, motivo} — nunca um boolean solto: "não
 *  gravou" e "gravou" precisam chegar diferentes na tela, senão o cartão anda sem lastro. */
export async function setPedidoStatus(email, key, id, status) {
  if (!email || !key || !id) return { ok: false, motivo: "sem_credencial" };
  try {
    const r = await fetch(`${DATA_SB_URL}/rest/v1/rpc/biz_order_status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: DATA_SB_ANON, Authorization: `Bearer ${DATA_SB_ANON}` },
      body: JSON.stringify({ p_email: email, p_key: key, p_id: id, p_status: status }),
    });
    if (!r.ok) return { ok: false, motivo: `HTTP ${r.status}` };
    const d = await r.json().catch(() => null);
    return d?.ok === true ? { ok: true } : { ok: false, motivo: d?.motivo || "não gravou" };
  } catch (e) { return { ok: false, motivo: String(e).slice(0, 80) }; }
}

// ── REAL INBOX (client_messages) — four RPCs on the same gui_actions data project,
// gated by the same email+key validator as fetchRealData. All are best-effort: they
// return [] / null on ANY failure (bad key 403/28000, network, malformed) and NEVER
// throw to the UI, so the Inbox can always fall back to the honest empty state. ──
async function _dataRpc(name, body) {
  try {
    const r = await fetch(`${DATA_SB_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: DATA_SB_ANON, Authorization: `Bearer ${DATA_SB_ANON}` },
      body: JSON.stringify(body),
    });
    if (!r.ok) return null; // includes 403 / code 28000 when the key doesn't match
    return await r.json();
  } catch { return null; }
}

// ── Read cache: TTL + in-flight dedupe + stale-while-revalidate ──────────────
// Read-only fetchers below route through _cached(). Same (fn,email,key[,extra])
// within 45s serves the memoized value; concurrent callers share one in-flight
// request (dedupe); a stale entry is returned immediately while it refreshes in
// the background (SWR). Mutations NEVER cache and call _invalidate(domain) to
// drop the memo for their domain so the next read re-fetches fresh.
const _CACHE_TTL = 45000;
const _cache = new Map();     // key -> { at, value }
const _inflight = new Map();  // key -> Promise
// Which domain each cached fetcher belongs to (for targeted invalidation).
const _DOMAIN = {
  fetchConversations: "inbox", fetchThread: "inbox", fetchCallLogs: "inbox",
  fetchCRM: "crm", fetchLeadsToday: "crm", fetchCrmInvoices: "crm", fetchCrmCampaigns: "crm",
  fetchCrmDeals: "crm", fetchCrmTimeline: "crm", fetchMarketingDates: "crm", fetchContracts: "crm",
  fetchNoshowRadar: "noshow", fetchAppointments: "noshow",
};
const _ck = (fn, email, key, extra) => `${fn}|${email || ""}|${key || ""}${extra != null ? "|" + extra : ""}`;

function _cached(fn, email, key, loader, extra) {
  const k = _ck(fn, email, key, extra);
  const hit = _cache.get(k);
  if (hit && Date.now() - hit.at < _CACHE_TTL) return Promise.resolve(hit.value); // fresh
  const infl = _inflight.get(k);
  if (infl) return infl;                                                          // dedupe
  const p = Promise.resolve()
    .then(loader)
    .then((v) => { _cache.set(k, { at: Date.now(), value: v }); _inflight.delete(k); return v; })
    .catch((e) => { _inflight.delete(k); if (hit) return hit.value; throw e; });  // SWR on failure
  _inflight.set(k, p);
  if (hit) return Promise.resolve(hit.value);  // SWR: serve stale now, refresh in background
  return p;
}

function _invalidate(domain) {
  for (const k of [..._cache.keys()]) if (_DOMAIN[k.split("|")[0]] === domain) _cache.delete(k);
  for (const k of [..._inflight.keys()]) if (_DOMAIN[k.split("|")[0]] === domain) _inflight.delete(k);
}

/** All conversation threads for this client → [{channel, contact, last, last_at, unread}] (or []). */
export async function fetchConversations(email, key) {
  if (!email || !key) return [];
  return _cached("fetchConversations", email, key, async () => {
    const data = await _dataRpc("client_conversations", { p_email: email, p_key: key });
    return Array.isArray(data) ? data : [];
  });
}

/** One thread's messages oldest→newest → [{direction, body, created_at}] (or []). */
export async function fetchThread(email, key, channel, contact) {
  if (!email || !key) return [];
  return _cached("fetchThread", email, key, async () => {
    const data = await _dataRpc("client_thread", { p_email: email, p_key: key, p_channel: channel, p_contact: contact });
    return Array.isArray(data) ? data : [];
  }, `${channel}|${contact}`);
}

/** Insert an outbound message → {ok:true} (or null on failure). */
export async function sendRealMessage(email, key, channel, contact, body) {
  if (!email || !key) return null;
  const r = await _dataRpc("client_send_message", { p_email: email, p_key: key, p_channel: channel, p_contact: contact, p_body: body });
  _invalidate("inbox"); // a sent message changes threads/unread → drop stale reads
  return r;
}

/** Mark a thread's inbound messages read → {ok:true} (or null). Best-effort. */
export async function markThreadRead(email, key, channel, contact) {
  if (!email || !key) return null;
  const r = await _dataRpc("client_mark_read", { p_email: email, p_key: key, p_channel: channel, p_contact: contact });
  _invalidate("inbox"); // unread counts changed
  return r;
}

/** Real calls WITH per-call analysis + full transcript → [{id,created_at,summary,sentiment,
 *  intent,note,duration_secs,success,end_reason,amount,transcript}] (or []). Best-effort:
 *  goes through our own /api/call-logs (validates the key, reads the owned project). */
export async function fetchCallLogs(email, key) {
  if (!email || !key) return [];
  return _cached("fetchCallLogs", email, key, async () => {
    try {
      const r = await fetch("/api/call-logs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, key }),
      });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d?.calls) ? d.calls : [];
    } catch { return []; }
  });
}

/** The business's REAL upcoming appointments (booked by Gui) → [{id,when,ends,customer,contact,
 *  service,pro,location,status,ref}] (or []). Best-effort via /api/appointments. */
export async function fetchAppointments(email, key) {
  if (!email || !key) return [];
  return _cached("fetchAppointments", email, key, async () => {
    try {
      const r = await fetch("/api/appointments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, key }),
      });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d?.appointments) ? d.appointments : [];
    } catch { return []; }
  });
}

/** Unified CRM contact spine (the 360° book). POST {token,email} -> {ready,count,contacts}.
 *  Gracefully returns ready:false until db/crm_spine.sql is pasted in Supabase.
 *  `falha:true` = NÃO CONSEGUI LER (HTTP de erro / rede) — diferente de "ainda não ativado".
 *  Sem essa marca, um 500 ou um wifi caído apareciam na tela como "estamos ativando". */
export async function fetchCRM(key, email) {
  if (!key) return { ready: false, count: 0, contacts: [], note: "" };
  return _cached("fetchCRM", email, key, async () => {
    try {
      const r = await fetch("/api/crm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: key, email: email || "" }),
      });
      if (!r.ok) return { ready: false, count: 0, contacts: [], note: "", falha: true };
      const d = await r.json();
      return {
        ready: !!d?.ready,
        count: Number(d?.count) || 0,
        contacts: Array.isArray(d?.contacts) ? d.contacts : [],
        note: d?.note || "",
      };
    } catch { return { ready: false, count: 0, contacts: [], note: "", falha: true }; }
  });
}

/** Today's NEW leads (crm_leads_today) grouped-ready → {ready,count,leads:[{id,name,phone,
 *  channel,source,created_at,status}]}. Gracefully returns ready:false until the RPC is pasted. */
export async function fetchLeadsToday(key, email) {
  if (!key) return { ready: false, count: 0, leads: [], note: "" };
  return _cached("fetchLeadsToday", email, key, async () => {
    try {
      const r = await fetch("/api/crm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leads_today", token: key, email: email || "" }),
      });
      if (!r.ok) return { ready: false, count: 0, leads: [], note: "" };
      const d = await r.json();
      return {
        ready: !!d?.ready,
        count: Number(d?.count) || 0,
        leads: Array.isArray(d?.leads) ? d.leads : [],
        note: d?.note || "",
      };
    } catch { return { ready: false, count: 0, leads: [], note: "" }; }
  });
}

/** 📞 Ask Gui to call a lead back (crm_lead_callback → logs a client_event 'callback', the same
 *  callback path the funnel uses). Returns {ok} — best-effort, never throws to the UI. */
export async function requestGuiCallback(key, email, lead = {}) {
  if (!key) return { ok: false };
  try {
    const r = await fetch("/api/crm", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lead_callback", token: key, email: email || "", lead_id: lead.id || "", phone: lead.phone || "", name: lead.name || "" }),
    });
    if (!r.ok) return { ok: false };
    const d = await r.json();
    _invalidate("crm"); // callback logs a client_event → lead lists may change
    return { ok: !!d?.ok };
  } catch { return { ok: false }; }
}

/** Marketing dates & birthday config (marketing_dates_list) → {ready,dates:[{id,kind,label,
 *  month,day,message,offer,active}],note}. Birthday config is the row with kind:'birthday'.
 *  Gracefully returns ready:false until db marketing_dates SQL is pasted. */
export async function fetchMarketingDates(key, email) {
  if (!key) return { ready: false, dates: [], note: "" };
  return _cached("fetchMarketingDates", email, key, async () => {
    try {
      const r = await fetch("/api/crm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "marketing_dates", token: key, email: email || "" }),
      });
      if (!r.ok) return { ready: false, dates: [], note: "" };
      const d = await r.json();
      return { ready: !!d?.ready, dates: Array.isArray(d?.dates) ? d.dates : [], note: d?.note || "" };
    } catch { return { ready: false, dates: [], note: "" }; }
  });
}

/** Add / edit a marketing date or birthday config (marketing_dates_set). Pass {id?,kind,label,
 *  month,day,message,offer,active}. Returns {ok,ready,date,note} — best-effort. */
export async function saveMarketingDate(key, email, date = {}) {
  if (!key) return { ok: false, ready: false };
  try {
    const r = await fetch("/api/crm", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "marketing_date_set", token: key, email: email || "", date }),
    });
    if (!r.ok) return { ok: false, ready: false };
    const d = await r.json();
    _invalidate("crm"); // marketing dates changed
    return { ok: !!d?.ok, ready: d?.ready !== false, date: d?.date || null, note: d?.note || "" };
  } catch { return { ok: false, ready: false }; }
}

/** Remove a commemorative date (marketing_dates_delete). Returns {ok} — best-effort. */
export async function deleteMarketingDate(key, email, id) {
  if (!key || !id) return { ok: false };
  try {
    const r = await fetch("/api/crm", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "marketing_date_delete", token: key, email: email || "", id }),
    });
    if (!r.ok) return { ok: false };
    const d = await r.json();
    _invalidate("crm"); // a marketing date was removed
    return { ok: !!d?.ok };
  } catch { return { ok: false }; }
}

/** Contracts & quotes for the tenant (contract_list). Returns [] gracefully. */
export async function fetchContracts(key, email) {
  if (!key) return [];
  return _cached("fetchContracts", email, key, async () => {
    try {
      const r = await fetch("/api/contract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list", token: key, email: email || "" }) });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d?.docs) ? d.docs : [];
    } catch { return []; }
  });
}

/** Finance A/R — invoices (crm_invoices_list). Returns [] gracefully. */
export async function fetchCrmInvoices(key, email) {
  if (!key) return [];
  return _cached("fetchCrmInvoices", email, key, async () => {
    try {
      const r = await fetch("/api/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "invoices", token: key, email: email || "" }) });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d?.invoices) ? d.invoices : [];
    } catch { return []; }
  });
}

/** Marketing — campaigns (crm_campaigns_list). Returns [] gracefully. */
export async function fetchCrmCampaigns(key, email) {
  if (!key) return [];
  return _cached("fetchCrmCampaigns", email, key, async () => {
    try {
      const r = await fetch("/api/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "campaigns", token: key, email: email || "" }) });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d?.campaigns) ? d.campaigns : [];
    } catch { return []; }
  });
}

/** Upcoming appointments ranked by no-show risk (noshow_risk RPC). Returns {ready,highRisk,appointments}. */
export async function fetchNoshowRadar(key, email, days = 7) {
  if (!key) return { ready: false, highRisk: 0, appointments: [] };
  return _cached("fetchNoshowRadar", email, key, async () => {
    try {
      const r = await fetch("/api/noshow-radar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: key, email: email || "", days }),
      });
      if (!r.ok) return { ready: false, highRisk: 0, appointments: [] };
      const d = await r.json();
      return { ready: !!d?.ready, highRisk: Number(d?.highRisk) || 0, appointments: Array.isArray(d?.appointments) ? d.appointments : [] };
    } catch { return { ready: false, highRisk: 0, appointments: [] }; }
  }, days);
}

/** 👻 Mark an appointment as a no-show (feeds the risk model). Returns {ok,marked} — never throws. */
export async function markNoshow(key, email, appointmentId) {
  if (!key || !appointmentId) return { ok: false, marked: false };
  try {
    const r = await fetch("/api/noshow-radar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: key, email: email || "", action: "mark_noshow", appointment_id: appointmentId }),
    });
    if (!r.ok) return { ok: false, marked: false };
    const d = await r.json();
    _invalidate("noshow"); // radar/appointments changed
    return { ok: !!d?.ok, marked: !!d?.marked };
  } catch { return { ok: false, marked: false }; }
}

/** ✅ Log an extra-confirmation nudge (client_event 'confirm-nudge' → shows in the feed). Best-effort. */
export async function confirmNudge(key, email, appointmentId, name) {
  if (!key) return { ok: false };
  try {
    const r = await fetch("/api/noshow-radar", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: key, email: email || "", action: "confirm", appointment_id: appointmentId || "", name: name || "" }),
    });
    if (!r.ok) return { ok: false };
    const d = await r.json();
    _invalidate("noshow"); // a confirm-nudge event was logged
    return { ok: !!d?.ok };
  } catch { return { ok: false }; }
}

/** The tenant's sales pipeline (crm_deals via crm_deals_list). Returns [] gracefully. */
export async function fetchCrmDeals(key, email) {
  if (!key) return [];
  return _cached("fetchCrmDeals", email, key, async () => {
    try {
      const r = await fetch("/api/crm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deals", token: key, email: email || "" }),
      });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d?.deals) ? d.deals : [];
    } catch { return []; }
  });
}

/** A single contact's 360° timeline (crm_timeline_events). Returns [] gracefully. */
export async function fetchCrmTimeline(key, email, contactId) {
  if (!key || !contactId) return [];
  return _cached("fetchCrmTimeline", email, key, async () => {
    try {
      const r = await fetch("/api/crm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "timeline", token: key, email: email || "", contact_id: contactId }),
      });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d?.events) ? d.events : [];
    } catch { return []; }
  }, contactId);
}

/** Abre um chamado no suporte (/api/support, action:"create") e devolve o COMPROVANTE.
 *  Mesmo contrato que o chat da Gui usa em Support.jsx: `ok:true` sozinho NÃO é sucesso — o
 *  endpoint responde `{ok:true, ready:false}` em HTTP 200 quando o SQL não está colado, e 200
 *  sem id é "não gravei". Só `{id}` é prova.
 *  Devolve {id} ou {tipo, motivo}: `tipo` é para a tela escolher a frase (que passa pelo tr() lá,
 *  este arquivo não enxerga o dicionário); `motivo` é o texto cru, para diagnóstico. */
export async function abrirChamado(email, key, payload = {}) {
  if (!email || !key) return { tipo: "sem_credencial", motivo: "" };
  try {
    const r = await fetch("/api/support", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: key, email, action: "create", ...payload }),
    });
    const d = await r.json().catch(() => null);
    if (!d) return { tipo: "resposta_estranha", motivo: `HTTP ${r.status}` };
    if (d.error) return { tipo: r.status === 401 ? "sem_credencial" : "recusado", motivo: String(d.error).slice(0, 120) };
    if (d.ready === false) return { tipo: "nao_ativado", motivo: "" };   // a nota do servidor é de engenharia — não vai pra tela
    if (d.ok !== true || !d.id) return { tipo: "nao_gravou", motivo: String(d.motivo || "").slice(0, 120) };
    return { id: d.id };
  } catch (e) { return { tipo: "rede", motivo: String(e?.message || e).slice(0, 80) }; }
}

/* ── LEITURAS QUE CONFESSAM (2026-09-28, varredura antes da primeira cliente pagante usar) ─────────
   POR QUE EXISTEM: os leitores acima devolvem `[]` / `{ready:false}` em QUALQUER falha. Para a tela,
   "não consegui ler" e "você não tem nada" chegavam iguais — e a dona de um spa lia um wifi caído
   como "No invoices yet", "0 emergencies", "No calls to analyze yet". Pior: o `_cached` guardava
   esse vazio falso por 45s, então nem o segundo clique consertava.
   O CONTRATO ANTIGO NÃO MUDA (outras telas dependem do formato). As variantes abaixo devolvem
   `{data, motivo}` com motivo ∈ rede | servidor | chave_invalida | sem_credencial | resposta_estranha,
   e uma falha NUNCA entra no cache (o loader levanta, o `_cached` não grava).
   O teto de rede (tetoDeRede.js, 45s) rejeita com AbortError/TimeoutError → cai no catch → "rede". */

/** POST JSON em um endpoint NOSSO e devolve {data, motivo, http, erro}. Nunca levanta.
 *  `data` vem preenchido também na falha quando o servidor mandou corpo JSON — é assim que um 503
 *  com `{error:"…"}` chega legível em vez de virar "resposta ilegível (HTTP 502)".
 *  `erro` é texto CRU do servidor: serve para diagnóstico e para a tela ESCOLHER a frase; não é
 *  para ser impresso ao cliente (já vazou "set MINDBODY_API_KEY in Cloudflare env" assim). */
export async function chamarApi(url, body = {}, { method = "POST", headers = {} } = {}) {
  let r;
  try {
    r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
    });
  } catch (e) { return { data: null, motivo: "rede", http: 0, erro: String(e?.name || e).slice(0, 80) }; }
  let d = null;
  try { d = await r.json(); } catch { d = null; }
  const corpo = d && typeof d === "object" ? d : null;
  const erro = corpo ? String(corpo.error || corpo.erro || corpo.motivo || "").slice(0, 160) : "";
  if (!r.ok) return { data: corpo, motivo: (r.status === 401 || r.status === 403) ? "chave_invalida" : "servidor", http: r.status, erro };
  if (!corpo) return { data: null, motivo: "resposta_estranha", http: r.status, erro: "" };
  // HTTP 200 com `nao_deu_pra_ler` é o servidor dizendo "isto NÃO é um vazio" (padrão do call-logs.js).
  if (corpo.nao_deu_pra_ler === true) return { data: corpo, motivo: "servidor", http: r.status, erro };
  // Mesmo recado em outro formato: `ok:false` + `detalhe_tecnico` no topo é a convenção de
  // "falhou aqui dentro" dos endpoints que respondem 200 de propósito (growth-intel, orcamentos).
  // Recusa de NEGÓCIO (ok:false sem detalhe_tecnico) não entra aqui — a tela decide a frase.
  if (corpo.ok === false && corpo.detalhe_tecnico) return { data: corpo, motivo: "servidor", http: r.status, erro };
  return { data: corpo, motivo: null, http: r.status, erro: "" };
}

// Mesma máquina para todos os leitores detalhados: cache só do que DEU CERTO.
async function _lerDetalhado(fn, email, key, url, body, extrair, extra) {
  if (!key) return { data: null, motivo: "sem_credencial" };
  try {
    const data = await _cached(fn, email, key, async () => {
      const r = await chamarApi(url, body);
      if (r.motivo) { const e = new Error(r.motivo); e.motivo = r.motivo; throw e; }
      const v = extrair(r.data);
      if (v == null) { const e = new Error("resposta_estranha"); e.motivo = "resposta_estranha"; throw e; }
      return v;
    }, extra);
    return { data, motivo: null };
  } catch (e) { return { data: null, motivo: e?.motivo || "rede" }; }
}
Object.assign(_DOMAIN, {
  fetchCallLogsDetalhado: "inbox",
  fetchAppointmentsDetalhado: "noshow", fetchNoshowRadarDetalhado: "noshow",
  fetchLeadsTodayDetalhado: "crm", fetchCrmDealsDetalhado: "crm", fetchCrmInvoicesDetalhado: "crm",
  fetchCrmCampaignsDetalhado: "crm", fetchContractsDetalhado: "crm",
});
const _lista = (campo) => (d) => (Array.isArray(d?.[campo]) ? d[campo] : null);

/** Ligações → {data: [...]|null, motivo}. Lê o `nao_deu_pra_ler` que o servidor já mandava e a
 *  versão antiga ignorava (HTTP 200 + calls:[] = "No calls yet" com a base de ligações fora). */
export const fetchCallLogsDetalhado = (email, key) =>
  (!email ? Promise.resolve({ data: null, motivo: "sem_credencial" })
    : _lerDetalhado("fetchCallLogsDetalhado", email, key, "/api/call-logs", { email, key }, _lista("calls")));

/** Agendamentos reais → {data: [...]|null, motivo}. */
export const fetchAppointmentsDetalhado = (email, key) =>
  (!email ? Promise.resolve({ data: null, motivo: "sem_credencial" })
    : _lerDetalhado("fetchAppointmentsDetalhado", email, key, "/api/appointments", { email, key }, _lista("appointments")));

/** Leads de hoje → {data: {ready,count,leads,note}|null, motivo}. `ready:false` continua sendo
 *  "ainda não ligado" (estado legítimo); falha de leitura agora chega como `motivo`. */
export const fetchLeadsTodayDetalhado = (key, email) =>
  _lerDetalhado("fetchLeadsTodayDetalhado", email, key, "/api/crm", { action: "leads_today", token: key, email: email || "" },
    (d) => ({ ready: !!d?.ready, count: Number(d?.count) || 0, leads: Array.isArray(d?.leads) ? d.leads : [], note: d?.note || "" }));

/** Radar de faltas → {data: {ready,highRisk,appointments}|null, motivo}. */
export const fetchNoshowRadarDetalhado = (key, email, days = 7) =>
  _lerDetalhado("fetchNoshowRadarDetalhado", email, key, "/api/noshow-radar", { token: key, email: email || "", days },
    (d) => ({ ready: !!d?.ready, highRisk: Number(d?.highRisk) || 0, appointments: Array.isArray(d?.appointments) ? d.appointments : [] }), days);

/** Funil de vendas → {data: [...]|null, motivo}. */
export const fetchCrmDealsDetalhado = (key, email) =>
  _lerDetalhado("fetchCrmDealsDetalhado", email, key, "/api/crm", { action: "deals", token: key, email: email || "" }, _lista("deals"));

/** Faturas (contas a receber) → {data: [...]|null, motivo}. */
export const fetchCrmInvoicesDetalhado = (key, email) =>
  _lerDetalhado("fetchCrmInvoicesDetalhado", email, key, "/api/crm", { action: "invoices", token: key, email: email || "" }, _lista("invoices"));

/** Campanhas → {data: [...]|null, motivo}. */
export const fetchCrmCampaignsDetalhado = (key, email) =>
  _lerDetalhado("fetchCrmCampaignsDetalhado", email, key, "/api/crm", { action: "campaigns", token: key, email: email || "" }, _lista("campaigns"));

/** Contratos e orçamentos → {data: [...]|null, motivo}. O antigo engolia o 401 como "nenhum documento". */
export const fetchContractsDetalhado = (key, email) =>
  _lerDetalhado("fetchContractsDetalhado", email, key, "/api/contract", { action: "list", token: key, email: email || "" }, _lista("docs"));

/** The client's "connection code" (access key Luis hands out at onboarding). */
export function loadDataKey() {
  try {
    const raw = localStorage.getItem(DATA_KEY_LS);
    if (!raw) return "";
    return raw.startsWith('"') ? JSON.parse(raw) : raw; // tolerate the JSON form the cloud hydrate writes
  } catch { return ""; }
}

export function saveDataKey(key) {
  const v = (key || "").trim();
  try { v ? localStorage.setItem(DATA_KEY_LS, v) : localStorage.removeItem(DATA_KEY_LS); } catch { /* private mode */ }
  _queueUpsert(DATA_KEY_LS, v); // mirror into the same cloud-kv blob Settings fields use
  return { ok: true };
}

// ── Tiny toast bus (action feedback across every screen) ──
let _toastListeners = [];
export const toast = (text) => _toastListeners.forEach((l) => l(text));
export const onToast = (fn) => { _toastListeners.push(fn); return () => { _toastListeners = _toastListeners.filter((x) => x !== fn); }; };

export const portalApi = {
  connected: CONNECTED,

  /** Current session (or null). */
  async session() {
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const s = data?.session;
      _contaReal = !!s;
      if (!s) return null;
      const par = parceiroAtivo();
      if (par && par.tenant && par.email_parceiro === String(s.user.email || "").toLowerCase()) {
        return { email: par.tenant, name: `${par.nome} · ${par.empresa || "Partner"}`, role: "Partner", demo: false, at: Date.now(), uid: s.user.id, parceiro: true };
      }
      return { email: s.user.email, name: s.user.user_metadata?.name || s.user.email, role: "Owner", demo: false, at: Date.now(), uid: s.user.id };
    }
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
  },

  /** Sign in with email + password. Real backend = Supabase auth. Demo = any creds. */
  async login(email, password) {
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      if (data?.session) { _contaReal = true; await this.hydrate(); return { ok: true, uid: data.user.id }; }
      return { error: "Sign-in failed" };
    }
    await wait();
    const sess = { email: email || "demo@guileoai.com", name: "Jane Staff", role: "Staff", demo: true, at: Date.now() };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(sess)); } catch { /* private mode */ }
    return { ok: true, demo: true };
  },

  /** Create an account. If the project requires email confirmation, returns {confirm:true}. */
  async signUp(email, password) {
    if (!supabase) return this.login(email, password);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (data?.session) { _contaReal = true; await this.hydrate(); return { ok: true, uid: data.user.id }; } // confirmation disabled → instant
    return { confirm: true, email }; // confirmation email sent
  },

  /** "Esqueci a senha" — pede ao Supabase o e-mail com o link de recuperação.
   *  ⚠️ `ok` aqui significa "o pedido foi aceito", NÃO "o e-mail existe": o Supabase responde igual
   *  para conta que existe e conta que não existe (de propósito, para ninguém usar esta tela como
   *  detector de quem é cliente). A frase da tela tem que respeitar isso: "se existe conta, enviamos".
   *  O link volta para /portal, onde `recuperando()` abre o campo de senha nova. */
  async resetPassword(email) {
    const e = (email || "").toString().trim().toLowerCase();
    if (!e.includes("@")) return { error: "invalid email" };
    // 1º pela NOSSA via (/api/senha → Resend). O envio padrão do Supabase tem cota baixa por hora
    // e devolvia "Error sending recovery email" no 2º pedido do dia. 503 = nossa via indisponível
    // → cai para o Supabase, que é o comportamento de antes.
    try {
      let lang = "en"; try { lang = String(localStorage.getItem("guileo_state_portal_lang") || localStorage.getItem("guileo_lang") || document.documentElement.lang || "en").replace(/[^a-z]/gi, "").slice(0, 2).toLowerCase(); } catch { /* */ }
      const r = await fetch("/api/senha", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: e, lang }) });
      if (r.ok) return { ok: true };
      if (r.status === 400) return { error: "invalid email" };
    } catch { /* rede → tenta o Supabase */ }
    if (!supabase) return { error: "not connected" };
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(e, { redirectTo: `${window.location.origin}/portal` });
      if (error) return { error: error.message || "reset failed" };
      return { ok: true };
    } catch (err) { return { error: String(err?.message || err) }; }
  },

  /** Grava a senha nova de quem chegou pelo link de recuperação (a sessão de recuperação já está
   *  aberta). Só devolve ok com o usuário na resposta — sem ele, a troca não é prova de nada. */
  async updatePassword(password) {
    if (!supabase) return { error: "not connected" };
    try {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) return { error: error.message || "update failed" };
      if (!data?.user) return { error: "update failed" };
      _recuperacao = false;
      return { ok: true };
    } catch (err) { return { error: String(err?.message || err) }; }
  },

  /** true quando há sessão real (logada, não-demo) — com ou sem chave de conexão. Síncrono. */
  contaReal() { return _contaReal; },

  /** true enquanto a pessoa chegou por um link de recuperação e ainda não escolheu a senha nova. */
  recuperando() { return _recuperacao; },
  /** A pessoa desistiu de trocar agora (já está logada pelo link) — não pergunta de novo nesta carga. */
  dispensarRecuperacao() { _recuperacao = false; },
  /** Código de erro que veio no link do e-mail (ex.: "otp_expired"), ou "". */
  erroDoLink() { return _erroDoLink; },

  async logout() {
    if (supabase) { try { await supabase.auth.signOut(); } catch { /* */ } }
    _uid = null;
    _contaReal = false;
    _cloud = {};                       // drop the cloud mirror so the next user doesn't inherit it
    if (_flushTimer) { clearTimeout(_flushTimer); _flushTimer = null; }
    try { localStorage.removeItem(SESSION_KEY); } catch { /* private mode */ }
    return true;
  },

  /** Clear a set of state keys from BOTH localStorage and the cloud mirror, then push the
   *  cleared blob — so reset/wipe is durable and deleted data doesn't resurrect on next sync. */
  clearKeys(stateKeys = []) {
    stateKeys.forEach((k) => {
      const full = `guileo_state_${k}`;
      try { localStorage.removeItem(full); } catch { /* */ }
      delete _cloud[full];
    });
    if (supabase && _uid) _flush();    // push the now-smaller blob to the cloud
    return { ok: true };
  },

  /** Pull this user's saved state from Supabase into localStorage (one-time, on sign-in),
   *  so the synchronous loadState() reads work instantly afterward. Returns row count. */
  async hydrate() {
    if (!supabase) return 0;
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return 0;
    _uid = u.user.id;
    // parceiro operando um cliente: nada da nuvem do parceiro entra no navegador, nada sobe
    { const par = parceiroAtivo(); if (par && par.email_parceiro === String(u.user.email || "").toLowerCase()) return 0; }
    const kv = u.user.user_metadata?.kv || {};
    // 🚨 HIDRATAR É JUNTAR, NÃO SUBSTITUIR (2026-09-28). O supabase-js dispara SIGNED_IN toda vez que
    // a aba volta ao foco, e cada um roda isto. A versão antiga fazia `_cloud = {...kv}` e regravava
    // o navegador inteiro com a nuvem: uma configuração editada e ainda na fila de envio era
    // DESFEITA ao trocar de aba. Agora o que está pendente neste aparelho vence a nuvem.
    const pendentes = {};
    _pendentes.forEach((k) => { if (k in _cloud) pendentes[k] = _cloud[k]; });
    // A CHAVE DE CONEXÃO DESTE APARELHO TAMBÉM VENCE: ela acabou de chegar pelo link do e-mail.
    let chaveLocal = "";
    try { chaveLocal = loadDataKey(); } catch { /* */ }
    _cloud = { ...kv, ...pendentes };
    Object.entries(kv).forEach(([k, v]) => {
      if (k in pendentes) return;
      if (k === DATA_KEY_LS && chaveLocal) return;
      try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ }
    });
    // 🚨 A CHAVE NUNCA SUBIA PARA A CONTA. O link `?code=` é aplicado ANTES do login, quando ainda
    // não existe `_uid` — e `_queueUpsert` sem `_uid` não faz nada. Ninguém refazia o pedido depois.
    // Conferido em produção: 0 de 3 contas tinham a chave na nuvem. No segundo aparelho o cliente
    // logava e caía no assistente de demonstração, com aviso de "dados de exemplo".
    // Aqui, já logado, o próprio navegador do cliente espelha a chave dele na conta dele.
    if (chaveLocal && kv[DATA_KEY_LS] !== chaveLocal) _queueUpsert(DATA_KEY_LS, chaveLocal);
    // Ensure a real `clients` row exists/updates on every sign-in, using whatever
    // profile facts we already know from user_metadata. Fully graceful (table may not exist yet).
    try {
      const md = u.user.user_metadata || {};
      const partial = {};
      if (md.name) partial.name = md.name;
      if (md.business) partial.business = md.business;
      if (md.sector) partial.sector = md.sector;
      if (md.contact) partial.contact = md.contact;
      // Fire-and-forget: don't block sign-in hydrate on the clients upsert (runs in the
      // browser, not the Worker; a failure is already swallowed). Frees the UI sooner.
      this.saveClient(partial).catch(() => { /* never throw from hydrate */ });
    } catch { /* never throw from hydrate */ }
    return Object.keys(kv).length;
  },

  /** Upsert the current user's row into the `clients` table on the AUTH project.
   *  Silent no-op if there's no client/session or the table doesn't exist yet. */
  async saveClient(partial = {}) {
    try {
      if (!supabase) return { ok: false };
      const { data } = await supabase.auth.getUser();
      const user = data?.user;
      if (!user) return { ok: false };
      const row = { uid: user.id, email: user.email, ...partial };
      await supabase.from("clients").upsert(row, { onConflict: "uid" });
      return { ok: true };
    } catch { return { ok: false }; }
  },

  /** Subscribe to auth changes; hydrates on sign-in, then calls cb(session|null, event). */
  onAuthChange(cb) {
    if (!supabase) return () => {};
    // 🚨 NADA DE `await supabase.*` AQUI DENTRO (2026-09-28). Espera circular, não trava: a
    // inicialização do auth-js (`_initialize` → `_recoverAndRefresh`) AGUARDA este callback
    // terminar; ele fazia `await this.hydrate()`, e `auth.getUser()` aguarda a inicialização
    // terminar. Um esperava o outro para sempre, e o boot da Central (que espera `getSession()`)
    // ficava atrás dos dois: "Loading your Central…" eterno. Acontece sobretudo quando o token
    // guardado está vencido e sendo renovado — por isso teste logado "normal" nem sempre reproduz.
    // Só travava COM sessão ativa (sem login o callback recebe null e nem chama o hydrate) — ou
    // seja, todo visitante via a tela funcionar e só o cliente pagante logado ficava preso. Foi a
    // dona do Natura Spa clicando no e-mail de acesso que achou.
    // A saída documentada pelo próprio Supabase: o callback fica SÍNCRONO e o trabalho que fala
    // com a API sai da trava num setTimeout(0).
    const { data } = supabase.auth.onAuthStateChange((evt, sess) => {
      if (evt === "PASSWORD_RECOVERY") _recuperacao = true;   // o evento confirma a marca lida do hash
      _contaReal = !!sess?.user;
      if (sess?.user) { setTimeout(() => { this.hydrate().catch(() => { /* hidratar é bônus */ }); }, 0); }
      else { _uid = null; }
      // 2º argumento = o evento. Quem já chamava com um parâmetro só continua igual.
      cb?.(sess ? { email: sess.user.email, uid: sess.user.id } : null, evt);
    });
    return () => data?.subscription?.unsubscribe();
  },

  // ── Data reads/writes route through here too (mock now, real later) ──
  // Each screen passes the demo data it already has; when CONNECTED we ignore
  // the fallback and query Supabase instead. Keeping the same shape = zero UI churn.

  // HONESTY NOTE — there is NO real messages/conversations/alerts table or RPC in the
  // client-data backend (it only exposes the read-only `get_client_data` events ledger via
  // fetchRealData). So for a CONNECTED (real) client we must NOT fabricate records: list()
  // returns empty and the write methods return a soft success without inventing rows. The
  // live screens already source their content from the real `events` ledger and render an
  // honest empty state. In DEMO mode (not connected) we keep returning the mock so the demo
  // still looks alive. The day a real inbox table/RPC lands, wire the CONNECTED branch here.

  async list(table, fallback = []) {
    if (CONNECTED) return []; // honest: no real inbox/conversations backend yet — don't fake it
    await wait(200);          // demo-only: simulated latency keeps the mock feeling alive
    return fallback;
  },

  async sendMessage(channel, conversationId, text) {
    if (CONNECTED) return { ok: true, persisted: false }; // soft success — nothing fabricated/stored
    await wait(150);          // demo-only
    return { ok: true, id: Date.now(), text, at: Date.now() };
  },

  async updateStatus(table, id, status) {
    if (CONNECTED) return { ok: true, persisted: false }; // soft success — no real status store yet
    await wait(120);          // demo-only
    return { ok: true, id, status };
  },

  async resolveAlert(id) {
    if (CONNECTED) return { ok: true, persisted: false }; // soft success — no real alerts store yet
    await wait(120);          // demo-only
    return { ok: true, id };
  },

  // ── AI knowledge base (what the client trains their AI on) ──
  // Persists per-vertical. Demo = localStorage; live = a `kb_entries` table
  // keyed by tenant + vertical. The "Test your AI" sandbox reads from here so
  // training has an immediate, visible effect.
  loadKB(vertical, seed = []) {
    // CONNECT: const { data } = await supabase.from("kb_entries").select("*").eq("vertical", vertical); return data?.length ? data : seed;
    try {
      const raw = localStorage.getItem(`guileo_kb_${vertical}`);
      if (raw) return JSON.parse(raw);
    } catch { /* private mode */ }
    return seed;
  },

  saveKB(vertical, entries) {
    try { localStorage.setItem(`guileo_kb_${vertical}`, JSON.stringify(entries)); } catch { /* private mode */ }
    _queueUpsert(`guileo_kb_${vertical}`, entries);
    return { ok: true, count: entries.length };
  },

  // ── Business profile (name / address / hours / phone) ──
  // Single source of truth for the facts the AI repeats most. Editing it in
  // Settings re-syncs the AI's "location" & "hours" answers (see syncProfileIntoKB).
  loadProfile(vertical, seed = {}) {
    // CONNECT: const { data } = await supabase.from("business_profile").select("*").eq("vertical", vertical).single(); return data || seed;
    try {
      const raw = localStorage.getItem(`guileo_profile_${vertical}`);
      if (raw) return { ...seed, ...JSON.parse(raw) };
    } catch { /* private mode */ }
    return seed;
  },

  saveProfile(vertical, profile) {
    try { localStorage.setItem(`guileo_profile_${vertical}`, JSON.stringify(profile)); } catch { /* private mode */ }
    _queueUpsert(`guileo_profile_${vertical}`, profile);
    return { ok: true };
  },

  // ── Durable UI state (resolved alerts, won deals, filled slots, read flags) ──
  // This is what makes the demo behave like a real connected app: an operator's
  // actions persist across reloads instead of dying with component state.
  // Keyed by an arbitrary scope string (e.g. "Restaurant:alerts"). Live backend
  // would store these as per-tenant rows; the seam stays identical.
  loadState(key, fallback) {
    // CONNECT: read from a `ui_state` table by (tenant, key)
    try {
      const raw = localStorage.getItem(`guileo_state_${key}`);
      if (raw != null) return JSON.parse(raw);
    } catch { /* private mode */ }
    return fallback;
  },

  saveState(key, value) {
    try { localStorage.setItem(`guileo_state_${key}`, JSON.stringify(value)); } catch { /* private mode */ }
    _queueUpsert(`guileo_state_${key}`, value);
    return { ok: true };
  },
};
