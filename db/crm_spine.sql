-- ============================================================================
-- Guileo · COMPANY OS — CRM contact spine (phase 1)  (paste in Supabase → SQL Editor → Run)
-- Project: ynihodbknhjirkdogxby (smart@guileoai.com)
-- The single canonical contact record per person, per tenant. Every department resolves to it.
-- Phase 1 = the spine + resolve/list. Deals, timeline, segments, dedupe come in later phases.
-- Gated by the same _gui_sched_ok(secret) the scheduling engine uses.
-- ============================================================================

create table if not exists public.crm_contacts (
  id            uuid primary key default gen_random_uuid(),
  client_email  text not null,                              -- the TENANT (which business owns this contact)
  phone         text,                                       -- E.164
  email         text,
  full_name     text,
  lifecycle     text not null default 'lead',               -- lead | active | loyal | lapsed | churned | vip
  lead_source   text,
  ltv_cents     bigint not null default 0,
  visit_count   int not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  churn_risk    int not null default 0,                     -- 0-100
  consent_sms   boolean not null default true,
  consent_call  boolean not null default true,
  tags          jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- one live contact per (tenant, phone) and (tenant, email)
create unique index if not exists crm_contacts_tenant_phone on public.crm_contacts (client_email, phone) where phone is not null;
create unique index if not exists crm_contacts_tenant_email on public.crm_contacts (client_email, lower(email)) where email is not null;
create index if not exists crm_contacts_tenant_seen on public.crm_contacts (client_email, last_seen_at desc);
alter table public.crm_contacts enable row level security;

-- RESOLVE-OR-CREATE — called on every event (ring time) so a first-time caller is a full record at once.
-- Matches on phone first, then email; bumps visit_count + last_seen; adds money to ltv when provided.
create or replace function public.crm_upsert_contact(
  p_secret text, p_email text, p_phone text, p_contact_email text,
  p_name text default null, p_source text default null, p_amount_cents bigint default 0
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_tenant text := lower(trim(p_email)); v_phone text := nullif(regexp_replace(coalesce(p_phone,''),'[^0-9+]','','g'),'');
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  select id into v_id from crm_contacts
    where client_email = v_tenant
      and ( (v_phone is not null and phone = v_phone)
            or (p_contact_email is not null and lower(email) = lower(p_contact_email)) )
    order by last_seen_at desc limit 1;
  if v_id is null then
    insert into crm_contacts(client_email, phone, email, full_name, lead_source, visit_count, ltv_cents, last_seen_at)
    values (v_tenant, v_phone, nullif(p_contact_email,''), nullif(p_name,''), p_source, 1, greatest(coalesce(p_amount_cents,0),0), now())
    returning id into v_id;
  else
    update crm_contacts set
      visit_count = visit_count + 1,
      last_seen_at = now(),
      ltv_cents = ltv_cents + greatest(coalesce(p_amount_cents,0),0),
      full_name = coalesce(nullif(p_name,''), full_name),
      email = coalesce(nullif(p_contact_email,''), email),
      phone = coalesce(v_phone, phone),
      lifecycle = case when coalesce(p_amount_cents,0) > 0 and lifecycle in ('lead','lapsed','churned') then 'active' else lifecycle end,
      updated_at = now()
    where id = v_id;
  end if;
  return v_id;
end $$;

-- LIST the contact book (newest activity first) for the Cockpit CRM view.
create or replace function public.crm_list_contacts(p_secret text, p_email text, p_limit int default 200)
returns table(id uuid, full_name text, phone text, email text, lifecycle text, ltv_cents bigint, visit_count int, last_seen_at timestamptz, churn_risk int, tags jsonb)
language plpgsql security definer set search_path = public as $$
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  return query
    select c.id, c.full_name, c.phone, c.email, c.lifecycle, c.ltv_cents, c.visit_count, c.last_seen_at, c.churn_risk, c.tags
    from crm_contacts c where c.client_email = lower(trim(p_email))
    order by c.last_seen_at desc limit greatest(1, least(p_limit, 1000));
end $$;

grant execute on function public.crm_upsert_contact(text,text,text,text,text,text,bigint) to anon;
grant execute on function public.crm_list_contacts(text,text,int) to anon;

-- ✅ Done. /api/crm reads crm_list_contacts; the agent funnel (lead.js/call.js/agent-action) will call
--    crm_upsert_contact so every interaction builds the contact spine. Phase 2 = deals + 360 timeline.
