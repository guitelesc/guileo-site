import { useState } from "react";
import { useLang } from "../i18n.jsx";
import mark from "../assets/guileo-mark.png";
import ConsentText from "./ConsentText.jsx";

// Compact "AI calls you" bar — drop it anywhere on the site.
// Captures the lead (/api/lead) and triggers the call (/api/call) if configured.
export default function LiveCallBar({ source = "callbar" }) {
  const { t, lang } = useLang();
  const C = t.more.callbar;
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false); // TCPA — affirmative opt-in required before any automated call
  const [err, setErr] = useState(false);
  const [st, setSt] = useState("idle"); // idle · calling · done

  const submit = async (e) => {
    e.preventDefault();
    if (!consent) { setErr(true); return; } // no automated call without prior express consent
    setErr(false);
    setSt("calling");
    // noCall:true → record the lead but don't double-dial; we trigger /api/call ourselves (which
    // enforces DNC + per-IP caps). consent is logged so it's never auto-called without opt-in.
    fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, source, consent, lang, noCall: true }) }).catch(() => {});
    try { await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }) }); } catch { /* noop */ }
    setSt("done");
  };

  return (
    <section className="wrap py-8">
      <div className="rounded-xl3 border border-white/25 bg-gradient-to-br from-white/[0.18] via-white/[0.10] to-g-green/[0.10] backdrop-blur-xl shadow-lift p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="grid place-items-center h-11 w-11 rounded-full bg-white/[0.06] border border-white/10 text-2xl shrink-0">🧑‍💼</span>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wide text-g-green inline-flex items-center gap-1.5">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-g-green/50 animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-g-green" /></span>live
            </div>
            <div className="font-extrabold text-g-word leading-tight">{C.line}</div>
          </div>
        </div>
        {st === "done" ? (
          <div className="rounded-full bg-g-green/15 border border-g-green/40 text-g-light px-5 py-3 text-sm font-semibold whitespace-nowrap">{C.done}</div>
        ) : (
          <form onSubmit={submit} className="flex w-full flex-col sm:w-auto gap-2">
            <div className="flex w-full gap-2">
              <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={C.placeholder}
                className="flex-1 sm:w-52 rounded-full border border-white/20 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70 transition" />
              <button disabled={st === "calling" || !consent} aria-label={C.cta}
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/50 px-5 py-3 text-sm font-extrabold text-g-deep shadow-[0_3px_14px_rgba(0,0,0,0.4)] transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                style={{ background: "linear-gradient(180deg,#fbfbfd 0%,#dfe3e8 42%,#b7bfc8 52%,#dde1e6 70%,#f5f7f9 100%)" }}>
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/80 to-transparent transition-transform duration-[900ms] group-hover:translate-x-full" />
                <img src={mark} alt="" className="relative h-4 w-4 object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]" />
                <span className="relative">{st === "calling" ? C.calling : C.cta}</span>
              </button>
            </div>
            <label className={`flex items-start gap-2 text-[10px] leading-snug ${err && !consent ? "text-g-gold" : "text-g-muted"}`}>
              <input type="checkbox" required checked={consent} onChange={(e) => { setConsent(e.target.checked); if (e.target.checked) setErr(false); }} className="mt-0.5 shrink-0" />
              <span><ConsentText lang={lang} /></span>
            </label>
          </form>
        )}
      </div>
    </section>
  );
}
