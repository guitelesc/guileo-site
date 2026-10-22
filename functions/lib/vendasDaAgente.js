// O QUE A AGENTE PODE VENDER ALÉM DA AGENDA: produto de prateleira, gift card — e PASSAR A LIGAÇÃO.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// Três capacidades que só entram no agente do negócio que as TEM (2026-09-30). Quem não cadastrou
// produto, não ligou gift card e não deu um número para transferir recebe exatamente o mesmo prompt
// e as mesmas ferramentas de antes — nenhuma mudança de frota.
//
// O QUE É HONESTO PROMETER
//   • produto: a agente RESERVA para a cliente buscar e pagar no balcão. Não cobra por telefone.
//   • gift card: com Stripe do negócio conectado, sai um link de pagamento por e-mail; sem ele, a
//     agente anota o pedido e a equipe fecha — e ela DIZ isso, não promete link.
//   • transferência: só para o número que o negócio informou, só quando a pessoa pede gente.
import { paraE164, destinoPermitido } from "./contato.js";
import { formatProdutos } from "./produtos.js";

const limpa = (s, n) => String(s == null ? "" : s).replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, n);

/** O bloco que entra junto dos preços. "" quando o negócio não vende nada disto. */
export function blocoDeVendas({ produtos = [], giftCard = false, lang = "en" } = {}) {
  const partes = [];
  const lista = formatProdutos(produtos, lang);
  if (lista) {
    partes.push(`RETAIL PRODUCTS (sold at the front desk — quote these prices exactly; a product not on this list is not something you can confirm we carry):\n${lista}\n• To set one aside, call do_action with action='product', details='<product name exactly as listed> x<quantity>', plus the customer's name and contact. It RESERVES the item for pickup; payment is at the front desk. Say "I've set it aside for you" only after the tool confirms. If it answers out of stock, say so and offer to let them know when it is back.\n• Never take a card number for a product on the call.`);
  }
  if (giftCard) {
    partes.push(`GIFT CARDS: we sell gift cards in any amount. When someone wants one, get the amount, the buyer's name and EMAIL, and who it is for, then call do_action with action='giftcard', amount='<dollars>', contact='<buyer email>', details='for <recipient>'. Repeat back exactly what the tool answers — it tells you whether a payment link was emailed or the front desk will complete it. Never say a link was sent unless the tool said so.`);
  }
  return partes.join("\n\n");
}

/**
 * Os destinos de transferência válidos, a partir do que o perfil guarda:
 *   perfil.transfer = [{ label:"Astoria front desk", phone:"+17185550142", when:"the caller asks for a person at Astoria" }]   (número fictício: tem que ser uma linha DIRETA, nunca a que encaminha para a agente)
 * Fica de fora: número inválido, país que a casa não disca (destinoPermitido), número repetido e —
 * o que mais importa — QUALQUER número que seja da própria agente (`proprios`). Transferir para a
 * linha que encaminha para a agente é um laço: a ligação volta para ela mesma.
 */
export function destinosDeTransferencia(transfer, { proprios = [], extraDdi = "" } = {}) {
  const meus = new Set((Array.isArray(proprios) ? proprios : [proprios]).map((n) => paraE164(n)).filter(Boolean));
  const vistos = new Set();
  const out = [];
  for (const t of Array.isArray(transfer) ? transfer : []) {
    if (!t || typeof t !== "object") continue;
    const fone = paraE164(t.phone || t.numero || "");
    if (!fone || !destinoPermitido(fone, extraDdi).ok || meus.has(fone) || vistos.has(fone)) continue;
    vistos.add(fone);
    out.push({ phone: fone, label: limpa(t.label || t.rotulo, 60) || "front desk", when: limpa(t.when || t.quando, 200) });
    if (out.length >= 5) break;
  }
  return out;
}

/** A ferramenta de sistema da ElevenLabs, ou null quando não há destino válido. */
export function ferramentaDeTransferencia(transfer, opts = {}) {
  const destinos = destinosDeTransferencia(transfer, opts);
  if (!destinos.length) return null;
  return {
    type: "system",
    name: "transfer_to_number",
    description: "Connect the caller to a person on the team. Use ONLY when the caller explicitly asks to speak with a person, or the matter is one you cannot resolve — never to avoid answering a question you can answer.",
    params: {
      system_tool_type: "transfer_to_number",
      transfers: destinos.map((d) => ({
        transfer_destination: { type: "phone", phone_number: d.phone },
        condition: d.when || `The caller asks to speak with a person (${d.label}).`,
        transfer_type: "conference",
      })),
    },
  };
}

/** A instrução que acompanha a ferramenta no prompt. "" quando não há ferramenta. */
export function instrucaoDeTransferencia(transfer, opts = {}) {
  const destinos = destinosDeTransferencia(transfer, opts);
  if (!destinos.length) return "";
  return `\n\nLIVE TRANSFER — \`transfer_to_number\`: you can connect the caller to a person (${destinos.map((d) => d.label).join(", ")}).\n• Only when the caller asks for a person, or you truly cannot resolve it. Everything you CAN do (prices, booking, rescheduling) you do yourself.\n• Only during the business's opening hours. Outside them, do NOT transfer: take the message with do_action action='escalate' and tell the caller when the team will be back.\n• Before transferring, say one short sentence ("One moment, I'm connecting you with the front desk") and pass the caller's name and reason in the agent message so they do not have to repeat themselves.\n• If the transfer does not go through, come back, apologize once, and take the message with do_action action='escalate'. Never leave the caller with nothing.`;
}
