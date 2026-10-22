// RELATÓRIO DE PRODUTIVIDADE — ajudantes PUROS (sem rede, sem DOM), usados pelo endpoint
// functions/api/relatorio-produtividade.js e pela tela src/portal/Productivity.jsx.
//
//   · períodos prontos (este mês / mês passado / últimos 30 dias) → { from, to } ISO em UTC;
//   · validação do período que chega no corpo do POST;
//   · dinheiro (centavos → texto na moeda do negócio) e percentual do total.
//
// PERÍODO É [from, to): `from` entra, `to` fica de fora — o mesmo corte que a RPC biz_productivity
// aplica (upper(span) >= from and upper(span) < to). Meses são de CALENDÁRIO UTC.
// Teste: node functions/lib/produtividade.test.mjs

export const PRESETS = ["this_month", "last_month", "last_30_days"];
export const MAX_DIAS = 400;
const DIA_MS = 24 * 60 * 60 * 1000;

const valida = (d) => d instanceof Date && !Number.isNaN(d.getTime());

/** { preset, from, to } em ISO UTC. `agora` é injetável para teste. Preset desconhecido → this_month.
 *  Os meses são montados com Date.UTC(ano, mês ± 1, 1) — nunca com setMonth() sobre "hoje": em 31 de
 *  março setMonth(1) cai em 3 de março (fevereiro não tem dia 31) e o "mês passado" sairia errado. */
export function periodoPreset(preset, agora = new Date()) {
  const n = valida(agora) ? agora : new Date();
  const y = n.getUTCFullYear();
  const m = n.getUTCMonth();
  if (preset === "last_month") {
    return { preset, from: new Date(Date.UTC(y, m - 1, 1)).toISOString(), to: new Date(Date.UTC(y, m, 1)).toISOString() };
  }
  if (preset === "last_30_days") {
    return { preset, from: new Date(n.getTime() - 30 * DIA_MS).toISOString(), to: n.toISOString() };
  }
  return { preset: "this_month", from: new Date(Date.UTC(y, m, 1)).toISOString(), to: new Date(Date.UTC(y, m + 1, 1)).toISOString() };
}

/** Período que veio no corpo do POST → { from, to } ISO, ou { erro }.
 *  Sem from E sem to = mês de calendário corrente. Só um dos dois, data ilegível ou to <= from =
 *  erro explícito (nunca um período "consertado" em silêncio). Mais de MAX_DIAS: mantém o início e
 *  encurta o fim, marcando `encurtado` — a RPC aplica o mesmo teto. */
export function normalizarPeriodo(entrada, agora = new Date()) {
  const e = entrada || {};
  const temFrom = e.from !== undefined && e.from !== null && String(e.from).trim() !== "";
  const temTo = e.to !== undefined && e.to !== null && String(e.to).trim() !== "";
  if (!temFrom && !temTo) { const p = periodoPreset("this_month", agora); return { from: p.from, to: p.to, encurtado: false }; }
  if (!temFrom || !temTo) return { erro: "from and to must be sent together" };
  const f = new Date(String(e.from));
  const t = new Date(String(e.to));
  if (!valida(f) || !valida(t)) return { erro: "from/to must be ISO dates" };
  if (t.getTime() <= f.getTime()) return { erro: "to must be after from" };
  const teto = f.getTime() + MAX_DIAS * DIA_MS;
  if (t.getTime() > teto) return { from: f.toISOString(), to: new Date(teto).toISOString(), encurtado: true };
  return { from: f.toISOString(), to: t.toISOString(), encurtado: false };
}

const LOCALE_DA_MOEDA = { USD: "en-US", BRL: "pt-BR", EUR: "pt-PT", MXN: "es-MX", CAD: "en-CA", GBP: "en-GB", INR: "en-IN" };

/** Centavos → texto na moeda. SEM conversão: 45000 é "450" na moeda informada, só muda o símbolo.
 *  Valor ilegível vira 0 formatado (nunca "NaN" na tela). Moeda inválida cai em USD declarado. */
export function formatarDinheiro(cents, moeda = "USD") {
  const n = Number(cents);
  const v = (Number.isFinite(n) ? n : 0) / 100;
  const cur = /^[A-Z]{3}$/.test(String(moeda || "")) ? String(moeda) : "USD";
  try {
    return new Intl.NumberFormat(LOCALE_DA_MOEDA[cur] || "en-US", { style: "currency", currency: cur, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v);
  } catch {
    return `$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
}

/** Parte do total em %, com 1 casa (número). Total zero/ilegível → null: "sem base", não "0%". */
export function percentual(parte, total) {
  const p = Number(parte);
  const t = Number(total);
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) return null;
  return Math.round((p / t) * 1000) / 10;
}

/** "42.5%" · inteiro sai sem casa ("40%") · sem base sai "—". */
export function formatarPercentual(parte, total) {
  const v = percentual(parte, total);
  if (v === null) return "—";
  return `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
}
