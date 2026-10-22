/* Split out of Portal.jsx (performance): Convos tab view — code moved verbatim. */
import { useState } from "react";
import { portalApi, toast } from "../lib/portalApi.js";
import { genConvos, tr, Card, EVENT_ICON, relTime, Empty } from "../pages/Portal.jsx";

function Convos({ V, title, real = null }) {
  // 🚨 TODOS OS HOOKS ANTES DE QUALQUER `return` (2026-09-28). O `if (real) return` ficava ENTRE
  // o primeiro useState e os outros dois. Recarregar em ?tab=whatsapp / ?tab=sms desenha primeiro
  // com real=null (3 hooks) e, quando os dados chegam, com real (1 hook): o React acusa "Rendered
  // fewer hooks than expected" e a tela inteira cai — justo na aba que a cliente deixou aberta.
  // A amostra só é gerada fora do modo real: conversa inventada não entra nem no estado.
  const list = real ? [] : (V.convos || genConvos(V));
  const [active, setActive] = useState(0);
  const [draft, setDraft] = useState("");
  const [threads, setThreads] = useState(() => Object.fromEntries(list.map((c, i) => [i, [
    { from: "them", text: c.last },
    { from: "ai", text: "Hi! Thanks for reaching out 😊 I can take care of that right now." },
    { from: "them", text: "Perfect, yes please." },
    { from: "ai", text: "All set ✅ Anything else I can help you with?" },
  ]])));
  // REAL MODE — every real conversation (calls + messages) your AI handled.
  if (real) {
    // Channel-scoped: the WhatsApp tab shows whatsapp threads, the SMS tab shows sms —
    // never the whole ledger in both. (title is "WhatsApp" | "SMS".)
    const want = String(title || "").toLowerCase();
    const chOk = (ch) => { const c = String(ch || "").toLowerCase(); return want === "whatsapp" ? (c.includes("whats") || c === "wa") : want === "sms" ? c.includes("sms") : true; };
    const conv = (real?.events || []).filter((e) => (e.type === "message" || e.type === "call") && chOk(e.channel));
    return (
      <div className="space-y-4 stagger">
        <div className="rounded-2xl border border-g-green/25 bg-gradient-to-br from-g-green/[0.07] to-white/[0.02] p-5">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-g-green"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — your real conversations")}</div>
          <div className="mt-1 text-xl font-black text-g-word">{conv.length} {tr(conv.length === 1 ? "conversation handled by AI" : "conversations handled by AI")}</div>
        </div>
        {conv.length ? (
          <Card className="p-0 overflow-hidden"><div className="divide-y divide-white/[0.05]">
            {conv.map((e, i) => (
              <div key={e.id || i} style={{ animationDelay: `${i * 50}ms` }} className="row-in flex items-center gap-3 px-5 py-3">
                <span className="text-base shrink-0">{EVENT_ICON[e.type] || "💬"}</span>
                <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{e.summary}</div><div className="text-[11px] text-g-muted">{e.channel || "—"} · {relTime(e.created_at)}</div></div>
              </div>
            ))}
          </div></Card>
        ) : <Card><Empty icon="💬" text={tr("No conversations yet — every WhatsApp, SMS and DM your AI handles shows up here.")} /></Card>}
      </div>
    );
  }
  // Daqui para baixo é só DEMONSTRAÇÃO (o modo real já saiu acima). Como o estado das conversas
  // nasce uma vez só, quem montou a aba em modo real e depois perdeu a chave vê a lista de amostra
  // com o fio vazio — nunca o contrário (amostra dentro de conta conectada).
  const send = (e) => { e.preventDefault(); if (!draft.trim()) return; portalApi.sendMessage(title, active, draft); setThreads((t) => ({ ...t, [active]: [...(t[active] || []), { from: "you", text: draft }] })); setDraft(""); toast(tr("Demo — reply added to this sample thread. Nothing was sent.")); };
  const c = list[active] || {};
  return (
    <div className="grid lg:grid-cols-3 gap-4 lg:h-[34rem]">
      <Card className="p-0 overflow-hidden lg:col-span-1 flex flex-col">
        <div className="px-4 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold shrink-0">{title} · {list.length} chats</div>
        <div className="divide-y divide-white/[0.06] overflow-y-auto">
          {list.map((cc, i) => (
            <button key={i} onClick={() => setActive(i)} className={`w-full text-left flex items-center gap-3 px-4 py-3 transition ${i === active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}>
              <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-sm font-bold text-g-word shrink-0">{(cc.name || "?")[0]}</span>
              <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{cc.name}</div><div className="text-[11px] text-g-muted truncate">{cc.last}</div></div>
              <div className="text-right shrink-0"><div className="text-[10px] text-g-muted">{cc.t}</div>{cc.unread > 0 && <span className="inline-grid place-items-center h-4 min-w-4 px-1 rounded-full bg-g-green text-[10px] font-bold text-black mt-0.5">{cc.unread}</span>}</div>
            </button>
          ))}
          {list.length === 0 && <Empty icon="💬" text={tr("No conversations yet — they'll show up here as customers message you.")} />}
        </div>
      </Card>
      <Card className="p-0 overflow-hidden lg:col-span-2 flex flex-col">
        <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2 shrink-0"><span className="grid place-items-center h-8 w-8 rounded-full bg-white/[0.06] text-xs font-bold text-g-word">{(c.name || "?")[0]}</span><div className="text-sm font-bold text-g-word">{c.name}</div><span className="ml-auto text-[10px] font-bold uppercase text-g-green inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("AI active")}</span></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[15rem]">
          {(threads[active] || []).map((m, i) => (
            <div key={i} className={`flex ${m.from === "them" ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${m.from === "them" ? "bg-white/[0.06] text-g-word" : m.from === "ai" ? "bg-[#FF8A33]/10 text-g-light border border-[#FF8A33]/30" : "bg-g-gold/15 text-g-word border border-g-gold/30"}`}>
                {m.from === "ai" && <div className="text-[9px] font-black uppercase mb-0.5" style={{ color: "#FF8A33" }}>Guileo AI</div>}
                {m.from === "you" && <div className="text-[9px] font-black uppercase text-g-gold mb-0.5">{tr("You")}</div>}
                {m.text}
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="p-3 border-t border-white/10 flex gap-2 shrink-0">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={tr("Reply")} placeholder={tr("Jump in and reply…")} className="flex-1 rounded-full border border-white/15 bg-black/20 px-4 py-2.5 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
          <button className="btn-bright text-sm px-5">{tr("Send")}</button>
        </form>
      </Card>
    </div>
  );
}

export default Convos;
