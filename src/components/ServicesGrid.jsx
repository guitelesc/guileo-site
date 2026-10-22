import { PRODUCTS, PILARES } from "../data/productSystem.js";
import { useLang } from "../i18n.jsx";
import { Reveal } from "../lib/ui.jsx";

/* ── ServicesGrid — substitui o ServicesMarquee (Luis, 2026-09-09) ────────────────────────────
   «essa parte tem que ser meio que uma SEÇÃO — tem que estar CLARO o que entregamos pra eles».
   O letreiro rolante comunicava amplitude ("tem mais do que cabe na tela") mas não deixava LER.
   Agora: os serviços parados, agrupados pelo pilar dono (Brain · AD · Build), nome + categoria,
   cada um com a cor do seu pilar. ⚠️ A FONTE CONTINUA `productSystem.js` — nunca uma lista
   escrita aqui (foi assim que a landing já prometeu serviço inexistente e apagou serviço real).
   Produto novo entra sozinho; produto que sai some sozinho. */

const PILAR = {
  brain: { c: "#3E9468", label: { en: "Brain — Gui answers, books & sells", pt: "Brain — a Gui atende, agenda e vende", es: "Brain — Gui atiende, agenda y vende", hi: "Brain — Gui जवाब देती, बुक और बेचती है" } },
  ad:    { c: "#D6C29A", label: { en: "AD — we bring the customers", pt: "AD — a gente traz os clientes", es: "AD — traemos los clientes", hi: "AD — हम ग्राहक लाते हैं" } },
  build: { c: "#BE7F35", label: { en: "Build — site, app, store & software", pt: "Build — site, app, loja e software", es: "Build — sitio, app, tienda y software", hi: "Build — साइट, ऐप, स्टोर और सॉफ़्टवेयर" } },
};
const COPY = {
  en: { eyebrow: (n) => `Brain · AD · Build — ${n} services`, h2: "Everything we build, run and manage for you.", sub: "One team, one invoice. Every item below is a real product in the platform — not a promise." },
  pt: { eyebrow: (n) => `Brain · AD · Build — ${n} serviços`, h2: "Tudo o que a gente constrói, opera e gerencia pra você.", sub: "Um time, uma fatura. Cada item abaixo é um produto real da plataforma — não uma promessa." },
  es: { eyebrow: (n) => `Brain · AD · Build — ${n} servicios`, h2: "Todo lo que construimos, operamos y gestionamos para ti.", sub: "Un equipo, una factura. Cada ítem de abajo es un producto real de la plataforma — no una promesa." },
  hi: { eyebrow: (n) => `Brain · AD · Build — ${n} सेवाएँ`, h2: "जो कुछ हम आपके लिए बनाते, चलाते और संभालते हैं।", sub: "एक टीम, एक बिल। नीचे का हर आइटम प्लेटफ़ॉर्म का असली प्रोडक्ट है — वादा नहीं।" },
};

export default function ServicesGrid() {
  const { lang } = useLang();
  const L = lang in COPY ? lang : "en";
  const C = COPY[L];
  const itens = PRODUCTS.filter((p) => p && p.name);
  return (
    <section id="services" className="relative overflow-hidden px-5 py-20">
      <style>{`@keyframes svcin{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}`}</style>
      <Reveal className="mx-auto max-w-3xl text-center">
        <div className="text-[12px] font-black uppercase tracking-[0.24em] text-g-gold">{C.eyebrow(itens.length)}</div>
        <h2 className="mt-4 font-black leading-[1.02] tracking-tight text-g-word" style={{ fontSize: "clamp(2rem,4.6vw,3.2rem)" }}>{C.h2}</h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-g-ink">{C.sub}</p>
      </Reveal>
      <div className="mx-auto mt-10 grid max-w-6xl gap-4 lg:grid-cols-3">
        {PILARES.map((k, i) => {
          const P = PILAR[k]; const lista = itens.filter((p) => p.pilar === k);
          return (
            <Reveal key={k} delay={i * 90}>
              <div className="relative h-full overflow-hidden rounded-3xl border border-g-line bg-g-creamd/70 p-5 backdrop-blur">
                <div className="flex items-center gap-2">
                  <span className="relative h-2 w-2"><span className="absolute inset-0 rounded-full" style={{ background: P.c, boxShadow: `0 0 10px ${P.c}` }} /><span className="absolute inset-0 rounded-full animate-ping" style={{ background: P.c, opacity: .45 }} /></span>
                  <span className="text-[11.5px] font-black uppercase tracking-[0.16em]" style={{ color: P.c }}>{P.label[L]}</span>
                </div>
                <ul className="mt-4 space-y-1">
                  {lista.map((p, j) => (
                    <li key={p.id} className="group flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.04]" style={{ animation: `svcin .5s cubic-bezier(.22,.61,.36,1) ${0.15 + j * 0.07}s both` }}>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.05] text-[15px] ring-1 ring-white/10 transition group-hover:scale-110" style={{ boxShadow: `0 0 0 0 ${P.c}00`, transition: "box-shadow .3s, transform .3s" }} onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 18px -4px ${P.c}`; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = `0 0 0 0 ${P.c}00`; }}>{p.icon}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-bold text-g-word">{p.name?.[L] || p.name?.en}</span>
                        <span className="block text-[11px] text-g-muted">{p.category?.[L] || p.category?.en}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
