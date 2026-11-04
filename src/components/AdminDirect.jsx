/* Guileo Direct no /admin — TODOS os clientes num lugar só (2026-10-23).
   O cliente vê só o dele no portal (src/portal/Comentarios.jsx → DirectMetricas). Aqui o Luis vê a
   mesma coisa para cada cliente, com uma tabela na frente que responde "quem precisa de mim hoje?".

   NADA DE PAINEL NOVO: clicar num cliente abre o MESMO DirectMetricas do portal, alimentado pela
   porta de admin de /api/meta-comentarios. Dois painéis para o mesmo número divergem; um não diverge.

   ⚠️ ERRO NÃO VIRA ZERO: cliente cuja leitura falhou aparece com o motivo, nunca com uma linha de zeros.
   ⚠️ LISTA VAZIA SÓ SE FOR VERDADE: sem a chave de serviço o servidor devolve erro, e a tela mostra o erro. */
import { useEffect, useState } from "react";
import DirectMetricas from "../portal/DirectMetricas.jsx";
import { prepararIdiomaDoPainel } from "../pages/Portal.jsx";
import { alertasDoDirect as alertas, ordemDeAtencao } from "../portal/directConselhos.js";

const PERIODOS = [7, 30, 90];
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmt = (v) => n(v).toLocaleString("pt-BR");

async function chamar(token, corpo) {
  try {
    const r = await fetch("/api/meta-comentarios", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...corpo, admin_token: token }),
    });
    const d = await r.json().catch(() => null);
    if (r.status === 401) return { motivo: "senha do admin recusada" };
    if (!r.ok || !d) return { motivo: (d && d.erro) || `HTTP ${r.status}` };
    return { data: d };
  } catch (e) { return { motivo: String(e).slice(0, 120) }; }
}

function Bolinha({ cor }) {
  const c = { red: "bg-red-400", gold: "bg-g-gold", green: "bg-g-green", gray: "bg-g-muted" }[cor];
  return <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${c}`} />;
}

export default function AdminDirect({ token }) {
  const [dias, setDias] = useState(30);
  const [estado, setEstado] = useState({ lendo: true });
  const [aberto, setAberto] = useState("");
  const [idiomaPronto, setIdiomaPronto] = useState(false);

  useEffect(() => { prepararIdiomaDoPainel("pt").then(() => setIdiomaPronto(true)); }, []);

  useEffect(() => {
    let vivo = true;
    setEstado((e) => ({ ...e, lendo: true }));
    chamar(token, { dias }).then((r) => {
      if (!vivo) return;
      const d = r.data;
      if (r.motivo || !d || d.ok !== true || !Array.isArray(d.clientes)) setEstado({ erro: r.motivo || (d && d.erro) || "resposta estranha" });
      else setEstado({ clientes: [...d.clientes].sort(ordemDeAtencao) });
    });
    return () => { vivo = false; };
  }, [token, dias]);

  const clientes = estado.clientes || [];
  const lidos = clientes.filter((c) => c.metricas);
  const soma = (fn) => lidos.reduce((t, c) => t + n(fn(c.metricas)), 0);
  const api = (corpo) => chamar(token, corpo);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black">💬 Guileo Direct — todos os clientes</h2>
          <p className="text-[12.5px] text-g-muted">Comentário → DM → conversa → lead, por cliente. Clique num cliente para abrir o painel que ele vê no portal.</p>
        </div>
        <div className="flex gap-1" role="group" aria-label="Período">
          {PERIODOS.map((d) => (
            <button key={d} type="button" aria-pressed={d === dias} onClick={() => setDias(d)}
              className={`rounded-full border px-3 py-1 text-[12px] font-bold ${d === dias ? "border-g-gold/50 text-g-gold" : "border-g-line text-g-muted hover:text-g-word"}`}>
              {d} dias
            </button>
          ))}
        </div>
      </div>

      {estado.erro && (
        <div className="rounded-xl border border-red-400/40 bg-red-400/5 p-4 text-[13px]">
          <strong>Não consegui ler o Direct.</strong> {estado.erro}
        </div>
      )}
      {estado.lendo && !estado.clientes && !estado.erro && <p className="text-[13px] text-g-muted">Lendo…</p>}

      {estado.clientes && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ["Clientes", clientes.length],
              ["Directs enviados", soma((m) => m.funil?.dm_enviado)],
              ["Falharam", soma((m) => m.funil?.dm_falhou)],
              ["DMs recebidas", soma((m) => m.conversa?.recebidas)],
              ["Leads", soma((m) => m.funil?.leads)],
            ].map(([rot, v]) => (
              <div key={rot} className="rounded-xl border border-g-line p-3">
                <div className="text-[10.5px] font-black uppercase tracking-wider text-g-muted">{rot}</div>
                <div className="text-xl font-black">{fmt(v)}</div>
              </div>
            ))}
          </div>
          {lidos.length < clientes.length && (
            <p className="text-[12px] text-g-gold">⚠️ {clientes.length - lidos.length} cliente(s) sem leitura — os totais acima não contam esses.</p>
          )}

          {!clientes.length && <p className="text-[13px] text-g-muted">Nenhum cliente com Instagram conectado ou campanha criada.</p>}

          <div className="overflow-x-auto rounded-xl border border-g-line">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead className="text-[10.5px] uppercase tracking-wider text-g-muted">
                <tr className="border-b border-g-line">
                  <th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Atenção</th>
                  <th className="px-3 py-2 text-right">Enviados</th><th className="px-3 py-2 text-right">Falhas</th>
                  <th className="px-3 py-2 text-right">DMs recebidas</th><th className="px-3 py-2 text-right">Leads</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => {
                  const m = c.metricas;
                  const a = m ? alertas(m) : null;
                  const abrir = () => setAberto(aberto === c.email ? "" : c.email);
                  return (
                    <tr key={c.email} onClick={abrir} className={`cursor-pointer border-b border-g-line/60 hover:bg-white/[0.03] ${aberto === c.email ? "bg-white/[0.04]" : ""}`}>
                      <td className="px-3 py-2">
                        <button type="button" onClick={(e) => { e.stopPropagation(); abrir(); }} aria-expanded={aberto === c.email} className="text-left font-bold hover:text-g-gold">
                          {c.nomes?.length ? c.nomes.join(" · ") : c.email}
                        </button>
                        <div className="text-[11px] text-g-muted">{c.email}</div>
                      </td>
                      <td className="px-3 py-2">
                        {!m ? <span className="inline-flex items-center gap-1.5 text-red-300"><Bolinha cor="red" /> leitura falhou: {c.metricas_erro}</span>
                          : a.red + a.gold === 0 ? <span className="inline-flex items-center gap-1.5 text-g-green"><Bolinha cor="green" /> em dia</span>
                          : <span className="inline-flex items-center gap-2">
                              {a.red > 0 && <span className="inline-flex items-center gap-1"><Bolinha cor="red" />{a.red}</span>}
                              {a.gold > 0 && <span className="inline-flex items-center gap-1"><Bolinha cor="gold" />{a.gold}</span>}
                            </span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{m ? fmt(m.funil?.dm_enviado) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m ? fmt(m.funil?.dm_falhou) : "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{m ? fmt(m.conversa?.recebidas) : "—"}</td>
                      {/* lead sem link é "não sei", não zero — a mesma regra do portal */}
                      <td className="px-3 py-2 text-right tabular-nums">{m && m.funil?.leads != null ? fmt(m.funil.leads) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {aberto && idiomaPronto && (() => {
            const c = clientes.find((x) => x.email === aberto);
            if (!c) return null;
            return (
              <div className="rounded-2xl bg-[#161512] p-4 text-g-ink">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-[13px] font-bold">{c.nomes?.join(" · ") || c.email} <span className="font-normal text-g-muted">— o que o cliente vê no portal</span></div>
                  <button type="button" onClick={() => setAberto("")} className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-bold text-g-muted hover:text-white">Fechar</button>
                </div>
                <DirectMetricas key={`${c.email}-${dias}`} api={api} email={c.email} dataKey=""
                  inicial={c.metricas} erroInicial={c.metricas ? "" : c.metricas_erro} diasInicial={dias} />
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
