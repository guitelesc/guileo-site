import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { LangProvider } from "./i18n.jsx";
import Home from "./pages/Home"; // the ORIGINAL guileoai.com landing serves "/"

const Servicos = lazy(() => import("./pages/Servicos"));
const Portal = lazy(() => import("./pages/Portal"));
const Contratos = lazy(() => import("./pages/Contratos"));
const LiveActivity = lazy(() => import("./pages/LiveActivity"));
const Quiz = lazy(() => import("./pages/Quiz"));
const LandingV2 = lazy(() => import("./pages/LandingV2")); // backup of the rebuilt landing
const Admin = lazy(() => import("./pages/Admin")); // Luis's private command center

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
            <Route path="/v2" element={<LandingV2 />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/contratos" element={<Contratos />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </LangProvider>
  );
}
