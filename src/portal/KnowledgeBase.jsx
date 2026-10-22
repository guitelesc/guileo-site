/* 📚 Cérebro do negócio — the tenant's own Knowledge Base. The owner curates the Q&A Gui answers
   FROM on calls + web chat (walk-ins? parking? cancellation policy?). CRUD via /api/kb (get_client_data
   gated). Six per-vertical question templates one-tap prefill the "new Q&A" form so it fills fast.
   When not connected (demo), it shows sample entries and prompts to connect first. */
import { useState, useEffect } from "react";
import { FaBrain, FaPlus, FaTrash, FaFloppyDisk } from "react-icons/fa6";
import { tr, Card, Empty, SectionSkeleton } from "../pages/Portal.jsx";
import { toast, chamarApi } from "../lib/portalApi.js";
import FalhaDeLeitura, { fraseDaFalha } from "./FalhaDeLeitura.jsx";

const CATS = ["general", "hours", "policy", "payment", "location", "services", "other"];
// 🌐 (2026-09-28) Era um mapa com os rótulos em PORTUGUÊS ("Geral", "Horários"…) usado como chave
// de tr() — cliente em inglês lia português. Agora é função chamada NA HORA de desenhar, com a
// chave em inglês escrita como literal (o teste de i18n só enxerga literal).
const catLabel = (c) => ({
  general: tr("General"), hours: tr("Hours"), policy: tr("Policies"), payment: tr("Payment"),
  location: tr("Location"), services: tr("Services"), other: tr("Other"),
}[c] || c);

// Six question templates the owner can one-tap to prefill — tuned lightly per vertical so they read
// as "questions MY customers actually ask". Falls back to a universal set.
// 🌐 (2026-09-28) Os modelos eram frases FIXAS em português: a dona de um spa com a tela em inglês
// tocava num modelo e ensinava a Gui a responder uma pergunta em português. Agora seguem a tela.
function templatesFor(V) {
  const label = (V && V.label) || "";
  const byVertical = {
    "Restaurant": () => [tr("Do you deliver?"), tr("Do you have vegetarian or gluten-free options?"), tr("Do you take reservations for large groups?"), tr("Is there a service charge?"), tr("What are the kitchen hours?"), tr("Is there parking?")],
    "Clinic": () => [tr("Do you take insurance? Which plans?"), tr("Do I need a referral?"), tr("What is your rescheduling policy?"), tr("Does the first visit cost more?"), tr("Do you take emergency appointments?"), tr("Where is the clinic?")],
    "Salon & Spa": () => [tr("Do I need an appointment or do you take walk-ins?"), tr("How long does each service take?"), tr("Is there a cancellation fee?"), tr("Do you sell the products you use?"), tr("Which cards and payment apps do you accept?"), tr("Is there parking?")],
    "Plumbing & HVAC": () => [tr("Do you handle emergencies 24/7?"), tr("Do you charge a visit or estimate fee?"), tr("What area do you serve?"), tr("Is the work guaranteed?"), tr("How soon can you come?"), tr("Do you offer payment plans?")],
    "Gym & Fitness": () => [tr("Is there a free trial class?"), tr("What are the plans and prices?"), tr("Is there a contract or minimum term?"), tr("What are your opening hours?"), tr("Is there parking?"), tr("Can I cancel anytime?")],
    "Law Firm": () => [tr("Is the first consultation free?"), tr("Which practice areas do you cover?"), tr("How do your fees work?"), tr("Do you meet online?"), tr("How long does a case like this take?"), tr("Where is the office?")],
    "Real Estate": () => [tr("How do I schedule a showing?"), tr("Which neighborhoods do you cover?"), tr("Do you charge a broker fee?"), tr("Do you work with financing?"), tr("Do you have rentals too?"), tr("What are your business hours?")],
    "Auto Dealership": () => [tr("Can I schedule a test drive?"), tr("Do you work with financing?"), tr("Do you take trade-ins?"), tr("What are the store hours?"), tr("Is there a warranty?"), tr("Where is the dealership?")],
  };
  if (byVertical[label]) return byVertical[label]();
  return [
    tr("Do you take walk-ins (no appointment)?"),
    tr("Is there parking? Is it free?"),
    tr("What is your cancellation policy?"),
    tr("Which payment methods do you accept?"),
    tr("What are your opening hours?"),
    tr("Where are you located?"),
  ];
}

// 🚨 (2026-09-28) Esta função não tinha try/catch nem olhava `r.ok`. Rede caída REJEITAVA dentro do
// reload(), `items` ficava `null` para sempre = esqueleto pulsando eternamente, sem botão. E um 401
// ou 502 viravam `{}` → "0 answers taught", como se a dona nunca tivesse ensinado nada.
// Agora passa pelo chamarApi, que nunca levanta e devolve o MOTIVO.
const api = (body, dataKey, email) => chamarApi("/api/kb", { ...body, token: dataKey, email });

// Deterministic demo rows so the tab looks alive before a client connects. Função (e não constante)
// para sair no idioma da tela — e SÓ aparece sem conta conectada, sob o selo "sample".
const demoRows = () => [
  { id: "d1", question: tr("Do you take walk-ins?"), answer: tr("Yes! We see walk-ins in order of arrival, but booking guarantees your time."), category: "policy", active: true },
  { id: "d2", question: tr("Is there parking?"), answer: tr("We have free parking right in front."), category: "location", active: true },
  { id: "d3", question: tr("What is your cancellation policy?"), answer: tr("Cancellations up to 24 hours ahead are free."), category: "policy", active: true },
];

export default function KnowledgeBase({ V, real = null, email = "", dataKey = "" }) {
  const connected = !!(real && email && dataKey);
  // null = carregando (só conectado). As linhas de amostra NUNCA entram neste estado quando há
  // conta: `useState(connected ? null : DEMO)` congelava a amostra se a tela montasse um instante
  // antes de `real` chegar, e ela ficava debaixo do selo "LIVE — real data".
  const [items, setItems] = useState(null);
  const [falha, setFalha] = useState(null);   // motivo da falha de LEITURA, ou null
  const [ready, setReady] = useState(true);
  const [draft, setDraft] = useState({ question: "", answer: "", category: "general" });
  const [savingId, setSavingId] = useState(null);
  const [amostra, setAmostra] = useState(null); // edições locais da amostra (modo demonstração)

  const reload = async () => {
    if (!connected) return;
    setFalha(null); setItems(null);
    const r = await api({ action: "list" }, dataKey, email);
    if (r.motivo) { setFalha(r.motivo); return; }
    const d = r.data;
    setReady(d?.ready !== false);
    // `ready:false` = recurso ainda não ligado (lista vazia legítima). Sem `items` num corpo que
    // diz estar pronto é resposta quebrada, não "nenhuma resposta ensinada".
    if (Array.isArray(d?.items)) setItems(d.items);
    else if (d?.ready === false) setItems([]);
    else setFalha("resposta_estranha");
  };
  useEffect(() => { if (connected) reload(); else { setItems(null); setFalha(null); } /* eslint-disable-next-line */ }, [connected, email, dataKey]);

  const addOrSave = async (row) => {
    const q = (row.question || "").trim();
    if (!q) { toast(tr("Write the question first.")); return; }
    if (!connected) { toast(tr("Connect your code in Settings to save for real.")); return; }
    setSavingId(row.id || "new");
    const r = await api({ action: "upsert", id: row.id || undefined, question: q, answer: row.answer || "", category: row.category || "general", active: row.active !== false }, dataKey, email);
    setSavingId(null);
    if (r.motivo) { toast(`${tr("Couldn't save — try again.")} ${fraseDaFalha(r.motivo)}`); return; }
    const d = r.data;
    if (d?.ready === false) { toast(tr("We're activating this for you — we'll let you know.")); return; }
    if (d?.ok) { toast(tr("Saved ✓ — Gui starts using this within about an hour.")); if (!row.id) setDraft({ question: "", answer: "", category: "general" }); reload(); }
    else toast(tr("Couldn't save — try again."));
  };
  const remove = async (row) => {
    if (!connected) { setAmostra((x) => (x || demoRows()).filter((r) => r.id !== row.id)); return; }
    setItems((x) => (x || []).filter((r) => r.id !== row.id)); // optimistic
    const r = await api({ action: "delete", id: row.id }, dataKey, email);
    if (!(r.data?.ok && r.data?.deleted) || r.motivo) { toast(tr("Couldn't delete — reloading.")); reload(); }
    else toast(tr("Removed ✓"));
  };
  const patchLocal = (id, patch) => (connected
    ? setItems((x) => (x || []).map((r) => (r.id === id ? { ...r, ...patch } : r)))
    : setAmostra((x) => (x || demoRows()).map((r) => (r.id === id ? { ...r, ...patch } : r))));

  const templates = templatesFor(V);

  if (connected && falha) return <FalhaDeLeitura motivo={falha} onRetry={reload} />;
  if (connected && items === null) return <SectionSkeleton rows={4} />;
  const list = connected ? (items || []) : (amostra || demoRows());

  return (
    <div className="space-y-4 stagger">
      {/* Header */}
      <div className="rounded-2xl border border-[#FF8A33]/25 bg-gradient-to-br from-[#FF8A33]/[0.07] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#FF8A33" }}>
          <FaBrain size={12} /> {tr("Business brain")}
          {connected
            ? <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span>
            : <span className="text-g-muted normal-case font-bold text-[9px] border border-white/10 rounded-full px-1.5 py-px">{tr("sample")}</span>}
        </div>
        <div className="mt-1 text-xl font-black text-g-word">{connected && ready === false ? "—" : list.length} {tr("answers taught")}</div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">{tr("The questions YOUR business gets, with YOUR answer. Gui uses this the same way on the call and in the site chat — instead of making the customer wait for the team.")}</p>
        {ready === false && <p className="mt-2 text-[11px] font-bold text-g-gold">{tr("We're activating this for you — we'll let you know.")}</p>}
      </div>

      {/* New Q&A */}
      <Card>
        <div className="text-[11px] font-black uppercase tracking-wider text-g-muted flex items-center gap-2"><FaPlus size={10} /> {tr("New question & answer")}</div>
        <input value={draft.question} onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))} placeholder={tr("E.g.: Do you accept walk-ins?")}
          className="mt-3 w-full rounded-xl2 border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-g-word placeholder:text-g-muted focus:border-[#FF8A33]/50 outline-none" />
        <textarea value={draft.answer} onChange={(e) => setDraft((d) => ({ ...d, answer: e.target.value }))} placeholder={tr("The answer Gui should give…")} rows={2}
          className="mt-2 w-full rounded-xl2 border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-g-word placeholder:text-g-muted focus:border-[#FF8A33]/50 outline-none resize-y" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            className="rounded-xl2 border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-g-word outline-none focus:border-[#FF8A33]/50">
            {CATS.map((c) => <option key={c} value={c} className="bg-[#161512]">{catLabel(c)}</option>)}
          </select>
          <button onClick={() => addOrSave(draft)} disabled={savingId === "new"} className="inline-flex items-center gap-1.5 rounded-xl2 bg-[#FF8A33] text-black font-black px-4 py-2 text-[13px] disabled:opacity-40 clicky">
            <FaPlus size={11} /> {tr("Add")}
          </button>
        </div>
        {/* Templates — one tap prefills the question above */}
        <div className="mt-3">
          <div className="text-[10.5px] font-bold uppercase tracking-wide text-g-muted">{tr("Templates — tap to fill in")}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {templates.map((q, i) => (
              <button key={i} onClick={() => setDraft((d) => ({ ...d, question: q }))}
                className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[11.5px] text-g-muted hover:text-g-word hover:border-[#FF8A33]/40 transition min-h-[44px] inline-flex items-center">
                {q}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Existing entries — editable */}
      {/* recurso ainda não ligado: a lista vazia NÃO é "você não ensinou nada" — a frase do topo
          já diz que estamos ativando, e o vazio aqui repetiria uma afirmação que não sei fazer */}
      {connected && ready === false ? null : list.length === 0
        ? <Empty icon="📚" text={tr("No answers yet — start with a template above.")} />
        : <div className="space-y-2.5">
            {list.map((r) => (
              <Card key={r.id} className={r.active === false ? "opacity-60" : ""}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <input value={r.question} onChange={(e) => patchLocal(r.id, { question: e.target.value })}
                      className="w-full rounded-lg border border-transparent hover:border-white/10 focus:border-[#FF8A33]/50 bg-transparent px-2 py-1 text-sm font-bold text-g-word outline-none" />
                    <textarea value={r.answer || ""} onChange={(e) => patchLocal(r.id, { answer: e.target.value })} rows={2} placeholder={tr("Answer…")}
                      className="w-full rounded-lg border border-white/10 focus:border-[#FF8A33]/50 bg-white/[0.03] px-2.5 py-1.5 text-[13px] text-g-muted outline-none resize-y" />
                    <div className="flex flex-wrap items-center gap-2">
                      <select value={r.category || "general"} onChange={(e) => patchLocal(r.id, { category: e.target.value })}
                        className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[12px] text-g-word outline-none">
                        {CATS.map((c) => <option key={c} value={c} className="bg-[#161512]">{catLabel(c)}</option>)}
                      </select>
                      <label className="inline-flex items-center gap-1.5 text-[12px] text-g-muted cursor-pointer">
                        <input type="checkbox" checked={r.active !== false} onChange={(e) => patchLocal(r.id, { active: e.target.checked })} className="accent-[#FF8A33]" />
                        {tr("Active (Gui uses it)")}
                      </label>
                      <button onClick={() => addOrSave(r)} disabled={savingId === r.id} className="inline-flex items-center gap-1.5 rounded-lg border border-g-green/40 bg-g-green/[0.10] px-2.5 py-1 text-[12px] font-black text-g-word hover:bg-g-green/20 transition disabled:opacity-40 min-h-[44px] inline-flex items-center">
                        <FaFloppyDisk size={10} /> {tr("Save")}
                      </button>
                      <button onClick={() => remove(r)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-[12px] font-bold text-g-muted hover:text-[#EF4444] hover:border-[#EF4444]/40 transition ml-auto min-h-[44px] inline-flex items-center">
                        <FaTrash size={10} /> {tr("Remove")}
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>}
    </div>
  );
}
