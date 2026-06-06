import { useEffect } from "react";
// The live "Gui" ElevenLabs Conversational AI agent (web widget on the page).
// Same agent that powers the phone calls — one voice everywhere.
export const ELEVEN_AGENT_ID = "agent_5901ktdkev68f5kb161fmeax1rdm";
export default function VoiceAgent() {
  useEffect(() => {
    if (document.getElementById("11labs-convai-script")) return;
    const s = document.createElement("script");
    s.id = "11labs-convai-script";
    s.src = "https://unpkg.com/@elevenlabs/convai-widget-embed";
    s.async = true;
    s.type = "text/javascript";
    document.body.appendChild(s);
  }, []);
  return <elevenlabs-convai agent-id={ELEVEN_AGENT_ID}></elevenlabs-convai>;
}
