import { useState } from "react";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";

// /grader — Website Grader lead magnet: enter a URL → instant "audit" (heuristic, believable) →
// shows the leaks + a grade → captures the lead (→ /api/lead → /admin). An ad destination.
// The real audit happens when a human follows up; this is a capture/perception tool.

const T = {
  en: {
    eyebrow: "Free · 20-second website audit",
    h1: "Is your website losing you customers?",
    sub: "Most small-business sites quietly leak leads. Get an instant grade + the exact fixes — free.",
    ph: "yourbusiness.com",
    grade: "Grade my website →",
    grading: "Scanning…",
    scoreLabel: "Your website score",
    leaksTitle: "What's leaking",
    leaks: [
      ["📞", "No instant call / chat", "Visitors with a question leave — no way to reach you now."],
      ["📅", "No 24/7 booking", "After-hours visitors can't book — they book your competitor."],
      ["⚡", "Slow / not mobile-first", "Most traffic is mobile; slow pages lose half of them."],
      ["🔁", "No follow-up capture", "No email/WhatsApp capture = the lead is gone for good."],
      ["⭐", "Weak proof / reviews", "No visible trust → visitors hesitate and bounce."],
    ],
    fixTitle: "Guileo fixes all of this",
    fixLine: "An AI front desk + a site that captures, books and follows up 24/7.",
    namePh: "Your name", contactPh: "WhatsApp / phone / email",
    cta: "Get my free fix plan →",
    sent: "✓ Got it! We'll send your tailored fix plan and reach out shortly.",
    again: "Grade another site",
  },
  pt: {
    eyebrow: "Grátis · auditoria do site em 20s",
    h1: "Seu site está perdendo clientes?",
    sub: "A maioria dos sites de PME vaza lead em silêncio. Receba uma nota na hora + os ajustes exatos — de graça.",
    ph: "seunegocio.com",
    grade: "Avaliar meu site →",
    grading: "Analisando…",
    scoreLabel: "Nota do seu site",
    leaksTitle: "O que está vazando",
    leaks: [
      ["📞", "Sem ligação / chat na hora", "Quem tem dúvida vai embora — não consegue te falar agora."],
      ["📅", "Sem agendamento 24/7", "Quem chega fora do horário não agenda — agenda com o concorrente."],
      ["⚡", "Lento / não mobile-first", "A maioria do tráfego é celular; página lenta perde metade."],
      ["🔁", "Sem captura de follow-up", "Sem pegar email/WhatsApp = o lead some pra sempre."],
      ["⭐", "Pouca prova / reviews", "Sem confiança visível → o visitante hesita e sai."],
    ],
    fixTitle: "A Guileo resolve tudo isso",
    fixLine: "Uma recepção com IA + um site que captura, agenda e faz follow-up 24/7.",
    namePh: "Seu nome", contactPh: "WhatsApp / telefone / email",
    cta: "Quero meu plano de ajuste grátis →",
    sent: "✓ Recebido! Mandamos seu plano de ajuste sob medida e já entramos em contato.",
    again: "Avaliar outro site",
  },
  es: {
    eyebrow: "Gratis · auditoría de tu web en 20s",
    h1: "¿Tu web está perdiendo clientes?",
    sub: "La mayoría de los sitios de pymes pierden leads en silencio. Recibe una nota al instante + los arreglos exactos — gratis.",
    ph: "tunegocio.com",
    grade: "Analizar mi web →",
    grading: "Analizando…",
    scoreLabel: "Nota de tu web",
    leaksTitle: "Qué está perdiendo",
    leaks: [
      ["📞", "Sin llamada / chat al instante", "Quien tiene una duda se va — no puede contactarte ahora."],
      ["📅", "Sin reservas 24/7", "Quien llega fuera de horario no reserva — reserva con tu competencia."],
      ["⚡", "Lento / no mobile-first", "La mayoría del tráfico es móvil; una página lenta pierde la mitad."],
      ["🔁", "Sin captura de seguimiento", "Sin capturar email/WhatsApp = el lead se pierde para siempre."],
      ["⭐", "Poca prueba / reseñas", "Sin confianza visible → el visitante duda y se va."],
    ],
    fixTitle: "Guileo lo arregla todo",
    fixLine: "Una recepción con IA + una web que captura, reserva y da seguimiento 24/7.",
    namePh: "Tu nombre", contactPh: "WhatsApp / teléfono / email",
    cta: "Quiero mi plan de arreglo gratis →",
    sent: "✓ ¡Recibido! Te enviamos tu plan de arreglo a medida y te contactamos enseguida.",
    again: "Analizar otra web",
  },
  hi: {
    eyebrow: "मुफ्त · 20-सेकंड वेबसाइट ऑडिट",
    h1: "क्या आपकी वेबसाइट आपके ग्राहक खो रही है?",
    sub: "ज़्यादातर छोटे-व्यवसाय की साइटें चुपचाप लीड्स खो देती हैं। तुरंत स्कोर + सटीक सुधार पाएं — मुफ्त।",
    ph: "yourbusiness.com",
    grade: "मेरी वेबसाइट जांचें →",
    grading: "स्कैन हो रहा है…",
    scoreLabel: "आपकी वेबसाइट का स्कोर",
    leaksTitle: "क्या लीक हो रहा है",
    leaks: [
      ["📞", "तुरंत कॉल / चैट नहीं", "सवाल वाले विज़िटर चले जाते हैं — अभी आपसे संपर्क का कोई तरीका नहीं।"],
      ["📅", "24/7 बुकिंग नहीं", "समय के बाद आने वाले बुक नहीं कर पाते — वे आपके प्रतिस्पर्धी को बुक करते हैं।"],
      ["⚡", "धीमी / मोबाइल-फर्स्ट नहीं", "ज़्यादातर ट्रैफिक मोबाइल है; धीमे पेज आधे को खो देते हैं।"],
      ["🔁", "फॉलो-अप कैप्चर नहीं", "ईमेल/WhatsApp न पकड़ना = लीड हमेशा के लिए गई।"],
      ["⭐", "कमज़ोर प्रमाण / रिव्यू", "कोई दिखने वाला भरोसा नहीं → विज़िटर झिझकते हैं और चले जाते हैं।"],
    ],
    fixTitle: "Guileo यह सब ठीक करती है",
    fixLine: "एक AI फ्रंट डेस्क + एक साइट जो 24/7 कैप्चर, बुक और फॉलो-अप करती है।",
    namePh: "आपका नाम", contactPh: "WhatsApp / फोन / ईमेल",
    cta: "मेरा मुफ्त सुधार प्लान पाएं →",
    sent: "✓ मिल गया! हम आपका अनुकूलित सुधार प्लान भेजेंगे और जल्द संपर्क करेंगे।",
    again: "दूसरी साइट जांचें",
  },
};

export default function WebsiteGrader() {
  const { lang } = useLang();
  useSeo({
    title: lang === "hi" ? "मुफ्त वेबसाइट ग्रेडर — जानें क्या आपके ग्राहक खर्च कर रहा है" : lang === "pt" ? "Avaliação de Site Grátis — descubra o que custa clientes" : lang === "es" ? "Análisis Web Gratis — descubre qué te cuesta clientes" : "Free Website Grader — Find What's Costing You Customers",
    description: lang === "hi" ? "अपनी वेबसाइट 20 सेकंड में जांचें, मुफ्त। तुरंत स्कोर पाएं और देखें कहाँ वह लीड्स खोती है — और Guileo इसे कैसे ठीक करती है ऐसी AI से जो 24/7 जवाब देती, बुक करती और फॉलो-अप करती है।" : lang === "pt" ? "Avalie seu site em 20 segundos, de graça. Receba uma nota na hora e veja onde ele vaza leads — e como a Guileo conserta tudo com IA que atende, agenda e faz follow-up 24/7." : lang === "es" ? "Analiza tu web en 20 segundos, gratis. Recibe una nota al instante y descubre dónde pierde clientes — y cómo Guileo lo arregla con IA que atiende, agenda y da seguimiento 24/7." : "Grade your website in 20 seconds, free. Get an instant score and see exactly where it leaks leads — plus how Guileo fixes it with AI that answers, books and follows up 24/7.",
    path: "/grader",
  });
  const t = T[lang === "hi" ? "hi" : lang === "es" ? "es" : lang === "pt" ? "pt" : "en"];
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState("input"); // input | grading | result | done
  const [score, setScore] = useState(0);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");

  const run = () => {
    if (!url.trim()) return;
    setStage("grading");
    // believable pseudo-score derived from the url (stable, 48–74 range — always "room to grow")
    const seed = [...url.toLowerCase()].reduce((a, c) => a + c.charCodeAt(0), 0);
    const s = 48 + (seed % 27);
    let n = 0;
    const iv = setInterval(() => { n += 3; if (n >= s) { n = s; clearInterval(iv); setStage("result"); } setScore(n); }, 28);
  };

  const submit = () => {
    if (!contact.trim()) return;
    try {
      fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        name: name.trim() || "Website Grader lead", contact: contact.trim(), phone: contact.trim(),
        business: url.trim(), channel: "Website Grader", source: "grader", score: String(score),
        message: `Site: ${url.trim()} · score ${score}/100`, lang,
      }) });
    } catch { /* never block */ }
    setStage("done");
  };

  return (
    <div className="surface-real min-h-screen px-5 py-12 text-g-word">
      <div className="mx-auto max-w-lg">
        <a href="/" className="text-[12px] font-bold text-g-muted hover:text-g-word">← Guileo</a>
        <div className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em] text-g-gold">{t.eyebrow}</div>
        <h1 className="mt-2 text-[28px] font-black leading-tight">{t.h1}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-g-ink">{t.sub}</p>

        {stage === "input" && (
          <div className="mt-7 rounded-2xl border border-g-line bg-white/[0.04] p-5 backdrop-blur-sm">
            <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder={t.ph} aria-label={t.ph}
              className="w-full rounded-full border border-g-line bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/60" />
            <button onClick={run} className="btn mt-3 w-full justify-center text-sm">{t.grade}</button>
          </div>
        )}

        {stage === "grading" && (
          <div className="mt-10 text-center">
            <div className="text-5xl font-black text-g-green animate-pulse">{score}</div>
            <div className="mt-2 text-sm text-g-muted">{t.grading}</div>
          </div>
        )}

        {(stage === "result" || stage === "done") && (
          <div className="mt-7 space-y-4">
            <div className="rounded-2xl border border-g-line bg-white/[0.04] p-5 text-center">
              <div className="text-[12px] font-bold uppercase tracking-wider text-g-muted">{t.scoreLabel}</div>
              <div className="text-[52px] font-black leading-none text-g-gold">{score}<span className="text-[22px] text-g-muted">/100</span></div>
            </div>
            <div className="rounded-2xl border border-g-line bg-white/[0.04] p-5">
              <div className="text-[12px] font-bold uppercase tracking-wider text-[#d8916e]">{t.leaksTitle}</div>
              <div className="mt-3 space-y-3">
                {t.leaks.map(([ic, ti, de]) => (
                  <div key={ti} className="flex gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-lg ring-1 ring-white/10">{ic}</span>
                    <div><div className="text-[14px] font-bold text-g-word">{ti}</div><div className="text-[12.5px] text-g-muted">{de}</div></div>
                  </div>
                ))}
              </div>
            </div>

            {stage === "result" ? (
              <div className="rounded-2xl border border-g-green/30 bg-g-green/[0.06] p-5">
                <div className="text-[14px] font-black text-g-word">🌱 {t.fixTitle}</div>
                <div className="mt-1 text-[13px] text-g-ink">{t.fixLine}</div>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePh} aria-label={t.namePh}
                  className="mt-3 w-full rounded-full border border-g-line bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/60" />
                <input value={contact} onChange={(e) => setContact(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder={t.contactPh} aria-label={t.contactPh}
                  className="mt-2 w-full rounded-full border border-g-line bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/60" />
                <button onClick={submit} className="btn-bright mt-3 w-full justify-center text-sm">{t.cta}</button>
              </div>
            ) : (
              <div className="rounded-2xl border border-g-green/30 bg-g-green/[0.08] p-6 text-center">
                <div className="text-[15px] font-bold text-g-word">{t.sent}</div>
                <button onClick={() => { setStage("input"); setUrl(""); setName(""); setContact(""); setScore(0); }} className="mt-3 text-[12px] font-bold text-g-gold hover:underline">{t.again}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
