# Guileo Growth Cockpit — Future Roadmap

**What this is:** a prioritized list of what to build next so the Cockpit becomes *intelligent* (the AI does work and proves it) and *successful* (Guileo earns a measurable % of the growth it drives). Skim it, pick what excites you, we build.

**Where we are today (the foundation is strong):**
- 12 sectors, fully data-driven (add a sector = a few map entries).
- Editable AI brain + live test sandbox + training flywheel.
- Unified Inbox, and **conversation → action that inserts a real persisted record** into the right tab (chat → order/booking that survives reload).
- Deliveries/dispatch, growth modules (Impact/Follow-ups/Waitlist/Recurring/Reputation), durable state, mobile, CSV export.
- One clean "connect the backend" seam: `src/lib/portalApi.js`. Every screen already reads/writes through it. Keys are the last step.

**How to read priorities:**
- **P0** = build next, biggest money-per-effort. **P1** = strong follow-on. **P2** = valuable later / needs backend live.
- Every item ties to a **money outcome** because that is what the revenue-share model bills on.

---

## 1. Next cross-tab integrations ("command → store → read")

The pattern already works (chat→order lands in Live Orders and persists). These are the next stitches that turn isolated tabs into one operating system. Each is reusable across all 12 sectors via the existing `gen*`/`saveState`/`onNav` plumbing — **no new architecture needed.**

| # | Stitch | What happens | Money outcome | Pri |
|---|--------|--------------|---------------|-----|
| 1 | **Waitlist → Booking** | Tap "Offer slot" on a waitlist entry → AI texts the customer → on yes, a booking record is inserted into Schedule (gold "from waitlist" badge), seat marked filled. | Fills empty capacity that would have earned $0. Directly grows billable revenue. | **P0** |
| 2 | **Low-stock → Supplier reorder** | MenuView/Catalog "out of stock" → fires a Reorder draft into a new **Supply** tab (PO record persisted) → one tap sends to supplier. | Stops lost sales from stockouts; the #1 silent revenue leak in restaurants/retail. | **P0** |
| 3 | **Delivery late → auto-apology + coupon** | Deliveries board flips to "late" → AI sends apology + auto-issues a coupon record into Campaigns/Customer profile. | Saves the order *and* the customer (retention = recurring revenue). | **P0** |
| 4 | **Reputation → Campaign** | A new 5★ review → AI drafts a "thank + ask referral" message; a 1–2★ → routes to human + drafts a win-back coupon. Both land as records in Campaigns. | Turns reputation into demand (good reviews → referrals; bad → saved customer). | **P1** |
| 5 | **No-show → Re-fill + waitlist** | A booking flips to no-show → slot auto-reopens to the Waitlist (stitch #1 in reverse) + flags the customer for a deposit-next-time rule. | Recovers the slot's revenue same-day instead of eating the loss. | **P1** |
| 6 | **Missed call → Follow-up** | Any unanswered call in Call Logs auto-creates a Follow-up task with the AI's suggested first message. | Missed calls are missed money; this guarantees none drop. | **P1** |
| 7 | **Recurring churn-risk → Win-back** | A membership flagged churn-risk → AI drafts a personalized win-back offer into Campaigns + a Follow-up. | Keeps MRR alive — cheaper to save than re-acquire. | **P1** |
| 8 | **Inbox order → Invoice/Payment** | "Create order/booking" already lands the record; next step auto-drafts an invoice/payment link onto that record. | Closes the loop to *cash collected*, not just "order taken". | **P2** |

**Build note:** all of these are the same proven move — a button/event builds a record via `pushCreated`-style helper, `saveState` persists it, the target screen prepends it with a "from X" badge, a toast + `onNav` shows it landing. One helper pattern, applied 8 more times.

---

## 2. AI intelligence upgrades (these PROVE and DRIVE the % growth)

Today the AI *answers*. Next it should *predict and act before the owner asks*. This is the heart of the revenue-share thesis: the AI generates measurable growth, and **Guileo Impact** already exists to attribute and bill it.

| # | Feature | What the AI does | Money outcome | Pri |
|---|---------|------------------|---------------|-----|
| 1 | **Predictive no-show** | Scores each upcoming booking by risk (history, lead time, channel) → auto-sends a confirm nudge / asks deposit for high-risk. | Cuts no-shows = direct revenue saved, attributed in Impact. | **P0** |
| 2 | **Dynamic upsell suggestions** | At order/booking time, AI suggests the highest-margin add-on for *this* customer. | Lifts average ticket — pure margin, easy to measure (with/without). | **P0** |
| 3 | **This week's growth moves** *(extend existing card)* | Already surfaces top 3 money moves on Overview. Add: a one-tap "Do it" that fires the whole sequence (e.g. blast review requests, nudge all follow-ups). | Turns insight into action in one click = more growth captured. | **P0** |
| 4 | **Churn-risk auto-winback** | Detects customers going quiet (frequency drop) → auto-launches a personalized re-engagement. | Protects recurring revenue; feeds Impact ledger. | **P1** |
| 5 | **Demand forecasting → staffing** | Forecasts next week's volume by daypart → suggests staffing + prep levels. | Cuts over/under-staffing cost; better service = more repeat. | **P1** |
| 6 | **Smart pricing nudges** | Flags when demand supports a price bump or a slow slot needs a discount (happy-hour logic). | Optimizes yield on the same capacity. | **P2** |
| 7 | **AI weekly briefing** | Mon-morning summary: "Here's what I did, what I earned you, what needs you." (email + in-app). | Makes the % bill feel earned every week; reduces churn of *Guileo's own* clients. | **P1** |

**Why this matters for the business model:** each of these should write its outcome into **Guileo Impact** ($ attributed). That ledger *is* the invoice. The more the AI proactively earns, the more transparent the % bill.

---

## 3. New modules worth adding

### Universal (all 12 sectors, reusable like the growth modules)
| Module | What it does | Money outcome | Pri |
|--------|--------------|---------------|-----|
| **Loyalty / Points** | Points per visit/spend, auto-rewards, AI nudges near a reward. | Drives frequency — the cheapest growth lever. | **P0** |
| **Referrals engine** | Give-$/get-$ links, tracked, AI asks happy customers to refer (ties to Reputation). | New customers at near-zero CAC. | **P0** |
| **Payments / Invoicing** | Payment links, invoices, deposits (anti-no-show), tracked to cash. | Closes loop to money collected; enables deposit rules. | **P0** |
| **Gift cards** | Sell/redeem, balance tracking. | Pre-paid cash + new-customer acquisition. | **P1** |
| **Inventory / Supply** | Stock levels, reorder points, supplier POs (powers stitch #2). | Stops stockout losses, reduces waste. | **P1** |
| **Team / Staff management** | Schedules, roles, performance, tips/commission. | Labor efficiency; powers demand-forecast staffing. | **P1** |
| **Multi-location** | Switch/roll-up across branches, per-location KPIs. | Unlocks bigger clients (chains) = bigger % revenue. | **P2** |

### Per-sector standouts
- **Restaurant:** online ordering page (Guileo Direct storefront), table reservations, kitchen prep forecasting.
- **Clinic / Medical:** recalls (6-month checkup), insurance/eligibility notes, intake forms, prescription refills.
- **Salon / Gym:** packages/memberships (extend Recurring), class/appointment booking, no-show deposits.
- **Law / Home services / Construction:** quote/estimate builder → e-sign → deposit → job (a full pipeline tab).
- **E-commerce:** abandoned-cart recovery (AI win-back), shipping/returns, product Q&A from the trained AI.
- **Real estate / Auto:** lead pipeline stages, showing/test-drive scheduling, valuation/financing nudges.

---

## 4. Platform / technical (what the backend connection unlocks)

The whole app is "connected-ready" — one seam, `// CONNECT:` branches waiting. Turning on Supabase unlocks a tier of capability that mock data can't fake:

| Capability | What it enables | Why it matters | Pri |
|-----------|-----------------|----------------|-----|
| **Realtime across devices** | Owner's phone + front desk + kitchen all update live (Supabase realtime). | Feels like a true operating system, not a demo. | **P0** |
| **True multi-tenant** | Each client = isolated tenant, RLS-secured. | Required to onboard real paying clients safely. | **P0** |
| **Inbound webhooks** | Uber Eats / DoorDash, Stripe, Google/Outlook Calendar, POS, Meta/Google Ads push events in. | Real orders/payments/bookings/ad-spend flow in automatically — no manual entry. | **P0** |
| **Role-based access (RBAC)** | Owner vs staff vs Guileo-admin permissions. | Trust + safety for teams; needed before multi-location. | **P1** |
| **Audit log** | Every AI action + human action recorded. | Transparency for the % bill + compliance (esp. clinic/medical/law). | **P1** |
| **Outbound webhooks / automations** | Cockpit events trigger external tools (Zapier/Make/n8n). | Lets clients plug Guileo into their existing stack. | **P2** |
| **Real outbound voice** | Wire the live "AI calls you" (Vapi/Twilio) into Cockpit actions. | The killer demo becomes a working channel inside the product. | **P1** |

**Sequencing:** turn on Supabase (multi-tenant + realtime) → then the first webhook (Stripe for payments, or Calendar for bookings) → each integration replaces a `gen*` mock with real data, zero screen change.

---

## 5. Monetization & growth-share mechanics

The thesis: **Guileo earns a % of the growth it drives.** To bill it honestly and defensibly, it must be *measured* and *visible*. **Guileo Impact already exists** as the ledger — these items make it billable.

### What to instrument (every AI-driven outcome writes an Impact event)
| Event to capture | $ attributed |
|------------------|--------------|
| Booking/order created by AI (from chat/call) | order value |
| No-show prevented (predictive nudge worked) | recovered slot value |
| Waitlist slot filled | filled capacity value |
| Follow-up converted | deal value |
| Churned member saved | retained MRR |
| Review-driven referral converted | new customer value |
| Upsell accepted | incremental margin |

### How the % gets measured & billed
1. **Baseline** at onboarding (pre-Guileo revenue) → growth = current minus baseline, conservatively attributed.
2. **Attribution rules** (last-touch / assisted) stored per event, auditable — the audit log backs every dollar.
3. **Transparency panel** (extend Impact): "Guileo drove $X this month · our share = Y% = $Z" — the client sees exactly what they're paying for.
4. **Billing**: monthly statement = sum of attributed growth × share %, with the event feed as the line items. Stripe (from §4) collects it.
5. **Guardrails**: only count *net-new* / *recovered* revenue, cap attribution conservatively — under-claim to keep trust. Trust = low Guileo-client churn.

### Growth levers to also monetize (later)
- Base subscription + % (floor + upside).
- Per-channel add-ons (voice, ads management).
- Multi-location / enterprise tiers.

---

## Top 5 to build next (the shortlist)

1. **Waitlist → Booking + No-show prevention** (P0) — fills empty capacity and stops losing booked revenue. Biggest, fastest money, reuses the proven chat→record pattern. *(§1.1, §1.5, §2.1)*
2. **Loyalty + Referrals engine** (P0) — drives frequency and brings new customers at near-zero cost; both feed Impact. *(§3)*
3. **Payments / Invoicing** (P0) — closes every loop to *cash collected*, enables deposits, and is what Stripe billing rides on. *(§3, §5)*
4. **Guileo Impact → billable** (P0) — instrument all AI outcomes + transparency panel. This is the product's whole reason to exist; without it the % is just a claim. *(§2, §5)*
5. **Turn on Supabase: multi-tenant + realtime + first webhook** (P0) — flips the app from beautiful demo to real product for paying clients. Everything above is "connected-ready" the moment this lands. *(§4)*

> Everything here reuses what's already built — same data seam, same `gen*`/`saveState`/`onNav` pattern, same 12-sector data model. We're not rebuilding; we're stitching and connecting. Pick a number and we start.
