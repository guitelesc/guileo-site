// A LEITURA DA LIGAÇÃO PELA PRÓPRIA ELEVENLABS (2026-10-05).
//
// Antes: o webhook mandava a transcrição para a Anthropic classificar humor/intenção/nota. Luis proibiu a
// API da Anthropic (ver functions/api/_middleware.js) — e a conta estava sem saldo desde 03/10, então
// desde então NENHUMA ligação tinha humor, e o e-mail "uma cliente saiu insatisfeita" parou calado.
//
// Agora: cada agente de telefone tem os CAMPOS DE ANÁLISE abaixo (platform_settings.data_collection). A
// ElevenLabs preenche ao fim da ligação, com o próprio modelo de análise (não cobrado à parte), e manda
// em `analysis.data_collection_results` no mesmo webhook. Sem API nossa, sem segundo fornecedor.
//
// CAMPOS_DA_LIGACAO é a FONTE ÚNICA: é o que se cola em cada agente (e nos MOLDES, para agente novo nascer
// com eles). Mudou aqui → reaplicar nos agentes (ROTA-AGENTE na IMPLEMENTACAO.md).
export const CAMPOS_DA_LIGACAO = {
  sentimento: { type: "string", description: "How the CUSTOMER felt at the END of the conversation. Answer with exactly one word: positive, neutral or negative. negative = frustrated, upset, complained, or hung up unhappy." },
  intencao: { type: "string", description: "What the customer wanted, in 2 to 4 words, in the SAME language the customer spoke (e.g. 'agendar massagem', 'price of facial', 'cancelar horário')." },
  nota: { type: "string", description: "One short line (max 15 words) for the business owner: what matters about this conversation, in the language the customer spoke." },
  resumo: { type: "string", description: "A 1-2 sentence summary of the conversation for the business owner, in the language the customer spoke: who called, what they wanted, and how it ended (booked, needs follow-up, etc.)." },
};

const valor = (dc, k) => {
  const v = dc?.[k];
  const s = v && typeof v === "object" ? v.value : v;
  return s == null ? "" : String(s).trim();
};
const SENT = { positive: "positive", positivo: "positive", positiva: "positive", neutral: "neutral", neutro: "neutral", neutra: "neutral", negative: "negative", negativo: "negative", negativa: "negative" };

// analysis → { sentiment, intent, note, resumo } | null (null = o agente não tem os campos, ou vieram vazios).
// RESERVA DO HUMOR: a ElevenLabs também manda `sentiment_analysis.overall_label` (positive|neutral|negative)
// em toda conversa, com ou sem os campos — então nenhuma ligação fica sem humor só porque o agente é antigo.
export function leituraDaLigacao(analysis, extra = null) {
  const dc = analysis?.data_collection_results && typeof analysis.data_collection_results === "object" ? analysis.data_collection_results : {};
  const geral = String(analysis?.sentiment_analysis?.overall_label || extra?.sentiment_analysis?.overall_label || "").toLowerCase();
  const bruto = valor(dc, "sentimento").toLowerCase().replace(/[^a-z]/g, "");
  const sentiment = SENT[bruto] || SENT[geral] || null;
  const intent = valor(dc, "intencao").slice(0, 60) || null;
  const note = valor(dc, "nota").slice(0, 200) || null;
  const resumo = valor(dc, "resumo").slice(0, 600) || null;
  if (!sentiment && !intent && !note && !resumo) return null;
  return { sentiment, intent, note, resumo };
}
