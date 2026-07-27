import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { VOICES, voiceByKey, DEFAULT_VOICE_KEY } from "../data/agentVoices";
import { CHANNELS, CHANNELS_LIVE, CHANNELS_PENDING } from "../data/onboardChannels";
import { VERTICALS, VERTICAL_KEYS } from "../data/verticals.js";
import { GUILEO_PLANS, planByKey, payLink } from "../data/guileoPlans.js";

// OnboardWizard — CADASTRO COMPLETO. One long sectioned intake that captures EVERYTHING about a
// client's business + ALL channels, then POSTs a DRAFT to /api/onboard-draft {action:'save'}.
// Luis approves it in /admin -> the existing provisioner gives birth to the client's own dedicated
// agent (name, voice, brain, schedule, number, web widget with their logo). Warm-cement styling,
// signal-palette accents (Gui orange #FF8A33), mobile-friendly, glassy cards like the rest of the app.
// The canonical payload keys are locked — see assemble() below.

const ORANGE = "#FF8A33"; // Gui / agent signal color

// SPOKEN languages — what the client's Gui answers calls in (mirrors LANGS_SPOKEN in
// functions/lib/provision.js; ElevenLabs multilingual TTS covers all of them). The checked codes flow
// into payload.languages. The PORTAL/UI itself stays 4 languages (UI_LANGS) — that's the primary select.
const LANG_OPTS = [
  ["pt", "🇧🇷 Português"], ["en", "🇺🇸 English"], ["es", "🇪🇸 Español"], ["hi", "🇮🇳 हिन्दी"],
  ["zh", "🇨🇳 中文 Mandarim"], ["yue", "🇭🇰 粵語 Cantonês"], ["ru", "🇷🇺 Русский Russo"], ["ko", "🇰🇷 한국어 Coreano"],
  ["ht", "🇭🇹 Kreyòl Ayisyen"], ["fr", "🇫🇷 Français"], ["ar", "🇸🇦 العربية Árabe"], ["vi", "🇻🇳 Tiếng Việt"],
  ["tl", "🇵🇭 Tagalog"], ["bn", "🇧🇩 বাংলা Bengali"], ["pa", "🇮🇳 ਪੰਜਾਬੀ Punjabi"], ["de", "🇩🇪 Deutsch"],
  ["it", "🇮🇹 Italiano"], ["pl", "🇵🇱 Polski"], ["ja", "🇯🇵 日本語"], ["uk", "🇺🇦 Українська"],
];
const UI_LANGS = ["pt", "en", "es", "hi"]; // the owner's portal languages — only these can be PRIMARY
const TZ_OPTS = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles",
  "America/Anchorage", "Pacific/Honolulu", "America/Sao_Paulo", "America/Mexico_City", "Europe/Lisbon",
  "Europe/Madrid", "Asia/Kolkata",
];
const WEEKDAYS = { pt: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"], en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], es: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] };

// channel-key -> the exact sub-field of the canonical `channels` payload it feeds.
const CH_FIELD = { phone: "mode", whatsapp: "number", widget: "enabled", instagram: "handle", facebook: "handle", linkedin: "url", tiktok: "handle", youtube: "url", google_business: "url", ads: "enabled", reviews: "link" };
const CH_ICON = { phone: "📞", sms: "💬", email: "✉️", widget: "🌐", whatsapp: "🟢", instagram: "📸", facebook: "👍", linkedin: "💼", tiktok: "🎵", youtube: "▶️", google_business: "🗺️", ads: "📣", reviews: "⭐" };
const CH_LABEL = { phone: "Telefone / Voz", sms: "SMS", email: "Email", widget: "Widget no site", whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", tiktok: "TikTok", youtube: "YouTube", google_business: "Google Meu Negócio", ads: "Anúncios (Ads)", reviews: "Link de avaliações" };
const CH_PH = { whatsapp: "+1 305 555 0100", instagram: "@perfil", facebook: "página ou @perfil", linkedin: "https://linkedin.com/company/…", tiktok: "@perfil", youtube: "https://youtube.com/@canal", google_business: "https://g.page/…", reviews: "https://g.page/r/…/review" };

// Fallback channel list (canonical order) used only if the shared data module ships empty.
const FALLBACK_CHANNELS = [
  { key: "phone", status: "live" }, { key: "widget", status: "live" }, { key: "email", status: "live" }, { key: "sms", status: "live" },
  { key: "whatsapp", status: "pending" }, { key: "instagram", status: "pending" }, { key: "facebook", status: "pending" }, { key: "linkedin", status: "pending" },
  { key: "tiktok", status: "pending" }, { key: "youtube", status: "pending" }, { key: "google_business", status: "pending" }, { key: "ads", status: "pending" }, { key: "reviews", status: "pending" },
];

const keyOf = (x) => (typeof x === "string" ? x : (x && (x.key || x.id || x.name)) || "");

// ── i18n (pt primary; en/es merged over pt so every key always resolves) ──────────
const PT = {
  eyebrow: "Cadastro completo", title: "Nascer a Gui do cliente",
  sub: "Preencha tudo sobre o negócio e os canais. Salvamos um rascunho — o Luis aprova em 1 clique e a Gui dedicada do cliente nasce (nome, voz, cérebro, agenda, número e widget com a logo dele).",
  sBiz: "Negócio", sAgent: "Agente", sUnits: "Unidades", sServices: "Serviços", sTeam: "Equipe (opcional)", sChannels: "Canais", sExtras: "Suporte & extras",
  bizName: "Nome do negócio", clientEmail: "Email do cliente (conta / login)", clientEmailHint: "É com este email que o cliente entra no portal e recebe o código — obrigatório pra aprovar.", bizDesc: "Descrição — o que é, o que vende, o tom de voz", verticals: "Segmentos", langs: "Idiomas que a Gui fala", langsNote: "A Gui atende a ligação em todos esses idiomas (detecta e responde na língua de quem liga). O portal do dono fica em PT·EN·ES·HI.", primaryLang: "Idioma principal",
  agentName: "Nome do agente (ex: Lilian)", voice: "Voz", logo: "Logo (URL) — aparece no widget", accent: "Cor de destaque do widget",
  addUnit: "+ Unidade", unit: "Unidade", uName: "Nome da unidade", uAddress: "Endereço", uPhone: "Telefone", uTz: "Fuso horário", uHours: "Horário semanal", closed: "Fechado", remove: "Remover",
  addService: "+ Serviço", svcName: "Serviço", svcVertical: "Segmento", svcDur: "Duração (min)", svcPrice: "Preço $", svcDeposit: "Depósito $ (opcional)",
  addMember: "+ Pessoa", mName: "Nome", mTitle: "Cargo", mServices: "Serviços (separe por vírgula)", mLocations: "Unidades (separe por vírgula)",
  live: "ativo", pending: "aguardando API", pendingNote: "Capture agora — ativa quando a API dessa plataforma for aprovada.",
  phoneMode: "Número", phoneBuy: "Comprar novo (Twilio)", phoneMap: "Mapear existente", phoneNone: "Sem número por enquanto", areaCode: "DDD / area code", existingNum: "Número existente", forward: "Encaminhar p/ (transbordo)",
  widgetOn: "Ligar o widget no site do cliente", adsOn: "Rodar anúncios (Ads)",
  supportLink: "Link de suporte / ajuda", reviewLink: "Link de avaliações (Google)", plan: "Plano", credits: "Créditos",
  planStarter: "Essential", planGrowth: "Personalized", planScale: "Full Operation",
  submit: "Salvar rascunho", submitting: "Salvando…", needBiz: "Informe o nome do negócio.", needEmail: "Informe um email válido do cliente (é o que ativa a conta na aprovação).",
  okTitle: "Rascunho salvo — aguardando aprovação", okSub: "O Luis aprova em 1 clique no /admin e a Gui do cliente nasce.", newOne: "Cadastrar outro", errNet: "Não deu pra salvar agora. Tenta de novo.",
  widgetSnippet: "Trecho do widget (cole no site do cliente)", copy: "Copiar", copied: "Copiado ✓",
};
const T = {
  pt: PT,
  en: { ...PT,
    eyebrow: "Full intake", title: "Give birth to the client's Gui",
    sub: "Capture everything about the business and its channels. We save a draft — Luis approves in 1 click and the client's dedicated Gui is born (name, voice, brain, schedule, number, and widget with their logo).",
    sBiz: "Business", sAgent: "Agent", sUnits: "Locations", sServices: "Services", sTeam: "Team (optional)", sChannels: "Channels", sExtras: "Support & extras",
    bizName: "Business name", clientEmail: "Client email (account / login)", clientEmailHint: "This is the email the client uses to sign in and receives the code — required to approve.", bizDesc: "Description — what it is, what it sells, tone of voice", verticals: "Verticals", langs: "Languages Gui speaks", langsNote: "Gui answers calls in all of these (detects and replies in the caller's language). The owner's portal is in EN·PT·ES·HI.", primaryLang: "Primary language",
    agentName: "Agent name (e.g. Lilian)", voice: "Voice", logo: "Logo (URL) — shown in the widget", accent: "Widget accent color",
    addUnit: "+ Location", unit: "Location", uName: "Location name", uAddress: "Address", uPhone: "Phone", uTz: "Timezone", uHours: "Weekly hours", closed: "Closed", remove: "Remove",
    addService: "+ Service", svcName: "Service", svcVertical: "Vertical", svcDur: "Duration (min)", svcPrice: "Price $", svcDeposit: "Deposit $ (optional)",
    addMember: "+ Person", mName: "Name", mTitle: "Title", mServices: "Services (comma-separated)", mLocations: "Locations (comma-separated)",
    live: "live", pending: "awaiting API", pendingNote: "Capture it now — it turns on when that platform's API is approved.",
    phoneMode: "Number", phoneBuy: "Buy new (Twilio)", phoneMap: "Map existing", phoneNone: "No number for now", areaCode: "Area code", existingNum: "Existing number", forward: "Forward to (overflow)",
    widgetOn: "Turn on the widget on the client's site", adsOn: "Run ads",
    supportLink: "Support / help link", reviewLink: "Reviews link (Google)", plan: "Plan", credits: "Credits",
    submit: "Save draft", submitting: "Saving…", needBiz: "Enter the business name.", needEmail: "Enter a valid client email (it's what activates the account on approval).",
    okTitle: "Draft saved — awaiting approval", okSub: "Luis approves in 1 click in /admin and the client's Gui is born.", newOne: "Add another", errNet: "Couldn't save right now. Try again.",
    widgetSnippet: "Widget snippet (paste on the client's site)", copy: "Copy", copied: "Copied ✓",
  },
  es: { ...PT,
    eyebrow: "Alta completa", title: "Dar a luz a la Gui del cliente",
    sub: "Captura todo sobre el negocio y sus canales. Guardamos un borrador — Luis aprueba en 1 clic y nace la Gui dedicada del cliente (nombre, voz, cerebro, agenda, número y widget con su logo).",
    sBiz: "Negocio", sAgent: "Agente", sUnits: "Sucursales", sServices: "Servicios", sTeam: "Equipo (opcional)", sChannels: "Canales", sExtras: "Soporte y extras",
    bizName: "Nombre del negocio", clientEmail: "Email del cliente (cuenta / acceso)", clientEmailHint: "Con este email el cliente entra al portal y recibe el código — obligatorio para aprobar.", bizDesc: "Descripción — qué es, qué vende, el tono", verticals: "Rubros", langs: "Idiomas que habla Gui", langsNote: "Gui atiende llamadas en todos estos idiomas (detecta y responde en la lengua de quien llama). El portal del dueño está en ES·EN·PT·HI.", primaryLang: "Idioma principal",
    agentName: "Nombre del agente (ej: Lilian)", voice: "Voz", logo: "Logo (URL) — se ve en el widget", accent: "Color de acento del widget",
    addUnit: "+ Sucursal", unit: "Sucursal", uName: "Nombre de la sucursal", uAddress: "Dirección", uPhone: "Teléfono", uTz: "Zona horaria", uHours: "Horario semanal", closed: "Cerrado", remove: "Quitar",
    addService: "+ Servicio", svcName: "Servicio", svcVertical: "Rubro", svcDur: "Duración (min)", svcPrice: "Precio $", svcDeposit: "Depósito $ (opcional)",
    addMember: "+ Persona", mName: "Nombre", mTitle: "Cargo", mServices: "Servicios (separa por coma)", mLocations: "Sucursales (separa por coma)",
    live: "activo", pending: "esperando API", pendingNote: "Captúralo ahora — se activa cuando la API de esa plataforma se apruebe.",
    phoneMode: "Número", phoneBuy: "Comprar nuevo (Twilio)", phoneMap: "Mapear existente", phoneNone: "Sin número por ahora", areaCode: "Código de área", existingNum: "Número existente", forward: "Desviar a (desborde)",
    widgetOn: "Activar el widget en el sitio del cliente", adsOn: "Correr anuncios (Ads)",
    supportLink: "Enlace de soporte / ayuda", reviewLink: "Enlace de reseñas (Google)", plan: "Plan", credits: "Créditos",
    submit: "Guardar borrador", submitting: "Guardando…", needBiz: "Ingresa el nombre del negocio.", needEmail: "Ingresa un email válido del cliente (es lo que activa la cuenta al aprobar).",
    okTitle: "Borrador guardado — esperando aprobación", okSub: "Luis aprueba en 1 clic en /admin y nace la Gui del cliente.", newOne: "Cargar otro", errNet: "No se pudo guardar ahora. Intenta de nuevo.",
    widgetSnippet: "Fragmento del widget (pégalo en el sitio del cliente)", copy: "Copiar", copied: "Copiado ✓",
  },
};

// Owner alert/emergency phone — full 4-language strings (the wizard dict T only carries pt/en/es;
// hi falls back to pt there, but THIS field is genuinely trilingual+hi like the submit warning below).
// notify_phone born NULL = every emergency/alert becomes email-only → this field is REQUIRED.
const OWNER_PHONE_T = {
  pt: { label: "Telefone do dono (alertas/emergência)", hint: "A Gui LIGA/avisa neste número quando algo é urgente (emergência, transbordo, alerta). Obrigatório — sem ele, emergências não tocam ninguém.", need: "Informe o telefone do dono — é onde a Gui avisa em emergência." },
  en: { label: "Owner phone (alerts/emergency)", hint: "Gui CALLS/alerts this number when something is urgent (emergency, overflow, alert). Required — without it, emergencies reach no one.", need: "Enter the owner phone — it's where Gui alerts on emergencies." },
  es: { label: "Teléfono del dueño (alertas/emergencia)", hint: "Gui LLAMA/avisa a este número cuando algo es urgente (emergencia, desborde, alerta). Obligatorio — sin él, las emergencias no alertan a nadie.", need: "Ingresa el teléfono del dueño — es donde Gui avisa en emergencias." },
  hi: { label: "मालिक का फ़ोन (अलर्ट/आपातकाल)", hint: "कुछ ज़रूरी होने पर (आपातकाल, ओवरफ़्लो, अलर्ट) Gui इसी नंबर पर कॉल/सूचित करती है। अनिवार्य — इसके बिना आपात स्थिति में किसी को सूचना नहीं मिलेगी।", need: "मालिक का फ़ोन नंबर डालें — आपात स्थिति में Gui यहीं सूचित करती है।" },
};

const inp = "w-full rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-[13px] text-g-word placeholder:text-g-muted/55 focus:outline-none focus:border-g-gold/50";
const sel = inp;
const lbl = "text-[11px] font-bold uppercase tracking-wide text-g-muted";

const hhmmToMin = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "").trim()); if (!m) return null; const h = +m[1], mm = +m[2]; if (h > 23 || mm > 59) return null; return h * 60 + mm; };
const emptyHours = () => Array.from({ length: 7 }, (_, w) => ({ weekday: w, open: "09:00", close: "18:00", closed: w === 0 }));
const newLocation = () => ({ name: "", address: "", phone: "", tz: "America/New_York", hours: emptyHours() });
const newService = () => ({ name: "", vertical: VERTICAL_KEYS[0] || "", duration_min: 30, price: "", deposit: "" });
const newMember = () => ({ name: "", title: "", services: "", locations: "" });
const centsOf = (v) => { const n = parseFloat(String(v).replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? Math.round(n * 100) : null; };

function Section({ icon, title, sub, accent = "gold", right, children }) {
  const color = accent === "green" ? "text-g-green" : accent === "orange" ? "" : "text-g-gold";
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-[11px] font-black uppercase tracking-wider ${color}`} style={accent === "orange" ? { color: ORANGE } : undefined}>{icon} {title}</div>
          {sub && <p className="mt-1 text-[12px] text-g-muted leading-relaxed max-w-2xl">{sub}</p>}
        </div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function OnboardWizard({ token, mode = "seller", lang = "pt", seller = null, onSaved, prefill = null }) {
  const t = T[lang] || T.pt;
  const op = OWNER_PHONE_T[lang] || OWNER_PHONE_T.pt;
  const wd = WEEKDAYS[lang] || WEEKDAYS.pt;
  const chList = useMemo(() => (Array.isArray(CHANNELS) && CHANNELS.length ? CHANNELS : FALLBACK_CHANNELS), []);
  const liveKeys = useMemo(() => new Set((Array.isArray(CHANNELS_LIVE) ? CHANNELS_LIVE : []).map(keyOf).filter(Boolean)), []);
  const pendKeys = useMemo(() => new Set((Array.isArray(CHANNELS_PENDING) ? CHANNELS_PENDING : []).map(keyOf).filter(Boolean)), []);

  // ── Business ──
  // prefill (optional) seeds ONLY the initial values — the seller arrived from Follow-up with
  // "cadastrar <negócio>". Lazy initializers apply once at mount and never fight later typing.
  // Only business + clientEmail have a matching field here; contact/phone have no owner field yet.
  const [business, setBusiness] = useState(() => (prefill?.business || ""));
  const [clientEmail, setClientEmail] = useState(() => (prefill?.email || ""));
  // Owner's alert/emergency phone — the ONE number Gui rings when it's urgent. Born into notify_phone.
  const [notifyPhone, setNotifyPhone] = useState(() => (prefill?.notify_phone || prefill?.owner_phone || ""));
  const [description, setDescription] = useState("");
  const [verticals, setVerticals] = useState([]);
  const [languages, setLanguages] = useState(["pt"]);
  const [primaryLang, setPrimaryLang] = useState("pt");
  // ── Agent + brand ──
  const [agentName, setAgentName] = useState("");
  const [voiceKey, setVoiceKey] = useState(DEFAULT_VOICE_KEY || (Array.isArray(VOICES) && VOICES[0] && (VOICES[0].key || VOICES[0].id)) || "");
  const [logoUrl, setLogoUrl] = useState("");
  const [accent, setAccent] = useState(ORANGE);
  // ── Repeatables ──
  const [locations, setLocations] = useState([newLocation()]);
  const [services, setServices] = useState([newService()]);
  const [team, setTeam] = useState([]);
  // ── Channels ──
  const [phone, setPhone] = useState({ mode: "buy", area_code: "", existing_number: "", forward: "" });
  const [widgetEnabled, setWidgetEnabled] = useState(true);
  const [adsEnabled, setAdsEnabled] = useState(false);
  const [chText, setChText] = useState({}); // key -> string (whatsapp.number, instagram.handle, …)
  // ── Extras ──
  const [supportLink, setSupportLink] = useState("");
  const [reviewLink, setReviewLink] = useState("");
  const [plan, setPlan] = useState("growth");
  const [credits, setCredits] = useState(440);
  // ── Submit ──
  const [state, setState] = useState("idle"); // idle | go | done | err
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const voices = Array.isArray(VOICES) ? VOICES : [];
  const selectedVoice = useMemo(() => { try { return typeof voiceByKey === "function" ? voiceByKey(voiceKey) : voices.find((v) => (v.key || v.id) === voiceKey); } catch { return null; } }, [voiceKey, voices]);

  const toggleVertical = (k) => setVerticals((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));
  const toggleLang = (c) => setLanguages((a) => {
    const next = a.includes(c) ? a.filter((x) => x !== c) : [...a, c];
    if (!next.length) return a; // keep at least one
    // primary must stay a PORTAL language (UI_LANGS) — the agent can SPEAK zh/ru/ko/ht, but the
    // owner's portal + agent primary is one of the 4 UI languages.
    if (!next.includes(primaryLang)) setPrimaryLang(next.find((x) => UI_LANGS.includes(x)) || "en");
    return next;
  });
  const setLoc = (i, patch) => setLocations((a) => a.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const setHour = (i, w, patch) => setLocations((a) => a.map((l, j) => (j === i ? { ...l, hours: l.hours.map((h) => (h.weekday === w ? { ...h, ...patch } : h)) } : l)));
  const setSvc = (i, patch) => setServices((a) => a.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const setMem = (i, patch) => setTeam((a) => a.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  const assemble = () => {
    const cv = (k) => (chText[k] || "").trim();
    const commaArr = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
    return {
      business: business.trim(),
      client_email: clientEmail.trim().toLowerCase(),
      notify_phone: notifyPhone.trim(),
      description: description.trim(),
      verticals,
      lang: primaryLang,
      languages,
      agent: { name: agentName.trim(), voice_key: voiceKey },
      brand: { logo_url: logoUrl.trim(), accent },
      locations: locations.map((l) => ({
        name: l.name.trim(), address: l.address.trim(), phone: l.phone.trim(), tz: l.tz,
        hours: l.hours.filter((h) => !h.closed && hhmmToMin(h.open) != null && hhmmToMin(h.close) != null)
          .map((h) => ({ weekday: h.weekday, open_min: hhmmToMin(h.open), close_min: hhmmToMin(h.close) })),
      })),
      services: services.filter((s) => s.name.trim()).map((s) => ({
        name: s.name.trim(), vertical: s.vertical, duration_min: parseInt(s.duration_min, 10) || 0,
        price_cents: centsOf(s.price), deposit_cents: s.deposit === "" ? null : centsOf(s.deposit),
      })),
      team: team.filter((m) => m.name.trim()).map((m) => ({ name: m.name.trim(), title: m.title.trim(), services: commaArr(m.services), locations: commaArr(m.locations) })),
      channels: {
        phone: { mode: phone.mode, area_code: phone.area_code.trim(), existing_number: phone.existing_number.trim(), forward: phone.forward.trim() },
        whatsapp: { number: cv("whatsapp") },
        widget: { enabled: widgetEnabled },
        instagram: { handle: cv("instagram") },
        facebook: { handle: cv("facebook") },
        linkedin: { url: cv("linkedin") },
        tiktok: { handle: cv("tiktok") },
        youtube: { url: cv("youtube") },
        google_business: { url: cv("google_business") },
        ads: { enabled: adsEnabled },
        reviews: { link: cv("reviews") },
      },
      support_link: supportLink.trim(),
      review_link: reviewLink.trim(),
      plan,
      credits: parseInt(credits, 10) || 0,
    };
  };

  const submit = async () => {
    if (!business.trim()) { setErr(t.needBiz); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clientEmail.trim())) { setErr(t.needEmail); return; }
    // Owner alert phone is REQUIRED — emergency/overflow has nowhere to ring without it (FIX D / #4).
    if (notifyPhone.replace(/[^0-9]/g, "").length < 10) { setErr(op.need); return; }
    // soft guard — a Gui born with zero services can't quote or close (activation.js rule)
    if (!services.some((s) => s.name.trim())) {
      const warn = {
        pt: "Sem serviços/preços a Gui não consegue COTAR nem fechar. Quer salvar mesmo assim?",
        en: "Without services/prices the Gui can't QUOTE or close. Save anyway?",
        es: "Sin servicios/precios la Gui no puede COTIZAR ni cerrar. ¿Guardar igual?",
        hi: "सेवाओं/कीमतों के बिना Gui कोट या क्लोज़ नहीं कर सकती। फिर भी सेव करें?",
      }[lang] || "Without services/prices the Gui can't quote or close. Save anyway?";
      if (!window.confirm(warn)) return;
    }
    setErr(""); setState("go"); setResult(null);
    try {
      // Seller auth mirrors /api/onboard-draft: it reads the seller's email + personal/team CODE
      // (never the bundle — the code is the one the seller typed at login, kept in their session).
      const body = { action: "save", mode, draft: assemble() };
      if (mode === "seller" && seller) { body.seller_email = seller.email; body.seller_code = seller.code || ""; body.seller = { name: seller.name, email: seller.email, ref: seller.ref }; }
      else if (token) body.token = token;
      const r = await fetch("/api/onboard-draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && (d.ok || d.id)) { setState("done"); setResult(d); onSaved && onSaved(d); }
      else { setState("err"); setErr(d.error || t.errNet); }
    } catch { setState("err"); setErr(t.errNet); }
  };

  if (state === "done") {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-g-green/30 bg-g-green/[0.06] p-7 text-center">
        <div className="text-4xl">🌱</div>
        <div className="mt-3 text-lg font-black text-g-word">{t.okTitle}</div>
        <p className="mt-1 text-[13px] text-g-muted max-w-md mx-auto">{t.okSub}</p>
        {result?.widget_snippet && (
          <div className="mt-5 text-left rounded-xl border border-white/10 bg-[#0d0c0a]/50 p-4">
            <div className="text-[11px] font-black uppercase tracking-wide text-g-gold">{t.widgetSnippet}</div>
            <pre className="mt-2 whitespace-pre-wrap break-all font-mono text-[11.5px] leading-relaxed text-g-ink">{result.widget_snippet}</pre>
            <button onClick={() => { try { navigator.clipboard.writeText(result.widget_snippet); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* */ } }} className="btn-ghost text-[12px] mt-3">{copied ? t.copied : t.copy}</button>
          </div>
        )}
        {/* 💳 CLOSE THE MONEY — the seller sends the payment link right here, no waiting on Luis.
            Link carries the client email + the seller's permanent ref (attribution forever). */}
        {(() => {
          const p = planByKey(plan);
          const ref = (seller && (seller.ref || seller.email)) || "";
          const url = payLink(clientEmail, ref);
          const waTxt = {
            pt: `Fechado! 🌱 Pra ativar a sua Gui (${p.name} · ${p.price}) é só concluir o pagamento aqui: ${url} — ela nasce automaticamente e você recebe o acesso por email em minutos.`,
            en: `Done! 🌱 To activate your Gui (${p.name} · ${p.price}) just complete the payment here: ${url} — it's born automatically and your access arrives by email in minutes.`,
            es: `¡Listo! 🌱 Para activar tu Gui (${p.name} · ${p.price}) solo completa el pago aquí: ${url} — nace automáticamente y tu acceso llega por email en minutos.`,
            hi: `हो गया! 🌱 अपनी Gui (${p.name} · ${p.price}) एक्टिवेट करने के लिए यहाँ पेमेंट पूरा करें: ${url} — यह अपने आप बनती है और एक्सेस मिनटों में ईमेल पर आता है।`,
          }[lang] || "";
          const label = { pt: "💳 Fechar a venda — mandar o link de pagamento", en: "💳 Close the sale — send the payment link", es: "💳 Cerrar la venta — enviar el link de pago", hi: "💳 बिक्री पूरी करें — पेमेंट लिंक भेजें" }[lang] || "💳 Send payment link";
          return (
            <div className="mt-5 rounded-xl border border-g-green/30 bg-g-green/[0.06] p-4 text-left">
              <div className="text-[11px] font-black uppercase tracking-wide text-g-green">{label}</div>
              <div className="mt-1 text-[12px] text-g-muted">{p.name} · {p.price} · {clientEmail || "—"}</div>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <a href={`https://wa.me/?text=${encodeURIComponent(waTxt)}`} target="_blank" rel="noopener"
                  className="rounded-full bg-g-green/15 px-3.5 py-1.5 text-[12px] font-bold text-g-green ring-1 ring-g-green/30 hover:bg-g-green/25">💬 WhatsApp</a>
                <button type="button" onClick={() => { try { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* */ } }}
                  className="rounded-full border border-white/15 px-3.5 py-1.5 text-[12px] font-bold text-g-ink hover:text-g-word">{copied ? t.copied : "📋 " + t.copy}</button>
              </div>
            </div>
          );
        })()}
        <button onClick={() => { setState("idle"); setResult(null); }} className="btn-bright text-[13px] mt-5">{t.newOne}</button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="eyebrow text-[10px]">{t.eyebrow}</div>
        <h2 className="mt-2 text-xl font-black text-g-word">{t.title}</h2>
        <p className="mt-1 text-[13px] text-g-muted max-w-2xl leading-relaxed">{t.sub}</p>
      </div>

      {/* ── Negócio ── */}
      <Section icon="🏢" title={t.sBiz} accent="green">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><div className={lbl}>{t.bizName}</div><input value={business} onChange={(e) => setBusiness(e.target.value)} className={inp + " mt-1"} placeholder="New York Pão de Queijo" /></div>
            <div><div className={lbl}>{t.clientEmail}</div><input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className={inp + " mt-1"} placeholder="cliente@email.com" /><p className="mt-1 text-[11px] text-g-muted/80">{t.clientEmailHint}</p></div>
          </div>
          {/* 🚨 Owner alert/emergency phone — REQUIRED. Born into notify_phone so emergency dispatch + owner
              alerts have a real number to RING (without it every alert silently degrades to email-only). */}
          <div>
            <div className={lbl} style={{ color: "#D9A441" }}>🚨 {op.label}</div>
            <input type="tel" value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)} className={inp + " mt-1"} placeholder="+1 305 555 0100" />
            <p className="mt-1 text-[11px] text-g-muted/80 leading-relaxed">{op.hint}</p>
          </div>
          <div><div className={lbl}>{t.bizDesc}</div><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inp + " mt-1"} /></div>
          <div>
            <div className={lbl}>{t.verticals}</div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {VERTICAL_KEYS.map((k) => {
                const on = verticals.includes(k);
                return <button key={k} type="button" onClick={() => toggleVertical(k)} className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${on ? "bg-g-green/15 text-g-word ring-1 ring-g-green/40" : "bg-white/[0.04] text-g-muted ring-1 ring-white/10 hover:text-g-word"}`}>{VERTICALS[k]?.icon} {VERTICALS[k]?.label || k}</button>;
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className={lbl}>{t.langs}</div>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {LANG_OPTS.map(([c, label]) => {
                  const on = languages.includes(c);
                  return <button key={c} type="button" onClick={() => toggleLang(c)} className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${on ? "bg-g-gold/15 text-g-word ring-1 ring-g-gold/40" : "bg-white/[0.04] text-g-muted ring-1 ring-white/10 hover:text-g-word"}`}>{label}</button>;
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-g-muted/80 leading-relaxed">{t.langsNote}</p>
            </div>
            <div>
              <div className={lbl}>{t.primaryLang}</div>
              {/* PRIMARY = one of the 4 portal languages only (the AGENT speaks the full list above). */}
              <select value={primaryLang} onChange={(e) => setPrimaryLang(e.target.value)} className={sel + " mt-1"}>
                {LANG_OPTS.filter(([c]) => UI_LANGS.includes(c)).map(([c, label]) => <option key={c} value={c} className="bg-[#161512]">{label}</option>)}
              </select>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Agente ── */}
      <Section icon="🎙️" title={t.sAgent} accent="orange" sub={selectedVoice ? `${selectedVoice.label || selectedVoice.name || voiceKey}` : undefined}>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><div className={lbl}>{t.agentName}</div><input value={agentName} onChange={(e) => setAgentName(e.target.value)} className={inp + " mt-1"} placeholder="Lilian" /></div>
            <div>
              <div className={lbl}>{t.voice}</div>
              <select value={voiceKey} onChange={(e) => setVoiceKey(e.target.value)} className={sel + " mt-1"}>
                {voices.map((v) => {
                  const k = v.key || v.id;
                  const bits = [v.label || v.name || k, v.gender, v.vibe || v.style].filter(Boolean).join(" · ");
                  return <option key={k} value={k} className="bg-[#161512]">{bits}</option>;
                })}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div><div className={lbl}>{t.logo}</div><input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className={inp + " mt-1"} placeholder="https://…/logo.png" /></div>
            <div>
              <div className={lbl}>{t.accent}</div>
              <div className="mt-1 flex items-center gap-2">
                <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-white/15 bg-transparent" />
                <input value={accent} onChange={(e) => setAccent(e.target.value)} className={inp + " w-28 font-mono"} />
              </div>
            </div>
          </div>
          {logoUrl.trim() && <img src={logoUrl} alt="" onError={(e) => { e.currentTarget.style.display = "none"; }} className="h-12 w-12 rounded-lg border border-white/10 object-contain bg-white/[0.04] p-1" />}
        </div>
      </Section>

      {/* ── Unidades ── */}
      <Section icon="📍" title={t.sUnits} right={<button type="button" onClick={() => setLocations((a) => [...a, newLocation()])} className="btn-ghost text-[12px] py-2">{t.addUnit}</button>}>
        <div className="space-y-4">
          {locations.map((l, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[12px] font-bold text-g-word">{t.unit} {i + 1}</div>
                {locations.length > 1 && <button type="button" onClick={() => setLocations((a) => a.filter((_, j) => j !== i))} className="text-[11px] text-g-muted hover:text-[#e0855f]">{t.remove}</button>}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={l.name} onChange={(e) => setLoc(i, { name: e.target.value })} className={inp} placeholder={t.uName} />
                <input value={l.phone} onChange={(e) => setLoc(i, { phone: e.target.value })} className={inp} placeholder={t.uPhone} />
                <input value={l.address} onChange={(e) => setLoc(i, { address: e.target.value })} className={inp + " sm:col-span-2"} placeholder={t.uAddress} />
                <select value={l.tz} onChange={(e) => setLoc(i, { tz: e.target.value })} className={sel + " sm:col-span-2"}>
                  {[...new Set([l.tz, ...TZ_OPTS])].filter(Boolean).map((z) => <option key={z} value={z} className="bg-[#161512]">{z}</option>)}
                </select>
              </div>
              <div className="mt-3">
                <div className={lbl}>{t.uHours}</div>
                <div className="mt-1.5 space-y-1">
                  {l.hours.map((h) => (
                    <div key={h.weekday} className="flex items-center gap-2 text-[12px]">
                      <span className="w-9 shrink-0 font-bold text-g-muted">{wd[h.weekday]}</span>
                      <label className="flex items-center gap-1 text-g-muted"><input type="checkbox" checked={h.closed} onChange={(e) => setHour(i, h.weekday, { closed: e.target.checked })} />{t.closed}</label>
                      {!h.closed && (
                        <>
                          <input value={h.open} onChange={(e) => setHour(i, h.weekday, { open: e.target.value })} placeholder="09:00" className="w-16 rounded-md border border-white/15 bg-white/[0.05] px-2 py-1 text-center text-g-word focus:outline-none focus:border-g-gold/50" />
                          <span className="text-g-muted">—</span>
                          <input value={h.close} onChange={(e) => setHour(i, h.weekday, { close: e.target.value })} placeholder="18:00" className="w-16 rounded-md border border-white/15 bg-white/[0.05] px-2 py-1 text-center text-g-word focus:outline-none focus:border-g-gold/50" />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Serviços ── */}
      <Section icon="🧾" title={t.sServices} accent="green" right={<button type="button" onClick={() => setServices((a) => [...a, newService()])} className="btn-ghost text-[12px] py-2">{t.addService}</button>}>
        <div className="space-y-2">
          {services.map((s, i) => (
            <div key={i} className="grid items-center gap-2 sm:grid-cols-[1.4fr_1fr_.7fr_.7fr_.7fr_auto]">
              <input value={s.name} onChange={(e) => setSvc(i, { name: e.target.value })} className={inp} placeholder={t.svcName} />
              <select value={s.vertical} onChange={(e) => setSvc(i, { vertical: e.target.value })} className={sel}>
                {VERTICAL_KEYS.map((k) => <option key={k} value={k} className="bg-[#161512]">{VERTICALS[k]?.label || k}</option>)}
              </select>
              <input type="number" min="0" value={s.duration_min} onChange={(e) => setSvc(i, { duration_min: e.target.value })} className={inp} placeholder={t.svcDur} title={t.svcDur} />
              <input value={s.price} onChange={(e) => setSvc(i, { price: e.target.value })} className={inp} placeholder={t.svcPrice} title={t.svcPrice} />
              <input value={s.deposit} onChange={(e) => setSvc(i, { deposit: e.target.value })} className={inp} placeholder={t.svcDeposit} title={t.svcDeposit} />
              {services.length > 1 ? <button type="button" onClick={() => setServices((a) => a.filter((_, j) => j !== i))} className="text-[16px] text-g-muted hover:text-[#e0855f]">×</button> : <span />}
            </div>
          ))}
        </div>
      </Section>

      {/* ── Equipe ── */}
      <Section icon="👥" title={t.sTeam} right={<button type="button" onClick={() => setTeam((a) => [...a, newMember()])} className="btn-ghost text-[12px] py-2">{t.addMember}</button>}>
        {team.length === 0 ? <p className="text-[12px] text-g-muted">—</p> : (
          <div className="space-y-2">
            {team.map((m, i) => (
              <div key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_1.2fr_1.2fr_auto]">
                <input value={m.name} onChange={(e) => setMem(i, { name: e.target.value })} className={inp} placeholder={t.mName} />
                <input value={m.title} onChange={(e) => setMem(i, { title: e.target.value })} className={inp} placeholder={t.mTitle} />
                <input value={m.services} onChange={(e) => setMem(i, { services: e.target.value })} className={inp} placeholder={t.mServices} />
                <input value={m.locations} onChange={(e) => setMem(i, { locations: e.target.value })} className={inp} placeholder={t.mLocations} />
                <button type="button" onClick={() => setTeam((a) => a.filter((_, j) => j !== i))} className="text-[16px] text-g-muted hover:text-[#e0855f]">×</button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Canais ── */}
      <Section icon="🔌" title={t.sChannels} accent="orange" sub={t.pendingNote}>
        <div className="space-y-2.5">
          {chList.map((ch, idx) => {
            const key = keyOf(ch);
            if (!key) return null;
            const isLive = liveKeys.has(key) ? true : pendKeys.has(key) ? false : ch.status ? ch.status === "live" : key === "phone" || key === "widget" || key === "email" || key === "sms";
            const label = ch.label || CH_LABEL[key] || key;
            const icon = ch.emoji || ch.icon || CH_ICON[key] || "•";
            const badge = isLive
              ? <span className="rounded-full bg-g-green/15 px-2 py-0.5 text-[10px] font-black text-g-green ring-1 ring-g-green/30">{t.live}</span>
              : <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ background: "rgba(217,164,65,0.14)", color: "#D9A441", boxShadow: "inset 0 0 0 1px rgba(217,164,65,0.35)" }}>{t.pending}</span>;

            return (
              <div key={key + idx} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-2">
                  <span className="text-[15px]">{icon}</span>
                  <span className="text-[13px] font-bold text-g-word">{label}</span>
                  <span className="ml-auto">{badge}</span>
                </div>
                {key === "phone" ? (
                  <div className="mt-2.5 space-y-2">
                    <select value={phone.mode} onChange={(e) => setPhone((p) => ({ ...p, mode: e.target.value }))} className={sel}>
                      <option value="buy" className="bg-[#161512]">{t.phoneBuy}</option>
                      <option value="map" className="bg-[#161512]">{t.phoneMap}</option>
                      <option value="none" className="bg-[#161512]">{t.phoneNone}</option>
                    </select>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {phone.mode === "buy" && <input value={phone.area_code} onChange={(e) => setPhone((p) => ({ ...p, area_code: e.target.value }))} className={inp} placeholder={t.areaCode} />}
                      {phone.mode === "map" && <input value={phone.existing_number} onChange={(e) => setPhone((p) => ({ ...p, existing_number: e.target.value }))} className={inp} placeholder={t.existingNum} />}
                      <input value={phone.forward} onChange={(e) => setPhone((p) => ({ ...p, forward: e.target.value }))} className={inp} placeholder={t.forward} />
                    </div>
                  </div>
                ) : key === "widget" ? (
                  <label className="mt-2 flex items-center gap-2 text-[12.5px] text-g-ink"><input type="checkbox" checked={widgetEnabled} onChange={(e) => setWidgetEnabled(e.target.checked)} />{t.widgetOn}</label>
                ) : key === "ads" ? (
                  <label className="mt-2 flex items-center gap-2 text-[12.5px] text-g-ink"><input type="checkbox" checked={adsEnabled} onChange={(e) => setAdsEnabled(e.target.checked)} />{t.adsOn}</label>
                ) : CH_FIELD[key] ? (
                  <input value={chText[key] || ""} onChange={(e) => setChText((m) => ({ ...m, [key]: e.target.value }))} className={inp + " mt-2"} placeholder={ch.placeholder || CH_PH[key] || ""} />
                ) : null}
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── Suporte & extras ── */}
      <Section icon="🎛️" title={t.sExtras}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><div className={lbl}>{t.supportLink}</div><input value={supportLink} onChange={(e) => setSupportLink(e.target.value)} className={inp + " mt-1"} placeholder="https://…" /></div>
          <div><div className={lbl}>{t.reviewLink}</div><input value={reviewLink} onChange={(e) => setReviewLink(e.target.value)} className={inp + " mt-1"} placeholder="https://g.page/…" /></div>
          <div>
            <div className={lbl}>{t.plan}</div>
            <select value={plan} onChange={(e) => { setPlan(e.target.value); setCredits(planByKey(e.target.value).credits); }} className={sel + " mt-1"}>
              {GUILEO_PLANS.map((p) => (
                <option key={p.key} value={p.key} className="bg-[#161512]">{p.name} — {p.price} · {p.credits} {t.credits.toLowerCase()}</option>
              ))}
            </select>
          </div>
          <div><div className={lbl}>{t.credits}</div><input type="number" min="0" value={credits} onChange={(e) => setCredits(e.target.value)} className={inp + " mt-1"} /></div>
        </div>
      </Section>

      {err && <div className="text-[13px] text-[#e0855f]">{err}</div>}
      <div className="flex justify-end pb-2">
        <button type="button" onClick={submit} disabled={state === "go"} className="btn-bright text-[14px] disabled:opacity-60">{state === "go" ? t.submitting : `🌱 ${t.submit}`}</button>
      </div>
    </div>
  );
}
