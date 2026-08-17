// ════════════════════════════════════════════════════════════════════════════════════════════════
// QUEM ASSINA — a identidade JURÍDICA das entidades da Guileo (2026-08-17)
// ════════════════════════════════════════════════════════════════════════════════════════════════
// "Guileo" é MARCA. Quem assina, cobra e responde é a pessoa jurídica — e um contrato assinado por
// uma marca não vincula ninguém, porque a marca não existe no registro. A forma correta no
// cabeçalho é «ORIGEM LTDA, inscrita no CNPJ nº …, nome fantasia Guileo»: a marca aparece para o
// cliente reconhecer quem é, e a razão social é quem assume a obrigação.
//
// DUAS PERNAS, PORQUE A GUILEO VENDE NOS DOIS LADOS (Luis: "assinamos nacional e internacional"):
//   • BR — ORIGEM LTDA assina o que é regido pela lei brasileira (foro de Cuiabá-MT, CAMARB).
//   • US — a Inc. assina o que é regido pela lei americana. Um contrato entre duas partes
//     americanas, sobre serviço prestado nos EUA e cobrado em dólar, que manda resolver em Cuiabá,
//     encarece e atrasa qualquer cobrança — e é o primeiro argumento do advogado do outro lado.
//
// ⚠️ CAMPOS `null` SÃO DELIBERADOS: dado de empresa NÃO SE INVENTA em documento que alguém assina.
// Enquanto for null, o cabeçalho simplesmente não imprime aquela linha — o documento fica
// incompleto de forma VISÍVEL, em vez de completo e errado. `qualificado()` diz se a parte está
// pronta para assinar; quem emite contrato de receita deve checar antes.
export const ENTIDADES = {
  // Cartão CNPJ conferido em 17/08/2026 (comprovante da RFB, emitido 31/03/2026).
  br: {
    id: "br",
    razaoSocial: "ORIGEM LTDA",
    // ⚠️ O NOME FANTASIA REGISTRADO É "ORIGEM", NÃO "GUILEO". No cartão, o "título do
    // estabelecimento" é ORIGEM. Escrever «nome fantasia Guileo» num contrato seria afirmar um
    // registro que não existe — pequeno no papel, ruim no documento que alguém assina. Guileo é
    // MARCA comercial, e a forma correta é dizer isso: «…, que opera sob a marca Guileo».
    fantasia: "ORIGEM",
    marca: "Guileo",
    docTipo: "CNPJ",
    doc: "66.002.480/0001-38",
    endereco: "Rua Dez, nº 120, Dom Bosco, Cuiabá/MT, CEP 78.050-460, Brasil",
    natureza: "Sociedade Empresária Limitada (206-2)",
    porte: "EPP",
    aberturaEm: "2026-03-27",
    // CNAEs que sustentam o objeto do contrato — vale registrar porque contrato cujo objeto cai
    // fora das atividades registradas gera atrito fiscal. Aqui está coberto: software sob
    // encomenda (principal), licenciamento, suporte, tratamento de dados e hospedagem, agência de
    // publicidade, marketing direto, intermediação de negócios e treinamento.
    cnaePrincipal: "62.01-5-01 — Desenvolvimento de programas de computador sob encomenda",
    pais: "Brasil",
    // A sede é em CUIABÁ/MT — ou seja, o foro da Comarca de Cuiabá que já está na cláusula 13 é o
    // foro do domicílio da CONTRATADA. Estava certo por acaso; agora está certo por conferência.
    lei: "Brasil",
    moeda: "BRL",
    idiomas: ["pt"],
  },
  // 🚨 A TRIBECA GLOBAL INC. NÃO EXISTE AINDA (Luis, 17/08/2026: "só tem a ORIGEM, a Tribeca ainda
  // não está aberta"). Ela fica aqui APENAS como plano, com `constituida:false`, e NÃO PODE emitir
  // documento. Isto não é um dado faltando — é pior: nomear como parte uma sociedade que não foi
  // constituída não deixa o contrato incompleto, deixa VAZIO. Não há quem se obrigue, não há quem
  // seja cobrado, e do outro lado sobra a alegação de que a contratada se apresentou como algo que
  // não é. Enquanto `constituida` for false, `entidadePorIdioma` devolve a ORIGEM em TODOS os
  // idiomas — um contrato em inglês assinado pela ORIGEM é perfeitamente válido; um assinado por
  // uma empresa inexistente não é.
  us: {
    id: "us",
    constituida: false,
    razaoSocial: "Tribeca Global Inc.",
    fantasia: null,
    marca: "Guileo",
    docTipo: "EIN",
    doc: null,
    estadoConstituicao: null, // Delaware? New York? — decidirá o foro do contrato internacional
    endereco: null,
    pais: "United States",
    lei: "US",
    moeda: "USD",
    idiomas: [],              // vazio de propósito: não atende idioma nenhum enquanto não existir
  },
};

// A parte está pronta para assinar um contrato de receita?
export function qualificado(e) {
  if (!e) return false;
  if (e.constituida === false) return false; // sociedade não constituída não assina nada
  const base = !!(e.razaoSocial && e.doc && e.endereco);
  return e.id === "us" ? base && !!e.estadoConstituicao : base;
}

// O que falta, em português, para quem for cobrar o dado.
export function pendencias(e) {
  if (!e) return ["entidade inexistente"];
  if (e.constituida === false) return ["a sociedade ainda não foi constituída"];
  const f = [];
  if (!e.doc) f.push(e.docTipo);
  if (!e.endereco) f.push("endereço");
  if (e.id === "us" && !e.estadoConstituicao) f.push("estado de constituição");
  return f;
}

// Escolhe a entidade pelo idioma do documento. Regra simples e honesta: português → ORIGEM (BR);
// inglês/espanhol → a Inc. Pode ser sobrescrito na emissão quando o caso fugir da regra (um cliente
// brasileiro que fatura em dólar, por exemplo).
export const entidadePorIdioma = (lang) => {
  const alvo = lang === "pt" ? ENTIDADES.br : ENTIDADES.us;
  // 🚨 O PORTÃO: entidade não constituída nunca emite documento — cai na ORIGEM, que existe.
  // Sem esta linha, todo contrato em inglês ou espanhol sairia em nome da Tribeca Global Inc., uma
  // sociedade que ainda não foi aberta. Um contrato em inglês assinado pela ORIGEM LTDA é
  // perfeitamente válido; um assinado por empresa inexistente não obriga ninguém — e ainda entrega
  // ao outro lado o argumento de que a contratada se apresentou como algo que não é.
  return alvo && alvo.constituida !== false ? alvo : ENTIDADES.br;
};

// Linha de qualificação para o cabeçalho do contrato, nos 3 idiomas. Só imprime o que existe.
export function qualificacao(e, lang = "pt") {
  if (!e) return "";
  const insc = { pt: "inscrita no", en: "registered under", es: "inscrita en el" }[lang] || "inscrita no";
  const sede = { pt: "com sede em", en: "with offices at", es: "con domicilio en" }[lang] || "com sede em";
  const consti = { pt: "constituída em", en: "incorporated in", es: "constituida en" }[lang] || "constituída em";
  const fant = { pt: "nome fantasia", en: "trading as", es: "nombre comercial" }[lang] || "nome fantasia";
  // ⚠️ FANTASIA ≠ MARCA. O nome fantasia é o que está REGISTRADO (aqui: ORIGEM); a marca é como a
  // empresa se apresenta no mercado (Guileo). Dizer «nome fantasia Guileo» seria afirmar um
  // registro inexistente. As duas entram, cada uma com o nome certo — e é isso que faz o cliente
  // reconhecer quem contratou sem que o documento minta sobre o registro.
  const marc = { pt: "que opera sob a marca", en: "operating under the brand", es: "que opera bajo la marca" }[lang] || "que opera sob a marca";
  const p = [e.razaoSocial];
  if (e.fantasia && e.fantasia !== e.razaoSocial) p.push(`${fant} ${e.fantasia}`);
  if (e.doc) p.push(`${insc} ${e.docTipo} nº ${e.doc}`);
  if (e.estadoConstituicao) p.push(`${consti} ${e.estadoConstituicao}`);
  if (e.endereco) p.push(`${sede} ${e.endereco}`);
  if (e.marca && e.marca !== e.fantasia) p.push(`${marc} ${e.marca}`);
  return p.join(", ");
}
