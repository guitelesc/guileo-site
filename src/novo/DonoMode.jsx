import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { waLink } from "../data/contact.js";

// ─────────────────────────────────────────────────────────────────────────────
// RAIO-X DO DONO — a camada de venda do motor de WEBSITE UPGRADE.
//
// Por que existe: o site reconstruído tem que parecer um site NORMAL do negócio
// pro cliente final (nada de "powered by"), mas quando o DONO abre com ?dono=1
// a mesma página vira a apresentação do sistema inteiro. Um link, dois públicos.
//
// Decisões travadas pelo Luis (não reabrir sem ele):
//  · $500 uma vez pelo site + cada automação é módulo MENSAL do cardápio real
//    (src/pages/Menu.jsx é a fonte dos nomes e preços — aqui não se inventa nada).
//  · As 3 pernas são BRAIN · AD · BUILD: um cardápio só, que vende o sistema.
//  · O público NUNCA vê isso. Sem ?dono=1/?owner=1 o componente não renderiza nada.
//  · Prova = cockpit de amostra na marca do cliente, marcado como AMOSTRA em todo
//    número. Número falso vendido como real destrói a confiança que o motor vende.
// ─────────────────────────────────────────────────────────────────────────────

const ONE_TIME = 500;

// Cardápio real (Menu.jsx). A perna AD não tem módulo de preço fechado no
// cardápio — então ela mostra o que é vendido por campanha e NÃO inventa valor.
const CATALOG = [
  ["BRAIN", "answers · books · quotes · collects", [
    ["AI Voice Receptionist", "Answers every call 24/7 in the business's name — books and responds like your best front desk.", 2500],
    ["Speed-to-Lead 60s", "New lead (site, form, Yelp) gets an AI call in ~60 seconds. Speed closes.", 2000],
    ["AI Quote Engine", "Collects the job details on the call and sends the quote by SMS+email with a link to approve and book.", 1800],
    ["Lead Follow-Up System", "Every lead chased to an answer: call, SMS, email — a sequence that forgets no one.", 1500],
    ["Re-Engagement + Churn Shield", "Detects the loyal customer drifting away and wins them back before they're gone.", 1500],
    ["Reminders + No-Show Shield", "Smart confirmations + per-customer no-show risk. A schedule that actually holds.", 800],
    ["Collect-on-the-Call", "Closed on the phone? Payment link by SMS right there. Quotes chased until paid.", 700],
    ["Missed-Call Text-Back + Auto-Return", "Missed the call? Instant text and the AI calls back on its own.", 500],
  ]],
  ["AD", "demand · creative · reputation", [
    ["Review Machine", "Requests, collects and answers 5★ reviews automatically. Reputation becomes a funnel.", 750],
    ["Ads · creative · local SEO", "Campaigns, creative and search built on top of the same engine — scoped and quoted per campaign, never guessed here.", 0],
  ]],
  ["BUILD", "the site · the cockpit · the CRM", [
    ["Website Upgrade", "This page. Rebuilt, fast, on your brand — with the AI layer already wired in.", 0, "$500 one-time"],
    ["Full Backend CRM (Company OS)", "Every conversation becomes a record, history and next step — the whole business on one spine.", 3000],
    ["Growth Cockpit Dashboard", "~30 screens of live operation: calls, schedule, payments, campaigns. The owner SEES it working.", 1500],
  ]],
];

// Cada CTA real da página → o motor que responde por ele. Um seletor por linha:
// o primeiro que casar vence (dedupe), pra não etiquetar o mesmo botão 2 vezes.
const XRAY = [
  ['a[href^="tel:"]', "BRAIN", "AI Voice Receptionist", false, 2500],
  [".np-btn-q", "BRAIN", "AI Quote Engine", false, 1800],
  ["form button[type=submit]", "BRAIN", "AI Quote Engine", false, 1800],
  ["[aria-expanded]", "BRAIN", "Speed-to-Lead 60s", false, 2000],
  [".np-btn-n", "BRAIN", "Lead Follow-Up System", false, 1500],
];
const ALWAYS = [
  ["BUILD", "Website Upgrade", true, 0, "$500 one-time"],
  ["BRAIN", "AI on the site", true, 0, "included in this build"],
];

const LEG_HUE = { BRAIN: "#17c6ff", AD: "#ff8a33", BUILD: "#8be27a" };
const money = (n) => "$" + n.toLocaleString("en-US");

const Icon = ({ d, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const IconLink = <Icon d={<><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1" /></>} />;
const IconClose = <Icon d={<><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>} />;
const IconGrid = <Icon d={<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>} />;
const IconCheck = <Icon d={<path d="M4 12.5l5 5L20 6.5" />} size={11} />;

export default function DonoMode({
  business = "this business",
  accent = "#3E9468",
  surface = "#0c1a2e",
  mascot = null,
  upgradeUrl = "",
}) {
  // Portão: sem ?dono=1 / ?owner=1 o componente inteiro é inerte. Lido uma vez,
  // em estado, porque o primeiro render no cliente já precisa da resposta certa.
  const [on] = useState(() => {
    if (typeof window === "undefined") return false;
    const q = new URLSearchParams(window.location.search);
    return q.get("dono") === "1" || q.get("owner") === "1";
  });

  const [tags, setTags] = useState(true);       // anotações visíveis?
  const [panel, setPanel] = useState(false);
  const [tab, setTab] = useState("system");     // system | cockpit | list
  const [sel, setSel] = useState(() => new Set());
  const [boxes, setBoxes] = useState([]);
  const [copied, setCopied] = useState(false);
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.innerWidth >= 900);
  const targets = useRef([]);
  const raf = useRef(0);
  const panelRef = useRef(null);

  const calm = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );

  // A fita ocupa o topo de verdade: empurro o body pra baixo em vez de sobrepor,
  // senão ela cobre o header do cliente — e o dono julga o site por ele.
  useEffect(() => {
    if (!on) return;
    const prev = document.body.style.paddingTop;
    document.body.style.paddingTop = "40px";
    return () => { document.body.style.paddingTop = prev; };
  }, [on]);

  // Varredura dos CTAs reais. Primeiro seletor que casa vence (Set de dedupe).
  const scan = useCallback(() => {
    const seen = new Set();
    const found = [];
    XRAY.forEach(([sel_, leg, name, live, price]) => {
      document.querySelectorAll(sel_).forEach((el) => {
        if (seen.has(el) || el.closest("[data-dono]")) return;
        seen.add(el);
        found.push({ el, leg, name, live, price, id: `${name}-${found.length}` });
      });
    });
    targets.current = found;
  }, []);

  // Medição em rAF: scroll e resize só AGENDAM, nunca calculam — etiqueta que
  // recalcula no evento cru trava o scroll no celular do dono.
  const measure = useCallback(() => {
    const H = window.innerHeight, W = window.innerWidth;
    setBoxes(targets.current.map((t) => {
      const r = t.el.getBoundingClientRect();
      // A etiqueta NUNCA pode cobrir o botão que ela explica (o Luis viu o telefone
      // sumir atrás dela): fica ACIMA com folga; se não couber, vai pra BAIXO.
      // Ancorar sem MEDIR a etiqueta: acima usa translateY(-100%), então a altura
      // real dela nunca importa e ela jamais cobre o botão que explica.
      const GAP = 12;
      const acima = r.top > 108;
      return {
        ...t,
        vis: r.width > 0 && r.bottom > 56 && r.top < H - 8,
        acima,
        top: acima ? r.top - GAP : Math.min(r.bottom + GAP, H - 44),
        left: Math.max(10, Math.min(r.left, W - 394)),
      };
    }));
  }, []);

  const schedule = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(measure);
  }, [measure]);

  // A posição muda quando a fonte de display carrega e quando o vídeo/fotos entram:
  // sem re-medir, a etiqueta fica onde o botão ESTAVA.
  useEffect(() => {
    const t1 = setTimeout(() => schedule(), 400);
    const t2 = setTimeout(() => schedule(), 1600);
    if (document.fonts?.ready) document.fonts.ready.then(() => schedule()).catch(() => {});
    window.addEventListener("load", schedule);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener("load", schedule); };
  }, [schedule]);


  useEffect(() => {
    if (!on) return;
    scan(); schedule();
    const onResize = () => { setWide(window.innerWidth >= 900); scan(); schedule(); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", onResize);
      ro.disconnect();
    };
  }, [on, scan, schedule]);

  useEffect(() => {
    if (!panel) return;
    const onKey = (e) => e.key === "Escape" && setPanel(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panel]);

  const picked = useMemo(() => {
    const out = [];
    CATALOG.forEach(([leg, , mods]) => mods.forEach((m) => {
      const key = `${leg}:${m[0]}`;
      if (sel.has(key)) out.push({ leg, name: m[0], price: m[2] });
    }));
    return out;
  }, [sel]);
  const monthly = picked.reduce((s, p) => s + p.price, 0);

  const share = () => {
    const url = window.location.href;
    navigator.clipboard?.writeText(url).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1800); },
      () => window.prompt("Copy this link", url)
    );
  };

  const wa = waLink(
    `Hi Guileo! This is ${business}. From the owner view of our upgraded site I want: ` +
    `Website Upgrade ($500 one-time)${picked.length ? " + " + picked.map((p) => `${p.name} (${p.leg})`).join(", ") : ""}` +
    `${monthly ? ` — ${money(monthly)}/month` : ""}${upgradeUrl ? ` · ${upgradeUrl}` : ""}`
  );

  if (!on) return null;

  const toggle = (k) => setSel((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const trans = calm ? "none" : "transform .18s cubic-bezier(.22,1,.36,1), opacity .18s";
  const allTags = [...ALWAYS.map(([leg, name, live, price, note]) => ({ leg, name, live, price, note })),
                   ...targets.current.map((t) => ({ leg: t.leg, name: t.name, live: t.live, price: t.price }))];

  return (
    <div data-dono="1">
      <style>{`
        .dm-mat{position:relative;isolation:isolate;background:${surface};
          border:1px solid ${accent}33;
          box-shadow:inset 0 1px 0 rgba(255,255,255,.10),inset 0 -1px 0 rgba(0,0,0,.34),0 34px 80px -34px rgba(0,0,0,.9)}
        .dm-mat::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:1;
          mix-blend-mode:screen;
          background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.015) 16%,transparent 38%),
                     radial-gradient(120% 70% at 82% -12%,rgba(255,255,255,.06),transparent 55%)}
        .dm-mat::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:1;opacity:.35;
          mix-blend-mode:soft-light;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
        .dm-in{position:relative;z-index:2}
        .dm-f:focus-visible{outline:2px solid ${accent};outline-offset:2px;border-radius:999px}
        @media (prefers-reduced-motion: reduce){.dm-tag{transition:none!important}}
      `}</style>

      {/* ── FITA: identifica a visão e nunca some — o dono precisa saber que o
             que ele vê não é o que o cliente dele vê. z abaixo da camada de IA. */}
      <div className="dm-mat fixed inset-x-0 top-0 flex h-10 items-center gap-2 px-3 font-sans sm:px-4"
        style={{ zIndex: 35, borderRadius: 0, borderWidth: "0 0 1px 0" }}>
        <div className="dm-in flex w-full items-center gap-2">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full"
            style={{ background: `${accent}22`, border: `1px solid ${accent}55` }}>{mascot}</span>
          <span className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-white">
            Owner view <span className="text-white/45">· what runs behind this page</span>
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <button onClick={() => setTags((v) => !v)} aria-pressed={tags}
              className="dm-f flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold text-white/80 transition hover:text-white"
              style={{ background: "rgba(255,255,255,.06)" }}>
              <span className="relative inline-block h-3.5 w-6 rounded-full"
                style={{ background: tags ? accent : "rgba(255,255,255,.22)" }}>
                <span className="absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white"
                  style={{ left: tags ? 13 : 2, transition: trans }} />
              </span>
              <span className="hidden sm:inline">Annotations</span>
            </button>
            <button onClick={share} className="dm-f flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold text-white/80 transition hover:text-white"
              style={{ background: "rgba(255,255,255,.06)" }}>
              {IconLink}<span className="hidden sm:inline">{copied ? "Copied" : "Share this view"}</span>
            </button>
            <button onClick={() => setPanel(true)}
              className="dm-f flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-black text-white transition hover:brightness-110"
              style={{ background: accent }}>{IconGrid}<span>The system</span></button>
          </span>
        </div>
      </div>

      {/* ── ETIQUETAS: camada por cima, sem capturar clique (o dono tem que poder
             usar o site de verdade). Some abaixo de 900px — lá vale a lista. */}
      {tags && wide && (
        <div className="pointer-events-none fixed inset-0 font-sans" style={{ zIndex: 34 }}>
          {boxes.filter((b) => b.vis).map((b) => (
            <div key={b.id} className="dm-tag absolute flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5"
              style={{
                top: b.top, left: b.left, transition: trans,
                transform: b.acima ? "translateY(-100%)" : "none",
                maxWidth: "min(384px, 94vw)",
                background: surface, border: `1px solid ${accent}44`,
                boxShadow: "0 14px 30px -16px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.10)",
              }}>
              <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[8.5px] font-black tracking-[0.1em]"
                style={{ color: LEG_HUE[b.leg], background: `${LEG_HUE[b.leg]}1f` }}>{b.leg}</span>
              <span className="text-[11px] font-bold text-white">{b.name}</span>
              <span className="shrink-0 text-[9.5px] font-semibold" style={{ color: b.live ? "#8be27a" : "rgba(255,255,255,.45)" }}>
                {b.live ? "LIVE in this build" : `Can be switched on · ${money(b.price)}/mo`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── PAINEL: o cardápio das 3 pernas + o cockpit de amostra. */}
      {panel && (
        <div className="fixed inset-0 flex items-end justify-center p-3 font-sans sm:items-center" style={{ zIndex: 36 }}>
          <button aria-label="Close" onClick={() => setPanel(false)}
            className="absolute inset-0 cursor-default" style={{ background: "rgba(0,0,0,.55)" }} />
          <div ref={panelRef} role="dialog" aria-modal="true" aria-label="The system behind this page"
            className="dm-mat relative w-[min(96vw,40rem)] max-h-[86vh] overflow-hidden rounded-[28px]">
            <div className="dm-in flex max-h-[86vh] flex-col">

              <div className="flex items-center gap-2.5 px-5 pt-4">
                <span className="grid h-8 w-8 place-items-center rounded-full"
                  style={{ background: `${accent}1f`, border: `1px solid ${accent}55` }}>{mascot}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-black text-white">{business} · the system</span>
                  <span className="block text-[10.5px] text-white/45">$500 one-time for the site + modules by the month</span>
                </span>
                <button onClick={() => setPanel(false)} aria-label="Close"
                  className="dm-f ml-auto grid h-7 w-7 place-items-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white">
                  {IconClose}
                </button>
              </div>

              <div className="flex gap-1.5 px-5 pt-3">
                {[["system", "The menu"], ["cockpit", "Sample cockpit"], ["list", "On this page"]].map(([k, t]) => (
                  <button key={k} onClick={() => setTab(k)}
                    className="dm-f rounded-full px-3 py-1.5 text-[11px] font-bold transition"
                    style={tab === k ? { background: accent, color: "#fff" } : { background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.62)" }}>
                    {t}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-3 pt-3">
                {tab === "system" && CATALOG.map(([leg, line, mods]) => (
                  <div key={leg} className="mb-4">
                    <div className="mb-2 flex items-baseline gap-2">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-black tracking-[0.12em]"
                        style={{ color: LEG_HUE[leg], background: `${LEG_HUE[leg]}1f` }}>{leg}</span>
                      <span className="text-[10.5px] text-white/40">{line}</span>
                    </div>
                    <div className="space-y-1.5">
                      {mods.map(([name, one, price, note]) => {
                        const key = `${leg}:${name}`, active = sel.has(key), fixed = price === 0;
                        return (
                          <button key={key} onClick={() => !fixed && toggle(key)} disabled={fixed}
                            className="dm-f flex w-full items-start gap-2.5 rounded-2xl border px-3 py-2 text-left transition"
                            style={active
                              ? { borderColor: `${accent}88`, background: `${accent}1a` }
                              : { borderColor: "rgba(255,255,255,.10)", background: "rgba(255,255,255,.03)" }}>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[12.5px] font-bold leading-tight text-white">{name}</span>
                              <span className="block text-[10.5px] leading-snug text-white/50">{one}</span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className="block text-[11.5px] font-black" style={{ color: fixed ? "rgba(255,255,255,.55)" : accent }}>
                                {note || (fixed ? "quoted per campaign" : `${money(price)}/mo`)}
                              </span>
                              {!fixed && (
                                <span className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full border text-white"
                                  style={active ? { background: accent, borderColor: accent } : { borderColor: "rgba(255,255,255,.25)", color: "transparent" }}>
                                  {IconCheck}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {tab === "cockpit" && (
                  <div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[["Calls answered", "148"], ["Leads captured", "63"], ["Quotes sent", "41"], ["Jobs booked", "27"]].map(([k, v]) => (
                        <div key={k} className="rounded-2xl border px-3 py-3"
                          style={{ borderColor: `${accent}33`, background: `${accent}12` }}>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-[22px] font-black leading-none text-white">{v}</span>
                            <span className="rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] text-white/70"
                              style={{ background: "rgba(255,255,255,.12)" }}>sample</span>
                          </div>
                          <div className="mt-1.5 text-[10.5px] text-white/50">{k}</div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 rounded-2xl border px-3 py-2.5 text-[11px] leading-relaxed text-white/60"
                      style={{ borderColor: "rgba(255,255,255,.10)", background: "rgba(255,255,255,.03)" }}>
                      Numbers shown are a sample of what this page would capture — your real numbers appear here once it's live.
                    </p>
                    <div className="mt-2.5 space-y-1.5">
                      {[["Every call, transcribed and scored", "BRAIN"], ["Every lead with its source and next step", "BUILD"], ["Every campaign with cost per booked job", "AD"]].map(([t, leg]) => (
                        <div key={t} className="flex items-center gap-2 rounded-2xl border px-3 py-2"
                          style={{ borderColor: "rgba(255,255,255,.10)", background: "rgba(255,255,255,.03)" }}>
                          <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-black tracking-[0.1em]"
                            style={{ color: LEG_HUE[leg], background: `${LEG_HUE[leg]}1f` }}>{leg}</span>
                          <span className="text-[11.5px] text-white/70">{t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {tab === "list" && (
                  <div className="space-y-1.5">
                    {allTags.map((b, i) => (
                      <div key={`${b.name}-${i}`} className="flex items-center gap-2 rounded-2xl border px-3 py-2"
                        style={{ borderColor: "rgba(255,255,255,.10)", background: "rgba(255,255,255,.03)" }}>
                        <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[8.5px] font-black tracking-[0.1em]"
                          style={{ color: LEG_HUE[b.leg], background: `${LEG_HUE[b.leg]}1f` }}>{b.leg}</span>
                        <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold text-white">{b.name}</span>
                        <span className="shrink-0 text-[10px]" style={{ color: b.live ? "#8be27a" : "rgba(255,255,255,.45)" }}>
                          {b.note || (b.live ? "LIVE in this build" : `Can be switched on · ${money(b.price)}/mo`)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t px-5 py-3" style={{ borderColor: "rgba(255,255,255,.08)" }}>
                <div className="text-[12.5px] text-white/60">
                  <b className="text-white">{money(ONE_TIME)} one-time</b> + <b style={{ color: accent }}>{money(monthly)}/month</b>
                  <span className="text-white/35"> · {picked.length} module{picked.length === 1 ? "" : "s"}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href={wa} target="_blank" rel="noreferrer"
                    className="dm-f flex-1 rounded-full px-3 py-2.5 text-center text-[12.5px] font-black text-white transition hover:brightness-110"
                    style={{ background: accent }}>Send my selection →</a>
                  <a href="https://cal.com/guileo" target="_blank" rel="noreferrer"
                    className="dm-f rounded-full border px-4 py-2.5 text-center text-[12.5px] font-bold text-white/80 transition hover:text-white"
                    style={{ borderColor: "rgba(255,255,255,.16)", background: "rgba(255,255,255,.04)" }}>Book a 20-min call</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
