// AS IMAGENS DOS SITES QUE A GENTE CRIA.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// O PEDIDO (Luis, 2026-08-25): «uma agente de imagens… nos sites que são criados».
//
// ⚠️ A REGRA QUE MANDA AQUI, e ela é anterior a este arquivo: no motor de sites, a **identidade é
// do cliente** — vídeo, logo e fotos REAIS dele. Gerar uma "foto" do interior de um salão e pôr no
// site é quebrar essa regra da pior maneira: a cliente dele olha, acredita que é aquele lugar,
// chega e é outro. A primeira impressão morre, e quem paga pelo mal-entendido é o cliente, não nós.
//
// Então a linha é simples e não se negocia:
//   ✅ ARTE — fundo, textura, gradiente, padrão, forma abstrata, ícone, moldura, papel de parede.
//      Coisas que ninguém confunde com um registro do lugar.
//   ❌ DOCUMENTO — o espaço dele, a equipe dele, o prato dele, o resultado dele, um cliente feliz.
//      Isso é FOTO, e foto vem da câmera do cliente. Se ele não tem, a resposta é pedir, não fingir.
//
// A trava está no CÓDIGO (`ehDocumental`), não num comentário pedindo bom senso: daqui a três meses
// alguém vai pedir "uma foto do salão pra ficar bonito" e o portão precisa dizer não sozinho.

// Modelo da própria Cloudflare: mesma conta do site, sem fornecedor novo e sem chave nova.
const MODELO = "@cf/black-forest-labs/flux-1-schnell";

// Palavras que denunciam pedido de FOTO de coisa real. Em pt/en/es porque o pedido pode vir em
// qualquer um dos três — e uma trava que só entende inglês é meia trava numa plataforma trilíngue.
const DOCUMENTAL = [
  /\b(foto|photo|photograph|fotografia|retrato|portrait|headshot)\b/i,
  /\b(interior|inside|dentro|fachada|storefront|facade|reception|recep[cç][aã]o|sal[aã]o do|our (shop|store|salon|clinic|restaurant))\b/i,
  /\b(equipe|team|staff|funcion[aá]ri|employee|stylist|barber|dentist|doctor|m[eé]dic|advogad|lawyer|chef)\b/i,
  /\b(cliente feliz|happy client|customer smiling|before and after|antes e depois|antes y despu[eé]s|resultado do|our work|nosso trabalho)\b/i,
  /\b(prato|dish|plate of|our (food|menu)|nosso (prato|card[aá]pio))\b/i,
];

/**
 * O pedido é de FOTO de algo real? Se for, é recusado — a foto vem da câmera do cliente.
 * @returns {{documental:boolean, motivo?:string, termo?:string}}
 */
export function ehDocumental(pedido) {
  const t = String(pedido || "");
  for (const re of DOCUMENTAL) {
    const m = t.match(re);
    if (m) {
      return {
        documental: true, termo: m[0],
        motivo: `"${m[0]}" pede uma imagem que finge ser o negócio de verdade. A identidade do site é do cliente: foto do espaço, da equipe, do trabalho e do produto vem da câmera dele. Peça a foto — não invente uma.`,
      };
    }
  }
  return { documental: false };
}

// O prompt que vai ao modelo. Montado da MARCA (cor, ramo), não do capricho de quem pediu: o
// resultado precisa parecer daquele negócio, e "bonito" sem marca é papel de parede genérico.
export function montarPrompt({ pedido, cor = "", ramo = "", estilo = "" }) {
  const partes = [
    String(pedido || "").slice(0, 300),
    ramo ? `visual language of a ${ramo} business` : "",
    cor ? `dominant colour ${cor}` : "",
    estilo || "clean, modern, uncluttered, generous negative space, suitable as a website background",
    // Diz ao modelo o que NÃO fazer — os modelos põem texto e rosto por conta própria, e ambos
    // arruínam a peça: texto sai com erro de grafia, rosto vira pessoa que não trabalha lá.
    "no text, no lettering, no words, no logos, no watermarks, no human faces, no recognizable people",
  ];
  return partes.filter(Boolean).join(", ");
}

/**
 * Gera a imagem. Devolve os BYTES (PNG) ou um motivo legível — nunca uma imagem em branco
 * passando por sucesso.
 */
export async function gerarImagem(env, { pedido, cor, ramo, estilo, passos = 4 } = {}) {
  if (!env?.AI) return { ok: false, motivo: "o Workers AI não está ligado neste ambiente (binding AI ausente)" };
  const p = String(pedido || "").trim();
  if (!p) return { ok: false, motivo: "descreva o que deve ser gerado" };

  const d = ehDocumental(p);
  if (d.documental) return { ok: false, recusado: true, motivo: d.motivo, termo: d.termo };

  const prompt = montarPrompt({ pedido: p, cor, ramo, estilo });
  try {
    const r = await env.AI.run(MODELO, { prompt, steps: Math.min(Math.max(Number(passos) || 4, 1), 8) });
    // O flux devolve `{ image: "<base64>" }`. Um objeto sem `image` é FALHA, não uma imagem vazia —
    // devolver zero byte como sucesso faria o site publicar um retângulo transparente.
    const b64 = r?.image || (typeof r === "string" ? r : "");
    if (!b64) return { ok: false, motivo: "o modelo respondeu sem imagem", bruto: JSON.stringify(r || {}).slice(0, 200) };
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (bytes.length < 1000) return { ok: false, motivo: `imagem veio com ${bytes.length} bytes — pequena demais para ser real` };
    // ⚠️ O TIPO SE LÊ DOS BYTES, NÃO SE ASSUME. Eu declarei `image/png` e o modelo devolveu JPEG:
    // o navegador perdoa, mas um arquivo salvo ganha a extensão errada e quebra onde ninguém olha
    // (upload, e-mail, biblioteca de mídia). O formato é do modelo e pode mudar quando o modelo
    // mudar — os primeiros bytes são a única fonte que não envelhece.
    const tipo = bytes[0] === 0x89 && bytes[1] === 0x50 ? "image/png"
      : bytes[0] === 0xff && bytes[1] === 0xd8 ? "image/jpeg"
        : bytes[0] === 0x52 && bytes[8] === 0x57 ? "image/webp"
          : "application/octet-stream";
    return { ok: true, bytes, bytesLen: bytes.length, tipo, prompt, modelo: MODELO };
  } catch (e) {
    return { ok: false, motivo: `o gerador falhou: ${(e && e.message) || "erro desconhecido"}` };
  }
}
