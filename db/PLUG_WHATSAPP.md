# PLUG: WhatsApp Business API

**Status: PARTIAL (send/receive code is WhatsApp-aware; no official sender yet).**
The codebase already knows how to send and receive WhatsApp messages *if* a WhatsApp
sender exists on the Twilio account — the sender/receiver code prefixes `whatsapp:`
and the inbound webhook labels the channel "WhatsApp". What's missing is an
**approved WhatsApp Business sender** (a number tied to a verified Meta WhatsApp
Business Account). The marketing site's "Start on WhatsApp" buttons are plain
`wa.me` deep-links to Luis's personal number — a fallback, not the API.

---

## What's already wired (grep results)

| Piece | Where | State |
|---|---|---|
| Outbound: `whatsapp:` prefix handling | `functions/lib/twilio.js:9-11` — if `TWILIO_FROM` starts with `whatsapp:`, it mirrors the prefix onto the destination | ✅ built |
| Inbound: WhatsApp vs SMS detection | `functions/api/twilio-inbound.js:124-132` — detects `whatsapp:` prefix on `From`, strips it, labels channel | ✅ built |
| Inbound → portal as "WhatsApp" event | `twilio-inbound.js:43, 185-189` (`p_channel = "WhatsApp"`) | ✅ built |
| AI conversational reply | `twilio-inbound.js` (Anthropic) — same path serves WhatsApp and SMS | ✅ built |
| Automations send via same `sendText` | `functions/api/automations.js` (reminders/reviews/win-back logged as "whatsapp") | ✅ built |
| Marketing `wa.me` deep-links | `src/i18n.jsx` ("Start on WhatsApp"), `emailTemplates.js:709` (`wa.me/19295350191`) | ⚠️ **fallback only** — opens a chat to Luis's personal WhatsApp, NOT the business API |

**So: the plumbing is done. There is no official WhatsApp sender, and `TWILIO_FROM`
is currently an SMS number (no `whatsapp:` prefix), so the WhatsApp path never
activates today.**

---

## What's MISSING / what I'd build

The send/receive code reuses the **same** Twilio sender and the **same** inbound
webhook as SMS, so if we go the Twilio route there is **almost no new code** — just
configuration. The two viable routes:

### Route A (recommended): WhatsApp via Twilio
- Reuses `functions/lib/twilio.js` and `functions/api/twilio-inbound.js` as-is.
- The only code-side change: send WhatsApp through a WhatsApp-enabled sender. Either:
  - set `TWILIO_FROM = "whatsapp:+1XXXXXXXXXX"` (then ALL automation texts go via
    WhatsApp), **or**
  - add a `TWILIO_WHATSAPP_FROM` env and a tiny branch so SMS and WhatsApp can run
    side-by-side (a ~5-line change in `sendText` to pick the sender per channel).
    **This is the only code I'd write** — and only if Luis wants both channels at once.
- WhatsApp **template messages**: business-initiated WhatsApp messages (reminders,
  win-backs sent outside a 24h window) must use **pre-approved templates**. I'd
  register the 3–4 templates (reminder/review/win-back) in Twilio Content Template
  Builder and have the automations pick the template — a small follow-up once the
  sender is live. Free-form replies within 24h of a customer message need no template.

### Route B: WhatsApp via Meta Cloud API (direct)
- A different API surface — would need a **new** `functions/lib/whatsapp.js` sender,
  a **new** inbound webhook (`/api/whatsapp-inbound`) with Meta's verification
  handshake + payload shape, and a separate webhook-verify token. More code, but no
  Twilio per-message markup. Only worth it at high volume. Not recommended for launch.

---

## What Luis does (get an official WhatsApp sender)

Via **Twilio (Route A)** — fastest path:

1. **Twilio Console → Messaging → Senders → WhatsApp senders → "Create new sender".**
2. **Connect a Meta WhatsApp Business Account (WABA).** Twilio walks an embedded
   signup: log in with the Facebook/Meta Business account, create or select a
   **Meta Business Manager**, and verify the business (legal name, address, website
   `guileoai.com`). Business verification may require a document (utility bill / EIN
   letter / incorporation cert).
3. **Choose the WhatsApp number.** Use a number NOT already on a personal/regular
   WhatsApp app (a fresh Twilio number, or a number you control that's never been
   registered on consumer WhatsApp). Verify it via the code Twilio/Meta sends.
4. **Set the display name** (e.g. "Guileo" or the client's business name) — Meta
   reviews it. Pick a profile photo + business category.
5. **Set the inbound webhook** for the WhatsApp sender to
   `https://guileoai.com/api/twilio-inbound` (same endpoint as SMS).
6. Tell me the approved WhatsApp number so I can set the env.

---

## What the dev (me) wires

1. Set env in Cloudflare Pages (Production):
   - Option 1 (WhatsApp-only): `TWILIO_FROM = "whatsapp:+1XXXXXXXXXX"`.
   - Option 2 (SMS + WhatsApp both): add `TWILIO_WHATSAPP_FROM = "whatsapp:+1XXXXXXXXXX"`
     and make the ~5-line `sendText` branch (the only real code change).
2. Register the reminder/review/win-back **WhatsApp message templates** in Twilio
   Content Template Builder and reference them in `automations.js` for
   business-initiated sends (so they deliver outside the 24h session window).
3. (Optional polish) Swap the marketing `wa.me/19295350191` deep-links to point at
   the new business WhatsApp number so "Start on WhatsApp" reaches the AI agent,
   not Luis's personal phone (`src/i18n.jsx`, `emailTemplates.js:709`).

Env vars involved: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`
(or new `TWILIO_WHATSAPP_FROM`), `ANTHROPIC_API_KEY`, `INGEST_SECRET`.

---

## Cost & timeline

| Item | Cost | Timeline |
|---|---|---|
| Meta business verification | free | **1–5 business days** (longer if docs requested) |
| WhatsApp sender approval (Twilio + Meta) | free to register | hours–days after verification |
| Display-name approval | free | hours–2 days |
| Template approval (each) | free | minutes–24h per template |
| Per-message (Twilio) | ~$0.005 Twilio fee + Meta's per-conversation rate (varies by country/category, ~$0.01–0.08) | n/a |

**Bottom line:** the code is essentially ready. Luis's job is the Meta business
verification + WhatsApp sender setup (~1 week, free). My job is one env var (plus an
optional ~5-line dual-channel tweak) and registering 3–4 templates. No big build.
