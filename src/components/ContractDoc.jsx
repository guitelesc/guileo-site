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

export default function ContractDoc({ body, signature, collapsible = false, lang = "en" }) {
  const m = MORE[lang] || MORE.en;
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

      {body.clauses?.length > 0 && (
        <div className="space-y-2.5 mb-5">
          {body.clauses.map(([n, t, txt, plain]) => {
            const aberta = !recolher || abertas.has(n);
            return (
              <div key={n} className="text-[12.5px]">
                <div className="font-bold">{n}. {t}</div>
                {recolher && plain ? (
                  <>
                    <div className="text-gray-600 leading-relaxed">{plain}</div>
                    <button type="button" onClick={() => toggle(n)}
                      className="mt-0.5 min-h-[36px] text-[11.5px] font-bold text-gray-500 underline print:hidden">
                      {aberta ? m.close : m.open}
                    </button>
                    {aberta && <div className="mt-1 text-gray-700 leading-relaxed">{txt}</div>}
                  </>
                ) : (
                  <div className="text-gray-700 leading-relaxed">{txt}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {body.disclaimer && <p className="text-[10.5px] text-gray-400 italic border-t border-gray-200 pt-3">{body.disclaimer}</p>}

      {/* NÓS ASSINAMOS PRIMEIRO. O cliente recebe um documento que já está assinado do nosso lado —
          medido em +26% e depois +65% de fechamento, e praticamente ninguém faz. */}
      {(body.providerSignature?.name || signature?.name) && (
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
