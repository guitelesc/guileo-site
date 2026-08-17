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
  // ← o Luis confirmou que GUILEO já sai bem em inglês. Fica registrado como VERIFICADO para
  //   ninguém "consertar" no futuro o que já está certo.
  guileo: { en: null, pt: null, es: null },
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
    if (!alvo || chave(alvo) === k) continue;             // nada a trocar neste idioma
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
