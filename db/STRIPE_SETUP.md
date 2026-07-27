# STRIPE — Runbook definitivo de organização (Guileo)

Guia para o Luis deixar o Stripe **organizado, auditável e à prova de erro**.
Tudo aqui é clique no Dashboard do Stripe (https://dashboard.stripe.com) — o código já está pronto e apontado.
Legenda: ✅ = já existe no código, funciona hoje · 🖱️ = precisa do SEU clique no Dashboard.

---

## 1. Produtos e preços — convenção de nomes (🖱️)

Crie/renomeie os produtos EXATAMENTE assim (Produtos → + Adicionar produto). O webhook reconhece
os planos **pelo valor exato em centavos** (nunca por metadata — segurança), então o preço tem
que bater no centavo:

| # | Produto (nome no Stripe) | Preço | Centavos | Tipo | O que o código faz (✅) |
|---|---|---|---|---|---|
| 1 | `Guileo Starter` | US$ 149,00/mês | `14900` | Assinatura mensal | credita **500** créditos |
| 2 | `Guileo Growth` | US$ 449,00/mês | `44900` | Assinatura mensal | credita **2.000** créditos |
| 3 | `Guileo Scale` | US$ 999,00/mês | `99900` | Assinatura mensal | credita **6.000** créditos |
| 4 | `Guileo Recarga 500` | US$ 49,00 | `4900` | Avulso (one-time) | credita **500** créditos (via metadata `guileo=topup`) |
| 5 | `Guileo Recarga 1500` | US$ 119,00 | `11900` | Avulso (one-time) | credita **1.500** créditos (via metadata `guileo=topup`) |
| 6 | `Guileo Configuração Assistida` | US$ 199,00 | `19900` | Avulso (one-time) | ⚠️ ver nota abaixo |

Regras:
1. Preço em **USD**, sem imposto embutido (imposto é o item 8).
2. Payment Links dos planos podem ser "limpos" (sem metadata) — o valor exato é a chave.
3. Payment Links de recarga são gerados pelo `/api/setup-selfserve` já com `metadata.guileo=topup` (✅) — não crie recarga na mão sem essa metadata.
4. **Configuração Assistida ($199)** ✅ (2026-07-21): o webhook JÁ tem o branch — reconhece por
   `metadata.guileo=setup` OU pelo preço exato `19900`¢. Trata como RECEITA de serviço: registra o
   pagamento (visível no billing do cliente + reconcilia contra o Stripe) e **NÃO dá créditos de
   plano** (fim do bug "199 créditos por engano"). Se quiser que o setup INCLUA créditos-bônus de
   onboarding, me diga o número que eu adiciono ao branch. Pra usar: crie o produto "Configuração
   Assistida" a `19900`¢ (ou passe `metadata.guileo=setup` no Payment Link).

## 2. Webhook — o endpoint e os 5 eventos (🖱️)

Developers → Webhooks → + Add endpoint:

1. **URL**: `https://guileoai.com/api/stripe-webhook`
2. **Eventos a enviar** (selecione exatamente estes 5):
   1. `checkout.session.completed` — pagamento de plano/recarga/link do Gui
   2. `invoice.paid` — renovação mensal das assinaturas
   3. `invoice.payment_failed` — cartão recusou → dunning gentil + alerta pra você
   4. `customer.subscription.deleted` — cliente cancelou → alerta (nada é desligado sozinho)
   5. `charge.refunded` — reembolso → alerta pra você revogar créditos na mão
3. Opcional (o código também trata, não faz mal marcar): `invoice.payment_succeeded`, `charge.dispute.created`.
4. **NÃO** marque "todos os eventos" — só barulho e risco.

## 3. Verificar o STRIPE_WEBHOOK_SECRET (🖱️)

1. No endpoint recém-criado → "Signing secret" → **Reveal** → copie o `whsec_…`.
2. Cloudflare Pages → projeto guileo-site → Settings → Environment variables → confira que
   `STRIPE_WEBHOOK_SECRET` = esse `whsec_…` (produção). Se trocou o endpoint, o secret MUDA.
3. Teste: no endpoint → "Send test webhook" → `checkout.session.completed`. Resposta esperada:
   `200 {"received":true…}`. Se vier `401 bad signature` → secret errado no Cloudflare.
4. O código exige assinatura válida + janela de 5 min anti-replay (✅) — sem secret certo, nada entra.

## 4. Reconciliação diária — Stripe = ledger, provado (✅ + 🖱️)

O motor que prova que **cada dólar do Stripe está no nosso ledger**:

1. 🖱️ Cole `db/money_reconcile.sql` no SQL Editor do Supabase (projeto `ynihodbknhjirkdogxby`, conta smart@guileoai.com).
2. 🖱️ Crie um cron diário (cron-job.org ou GitHub Action), 1×/dia, chamando:
   `https://guileoai.com/api/money-reconcile?token=SEU_DIGEST_TOKEN`
   (o mesmo `DIGEST_TOKEN` do daily-digest, já no Cloudflare).
3. ✅ O que ele faz sozinho: janela de 25h (1h de sobreposição — nunca fica buraco), soma os
   eventos do Stripe, compara com o ledger, grava em `money_reconcile_runs`, e em QUALQUER
   diferença: evento de falha no /admin + e-mail brandado pra você com a lista exata do que
   não bateu. Alarme dispara 1× por janela quebrada (retry de cron não re-alarma).
4. Auditoria de CFO: `select * from money_reconcile_runs order by ran_at desc;` — uma linha por
   dia, `ok=true` = caixa provado.

## 5. Stripe Connect — dinheiro dos CLIENTES em escala (🖱️ futuro, decisão de negócio)

Hoje (✅): o Gui cobra clientes finais pelo NOSSO Stripe com `metadata.guileo="client_charge"` +
`tenant`; o webhook joga no ledger do tenant (`revenue_record`) e NUNCA credita o pagador.
Funciona, mas o dinheiro entra na NOSSA conta → repasse manual + risco fiscal/contábil cresce
com o volume.

**Quando migrar**: a partir de ~10 clientes usando close&collect de verdade, ou quando o repasse
manual passar de 1h/semana.

**Como (Connect com destination charges)**:
1. Dashboard → Connect → ativar, tipo **Express** (onboarding hospedado pelo Stripe, KYC deles, não seu).
2. Cada cliente conecta a própria conta (o esqueleto `/api/stripe-connect` já existe ✅ — falta ativar Connect no Dashboard).
3. O código passa a criar as sessions com `transfer_data[destination]=acct_do_cliente` +
   `application_fee_amount` (nossa taxa — recomendo **2–3%** ou fixo por transação, é a nossa margem).
4. O que muda no código: no branch `client_charge`, trocar "cobra na nossa conta + ledger" por
   "destination charge"; o webhook já ignora eventos de contas conectadas (`event.account` ✅),
   então precisará passar a OUVIR esses eventos para o ledger. Eu faço essa mudança quando você
   ativar — não mexa antes, o fluxo atual está blindado.
5. Ganhos: dinheiro cai direto no banco do cliente, payout/estorno/imposto viram problema DELE, e
   a `application_fee` vira receita nossa recorrente e automática.

## 6. Radar (antifraude) — 5 minutos (🖱️)

1. Dashboard → Radar: já vem ligado nas regras padrão — mantenha.
2. Regras recomendadas (Radar → Rules): **Block if** `:risk_level: = 'highest'` ·
   **Review if** `:risk_level: = 'elevated'` e valor > US$ 500.
3. Ligue **3D Secure** dinâmico (Radar sugere sozinho) — desloca a responsabilidade do chargeback pro banco.
4. Disputas: o webhook já te alerta em `charge.dispute.created` (✅). Responda SEMPRE dentro do
   prazo com o recibo + log da chamada do Gui (o ledger/transcript é a evidência).

## 7. Payout (repasse pro banco) — recomendação (🖱️)

1. Settings → Payouts: deixe **Daily — automatic** (padrão). Caixa diário simples de conciliar
   com o `money_reconcile_runs` (a janela é ~diária também).
2. NÃO use payout manual "acumulando saldo" — dificulta a conciliação e concentra risco.
3. Confira a conta bancária de destino 1×/trimestre.

## 8. Imposto — Stripe Tax (🖱️)

1. Settings → Tax → ativar **Stripe Tax** (cobra ~0,5% por transação taxada, e vale: SaaS tem
   sales tax em vários estados dos EUA e o nexo chega rápido).
2. Marque os produtos com a categoria `Software as a service (SaaS) - business use`.
3. Nos Payment Links, ligue "Collect tax automatically".
4. Nota honesta: o código NÃO calcula imposto (nem deve) — isso é 100% Stripe Tax + seu contador.
   A reconciliação compara valores brutos do Stripe, então continua batendo com Tax ligado.

## 9. Checklist final (ordem de execução)

1. 🖱️ Produtos/preços renomeados conforme a tabela do item 1.
2. 🖱️ Webhook com os 5 eventos → `https://guileoai.com/api/stripe-webhook` (item 2).
3. 🖱️ `STRIPE_WEBHOOK_SECRET` conferido + teste 200 (item 3).
4. 🖱️ Colar `db/money_reconcile.sql` no Supabase (item 4.1).
5. 🖱️ Cron diário do `/api/money-reconcile?token=…` (item 4.2).
6. 🖱️ Radar rules + 3DS (item 6). Payout daily (item 7). Stripe Tax (item 8).
7. 🕒 Connect: só quando o volume de close&collect justificar (item 5) — me chame na hora.
