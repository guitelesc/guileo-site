import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PITCH_NICHES, PITCH_CARDS } from "../data/cartasDePitch.js";

// ── Pitch Cards (Library + AI) ───────────────────────────────────────────────
// Lives here (was inline in Vendedor.jsx) so the Pitch tab can mount it next to
// the pocket card and the slides. Same behaviour, same words, own dictionary.
//
// LANGUAGE: cartasDePitch.js has pt/en/es only. For `hi` the WHOLE section falls
// back to English — chrome AND card body — so the seller never reads a screen
// with half Hindi headings over English content (and the AI is asked in the
// same language the screen is showing).

const CARD_LANGS = ["pt", "en", "es"];

const D = {
  pt: {
    cardsTitle: "Biblioteca de Pitch Cards",
    cardsSub: "Escolha o nicho do cliente. Cada card segue o arco dor → solução → ganho → concorrência. Personalize com IA pro cliente exato.",
    kitLink: "📄 Kit de campo (imprimir)",
    fPain: "A dor que ele sente", fLeak: "O que tá vazando", fSolution: "A solução (o ganho dele)", fGain: "O que ele ganha",
    fEdge: "Como passa a concorrência", fOpener: "Como abrir (sem ser agressivo)", fDiscovery: "Perguntas que fazem ele perceber", fObjection: "Se ele resistir",
    aiTitle: "Personalizar com IA", aiSub: "Diga o nome/cidade do cliente e o que você sabe — a IA escreve o pitch sob medida.",
    aiBiz: "Nome do negócio", aiCity: "Cidade", aiNotes: "O que você sabe dele (opcional)", aiGo: "Gerar pitch", aiGoing: "Escrevendo…",
    aiErr: "Não consegui agora. Tenta de novo.", copy: "Copiar", copied: "Copiado ✓",
    objTitle: "Quebra-objeção com IA", objSub: "Digite o que o cliente falou — a IA te dá a resposta calma, sem ser agressivo.",
    objPh: "Ex: \"tá caro\", \"já tenho recepcionista\", \"vou pensar\"…", objGo: "Me ajuda", objGoing: "Pensando…",
    expired: "Sua sessão expirou — entre de novo pra usar a IA.",
  },
  en: {
    cardsTitle: "Pitch Card Library",
    cardsSub: "Pick the client's niche. Each card follows pain → solution → gain → competition. Personalize with AI for the exact client.",
    kitLink: "📄 Field kit (print)",
    fPain: "The pain they feel", fLeak: "What's leaking", fSolution: "The solution (their gain)", fGain: "What they gain",
    fEdge: "How they beat the competition", fOpener: "How to open (non-aggressive)", fDiscovery: "Questions that make them realize", fObjection: "If they resist",
    aiTitle: "Personalize with AI", aiSub: "Give the client's name/city and what you know — AI writes a tailored pitch.",
    aiBiz: "Business name", aiCity: "City", aiNotes: "What you know about them (optional)", aiGo: "Generate pitch", aiGoing: "Writing…",
    aiErr: "Couldn't right now. Try again.", copy: "Copy", copied: "Copied ✓",
    objTitle: "AI objection-buster", objSub: "Type what the client said — AI gives you the calm, non-aggressive reply.",
    objPh: "e.g. \"too expensive\", \"I have a receptionist\", \"I'll think about it\"…", objGo: "Help me", objGoing: "Thinking…",
    expired: "Your session expired — sign in again to use the AI.",
  },
  es: {
    cardsTitle: "Biblioteca de Pitch Cards",
    cardsSub: "Elige el nicho del cliente. Cada card sigue dolor → solución → ganancia → competencia. Personaliza con IA para el cliente exacto.",
    kitLink: "📄 Kit de campo (imprimir)",
    fPain: "El dolor que siente", fLeak: "Lo que se está fugando", fSolution: "La solución (su ganancia)", fGain: "Lo que gana",
    fEdge: "Cómo supera a la competencia", fOpener: "Cómo abrir (sin ser agresivo)", fDiscovery: "Preguntas que se lo hacen ver", fObjection: "Si se resiste",
    aiTitle: "Personalizar con IA", aiSub: "Da el nombre/ciudad del cliente y lo que sabes — la IA escribe un pitch a medida.",
    aiBiz: "Nombre del negocio", aiCity: "Ciudad", aiNotes: "Lo que sabes de él (opcional)", aiGo: "Generar pitch", aiGoing: "Escribiendo…",
    aiErr: "No pude ahora. Intenta de nuevo.", copy: "Copiar", copied: "Copiado ✓",
    objTitle: "Rompe-objeciones con IA", objSub: "Escribe lo que dijo el cliente — la IA te da la respuesta calmada, sin ser agresivo.",
    objPh: "Ej: \"está caro\", \"ya tengo recepcionista\", \"lo pensaré\"…", objGo: "Ayúdame", objGoing: "Pensando…",
    expired: "Tu sesión expiró — entra de nuevo para usar la IA.",
  },
};

// Fire-and-forget activity log (same endpoint the hub uses). Never breaks the UI.
function logEvent(seller, kind) {
  if (!seller?.email) return;
  try {
    fetch("/api/seller-stats", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "log", kind, email: seller.email, seller: { name: seller.name, ref: seller.ref, code: seller.code || "" } }),
    }).catch(() => {});
  } catch { /* analytics must never break the hub */ }
}

// Session minted before the seller badge existed → the AI answers 401 and the
// button looks broken. Clear it once so the seller just logs in again.
function sidExpired(d) {
  if (!d || d.error !== "auth_required") return false;
  try { localStorage.removeItem("guileo_seller"); } catch { /* ignore */ }
  return true;
}

export default function SellerPitchCards({ lang = "pt", seller, sid = "" }) {
  // No hi data in cartasDePitch.js → the whole section speaks English instead of mixing.
  const L = CARD_LANGS.includes(lang) ? lang : "en";
  const t = D[L] || D.en;

  const [niche, setNiche] = useState(PITCH_NICHES[0].id);
  const card = PITCH_CARDS[niche] || {};
  const pick = (o) => (o ? (o[L] || o.en || "") : "");

  const [biz, setBiz] = useState(""); const [city, setCity] = useState(""); const [notes, setNotes] = useState("");
  const [aiState, setAiState] = useState("idle"); const [aiText, setAiText] = useState(""); const [copied, setCopied] = useState(false);
  const [obj, setObj] = useState(""); const [objState, setObjState] = useState("idle"); const [objText, setObjText] = useState(""); const [objCopied, setObjCopied] = useState(false);

  const nicheName = useMemo(() => {
    const n = PITCH_NICHES.find((x) => x.id === niche) || {};
    return (n.name && (n.name[L] || n.name.en)) || "";
  }, [niche, L]);

  const runObj = async () => {
    if (!obj.trim()) return;
    setObjState("go"); setObjText("");
    try {
      const r = await fetch("/api/pitch-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sid, mode: "objection", objection: obj, niche: nicheName, lang: L }) });
      const d = await r.json().catch(() => ({}));
      if (sidExpired(d)) { setObjText(t.expired); setObjState("err"); }
      else if (d?.ok && d.text) { setObjText(d.text); setObjState("done"); if (seller) logEvent(seller, "pitch"); }
      else { setObjState("err"); }
    } catch { setObjState("err"); }
  };

  const runAi = async () => {
    setAiState("go"); setAiText("");
    try {
      const r = await fetch("/api/pitch-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sid, niche: nicheName, business: biz, city, notes, lang: L }) });
      const d = await r.json().catch(() => ({}));
      if (sidExpired(d)) { setAiText(t.expired); setAiState("err"); }
      else if (d?.ok && d.text) { setAiText(d.text); setAiState("done"); if (seller) logEvent(seller, "pitch"); }
      else { setAiState("err"); }
    } catch { setAiState("err"); }
  };

  const Block = ({ label, children, tone = "word" }) => (
    <div className="card p-4">
      <div className={`text-[10.5px] font-black uppercase tracking-wider ${tone === "gold" ? "text-g-gold" : tone === "green" ? "text-g-green" : "text-g-muted"}`}>{label}</div>
      <div className="mt-1.5 text-[13.5px] leading-relaxed text-g-word">{children}</div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black text-g-word">{t.cardsTitle}</h2>
        <p className="text-[13px] text-g-muted mt-1 max-w-2xl">{t.cardsSub}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PITCH_NICHES.map((n) => (
          <button key={n.id} onClick={() => { setNiche(n.id); setAiText(""); setAiState("idle"); }}
            className={`min-h-[44px] rounded-full px-3.5 py-2 text-[12.5px] font-bold transition ${niche === n.id ? "bg-g-green/15 text-g-word ring-1 ring-g-green/40" : "bg-white/[0.04] text-g-muted ring-1 ring-white/10 hover:text-g-word"}`}>
            <span className="mr-1">{n.emoji}</span>{(n.name && (n.name[L] || n.name.en)) || ""}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <a href={`/kit/${niche}`} target="_blank" rel="noopener" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-g-gold/35 bg-g-gold/[0.08] px-3.5 py-1.5 text-[12px] font-bold text-g-gold hover:bg-g-gold/[0.16]">{t.kitLink}</a>
      </div>

      <motion.div key={niche} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="grid gap-3 md:grid-cols-2">
        <Block label={t.fPain} tone="gold">{pick(card.pain)}</Block>
        <Block label={t.fLeak}>{pick(card.leak)}</Block>
        <Block label={t.fSolution} tone="green">{pick(card.solution)}</Block>
        <Block label={t.fGain} tone="green">
          <ul className="space-y-1">{(card.gain || []).map((g, i) => <li key={i} className="flex gap-2"><span className="text-g-green">✓</span>{pick(g)}</li>)}</ul>
        </Block>
        <Block label={t.fEdge} tone="gold">{pick(card.edge)}</Block>
        <Block label={t.fOpener}>“{pick(card.opener)}”</Block>
        <Block label={t.fDiscovery}>
          <ul className="space-y-1">{(card.discovery || []).map((q, i) => <li key={i} className="flex gap-2"><span className="text-g-gold">{i + 1}.</span>{pick(q)}</li>)}</ul>
        </Block>
        <Block label={t.fObjection}>
          <div className="font-bold text-g-word">“{pick(card.objection?.q)}”</div>
          <div className="mt-1 text-g-ink">→ {pick(card.objection?.a)}</div>
        </Block>
      </motion.div>

      {/* AI personalization */}
      <div className="rounded-2xl border border-g-gold/25 bg-g-gold/[0.05] p-5">
        <div className="text-sm font-extrabold text-g-gold">✨ {t.aiTitle}</div>
        <p className="text-[12.5px] text-g-muted mt-1">{t.aiSub}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input value={biz} onChange={(e) => setBiz(e.target.value)} placeholder={t.aiBiz} aria-label={t.aiBiz} className="min-h-[44px] rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-[13px] text-g-word placeholder:text-g-muted/60 focus:outline-none focus:border-g-gold/50" />
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t.aiCity} aria-label={t.aiCity} className="min-h-[44px] rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-[13px] text-g-word placeholder:text-g-muted/60 focus:outline-none focus:border-g-gold/50" />
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.aiNotes} aria-label={t.aiNotes} className="min-h-[44px] rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-[13px] text-g-word placeholder:text-g-muted/60 focus:outline-none focus:border-g-gold/50" />
        </div>
        <button onClick={runAi} disabled={aiState === "go"} className="btn-gold ai-cta text-[13px] mt-3 min-h-[44px]">✨ {aiState === "go" ? t.aiGoing : t.aiGo}</button>
        {aiState === "err" && <div className="text-[12px] text-g-gold mt-2">{aiText || t.aiErr}</div>}
        {aiState === "done" && aiText && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl border border-white/10 bg-[#0d0c0a]/40 p-4">
            <pre className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-g-word font-sans">{aiText}</pre>
            <button onClick={() => { navigator.clipboard?.writeText(aiText); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="btn-ghost text-[12px] mt-3 min-h-[44px]">{copied ? t.copied : t.copy}</button>
          </motion.div>
        )}
      </div>

      {/* Objection-buster */}
      <div className="rounded-2xl border border-g-green/25 bg-g-green/[0.05] p-5">
        <div className="text-sm font-extrabold text-g-green">🛡️ {t.objTitle}</div>
        <p className="text-[12.5px] text-g-muted mt-1">{t.objSub}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input value={obj} onChange={(e) => setObj(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runObj(); }} placeholder={t.objPh} aria-label={t.objTitle}
            className="min-h-[44px] flex-1 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-[13px] text-g-word placeholder:text-g-muted/60 focus:outline-none focus:border-g-green/50" />
          <button onClick={runObj} disabled={objState === "go"} className="btn-bright ai-cta text-[13px] shrink-0 min-h-[44px]">✨ {objState === "go" ? t.objGoing : t.objGo}</button>
        </div>
        {objState === "err" && <div className="text-[12px] text-g-gold mt-2">{objText || t.aiErr}</div>}
        {objState === "done" && objText && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl border border-white/10 bg-[#0d0c0a]/40 p-4">
            <pre className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-g-word font-sans">{objText}</pre>
            <button onClick={() => { navigator.clipboard?.writeText(objText); setObjCopied(true); setTimeout(() => setObjCopied(false), 1500); }} className="btn-ghost text-[12px] mt-3 min-h-[44px]">{objCopied ? t.copied : t.copy}</button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
