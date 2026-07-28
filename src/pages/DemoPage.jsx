// PUBLIC VITRINE PAGE — /vitrine/:token?
// Lightweight host for <DemoEngine surface="public" />. When a :token is present
// (a shared demo link produced by action:"save"), DemoEngine preloads that brand
// via action:"get" so the client reopens their own personalized demo.
//
// NOTE: the share link is /vitrine/:token (not /demo/:token) because /demo/:slug is
// already taken by the seller "Gui calls you" page (DemoLink.jsx). Kept separate so
// nothing existing breaks.
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import DemoEngine from "../components/DemoEngine.jsx";
import { useSeo } from "../lib/seo.js";

export default function DemoPage() {
  const { token } = useParams();
  useSeo({ title: "Guileo · your personalized demo", description: "See any Guileo product rendered in your own brand — website assistant, app, social, voice, ads, SEO and email.", path: `/vitrine/${token || ""}` });
  return (
    <div className="surface-real min-h-screen text-g-ink">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <DemoEngine surface="public" presetToken={token || null} />
      </main>
      <Footer />
    </div>
  );
}
