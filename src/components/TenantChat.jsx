import { useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TenantChat — o CHAT DE TEXTO com a agente DO CLIENTE, dentro do painel do site dele
// (GuiLayer, aba "Chat" quando `cliente`). 2026-09-30.
//
// POR QUE EXISTE: o painel só tinha o GuiChat, que é o concierge de vendas DA GUILEO. No site
// da Natura isso era a nossa vendedora atendendo o cliente do spa como se fosse a Lilian. Este
// componente fala com /api/widget-chat, que responde com a MESMA agente que atende o telefone
// (guiReply → agente ElevenLabs do tenant; Anthropic de reserva), com o cardápio e os preços dele.
//
// O TENANT VAI PELO `slug` DO SITE PUBLICADO, não pelo e-mail: o servidor resolve
// (client_site_owner). Assim o e-mail do dono não fica escrito no JavaScript da página.
//
// HONESTIDADE: a saudação é local e NÃO usa nome de agente (o navegador não sabe o nome); quando
// o cérebro falha o servidor devolve a frase honesta com o telefone, e ela aparece como veio.
// ─────────────────────────────────────────────────────────────────────────────

const UI = {
  en: { oi: (b) => `Hi! Ask anything about ${b} — services, prices or booking.`, ph: "Write your message", send: "Send", rot: "Message", typing: "Writing…", erro: (p) => `That didn't go through. Try again${p ? `, or call ${p}` : ""}.`, limite: "This chat reached its limit for today. Please call us." },
  pt: { oi: (b) => `Oi! Pergunte o que quiser sobre ${b} — serviços, preços ou agendamento.`, ph: "Escreva sua mensagem", send: "Enviar", rot: "Mensagem", typing: "Escrevendo…", erro: (p) => `Não foi. Tente de novo${p ? `, ou ligue ${p}` : ""}.`, limite: "Este chat chegou ao limite de hoje. Ligue pra gente." },
  es: { oi: (b) => `¡Hola! Pregunte lo que quiera sobre ${b} — servicios, precios o reservas.`, ph: "Escriba su mensaje", send: "Enviar", rot: "Mensaje", typing: "Escribiendo…", erro: (p) => `No se envió. Intente de nuevo${p ? `, o llame al ${p}` : ""}.`, limite: "Este chat llegó a su límite de hoy. Llámenos." },
};

// Um id por visita. Fica no sessionStorage para a conversa continuar se o painel fechar e abrir;
// se o navegador bloquear o storage, vale só enquanto o componente estiver montado.
function sessaoDoVisitante(slug) {
  const k = `gui:chat:${slug}`;
  try { const v = sessionStorage.getItem(k); if (v) return v; } catch { /* sem storage */ }
  const id = `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  try { sessionStorage.setItem(k, id); } catch { /* sem storage */ }
  return id;
}

export default function TenantChat({ slug, business = "", accent = "#3E9468", phone = "", lang = "en" }) {
  const L = UI[lang] || UI.en;
  const [thread, setThread] = useState([]);           // só o que foi DITO: [{role:'user'|'gui', text}]
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState("");
  const sess = useRef("");
  const fim = useRef(null);
  useEffect(() => { sess.current = sessaoDoVisitante(slug); }, [slug]);
  useEffect(() => { fim.current?.scrollIntoView({ block: "end" }); }, [thread, busy]);

  const enviar = async (e) => {
    e.preventDefault();
    const texto = q.trim();
    if (!texto || busy) return;
    const antes = thread;
    setThread([...antes, { role: "user", text: texto }]);
    setQ(""); setBusy(true); setAviso("");
    try {
      const r = await fetch("/api/widget-chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, sessionId: sess.current, message: texto, lang, history: antes.slice(-6), start: antes.length === 0 }),
      });
      const d = await r.json().catch(() => null);
      // A resposta é lida do CORPO. 429 do limite por sessão tem texto próprio; o resto é erro de envio.
      if (d && d.ok && d.answer) setThread((t) => [...t, { role: "gui", text: String(d.answer) }]);
      else { setThread(antes); setQ(texto); setAviso(r.status === 429 ? L.limite : L.erro(phone)); }
    } catch { setThread(antes); setQ(texto); setAviso(L.erro(phone)); }
    setBusy(false);
  };

  return (
    <div className="flex flex-col">
      <div className="max-h-[260px] min-h-[120px] space-y-2 overflow-y-auto pr-1" aria-live="polite">
        <p className="rounded-2xl rounded-tl-sm bg-white/[0.07] px-3 py-2 text-[12.5px] leading-snug text-white/85">{L.oi(business || "us")}</p>
        {thread.map((m, i) => (
          <p key={i} className={`whitespace-pre-wrap rounded-2xl px-3 py-2 text-[12.5px] leading-snug ${m.role === "user" ? "ml-8 rounded-tr-sm text-[#1a1206]" : "mr-4 rounded-tl-sm bg-white/[0.07] text-white/85"}`}
            style={m.role === "user" ? { background: accent } : undefined}>{m.text}</p>
        ))}
        {busy && <p className="mr-4 rounded-2xl rounded-tl-sm bg-white/[0.07] px-3 py-2 text-[12px] text-white/50">{L.typing}</p>}
        <div ref={fim} />
      </div>
      {aviso && <p role="alert" className="mt-2 text-[11.5px] font-bold" style={{ color: "#F08A6B" }}>{aviso}</p>}
      <form onSubmit={enviar} className="mt-2.5 flex gap-2">
        <label htmlFor={`tc-${slug}`} className="sr-only">{L.rot}</label>
        <input id={`tc-${slug}`} value={q} onChange={(e) => setQ(e.target.value)} maxLength={600} autoComplete="off" placeholder={L.ph}
          className="min-w-0 flex-1 rounded-full border border-white/15 bg-black/25 px-3.5 py-2 text-[13px] text-white placeholder-white/35 outline-none focus:border-white/40" />
        <button type="submit" disabled={busy || !q.trim()} className="rounded-full px-4 py-2 text-[12.5px] font-black transition disabled:opacity-50"
          style={{ background: accent, color: "#1a1206" }}>{L.send}</button>
      </form>
    </div>
  );
}
