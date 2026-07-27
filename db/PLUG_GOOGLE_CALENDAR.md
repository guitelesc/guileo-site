# PLUG: Google Calendar — OAuth for Client Bookings

**Status: PARTIAL (fully coded, awaiting Google Cloud config confirmation).**
The entire OAuth flow is built and the `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
secrets are already in production (per `db/GO_LIVE.md`). What gates it is two checks
in the Google Cloud Console: the **redirect URI** must be registered exactly, the
**Calendar API** must be enabled, and the OAuth **consent screen** must be published
(or the client emails added as test users). Then a client connects their calendar in
one click and Gui mirrors bookings to it.

---

## What's already wired (grep results)

| Piece | Where | State |
|---|---|---|
| OAuth connect flow (both legs) | `functions/api/gcal-connect.js` | ✅ built |
| Leg 1 — consent redirect | `gcal-connect.js:70-81` → builds `accounts.google.com/o/oauth2/v2/auth` URL, scope `calendar.events`, `access_type=offline`, `prompt=consent` | ✅ |
| Leg 2 — token exchange + store | `gcal-connect.js:45-67` → POSTs to `oauth2.googleapis.com/token`, stores `refresh_token` via Supabase RPC `store_integration` (provider `gcal`) | ✅ |
| CSRF-safe state | HMAC-SHA256 of email keyed with `INGEST_SECRET` (`gcal-connect.js:13-35`) — attacker can't bind a victim's tokens to their email | ✅ hardened |
| Tokens storage | `client_integrations` table, RLS-locked (refresh_token + scope) | ✅ |
| Redirect URI (hardcoded) | `gcal-connect.js:11` → `https://guileoai.com/api/gcal-connect` | ✅ |
| Graceful "not configured" | `gcal-connect.js:39-40` → friendly 501 if keys absent | ✅ (keys ARE set, so it's live) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Cloudflare Pages secrets | ✅ present |

**So: nothing to build. The gate is Google Cloud Console configuration matching the
code, and publishing the consent screen.**

---

## What Luis does (Google Cloud Console — ~15 min)

Go to **console.cloud.google.com** (use the Google account that should own the OAuth
app), select/create the Guileo project, then:

### Step 1 — Enable the Calendar API
- **APIs & Services → Library → search "Google Calendar API" → Enable.**
- (Required — token exchange succeeds without it, but calendar writes fail.)

### Step 2 — Confirm the OAuth client + redirect URI (the critical one)
- **APIs & Services → Credentials → the OAuth 2.0 Client ID** (the one whose Client
  ID matches the `GOOGLE_CLIENT_ID` secret).
- Under **Authorized redirect URIs**, confirm this EXACT value is present (no trailing
  slash, https, exact path):
  ```
  https://guileoai.com/api/gcal-connect
  ```
- If missing, add it and Save. This is the single most common reason the flow breaks
  ("redirect_uri_mismatch").

### Step 3 — Configure + publish the OAuth consent screen
- **APIs & Services → OAuth consent screen.**
- User type: **External**.
- App name: **Guileo**; support email: `luistelesc@gmail.com`; app logo (optional).
- App domain / homepage: `https://guileoai.com`; privacy policy + terms URLs
  (e.g. `https://guileoai.com/privacy`, `https://guileoai.com/terms`).
- **Scopes**: add `https://www.googleapis.com/auth/calendar.events` (matches the code).
- **Publishing status**:
  - While in **Testing**, only emails added under "Test users" can connect, and the
    refresh token expires after 7 days — fine for a quick pilot, NOT for real clients.
  - To serve real clients: click **Publish App** → "In production". Because
    `calendar.events` is a **sensitive scope**, Google may require **verification**
    (brand review + possibly a security assessment) before unlimited external users
    can grant access. Until verified, users see an "unverified app" warning they can
    click through, and there's a 100-user cap.
- **Action for Luis:** add the first pilot clients' Google emails as **Test users**
  now (works immediately), and start the **Publish/verification** in parallel for scale.

---

## What the dev (me) wires

**Likely nothing in code** — the flow is complete and keys are set. My checklist:

1. Confirm the secrets in Cloudflare Pages match the Google Cloud OAuth client:
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, plus `INGEST_SECRET` (used for the
   CSRF state HMAC and the `store_integration` call). All already present.
2. Smoke-test: hit `https://guileoai.com/api/gcal-connect?email=test@example.com`
   → should 302 to Google consent (a 501 means a key is missing; a Google error
   page means redirect URI / consent-screen config is off).
3. Confirm the portal exposes a "Connect Google Calendar" button that opens
   `/api/gcal-connect?email=<client_email>` in a popup (the success page tells the
   client to close the window).
4. Confirm the booking writer reads the stored `gcal` refresh token from
   `client_integrations` and mirrors `biz_appointments` events to the client's
   calendar (the scheduling engine — `db/scheduling_engine*.sql`,
   `functions/api/agent-schedule.js`). If that mirror-write isn't built yet, that's
   the one real piece of code remaining; the OAuth/token side is done.

Env vars involved (all present): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`INGEST_SECRET`. Redirect URI is hardcoded to `https://guileoai.com/api/gcal-connect`.

---

## Cost & timeline

| Item | Cost | Timeline |
|---|---|---|
| Google Calendar API usage | **free** (generous quota) | n/a |
| Enable API + redirect URI + test users | free | ~15 min, instant |
| OAuth app verification (for sensitive scope, at scale) | free | **a few days to a few weeks** if Google requires brand/security review |

**Bottom line:** working today for pilot clients added as **test users** — zero code,
~15 min of console clicks (enable API, confirm redirect URI, add test users). For
real-client scale, publish + pass Google's verification (free, days–weeks). The only
possible code task is confirming the booking→calendar mirror-write is wired in the
scheduling engine.
