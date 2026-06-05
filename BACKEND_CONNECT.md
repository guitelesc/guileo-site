# Connecting the Growth Cockpit to Supabase

This is the step-by-step to take the Growth Cockpit (`/portal`) from **Demo mode**
to a **live, real backend**. You only edit ONE source file: `src/lib/portalApi.js`.
No screens change. Take it slow — each step is copy-pasteable.

> **The big idea:** the whole dashboard already routes every read/write through
> `src/lib/portalApi.js`. Today those methods read/write `localStorage` (demo).
> Each one has a `// CONNECT:` comment showing the real Supabase line. You swap
> the demo body for the real body, table by table. That's it.

---

## Step 1 — Create the Supabase project & run the schema

1. Go to https://supabase.com → **New project**. Pick a name (e.g. `guileo`),
   a strong database password, and a region close to your users.
2. Wait ~2 min for it to provision.
3. Left sidebar → **SQL Editor** → **New query**.
4. Open `supabase/schema.sql` from this repo, copy the **entire** file, paste it
   in, and click **Run**. You should see "Success. No rows returned." This
   creates all 21 tables, indexes, and the Row Level Security rules.
5. Left sidebar → **Project Settings** → **API**. Copy these two values:
   - **Project URL** → looks like `https://abcdxyz.supabase.co`
   - **anon / public** key → a long string starting with `eyJ...`

   > These two are the ONLY things the website needs. The anon key is safe to
   > put in the frontend (see the Security note at the bottom). **Never** copy
   > the `service_role` key into the website.

---

## Step 2 — Set the keys in Cloudflare Pages (then redeploy)

These are **build-time** variables (Vite bakes `VITE_*` vars in at build), so
after setting them you MUST trigger a new deploy.

1. Cloudflare dashboard → **Workers & Pages** → **guileoai** → **Settings** →
   **Environment variables**.
2. Add two variables (set them for **Production**, and **Preview** if you test there):

   | Name                     | Value                              |
   | ------------------------ | ---------------------------------- |
   | `VITE_SUPABASE_URL`      | `https://abcdxyz.supabase.co`      |
   | `VITE_SUPABASE_ANON_KEY` | `eyJ...` (the anon/public key)     |

3. **Redeploy** so the new vars take effect: Deployments → **Retry deployment**
   on the latest, or push a commit. Once live, `portalApi.js`'s `CONNECTED`
   flag flips to `true` and the sidebar stops saying "Demo mode".

---

## Step 3 — Install the Supabase client & create it

```bash
npm i @supabase/supabase-js
```

Create a new file `src/lib/supabase.js`:

```js
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Single shared client for the whole app.
export const supabase = createClient(url, key);
```

Then at the top of `src/lib/portalApi.js`, import it:

```js
import { supabase } from "./supabase";
```

> **About `tenant_id`:** every domain table is tenant-scoped. After login you
> know the user's tenant from their profile. Fetch it once and cache it, e.g.:
>
> ```js
> async function tenantId() {
>   const { data: { user } } = await supabase.auth.getUser();
>   if (!user) return null;
>   const { data } = await supabase
>     .from("profiles").select("tenant_id").eq("id", user.id).single();
>   return data?.tenant_id ?? null;
> }
> ```
>
> RLS will also block any cross-tenant access on the server side, so this is for
> filling in `tenant_id` on inserts, not for security.

---

## Step 4 — Replace each `// CONNECT:` branch

Below: the **demo body** that's there now (BEFORE) and the **real body** to put
in its place (AFTER). Method names and argument shapes are exactly as they exist
in `src/lib/portalApi.js` today.

### 4.1 — Auth: `session()`, `login(email)`, `logout()`

```js
// BEFORE — session()
try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
// AFTER
const { data } = await supabase.auth.getSession();
return data.session;
```

```js
// BEFORE — login(email)  (note: the screen also collects a password)
const sess = { email: email || "demo@guileo.ai", name: "Jane Staff", role: "Staff", demo: !CONNECTED, at: Date.now() };
try { localStorage.setItem(SESSION_KEY, JSON.stringify(sess)); } catch {}
return sess;
// AFTER
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
if (error) throw error;
return data.session;
```

> `login` currently takes only `email`. Pass the password through from the login
> screen (it already collects email+password) — update the signature to
> `login(email, password)`. The login form calls `portalApi.login(...)`, so add
> the second argument there too. (This is the one spot where a screen passes an
> extra arg; nothing else changes.)

```js
// BEFORE — logout()
try { localStorage.removeItem(SESSION_KEY); } catch {}
return true;
// AFTER
await supabase.auth.signOut();
return true;
```

### 4.2 — Generic reads/writes: `list`, `sendMessage`, `updateStatus`, `resolveAlert`

```js
// BEFORE — list(table, fallback = [])
await wait(200); return fallback;
// AFTER  (scope to tenant; RLS also enforces this server-side)
const { data } = await supabase
  .from(table).select("*")
  .eq("tenant_id", await tenantId())
  .order("created_at", { ascending: false });
return data ?? fallback;
```

```js
// BEFORE — sendMessage(channel, conversationId, text)
await wait(150); return { ok: true, id: Date.now(), text, at: Date.now() };
// AFTER  (column is `sender`, not `from` — "from" is a reserved word)
const { data, error } = await supabase.from("messages").insert({
  tenant_id: await tenantId(),
  conversation_id: conversationId,
  channel,
  body: text,
  sender: "human",
}).select().single();
if (error) throw error;
return { ok: true, id: data.id, text, at: data.created_at };
```

```js
// BEFORE — updateStatus(table, id, status)
await wait(120); return { ok: true, id, status };
// AFTER
const { error } = await supabase.from(table).update({ status }).eq("id", id);
if (error) throw error;
return { ok: true, id, status };
```

```js
// BEFORE — resolveAlert(id)
await wait(120); return { ok: true, id };
// AFTER
const { error } = await supabase.from("alerts")
  .update({ resolved_at: new Date().toISOString() }).eq("id", id);
if (error) throw error;
return { ok: true, id };
```

### 4.3 — Knowledge base: `loadKB(vertical, seed)` / `saveKB(vertical, entries)` → `kb_entries`

```js
// BEFORE — loadKB(vertical, seed = [])
try { const raw = localStorage.getItem(`guileo_kb_${vertical}`); if (raw) return JSON.parse(raw); } catch {}
return seed;
// AFTER  (make the method async)
const { data } = await supabase.from("kb_entries").select("*")
  .eq("tenant_id", await tenantId());
return data?.length ? data : seed;
```

```js
// BEFORE — saveKB(vertical, entries)
try { localStorage.setItem(`guileo_kb_${vertical}`, JSON.stringify(entries)); } catch {}
return { ok: true, count: entries.length };
// AFTER  (upsert the whole set; stamp tenant + vertical)
const tid = await tenantId();
const rows = entries.map((e) => ({ ...e, tenant_id: tid, vertical }));
const { error } = await supabase.from("kb_entries").upsert(rows);
if (error) throw error;
return { ok: true, count: entries.length };
```

### 4.4 — Business profile: `loadProfile(vertical, seed)` / `saveProfile(vertical, profile)` → `business_profile`

```js
// BEFORE — loadProfile(vertical, seed = {})
try { const raw = localStorage.getItem(`guileo_profile_${vertical}`); if (raw) return { ...seed, ...JSON.parse(raw) }; } catch {}
return seed;
// AFTER  (one row per tenant; tenant_id is the PK)
const { data } = await supabase.from("business_profile").select("*")
  .eq("tenant_id", await tenantId()).maybeSingle();
return data ? { ...seed, ...data } : seed;
```

```js
// BEFORE — saveProfile(vertical, profile)
try { localStorage.setItem(`guileo_profile_${vertical}`, JSON.stringify(profile)); } catch {}
return { ok: true };
// AFTER  (upsert by tenant_id)
const { error } = await supabase.from("business_profile").upsert({
  tenant_id: await tenantId(),
  vertical,
  ...profile,
});
if (error) throw error;
return { ok: true };
```

### 4.5 — Durable UI state: `loadState(key, fallback)` / `saveState(key, value)` → `ui_state`

These power resolved alerts, won follow-ups, filled waitlist, read-flags, the
integration/own-delivery toggles, and the `created:*` "from chat" records. The
table is keyed by `(tenant_id, key)` and the value is a `jsonb` blob — so the
mapping is 1:1 with the localStorage version.

```js
// BEFORE — loadState(key, fallback)
try { const raw = localStorage.getItem(`guileo_state_${key}`); if (raw != null) return JSON.parse(raw); } catch {}
return fallback;
// AFTER  (make async)
const { data } = await supabase.from("ui_state").select("value")
  .eq("tenant_id", await tenantId()).eq("key", key).maybeSingle();
return data ? data.value : fallback;
```

```js
// BEFORE — saveState(key, value)
try { localStorage.setItem(`guileo_state_${key}`, JSON.stringify(value)); } catch {}
return { ok: true };
// AFTER  (upsert on the (tenant_id, key) primary key)
const { error } = await supabase.from("ui_state")
  .upsert(
    { tenant_id: await tenantId(), key, value, updated_at: new Date().toISOString() },
    { onConflict: "tenant_id,key" }
  );
if (error) throw error;
return { ok: true };
```

### 4.6 — The `created:*` records → real `orders` / `bookings` / `deliveries` inserts

Today "Create order / Book appointment / Create delivery from a chat" stores a
row via `saveState("<Label>:created:liveorders" | ":created:schedule" |
":created:deliveries", ...)`. Once you're live you have two choices:

- **Easy (zero extra work):** keep using `ui_state` via `saveState` — the
  mapping in 4.5 already persists these. Good enough to go live.
- **Proper (recommended next):** insert into the real operational tables so the
  data shows up in reports and integrations. The `created:*` keys map directly:

  | `created:*` key                 | Real table   |
  | ------------------------------- | ------------ |
  | `<Label>:created:liveorders`    | `orders`     |
  | `<Label>:created:schedule`      | `bookings`   |
  | `<Label>:created:deliveries`    | `deliveries` |

  Example — when ConvoActions fires "Create order", insert into `orders` and tag
  the source so the existing gold "from chat" badge still renders:

  ```js
  const { data } = await supabase.from("orders").insert({
    tenant_id: await tenantId(),
    ref: order.ref,                 // e.g. "#6337"
    channel: "chat",
    status: "new",
    total_cents: order.total_cents,
    source: "chat",                 // ← drives the "from chat" badge in LiveOrders
  }).select().single();
  ```

  Then `LiveOrders` / `ScheduleScreen` read via `portalApi.list("orders", …)` /
  `list("bookings", …)` instead of `loadCreated()`. Rows tagged `source:'chat'`
  keep their badge. Same pattern for `bookings` and `deliveries`.

> Migrate the easy way first (ui_state), confirm everything works end-to-end,
> then move orders/bookings/deliveries to their real tables when you want them
> in reports. Nothing in the UI breaks either way.

---

## Step 5 — Test it (checklist)

Before relying on it, walk this list once with a real Supabase project connected:

- [ ] Sidebar no longer shows **"Demo mode"** (means `CONNECTED === true`).
- [ ] **Sign up** a test staff user (Supabase → Authentication → Add user), then
      insert their `profiles` row linking them to a `tenants` row (SQL editor):
      ```sql
      insert into tenants (name, vertical) values ('Test Biz', 'restaurant')
        returning id;            -- copy the id
      insert into profiles (id, tenant_id, email, role)
        values ('<auth-user-id>', '<tenant-id>', 'test@you.com', 'owner');
      ```
- [ ] **Log in** on `/portal` with that user → you land in the dashboard.
- [ ] **Train your AI**: add a KB entry → reload → it's still there (came from
      `kb_entries`, not localStorage).
- [ ] **Settings → Business profile**: edit hours → save → reload → persists.
- [ ] **Resolve** a "Needs attention" alert → reload → stays resolved.
- [ ] **Create order from a chat** (Inbox → ConvoActions) → lands in Live Orders,
      survives reload.
- [ ] **Cross-tenant check** (important): create a 2nd tenant + user, log in as
      them → you should see **none** of the first tenant's data. (Proves RLS.)
- [ ] Open the browser **Network** tab during any of the above → calls go to
      `*.supabase.co`, not localStorage.

---

## Security note (read once)

- The **anon / public key** is *designed* to ship in the frontend. It can't read
  or write anything on its own — every table has **Row Level Security**, so a
  request only sees rows where `tenant_id = current_tenant_id()` (your logged-in
  user's tenant). No login → no data.
- **NEVER** put the **`service_role`** key in the website / Cloudflare frontend
  env / git. It bypasses RLS entirely. Use it only in trusted server-side code
  (Edge Functions, your own backend) if you ever need admin access.
- Store any **third-party provider secrets** (Uber Eats, Stripe, Meta Ads
  tokens) in **Supabase Vault** or as Edge Function secrets — never in the
  `integration_connections.config` jsonb and never in the frontend.
- Creating provider apps / pasting their credentials is a **you** action, not
  something to automate from the dashboard.

---

That's the whole connection. Tables live in `supabase/schema.sql`; the only code
you touch is `src/lib/portalApi.js`. Every screen keeps working unchanged.
