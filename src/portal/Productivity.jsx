/* Relatório de Produtividade — num período escolhido, quais PROFISSIONAIS e quais SERVIÇOS mais
   venderam (e quais unidades, quando o negócio tem mais de uma).

   Backend: POST /api/relatorio-produtividade { email, token, from, to } → RPC biz_productivity
   (db/relatorio_produtividade.sql). Portão do tenant: e-mail + chave, no corpo.

   ESTA TELA NÃO TEM AMOSTRA. Ela só desenha o que o servidor devolveu. Sem conta conectada ela
   diz "conecte"; enquanto lê mostra o esqueleto; se a leitura falha mostra a FALHA (com o motivo e
   "tentar de novo") — nunca um zero que o dono leria como "ninguém vendeu nada".

   O QUE O DONO PRECISA SABER E A TELA DIZ:
     · a receita é o PREÇO DE TABELA do serviço (o agendamento não guarda o valor cobrado);
     · visita cujo serviço não tem preço soma zero → aviso de que a receita está subestimada;
     · só conta visita que já terminou, não cancelada, não falta.

   Registro no Portal.jsx é do orquestrador: passar real/email/dataKey como em Recurring. */
import { useState, useEffect } from "react";
import { FaRankingStar, FaUserTie, FaTag, FaLocationDot } from "react-icons/fa6";
import { tr, UI_LANG, Card, Empty, SectionSkeleton } from "../pages/Portal.jsx";
import FalhaDeLeitura from "./FalhaDeLeitura.jsx";
import { moedaDoTenant } from "./Recurring.jsx";
import { PRESETS, periodoPreset, formatarDinheiro, percentual, formatarPercentual } from "../../functions/lib/produtividade.js";

// ── leitura: { data, motivo } — falha tem motivo, vazio é dado ───────────────────────────────
async function lerRelatorio(body) {
  let r;
  try {
    r = await fetch("/api/relatorio-produtividade", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch { return { data: null, motivo: "rede" }; }
  if (r.status === 401 || r.status === 403) return { data: null, motivo: "chave_invalida" };
  if (!r.ok) return { data: null, motivo: "servidor" };
  let d;
  try { d = await r.json(); } catch { return { data: null, motivo: "resposta_estranha" }; }
  const ok = d && d.ok === true && d.totals && typeof d.totals === "object" && Array.isArray(d.by_professional) && Array.isArray(d.by_service);
  return ok ? { data: d, motivo: null } : { data: null, motivo: "resposta_estranha" };
}

const n0 = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const localeDaTela = () => (UI_LANG === "pt" ? "pt-BR" : UI_LANG === "es" ? "es-ES" : UI_LANG === "hi" ? "hi-IN" : "en-US");
// O período é [from, to), mostrado no FUSO DO NEGÓCIO (period.tz, que o servidor devolve): o último
// dia mostrado é o do instante ANTERIOR ao `to`. Fuso ausente ou inválido cai em UTC.
function textoDoPeriodo(period) {
  const f = new Date(period?.from);
  const t = new Date(period?.to);
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return "";
  const fmt = (d) => {
    const base = { day: "numeric", month: "short", year: "numeric" };
    try { return d.toLocaleDateString(localeDaTela(), { ...base, timeZone: period?.tz || "UTC" }); }
    catch { return d.toLocaleDateString(localeDaTela(), { ...base, timeZone: "UTC" }); }
  };
  return `${fmt(f)} – ${fmt(new Date(Math.max(f.getTime(), t.getTime() - 1)))}`;
}

const rotuloDoPreset = (p) => (p === "last_month" ? tr("Last month") : p === "last_30_days" ? tr("Last 30 days") : tr("This month"));

function Numero({ rotulo, valor, nota }) {
  return (
    <div className="rounded-xl2 border border-white/10 bg-white/[0.04] p-4 min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-wider text-g-muted">{rotulo}</div>
      <div className="mt-1.5 text-xl font-black text-g-word num break-words">{valor}</div>
      {nota ? <div className="mt-0.5 text-[11px] text-g-muted">{nota}</div> : null}
    </div>
  );
}

// Uma célula de número da tabela. No celular o rótulo vem em cima de cada valor (grade 2×2);
// do `sm` para cima o rótulo some e vale o cabeçalho da tabela.
function Celula({ rotulo, children }) {
  return (
    <div className="min-w-0 sm:text-right">
      <div className="sm:hidden text-[10px] font-bold uppercase tracking-wider text-g-muted">{rotulo}</div>
      <div className="text-sm font-bold text-g-word num break-words">{children}</div>
    </div>
  );
}

const GRADE = "grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,6.5rem))] sm:items-center";

function Ranking({ icone, titulo, coluna, linhas, totais, dinheiro, semNome, vazio }) {
  const porReceita = n0(totais.revenue_cents) > 0;
  const rotuloFatia = porReceita ? tr("Share of revenue") : tr("Share of visits");
  const fatia = (r) => (porReceita ? [r.revenue_cents, totais.revenue_cents] : [r.bookings, totais.bookings]);
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-white/10">
        <span className="text-xs font-bold uppercase tracking-wide text-g-gold inline-flex items-center gap-2">{icone} {titulo}</span>
      </div>
      {linhas.length === 0 ? <Empty icon="📊" text={vazio} /> : (
        <>
          <div className={`hidden sm:grid px-5 py-2 border-b border-white/[0.06] text-[10px] font-bold uppercase tracking-wider text-g-muted leading-tight ${GRADE}`}>
            <div>{coluna}</div>
            <div className="text-right">{tr("Visits")}</div>
            <div className="text-right">{tr("Revenue")}</div>
            <div className="text-right">{rotuloFatia}</div>
            <div className="text-right">{tr("Returning customers")}</div>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {linhas.map((r, i) => {
              const [parte, total] = fatia(r);
              const pct = percentual(parte, total);
              const semPreco = n0(r.services_without_price);
              return (
                <div key={r.id || `sem-${i}`} className={`grid px-4 sm:px-5 py-3 ${GRADE}`}>
                  <div className="col-span-2 sm:col-span-1 min-w-0 flex items-center gap-2.5">
                    <span className="grid place-items-center h-7 w-7 rounded-full bg-white/[0.06] text-[11px] font-black text-g-muted shrink-0 num">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-g-word truncate">{r.name || semNome}</div>
                      <div className="mt-1.5 h-1 rounded-full bg-white/[0.06] overflow-hidden" aria-hidden>
                        <div className="h-full rounded-full bg-g-green/70" style={{ width: `${Math.max(0, Math.min(100, pct || 0))}%` }} />
                      </div>
                    </div>
                  </div>
                  <Celula rotulo={tr("Visits")}>{n0(r.bookings)}</Celula>
                  <Celula rotulo={tr("Revenue")}>
                    {semPreco > 0 && semPreco >= n0(r.bookings)
                      ? <span className="text-g-muted font-normal">{tr("no price set")}</span>
                      : <>{dinheiro(r.revenue_cents)}{semPreco > 0 ? <span className="text-g-gold" title={tr("Some of these visits had no price — this amount is lower than the real one.")}> *</span> : null}</>}
                  </Celula>
                  <Celula rotulo={rotuloFatia}>{formatarPercentual(parte, total)}</Celula>
                  <Celula rotulo={tr("Returning customers")}>{n0(r.returning_customers)} <span className="text-g-muted font-normal text-[11px]">{tr("of")} {n0(r.customers)}</span></Celula>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

function Productivity({ real = null, email = "", dataKey = "" }) {
  const conta = !!(email && dataKey);
  const MOEDA = moedaDoTenant(real);
  const dinheiro = (cents) => formatarDinheiro(cents, MOEDA);

  const [preset, setPreset] = useState(PRESETS[0]);
  const [seq, setSeq] = useState(0);
  // A resposta guarda o PEDIDO que a gerou. Se o pedido atual (conta + período + tentativa) é
  // outro, a tela está "carregando" — o relatório do período anterior nunca aparece sob o rótulo
  // do novo, e nenhum setState roda de forma síncrona dentro do efeito.
  const pedido = `${email}|${dataKey}|${preset}|${seq}`;
  const [resposta, setResposta] = useState({ pedido: "", data: null, motivo: null });

  useEffect(() => {
    if (!conta) return undefined;
    let vivo = true;
    const p = periodoPreset(preset);
    lerRelatorio({ email, token: dataKey, from: p.from, to: p.to, preset }).then(({ data, motivo }) => {
      if (vivo) setResposta({ pedido, data, motivo });
    });
    return () => { vivo = false; };
  }, [conta, email, dataKey, preset, pedido]);

  const leitura = resposta.pedido !== pedido ? { fase: "carregando", data: null, motivo: null }
    : resposta.data ? { fase: "ok", data: resposta.data, motivo: null }
    : { fase: "falha", data: null, motivo: resposta.motivo };

  const d = leitura.data;
  const t = d?.totals || {};
  const comVisita = (arr) => (Array.isArray(arr) ? arr.filter((r) => r && n0(r.bookings) > 0) : []);
  const pros = comVisita(d?.by_professional);
  const servicos = comVisita(d?.by_service);
  const unidades = comVisita(d?.by_location);
  const semNada = !!d && n0(t.bookings) === 0 && n0(t.cancelled) === 0 && n0(t.no_shows) === 0;
  const semPreco = n0(t.services_without_price);
  const desde = d?.period?.live_since ? new Date(d.period.live_since) : null;
  const cortadoPeloInicio = !!(desde && !Number.isNaN(desde.getTime()) && d?.period?.from && desde.getTime() > new Date(d.period.from).getTime());

  return (
    <div className="space-y-5 stagger">
      {/* Cabeçalho + período */}
      <div className="rounded-2xl border border-g-gold/25 bg-gradient-to-br from-g-gold/[0.07] to-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-g-gold">
          <FaRankingStar size={11} /> {tr("Productivity report")}
        </div>
        <div className="mt-1 text-xl font-black text-g-word">{tr("Who and what sold the most")}</div>
        <p className="mt-1 text-xs text-g-muted max-w-xl">{tr("Pick a period to see which professionals and which services brought in the most visits and revenue.")}</p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={tr("Period")}>
          {PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => setPreset(p)} aria-pressed={preset === p}
              className={`rounded-full border px-3.5 text-[12px] font-bold transition min-h-[44px] inline-flex items-center ${preset === p ? "border-g-gold/50 bg-g-gold/15 text-g-word" : "border-white/15 bg-white/[0.04] text-g-muted hover:border-g-gold/40 hover:text-g-word"}`}>
              {rotuloDoPreset(p)}
            </button>
          ))}
        </div>
        {d?.period ? <div className="mt-2 text-[11px] text-g-muted num">{textoDoPeriodo(d.period)}</div> : null}
      </div>

      {!conta && (
        <Card className="p-5">
          <div className="text-sm font-bold text-g-word">{tr("Connect your account to see this report.")}</div>
          <p className="mt-1 text-xs text-g-muted">{tr("This report only shows your real visits — there is no sample here.")}</p>
        </Card>
      )}

      {conta && leitura.fase === "carregando" && <SectionSkeleton rows={5} />}
      {conta && leitura.fase === "falha" && <FalhaDeLeitura motivo={leitura.motivo} onRetry={() => setSeq((n) => n + 1)} />}

      {conta && leitura.fase === "ok" && semNada && (
        <Card className="p-0 overflow-hidden"><Empty icon="📊" text={tr("No visits in this period yet")} /></Card>
      )}

      {conta && leitura.fase === "ok" && !semNada && (
        <>
          {/* Resumo */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Numero rotulo={tr("Revenue (list price)")} valor={dinheiro(t.revenue_cents)} />
            <Numero rotulo={tr("Visits")} valor={n0(t.bookings)}
              nota={`${n0(t.cancelled)} ${tr("cancelled")} · ${n0(t.no_shows)} ${tr("no-shows")}`} />
            <Numero rotulo={tr("Customers")} valor={n0(t.customers)} />
            <Numero rotulo={tr("Returning customers")} valor={n0(t.returning_customers)}
              nota={n0(t.customers) > 0 ? `${formatarPercentual(t.returning_customers, t.customers)} ${tr("of the customers in this period")}` : null} />
          </div>

          {semPreco > 0 && (
            <div role="note" className="rounded-xl2 border border-g-gold/30 bg-g-gold/[0.07] px-4 py-2.5 text-[12px] font-bold text-g-gold">
              {/* tr() com literal em cada ramo: o teste de i18n só enxerga chave escrita como literal */}
              {semPreco} {semPreco === 1
                ? tr("visit had a service with no price, so the revenue shown is lower than what you really sold.")
                : tr("visits had a service with no price, so the revenue shown is lower than what you really sold.")}
            </div>
          )}

          <Ranking icone={<FaUserTie size={11} />} titulo={tr("Ranking by professional")} coluna={tr("Professional")}
            linhas={pros} totais={t} dinheiro={dinheiro} semNome={tr("No professional assigned")} vazio={tr("No visits in this period yet")} />
          <Ranking icone={<FaTag size={11} />} titulo={tr("Ranking by service")} coluna={tr("Service")}
            linhas={servicos} totais={t} dinheiro={dinheiro} semNome={tr("No service recorded")} vazio={tr("No visits in this period yet")} />
          {unidades.length > 1 && (
            <Ranking icone={<FaLocationDot size={11} />} titulo={tr("Ranking by location")} coluna={tr("Location")}
              linhas={unidades} totais={t} dinheiro={dinheiro} semNome={tr("No location recorded")} vazio={tr("No visits in this period yet")} />
          )}

          <p className="text-[11px] text-g-muted leading-relaxed">
            {tr("Revenue here is each service's list price — the amount actually charged is not recorded on the appointment. Only visits that already ended count; cancelled visits and no-shows are left out.")}
            {cortadoPeloInicio ? <> {tr("Only appointments created since your account went live are counted:")} <span className="num">{desde.toLocaleDateString(localeDaTela(), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</span>.</> : null}
          </p>
        </>
      )}
    </div>
  );
}

export default Productivity;
