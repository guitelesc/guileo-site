-- Paste in Supabase → SQL Editor → Run · project ynihodbknhjirkdogxby (also saved at db/number_pool.sql)
-- Idempotent. Until pasted, self-serve auto-assign stays inert and falls back honestly to 'shared/pending'.
create table if not exists number_claims (
  number       text primary key,
  client_email text not null,
  claimed_at   timestamptz not null default now()
);
create index if not exists idx_number_claims_email on number_claims(client_email);
alter table number_claims enable row level security;

create or replace function public._pool_ok(p_secret text) returns boolean
language sql immutable as $$ select p_secret is not distinct from 'glo_ing_c7f2a9e4b8d16350' $$;

create or replace function public.pool_claim_number(p_secret text, p_email text, p_number text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_email));
  v_digits text := regexp_replace(coalesce(p_number,''), '[^0-9]', '', 'g');
  v_owner  text;
begin
  if not public._pool_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_digits = '' then return false; end if;
  if v_digits = '19864443334' then return false; end if;   -- reserved platform demo line
  if v_tenant = '' or position('@' in v_tenant) = 0 then return false; end if;
  select client_email into v_owner from number_claims where number = p_number;
  if v_owner is not null then return v_owner = v_tenant; end if;
  insert into number_claims(number, client_email) values (p_number, v_tenant)
    on conflict (number) do nothing;
  return exists(select 1 from number_claims where number = p_number and client_email = v_tenant);
end $$;
grant execute on function public.pool_claim_number(text,text,text) to anon;

create or replace function public.pool_release_number(p_secret text, p_number text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._pool_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  delete from number_claims where number = p_number;
  return found;
end $$;
grant execute on function public.pool_release_number(text,text) to anon;