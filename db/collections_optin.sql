-- ============================================================================
-- Guileo · COMPANY OS — AUTO-COLLECTIONS OPT-IN (paste in Supabase → SQL Editor → Run)
-- Project: ynihodbknhjirkdogxby (smart@guileoai.com). Paste AFTER db/receivables.sql.
-- The weekly auto-collections sweep (/api/collections?token=DIGEST_TOKEN&sweep=1) only
-- nudges tenants who OPTED IN. Stored in client_integrations (provider='collections_auto'),
-- same pattern as notify_phone. Default is OFF — no rows, no sweeps. The per-tenant manual
-- "Cobrar" button in the cockpit keeps working for everyone regardless. INGEST-gated.
-- ============================================================================

-- Turn autonomous collections ON/OFF for a tenant (future cockpit toggle calls this).
create or replace function public.collections_set_auto(p_secret text, p_email text, p_on boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  insert into client_integrations (client_email, provider, tokens)
  values (lower(trim(p_email)), 'collections_auto', jsonb_build_object('on', case when p_on then '1' else '0' end))
  on conflict (client_email, provider) do update set tokens = excluded.tokens, updated_at = now();
  return true;
end $$;

-- Is this tenant opted in? (cockpit reads this to render the toggle state)
create or replace function public.collections_auto_enabled(p_secret text, p_email text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select tokens->>'on' = '1'
    from client_integrations
    where client_email = lower(trim(p_email)) and provider = 'collections_auto'
    limit 1
  ), false);
end $$;

-- Every tenant who opted in — the ONLY clients the cron sweep will ever touch.
create or replace function public.collections_auto_list(p_secret text)
returns table(client_email text) language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return query
    select ci.client_email
    from client_integrations ci
    where ci.provider = 'collections_auto' and ci.tokens->>'on' = '1';
end $$;

grant execute on function public.collections_set_auto(text,text,boolean) to anon;
grant execute on function public.collections_auto_enabled(text,text) to anon;
grant execute on function public.collections_auto_list(text) to anon;

-- ✅ Done. The weekly sweep stays a graceful no-op until a tenant is opted in via
--    collections_set_auto(secret, email, true).
