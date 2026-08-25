// COMO A AGENTE FALA UM NOME — a tabela de pronúncia.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// POR QUE ISTO EXISTE
// O Luis ouviu a ligação e disse: "ele fala GUILEO bem, mas o Gui ele fala guai".
// Está certo, e é inevitável sem isto: o motor de voz lê o texto com as regras do idioma DELE.
// "Gui" em inglês só pode sair /gwaɪ/ — é a leitura correta em inglês de uma grafia portuguesa.
// Não é defeito do modelo; é a gente entregando a grafia errada para a boca errada.
//
// POR QUE UMA TABELA E NÃO UM CONSERTO PONTUAL
// O produto é white-label: cada cliente rebatiza a agente (a "Gui" virou "Lilian" no Natura) e
// vende para dono imigrante — o mercado é justamente quem tem nome que o inglês não lê. Corrigir
// "Gui" na unha resolve UM caso e deixa o próximo João, Núbia ou Jorge saindo errado no primeiro
// dia do cliente, que é quando ele decide se confia no produto.
//
// COMO FUNCIONA: reescrita fonética SÓ NO TEXTO FALADO. Não muda o nome no cadastro, no e-mail,
// no cockpit nem no CRM — só a grafia que vai para o motor de voz. É o truque que a indústria de
// TTS usa há décadas, e funciona em qualquer provedor, sem depender de dicionário proprietário
// (a ElevenLabs tem `pronunciation_dictionary_locators`, mas ele exige subir arquivo PLS por
// workspace e não viaja quando a plataforma de voz for trocada — e ela é trocável por desenho).
//
// ⚠️ REGRA DE OURO: só entra nome que alguém OUVIU sair errado. Adivinhar pronúncia enche a
// tabela de palpite, e palpite erra em cima de nome que já estava certo — que é pior, porque
// ninguém vai procurar defeito no que "já foi corrigido".

// Grafia falada por idioma. A chave é o nome como está escrito no cadastro (minúsculo, sem
// acento); o valor é como ESCREVER para aquele idioma pronunciar certo.
// `null` = neste idioma a grafia original já sai correta, não mexa.
const TABELA = {
  // ← ouvido pelo Luis em 2026-08-16: em inglês saiu "guai" (rima com "why").
  //   "Ghee" é a grafia inglesa que produz /ɡiː/. Em pt/es "Gui" já sai certo.
  gui: { en: "Ghee", pt: null, es: null, fr: "Ghi", it: "Ghi", de: "Ghi" },
  // ← EN: o Luis confirmou de ouvido (2026-08-16 e de novo em 25/08, comparando amostras geradas
  //   com a voz real) que "Guileo" já sai certo em inglês. Fica VERIFICADO para ninguém "consertar"
  //   depois o que está bom.
  //   PT: sai ERRADO. A voz é uma só (Bella) para todos os idiomas — ver [[project_guileo_uma_voz]] —
  //   e ela aplica fonética inglesa a uma grafia que o português leria sozinho. O acento força a
  //   tônica: gui-LÉ-o. Escolhido pelo Luis entre três amostras ("Guileo" / "Guiléo" / "Guilêo"),
  //   ouvindo, porque eu não escuto — e fonética por palpite é como se estraga nome que já saía bem.
  //   ES: "Guileo" sem acento já cai na tônica certa pela regra do espanhol (palavra terminada em
  //   vogal acentua a penúltima sílaba). Registrado como verificado, não como "não olhei".
  guileo: { en: null, pt: "Guiléo", es: null },
  // Nomes portugueses/espanhóis comuns no mercado-alvo cuja leitura inglesa erra feio.
  joao: { en: "Zhoo-ow", pt: null, es: "Yoao" },
  jose: { en: "Ho-zeh", pt: null, es: null },
  jorge: { en: "Hor-hey", pt: null, es: null },
  nubia: { en: "Noo-bee-ah", pt: null, es: null },
  thiago: { en: "Tee-ah-go", pt: null, es: null },
  rafaela: { en: "Ha-fa-eh-la", pt: null, es: null },
  luis: { en: "Loo-ees", pt: null, es: null },
  // "Lilian" o inglês lê bem; registrado para não virar palpite depois.
  lilian: { en: null, pt: null, es: null },
};

const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const chave = (s) => semAcento(s).trim().toLowerCase();

/**
 * A grafia que deve ir para o MOTOR DE VOZ.
 * Nome desconhecido volta inalterado — o silêncio é o padrão seguro: escrever fonética por
 * palpite estraga nome que já saía certo, e esse defeito ninguém procura depois.
 */
export function comoFalar(nome, idioma = "en") {
  const n = String(nome || "").trim();
  if (!n) return "";
  const linha = TABELA[chave(n)];
  if (!linha) return n;
  const lang = String(idioma || "en").slice(0, 2).toLowerCase();
  const alt = linha[lang];
  return alt || n;   // null (verificado como correto) ou idioma ausente → grafia original
}

/**
 * Aplica a tabela a uma FRASE inteira, respeitando limite de palavra e maiúsculas.
 * Usada na saudação e em qualquer texto que a agente vá ler em voz alta.
 */
export function frasefalada(texto, idioma = "en") {
  let out = String(texto || "");
  for (const k of Object.keys(TABELA)) {
    const alvo = comoFalar(k, idioma);
    // ⚠️ COMPARAR SEM ACENTO APAGA O ÚNICO CASO EM QUE O ACENTO É A CORREÇÃO. `chave()` tira acento
    // para ACHAR o nome na tabela — usá-la também para decidir "mudou ou não" fez "Guiléo" parecer
    // idêntico a "Guileo", e a correção de português escolhida pelo Luis foi descartada em silêncio
    // (o bloco de pronúncia em PT saía VAZIO). Achar e comparar são perguntas diferentes.
    if (!alvo || alvo.toLowerCase() === k) continue;      // nada a trocar neste idioma
    // \b não funciona com acento em JS; a borda é feita à mão com classes de não-letra.
    const re = new RegExp(`(^|[^\\p{L}])(${k})([^\\p{L}]|$)`, "giu");
    out = out.replace(re, (_, a, meio, b) => {
      // preserva a caixa: "GUI" → "GHEE", "Gui" → "Ghee", "gui" → "ghee"
      const ajustado = meio === meio.toUpperCase() ? alvo.toUpperCase()
        : meio[0] === meio[0].toUpperCase() ? alvo
        : alvo.toLowerCase();
      return `${a}${ajustado}${b}`;
    });
  }
  return out;
}

/** Só para diagnóstico: quais nomes a tabela conhece. */
export const NOMES_CONHECIDOS = Object.keys(TABELA);

// ── blocoDePronuncia: a tabela chega à CONVERSA INTEIRA, não só à saudação ───────────────────────
// POR QUE (25/08): `frasefalada` só reescrevia o `firstMessage`. Ou seja, a agente cumprimentava
// certo e errava o nome da empresa em todas as outras frases da mesma ligação — o que é quase pior
// que errar sempre, porque soa como se ela tivesse esquecido. Reescrever o prompt inteiro por regex
// não serve: ele contém a grafia oficial em contextos que NÃO são falados (nomes de ferramenta,
// e-mail, chaves). Então o prompt recebe uma INSTRUÇÃO de como dizer, e a grafia oficial fica
// intacta em todo o resto.
// Só entram os nomes que mudam NAQUELE idioma — em inglês são 8 linhas, em português é 1. Prompt
// está sempre perto do teto; instrução que não muda nada é imposto puro.
export function blocoDePronuncia(idiomas = ["en", "pt", "es"], { marcaPropria = false } = {}) {
  // ⚠️ O AGENTE TROCA DE IDIOMA NO MEIO DA LIGAÇÃO (`language_detection`). Um bloco montado só com
  // o idioma da CONFIGURAÇÃO seria inútil na metade das conversas: a agente nasce "en", o cliente
  // fala português, e a regra de português nunca chegou ao prompt. Por isso a instrução nomeia o
  // idioma em cada linha — uma lista só, curta, válida em qualquer momento da conversa.
  const langs = Array.isArray(idiomas) ? idiomas : [idiomas];
  const NOME = { en: "English", pt: "Portuguese", es: "Spanish", fr: "French", it: "Italian", de: "German", hi: "Hindi" };
  const linhas = [];
  for (const nome of Object.keys(TABELA)) {
    // ⚠️ A MARCA NÃO ENTRA NO CÉREBRO DE UM AGENTE WHITE-LABEL. A Lilian atende PELO Natura Spa;
    // ela nunca diz "Guileo", então a regra de como pronunciar seria inútil — e pior que inútil:
    // põe a palavra dentro do prompt dela, o que só aumenta a chance de ela dizer. É a mesma linha
    // que a constituição defende do outro lado (barrar "Guileo" na saída de voz de negócio); tapar
    // a saída e deixar a palavra entrar pela porta da frente seria meio conserto.
    if (nome === "guileo" && !marcaPropria) continue;
    for (const l of langs) {
      const alvo = comoFalar(nome, l);
      if (!alvo || alvo.toLowerCase() === nome) continue;   // mesma armadilha do acento, ver acima
      const rotulo = nome[0].toUpperCase() + nome.slice(1);
      linhas.push(`- when speaking ${NOME[l] || l}, say "${rotulo}" as "${alvo}"`);
    }
  }
  if (!linhas.length) return "";
  return `PRONUNCIATION (this is about SOUND only — never change how these are spelled in writing, in tool calls, or in emails):\n${linhas.join("\n")}`;
}
