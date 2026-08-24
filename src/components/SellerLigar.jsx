import { useState, useEffect, useCallback } from "react";

/* ── POR ONDE COMEÇAR A LIGAR ─────────────────────────────────────────────────
   POR QUE EXISTE: em 2026-08-22 o banco mostrou 311 prospects com telefone e
   ZERO abordados. O motor estava pronto havia semanas e o funil nunca tinha
   sido entrado. O que faltava não era gente na lista — era saber por onde
   começar e com que frase abrir.

   A ORDEM NÃO É ALFABÉTICA NEM POR DATA: é por DOR MEDIDA. Cada cartão traz o
   achado mais grave que o X-Ray já encontrou naquele negócio ("144 hours a week
   with nobody on the phone"), para a ligação abrir com um fato DELE em vez de
   "somos uma empresa de IA".

   ⚠️ `lista === null` é "não deu para ler", NUNCA "ninguém para ligar". Mandar o
   vendedor dormir achando que a carteira acabou por causa de uma falha de rede
   é o erro mais caro que esta tela poderia cometer. */
export default function SellerLigar({ lang = "pt", sid = "" }) {
  const [lista, setLista] = useState(undefined);   // undefined=carregando · null=falhou · []=vazio
  const [motivo, setMotivo] = useState("");
  const [aberto, setAberto] = useState(null);

  const T = {
    pt: { tit: "Por onde começar", sub: "Ordenado pela dor que já medimos no negócio dele — não por ordem alfabética.",
          carregando: "Carregando…", falhou: "Não consegui ler a lista agora — isto NÃO quer dizer que acabou a carteira.",
          vazio: "Nenhum prospect com telefone esperando.", ligar: "Ligar", relatorio: "Ver o relatório", roteiro: "Roteiro",
          semDor: "Sem dor medida ainda — ligue perguntando, não afirmando.", dorLabel: "A dor medida", respLabel: "O que a Gui faz" },
    en: { tit: "Where to start", sub: "Ordered by the pain we already measured in their business — not alphabetically.",
          carregando: "Loading…", falhou: "Couldn't read the list right now — this does NOT mean the list is empty.",
          vazio: "No prospect with a phone waiting.", ligar: "Call", relatorio: "Open the report", roteiro: "Script",
          semDor: "No measured pain yet — open by asking, not by claiming.", dorLabel: "The measured pain", respLabel: "What Gui does" },
  };
  const c = T[lang] || T.pt;

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/lista-ligacao?sid=${encodeURIComponent(sid)}&limite=40`);
      const d = await r.json().catch(() => null);
      // O CORPO decide, não o status. `r.ok` sozinho já deixou passar recusa como sucesso aqui.
      if (!d || d.ok !== true || !Array.isArray(d.lista)) { setLista(null); setMotivo(d?.motivo || ""); return; }
      setLista(d.lista);
    } catch (e) { setLista(null); setMotivo(String(e).slice(0, 120)); }
  }, [sid]);
  useEffect(() => { carregar(); }, [carregar]);

  const tel = (p) => String(p || "").replace(/\D/g, "");
  const bonito = (p) => { const d = tel(p); return d.length === 11 && d[0] === "1" ? `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : p; };

  return (
    <div className="mx-auto max-w-3xl px-3 pb-10">
      <h1 className="text-2xl font-black text-g-word">📞 {c.tit}</h1>
      <p className="mt-1 text-[13px] leading-relaxed text-g-muted">{c.sub}</p>

      {lista === undefined && <div className="mt-6 text-sm text-g-muted">{c.carregando}</div>}
      {lista === null && (
        <div className="mt-6 rounded-xl border border-g-amber/30 bg-g-amber/10 p-4 text-[13px] text-g-amber">
          {c.falhou}{motivo ? <span className="block mt-1 text-[11.5px] opacity-80">{motivo}</span> : null}
        </div>
      )}
      {Array.isArray(lista) && lista.length === 0 && <div className="mt-6 text-sm text-g-muted">{c.vazio}</div>}

      {Array.isArray(lista) && lista.length > 0 && (
        <div className="mt-6 space-y-2.5">
          {lista.map((p, i) => (
            <div key={(p.phone || "") + i} className="rounded-2xl border border-g-line bg-white/[0.04] p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 w-6 shrink-0 text-center text-[12px] font-black text-g-muted tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-bold text-g-word">{p.business || "—"}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px] text-g-muted">
                    <span className="tabular-nums">{bonito(p.phone)}</span>
                    {p.nota_google && <span>⭐ {p.nota_google}{p.avaliacoes ? ` · ${p.avaliacoes}` : ""}</span>}
                    {p.categoria && <span className="truncate">{p.categoria}</span>}
                  </div>
                  {/* A DOR É O CARTÃO. Sem ela o vendedor liga no escuro — e a tela diz isso
                      em vez de fingir que todo prospect tem diagnóstico. */}
                  <div className="mt-2 text-[13.5px] font-semibold leading-snug text-g-ink">
                    {p.dor_titulo || <span className="font-normal text-g-muted">{c.semDor}</span>}
                  </div>
                </div>
                <a href={`tel:+1${tel(p.phone)}`} className="btn-bright shrink-0 text-[12px]">{c.ligar}</a>
              </div>

              {(p.dor_evidencia || p.resposta_gui || p.relatorio) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(p.dor_evidencia || p.resposta_gui) && (
                    <button onClick={() => setAberto(aberto === i ? null : i)} className="btn-ghost text-[11.5px]">{c.roteiro}</button>
                  )}
                  {p.relatorio && (
                    <a href={`/apresentacao/${p.relatorio}`} target="_blank" rel="noopener" className="btn-ghost text-[11.5px]">{c.relatorio}</a>
                  )}
                </div>
              )}

              {aberto === i && (
                <div className="mt-3 space-y-2 rounded-xl bg-black/20 p-3">
                  {p.dor_evidencia && (
                    <div><div className="text-[10.5px] font-black uppercase tracking-wider text-g-muted">{c.dorLabel}</div>
                      <div className="mt-0.5 text-[12.5px] leading-relaxed text-g-ink">{p.dor_evidencia}</div></div>
                  )}
                  {p.resposta_gui && (
                    <div><div className="text-[10.5px] font-black uppercase tracking-wider text-g-muted">{c.respLabel}</div>
                      <div className="mt-0.5 text-[12.5px] leading-relaxed text-g-ink">{p.resposta_gui}</div></div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
