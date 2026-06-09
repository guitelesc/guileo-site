# Guileo — Backend Setup Checklist 🌱

A short, friendly checklist to finish wiring up the backend (emails + client database).
No code needed — just clicking around in a few dashboards. Do these in order.

---

## 1. Verify the Resend email domain
- Log in to **resend.com → Domains**.
- Add and verify **guileoai.com** (add the DNS records they give you in Cloudflare).
- Until it's verified, emails still send from a temporary Resend address (`onboarding@resend.dev`) — everything works, it just doesn't say "from guileoai.com" yet.
- ✅ Once the domain shows **Verified**, do step 2b.

## 2. Cloudflare Pages environment variables
Go to **Cloudflare → Pages → guileoai → Settings → Environment variables**.
- **RESEND_API_KEY** — ✅ already set. (This is what lets us send email.)
- **EMAIL_FROM** _(optional, step 2b)_ — once the Resend domain is verified, add:
  `Guileo <noreply@guileoai.com>`
  This makes welcome emails come from your own domain instead of the temporary one.
- **OWNER_EMAIL** _(optional)_ — the inbox that gets a ping on every new lead/signup.
  Defaults to `smart@guileoai.com`. Set it here if you want them to go somewhere else.
- After changing any variable, click **Save** and **redeploy** so it takes effect.

## 3. Supabase email + site settings
Go to **Supabase → project ynihodbknhjirkdogxby → Authentication → URL Configuration**.
- Set **Site URL** to `https://guileoai.com` (so confirmation/login links point to the live site).
- Add `https://guileoai.com/portal` under **Redirect URLs** if it isn't there.
- _(Optional)_ Under **Project Settings → Auth → SMTP**, plug in your own SMTP (e.g. Resend SMTP)
  so login/confirmation emails come from guileoai.com too. Skippable for now — Supabase's
  built-in sender works for testing.

## 4. Create the clients database table
- Open **Supabase → SQL Editor**.
- Open the file **`db/clients.sql`** from this repo, copy everything, paste it in, and click **Run**.
- This creates the `clients` table where each signed-up user gets their own secure row
  (plan, credits, business info). Row-level security is built in — users can only see their own data.

---

That's it. Once steps 1–4 are done, signups get a branded welcome email and every client
has a home in the database. 🎉
