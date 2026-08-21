/* Google tab — the CLIENT's OWN Google presence (not Guileo's). Google Business Profile IS
   local SEO: the profile that shows up on Maps/Search when someone searches "spa perto de mim".
   Reviews answered + frequent posts = what RANKS. Four honest sections:
     (a) 📍 Perfil no Google  — connect / status (OAuth via /api/google-business)
     (b) ⭐ Avaliações        — real reviews (list_reviews) + "a Gui responde automaticamente"
     (c) 📈 SEO local         — the checklist that lifts ranking, with the real state
     (d) 📣 Anúncios no Google — done-for-you request form (/api/google-ads) + pedido status
   HONESTY: the Google Business Profile API needs per-project Google approval (env GOOGLE_BUSINESS_*),
   so real accounts see amber "aguardando aprovação da API do Google" until it's live — we NEVER
   show a fake review or pretend an ad campaign ran. Demo mode = rich per-sector preview.
   Props {V, real, email, dataKey} — same contract as GrowthIntel/RiskRadar. */
import { useState, useEffect } from "react";
import { FaLocationDot, FaStar, FaChartLine, FaBullhorn, FaCircleCheck, FaArrowRotateRight } from "react-icons/fa6";
import { portalApi, toast } from "../lib/portalApi.js";
import { genReviews, Card, Empty, SectionSkeleton, UI_LANG } from "../pages/Portal.jsx";
import { GoogleConnectCard } from "../components/GoogleConnect.jsx";

// ── local 4-language copy (self-contained; keeps dict files untouched) ──
const t = (o) => o[UI_LANG] || o.en;

// Cada resposta traz o próprio veredito (`_ok`): um 401/500 NUNCA pode virar
// "não conectado", que é uma afirmação sobre a conta do cliente que não foi verificada.
async function apiPost(url, body) {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    return { ...(d && typeof d === "object" ? d : {}), _ok: r.ok && d?.ok !== false };
  } catch { return { _ok: false }; }
}

// Chip: connected / pending-API / disconnected — honest signal colors.
function StatusChip({ state }) {
  const map = {
    live: ["#3E9468", t({ en: "Connected · Gui is answering", pt: "Conectado · a Gui responde", es: "Conectado · Gui responde", hi: "कनेक्टेड · Gui जवाब देती है" })],
    pending: ["#FFC23D", t({ en: "Connected · waiting for Google API approval", pt: "Conectado · aguardando aprovação da API do Google", es: "Conectado · esperando aprobación de la API de Google", hi: "कनेक्टेड · Google API स्वीकृति का इंतज़ार" })],
    off: ["#9A8F82", t({ en: "Not connected yet", pt: "Ainda não conectado", es: "Aún no conectado", hi: "अभी कनेक्ट नहीं" })],
    // O terceiro estado. Sem ele, "não consegui perguntar" era exibido como "não conectado" —
    // e um problema nosso virava uma afirmação sobre a conta do cliente.
    unknown: ["#E2533F", t({ en: "Couldn't check right now", pt: "Não deu para verificar agora", es: "No se pudo verificar ahora", hi: "अभी जाँच नहीं हो सकी" })],
  };
  const [c, label] = map[state] || map.off;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-black whitespace-nowrap"
      style={{ color: c, background: `${c}1e`, boxShadow: `inset 0 0 0 1px ${c}40` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c, boxShadow: `0 0 7px ${c}99` }} />{label}
    </span>
  );
}

function GoogleHub({ V, real = null, email = "", dataKey = "" }) {
  const demo = !real;
  // real backend state: null = loading, else { connected, apiReady, reviews:[] }
  const [gb, setGb] = useState(null);
  // Ad request lives in local state (honest: it's the OWNER's intent) + is POSTed to the team.
  const key = `${email || V.label}:google_ads_req`;
  const [adReq, setAdReq] = useState(() => portalApi.loadState(key, null));
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ goal: "calls", budget: "", area: "" });

  useEffect(() => {
    let alive = true;
    if (!real || !email || !dataKey) return;
    (async () => {
      const [st, adSt] = await Promise.all([
        apiPost("/api/google-business", { action: "status", email, token: dataKey }),
        apiPost("/api/google-ads", { action: "status", email, token: dataKey }),
      ]);
      if (!alive) return;
      const statusErr = !st._ok;
      const connected = !statusErr && !!st.connected;
      const apiReady = !statusErr && !!st.ready;
      let reviews = [];
      if (connected && apiReady) {
        const rv = await apiPost("/api/google-business", { action: "list_reviews", email, token: dataKey });
        if (Array.isArray(rv?.reviews)) reviews = rv.reviews;
      }
      if (!alive) return;
      setGb({ connected, apiReady, reviews, statusErr });
      // Hydrate the real ad request (if the team already has one on file) — honest server truth.
      const rows = Array.isArray(adSt?.requests) ? adSt.requests : [];
      if (rows.length) {
        const r = rows[0];
        setAdReq({ goal: r.goal || "", budget: r.budget_cents ? `$${Math.round(r.budget_cents / 100)}` : "", area: r.area || "", status: r.status || "requested", at: Date.parse(r.created_at) || Date.now() });
      }
    })();
    return () => { alive = false; };
  }, [real, email, dataKey]);

  /* ── O PEDIDO DE ANÚNCIOS ───────────────────────────────────────────────────
     O DEFEITO (corrigido 2026-08-11): o pedido era marcado como `status:"requested"`
     e gravado ANTES do POST. Se o POST falhasse, o toast dizia "Salvo — vamos reenviar
     em instantes" — e NÃO EXISTE reenvio nenhum: o registro morava no localStorage do
     navegador e nunca mais era tentado. Pior: com `adReq` preenchido, o cartão passava a
     exibir em verde "Pedido recebido — a equipe Guileo está cuidando" e o botão "Quero
     anúncios" sumia PARA SEMPRE. O cliente que quer gastar dinheiro conosco acreditava
     ter pedido, a equipe nunca soube, e ele não tinha como tentar de novo.
     Agora o estado tem três valores: enviado ao servidor · não enviado (com botão de
     tentar de novo) · demonstração. */
  const submitAd = async () => {
    if (!(real && email && dataKey)) {
      setAdReq({ ...form, at: Date.now(), status: "demo" }); setShowForm(false);
      toast(t({ en: "Sample screen — this request wasn't sent. Connect your account to reach the team.", pt: "Tela de exemplo — este pedido não foi enviado. Conecte sua conta para falar com a equipe.", es: "Pantalla de ejemplo — esta solicitud no se envió. Conecta tu cuenta para llegar al equipo.", hi: "नमूना स्क्रीन — यह अनुरोध नहीं भेजा गया। टीम तक पहुँचने के लिए खाता कनेक्ट करें।" }));
      return;
    }
    setShowForm(false);
    const d = await apiPost("/api/google-ads", { action: "request", email, token: dataKey, ...form });
    if (d._ok) {
      const rec = { ...form, at: Date.now(), status: "requested" };
      setAdReq(rec); portalApi.saveState(key, rec);
      toast(t({ en: "Request sent ✓ — the Guileo team takes it from here.", pt: "Pedido enviado ✓ — a equipe Guileo assume daqui.", es: "Solicitud enviada ✓ — el equipo Guileo se encarga.", hi: "अनुरोध भेजा ✓ — Guileo टीम संभालेगी।" }));
    } else {
      // NÃO grava como "recebido". Guarda o rascunho para o cliente não redigitar e mostra
      // exatamente o que aconteceu, com um caminho de volta.
      setAdReq({ ...form, at: Date.now(), status: "unsent" });
      toast(t({ en: "It didn't reach us — nothing was requested. Tap “Try again”.", pt: "Não chegou até nós — nenhum pedido foi feito. Toque em “Tentar de novo”.", es: "No nos llegó — no se hizo ninguna solicitud. Toca “Intentar de nuevo”.", hi: "यह हम तक नहीं पहुँचा — कोई अनुरोध दर्ज नहीं हुआ। “फिर आज़माएँ” दबाएँ।" }));
    }
  };

  // ── real mode, still loading → skeleton (never a false empty state) ──
  if (real && gb === null) return <SectionSkeleton rows={6} />;

  const connected = demo ? true : gb.connected;
  const apiReady = demo ? true : gb.apiReady;
  const unverified = !demo && !!gb.statusErr;
  const state = unverified ? "unknown" : connected ? (apiReady ? "live" : "pending") : "off";
  const bizName = t({ en: "Your business", pt: "Seu negócio", es: "Tu negocio", hi: "आपका व्यवसाय" });

  // Reviews: demo = rich per-sector sample; real = only what the API returned (honest empty otherwise).
  const demoReviews = genReviews(V).slice(0, 5);
  const reviews = demo ? demoReviews.map((r) => ({ name: r.name, stars: r.stars, text: r.text, replied: r.stars >= 4 })) : (gb.reviews || []);

  // SEO checklist — the three levers that actually rank a local profile.
  // TRÊS ESTADOS por item: feito · não feito · NÃO DEU PARA VERIFICAR. "Posts novos toda
  // semana" nunca teve fonte de dado — em modo real ficava eternamente com ○, dizendo ao
  // cliente que ele não posta quando a verdade é que a plataforma não consegue olhar.
  const seo = [
    { k: "profile", label: t({ en: "Complete profile (hours, photos, services)", pt: "Perfil completo (horário, fotos, serviços)", es: "Perfil completo (horario, fotos, servicios)", hi: "पूरी प्रोफ़ाइल (समय, फ़ोटो, सेवाएँ)" }), done: connected, unknown: unverified, weight: t({ en: "Foundation", pt: "Base", es: "Base", hi: "आधार" }) },
    { k: "reviews", label: t({ en: "Reviews answered (Gui replies for you)", pt: "Avaliações respondidas (a Gui responde por você)", es: "Reseñas respondidas (Gui responde por ti)", hi: "समीक्षाओं के जवाब (Gui देती है)" }), done: connected && apiReady, unknown: unverified, weight: t({ en: "Biggest lever", pt: "Maior alavanca", es: "Mayor palanca", hi: "सबसे बड़ा" }) },
    { k: "posts", label: t({ en: "Fresh posts every week", pt: "Posts novos toda semana", es: "Publicaciones nuevas cada semana", hi: "हर हफ़्ते नई पोस्ट" }), done: demo, unknown: !demo, weight: t({ en: "Keeps you visible", pt: "Mantém você visível", es: "Te mantiene visible", hi: "दृश्यता बनाए रखे" }) },
  ];
  const seoKnown = seo.filter((s) => !s.unknown);
  const seoDone = seoKnown.filter((s) => s.done).length;

  return (
    <div className="space-y-4 stagger">
      {/* Header */}
      <div className="rounded-2xl border border-[#4285F4]/25 bg-gradient-to-br from-[#4285F4]/[0.08] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider" style={{ color: "#4285F4" }}>
          <FaLocationDot size={11} /> {t({ en: "Your Google presence", pt: "Sua presença no Google", es: "Tu presencia en Google", hi: "Google पर आपकी मौजूदगी" })}
          {real
            ? <span className="inline-flex items-center gap-1 text-g-green normal-case font-black text-[9px]"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />{t({ en: "LIVE — your account", pt: "AO VIVO — sua conta", es: "EN VIVO — tu cuenta", hi: "लाइव — आपका खाता" })}</span>
            : <span className="text-g-muted normal-case font-bold text-[9px] border border-white/10 rounded-full px-1.5 py-px">{t({ en: "preview", pt: "prévia", es: "vista previa", hi: "पूर्वावलोकन" })}</span>}
        </div>
        <div className="mt-1 text-xl font-black text-g-word">{t({ en: "This is where your customers find you on the Map.", pt: "É aqui que seus clientes te acham no Maps.", es: "Aquí es donde tus clientes te encuentran en el Mapa.", hi: "यहीं आपके ग्राहक आपको Map पर पाते हैं।" })}</div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">{t({ en: "Your Google Business Profile is your local SEO — answered reviews and frequent posts are what rank you when someone searches nearby.", pt: "Seu Perfil do Google é o seu SEO local — avaliações respondidas e posts frequentes são o que te ranqueiam quando alguém busca por perto.", es: "Tu Perfil de Google es tu SEO local — reseñas respondidas y publicaciones frecuentes son lo que te posicionan.", hi: "आपकी Google प्रोफ़ाइल आपका लोकल SEO है — जवाब दी गई समीक्षाएँ और नियमित पोस्ट आपको रैंक कराती हैं।" })}</p>
      </div>

      {demo && (
        <div className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-2.5 text-[11px] font-bold text-g-gold">
          {t({ en: "Sample preview — connect your account to manage your real Google profile.", pt: "Prévia de exemplo — conecte sua conta para gerir seu Perfil do Google real.", es: "Vista previa — conecta tu cuenta para gestionar tu Perfil de Google real.", hi: "नमूना पूर्वावलोकन — असली प्रोफ़ाइल के लिए खाता कनेक्ट करें।" })}
        </div>
      )}

      {/* A verificação não respondeu. Isso é problema NOSSO — e é dito assim, em vez de
          virar "você não conectou seu Google", que seria uma acusação sem prova. */}
      {unverified && (
        <div className="rounded-xl2 px-4 py-3 text-[11.5px] leading-snug" style={{ color: "#E2533F", background: "#E2533F12", border: "1px solid #E2533F40" }}>
          <span className="font-black">{t({ en: "Couldn't check your Google connection.", pt: "Não consegui verificar sua conexão com o Google.", es: "No pude verificar tu conexión con Google.", hi: "आपका Google कनेक्शन जाँच नहीं सका।" })}</span>{" "}
          {t({ en: "This is a connection problem on our side — nothing below states anything about your account. Reload in a moment.", pt: "Isso é falha de conexão do nosso lado — nada abaixo afirma nada sobre sua conta. Recarregue em instantes.", es: "Es un problema de conexión de nuestro lado — nada de abajo afirma nada sobre tu cuenta. Recarga en un momento.", hi: "यह हमारी ओर की समस्या है — नीचे कुछ भी आपके खाते के बारे में दावा नहीं करता। थोड़ी देर में फिर लोड करें।" })}
        </div>
      )}

      {/* LOGIN ÚNICO DO GOOGLE — o MESMO consentimento que liga a agenda liga as avaliações
          (escopos calendar.events + business.manage no mesmo client OAuth). Antes havia aqui um
          botão "Conectar meu Google" que só relia o status e avisava que a equipe terminaria a
          conexão à mão; agora a conexão acontece de verdade e o estado é lido do servidor. */}
      <GoogleConnectCard lang={UI_LANG} email={email} dataKey={dataKey} focus="reviews" />

      {/* (a) 📍 Perfil no Google */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="grid place-items-center h-11 w-11 rounded-xl bg-[#4285F4]/15 text-[#4285F4] shrink-0"><FaLocationDot /></span>
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-g-word flex items-center gap-2">📍 {t({ en: "Google profile", pt: "Perfil no Google", es: "Perfil de Google", hi: "Google प्रोफ़ाइल" })}</div>
              <div className="text-[11px] text-g-muted leading-snug mt-0.5 max-w-md">{t({ en: "This is where your customers find you on the Map. Link it once and Gui keeps it working for you.", pt: "É aqui que seus clientes te acham no Maps. Conecte uma vez e a Gui mantém funcionando pra você.", es: "Aquí te encuentran en el Mapa. Conéctalo una vez y Gui lo mantiene funcionando.", hi: "यहीं ग्राहक आपको Map पर पाते हैं। एक बार जोड़ें, Gui संभालती है।" })}</div>
              <div className="mt-2"><StatusChip state={state} /></div>
            </div>
          </div>
        </div>
        {connected && !apiReady && (
          <div className="mt-3 rounded-xl border border-g-gold/25 bg-g-gold/[0.06] px-3 py-2 text-[11px] text-g-gold leading-snug">
            {t({ en: "Your profile is linked. Reading & replying to reviews switches on automatically the moment Google approves the API — nothing more for you to do.", pt: "Seu perfil está conectado. Ler e responder avaliações liga automaticamente assim que o Google aprovar a API — nada mais pra você fazer.", es: "Tu perfil está conectado. Leer y responder reseñas se activa automáticamente cuando Google apruebe la API.", hi: "आपकी प्रोफ़ाइल जुड़ गई है। Google API स्वीकृति मिलते ही समीक्षाएँ पढ़ना/जवाब देना अपने-आप चालू।" })}
          </div>
        )}
      </Card>

      {/* (b) ⭐ Avaliações */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-2.5 border-b border-white/10 flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-2" style={{ color: "#FFC23D" }}><FaStar size={11} /> {t({ en: "Reviews", pt: "Avaliações", es: "Reseñas", hi: "समीक्षाएँ" })}</span>
          {connected && (
            <span className="inline-flex items-center gap-1 text-[10px] font-black text-g-green normal-case"><FaCircleCheck size={10} /> {t({ en: "Gui replies automatically for you", pt: "A Gui responde automaticamente pra você", es: "Gui responde automáticamente por ti", hi: "Gui आपके लिए अपने-आप जवाब देती है" })}</span>
          )}
        </div>
        {reviews.length === 0 ? (
          <Empty icon="⭐" text={connected
            ? t({ en: "No reviews synced yet — they'll appear here the moment the Google API is live, and Gui will reply for you.", pt: "Nenhuma avaliação sincronizada ainda — elas aparecem aqui assim que a API do Google ligar, e a Gui responde por você.", es: "Aún no hay reseñas — aparecerán aquí cuando la API de Google esté activa y Gui responderá por ti.", hi: "अभी कोई समीक्षा नहीं — API लाइव होते ही यहाँ दिखेंगी और Gui जवाब देगी।" })
            : t({ en: "Connect your Google profile above to see and auto-reply to your reviews.", pt: "Conecte seu Perfil do Google acima para ver e responder automaticamente suas avaliações.", es: "Conecta tu Perfil de Google arriba para ver y responder tus reseñas.", hi: "ऊपर अपनी Google प्रोफ़ाइल कनेक्ट करें।" })} />
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {reviews.map((r, i) => (
              <div key={i} className="px-5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-g-word truncate">{r.name || bizName}</span>
                  <span className="text-xs text-g-gold shrink-0">{"★".repeat(r.stars || 0)}<span className="text-g-muted">{"★".repeat(5 - (r.stars || 0))}</span></span>
                </div>
                {r.text && <div className="text-[12px] text-g-muted mt-0.5 leading-snug">"{r.text}"</div>}
                <div className="mt-1 text-[10px] font-bold" style={{ color: r.replied ? "#3E9468" : "#9A8F82" }}>
                  {r.replied
                    ? t({ en: "✓ Gui replied", pt: "✓ a Gui respondeu", es: "✓ Gui respondió", hi: "✓ Gui ने जवाब दिया" })
                    : t({ en: "· awaiting reply", pt: "· aguardando resposta", es: "· esperando respuesta", hi: "· जवाब बाकी" })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* (c) 📈 SEO local */}
      <Card>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-wide flex items-center gap-2" style={{ color: "#3E9468" }}><FaChartLine size={11} /> {t({ en: "Local SEO", pt: "SEO local", es: "SEO local", hi: "लोकल SEO" })}</span>
          <span className="text-[11px] font-black num text-g-muted">{seoDone}/{seoKnown.length}</span>
        </div>
        <p className="text-[11px] text-g-muted mb-3 leading-snug">{t({ en: "What lifts you in \"near me\" searches:", pt: "O que te faz subir nas buscas \"perto de mim\":", es: "Lo que te sube en búsquedas \"cerca de mí\":", hi: "\"मेरे पास\" खोज में ऊपर आने के लिए:" })}</p>
        <div className="space-y-2">
          {seo.map((s) => (
            <div key={s.k} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-black/15 px-3 py-2.5">
              <span className="grid place-items-center h-6 w-6 rounded-full shrink-0 text-[11px]"
                style={s.unknown ? { background: "#C8A24A1F", color: "#C8A24A" } : { background: s.done ? "#3E946822" : "#9A8F8218", color: s.done ? "#3E9468" : "#9A8F82" }}>
                {s.unknown ? "?" : s.done ? "✓" : "○"}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-bold ${s.done && !s.unknown ? "text-g-word" : "text-g-light"}`}>{s.label}</div>
                {s.unknown && <div className="text-[10px] mt-0.5" style={{ color: "#C8A24A" }}>{t({ en: "we can't check this one yet — not counted either way", pt: "ainda não conseguimos verificar este — não conta nem a favor nem contra", es: "aún no podemos verificar este — no cuenta en ningún sentido", hi: "इसे अभी जाँच नहीं सकते — किसी भी ओर नहीं गिना गया" })}</div>}
              </div>
              <span className="text-[9px] font-black uppercase tracking-wide text-g-muted shrink-0">{s.weight}</span>
            </div>
          ))}
        </div>
        {!connected && (
          <div className="mt-3 text-[11px] text-g-muted leading-snug">{t({ en: "Connect your profile to track this against your real Google data.", pt: "Conecte seu perfil para acompanhar isso com seus dados reais do Google.", es: "Conecta tu perfil para seguir esto con tus datos reales de Google.", hi: "असली Google डेटा से ट्रैक करने के लिए प्रोफ़ाइल कनेक्ट करें।" })}</div>
        )}
      </Card>

      {/* (d) 📣 Anúncios no Google */}
      <Card className="border-[#FF8A33]/30 bg-[#FF8A33]/[0.05]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="grid place-items-center h-11 w-11 rounded-xl bg-[#FF8A33]/15 text-[#FF8A33] shrink-0"><FaBullhorn /></span>
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-g-word">📣 {t({ en: "Google Ads", pt: "Anúncios no Google", es: "Anuncios en Google", hi: "Google विज्ञापन" })}</div>
              <div className="text-[11px] text-g-muted leading-snug mt-0.5 max-w-md">{t({ en: "Show up at the top when someone searches for your service nearby. Done-for-you — managed by the Guileo team, no dashboards to learn.", pt: "Apareça no topo quando alguém buscar seu serviço por perto. Feito pra você — gestão pela equipe Guileo, sem painel pra aprender.", es: "Aparece arriba cuando buscan tu servicio cerca. Hecho por ti — gestión del equipo Guileo, sin paneles.", hi: "जब कोई पास में आपकी सेवा खोजे, ऊपर दिखें। पूरी तरह किया-कराया — Guileo टीम द्वारा प्रबंधित।" })}</div>
            </div>
          </div>
          {(!adReq || adReq.status === "unsent") && !showForm && (
            <button onClick={() => { setForm({ goal: adReq?.goal || "calls", budget: adReq?.budget || "", area: adReq?.area || "" }); setShowForm(true); }} className="btn-bright text-sm shrink-0">
              {adReq?.status === "unsent"
                ? t({ en: "Try again", pt: "Tentar de novo", es: "Intentar de nuevo", hi: "फिर आज़माएँ" })
                : t({ en: "I want ads", pt: "Quero anúncios", es: "Quiero anuncios", hi: "मुझे विज्ञापन चाहिए" })}
            </button>
          )}
        </div>

        {/* Pedido que NÃO chegou não pode aparecer em verde como "recebido". */}
        {adReq?.status === "unsent" && (
          <div className="mt-3 rounded-xl px-3 py-2.5 text-[11.5px] leading-snug" style={{ color: "#E2533F", background: "#E2533F12", border: "1px solid #E2533F40" }}>
            <span className="font-black">{t({ en: "Not sent.", pt: "Não enviado.", es: "No enviado.", hi: "नहीं भेजा गया।" })}</span>{" "}
            {t({ en: "Your answers are kept here so you don't retype them, but the team has NOT received this request. Tap “Try again”.", pt: "Suas respostas ficaram salvas aqui para você não redigitar, mas a equipe NÃO recebeu este pedido. Toque em “Tentar de novo”.", es: "Tus respuestas quedaron guardadas aquí, pero el equipo NO recibió esta solicitud. Toca “Intentar de nuevo”.", hi: "आपके उत्तर यहाँ सहेजे हैं, पर टीम को यह अनुरोध नहीं मिला। “फिर आज़माएँ” दबाएँ।" })}
          </div>
        )}

        {adReq?.status === "demo" && (
          <div className="mt-3 rounded-xl px-3 py-2.5 text-[11.5px] leading-snug" style={{ color: "#C8A24A", background: "#C8A24A12", border: "1px solid #C8A24A40" }}>
            {t({ en: "Sample screen — this request wasn't sent to anyone.", pt: "Tela de exemplo — este pedido não foi enviado a ninguém.", es: "Pantalla de ejemplo — esta solicitud no se envió a nadie.", hi: "नमूना स्क्रीन — यह अनुरोध किसी को नहीं भेजा गया।" })}
          </div>
        )}

        {adReq?.status === "requested" && (
          <div className="mt-3 rounded-xl border border-g-green/25 bg-g-green/[0.06] px-3 py-2.5">
            <div className="flex items-center gap-2 text-[11px] font-black text-g-green"><FaArrowRotateRight size={10} /> {t({ en: "Request received — the Guileo team is on it", pt: "Pedido recebido — a equipe Guileo está cuidando", es: "Solicitud recibida — el equipo Guileo se encarga", hi: "अनुरोध मिला — Guileo टीम काम पर है" })}</div>
            <div className="mt-1 text-[10.5px] text-g-muted leading-snug">
              {t({ en: "Goal", pt: "Objetivo", es: "Objetivo", hi: "लक्ष्य" })}: <span className="text-g-light font-semibold">{adReq.goal}</span>
              {adReq.budget ? <> · {t({ en: "budget", pt: "orçamento", es: "presupuesto", hi: "बजट" })}: <span className="text-g-light font-semibold">{adReq.budget}</span></> : null}
              {adReq.area ? <> · {adReq.area}</> : null}
            </div>
            <div className="mt-1.5 text-[10px] text-g-muted">{t({ en: "We'll reach out to confirm the plan before anything goes live — you approve the spend.", pt: "Vamos falar com você pra confirmar o plano antes de qualquer coisa ir ao ar — você aprova o investimento.", es: "Te contactaremos para confirmar el plan antes de publicar — tú apruebas la inversión.", hi: "लाइव करने से पहले हम योजना की पुष्टि करेंगे — खर्च आप मंज़ूर करते हैं।" })}</div>
          </div>
        )}

        {showForm && adReq?.status !== "requested" && (
          <div className="mt-3 space-y-2.5 rounded-xl border border-white/10 bg-black/20 p-3">
            <label className="block text-[10px] font-black uppercase tracking-wide text-g-muted">{t({ en: "What do you want more of?", pt: "Você quer mais o quê?", es: "¿Qué quieres más?", hi: "आपको क्या ज़्यादा चाहिए?" })}
              <select value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} className="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/10 px-2.5 py-2 text-sm text-g-word">
                <option value="calls">{t({ en: "Phone calls", pt: "Ligações", es: "Llamadas", hi: "कॉल" })}</option>
                <option value="bookings">{t({ en: "Bookings", pt: "Agendamentos", es: "Reservas", hi: "बुकिंग" })}</option>
                <option value="visits">{t({ en: "Store visits", pt: "Visitas à loja", es: "Visitas", hi: "विज़िट" })}</option>
              </select>
            </label>
            <label className="block text-[10px] font-black uppercase tracking-wide text-g-muted">{t({ en: "Monthly budget (optional)", pt: "Orçamento mensal (opcional)", es: "Presupuesto mensual (opcional)", hi: "मासिक बजट (वैकल्पिक)" })}
              <input value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="$500" className="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/10 px-2.5 py-2 text-sm text-g-word placeholder:text-g-muted" />
            </label>
            <label className="block text-[10px] font-black uppercase tracking-wide text-g-muted">{t({ en: "Area you serve (optional)", pt: "Região que você atende (opcional)", es: "Zona que atiendes (opcional)", hi: "सेवा क्षेत्र (वैकल्पिक)" })}
              <input value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder={t({ en: "e.g. Miami Beach + 10mi", pt: "ex.: Miami Beach + 16km", es: "ej.: Miami Beach + 16km", hi: "जैसे Miami Beach + 16km" })} className="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/10 px-2.5 py-2 text-sm text-g-word placeholder:text-g-muted" />
            </label>
            <div className="flex items-center gap-2 pt-1">
              <button onClick={submitAd} className="btn-bright text-sm">{t({ en: "Send request", pt: "Enviar pedido", es: "Enviar solicitud", hi: "अनुरोध भेजें" })}</button>
              <button onClick={() => setShowForm(false)} className="btn-ghost text-sm">{t({ en: "Cancel", pt: "Cancelar", es: "Cancelar", hi: "रद्द करें" })}</button>
            </div>
            <div className="text-[10px] text-g-muted leading-snug">{t({ en: "No charge now — this just starts the conversation. The Guileo team builds, runs and reports on the campaign for you.", pt: "Sem cobrança agora — isto só inicia a conversa. A equipe Guileo cria, roda e reporta a campanha pra você.", es: "Sin cargo ahora — solo inicia la conversación. El equipo Guileo crea, gestiona e informa la campaña.", hi: "अभी कोई शुल्क नहीं — यह बस बातचीत शुरू करता है। Guileo टीम कैंपेन चलाती और रिपोर्ट करती है।" })}</div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default GoogleHub;
