import { useEffect, useState } from "react";
import logo from "../assets/guileo-mark.png";
import { waLink } from "../data/contact.js";
import { MASTER_SENTENCE, OBJECTION_KILLERS } from "../data/salesKit.js";

// /cola — the partner's POCKET CARD. One mobile screen to open 2 minutes before a
// meeting: THE sentence + objections come from src/data/salesKit.js (same words in
// /deck, /pitch, /roteiro — no drift), the 5 golden questions, the 15-min plan,
// and the tool links. No fluff — this is field equipment.

const objsFor = (lang) => OBJECTION_KILLERS.map((o) => [o.tag[lang], `→ ${o.short[lang]}`]);

const D = {
  pt: {
    title: "Cola de bolso", sub: "Abra 2 min antes da reunião. Respira. Você tá pronto.",
    sentence: MASTER_SENTENCE.pt,
    qH: "🔍 As 5 perguntas (deixa ELE falar)",
    qs: ["Quantas ligações perde por dia?", "Quem responde o WhatsApp à noite?", "E quem pede orçamento e some?", "Quantos clientes ninguém chamou de volta?", "A $50–100 cada… quanto vaza/mês?"],
    oH: "🛡️ As 8 objeções (1 linha cada)",
    objs: objsFor("pt"),
    mH: "📋 Os 15 minutos",
    meet: ["0-3 · perguntas (ele fala)", "3-5 · a frase", "5-9 · ⚡ GUI LIGA (silêncio!)", "9-12 · Cockpit + a dor dele", "12-15 · proposta + garantia"],
    never: "🚫 Nunca: prometer que a IA não erra · resultado exato em $ · menos de 7 dias",
    tools: "🧰 Ferramentas",
  },
  en: {
    title: "Pocket card", sub: "Open 2 min before the meeting. Breathe. You're ready.",
    sentence: MASTER_SENTENCE.en,
    qH: "🔍 The 5 questions (let THEM talk)",
    qs: ["How many calls do you miss per day?", "Who answers WhatsApp at night?", "What about quote-and-ghost people?", "How many customers never got a call back?", "At $50–100 each… how much leaks/mo?"],
    oH: "🛡️ The 8 objections (one line each)",
    objs: objsFor("en"),
    mH: "📋 The 15 minutes",
    meet: ["0-3 · questions (they talk)", "3-5 · the sentence", "5-9 · ⚡ GUI CALLS (silence!)", "9-12 · Cockpit + their pain", "12-15 · proposal + guarantee"],
    never: "🚫 Never: promise the AI never errs · exact $ results · under 7 days",
    tools: "🧰 Tools",
  },
};

export default function Cola() {
  const [lang, setLang] = useState("pt");
  const [copied, setCopied] = useState(false);
  const t = D[lang];
  useEffect(() => { document.title = "Guileo · Cola de bolso"; }, []);
  return (
    <div className="surface-real min-h-screen px-4 py-6 text-g-ink">
      <div className="relative z-10 mx-auto max-w-md space-y-4">
        <header className="flex items-center justify-between">
          <a href="/academia" className="flex items-center gap-2"><img src={logo} alt="" className="h-7 w-7 object-contain" /><span className="text-[13px] font-extrabold text-g-word">{t.title}</span></a>
          <div className="flex gap-1">{[["pt", "🇧🇷"], ["en", "🇺🇸"]].map(([c, f]) => <button key={c} onClick={() => setLang(c)} className={`h-7 w-7 rounded-full text-sm ${lang === c ? "bg-g-green/15 ring-1 ring-g-green/30" : "opacity-50"}`}>{f}</button>)}</div>
        </header>
        <p className="text-[11.5px] italic text-g-muted">{t.sub}</p>

        <blockquote className="rounded-2xl border border-g-green/30 bg-g-green/[0.06] p-4 text-[13px] font-bold leading-relaxed text-g-word">“{t.sentence}”</blockquote>

        {/* Seller Hub + team code — front and center */}
        <div className="rounded-2xl border border-g-gold/35 bg-gradient-to-br from-g-green/[0.10] to-g-gold/[0.06] p-4 text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-g-green">🧰 {lang === "pt" ? "Hub do Vendedor" : "Seller Hub"}</div>
          <p className="mt-1 text-[11px] text-g-ink">{lang === "pt" ? "Nome + email + o código do time:" : "Name + email + the team code:"}</p>
          <button onClick={() => { navigator.clipboard?.writeText("GUILEO-TIME-2026"); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="mt-2 inline-flex items-center gap-2 rounded-lg border border-g-gold/45 bg-g-gold/[0.12] px-3 py-2 font-mono text-[13px] font-black tracking-wider text-g-gold">
            GUILEO-TIME-2026 <span className="text-[11px]">{copied ? "✓" : "📋"}</span>
          </button>
          <a href="/vendedor" className="mt-2 block text-[11.5px] font-black text-g-green underline">{lang === "pt" ? "Abrir o Hub →" : "Open the Hub →"}</a>
        </div>

        <div className="rounded-2xl border border-g-line bg-white/[0.03] p-4">
          <div className="text-[11px] font-black uppercase tracking-wider text-g-green">{t.qH}</div>
          <ol className="mt-2 space-y-1.5">{t.qs.map((q, i) => <li key={i} className="flex gap-2 text-[12.5px] text-g-word"><span className="font-black text-g-green">{i + 1}.</span>{q}</li>)}</ol>
        </div>

        <div className="rounded-2xl border border-g-line bg-white/[0.03] p-4">
          <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{t.oH}</div>
          <div className="mt-2 space-y-2">{t.objs.map(([o, a]) => <div key={o} className="text-[12px] leading-snug"><span className="font-black text-g-word">{o}</span> <span className="text-g-ink">{a}</span></div>)}</div>
        </div>

        <div className="rounded-2xl border border-g-gold/30 bg-g-gold/[0.05] p-4">
          <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{t.mH}</div>
          <div className="mt-2 space-y-1">{t.meet.map((m) => <div key={m} className={`text-[12.5px] font-semibold ${m.includes("⚡") ? "text-g-gold" : "text-g-word"}`}>{m}</div>)}</div>
        </div>

        <p className="rounded-xl border border-[#d8916e]/25 bg-[#d8916e]/[0.05] px-3.5 py-2.5 text-[11.5px] leading-snug text-g-ink">{t.never}</p>

        <div>
          <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-g-muted">{t.tools}</div>
          <div className="grid grid-cols-2 gap-2">
            <a href="/roteiro" className="rounded-xl border border-g-gold/30 bg-g-gold/[0.08] px-3 py-2.5 text-center text-[12px] font-black text-g-gold">🎬 Roteiro</a>
            <a href="/prospects" className="rounded-xl border border-g-green/30 bg-g-green/[0.08] px-3 py-2.5 text-center text-[12px] font-black text-g-green">🎯 Prospects</a>
            <a href="/pitch" className="rounded-xl border border-g-line bg-white/[0.04] px-3 py-2.5 text-center text-[12px] font-bold text-g-word">🎤 Pitch</a>
            <a href="/proposta?to=Cliente&price=1497&recover=3900" className="rounded-xl border border-g-line bg-white/[0.04] px-3 py-2.5 text-center text-[12px] font-bold text-g-word">📄 Proposta</a>
            <a href="/academia" className="rounded-xl border border-g-line bg-white/[0.04] px-3 py-2.5 text-center text-[12px] font-bold text-g-word">🎓 Academy</a>
            <a href="/vendedor" className="rounded-xl border border-g-green/30 bg-g-green/[0.08] px-3 py-2.5 text-center text-[12px] font-black text-g-green">🧰 {lang === "pt" ? "Hub" : "Hub"}</a>
            <a href={waLink("Luis, socorro rápido numa reunião:")} target="_blank" rel="noopener" className="rounded-xl border border-g-green/30 bg-g-green/[0.08] px-3 py-2.5 text-center text-[12px] font-black text-g-green">🆘 Luis</a>
          </div>
        </div>
      </div>
    </div>
  );
}
