// Prova do mapeador de ramo contra os textos REAIS que existem no cadastro (lidos do banco em
// 2026-09-28), mais os casos que não podem virar palpite.
import { setorParaVertical } from "./setor.js";
let falhas = 0;
const t = (entrada, esperado) => {
  const r = setorParaVertical(entrada);
  const ok = r === esperado;
  if (!ok) falhas++;
  console.log(`${ok ? "✅" : "❌"} ${JSON.stringify(entrada)} → ${r}${ok ? "" : `  (esperava ${esperado})`}`);
};
t("salon", "salon");                         // Natura Spa
t("hair salon", "salon");
t("dental clinic", "clinic");
t("medical clinic", "clinic");               // "clinic" vem antes de "medical": é clínica
t("restaurante", "restaurant");
t("educação médica, preparatório para Revalida e ENAMED", "education"); // é escola de médicos, não consultório
t("SALON", "salon");                         // caixa não importa
t("  salon  ", "salon");
// sem correspondência → NÃO adivinha
t("agência de viagens, vistos e turismo", null);
t("agência de anúncios e criativo para negócios locais", null);
t("services", null);
t("", null);
t(null, null);
t(undefined, null);
if (falhas) { console.error(`\n❌ ${falhas} falha(s)`); process.exit(1); }
console.log("\n✅ mapeador de ramo: tudo certo");
