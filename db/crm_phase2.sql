-- ============================================================================
-- Guileo · COMPANY OS — CRM phase 2: deals + 360° timeline + segments
-- (paste AFTER db/crm_spine.sql, in Supabase → SQL Editor → Run). Gated by _gui_sched_ok.
-- ============================================================================

-- DEALS — opportunities in flight, always tied to a contact. Opened from a quote, won on payment.
create table if not exists public.crm_deals (
  id           uuid primary key default gen_random_uuid(),
  client_email text not null,
  contact_id   uuid references public.crm_contacts(id),
  title        text,
  value_cents  bigint not null default 0,
  stage        text not null default 'inquiry',   -- inquiry | quoted | booked | won | lost
  status       text not null default 'open',      -- open | won | lost
  lost_reason  text,
  source       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists crm_deals_tenant on public.crm_deals (client_email, status, updated_at desc);
create index if not exists crm_deals_contact on public.crm_deals (contact_id);
alter table public.crm_deals enable row level security;

-- 360° TIMELINE — append-only projection of every interaction onto a contact. Idempotent via dedupe_key.
create table if not exists public.crm_timeline_events (
  id           uuid primary key default gen_random_uuid(),
  client_email text not null,
  contact_id   uuid references public.crm_contacts(id),
  event_type   text not null,                     -- call | sms | email | booking | payment | quote | note | automation | stage_change
  channel      text,
  summary      text,
  amount_cents bigint not null default 0,
  occurred_at  timestamptz not null default now(),
  dedupe_key   text,
  payload      jsonb not null default '{}'::jsonb
);
create unique index if not exists crm_timeline_dedupe on public.crm_timeline_events (client_email, dedupe_key) where dedupe_key is not null;
create index if not exists crm_timeline_contact on public.crm_timeline_events (contact_id, occurred_at desc);
alter table public.crm_timeline_events enable row level security;

-- SEGMENTS — saved live audiences (a simple rule, evaluated by the app). One source of truth for outreach.
create table if not exists public.crm_segments (
  id           uuid primary key default gen_random_uuid(),
  client_email text not null,
  name         text not null,
  rule         jsonb not null default '{}'::jsonb,  -- {lifecycle, min_ltv_cents, lapsed_days, tag, consent_sms}
  created_at   timestamptz not null default now()
);
create index if not exists crm_segments_tenant on public.crm_segments (client_email);
alter table public.crm_segments enable row level security;

-- Log a timeline event (idempotent) AND keep the contact's last_seen fresh. Called by the funnel.
create or replace function public.crm_log_event(
  p_secret text, p_email text, p_contact_id uuid, p_type text, p_channel text,
  p_summary text, p_amount_cents bigint default 0, p_dedupe text default null, p_payload jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  insert into crm_timeline_events(client_email, contact_id, event_type, channel, summary, amount_cents, dedupe_key, payload)
  values (lower(trim(p_email)), p_contact_id, p_type, p_channel, left(coalesce(p_summary,''),400), greatest(coalesce(p_amount_cents,0),0), p_dedupe, coalesce(p_payload,'{}'::jsonb))
  on conflict (client_email, dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;
  return v_id;
end $$;

-- Read a contact's full 360° timeline (newest first).
create or replace function public.crm_timeline(p_secret text, p_email text, p_contact_id uuid, p_limit int default 100)
returns table(event_type text, channel text, summary text, amount_cents bigint, occurred_at timestamptz, payload jsonb)
language plpgsql security definer set search_path = public as $$
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  return query select e.event_type, e.channel, e.summary, e.amount_cents, e.occurred_at, e.payload
    from crm_timeline_events e where e.client_email = lower(trim(p_email)) and e.contact_id = p_contact_id
    order by e.occurred_at desc limit greatest(1, least(p_limit, 500));
end $$;

-- Open/advance a deal for a contact (idempotent-ish: reuses the contact's open deal if present).
create or replace function public.crm_deal_upsert(
  p_secret text, p_email text, p_contact_id uuid, p_title text, p_value_cents bigint, p_stage text, p_source text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_status text := case when p_stage = 'won' then 'won' when p_stage = 'lost' then 'lost' else 'open' end;
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  select id into v_id from crm_deals where client_email=lower(trim(p_email)) and contact_id=p_contact_id and status='open' order by updated_at desc limit 1;
  if v_id is null then
    insert into crm_deals(client_email, contact_id, title, value_cents, stage, status, source)
    values (lower(trim(p_email)), p_contact_id, p_title, greatest(coalesce(p_value_cents,0),0), coalesce(p_stage,'inquiry'), v_status, p_source)
    returning id into v_id;
  else
    update crm_deals set stage=coalesce(p_stage,stage), status=v_status, value_cents=greatest(value_cents, coalesce(p_value_cents,0)), title=coalesce(nullif(p_title,''),title), updated_at=now() where id=v_id;
  end if;
  return v_id;
end $$;

grant execute on function public.crm_log_event(text,text,uuid,text,text,text,bigint,text,jsonb) to anon;
grant execute on function public.crm_timeline(text,text,uuid,int) to anon;
grant execute on function public.crm_deal_upsert(text,text,uuid,text,bigint,text,text) to anon;

-- ✅ Done. After this, agent-action/lead can log timeline events + open/win deals tied to each contact,
--    and the Cockpit can show a contact's full 360° history + the sales pipeline.
