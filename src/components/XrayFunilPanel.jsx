import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// FUNIL DO GUILEO X-RAY (/admin) — quantos raio-X saíram, quantos foram ABERTOS, e o que ainda
// não sabemos medir.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Lê a RPC `xray_funil(p_token, p_dias)`, gated pela MESMA senha do /admin (`_admin_ok`) que o
// resto da página já usa — mesmo caminho, mesmo token, nenhuma porta nova.
//
// 🚨 A COISA MAIS IMPORTANTE DESTE PAINEL: os campos que voltam `null` são NÃO MEDIDOS, e
// aparecem em CINZA com um traço `—` e o motivo escrito ao lado. NUNCA como 0.
// "0 virou cliente" é uma AFIRMAÇÃO — diz que o produto não converteu ninguém. A verdade hoje é
// outra: não existe ligação entre o domínio medido no X-Ray e a conta que foi criada, então a
// gente simplesmente NÃO SABE. Pintar isso de zero é o mesmo defeito que já fez o /admin mostrar
// "0 clientes" ao lado de uma carteira com pagantes (auditoria 2026-08-17) — e um número errado
// com cara de certo desliga a desconfiança exatamente quando ela era devida.
//
// E o terceiro estado: falha de LEITURA não é "funil zerado". Sem resposta, o painel diz que não
// leu — nunca desenha zeros.

const CINZA = "#948C7B", OK = "#3E9468", INFO = "#5B9BD5", GUI = "#FF8A33", BAD = "#e0855f";

// "campo: motivo" → { campo: motivo }. O motivo tem que aparecer JUNTO do campo que ele explica;
// uma lista solta no rodapé não responde "por que este aqui está cinza?".
const parseMotivos = (arr) => {
  const m = {};
  (Array.isArray(arr) ? arr : []).forEach((linha) => {
    const s = String(linha || "");
    const i = s.indexOf(":");
    if (i > 0) m[s.slice(0, i).trim()] = s.slice(i + 1).trim();
  });
  return m;
};

// Um tile só. `valor == null` → traço cinza + motivo. Zero de verdade continua sendo zero.
// Fora do render de propósito (regra do lint da casa): componente criado dentro do render
// remonta a cada leitura, e este painel relê sozinho.
const Tile = ({ campo, label, valor, tone = INFO, sub, motivos = {} }) => {
  const naoMedido = valor == null;
  return (
    <div className="min-w-[150px] flex-1 rounded-xl border border-g-line bg-white/[0.03] px-3 py-2.5"
      style={naoMedido ? { borderColor: `${CINZA}44` } : undefined}
      title={naoMedido ? (motivos[campo] || "não medido") : undefined}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-g-muted">
        <span className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: naoMedido ? CINZA : tone, boxShadow: naoMedido ? "none" : `0 0 7px ${tone}` }} />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-[19px] font-black tabular-nums" style={{ color: naoMedido ? CINZA : undefined }}>
        {naoMedido ? "—" : valor}
      </div>
      {naoMedido
        ? <div className="mt-0.5 text-[10.5px] leading-snug" style={{ color: CINZA }}>não medido{motivos[campo] ? ` · ${motivos[campo]}` : ""}</div>
        : sub ? <div className="mt-0.5 text-[10.5px] text-g-muted">{sub}</div> : null}
    </div>
  );
};

const dt = (iso) => { try { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }); } catch { return "—"; } };

export default function XrayFunilPanel({ token }) {
  const [dias, setDias] = useState(30);
  const [d, setD] = useState(null);       // objeto da RPC
  const [erro, setErro] = useState(null); // string — falha de LEITURA (≠ funil vazio)
  const [lendo, setLendo] = useState(true);

  const carregar = useCallback(async () => {
    setLendo(true);
    const { data, error } = await supabase.rpc("xray_funil", { p_token: token, p_dias: dias });
    // ⚠️ LER A RESPOSTA, não o status: a RPC devolve 200 com `{error:'unauthorized'}` quando a
    // senha não bate. Tratar "sem erro HTTP" como sucesso já abriu porta neste repo antes.
    if (error) { setErro(error.message || "falha ao ler xray_funil"); setD(null); }
    else if (!data || data.error) { setErro(data?.error || "xray_funil não devolveu dados"); setD(null); }
    else { setD(data); setErro(null); }
    setLendo(false);
  }, [token, dias]);

  useEffect(() => { carregar(); }, [carregar]);

  const motivos = parseMotivos(d?.nao_medido);

  const pct = (a, b) => (b > 0 && a != null ? `${Math.round((a / b) * 100)}% dos gerados` : null);

  return (
    <section className="rounded-2xl border border-g-line bg-white/[0.04] p-5 backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[12px] font-bold uppercase tracking-wider text-g-gold">🩻 Funil do Guileo X-Ray</div>
          <p className="mt-1 text-[12px] text-g-muted">
            Raio-X gerados pela porta pública → quantos o dono ABRIU → o que vira lead. O que ainda não
            sabemos medir aparece em cinza, com o motivo — nunca como zero.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {[7, 30, 90].map((n) => (
            <button key={n} onClick={() => setDias(n)}
              className={`rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition ${dias === n ? "border-g-gold/50 bg-white/[0.05] text-g-gold" : "border-g-line text-g-muted hover:text-g-word"}`}>
              {n}d
            </button>
          ))}
          <button onClick={carregar} disabled={lendo}
            className="rounded-full border border-g-green/40 px-2.5 py-1 text-[11.5px] font-bold text-g-green hover:bg-g-green/10 disabled:opacity-50">
            {lendo ? "…" : "↻"}
          </button>
        </div>
      </div>

      {/* TRÊS ESTADOS, NUNCA DOIS: não li ≠ li e está vazio ≠ li e tem número. */}
      {erro && (
        <div className="mt-4 rounded-xl border px-3 py-2.5 text-[12.5px]" style={{ borderColor: `${BAD}55`, background: `${BAD}12`, color: BAD }}>
          ⚠️ Não consegui LER o funil (<span className="font-mono">xray_funil</span>): {erro}.<br />
          Isto <b>não</b> quer dizer funil zerado — quer dizer sem leitura.
        </div>
      )}

      {!erro && !d && lendo && <div className="mt-4 text-[13px] text-g-muted">Carregando…</div>}

      {!erro && d && (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <Tile motivos={motivos} campo="xrays_gerados" label="X-Ray gerados" valor={d.xrays_gerados} tone={GUI} sub={`últimos ${d.dias} dias`} />
            <Tile motivos={motivos} campo="xrays_abertos" label="Abertos pelo dono" valor={d.xrays_abertos} tone={OK} sub={pct(d.xrays_abertos, d.xrays_gerados)} />
            <Tile motivos={motivos} campo="leads_no_funil" label="Leads no funil" valor={d.leads_no_funil} tone={INFO} />
            <Tile motivos={motivos} campo="calls_agenda_guileo" label="Reuniões na agenda Guileo" valor={d.calls_agenda_guileo} tone={INFO} />
            <Tile motivos={motivos} campo="calls_atribuidas_ao_xray" label="Reuniões atribuídas ao X-Ray" valor={d.calls_atribuidas_ao_xray} />
            <Tile motivos={motivos} campo="virou_cliente" label="Virou cliente" valor={d.virou_cliente} />
          </div>

          {/* O motivo de cada não-medido também escrito por extenso — o tooltip some no celular. */}
          {Array.isArray(d.nao_medido) && d.nao_medido.length > 0 && (
            <div className="mt-3 rounded-xl border px-3 py-2.5" style={{ borderColor: `${CINZA}44`, background: `${CINZA}0f` }}>
              <div className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: CINZA }}>Não medido — por quê</div>
              <ul className="mt-1 space-y-0.5">
                {d.nao_medido.map((m) => (
                  <li key={m} className="text-[11.5px] leading-snug" style={{ color: CINZA }}>— {m}</li>
                ))}
              </ul>
            </div>
          )}

          {/* AS LINHAS. Lista vazia aqui É informação (ninguém gerou), e é diferente de erro. */}
          <div className="mt-4">
            <div className="text-[10.5px] font-bold uppercase tracking-wide text-g-muted">Últimos X-Ray</div>
            {(d.linhas || []).length === 0 ? (
              <div className="mt-1.5 rounded-lg border border-g-line bg-white/[0.02] px-3 py-2.5 text-[12px] text-g-muted">
                Nenhum X-Ray gerado nos últimos {d.dias} dias (leitura ok — isto é vazio de verdade).
              </div>
            ) : (
              <div className="mt-1.5 space-y-1.5">
                {(d.linhas || []).map((l) => (
                  <a key={l.id} href={`/apresentacao/${l.id}`} target="_blank" rel="noopener"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-g-line bg-black/20 px-3 py-2 hover:border-g-gold/30">
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-g-word">
                      {l.business || l.site}
                      {l.contato && <span className="ml-2 text-[11px] text-g-muted">{l.contato}</span>}
                    </span>
                    <span className="shrink-0 text-[11.5px] font-bold tabular-nums"
                      style={{ color: l.score == null ? CINZA : undefined }}>
                      {l.score == null ? "— não medido" : `${l.score}/100`}
                    </span>
                    <span className="shrink-0 text-[11px]" style={{ color: l.aberto_em ? OK : CINZA }}>
                      {l.aberto_em ? `abriu ${dt(l.aberto_em)}` : "não abriu"}
                    </span>
                    <span className="shrink-0 text-[11px] text-g-muted">{dt(l.created_at)}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
