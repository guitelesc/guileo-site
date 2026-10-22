import { useState } from "react";
import { motion } from "framer-motion";
import { MASTER_SENTENCE, OBJECTION_KILLERS } from "../data/salesKit.js";
import { waLink } from "../data/contact.js";
import SellerPitchCards from "./SellerPitchCards.jsx";
import { SLIDES_BY_LANG, Block, UI as DECK_UI } from "../pages/Deck.jsx";
import { NOME_DO_PAINEL } from "../portal/nome.js";

// ── Pitch tab — everything the seller needs 2 minutes before the meeting, on ONE
// screen: (1) the pocket card (same words/visual as /cola), (2) the Pitch Card
// library + AI, (3) the deck slides. No leaving the hub, no lost state.
//
// LANGUAGE RULE (this file used to be a 2-language page dropped in a 4-language
// hub — `D["es"]` was undefined and the first read of t.title blanked the screen):
//   • every dictionary read has an explicit reserve → `D[lang] || D.en`;
//   • the Cola chrome is written in all 4 languages here;
//   • what comes from salesKit.js (master sentence, 8 objections) has pt/en/es
//     only → for `hi` the WHOLE block (heading included) falls back to ENGLISH,
//     never to Portuguese and never half-and-half.

const COLA_LANGS = ["pt", "en", "es"]; // languages salesKit.js actually speaks

const objsFor = (lang) => OBJECTION_KILLERS.map((o) => [
  (o.tag && (o.tag[lang] || o.tag.en)) || "",
  `→ ${(o.short && (o.short[lang] || o.short.en)) || ""}`,
]);

const D = {
  pt: {
    title: "Cola de bolso", sub: "Abra 2 min antes da reunião. Respira. Você tá pronto.",
    qH: "🔍 As 5 perguntas (deixa ELE falar)",
    qs: ["Quantas ligações perde por dia?", "Quem responde o WhatsApp à noite?", "E quem pede orçamento e some?", "Quantos clientes ninguém chamou de volta?", "A $50–100 cada… quanto vaza/mês?"],
    oH: "🛡️ As 8 objeções (1 linha cada)",
    mH: "📋 Os 15 minutos",
    meet: ["0-3 · perguntas (ele fala)", "3-5 · a frase", "5-9 · ⚡ GUI LIGA (silêncio!)", `9-12 · ${NOME_DO_PAINEL} + a dor dele`, "12-15 · proposta + garantia"],
    never: "🚫 Nunca: prometer que a IA não erra · resultado exato em $ · menos de 7 dias",
    tools: "🧰 Ferramentas",
    tabCola: "🫱 Cola", tabCards: "🃏 Cards", tabSlides: "🎞️ Slides",
    tRoteiro: "🎬 Roteiro", tProspects: "🎯 Prospects", tCards: "🃏 Pitch Cards", tProposta: "📄 Proposta", tAcademy: "🎓 Academia", tSlides: "🎞️ Slides", tLuis: "🆘 Luis",
    sPrev: "← Anterior", sNext: "Próximo →", sNote: "🎤 Nota do apresentador", sSlide: "Slide",
  },
  en: {
    title: "Pocket card", sub: "Open 2 min before the meeting. Breathe. You're ready.",
    qH: "🔍 The 5 questions (let THEM talk)",
    qs: ["How many calls do you miss per day?", "Who answers WhatsApp at night?", "What about quote-and-ghost people?", "How many customers never got a call back?", "At $50–100 each… how much leaks/mo?"],
    oH: "🛡️ The 8 objections (one line each)",
    mH: "📋 The 15 minutes",
    meet: ["0-3 · questions (they talk)", "3-5 · the sentence", "5-9 · ⚡ GUI CALLS (silence!)", `9-12 · ${NOME_DO_PAINEL} + their pain`, "12-15 · proposal + guarantee"],
    never: "🚫 Never: promise the AI never errs · exact $ results · under 7 days",
    tools: "🧰 Tools",
    tabCola: "🫱 Pocket card", tabCards: "🃏 Cards", tabSlides: "🎞️ Slides",
    tRoteiro: "🎬 Script", tProspects: "🎯 Prospects", tCards: "🃏 Pitch Cards", tProposta: "📄 Proposal", tAcademy: "🎓 Academy", tSlides: "🎞️ Slides", tLuis: "🆘 Luis",
    sPrev: "← Previous", sNext: "Next →", sNote: "🎤 Presenter note", sSlide: "Slide",
  },
  es: {
    title: "Chuleta de bolsillo", sub: "Ábrela 2 min antes de la reunión. Respira. Estás listo.",
    qH: "🔍 Las 5 preguntas (deja que ÉL hable)",
    qs: ["¿Cuántas llamadas pierde por día?", "¿Quién responde el WhatsApp de noche?", "¿Y quien pide presupuesto y desaparece?", "¿A cuántos clientes nadie llamó de vuelta?", "A $50–100 cada una… ¿cuánto se fuga al mes?"],
    oH: "🛡️ Las 8 objeciones (1 línea cada una)",
    mH: "📋 Los 15 minutos",
    meet: ["0-3 · preguntas (él habla)", "3-5 · la frase", "5-9 · ⚡ GUI LLAMA (¡silencio!)", `9-12 · ${NOME_DO_PAINEL} + su dolor`, "12-15 · propuesta + garantía"],
    never: "🚫 Nunca: prometer que la IA no falla · resultado exacto en $ · menos de 7 días",
    tools: "🧰 Herramientas",
    tabCola: "🫱 Chuleta", tabCards: "🃏 Cards", tabSlides: "🎞️ Diapositivas",
    tRoteiro: "🎬 Guion", tProspects: "🎯 Prospectos", tCards: "🃏 Pitch Cards", tProposta: "📄 Propuesta", tAcademy: "🎓 Academia", tSlides: "🎞️ Diapositivas", tLuis: "🆘 Luis",
    sPrev: "← Anterior", sNext: "Siguiente →", sNote: "🎤 Nota del presentador", sSlide: "Diapositiva",
  },
  hi: {
    title: "पॉकेट कार्ड", sub: "मीटिंग से 2 मिनट पहले खोलें। साँस लें। आप तैयार हैं।",
    qH: "🔍 5 सवाल (उन्हें बोलने दें)",
    qs: ["रोज़ कितनी कॉल छूट जाती हैं?", "रात में WhatsApp कौन जवाब देता है?", "जो भाव पूछकर गायब हो जाते हैं, उनका क्या?", "कितने ग्राहकों को किसी ने वापस कॉल नहीं किया?", "हर एक $50–100 की… महीने में कितना रिसता है?"],
    oH: "🛡️ 8 आपत्तियाँ (हर एक 1 लाइन)",
    mH: "📋 15 मिनट",
    meet: ["0-3 · सवाल (वे बोलते हैं)", "3-5 · वह वाक्य", "5-9 · ⚡ गुई कॉल करती है (चुप रहें!)", `9-12 · ${NOME_DO_PAINEL} + उनका दर्द`, "12-15 · प्रस्ताव + गारंटी"],
    never: "🚫 कभी नहीं: यह वादा कि AI कभी गलती नहीं करती · $ में सटीक नतीजा · 7 दिन से कम",
    tools: "🧰 टूल्स",
    tabCola: "🫱 पॉकेट कार्ड", tabCards: "🃏 कार्ड्स", tabSlides: "🎞️ स्लाइड्स",
    tRoteiro: "🎬 स्क्रिप्ट", tProspects: "🎯 प्रॉस्पेक्ट्स", tCards: "🃏 Pitch Cards", tProposta: "📄 प्रस्ताव", tAcademy: "🎓 Academy", tSlides: "🎞️ स्लाइड्स", tLuis: "🆘 Luis",
    sPrev: "← पिछला", sNext: "अगला →", sNote: "🎤 प्रस्तुतकर्ता नोट", sSlide: "स्लाइड",
  },
};

// ── 1. Pocket card (the /cola screen, preserved) ─────────────────────────────
function Cola({ lang, t, nav, goCards, goSlides }) {
  // salesKit has pt/en/es. For any other language the sentence + objections
  // block speaks English end-to-end (heading included) — never mixed.
  const kitLang = COLA_LANGS.includes(lang) ? lang : "en";
  const kitT = D[kitLang] || D.en;
  const sentence = MASTER_SENTENCE[kitLang] || MASTER_SENTENCE.en;
  const objs = objsFor(kitLang);
  const tool = "grid min-h-[44px] place-items-center rounded-xl px-3 py-2.5 text-center text-[12px] font-black";

  return (
    <div className="mx-auto max-w-md space-y-4">
      <p className="text-[11.5px] italic text-g-muted">{t.sub}</p>

      <blockquote className="rounded-2xl border border-g-green/30 bg-g-green/[0.06] p-4 text-[13px] font-bold leading-relaxed text-g-word">“{sentence}”</blockquote>

      <div className="rounded-2xl border border-g-line bg-white/[0.03] p-4 backdrop-blur-xl">
        <div className="text-[11px] font-black uppercase tracking-wider text-g-green">{t.qH}</div>
        <ol className="mt-2 space-y-1.5">{t.qs.map((q, i) => <li key={i} className="flex gap-2 text-[12.5px] text-g-word"><span className="font-black text-g-green">{i + 1}.</span>{q}</li>)}</ol>
      </div>

      <div className="rounded-2xl border border-g-line bg-white/[0.03] p-4 backdrop-blur-xl">
        <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{kitT.oH}</div>
        <div className="mt-2 space-y-2">{objs.map(([o, a]) => <div key={o} className="text-[12px] leading-snug"><span className="font-black text-g-word">{o}</span> <span className="text-g-ink">{a}</span></div>)}</div>
      </div>

      <div className="rounded-2xl border border-g-gold/30 bg-g-gold/[0.05] p-4">
        <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{t.mH}</div>
        <div className="mt-2 space-y-1">{t.meet.map((m) => <div key={m} className={`text-[12.5px] font-semibold ${m.includes("⚡") ? "text-g-gold" : "text-g-word"}`}>{m}</div>)}</div>
      </div>

      <p className="rounded-xl border border-[#d8916e]/25 bg-[#d8916e]/[0.05] px-3.5 py-2.5 text-[11.5px] leading-snug text-g-ink">{t.never}</p>

      <div>
        <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-g-muted">{t.tools}</div>
        <div className="grid grid-cols-2 gap-2">
          {/* No hub tab for the full script → external, new tab so the hub survives. */}
          <a href="/roteiro" target="_blank" rel="noopener" className={`${tool} border border-g-gold/30 bg-g-gold/[0.08] text-g-gold`}>{t.tRoteiro}</a>
          <button onClick={() => nav("alvos")} className={`${tool} border border-g-green/30 bg-g-green/[0.08] text-g-green`}>{t.tProspects}</button>
          <button onClick={goCards} className={`${tool} border border-g-line bg-white/[0.04] text-g-word`}>{t.tCards}</button>
          <button onClick={() => nav("quote")} className={`${tool} border border-g-line bg-white/[0.04] text-g-word`}>{t.tProposta}</button>
          <button onClick={() => nav("academy")} className={`${tool} border border-g-line bg-white/[0.04] text-g-word`}>{t.tAcademy}</button>
          <button onClick={goSlides} className={`${tool} border border-g-line bg-white/[0.04] text-g-word`}>{t.tSlides}</button>
          <a href={waLink("Luis, socorro rápido numa reunião:")} target="_blank" rel="noopener" className={`${tool} col-span-2 border border-g-green/30 bg-g-green/[0.08] text-g-green`}>{t.tLuis}</a>
        </div>
      </div>
    </div>
  );
}

// ── 3. Slides (the /deck deck, inside the hub) ───────────────────────────────
function Slides({ lang, t }) {
  const SLIDES = SLIDES_BY_LANG[lang] || SLIDES_BY_LANG.en;
  const total = SLIDES.length;
  const [i, setI] = useState(0);
  const [notes, setNotes] = useState(true);
  const go = (n) => setI((c) => Math.max(0, Math.min(total - 1, typeof n === "function" ? n(c) : n)));
  const s = SLIDES[Math.min(i, total - 1)];
  const notesLabel = (DECK_UI.notes && (DECK_UI.notes[lang] || DECK_UI.notes.en)) || "🎤 Notes";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{s.tag} · {i + 1}/{total}</div>
        <button onClick={() => setNotes((v) => !v)} className={`min-h-[44px] rounded-full border px-3 py-1.5 text-[12px] font-bold transition ${notes ? "border-g-gold/40 bg-g-gold/10 text-g-gold" : "border-white/15 bg-white/[0.04] text-g-muted"}`}>{notesLabel}</button>
      </div>
      <div className="h-1 w-full rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-g-green to-g-gold transition-all duration-300" style={{ width: `${((i + 1) / total) * 100}%` }} /></div>

      {/* No exit animation on purpose: with AnimatePresence the outgoing slide could
          stay mounted after a language switch and the screen showed an EN heading over
          a PT slide. Keyed remount = one slide, one language, always. */}
      <motion.div key={`${lang}-${i}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}
        className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-7">
          <h3 className="text-xl sm:text-3xl font-black text-g-word tracking-tight leading-tight">{s.title}</h3>
          {s.sub && <p className="mt-2 text-[15px] sm:text-lg text-g-light/90 font-semibold">{s.sub}</p>}
          <div className="mt-4 space-y-3.5">{s.body.map((b, k) => <Block key={k} b={b} />)}</div>
          {notes && s.note && (
            <div className="mt-5 rounded-xl2 border border-g-green/25 bg-g-green/[0.06] p-4">
              <div className="text-[10px] font-black uppercase tracking-wide text-g-green">{t.sNote}</div>
              <p className="mt-1 text-[13px] text-g-light/85 leading-relaxed">{s.note}</p>
            </div>
          )}
      </motion.div>

      <div className="flex items-center justify-between gap-2">
        <button onClick={() => go((c) => c - 1)} disabled={i === 0} className="min-h-[44px] rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-[13px] font-bold text-g-word disabled:opacity-40">{t.sPrev}</button>
        <span className="text-[11px] text-g-muted">{t.sSlide} {i + 1}/{total}</span>
        <button onClick={() => go((c) => c + 1)} disabled={i === total - 1} className="min-h-[44px] rounded-full bg-gradient-to-br from-g-green to-g-dark px-4 py-2 text-[13px] font-bold text-white disabled:opacity-40">{t.sNext}</button>
      </div>
    </div>
  );
}

export default function SellerPitch({ lang = "pt", seller, sid = "", nav = () => {} }) {
  const t = D[lang] || D.en; // explicit reserve — a missing language must never blank the screen
  const [sec, setSec] = useState("cola"); // the pocket card is what saves the nervous seller

  const SECTIONS = [["cola", t.tabCola], ["cards", t.tabCards], ["slides", t.tabSlides]];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-black text-g-word">{t.title}</h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {SECTIONS.map(([k, label]) => (
          <button key={k} onClick={() => setSec(k)} aria-pressed={sec === k}
            className={`min-h-[44px] shrink-0 rounded-full px-4 py-2 text-[12.5px] font-black transition ${sec === k ? "bg-g-green/15 text-g-word ring-1 ring-g-green/40" : "bg-white/[0.04] text-g-muted ring-1 ring-white/10"}`}>{label}</button>
        ))}
      </div>

      {sec === "cola" && <Cola lang={lang} t={t} nav={nav} goCards={() => setSec("cards")} goSlides={() => setSec("slides")} />}
      {sec === "cards" && <SellerPitchCards lang={lang} seller={seller} sid={sid} />}
      {sec === "slides" && <Slides lang={lang} t={t} />}
    </div>
  );
}
