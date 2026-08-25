// O CONTATO PRECISA PODER SER CHAMADO DE VOLTA.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ISTO EXISTE (2026-08-16, com número de comprovante)
// O primeiro agendamento real da plataforma — `GUI-42F0` — foi gravado assim:
//     customer_name: "Louise"        (a pessoa é o Luis)
//     customer_contact: "929-535-191" (NOVE dígitos; o número é 929-535-0191)
// A agente pegou os dois de ouvido e perdeu um dígito. O agendamento existe, o horário está
// reservado, e o spa NÃO CONSEGUE ligar de volta. Um telefone com um dígito a menos é pior que
// telefone nenhum: com nenhum, alguém percebe e vai atrás; com um quase-certo, a recepção disca,
// dá "número inexistente", e conclui que o cliente passou trote.
//
// A CAUSA RAIZ é outra e está sendo tratada em separado (a agente não recebe quem está ligando, e
// por isso pergunta o que o CRM já sabe). Esta guarda é o cinto: mesmo quando a identidade voltar,
// alguém vai ditar um número errado um dia, e isso não pode virar linha no banco em silêncio.
//
// O QUE ELA NÃO FAZ: recusar a reserva. Perder a venda por causa de um dígito seria trocar um
// problema por outro pior. Ela devolve "confirma o número pra mim?" — uma frase, na mesma ligação,
// com a pessoa ainda na linha. É o único momento em que o conserto é grátis.
//
// ⚠️ CUIDADO COM INTERNACIONAL: a plataforma atende PT/ES/EN/HI e o Luis vende para imigrantes.
// Uma regra "tem que ter 10 dígitos" quebraria todo número brasileiro (+55 11 9xxxx-xxxx = 13).
// Por isso o critério é: número COM prefixo internacional (+) é aceito numa faixa larga; número
// SEM prefixo é assumido como norte-americano, onde 10 (ou 11 começando com 1) é a única forma
// válida. Na dúvida a resposta é "confirma", nunca "recusa".

const digitos = (s) => (s || "").toString().replace(/\D/g, "");

/**
 * Avalia o contato que a agente capturou.
 * Devolve { ok, tipo, motivo } — `ok:false` significa PERGUNTE DE NOVO, nunca "descarte".
 */
export function avaliarContato(bruto) {
  const s = (bruto || "").toString().trim();
  if (!s) return { ok: false, tipo: "vazio", motivo: "nada foi capturado" };

  // E-MAIL: forma mínima. Ditar e-mail em voz alta erra muito ("L-U-I-S T-E-L-E-S c@gmail.com"
  // saiu literalmente assim numa transcrição real), mas aqui só dá para checar a forma.
  if (s.includes("@")) {
    const bom = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(s);
    return bom ? { ok: true, tipo: "email" } : { ok: false, tipo: "email", motivo: "forma de e-mail inválida" };
  }

  const d = digitos(s);
  const internacional = s.trim().startsWith("+");

  if (internacional) {
    // ⚠️ `+1` NÃO É "internacional", é os Estados Unidos — e lá a regra é exata.
    // O teste pegou isto: "+1 929 535 019" (o número do GUI-42F0 com o zero perdido, agora com
    // prefixo) tem 10 dígitos contando o 1, entrava na faixa larga e passava. A faixa larga existe
    // para países cujo formato eu não conheço; para o país que eu conheço, usar a faixa larga é
    // desligar a verificação justamente onde ela funciona.
    if (d.startsWith("1")) {
      if (d.length === 11) return { ok: true, tipo: "telefone_us" };
      return { ok: false, tipo: "telefone", motivo: `${d.length} dígitos com +1 — um número americano tem 11 com o código do país` };
    }
    // E.164 vai de 8 a 15 dígitos. Faixa larga de propósito: é melhor aceitar um número
    // estrangeiro estranho do que recusar um cliente legítimo por regra local.
    if (d.length >= 8 && d.length <= 15) return { ok: true, tipo: "telefone_internacional" };
    return { ok: false, tipo: "telefone", motivo: `${d.length} dígitos — fora da faixa internacional (8 a 15)` };
  }

  // SEM `+` → assumimos norte-americano, que é o mercado de todos os clientes de hoje.
  if (d.length === 10) return { ok: true, tipo: "telefone_us" };
  if (d.length === 11 && d.startsWith("1")) return { ok: true, tipo: "telefone_us" };
  // ESTE é o caso do GUI-42F0: 9 dígitos. Um a menos, e a linha não existe.
  return { ok: false, tipo: "telefone", motivo: `${d.length} dígitos — um telefone americano tem 10` };
}

// A frase que a agente fala. Curta de propósito: no meio de um agendamento, um parágrafo de
// explicação faz a pessoa desistir; "só confirma o número" ela responde em dois segundos.
export function pedirContatoMsg(lang, tipo) {
  const L = ["pt", "es", "hi"].includes((lang || "").slice(0, 2)) ? (lang || "").slice(0, 2) : "en";
  const email = tipo === "email";
  if (L === "pt") return email ? "Acho que não peguei seu e-mail direito — me repete devagar?" : "Só pra eu não errar: me confirma seu telefone com o DDD?";
  if (L === "es") return email ? "Creo que no capté bien su correo — ¿me lo repite despacio?" : "Para no equivocarme: ¿me confirma su teléfono con el código de área?";
  if (L === "hi") return email ? "आपका ईमेल ठीक से समझ नहीं आया — धीरे से दोहराएँ?" : "गलती न हो इसलिए: अपना फ़ोन नंबर एरिया कोड सहित बताएँ?";
  return email ? "I don't think I caught your email right — can you repeat it slowly?" : "Just so I get it right — can you confirm your phone number with the area code?";
}

// ── paraE164: o que a Twilio precisa receber ─────────────────────────────────────────────────────
// POR QUE ISTO EXISTE (2026-08-25, com linha de comprovante)
// O Luis pediu a ligação pelo herói do site e nada tocou. No banco:
//     gui_actions · 00:32:42 · lead · contato "9295350191" · fonte "heroi"
// O lead entrou; a ligação não. O número saiu do campo do jeito que foi digitado — DEZ dígitos, sem
// código de país. O portão de discagem (`/api/call`) tem uma regex que só CONTA dígitos, então ele
// aprovou; a Twilio recusou, porque ela não aceita nada que não seja E.164 (`+19295350191`).
// Duas lições no mesmo defeito:
//   1. validar FORMA não é validar DISCABILIDADE — "parece telefone" e "é chamável" são perguntas
//      diferentes, e só a segunda vale dinheiro;
//   2. o conserto mora no PORTÃO, não no formulário. Existem várias portas que discam (herói, barra
//      flutuante, formulário longo, speed-to-lead do servidor); consertar a que quebrou hoje deixa
//      as outras quebrando amanhã.
// A política é a MESMA do avaliarContato acima — sem `+` é norte-americano — de propósito: duas
// regras diferentes para o mesmo número é como o dígito se perde.
export function paraE164(bruto) {
  const s = (bruto || "").toString().trim();
  if (!s) return null;
  const d = s.replace(/\D/g, "");
  if (!d) return null;
  // Já veio com prefixo internacional: confia no que a pessoa escreveu, só limpa a formatação.
  if (s.startsWith("+")) return d.length >= 8 && d.length <= 15 ? `+${d}` : null;
  // Sem prefixo → EUA/Canadá, onde 10 dígitos (ou 11 começando com 1) é a única forma válida.
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  // Qualquer outra coisa sem `+` é um palpite, e palpite aqui vira ligação para a pessoa errada.
  return null;
}
