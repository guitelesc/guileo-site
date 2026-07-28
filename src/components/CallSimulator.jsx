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
    honest: "Gui's real neural voice — pick Victoria or Bruno above. A live phone call is even fuller:",
    honestCta: "ask for the real call ↓",
    caller: "Customer", gui: "Gui", sound: "Voice", muted: "Voice off — captions only",
  },
  pt: {
    eyebrow: "Teste em 20 segundos", h2: "Ouça como a Gui atende — sem dar seu telefone",
    sub: "Escolha seu tipo de negócio e veja uma conversa fluir: atendida, agendada, com upsell.",
    play: "▶ Tocar a ligação", replay: "↻ Tocar de novo", playing: "Na linha…",
    honest: "A voz neural real da Gui — escolha Victoria ou Bruno acima. A ligação ao vivo é ainda mais completa:",
    honestCta: "peça a ligação de verdade ↓",
    caller: "Cliente", gui: "Gui", sound: "Voz", muted: "Voz desligada — só legendas",
  },
  es: {
    eyebrow: "Pruébalo en 20 segundos", h2: "Escucha cómo contesta Gui — sin dar tu teléfono",
    sub: "Elige tu tipo de negocio y mira fluir una conversación: contestada, agendada, con upsell.",
    play: "▶ Reproducir la llamada", replay: "↻ Reproducir de nuevo", playing: "En la línea…",
    honest: "La voz neural real de Gui — elige Victoria o Bruno arriba. La llamada en vivo es aún más completa:",
    honestCta: "pide la llamada de verdad ↓",
    caller: "Cliente", gui: "Gui", sound: "Voz", muted: "Voz apagada — solo subtítulos",
  },
  hi: {
    eyebrow: "20 सेकंड में आज़माएँ", h2: "सुनिए Gui कैसे जवाब देती है — फ़ोन नंबर दिए बिना",
    sub: "अपना व्यवसाय चुनें और एक असली बातचीत बहती देखें: जवाब, बुकिंग, अपसेल।",
    play: "▶ कॉल चलाएँ", replay: "↻ फिर से चलाएँ", playing: "लाइन पर…",
    honest: "Gui की असली न्यूरल आवाज़ — ऊपर Victoria या Bruno चुनें। लाइव फ़ोन कॉल और भी बेहतर है:",
    honestCta: "असली कॉल माँगें ↓",
    caller: "ग्राहक", gui: "Gui", sound: "आवाज़", muted: "आवाज़ बंद — केवल कैप्शन",
  },
};
const SPEECH_LANG = { en: "en-US", pt: "pt-BR", es: "es-ES", hi: "hi-IN" };

// EMOTIONAL INTELLIGENCE — Gui reads the caller's mood and adapts her tone. This is a REAL product
// capability (call-sentiment / Guileo Pulse); here it's shown live so the visitor SEES the "super
// real" part: the customer arrives tense/rushed/unsure and leaves satisfied. Each mood carries a
// satisfaction score (drives the meter), a voice prosody (rate/pitch so Gui literally sounds calmer
// or warmer), and Gui's tactic. Labels in all 4 UI languages.
const MOODS = {
  casual:    { emoji: "🙂", sat: 55, rate: 1.05, pitch: 1.06, label: { en: "relaxed",   pt: "tranquilo",  es: "relajado",   hi: "आराम से" },   tactic: { en: "light & quick",       pt: "leve e ágil",        es: "ligera y ágil",       hi: "हल्की और तेज़" } },
  happy:     { emoji: "😄", sat: 92, rate: 1.06, pitch: 1.09, label: { en: "happy",     pt: "feliz",      es: "feliz",      hi: "खुश" },       tactic: { en: "warm & upbeat",       pt: "calorosa e animada", es: "cálida y animada",    hi: "गर्मजोशी" } },
  anxious:   { emoji: "😟", sat: 30, rate: 0.98, pitch: 1.0,  label: { en: "anxious",   pt: "nervoso",    es: "nervioso",   hi: "घबराया" },    tactic: { en: "calm & reassuring",   pt: "calma e acolhedora", es: "calma y tranquila",   hi: "शांत, भरोसेमंद" } },
  reassured: { emoji: "😌", sat: 88, rate: 1.0,  pitch: 1.04, label: { en: "reassured", pt: "tranquilo",  es: "tranquilo",  hi: "आश्वस्त" },   tactic: { en: "steady & kind",       pt: "firme e gentil",     es: "firme y amable",      hi: "स्थिर, दयालु" } },
  hopeful:   { emoji: "🙂", sat: 60, rate: 1.04, pitch: 1.06, label: { en: "hopeful",   pt: "esperançoso",es: "esperanzado",hi: "आशान्वित" },  tactic: { en: "friendly & clear",    pt: "simpática e clara",  es: "amable y clara",      hi: "मिलनसार, स्पष्ट" } },
  delighted: { emoji: "🤩", sat: 95, rate: 1.06, pitch: 1.1,  label: { en: "delighted", pt: "encantado",  es: "encantado",  hi: "प्रसन्न" },   tactic: { en: "bright & caring",     pt: "radiante e atenciosa",es: "radiante y atenta",  hi: "उज्ज्वल, ध्यानपूर्ण" } },
  panicked:  { emoji: "😰", sat: 15, rate: 0.96, pitch: 0.98, label: { en: "in a panic",pt: "desesperado",es: "en pánico",  hi: "घबराहट में" },tactic: { en: "calm, straight to it",pt: "calma, direto ao ponto",es: "calma, al grano",  hi: "शांत, सीधे मुद्दे पर" } },
  relieved:  { emoji: "😮‍💨",sat: 90, rate: 1.0,  pitch: 1.03, label: { en: "relieved",  pt: "aliviado",   es: "aliviado",   hi: "राहत में" },  tactic: { en: "steady & warm",       pt: "firme e calorosa",   es: "firme y cálida",      hi: "स्थिर, गर्म" } },
  curious:   { emoji: "🤔", sat: 58, rate: 1.03, pitch: 1.05, label: { en: "curious",   pt: "curioso",    es: "curioso",    hi: "जिज्ञासु" },  tactic: { en: "helpful & precise",   pt: "prestativa e precisa",es: "servicial y precisa",hi: "मददगार, सटीक" } },
  confident: { emoji: "😎", sat: 90, rate: 1.04, pitch: 1.06, label: { en: "confident", pt: "confiante",  es: "seguro",     hi: "आश्वस्त" },   tactic: { en: "assured & smooth",    pt: "segura e fluida",    es: "segura y fluida",     hi: "आत्मविश्वासी" } },
  hesitant:  { emoji: "😅", sat: 45, rate: 1.0,  pitch: 1.03, label: { en: "hesitant",  pt: "hesitante",  es: "dudoso",     hi: "झिझकता" },    tactic: { en: "encouraging & easy",  pt: "encorajadora e leve",es: "alentadora y fácil",  hi: "प्रोत्साहित करती" } },
  motivated: { emoji: "🔥", sat: 88, rate: 1.06, pitch: 1.08, label: { en: "motivated", pt: "motivado",   es: "motivado",   hi: "प्रेरित" },   tactic: { en: "energizing & warm",   pt: "energética e calorosa",es: "energética y cálida",hi: "ऊर्जावान, गर्म" } },
};
const EMO = {
  en: { intel: "Gui reads the mood and adapts her tone — live", sat: "Satisfaction", reads: "Gui senses", adapts: "→ tone", arrives: "arrives", leaves: "leaves happy" },
  pt: { intel: "A Gui sente o clima e ajusta o tom — ao vivo", sat: "Satisfação", reads: "Gui percebe", adapts: "→ tom", arrives: "chega", leaves: "sai satisfeito" },
  es: { intel: "Gui percibe el ánimo y ajusta su tono — en vivo", sat: "Satisfacción", reads: "Gui percibe", adapts: "→ tono", arrives: "llega", leaves: "sale feliz" },
  hi: { intel: "Gui मूड भाँपकर अपना लहजा बदलती है — लाइव", sat: "संतुष्टि", reads: "Gui भाँपती है", adapts: "→ लहजा", arrives: "आता है", leaves: "खुश जाता है" },
};

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
  const [voiceKey, setVoiceKey] = useState("victoria"); // REAL Gui voice pick: victoria (♀) | bruno (♂)
  const audioRef = useRef(null);                // the currently-playing real-voice <audio>
  const urlRef = useRef(null);                  // its object URL, so stopAll can revoke it (no leak)
  const runRef = useRef(0);                     // token: invalidates timers on switch/replay
  const timersRef = useRef([]);

  const vert = SIM_VERTICALS.find((v) => v.key === vKey) || SIM_VERTICALS[0];
  const lines = vert.lines[simLang] || vert.lines.en;
  const E = EMO[uiLang];
  // the caller's emotional arc for this vertical: arrives as mood[0], leaves as mood[1].
  const startMood = MOODS[vert.mood?.[0]] || MOODS.curious;
  const endMood = MOODS[vert.mood?.[1]] || MOODS.happy;
  // current caller mood: start until the LAST line lands (Gui has resolved it) → end mood.
  const curMood = shown >= lines.length ? endMood : startMood;
  const [sat, setSat] = useState(startMood.sat); // animated satisfaction meter (0–100)
  const bestVoiceRef = useRef(null);

  const stopAll = () => {
    runRef.current += 1;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (canSpeak) { try { window.speechSynthesis.cancel(); } catch { /* */ } }
    if (audioRef.current) { try { audioRef.current.pause(); audioRef.current.src = ""; } catch { /* */ } audioRef.current = null; }
    if (urlRef.current) { try { URL.revokeObjectURL(urlRef.current); } catch { /* */ } urlRef.current = null; }
  };

  // REAL Gui voice — fetch the ElevenLabs clip for this line and play it. Returns false if the real
  // voice isn't available (no key / error) so the caller can fall back to the browser voice.
  const playReal = async (text, token) => {
    try {
      const r = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice: voiceKey, lang: simLang }) });
      if (!r.ok) return false;
      const url = URL.createObjectURL(await r.blob());
      if (runRef.current !== token) { URL.revokeObjectURL(url); return true; } // superseded → don't play
      if (audioRef.current) { try { audioRef.current.pause(); } catch { /* */ } }
      if (urlRef.current) { try { URL.revokeObjectURL(urlRef.current); } catch { /* */ } }
      const a = new Audio(url); audioRef.current = a; urlRef.current = url;
      a.onended = () => { URL.revokeObjectURL(url); if (urlRef.current === url) urlRef.current = null; };
      await a.play().catch(() => {});
      return true;
    } catch { return false; }
  };
  useEffect(() => stopAll, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pick the most natural voice the OS offers for this language — the default is what sounds robotic.
  // Prefer neural/enhanced/premium engines (macOS "Siri"/"…(Enhanced)", Google, Microsoft Natural),
  // and a female timbre (Gui is "she"), so the demo sounds as human as the browser allows.
  const pickVoice = (langCode) => {
    const two = langCode.slice(0, 2).toLowerCase();
    const voices = (window.speechSynthesis.getVoices() || []).filter((v) => v.lang && v.lang.toLowerCase().startsWith(two));
    if (!voices.length) return null;
    const score = (v) => {
      const n = (v.name || "").toLowerCase();
      let s = 0;
      if (/(enhanced|premium|neural|natural)/.test(n)) s += 6;
      if (/(google|siri)/.test(n)) s += 4;
      if (/(microsoft).*(online|natural)/.test(n)) s += 4;
      if (/(samantha|luciana|paulina|mónica|monica|helena|joana|female|amelie|amélie|fiona|serena|ava|zira|isabela)/.test(n)) s += 3;
      if (v.lang.toLowerCase() === langCode.toLowerCase()) s += 2; // exact locale (pt-BR over pt-PT)
      if (v.localService) s += 1;
      return s;
    };
    return voices.slice().sort((a, b) => score(b) - score(a))[0] || voices[0];
  };

  const speak = (text, mood) => {
    if (!canSpeak || !voiceOn) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = SPEECH_LANG[simLang] || "en-US";
      // prosody follows the CALLER's mood → Gui literally sounds calmer for a panicked caller,
      // brighter for a happy one. This is the audible half of "she adapts to the mood".
      const m = mood || startMood;
      u.rate = m.rate; u.pitch = m.pitch;
      if (!bestVoiceRef.current) bestVoiceRef.current = pickVoice(u.lang);
      if (bestVoiceRef.current) u.voice = bestVoiceRef.current;
      window.speechSynthesis.speak(u);
    } catch { /* voicing is optional — captions carry the demo */ }
  };

  const play = () => {
    stopAll();
    const token = runRef.current;
    setShown(0); setPlaying(true); setSat(startMood.sat);
    const span = endMood.sat - startMood.sat;
    let t = 350;
    lines.forEach((ln, i) => {
      timersRef.current.push(setTimeout(() => {
        if (runRef.current !== token) return;
        setShown(i + 1);
        // satisfaction climbs as Gui handles the call: start mood → end mood across the exchange.
        setSat(Math.round(startMood.sat + span * (i / Math.max(1, lines.length - 1))));
        // Gui adapts her tone to the caller's mood — calmer early (tense), warmer as they relax.
        // Prefer the REAL neural voice (/api/tts); fall back to the browser voice if it's unavailable.
        if (ln.who === "gui" && voiceOn) {
          const m = i >= lines.length - 2 ? endMood : startMood;
          playReal(ln.text, token).then((ok) => { if (!ok && runRef.current === token) speak(ln.text, m); });
        }
        if (i === lines.length - 1) {
          timersRef.current.push(setTimeout(() => { if (runRef.current === token) setPlaying(false); }, 2600));
        }
      }, t));
      // pacing: reading/speaking time proportional to line length (~15–20s total)
      t += Math.min(5200, 1100 + ln.text.length * (ln.who === "gui" ? 52 : 34));
    });
  };

  const pick = (k) => { stopAll(); setVKey(k); setShown(0); setPlaying(false); bestVoiceRef.current = null; const nv = SIM_VERTICALS.find((v) => v.key === k); setSat((MOODS[nv?.mood?.[0]] || MOODS.curious).sat); };

  return (
    <section id="simulator" className="relative px-5 py-16">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(560px_300px_at_50%_10%,rgba(255,138,51,0.06),transparent)]" />
      <Reveal className="mx-auto max-w-2xl text-center mb-8">
        <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{L.eyebrow}</div>
        <h2 className="mt-4 font-black leading-[0.98] tracking-tight" style={{ fontSize: "clamp(2rem,4.4vw,3.2rem)" }}>
          <span className="bg-gradient-to-r from-g-word via-g-gold to-g-word bg-[length:220%_auto] bg-clip-text text-transparent animate-shimmer">{L.h2}</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-g-ink">{L.sub}</p>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-g-gold/30 bg-g-gold/[0.08] px-3 py-1.5 text-[12px] font-bold text-g-gold">
          <span aria-hidden>🫶</span> {E.intel}
        </div>
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
            {/* REAL voice picker — pick a voice and it plays the actual neural Gui (ElevenLabs). */}
            <div className="shrink-0 flex items-center gap-0.5 rounded-full border border-white/15 bg-white/[0.04] p-0.5" role="group" aria-label={L.sound}>
              {[{ k: "victoria", g: "♀", n: "Victoria" }, { k: "bruno", g: "♂", n: "Bruno" }].map((v) => {
                const on = voiceOn && voiceKey === v.k;
                return (
                  <button key={v.k} onClick={() => { setVoiceKey(v.k); setVoiceOn(true); }} aria-pressed={on} title={v.n}
                    className={`rounded-full px-2.5 py-1.5 text-[11px] font-bold transition ${on ? "text-black" : "text-g-muted hover:text-g-word"}`}
                    style={on ? { background: "linear-gradient(180deg,#ff9d4d,#ff8a33)" } : undefined}>
                    {v.g}<span className="hidden sm:inline"> {v.n}</span>
                  </button>
                );
              })}
              <button onClick={() => setVoiceOn(false)} aria-pressed={!voiceOn} title={L.muted}
                className={`rounded-full px-2 py-1.5 text-[11px] font-bold transition ${!voiceOn ? "text-g-word" : "text-g-muted hover:text-g-word"}`}>🔇</button>
            </div>
          </div>

          {/* EMOTION + SATISFACTION strip — Gui reads the caller's mood and the meter climbs as she
              handles the call. The audible half (tone) rides the same mood via speak(). */}
          <div className="border-b border-white/10 px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 min-w-0">
                <span className="text-[18px] leading-none" aria-hidden>{curMood.emoji}</span>
                <span className="truncate text-[11.5px] font-bold text-g-word">
                  {E.reads} <span style={{ color: "#FF8A33" }}>{curMood.label[uiLang] || curMood.label.en}</span>
                  <span className="text-g-muted"> · {E.adapts} {curMood.tactic[uiLang] || curMood.tactic.en}</span>
                </span>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[9px] font-bold uppercase tracking-wide text-g-muted">{E.sat}</div>
                <div className="text-[13px] font-black tabular-nums" style={{ color: sat >= 80 ? "#3E9468" : sat >= 50 ? "#FF8A33" : "#e0855f" }}>{sat}%</div>
              </div>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${sat}%`, background: sat >= 80 ? "linear-gradient(90deg,#3E9468,#57c98a)" : sat >= 50 ? "linear-gradient(90deg,#FF8A33,#ffb168)" : "linear-gradient(90deg,#e0855f,#f0a884)" }} />
            </div>
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
