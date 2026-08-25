// O QUE PODE ENTRAR NO CÉREBRO DE UM AGENTE DE CLIENTE.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ISTO EXISTE (2026-08-25)
// Os 13 playbooks de vertical são especificação INTERNA: falam de "Gui", da Guileo, de `call.js`,
// de Stripe e Twilio, e trazem as notas de implementação (`↳ needs:`). Nos MOLDES isso está certo.
// Num agente white-label — a Lilian atendendo pelo Natura Spa — a mesma frase vira vazamento de
// identidade e de arquitetura na boca da cliente final, que é exatamente o que a constituição
// existe para impedir. Na mesma noite tiramos a palavra "Guileo" de dentro da regra que mandava
// escondê-la ([[feedback_nao_diga_o_que_proibe]]); seria absurdo tapar a saída e abrir a porta do
// KB logo em seguida.
//
// POR QUE UM VERIFICADOR E NÃO "eu revisei"
// Eu reescrevi este primeiro documento com cuidado. Os outros doze serão reescritos depois, talvez
// por outra pessoa, talvez às pressas. Revisão é memória; portão é garantia. Se um documento com
// uma dessas palavras chegar, ele é RECUSADO — não avisado, recusado. Um KB vaza uma vez e a
// confiança do cliente não volta.
//
// ⚠️ NÃO É UMA LISTA DE PALAVRAS FEIAS: cada termo aqui é o nome de algo NOSSO ou de um fornecedor
// nosso. Palavra de negócio (WhatsApp como canal, "depósito", "agenda") passa — o documento precisa
// falar do negócio do cliente com naturalidade.

// Nome da plataforma, da agente, dos fornecedores e do código. Fronteira de palavra para não
// reprovar por acaso ("guide" contém "gui"; "gratuito" contém "gratu").
const PROIBIDOS = [
  { re: /\bguileo\b/i, porque: "nome da plataforma" },
  { re: /\bgui\b/i, porque: "nome da nossa agente — o agente do cliente tem o nome DELE" },
  { re: /\b(twilio|elevenlabs|eleven labs|supabase|cloudflare|resend|anthropic|claude|openai|vapi)\b/i, porque: "fornecedor nosso" },
  { re: /\bstripe\b/i, porque: "nosso processador — o cliente não precisa saber qual é" },
  { re: /\b(call\.js|lead\.js|biz_[a-z_]+|gui_actions|client_[a-z_]+)\b/i, porque: "nome de arquivo ou tabela nossa" },
  { re: /\/api\//i, porque: "rota interna" },
  { re: /\b(webhook|cron|RPC|endpoint|tenant|multi-tenant|Supabase|dial gate|DNC)\b/i, porque: "termo de arquitetura" },
  { re: /↳\s*\*?needs?:/i, porque: "nota de implementação do playbook interno" },
  { re: /\b(cockpit|portal do cliente|painel do dono)\b/i, porque: "superfície nossa, não do negócio" },
];

/**
 * Um documento pode entrar no KB de um agente de CLIENTE?
 * @returns {{ok:boolean, achados:Array<{termo:string,porque:string,trecho:string}>}}
 * `ok:false` sempre vem com o TRECHO — dizer "reprovado" sem mostrar onde obriga a pessoa a
 * caçar no escuro, e ela acaba apagando o parágrafo inteiro por segurança.
 */
export function verificarSeguroParaCliente(texto) {
  const t = String(texto || "");
  const achados = [];
  for (const p of PROIBIDOS) {
    const re = new RegExp(p.re.source, p.re.flags.includes("g") ? p.re.flags : p.re.flags + "g");
    let m;
    while ((m = re.exec(t)) !== null) {
      const a = Math.max(0, m.index - 60);
      achados.push({ termo: m[0], porque: p.porque, trecho: `…${t.slice(a, m.index + m[0].length + 60).replace(/\s+/g, " ")}…` });
      if (achados.length >= 12) return { ok: false, achados };  // 12 já provam o ponto
      break;  // uma ocorrência por regra basta para reprovar; a pessoa conserta e roda de novo
    }
  }
  return { ok: achados.length === 0, achados };
}
