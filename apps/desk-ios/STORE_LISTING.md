# Guileo Desk: App Store listing (EN + PT)

Paste these into App Store Connect → your app → **App Information** and the version page.
The character limits are Apple's; each field below fits.

| Field | Limit |
|---|---|
| Name | 30 |
| Subtitle | 30 |
| Promotional text | 170 (you can change it any time, no review) |
| Description | 4,000 |
| Keywords | 100, comma-separated, no spaces after commas |

Primary language: **English (U.S.)**. Add **Portuguese (Brazil)** as a second localization.

---

## English (U.S.)

**Name:** Guileo Desk

**Subtitle:** The team behind your business

**Promotional text:**
Your salon or spa front desk in your pocket: calendar, checkout, clients and team, with the AI assistant that answers your phone built in.

**Description:**
Guileo Desk is the front desk of your salon, spa or studio, on your iPhone and iPad.

The same AI that answers your phone and books your clients also lives inside your calendar. Open the app and your day is already laid out: who's coming, who confirmed, who still owes a deposit.

CALENDAR
• Day and week view by professional, with rooms and equipment
• Book, move and cancel in a few taps
• Prep and cleanup time per professional and service
• Allergies and alerts show right on the appointment

CHECKOUT
• Services, products, tips, packages and gift cards in one sale
• Coupons from your own campaigns
• Daily closing with what came in, by payment method

CLIENTS
• Full history: visits, purchases, packages, notes, forms
• Merge duplicate clients without losing a single record
• Your client list is yours: export it any time, free

TEAM
• Each professional's schedule, days off and services
• Commission per professional and per type of sale
• Front-desk access with its own code: the receptionist sees only what she needs

REPORTS
• Occupancy, retention, no-shows, busiest days and hours
• Who sells the most and which services bring clients back

Guileo Desk is for businesses that already have a Guileo account. Sign in with the email and password you use at guileoai.com.

**Keywords:**
salon,spa,booking,appointments,calendar,front desk,schedule,clients,checkout,beauty,barber,receptionist

**Support URL:** https://guileoai.com/contact
**Marketing URL:** https://guileoai.com/desk
**Privacy Policy URL:** https://guileoai.com/privacy

**Category:** Primary **Business**, secondary **Productivity**

**Copyright:** 2026 Tribeca Global LLC (adjust to the legal entity on the Apple account)

---

## Português (Brasil)

**Nome:** Guileo Desk

**Subtítulo:** O time por trás do seu negócio

**Texto promocional:**
O balcão do seu salão ou spa no bolso: agenda, caixa, clientes e equipe, com a assistente de IA que atende o seu telefone já dentro.

**Descrição:**
O Guileo Desk é o balcão do seu salão, spa ou estúdio, no iPhone e no iPad.

A mesma IA que atende o seu telefone e marca as suas clientes mora dentro da sua agenda. Abra o app e o seu dia já está pronto: quem vem, quem confirmou, quem ainda deve o sinal.

AGENDA
• Visão do dia e da semana por profissional, com salas e equipamentos
• Marque, remarque e cancele em poucos toques
• Tempo de preparo e limpeza por profissional e serviço
• Alergias e alertas aparecem no próprio agendamento

CAIXA
• Serviços, produtos, gorjeta, pacotes e vale-presente numa venda só
• Cupons das suas próprias campanhas
• Fechamento do dia com o que entrou, por forma de pagamento

CLIENTES
• Histórico completo: visitas, compras, pacotes, notas, formulários
• Junte fichas duplicadas sem perder nenhum registro
• A sua base é sua: exporte quando quiser, de graça

EQUIPE
• Horários, folgas e serviços de cada profissional
• Comissão por profissional e por tipo de venda
• Acesso da recepção com código próprio: a recepcionista vê só o que precisa

RELATÓRIOS
• Ocupação, retenção, faltas, dias e horários mais cheios
• Quem vende mais e quais serviços trazem as clientes de volta

O Guileo Desk é para negócios que já têm conta na Guileo. Entre com o e-mail e a senha que você usa em guileoai.com.

**Palavras-chave:**
salão,spa,agenda,agendamento,recepção,balcão,clientes,caixa,beleza,barbearia,estética,horário

---

## App Privacy ("nutrition label"), what to answer

Answer for what the app (the Desk pages it opens) actually does. Based on the code on 2026-10-22:

| Data type | Collected? | Linked to the user? | Used for tracking? | Purpose |
|---|---|---|---|---|
| Contact info: name, email, phone (the business owner's account) | Yes | Yes | No | App functionality |
| Customer content: the business's client records, appointments, notes | Yes | Yes | No | App functionality |
| Purchases: sales recorded at checkout | Yes | Yes | No | App functionality |
| Audio data: voice, only while talking to the AI assistant | Yes | Yes | No | App functionality |
| Diagnostics: crash data (Sentry) | Yes | No | No | App functionality |

**Tracking: answer "No".** The site's Meta and Google pixels only load after the visitor accepts the cookie banner
(`src/lib/analytics.js`, consent-gated). For the app, the honest "No" needs one change on the website: do not
load the ad pixels when the user agent contains `GuileoDeskApp` (the app adds that marker to every request). Until that
ships, a reviewer who accepts the banner inside the app would see a pixel, and Apple would then require the
App Tracking Transparency prompt. Listed as a follow-up in TESTFLIGHT.md.

## Review notes (App Review Information)

Apple's reviewer must be able to sign in. Put a **demo account** (email + password of a test business with sample
appointments, NOT a real client) in "Sign-in required", and this note:

> Guileo Desk is the front-desk app for salons and spas that use Guileo. Sign in with the demo account above to
> see the calendar, checkout, clients and reports. Accounts are created by the business with Guileo; the app does
> not sell anything and has no in-app purchases.
