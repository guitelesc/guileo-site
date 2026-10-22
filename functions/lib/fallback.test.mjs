// GUARDA DE FALLBACK — erro de REDE nunca pode virar "zero".
// ═════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ESTE TESTE EXISTE
// `const rows = (await r.json().catch(() => [])) || []` é inofensivo DEPOIS de confirmar que a
// resposta veio bem, e venenoso antes: sem o `if (!r.ok)`, um erro 500 vira `count: 0`, e o dono
// lê zero achando que é a verdade. Não dá erro, não acende alerta, não aparece em teste de fumaça.
//
// Já produziu CINCO diagnósticos falsos num único dia (2026-08-08): acusei o webhook, a agenda e a
// base de estarem quebrados quando o que havia era leitura não autorizada virando lista vazia.
//
// ── O QUE ELE **NÃO** OLHA, E POR QUÊ ────────────────────────────────────────────────────────
// `await request.json().catch(() => ({}))` — o corpo que CHEGA. Ali o vazio é o comportamento
// certo: corpo malformado vira objeto vazio e a validação de campos reprova logo abaixo. Não
// existe `.ok` para conferir, e apontar isso seria ruído.
//
// A primeira versão deste teste (2026-08-10) não fazia essa distinção e acusou 138 casos, ~137
// deles falsos. Teste que grita demais ninguém roda duas vezes — e o único achado real morre
// afogado. Alarme falso queima a confiança no alarme; é a mesma regra do vigia de anúncios.
//
// ── A REGRA QUE ELE COBRA ────────────────────────────────────────────────────────────────────
// Resposta vinda de REDE (`fetch`/`rpc`/`svcRpc`) precisa ter o STATUS CONSULTADO — antes ou
// depois do parse, tanto faz. Falha → estado explícito; sucesso vazio → zero de verdade.
//
// A ordem não importa e exigi-la foi meu segundo erro de calibragem: ler o corpo PRIMEIRO e só
// então decidir com `r.ok && corpo.ok` é um padrão melhor em vários casos, porque permite incluir
// o motivo do erro no relatório. Foi o que fiz de propósito no agent-evolve. Teste que reprova
// código melhor que a regra é teste errado.
//
//   node functions/lib/fallback.test.mjs
import { readdirSync, readFileSync } from "node:fs";

const DIR = new URL("../api/", import.meta.url);
// variável que RECEBE uma resposta de rede: const r = await fetch(...) / await rpc(...) / etc.
// ── ISENÇÕES REVISADAS À MÃO (a sonda erra; o código está certo) ─────────────────────────────
// meta-connect.js:318 — `const dj = await dbg.json().catch(() => null)` PARECE fallback-para-vazio,
// mas o null cai duas linhas abaixo em `if (!info || info.is_valid !== true)` e vira 400 com o
// motivo da Meta. Não existe caminho em que erro de rede vire "zero" ali. Conferido 2026-08-25.
// ⚠️ 2026-08-27: esta chave é ancorada em NÚMERO DE LINHA, e por isso ela se desatualiza sozinha
// toda vez que alguém insere código acima dela — foi o que aconteceu quando o app_subscribe do
// meta-connect.js cresceu e empurrou a linha de 318 para 360. Ver o bloco de AVISO no fim deste
// arquivo: a mesma fragilidade atinge PROTEGIDOS_POR_VALOR, cujas chaves eu conferi e a maioria
// JÁ não aponta para a linha que o comentário descreve.
const ISENTOS = new Map([
  ["meta-connect.js :: const dj = await dbg.json().catch(() => null);",
   "dj nulo → info nulo → `is_valid !== true` recusa o token. Fail-closed, não vira zero."],
]);

const DA_REDE = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+(?:fetch|rpc|svcRpc|svcJson|sapi|graph|el)\s*\(/g;
// `svcJson` entrou na lista acima em 2026-08-11 — e ISSO SOZINHO NÃO PEGAVA NADA. Registro o erro
// porque ele é instrutivo: a checagem de baixo procura `await r.json().catch(() => [])`, um
// fallback-para-vazio DEPOIS da chamada. Mas svcJson já devolve objeto parseado; ninguém chama
// `.json()` nele. Acrescentar o nome do helper foi cosmético, e eu só descobri porque plantei o
// defeito de volta e o teste continuou verde. **Teste que não foi visto falhando não é teste.**
// A CHECAGEM ABAIXO é a que morde de verdade — outra classe de defeito, outro detector.
const DA_SVCJSON = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+svcJson\s*\(/g;
const FALLBACK = /await\s+([A-Za-z_$][\w$]*)\s*\.json\(\)\s*\.catch\(\s*\(\s*\)\s*=>/;
const JANELA = 10;

// ── PROTEGIDOS POR VALOR (auditados 2026-08-10) ──────────────────────────────────────────────
// Existem DUAS formas legítimas de proteção e este teste só enxerga uma. `r.ok` é guarda por
// STATUS; `!Number.isFinite(saldo)` é guarda por VALOR — e às vezes é melhor, porque cobre tanto
// a rede caindo quanto o terceiro devolvendo lixo com HTTP 200.
// Cada linha aqui foi LIDA e o motivo está escrito. Lista curta de propósito: se ela crescer sem
// justificativa, virou tapete para esconder sujeira em vez de registro de decisão.
// 🔁 RE-AUDITADA DO ZERO EM 2026-08-27. As 8 chaves antigas eram `arquivo:número` e as 8 estavam
// podres — nenhuma apontava mais para uma chamada de rede. Rodei o detector com ZERO isenção para
// ver o que ele acusa hoje: são 3 linhas, não 8. Cinco isenções eram peso morto, e uma delas
// (`meta-connect.js:113`) descrevia a MESMA linha que o ISENTOS já cobria — duplicata nascida da
// deriva. Restaram as duas abaixo, cada uma lida e conferida como fail-closed.
const PROTEGIDOS_POR_VALOR = new Map([
  ["provision-number.js :: const bal = Number(((await balR.json().catch(() => ({}))) || {}).balance);",
   "saldo ilegível vira NaN → `!Number.isFinite(bal)` recusa a compra. Ler mal é pior que não ler."],
  ["provision-number.js :: const avail = (((await availR.json().catch(() => ({}))).available_phone_numbers) || []).filter((a) => !isReserved(a.phone_number));",
   "corpo ruim → lista vazia → `if (!avail.length)` devolve blocked:sem_numero_disponivel. Não compra."],
]);

// Quem foi de fato usada nesta rodada. Isenção que não é usada é isenção PODRE: ou o código mudou,
// ou ganhou portão de status e ela virou desnecessária. Nos dois casos o teste reprova lá embaixo,
// e é isso que impede este arquivo de apodrecer de novo em silêncio.
const ISENCOES_USADAS = new Set();

const achados = [];
for (const nome of readdirSync(DIR).filter((f) => f.endsWith(".js"))) {
  const texto = readFileSync(new URL(nome, DIR), "utf8");
  const linhas = texto.split("\n");
  const daRede = new Set([...texto.matchAll(DA_REDE)].map((m) => m[1]));

  linhas.forEach((linha, i) => {
    const m = linha.match(FALLBACK);
    if (!m) return;
    const resp = m[1];
    if (!daRede.has(resp)) return;                 // corpo que chega, ou variável de outra origem
    // ── PRA TRÁS, O ESCOPO É A PRÓPRIA VARIÁVEL (consertado 2026-10-04) ───────────────────────
    // Era janela fixa de 10 linhas para os dois lados, e 10 é um número inventado: em
    // contract.js o `if (!r.ok)` fica 11 linhas acima do parse porque entre os dois existe o
    // tratamento de `contrato_travado` — código CERTO, reprovado por um palmo de distância.
    // A regra escrita neste arquivo é "o status foi consultado", não "foi consultado perto".
    // Então, para trás, a busca vai até onde `resp` NASCEU (a chamada de rede) e para ali: não
    // é janela, é escopo — e por isso não alcança um `r.ok` de outro bloco com o mesmo nome.
    // Para a frente a janela continua, porque ali não existe fronteira natural.
    const nasceu = linhas.findLastIndex((l, k) => k < i &&
      new RegExp(`(?:const|let|var)\\s+${resp}\\s*=\\s*await\\s+(?:fetch|rpc|svcRpc|svcJson|sapi|graph|el)\\s*\\(`).test(l));
    const volta = linhas.slice(nasceu >= 0 ? nasceu : Math.max(0, i - JANELA), Math.min(linhas.length, i + JANELA)).join("\n");
    if (new RegExp(`\\b${resp}\\s*\\.(ok|status)\\b`).test(volta)) return;   // guarda por STATUS
    // ⚓ ÂNCORA POR TEXTO, não por número de linha: uma inserção acima não desloca nada, e a
    // isenção só continua valendo enquanto existir EXATAMENTE o código que foi auditado.
    const chave = `${nome} :: ${linha.trim()}`;
    if (PROTEGIDOS_POR_VALOR.has(chave)) { ISENCOES_USADAS.add(chave); return; }  // guarda por VALOR, auditada
    if (ISENTOS.has(chave)) { ISENCOES_USADAS.add(chave); return; }               // ver bloco ISENTOS
    achados.push({ arquivo: nome, linha: i + 1, resp, trecho: linha.trim().slice(0, 96) });
  });
}

// ── CHECAGEM 2 — o campo que svcJson NUNCA devolve ───────────────────────────────────────────
// svcJson sinaliza falha em `{ok:false, erro_http, detalhe}` (sb.js:38-46). Testar `r.error` numa
// resposta dele é uma guarda que nunca dispara: 401/403/500 do banco passam direto, `r.campanhas`
// vira [] e a tela do dono lê "nenhum gasto de anúncio lançado neste período". Erro de permissão
// apresentado como ausência de resultado — a família que já custou cinco diagnósticos falsos.
const svcErros = [];
for (const nome of readdirSync(DIR).filter((f) => f.endsWith(".js"))) {
  const texto = readFileSync(new URL(nome, DIR), "utf8");
  const linhas = texto.split("\n");
  const deSvc = new Set([...texto.matchAll(DA_SVCJSON)].map((m) => m[1]));
  if (!deSvc.size) continue;
  // 🚨 FALSO POSITIVO CORRIGIDO 2026-08-25: a sonda casava pelo NOME da variável no arquivo
  // inteiro. Em admin-comando.js existe `const d = await svcJson(...)` num lugar e, noutro,
  // `const d = await r.json()` de um fetch à API do STRIPE — onde `d.error.message` é o formato
  // CERTO da resposta do Stripe. A sonda acusava o Stripe de ser svcJson.
  // Regra nova: a linha só conta se o mesmo nome não tiver sido REATRIBUÍDO por outra fonte
  // (fetch/json) antes dela. Escopo por nome é aproximação; sem isso a sonda vira ruído, e
  // sonda que grita errado é sonda que ninguém lê.
  const reatribuido = new Map();   // nome → linhas onde ele passou a vir de OUTRA fonte
  linhas.forEach((linha, i) => {
    const m = linha.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+(?!svcJson)/);
    if (m) { if (!reatribuido.has(m[1])) reatribuido.set(m[1], []); reatribuido.get(m[1]).push(i); }
  });
  const veioDeOutraFonte = (v, i) => (reatribuido.get(v) || []).some((li) => li < i && li > (linhas.findLastIndex((l, k) => k < i && new RegExp(`(?:const|let|var)\\s+${v}\\s*=\\s*await\\s+svcJson`).test(l))));
  linhas.forEach((linha, i) => {
    for (const v of deSvc) {
      if (veioDeOutraFonte(v, i)) continue;
      // `r.error` / `r?.error` — mas não `r.erro_http`, que é o campo certo
      if (new RegExp(`\\b${v}\\s*\\??\\.\\s*error\\b`).test(linha)) {
        svcErros.push({ arquivo: nome, linha: i + 1, v, trecho: linha.trim().slice(0, 96) });
      }
    }
  });
}
if (svcErros.length) {
  console.log(`❌ ${svcErros.length} guarda(s) lendo \`.error\` numa resposta de svcJson — campo que ele NUNCA devolve:`);
  for (const a of svcErros) console.log(`     ${a.arquivo}:${a.linha}  (\`${a.v}\`)\n       ${a.trecho}`);
  console.log("   conserto: `if (!r || r.erro_http || r.ok === false) return …` — svcJson falha em erro_http/ok:false.");
  process.exit(1);
}

if (achados.length) {
  console.log(`❌ ${achados.length} fallback(s) de REDE sem portão de status — erro viraria "zero":`);
  for (const a of achados) console.log(`     ${a.arquivo}:${a.linha}  (resposta \`${a.resp}\`)\n       ${a.trecho}`);
  console.log('   conserto: `if (!<resp>.ok) return json({ ok:true, ready:false, note:"..." })` ANTES do fallback.');
  process.exit(1);
}
// ── ISENÇÃO ÓRFÃ REPROVA ─────────────────────────────────────────────────────────────────────
// Este é o conserto de raiz do apodrecimento. Antes, uma isenção que deixava de casar sumia em
// silêncio: o teste continuava verde, e a lista virava documentação mentindo. Agora, se uma
// isenção não foi usada nesta rodada, ela é órfã e o teste REPROVA — porque só existem dois
// motivos, e os dois exigem alguém olhar: ou o código auditado mudou (re-audite), ou ele ganhou
// portão de status e a isenção virou desnecessária (remova).
const orfas = [...PROTEGIDOS_POR_VALOR.keys(), ...ISENTOS.keys()].filter((k) => !ISENCOES_USADAS.has(k));
if (orfas.length) {
  console.log(`❌ ${orfas.length} isenção(ões) órfã(s) — não foram usadas nesta rodada:`);
  for (const k of orfas) console.log(`     ${k}`);
  console.log("   conserto: leia a linha de HOJE. Se ainda merece isenção, atualize o texto da chave;");
  console.log("             se ganhou `if (!r.ok)`, apague a entrada — ela não é mais necessária.");
  process.exit(1);
}

console.log(`✅ todo fallback de resposta de REDE tem portão de status — erro nunca vira zero (${ISENCOES_USADAS.size} isenção(ões) auditada(s), todas em uso)`);

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ✅ ÂNCORAS CONSERTADAS EM 2026-08-27 (o aviso que estava aqui foi resolvido, não apagado)
// O problema: ISENTOS e PROTEGIDOS_POR_VALOR identificavam a linha auditada por `arquivo:número`.
// Número de linha não identifica linha nenhuma — qualquer inserção acima desloca tudo, em
// silêncio. Medido no dia: das 8 chaves, 8 estavam podres; nenhuma apontava mais para uma chamada
// de rede. As descrições ao lado descreviam código que já não estava ali.
//
// O que mudou:
//   1. Chave passou a ser `arquivo :: texto-exato-da-linha`. Sobrevive a inserção, e a isenção só
//      vale enquanto existir o código que foi auditado.
//   2. A lista foi RE-AUDITADA do zero: rodei o detector sem isenção nenhuma para ver o que ele
//      acusa hoje. Três linhas, não oito. Sobraram duas em PROTEGIDOS + uma em ISENTOS, cada uma
//      lida e confirmada fail-closed. As outras cinco eram peso morto (uma delas duplicava o
//      ISENTOS por deriva de linha).
//   3. Isenção não usada agora REPROVA o teste. Antes ela apodrecia calada; agora ela grita.
//
// A lição, que vale para qualquer lista de exceção: uma exceção precisa EXPIRAR sozinha quando o
// código que a justificava muda. Sem isso, a lista deixa de proteger e passa a mentir — e ninguém
// descobre, porque o sintoma de uma isenção podre é o teste continuar verde.
// ═════════════════════════════════════════════════════════════════════════════════════════════
