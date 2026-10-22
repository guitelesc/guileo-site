import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { buildServiceContract } from "../data/serviceContracts.js";
import { GUILEO_PLANS, planByKey } from "../data/guileoPlans.js";
import ContractDoc from "./ContractDoc.jsx";

// Seller contract generator — a SALES tool, sibling of SellerQuote. It renders a premium SERVICE
// contract 100% client-side (buildServiceContract is pure) AND — desde 2026-08-20 — grava esse
// contrato no banco e devolve o LINK DE ASSINATURA. Antes desta ligação a tela montava um
// documento bonito que morria ali: nada gravado, nenhum link, nada em "propostas em aberto".
//
// O CAMINHO INTEIRO, que agora existe:
//   montar → 💾 GRAVAR (/api/contract action:upsert → id) → buscar o token (action:list) →
//   link /sign?t=… → mandar (WhatsApp/e-mail/copiar → marca `sent`) → o cliente assina →
//   ↻ atualizar mostra `assinado`.
//
// TRÊS REGRAS QUE MANDAM NO DESENHO (pesquisa, não gosto):
//  • PDF NÃO É A AÇÃO PRINCIPAL. Mandar o cliente imprimir derruba conversão em toda edição do
//    estudo (45%→78%→84%→88%). O contrato é uma PÁGINA que se assina no link; imprimir é o botão
//    discreto lá embaixo.
//  • O VENDEDOR ASSINA PRIMEIRO (+26%, depois +65%). Ao gravar, a assinatura do nosso lado já
//    entra no snapshot congelado: o cliente recebe um documento JÁ assinado por nós.
//  • ENVIAR EM ATÉ 24H (+19% a +42%). O relógio de cada contrato fica na tela e vira aviso ⏰
//    quando passa de um dia sem assinatura.
//
// 🚨 COMPROVANTE: só dizemos "gravado" depois de LER um `id` de verdade na resposta. `r.ok` não
// decide nada — este repo já mostrou "fechou!" sobre banco vazio. Sem id/token → erro com o motivo
// CRU na tela.

const U = {
  pt: {
    h: "Contrato", sub: "Monte, grave e mande o link. O cliente assina no celular — sem PDF, sem imprimir.",
    plan: "Plano", docLang: "Idioma do documento", client: "Nome do cliente", email: "E-mail do cliente",
    amount: "Valor", start: "Data de início",
    save: "💾 Gravar e gerar link", saving: "Gravando…", resave: "💾 Regravar com estas mudanças",
    link: "Link de assinatura", copyLink: "🔗 Copiar link", copied: "Copiado ✓",
    wa: "💬 Mandar no WhatsApp", mail: "✉️ Mandar por e-mail", open: "↗ Abrir como o cliente vê",
    print: "🖨️ Imprimir", copy: "📋 Copiar resumo",
    preview: "Pré-visualização", banner: "⚠️ Modelo — revise com um advogado antes de assinar.",
    waNote: "Segue o contrato pra assinar — é só abrir o link, conferir e assinar pelo celular.",
    needClient: "Escreva o nome do cliente antes de gravar.",
    failed: "Não gravei o contrato", raw: "Resposta crua do servidor:",
    noToken: "Gravei o contrato (id ok) mas NÃO consegui o link de assinatura. Não mande nada ainda.",
    mine: "Meus contratos", refresh: "↻ Atualizar", empty: "Nenhum contrato gravado ainda.",
    st_draft: "rascunho", st_sent: "enviado", st_signed: "ASSINADO", st_void: "cancelado",
    ago: (h) => (h < 1 ? "agora há pouco" : h < 24 ? `há ${h}h` : `há ${Math.floor(h / 24)}d`),
    late: "⏰ passou de 24h sem assinar — cobre o retorno hoje",
    signedBy: (n) => `assinado por ${n}`,
    ours: "Já assinado do nosso lado",
    loadErr: "Não consegui carregar seus contratos",
    unauth: "Sua sessão de vendedor não foi aceita. Entre de novo com seu código pessoal.",
  },
  en: {
    h: "Contract", sub: "Build it, save it, send the link. The client signs on their phone — no PDF, no printing.",
    plan: "Plan", docLang: "Document language", client: "Client name", email: "Client email",
    amount: "Amount", start: "Start date",
    save: "💾 Save & get link", saving: "Saving…", resave: "💾 Re-save with these changes",
    link: "Signature link", copyLink: "🔗 Copy link", copied: "Copied ✓",
    wa: "💬 Send on WhatsApp", mail: "✉️ Send by email", open: "↗ Open as the client sees it",
    print: "🖨️ Print", copy: "📋 Copy summary",
    preview: "Preview", banner: "⚠️ Template — have a lawyer review it before signing.",
    waNote: "Here's the contract to sign — just open the link, review and sign on your phone.",
    needClient: "Type the client's name before saving.",
    failed: "I did not save the contract", raw: "Raw server response:",
    noToken: "Saved the contract (id ok) but I could NOT get the signature link. Don't send anything yet.",
    mine: "My contracts", refresh: "↻ Refresh", empty: "No contracts saved yet.",
    st_draft: "draft", st_sent: "sent", st_signed: "SIGNED", st_void: "void",
    ago: (h) => (h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`),
    late: "⏰ over 24h unsigned — chase it today",
    signedBy: (n) => `signed by ${n}`,
    ours: "Already signed on our side",
    loadErr: "I couldn't load your contracts",
    unauth: "Your seller session wasn't accepted. Sign in again with your personal code.",
  },
  es: {
    h: "Contrato", sub: "Ármalo, guárdalo y manda el enlace. El cliente firma en el celular — sin PDF.",
    plan: "Plan", docLang: "Idioma del documento", client: "Nombre del cliente", email: "E-mail del cliente",
    amount: "Monto", start: "Fecha de inicio",
    save: "💾 Guardar y generar enlace", saving: "Guardando…", resave: "💾 Volver a guardar",
    link: "Enlace de firma", copyLink: "🔗 Copiar enlace", copied: "Copiado ✓",
    wa: "💬 Enviar por WhatsApp", mail: "✉️ Enviar por e-mail", open: "↗ Abrir como lo ve el cliente",
    print: "🖨️ Imprimir", copy: "📋 Copiar resumen",
    preview: "Vista previa", banner: "⚠️ Modelo — que un abogado lo revise antes de firmar.",
    waNote: "Aquí está el contrato para firmar — abre el enlace, revisa y firma desde el celular.",
    needClient: "Escribe el nombre del cliente antes de guardar.",
    failed: "No guardé el contrato", raw: "Respuesta cruda del servidor:",
    noToken: "Guardé el contrato (id ok) pero NO obtuve el enlace de firma. No envíes nada todavía.",
    mine: "Mis contratos", refresh: "↻ Actualizar", empty: "Aún no hay contratos guardados.",
    st_draft: "borrador", st_sent: "enviado", st_signed: "FIRMADO", st_void: "anulado",
    ago: (h) => (h < 1 ? "recién" : h < 24 ? `hace ${h}h` : `hace ${Math.floor(h / 24)}d`),
    late: "⏰ más de 24h sin firmar — dale seguimiento hoy",
    signedBy: (n) => `firmado por ${n}`,
    ours: "Ya firmado de nuestro lado",
    loadErr: "No pude cargar tus contratos",
    unauth: "Tu sesión de vendedor no fue aceptada. Entra de nuevo con tu código personal.",
  },
  hi: {
    h: "अनुबंध", sub: "बनाएं, सेव करें और लिंक भेजें। ग्राहक फ़ोन पर ही हस्ताक्षर करता है — कोई PDF नहीं।",
    plan: "प्लान", docLang: "दस्तावेज़ भाषा", client: "ग्राहक का नाम", email: "ग्राहक का ई-मेल",
    amount: "राशि", start: "आरंभ तिथि",
    save: "💾 सेव करें और लिंक बनाएं", saving: "सेव हो रहा है…", resave: "💾 दोबारा सेव करें",
    link: "हस्ताक्षर लिंक", copyLink: "🔗 लिंक कॉपी करें", copied: "कॉपी ✓",
    wa: "💬 WhatsApp पर भेजें", mail: "✉️ ई-मेल से भेजें", open: "↗ ग्राहक की तरह देखें",
    print: "🖨️ प्रिंट", copy: "📋 सारांश कॉपी करें",
    preview: "पूर्वावलोकन", banner: "⚠️ टेम्पलेट — हस्ताक्षर से पहले वकील से समीक्षा कराएं।",
    waNote: "यह अनुबंध हस्ताक्षर के लिए है — लिंक खोलें, देखें और फ़ोन से हस्ताक्षर करें।",
    needClient: "सेव करने से पहले ग्राहक का नाम लिखें।",
    failed: "अनुबंध सेव नहीं हुआ", raw: "सर्वर का कच्चा उत्तर:",
    noToken: "अनुबंध सेव हुआ (id ok) पर हस्ताक्षर लिंक नहीं मिला। अभी कुछ न भेजें।",
    mine: "मेरे अनुबंध", refresh: "↻ रिफ़्रेश", empty: "अभी कोई अनुबंध सेव नहीं है।",
    st_draft: "ड्राफ़्ट", st_sent: "भेजा गया", st_signed: "हस्ताक्षरित", st_void: "रद्द",
    ago: (h) => (h < 1 ? "अभी" : h < 24 ? `${h}घं पहले` : `${Math.floor(h / 24)}दि पहले`),
    late: "⏰ 24घं से ज़्यादा बिना हस्ताक्षर — आज फ़ॉलो-अप करें",
    signedBy: (n) => `${n} द्वारा हस्ताक्षरित`,
    ours: "हमारी ओर से पहले ही हस्ताक्षरित",
    loadErr: "आपके अनुबंध लोड नहीं हो सके",
    unauth: "आपका सेलर सेशन स्वीकार नहीं हुआ। अपने निजी कोड से दोबारा साइन इन करें।",
  },
};

// Canonical price string for a plan in the active market (USD default, BRL when market="br").
const planPrice = (p, market) => (market === "br" ? p.priceBR : p.price);
// hi documents fall back to en (contracts ship in pt|en|es only).
const docLangFor = (l) => (l === "hi" ? "en" : l);

// Centavos para o banco. NUNCA redigitamos preço: o valor canônico vem de guileoPlans.js e só
// caímos no parse quando o vendedor digitou um número à mão. Formato BR ("R$ 2.499") usa ponto de
// milhar e vírgula decimal — trocar os dois é o que já colocou plano em R$ ao lado de add-on em $.
function amountToCents(amountStr, planKey, market) {
  const plan = planByKey(planKey);
  const canon = planPrice(plan, market);
  if (String(amountStr).trim() === String(canon).trim()) {
    return Math.round((market === "br" ? plan.amountBR : plan.amount) * 100);
  }
  let s = String(amountStr || "").split("/")[0].replace(/[^\d.,]/g, "");
  if (market === "br") s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

const STATUS_TONE = {
  signed: "border-g-green/45 bg-g-green/[0.12] text-g-green",
  sent: "border-g-gold/40 bg-g-gold/[0.10] text-g-gold",
  draft: "border-white/15 bg-white/[0.05] text-g-muted",
  void: "border-white/10 bg-white/[0.03] text-g-muted",
};

export default function SellerContract({ lang = "pt", seller = null, market = "us", handoff = null }) {
  const t = U[lang] || U.en;
  const sellerName = seller?.name || "";
  const [planKey, setPlanKey] = useState("growth");
  const [docLang, setDocLang] = useState(docLangFor(lang));
  const [client, setClient] = useState(() => handoff?.client || "");
  const [email, setEmail] = useState(() => handoff?.email || "");
  const [amount, setAmount] = useState(() => planPrice(planByKey("growth"), market));
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [copied, setCopied] = useState("");

  // ── estado do que EXISTE NO BANCO (nunca inferido da tela) ──────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState(null);       // { msg, cru } — o motivo CRU vai pra tela
  const [saved, setSaved] = useState(null);     // { id, token, status, created_at } — só com id+token reais
  const [docs, setDocs] = useState(null);       // null = ainda não busquei · [] = vazio de verdade
  const [listErr, setListErr] = useState(null);
  const [agora, setAgora] = useState(() => Date.now());

  // relógio das 24h — recalcula de minuto em minuto sem re-render pesado
  useEffect(() => { const id = setInterval(() => setAgora(Date.now()), 60000); return () => clearInterval(id); }, []);

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    const wasPlanPrice = GUILEO_PLANS.some((p) => amount === p.price || amount === p.priceBR);
    if (wasPlanPrice) setAmount(planPrice(planByKey(planKey), market));
  }, [market]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickPlan = (p) => { setPlanKey(p.key); setAmount(planPrice(p, market)); setSaved(null); };

  // O VENDEDOR ASSINA PRIMEIRO: a assinatura do nosso lado entra no snapshot congelado, então o
  // cliente abre um documento que já está assinado por nós. Barato, e quase ninguém faz.
  const providerSignature = useMemo(() => ({
    name: sellerName ? `${sellerName} · Guileo` : "Guileo",
    at: new Date().toISOString().slice(0, 10),
  }), [sellerName]);

  const body = useMemo(
    () => ({
      ...buildServiceContract({
        planKey, lang: docLang, market,
        provider: { name: sellerName ? `${sellerName} · Guileo` : "Guileo" },
        client: { name: client, email },
        amount, startDate: start,
      }),
      amount,
      providerSignature,
    }),
    [planKey, docLang, market, sellerName, client, email, amount, start, providerSignature]
  );

  const summary = useMemo(() => {
    const dl = (body?.deliverables || []).slice(0, 4);
    return [
      `📄 ${body?.title || ""}${client ? ` — ${client}` : ""}`,
      amount ? `💰 ${amount}` : "",
      body?.timeline ? `⏱️ ${body.timeline}` : "",
      ...dl.map((d) => `• ${d}`),
    ].filter(Boolean).join("\n");
  }, [body, client, amount]);

  const auth = useCallback(() => ({ seller_email: seller?.email || "", seller_code: seller?.code || "" }), [seller]);

  // Carrega o que o BANCO tem — a única fonte de "propostas em aberto".
  const carregar = useCallback(async () => {
    setListErr(null);
    try {
      const r = await fetch("/api/contract", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", ...auth(), limit: 50 }),
      });
      const d = await r.json().catch(() => null);
      if (r.status === 401) { setListErr(t.unauth); setDocs([]); return null; }
      if (!r.ok || !d || !Array.isArray(d.docs)) {
        setListErr(`${t.loadErr} — HTTP ${r.status} · ${JSON.stringify(d).slice(0, 200)}`);
        setDocs([]); return null;
      }
      setDocs(d.docs);
      return d.docs;
    } catch (e) { setListErr(`${t.loadErr} — ${String(e).slice(0, 160)}`); setDocs([]); return null; }
  }, [auth, t]);

  useEffect(() => { if (seller?.email) carregar(); }, [seller?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  // GRAVAR — e só depois de LER o id e o token dizer que gravou.
  const gravar = async (status = "draft") => {
    if (!client.trim()) { setErro({ msg: t.needClient, cru: "" }); return null; }
    setSaving(true); setErro(null);
    try {
      const r = await fetch("/api/contract", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert", ...auth(),
          id: saved?.id || null,
          kind: "contract", scope: "guileo_client",
          template: body.template_code || null,
          lang: docLang, title: body.title,
          counterparty_name: client.trim(), counterparty_email: email.trim() || null,
          amount_cents: amountToCents(amount, planKey, market),
          body, status,
        }),
      });
      const d = await r.json().catch(() => null);
      // 🚨 A LEI DA CASA: id de verdade, ou é erro com o motivo cru.
      const id = d && typeof d.id === "string" ? d.id : "";
      if (!id) {
        setErro({ msg: r.status === 401 ? t.unauth : t.failed, cru: `HTTP ${r.status} · ${JSON.stringify(d)}`.slice(0, 400) });
        return null;
      }
      // O token de assinatura NÃO vem do upsert — quem o devolve é contract_list. Sem token não há
      // link, e sem link não existe "enviado": por isso a tela só libera o envio depois de lê-lo.
      const lista = await carregar();
      const row = (lista || []).find((x) => x.id === id);
      if (!row || !row.sign_token) {
        setErro({ msg: t.noToken, cru: `id=${id} · ${JSON.stringify(row || null).slice(0, 200)}` });
        return null;
      }
      const rec = { id, token: row.sign_token, status: row.status, created_at: row.created_at };
      setSaved(rec);
      return rec;
    } catch (e) {
      setErro({ msg: t.failed, cru: String(e).slice(0, 300) });
      return null;
    } finally { setSaving(false); }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "https://guileoai.com";
  const signUrl = saved?.token ? `${origin}/sign?t=${saved.token}` : "";

  // Mandar = marcar `sent` no banco ANTES de abrir o canal. Se a marcação falhar o vendedor vê o
  // erro, mas o link continua válido — a marcação é contabilidade, não o produto.
  const marcarEnviado = async () => {
    if (!saved || saved.status === "signed") return;
    await gravar("sent");
  };

  const waHref = signUrl
    ? `https://wa.me/?text=${encodeURIComponent(`${summary}\n\n${t.waNote}\n${signUrl}\n\n— ${sellerName || "Guileo"}`)}`
    : "";
  const mailHref = signUrl
    ? `mailto:${encodeURIComponent(email || "")}?subject=${encodeURIComponent(body.title || "Contrato")}&body=${encodeURIComponent(`${t.waNote}\n\n${signUrl}\n\n${summary}\n\n— ${sellerName || "Guileo"}`)}`
    : "";

  const print = () => {
    document.body.classList.add("printing-quote");
    const done = () => { document.body.classList.remove("printing-quote"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => { window.print(); }, 30);
  };

  // clipboard.writeText devolve PROMISE que rejeita (aba sem foco, permissão negada) — sem catch
  // isso vira "Uncaught (in promise)" no console do vendedor. O aviso de copiado só sobe se copiou.
  const copiar = (txt, tag) => {
    const p = navigator.clipboard?.writeText(txt);
    if (!p) return;
    p.then(() => { setCopied(tag); setTimeout(() => setCopied(""), 1600); }).catch(() => {});
  };

  const horas = (iso) => Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 3600000));
  const field = "w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-[13px] text-g-word placeholder:text-g-muted/60 focus:outline-none focus:border-g-green/50";

  const Selo = ({ st }) => (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${STATUS_TONE[st] || STATUS_TONE.draft}`}>
      {t[`st_${st}`] || st}
    </span>
  );

  return (
    <div>
      <div className="mb-4">
        <div className="text-lg font-extrabold text-g-word">{t.h}</div>
        <p className="text-[12.5px] text-g-muted mt-1">{t.sub}</p>
      </div>

      <div className="mb-4 rounded-lg border border-g-gold/30 bg-g-gold/[0.08] px-3 py-2 text-[12px] text-g-gold">
        {t.banner}
      </div>

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
        <div className="min-w-0">
          <div className="card p-5 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-[11px] text-g-muted">{t.docLang}
                <select value={docLang} onChange={(e) => { setDocLang(e.target.value); setSaved(null); }} className={field}>
                  <option value="en">🇺🇸 English</option>
                  <option value="es">🇪🇸 Español</option>
                  <option value="pt">🇧🇷 Português</option>
                </select>
              </label>
              <label className="text-[11px] text-g-muted">{t.amount}
                {/* Placeholder era "$449" (preço antigo) e "R$ 2.499" (moeda sem checkout — nunca
                    existiu link de pagamento em real; amountBRL em guileoPlans.js é null). Os dois
                    prometiam algo que o botão de baixo não cobra. Preço-âncora agora vem da fonte,
                    sempre em dólar — a única moeda que o Stripe realmente cobra aqui. */}
                <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(planByKey("growth").amount)} className={field} />
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

            {/* AÇÃO PRINCIPAL: gravar e virar link. Imprimir vive lá embaixo, discreto. */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => gravar(saved ? saved.status : "draft")} disabled={saving} className="btn-bright text-[13px] disabled:opacity-60">
                {saving ? t.saving : (saved ? t.resave : t.save)}
              </button>
              <button onClick={() => copiar(summary, "sum")} className="btn-ghost text-[13px]">
                {copied === "sum" ? t.copied : t.copy}
              </button>
            </div>

            {erro && (
              <div className="mt-3 rounded-xl border border-[#E5484D]/40 bg-[#E5484D]/[0.08] px-3.5 py-3">
                <div className="text-[12.5px] font-black text-[#FF7A7E]">{erro.msg}</div>
                {erro.cru && (
                  <>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-g-muted">{t.raw}</div>
                    <pre className="mt-0.5 max-w-full overflow-x-auto whitespace-pre-wrap break-all text-[11px] leading-snug text-g-ink">{erro.cru}</pre>
                  </>
                )}
              </div>
            )}

            {/* O LINK — só aparece quando existe token de verdade vindo do banco. */}
            {saved?.token && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
                className="mt-4 rounded-xl2 border border-g-green/35 bg-g-green/[0.07] p-4 backdrop-blur-md"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Selo st={saved.status} />
                  <span className="text-[11px] text-g-muted">{t.ago(horas(saved.created_at))}</span>
                  <span className="text-[11px] text-g-green">✍️ {t.ours}</span>
                </div>
                <div className="mt-2 text-[10px] font-black uppercase tracking-wide text-g-muted">{t.link}</div>
                <div className="mt-0.5 break-all rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-[11.5px] text-g-ink">{signUrl}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={waHref} target="_blank" rel="noopener" onClick={marcarEnviado}
                    className="min-h-[44px] inline-flex items-center rounded-full bg-g-green/15 px-4 text-[12.5px] font-bold text-g-green ring-1 ring-g-green/40 hover:bg-g-green/25">{t.wa}</a>
                  <a href={mailHref} onClick={marcarEnviado}
                    className="min-h-[44px] inline-flex items-center rounded-full border border-white/15 bg-white/[0.05] px-4 text-[12.5px] font-bold text-g-ink hover:text-g-word">{t.mail}</a>
                  <button onClick={() => { copiar(signUrl, "link"); marcarEnviado(); }}
                    className="min-h-[44px] inline-flex items-center rounded-full border border-white/15 bg-white/[0.05] px-4 text-[12.5px] font-bold text-g-ink hover:text-g-word">
                    {copied === "link" ? t.copied : t.copyLink}
                  </button>
                  <a href={signUrl} target="_blank" rel="noopener"
                    className="min-h-[44px] inline-flex items-center px-2 text-[12px] font-bold text-g-muted underline hover:text-g-word">{t.open}</a>
                </div>
              </motion.div>
            )}

            {/* imprimir = ação SECUNDÁRIA e discreta (o PDF derruba conversão). */}
            <button onClick={print} className="mt-3 text-[11.5px] text-g-muted underline hover:text-g-word">{t.print}</button>
          </div>

          {/* ── MEUS CONTRATOS: o que o BANCO tem, com o relógio das 24h ────────────────────────── */}
          <div className="card mt-4 p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-black uppercase tracking-wide text-g-gold">{t.mine}</div>
              <button onClick={carregar} className="text-[11.5px] font-bold text-g-muted hover:text-g-word">{t.refresh}</button>
            </div>
            {listErr && <div className="mt-2 rounded-lg border border-[#E5484D]/40 bg-[#E5484D]/[0.08] px-3 py-2 text-[11.5px] text-[#FF7A7E] break-words">{listErr}</div>}
            {docs && docs.length === 0 && !listErr && <p className="mt-2 text-[12px] text-g-muted">{t.empty}</p>}
            {docs && docs.length > 0 && (
              <ul className="mt-3 space-y-2">
                {docs.map((d) => {
                  const h = horas(d.created_at);
                  const atrasado = d.status !== "signed" && h >= 24;
                  return (
                    <li key={d.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Selo st={d.status} />
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-g-word">{d.counterparty_name || d.title || "—"}</span>
                        <span className="text-[11px] text-g-muted">{t.ago(h)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-g-muted">
                        <span className="truncate">{d.title}</span>
                        {d.signer_name && <span className="text-g-green">✓ {t.signedBy(d.signer_name)}</span>}
                        {d.sign_token && (
                          <button onClick={() => copiar(`${origin}/sign?t=${d.sign_token}`, d.id)} className="font-bold text-g-ink underline hover:text-g-word">
                            {copied === d.id ? t.copied : t.copyLink}
                          </button>
                        )}
                      </div>
                      {atrasado && <div className="mt-1.5 text-[11px] font-bold text-g-gold">{t.late}</div>}
                    </li>
                  );
                })}
              </ul>
            )}
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
            <ContractDoc body={body} lang={docLang} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
