import Navbar from "../components/Navbar";
import HeroV2 from "../components/HeroV2";
import ResultsV2 from "../components/ResultsV2";
import LegsV2 from "../components/LegsV2";
import BuildAllV2 from "../components/BuildAllV2";
import EngineV2 from "../components/EngineV2";
import ChannelsV2 from "../components/ChannelsV2";
import MethodV2 from "../components/MethodV2";
import GrowthV2 from "../components/GrowthV2";
import PulseSection from "../components/PulseSection";
import ProofV2 from "../components/ProofV2";
import LeadCaptureV2 from "../components/LeadCaptureV2";
import Footer from "../components/Footer";
import VoiceAgent from "../components/VoiceAgent";

// /v2 — the new landing. Single consistent cement base; story: hook → your industry →
// what we are → what we build → marketing engine → every channel → method → result → trust → close.
export default function LandingV2() {
  return (
    <div className="min-h-screen text-g-word">
      <Navbar />
      <HeroV2 />
      <ResultsV2 />
      <LegsV2 />
      <BuildAllV2 />
      <EngineV2 />
      <ChannelsV2 />
      <MethodV2 />
      <GrowthV2 />
      <PulseSection />
      <ProofV2 />
      <LeadCaptureV2 />
      <Footer />
      <VoiceAgent />
    </div>
  );
}
