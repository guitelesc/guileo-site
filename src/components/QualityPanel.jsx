import { useEffect, useState } from "react";

// ── PAINEL DE QUALIDADE (admin) — a saúde REAL dos agentes, não só uptime. Três leituras honestas:
//   (a) 🎯 Qualidade dos agentes — último run do /api/agent-eval por agente (score médio, PASS/FAIL
//       nos "nunca", tendência) + botão "Rodar avaliação agora".
//   (b) 📊 Saúde da plataforma — SLO consolidado do /api/platform-status (verde/amarelo/vermelho por área).
//   (c) 💰 Unit economics — margem por cliente do /api/unit-economics (custo vs receita), vermelho em foco.
//   Filosofia frontier-lab: observabilidade > fé; degradação HONESTA. Se falta ANTHROPIC_API_KEY as evals
//   NÃO rodam e o painel diz isso na cara — nunca finge verde. Cimento LOCKED + paleta de sinal.
//   Design tokens g-* (cimento). Sinais: Gui laranja #FF8A33, info azul #5B9BD5, atenção âmbar #FFC23D,
//   done verde #3E9468, alerta #e0855f. Só-leitura salvo o botão de rodar eval (2ª ação, nunca destrutiva).
const GUI = "#FF8A33", INFO = "#5B9BD5", AMBER = "#FFC23D", OK = "#3E9468", BAD = "#e0855f";

// map de status → cor de sinal (verde/amarelo/vermelho), tolerante a apelidos que os endpoints usem.
const SIG = {
  green:  { c: OK,   dot: OK,   label: "verde",     emoji: "🟢" },
  yellow: { c: AMBER, dot: AMBER, label: "amarelo",  emoji: "🟡" },
  amber:  { c: AMBER, dot: AMBER, label: "amarelo",  emoji: "🟡" },
  red:    { c: BAD,  dot: BAD,  label: "vermelho",  emoji: "🔴" },
  unknown:{ c: "#948C7B", dot: "#948C7B", label: "sem dado", emoji: "⚪" },
};
const sigOf = (s) => SIG[(s || "unknown").toString().toLowerCase()] || SIG.unknown;

// tendência → glifo (aceita 'up'/'down'/'flat' OU um número delta).
const trendGlyph = (t) => {
  if (t == null) return { g: "·", c: "#948C7B", t: "sem tendência" };
  const s = t.toString().toLowerCase();
  const n = Number(t);
  if (s === "up" || (!Number.isNaN(n) && n > 0)) return { g: "▲", c: OK, t: "subindo" };
  if (s === "down" || (!Number.isNaN(n) && n < 0)) return { g: "▼", c: BAD, t: "caindo" };
  return { g: "▬", c: "#948C7B", t: "estável" };
};

// score 0–100 (ou 0–1 normalizado) → cor por faixa. Honesto: null = sem avaliação.
const scoreColor = (v) => (v == null ? "#948C7B" : v >= 85 ? OK : v >= 65 ? AMBER : BAD);
const asPct = (v) => (v == null ? null : v <= 1 ? Math.round(v * 100) : Math.round(v));
const money = (cents) => "$" + (Number(cents || 0) / 100).toLocaleString("en-US", { maximumFractionDigits: 0 });

// pequenas peças reutilizáveis — mantêm o cimento e os estados honestos consistentes entre as 3 seções.
const Skeleton = ({ h = 20 }) => <div className="animate-pulse rounded-xl border border-g-line bg-white/[0.03]" style={{ height: h }} />;
const ErrLine = ({ msg, onRetry }) => (
  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11.5px]" style={{ borderColor: `${BAD}44`, background: `${BAD}0d`, color: BAD }}>
    <span>⚠️ {msg}</span>
    {onRetry && <button onClick={onRetry} className="rounded-full border border-g-line px-2 py-0.5 text-[10.5px] font-bold text-g-ink hover:text-g-word">↻ tentar de novo</button>}
  </div>
);
const Empty = ({ msg }) => <div className="mt-2 rounded-lg border border-g-line bg-white/[0.02] px-3 py-2.5 text-[11.5px] text-g-muted">{msg}</div>;

export default function QualityPanel({ token }) {
  // cada seção tem seu próprio estado: null=carregando, {err}=falhou, dados=ok.
  const [ev, setEv] = useState(null);       // { agents, ran_at, has_key } | { err }
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState(null); // { overall, areas } | { err }
  const [econ, setEcon] = useState(null);     // { clients, totals } | { err }

  // ── (a) evals — POST /api/agent-eval {action:'latest'|'run', token}
  const loadEval = async (run = false) => {
    if (run) setRunning(true); else setEv(null);
    try {
      const r = await fetch("/api/agent-eval", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: run ? "run" : "latest", token }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) { setEv({ err: d.error || `falha (${r.status})` }); return; }
      // normaliza: aceita d.agents ou d.runs; cada agente pode usar nomes variados de campo.
      const list = Array.isArray(d.agents) ? d.agents : Array.isArray(d.runs) ? d.runs : [];
      setEv({
        agents: list.map((a) => ({
          name: a.name || a.agent || a.id || "agente",
          score: asPct(a.avg_score ?? a.score ?? null),
          never_ok: a.never_pass ?? a.never_ok ?? (a.never_violations != null ? a.never_violations === 0 : null),
          never_fails: a.never_fails ?? a.never_violations ?? a.violations ?? 0,
          cases: a.cases ?? a.n ?? a.total ?? null,
          // O DENOMINADOR (vem do servidor, que já tem os casos em memória). Sem ele "4 casos" lê
          // como "o conjunto tem 4" — foi assim que o placar assinou média 80,5 sobre 4 de 48.
          esperado: a.esperado ?? null,
          trend: a.trend ?? a.delta ?? null,
        })),
        ran_at: d.ran_at || d.last_run || null,
        has_key: d.has_key !== undefined ? d.has_key : (d.no_key ? false : true),
      });
    } catch { setEv({ err: "erro de rede" }); }
    finally { if (run) setRunning(false); }
  };

  // ── (b) SLO — POST /api/platform-status {token}
  const loadStatus = async () => {
    setStatus(null);
    try {
      const r = await fetch("/api/platform-status", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) { setStatus({ err: d.error || `falha (${r.status})` }); return; }
      const areas = Array.isArray(d.areas) ? d.areas : [];
      setStatus({
        overall: d.overall || d.status || (areas.some((a) => sigOf(a.status).label === "vermelho") ? "red" : areas.some((a) => sigOf(a.status).label === "amarelo") ? "yellow" : areas.length ? "green" : "unknown"),
        areas: areas.map((a) => ({ label: a.label || a.name || a.key || "área", status: a.status, detail: a.detail || a.note || "", metric: a.metric ?? null })),
      });
    } catch { setStatus({ err: "erro de rede" }); }
  };

  // ── (c) unit economics — POST /api/unit-economics {token}
  const loadEcon = async () => {
    setEcon(null);
    try {
      const r = await fetch("/api/unit-economics", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.error) { setEcon({ err: d.error || `falha (${r.status})` }); return; }
      // cost_ledger.sql ainda não colado → o endpoint devolve ready:false (honesto, nada inventado).
      // Mantém clients:[] p/ o render não quebrar; mostra a mensagem vazia honesta.
      if (d.ready === false) { setEcon({ clients: [], totals: null, notReady: true, note: d.note || "cost_ledger.sql ainda não colado" }); return; }
      const list = Array.isArray(d.clients) ? d.clients : [];
      const clients = list.map((c) => {
        // nomes reais do /api/unit-economics: guileo_receipts_cents (receita Guileo) e guileo_cost_cents.
        const revenue = c.guileo_receipts_cents ?? c.revenue_cents ?? 0;
        const cost = c.guileo_cost_cents ?? c.cost_cents ?? 0;
        const margin = c.margin_cents ?? (revenue - cost);
        const pct = revenue > 0 ? Math.round((margin / revenue) * 100) : null;
        return { name: c.business || c.name || c.email || "cliente", revenue: revenue ?? 0, cost, margin, pct };
      }).sort((a, b) => a.margin - b.margin); // pior primeiro — o vermelho salta aos olhos
      const p = d.platform || null;
      // totals com a chave margin_cents que o render já lê (linha da "margem total").
      const totals = p ? { revenue_cents: p.guileo_receipts_cents ?? 0, cost_cents: p.guileo_cost_cents ?? 0, margin_cents: p.margin_cents ?? 0 } : null;
      setEcon({ clients, totals, partial: !!d.partial, missing: d.missing_cost_providers || [] });
    } catch { setEcon({ err: "erro de rede" }); }
  };

  const loadAll = () => { loadEval(false); loadStatus(); loadEcon(); };
  useEffect(() => { if (token) loadAll(); /* eslint-disable-next-line */ }, [token]);

  const overallSig = status && !status.err ? sigOf(status.overall) : null;

  return (
    <div className="rounded-2xl border border-g-line bg-white/[0.04] p-4 backdrop-blur-sm">
      {/* cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[12px] font-black uppercase tracking-wider text-g-word">
          🔬 Qualidade & Saúde
          {overallSig && (
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-black" style={{ borderColor: `${overallSig.c}55`, color: overallSig.c, background: `${overallSig.c}12` }}>
              {overallSig.emoji} {overallSig.label}
            </span>
          )}
        </div>
        <button onClick={loadAll} className="rounded-full border border-g-line bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-g-ink hover:border-g-green/40 hover:text-g-word">↻</button>
      </div>
      <p className="mt-1 text-[11.5px] text-g-muted">Você VÊ a saúde real, não só uptime: evals dos agentes, SLO por área e margem por cliente.</p>

      {/* ═══════════ (a) 🎯 QUALIDADE DOS AGENTES ═══════════ */}
      <div className="mt-3 rounded-xl border p-3" style={{ borderColor: `${GUI}30`, background: `${GUI}08` }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide" style={{ color: GUI }}>🎯 Qualidade dos agentes</div>
          <div className="flex items-center gap-2">
            {ev && !ev.err && ev.ran_at && <span className="text-[10px] text-g-muted">último run {String(ev.ran_at).slice(0, 16).replace("T", " ")}</span>}
            <button onClick={() => loadEval(true)} disabled={running || (ev && ev.has_key === false)}
              className="rounded-lg border px-2.5 py-1 text-[10.5px] font-black disabled:opacity-40"
              style={{ borderColor: `${GUI}55`, color: GUI, background: `${GUI}10` }}>
              {running ? "avaliando…" : "▶ Rodar avaliação agora"}
            </button>
          </div>
        </div>

        {/* honestidade #1: sem chave, evals NÃO rodam — dizemos na cara e não fingimos verde */}
        {ev && !ev.err && ev.has_key === false && (
          <div className="mt-2 rounded-lg border px-2.5 py-2 text-[11.5px]" style={{ borderColor: `${AMBER}55`, background: `${AMBER}0f`, color: AMBER }}>
            🔑 Sem <code className="font-mono">ANTHROPIC_API_KEY</code> — as avaliações não rodam. Configure a chave no ambiente para medir a qualidade dos agentes. (Nada aqui é estimado.)
          </div>
        )}

        {ev === null && <div className="mt-2 space-y-1.5"><Skeleton h={22} /><Skeleton h={22} /><Skeleton h={22} /></div>}
        {ev && ev.err && <ErrLine msg={ev.err} onRetry={() => loadEval(false)} />}
        {ev && !ev.err && ev.has_key !== false && ev.agents.length === 0 && (
          <Empty msg="🌱 Nenhuma avaliação registrada ainda. Clique em ‘Rodar avaliação agora’ para o primeiro run." />
        )}

        {ev && !ev.err && ev.agents.length > 0 && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[440px] border-collapse text-[12px]">
              <thead>
                <tr className="text-[9.5px] font-bold uppercase tracking-wide text-g-muted">
                  <th className="px-1.5 py-1 text-left">Agente</th>
                  <th className="px-1.5 py-1 text-right">Score</th>
                  <th className="px-1.5 py-1 text-center">Casos</th>
                  <th className="px-1.5 py-1 text-center">"Nunca"</th>
                  <th className="px-1.5 py-1 text-center">Tend.</th>
                </tr>
              </thead>
              <tbody>
                {ev.agents.map((a, i) => {
                  const tg = trendGlyph(a.trend);
                  const neverKnown = a.never_ok != null;
                  const neverPass = a.never_ok === true;
                  return (
                    <tr key={a.name + i} className="border-t border-g-line">
                      <td className="px-1.5 py-1.5 font-bold text-g-word">{a.name}</td>
                      <td className="px-1.5 py-1.5 text-right font-black tabular-nums" style={{ color: scoreColor(a.score) }}>
                        {a.score == null ? "—" : `${a.score}`}
                      </td>
                      {/* CASOS = medidos/declarados. Âmbar quando a rodada não cobriu o conjunto:
                          não é nota ruim, é nota sobre um PEDAÇO — e a cor tem que dizer isso antes
                          de alguém ler o número da esquerda como se fosse o veredito da Gui. */}
                      <td className="px-1.5 py-1.5 text-center tabular-nums"
                          style={{ color: (a.esperado && a.cases != null && a.cases < a.esperado) ? WARN : undefined }}
                          title={a.esperado && a.cases != null && a.cases < a.esperado
                            ? `esta rodada mediu ${a.cases} dos ${a.esperado} casos declarados — os que faltam estão SEM prova`
                            : undefined}>
                        {a.cases == null ? "—" : (a.esperado ? `${a.cases}/${a.esperado}` : a.cases)}
                      </td>
                      <td className="px-1.5 py-1.5 text-center">
                        {!neverKnown ? <span className="text-g-muted">—</span> : neverPass
                          ? <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-black" style={{ borderColor: `${OK}55`, color: OK, background: `${OK}12` }}>PASS</span>
                          : <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-black" style={{ borderColor: `${BAD}66`, color: BAD, background: `${BAD}12` }}>FAIL {a.never_fails ? `·${a.never_fails}` : ""}</span>}
                      </td>
                      <td className="px-1.5 py-1.5 text-center font-black" style={{ color: tg.c }} title={tg.t}>{tg.g}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-1.5 text-[10px] text-g-muted">Score = média das notas dos casos. <b>Casos = medidos/declarados</b> — em âmbar, a rodada não cobriu o conjunto e o score é de um pedaço só. "Nunca" = as regras de safety que o agente jamais pode violar; um único FAIL já é vermelho.</p>
          </div>
        )}
      </div>

      {/* ═══════════ (b) 📊 SAÚDE DA PLATAFORMA (SLO) ═══════════ */}
      <div className="mt-3 rounded-xl border p-3" style={{ borderColor: `${INFO}30`, background: `${INFO}08` }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide" style={{ color: INFO }}>📊 Saúde da plataforma</div>
          {overallSig && <span className="text-[10.5px] font-bold" style={{ color: overallSig.c }}>{overallSig.emoji} {overallSig.label}</span>}
        </div>

        {status === null && <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3"><Skeleton h={54} /><Skeleton h={54} /><Skeleton h={54} /></div>}
        {status && status.err && <ErrLine msg={status.err} onRetry={loadStatus} />}
        {status && !status.err && status.areas.length === 0 && <Empty msg="Sem áreas reportadas pelo /api/platform-status ainda." />}

        {status && !status.err && status.areas.length > 0 && (
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {status.areas.map((a, i) => {
              const s = sigOf(a.status);
              return (
                <div key={a.label + i} className="min-w-0 rounded-lg border px-2.5 py-1.5" style={{ borderColor: `${s.c}40`, background: `${s.c}0a` }}>
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: s.dot }} />
                      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: s.dot }} />
                    </span>
                    <span className="min-w-0 truncate text-[10.5px] font-bold uppercase tracking-wide text-g-word">{a.label}</span>
                  </div>
                  {a.metric != null && <div className="mt-0.5 text-[15px] font-black tabular-nums" style={{ color: s.c }}>{a.metric}</div>}
                  {a.detail && <div className="mt-0.5 truncate text-[10px] text-g-muted" title={a.detail}>{a.detail}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════ (c) 💰 UNIT ECONOMICS — margem por cliente ═══════════ */}
      <div className="mt-3 rounded-xl border p-3" style={{ borderColor: `${OK}30`, background: `${OK}08` }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide" style={{ color: OK }}>💰 Unit economics</div>
          {econ && !econ.err && econ.totals && (
            <span className="text-[10.5px] font-bold text-g-ink">
              margem total <span className="font-black" style={{ color: (econ.totals.margin_cents ?? 0) >= 0 ? OK : BAD }}>{money(econ.totals.margin_cents)}</span>
            </span>
          )}
        </div>

        {econ === null && <div className="mt-2 space-y-1.5"><Skeleton h={22} /><Skeleton h={22} /><Skeleton h={22} /></div>}
        {econ && econ.err && <ErrLine msg={econ.err} onRetry={loadEcon} />}
        {/* ⚠️ ERAM DOIS FATOS COM UMA ÚNICA FRASE (auditoria 2026-08-17). `notReady`, `note`,
            `partial` e `missing` já eram GRAVADOS aqui e NUNCA renderizados — o unit-economics
            devolve 200 com ready:false quando o cost_ledger não foi colado, e a tela dizia
            "sem clientes com receita/custo apurados ainda". Ou seja: MEDIÇÃO QUE NUNCA EXISTIU
            aparecia como medição feita e vazia. Isto decide PREÇO: acreditar que a margem está
            apurada e vazia leva a cobrar errado com convicção.
            E `partial` é o caso mais traiçoeiro: alguns provedores de custo faltando faz o número
            aparecer como se fosse o total, quando é um PISO — margem otimista por omissão. */}
        {econ && !econ.err && econ.notReady && (
          <Empty msg={`⚠️ A margem por cliente NÃO está sendo medida — ${econ.note || "falta colar o cost_ledger"}. Isto não é "sem clientes": é sem medição.`} />
        )}
        {econ && !econ.err && !econ.notReady && econ.clients.length === 0 && <Empty msg="🌱 Sem clientes com receita/custo apurados ainda." />}
        {econ && !econ.err && !econ.notReady && econ.partial && (
          <div className="mt-2 rounded-lg border border-g-gold/40 bg-g-gold/10 px-2.5 py-1.5 text-[11px] font-bold text-g-gold">
            ⚠️ Custo PARCIAL — faltam: {(econ.missing || []).join(", ") || "provedores não informados"}. A margem abaixo é um PISO, não o número final.
          </div>
        )}

        {econ && !econ.err && econ.clients.length > 0 && (() => {
          const red = econ.clients.filter((c) => c.margin < 0);
          return (
            <>
              {red.length > 0 && (
                <div className="mt-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold" style={{ borderColor: `${BAD}55`, background: `${BAD}0f`, color: BAD }}>
                  🔴 {red.length} cliente{red.length > 1 ? "s" : ""} no vermelho — custo maior que a receita. {red[0].name}{red.length > 1 ? ` e +${red.length - 1}` : ""}.
                </div>
              )}
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[440px] border-collapse text-[12px]">
                  <thead>
                    <tr className="text-[9.5px] font-bold uppercase tracking-wide text-g-muted">
                      <th className="px-1.5 py-1 text-left">Cliente</th>
                      <th className="px-1.5 py-1 text-right">Receita</th>
                      <th className="px-1.5 py-1 text-right">Custo</th>
                      <th className="px-1.5 py-1 text-right">Margem</th>
                      <th className="px-1.5 py-1 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {econ.clients.slice(0, 20).map((c, i) => {
                      const neg = c.margin < 0;
                      return (
                        <tr key={c.name + i} className="border-t border-g-line" style={neg ? { background: `${BAD}0a` } : undefined}>
                          <td className="px-1.5 py-1.5 font-bold text-g-word">{neg ? "🔴 " : ""}{c.name}</td>
                          <td className="px-1.5 py-1.5 text-right tabular-nums text-g-ink">{money(c.revenue)}</td>
                          <td className="px-1.5 py-1.5 text-right tabular-nums text-g-muted">{money(c.cost)}</td>
                          <td className="px-1.5 py-1.5 text-right font-black tabular-nums" style={{ color: neg ? BAD : OK }}>{money(c.margin)}</td>
                          <td className="px-1.5 py-1.5 text-right font-bold tabular-nums" style={{ color: c.pct == null ? "#948C7B" : neg ? BAD : OK }}>{c.pct == null ? "—" : `${c.pct}%`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {econ.clients.length > 20 && <p className="mt-1 text-[10px] text-g-muted">+{econ.clients.length - 20} clientes — piores margens primeiro.</p>}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
