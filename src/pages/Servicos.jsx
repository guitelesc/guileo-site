import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import VoiceAgent from "../components/VoiceAgent";
import { Reveal } from "../lib/ui.jsx";
import { CATS } from "../data/services";
import { waLink } from "../data/contact.js";
import LeadForm from "../components/LeadForm.jsx";
import { useLang } from "../i18n.jsx";

const isOngoing = (t) => t === "mensal" || t === "projeto+mensal";
const typeLabel = { projeto: "One-time", mensal: "Ongoing", "projeto+mensal": "Project + Ongoing" };

export default function Servicos() {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [open, setOpen] = useState(null);

  const cats = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return CATS.map((c) => ({
      ...c,
      items: c.items.filter((it) => {
        const mt =
          type === "all" ||
          (type === "once" && it.type === "projeto") ||
          (type === "ongoing" && isOngoing(it.type));
        const ms = !ql || (it.name + it.desc + c.cat).toLowerCase().includes(ql);
        return mt && ms;
      }),
    })).filter((c) => c.items.length > 0);
  }, [q, type]);

  const totalShown = cats.reduce((n, c) => n + c.items.length, 0);
  const totalAll = CATS.reduce((n, c) => n + c.items.length, 0);
  const wa = (cat) => waLink(`Hi Guileo! I'd like a quote for: ${cat}`);

  return (
    <div className="min-h-screen text-g-ink">
      <Navbar />

      {/* Header */}
      <header className="pt-28 pb-8 bg-white/[0.05] backdrop-blur-md border-b border-g-line">
        <div className="wrap">
          <span className="eyebrow mb-3">What we build for you</span>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-g-word">Everything your business needs, in one place</h1>
          <p className="mt-3 text-g-muted max-w-2xl">
            {totalAll} services, grouped by area — find what you need in seconds. No price tags: a real human quotes exactly what fits your business.
          </p>
          {/* Search */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="🔍  Search any service — “Shopify”, “voice”, “ads”…"
              className="flex-1 rounded-full border border-g-line bg-white/[0.035] px-5 py-3 text-sm text-g-word placeholder:text-g-muted outline-none focus:border-g-green"
            />
            <div className="flex gap-2">
              {[["all", "All"], ["once", "One-time"], ["ongoing", "Ongoing"]].map(([k, l]) => (
                <button key={k} onClick={() => setType(k)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold border transition ${type === k ? "bg-g-green text-white border-g-green" : "bg-white/[0.05] backdrop-blur-md text-g-muted border-g-line hover:border-g-green"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 text-sm text-g-muted">{totalShown} services across {cats.length} areas</div>
        </div>
      </header>

      {/* Category grid */}
      <div className="wrap py-10">
        {cats.length === 0 && <div className="text-center py-20 text-g-muted">No match — try another word.</div>}
        <div className="grid md:grid-cols-2 gap-6">
          {cats.map((c) => (
            <Reveal key={c.cat}>
              <div className="rounded-xl3 bg-white/[0.05] backdrop-blur-md border border-g-line shadow-soft overflow-hidden h-full flex flex-col" style={{ borderTop: `4px solid ${c.color}` }}>
                <div className="p-6 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{c.icon}</span>
                    <div>
                      <h2 className="text-lg font-extrabold text-g-word">{c.cat}</h2>
                      <div className="text-xs text-g-muted">{c.items.length} services</div>
                    </div>
                  </div>
                </div>
                {/* services list */}
                <div className="px-6 flex-1">
                  <div className="divide-y divide-g-line">
                    {c.items.map((it) => {
                      const id = c.cat + it.name;
                      const isOpen = open === id;
                      return (
                        <div key={id} className="py-2.5">
                          <button onClick={() => setOpen(isOpen ? null : id)} className="w-full text-left flex items-start justify-between gap-3 group">
                            <div>
                              <div className="font-semibold text-g-word text-sm group-hover:text-g-green transition">{it.name}</div>
                              <div className="text-xs text-g-muted leading-relaxed">{it.desc}</div>
                            </div>
                            <span className="shrink-0 mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: c.color + "1A", color: c.color }}>{typeLabel[it.type]}</span>
                          </button>
                          <AnimatePresence>
                            {isOpen && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="mt-2 rounded-lg bg-white/[0.035] p-3 text-xs text-g-muted" style={{ borderLeft: `3px solid ${c.color}` }}>
                                  <span className="font-bold text-g-word">📦 What we'll need from you:</span> {it.deliver}
                                  <a href={wa(it.name)} className="mt-2 inline-flex items-center gap-1 font-bold text-g-green hover:underline">Request this →</a>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* category CTA */}
                <div className="p-6 pt-4">
                  <a href={wa(c.cat)} className="btn w-full text-sm" style={{ background: c.color }}>Get a quote for {c.cat} →</a>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* site-wide CTA + lead capture */}
        <div id="contact" className="mt-12 scroll-mt-24 rounded-xl3 bg-white/[0.03] backdrop-blur-xl border border-white/10 p-8 sm:p-12 shadow-lift relative overflow-hidden">
          <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-g-green/15 blur-3xl animate-aurora pointer-events-none" />
          <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-g-gold/15 blur-3xl animate-aurora pointer-events-none" style={{ animationDelay: "-6s" }} />
          <div className="relative max-w-2xl mx-auto">
            <div className="text-center">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-g-word">Not sure what you need?</h3>
              <p className="mt-2 text-g-gold font-bold">{t.more.lead.title}</p>
              <p className="mt-2 text-sm text-g-muted">Tell us your goal — a real human designs the right mix and quotes it. No generic packages.</p>
            </div>
            <div className="mt-7"><LeadForm source="services-page" /></div>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <a href={wa("a custom plan for my business")} target="_blank" rel="noopener" className="btn-ghost text-sm">💬 Talk on WhatsApp</a>
              <a href="/#pricing" className="btn-ghost text-sm">See how it works →</a>
            </div>
          </div>
        </div>
      </div>

      <Footer />
      <VoiceAgent />
    </div>
  );
}
