-- ─────────────────────────────────────────────────────────────────────────────
-- GOOGLE CALENDAR — read the tenant's stored refresh_token so a booking can be pushed
-- into their Google Calendar (agent-schedule.js gcalPush). gcal-connect.js already WRITES
-- the token via store_integration (client_integrations, provider='gcal'); this READS it.
-- INGEST-gated. Paste in Supabase SQL Editor (project ynihodbknhjirkdogxby).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gcal_token_lookup(p_secret text, p_email text)
returns text
language plpgsql security definer set search_path = public
as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return (
    select tokens->>'refresh_token'
    from client_integrations
    where client_email = lower(trim(p_email)) and provider = 'gcal'
    limit 1
  );
end $$;
grant execute on function public.gcal_token_lookup(text, text) to anon;
