import { useMemo, useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { buildServiceContract } from "../data/serviceContracts.js";
import { GUILEO_PLANS, planByKey } from "../data/guileoPlans.js";
import ContractDoc from "./ContractDoc.jsx";

// Seller contract generator — a SALES tool, sibling of SellerQuote. It renders a premium,
// printable SERVICE contract 100% client-side (buildServiceContract is pure, no connection key),
// so any logged-in seller can hand a prospect a proper agreement on the spot: pick a plan, fill
// the client's name/email/amount/start date, and print/PDF it or fire the summary on WhatsApp.
// This is a TEMPLATE, not legal advice — an honesty banner + the doc's own disclaimer say so.
// The binding e-signature flow stays in /admin/contratos (owner-only).

const U = {
  pt: {
    h: "Gerador de contrato", sub: "Monte um contrato de serviço bonito — imprima, salve em PDF ou mande o resumo no WhatsApp.",
    plan: "Plano", docLang: "Idioma do documento", client: "Nome do cliente", email: "E-mail do cliente",
    amount: "Valor", start: "Data de início",
    print: "🖨️ Imprimir / PDF", wa: "💬 WhatsApp", copy: "📋 Copiar resumo", copied: "Copiado ✓",
    preview: "Pré-visualização", banner: "⚠️ Modelo — revise com um advogado antes de assinar.",
    waNote: "Segue o resumo do contrato. O PDF completo vai em anexo.",
  },
  en: {
    h: "Contract generator", sub: "Build a beautiful service contract — print, save as PDF, or send the summary on WhatsApp.",
    plan: "Plan", docLang: "Document language", client: "Client name", email: "Client email",
    amount: "Amount", start: "Start date",
    print: "🖨️ Print / PDF", wa: "💬 WhatsApp", copy: "📋 Copy summary", copied: "Copied ✓",
    preview: "Preview", banner: "⚠️ Template — have a lawyer review it before signing.",
    waNote: "Here's the contract summary. The full PDF is attached.",
  },
  es: {
    h: "Generador de contrato", sub: "Crea un contrato de servicio lindo — imprime, guarda en PDF o envía el resumen por WhatsApp.",
    plan: "Plan", docLang: "Idioma del documento", client: "Nombre del cliente", email: "E-mail del cliente",
    amount: "Monto", start: "Fecha de inicio",
    print: "🖨️ Imprimir / PDF", wa: "💬 WhatsApp", copy: "📋 Copiar resumen", copied: "Copiado ✓",
    preview: "Vista previa", banner: "⚠️ Modelo — que un abogado lo revise antes de firmar.",
    waNote: "Aquí está el resumen del contrato. El PDF completo va adjunto.",
  },
  hi: {
    h: "अनुबंध जेनरेटर", sub: "सुंदर सेवा अनुबंध बनाएं — प्रिंट करें, PDF सेव करें या सारांश WhatsApp पर भेजें।",
    plan: "प्लान", docLang: "दस्तावेज़ भाषा", client: "ग्राहक का नाम", email: "ग्राहक का ई-मेल",
    amount: "राशि", start: "आरंभ तिथि",
    print: "🖨️ प्रिंट / PDF", wa: "💬 WhatsApp", copy: "📋 सारांश कॉपी करें", copied: "कॉपी ✓",
    preview: "पूर्वावलोकन", banner: "⚠️ टेम्पलेट — हस्ताक्षर से पहले वकील से समीक्षा कराएं।",
    waNote: "यह अनुबंध का सारांश है। पूरा PDF संलग्न है।",
  },
};

// Canonical price string for a plan in the active market (USD default, BRL when market="br").
const planPrice = (p, market) => (market === "br" ? p.priceBR : p.price);
// hi documents fall back to en (contracts ship in pt|en|es only).
const docLangFor = (l) => (l === "hi" ? "en" : l);

export default function SellerContract({ lang = "pt", seller = null, market = "us", handoff = null }) {
  const t = U[lang] || U.pt;
  const sellerName = seller?.name || "";
  // Plan selection drives service + default amount. Default to Personalized (the flagship).
  const [planKey, setPlanKey] = useState("growth");
  // Document language is independent of the UI language (hi → en).
  const [docLang, setDocLang] = useState(docLangFor(lang));
  // handoff?.client arrives when the seller came from Follow-up ("gerar contrato pra <negócio>").
  const [client, setClient] = useState(() => handoff?.client || "");
  const [email, setEmail] = useState(() => handoff?.email || "");
  // Seed the amount from the selected plan in the active market; editable afterwards.
  const [amount, setAmount] = useState(() => planPrice(planByKey("growth"), market));
  // Default start date = today (yyyy-mm-dd for the native date input).
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [copied, setCopied] = useState(false);

  // Flipping the global market WHILE on this tab must re-price the CONTRACT doc too (not just the
  // chips) — else a BR contract ships with a USD amount. Only reprice a still-plan-price amount;
  // a hand-typed value is never overwritten. (mirrors SellerQuote.jsx.)
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    const wasPlanPrice = GUILEO_PLANS.some((p) => amount === p.price || amount === p.priceBR);
    if (wasPlanPrice) setAmount(planPrice(planByKey(planKey), market));
  }, [market]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pick a plan: switch the service AND reseed the amount from that plan's market price.
  const pickPlan = (p) => { setPlanKey(p.key); setAmount(planPrice(p, market)); };

  const body = useMemo(
    () => buildServiceContract({
      planKey, lang: docLang, market,
      provider: { name: sellerName ? `${sellerName} · Guileo` : "Guileo" },
      client: { name: client, email },
      amount, startDate: start,
    }),
    [planKey, docLang, market, sellerName, client, email, amount, start]
  );

  // Plain-text summary for WhatsApp / clipboard — the readable gist of the doc.
  const summary = useMemo(() => {
    const dl = (body?.deliverables || []).slice(0, 4);
    return [
      `📄 ${body?.title || ""}${client ? ` — ${client}` : ""}`,
      amount ? `💰 ${amount}` : "",
      body?.timeline ? `⏱️ ${body.timeline}` : "",
      ...dl.map((d) => `• ${d}`),
    ].filter(Boolean).join("\n");
  }, [body, client, amount]);

  // WhatsApp share — no fixed recipient, so the seller picks the client's contact; the note flags
  // that the full PDF (printed separately) goes attached. Native wa.me share, fires nothing.
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${summary}\n\n${t.waNote}\n\n— ${sellerName || "Guileo"}`)}`;

  // Print/PDF — reuse the shared print scope so the existing quote print CSS applies.
  const print = () => {
    document.body.classList.add("printing-quote");
    const done = () => { document.body.classList.remove("printing-quote"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => { window.print(); }, 30);
  };

  const field = "w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-[13px] text-g-word placeholder:text-g-muted/60 focus:outline-none focus:border-g-green/50";

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-extrabold text-g-word">{t.h}</div>
        <p className="text-[12.5px] text-g-muted mt-1">{t.sub}</p>
      </div>

      {/* honesty banner — a contract TEMPLATE, never a lawyer's opinion */}
      <div className="mb-4 rounded-lg border border-g-gold/30 bg-g-gold/[0.08] px-3 py-2 text-[12px] text-g-gold">
        {t.banner}
      </div>

      {/* canonical plan chips — one tap sets the service + the market price from src/data/guileoPlans.js */}
      <div className="mb-4 flex flex-wrap gap-2">
        {GUILEO_PLANS.map((p) => {
          const on = planKey === p.key;
          return (
            <button key={p.key} type="button" onClick={() => pickPlan(p)}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-bold transition ${on ? "border-g-green/50 bg-g-green/[0.14] text-g-green" : "border-white/15 bg-white/[0.05] text-g-ink hover:text-g-word"}`}>
              {p.featured ? "⭐ " : ""}{p.name} · {planPrice(p, market)}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 min-w-0">
        <div className="card p-5 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-[11px] text-g-muted">{t.docLang}
              <select value={docLang} onChange={(e) => setDocLang(e.target.value)} className={field}>
                <option value="en">🇺🇸 English</option>
                <option value="es">🇪🇸 Español</option>
                <option value="pt">🇧🇷 Português</option>
              </select>
            </label>
            <label className="text-[11px] text-g-muted">{t.amount}
              <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={market === "br" ? "R$ 2.499" : "$449"} className={field} />
            </label>
            <label className="text-[11px] text-g-muted">{t.client}
              <input value={client} onChange={(e) => setClient(e.target.value)} placeholder={market === "br" ? "Ex: Café Aurora" : "e.g. Café Aurora"} className={field} />
            </label>
            <label className="text-[11px] text-g-muted">{t.email}
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="cliente@email.com" className={field} />
            </label>
            <label className="text-[11px] text-g-muted">{t.start}
              <input value={start} onChange={(e) => setStart(e.target.value)} type="date" className={field} />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={print} className="btn-bright text-[13px]">{t.print}</button>
            <a href={waHref} target="_blank" rel="noopener" className="btn-ghost text-[13px]">{t.wa}</a>
            <button
              onClick={() => { navigator.clipboard?.writeText(summary); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="btn-ghost text-[13px]"
            >{copied ? t.copied : t.copy}</button>
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-wide text-g-gold mb-2">{t.preview}</div>
          <motion.div
            key={planKey + docLang}
            initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="quote-print-area max-h-[70vh] overflow-auto rounded-2xl"
          >
            <ContractDoc body={body} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
