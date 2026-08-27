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
const ISENTOS = new Set(["meta-connect.js:360"]);

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
const PROTEGIDOS_POR_VALOR = new Map([
  ["google-oauth-callback.js:59", "sem refresh_token → back('error','no_refresh_token')"],
  ["google-oauth-callback.js:71", "descoberta best-effort; falha só deixa o campo vazio, nunca afirma"],
  ["google-oauth-callback.js:76", "idem — não bloqueia guardar o refresh_token"],
  ["meta-connect.js:113",         "exige info.is_valid === true; resposta ruim → sem .data → recusa"],
  ["provision-number.js:163",     "!Number.isFinite(saldo) recusa a compra — ler mal é pior que não ler"],
  ["provision-number.js:178",     "lista vazia → nenhum número elegível → não compra"],
  ["provision-number.js:215",     "compra confirmada pelo sid no corpo, não pelo status"],
  ["sms-check.js:54",             "devolve ok:r.ok + http:r.status na resposta — reporta o status em vez de escondê-lo"],
]);

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
    // janela dos DOIS lados: o status pode ser consultado antes ou depois do parse
    const volta = linhas.slice(Math.max(0, i - JANELA), Math.min(linhas.length, i + JANELA)).join("\n");
    if (new RegExp(`\\b${resp}\\s*\\.(ok|status)\\b`).test(volta)) return;   // guarda por STATUS
    if (PROTEGIDOS_POR_VALOR.has(`${nome}:${i + 1}`)) return;                    // guarda por VALOR, auditada
    if (ISENTOS.has(`${nome}:${i + 1}`)) return;   // conferido à mão — ver bloco ISENTOS
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
console.log("✅ todo fallback de resposta de REDE tem portão de status — erro nunca vira zero");

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⚠️ AVISO SOBRE AS ÂNCORAS DESTE ARQUIVO (levantado 2026-08-27, NÃO corrigido — decisão do dono)
// ISENTOS e PROTEGIDOS_POR_VALOR identificam a linha auditada por `arquivo:número`. Número de
// linha não identifica linha nenhuma: qualquer inserção acima desloca tudo, em silêncio, e a
// isenção passa a cobrir uma linha que ninguém auditou — ou nenhuma.
// Conferido hoje, lendo o que cada chave aponta HOJE:
//   google-oauth-callback.js:59  → linha vazia
//   google-oauth-callback.js:71  → um comentário
//   meta-connect.js:113          → um comentário
//   sms-check.js:54              → um rateLimited, não o fallback descrito
// Ou seja: as descrições ao lado das chaves descrevem código que já não está ali. O teste segue
// VERDE porque as linhas reais deixaram de casar com o padrão, não porque foram auditadas.
// CONSERTO PROPOSTO: chavear por `arquivo::texto-da-linha` em vez de `arquivo:número`. Sobrevive a
// inserção, e uma isenção só vale enquanto o código exato que foi auditado continuar existindo.
// Não fiz agora porque este arquivo não é do escopo da tarefa que me trouxe aqui.
// ═════════════════════════════════════════════════════════════════════════════════════════════
