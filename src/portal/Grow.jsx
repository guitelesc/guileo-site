/* Split out of Portal.jsx (performance): Grow tab view — code moved verbatim. */
import { useState, useEffect } from "react";
import { waLink } from "../data/contact.js";
import { portalApi } from "../lib/portalApi.js";
import { Card, tr, CATALOG, SERVER_AUTOMATIONS } from "../pages/Portal.jsx";

/* ── "Indique e ganhe" — client referral program ─────────────────────────────
   The tracking loop already exists site-wide (src/App.jsx useReferralAttribution):
   any visit with ?ref=NAME is remembered for 90 days and auto-attached to every
   /api/lead submit — so a friend who lands via this link and fills any form
   arrives in Luis's owner email + /admin carrying this client's ref. This card
   only has to hand the client THEIR personal link.
   PRIVACY: the ?ref= slug is the client's email base64url-encoded (btoa → URL-safe
   -/_ chars, padding stripped) — the raw email never appears in the URL. It stays
   decodable server-side later (reverse the -/_ swap, re-pad, atob) so referral
   leads can be attributed back to this exact client for the free-month credit.
   Demo mode works too: no session email → placeholder demo link. */
const b64url = (s) => { try { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); } catch { return ""; } };

function ReferralCard() {
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let on = true;
    portalApi.session().then((s) => { if (on && s?.email) setEmail(s.email); }).catch(() => { /* demo/offline → placeholder link */ });
    return () => { on = false; };
  }, []);
  const link = `https://guileoai.com?ref=${b64url(email || "demo@guileoai.com") || "demo"}`;
  // Offer + share copy are Luis's exact words (his offer to honor) — PT on purpose.
  const waMsg = `Conhece a Gui? É uma IA que atende meu telefone 24/7… usa meu link e a gente ganha um mês grátis: ${link}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2200); } catch { /* clipboard blocked → they can select the visible link */ }
  };
  return (
    <Card className="bg-gradient-to-br from-g-gold/[0.12] to-g-green/[0.05] border-g-gold/40">
      <div className="text-sm font-extrabold text-g-word">🎁 Indique um negócio amigo — vocês DOIS ganham 1 mês grátis</div>
      <p className="text-xs text-g-muted mt-1">{tr("Share your personal link — when a friend's business joins Guileo through it, you both get one month free.")}</p>
      <div className="mt-3 flex flex-col sm:flex-row items-stretch gap-2">
        <div className="flex-1 rounded-full border border-white/15 bg-black/25 px-4 py-2.5 text-xs text-g-light font-mono truncate select-all" title={link}>{link}</div>
        <button onClick={copy} className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-bold transition whitespace-nowrap ${copied ? "border-g-green/50 bg-g-green/[0.12] text-g-light" : "border-g-gold/40 bg-g-gold/[0.08] text-g-gold hover:bg-g-gold/[0.16]"}`}>
          {copied ? tr("Invite link copied ✓") : tr("Copy link")}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noopener" className="btn-bright text-xs inline-flex items-center justify-center whitespace-nowrap">📲 WhatsApp →</a>
      </div>
    </Card>
  );
}

/* Block styling — three honest tiers, in the cockpit's own signal palette (warm cement base):
   green = it works today · gold = included, one ask away · blue = a build project.
   No new tokens: every color here is an existing g-* utility / signal hex. */
const BLOCK = {
  on: { title: "Already on", sub: "Working in your account today.", badge: "On", ring: "border-g-green/30", wash: "from-g-green/[0.10] to-transparent", chip: "bg-g-green/15 text-g-green border-g-green/30", dot: true },
  included: { title: "Included — just ask", sub: "Already in the platform. We switch it on for you.", badge: "Included", ring: "border-g-gold/30", wash: "from-g-gold/[0.09] to-transparent", chip: "bg-g-gold/15 text-g-gold border-g-gold/30" },
  project: { title: "Custom project", sub: "Our team builds it. Own scope and budget — not part of your monthly plan.", badge: "Project", ring: "border-[#3FB4FF]/25", wash: "from-[#3FB4FF]/[0.08] to-transparent", chip: "bg-[#3FB4FF]/15 text-[#3FB4FF] border-[#3FB4FF]/30" },
};

/* One offering. The CTA is the honest one: if the thing already has a screen in THIS client's
   cockpit, the button opens it; otherwise it's the WhatsApp ask to the team (the only "request"
   path that exists today — no invented endpoint). */
function OfferCard({ item, kind, canOpen, onNav }) {
  const B = BLOCK[kind];
  const inApp = item.view && canOpen(item.view);
  return (
    <Card className={`flex flex-col ${B.ring}`}>
      <div className="flex items-start gap-3">
        <span className="grid place-items-center h-11 w-11 rounded-xl bg-white/[0.06] text-xl shrink-0">{item.ic}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-g-word leading-snug">{tr(item.name)}</div>
          <span className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${B.chip}`}>
            {B.dot && <span className="h-1 w-1 rounded-full bg-g-green animate-pulse" />}{tr(B.badge)}
          </span>
        </div>
      </div>
      <p className="text-xs text-g-muted mt-2.5 leading-relaxed">{tr(item.desc)}</p>
      {item.note && <p className="text-[11px] text-g-gold/90 mt-2 leading-relaxed border-l-2 border-g-gold/40 pl-2">⚠️ {tr(item.note)}</p>}
      <div className="flex-1" />
      {inApp
        ? <button onClick={() => onNav(item.view)} className="mt-3 inline-flex items-center justify-center gap-1 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 text-xs font-bold text-g-word hover:bg-white/[0.1] transition">{tr("Open →")}</button>
        : <a href={waLink(`Hi Guileo! I'd like to talk about: ${item.name}`)} target="_blank" rel="noopener" className="mt-3 inline-flex items-center justify-center gap-1 rounded-full border border-g-gold/40 bg-g-gold/[0.08] px-4 py-2 text-xs font-bold text-g-gold hover:bg-g-gold/[0.16] transition">{kind === "on" ? tr("Ask my team →") : tr("Request this →")}</a>}
    </Card>
  );
}

/* The automations that REALLY run, server-side, on a schedule — READ-ONLY on purpose.
   There is no per-tenant endpoint to switch these on/off (checked: /api/automations is
   DIGEST-token cron-only; the ONLY tenant-controlled flag is auto-collections, which lives
   in Finance and is linked from its row). A toggle here would promise something it cannot
   deliver, which is exactly the bug this screen exists to kill. */
function ServerAutomations({ canOpen, onNav }) {
  return (
    <Card className="p-0 overflow-hidden border-g-green/25">
      <div className="px-5 py-3 border-b border-white/10 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-g-green">⚙️ {tr("What actually runs on our servers")}</span>
        <span className="text-[9px] font-black uppercase tracking-wide border border-white/15 rounded-full px-2 py-0.5 text-g-muted">{tr("Read-only")}</span>
      </div>
      <div className="px-5 py-3 text-xs text-g-muted leading-relaxed border-b border-white/[0.06]">{tr("These run 24/7, whether or not you are logged in. Shown read-only — the two opt-in ones are marked.")}</div>
      <div className="divide-y divide-white/[0.05]">
        {SERVER_AUTOMATIONS.map((a, i) => (
          <div key={i} className="flex items-start gap-3 px-5 py-3">
            <span className="text-base shrink-0 mt-0.5">{a.ic}</span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-g-word">{tr(a.name)}</div>
              <div className="text-[11px] text-g-muted mt-0.5">{tr(a.desc)}</div>
              {a.optin && <div className="text-[11px] text-g-gold/90 mt-1">{tr(a.optin)}</div>}
            </div>
            {a.optin && <span className="shrink-0 text-[9px] font-black uppercase tracking-wide rounded-full border border-g-gold/30 bg-g-gold/10 text-g-gold px-2 py-0.5">{tr("Opt-in")}</span>}
            {a.view && canOpen(a.view) && <button onClick={() => onNav(a.view)} className="shrink-0 text-[10px] font-bold text-g-green hover:text-g-light whitespace-nowrap">{tr("Open →")}</button>}
          </div>
        ))}
      </div>
      <div className="px-5 py-3 border-t border-white/10 text-[11px] text-g-muted leading-relaxed bg-black/15">
        {tr("The “Automations” list on your Overview is your own plan inside this cockpit: it organizes and records what you ran here — it does not send anything by itself. The real sending is the list above.")}
      </div>
    </Card>
  );
}

function Grow({ onNav, sections }) {
  const [sent, setSent] = useState(false);
  const [txt, setTxt] = useState("");
  const submit = (e) => { e.preventDefault(); setSent(true); window.open(waLink(`Hi Guileo! I wish you offered: ${txt}`), "_blank"); };
  // Only offer an in-app jump to a tab this client's nav actually has (sectors differ) — and
  // only when the shell handed us a navigator. Otherwise the card falls back to the team ask.
  const keys = new Set((sections || []).map((s) => s[0]));
  const canOpen = (v) => !!onNav && keys.has(v);
  return (
    <div className="space-y-4 stagger">
      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.06] border-g-green/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0"><div className="text-sm font-extrabold text-g-word">{tr("Everything you have with Guileo")}</div><div className="text-xs text-g-muted mt-0.5 leading-relaxed">{tr("Website, app, automations, software, ads, marketing, creative and AI — what is already yours, what we switch on for you, and what our team builds.")}</div></div>
          <a href={waLink("Hi Guileo! I'd like to add a new service to my plan")} target="_blank" rel="noopener" className="btn-bright text-sm">{tr("I'll connect you with my team →")}</a>
        </div>
      </Card>
      {CATALOG.map(([kind, items]) => (
        <div key={kind} className="space-y-3">
          <div className={`rounded-xl2 border ${BLOCK[kind].ring} bg-gradient-to-r ${BLOCK[kind].wash} px-4 py-2.5`}>
            <div className="text-sm font-extrabold text-g-word">{tr(BLOCK[kind].title)}</div>
            <div className="text-[11px] text-g-muted mt-0.5">{tr(BLOCK[kind].sub)}</div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item, i) => <OfferCard key={i} item={item} kind={kind} canOpen={canOpen} onNav={onNav} />)}
          </div>
          {kind === "on" && <ServerAutomations canOpen={canOpen} onNav={onNav} />}
        </div>
      ))}
      <ReferralCard />
      {/* Demand learning — request something we don't offer yet */}
      <Card>
        <div className="text-sm font-extrabold text-g-word">{tr("Don't see what you need?")}</div>
        <p className="text-xs text-g-muted mt-0.5">{tr("Tell us what you wish we offered — we're always adding services, and your idea shapes what we build next.")}</p>
        {!sent ? (
          <form onSubmit={submit} className="mt-3 flex flex-col sm:flex-row gap-2">
            <input required value={txt} onChange={(e) => setTxt(e.target.value)} aria-label="Request a service we don't offer yet" placeholder="e.g. A reservations widget for my website…" className="flex-1 rounded-full border border-white/15 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
            <button className="btn-bright text-sm whitespace-nowrap">{tr("I'll send that to my team →")}</button>
          </form>
        ) : (
          <div className="mt-3 rounded-xl2 border border-g-green/40 bg-g-green/[0.1] p-3 text-sm font-bold text-g-light text-center">{tr("✅ Got it — thanks! Our team will look into it.")}</div>
        )}
      </Card>
    </div>
  );
}

export default Grow;
