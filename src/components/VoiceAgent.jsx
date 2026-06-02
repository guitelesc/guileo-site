import { useEffect } from "react";
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
  return <elevenlabs-convai agent-id="agent_1601kj8mxrwhereb1j28tbhzhs6p"></elevenlabs-convai>;
}
