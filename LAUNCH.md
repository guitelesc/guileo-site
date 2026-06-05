# Guileo — Go-Live Guide (enter operation)

The front-end is **done and validated**. To actually operate (collect money, persist real customers, real integrations, public site), these steps need **your accounts/keys** — they can't be done for you. Do them in order. Each maps to a seam already built in the code.

> Safety: never paste card numbers, bank logins, or passwords into a chat. Enter keys only in the dashboards below (Cloudflare, Supabase, Stripe, Meta, Google).

---

## 0. Backups & repo (done)
- Code lives at `/Users/guiteles/guileo-site` (mirror of `/tmp/guileo-novo`), git history intact. Preview deploys go to the Cloudflare `preview` branch via `npm run deploy`.

## 1. Persistence — Supabase (unblocks paying accounts) · seam: all `loadState/saveState`, `guiPlan`
1. Create a project at supabase.com → copy **Project URL** + **anon public key**.
2. Run `supabase/schema.sql` (already in the repo: 21 tenant tables + RLS) in the SQL editor.
3. Put the URL + anon key in `src/lib/portalApi.js` at the `// CONNECT:` marks; flip `loadState/saveState` to read/write the tenant row instead of localStorage. Auth = Supabase Auth (email magic-link); the logged-in user's tenant id namespaces every key we already use (`:stack`, `:automations`, `gui_credits`, `:settings`, `:profile`, `gui_usage`).
**Result:** a signup survives refresh = a real account can exist.

## 2. Money in — Stripe (this is the revenue) · seam: `gui_credits`, `gui_payg`
1. Stripe dashboard → get **publishable + secret keys**; create Products for credit packs (250/$9, 500/$16, 1,200/$32) and your plan tiers.
2. Replace the `topUp(n)` handler in `Billing` (`src/pages/Portal.jsx`) with a Stripe Checkout redirect; on the **webhook** `checkout.session.completed`, increment that tenant's `gui_credits`. (The whole credits UI + auto-top-up toggle is already wired to this store.)
3. Add the same webhook stream for failed-payment → dunning (the in-app guiAlerts banner is ready).
**Result:** credits become buyable; the meter that already gates every Gui action now sells.

## 3. Real integrations — OAuth (justifies the subscription) · seam: `:stack`
Start with the 3 highest-demand: **Google/Calendar, WhatsApp (Cloud API), Stripe-as-data**.
1. Create OAuth apps in each provider; store tokens per tenant.
2. In the Integrations hub, the `toggle(name)` currently flips a boolean — point each real one at its OAuth connect flow, and have Gui's actions (`guiPlan` runs) call the provider API instead of just `pushCreated`.
**Result:** "Gui books a real calendar slot / sends a real WhatsApp" — the actual product.

## 4. Public site — domain & publish · seam: `?v=` deep links
1. Cloudflare → Workers & Pages → guileoai → **Custom domains** → add `guileoai.com` → Cloudflare gives nameservers.
2. At your registrar (IONOS) change the nameservers to Cloudflare's → wait ~15min–1h → SSL auto-issues.
3. Promote the validated preview to production (a deliberate `wrangler pages deploy … --branch=main` **with your explicit OK**).
**Result:** the funnel ("enter phone → AI calls you") lands on a real, billable site.

## 5. The call demo — telephony (the marquee hook) · seam: landing LeadForm, `?v=`
- Provision a number (Twilio/Telnyx) + TTS/ASR; wire the landing form submit to place the outbound call. Meter it against `gui_credits`.

---

## Order that gets you to first dollar fastest
**1 (Supabase) → 2 (Stripe) → 4 (domain/publish)** = you can sign up a customer and charge them. Then **3 (OAuth)** and **5 (telephony)** deepen the value. Tell me when you have the keys for a step and I'll wire it with you, live.

## Already real & operating client-side (no keys needed)
Gui assistant (memory/voice/undo/automations that now execute/radar/explainability/bilingual) · Integrations hub w/ sector tools + day-one auto-connect · credit meter + usage history + referral grant + auto-top-up · sector onboarding · editable Settings (AI tone/greeting, notifications, quiet hours) · 12 verticals via `?v=` · landing functional demo + voice · PT/EN. See `RUNBOOK.md` for deploy/validate and `memory/reference_guileo_money_roadmap.md` for the $-ranked remaining backlog.
