# PADRÃO DA VITRINE — o que TODA página de prospect precisa ter

> Luis, 26/08: «você deveria guardar e melhorar todas as exigências e o padrão que a gente fez
> pro Three Degrees, e aí colocar nesse. E nos próximos — lembra do styling, botão, etc».
>
> Nasceu depois que eu construí a página do WS **do zero** em vez de aplicar o que já estava
> aprovado. Este arquivo existe para isso não se repetir: é a lista que se COPIA, não se
> redescobre. Referência viva: `src/novo/ThreeDegrees.jsx` + `ThreeDegreesBook.jsx`.

## 0. A HERO É VÍDEO (Luis 27/08: «a hero sempre impactante com vídeo, isso converte»)
- [ ] **Procurar VÍDEO no site dele ANTES das imagens.** `grep '<video'`, `videoSrc`, `.mp4`,
      `youtube.com/embed`, `vimeo`. No Hair Art eu procurei só imagem e disse que não tinha vídeo
      sem nunca ter olhado. ⚠️ `.webm` casa com `manifest.webmanifest` — confira o contexto.
- [ ] **Sem vídeo dele? MONTE UM com as fotos REAIS.** ffmpeg, 5 planos × 4,2s, dissolve de 1s,
      e o último volta ao primeiro pra o loop não ter corte seco. ~1 MB, 1280×720, sem áudio,
      `+faststart`, `poster` do primeiro quadro. Banco de imagem continua proibido.
      🚨 `zoompan` com `-loop 1` gera `d` quadros POR quadro de entrada: sem `-frames:v N` o
      clipe de 4s vira 441 segundos. Sempre travar a contagem de saída.
      🚨 Imagem gigante no `zoompan` estoura o tempo — pré-escale para ~1920 antes.
- [ ] `<video autoPlay muted loop playsInline preload="metadata" poster=…>`. O poster é o
      fail-open: se o vídeo não carrega, a primeira tela continua sendo o salão dele.
- [ ] Véu do vídeo é VERTICAL (o texto vive embaixo, sobre a imagem) — o direcional esquerda→
      direita só funciona no desktop e some com a foto no celular.

## 0.1 A ABERTURA
- [ ] Cortina que sobe UMA vez (logo dele no centro, papel da marca).
- [ ] FAIL-OPEN OBRIGATÓRIO: o estado inicial é "já abriu". Só o efeito (que exige JS vivo) a
      fecha, e um SEGUNDO timer independente a remove aconteça o que acontecer. Cortina presa =
      o site inteiro perdido.
- [ ] `prefers-reduced-motion` e aba oculta: a abertura simplesmente não existe.

## 0.2 O TOQUE VOGUE (Luis 27/08: «precisa de um toque vogue de salão»)
- [ ] Masthead em DIDONE (Bodoni Moda), `clamp()`, tracking −.02em, itálico na cor DELE na
      segunda linha. Texto SOBRE a foto, alinhado embaixo — não ao lado.
- [ ] Filete de cabelo (1px) separando título de corpo, e abrindo cada seção.
- [ ] Numeração editorial `01 … 08` em cada seção — só quando a ordem significa algo.
- [ ] Bloco de números grandes na didone (nota, avaliações, anos, dias) — Vogue abre com dado.
- [ ] Fita de fotos horizontal com legenda HONESTA do que a foto mostra.

## 1. IDENTIDADE — é dele, medida, nunca escolhida
- [ ] Acento tirado do PIXEL (logo/botão real). No Three Degrees eu tinha escolhido vermelho; o
      pixel disse amarelo `#F5B907`. Medir, não combinar.
- [ ] Fotos reais baixadas e validadas por MIME (thumb de 128px do Google NÃO é foto).
- [ ] Sem foto nenhuma? A capa do e-mail vira o print do site novo — nunca banco de imagem.
- [ ] Texto gravado dentro do JPG dele: NENHUM rótulo por cima (vira texto fantasma duplicado).

## 2. BOTÃO — o SELO (aprovado: «esse estilo tava perfeito»)
> As 3 ESPÉCIES, e nunca mais que uma primária por viewport:
> **(a) AÇÃO/TELEFONE** na cor quente dele · **(b) SECUNDÁRIO** na cor fria dele ·
> **(c) SOBRE FOTO/VÍDEO**: fundo escuro translúcido + `backdrop-filter:blur(6px)` + borda branca.
> O acabamento completo é: profundidade (sombra em 2 camadas) + realce interno no topo +
> **varredura de laca no hover** + **GLOW EXTERNO na cor dele** (`0 0 0 4px rgba(cor,.22)`) +
> `active:scale(.985)`. Faltando o glow, o botão fica "chapado" — foi o que ele apontou.
- [ ] Massa escura lapidada + borda na cor DELE + o grau/marca dele como sufixo (`°`).
- [ ] Laca varrendo por dentro no hover (`::after` translateX -120% → 120%, .75s).
- [ ] Canto suave (10px), **nunca cápsula** — cápsula dourada chapada = «pílula de remédio».
- [ ] Cor da marca na BORDA e na varredura, jamais em preenchimento chapado.
- [ ] Desabilitado = o mesmo selo com menos luz (opacity .55 + saturate .5). Nunca cinza.
- [ ] ⚠️ Anel conic girando: só com `padding` no ::before + `mask-composite:exclude`. Sem o
      padding o conic vira mancha girando atrás do botão (falhou 2×).

## 3. MATERIAL — o realismo 4K, em TODA página
- [ ] Grão de papel/tela na raiz (`::before` fixed, opacity .35) + `> * {position:relative;z-index:1}`.
- [ ] Cartão: aro claro no topo por dentro, aro escuro embaixo, sombra de CONTATO curta +
      sombra de AMBIENTE longa, e o VERNIZ diagonal branco (`::after` linear-gradient 115deg).
- [ ] 🚨 Cor NUNCA entra na superfície do vidro — tingir vira plástico néon.
- [ ] Vinheta de lente nas fotos grandes (4% nas quinas): foto real tem queda de luz.
- [ ] Raio 20px nos cartões.

## 4. MOVIMENTO
- [ ] Reveal on scroll com IntersectionObserver — **FAIL-OPEN**: o esconder só liga DEPOIS do
      observer armar, com failsafe de 1.8s. (Escondi incondicionalmente e a página ficou EM
      BRANCO em aba oculta, onde o IO nunca dispara.)
- [ ] Hero-filme quando não há vídeo: 3 takes em cross-fade, cada um com movimento próprio.
- [ ] Curva-assinatura desenhando (`stroke-dasharray/dashoffset`).
- [ ] Um selo VIVO só, e que INFORMA (relógio + aberto/fechado do MESMO tick).
- [ ] `prefers-reduced-motion`: estado final visível, nunca sumir.

## 5. CONVERSÃO
- [ ] QUIZ em passos, 2 perguntas por vez, barra de progresso que só anda com resposta.
- [ ] ESCAPE de texto livre em todo passo ("Something else…") + recado opcional no fim.
- [ ] MULTICANAL: a pessoa escolhe onde ser respondida (phone/whats/IG/telegram/email).
      Só canais que o negócio ATENDE. O canal viaja no pedido.
- [ ] Botão final promete o resultado ("Start my transformation"), não a mecânica ("Send to
      the front desk").
- [ ] Quote vivo: preço + DURAÇÃO da matriz real, e "Hana confirma" — nunca "agendado".
- [ ] Alvo de toque ≥38px (44px em linha de lista).
      EXCEÇÃO: link DENTRO de frase (rodapé, "or call X") fica com a altura da linha — esticar
      quebraria o parágrafo. E o "Skip to content" é invisível de propósito. A regra é para
      alvos que existem para serem tocados, não para texto que por acaso é link.

## 6. PÁGINA DE BOOKING — /novo/:slug/book
- [ ] No NOSSO domínio. O provedor (Booker/Vagaro) é saída SECUNDÁRIA no rodapé.
- [ ] Cardápio COMPLETO lido do sistema de booking dele — preço + duração + condição.
- [ ] FOTO DO PROFISSIONAL na linha do serviço e no cartão do pedido (o Booker faz e converte).
      Serviço sem nome de pessoa fica sem foto — inventar rosto é dizer quem atende sem saber.
- [ ] Regra da casa aparece NA ESCOLHA, não no rodapé (ex.: perm em cabelo descolorido).
- [ ] Mesmo header, mesmo selo, mesmo material da vitrine.

## 7. CABEÇALHO E LOGO
- [ ] Marca + ação na MESMA linha (`flex-nowrap`), nome com `clamp`, telefone vira "Call" <380px.
- [ ] **O ARQUIVO TEM QUE SER TRANSPARENTE.** Logo do cliente quase sempre vem em JPG/PNG com
      fundo branco opaco — colado na página ele lê como ADESIVO, e no fundo escuro vira um bloco
      branco. Recorte a margem, tire o branco por LUMINÂNCIA com meio-tom nas bordas (senão a
      linha fina serrilha), e **prove sobre DOIS fundos** (escuro e papel) antes de usar.
      Guarde também uma versão `-papel.png` achatada: transparência não é confiável em todo
      cliente de e-mail.
- [ ] Logo numa PLACA: aro de luz interno no topo, sombra interna embaixo, sombra de contato
      curta, mesmo raio dos cartões.
- [ ] **PLACA PROPORCIONAL AO LOGOTIPO.** Logotipo deitado (ex. 1,7:1) dentro de placa QUADRADA
      fica com 20px de altura e ninguém lê. Placa com `px-3` + altura fixa, logo em `h-[32px]
      w-auto`. Meça o `getBoundingClientRect` depois — 55×32 lê, 34×20 não.

## 8. ANTES DE DIZER QUE ACABOU
- [ ] **DIFF CONTRA A REFERÊNCIA antes de dizer que acabou**: `grep` das seções do ThreeDegrees
      × as suas. A v1 do Hair Art tinha 736 linhas contra 1071 e faltava vídeo, prova social, a
      fita de fotos, a ponte do booking e A SEÇÃO QUE MOSTRA O QUE A IA FAZ — a que vende.
- [ ] `node --test src/novo/crase.test.mjs` — conta crases dentro de `<style>{\` … \`}`. Uma
      palavra entre crases num COMENTÁRIO fecha a string; o erro aparece 300 linhas depois como
      "Expected } but found Identifier". Já quebrou a build 5 vezes.
- [ ] 🚨 `.minha-classe{display:inline-flex}` na sua folha VENCE o `hidden` do Tailwind (a sua
      folha é injetada depois). Para esconder algo seu, a regra tem que ser SUA, com media query.
- [ ] **Deploy travado no código de saída**: `if build==0 então deploy`. Rodar os dois soltos
      sobe dist velho quando o build falha — e o deploy responde 0 do mesmo jeito.
- [ ] `npx eslint` no arquivo (pegou o canal preso no `useCallback` — defeito de conversão mudo).
- [ ] Build **e** deploy separados: `npm run build && deploy` sobe dist VELHO quando o build falha.
- [ ] Abrir a página e SONDAR o DOM (schema, tel, h1, alt, imagens quebradas, overflow, alvos).
- [ ] Mobile 375px de verdade.
- [ ] Medir a altura real ANTES de recortar screenshot (recortei 1.250px de um e-mail de 3.943
      e afirmei que faltava conteúdo que estava lá).
