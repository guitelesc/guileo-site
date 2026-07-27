// Gui lives in OUR own surfaces now. The old third-party ElevenLabs <convai> web widget
// was removed (off-brand white box + broke under our strict CSP on mobile). This mount
// point — already present on ~17 marketing pages — now renders our OWN on-brand concierge
// chat (GuiChat). The phone agent still runs on ElevenLabs server-side (functions/api/call.js).
import GuiChat from "./GuiChat.jsx";
export const ELEVEN_AGENT_ID = "agent_5901ktdkev68f5kb161fmeax1rdm"; // still powers the phone agent
export default function VoiceAgent() {
  return <GuiChat />;
}
