# Acessos para a equipe técnica e pedidos ao Natura (16/10/2026)

Regra: **acesso por convite, com o nome de cada pessoa. Nenhuma senha, token ou chave vai por e-mail, WhatsApp ou chat.**
Convite dá para revogar de uma pessoa só, deixa registro de quem fez o quê e não expõe a sua conta inteira.
(A página dos canais já diz isso aos desenvolvedores: "Named access only".)

---

## A) Como dar cada acesso (você faz, clique a clique)

Antes: peça o **nome e o e-mail de cada pessoa** que vai trabalhar. Um convite por pessoa.

| Pedido deles | O que você faz | Papel certo | O que NÃO mandar |
|---|---|---|---|
| **Supabase** | supabase.com → organização da Guileo → **Team → Invite member** | **Developer** (ou Read-only para começar) | A senha da sua conta, a senha do banco, a chave `service_role` |
| **GitHub / código** | github.com/guitelesc/guileo-site → **Settings → Collaborators → Add people** | **Write** (nunca Admin). Eles abrem pull request; o deploy continua com você | Seu login do GitHub |
| **Plataforma de voz (ElevenLabs)** | elevenlabs.io → **Workspace → Members → Invite**, se o seu plano tiver vaga de membro | Membro do workspace. Mexem só no agente de **teste**; a Lilian ao vivo só muda pela ROTA-AGENTE | O login luxuryunmaskedyt@gmail.com. Se o plano não tiver vaga, suba o plano em vez de passar a senha |
| **Twilio** | console.twilio.com → **Admin → Manage users → Invite user** | **Developer** (não Administrator, não Billing) | Account SID + Auth Token: o Auth Token controla a conta inteira, inclusive saldo (já houve fraude IRSF em 09/2026) |
| **CRM (a Central da Guileo)** | guileoai.com/**admin/parceiros** → criar um parceiro por pessoa, marcando só o Natura e a conta de teste | Parceiro nominal: entra em guileoai.com/parceiro/entrar com e-mail + senha + código de 6 dígitos | A senha do /admin, a chave de conexão do Natura |
| **Mindbody** | **Não é seu para dar.** É a conta do Natura. O dono cria um login de funcionário para cada pessoa (seção C, item 4) | Staff com permissão limitada (agenda e clientes, sem financeiro) | O login de dono do Natura |

Opcional, só se forem publicar o site: **Cloudflare → Manage account → Members → Invite**, papel com acesso a Pages. Hoje o deploy é seu; dá para deixar assim no começo.

Quando alguém sair do projeto: revogue nas 6 telas acima (o mesmo lugar onde convidou).

---

## B) Resposta para a equipe técnica (EN, pronta para colar)

> Hi team,
>
> Thanks for the list. We give access by named invite only — no shared passwords, tokens or keys by email or chat. Please send me the **full name and work email of each person** who needs access, and I'll invite each one:
>
> - **Supabase:** invite to the Guileo organization (Developer role).
> - **GitHub:** collaborator on guitelesc/guileo-site (Write role). Please work in branches and open pull requests; deploys stay with us for now.
> - **ElevenLabs (voice):** workspace member. Work on the TEST agent only; changes reach Natura's live agent only through ROTA-AGENTE (freeze → test agent → 17/17 → we promote).
> - **Twilio:** user invite with the Developer role. We don't share the Account SID / Auth Token.
> - **CRM (Guileo Central):** a named partner login per person at guileoai.com/parceiro/entrar (email + password + 6-digit code), scoped to Natura and the test account.
> - **Mindbody:** that is Natura's account. Natura's owner will create a staff login for each of you with limited permissions; I'm requesting it now.
>
> Everything you need to start is in the channel map: https://claude.ai/artifact/41NhmBUCuL8K3H6myM5YDM — please build and test on e2e-test@guileoai.com first.
>
> Best,
> Luis

---

## C) Pedido ao Natura (WhatsApp, PT, pronto para colar)

> Oi! Para a Lilian entrar 100% e a gente chegar no Go-Live, preciso de algumas coisas suas. Separei por prioridade.
>
> **Para o Go-Live (até 29/10):**
> 1. **Desviar as linhas principais para a Lilian.** No teste, só quando ninguém atende. Te mando o passo a passo de cada linha.
> 2. **Um número direto por unidade** (Astoria, Upper East Side e Med Spa), para a Lilian passar a ligação para uma pessoa.
> 3. **Exportação do MindBody em planilha:** a lista de clientes (Reports → Mailing Lists, com nome, e-mail, telefones e aniversário) e os agendamentos futuros. Com isso a Lilian reconhece toda a sua base pelo nome.
> 4. **Um login de funcionário no MindBody para cada pessoa da nossa equipe técnica**, com permissão só de agenda e clientes (sem financeiro). Não precisa passar o seu login de dono. Te mando os nomes e e-mails.
> 5. **Conferir a lista de serviços, preços e horários** das três unidades no site novo. Te mando a lista para você marcar o que mudou.
> 6. **Uma resposta por escrito sobre o Med Spa:** ele fatura plano de saúde eletronicamente (é "covered entity" pela HIPAA)? O contrato pede isso antes do Go-Live (cláusula 12.2).
> 7. **O aditivo de uma página do contrato**, sobre a agenda. Te mando para você olhar, e com seu advogado se quiser.
>
> **Para ligar o resto:**
> 8. **Acesso ao domínio naturaspanyc.com** (quem cuida do site hoje ou o login do registrador), para o site novo entrar no ar.
> 9. **Uma conta Stripe no nome do Natura**, para vale-presente, pacotes, produtos e assinatura. O dinheiro cai direto para vocês.
> 10. **O endereço físico** que vai no rodapé dos e-mails (exigência da lei americana para campanhas).
> 11. **As ofertas de aniversário e de "sentimos sua falta"** do jeito que você quer.
> 12. **Acesso de parceiro à Página do Facebook e ao Instagram do Natura** (pelo Business Suite), com o Instagram ligado à Página.
> 13. **O número de WhatsApp Business** que vocês querem usar.
> 14. **Acesso de gerente às 3 fichas do Google** (Astoria, Upper East Side e Med Spa).
> 15. **O EIN do Natura**, para registrar a marca de vocês para mensagens de texto às clientes.
>
> Se for mais fácil, a gente faz tudo junto numa chamada de 30 minutos. Qual o melhor dia?
