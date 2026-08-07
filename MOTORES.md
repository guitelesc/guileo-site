# 🚂 MOTORES DO GUILEO — o mapa vivo (o que a Gui opera pro negócio do cliente)

> Um **motor** = um domínio que a Gui/funcionário-de-IA do cliente opera sozinha. Cada motor
> **consome créditos** (o motor financeiro é o medidor de TUDO) e alguns **geram receita**.
> Regra do Luis: o Guileo É o sistema do cliente (motor interno) E integra com o que ele já usa —
> todos migram pro Guileo com o tempo. Conector externo = inerte-que-acende-sozinho com a chave.
>
> **Como usar este mapa:** achou o motor → veja estado, arquivos, o que gasta crédito, e a chave
> externa que falta. Pra alterar/ligar um motor, siga **ROTA-MOTOR** em [IMPLEMENTACAO.md](IMPLEMENTACAO.md).

## 💰 MOTOR FINANCEIRO — o medidor central (todo motor passa por aqui)
Cada AÇÃO da Gui gasta **créditos** (~5 por tarefa: ligação atendida, follow-up, review respondida,
DM respondida, post, cobrança). É o modelo pré-pago que o cockpit de Billing mostra. Motores que
GERAM receita pro cliente (close&collect, upsell, reativação) alimentam o /api/revenue + a comissão
do vendedor. Motores **done-for-you** (Ads, posts aprovados) = serviço premium (Track B), fora do crédito.
- Arquivos: stripe-webhook.js, agent-action.js (close&collect), /api/revenue, client_credits, seller_commission_ledger.
- **Chave externa:** Stripe Connect (dinheiro na conta do cliente), Mercado Pago (BR).

---

## ESTADO DE CADA MOTOR

| Motor | Estado | O que faz | Gasta crédito? | Chave externa que falta |
|---|---|---|---|---|
| 🎙️ **Voz** | 🟢 LIVE | Lilian atende ligações 24/7, 20+ idiomas, cota preços, fecha | ✅ por ligação | — (Twilio ok; A2P só p/ SMS) |
| 💬 **Atendimento/Chat** | 🟢 LIVE (webchat) · 🟡 SMS/WhatsApp | mesma Gui (guiBrain unificado) responde webchat/SMS/WhatsApp/IG/Messenger | ✅ por resposta | A2P 10DLC (SMS US) OU **WhatsApp Cloud API da Meta** (alt) |
| 📅 **Agenda universal** | 🟢 pronto (adapter+interno) · 🟡 externo aguarda chave | agenda no sistema do cliente (MindBody/Square/…) OU no motor interno; anti-choque | ✅ por reserva | MINDBODY_API_KEY (Natura); Square=token por-cliente |
| 💰 **Financeiro/Cobrança** | 🟢 LIVE | close&collect na ligação, faturas, cobrança educada, ledger | ✅ por cobrança | Stripe Connect + Mercado Pago |
| 🔵 **Google** | 🟡 em construção | GBP (SEO local), reviews pedir+responder, Ads done-for-you | ✅ por review/post | GOOGLE_BUSINESS_* (aprovação Google) |
| 📱 **Meta/Social** | 🟡 pronto (A+B) — aguarda app | responde IG DM/Messenger/WhatsApp + posta (auto OU aprovar) | ✅ por DM/post | META_APP_ID/SECRET + Business verification |
| 📣 **Marketing** | 🟢 LIVE | win-back, reativação, campanhas 1-clique, datas comemorativas | ✅ por envio | — |
| ⭐ **Reputação** | 🟡 pedir LIVE · responder no Google | pede review pós-visita; responde no Google (motor Google) | ✅ por pedido | (via motor Google) |
| 🧠 **CRM** | 🟢 LIVE | cada ligação/chat/pagamento vira cadastro; pipeline | — (subproduto) | — |
| 🚨 **Emergência** | 🟢 LIVE | urgência → toca o celular do dono (Natura: +19177166101 ✅) | ✅ por dispatch | — |
| 🌀 **Crise/Tempestade** | 🟢 LIVE | 1 clique fecha agenda + avisa + reabre | ✅ por blast | — |
| 🛒 **Pedidos/Delivery** | 🟡 parcial | pega pedido, upsell, delivery (restaurante); webhook agregador | ✅ por pedido | agregador de delivery |
| 📊 **Inteligência** | 🟢 LIVE | relatório semanal, forecast, radar de no-show, briefing | — (subproduto) | — |
| 🏪 **Marketplace** | 🟢 LIVE | Yelp/Angi/Thumbtack → CRM → Gui liga em 60s | ✅ por lead | (Zap do cliente) |
| 🎁 **Recorrência/Fidelidade** | 🟢 LIVE | pacotes, assinaturas, gift cards, pontos | ✅ por resgate | (via Stripe) |
| 🔬 **Experiência (XM)** | 🟢 LIVE (passivo + survey ativo por email) | o "Qualtrics do cliente": mede como OS CLIENTES DELE se sentem — sentimento de ligação + reviews (passivo) + survey NPS/CSAT ativo (Gui manda por email pós-visita, cron diário, toggle ON por padrão, cliente desliga na aba) → CX score, drivers (amam/consertar), detratores p/ reconquistar (close-loop). Aba Experiência no cockpit | — (subproduto) | A2P/WhatsApp p/ survey por SMS/WA (email já funciona) |

**Legenda:** 🟢 no ar · 🟡 parcial/aguarda chave · ⚪ planejado.

## MOTORES QUE FALTAM / PRÓXIMOS
1. 📱 **Meta/Social** ✅ construído (A+B) — acende com META_APP_*
2. 💳 **Mercado Pago/PIX** — código pronto, aguarda MP_WEBHOOK_SECRET (BR)
3. 📧 **Email marketing dedicado** ✅ LIGADO 2026-07-29 — o cliente monta campanha no cockpit (aba Campanhas), a Gui resolve a audiência (`campaign_audience`: all/lapsed/vip do CRM dele), renderiza o e-mail NA MARCA DELE (couponEmail/brandPromoEmail/newsEmail via clientBrand) e dispara pela Resend; agora **mede crédito** (deduct_client_credits, 1 cr/e-mail entregue, pós-envio best-effort). Metering blindado por revisor adversarial 2026-07-30: ref ÚNICO por envio (`camp:<id>:<ts>:<n>` — o `deduct_client_credits` é idempotente por ref global, reusar o id da campanha tornava re-envio GRÁTIS pra plataforma) + portão `is_client_paused` pré-envio (inadimplente não blasta ao custo da Resend). **UNSUBSCRIBE/CAN-SPAM RESOLVIDO 2026-07-30 (deploy 8df17031, provado):** cada campanha agora leva link de descadastro 1-clique no rodapé branded + headers RFC 8058 (`List-Unsubscribe` + `List-Unsubscribe-Post` → botão nativo do Gmail/Apple); `functions/api/unsubscribe.js` (público, token HMAC à prova de forja — provado: válido→200 "unsubscribed", forjado→400) grava em `email_suppressions` (tabela+RPCs service_role, db/email_suppressions.sql); o `campaign_send` FILTRA os suprimidos antes de enviar. Token/URL em `functions/lib/unsub.js`. Endereço físico sai do `brand.address` (se o cliente cadastrou) — CAN-SPAM exige, então clientes sem endereço no perfil precisam preencher antes de blast em massa. **⚠️ TRAVA RESTANTE (menor):** From compartilhado `noreply@guileoai.com` → abuso de 1 cliente contamina a reputação de todos → ideal domínio por-cliente (ou pelo menos verificar guileoai.com no Resend p/ setar EMAIL_FROM). Com unsubscribe+supressão no ar, o motor está OK pra piloto controlado; domínio-por-cliente = próximo passo de escala. Arquivos: coupons.js (campaign_send), db/coupons.sql (campaign_*), db/refund_pause.sql (deduct_client_credits/is_client_paused), emailTemplates.js (builders branded).
4. 🌐 **Motor de site/presença** (o negócio sem site ganha um; done-for-you)

---
*Novo motor? Adicione a linha aqui + a chave externa + como gasta crédito. É o índice de produto por canal.*
