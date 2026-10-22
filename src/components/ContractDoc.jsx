import { useEffect, useState } from "react";

// Renders a frozen contract/quote body snapshot as a clean, print-ready document.
// Used by the public /sign page and the client portal Documents area. White paper look.
//
// CLÁUSULA RECOLHIDA ≠ CLÁUSULA ESCONDIDA (2026-08-20). O título e a linha em palavras simples
// (body.clauses[i][3], de CLAUSE_PLAIN) ficam SEMPRE visíveis; só o texto integral se recolhe, e
// abre num toque. O que tem que ser mínimo é o que a pessoa PRECISA FAZER, não o contrato. Ao
// imprimir, tudo abre sozinho (beforeprint) — via impressa é documento inteiro, sempre.
const MORE = {
  pt: { open: "▾ ler o texto integral", close: "▴ ocultar o texto integral" },
  en: { open: "▾ read the full text", close: "▴ hide the full text" },
  es: { open: "▾ leer el texto completo", close: "▴ ocultar el texto completo" },
  hi: { open: "▾ पूरा पाठ पढ़ें", close: "▴ पूरा पाठ छिपाएं" },
};

// ── ASSINATURA PRÓPRIA v2 (2026-10-04) ─────────────────────────────────────────────────────────
// Peças novas, todas OPCIONAIS — só desenham quando o corpo traz o dado. Um contrato antigo (sem
// annexes/summaryRows/translations/theme) sai exatamente como saía.
//   body.summaryRows   [[rótulo, valor]]          → caixa de resumo no topo
//   body.annexes       [{title,intro,parts:[{title,terms,items:[{text,status}]}]}] → anexo com pílulas
//   body.parent_contract_id (+ parent_title)      → "Joinder to <título>" (2º signatário, link próprio)
//   body.theme = "natura-deck"                    → tipografia/cores do deck da Natura
//   record (prop)                                 → assinatura do prestador, do cliente, SHA-256
export const PILL = {
  live:       { c: "#1F6B49", dot: "#2F8A60", bg: "rgba(47,138,96,0.09)",  en: "Live", pt: "No ar", es: "En vivo", hi: "चालू" },
  activation: { c: "#6F695D", dot: "#6F695D", bg: "rgba(111,105,93,0.08)", en: "In activation", pt: "Em ativação", es: "En activación", hi: "सक्रिय हो रहा है" },
  pending:    { c: "#6F695D", dot: "#6F695D", bg: "rgba(111,105,93,0.08)", en: "Waiting · approval", pt: "Aguardando aprovação", es: "Esperando · aprobación", hi: "प्रतीक्षा · स्वीकृति" },
  ready:      { c: "#8E6D2C", dot: "#8E6D2C", bg: "rgba(142,109,44,0.09)", en: "Ready · your call", pt: "Pronto · depende de você", es: "Listo · tu decisión", hi: "तैयार · आपका निर्णय" },
  planned:    { c: "#8E6D2C", dot: "#8E6D2C", bg: "rgba(142,109,44,0.09)", en: "Planned", pt: "Planejado", es: "Planificado", hi: "नियोजित" },
  future:     { c: "#6F695D", dot: "#6F695D", bg: "rgba(111,105,93,0.08)", en: "Future · on request", pt: "Futuro · sob pedido", es: "Futuro · a pedido", hi: "भविष्य · अनुरोध पर" },
};
// nome do idioma QUE VALE, escrito no idioma de quem lê
export const LANG_NAME = {
  en: { pt: "inglês", en: "English", es: "inglés", hi: "अंग्रेज़ी" },
  pt: { pt: "português", en: "Portuguese", es: "portugués", hi: "पुर्तगाली" },
  es: { pt: "espanhol", en: "Spanish", es: "español", hi: "स्पेनिश" },
  hi: { pt: "hindi", en: "Hindi", es: "hindi", hi: "हिन्दी" },
};
const DL = {
  pt: { joinder: "Adesão a", courtesy: (g) => `Tradução de cortesia — a versão em ${g} é a que vale.`, glance: "Resumo", annex: "Anexo", provider: "Prestador", client: "Cliente",
        signedBy: "Assinado por", cert: "Certificado de assinatura eletrônica", fp: "Impressão digital do documento (SHA-256)", fpNote: "Calculada sobre o JSON canônico do documento (corpo, título e idioma — inclui a tradução). Qualquer alteração muda este código.",
        vOk: "✓ Conferido agora no seu navegador: o documento exibido é exatamente o assinado.", vBad: "✗ ATENÇÃO: o documento exibido NÃO corresponde à impressão digital registrada.", vWait: "Conferindo no seu navegador…",
        when: "Data/hora (UTC)", ip: "IP", gov: "Idioma que vale", waiting: "Aguardando assinatura", elec: "Assinado eletronicamente", provHash: "Hash assinado pelo prestador" },
  en: { joinder: "Joinder to", courtesy: (g) => `Courtesy translation — the ${g} version governs.`, glance: "Summary", annex: "Annex", provider: "Provider", client: "Client",
        signedBy: "Signed by", cert: "Electronic signature certificate", fp: "Document fingerprint (SHA-256)", fpNote: "Computed over the canonical JSON of the document (body, title and language — the translation included). Any change alters this code.",
        vOk: "✓ Checked just now in your browser: the document shown is exactly the one signed.", vBad: "✗ WARNING: the document shown does NOT match the recorded fingerprint.", vWait: "Checking in your browser…",
        when: "Date/time (UTC)", ip: "IP", gov: "Governing language", waiting: "Awaiting signature", elec: "Electronically signed", provHash: "Hash signed by the provider" },
  es: { joinder: "Adhesión a", courtesy: (g) => `Traducción de cortesía — la versión en ${g} es la que vale.`, glance: "Resumen", annex: "Anexo", provider: "Proveedor", client: "Cliente",
        signedBy: "Firmado por", cert: "Certificado de firma electrónica", fp: "Huella del documento (SHA-256)", fpNote: "Calculada sobre el JSON canónico del documento (cuerpo, título e idioma — incluye la traducción). Cualquier cambio altera este código.",
        vOk: "✓ Verificado ahora en tu navegador: el documento mostrado es exactamente el firmado.", vBad: "✗ ATENCIÓN: el documento mostrado NO coincide con la huella registrada.", vWait: "Verificando en tu navegador…",
        when: "Fecha/hora (UTC)", ip: "IP", gov: "Idioma que vale", waiting: "Esperando firma", elec: "Firmado electrónicamente", provHash: "Hash firmado por el proveedor" },
  hi: { joinder: "सम्मिलन —", courtesy: (g) => `शिष्टाचार अनुवाद — ${g} संस्करण ही मान्य है।`, glance: "सारांश", annex: "अनुलग्नक", provider: "प्रदाता", client: "ग्राहक",
        signedBy: "हस्ताक्षरकर्ता", cert: "इलेक्ट्रॉनिक हस्ताक्षर प्रमाणपत्र", fp: "दस्तावेज़ फ़िंगरप्रिंट (SHA-256)", fpNote: "दस्तावेज़ के कैनोनिकल JSON (मुख्य भाग, शीर्षक और भाषा — अनुवाद सहित) पर गणना। कोई भी बदलाव यह कोड बदल देता है।",
        vOk: "✓ अभी आपके ब्राउज़र में जाँचा गया: दिखाया गया दस्तावेज़ वही है जिस पर हस्ताक्षर हुए।", vBad: "✗ चेतावनी: दिखाया गया दस्तावेज़ दर्ज फ़िंगरप्रिंट से मेल नहीं खाता।", vWait: "आपके ब्राउज़र में जाँच हो रही है…",
        when: "दिनांक/समय (UTC)", ip: "IP", gov: "मान्य भाषा", waiting: "हस्ताक्षर की प्रतीक्षा", elec: "इलेक्ट्रॉनिक रूप से हस्ताक्षरित", provHash: "प्रदाता द्वारा हस्ताक्षरित हैश" },
};
export const utc = (d) => { try { return new Date(d).toISOString().replace("T", " ").slice(0, 19) + " UTC"; } catch { return ""; } };
const LOCALE = { pt: "pt-BR", es: "es-ES", hi: "hi-IN", en: "en-US" };
export const diaLocal = (d, lang) => { try { return new Date(d).toLocaleDateString(LOCALE[lang] || "en-US", { year: "numeric", month: "long", day: "numeric" }); } catch { return ""; } };

// paletas — a padrão é a do papel de sempre; a natura-deck é a do deck aprovado (01/10)
const PAL = {
  default: { ink: "#111827", muted: "#6b7280", gold: "#8E6D2C", line: "#e5e7eb", fill: "#f9fafb", box: "#e5e7eb", warn: "#A8432B", sans: undefined, mono: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  "natura-deck": { ink: "#161512", muted: "#6F695D", gold: "#8E6D2C", line: "#E4DDCC", fill: "#FAF7F0", box: "#B9B09A", warn: "#A8432B", sans: "'Inter', system-ui, sans-serif", mono: "'IBM Plex Mono', ui-monospace, Menlo, monospace" },
};
const monoLbl = (P) => ({ fontFamily: P.mono, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: P.muted });

// As pílulas DO DECK (.pill.live / .ready / .wait / .plan): texto + forma + cor, nunca só cor —
// bolinha cheia = no ar, quadrado = pronto, anel = esperando, traço tracejado = planejado/futuro.
// O texto continua o de PILL; só a roupa muda, e só no tema natura-deck.
const DECK_PILL = {
  live:  { c: "#1F6B49", bg: "#E5F1E9", bd: "#B7D8C4", dot: { background: "#2F8A60", borderRadius: "50%" } },
  ready: { c: "#7A5410", bg: "#F6ECD6", bd: "#E2CC9C", dot: { background: "#A9781C", borderRadius: 1 } },
  wait:  { c: "#3B5A7C", bg: "#E8EEF5", bd: "#C3D1E1", dot: { border: "2px solid #4D6F93", borderRadius: "50%" } },
  plan:  { c: "#5C574D", bg: "#F1EEE8", bd: "#CFC8B8", dash: true, dot: { background: "#8A8476", height: 2, borderRadius: 1 } },
};
const DECK_OF = { live: "live", ready: "ready", activation: "wait", pending: "wait", planned: "plan", future: "plan" };

function Pill({ status, lang, deck = false }) {
  const p = PILL[status];
  const txt = p ? (p[lang] || p.en) : String(status || "");
  if (!txt) return null;
  if (deck) {
    const d = DECK_PILL[DECK_OF[status] || "plan"];
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 self-start whitespace-nowrap rounded-full sm:self-auto py-[3px] pl-2 pr-2.5 text-[11px] font-bold leading-[1.25]"
        style={{ color: d.c, background: d.bg, border: `1px ${d.dash ? "dashed" : "solid"} ${d.bd}` }}>
        <i className="inline-block shrink-0" style={{ width: 8, height: 8, ...d.dot }} aria-hidden="true" />{txt}
      </span>
    );
  }
  const c = p || PILL.future;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 self-start whitespace-nowrap rounded-full sm:self-auto px-2 py-[3px] text-[10.5px] font-semibold leading-none"
      style={{ color: c.c, background: c.bg, border: `1px solid ${c.dot}33` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />{txt}
    </span>
  );
}

function SummaryBox({ rows, P, L }) {
  if (!Array.isArray(rows) || !rows.length) return null;
  return (
    <div className="mb-6 rounded-xl px-4 py-3 sm:px-5" style={{ background: P.fill, border: `1px solid ${P.box}` }}>
      <div style={monoLbl(P)} className="mb-2">{L.glance}</div>
      <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[minmax(120px,auto)_1fr]">
        {rows.map(([k, v], i) => (
          <div key={i} className="contents">
            <dt className="text-[11px] font-medium sm:pt-[2px]" style={{ fontFamily: P.mono, color: P.muted, letterSpacing: "0.06em" }}>{k}</dt>
            <dd className="mb-1.5 text-[13px] font-semibold leading-snug sm:mb-0" style={{ color: P.ink }}>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Annexes({ annexes, P, L, lang, deck = false }) {
  if (!Array.isArray(annexes) || !annexes.length) return null;
  return annexes.map((ax, ai) => (
    <section key={ai} className="mb-6 mt-8 pt-5" style={{ borderTop: `1px solid ${P.line}` }}>
      <div style={{ ...monoLbl(P), color: P.gold }}>{L.annex} {String.fromCharCode(65 + ai)}</div>
      <h3 className="mt-1 text-[17px] font-extrabold leading-tight" style={{ color: P.ink, fontFamily: P.sans }}>{ax.title}</h3>
      {ax.intro && <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: P.muted }}>{ax.intro}</p>}
      {(ax.parts || []).map((pt, pi) => (
        <div key={pi} className="mt-4">
          <div className="flex items-baseline gap-2">
            <span style={monoLbl(P)}>{String(pi + 1).padStart(2, "0")}</span>
            <span className="text-[13.5px] font-bold" style={{ color: P.ink }}>{pt.title}</span>
          </div>
          {pt.terms && (Array.isArray(pt.terms)
            ? <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[12px] leading-relaxed" style={{ color: P.muted }}>{pt.terms.map((x, i) => <li key={i}>{x}</li>)}</ul>
            : <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: P.muted }}>{pt.terms}</p>)}
          {pt.items?.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-lg" style={{ border: `1px solid ${P.line}` }}>
              {pt.items.map((it, ii) => (
                <div key={ii} className="flex flex-col gap-1.5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  style={{ borderTop: ii ? `1px solid ${P.line}` : "none" }}>
                  <span className="min-w-0 text-[12.5px] leading-snug" style={{ color: P.ink }}>{it.text}</span>
                  {it.status && <Pill status={it.status} lang={lang} deck={deck} />}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  ));
}

// o carimbo das duas assinaturas + o certificado (hash, hora UTC, IP). Entra no PAPEL, então imprime.
function Signatures({ record, signature, body, P, L, lang }) {
  const prov = record?.provider;
  const sig = record?.signer?.name ? record.signer : (signature?.name ? signature : null);
  const legacyProv = !prov && body.providerSignature?.name ? body.providerSignature : null;
  if (!prov && !sig && !legacyProv && !record) return null;
  const script = { fontFamily: "'Brush Script MT', 'Segoe Script', cursive" };
  return (
    <div className="mt-8 pt-5" style={{ borderTop: `2px solid ${P.line}` }}>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <div style={monoLbl(P)}>{L.provider}</div>
          {prov ? (
            <>
              <div className="mt-1 text-2xl font-bold" style={{ ...script, color: P.ink }}>{prov.name}</div>
              <div className="text-[12px] font-semibold" style={{ color: P.ink }}>{L.signedBy} {prov.entity} — {prov.name}{prov.title ? `, ${prov.title}` : ""}, {diaLocal(prov.at, lang)}</div>
              <div className="mt-0.5 text-[10.5px]" style={{ fontFamily: P.mono, color: P.muted }}>{utc(prov.at)}{prov.ip ? ` · IP ${prov.ip}` : ""}</div>
            </>
          ) : legacyProv ? (
            <>
              <div className="mt-1 text-2xl font-bold" style={{ ...script, color: P.ink }}>{legacyProv.name}</div>
              <div className="mt-0.5 text-[10px]" style={{ color: P.muted }}>{legacyProv.at}</div>
            </>
          ) : <div className="mt-2 text-[12px] italic" style={{ color: P.muted }}>{L.waiting}</div>}
        </div>
        <div>
          <div style={monoLbl(P)}>{L.client}{body.counterparty?.name ? ` · ${body.counterparty.name}` : ""}</div>
          {sig ? (
            <>
              <div className="mt-1 text-2xl font-bold" style={{ ...script, color: P.ink }}>{sig.name}</div>
              <div className="text-[12px] font-semibold" style={{ color: P.ink }}>{L.elec}</div>
              <div className="mt-0.5 text-[10.5px]" style={{ fontFamily: P.mono, color: P.muted }}>{sig.atRaw ? utc(sig.atRaw) : sig.at}{sig.ip ? ` · IP ${sig.ip}` : ""}</div>
            </>
          ) : <div className="mt-2 text-[12px] italic" style={{ color: P.muted }}>{L.waiting}</div>}
        </div>
      </div>

      {record?.hash && (
        <div className="mt-6 rounded-xl px-4 py-3" style={{ background: P.fill, border: `1px solid ${P.box}` }}>
          <div style={{ ...monoLbl(P), color: P.gold }}>{L.cert}</div>
          <div className="mt-2 text-[10.5px]" style={monoLbl(P)}>{L.fp}</div>
          <div className="mt-0.5 break-all text-[12px] font-medium leading-relaxed" style={{ fontFamily: P.mono, color: P.ink }}>{record.hash}</div>
          {record.providerHash && record.providerHash !== record.hash && (
            <div className="mt-1 break-all text-[10.5px]" style={{ fontFamily: P.mono, color: P.warn }}>{L.provHash}: {record.providerHash}</div>
          )}
          <p className="mt-1.5 text-[11px] leading-snug" style={{ color: P.muted }}>{L.fpNote}</p>
          {record.verify && (
            <p className="mt-1.5 text-[11.5px] font-semibold leading-snug print:hidden"
              style={{ color: record.verify === "ok" ? "#1F6B49" : record.verify === "mismatch" ? P.warn : P.muted }}>
              {record.verify === "ok" ? L.vOk : record.verify === "mismatch" ? L.vBad : L.vWait}
            </p>
          )}
          {record.governing && <div className="mt-2 text-[11px]" style={{ color: P.muted }}><span style={monoLbl(P)}>{L.gov}</span> · {(LANG_NAME[record.governing] || {})[lang] || record.governing}</div>}
        </div>
      )}
    </div>
  );
}

function useFontesNatura(ativo) {
  useEffect(() => {
    if (!ativo || typeof document === "undefined" || document.getElementById("natura-deck-fonts")) return;
    const l = document.createElement("link");
    l.id = "natura-deck-fonts"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(l);
  }, [ativo]);
}

export default function ContractDoc({ body, signature, collapsible = false, lang = "en", record = null, courtesy = null }) {
  const m = MORE[lang] || MORE.en;
  const L = DL[lang] || DL.en;
  const deck = body?.theme === "natura-deck";
  useFontesNatura(deck);
  const [abertas, setAbertas] = useState(() => new Set());
  const [tudo, setTudo] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const abrir = () => setTudo(true);
    window.addEventListener("beforeprint", abrir);
    return () => window.removeEventListener("beforeprint", abrir);
  }, []);

  if (!body) return null;
  const isQuote = body.kind === "quote";
  const recolher = collapsible && !tudo;
  const toggle = (n) => setAbertas((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });
  const P = PAL[deck ? "natura-deck" : "default"];
  const parentTitle = body.parent_contract_id ? (record?.parentTitle || body.parent_title || "") : "";
  const joinder = body.parent_contract_id ? (
    <div className="mb-4 rounded-lg px-3 py-2 text-[12px] font-semibold" style={{ border: `1px solid ${P.gold}55`, color: P.gold, fontFamily: P.mono, letterSpacing: "0.04em" }}>
      {L.joinder} {parentTitle ? `“${parentTitle}”` : "—"}
    </div>
  ) : null;
  const cortesia = courtesy ? (
    <div className="mb-4 rounded-lg px-3 py-2 text-[12px] font-semibold" style={{ border: `1px solid ${P.warn}55`, background: `${P.warn}0d`, color: P.warn }}>
      {L.courtesy((LANG_NAME[courtesy] || {})[lang] || courtesy)}
    </div>
  ) : null;
  const clausulas = body.clauses?.length > 0 && (
    <div className={deck ? "mb-5 space-y-4" : "space-y-2.5 mb-5"}>
      {body.clauses.map(([n, t, txt, plain]) => {
        const aberta = !recolher || abertas.has(n);
        return (
          <div key={n} className={deck ? "text-[13px]" : "text-[12.5px]"}>
            {deck ? (
              <div className="flex items-baseline gap-2.5">
                <span style={{ ...monoLbl(P), minWidth: 22 }}>{String(n).padStart(2, "0")}</span>
                <span className="font-bold" style={{ color: P.ink }}>{t}</span>
              </div>
            ) : <div className="font-bold">{n}. {t}</div>}
            <div className={deck ? "pl-[32px]" : ""}>
              {recolher && plain ? (
                <>
                  <div className="leading-relaxed" style={{ color: deck ? P.muted : "#4b5563" }}>{plain}</div>
                  <button type="button" onClick={() => toggle(n)}
                    className="mt-0.5 min-h-[36px] text-[11.5px] font-bold underline print:hidden" style={{ color: deck ? P.gold : "#6b7280" }}>
                    {aberta ? m.close : m.open}
                  </button>
                  {aberta && <div className="mt-1 leading-relaxed whitespace-pre-line" style={{ color: deck ? P.ink : "#374151" }}>{txt}</div>}
                </>
              ) : (
                <div className="leading-relaxed whitespace-pre-line" style={{ color: deck ? P.ink : "#374151" }}>{txt}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ── TEMA natura-deck — o papel com a cara do deck aprovado: tinta #161512, Inter, rótulos em
  // IBM Plex Mono espaçado, ouro #8E6D2C nos detalhes, linhas #E4DDCC. Sem faixa escura, sem emoji.
  if (deck) {
    return (
      /* sombra e filete do SLIDE do deck (não a sombra preta pesada da mesa escura): a folha agora
         pousa no papel claro da página, e uma sombra de 0.6 de preto ali vira mancha. */
      <div className="contract-doc overflow-hidden rounded-[14px] bg-white p-6 sm:p-10"
        style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact", color: P.ink, fontFamily: P.sans, border: `1px solid ${P.line}`, boxShadow: "0 1px 2px rgba(22,21,18,.06), 0 8px 28px rgba(22,21,18,.06)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3 pb-4" style={{ borderBottom: `1px solid ${P.line}` }}>
          <div style={monoLbl(P)}>{body.doc_label || (isQuote ? "Quote" : "Services Agreement")}{body.template_code ? ` · ${body.template_code}` : ""}</div>
          <div style={monoLbl(P)}>{body.date}</div>
        </div>
        <h1 className="mt-5 text-[24px] font-extrabold leading-[1.15] tracking-tight sm:text-[28px]" style={{ color: P.ink }}>{body.title}</h1>
        {body.subtitle && <p className="mt-1.5 text-[13.5px]" style={{ color: P.muted }}>{body.subtitle}</p>}
        <div className="mb-6 mt-4 h-[2px] w-14" style={{ background: P.gold }} />
        {joinder}
        {cortesia}
        <div className="mb-6 grid gap-4 text-[13px] sm:grid-cols-2">
          <div>
            <div style={monoLbl(P)}>{L.provider}</div>
            <div className="mt-1 font-bold">{body.provider?.name}</div>
            {body.provider?.qualificacao && <div className="mt-0.5 text-[11.5px] leading-snug" style={{ color: P.muted }}>{body.provider.qualificacao}</div>}
          </div>
          <div>
            <div style={monoLbl(P)}>{L.client}</div>
            <div className="mt-1 font-bold">{body.counterparty?.name || "—"}</div>
            {body.counterparty?.qualificacao && <div className="mt-0.5 text-[11.5px] leading-snug" style={{ color: P.muted }}>{body.counterparty.qualificacao}</div>}
            {body.counterparty?.email && <div className="text-[12px]" style={{ color: P.muted }}>{body.counterparty.email}</div>}
          </div>
        </div>
        <SummaryBox rows={body.summaryRows} P={P} L={L} />
        {body.summary && <p className="mb-5 text-[13.5px] leading-relaxed">{body.summary}</p>}
        {body.bodyText && <div className="mb-5 whitespace-pre-line text-[13px] leading-relaxed">{body.bodyText}</div>}
        {clausulas}
        <Annexes annexes={body.annexes} P={P} L={L} lang={lang} deck />
        {body.disclaimer && <p className="pt-3 text-[11px] font-medium" style={{ color: P.warn, borderTop: `1px solid ${P.line}` }}>{body.disclaimer}</p>}
        <Signatures record={record} signature={signature} body={body} P={P} L={L} lang={lang} />
        <div className="mt-8 flex flex-wrap items-center justify-between gap-2 pt-3" style={{ borderTop: `1px solid ${P.line}`, ...monoLbl(P), fontSize: 9.5 }}>
          <span>{body.footer || "ORIGEM LTDA d/b/a Guileo AI · guileoai.com"}</span>
          <span>{body.governing_lang ? `${L.gov}: ${(LANG_NAME[body.governing_lang] || {})[lang] || body.governing_lang}` : ""}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="contract-doc overflow-hidden bg-white text-gray-900 rounded-2xl p-6 sm:p-10 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]"
      /* print-color-adjust: exact — sem isto o navegador IMPRIME A FAIXA EM BRANCO por economia de
         tinta, e o PDF que o cliente recebe chega sem marca: o timbre existiria só na tela. */
      style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
      {/* ── TIMBRE (2026-08-20) ────────────────────────────────────────────────────────────────
          Orçamento e contrato saem do MESMO componente — então a identidade entra uma vez e vale
          para os dois. Antes o documento abria com um emoji: o cliente recebia um papel que podia
          ter vindo de qualquer lugar. Proposta sem marca é proposta que não ancora preço.
          🚨 A MARCA NO TOPO, A QUALIFICAÇÃO EMBAIXO. Logo é reconhecimento; quem assina é a razão
          social, que já vem em `body.provider`. Uma não substitui a outra — marca não assina. */}
      {/* FAIXA DE MARCA — a primeira coisa que o cliente vê, antes de qualquer número. O grafite
          da Guileo com a marca em champanhe: é o mesmo par de cores da plataforma, então o papel
          na mesa e a tela no celular dele são reconhecivelmente a mesma empresa. */}
      <div className="-mx-6 -mt-6 mb-5 rounded-t-2xl bg-[#161512] px-6 py-5 sm:-mx-10 sm:-mt-10 sm:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/guileo-mark.png" alt="Guileo" width="44" height="44"
              className="h-11 w-11 shrink-0 object-contain" />
            <div>
              <div className="text-[20px] font-black leading-none tracking-tight text-[#EDE7DC]">GUILEO</div>
              <div className="mt-1.5 flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.16em]">
                <span style={{ color: "#FF8A33" }}>Brain</span>
                <span className="text-gray-600">·</span>
                <span style={{ color: "#4C9AFF" }}>AD</span>
                <span className="text-gray-600">·</span>
                <span style={{ color: "#9AA0FF" }}>Build</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "#D6C29A" }}>
              {isQuote ? "Orçamento · Quote" : "Contrato · Contract"}
            </div>
            <div className="mt-1 text-[15px] font-extrabold leading-tight text-[#EDE7DC]">{body.title}</div>
            <div className="mt-0.5 text-[10px] tracking-wide text-gray-400">{body.template_code} · {body.date}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 text-[13px] mb-5">
        {/* A QUALIFICAÇÃO DA PARTE, e não só o nome. Razão social + registro + endereço é o que
            identifica quem responde; "Guileo" sozinho é marca, e marca não assina. Enquanto o
            CNPJ/EIN não estiver preenchido, esta linha simplesmente não aparece — documento
            incompleto de forma visível é melhor que documento completo e errado. */}
        <div><div className="font-bold text-gray-400 text-[10px] uppercase tracking-wide">Prestador / Provider</div><div className="font-semibold">{body.provider?.name}</div>
          {body.provider?.qualificacao && <div className="text-gray-500 text-[11.5px] leading-snug mt-0.5">{body.provider.qualificacao}</div>}</div>
        <div><div className="font-bold text-gray-400 text-[10px] uppercase tracking-wide">Contraparte / Counterparty</div><div className="font-semibold">{body.counterparty?.name || "—"}</div>{body.counterparty?.email && <div className="text-gray-500 text-[12px]">{body.counterparty.email}</div>}</div>
      </div>

      {joinder}
      {cortesia}
      <SummaryBox rows={body.summaryRows} P={P} L={L} />
      {body.summary && <p className="text-[13.5px] leading-relaxed text-gray-700 mb-4">{body.summary}</p>}

      {/* ESCOPO EM TABELA, NÃO EM MARCADOR. Uma lista com bolinhas lê-se como sugestão; uma tabela
          com linha numerada e ✓ lê-se como entrega contratada. O conteúdo é o MESMO — muda o peso
          de quem lê. E a numeração dá ao cliente como apontar ("o item 3 vale para as duas lojas?"),
          que é a diferença entre uma dúvida respondível e um "depois eu vejo". */}
      {body.deliverables?.length > 0 && (
        <div className="mb-5">
          <div className="mb-2 font-bold text-[11px] uppercase tracking-wide text-gray-500">Escopo / Deliverables</div>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            {body.deliverables.map((d, i) => (
              <div key={i} className={`flex items-start gap-3 px-3.5 py-2.5 text-[13px] leading-relaxed text-gray-800 ${i % 2 ? "bg-gray-50" : "bg-white"}`}>
                <span className="mt-[2px] shrink-0 text-[10px] font-black tabular-nums text-gray-400">{String(i + 1).padStart(2, "0")}</span>
                <span className="mt-[1px] shrink-0 font-bold" style={{ color: "#3E9468" }}>✓</span>
                <span className="min-w-0">{d}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SELO DE GARANTIA — só onde há escopo contratado (o documento do cliente Guileo).
          🚨 CADA LINHA AQUI É UMA PROMESSA QUE A EMPRESA CUMPRE, copiada de `functions/lib/
          productFacts.js`, a MESMA fonte que os agentes de voz usam para responder ao cliente.
          Se o papel promete uma coisa e a Gui responde outra ao telefone, a venda morre na
          primeira conferência — e a culpa parece do vendedor. Mudou lá, muda aqui. */}
      {body.deliverables?.length > 0 && (
        <div className="mb-5 grid gap-2 rounded-xl border border-gray-900/15 bg-gray-50 p-3.5 sm:grid-cols-3">
          {[["🛡️", "30 dias de garantia", "Money-back de 30 dias"],
            ["⚡", "No ar em até 7 dias", "Live in up to 7 days"],
            ["🔓", "Cancele quando quiser", "Cancel anytime"]].map(([ico, pt, en]) => (
            <div key={pt} className="flex items-center gap-2.5">
              <span className="text-[17px] leading-none">{ico}</span>
              <div className="min-w-0">
                <div className="text-[12px] font-bold leading-tight text-gray-900">{pt}</div>
                <div className="text-[10px] leading-tight text-gray-500">{en}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {body.bodyText && <div className="text-[13px] leading-relaxed text-gray-800 whitespace-pre-line mb-4">{body.bodyText}</div>}

      {(body.timeline || body.payment || body.amount) && (
        <div className="grid gap-2 sm:grid-cols-3 text-[12.5px] mb-5 bg-gray-50 rounded-xl p-3.5">
          {body.timeline && <div><span className="font-bold">⏱ </span>{body.timeline}</div>}
          {body.payment && <div><span className="font-bold">💳 </span>{body.payment}</div>}
          {body.amount && <div><span className="font-bold">💰 </span>{body.amount}</div>}
        </div>
      )}

      {isQuote && body.quoteIntro && <p className="text-[13px] text-gray-700 mb-3">{body.quoteIntro}</p>}
      {isQuote && body.quoteTerms?.length > 0 && <ul className="list-disc pl-5 space-y-1 text-[12.5px] text-gray-700 mb-4">{body.quoteTerms.map((t, i) => <li key={i}>{t}</li>)}</ul>}

      {clausulas}
      <Annexes annexes={body.annexes} P={P} L={L} lang={lang} />

      {body.disclaimer && <p className="text-[10.5px] text-gray-400 italic border-t border-gray-200 pt-3">{body.disclaimer}</p>}

      {/* NÓS ASSINAMOS PRIMEIRO. O cliente recebe um documento que já está assinado do nosso lado —
          medido em +26% e depois +65% de fechamento, e praticamente ninguém faz. */}
      {/* Com `record` (assinatura própria v2) entra o bloco novo: prestador + cliente + certificado.
          Sem ele, o carimbo de sempre, idêntico ao que já estava no ar. */}
      {record ? <Signatures record={record} signature={signature} body={body} P={P} L={L} lang={lang} /> : (body.providerSignature?.name || signature?.name) && (
        <div className="mt-6 pt-4 border-t-2 border-gray-300 grid gap-5 sm:grid-cols-2">
          {body.providerSignature?.name && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500">✍️ Prestador / Provider</div>
              <div className="text-2xl font-bold mt-1" style={{ fontFamily: "'Brush Script MT', cursive" }}>{body.providerSignature.name}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{body.providerSignature.at}</div>
            </div>
          )}
          {signature?.name && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500">✍️ Assinado eletronicamente / Electronically signed</div>
              <div className="text-2xl font-bold mt-1" style={{ fontFamily: "'Brush Script MT', cursive" }}>{signature.name}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{signature.at}{signature.ip ? ` · IP ${signature.ip}` : ""}</div>
            </div>
          )}
        </div>
      )}

      {/* RODAPÉ INSTITUCIONAL — fecha o documento com quem o emitiu. Vale para orçamento e para
          contrato, pelo mesmo motivo do timbre: papel sem remetente não gera confiança nem retorno. */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-3 text-[10.5px] text-gray-500">
        <span className="font-semibold tracking-wide text-gray-700">GUILEO · guileoai.com</span>
        <span>{isQuote ? "Orçamento válido por 15 dias · valores em USD" : "Documento gerado eletronicamente"}</span>
      </div>
    </div>
  );
}
