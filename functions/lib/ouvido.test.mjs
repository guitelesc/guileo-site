// O OUVIDO — que palavras o reconhecimento de fala é avisado que este negócio vende.
// Nasceu de "Botox" ouvido como "bath" (ligação do Luis, 28/09): negar venda por ruído.
import { palavrasDoOuvido } from "./ouvido.js";

let falhas = 0;
const confere = (nome, cond, detalhe) => { if (!cond) { falhas++; console.log(`❌ ${nome} — ${detalhe}`); } };

const natura = palavrasDoOuvido({
  textos: ["NEUROTOXIN — Botox, Xeomin and Dysport. KYBELLA for under-chin fat. Brazilian Keratin, balayage."],
  precos: "Deep Tissue 60min · Astoria — $125\nMini Facial · Astoria — $75",
  nomes: ["Natura Spa + Salon", "Lilian"],
});
confere("Botox entra", natura.includes("Botox"), JSON.stringify(natura));
confere("Kybella entra mesmo escrito em maiúsculas", natura.includes("Kybella"), JSON.stringify(natura));
confere("nome da casa e da agente", natura.includes("Natura") && natura.includes("Lilian"), JSON.stringify(natura));
confere("palavra do catálogo", natura.includes("Tissue") && natura.includes("Facial"), JSON.stringify(natura));
confere("o que a casa NÃO menciona fica de fora", !natura.includes("Invisalign") && !natura.includes("Juvederm"), JSON.stringify(natura));
confere("sem repetidos", new Set(natura.map((w) => w.toLowerCase())).size === natura.length, JSON.stringify(natura));

const encanador = palavrasDoOuvido({ textos: ["We fix leaks and install water heaters."], precos: "Drain cleaning — $150", nomes: ["Joe Plumbing", "Gui"] });
confere("encanador não ganha vocabulário de spa", !encanador.includes("Botox") && !encanador.includes("balayage"), JSON.stringify(encanador));
confere("encanador ganha o próprio serviço", encanador.includes("Drain") && encanador.includes("cleaning"), JSON.stringify(encanador));

confere("vazio não quebra", Array.isArray(palavrasDoOuvido()) && palavrasDoOuvido().length === 0, "esperava []");
confere("respeita o teto", palavrasDoOuvido({ precos: Array.from({ length: 80 }, (_, i) => `Servico${"abcdefghij"[i % 10]}${"klmnopqrst"[Math.floor(i / 10)]}x — $10`).join("\n"), max: 40 }).length <= 40, "passou de 40");

if (falhas) { console.log(`\n${falhas} errados.`); process.exit(1); }
console.log("✅ 10/10 — o ouvido conhece o que ESTE negócio vende, e só isso");
