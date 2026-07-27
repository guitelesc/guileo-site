-- ─────────────────────────────────────────────────────────────────────────────
-- STRIPE CONNECT — let each client receive payments in THEIR OWN Stripe account.
-- When the Gui charges on a call (invoice/deposit), the payment link is created ON the
-- client's connected account (direct charge), so the money lands with the client (not Guileo);
-- Guileo can take an automatic application fee (env GUILEO_FEE_PCT).
--
-- Stores the client's connected account id + whether charges are enabled (onboarding complete).
-- Same INGEST gate literal as set_client_number / add_client_credits. Paste in the SQL Editor
-- (project ynihodbknhjirkdogxby, account smart@guileoai.com).
--
-- ⚠️ ALSO required (one-time, Luis): enable Connect on the Guileo Stripe account
--    Stripe Dashboard → Connect → Get started (set the platform profile + branding).
--    Without it, creating connected accounts via the API fails.
-- ─────────────────────────────────────────────────────────────────────────────

-- Upsert the client's connected Stripe account + readiness flag.
create or replace function public.set_client_stripe(p_secret text, p_email text, p_account_id text, p_charges_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  insert into client_integrations (client_email, provider, tokens)
  values (lower(trim(p_email)), 'stripe_connect',
          jsonb_build_object('account_id', p_account_id, 'charges_enabled', coalesce(p_charges_enabled, false)))
  on conflict (client_email, provider) do update
    set tokens = jsonb_build_object('account_id', excluded.tokens->>'account_id', 'charges_enabled', excluded.tokens->'charges_enabled'),
        updated_at = now();
  return true;
end
$$;

-- Read the client's connected Stripe account ({account_id, charges_enabled}) or null.
create or replace function public.client_stripe_lookup(p_secret text, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return (
    select tokens
    from client_integrations
    where client_email = lower(trim(p_email)) and provider = 'stripe_connect'
    limit 1
  );
end
$$;
