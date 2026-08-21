import { useMemo, useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { buildBody, TEMPLATES, L } from "../lib/contracts.js";
import { GUILEO_PLANS } from "../data/guileoPlans.js";
import { waTo } from "../data/contact.js";
import ContractDoc from "./ContractDoc.jsx";

// Seller quote builder — a SALES tool, not the legal/signature flow. It renders a premium,
// printable quote 100% client-side (buildBody is pure, no connection key needed), so any logged-in
// seller can hand a prospect a beautiful price on the spot, print/PDF it, or fire it on WhatsApp.
// The full contract-with-e-signature stays in /admin/contratos (owner-only).

const U = {
  pt: { h: "Gerador de orçamento", sub: "Monte um orçamento bonito em 30 segundos — imprima, salve em PDF ou mande no WhatsApp.",
    service: "Serviço", lang: "Idioma do documento", client: "Nome do cliente", amount: "Valor (ex: $1,500/mês)", phone: "WhatsApp do cliente (opcional)",
    print: "🖨️ Imprimir / PDF", wa: "💬 Enviar no WhatsApp", copy: "Copiar resumo", copied: "Copiado ✓", preview: "Pré-visualização", ex: "Exemplo pronto", fill: "Preencha o nome do cliente pra liberar o envio.",
    emailMe: "✉️ Email pra mim", sending: "Enviando…", sent: "Enviado ✓" },
  en: { h: "Quote generator", sub: "Build a beautiful quote in 30 seconds — print, save as PDF, or send on WhatsApp.",
    service: "Service", lang: "Document language", client: "Client name", amount: "Amount (e.g. $1,500/mo)", phone: "Client WhatsApp (optional)",
    print: "🖨️ Print / PDF", wa: "💬 Send on WhatsApp", copy: "Copy summary", copied: "Copied ✓", preview: "Preview", ex: "Ready example", fill: "Add the client name to enable sending.",
    emailMe: "✉️ Email it to me", sending: "Sending…", sent: "Sent ✓" },
  es: { h: "Generador de presupuesto", sub: "Crea un presupuesto lindo en 30 segundos — imprime, guarda en PDF o envía por WhatsApp.",
    service: "Servicio", lang: "Idioma del documento", client: "Nombre del cliente", amount: "Monto (ej: $1,500/mes)", phone: "WhatsApp del cliente (opcional)",
    print: "🖨️ Imprimir / PDF", wa: "💬 Enviar por WhatsApp", copy: "Copiar resumen", copied: "Copiado ✓", preview: "Vista previa", ex: "Ejemplo listo", fill: "Agrega el nombre del cliente para habilitar el envío.",
    emailMe: "✉️ Enviar a mí", sending: "Enviando…", sent: "Enviado ✓" },
  hi: { h: "कोटेशन जेनरेटर", sub: "30 सेकंड में सुंदर कोटेशन बनाएं — प्रिंट करें, PDF सेव करें या WhatsApp पर भेजें।",
    service: "सेवा", lang: "दस्तावेज़ भाषा", client: "ग्राहक का नाम", amount: "राशि (जैसे $1,500/माह)", phone: "ग्राहक WhatsApp (वैकल्पिक)",
    print: "🖨️ प्रिंट / PDF", wa: "💬 WhatsApp पर भेजें", copy: "सारांश कॉपी करें", copied: "कॉपी ✓", preview: "पूर्वावलोकन", ex: "तैयार उदाहरण", fill: "भेजने के लिए ग्राहक का नाम जोड़ें।",
    emailMe: "✉️ मुझे ईमेल करें", sending: "भेज रहे हैं…", sent: "भेजा गया ✓" },
};

// Pull the canonical price string for a plan in the active market (USD default, BRL when market="br").
// One helper so the chips, the initial amount and any future price echo stay consistent.
const planPrice = (p, market) => (market === "br" ? p.priceBR : p.price);

export default function SellerQuote({ lang = "pt", sellerName = "", sellerEmail = "", sid = "", onQuote, handoff = null, market = "us" }) {
  const t = U[lang] || U.pt;
  const list = TEMPLATES.guileo_client || [];
  // Default to the PRODUCT (Guileo Personalized), not agency work — sellers sell the receptionist.
  const [code, setCode] = useState("GUI-PRO");
  const [docLang, setDocLang] = useState(lang === "hi" ? "en" : lang);
  // A worked EXAMPLE is pre-filled so the seller sees a finished quote immediately.
  // handoff?.client arrives when the seller came from Follow-up ("gerar orçamento pra <negócio>").
  const [client, setClient] = useState(() => handoff?.client || "Café Aurora");
  // Market drives the default amount: BRL when the hub is set to "br", USD otherwise.
  // GUI-PRO == the "growth"/Personalized plan (index 1) — seed its price in the active market.
  const [amount, setAmount] = useState(() => planPrice(GUILEO_PLANS[1], market));
  // Flipping the global market WHILE on this tab must re-price the quote doc too (not just the chips).
  // We only auto-reprice when `amount` still equals a known plan price (i.e. the seller hasn't typed a
  // custom value) — a hand-edited amount is never overwritten. Skips the first run (mount already seeded).
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    const wasPlanPrice = GUILEO_PLANS.some((p) => amount === p.price || amount === p.priceBR);
    const cur = GUILEO_PLANS.find((p) => ["GUI-ESSENTIAL", "GUI-PRO", "GUI-FULL"][GUILEO_PLANS.indexOf(p)] === code) || GUILEO_PLANS[1];
    if (wasPlanPrice) setAmount(planPrice(cur, market));
  }, [market]); // eslint-disable-line react-hooks/exhaustive-deps
  // 🚨 O TELEFONE VEM DO LEAD (corrigido 2026-08-21). O lead manda `phone` no handoff desde que
  // os atalhos foram criados, e este campo nascia vazio — então o vendedor, com o cliente na
  // linha, redigitava um número que o hub já tinha. Redigitar é onde ele desiste do documento.
  const [phone, setPhone] = useState(() => (handoff?.phone || "").toString());
  const [copied, setCopied] = useState(false);
  // Email-to-self state: idle | sending | sent | error (forward model — recipient is the seller's own inbox).
  const [emailState, setEmailState] = useState("idle");

  const body = useMemo(
    () => buildBody({ scope: "guileo_client", code, lang: docLang, kind: "quote",
      provider: { name: sellerName ? `${sellerName} · Guileo` : "Guileo" },
      counterparty: { name: client }, amount }),
    [code, docLang, client, amount, sellerName]
  );

  const summary = useMemo(() => {
    const dl = (L((list.find((x) => x.code === code) || {}).deliverables, docLang) || []).slice(0, 4);
    return [
      `📄 ${body.title} — ${client || "—"}`,
      amount ? `💰 ${amount}` : "",
      ...dl.map((d) => `• ${d}`),
      body.timeline ? `⏱️ ${body.timeline}` : "",
    ].filter(Boolean).join("\n");
  }, [body, client, amount, code, docLang, list]);

  const print = () => {
    onQuote?.();
    document.body.classList.add("printing-quote");
    const done = () => { document.body.classList.remove("printing-quote"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => { window.print(); }, 30);
  };

  const field = "w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-[13px] text-g-word placeholder:text-g-muted/60 focus:outline-none focus:border-g-green/50";
  const canSend = !!client.trim();

  // Email the quote to the SELLER'S OWN inbox (sellerEmail) so they can forward it on to the client.
  const emailMe = async () => {
    if (!sid || emailState === "sending") return;
    setEmailState("sending");
    try {
      const r = await fetch("/api/quote-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // O destinatário NÃO vai mais no corpo: o servidor lê o e-mail do crachá assinado.
        // Mandar `to` daqui era o que transformava o endpoint num relé de e-mail com a marca.
        body: JSON.stringify({ sid, sellerName, clientName: client, summary, lang }),
      });
      const j = await r.json().catch(() => ({}));
      setEmailState(r.ok && j.ok ? "sent" : "error");
    } catch {
      setEmailState("error");
    }
    onQuote?.();
    setTimeout(() => setEmailState("idle"), 2500);
  };

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-extrabold text-g-word">{t.h}</div>
        <p className="text-[12.5px] text-g-muted mt-1">{t.sub}</p>
      </div>
      {/* canonical plan chips — one tap fills service + USD price from src/data/guileoPlans.js */}
      <div className="mb-4 flex flex-wrap gap-2">
        {GUILEO_PLANS.map((p, i) => {
          const c = ["GUI-ESSENTIAL", "GUI-PRO", "GUI-FULL"][i];
          const on = code === c;
          return (
            <button key={p.key} type="button" onClick={() => { setCode(c); setAmount(planPrice(p, market)); }}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-bold transition ${on ? "border-g-green/50 bg-g-green/[0.14] text-g-green" : "border-white/15 bg-white/[0.05] text-g-ink hover:text-g-word"}`}>
              {p.featured ? "⭐ " : ""}{p.name} · {planPrice(p, market)}
            </button>
          );
        })}
      </div>
      <div className="grid gap-6 lg:grid-cols-2 min-w-0">
        <div className="card p-5 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-[11px] text-g-muted sm:col-span-2">{t.service}
              <select value={code} onChange={(e) => setCode(e.target.value)} className={field}>
                {list.map((x) => <option key={x.code} value={x.code}>{x.icon} {L(x.name, docLang)}</option>)}
              </select>
            </label>
            <label className="text-[11px] text-g-muted">{t.lang}
              <select value={docLang} onChange={(e) => setDocLang(e.target.value)} className={field}>
                <option value="pt">Português</option><option value="en">English</option><option value="es">Español</option>
              </select>
            </label>
            <label className="text-[11px] text-g-muted">{t.amount}
              <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={market === "br" ? "R$ 1.500" : "$1,500"} className={field} />
            </label>
            <label className="text-[11px] text-g-muted">{t.client}
              <input value={client} onChange={(e) => setClient(e.target.value)} className={field} />
            </label>
            <label className="text-[11px] text-g-muted">{t.phone}
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 929…" className={field} />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={print} className="btn-bright text-[13px]">{t.print}</button>
            <a
              href={canSend ? waTo(phone, `${summary}\n\n— ${sellerName || "Guileo"}`) : undefined}
              target="_blank" rel="noopener"
              onClick={(e) => { if (!canSend) { e.preventDefault(); return; } onQuote?.(); }}
              className={`btn-ghost text-[13px] ${canSend ? "" : "opacity-40 pointer-events-none"}`}
            >{t.wa}</a>
            <button
              onClick={() => { navigator.clipboard?.writeText(summary); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="btn-ghost text-[13px]"
            >{copied ? t.copied : t.copy}</button>
            <button
              onClick={emailMe}
              disabled={!sellerEmail || emailState === "sending"}
              className={`btn-ghost text-[13px] ${(!sellerEmail) ? "opacity-40 pointer-events-none" : ""}`}
            >{emailState === "sending" ? t.sending : emailState === "sent" ? t.sent : t.emailMe}</button>
          </div>
          {emailState === "error" && <div className="text-[11px] text-g-copper mt-2">⚠️ —</div>}
          {!canSend && <div className="text-[11px] text-g-gold mt-2">{t.fill}</div>}
        </div>

        <div className="min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-black uppercase tracking-wide text-g-gold">{t.preview}</div>
            <span className="eyebrow text-[10px]">{t.ex}</span>
          </div>
          <motion.div
            key={code + docLang}
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
