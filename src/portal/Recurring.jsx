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
import NoSeuPlano from "./NoSeuPlano.jsx";
import { FaIdCard, FaTicket, FaGift, FaPen, FaTrash, FaLink, FaPlus, FaRegCopy } from "react-icons/fa6";
import { toast } from "../lib/portalApi.js";
import { tr, Card, Empty, SectionSkeleton, RetryState } from "../pages/Portal.jsx";

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
// O link de venda precisa do MOTIVO da recusa (payments_not_connected, permissão que falta na chave…),
// que volta no corpo mesmo com HTTP de erro. null só quando nem o corpo chegou (rede).
async function sellApi(path, body) {
  try {
    const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return await r.json().catch(() => null);
  } catch { return null; }
}
// Recusa do link → a frase certa. EUA (hint use_own_stripe) → Stripe próprio em guileoai.com/receber.
function motivoDoLink(d) {
  if (d?.reason === "payments_not_connected") {
    return d.hint === "use_own_stripe"
      ? tr("To sell online, connect your own Stripe account at guileoai.com/receber — the money goes straight to you.")
      : tr("Connect your Stripe account (Settings → Payments) to sell online — the money goes straight to you.");
  }
  if (d?.reason === "permission_missing") return `${tr("Your Stripe key is missing this permission:")} ${d.permissao || d.rak || "?"}`;
  if (d?.reason === "stripe_rejected_key") return tr("Stripe rejected your key — paste it again at guileoai.com/receber.");
  return tr("Couldn't create the payment link right now. Make sure your Stripe account is connected, then try again.");
}

// ── MOEDA DO TENANT (primeiro passo — 2026-08-25) ───────────────────────────
// Esta tela rotulava os três campos como "Price (USD)" e formatava tudo com `en-US` fixo. Um cliente
// brasileiro cadastrava 450 pensando em reais e o painel (e o link de pagamento) tratavam como
// dólares — o MESMO defeito que já apareceu na landing (planos em R$ com add-ons em $, 5× mais caro).
//
// TODO: campo `currency` no perfil do tenant — O DADO AINDA NÃO EXISTE NO BANCO.
//   `biz_services` guarda `price_cents` e NÃO guarda moeda (ver a nota em
//   functions/lib/dadosEstruturados.js, que precisou derivar moeda do fuso/país justamente por isso),
//   e `get_client_data` não devolve país nem moeda em `identity`. Falta:
//     alter table clients add column currency text check (currency ~ '^[A-Z]{3}$');
//   e subir esse campo em `identity` — aí este helper lê o campo e o fallback morre.
// Enquanto isso: leio a moeda se ela APARECER (identity.currency/country/tz), senão USD declarado.
// 🚨 NADA DE CONVERSÃO. Trocar o rótulo não converte valor nenhum: 450 continua 450, muda o símbolo.
const MOEDA_POR_PAIS = { US: "USD", BR: "BRL", PT: "EUR", ES: "EUR", MX: "MXN", CA: "CAD", GB: "GBP", IN: "INR" };
const MOEDA_POR_FUSO = { "America/Sao_Paulo": "BRL", "America/Bahia": "BRL", "America/Recife": "BRL", "America/Fortaleza": "BRL", "Europe/Lisbon": "EUR", "Europe/Madrid": "EUR", "Asia/Kolkata": "INR" };
export function moedaDoTenant(real) {
  const id = real?.identity || {};
  const direta = String(id.currency || "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(direta)) return direta;
  const porPais = MOEDA_POR_PAIS[String(id.country || "").trim().toUpperCase()];
  if (porPais) return porPais;
  const porFuso = MOEDA_POR_FUSO[String(id.tz || id.timezone || "").trim()];
  if (porFuso) return porFuso;
  return "USD"; // fallback declarado — o rótulo diz USD, então ninguém digita achando outra coisa
}
const LOCALE_DA_MOEDA = { USD: "en-US", BRL: "pt-BR", EUR: "pt-PT", MXN: "es-MX", CAD: "en-CA", GBP: "en-GB", INR: "en-IN" };
// ── helpers ─────────────────────────────────────────────────────────────────
// `money` continua com a MESMA assinatura (cents) — a moeda entra como 2º argumento opcional para
// não quebrar nenhuma chamada existente, e sem moeda o comportamento antigo é bit-a-bit o mesmo.
const money = (cents, moeda) => {
  const v = (Number(cents) || 0) / 100;
  const cur = moeda || "USD";
  try { return new Intl.NumberFormat(LOCALE_DA_MOEDA[cur] || "en-US", { style: "currency", currency: cur, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v); }
  catch { return `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`; }
};
const toCents = (dollars) => Math.round((Number(String(dollars).replace(/[^0-9.]/g, "")) || 0) * 100);
const copy = (text) => { try { navigator.clipboard?.writeText(text); toast(tr("Link copied ✓ — send it to your customer")); } catch { toast(tr("Copy failed — select and copy manually.")); } };
const upsertLocal = (arr, row) => { const i = (arr || []).findIndex((x) => x.id === row.id); if (i < 0) return [row, ...(arr || [])]; const n = [...arr]; n[i] = row; return n; };

// Deterministic sample data for demo / not-connected mode.
const demoPackages = () => [
  { id: "dp1", name: tr("10-session pack"), service: tr("Massage"), sessions: 10, price_cents: 45000, active: true, purchases: 6, valid_days: 180, activation: "first_visit" },
  { id: "dp2", name: tr("5-class pack"), service: tr("Pilates"), sessions: 5, price_cents: 20000, active: true, purchases: 3, valid_days: null, activation: "purchase" },
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
function SellLink({ link, onClose }) {
  const url = typeof link === "string" ? link : link?.url || "";
  return (
    <div className="mt-2.5">
    <div className="flex items-center gap-2 rounded-xl2 border border-g-green/25 bg-g-green/[0.06] px-3.5 py-2">
      <FaLink size={11} className="text-g-green shrink-0" />
      <span className="text-[11px] text-g-word font-mono truncate flex-1 min-w-0">{url}</span>
      <button onClick={() => copy(url)} className="rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-g-word hover:border-g-green/40 transition inline-flex items-center gap-1.5 min-h-[44px] inline-flex items-center"><FaRegCopy size={10} /> {tr("Copy")}</button>
      <a href={url} target="_blank" rel="noopener" className="rounded-full bg-g-green/85 px-2.5 py-1 text-[11px] font-black text-white hover:bg-g-green transition min-h-[44px] inline-flex items-center">{tr("Open")}</a>
      <button onClick={onClose} className="text-g-muted hover:text-g-word text-sm px-1">×</button>
    </div>
    {link?.propria && <p className="mt-1 px-1 text-[11px] text-g-muted">{tr("Paid into your own Stripe. It's registered here when the buyer finishes paying (checked again every hour). The link expires in 23 hours.")}</p>}
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
  // a moeda do negócio, resolvida uma vez; `$$` formata e `MOEDA` rotula os campos de entrada.
  const MOEDA = moedaDoTenant(real);
  const $$ = (cents) => money(cents, MOEDA);

  // 🚨 LINHA DE AMOSTRA SOB O SELO "LIVE" (2026-09-28). Era `useState(live ? null : demo)`: quando
  // a aba montava ANTES de `real` chegar (recarregar em ?tab=recurring), `live` ainda era falso, o
  // estado nascia com os pacotes de amostra ("10-session pack · Massage · $450") e eles ficavam na
  // tela, já com o selo verde, até a leitura voltar. Se a leitura falhasse, ficavam para sempre.
  // A pergunta certa no nascimento não é "já tenho os dados?", é "esta conta está CONECTADA?"
  // (e-mail + chave): conta conectada nunca recebe amostra — nasce `null` (esqueleto) e só sai
  // dele com dado do servidor. Sem chave é a vitrine, declaradamente amostra.
  const conta = !!(email && dataKey);
  const [packs, setPacks] = useState(conta ? null : demoPackages());
  const [members, setMembers] = useState(conta ? null : demoMemberships());
  const [cards, setCards] = useState(conta ? null : demoCards());
  const [falha, setFalha] = useState(false);              // alguma das três leituras não respondeu
  const [seq, setSeq] = useState(0);
  const [links, setLinks] = useState({});                 // rowId -> checkout url
  const [pForm, setPForm] = useState(null);               // package form
  const [mForm, setMForm] = useState(null);               // membership form
  const [cForm, setCForm] = useState(null);               // gift-card form
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    if (live) {
      // zera ANTES de ler: o que estava na tela (de outra chave, ou de amostra) não sobrevive à troca
      setPacks(null); setMembers(null); setCards(null); setFalha(false);
      // `d === null` = a chamada FALHOU (HTTP de erro / rede). Isso virava `[]` e a tela dizia
      // "No packages yet" para quem tinha pacotes vendidos. Falha marca `falha`; vazio é vazio.
      Promise.all([
        pkgApi({ action: "list", token: dataKey, email }),
        pkgApi({ action: "membership_list", token: dataKey, email }),
        giftApi({ action: "list", token: dataKey, email }),
      ]).then(([p, m, g]) => {
        if (!alive) return;
        setFalha(p === null || m === null || g === null);
        setPacks(Array.isArray(p?.packages) ? p.packages : []);
        setMembers(Array.isArray(m?.memberships) ? m.memberships : []);
        setCards(Array.isArray(g?.cards) ? g.cards : []);
      });
    }
    return () => { alive = false; };
  }, [live, dataKey, email, seq]);

  const clearLink = (id) => setLinks((l) => { const n = { ...l }; delete n[id]; return n; });

  // ── Sell link (Stripe Checkout) ──
  const sellPackage = async (row, kind) => {
    if (!live) { toast(tr("Available when connected — sample data")); return; }
    toast(tr("Minting your sell link…"));
    const d = await sellApi("/api/packages", { action: "buy", token: dataKey, email, kind, id: row.id });
    if (d?.url) setLinks((l) => ({ ...l, [row.id]: { url: d.url, propria: d.via === "stripe_own" } }));
    else toast(motivoDoLink(d));
  };
  const sellGift = async (row) => {
    if (!live) { toast(tr("Available when connected — sample data")); return; }
    toast(tr("Minting your sell link…"));
    const d = await sellApi("/api/giftcards", { action: "buy", token: dataKey, email, amount_cents: row.amount_cents, recipient_contact: row.recipient_contact || "" });
    if (d?.url) setLinks((l) => ({ ...l, [row.id]: { url: d.url, propria: d.via === "stripe_own" } }));
    else toast(motivoDoLink(d));
  };
  // Fora do modo real nada é gravado em servidor nenhum — o toast diz isso em vez de "saved ✓".
  const feito = (frase) => toast(live ? tr(frase) : tr("Demo — changed in this sample list only. Nothing was saved."));

  // ── Package save / delete ──
  const savePack = async () => {
    if (!pForm || !(pForm.name || "").trim()) { toast(tr("Give the package a name first.")); return; }
    // validade (desk_v13): em branco = não vence; senão 1..3650 dias
    const vTxt = String(pForm.valid ?? "").trim();
    const valid_days = vTxt === "" ? null : Number(vTxt);
    if (valid_days !== null && !(Number.isInteger(valid_days) && valid_days >= 1 && valid_days <= 3650)) { toast(tr("Validity must be between 1 and 3650 days.")); return; }
    const rec = { id: pForm.id, name: pForm.name.trim(), service: pForm.service || "", sessions: Number(pForm.sessions) || 1, price_cents: toCents(pForm.price), active: pForm.active !== false,
      valid_days, activation: pForm.activation === "first_visit" ? "first_visit" : "purchase" };
    setBusy(true);
    if (live) {
      const d = await pkgApi({ action: "upsert", token: dataKey, email, package: rec });
      setBusy(false);
      if (!d?.ok) { toast(tr("I couldn't save that — check your connection and try again.")); return; }
      setPacks((xs) => upsertLocal(xs || [], { ...rec, id: rec.id || d.id || `p-${Date.now()}`, purchases: rec.purchases || 0 }));
    } else { setPacks((xs) => upsertLocal(xs || [], { ...rec, id: rec.id || `p-${Date.now()}`, purchases: 0 })); setBusy(false); }
    feito("Package saved ✓"); setPForm(null);
  };
  const delPack = async (row) => {
    const prev = packs; setPacks((xs) => (xs || []).filter((x) => x.id !== row.id));
    if (live) { const d = await pkgApi({ action: "delete", token: dataKey, email, id: row.id }); if (!d?.ok) { setPacks(prev); toast(tr("I couldn't delete that — try again.")); return; } }
    feito("Package deleted");
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
    feito("Membership saved ✓"); setMForm(null);
  };
  const delMember = async (row) => {
    const prev = members; setMembers((xs) => (xs || []).filter((x) => x.id !== row.id));
    if (live) { const d = await pkgApi({ action: "membership_delete", token: dataKey, email, id: row.id }); if (!d?.ok) { setMembers(prev); toast(tr("I couldn't delete that — try again.")); return; } }
    feito("Membership deleted");
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
    feito("Gift card issued ✓"); setCForm(null);
  };

  // Conta conectada cujos dados ainda não chegaram: esqueleto — nem amostra, nem editor que grava
  // só no navegador e responde "saved ✓".
  if (conta && !live) return <SectionSkeleton rows={6} />;
  if (live && (packs === null || members === null || cards === null)) return <SectionSkeleton rows={6} />;
  if (live && falha && !packs.length && !members.length && !cards.length) return <RetryState onRetry={() => setSeq((n) => n + 1)} />;

  const mrr = (members || []).filter((m) => m.active !== false).reduce((s, m) => s + (m.interval === "year" ? (m.price_cents || 0) / 12 : (m.price_cents || 0)) * (Number(m.subscribers) || 0), 0);

  return (
    <>
     <NoSeuPlano real={real} produto="close_collect" />
   <div className="space-y-5 stagger">
      {/* Header */}
      <div className="rounded-2xl border border-g-gold/25 bg-gradient-to-br from-g-gold/[0.07] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-g-gold">
          <FaIdCard size={11} /> {tr("Recurring Revenue")}
          {live
            ? <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span>
            : <span className="text-g-muted normal-case font-bold text-[9px] border border-white/10 rounded-full px-1.5 py-px">{tr("sample")}</span>}
        </div>
        <div className="mt-1 text-xl font-black text-g-word">{tr("Packages, memberships & gift cards")} · <span className="text-g-green">{$$(mrr)}<span className="text-sm text-g-muted font-bold">/{tr("mo")}</span></span></div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">{tr("Recurring revenue is the biggest lever. Sell it from here — Gui renews, reminds and rescues it automatically.")}</p>
      </div>

      {!live && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-2.5 text-[11px] font-bold text-g-gold">
          {tr("Sample data — connect your account to sell real packages, memberships and gift cards.")}
        </div>
      )}
      {live && falha && (
        <div className="rounded-xl border border-[#e0855f]/40 bg-[#e0855f]/[0.08] px-3.5 py-2.5 flex flex-wrap items-center gap-3 text-[12px] text-[#e0855f]">
          <span className="flex-1 min-w-[12rem]">{tr("Part of this screen couldn't be read just now — an empty list below may be a reading failure, not an empty list.")}</span>
          <button onClick={() => setSeq((n) => n + 1)} className="btn-ghost text-xs shrink-0">{tr("↻ Try again")}</button>
        </div>
      )}

      {/* ── PACKAGES ─────────────────────────────────────────────── */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-g-gold inline-flex items-center gap-2"><FaTicket size={11} /> {tr("Session packages")}</span>
          <button onClick={() => setPForm({ id: null, name: "", service: "", sessions: 10, price: "", active: true, valid: "", activation: "purchase" })} className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[11px] font-bold text-g-word hover:border-g-gold/40 transition inline-flex items-center gap-1.5 min-h-[44px] inline-flex items-center"><FaPlus size={9} /> {tr("New package")}</button>
        </div>
        {pForm && (
          <div className="px-5 py-4 border-b border-white/10 bg-white/[0.015] grid gap-3 sm:grid-cols-2">
            <Field label={tr("Name")} value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} placeholder={tr("10-session pack")} />
            <Field label={tr("Service")} value={pForm.service} onChange={(e) => setPForm({ ...pForm, service: e.target.value })} placeholder={tr("Massage")} />
            <Field label={tr("Sessions")} type="number" min="1" value={pForm.sessions} onChange={(e) => setPForm({ ...pForm, sessions: e.target.value })} />
            <Field label={`${tr("Price")} (${MOEDA})`} inputMode="decimal" value={pForm.price} onChange={(e) => setPForm({ ...pForm, price: e.target.value })} placeholder="450" />
            <div>
              <Field label={tr("Valid for (days)")} inputMode="numeric" value={pForm.valid ?? ""} onChange={(e) => setPForm({ ...pForm, valid: e.target.value.replace(/\D/g, "") })} placeholder="180" />
              <span className="mt-1 block text-[11px] text-g-muted">{tr("Blank = never expires")}</span>
            </div>
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-g-muted mb-1">{tr("Activates")}</span>
              <select value={pForm.activation || "purchase"} onChange={(e) => setPForm({ ...pForm, activation: e.target.value })} className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-g-word outline-none focus:border-g-gold/50 transition [color-scheme:dark]">
                <option value="purchase">{tr("On purchase")}</option>
                <option value="first_visit">{tr("On first visit")}</option>
              </select>
            </label>
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
                  <div className="text-[11px] text-g-muted">{r.sessions} {tr("sessions")} · {$$(r.price_cents)}{r.purchases ? ` · ${r.purchases} ${tr("active")}` : ""}</div>
                  <div className="text-[11px] text-g-muted">{r.valid_days ? `${tr("valid for")} ${r.valid_days} ${tr("days")}` : tr("no expiry")}{r.activation === "first_visit" ? ` · ${tr("activates on first visit")}` : ""}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => sellPackage(r, "package")} className="rounded-full border border-g-green/35 bg-g-green/10 px-3 py-1.5 text-[11px] font-bold text-g-word hover:bg-g-green/20 transition whitespace-nowrap inline-flex items-center gap-1.5"><FaLink size={10} /> {tr("Sell link")}</button>
                  <button onClick={() => setPForm({ id: r.id, name: r.name, service: r.service || "", sessions: r.sessions, price: (r.price_cents / 100).toString(), active: r.active !== false, valid: r.valid_days ? String(r.valid_days) : "", activation: r.activation || "purchase" })} className="text-g-muted hover:text-g-word p-1.5" title={tr("Edit")}><FaPen size={11} /></button>
                  <button onClick={() => delPack(r)} className="text-g-muted hover:text-red-400 p-1.5" title={tr("Delete")}><FaTrash size={11} /></button>
                </div>
              </div>
              {links[r.id] && <SellLink link={links[r.id]} onClose={() => clearLink(r.id)} />}
            </div>
          ))}
          {(packs || []).length === 0 && <Empty icon="🎟️" text={tr("No packages yet — sell a bundle of sessions for predictable revenue.")} />}
        </div>
      </Card>

      {/* ── MEMBERSHIPS ──────────────────────────────────────────── */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-g-gold inline-flex items-center gap-2"><FaIdCard size={11} /> {tr("Memberships & clubs")}</span>
          <button onClick={() => setMForm({ id: null, name: "", price: "", interval: "month", perks: "", active: true })} className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[11px] font-bold text-g-word hover:border-g-gold/40 transition inline-flex items-center gap-1.5 min-h-[44px] inline-flex items-center"><FaPlus size={9} /> {tr("New membership")}</button>
        </div>
        {mForm && (
          <div className="px-5 py-4 border-b border-white/10 bg-white/[0.015] grid gap-3 sm:grid-cols-2">
            <Field label={tr("Name")} value={mForm.name} onChange={(e) => setMForm({ ...mForm, name: e.target.value })} placeholder={tr("VIP Club")} />
            <Field label={`${tr("Price")} (${MOEDA})`} inputMode="decimal" value={mForm.price} onChange={(e) => setMForm({ ...mForm, price: e.target.value })} placeholder="99" />
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
                  <div className="text-[11px] text-g-muted truncate">{$$(r.price_cents)}/{r.interval === "year" ? tr("yr") : tr("mo")}{r.perks ? ` · ${r.perks}` : ""}{r.subscribers ? ` · ${r.subscribers} ${tr("members")}` : ""}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => sellPackage(r, "membership")} className="rounded-full border border-g-green/35 bg-g-green/10 px-3 py-1.5 text-[11px] font-bold text-g-word hover:bg-g-green/20 transition whitespace-nowrap inline-flex items-center gap-1.5"><FaLink size={10} /> {tr("Sell link")}</button>
                  <button onClick={() => setMForm({ id: r.id, name: r.name, price: (r.price_cents / 100).toString(), interval: r.interval || "month", perks: r.perks || "", active: r.active !== false })} className="text-g-muted hover:text-g-word p-1.5" title={tr("Edit")}><FaPen size={11} /></button>
                  <button onClick={() => delMember(r)} className="text-g-muted hover:text-red-400 p-1.5" title={tr("Delete")}><FaTrash size={11} /></button>
                </div>
              </div>
              {links[r.id] && <SellLink link={links[r.id]} onClose={() => clearLink(r.id)} />}
            </div>
          ))}
          {(members || []).length === 0 && <Empty icon="🌟" text={tr("No memberships yet — a monthly club is the most valuable revenue you can build.")} />}
        </div>
      </Card>

      {/* ── GIFT CARDS ───────────────────────────────────────────── */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-g-gold inline-flex items-center gap-2"><FaGift size={11} /> {tr("Gift cards")}</span>
          <button onClick={() => setCForm({ amount: "", recipient: "", purchaser: "", code: "" })} className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-[11px] font-bold text-g-word hover:border-g-gold/40 transition inline-flex items-center gap-1.5 min-h-[44px] inline-flex items-center"><FaPlus size={9} /> {tr("New gift card")}</button>
        </div>
        {cForm && (
          <div className="px-5 py-4 border-b border-white/10 bg-white/[0.015] grid gap-3 sm:grid-cols-2">
            <Field label={`${tr("Amount")} (${MOEDA})`} inputMode="decimal" value={cForm.amount} onChange={(e) => setCForm({ ...cForm, amount: e.target.value })} placeholder="100" />
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
                  <div className="text-[11px] text-g-muted truncate">{$$(r.balance_cents)} {tr("of")} {$$(r.amount_cents)}{r.recipient_contact ? ` · ${r.recipient_contact}` : ""}</div>
                </div>
                <button onClick={() => sellGift(r)} className="rounded-full border border-g-green/35 bg-g-green/10 px-3 py-1.5 text-[11px] font-bold text-g-word hover:bg-g-green/20 transition whitespace-nowrap inline-flex items-center gap-1.5 shrink-0"><FaLink size={10} /> {tr("Pay link")}</button>
              </div>
              {links[r.id] && <SellLink link={links[r.id]} onClose={() => clearLink(r.id)} />}
            </div>
          ))}
          {(cards || []).length === 0 && <Empty icon="🎁" text={tr("No gift cards yet — a favorite way for happy customers to bring you new ones.")} />}
        </div>
      </Card>

      <p className="text-center text-[11px] text-g-muted">{tr("Recurring revenue is the most valuable revenue — your AI renews, reminds and rescues it automatically.")}</p>
    </div>
   </>
  );
}

export default Recurring;
