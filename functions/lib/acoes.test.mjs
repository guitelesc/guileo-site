// AS AÇÕES QUE O /admin CHAMA TÊM QUE EXISTIR.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ESTE TESTE EXISTE (2026-09-01)
// Eu reescrevi um bloco de meta-connect.js substituindo "de uma âncora até outra" e levei junto
// TRÊS ações que moravam no meio: descobrir_ig, token_escopos e subscribe. Elas sumiram da
// produção e NADA acusou — build verde, 29 arquivos de teste verdes, deploy limpo. O commit dizia
// "233 deleções" e eu aprovei sem ler, porque o número grande parecia o esperado do rewrite.
//
// Uma rota que perde uma ação não quebra: ela cai no fim do `if/else` e responde "ação inválida".
// É o mesmo formato do resto dos incidentes deste projeto — a falha se parece com funcionamento.
// Este teste é a rede: se uma ação sair do arquivo, ele fica vermelho ANTES do deploy.
//
// Ao adicionar uma ação nova de verdade, some o nome aqui — é de propósito que dê trabalho.
import { readFileSync } from "node:fs";

let falhas = 0;
const ok = (c, o) => { if (!c) { falhas++; console.log("  ✗ " + o); } else console.log("  ✓ " + o); };

const ESPERADO = {
  "functions/api/meta-connect.js": [
    "status", "auto", "auditar", "mapear_ig", "descobrir_ig", "token_escopos",
    "subscribe", "app_subscribe", "contas_disponiveis", "adicionar_conta",
  ],
  "functions/api/meta-comentarios.js": ["salvar", "apagar", "metricas"],
};

for (const [arquivo, acoes] of Object.entries(ESPERADO)) {
  const src = readFileSync(new URL(`../../${arquivo}`, import.meta.url), "utf8");
  console.log(`\n— ${arquivo} —`);
  for (const a of acoes) {
    ok(src.includes(`"${a}"`), `ação "${a}" ainda existe`);
  }
}

console.log(falhas ? `\n❌ ${falhas} ação(ões) sumiram\n` : "\n✅ todas as ações no lugar\n");
process.exit(falhas ? 1 : 0);
