/* Split out of Portal.jsx (performance): CatalogScreen tab view.
   ── O CATÁLOGO DE VERDADE (2026-08-20) ─────────────────────────────────────────────────────────
   Esta tela desenhava barras de um catálogo inventado (`V.ops.list`) enquanto `biz_services`
   guardava os serviços REAIS do negócio — 23 só da Natura. É o catálogo que a Gui usa para cotar
   ao telefone: se a tela mostra outra coisa, o dono confere com o que ouviu e conclui, com razão,
   que o sistema não sabe o que ele vende.
   🚨 PREÇO `null` É PREÇO NÃO CADASTRADO, e aparece assim. Desenhar "$0" anunciaria serviço de
   graça — e ausência de preço é justamente o que o dono precisa VER para ir cadastrar. */
import { useState, useEffect } from "react";
import { fetchCatalogo } from "../lib/portalApi.js";
import { Card, tr, SectionSkeleton } from "../pages/Portal.jsx";

const NAO_MEDIDO = "#8A8578";
// Motivo de falha → frase (o código cru "rede"/"chave_invalida" era impresso na tela).
const FRASE_FALHA = {
  rede: "Check your connection and try again.",
  servidor: "Our server didn't answer. Try again in a moment.",
  chave_invalida: "Your connection code isn't matching — paste it again in Settings.",
  sem_credencial: "Your connection code is missing — paste it in Settings.",
  resposta_estranha: "The answer came back in a format I couldn't read. Try again in a moment.",
};

function CatalogScreen({ V, real, email, dataKey }) {
  const o = V.ops || {}; const list = o.list || [];
  const max = Math.max(1, ...list.map((x) => x.val));
  const [cat, setCat] = useState({ estado: "carregando", dados: null, motivo: null });
  const [seq, setSeq] = useState(0);
  useEffect(() => {
    let vivo = true;
    if (!real || !email || !dataKey) { setCat({ estado: "amostra", dados: null, motivo: null }); return () => { vivo = false; }; }
    setCat({ estado: "carregando", dados: null, motivo: null });
    fetchCatalogo(email, dataKey).then((r) => { if (vivo) setCat({ estado: r.dados ? "ok" : "err", dados: r.dados, motivo: r.motivo }); });
    return () => { vivo = false; };
  }, [real, email, dataKey, seq]);
  const reais = cat.estado === "ok" && Array.isArray(cat.dados) ? cat.dados : null;
  const semPreco = reais ? reais.filter((x) => x.preco == null).length : 0;

  // 🚨 O CATÁLOGO DE AMOSTRA APARECIA ENQUANTO O REAL CARREGAVA (2026-09-28) — e ficava na tela
  // se a leitura falhasse, com uma faixa cinza dizendo "sample layout". Um spa com 23 serviços
  // via os serviços da vitrine no lugar dos dele. Conta conectada: esqueleto enquanto lê; se
  // falhar, o aviso e o botão de tentar de novo — a amostra nunca entra.
  if (real && cat.estado === "carregando") return <SectionSkeleton rows={6} />;

  return (
    <>
      {cat.estado === "err" && (
        <div className="mb-3 rounded-xl border border-[#e0855f]/40 bg-[#e0855f]/[0.08] px-3.5 py-2.5 flex flex-wrap items-center gap-3 text-[12px] text-[#e0855f]">
          <span className="flex-1 min-w-[12rem]">{tr("Couldn't read your catalog")} — {tr(FRASE_FALHA[cat.motivo] || "Try again in a moment.")}</span>
          <button onClick={() => setSeq((n) => n + 1)} className="btn-ghost text-xs shrink-0">{tr("↻ Try again")}</button>
        </div>
      )}
      {real && !reais ? null : reais ? (
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-g-gold">{tr("Your catalog")}</span>
            <span className="text-[11px] text-g-muted tabular-nums">{reais.length}</span>
          </div>
          {/* o aviso é ACIONÁVEL: serviço sem preço é a causa nº1 de a Gui não conseguir cotar */}
          {semPreco > 0 && (
            <div className="px-5 py-2.5 border-b border-white/10 text-[11.5px]" style={{ color: NAO_MEDIDO }}>
              ⚠️ {semPreco} {tr("without a price — Gui can't quote what has no price.")}
            </div>
          )}
          <div className="divide-y divide-white/[0.06]">
            {reais.map((it) => (
              <div key={it.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-g-word truncate">{it.nome || tr("Unnamed service")}</div>
                  <div className="text-[11px] text-g-muted">
                    {it.minutos ? `${it.minutos} min` : ""}{!it.ativo ? ` · ${tr("inactive")}` : ""}
                  </div>
                </div>
                <span className="text-[13px] font-extrabold tabular-nums" style={it.preco == null ? { color: NAO_MEDIDO } : { color: "#EDE7DC" }}>
                  {it.preco == null ? tr("no price") : `$${Number(it.preco).toFixed(2)}`}
                </span>
              </div>
            ))}
            {reais.length === 0 && (
              <div className="px-5 py-6 text-center text-[12px] text-g-muted">{tr("Nothing in your catalog yet.")}</div>
            )}
          </div>
        </Card>
      ) : (
      <Card className="p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/10 text-xs font-bold uppercase tracking-wide text-g-gold">{tr(o.listTitle || "Catalog")}</div>
      <div className="p-5 space-y-3.5">
        {list.map((it, i) => (
          <div key={i}><div className="flex justify-between text-xs mb-1"><span className="font-bold text-g-word">{it.name}</span><span className="text-g-muted">{it.val}</span></div><div className="h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-g-green to-g-gold" style={{ width: `${(it.val / max) * 100}%` }} /></div></div>
        ))}
      </div>
    </Card>
      )}
    </>
  );
}

export default CatalogScreen;
