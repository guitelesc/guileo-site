import { useEffect, useState } from "react";
import { useLang } from "../i18n.jsx";

// Small, additive mobile-only sticky CTA. Appears after the user scrolls past the
// hero (~1 viewport) and scrolls them to the lead-capture form (#contact). Slim bar,
// safe-area padding so it never sits under the iOS home indicator. No new colors —
// reuses the existing .btn-bright button styling.
export default function StickyCtaMobile() {
  const { lang } = useLang();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.9);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const label = lang === "pt" ? "📞 Deixe a Gui te ligar"
    : lang === "es" ? "📞 Deja que Gui te llame"
    : lang === "hi" ? "📞 Gui से कॉल करवाएँ"
    : "📞 Get Gui to call me";

  const go = (e) => {
    e.preventDefault();
    // "#try" = the LiveCall demo (Gui actually CALLS you) — the label promises a call, so land
    // on the section that dials, not the generic contact form. Fallback: contact.
    (document.getElementById("try") || document.getElementById("contact"))?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      aria-hidden={!show}
      className={`sm:hidden fixed inset-x-0 bottom-0 z-40 px-3 pt-2.5 transition-transform duration-300 ${show ? "translate-y-0" : "translate-y-full pointer-events-none"}`}
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)", background: "linear-gradient(to top, rgba(22,21,18,0.96), rgba(22,21,18,0))" }}
    >
      <a href="#try" onClick={go} tabIndex={show ? 0 : -1} className="btn-bright flex w-full items-center justify-center min-h-[48px] text-base">
        {label}
      </a>
    </div>
  );
}
