-- ============================================================================
-- GUILEO · CLIENT LEAD STATUS — the client's own working status per lead (novo→contatado→fechado/
-- perdido), persisted so "Leads do dia" survives a refresh / another device. Applied via MCP
-- 2026-07-30; committed for audit. Tenant-scoped by client_email; the HTTP layer (functions/api/
-- crm.js, actions lead_status_map / lead_status_set) validates email↔key via get_client_data BEFORE
-- calling these, and passes the AUTHENTICATED email. RPCs SERVICE_ROLE-ONLY. Project ynihodbknhjirkdogxby.
-- ============================================================================
create table if not exists public.client_lead_status (
  client_email text not null,
  lead_id      text not null,
  status       text not null default 'novo',
  updated_at   timestamptz not null default now(),
  primary key (client_email, lead_id)
);
create index if not exists idx_client_lead_status_owner on public.client_lead_status (client_email, updated_at desc);
alter table public.client_lead_status enable row level security;

create or replace function public._cls_ok(p_secret text) returns boolean
language sql immutable as $$ select p_secret = 'glo_ing_c7f2a9e4b8d16350' $$;

create or replace function public.client_lead_status_set(p_secret text, p_email text, p_lead_id text, p_status text)
returns boolean language plpgsql security definer set search_path=public as $$
declare c text := lower(trim(coalesce(p_email,''))); s text := lower(coalesce(p_status,'novo'));
begin
  if not public._cls_ok(p_secret) then raise exception 'unauthorized' using errcode='28000'; end if;
  if c='' or coalesce(p_lead_id,'')='' then return false; end if;
  if s not in ('novo','contatado','fechado','perdido') then s := 'novo'; end if;
  insert into public.client_lead_status(client_email, lead_id, status, updated_at)
    values (c, left(p_lead_id,120), s, now())
  on conflict (client_email, lead_id) do update set status=excluded.status, updated_at=now();
  return true;
end $$;

create or replace function public.client_lead_status_map(p_secret text, p_email text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c text := lower(trim(coalesce(p_email,''))); v jsonb;
begin
  if not public._cls_ok(p_secret) then raise exception 'unauthorized' using errcode='28000'; end if;
  if c='' then return '{}'::jsonb; end if;
  select coalesce(jsonb_object_agg(lead_id, status), '{}'::jsonb) into v
    from public.client_lead_status where client_email=c;
  return v;
end $$;

revoke all on function public.client_lead_status_set(text,text,text,text) from public;
revoke all on function public.client_lead_status_set(text,text,text,text) from anon;
revoke all on function public.client_lead_status_map(text,text) from public;
revoke all on function public.client_lead_status_map(text,text) from anon;
grant execute on function public.client_lead_status_set(text,text,text,text) to service_role;
grant execute on function public.client_lead_status_map(text,text) to service_role;
