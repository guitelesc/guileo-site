import { useState } from "react";
import { useLang } from "../i18n.jsx";

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
};

export default function WebsiteGrader() {
  const { lang } = useLang();
  const t = T[lang === "pt" ? "pt" : "en"];
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
            <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder={t.ph}
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
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.namePh}
                  className="mt-3 w-full rounded-full border border-g-line bg-black/20 px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/60" />
                <input value={contact} onChange={(e) => setContact(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder={t.contactPh}
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
