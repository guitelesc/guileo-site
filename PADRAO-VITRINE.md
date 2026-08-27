# PADRÃO DA VITRINE — o que TODA página de prospect precisa ter

> Luis, 26/08: «você deveria guardar e melhorar todas as exigências e o padrão que a gente fez
> pro Three Degrees, e aí colocar nesse. E nos próximos — lembra do styling, botão, etc».
>
> Nasceu depois que eu construí a página do WS **do zero** em vez de aplicar o que já estava
> aprovado. Este arquivo existe para isso não se repetir: é a lista que se COPIA, não se
> redescobre. Referência viva: `src/novo/ThreeDegrees.jsx` + `ThreeDegreesBook.jsx`.

## 1. IDENTIDADE — é dele, medida, nunca escolhida
- [ ] Acento tirado do PIXEL (logo/botão real). No Three Degrees eu tinha escolhido vermelho; o
      pixel disse amarelo `#F5B907`. Medir, não combinar.
- [ ] Fotos reais baixadas e validadas por MIME (thumb de 128px do Google NÃO é foto).
- [ ] Sem foto nenhuma? A capa do e-mail vira o print do site novo — nunca banco de imagem.
- [ ] Texto gravado dentro do JPG dele: NENHUM rótulo por cima (vira texto fantasma duplicado).

## 2. BOTÃO — o SELO (aprovado: «esse estilo tava perfeito»)
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
- [ ] Logo numa PLACA (aro de luz + sombra de contato + raio dos cartões) — arquivo com fundo
      branco colado na página lê como adesivo.

## 8. ANTES DE DIZER QUE ACABOU
- [ ] `npx eslint` no arquivo (pegou o canal preso no `useCallback` — defeito de conversão mudo).
- [ ] Build **e** deploy separados: `npm run build && deploy` sobe dist VELHO quando o build falha.
- [ ] Abrir a página e SONDAR o DOM (schema, tel, h1, alt, imagens quebradas, overflow, alvos).
- [ ] Mobile 375px de verdade.
- [ ] Medir a altura real ANTES de recortar screenshot (recortei 1.250px de um e-mail de 3.943
      e afirmei que faltava conteúdo que estava lá).
