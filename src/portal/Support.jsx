/* ─────────────────────────────────────────────────────────────────────────────────────────────
   GUI SUPORTE — o chat de resolução instantânea.

   ABSORVIDA POR RELACIONAMENTO (2026-08-20): esta tela era o único lugar de suporte do cockpit e
   tinha três buracos que a auditoria confirmou:
     1. `logTicket` disparava `post(...).catch(() => {})` SEM await — a tela imprimia
        "✓ Escalado para um humano" antes (e independentemente) de qualquer coisa ser gravada.
     2. a aba "meus chamados" fazia `setTickets(d.tickets || [])` e `catch { setTickets([]) }`,
        então rede caída, 401 e SQL ausente viravam todos "Nothing yet".
     3. a `thread` (onde o consultor e o técnico respondem) nunca era lida — a resposta humana era
        INVISÍVEL para o cliente.
   O chat continua aqui, agora com COMPROVANTE (só diz "escalado" depois de ler o `id` do chamado),
   e é exportado como `GuiChat` para ser a porta de entrada da aba Relacionamento, que é onde a
   conversa completa (thread + resposta) e o consultor moram.
   ───────────────────────────────────────────────────────────────────────────────────────────── */
import { useState, useRef, useEffect, useCallback } from "react";
import { matchSupport, SUPPORT_QUICK, SUPPORT_KB } from "../data/supportKB.js";
import { waLink } from "../data/contact.js";
import { UI_LANG, tr, Card, GuiMark } from "../pages/Portal.jsx";

const SUPPORT_NAV = { open_settings: "settings", open_billing: "billing", open_finance: "finance", open_marketing: "marketing", open_crm: "crm", train_ai: "brain", reactivate_agent: "retention", resend_code: "settings" };

/** O chat da Gui. Resolve em milissegundos pela biblioteca local (matchSupport); cai para Claude
 *  no raro furo; e grava CADA interação como chamado — mas só declara "escalado" com o id na mão. */
export function GuiChat({ onNav, email = "", dataKey = "", onTicket, className = "" }) {
  const lang = UI_LANG;
  const demo = !dataKey;
  const L = (o) => (o && (o[lang] || o.en)) || "";
  const greet = tr("Hi — I'm Gui Support. Tell me what's going on and I'll resolve it right now.");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState([{ mid: 0, role: "gui", text: greet }]);
  const endRef = useRef(null);
  const vivo = useRef(true);
  const nid = useRef(1);
  useEffect(() => { vivo.current = true; return () => { vivo.current = false; }; }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [thread, busy]);

  const post = useCallback(async (body) => {
    const r = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: dataKey || "demo", email, ...body }) });
    const d = await r.json().catch(() => null);
    return { http: r.status, d };
  }, [dataKey, email]);

  // Abre o chamado e DEVOLVE O COMPROVANTE. `ok:true` sozinho não é sucesso: o endpoint responde
  // `{ok:true, ready:false}` em HTTP 200 quando o SQL não está colado — 200 sem id é "não gravei".
  const abrirChamado = useCallback(async (p) => {
    try {
      const { http, d } = await post({ action: "create", ...p });
      if (!d) return { erro: `${tr("unreadable answer")} (HTTP ${http})` };
      if (d.error) return { erro: String(d.error) };
      if (d.ready === false) return { erro: d.note || tr("support isn't activated yet") };
      if (d.ok !== true || !d.id) return { erro: d.motivo || tr("it wasn't recorded") };
      return { id: d.id };
    } catch (e) { return { erro: String(e?.message || e).slice(0, 80) }; }
  }, [post]);

  const registrar = useCallback(async (mid, payload) => {
    setThread((t) => t.map((m) => (m.mid === mid ? { ...m, rec: { st: "wait" } } : m)));
    const r = await abrirChamado(payload);
    if (!vivo.current) return;
    setThread((t) => t.map((m) => (m.mid === mid ? { ...m, rec: r.id ? { st: "ok", id: r.id } : { st: "erro", motivo: r.erro } } : m)));
    if (r.id) onTicket?.(r.id);
  }, [abrirChamado, onTicket]);

  const ask = async (text) => {
    const query = (text != null ? text : q).trim();
    if (!query || busy) return;
    setThread((t) => [...t, { mid: nid.current++, role: "you", text: query }]);
    setQ(""); setBusy(true);
    const hit = matchSupport(query, lang);
    if (hit) {
      const mid = nid.current++;
      const payload = { subject: query.slice(0, 120), category: hit.category, body: query, ai_handled: !hit.escalate, kb_id: hit.id, status: hit.escalate ? "escalated" : "resolved", priority: hit.escalate ? "high" : "normal" };
      setThread((t) => [...t, { mid, role: "gui", text: L(hit.a), action: hit.action, escalate: !!hit.escalate, payload }]);
      setBusy(false);
      if (!demo) registrar(mid, payload);
      return;
    }
    if (demo) {
      setThread((t) => [...t, { mid: nid.current++, role: "gui", text: tr("In the live cockpit I'd answer this instantly and act on it for you. Connect your account in Settings to turn me on."), action: { kind: "open_settings", label: { en: "Open Settings", pt: "Abrir Configurações", es: "Abrir Configuración" } } }]);
      setBusy(false); return;
    }
    try {
      const { d } = await post({ action: "ai", question: query, lang });
      if (!vivo.current) return;
      const ans = d?.answer || tr("I've logged this and a teammate will follow up shortly.");
      const escalate = d?.escalate === true || !d?.answer;
      const mid = nid.current++;
      const payload = { subject: query.slice(0, 120), category: "other", body: query, ai_handled: !escalate, status: escalate ? "escalated" : "resolved", priority: escalate ? "high" : "normal" };
      setThread((t) => [...t, { mid, role: "gui", text: ans, escalate, payload }]);
      setBusy(false);
      registrar(mid, payload);
      return;
    } catch (e) {
      if (!vivo.current) return;
      const mid = nid.current++;
      const payload = { subject: query.slice(0, 120), category: "other", body: query, ai_handled: false, status: "escalated", priority: "high" };
      setThread((t) => [...t, { mid, role: "gui", text: `${tr("I couldn't reach my brain right now")} · ${String(e?.message || e).slice(0, 60)}`, escalate: true, payload }]);
      setBusy(false);
      registrar(mid, payload);
      return;
    }
  };

  const quick = SUPPORT_QUICK.map((id) => SUPPORT_KB.find((s) => s.id === id)).filter(Boolean);

  return (
    <Card className={`p-0 overflow-hidden flex flex-col min-h-[460px] ${className}`}>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <GuiMark size={30} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-extrabold text-g-word">{tr("Gui Support")} <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-bold text-g-light"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />{tr("online · 24/7")}</span></div>
          <div className="text-[11px] text-g-muted">{tr("Instant answers. A real human supervises everything.")}</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {thread.map((m) => (
          <div key={m.mid} className={`flex ${m.role === "you" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] rounded-xl2 px-3.5 py-2.5 text-[14px] ${m.role === "you" ? "bg-g-gold/[0.14] border border-g-gold/25 text-g-word" : "bg-white/[0.04] border border-white/10 text-g-word"}`}>
              {m.role === "gui" && <div className="text-[10px] font-black uppercase tracking-wider text-g-gold/80 mb-1">Gui</div>}
              <div className="whitespace-pre-wrap leading-relaxed break-words">{m.text}</div>
              {m.action && m.action.kind && m.action.kind !== "none" && (
                <button type="button" onClick={() => onNav?.(SUPPORT_NAV[m.action.kind] || "settings")} className="mt-2 btn-bright text-xs min-h-[44px] px-4">{L(m.action.label)} →</button>
              )}
              {m.escalate && (
                m.rec?.st === "ok" ? (
                  <div className="mt-2 text-[11px] font-bold text-amber-300">✓ {tr("Escalated to a human teammate — we'll follow up.")} <span className="font-mono font-normal text-g-muted">#{String(m.rec.id).slice(0, 8)}</span></div>
                ) : m.rec?.st === "erro" ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-amber-300">
                    <span>⚠️ {tr("I couldn't open the ticket")}{m.rec.motivo ? <span className="font-normal text-g-muted"> · {m.rec.motivo}</span> : null}</span>
                    <button type="button" onClick={() => registrar(m.mid, m.payload)} className="min-h-[44px] rounded-full border border-white/15 px-3.5 text-[11px] font-bold text-g-word">{tr("Try again")}</button>
                  </div>
                ) : m.rec?.st === "wait" ? (
                  <div className="mt-2 text-[11px] text-g-muted">{tr("Opening your ticket…")}</div>
                ) : demo ? (
                  <div className="mt-2 text-[11px] text-g-muted">{tr("Connect your account so I can open a real ticket.")}</div>
                ) : null
              )}
            </div>
          </div>
        ))}
        {busy && <div className="flex justify-start"><div className="rounded-xl2 px-4 py-2.5 bg-white/[0.04] border border-white/10 text-sm text-g-muted">{tr("Gui is thinking…")}</div></div>}
        <div ref={endRef} />
      </div>

      {quick.length > 0 && (
        <div className="border-t border-white/10 px-3 pt-3 pb-1 flex gap-2 overflow-x-auto">
          {quick.map((s) => (
            <button key={s.id} type="button" onClick={() => ask(L(s.q))}
              className="shrink-0 min-h-[44px] rounded-full border border-white/12 bg-white/[0.04] px-3.5 text-[12px] font-semibold text-g-word transition hover:border-g-gold/40">{L(s.q)}</button>
          ))}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="border-t border-white/10 p-3 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} aria-label={tr("Ask Gui Support")} placeholder={tr("Type your question…")}
          className="flex-1 min-w-0 rounded-full border border-white/15 bg-black/20 px-4 py-2.5 text-[16px] text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
        <button disabled={busy || !q.trim()} className="btn-bright text-sm px-5 min-h-[48px] shrink-0 disabled:opacity-50">{tr("Send")}</button>
      </form>
    </Card>
  );
}

/** A aba antiga (`support`) — segue roteável para os atalhos que já apontam para ela.
 *  A lista de chamados COM A THREAD mora em Relacionamento; aqui só o caminho até lá. */
function Support({ onNav, email = "", dataKey = "" }) {
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2"><GuiChat onNav={onNav} email={email} dataKey={dataKey} /></div>
      <div className="space-y-4">
        <Card>
          <div className="text-sm font-extrabold text-g-word">📬 {tr("My tickets")}</div>
          <p className="text-xs text-g-muted mt-1">{tr("Every ticket, the full conversation and your consultant live in Relationship.")}</p>
          <button type="button" onClick={() => onNav?.("relacionamento")} className="mt-3 btn-bright text-sm px-5 min-h-[48px]">{tr("Open Relationship")} →</button>
        </Card>
        <Card>
          <div className="text-sm font-extrabold text-g-word">👋 {tr("Talk to a human")}</div>
          <p className="text-xs text-g-muted mt-1">{tr("Gui handles most things instantly. For anything sensitive, a real teammate is one message away.")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={waLink("Hi Guileo team! I need help with my account")} target="_blank" rel="noopener" className="btn-ghost text-sm min-h-[48px] inline-flex items-center px-4">💬 {tr("I'll message my team")}</a>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default Support;
