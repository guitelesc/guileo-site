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
| 💰 **Saldo da voz (vigia)** | 🟢 LIVE | `/api/voz-saldo`, de hora em hora no cron. Duas sondas: **saldo/assinatura** da NOSSA conta ElevenLabs (avisa a 15%) e **flagrante** — varre 26h de conversas atrás de ligações mortas com `payment issue`, agrupadas por agente. Nasceu do incidente 21/08: 6 ligações da Natura morreram por pendência nossa e ninguém soube por 11 dias | ❌ só leitura | — (usa `ELEVENLABS_API_KEY` + `RESEND_API_KEY` que já existem) |
| 🎙️ **Voz** | 🟢 LIVE | Lilian atende ligações 24/7, 20+ idiomas, cota preços, fecha · **voz no NAVEGADOR** (sem telefone/A2P) no site do cliente E na landing da Guileo desde 2026-08-18 | ✅ por ligação | — (Twilio ok; A2P só p/ SMS) |
| 💬 **Atendimento/Chat** | 🟢 LIVE (webchat) · 🟡 SMS/WhatsApp | mesma Gui (guiBrain unificado) responde webchat/SMS/WhatsApp/IG/Messenger · **ponte ManyChat** (`/api/manychat-lead` → `/api/lead`) cobre as DMs enquanto o crédito Anthropic do `meta-webhook` não volta | ✅ por resposta | A2P 10DLC (SMS US) OU **WhatsApp Cloud API da Meta** (alt) |
| 💬 **Comentário → DM (IG)** | 🟡 código pronto, inerte | comentou a palavra-chave no post/reel → recebe o direct em ~1s + resposta pública opcional; o direct abre conversa que a **mesma Gui** conduz. Freio anti-spam por pessoa + teto 750/h da Meta, atômicos no banco | ❌ o disparo não gasta (texto fixo); a conversa depois sim | assinar o campo `comments` no app Meta + **Advanced Access** (App Review) p/ conta de terceiro |
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
| 🧾 **Orçamento** | 🟢 LIVE — `db/quote_engine.sql` aplicado e provado 22/08 (verificado no banco 25/08: as 9 RPCs existem) | a IA monta o orçamento na ligação e o BANCO decide: abaixo do teto do negócio sai sozinho na marca dele; acima do teto entra na FILA do cockpit (aba Orçamentos) e só sai com 1 clique do dono. Cliente final aceita/recusa por link. **Envio só por e-mail hoje** (SMS/WhatsApp bloqueados) | ✅ por orçamento enviado | A2P/WhatsApp p/ mandar por SMS/WA (e-mail já funciona) |
| 🔬 **Experiência (XM)** | 🟢 LIVE (passivo + survey ativo por email) | o "Qualtrics do cliente": mede como OS CLIENTES DELE se sentem — sentimento de ligação + reviews (passivo) + survey NPS/CSAT ativo (Gui manda por email pós-visita, cron diário, toggle ON por padrão, cliente desliga na aba) → CX score, drivers (amam/consertar), detratores p/ reconquistar (close-loop). Aba Experiência no cockpit | — (subproduto) | A2P/WhatsApp p/ survey por SMS/WA (email já funciona) |

**Legenda:** 🟢 no ar · 🟡 parcial/aguarda chave · ⚪ planejado.

## MOTORES QUE FALTAM / PRÓXIMOS
1. 📱 **Meta/Social** ✅ construído (A+B) — acende com META_APP_*
2. 💳 **Mercado Pago/PIX** — código pronto, aguarda MP_WEBHOOK_SECRET (BR)
3. 📧 **Email marketing dedicado** ✅ LIGADO 2026-07-29 — o cliente monta campanha no cockpit (aba Campanhas), a Gui resolve a audiência (`campaign_audience`: all/lapsed/vip do CRM dele), renderiza o e-mail NA MARCA DELE (couponEmail/brandPromoEmail/newsEmail via clientBrand) e dispara pela Resend; agora **mede crédito** (deduct_client_credits, 1 cr/e-mail entregue, pós-envio best-effort). Metering blindado por revisor adversarial 2026-07-30: ref ÚNICO por envio (`camp:<id>:<ts>:<n>` — o `deduct_client_credits` é idempotente por ref global, reusar o id da campanha tornava re-envio GRÁTIS pra plataforma) + portão `is_client_paused` pré-envio (inadimplente não blasta ao custo da Resend). **UNSUBSCRIBE/CAN-SPAM RESOLVIDO 2026-07-30 (deploy 8df17031, provado):** cada campanha agora leva link de descadastro 1-clique no rodapé branded + headers RFC 8058 (`List-Unsubscribe` + `List-Unsubscribe-Post` → botão nativo do Gmail/Apple); `functions/api/unsubscribe.js` (público, token HMAC à prova de forja — provado: válido→200 "unsubscribed", forjado→400) grava em `email_suppressions` (tabela+RPCs service_role, db/email_suppressions.sql); o `campaign_send` FILTRA os suprimidos antes de enviar. Token/URL em `functions/lib/unsub.js`. Endereço físico sai do `brand.address` (se o cliente cadastrou) — CAN-SPAM exige, então clientes sem endereço no perfil precisam preencher antes de blast em massa. **⚠️ TRAVA RESTANTE (menor):** From compartilhado `noreply@guileoai.com` → abuso de 1 cliente contamina a reputação de todos → ideal domínio por-cliente (ou pelo menos verificar guileoai.com no Resend p/ setar EMAIL_FROM). Com unsubscribe+supressão no ar, o motor está OK pra piloto controlado; domínio-por-cliente = próximo passo de escala. Arquivos: coupons.js (campaign_send), db/coupons.sql (campaign_*), db/refund_pause.sql (deduct_client_credits/is_client_paused), emailTemplates.js (builders branded).
4. 🌐 **Motor de site/presença** (o negócio sem site ganha um; done-for-you)

---
*Novo motor? Adicione a linha aqui + a chave externa + como gasta crédito. É o índice de produto por canal.*

---

## 📣 MOTOR DE ANÚNCIOS + CRIATIVO (2026-08-09/10) — a segunda perna do negócio

Guileo passou a se posicionar como **agência de IA + marketing + criativo**. Estes são os motores
dessa perna. Todos LIVE e provados por execução.

| peça | o que faz | estado | arquivo |
|---|---|---|---|
| **Medição** | gasto → lead → ligação → agendamento → receita, por campanha | 🟢 LIVE | `db/ads_engine.sql` · `api/ads.js` |
| **Atribuição web** | cookie primário `gui_attr` no 1º clique → viaja sozinho para toda rota | 🟢 LIVE | `lib/atribuicao.js` |
| **Atribuição por LIGAÇÃO** | um número por campanha; quem liga chega identificado | 🟢 LIVE | `ads_number_map` · webhook lê `agent_number` |
| **Importador** | cola o relatório do Google/Meta; upsert por dia+campanha (não duplica) | 🟢 LIVE | `api/ads.js {action:"importar"}` |
| **YouTube como canal próprio** | busca ≠ vídeo: intenção vs interrupção, custo por agendamento diferente | 🟢 LIVE 2026-08-15 | `normCanal` em `api/ads.js` (antes dobrava em "google"); lê também a coluna "campaign type" do export do Google Ads. Criativo já tinha formato próprio em `criativoFormatos.js` — quem não enxergava era o lado do dinheiro. Histórico já gravado como "google" fica como está. |
| **O vigia** | varre toda segunda e avisa o que precisa de decisão | 🟢 LIVE | `api/ads-vigia.js` + cron |
| **Criativo de post** | escreve no tom da marca, com preço real; gera SEM a Meta | 🟢 LIVE | `api/social-publish.js` |
| **Criativo de ANÚNCIO** | títulos/descrições por plataforma, com autocorreção de limite | 🟢 LIVE | `lib/criativoAds.js` |
| **Publicação social** | postar no IG/FB | 🔴 aguarda META_APP_SECRET | `publishToMeta` |
| **API do Google/Meta Ads** | importar gasto sozinho | 🔴 developer token (semanas) | — |

**A vantagem estrutural, em uma frase:** Google e Meta sabem cliques, o dono sabe faturamento, e o
elo do meio é o TELEFONE — que nenhuma plataforma de anúncio enxerga e a Gui atende.

### ⚠️ DÍVIDA CONHECIDA (não é defeito hoje — é risco de amanhã)
`MODEL_CHAIN` está copiado em **10 arquivos**, todos com a MESMA lista hoje. No dia em que um
modelo for aposentado, dez lugares precisam mudar e um vai ficar para trás — falhando em silêncio,
porque `askClaude` cai para o próximo modelo sem reclamar.
**Remédio:** todos importarem `askClaude`/`MODEL_CHAIN` de `functions/lib/guiBrain.js` (o arquivo
já diz isso no cabeçalho). Não foi feito em 2026-08-10 por ser véspera de lançamento: mexer em dez
arquivos troca risco futuro por risco imediato.

## Motor de agente (o cérebro de todos os agentes) — LIVE 2026-08-10
| peça | arquivo | o que faz |
|---|---|---|
| lições | `functions/lib/licoes.js` | as regras vindas de ligações reais + `VERSAO` |
| injeção | `functions/lib/provision.js` | entra depois do cardápio, antes das metas de venda |
| carimbo | `db/motor_agente.sql` + `sync-agent.js` | `client_agents.brain_version`, só após a ElevenLabs aceitar |
| varredura | `functions/api/agent-evolve.js` | acha os atrasados e sobe (cron semanal, `?seco=1` primeiro) |

Regra do produto: **agente novo ⊇ agente antigo, sempre.** Lição nova → sobe `VERSAO` → a frota
inteira sobe sozinha. Ver ROTA-CEREBRO na IMPLEMENTACAO.md.

✅ NO CRON (2026-08-10): `cron-tick.js` chama `/api/agent-evolve` todo dia às **13h UTC**. Diário e
não semanal porque uma lição nasce de um cliente perdido — esperar sete dias para o resto da frota
parar de repetir o erro é aceitar perder os próximos. Só às 13h (não na repetição das 14h): não é
claim-dedupado. Se falhar, o dia seguinte pega, porque quem não sincroniza não recebe carimbo e
continua aparecendo como atrasado.

## Semáforo da plataforma — uma pergunta, sem segredo (2026-08-10)
`POST /api/cron-tick?semaforo=1` → devolve `semaforo: { overall, areas }` com voz · dinheiro ·
agenda · agentes. O agregador (`platform-status`) é DIGEST-gated e só o cron enxergava; agora o
cron — que tem o token do lado do servidor — devolve **só o veredito** (cores, sem detalhe
sensível). A pergunta "posso receber cliente?" se faz na hora da decisão, não na hora do relógio.

**Três estados, de propósito:** 🟢 provado · 🔴 quebrado · 🟡 **não deu para provar**.
O amarelo cobre `notReady` (SQL não aplicado) e `noAccess` (sonda sem permissão).
