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
Campaign (use a marca "Guileo"/Tribeca Global). Aprovação leva alguns dias.
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
