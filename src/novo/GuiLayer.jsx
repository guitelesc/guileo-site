import { useState } from "react";
import VoiceAgent from "../components/VoiceAgent.jsx";
import { waLink } from "../data/contact.js";

// ─────────────────────────────────────────────────────────────────────────────
// A CAMADA GUI DO MOTOR — montada pelo Novo.jsx em TODO site do /novo.
// Dois pedaços: (1) o convite de voz/ligação REAL (VoiceAgent — voz no navegador
// + "a Gui te liga", já com TCPA), e (2) o seletor "AI on this site": o cardápio
// de IAs embutidas que o cliente marca na reunião — vira o pedido dele.
// Decisão Luis 2026-08-21: modelo já vem com a IA dentro; o cliente escolhe.
// ─────────────────────────────────────────────────────────────────────────────

const FEATURES = [
  ["📞", "AI answers every call", "24/7, in the business's name — books, quotes, sells."],
  ["⚡", "AI calls new leads in 60s", "Form or missed call → the AI dials back before they cool."],
  ["💬", "Missed-call text-back", "Instant SMS the second a call is missed."],
  ["📅", "AI booking on the site", "This site's forms feed the AI — it confirms and reminds."],
  ["⭐", "Review machine", "Asks, collects and answers 5★ reviews automatically."],
  ["🧾", "Collects on the call", "Closed on the phone? Payment link by SMS right there."],
];

export default function GuiLayer({ business = "this business" }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(() => new Set([0, 1]));
  const toggle = (i) => setSel((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const chosen = FEATURES.filter((_, i) => sel.has(i)).map((f) => f[1]).join(", ");
  const wa = waLink(`Hi Guileo! On the ${business} model I want: ${chosen}`);

  return (
    <>
      {/* o convite real de voz/ligação — a prova viva dentro do modelo */}
      <VoiceAgent />

      {/* seletor "AI on this site" — canto inferior ESQUERDO pra não brigar com o VoiceAgent */}
      <div className="fixed bottom-4 left-4 z-[95] font-sans">
        {open && (
          <div className="mb-2 w-[300px] rounded-2xl border border-white/12 bg-[#141310]/95 p-4 shadow-2xl backdrop-blur-xl">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#D6C29A]">AI built into this site</p>
            <p className="mt-1 text-[11.5px] leading-snug text-[#948C7B]">Tap what {business} should have — every item is already built and running at Guileo.</p>
            <div className="mt-3 space-y-1.5">
              {FEATURES.map((f, i) => (
                <button key={i} onClick={() => toggle(i)} className={`flex w-full items-start gap-2 rounded-xl border px-2.5 py-2 text-left transition ${sel.has(i) ? "border-[#3E9468]/60 bg-[#3E9468]/10" : "border-white/8 bg-white/[0.03]"}`}>
                  <span className="text-[13px]">{f[0]}</span>
                  <span className="min-w-0">
                    <span className="block text-[12px] font-bold leading-tight text-[#EDE7DC]">{f[1]}</span>
                    <span className="block text-[10.5px] leading-snug text-[#948C7B]">{f[2]}</span>
                  </span>
                  <span className={`ml-auto mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${sel.has(i) ? "border-[#3E9468] bg-[#3E9468] text-white" : "border-white/20 text-transparent"}`}>✓</span>
                </button>
              ))}
            </div>
            <a href={wa} target="_blank" rel="noreferrer" className="mt-3 block rounded-xl bg-[#3E9468] px-3 py-2.5 text-center text-[12.5px] font-black text-white">I want these on my site →</a>
          </div>
        )}
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-full border border-[#D6C29A]/30 bg-[#141310]/95 px-4 py-2.5 text-[12px] font-black text-[#EDE7DC] shadow-xl backdrop-blur-xl">
          <span className="relative flex h-2 w-2"><span className="absolute h-full w-full animate-ping rounded-full bg-[#3E9468]/60" /><span className="relative h-2 w-2 rounded-full bg-[#3E9468]" /></span>
          {open ? "Close" : "AI on this site"}
        </button>
      </div>
    </>
  );
}
