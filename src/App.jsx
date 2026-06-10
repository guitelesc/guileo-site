import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { LangProvider } from "./i18n.jsx";
import Home from "./pages/Home"; // the ORIGINAL guileoai.com landing serves "/"

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
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const WebsiteGrader = lazy(() => import("./pages/WebsiteGrader")); // lead magnet: website audit → lead

export default function App() {
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
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/admin/contratos" element={<Contratos />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </LangProvider>
  );
}
