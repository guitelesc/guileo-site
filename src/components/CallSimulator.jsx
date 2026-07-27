import { useEffect, useRef, useState } from "react";
import mark from "../assets/guileo-mark.png";
import { useLang } from "../i18n.jsx";
import { SIM_VERTICALS } from "../data/simulatorScripts.js";
import { Reveal } from "../lib/ui.jsx";

// CALL SIMULATOR — hear how Gui answers, without giving your phone number.
// Pick a business type → a phone-style card plays a ~15–20s SCRIPTED exchange as animated
// caption lines, with Gui's replies voiced via speechSynthesis when available (captions make
// it work muted too). HONESTY: clearly labeled a simulation; the real-voice CTA points to #try.

const CS_COPY = {
  en: {
    eyebrow: "Try it in 20 seconds", h2: "Hear how Gui answers — no phone needed",
    sub: "Pick your business type and watch a real conversation flow: answered, booked, upsold.",
    play: "▶ Play the call", replay: "↻ Play again", playing: "On the line…",
    honest: "Simulation with a synthetic browser voice — Gui's real voice is even better:",
    honestCta: "ask for the real call ↓",
    caller: "Customer", gui: "Gui", sound: "Voice", muted: "Voice off — captions only",
  },
  pt: {
    eyebrow: "Teste em 20 segundos", h2: "Ouça como a Gui atende — sem dar seu telefone",
    sub: "Escolha seu tipo de negócio e veja uma conversa fluir: atendida, agendada, com upsell.",
    play: "▶ Tocar a ligação", replay: "↻ Tocar de novo", playing: "Na linha…",
    honest: "Simulação com voz sintética do navegador — a voz real da Gui é ainda melhor:",
    honestCta: "peça a ligação de verdade ↓",
    caller: "Cliente", gui: "Gui", sound: "Voz", muted: "Voz desligada — só legendas",
  },
  es: {
    eyebrow: "Pruébalo en 20 segundos", h2: "Escucha cómo contesta Gui — sin dar tu teléfono",
    sub: "Elige tu tipo de negocio y mira fluir una conversación: contestada, agendada, con upsell.",
    play: "▶ Reproducir la llamada", replay: "↻ Reproducir de nuevo", playing: "En la línea…",
    honest: "Simulación con voz sintética del navegador — la voz real de Gui es aún mejor:",
    honestCta: "pide la llamada de verdad ↓",
    caller: "Cliente", gui: "Gui", sound: "Voz", muted: "Voz apagada — solo subtítulos",
  },
  hi: {
    eyebrow: "20 सेकंड में आज़माएँ", h2: "सुनिए Gui कैसे जवाब देती है — फ़ोन नंबर दिए बिना",
    sub: "अपना व्यवसाय चुनें और एक असली बातचीत बहती देखें: जवाब, बुकिंग, अपसेल।",
    play: "▶ कॉल चलाएँ", replay: "↻ फिर से चलाएँ", playing: "लाइन पर…",
    honest: "ब्राउज़र की सिंथेटिक आवाज़ वाली सिमुलेशन — Gui की असली आवाज़ इससे भी बेहतर है:",
    honestCta: "असली कॉल माँगें ↓",
    caller: "ग्राहक", gui: "Gui", sound: "आवाज़", muted: "आवाज़ बंद — केवल कैप्शन",
  },
};
const SPEECH_LANG = { en: "en-US", pt: "pt-BR", es: "es-ES", hi: "hi-IN" };

export default function CallSimulator() {
  const { lang } = useLang();
  const uiLang = CS_COPY[lang] ? lang : "en"; // UI copy: all 4 languages
  const L = CS_COPY[uiLang];
  // scripts (data/simulatorScripts.js) exist in en/pt/es only — HI visitors get Hindi UI + EN scripts,
  // and the speech voice must match the SCRIPT language, not the UI language.
  // scripts exist only in en/pt/es → gate on SCRIPT availability, NOT voice. HI gets EN script + EN voice
  // (matched), never a Hindi voice reading English text.
  const simLang = ["pt", "es"].includes(lang) ? lang : "en";
  const [vKey, setVKey] = useState(SIM_VERTICALS[0].key);
  const [shown, setShown] = useState(0);        // how many lines are revealed
  const [playing, setPlaying] = useState(false);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  const [voiceOn, setVoiceOn] = useState(true);
  const runRef = useRef(0);                     // token: invalidates timers on switch/replay
  const timersRef = useRef([]);

  const vert = SIM_VERTICALS.find((v) => v.key === vKey) || SIM_VERTICALS[0];
  const lines = vert.lines[simLang] || vert.lines.en;

  const stopAll = () => {
    runRef.current += 1;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (canSpeak) { try { window.speechSynthesis.cancel(); } catch { /* */ } }
  };
  useEffect(() => stopAll, []); // eslint-disable-line react-hooks/exhaustive-deps

  const speak = (text) => {
    if (!canSpeak || !voiceOn) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = SPEECH_LANG[simLang] || "en-US";
      u.rate = 1.04; u.pitch = 1.05;
      const voices = window.speechSynthesis.getVoices() || [];
      const match = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(u.lang.slice(0, 2)));
      if (match) u.voice = match;
      window.speechSynthesis.speak(u);
    } catch { /* voicing is optional — captions carry the demo */ }
  };

  const play = () => {
    stopAll();
    const token = runRef.current;
    setShown(0); setPlaying(true);
    let t = 350;
    lines.forEach((ln, i) => {
      timersRef.current.push(setTimeout(() => {
        if (runRef.current !== token) return;
        setShown(i + 1);
        if (ln.who === "gui") speak(ln.text);
        if (i === lines.length - 1) {
          // let the last (spoken) line breathe before flipping back to "replay"
          timersRef.current.push(setTimeout(() => { if (runRef.current === token) setPlaying(false); }, 2600));
        }
      }, t));
      // pacing: reading/speaking time proportional to line length (~15–20s total)
      t += Math.min(5200, 1100 + ln.text.length * (ln.who === "gui" ? 52 : 34));
    });
  };

  const pick = (k) => { stopAll(); setVKey(k); setShown(0); setPlaying(false); };

  return (
    <section id="simulator" className="relative px-5 py-16">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(560px_300px_at_50%_10%,rgba(255,138,51,0.06),transparent)]" />
      <Reveal className="mx-auto max-w-2xl text-center mb-8">
        <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{L.eyebrow}</div>
        <h2 className="mt-4 font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)" }}>
          <span className="bg-gradient-to-r from-g-word via-g-gold to-g-word bg-[length:220%_auto] bg-clip-text text-transparent animate-shimmer">{L.h2}</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-g-ink">{L.sub}</p>
      </Reveal>

      <div className="mx-auto max-w-xl">
        {/* business-type chips */}
        <div className="flex flex-wrap justify-center gap-2 mb-5">
          {SIM_VERTICALS.map((v) => {
            const on = v.key === vKey;
            return (
              <button key={v.key} onClick={() => pick(v.key)} aria-pressed={on}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-bold transition ${on ? "border-transparent text-[#1a1a1a]" : "border-white/15 bg-white/[0.04] text-g-word hover:border-g-gold/40"}`}
                style={on ? { background: "linear-gradient(180deg,#ff9d4d,#ff8a33 60%,#f2731a)", boxShadow: "0 10px 26px -10px rgba(255,138,51,0.6)" } : undefined}>
                <span>{v.icon}</span> {v.label[simLang] || v.label.en}
              </button>
            );
          })}
        </div>

        {/* phone-ish card */}
        <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.03] backdrop-blur-xl shadow-[0_36px_80px_-30px_rgba(0,0,0,0.85)]">
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/[0.08] to-transparent" />
          {/* call header */}
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3.5">
            <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-white/15 bg-white/[0.06]"><img src={mark} alt="Gui" className="h-6 w-6 object-contain" /></div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold text-g-word leading-tight">{L.gui} · {vert.label[simLang] || vert.label.en}</div>
              <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: "#FF8A33" }}>
                <span className={`inline-flex h-1.5 w-1.5 rounded-full ${playing ? "animate-ping" : ""}`} style={{ background: "#FF8A33" }} />
                {playing ? L.playing : "24/7"}
              </div>
            </div>
            {canSpeak && (
              <button onClick={() => setVoiceOn((s) => !s)} title={voiceOn ? L.sound : L.muted}
                aria-label={voiceOn ? L.sound : L.muted} aria-pressed={voiceOn}
                className={`shrink-0 rounded-full border px-3 py-2 text-[11px] font-bold transition ${voiceOn ? "border-g-gold/40 bg-g-gold/10 text-g-gold" : "border-white/15 bg-white/[0.04] text-g-muted"}`}>
                {voiceOn ? `🔊 ${L.sound}` : "🔇"}
              </button>
            )}
          </div>

          {/* transcript — aria-live so screen readers follow the scripted lines as they appear */}
          <div role="log" aria-live="polite" className="grid gap-2.5 px-5 py-5 min-h-[260px]">
            {shown === 0 && !playing && (
              <div className="grid place-items-center py-14 text-4xl opacity-60">{vert.icon}</div>
            )}
            {lines.slice(0, shown).map((ln, i) => (
              <div key={vKey + simLang + i} className={`flex ${ln.who === "gui" ? "justify-end" : "justify-start"}`} style={{ animation: "csline .35s ease-out both" }}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed ${ln.who === "gui" ? "rounded-br-md text-g-word" : "rounded-bl-md bg-white/[0.06] text-g-ink"}`}
                  style={ln.who === "gui" ? { background: "rgba(255,138,51,0.12)", border: "1px solid rgba(255,138,51,0.28)" } : { border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className={`mb-0.5 text-[10px] font-black uppercase tracking-wide ${ln.who === "gui" ? "" : "text-g-muted"}`} style={ln.who === "gui" ? { color: "#FF8A33" } : undefined}>{ln.who === "gui" ? L.gui : L.caller}</div>
                  {ln.text}
                </div>
              </div>
            ))}
            <style>{`@keyframes csline{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@media (prefers-reduced-motion: reduce){[style*="csline"]{animation:none !important}}`}</style>
          </div>

          {/* controls */}
          <div className="border-t border-white/10 px-5 py-4 text-center">
            <button onClick={play} disabled={playing}
              className="btn-bright text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ boxShadow: "0 0 26px -6px rgba(255,138,51,0.45)" }}>
              {playing ? L.playing : shown > 0 ? L.replay : L.play}
            </button>
            {/* HONESTY — this is a simulation; the real voice is one scroll away */}
            <p className="mt-3 text-[11px] leading-snug text-g-muted">
              {L.honest}{" "}
              <a href="#try" onClick={(e) => { e.preventDefault(); document.getElementById("try")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
                className="font-bold underline decoration-dotted underline-offset-2" style={{ color: "#FF8A33" }}>{L.honestCta}</a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
