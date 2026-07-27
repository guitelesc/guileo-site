# Delivery aggregator → Guileo (unified orders) — setup

Guileo ingests delivery orders from Uber Eats / DoorDash / Grubhub (NY) and iFood (Brazil) through ONE
endpoint, `/api/delivery-webhook`. You don't integrate each platform directly — you connect **one aggregator**
that already has all of them, and point its "new order" webhook at us. Built + tested 2026-06-21.

## How it works
- Endpoint: `POST https://guileoai.com/api/delivery-webhook?client=<restaurant_email>&secret=<DELIVERY_WEBHOOK_SECRET>`
- It normalizes the aggregator's payload (platform, items, total, customer, ref) and drops the order into the
  restaurant's **Live Orders + revenue ledger + inbox** — same place Gui's own direct orders land. The owner
  sees every order (all marketplaces + direct) in ONE screen, revenue rolled up in one place.
- Multi-tenant: each restaurant uses its OWN url with `?client=<their email>`, so orders are attributed right.
- Secret-gated (`DELIVERY_WEBHOOK_SECRET`, already set in Cloudflare) so orders can't be forged.

## Your business step (NY first, aggregator path — your chosen route)
1. Pick an aggregator with a partner/API + order webhooks. Good fits for SMB restaurants in NY:
   - **Otter (tryotter.com)** — popular with independents, unified dashboard + API.
   - **Deliverect** — robust, more enterprise.
   - **ItsaCheckmate** / **Cuboh** — middleware specialists, easy webhooks.
2. Sign the restaurant up on the aggregator and connect their Uber Eats / DoorDash / Grubhub stores there.
3. In the aggregator's webhook/integration settings, set the **new-order webhook URL** to:
   `https://guileoai.com/api/delivery-webhook?client=<restaurant_email>&secret=<the secret>`
4. Send me a test order from the aggregator → confirm it shows in the restaurant's Live Orders.

## Field mapping (already handled, flexible)
The normalizer reads common field names across aggregators: platform/source, items[]/lineItems with
name+quantity+price, total/orderTotal/grandTotal, customer.name/customerName, id/orderId/displayId,
pickupTime/estimatedReadyTime. If a specific aggregator uses different keys, tell me its sample payload and
I'll add its keys to `functions/api/delivery-webhook.js` (the `pick()` candidate lists).

## The Guileo angle (sell this, not "just another aggregator")
Restaurants hate the ~30% marketplace commission. Guileo's edge: aggregate the marketplace orders here AND
use Gui (phone/WhatsApp) to win back **direct, commission-free** orders. Same Live Orders screen shows both,
so the owner sees how much Gui is saving them in commissions.

## TODO (later, when an aggregator is chosen)
- Status-back (accept / mark ready / cancel) — push order status from the Cockpit to the aggregator.
- Menu/price sync (one edit → all platforms).
- Per-restaurant store-id → email mapping (so one webhook can serve many stores without the `?client=` param).
