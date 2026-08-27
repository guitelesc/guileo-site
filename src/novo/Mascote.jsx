/* MASCOTE — a arte para o negócio que não tem foto nenhuma
   ═══════════════════════════════════════════════════════════════════════════════════════════════
   Luis (24/08): «as empresas que você não encontrou fotos e arte de identidade, cria uma mascote,
   talvez algo inteligente, pra não ficar plain demais».
   O problema é real: o Astoria não tinha nenhuma foto no site arquivado e o Penn Plaza só tinha
   banco de imagem — que eu me recusei a reusar. O resultado é uma página honesta e um pouco vazia.

   ⚠️ POR QUE MASCOTE E NÃO FOTO: uma ilustração NÃO AFIRMA NADA. Uma foto de estúdio na página de
   um consultório diz "esta é a nossa equipe" e é mentira; um desenho diz "isto é um desenho". A
   regra da casa proíbe substituir foto real por banco de imagem — não proíbe desenhar.
   Por isso o mascote sai do MUNDO do negócio e da COR dele, e nunca ocupa o lugar de uma prova:
   entra onde não havia nada, nunca no lugar de uma foto que existe.

   Cada um é montado em SVG puro, herda a cor da marca do cliente e respeita reduced-motion.
   `variante` escolhe o desenho; `cor` é sempre a do cliente. */
import { useId } from "react";

export default function Mascote({ variante = "gota", cor = "#F5A623", tamanho = 220, titulo = "" }) {
  const id = useId();
  const g = `g${id.replace(/[^a-zA-Z0-9]/g, "")}`;
  const comum = {
    width: tamanho, height: tamanho, viewBox: "0 0 200 200", role: "img",
    "aria-label": titulo || "illustration", style: { display: "block", overflow: "visible" },
  };
  /* O anel de fundo é o mesmo em todas as variantes: dá peso de "selo" e evita o desenho solto
     no meio do branco, que é justamente o "plain" que isto veio resolver. */
  const anel = (
    <>
      <defs>
        <radialGradient id={g} cx="50%" cy="38%" r="62%">
          <stop offset="0%" stopColor={cor} stopOpacity="0.22" />
          <stop offset="100%" stopColor={cor} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="92" fill={`url(#${g})`} />
      <circle cx="100" cy="100" r="78" fill="none" stroke={cor} strokeOpacity="0.28" strokeWidth="1.5" strokeDasharray="3 7" />
    </>
  );
  const traco = { fill: "none", stroke: cor, strokeWidth: 5.5, strokeLinecap: "round", strokeLinejoin: "round" };

  if (variante === "chave") {
    /* ENCANADOR — a chave de grifo. Nada de personagem sorrindo: a ferramenta é o que o cliente
       reconhece na porta, e é o que está na marca deles. */
    return (
      <svg {...comum}>{anel}
        <g {...traco}>
          <path d="M74 58a20 20 0 0 0 4 26l52 52a13 13 0 0 0 18-18L96 66a20 20 0 0 0-22-8Z" />
          <path d="M62 72l16-16M118 128l18 18" />
          <circle cx="70" cy="66" r="7" />
        </g>
        <circle cx="140" cy="140" r="6" fill={cor} />
      </svg>
    );
  }
  if (variante === "dente") {
    /* DENTISTA — o dente, com o relógio pequeno: a promessa deles é "não marcamos em excesso",
       e o tempo é o que o paciente de estação está pesando. */
    return (
      <svg {...comum}>{anel}
        <g {...traco}>
          <path d="M100 52c22-17 55-8 55 27 0 28-12 42-17 68-3 17-18 19-22 3l-6-27c-2-8-12-8-14 0l-6 27c-4 16-19 14-22-3-5-26-17-40-17-68 0-35 33-44 55-27Z" />
        </g>
        <g stroke={cor} strokeWidth="4" fill="none" strokeLinecap="round">
          <circle cx="140" cy="146" r="17" />
          <path d="M140 137v10l7 4" />
        </g>
      </svg>
    );
  }
  if (variante === "fiada") {
    /* OBRA — a fiada de tijolos, que é literalmente o que a marca do SR desenha. */
    return (
      <svg {...comum}>{anel}
        <g stroke={cor} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M52 148h96M52 124h96M52 100h96M52 76h96" />
          <path d="M84 148v-24M116 124v-24M84 100V76M116 76V60" />
          <path d="M100 44l40 16H60l40-16Z" />
        </g>
      </svg>
    );
  }
  /* GOTA — o padrão: água, o mundo de encanador e de reforma. */
  return (
    <svg {...comum}>{anel}
      <g {...traco}>
        <path d="M100 46c26 30 41 50 41 70a41 41 0 0 1-82 0c0-20 15-40 41-70Z" />
        <path d="M118 122a18 18 0 0 1-18 15" />
      </g>
    </svg>
  );
}
