import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { VERTICALS, VERTICAL_KEYS } from "../data/verticals.js";
import { KIT_VIDEO, KIT_EMAILS, KIT_DMS } from "../data/launchKit.js";

// ── "Alvos do dia" — the seller's daily hunting bench inside /vendedor ─────────────────────────
// Pick a NICHE (the verticals) + a CITY/NEIGHBORHOOD → the AI writes an honest HUNT PLAN (ideal
// target profile, 3 local pains, opening hook, likely objection + reframe, an approach script).
// The AI never invents real business names — real targets come from the live search links (Google
// Maps / Yelp) the UI builds. Plus a Launch Kit (sales-video script, cold emails, DM openers) and a
// light localStorage streak ("alvos abordados hoje"). Design follows the hub: cement + Gui signals.

// Per-vertical search word (what a seller would type into Maps/Yelp) + a short pains hint we feed
// the AI so the plan speaks the playbook's language. English seed strings; the AI translates.
const NICHE_META = {
  restaurant:   { term: "restaurant",        pains: "missed lunch-rush calls, WhatsApp orders at night unanswered, no-shows on reservations, delivery-app leakage" },
  clinic:       { term: "dental clinic",     pains: "after-hours calls with no message, patients booking elsewhere, recalls never followed up, no-shows" },
  salon:        { term: "hair salon",        pains: "phone rings during a service, gaps in the calendar, expiring packages, DMs left unanswered" },
  law:          { term: "law firm",          pains: "after-hours intakes lost, slow lead follow-up, unqualified callers eating time, missed consults" },
  ecommerce:    { term: "boutique store",    pains: "abandoned carts, sizing DMs unanswered, lapsed customers never won back, slow reply time" },
  realestate:   { term: "real estate agency",pains: "leads waiting hours for a callback, after-hours enquiries lost, unconfirmed viewings, no lead qualification" },
  gym:          { term: "gym",               pains: "trial leads not called back, at-risk members churning, DMs unanswered, class no-shows" },
  medical:      { term: "medical clinic",    pains: "inbound calls during appointments, recalls not sent, no-shows, follow-ups slipping" },
  homeservices: { term: "plumber",           pains: "emergency calls after hours lost to the next name on the list, quotes not followed up, unbooked jobs" },
  auto:         { term: "car dealership",    pains: "after-hours leads lost, slow response on financing questions, unconfirmed test drives, service-bay gaps" },
  education:    { term: "tutoring center",   pains: "trial leads not called back, at-risk students, slow reply on WhatsApp, low enrollment follow-up" },
  construction: { term: "general contractor",pains: "quote requests after hours lost, slow estimate follow-up, unqualified leads, missed site visits" },
};

// City / neighborhood quick-picks — NYC + Miami first (the launch markets).
const CITY_SUGGESTIONS = ["Astoria, NYC", "Williamsburg, Brooklyn", "Jackson Heights, NYC", "Flushing, NYC", "Wynwood, Miami", "Little Havana, Miami", "Brickell, Miami", "Coral Gables, Miami"];

const PROSPECT_TXT = {
  pt: {
    title: "Alvos do dia", sub: "Escolha o nicho e o bairro. A IA monta seu plano de caça — o alvo ideal, as dores locais, o gancho e o script. Os links já te levam aos negócios reais pra abordar.",
    pickNiche: "Nicho do alvo", pickCity: "Cidade / bairro", cityPh: "Ex: Astoria, NYC · Wynwood, Miami",
    go: "Gerar plano de caça", going: "Montando…", err: "Não consegui agora. Tenta de novo.", needCity: "Escreva a cidade ou bairro.",
    fProfile: "Alvo ideal", fPains: "Dores locais", fHook: "Gancho de abertura", fObjection: "Objeção provável", fAnswer: "Sua resposta", fScript: "Script de abordagem",
    honest: "A IA descreve o TIPO de alvo — ela não inventa nomes de negócios reais. Use os links abaixo pra achar os alvos de verdade.",
    linksTitle: "Ache os alvos agora", mapsBtn: "🗺️ Buscar no Google Maps", yelpBtn: "⭐ Buscar no Yelp", linksSub: "Abre a busca real do nicho + bairro numa nova aba.",
    copy: "📋 Copiar", copied: "Copiado ✓", copyScript: "📋 Copiar script",
    streakTitle: "Alvos abordados hoje", streakSub: "Marque cada vez que você abordar um alvo. Zera todo dia.", streakBtn: "+ Marquei um alvo", streakReset: "zerar",
    kitTitle: "Kit de lançamento", kitSub: "Material pronto pra vender: o roteiro do vídeo de venda, e-mails de prospecção e DMs. Tudo com botão copiar.",
    kitVideo: "🎬 Roteiro do vídeo (demo Natura · 60-90s)", kitEmails: "✉️ E-mails de prospecção", kitDms: "💬 DMs (Instagram / WhatsApp)",
    langEN: "EN", langPT: "PT", copyEmail: "📋 Copiar e-mail", copySubject: "assunto", placeholders: "Troque {nome} = dono · {negocio} = nome do negócio · {seller} = você.",
    saveProspect: "➕ Salvar como prospect", trainApproach: "🎭 Treinar essa abordagem", huntNote: "Da caça: {niche} em {city}",
  },
  en: {
    title: "Targets of the day", sub: "Pick the niche and the neighborhood. AI builds your hunt plan — the ideal target, local pains, the hook and the script. The links take you straight to real businesses to approach.",
    pickNiche: "Target niche", pickCity: "City / neighborhood", cityPh: "e.g. Astoria, NYC · Wynwood, Miami",
    go: "Build hunt plan", going: "Building…", err: "Couldn't right now. Try again.", needCity: "Type the city or neighborhood.",
    fProfile: "Ideal target", fPains: "Local pains", fHook: "Opening hook", fObjection: "Likely objection", fAnswer: "Your reply", fScript: "Approach script",
    honest: "AI describes the TYPE of target — it never invents real business names. Use the links below to find the real targets.",
    linksTitle: "Find the targets now", mapsBtn: "🗺️ Search Google Maps", yelpBtn: "⭐ Search Yelp", linksSub: "Opens the real niche + neighborhood search in a new tab.",
    copy: "📋 Copy", copied: "Copied ✓", copyScript: "📋 Copy script",
    streakTitle: "Targets approached today", streakSub: "Tap each time you approach a target. Resets daily.", streakBtn: "+ Approached one", streakReset: "reset",
    kitTitle: "Launch kit", kitSub: "Ready-to-sell material: the sales-video script, cold emails and DMs. Everything with a copy button.",
    kitVideo: "🎬 Sales-video script (Natura demo · 60-90s)", kitEmails: "✉️ Cold emails", kitDms: "💬 DMs (Instagram / WhatsApp)",
    langEN: "EN", langPT: "PT", copyEmail: "📋 Copy email", copySubject: "subject", placeholders: "Swap {nome} = owner · {negocio} = business name · {seller} = you.",
    saveProspect: "➕ Save as prospect", trainApproach: "🎭 Train this approach", huntNote: "From the hunt: {niche} in {city}",
  },
  es: {
    title: "Objetivos del día", sub: "Elige el nicho y el barrio. La IA arma tu plan de caza — el objetivo ideal, los dolores locales, el gancho y el script. Los enlaces te llevan directo a negocios reales para abordar.",
    pickNiche: "Nicho del objetivo", pickCity: "Ciudad / barrio", cityPh: "Ej: Astoria, NYC · Wynwood, Miami",
    go: "Armar plan de caza", going: "Armando…", err: "No pude ahora. Intenta de nuevo.", needCity: "Escribe la ciudad o barrio.",
    fProfile: "Objetivo ideal", fPains: "Dolores locales", fHook: "Gancho de apertura", fObjection: "Objeción probable", fAnswer: "Tu respuesta", fScript: "Script de abordaje",
    honest: "La IA describe el TIPO de objetivo — no inventa nombres de negocios reales. Usa los enlaces de abajo para encontrar los objetivos reales.",
    linksTitle: "Encuentra los objetivos ahora", mapsBtn: "🗺️ Buscar en Google Maps", yelpBtn: "⭐ Buscar en Yelp", linksSub: "Abre la búsqueda real del nicho + barrio en una pestaña nueva.",
    copy: "📋 Copiar", copied: "Copiado ✓", copyScript: "📋 Copiar script",
    streakTitle: "Objetivos abordados hoy", streakSub: "Marca cada vez que abordes un objetivo. Se reinicia a diario.", streakBtn: "+ Abordé uno", streakReset: "reiniciar",
    kitTitle: "Kit de lanzamiento", kitSub: "Material listo para vender: el guion del video de venta, correos de prospección y DMs. Todo con botón copiar.",
    kitVideo: "🎬 Guion del video (demo Natura · 60-90s)", kitEmails: "✉️ Correos de prospección", kitDms: "💬 DMs (Instagram / WhatsApp)",
    langEN: "EN", langPT: "PT", copyEmail: "📋 Copiar correo", copySubject: "asunto", placeholders: "Cambia {nome} = dueño · {negocio} = nombre del negocio · {seller} = tú.",
    saveProspect: "➕ Guardar como prospecto", trainApproach: "🎭 Entrenar este abordaje", huntNote: "De la caza: {niche} en {city}",
  },
};
PROSPECT_TXT.hi = { ...PROSPECT_TXT.en, title: "आज के लक्ष्य", go: "हंट प्लान बनाएँ", going: "बना रहे हैं…" };

// Fire-and-forget seller-activity log (mirrors Vendedor's logSellerEvent — analytics must never
// break the hub). Counts a generated hunt plan as a "pitch" so it feeds Minhas Metas.
function logPitch(seller) {
  if (!seller?.email) return;
  try {
    fetch("/api/seller-stats", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "log", kind: "pitch", email: seller.email, seller: { name: seller.name, ref: seller.ref } }) }).catch(() => {});
  } catch { /* ignore */ }
}

// Small reusable copy button — tracks which key was last copied so only that one flips to ✓.
function CopyBtn({ text, label, copiedLabel, copiedKey, myKey, setCopiedKey, cls = "btn-ghost text-[12px]" }) {
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(text); setCopiedKey(myKey); setTimeout(() => setCopiedKey(null), 1500); }} className={cls}>
      {copiedKey === myKey ? copiedLabel : label}
    </button>
  );
}

// Props: interactivity contract adds `market` (us|br, drives BR/US tone) and `nav(tabKey, payload)`
// to hand a hunted target off to Follow-up (as a prospect) or to the roleplay trainer. Both optional —
// absent → the component works exactly as before.
export default function SellerProspect({ lang = "pt", seller, market = "us", nav }) {
  const t = PROSPECT_TXT[lang] || PROSPECT_TXT.pt;
  const kitLang = KIT_VIDEO[lang] ? lang : "en"; // video/kit content: pt/en/es, hi falls back to en
  const [niche, setNiche] = useState(VERTICAL_KEYS[0]);
  const [city, setCity] = useState("");
  const [state, setState] = useState("idle"); // idle | go | done | err
  const [plan, setPlan] = useState(null);
  const [raw, setRaw] = useState("");
  const [copiedKey, setCopiedKey] = useState(null);

  const meta = NICHE_META[niche] || { term: niche, pains: "" };
  const nicheLabel = VERTICALS[niche]?.label || niche;
  const nicheIcon = VERTICALS[niche]?.icon || "🎯";

  // Real search URLs — niche search term + the typed city/neighborhood.
  const mapsUrl = useMemo(() => `https://www.google.com/maps/search/${encodeURIComponent(`${meta.term} ${city}`.trim())}`, [meta.term, city]);
  const yelpUrl = useMemo(() => `https://www.yelp.com/search?find_desc=${encodeURIComponent(meta.term)}&find_loc=${encodeURIComponent(city)}`, [meta.term, city]);

  const run = async () => {
    if (!city.trim()) { setState("err"); return; }
    setState("go"); setPlan(null); setRaw("");
    try {
      const r = await fetch("/api/prospect-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ niche: nicheLabel, city: city.trim(), pains: meta.pains, lang }) });
      const d = await r.json().catch(() => ({}));
      if (d?.ok && d.plan) { setPlan(d.plan); setState("done"); logPitch(seller); }
      else if (d?.ok && d.raw) { setRaw(d.raw); setState("done"); logPitch(seller); }
      else setState("err");
    } catch { setState("err"); }
  };

  const Block = ({ label, tone = "muted", children }) => (
    <div className="card p-4">
      <div className={`text-[10.5px] font-black uppercase tracking-wider ${tone === "gold" ? "text-g-gold" : tone === "green" ? "text-g-green" : "text-g-muted"}`}>{label}</div>
      <div className="mt-1.5 text-[13.5px] leading-relaxed text-g-word">{children}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-g-word">🎯 {t.title}</h2>
        <p className="text-[13px] text-g-muted mt-1 max-w-2xl">{t.sub}</p>
      </div>

      {/* niche picker */}
      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-g-muted">{t.pickNiche}</div>
        <div className="flex flex-wrap gap-2">
          {VERTICAL_KEYS.map((k) => (
            <button key={k} onClick={() => { setNiche(k); setPlan(null); setRaw(""); setState("idle"); }}
              className={`rounded-full px-3.5 py-2 text-[12.5px] font-bold transition ${niche === k ? "bg-g-green/15 text-g-word ring-1 ring-g-green/40" : "bg-white/[0.04] text-g-muted ring-1 ring-white/10 hover:text-g-word"}`}>
              <span className="mr-1">{VERTICALS[k].icon}</span>{VERTICALS[k].label}
            </button>
          ))}
        </div>
      </div>

      {/* city input + suggestions */}
      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-g-muted">{t.pickCity}</div>
        <input value={city} onChange={(e) => setCity(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") run(); }} placeholder={t.cityPh}
          className="w-full max-w-md rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-[14px] text-g-word placeholder:text-g-muted/60 focus:outline-none focus:border-g-green/50" />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {CITY_SUGGESTIONS.map((c) => (
            <button key={c} onClick={() => setCity(c)} className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11.5px] font-semibold text-g-muted hover:text-g-word hover:border-g-green/30">{c}</button>
          ))}
        </div>
      </div>

      <button onClick={run} disabled={state === "go"} className="btn-bright ai-cta text-[14px]">✨ {state === "go" ? t.going : t.go} →</button>
      {state === "err" && <div className="text-[12.5px] text-g-gold">{city.trim() ? t.err : t.needCity}</div>}

      {/* hunt plan */}
      {state === "done" && plan && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <p className="text-[12px] font-semibold text-g-muted">🛡️ {t.honest}</p>
          <div className="grid gap-3 md:grid-cols-2">
            {plan.perfil && <Block label={`${nicheIcon} ${t.fProfile}`} tone="green">{plan.perfil}</Block>}
            {plan.dores?.length > 0 && (
              <Block label={t.fPains} tone="gold">
                <ul className="space-y-1">{plan.dores.map((d, i) => <li key={i} className="flex gap-2"><span className="text-g-gold">•</span>{d}</li>)}</ul>
              </Block>
            )}
            {plan.gancho && <Block label={t.fHook} tone="green">“{plan.gancho}”</Block>}
            {(plan.objecao || plan.resposta) && (
              <Block label={t.fObjection} tone="gold">
                {plan.objecao && <div className="font-bold text-g-word">“{plan.objecao}”</div>}
                {plan.resposta && <div className="mt-1 text-g-ink"><span className="text-[10.5px] font-black uppercase tracking-wider text-g-green">{t.fAnswer}: </span>{plan.resposta}</div>}
              </Block>
            )}
          </div>
          {plan.script && (
            <div className="rounded-2xl border border-g-green/25 bg-g-green/[0.05] p-4">
              <div className="text-[10.5px] font-black uppercase tracking-wider text-g-green">{t.fScript}</div>
              <pre className="mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-g-word font-sans">{plan.script}</pre>
              <CopyBtn text={plan.script} label={t.copyScript} copiedLabel={t.copied} copiedKey={copiedKey} myKey="script" setCopiedKey={setCopiedKey} cls="btn-ghost text-[12px] mt-3" />
            </div>
          )}
        </motion.div>
      )}
      {state === "done" && !plan && raw && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-white/10 bg-[#0d0c0a]/40 p-4">
          <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-g-word font-sans">{raw}</pre>
          <CopyBtn text={raw} label={t.copy} copiedLabel={t.copied} copiedKey={copiedKey} myKey="raw" setCopiedKey={setCopiedKey} cls="btn-ghost text-[12px] mt-3" />
        </motion.div>
      )}

      {/* handoff row — after a plan is built, turn this hunt into a Follow-up prospect or a roleplay.
          The seller types the REAL business name in Follow-up (we never invent one). market carries tone. */}
      {state === "done" && nav && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => nav("followup", { prefill: { business: "", market, note: t.huntNote.split("{niche}").join(nicheLabel).split("{city}").join(city.trim()) } })}
            className="btn-bright text-[13px]">{t.saveProspect}</button>
          <button type="button" onClick={() => nav("treino", { scenario: { niche: nicheLabel, stage: "abordado", market, business: "" } })}
            className="btn-ghost text-[13px]">{t.trainApproach}</button>
        </div>
      )}

      {/* hunt links — always available, real search URLs */}
      <div className="rounded-2xl border border-g-gold/25 bg-g-gold/[0.05] p-5">
        <div className="text-sm font-extrabold text-g-gold">🔎 {t.linksTitle}</div>
        <p className="text-[12.5px] text-g-muted mt-1">{t.linksSub}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={mapsUrl} target="_blank" rel="noopener" className="btn-ghost text-[13px]">{t.mapsBtn}</a>
          <a href={yelpUrl} target="_blank" rel="noopener" className="btn-ghost text-[13px]">{t.yelpBtn}</a>
        </div>
      </div>

      <StreakCard t={t} />

      {/* ── Launch Kit ─────────────────────────────────────────────────────────────── */}
      <div className="pt-2">
        <h3 className="text-lg font-black text-g-word">🎬 {t.kitTitle}</h3>
        <p className="text-[13px] text-g-muted mt-1 max-w-2xl">{t.kitSub}</p>
      </div>

      {/* video script */}
      <div className="card p-5">
        <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{t.kitVideo}</div>
        <div className="mt-3 space-y-2">
          {(KIT_VIDEO[kitLang]).map((s, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-g-green/15 px-2 py-0.5 text-[10.5px] font-black text-g-green ring-1 ring-g-green/25">{s.t}</span>
                <span className="text-[11.5px] font-semibold text-g-muted">{s.scene}</span>
              </div>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-g-word">“{s.vo}”</p>
            </div>
          ))}
        </div>
        <CopyBtn text={(KIT_VIDEO[kitLang]).map((s) => `[${s.t}] ${s.scene}\n${s.vo}`).join("\n\n")} label={t.copy} copiedLabel={t.copied} copiedKey={copiedKey} myKey="video" setCopiedKey={setCopiedKey} cls="btn-ghost text-[12px] mt-3" />
      </div>

      {/* cold emails */}
      <KitEmails t={t} copiedKey={copiedKey} setCopiedKey={setCopiedKey} />

      {/* DMs */}
      <div className="card p-5">
        <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{t.kitDms}</div>
        <p className="mt-1 text-[11.5px] text-g-muted">{t.placeholders}</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {KIT_DMS.map((dm) => (
            <div key={dm.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10.5px] font-bold text-g-word ring-1 ring-white/10">{dm.channel}</span>
                <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10.5px] font-black uppercase text-g-muted ring-1 ring-white/10">{dm.lang}</span>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-g-word">{dm.text}</p>
              <CopyBtn text={dm.text} label={t.copy} copiedLabel={t.copied} copiedKey={copiedKey} myKey={`dm-${dm.id}`} setCopiedKey={setCopiedKey} cls="btn-ghost text-[11.5px] mt-2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Cold-email browser: niche picker + EN/PT toggle + copy. Sub-component to keep its own local state.
function KitEmails({ t, copiedKey, setCopiedKey }) {
  const [id, setId] = useState(KIT_EMAILS[0].id);
  const [el, setEl] = useState("pt"); // email language: pt | en
  const email = KIT_EMAILS.find((e) => e.id === id) || KIT_EMAILS[0];
  const body = email[el];
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-black uppercase tracking-wider text-g-gold">{t.kitEmails}</div>
        <div className="flex gap-1">
          {[["pt", t.langPT], ["en", t.langEN]].map(([k, lbl]) => (
            <button key={k} onClick={() => setEl(k)} className={`rounded-full px-3 py-1 text-[11.5px] font-bold ${el === k ? "bg-g-green/15 text-g-word ring-1 ring-g-green/40" : "text-g-muted ring-1 ring-white/10"}`}>{lbl}</button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {KIT_EMAILS.map((e) => (
          <button key={e.id} onClick={() => setId(e.id)} className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${id === e.id ? "bg-g-green/15 text-g-word ring-1 ring-g-green/40" : "bg-white/[0.04] text-g-muted ring-1 ring-white/10 hover:text-g-word"}`}>
            <span className="mr-1">{e.icon}</span>{e.niche}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-white/10 bg-[#0d0c0a]/40 p-4">
        <div className="text-[10.5px] font-black uppercase tracking-wider text-g-muted">{t.copySubject}</div>
        <div className="text-[13.5px] font-bold text-g-word">{body.subject}</div>
        <pre className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-g-ink font-sans">{body.body}</pre>
      </div>
      <p className="mt-2 text-[11.5px] text-g-muted">{t.placeholders}</p>
      <CopyBtn text={`${body.subject}\n\n${body.body}`} label={t.copyEmail} copiedLabel={t.copied} copiedKey={copiedKey} myKey={`email-${id}-${el}`} setCopiedKey={setCopiedKey} cls="btn-ghost text-[12px] mt-3" />
    </div>
  );
}

// Light gamification — "targets approached today", kept in localStorage keyed by the day so it
// resets on its own each morning. Never a network call; pure local streak.
function StreakCard({ t }) {
  const dayKey = () => `guileo_prospect_hits_${new Date().toISOString().slice(0, 10)}`;
  const [n, setN] = useState(0);
  useEffect(() => { try { setN(parseInt(localStorage.getItem(dayKey()) || "0", 10) || 0); } catch { /* private mode */ } }, []);
  const bump = () => { const v = n + 1; setN(v); try { localStorage.setItem(dayKey(), String(v)); } catch { /* ignore */ } };
  const reset = () => { setN(0); try { localStorage.setItem(dayKey(), "0"); } catch { /* ignore */ } };
  return (
    <div className="rounded-2xl border border-g-green/25 bg-g-green/[0.05] p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-g-green/15 ring-1 ring-g-green/30">
          <span className="text-2xl font-black text-g-green">{n}</span>
        </div>
        <div className="min-w-0">
          <div className="text-[14px] font-extrabold text-g-word">🔥 {t.streakTitle}</div>
          <p className="text-[12.5px] text-g-muted mt-0.5">{t.streakSub}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={bump} className="btn-bright text-[13px]">{t.streakBtn}</button>
          <button onClick={reset} className="rounded-full border border-white/15 px-3 py-1.5 text-[11.5px] font-bold text-g-muted hover:text-g-word">{t.streakReset}</button>
        </div>
      </div>
    </div>
  );
}
