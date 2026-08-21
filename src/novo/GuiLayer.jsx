import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import VoiceAgent from "../components/VoiceAgent.jsx";
import { waLink } from "../data/contact.js";

const GuiChat = lazy(() => import("../components/GuiChat.jsx"));

// ─────────────────────────────────────────────────────────────────────────────
// A CAMADA DE IA DO MOTOR — montada pelo Novo.jsx em TODO site do /novo.
//
// Decisões do Luis (2026-08-21):
//  · A IA usa a MARCA E O MASCOTE DO CLIENTE — o dono se vê dono.
//  · Chat de TEXTO só no horário comercial de NY (/api/gui-chat gasta Anthropic
//    por visitante curioso). Voz + ligação + formulários: sempre.
//
// ⚠️ LAYOUT (corrigido 2026-08-21 depois do Luis ver no Chrome dele): o convite
// ficava no canto ESQUERDO e cobria o botão do telefone da hero — o CTA mais
// importante do site. Agora tudo mora numa coluna só, no canto direito, EMPILHADO
// acima do VoiceAgent, e só aparece depois que a pessoa rola além da hero: enquanto
// o CTA grande está na tela, nada compete com ele.
// ─────────────────────────────────────────────────────────────────────────────

function isBusinessHours() {
  try {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false, weekday: "short" }).formatToParts(new Date());
    const h = Number(p.find((x) => x.type === "hour")?.value);
    const d = p.find((x) => x.type === "weekday")?.value;
    return !["Sat", "Sun"].includes(d) && h >= 9 && h < 18;
  } catch { return false; }
}

export default function GuiLayer({ business = "this business", mascot = null, accent = "#3E9468", label = "Ask us" }) {
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState(false);
  const [past, setPast] = useState(false);
  const [sel, setSel] = useState(() => new Set([0, 1]));
  const hours = useMemo(isBusinessHours, []);

  // some enquanto a hero (e o CTA grande) está visível
  useEffect(() => {
    const onScroll = () => setPast(window.scrollY > 560);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      <VoiceAgent />
      {hours && chat && <Suspense fallback={null}><GuiChat /></Suspense>}

      <div
        className="fixed right-4 z-40 flex flex-col items-end gap-2 font-sans sm:right-6"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)",
          opacity: past ? 1 : 0,
          transform: past ? "none" : "translateY(12px)",
          pointerEvents: past ? "auto" : "none",
          transition: "opacity .35s ease, transform .35s ease",
        }}
      >
        {open && (
          <div className="w-[min(88vw,310px)] rounded-[26px] border border-white/12 bg-[#14161a]/95 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: accent }}>AI built into this site</p>
              <button onClick={() => setOpen(false)} aria-label="Close" className="-mt-1 grid h-6 w-6 place-items-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white">✕</button>
            </div>
            <p className="mt-1 text-[11.5px] leading-snug text-white/55">Tap what {business} should have — each one already runs in production.</p>
            <div className="mt-3 space-y-1.5">
              {FEATURES.map((f, i) => (
                <button key={i} onClick={() => toggle(i)} className={`flex w-full items-start gap-2 rounded-2xl border px-3 py-2 text-left transition ${sel.has(i) ? "border-white/25 bg-white/10" : "border-white/8 bg-white/[0.03] hover:border-white/15"}`}>
                  <span className="min-w-0">
                    <span className="block text-[12px] font-bold leading-tight text-white">{f[0]}</span>
                    <span className="block text-[10.5px] leading-snug text-white/50">{f[1]}</span>
                  </span>
                  <span className="ml-auto mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] text-white" style={sel.has(i) ? { background: accent, borderColor: accent } : { borderColor: "rgba(255,255,255,.25)", color: "transparent" }}>✓</span>
                </button>
              ))}
            </div>
            {hours && (
              <button onClick={() => { setChat((v) => !v); setOpen(false); }}
                className="mt-3 block w-full rounded-full border border-white/15 bg-white/[0.06] px-3 py-2.5 text-center text-[12.5px] font-bold text-white transition hover:bg-white/10">
                💬 Chat with {label.replace(/^Ask /, "")}
              </button>
            )}
            <a href={wa} target="_blank" rel="noreferrer" className="mt-2 block rounded-full px-3 py-2.5 text-center text-[12.5px] font-black text-white transition hover:brightness-110" style={{ background: accent }}>
              I want these on my site →
            </a>
          </div>
        )}

        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-full border border-white/15 bg-[#14161a]/95 py-2 pl-2 pr-4 shadow-xl backdrop-blur-xl transition hover:scale-[1.03]">
          <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: accent + "22", border: `1px solid ${accent}55` }}>
            {mascot || <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />}
          </span>
          <span className="text-left leading-tight">
            <span className="block text-[12.5px] font-black text-white">{label}</span>
            <span className="block text-[10px] text-white/50">{hours ? "chat · voice · call" : "voice · call · 24/7"}</span>
          </span>
        </button>
      </div>
    </>
  );
}
