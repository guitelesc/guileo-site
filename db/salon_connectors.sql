-- ─────────────────────────────────────────────────────────────────────────────
-- SALON CONNECTORS — creds lookups for Square Appointments + Booksy + Vagaro.
-- Same pattern as db/mindbody.sql (mb_creds_lookup): the creds are WRITTEN by the
-- connector's "connect" action via store_integration (client_integrations, already live
-- in prod); these READ them. INGEST-gated (hardcoded literal — Supabase forbids GUC).
-- Idempotent. Paste in Supabase (ynihodbknhjirkdogxby).
-- ─────────────────────────────────────────────────────────────────────────────

-- SQUARE APPOINTMENTS — tokens = { access_token, location_id }
create or replace function public.square_creds_lookup(p_secret text, p_email text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return (
    select tokens
    from client_integrations
    where client_email = lower(trim(p_email)) and provider = 'square'
    limit 1
  );
end $$;
grant execute on function public.square_creds_lookup(text, text) to anon;

-- BOOKSY — tokens = whatever the tenant supplies today (business_id, api_key…), stored
-- for the day Booksy opens a public API / partnership. Read-only lookup, same gate.
create or replace function public.booksy_creds_lookup(p_secret text, p_email text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return (
    select tokens
    from client_integrations
    where client_email = lower(trim(p_email)) and provider = 'booksy'
    limit 1
  );
end $$;
grant execute on function public.booksy_creds_lookup(text, text) to anon;

-- VAGARO — tokens = { client_id, client_secret, region, business_id } from the salon's OWN
-- approved Vagaro API access (merchant-enabled, $10/mo, manual review). Read-only lookup, same gate.
create or replace function public.vagaro_creds_lookup(p_secret text, p_email text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return (
    select tokens
    from client_integrations
    where client_email = lower(trim(p_email)) and provider = 'vagaro'
    limit 1
  );
end $$;
grant execute on function public.vagaro_creds_lookup(text, text) to anon;
