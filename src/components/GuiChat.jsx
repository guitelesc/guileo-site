import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import mark from "../assets/guileo-mark.png";
import { useLang } from "../i18n.jsx";
import { waLink } from "../data/contact.js";

// Gui — OUR own on-brand landing concierge (replaces the removed third-party widget).
// Floating launcher → dark cement glass panel. Instant local answers for the common
// questions; Claude fallback via /api/gui-chat for everything else; always steers the
// visitor to the live call (#try) / WhatsApp. Trilingual (EN/PT/ES) + Hindi.

const UI = {
  en: { open: "Ask Gui", title: "Gui", status: "online · answers instantly", ph: "Ask me anything…", send: "Send", greet: "Hi 👋 I'm Gui. Ask me anything about how I'd answer calls, book and sell for your business — or let me call you live.", call: "📞 Let Gui call me", wa: "💬 WhatsApp", thinking: "Gui is typing…", chips: ["What is Guileo?", "How fast can I launch?", "How much does it cost?", "Which languages?"] },
  pt: { open: "Falar com a Gui", title: "Gui", status: "online · responde na hora", ph: "Pergunte o que quiser…", send: "Enviar", greet: "Oi 👋 Eu sou a Gui. Pergunte qualquer coisa sobre como eu atendo, agendo e vendo pro seu negócio — ou deixa eu te ligar ao vivo.", call: "📞 Deixe a Gui me ligar", wa: "💬 WhatsApp", thinking: "A Gui está digitando…", chips: ["O que é a Guileo?", "Em quanto tempo entra no ar?", "Quanto custa?", "Quais idiomas?"] },
  es: { open: "Habla con Gui", title: "Gui", status: "en línea · responde al instante", ph: "Pregúntame lo que quieras…", send: "Enviar", greet: "Hola 👋 Soy Gui. Pregúntame cualquier cosa sobre cómo contesto, agendo y vendo para tu negocio — o deja que te llame en vivo.", call: "📞 Que Gui me llame", wa: "💬 WhatsApp", thinking: "Gui está escribiendo…", chips: ["¿Qué es Guileo?", "¿Qué tan rápido arranco?", "¿Cuánto cuesta?", "¿Qué idiomas?"] },
  hi: { open: "Gui से पूछें", title: "Gui", status: "ऑनलाइन · तुरंत जवाब", ph: "कुछ भी पूछें…", send: "भेजें", greet: "नमस्ते 👋 मैं Gui हूँ। पूछिए कि मैं आपके व्यवसाय के लिए कॉल कैसे उठाती, बुकिंग और बिक्री कैसे करती हूँ — या मुझे लाइव कॉल करने दें।", call: "📞 Gui मुझे कॉल करे", wa: "💬 WhatsApp", thinking: "Gui लिख रही है…", chips: ["Guileo क्या है?", "कितनी जल्दी शुरू?", "कीमत कितनी है?", "कौन-कौन सी भाषाएँ?"] },
};

// Instant local answers (no network) for the most common questions. Accent-insensitive.
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const KB = [
  { k: ["what is", "o que e", "o que é", "que es", "guileo क्या", "kya hai", "about"], a: { en: "Guileo is an AI team for your business: a 24/7 voice receptionist that answers every call, replies on WhatsApp/SMS/social, books appointments, chases reviews and reactivates past customers — plus done-for-you sites and ads. A real human supervises it all. Want to hear it live? Drop your number and I'll call you.", pt: "A Guileo é um time de IA pro seu negócio: uma recepcionista de voz 24/7 que atende toda ligação, responde no WhatsApp/SMS/redes, agenda, pede avaliações e reativa clientes antigos — além de sites e anúncios prontos. Um humano de verdade supervisiona tudo. Quer ouvir ao vivo? Deixe seu número que eu te ligo.", es: "Guileo es un equipo de IA para tu negocio: una recepcionista de voz 24/7 que contesta cada llamada, responde en WhatsApp/SMS/redes, agenda, pide reseñas y reactiva clientes — además de sitios y anuncios listos. Un humano real lo supervisa. ¿Quieres oírlo en vivo? Deja tu número y te llamo.", hi: "Guileo आपके व्यवसाय के लिए एक AI टीम है: 24/7 वॉइस रिसेप्शनिस्ट जो हर कॉल उठाती है, WhatsApp/SMS/सोशल पर जवाब देती है, बुकिंग करती है, रिव्यू माँगती है और पुराने ग्राहकों को वापस लाती है — साथ ही तैयार वेबसाइट और विज्ञापन। एक असली व्यक्ति इसकी निगरानी करता है। लाइव सुनना चाहते हैं? अपना नंबर दें, मैं कॉल करती हूँ।" } },
  { k: ["how fast", "how long", "quanto tempo", "em quanto", "que tan rapido", "qué tan rápido", "kitni jaldi", "launch", "no ar", "arranco"], a: { en: "Most businesses go live in about 7 days — we set up your AI, train it on your business, and you're answering calls 24/7. There's a 30-day money-back guarantee.", pt: "A maioria entra no ar em cerca de 7 dias — a gente configura sua IA, treina no seu negócio e você já atende 24/7. Tem garantia de 30 dias com dinheiro de volta.", es: "La mayoría arranca en unos 7 días — configuramos tu IA, la entrenamos con tu negocio y ya contestas 24/7. Hay garantía de 30 días con devolución.", hi: "ज़्यादातर व्यवसाय लगभग 7 दिनों में शुरू हो जाते हैं — हम आपकी AI सेट करते हैं, आपके व्यवसाय पर ट्रेन करते हैं, और आप 24/7 कॉल उठाने लगते हैं। 30 दिन की मनी-बैक गारंटी है।" } },
  { k: ["how much", "price", "cost", "quanto custa", "preco", "preço", "cuanto cuesta", "cuánto", "precio", "kitni hai", "keemat", "kimat"], a: { en: "There are self-serve plans starting around $149/mo, plus a done-for-you track where a specialist sets everything up for you. The Pricing page has the current plans — want me to point you there, or should I just call you and walk you through it?", pt: "Tem planos self-service a partir de ~$149/mês, e uma trilha done-for-you onde um especialista monta tudo pra você. A página de Preços tem os planos atuais — quer que eu te leve lá, ou prefiro te ligar e explicar?", es: "Hay planes self-service desde ~$149/mes, y una vía done-for-you donde un especialista lo configura todo. La página de Precios tiene los planes actuales — ¿te llevo allí o te llamo y te explico?", hi: "लगभग $149/माह से सेल्फ-सर्व प्लान हैं, और एक done-for-you ट्रैक जहाँ विशेषज्ञ सब कुछ सेट करता है। Pricing पेज पर मौजूदा प्लान हैं — आपको वहाँ ले जाऊँ, या कॉल करके समझाऊँ?" } },
  { k: ["language", "languages", "idioma", "idiomas", "lingua", "língua", "bhasha", "hindi", "spanish", "portugues", "português"], a: { en: "I speak English, Portuguese and Spanish — and Hindi too. Your customers get answered fluently in their own language, automatically.", pt: "Eu falo inglês, português e espanhol — e hindi também. Seus clientes são atendidos com fluência no idioma deles, automaticamente.", es: "Hablo inglés, portugués y español — y también hindi. Tus clientes reciben atención con fluidez en su propio idioma, automáticamente.", hi: "मैं अंग्रेज़ी, पुर्तगाली और स्पेनिश बोलती हूँ — और हिन्दी भी। आपके ग्राहकों को अपने आप उनकी भाषा में धाराप्रवाह जवाब मिलता है।" } },
];
const matchKB = (q) => { const n = norm(q); return KB.find((e) => e.k.some((kw) => n.includes(norm(kw)))) || null; };

export default function GuiChat() {
  const { lang } = useLang();
  const L = UI[lang] || UI.en;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState([{ role: "gui", text: UI[lang]?.greet || UI.en.greet }]);
  const [showChips, setShowChips] = useState(true);
  const endRef = useRef(null);
  useEffect(() => { if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [thread, busy, open]);

  const toCall = () => { setOpen(false); document.getElementById("try")?.scrollIntoView({ behavior: "smooth", block: "center" }); };

  // a11y: Escape closes the chat panel
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const ask = async (text) => {
    const query = (text != null ? text : q).trim();
    if (!query || busy) return;
    setShowChips(false);
    const next = [...thread, { role: "you", text: query }];
    setThread(next); setQ(""); setBusy(true);
    const hit = matchKB(query);
    if (hit) { setThread((t) => [...t, { role: "gui", text: hit.a[lang] || hit.a.en }]); setBusy(false); return; }
    try {
      const r = await fetch("/api/gui-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: query, lang, history: next.slice(-6) }) });
      const d = await r.json();
      setThread((t) => [...t, { role: "gui", text: d.answer || L.greet }]);
    } catch {
      setThread((t) => [...t, { role: "gui", text: L.greet }]);
    }
    setBusy(false);
  };

  return (
    <>
      {/* Launcher */}
      <AnimatePresence>
        {!open && (
          <motion.button initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)} aria-label={L.open}
            className="fixed bottom-5 right-5 z-[60] flex items-center gap-2.5 rounded-full border border-g-gold/30 bg-g-deep/95 py-2.5 pl-2.5 pr-4 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.8)] backdrop-blur-xl hover:border-g-gold/60 transition-colors">
            <span className="relative grid place-items-center h-9 w-9 rounded-full bg-gradient-to-br from-g-green/30 to-g-gold/20 border border-white/15">
              <img src={mark} alt="" className="h-7 w-7 object-contain" />
              <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3"><span className="absolute inline-flex h-full w-full rounded-full bg-g-green/60 animate-ping" /><span className="relative inline-flex h-3 w-3 rounded-full bg-g-green border-2 border-g-deep" /></span>
            </span>
            <span className="text-sm font-bold text-g-word">{L.open}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ y: 24, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 24, opacity: 0, scale: 0.97 }} transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed z-[60] bottom-0 right-0 sm:bottom-5 sm:right-5 w-full sm:w-[380px] h-[78vh] sm:h-[560px] max-h-[680px] flex flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl border border-white/10 bg-g-deep/95 backdrop-blur-2xl shadow-[0_40px_90px_-24px_rgba(0,0,0,0.9)]">
            {/* header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-gradient-to-r from-g-green/[0.10] to-g-gold/[0.05]">
              <span className="relative grid place-items-center h-9 w-9 rounded-full bg-gradient-to-br from-g-green/30 to-g-gold/20 border border-white/15 shrink-0"><img src={mark} alt="" className="h-7 w-7 object-contain" /></span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-extrabold text-g-word leading-tight">{L.title}</div>
                <div className="flex items-center gap-1.5 text-[11px] text-g-light"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />{L.status}</div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-g-muted hover:text-g-word text-lg leading-none px-1">✕</button>
            </div>

            {/* thread — role=log + aria-live so screen readers hear Gui's replies */}
            <div role="log" aria-live="polite" className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {thread.map((m, i) => (
                <div key={i} className={`flex ${m.role === "you" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.role === "you" ? "bg-g-gold/[0.16] border border-g-gold/25 text-g-word" : "bg-white/[0.05] border border-white/10 text-g-word"}`}>
                    {m.role === "gui" && <span className="block text-[10px] font-black uppercase tracking-wider text-g-gold/80 mb-0.5">Gui</span>}
                    <span className="whitespace-pre-wrap">{m.text}</span>
                  </div>
                </div>
              ))}
              {busy && <div className="flex justify-start"><div className="rounded-2xl px-3.5 py-2.5 bg-white/[0.05] border border-white/10 text-sm text-g-muted">{L.thinking}</div></div>}
              {showChips && (
                <div className="flex flex-col gap-1.5 pt-1">
                  {L.chips.map((c) => (
                    <button key={c} onClick={() => ask(c)} className="text-left rounded-xl2 border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] font-semibold text-g-word hover:border-g-gold/40 hover:bg-white/[0.06] transition">{c}</button>
                  ))}
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* lead CTAs */}
            <div className="flex gap-2 px-4 pt-2">
              <button onClick={toCall} className="flex-1 rounded-full bg-gradient-to-r from-g-green to-g-light px-3 py-2 text-[12px] font-extrabold text-black hover:brightness-110 transition">{L.call}</button>
              <a href={waLink("Hi Guileo! I have a question about my business.")} target="_blank" rel="noopener" className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-2 text-[12px] font-bold text-g-word hover:border-g-gold/50 transition">{L.wa}</a>
            </div>

            {/* input */}
            <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex gap-2 p-3">
              <input value={q} onChange={(e) => setQ(e.target.value)} aria-label={L.ph} placeholder={L.ph} className="flex-1 rounded-full border border-white/15 bg-black/25 px-4 py-2.5 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
              <button disabled={busy || !q.trim()} className="rounded-full bg-g-gold px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50 hover:brightness-110 transition">{L.send}</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
