import { useLang } from "../i18n.jsx";
import { Reveal, Stagger, Item } from "../lib/ui.jsx";
import { GUILEO_PLANS } from "../data/guileoPlans.js";

// PricingTiers — the REAL price on the landing (audit: desire was built but the number lived only on
// /planos, forcing a reload). Anchors the 3 canonical self-serve tiers from guileoPlans.js — the
// single source, so nothing is invented. Currency-aware (BRL for pt, USD otherwise). Locked cement +
// signal system; the "Most popular" tier carries the one bold accent, the rest stay quiet (restraint).

const COPY = {
  en: { eyebrow: "Simple, honest pricing", h1a: "Pick a plan. ", h1b: "Go live in under 7 days.", sub: "Self-service plans, cancel anytime, 30-day money-back. Bigger operation? We tailor a done-for-you package.", mo: "/mo", cr: "credits/mo", cta: "Get started", ctaPop: "Start with this", guarantee: "30-day money-back · a real human supervises", dfy: "Need it fully done-for-you? Talk to us →" },
  pt: { eyebrow: "Preço simples e honesto", h1a: "Escolha o plano. ", h1b: "No ar em menos de 7 dias.", sub: "Planos self-service, cancela quando quiser, 30 dias de garantia. Operação maior? Montamos um pacote done-for-you.", mo: "/mês", cr: "créditos/mês", cta: "Começar", ctaPop: "Começar por este", guarantee: "Garantia de 30 dias · um humano de verdade supervisiona", dfy: "Quer tudo feito pra você? Fale com a gente →" },
  es: { eyebrow: "Precio simple y honesto", h1a: "Elige un plan. ", h1b: "En vivo en menos de 7 días.", sub: "Planes self-service, cancela cuando quieras, garantía de 30 días. ¿Operación mayor? Armamos un paquete done-for-you.", mo: "/mes", cr: "créditos/mes", cta: "Empezar", ctaPop: "Empezar con este", guarantee: "Garantía de 30 días · un humano de verdad supervisa", dfy: "¿Lo quieres hecho para ti? Habla con nosotros →" },
  hi: { eyebrow: "सरल, ईमानदार कीमत", h1a: "एक प्लान चुनें। ", h1b: "7 दिन से कम में लाइव।", sub: "सेल्फ़-सर्विस प्लान, कभी भी रद्द करें, 30-दिन मनी-बैक। बड़ा ऑपरेशन? हम done-for-you पैकेज बनाते हैं।", mo: "/माह", cr: "क्रेडिट/माह", cta: "शुरू करें", ctaPop: "इससे शुरू करें", guarantee: "30-दिन मनी-बैक · एक असली इंसान निगरानी करता है", dfy: "पूरा done-for-you चाहिए? हमसे बात करें →" },
};

export default function PricingTiers() {
  const { lang } = useLang();
  const t = COPY[lang] || COPY.en;
  const isBR = lang === "pt";

  return (
    <section id="pricing" className="relative overflow-hidden px-5 py-20">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(700px_360px_at_50%_-5%,rgba(62,148,104,0.09),transparent)]" />
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="text-[12px] font-bold uppercase tracking-[0.26em] text-g-gold">{t.eyebrow}</div>
          <h2 className="mt-4 font-black leading-[1.04] tracking-tight text-g-word" style={{ fontSize: "clamp(2rem,4.2vw,3rem)" }}>
            {t.h1a}<span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent" style={{ backgroundSize: "220% auto", animation: "ptshine 6s linear infinite" }}>{t.h1b}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-g-ink">{t.sub}</p>
        </Reveal>
        <style>{`@keyframes ptshine{to{background-position:220% center}}`}</style>

        <Stagger className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-3" gap={0.09}>
          {GUILEO_PLANS.map((p) => {
            const pop = !!p.featured;
            const price = isBR ? p.priceBR : p.price;
            const feats = (p.feats[lang] || p.feats.en);
            const tag = (p.tag[lang] || p.tag.en);
            return (
              <Item key={p.key} variant="up">
                <article className={`relative flex h-full flex-col overflow-hidden rounded-2xl border p-6 backdrop-blur transition-all duration-300 ${pop ? "border-g-green/45 bg-g-green/[0.06] lg:-translate-y-2" : "border-white/10 bg-white/[0.03] hover:-translate-y-1"}`}
                  style={{ boxShadow: pop ? "0 40px 100px -34px rgba(62,148,104,0.5)" : "0 22px 60px -34px rgba(0,0,0,0.9)" }}>
                  {pop && <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-g-green to-transparent" />}
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[15px] font-black tracking-tight text-g-word">{p.name}</div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[9.5px] font-black uppercase tracking-wide ${pop ? "bg-g-green/20 text-g-green ring-1 ring-g-green/40" : "bg-white/[0.05] text-g-muted ring-1 ring-white/10"}`}>{tag}</span>
                  </div>

                  {/* the number — the thing the audit said was hidden */}
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-black leading-none tracking-tight tabular-nums text-g-word" style={{ fontSize: "clamp(2.2rem,5vw,2.8rem)" }}>{price.replace(/\/.*$/, "")}</span>
                    <span className="text-[13px] font-semibold text-g-muted">{t.mo}</span>
                  </div>
                  <div className="mt-1 text-[12px] font-bold" style={{ color: pop ? "#3E9468" : "#B9AE9C" }}>{p.credits.toLocaleString()} {t.cr}</div>

                  <ul className="mt-5 space-y-2">
                    {feats.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-[12.5px] leading-snug text-g-ink">
                        <span className="mt-[3px] text-g-green">✓</span><span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <a href={`/planos?plan=${p.key}`} className={`mt-auto pt-6 ${pop ? "" : ""}`}>
                    <span className={`block w-full rounded-xl px-4 py-3 text-center text-[13px] font-bold transition ${pop ? "btn-bright" : "border border-white/15 bg-white/[0.04] text-g-word hover:border-g-green/40 hover:bg-g-green/[0.06]"}`}>{pop ? t.ctaPop : t.cta}</span>
                  </a>
                </article>
              </Item>
            );
          })}
        </Stagger>

        <Reveal className="mt-7 text-center">
          <div className="text-[12px] text-g-muted">{t.guarantee}</div>
          <a href="/servicos" className="mt-2 inline-block text-[13px] font-semibold text-g-gold hover:text-g-copper">{t.dfy}</a>
        </Reveal>
      </div>
    </section>
  );
}
