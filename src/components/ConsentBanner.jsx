import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "../i18n.jsx";
import { consentDecided, grantConsent, denyConsent } from "../lib/analytics.js";

// ─────────────────────────────────────────────────────────────────────────────
// ConsentBanner — LGPD/GDPR-first cookie choice, in the landing's own visual voice.
//
// CONSENT MODEL (documented): OPT-IN EVERYWHERE. We do NOT default-on for US
// visitors — a single privacy-first path is simpler, defensible under LGPD + GDPR,
// and matches the rest of the site (we already decline non-essential by default).
// Ad/analytics pixels load ONLY after "Accept" (grantConsent → loadPixels). "Only
// essentials" persists the choice and pixels never load. The decision is remembered
// 180 days (see analytics.js) so the banner shows once, not every visit.
//
// The banner is INERT until a visitor decides: on mount we check consentDecided() —
// if they already chose (this or a prior visit), it never renders. Mounting is the
// orchestrator's job (App.jsx) — see the patch note in the W1 report.
// ─────────────────────────────────────────────────────────────────────────────

const COPY = {
  en: {
    text: "We use cookies for analytics and ads to understand what brings businesses to Guileo. You choose.",
    accept: "Accept",
    essential: "Only essentials",
    privacy: "Privacy",
  },
  pt: {
    text: "Usamos cookies de análise e anúncios para entender o que traz negócios até a Guileo. Você decide.",
    accept: "Aceitar",
    essential: "Só essenciais",
    privacy: "Privacidade",
  },
  es: {
    text: "Usamos cookies de análisis y anuncios para entender qué trae negocios a Guileo. Tú decides.",
    accept: "Aceptar",
    essential: "Solo esenciales",
    privacy: "Privacidad",
  },
  hi: {
    text: "हम एनालिटिक्स और विज्ञापनों के लिए कुकीज़ का उपयोग करते हैं ताकि समझ सकें कि व्यवसाय Guileo तक कैसे पहुँचते हैं। चुनाव आपका है।",
    accept: "स्वीकारें",
    essential: "केवल आवश्यक",
    privacy: "गोपनीयता",
  },
};

export default function ConsentBanner() {
  const { lang } = useLang();
  const c = COPY[lang] || COPY.en;
  // Start hidden; decide on mount (localStorage is client-only → avoids SSR/hydration flash).
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Only surface for a visitor who hasn't chosen yet (or whose 180-day choice expired).
    if (!consentDecided()) setShow(true);
  }, []);

  const accept = () => { grantConsent(); setShow(false); };
  const decline = () => { denyConsent(); setShow(false); };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          role="dialog"
          aria-live="polite"
          aria-label={c.privacy}
          className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 sm:px-4 sm:pb-4"
        >
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 rounded-2xl border border-white/15 bg-black/70 px-4 py-3 text-center backdrop-blur-xl shadow-glow sm:flex-row sm:text-left">
            <p className="flex-1 text-[12.5px] leading-snug text-g-muted">
              🍪 {c.text}{" "}
              <a href="/privacy" className="underline decoration-g-green/50 underline-offset-2 hover:text-g-word">
                {c.privacy}
              </a>
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={decline}
                className="rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-xs font-bold text-g-muted transition hover:text-g-word min-h-[40px]"
              >
                {c.essential}
              </button>
              <button
                type="button"
                onClick={accept}
                className="btn-bright px-5 py-2 text-xs min-h-[40px]"
              >
                {c.accept}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
