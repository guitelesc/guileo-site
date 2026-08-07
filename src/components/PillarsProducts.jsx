import { useLang } from "../i18n.jsx";
import { Reveal, Stagger, Item } from "../lib/ui.jsx";

// PillarsProducts — the aligned product spine (Luis, 2026-07-24): the landing must MIRROR the real
// platform's three pillars, and the products must CORRESPOND to what the client actually buys, each
// tied to a RESULT and a VALUE. Replaces the old redundant WholePicture + flat ProductResults grid.
//   🧠 Guileo Brain — the AI employee (answers/books/sells/collects)         → recovers $/mo
//   📈 Guileo AD    — marketing that runs daily (hybrid: AI every day + a real team on the craft)
//   🏗️ Guileo Build — the foundation, built once (done-for-you by the team)
// Honesty (CLAUDE.md law): AD is explicitly HYBRID (AI + human team) — never "fully automated".
// Locked cement + neon-realista signal system; landing-scoped; Faena restraint (no loud motion).

const P = {
  en: {
    eyebrow: "Three pillars · one system",
    h1a: "One AI + marketing team, ",
    h1b: "run as three pillars.",
    sub: "Not features — pillars. Each owns a job, delivers a result, and pays for itself.",
    hybrid: "AI every day · a real human team on the craft",
    ai: "AI-run · a human supervises",
    dfy: "Done-for-you by the Guileo team",
    resultLabel: "The result",
    pillars: [
      { badge: "Guileo Brain", icon: "🧠", accent: "#FF8A33", owns: "Your performance", line: "The AI employee that runs the front desk — answers every call & message, books, quotes, closes and collects. 24/7, 16 languages.", products: ["24/7 Reception", "Speed-to-Lead 60s", "No-show Shield", "Reactivation", "Close & Collect"], result: "+$2k–11k", unit: "/mo recovered", tone: "ai" },
      { badge: "Guileo AD", icon: "📈", accent: "#4C9AFF", owns: "Your growth", line: "Marketing that runs every day so you reach more people, close more deals and waste less ad money.", products: ["Marketing", "Ads", "Content creation", "Media management", "SEO", "Email / CRM"], result: "More leads", unit: "· less wasted ad spend", tone: "hybrid" },
      { badge: "Guileo Build", icon: "🏗️", accent: "#9AA0FF", owns: "Your foundation", line: "The websites, apps, store and software your whole operation runs on — built once, runs forever.", products: ["Websites", "Mobile apps", "Online store", "Custom software"], result: "1× build", unit: "· runs forever", tone: "dfy" },
    ],
  },
  pt: {
    eyebrow: "Três pilares · um sistema",
    h1a: "Um time de IA + marketing, ",
    h1b: "em três pilares.",
    sub: "Não são recursos — são pilares. Cada um tem um trabalho, entrega um resultado e se paga.",
    hybrid: "IA todo dia · um time humano na arte",
    ai: "IA opera · um humano supervisiona",
    dfy: "Feito pra você pelo time Guileo",
    resultLabel: "O resultado",
    pillars: [
      { badge: "Guileo Brain", icon: "🧠", accent: "#FF8A33", owns: "Sua performance", line: "O funcionário-IA que cuida da recepção — atende toda ligação e mensagem, agenda, orça, fecha e cobra. 24/7, 16 idiomas.", products: ["Recepção 24/7", "Resposta ao lead em 60s", "Escudo anti-falta", "Reativação", "Fecha & Cobra"], result: "+R$10k–55k", unit: "/mês recuperado", tone: "ai" },
      { badge: "Guileo AD", icon: "📈", accent: "#4C9AFF", owns: "Seu crescimento", line: "Marketing rodando todo dia pra você alcançar mais gente, fechar mais e desperdiçar menos em anúncio.", products: ["Marketing", "Tráfego pago", "Criação de conteúdo", "Gestão de mídia", "SEO", "E-mail / CRM"], result: "Mais leads", unit: "· menos verba desperdiçada", tone: "hybrid" },
      { badge: "Guileo Build", icon: "🏗️", accent: "#9AA0FF", owns: "Sua fundação", line: "Os sites, apps, loja e software onde toda a operação roda — construído uma vez, roda pra sempre.", products: ["Sites", "Apps", "Loja online", "Software sob medida"], result: "1× build", unit: "· roda pra sempre", tone: "dfy" },
    ],
  },
  es: {
    eyebrow: "Tres pilares · un sistema",
    h1a: "Un equipo de IA + marketing, ",
    h1b: "en tres pilares.",
    sub: "No son funciones — son pilares. Cada uno tiene un trabajo, entrega un resultado y se paga solo.",
    hybrid: "IA cada día · un equipo humano en el arte",
    ai: "IA opera · un humano supervisa",
    dfy: "Hecho para ti por el equipo Guileo",
    resultLabel: "El resultado",
    pillars: [
      { badge: "Guileo Brain", icon: "🧠", accent: "#FF8A33", owns: "Tu performance", line: "El empleado-IA que atiende la recepción — contesta cada llamada y mensaje, agenda, cotiza, cierra y cobra. 24/7, 16 idiomas.", products: ["Recepción 24/7", "Respuesta al lead en 60s", "Escudo anti-ausencia", "Reactivación", "Cierra & Cobra"], result: "+$2k–11k", unit: "/mes recuperado", tone: "ai" },
      { badge: "Guileo AD", icon: "📈", accent: "#4C9AFF", owns: "Tu crecimiento", line: "Marketing corriendo cada día para llegar a más gente, cerrar más y desperdiciar menos en anuncios.", products: ["Marketing", "Anuncios", "Creación de contenido", "Gestión de medios", "SEO", "Email / CRM"], result: "Más leads", unit: "· menos gasto perdido", tone: "hybrid" },
      { badge: "Guileo Build", icon: "🏗️", accent: "#9AA0FF", owns: "Tu base", line: "Las webs, apps, tienda y software donde corre toda tu operación — construido una vez, corre siempre.", products: ["Webs", "Apps", "Tienda online", "Software a medida"], result: "1× build", unit: "· corre siempre", tone: "dfy" },
    ],
  },
  hi: {
    eyebrow: "तीन स्तंभ · एक सिस्टम",
    h1a: "एक AI + मार्केटिंग टीम, ",
    h1b: "तीन स्तंभों में।",
    sub: "फ़ीचर नहीं — स्तंभ। हर एक का एक काम, एक नतीजा, और खुद की कीमत निकालता है।",
    hybrid: "रोज़ AI · कारीगरी पर असली मानव टीम",
    ai: "AI चलाता है · मानव निगरानी करता है",
    dfy: "Guileo टीम आपके लिए बनाती है",
    resultLabel: "नतीजा",
    pillars: [
      { badge: "Guileo Brain", icon: "🧠", accent: "#FF8A33", owns: "आपकी परफ़ॉर्मेंस", line: "AI कर्मचारी जो रिसेप्शन संभालता है — हर कॉल और मैसेज का जवाब, बुकिंग, कोटेशन, डील बंद और वसूली। 24/7, 16 भाषाएँ।", products: ["24/7 रिसेप्शन", "60s में लीड जवाब", "नो-शो शील्ड", "रीएक्टिवेशन", "क्लोज़ & कलेक्ट"], result: "+$2k–11k", unit: "/माह वापस", tone: "ai" },
      { badge: "Guileo AD", icon: "📈", accent: "#4C9AFF", owns: "आपकी ग्रोथ", line: "मार्केटिंग जो हर दिन चलती है — ज़्यादा लोगों तक पहुँच, ज़्यादा डील, कम विज्ञापन बर्बादी।", products: ["मार्केटिंग", "विज्ञापन", "कंटेंट क्रिएशन", "मीडिया मैनेजमेंट", "SEO", "ईमेल / CRM"], result: "ज़्यादा लीड", unit: "· कम बर्बादी", tone: "hybrid" },
      { badge: "Guileo Build", icon: "🏗️", accent: "#9AA0FF", owns: "आपकी नींव", line: "वेबसाइट, ऐप, स्टोर और सॉफ़्टवेयर जिन पर पूरा ऑपरेशन चलता है — एक बार बनता है, हमेशा चलता है।", products: ["वेबसाइट", "ऐप्स", "ऑनलाइन स्टोर", "कस्टम सॉफ़्टवेयर"], result: "1× बिल्ड", unit: "· हमेशा चलता है", tone: "dfy" },
    ],
  },
};

const hexToRgb = (hex) => {
  const h = (hex || "#FF8A33").replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};

export default function PillarsProducts() {
  const { lang } = useLang();
  const t = P[lang] || P.en;
  const toneLabel = (tone) => (tone === "hybrid" ? t.hybrid : tone === "dfy" ? t.dfy : t.ai);

  return (
    <section className="relative overflow-hidden px-5 py-20">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(760px_380px_at_20%_-5%,rgba(255,138,51,0.07),transparent),radial-gradient(760px_380px_at_85%_105%,rgba(154,160,255,0.07),transparent)]" />
      <div className="mx-auto max-w-6xl">
        {/* header — champagne eyebrow → font-black h2 w/ ONE shimmer phrase → greige sub */}
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{t.eyebrow}</div>
          <h2 className="mt-4 font-black leading-[1.04] tracking-tight text-g-word" style={{ fontSize: "clamp(2rem,4.2vw,3rem)" }}>
            {t.h1a}
            <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "prshine 6s linear infinite" }}>{t.h1b}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-g-ink">{t.sub}</p>
        </Reveal>

        <style>{`@keyframes prshine{to{background-position:220% center}}`}</style>

        {/* three pillar columns */}
        <Stagger className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-3" gap={0.1}>
          {t.pillars.map((p) => {
            const rgb = hexToRgb(p.accent);
            return (
              <Item key={p.badge} variant="up">
                <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur"
                  style={{ boxShadow: "0 22px 60px -34px rgba(0,0,0,0.9)" }}>
                  {/* accent top edge */}
                  <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg,transparent,rgba(${rgb},0.9),transparent)` }} />

                  {/* pillar identity */}
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[20px]" style={{ background: `rgba(${rgb},0.13)`, boxShadow: `inset 0 0 0 1px rgba(${rgb},0.4)`, filter: `drop-shadow(0 4px 12px rgba(${rgb},0.45))` }}>{p.icon}</span>
                    <div>
                      <div className="text-[15px] font-black tracking-tight" style={{ color: p.accent }}>{p.badge}</div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-g-muted">{p.owns}</div>
                    </div>
                  </div>

                  <p className="mt-4 text-[13px] leading-relaxed text-g-ink">{p.line}</p>

                  {/* the real products under this pillar */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {p.products.map((pr) => (
                      <span key={pr} className="rounded-full border px-2.5 py-1 text-[11px] font-semibold text-g-light" style={{ borderColor: `rgba(${rgb},0.3)`, background: `rgba(${rgb},0.07)` }}>{pr}</span>
                    ))}
                  </div>

                  {/* honest delivery tag */}
                  <div className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-[10.5px] font-semibold text-g-muted ring-1 ring-white/10">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.accent, boxShadow: `0 0 7px ${p.accent}` }} />{toneLabel(p.tone)}
                  </div>

                  {/* the result — anchored at the foot */}
                  <div className="mt-auto pt-5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-g-muted">{t.resultLabel}</div>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="font-black leading-none tracking-tight tabular-nums" style={{ color: p.accent, fontSize: "clamp(1.6rem,3vw,2rem)", textShadow: `0 4px 22px rgba(${rgb},0.35)` }}>{p.result}</span>
                      <span className="text-[12px] font-semibold text-g-light/80">{p.unit}</span>
                    </div>
                  </div>
                </article>
              </Item>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
