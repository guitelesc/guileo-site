/* 📚 Cérebro do negócio — the tenant's own Knowledge Base. The owner curates the Q&A Gui answers
   FROM on calls + web chat (walk-ins? parking? cancellation policy?). CRUD via /api/kb (get_client_data
   gated). Six per-vertical question templates one-tap prefill the "new Q&A" form so it fills fast.
   When not connected (demo), it shows sample entries and prompts to connect first. */
import { useState, useEffect } from "react";
import { FaBrain, FaPlus, FaTrash, FaFloppyDisk } from "react-icons/fa6";
import { tr, Card, Empty, SectionSkeleton } from "../pages/Portal.jsx";
import { toast } from "../lib/portalApi.js";

const CATS = ["general", "hours", "policy", "payment", "location", "services", "other"];
const catLabel = { general: "Geral", hours: "Horários", policy: "Políticas", payment: "Pagamento", location: "Local", services: "Serviços", other: "Outro" };

// Six question templates the owner can one-tap to prefill — tuned lightly per vertical so they read
// as "questions MY customers actually ask". Falls back to a universal set.
function templatesFor(V) {
  const label = (V && V.label) || "";
  const base = [
    "Vocês aceitam walk-in (sem agendamento)?",
    "Tem estacionamento? É gratuito?",
    "Qual é a política de cancelamento?",
    "Quais formas de pagamento vocês aceitam?",
    "Qual o horário de funcionamento?",
    "Onde vocês ficam / atendem?",
  ];
  const byVertical = {
    "Restaurant": ["Vocês fazem entrega / delivery?", "Tem opções vegetarianas ou sem glúten?", "Aceitam reserva pra grupo grande?", "Tem taxa de serviço?", "Qual o horário da cozinha?", "Tem estacionamento?"],
    "Clinic": ["Vocês atendem convênio? Quais?", "Precisa de encaminhamento?", "Qual a política de reagendamento?", "A primeira consulta é mais cara?", "Fazem atendimento de emergência?", "Onde fica a clínica?"],
    "Salon & Spa": ["Preciso agendar ou aceitam walk-in?", "Quanto tempo dura cada serviço?", "Tem taxa de cancelamento?", "Vocês vendem os produtos que usam?", "Aceitam cartão e Pix?", "Tem estacionamento?"],
    "Plumbing & HVAC": ["Vocês atendem emergência 24h?", "Cobram taxa de visita/orçamento?", "Qual a área de atendimento?", "Dão garantia no serviço?", "Em quanto tempo conseguem ir?", "Aceitam parcelamento?"],
    "Gym & Fitness": ["Tem aula experimental grátis?", "Quais os planos e valores?", "Precisa de fidelidade/contrato?", "Qual o horário de funcionamento?", "Tem estacionamento?", "Posso cancelar quando quiser?"],
    "Law Firm": ["A primeira consulta é gratuita?", "Quais áreas vocês atuam?", "Como funciona o pagamento dos honorários?", "Atendem online?", "Quanto tempo demora um caso assim?", "Onde fica o escritório?"],
    "Real Estate": ["Como agendo uma visita?", "Quais bairros vocês cobrem?", "Cobram taxa de corretagem?", "Trabalham com financiamento?", "Têm imóveis pra alugar também?", "Qual o horário de atendimento?"],
    "Auto Dealership": ["Posso agendar um test drive?", "Trabalham com financiamento?", "Aceitam meu carro na troca?", "Qual o horário da loja?", "Dão garantia?", "Onde fica a concessionária?"],
  };
  return byVertical[label] || base;
}

const api = async (body, dataKey, email) => {
  const r = await fetch("/api/kb", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, token: dataKey, email }) });
  return r.json().catch(() => ({}));
};

// Deterministic demo rows so the tab looks alive before a client connects.
const DEMO = [
  { id: "d1", question: "Vocês aceitam walk-in?", answer: "Sim! Atendemos por ordem de chegada, mas agendar garante seu horário.", category: "policy", active: true },
  { id: "d2", question: "Tem estacionamento?", answer: "Temos estacionamento gratuito na frente da loja.", category: "location", active: true },
  { id: "d3", question: "Qual a política de cancelamento?", answer: "Cancelamentos com até 24h de antecedência não têm custo.", category: "policy", active: true },
];

export default function KnowledgeBase({ V, real = null, email = "", dataKey = "" }) {
  const connected = !!(real && email && dataKey);
  const [items, setItems] = useState(connected ? null : DEMO); // null = loading (connected)
  const [ready, setReady] = useState(true);
  const [draft, setDraft] = useState({ question: "", answer: "", category: "general" });
  const [savingId, setSavingId] = useState(null);

  const reload = async () => {
    if (!connected) return;
    const d = await api({ action: "list" }, dataKey, email);
    setReady(d?.ready !== false);
    setItems(Array.isArray(d?.items) ? d.items : []);
  };
  useEffect(() => { if (connected) reload(); /* eslint-disable-next-line */ }, [connected, email, dataKey]);

  const addOrSave = async (row) => {
    const q = (row.question || "").trim();
    if (!q) { toast(tr("Escreva a pergunta primeiro.")); return; }
    if (!connected) { toast(tr("Conecte seu código em Configurações pra salvar de verdade.")); return; }
    setSavingId(row.id || "new");
    const d = await api({ action: "upsert", id: row.id || undefined, question: q, answer: row.answer || "", category: row.category || "general", active: row.active !== false }, dataKey, email);
    setSavingId(null);
    if (d?.ready === false) { toast(tr("Base de conhecimento ainda não ativada — o time aplica e já funciona.")); return; }
    if (d?.ok) { toast(tr("Salvo ✓ — a Gui já responde com isso")); if (!row.id) setDraft({ question: "", answer: "", category: "general" }); reload(); }
    else toast(tr("Não consegui salvar — tenta de novo."));
  };
  const remove = async (row) => {
    if (!connected) { setItems((x) => x.filter((r) => r.id !== row.id)); return; }
    setItems((x) => x.filter((r) => r.id !== row.id)); // optimistic
    const d = await api({ action: "delete", id: row.id }, dataKey, email);
    if (!(d?.ok && d?.deleted)) { toast(tr("Não consegui apagar — recarregando.")); reload(); }
    else toast(tr("Removido ✓"));
  };
  const patchLocal = (id, patch) => setItems((x) => (x || []).map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const templates = templatesFor(V);

  if (connected && items === null) return <SectionSkeleton rows={4} />;
  const list = items || [];

  return (
    <div className="space-y-4 stagger">
      {/* Header */}
      <div className="rounded-2xl border border-[#FF8A33]/25 bg-gradient-to-br from-[#FF8A33]/[0.07] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#FF8A33" }}>
          <FaBrain size={12} /> {tr("Cérebro do negócio")}
          {connected
            ? <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span>
            : <span className="text-g-muted normal-case font-bold text-[9px] border border-white/10 rounded-full px-1.5 py-px">{tr("exemplo")}</span>}
        </div>
        <div className="mt-1 text-xl font-black text-g-word">{list.length} {tr("respostas ensinadas")}</div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">{tr("As perguntas do SEU negócio, com a SUA resposta. A Gui usa isso igualzinho na ligação e no chat do site — em vez de mandar o cliente esperar o time.")}</p>
        {ready === false && <p className="mt-2 text-[11px] font-bold text-g-gold">{tr("Base ainda não ativada no servidor — o time aplica db/tenant_kb.sql e ela liga sozinha.")}</p>}
      </div>

      {/* New Q&A */}
      <Card>
        <div className="text-[11px] font-black uppercase tracking-wider text-g-muted flex items-center gap-2"><FaPlus size={10} /> {tr("Nova pergunta & resposta")}</div>
        <input value={draft.question} onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))} placeholder={tr("Ex: Vocês aceitam walk-in?")}
          className="mt-3 w-full rounded-xl2 border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-g-word placeholder:text-g-muted focus:border-[#FF8A33]/50 outline-none" />
        <textarea value={draft.answer} onChange={(e) => setDraft((d) => ({ ...d, answer: e.target.value }))} placeholder={tr("A resposta que a Gui deve dar…")} rows={2}
          className="mt-2 w-full rounded-xl2 border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-g-word placeholder:text-g-muted focus:border-[#FF8A33]/50 outline-none resize-y" />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            className="rounded-xl2 border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-g-word outline-none focus:border-[#FF8A33]/50">
            {CATS.map((c) => <option key={c} value={c} className="bg-[#161512]">{tr(catLabel[c])}</option>)}
          </select>
          <button onClick={() => addOrSave(draft)} disabled={savingId === "new"} className="inline-flex items-center gap-1.5 rounded-xl2 bg-[#FF8A33] text-black font-black px-4 py-2 text-[13px] disabled:opacity-40 clicky">
            <FaPlus size={11} /> {tr("Adicionar")}
          </button>
        </div>
        {/* Templates — one tap prefills the question above */}
        <div className="mt-3">
          <div className="text-[10.5px] font-bold uppercase tracking-wide text-g-muted">{tr("Modelos — toque pra preencher")}</div>
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
      {list.length === 0
        ? <Empty icon="📚" text={tr("Nenhuma resposta ainda — comece com um modelo acima.")} />
        : <div className="space-y-2.5">
            {list.map((r) => (
              <Card key={r.id} className={r.active === false ? "opacity-60" : ""}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <input value={r.question} onChange={(e) => patchLocal(r.id, { question: e.target.value })}
                      className="w-full rounded-lg border border-transparent hover:border-white/10 focus:border-[#FF8A33]/50 bg-transparent px-2 py-1 text-sm font-bold text-g-word outline-none" />
                    <textarea value={r.answer || ""} onChange={(e) => patchLocal(r.id, { answer: e.target.value })} rows={2} placeholder={tr("Resposta…")}
                      className="w-full rounded-lg border border-white/10 focus:border-[#FF8A33]/50 bg-white/[0.03] px-2.5 py-1.5 text-[13px] text-g-muted outline-none resize-y" />
                    <div className="flex flex-wrap items-center gap-2">
                      <select value={r.category || "general"} onChange={(e) => patchLocal(r.id, { category: e.target.value })}
                        className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[12px] text-g-word outline-none">
                        {CATS.map((c) => <option key={c} value={c} className="bg-[#161512]">{tr(catLabel[c])}</option>)}
                      </select>
                      <label className="inline-flex items-center gap-1.5 text-[12px] text-g-muted cursor-pointer">
                        <input type="checkbox" checked={r.active !== false} onChange={(e) => patchLocal(r.id, { active: e.target.checked })} className="accent-[#FF8A33]" />
                        {tr("Ativa (a Gui usa)")}
                      </label>
                      <button onClick={() => addOrSave(r)} disabled={savingId === r.id} className="inline-flex items-center gap-1.5 rounded-lg border border-g-green/40 bg-g-green/[0.10] px-2.5 py-1 text-[12px] font-black text-g-word hover:bg-g-green/20 transition disabled:opacity-40 min-h-[44px] inline-flex items-center">
                        <FaFloppyDisk size={10} /> {tr("Salvar")}
                      </button>
                      <button onClick={() => remove(r)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-[12px] font-bold text-g-muted hover:text-[#EF4444] hover:border-[#EF4444]/40 transition ml-auto min-h-[44px] inline-flex items-center">
                        <FaTrash size={10} /> {tr("Remover")}
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
