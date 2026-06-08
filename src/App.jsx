import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { LangProvider } from "./i18n.jsx";
import LandingV2 from "./pages/LandingV2"; // the approved landing now serves "/"

const Servicos = lazy(() => import("./pages/Servicos"));
const Portal = lazy(() => import("./pages/Portal"));
const Contratos = lazy(() => import("./pages/Contratos"));
const LiveActivity = lazy(() => import("./pages/LiveActivity"));
const Quiz = lazy(() => import("./pages/Quiz"));

export default function App() {
  return (
    <LangProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="min-h-screen grid place-items-center text-g-muted">…</div>}>
          <Routes>
            <Route path="/" element={<LandingV2 />} />
            <Route path="/servicos" element={<Servicos />} />
            <Route path="/portal" element={<Portal />} />
            <Route path="/live" element={<LiveActivity />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/admin/contratos" element={<Contratos />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </LangProvider>
  );
}
