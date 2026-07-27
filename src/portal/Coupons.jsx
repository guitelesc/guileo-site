/* Cupons & Campanhas — the PERSONALIZED growth motor. The client (or the seller
   helping them) creates coupons and branded campaigns from their own panel:
   one-click QUICK-GENERATE drafts a coupon, one more click saves it. Every email
   the composer sends goes out in THE CLIENT'S identity — their logo, their accent
   color, their business name — "powered by Guileo" in the footer. That branded
   send is the differentiator (Natura Spa's coupons carry Natura's brand, not ours).

   Backend (owned by a parallel wave): POST /api/coupons with
     { action, token, email, ... }
       action:'list'            → { ready, coupons:[...] }
       action:'quickgen'        → { ok, coupon:{draft} }      (preset → suggested code+copy)
       action:'upsert'          → { ok, coupon }
       action:'toggle'          → { ok, coupon }
       action:'delete'          → { ok }
       action:'campaign_send'   → { ok, sent }                (send now)
       action:'campaign_upsert' → { ok, campaign }            (schedule / draft)
   Every call is best-effort: it returns a safe default on ANY failure and never
   throws to the UI, so the tab always degrades to its honest sample state. */
import { useState, useEffect, useMemo } from "react";
import { FaTag, FaGift, FaBolt, FaPen, FaTrash, FaPaperPlane, FaRegClock, FaWandMagicSparkles } from "react-icons/fa6";
import { portalApi, toast } from "../lib/portalApi.js";
import { tr, Card, Empty, SectionSkeleton, Toggle, defProfile, UI_LANG } from "../pages/Portal.jsx";

// ── API seam ────────────────────────────────────────────────────────────────
async function couponsApi(body) {
  try {
    const r = await fetch("/api/coupons", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// ── Coupon kinds — one place maps a kind to its short badge label + how its value reads.
const KINDS = {
  bogo:       { label: () => tr("Buy 1, Get 1"),      icon: "🎁", val: () => "2×1" },
  pct:        { label: () => tr("% off"),             icon: "🏷️", val: (v) => `${v || 0}%` },
  amount:     { label: () => tr("$ off"),             icon: "💵", val: (v) => `$${v || 0}` },
  firstvisit: { label: () => tr("First visit"),       icon: "✨", val: (v) => `${v || 0}%` },
  referral:   { label: () => tr("Refer a friend"),    icon: "🤝", val: () => tr("reward") },
  birthday:   { label: () => tr("Birthday"),          icon: "🎂", val: () => "1+1" },
};
const kindMeta = (k) => KINDS[k] || KINDS.pct;

// ── Quick-generate presets — one click drafts a real coupon, one more saves it.
const rndCode = (base) => `${base}${10 + Math.floor(Math.random() * 89)}`;
const QUICKGEN = [
  { key: "bogo",     emoji: "🎁", title: () => "BOGO",                    kind: "bogo",       value: "",   label: () => tr("Buy 1, Get 1 free"),        code: "BOGO" },
  { key: "buy1get1", emoji: "🛍️", title: () => tr("Buy 1 Take 2"),        kind: "bogo",       value: "",   label: () => tr("Buy 1, take 2"),            code: "LEVE2" },
  { key: "bday",     emoji: "🎂", title: () => tr("Birthday 1+1"),        kind: "birthday",   value: "",   label: () => tr("Birthday treat: 1+1"),      code: "ANIVER" },
  { key: "pct20",    emoji: "🏷️", title: () => "20% OFF",                 kind: "pct",        value: "20", label: () => tr("20% off your order"),       code: "OFF20" },
  { key: "first10",  emoji: "✨", title: () => tr("10% OFF 1st visit"),   kind: "firstvisit", value: "10", label: () => tr("10% off your first visit"), code: "BEMVINDO" },
  { key: "amt25",    emoji: "💵", title: () => "$25 OFF",                 kind: "amount",     value: "25", label: () => tr("$25 off"),                  code: "MENOS25" },
  { key: "referral", emoji: "🤝", title: () => tr("Refer a friend"),      kind: "referral",   value: "",   label: () => tr("Refer a friend, both win"), code: "INDIQUE" },
];

const plus30 = () => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); };
const emptyForm = () => ({ id: null, code: "", label: "", kind: "pct", value: "", max: "", expires: plus30(), active: true });

// Deterministic sample coupons for demo / not-connected mode.
function demoCoupons() {
  return [
    { id: "d1", code: "OFF20",    label: tr("20% off your order"),       kind: "pct",        value: "20", redemptions: 34, max: 100, expires: plus30(), active: true },
    { id: "d2", code: "BEMVINDO", label: tr("10% off your first visit"), kind: "firstvisit", value: "10", redemptions: 12, max: "",  expires: plus30(), active: true },
    { id: "d3", code: "ANIVER",   label: tr("Birthday treat: 1+1"),      kind: "birthday",   value: "",   redemptions: 8,  max: "",  expires: plus30(), active: false },
  ];
}

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return iso;
  const loc = UI_LANG === "pt" ? "pt-BR" : UI_LANG === "es" ? "es-ES" : UI_LANG === "hi" ? "hi-IN" : "en-US";
  return d.toLocaleDateString(loc, { day: "2-digit", month: "short", year: "numeric" });
};
const isExpired = (c) => { const d = new Date(c.expires); return !Number.isNaN(d.getTime()) && d < new Date(); };

function Coupons({ V, real = null, email = "", dataKey = "" }) {
  // The client's OWN brand — name/logo/accent live in their saved profile (client_profile_extras).
  const prof = useMemo(() => portalApi.loadProfile(V.label, defProfile(V)), [V]);
  const brandName = (prof.name || V.business?.name || tr("Your business")).toString();
  const logoUrl = prof.logo_url || prof.logoUrl || "";
  const accent = prof.accent || prof.brandColor || "#C9A24B";   // neutral brand-gold placeholder if unset
  const brandKnown = !!(prof.accent || prof.brandColor || logoUrl);

  const live = !!(real && email && dataKey);

  const [coupons, setCoupons] = useState(live ? null : demoCoupons());   // null = fetch in flight
  const [form, setForm] = useState(null);            // null = form closed; object = drafting/editing
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    // Live → pull the client's real coupons; demo/not-connected stays on the
    // sample seed from useState's initializer (no synchronous setState needed).
    if (live) {
      couponsApi({ action: "list", token: dataKey, email }).then((d) => {
        if (!alive) return;
        setCoupons(Array.isArray(d?.coupons) ? d.coupons : []);
      });
    }
    return () => { alive = false; };
  }, [live, dataKey, email]);

  // ── Quick-generate: draft a coupon into the form instantly (one click) ──
  const quickGen = async (p) => {
    const draft = { ...emptyForm(), code: rndCode(p.code), label: p.title(), kind: p.kind, value: p.value };
    // Fuller/nicer copy comes back from label() when present.
    draft.label = p.label ? p.label() : p.title();
    setForm(draft);
    if (live) {
      // Let the backend enrich (e.g. guarantee a unique code / suggested copy) — best-effort.
      const d = await couponsApi({ action: "quickgen", token: dataKey, email, preset: p.key });
      if (d?.coupon) setForm((f) => (f ? { ...f, ...d.coupon, id: null } : f));
    }
    toast(tr("Coupon drafted ✓ — review and save"));
  };

  // ── Save (create or edit) ──
  const save = async () => {
    if (!form) return;
    const code = (form.code || "").trim().toUpperCase();
    if (!code) { toast(tr("Give the coupon a code first.")); return; }
    const rec = { ...form, code };
    setSaving(true);
    if (live) {
      const d = await couponsApi({ action: "upsert", token: dataKey, email, coupon: rec });
      setSaving(false);
      if (!d?.ok) { toast(tr("I couldn't save that — check your connection and try again.")); return; }
      const saved = d.coupon || { ...rec, id: rec.id || `c-${Date.now()}`, redemptions: rec.redemptions || 0 };
      setCoupons((cs) => upsertLocal(cs || [], saved));
    } else {
      const saved = { ...rec, id: rec.id || `c-${Date.now()}`, redemptions: rec.redemptions || 0 };
      setCoupons((cs) => upsertLocal(cs || [], saved));
      setSaving(false);
    }
    toast(tr("Coupon saved ✓"));
    setForm(null);
  };

  const toggle = async (c) => {
    const next = { ...c, active: !c.active };
    setCoupons((cs) => (cs || []).map((x) => (x.id === c.id ? next : x)));   // optimistic
    if (live) {
      const d = await couponsApi({ action: "toggle", token: dataKey, email, id: c.id, active: next.active });
      if (!d?.ok) { setCoupons((cs) => (cs || []).map((x) => (x.id === c.id ? c : x))); toast(tr("I couldn't save that — check your connection and try again.")); return; }
    }
    toast(next.active ? tr("Coupon activated ✓") : tr("Coupon paused"));
  };

  const remove = async (c) => {
    const prev = coupons;
    setCoupons((cs) => (cs || []).filter((x) => x.id !== c.id));   // optimistic
    if (live) {
      const d = await couponsApi({ action: "delete", token: dataKey, email, id: c.id });
      if (!d?.ok) { setCoupons(prev); toast(tr("I couldn't delete that — try again.")); return; }
    }
    toast(tr("Coupon deleted"));
  };

  const activeCoupons = (coupons || []).filter((c) => c.active && !isExpired(c));

  return (
    <div className="space-y-4 stagger">
      {/* Hero — what this tab is, in the Gui-orange growth accent */}
      <div className="rounded-2xl border border-[#FF8A33]/25 bg-gradient-to-br from-[#FF8A33]/[0.09] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#FF8A33" }}>
          <FaTag size={11} /> {tr("Coupons & Campaigns")}
        </div>
        <div className="mt-1 text-xl font-black text-g-word">{tr("Your personalized growth motor")}</div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">{tr("Create coupons and promos in one click — every email goes out in YOUR brand: your logo, your color, your name.")}</p>
      </div>

      {/* ── QUICK-GENERATE row ── */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-2.5 border-b border-white/10 flex items-center gap-2">
          <FaBolt className="text-[#FF8A33]" size={12} />
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#FF8A33" }}>{tr("Quick generate")}</span>
          <span className="text-[11px] text-g-muted hidden sm:inline">— {tr("one click drafts it, one more saves it")}</span>
        </div>
        <div className="p-4 flex flex-wrap gap-2">
          {QUICKGEN.map((p) => (
            <button key={p.key} onClick={() => quickGen(p)}
              className="clicky inline-flex items-center gap-2 rounded-full border border-[#FF8A33]/30 bg-[#FF8A33]/[0.08] px-3.5 py-2 text-[12px] font-black text-g-word hover:border-[#FF8A33]/55 whitespace-nowrap">
              <span className="text-sm">{p.emoji}</span> {p.title()}
            </button>
          ))}
        </div>
      </Card>

      {/* ── COUPON FORM (drafting / editing) ── */}
      {form && (
        <Card className="border-[#FF8A33]/25">
          <div className="flex items-center gap-2 mb-3">
            <FaWandMagicSparkles className="text-[#FF8A33]" size={13} />
            <span className="text-sm font-black text-g-word">{form.id ? tr("Edit coupon") : tr("New coupon")}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tr("Code")}>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="OFF20" className={inputCls} />
            </Field>
            <Field label={tr("Kind")}>
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className={inputCls}>
                {Object.keys(KINDS).map((k) => <option key={k} value={k} className="bg-[#161512]">{kindMeta(k).icon} {kindMeta(k).label()}</option>)}
              </select>
            </Field>
            <Field label={tr("Label (what the customer sees)")} full>
              <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder={tr("20% off your order")} className={inputCls} />
            </Field>
            {(form.kind === "pct" || form.kind === "amount" || form.kind === "firstvisit") && (
              <Field label={form.kind === "amount" ? tr("Amount ($)") : tr("Percent (%)")}>
                <input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder={form.kind === "amount" ? "25" : "20"} className={inputCls} />
              </Field>
            )}
            <Field label={tr("Max redemptions (blank = unlimited)")}>
              <input type="number" value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })}
                placeholder="∞" className={inputCls} />
            </Field>
            <Field label={tr("Expires")}>
              <input type="date" value={form.expires} onChange={(e) => setForm({ ...form, expires: e.target.value })} className={inputCls} />
            </Field>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button onClick={save} disabled={saving}
              className="rounded-full bg-[#FF8A33] px-4 py-2 text-[12px] font-black text-[#161512] hover:brightness-110 transition disabled:opacity-50">
              {saving ? tr("Saving…") : tr("Save coupon")}
            </button>
            <button onClick={() => setForm(null)}
              className="rounded-full border border-white/15 px-4 py-2 text-[12px] font-bold text-g-muted hover:text-g-word transition">
              {tr("Cancel")}
            </button>
          </div>
        </Card>
      )}

      {/* ── COUPON LIST ── */}
      {live && coupons === null ? (
        <SectionSkeleton rows={3} />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-g-gold flex items-center gap-1.5"><FaGift size={11} /> {tr("Your coupons")}</span>
            <button onClick={() => setForm(emptyForm())} className="text-[11px] font-bold text-[#FF8A33] hover:brightness-110 transition">+ {tr("New")}</button>
          </div>
          {(coupons || []).length === 0 ? (
            <Empty icon="🎟️" text={tr("No coupons yet — hit a quick-generate button above to make your first one.")} />
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {(coupons || []).map((c, i) => {
                const m = kindMeta(c.kind); const expired = isExpired(c);
                return (
                  <div key={c.id || i} style={{ animationDelay: `${i * 50}ms` }} className="row-in px-5 py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap">
                    <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-base shrink-0">{m.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-g-word truncate flex items-center gap-2">
                        <span className="font-mono tracking-wide" style={{ color: "#FF8A33" }}>{c.code}</span>
                        <span className="text-g-muted font-normal truncate">{c.label}</span>
                      </div>
                      <div className="text-[11px] text-g-muted truncate">
                        {m.label()} · {m.val(c.value)} · {tr("used")} {c.redemptions || 0}/{c.max || "∞"} · {tr("exp.")} {fmtDate(c.expires)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {expired
                        ? <span className="text-[10px] font-black uppercase text-g-muted border border-white/10 rounded-full px-2 py-0.5">{tr("expired")}</span>
                        : <Toggle on={!!c.active} onClick={() => toggle(c)} />}
                      <button onClick={() => setForm({ ...emptyForm(), ...c })} title={tr("Edit")} className="text-g-muted hover:text-g-word transition p-1"><FaPen size={12} /></button>
                      <button onClick={() => remove(c)} title={tr("Delete")} className="text-g-muted hover:text-red-400 transition p-1"><FaTrash size={12} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ── CAMPAIGN COMPOSER ── */}
      <CampaignComposer
        live={live} dataKey={dataKey} email={email}
        brandName={brandName} logoUrl={logoUrl} accent={accent} brandKnown={brandKnown}
        coupons={activeCoupons}
      />

      {/* Differentiator note */}
      <div className="rounded-xl2 border border-[#FF8A33]/20 bg-[#FF8A33]/[0.05] px-4 py-3 text-[11px] text-g-muted flex items-start gap-2">
        <span className="text-sm">✨</span>
        <span>{tr("Every email is sent in YOUR identity — your logo, your color, your business name — with a discreet “powered by Guileo” in the footer. That's the difference: it grows YOUR brand, not ours.")}</span>
      </div>
    </div>
  );
}

// ── Campaign composer + live branded email preview ──────────────────────────
const TEMPLATES = [
  { key: "promo",     emoji: "📣", title: () => tr("Promo") },
  { key: "coupon",    emoji: "🎟️", title: () => tr("Coupon") },
  { key: "novidades", emoji: "📰", title: () => tr("News") },
];
const AUDIENCES = [
  { key: "todos",         title: () => tr("All customers") },
  { key: "recentes",      title: () => tr("Recent") },
  { key: "aniversariantes", title: () => tr("Birthdays") },
];

function CampaignComposer({ live, dataKey, email, brandName, logoUrl, accent, brandKnown, coupons }) {
  const [kind, setKind] = useState("promo");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [couponId, setCouponId] = useState("");
  const [audience, setAudience] = useState("todos");
  const [busy, setBusy] = useState(false);

  const attached = coupons.find((c) => c.id === couponId) || null;
  const hl = headline || tr("A little something for you");
  const bd = body || tr("We prepared an exclusive offer for our customers. Come enjoy it!");

  const send = async (schedule) => {
    setBusy(true);
    const payload = {
      action: schedule ? "campaign_upsert" : "campaign_send",
      token: dataKey, email,
      campaign: { kind, headline: hl, body: bd, coupon_id: couponId || null, audience },
    };
    if (live) {
      const d = await couponsApi(payload);
      setBusy(false);
      if (!d?.ok) { toast(tr("I couldn't send that — check your connection and try again.")); return; }
    } else {
      setBusy(false);
    }
    toast(schedule ? tr("Campaign scheduled ✓") : tr("Campaign sent ✓ — in your brand"));
    setHeadline(""); setBody("");
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-2.5 border-b border-white/10 flex items-center gap-2">
        <FaPaperPlane className="text-g-gold" size={11} />
        <span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Campaign composer")}</span>
      </div>
      <div className="p-4 grid gap-4 lg:grid-cols-2">
        {/* left: the form */}
        <div className="space-y-3">
          <Field label={tr("Template")}>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button key={t.key} onClick={() => setKind(t.key)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold border transition whitespace-nowrap ${kind === t.key ? "border-[#FF8A33]/55 bg-[#FF8A33]/15 text-g-word" : "border-white/12 bg-white/[0.03] text-g-muted hover:text-g-word"}`}>
                  {t.emoji} {t.title()}
                </button>
              ))}
            </div>
          </Field>
          <Field label={tr("Headline")}>
            <input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder={tr("A little something for you")} className={inputCls} />
          </Field>
          <Field label={tr("Message")}>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder={tr("We prepared an exclusive offer for our customers. Come enjoy it!")} className={`${inputCls} resize-none`} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("Attach coupon")}>
              <select value={couponId} onChange={(e) => setCouponId(e.target.value)} className={inputCls}>
                <option value="" className="bg-[#161512]">{tr("None")}</option>
                {coupons.map((c) => <option key={c.id} value={c.id} className="bg-[#161512]">{c.code}</option>)}
              </select>
            </Field>
            <Field label={tr("Audience")}>
              <select value={audience} onChange={(e) => setAudience(e.target.value)} className={inputCls}>
                {AUDIENCES.map((a) => <option key={a.key} value={a.key} className="bg-[#161512]">{a.title()}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={() => send(false)} disabled={busy}
              className="rounded-full bg-[#FF8A33] px-4 py-2 text-[12px] font-black text-[#161512] hover:brightness-110 transition disabled:opacity-50 inline-flex items-center gap-1.5">
              <FaPaperPlane size={11} /> {tr("Send now")}
            </button>
            <button onClick={() => send(true)} disabled={busy}
              className="rounded-full border border-white/15 px-4 py-2 text-[12px] font-bold text-g-muted hover:text-g-word transition inline-flex items-center gap-1.5">
              <FaRegClock size={11} /> {tr("Schedule")}
            </button>
          </div>
        </div>

        {/* right: LIVE branded email preview — the client's OWN identity */}
        <div>
          <div className="text-[10px] font-black uppercase tracking-wider text-g-muted mb-1.5">{tr("Live preview")}</div>
          <div className="rounded-xl2 overflow-hidden border border-white/10 bg-white">
            {/* branded header bar in the client's accent */}
            <div className="px-4 py-3 flex items-center gap-2.5" style={{ background: accent }}>
              {logoUrl
                ? <img src={logoUrl} alt={brandName} className="h-8 w-8 rounded-full object-cover bg-white/20" />
                : <span className="grid place-items-center h-8 w-8 rounded-full bg-white/25 text-white font-black text-sm">{(brandName[0] || "G").toUpperCase()}</span>}
              <span className="font-black text-white text-sm truncate" style={{ textShadow: "0 1px 2px rgba(0,0,0,.25)" }}>{brandName}</span>
            </div>
            {/* body */}
            <div className="px-5 py-5 text-left">
              <div className="text-[17px] font-black leading-tight" style={{ color: "#1a1a1a" }}>{hl}</div>
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "#444" }}>{bd}</p>
              {attached && (
                <div className="mt-4 rounded-lg border-2 border-dashed px-4 py-3 text-center" style={{ borderColor: accent }}>
                  <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#777" }}>{tr("Your coupon")}</div>
                  <div className="text-lg font-black font-mono tracking-widest" style={{ color: accent }}>{attached.code}</div>
                  <div className="text-[11px]" style={{ color: "#666" }}>{attached.label}</div>
                </div>
              )}
              <div className="mt-4">
                <span className="inline-block rounded-full px-5 py-2 text-[13px] font-black text-white" style={{ background: accent }}>
                  {kind === "novidades" ? tr("See what's new") : tr("Redeem now")}
                </span>
              </div>
            </div>
            {/* footer — powered by Guileo (discreet) */}
            <div className="px-5 py-2.5 border-t text-[10px]" style={{ borderColor: "#eee", color: "#999", background: "#fafafa" }}>
              {brandName} · powered by <span style={{ fontWeight: 800 }}>Guileo</span>
            </div>
          </div>
          {!brandKnown && (
            <div className="mt-2 text-[10px] text-g-muted">
              {tr("Uses the identity from your profile — add your logo and brand color in Settings to see them here.")}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── little primitives ──
const inputCls = "w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-[13px] text-g-word placeholder:text-g-muted/60 outline-none focus:border-[#FF8A33]/50 transition";
function Field({ label, children, full }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="block text-[10px] font-black uppercase tracking-wider text-g-muted mb-1">{label}</span>
      {children}
    </label>
  );
}
function upsertLocal(list, rec) {
  const i = list.findIndex((x) => x.id === rec.id);
  if (i === -1) return [rec, ...list];
  const next = list.slice(); next[i] = rec; return next;
}

export default Coupons;
