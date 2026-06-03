import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaInstagram, FaFacebook, FaLinkedin, FaXTwitter, FaTiktok, FaYoutube,
  FaTelegram, FaWhatsapp, FaThreads, FaPinterest, FaGoogle, FaSnapchat,
  FaWifi, FaBatteryFull,
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

// Live automation demo feed — the AI acting inside each social network (shown on the phone)
const DEMOS = [
  [FaInstagram, "Instagram", "#E4405F", "Replied to a DM and closed a $240 sale", "now"],
  [FaWhatsapp, "WhatsApp", "#25D366", "Booked an appointment — Saturday 3:00 PM", "1m"],
  [FaTiktok, "TikTok", "#f5f5f5", "Posted a clip · 12.4k views overnight", "3m"],
  [FaLinkedin, "LinkedIn", "#0A66C2", "Published an article · 18 new leads", "6m"],
  [FaTelegram, "Telegram", "#26A5E4", "Answered 30 group questions instantly", "9m"],
  [FaFacebook, "Facebook", "#1877F2", "Replied to 24 comments & messages", "12m"],
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

        {/* RIGHT — live automations on a phone (these are social networks → show it on iPhone) */}
        <Reveal variant="right">
          <div className="relative mx-auto w-[290px] sm:w-[310px]">
            {/* ambient glow */}
            <div className="absolute -inset-6 rounded-[4rem] bg-gradient-to-tr from-g-green/15 via-transparent to-g-gold/15 blur-3xl pointer-events-none animate-breathe" />
            {/* phone body */}
            <div className="relative rounded-[3rem] border-[11px] border-[#0a0a0a] bg-[#0a0a0a] shadow-2xl overflow-hidden" style={{ height: "600px" }}>
              {/* dynamic island */}
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 h-6 w-24 rounded-full bg-black z-30 flex items-center justify-end pr-2">
                <span className="h-1.5 w-1.5 rounded-full bg-g-green/70 animate-pulse" />
              </div>
              {/* screen */}
              <div className="relative h-full bg-gradient-to-b from-[#17150f] via-[#121009] to-[#0d0b07] pt-12">
                {/* status bar */}
                <div className="flex items-center justify-between px-7 text-[11px] font-bold text-white/80">
                  <span>9:41</span>
                  <span className="flex items-center gap-1.5">
                    <span className="flex items-end gap-px h-3">{[3,5,7,9].map((h,i)=>(<span key={i} className="w-0.5 rounded-sm bg-white/80" style={{height:`${h}px`}}/>))}</span>
                    <FaWifi size={12} />
                    <FaBatteryFull size={15} className="text-g-green" />
                  </span>
                </div>
                {/* app header */}
                <div className="px-5 mt-5">
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-black uppercase tracking-tight bg-gradient-to-r from-g-green via-g-gold to-g-green bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer">guileo live</div>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-g-green"><span className="h-2 w-2 rounded-full bg-g-green animate-pulse" />on</span>
                  </div>
                  <div className="text-[11px] text-g-muted mt-0.5">Working across your social networks</div>
                </div>
                {/* notification feed */}
                <div className="px-3 mt-4 space-y-2.5">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {ordered.map((d, i) => {
                      const [Icon, name, color, msg, time] = d;
                      return (
                        <motion.div key={name + (i === 0 ? `-${tick}` : "")} layout
                          initial={i === 0 ? { opacity: 0, y: -16, scale: 0.96 } : false}
                          animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: 0.4 }}
                          className={`flex items-center gap-3 rounded-2xl border p-3 backdrop-blur-md ${i === 0 ? "border-g-green/50 bg-g-green/[0.10] shadow-glow" : "border-white/10 bg-white/[0.05]"}`}>
                          <span className="grid place-items-center h-10 w-10 rounded-xl bg-white/[0.08] shrink-0" style={{ color }}>
                            <Icon size={20} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-extrabold text-g-word flex items-center gap-1.5">{name} <span className="text-g-green font-black">· AI</span></div>
                            <div className="text-[11px] text-g-muted leading-snug">{msg}</div>
                          </div>
                          <span className="text-[10px] text-g-light font-bold whitespace-nowrap self-start">{time}</span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
