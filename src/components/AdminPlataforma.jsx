import { useCallback, useEffect, useState } from "react";

/* ═══ 🚦 PLATAFORMA — o veredito consolidado, na tela ═════════════════════════════════════════
   /api/platform-status já responde "está tudo funcionando?" juntando canário + RPCs + falhas +
   evals + motores mortos em quatro domínios (voz · dinheiro · agenda · agentes). Só que esse
   veredito só existia via curl com o DIGEST_TOKEN — e semáforo que ninguém abre não é semáforo.

   FONTE: /api/platform-status, que JÁ aceita a senha do /admin (ele valida com blitz_stats além
   do DIGEST_TOKEN). Nenhum segredo novo no navegador.

   🚨 O MOTIVO INTEIRO FICA NA TELA. Um quadradinho vermelho sem a frase obriga a adivinhar; os
   sinais de cada domínio ("rpc:x=failed", "campanha REPROVADA — …") são exatamente o que permite
   consertar. `unknown` é cinza e diz "não medido" — nunca verde por falta de sinal. */

const COR = { green: "#3E9468", yellow: "#f2b23e", red: "#c8623c", unknown: "#8A8578" };
const ROTULO = { green: "no ar", yellow: "atenção", red: "quebrado", unknown: "não medido" };
const DOMINIO = { voz: "☎️ Voz", dinheiro: "💳 Dinheiro", agenda: "📅 Agenda", agentes: "🤖 Agentes" };

export default function AdminPlataforma({ token }) {
  const [d, setD] = useState(null);
  const [estado, setEstado] = useState("carregando");
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(null); // domínio expandido

  const ler = useCallback(async () => {
    if (!token) return;
    setEstado("carregando"); setErro("");
    try {
      const r = await fetch("/api/platform-status", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }),
      });
      const j = await r.json().catch(() => null);
      // ⚠️ Este endpoint responde 200 mesmo degradado (`ok:false` com o motivo) de propósito —
      // um endpoint de saúde que 500a é ele mesmo uma queda. Então lemos a RESPOSTA, não o status.
      if (!r.ok || !j) { setEstado("err"); setErro(`HTTP ${r.status}`); return; }
      if (j.ok === false) { setEstado("err"); setErro(j.error || "veredito indisponível"); return; }
      setD(j); setEstado("ok");
    } catch (e) { setEstado("err"); setErro(String(e).slice(0, 140)); }
  }, [token]);

  useEffect(() => { ler(); }, [ler]);

  const geral = d?.slo?.overall || "unknown";

  return (
    <div className="rounded-2xl border border-g-line bg-white/[0.04] p-5 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[12px] font-bold uppercase tracking-wider text-g-gold">🚦 Plataforma</div>
          <p className="text-[12px] text-g-muted">O veredito consolidado do cron (canário · RPCs · falhas 7d · evals · motores mortos). Toque num domínio para ver o motivo inteiro.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border px-3 py-1 text-[11.5px] font-black"
            style={{ borderColor: `${COR[geral]}66`, color: COR[geral], background: `${COR[geral]}14` }}>
            {ROTULO[geral] || geral}
          </span>
          <button type="button" onClick={ler} className="min-h-[44px] rounded-full border border-g-line px-4 text-[12px] font-bold text-g-muted hover:text-g-word">
            {estado === "carregando" ? "Lendo…" : "↻"}
          </button>
        </div>
      </div>

      {estado === "err" && (
        <div className="mt-3 rounded-xl border px-3 py-2 text-[12.5px]" style={{ borderColor: `${COR.red}55`, color: COR.red }}>
          Não consegui ler o semáforo: {erro}. Isto <b>não</b> quer dizer que a plataforma caiu — quer dizer que a leitura falhou.
        </div>
      )}

      {estado === "ok" && d && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.keys(DOMINIO).map((k) => {
              const a = (d.slo.areas || {})[k] || { color: "unknown", signals: [] };
              const c = COR[a.color] || COR.unknown;
              return (
                <button key={k} type="button" onClick={() => setAberto((x) => (x === k ? null : k))}
                  className="rounded-xl border bg-white/[0.03] px-3 py-2.5 text-left" style={{ borderColor: `${c}44` }}>
                  <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-g-muted">
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c, boxShadow: `0 0 7px ${c}` }} />
                    {DOMINIO[k]}
                  </div>
                  <div className="mt-0.5 text-[14px] font-black" style={{ color: c }}>{ROTULO[a.color] || a.color}</div>
                  <div className="text-[10px] text-g-muted/80">{(a.signals || []).length} sinal(is) · ver</div>
                </button>
              );
            })}
          </div>

          {aberto && (
            <div className="mt-3 rounded-xl border border-g-line bg-white/[0.03] p-3">
              <div className="text-[11px] font-black uppercase tracking-wide text-g-muted">{DOMINIO[aberto]} — o motivo inteiro</div>
              <ul className="mt-2 space-y-1">
                {((d.slo.areas[aberto] || {}).signals || []).length === 0
                  ? <li className="text-[12px]" style={{ color: COR.unknown }}>Nenhum sinal chegou deste domínio — não medido, não "está bem".</li>
                  : d.slo.areas[aberto].signals.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-g-ink">
                      <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: COR[s.color] || COR.unknown }} />
                      <span className="min-w-0 break-words">{s.label}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="mt-2 text-[11px] text-g-muted">
            medido em {d.generatedAt ? new Date(d.generatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
          </div>
        </>
      )}
    </div>
  );
}
