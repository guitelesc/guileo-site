# COMBO MOTOR — o primeiro contato completo, de uma URL ao "só falta a call"

> Decisões do Luis, 25/08 (travadas): dispara **manual** (URL colada ou botão no hub) ·
> e-mail sai como **cópia pro Luis + "envia"** · site **publica direto** em /novo/:slug ·
> telefone = **voz no navegador padrão + 1 número rotativo** quando o Twilio for recarregado.
>
> O objetivo é um só: o prospect ABRE e vê tudo dele funcionando — site, atendente falando,
> preço cotado com duração. O processo humano que sobra é a call e o fechamento.

## A esteira (provada 2×: WS Hairstyling · Three Degrees)

```
URL do prospect
  │
  1. SCOUT — sempre no DOM RENDERIZADO (Cloudflare barra curl; headless com UA real fura p/ screenshot)
  │    • cardápio por NÓ (3 incidentes de pareamento por texto achatado)
  │    • fotos baixadas e validadas por MIME (thumb 128px do Google NÃO é foto)
  │    • acento MEDIDO NO PIXEL (Three Degrees: era amarelo #F5B907, não o que eu escolhi)
  │    • sistema de booking (Booker/Vagaro) → É A FONTE DO CÉREBRO, não o site bonito
  │    • defeitos medidos + imprensa/prova social (Refinery29, "Top 31", fundador)
  │
  2. EM PARALELO (arquitetura do Luis: "no momento que clona, outro agente refaz e
  │              outro já deixa o agente pronto com os dados clonados")
  │    A. SITE  — clone ESTRUTURAL (ordem de seções + acento deles) + acabamento Guileo:
  │              material NVIDIA claro, reveals FAIL-OPEN (aba oculta = página inteira),
  │              hero-filme se não houver vídeo real, quote vivo, rotas: src/novo/<Slug>.jsx
  │              + case em src/pages/Novo.jsx (config AI: accent/mascote/fone)
  │    B. AGENTE — db/combo/<slug>.brain.txt (≤4000c) com o MENU OPERACIONAL do booking
  │              (nº, preço, DURAÇÃO, regras por estilista) + travas anti-invenção
  │              → onboard-client (number_mode:"none") → /api/agente-limites (-1→10)
  │              → slug em client_sites (voz no navegador) → sync-agent p/ updates
  │              → PROVA: agente-config releitura com 5+ asserts do cardápio
  │    C. E-MAIL — websiteUpgradeEmail (ou achadoEmail se o site deles é bom):
  │              `usou` honesto, exemplos de resposta DO negócio, destaque Pulse,
  │              rodapé de e-mail frio → CÓPIA para luistelesc@gmail.com
  │
  3. CARIMBOS — ficha CRM (nota preservando "Relatório:"), lista de ligação
  │    (contatado/site_novo/presente/feridas/pernas), payload salvo no scratchpad
  │
  4. GATES HUMANOS — "envia" (e-mail real) · recarga+"pode comprar" (número) ·
       celular do Luis (Hana liga pra ele testar)
```

## Leis que o motor NUNCA quebra
- Números: +19864443334 (nossa, INVIOLÁVEL) e qualquer número de cliente (bind-number recusa
  reapontar; `forcar:true` só com ordem explícita). Piso Twilio $25 para comprar.
- Zero Anthropic em runtime: tudo determinístico (quote = matriz; avaliação = lib/avaliacao).
- Preço/duração NUNCA inventados: sem fonte → "the front desk confirms".
- Texto gravado DENTRO do JPG do cliente: nenhum rótulo por cima.
- E-mail para prospect: só com o "envia" do Luis, por destinatário.

## Peças prontas (onde mora cada uma)
sites: src/novo/{NonstopPlumbers,AstoriaPlumbers,QueensPlumber,SiderisPlumbing,SRGeneral,
PennPlazaDental,UrbanStandard,WSHairstyling,ThreeDegrees}.jsx · presente: public/presente/dshal/
e-mail: functions/lib/emailTemplates.js (websiteUpgradeEmail/achadoEmail + blocoResponder)
agente: onboard-client · agente-limites · sync-agent · agente-config(?padrao/?ligacao) · banca
voz web: voice-web + client_sites + GuiLayer (evento gui-abrir) · fila: lista_de_ligacao

## A CAMADA DE CONTATO — o Motor de Ativação de Leads (Luis, 25/08: "a parte mais importante")
Todo site do combo entrega o contato TODO à vista e VIVO:
- tel: clicável · mailto: clicável · Instagram clicável · booking do provedor deles · mapa/endereço
- FORMULÁRIO SEMPRE ATIVO: captura no CRM da casa (lead-vitrine) E — quando
  `client_sites.config.ligar_de_volta = true` no slug — **a IA do negócio LIGA DE VOLTA
  na hora** pro telefone digitado. O visitante preenche, o telefone toca, é o salão dele falando.
- Salvaguardas: opt-in por slug (padrão OFF; ligar por demo) · tenant resolvido no SERVIDOR ·
  a discagem passa pelo /api/call (DNC + caps + rate) · falha de ligação NUNCA desfaz a captura
  (resposta diz as duas verdades: recebido ✓ / ligacao "disparada"|"desligada"|motivo).
- Catálogo de agenda (biz_services) TEM que ser o real do booking deles — o onboard semeia
  genérico ("Manicure" num salão de cabelo!); o combo troca pelos 3 serviços-âncora reais.
- PROVADO 25/08: ws-hairstyling (OFF) → "desligada"; three-degrees (ON) → "disparada" ponta a ponta.

## O PADRÃO DA VITRINE mora em PADRAO-VITRINE.md
Toda página nova (vitrine ou /book) COPIA aquela lista — não redescobre. Nasceu porque eu
construí a página do WS do zero, sem olhar o que já estava aprovado no Three Degrees, e o diff
mostrou 3 itens faltando (grão, verniz, aro de luz). O ciclo é **clona → ESTUDA → muda**:
o "estuda" é ler PADRAO-VITRINE.md antes de escrever a primeira linha.
