// PROVA DO ÍCONE DO APP — roda com:  node functions/lib/appIcon.test.mjs
//
// POR QUE EXISTE: functions/lib/appIcon.js escreve um PNG byte a byte (CRC32, adler32, zlib
// stored, empacotamento de 4 bits). Um bit errado em qualquer um desses passos gera um arquivo
// que o servidor devolve com 200 e o celular NÃO abre — o dono instalaria o app do negócio dele
// e veria um ícone quebrado na tela inicial. "Deu 200" não prova nada aqui.
//
// Então a prova é a real: descomprimir o PNG com o zlib do Node (o mesmo algoritmo que o
// navegador usa), conferir assinatura/IHDR/PLTE, recontar o CRC de cada chunk e voltar do
// bitmap para o pixel — inclusive checando que a cor de fundo é EXATAMENTE a cor da marca e que
// a letra ficou dentro da safe zone do ícone maskable.
import { inflateSync } from "node:zlib";
import { iconePng, inicialDe, hexRgb } from "./appIcon.js";

let falhas = 0;
const ok = (cond, msg) => { if (!cond) { console.log(`❌ ${msg}`); falhas++; } };

const TAB = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (b) => { let c = 0xffffffff; for (const x of b) c = TAB[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

// Lê o PNG do jeito que um decodificador leria: chunk a chunk, CRC conferido.
function lerPng(buf) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  ok(sig.every((b, i) => buf[i] === b), "assinatura PNG inválida");
  const chunks = {};
  let o = 8;
  while (o < buf.length) {
    const len = new DataView(buf.buffer, buf.byteOffset + o, 4).getUint32(0);
    const tipo = String.fromCharCode(...buf.subarray(o + 4, o + 8));
    const dados = buf.subarray(o + 8, o + 8 + len);
    const crcLido = new DataView(buf.buffer, buf.byteOffset + o + 8 + len, 4).getUint32(0);
    ok(crc32(buf.subarray(o + 4, o + 8 + len)) === crcLido, `CRC errado no chunk ${tipo}`);
    chunks[tipo] = chunks[tipo] ? Buffer.concat([chunks[tipo], Buffer.from(dados)]) : Buffer.from(dados);
    o += 12 + len;
  }
  ok(o === buf.length, "sobrou/faltou byte no fim do arquivo");
  return chunks;
}

for (const size of [192, 512]) {
  const cor = "#2F6F4E";
  const png = Buffer.from(iconePng({ nome: "Natura Spa", cor, size }));
  const c = lerPng(png);

  ok(!!c.IHDR && !!c.PLTE && !!c.IDAT && !!c.IEND, `${size}: faltou chunk obrigatório`);
  const w = c.IHDR.readUInt32BE(0), h = c.IHDR.readUInt32BE(4);
  ok(w === size && h === size, `${size}: IHDR diz ${w}x${h}`);
  ok(c.IHDR[8] === 4 && c.IHDR[9] === 3, `${size}: bitDepth/colorType errados (${c.IHDR[8]}/${c.IHDR[9]})`);
  ok(c.PLTE.length === 48, `${size}: paleta com ${c.PLTE.length / 3} cores (esperado 16)`);

  // A COR DA MARCA é a entrada 0 da paleta — o fundo do ícone. Se isto sair errado, o app do
  // cliente nasce com a cor de outra pessoa.
  const [r, g, b] = hexRgb(cor);
  ok(c.PLTE[0] === r && c.PLTE[1] === g && c.PLTE[2] === b, `${size}: paleta[0] não é a cor da marca`);

  // Descompressão REAL: se o zlib do Node engasgar, o navegador engasga igual.
  let raw;
  try { raw = inflateSync(c.IDAT); } catch (e) { ok(false, `${size}: IDAT não descomprime (${e.message})`); continue; }
  const bytesLinha = Math.ceil(size / 2);
  ok(raw.length === (bytesLinha + 1) * size, `${size}: dados brutos com ${raw.length} bytes, esperado ${(bytesLinha + 1) * size}`);

  // De volta ao pixel.
  const idx = (x, y) => {
    const byte = raw[y * (bytesLinha + 1) + 1 + (x >> 1)];
    return x % 2 === 0 ? byte >> 4 : byte & 15;
  };
  ok(idx(0, 0) === 0 && idx(size - 1, size - 1) === 0, `${size}: canto não é a cor da marca (fundo cheio quebrado)`);

  // A letra existe (há pixel de tinta) e cabe na SAFE ZONE do maskable: tudo dentro dos 80%
  // centrais, senão o Android corta a inicial do negócio na tela inicial.
  let tinta = 0, minX = size, maxX = -1, minY = size, maxY = -1;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (idx(x, y) > 7) { tinta++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  ok(tinta > size * 2, `${size}: quase nenhum pixel de letra (${tinta}) — o monograma não desenhou`);
  const margem = size * 0.1;
  ok(minX >= margem && minY >= margem && maxX <= size - margem && maxY <= size - margem,
    `${size}: letra fora da safe zone (x ${minX}-${maxX}, y ${minY}-${maxY})`);
}

// Cada glifo do alfabeto desenha alguma coisa — um glifo com tabela torta sairia como quadrado liso.
for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") {
  const png = Buffer.from(iconePng({ nome: ch + "teste", cor: "#123456", size: 96 }));
  const c = lerPng(png);
  const raw = inflateSync(c.IDAT);
  const bl = Math.ceil(96 / 2);
  let tinta = 0;
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const byte = raw[y * (bl + 1) + 1 + (x >> 1)];
    if ((x % 2 === 0 ? byte >> 4 : byte & 15) > 7) tinta++;
  }
  ok(tinta > 60, `glifo "${ch}" saiu vazio (${tinta} px)`);
}

// A inicial vem do nome REAL, com acento resolvido — "Açaí do Zé" é um A, não um quadrado.
ok(inicialDe("Açaí do Zé") === "A", "inicial acentuada errada");
ok(inicialDe("3 Irmãos Pizzaria") === "3", "inicial numérica errada");
ok(inicialDe("  ") === "", "nome vazio deveria devolver inicial vazia");
// Nome sem letra latina → anel neutro (nunca a marca da Guileo, nunca uma letra inventada).
const anel = Buffer.from(iconePng({ nome: "寿司", cor: "#000000", size: 96 }));
ok(anel.length > 100, "ícone de nome não-latino não foi gerado");

console.log(falhas === 0
  ? "✅ ícone do app: PNG válido (CRC + zlib + pixels) em 192/512, 36 glifos, cor da marca e safe zone"
  : `❌ ${falhas} falha(s) no ícone do app`);
process.exit(falhas ? 1 : 0);
