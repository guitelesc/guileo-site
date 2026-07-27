# A2P 10DLC — Pacote de Registro pronto pra colar (Guileo / Tribeca Global Inc.)

> **O que é:** registro obrigatório pra mandar SMS nos EUA sem ser bloqueado/filtrado pelas operadoras.
> **Onde:** Twilio Console → **Messaging → Regulatory Compliance → A2P 10DLC** (ou Trust Hub).
> **Como usar este doc:** copie cada campo abaixo no formulário do Twilio. Campos marcados **[VOCÊ PREENCHE]** só você tem (EIN, endereço). O resto está pronto.
> **Prazo:** registro de marca é rápido; a campanha leva de horas a alguns dias pra aprovar. Comece HOJE.

---

## 1) BRAND REGISTRATION (Trust Hub → Business Profile)

| Campo | Valor |
|---|---|
| Legal business name | **Tribeca Global Inc.** |
| Brand / DBA | **Guileo** |
| Business type | **[VOCÊ PREENCHE]** (Corporation / LLC — o que estiver no registro da empresa) |
| EIN (US Tax ID) | **[VOCÊ PREENCHE]** |
| Country of registration | United States |
| Business address | **[VOCÊ PREENCHE — endereço de NY registrado]** |
| Website | https://guileoai.com |
| Business email | smart@guileoai.com |
| Business phone | **[VOCÊ PREENCHE]** |
| Industry / vertical | Technology / Professional Services |
| Stock / public? | No (private) |
| Authorized representative | Luis Teles · smart@guileoai.com · **[título, ex: Founder/CEO]** |

> Dica: o nome legal + EIN + endereço têm que bater EXATAMENTE com o que está no IRS/registro da empresa, senão a verificação falha.

---

## 2) CAMPAIGN REGISTRATION

**Use case (escolha):** **Low Volume Mixed** (recomendado pra começar) — cobre lembretes + notificações + follow-up de um mesmo negócio. *(Se for mandar em nome de vários clientes no futuro, o Twilio orienta o caminho ISV/Sole Proprietor — mas pra começar com o próprio número da Guileo, "Low Volume Mixed" é o certo.)*

**Campaign description (cole isto):**
> Guileo sends transactional and customer-care text messages on behalf of its business to people who have explicitly opted in through our website forms or by providing their number during a phone call. Messages include appointment reminders and confirmations, missed-call text-backs, lead follow-ups, review requests, and re-engagement messages. All messages identify the sender and include opt-out instructions.

**Sample messages (cole 3–5 — estes batem com os fluxos reais da plataforma):**

1. **Lembrete de agendamento**
   > Hi {{name}}, this is Gui from {{business}}. Reminder: your appointment is tomorrow at {{time}}. Reply 1 to confirm, 2 to reschedule. Reply STOP to opt out.

2. **Missed-call text-back**
   > Hi, this is Gui from {{business}} — sorry we missed your call! How can we help? Reply here or call us back anytime. Reply STOP to opt out.

3. **Speed-to-lead / follow-up**
   > Hi {{name}}, this is Gui from {{business}}. Thanks for your interest! When's a good time for a quick call to get you set up? Reply STOP to opt out.

4. **Pedido de avaliação**
   > Hi {{name}}, Gui here from {{business}}. Hope we took great care of you! Would you mind leaving a quick review? {{link}} Reply STOP to opt out.

5. **Reativação / win-back**
   > Hi {{name}}, this is Gui from {{business}} — we'd love to have you back. Want me to set something up this week? Reply STOP to opt out.

**Message flow / How do end users opt in? (cole isto):**
> End users opt in in two ways: (1) Web form — at guileoai.com and our landing pages, users submit their phone number with an explicit, unchecked consent checkbox stating they agree to be contacted by Gui (call/text); consent text and timestamp are logged. (2) Verbal — during a phone call with our AI/human, the caller provides their number and agrees to be contacted; this consent is recorded. We do not purchase or upload third-party lists.

**Opt-in confirmation message:**
> You're opted in to messages from {{business}} via Guileo. Msg & data rates may apply. Reply HELP for help, STOP to unsubscribe.

**Opt-out:** Users reply **STOP** to unsubscribe (handled automatically — our Compliance module auto opt-outs and suppresses the number). 
**HELP:** Users reply **HELP** → "Reply STOP to unsubscribe. For help: smart@guileoai.com or guileoai.com."

**Declarações (checkboxes do formulário):**
- Embedded links? **Yes** (booking/quote/review links)
- Embedded phone numbers? **Yes**
- Age-gated content (alcohol, tobacco, etc.)? **No**
- Direct lending / loan arrangement? **No**
- Affiliate marketing? **No**

---

## 3) Depois de aprovado
- O número Twilio (TWILIO_FROM, já comprado) fica liberado pra enviar SMS sem filtro.
- Os fluxos (missed-call text-back, lembretes, reviews, win-back) já estão no código (functions/api/automations.js) e disparam automaticamente.
- Me avisa quando aprovar que eu confirmo o envio de ponta a ponta.

---

### ⚠️ O que precisa de VOCÊ (não consigo fazer no seu lugar)
1. **Submeter** este pacote no Twilio (sua conta + EIN/endereço da empresa).
2. **Publicar os anúncios** — o texto está pronto em `marketing/ads-facebook-instagram.md` e `ads-google.md`; é colar no Ads Manager (sua conta de anúncios).
3. **Postar nas redes** — captions prontas em `marketing/social-posts.md` (sua conta @Guileo AI).

Quando for fazer qualquer um, me chama que eu te guio clique a clique.
