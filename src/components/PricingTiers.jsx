import { useLang } from "../i18n.jsx";
import { Reveal, Stagger, Item } from "../lib/ui.jsx";
import { GUILEO_PLANS } from "../data/guileoPlans.js";
import { SELF_SERVE_PLANS } from "../data/selfServePlans.js";
import { PRICING } from "../data/salesKit.js";

// Preço do sob-medida vem do kit do vendedor — uma fonte só para a landing e para a boca do
// vendedor. SEM fallback de propósito: se `doneForYou` sumir do kit, quero o build quebrando,
// não a landing publicando "$undefined/mês". Preço é a linha onde falhar em silêncio é caro.
const DFY = PRICING.doneForYou;

// PricingTiers — the REAL price on the landing (audit: desire was built but the number lived only on
// /planos, forcing a reload). Anchors the 3 canonical self-serve tiers from guileoPlans.js — the
// single source, so nothing is invented. Currency-aware (BRL for pt, USD otherwise). Locked cement +
// signal system; the "Most popular" tier carries the one bold accent, the rest stay quiet (restraint).

const COPY = {
  en: { eyebrow: "Simple, honest pricing", h1a: "Pick a plan. ", h1b: "Go live in under 7 days.", sub: "Self-service plans, cancel anytime, 30-day money-back. Bigger operation? We tailor a done-for-you package.", mo: "/mo", cr: "credits/mo", cta: "Get started", ctaPop: "Start with this", guarantee: "30-day money-back · a real human supervises", dfy: "Need it fully done-for-you? Talk to us →",
    cus: { eyebrow: "Custom · designed around your business", h1a: "Or we design the whole thing ", h1b: "around your business.",
      sub: "No two businesses are the same. We study yours, design the solution, build the ads and bring you the customers — and Gui answers in your voice, with your prices and your rules.",
      steps: ["We study your business", "We design the solution + the ads", "We bring you the customers"],
      from: "Designed for you", orcamento: "We quote it after we study your business", orcamentoSub: "No price before we know what you actually need.", setup: "one-time setup", cta: "Design it for my business →",
      rare: "A real strategist on your account — not a template. That attention is rare, which is exactly why it's the difference." } },
  pt: { eyebrow: "Preço simples e honesto", h1a: "Escolha o plano. ", h1b: "No ar em menos de 7 dias.", sub: "Planos self-service, cancela quando quiser, 30 dias de garantia. Operação maior? Montamos um pacote done-for-you.", mo: "/mês", cr: "créditos/mês", cta: "Começar", ctaPop: "Começar por este", guarantee: "Garantia de 30 dias · um humano de verdade supervisiona", dfy: "Quer tudo feito pra você? Fale com a gente →",
    cus: { eyebrow: "Sob medida · desenhado pro seu negócio", h1a: "Ou a gente desenha tudo ", h1b: "em volta do seu negócio.",
      sub: "Nenhum negócio é igual ao outro. A gente estuda o seu, desenha a solução, cria os anúncios e traz os clientes — e a Gui atende do seu jeito, com os seus preços e as suas regras.",
      steps: ["Estudamos o seu negócio", "Desenhamos a solução + os anúncios", "Trazemos os clientes"],
      from: "Desenhado pra você", orcamento: "A gente orça depois de estudar seu negócio", orcamentoSub: "Nenhum preço antes de saber o que você precisa de verdade.", setup: "de setup, uma vez só", cta: "Quero um desenho pro meu negócio →",
      rare: "Um estrategista de verdade na sua conta — não um modelo pronto. Essa atenção é rara, e é justamente por isso que ela é o diferencial." } },
  es: { eyebrow: "Precio simple y honesto", h1a: "Elige un plan. ", h1b: "En vivo en menos de 7 días.", sub: "Planes self-service, cancela cuando quieras, garantía de 30 días. ¿Operación mayor? Armamos un paquete done-for-you.", mo: "/mes", cr: "créditos/mes", cta: "Empezar", ctaPop: "Empezar con este", guarantee: "Garantía de 30 días · un humano de verdad supervisa", dfy: "¿Lo quieres hecho para ti? Habla con nosotros →",
    cus: { eyebrow: "A medida · diseñado para tu negocio", h1a: "O diseñamos todo ", h1b: "alrededor de tu negocio.",
      sub: "Ningún negocio es igual a otro. Estudiamos el tuyo, diseñamos la solución, creamos los anuncios y te traemos los clientes — y Gui contesta a tu manera, con tus precios y tus reglas.",
      steps: ["Estudiamos tu negocio", "Diseñamos la solución + los anuncios", "Te traemos los clientes"],
      from: "Diseñado para ti", orcamento: "Cotizamos después de estudiar tu negocio", orcamentoSub: "Ningún precio antes de saber qué necesitas de verdad.", setup: "de setup, una sola vez", cta: "Quiero un diseño para mi negocio →",
      rare: "Un estratega de verdad en tu cuenta — no una plantilla. Esa atención es rara, y por eso es la diferencia." } },
  hi: { eyebrow: "सरल, ईमानदार कीमत", h1a: "एक प्लान चुनें। ", h1b: "7 दिन से कम में लाइव।", sub: "सेल्फ़-सर्विस प्लान, कभी भी रद्द करें, 30-दिन मनी-बैक। बड़ा ऑपरेशन? हम done-for-you पैकेज बनाते हैं।", mo: "/माह", cr: "क्रेडिट/माह", cta: "शुरू करें", ctaPop: "इससे शुरू करें", guarantee: "30-दिन मनी-बैक · एक असली इंसान निगरानी करता है", dfy: "पूरा done-for-you चाहिए? हमसे बात करें →",
    cus: { eyebrow: "कस्टम · आपके व्यवसाय के लिए बनाया गया", h1a: "या हम पूरी चीज़ ", h1b: "आपके व्यवसाय के हिसाब से बनाते हैं।",
      sub: "कोई भी दो व्यवसाय एक जैसे नहीं होते। हम आपका अध्ययन करते हैं, समाधान डिज़ाइन करते हैं, विज्ञापन बनाते हैं और ग्राहक लाते हैं — और Gui आपकी आवाज़, आपके दाम और आपके नियमों से जवाब देती है।",
      steps: ["हम आपका व्यवसाय समझते हैं", "समाधान + विज्ञापन डिज़ाइन करते हैं", "हम ग्राहक लाते हैं"],
      from: "आपके लिए डिज़ाइन", orcamento: "आपका व्यवसाय समझने के बाद हम क़ीमत बताते हैं", orcamentoSub: "यह जाने बिना कि आपको वाक़ई क्या चाहिए, कोई क़ीमत नहीं।", setup: "एक-बार सेटअप", cta: "मेरे व्यवसाय के लिए डिज़ाइन करें →",
      rare: "आपके अकाउंट पर एक असली रणनीतिकार — टेम्पलेट नहीं। यही ध्यान दुर्लभ है, और यही फ़र्क़ है।" } },
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
            // Bind display price + checkout to ONE object: SELF_SERVE_PLANS carries the audited live
            // Stripe Payment Link, so the USD number shown is the number Stripe charges (matched by key).
            const ss = SELF_SERVE_PLANS.find((s) => s.id === p.key);
            // BRL is a separate Mercado Pago track (no USD Payment Link) → keep the BRL label + the
            // current /planos hand-off so a pt buyer is never sent to a $USD link.
            const price = isBR ? p.priceBR : (ss ? `$${ss.price}` : p.price);
            const feats = (p.feats[lang] || p.feats.en);
            const tag = (p.tag[lang] || p.tag.en);
            // Straight-to-Stripe CTA (removes the /planos reload). Mirror EXACTLY how Planos.jsx builds
            // the checkout URL: prefill the payer email + carry ref as client_reference_id (Stripe echoes
            // it to the webhook for seller/referral attribution). Only when a USD Payment Link exists and
            // the price shown is USD — otherwise fall back to the existing /planos?plan= behavior.
            let ctaHref = `/planos?plan=${p.key}`;
            if (ss && ss.url && !isBR) {
              ctaHref = ss.url;
              try {
                const q = new URLSearchParams(window.location.search);
                const em = (q.get("email") || "").trim();
                let ref = (q.get("ref") || "").trim();
                if (!ref) {
                  try {
                    const st = JSON.parse(localStorage.getItem("guileo_ref") || "null");
                    if (st && st.ref && (!st.at || Date.now() - st.at < 90 * 864e5)) ref = String(st.ref);
                  } catch { /* legacy/corrupt value — ignore */ }
                }
                const parts = [];
                if (em) parts.push(`prefilled_email=${encodeURIComponent(em)}`);
                if (ref) parts.push(`client_reference_id=${encodeURIComponent(ref.slice(0, 200))}`);
                if (parts.length) ctaHref = `${ss.url}${ss.url.includes("?") ? "&" : "?"}${parts.join("&")}`;
              } catch { /* SSR/no-window safe */ }
            }
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

                  <a href={ctaHref} className={`mt-auto pt-6 ${pop ? "" : ""}`}>
                    <span className={`block w-full rounded-xl px-4 py-3 text-center text-[13px] font-bold transition ${pop ? "btn-bright" : "border border-white/15 bg-white/[0.04] text-g-word hover:border-g-green/40 hover:bg-g-green/[0.06]"}`}>{pop ? t.ctaPop : t.cta}</span>
                  </a>
                </article>
              </Item>
            );
          })}
        </Stagger>

        {/* ── O QUARTO CAMINHO: SOB MEDIDA ────────────────────────────────────────────────────
            O que faltava: as três colunas acima são prateleira — o visitante escolhe uma caixa
            pronta. Mas o negócio da Guileo não é vender caixa, é DESENHAR: estudar a empresa,
            criar a solução e os anúncios, e trazer o cliente. Sem esta faixa, quem tem um modelo
            de negócio próprio (a maioria) não encontrava a própria porta e ia embora.
            A atenção humana é o que ninguém automatiza — por isso ela custa e por isso é dita
            aqui em voz alta, e não escondida num link de rodapé como estava.
            PREÇO: vem de salesKit.js (a mesma fonte do vendedor). Número digitado à mão na
            landing é número que diverge do que o vendedor fala na semana seguinte. */}
        <Reveal className="mt-6">
          <div className="relative overflow-hidden rounded-xl3 border border-g-gold/30 bg-gradient-to-br from-g-gold/[0.07] via-white/[0.02] to-transparent p-7 shadow-lift sm:p-9">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(520px_260px_at_18%_0%,rgba(214,194,154,0.10),transparent)]" />
            <div className="grid items-center gap-7 lg:grid-cols-[1.35fr_1fr]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-g-gold/35 bg-g-gold/10 px-3 py-1 text-[10.5px] font-black uppercase tracking-[0.18em] text-g-gold">
                  ✍️ {t.cus.eyebrow}
                </div>
                <h3 className="mt-4 font-black leading-[1.08] tracking-tight text-g-word" style={{ fontSize: "clamp(1.45rem,2.8vw,2.1rem)" }}>
                  {t.cus.h1a}<span className="text-g-gold">{t.cus.h1b}</span>
                </h3>
                <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-g-ink">{t.cus.sub}</p>
                <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
                  {t.cus.steps.map((s, i) => (
                    <div key={s} className="rounded-xl2 border border-white/10 bg-white/[0.035] px-3.5 py-3">
                      <div className="text-[10px] font-black uppercase tracking-wider text-g-gold/80">{String(i + 1).padStart(2, "0")}</div>
                      <div className="mt-1 text-[12.5px] font-semibold leading-snug text-g-word">{s}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl2 border border-white/12 bg-[#0e0d0b]/70 p-6 text-center">
                {/* ── SEM NÚMERO, DE PROPÓSITO (Luis, 2026-08-11) ────────────────────────────────
                    Aqui aparecia "Custom, from $1,497/mo + $990 one-time setup". Um preço "a partir
                    de" num caminho SOB MEDIDA é o pior dos dois mundos: não fecha venda (ninguém
                    compra sob medida por catálogo) e ESPANTA o negócio pequeno antes da conversa —
                    ele lê $1.497 ao lado do $149 e vai embora, sem nunca dizer o que precisava.
                    O valor de um projeto sob medida só existe depois de estudar o negócio; anunciar
                    um piso antes disso é chutar preço, exatamente o que a Gui é proibida de fazer ao
                    telefone. A mesma regra vale para a nossa própria landing.
                    Agora o quadro pede a CONVERSA. Os números seguem vivos em `DFY` (guileoPlans.js)
                    para a proposta e para o vendedor — saíram da vitrine, não do sistema. */}
                <div className="text-[11px] font-bold uppercase tracking-wider text-g-muted">{t.cus.from}</div>
                <div className="mt-2 font-black leading-none tracking-tight text-g-word" style={{ fontSize: "clamp(1.35rem,2.6vw,1.8rem)" }}>
                  {t.cus.orcamento}
                </div>
                <div className="mt-1.5 text-[12.5px] text-g-ink">{t.cus.orcamentoSub}</div>
                <a href="/servicos" className="mt-5 block"><span className="block w-full rounded-xl border border-g-gold/45 bg-g-gold/[0.13] px-4 py-3 text-center text-[13px] font-bold text-g-gold transition hover:bg-g-gold/[0.2]">{t.cus.cta}</span></a>
                <div className="mt-3 text-[11px] leading-snug text-g-muted">{t.cus.rare}</div>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal className="mt-7 text-center">
          <div className="text-[12px] text-g-muted">{t.guarantee}</div>
        </Reveal>
      </div>
    </section>
  );
}
