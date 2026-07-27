# 📣 GUILEO — Plano de Anúncios v1 (US · $300–500/mês · todas as indústrias)

> Decidido com Luis 2026-07-27: orçamento teste $300–500/mês · geo US inteiro + reforço NYC/Miami · um criativo POR indústria dentro de UMA campanha (orçamento concentrado, o Meta roteia cada criativo pra dor certa) · CTA = Quiz/agendar (não "a IA te liga" — caller-ID US silenciado até o A2P).

## 🎯 Estrutura (Meta Ads · ~$13/dia)

| Campanha | Objetivo | Orçamento | Segmentação |
|---|---|---|---|
| **G1 · Leads-US** | Leads (formulário do site) | **$10/dia** | US inteiro · Advantage+ · interesses: small business owners, restaurant owners, business software · 25-60 anos |
| **G2 · Retarget** | Conversões | **$3/dia** | Visitantes do site 30d que não viraram lead (pixel já instalado) |

- **G1** = 1 conjunto de anúncios, **8 criativos** (um por vertical, em `ads-creatives/`). Deixe o Meta otimizar entrega por criativo. Depois de 2 semanas, pause os 4 piores.
- **NYC/Miami**: não separar campanha agora (fragmenta $). O reforço vem via **ajuste de local** (+10% bid nas duas cidades) OU quando o orçamento subir, G3 dedicada apontando pras páginas /for/:vertical/:cidade.
- **Evento de otimização**: `Lead` (o pixel `1296370909363981` já dispara em todo formulário — quiz, calculator, capture).

## 🖼️ Criativos (prontos em `ads-creatives/`)
ad-restaurant · ad-clinic · ad-dental · ad-hvac · ad-realestate · ad-gym · ad-auto · ad-ecommerce (1080×1080, EN, identidade da marca, CTA "Get your free AI Growth Score →")

## ✍️ Copy por vertical (colar no Ads Manager)

**Link de destino (todos):** `https://guileoai.com/quiz?utm_source=meta&utm_medium=paid&utm_campaign=g1-leads-us&utm_content={{VERTICAL}}`

| Vertical | Primary text | Headline (30c) | Descrição |
|---|---|---|---|
| restaurant | Every missed call during the rush is an order your competitor took. Gui — our AI — answers, takes orders & books tables 24/7, in any language. Live in 7 days. 30-day guarantee. | AI that answers 24/7 | Free AI Growth Score |
| clinic | No-shows and unanswered phones cost clinics $5,400/mo on average. Gui books patients 24/7 and sends the reminders that fill your schedule. HIPAA-grade standards. | Fill your schedule | 2-min free assessment |
| dental | An empty chair is money walking out. Gui books cleanings, runs recalls and follows up on treatment quotes — automatically. | Keep the chair full | Free AI Growth Score |
| hvac | 2 AM emergency call? Gui answers, quotes and books the job before your competitor even wakes up. Stop leaking $7,600/mo. | Never miss a job | Free 2-min assessment |
| realestate | Leads go cold in 5 minutes. Gui calls yours back in seconds, qualifies, and books the showing. +5 deals a month on autopilot. | Call leads in seconds | Free AI Growth Score |
| gym | Trial leads nobody called = members you never got. Gui signs up, books tours and wins back lapsed members 24/7. | More members, less churn | Free 2-min assessment |
| auto | Buyers won't wait for a callback. Gui answers every inquiry, qualifies and books the test drive — day or night. | Book more test drives | Free AI Growth Score |
| ecommerce | Abandoned carts and ignored questions cost you $6,100/mo. Gui answers support instantly, recovers carts and wins back buyers. | Recover every cart | Free 2-min assessment |

## ✅ Checklist de ativação (Luis — ~30 min, uma vez)
1. business.facebook.com → confirmar a conta de anúncios do app "Guileo" (App ID 2252636211962171) + **cartão de pagamento**
2. Ads Manager → Criar campanha **G1-Leads-US** (objetivo Leads → site) → $10/dia
3. Conjunto: US, 25-60, interesses acima → subir os **8 PNGs** de `ads-creatives/` + colar copy da tabela + link com o utm_content de cada vertical
4. Criar **G2-Retarget** ($3/dia, público "visitantes 30d", excluir leads) → usar ad-restaurant + ad-clinic com headline "Still thinking? 30-day guarantee."
5. Publicar. **Não mexer por 7 dias** (fase de aprendizado).

## 📈 Medição (já funciona sozinha)
- Pixel Meta ativo + consent-gated · UTM first-touch gravado no lead · leads chegam no /admin com origem
- **Meta semanal:** CPL alvo ≤ $12 no teste · 1ª venda paga ~5 meses de anúncio
- Rodada de otimização comigo a cada 7 dias: eu leio /admin + Ads Manager (você me manda print) → pauso/escalo criativos

## 🔓 Destravas futuras (sobem o teto)
- **A2P/caller-ID** (Luis, Twilio) → libera CTA "a Gui te liga" = conversão muito maior
- **META_APP_SECRET** → WhatsApp/Messenger como canal de resposta
- Orçamento $1k+ → campanha NYC/Miami dedicada com as landing pages /for/ locais + Google Search (intenção alta)
