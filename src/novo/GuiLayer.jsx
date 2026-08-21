import { lazy, Suspense, useMemo, useState } from "react";
import VoiceAgent from "../components/VoiceAgent.jsx";
import { waLink } from "../data/contact.js";

const GuiChat = lazy(() => import("../components/GuiChat.jsx"));

// ─────────────────────────────────────────────────────────────────────────────
// A CAMADA DE IA DO MOTOR — montada pelo Novo.jsx em TODO site do /novo.
//
// Decisões do Luis (2026-08-21):
//  · A IA usa a MARCA E O MASCOTE DO CLIENTE ("Ask Chigo" é a referência, não o
//    molde) — o dono se vê dono. Crédito da Guileo fica discreto no rodapé.
//  · Chat de TEXTO só no horário comercial: /api/gui-chat gasta Anthropic por
//    visitante curioso, e foi por isso que ele saiu da landing. Fora do horário
//    (e sempre, como alternativa) sobra o que não custa por visita: voz no
//    navegador e a ligação de verdade.
//  · Voz + ligação + formulário entram sempre.
//
// O mascote é desenhado por SITE (SVG passado via prop) — nunca um robozinho
// genérico: ele sai do mundo do negócio (relógio pro plantão 24h, etc).
// ─────────────────────────────────────────────────────────────────────────────

// Horário comercial no fuso de NY — o portão do chat de texto.
function isBusinessHours() {
  try {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false, weekday: "short" }).formatToParts(new Date());
    const h = Number(p.find((x) => x.type === "hour")?.value);
    const d = p.find((x) => x.type === "weekday")?.value;
    return !["Sat", "Sun"].includes(d) && h >= 9 && h < 18;
  } catch { return false; }
}

export default function GuiLayer({ business = "this business", mascot = null, accent = "#3E9468", label = "Ask us" }) {
  const [openChat, setOpenChat] = useState(false);
  const [openPicker, setOpenPicker] = useState(false);
  const [sel, setSel] = useState(() => new Set([0, 1]));
  const hours = useMemo(isBusinessHours, []);

  const FEATURES = [
    ["AI answers every call", "24/7, in your name — books, quotes, sells."],
    ["AI calls new leads in 60s", "Form or missed call → it dials back before they cool."],
    ["Missed-call text-back", "Instant SMS the second a call is missed."],
    ["AI booking on this site", "Every form here feeds the AI — it confirms and reminds."],
    ["Review machine", "Asks, collects and answers 5★ reviews automatically."],
    ["Collects on the call", "Closed on the phone? Payment link by SMS right there."],
  ];
  const toggle = (i) => setSel((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const wa = waLink(`Hi Guileo! On the ${business} site I want: ${FEATURES.filter((_, i) => sel.has(i)).map((f) => f[0]).join(", ")}`);

  return (
    <>
      {/* voz no navegador + "a IA te liga" — o que não custa por visitante */}
      <VoiceAgent />

      {/* chat de texto: só no horário comercial (custo por visita) */}
      {hours && openChat && (
        <Suspense fallback={null}><GuiChat /></Suspense>
      )}

      <div className="fixed bottom-4 left-4 z-[95] flex flex-col items-start gap-2 font-sans">
        {openPicker && (
          <div className="w-[300px] rounded-[26px] border border-white/12 bg-[#14161a]/95 p-4 shadow-2xl backdrop-blur-xl">
            <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: accent }}>AI built into this site</p>
            <p className="mt-1 text-[11.5px] leading-snug text-white/55">Tap what {business} should have — each one already runs in production.</p>
            <div className="mt-3 space-y-1.5">
              {FEATURES.map((f, i) => (
                <button key={i} onClick={() => toggle(i)} className={`flex w-full items-start gap-2 rounded-2xl border px-3 py-2 text-left transition ${sel.has(i) ? "border-white/25 bg-white/10" : "border-white/8 bg-white/[0.03]"}`}>
                  <span className="min-w-0">
                    <span className="block text-[12px] font-bold leading-tight text-white">{f[0]}</span>
                    <span className="block text-[10.5px] leading-snug text-white/50">{f[1]}</span>
                  </span>
                  <span className="ml-auto mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] text-white" style={sel.has(i) ? { background: accent, borderColor: accent } : { borderColor: "rgba(255,255,255,.25)", color: "transparent" }}>✓</span>
                </button>
              ))}
            </div>
            <a href={wa} target="_blank" rel="noreferrer" className="mt-3 block rounded-full px-3 py-2.5 text-center text-[12.5px] font-black text-white" style={{ background: accent }}>I want these on my site →</a>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* o mascote DO NEGÓCIO — a IA com a cara dele */}
          <button
            onClick={() => (hours ? setOpenChat((v) => !v) : setOpenPicker((v) => !v))}
            className="group flex items-center gap-2.5 rounded-full border border-white/15 bg-[#14161a]/95 py-2 pl-2 pr-4 shadow-xl backdrop-blur-xl transition hover:scale-[1.03]">
            <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: accent + "22", border: `1px solid ${accent}55` }}>
              {mascot || <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />}
            </span>
            <span className="text-left leading-tight">
              <span className="block text-[12.5px] font-black text-white">{label}</span>
              <span className="block text-[10px] text-white/50">{hours ? "chat · voice · call" : "voice · call · 24/7"}</span>
            </span>
          </button>
          <button onClick={() => setOpenPicker((v) => !v)} title="AI on this site"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-[#14161a]/95 text-white/70 shadow-xl backdrop-blur-xl transition hover:scale-[1.05] hover:text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
      </div>
    </>
  );
}
