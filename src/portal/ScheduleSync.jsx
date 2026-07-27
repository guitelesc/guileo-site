/* ─────────────────────────────────────────────────────────────────────────────
   ScheduleSync — the ONE screen where the client connects the booking system they
   already run (Google Calendar · Square · MindBody · Booksy · Vagaro). This is the
   cockpit face of scheduleAdapter.js: once a system is connected + ready, the Gui
   agent reads REAL availability from it and writes bookings straight into it — the
   client's calendar becomes the single source of truth, mirrored back into the
   Guileo engine (biz_appointments) so the cockpit still has the record. When nothing
   external is connected (or it's down), Gui keeps booking in the internal engine.

   HONESTY IS LAW (ARQUITETURA.md §3/§4):
     • Every card shows its REAL state from the connector's own status action.
     • A connector with no public API (Booksy) or none wired (Vagaro) says so plainly
       and never pretends to book — the internal engine stays the source of truth.
     • A connector coded-but-inert (MindBody waiting on partner key) returns ready:false
       and we render the honest amber note verbatim — we never fake a green "connected".
   Same per-tenant gate as every cockpit tab: email + connection-key (dataKey).
   ───────────────────────────────────────────────────────────────────────────── */
import { useState, useEffect, useCallback } from "react";
import { FaCircleCheck, FaCalendarCheck, FaClock, FaTriangleExclamation } from "react-icons/fa6";
import { toast } from "../lib/portalApi.js";
import { Card, GuiMark, UI_LANG } from "../pages/Portal.jsx";

// ── self-contained 4-language strings (en·pt·es·hi) — no dict edits needed ──
const STR = {
  banner_title: {
    en: "One calendar for your whole business",
    pt: "Um calendário só pro seu negócio inteiro",
    es: "Un solo calendario para todo tu negocio",
    hi: "आपके पूरे व्यवसाय के लिए एक ही कैलेंडर",
  },
  banner_body: {
    en: (name) => <>{name} already books inside your Guileo panel. Connect the system you already use so everything becomes <span className="text-g-gold font-bold">one calendar</span> — no double-booking, ever.</>,
    pt: (name) => <>{name} já agenda no seu painel Guileo. Conecte o sistema que você já usa pra tudo virar <span className="text-g-gold font-bold">um calendário só</span> — sem choque de horário.</>,
    es: (name) => <>{name} ya agenda dentro de tu panel Guileo. Conecta el sistema que ya usas para que todo sea <span className="text-g-gold font-bold">un solo calendario</span> — sin choque de horarios.</>,
    hi: (name) => <>{name} पहले से आपके Guileo पैनल में बुकिंग करती है। जो सिस्टम आप पहले से इस्तेमाल करते हैं उसे जोड़ें ताकि सब कुछ <span className="text-g-gold font-bold">एक कैलेंडर</span> बन जाए — कभी डबल-बुकिंग नहीं।</>,
  },
  how_title: { en: "How the golden rule works", pt: "Como funciona a regra de ouro", es: "Cómo funciona la regla de oro", hi: "स्वर्णिम नियम कैसे काम करता है" },
  how_body: {
    en: "Connect one system → Gui reads its REAL availability and books INTO it (source of truth), then mirrors the booking into your cockpit. Nothing connected → Gui uses the built-in Guileo engine. Never both on the same slot.",
    pt: "Conecte um sistema → a Gui lê a disponibilidade REAL dele e agenda NELE (fonte da verdade), depois espelha a reserva aqui no cockpit. Nada conectado → a Gui usa o motor Guileo interno. Nunca os dois no mesmo horário.",
    es: "Conecta un sistema → Gui lee su disponibilidad REAL y agenda EN él (fuente de la verdad), luego refleja la reserva en tu cockpit. Nada conectado → Gui usa el motor Guileo interno. Nunca ambos en el mismo horario.",
    hi: "एक सिस्टम जोड़ें → Gui उसकी असली उपलब्धता पढ़ती है और उसी में बुक करती है (सत्य का स्रोत), फिर बुकिंग को आपके कॉकपिट में मिरर करती है। कुछ न जुड़ा हो → Gui आंतरिक Guileo इंजन इस्तेमाल करती है। एक ही स्लॉट पर कभी दोनों नहीं।",
  },
  connected: { en: "Connected", pt: "Conectado", es: "Conectado", hi: "जुड़ा हुआ" },
  connect: { en: "Connect", pt: "Conectar", es: "Conectar", hi: "जोड़ें" },
  reconnect: { en: "Reconnect", pt: "Reconectar", es: "Reconectar", hi: "फिर से जोड़ें" },
  cancel: { en: "Cancel", pt: "Cancelar", es: "Cancelar", hi: "रद्द करें" },
  saving: { en: "Connecting…", pt: "Conectando…", es: "Conectando…", hi: "जोड़ रहे हैं…" },
  checking: { en: "Checking…", pt: "Verificando…", es: "Verificando…", hi: "जाँच हो रही है…" },
  soon: { en: "Soon", pt: "Em breve", es: "Pronto", hi: "जल्द" },
  no_api: { en: "No public API yet", pt: "Sem API pública ainda", es: "Sin API pública aún", hi: "अभी सार्वजनिक API नहीं" },
  stored_pending: { en: "Saved — lights up when the API opens", pt: "Salvo — acende quando a API abrir", es: "Guardado — se activa cuando abra la API", hi: "सहेजा गया — API खुलते ही सक्रिय" },
  demo_note: { en: "Preview — connecting activates during your setup.", pt: "Prévia — a conexão real acende no seu setup.", es: "Vista previa — la conexión se activa en tu setup.", hi: "पूर्वावलोकन — कनेक्शन आपके सेटअप में सक्रिय होता है।" },
  open_window: { en: "A Google window opened — approve access there, then come back.", pt: "Abriu uma janela do Google — aprove o acesso lá e volte aqui.", es: "Se abrió una ventana de Google — aprueba el acceso ahí y vuelve.", hi: "एक Google विंडो खुली — वहाँ एक्सेस स्वीकार करें, फिर लौटें।" },
  err: { en: "Couldn't connect — check the fields and try again.", pt: "Não deu pra conectar — confira os campos e tente de novo.", es: "No se pudo conectar — revisa los campos e inténtalo de nuevo.", hi: "कनेक्ट नहीं हो सका — फ़ील्ड जाँचें और फिर प्रयास करें।" },
};
const L = (k, ...a) => { const v = (STR[k] && (STR[k][UI_LANG] || STR[k].en)); return typeof v === "function" ? v(...a) : v; };

// Per-system definitions. mode drives the connect UX:
//   oauth  → open the provider's consent window (Google Calendar)
//   form   → inline credential form → POST {action:'connect'} to the endpoint
//   store  → same form, but the API isn't live; we store creds honestly (Booksy)
//   soon   → nothing wired yet; card is informational only (Vagaro)
const SYSTEMS = [
  {
    key: "gcal", icon: "📅", name: "Google Calendar", color: "#4285F4", mode: "oauth",
    tag: { en: "Your team's calendar", pt: "A agenda da sua equipe", es: "El calendario de tu equipo", hi: "आपकी टीम का कैलेंडर" },
  },
  {
    key: "square", icon: "🟩", name: "Square Appointments", color: "#3E9468", mode: "form",
    endpoint: "/api/square-appointments", provider: "square",
    tag: { en: "Salon / retail bookings", pt: "Agenda de salão / varejo", es: "Reservas de salón / retail", hi: "सैलून / रिटेल बुकिंग" },
    fields: [
      { name: "access_token", type: "password", label: { en: "Personal Access Token", pt: "Personal Access Token", es: "Personal Access Token", hi: "Personal Access Token" }, hint: { en: "Square Developer → your app → Production access token", pt: "Square Developer → seu app → Production access token", es: "Square Developer → tu app → Production access token", hi: "Square Developer → आपका ऐप → Production access token" } },
      { name: "location_id", type: "text", label: { en: "Location ID", pt: "Location ID", es: "Location ID", hi: "Location ID" }, hint: { en: "Square dashboard → Locations", pt: "Painel Square → Locations", es: "Panel Square → Locations", hi: "Square डैशबोर्ड → Locations" } },
    ],
  },
  {
    key: "mindbody", icon: "🧘", name: "MindBody", color: "#8B6FE0", mode: "form",
    endpoint: "/api/mindbody", provider: "mindbody",
    tag: { en: "Spa / wellness studios", pt: "Spa / estúdios de bem-estar", es: "Spa / estudios de bienestar", hi: "स्पा / वेलनेस स्टूडियो" },
    fields: [
      { name: "site_id", type: "select", label: { en: "Studio (Site ID)", pt: "Estúdio (Site ID)", es: "Estudio (Site ID)", hi: "स्टूडियो (Site ID)" },
        options: [ { v: "767008", t: "Astoria — 767008" }, { v: "5734109", t: "UES — 5734109" } ] },
      { name: "source_name", type: "text", label: { en: "Source / API username", pt: "Source / usuário da API", es: "Source / usuario de API", hi: "Source / API उपयोगकर्ता" } },
      { name: "source_password", type: "password", label: { en: "Source password", pt: "Senha do source", es: "Contraseña del source", hi: "Source पासवर्ड" } },
    ],
  },
  {
    key: "booksy", icon: "💈", name: "Booksy", color: "#00B2A9", mode: "store",
    endpoint: "/api/booksy", provider: "booksy",
    tag: { en: "Barber / beauty bookings", pt: "Agenda de barbearia / beleza", es: "Reservas de barbería / belleza", hi: "नाई / ब्यूटी बुकिंग" },
    fields: [
      { name: "business_id", type: "text", label: { en: "Booksy business ID or profile URL", pt: "ID do negócio ou URL do perfil Booksy", es: "ID de negocio o URL de perfil Booksy", hi: "Booksy बिज़नेस ID या प्रोफ़ाइल URL" } },
    ],
  },
  {
    key: "vagaro", icon: "✂️", name: "Vagaro", color: "#5B7FDB", mode: "soon",
    tag: { en: "Salon / spa bookings", pt: "Agenda de salão / spa", es: "Reservas de salón / spa", hi: "सैलून / स्पा बुकिंग" },
  },
];

// Status badge — signal palette by meaning (done green · attention amber · muted).
function StatusPill({ state }) {
  if (state === "connected") return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase" style={{ color: "#3E9468", background: "#3E946822", boxShadow: "inset 0 0 0 1px #3E946855" }}><FaCircleCheck size={9} /> {L("connected")}</span>;
  if (state === "stored") return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase" style={{ color: "#FFC23D", background: "#FFC23D1e", boxShadow: "inset 0 0 0 1px #FFC23D55" }}><FaClock size={9} /> {L("stored_pending")}</span>;
  if (state === "soon") return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase text-g-muted" style={{ background: "rgba(255,255,255,0.05)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.1)" }}>{L("soon")}</span>;
  if (state === "loading") return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase text-g-muted">{L("checking")}</span>;
  return null;
}

function ScheduleSync({ V, real = null, email = "", dataKey = "" }) { // eslint-disable-line no-unused-vars
  const demo = !dataKey;
  const agent = V?.aiName || V?.agentName || "Gui";
  const [fetched, setFetched] = useState({}); // key → { state, note } from the live status calls
  const [open, setOpen] = useState("");        // which card's form is expanded
  const [form, setForm] = useState({});        // provider → { field: value }
  const [busy, setBusy] = useState("");        // provider currently submitting

  // Base state per card before any live status lands (loading spinner for pollable connectors).
  const baseState = (s) => (s.mode === "soon" ? "soon" : (s.mode === "oauth" ? "idle" : (demo ? "idle" : "loading")));

  // POST helper — every call carries the per-tenant gate (token=dataKey, email).
  const call = useCallback(async (endpoint, body) => {
    const r = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: dataKey, email: email || "", ...body }),
    });
    return r.json().catch(() => ({}));
  }, [dataKey, email]);

  // Read each connector's REAL state on mount (real accounts only; demo shows previews).
  // No synchronous setState — only the async status callbacks write, so no cascading renders.
  useEffect(() => {
    let alive = true;
    if (demo) return;
    SYSTEMS.filter((s) => s.mode === "form" || s.mode === "store").forEach(async (s) => {
      try {
        const d = await call(s.endpoint, { action: "status" });
        if (!alive) return;
        const state = d && d.ready ? "connected" : (d && d.stored ? "stored" : "idle");
        setFetched((cur) => ({ ...cur, [s.key]: { state, note: (d && d.note) || "" } }));
      } catch {
        if (alive) setFetched((cur) => ({ ...cur, [s.key]: { state: "idle" } }));
      }
    });
    return () => { alive = false; };
  }, [demo, call]);

  const setField = (provider, name, value) => setForm((f) => ({ ...f, [provider]: { ...(f[provider] || {}), [name]: value } }));

  // Google Calendar — open the OAuth consent window (real accounts).
  const connectOAuth = () => {
    if (demo) { toast(L("demo_note")); return; }
    window.open(`https://guileoai.com/api/gcal-connect?email=${encodeURIComponent(email)}`, "_blank", "noopener");
    toast(L("open_window"));
  };

  // Square / MindBody / Booksy — submit the inline credential form.
  const submitForm = async (sys) => {
    if (demo) { toast(L("demo_note")); return; }
    setBusy(sys.key);
    try {
      const vals = form[sys.provider] || {};
      const payload = { action: "connect" };
      sys.fields.forEach((f) => { payload[f.name] = vals[f.name] || (f.type === "select" ? f.options[0].v : ""); });
      const d = await call(sys.endpoint, payload);
      if (d && (d.ready || d.connected)) {
        setFetched((cur) => ({ ...cur, [sys.key]: { state: "connected", note: d.note || "" } }));
        setOpen(""); toast(`${sys.name} — ${L("connected")} ✓`);
      } else if (d && (d.stored || d.ok)) {
        // Stored honestly (e.g. Booksy: no live API) or saved-but-not-authenticated.
        setFetched((cur) => ({ ...cur, [sys.key]: { state: "stored", note: d.note || "" } }));
        setOpen(""); toast(d.note || L("stored_pending"));
      } else {
        toast((d && d.note) || (d && d.error) || L("err"));
      }
    } catch { toast(L("err")); }
    setBusy("");
  };

  return (
    <div className="space-y-4 stagger">
      {/* ── Banner: the golden-rule promise ── */}
      <Card className="bg-gradient-to-br from-[#4285F4]/[0.10] to-g-gold/[0.06] border-[#4285F4]/25">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center h-11 w-11 rounded-xl bg-[#4285F4]/15 text-[#4285F4] shrink-0"><FaCalendarCheck /></span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-extrabold text-g-word">{L("banner_title")}</div>
            <div className="text-xs text-g-light leading-relaxed mt-1">{L("banner_body", agent)}</div>
          </div>
          <GuiMark size={32} />
        </div>
      </Card>

      {/* ── How the anti-clash rule works (honest, always shown) ── */}
      <Card className="border-g-gold/25 bg-g-gold/[0.04]">
        <div className="flex items-start gap-3">
          <span className="grid place-items-center h-8 w-8 rounded-lg bg-g-gold/15 text-g-gold text-sm shrink-0"><FaTriangleExclamation size={13} /></span>
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-g-word mb-0.5">{L("how_title")}</div>
            <div className="text-[11px] text-g-muted leading-snug">{L("how_body")}</div>
          </div>
        </div>
      </Card>

      {/* ── One card per booking system ── */}
      {SYSTEMS.map((sys) => {
        const st = fetched[sys.key] || { state: baseState(sys) };
        const isConnected = st.state === "connected";
        const isSoon = sys.mode === "soon";
        const showForm = open === sys.key && (sys.mode === "form" || sys.mode === "store");
        return (
          <Card key={sys.key} className="p-0 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4">
              <span className="grid place-items-center h-11 w-11 rounded-xl text-xl shrink-0" style={{ background: sys.color + "22" }}>{sys.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-extrabold text-g-word flex items-center gap-2 flex-wrap">{sys.name}<StatusPill state={demo ? "idle" : st.state} /></div>
                <div className="text-[11px] text-g-muted leading-snug mt-0.5">{sys.tag[UI_LANG] || sys.tag.en}</div>
              </div>
              {/* Action control */}
              {isSoon ? (
                <span className="text-[11px] text-g-muted italic shrink-0">{L("no_api")}</span>
              ) : sys.mode === "oauth" ? (
                <button onClick={connectOAuth} disabled={demo} className={`text-[12px] px-3.5 py-1.5 shrink-0 ${demo ? "btn-ghost opacity-60" : "btn-bright"}`}>{isConnected ? L("reconnect") : L("connect")}</button>
              ) : (
                <button onClick={() => setOpen(showForm ? "" : sys.key)} disabled={demo} className={`text-[12px] px-3.5 py-1.5 shrink-0 ${demo ? "btn-ghost opacity-60" : (isConnected ? "btn-ghost" : "btn-bright")}`}>{showForm ? L("cancel") : (isConnected ? L("reconnect") : L("connect"))}</button>
              )}
            </div>

            {/* Honest note straight from the connector (amber for pending states) */}
            {!demo && st.note && !showForm && (
              <div className={`px-5 pb-3 -mt-1 text-[11px] leading-snug ${isConnected ? "text-g-muted" : "text-[#FFC23D]"}`}>{st.note}</div>
            )}
            {demo && (
              <div className="px-5 pb-3 -mt-1 text-[11px] leading-snug text-g-muted">{L("demo_note")}</div>
            )}
            {isSoon && (
              <div className="px-5 pb-3 -mt-1 text-[11px] leading-snug text-g-muted">{{ en: "No public booking API today. Gui keeps booking in your Guileo engine; this lights up the day Vagaro opens one.", pt: "Sem API pública de agenda hoje. A Gui segue agendando no motor Guileo; acende no dia que a Vagaro abrir uma.", es: "Sin API pública de reservas hoy. Gui sigue agendando en tu motor Guileo; se activa cuando Vagaro abra una.", hi: "आज कोई सार्वजनिक बुकिंग API नहीं। Gui आपके Guileo इंजन में बुकिंग करती रहती है; Vagaro के API खोलते ही यह सक्रिय होगा।" }[UI_LANG] || "No public booking API today. Gui keeps booking in your Guileo engine."}</div>
            )}

            {/* Inline credential form */}
            {showForm && (
              <div className="px-5 pb-4 pt-1 border-t border-white/[0.06] space-y-3 bg-black/15">
                {sys.fields.map((f) => (
                  <label key={f.name} className="block">
                    <span className="text-[11px] font-bold text-g-light">{f.label[UI_LANG] || f.label.en}</span>
                    {f.type === "select" ? (
                      <select value={(form[sys.provider] || {})[f.name] || f.options[0].v} onChange={(e) => setField(sys.provider, f.name, e.target.value)}
                        className="mt-1 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-[13px] text-g-word focus:outline-none focus:border-g-gold/50">
                        {f.options.map((o) => <option key={o.v} value={o.v} className="bg-[#161512]">{o.t}</option>)}
                      </select>
                    ) : (
                      <input type={f.type} value={(form[sys.provider] || {})[f.name] || ""} onChange={(e) => setField(sys.provider, f.name, e.target.value)}
                        autoComplete="off" spellCheck={false}
                        className="mt-1 w-full rounded-xl border border-white/[0.1] bg-black/30 px-3 py-2 text-[13px] text-g-word placeholder-g-muted focus:outline-none focus:border-g-gold/50" />
                    )}
                    {f.hint && <span className="block mt-1 text-[10px] text-g-muted leading-snug">{f.hint[UI_LANG] || f.hint.en}</span>}
                  </label>
                ))}
                <button onClick={() => submitForm(sys)} disabled={busy === sys.key} className="btn-bright text-[12px] px-4 py-2 w-full">{busy === sys.key ? L("saving") : L("connect")}</button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export default ScheduleSync;
