import { useMemo, useState } from "react";
import { LEADS } from "../data/leadBoss.js";
import { classificarCidade } from "../data/leadClassifier.js";

// SellerLeadsNYC — a lista clicável dos leads já classificados (Luis, 2026-08-12).
//
// O PEDIDO: «os leads de NYC pra tudo… você classificar, colocar no motor do lead o que e qual
// serviço o lead precisa, e já dá o pitch com o que falar.»
//
// O QUE ESTA TELA RESOLVE: o motor (`leadClassifier.js`) já sabia dizer serviço + pitch, mas só
// por código — existir e não se alcançar é o mesmo que não existir (foi a lição da página órfã
// mais cedo hoje). Aqui ele vira uma lista onde o vendedor CLICA e já tem o telefone, o serviço
// e as quatro frases prontas, na ordem de falar.
//
// ⚠️ A MARCA "PALPITE" É O CORAÇÃO DESTA TELA, não um detalhe. 24 dos 34 leads de NY têm EVIDÊNCIA
// no diagnóstico do site ("fora do horário", "ninguém atende"); os outros 10 foram deduzidos pelo
// nicho. Abrir uma ligação com "vi no site de vocês que…" sobre algo que você NÃO viu destrói a
// única vantagem que este pitch tem sobre telemarketing. Por isso o palpite aparece em âmbar, com
// a frase de abertura trocada — o vendedor não pode confundir os dois nem por descuido.

const T = {
  pt: {
    titulo: "Leads de Nova York", sub: "Já classificados: qual serviço cada um precisa e o que falar.",
    comProva: "com evidência no site", palpite: "palpite pelo setor",
    servico: "Serviço que ele precisa", tambem: "Também serve", falar: "O que falar, na ordem",
    ligar: "Ligar agora", site: "Ver o site", copiar: "Copiar o pitch", copiado: "Copiado ✓",
    avisoPalpite: "Sem diagnóstico do site — NÃO diga que viu algo lá. Abra perguntando.",
    aberturaPalpite: (n) => `Oi, é do ${n}? Trabalho com negócios do seu setor aqui em Nova York — posso te fazer uma pergunta rápida sobre como vocês atendem o telefone?`,
    vazio: "Nenhum lead classificado — o motor não chuta quando não há sinal.",
  },
  en: {
    titulo: "New York leads", sub: "Already sorted: which service each one needs and what to say.",
    comProva: "evidence on their site", palpite: "guessed from the trade",
    servico: "Service they need", tambem: "Also fits", falar: "What to say, in order",
    ligar: "Call now", site: "Open site", copiar: "Copy the pitch", copiado: "Copied ✓",
    avisoPalpite: "No site diagnosis — do NOT claim you saw something there. Open with a question.",
    aberturaPalpite: (n) => `Hi, is this ${n}? I work with businesses in your trade here in New York — can I ask you one quick question about how your phone gets answered?`,
    vazio: "No lead classified — the engine doesn't guess when there's no signal.",
  },
};

const COR_PILAR = { brain: "255,138,51", ad: "76,154,255", build: "154,160,255" };

export default function SellerLeadsNYC({ lang = "pt" }) {
  const t = T[lang] || T.pt;
  const [aberto, setAberto] = useState(null);
  const [copiado, setCopiado] = useState(null);

  const lista = useMemo(() => classificarCidade(LEADS, "New York", lang), [lang]);
  const comProva = lista.filter((x) => !x.plano.porNicho).length;

  const copiar = (id, linhas) => {
    try { navigator.clipboard.writeText(linhas.join("\n\n")); setCopiado(id); setTimeout(() => setCopiado(null), 1800); } catch { /* sem clipboard */ }
  };

  if (!lista.length) return <p className="text-[13px] text-g-muted">{t.vazio}</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[19px] font-black tracking-tight text-g-word">{t.titulo}</h2>
        <p className="mt-1 text-[13px] text-g-ink">{t.sub}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold">
          <span className="rounded-full border border-g-green/40 bg-g-green/10 px-2.5 py-1 text-g-green">{comProva} {t.comProva}</span>
          <span className="rounded-full border border-g-gold/40 bg-g-gold/10 px-2.5 py-1 text-g-gold">{lista.length - comProva} {t.palpite}</span>
        </div>
      </div>

      <div className="space-y-2">
        {lista.map(({ lead, plano }) => {
          const rgb = COR_PILAR[plano.servico_principal.pilar] || "255,138,51";
          const on = aberto === lead.id;
          // No palpite, a PRIMEIRA frase é trocada: sem evidência, não se abre dizendo que viu.
          const falas = plano.porNicho ? [t.aberturaPalpite(lead.name), ...plano.pitch.slice(1)] : plano.pitch;
          return (
            <div key={lead.id} className="overflow-hidden rounded-2xl border" style={{ borderColor: `rgba(${rgb},0.25)`, background: `rgba(${rgb},0.05)` }}>
              <button onClick={() => setAberto(on ? null : lead.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-extrabold text-g-word">{lead.name}</span>
                  <span className="block truncate text-[11.5px] text-g-muted">{lead.area}</span>
                </span>
                <span className="shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-black" style={{ background: `rgba(${rgb},0.16)`, color: `rgb(${rgb})` }}>
                  {plano.servico_principal.nome}
                </span>
                {plano.porNicho && <span className="shrink-0 text-[13px]" title={t.avisoPalpite}>⚠️</span>}
                <span className="shrink-0 text-g-muted">{on ? "▾" : "▸"}</span>
              </button>

              {on && (
                <div className="border-t px-4 py-4" style={{ borderColor: `rgba(${rgb},0.18)` }}>
                  {plano.porNicho ? (
                    <p className="mb-3 rounded-xl border border-g-gold/35 bg-g-gold/[0.08] px-3 py-2 text-[12px] font-semibold text-g-gold">⚠️ {t.avisoPalpite}</p>
                  ) : (
                    <p className="mb-3 text-[12px] text-g-ink">
                      <span className="font-bold text-g-green">✓</span> {lang === "pt" ? "Achado no site deles:" : "Found on their site:"} <em>“{plano.evidencia}”</em>
                    </p>
                  )}

                  {plano.tambem_serve.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      <span className="text-[11px] font-bold text-g-muted">{t.tambem}:</span>
                      {plano.tambem_serve.map((s) => (
                        <span key={s.id} className="rounded-full border border-white/12 bg-white/[0.04] px-2 py-0.5 text-[10.5px] text-g-ink">{s.nome}</span>
                      ))}
                    </div>
                  )}

                  <div className="text-[11px] font-black uppercase tracking-wider text-g-muted">{t.falar}</div>
                  <ol className="mt-2 space-y-2">
                    {falas.map((f, i) => (
                      <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-g-word">
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black" style={{ background: `rgba(${rgb},0.18)`, color: `rgb(${rgb})` }}>{i + 1}</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ol>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {lead.phone && (
                      <a href={`tel:+${lead.phone}`} className="rounded-xl bg-g-green/15 px-4 py-2 text-[12.5px] font-bold text-g-green ring-1 ring-g-green/40 transition hover:bg-g-green/25">📞 {t.ligar}</a>
                    )}
                    {lead.site && (
                      <a href={lead.site} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-white/[0.05] px-4 py-2 text-[12.5px] font-bold text-g-ink ring-1 ring-white/12 transition hover:bg-white/[0.09]">🌐 {t.site}</a>
                    )}
                    <button onClick={() => copiar(lead.id, falas)} className="rounded-xl bg-white/[0.05] px-4 py-2 text-[12.5px] font-bold text-g-ink ring-1 ring-white/12 transition hover:bg-white/[0.09]">
                      {copiado === lead.id ? t.copiado : `📋 ${t.copiar}`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
