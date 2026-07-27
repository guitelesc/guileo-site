// Renders a frozen contract/quote body snapshot as a clean, print-ready document.
// Used by the public /sign page and the client portal Documents area. White paper look.
export default function ContractDoc({ body, signature }) {
  if (!body) return null;
  const isQuote = body.kind === "quote";
  return (
    <div className="contract-doc bg-white text-gray-900 rounded-2xl p-6 sm:p-10 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-5">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{body.icon || "📄"}</span>
          <div>
            <div className="text-lg font-extrabold leading-tight">{body.title}</div>
            <div className="text-[10.5px] uppercase tracking-wide text-gray-500">{isQuote ? "Quote / Orçamento" : "Contract"} · {body.template_code} · {body.date}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 text-[13px] mb-5">
        <div><div className="font-bold text-gray-400 text-[10px] uppercase tracking-wide">Prestador / Provider</div><div className="font-semibold">{body.provider?.name}</div></div>
        <div><div className="font-bold text-gray-400 text-[10px] uppercase tracking-wide">Contraparte / Counterparty</div><div className="font-semibold">{body.counterparty?.name || "—"}</div>{body.counterparty?.email && <div className="text-gray-500 text-[12px]">{body.counterparty.email}</div>}</div>
      </div>

      {body.summary && <p className="text-[13.5px] leading-relaxed text-gray-700 mb-4">{body.summary}</p>}

      {body.deliverables?.length > 0 && (
        <div className="mb-4">
          <div className="font-bold text-[11px] uppercase text-gray-500 mb-1.5">Escopo / Deliverables</div>
          <ul className="list-disc pl-5 space-y-1 text-[13px] text-gray-800">{body.deliverables.map((d, i) => <li key={i}>{d}</li>)}</ul>
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

      {body.clauses?.length > 0 && (
        <div className="space-y-2.5 mb-5">
          {body.clauses.map(([n, t, txt]) => (
            <div key={n} className="text-[12.5px]"><div className="font-bold">{n}. {t}</div><div className="text-gray-700 leading-relaxed">{txt}</div></div>
          ))}
        </div>
      )}

      {body.disclaimer && <p className="text-[10.5px] text-gray-400 italic border-t border-gray-200 pt-3">{body.disclaimer}</p>}

      {signature?.name && (
        <div className="mt-6 pt-4 border-t-2 border-gray-300">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">✍️ Assinado eletronicamente / Electronically signed</div>
          <div className="text-2xl font-bold mt-1" style={{ fontFamily: "'Brush Script MT', cursive" }}>{signature.name}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">{signature.at}{signature.ip ? ` · IP ${signature.ip}` : ""}</div>
        </div>
      )}
    </div>
  );
}
