import Navbar from "../components/Navbar";
import HeroV2 from "../components/HeroV2";
import ResultsV2 from "../components/ResultsV2";
import LegsV2 from "../components/LegsV2";
import BuildAllV2 from "../components/BuildAllV2";
import EngineV2 from "../components/EngineV2";
import ChannelsV2 from "../components/ChannelsV2";
import MethodV2 from "../components/MethodV2";
import GrowthV2 from "../components/GrowthV2";
import ProofV2 from "../components/ProofV2";
import LeadCaptureV2 from "../components/LeadCaptureV2";

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
      <ResultsV2 />
      <LegsV2 />
      <BuildAllV2 />
      <EngineV2 />
      <ChannelsV2 />
      <MethodV2 />
      <GrowthV2 />
      <ProofV2 />
      <LeadCaptureV2 />
    </div>
  );
}
