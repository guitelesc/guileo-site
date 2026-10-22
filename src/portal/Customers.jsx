/* Split out of Portal.jsx (performance): Customers tab view.
   TRUST FIX: a REAL (signed-in, connected) client now sees ONLY their real CRM contacts —
   the unified contact spine (crm_contacts via /api/crm), the SAME book CRM 360 and every
   department read. Every figure (customer count, lifetime value, per-row spend) comes from
   real rows in CENTS; nothing is fabricated. The fabricated sample book + inflated counters
   (rows.length*104, synthetic timeline, etc.) stay ONLY in demo/tour mode, clearly labelled. */
import { useEffect, useState } from "react";
import { toast, portalApi, loadDataKey, fetchCRM } from "../lib/portalApi.js";
import { waTo } from "../data/contact.js";
import { loadCreated, SECTOR_IQ, genCustomers, convoAction, recordFor, pushCreated, MiniStats, vnum, Card, tr, Empty, Drawer, SectionSkeleton, RetryState, UI_LANG } from "../pages/Portal.jsx";

const LOCALE = { pt: "pt-BR", es: "es-ES", hi: "hi-IN", en: "en-US" };
const money = (cents) => `$${(Math.max(0, Number(cents) || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const fmtSeen = (iso) => { if (!iso) return "—"; const d = new Date(iso); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(LOCALE[UI_LANG] || "en-US"); };
// ESTÁGIO do cliente — preenchido pelo motor diário (crm_classify_sweep / ROTA-CRM-CLASSIFICA).
// Só existe com FATO: quem nunca foi atendido continua "lead" por mais que tenha ligado.
// 🚨 A CHAVE DO tr() É A FRASE EM INGLÊS (2026-09-28). Os rótulos eram "Cliente/Fiel/Sumido" e as
// dicas em português: numa Central em inglês a dona do spa lia o estágio dos contatos dela em
// outro idioma — chave em português não tem tradução para voltar ao inglês.
const STAGE = {
  lead:     { label: "Lead",       color: "#8A8175", hint: "Got in touch, no visit on record yet" },
  customer: { label: "Customer",   color: "#3E9468", hint: "Has at least one visit" },
  loyal:    { label: "Loyal",      color: "#FF8A33", hint: "3 or more visits" },
  dormant:  { label: "Gone quiet", color: "#E2533F", hint: "No visit in over 60 days" },
};
function StageBadge({ value }) {
  const st = STAGE[String(value || "lead").toLowerCase()] || STAGE.lead;
  return (
    <span title={tr(st.hint)} className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: `${st.color}22`, color: st.color }}>{tr(st.label)}</span>
  );
}
// Contato sem nome existe (quem ligou e não disse quem era): a linha mostrava "—" e a dona não
// sabia quem era quem. O telefone ou o e-mail É a identidade que temos — vai no lugar do nome.
const nomeDe = (c) => (c?.full_name || "").toString().trim() || (c?.phone || "").toString().trim() || (c?.email || "").toString().trim() || tr("Unnamed contact");
const temNome = (c) => !!(c?.full_name || "").toString().trim();
const inicialDe = (c) => (temNome(c) ? c.full_name.trim()[0].toUpperCase() : "#");
// Etiquetas vindas do comportamento real ("prefere:Astoria", "servico:Massage"), nunca de palpite.
function TagChips({ tags }) {
  const list = Array.isArray(tags) ? tags : [];
  if (!list.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {list.slice(0, 4).map((t) => {
        const [k, v] = String(t).split(":");
        return <span key={t} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-g-ink">
          {k === "prefere" ? "📍 " : k === "servico" ? "✨ " : ""}{v || t}</span>;
      })}
    </div>
  );
}

// Honest next-best-action derived from REAL fields (churn risk + visit count) — no invented ranking.
// 🚨 A FRASE SEGUE OS NÚMEROS DO CONTATO, NÃO SÓ O RÓTULO (2026-09-28). O ramo "lead" dizia
// "Ligou mas nunca foi atendido" — em português — para um contato com 9 visitas registradas, só
// porque o estágio dele ainda estava "lead". Quando o estágio e a contagem discordam, vale a
// contagem (é fato medido) e a frase diz que o estágio está atrasado. E nenhuma frase promete
// "Gui can send it now": não há botão nesta gaveta que faça a Gui enviar nada.
function realNBA(c) {
  const risk = Number(c.churn_risk) || 0;
  const visits = Number(c.visit_count) || 0;
  const stage = String(c.lifecycle || "lead").toLowerCase();
  if (stage === "dormant") return tr("No visit in over 60 days — a personal invitation back is the move.");
  if (visits === 0) return tr("Got in touch but has no visit on record yet — the next step is to book them.");
  if (stage === "lead") return `${visits} ${tr(visits === 1 ? "visit on record, but the stage still reads Lead — it updates on the next daily review." : "visits on record, but the stage still reads Lead — it updates on the next daily review.")}`;
  if (risk >= 60) return tr("At risk of drifting away — a personal message tends to win them back.");
  if (visits >= 10) return tr("Loyal & frequent — a perfect fit for a membership or subscription to lock in recurring revenue.");
  return tr("Active customer — one well-timed, personal offer usually brings them back.");
}
// Leitura direta (sem o cache de 45s do fetchCRM): é a do botão "tentar de novo" — o cache guarda
// também a resposta de FALHA, então repetir fetchCRM devolveria a mesma falha sem ir à rede.
async function lerCRMDireto(dataKey, email) {
  try {
    const r = await fetch("/api/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: dataKey, email: email || "" }) });
    if (!r.ok) return { ready: false, count: 0, contacts: [], falha: true };
    const d = await r.json();
    return { ready: !!d?.ready, count: Number(d?.count) || 0, contacts: Array.isArray(d?.contacts) ? d.contacts : [] };
  } catch { return { ready: false, count: 0, contacts: [], falha: true }; }
}

// ── REAL customers view — the true contact spine (crm_contacts). Real cents only, honest empty state. ──
function RealCustomers({ V, email, dataKey }) {
  const [data, setData] = useState(null);   // null = fetch in flight
  const [sel, setSel] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchCRM(dataKey, email).then((d) => { if (alive) setData(d || { ready: false, count: 0, contacts: [] }); });
    return () => { alive = false; };
  }, [dataKey, email]);

  if (data === null) return <div className="space-y-4 stagger"><SectionSkeleton rows={6} /></div>;
  // Falha de leitura NÃO é "sua lista está quase pronta": é "não consegui ler", com nova tentativa.
  if (data.falha) return <RetryState onRetry={() => { setData(null); lerCRMDireto(dataKey, email).then(setData); }} />;

  const contacts = Array.isArray(data.contacts) ? data.contacts : [];
  const ltvTotal = contacts.reduce((s, c) => s + (Number(c.ltv_cents) || 0), 0);
  const avg = contacts.length ? Math.round(ltvTotal / contacts.length) : 0;

  // Connected but the contact spine isn't live yet → honest guide, never fabricated data.
  if (!data.ready && contacts.length === 0) {
    return (
      <div className="space-y-4 stagger">
        <Card className="text-center py-10">
          <div className="text-3xl mb-2">👥</div>
          <div className="text-sm font-bold text-g-word">{tr("Your customer book is almost ready")}</div>
          <div className="text-sm text-g-muted mt-1.5 max-w-md mx-auto leading-relaxed">{tr("Gui fills this automatically from every call, message and booking. It'll appear here the moment your first customer is served.")}</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 stagger">
      {/* "Contacts", não "Total customers": a lista inclui quem só ligou e ainda não foi atendido. */}
      <MiniStats items={[["Contacts", `${data.count || contacts.length}`], ["With a visit", `${contacts.filter((c) => (Number(c.visit_count) || 0) > 0).length}`], ["Avg. value", money(avg)], ["Lifetime value", money(ltvTotal), "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Customers")}</span><span className="text-[11px] text-g-muted hidden sm:inline">👆 {tr("tap for profile")}</span></div>
        {contacts.length === 0 ? (
          <Empty icon="🧑" text={tr("No customers yet — Gui adds each one here the moment it books or serves them.")} />
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {contacts.map((c, i) => (
              <button key={c.id || i} onClick={() => setSel(c)} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
                <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-bold text-g-word shrink-0">{inicialDe(c)}</span>
                <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><div className="text-sm font-bold text-g-word truncate">{nomeDe(c)}</div><StageBadge value={c.lifecycle} /></div><div className="text-[11px] text-g-muted truncate">{[temNome(c) ? (c.phone || c.email || "") : tr("No name on file"), `${Number(c.visit_count) || 0} ${tr("visits")}`, fmtSeen(c.last_seen_at)].filter(Boolean).join(" · ")}</div><TagChips tags={c.tags} /></div>
                <span className="text-sm font-extrabold text-g-green shrink-0">{money(c.ltv_cents)}</span>
              </button>
            ))}
          </div>
        )}
      </Card>
      {sel && (
        <Drawer
          title={nomeDe(sel)}
          subtitle={temNome(sel) ? (sel.phone || sel.email || "") : tr("No name on file")}
          badge={(Number(sel.churn_risk) || 0) >= 60 ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#E2533F22", color: "#E2533F" }}>{tr("At risk")}</span> : null}
          fields={[[tr("Stage"), tr((STAGE[String(sel.lifecycle || "lead").toLowerCase()] || STAGE.lead).label)], [tr("Phone"), sel.phone || ""], [tr("Email"), sel.email || ""], [tr("Prefers"), (Array.isArray(sel.tags) ? sel.tags : []).map((t) => String(t).split(":")[1]).filter(Boolean).join(" · ") || "—"], [tr("Lifetime value"), money(sel.ltv_cents)], [tr("visits"), Number(sel.visit_count) || 0], [tr("Preferred channel"), sel.phone ? tr("Phone") : sel.email ? tr("Email") : "—"], [tr("Last seen"), fmtSeen(sel.last_seen_at)], [tr("At churn risk"), `${Number(sel.churn_risk) || 0}%`]]}
          note={<><div className="text-[10px] font-black uppercase text-g-gold mb-1">{tr("⚡ Next best action")}</div>{realNBA(sel)}</>}
          // só telefone abre WhatsApp: `waTo` sem número cai no WhatsApp DA GUILEO, e o contato que
          // só tinha e-mail recebia um botão que mandava a mensagem para o nosso suporte.
          actions={sel.phone
            ? <a href={waTo(sel.phone, temNome(sel) ? `Hi ${sel.full_name.trim()}! ` : "Hi! ")} target="_blank" rel="noopener" className="btn-bright text-sm">{tr("💬 Message")}</a>
            : sel.email
              ? <a href={`mailto:${sel.email}`} className="btn-bright text-sm">✉️ {tr("Email")}</a>
              : null}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

function Customers({ V, onNav, real = null, email: emailProp = "", dataKey: dataKeyProp = "" }) {
  // Real-mode credentials — prefer props; fall back to session + saved key so a connected client
  // never sees a fabricated customer book even if this tab isn't wired with props.
  const [sessEmail, setSessEmail] = useState("");
  const [sessDone, setSessDone] = useState(false);
  const key = dataKeyProp || loadDataKey();
  useEffect(() => {
    if (emailProp) return;
    let alive = true;
    portalApi.session().then((s) => { if (!alive) return; if (s?.email && s?.demo !== true) setSessEmail(s.email); setSessDone(true); });
    return () => { alive = false; };
  }, [emailProp]);
  const email = emailProp || sessEmail;
  const live = !!(key && email);
  const resolving = !!key && !email && !emailProp && !sessDone;

  if (live) return <RealCustomers V={V} email={email} dataKey={key} />;
  if (resolving) return <div className="space-y-4 stagger"><SectionSkeleton rows={6} /></div>;
  return <DemoCustomers V={V} onNav={onNav} />;
}

// Vertical-aware "rebook" verb — Re-order for restaurants/retail, Book again for
// appointment businesses, Schedule visit for field services. (DEMO tour only.)
const REBOOK = { "Restaurant": "Re-order for them", "E-Commerce": "Send re-order link", "Clinic": "Book next visit", "Medical": "Book next visit", "Salon & Spa": "Book next visit", "Gym & Fitness": "Book a session", "Law Firm": "Schedule a call", "Real Estate": "Schedule a viewing", "Plumbing & HVAC": "Schedule service", "Auto Dealership": "Schedule service", "Education": "Book a class", "Construction": "Schedule a site visit" };
// A synthetic recent-activity timeline so each DEMO profile reads like a real CRM record.
function custTimeline(c, V) {
  const noun = (c.noun || "order").replace(/s$/, "");
  const L = V.label, name = c.name;
  // REAL events first — anything the operator actually did for this customer (created:* records).
  const real = [];
  loadCreated(L, "liveorders").filter((o) => o.customer === name).forEach((o) => real.push({ t: "just now", ev: `Order ${o.id} created · ${o.channel}`, ic: "🧾", real: true }));
  loadCreated(L, "schedule").filter((o) => o.name === name).forEach((o) => real.push({ t: "just now", ev: `Booked · ${o.meta || "appointment"}`, ic: "📅", real: true }));
  loadCreated(L, "deliveries").filter((o) => o.customer === name).forEach((o) => real.push({ t: "just now", ev: `Delivery · ${o.status}`, ic: "🛵", real: true }));
  loadCreated(L, "payments").filter((o) => o.customer === name).forEach((o) => real.push({ t: "just now", ev: `${o.id} · ${o.status} · $${o.amount}`, ic: "💳", real: true }));
  loadCreated(L, "reviewreq").filter((o) => o.name === name).forEach(() => real.push({ t: "just now", ev: "Review requested by your AI", ic: "⭐", real: true }));
  const base = [
    { t: c.last, ev: `Last ${noun} · via ${c.channel}`, ic: "🟢" },
    { t: "2 days ago", ev: `AI answered a question on ${c.channel}`, ic: "💬" },
    { t: "1 week ago", ev: `Left a 5★ review (AI-requested)`, ic: "⭐" },
    { t: "3 weeks ago", ev: `First ${noun} with ${V.business.name}`, ic: "✨" },
  ];
  return [...real, ...base];
}
// The revenue-share thesis, made concrete: tell the owner the single best move. (DEMO tour only.)
function nextBestAction(c, i, V) {
  const nb = V && SECTOR_IQ[V.label]?.nb;
  if (nb) {
    if (i === 0) return `Your top customer — ${nb.top} The AI can do it now.`;
    if ((c.orders || 0) < 3) return `Going quiet — ${nb.risk} The AI can handle it.`;
    return `${c.name?.split(" ")[0] || "They"} ${nb.base} The AI can send it.`;
  }
  if (i === 0) return "Your top spender. A personal thank-you + a small perk usually unlocks a referral. The AI can send it now.";
  if ((c.orders || 0) >= 15) return "Loyal & frequent — a perfect fit for a membership/subscription. Offer it to lock in recurring revenue.";
  return "Active but not yet loyal. One well-timed nudge with a returning-customer offer tends to convert them. The AI can handle it.";
}

// ── DEMO / not-connected: the sample tour, clearly labelled as sample data. ──
function DemoCustomers({ V, onNav }) {
  const rows = V.customers || genCustomers(V);
  const totalSpent = rows.reduce((s, c) => s + (c.spent || 0), 0);
  const [sel, setSel] = useState(null);
  const rebook = (c) => { const act = convoAction(V); const rec = recordFor(act.view, c.name, c.channel, V); if (rec) pushCreated(V.label, act.view, rec); setSel(null); toast(`${tr("Demo")} — ${REBOOK[V.label] || "Rebook"} · ${c.name} — ${tr("added to the sample tab, nothing was booked or sent")}`); onNav?.(act.view); };
  return (
    <div className="space-y-4 stagger">
      <div className="rounded-xl border border-g-gold/25 bg-g-gold/[0.06] px-4 py-2.5 text-[11px] font-bold text-g-muted">{tr("Demo — sample data. Connect your account in Settings to see your real customers here.")}</div>
      <MiniStats items={[["Total customers", `${rows.length * 104}`], ["New this week", `+${rows.length * 6}`, "good"], ["Avg. value", `$${rows.length ? Math.round(totalSpent / rows.length) : 0}`], ["Repeat rate", `${vnum(V.label, "repeat", 31, 47)}%`, "good"]]} />
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Customers")}</span><span className="text-[11px] text-g-muted hidden sm:inline">👆 {tr("tap for profile")}</span></div>
        <div className="divide-y divide-white/[0.06]">
          {rows.map((c, i) => (
            <button key={i} onClick={() => setSel({ c, i })} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
              <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-bold text-g-word">{(c.name || "?")[0]}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate flex items-center gap-1.5">{c.name}{i === 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-g-gold/15 text-g-gold">{tr("TOP")}</span>}</div><div className="text-[11px] text-g-muted truncate">{c.orders} {c.noun || "orders"} · {c.channel} · {c.last}</div></div>
              <span className="text-sm font-extrabold text-g-green">${c.spent.toFixed(2)}</span>
            </button>
          ))}
          {rows.length === 0 && <Empty icon="🧑" text={tr("No customers yet — I'll add each one here the moment I book or serve them.")} />}
        </div>
      </Card>
      {sel && (
        <Drawer
          title={sel.c.name}
          subtitle={`${sel.c.orders} ${sel.c.noun || "orders"} · via ${sel.c.channel}`}
          badge={sel.i === 0 ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-g-gold/15 text-g-gold">{tr("VIP")}</span> : null}
          fields={[["Lifetime value", `$${sel.c.spent.toFixed(2)}`], [(sel.c.noun || "orders"), sel.c.orders], ["Preferred channel", sel.c.channel], ["Last seen", sel.c.last], ["Status", sel.i === 0 ? "Top spender" : "Active"]]}
          note={<><div className="text-[10px] font-black uppercase text-g-gold mb-1">{tr("⚡ Next best action")}</div>{nextBestAction(sel.c, sel.i, V)}</>}
          actions={<>
            <a href={waTo(sel.c.phone, `Hi ${sel.c.name}! `)} target="_blank" rel="noopener" className="btn-bright text-sm">{tr("💬 Message")}</a>
            <button onClick={() => rebook(sel.c)} className="btn-ghost text-sm">🔁 {REBOOK[V.label] || "Rebook"}</button>
            <button onClick={() => { pushCreated(V.label, "reviewreq", { name: sel.c.name, ch: sel.c.channel }); toast(`${tr("Demo — nothing was sent to")} ${sel.c.name}.`); setSel(null); onNav?.("reputation"); }} className="btn-ghost text-sm">⭐ Request review</button>
          </>}
          onClose={() => setSel(null)}
        >
          <div className="mt-1">
            <div className="text-[10px] font-black uppercase tracking-wide text-g-muted mb-2">{tr("Recent activity")}</div>
            <div className="space-y-2.5">
              {custTimeline(sel.c, V).map((e, k) => (
                <div key={k} className="flex items-start gap-2.5 text-xs">
                  <span className="text-sm leading-none mt-0.5">{e.ic}</span>
                  <div className="flex-1 min-w-0"><div className="text-g-word font-semibold flex items-center gap-1.5">{e.ev}{e.real && <span className="text-[8px] font-black uppercase tracking-wide text-g-green bg-g-green/15 rounded px-1 py-0.5">live</span>}</div><div className="text-[10px] text-g-muted">{e.t}</div></div>
                </div>
              ))}
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}

export default Customers;
