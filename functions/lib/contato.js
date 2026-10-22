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
// NÚMERO FALADO → DÍGITOS (2026-09-28). Na ligação do Luis (conv_9201…) a Lilian mandou para a
// agenda "nine two nine five three five zero one nine one" — exatamente como ouviu. A validação
// contou 0 dígitos e recusou duas vezes; a cliente saiu sem horário. O modelo transcreve voz em
// palavras com frequência, então quem converte é o servidor, nos três idiomas da casa.
const PALAVRA_DIGITO = {
  zero: "0", oh: "0", o: "0", one: "1", two: "2", to: "2", too: "2", three: "3", four: "4", for: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9",
  um: "1", uma: "1", dois: "2", duas: "2", tres: "3", "três": "3", quatro: "4", cinco: "5", seis: "6", meia: "6",
  sete: "7", oito: "8", nove: "9",
  cero: "0", uno: "1", dos: "2", cuatro: "4", siete: "7", ocho: "8", nueve: "9",
};
export function numeroFalado(bruto) {
  const s = (bruto || "").toString();
  if (s.includes("@")) return s;
  const toks = s.toLowerCase().split(/[\s,.;:\-–—/]+/).filter(Boolean);
  if (!toks.length) return s;
  let saida = "", convertidos = 0, repetir = 1;
  for (const t of toks) {
    if (t === "double" || t === "duplo") { repetir = 2; continue; }
    if (t === "triple" || t === "triplo") { repetir = 3; continue; }
    if (/^\+?\d+$/.test(t)) { saida += t.replace(/^\+/, saida ? "" : "+"); repetir = 1; continue; }
    const d = PALAVRA_DIGITO[t];
    if (d) { saida += d.repeat(repetir); convertidos++; repetir = 1; continue; }
    if (t === "plus" || t === "mais") { if (!saida) saida = "+"; continue; }
    return s; // palavra que não é número → não é um telefone falado; devolve como veio
  }
  return convertidos ? saida : s;
}

export function avaliarContato(bruto) {
  const s = numeroFalado((bruto || "").toString().trim()).trim();
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

// CONTATO DA LIGAÇÃO (2026-09-28): na 2ª ligação do Luis o agendamento GUI-439D gravou 929-525-0191
// — o ouvido da agente trocou 535 por 525, e o número ditado era VÁLIDO (10 dígitos), então a regra
// "BINA só quando o ditado quebra" não entrou. Numa ligação, o número de onde a pessoa liga veio da
// operadora; o ditado veio de um ouvido. Telefone: vence o BINA. O ditado diferente não some — volta
// em `ditado` para ir às notas (pode ser o celular de outra pessoa, de propósito). E-mail passa intacto.
export function contatoDaLigacao(ditoBruto, binaBruto) {
  const bina = (binaBruto || "").toString().trim();
  const binaOk = bina && !bina.includes("{{") && avaliarContato(bina).ok ? bina : "";
  let dito = numeroFalado((ditoBruto || "").toString().trim()).trim();
  if (/caller_phone|caller_id|\{\{/i.test(dito)) dito = "";
  if (!binaOk || dito.includes("@")) return { contato: dito || binaOk, ditado: "" };
  const d = digitos(dito).replace(/^1(?=\d{10}$)/, "");
  const b = digitos(binaOk).replace(/^1(?=\d{10}$)/, "");
  return { contato: binaOk, ditado: d && d !== b ? dito : "" };
}

// E-MAIL FALADO (2026-09-28): na voz o modelo manda "luis at gmail dot com" ou "l u i s @ gmail . com".
// Mesma lógica do número falado: quem conserta é o servidor. Só devolve se sair um e-mail válido.
export function emailFalado(bruto) {
  let s = (bruto || "").toString().trim().toLowerCase();
  if (!s) return "";
  s = s.replace(/\s+(at|arroba|arroba\s+de)\s+/g, "@").replace(/\s+(dot|ponto|punto)\s+/g, ".")
    .replace(/\s*@\s*/g, "@").replace(/\s*\.\s*/g, ".").replace(/\s+(underscore)\s+/g, "_").replace(/\s+(dash|hífen|hifen)\s+/g, "-").replace(/\s+/g, "");
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/.test(s) ? s : "";
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

// ── PARA ONDE A GUI PODE LIGAR (2026-09-10) ──────────────────────────────────────────────────────
// Entre 03 e 09/09 robôs preencheram os formulários do site com e-mails falsos e números de Israel
// (+972 2…), e o speed-to-lead discou: 717 ligações de madrugada, 522 minutos a US$0,36, US$189 —
// a conta Twilio zerou e foi SUSPENSA, derrubando o telefone de todos os clientes junto. É fraude
// de tarifa internacional (IRSF): o golpista é dono do número caro e recebe parte do que pagamos.
// O limite por IP não segurou porque os IPs giravam; o cooldown por destino não segurou porque cada
// envio trazia um número diferente. A única trava que não dá pra girar é o DESTINO.
// Liga-se só para onde a Guileo vende: EUA/Canadá (+1) e Brasil (+55). Dentro do +1 moram ilhas do
// Caribe com tarifa internacional e os 900 de tarifa premium — os alvos clássicos do mesmo golpe.
const NANP_FORA = new Set(["242", "246", "264", "268", "284", "345", "441", "473", "649", "658", "664",
  "721", "758", "767", "784", "809", "829", "849", "868", "869", "876", "900", "976"]);
// `extraCsv` = env CALL_DDI_EXTRA ("+44,+351"): mercado novo liga no Cloudflare, sem deploy de código.
export function destinoPermitido(e164, extraCsv = "") {
  const s = (e164 || "").toString();
  if (/^\+1\d{10}$/.test(s)) return NANP_FORA.has(s.slice(2, 5)) ? { ok: false, motivo: "nanp_internacional" } : { ok: true };
  if (/^\+55\d{10,11}$/.test(s)) return { ok: true };
  const extra = (extraCsv || "").split(",").map((x) => x.trim()).filter((x) => /^\+[2-9]\d{1,3}$/.test(x)); // 2–4 dígitos: "+9" abriria +972 junto
  if (/^\+\d{8,15}$/.test(s) && extra.some((p) => s.startsWith(p))) return { ok: true };
  return { ok: false, motivo: "pais_fora" };
}

// AS FORMAS DE UM MESMO CONTATO (CR-02, 2026-10-08). O agendamento guarda o contato do jeito que o
// book gravou ("+19175550143"), e a busca (biz_find_appointments) compara texto EXATO. Na simulação
// da ElevenLabs a agente mandou "+1 917 555 0143" — o mesmo número — e o find voltou vazio três
// vezes; a cliente desistiu e foi escalada. Aqui o servidor tenta as formas plausíveis do MESMO
// número (falado → dígitos, com e sem +1), na ordem, sem nunca inventar outro número.
// E-mail volta só em minúsculas. Texto sem dígito nem @ ("the number they are calling from") → [].
export function variantesDoContato(bruto) {
  const s = (bruto || "").toString().trim();
  if (!s) return [];
  if (s.includes("@")) { const e = (emailFalado(s) || s).toLowerCase(); return [...new Set([e, s])]; }
  const falado = numeroFalado(s).trim();
  const d = digitos(falado);
  if (d.length < 7) return [];
  const out = [s, falado, falado.startsWith("+") ? `+${d}` : ""];
  if (d.length === 10) out.push(`+1${d}`, d);
  if (d.length === 11 && d.startsWith("1")) out.push(`+${d}`, d.slice(1), d);
  if (d.length > 11 || (d.length === 11 && !d.startsWith("1"))) out.push(`+${d}`, d);
  return [...new Set(out.filter(Boolean))];
}
