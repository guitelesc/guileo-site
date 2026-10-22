/* Split out of Portal.jsx (performance): Dialer tab view — code moved verbatim. */
import { useState } from "react";
import { toast } from "../lib/portalApi.js";
import { tr, Card , FaixaAmostra} from "../pages/Portal.jsx";

// `contaReal` (2026-09-27): conta logada e não-demo SEM chave de conexão tem `real` null — e caía
// no teclado de demonstração. Quem paga nunca vê o teclado que não disca, com ou sem chave.
function Dialer({ real, contaReal = false }) {
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
  // 🚨 BOTÃO QUE FINGIA (2026-08-25). `start()` nunca discou nada: acendia "Calling…" e
  // devolvia um toast. Em conta REAL isso é pior que ausência — o dono acha que a ligação saiu,
  // ninguém liga pro cliente, e o lead morre em silêncio achando que foi atendido.
  // Discagem de verdade só existe pelo portão blindado (functions/api/call.js, com DNC + tetos);
  // esta tela não tem esse caminho. Então: em modo real ela DIZ que não disca, e não oferece o
  // botão. Em demonstração o teclado continua — com selo de demo e zero "✓".
  const start = () => {
    if (num.replace(/\D/g, "").length < 10) { toast(tr("Enter a 10-digit number first")); return; }
    setCalling(true); toast(`${tr("Demo")} · ${fmt(num)} 📞`);
    setTimeout(() => { setCalling(false); setNum(""); toast(tr("Demo only — nothing was dialed. Outbound calls run through Gui's protected dialer.")); }, 1600);
  };

  // ── MODO REAL: estado honesto, sem ação que não acontece ──────────────────────────────────
  if (real || contaReal) return (
    <div className="max-w-sm mx-auto">
      <Card className="p-5 text-center">
        <div className="text-3xl">☎️</div>
        <div className="mt-2 text-sm font-extrabold text-g-word">{tr("Dialing from here isn't on in your account yet")}</div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-g-muted">
          {tr("Outbound calls go out through Gui's protected dialer (do-not-call list + daily caps) — not from this keypad. Nothing here would dial today, so we don't pretend it does.")}
        </p>
        <p className="mt-2 text-[11.5px] text-g-muted">{tr("Every call Gui does place is logged in Calls.")}</p>
      </Card>
    </div>
  );
  return (
    <>
      <FaixaAmostra real={real} />
      <div className="max-w-xs mx-auto">
      <Card className="text-center">
        <div className="mb-3 flex items-center justify-center gap-2"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("AI Call Dialer")}</span><span className="rounded-full border border-white/15 bg-white/[0.05] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-g-muted">{tr("Demo")}</span></div>
        <div className="h-10 rounded-xl2 bg-black/20 border border-white/10 grid place-items-center text-g-word font-bold mb-3 tracking-wide">{fmt(num)}</div>
        <div className="grid grid-cols-3 gap-2">{keys.map((k) => <button key={k} onClick={() => press(k)} className="h-12 rounded-xl2 border border-white/10 bg-white/[0.04] text-g-word font-bold hover:border-g-gold/40 active:scale-95 transition">{k}</button>)}</div>
        <div className="flex gap-2 mt-3">
          <button onClick={() => setNum((n) => n.slice(0, -1))} disabled={!num} className="rounded-xl2 border border-white/15 px-4 text-g-muted hover:text-g-word disabled:opacity-30 transition" aria-label={tr("Delete")}>⌫</button>
          <button onClick={start} disabled={calling} className="btn-bright flex-1 text-sm disabled:opacity-70">{calling ? tr("Calling…") : tr("📞 Start AI call")}</button>
        </div>
        <p className="mt-2.5 text-[10px] text-g-muted">{tr("Demo — this keypad does not dial. In a live account Gui places the call through the protected dialer and logs the outcome.")}</p>
      </Card>
    </div>
    </>
  );
}

export default Dialer;
