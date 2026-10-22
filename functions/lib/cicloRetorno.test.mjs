// O CICLO DE VOLTA SUGERIDO — cada serviço no seu relógio, e na dúvida nenhum lembrete.
import { cicloSugerido, sugestoesParaOsSemCiclo } from "./cicloRetorno.js";

let falhas = 0, total = 0;
const confere = (nome, cond) => { total++; if (!cond) { falhas++; console.log(`❌ ${nome}`); } };
const c = cicloSugerido;

// o cardápio real da Natura (nomes como estão no cadastro)
confere("Facial · Astoria → 28", c("Facial · Astoria") === 28);
confere("Facial + Microdermabrasion · UES → 28", c("Facial + Microdermabrasion · UES") === 28);
confere("Deep Pore Cleansing · UES Med Spa → 28", c("Deep Pore Cleansing · UES Med Spa") === 28);
confere("Mini Facial → 28", c("Mini Facial · Astoria") === 28);
confere("Massage 60min → 28", c("Massage 60min · Astoria") === 28);
confere("Deep Tissue 60min → 28", c("Deep Tissue 60min · UES Med Spa") === 28);
confere("Haircut → 42", c("Haircut · UES") === 42);
confere("Hair Color → 49 (cor antes de corte)", c("Hair Color · Astoria") === 49);
confere("Lashes (classic set) → 21", c("Lashes · Astoria (classic set)") === 21);
confere("Laser Hair Removal → 35 (laser antes de 'hair')", c("Laser Hair Removal") === 35);
confere("Acupuncture → 14", c("Acupuncture") === 14);
confere("CoolSculpting Elite → 0 (plano do profissional)", c("CoolSculpting Elite") === 0);
confere("Med Spa Consultation (free) → 0", c("Med Spa Consultation (free) · UES Med Spa") === 0);

// os que mais custam errar
confere("Botox → 90, não 28", c("Botox") === 90);
confere("consulta de Botox continua sendo consulta → 0", c("Botox Consultation") === 0);
confere("Lip Filler → 180", c("Lip Filler") === 180);
confere("corte e cor juntos seguem a cor", c("Cut & Color") === 49);
confere("pacote de massagem não tem volta", c("Massage Package (5 sessions)") === 0);

// idiomas e acento
confere("Massagem relaxante → 28", c("Massagem relaxante") === 28);
confere("Coloração → 49 (com acento)", c("Coloração") === 49);
confere("Depilación con cera → 28", c("Depilación con cera") === 28);
confere("Manicure em gel → 21", c("Manicure em gel") === 21);

// na dúvida, nada
confere("serviço desconhecido → 0", c("Aura Reading") === 0);
confere("vazio → 0", c("") === 0 && c(null) === 0);
confere("'gelato' não é 'gel'", c("Gelato tasting") === 0);

// só sugere para quem ainda não decidiu
const s = sugestoesParaOsSemCiclo([
  { id: "a", name: "Facial", days: null }, { id: "b", name: "Botox", days: 120 },
  { id: "c", name: "Consultation", days: undefined }, { id: "d", name: "Haircut", days: 0 }, { name: "sem id", days: null },
]);
confere("quem já tem valor (até 0) não é tocado", s.length === 2 && s[0].id === "a" && s[1].id === "c");
confere("a sugestão 0 também é gravada", s[1].days === 0 && s[0].days === 28);
confere("lista que não é lista não quebra", sugestoesParaOsSemCiclo(null).length === 0);

if (falhas) { console.log(`\n${falhas} errados.`); process.exit(1); }
console.log(`✅ ${total}/${total} — cada serviço no seu relógio de volta; na dúvida, nenhum lembrete`);
