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
