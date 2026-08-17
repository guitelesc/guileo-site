import { PRODUCTS } from "./productSystem.js";

// leadClassifier — "qual serviço este lead precisa, e o que eu falo?" (Luis, 2026-08-12)
//
// O PEDIDO: «os leads de NYC pra tudo — website, AI, qualquer tipo de serviço que o agente vende.
// E aí você classificar, colocar no motor do lead o que e qual serviço o lead precisa, e já dá o
// pitch com o que falar.»
//
// A MATÉRIA-PRIMA JÁ EXISTIA E NINGUÉM ESTAVA USANDO: cada lead em leadBoss.js carrega um campo
// `obs` com um DIAGNÓSTICO escrito à mão do que está quebrado naquele negócio — "toda pergunta
// fora do horário fica parada no formulário até alguém abrir", "agendamento é só pelo Fresha mas
// tudo é empurrado pra WeChat", "Gmail como e-mail do negócio". Isso não é observação: é a DOR,
// já pesquisada. Faltava o elo dor → serviço → frase.
//
// ⚠️ O SERVIÇO SAI DE `productSystem.js`, NUNCA de uma lista escrita aqui. Um vendedor com uma
// lista própria oferece o que não existe — foi exatamente o que a landing fez com "Gestão de
// mídia" e "SEO" até hoje de manhã. Se o produto sair da fonte, ele some do pitch no mesmo dia.
//
// COMO CLASSIFICA: por SINAIS no texto do diagnóstico, não por adivinhação de nicho. Duas clínicas
// podem ter problemas opostos; o que decide é o que está escrito sobre AQUELA. Nicho entra só como
// desempate, e cada acerto vem com a EVIDÊNCIA (o trecho que disparou) — para o vendedor poder
// dizer "vi no site de vocês que…" em vez de chutar.

// sinal → produto (id em productSystem.js). Ordem importa: o primeiro que casar vira o principal.
const SINAIS = [
  { pid: "answering", re: /fora do horário|after-hours|after hours|não atend|ninguém atende|voicemail|caixa postal|liga.*n[ãa]o.*respond|missed call|perde liga/i,
    dor: { pt: "ligação fora do horário morre", en: "after-hours calls die" } },
  { pid: "websites", re: /sem site|no website|site antigo|only.*instagram|só instagram|apenas.*facebook|linktree|no site public/i,
    dor: { pt: "não tem site próprio", en: "no real website" } },
  { pid: "speedlead", re: /formul[áa]rio|contact form|fica parada|sits in|demora.*respond|slow to reply|lead.*espera/i,
    dor: { pt: "lead preenche formulário e espera", en: "leads fill a form and wait" } },
  { pid: "crm_email", re: /gmail|hotmail|yahoo|e-mail pessoal|personal email|nada centralizado|nothing centralized|planilha|spreadsheet/i,
    dor: { pt: "cliente vive em e-mail pessoal e planilha", en: "customers live in a personal inbox" } },
  { pid: "noshow", re: /falta|no-show|noshow|cancelamento|cancel.*last minute|esquece/i,
    dor: { pt: "falta e cancelamento em cima da hora", en: "no-shows and last-minute cancels" } },
  { pid: "multilingual", re: /wechat|espanhol|spanish|chin[êe]s|chinese|russo|russian|creole|crioulo|biling|imigra/i,
    dor: { pt: "cliente fala outra língua", en: "customers speak another language" } },
  { pid: "social_manage", re: /instagram|facebook|social|posta|posts?\b/i,
    dor: { pt: "rede social parada", en: "social account gone quiet" } },
  { pid: "reputation", re: /avalia|review|google.*estrela|star|reputa/i,
    dor: { pt: "avaliação sem resposta", en: "reviews left unanswered" } },
  { pid: "seo_aeo", re: /não aparece|hard to find|difícil de achar|sem google|not on google|maps/i,
    dor: { pt: "não é achado no Google", en: "not found on Google" } },
];

// Desempate por nicho — SÓ quando o diagnóstico não deu nenhum sinal. É palpite assumido, e vem
// marcado como tal (`porNicho: true`) para o vendedor saber que não tem evidência no texto.
const POR_NICHO = {
  medical: "answering", clinic: "noshow", salon: "noshow",
  restaurant: "answering", homeservices: "speedlead", realestate: "speedlead",
};

const prod = (id) => PRODUCTS.find((p) => p.id === id) || null;

// ── O PITCH ─────────────────────────────────────────────────────────────────────────────────────
// Estrutura fixa em 4 passos, porque vendedor bom improvisa DENTRO de uma estrutura, não no vazio:
//   1. ABRE com o que você VIU (prova que pesquisou — o que separa de telemarketing)
//   2. NOMEIA a perda em dinheiro, não o recurso
//   3. OFERECE o resultado do produto REAL (texto vindo de productSystem)
//   4. FECHA pedindo a menor coisa possível: ouvir a agente por 30 segundos
const FRASE = {
  pt: {
    abre: (nome, dor) => `Oi, é do ${nome}? Eu dei uma olhada no site de vocês antes de ligar — reparei que ${dor}.`,
    perda: "Isso normalmente custa mais que a mensalidade de qualquer ferramenta: é cliente que ligou e foi pro concorrente.",
    fecha: "Posso te mostrar em 30 segundos? Eu ponho a nossa recepcionista de IA na linha e você conversa com ela — se não achar melhor que o seu atendimento de hoje, eu desligo e não incomodo mais.",
  },
  en: {
    abre: (nome, dor) => `Hi, is this ${nome}? I looked at your site before calling — I noticed ${dor}.`,
    perda: "That usually costs more than any tool's monthly fee: it's a customer who called and went to a competitor.",
    fecha: "Can I show you in 30 seconds? I'll put our AI receptionist on the line and you talk to her — if it isn't better than what answers your phone today, I hang up and never bother you again.",
  },
};

/**
 * Classifica UM lead e devolve o serviço + o pitch pronto.
 * Nunca inventa produto: tudo vem de productSystem.js.
 */
export function classificarLead(lead, lang = "pt") {
  const texto = `${(lead.obs && (lead.obs[lang] || lead.obs.pt || lead.obs.en)) || ""} ${lead.name || ""} ${lead.site || ""}`;
  const achados = [];
  for (const s of SINAIS) {
    const m = texto.match(s.re);
    if (m && !achados.find((a) => a.pid === s.pid)) {
      achados.push({ pid: s.pid, dor: s.dor[lang] || s.dor.pt, evidencia: m[0] });
    }
  }

  let porNicho = false;
  if (!achados.length) {
    const fb = POR_NICHO[lead.niche];
    if (fb) { achados.push({ pid: fb, dor: null, evidencia: null }); porNicho = true; }
  }
  if (!achados.length) return null; // sem sinal e sem nicho conhecido → não chuta

  const principal = prod(achados[0].pid);
  if (!principal) return null; // o produto saiu da fonte → o pitch some junto, como tem que ser

  const f = FRASE[lang] || FRASE.pt;
  const dor = achados[0].dor || (lang === "pt"
    ? `negócios de ${lead.niche} perdem ligação quando todo mundo está atendendo`
    : `${lead.niche} businesses miss calls when everyone is with a customer`);
  const resultado = (principal.result && (principal.result[lang] || principal.result.en)) || "";

  return {
    servico_principal: { id: principal.id, nome: principal.name[lang] || principal.name.en, pilar: principal.pilar },
    tambem_serve: achados.slice(1, 4).map((a) => {
      const p = prod(a.pid);
      return p ? { id: p.id, nome: p.name[lang] || p.name.en, dor: a.dor } : null;
    }).filter(Boolean),
    // `porNicho` é a marca de honestidade: sem ele, um palpite de nicho pareceria evidência do site.
    porNicho,
    evidencia: achados[0].evidencia,
    pitch: [f.abre(lead.name, dor), f.perda, resultado, f.fecha].filter(Boolean),
  };
}

/** Classifica uma lista inteira, já filtrada por cidade. */
export function classificarCidade(leads, cidade, lang = "pt") {
  return (leads || [])
    .filter((l) => !cidade || (l.city || "").toLowerCase().includes(cidade.toLowerCase()))
    .map((l) => ({ lead: l, plano: classificarLead(l, lang) }))
    .filter((x) => x.plano);
}
