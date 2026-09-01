# OSSOS POR VERTICAL — a estrutura muda, não só a cor

> Luis, 28/08, olhando a vitrine do Dr. Kletsman: **«tira essa estrutura de salão, lembra que é
> clínica médica»**. Ele estava certo e o defeito era meu: eu vinha clonando `HairArtDesigns.jsx`
> a cada prospect, então toda vitrine nascia com o esqueleto de um salão — cardápio de serviços
> com preço, "os artistas", quiz de agendamento. Numa clínica médica isso é o osso errado.
>
> **A regra:** identidade é do cliente (cor, foto, logo — medidos). Craft é compartilhado
> (`vitrine.css.js`). **Osso é da VERTICAL.** Nunca clone o osso de uma vertical noutra.

---

## Como descobrir o osso: a pergunta única

> **O que essa pessoa precisa saber para confiar antes de ligar?**

A resposta é diferente por vertical, e é ela que define a ordem das seções. Não invente o osso:
derive dele.

---

## 🩺 CLÍNICA / CONSULTÓRIO (médico, dentista, terapia)
**O que vende: CONFIANÇA e ACESSO.** Ninguém escolhe médico por preço; escolhe por credencial,
por quem é a pessoa, e por conseguir chegar lá. Preço quase nunca é público — e tudo bem.

1. **Hero** — quem é e o que trata, com o rosto ou o espaço real
2. **Credenciais** — anos, formação, cargo, certificação. É a primeira coisa que o paciente pesa
3. **🚩 ONDE FICA E COMO CHEGAR** — endereço completo, andar, metrô/estação, estacionamento, mapa.
   Em NYC isso decide a consulta. **Nunca omita: se não sabe, PESQUISE** (site → Google Places →
   registro público). Foi omitir isso que estragou a v1 do NY Medical
4. **O médico** — retrato real e bio verdadeira. Sem rosto confirmado, é tipográfico; nunca stock
5. **O que trata** — em categorias clínicas, **sem preço**, CTA = consulta
6. **Logística que tira o medo** — seguro aceito, financiamento, same-day, telessaúde, emergência,
   primeira visita, o que trazer
7. **A equipe** — quando existe e é real
8. **Agendar** — captura curta. Em dor/emergência, o telefone primeiro
9. **FAQ** — as perguntas de quem nunca foi ali

**Nunca numa clínica:** preço inventado, "cardápio" de procedimentos como loja, promessa de
resultado, alegação médica ("cura", "trata", "diagnostica" — use a linguagem do próprio site
deles), rosto de banco de imagem.

---

## 💇 SALÃO / ESTÉTICA
**O que vende: TRANSFORMAÇÃO e PREÇO ABERTO.** Aqui preço público é vantagem competitiva — a
maioria esconde atrás de "call for pricing" e perde o cliente que não quer ligar.

1. **Hero** — a transformação (foto/filme do trabalho real)
2. **Prova** — nota, avaliações, o que os clientes dizem, casos antes/depois
3. **Preço aberto** — o cardápio real do sistema de agendamento deles, com faixa honesta
4. **Quem faz** — os profissionais com foto (do sistema deles; nunca pareie rosto e nome de
   fontes diferentes)
5. **Agendar** — quiz curto, escape de texto livre, multicanal
6. **Regras da casa** — cancelamento, ajuste, produtos — ditas ANTES, não no rodapé

---

## 🔧 SERVIÇO / OBRA (encanador, elétrica, reforma, contratante)
**O que vende: PROVA DE TRABALHO e RESPOSTA.** Quem chama tem um problema agora.

1. **Hero** — a urgência atendida (24h, tempo de resposta) ou o portfólio
2. **Prova de trabalho** — obras reais, licenças, anos, seguro
3. **Área atendida** — bairro por bairro; o cliente quer saber se atende a rua dele
4. **Como funciona** — do chamado ao orçamento, sem mistério
5. **Orçamento** — captura com o problema descrito, foto opcional
6. **Preço** — faixa quando publicam; "orçamento sem custo" quando não

---

## 🍽️ RESTAURANTE / VAREJO
**O que vende: DESEJO e CONVENIÊNCIA.**

1. **Hero** — o produto, grande
2. **Cardápio/catálogo** — com preço, que aqui é público por natureza
3. **Como pedir** — delivery, retirada, reserva, horário
4. **Onde fica**
5. **Prova** — avaliações

---

## O QUE É IGUAL EM TODAS

Independente da vertical, toda vitrine do COMBO leva:

- **Hero com filme** (o vídeo dele; se não tem, monta-se dos ativos reais dele)
- **A abertura** (cortina), fail-open
- **A seção do agente** — o que a IA dele faz, com funções que ela JÁ executa
- **Captura com callback** — o formulário que faz o telefone tocar
- **Contato todo à vista e vivo** — tel, texto, e-mail, mapa, redes
- **Dado estruturado** (JSON-LD) da vertical certa
- **O material 4K e o selo** do `vitrine.css.js`

## O QUE NUNCA ENTRA

- Foto de banco, rosto inventado, depoimento não verificado
- Preço, horário ou endereço inventados — **omitir é ruim, pesquisar é o certo**
- Emoji na interface, robô como mascote, selo repetido de enfeite
- O osso de outra vertical
