/* Receita Recorrente — the PERSONALIZED growth motor's biggest lever: recurring revenue.
   The client (or the seller helping them) sells, from their own panel, three products:
     • PACOTES     — buy N sessions, redeemed one at a time (atomic package_use).
     • ASSINATURAS — clubs/subscriptions (mensal | anual).
     • VALES-PRESENTE — gift cards with a balance.
   Each row has a "gerar link de venda" button: it mints a Stripe Checkout link (mode=payment for
   packages/gift cards, mode=subscription for memberships) the owner sends to a customer; the Stripe
   webhook fulfills on success. Every management call is best-effort — it returns a safe default on ANY
   failure and never throws, so the tab always degrades to its honest sample state.

   Backend (this slice): POST /api/packages + POST /api/giftcards with { action, token, email, ... }.
   Registration is the orchestrator's job (Portal.jsx) — it should pass real/email/dataKey like RiskRadar. */
import { useState, useEffect } from "react";
import { FaIdCard, FaTicket, FaGift, FaPen, FaTrash, FaLink, FaPlus, FaRegCopy } from "react-icons/fa6";
import { toast } from "../lib/portalApi.js";
import { tr, Card, Empty, SectionSkeleton } from "../pages/Portal.jsx";

// ── API seams ─────────────────────────────────────────────────────────────────
async function pkgApi(body) {
  try {
    const r = await fetch("/api/packages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}
async function giftApi(body) {
  try {
    const r = await fetch("/api/giftcards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// ── helpers ─────────────────────────────────────────────────────────────────
const money = (cents) => `$${((Number(cents) || 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const toCents = (dollars) => Math.round((Number(String(dollars).replace(/[^0-9.]/g, "")) || 0) * 100);
const copy = (text) => { try { navigator.clipboard?.writeText(text); toast(tr("Link copied ✓ — send it to your customer")); } catch { toast(tr("Copy failed — select and copy manually.")); } };
const upsertLocal = (arr, row) => { const i = (arr || []).findIndex((x) => x.id === row.id); if (i < 0) return [row, ...(arr || [])]; const n = [...arr]; n[i] = row; return n; };

// Deterministic sample data for demo / not-connected mode.
const demoPackages = () => [
  { id: "dp1", name: tr("10-session pack"), service: tr("Massage"), sessions: 10, price_cents: 45000, active: true, purchases: 6 },
  { id: "dp2", name: tr("5-class pack"), service: tr("Pilates"), sessions: 5, price_cents: 20000, active: true, purchases: 3 },
];
const demoMemberships = () => [
  { id: "dm1", name: tr("VIP Club"), price_cents: 9900, interval: "month", perks: tr("2 sessions/mo · 15% off extras · priority booking"), active: true, subscribers: 24 },
  { id: "dm2", name: tr("Annual member"), price_cents: 99900, interval: "year", perks: tr("Unlimited access · a free guest each month"), active: true, subscribers: 8 },
];
const demoCards = () => [
  { id: "dg1", code: "GC7F3A9C2B", amount_cents: 10000, balance_cents: 6500, recipient_contact: "ana@email.com", active: true },
  { id: "dg2", code: "GCB4E81D0F", amount_cents: 5000, balance_cents: 5000, recipient_contact: "", active: true },
];

// ── Sell-link chip — shown under a row after "gerar link de venda". ───────────
function SellLink({ url, onClose }) {
  return (
    <div className="mt-2.5 flex items-center gap-2 rounded-xl2 border border-g-green/25 bg-g-green/[0.06] px-3.5 py-2">
      <FaLink size={11} className="text-g-green shrink-0" />
      <span className="text-[11px] text-g-word font-mono truncate flex-1 min-w-0">{url}</span>
      <button onClick={() => copy(url)} className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-g-word hover:border-g-green/40 transition inline-flex items-center gap-1.5"><FaRegCopy size={10} /> {tr("Copy")}</button>
      <a href={url} target="_blank" rel="noopener" className="rounded-full bg-g-green/85 px-2.5 py-1 text-[11px] font-black text-white hover:bg-g-green transition">{tr("Open")}</a>
      <button onClick={onClose} className="text-g-muted hover:text-g-word text-sm px-1">×</button>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-g-muted mb-1">{label}</span>
      <input {...props} className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-g-word placeholder:text-g-muted/60 outline-none focus:border-g-gold/50 transition" />
    </label>
  );
}

function Recurring({ V, real = null, email = "", dataKey = "" }) {
  const live = !!(real && email && dataKey);

  const [packs, setPacks] = useState(live ? null : demoPackages());
  const [members, setMembers] = useState(live ? null : demoMemberships());
  const [cards, setCards] = useState(live ? null : demoCards());
  const [links, setLinks] = useState({});                 // rowId -> checkout url
  const [pForm, setPForm] = useState(null);               // package form
  const [mForm, setMForm] = useState(null);               // membership form
  const [cForm, setCForm] = useState(null);               // gift-card form
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    if (live) {
      pkgApi({ action: "list", token: dataKey, email }).then((d) => { if (alive) setPacks(Array.isArray(d?.packages) ? d.packages : []); });
      pkgApi({ action: "membership_list", token: dataKey, email }).then((d) => { if (alive) setMembers(Array.isArray(d?.memberships) ? d.memberships : []); });
      giftApi({ action: "list", token: dataKey, email }).then((d) => { if (alive) setCards(Array.isArray(d?.cards) ? d.cards : []); });
    }
    return () => { alive = false; };
  }, [live, dataKey, email]);

  const clearLink = (id) => setLinks((l) => { const n = { ...l }; delete n[id]; return n; });

  // ── Sell link (Stripe Checkout) ──
  const sellPackage = async (row, kind) => {
    if (!live) { toast(tr("Available when connected — sample data")); return; }
    toast(tr("Minting your sell link…"));
    const d = await pkgApi({ action: "buy", token: dataKey, email, kind, id: row.id });
    if (d?.url) setLinks((l) => ({ ...l, [row.id]: d.url }));
    else toast(d?.note || tr("Couldn't create the link — check your Stripe key and try again."));
  };
  const sellGift = async (row) => {
    if (!live) { toast(tr("Available when connected — sample data")); return; }
    toast(tr("Minting your sell link…"));
    const d = await giftApi({ action: "buy", token: dataKey, email, amount_cents: row.amount_cents, recipient_contact: row.recipient_contact || "" });
    if (d?.url) setLinks((l) => ({ ...l, [row.id]: d.url }));
    else toast(d?.note || tr("Couldn't create the link — check your Stripe key and try again."));
  };

  // ── Package save / delete ──
  const savePack = async () => {
    if (!pForm || !(pForm.name || "").trim()) { toast(tr("Give the package a name first.")); return; }
    const rec = { id: pForm.id, name: pForm.name.trim(), service: pForm.service || "", sessions: Number(pForm.sessions) || 1, price_cents: toCents(pForm.price), active: pForm.active !== false };
    setBusy(true);
    if (live) {
      const d = await pkgApi({ action: "upsert", token: dataKey, email, package: rec });
      setBusy(false);
      if (!d?.ok) { toast(tr("I couldn't save that — check your connection and try again.")); return; }
      setPacks((xs) => upsertLocal(xs || [], { ...rec, id: rec.id || d.id || `p-${Date.now()}`, purchases: rec.purchases || 0 }));
    } else { setPacks((xs) => upsertLocal(xs || [], { ...rec, id: rec.id || `p-${Date.now()}`, purchases: 0 })); setBusy(false); }
    toast(tr("Package saved ✓")); setPForm(null);
  };
  const delPack = async (row) => {
    const prev = packs; setPacks((xs) => (xs || []).filter((x) => x.id !== row.id));
    if (live) { const d = await pkgApi({ action: "delete", token: dataKey, email, id: row.id }); if (!d?.ok) { setPacks(prev); toast(tr("I couldn't delete that — try again.")); return; } }
    toast(tr("Package deleted"));
  };

  // ── Membership save / delete ──
  const saveMember = async () => {
    if (!mForm || !(mForm.name || "").trim()) { toast(tr("Give the membership a name first.")); return; }
    const rec = { id: mForm.id, name: mForm.name.trim(), price_cents: toCents(mForm.price), interval: mForm.interval === "year" ? "year" : "month", perks: mForm.perks || "", active: mForm.active !== false };
    setBusy(true);
    if (live) {
      const d = await pkgApi({ action: "membership_upsert", token: dataKey, email, membership: rec });
      setBusy(false);
      if (!d?.ok) { toast(tr("I couldn't save that — check your connection and try again.")); return; }
      setMembers((xs) => upsertLocal(xs || [], { ...rec, id: rec.id || d.id || `m-${Date.now()}`, subscribers: rec.subscribers || 0 }));
    } else { setMembers((xs) => upsertLocal(xs || [], { ...rec, id: rec.id || `m-${Date.now()}`, subscribers: 0 })); setBusy(false); }
    toast(tr("Membership saved ✓")); setMForm(null);
  };
  const delMember = async (row) => {
    const prev = members; setMembers((xs) => (xs || []).filter((x) => x.id !== row.id));
    if (live) { const d = await pkgApi({ action: "membership_delete", token: dataKey, email, id: row.id }); if (!d?.ok) { setMembers(prev); toast(tr("I couldn't delete that — try again.")); return; } }
    toast(tr("Membership deleted"));
  };

  // ── Gift card issue ──
  const issueCard = async () => {
    const cents = toCents(cForm?.amount);
    if (!cForm || cents <= 0) { toast(tr("Enter a gift-card amount first.")); return; }
    const card = { amount_cents: cents, recipient_contact: cForm.recipient || "", purchaser_contact: cForm.purchaser || "", code: (cForm.code || "").trim().toUpperCase() || undefined };
    setBusy(true);
    if (live) {
      const d = await giftApi({ action: "create", token: dataKey, email, card });
      setBusy(false);
      if (!d?.ok || !d.card) { toast(tr("I couldn't issue that — check your connection and try again.")); return; }
      setCards((xs) => [{ id: d.card.id, code: d.card.code, amount_cents: d.card.amount_cents, balance_cents: d.card.balance_cents, recipient_contact: card.recipient_contact, active: true }, ...(xs || [])]);
    } else {
      const code = card.code || `GC${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      setCards((xs) => [{ id: `g-${Date.now()}`, code, amount_cents: cents, balance_cents: cents, recipient_contact: card.recipient_contact, active: true }, ...(xs || [])]); setBusy(false);
    }
    toast(tr("Gift card issued ✓")); setCForm(null);
  };

  if (live && (packs === null || members === null || cards === null)) return <SectionSkeleton rows={6} />;

  const mrr = (members || []).filter((m) => m.active !== false).reduce((s, m) => s + (m.interval === "year" ? (m.price_cents || 0) / 12 : (m.price_cents || 0)) * (Number(m.subscribers) || 0), 0);

  return (
    <div className="space-y-5 stagger">
      {/* Header */}
      <div className="rounded-2xl border border-g-gold/25 bg-gradient-to-br from-g-gold/[0.07] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-g-gold">
          <FaIdCard size={11} /> {tr("Recurring Revenue")}
          {live
            ? <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span>
            : <span className="text-g-muted normal-case font-bold text-[9px] border border-white/10 rounded-full px-1.5 py-px">{tr("sample")}</span>}
        </div>
        <div className="mt-1 text-xl font-black text-g-word">{tr("Packages, memberships & gift cards")} · <span className="text-g-green">{money(mrr)}<span className="text-sm text-g-muted font-bold">/mo</span></span></div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">{tr("Recurring revenue is the biggest lever. Sell it from here — Gui renews, reminds and rescues it automatically.")}</p>
      </div>

      {!live && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-2.5 text-[11px] font-bold text-g-gold">
          {tr("Sample data — connect your account to sell real packages, memberships and gift cards.")}
        </div>
      )}

      {/* ── PACKAGES ─────────────────────────────────────────────── */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-g-gold inline-flex items-center gap-2"><FaTicket size={11} /> {tr("Session packages")}</span>
          <button onClick={() => setPForm({ id: null, name: "", service: "", sessions: 10, price: "", active: true })} className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[11px] font-bold text-g-word hover:border-g-gold/40 transition inline-flex items-center gap-1.5"><FaPlus size={9} /> {tr("New package")}</button>
        </div>
        {pForm && (
          <div className="px-5 py-4 border-b border-white/10 bg-white/[0.015] grid gap-3 sm:grid-cols-2">
            <Field label={tr("Name")} value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} placeholder={tr("10-session pack")} />
            <Field label={tr("Service")} value={pForm.service} onChange={(e) => setPForm({ ...pForm, service: e.target.value })} placeholder={tr("Massage")} />
            <Field label={tr("Sessions")} type="number" min="1" value={pForm.sessions} onChange={(e) => setPForm({ ...pForm, sessions: e.target.value })} />
            <Field label={tr("Price (USD)")} inputMode="decimal" value={pForm.price} onChange={(e) => setPForm({ ...pForm, price: e.target.value })} placeholder="450" />
            <div className="sm:col-span-2 flex items-center gap-2">
              <button onClick={savePack} disabled={busy} className="btn-bright text-sm disabled:opacity-50">{tr("Save package")}</button>
              <button onClick={() => setPForm(null)} className="btn-ghost text-sm">{tr("Cancel")}</button>
            </div>
          </div>
        )}
        <div className="divide-y divide-white/[0.05]">
          {(packs || []).map((r) => (
            <div key={r.id} className="px-5 py-3">
              <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm shrink-0">🎟️</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-g-word truncate">{r.name}{r.service ? <span className="text-g-muted font-normal"> · {r.service}</span> : null}</div>
                  <div className="text-[11px] text-g-muted">{r.sessions} {tr("sessions")} · {money(r.price_cents)}{r.purchases ? ` · ${r.purchases} ${tr("active")}` : ""}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => sellPackage(r, "package")} className="rounded-full border border-g-green/35 bg-g-green/10 px-3 py-1.5 text-[11px] font-bold text-g-word hover:bg-g-green/20 transition whitespace-nowrap inline-flex items-center gap-1.5"><FaLink size={10} /> {tr("Sell link")}</button>
                  <button onClick={() => setPForm({ id: r.id, name: r.name, service: r.service || "", sessions: r.sessions, price: (r.price_cents / 100).toString(), active: r.active !== false })} className="text-g-muted hover:text-g-word p-1.5" title={tr("Edit")}><FaPen size={11} /></button>
                  <button onClick={() => delPack(r)} className="text-g-muted hover:text-red-400 p-1.5" title={tr("Delete")}><FaTrash size={11} /></button>
                </div>
              </div>
              {links[r.id] && <SellLink url={links[r.id]} onClose={() => clearLink(r.id)} />}
            </div>
          ))}
          {(packs || []).length === 0 && <Empty icon="🎟️" text={tr("No packages yet — sell a bundle of sessions for predictable revenue.")} />}
        </div>
      </Card>

      {/* ── MEMBERSHIPS ──────────────────────────────────────────── */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-g-gold inline-flex items-center gap-2"><FaIdCard size={11} /> {tr("Memberships & clubs")}</span>
          <button onClick={() => setMForm({ id: null, name: "", price: "", interval: "month", perks: "", active: true })} className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[11px] font-bold text-g-word hover:border-g-gold/40 transition inline-flex items-center gap-1.5"><FaPlus size={9} /> {tr("New membership")}</button>
        </div>
        {mForm && (
          <div className="px-5 py-4 border-b border-white/10 bg-white/[0.015] grid gap-3 sm:grid-cols-2">
            <Field label={tr("Name")} value={mForm.name} onChange={(e) => setMForm({ ...mForm, name: e.target.value })} placeholder={tr("VIP Club")} />
            <Field label={tr("Price (USD)")} inputMode="decimal" value={mForm.price} onChange={(e) => setMForm({ ...mForm, price: e.target.value })} placeholder="99" />
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-g-muted mb-1">{tr("Billing")}</span>
              <select value={mForm.interval} onChange={(e) => setMForm({ ...mForm, interval: e.target.value })} className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-g-word outline-none focus:border-g-gold/50 transition">
                <option value="month">{tr("Monthly")}</option>
                <option value="year">{tr("Yearly")}</option>
              </select>
            </label>
            <Field label={tr("Perks")} value={mForm.perks} onChange={(e) => setMForm({ ...mForm, perks: e.target.value })} placeholder={tr("2 sessions/mo · 15% off extras")} />
            <div className="sm:col-span-2 flex items-center gap-2">
              <button onClick={saveMember} disabled={busy} className="btn-bright text-sm disabled:opacity-50">{tr("Save membership")}</button>
              <button onClick={() => setMForm(null)} className="btn-ghost text-sm">{tr("Cancel")}</button>
            </div>
          </div>
        )}
        <div className="divide-y divide-white/[0.05]">
          {(members || []).map((r) => (
            <div key={r.id} className="px-5 py-3">
              <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm shrink-0">🌟</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-g-word truncate">{r.name}</div>
                  <div className="text-[11px] text-g-muted truncate">{money(r.price_cents)}/{r.interval === "year" ? tr("yr") : tr("mo")}{r.perks ? ` · ${r.perks}` : ""}{r.subscribers ? ` · ${r.subscribers} ${tr("members")}` : ""}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => sellPackage(r, "membership")} className="rounded-full border border-g-green/35 bg-g-green/10 px-3 py-1.5 text-[11px] font-bold text-g-word hover:bg-g-green/20 transition whitespace-nowrap inline-flex items-center gap-1.5"><FaLink size={10} /> {tr("Sell link")}</button>
                  <button onClick={() => setMForm({ id: r.id, name: r.name, price: (r.price_cents / 100).toString(), interval: r.interval || "month", perks: r.perks || "", active: r.active !== false })} className="text-g-muted hover:text-g-word p-1.5" title={tr("Edit")}><FaPen size={11} /></button>
                  <button onClick={() => delMember(r)} className="text-g-muted hover:text-red-400 p-1.5" title={tr("Delete")}><FaTrash size={11} /></button>
                </div>
              </div>
              {links[r.id] && <SellLink url={links[r.id]} onClose={() => clearLink(r.id)} />}
            </div>
          ))}
          {(members || []).length === 0 && <Empty icon="🌟" text={tr("No memberships yet — a monthly club is the most valuable revenue you can build.")} />}
        </div>
      </Card>

      {/* ── GIFT CARDS ───────────────────────────────────────────── */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-g-gold inline-flex items-center gap-2"><FaGift size={11} /> {tr("Gift cards")}</span>
          <button onClick={() => setCForm({ amount: "", recipient: "", purchaser: "", code: "" })} className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[11px] font-bold text-g-word hover:border-g-gold/40 transition inline-flex items-center gap-1.5"><FaPlus size={9} /> {tr("New gift card")}</button>
        </div>
        {cForm && (
          <div className="px-5 py-4 border-b border-white/10 bg-white/[0.015] grid gap-3 sm:grid-cols-2">
            <Field label={tr("Amount (USD)")} inputMode="decimal" value={cForm.amount} onChange={(e) => setCForm({ ...cForm, amount: e.target.value })} placeholder="100" />
            <Field label={tr("Recipient (optional)")} value={cForm.recipient} onChange={(e) => setCForm({ ...cForm, recipient: e.target.value })} placeholder={tr("name or email")} />
            <div className="sm:col-span-2 flex items-center gap-2">
              <button onClick={issueCard} disabled={busy} className="btn-bright text-sm disabled:opacity-50">{tr("Issue gift card")}</button>
              <button onClick={() => setCForm(null)} className="btn-ghost text-sm">{tr("Cancel")}</button>
              <span className="text-[11px] text-g-muted hidden sm:inline">{tr("Or generate a pay link so the buyer pays online.")}</span>
            </div>
          </div>
        )}
        <div className="divide-y divide-white/[0.05]">
          {(cards || []).map((r) => (
            <div key={r.id} className="px-5 py-3">
              <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm shrink-0">🎁</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-g-word font-mono truncate">{r.code}</div>
                  <div className="text-[11px] text-g-muted truncate">{money(r.balance_cents)} {tr("of")} {money(r.amount_cents)}{r.recipient_contact ? ` · ${r.recipient_contact}` : ""}</div>
                </div>
                <button onClick={() => sellGift(r)} className="rounded-full border border-g-green/35 bg-g-green/10 px-3 py-1.5 text-[11px] font-bold text-g-word hover:bg-g-green/20 transition whitespace-nowrap inline-flex items-center gap-1.5 shrink-0"><FaLink size={10} /> {tr("Pay link")}</button>
              </div>
              {links[r.id] && <SellLink url={links[r.id]} onClose={() => clearLink(r.id)} />}
            </div>
          ))}
          {(cards || []).length === 0 && <Empty icon="🎁" text={tr("No gift cards yet — a favorite way for happy customers to bring you new ones.")} />}
        </div>
      </Card>

      <p className="text-center text-[11px] text-g-muted">{tr("Recurring revenue is the most valuable revenue — your AI renews, reminds and rescues it automatically.")}</p>
    </div>
  );
}

export default Recurring;
