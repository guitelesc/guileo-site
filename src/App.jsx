import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { LangProvider } from "./i18n.jsx";
import { trackPageView } from "./lib/analytics.js";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

// Auto-recover from a transient chunk-import failure. Two real failure modes right after a deploy:
//   1) the apex/alias edge hasn't cached a fresh lazy chunk yet, so the FIRST import() 404s for a few
//      seconds even though the deployment already serves it 200; and
//   2) a browser holding a cached index.html requests an old chunk hash that no longer resolves.
// We handle BOTH without ever flashing the ErrorBoundary during the deploy window:
//   • First, retry the SAME import a few times with backoff — a not-yet-propagated chunk succeeds on
//     the 2nd/3rd try once the edge warms, with no page reload and no lost scroll/state.
//   • Only if every retry fails do we hard-reload once (sessionStorage-guarded, so we never loop) to
//     pull a fresh index + chunk hashes for the stale-html case.
//   • If that reloaded page ALSO can't load the chunk, we finally throw to the ErrorBoundary.
const _sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function lazyRetry(factory, retries = 4, baseDelay = 400) {
  return lazy(async () => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await factory();
      } catch (err) {
        // Out of in-place retries → PROPAGATION-WINDOW recovery. After a fresh deploy the apex edge can
        // 404 the new lazy chunk for a couple minutes; a single reload often fires before the edge has
        // it. So reload up to 4× (time-boxed to a 2-min incident, ~1.5s apart) — enough to ride out the
        // window — then, only if it STILL fails, surface the error. The cap makes an infinite loop
        // impossible if the chunk is genuinely gone (a real bug, not propagation).
        if (attempt === retries) {
          try {
            const key = "guileo_chunk_reload";
            const prev = JSON.parse(sessionStorage.getItem(key) || '{"n":0,"t":0}');
            const now = Date.now();
            const n = (now - prev.t < 120000) ? prev.n : 0; // reset the counter for a new incident
            if (n < 4) {
              sessionStorage.setItem(key, JSON.stringify({ n: n + 1, t: now }));
              await _sleep(1500); // give the edge a beat to propagate before reloading
              window.location.reload();
              return await new Promise(() => {}); // hang until the reload takes over
            }
          } catch { /* sessionStorage blocked — fall through to the real error */ }
          throw err;
        }
        // Exponential-ish backoff: 400ms, 800ms, 1600ms, 3200ms — enough for the edge to cache the chunk.
        await _sleep(baseDelay * Math.pow(2, attempt));
      }
    }
  });
}
const Home = lazyRetry(() => import("./pages/Home")); // the ORIGINAL guileoai.com landing serves "/" — lazy so framer-motion + V2 sections stay out of the global chunk
const NotFound = lazyRetry(() => import("./pages/NotFound"));

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

const Servicos = lazyRetry(() => import("./pages/Servicos"));
// /heroi — página de DECISÃO do herói (duas direções com a logo 3D real). Rota nova de propósito:
// rota que não existia não pode quebrar o que está no ar. Some quando a direção for escolhida.
const HeroiEscolha = lazyRetry(() => import("./pages/HeroiEscolha"));
const VozWeb = lazyRetry(() => import("./pages/VozWeb")); // /voz/:slug — a Gui atendendo por VOZ no navegador
const ClientSite = lazyRetry(() => import("./pages/ClientSite")); // /site/:slug — o site REAL do cliente (produto foundation)
const PrimeiraSemana = lazyRetry(() => import("./pages/PrimeiraSemana")); // o que o cliente recebe DE VERDADE na 1a semana (material do vendedor)
const Portal = lazyRetry(() => import("./pages/Portal"));
const Contratos = lazyRetry(() => import("./pages/Contratos"));
const LiveActivity = lazyRetry(() => import("./pages/LiveActivity"));
const Quiz = lazyRetry(() => import("./pages/Quiz"));
const Calculator = lazyRetry(() => import("./pages/Calculator"));
const Partners = lazyRetry(() => import("./pages/Partners"));
const CampaignLP = lazyRetry(() => import("./pages/CampaignLP")); // paid-traffic LPs (/lp/:slug), noindex
const LeadsInbox = lazyRetry(() => import("./pages/LeadsInbox"));
const LandingV2 = lazyRetry(() => import("./pages/LandingV2")); // backup of the rebuilt landing
const Admin = lazyRetry(() => import("./pages/Admin")); // Luis's private command center
const Marketing = lazyRetry(() => import("./pages/Marketing")); // Guileo AD — dedicated growth/marketing page
const Pitch = lazyRetry(() => import("./pages/Pitch")); // ≤20-min client presentation deck (Growth Partner tool)
const Proposta = lazyRetry(() => import("./pages/Proposta")); // tailored proposal → payment (close-to-cash)
const Parceiro = lazyRetry(() => import("./pages/Parceiro")); // Growth Partner recruiting deck
const Academia = lazyRetry(() => import("./pages/Academia")); // Partner Academy — the collaborator operating manual (training + roleplay)
const Cola = lazyRetry(() => import("./pages/Cola")); // partner pocket card — open 2 min before a meeting
const Roteiro = lazyRetry(() => import("./pages/Roteiro")); // 2-min live-demo script — partner reads it before/during the meeting
const Prospects = lazyRetry(() => import("./pages/Prospects")); // first-sales kit — 10 best prospect types + cold-approach message + 3-step path
const Deck = lazyRetry(() => import("./pages/Deck")); // collaborator sales deck — navigable web presentation
const Vendedor = lazyRetry(() => import("./pages/Vendedor")); // logged-in seller hub — playbook + pitch cards (lib+AI) + quote generator + support
const Equipe = lazyRetry(() => import("./pages/Equipe")); // internal team hub — 🛠 tech support queue + 📊 marketing/ads performance
const ConectarPagamento = lazyRetry(() => import("./pages/ConectarPagamento")); // client connects their own Stripe → Gui charges land in THEIR account
const Kit = lazyRetry(() => import("./pages/Kit")); // print-optimized per-niche field kit one-pager (built from pitch-card data)
const Planos = lazyRetry(() => import("./pages/Planos"));
const Pulse = lazyRetry(() => import("./pages/Pulse")); // /pulse — a casa do produto de $49 (o conteúdo cortado da landing vive lá, sem cópia) // self-service Track-A plans (Stripe subscribe → auto-activate)
const HomeServices = lazyRetry(() => import("./pages/HomeServices")); // niche landing — the easiest-to-close vertical
const NossaGente = lazyRetry(() => import("./pages/NossaGente")); // BLUE OCEAN — bilingual/immigrant + Brazil positioning
const Compliance = lazyRetry(() => import("./pages/Compliance")); // the moat — TCPA/A2P compliance done-for-you
const HealthCompliance = lazyRetry(() => import("./pages/HealthCompliance")); // HIPAA posture — sell clinics honestly
const Privacy = lazyRetry(() => import("./pages/Privacy"));
// /sms — prova pública de opt-in para o revisor da campanha A2P 10DLC (erro 30909)
const SmsOptIn = lazyRetry(() => import("./pages/SmsOptIn"));
const Terms = lazyRetry(() => import("./pages/Terms"));
const Refunds = lazyRetry(() => import("./pages/Refunds")); // refund/cancellation policy (paid product)
const Contact = lazyRetry(() => import("./pages/Contact")); // contact / imprint (LGPD/GDPR/CCPA)
const WebsiteGrader = lazyRetry(() => import("./pages/WebsiteGrader")); // lead magnet: website audit → lead
const Consulting = lazyRetry(() => import("./pages/Consulting")); // 360° advisory — free strategy call as lead-gen front door
const Vertical = lazyRetry(() => import("./pages/Vertical")); // data-driven SEO landings per niche (/for/:slug)
const GoLive = lazyRetry(() => import("./pages/GoLive")); // guided onboarding wizard — activate a new client's Gui
const Blog = lazyRetry(() => import("./pages/Blog")); // SEO blog index
const BlogPost = lazyRetry(() => import("./pages/BlogPost")); // SEO blog article (/blog/:slug)
const GeoCity = lazyRetry(() => import("./pages/GeoCity")); // local SEO landings per city (/ai-receptionist/:city)
const VerticalCity = lazyRetry(() => import("./pages/VerticalCity")); // niche × city combo landings (/for/:vertical/:city)
const LeadGeneration = lazyRetry(() => import("./pages/LeadGeneration")); // lead-gen pillar hub (/lead-generation)
const SetupAgenda = lazyRetry(() => import("./pages/SetupAgenda")); // admin onboarding for the scheduling engine
const Sign = lazyRetry(() => import("./pages/Sign")); // public contract e-signature page (/sign?t=token)
const DemoLink = lazyRetry(() => import("./pages/DemoLink")); // seller's personalized demo link (/demo/:slug?n=&v=&s=) — Gui calls the prospect already knowing their business
const DemoPage = lazyRetry(() => import("./pages/DemoPage")); // public "vitrine" — any product rendered in the client's brand (/vitrine/:token?)

// Privacy-first visit beacon → /api/hit (page + referrer host + lang only; no cookies,
// no IDs). Fires once per pageload + on SPA route changes via history patching.
function useVisitBeacon() {
  useEffect(() => {
    const hit = () => {
      try {
        const payload = JSON.stringify({ page: location.pathname, ref: document.referrer || "", lang: localStorage.getItem("guileo_lang") || "" });
        navigator.sendBeacon?.("/api/hit", new Blob([payload], { type: "application/json" })) ||
          fetch("/api/hit", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true });
      } catch { /* analytics must never break the site */ }
    };
    hit();
    const orig = history.pushState.bind(history);
    history.pushState = (...a) => { orig(...a); hit(); };
    window.addEventListener("popstate", hit);
    return () => { history.pushState = orig; window.removeEventListener("popstate", hit); };
  }, []);
}

// Ad-pixel page view on every SPA navigation. Mounted inside <BrowserRouter>
// so it can read the current location. No-ops until pixel IDs are configured
// in src/lib/analytics.js.
function AnalyticsRouteListener() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);
  return null;
}

export default function App() {
  useReferralAttribution();
  useVisitBeacon();
  return (
    <ErrorBoundary>
    <LangProvider>
      <BrowserRouter>
        <AnalyticsRouteListener />
        {/* WCAG 2.4.1 skip-to-content — first focusable element; visually hidden until keyboard-focused. */}
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-black focus:font-bold focus:shadow-lg">Skip to content</a>
        <main id="main" tabIndex={-1}>
        <Suspense fallback={<div className="min-h-screen grid place-items-center text-g-muted">…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/servicos" element={<Servicos />} />
            <Route path="/heroi" element={<HeroiEscolha />} />
            <Route path="/site/:slug" element={<ClientSite />} />
            <Route path="/voz/:slug" element={<VozWeb />} />
            <Route path="/primeira-semana" element={<PrimeiraSemana />} />
            <Route path="/portal" element={<Portal />} />
            <Route path="/live" element={<LiveActivity />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/calculator" element={<Calculator />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/lp/:slug" element={<CampaignLP />} />
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
            <Route path="/roteiro" element={<Roteiro />} />
            <Route path="/prospects" element={<Prospects />} />
            <Route path="/prospeccao" element={<Navigate to="/prospects" replace />} />
            <Route path="/deck" element={<Deck />} />
            <Route path="/vendedor" element={<Vendedor />} />
            {/* Hub interno da equipe — /tecnico e /marketing abrem a mesma página na aba certa */}
            <Route path="/equipe" element={<Equipe />} />
            <Route path="/tecnico" element={<Equipe />} />
            {/* FIX #6 (revisor 2026-07-31): /marketing JÁ é a página pública (linha ~183). A rota
                duplicada nunca ganhava o empate no react-router, então o alias do hub era letra morta.
                O hub interno de marketing vive em /marketing-hub. */}
            <Route path="/marketing-hub" element={<Equipe />} />
            <Route path="/receber" element={<ConectarPagamento />} />
            <Route path="/get-paid" element={<Navigate to="/receber" replace />} />
            <Route path="/conectar-stripe" element={<Navigate to="/receber" replace />} />
            <Route path="/seller" element={<Navigate to="/vendedor" replace />} />
            <Route path="/colaborador" element={<Navigate to="/vendedor" replace />} />
            <Route path="/kit" element={<Kit />} />
            <Route path="/kit/:niche" element={<Kit />} />
            <Route path="/planos" element={<Planos />} />
            <Route path="/pulse" element={<Pulse />} />
            <Route path="/plans" element={<Navigate to="/planos" replace />} />
            <Route path="/precos" element={<Navigate to="/planos" replace />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/sms" element={<SmsOptIn />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/refunds" element={<Refunds />} />
            <Route path="/cancellation" element={<Refunds />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/cookies" element={<Privacy />} />
            <Route path="/admin/contratos" element={<Contratos />} />
            <Route path="/home-services" element={<HomeServices />} />
            <Route path="/nossa-gente" element={<NossaGente />} />
            <Route path="/compliance" element={<Compliance />} />
            <Route path="/health-compliance" element={<HealthCompliance />} />
            <Route path="/hipaa" element={<HealthCompliance />} />
            <Route path="/consulting" element={<Consulting />} />
            <Route path="/consultoria" element={<Navigate to="/consulting" replace />} />
            <Route path="/for/:slug" element={<Vertical />} />
            <Route path="/for/:vertical/:city" element={<VerticalCity />} />
            <Route path="/go-live" element={<GoLive />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogPost />} />
            <Route path="/ai-receptionist/:city" element={<GeoCity />} />
            <Route path="/lead-generation" element={<LeadGeneration />} />
            <Route path="/lead-generation/:city" element={<GeoCity intent="leadgen" />} />
            <Route path="/setup-agenda" element={<SetupAgenda />} />
            <Route path="/sign" element={<Sign />} />
            <Route path="/demo/:slug" element={<DemoLink />} />
            <Route path="/vitrine" element={<DemoPage />} />
            <Route path="/vitrine/:token" element={<DemoPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        </main>
        {/* ConsentBanner removido a pedido do Luis (2026-07-28) */}
    </BrowserRouter>
    </LangProvider>
    </ErrorBoundary>
  );
}
