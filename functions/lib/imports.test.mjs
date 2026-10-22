// Caça a "identificador usado sem import". Roda com:
//   node functions/lib/imports.test.mjs
//
// POR QUE EXISTE: em 2026-08-08 este teste (rodado à mão) achou `sendOrFlag` sendo usado em
// functions/api/voice-fallback.js SEM estar importado — no text-back de ligação perdida, que é a
// promessa principal do produto. O arquivo carrega normalmente; o `ReferenceError` só estoura
// quando a linha executa, ou seja, EXATAMENTE quando um cliente perde uma ligação. Nenhum lint de
// sintaxe pega isso, e nenhum teste de unidade passa por ali.
//
// Foi a SEGUNDA vez no mesmo dia: horas antes eu usei `emitFailure` sem importar em
// agent-schedule.js. O padrão é sempre o mesmo — extraio um helper para uma biblioteca, uso nos
// chamadores, e esqueço um import. Custa 200ms conferir e custa uma ligação perdida não conferir.
//
// Só olha os helpers DO PROJETO (lista abaixo). Métodos de objeto e funções da linguagem geram
// ruído demais para valer a pena, e uma varredura barulhenta é uma varredura que ninguém roda.
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

const HELPERS = [
  "svcRpc", "emitFailure", "sendOrFlag", "sendText", "faladoComoGente", "resolveSlot",
  "oQueAPessoaDisse", "brandFor", "appointmentEmail", "ownerAlertEmail", "sellerWelcomeEmail",
  "isOwnerEmail", "sameOrigin", "rateLimited", "buildConversationConfig", "resolveNativeVoices",
  "avisarDono", "donoEmail",
];

const arquivos = globSync("functions/**/*.js");
const achados = [];

for (const f of arquivos) {
  const src = readFileSync(f, "utf8");
  // sem comentários: `brandFor` citado num comentário não é uso.
  const semComentario = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const disponiveis = new Set();
  // import { a, b as c } from "..."   E   const { a } = await import("...")
  for (const bloco of semComentario.matchAll(/(?:import|const)\s*\{([^}]*)\}\s*(?:from|=)/g)) {
    for (const nome of bloco[1].split(",")) disponiveis.add(nome.trim().split(" as ").pop().trim());
  }
  // definidos no próprio arquivo
  for (const m of semComentario.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) disponiveis.add(m[1]);
  for (const m of semComentario.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) disponiveis.add(m[1]);

  for (const h of HELPERS) {
    if (new RegExp(`\\b${h}\\s*\\(`).test(semComentario) && !disponiveis.has(h)) {
      achados.push(`${f} → usa ${h}() sem import nem definição`);
    }
  }
}

for (const a of achados) console.log(`❌ ${a}`);
console.log(achados.length
  ? `\n${achados.length} uso(s) sem import — isto estoura em produção, não no build`
  : `✅ ${arquivos.length} arquivos · nenhum helper usado sem import`);
if (achados.length) process.exit(1);
