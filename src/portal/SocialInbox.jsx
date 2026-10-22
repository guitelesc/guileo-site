/* Portal "Social" tab — social DM inbox (Instagram · Facebook · TikTok).
 *
 * HONESTY (inbox-honest group):
 *  - DEMO mode (sample cockpit): keeps the original lively showcase — mock DMs + a sample reply
 *    confirmation. Sample data is fine in demo.
 *  - REAL mode (signed-in, non-demo client): NEVER fabricates DMs and NEVER fakes "sent ✓".
 *    It reads the client's actual social threads from /api/inbox (the same unified read model the
 *    Inbox tab uses, filtered to Instagram/Facebook/TikTok) and replies through the real send
 *    endpoint. A reply toasts "Sent ✓" ONLY on a real ok:true+sent. Social channels have no
 *    manual push-back path from the cockpit yet, so replies are saved to the thread and the honest
 *    backend note is shown ("logged only") + a "Connect on Social Hub" action, where Gui's
 *    automatic DM replies actually live once Meta is connected.
 *
 * Portal currently passes only { V }, so this self-resolves the session (real vs demo) + dataKey.
 * It also accepts real/email/dataKey/onNav if a future wiring passes them. */
import { useState, useEffect, useCallback } from "react";
import { FaInstagram, FaFacebook, FaTiktok } from "react-icons/fa6";
import { toast, portalApi, loadDataKey, chamarApi } from "../lib/portalApi.js";
import FalhaDeLeitura, { fraseDaFalha } from "./FalhaDeLeitura.jsx";
import { Card, tr, Empty, Drawer, relTime, SectionSkeleton } from "../pages/Portal.jsx";

const NET_META = { Instagram: [FaInstagram, "#E4405F"], Facebook: [FaFacebook, "#1877F2"], TikTok: [FaTiktok, "#e7e7e7"] };
const netMeta = (n) => NET_META[n] || [FaInstagram, "#E4405F"];
const SOCIAL = ["Instagram", "Facebook", "TikTok"];

// POST /api/inbox — always resolves ({} on any failure) so the UI never throws.
// A resposta carrega o próprio veredito (`_ok`). Antes devolvia `{}` em qualquer falha e a
// lista caía em vazio: um 401 ou uma queda de rede virava "Nenhuma DM ainda" — o dono lia
// que ninguém falou com ele, quando a verdade é que não conseguimos perguntar.
// (2026-09-28) Agora carrega também o MOTIVO (`_motivo`): chave errada, rede e servidor pedem
// frases diferentes — e a conversa aberta passou a ter o mesmo cuidado que a lista já tinha.
async function inboxApi(action, email, key, extra = {}) {
  if (!email || !key) return { _ok: false, _motivo: "sem_credencial" };
  const r = await chamarApi("/api/inbox", { action, email, token: key, ...extra });
  const d = r.data && typeof r.data === "object" ? r.data : {};
  const ok = !r.motivo && d.ok !== false;
  return { ...d, _ok: ok, _motivo: ok ? null : (r.motivo || "servidor") };
}

function SocialInbox({ V, onNav, real: realProp = null, email: emailProp = "", dataKey: dataKeyProp = "" }) {
  // ── Resolve who's looking (Portal passes only V today) ──────────────────────
  // sess: undefined = still resolving · null = none · object = {email, demo, …}
  const [sess, setSess] = useState(realProp != null ? null : undefined);
  useEffect(() => {
    if (realProp != null) return;            // caller already told us it's real
    let alive = true;
    portalApi.session().then((s) => { if (alive) setSess(s || null); }).catch(() => { if (alive) setSess(null); });
    return () => { alive = false; };
  }, [realProp]);

  const email = (emailProp || sess?.email || "").toString().trim().toLowerCase();
  const dataKey = dataKeyProp || loadDataKey();
  const resolving = realProp == null && sess === undefined;
  // A signed-in, non-demo client is a REAL client — even if not yet connected (→ honest empty,
  // NEVER the mock). Demo session, or no session at all, gets the sample showcase.
  const isReal = realProp != null || (sess ? sess.demo !== true : false);

  const goConnect = useCallback(() => {
    if (onNav) return onNav("socialhub");
    try { const u = new URL(window.location.href); u.searchParams.set("tab", "socialhub"); window.location.assign(u.toString()); } catch { /* */ }
  }, [onNav]);

  // ── REAL: live social threads from the unified inbox read model ─────────────
  const [rows, setRows] = useState({ list: [], key: "", loaded: false, err: false, motivo: null });
  const loadReal = useCallback(async () => {
    const d = await inboxApi("threads", email, dataKey, { limit: 80 });
    const all = (Array.isArray(d.threads) ? d.threads : []).filter(Boolean);
    const falhou = !d._ok || (d._ok && !Array.isArray(d.threads));
    setRows({ list: all.filter((c) => SOCIAL.includes(c.channel)), key: dataKey, loaded: true, err: falhou, motivo: falhou ? (d._motivo || "resposta_estranha") : null });
  }, [email, dataKey]);
  const recarregar = () => { setRows((r) => ({ ...r, loaded: false, list: [], err: false })); loadReal(); };
  useEffect(() => {
    if (!isReal) return;
    let alive = true;
    setRows((r) => ({ ...r, loaded: false }));
    loadReal().finally(() => { if (!alive) return; });
    return () => { alive = false; };
  }, [isReal, loadReal]);
  const realList = rows.key === dataKey ? rows.list : [];

  // ── Open conversation (shared by real + demo Drawer) ────────────────────────
  const [sel, setSel] = useState(null);
  const [msgs, setMsgs] = useState([]);
  // estado da CONVERSA aberta: "carregando" | "ok" | motivo da falha
  const [conversa, setConversa] = useState("ok");
  const [tentaConversa, setTentaConversa] = useState(0);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const selId = sel?.id;
  useEffect(() => {
    setDraft("");
    if (!isReal || !sel) { setMsgs([]); setConversa("ok"); return; }
    let alive = true;
    const id = sel.id, ch = sel.channel, last = sel.last;
    setConversa("carregando"); setMsgs([]);
    (async () => {
      const d = await inboxApi("thread", email, dataKey, { thread: id, channel: ch });
      if (!alive) return;
      // 🚨 (2026-09-28) Falha ao abrir a conversa caía no mesmo caminho de "conversa vazia": a
      // gaveta mostrava só a última mensagem (ou "No messages yet in this conversation") e a dona
      // respondia SEM VER o histórico — inclusive o que a própria Gui já tinha respondido.
      if (!d._ok || !Array.isArray(d.messages)) {
        setMsgs(last ? [{ from: "them", text: last }] : []);
        setConversa(d._motivo || "resposta_estranha");
        return;
      }
      const list = d.messages.filter(Boolean).map((m) => ({
        from: m.direction === "in" ? "them" : m.direction === "you" ? "you" : "ai", text: m.body,
      }));
      setMsgs(list.length ? list : (last ? [{ from: "them", text: last }] : []));
      setConversa("ok");
    })();
    return () => { alive = false; };
  }, [isReal, selId, email, dataKey, tentaConversa]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendReal = async (e) => {
    e?.preventDefault?.();
    const body = draft.trim();
    if (!body || !sel || sending) return;
    setMsgs((m) => [...m, { from: "you", text: body }]);   // optimistic — it IS saved to the thread server-side
    setDraft("");
    setSending(true);
    const d = await inboxApi("send", email, dataKey, { thread: sel.id, channel: sel.channel, contact: sel.contact || sel.name, phone: sel.phone || "", body });
    setSending(false);
    // HONEST: "Sent ✓" only when the message truly left the system. Social has no manual push-back
    // path from here → backend returns pending+note; show it and point to where delivery lives.
    if (d._ok && d.sent) toast(`${tr("Sent via")} ${sel.channel} ✓`);
    // a nota do servidor não vai pra tela: a frase daqui é traduzida e diz a mesma coisa
    else if (d._ok && d.pending) toast(`${tr("Reply saved — Gui delivers on")} ${sel.channel} ${tr("automatically once connected.")}`);
    else {
      // Não saiu E não foi guardado: a bolha otimista SAI da conversa e o texto VOLTA para o campo.
      // Deixar a bolha lá era mostrar como enviada uma resposta que não existe em lugar nenhum.
      setMsgs((m) => { const i = m.map((x) => x.from === "you" && x.text === body).lastIndexOf(true); return i < 0 ? m : m.filter((_, j) => j !== i); });
      setDraft((cur) => cur || body);
      toast(`${tr("Reply failed — try again.")}${d._motivo ? ` ${fraseDaFalha(d._motivo)}` : ""}`);
    }
  };

  // ── DEMO showcase (sample data) — original lively behavior, unchanged ───────
  const nets = [[FaInstagram, "#E4405F", "Instagram"], [FaFacebook, "#1877F2", "Facebook"], [FaTiktok, "#e7e7e7", "TikTok"], [FaInstagram, "#E4405F", "Instagram"]];
  const demoRows = (V.activity || []).slice(0, 4).map((a, i) => ({ id: `demo-${i}`, name: (V.ops?.schedule?.[i]?.name) || "New DM", last: a[2], t: a[3], unread: i % 2, net: nets[i % 4][2], color: nets[i % 4][1] }));

  if (resolving) return <SectionSkeleton />;

  // ─────────────────────────────── REAL MODE ────────────────────────────────
  if (isReal) {
    const countNet = (n) => realList.filter((c) => c.channel === n).length;
    if (rows.key !== dataKey || (!rows.loaded && realList.length === 0)) return <SectionSkeleton />;
    const [SelIcon, selColor] = sel ? netMeta(sel.channel) : [FaInstagram, "#E4405F"];
    return (
      <div className="space-y-4 stagger">
        <div className="flex flex-wrap items-center gap-2">
          {SOCIAL.map((n) => { const [, c] = netMeta(n); return (
            <span key={n} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-g-word"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{n} <span className="text-g-muted">{rows.err ? "—" : countNet(n)}</span></span>
          ); })}
          <button onClick={goConnect} className="ml-auto text-[11px] font-bold text-g-gold hover:underline">🔌 {tr("Connect on Social Hub →")}</button>
        </div>
        {rows.err && <FalhaDeLeitura compacto motivo={rows.motivo} onRetry={recarregar} titulo={tr("I couldn't load your messages just now.")} />}
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Social inbox · Instagram, Facebook & TikTok")}</span><span className="text-[11px] text-g-muted hidden sm:inline">👆 {tr("tap to open")}</span></div>
          <div className="divide-y divide-white/[0.06]">
            {realList.map((c) => {
              const [Icon, color] = netMeta(c.channel);
              const nm = (c.contact || c.name || "?").toString();
              return (
                <button key={c.id} onClick={() => setSel(c)} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
                  <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06]" style={{ color }}><Icon size={16} /></span>
                  <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{nm} <span className="text-g-muted font-normal">· {c.channel}</span></div><div className="text-[11px] text-g-muted truncate">{c.last}</div></div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1"><span className="text-[10px] text-g-muted">{c.t || relTime(c.last_at)}</span>{c.unread > 0 && <span className="inline-grid place-items-center h-4 min-w-4 px-1 rounded-full bg-g-green text-[10px] font-bold text-black">{c.unread}</span>}</div>
                </button>
              );
            })}
            {realList.length === 0 && <Empty icon={rows.err ? "⚠️" : "💬"} text={rows.err
              ? tr("I couldn't load your messages just now — this is a connection problem, not an empty inbox. Reload in a moment.")
              : tr("No social DMs yet. Connect Instagram & Facebook on the Social Hub and they'll land here the moment one arrives.")} />}
          </div>
        </Card>
        {sel && (
          <Drawer
            title={sel.contact || sel.name}
            subtitle={`${sel.channel} · ${tr("direct message")}`}
            badge={<span className="grid place-items-center h-7 w-7 rounded-full bg-white/[0.06]" style={{ color: selColor }}><SelIcon size={13} /></span>}
            onClose={() => setSel(null)}
          >
            {conversa !== "ok" && conversa !== "carregando" && (
              <div className="mb-2"><FalhaDeLeitura compacto motivo={conversa} onRetry={() => setTentaConversa((n) => n + 1)} titulo={tr("I couldn't load this conversation's history.")} /></div>
            )}
            <div className="rounded-xl2 border border-white/10 bg-black/10 p-3 space-y-2 max-h-64 overflow-y-auto">
              {conversa === "carregando" && <div className="text-center text-[11px] text-g-muted py-4 animate-pulse">{tr("Loading…")}</div>}
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.from === "them" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-xs leading-relaxed ${m.from === "them" ? "bg-white/[0.06] text-g-word" : m.from === "ai" ? "bg-[#FF8A33]/10 text-g-light border border-[#FF8A33]/30" : "bg-g-gold/15 text-g-word border border-g-gold/30"}`}>
                    {m.from === "ai" && <div className="text-[9px] font-black uppercase mb-0.5" style={{ color: "#FF8A33" }}>Guileo AI</div>}
                    {m.from === "you" && <div className="text-[9px] font-black uppercase text-g-gold mb-0.5">{tr("You")}</div>}
                    {m.text}
                  </div>
                </div>
              ))}
              {msgs.length === 0 && conversa === "ok" && <div className="text-center text-[11px] text-g-muted py-4">{tr("No messages yet in this conversation.")}</div>}
            </div>
            <form onSubmit={sendReal} className="mt-3 flex gap-2">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={tr("Reply")} placeholder={`${tr("Reply on")} ${sel.channel}…`} className="flex-1 rounded-full border border-white/15 bg-black/20 px-4 py-2.5 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
              <button disabled={sending} className="btn-bright text-sm px-5 disabled:opacity-50">{sending ? tr("Sending…") : tr("Send")}</button>
            </form>
            <p className="mt-2 text-[10px] text-g-muted leading-relaxed">{tr("Gui replies to social DMs automatically once Meta is connected. Manual replies here are saved to the thread — connect on the Social Hub to activate delivery.")}</p>
            <div className="mt-2"><button onClick={goConnect} className="text-[11px] font-bold text-g-gold hover:underline">🔌 {tr("Connect on Social Hub →")}</button></div>
          </Drawer>
        )}
      </div>
    );
  }

  // ─────────────────────────────── DEMO MODE ────────────────────────────────
  return (
    <div className="space-y-4 stagger">
      {/* SELO: os contadores e as conversas abaixo são exemplo. Sem ele a tela de demonstração
          era indistinguível da real — "18 respostas hoje" parecia número da conta do cliente. */}
      <div className="rounded-xl2 border border-g-gold/40 bg-g-gold/10 px-4 py-2.5 text-[11px] font-bold text-g-gold">
        {tr("Demo — sample data. Connect your account in Settings to see your real campaigns here.")}
      </div>
      <div className="flex flex-wrap gap-2">
        {[["Instagram", "#E4405F", 18], ["Facebook", "#1877F2", 9], ["TikTok", "#e7e7e7", 6]].map(([n, c, v]) => (
          <span key={n} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-g-word"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{n} <span className="text-g-muted">{v} replies today</span></span>
        ))}
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Social inbox · AI replies on Instagram, Facebook & TikTok")}</span><span className="text-[11px] text-g-muted hidden sm:inline">👆 tap to open</span></div>
        <div className="divide-y divide-white/[0.06]">
          {demoRows.map((c, i) => {
            const [Icon, color, net] = nets[i % 4];
            return (
              <button key={i} onClick={() => setSel(c)} className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.04] transition">
                <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06]" style={{ color }}><Icon size={16} /></span>
                <div className="flex-1 min-w-0"><div className="text-sm font-bold text-g-word truncate">{c.name} <span className="text-g-muted font-normal">· {net}</span></div><div className="text-[11px] text-g-muted truncate">{c.last}</div></div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1"><span className="text-[10px] text-g-muted">{c.t}</span>{c.unread > 0 && <span className="inline-grid place-items-center h-4 min-w-4 px-1 rounded-full bg-g-green text-[10px] font-bold text-black">{c.unread}</span>}</div>
              </button>
            );
          })}
          {demoRows.length === 0 && <Empty icon="💬" text={tr("No social DMs yet — I'm on Instagram, Facebook & TikTok, replying the moment one arrives.")} />}
        </div>
      </Card>
      {sel && (
        <Drawer
          title={sel.name}
          subtitle={`${sel.net} · direct message`}
          badge={<span className="text-[10px] font-black uppercase text-g-green inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("AI replied")}</span>}
          fields={[["Channel", sel.net], ["When", sel.t], ["Status", "Auto-replied by AI"]]}
          note={<>"{sel.last}"<div className="mt-2 text-g-muted">Your AI already replied on {sel.net} and offered to book — it only pings you if a human is needed.</div></>}
          actions={<><button onClick={() => { toast(`Done — your reply is on its way via ${sel.net}.`); setSel(null); }} className="btn-bright text-sm">💬 Reply</button><button onClick={() => { toast("All set — I've marked it handled for you."); setSel(null); }} className="btn-ghost text-sm">✓ Mark handled</button></>}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

export default SocialInbox;
