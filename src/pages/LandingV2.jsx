import Navbar from "../components/Navbar";
import HeroV2 from "../components/HeroV2";
import IndustriesV2 from "../components/IndustriesV2";
import MovementV2 from "../components/MovementV2";
import LegsV2 from "../components/LegsV2";
import BuildAllV2 from "../components/BuildAllV2";
import EngineV2 from "../components/EngineV2";

// /v2 — TEST surface for the new landing story (beat 1: realistic Hero).
// Production "/" is untouched. We review here, one beat at a time, then promote.
export default function LandingV2() {
  return (
    <div className="min-h-screen text-g-word">
      <Navbar />
      {/* tiny test marker so it's clear this is the preview surface */}
      <div className="px-5 pt-2">
        <div className="mx-auto max-w-6xl">
          <span className="inline-block rounded-full border border-g-line bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-g-muted">
            Test · /v2 · Hero (beat 1)
          </span>
        </div>
      </div>
      <HeroV2 />
      <IndustriesV2 />
      <MovementV2 />
      <LegsV2 />
      <BuildAllV2 />
      <EngineV2 />
    </div>
  );
}
