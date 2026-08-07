// functions/lib/customerMemory.js
// ═════════════════════════════════════════════════════════════════════════════
// FOUNDATION 3 — MEMÓRIA DO CLIENTE-DO-CLIENTE.  "A Maria é UMA pessoa, não um canal."
//
// A Maria liga hoje, manda web-chat amanhã, um DM no Instagram depois. Sem esta
// camada, cada canal a trata como uma estranha — ela parece 4 pessoas. Aqui ela é
// UMA: um só perfil por (tenant, contato normalizado), com o histórico agregado de
// TODOS os canais, resumido numa linha que QUALQUER agente injeta ("cliente fiel,
// última visita massagem, 3 no-shows" / "novo").
//
// UNIFICA, NÃO DUPLICA (regra de ouro):
//   • A pessoa canônica JÁ existe → crm_contacts (db/crm_spine.sql).
//   • O histórico 360° JÁ existe → crm_timeline_events (db/crm_phase2.sql).
//   • Esta camada NÃO cria tabela nova. A LEITURA unificada (resolver por telefone OU
//     email + rollup cross-canal) vive em UM RPC: customer_memory_get (db/customer_memory.sql),
//     que ESTENDE crm_caller_context (que só resolvia por telefone → voz).
//   • A ESCRITA delega ao motor CRM que já existe: crm_upsert_contact + crm_log_event.
//     Assim há UMA fonte da verdade do histórico de uma pessoa — não duas.
//
// SEGURANÇA:
//   • TENANT-SCOPED SEMPRE: tudo passa por tenantEmail (client_email). Um tenant NUNCA
//     resolve/lê o cliente de outro — o RPC filtra por p_email no servidor.
//   • INGEST-gated na leitura (mesmo literal de crm_caller_context — devolve PII).
//   • DEGRADAÇÃO HONESTA: RPC ausente / secret errado / rede caída ⇒ { known:false, line:"" }.
//     Nunca lança, nunca quebra a conversa. Um agente sem memória ainda atende — só não
//     reconhece. Contato sem telefone E sem email ⇒ { known:false } (nada a resolver).
// ═════════════════════════════════════════════════════════════════════════════

import { sbKey } from "./sb.js";
const SB = "https://ynihodbknhjirkdogxby.supabase.co";
// Same anon fallback guiBrain.js / widget-chat.js / stripe-webhook.js use (env rotates it).
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";
// Same literals the pipelines gate on (Supabase forbids a GUC → hardcoded, env overrides).
const INGEST_FALLBACK = ""; // read gate (customer_memory_get / crm_caller_context)
const SCHED_FALLBACK  = "";  // write gate (crm_upsert_contact / crm_log_event)

const rpc = (env, name, body) => fetch(`${SB}/rest/v1/rpc/${name}`, {
  method: "POST",
  headers: { apikey: sbKey(env), Authorization: `Bearer ${sbKey(env)}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const norm = (s) => (s || "").toString().trim().toLowerCase();

// Accept a string ("+15551234567" or "maria@x.com") OR an object { phone, email, session }.
// Returns { phone, email } — the two identifiers customer_memory_get resolves a person by.
// A raw web-chat sessionId is NOT an identity (it can't be recognized across channels), so it
// is deliberately ignored here — recognition needs a real phone or email the visitor shared.
function idOf(contact) {
  if (!contact) return { phone: "", email: "" };
  if (typeof contact === "string") {
    const s = contact.trim();
    return s.includes("@") ? { phone: "", email: s } : { phone: s, email: "" };
  }
  return {
    phone: (contact.phone || contact.from || contact.tel || "").toString().trim(),
    email: (contact.email || contact.contact_email || "").toString().trim(),
  };
}

// ── summarize ─────────────────────────────────────────────────────────────────
// THE single place that turns the memory fields into the short line every agent injects.
// One formatter → every channel greets Maria with the identical framing. English + concise
// on purpose: it enters the agent's prompt as CONTEXT (data), and the agent greets in the
// customer's own language. Empty string for an unknown person (caller treats as "new").
export function summarize(mem) {
  if (!mem || !mem.known) return "";
  const bits = [];
  const life = norm(mem.lifecycle);
  const visits = Number(mem.visits_count || 0);
  if (life === "vip") bits.push("VIP customer");
  else if (life === "loyal" || visits >= 4) bits.push("loyal returning customer");
  else if (life === "lapsed" || life === "churned") bits.push("returning after a gap");
  else if (visits >= 1) bits.push("returning customer");
  else bits.push("known contact");
  if (mem.name) bits.unshift(String(mem.name).slice(0, 60));
  if (mem.last_service) bits.push(`last visit: ${String(mem.last_service).slice(0, 60)}`);
  else if (mem.last_summary) bits.push(String(mem.last_summary).slice(0, 80));
  const ns = Number(mem.no_shows || 0);
  if (ns > 0) bits.push(`${ns} no-show${ns > 1 ? "s" : ""}`);
  const ltv = Number(mem.ltv_cents || 0);
  if (ltv >= 20000) bits.push(`$${Math.round(ltv / 100)} lifetime`);
  const chans = Array.isArray(mem.channels) ? mem.channels.filter(Boolean) : [];
  if (chans.length > 1) bits.push(`across ${chans.length} channels`);
  return bits.join(", ");
}

// ── getCustomer ────────────────────────────────────────────────────────────────
// Resolve the ONE person behind a phone/email for this tenant, with a cross-channel rollup.
// READ-ONLY by default (safe to call on every chat turn / ring — no side effects, no visit bump).
// Pass { create:true } to materialize the contact spine when missing (delegates to the CRM
// write path, never a private table). Never throws. Always tenant-scoped by tenantEmail.
//
//   getCustomer(env, "salon@x.com", { phone:"+15551234567" })
//     → { known:true, id, name, line:"Maria, loyal returning customer, last visit: Massage, 1 no-show",
//         lifecycle, visits, noShows, channels, ltvCents, lastVisit, lastService, lastSummary, raw }
//   unknown / RPC not pasted / offline → { known:false, line:"" }
export async function getCustomer(env, tenantEmail, contact, opts = {}) {
  const tenant = norm(tenantEmail);
  const { phone, email } = idOf(contact);
  const miss = { known: false, line: "" };
  if (!tenant || (!phone && !email)) return miss;

  let mem = null;
  try {
    const r = await rpc(env, "customer_memory_get", {
      p_secret: env.INGEST_SECRET || INGEST_FALLBACK,
      p_email: tenant,
      p_phone: phone || null,
      p_contact_email: email || null,
    });
    if (r.ok) mem = await r.json().catch(() => null);
  } catch { /* honest degradation → treated as unknown below */ }

  if (mem && mem.known) {
    return {
      known: true,
      id: mem.id || null,
      name: mem.name || "",
      lifecycle: mem.lifecycle || "lead",
      visits: Number(mem.visits_count || 0),
      ltvCents: Number(mem.ltv_cents || 0),
      noShows: Number(mem.no_shows || 0),
      channels: Array.isArray(mem.channels) ? mem.channels : [],
      lastVisit: mem.last_visit || null,
      lastService: mem.last_service || "",
      lastSummary: mem.last_summary || "",
      line: summarize(mem),
      raw: mem,
    };
  }

  // Unknown AND asked to create → materialize the spine via the EXISTING CRM writer (SCHED-gated).
  // We do NOT insert into any table here — one write path only.
  if (opts.create) {
    try {
      await rpc(env, "crm_upsert_contact", {
        p_secret: env.SCHED_SECRET || SCHED_FALLBACK,
        p_email: tenant, p_phone: phone || "", p_contact_email: email || "",
        p_name: (opts.name || "").toString().slice(0, 120),
        p_source: (opts.source || "").toString().slice(0, 60),
        p_amount_cents: 0,
      });
    } catch { /* best-effort; unknown result below */ }
  }
  return miss;
}

// ── rememberInteraction ─────────────────────────────────────────────────────────
// Record that this person interacted, on THIS channel — so the next touch on ANY channel
// remembers it. Delegates to the CRM spine: crm_upsert_contact (resolve/create + bump/last_seen
// + LTV) then crm_log_event (append to the 360° timeline, idempotent via dedupe). No private
// table, no duplicated history. Never throws; missing SCHED secret ⇒ no-op (honest).
//
//   rememberInteraction(env, "salon@x.com", { phone:"+1555…", name:"Maria" },
//     { channel:"whatsapp", type:"message", summary:"Asked about Saturday massage",
//       amountCents:0, dedupe:"wa:msg:123", source:"whatsapp" })
//     → { ok:true, contactId } | { ok:false }
export async function rememberInteraction(env, tenantEmail, contact, ev = {}) {
  const tenant = norm(tenantEmail);
  const { phone, email } = idOf(contact);
  if (!tenant || (!phone && !email)) return { ok: false };
  const sched = env.SCHED_SECRET || SCHED_FALLBACK;

  let contactId = null;
  try {
    const ur = await rpc(env, "crm_upsert_contact", {
      p_secret: sched, p_email: tenant, p_phone: phone || "", p_contact_email: email || "",
      p_name: (contact && contact.name ? String(contact.name) : "").slice(0, 120),
      p_source: (ev.source || ev.channel || "").toString().slice(0, 60),
      p_amount_cents: Math.max(0, Math.round(Number(ev.amountCents || 0))),
    });
    if (ur.ok) contactId = (await ur.json().catch(() => null)) || null;
  } catch { return { ok: false }; }

  // Append to the shared 360° timeline (best-effort — crm_phase2 may not be pasted yet).
  if (contactId && (ev.summary || ev.type)) {
    try {
      await rpc(env, "crm_log_event", {
        p_secret: sched, p_email: tenant, p_contact_id: contactId,
        p_type: (ev.type || "note").toString().slice(0, 24),
        p_channel: (ev.channel || "").toString().slice(0, 24),
        p_summary: (ev.summary || "").toString().slice(0, 400),
        p_amount_cents: Math.max(0, Math.round(Number(ev.amountCents || 0))),
        p_dedupe: ev.dedupe ? String(ev.dedupe).slice(0, 120) : null,
        p_payload: ev.payload && typeof ev.payload === "object" ? ev.payload : {},
      });
    } catch { /* timeline is optional; contact already upserted */ }
  }
  return { ok: true, contactId };
}
