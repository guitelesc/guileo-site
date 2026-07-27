-- ═══════════════════════════════════════════════════════════════
-- GUILEO · ATIVAR TUDO — cole ISTO INTEIRO no Supabase SQL Editor
-- (projeto ynihodbknhjirkdogxby · conta smart@guileoai.com) e RUN.
-- Ordem de dependência já resolvida. Tudo idempotente (create or replace /
-- if not exists) — seguro rodar mesmo se parte já existir.
-- Se UMA seção der erro, me manda o erro + o nome da seção que eu conserto.
-- ═══════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: crm_spine.sql
-- ╚══════════════════════════════════════════════════════════
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


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: crm_phase2.sql
-- ╚══════════════════════════════════════════════════════════
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


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: crm_deals_list.sql
-- ╚══════════════════════════════════════════════════════════
-- ============================================================================
-- Guileo · COMPANY OS — CRM deals list (read RPC for the Cockpit pipeline board)
-- (paste AFTER db/crm_phase2.sql, in Supabase → SQL Editor → Run). Gated by _gui_sched_ok.
-- crm_phase2 created crm_deals + crm_deal_upsert (write); this adds the read the board needs.
-- ============================================================================

create or replace function public.crm_deals_list(p_secret text, p_email text, p_limit int default 300)
returns table(
  id uuid, contact_id uuid, contact_name text, title text,
  value_cents bigint, stage text, status text, source text, updated_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  return query
    select d.id, d.contact_id, c.full_name, d.title, d.value_cents, d.stage, d.status, d.source, d.updated_at
    from crm_deals d
    left join crm_contacts c on c.id = d.contact_id
    where d.client_email = lower(trim(p_email))
    order by (d.status = 'open') desc, d.updated_at desc
    limit greatest(1, least(p_limit, 1000));
end $$;

grant execute on function public.crm_deals_list(text,text,int) to anon;

-- ✅ Done. /api/crm action:"deals" reads crm_deals_list → the Cockpit pipeline board (inquiry→quoted→booked→won/lost).


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: crm_marketing.sql
-- ╚══════════════════════════════════════════════════════════
-- ============================================================================
-- Guileo · COMPANY OS — MARKETING department: campaigns + live audience sizing
-- (paste AFTER db/crm_phase2.sql, in Supabase → SQL Editor → Run). Gated by _gui_sched_ok.
-- Segments resolve live against crm_contacts, so "this audience = N people" is always real.
-- ============================================================================

create table if not exists public.crm_campaigns (
  id             uuid primary key default gen_random_uuid(),
  client_email   text not null,
  name           text not null,
  channel        text not null default 'sms',   -- sms | whatsapp | email
  segment        text not null default 'all',   -- all | lead | customer | vip | lapsed | at_risk
  message        text,
  status         text not null default 'draft', -- draft | scheduled | sent
  audience_count int not null default 0,
  sent_count     int not null default 0,
  scheduled_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists crm_campaigns_tenant on public.crm_campaigns (client_email, status, created_at desc);
alter table public.crm_campaigns enable row level security;

-- Count the audience a segment resolves to RIGHT NOW (drives "this segment = N contacts").
create or replace function public.crm_segment_count(p_secret text, p_email text, p_segment text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  select count(*) into n from crm_contacts c
   where c.client_email = lower(trim(p_email))
     and case
       when p_segment = 'all' then true
       when p_segment = 'at_risk' then c.churn_risk >= 50
       when p_segment = 'lapsed' then c.lifecycle in ('lapsed','churned')
       else c.lifecycle = p_segment
     end;
  return coalesce(n, 0);
end $$;

create or replace function public.crm_campaign_upsert(
  p_secret text, p_email text, p_name text, p_channel text, p_segment text, p_message text,
  p_status text default 'draft', p_audience int default 0
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  insert into crm_campaigns(client_email, name, channel, segment, message, status, audience_count)
  values (lower(trim(p_email)), p_name, coalesce(p_channel,'sms'), coalesce(p_segment,'all'), p_message,
          coalesce(p_status,'draft'), greatest(coalesce(p_audience,0),0))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.crm_campaigns_list(p_secret text, p_email text, p_limit int default 200)
returns table(id uuid, name text, channel text, segment text, message text, status text, audience_count int, sent_count int, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  return query select c.id, c.name, c.channel, c.segment, c.message, c.status, c.audience_count, c.sent_count, c.created_at
    from crm_campaigns c where c.client_email = lower(trim(p_email))
    order by c.created_at desc limit greatest(1, least(p_limit, 500));
end $$;

grant execute on function public.crm_segment_count(text,text,text) to anon;
grant execute on function public.crm_campaign_upsert(text,text,text,text,text,text,text,int) to anon;
grant execute on function public.crm_campaigns_list(text,text,int) to anon;

-- ✅ Done. /api/crm action:"campaigns"/"segment_count" power the Cockpit Marketing department.


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: crm_finance.sql
-- ╚══════════════════════════════════════════════════════════
-- ============================================================================
-- Guileo · COMPANY OS — FINANCE department: invoices + A/R + cash-flow
-- (paste AFTER db/crm_phase2.sql, in Supabase → SQL Editor → Run). Gated by _gui_sched_ok.
-- ============================================================================

create table if not exists public.crm_invoices (
  id           uuid primary key default gen_random_uuid(),
  client_email text not null,
  contact_id   uuid references public.crm_contacts(id),
  deal_id      uuid references public.crm_deals(id),
  number       text,
  amount_cents bigint not null default 0,
  status       text not null default 'draft',   -- draft | sent | paid | overdue | void
  due_at       timestamptz,
  paid_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists crm_invoices_tenant on public.crm_invoices (client_email, status, due_at);
create index if not exists crm_invoices_contact on public.crm_invoices (contact_id);
alter table public.crm_invoices enable row level security;

-- Create / advance an invoice. Gui's close&collect opens one and marks it paid on payment.
create or replace function public.crm_invoice_upsert(
  p_secret text, p_email text, p_contact_id uuid, p_amount_cents bigint,
  p_status text default 'sent', p_due_at timestamptz default null, p_number text default null, p_deal_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  insert into crm_invoices(client_email, contact_id, deal_id, number, amount_cents, status, due_at, paid_at)
  values (lower(trim(p_email)), p_contact_id, p_deal_id, p_number, greatest(coalesce(p_amount_cents,0),0),
          coalesce(p_status,'sent'), p_due_at, case when p_status = 'paid' then now() else null end)
  returning id into v_id;
  return v_id;
end $$;

-- List invoices for the A/R view (flags overdue at read time: sent + past due).
create or replace function public.crm_invoices_list(p_secret text, p_email text, p_limit int default 300)
returns table(id uuid, contact_id uuid, contact_name text, number text, amount_cents bigint, status text, due_at timestamptz, paid_at timestamptz, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  return query
    select i.id, i.contact_id, c.full_name, i.number, i.amount_cents,
      case when i.status = 'sent' and i.due_at is not null and i.due_at < now() then 'overdue' else i.status end as status,
      i.due_at, i.paid_at, i.created_at
    from crm_invoices i left join crm_contacts c on c.id = i.contact_id and c.client_email = i.client_email
    where i.client_email = lower(trim(p_email))
    order by (i.status in ('sent','overdue')) desc, coalesce(i.due_at, i.created_at) asc
    limit greatest(1, least(p_limit, 1000));
end $$;

grant execute on function public.crm_invoice_upsert(text,text,uuid,bigint,text,timestamptz,text,uuid) to anon;
grant execute on function public.crm_invoices_list(text,text,int) to anon;

-- ✅ Done. /api/crm action:"invoices" reads crm_invoices_list → the Cockpit Finance A/R board.


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: scheduling_engine.sql
-- ╚══════════════════════════════════════════════════════════
-- ============================================================================
-- GUILEO · MOTOR DE AGENDA (scheduling engine)  — cole TUDO no SQL Editor e RUN.
-- Idempotente (pode rodar de novo). Dá ao Gui o "saber" (unidades, profissionais,
-- serviços, horários) e o "decidir" (slots livres reais, sem furar / sem duplo).
--
-- SEGURANÇA: as funções são SECURITY DEFINER e EXIGEM um segredo dedicado guardado
-- numa GUC do banco. FECHADAS por padrão: sem a GUC certa, retornam 'unauthorized'.
-- >>> RODE ESTA LINHA UMA VEZ (já vem com o valor certo) para LIGAR o motor: <<<
--     alter database postgres set app.gui_sched_secret = 'gss_7Kx2mQ9vR4tZ8nL';
-- (Esse mesmo valor está no segredo SCHED_SECRET da Cloudflare, que o Gui usa.)
-- ============================================================================

create extension if not exists btree_gist;

-- ── TABELAS ────────────────────────────────────────────────────────────────
create table if not exists biz_locations (
  id uuid primary key default gen_random_uuid(),
  client_email text not null, name text not null,
  address text, city text, phone text,
  tz text not null default 'America/New_York',
  active boolean not null default true, created_at timestamptz not null default now()
);
create index if not exists idx_biz_locations_email on biz_locations(client_email) where active;

create table if not exists biz_professionals (
  id uuid primary key default gen_random_uuid(),
  client_email text not null, name text not null, title text,
  active boolean not null default true, created_at timestamptz not null default now()
);
create index if not exists idx_biz_pros_email on biz_professionals(client_email) where active;

create table if not exists biz_services (
  id uuid primary key default gen_random_uuid(),
  client_email text not null, name text not null,
  duration_min int not null default 30, price_cents int,
  active boolean not null default true, created_at timestamptz not null default now()
);
create index if not exists idx_biz_services_email on biz_services(client_email) where active;

create table if not exists biz_pro_services (
  pro_id uuid not null references biz_professionals(id) on delete cascade,
  service_id uuid not null references biz_services(id) on delete cascade,
  primary key (pro_id, service_id)
);
create table if not exists biz_pro_locations (
  pro_id uuid not null references biz_professionals(id) on delete cascade,
  location_id uuid not null references biz_locations(id) on delete cascade,
  primary key (pro_id, location_id)
);
create table if not exists biz_schedules (
  id uuid primary key default gen_random_uuid(),
  pro_id uuid not null references biz_professionals(id) on delete cascade,
  location_id uuid not null references biz_locations(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),    -- 0=domingo
  start_min int not null check (start_min between 0 and 1440),
  end_min int not null check (end_min between 0 and 1440)
);
create index if not exists idx_biz_sched_pro on biz_schedules(pro_id, weekday);

create table if not exists biz_appointments (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,
  location_id uuid references biz_locations(id),
  pro_id uuid references biz_professionals(id),
  service_id uuid references biz_services(id),
  customer_name text, customer_contact text,
  span tstzrange not null, status text not null default 'booked',
  source text default 'gui', created_at timestamptz not null default now(),
  exclude using gist (pro_id with =, span with &&) where (status <> 'cancelled')
);
create index if not exists idx_biz_appt_email on biz_appointments(client_email, created_at desc);

-- ── RLS: tudo trancado; só as funções SECURITY DEFINER acessam ───────────────
alter table biz_locations enable row level security;
alter table biz_professionals enable row level security;
alter table biz_services enable row level security;
alter table biz_pro_services enable row level security;
alter table biz_pro_locations enable row level security;
alter table biz_schedules enable row level security;
alter table biz_appointments enable row level security;

-- guard compartilhado: FECHADO por padrão (GUC ausente => nega).
create or replace function _gui_sched_ok(p_secret text)
returns boolean language sql stable as $$
  select coalesce(current_setting('app.gui_sched_secret', true),'') <> ''
     and p_secret = current_setting('app.gui_sched_secret', true);
$$;

-- ── FUNÇÃO 1 · CONSULTAR: o "menu" do negócio que o Gui lê ───────────────────
create or replace function biz_lookup(p_secret text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select jsonb_build_object(
    'locations', coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'city',city,'address',address)) from biz_locations where client_email=p_email and active),'[]'),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'duration_min',duration_min,'price_cents',price_cents)) from biz_services where client_email=p_email and active),'[]'),
    'professionals', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'title',p.title,
        'services',(select coalesce(jsonb_agg(ps.service_id),'[]') from biz_pro_services ps where ps.pro_id=p.id),
        'locations',(select coalesce(jsonb_agg(pl.location_id),'[]') from biz_pro_locations pl where pl.pro_id=p.id)))
      from biz_professionals p where p.client_email=p_email and p.active),'[]')
  ) into v;
  return v;
end $$;

-- ── FUNÇÃO 2 · CHECAR DISPONIBILIDADE: slots livres reais (próximos p_days dias) ─
create or replace function biz_availability(
  p_secret text, p_email text, p_service_id uuid,
  p_location_id uuid default null, p_pro_id uuid default null,
  p_days int default 14, p_limit int default 8
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_dur int; rec record; slot timestamptz; day_date date;
  out_slots jsonb := '[]'; cnt int := 0;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select duration_min into v_dur from biz_services where id=p_service_id and client_email=p_email;
  if v_dur is null then return jsonb_build_object('error','service not found'); end if;
  for rec in
    select s.pro_id, s.location_id, s.weekday, s.start_min, s.end_min,
           pr.name as pro_name, l.name as loc_name, coalesce(l.tz,'America/New_York') as tz
    from biz_schedules s
    join biz_professionals pr on pr.id=s.pro_id and pr.active
    join biz_locations l on l.id=s.location_id and l.active
    join biz_pro_services ps on ps.pro_id=s.pro_id and ps.service_id=p_service_id
    where pr.client_email=p_email
      and (p_location_id is null or s.location_id=p_location_id)
      and (p_pro_id is null or s.pro_id=p_pro_id)
  loop
    for i in 0..p_days loop
      day_date := (now() at time zone rec.tz)::date + i;
      if extract(dow from day_date)::int <> rec.weekday then continue; end if;
      slot := ((day_date::text || ' 00:00')::timestamp + (rec.start_min || ' min')::interval) at time zone rec.tz;
      while (rec.start_min + (extract(epoch from (slot - (((day_date::text||' 00:00')::timestamp + (rec.start_min||' min')::interval) at time zone rec.tz)))/60)::int) + v_dur <= rec.end_min loop
        if slot > now() and not exists (
          select 1 from biz_appointments a
          where a.pro_id=rec.pro_id and a.status<>'cancelled'
            and a.span && tstzrange(slot, slot + (v_dur||' min')::interval)
        ) then
          out_slots := out_slots || jsonb_build_object('start',slot,'pro_id',rec.pro_id,'pro',rec.pro_name,'location_id',rec.location_id,'location',rec.loc_name);
          cnt := cnt + 1;
          exit when cnt >= p_limit;
        end if;
        slot := slot + (v_dur||' min')::interval;
      end loop;
      exit when cnt >= p_limit;
    end loop;
    exit when cnt >= p_limit;
  end loop;
  return jsonb_build_object('duration_min',v_dur,'slots',out_slots);
end $$;

-- ── FUNÇÃO 3 · MARCAR: grava o agendamento (EXCLUDE impede o duplo) ───────────
create or replace function biz_book(
  p_secret text, p_email text, p_pro_id uuid, p_location_id uuid, p_service_id uuid,
  p_name text, p_contact text, p_start timestamptz
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_dur int; v_id uuid;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select duration_min into v_dur from biz_services where id=p_service_id and client_email=p_email;
  if v_dur is null then v_dur := 30; end if;
  begin
    insert into biz_appointments(client_email,location_id,pro_id,service_id,customer_name,customer_contact,span)
    values (p_email,p_location_id,p_pro_id,p_service_id,p_name,p_contact,tstzrange(p_start,p_start+(v_dur||' min')::interval))
    returning id into v_id;
  exception when exclusion_violation then
    return jsonb_build_object('ok',false,'reason','slot_taken');
  end;
  return jsonb_build_object('ok',true,'appointment_id',v_id,'start',p_start,'duration_min',v_dur);
end $$;


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: scheduling_engine_v2.sql
-- ╚══════════════════════════════════════════════════════════
-- ============================================================================
-- GUILEO · MOTOR DE AGENDA v2 (universal, todos os setores) — cole tudo e RUN.
-- ADITIVO + idempotente: NÃO quebra o v1 (a clínica de teste continua funcionando).
-- Baseado na pesquisa (Cal.com EventType, Fresha, Cronofy, ServiceTitan, NexHealth).
-- Núcleo tipado + JSONB flexível. Trava anti-overbook por CAPACIDADE (1=exclusivo, N=assentos).
-- ============================================================================

-- 1) SERVICES — campos que cada setor precisa (buffers, antecedência, depósito, capacidade, config)
alter table biz_services add column if not exists buffer_before_min int  not null default 0;  -- prep/setup
alter table biz_services add column if not exists buffer_after_min  int  not null default 0;  -- limpeza/deslocamento
alter table biz_services add column if not exists min_notice_min    int  not null default 0;  -- antecedência mínima
alter table biz_services add column if not exists capacity          int  not null default 1;  -- assentos/slot (1=exclusivo)
alter table biz_services add column if not exists deposit_cents     int;                       -- sinal fixo
alter table biz_services add column if not exists deposit_pct       numeric;                   -- ou % do preço
alter table biz_services add column if not exists cancel_window_h   int  not null default 0;   -- janela p/ cancelar sem taxa
alter table biz_services add column if not exists config            jsonb not null default '{}'::jsonb;
-- config exemplos por setor: {"party_size":true} restaurante · {"requires_address":true} serviço externo
--   {"intake":["alergias","convênio"]} clínica · {"addons":["barba"]} salão · {"property":true} imobiliária

-- 2) RESOURCES (biz_professionals generalizado) — tipo + config (mesa/sala/baia/equipamento/corretor)
alter table biz_professionals add column if not exists kind   text  not null default 'staff';  -- staff|table|room|bay|equipment|agent
alter table biz_professionals add column if not exists config jsonb not null default '{}'::jsonb; -- ex mesa: {"seats":4}

-- 3) APPOINTMENTS — atributos flexíveis + hold com expiração
alter table biz_appointments add column if not exists attributes jsonb not null default '{}'::jsonb; -- party_size, endereço, intake...
alter table biz_appointments add column if not exists expires_at timestamptz;  -- holds expiram (NULL = booking firme)

-- 4) TROCAR a trava EXCLUDE (exclusiva) por uma GUARD por CAPACIDADE (cobre 1 e N) + race-safe
do $$
declare c text;
begin
  select conname into c from pg_constraint where conrelid='biz_appointments'::regclass and contype='x' limit 1;
  if c is not null then execute format('alter table biz_appointments drop constraint %I', c); end if;
end $$;

create or replace function biz_appt_guard() returns trigger language plpgsql as $$
declare cap int; cnt int;
begin
  if new.status = 'cancelled' then return new; end if;
  -- serializa por recurso (sem furo sob concorrência)
  perform pg_advisory_xact_lock(hashtextextended(coalesce(new.pro_id::text,'none'),0));
  select coalesce(capacity,1) into cap from biz_services where id = new.service_id;
  cap := coalesce(cap,1);
  select count(*) into cnt from biz_appointments a
    where a.pro_id = new.pro_id and a.status <> 'cancelled' and a.id <> new.id
      and (a.expires_at is null or a.expires_at > now())
      and a.span && new.span;
  if cnt >= cap then raise exception 'slot_taken' using errcode='GUI01'; end if;
  return new;
end $$;
drop trigger if exists biz_appt_guard_trg on biz_appointments;
create trigger biz_appt_guard_trg before insert or update on biz_appointments
  for each row execute function biz_appt_guard();

-- limpa holds expirados (chamado preguiçosamente pelas RPCs; sem cron)
create or replace function biz_release_expired() returns void language sql security definer set search_path=public as $$
  update biz_appointments set status='cancelled'
   where status='hold' and expires_at is not null and expires_at < now();
$$;

-- ── DISPONIBILIDADE v2: respeita buffers + antecedência mínima + capacidade ──
create or replace function biz_availability(
  p_secret text, p_email text, p_service_id uuid,
  p_location_id uuid default null, p_pro_id uuid default null,
  p_days int default 14, p_limit int default 8
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_dur int; v_bb int; v_ba int; v_notice int; v_cap int;
  rec record; slot timestamptz; day_date date; base timestamptz;
  out_slots jsonb := '[]'; cnt int := 0; earliest timestamptz;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  perform biz_release_expired();
  select duration_min, buffer_before_min, buffer_after_min, min_notice_min, coalesce(capacity,1)
    into v_dur, v_bb, v_ba, v_notice, v_cap
    from biz_services where id=p_service_id and client_email=p_email;
  if v_dur is null then return jsonb_build_object('error','service not found'); end if;
  earliest := now() + (v_notice||' min')::interval;
  for rec in
    select s.pro_id, s.location_id, s.weekday, s.start_min, s.end_min,
           pr.name as pro_name, l.name as loc_name, coalesce(l.tz,'America/New_York') as tz
    from biz_schedules s
    join biz_professionals pr on pr.id=s.pro_id and pr.active
    join biz_locations l on l.id=s.location_id and l.active
    join biz_pro_services ps on ps.pro_id=s.pro_id and ps.service_id=p_service_id
    where pr.client_email=p_email
      and (p_location_id is null or s.location_id=p_location_id)
      and (p_pro_id is null or s.pro_id=p_pro_id)
  loop
    for i in 0..p_days loop
      day_date := (now() at time zone rec.tz)::date + i;
      if extract(dow from day_date)::int <> rec.weekday then continue; end if;
      base := ((day_date::text||' 00:00')::timestamp + (rec.start_min||' min')::interval) at time zone rec.tz;
      slot := base;
      while rec.start_min + (extract(epoch from (slot - base))/60)::int + v_dur <= rec.end_min loop
        if slot >= earliest and (
          select count(*) from biz_appointments a
          join biz_services asv on asv.id = a.service_id
          where a.pro_id=rec.pro_id and a.status<>'cancelled'
            and (a.expires_at is null or a.expires_at > now())
            and tstzrange(lower(a.span) - (coalesce(asv.buffer_before_min,0)||' min')::interval,
                          upper(a.span) + (coalesce(asv.buffer_after_min,0)||' min')::interval)
              && tstzrange(slot - (v_bb||' min')::interval, slot + ((v_dur+v_ba)||' min')::interval)
        ) < v_cap then
          out_slots := out_slots || jsonb_build_object('start',slot,'pro_id',rec.pro_id,'pro',rec.pro_name,'location_id',rec.location_id,'location',rec.loc_name);
          cnt := cnt + 1; exit when cnt >= p_limit;
        end if;
        slot := slot + (v_dur||' min')::interval;
      end loop;
      exit when cnt >= p_limit;
    end loop;
    exit when cnt >= p_limit;
  end loop;
  return jsonb_build_object('duration_min',v_dur,'deposit_cents',(select deposit_cents from biz_services where id=p_service_id),'slots',out_slots);
end $$;

-- ── MARCAR v2: aceita atributos + hold (status/expiração); guard reforça capacidade ──
create or replace function biz_book(
  p_secret text, p_email text, p_pro_id uuid, p_location_id uuid, p_service_id uuid,
  p_name text, p_contact text, p_start timestamptz,
  p_attributes jsonb default '{}'::jsonb, p_hold_min int default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_dur int; v_id uuid; v_status text; v_exp timestamptz;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  perform biz_release_expired();
  select duration_min into v_dur from biz_services where id=p_service_id and client_email=p_email;
  if v_dur is null then v_dur := 30; end if;
  if p_hold_min is not null then v_status:='hold'; v_exp:=now()+(p_hold_min||' min')::interval; else v_status:='booked'; end if;
  begin
    insert into biz_appointments(client_email,location_id,pro_id,service_id,customer_name,customer_contact,span,status,expires_at,attributes)
    values (p_email,p_location_id,p_pro_id,p_service_id,p_name,p_contact,
            tstzrange(p_start,p_start+(v_dur||' min')::interval), v_status, v_exp, coalesce(p_attributes,'{}'::jsonb))
    returning id into v_id;
  exception when sqlstate 'GUI01' then return jsonb_build_object('ok',false,'reason','slot_taken');
  end;
  return jsonb_build_object('ok',true,'appointment_id',v_id,'status',v_status,'start',p_start,'duration_min',v_dur,'expires_at',v_exp);
end $$;

-- ── HOLD: trava o slot ~5min enquanto o Gui confirma (atalho do book) ──
create or replace function biz_hold(
  p_secret text, p_email text, p_pro_id uuid, p_location_id uuid, p_service_id uuid,
  p_name text, p_contact text, p_start timestamptz, p_minutes int default 5
) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  return biz_book(p_secret,p_email,p_pro_id,p_location_id,p_service_id,p_name,p_contact,p_start,'{}'::jsonb,p_minutes);
end $$;

-- confirma um hold (vira booking firme)
create or replace function biz_confirm(p_secret text, p_email text, p_appointment_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare n int;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  update biz_appointments set status='booked', expires_at=null
   where id=p_appointment_id and client_email=p_email and status='hold';
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n>0);
end $$;

-- ── REMARCAR: move o horário (guard re-checa conflito) ──
create or replace function biz_reschedule(p_secret text, p_email text, p_appointment_id uuid, p_new_start timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_dur int; v_svc uuid;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  perform biz_release_expired();
  select service_id into v_svc from biz_appointments where id=p_appointment_id and client_email=p_email;
  if v_svc is null then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  select duration_min into v_dur from biz_services where id=v_svc;
  v_dur := coalesce(v_dur,30);
  -- recria via guard: marca o novo, se livre cancela o antigo
  begin
    update biz_appointments set span = tstzrange(p_new_start, p_new_start+(v_dur||' min')::interval)
     where id=p_appointment_id and client_email=p_email;
  exception when sqlstate 'GUI01' then return jsonb_build_object('ok',false,'reason','slot_taken');
  end;
  return jsonb_build_object('ok',true,'start',p_new_start);
end $$;
-- (a trava biz_appt_guard agora roda em INSERT e UPDATE, então o reschedule é protegido contra conflito)

-- ── CANCELAR ──
create or replace function biz_cancel(p_secret text, p_email text, p_appointment_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare n int;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  update biz_appointments set status='cancelled' where id=p_appointment_id and client_email=p_email;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n>0);
end $$;


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: scheduling_engine_v3.sql
-- ╚══════════════════════════════════════════════════════════
-- GUILEO MOTOR v3 — onboarding em massa + achar agendamento por contato. Cole tudo e RUN.

-- IMPORT: cadastra um negócio inteiro de uma vez a partir de um JSON (os 33 médicos numa tacada).
-- payload: { "replace": true|false,
--   "locations":[{"name","city","address","phone","tz"}],
--   "services":[{"name","duration_min","price_cents","buffer_before_min","buffer_after_min","min_notice_min","capacity","deposit_cents","config"}],
--   "professionals":[{"name","title","kind","config","services":["<nome>"],"locations":["<nome>"],
--                     "schedule":[{"location":"<nome>","weekday":0-6,"start_min":540,"end_min":1020}]}] }
create or replace function biz_admin_import(p_secret text, p_email text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare loc jsonb; svc jsonb; pro jsonb; sch jsonb;
  loc_map jsonb := '{}'::jsonb; svc_map jsonb := '{}'::jsonb;
  lid uuid; sid uuid; pid uuid; nloc int:=0; nsvc int:=0; npro int:=0;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  if coalesce(p_payload->>'replace','false') = 'true' then
    delete from biz_appointments where client_email=p_email;
    delete from biz_schedules where pro_id in (select id from biz_professionals where client_email=p_email);
    delete from biz_pro_services where pro_id in (select id from biz_professionals where client_email=p_email);
    delete from biz_pro_locations where pro_id in (select id from biz_professionals where client_email=p_email);
    delete from biz_professionals where client_email=p_email;
    delete from biz_services where client_email=p_email;
    delete from biz_locations where client_email=p_email;
  end if;
  for loc in select value from jsonb_array_elements(coalesce(p_payload->'locations','[]'::jsonb)) loop
    insert into biz_locations(client_email,name,city,address,phone,tz)
      values(p_email, loc->>'name', loc->>'city', loc->>'address', loc->>'phone', coalesce(loc->>'tz','America/New_York'))
      returning id into lid;
    loc_map := loc_map || jsonb_build_object(loc->>'name', lid::text); nloc:=nloc+1;
  end loop;
  for svc in select value from jsonb_array_elements(coalesce(p_payload->'services','[]'::jsonb)) loop
    insert into biz_services(client_email,name,duration_min,price_cents,buffer_before_min,buffer_after_min,min_notice_min,capacity,deposit_cents,config)
      values(p_email, svc->>'name', coalesce((svc->>'duration_min')::int,30), (svc->>'price_cents')::int,
             coalesce((svc->>'buffer_before_min')::int,0), coalesce((svc->>'buffer_after_min')::int,0),
             coalesce((svc->>'min_notice_min')::int,0), coalesce((svc->>'capacity')::int,1),
             (svc->>'deposit_cents')::int, coalesce(svc->'config','{}'::jsonb))
      returning id into sid;
    svc_map := svc_map || jsonb_build_object(svc->>'name', sid::text); nsvc:=nsvc+1;
  end loop;
  for pro in select value from jsonb_array_elements(coalesce(p_payload->'professionals','[]'::jsonb)) loop
    insert into biz_professionals(client_email,name,title,kind,config)
      values(p_email, pro->>'name', pro->>'title', coalesce(pro->>'kind','staff'), coalesce(pro->'config','{}'::jsonb))
      returning id into pid;
    npro:=npro+1;
    if pro ? 'services' then
      insert into biz_pro_services(pro_id,service_id)
        select pid, (svc_map->>x)::uuid from jsonb_array_elements_text(pro->'services') x where svc_map ? x;
    end if;
    if pro ? 'locations' then
      insert into biz_pro_locations(pro_id,location_id)
        select pid, (loc_map->>x)::uuid from jsonb_array_elements_text(pro->'locations') x where loc_map ? x;
    end if;
    if pro ? 'schedule' then
      for sch in select value from jsonb_array_elements(pro->'schedule') loop
        insert into biz_schedules(pro_id,location_id,weekday,start_min,end_min)
          values(pid, (loc_map->>(sch->>'location'))::uuid, (sch->>'weekday')::int, (sch->>'start_min')::int, (sch->>'end_min')::int);
      end loop;
    end if;
  end loop;
  return jsonb_build_object('ok',true,'locations',nloc,'services',nsvc,'professionals',npro);
end $$;

-- FIND: agendamentos futuros de um cliente pelo telefone/email (pra remarcar/cancelar por voz)
create or replace function biz_find_appointments(p_secret text, p_email text, p_contact text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'service',s.name,'pro',p.name,'location',l.name,'start',lower(a.span),'status',a.status) order by lower(a.span)),'[]'::jsonb)
    into v from biz_appointments a
    left join biz_services s on s.id=a.service_id
    left join biz_professionals p on p.id=a.pro_id
    left join biz_locations l on l.id=a.location_id
    where a.client_email=p_email and a.customer_contact=p_contact and a.status<>'cancelled' and lower(a.span) > now();
  return jsonb_build_object('appointments', coalesce(v,'[]'::jsonb));
end $$;


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: scheduling_engine_v4.sql
-- ╚══════════════════════════════════════════════════════════
-- GUILEO MOTOR v4 — número de referência (confirmação) em todo agendamento. Cole e RUN. Aditivo.

-- nº de referência curto e humano (ex: GUI-7QK2) que o cliente guarda e cita
alter table biz_appointments add column if not exists ref text;

-- biz_book v4: gera o ref no booking e devolve (pra confirmação) — resto igual ao v2/v3
create or replace function biz_book(
  p_secret text, p_email text, p_pro_id uuid, p_location_id uuid, p_service_id uuid,
  p_name text, p_contact text, p_start timestamptz,
  p_attributes jsonb default '{}'::jsonb, p_hold_min int default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_dur int; v_id uuid; v_status text; v_exp timestamptz; v_ref text;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  perform biz_release_expired();
  select duration_min into v_dur from biz_services where id=p_service_id and client_email=p_email;
  if v_dur is null then v_dur := 30; end if;
  if p_hold_min is not null then v_status:='hold'; v_exp:=now()+(p_hold_min||' min')::interval; else v_status:='booked'; end if;
  v_ref := 'GUI-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
  begin
    insert into biz_appointments(client_email,location_id,pro_id,service_id,customer_name,customer_contact,span,status,expires_at,attributes,ref)
    values (p_email,p_location_id,p_pro_id,p_service_id,p_name,p_contact,
            tstzrange(p_start,p_start+(v_dur||' min')::interval), v_status, v_exp, coalesce(p_attributes,'{}'::jsonb), v_ref)
    returning id into v_id;
  exception when sqlstate 'GUI01' then return jsonb_build_object('ok',false,'reason','slot_taken');
  end;
  return jsonb_build_object('ok',true,'appointment_id',v_id,'ref',v_ref,'status',v_status,'start',p_start,'duration_min',v_dur,'expires_at',v_exp);
end $$;

-- biz_find_appointments v4: inclui o ref (pra cliente citar e o Gui achar)
create or replace function biz_find_appointments(p_secret text, p_email text, p_contact text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'ref',a.ref,'service',s.name,'pro',p.name,'location',l.name,'start',lower(a.span),'status',a.status) order by lower(a.span)),'[]'::jsonb)
    into v from biz_appointments a
    left join biz_services s on s.id=a.service_id
    left join biz_professionals p on p.id=a.pro_id
    left join biz_locations l on l.id=a.location_id
    where a.client_email=p_email and a.customer_contact=p_contact and a.status<>'cancelled' and lower(a.span) > now();
  return jsonb_build_object('appointments', coalesce(v,'[]'::jsonb));
end $$;


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: scheduling_engine_v5.sql
-- ╚══════════════════════════════════════════════════════════
-- GUILEO MOTOR v5 — clientes + fidelidade (#5) e lista de espera (#10). Aditivo. Mesmo gate.

-- #5 — CLIENTES (identidade + pontos + última visita) — a âncora de retenção e de churn
create table if not exists biz_customers (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,            -- o negócio dono
  contact text not null,                 -- telefone/email do CLIENTE final
  name text,
  points int not null default 0,
  visits int not null default 0,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (client_email, contact)
);
create index if not exists idx_biz_customers_email on biz_customers(client_email, last_seen desc);
alter table biz_customers enable row level security;

-- upsert + pontos/visita (chamado pelo book). Pontos: +10 por visita por padrão.
create or replace function biz_customer_touch(
  p_secret text, p_email text, p_contact text, p_name text default null, p_points int default 10, p_visit boolean default true
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_points int; v_visits int;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  if coalesce(p_contact,'')='' then return jsonb_build_object('ok',false); end if;
  insert into biz_customers(client_email,contact,name,points,visits,last_seen)
    values (p_email,p_contact,p_name,greatest(p_points,0),case when p_visit then 1 else 0 end, now())
  on conflict (client_email,contact) do update
    set points = biz_customers.points + greatest(p_points,0),
        visits = biz_customers.visits + (case when p_visit then 1 else 0 end),
        name = coalesce(excluded.name, biz_customers.name),
        last_seen = now()
  returning points, visits into v_points, v_visits;
  return jsonb_build_object('ok',true,'points',v_points,'visits',v_visits);
end $$;

-- consulta pontos de um cliente (o Gui responde "você tem X pontos")
create or replace function biz_customer_points(p_secret text, p_email text, p_contact text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select jsonb_build_object('points',points,'visits',visits,'name',name) into v
    from biz_customers where client_email=p_email and contact=p_contact;
  return coalesce(v, jsonb_build_object('points',0,'visits',0));
end $$;

-- clientes inativos (pro churn-save do cron): sem visita há >= p_days
create or replace function biz_dormant_customers(p_secret text, p_email text, p_days int default 60, p_limit int default 50)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('contact',contact,'name',name,'last_seen',last_seen,'visits',visits) order by last_seen asc),'[]'::jsonb)
    into v from biz_customers
    where client_email=p_email and last_seen < now() - (p_days||' days')::interval
    limit p_limit;
  return jsonb_build_object('dormant', coalesce(v,'[]'::jsonb));
end $$;

-- #10 — LISTA DE ESPERA (preenche vaga de cancelamento)
create table if not exists biz_waitlist (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,
  service_id uuid references biz_services(id) on delete cascade,
  location_id uuid references biz_locations(id) on delete set null,
  contact text not null, name text,
  created_at timestamptz not null default now(),
  notified boolean not null default false
);
create index if not exists idx_biz_waitlist on biz_waitlist(client_email, service_id) where not notified;
alter table biz_waitlist enable row level security;

create or replace function biz_waitlist_add(p_secret text, p_email text, p_service_id uuid, p_location_id uuid, p_contact text, p_name text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  insert into biz_waitlist(client_email,service_id,location_id,contact,name)
    values (p_email,p_service_id,p_location_id,p_contact,p_name) returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id);
end $$;

-- quem chamar quando abrir vaga (mesmo serviço, opcional mesma unidade) — o cron usa isto
create or replace function biz_waitlist_next(p_secret text, p_email text, p_service_id uuid, p_location_id uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select jsonb_build_object('id',id,'contact',contact,'name',name) into v from biz_waitlist
    where client_email=p_email and service_id=p_service_id and not notified
      and (p_location_id is null or location_id is null or location_id=p_location_id)
    order by created_at asc limit 1;
  if v is not null then update biz_waitlist set notified=true where id=(v->>'id')::uuid; end if;
  return coalesce(v, jsonb_build_object('empty',true));
end $$;

-- lembretes: agendamentos nas próximas p_hours horas que ainda não foram lembrados
alter table biz_appointments add column if not exists reminded boolean not null default false;
create or replace function biz_due_reminders(p_secret text, p_email text, p_hours int default 24, p_limit int default 50)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'contact',a.customer_contact,'name',a.customer_name,'service',s.name,'when',lower(a.span),'ref',a.ref) order by lower(a.span)),'[]'::jsonb)
    into v from biz_appointments a left join biz_services s on s.id=a.service_id
    where a.client_email=p_email and a.status='booked' and not a.reminded
      and lower(a.span) between now() and now() + (p_hours||' hours')::interval;
  update biz_appointments set reminded=true
    where client_email=p_email and status='booked' and not reminded
      and lower(span) between now() and now() + (p_hours||' hours')::interval;
  return jsonb_build_object('due', coalesce(v,'[]'::jsonb));
end $$;


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: idempotency_biz_book.sql
-- ╚══════════════════════════════════════════════════════════
-- ============================================================================
-- Guileo · Booking idempotency (anti double-booking on retried/duplicate tool calls)
-- Paste in Supabase → SQL Editor → Run. BACKWARD-COMPATIBLE: the current code keeps
-- working after this (p_request_id defaults null); Claude wires the request_id next.
-- Source of truth: db/scheduling_engine_v4.sql (biz_book). Only adds idempotency.
-- ============================================================================

alter table biz_appointments add column if not exists request_id text;
create unique index if not exists biz_appt_request_uq
  on biz_appointments(client_email, request_id) where request_id is not null;

create or replace function biz_book(
  p_secret text, p_email text, p_pro_id uuid, p_location_id uuid, p_service_id uuid,
  p_name text, p_contact text, p_start timestamptz,
  p_attributes jsonb default '{}'::jsonb, p_hold_min int default null, p_request_id text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_dur int; v_id uuid; v_status text; v_exp timestamptz; v_ref text; v_existing record;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  -- IDEMPOTENCY: a retried / double-fired tool call with the same request_id returns the SAME booking,
  -- never a duplicate (ElevenLabs can fire a tool twice; networks retry).
  if p_request_id is not null and p_request_id <> '' then
    select id, ref, status into v_existing from biz_appointments
      where client_email=p_email and request_id=p_request_id and status<>'cancelled' limit 1;
    if found then
      return jsonb_build_object('ok',true,'appointment_id',v_existing.id,'ref',v_existing.ref,'status',v_existing.status,'idempotent',true);
    end if;
  end if;
  perform biz_release_expired();
  select duration_min into v_dur from biz_services where id=p_service_id and client_email=p_email;
  if v_dur is null then v_dur := 30; end if;
  if p_hold_min is not null then v_status:='hold'; v_exp:=now()+(p_hold_min||' min')::interval; else v_status:='booked'; end if;
  v_ref := 'GUI-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
  begin
    insert into biz_appointments(client_email,location_id,pro_id,service_id,customer_name,customer_contact,span,status,expires_at,attributes,ref,request_id)
    values (p_email,p_location_id,p_pro_id,p_service_id,p_name,p_contact,
            tstzrange(p_start,p_start+(v_dur||' min')::interval), v_status, v_exp, coalesce(p_attributes,'{}'::jsonb), v_ref, nullif(p_request_id,''))
    returning id into v_id;
  exception
    when sqlstate 'GUI01' then return jsonb_build_object('ok',false,'reason','slot_taken');
    when unique_violation then
      -- concurrent duplicate with same request_id → return the row that won
      select id, ref, status into v_existing from biz_appointments
        where client_email=p_email and request_id=p_request_id and status<>'cancelled' limit 1;
      return jsonb_build_object('ok',true,'appointment_id',v_existing.id,'ref',v_existing.ref,'status',v_existing.status,'idempotent',true);
  end;
  return jsonb_build_object('ok',true,'appointment_id',v_id,'ref',v_ref,'status',v_status,'start',p_start,'duration_min',v_dur,'expires_at',v_exp);
end $$;

-- ✅ Done. Booking is now idempotent by request_id. (The webhook/credits/revenue functions live only in
--    the DB, not the repo — to add idempotency THERE, Claude needs their current definitions; see below.)


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: special_dates.sql
-- ╚══════════════════════════════════════════════════════════
-- ============================================================================
-- GUILEO · DATAS ESPECIAIS (férias, feriados, horário reduzido) — cole TUDO e RUN.
-- ADITIVO + idempotente: NÃO quebra o motor v1–v5. Mesmo gate _gui_sched_ok.
-- O problema que isto fecha: o dono viaja / é Thanksgiving e o Gui continuava
-- marcando como se fosse uma terça normal. Agora:
--   • biz_special_dates guarda os dias fechados OU com horário reduzido;
--   • biz_availability PULA dias fechados e RECORTA os de horário reduzido;
--   • a trava biz_appt_guard (roda em TODO insert/update) rejeita agendamento
--     em dia fechado/fora do horário reduzido com o erro GUI02 'closed_date' —
--     então NENHUM caminho (book, reschedule, recurring, hold) fura a data;
--   • biz_book / biz_reschedule capturam GUI02 e devolvem reason='closed_date'
--     + a nota (ex: "Feriado — Ação de Graças") pro Gui falar com o cliente.
-- Fonte da verdade das funções reescritas: scheduling_engine_v2.sql (availability,
-- guard, reschedule) + idempotency_biz_book.sql (biz_book). Só o que muda é o
-- respeito às datas especiais — o resto é idêntico, linha a linha.
-- ============================================================================

-- ── TABELA ──────────────────────────────────────────────────────────────────
create table if not exists biz_special_dates (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,
  date date not null,
  closed boolean not null default true,               -- true = fechado o dia todo
  open_min int check (open_min between 0 and 1440),   -- horário reduzido (closed=false)
  close_min int check (close_min between 0 and 1440),
  note text,                                          -- ex: 'Feriado — Ação de Graças'
  created_at timestamptz not null default now(),
  unique (client_email, date),
  check (closed or (open_min is not null and close_min is not null and open_min < close_min))
);
create index if not exists idx_biz_special_email on biz_special_dates(client_email, date);
alter table biz_special_dates enable row level security;  -- trancado; só SECURITY DEFINER acessa

-- helper interno (SEM security definer: só funciona chamado de dentro das funções
-- definer abaixo; chamado direto pelo anon, o RLS devolve vazio)
create or replace function _biz_special_for(p_email text, p_date date)
returns biz_special_dates language sql stable as $$
  select * from biz_special_dates where client_email = p_email and date = p_date limit 1;
$$;

-- ── RPC · GRAVAR/REMOVER uma data especial (upsert por dia; p_remove=true apaga) ─
create or replace function biz_set_special_date(
  p_secret text, p_email text, p_date date,
  p_closed boolean default true, p_open_min int default null, p_close_min int default null,
  p_note text default null, p_remove boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  if p_remove then
    delete from biz_special_dates where client_email=p_email and date=p_date;
    return jsonb_build_object('ok',true,'removed',true,'date',p_date);
  end if;
  if not p_closed and (p_open_min is null or p_close_min is null or p_open_min >= p_close_min) then
    return jsonb_build_object('ok',false,'reason','bad_hours');
  end if;
  insert into biz_special_dates(client_email,date,closed,open_min,close_min,note)
    values (p_email, p_date, coalesce(p_closed,true),
            case when p_closed then null else p_open_min end,
            case when p_closed then null else p_close_min end,
            nullif(trim(coalesce(p_note,'')),''))
  on conflict (client_email,date) do update
    set closed = excluded.closed, open_min = excluded.open_min,
        close_min = excluded.close_min, note = excluded.note
  returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id,'date',p_date);
end $$;

-- ── RPC · LISTAR as datas especiais futuras (o cockpit e o Gui leem daqui) ───
create or replace function biz_list_special_dates(p_secret text, p_email text, p_days int default 180)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'date',date,'closed',closed,'open_min',open_min,'close_min',close_min,'note',note
    ) order by date),'[]'::jsonb)
    into v from biz_special_dates
    where client_email=p_email and date >= (now() at time zone 'UTC')::date - 1
      and date <= (now() at time zone 'UTC')::date + greatest(coalesce(p_days,180),1);
  return jsonb_build_object('dates', coalesce(v,'[]'::jsonb));
end $$;

-- ── TRAVA · biz_appt_guard reescrita EM CHEIO (v2 + datas especiais) ─────────
-- Comportamento novo (só o bloco "DATAS ESPECIAIS"): se o dia local do início do
-- agendamento estiver FECHADO, ou o agendamento não couber inteiro no horário
-- REDUZIDO daquele dia, levanta GUI02 'closed_date'. Todo o resto = v2 idêntico.
create or replace function biz_appt_guard() returns trigger language plpgsql as $$
declare cap int; cnt int; v_tz text; v_day date; sp biz_special_dates; v_start_min int; v_end_min int;
begin
  if new.status = 'cancelled' then return new; end if;
  -- DATAS ESPECIAIS: só quando o HORÁRIO nasce/muda (insert ou span alterado) — updates
  -- administrativos (reminded, confirm de hold, atributos) em booking já existente passam.
  if TG_OP = 'INSERT' or new.span is distinct from old.span then
    -- resolve o fuso da unidade (fallback: primeira unidade do negócio / NY)
    select coalesce(
      (select tz from biz_locations where id = new.location_id),
      (select tz from biz_locations where client_email = new.client_email and active order by created_at limit 1),
      'America/New_York') into v_tz;
    v_day := (lower(new.span) at time zone v_tz)::date;
    sp := _biz_special_for(new.client_email, v_day);
    if sp.id is not null then
      if sp.closed then
        raise exception 'closed_date' using errcode='GUI02';
      else
        v_start_min := extract(hour from (lower(new.span) at time zone v_tz))::int * 60
                     + extract(minute from (lower(new.span) at time zone v_tz))::int;
        v_end_min   := v_start_min + ceil(extract(epoch from (upper(new.span) - lower(new.span)))/60)::int;
        if v_start_min < sp.open_min or v_end_min > sp.close_min then
          raise exception 'closed_date' using errcode='GUI02';
        end if;
      end if;
    end if;
  end if;
  -- (daqui pra baixo: idêntico ao v2 — capacidade + anti-overbook race-safe)
  perform pg_advisory_xact_lock(hashtextextended(coalesce(new.pro_id::text,'none'),0));
  select coalesce(capacity,1) into cap from biz_services where id = new.service_id;
  cap := coalesce(cap,1);
  select count(*) into cnt from biz_appointments a
    where a.pro_id = new.pro_id and a.status <> 'cancelled' and a.id <> new.id
      and (a.expires_at is null or a.expires_at > now())
      and a.span && new.span;
  if cnt >= cap then raise exception 'slot_taken' using errcode='GUI01'; end if;
  return new;
end $$;
drop trigger if exists biz_appt_guard_trg on biz_appointments;
create trigger biz_appt_guard_trg before insert or update on biz_appointments
  for each row execute function biz_appt_guard();

-- ── DISPONIBILIDADE reescrita EM CHEIO (v2 + datas especiais) ────────────────
-- Só muda o bloco "DATAS ESPECIAIS" dentro do loop de dias: dia fechado é PULADO;
-- dia reduzido tem a janela recortada (interseção com o horário normal do pro).
create or replace function biz_availability(
  p_secret text, p_email text, p_service_id uuid,
  p_location_id uuid default null, p_pro_id uuid default null,
  p_days int default 14, p_limit int default 8
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_dur int; v_bb int; v_ba int; v_notice int; v_cap int;
  rec record; slot timestamptz; day_date date; base timestamptz;
  out_slots jsonb := '[]'; cnt int := 0; earliest timestamptz;
  sp biz_special_dates; eff_start int; eff_end int;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  perform biz_release_expired();
  select duration_min, buffer_before_min, buffer_after_min, min_notice_min, coalesce(capacity,1)
    into v_dur, v_bb, v_ba, v_notice, v_cap
    from biz_services where id=p_service_id and client_email=p_email;
  if v_dur is null then return jsonb_build_object('error','service not found'); end if;
  earliest := now() + (v_notice||' min')::interval;
  for rec in
    select s.pro_id, s.location_id, s.weekday, s.start_min, s.end_min,
           pr.name as pro_name, l.name as loc_name, coalesce(l.tz,'America/New_York') as tz
    from biz_schedules s
    join biz_professionals pr on pr.id=s.pro_id and pr.active
    join biz_locations l on l.id=s.location_id and l.active
    join biz_pro_services ps on ps.pro_id=s.pro_id and ps.service_id=p_service_id
    where pr.client_email=p_email
      and (p_location_id is null or s.location_id=p_location_id)
      and (p_pro_id is null or s.pro_id=p_pro_id)
  loop
    for i in 0..p_days loop
      day_date := (now() at time zone rec.tz)::date + i;
      if extract(dow from day_date)::int <> rec.weekday then continue; end if;
      -- DATAS ESPECIAIS: fechado → pula o dia; reduzido → recorta a janela
      eff_start := rec.start_min; eff_end := rec.end_min;
      sp := _biz_special_for(p_email, day_date);
      if sp.id is not null then
        if sp.closed then continue; end if;
        eff_start := greatest(eff_start, sp.open_min);
        eff_end := least(eff_end, sp.close_min);
        if eff_start + v_dur > eff_end then continue; end if;
      end if;
      base := ((day_date::text||' 00:00')::timestamp + (eff_start||' min')::interval) at time zone rec.tz;
      slot := base;
      while eff_start + (extract(epoch from (slot - base))/60)::int + v_dur <= eff_end loop
        if slot >= earliest and (
          select count(*) from biz_appointments a
          join biz_services asv on asv.id = a.service_id
          where a.pro_id=rec.pro_id and a.status<>'cancelled'
            and (a.expires_at is null or a.expires_at > now())
            and tstzrange(lower(a.span) - (coalesce(asv.buffer_before_min,0)||' min')::interval,
                          upper(a.span) + (coalesce(asv.buffer_after_min,0)||' min')::interval)
              && tstzrange(slot - (v_bb||' min')::interval, slot + ((v_dur+v_ba)||' min')::interval)
        ) < v_cap then
          out_slots := out_slots || jsonb_build_object('start',slot,'pro_id',rec.pro_id,'pro',rec.pro_name,'location_id',rec.location_id,'location',rec.loc_name);
          cnt := cnt + 1; exit when cnt >= p_limit;
        end if;
        slot := slot + (v_dur||' min')::interval;
      end loop;
      exit when cnt >= p_limit;
    end loop;
    exit when cnt >= p_limit;
  end loop;
  return jsonb_build_object('duration_min',v_dur,'deposit_cents',(select deposit_cents from biz_services where id=p_service_id),'slots',out_slots);
end $$;

-- ── biz_book reescrita EM CHEIO (idempotency_biz_book.sql + captura GUI02) ───
-- Só muda: o exception handler agora captura GUI02 e devolve reason='closed_date'
-- + a nota da data (pro Gui explicar: "estamos fechados — feriado"). Resto idêntico.
create or replace function biz_book(
  p_secret text, p_email text, p_pro_id uuid, p_location_id uuid, p_service_id uuid,
  p_name text, p_contact text, p_start timestamptz,
  p_attributes jsonb default '{}'::jsonb, p_hold_min int default null, p_request_id text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_dur int; v_id uuid; v_status text; v_exp timestamptz; v_ref text; v_existing record;
  v_tz text; sp biz_special_dates;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  if p_request_id is not null and p_request_id <> '' then
    select id, ref, status into v_existing from biz_appointments
      where client_email=p_email and request_id=p_request_id and status<>'cancelled' limit 1;
    if found then
      return jsonb_build_object('ok',true,'appointment_id',v_existing.id,'ref',v_existing.ref,'status',v_existing.status,'idempotent',true);
    end if;
  end if;
  perform biz_release_expired();
  select duration_min into v_dur from biz_services where id=p_service_id and client_email=p_email;
  if v_dur is null then v_dur := 30; end if;
  if p_hold_min is not null then v_status:='hold'; v_exp:=now()+(p_hold_min||' min')::interval; else v_status:='booked'; end if;
  v_ref := 'GUI-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
  begin
    insert into biz_appointments(client_email,location_id,pro_id,service_id,customer_name,customer_contact,span,status,expires_at,attributes,ref,request_id)
    values (p_email,p_location_id,p_pro_id,p_service_id,p_name,p_contact,
            tstzrange(p_start,p_start+(v_dur||' min')::interval), v_status, v_exp, coalesce(p_attributes,'{}'::jsonb), v_ref, nullif(p_request_id,''))
    returning id into v_id;
  exception
    when sqlstate 'GUI01' then return jsonb_build_object('ok',false,'reason','slot_taken');
    when sqlstate 'GUI02' then
      -- dia fechado / fora do horário reduzido → devolve a data local + nota pro agente falar
      select coalesce((select tz from biz_locations where id=p_location_id),
                      (select tz from biz_locations where client_email=p_email and active order by created_at limit 1),
                      'America/New_York') into v_tz;
      sp := _biz_special_for(p_email, (p_start at time zone v_tz)::date);
      return jsonb_build_object('ok',false,'reason','closed_date',
        'date',(p_start at time zone v_tz)::date,'note',coalesce(sp.note,''),
        'closed',coalesce(sp.closed,true),'open_min',sp.open_min,'close_min',sp.close_min);
    when unique_violation then
      select id, ref, status into v_existing from biz_appointments
        where client_email=p_email and request_id=p_request_id and status<>'cancelled' limit 1;
      return jsonb_build_object('ok',true,'appointment_id',v_existing.id,'ref',v_existing.ref,'status',v_existing.status,'idempotent',true);
  end;
  return jsonb_build_object('ok',true,'appointment_id',v_id,'ref',v_ref,'status',v_status,'start',p_start,'duration_min',v_dur,'expires_at',v_exp);
end $$;

-- ── biz_reschedule reescrita EM CHEIO (v2 + captura GUI02) ───────────────────
create or replace function biz_reschedule(p_secret text, p_email text, p_appointment_id uuid, p_new_start timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_dur int; v_svc uuid; v_tz text; sp biz_special_dates;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  perform biz_release_expired();
  select service_id into v_svc from biz_appointments where id=p_appointment_id and client_email=p_email;
  if v_svc is null then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  select duration_min into v_dur from biz_services where id=v_svc;
  v_dur := coalesce(v_dur,30);
  begin
    update biz_appointments set span = tstzrange(p_new_start, p_new_start+(v_dur||' min')::interval)
     where id=p_appointment_id and client_email=p_email;
  exception
    when sqlstate 'GUI01' then return jsonb_build_object('ok',false,'reason','slot_taken');
    when sqlstate 'GUI02' then
      select coalesce((select tz from biz_locations where client_email=p_email and active order by created_at limit 1),
                      'America/New_York') into v_tz;
      sp := _biz_special_for(p_email, (p_new_start at time zone v_tz)::date);
      return jsonb_build_object('ok',false,'reason','closed_date',
        'date',(p_new_start at time zone v_tz)::date,'note',coalesce(sp.note,''));
  end;
  return jsonb_build_object('ok',true,'start',p_new_start);
end $$;

-- ✅ Pronto. Teste rápido (troque o email):
--   select biz_set_special_date('gss_7Kx2mQ9vR4tZ8nL','dono@negocio.com','2026-11-26',true,null,null,'Feriado — Ação de Graças');
--   select biz_list_special_dates('gss_7Kx2mQ9vR4tZ8nL','dono@negocio.com');
--   -- biz_availability não devolve mais slots em 2026-11-26; biz_book nesse dia → reason='closed_date'.


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: multi_location.sql
-- ╚══════════════════════════════════════════════════════════
-- ============================================================================
-- GUILEO · MULTI-UNIDADE (cockpit CRUD de unidades) — cole TUDO e RUN.
-- ADITIVO + idempotente: NÃO quebra o motor v1–v5 nem special_dates. Mesmo gate
-- _gui_sched_ok (scheduling_engine.sql). O problema que isto fecha: biz_locations
-- só nascia pelo biz_admin_import (insert em massa; replace=true APAGA o negócio
-- inteiro) — o dono não tinha como adicionar/editar/desativar UMA unidade pelo
-- cockpit. Agora:
--   • biz_locations_admin_list → todas as unidades (ativas E inativas) + volume
--     de hoje por unidade (no fuso DA unidade), pro cockpit mostrar mini-stats;
--   • biz_location_set → upsert pontual (sem id = cria; com id = edita/ativa/
--     desativa), com trava: NUNCA deixa desativar a última unidade ativa (o
--     motor de agenda precisa de ao menos uma pra resolver fuso e horários).
-- Chamado por functions/api/agent-schedule.js (actions loc_list / loc_set),
-- gate por-tenant no servidor (email + connection key via get_client_data).
-- ============================================================================

-- ── RPC · LISTAR as unidades do negócio (cockpit lê daqui; inclui inativas) ──
create or replace function biz_locations_admin_list(p_secret text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'name', l.name, 'address', l.address, 'city', l.city,
      'phone', l.phone, 'tz', l.tz, 'active', l.active,
      'today', coalesce(t.n, 0), 'upcoming', coalesce(u.n, 0)
    ) order by l.created_at), '[]'::jsonb)
    into v
    from biz_locations l
    left join lateral (
      select count(*)::int as n from biz_appointments a
      where a.location_id = l.id and a.status <> 'cancelled'
        and (lower(a.span) at time zone l.tz)::date = (now() at time zone l.tz)::date
    ) t on true
    left join lateral (
      select count(*)::int as n from biz_appointments a
      where a.location_id = l.id and a.status <> 'cancelled' and lower(a.span) > now()
    ) u on true
    where l.client_email = p_email;
  return jsonb_build_object('locations', coalesce(v, '[]'::jsonb));
end $$;

-- ── RPC · CRIAR/EDITAR/(DES)ATIVAR uma unidade (upsert pontual por id) ───────
-- Sem p_id: cria (p_name obrigatório; tz default NY). Com p_id: atualiza só os
-- campos enviados (null = mantém). Trava 'last_location' ao desativar a última
-- ativa; 'bad_tz' se o fuso não existir no Postgres.
create or replace function biz_location_set(
  p_secret text, p_email text, p_id uuid default null,
  p_name text default null, p_address text default null, p_city text default null,
  p_phone text default null, p_tz text default null, p_active boolean default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text; v_actives int;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  -- valida o fuso ANTES de gravar (senão biz_availability quebraria em runtime)
  if p_tz is not null and trim(p_tz) <> '' then
    begin
      perform now() at time zone p_tz;
    exception when others then
      return jsonb_build_object('ok', false, 'reason', 'bad_tz');
    end;
  end if;
  if p_id is null then
    v_name := nullif(trim(coalesce(p_name, '')), '');
    if v_name is null then return jsonb_build_object('ok', false, 'reason', 'name_required'); end if;
    insert into biz_locations(client_email, name, address, city, phone, tz, active)
      values (p_email, left(v_name, 80), nullif(trim(coalesce(p_address,'')),''), nullif(trim(coalesce(p_city,'')),''),
              nullif(trim(coalesce(p_phone,'')),''), coalesce(nullif(trim(coalesce(p_tz,'')),''), 'America/New_York'),
              coalesce(p_active, true))
      returning id into v_id;
    return jsonb_build_object('ok', true, 'id', v_id, 'created', true);
  end if;
  -- edição pontual: a unidade tem que ser DESTE negócio (gate por-tenant)
  if not exists (select 1 from biz_locations where id = p_id and client_email = p_email) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  -- trava: nunca desativar a última unidade ativa (o motor precisa de uma)
  if p_active is false then
    select count(*) into v_actives from biz_locations where client_email = p_email and active;
    if v_actives <= 1 and (select active from biz_locations where id = p_id) then
      return jsonb_build_object('ok', false, 'reason', 'last_location');
    end if;
  end if;
  update biz_locations set
      name    = coalesce(left(nullif(trim(coalesce(p_name,'')),''), 80), name),
      address = coalesce(nullif(trim(coalesce(p_address,'')),''), address),
      city    = coalesce(nullif(trim(coalesce(p_city,'')),''), city),
      phone   = coalesce(nullif(trim(coalesce(p_phone,'')),''), phone),
      tz      = coalesce(nullif(trim(coalesce(p_tz,'')),''), tz),
      active  = coalesce(p_active, active)
    where id = p_id and client_email = p_email;
  return jsonb_build_object('ok', true, 'id', p_id, 'created', false);
end $$;

-- ✅ Pronto. Teste rápido (troque o email):
--   select biz_location_set('gss_7Kx2mQ9vR4tZ8nL','dono@negocio.com',null,'Filial Centro','Av. Central 100','Miami',null,'America/New_York',true);
--   select biz_locations_admin_list('gss_7Kx2mQ9vR4tZ8nL','dono@negocio.com');
--   -- desativar a ÚNICA unidade ativa → {"ok":false,"reason":"last_location"}.


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: noshow_predictor.sql
-- ╚══════════════════════════════════════════════════════════
-- ============================================================================
-- Guileo · SUPERPOWER #3 — No-show prediction foundation  (paste in Supabase → SQL Editor → Run)
-- Project: ynihodbknhjirkdogxby (smart@guileoai.com)
-- Adds: (1) a way to RECORD no-shows (so history accumulates), and (2) a risk scorer that ranks
-- upcoming appointments by no-show probability — using lead-time NOW and each contact's no-show
-- history as it grows. Gated by the same _gui_sched_ok(secret) the scheduling engine uses.
-- ============================================================================

-- 1) RECORD a no-show (owner/portal marks it, or an automation does). Builds the training signal.
create or replace function public.biz_mark_noshow(p_secret text, p_email text, p_appointment_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  update biz_appointments set status = 'no_show'
    where id = p_appointment_id and client_email = lower(trim(p_email)) and status <> 'cancelled';
  return found;
end $$;

-- 2) RISK RADAR — score upcoming booked appointments by no-show probability (0-100), highest first.
--    Signals: lead time (longer booking-to-visit → higher risk), this contact's prior no-show rate,
--    and time-of-day/weekend bumps. Read-only — sends nothing.
create or replace function public.noshow_risk(p_secret text, p_email text, p_days int default 7)
returns table(
  appointment_id uuid, customer_name text, customer_contact text,
  starts_at timestamptz, lead_days numeric, prior_total int, prior_noshows int,
  risk int, reason text
) language plpgsql security definer set search_path = public as $$
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  return query
  with up as (
    select a.id, a.customer_name as cname, a.customer_contact as ccontact, lower(a.span) as starts,
           greatest(0, extract(epoch from (lower(a.span) - a.created_at)) / 86400.0) as lead_d
    from biz_appointments a
    where a.client_email = lower(trim(p_email))
      and a.status = 'booked'
      and lower(a.span) >= now()
      and lower(a.span) < now() + make_interval(days => greatest(1, p_days))
  ),
  hist as (
    -- qualified: bare customer_contact is ambiguous vs the RETURNS TABLE column (2026-07-17 fix)
    select b.customer_contact as ccontact,
           count(*) filter (where b.status <> 'cancelled' and upper(b.span) < now()) as tot,
           count(*) filter (where b.status = 'no_show') as ns
    from biz_appointments b
    where b.client_email = lower(trim(p_email))
    group by b.customer_contact
  )
  select
    up.id, up.cname, up.ccontact, up.starts,
    round(up.lead_d::numeric, 1) as lead_days,
    coalesce(h.tot, 0)::int as prior_total,
    coalesce(h.ns, 0)::int as prior_noshows,
    least(100, greatest(0, (
        20                                                                   -- base
      + case when up.lead_d >= 14 then 25 when up.lead_d >= 7 then 15 when up.lead_d >= 3 then 8 else 0 end  -- lead time
      + case when coalesce(h.tot,0) > 0 then round(50.0 * coalesce(h.ns,0) / h.tot) else 0 end               -- prior no-show rate
      + case when extract(dow from up.starts) in (0,6) then 8 else 0 end     -- weekend
      + case when extract(hour from up.starts) < 10 then 6 else 0 end        -- early morning
    )))::int as risk,
    (case when coalesce(h.ns,0) > 0 then coalesce(h.ns,0)||' prior no-show(s); ' else '' end
      || 'booked '||round(up.lead_d)::text||'d ahead'
      || case when extract(dow from up.starts) in (0,6) then '; weekend' else '' end) as reason
  from up left join hist h on h.ccontact = up.ccontact
  order by risk desc, up.starts asc;
end $$;

grant execute on function public.biz_mark_noshow(text,text,uuid) to anon;
grant execute on function public.noshow_risk(text,text,int) to anon;

-- ✅ Done. The site's /api/noshow-radar reads noshow_risk; owners mark no-shows via biz_mark_noshow.


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: risk_autoconfirm.sql
-- ╚══════════════════════════════════════════════════════════
-- ============================================================================
-- Guileo · SUPERPOWER #3b — RISK-RADAR AUTO-CONFIRM (paste in Supabase → SQL Editor → Run)
-- Project: ynihodbknhjirkdogxby (smart@guileoai.com). Paste AFTER db/noshow_predictor.sql.
-- Lets the 15-min cron engine (/api/automations) send ONE extra-confirmation text to
-- high-risk appointments — autonomously, per tenant, never twice. INGEST-gated.
-- Adds: (1) risk_nudged_at marker on biz_appointments, (2) an ATOMIC 7-day claim so the
-- same appointment is never auto-confirmed twice even if two cron runs race, and
-- (3) an enumeration of which clients have upcoming booked appointments to scan.
-- ============================================================================

-- When did the auto-confirm engine last nudge this appointment? (null = never)
alter table public.biz_appointments add column if not exists risk_nudged_at timestamptz;

-- ATOMIC claim: returns true (and stamps risk_nudged_at) ONLY when this appointment is
-- still booked, still upcoming, AND hasn't been risk-nudged in the last 7 days.
-- The engine calls this BEFORE sending — false means "another run already claimed it, skip".
create or replace function public.risk_confirm_claim(p_secret text, p_email text, p_appointment_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  update biz_appointments a
     set risk_nudged_at = now()
   where a.id = p_appointment_id
     and a.client_email = lower(trim(p_email))
     and a.status = 'booked'
     and lower(a.span) >= now()
     and (a.risk_nudged_at is null or a.risk_nudged_at < now() - interval '7 days')
  returning a.id into v_id;
  return v_id is not null;
end $$;

-- Which clients have booked appointments in the next 2 days that could still be nudged?
-- The cron engine iterates THIS list (data-driven — no env config needed per client).
create or replace function public.risk_clients(p_secret text)
returns table(client_email text) language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return query
    select distinct a.client_email
    from biz_appointments a
    where a.status = 'booked'
      and lower(a.span) >= now()
      and lower(a.span) < now() + interval '2 days'
      and (a.risk_nudged_at is null or a.risk_nudged_at < now() - interval '7 days');
end $$;

grant execute on function public.risk_confirm_claim(text,text,uuid) to anon;
grant execute on function public.risk_clients(text) to anon;

-- ✅ Done. /api/automations ENGINE 4 (risk-radar auto-confirm) turns on automatically:
--    it enumerates risk_clients, scores via noshow_risk, claims risk_confirm_claim, then texts.


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: crm_deal_move.sql
-- ╚══════════════════════════════════════════════════════════
-- ============================================================================
-- Guileo · COMPANY OS — CRM deal stage move (write RPC for the Cockpit pipeline board)
-- (paste AFTER db/crm_phase2.sql, in Supabase → SQL Editor → Run). INGEST-gated.
-- The board's "→" button advances a deal one stage (inquiry → quoted → booked → won);
-- this is the single write that powers it. Tenant-scoped: a deal can only be moved
-- by the tenant that owns it (client_email match), never across tenants.
-- ============================================================================

create or replace function public.crm_deal_move(p_secret text, p_email text, p_deal_id uuid, p_stage text)
returns table(id uuid, stage text, status text)
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if p_stage not in ('inquiry','quoted','booked','won','lost') then raise exception 'invalid stage'; end if;
  return query
    update crm_deals d
       set stage      = p_stage,
           status     = case when p_stage = 'won' then 'won' when p_stage = 'lost' then 'lost' else 'open' end,
           updated_at = now()
     where d.id = p_deal_id
       and d.client_email = lower(trim(p_email))
    returning d.id, d.stage, d.status;
end $$;

grant execute on function public.crm_deal_move(text,text,uuid,text) to anon;

-- ✅ Done. /api/crm action:"deal_move" calls crm_deal_move → the Cockpit pipeline "→" button.


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: crm_caller_lookup.sql
-- ╚══════════════════════════════════════════════════════════
-- ============================================================================
-- Guileo · CALLER MEMORY — read a CRM contact by tenant + phone (paste in Supabase → SQL Editor → Run)
-- Project: ynihodbknhjirkdogxby (smart@guileoai.com) · paste AFTER db/crm_spine.sql
-- Powers "Oi Maria! O de sempre?": when a repeat customer calls a client's Gui number, the server
-- looks them up here (INGEST-gated, sub-second) and injects {caller_name, caller_last, caller_note}
-- as ElevenLabs dynamic variables so the agent greets them like a regular.
-- Callers: functions/api/twilio-voice.js (auto-callback) + functions/api/twilio-inbound.js
-- (ElevenLabs conversation-initiation webhook). Unknown caller ⇒ zero rows ⇒ empty vars (graceful).
-- ============================================================================

create or replace function public.crm_caller_lookup(p_secret text, p_email text, p_phone text)
returns table(full_name text, last_seen_at timestamptz, visit_count int, ltv_cents bigint, lifecycle text, last_summary text)
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_email));
  v_phone  text := nullif(regexp_replace(coalesce(p_phone,''),'[^0-9+]','','g'),'');
  v_id     uuid;
begin
  -- INGEST-gated (same literal the ingest pipeline uses) — this returns customer PII, never expose ungated.
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_phone is null then return; end if;

  select c.id into v_id from crm_contacts c
    where c.client_email = v_tenant
      and (c.phone = v_phone or c.phone = regexp_replace(v_phone, '^\+?1?', ''))  -- tolerate +1 / bare-10-digit drift
    order by c.last_seen_at desc limit 1;
  if v_id is null then return; end if;

  return query
    select c.full_name, c.last_seen_at, c.visit_count, c.ltv_cents, c.lifecycle,
           -- latest 360° event summary ("Booked: Corte", "Order $42 — pizza grande") — best-effort:
           -- crm_timeline_events only exists after db/crm_phase2.sql; missing table ⇒ empty note.
           coalesce((
             select e.summary from crm_timeline_events e
             where e.client_email = v_tenant and e.contact_id = v_id
             order by e.occurred_at desc limit 1
           ), '')::text
    from crm_contacts c where c.id = v_id;
exception when undefined_table then
  -- phase-2 timeline not pasted yet → return the contact with an empty last_summary
  return query
    select c.full_name, c.last_seen_at, c.visit_count, c.ltv_cents, c.lifecycle, ''::text
    from crm_contacts c where c.id = v_id;
end $$;

grant execute on function public.crm_caller_lookup(text,text,text) to anon;

-- ✅ Done. twilio-voice.js / twilio-inbound.js call this with the INGEST secret; the agent's prompt
--    (buildGuiPrompt) references {{caller_name}} {{caller_last}} {{caller_note}} — empty for new callers.


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: receivables.sql
-- ╚══════════════════════════════════════════════════════════
-- ============================================================================
-- Guileo · COMPANY OS — RECEIVABLES: "A receber" — Gui collects overdue invoices politely
-- (paste AFTER db/crm_finance.sql, in Supabase → SQL Editor → Run). INGEST-gated.
-- Adds a pay_link + nudge memory to crm_invoices, a "what's overdue" read for the
-- collections engine, and an ATOMIC 72h dedup marker so the same invoice is never
-- nudged twice in one window — even if two runs race.
-- ============================================================================

-- pay_link: when Gui's close&collect minted a payment link for this invoice, the
-- reminder reuses it. nudged_at: when we last reminded this customer (72h dedup).
alter table public.crm_invoices add column if not exists pay_link text;
alter table public.crm_invoices add column if not exists nudged_at timestamptz;

-- Everything overdue for the tenant: sent + past due (or already flagged overdue),
-- joined to the contact so the engine knows WHO to text and whether it MAY (consent).
create or replace function public.finance_overdue_list(p_secret text, p_email text, p_limit int default 100)
returns table(
  id uuid, contact_id uuid, contact_name text, phone text, consent_sms boolean,
  number text, amount_cents bigint, due_at timestamptz, days_late int,
  pay_link text, nudged_at timestamptz
)
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return query
    select i.id, i.contact_id, c.full_name, c.phone, coalesce(c.consent_sms, true),
      i.number, i.amount_cents, i.due_at,
      greatest(0, extract(day from now() - i.due_at))::int as days_late,
      i.pay_link, i.nudged_at
    from crm_invoices i left join crm_contacts c on c.id = i.contact_id and c.client_email = i.client_email
    where i.client_email = lower(trim(p_email))
      and i.status in ('sent','overdue')
      and i.due_at is not null and i.due_at < now()
    order by i.due_at asc
    limit greatest(1, least(p_limit, 500));
end $$;

-- ATOMIC dedup claim: returns true (and stamps nudged_at) ONLY when this invoice
-- hasn't been nudged in the last 72h AND is still overdue. The engine calls this
-- BEFORE sending — a false means "someone already reminded them, stay polite, skip".
create or replace function public.finance_mark_nudged(p_secret text, p_email text, p_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  update crm_invoices i
     set nudged_at = now(), updated_at = now()
   where i.id = p_id
     and i.client_email = lower(trim(p_email))
     and i.status in ('sent','overdue')
     and i.due_at is not null and i.due_at < now()
     and (i.nudged_at is null or i.nudged_at < now() - interval '72 hours')
  returning i.id into v_id;
  return v_id is not null;
end $$;

grant execute on function public.finance_overdue_list(text,text,int) to anon;
grant execute on function public.finance_mark_nudged(text,text,uuid) to anon;

-- ✅ Done. /api/collections action:"list" reads finance_overdue_list; action:"nudge" claims
--    finance_mark_nudged per invoice then sends the reminder → the Cockpit "💳 A receber" block.


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: money_hardening.sql
-- ╚══════════════════════════════════════════════════════════
-- ============================================================================
-- Guileo · MONEY HARDENING — revenue-ledger idempotency for voice payments
-- Paste in Supabase → SQL Editor → Run. Twilio RETRIES the <Pay> result callback on
-- non-2xx/timeouts — the caller's card was charged ONCE, so it must be ledgered ONCE.
-- revenue_record_once dedups on the charge's confirmation code / CallSid, then delegates
-- to the existing public.revenue_record. Gated by the existing _gui_sched_ok secret
-- (same SCHED_SECRET the callbacks already send).
-- BACKWARD-COMPATIBLE: /api/twilio-pay and /api/pay-result work before this is pasted
-- (the RPC 404s and they fall back to the legacy plain revenue_record write, exactly as
-- before); after pasting, a retried callback can never double-count revenue.
-- ============================================================================

create table if not exists public.gui_revenue_idem (
  dedupe_key  text primary key,
  email       text,
  created_at  timestamptz default now()
);
alter table public.gui_revenue_idem enable row level security;

-- revenue_record_once → records the revenue the FIRST time this dedupe key is seen and
-- returns true; returns false (recording NOTHING) if already seen. Atomic via ON CONFLICT.
-- Delegates to public.revenue_record so the ledger row itself is identical to a plain write.
create or replace function public.revenue_record_once(
  p_secret text, p_email text, p_category text, p_amount_cents bigint,
  p_ref text default null, p_source text default null, p_meta jsonb default '{}'::jsonb,
  p_dedupe text default null
) returns boolean language plpgsql security definer set search_path = public as $$
declare v_ins int;
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  if p_dedupe is not null and p_dedupe <> '' then
    insert into public.gui_revenue_idem(dedupe_key, email)
      values (p_dedupe, lower(trim(coalesce(p_email,''))))
      on conflict (dedupe_key) do nothing;
    get diagnostics v_ins = row_count;
    if v_ins = 0 then return false; end if; -- already ledgered — never double-count
  end if; -- no dedupe key → can't dedup, record it (same as the legacy path)
  perform public.revenue_record(p_secret, p_email, p_category, p_amount_cents, p_ref, p_source, p_meta);
  return true;
end $$;

grant execute on function public.revenue_record_once(text,text,text,bigint,text,text,jsonb,text) to anon;

-- ✅ Done. Voice-payment callbacks now ledger each charge at most once, atomically.
-- NOTE: assumes the live revenue_record signature is (secret, email, category, amount_cents,
-- ref, source, meta) — the exact shape the Pages Functions already call it with. If the
-- inner call errors at runtime, run: select proname, pg_get_function_arguments(oid)
-- from pg_proc where proname = 'revenue_record';  and adjust the perform line to match.


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: stripe_connect.sql
-- ╚══════════════════════════════════════════════════════════
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


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: notify_phone.sql
-- ╚══════════════════════════════════════════════════════════
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


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: lifecycle.sql
-- ╚══════════════════════════════════════════════════════════
-- ============================================================================
-- Guileo · LIFECYCLE — the automatic nurture drip + referral attribution reads
-- (paste in Supabase → SQL Editor → Run · project ynihodbknhjirkdogxby,
--  account smart@guileoai.com). INGEST-gated, same literal as add_client_credits.
--
-- Powers functions/api/lifecycle.js (cron every few hours):
--   1. drip_log + drip_claim — ATOMIC "may I send this step to this email?" marker.
--      The engine claims BEFORE sending, so even two racing cron runs can never
--      email the same lead the same step twice (politeness over repeat — same
--      philosophy as receivables' finance_mark_nudged).
--   2. lead_converted — cheap "is this email already a paying client?" check so
--      the drip stops the moment someone converts (reads client_credits; returns
--      false gracefully if that table isn't in this project yet).
--   3. lead_ref_lookup — used by /api/stripe-webhook on a NEW client's first
--      payment: finds the most recent "👤ref:<slug>" carried by that buyer's
--      lead rows in gui_actions (90-day window), so referral conversions are
--      detected server-side without opening gui_actions to anonymous reads.
-- ============================================================================

-- One row per (email, step) ever sent by the drip machine. PK = the idempotency.
create table if not exists public.drip_log (
  email   text not null,
  step    text not null,
  sent_at timestamptz not null default now(),
  primary key (email, step)
);

-- RLS on, NO policies: anonymous can neither read nor write the table directly —
-- only the SECURITY DEFINER RPCs below touch it.
alter table public.drip_log enable row level security;

-- ATOMIC claim: returns true exactly ONCE per (email, step) — the caller sends
-- the email only on true. INSERT … ON CONFLICT DO NOTHING is race-safe: if two
-- runs collide, exactly one gets the row back.
create or replace function public.drip_claim(p_secret text, p_email text, p_step text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  insert into drip_log (email, step)
  values (lower(trim(p_email)), lower(trim(p_step)))
  on conflict (email, step) do nothing
  returning email into v_email;
  return v_email is not null;
end $$;

-- "Already a client?" — true when the email has a client_credits row (every paid
-- signup gets one via add_client_credits). Column name resolved dynamically
-- (client_email vs email) and the whole check degrades to false if the table
-- isn't present in this project yet — the drip then simply keeps nurturing.
create or replace function public.lead_converted(p_secret text, p_email text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_col text; v_ok boolean;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select column_name into v_col
    from information_schema.columns
   where table_schema = 'public' and table_name = 'client_credits'
     and column_name in ('client_email', 'email')
   order by case column_name when 'client_email' then 0 else 1 end
   limit 1;
  if v_col is null then return false; end if;
  execute format('select exists(select 1 from public.client_credits where lower(%I) = $1)', v_col)
    into v_ok using lower(trim(p_email));
  return coalesce(v_ok, false);
end $$;

-- Most recent referral slug carried by this contact's lead rows (90 days).
-- lead.js writes it into gui_actions.details as "👤ref:<slug>"; the slug is either
-- a base64url-encoded referrer email (cockpit "Indique e ganhe" card) or a seller
-- name (?ref= links). Returns null when the buyer arrived unreferred.
create or replace function public.lead_ref_lookup(p_secret text, p_contact text)
returns text
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return (
    select substring(a.details from '👤ref:([^\s·]+)')
      from gui_actions a
     where a.action = 'lead'
       and a.details like '%👤ref:%'
       and lower(trim(coalesce(a.contact, ''))) = lower(trim(p_contact))
       and a.created_at > now() - interval '90 days'
     order by a.created_at desc
     limit 1
  );
end $$;

grant execute on function public.drip_claim(text, text, text) to anon;
grant execute on function public.lead_converted(text, text) to anon;
grant execute on function public.lead_ref_lookup(text, text) to anon;

-- ✅ Done. /api/lifecycle turns ready:true on its next cron hit (it probes drip_claim);
--    /api/stripe-webhook starts detecting referral conversions on the next new client.


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: nps.sql
-- ╚══════════════════════════════════════════════════════════
-- ─────────────────────────────────────────────────────────────────────────────
-- QUARTERLY NPS ENGINE — the DB half of /api/nps (functions/api/nps.js).
-- Two RPCs, both INGEST-gated, same style as db/silent_claim.sql:
--   nps_claim(p_secret, p_email)          → atomic 90-day claim BEFORE sending the survey
--                                           email, so a client is never surveyed twice a
--                                           quarter even if two cron runs race.
--   nps_vote(p_secret, p_email, p_score)  → stores the 0–10 vote, upserting the LATEST
--                                           score per client per calendar quarter (tapping
--                                           a second button just updates the answer).
-- Paste in the Supabase SQL Editor (project ynihodbknhjirkdogxby, account smart@guileoai.com).
-- Until pasted, /api/nps reports ready:false and sends NOTHING (no dedup guard → no spam).
-- Turns on automatically after the paste.
-- ─────────────────────────────────────────────────────────────────────────────

-- Survey-send claims: one row per client, stamped each time we send them the NPS email.
create table if not exists public.nps_surveys (
  client_email text primary key,
  surveyed_at  timestamptz not null default now()
);

-- Votes: latest score per client per quarter ('2026Q3' style key).
create table if not exists public.nps_votes (
  client_email text not null,
  quarter      text not null,
  score        int  not null check (score between 0 and 10),
  voted_at     timestamptz not null default now(),
  primary key (client_email, quarter)
);

-- Lock both tables down — anon/PostgREST get zero rows; only the RPCs below touch them.
alter table public.nps_surveys enable row level security;
alter table public.nps_votes  enable row level security;

-- ATOMIC claim: returns true (and stamps surveyed_at) ONLY when this client hasn't been
-- surveyed in the last 90 days. /api/nps calls this BEFORE sending the email — false means
-- "already surveyed this quarter, skip"; the endpoint treats a missing RPC (null) as not-ready.
create or replace function public.nps_claim(p_secret text, p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_email text;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  insert into nps_surveys (client_email, surveyed_at)
  values (lower(trim(p_email)), now())
  on conflict (client_email) do update
    set surveyed_at = now()
    where nps_surveys.surveyed_at < now() - interval '90 days'
  returning client_email into v_email;
  return v_email is not null;
end
$$;

-- Vote upsert: keeps the LATEST 0–10 score per client per calendar quarter. Idempotent and
-- re-tappable — a second tap on a different number simply revises this quarter's answer.
create or replace function public.nps_vote(p_secret text, p_email text, p_score int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if p_score is null or p_score < 0 or p_score > 10 then raise exception 'bad score' using errcode = '22023'; end if;
  insert into nps_votes (client_email, quarter, score, voted_at)
  values (lower(trim(p_email)), to_char(now(), 'YYYY"Q"Q'), p_score, now())
  on conflict (client_email, quarter) do update
    set score = excluded.score, voted_at = now();
  return true;
end
$$;

grant execute on function public.nps_claim(text, text)     to anon;
grant execute on function public.nps_vote(text, text, int) to anon;

-- ✅ Done. /api/nps starts surveying on its next cron run (max 30 emails/run, one survey per
--    client per 90 days) and every 0–10 tap lands as an '⭐ NPS n' client_event + nps_votes row.


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: collections_optin.sql
-- ╚══════════════════════════════════════════════════════════
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
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  insert into client_integrations (client_email, provider, tokens)
  values (lower(trim(p_email)), 'collections_auto', jsonb_build_object('on', case when p_on then '1' else '0' end))
  on conflict (client_email, provider) do update set tokens = excluded.tokens, updated_at = now();
  return true;
end $$;

-- Is this tenant opted in? (cockpit reads this to render the toggle state)
create or replace function public.collections_auto_enabled(p_secret text, p_email text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
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
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
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


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: silent_claim.sql
-- ╚══════════════════════════════════════════════════════════
-- ─────────────────────────────────────────────────────────────────────────────
-- SILENT-CLIENT ALERT CLAIM — idempotency guard for the 🔇 silent-client sweep.
-- /api/health-monitor flags clients that are PROVISIONED (agent + number) but had ZERO
-- call/booking/message events for ≥ SILENT_DAYS (default 5). Before ingesting the
-- 'ops_alert' event it calls silent_claim: an ATOMIC 7-day claim, so the same client is
-- never re-alerted within 7 days even if two cron runs race. INGEST-gated.
-- Paste in the Supabase SQL Editor (project ynihodbknhjirkdogxby, account smart@guileoai.com).
-- Until pasted, the sweep still REPORTS silent clients in its JSON but ingests nothing
-- (no idempotency guard → no alert spam). Turns on automatically after the paste.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.ops_silent_alerts (
  client_email text primary key,
  alerted_at   timestamptz not null default now()
);

-- Lock the table down — anon/PostgREST get zero rows; only the RPC below touches it.
alter table public.ops_silent_alerts enable row level security;

-- ATOMIC claim: returns true (and stamps alerted_at) ONLY when this client hasn't been
-- silent-alerted in the last 7 days. The sweep calls this BEFORE ingesting the ops_alert —
-- false means "another run already alerted them this week, skip".
create or replace function public.silent_claim(p_secret text, p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_email text;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  insert into ops_silent_alerts (client_email, alerted_at)
  values (lower(trim(p_email)), now())
  on conflict (client_email) do update
    set alerted_at = now()
    where ops_silent_alerts.alerted_at < now() - interval '7 days'
  returning client_email into v_email;
  return v_email is not null;
end
$$;

grant execute on function public.silent_claim(text, text) to anon;

-- ✅ Done. /api/health-monitor's silent sweep starts alerting (🔇 ops_alert events → /admin card)
--    on its next weekly cron run, at most once per client per 7 days.


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: seller_conversions.sql
-- ╚══════════════════════════════════════════════════════════
-- ─────────────────────────────────────────────────────────────────────────────
-- SELLER CONVERSIONS — the TRUTHFUL commission signal for the /vendedor hub.
-- A seller's ?ref= leads land in gui_actions (action='lead', details contains '👤ref:<ref>',
-- contact = the lead's email). A lead CONVERTED when that same email later shows up in
-- client_events with type 'payment' (the Stripe webhook ingests those). This RPC joins the
-- two and returns { converted, paid } so /api/seller-stats can compute EARNED commission
-- (pct × real payments) instead of guessing. READ-only, INGEST-gated.
-- Paste in the Supabase SQL Editor (project ynihodbknhjirkdogxby, account smart@guileoai.com).
-- Until pasted, /api/seller-stats gracefully falls back to a clearly-labeled "potential
-- commission" estimate (never presented as earned money).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.seller_conversions(p_secret text, p_ref text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if coalesce(trim(p_ref), '') = '' then return json_build_object('converted', 0, 'paid', 0); end if;
  return (
    with leads as (
      select distinct lower(trim(g.contact)) as email
      from gui_actions g
      where g.action = 'lead'
        and g.contact like '%@%'
        and g.details like ('%👤ref:' || trim(p_ref) || '%')
    ),
    pays as (
      select e.client_email, sum(coalesce(e.amount, 0)) as paid
      from client_events e
      join leads l on lower(trim(e.client_email)) = l.email
      where e.type = 'payment'
      group by e.client_email
    )
    select json_build_object(
      'converted', (select count(*) from pays),
      'paid', coalesce((select sum(paid) from pays), 0)
    )
  );
end
$$;

grant execute on function public.seller_conversions(text, text) to anon;

-- ✅ Done. The /vendedor "💰 Comissões" card flips from "potencial (estimativa)" to real
--    earned commission (SELLER_COMMISSION_PCT% of registered payments) automatically.


-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: gcal_push.sql
-- ╚══════════════════════════════════════════════════════════
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
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return (
    select tokens->>'refresh_token'
    from client_integrations
    where client_email = lower(trim(p_email)) and provider = 'gcal'
    limit 1
  );
end $$;
grant execute on function public.gcal_token_lookup(text, text) to anon;

-- ╔══════════════════════════════════════════════════════════
-- ║ SEÇÃO: mindbody.sql
-- ╚══════════════════════════════════════════════════════════
-- ─────────────────────────────────────────────────────────────────────────────
-- MINDBODY — read a tenant's stored MindBody site + source credentials so the connector
-- (functions/api/mindbody.js) can issue a token and book into their MindBody. The creds are
-- WRITTEN by the "connect" action via store_integration (client_integrations, provider='mindbody',
-- already live in prod); this READS them. INGEST-gated. Paste in Supabase (ynihodbknhjirkdogxby).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.mb_creds_lookup(p_secret text, p_email text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return (
    select tokens
    from client_integrations
    where client_email = lower(trim(p_email)) and provider = 'mindbody'
    limit 1
  );
end $$;
grant execute on function public.mb_creds_lookup(text, text) to anon;
