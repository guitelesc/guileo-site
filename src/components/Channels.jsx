import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaInstagram, FaFacebook, FaLinkedin, FaXTwitter, FaTiktok, FaYoutube,
  FaTelegram, FaWhatsapp, FaThreads, FaPinterest, FaGoogle, FaSnapchat,
} from "react-icons/fa6";
import { Reveal } from "../lib/ui.jsx";

const CH = [
  [FaWhatsapp, "WhatsApp", "#25D366"], [FaInstagram, "Instagram", "#E4405F"],
  [FaFacebook, "Facebook", "#1877F2"], [FaTiktok, "TikTok", "#fff"],
  [FaLinkedin, "LinkedIn", "#0A66C2"], [FaYoutube, "YouTube", "#FF0000"],
  [FaTelegram, "Telegram", "#26A5E4"], [FaXTwitter, "X", "#fff"],
  [FaThreads, "Threads", "#fff"], [FaPinterest, "Pinterest", "#BD081C"],
  [FaGoogle, "Google", "#4285F4"], [FaSnapchat, "Snapchat", "#E0B000"],
];

// Live automation demo feed (shown on the "screen")
const DEMOS = [
  ["📸", "Instagram", "AI replied to a DM and closed a $240 sale", "now"],
  ["💬", "WhatsApp", "Booked an appointment — Saturday 3:00 PM", "1m"],
  ["💼", "LinkedIn", "Posted an article · 1,240 views · 18 leads", "4m"],
  ["🛒", "Shopify", "AI chat recovered an abandoned cart", "7m"],
  ["⭐", "Google", "Asked a happy client for a 5★ review", "11m"],
  ["📞", "Phone", "Answered a call & qualified a hot lead", "14m"],
];

export default function Channels({ t }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((x) => x + 1), 2400); return () => clearInterval(id); }, []);
  const ordered = DEMOS.map((_, i) => DEMOS[(i + tick) % DEMOS.length]).slice(0, 4);

  return (
    <section className="py-14 bg-white/[0.05] backdrop-blur-md border-y border-g-line overflow-hidden">
      <div className="wrap grid lg:grid-cols-2 gap-10 items-center">
        {/* LEFT — channels */}
        <Reveal variant="left">
          <span className="eyebrow mb-3">{t.channels.eyebrow}</span>
          <h2 className="h2">{t.channels.h2}</h2>
          <p className="mt-3 text-g-muted">{t.channels.sub}</p>
          <div className="mt-6 grid grid-cols-4 sm:grid-cols-6 gap-3">
            {CH.map(([Icon, name, color]) => (
              <div key={name} className="group grid place-items-center" title={name}>
                <span className="grid place-items-center h-11 w-11 rounded-full bg-white/[0.06] border border-white/10 shadow-soft transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6" style={{ color }}>
                  <Icon size={20} />
                </span>
              </div>
            ))}
          </div>
        </Reveal>

        {/* RIGHT — live automations screen */}
        <Reveal variant="right">
          <div className="rounded-xl3 border border-white/15 bg-gradient-to-br from-white/[0.10] to-white/[0.04] backdrop-blur-xl shadow-lift overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/[0.03]">
              <span className="h-3 w-3 rounded-full bg-red-400/70" /><span className="h-3 w-3 rounded-full bg-g-gold/70" /><span className="h-3 w-3 rounded-full bg-g-green/70" />
              <span className="ml-2 text-xs font-semibold text-white/50 tracking-wide">guileo · live automations</span>
              <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-bold uppercase text-g-light"><span className="h-1.5 w-1.5 rounded-full bg-g-green animate-pulse" />live</span>
            </div>
            <div className="p-4 space-y-2.5 min-h-[18rem]">
              <AnimatePresence mode="popLayout" initial={false}>
                {ordered.map((d, i) => (
                  <motion.div key={d[1] + (i === 0 ? `-${tick}` : "")} layout
                    initial={i === 0 ? { opacity: 0, y: -14, scale: 0.97 } : false}
                    animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.4 }}
                    className={`flex items-center gap-3 rounded-xl2 border p-3 ${i === 0 ? "border-g-green/40 bg-g-green/[0.08]" : "border-white/10 bg-white/[0.04]"}`}>
                    <span className="grid place-items-center h-9 w-9 rounded-full bg-white/[0.06] text-lg shrink-0">{d[0]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-g-word">{d[1]} <span className="text-g-green">· AI</span></div>
                      <div className="text-[11px] text-g-muted truncate">{d[2]}</div>
                    </div>
                    <span className="text-[10px] text-g-light whitespace-nowrap">{d[3]}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
