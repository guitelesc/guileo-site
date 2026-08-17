import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { VERTICALS, VERTICAL_KEYS } from "../data/verticals.js";
import { KIT_VIDEO, KIT_EMAILS, KIT_DMS } from "../data/launchKit.js";
import { LEADS, leadsByCity, buildEmail, buildBrief, buildWhatsApp, waLink } from "../data/leadBoss.js";

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
    title: "Alvos do dia", huntTitle: "Caçar mais alvos", sub: "Escolha o nicho e o bairro. A IA monta seu plano de caça — o alvo ideal, as dores locais, o gancho e o script. Os links já te levam aos negócios reais pra abordar.",
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
    title: "Targets of the day", huntTitle: "Hunt more targets", sub: "Pick the niche and the neighborhood. AI builds your hunt plan — the ideal target, local pains, the hook and the script. The links take you straight to real businesses to approach.",
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
    title: "Objetivos del día", huntTitle: "Cazar más objetivos", sub: "Elige el nicho y el barrio. La IA arma tu plan de caza — el objetivo ideal, los dolores locales, el gancho y el script. Los enlaces te llevan directo a negocios reales para abordar.",
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
      body: JSON.stringify({ action: "log", kind: "pitch", email: seller.email, seller: { name: seller.name, ref: seller.ref, code: seller.code || "" } }) }).catch(() => {});
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

      {/* LEAD BOSS — real, pre-loaded leads ready to call & close (seeded bench) */}
      <LeadBoss lang={lang} seller={seller} nav={nav} />

      {/* ── Hunt plan generator (find MORE targets in any niche/city) ── */}
      <div className="pt-2">
        <h3 className="text-lg font-black text-g-word">🧭 {t.huntTitle || "Caçar mais alvos"}</h3>
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

// ── LEAD BOSS ─────────────────────────────────────────────────────────────────
// A seeded bench of REAL prospects (src/data/leadBoss.js), each ready to action NOW:
// call / WhatsApp / email buttons + a finished cold email + a one-page call brief (both baked
// from the lead, instant, no network), + a per-seller status pipeline saved in localStorage.
// "já pronto pra ele só ligar e fechar."
const LEADBOSS_TX = {
  pt: {
    // ⚠️ CHAVE QUE FALTAVA (auditoria 2026-08-17): `t.copy` era usado na linha do botão
    // de copiar a mensagem de WhatsApp PRONTA — em TODO lead — e não existia neste dicionário.
    // Resultado: o botão renderizava com rótulo VAZIO. Ninguém clica num botão sem nome, então a
    // mensagem que o motor já tinha escrito para cada um dos 133 leads não era usada. Chave
    // ausente em JS não dá erro: devolve undefined, e o React desenha nada. O defeito mais caro
    // desta auditoria em relação ao tamanho do conserto.
    copy: "📋 Copiar",
    title: "Leads prontos", sub: "Leads reais já pesquisados e verificados. Ligue, mande o e-mail pronto e feche — o brief da call já está aqui.",
    ready: "prontos", closed: "fechados", verified: "verificado no site",
    call: "📞 Ligar", wa: "💬 WhatsApp", site: "🌐 Site", email: "✉️ E-mail",
    obs: "O gancho (o que abrir)", emailReady: "✉️ E-mail pronto", briefReady: "🎯 Brief da call",
    copyEmail: "📋 Copiar e-mail", copyBrief: "📋 Copiar brief", copied: "Copiado ✓",
    decGap: "decisor não público — pergunte na ligação", noContact: "sem telefone público — abra o site",
    statuses: { novo: "Novo", contatado: "Contatado", agendado: "Agendado", fechado: "Fechado" },
    advance: "avançar", subjLabel: "assunto", worked: "trabalhados",
    profile: "👤 Perfil & CRM", closeProfile: "fechar perfil", contact: "Contato",
    sendEmail: "✉️ Abrir e-mail pronto", notes: "Notas", notesPh: "O que rolou, próximo passo…",
    logCall: "＋ Liguei", logEmail: "＋ Mandei e-mail", logNoAnswer: "＋ Sem resposta",
    logKind: { call: "📞", email: "✉️", wa: "💬", noanswer: "🚫" },
    logKindLabel: { call: "Ligação", email: "E-mail enviado", wa: "WhatsApp", noanswer: "Sem resposta" },
    toFollowup: "➡️ Follow-up", toCadastro: "➕ Cadastrar", waReady: "💬 WhatsApp pronto", waSend: "Abrir no WhatsApp",
  },
  en: {
    // ⚠️ CHAVE QUE FALTAVA (auditoria 2026-08-17): `t.copy` era usado na linha do botão
    // de copiar a mensagem de WhatsApp PRONTA — em TODO lead — e não existia neste dicionário.
    // Resultado: o botão renderizava com rótulo VAZIO. Ninguém clica num botão sem nome, então a
    // mensagem que o motor já tinha escrito para cada um dos 133 leads não era usada. Chave
    // ausente em JS não dá erro: devolve undefined, e o React desenha nada. O defeito mais caro
    // desta auditoria em relação ao tamanho do conserto.
    copy: "📋 Copy",
    title: "Ready leads", sub: "Real, pre-researched, verified leads. Call, send the ready email and close — the call brief is right here.",
    ready: "ready", closed: "closed", verified: "verified on site",
    call: "📞 Call", wa: "💬 WhatsApp", site: "🌐 Site", email: "✉️ Email",
    obs: "The hook (how to open)", emailReady: "✉️ Ready email", briefReady: "🎯 Call brief",
    copyEmail: "📋 Copy email", copyBrief: "📋 Copy brief", copied: "Copied ✓",
    decGap: "decision-maker not public — ask on the call", noContact: "no public phone — open the site",
    statuses: { novo: "New", contatado: "Contacted", agendado: "Booked", fechado: "Closed" },
    advance: "advance", subjLabel: "subject", worked: "worked",
    profile: "👤 Profile & CRM", closeProfile: "close profile", contact: "Contact",
    sendEmail: "✉️ Open ready email", notes: "Notes", notesPh: "What happened, next step…",
    logCall: "＋ Called", logEmail: "＋ Emailed", logNoAnswer: "＋ No answer",
    logKind: { call: "📞", email: "✉️", wa: "💬", noanswer: "🚫" },
    logKindLabel: { call: "Call", email: "Email sent", wa: "WhatsApp", noanswer: "No answer" },
    toFollowup: "➡️ Follow-up", toCadastro: "➕ Add client", waReady: "💬 WhatsApp ready", waSend: "Open in WhatsApp",
  },
  es: {
    // ⚠️ CHAVE QUE FALTAVA (auditoria 2026-08-17): `t.copy` era usado na linha do botão
    // de copiar a mensagem de WhatsApp PRONTA — em TODO lead — e não existia neste dicionário.
    // Resultado: o botão renderizava com rótulo VAZIO. Ninguém clica num botão sem nome, então a
    // mensagem que o motor já tinha escrito para cada um dos 133 leads não era usada. Chave
    // ausente em JS não dá erro: devolve undefined, e o React desenha nada. O defeito mais caro
    // desta auditoria em relação ao tamanho do conserto.
    copy: "📋 Copiar",
    title: "Leads listos", sub: "Leads reales, ya investigados y verificados. Llama, envía el correo listo y cierra — el brief de la llamada está aquí.",
    ready: "listos", closed: "cerrados", verified: "verificado en el sitio",
    call: "📞 Llamar", wa: "💬 WhatsApp", site: "🌐 Sitio", email: "✉️ Correo",
    obs: "El gancho (cómo abrir)", emailReady: "✉️ Correo listo", briefReady: "🎯 Brief de llamada",
    copyEmail: "📋 Copiar correo", copyBrief: "📋 Copiar brief", copied: "Copiado ✓",
    decGap: "decisor no público — pregúntalo en la llamada", noContact: "sin teléfono público — abre el sitio",
    statuses: { novo: "Nuevo", contatado: "Contactado", agendado: "Agendado", fechado: "Cerrado" },
    advance: "avanzar", subjLabel: "asunto", worked: "trabajados",
    profile: "👤 Perfil & CRM", closeProfile: "cerrar perfil", contact: "Contacto",
    sendEmail: "✉️ Abrir correo listo", notes: "Notas", notesPh: "Qué pasó, próximo paso…",
    logCall: "＋ Llamé", logEmail: "＋ Envié correo", logNoAnswer: "＋ Sin respuesta",
    logKind: { call: "📞", email: "✉️", wa: "💬", noanswer: "🚫" },
    logKindLabel: { call: "Llamada", email: "Correo enviado", wa: "WhatsApp", noanswer: "Sin respuesta" },
    toFollowup: "➡️ Seguimiento", toCadastro: "➕ Alta cliente", waReady: "💬 WhatsApp listo", waSend: "Abrir en WhatsApp",
  },
};
LEADBOSS_TX.hi = LEADBOSS_TX.en;

const STATUS_ORDER = ["novo", "contatado", "agendado", "fechado"];
const STATUS_TONE = { novo: "text-g-muted ring-white/15", contatado: "text-g-info ring-g-info/40", agendado: "text-g-gold ring-g-gold/40", fechado: "text-g-green ring-g-green/50" };

function LeadBoss({ lang = "pt", seller, nav }) {
  const t = LEADBOSS_TX[lang] || LEADBOSS_TX.pt;
  const key = `guileo_leadboss_${(seller && seller.email) || "anon"}`;
  const [crm, setCrm] = useState({});          // { [id]: { status, notes, log:[{ts,kind}] } }
  const [openId, setOpenId] = useState(null);  // which lead's profile is expanded
  const [copiedKey, setCopiedKey] = useState(null);

  const sellerCode = (seller && (seller.code || seller.token)) || "";
  const canSync = !!((seller && seller.email) && sellerCode);

  useEffect(() => {
    // 1) localStorage first (instant, offline-safe)
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "{}") || {};
      const norm = {};
      for (const k of Object.keys(raw)) norm[k] = typeof raw[k] === "string" ? { status: raw[k], notes: "", log: [] } : { status: "novo", notes: "", log: [], ...raw[k] };
      setCrm(norm);
    } catch { /* private mode */ }
    // 2) then hydrate from the DB (authoritative) and merge — DB wins on conflict.
    if (canSync) {
      fetch("/api/seller-leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list", seller_email: seller.email, seller_code: sellerCode }) })
        .then((r) => r.json()).then((d) => {
          if (d && d.ok && d.crm && Object.keys(d.crm).length) {
            setCrm((prev) => { const merged = { ...prev, ...d.crm }; try { localStorage.setItem(key, JSON.stringify(merged)); } catch { /* ignore */ } return merged; });
          }
        }).catch(() => { /* offline → localStorage stands */ });
    }
  }, [key]);

  const rec = (id) => crm[id] || { status: "novo", notes: "", log: [] };
  const persist = (next) => { try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ } return next; };
  const saveLead = (id, r) => {
    if (!canSync) return;
    fetch("/api/seller-leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", seller_email: seller.email, seller_code: sellerCode, lead_id: id, status: r.status, notes: r.notes, log: r.log }) }).catch(() => { /* offline → localStorage cache stands, re-syncs next load */ });
  };
  // sync=false for keystroke-level notes edits (persist locally only); the textarea onBlur flushes to DB.
  const patch = (id, partial, sync = true) => {
    const nextRec = { ...rec(id), ...partial };
    setCrm((prev) => persist({ ...prev, [id]: nextRec }));
    if (sync) saveLead(id, nextRec);
  };
  const addLog = (id, kind) => { const r = rec(id); patch(id, { log: [{ ts: Date.now(), kind }, ...(r.log || [])].slice(0, 40) }); };
  const advance = (id) => { const cur = rec(id).status; patch(id, { status: STATUS_ORDER[Math.min(STATUS_ORDER.indexOf(cur) + 1, STATUS_ORDER.length - 1)] }); };

  const groups = leadsByCity(LEADS);
  const total = LEADS.length;
  const closed = LEADS.filter((l) => rec(l.id).status === "fechado").length;
  const worked = LEADS.filter((l) => rec(l.id).status !== "novo").length;
  const sellerName = (seller && seller.name) || "";
  const fmtTs = (ts) => { try { return new Date(ts).toLocaleString(lang === "pt" ? "pt-BR" : lang === "es" ? "es" : "en-US", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

  return (
    <div className="rounded-2xl border border-g-green/25 bg-g-green/[0.04] p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <div className="text-sm font-extrabold text-g-green">🚀 {t.title}</div>
          <p className="text-[12.5px] text-g-muted mt-0.5 max-w-2xl">{t.sub}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[12px] font-bold">
          <span className="rounded-full bg-white/[0.05] px-3 py-1 text-g-word ring-1 ring-white/10">{worked}/{total} {t.worked}</span>
          <span className="rounded-full bg-g-green/15 px-3 py-1 text-g-green ring-1 ring-g-green/30">{closed} {t.closed}</span>
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.city} className="mt-4">
          <div className="text-[11px] font-black uppercase tracking-wider text-g-muted mb-2">📍 {g.city} · {g.leads.length}</div>
          <div className="grid gap-3 md:grid-cols-2">
            {g.leads.map((l) => {
              const r = rec(l.id);
              const st = r.status;
              const em = buildEmail(l, lang, sellerName);
              const br = buildBrief(l, lang);
              // WhatsApp com a mensagem JÁ ESCRITA (no BR é o canal que fecha — chat em branco trava o vendedor).
              const waMsg = buildWhatsApp(l, lang, sellerName);
              const waHref = waLink(l, lang, sellerName);
              const isOpen = openId === l.id;
              const mailHref = l.email ? `mailto:${l.email}?subject=${encodeURIComponent(em.subject)}&body=${encodeURIComponent(em.body)}` : "";
              return (
                <div key={l.id} className={`card p-4 ${st === "fechado" ? "ring-1 ring-g-green/40" : ""}`}>
                  {/* header row */}
                  <div className="flex items-start gap-2">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${l.heat === "hot" ? "bg-g-live" : "bg-g-gold"}`} title={l.heat} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-extrabold text-g-word leading-tight">{l.name}</div>
                      <div className="text-[11.5px] text-g-muted">{l.area}{l.decisor ? ` · ${l.decisor}` : ""}</div>
                    </div>
                    <button onClick={() => advance(l.id)} title={t.advance}
                      className={`shrink-0 rounded-full bg-white/[0.04] px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wide ring-1 ${STATUS_TONE[st]}`}>
                      {t.statuses[st]}
                    </button>
                  </div>

                  {/* the hook */}
                  <div className="mt-2.5 rounded-lg border border-g-gold/20 bg-g-gold/[0.05] p-2.5">
                    <div className="text-[9.5px] font-black uppercase tracking-wider text-g-gold">{t.obs}</div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-g-word">{l.obs[lang] || l.obs.en || l.obs.pt}</p>
                  </div>

                  {/* communicate — ready to fire. Each also logs the touch to the lead's CRM. */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {l.phone
                      ? <a href={`tel:+${l.phone}`} onClick={() => addLog(l.id, "call")} className="btn-bright text-[12px] py-1.5">{t.call}</a>
                      : <span className="text-[11px] text-g-muted italic self-center">{t.noContact}</span>}
                    {waHref && <a href={waHref} target="_blank" rel="noopener" onClick={() => addLog(l.id, "wa")} className="btn-ghost text-[12px] py-1.5" title={t.waReady}>{t.wa}</a>}
                    {mailHref && <a href={mailHref} onClick={() => addLog(l.id, "email")} className="btn-ghost text-[12px] py-1.5">{t.email}</a>}
                    {l.site && <a href={l.site} target="_blank" rel="noopener" className="btn-ghost text-[12px] py-1.5">{t.site}</a>}
                    <button onClick={() => setOpenId(isOpen ? null : l.id)} className={`rounded-full px-3 py-1 text-[11.5px] font-bold ring-1 ${isOpen ? "bg-g-green/15 text-g-word ring-g-green/40" : "text-g-muted ring-white/10 hover:text-g-word"}`}>{isOpen ? t.closeProfile : t.profile}</button>
                    {nav && (
                      <button onClick={() => nav("followup", { prefill: { business: l.name, contact: l.decisor || "", contact_name: l.decisor || "", phone: l.phone ? `+${l.phone}` : "", email: l.email || "", market: "us", note: l.obs[lang] || l.obs.en || l.obs.pt } })}
                        className="rounded-full px-3 py-1 text-[11.5px] font-bold ring-1 text-g-muted ring-white/10 hover:text-g-word">{t.toFollowup}</button>
                    )}
                    {nav && (
                      <button onClick={() => nav("cadastro", { business: l.name, email: l.email || "", contact: l.decisor || "", phone: l.phone ? `+${l.phone}` : "" })}
                        className="rounded-full px-3 py-1 text-[11.5px] font-bold ring-1 text-g-muted ring-white/10 hover:text-g-word">{t.toCadastro}</button>
                    )}
                  </div>

                  {/* PROFILE + CRM */}
                  {isOpen && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 space-y-3 overflow-hidden">
                      {/* contact block */}
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[12px] text-g-word space-y-1">
                        <div className="text-[9.5px] font-black uppercase tracking-wider text-g-muted">{t.contact}</div>
                        <div>📞 {l.phone ? `+${l.phone}` : "—"}</div>
                        <div>✉️ {l.email || "—"}</div>
                        <div>🌐 {l.site ? <a href={l.site} target="_blank" rel="noopener" className="text-g-info underline">{l.site.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a> : "—"}</div>
                        <div>👤 {l.decisor || t.decGap}</div>
                        <div className="text-[10.5px] text-g-muted pt-0.5">✓ {t.verified}</div>
                      </div>

                      {/* WhatsApp pronto — o canal que fecha no BR; abre já escrito */}
                      {waHref && (
                        <div className="rounded-xl border border-g-green/25 bg-g-green/[0.05] p-3">
                          <div className="text-[9.5px] font-black uppercase tracking-wider text-g-green">{t.waReady}</div>
                          <pre className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-g-word font-sans">{waMsg}</pre>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <a href={waHref} target="_blank" rel="noopener" onClick={() => addLog(l.id, "wa")} className="btn-bright text-[11.5px]">💬 {t.waSend}</a>
                            <CopyBtn text={waMsg} label={t.copy} copiedLabel={t.copied} copiedKey={copiedKey} myKey={`lb-wa-${l.id}`} setCopiedKey={setCopiedKey} cls="btn-ghost text-[11.5px]" />
                          </div>
                        </div>
                      )}

                      {/* ready email */}
                      <div className="rounded-xl border border-white/10 bg-[#0d0c0a]/50 p-3">
                        <div className="text-[9.5px] font-black uppercase tracking-wider text-g-muted">{t.emailReady} · {t.subjLabel}</div>
                        <div className="text-[12.5px] font-bold text-g-word">{em.subject}</div>
                        <pre className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-g-ink font-sans">{em.body}</pre>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {mailHref && <a href={mailHref} onClick={() => addLog(l.id, "email")} className="btn-bright text-[11.5px]">{t.sendEmail}</a>}
                          <CopyBtn text={em.full} label={t.copyEmail} copiedLabel={t.copied} copiedKey={copiedKey} myKey={`lb-em-${l.id}`} setCopiedKey={setCopiedKey} cls="btn-ghost text-[11.5px]" />
                        </div>
                      </div>

                      {/* ready call brief */}
                      <div className="rounded-xl border border-g-green/20 bg-g-green/[0.04] p-3">
                        <div className="text-[9.5px] font-black uppercase tracking-wider text-g-green">{t.briefReady}</div>
                        <pre className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-g-word font-sans">{br}</pre>
                        <CopyBtn text={br} label={t.copyBrief} copiedLabel={t.copied} copiedKey={copiedKey} myKey={`lb-br-${l.id}`} setCopiedKey={setCopiedKey} cls="btn-ghost text-[11.5px] mt-2" />
                      </div>

                      {/* CRM: notes + activity log */}
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-[9.5px] font-black uppercase tracking-wider text-g-muted">{t.notes}</div>
                        <textarea value={r.notes || ""} onChange={(e) => patch(l.id, { notes: e.target.value }, false)} onBlur={() => saveLead(l.id, rec(l.id))} placeholder={t.notesPh} rows={2}
                          className="mt-1.5 w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-[12.5px] text-g-word placeholder:text-g-muted/50 focus:outline-none focus:border-g-green/40" />
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <button onClick={() => addLog(l.id, "call")} className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-g-muted ring-1 ring-white/10 hover:text-g-word">{t.logCall}</button>
                          <button onClick={() => addLog(l.id, "email")} className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-g-muted ring-1 ring-white/10 hover:text-g-word">{t.logEmail}</button>
                          <button onClick={() => addLog(l.id, "noanswer")} className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[11px] font-bold text-g-muted ring-1 ring-white/10 hover:text-g-word">{t.logNoAnswer}</button>
                        </div>
                        {(r.log || []).length > 0 && (
                          <ul className="mt-2.5 space-y-1 border-t border-white/8 pt-2">
                            {(r.log || []).map((e, i) => (
                              <li key={i} className="flex items-center gap-2 text-[11px] text-g-muted">
                                <span className="text-g-green">{t.logKind[e.kind] || "•"}</span>
                                <span className="text-g-word">{t.logKindLabel[e.kind] || e.kind}</span>
                                <span className="ml-auto tabular-nums">{fmtTs(e.ts)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
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
