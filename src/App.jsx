import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { LangProvider } from "./i18n.jsx";
import Home from "./pages/Home"; // the ORIGINAL guileoai.com landing serves "/"

// ── Partner referral attribution ──────────────────────────────────────────────
// Any visit with ?ref=NAME (a Growth Partner's personal link) is remembered for 90
// days, and every lead this browser ever submits carries it — so Track-A (self-
// service) commissions are attributable. One fetch wrapper covers every lead form,
// current and future, without touching each call site.
function useReferralAttribution() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) localStorage.setItem("guileo_ref", JSON.stringify({ ref: ref.slice(0, 40), at: Date.now() }));
    } catch { /* private mode */ }
    const orig = window.fetch;
    window.fetch = (url, opts) => {
      try {
        if (typeof url === "string" && url.includes("/api/lead") && opts?.body && typeof opts.body === "string") {
          const saved = JSON.parse(localStorage.getItem("guileo_ref") || "null");
          if (saved?.ref && Date.now() - saved.at < 90 * 864e5) {
            const b = JSON.parse(opts.body);
            if (!b.ref) { b.ref = saved.ref; opts = { ...opts, body: JSON.stringify(b) }; }
          }
        }
      } catch { /* never break a lead submit */ }
      return orig(url, opts);
    };
    return () => { window.fetch = orig; };
  }, []);
}

const Servicos = lazy(() => import("./pages/Servicos"));
const Portal = lazy(() => import("./pages/Portal"));
const Contratos = lazy(() => import("./pages/Contratos"));
const LiveActivity = lazy(() => import("./pages/LiveActivity"));
const Quiz = lazy(() => import("./pages/Quiz"));
const Calculator = lazy(() => import("./pages/Calculator"));
const Partners = lazy(() => import("./pages/Partners"));
const LeadsInbox = lazy(() => import("./pages/LeadsInbox"));
const LandingV2 = lazy(() => import("./pages/LandingV2")); // backup of the rebuilt landing
const Admin = lazy(() => import("./pages/Admin")); // Luis's private command center
const Marketing = lazy(() => import("./pages/Marketing")); // Guileo AD — dedicated growth/marketing page
const Pitch = lazy(() => import("./pages/Pitch")); // ≤20-min client presentation deck (Growth Partner tool)
const Proposta = lazy(() => import("./pages/Proposta")); // tailored proposal → payment (close-to-cash)
const Parceiro = lazy(() => import("./pages/Parceiro")); // Growth Partner recruiting deck
const Academia = lazy(() => import("./pages/Academia")); // Partner Academy — the collaborator operating manual (training + roleplay)
const Cola = lazy(() => import("./pages/Cola")); // partner pocket card — open 2 min before a meeting
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const WebsiteGrader = lazy(() => import("./pages/WebsiteGrader")); // lead magnet: website audit → lead

export default function App() {
  useReferralAttribution();
  return (
    <LangProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="min-h-screen grid place-items-center text-g-muted">…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/servicos" element={<Servicos />} />
            <Route path="/portal" element={<Portal />} />
            <Route path="/live" element={<LiveActivity />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/calculator" element={<Calculator />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/grader" element={<WebsiteGrader />} />
            <Route path="/leads" element={<LeadsInbox />} />
            <Route path="/v2" element={<LandingV2 />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/marketing" element={<Marketing />} />
            <Route path="/pitch" element={<Pitch />} />
            <Route path="/proposta" element={<Proposta />} />
            <Route path="/parceiro" element={<Parceiro />} />
            <Route path="/academia" element={<Academia />} />
            <Route path="/cola" element={<Cola />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/admin/contratos" element={<Contratos />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </LangProvider>
  );
}
