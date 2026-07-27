import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// 🗓️ SellerFollowup — the seller's PERSONAL chase CRM ("Follow-up"). Everything that happens BEFORE
// a lead becomes a client: who was approached, what stage the deal is in, the next touch, a quick
// note. When a prospect reaches 🤝 Fechado the seller cadastra them in the ➕ Add client tab (that's
// where the real onboarding draft is born) — this tab is the HUNT, not the onboarding.
//
// Data: POST /api/seller-prospects (sellerAuthFull) → sp_* RPCs (db/seller_prospects.sql), every call
// SELLER-SCOPED server-side — a seller only ever sees their own prospects. Live: refetches every 60s
// + on tab focus. Design follows the hub: cement + Gui signal colors. Props { lang, seller }.

// ── the 6 pipeline stages (canonical keys match the SQL) + a signal color each ──────────────────
const STAGES = ["abordado", "conversa", "demo", "proposta", "fechado", "perdido"];
const STAGE_HEX = {
  abordado: "#948C7B", // taupe — just made contact
  conversa: "#5B9BD5", // info blue — a real conversation is going
  demo:     "#FF8A33", // Gui orange — showing the product
  proposta: "#f2b23e", // attention amber — price on the table
  fechado:  "#3E9468", // done green — won
  perdido:  "#8a5a5a", // muted red — lost
};

const T = {
  pt: {
    title: "🗓️ Follow-up", sub: "Seu acompanhamento pessoal. Cada alvo que você abordou fica aqui até virar cliente — mova de etapa, marque o próximo toque e nunca perca a hora de dar um oi.",
    refresh: "↻ Atualizar", loading: "Carregando seus prospects…",
    err: "Não consegui carregar agora — tenta atualizar.",
    all: "Todos",
    stages: { abordado: "Abordado", conversa: "Conversa", demo: "Demo", proposta: "Proposta", fechado: "Fechado", perdido: "Perdido" },
    needYou: "🔔 Precisa de você hoje", needYouSub: "Prospects com toque vencido ou parados há 3+ dias. Manda um oi.",
    daysAgo: "Faz {n} dias que você falou com {x} — manda um oi", overdue: "Toque agendado venceu — fala com {x}",
    today: "hoje", tomorrow: "amanhã",
    newBtn: "＋ Novo prospect", newTitle: "Novo prospect", biz: "Negócio", contact: "Contato", phone: "Telefone", emailF: "E-mail (opcional)", market: "Mercado",
    save: "Salvar", saving: "Salvando…", cancel: "Cancelar", needBiz: "Escreva o nome do negócio.",
    empty: "Nenhum prospect ainda.", emptyHint: "Adicione o primeiro alvo que você abordou — clica em ＋ Novo prospect. (Achou os alvos na aba 🎯 Alvos do dia.)",
    emptyFilter: "Nenhum prospect nesta etapa.",
    call: "Ligar", wa: "WhatsApp", mail: "E-mail",
    moveTo: "Mover para", note: "Nota", notePh: "O que rolou? Próximo passo…", noteSave: "Salvar nota", noteEdit: "✎ Nota",
    del: "Excluir", delConfirm: "Excluir este prospect?",
    nextLabel: "Próximo toque", nextClear: "limpar",
    wonTip: "🎉 Fechou! Agora cadastra ele na aba ➕ Cadastrar cliente pra nascer a Gui dele.",
    actTrain: "🎭 Treinar", actQuote: "🧾 Orçamento", actContract: "📄 Contrato", actReg: "➕ Cadastrar", wonCta: "➕ Cadastrar agora",
    waMsg: "Oi {name}! Aqui é da Guileo 🌱 Passando pra retomar nossa conversa sobre a recepcionista de IA pro {biz} — ela atende toda ligação, agenda e nunca perde um cliente. Quando fica bom a gente conversar 2 min?",
    lastTouch: "Último toque", never: "—",
  },
  en: {
    title: "🗓️ Follow-up", sub: "Your personal chase. Every target you approached lives here until they become a client — move stages, set the next touch, and never miss the moment to say hi.",
    refresh: "↻ Refresh", loading: "Loading your prospects…",
    err: "Couldn't load right now — try refreshing.",
    all: "All",
    stages: { abordado: "Approached", conversa: "Talking", demo: "Demo", proposta: "Proposal", fechado: "Closed", perdido: "Lost" },
    needYou: "🔔 Needs you today", needYouSub: "Prospects with an overdue touch or idle for 3+ days. Send a hi.",
    daysAgo: "It's been {n} days since you spoke to {x} — send a hi", overdue: "Scheduled touch is overdue — reach {x}",
    today: "today", tomorrow: "tomorrow",
    newBtn: "＋ New prospect", newTitle: "New prospect", biz: "Business", contact: "Contact", phone: "Phone", emailF: "Email (optional)", market: "Market",
    save: "Save", saving: "Saving…", cancel: "Cancel", needBiz: "Type the business name.",
    empty: "No prospects yet.", emptyHint: "Add the first target you approached — tap ＋ New prospect. (Find targets in the 🎯 Targets of the day tab.)",
    emptyFilter: "No prospects in this stage.",
    call: "Call", wa: "WhatsApp", mail: "Email",
    moveTo: "Move to", note: "Note", notePh: "What happened? Next step…", noteSave: "Save note", noteEdit: "✎ Note",
    del: "Delete", delConfirm: "Delete this prospect?",
    nextLabel: "Next touch", nextClear: "clear",
    wonTip: "🎉 Closed! Now add them in the ➕ Add client tab to bring their Gui to life.",
    actTrain: "🎭 Train", actQuote: "🧾 Quote", actContract: "📄 Contract", actReg: "➕ Register", wonCta: "➕ Add now",
    waMsg: "Hi {name}! This is Guileo 🌱 Circling back on the AI receptionist for {biz} — she answers every call, books appointments and never loses a customer. When's a good time for a quick 2-min chat?",
    lastTouch: "Last touch", never: "—",
  },
  es: {
    title: "🗓️ Seguimiento", sub: "Tu seguimiento personal. Cada objetivo que abordaste vive aquí hasta volverse cliente — mueve etapas, marca el próximo toque y nunca pierdas el momento de saludar.",
    refresh: "↻ Actualizar", loading: "Cargando tus prospectos…",
    err: "No pude cargar ahora — intenta actualizar.",
    all: "Todos",
    stages: { abordado: "Abordado", conversa: "Conversación", demo: "Demo", proposta: "Propuesta", fechado: "Cerrado", perdido: "Perdido" },
    needYou: "🔔 Te necesita hoy", needYouSub: "Prospectos con toque vencido o parados 3+ días. Manda un saludo.",
    daysAgo: "Hace {n} días que hablaste con {x} — manda un saludo", overdue: "El toque agendado venció — habla con {x}",
    today: "hoy", tomorrow: "mañana",
    newBtn: "＋ Nuevo prospecto", newTitle: "Nuevo prospecto", biz: "Negocio", contact: "Contacto", phone: "Teléfono", emailF: "Correo (opcional)", market: "Mercado",
    save: "Guardar", saving: "Guardando…", cancel: "Cancelar", needBiz: "Escribe el nombre del negocio.",
    empty: "Sin prospectos aún.", emptyHint: "Agrega el primer objetivo que abordaste — toca ＋ Nuevo prospecto. (Encuentra objetivos en la pestaña 🎯 Objetivos del día.)",
    emptyFilter: "Sin prospectos en esta etapa.",
    call: "Llamar", wa: "WhatsApp", mail: "Correo",
    moveTo: "Mover a", note: "Nota", notePh: "¿Qué pasó? Próximo paso…", noteSave: "Guardar nota", noteEdit: "✎ Nota",
    del: "Eliminar", delConfirm: "¿Eliminar este prospecto?",
    nextLabel: "Próximo toque", nextClear: "limpiar",
    wonTip: "🎉 ¡Cerrado! Ahora regístralo en la pestaña ➕ Alta cliente para dar vida a su Gui.",
    actTrain: "🎭 Entrenar", actQuote: "🧾 Cotización", actContract: "📄 Contrato", actReg: "➕ Registrar", wonCta: "➕ Registrar ahora",
    waMsg: "¡Hola {name}! Soy de Guileo 🌱 Retomando lo de la recepcionista de IA para {biz} — contesta cada llamada, agenda citas y nunca pierde un cliente. ¿Cuándo te viene bien charlar 2 min?",
    lastTouch: "Último toque", never: "—",
  },
  hi: {
    title: "🗓️ फ़ॉलो-अप", sub: "आपका निजी फ़ॉलो-अप। जिस भी लक्ष्य से आपने संपर्क किया वह क्लाइंट बनने तक यहीं रहता है — स्टेज बदलें, अगला टच सेट करें और हैलो कहने का पल कभी न चूकें।",
    refresh: "↻ रिफ्रेश", loading: "आपके प्रॉस्पेक्ट लोड हो रहे हैं…",
    err: "अभी लोड नहीं कर सका — रिफ्रेश करें।",
    all: "सभी",
    stages: { abordado: "संपर्क किया", conversa: "बातचीत", demo: "डेमो", proposta: "प्रस्ताव", fechado: "बंद", perdido: "खोया" },
    needYou: "🔔 आज आपकी ज़रूरत है", needYouSub: "जिनका टच ओवरड्यू है या 3+ दिन से रुके हैं। एक हैलो भेजें।",
    daysAgo: "{x} से बात किए {n} दिन हो गए — एक हैलो भेजें", overdue: "तय टच ओवरड्यू है — {x} से बात करें",
    today: "आज", tomorrow: "कल",
    newBtn: "＋ नया प्रॉस्पेक्ट", newTitle: "नया प्रॉस्पेक्ट", biz: "व्यवसाय", contact: "संपर्क", phone: "फ़ोन", emailF: "ईमेल (वैकल्पिक)", market: "बाज़ार",
    save: "सेव करें", saving: "सेव हो रहा…", cancel: "रद्द करें", needBiz: "व्यवसाय का नाम लिखें।",
    empty: "अभी कोई प्रॉस्पेक्ट नहीं।", emptyHint: "जिस पहले लक्ष्य से आपने संपर्क किया उसे जोड़ें — ＋ नया प्रॉस्पेक्ट दबाएँ। (लक्ष्य 🎯 टैब में मिलेंगे।)",
    emptyFilter: "इस स्टेज में कोई प्रॉस्पेक्ट नहीं।",
    call: "कॉल", wa: "WhatsApp", mail: "ईमेल",
    moveTo: "यहाँ ले जाएँ", note: "नोट", notePh: "क्या हुआ? अगला कदम…", noteSave: "नोट सेव करें", noteEdit: "✎ नोट",
    del: "हटाएँ", delConfirm: "इस प्रॉस्पेक्ट को हटाएँ?",
    nextLabel: "अगला टच", nextClear: "साफ़ करें",
    wonTip: "🎉 बंद हुआ! अब ➕ Add client टैब में जोड़कर उसकी Gui को जीवन दें।",
    actTrain: "🎭 ट्रेन", actQuote: "🧾 कोटेशन", actContract: "📄 अनुबंध", actReg: "➕ रजिस्टर", wonCta: "➕ अभी रजिस्टर करें",
    waMsg: "Hi {name}! This is Guileo 🌱 Circling back on the AI receptionist for {biz} — she answers every call, books appointments and never loses a customer. When's a good time for a quick 2-min chat?",
    lastTouch: "अंतिम टच", never: "—",
  },
};

// ── small helpers ────────────────────────────────────────────────────────────
const DAY = 86400000;
const daysSince = (iso) => { if (!iso) return null; const d = Date.parse(iso); if (isNaN(d)) return null; return Math.floor((Date.now() - d) / DAY); };
const telHref = (p) => `tel:${(p || "").toString().replace(/[^0-9+]/g, "")}`;
const waHref = (p, msg) => { const d = (p || "").toString().replace(/[^0-9]/g, ""); return d ? `https://wa.me/${d}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`; };
const sub = (s, m) => Object.entries(m).reduce((acc, [k, v]) => acc.split(k).join(v), s);
// market drives tone: a BR prospect always gets the Portuguese relational WhatsApp copy, whatever the UI lang.
const waTpl = (p, t) => (p.market === "br" ? T.pt.waMsg : t.waMsg);
// a prospect needs attention: overdue scheduled touch, OR (won/lost aside) no touch in 3+ days
const needsAttention = (p) => {
  if (p.stage === "fechado" || p.stage === "perdido") return false;
  if (p.next_at) { const t = Date.parse(p.next_at); return !isNaN(t) && t <= Date.now(); }
  const ds = daysSince(p.updated_at);
  return ds != null && ds >= 3;
};

// Props: interactivity contract adds `market` (us|br — default US), `nav(tabKey, payload)` to fan a
// prospect out to the roleplay/quote/cadastro tabs, and `handoff` — the payload nav() delivered here.
// A handoff.prefill opens the new-prospect form already filled (consumed once on mount). All optional.
export default function SellerFollowup({ lang = "pt", seller, market = "us", nav, handoff }) {
  const t = T[lang] || T.pt;
  const prefill = handoff?.prefill || null;
  const [rows, setRows] = useState(null);   // null loading · [] empty · array
  const [stats, setStats] = useState({});
  const [err, setErr] = useState(false);
  const [filter, setFilter] = useState(null); // null = all, else a stage key
  const [showNew, setShowNew] = useState(() => !!prefill); // handoff.prefill → open the form on mount
  const [confetti, setConfetti] = useState(false);
  const [wonTip, setWonTip] = useState(false);
  const [wonProspect, setWonProspect] = useState(null); // the deal just moved to 'fechado' → power the CTA
  const confTimer = useRef(null);

  const call = async (body) => {
    const r = await fetch("/api/seller-prospects", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, seller_email: seller.email, seller_code: seller.code || "", seller: { name: seller.name, email: seller.email, ref: seller.ref } }),
    });
    return r.json().catch(() => ({}));
  };

  const load = async () => {
    setErr(false);
    try {
      const d = await call({ action: "list" });
      if (Array.isArray(d.rows)) { setRows(d.rows); setStats(d.stats || {}); }
      else { setRows([]); setErr(true); }
    } catch { setRows([]); setErr(true); }
  };

  // LIVE — refetch every 60s + on tab focus, so the pipeline is fresh on the phone with zero clicks.
  useEffect(() => {
    if (!seller?.email) return;
    load();
    const iv = setInterval(load, 60000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(iv); window.removeEventListener("focus", onFocus); };
  }, [seller?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (confTimer.current) clearTimeout(confTimer.current); }, []);

  // optimistic-ish: fire the write, then reload. On a move to 'fechado' → confetti + the "cadastra" tip.
  const saveProspect = async (patch, opts = {}) => {
    const wasWon = opts.toWon;
    await call({ action: "upsert", prospect: patch });
    if (wasWon) {
      setConfetti(true); setWonTip(true); setWonProspect(patch); // keep the deal for the ➕ Cadastrar CTA
      if (confTimer.current) clearTimeout(confTimer.current);
      confTimer.current = setTimeout(() => setConfetti(false), 2600);
    }
    await load();
  };
  const delProspect = async (id) => { await call({ action: "delete", id }); await load(); };

  const attention = useMemo(() => (Array.isArray(rows) ? rows.filter(needsAttention) : []), [rows]);
  const visible = useMemo(() => {
    if (!Array.isArray(rows)) return [];
    return filter ? rows.filter((r) => r.stage === filter) : rows;
  }, [rows, filter]);

  return (
    <div className="space-y-6">
      <style>{CONFETTI_CSS}</style>
      {confetti && <ConfettiBurst />}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-g-word">{t.title}</h2>
          <p className="text-[13px] text-g-muted mt-1 max-w-2xl">{t.sub}</p>
        </div>
        <button type="button" onClick={load} className="shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-[11.5px] font-bold text-g-muted hover:text-g-word">{t.refresh}</button>
      </div>

      {/* ── pipeline chips (click filters) ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <StageChip active={filter === null} onClick={() => setFilter(null)} hex="#D6C29A"
          label={t.all} n={Array.isArray(rows) ? rows.length : 0} />
        {STAGES.map((s) => (
          <StageChip key={s} active={filter === s} onClick={() => setFilter(filter === s ? null : s)} hex={STAGE_HEX[s]}
            label={t.stages[s]} n={Number(stats[s]) || 0} />
        ))}
      </div>

      {/* ── needs-you-today ────────────────────────────────────────────────────── */}
      {attention.length > 0 && (
        <div className="rounded-2xl border border-g-gold/30 bg-g-gold/[0.06] p-4">
          <div className="text-sm font-extrabold text-g-gold">{t.needYou}</div>
          <p className="text-[12px] text-g-muted mt-0.5">{t.needYouSub}</p>
          <div className="mt-3 space-y-2">
            {attention.map((p) => {
              const overdue = !!p.next_at && Date.parse(p.next_at) <= Date.now();
              const ds = daysSince(p.updated_at);
              const who = p.contact_name || p.business || "—";
              const line = overdue ? sub(t.overdue, { "{x}": who }) : sub(t.daysAgo, { "{n}": String(ds ?? 3), "{x}": who });
              const msg = sub(waTpl(p, t), { "{name}": p.contact_name || "", "{biz}": p.business || "" });
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-g-word">{p.business || who}</div>
                    <div className="truncate text-[11.5px] text-g-muted">{line}</div>
                  </div>
                  {p.phone && <a href={waHref(p.phone, msg)} target="_blank" rel="noopener" className="rounded-full bg-g-green/15 px-3 py-1 text-[11.5px] font-bold text-g-green ring-1 ring-g-green/30 hover:bg-g-green/25">💬 {t.wa}</a>}
                  {p.phone && <a href={telHref(p.phone)} className="rounded-full border border-white/15 px-3 py-1 text-[11.5px] font-bold text-g-muted hover:text-g-word">📞</a>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── new-prospect quick form ────────────────────────────────────────────── */}
      <div>
        {!showNew ? (
          <button type="button" onClick={() => setShowNew(true)} className="btn-bright text-[13.5px]">{t.newBtn}</button>
        ) : (
          <NewProspectForm t={t} initial={prefill} market={market} onCancel={() => setShowNew(false)}
            onSave={async (p) => { await saveProspect(p); setShowNew(false); }} />
        )}
      </div>

      {wonTip && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-g-green/30 bg-g-green/[0.07] p-4">
          <div className="flex items-start gap-2">
            <p className="text-[13px] font-bold text-g-word">{t.wonTip}</p>
            <button type="button" onClick={() => setWonTip(false)} className="ml-auto shrink-0 text-g-muted hover:text-g-word text-[13px]">✕</button>
          </div>
          {/* one-tap: born the client's Gui — hand the won deal straight to the cadastro wizard */}
          {nav && wonProspect && (
            <button type="button" onClick={() => nav("cadastro", { business: wonProspect.business, email: wonProspect.email, contact: wonProspect.contact_name, phone: wonProspect.phone })}
              className="btn-bright text-[13px] mt-3">{t.wonCta}</button>
          )}
        </motion.div>
      )}

      {/* ── loading / error / empty / list ─────────────────────────────────────── */}
      {rows === null && (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-[104px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />)}</div>
      )}
      {rows !== null && err && <div className="text-[12.5px] text-g-gold">{t.err}</div>}
      {rows !== null && !err && rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
          <div className="text-3xl">🎯</div>
          <div className="mt-1.5 text-[13.5px] font-extrabold text-g-word">{t.empty}</div>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-g-muted">{t.emptyHint}</p>
        </div>
      )}
      {rows !== null && !err && rows.length > 0 && visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center text-[13px] text-g-muted">{t.emptyFilter}</div>
      )}
      {rows !== null && !err && visible.length > 0 && (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {visible.map((p, i) => (
              <ProspectCard key={p.id} t={t} p={p} i={i} nav={nav}
                onStage={(stage) => saveProspect({ id: p.id, business: p.business, contact_name: p.contact_name, phone: p.phone, email: p.email, note: p.note, next_at: p.next_at, market: p.market, stage }, { toWon: stage === "fechado" && p.stage !== "fechado" })}
                onNote={(note) => saveProspect({ id: p.id, business: p.business, contact_name: p.contact_name, phone: p.phone, email: p.email, stage: p.stage, next_at: p.next_at, market: p.market, note })}
                onNext={(next_at) => saveProspect({ id: p.id, business: p.business, contact_name: p.contact_name, phone: p.phone, email: p.email, stage: p.stage, note: p.note, market: p.market, next_at })}
                onDelete={() => delProspect(p.id)} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ── pipeline chip ───────────────────────────────────────────────────────────
function StageChip({ active, onClick, hex, label, n }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold ring-1 transition ${active ? "text-g-word" : "text-g-muted hover:text-g-word"}`}
      style={active ? { background: `${hex}22`, boxShadow: `0 0 14px ${hex}40`, borderColor: `${hex}80`, "--tw-ring-color": `${hex}80` } : { background: "rgba(255,255,255,0.03)", "--tw-ring-color": "rgba(255,255,255,0.10)" }}>
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: hex }} />
      {label}
      <span className="rounded-full bg-black/30 px-1.5 py-0.5 text-[10.5px] font-black" style={{ color: hex }}>{n}</span>
    </button>
  );
}

// ── one prospect card ─────────────────────────────────────────────────────────
function ProspectCard({ t, p, i, nav, onStage, onNote, onNext, onDelete }) {
  const [editNote, setEditNote] = useState(false);
  const [noteVal, setNoteVal] = useState(p.note || "");
  const hex = STAGE_HEX[p.stage] || "#948C7B";
  const msg = sub(waTpl(p, t), { "{name}": p.contact_name || "", "{biz}": p.business || "" });
  const ds = daysSince(p.updated_at);
  const nextDate = p.next_at ? String(p.next_at).slice(0, 10) : "";

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.2) }}
      className="rounded-2xl border bg-white/[0.04] p-4" style={{ borderColor: `${hex}30` }}>
      {/* header: business + contact + stage dot */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: hex, boxShadow: `0 0 8px ${hex}` }} />
        <span className="text-[14.5px] font-extrabold text-g-word">{p.business || "—"}</span>
        {p.contact_name && <span className="text-[12px] text-g-ink">· {p.contact_name}</span>}
        <span className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide"
          style={{ background: `${hex}1f`, color: hex }}>{p.market === "br" ? "🇧🇷 BR" : "🇺🇸 US"}</span>
        <button type="button" onClick={() => { if (window.confirm(t.delConfirm)) onDelete(); }}
          className="ml-auto shrink-0 text-[12px] text-g-muted/70 hover:text-g-gold" title={t.del}>🗑️</button>
      </div>

      {/* 1-tap contact actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        {p.phone && <a href={telHref(p.phone)} className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[12px] font-bold text-g-word hover:border-g-green/40">📞 {t.call}</a>}
        {p.phone && <a href={waHref(p.phone, msg)} target="_blank" rel="noopener" className="rounded-full bg-g-green/15 px-3 py-1.5 text-[12px] font-bold text-g-green ring-1 ring-g-green/30 hover:bg-g-green/25">💬 {t.wa}</a>}
        {p.email && <a href={`mailto:${p.email}`} className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[12px] font-bold text-g-word hover:border-g-gold/40">✉️ {t.mail}</a>}
      </div>

      {/* cross-tab actions — carry this prospect into roleplay / quote / cadastro (contract nav payloads) */}
      {nav && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => nav("treino", { scenario: { niche: p.niche || "geral", stage: p.stage, market: p.market, business: p.business } })}
            className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[12px] font-bold text-g-muted hover:text-g-word hover:border-g-green/40">{t.actTrain}</button>
          <button type="button" onClick={() => nav("quote", { client: p.business })}
            className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[12px] font-bold text-g-muted hover:text-g-word hover:border-g-gold/40">{t.actQuote}</button>
          <button type="button" onClick={() => nav("contrato", { client: p.business, email: p.email })}
            className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[12px] font-bold text-g-muted hover:text-g-word hover:border-g-gold/40">{t.actContract}</button>
          <button type="button" onClick={() => nav("cadastro", { business: p.business, email: p.email, contact: p.contact_name, phone: p.phone })}
            className="rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[12px] font-bold text-g-muted hover:text-g-word hover:border-g-green/40">{t.actReg}</button>
        </div>
      )}

      {/* stage select + next-touch date */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-[11.5px] text-g-muted">
          {t.moveTo}
          <select value={p.stage} onChange={(e) => onStage(e.target.value)}
            className="rounded-lg border border-white/15 bg-[#0d0c0a] px-2.5 py-1.5 text-[12px] font-bold text-g-word focus:outline-none focus:border-g-green/50"
            style={{ color: hex }}>
            {STAGES.map((s) => <option key={s} value={s} style={{ color: "#EDE7DC", background: "#161512" }}>{t.stages[s]}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[11.5px] text-g-muted">
          {t.nextLabel}
          <input type="date" value={nextDate} onChange={(e) => onNext(e.target.value || "")}
            className="rounded-lg border border-white/15 bg-[#0d0c0a] px-2.5 py-1.5 text-[12px] text-g-word focus:outline-none focus:border-g-green/50" />
          {nextDate && <button type="button" onClick={() => onNext("")} className="text-[11px] text-g-muted/70 hover:text-g-gold underline">{t.nextClear}</button>}
        </label>
        {ds != null && <span className="text-[11px] text-g-muted/70">{t.lastTouch}: {ds === 0 ? t.today : `${ds}d`}</span>}
      </div>

      {/* quick note */}
      <div className="mt-3">
        {!editNote ? (
          <button type="button" onClick={() => { setNoteVal(p.note || ""); setEditNote(true); }}
            className="w-full rounded-xl border border-white/10 bg-[#0d0c0a]/40 p-2.5 text-left text-[12.5px] leading-relaxed text-g-ink hover:border-g-gold/25">
            {p.note ? p.note : <span className="text-g-muted/70">{t.noteEdit} — {t.notePh}</span>}
          </button>
        ) : (
          <div>
            <textarea autoFocus value={noteVal} onChange={(e) => setNoteVal(e.target.value)} rows={3} placeholder={t.notePh}
              className="w-full rounded-xl border border-white/15 bg-[#0d0c0a] p-2.5 text-[12.5px] leading-relaxed text-g-word placeholder:text-g-muted/60 focus:outline-none focus:border-g-green/50" />
            <div className="mt-1.5 flex gap-2">
              <button type="button" onClick={() => { onNote(noteVal); setEditNote(false); }} className="rounded-full bg-g-green/15 px-3 py-1 text-[11.5px] font-bold text-g-green ring-1 ring-g-green/30 hover:bg-g-green/25">{t.noteSave}</button>
              <button type="button" onClick={() => setEditNote(false)} className="rounded-full border border-white/15 px-3 py-1 text-[11.5px] font-bold text-g-muted hover:text-g-word">{t.cancel}</button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── new-prospect quick form ─────────────────────────────────────────────────
// `initial` = a handoff.prefill from the 🎯 hunt (business/contact_name/phone/email/market/note); `market`
// = the hub-level default. Seed each field once on mount so a handed-off hunt opens ready to name & save.
function NewProspectForm({ t, initial = null, market: marketProp = "us", onSave, onCancel }) {
  const [business, setBusiness] = useState(initial?.business || "");
  const [contact, setContact] = useState(initial?.contact_name || "");
  const [phone, setPhone] = useState(initial?.phone || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [market, setMarket] = useState(initial?.market || marketProp);
  const [note] = useState(initial?.note || ""); // carried silently from the hunt into the saved prospect
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(false);

  const submit = async () => {
    if (!business.trim()) { setErr(true); return; }
    setSaving(true);
    try {
      await onSave({ business: business.trim(), contact_name: contact.trim(), phone: phone.trim(), email: email.trim(), market, note, stage: "abordado" });
    } finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-g-green/25 bg-g-green/[0.04] p-4">
      <div className="text-[13px] font-extrabold text-g-word">{t.newTitle}</div>
      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <Field label={t.biz}><input autoFocus={!!initial} value={business} onChange={(e) => { setBusiness(e.target.value); setErr(false); }} onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-[13.5px] text-g-word focus:outline-none focus:border-g-green/50" /></Field>
        <Field label={t.contact}><input value={contact} onChange={(e) => setContact(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-[13.5px] text-g-word focus:outline-none focus:border-g-green/50" /></Field>
        <Field label={t.phone}><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-[13.5px] text-g-word focus:outline-none focus:border-g-green/50" /></Field>
        <Field label={t.emailF}><input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          className="w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-[13.5px] text-g-word focus:outline-none focus:border-g-green/50" /></Field>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] font-bold text-g-muted">{t.market}</span>
        {[["us", "🇺🇸 US"], ["br", "🇧🇷 BR"]].map(([k, lbl]) => (
          <button key={k} type="button" onClick={() => setMarket(k)}
            className={`rounded-full px-3 py-1 text-[12px] font-bold ring-1 transition ${market === k ? "bg-g-green/15 text-g-word ring-g-green/40" : "bg-white/[0.04] text-g-muted ring-white/10 hover:text-g-word"}`}>{lbl}</button>
        ))}
      </div>
      {err && <div className="mt-2 text-[12px] text-g-gold">{t.needBiz}</div>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={submit} disabled={saving} className="btn-bright text-[13px]">{saving ? t.saving : t.save}</button>
        <button type="button" onClick={onCancel} className="rounded-full border border-white/15 px-4 py-2 text-[12.5px] font-bold text-g-muted hover:text-g-word">{t.cancel}</button>
      </div>
    </motion.div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-g-muted">{label}</div>
      {children}
    </label>
  );
}

// ── tiny CSS confetti on a close (pure CSS, no deps) ──────────────────────────
const CONFETTI_CSS = `
@keyframes gfp-fall { 0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; } 100% { transform: translateY(110vh) rotate(720deg); opacity: 0; } }
.gfp-piece { position: fixed; top: -5vh; width: 9px; height: 14px; border-radius: 2px; pointer-events: none; z-index: 60; animation: gfp-fall linear forwards; }
@media (prefers-reduced-motion: reduce) { .gfp-piece { display: none; } }
`;
function ConfettiBurst() {
  const colors = ["#FF8A33", "#3E9468", "#5B9BD5", "#f2b23e", "#D6C29A"];
  const pieces = Array.from({ length: 26 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.4, dur: 1.8 + Math.random() * 1,
    color: colors[i % colors.length], scale: 0.7 + Math.random() * 0.8,
  }));
  return (
    <div aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} className="gfp-piece"
          style={{ left: `${p.left}vw`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, transform: `scale(${p.scale})` }} />
      ))}
    </div>
  );
}
