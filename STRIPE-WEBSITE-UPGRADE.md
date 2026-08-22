# 💳 Stripe — Website Upgrade + módulos (CRIADO EM LIVE 2026-08-21)

Conta: **GUILEO AI** `acct_1Tbm3wE0fF3QBRot` · USD · **modo live**.
Tudo abaixo já existe na conta — não precisa criar nada à mão.

## 🔗 Os 2 links de pagamento (testados, respondem 200)

| Oferta | O que cobra | Link |
|---|---|---|
| **Só o site** | $500 uma vez | https://buy.stripe.com/5kQ28rcXx82U8a3fI13Nm0n |
| **Site + Pulse** (entrada recomendada) | $500 uma vez + $49/mês | https://buy.stripe.com/6oUbJ1g9J1Ew4XRfI13Nm0o |

Para uma combinação sob medida (ex: site + voz + orçamento), me peça que eu gero o link na hora com os
módulos que o cliente marcou — o link aceita o item único e os recorrentes juntos.

## 📦 Produtos criados (price IDs pra montar qualquer link)

| Produto | Valor | leg | price ID |
|---|---|---|---|
| Website Upgrade | $500 uma vez | BUILD | `price_1U7AILE0fF3QBRotnNEfVOrX` |
| Guileo Pulse | $49/mês | BRAIN | `price_1U7AJSE0fF3QBRot5vnLx62G` |
| AI Voice Receptionist | $2.500/mês | BRAIN | `price_1U7AOUE0fF3QBRotIP9bhHg0` |
| AI Quote Engine | $1.800/mês | BRAIN | `price_1U7APCE0fF3QBRotw0KpgAoK` |
| Speed-to-Lead 60s | $2.000/mês | BRAIN | `price_1U7APxE0fF3QBRotUoWRIwPv` |
| Missed-Call Text-Back | $500/mês | BRAIN | `price_1U7AQWE0fF3QBRotlYkt8cyc` |
| Reminders + No-Show Shield | $800/mês | BRAIN | `price_1U7ARfE0fF3QBRot6IA3bn52` |
| Review Machine | $750/mês | AD | `price_1U7ASKE0fF3QBRotzAnDTOX4` |
| Growth Cockpit + CRM | $3.000/mês | BUILD | `price_1U7ATYE0fF3QBRotSTZbNYOY` |
| Collect on the Call | $700/mês | BUILD | `price_1U7AUOE0fF3QBRotek1THUIh` |

Todos com metadata `guileo=modulo` + `leg` + `slug` (o setup leva `guileo=website_upgrade`), pro webhook
e os relatórios saberem o que foi vendido sem depender do nome.

## ⚠️ Não confundir com os planos self-serve
Website Upgrade é outro produto. Os planos seguem **Essential $149 · Personalized $897 · Full Operation
$1.997** (`src/data/selfServePlans.js`). Os links de $449/$999 continuam ativos **só** pros assinantes antigos.

## Próximo passo quando o Nonstop aceitar
1. Manda o link certo (só o site, ou site + módulos escolhidos).
2. Pagou → ROTA-FECHAMENTO no `IMPLEMENTACAO.md`, passo 2 em diante (cadastro → número → encaminhamento
   → entrega do site → módulos → painel).
