// O CONTRATO DA VITRINE COM O MOTOR DE AGENDA — nome de campo é contrato, não detalhe.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ESTE TESTE EXISTE
// Em 27/08 a revisão achou que o `book` da vitrine mandava `customer_name`/`customer_phone`,
// nomes que agent-schedule.js NUNCA leu (ele lê `b.name` e `b.contact`). Todo agendamento feito
// pelos sites de cliente nascia com nome e telefone VAZIOS: o horário ficava preso e o negócio
// não tinha quem chamar.
//
// O que torna esse defeito perigoso não é o erro — é o disfarce. O motor devolvia um id REAL,
// então o teste de comprovante do endpoint ("sem id não considero marcado") PASSAVA, e a tela
// dizia "agendado". Comprovante certo sobre o campo errado se parece com sucesso.
//
// Por isso este teste não confere strings fixas: ele LÊ os dois arquivos e compara o conjunto de
// campos que a vitrine envia com o conjunto que o motor de fato consome. Trocar um nome dos dois
// lados continua passando; trocar de um lado só quebra aqui, que é o ponto.
import fs from "node:fs";

const vitrine = fs.readFileSync(new URL("./vitrine-agenda.js", import.meta.url), "utf8");
const motorSrc = fs.readFileSync(new URL("./agent-schedule.js", import.meta.url), "utf8");

let falhas = 0;
const ok = (c, o) => { if (!c) { falhas++; console.log("  ✗ " + o); } else console.log("  ✓ " + o); };

// ── 1. o que a vitrine ENVIA: as chaves de todo `motor({ … })` ───────────────────────────────
const enviados = new Set();
for (const m of vitrine.matchAll(/\bmotor\(\{([^}]*)\}\)/g)) {
  for (const k of m[1].matchAll(/(?:^|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g)) enviados.add(k[1]);
}
// `email` é injetado pelo próprio helper motor(), não por quem chama.
enviados.add("email");

// ── 2. o que o motor LÊ: todo `b.<campo>` em agent-schedule.js ───────────────────────────────
const lidos = new Set([...motorSrc.matchAll(/\bb\.([a-zA-Z_][a-zA-Z0-9_]*)/g)].map((m) => m[1]));
// o email do tenant é resolvido antes do corpo, por outro caminho
lidos.add("email");

console.log(`\nvitrine envia ${enviados.size} campos · motor lê ${lidos.size}\n`);

const orfaos = [...enviados].filter((k) => !lidos.has(k));
ok(orfaos.length === 0,
   orfaos.length ? `campos enviados que o motor NUNCA lê: ${orfaos.join(", ")} — a reserva nasce sem eles`
                 : "todo campo que a vitrine envia é um campo que o motor lê");

// ── 3. as âncoras do agendamento: sem estes dois o negócio não consegue ligar de volta ────────
for (const campo of ["name", "contact"]) {
  ok(enviados.has(campo), `o book manda \`${campo}\` (é ele que vira quem chamar de volta)`);
  ok(lidos.has(campo), `o motor lê \`${campo}\``);
}
ok(!enviados.has("customer_name") && !enviados.has("customer_phone"),
   "os nomes antigos (customer_name/customer_phone) não voltaram");

// ── 4. o comprovante continua obrigatório (não relaxar junto com a correção) ─────────────────
ok(/d\.ok !== true \|\| !id/.test(vitrine), "o book ainda recusa 'ok' sem id do agendamento");

console.log(falhas ? `\n❌ ${falhas} falha(s) de contrato\n` : "\n✅ contrato da vitrine ↔ motor de agenda: fechado\n");
process.exit(falhas ? 1 : 0);
