import {
  FaInstagram, FaFacebook, FaLinkedin, FaXTwitter, FaTiktok, FaYoutube,
  FaTelegram, FaWhatsapp, FaThreads, FaPinterest, FaGoogle, FaSnapchat,
} from "react-icons/fa6";
import { Reveal, Stagger, Item } from "../lib/ui.jsx";

const CH = [
  [FaWhatsapp, "WhatsApp", "#25D366"],
  [FaInstagram, "Instagram", "#E4405F"],
  [FaFacebook, "Facebook", "#1877F2"],
  [FaTiktok, "TikTok", "#111111"],
  [FaLinkedin, "LinkedIn", "#0A66C2"],
  [FaYoutube, "YouTube", "#FF0000"],
  [FaTelegram, "Telegram", "#26A5E4"],
  [FaXTwitter, "X", "#111111"],
  [FaThreads, "Threads", "#111111"],
  [FaPinterest, "Pinterest", "#BD081C"],
  [FaGoogle, "Google", "#4285F4"],
  [FaSnapchat, "Snapchat", "#E0B000"],
];

export default function Channels({ t }) {
  return (
    <section className="py-14 bg-white/[0.05] backdrop-blur-md border-y border-g-line">
      <div className="wrap">
        <Reveal className="text-center max-w-2xl mx-auto mb-9">
          <span className="eyebrow mb-3">{t.channels.eyebrow}</span>
          <h2 className="h2">{t.channels.h2}</h2>
          <p className="mt-3 text-g-muted">{t.channels.sub}</p>
        </Reveal>
        <Stagger className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4" gap={0.05} amount={0.15}>
          {CH.map(([Icon, name, color]) => (
            <Item key={name} variant="scale">
              <div className="group flex flex-col items-center justify-center gap-2 rounded-xl2 border border-g-line bg-white/[0.035] p-5 hover:bg-white/[0.06] backdrop-blur-md hover:-translate-y-1.5 hover:border-white/20 transition-all duration-300">
                <span className="grid place-items-center h-12 w-12 rounded-full bg-white/[0.06] backdrop-blur-md shadow-soft transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" style={{ color }}>
                  <Icon size={26} />
                </span>
                <span className="text-sm font-semibold text-g-word">{name}</span>
              </div>
            </Item>
          ))}
        </Stagger>
        <p className="text-center text-sm text-g-muted mt-8">One brain, every platform — content created, scheduled & optimized for you, always on.</p>
      </div>
    </section>
  );
}
