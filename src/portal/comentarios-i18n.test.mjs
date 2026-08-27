// I18N DA ABA COMENTÁRIO → DM: nenhuma string em inglês numa tela em português.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// A lei do projeto é "idioma em TODA superfície". O jeito de quebrar essa lei não é escrever
// errado — é escrever certo e ESQUECER de traduzir: tr() devolve a própria string quando a chave
// não existe, então a tela funciona, ninguém vê erro, e o cliente brasileiro lê inglês.
// Falha silenciosa por definição. Este teste extrai toda string literal passada pro tr() do
// componente e exige que ela exista nos três dicionários.
import fs from "node:fs";
import pt from "./dict-pt.js";
import es from "./dict-es.js";
import hi from "./dict-hi.js";

const src = fs.readFileSync(new URL("./Comentarios.jsx", import.meta.url), "utf8");

// tr("...") e tr('...') — só literais; interpolação não dá pra verificar estaticamente.
const chaves = new Set();
for (const m of src.matchAll(/\btr\(\s*(["'])((?:\\.|(?!\1).)*)\1/g)) chaves.add(m[2].replace(/\\"/g, '"'));
// <Empty text="..."/> também passa por tr() lá dentro.
for (const m of src.matchAll(/<Empty[^>]*\btext=\{?\s*["']((?:\\.|[^"'])*)["']/g)) chaves.add(m[1]);

let falhas = 0;
const dicts = [["pt", pt], ["es", es], ["hi", hi]];
console.log(`\n${chaves.size} strings traduzíveis na aba\n`);
for (const [nome, d] of dicts) {
  const faltando = [...chaves].filter((k) => !(k in d));
  if (faltando.length) {
    falhas += faltando.length;
    console.log(`  ✗ ${nome}: ${faltando.length} sem tradução`);
    faltando.slice(0, 8).forEach((k) => console.log(`      "${k.slice(0, 70)}"`));
  } else console.log(`  ✓ ${nome}: as ${chaves.size} traduzidas`);
}

// A tradução também não pode ser igual ao inglês (copiar/colar é o disfarce do "traduzi").
for (const [nome, d] of dicts) {
  const iguais = [...chaves].filter((k) => d[k] === k && k.length > 3 && !/^\{|^https?:/.test(k));
  if (iguais.length) { falhas += iguais.length; console.log(`  ✗ ${nome}: ${iguais.length} traduções idênticas ao inglês: ${iguais.slice(0,3).join(" · ")}`); }
}

console.log(falhas ? `\n❌ ${falhas} problema(s) de idioma\n` : "\n✅ i18n da aba: completa nos 4 idiomas\n");
process.exit(falhas ? 1 : 0);
