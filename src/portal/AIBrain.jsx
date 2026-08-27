/* Split out of Portal.jsx (performance): AIBrain tab view — code moved verbatim. */
import { useState, useEffect } from "react";
import { FaPlus, FaCircleCheck, FaPen, FaWandMagicSparkles, FaTrash } from "react-icons/fa6";
import { portalApi, loadDataKey, toast } from "../lib/portalApi.js";
import { seedKB, defProfile, UI_LANG, tr, aiAnswer, kbMatch, Card, Drawer } from "../pages/Portal.jsx";

function AIBrain({ V, me }) {
  const [kb, setKb] = useState(() => portalApi.loadKB(V.label, seedKB(V, portalApi.loadProfile(V.label, defProfile(V)))));
  const [trainedAt, setTrainedAt] = useState("2 days ago");
  const [editing, setEditing] = useState(null); // entry being edited, or {} for new
  const [q, setQ] = useState("");
  const [chat, setChat] = useState([]);

  // Reload when switching verticals (each sector keeps its own brain + profile).
  useEffect(() => { setKb(portalApi.loadKB(V.label, seedKB(V, portalApi.loadProfile(V.label, defProfile(V))))); setChat([]); }, [V.label]);

  // Loop 2: a real connected client's brain edit pushes to their LIVE ElevenLabs voice agent.
  const syncLiveAgent = (nextKb) => {
    const key = loadDataKey(); const email = (me?.email || "").toString().trim().toLowerCase();
    if (!key || !email || me?.demo) return; // demo / not-connected → local only
    const prof = portalApi.loadProfile(V.label, defProfile(V));
    const brain = (nextKb || []).map((e) => `${e.topic || ""}${e.triggers ? ` (${e.triggers})` : ""}: ${e.answer || ""}`).filter((s) => s.replace(/[^a-z0-9]/gi, "").length > 2).join("\n");
    fetch("/api/sync-agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, key, brain, business: prof.name || V.business?.name || "", industry: prof.industry || V.label || "", lang: UI_LANG }) })
      .then((r) => (r.ok ? r.json() : null)).then((d) => { toast(d?.ok ? tr("Live voice agent updated ✓") : tr("Saved — the live agent will sync shortly (retrying).")); }).catch(() => toast(tr("Saved locally — live agent sync will retry.")));
  };
  const persist = (next) => { setKb(next); portalApi.saveKB(V.label, next); setTrainedAt("just now"); toast("AI retrained ✓ — it'll use this on the next conversation"); syncLiveAgent(next); };
  const saveEntry = (entry) => {
    const e = { ...entry, id: entry.id || `k${kb.length}_${entry.topic.slice(0, 4)}` };
    persist(entry.id ? kb.map((x) => (x.id === e.id ? e : x)) : [...kb, e]);
    setEditing(null);
  };
  const delEntry = (id) => persist(kb.filter((x) => x.id !== id));

  const ask = (e) => { e.preventDefault(); if (!q.trim()) return; setChat((c) => [...c, { q, a: aiAnswer(q, V, kb), trained: !!kbMatch(q, kb) }]); setQ(""); };
  const suggestions = ["What are your hours?", "Can I book for tomorrow?", "How much does it cost?", "Where are you located?"];

  return (
    <div className="space-y-4 stagger">
      <Card className="bg-gradient-to-br from-g-green/[0.1] to-g-gold/[0.06] border-g-green/30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-sm font-extrabold text-g-word">{tr("🧠 Your AI's brain")}</div><div className="text-xs text-g-muted mt-0.5">{tr("Teach it in plain words — it answers your")} <b className="text-g-light">{tr("very next customer")}</b> {tr("with it. Test it live below.")}</div></div>
          <button onClick={() => setEditing({ topic: "", triggers: "", answer: "" })} className="btn-bright text-sm inline-flex items-center gap-2"><FaPlus size={11} /> {tr("Teach it something")}</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-3 py-1 text-[11px] font-bold text-g-word"><FaCircleCheck className="text-g-green" size={11} /> {kb.length} {tr("things learned")}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-3 py-1 text-[11px] font-bold text-g-word"><span className="text-g-green">✓</span> {tr("Last trained")} {trainedAt}</span>
          {["🇺🇸 English", "🇧🇷 Português", "🇪🇸 Español"].map((l) => <span key={l} className="inline-flex items-center rounded-full bg-white/[0.06] border border-white/10 px-3 py-1 text-[11px] font-bold text-g-word">{l}</span>)}
        </div>
      </Card>

      {/* THE DIFFERENTIATOR — test your AI live */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("Test your AI · see exactly how it answers your customers")}</div>
        <div className="p-4 space-y-2.5 min-h-[8rem] max-h-72 overflow-y-auto">
          {chat.length === 0 && <div className="text-center text-xs text-g-muted py-6">{tr("Ask your AI anything a customer might ask 👇")}</div>}
          {chat.map((m, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-end"><div className="max-w-[78%] rounded-2xl px-3.5 py-2 text-xs bg-g-gold/15 text-g-word border border-g-gold/30">{m.q}</div></div>
              <div className="flex justify-start"><div className="max-w-[80%] space-y-1">
                <div className="rounded-2xl px-3.5 py-2 text-xs bg-g-green/15 text-g-light border border-g-green/30"><div className="text-[9px] font-black uppercase text-g-green mb-0.5 flex items-center gap-1">Your AI {m.trained && <span className="text-g-gold normal-case">{tr("· from your training")}</span>}</div>{m.a}</div>
                {!m.trained && <button onClick={() => setEditing({ topic: "", triggers: m.q, answer: "" })} className="ml-1 text-[11px] font-bold text-g-gold hover:text-g-word transition inline-flex items-center gap-1"><FaPen size={9} /> {tr("Teach a better answer")}</button>}
              </div></div>
            </div>
          ))}
        </div>
        {chat.length === 0 && <div className="px-4 pb-2 flex flex-wrap gap-2">{suggestions.map((s) => <button key={s} onClick={() => setChat([{ q: s, a: aiAnswer(s, V, kb), trained: !!kbMatch(s, kb) }])} className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-g-muted hover:text-g-word transition">{s}</button>)}</div>}
        <form onSubmit={ask} className="p-3 border-t border-white/10 flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label={tr("Ask your AI")} placeholder={tr("Ask your AI a question…")} className="flex-1 rounded-full border border-white/15 bg-black/20 px-4 py-2.5 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70" />
          <button className="btn-bright text-sm px-5">{tr("Ask")}</button>
        </form>
      </Card>

      {/* EDITABLE KNOWLEDGE BASE */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wide text-g-gold flex items-center gap-2"><FaWandMagicSparkles size={11} /> Knowledge base · what your AI knows</div>
          <button onClick={() => setEditing({ topic: "", triggers: "", answer: "" })} className="text-[11px] font-bold text-g-green hover:text-g-word transition inline-flex items-center gap-1"><FaPlus size={10} /> Add</button>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {kb.map((e) => (
            <div key={e.id} className="px-5 py-3 flex items-start gap-3 group">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-g-word flex items-center gap-2">{e.topic}{e.locked && <span className="text-[9px] font-black uppercase text-g-gold border border-g-gold/30 rounded px-1.5 py-0.5">{tr("routes to human")}</span>}</div>
                <p className="text-xs text-g-muted leading-relaxed mt-0.5">{e.answer}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 opacity-60 group-hover:opacity-100 transition">
                <button onClick={() => setEditing(e)} aria-label="Edit" className="text-g-muted hover:text-g-word transition"><FaPen size={11} /></button>
                <button onClick={() => delEntry(e.id)} aria-label={tr("Delete")} className="text-g-muted hover:text-red-400 transition"><FaTrash size={11} /></button>
              </div>
            </div>
          ))}
          {kb.length === 0 && <div className="px-5 py-8 text-center text-xs text-g-muted">{tr("Nothing trained yet — add your first answer above.")}</div>}
        </div>
      </Card>

      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Edit knowledge" : "Teach your AI"}
        subtitle={tr("Your AI uses this the moment you save it")}
        fields={null}
        actions={null}
      >
        {editing && <KBForm key={editing.id || "new"} entry={editing} onSave={saveEntry} onCancel={() => setEditing(null)} />}
      </Drawer>
    </div>
  );
}

// 🚨 Os placeholders deste formulário eram os ÚNICOS textos EN sem tr() da tela: o dono em PT/ES/HI
// via o próprio exemplo em inglês. Placeholder é texto visível — passa pelo dicionário como o resto.
function KBForm({ entry, onSave, onCancel }) {
  const [topic, setTopic] = useState(entry.topic || "");
  const [triggers, setTriggers] = useState(entry.triggers || "");
  const [answer, setAnswer] = useState(entry.answer || "");
  const valid = topic.trim() && answer.trim();
  const field = "w-full rounded-xl border border-white/15 bg-black/20 px-3.5 py-2.5 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green/70";
  return (
    <div className="space-y-3">
      <label className="block"><span className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{tr("Topic")}</span>
        <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={tr("e.g. Parking & access")} className={`mt-1 ${field}`} /></label>
      <label className="block"><span className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{tr("When customers ask about…")} <span className="normal-case font-normal text-g-muted/70">{tr("(keywords, optional)")}</span></span>
        <input value={triggers} onChange={(e) => setTriggers(e.target.value)} placeholder={tr("parking park garage valet")} className={`mt-1 ${field}`} /></label>
      <label className="block"><span className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{tr("Your AI should reply")}</span>
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} placeholder={tr("Free parking is available right behind the building…")} className={`mt-1 ${field} resize-none`} /></label>
      <div className="flex gap-2 pt-1">
        <button disabled={!valid} onClick={() => onSave({ ...entry, topic: topic.trim(), triggers: triggers.trim(), answer: answer.trim() })} className="btn-bright text-sm flex-1 disabled:opacity-40 disabled:cursor-not-allowed">{tr("Save & retrain")}</button>
        <button onClick={onCancel} className="rounded-full border border-white/15 px-4 py-2 text-sm font-bold text-g-muted hover:text-g-word transition">{tr("Cancel")}</button>
      </div>
    </div>
  );
}

export default AIBrain;
