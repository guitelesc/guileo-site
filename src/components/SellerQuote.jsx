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
    emailMe: "✉️ Email pra mim", sending: "Enviando…", sent: "Enviado ✓",
    saveLink: "🔗 Salvar e gerar link", savingLink: "Salvando…", savedLink: "Link do cliente (copie e mande)", copyLink: "📋 Copiar link", linkCopied: "Copiado ✓",
    saveFail: "Não salvei — o banco não confirmou",
    openT: "Orçamentos em aberto", openNone: "Nenhum orçamento salvo ainda — salve o primeiro e ele aparece aqui com o link.",
    openErr: "Não consegui LER seus orçamentos. Isso NÃO quer dizer que não existem — tente de novo.",
    stOpen: "aberto", stViewed: "cliente abriu", stAccepted: "ACEITO ✓",
    ageNow: "agora", ageH: (n) => `há ${n}h`, ageD: (n) => `há ${n}d`, ageOld: "⏰ passou de 24h — cobre hoje", refresh: "↻ Atualizar" },
  en: { h: "Quote generator", sub: "Build a beautiful quote in 30 seconds — print, save as PDF, or send on WhatsApp.",
    service: "Service", lang: "Document language", client: "Client name", amount: "Amount (e.g. $1,500/mo)", phone: "Client WhatsApp (optional)",
    print: "🖨️ Print / PDF", wa: "💬 Send on WhatsApp", copy: "Copy summary", copied: "Copied ✓", preview: "Preview", ex: "Ready example", fill: "Add the client name to enable sending.",
    emailMe: "✉️ Email it to me", sending: "Sending…", sent: "Sent ✓",
    saveLink: "🔗 Save & get link", savingLink: "Saving…", savedLink: "Client link (copy and send)", copyLink: "📋 Copy link", linkCopied: "Copied ✓",
    saveFail: "Not saved — the database didn't confirm",
    openT: "Open quotes", openNone: "No saved quote yet — save the first one and it shows up here with its link.",
    openErr: "Couldn't READ your quotes. That does NOT mean there are none — try again.",
    stOpen: "open", stViewed: "client opened", stAccepted: "ACCEPTED ✓",
    ageNow: "just now", ageH: (n) => `${n}h ago`, ageD: (n) => `${n}d ago`, ageOld: "⏰ past 24h — chase it today", refresh: "↻ Refresh" },
  es: { h: "Generador de presupuesto", sub: "Crea un presupuesto lindo en 30 segundos — imprime, guarda en PDF o envía por WhatsApp.",
    service: "Servicio", lang: "Idioma del documento", client: "Nombre del cliente", amount: "Monto (ej: $1,500/mes)", phone: "WhatsApp del cliente (opcional)",
    print: "🖨️ Imprimir / PDF", wa: "💬 Enviar por WhatsApp", copy: "Copiar resumen", copied: "Copiado ✓", preview: "Vista previa", ex: "Ejemplo listo", fill: "Agrega el nombre del cliente para habilitar el envío.",
    emailMe: "✉️ Enviar a mí", sending: "Enviando…", sent: "Enviado ✓",
    saveLink: "🔗 Guardar y generar enlace", savingLink: "Guardando…", savedLink: "Enlace del cliente (copia y envía)", copyLink: "📋 Copiar enlace", linkCopied: "Copiado ✓",
    saveFail: "No se guardó — la base no confirmó",
    openT: "Presupuestos abiertos", openNone: "Aún no hay presupuestos guardados — guarda el primero y aparece aquí con su enlace.",
    openErr: "No pude LEER tus presupuestos. Esto NO significa que no existan — inténtalo de nuevo.",
    stOpen: "abierto", stViewed: "el cliente lo abrió", stAccepted: "ACEPTADO ✓",
    ageNow: "ahora", ageH: (n) => `hace ${n}h`, ageD: (n) => `hace ${n}d`, ageOld: "⏰ pasó de 24h — insiste hoy", refresh: "↻ Actualizar" },
  hi: { h: "कोटेशन जेनरेटर", sub: "30 सेकंड में सुंदर कोटेशन बनाएं — प्रिंट करें, PDF सेव करें या WhatsApp पर भेजें।",
    service: "सेवा", lang: "दस्तावेज़ भाषा", client: "ग्राहक का नाम", amount: "राशि (जैसे $1,500/माह)", phone: "ग्राहक WhatsApp (वैकल्पिक)",
    print: "🖨️ प्रिंट / PDF", wa: "💬 WhatsApp पर भेजें", copy: "सारांश कॉपी करें", copied: "कॉपी ✓", preview: "पूर्वावलोकन", ex: "तैयार उदाहरण", fill: "भेजने के लिए ग्राहक का नाम जोड़ें।",
    emailMe: "✉️ मुझे ईमेल करें", sending: "भेज रहे हैं…", sent: "भेजा गया ✓",
    saveLink: "🔗 सेव करें और लिंक बनाएं", savingLink: "सेव हो रहा है…", savedLink: "ग्राहक लिंक (कॉपी करके भेजें)", copyLink: "📋 लिंक कॉपी करें", linkCopied: "कॉपी ✓",
    saveFail: "सेव नहीं हुआ — डेटाबेस ने पुष्टि नहीं की",
    openT: "खुले कोटेशन", openNone: "अभी कोई सेव किया कोटेशन नहीं — पहला सेव करें, वह लिंक के साथ यहाँ दिखेगा।",
    openErr: "आपके कोटेशन पढ़ नहीं सका। इसका मतलब यह नहीं कि कोई नहीं है — दोबारा कोशिश करें।",
    stOpen: "खुला", stViewed: "ग्राहक ने खोला", stAccepted: "स्वीकृत ✓",
    ageNow: "अभी", ageH: (n) => `${n} घंटे पहले`, ageD: (n) => `${n} दिन पहले`, ageOld: "⏰ 24 घंटे बीत गए — आज फ़ॉलो-अप करें", refresh: "↻ रिफ़्रेश" },
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
  // ── ORÇAMENTO PERSISTIDO + LINK DO CLIENTE (2026-08-25) ─────────────────────────────────────
  // Até aqui o orçamento morria na tela: nada gravava e o CLIENTE nunca recebia link nenhum.
  // Agora "Salvar e gerar link" grava em seller_quotes e devolve /orcamento/<token> — o caminho
  // que o cliente abre e aperta ACEITAR. Sem isto não existe follow-up nem "orçamento aberto".
  const [saveState, setSaveState] = useState("idle"); // idle | saving | ok | err
  const [saveErro, setSaveErro] = useState("");
  const [quote, setQuote] = useState(null);           // { id, token, url } do último salvo
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [abertos, setAbertos] = useState(null);       // null = carregando · [] = vazio de verdade
  const [abertosErro, setAbertosErro] = useState("");
  // O relógio da lista é gravado QUANDO A LISTA CHEGA (nunca lido durante o render): ler Date.now()
  // no meio do desenho torna a tela impura e o número muda a cada re-render sem motivo.
  const [agora, setAgora] = useState(0);

  const body = useMemo(
    () => buildBody({ scope: "guileo_client", code, lang: docLang, kind: "quote",
      provider: { name: sellerName ? `${sellerName} · Guileo` : "Guileo" },
      counterparty: { name: client }, amount }),
    [code, docLang, client, amount, sellerName]
  );

  // Os ITENS do orçamento, como lista — a MESMA fonte que o resumo imprime. O banco guarda este
  // snapshot congelado (igual ao `body` do contrato): o que o cliente abre amanhã é o que foi
  // ofertado hoje, mesmo que o catálogo mude.
  const itens = useMemo(
    () => (L((list.find((x) => x.code === code) || {}).deliverables, docLang) || []).slice(0, 8),
    [list, code, docLang]
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

  // Lista os orçamentos DESTE vendedor. Falha de leitura NUNCA vira "nenhum orçamento": lista
  // vazia por erro faz o vendedor refazer um documento que já existe (ou desistir dele).
  const carregaAbertos = async () => {
    if (!sid) return;
    setAbertosErro("");
    try {
      const r = await fetch("/api/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list", sid }) });
      const j = await r.json().catch(() => null);
      if (!j || j.ok !== true || !Array.isArray(j.rows)) { setAbertosErro((j && (j.motivo || j.erro || j.error)) || `HTTP ${r.status}`); return; }
      setAbertos(j.rows); setAgora(Date.now());
    } catch (e) { setAbertosErro(String(e).slice(0, 140)); }
  };
  useEffect(() => { carregaAbertos(); }, [sid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Salva e devolve o LINK. `ok` só depois de o servidor devolver id + token — um "salvo ✓" sem
  // comprovante é a promessa sem lastro que já custou pipeline inteiro neste hub.
  const salvarLink = async () => {
    if (!sid || saveState === "saving" || !client.trim()) return;
    setSaveState("saving"); setSaveErro("");
    try {
      const r = await fetch("/api/quote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save", sid, client_name: client, client_phone: phone,
          itens, total: amount, currency: market === "br" ? "BRL" : "USD", status: "sent",
        }),
      });
      const j = await r.json().catch(() => null);
      if (!j || j.ok !== true || !j.token) { setSaveState("err"); setSaveErro((j && (j.motivo || j.erro || j.error)) || `HTTP ${r.status}`); return; }
      setQuote({ id: j.id, token: j.token, url: `${window.location.origin}/orcamento/${j.token}` });
      setSaveState("ok");
      onQuote?.();
      carregaAbertos();
    } catch (e) { setSaveState("err"); setSaveErro(String(e).slice(0, 140)); }
  };

  // Idade do orçamento em palavras — e o destaque de 24h, que é a regra de ouro do follow-up:
  // orçamento parado mais de um dia esfria, e o vendedor precisa VER isso sem fazer conta.
  const idade = (iso) => {
    const ms = agora - new Date(iso || 0).getTime();
    if (!Number.isFinite(ms) || ms < 0) return "";
    const h = Math.floor(ms / 3600000);
    if (h < 1) return t.ageNow;
    return h < 24 ? t.ageH(h) : t.ageD(Math.floor(h / 24));
  };
  const velho = (iso) => agora - new Date(iso || 0).getTime() > 86400000;

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
        // o token vai junto quando o orçamento foi salvo: o servidor monta o link (nunca a URL
        // do corpo) e o repasse já sai com o botão de aceitar.
        body: JSON.stringify({ sid, sellerName, clientName: client, summary, lang, quoteToken: quote?.token || "" }),
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
            {/* 🔗 O BOTÃO QUE FALTAVA: grava o orçamento e devolve o link do CLIENTE. */}
            <button
              onClick={salvarLink}
              disabled={!sid || !canSend || saveState === "saving"}
              className={`btn-ghost text-[13px] ${(!sid || !canSend) ? "opacity-40 pointer-events-none" : ""}`}
            >{saveState === "saving" ? t.savingLink : t.saveLink}</button>
          </div>

          {/* O link só aparece quando o BANCO confirmou (id + token). Nunca antes. */}
          {saveState === "ok" && quote && (
            <div className="mt-3 rounded-xl border border-g-green/30 bg-g-green/[0.06] p-3">
              <div className="text-[11px] font-black uppercase tracking-wide text-g-green">{t.savedLink}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <a href={quote.url} target="_blank" rel="noopener" className="min-w-0 break-all text-[12.5px] font-bold text-g-word underline decoration-g-green/40">{quote.url}</a>
                <button type="button"
                  onClick={() => { navigator.clipboard?.writeText(quote.url); setLinkCopiado(true); setTimeout(() => setLinkCopiado(false), 1600); }}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-white/15 px-3.5 text-[12px] font-bold text-g-word hover:border-g-green/50">
                  {linkCopiado ? t.linkCopied : t.copyLink}
                </button>
              </div>
            </div>
          )}
          {saveState === "err" && <div className="mt-2 text-[11.5px] text-g-copper">⚠️ {t.saveFail}{saveErro ? ` · ${saveErro}` : ""}</div>}
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

      {/* ── 📂 ORÇAMENTOS EM ABERTO ─────────────────────────────────────────────────────────────
          Um orçamento que o vendedor não consegue reabrir amanhã é uma venda refeita do zero — ou
          não feita. A IDADE fica na frente porque é ela que manda cobrar: passou de 24h, o
          documento esfriou e a linha acende em âmbar. */}
      {sid && (
        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-[11px] font-black uppercase tracking-wide text-g-gold">{t.openT}</div>
            <button type="button" onClick={carregaAbertos}
              className="inline-flex min-h-[44px] items-center rounded-full border border-white/15 px-4 text-[11.5px] font-bold text-g-muted hover:text-g-word">{t.refresh}</button>
          </div>
          {abertosErro && <div className="rounded-xl border border-g-gold/30 bg-g-gold/[0.06] px-3.5 py-2.5 text-[12px] text-g-muted">⚠️ {t.openErr}<span className="block text-g-muted/80">{abertosErro}</span></div>}
          {!abertosErro && Array.isArray(abertos) && abertos.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[12px] text-g-muted">{t.openNone}</div>
          )}
          {!abertosErro && Array.isArray(abertos) && abertos.length > 0 && (
            <ul className="space-y-2">
              {abertos.map((q) => {
                const aceito = q.status === "accepted";
                const atrasado = !aceito && velho(q.created_at);
                return (
                  <li key={q.id} className={`rounded-xl border px-3.5 py-2.5 ${aceito ? "border-g-green/30 bg-g-green/[0.05]" : atrasado ? "border-g-gold/30 bg-g-gold/[0.05]" : "border-white/10 bg-white/[0.03]"}`}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-[13px] font-bold text-g-word">{q.client_name || "—"}</span>
                      <span className="text-[12.5px] font-black text-g-green">{q.total || "—"}</span>
                      <span className={`text-[11.5px] font-bold ${aceito ? "text-g-green" : "text-g-muted"}`}>
                        {aceito ? t.stAccepted : q.status === "viewed" ? t.stViewed : t.stOpen}
                      </span>
                      <span className="text-[11.5px] text-g-muted">{idade(q.created_at)}</span>
                      {atrasado && <span className="text-[11.5px] font-bold text-g-gold">{t.ageOld}</span>}
                      <button type="button"
                        onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/orcamento/${q.token}`); setLinkCopiado(true); setTimeout(() => setLinkCopiado(false), 1600); }}
                        className="ml-auto inline-flex min-h-[44px] items-center rounded-full border border-white/15 px-3.5 text-[11.5px] font-bold text-g-word hover:border-g-gold/50">
                        {t.copyLink}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
