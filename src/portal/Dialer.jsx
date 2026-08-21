/* Split out of Portal.jsx (performance): Dialer tab view — code moved verbatim. */
import { useState } from "react";
import { toast } from "../lib/portalApi.js";
import { tr, Card , FaixaAmostra} from "../pages/Portal.jsx";

function Dialer({ real }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
  const [num, setNum] = useState("");
  const [calling, setCalling] = useState(false);
  // Format the raw digits as a friendly US-style number as the user taps.
  const fmt = (s) => {
    const d = s.replace(/\D/g, "").slice(0, 10);
    if (!d) return "+1 (___) ___-____";
    const a = d.slice(0, 3).padEnd(3, "_"), b = d.slice(3, 6).padEnd(3, "_"), c = d.slice(6, 10).padEnd(4, "_");
    return `+1 (${a}) ${b}-${c}`;
  };
  const press = (k) => setNum((n) => (n.replace(/\D/g, "").length >= 10 ? n : n + k));
  const start = () => {
    if (num.replace(/\D/g, "").length < 10) { toast(tr("Enter a 10-digit number first")); return; }
    setCalling(true); toast(`${tr("Preview")} · ${fmt(num)} 📞`);
    setTimeout(() => { setCalling(false); setNum(""); toast(tr("Preview — in your live account, Gui places this call and logs it in Call Logs.")); }, 1600);
  };
  return (
    <>
      <FaixaAmostra real={real} />
      <div className="max-w-xs mx-auto">
      <Card className="text-center">
        <div className="text-xs font-bold uppercase tracking-wide text-g-gold mb-3">{tr("AI Call Dialer")}</div>
        <div className="h-10 rounded-xl2 bg-black/20 border border-white/10 grid place-items-center text-g-word font-bold mb-3 tracking-wide">{fmt(num)}</div>
        <div className="grid grid-cols-3 gap-2">{keys.map((k) => <button key={k} onClick={() => press(k)} className="h-12 rounded-xl2 border border-white/10 bg-white/[0.04] text-g-word font-bold hover:border-g-gold/40 active:scale-95 transition">{k}</button>)}</div>
        <div className="flex gap-2 mt-3">
          <button onClick={() => setNum((n) => n.slice(0, -1))} disabled={!num} className="rounded-xl2 border border-white/15 px-4 text-g-muted hover:text-g-word disabled:opacity-30 transition" aria-label={tr("Delete")}>⌫</button>
          <button onClick={start} disabled={calling} className="btn-bright flex-1 text-sm disabled:opacity-70">{calling ? tr("Calling…") : tr("📞 Start AI call")}</button>
        </div>
        <p className="mt-2.5 text-[10px] text-g-muted">{tr("The AI places the call, talks to the customer, and logs the outcome for you.")}</p>
      </Card>
    </div>
    </>
  );
}

export default Dialer;
