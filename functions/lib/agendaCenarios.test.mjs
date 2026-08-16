// REGRESSÃO DO AGENDAMENTO — de 1 sucesso para uma TAXA.  `node functions/lib/agendaCenarios.test.mjs`
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// QUE DEFEITO REAL ISTO IMPEDE DE VOLTAR
//
// 9 ligações reais em que a pessoa queria marcar horário. 1 virou agendamento. As duas causas
// conhecidas foram corrigidas em 2026-08-16 — serviço+unidade resolvidos juntos (bizMatch.js) e a
// hora falada resolvida contra a agenda de verdade (slotResolver.js) — mas só UMA ligação real
// rodou depois. Amostra 1 não distingue conserto de sorte.
//
// Este arquivo roda o caminho de decisão inteiro contra 3 negócios completos (o Natura REAL, um
// restaurante e uma clínica) e 16 falas diferentes, sem rede e sem banco. Cada caso guarda um dos
// dois lados do dinheiro:
//   • NEGAR horário que existe  → o cliente liga pro concorrente e o painel marca "sucesso";
//   • PERGUNTAR o que já sabemos → o cliente desliga no meio do interrogatório.
//
// O teste também confere que o ESPELHO não desalinhou do original: ele LÊ
// functions/api/agent-schedule.js e falha se a função `pick` copiada mudou lá, ou se alguma das
// marcas da ordem de decisão sumiu. Espelho que ninguém confere vira mentira em duas semanas —
// e uma bateria verde apoiada num espelho velho é pior que nenhuma bateria.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  CENARIOS, RADAR, decidirAgenda, horarioLocal, FONTE_PICK, MARCAS_ORDEM,
} from "./agendaCenarios.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
let falhas = 0;
const erro = (...l) => { falhas++; l.forEach((x) => console.log(x)); };

// ── 0) O ESPELHO AINDA REFLETE O ORIGINAL? ─────────────────────────────────────────────────────
// Roda PRIMEIRO de propósito: se o endpoint mudou, os resultados abaixo falam de outro sistema.
const ENDPOINT = resolve(AQUI, "../api/agent-schedule.js");
let fonte = "";
try { fonte = readFileSync(ENDPOINT, "utf8"); }
catch { erro(`❌ não consegui ler ${ENDPOINT} — sem ele não dá pra afirmar que o espelho vale`); }

if (fonte) {
  const enxuto = (s) => s.replace(/\s+/g, " ").trim();
  if (!enxuto(fonte).includes(enxuto(FONTE_PICK))) {
    erro(
      "❌ a função `pick` (resolvedor do PROFISSIONAL) mudou em functions/api/agent-schedule.js",
      "     e a cópia em agendaCenarios.js (FONTE_PICK) ficou para trás.",
      "     Sincronize as duas ANTES de confiar nos cenários — eles estariam testando código morto.",
    );
  }
  for (const marca of MARCAS_ORDEM) {
    if (!fonte.includes(marca)) {
      erro(
        `❌ sumiu do agent-schedule.js a marca de ordem: ${marca}`,
        "     ou a ordem de decisão mudou (e o espelho precisa mudar junto), ou uma trava caiu.",
      );
    }
  }
}

// ── 0b) O GERADOR DE HORÁRIO ESTÁ CERTO NO FUSO? ───────────────────────────────────────────────
// A agenda dos cenários é construída em horário LOCAL do negócio. Se este helper errar o fuso,
// todo "amanhã às 13h" vira outro horário e o teste ficaria vermelho (ou pior: verde por acaso).
// Confiro com Intl, que é uma fonte independente do cálculo — não releio o que acabei de escrever.
for (const [tz, hora] of [["America/New_York", 13], ["America/Sao_Paulo", 20], ["Asia/Kolkata", 9]]) {
  const iso = horarioLocal(tz, 1, hora, 0);
  const lido = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  const amanha = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 86400000));
  const diaLido = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  if (lido !== `${String(hora).padStart(2, "0")}:00` || diaLido !== amanha) {
    erro(`❌ horarioLocal(${tz}) errou: pedi amanhã ${hora}:00, saiu ${diaLido} ${lido} (${iso})`);
  }
}

// ── 1) OS CENÁRIOS ─────────────────────────────────────────────────────────────────────────────
const fmt = (v) => (v === undefined ? "—" : v === null ? "null" : Array.isArray(v) ? `[${v.join(" | ")}]` : String(v));

for (const c of CENARIOS) {
  const r = decidirAgenda(c.negocio, c.fala);
  const problemas = [];
  const conf = (campo, esperado, obtido) => {
    if (esperado === undefined) return;
    const a = Array.isArray(esperado) ? esperado.join("|") : String(esperado);
    const b = Array.isArray(obtido) ? (obtido || []).join("|") : String(obtido);
    if (a !== b) problemas.push(`${campo}: esperado ${fmt(esperado)} · obtido ${fmt(obtido)}`);
  };
  conf("desfecho", c.espera.desfecho, r.desfecho);
  conf("serviço", c.espera.servico, r.servico);
  conf("unidade", c.espera.unidade, r.unidade);
  conf("profissional", c.espera.profissional, r.profissional);
  conf("quando", c.espera.quando, r.quando);
  conf("unidades ofertadas", c.espera.unidades, r.unidades);
  if (c.espera.slots !== undefined) conf("nº de horários", c.espera.slots, (r.slots || []).length);

  if (problemas.length) {
    falhas++;
    console.log(`❌ ${c.id}`);
    console.log(`     falou    ${JSON.stringify(c.fala)}`);
    problemas.forEach((p) => console.log(`     ${p}`));
    console.log(`     💸 ${c.dinheiro}`);
  }
}

// ── 2) RADAR — comportamento atual que NÃO travo, mas também não deixo invisível ────────────────
// Não conta como falha de propósito: um teste que congela um defeito impede quem for consertá-lo.
console.log("\n📡 RADAR (comportamento ATUAL medido, não travado — nenhum destes reprova o teste):");
for (const r of RADAR) {
  const out = decidirAgenda(r.negocio, r.fala);
  console.log(`   • ${r.id}`);
  console.log(`     falou ${JSON.stringify(r.fala)}`);
  console.log(`     → ${r.observado(out)}`);
}

// ── 3) VEREDITO ────────────────────────────────────────────────────────────────────────────────
const TOTAL = CENARIOS.length;
console.log("");
if (falhas) {
  console.log(`❌ ${falhas} verificação(ões) falharam em ${TOTAL} cenários.`);
  console.log("   Serviço, unidade ou horário errados significam UMA coisa na ligação: a agente");
  console.log("   anuncia que não há horário — para um horário que existe — e o cliente liga pro");
  console.log("   concorrente. Foi assim que 8 de 9 ligações reais morreram.");
  process.exit(1);
}
console.log(`✅ ${TOTAL}/${TOTAL} cenários — 3 negócios (spa real, restaurante, clínica), espelho alinhado com o endpoint.`);
