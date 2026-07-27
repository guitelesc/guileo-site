import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { SELLER_PLAYS, playOfTheDay } from "../data/sellerPlays.js";

// ── "Jogadas do dia" — the seller's infinite-inspiration bench inside /vendedor ────────────────
// A daily hunting move, not generic advice. Top of the tab: the JOGADA DO DIA (picked
// deterministically from the calendar day so it's the same all day for the whole team and rotates
// on its own tomorrow), highlighted in Gui orange. Below: channel + market filter chips and the
// full library of 30 plays as compact expandable cards, each with a "did it today" toggle that
// feeds a localStorage habit counter (resets daily). Honest motivational footer — no fake metrics,
// just the arithmetic of consistency. Design follows the hub: cement + Gui signals.

const IDEAS_TXT = {
  pt: {
    title: "Jogadas do dia",
    sub: "Inspiração infinita pra vender. Cada jogada é um movimento real de campo — onde chegar, a que horas, exatamente o que falar. Uma por dia já muda o mês.",
    todayEyebrow: "Jogada do dia",
    todayHint: "Gira sozinha amanhã. Faz essa hoje.",
    steps: "Como fazer",
    markDone: "✓ Fiz hoje",
    doneToday: "Feita hoje ✓",
    counterLabel: "jogadas feitas hoje",
    filterChannel: "Canal",
    filterMarket: "Mercado",
    all: "Todas",
    library: "Biblioteca de jogadas",
    libSub: "As 30 completas. Toque pra abrir os passos.",
    expand: "ver passos",
    collapse: "fechar",
    footer: "1 jogada por dia = ~20 conversas novas por mês. Não é sorte, é constância.",
    channels: { porta: "Porta a porta", telefone: "Telefone", whatsapp: "WhatsApp", instagram: "Instagram", email: "E-mail", evento: "Evento" },
    markets: { us: "🇺🇸 EUA", br: "🇧🇷 Brasil" },
  },
  en: {
    title: "Plays of the day",
    sub: "Infinite selling inspiration. Every play is a real field move — where to show up, what time, exactly what to say. One a day already changes the month.",
    todayEyebrow: "Play of the day",
    todayHint: "Rotates on its own tomorrow. Run this one today.",
    steps: "How to run it",
    markDone: "✓ Did it today",
    doneToday: "Done today ✓",
    counterLabel: "plays done today",
    filterChannel: "Channel",
    filterMarket: "Market",
    all: "All",
    library: "Play library",
    libSub: "All 30. Tap to open the steps.",
    expand: "see steps",
    collapse: "close",
    footer: "1 play a day = ~20 new conversations a month. Not luck, consistency.",
    channels: { porta: "Door-to-door", telefone: "Phone", whatsapp: "WhatsApp", instagram: "Instagram", email: "Email", evento: "Event" },
    markets: { us: "🇺🇸 USA", br: "🇧🇷 Brazil" },
  },
  es: {
    title: "Jugadas del día",
    sub: "Inspiración infinita para vender. Cada jugada es un movimiento real de campo — dónde llegar, a qué hora, exactamente qué decir. Una por día ya cambia el mes.",
    todayEyebrow: "Jugada del día",
    todayHint: "Gira sola mañana. Haz esta hoy.",
    steps: "Cómo hacerla",
    markDone: "✓ La hice hoy",
    doneToday: "Hecha hoy ✓",
    counterLabel: "jugadas hechas hoy",
    filterChannel: "Canal",
    filterMarket: "Mercado",
    all: "Todas",
    library: "Biblioteca de jugadas",
    libSub: "Las 30 completas. Toca para abrir los pasos.",
    expand: "ver pasos",
    collapse: "cerrar",
    footer: "1 jugada por día = ~20 conversaciones nuevas al mes. No es suerte, es constancia.",
    channels: { porta: "Puerta a puerta", telefone: "Teléfono", whatsapp: "WhatsApp", instagram: "Instagram", email: "Correo", evento: "Evento" },
    markets: { us: "🇺🇸 EE.UU.", br: "🇧🇷 Brasil" },
  },
};
IDEAS_TXT.hi = { ...IDEAS_TXT.en, title: "आज की जुगत", todayEyebrow: "आज की जुगत", markDone: "✓ आज किया", doneToday: "आज हो गया ✓", library: "जुगत लाइब्रेरी" };

// Content (title/how) carries pt/en/es; Hindi UI falls back to en content per the micro-dict law.
const contentLang = (lang) => (lang === "pt" || lang === "es" ? lang : "en");

// localStorage key scoped to the calendar day → the habit counter resets on its own each morning.
const dayKey = () => `guileo_plays_done_${new Date().toISOString().slice(0, 10)}`;

export default function SellerIdeas({ lang = "pt", seller }) {
  const t = IDEAS_TXT[lang] || IDEAS_TXT.pt;
  const cl = contentLang(lang);
  const today = playOfTheDay();

  const [channel, setChannel] = useState("all"); // 'all' | one of PLAY_CHANNELS
  const [market, setMarket] = useState("all");   // 'all' | 'us' | 'br'
  const [openId, setOpenId] = useState(today.id); // expanded card in the library
  const [done, setDone] = useState([]);           // ids marked done today (from localStorage)

  useEffect(() => {
    try { setDone(JSON.parse(localStorage.getItem(dayKey()) || "[]") || []); } catch { /* private mode */ }
  }, []);

  const toggleDone = (id) => {
    setDone((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem(dayKey(), JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // Market filter: 'both' plays always show; a market chip also keeps 'both' (they fit everywhere).
  const list = useMemo(() => SELLER_PLAYS.filter((p) => {
    if (channel !== "all" && p.channel !== channel) return false;
    if (market !== "all" && p.where !== market && p.where !== "both") return false;
    return true;
  }), [channel, market]);

  const doneCount = done.length;

  // Which channels/markets actually appear — build filter chips from the data, not a guess.
  const channelKeys = useMemo(() => [...new Set(SELLER_PLAYS.map((p) => p.channel))], []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-g-word">💡 {t.title}</h2>
        <p className="text-[13px] text-g-muted mt-1 max-w-2xl">{t.sub}</p>
      </div>

      {/* ── JOGADA DO DIA — Gui-orange hero ─────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-g-gold/40 bg-gradient-to-br from-g-gold/[0.12] to-g-gold/[0.03] p-5 shadow-soft">
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-g-gold/15 text-3xl ring-1 ring-g-gold/30">{today.icon}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-g-gold/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-g-gold ring-1 ring-g-gold/30">🎲 {t.todayEyebrow}</span>
              <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-bold uppercase text-g-muted ring-1 ring-white/10">{t.channels[today.channel]}</span>
              <MarketTag where={today.where} t={t} />
            </div>
            <h3 className="mt-2 text-[17px] font-black leading-tight text-g-word">{today.title[cl]}</h3>
            <ol className="mt-3 space-y-1.5">
              {today.how[cl].map((s, i) => (
                <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-g-word">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-g-gold/15 text-[11px] font-black text-g-gold">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <DoneBtn id={today.id} done={done} toggle={toggleDone} t={t} bright />
              <span className="text-[11.5px] text-g-muted">{t.todayHint}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* habit counter */}
      <div className="flex items-center gap-3 rounded-xl border border-g-green/25 bg-g-green/[0.05] px-4 py-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-g-green/15 ring-1 ring-g-green/30">
          <span className="text-lg font-black text-g-green">{doneCount}</span>
        </div>
        <div className="text-[13px] font-bold text-g-word">🔥 {doneCount} {t.counterLabel}</div>
      </div>

      {/* ── filters ─────────────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div>
          <div className="mb-1.5 text-[10.5px] font-black uppercase tracking-wide text-g-muted">{t.filterChannel}</div>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={channel === "all"} onClick={() => setChannel("all")}>{t.all}</Chip>
            {channelKeys.map((c) => (
              <Chip key={c} active={channel === c} onClick={() => setChannel(c)}>{t.channels[c]}</Chip>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[10.5px] font-black uppercase tracking-wide text-g-muted">{t.filterMarket}</div>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={market === "all"} onClick={() => setMarket("all")}>{t.all}</Chip>
            <Chip active={market === "us"} onClick={() => setMarket("us")}>{t.markets.us}</Chip>
            <Chip active={market === "br"} onClick={() => setMarket("br")}>{t.markets.br}</Chip>
          </div>
        </div>
      </div>

      {/* ── library ─────────────────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-black text-g-word">📚 {t.library}</h3>
        <p className="text-[12.5px] text-g-muted mt-0.5">{t.libSub}</p>
      </div>

      <div className="space-y-2">
        {list.map((p) => {
          const isOpen = openId === p.id;
          const isDone = done.includes(p.id);
          return (
            <div key={p.id} className={`rounded-xl border transition ${isDone ? "border-g-green/30 bg-g-green/[0.04]" : "border-white/10 bg-white/[0.03]"}`}>
              <button onClick={() => setOpenId(isOpen ? null : p.id)} className="flex w-full items-center gap-3 p-3.5 text-left">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-xl ring-1 ring-white/10">{p.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[15px] font-black text-g-word">
                    {isDone && <span className="text-g-green">✓</span>}
                    <span className="truncate">{p.title[cl]}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[9.5px] font-bold uppercase text-g-muted ring-1 ring-white/10">{t.channels[p.channel]}</span>
                    <MarketTag where={p.where} t={t} />
                  </div>
                </div>
                <span className="shrink-0 text-[11px] font-bold text-g-muted">{isOpen ? t.collapse : t.expand} {isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden px-3.5 pb-3.5">
                  <div className="rounded-xl border border-white/10 bg-[#0d0c0a]/40 p-3.5">
                    <div className="text-[10px] font-black uppercase tracking-wider text-g-gold">{t.steps}</div>
                    <ol className="mt-2 space-y-1.5">
                      {p.how[cl].map((s, i) => (
                        <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-g-word">
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-g-green/15 text-[11px] font-black text-g-green">{i + 1}</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-3">
                      <DoneBtn id={p.id} done={done} toggle={toggleDone} t={t} />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {/* honest motivational footer */}
      <div className="rounded-2xl border border-g-green/25 bg-g-green/[0.05] p-5 text-center">
        <p className="text-[14px] font-extrabold text-g-word">🌱 {t.footer}</p>
      </div>
    </div>
  );
}

// Small market badge — 🇺🇸 / 🇧🇷 / both (shows both flags).
function MarketTag({ where, t }) {
  const label = where === "both" ? `${t.markets.us} · ${t.markets.br}` : t.markets[where];
  return <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[9.5px] font-bold uppercase text-g-muted ring-1 ring-white/10">{label}</span>;
}

// Filter chip — active state uses the Gui-green ring like the sibling components in the hub.
function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${active ? "bg-g-green/15 text-g-word ring-1 ring-g-green/40" : "bg-white/[0.04] text-g-muted ring-1 ring-white/10 hover:text-g-word"}`}>
      {children}
    </button>
  );
}

// "Did it today" toggle — flips a localStorage-backed done state; bright variant for the hero.
function DoneBtn({ id, done, toggle, t, bright }) {
  const isDone = done.includes(id);
  if (isDone) {
    return (
      <button onClick={() => toggle(id)} className="inline-flex items-center gap-1.5 rounded-full bg-g-green/15 px-4 py-2 text-[13px] font-extrabold text-g-green ring-1 ring-g-green/40">
        {t.doneToday}
      </button>
    );
  }
  return (
    <button onClick={() => toggle(id)} className={bright ? "btn-bright text-[13px]" : "btn-ghost text-[12.5px]"}>
      {t.markDone}
    </button>
  );
}
