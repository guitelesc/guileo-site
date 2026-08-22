# 💳 Stripe — Website Upgrade + módulos (lista pra colar no dashboard)

Conta: **GUILEO AI** `acct_1Tbm3wE0fF3QBRot` · moeda **USD** · modo **live**.
Caminho: Dashboard → **Catálogo de produtos → + Adicionar produto**. Depois, **Links de pagamento → + Novo**.
> Estrutura já provada por mim em **modo teste** (produto → preço → link funcionando). Aqui é só replicar em live.

## 1. O setup (uma vez)
| Campo | Valor |
|---|---|
| Nome | **Website Upgrade** |
| Descrição | Your site rebuilt by Guileo — your video, brand, photos and services, built to convert. One-time build fee. |
| Preço | **$500.00** · pagamento **único** |
| Metadata | `guileo=website_upgrade` · `tipo=setup` |

## 2. Os módulos (mensais, recorrentes)
Todos: preço **recorrente mensal**, USD, metadata `guileo=modulo` + `leg=` + `slug=`.

| Nome | Valor/mês | leg | slug | Descrição curta |
|---|---|---|---|---|
| **Guileo Pulse** | $49 | BRAIN | pulse | The measurement layer: scores every job from signals you already produce (calls, bookings, reviews). No surveys. |
| **AI Voice Receptionist** | $2,500 | BRAIN | voice | Answers every call 24/7 in your name — books, quotes and dispatches. Any language. |
| **AI Quote Engine** | $1,800 | BRAIN | quote | Calls back, collects the job details and sends the quote by text and email. Above your set amount, your office approves first. |
| **Speed-to-Lead 60s** | $2,000 | BRAIN | speedlead | Every form gets an AI call back in about a minute — before they call the next one on the list. |
| **Missed-Call Text-Back** | $500 | BRAIN | missedcall | Missed a call? Instant text goes out and the AI calls back on its own. |
| **Reminders + No-Show Shield** | $800 | BRAIN | reminders | Confirmations and per-job risk scoring, so the schedule actually holds. |
| **Review Machine** | $750 | AD | reviews | Asks every happy customer at the right moment, collects the review and answers it — automatically. |
| **Growth Cockpit + CRM** | $3,000 | BUILD | cockpit | Every call, lead, quote and job on one screen, with history per customer. |
| **Collect on the Call** | $700 | BUILD | collect | Closed on the phone? Payment link by text right there — deposit before the truck rolls. |

## 3. Os links de pagamento
- **Link A — só o site:** 1 item → Website Upgrade $500. Metadata `oferta=setup_500`.
- **Link B — entrada (o mais provável):** Website Upgrade $500 + Guileo Pulse $49/mês. Metadata `oferta=setup_pulse`.
- **Link C — sob medida:** monte na hora com os módulos que o cliente marcou (o link aceita item único + recorrentes juntos).

## ⚠️ Não confundir com os planos self-serve
Website Upgrade é OUTRO produto. Os planos seguem: **Essential $149 · Personalized $897 · Full Operation $1.997**
(links atuais em `src/data/selfServePlans.js`). Os links de $449/$999 continuam ativos **só** pros assinantes antigos.

## Quando os links existirem
Me manda as URLs que eu fixo onde precisa (proposta, e-mail do Website Upgrade, modo dono) e ligo a
conferência automática do `/api/canary`, que testa se cada link responde 200.
