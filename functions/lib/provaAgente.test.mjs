// Teste do verificador de agente. Roda com: node functions/lib/provaAgente.test.mjs
//
// QUE DEFEITO REAL ELE IMPEDE DE VOLTAR
// Em 2026-08-16 a linha caiu três vezes em um dia e o dono descobriu DISCANDO — uma delas na linha
// do único cliente pagante. Os quatro defeitos foram estes, e cada um vira um caso aqui:
//   a) call_limits.daily_limit = -1 → a ElevenLabs recusa toda ligação (erro 4300);
//   b) first_message com {{variavel}} não declarada → a chamada morre com 0s e 0 mensagem;
//   c) número sem agente, ou voice_url da Twilio fora da ElevenLabs → "chama e cai";
//   d) prompt vazio/curto, ou sem a lição mais nova → a agente inventa serviço e preço.
//
// E o caso que vale MAIS que os quatro: leitura que falhou NÃO pode virar ✅. O erro-mãe do dia
// foi ler `[]` como "não achei" quando era "não li", e `200` como "mudou" quando era "recebi".
// Se alguém um dia trocar `null` por `true` no caminho de leitura falha, o caso 8 quebra.
//
// Nenhum caso aqui toca rede: os payloads são sintéticos, com o MESMO formato que o provedor
// devolve no GET /v1/convai/agents/:id.
import { analisarAgente, resumirFrota, ancoraLicao, variaveisDe } from "./provaAgente.js";

const ANCORA = ancoraLicao();

// Um agente SAUDÁVEL, com a forma real do provedor. Os casos abaixo estragam um pedaço de cada vez.
const saudavel = () => ({
  cliente: "spa@exemplo.com",
  agente_id: "ag_ok",
  agente: {
    lido: true,
    dados: {
      name: "Lilian",
      conversation_config: {
        tts: { voice_id: "v_abc", model_id: "eleven_flash_v2_5" },
        language_presets: { pt: {}, es: {} },
        conversation: { max_duration_seconds: 300, text_only: false },
        agent: {
          language: "pt-br",
          first_message: "Oi, aqui é a Lilian do Spa {{caller_name}}, em que posso te ajudar?",
          dynamic_variables: { dynamic_variable_placeholders: { caller_name: "", caller_last: "", caller_note: "", caller_phone: "", caller_ola: "" } },
          prompt: {
            prompt: `You are Lilian — concierge do Spa. ${"conhecimento do negócio ".repeat(30)}
              ═══ O QUE APRENDEMOS EM ${ANCORA} ═══ NUNCA OFEREÇA O QUE NÃO ESTÁ ESCRITO.
              Se {{caller_name}} está preenchido trate como cliente conhecido; use {{caller_phone}}.`,
            tools: [{ name: "schedule" }, { name: "do_action" }],
          },
        },
      },
      platform_settings: {
        max_duration_seconds: 300,
        call_limits: { daily_limit: 5000, agent_concurrency_limit: 10 },
        workspace_overrides: { conversation_initiation_client_data_webhook: { url: "https://guileoai.com/api/twilio-inbound" } },
      },
    },
  },
  telefones: { lido: true, lista: [{ phone_number: "+19298288170", assigned_agent: { agent_id: "ag_ok" } }] },
  twilio: { lido: true, numeros: [{ phone_number: "+1 929 828 8170", voice_url: "https://api.us.elevenlabs.io/twilio/inbound_call" }] },
  saldo: { lido: true, usados: 100000, teto: 1000000 },
  banco: { versao: 8 },
});

// Estraga um pedaço do agente saudável sem mexer no resto.
const com = (mut) => { const l = saudavel(); mut(l, l.agente.dados.conversation_config, l.agente.dados.platform_settings); return l; };

const CASOS = [
  {
    nome: "agente saudável → atende, sem problema nenhum",
    leitura: saudavel(),
    espera: (r) => r.atende_agora === true && r.derruba_a_ligacao.length === 0 && r.degrada.length === 0,
  },
  {
    nome: "a) daily_limit = -1 → NÃO atende (erro 4300)",
    leitura: com((l, cc, ps) => { ps.call_limits.daily_limit = -1; }),
    espera: (r) => r.atende_agora === false && r.derruba_a_ligacao.some((p) => p.chave === "teto_diario" && p.lido.valor === -1),
  },
  {
    nome: "a2) daily_limit ausente → é o estado SEGURO, não é defeito",
    leitura: com((l, cc, ps) => { delete ps.call_limits; }),
    espera: (r) => r.atende_agora === true && !r.derruba_a_ligacao.length && !r.nao_deu_pra_provar.some((n) => n.chave === "teto_diario"),
  },
  {
    nome: "a3) concurrency -1 → SUSPEITA, não veredito (sentinela não verificado)",
    leitura: com((l, cc, ps) => { ps.call_limits.agent_concurrency_limit = -1; }),
    espera: (r) => r.atende_agora === true && r.nao_deu_pra_provar.some((n) => n.chave === "concorrencia"),
  },
  {
    nome: "b) saudação com {{caller_ola}} não declarado → NÃO atende (0s, 0 mensagem)",
    leitura: com((l, cc) => {
      cc.agent.first_message = "Oi, aqui é a Lilian {{caller_ola}}, em que posso te ajudar?";
      delete cc.agent.dynamic_variables.dynamic_variable_placeholders.caller_ola;
    }),
    espera: (r) => r.atende_agora === false && r.derruba_a_ligacao.some((p) => p.chave === "primeira_fala" && /caller_ola/.test(p.o_que)),
  },
  {
    nome: "b2) {{system__caller_id}} na saudação NÃO é órfã (o provedor resolve sozinho)",
    leitura: com((l, cc) => { cc.agent.first_message = "Oi! ({{system__caller_id}})"; }),
    espera: (r) => r.atende_agora === true && !r.derruba_a_ligacao.length,
  },
  {
    nome: "c) nenhum número amarrado → SEM LINHA (não é uma linha caída)",
    leitura: com((l) => { l.telefones.lista = []; }),
    // ⚠️ MUDOU DE PROPÓSITO em 2026-08-16. Antes isto era "derruba", e os 2 agentes internos que
    // NUNCA tiveram número ficavam vermelhos todo dia — a frota saía `ok:false` para sempre.
    // Alarme que vive vermelho é alarme que se aprende a ignorar, e aí ele falha justamente no dia
    // em que a linha do pagante cai. Sem número não é linha quebrada: é ausência de linha, e sai
    // da conta. Se o agente ganhar número um dia, volta a ser cobrado como os outros.
    espera: (r) => r.sem_linha === true && r.atende_agora === null && r.derruba_a_ligacao.length === 0,
  },
  {
    nome: "c2) voice_url da Twilio apontando para outro lugar → NÃO atende",
    leitura: com((l) => { l.twilio.numeros[0].voice_url = "https://demo.twilio.com/welcome/voice/"; }),
    espera: (r) => r.atende_agora === false && r.derruba_a_ligacao.some((p) => p.chave === "voice_url" && /demo\.twilio/.test(p.lido.valor)),
  },
  {
    nome: "c3) número fora DESTA conta Twilio → 'não deu para conferir', NUNCA acusação",
    leitura: com((l) => { l.twilio.numeros = []; }),
    espera: (r) => r.atende_agora === true && r.nao_deu_pra_provar.some((n) => n.chave.startsWith("voice_url:")) && !r.derruba_a_ligacao.length,
  },
  {
    nome: "d) prompt vazio → degrada (a ligação acontece; o agente inventa)",
    leitura: com((l, cc) => { cc.agent.prompt.prompt = ""; }),
    espera: (r) => r.atende_agora === true && r.degrada.some((p) => p.chave === "prompt"),
  },
  {
    nome: "d2) prompt sem a lição da versão atual → degrada",
    leitura: com((l, cc) => { cc.agent.prompt.prompt = cc.agent.prompt.prompt.replace(ANCORA, "LIGAÇÕES REAIS (v1)"); }),
    espera: (r) => r.degrada.some((p) => p.chave === "licao_atual"),
  },
  {
    nome: "🔴 leitura falhou → null e NUNCA true (o erro-mãe do dia)",
    leitura: { cliente: "x@y.com", agente_id: "ag_x", agente: { lido: false, erro: "HTTP 401" }, telefones: { lido: false }, twilio: { lido: false }, saldo: { lido: false } },
    espera: (r) => r.atende_agora === null && r.derruba_a_ligacao.length === 0 && r.nao_deu_pra_provar.length >= 4,
  },
  {
    nome: "🔴 lista de números não lida → null, não 'sem número'",
    leitura: com((l) => { l.telefones = { lido: false, erro: "HTTP 500" }; }),
    espera: (r) => r.atende_agora === null && !r.derruba_a_ligacao.some((p) => p.chave === "telefone_vinculado"),
  },
  {
    nome: "defeito PROVADO ganha de leitura incompleta (false, não null)",
    leitura: com((l, cc, ps) => { ps.call_limits.daily_limit = -1; l.telefones = { lido: false, erro: "HTTP 500" }; }),
    espera: (r) => r.atende_agora === false,
  },
  {
    nome: "cota de voz zerada → NÃO atende (vale para a frota toda)",
    leitura: com((l) => { l.saldo = { lido: true, usados: 1000000, teto: 1000000 }; }),
    espera: (r) => r.atende_agora === false && r.derruba_a_ligacao.some((p) => p.chave === "saldo_voz"),
  },
  {
    nome: "text_only → NÃO atende em telefone nenhum",
    leitura: com((l, cc) => { cc.conversation.text_only = true; }),
    espera: (r) => r.atende_agora === false && r.derruba_a_ligacao.some((p) => p.chave === "text_only"),
  },
  {
    nome: "sem ferramentas + sem idiomas + sem webhook de identidade → 3 degradações, ainda atende",
    leitura: com((l, cc, ps) => { cc.agent.prompt.tools = []; cc.language_presets = {}; delete ps.workspace_overrides; }),
    espera: (r) => r.atende_agora === true && r.degrada.length === 3,
  },
  {
    nome: "agente de voz-web (esperaTelefone:false) sem número NÃO é defeito",
    leitura: com((l) => { l.telefones.lista = []; l.twilio.numeros = []; }),
    opcoes: { esperaTelefone: false },
    espera: (r) => r.atende_agora === true,
  },
  {
    nome: "todo problema mostra o que foi LIDO do provedor",
    leitura: com((l, cc, ps) => { ps.call_limits.daily_limit = -1; }),
    espera: (r) => [...r.derruba_a_ligacao, ...r.degrada, ...r.cosmetico].every((p) => p.lido && "campo" in p.lido && "valor" in p.lido && p.provado_por),
  },
];

let ok = 0;
for (const c of CASOS) {
  const r = analisarAgente(c.leitura, c.opcoes || {});
  const passou = !!c.espera(r);
  if (passou) ok++;
  console.log(`${passou ? "✅" : "❌"} ${c.nome}`);
  if (!passou) console.log(`   veredito=${r.veredito}\n   derruba=${JSON.stringify(r.derruba_a_ligacao.map((p) => p.chave))} degrada=${JSON.stringify(r.degrada.map((p) => p.chave))} sem_prova=${JSON.stringify(r.nao_deu_pra_provar.map((n) => n.chave))}`);
}

// ── O RESUMO DA FROTA ────────────────────────────────────────────────────────────────────────
// `ok:true` numa frota onde metade não foi lida seria a mentira mais cara deste arquivo.
const frota = [
  analisarAgente(saudavel()),
  analisarAgente(com((l, cc, ps) => { ps.call_limits.daily_limit = -1; })),
  analisarAgente({ cliente: "z@z.com", agente_id: "ag_z", agente: { lido: false, erro: "HTTP 401" } }),
];
const res = resumirFrota(frota);
const casosResumo = [
  ["resumo conta 1 de pé / 1 caído / 1 não provado", res.atenderiam === 1 && res.nao_atenderiam === 1 && res.nao_deu_pra_provar === 1],
  ["resumo NÃO diz ok com alguém caído ou não lido", res.ok === false],
  ["resumo diz QUEM não atenderia e por quê", res.quem_nao_atenderia.length === 1 && res.quem_nao_atenderia[0].por_que.length > 0],
  ["frota inteira saudável → ok:true", resumirFrota([analisarAgente(saudavel())]).ok === true],
  ["variaveisDe ignora system__ e acha as demais", JSON.stringify(variaveisDe("a {{x}} b {{system__time}} c {{x}}")) === '["x"]'],
];
for (const [nome, passou] of casosResumo) {
  if (passou) ok++;
  console.log(`${passou ? "✅" : "❌"} ${nome}`);
}

const total = CASOS.length + casosResumo.length;
console.log(`\n${ok}/${total} casos corretos`);
if (ok !== total) process.exit(1);
