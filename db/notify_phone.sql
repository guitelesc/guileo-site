-- ─────────────────────────────────────────────────────────────────────────────
-- OWNER ALERT PHONE — the business owner's mobile for instant SMS alerts ("📅 new booking!").
-- The Gui already EMAILS the owner on every order/booking/lead; if they set an alert phone here,
-- it ALSO texts them. Stored in client_integrations (provider='notify_phone'). INGEST-gated.
-- Paste in the Supabase SQL Editor (project ynihodbknhjirkdogxby, account smart@guileoai.com).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.set_client_notify_phone(p_secret text, p_email text, p_phone text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  insert into client_integrations (client_email, provider, tokens)
  values (lower(trim(p_email)), 'notify_phone',
          jsonb_build_object('phone', regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g')))
  on conflict (client_email, provider) do update set tokens = excluded.tokens, updated_at = now();
  return true;
end
$$;

create or replace function public.client_notify_phone_lookup(p_secret text, p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return (
    select tokens->>'phone'
    from client_integrations
    where client_email = lower(trim(p_email)) and provider = 'notify_phone'
    limit 1
  );
end
$$;
