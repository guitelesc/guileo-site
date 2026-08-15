// functions/lib/spendGuard.js — DEFENSE-IN-DEPTH on money (per-tenant spend policy + human-in-loop).
// Called BEFORE agent-action mints a real pay link / bridges a card charge. Wraps the spend_check RPC
// (db/spend_policy.sql) which enforces a per-tenant single-charge cap, a rolling-DAY cap, a human-approval
// threshold, and an anomaly signal (>6× the tenant's 30d median). MAX_CHARGE_USD stays as a last-resort
// ceiling inside stripePaymentLink — this is the FIRST, per-tenant, human-in-the-loop line of defense.
//
// FAIL-CLOSED: if the guard RPC is unreachable, we DENY anything at/above a small hard floor so a guard
// outage can never wave through a big charge. Only tiny charges (< floor) pass on a guard hiccup. When we
// deny on an outage we set needsHuman:true so the caller escalates to the owner instead of silently dropping.
// guardCharge NEVER throws.
const SB_URL_DEFAULT = "https://ynihodbknhjirkdogxby.supabase.co";
const SB_ANON_DEFAULT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

// Below this, a guard OUTAGE is tolerable → allow. At/above it, an outage → DENY (fail-closed).
// Overridable per-deploy with SPEND_GUARD_FAILOPEN_FLOOR_CENTS. Default $50.
const DEFAULT_FAILOPEN_FLOOR_CENTS = 5000;

// ── O VALOR AMBÍGUO (achado por revisão adversarial 2026-08-11) ──────────────────────────────
// A leitura do valor aqui era `parseFloat(String(x).replace(/[^0-9.]/g, ""))`. Ela nunca falha —
// ela mente calada. A vírgula some, e o que era separador DECIMAL vira nada:
//
//     "45,00"   →  "4500"   →  US$ 4.500,00   em vez de US$ 45,00   (100× A MAIS)
//     "9,50"    →  "950"    →  US$ 950,00     em vez de US$ 9,50    (100× A MAIS)
//     "1.240"   →  1.24     →  US$ 1,24       em vez de US$ 1.240   (1000× a menos)
//
// A Gui atende em português e espanhol, e "45,00" é COMO O PREÇO É DITO nesses idiomas — não é
// entrada malformada, é entrada normal. Pior: o teto padrão da política (db/spend_policy.sql)
// só exige aprovação humana acima de US$ 1.000, então um serviço de R$ 9,50 vira um link de
// cobrança de US$ 950 que passa por TODAS as travas sem acender nenhuma luz.
//
// A guarda não pode "escolher" a leitura certa em nome do cliente: quando o texto pode significar
// dois valores diferentes, a resposta honesta é PARAR E PERGUNTAR. `valorParaCobranca` devolve a
// leitura correta (formato descoberto antes de limpar) e a ingênua (a que o caminho de cobrança
// ainda usa em functions/api/agent-action.js); divergiram, é ambíguo → needsHuman, sem cobrar.
// Isso vale mesmo em valor pequeno: o erro de 100× nasce justamente nos valores pequenos.
import { valorParaCobranca } from "./dinheiro.js";

// guardCharge(env, { email, amountDollars }) → { allow, needsHuman, reason, amountCents, ...diag }
// Integrator semantics:
//   needsHuman === true            → do NOT auto-charge; escalate to the owner with the amount for approval.
//   allow === false && !needsHuman → refuse politely + emitFailure.
//   allow === true  && !needsHuman → proceed to charge.
export async function guardCharge(env, { email, amountDollars } = {}) {
  const tenant = (email || "").toString().trim().toLowerCase();
  const lido = valorParaCobranca(amountDollars);
  // O valor gasto é o MAIOR entre as duas leituras. A guarda tem que julgar o pior caso: se o
  // texto pode ser US$ 4.500, é US$ 4.500 que ela leva à política, não US$ 45.
  const cents = Math.max(Number(lido.cents) || 0, Number(lido.ingenuo) || 0);
  const floor = Number(env && env.SPEND_GUARD_FAILOPEN_FLOOR_CENTS) || DEFAULT_FAILOPEN_FLOOR_CENTS;

  // nothing chargeable / invalid amount → let the normal path handle it (no charge to gate)
  if (!tenant || cents <= 0) {
    return { allow: true, needsHuman: false, reason: "no_amount", amountCents: cents };
  }

  // TEXTO AMBÍGUO → HUMANO, sempre, antes de qualquer consulta de política. Não é falha de
  // sistema (nada caiu), é dúvida sobre QUANTO cobrar — e adivinhar aqui é a diferença entre
  // R$ 9,50 e US$ 950 na fatura de um cliente do cliente.
  if (lido.ambiguo) {
    return {
      allow: false, needsHuman: true, reason: "valor_ambiguo", amountCents: cents,
      leituraCorreta: lido.cents, leituraIngenua: lido.ingenuo, detalhe: lido.motivo,
    };
  }

  // no secret configured → treat as guard-down (fail per the floor rule)
  const secret = env && env.INGEST_SECRET;
  if (!secret) return failClosed(cents, floor, "guard_unconfigured");

  try {
    const SB_URL = (env && env.GUI_ACTIONS_SUPABASE_URL) || SB_URL_DEFAULT;
    const SB_ANON = (env && env.GUI_ACTIONS_SUPABASE_ANON) || SB_ANON_DEFAULT;
    const r = await fetch(`${SB_URL}/rest/v1/rpc/spend_check`, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: secret, p_email: tenant, p_amount_cents: cents }),
    });
    if (!r.ok) return failClosed(cents, floor, `guard_http_${r.status}`);
    const j = await r.json().catch(() => null);
    if (!j || typeof j.allow !== "boolean") return failClosed(cents, floor, "guard_bad_response");
    return {
      allow: !!j.allow,
      needsHuman: !!j.needs_human,
      reason: (j.reason || "ok").toString(),
      amountCents: cents,
      todayCents: j.today_cents,
      maxSingleCents: j.max_single_cents,
      maxDayCents: j.max_day_cents,
      requireHumanOverCents: j.require_human_over_cents,
      medianCents: j.median_cents,
    };
  } catch {
    return failClosed(cents, floor, "guard_unreachable");
  }
}

// Guard outage policy: tiny charges pass; anything at/above the floor is DENIED and pushed to a human
// (never silently dropped, never silently charged).
function failClosed(cents, floor, reason) {
  if (cents < floor) return { allow: true, needsHuman: false, reason: `${reason}_under_floor`, amountCents: cents };
  return { allow: false, needsHuman: true, reason: `${reason}_fail_closed`, amountCents: cents };
}
