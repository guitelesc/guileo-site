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
    -- cname/ccontact aliases: bare column names here are ambiguous vs the RETURNS TABLE
    -- columns of the same name (crashed the RPC in prod until 2026-07-17)
    select a.id, a.customer_name as cname, a.customer_contact as ccontact, lower(a.span) as starts,
           greatest(0, extract(epoch from (lower(a.span) - a.created_at)) / 86400.0) as lead_d
    from biz_appointments a
    where a.client_email = lower(trim(p_email))
      and a.status = 'booked'
      and lower(a.span) >= now()
      and lower(a.span) < now() + make_interval(days => greatest(1, p_days))
  ),
  hist as (
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
