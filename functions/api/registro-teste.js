// GET /api/registro-teste · header x-guileo-secret: <INGEST_SECRET>
// Manda UMA linha de teste pelo registro (planilha + n8n + ClickUp) e devolve o recibo por destino.
// Existe porque um destino que só se prova quando chega uma ligação real é um destino que se
// descobre quebrado na frente do cliente. Trava: o segredo do ingest comparado à env.
import { json, safeEq } from "../lib/guard.js";
import { registrar } from "../lib/registro.js";

export async function onRequestGet({ request, env }) {
  const s = request.headers.get("x-guileo-secret") || "";
  if (!env.INGEST_SECRET || !safeEq(s, env.INGEST_SECRET)) return json({ error: "unauthorized" }, 401);
  // ?cliente= → tenant da linha (a planilha/fluxo tratam como dele). ?marca= → só a MARCA de outro
  // cliente, com o destinatário ainda do teste: prova o tema da Natura sem escrever pra Natura.
  // ?tipo=agendamento → manda a confirmação que o cliente receberia (o dono recebe a mesma).
  const q = new URL(request.url).searchParams;
  const cli = (q.get("cliente") || "teste@guileoai.com").toLowerCase().slice(0, 120);
  const marca = (q.get("marca") || "").toLowerCase().slice(0, 120);
  const ag = q.get("tipo") === "agendamento";
  const recibo = await registrar(env, ag ? {
    cliente: cli, marca, tipo: "agendamento", nome: "Luis", telefone: "+19295350191", email: "",
    servico: "Deep Tissue Massage 60min · Astoria", quando: "Tue, Sep 29 · 6:00 PM", canal: "teste", ref: `teste:${Date.now()}`,
    confirmacao: { name: "Luis", service: "Deep Tissue Massage 60min", whenLabel: "Tue, Sep 29 · 6:00 PM", location: "Astoria", ref: "GUI-TEST", lang: "en" },
  } : {
    cliente: cli, marca, tipo: "ligacao", nome: "Registry test",
    resumo: "Guileo test row — safe to delete.", canal: "teste", ref: `teste:${Date.now()}`,
    telefone: "+10000000000", duracao_s: 42, agente: "Lilian · Natura Spa + Salon", conversation_id: "conv_teste",
    transcricao: "Agent: Thank you for calling Natura Spa + Salon, this is Lilian. How can I take care of you today?\nCaller: Hi, how much is a facial?\nAgent: A Mini Facial at our Astoria location is $75. Would you like me to save a spot for you?",
  });
  return json({ ok: true, recibo });
}
