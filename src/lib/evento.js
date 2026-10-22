// evento(nome, meta) — o rastreador de primeira mão da landing (2026-09-10).
// sendBeacon: não segura a página, sobrevive ao fechar da aba. Falha em silêncio de propósito
// (medir nunca pode derrubar a página) — a PROVA de que grava é o curl no /api/evento, não este código.
export function evento(nome, meta = {}) {
  try {
    const lang = (() => { try { return localStorage.getItem("guileo_lang") || ""; } catch { return ""; } })();
    const corpo = JSON.stringify({ nome, meta, caminho: location.pathname, lang });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/evento", new Blob([corpo], { type: "application/json" }));
    else fetch("/api/evento", { method: "POST", headers: { "Content-Type": "application/json" }, body: corpo, keepalive: true }).catch(() => {});
  } catch { /* medir nunca derruba a página */ }
}

// OUVIR O WIDGET DA GUI: o shadow root é aberto, então um clique dentro dele chega ao `document`
// com `composedPath()` contendo o botão. É assim que sabemos "iniciou chamada" / "mandou mensagem"
// sem depender de API da ElevenLabs. Instala uma vez.
let ouvindo = false;
export function ouvirGui() {
  if (ouvindo || typeof document === "undefined") return; ouvindo = true;
  document.addEventListener("click", (e) => {
    const w = document.querySelector("elevenlabs-convai"); if (!w) return;
    const path = e.composedPath ? e.composedPath() : [];
    if (!path.includes(w)) return;
    const btn = path.find((el) => el && el.tagName === "BUTTON"); if (!btn) return;
    const t = ((btn.getAttribute("aria-label") || "") + " " + (btn.textContent || "")).toLowerCase();
    if (/start a call|call|ligar|llamar/.test(t) && !/end|encerrar|terminar/.test(t)) evento("gui_chamada");
    else if (/^send$|enviar|send message/.test(t.trim())) evento("gui_mensagem");
    else if (/message|mensagem|mensaje|expand/.test(t)) evento("gui_aberta", { via: "balao" });
  }, true);
}
