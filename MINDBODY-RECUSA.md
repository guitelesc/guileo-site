# MindBody recusou a Guileo — diagnóstico e caminhos (2026-10-09)

## O que chegou (09/10, 11:28 e 11:29)
1. Mindbody API (automático): "We cannot approve your request for live access at this time."
2. Sal Alatriste, Mindbody Integrations Team (partner@mindbodyonline.com): Mindbody "will not support, and does not authorize, **your business'** access to the Mindbody API at this time … It is not subject to appeal, and we do not have further information to share."

A recusa é da **empresa** (GUILEO AI), não do formulário nem de um detalhe técnico.

## Por que fomos recusados (o que os fatos mostram)
Eles não deram o motivo. Os fatos públicos apontam para um só:

| Fato | Fonte |
|---|---|
| Os termos da API proíbem usar a API "in a product or service that competes with products or services offered by Mindbody" (seção 8, item 5). E "Mindbody may revoke this license at any time for any reason" (seção 2). | developers.mindbodyonline.com/Resources/DeveloperAgreement |
| O MindBody vende o próprio **AI Concierge** (plano Ultimate, feito pela Playlist, a dona do MindBody): segue ligações perdidas, responde, **marca, remarca e cancela**. | mindbodyonline.com/business/ai-concierge |
| No formulário nos apresentamos como "AI front-desk platform", com recepcionista de IA que marca, remarca e cancela. É exatamente o produto deles. | MINDBODY-FORMULARIO-IA.md |
| O nosso site público diz que o **Guileo Desk** substitui o MindBody: "No MindBody e no Booksy, IA é produto à parte. Aqui ela já vem." | src/pages/GuileoDesk.jsx (guileoai.com/desk) |

Conclusão: para o MindBody, a Guileo é **concorrente direta duas vezes**: com a IA de recepção (contra o AI Concierge) e com o Desk (contra o próprio MindBody). A seção 8.5 dá a eles o direito de recusar, e eles usaram. Nenhuma resposta do formulário muda isso.

## O que NÃO fazer (põe o Natura em risco)
- Abrir outra conta de desenvolvedor com outro nome (Tribeca Global, um sócio etc.) para passar pela recusa. A recusa é da empresa, e os termos deixam revogar "for any reason" e sem aviso. Se descobrirem, quem perde é o Natura.
- Entrar no MindBody com o login do Natura e marcar por robô ou raspando a tela. Os termos proíbem (seção 8, itens 13 e 14), e o MindBody pode suspender a conta do Natura.
- Pedir ao Natura para criar uma "source" ou chave e passar para nós. Os termos proíbem usar a API "on behalf of any third party" (seção 8, item 11).

## O que ainda dá para tentar (sem garantia; chance baixa)
1. **Pressão do cliente.** O Natura paga o MindBody. A dona pode ligar para o gerente de conta dela e pedir que autorizem a integração que ela escolheu. É a única voz que pesa para eles. O mais provável é tentarem vender o AI Concierge para ela, mas vale o pedido.
2. **Pedir esclarecimento com escopo menor.** Um e-mail educado para partner@, propondo só leitura (horários e agenda) e sem o Desk no meio. Eles já disseram que não vão dar mais informação, então a chance é pequena. Só faz sentido se a Guileo decidir se posicionar como **complemento** do MindBody, e isso conflita com vender o Desk como substituto.

## A decisão de fundo (é do Luis)
Não dá para ser as duas coisas ao mesmo tempo:
- **Guileo = substituta do MindBody** (Desk). Aí o caminho é o Natura sair do MindBody para o Guileo Desk, que já está no contrato. Não precisamos da API de ninguém. **Recomendado.**
- **Guileo = complemento do MindBody.** Aí teria que tirar o "substitui o MindBody" do site e do discurso, e mesmo assim a IA de recepção continua concorrendo com o AI Concierge.

## Rascunhos (NÃO enviados — precisam do OK do Luis)

### A) Roteiro para a dona do Natura falar com o gerente de conta do MindBody
> Hi, this is [name], owner of Natura Spa + Salon (Site IDs 767008 and 5734109). I've chosen Guileo AI as the phone and chat assistant for my business, and I want it to read my schedule and book into my Mindbody account. Your team declined Guileo's API access. As a paying Mindbody customer, I'm asking you to review that and authorize the integration for my sites. If you can't, please tell me in writing what options I have to connect my own business to the tools I choose.

### B) E-mail para partner@mindbodyonline.com (só se o Luis escolher o caminho "complemento")
> Subject: GUILEO AI — request for clarification on API decision
>
> Hi Sal,
>
> Thank you for the reply. We respect the decision. Our only active Mindbody customer, Natura Spa + Salon (Site IDs 767008 and 5734109), asked us to connect to their own account. Would Mindbody consider a narrower, read-only scope (availability and the business's own appointments, no client exports) for that single subscriber, at their request? If not, we'd appreciate knowing whether there is any path for a subscriber to connect a tool of their choice.
>
> Best regards,
> Luis Teles — GUILEO AI · admguileo@gmail.com

## O que corrigir no produto, qualquer que seja a decisão
**09/10, no ar e provado em guileoai.com (deploy 229bc662):** /desk sem a comparação com o MindBody (pt/en/es); demonstração do Portal sem "já conectada ao seu Mindbody"; as duas apresentações do Natura dizem que o pedido foi recusado em 09/10 e que pedimos de novo, os números vêm dos relatórios importados e o passo 2 é o dono pedir ao gerente de conta. Sign.jsx:159/170 é só exemplo de teste (DEV_MOCK, não vai para o site no ar). Continuam abertos: o importador "Saia do MindBody" (DeskImportar.jsx), a tela de conectar o MindBody (ScheduleSync.jsx) e o contrato real do Natura no banco.

- src/pages/Portal.jsx:1532, 1550, 1592 e 1595 dizem "Pronto — a Guileo já está conectada ao seu… Mindbody". É falso.
- src/pages/Sign.jsx:159 e 170: "Agendamento no MindBody (ativação)" na assinatura do Natura.
- public/natura-apresentacao e natura-presentation: "depois do MindBody conectado" (retenção, relatórios), "Aprovações de MindBody".
- src/portal/ScheduleSync.jsx: tirar o MindBody da lista de agendas conectáveis, ou mostrar "indisponível".
- ATIVACOES.md, item 1: marcar como recusado em 09/10.

## C) Mensagem de WhatsApp para o dono do Natura (rascunho de 2026-10-09; NÃO enviada)
> Oi! Uma atualização importante sobre a Lilian. Para ela marcar direto na agenda do MindBody de vocês, o MindBody precisa liberar a Guileo, e hoje eles recusaram. Eles não explicaram o motivo, mas vendem um assistente de IA próprio, que faz o mesmo que a Lilian.
>
> Quem tem força para mudar isso é você, porque você é o cliente que paga o MindBody. Você poderia mandar a mensagem abaixo (em inglês) para o seu gerente de conta no MindBody, ou ler para ele por telefone?
>
> Enquanto isso nada para: a Lilian continua atendendo e marcando na agenda da Guileo, e eu te mostro tudo lá.
>
> ---
> Hi, this is [your name], owner of Natura Spa + Salon (Site IDs 767008 and 5734109). I've chosen Guileo AI as the phone and chat assistant for my business, and I want it to read my schedule and book into my Mindbody account. Your team declined Guileo's API access. As a paying Mindbody customer, I'm asking you to review that and authorize the integration for my sites. If you can't, please tell me in writing what options I have to connect my own business to the tools I choose.
