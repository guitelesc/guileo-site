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
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
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
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
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
