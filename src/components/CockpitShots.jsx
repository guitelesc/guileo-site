import { useLang } from "../i18n.jsx";
import { Reveal } from "../lib/ui.jsx";

/* ── CockpitShots — "o que você vê todo dia" (2026-09-10) ─────────────────────────────────────
   Três TELAS REAIS do cockpit (public/cockpit/*.jpg, capturadas do /portal em modo demo em
   2026-09-10 — o próprio aviso "sample data" aparece na imagem, de propósito: honesto). A NVIDIA
   mostra o produto; a gente escondia o nosso. Recapturar quando o cockpit mudar. */
const SHOTS = [
  { src: "/cockpit/overview.jpg", t: { en: "Overview — today at a glance", pt: "Visão geral — o hoje num relance", es: "Vista general — el hoy de un vistazo", hi: "ओवरव्यू — आज एक नज़र में" }, d: { en: "Leads, bookings, money and what needs your decision.", pt: "Leads, agendamentos, dinheiro e o que precisa da sua decisão.", es: "Leads, reservas, dinero y lo que necesita tu decisión.", hi: "लीड, बुकिंग, पैसा और आपके फ़ैसले की ज़रूरत।" } },
  { src: "/cockpit/calllogs.jpg", t: { en: "Call Logs — every call, with transcript", pt: "Ligações — todas, com transcrição", es: "Llamadas — todas, con transcripción", hi: "कॉल लॉग — हर कॉल, ट्रांसक्रिप्ट के साथ" }, d: { en: "Who called, what they wanted, what Gui did, how it felt.", pt: "Quem ligou, o que queria, o que a Gui fez, como foi.", es: "Quién llamó, qué quería, qué hizo Gui, cómo fue.", hi: "किसने कॉल किया, क्या चाहा, Gui ने क्या किया।" } },
  { src: "/cockpit/crm.jpg", t: { en: "CRM 360 — customers you own", pt: "CRM 360 — clientes que são seus", es: "CRM 360 — clientes que son tuyos", hi: "CRM 360 — आपके अपने ग्राहक" }, d: { en: "Every contact, every conversation, your own fields — drag, tag, act.", pt: "Todo contato, toda conversa, seus próprios campos — arraste, marque, aja.", es: "Cada contacto, cada conversación, tus propios campos — arrastra, etiqueta, actúa.", hi: "हर संपर्क, हर बातचीत, आपके अपने फ़ील्ड।" } },
];
// `vivo`: o selo sobre cada tela dizia "live" fixo em inglês, em qualquer idioma (lei do idioma).
const COPY = {
  en: { eyebrow: "Your cockpit", h2a: "What you see ", h2b: "every day.", sub: "Not a promise — the actual screens. Sample data shown; yours fills in the day you connect.", vivo: "live" },
  pt: { eyebrow: "Seu cockpit", h2a: "O que você vê ", h2b: "todo dia.", sub: "Não é promessa — são as telas de verdade. Dados de exemplo; os seus entram no dia em que você conecta.", vivo: "ao vivo" },
  es: { eyebrow: "Tu cockpit", h2a: "Lo que ves ", h2b: "cada día.", sub: "No es una promesa — son las pantallas reales. Datos de ejemplo; los tuyos entran el día que conectas.", vivo: "en vivo" },
  hi: { eyebrow: "आपका कॉकपिट", h2a: "जो आप ", h2b: "रोज़ देखते हैं।", sub: "वादा नहीं — असली स्क्रीन। सैंपल डेटा; कनेक्ट करते ही आपका डेटा भर जाता है।", vivo: "लाइव" },
};
export default function CockpitShots() {
  const { lang } = useLang();
  const L = lang in COPY ? lang : "en"; const C = COPY[L];
  return (
    <section id="cockpit" className="relative overflow-hidden px-5 py-20">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_420px_at_50%_100%,rgba(62,148,104,0.07),transparent)]" />
      <Reveal className="mx-auto max-w-3xl text-center">
        <div className="text-[12px] font-black uppercase tracking-[0.24em] text-g-gold">🛰️ {C.eyebrow}</div>
        <h2 className="mt-4 font-black leading-[1.02] tracking-tight text-g-word" style={{ fontSize: "clamp(2rem,4.6vw,3.2rem)" }}>{C.h2a}<span className="bg-gradient-to-r from-g-green via-g-light to-g-green bg-clip-text text-transparent">{C.h2b}</span></h2>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-g-ink">{C.sub}</p>
      </Reveal>
      <div className="mx-auto mt-10 grid max-w-6xl gap-5 lg:grid-cols-3">
        {SHOTS.map((s, i) => (
          <Reveal key={s.src} delay={i * 90}>
            {/* moldura de monitor: placa de vidro com a tela dentro, aro escuro, vinheta de lente nas quinas */}
            <figure className="group relative overflow-hidden rounded-3xl border border-g-line bg-g-creamd/70 p-2.5 backdrop-blur transition-transform duration-300 hover:-translate-y-1.5 hover:[transform:perspective(1200px)_rotateX(2deg)_translateY(-6px)]">
              <div className="relative overflow-hidden rounded-[12px] ring-1 ring-black/60">
                <img src={s.src} alt={s.t[L]} loading="lazy" decoding="async" width="2400" height="1250" className="block h-auto w-full" />
                <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 100% at 50% 50%, transparent 70%, rgba(0,0,0,0.35) 100%)" }} />
                {/* reflexo que atravessa a tela no hover — vidro de monitor */}
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 -translate-x-full transition-transform duration-[900ms] ease-out group-hover:translate-x-full" style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.10) 50%, transparent 60%)" }} />
                {/* LIVE: o cockpit respira */}
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-[3px] text-[9.5px] font-black uppercase tracking-wider text-g-light ring-1 ring-white/10"><span className="relative h-1.5 w-1.5"><span className="absolute inset-0 rounded-full bg-g-green" /><span className="absolute inset-0 rounded-full bg-g-green animate-ping" /></span>{C.vivo}</span>
              </div>
              <figcaption className="px-2 pb-1.5 pt-3">
                <div className="text-[13.5px] font-black text-g-word">{s.t[L]}</div>
                <div className="mt-1 text-[12px] leading-relaxed text-g-muted">{s.d[L]}</div>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
