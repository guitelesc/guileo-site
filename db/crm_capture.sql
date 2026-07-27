-- ============================================================================
-- Guileo · CRM CAPTURE + RECOGNITION  (paste in Supabase → SQL Editor → Run)
-- Project: ynihodbknhjirkdogxby (smart@guileoai.com) · paste AFTER db/crm_spine.sql
--          (crm_caller_context also reads biz_appointments/biz_services from the
--           scheduling engine and crm_timeline_events from crm_phase2 — both OPTIONAL:
--           missing tables just yield an empty field, never an error).
-- What this adds:
--   1. crm_caller_context  — a RICHER caller greeting payload than crm_caller_lookup:
--      {name, last_visit, visits_count, last_service, summary}. twilio-voice.js /
--      twilio-inbound.js prefer it (fall back to crm_caller_lookup) so a returning
--      caller hears "Oi Maria! Vi que sua última visita foi <quando> pra <serviço>…".
--   2. crm_leads_today / crm_leads_recent — today's (and last-N-days') NEW leads for the
--      cockpit "Leads do dia" tab: [{id,name,phone,email,source,status,created_at}].
-- All INGEST-gated (same literal the ingest pipeline / crm_caller_lookup use), security
-- definer, granted to anon. Client-scoped by p_email so no tenant can read another's leads.
-- ============================================================================

-- ── RECOGNITION: rich caller context (name + last visit + last booked service + summary) ──
-- Best-effort + graceful: unknown caller ⇒ {} ; missing scheduling/timeline tables ⇒ empty field.
create or replace function public.crm_caller_context(p_secret text, p_email text, p_phone text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant  text := lower(trim(p_email));
  v_phone   text := nullif(regexp_replace(coalesce(p_phone,''),'[^0-9+]','','g'),'');
  v_bare    text;
  v_id      uuid;
  v_name    text;
  v_last    timestamptz;
  v_visits  int;
  v_service text := '';
  v_summary text := '';
begin
  -- INGEST-gated (same literal crm_caller_lookup uses) — returns customer PII, never expose ungated.
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_phone is null then return '{}'::jsonb; end if;
  v_bare := regexp_replace(v_phone, '^\+?1?', '');   -- tolerate +1 / bare-10-digit drift

  select c.id, c.full_name, c.last_seen_at, c.visit_count
    into v_id, v_name, v_last, v_visits
    from crm_contacts c
    where c.client_email = v_tenant
      and (c.phone = v_phone or c.phone = v_bare)
    order by c.last_seen_at desc limit 1;
  if v_id is null then return '{}'::jsonb; end if;

  -- last booked service name (scheduling engine may not be pasted → undefined_table ⇒ empty)
  if length(coalesce(v_bare,'')) >= 7 then
    begin
      select coalesce(s.name,'') into v_service
        from biz_appointments a
        left join biz_services s on s.id = a.service_id
        where a.client_email = v_tenant
          and regexp_replace(coalesce(a.customer_contact,''),'[^0-9]','','g') like ('%' || v_bare)
        order by lower(a.span) desc nulls last limit 1;
    exception when undefined_table then v_service := ''; end;
  end if;

  -- latest 360° timeline summary ("Booked: Corte", "Order $42 — pizza") — crm_phase2 optional
  begin
    select coalesce(e.summary,'') into v_summary
      from crm_timeline_events e
      where e.client_email = v_tenant and e.contact_id = v_id
      order by e.occurred_at desc limit 1;
  exception when undefined_table then v_summary := ''; end;

  return jsonb_build_object(
    'name',         coalesce(v_name,''),
    'last_visit',   v_last,
    'visits_count', coalesce(v_visits,0),
    'last_service', coalesce(v_service,''),
    'summary',      coalesce(v_summary,'')
  );
end $$;

grant execute on function public.crm_caller_context(text,text,text) to anon;

-- ── LEADS OF THE DAY: today's brand-new contacts (tenant tz), for the cockpit "Leads do dia" tab ──
create or replace function public.crm_leads_today(p_secret text, p_email text, p_tz text default 'America/New_York')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_email));
  v_tz     text := coalesce(nullif(p_tz,''),'America/New_York');
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id, 'name', c.full_name, 'phone', c.phone, 'email', c.email,
             'source', c.lead_source, 'status', c.lifecycle, 'created_at', c.created_at
           ) order by c.created_at desc)
    from crm_contacts c
    where c.client_email = v_tenant
      and (c.created_at at time zone v_tz)::date = (now() at time zone v_tz)::date
  ), '[]'::jsonb);
exception when undefined_table then return '[]'::jsonb;
end $$;

grant execute on function public.crm_leads_today(text,text,text) to anon;

-- ── LEADS (recent): new contacts in the last N days (default 7), newest first ──
create or replace function public.crm_leads_recent(p_secret text, p_email text, p_days int default 7)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_email));
  v_days   int  := greatest(1, least(coalesce(p_days,7), 90));
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id, 'name', c.full_name, 'phone', c.phone, 'email', c.email,
             'source', c.lead_source, 'status', c.lifecycle, 'created_at', c.created_at
           ) order by c.created_at desc)
    from crm_contacts c
    where c.client_email = v_tenant
      and c.created_at >= now() - (v_days || ' days')::interval
  ), '[]'::jsonb);
exception when undefined_table then return '[]'::jsonb;
end $$;

grant execute on function public.crm_leads_recent(text,text,int) to anon;

-- ✅ Done. crm_caller_context is called by twilio-voice.js/twilio-inbound.js (INGEST secret) with a
--    graceful fallback to crm_caller_lookup. crm_leads_today/recent feed the cockpit "Leads do dia".
