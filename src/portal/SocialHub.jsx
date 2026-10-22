/* Redes Sociais tab — the CLIENT's OWN Meta presence, run by the SAME Gui (one brain, many channels).
   Channel = transport only: the identical Gui that answers voice/webchat/SMS replies to Instagram DMs,
   Messenger and WhatsApp, and drafts posts — with the owner choosing AUTO or APPROVE-first (the A+B).
   Four honest sections:
     (a) 🔗 Conectar   — Instagram / Facebook / WhatsApp: connected|connect (OAuth Meta) · "a Gui responde suas DMs sozinha, 24/7"
     (b) 💬 Mensagens  — the REAL social conversations Gui already handled (from the unified inbox, social channels) + honest empty
     (c) ✍️ Publicar   — the A+B toggle "Automático / Aprovar antes" (set_mode) + pending drafts w/ Aprovar·Editar·Recusar
     (d) honest amber "aguardando app Meta" whenever the Meta app isn't approved yet (inert, nothing fakes)
   HONESTY: the Meta Graph API needs per-project app review + Business verification (env META_APP_ID/SECRET
   + verify token), so real accounts see amber "aguardando aprovação do app Meta" until it's live — we NEVER
   show a fabricated DM or pretend a post published. Demo mode = rich per-sector preview so the tour is alive.
   Anti-injection: every inbound DM/comment is UNTRUSTED content — rendered as data, never executed; the owner
   stays in the loop for anything public via the Aprovar-antes mode. Tenant is always scoped by email+dataKey.
   Props {V, real, email, dataKey} — same contract as GoogleHub/RiskRadar/GrowthIntel. */
import { useState, useEffect } from "react";
import { FaInstagram, FaFacebook, FaWhatsapp, FaCircleCheck, FaRobot, FaPenToSquare, FaCheck, FaXmark } from "react-icons/fa6";
import { portalApi, toast } from "../lib/portalApi.js";
import { Card, Empty, SectionSkeleton, UI_LANG, genInbox } from "../pages/Portal.jsx";
import NoSeuPlano from "./NoSeuPlano.jsx";

// ── local 4-language copy (self-contained; leaves the shared dicts untouched) ──
const t = (o) => o[UI_LANG] || o.en;

// Every network answer carries its OWN verdict (_ok/_status): an HTTP error must NEVER be able to
// look like "zero drafts". Callers read _ok before treating the payload as data.
async function apiPost(url, body) {
  try {
    // `ui_lang` = idioma da TELA. O servidor devolve `note` nesse idioma (functions/api/
    // social-publish.js → respostaNoIdioma). Sem ele a nota chegava em português para uma tela em
    // inglês ("Esta conta ainda não foi vinculada ao Instagram/Facebook.").
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ui_lang: UI_LANG, ...body }) });
    const d = await r.json().catch(() => ({}));
    return { ...(d && typeof d === "object" ? d : {}), _ok: r.ok && d?.ok !== false, _status: r.status };
  } catch (e) { return { _ok: false, _status: 0, error: String(e).slice(0, 120) }; }
}

// The three Meta surfaces the one Gui works across. Brand colors are the networks' own.
const NETS = [
  { k: "instagram", label: "Instagram", Icon: FaInstagram, color: "#E4405F", re: /insta|instagram|\big\b|ig[_-]?dm/i },
  { k: "facebook", label: "Facebook / Messenger", Icon: FaFacebook, color: "#1877F2", re: /facebook|messenger|\bfb\b|fb[_-]?dm/i },
  { k: "whatsapp", label: "WhatsApp", Icon: FaWhatsapp, color: "#25D366", re: /whats|wa[_-]?dm/i },
];
const netFor = (channel = "") => NETS.find((n) => n.re.test(String(channel))) || null;

// Chip: connected / pending-app / disconnected — the honest signal colors (green/amber/muted).
function StatusChip({ state }) {
  const map = {
    live: ["#3E9468", t({ en: "Connected · Gui is replying", pt: "Conectado · a Gui responde", es: "Conectado · Gui responde", hi: "कनेक्टेड · Gui जवाब देती है" })],
    pending: ["#FFC23D", t({ en: "Linked · waiting for Meta app approval", pt: "Conectado · aguardando aprovação do app Meta", es: "Conectado · esperando aprobación de la app de Meta", hi: "कनेक्टेड · Meta ऐप स्वीकृति का इंतज़ार" })],
    off: ["#9A8F82", t({ en: "Not connected yet", pt: "Ainda não conectado", es: "Aún no conectado", hi: "अभी कनेक्ट नहीं" })],
    // We genuinely can't see this one from here (WhatsApp lives in the WhatsApp Cloud engine).
    // Claiming "not connected" would be a guess — so the chip says exactly that.
    unknown: ["#9A8F82", t({ en: "Checked by our team", pt: "Verificado pela nossa equipe", es: "Verificado por nuestro equipo", hi: "हमारी टीम द्वारा जाँचा जाता है" })],
  };
  const [c, label] = map[state] || map.off;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-black whitespace-nowrap"
      style={{ color: c, background: `${c}1e`, boxShadow: `inset 0 0 0 1px ${c}40` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c, boxShadow: `0 0 7px ${c}99` }} />{label}
    </span>
  );
}

function SocialHub({ V, real = null, email = "", dataKey = "" }) {
  const demo = !real;
  // real backend state: null = loading; else { appReady, nets:{instagram,facebook,whatsapp}, mode, msgs:[], drafts:[] }
  const [S, setS] = useState(null);
  const [connecting, setConnecting] = useState(null); // network key currently connecting
  const [editing, setEditing] = useState(null); // draft id being edited
  const [editText, setEditText] = useState("");
  // Publish mode (the A+B) — persisted locally as the owner's honest intent, mirrored to the server best-effort.
  const modeKey = `${email || V.label}:social_mode`;
  const [mode, setMode] = useState(() => portalApi.loadState(modeKey, "approve"));

  useEffect(() => {
    let alive = true;
    if (!real || !email || !dataKey) return;
    (async () => {
      // ONE brain, MANY channels → we read the social slice of the UNIFIED inbox (live today) and the
      // Meta connect/publish state (lights up with the app). Both degrade to honest empties, never a 500.
      const [st, inbox] = await Promise.all([
        apiPost("/api/social-publish", { action: "status", email, token: dataKey }),
        apiPost("/api/inbox", { action: "threads", email, token: dataKey, limit: 60 }),
      ]);
      if (!alive) return;
      // The status call either ANSWERED or FAILED — a failure is an error state, never an empty one.
      const stOk = !!st?._ok;
      const netState = (stOk && st.nets) || {};
      /* 🚨 "APP NÃO APROVADO" ≠ "CONTA NÃO VINCULADA" (2026-09-28). A tela lia só `st.ready`, que o
         servidor calcula como `live && connected`. Com o app Meta JÁ APROVADO (`live:true`) e a
         conta do cliente ainda sem vínculo (`connected:false`), `ready` é falso — e a faixa dizia
         "Waiting on Meta app approval": culpava a Meta por uma espera que não existe mais, e a
         dona ficava aguardando uma aprovação em vez de nos chamar para vincular a conta.
         São dois estados, com duas frases e dois donos do próximo passo:
           live=false                 → esperando a Meta (nada a fazer do lado dela)
           live=true, connected=false → falta vincular a conta DELA (nossa equipe faz com ela)
         Servidor antigo sem o campo `live`: só dá para saber `ready`; aí a tela não afirma qual
         dos dois é — mostra a nota do servidor. */
      const temLive = stOk && typeof st.live === "boolean";
      const live = temLive ? st.live : null;
      const connected = stOk && typeof st.connected === "boolean" ? st.connected : null;
      const appReady = stOk && !!st.ready;
      // Social messages = the inbox threads whose channel is a Meta surface (untrusted content, rendered as data).
      const threads = inbox?._ok && Array.isArray(inbox.threads) ? inbox.threads : [];
      const msgs = threads
        .map((th) => {
          const channel = th.channel || th.chan || "";
          const net = netFor(channel);
          if (!net) return null;
          return {
            net,
            name: th.contact || th.name || th.title || t({ en: "New DM", pt: "Nova DM", es: "Nuevo DM", hi: "नई DM" }),
            last: th.last || th.summary || th.preview || th.snippet || "",
            when: th.when || th.at || th.time || th.ts || "",
            handled: th.human ? false : true, // Gui handled unless a human took the thread over
          };
        })
        .filter(Boolean)
        .slice(0, 12);
      // Server rows are {id, channel, content}; the card renders {id, net, text}. Normalize HERE so
      // a real draft never renders blank (and demo rows, already in card shape, pass through).
      const drafts = (stOk && Array.isArray(st.drafts) ? st.drafts : []).map((d) => ({
        id: d.id, net: d.net || d.channel || "instagram", text: d.text || d.content || "", status: d.status,
      }));
      // `store_ready:false` = a tabela de posts não existe ainda. A lista de rascunhos vem
      // vazia por ISSO, não porque não haja rascunhos — e o cartão dizia "Nenhum rascunho
      // agora — a Gui vai colocar novos posts aqui pro seu ✓", que é uma promessa falsa
      // enquanto o motor não está instalado. Agora esse estado é carregado até a tela.
      const storeReady = stOk ? st.store_ready !== false : false;
      setS({ appReady, live, connected, nets: netState, mode: (stOk && st.mode) || mode, msgs, drafts, note: stOk ? st.note || "" : "", error: !stOk, msgsError: !inbox?._ok, storeReady });
      if (stOk && st.mode && st.mode !== mode) { setMode(st.mode); portalApi.saveState(modeKey, st.mode); }
    })();
    return () => { alive = false; };
  }, [real, email, dataKey]); // eslint-disable-line

  // Connect: ask the server for the REAL connection state of this network and show the REAL blocker.
  // There is no self-serve Meta OAuth yet (it needs an approved Meta app + reviewed redirect flow),
  // so this button never pretends to connect anything — it tells the owner exactly what's missing
  // and refreshes the chip from server truth if the account IS already linked.
  const connect = async (netKey) => {
    setConnecting(netKey);
    const r = await apiPost("/api/social-publish", { action: "connect", email, token: dataKey, network: netKey });
    setConnecting(null);
    if (!r?._ok) {
      toast(t({ en: "Couldn't reach the social engine — try again", pt: "Não consegui falar com o motor social — tente de novo", es: "No pude conectar con el motor social — intenta de nuevo", hi: "सोशल इंजन तक नहीं पहुँच सका — फिर से आज़माएँ" }));
      return;
    }
    if (r.nets) setS((s) => ({ ...(s || {}), appReady: !!r.ready || !!(s && s.appReady), nets: { ...((s && s.nets) || {}), ...r.nets } }));
    // `blocked_by` também diz em qual dos dois estados estamos: "meta_app" = app não aprovado;
    // "tenant_tokens" = app aprovado, falta vincular esta conta.
    if (r.blocked_by === "tenant_tokens") setS((s) => ({ ...(s || {}), live: true, connected: false }));
    if (r.blocked_by === "meta_app") setS((s) => ({ ...(s || {}), live: false }));
    // The SERVER decides the blocker (Meta app · this tenant's tokens · nothing); the UI only
    // translates it. Unknown blocker → show the server's own note rather than inventing one.
    const said = {
      meta_app: t({ en: "Waiting on Meta app approval — nothing publishes until then. We'll link your account the moment it's live.", pt: "Aguardando aprovação do app Meta — nada publica até lá. Vinculamos sua conta assim que estiver no ar.", es: "Esperando la aprobación de la app de Meta — nada se publica hasta entonces. Enlazamos tu cuenta en cuanto esté activa.", hi: "Meta ऐप स्वीकृति का इंतज़ार — तब तक कुछ प्रकाशित नहीं होता। लाइव होते ही आपका खाता जोड़ देंगे।" }),
      tenant_tokens: t({ en: "Almost there — our team finishes the secure Meta connection with you.", pt: "Quase lá — nossa equipe conclui a conexão segura com o Meta com você.", es: "Casi listo — nuestro equipo completa la conexión segura con Meta.", hi: "लगभग तैयार — हमारी टीम Meta कनेक्शन पूरा करेगी।" }),
      outside_this_panel: t({ en: "WhatsApp is linked through the WhatsApp Cloud engine — our team confirms that connection with you.", pt: "O WhatsApp é ligado pelo motor WhatsApp Cloud — nossa equipe confirma essa conexão com você.", es: "WhatsApp se enlaza por el motor de WhatsApp Cloud — nuestro equipo confirma esa conexión contigo.", hi: "WhatsApp, WhatsApp Cloud इंजन से जुड़ता है — हमारी टीम वह कनेक्शन पुष्ट करती है।" }),
    }[r.blocked_by];
    toast(said || (r.blocked_by === null || r.blocked_by === undefined
      ? t({ en: "Connected ✓ — Gui is on it", pt: "Conectado ✓ — a Gui já está nele", es: "Conectado ✓ — Gui ya está en ello", hi: "कनेक्टेड ✓ — Gui अब इस पर है" })
      : r.note || ""));
  };

  // A+B: switch AUTO ⇄ APPROVE-first. Local intent is the source of truth for the UI; server is best-effort.
  const setPublishMode = async (m) => {
    const prev = mode;
    setMode(m); portalApi.saveState(modeKey, m);
    setS((s) => (s ? { ...s, mode: m } : s));
    if (!(real && email && dataKey)) {
      toast(m === "auto"
        ? t({ en: "Auto — Gui posts on its own", pt: "Automático — a Gui posta sozinha", es: "Automático — Gui publica sola", hi: "स्वतः — Gui खुद पोस्ट करती है" })
        : t({ en: "Approve first — nothing goes public until you say so", pt: "Aprovar antes — nada vai ao ar sem seu ok", es: "Aprobar antes — nada se publica sin tu ok", hi: "पहले मंज़ूरी — आपकी अनुमति बिना कुछ सार्वजनिक नहीं" }));
      return;
    }
    const r = await apiPost("/api/social-publish", { action: "set_mode", email, token: dataKey, mode: m });
    // ⚠️ `ok:true` NÃO BASTA AQUI. Quando o motor social não está instalado no banco, o
    // endpoint responde `{ok:true, ready:false, note:"Paste db/social_posts.sql…"}` — sem o
    // campo `mode`. A guarda antiga (`if (!r._ok)`) lia isso como sucesso e o dono ficava
    // acreditando que "Aprovar antes" o protegia, quando o servidor nunca gravou preferência
    // nenhuma. A prova de que a escolha pegou é o servidor DEVOLVER o modo que ele gravou.
    if (r._ok && r.mode === m) {
      toast(m === "auto"
        ? t({ en: "Auto — Gui posts on its own", pt: "Automático — a Gui posta sozinha", es: "Automático — Gui publica sola", hi: "स्वतः — Gui खुद पोस्ट करती है" })
        : t({ en: "Approve first — nothing goes public until you say so", pt: "Aprovar antes — nada vai ao ar sem seu ok", es: "Aprobar antes — nada se publica sin tu ok", hi: "पहले मंज़ूरी — आपकी अनुमति बिना कुछ सार्वजनिक नहीं" }));
      return;
    }
    // Não gravou → volta ao que era e diz a verdade. Preferência que o servidor não aceitou
    // não é preferência, e esta em particular decide se algo vai a público sem o dono ver.
    setMode(prev); portalApi.saveState(modeKey, prev);
    setS((s) => (s ? { ...s, mode: prev } : s));
    toast(r.note || t({
      en: "The server didn't record that choice — it's unchanged. Nothing publishes automatically while publishing isn't switched on.",
      pt: "O servidor não registrou essa escolha — ela continua como estava. Nada publica sozinho enquanto a publicação não estiver ligada.",
      es: "El servidor no registró esa elección — sigue como estaba. Nada se publica solo mientras la publicación no esté activada.",
      hi: "सर्वर ने वह चुनाव दर्ज नहीं किया — यह पहले जैसा ही है। प्रकाशन चालू न होने तक कुछ अपने-आप प्रकाशित नहीं होता।" }));
  };

  // Draft decisions — approve / refuse / save-edit. Optimistic UI; server best-effort (degrades honestly).
  const decideDraft = async (id, decision, text) => {
    const prev = S;
    // optimistic remove
    setS((s) => (s ? { ...s, drafts: (s.drafts || []).filter((d) => d.id !== id) } : s));
    setEditing(null);
    // HONESTY: don't claim "Approved ✓ — Gui will publish" before the backend confirms. In demo, it's
    // fine to celebrate; in real mode, await the call and gate the success toast on r.ok — restore the
    // draft if it failed so we never tell the owner a post will publish when nothing was persisted.
    if (real && email && dataKey) {
      const r = await apiPost("/api/social-publish", { action: decision, email, token: dataKey, id, text: text || null });
      if (r?._ok) {
        toast(decision !== "approve"
          ? t({ en: "Declined — Gui won't post it", pt: "Recusado — a Gui não posta", es: "Rechazado — Gui no lo publica", hi: "अस्वीकृत — Gui इसे पोस्ट नहीं करेगी" })
          : r.published
            ? t({ en: "Approved ✓ — published", pt: "Aprovado ✓ — publicado", es: "Aprobado ✓ — publicado", hi: "स्वीकृत ✓ — प्रकाशित" })
            // Approved but NOT public yet (Meta app / account still pending). Say the truth and
            // pass along the server's reason instead of promising a post that can't go out.
            : t({ en: "Approved ✓ — it goes out the moment Meta is live.", pt: "Aprovado ✓ — sai no instante em que o Meta estiver no ar.", es: "Aprobado ✓ — sale en cuanto Meta esté activo.", hi: "स्वीकृत ✓ — Meta लाइव होते ही यह जाएगा।" }) + (r.note ? ` (${r.note})` : ""));
      } else {
        setS(prev); // restore — the action didn't go through
        toast(t({ en: "Couldn't reach the social engine — try again", pt: "Não consegui falar com o motor social — tente de novo", es: "No pude conectar con el motor social — intenta de nuevo", hi: "सोशल इंजन तक नहीं पहुँच सका — फिर से आज़माएँ" }));
      }
    } else {
      toast(decision === "approve"
        ? t({ en: "Approved ✓ — Gui will publish it", pt: "Aprovado ✓ — a Gui publica", es: "Aprobado ✓ — Gui lo publica", hi: "स्वीकृत ✓ — Gui इसे पोस्ट करेगी" })
        : t({ en: "Declined — Gui won't post it", pt: "Recusado — a Gui não posta", es: "Rechazado — Gui no lo publica", hi: "अस्वीकृत — Gui इसे पोस्ट नहीं करेगी" }));
    }
  };

  // ── real mode, still loading → skeleton (never a false empty state) ──
  if (real && S === null) return <SectionSkeleton rows={6} />;

  // Per-network connection state. Demo = all live; real = server truth (default off → honest).
  const netStateOf = (k) => (demo ? "live" : (["live", "pending", "unknown"].includes(S.nets?.[k]) ? S.nets[k] : "off"));
  const anyConnected = NETS.some((n) => ["live", "pending"].includes(netStateOf(n.k)));
  const appReady = demo ? true : !!S.appReady;
  // Inert = the motor is genuinely not live yet. If the status call FAILED we don't know that, so we
  // show a connection error instead of blaming Meta for something we couldn't verify.
  const inert = !demo && !appReady && !S.error;
  // qual dos dois motivos — ver o comentário na leitura do status
  const esperandoMeta = inert && S.live === false;
  const faltaVincular = inert && S.live === true && S.connected !== true;
  const motivoIncerto = inert && !esperandoMeta && !faltaVincular;

  // Messages: demo = rich per-sector sample; real = only the social threads the inbox returned (honest empty otherwise).
  const demoMsgs = (() => {
    const src = (typeof genInbox === "function" ? genInbox(V) : []) || [];
    return src.slice(0, 5).map((c, i) => ({
      net: NETS[i % NETS.length],
      name: c.name || c.who || t({ en: "Customer", pt: "Cliente", es: "Cliente", hi: "ग्राहक" }),
      last: c.last || c.preview || c.msg || t({ en: "Hi! Are you open today?", pt: "Oi! Vocês estão abertos hoje?", es: "¡Hola! ¿Abren hoy?", hi: "नमस्ते! क्या आज खुले हैं?" }),
      when: c.t || c.when || `${i + 1}m`,
      handled: true,
    }));
  })();
  const msgs = demo ? demoMsgs : (S.msgs || []);

  // Drafts: demo = a couple of on-brand samples; real = only what the server returned (honest empty).
  const demoDrafts = [
    { id: "d1", net: "instagram", text: t({ en: "This week only — book any service and bring a friend for 20% off. Tap to reserve 💫", pt: "Só esta semana — agende qualquer serviço e traga um amigo com 20% off. Toque para reservar 💫", es: "Solo esta semana — reserva cualquier servicio y trae a un amigo con 20% off. Toca para reservar 💫", hi: "सिर्फ़ इस हफ़्ते — कोई भी सेवा बुक करें और दोस्त लाएँ, 20% छूट। बुक करने के लिए टैप करें 💫" }) },
    { id: "d2", net: "facebook", text: t({ en: "New Saturday hours! We're now open until 8pm — same-day slots still available.", pt: "Novo horário de sábado! Agora abrimos até as 20h — ainda há horários no mesmo dia.", es: "¡Nuevo horario de sábado! Ahora abrimos hasta las 20h — quedan turnos para hoy.", hi: "नया शनिवार समय! अब हम रात 8 बजे तक खुले हैं — आज के स्लॉट अब भी उपलब्ध।" }) },
  ];
  const drafts = demo ? demoDrafts : (S.drafts || []);

  return (
    <div className="space-y-4 stagger">
      {/* convite, nunca cadeado: diz que este recurso mora no degrau de cima (ver NoSeuPlano.jsx) */}
      <NoSeuPlano real={real} produto="social_manage" />
      {/* Header */}
      <div className="rounded-2xl border border-[#E4405F]/25 bg-gradient-to-br from-[#E4405F]/[0.08] via-[#1877F2]/[0.05] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#E4405F" }}>
          <FaInstagram size={12} /> {t({ en: "Your social channels", pt: "Suas redes sociais", es: "Tus redes sociales", hi: "आपकी सोशल मीडिया" })}
          {real
            ? <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />{t({ en: "LIVE — your account", pt: "AO VIVO — sua conta", es: "EN VIVO — tu cuenta", hi: "लाइव — आपका खाता" })}</span>
            : <span className="text-g-muted normal-case font-bold text-[9px] border border-white/10 rounded-full px-1.5 py-px">{t({ en: "preview", pt: "prévia", es: "vista previa", hi: "पूर्वावलोकन" })}</span>}
        </div>
        <div className="mt-1 text-xl font-black text-g-word">{t({ en: "The same Gui — now on Instagram, Messenger & WhatsApp.", pt: "A mesma Gui — agora no Instagram, Messenger e WhatsApp.", es: "La misma Gui — ahora en Instagram, Messenger y WhatsApp.", hi: "वही Gui — अब Instagram, Messenger और WhatsApp पर।" })}</div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">{t({ en: "One brain across every channel: Gui replies to your DMs on its own, 24/7, in your voice — and drafts posts for you to auto-publish or approve first.", pt: "Um só cérebro em todos os canais: a Gui responde suas DMs sozinha, 24/7, no seu tom — e cria posts para você publicar no automático ou aprovar antes.", es: "Un cerebro en todos los canales: Gui responde tus DMs sola, 24/7, con tu voz — y crea publicaciones para auto-publicar o aprobar antes.", hi: "हर चैनल पर एक दिमाग: Gui आपकी DM का खुद जवाब देती है, 24/7, आपकी शैली में — और पोस्ट बनाती है जिन्हें आप स्वतः या मंज़ूरी के बाद प्रकाशित करें।" })}</p>
      </div>

      {demo && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-2.5 text-[11px] font-bold text-g-gold">
          {t({ en: "Sample preview — connect your Meta account to manage your real DMs and posts.", pt: "Prévia de exemplo — conecte sua conta Meta para gerir suas DMs e posts reais.", es: "Vista previa — conecta tu cuenta de Meta para gestionar tus DMs y publicaciones reales.", hi: "नमूना पूर्वावलोकन — असली DM और पोस्ट के लिए अपना Meta खाता कनेक्ट करें।" })}
        </div>
      )}

      {/* The status call didn't answer — say THAT, don't dress a failure up as an empty account. */}
      {!demo && S.error && (
        <div className="rounded-xl2 border border-[#E2533F]/30 bg-[#E2533F]/[0.07] px-4 py-3 text-[11.5px] text-[#E2533F] leading-snug">
          <span className="font-black">{t({ en: "Couldn't read your social status.", pt: "Não consegui ler o estado das suas redes.", es: "No pude leer el estado de tus redes.", hi: "आपकी सोशल स्थिति नहीं पढ़ सका।" })}</span>{" "}
          {t({ en: "This is a connection problem on our side — nothing below is a statement about your accounts. Reload in a moment.", pt: "Isso é uma falha de conexão do nosso lado — nada abaixo afirma nada sobre suas contas. Recarregue em instantes.", es: "Es un problema de conexión de nuestro lado — nada de abajo afirma nada sobre tus cuentas. Recarga en un momento.", hi: "यह हमारी ओर की कनेक्शन समस्या है — नीचे कुछ भी आपके खातों के बारे में दावा नहीं करता। थोड़ी देर में फिर लोड करें।" })}
        </div>
      )}

      {/* Honest inert banner — Meta app not approved yet. Nothing here fakes a connection or a post. */}
      {faltaVincular && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-3 text-[11.5px] text-g-gold leading-snug">
          <span className="font-black">{t({ en: "Your account isn't linked yet.", pt: "Sua conta ainda não está vinculada.", es: "Tu cuenta aún no está vinculada.", hi: "आपका खाता अभी जुड़ा नहीं है।" })}</span>{" "}
          {t({ en: "Our Meta app is approved — what's missing is linking YOUR Instagram / Facebook Page. Our team completes that secure link with you; until then Gui doesn't reply to DMs or publish there.", pt: "O nosso app Meta já está aprovado — o que falta é vincular a SUA Página do Facebook / Instagram. A nossa equipe conclui essa vinculação segura com você; até lá a Gui não responde DMs nem publica lá.", es: "Nuestra app de Meta ya está aprobada — lo que falta es vincular TU Página de Facebook / Instagram. Nuestro equipo completa esa vinculación segura contigo; hasta entonces Gui no responde DMs ni publica allí.", hi: "हमारा Meta ऐप स्वीकृत है — अब आपका Instagram / Facebook पेज जोड़ना बाकी है। हमारी टीम आपके साथ यह सुरक्षित लिंक पूरा करती है; तब तक Gui वहाँ DM का जवाब नहीं देती और न प्रकाशित करती है।" })}
        </div>
      )}
      {motivoIncerto && S.note && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-3 text-[11.5px] text-g-gold leading-snug">{S.note}</div>
      )}
      {esperandoMeta && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-3 text-[11.5px] text-g-gold leading-snug">
          <span className="font-black">{t({ en: "Waiting on Meta app approval.", pt: "Aguardando aprovação do app Meta.", es: "Esperando la aprobación de la app de Meta.", hi: "Meta ऐप स्वीकृति का इंतज़ार।" })}</span>{" "}
          {t({ en: "You can link your accounts now — Gui starts replying to DMs and publishing the second Meta approves us. Nothing here pretends to be live until then.", pt: "Você já pode conectar suas contas — a Gui começa a responder DMs e publicar no instante em que o Meta nos aprovar. Nada aqui finge estar no ar até lá.", es: "Ya puedes enlazar tus cuentas — Gui empieza a responder DMs y publicar en cuanto Meta nos apruebe. Nada aquí finge estar activo hasta entonces.", hi: "आप अभी अपने खाते जोड़ सकते हैं — Meta की स्वीकृति मिलते ही Gui DM का जवाब देना और पोस्ट करना शुरू कर देगी। तब तक यहाँ कुछ भी लाइव होने का दिखावा नहीं करता।" })}
          {/* a razão do servidor — agora no idioma da tela (`ui_lang`), não mais em português */}
          {!demo && S.note && <div className="mt-1 opacity-80">{S.note}</div>}
        </div>
      )}

      {/* (a) 🔗 Conectar */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-2 text-g-word">🔗 {t({ en: "Connect", pt: "Conectar", es: "Conectar", hi: "कनेक्ट करें" })}</span>
        </div>
        <p className="text-[11px] text-g-muted mb-3 leading-snug">{t({ en: "Link each account once — then the Gui you already know replies to your DMs on its own, 24/7.", pt: "Conecte cada conta uma vez — e a Gui que você já conhece responde suas DMs sozinha, 24/7.", es: "Enlaza cada cuenta una vez — y la Gui que ya conoces responde tus DMs sola, 24/7.", hi: "हर खाता एक बार जोड़ें — फिर वही Gui आपकी DM का खुद जवाब देती है, 24/7।" })}</p>
        <div className="space-y-2">
          {NETS.map(({ k, label, Icon, color }) => {
            const st = netStateOf(k);
            return (
              <div key={k} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-black/15 px-3 py-3">
                <span className="grid place-items-center h-10 w-10 rounded-xl shrink-0" style={{ background: color + "22", color }}><Icon size={17} /></span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-g-word">{label}</div>
                  <div className="mt-1"><StatusChip state={st} /></div>
                </div>
                {st === "off" || st === "unknown" ? (
                  <button onClick={() => connect(k)} disabled={connecting === k} className="btn-bright text-[12px] px-3 py-1.5 shrink-0 disabled:opacity-60">
                    {connecting === k ? "…" : t({ en: "Connect", pt: "Conectar", es: "Conectar", hi: "जोड़ें" })}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-g-green shrink-0"><FaCircleCheck size={10} /> {t({ en: "Linked", pt: "Conectado", es: "Enlazado", hi: "जुड़ा" })}</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* (b) 💬 Mensagens */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-2 text-g-word">💬 {t({ en: "Messages", pt: "Mensagens", es: "Mensajes", hi: "संदेश" })}</span>
          {anyConnected && (
            <span className="inline-flex items-center gap-1 text-[10px] font-black text-g-green normal-case"><FaCircleCheck size={10} /> {t({ en: "Gui replies automatically", pt: "A Gui responde automaticamente", es: "Gui responde automáticamente", hi: "Gui अपने-आप जवाब देती है" })}</span>
          )}
        </div>
        {msgs.length === 0 ? (
          <Empty icon={!demo && S.msgsError ? "⚠️" : "💬"} text={!demo && S.msgsError
            ? t({ en: "Couldn't load your messages just now — this is a connection problem, not an empty inbox. Reload in a moment.", pt: "Não consegui carregar suas mensagens agora — isso é falha de conexão, não caixa vazia. Recarregue em instantes.", es: "No pude cargar tus mensajes ahora — es un problema de conexión, no una bandeja vacía. Recarga en un momento.", hi: "अभी आपके संदेश लोड नहीं हो सके — यह कनेक्शन की समस्या है, खाली इनबॉक्स नहीं। थोड़ी देर में फिर लोड करें।" })
            : faltaVincular
            ? t({ en: "No social DMs yet — once your Instagram / Facebook account is linked, every message lands here and Gui replies for you.", pt: "Nenhuma DM ainda — assim que a sua conta do Instagram / Facebook for vinculada, cada mensagem cai aqui e a Gui responde por você.", es: "Aún no hay DMs — en cuanto tu cuenta de Instagram / Facebook esté vinculada, cada mensaje llega aquí y Gui responde por ti.", hi: "अभी कोई DM नहीं — आपका Instagram / Facebook खाता जुड़ते ही हर संदेश यहाँ आएगा और Gui जवाब देगी।" })
            : inert
            ? t({ en: "No social DMs yet — the moment Meta approves the app, every Instagram, Messenger & WhatsApp message lands here and Gui replies for you.", pt: "Nenhuma DM ainda — assim que o Meta aprovar o app, cada mensagem do Instagram, Messenger e WhatsApp cai aqui e a Gui responde por você.", es: "Aún no hay DMs — en cuanto Meta apruebe la app, cada mensaje de Instagram, Messenger y WhatsApp llega aquí y Gui responde por ti.", hi: "अभी कोई DM नहीं — Meta ऐप स्वीकृति मिलते ही हर Instagram, Messenger और WhatsApp संदेश यहाँ आएगा और Gui जवाब देगी।" })
            : anyConnected
              ? t({ en: "No social DMs yet — I'm watching Instagram, Messenger & WhatsApp and I'll reply the moment one arrives.", pt: "Nenhuma DM ainda — estou de olho no Instagram, Messenger e WhatsApp e respondo assim que uma chegar.", es: "Aún no hay DMs — estoy atenta a Instagram, Messenger y WhatsApp y respondo en cuanto llegue una.", hi: "अभी कोई DM नहीं — मैं Instagram, Messenger और WhatsApp देख रही हूँ और आते ही जवाब दूँगी।" })
              : t({ en: "Connect an account above to see and auto-reply to your social DMs here.", pt: "Conecte uma conta acima para ver e responder automaticamente suas DMs aqui.", es: "Conecta una cuenta arriba para ver y responder tus DMs aquí.", hi: "ऊपर एक खाता कनेक्ट करें ताकि आपकी DM यहाँ दिखें और जवाब हों।" })} />
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {msgs.map((m, i) => {
              const net = m.net || netFor(m.channel) || NETS[0];
              return (
                <div key={i} className="flex items-start gap-3 px-5 py-3">
                  <span className="grid place-items-center h-9 w-9 rounded-full shrink-0" style={{ background: net.color + "20", color: net.color }}><net.Icon size={15} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-g-word truncate">{m.name} <span className="text-g-muted font-normal">· {net.label.split(" ")[0]}</span></span>
                      <span className="text-[10px] text-g-muted shrink-0">{m.when}</span>
                    </div>
                    {m.last && <div className="text-[12px] text-g-muted mt-0.5 leading-snug truncate">"{m.last}"</div>}
                    <div className="mt-1 text-[10px] font-bold" style={{ color: m.handled ? "#3E9468" : "#FFC23D" }}>
                      {m.handled
                        ? t({ en: "✓ Gui replied", pt: "✓ a Gui respondeu", es: "✓ Gui respondió", hi: "✓ Gui ने जवाब दिया" })
                        : t({ en: "· you took this over", pt: "· você assumiu esta", es: "· tú tomaste esta", hi: "· आपने यह संभाली" })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* (c) ✍️ Publicar — the A+B */}
      <Card className="border-[#FF8A33]/30 bg-[#FF8A33]/[0.05]">
        <div className="flex items-start gap-3 mb-3">
          <span className="grid place-items-center h-11 w-11 rounded-xl bg-[#FF8A33]/15 text-[#FF8A33] shrink-0"><FaPenToSquare /></span>
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-g-word">✍️ {t({ en: "Publish", pt: "Publicar", es: "Publicar", hi: "प्रकाशित करें" })}</div>
            <div className="text-[11px] text-g-muted leading-snug mt-0.5 max-w-md">{t({ en: "Gui writes the post — you decide how it goes out. Switch anytime.", pt: "A Gui cria o post — você decide como ele sai. Troque quando quiser.", es: "Gui crea la publicación — tú decides cómo sale. Cambia cuando quieras.", hi: "Gui पोस्ट लिखती है — आप तय करें यह कैसे जाए। कभी भी बदलें।" })}</div>
          </div>
        </div>

        {/* A+B segmented toggle */}
        <div className="inline-flex rounded-xl border border-white/10 bg-black/25 p-1 gap-1">
          {[
            ["auto", <FaRobot size={11} key="a" />, t({ en: "Automatic", pt: "Automático", es: "Automático", hi: "स्वतः" })],
            ["approve", <FaCircleCheck size={11} key="b" />, t({ en: "Approve first", pt: "Aprovar antes", es: "Aprobar antes", hi: "पहले मंज़ूरी" })],
          ].map(([m, icon, label]) => (
            <button key={m} onClick={() => setPublishMode(m)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-bold transition ${mode === m ? "bg-[#FF8A33] text-black" : "text-g-muted hover:text-g-word"}`}>
              {icon}{label}
            </button>
          ))}
        </div>
        <div className="mt-2 text-[10.5px] text-g-muted leading-snug">
          {mode === "auto"
            ? t({ en: "Automatic — Gui publishes on the best schedule on its own. You can review anything after the fact.", pt: "Automático — a Gui publica sozinha no melhor horário. Você pode revisar tudo depois.", es: "Automático — Gui publica sola en el mejor horario. Puedes revisar todo después.", hi: "स्वतः — Gui सबसे अच्छे समय पर खुद पोस्ट करती है। आप बाद में सब देख सकते हैं।" })
            : t({ en: "Approve first — every post waits for your ✓ before it ever goes public.", pt: "Aprovar antes — todo post espera seu ✓ antes de ir ao ar.", es: "Aprobar antes — cada publicación espera tu ✓ antes de publicarse.", hi: "पहले मंज़ूरी — हर पोस्ट सार्वजनिक होने से पहले आपके ✓ का इंतज़ार करती है।" })}
        </div>

        {/* Pending drafts — only meaningful in Approve mode; in Auto they publish on their own. */}
        <div className="mt-4">
          <div className="text-[10px] font-black uppercase tracking-wide text-g-muted mb-2">{t({ en: "Drafts waiting for you", pt: "Rascunhos esperando você", es: "Borradores esperándote", hi: "आपके इंतज़ार में ड्राफ़्ट" })}</div>
          {drafts.length === 0 ? (
            <div className="rounded-xl border border-white/[0.07] bg-black/15 px-3 py-4 text-center text-[11px] text-g-muted leading-snug">
              {!demo && S.error
                ? t({ en: "⚠️ Couldn't load your drafts — connection problem, not an empty list. Reload in a moment.", pt: "⚠️ Não consegui carregar seus rascunhos — falha de conexão, não lista vazia. Recarregue em instantes.", es: "⚠️ No pude cargar tus borradores — problema de conexión, no una lista vacía. Recarga en un momento.", hi: "⚠️ ड्राफ़्ट लोड नहीं हो सके — कनेक्शन की समस्या, खाली सूची नहीं। थोड़ी देर में फिर लोड करें।" })
                : !demo && !S.storeReady
                ? t({ en: "⚠️ Post drafting isn't switched on for your account yet — that's why this list is empty. Gui isn't writing posts for you today; our team activates it.", pt: "⚠️ A criação de posts ainda não foi ativada na sua conta — é por isso que esta lista está vazia. A Gui não está escrevendo posts para você hoje; nossa equipe ativa isso.", es: "⚠️ La creación de publicaciones aún no está activada en tu cuenta — por eso esta lista está vacía. Gui no está escribiendo publicaciones hoy; nuestro equipo lo activa.", hi: "⚠️ आपके खाते पर पोस्ट बनाना अभी सक्रिय नहीं — इसीलिए यह सूची खाली है। आज Gui आपके लिए पोस्ट नहीं लिख रही; हमारी टीम इसे चालू करती है।" })
                : faltaVincular
                ? t({ en: "Gui starts drafting posts for you once your Instagram / Facebook account is linked.", pt: "A Gui começa a criar posts para você assim que a sua conta do Instagram / Facebook for vinculada.", es: "Gui empieza a crear publicaciones para ti en cuanto tu cuenta de Instagram / Facebook esté vinculada.", hi: "आपका Instagram / Facebook खाता जुड़ते ही Gui आपके लिए पोस्ट बनाना शुरू कर देगी।" })
                : inert
                ? t({ en: "Gui starts drafting posts for you the moment your Meta account is live.", pt: "A Gui começa a criar posts para você assim que sua conta Meta estiver no ar.", es: "Gui empieza a crear publicaciones para ti en cuanto tu cuenta de Meta esté activa.", hi: "आपका Meta खाता लाइव होते ही Gui आपके लिए पोस्ट बनाना शुरू कर देगी।" })
                : mode === "auto"
                  ? t({ en: "Nothing waiting — in Automatic mode Gui publishes as it creates. Switch to Approve first to review each one.", pt: "Nada esperando — no modo Automático a Gui publica conforme cria. Mude para Aprovar antes para revisar cada um.", es: "Nada esperando — en modo Automático Gui publica al crear. Cambia a Aprobar antes para revisar cada uno.", hi: "कुछ इंतज़ार में नहीं — स्वतः मोड में Gui बनाते ही पोस्ट करती है। हर एक देखने के लिए पहले मंज़ूरी चुनें।" })
                  : t({ en: "No drafts right now — Gui will drop new posts here for your ✓.", pt: "Nenhum rascunho agora — a Gui vai colocar novos posts aqui pro seu ✓.", es: "No hay borradores ahora — Gui pondrá nuevas publicaciones aquí para tu ✓.", hi: "अभी कोई ड्राफ़्ट नहीं — Gui नई पोस्ट यहाँ आपके ✓ के लिए रखेगी।" })}
            </div>
          ) : (
            <div className="space-y-2">
              {drafts.map((d) => {
                const net = netFor(d.net) || NETS.find((n) => n.k === d.net) || NETS[0];
                const isEditing = editing === d.id;
                return (
                  <div key={d.id} className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="grid place-items-center h-6 w-6 rounded-lg shrink-0" style={{ background: net.color + "22", color: net.color }}><net.Icon size={12} /></span>
                      <span className="text-[10px] font-black uppercase tracking-wide text-g-muted">{net.label.split(" ")[0]}</span>
                    </div>
                    {isEditing ? (
                      <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={3}
                        className="w-full rounded-lg bg-white/[0.04] border border-white/10 px-2.5 py-2 text-[12px] text-g-word leading-snug" />
                    ) : (
                      <div className="text-[12px] text-g-light leading-snug">{d.text}</div>
                    )}
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {isEditing ? (
                        <>
                          <button onClick={() => decideDraft(d.id, "approve", editText)} className="btn-bright text-[11px] px-3 py-1.5 inline-flex items-center gap-1"><FaCheck size={10} /> {t({ en: "Save & approve", pt: "Salvar e aprovar", es: "Guardar y aprobar", hi: "सहेजें और मंज़ूर" })}</button>
                          <button onClick={() => setEditing(null)} className="btn-ghost text-[11px] px-3 py-1.5">{t({ en: "Cancel", pt: "Cancelar", es: "Cancelar", hi: "रद्द करें" })}</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => decideDraft(d.id, "approve")} className="btn-bright text-[11px] px-3 py-1.5 inline-flex items-center gap-1"><FaCheck size={10} /> {t({ en: "Approve", pt: "Aprovar", es: "Aprobar", hi: "मंज़ूर" })}</button>
                          <button onClick={() => { setEditing(d.id); setEditText(d.text || ""); }} className="btn-ghost text-[11px] px-3 py-1.5 inline-flex items-center gap-1"><FaPenToSquare size={10} /> {t({ en: "Edit", pt: "Editar", es: "Editar", hi: "संपादित करें" })}</button>
                          <button onClick={() => decideDraft(d.id, "reject")} className="text-[11px] px-3 py-1.5 rounded-lg font-bold text-g-muted hover:text-[#E2533F] inline-flex items-center gap-1"><FaXmark size={11} /> {t({ en: "Decline", pt: "Recusar", es: "Rechazar", hi: "अस्वीकार" })}</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default SocialHub;
