import { useParams, Link } from "react-router-dom";
import { useLang } from "../i18n.jsx";
import { useSeo } from "../lib/seo.js";
import { PITCH_NICHES, PITCH_CARDS } from "../data/cartasDePitch.js";

// Print-optimized "field kit" one-pager per niche, built from the pitch-card data.
// A seller opens /kit/:niche, prints / saves as PDF, or screenshots it to send.
// Screen chrome (picker + buttons) is hidden in print; only the white sheet prints.

// Chrome + section labels in pt/en/es/hi (card CONTENT from cartasDePitch.js falls back en→pt).
const UI = {
  pt: {
    seoTitle: "Kit de campo — Guileo",
    seoDesc: "Kit de campo imprimível por nicho — abra, imprima ou salve em PDF e leve para a reunião.",
    pick: "Escolha o nicho",
    print: "🖨️ Imprimir / PDF",
    back: "← Voltar ao hub do vendedor",
    kit: "Kit de campo",
    pain: "A dor",
    leak: "O que está vazando",
    solution: "A solução (o ganho dele)",
    gain: "O que ele ganha",
    edge: "Como passa a concorrência",
    opener: "Como abrir",
    discovery: "Perguntas que fazem ele perceber",
    objection: "Se ele resistir",
    tagline: "Soluções inteligentes para o seu negócio",
  },
  en: {
    seoTitle: "Field kit — Guileo",
    seoDesc: "Printable per-niche field kit — open, print or save as PDF and bring it to the meeting.",
    pick: "Pick the niche",
    print: "🖨️ Print / PDF",
    back: "← Back to seller hub",
    kit: "Field kit",
    pain: "The pain",
    leak: "What's leaking",
    solution: "The solution (what they gain)",
    gain: "What they gain",
    edge: "How they beat the competition",
    opener: "How to open",
    discovery: "Questions that make them realize it",
    objection: "If they push back",
    tagline: "Intelligent solutions for your business",
  },
  es: {
    seoTitle: "Kit de campo — Guileo",
    seoDesc: "Kit de campo imprimible por nicho — ábrelo, imprímelo o guárdalo como PDF y llévalo a la reunión.",
    pick: "Elige el nicho",
    print: "🖨️ Imprimir / PDF",
    back: "← Volver al hub del vendedor",
    kit: "Kit de campo",
    pain: "El dolor",
    leak: "Lo que se está fugando",
    solution: "La solución (lo que él gana)",
    gain: "Lo que él gana",
    edge: "Cómo supera a la competencia",
    opener: "Cómo abrir",
    discovery: "Preguntas que se lo hacen notar",
    objection: "Si se resiste",
    tagline: "Soluciones inteligentes para tu negocio",
  },
  hi: {
    seoTitle: "फ़ील्ड किट — Guileo",
    seoDesc: "निच के हिसाब से प्रिंट होने वाला फ़ील्ड किट — खोलें, प्रिंट करें या PDF सहेजें और मीटिंग में ले जाएँ।",
    pick: "निच चुनें",
    print: "🖨️ प्रिंट / PDF",
    back: "← सेलर हब पर वापस",
    kit: "फ़ील्ड किट",
    pain: "दर्द",
    leak: "क्या रिस रहा है",
    solution: "समाधान (उसका फ़ायदा)",
    gain: "उसे क्या मिलता है",
    edge: "प्रतिस्पर्धा से आगे कैसे",
    opener: "शुरुआत कैसे करें",
    discovery: "सवाल जो उसे एहसास कराएँ",
    objection: "अगर वह हिचके",
    tagline: "आपके व्यवसाय के लिए बुद्धिमान समाधान",
  },
};

export default function Kit() {
  const { lang } = useLang();
  const L = UI[lang] || UI.en;
  // field accessor: lang → en → pt fallback (hi not present in pitch data)
  const t = (field) => (field && (field[lang] || field.en || field.pt)) || "";

  const { niche } = useParams();
  const active = PITCH_NICHES.find((n) => n.id === niche) || PITCH_NICHES[0];
  const card = PITCH_CARDS[active.id];

  useSeo({ title: L.seoTitle, description: L.seoDesc, path: "/kit" });

  return (
    <div className="min-h-screen surface-real text-g-ink">
      {/* Print rules: hide chrome, force the sheet to a clean white A4 page with dark ink. */}
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          html, body { background: #fff !important; }
          .kit-noprint { display: none !important; }
          .kit-sheet {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            max-width: 100% !important;
            border-radius: 0 !important;
          }
        }
      `}</style>

      {/* ── Screen-only chrome ─────────────────────────────────────────── */}
      <div className="kit-noprint print:hidden max-w-3xl mx-auto px-5 pt-8 pb-2">
        <Link to="/vendedor" className="g-muted text-sm hover:g-word">{L.back}</Link>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="eyebrow w-full mb-1">{L.pick}</span>
          {PITCH_NICHES.map((n) => {
            const on = n.id === active.id;
            return (
              <Link
                key={n.id}
                to={`/kit/${n.id}`}
                className={
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm border transition " +
                  (on
                    ? "g-gold border-g-line bg-[rgba(255,138,51,0.12)]"
                    : "g-muted border-g-line hover:g-word")
                }
              >
                <span aria-hidden="true">{n.emoji}</span>
                <span>{n.name[lang] || n.name.en}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-bright"
          >
            {L.print}
          </button>
        </div>
      </div>

      {/* ── The KIT SHEET — this is what prints (light bg, dark ink) ─────── */}
      <div
        className="kit-sheet mx-auto my-6 px-9 py-9 sm:px-11 sm:py-11 rounded-2xl"
        style={{
          maxWidth: "720px",
          background: "#ffffff",
          color: "#161512",
          boxShadow: "0 1px 40px rgba(0,0,0,0.35)",
          border: "1px solid #e7e3da",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-4 pb-5 mb-6"
          style={{ borderBottom: "2px solid #161512" }}
        >
          <div>
            <div style={{ fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8a8377", fontWeight: 700 }}>
              {L.kit}
            </div>
            <h1 style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 800, margin: "6px 0 0", color: "#161512" }}>
              <span aria-hidden="true" style={{ marginRight: 10 }}>{active.emoji}</span>
              {active.name[lang] || active.name.en}
            </h1>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#FF8A33", letterSpacing: "-0.01em" }}>Guileo</div>
          </div>
        </div>

        {/* Sections */}
        <Section label={L.pain} body={t(card.pain)} />
        <Section label={L.leak} body={t(card.leak)} accent />
        <Section label={L.solution} body={t(card.solution)} />

        <SectionWrap label={L.gain}>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
            {card.gain.map((g, i) => (
              <li key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 15, lineHeight: 1.45, color: "#2a2820" }}>
                <span style={{ color: "#16a34a", fontWeight: 800 }} aria-hidden="true">✓</span>
                <span>{t(g)}</span>
              </li>
            ))}
          </ul>
        </SectionWrap>

        <Section label={L.edge} body={t(card.edge)} />

        <SectionWrap label={L.opener}>
          <p style={{
            margin: 0, fontSize: 15.5, lineHeight: 1.5, color: "#161512", fontStyle: "italic",
            borderLeft: "3px solid #FF8A33", paddingLeft: 12,
          }}>
            “{t(card.opener)}”
          </p>
        </SectionWrap>

        <SectionWrap label={L.discovery}>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {card.discovery.map((d, i) => (
              <li key={i} style={{ marginBottom: 6, fontSize: 15, lineHeight: 1.45, color: "#2a2820" }}>
                {t(d)}
              </li>
            ))}
          </ol>
        </SectionWrap>

        <SectionWrap label={L.objection}>
          <p style={{ margin: "0 0 6px", fontSize: 15, lineHeight: 1.45, color: "#161512", fontWeight: 700 }}>
            “{t(card.objection.q)}”
          </p>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: "#2a2820" }}>
            {t(card.objection.a)}
          </p>
        </SectionWrap>

        {/* Footer */}
        <div
          className="mt-8 pt-4 flex flex-wrap items-center justify-between gap-2"
          style={{ borderTop: "1px solid #e7e3da", fontSize: 13, color: "#8a8377" }}
        >
          <span style={{ fontWeight: 700, color: "#161512" }}>guileoai.com</span>
          <span>{L.tagline}</span>
        </div>
      </div>
    </div>
  );
}

// A labeled block whose body is a single paragraph.
function Section({ label, body, accent }) {
  return (
    <SectionWrap label={label}>
      <p style={{
        margin: 0, fontSize: 15.5, lineHeight: 1.5,
        color: accent ? "#161512" : "#2a2820",
        fontWeight: accent ? 600 : 400,
      }}>
        {body}
      </p>
    </SectionWrap>
  );
}

// A labeled block wrapper with arbitrary children.
function SectionWrap({ label, children }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <h2 style={{
        fontSize: 12.5, letterSpacing: "0.07em", textTransform: "uppercase",
        fontWeight: 800, color: "#FF8A33", margin: "0 0 6px",
      }}>
        {label}
      </h2>
      {children}
    </section>
  );
}
