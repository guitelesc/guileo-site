/* Captura tab — the CAPTURE motor in the cockpit. Turns every touchpoint into a named lead:
     1) Intake forms  — build a pre-visit form, share the link, read the answers (each → a CRM lead).
     2) Photo → orçamento (home services) — a customer sends a photo + description; the owner prices
        it in one tap. Every submission best-effort becomes a CRM lead.
     3) Google Business — connect the location now; review-reply turns on when Google's API is approved
        (honest "awaiting API" state — nothing fake).

   Backends (this slice): POST /api/intake, /api/photo-quote, /api/google-business — all best-effort,
   returning safe defaults on any failure so the tab always degrades to its honest sample state.
   Registered by the Portal orchestrator (tab key 'capture'). */
import { useState, useEffect } from "react";
import { FaClipboardList, FaCamera, FaGoogle, FaLink, FaPlus, FaPen, FaCheck, FaCopy, FaArrowUpRightFromSquare, FaXmark } from "react-icons/fa6";
import { toast, chamarApi } from "../lib/portalApi.js";
import { tr, Card, Empty, UI_LANG } from "../pages/Portal.jsx";
import FalhaDeLeitura, { fraseDaFalha } from "./FalhaDeLeitura.jsx";
import FormFieldsEditor from "./FormFieldsEditor.jsx";
import { fb, fromServer, starterFields, buildFields } from "./formBuilderKit.js";

// ── API seam — never throws to the UI. Devolve {data, motivo}. ────────────────
// 🚨 (2026-09-28) A versão antiga devolvia `null` em toda falha e a tela fazia `d?.forms || []`:
// 401, 500 e rede caída viravam "No forms yet — create the first one". A dona criava o "primeiro"
// formulário de novo, por cima de formulários que já existiam e já estavam no ar.
const api = (path, body) => chamarApi(path, { ...body, lang: UI_LANG });
// Lê uma LISTA: {estado: "ok"|"off"|"falha", lista, motivo}. `off` = o servidor disse ready:false.
const lerLista = (r, campo) => {
  if (r.motivo) return { estado: "falha", motivo: r.motivo, lista: [] };
  if (r.data.ready === false) return { estado: "off", lista: [] };
  if (!Array.isArray(r.data[campo])) return { estado: "falha", motivo: "resposta_estranha", lista: [] };
  return { estado: "ok", lista: r.data[campo].filter(Boolean) };
};
const naoLigado = () => tr("This feature isn't switched on for your account yet. Message our team and we'll turn it on.");

const money = (cents) => `$${(Math.max(0, Number(cents) || 0) / 100).toFixed(2)}`;
const fmtWhen = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const loc = UI_LANG === "pt" ? "pt-BR" : UI_LANG === "es" ? "es-ES" : UI_LANG === "hi" ? "hi-IN" : "en-US";
  return d.toLocaleString(loc, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};
// Campos: antes eram uma caixa de texto ("Rótulo" por linha, * = obrigatório) e TODO campo saía
// type:"text" — não dava para pedir assinatura, sim/não ou múltipla escolha. Agora o construtor
// (FormFieldsEditor + formBuilderKit) grava {key,label,type,required,options?} no formato que a
// página pública /f/:id lê.
const formUrl = (id) => `${typeof window !== "undefined" ? window.location.origin : "https://guileoai.com"}/f/${id}`;

// ── Sample data (demo / not-connected) — deterministic, believable. Funções: saem no idioma
//    da tela (eram português fixo debaixo de um selo de exemplo em inglês). ─────────────────
const demoForms = () => [
  { id: "demo-1", name: tr("Pre-visit"), active: true, submissions: 12, fields: [{ label: tr("Name"), required: true }, { label: tr("Phone"), required: true }, { label: tr("Reason for the visit") }] },
  { id: "demo-2", name: tr("New customer sign-up"), active: true, submissions: 5, fields: [{ label: tr("Name"), required: true }, { label: tr("Email") }] },
];
const demoQuotes = () => [
  { id: "dq-1", name: "Marcus R.", contact: "(917) 555-0142", note: tr("Leak under the kitchen sink"), status: "pending", photo_url: "", created_at: new Date(Date.now() - 3.6e6).toISOString() },
  { id: "dq-2", name: "Paula S.", contact: "paula@email.com", note: tr("Painting 2 bedrooms"), status: "quoted", quote_cents: 85000, photo_url: "", created_at: new Date(Date.now() - 8.6e7).toISOString() },
];
// 🌐 O QUE O CLIENTE FINAL LÊ: os campos iniciais (starterFields) e os modelos nascem no idioma
// da tela da dona — nunca português fixo num formulário para clientes americanos.

const STATUS_META = {
  pending: { label: () => tr("Waiting"), color: "#FFC23D" },
  quoted: { label: () => tr("Quoted"), color: "#3E9468" },
  won: { label: () => tr("Won"), color: "#3E9468" },
  lost: { label: () => tr("Lost"), color: "#8A857C" },
};

function CaptureTools({ real = null, email = "", dataKey = "", onNav = null }) {
  const live = !!(real && email && dataKey);

  // ── Intake forms ──
  const [forms, setForms] = useState(null);       // null = loading (live)
  const [editing, setEditing] = useState(null);   // form being edited, or "new"
  const [fName, setFName] = useState("");
  const [fFields, setFFields] = useState([]);
  const [savedLink, setSavedLink] = useState(null); // {id, name} do último formulário salvo
  const L = fb(UI_LANG);
  const [subsFor, setSubsFor] = useState(null);   // form id whose submissions are open
  const [subs, setSubs] = useState([]);
  const [saving, setSaving] = useState(false);
  // estado de LEITURA de cada bloco: "carregando" | "ok" | "off" | {falha: motivo}
  const [leitura, setLeitura] = useState({ forms: "carregando", quotes: "carregando", gb: "carregando", subs: "ok" });
  const [tentativa, setTentativa] = useState(0);
  const marca = (k, v) => setLeitura((l) => ({ ...l, [k]: v }));
  const estadoDe = (x) => (x.estado === "falha" ? { falha: x.motivo } : x.estado);

  // ── Photo quotes ──
  const [quotes, setQuotes] = useState(null);
  const [priceFor, setPriceFor] = useState(null);
  const [priceVal, setPriceVal] = useState("");

  // ── Google Business ──
  const [gb, setGb] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!live) { setForms(demoForms()); setQuotes(demoQuotes()); setGb({ connected: false, ready: false, demo: true }); setLeitura({ forms: "ok", quotes: "ok", gb: "ok", subs: "ok" }); return; }
    // Não havia estado de carregando: enquanto a lista não chegava a tela já dizia "No forms yet".
    setForms(null); setQuotes(null); setGb(null);
    setLeitura({ forms: "carregando", quotes: "carregando", gb: "carregando", subs: "ok" });
    api("/api/intake", { action: "list_forms", email, token: dataKey }).then((r) => { if (!alive) return; const x = lerLista(r, "forms"); setForms(x.lista); marca("forms", estadoDe(x)); });
    api("/api/photo-quote", { action: "list", email, token: dataKey }).then((r) => { if (!alive) return; const x = lerLista(r, "quotes"); setQuotes(x.lista); marca("quotes", estadoDe(x)); });
    api("/api/google-business", { action: "status", email, token: dataKey }).then((r) => {
      if (!alive) return;
      // Falha de leitura NÃO é "not connected": o selo fica em "couldn't check".
      if (r.motivo) { setGb(null); marca("gb", { falha: r.motivo }); return; }
      setGb(r.data); marca("gb", "ok");
    });
    return () => { alive = false; };
  }, [live, email, dataKey, tentativa]);
  const recarregar = () => setTentativa((n) => n + 1);

  const openEditor = (f) => {
    setEditing(f || "new");
    setFName(f ? f.name : "");
    setFFields(f ? fromServer(f.fields) : starterFields(tr));
    setSubsFor(null);
    setSavedLink(null);
  };

  // Modelo: troca os campos (pergunta antes se já há algo escrito) e dá nome se não houver.
  const applyTemplate = (_k, name, list) => {
    const temConteudo = fFields.some((f) => (f.label || "").trim());
    if (temConteudo && typeof window !== "undefined" && !window.confirm(L.replaceConfirm)) return;
    setFFields(list);
    if (!fName.trim()) setFName(name);
  };

  const saveForm = async () => {
    if (!live) { toast(tr("Connect your account to create real forms.")); return; }
    // Sem campos não há formulário: pedir, em vez de publicar "Formulário" vazio.
    if (!fFields.length) { toast(tr("Add at least one field to the form.")); return; }
    const built = buildFields(fFields);
    if (built.erro) { toast(L[built.erro]); return; }
    const campos = built.fields;
    setSaving(true);
    const body = { action: "save_form", email, token: dataKey, name: fName.trim() || tr("Contact form"), fields: campos, active: true };
    if (editing && editing !== "new" && editing.id) body.id = editing.id;
    const r = await api("/api/intake", body);
    setSaving(false);
    const d = r.data;
    // 🚨 SUCESSO PRECISA DE COMPROVANTE. O servidor responde `{ok:true, ready:false}` quando NÃO
    // gravou — e a tela dizia "Form saved ✓" só por causa do `ok`. A dona mandava o link de um
    // formulário que não existe. Salvo = `ok` + `id` na mão, e nunca com `ready:false`.
    if (r.motivo) { toast(`${tr("Couldn't save — try again.")} ${fraseDaFalha(r.motivo)}`); return; }
    if (d.ready === false) { toast(naoLigado()); return; }
    if (d.ok && d.id) {
      toast(tr("Form saved ✓"));
      setEditing(null);
      setSavedLink({ id: d.id, name: body.name });
      const x = lerLista(await api("/api/intake", { action: "list_forms", email, token: dataKey }), "forms");
      if (x.estado === "ok") setForms(x.lista);
      marca("forms", estadoDe(x));
    } else toast(tr("Couldn't save — try again."));
  };

  // `forcar` = "tentar de novo": relê as respostas do MESMO formulário em vez de fechar o painel
  // (sem ele, o clique de tentar de novo caía no alternador e só fechava a lista).
  const openSubs = async (f, forcar = false) => {
    if (subsFor === f.id && !forcar) { setSubsFor(null); return; }
    setSubsFor(f.id); setSubs([]);
    if (!live) { setSubs([]); marca("subs", "ok"); return; }
    marca("subs", "carregando");
    const x = lerLista(await api("/api/intake", { action: "list_subs", email, token: dataKey, form_id: f.id }), "submissions");
    setSubs(x.lista); marca("subs", estadoDe(x));
  };

  const copyUrl = (url, ok) => {
    try { navigator.clipboard.writeText(url).then(() => toast(ok), () => toast(url)); }
    catch { toast(url); }
  };
  const shareLink = (f) => copyUrl(formUrl(f.id), tr("Link copied ✓ — send it to your customer."));

  const setQuote = async (q) => {
    const cents = Math.round(parseFloat((priceVal || "").replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 0) { toast(tr("Enter a valid amount.")); return; }
    setPriceFor(null);
    const antes = { quote_cents: q.quote_cents, status: q.status };
    setQuotes((qs) => (qs || []).map((x) => (x.id === q.id ? { ...x, quote_cents: cents, status: "quoted" } : x))); // optimistic
    if (!live) { toast(tr("Connect your account to send real quotes.")); return; }
    const r = await api("/api/photo-quote", { action: "quote", email, token: dataKey, id: q.id, quote_cents: cents, status: "quoted" });
    if (!r.motivo && r.data?.ok && r.data?.saved) toast(tr("Quote saved ✓ — Gui can send it to the customer."));
    else {
      // não gravou → o preço otimista SAI da tela; senão ela mostra um orçamento que o banco não tem
      setQuotes((qs) => (qs || []).map((x) => (x.id === q.id ? { ...x, ...antes } : x)));
      toast(`${tr("Couldn't save the quote.")}${r.motivo ? ` ${fraseDaFalha(r.motivo)}` : ""}`);
    }
  };

  // A conexão do Google é o consentimento OAUTH, que mora na tela "Google" (2026-09-30). Aqui
  // existia um atalho que pedia para COLAR um id de ficha e gravava por cima dos tokens — a rota
  // não aceita mais isso (os tokens só nascem do consentimento do dono no Google).
  const connectGoogle = () => {
    if (!live) { toast(tr("Connect your account first.")); return; }
    if (typeof onNav === "function") onNav("googlehub");
  };

  const formList = forms || [];
  const quoteList = quotes || [];

  return (
    <div className="space-y-5 stagger">
      {/* Header */}
      <div className="rounded-2xl border border-[#FF8A33]/25 bg-gradient-to-br from-[#FF8A33]/[0.07] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#FF8A33" }}>
          <FaClipboardList size={11} /> {tr("Capture")}
          {live
            ? <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green live-dot animate-pulse" />{tr("LIVE — real data")}</span>
            : <span className="text-g-muted normal-case font-bold text-[9px] border border-white/10 rounded-full px-1.5 py-px">{tr("estimate")}</span>}
        </div>
        <div className="mt-1 text-xl font-black text-g-word">{tr("Every contact becomes a lead with a name")}</div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">{tr("Pre-visit forms, photo quotes and Google reviews — every capture enters the CRM as a lead.")}</p>
      </div>

      {!live && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-2.5 text-[11px] font-bold text-g-gold">
          {tr("Sample data — connect your account to see real capture.")}
        </div>
      )}

      {/* ── 1) INTAKE FORMS ── */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-g-gold inline-flex items-center gap-2"><FaClipboardList size={11} /> {tr("Capture forms")}</span>
          <button onClick={() => openEditor(null)} className="inline-flex items-center gap-1.5 rounded-full border border-g-gold/35 bg-g-gold/10 px-3 py-1.5 text-[11px] font-bold text-g-word hover:bg-g-gold/20 transition">
            <FaPlus size={9} /> {tr("New form")}
          </button>
        </div>

        {editing && (
          <div className="px-5 py-4 border-b border-white/10 bg-white/[0.02] space-y-3">
            <input value={fName} onChange={(e) => setFName(e.target.value)} placeholder={tr("Form name (e.g. Pre-visit)")}
              className="w-full rounded-xl2 border border-white/12 bg-white/[0.04] px-3.5 py-2.5 text-sm text-g-word placeholder:text-g-muted/60 focus:border-g-gold/50 focus:outline-none" />
            <FormFieldsEditor fields={fFields} onChange={setFFields} L={L} onTemplate={applyTemplate} />
            <div className="flex items-center gap-2">
              <button onClick={saveForm} disabled={saving} className="rounded-full bg-g-gold/90 px-4 py-1.5 text-[12px] font-black text-black hover:bg-g-gold transition disabled:opacity-50">{saving ? tr("Saving…") : tr("Save form")}</button>
              <button onClick={() => setEditing(null)} className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-bold text-g-muted hover:text-g-word transition">{tr("Cancel")}</button>
            </div>
          </div>
        )}

        {savedLink && !editing && (
          <div className="px-5 py-3.5 border-b border-white/10 bg-g-green/[0.06]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black text-g-green inline-flex items-center gap-1.5"><FaCheck size={10} /> {L.savedTitle}</span>
              <button type="button" onClick={() => setSavedLink(null)} title={L.close} aria-label={L.close} className="text-g-muted hover:text-g-word transition"><FaXmark size={11} /></button>
            </div>
            <div className="mt-2 flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
              <input readOnly value={formUrl(savedLink.id)} onFocus={(e) => e.target.select()} aria-label={savedLink.name}
                className="flex-1 min-w-0 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-[12px] text-g-word font-mono focus:outline-none" />
              <button type="button" onClick={() => copyUrl(formUrl(savedLink.id), L.copied)} className="inline-flex items-center gap-1 rounded-full bg-g-gold/90 px-3 py-1.5 text-[11px] font-black text-black hover:bg-g-gold transition"><FaCopy size={9} /> {L.copy}</button>
              <a href={`/f/${savedLink.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-g-word hover:border-g-gold/40 transition"><FaArrowUpRightFromSquare size={9} /> {L.open}</a>
            </div>
          </div>
        )}

        {leitura.forms === "carregando" ? (
          <div className="px-5 py-5"><div className="h-12 rounded-xl2 bg-white/[0.04] animate-pulse" /></div>
        ) : leitura.forms?.falha ? (
          <div className="px-5 py-4"><FalhaDeLeitura compacto motivo={leitura.forms.falha} onRetry={recarregar} titulo={tr("I couldn't load your forms just now.")} /></div>
        ) : leitura.forms === "off" ? (
          <Empty icon="🔌" text={naoLigado()} />
        ) : formList.length === 0 ? (
          <Empty icon="📝" text={tr("No forms yet — create the first one to capture customers before the visit.")} />
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {formList.map((f, i) => (
              <div key={f.id || i} style={{ animationDelay: `${i * 40}ms` }} className="row-in px-5 py-3">
                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                  <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-base shrink-0">📝</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-g-word truncate">{f.name}{f.active === false ? <span className="text-g-muted font-normal"> · {tr("inactive")}</span> : null}</div>
                    <div className="text-[11px] text-g-muted truncate">{(f.fields?.length || 0)} {tr("fields")} · {f.submissions || 0} {tr("answers")}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => shareLink(f)} className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-g-muted hover:text-g-word transition"><FaLink size={9} /> {tr("Link")}</button>
                    <button onClick={() => openSubs(f)} className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-g-muted hover:text-g-word transition">{tr("Answers")}</button>
                    <button onClick={() => openEditor(f)} className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-g-muted hover:text-g-word transition"><FaPen size={9} /></button>
                  </div>
                </div>
                {subsFor === f.id && (
                  <div className="mt-2.5 ml-12 rounded-xl2 border border-white/10 bg-white/[0.02] px-3.5 py-2.5">
                    {leitura.subs === "carregando" ? (
                      <div className="text-[11px] text-g-muted animate-pulse">{tr("Loading…")}</div>
                    ) : leitura.subs?.falha ? (
                      <FalhaDeLeitura compacto motivo={leitura.subs.falha} onRetry={() => openSubs(f, true)} titulo={tr("I couldn't load the answers just now.")} />
                    ) : leitura.subs === "off" ? (
                      <div className="text-[11px] text-g-muted">{naoLigado()}</div>
                    ) : subs.length === 0 ? (
                      <div className="text-[11px] text-g-muted">{live ? tr("No answers yet.") : tr("Connect your account to see real answers.")}</div>
                    ) : subs.map((s2, j) => (
                      <div key={s2.id || j} className="py-1.5 border-b border-white/[0.05] last:border-0">
                        <div className="text-xs font-bold text-g-word">{s2.contact?.name || tr("Customer")} <span className="text-g-muted font-normal">· {s2.contact?.phone || s2.contact?.email || ""}</span></div>
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
          <span className="text-xs font-bold uppercase tracking-wide text-g-gold inline-flex items-center gap-2"><FaCamera size={11} /> {tr("Photo quote")}</span>
          <span className="text-[11px] text-g-muted hidden sm:inline">{tr("customer sends photo → you set the price")}</span>
        </div>
        {leitura.quotes === "carregando" ? (
          <div className="px-5 py-5"><div className="h-12 rounded-xl2 bg-white/[0.04] animate-pulse" /></div>
        ) : leitura.quotes?.falha ? (
          <div className="px-5 py-4"><FalhaDeLeitura compacto motivo={leitura.quotes.falha} onRetry={recarregar} titulo={tr("I couldn't load your quote requests just now.")} /></div>
        ) : leitura.quotes === "off" ? (
          <Empty icon="🔌" text={naoLigado()} />
        ) : quoteList.length === 0 ? (
          <Empty icon="📷" text={tr("No quote requests — share your capture link to receive photos.")} />
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
                      <div className="text-sm font-bold text-g-word truncate">{q.name || tr("Customer")} <span className="text-g-muted font-normal">· {q.contact || ""}</span></div>
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
                            className="rounded-full border border-g-gold/35 bg-g-gold/10 px-3 py-1.5 text-[11px] font-bold text-g-word hover:bg-g-gold/20 transition whitespace-nowrap">{tr("Give price")}</button>
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
              <span className="text-sm font-black text-g-word">{tr("Google reviews")}</span>
              {leitura.gb === "carregando"
                ? <span className="text-[9px] font-bold text-g-muted uppercase animate-pulse">{tr("Checking…")}</span>
                : leitura.gb?.falha
                ? <span className="text-[9px] font-black text-[#e0855f] border border-[#e0855f]/40 rounded-full px-1.5 py-px uppercase">{tr("couldn't check")}</span>
                : gb?.ready
                ? <span className="inline-flex items-center gap-1 text-[9px] font-black text-g-green"><span className="h-1.5 w-1.5 rounded-full bg-g-green" /> {tr("connected")}</span>
                : gb?.connected
                  ? <span className="text-[9px] font-black text-g-gold border border-g-gold/30 rounded-full px-1.5 py-px uppercase">{tr("awaiting API")}</span>
                  : <span className="text-[9px] font-bold text-g-muted border border-white/12 rounded-full px-1.5 py-px uppercase">{tr("not connected")}</span>}
            </div>
            <p className="mt-1 text-xs text-g-muted max-w-lg">{tr("Connect your Google listing so Gui can read your reviews and draft replies. Nothing is published until you approve it.")}</p>
          </div>
          <button onClick={leitura.gb?.falha ? recarregar : connectGoogle} disabled={leitura.gb === "carregando"} className="shrink-0 rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-[11px] font-bold text-g-word hover:border-g-gold/40 transition">
            {leitura.gb?.falha ? tr("↻ Try again") : gb?.connected ? tr("Reconnect") : tr("Connect")}
          </button>
        </div>
      </Card>
    </div>
  );
}

export default CaptureTools;
