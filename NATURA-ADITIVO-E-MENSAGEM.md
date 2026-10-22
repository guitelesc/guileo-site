# Natura — aditivo do contrato, mensagem ao dono e avisos de entrega (rascunhos, 2026-10-13)

Nada daqui foi enviado. Cada envio precisa do OK do Luis. O aditivo precisa de um advogado antes de ir.

## Por que precisa de aditivo
O contrato assinado em 08/10 (id c327a964…) define o **Go-Live** (cláusula 4.1) com "(c) booking into MindBody". O MindBody
recusou a API em 09/10 ("not subject to appeal"). Sem aditivo:
- o Go-Live nunca ocorre → a 2ª parcela (US$ 1.500) e o mês 1 não começam (5.1, 6.1);
- o Anexo A, Parte 1, diz "Bookings made straight into MindBody — live" e "Report by professional… needs MindBody connected — live": deixou de ser verdade;
- a cláusula 2.8(b) pede ao Natura "approve Provider as an integration in Client's MindBody sites" — impossível.
A saída já está no contrato: **8.3 Migration** ("Moving from MindBody to Guileo Desk is optional and happens only if both parties
agree in writing (email is enough)") e **2.4** (recusa de terceiro não é quebra). O aditivo é o "agree in writing".

## A) Aditivo nº 1 (rascunho para o advogado)
> **Amendment No. 1 to the Services Agreement** between ORIGEM LTDA d/b/a Guileo AI ("Provider") and Natura Spa NYC Inc. ("Client"), signed October 8, 2026.
>
> 1. **Background.** On October 9, 2026, Mindbody declined Provider's application for API access and stated the decision is not subject to appeal. Booking into Mindbody (clause 4.1(c)) is therefore not available through any third party, including Provider.
> 2. **Agenda of record.** Under clause 8.3, the parties agree in writing that Client's appointment agenda for the Services will be **Guileo Desk** (Provider's front-desk calendar), at all three Locations. Provider will import Client's clients and future appointments from Client's Mindbody exports at no cost (Annex A, Part 2 / clause 10.6 apply to exports and exit).
> 3. **Go-Live.** Clause 4.1(c) is replaced by: "(c) booking into Guileo Desk". All other elements of clause 4.1 are unchanged. Clause 2.8(b) is replaced by: "(b) provide Provider with Client's Mindbody client and appointment exports (CSV) and confirm the switchover date for the front desk".
> 4. **Annex A.** In Part 1, "Bookings made straight into MindBody" reads "Bookings made straight into Guileo Desk"; "Report by professional and by service… needs MindBody connected" reads "…needs the front desk booking in Guileo Desk". In Part 2, "Each customer record matched with that customer's client record in MindBody" is replaced by "…matched with the client record imported from Mindbody".
> 5. **Fees.** Unchanged. Nothing in this Amendment creates a new fee or a refund right.
> 6. **Everything else** in the Agreement stays as it is.
>
> Signed: ___ (Provider) ___ (Client) · Date: ___

## B) Mensagem ao dono do Natura (WhatsApp, PT) — manda junto com a mensagem da seção C do MINDBODY-RECUSA.md ou no lugar dela
> Oi! Preciso de 10 minutos seus para fechar duas coisas e a Lilian entrar 100%.
>
> **1. O MindBody.** Eles recusaram a conexão com a Guileo (decisão sem recurso). Isso trava uma cláusula do nosso contrato, a que define o "Go-Live" como "marcar no MindBody". Preparei um aditivo de uma página trocando por "marcar no Guileo Desk", que já está no contrato como opção (cláusula 8.3) e sem custo. Nada mais muda, preço incluso. Te mando para você olhar com calma (e com seu advogado, se quiser).
>
> **2. O que eu preciso de você para ligar o resto** — tudo que já está pronto do nosso lado:
> - Desviar as linhas principais para a Lilian (no teste: só quando ninguém atende).
> - Um número direto por unidade, para ela passar a ligação para uma pessoa.
> - A exportação de clientes do MindBody (Reports → Mailing Lists, CSV). Com isso ela reconhece toda a sua base e os lembretes de retorno começam.
> - Sua conta Stripe (ou a que você usar) no nome do Natura, para vale-presente, pacote e assinatura.
> - As ofertas de aniversário e "sentimos sua falta" do jeito que você quer.
> - O endereço físico que vai no rodapé dos e-mails (exigência da lei americana).
> - Acesso ao domínio naturaspanyc.com para o site novo entrar no ar.
> - Acesso ao Instagram, Facebook e às 3 fichas do Google (você continua dono de tudo).
> - Uma resposta por escrito: o Med Spa é "covered entity" pela HIPAA (fatura plano de saúde eletronicamente)? Precisa antes do Go-Live (cláusula 12.2).
>
> Me diz o melhor dia para a gente fazer isso junto numa chamada.

## C) Aviso de entrega (cláusula 2.6: "Provider will notify Client when each one is delivered") — e-mail EN, um por item, SÓ depois de provado na conta do Natura
> Subject: Delivered — [feature name]
>
> Hi Lilian, this is a short notice under clause 2.6 of our agreement: **[feature name]** is now delivered and live on your account as of [date]. [One line on where to see it / what it does.] From today it is a Live Feature under clause 6.5. If anything doesn't look right, reply here and we'll fix it.
>
> — Luis Teles, Guileo AI

Itens já prontos para esse aviso (ver NATURA-STATUS no fim de MINDBODY-RECUSA.md): resumo da manhã (opt-in na tela Equipe → Avisos),
horários mais cheios e opinião por profissional (Balcão → Relatórios), "alguém faltou" (Balcão → Agenda), acompanhamento de consulta
(automático), permissão para ofertas (página de agendamento + ficha da cliente).

## D) TikTok — o que depende do Luis
Mensagens de negócio no TikTok exigem um app no **TikTok for Business / TikTok for Developers** (conta da Guileo), com o escopo de
mensagens aprovado pelo TikTok. Sem isso o canal fica "depende do TikTok" na Central (linha pendente, nada ligado). Passos: criar a conta
de desenvolvedor, registrar o app "Guileo AI", pedir o produto "Business Messaging", colar `TIKTOK_APP_ID` / `TIKTOK_APP_SECRET` no Cloudflare.
