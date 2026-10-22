/* I18N DE TODO O COCKPIT: nenhuma tela em inglês pra cliente PT/ES, nenhuma tela em português
   pra cliente EN/ES. tr("English text") devolve a própria chave quando a tradução falta — a
   tela funciona, ninguém vê erro, e o cliente lê o idioma errado. Falha silenciosa por definição.

   Este teste varre TODO tr(...) literal em src/portal/*.jsx e src/pages/Portal.jsx e exige:
   (a) toda chave existe em dict-pt.js e dict-es.js;
   (b) nenhuma chave nova contém caractere acentuado (chave devia ser o texto em INGLÊS — uma
       chave acentuada é a inversão clássica: alguém escreveu tr("texto em PT") e a tela em PT
       "funcionou" por coincidência, mas EN/ES leram português).

   O ALLOWLIST abaixo é dívida técnica CONHECIDA e visível — chaves em PT que já existiam em
   telas de outros agentes (Customers.jsx, MyCompanyOS.jsx, QuoteEngine.jsx) no momento desta
   varredura. Elas têm entrada em dict-es (então (a) passa), mas ainda são chaves em PT (então
   (b) só não falha porque estão na lista). Remova da lista assim que o dono do arquivo trocar
   a chave para inglês — não adicione uma chave nova aqui sem entender por que ela existe.

   Rodar: node --test functions/lib/portal-i18n.test.mjs */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

// ── ALLOWLIST — chaves em português vindas de arquivos que este agente NÃO edita.
// Ver PADRAO-VITRINE.md/CLAUDE.md: 7 agentes paralelos, cada um dono de um conjunto de telas.
// (Customers.jsx, MyCompanyOS.jsx, QuoteEngine.jsx não estão na lista de arquivos deste agente.)
const ALLOWLIST_CHAVES_PT = new Set([
  // src/portal/Customers.jsx
  "Ligou mas nunca foi atendido — o próximo passo é marcar. Gui pode ligar e agendar.",
  "Sumido há mais de 60 dias — vale um convite pessoal de volta. Gui pode mandar agora.",
  // src/portal/MyCompanyOS.jsx
  "Finanças",
  "Operações",
  "Inteligência",
  "ações da Gui (30d)",
  "Os 8 departamentos do seu negócio, num lugar só, ao vivo.",
  "A Gui opera cada departamento pra você — aqui você vê o pulso de todos de uma vez.",
  "A inteligência está aquecendo — liga assim que seus clientes e agendamentos entram.",
  // src/portal/QuoteEngine.jsx
  "Não consegui falar com o motor de orçamento agora.",
  "Conecte sua conta para aprovar orçamentos reais.",
  "Não consegui registrar a decisão.",
  "Orçamento recusado — nada foi enviado ao cliente.",
  "Aprovado — mas o e-mail não saiu:",
  "sem canal disponível",
  "Não consegui salvar.",
  "Informe um valor válido.",
  "Orçamentos",
  "A IA orça; acima do teto, você decide",
  "Orçamento abaixo do teto sai sozinho na sua marca. Acima do teto entra nesta fila e só sai depois do seu 1 clique.",
  "Regra de aprovação",
  "Enviar sozinho até",
  "Envio automático ligado",
  "Hoje o orçamento sai por e-mail (SMS e WhatsApp entram quando as operadoras/Meta aprovarem).",
  "Esperando sua aprovação",
  "Nada esperando — os orçamentos abaixo do teto já saíram sozinhos.",
  "Sem itens detalhados — só o total.",
  "sem preço",
]);

// ── CHAVES POR VARIÁVEL — tr() só enxerga literais; estas passam por variável em
// src/pages/Portal.jsx (função erroDeLogin) e SettingsView.jsx, então o grep abaixo nunca as
// encontra sozinho. Listadas aqui à mão para que, se sumirem do dicionário, o teste falhe do
// mesmo jeito. Não editar Portal.jsx nem SettingsView.jsx — esses arquivos não são deste agente.
const CHAVES_POR_VARIAVEL = [
  "Ticket number",
  "We sent a confirmation email with this number.",
  "Your ticket is recorded, but the confirmation email didn't go out — keep this number.",
  "Hi Guileo team! I need help with my account",
  "Saved in your panel — not on your live AI yet.",
  "Wrong email or password. Check both and try again.",
  "Confirm your email first — open the link we sent when you signed up.",
  "This email already has an account — sign in instead.",
  "Password too short — use at least 6 characters.",
  "Choose a password different from the old one.",
  "Too many attempts — wait a minute and try again.",
  "That email doesn't look right — check it and try again.",
  "New accounts are closed right now — talk to our team.",
  "This link expired or was already used. Ask for a new one.",
  "No connection — check your internet and try again.",
  "We couldn't complete that. Try again in a moment.",
  "The two passwords don't match.",
];

function extrairChaves(src) {
  const chaves = new Set();
  const re = /\btr\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g;
  for (const m of src.matchAll(re)) chaves.add(m[2].replace(/\\"/g, '"').replace(/\\'/g, "'"));
  return chaves;
}

function todasAsChaves() {
  const dirPortal = path.join(root, "src/portal");
  const arquivos = fs.readdirSync(dirPortal).filter((f) => f.endsWith(".jsx")).map((f) => path.join(dirPortal, f));
  arquivos.push(path.join(root, "src/pages/Portal.jsx"));
  const chaves = new Set();
  for (const f of arquivos) {
    const src = fs.readFileSync(f, "utf8");
    for (const k of extrairChaves(src)) chaves.add(k);
  }
  for (const k of CHAVES_POR_VARIAVEL) chaves.add(k);
  return chaves;
}

test("todo tr() do cockpit tem tradução em dict-pt e dict-es", async () => {
  const chaves = [...todasAsChaves()];
  const pt = (await import("../../src/portal/dict-pt.js")).default;
  const es = (await import("../../src/portal/dict-es.js")).default;
  const faltandoPt = chaves.filter((k) => !(k in pt));
  const faltandoEs = chaves.filter((k) => !(k in es));
  assert.deepEqual(faltandoPt, [], `${faltandoPt.length} chave(s) sem tradução em dict-pt.js:\n` + faltandoPt.slice(0, 20).join("\n"));
  assert.deepEqual(faltandoEs, [], `${faltandoEs.length} chave(s) sem tradução em dict-es.js:\n` + faltandoEs.slice(0, 20).join("\n"));
});

test("nenhuma chave tr() nova está em português (chave devia ser o texto em inglês)", async () => {
  const chaves = [...todasAsChaves()];
  const acentuadas = chaves.filter((k) => /[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/.test(k));
  const novas = acentuadas.filter((k) => !ALLOWLIST_CHAVES_PT.has(k));
  assert.deepEqual(novas, [],
    `${novas.length} chave(s) nova(s) em português (fora do allowlist) — troque a chave para inglês no ` +
    `arquivo dono e adicione a tradução PT/ES:\n` + novas.join("\n"));
});
