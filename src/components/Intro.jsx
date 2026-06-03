import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import logo from "../assets/guileo-logo.png";

// Seed → sprout opening. Plays once on mount, ~1.5s, skippable.
// Calls onDone when it hands off to the hero (overlay then fades out).
export default function Intro({ onDone }) {
  const reduce = useReducedMotion();
  // play once per browser session (don't replay on every reload/navigation)
  const seen = (() => { try { return !!sessionStorage.getItem("guileo_intro_seen"); } catch { return false; } })();
  const [show, setShow] = useState(!reduce && !seen);

  useEffect(() => {
    if (!show) { onDone?.(); return; }
    try { sessionStorage.setItem("guileo_intro_seen", "1"); } catch { /* private mode */ }
    const t = setTimeout(() => { setShow(false); onDone?.(); }, 1500);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const skip = () => { setShow(false); onDone?.(); };
  if (!show) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-g-cream overflow-hidden cursor-pointer"
          onClick={skip}
          initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: "easeInOut" }}>

          {/* ambient glow blooming */}
          <motion.div className="absolute h-[42rem] w-[42rem] rounded-full blur-[100px] pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(214,194,154,0.13), rgba(62,148,104,0.06) 45%, transparent 70%)" }}
            initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.2, ease: "easeOut" }} />

          <div className="relative flex flex-col items-center">
            {/* seed burst ring */}
            <motion.span className="absolute top-8 h-24 w-24 rounded-full border border-g-gold/50 pointer-events-none"
              initial={{ scale: 0, opacity: 0.8 }} animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 0.9, delay: 0.25, ease: "easeOut" }} />

            {/* seed → sprout (logo grows out) */}
            <motion.img src={logo} alt="" className="h-24 w-24 object-contain"
              initial={{ scale: 0.06, opacity: 0, filter: "blur(8px)" }}
              animate={{ scale: [0.06, 1.12, 1], opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 1.0, delay: 0.3, ease: [0.22, 1, 0.36, 1] }} />

            {/* wordmark resolving */}
            <motion.div className="mt-3 text-2xl font-extrabold tracking-tight text-g-word"
              initial={{ opacity: 0, y: 8, letterSpacing: "0.35em" }}
              animate={{ opacity: 1, y: 0, letterSpacing: "0em" }}
              transition={{ duration: 0.7, delay: 0.85, ease: "easeOut" }}>
              Guileo
            </motion.div>

            {/* growing line */}
            <motion.div className="mt-4 h-[2px] rounded-full bg-gradient-to-r from-g-green to-g-gold"
              initial={{ width: 0, opacity: 0 }} animate={{ width: 120, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }} />
          </div>

          <button onClick={skip} className="absolute bottom-6 right-6 text-xs font-semibold text-g-muted hover:text-g-word transition">skip →</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
