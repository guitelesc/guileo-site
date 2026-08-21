/* Captura tab — the CAPTURE motor in the cockpit. Turns every touchpoint into a named lead:
     1) Intake forms  — build a pre-visit form, share the link, read the answers (each → a CRM lead).
     2) Photo → orçamento (home services) — a customer sends a photo + description; the owner prices
        it in one tap. Every submission best-effort becomes a CRM lead.
     3) Google Business — connect the location now; review-reply turns on when Google's API is approved
        (honest "aguardando API" state — nothing fake).

   Backends (this slice): POST /api/intake, /api/photo-quote, /api/google-business — all best-effort,
   returning safe defaults on any failure so the tab always degrades to its honest sample state.
   Registered by the Portal orchestrator (tab key 'capture'). */
import { useState, useEffect } from "react";
import { FaClipboardList, FaCamera, FaGoogle, FaLink, FaPlus, FaPen, FaCheck } from "react-icons/fa6";
import { toast } from "../lib/portalApi.js";
import { tr, Card, Empty, SectionSkeleton, UI_LANG } from "../pages/Portal.jsx";

// ── API seam — never throws to the UI ─────────────────────────────────────────
async function api(path, body) {
  try {
    const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

const money = (cents) => `$${(Math.max(0, Number(cents) || 0) / 100).toFixed(2)}`;
const fmtWhen = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const loc = UI_LANG === "pt" ? "pt-BR" : UI_LANG === "es" ? "es-ES" : UI_LANG === "hi" ? "hi-IN" : "en-US";
  return d.toLocaleString(loc, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};
// Fields are entered one-per-line ("Label" or "Label*" for required) — pragmatic, matches the copy.
const parseFields = (text) => (text || "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 30).map((l) => {
  const required = l.endsWith("*");
  const label = (required ? l.slice(0, -1) : l).trim();
  return { key: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 60) || "campo", label, type: "text", required };
});
const fieldsToText = (fields) => (Array.isArray(fields) ? fields : []).map((f) => `${f.label || f.key}${f.required ? "*" : ""}`).join("\n");

// ── Sample data (demo / not-connected) — deterministic, believable ────────────
const DEMO_FORMS = [
  { id: "demo-1", name: "Pré-consulta", active: true, submissions: 12, fields: [{ label: "Nome", required: true }, { label: "Telefone", required: true }, { label: "Motivo da visita" }] },
  { id: "demo-2", name: "Cadastro de cliente", active: true, submissions: 5, fields: [{ label: "Nome", required: true }, { label: "E-mail" }] },
];
const DEMO_QUOTES = [
  { id: "dq-1", name: "Marcos R.", contact: "(11) 99876-5432", note: "Vazamento embaixo da pia da cozinha", status: "pending", photo_url: "", created_at: new Date(Date.now() - 3.6e6).toISOString() },
  { id: "dq-2", name: "Paula S.", contact: "paula@email.com", note: "Pintura de 2 quartos, ~28m²", status: "quoted", quote_cents: 85000, photo_url: "", created_at: new Date(Date.now() - 8.6e7).toISOString() },
];

const STATUS_META = {
  pending: { label: () => tr("Aguardando"), color: "#FFC23D" },
  quoted: { label: () => tr("Orçado"), color: "#3E9468" },
  won: { label: () => tr("Fechado"), color: "#3E9468" },
  lost: { label: () => tr("Perdido"), color: "#8A857C" },
};

function CaptureTools({ V, real = null, email = "", dataKey = "" }) {
  const live = !!(real && email && dataKey);

  // ── Intake forms ──
  const [forms, setForms] = useState(null);       // null = loading (live)
  const [editing, setEditing] = useState(null);   // form being edited, or "new"
  const [fName, setFName] = useState("");
  const [fFields, setFFields] = useState("");
  const [subsFor, setSubsFor] = useState(null);   // form id whose submissions are open
  const [subs, setSubs] = useState([]);
  const [saving, setSaving] = useState(false);

  // ── Photo quotes ──
  const [quotes, setQuotes] = useState(null);
  const [priceFor, setPriceFor] = useState(null);
  const [priceVal, setPriceVal] = useState("");

  // ── Google Business ──
  const [gb, setGb] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!live) { setForms(DEMO_FORMS); setQuotes(DEMO_QUOTES); setGb({ connected: false, ready: false, demo: true }); return; }
    api("/api/intake", { action: "list_forms", email, token: dataKey }).then((d) => { if (alive) setForms(d?.forms || []); });
    api("/api/photo-quote", { action: "list", email, token: dataKey }).then((d) => { if (alive) setQuotes(d?.quotes || []); });
    api("/api/google-business", { action: "status", email, token: dataKey }).then((d) => { if (alive) setGb(d || { connected: false, ready: false }); });
    return () => { alive = false; };
  }, [live, email, dataKey]);

  const openEditor = (f) => {
    setEditing(f || "new");
    setFName(f ? f.name : "");
    setFFields(f ? fieldsToText(f.fields) : "Nome*\nTelefone*\nE-mail");
    setSubsFor(null);
  };

  const saveForm = async () => {
    if (!live) { toast(tr("Conecte sua conta para criar formulários reais.")); return; }
    setSaving(true);
    const body = { action: "save_form", email, token: dataKey, name: fName || "Formulário", fields: parseFields(fFields), active: true };
    if (editing && editing !== "new" && editing.id) body.id = editing.id;
    const d = await api("/api/intake", body);
    setSaving(false);
    if (d?.ok) {
      toast(tr("Formulário salvo ✓"));
      setEditing(null);
      const r = await api("/api/intake", { action: "list_forms", email, token: dataKey });
      setForms(r?.forms || []);
    } else toast(tr("Não consegui salvar — tente de novo."));
  };

  const openSubs = async (f) => {
    if (subsFor === f.id) { setSubsFor(null); return; }
    setSubsFor(f.id); setSubs([]);
    if (!live) { setSubs([]); return; }
    const d = await api("/api/intake", { action: "list_subs", email, token: dataKey, form_id: f.id });
    setSubs(d?.submissions || []);
  };

  const shareLink = (f) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://guileoai.com";
    const url = `${origin}/f/${f.id}`;
    try { navigator.clipboard.writeText(url); toast(tr("Link copiado ✓ — envie ao cliente.")); }
    catch { toast(url); }
  };

  const setQuote = async (q) => {
    const cents = Math.round(parseFloat((priceVal || "").replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 0) { toast(tr("Informe um valor válido.")); return; }
    setPriceFor(null);
    setQuotes((qs) => qs.map((x) => (x.id === q.id ? { ...x, quote_cents: cents, status: "quoted" } : x))); // optimistic
    if (!live) { toast(tr("Conecte sua conta para enviar orçamentos reais.")); return; }
    const d = await api("/api/photo-quote", { action: "quote", email, token: dataKey, id: q.id, quote_cents: cents, status: "quoted" });
    if (d?.ok && d?.saved) toast(tr("Orçamento salvo ✓ — Gui pode enviar ao cliente."));
    else toast(tr("Não consegui salvar o orçamento."));
  };

  const connectGoogle = async () => {
    if (!live) { toast(tr("Conecte sua conta primeiro.")); return; }
    // Minimal capture: in production this is an OAuth handoff; here we accept the location id the owner pastes.
    const location_id = typeof window !== "undefined" ? window.prompt(tr("ID da localização no Google Business:")) : "";
    if (!location_id) return;
    const d = await api("/api/google-business", { action: "connect", email, token: dataKey, location_id });
    if (d?.ok) { toast(d.ready ? tr("Google Business conectado ✓") : tr("Conexão salva ✓ — respostas ligam quando a API for aprovada.")); setGb({ ...(gb || {}), connected: true, ready: !!d.ready }); }
    else toast(tr("Não consegui conectar agora."));
  };

  const formList = forms || [];
  const quoteList = quotes || [];

  return (
    <div className="space-y-5 stagger">
      {/* Header */}
      <div className="rounded-2xl border border-[#FF8A33]/25 bg-gradient-to-br from-[#FF8A33]/[0.07] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#FF8A33" }}>
          <FaClipboardList size={11} /> {tr("Captura")}
          {live
            ? <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span>
            : <span className="text-g-muted normal-case font-bold text-[9px] border border-white/10 rounded-full px-1.5 py-px">{tr("estimate")}</span>}
        </div>
        <div className="mt-1 text-xl font-black text-g-word">{tr("Todo contato vira um lead com nome")}</div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">{tr("Formulários pré-visita, orçamento por foto e avaliações do Google — cada captura entra no CRM como lead.")}</p>
      </div>

      {!live && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-2.5 text-[11px] font-bold text-g-gold">
          {tr("Dados de exemplo — conecte sua conta para ver a captura real.")}
        </div>
      )}

      {/* ── 1) INTAKE FORMS ── */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-g-gold inline-flex items-center gap-2"><FaClipboardList size={11} /> {tr("Formulários de captura")}</span>
          <button onClick={() => openEditor(null)} className="inline-flex items-center gap-1.5 rounded-full border border-g-gold/35 bg-g-gold/10 px-3 py-1.5 text-[11px] font-bold text-g-word hover:bg-g-gold/20 transition">
            <FaPlus size={9} /> {tr("Novo formulário")}
          </button>
        </div>

        {editing && (
          <div className="px-5 py-4 border-b border-white/10 bg-white/[0.02] space-y-3">
            <input value={fName} onChange={(e) => setFName(e.target.value)} placeholder={tr("Nome do formulário (ex.: Pré-consulta)")}
              className="w-full rounded-xl2 border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-g-word placeholder:text-g-muted/60 focus:border-g-gold/50 focus:outline-none" />
            <div>
              <div className="text-[11px] font-bold text-g-muted mb-1">{tr("Campos — um por linha, use * para obrigatório")}</div>
              <textarea value={fFields} onChange={(e) => setFFields(e.target.value)} rows={4} placeholder={"Nome*\nTelefone*\nE-mail\nMotivo da visita"}
                className="w-full rounded-xl2 border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-g-word placeholder:text-g-muted/50 focus:border-g-gold/50 focus:outline-none font-mono" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={saveForm} disabled={saving} className="rounded-full bg-g-gold/90 px-4 py-1.5 text-[12px] font-black text-black hover:bg-g-gold transition disabled:opacity-50">{saving ? tr("Salvando…") : tr("Salvar formulário")}</button>
              <button onClick={() => setEditing(null)} className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-bold text-g-muted hover:text-g-word transition">{tr("Cancel")}</button>
            </div>
          </div>
        )}

        {formList.length === 0 ? (
          <Empty icon="📝" text={tr("Nenhum formulário ainda — crie o primeiro para captar clientes antes da visita.")} />
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {formList.map((f, i) => (
              <div key={f.id || i} style={{ animationDelay: `${i * 40}ms` }} className="row-in px-5 py-3">
                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-base shrink-0">📝</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-g-word truncate">{f.name}{f.active === false ? <span className="text-g-muted font-normal"> · {tr("inativo")}</span> : null}</div>
                    <div className="text-[11px] text-g-muted truncate">{(f.fields?.length || 0)} {tr("campos")} · {f.submissions || 0} {tr("respostas")}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => shareLink(f)} className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-g-muted hover:text-g-word transition"><FaLink size={9} /> {tr("Link")}</button>
                    <button onClick={() => openSubs(f)} className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-g-muted hover:text-g-word transition">{tr("Respostas")}</button>
                    <button onClick={() => openEditor(f)} className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-g-muted hover:text-g-word transition"><FaPen size={9} /></button>
                  </div>
                </div>
                {subsFor === f.id && (
                  <div className="mt-2.5 ml-12 rounded-xl2 border border-white/10 bg-white/[0.02] px-3.5 py-2.5">
                    {subs.length === 0 ? (
                      <div className="text-[11px] text-g-muted">{live ? tr("Nenhuma resposta ainda.") : tr("Conecte sua conta para ver respostas reais.")}</div>
                    ) : subs.map((s2, j) => (
                      <div key={s2.id || j} className="py-1.5 border-b border-white/[0.05] last:border-0">
                        <div className="text-xs font-bold text-g-word">{s2.contact?.name || tr("Cliente")} <span className="text-g-muted font-normal">· {s2.contact?.phone || s2.contact?.email || ""}</span></div>
                        <div className="text-[10px] text-g-muted">{fmtWhen(s2.created_at)}{s2.answers ? ` · ${Object.values(s2.answers).slice(0, 3).join(" · ")}` : ""}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── 2) PHOTO → QUOTE ── */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-g-gold inline-flex items-center gap-2"><FaCamera size={11} /> {tr("Orçamento por foto")}</span>
          <span className="text-[11px] text-g-muted hidden sm:inline">{tr("cliente manda foto → você põe o preço")}</span>
        </div>
        {quoteList.length === 0 ? (
          <Empty icon="📷" text={tr("Sem pedidos de orçamento — compartilhe seu link de captura para receber fotos.")} />
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {quoteList.map((q, i) => {
              const meta = STATUS_META[q.status] || STATUS_META.pending;
              const isPricing = priceFor === q.id;
              return (
                <div key={q.id || i} style={{ animationDelay: `${i * 40}ms` }} className="row-in px-5 py-3">
                  <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                    {q.photo_url
                      ? <img src={q.photo_url} alt="" className="h-11 w-11 rounded-lg object-cover bg-white/[0.06] shrink-0" />
                      : <span className="grid place-items-center h-11 w-11 rounded-lg bg-white/[0.06] text-base shrink-0">📷</span>}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-g-word truncate">{q.name || tr("Cliente")} <span className="text-g-muted font-normal">· {q.contact || ""}</span></div>
                      <div className="text-[11px] text-g-muted truncate">{q.note || ""}{q.created_at ? ` · ${fmtWhen(q.created_at)}` : ""}</div>
                    </div>
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-black whitespace-nowrap" style={{ color: meta.color, background: `${meta.color}1e`, boxShadow: `inset 0 0 0 1px ${meta.color}40` }}>
                      {q.quote_cents ? money(q.quote_cents) : meta.label()}
                    </span>
                    <div className="shrink-0">
                      {q.status === "pending" || isPricing ? (
                        isPricing ? (
                          <div className="inline-flex items-center gap-1.5">
                            <span className="text-g-muted text-xs">$</span>
                            <input autoFocus value={priceVal} onChange={(e) => setPriceVal(e.target.value)} placeholder="0.00" inputMode="decimal"
                              className="w-20 rounded-full border border-g-gold/40 bg-white/[0.04] px-2.5 py-1 text-[12px] text-g-word focus:outline-none" />
                            <button onClick={() => setQuote(q)} className="rounded-full bg-g-gold/90 px-2.5 py-1 text-[11px] font-black text-black hover:bg-g-gold transition min-h-[44px] inline-flex items-center"><FaCheck size={10} /></button>
                          </div>
                        ) : (
                          <button onClick={() => { setPriceFor(q.id); setPriceVal(q.quote_cents ? (q.quote_cents / 100).toString() : ""); }}
                            className="rounded-full border border-g-gold/35 bg-g-gold/10 px-3 py-1.5 text-[11px] font-bold text-g-word hover:bg-g-gold/20 transition whitespace-nowrap">{tr("Dar preço")}</button>
                        )
                      ) : (
                        <button onClick={() => { setPriceFor(q.id); setPriceVal(q.quote_cents ? (q.quote_cents / 100).toString() : ""); }}
                          className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-g-muted hover:text-g-word transition whitespace-nowrap"><FaPen size={9} /></button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── 3) GOOGLE BUSINESS (pending API) ── */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center h-11 w-11 rounded-xl bg-white/[0.06] text-lg shrink-0"><FaGoogle /></span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-g-word">{tr("Avaliações do Google")}</span>
              {gb?.ready
                ? <span className="inline-flex items-center gap-1 text-[9px] font-black text-g-green"><span className="h-1.5 w-1.5 rounded-full bg-g-green" /> {tr("conectado")}</span>
                : gb?.connected
                  ? <span className="text-[9px] font-black text-g-gold border border-g-gold/30 rounded-full px-1.5 py-px uppercase">{tr("aguardando API")}</span>
                  : <span className="text-[9px] font-bold text-g-muted border border-white/12 rounded-full px-1.5 py-px uppercase">{tr("não conectado")}</span>}
            </div>
            <p className="mt-1 text-xs text-g-muted max-w-lg">{tr("Conecte sua ficha do Google para o Gui ler e responder avaliações automaticamente. A conexão pode ser salva agora; as respostas ligam assim que a API do Google for aprovada.")}</p>
          </div>
          <button onClick={connectGoogle} className="shrink-0 rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-bold text-g-word hover:border-g-gold/40 transition">
            {gb?.connected ? tr("Reconectar") : tr("Conectar")}
          </button>
        </div>
      </Card>
    </div>
  );
}

export default CaptureTools;
