-- ============================================================================
-- GUILEO · SELLER LEAD CRM — persists the Lead Boss board per seller (status/notes/activity log).
-- Applied via MCP 2026-07-29; committed here for auditability + reproducibility.
-- Project ynihodbknhjirkdogxby. Idempotent. RPCs are SERVICE_ROLE-ONLY (revoke anon) — the HTTP
-- layer (functions/api/seller-leads.js) authenticates the seller and passes the AUTHENTICATED email;
-- only ROSTER sellers (personal code) reach the DB (team-code path stays localStorage-only).
-- ============================================================================
create table if not exists public.seller_lead_crm (
  seller_email text not null,
  lead_id      text not null,
  status       text not null default 'novo',
  notes        text default '',
  log          jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now(),
  primary key (seller_email, lead_id)
);
create index if not exists idx_seller_lead_crm_owner on public.seller_lead_crm (seller_email, updated_at desc);
alter table public.seller_lead_crm enable row level security;

create or replace function public._slc_ok(p_secret text) returns boolean
language sql immutable as $$ select p_secret = 'glo_ing_c7f2a9e4b8d16350' $$;

create or replace function public.seller_lead_crm_upsert(
  p_secret text, p_seller_email text, p_lead_id text, p_status text, p_notes text, p_log jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_seller text := lower(trim(coalesce(p_seller_email,''))); v_status text := lower(coalesce(p_status,'novo'));
begin
  if not public._slc_ok(p_secret) then raise exception 'unauthorized' using errcode='28000'; end if;
  if v_seller='' or coalesce(p_lead_id,'')='' then return null; end if;
  if v_status not in ('novo','contatado','agendado','fechado') then v_status := 'novo'; end if;
  insert into public.seller_lead_crm(seller_email, lead_id, status, notes, log, updated_at)
    values (v_seller, p_lead_id, v_status, left(coalesce(p_notes,''),2000), coalesce(p_log,'[]'::jsonb), now())
  on conflict (seller_email, lead_id) do update
    set status=excluded.status, notes=excluded.notes, log=excluded.log, updated_at=now();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.seller_lead_crm_list(p_secret text, p_seller_email text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_seller text := lower(trim(coalesce(p_seller_email,''))); v jsonb;
begin
  if not public._slc_ok(p_secret) then raise exception 'unauthorized' using errcode='28000'; end if;
  if v_seller='' then return '{}'::jsonb; end if;
  select coalesce(jsonb_object_agg(lead_id, jsonb_build_object('status',status,'notes',notes,'log',log)), '{}'::jsonb)
    into v from public.seller_lead_crm where seller_email=v_seller;
  return v;
end $$;

create or replace function public.seller_lead_crm_all(p_secret text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
  if not public._slc_ok(p_secret) then raise exception 'unauthorized' using errcode='28000'; end if;
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into v from (
    select seller_email, count(*) as leads,
           count(*) filter (where status='fechado') as closed,
           count(*) filter (where status<>'novo') as worked,
           max(updated_at) as last_activity
    from public.seller_lead_crm group by seller_email order by closed desc, worked desc
  ) t;
  return v;
end $$;

revoke all on function public.seller_lead_crm_upsert(text,text,text,text,text,jsonb) from public;
revoke all on function public.seller_lead_crm_upsert(text,text,text,text,text,jsonb) from anon;
revoke all on function public.seller_lead_crm_list(text,text) from public;
revoke all on function public.seller_lead_crm_list(text,text) from anon;
revoke all on function public.seller_lead_crm_all(text) from public;
revoke all on function public.seller_lead_crm_all(text) from anon;
grant execute on function public.seller_lead_crm_upsert(text,text,text,text,text,jsonb) to service_role;
grant execute on function public.seller_lead_crm_list(text,text) to service_role;
grant execute on function public.seller_lead_crm_all(text) to service_role;
