/* Split out of Portal.jsx (performance): Grow tab view — code moved verbatim. */
import { useState, useEffect } from "react";
import { waLink } from "../data/contact.js";
import { portalApi } from "../lib/portalApi.js";
import { Card, tr, ADDONS } from "../pages/Portal.jsx";

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

function Grow() {
  const [sent, setSent] = useState(false);
  const [txt, setTxt] = useState("");
  const submit = (e) => { e.preventDefault(); setSent(true); window.open(waLink(`Hi Guileo! I wish you offered: ${txt}`), "_blank"); };
  return (
    <div className="space-y-4 stagger">
      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.06] border-g-green/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-extrabold text-g-word">{tr("Grow with Guileo")}</div><div className="text-xs text-g-muted mt-0.5">{tr("Want more? Add a channel or service — we set it up, you keep one login and one bill. Growth on tap.")}</div></div>
          <a href={waLink("Hi Guileo! I'd like to add a new service to my plan")} target="_blank" rel="noopener" className="btn-bright text-sm">{tr("I'll connect you with my team →")}</a>
        </div>
      </Card>
      <ReferralCard />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ADDONS.map(([ic, name, desc], i) => (
          <Card key={i} className="flex flex-col">
            <div className="flex items-center gap-3"><span className="grid place-items-center h-11 w-11 rounded-xl bg-white/[0.06] text-xl shrink-0">{ic}</span><div className="text-sm font-bold text-g-word">{name}</div></div>
            <p className="text-xs text-g-muted mt-2 flex-1">{desc}</p>
            <a href={waLink(`Hi Guileo! I'd like to add: ${name}`)} target="_blank" rel="noopener" className="mt-3 inline-flex items-center justify-center gap-1 rounded-full border border-g-gold/40 bg-g-gold/[0.08] px-4 py-2 text-xs font-bold text-g-gold hover:bg-g-gold/[0.16] transition">{tr("Request this →")}</a>
          </Card>
        ))}
      </div>
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
