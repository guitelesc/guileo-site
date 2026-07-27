import { FaPhone, FaWhatsapp, FaInstagram, FaFacebookMessenger, FaCommentSms, FaEnvelope, FaGoogle } from "react-icons/fa6";
import { useLang } from "../i18n.jsx";
import { Reveal } from "../lib/ui.jsx";

// ChannelsStrip — the FOLDED reach section: a single slim logo strip that replaced the old full
// ChannelsV2 phone mockup (audit: 4 phone mockups on one page diluted the hero + live demo).
// One line: "one brain, every channel" + a quiet row of brand-tinted channel chips. No animation
// loops, no phone — Faena restraint. Locked cement + signal system; landing-scoped only.

const COPY = {
  en: { eye: "One brain · every channel", h: "The same Gui answers everywhere your customers are.", sub: "Voice, WhatsApp, Instagram, Messenger, SMS, email — one memory across all of them." },
  pt: { eye: "Um cérebro · todo canal", h: "A mesma Gui atende onde quer que seus clientes estejam.", sub: "Voz, WhatsApp, Instagram, Messenger, SMS, e-mail — uma memória só em todos." },
  es: { eye: "Un cerebro · cada canal", h: "La misma Gui responde donde estén tus clientes.", sub: "Voz, WhatsApp, Instagram, Messenger, SMS, email — una memoria en todos." },
  hi: { eye: "एक दिमाग़ · हर चैनल", h: "वही Gui हर जगह जवाब देती है जहाँ आपके ग्राहक हैं।", sub: "वॉइस, WhatsApp, Instagram, Messenger, SMS, ईमेल — सबमें एक याददाश्त।" },
};

const CH = [
  { Icon: FaPhone, c: "#FF8A33", n: "Voice" },
  { Icon: FaWhatsapp, c: "#25D366", n: "WhatsApp" },
  { Icon: FaInstagram, c: "#E4405F", n: "Instagram" },
  { Icon: FaFacebookMessenger, c: "#0084FF", n: "Messenger" },
  { Icon: FaCommentSms, c: "#7C9CF6", n: "SMS" },
  { Icon: FaEnvelope, c: "#D6C29A", n: "Email" },
  { Icon: FaGoogle, c: "#4285F4", n: "Google" },
];

export default function ChannelsStrip() {
  const { lang } = useLang();
  const t = COPY[lang] || COPY.en;
  return (
    <section className="relative px-5 py-14">
      <Reveal className="mx-auto max-w-3xl text-center">
        <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{t.eye}</div>
        <h2 className="mt-3 font-black leading-[1.05] tracking-tight text-g-word" style={{ fontSize: "clamp(1.4rem,3vw,2.1rem)" }}>{t.h}</h2>
        <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-g-ink">{t.sub}</p>
      </Reveal>

      {/* the quiet row — brand-tinted chips, no motion loop; a gentle staggered reveal only */}
      <Reveal className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-3">
        {CH.map(({ Icon, c, n }) => (
          <span key={n} title={n} className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 backdrop-blur transition-colors hover:border-white/20"
            style={{ boxShadow: "0 10px 30px -22px rgba(0,0,0,0.9)" }}>
            <span className="grid h-6 w-6 place-items-center rounded-full text-[13px]" style={{ color: c, background: `${c}1f`, boxShadow: `inset 0 0 0 1px ${c}44` }}><Icon /></span>
            <span className="text-[12.5px] font-semibold text-g-light">{n}</span>
          </span>
        ))}
      </Reveal>
    </section>
  );
}
