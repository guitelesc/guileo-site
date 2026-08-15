// COR DA MARCA QUE SOME — o e-mail que o cliente do cliente recebe não pode ter texto invisível.
// ═════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ESTE TESTE EXISTE
// A cor do cliente é extraída do site dele (functions/lib/brandExtract.js) e o e-mail branded a usa
// como COR DE TEXTO: `color:${accent}` no eyebrow, no preço, no valor do vale-presente, no marcador
// do rodapé. O cartão do e-mail é #161512. Uma marca de site escuro — theme-color "#1B1A17",
// "#111111", "#0f0f0f" — atravessa a validação de hex sem reclamar e desaparece: contraste ~1.05:1.
// Aconteceu de verdade num e-mail nosso (2026-08-11): #1B1A17 sobre #161512.
//
// A regra que este teste cobra: NENHUMA cor devolvida por corLegivel() fica abaixo de 4.5:1 contra
// o fundo do e-mail — e a cor do cliente, quando dá, é PRESERVADA em matiz (clareada, não trocada).
// Trocar pela laranja da casa na primeira dificuldade seria devolver a marca errada; deixar passar
// seria devolver um e-mail com buracos. As duas coisas são erradas por motivos diferentes.
//
//   node functions/lib/corLegivel.test.mjs
import { corLegivel, contraste } from "./clientBrand.js";

const FUNDO = "#161512";
let falhas = 0, total = 0;

const ok = (cond, msg) => { total++; if (cond) console.log(`✅ ${msg}`); else { falhas++; console.log(`❌ ${msg}`); } };

// matiz preservado = o canal dominante continua sendo o mesmo
const dominante = (hex) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return r >= g && r >= b ? "r" : g >= b ? "g" : "b";
};

// ── 1. O caso real: quase-preto quente sobre o cartão quase-preto ──
{
  const r = corLegivel("#1B1A17", FUNDO);
  ok(contraste(r.accent, FUNDO) >= 4.5, `#1B1A17 (o bug real) → ${r.accent} · contraste ${contraste(r.accent, FUNDO).toFixed(2)}:1`);
  ok(r.ajustada === true, "e o ajuste é declarado (accent_ajustada), não silencioso");
}

// ── 2. Cores escuras COM matiz: clareia, não troca a marca ──
for (const [cor, canal] of [["#0b2e6f", "b"], ["#14361c", "g"], ["#4a0d0d", "r"]]) {
  const r = corLegivel(cor, FUNDO);
  ok(contraste(r.accent, FUNDO) >= 4.5, `${cor} → ${r.accent} legível (${contraste(r.accent, FUNDO).toFixed(2)}:1)`);
  ok(dominante(r.accent) === canal, `${cor} → ${r.accent} mantém o matiz do cliente (canal ${canal})`);
}

// ── 3. Cores que já são legíveis passam INTACTAS (não mexer no que está certo) ──
for (const cor of ["#ff8a33", "#ffffff", "#7bc6ff", "#d6c29a"]) {
  const r = corLegivel(cor, FUNDO);
  ok(r.accent === cor && r.ajustada === false, `${cor} passa intacta (já legível)`);
}

// ── 4. Escuro SEM matiz (cinza/preto): não dá para clarear sem inventar cor → cor da casa ──
for (const cor of ["#000000", "#111111", "#1a1a1a"]) {
  const r = corLegivel(cor, FUNDO);
  ok(contraste(r.accent, FUNDO) >= 4.5, `${cor} (sem matiz) → ${r.accent} legível`);
  ok(r.motivo === "cor-escura-sem-matiz", `${cor} explica o porquê da troca`);
}

// ── 5. Entrada inválida nunca vira cor inválida ──
for (const cor of ["", null, undefined, "azul", "#zzz", "rgb(1,2,3)"]) {
  const r = corLegivel(cor, FUNDO);
  ok(/^#[0-9a-f]{6}$/i.test(r.accent) && contraste(r.accent, FUNDO) >= 4.5, `entrada inválida (${JSON.stringify(cor)}) → cor válida e legível`);
}

// ── 6. A régua em si: se contraste() estiver errada, todo o resto é teatro ──
ok(Math.abs(contraste("#ffffff", "#000000") - 21) < 0.01, "contraste(branco, preto) = 21:1");
ok(contraste("#1b1a17", "#161512") < 1.2, "contraste(#1B1A17, #161512) < 1.2:1 — o bug era invisível mesmo");

console.log(`\n${total - falhas}/${total} — a cor da marca nunca some no e-mail`);
process.exit(falhas ? 1 : 0);
