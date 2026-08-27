// ── AS MARCAS SÃO AS OFICIAIS ────────────────────────────────────────────────────────────────
// `react-icons/si` = Simple Icons: o glifo que a PRÓPRIA empresa publica. O Font Awesome desenha
// a versão dele de cada marca (o telefone do WhatsApp com outra curvatura, o play do YouTube com
// outra proporção) — passa por logo à distância e denuncia de perto. Quem usa esses apps todo dia
// reconhece a diferença sem saber nomeá-la, e é aí que o site perde credibilidade.
// Genéricos (voz, SMS, e-mail, estrela) continuam no Font Awesome: não são marca, são função.
import { FaPhone, FaCommentSms, FaEnvelope, FaStar, FaLinkedinIn,
         FaComments, FaBullhorn, FaPenNib, FaChartLine } from "react-icons/fa6";
import { SiWhatsapp, SiInstagram, SiFacebook, SiMessenger, SiTelegram,
         SiYoutube, SiTiktok, SiTwitch, SiX } from "react-icons/si";
import { useLang } from "../i18n.jsx";
import { Reveal } from "../lib/ui.jsx";

// ChannelsStrip — a FAIXA DE ALCANCE. Antes dizia só "a mesma Gui atende em todo canal": metade da
// verdade, e a metade de menor margem. Luis (2026-08-25): «precisa entender que rodamos ADS em todos
// os canais e também temos IA em todos os canais — tipo YouTube? we run ads and automate content».
// Então cada canal passa a declarar as TRÊS capacidades que a Guileo exerce nele:
//   💬 atende (Brain) · 📣 anúncio (AD) · ✍️ conteúdo (AD)
// Um canal com as três é uma frente inteira; um com uma só é honesto sobre o que ele é (voz não
// publica post). Mostrar a diferença vale mais que fingir simetria — a assimetria É a informação.
//
// 🎨 AS CORES DA LEGENDA SÃO SEMÂNTICAS E COMPARTILHADAS COM A SEÇÃO DOS PILARES: laranja #FF8A33 é
// sempre "a Gui agindo", azul #3FB4FF é sempre "anúncio", rosa #FF3D8B é sempre "conteúdo". Cor é
// nome sem palavra — se a mesma capacidade mudasse de cor entre duas seções, viraria outra coisa
// aos olhos de quem rola a página.

// ── O G DO GOOGLE, DE VERDADE ────────────────────────────────────────────────────────────────
// Os outros logos existem no mundo como SÍMBOLO BRANCO SOBRE A COR DA MARCA (o telefone branco no
// verde do WhatsApp, o f branco no azul do Facebook, o play branco no vermelho do YouTube) — para
// esses, o glifo do react-icons sobre o fundo oficial É o logo real. O Google é a exceção: ele é
// multicolorido por definição, e pintá-lo de uma cor só seria justamente o "ícone falso".
// O LOGO DO GOOGLE ADS de verdade: duas barras arredondadas cruzadas (azul e amarela) com o
// círculo verde no pé. NÃO é o "G" colorido — aquele é o Google Busca. Trocar um pelo outro é o
// tipo de erro que quem compra mídia percebe em meio segundo.
function GoogleAdsMark({ size = 20 }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <rect x="18.5" y="3" width="11" height="31" rx="5.5" fill="#FBBC04" transform="rotate(-30 24 21)" />
      <rect x="18.5" y="3" width="11" height="31" rx="5.5" fill="#4285F4" transform="rotate(30 24 21)" />
      <circle cx="12.5" cy="37" r="6.5" fill="#34A853" />
    </svg>
  );
}

// O G de 4 cores do Google — usado no card de Reviews, porque avaliação acontece no perfil do
// Google, e o G é a marca que o dono reconhece na hora.
function GoogleG({ size = 21 }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.193 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  );
}

const A = "atende", P = "anuncio", C = "conteudo", M = "metrica";

// ⛔ SEM EMOJI (Luis, 2026-08-25): «tem que ser o ícone de cada companhia de verdade — lembra do
// 4K realismo, referência nvidia». Emoji é desenho de sistema operacional: muda de forma entre
// Mac, Windows e Android, tem contorno de brinquedo e não aceita a cor da marca. Glifo vetorial
// herda a cor do sinal, escala sem serrilhar e é o que faz a grade parecer software, não adesivo.
const CAP = {
  atende:   { c: "#FF8A33", Ico: FaComments },
  anuncio:  { c: "#3FB4FF", Ico: FaBullhorn },
  conteudo: { c: "#FF3D8B", Ico: FaPenNib },
  // 4ª capacidade (Luis, 2026-08-25): «dos comentários e interações do post vêm métricas de
  // resultado e venda». É o que fecha o argumento — sem ela, "publicamos" é despesa; com ela,
  // cada post e cada comentário viram linha de receita com nome. Âmbar é sempre MÉTRICA na
  // plataforma inteira (a cor que cobra você), a mesma da seção dos pilares.
  metrica:  { c: "#FFC23D", Ico: FaChartLine },
};

const COPY = {
  en: {
    eye: "One brain · every channel",
    h1: "We answer, advertise, publish — ", h2: "and prove the sale.",
    sub: "Every channel your customers actually use — one memory, one team, one invoice.",
    leg: { atende: "Answers 24/7 — calls, DMs & comments", anuncio: "We run the ads", conteudo: "We create the content", metrica: "Turned into sales, measured" },
    pe: "Not every channel does everything — voice doesn't post, YouTube doesn't take calls. But every one of them reports back: which post, which comment, which ad brought the sale.",
  },
  pt: {
    eye: "Um cérebro · todo canal",
    h1: "A gente atende, anuncia, publica — ", h2: "e prova a venda.",
    sub: "Todo canal que seus clientes usam de verdade — uma memória, um time, uma fatura.",
    leg: { atende: "Atende 24/7 — ligação, direct e comentário", anuncio: "A gente roda o anúncio", conteudo: "A gente cria o conteúdo", metrica: "Vira venda, medida" },
    pe: "Nem todo canal faz tudo — voz não publica post, YouTube não atende ligação. Mas todos prestam contas: qual post, qual comentário, qual anúncio trouxe a venda.",
  },
  es: {
    eye: "Un cerebro · cada canal",
    h1: "Atendemos, anunciamos, publicamos — ", h2: "y probamos la venta.",
    sub: "Cada canal que tus clientes de verdad usan — una memoria, un equipo, una factura.",
    leg: { atende: "Atiende 24/7 — llamada, DM y comentario", anuncio: "Nosotros corremos los anuncios", conteudo: "Nosotros creamos el contenido", metrica: "Se vuelve venta, medida" },
    pe: "No todo canal hace todo — la voz no publica, YouTube no atiende llamadas. Pero todos rinden cuentas: qué post, qué comentario, qué anuncio trajo la venta.",
  },
  hi: {
    eye: "एक दिमाग़ · हर चैनल",
    h1: "हम जवाब देते हैं, विज्ञापन चलाते हैं, पोस्ट करते हैं — ", h2: "और बिक्री साबित करते हैं।",
    sub: "हर वो चैनल जो आपके ग्राहक सच में इस्तेमाल करते हैं — एक याददाश्त, एक टीम, एक बिल।",
    leg: { atende: "24/7 जवाब — कॉल, DM और कमेंट", anuncio: "विज्ञापन हम चलाते हैं", conteudo: "कॉन्टेंट हम बनाते हैं", metrica: "बिक्री में बदला, मापा हुआ" },
    pe: "हर चैनल सब कुछ नहीं करता — वॉइस पोस्ट नहीं करती, YouTube कॉल नहीं उठाता। पर हर एक हिसाब देता है: कौन-सी पोस्ट, कौन-सा कमेंट, कौन-सा विज्ञापन बिक्री लाया।",
  },
};

// 🚨 A LISTA É UMA PROMESSA. Cada capacidade marcada aqui é serviço que a Guileo entrega — o AD é
// híbrido (IA todo dia + time humano na arte), então "rodamos anúncio no YouTube" é verdade como
// SERVIÇO mesmo onde ainda não é automático. O que NÃO pode entrar é canal onde não entregamos.
// `bg` = o fundo REAL da marca (sólido ou o gradiente oficial); `fg` = a cor do símbolo em cima.
// Sem isso o Instagram vira um rosa chapado e o TikTok um ciano — nenhum dos dois existe assim.
const CH = [
  { Icon: FaPhone,             c: "#FF8A33", n: "Voice",          caps: [A, M],
    bg: "linear-gradient(180deg,#FF9E4D,#F07514)", fg: "#fff" },
  { Icon: SiWhatsapp,          c: "#25D366", n: "WhatsApp",       caps: [A, P, C, M],
    bg: "linear-gradient(180deg,#4AE07F,#1EBE55)", fg: "#fff" },
  { Icon: SiInstagram,         c: "#E4405F", n: "Instagram",      caps: [A, P, C, M],
    bg: "radial-gradient(120% 120% at 28% 108%, #FEDA75 4%, #FA7E1E 28%, #D62976 58%, #962FBF 80%, #4F5BD5 100%)", fg: "#fff" },
  { Icon: SiFacebook,          c: "#1877F2", n: "Facebook",       caps: [A, P, C, M],
    bg: "linear-gradient(180deg,#2E8CFF,#0B5FD0)", fg: "#fff" },
  { Icon: SiMessenger, c: "#0084FF", n: "Messenger",      caps: [A, P, M],
    bg: "linear-gradient(160deg,#00B2FF,#006AFF 55%,#A033FF)", fg: "#fff" },
  { Icon: SiTelegram,          c: "#2AABEE", n: "Telegram",       caps: [A, C, M],
    bg: "linear-gradient(180deg,#37BBF3,#1E96D4)", fg: "#fff" },
  { Icon: GoogleAdsMark,       c: "#4285F4", n: "Google Ads",     caps: [P, C, M],
    bg: "linear-gradient(180deg,#FFFFFF,#EDEAE3)", fg: null },
  { Icon: GoogleG,             c: "#4285F4", n: "Google Reviews", caps: [A, C, M],
    bg: "linear-gradient(180deg,#FFFFFF,#EDEAE3)", fg: null },
  { Icon: SiYoutube,           c: "#FF0033", n: "YouTube",        caps: [P, C, M],
    bg: "linear-gradient(180deg,#FF3B3B,#DC0016)", fg: "#fff" },
  { Icon: SiTiktok,            c: "#25F4EE", n: "TikTok",         caps: [P, C, M],
    bg: "linear-gradient(180deg,#2A2A2A,#050505)", fg: "#fff" },
  { Icon: SiTwitch,            c: "#9146FF", n: "Twitch",         caps: [P, C, M],
    bg: "linear-gradient(180deg,#A46BFF,#7B2FF7)", fg: "#fff" },
  { Icon: SiX,          c: "#E7E3D8", n: "X",              caps: [P, C, M],
    bg: "linear-gradient(180deg,#2A2A2A,#050505)", fg: "#fff" },
  { Icon: FaLinkedinIn,          c: "#0A66C2", n: "LinkedIn",       caps: [P, C, M],
    bg: "linear-gradient(180deg,#1B7BD8,#07529E)", fg: "#fff" },
  { Icon: FaCommentSms,        c: "#7C9CF6", n: "SMS",            caps: [A, C, M],
    bg: "linear-gradient(180deg,#93AEFF,#5C7FE0)", fg: "#fff" },
  { Icon: FaEnvelope,          c: "#D6C29A", n: "Email",          caps: [A, C, M],
    bg: "linear-gradient(180deg,#E4D5B4,#C2A878)", fg: "#2A2317" },
];

export default function ChannelsStrip() {
  const { lang } = useLang();
  const t = COPY[lang] || COPY.en;
  return (
    <section className="relative px-5 py-16">
      <style>{`
        @keyframes chreveal{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion:reduce){*{animation:none !important}}
      `}</style>

      <Reveal className="mx-auto max-w-3xl text-center">
        <div className="font-mono text-[11.5px] font-bold uppercase tracking-[0.28em] text-g-gold">◆ {t.eye}</div>
        <h2 className="mt-3 font-black leading-[1.05] tracking-tight text-g-word" style={{ fontSize: "clamp(1.5rem,3.2vw,2.3rem)" }}>
          {t.h1}
          <span className="bg-gradient-to-r from-g-green via-g-gold to-g-copper bg-clip-text text-transparent">{t.h2}</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[14.5px] leading-relaxed text-g-ink">{t.sub}</p>
      </Reveal>

      {/* A LEGENDA vem ANTES da grade: sem ela os selos são enfeite. Com ela, cada canal vira uma
          linha de contrato que o leitor sabe ler — e a assimetria entre canais passa a ser lida
          como honestidade, não como buraco. */}
      <Reveal className="mx-auto mt-7 flex max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2.5">
        {Object.keys(CAP).map((k) => (
          <span key={k} className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-g-ink">
            {(() => { const I = CAP[k].Ico; return (
              <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full text-[12px]"
                style={{ color: CAP[k].c, background: "rgba(255,255,255,0.05)",
                         boxShadow: `inset 0 0 0 1px ${CAP[k].c}4d, inset 0 1px 0 rgba(255,255,255,0.12)` }}><I /></span>
            ); })()}
            <span style={{ color: CAP[k].c }}>{t.leg[k]}</span>
          </span>
        ))}
      </Reveal>

      <div className="mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {CH.map(({ Icon, c, n, caps, bg, fg }, i) => (
          <div key={n}
            className="group relative isolate flex flex-col items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-4 backdrop-blur-sm transition-[transform,border-color,background] duration-[260ms] hover:-translate-y-[2px] hover:border-white/20 hover:bg-white/[0.06]"
            style={{
              // ═══ SÓBRIO, NÃO FESTIVO ════════════════════════════════════════════════════════
              // Saiu a sangria de luz colorida atrás do card: 15 manchas de cor diferentes lado a
              // lado davam ar de vitrine de app store, não de painel de instrumento. A referência
              // (nvidia) é o oposto — placa neutra, hairline precisa, e a cor entrando SÓ pelo
              // objeto que a possui: o logo. O vidro aqui é o MESMO `border-white/10 +
              // bg-white/[0.035]` que os cartões do resto da página usam, então a seção deixa de
              // parecer bloco importado e passa a pertencer à página.
              // ⛔ a sombra saiu daqui e virou LEI GLOBAL no index.css — esta receita de 4 camadas
              // é justamente a que foi promovida. Manter cópia local só criaria divergência.
              animation: `chreveal .7s cubic-bezier(.2,.7,.2,1) ${i * 0.05}s both`,
            }}>
            {/* verniz: reflexo diagonal BRANCO, discretíssimo. Vidro real sempre carrega reflexo do
                ambiente — sem ele a placa lê como papel fosco. Branco, nunca colorido. */}
            <span aria-hidden="true" className="pointer-events-none absolute -left-1/3 -top-1/2 h-[160%] w-[80%] -rotate-[24deg]"
              style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.045),transparent)" }} />
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-10 top-0 h-px"
              style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)" }} />

            {/* O LOGO REAL — fundo oficial da marca, a ÚNICA cor do card. Brilho de topo contido
                (0.2, não 0.3): ícone de app 2026 é fosco-acetinado, não plástico envernizado. */}
            <span className="relative z-10 grid h-[46px] w-[46px] place-items-center overflow-hidden rounded-[12px] text-[19px]"
              style={{ background: bg, color: fg || undefined,
                       boxShadow: "inset 0 1px 0 rgba(255,255,255,0.26), inset 0 0 0 1px rgba(0,0,0,0.25), 0 8px 16px -10px rgba(0,0,0,0.95), 0 2px 4px -2px rgba(0,0,0,0.55)" }}>
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                style={{ background: "linear-gradient(180deg,rgba(255,255,255,0.2),transparent)" }} />
              <Icon />
            </span>
            <span className="relative z-10 text-[12.5px] font-bold tracking-tight text-g-word">{n}</span>
            {/* filete: separa IDENTIDADE (logo + nome) de CONTRATO (o que fazemos ali). Dois blocos
                de leitura colados viram um borrão só. */}
            <span aria-hidden="true" className="relative z-10 h-px w-8 bg-white/10" />
            <span className="relative z-10 flex items-center gap-1.5">
              {Object.keys(CAP).map((k) => {
                const tem = caps.includes(k);
                const I = CAP[k].Ico;
                return (
                  <span key={k} title={t.leg[k]} aria-label={`${n} — ${t.leg[k]}${tem ? "" : " ✕"}`}
                    className="grid h-[26px] w-[26px] place-items-center rounded-full text-[11.5px]"
                    style={tem
                      // SELO EM CINZA ÚNICO (Luis, 2026-08-25 — confirmado 2×). A cor pertence aos
                      // LOGOS; os selos falam por contraste: claro = fazemos, escuro = não. A
                      // legenda colorida em cima é que ensina a ler os quatro.
                      ? { color: "rgba(237,231,220,0.92)", background: "rgba(255,255,255,0.085)",
                          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.16), inset 0 1px 0 rgba(255,255,255,0.14)" }
                      : { color: "rgba(237,231,220,0.15)", background: "rgba(0,0,0,0.22)",
                          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.045)" }}>
                    <I />
                  </span>
                );
              })}
            </span>
          </div>
        ))}
      </div>

      {/* o pé que transforma a assimetria em argumento, em vez de deixá-la parecer falha */}
      <Reveal className="mx-auto mt-7 max-w-2xl text-center text-[12.5px] leading-relaxed text-g-muted">{t.pe}</Reveal>
    </section>
  );
}
