# 🔑 ATIVAÇÕES — o runbook das chaves (o que o Luis liga pra faturar)

> **Painel VIVO no cockpit:** `/admin` → BROTO → aba **🔑 Ativações** mostra o estado real de cada
> chave (ligada/apagada/verificar-no-provedor), lido do ambiente em tempo real via
> `/api/broto action:"activations"` (só presença, nunca o valor). Este .md é a fonte técnica; o painel
> é a versão de uso. Mantenha os dois em sync (a lista de chaves espelha `ACTIV_KEYS` em `src/components/Broto.jsx`).
>
> O produto está construído e **inerte-que-acende-sozinho**: cada chave abaixo liga um motor inteiro
> que já está no código. Este é o guia clique-a-clique. Legenda: ✅ já aceso · 🖱️ falta seu clique.
>
> **ONDE se seta QUALQUER env var:** Cloudflare → **Workers & Pages → guileoai → Settings →
> Variables and Secrets → Production → Add** (marque **Secret** pra chaves sensíveis) → **Save**.
> ⚠️ **Env var novo só vale depois de um REDEPLOY.** Fluxo: você seta a var → me avisa → eu faço o
> deploy e **provo que acendeu** (o curl de prova de cada seção). Não precisa me passar o valor.

---

## 🎯 Prioridade (por impacto no dinheiro)

| # | Chave | Liga | Esforço | Estado |
|---|---|---|---|---|
| 1 | **Stripe Connect** | o "fecha & cobra" COLETA de verdade (dinheiro na conta do cliente) | médio | 🖱️ |
| 2 | **A2P 10DLC** (Twilio) | SMS: survey, aviso do dono, missed-call text-back | médio (aprovação) | 🖱️ |
| 3 | **WhatsApp** (Meta ou Twilio) | WhatsApp + Instagram DM da Gui | médio | 🖱️ |
| 4 | **Google Business** | pedir+responder review no Google, SEO local | médio | 🖱️ |
| 5 | **MindBody** (Natura) | agenda que a Natura já usa | baixo (chave) | 🖱️ |
| 6 | **VOICE_COST_CENTS_PER_MIN** | margem real no unit-economics | 1 minuto | 🖱️ |
| 7 | **DUNNING_ENFORCE=1** | pausa automática do inadimplente | 1 minuto | 🖱️ |
| 8 | **Mercado Pago** (BR) | PIX/cartão no Brasil | baixo | ⚠️ conferir nome da var |

Já acesos (confirme, não mexa): `DIGEST_TOKEN` ✅, `STRIPE_SECRET_KEY` ✅, `ELEVENLABS_API_KEY` ✅,
`RESEND_API_KEY` ✅, `INGEST_SECRET` ✅. (Por isso voz, pagamentos de plano, emails e o cron já rodam.)

---

## 1. 💳 Stripe Connect — coletar o dinheiro DO cliente (o #1)
**O que acende:** hoje a Gui fecha na ligação mas o "close & collect" só manda link se o cliente tiver
uma conta Stripe conectada — sem isso ela é honesta e não promete link (`honestNoLink`). Com Connect,
o pagamento cai na conta do PRÓPRIO cliente (não na Guileo).
**Onde clicar:** siga o **`db/STRIPE_SETUP.md`** (já existe, detalhado) — produtos/preços por centavo,
os 5 eventos de webhook, e a estratégia Connect. Para Connect: Dashboard Stripe → **Connect → Get started**
(escolha **Express** = o cliente conecta a conta dele em 1 clique via onboarding). O `client_stripe_lookup`
(db/stripe_connect.sql) já lê a conta conectada por `client_email`.
**Env var:** `STRIPE_SECRET_KEY` ✅ (já setado — o `/api/stripe-connect` responde `401` com Origin, não `503`, confirmando a chave presente) · `STRIPE_WEBHOOK_SECRET` (confira nos 5 eventos do STRIPE_SETUP.md).
**Botão do cliente (self-serve):** card **"Receber pagamentos (Stripe)"** na aba Integrações do portal + página dedicada `/receber` → `POST /api/stripe-connect action:link` → cria a conta Express e abre o onboarding da Stripe.
**⚠️ REALIDADE (2026-07-24, testado com o Luis no dashboard):** ligar o Connect NÃO é 1 clique — o Stripe exige o **onboarding COMPLETO da plataforma** (KYC): dados da empresa (CNPJ/EIN + endereço + ramo), dados bancários, verificação de identidade do responsável, e aceitar os termos do Connect. É o checklist "Implementar no modo de produção" do Guia de configuração. Só o Luis faz (identidade legal da empresa + docs). Conta usada = **Med Mundo Brasil** `acct_1Tbm3wE0fF3QBRot` (BRL) — Luis confirmou que é a MESMA conta da STRIPE_SECRET_KEY do Cloudflare. NÃO-BLOQUEANTE: sem Connect, o close&collect fica honesto (honestNoLink), nada quebra; fazer o KYC quando for cobrar pro 1º cliente real.
**Prova (2026-07-24):** persistência provada round-trip — `set_client_stripe(...,'acct_TESTPROBE',true)` → `client_stripe_lookup` devolve `{account_id:acct_TESTPROBE, charges_enabled:true}` (limpo depois); segredo errado → `RAISE unauthorized` (portão). Depois de um cliente real conectar, o mesmo lookup retorna a conta `acct_…` dele e o `do_action invoice` gera link real em vez de `honestNoLink`.

## 2. 📱 A2P 10DLC — ligar SMS nos EUA
**O que acende:** SMS hoje é BLOQUEADO (erro 30034) até registrar. Libera: survey por SMS, aviso do dono
por SMS, missed-call text-back. **Não é env var** — é registro no console da Twilio.
**Onde clicar:** Twilio Console → **Messaging → Regulatory Compliance → A2P 10DLC** → registrar Brand +
Campaign (use a marca "Guileo"/ORIGEM LTDA). Aprovação leva alguns dias.
**Env var:** nenhuma nova — `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM` já estão setados; o SMS
liga sozinho quando a campanha for aprovada.
**Prova:** eu mando um SMS de teste pelo caminho existente e confiro que sai sem erro 30034.

## 3. 💬 WhatsApp + Instagram DM
**O que acende:** a Gui responde WhatsApp e IG DM (mesmo cérebro do webchat). Dois caminhos — escolha 1:
- **Meta Cloud API (recomendado, não depende de A2P):** Meta for Developers → criar App → WhatsApp +
  Messenger. **Env vars:** `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `WHATSAPP_VERIFY_TOKEN`,
  `WHATSAPP_APP_SECRET`. Webhook callback: `https://guileoai.com/api/meta-webhook` e `/api/whatsapp-cloud`.
- **Twilio WhatsApp:** `TWILIO_WHATSAPP_FROM`. Mais simples, mas passa pela política da Twilio.
**Prova:** o `/api/meta-webhook` valida a assinatura HMAC (hoje responde 403 sem app configurado);
com o app, um DM de teste chega no CRM e a Gui responde.

## 4. 🔵 Google Business (reviews + SEO local)
**O que acende:** a Gui pede review pós-visita e RESPONDE reviews no Google; GBP para SEO local.
**Onde clicar (3 passos, só você):**
  1. **Google Cloud Console** → APIs & Services → habilitar *Business Profile API* (aprovação do Google por projeto, leva dias).
  2. **Credentials → criar OAuth 2.0 Client (Web)** → em *Authorized redirect URIs* cole EXATAMENTE:
     `https://guileoai.com/api/google-oauth-callback`
  3. **Cloudflare env vars:** `GOOGLE_BUSINESS_CLIENT_ID`, `GOOGLE_BUSINESS_CLIENT_SECRET` (opcional `GOOGLE_BUSINESS_REDIRECT` se um dia mudar o domínio do callback).
**Como o cliente conecta (self-serve, já construído):** botão no cockpit → `POST /api/google-oauth-start` (gated email↔chave) → devolve a URL de consentimento do Google → cliente autoriza → `GET /api/google-oauth-callback` troca o code por `refresh_token` e guarda por-tenant (`store_integration` provider `google_business`). State opaco no banco (`db/google_oauth.sql`: `gbp_oauth_begin`/`gbp_oauth_claim`, uso-único, TTL 10min) — segredo nunca viaja na URL.
**Prova (hoje, sem a chave — honesto-inerte):** `start` sem credencial → **401**; `callback` com state falso → **302** `/portal?google=error&reason=invalid_state`. Depois da chave: `start` de um tenant válido devolve `ready:true`+`url`; ao conectar, `/api/google-business` sai de `ready:false` e o cron `review-responder` responde reviews reais.

## 5. 📅 MindBody (a agenda da Natura)
**O que acende:** a Gui agenda direto no MindBody que a Natura já usa (adapter já pronto: mindbody > square > vagaro > interno).
**Onde clicar:** MindBody Developer Portal → gerar API key da conta da Natura.
**Env var:** `MINDBODY_API_KEY` (+ credenciais por-cliente em `client_integrations`, provider `mindbody`).
**Prova:** `scheduleAdapter` resolve `mindbody` como source-of-truth; um `op=availability` retorna horários reais do MindBody.

## 6. 💰 VOICE_COST_CENTS_PER_MIN — margem real (1 minuto)
**O que acende:** o custo de voz entra no unit-economics → margem por cliente deixa de ser "parcial".
**Onde clicar:** Cloudflare → env var `VOICE_COST_CENTS_PER_MIN` = a tarifa real por minuto do ElevenLabs em **centavos** (ex.: `9` = US$0,09/min).
**Prova:** hoje `providers_wired: []`, `partial: true`. Depois de setar + uma ligação, `/api/unit-economics` mostra `elevenlabs` em providers_wired e a margem real.

## 7. ⏸️ DUNNING_ENFORCE=1 — pausar o inadimplente (1 minuto)
**O que acende:** o grace-period sai do dry-run e passa a PAUSAR de verdade o agente de quem não paga (reversível no próximo pagamento — construído e revisado hoje).
**Onde clicar:** Cloudflare → env var `DUNNING_ENFORCE` = `1`.
**Prova:** `/api/dunning-sweep?token=<DIGEST>` deixa de dizer "wouldDo" e passa a `paused_flag:true` no estágio 2 (claim 7d).

## 8. 💚 Mercado Pago (BR)
**O que acende:** PIX/cartão no Brasil (webhook `/api/mercadopago-webhook` já vivo: valor ancorado, idempotência tripla, refund com deduct).
**Env vars:** `MP_ACCESS_TOKEN` (o webhook aceita `MP_ACCESS_TOKEN` **ou** `MERCADOPAGO_TOKEN` — qualquer um dos dois liga) + `MP_WEBHOOK_SECRET` (separado, valida a assinatura x-signature). No painel do Mercado Pago aponte a notificação pra `https://guileoai.com/api/mercadopago-webhook`.
**Prova:** `/api/mercadopago-webhook` sai de `ready:false`; um pagamento de teste credita pelo mapa BRL exato (R$799→500, R$2.499→2.000, R$5.499→6.000).

---

## Fluxo de trabalho comigo
1. Você seta a env var (ou faz o clique no dashboard do provedor).
2. Me avisa qual ligou.
3. Eu faço o **redeploy** (env vars novas exigem) e rodo o **curl de prova** da seção → confirmo que acendeu (ou aponto o que faltou).

*Cada motor tem UMA chave clara. O sistema fica honesto e inerte até você tê-la — nunca finge estar ligado.*

## 9. 🔐 SUPABASE_SERVICE_ROLE — ✅ JÁ COLADA (2026-08-04) — falta só revogar o anon
> **ESTADO REAL:** o segredo **já está no Cloudflare** (`wrangler pages secret list` mostra `SUPABASE_SERVICE_ROLE: Value Encrypted`), e as RPCs novas (`provision_claim`, `client_agents_numbers`, `client_number_for`, `provision_settle`) já são **service_role-only** e funcionam em prod. Os PASSOS A e B abaixo estão **feitos** — sobra o `revoke execute ... from anon` nas RPCs dual-uso antigas.
>
> *(Esta seção dizia "pendente" até 2026-08-04 e induziu um revisor a concluir que o provisionamento inteiro fail-openava em prod. Runbook desatualizado é armadilha: quando uma chave acender, marque aqui no mesmo dia.)*

**O que acende:** fecha o vazamento cross-tenant nas funções DUAL-USO (agente/webhooks chamam sem chave de cliente: `crm_upsert_contact`, `ingest_client_event`, `crm_caller_context`, `package_list`, `noshow_risk`, `support_ticket_list`) + o /admin. As 8 funções SÓ-do-portal já foram blindadas (chave verificada por dentro; ver db/hardening_dataplane.sql). Faltam essas.
**PASSO A (copiar):** Supabase → projeto `ynihodbknhjirkdogxby` → ⚙️ Project Settings → **API** → "Project API keys" → linha **`service_role` (secret)** → Reveal → Copy.
**PASSO B (colar):** Cloudflare → Workers & Pages → guileoai → Settings → Variables and Secrets → **Production** → Add → nome **`SUPABASE_SERVICE_ROLE`**, valor = a chave, marcar **Secret** → Save.
**Depois (Claude faz):** troca os Workers dual-uso pra chamar com a service_role (server-only, nunca vai pro bundle) → `revoke execute ... from anon` nessas RPCs → o literal commitado + a anon JWT viram inúteis. Deploy + prova (curl direto com o literal → agora 401/permission denied).

---

## 10. 💵 GUILEO_FEE_PCT = 0 — DECISÃO, não esquecimento (2026-08-10)

**Luis decidiu: a Guileo NÃO tira porcentagem das cobranças do cliente.** A receita vem da
mensalidade. Mais simples de vender e nada a explicar na hora do fechamento.

⚠️ **NÃO "conserte" isto pondo um número.** O valor está gravado como `0` de propósito. Ausente e
zero se comportam igual hoje, mas significam o oposto: ausente é "ninguém decidiu", zero é "foi
decidido". Se um dia mudar, muda com o Luis — nunca por dedução de quem achou o campo vazio.

Onde age: `functions/api/agent-action.js` → `application_fee_percent` / `application_fee_amount`
no link de pagamento, só em cliente CONECTADO (nunca na conta-dona).

## 11. 🛡️ MAX_CHARGE_USD = 10000 — teto de segurança (2026-08-10, aplicado pelo Claude)

**Vale $5.000.** Uma variável, três caminhos, e os padrões eram DIFERENTES:

| caminho | quem dispara | padrão se ausente |
|---|---|---|
| `agent-action.js` invoice/deposit | a AGENTE, na ligação | **5.000** |
| `packages.js` | humano comprando pacote | 100.000 |
| `twilio-pay.js` | cartão no telefone | 100.000 |

Na primeira tentativa pus $10.000 achando que subia o piso de segurança dos três. Baixou dois e
**DOBROU o mais perigoso** — justo o que a AI opera, cujo comentário no código diz por que o limite
é apertado: *"um preço mal ouvido deve ser recusado, não cobrado"*.

$5.000 restaura o valor projetado do caminho da agente e ainda derruba os outros dois de 100k.
Só sobe com decisão do Luis, e sabendo que sobe para os TRÊS.

---

# NATURA · o que só o Luis e a Natura fazem (2026-09-30)
O código está no ar e espera estas liberações. Ordem pensada para destravar o que dá mais resultado primeiro. Depois de cada passo, peça a prova indicada.

## Do Luis (contas da Guileo)
| # | O que | Onde | Por que destrava | Prova depois |
|---|---|---|---|---|
| 1 | **MindBody: RECUSADO em 09/10/2026** (empresa GUILEO AI, "not subject to appeal"; ver MINDBODY-RECUSA.md). Antes: pedir o "Go Live" da conta de desenvolvedor | developers.mindbodyonline.com → sua conta → Go Live | Hoje a API recusa gerar o link de ativação dos sites da Natura ("You do not have access to the siteId specified"). Sem o Go Live só o sandbox funciona. | `POST /api/mindbody {action:"activation", site_id:"767008"}` devolve `link` |
| 2 | **SMS: campanha A2P 10DLC** aprovada | Twilio Console → Messaging → Regulatory Compliance | Confirmação e lembrete por SMS para quem não deu e-mail | pôr `SMS_A2P_APROVADO=1` no Cloudflare + redeploy; lembrete de teste sai com `sid` |
| 3 | **Google Business Profile API**: pedir acesso e criar o cliente OAuth | Google Cloud Console → o projeto da Guileo | Ler e responder avaliações das 3 fichas | pôr `GOOGLE_BUSINESS_CLIENT_ID/SECRET` no Cloudflare; a tela Google mostra as fichas |
| 4 | **Meta**: app aprovado para `pages_messaging` e `instagram_manage_messages`; modelos do WhatsApp | developers.facebook.com → o app da Guileo | Instagram/Facebook/WhatsApp da Natura | DM de teste respondida; modelos `appointment_confirmation`, `appointment_request`, `appointment_reminder` (texto na ROTA-TEXTO) |
| 5 | **Stripe**: confirmar o PAÍS da conta da plataforma | Stripe Dashboard → Settings → Business | Se for brasileira, o Stripe pode recusar a conta americana da Natura | a Natura clica "Receber pagamentos" e o onboarding abre |
| 6 | **Cloudflare**: adicionar `www.naturaspanyc.com` e `naturaspanyc.com` como domínio do projeto | Pages → guileoai → Custom domains | Publicar o site no domínio dela | abrir o domínio no navegador |

## Da Natura (a dona clica; ninguém faz por ela)
| # | O que | Como | Depende de |
|---|---|---|---|
| A | **Encaminhar a linha** (718) 956-5530 para +1 929 828 8170 | na operadora (`*72` + número, ou o painel do VoIP) | nada — pode ser hoje |
| B | **Um número DIRETO da recepção** de cada unidade, que NÃO encaminhe para a agente | informar ao Luis | nada |
| C | **Aprovar o acesso no MindBody** | abrir o link de ativação de cada site, logada como dona | passo 1 do Luis |
| D | **Conectar o Google** | Central → Google → "Connect" | passo 3 do Luis |
| E | **Conectar Instagram/Facebook/WhatsApp** | hoje só pelo `/admin`, com ela logada na Meta ao lado do Luis | passo 4 do Luis |
| F | **Abrir a conta de pagamento** | Central → Integrations → "Receber pagamentos" | passo 5 do Luis |
| G | **DNS do domínio**: `CNAME www → guileoai.pages.dev` | no registrador do domínio | passo 6 do Luis |
| H | **Conferir na Central**: prazos de volta (já aplicados), ligar o aniversário e escrever a mensagem, cadastrar produtos, confirmar os preços | Central → Dates & Birthdays / Retail products / Catalog | nada |

## Testes por telefone (o Luis liga; fazer ANTES do passo A)
Enquanto a linha não for encaminhada não existe cliente de verdade na conta — os testes podem ser escondidos do painel da dona movendo a data de entrada em operação. Depois do passo A isso esconderia clientes reais: aí o teste passa a ser na linha de demonstração.
1. Ligar do seu número para +1 929 828 8170 → ela atende dizendo o seu nome.
2. Marcar um facial em Astoria, dar o e-mail → chega a confirmação com endereço e o link "quando é o seu aniversário?".
3. Perguntar por Botox → ela oferece a consulta grátis do Med Spa, não diz "não temos".
4. Falar uma frase inteira em português ou espanhol → ela troca de idioma; uma palavra solta não troca.
5. Pedir para falar com uma pessoa → hoje ela anota o recado e avisa a dona (a transferência só existe depois do passo B).
6. No site (`guileoai.com/novo/natura-spa` → Chat): escrever o seu telefone → ela cumprimenta pelo nome e lembra da conversa.
Depois: avisar, para a conferência das transcrições e para esconder os testes.

## O que não tem dono técnico
- **Dados de saúde do Med Spa** (ficha, histórico de procedimento): decisão de advogado. Perguntas a levar: o Med Spa é "covered entity" (fatura plano de saúde por meio eletrônico)? as gravações e transcrições de ligação em que a cliente cita um procedimento podem ficar com os fornecedores atuais (ElevenLabs, Twilio, Supabase, Cloudflare, Anthropic, Resend) sem contrato específico? por quanto tempo guardar? Hoje o sistema guarda: nome, telefone, e-mail, serviço agendado, transcrição da ligação e o resumo — nada de ficha clínica.
- **Primeiro lugar no Google**: não se garante. O que está feito: dados de negócio local por unidade, página por unidade, pedido de avaliação após cada visita. O que pesa e depende dela: responder avaliações, fotos e posts na ficha, e o site no domínio próprio.
- **Plantão**: os alarmes automáticos avisam o Luis (semáforo do cron, saldo da voz, canário do chat). Ninguém conserta de madrugada.

## NATURA · Stripe próprio para o SINAL (2026-10-05)
**Por quê não o "Conectar Stripe":** a conta Stripe da plataforma é **BR** (Origem, live) e o Stripe só repassa entre países a partir de plataformas dos EUA/UK/EEA/CA/CH (docs.stripe.com/connect/cross-border-payouts). O Natura (EUA) não pode receber por ela — o `/api/stripe-connect` agora recusa com `use_own_stripe` antes de criar qualquer conta.
**O que a dona do Natura faz (só ela — é a conta dela):**
1. Ter uma conta Stripe dos EUA no nome do Natura (se não tiver, criar em stripe.com com os dados da empresa e a conta bancária).
2. Stripe → Developers → API keys → **Create restricted key** → em **Checkout Sessions: Write** (opcional: **Account: Read**). Só para o sinal, basta isso; para cartão salvo, taxa de falta e assinatura, ver a tabela de permissões logo abaixo.
3. Abrir **guileoai.com/receber**, preencher o e-mail `naturaspaadm@gmail.com` e o código de conexão, colar a chave `rk_live_…` em "Business in the US? Use your own Stripe account" → **Connect my account**. O servidor testa a chave no Stripe antes de guardar.
**O que acende:** o link do sinal que a Lilian manda depois de marcar e o botão do Balcão (16 serviços com sinal cadastrado). O pagamento confirma na volta da cliente (`/api/sinal-pago`) e na conferência de hora em hora (`/api/sinal-reconcile`, no cron).
**Também acende com a mesma chave (2026-10-05):** venda online de pacote, vale-presente (com e-mail do código para quem ganha e cópia para quem comprou) e assinatura, a loja do site (`loja-checkout.js` → `venda-paga.js`, conferência horária em `venda-online-reconcile`) e o sinal no agendamento pelo site (`/agendar` mostra o botão do sinal na confirmação). A loja do Natura continua desligada (`LOJA.aoVivo = false`) até a dona decidir.
**O que NÃO acende:** estorno no Stripe próprio não avisa ninguém (não há webhook dessa conta) — produto da loja estornado volta ao estoque à mão.
**Prova:** marcar pelo Balcão um serviço com sinal → "Mandar para a cliente" para um e-mail seu → pagar com cartão de teste se a chave for `rk_test_` (ou US$ 20 reais e estornar) → o cartão da agenda mostra ◆ "Sinal pago".

### Cartão salvo, taxa de falta e assinatura da cliente (2026-10-05, no código, NÃO no ar)
Mesma chave restrita do Natura, com **mais permissões**. No Stripe: Developers → API keys → na chave restrita do Guileo → **Edit** (ou criar uma nova e colar de novo em guileoai.com/receber) e marcar:

| Permissão (nome exato no painel do Stripe) | Para quê |
|---|---|
| **Checkout Sessions: Write** | sinal, "Salvar cartão" (Checkout `mode=setup`) e "Vender assinatura" (`mode=subscription`); ler a sessão na volta |
| **Charges: Read** (2026-10-05) | perceber ESTORNO feito no Stripe do negócio (loja volta o estoque; pacote/vale vira aviso no feed). Sem ela: um aviso pedindo para marcar, e nenhum estorno é presumido |
| **Customers: Write** | criar o cliente no Stripe ao salvar o cartão; reaproveitar o cliente no sinal e na assinatura |
| **PaymentIntents: Write** | cobrar a **taxa de falta** e a **taxa de cancelamento em cima da hora** fora da sessão (`off_session`); ler o pagamento do sinal para guardar o cartão |
| **SetupIntents: Write** | ler o cartão que a cliente cadastrou em "Salvar cartão" |
| **PaymentMethods: Read** | bandeira e 4 últimos dígitos do cartão salvo |
| **Subscriptions: Read** | conferir a assinatura na volta e guardar o cartão dela; **conferência de hora em hora** do status (cancelada / pagamento atrasado) |
| (opcional) **Account: Read** | nome da conta na tela de conexão |

Se faltar alguma, o Balcão diz **qual** (motivo `permission_missing` + o nome da tabela acima, lido da resposta 403 do Stripe). Uma chave antiga só com Checkout Sessions continua mandando o sinal — só não guarda o cartão.

**O que acende (Central → Operações → Balcão → Caixa, bloco "Pagamento online (seu Stripe)"):**
- **Salvar cartão** → link do Stripe para a recepção COPIAR e mandar (não existe modelo de texto/e-mail para esse link; a tela não diz "enviado"). Quando a cliente termina, a volta (`/api/sinal-pago`) grava bandeira/final na ficha (`desk_saved_cards`). O **sinal** também passa a salvar o cartão (o Checkout mostra à cliente o aviso de uso futuro).
- **Cobrar taxa de falta** → aparece no caixa aberto de um agendamento marcado como **falta**; valor = "taxa de falta" do serviço (Equipe → Serviços); cobra o cartão salvo, uma vez por agendamento (Idempotency-Key agendamento+cartão); grava em `attributes.noshow_fee` e no feed ("💳 Taxa de falta cobrada / NÃO cobrada"). Recusa do banco aparece com a frase do banco.
- **Vender assinatura** → escolhe uma assinatura cadastrada em Receita recorrente → link do Stripe (mensal/anual) para copiar; a volta grava em `membership_subscribers` e no feed ("⭐ Nova assinatura").
- **Cobrar taxa de cancelamento** (v6, `db/desk_v6_cancelamento.sql`) → no caixa aberto de um agendamento **cancelado**, a tela mostra "Cancelou 5 h antes do horário · pelo balcão · dentro da janela de 24 h do serviço". Só cobra se o cancelamento caiu DENTRO da janela de cancelamento do serviço (Equipe → Serviços → janela, `cancel_window_h`). **Valor = a MESMA taxa de falta do serviço** — o cadastro não tem um campo próprio para taxa de cancelamento (a tela diz isso). Mesmas regras da taxa de falta: cartão salvo, uma vez por agendamento (Idempotency-Key própria, `desk-latecancel-…`), grava em `attributes.late_cancel_fee` e no feed. Motivos honestos: `not_late_cancel` (fora da janela / serviço sem janela / reserva provisória que venceu), `cancel_time_unknown` (cancelado antes de 05/10/2026, quando o banco começou a guardar a hora), `noshow_fee_charged`, `no_saved_card`, `payments_not_connected`, `card_declined`, `permission_missing`.
  - A hora vem de um gatilho em `biz_appointments` (`attributes.cancelled_at` + `cancelled_by`: cliente · balcao · ia · expirou · desconhecido). O link da reserva grava "cliente"; o balcão é deduzido da marca `desk_status_at`; **a IA ao telefone fica "desconhecido"** (o `agent-schedule.js` ainda não diz quem cancelou). Observação: a cliente nunca cancela "em cima da hora" pelo link — dentro da janela o link pede para ligar —, então a taxa de cancelamento na prática é de quem cancelou ligando (balcão ou IA).
- Conferência de hora em hora (`/api/sinal-reconcile`) também pega quem salvou o cartão / assinou e fechou a aba antes de voltar, **e confere o status de cada assinatura vendida** (até 50 por rodada, a conferida há mais tempo primeiro): cancelada → `canceled`, cartão falhou → `past_due`, voltou → `active`; quando muda, o dono vê no feed ("⭐ Assinatura … ativa → cancelada"). Se não der para ler (chave sem **Subscriptions: Read**, assinatura que não existe nesta chave), o feed avisa uma vez por motivo novo — não a cada hora.

**NÃO acende / não verificado:** o status da assinatura agora é conferido de hora em hora, mas com atraso de até 1 h (não há webhook da conta do negócio) e só para assinaturas com `stripe_sub_id`; a IA ao telefone não registra que foi ela quem cancelou ("desconhecido"); o caixa do Balcão não abre para agendamento cancelado/falta pelo painel do agendamento (só pelo pedido da assistente) — então os botões das duas taxas só aparecem por esse caminho até o `Desk.jsx` liberar; cartão europeu que pede autenticação na cobrança fora da sessão volta como recusado. Nada disso foi testado contra um Stripe real: só testes de unidade com respostas simuladas e provas SQL na conta e2e-test.

**Prova (quando a dona ligar):** chave `rk_test_` → no Caixa de um agendamento, "Salvar cartão" → abrir o link → cartão de teste `4242 4242 4242 4242` → voltar ao caixa → "Conferir de novo" mostra VISA •••• 4242 → marcar o agendamento como falta → abrir o caixa dele → "Cobrar taxa de falta" → o pagamento aparece em Stripe → Payments (teste). Cartão `4000 0000 0000 9995` prova a recusa ("insufficient funds").
