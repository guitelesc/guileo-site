import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { LangProvider } from "./i18n.jsx";
import Home from "./pages/Home";

const Servicos = lazy(() => import("./pages/Servicos"));
const Portal = lazy(() => import("./pages/Portal"));
const Contratos = lazy(() => import("./pages/Contratos"));
const LiveActivity = lazy(() => import("./pages/LiveActivity"));

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
            <Route path="/admin/contratos" element={<Contratos />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </LangProvider>
  );
}
