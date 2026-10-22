# CANAIS — o mapa por canal (atualizado 16/10/2026 · conferido contra o Anexo A do contrato)

> Fonte única: `scripts/canais_dados.py`. Mudou algo? Edite lá e rode `python3 scripts/canais_gerar.py` — este arquivo e a página visual saem iguais.
> Estados: 🟢 No ar · 🟡 Pronto · depende do cliente · 🔵 Aguarda terceiro · ⚪ Planejado · 🔴 Parado agora. Quem: Luis · Natura · Guileo (dev) · Terceiro.

## O que vale para todos os canais

- **Cérebro:** Todo canal fala com o MESMO agente do negócio na ElevenLabs (Natura = Lilian, agent_8701kxnfhgmgefzbbwda8d86mqwj). API da Anthropic desligada desde 05/10 (functions/api/_middleware.js).
- **Relógio:** functions/api/cron-tick.js, a cada 15 min, dispara todas as automações. Última rodada de cada uma: guileoai.com/api/automacoes e /admin → ⚙️ Automações.
- **Alarmes:** lib/avisarDono.js → feed do /admin + e-mail do dono (alarmes 🚨 passam pela trava de e-mail desde 14/10).
- **Dados:** Supabase ynihodbknhjirkdogxby. Tudo escopado por client_email (Natura = naturaspaadm@gmail.com). SQL em db/*.sql.

## Quem precisa agir

### Luis (11)
- [ ] **Telefone (voz):** Conferir e recarregar os créditos da ElevenLabs (zeraram em 14/10; enquanto não voltar, a Lilian não fala)
- [ ] **Telefone (voz):** Recarregar a Twilio (US$ 14,84, piso US$ 20)
- [ ] **SMS (texto):** Campanha A2P CM73eca1 já preenchida (13/10): Luis entra no console da Twilio e aperta Submit registration
- [ ] **WhatsApp:** Verificação da empresa na Meta (documento da Tribeca Global)
- [ ] **WhatsApp:** Token permanente de Usuário do Sistema (o de 24h expirou)
- [ ] **Instagram e Facebook:** Verificação da empresa na Meta (documento da Tribeca Global)
- [ ] **Instagram e Facebook:** App Review: instagram_manage_messages e pages_messaging (acesso avançado)
- [ ] **Google (avaliações e ficha):** Pedido de acesso à Google Business Profile API (projeto ainda não aprovado)
- [ ] **TikTok:** Conta TikTok for Developers da Guileo + app "Guileo AI" + produto Business Messaging
- [ ] **Painel da Natura e relatórios:** Mandar o aviso de entrega de cada item da Parte 4 (cláusula 2.6; texto pronto em NATURA-ADITIVO-E-MENSAGEM.md §C)
- [ ] **Agenda (Guileo Desk):** Aditivo do contrato: Go-Live com "marcar no Guileo Desk" (rascunho em NATURA-ADITIVO-E-MENSAGEM.md)

### Natura (17)
- [ ] **Telefone (voz):** Desviar as linhas principais para a Lilian (no teste: só quando ninguém atende)
- [ ] **Telefone (voz):** Um número direto por unidade, para passar a ligação a uma pessoa
- [ ] **Site (chat e voz):** Apontar o domínio naturaspanyc.com para a Guileo (hoje no servidor antigo)
- [ ] **Site (chat e voz):** Conta Stripe no nome do Natura (loja, membership, vale-presente)
- [ ] **E-mail:** Endereço físico no rodapé (lei CAN-SPAM) para as campanhas
- [ ] **E-mail:** Ofertas de aniversário e "sentimos sua falta" aprovadas
- [ ] **E-mail:** Exportação de clientes do MindBody (CSV) para a base inteira receber
- [ ] **SMS (texto):** Marca da Natura na Twilio (ISV) para texto às clientes dela: precisa do EIN da Natura
- [ ] **WhatsApp:** Número do Natura no WhatsApp Business + modelos aprovados
- [ ] **Instagram e Facebook:** Acesso à Página e ao Instagram do Natura; Instagram amarrado à Página no Business Suite
- [ ] **Google (avaliações e ficha):** Acesso às 3 fichas do Google do Natura
- [ ] **Painel da Natura e relatórios:** Ligar o resumo da manhã (Balcão → Equipe → Avisos)
- [ ] **Painel da Natura e relatórios:** Recepção passar a marcar no Desk para os relatórios do balcão encherem
- [ ] **Agenda (Guileo Desk):** Exportação de clientes e agendamentos futuros do MindBody
- [ ] **Agenda (Guileo Desk):** Se a MindBody não aprovar: a Natura decide a data da virada para o Desk
- [ ] **Pagamentos (Stripe do Natura):** Conta Stripe no nome do Natura + chave restrita colada em guileoai.com/receber
- [ ] **Sob pedido (Parte 5):** Natura pedir o item e aprovar o orçamento

### Guileo (9)
- [ ] **Telefone (voz):** Cortar o gasto dos robôs internos (canário de 1h → 6h; Escritor só para o cliente)
- [ ] **Telefone (voz):** Lilian pedir a permissão para ofertas durante a ligação (mudança de prompt, ROTA-AGENTE)
- [ ] **Site (chat e voz):** Ligar AGENDA_GUILEO=true quando o balcão marcar no Desk
- [ ] **Site (chat e voz):** Cadastrar os produtos reais da loja (até 50, cláusula 7.4)
- [ ] **SMS (texto):** Ligar SMS_A2P_APROVADO=1 no Cloudflare e redeploy
- [ ] **WhatsApp:** Conectar via whatsapp-connect e provar uma mensagem com id
- [ ] **Instagram e Facebook:** Conectar com meta-connect e provar uma DM respondida com id
- [ ] **TikTok:** Webhook de mensagens → mesmo cérebro do chat
- [ ] **Pagamentos (Stripe do Natura):** Pagar um link em modo de teste para provar

### Terceiro (2)
- [ ] **SMS (texto):** Aprovação da operadora (sem prazo)
- [ ] **Agenda (Guileo Desk):** Aprovação da API pela MindBody (Christophe, suporte de API) e ativação dos 2 sites pela dona

## Canais

### 🔴 Telefone (voz) — Parado agora

A Lilian atende o número dedicado, conversa em EN/PT/ES, marca, remarca e cancela, e avisa o dono.

**No contrato:** Parte 1: atende 24/7, reconhece pelo nome, marca/remarca/cancela, transcrição e áudio. Parte 3: Lilian nas linhas principais, retorno de ligação perdida, passar para uma pessoa.

**Rotas**

- `Twilio → ElevenLabs` — número +1 929 828 8170 (phnum_3301ky6v71g3epgbzsqxrhxzqvns) ligado à Lilian na ElevenLabs
- `functions/api/agent-schedule.js` — ferramenta 'schedule' da Lilian: horários, marcar, remarcar, cancelar, adicionar serviço
- `functions/api/elevenlabs-webhook.js` — pós-ligação: grava a ligação, transcrição, análise e o agendamento
- `functions/api/call.js` — PORTÃO ÚNICO de ligação de saída (DNC, trava de país, teto): retorno com 1 toque, promoção com consentimento
- `functions/api/twilio-voice.js` — resgate de ligação perdida (quando a linha do salão não atende)
- `functions/lib/emergencyCall.js` — urgência → toca o celular do dono

**Automações** (como funciona · onde mora · como provar)

- 🔴 **Atender e marcar por voz** (Parado agora)
  - Como funciona: Cliente liga no número da Lilian → ela consulta horários com a ferramenta 'schedule' → marca, remarca, cancela ou acrescenta serviço no motor de agenda → no fim da ligação o webhook grava transcrição, áudio e o agendamento.
  - Onde mora: `Twilio +1 929 828 8170 → ElevenLabs (agente da Natura) · functions/api/agent-schedule.js · functions/api/elevenlabs-webhook.js · na hora (não depende do relógio)`
  - Como provar: Ligar para o número e marcar; a reserva aparece em /portal → Agenda e a conversa em /portal → Ligações.
- 🟢 **Aviso ao dono a cada agendamento ou venda** (No ar)
  - Como funciona: Reserva ou venda gravada → e-mail ao dono (ownerAlertEmail) + linha no feed do painel.
  - Onde mora: `functions/api/agent-schedule.js · lib/avisarDono.js · na hora`
  - Como provar: Marcar uma reserva de teste na conta e2e-test e ver o e-mail com id da Resend.
- 🟡 **Retorno de ligação perdida** (Pronto · depende do cliente)
  - Como funciona: A linha da unidade não atende → a ligação cai na Lilian (resgate) → se ninguém fala, o retorno entra na lista e a equipe dispara com um toque; a ligação de saída passa pelo portão call.js.
  - Onde mora: `functions/api/twilio-voice.js · functions/api/call.js · na hora; acende quando a Natura desviar as linhas`
  - Como provar: Ligar para a linha da unidade sem atender e ver o pedido em /portal → Retornos.
- 🟡 **Promoção por telefone** (Pronto · depende do cliente)
  - Como funciona: A dona escolhe a oferta → só clientes com permissão registrada (consent_audience) → a Lilian liga das 8h às 21h locais, até 20 por rodada, pelo portão call.js (DNC, país, teto).
  - Onde mora: `functions/api/reactivate.js · functions/api/call.js · só quando a dona dispara`
  - Como provar: Disparar na conta e2e-test para um número de teste com permissão; o portão grava cada tentativa.
- 🟢 **Reconhece pelo nome e sabe da última visita** (No ar)
  - Como funciona: Antes de falar, a Lilian pergunta ao nosso servidor quem está ligando (pelo telefone ou e-mail) → recebe nome e última visita → cumprimenta pelo nome. A base inteira só é reconhecida depois da importação do MindBody.
  - Onde mora: `webhook de início da conversa (agente-widget.js configura) · functions/api/agent-schedule.js · na hora`
  - Como provar: Ligar de um número que já marcou e ouvir o cumprimento pelo nome.
- 🟢 **Pedido de retorno registrado e equipe avisada** (No ar)
  - Como funciona: Cliente pede para alguém retornar → a Lilian grava o pedido (action callback) → aviso imediato ao dono e a linha entra na lista de acompanhamento.
  - Onde mora: `functions/api/agent-action.js (action=callback) · lib/avisarDono.js · na hora`
  - Como provar: Pedir retorno numa ligação de teste e ver o aviso e a linha em /portal → Acompanhamento.
- 🟡 **Passar a ligação para uma pessoa, com nota** (Pronto · depende do cliente)
  - Como funciona: Pedido que precisa de gente (saúde, reclamação, exceção) → a Lilian transfere para o número da unidade com um resumo do que foi dito; fora do horário, anota e avisa.
  - Onde mora: `ferramenta de transferência do agente na ElevenLabs · acende com o número direto de cada unidade`
  - Como provar: Ligação de teste em horário comercial transfere para o número cadastrado.
- 🟡 **Acrescentar um serviço a uma visita marcada** (Pronto · depende do cliente)
  - Como funciona: Cliente quer somar (ex.: facial antes da massagem) → a Lilian procura o horário colado, com a profissional e a sala livres → marca ligado à visita, sem choque.
  - Onde mora: `functions/api/agent-schedule.js (op adicionar) · motor biz_* · na hora`
  - Como provar: Marcar uma massagem na conta de teste e pedir para somar um facial.

**Checklist**

- [ ] Conferir e recarregar os créditos da ElevenLabs (zeraram em 14/10; enquanto não voltar, a Lilian não fala) — _Luis_
- [ ] Recarregar a Twilio (US$ 14,84, piso US$ 20) — _Luis_
- [ ] Cortar o gasto dos robôs internos (canário de 1h → 6h; Escritor só para o cliente) — _Guileo_
- [ ] Desviar as linhas principais para a Lilian (no teste: só quando ninguém atende) — _Natura_
- [ ] Um número direto por unidade, para passar a ligação a uma pessoa — _Natura_
- [ ] Lilian pedir a permissão para ofertas durante a ligação (mudança de prompt, ROTA-AGENTE) — _Guileo_

### 🟡 Site (chat e voz) — Pronto · depende do cliente

Site novo do Natura com a Lilian no canto (voz e chat), três unidades, Med Spa com frente própria, loja e membership em prévia.

**No contrato:** Parte 1: Lilian no site por voz e chat; site modernizado em endereço de prévia. Parte 3: site no domínio, página por unidade.

**Rotas**

- `src/novo/NaturaSpa.jsx` — o site (prévia: guileoai.com/novo/natura-spa · Med Spa: ?frente=med)
- `functions/api/widget-chat.js` — chat do site → agente do negócio
- `functions/api/voice-web.js` — voz no navegador, sem telefone
- `functions/api/vitrine-agenda.js + src/pages/Agendar.jsx` — agendar pelo site (guileoai.com/agendar/natura-spa) com caixa de permissão para ofertas
- `functions/lib/dominio.js + tabela tenant_domains` — servir o site no domínio do cliente (www.naturaspanyc.com já cadastrado)
- `src/novo/NaturaStore.jsx · NaturaMembership.jsx` — loja e assinatura (prévia até o Stripe do Natura)

**Automações** (como funciona · onde mora · como provar)

- 🟢 **Lilian responde no site 24/7** (No ar)
  - Como funciona: Visitante abre o chat ou o microfone no canto do site → a mensagem vai ao MESMO agente do telefone → resposta com preços e horários reais; contato com nome e telefone vira lead.
  - Onde mora: `functions/api/widget-chat.js (texto) · functions/api/voice-web.js (voz) · na hora`
  - Como provar: Abrir guileoai.com/novo/natura-spa, perguntar um preço e conferir o lead em /portal → Leads.
- 🟡 **Agendar pelo site** (Pronto · depende do cliente)
  - Como funciona: Cliente escolhe unidade, serviço e horário em /agendar/natura-spa → marca no motor de agenda sem choque → confirmação por e-mail. Os botões do site só trocam da MindBody para cá quando AGENDA_GUILEO=true.
  - Onde mora: `functions/api/vitrine-agenda.js · src/pages/Agendar.jsx · interruptor em src/novo/NaturaSpa.jsx`
  - Como provar: Marcar pela prévia ?agenda=guileo na conta de teste e ver a reserva no /balcao.
- 🟡 **Loja, membership e vale-presente** (Pronto · depende do cliente)
  - Como funciona: Cliente compra no site → pagamento no Stripe DA NATURA → e-mail na marca da Natura com o código ou a assinatura; conferência de hora em hora pega quem fechou a aba.
  - Onde mora: `functions/api/loja-checkout.js · assinatura-checkout.js · giftcards.js · relógio: venda-online-reconcile de hora em hora`
  - Como provar: Comprar em modo de teste do Stripe da Natura e ver a venda no painel.
- 🟢 **Med Spa como frente própria** (No ar)
  - Como funciona: Quem entra por naturaspanyc.com/med-spa-ues (prévia: ?frente=med) vê a porta do Med Spa: título próprio, "Book a free consultation", telefone do Med Spa e o objetivo "Feel more confident".
  - Onde mora: `src/novo/NaturaSpa.jsx (frenteMed) · functions/lib/dominio.js (caminho med-spa-ues)`
  - Como provar: Abrir guileoai.com/novo/natura-spa?frente=med.

**Checklist**

- [ ] Apontar o domínio naturaspanyc.com para a Guileo (hoje no servidor antigo) — _Natura_
- [ ] Ligar AGENDA_GUILEO=true quando o balcão marcar no Desk — _Guileo_
- [ ] Conta Stripe no nome do Natura (loja, membership, vale-presente) — _Natura_
- [ ] Cadastrar os produtos reais da loja (até 50, cláusula 7.4) — _Guileo_

### 🟢 E-mail — No ar

O canal que está no ar para o cliente final: confirmação, lembrete, avaliação, volta, aniversário, acompanhamento de consulta e campanhas, tudo na marca do Natura.

**No contrato:** Parte 1: confirmação por e-mail, lembrete 24h, pedido de avaliação 3h, lembrete de retorno. Parte 3: aniversário, "sentimos sua falta", promoções por e-mail, convidar a base.

**Rotas**

- `functions/lib/emailTemplates.js` — ÚNICA fonte de e-mail (nunca HTML solto)
- `functions/api/proactive.js` — lembrete 24h + pedido de avaliação 3h (cron 'lembretes'), volta no ciclo + aniversário ('relacionamento')
- `functions/api/consulta-retorno.js` — acompanhamento de consulta que não virou agendamento (3 dias)
- `functions/api/resumo-manha.js · relatorio-mensal.js` — resumo da manhã e relatório mensal ao dono (opt-in)
- `functions/api/crm.js · coupons.js · reactivate.js` — campanhas, cupons, reativação
- `functions/lib/travaEmail.js` — trava de saída: barra o Gmail do Luis; alarmes passam

**Automações** (como funciona · onde mora · como provar)

- 🟢 **Confirmação na marca da Natura** (No ar)
  - Como funciona: Reserva marcada, remarcada ou cancelada (telefone, site ou balcão) → e-mail appointmentEmail com logo, unidade, endereço e link para ver ou mudar o horário.
  - Onde mora: `functions/api/agent-schedule.js → lib/emailTemplates.js · na hora`
  - Como provar: Marcar na conta e2e-test e conferir o e-mail com id da Resend.
- 🟢 **Lembrete 24h antes** (No ar)
  - Como funciona: Toda reserva que vence nas próximas 24h e ainda não foi lembrada → appointmentReminderEmail; carimbo no banco impede mandar duas vezes.
  - Onde mora: `functions/api/proactive.js?apenas=lembretes · relógio: a cada 15 min`
  - Como provar: guileoai.com/api/automacoes → 'lembretes' ok; reserva de teste para amanhã recebe o e-mail.
- 🟢 **Pedido de avaliação 3h depois** (No ar)
  - Como funciona: Visita terminou há 3h → reviewRequestEmail com o link do Google da unidade CERTA e, ao lado, um canal privado com a equipe. Vai para TODAS as clientes (sem filtro de nota).
  - Onde mora: `functions/api/proactive.js?apenas=lembretes · links em review_links (functions/api/review-link.js) · relógio: a cada 15 min`
  - Como provar: Reserva de teste no passado recente recebe o e-mail; o link abre a ficha certa no Google.
- 🟢 **Volta no ciclo de cada serviço** (No ar)
  - Como funciona: Cada serviço tem um ciclo (ex.: 28 dias) → quando vence e a cliente não marcou de novo → returnCycleEmail convidando a voltar.
  - Onde mora: `functions/api/proactive.js?apenas=relacionamento · relógio: 1×/dia às 13h e 14h UTC (≈9h NY)`
  - Como provar: /api/automacoes → 'relacionamento' ok; contato de teste com ciclo vencido recebe.
- 🟢 **Acompanhamento de consulta do Med Spa** (No ar)
  - Como funciona: Fez a consulta grátis e não marcou nada em 3 dias → UM e-mail da assistente (consultFollowupEmail), só das 9h às 20h locais.
  - Onde mora: `functions/api/consulta-retorno.js · db/consulta_retorno.sql · relógio: de hora em hora`
  - Como provar: /api/automacoes → 'consulta-retorno' ok.
- 🟡 **Aniversário e "sentimos sua falta"** (Pronto · depende do cliente)
  - Como funciona: Dia do aniversário → birthdayEmail com a oferta da Natura; 60+ dias sem visita → winbackCustomerEmail. Só sai depois que a Natura aprovar a oferta.
  - Onde mora: `functions/api/proactive.js · relógio: 1×/dia às 13h UTC`
  - Como provar: Contato de teste com aniversário hoje recebe na rodada das 13h.
- 🟡 **Campanhas por e-mail / convidar a base** (Pronto · depende do cliente)
  - Como funciona: A dona monta a campanha no painel → público do CRM (todos, sumidos, VIP) → e-mail na marca da Natura com descadastro de 1 clique; quem se descadastrou é filtrado.
  - Onde mora: `functions/api/coupons.js (campaign_send) · lib/unsub.js · só quando a dona dispara`
  - Como provar: Enviar campanha para a lista de teste e ver o descadastro funcionar.
- 🟡 **Datas especiais e temporada de presentes** (Pronto · depende do cliente)
  - Como funciona: Datas no calendário da Natura (Black Friday, festas de fim de ano, Dia dos Namorados, Dia das Mães) → e-mail com a oferta e o link do vale-presente; uma vez por data por cliente.
  - Onde mora: `functions/api/proactive.js (marketing_dates, kind holiday) · db/growth_dates.sql · relógio: 1×/dia às 13h UTC`
  - Como provar: Cadastrar uma data de teste para hoje na conta e2e-test e ver o e-mail na rodada das 13h.
- 🟡 **Fila de espera: um horário abriu** (Pronto · depende do cliente)
  - Como funciona: Cancelamento em qualquer lugar (Lilian, link da cliente ou balcão) → oferece a vaga a quem está na fila daquele serviço; só conta "oferecida" com comprovante de envio.
  - Onde mora: `functions/lib/filaDeEspera.js · na hora do cancelamento`
  - Como provar: Pôr uma cliente de teste na fila, cancelar o horário e ver a oferta sair.
- 🟡 **Apresentar as clientes de Astoria ao Med Spa** (Pronto · depende do cliente)
  - Como funciona: A dona escolhe de qual unidade para qual → conta o público (veio a uma, nunca foi à outra, sem descadastrados) → cria SÓ um rascunho; sai depois que a dona aprova a mensagem.
  - Onde mora: `functions/api/desk.js (publico_cruzado) · Balcão → Relatórios`
  - Como provar: Na conta de teste: Relatórios → Apresentar unidade → conferir a contagem e o rascunho.

**Checklist**

- [ ] Endereço físico no rodapé (lei CAN-SPAM) para as campanhas — _Natura_
- [ ] Ofertas de aniversário e "sentimos sua falta" aprovadas — _Natura_
- [ ] Exportação de clientes do MindBody (CSV) para a base inteira receber — _Natura_

### 🔵 SMS (texto) — Aguarda terceiro

Lembretes, acompanhamento e respostas por texto. O código está pronto; a operadora ainda não liberou.

**No contrato:** Parte 2 (pendente de terceiro): SMS para atender, marcar e acompanhar; promoções só com permissão.

**Rotas**

- `functions/lib/twilio.js (sendText)` — envio de texto
- `functions/lib/avisoPorTexto.js` — lembrete e confirmação por texto (acende com SMS_A2P_APROVADO=1)
- `functions/api/twilio-inbound.js` — texto que chega → mesma Lilian responde
- `functions/api/canais-prova.js` — janela do estado real do A2P (marca, campanha, motivo)

**Automações** (como funciona · onde mora · como provar)

- 🔵 **Responder texto recebido** (Aguarda terceiro)
  - Como funciona: Cliente manda SMS para o número → Twilio entrega em twilio-inbound → a MESMA Lilian responde e marca.
  - Onde mora: `functions/api/twilio-inbound.js · na hora`
  - Como provar: Depois da aprovação: mandar um SMS e ver a resposta com id da Twilio.
- 🔵 **Lembrete e confirmação por texto** (Aguarda terceiro)
  - Como funciona: Os mesmos gatilhos do e-mail (confirmação e lembrete 24h) mandam também por texto, com 'Reply STOP to opt out'.
  - Onde mora: `functions/lib/avisoPorTexto.js · acende com SMS_A2P_APROVADO=1`
  - Como provar: POST /api/sms-check responde ok com a campanha aprovada.
- 🔵 **Promoção por texto** (Aguarda terceiro)
  - Como funciona: Só para quem tem permissão registrada; a Natura aprova cada oferta. Para a Natura falar com as clientes DELA, o certo é marca própria da Natura na Twilio (ISV).
  - Onde mora: `functions/api/coupons.js · lib/twilio.js · só quando a dona dispara`
  - Como provar: —

**Checklist**

- [ ] Campanha A2P CM73eca1 já preenchida (13/10): Luis entra no console da Twilio e aperta Submit registration — _Luis_
- [ ] Marca da Natura na Twilio (ISV) para texto às clientes dela: precisa do EIN da Natura — _Natura_
- [ ] Aprovação da operadora (sem prazo) — _Terceiro_
- [ ] Ligar SMS_A2P_APROVADO=1 no Cloudflare e redeploy — _Guileo_

### 🔵 WhatsApp — Aguarda terceiro

A mesma Lilian no WhatsApp: responde, marca e lembra. A entrada funciona; a saída precisa de token permanente e número aprovado.

**No contrato:** Parte 2 (pendente de terceiro): WhatsApp para atender, marcar e acompanhar; cadastro a partir do WhatsApp.

**Rotas**

- `functions/api/whatsapp-cloud.js` — webhook de entrada e envio pela WhatsApp Cloud API
- `functions/api/whatsapp-connect.js` — conectar o número do negócio
- `functions/lib/whatsappAudio.js` — áudio recebido → texto
- `Modelos` — appointment_confirmation · appointment_request · appointment_reminder

**Automações** (como funciona · onde mora · como provar)

- 🔵 **Responder e marcar no WhatsApp** (Aguarda terceiro)
  - Como funciona: Cliente escreve (ou manda áudio) no WhatsApp da Natura → Meta entrega em whatsapp-cloud → áudio vira texto → a MESMA Lilian responde e marca.
  - Onde mora: `functions/api/whatsapp-cloud.js · lib/whatsappAudio.js · na hora`
  - Como provar: Mandar 'oi' ao número conectado e ver a resposta com id (wamid).
- 🔵 **Lembrete e confirmação por modelo aprovado** (Aguarda terceiro)
  - Como funciona: Fora da janela de 24h a Meta só aceita modelo aprovado → appointment_confirmation / appointment_reminder com o nome e o horário.
  - Onde mora: `functions/api/whatsapp-cloud.js · modelos na conta da Meta`
  - Como provar: Reserva de teste gera a mensagem do modelo com id.

**Checklist**

- [ ] Verificação da empresa na Meta (documento da Tribeca Global) — _Luis_
- [ ] Token permanente de Usuário do Sistema (o de 24h expirou) — _Luis_
- [ ] Número do Natura no WhatsApp Business + modelos aprovados — _Natura_
- [ ] Conectar via whatsapp-connect e provar uma mensagem com id — _Guileo_

### 🔵 Instagram e Facebook — Aguarda terceiro

Direct do Instagram e Messenger respondidos pela Lilian; comentário com palavra-chave vira direct; posts agendados.

**No contrato:** Parte 2 (pendente de terceiro): Instagram e Messenger para atender, marcar e acompanhar; cadastro a partir das redes.

**Rotas**

- `functions/api/meta-webhook.js` — DM do Instagram e Messenger → mesma Lilian
- `functions/api/meta-oauth-start.js · meta-oauth-callback.js · meta-connect.js` — conectar a Página e o Instagram do negócio (token por Página em meta_accounts)
- `functions/api/meta-comentarios.js · comentarios-varredura.js` — comentário → direct (Guileo Direct), varredura a cada 15 min
- `functions/api/social-publish.js` — posts agendados, com aprovação do dono
- `functions/api/manychat-reply.js · manychat-lead.js` — ponte ManyChat enquanto a Meta não libera

**Automações** (como funciona · onde mora · como provar)

- 🔵 **Responder DM do Instagram e Messenger** (Aguarda terceiro)
  - Como funciona: Cliente manda direct → Meta entrega em meta-webhook → a MESMA Lilian responde, marca e cria a ficha da cliente.
  - Onde mora: `functions/api/meta-webhook.js · token por Página em meta_accounts · na hora`
  - Como provar: Mandar um direct à conta conectada e ver a resposta com id.
- 🔵 **Comentário com palavra-chave → direct** (Aguarda terceiro)
  - Como funciona: Alguém comenta a palavra-chave no post ou reel → recebe o direct em segundos (+ resposta pública opcional) → a conversa segue com a Lilian. Freio anti-spam por pessoa e teto da Meta.
  - Onde mora: `functions/api/meta-comentarios.js · relógio: comentarios-varredura a cada 15 min pega o que o webhook perdeu`
  - Como provar: Comentar a palavra-chave num post de teste e receber o direct.
- 🔵 **Publicar posts agendados** (Aguarda terceiro)
  - Como funciona: Post escrito no tom da marca → a dona aprova → publica na hora marcada; reserva antes de enviar, nunca publica duas vezes.
  - Onde mora: `functions/api/social-publish.js · relógio: social-sweep a cada 15 min`
  - Como provar: Post de teste agendado aparece publicado com o id da Meta.

**Checklist**

- [ ] Verificação da empresa na Meta (documento da Tribeca Global) — _Luis_
- [ ] App Review: instagram_manage_messages e pages_messaging (acesso avançado) — _Luis_
- [ ] Acesso à Página e ao Instagram do Natura; Instagram amarrado à Página no Business Suite — _Natura_
- [ ] Conectar com meta-connect e provar uma DM respondida com id — _Guileo_

### 🟢 Google (avaliações e ficha) — No ar

Pedido de avaliação com o link certo de cada unidade já sai por e-mail. Responder avaliações e cuidar das fichas depende da API do Google.

**No contrato:** Parte 1: pedido de avaliação após cada visita, com o link da unidade certa. Parte 2: rascunho de resposta às avaliações, publicado só com aprovação.

**Rotas**

- `functions/api/review-link.js` — acha o link real de avaliação de cada unidade (perfil: review_links)
- `functions/api/proactive.js` — manda o pedido de avaliação 3h depois da visita
- `functions/api/google-business.js · google-oauth-start.js · google-oauth-callback.js · lib/googleGbp.js` — conectar as fichas do Google Business Profile
- `functions/api/review-responder.js` — rascunho de resposta, de hora em hora (inerte sem a API)

**Automações** (como funciona · onde mora · como provar)

- 🟢 **Pedido de avaliação a todas as clientes** (No ar)
  - Como funciona: O mesmo do e-mail: 3h depois da visita, link da ficha certa da unidade. Sem filtro de nota (filtrar é proibido pelo Google).
  - Onde mora: `functions/api/proactive.js · functions/api/review-link.js · relógio: a cada 15 min`
  - Como provar: O link de cada unidade abre a tela 'escrever avaliação' da ficha certa.
- 🔵 **Rascunho de resposta às avaliações** (Aguarda terceiro)
  - Como funciona: Avaliação nova na ficha → a Lilian escreve o rascunho → e-mail à Natura (reviewDraftsEmail) → nada é publicado sem a aprovação dela.
  - Onde mora: `functions/api/review-responder.js · lib/googleGbp.js · relógio: de hora em hora (inerte sem a API do Google)`
  - Como provar: Depois da aprovação do Google: avaliação de teste gera rascunho no e-mail.

**Checklist**

- [ ] Pedido de acesso à Google Business Profile API (projeto ainda não aprovado) — _Luis_
- [ ] Acesso às 3 fichas do Google do Natura — _Natura_

### ⚪ TikTok — Planejado

Responder mensagens, captar leads e marcar pelo TikTok. Hoje só o registro honesto: "depende do TikTok".

**No contrato:** Parte 4 (planejado, 180 dias após o Go-Live; crédito de US$ 333 se faltar no fim do contrato, salvo atraso do TikTok).

**Rotas**

- `functions/api/tiktok.js` — scaffold inerte {ready:false}; lê TIKTOK_APP_ID / TIKTOK_APP_SECRET

**Automações** (como funciona · onde mora · como provar)

- ⚪ **Responder mensagens e marcar no TikTok** (Planejado)
  - Como funciona: Planejado: mensagem no TikTok → webhook → MESMA Lilian. Hoje a rota só responde {ready:false}, de propósito.
  - Onde mora: `functions/api/tiktok.js · TIKTOK_APP_ID / TIKTOK_APP_SECRET`
  - Como provar: —

**Checklist**

- [ ] Conta TikTok for Developers da Guileo + app "Guileo AI" + produto Business Messaging — _Luis_
- [ ] Webhook de mensagens → mesmo cérebro do chat — _Guileo_

## Integrações

### 🟢 Painel da Natura e relatórios — No ar

A Central (guileoai.com/portal) e o Balcão: onde a Natura vê leads, conversas, agenda, relatórios e pede suporte. Os relatórios do balcão enchem conforme a recepção marca no Desk.

**No contrato:** Parte 1: cadastro automático, leads de hoje por canal, lista de acompanhamento, retorno com 1 toque, transcrição e áudio, aviso a cada venda, suporte no painel, relatório semanal e mensal, relatório por profissional. Parte 4: resumo da manhã, horários mais cheios, opinião por profissional, "alguém faltou".

**Rotas**

- `src/pages/Portal.jsx + src/portal/*` — a Central: Leads, Acompanhamento, Ligações, CRM, Relatórios
- `functions/api/crm.js` — cadastro único por cliente, lead e retorno com 1 toque (lead_callback → call.js)
- `functions/api/client-report.js · relatorio-mensal.js · resumo-manha.js` — relatórios semanal, mensal e resumo da manhã
- `functions/api/desk.js (reports, opinioes, absence_plan)` — relatórios do balcão e "alguém faltou"
- `functions/api/support.js` — suporte dentro do painel, a qualquer hora

**Automações** (como funciona · onde mora · como provar)

- 🟢 **Cada contato vira cadastro, um por cliente** (No ar)
  - Como funciona: Ligação, chat ou agendamento → o CRM junta pelo telefone ou e-mail numa ficha só, com histórico.
  - Onde mora: `functions/api/crm.js · elevenlabs-webhook.js · na hora`
  - Como provar: Ligar e depois conversar no chat com o mesmo número: uma ficha só.
- 🟢 **Leads de hoje, por canal, e lista de acompanhamento** (No ar)
  - Como funciona: Quem perguntou e não marcou, e quem está atrasada no ciclo, aparece na lista; um toque e a Lilian liga de volta pelo portão call.js.
  - Onde mora: `src/portal/LeadsToday.jsx · Followups.jsx · functions/api/crm.js (lead_callback)`
  - Como provar: Abrir /portal → Acompanhamento e tocar em retornar para um número de teste.
- 🟢 **Relatório semanal (segunda) e relatório mensal de valor** (No ar)
  - Como funciona: Segunda 13h UTC: ligações, agendamentos, leads e valor da semana para a dona. Dia 1: o mês anterior (opt-in).
  - Onde mora: `functions/api/client-report.js · relatorio-mensal.js · relógio: segunda e dias 1–7`
  - Como provar: /api/automacoes → client-report e relatorio-mensal.
- 🟡 **Resumo da manhã** (Pronto · depende do cliente)
  - Como funciona: Na hora local que a dona escolher (≈7h): agendamentos do dia e quem chamar. Desligado até a dona ligar.
  - Onde mora: `functions/api/resumo-manha.js · Balcão → Equipe → Avisos para você · relógio: de hora em hora`
  - Como provar: Ligar e tocar em "mandar um teste agora".
- 🟡 **Relatório por profissional, horários mais cheios e opinião por profissional** (Pronto · depende do cliente)
  - Como funciona: Ocupação, vendas, faltas e comentários das clientes por profissional e unidade. Enche com a agenda do Desk.
  - Onde mora: `functions/api/desk.js (reports, desk_reports_extra, desk_opinioes) · Balcão → Relatórios`
  - Como provar: Abrir Relatórios depois de uma semana de agenda real no Desk.
- 🟡 **Alguém faltou: avisar e remarcar as clientes do dia** (Pronto · depende do cliente)
  - Como funciona: Profissional falta → lista as clientes dela no dia e quem cobre no mesmo horário → a recepção escolhe passar, remarcar ou avisar.
  - Onde mora: `functions/api/desk.js (absence_plan, absence_notify) · Balcão → Agenda → 🤒`
  - Como provar: Na conta de teste: marcar falta de uma profissional e ver o plano.

**Checklist**

- [ ] Ligar o resumo da manhã (Balcão → Equipe → Avisos) — _Natura_
- [ ] Recepção passar a marcar no Desk para os relatórios do balcão encherem — _Natura_
- [ ] Mandar o aviso de entrega de cada item da Parte 4 (cláusula 2.6; texto pronto em NATURA-ADITIVO-E-MENSAGEM.md §C) — _Luis_

### 🟡 Agenda (Guileo Desk) — Pronto · depende do cliente

MindBody continua sendo a agenda oficial da Natura. A API foi recusada em 09/10, mas o suporte de API da MindBody (casos 05570560 e 05570562) se ofereceu em 15/10 para pedir a aprovação da conta da Guileo; resposta enviada. Até lá o Guileo Desk roda EM PARALELO e não liga nos botões do site sem o OK escrito da Origem.

**Rotas**

- `functions/api/desk.js + src/portal/Desk*.jsx` — balcão: agenda, caixa, clientes, equipe, relatórios, "alguém faltou"
- `db/desk_v*.sql · tabelas biz_*` — o motor de agenda (choque, capacidade, sinal, janela de cancelamento)
- `src/portal/DeskImportar.jsx` — importar clientes e agendamentos do MindBody (CSV)

**Checklist**

- [ ] Aditivo do contrato: Go-Live com "marcar no Guileo Desk" (rascunho em NATURA-ADITIVO-E-MENSAGEM.md) — _Luis_
- [ ] Exportação de clientes e agendamentos futuros do MindBody — _Natura_
- [ ] Aprovação da API pela MindBody (Christophe, suporte de API) e ativação dos 2 sites pela dona — _Terceiro_
- [ ] Se a MindBody não aprovar: a Natura decide a data da virada para o Desk — _Natura_

### 🟡 Pagamentos (Stripe do Natura) — Pronto · depende do cliente

Sinal, taxa de falta, vale-presente, pacote, produto e assinatura cobrados na conta do Natura. O dinheiro vai direto para o Natura.

**Rotas**

- `functions/lib/stripeDoNegocio.js · sinal.js` — cobrança no Stripe do negócio (chave restrita)
- `functions/api/loja-checkout.js · assinatura-checkout.js · giftcards.js · packages.js` — loja, assinatura, vale, pacote
- `functions/api/venda-paga.js · venda-online-reconcile.js · sinal-reconcile.js` — confirmação e conferência de hora em hora

**Checklist**

- [ ] Conta Stripe no nome do Natura + chave restrita colada em guileoai.com/receber — _Natura_
- [ ] Pagar um link em modo de teste para provar — _Guileo_

### ⚪ Sob pedido (Parte 5) — Planejado

Fora da entrega atual e com orçamento à parte: YouTube, vídeo curto das salas, da equipe e dos resultados, conteúdo e redes sociais (posts, reels, stories), e trabalho extra na loja além dos 50 produtos.

**No contrato:** Parte 5 (Future Items, on request).

**Rotas**

- `functions/api/criativo.js · lib/criativoFormatos.js` — motor de criativo (vídeo e imagem) já existe para a Guileo
- `functions/api/social-publish.js` — publicação de posts, a mesma do Instagram

**Checklist**

- [ ] Natura pedir o item e aprovar o orçamento — _Natura_
