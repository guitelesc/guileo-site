/* 🚨 SUPORTE — a PRIMEIRA LINHA do cliente, dentro do hub do vendedor.
   Regra do Luis: o atendimento inicial é do vendedor. Ele assinou o cliente, ele atende.
   Aqui ele vê os chamados abertos dos clientes DELE (escopo garantido no SQL pelo e-mail
   autenticado — nunca o cliente de outro vendedor), responde na hora, e ESCALA pro time
   técnico o que for problema de plataforma (bug/integração/backend). Urgente primeiro,
   mais antigo primeiro: nada envelhece sem alguém olhar.
   Sem chamado = tela verde honesta, não uma fila fake. */
import { useState, useEffect } from "react";

const TXT = {
  pt: {
    title: "Suporte — seus clientes", sub: "Você é a primeira linha. Responda, resolva, e o que for técnico manda pro time de plataforma.",
    empty: "Nenhum chamado aberto dos seus clientes. Quando um abrir, aparece aqui na hora.",
    notReady: "A fila de suporte ainda não respondeu — avise o Luis se persistir.",
    urgent: "urgente", opened: "aberto há", reply: "Responder", replying: "Enviando…", ph: "Responder o cliente…",
    escalate: "🛠 Mandar pro técnico", escalated: "Enviado ao técnico ✓", tech: "com o técnico", failed: "Não consegui — tente de novo.",
    refresh: "↻ Atualizar", count: "chamado(s) aberto(s)",
  },
  en: {
    title: "Support — your clients", sub: "You're the first line. Answer, resolve, and send anything technical to the platform team.",
    empty: "No open tickets from your clients. The moment one opens, it shows up here.",
    notReady: "The support queue didn't answer — tell Luis if it persists.",
    urgent: "urgent", opened: "open for", reply: "Reply", replying: "Sending…", ph: "Reply to the client…",
    escalate: "🛠 Send to tech", escalated: "Sent to tech ✓", tech: "with tech", failed: "Couldn't do it — try again.",
    refresh: "↻ Refresh", count: "open ticket(s)",
  },
};
TXT.es = { ...TXT.en, title: "Soporte — tus clientes", sub: "Eres la primera línea. Responde, resuelve y manda lo técnico al equipo de plataforma.", reply: "Responder", ph: "Responder al cliente…", escalate: "🛠 Enviar a técnico", refresh: "↻ Actualizar" };
TXT.hi = TXT.en;

const ago = (ts, lang) => {
  if (!ts) return "";
  const h = Math.floor((Date.now() - new Date(ts).getTime()) / 36e5);
  if (h < 1) return lang === "pt" ? "minutos" : "minutes";
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

export default function SellerSupport({ lang = "pt", seller }) {
  const t = TXT[lang] || TXT.pt;
  const [data, setData] = useState(null);      // null = carregando
  const [reply, setReply] = useState({});
  const [busy, setBusy] = useState(null);
  const [done, setDone] = useState({});        // id → "escalated"

  const call = async (body) => {
    try {
      const r = await fetch("/api/support-hub", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, seller_email: seller?.email, seller_code: seller?.code || "" }),
      });
      return await r.json().catch(() => ({}));
    } catch { return {}; }
  };

  const load = async () => { setData(null); const d = await call({ action: "seller_queue" }); setData(d && d.ok ? d : { tickets: [], ready: false }); };
  useEffect(() => { if (seller?.email) load(); /* eslint-disable-next-line */ }, [seller?.email]);

  const send = async (id) => {
    const text = (reply[id] || "").trim();
    if (!text) return;
    setBusy(id + "r");
    const d = await call({ action: "seller_reply", id, text });
    setBusy(null);
    if (d && d.ok) { setReply((r) => ({ ...r, [id]: "" })); load(); }
  };
  const escalate = async (id) => {
    setBusy(id + "e");
    const d = await call({ action: "seller_escalate", id, note: reply[id] || "" });
    setBusy(null);
    if (d && d.ok) { setDone((x) => ({ ...x, [id]: "escalated" })); setTimeout(load, 900); }
  };

  const tickets = (data && data.tickets) || [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#E5484D]/30 bg-[#E5484D]/[0.06] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[11px] font-black uppercase tracking-wider text-[#E5484D]">🚨 {t.title}</div>
          {data !== null && <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-bold text-g-word">{tickets.length} {t.count}</span>}
          <button onClick={load} className="ml-auto rounded-full border border-white/15 px-3 py-1 text-[11.5px] font-bold text-g-muted hover:text-g-word">{t.refresh}</button>
        </div>
        <p className="mt-1.5 text-[13px] text-g-muted max-w-2xl">{t.sub}</p>
      </div>

      {data === null && <div className="h-28 animate-pulse rounded-2xl border border-white/10 bg-white/[0.02]" />}

      {data && !data.ready && (
        <div className="rounded-2xl border border-g-gold/25 bg-g-gold/[0.06] p-4 text-[13px] text-g-gold">{t.notReady}</div>
      )}

      {data && data.ready && tickets.length === 0 && (
        <div className="rounded-2xl border border-g-green/25 bg-g-green/[0.05] p-6 text-center">
          <div className="text-2xl">✅</div>
          <p className="mt-1 text-[13px] text-g-word">{t.empty}</p>
        </div>
      )}

      {tickets.map((k) => {
        const isTech = String(k.tier || "") === "tecnico";
        return (
          <div key={k.id} className={`rounded-2xl border p-4 ${k.urgent ? "border-[#E5484D]/40 bg-[#E5484D]/[0.05]" : "border-white/10 bg-white/[0.03]"}`}>
            <div className="flex flex-wrap items-start gap-2">
              {k.urgent && <span className="rounded-full bg-[#E5484D]/20 px-2 py-0.5 text-[10px] font-black uppercase text-[#E5484D]">{t.urgent}</span>}
              {isTech && <span className="rounded-full bg-g-info/15 px-2 py-0.5 text-[10px] font-black uppercase text-g-info">{t.tech}</span>}
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-extrabold text-g-word">{k.subject || "—"}</div>
                <div className="text-[11.5px] text-g-muted">{k.client_email} · {k.category || "geral"} · {t.opened} {ago(k.created_at, lang)}</div>
              </div>
              <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[10.5px] font-bold text-g-word">{k.status || "open"}</span>
            </div>

            {Array.isArray(k.thread) && k.thread.length > 0 && (
              <div className="mt-2.5 space-y-1 rounded-xl border border-white/8 bg-[#0d0c0a]/40 p-2.5 max-h-36 overflow-y-auto">
                {k.thread.slice(-5).map((m, i) => (
                  <div key={i} className="text-[12px] leading-relaxed"><span className="text-g-muted">{m.role}:</span> <span className="text-g-word">{m.text}</span></div>
                ))}
              </div>
            )}

            <textarea value={reply[k.id] || ""} onChange={(e) => setReply((r) => ({ ...r, [k.id]: e.target.value }))} placeholder={t.ph} rows={2}
              className="mt-2.5 w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-[12.5px] text-g-word placeholder:text-g-muted/50 focus:outline-none focus:border-g-green/40" />
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button onClick={() => send(k.id)} disabled={busy === k.id + "r" || !(reply[k.id] || "").trim()}
                className="btn-bright text-[12px] py-1.5 disabled:opacity-40">{busy === k.id + "r" ? t.replying : t.reply}</button>
              {done[k.id] ? (
                <span className="inline-flex items-center px-2.5 py-1.5 text-[11.5px] font-bold text-g-green">{t.escalated}</span>
              ) : !isTech && (
                <button onClick={() => escalate(k.id)} disabled={busy === k.id + "e"} className="btn-ghost text-[12px] py-1.5">{t.escalate}</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
