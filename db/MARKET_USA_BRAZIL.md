# Guileo — Bi-market plan: USA (NYC) + Brazil (always both)

Decisions (Luis, 2026-06-19): **USD pricing everywhere** · **WhatsApp-first in BR + SMS in US** · **PIX in BR + Stripe/card in US**.

## What ALREADY serves both (no work)
- **Language:** site, emails and the Gui agent are trilingual PT/EN/ES. NYC = EN + ES (huge bilingual/immigrant SMB market); Brazil = PT. The Gui detects and replies in the caller's language. ✅
- **Pricing:** USD everywhere — $49/$199/$499/mo self-serve, $990 setup + $1,497/mo done-for-you. No currency localization needed. ✅
- **Sectors:** restaurants, clinics, salons, HVAC/plumbing, real estate, law, gyms, auto, bilingual services — all apply to both NYC and Brazil. ✅
- **Voice agent:** Four Seasons concierge, multilingual, on Flash v2.5 — same for both. ✅

## EIXO 1 — Channel (WhatsApp-first BR / SMS US)
- **US:** voice + **SMS** (A2P 10DLC — Luis registered the Brand+Campaign; ~1 wk to approve). Code is built (`twilio.js`, `twilio-inbound.js`, automations).
- **BR:** voice + **WhatsApp** (SMS is near-dead in Brazil). Code is **~90% there** — `twilio.js` is already WhatsApp-aware (adds `whatsapp:` prefix), `twilio-inbound.js` detects/labels the channel.
- **What Luis must open (external):** an **approved WhatsApp Business sender** — via Twilio WhatsApp (fastest path on the existing Twilio acct) or Meta directly. ~1 wk for Meta verification, free. See db/PLUG_WHATSAPP.md.
- **What I wire (when the sender exists):** a per-client `market`/`channel` field (US→sms, BR→whatsapp) so `sendText`/automations route to the right channel automatically; register 3–4 WhatsApp templates (reminder/review/win-back). Until the sender is live it no-ops gracefully (like A2P).

## EIXO 2 — Payment (PIX BR / Stripe US)
- **US:** card via **Stripe** — already wired (proposal `?pay=` Stripe Payment Link; falls back to WhatsApp).
- **BR:** **PIX** (instant, dominant). NOT yet built.
- **What Luis must open (external):** a **PIX-capable account** — **Stripe Brazil** (Stripe supports PIX as a payment method for BRL) OR **Mercado Pago** (PIX + boleto, very common for BR SMBs). Needs a BR entity/CNPJ for most providers.
- **What I wire (when the account exists):** a PIX payment-link path in the proposal/checkout for BR clients (provider API key in env), so the "Aceitar e pagar" button generates a PIX QR/code for BR and a Stripe card link for US. Until then, BR "Accept" falls back to WhatsApp (already works).

## EIXO 3 — Sales/prospecting (bi-market)
- `/prospects` updated to carry **both NYC/US sources** (Google Maps NYC, Instagram, bilingual/immigrant niches) **and Brazil sources** (Google Maps BR, Instagram BR, indicações, grupos de WhatsApp/bairro). The 10 sectors are the same; the WHERE-to-find and the WhatsApp-first approach differ for BR.
- The cold-approach messages already exist in PT/EN/ES; BR leans WhatsApp DM, US leans call/DM.

## Compliance note
- **US:** TCPA + A2P (consent already logged per lead). ✅
- **BR:** LGPD (data protection) + WhatsApp Business policy (opt-in, no cold spam — use template messages + 24h session window). Worth a short LGPD consent line on the BR form when WhatsApp goes live.

## Bottom line
The platform **already serves both markets at the language + pricing + product level**. The only two real BR-specific builds are **gated on external accounts Luis must open**: (1) a WhatsApp Business sender, (2) a PIX account (Stripe BR or Mercado Pago). The moment those exist, the code hooks slot in and BR is fully live. Until then, BR clients are served via voice + WhatsApp-deep-link + email, and pay via Stripe/WhatsApp — already functional.
