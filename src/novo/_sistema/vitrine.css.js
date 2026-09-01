/* ══════════════════════════════════════════════════════════════════════════════════════════════
   O SISTEMA DA VITRINE — uma fonte, muitos clientes.
   ══════════════════════════════════════════════════════════════════════════════════════════════
   POR QUE ISTO EXISTE (Luis, 28/08: «você tem uma estrutura da Guileo, fez cada coisa comigo
   aqui — revise tudo, chega de gastar token»). Eu vinha clonando HairArtDesigns.jsx a cada
   prospect novo. Resultado medido antes de escrever esta linha:

     12.861 linhas nas vitrines · ~1.800 delas CSS REPETIDO
     o grão em 12 arquivos · o verniz em 9 · a varredura do botão em 11
     o IntersectionObserver em 15 · prefers-reduced-motion em 21

   Mudar o padrão custava 15 edições e divergia em 15 lugares. Pior: cada clone herdava o OSSO
   do salão, e foi assim que a clínica do Dr. Kletsman nasceu com cardápio de serviços e
   "artistas" — estrutura errada para a vertical, que é o defeito que o Luis apontou.

   A LINHA DE CORTE (medida, não escolhida): das 307 linhas do <style> aprovado do NY Medical,
   269 são ESTRUTURA (idênticas em qualquer cliente) e 38 carregam COR. Então:
     • estrutura  → vive AQUI, uma vez
     • cor        → tokens que cada vitrine passa, medidos no pixel do logo DELE
   A identidade continua sendo 100% do cliente. O que se compartilha é o craft, nunca a marca.

   FONTE: extraído do que o Luis JÁ APROVOU — ThreeDegrees.jsx (o selo, «esse estilo tava
   perfeito») e o passe de elegância do NYMedical.jsx (a família do ouro, as ondas de cena, o
   movimento ambiente). Nada aqui é padrão novo inventado.

   COMO USAR
     import { sistemaCss, TOKENS_EXEMPLO } from "./_sistema/vitrine.css.js";
     <style>{sistemaCss({ marca:"#0E4F4F", marcaClara:"#1A7A7A", marcaEscura:"#052E2E",
                          acento:"#C89660", acentoLuz:"#D9B27C", acentoClaro:"#E8D5B0",
                          acentoSombra:"#8A5E2E", papel:"#F5F7F6", papel2:"#E9EEEC",
                          tinta:"#10201E", prefixo:"nm" })}</style>
   O `prefixo` mantém as classes com nome de componente (nm-, ha-, td-…) — nunca por ESTADO,
   senão duas coisas diferentes colidem no mesmo nome (já aconteceu: `np-show` era a moldura do
   slideshow E o estado "visível" da barra fixa; a barra herdou aspect-ratio de foto e comeu o
   rodapé). Prefixo por componente é a defesa.

   ⚠️ CRASE: este arquivo devolve template literal. NUNCA escreva uma palavra entre crases nos
   comentários DAQUI PRA BAIXO — a crase fecha a string e a build quebra 300 linhas adiante com
   "Expected } but found Identifier". Já quebrou 5 vezes. A trava é src/novo/crase.test.mjs.
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

/** Tokens de exemplo — cada vitrine passa os DELA, medidos no pixel do logo do cliente. */
export const TOKENS_EXEMPLO = {
  marca: "#0E4F4F",        // a cor do negócio, medida no logo
  marcaClara: "#1A7A7A",   // a mesma marca, mais clara — cor de RESPIRO na página clara
  marcaEscura: "#052E2E",  // fundo dos painéis escuros
  acento: "#C89660",       // o acento, no corpo
  acentoLuz: "#D9B27C",    // o acento legível sobre escuro (texto, kicker, número)
  acentoClaro: "#E8D5B0",  // o realce da liga
  acentoSombra: "#8A5E2E", // a sombra da liga
  papel: "#F5F7F6",
  papel2: "#E9EEEC",
  tinta: "#10201E",
  prefixo: "v",
};

/**
 * Devolve o CSS do sistema já vestido com a marca do cliente.
 * @param {object} t tokens (ver TOKENS_EXEMPLO). Faltou um? cai no exemplo — nunca quebra.
 */
export function sistemaCss(t = {}) {
  const k = { ...TOKENS_EXEMPLO, ...t };
  const p = k.prefixo;

  return `
    @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500;0,6..96,700;1,6..96,400;1,6..96,500&family=Jost:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

    .${p}-raiz{
      --marca:${k.marca}; --marca-clara:${k.marcaClara}; --marca-escura:${k.marcaEscura};
      --acento:${k.acento}; --acento-luz:${k.acentoLuz};
      --acento-claro:${k.acentoClaro}; --acento-sombra:${k.acentoSombra};
      --papel:${k.papel}; --papel2:${k.papel2}; --branco:#FFFFFF;
      --tinta:${k.tinta}; --tinta2:#5A625F; --tinta3:#949C97; --linha:#D3DED9;

      /* A LIGA. Acento chapado lê como bijuteria; a elegância mora na GRADAÇÃO —
         claro no realce, corpo no meio, sombra no fim. Mesma marca, com liga.
         Só em: itálico do masthead, filetes, fio de hover, placa ativa. NUNCA em texto de corpo. */
      --liga:linear-gradient(140deg,var(--acento-claro) 0%,var(--acento) 45%,var(--acento-sombra) 100%);

      background:var(--papel); color:var(--tinta); min-height:100vh;
      font-family:'Jost',system-ui,-apple-system,sans-serif;
      position:relative; overflow-x:hidden;
    }

    /* ── MATERIAL 4K ─────────────────────────────────────────────────────────────────────────
       Grão fino na raiz. z-index nos filhos: sem isso o grão pinta POR CIMA do conteúdo. */
    .${p}-raiz::before{
      content:""; position:fixed; inset:0; pointer-events:none; z-index:0; opacity:.32;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.42'/%3E%3C/svg%3E");
    }
    .${p}-raiz > *{position:relative; z-index:1;}

    /* ── TIPOGRAFIA ─────────────────────────────────────────────────────────────────────────── */
    .${p}-vogue{font-family:'Bodoni Moda',Didot,'Playfair Display',Georgia,serif;}
    .${p}-mono{font-family:'IBM Plex Mono',ui-monospace,monospace;}
    .${p}-kicker{font-family:'IBM Plex Mono',monospace; font-size:10.5px; letter-spacing:.26em;
      text-transform:uppercase; color:var(--marca-clara);}
    .${p}-num{font-family:'Bodoni Moda',Didot,serif; font-size:12.5px; letter-spacing:.12em;
      color:var(--acento-sombra);}
    /* o número da seção na LIGA — o realce que o Luis pediu */
    .${p}-num-liga{font-family:'Bodoni Moda',Didot,serif; font-size:12.5px; letter-spacing:.12em;
      background:var(--liga); -webkit-background-clip:text; background-clip:text; color:transparent;}
    @supports not ((-webkit-background-clip:text) or (background-clip:text)){
      .${p}-num-liga{color:var(--acento-sombra);}
    }
    .${p}-liga{background:var(--liga); -webkit-background-clip:text; background-clip:text; color:transparent;}
    @supports not ((-webkit-background-clip:text) or (background-clip:text)){
      .${p}-liga{color:var(--acento-luz);}
    }

    /* filete de cabelo — a régua da revista. Desenha da esquerda no reveal. */
    .${p}-filete{height:1px; border:0; background:var(--linha); transform-origin:left;}
    .${p}-filete-liga{height:1.5px; border:0; background:var(--liga); transform-origin:left;}
    .${p}-anima .${p}-filete-liga{transform:scaleX(0); transition:transform 1.1s cubic-bezier(.2,.7,.2,1);}
    .${p}-filete-liga.is-in{transform:scaleX(1);}

    /* ── A ABERTURA (cortina que sobe uma vez) ───────────────────────────────────────────────
       FAIL-OPEN: quem monta a usa com estado inicial "já abriu". Só o efeito, com JS vivo,
       a fecha — e um SEGUNDO timer independente a remove aconteça o que acontecer. Cortina
       presa na frente é a página inteira perdida. */
    .${p}-cortina{position:fixed; inset:0; z-index:60; background:var(--papel);
      display:grid; place-items:center;
      transition:transform 1.05s cubic-bezier(.72,0,.18,1), opacity 1.05s ease;}
    .${p}-cortina.sobe{transform:translateY(-100%); opacity:0;}
    .${p}-cortina img{width:min(58vw,300px); animation:${p}-respira 1.4s ease both;}
    @keyframes ${p}-respira{0%{opacity:0; transform:scale(.93)}100%{opacity:1; transform:none}}

    /* ── O SELO (aprovado por Luis: «esse estilo tava perfeito») ─────────────────────────────
       Massa lapidada + borda na cor DELE + laca que varre no hover + glow externo + canto 10px.
       NUNCA cápsula: cápsula dourada chapada foi reprovada como "pílula de remédio". */
    .${p}-selo{
      position:relative; display:inline-flex; align-items:center; gap:9px; overflow:hidden;
      min-height:52px; padding:0 24px; border-radius:10px;
      font-weight:600; font-size:15px; letter-spacing:.01em; text-decoration:none;
      color:var(--tinta); background:var(--branco);
      background-image:linear-gradient(180deg,rgba(255,255,255,.94),rgba(237,234,227,.94));
      border:1.5px solid var(--marca-clara);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(0,0,0,.10),
                 0 1px 2px rgba(0,0,0,.14), 0 14px 26px -18px rgba(0,0,0,.5);
      transition:border-color .25s, box-shadow .25s, transform .12s;
    }
    .${p}-selo::after{content:""; position:absolute; inset:0; pointer-events:none;
      background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.5) 48%,transparent 66%);
      transform:translateX(-120%); transition:transform .75s ease;}
    .${p}-selo:hover::after{transform:translateX(120%);}
    .${p}-selo:hover{border-color:var(--marca);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.95), 0 2px 4px rgba(0,0,0,.16),
                 0 20px 34px -18px rgba(0,0,0,.5), 0 0 0 4px color-mix(in srgb, var(--acento-luz) 22%, transparent);}
    .${p}-selo:active{transform:scale(.985);}
    .${p}-selo[disabled],.${p}-selo.off{opacity:.55; filter:saturate(.5); pointer-events:none;}

    /* AÇÃO — a espécie que faz dinheiro (telefone, agendar). Uma por viewport. */
    .${p}-selo-forte{border-color:var(--acento-sombra);
      background-image:linear-gradient(180deg,#FFF,color-mix(in srgb, var(--acento-claro) 55%, #FFF));}
    .${p}-selo-forte::after{background:linear-gradient(115deg,transparent 30%,color-mix(in srgb, var(--acento-claro) 70%, transparent) 48%,transparent 66%);}
    .${p}-selo-forte:hover{border-color:var(--acento-sombra);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.95), 0 2px 4px rgba(0,0,0,.16),
                 0 20px 34px -18px color-mix(in srgb, var(--acento-sombra) 50%, transparent),
                 0 0 0 4px color-mix(in srgb, var(--acento) 26%, transparent);}

    /* SOBRE FOTO/VÍDEO — vidro escuro, borda branca. O fundo é imprevisível: só o blur salva. */
    .${p}-selo-claro{color:#fff; background:rgba(20,22,22,.3); background-image:none;
      border-color:rgba(255,255,255,.62); backdrop-filter:blur(6px);
      box-shadow:0 1px 2px rgba(0,0,0,.3), 0 18px 34px -20px rgba(0,0,0,.7);}
    .${p}-selo-claro:hover{border-color:#fff;}

    /* ── CARTÃO: material, nunca retângulo chapado ─────────────────────────────────────────── */
    .${p}-card{position:relative; border-radius:20px; background:var(--branco); border:1px solid var(--linha);
      box-shadow:inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(0,0,0,.06),
                 0 1px 2px rgba(0,0,0,.06), 0 26px 48px -34px rgba(0,0,0,.42); overflow:hidden;}
    /* VERNIZ diagonal. 🚨 A cor NUNCA entra na superfície do vidro — tingir vira plástico néon. */
    .${p}-card::after{content:""; position:absolute; inset:0; pointer-events:none; border-radius:inherit;
      background:linear-gradient(115deg,rgba(255,255,255,.5) 0%,rgba(255,255,255,0) 42%,rgba(255,255,255,.14) 100%);}
    .${p}-card > *{position:relative; z-index:2;}

    /* painel escuro na cor da marca */
    .${p}-card-esc{position:relative; border-radius:20px; overflow:hidden;
      background:linear-gradient(160deg,color-mix(in srgb, var(--marca-escura) 92%, #000),var(--marca-escura));
      border:1px solid color-mix(in srgb, var(--acento) 26%, transparent);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.10), 0 30px 60px -40px rgba(0,0,0,.8);}

    /* hover de luxo: levanta, sombra de contato, e o fio da liga VARRE no topo */
    .${p}-card-hov{transition:transform .3s cubic-bezier(.2,.7,.2,1), box-shadow .3s, border-color .3s;}
    .${p}-card-hov::before{content:""; position:absolute; left:0; right:0; top:0; height:1.5px; z-index:3;
      background:var(--liga); transform:translateX(-101%); transition:transform .55s cubic-bezier(.2,.7,.2,1);}
    .${p}-card-hov:hover::before{transform:translateX(0);}
    .${p}-card-hov:hover{transform:translateY(-3px); border-color:color-mix(in srgb, var(--marca-clara) 55%, transparent);
      box-shadow:inset 0 1px 0 rgba(255,255,255,1), 0 2px 4px rgba(0,0,0,.08), 0 34px 60px -34px rgba(0,0,0,.5);}

    /* ── HERO EM FILME ──────────────────────────────────────────────────────────────────────
       O poster é o fail-open: se o vídeo não carrega, a primeira tela continua sendo a DELE. */
    .${p}-filme{position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block;}
    .${p}-veu{position:absolute; inset:0; pointer-events:none;
      background:linear-gradient(180deg,rgba(8,12,12,.46) 0%,rgba(8,12,12,.20) 26%,rgba(8,12,12,.52) 62%,rgba(8,12,12,.88) 100%);}
    /* vinheta de lente — foto real tem queda de luz nas quinas */
    .${p}-vinheta{position:absolute; inset:0; pointer-events:none;
      background:radial-gradient(120% 92% at 50% 42%,transparent 58%,rgba(8,12,12,.44) 100%);}

    /* ── MOVIMENTO ──────────────────────────────────────────────────────────────────────────
       REVEAL FAIL-OPEN: o esconder só existe sob .anima, que só entra com JS vivo. Esconder
       incondicionalmente já deixou uma página EM BRANCO em aba oculta, onde o IO não dispara. */
    .${p}-anima .${p}-rev{opacity:0; transform:translateY(16px);
      transition:opacity .7s ease, transform .7s cubic-bezier(.2,.7,.2,1);}
    .${p}-anima .${p}-rev.is-in{opacity:1; transform:none;}
    /* stagger entre irmãos — até 6; além disso vira fila lenta */
    .${p}-anima .${p}-esc > *:nth-child(1).is-in{transition-delay:0ms}
    .${p}-anima .${p}-esc > *:nth-child(2).is-in{transition-delay:80ms}
    .${p}-anima .${p}-esc > *:nth-child(3).is-in{transition-delay:160ms}
    .${p}-anima .${p}-esc > *:nth-child(4).is-in{transition-delay:240ms}
    .${p}-anima .${p}-esc > *:nth-child(5).is-in{transition-delay:320ms}
    .${p}-anima .${p}-esc > *:nth-child(6).is-in{transition-delay:400ms}

    /* entrada orquestrada do hero, encadeada na subida da cortina */
    .${p}-ent{opacity:0; transform:translateY(14px);}
    .${p}-abriu .${p}-ent{opacity:1; transform:none;
      transition:opacity .8s ease, transform .8s cubic-bezier(.2,.7,.2,1);}
    .${p}-abriu .${p}-ent-1{transition-delay:.05s} .${p}-abriu .${p}-ent-2{transition-delay:.17s}
    .${p}-abriu .${p}-ent-3{transition-delay:.29s} .${p}-abriu .${p}-ent-4{transition-delay:.41s}
    .${p}-abriu .${p}-ent-5{transition-delay:.53s} .${p}-abriu .${p}-ent-6{transition-delay:.65s}
    .${p}-abriu .${p}-ent-7{transition-delay:.77s}

    /* selo vivo que pulsa — UM por página, e ele INFORMA (relógio + estado) */
    .${p}-pulso{position:relative; display:inline-flex; width:7px; height:7px; border-radius:999px;}
    .${p}-pulso::after{content:""; position:absolute; inset:0; border-radius:inherit; background:inherit;
      animation:${p}-ping 2.4s cubic-bezier(0,0,.2,1) infinite;}
    @keyframes ${p}-ping{0%{transform:scale(1);opacity:.7}80%,100%{transform:scale(2.6);opacity:0}}

    /* troca de cena no painel: crossfade curto, nunca teleporte */
    @keyframes ${p}-troca{from{opacity:0; transform:translateY(6px)}to{opacity:1; transform:none}}
    .${p}-troca{animation:${p}-troca .15s ease both;}

    /* ── FITA DE FOTOS — o formato de revista ──────────────────────────────────────────────── */
    .${p}-fita{display:flex; gap:14px; overflow-x:auto; scroll-snap-type:x mandatory;
      padding-bottom:12px; -webkit-overflow-scrolling:touch;}
    .${p}-fita > figure{flex:0 0 auto; width:min(76vw,400px); scroll-snap-align:start; margin:0;}
    .${p}-foto{position:relative; border-radius:16px; overflow:hidden;
      box-shadow:0 22px 44px -30px rgba(0,0,0,.6);}
    .${p}-foto img{width:100%; aspect-ratio:4/5; object-fit:cover; display:block;}
    /* vinheta na foto: 4% nas quinas, porque foto real tem queda de luz */
    .${p}-foto::after{content:""; position:absolute; inset:0; pointer-events:none;
      background:radial-gradient(120% 100% at 50% 45%,transparent 62%,rgba(0,0,0,.16) 100%);}
    /* push-in lento e contínuo — vida, não barulho. Alterna direção por irmão. */
    .${p}-foto img{animation:${p}-pushin 17s ease-in-out infinite alternate;}
    .${p}-fita > figure:nth-child(even) .${p}-foto img{animation-duration:20s; animation-direction:alternate-reverse;}
    @keyframes ${p}-pushin{from{transform:scale(1)}to{transform:scale(1.06)}}

    /* ── CHIPS, CAMPOS, LINKS ───────────────────────────────────────────────────────────────
       A marca como cor de RESPIRO na página clara — senão vira documento preto-e-branco. */
    .${p}-chip{display:inline-flex; align-items:center; min-height:30px; padding:0 11px;
      border-radius:999px; font-family:'IBM Plex Mono',monospace; font-size:11.5px;
      color:var(--marca); background:color-mix(in srgb, var(--marca-clara) 12%, transparent);
      border:1px solid color-mix(in srgb, var(--marca-clara) 28%, transparent);}
    .${p}-pilula{min-height:44px; padding:0 16px; border-radius:999px; border:1px solid var(--linha);
      background:var(--branco); color:var(--tinta2); font-size:13.5px; font-weight:500;
      transition:border-color .2s,color .2s,background .2s;}
    .${p}-pilula:hover{border-color:var(--marca-clara); color:var(--tinta);}
    .${p}-pilula[data-on="1"]{border-color:var(--marca); color:var(--tinta);
      background:color-mix(in srgb, var(--marca-clara) 18%, transparent);}
    .${p}-campo{width:100%; min-height:52px; padding:0 16px; border-radius:12px;
      border:1px solid var(--linha); background:var(--branco); color:var(--tinta); font-size:15px;}
    .${p}-campo::placeholder{color:var(--tinta3);}
    .${p}-campo:focus{outline:none; border-color:var(--marca);
      box-shadow:0 0 0 3px color-mix(in srgb, var(--marca-clara) 30%, transparent);}
    .${p}-link{color:var(--marca); text-decoration:underline;
      text-decoration-color:color-mix(in srgb, var(--marca-clara) 45%, transparent); transition:.2s;}
    .${p}-link:hover{text-decoration-color:var(--acento);}

    /* ── ALVO DE TOQUE ──────────────────────────────────────────────────────────────────────
       ≥38px (44 em linha de lista). EXCEÇÃO: link DENTRO de frase mantém a altura da linha —
       esticar quebraria o parágrafo. */
    .${p}-alvo{min-height:44px; display:inline-flex; align-items:center;}

    /* ── REDUCED MOTION: estado final visível, nunca sumir ─────────────────────────────────── */
    @media (prefers-reduced-motion: reduce){
      .${p}-rev{opacity:1 !important; transform:none !important;}
      .${p}-ent{opacity:1 !important; transform:none !important;}
      .${p}-filete-liga{transform:scaleX(1) !important;}
      .${p}-cortina{display:none !important;}
      .${p}-pulso::after{animation:none !important;}
      .${p}-foto img{animation:none !important;}
      .${p}-troca{animation:none !important;}
    }
  `;
}
