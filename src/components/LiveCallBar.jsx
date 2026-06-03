import { useState } from "react";
import { useLang } from "../i18n.jsx";

// Compact "AI calls you" bar — drop it anywhere on the site.
// Captures the lead (/api/lead) and triggers the call (/api/call) if configured.
export default function LiveCallBar({ source = "callbar" }) {
  const { t } = useLang();
  const C = t.more.callbar;
  const [phone, setPhone] = useState("");
  const [st, setSt] = useState("idle"); // idle · calling · done

  const submit = async (e) => {
    e.preventDefault();
    setSt("calling");
    fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, source }) }).catch(() => {});
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
          <form onSubmit={submit} className="flex w-full sm:w-auto gap-2">
            <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={C.placeholder}
              className="flex-1 sm:w-52 rounded-full border border-white/20 bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70 transition" />
            <button disabled={st === "calling"} className="btn-bright whitespace-nowrap disabled:opacity-70">{st === "calling" ? C.calling : `📞 ${C.cta}`}</button>
          </form>
        )}
      </div>
    </section>
  );
}
