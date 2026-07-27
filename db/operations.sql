-- ============================================================================
-- Guileo · OPERATIONS (Company-OS "run-the-day" board)  — paste in Supabase → Run.
-- Project ynihodbknhjirkdogxby. The owner's ONE screen for today's work: every booked
-- job (biz_appointments) as a live card with status + on-time signal, read straight off
-- the scheduling spine (no new source of truth) + one action to advance a job's status.
-- Tenant-scoped by client_email, INGEST-gated, SECURITY DEFINER, RLS-safe. Idempotent.
-- Full Operations dept spec (routes/inventory/dispatch) = db/company-os/operations.md;
-- this is the core Live Ops Board built from what already exists.
-- ============================================================================

-- ── ops_board(secret,email,from,to) → { ready, window, stats, jobs[] } ────────
-- Reads biz_appointments (joined to biz_services for the name) in a window (default: today
-- 00:00 → +2 days). on_time: true=done, false=overdue/at-risk (ended, not finished), null=upcoming.
create or replace function public.ops_board(
  p_secret text, p_email text, p_from timestamptz default null, p_to timestamptz default null
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_email));
  v_from timestamptz := coalesce(p_from, date_trunc('day', now()));
  v_to   timestamptz := coalesce(p_to,   date_trunc('day', now()) + interval '2 days');
  v_jobs jsonb := '[]'::jsonb;
  v_total int := 0; v_upcoming int := 0; v_inprog int := 0; v_done int := 0; v_noshow int := 0; v_overdue int := 0;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' then raise exception 'tenant required' using errcode = '22023'; end if;

  begin
    select coalesce(jsonb_agg(row_to_json(j) order by j.start_at), '[]'::jsonb) into v_jobs
    from (
      select a.id,
             coalesce(nullif(trim(a.customer_name),''), 'Cliente') as customer,
             a.customer_contact as contact,
             coalesce(s.name, 'Serviço') as service,
             lower(a.span)  as start_at,
             upper(a.span)  as end_at,
             coalesce(a.status,'booked') as status,
             coalesce(a.source,'') as source,
             case when a.status in ('completed','done','fulfilled') then true
                  when upper(a.span) < now() and coalesce(a.status,'') not in ('completed','done','fulfilled','cancelled','no_show') then false
                  else null end as on_time
      from biz_appointments a
      left join biz_services s on s.id = a.service_id and s.client_email = v_tenant
      where a.client_email = v_tenant
        and a.span && tstzrange(v_from, v_to)
        and coalesce(a.status,'') <> 'cancelled'
      order by lower(a.span)
      limit 200
    ) j;

    select count(*),
           count(*) filter (where lower(span) > now()),
           count(*) filter (where now() <@ span),
           count(*) filter (where status in ('completed','done','fulfilled')),
           count(*) filter (where status = 'no_show'),
           count(*) filter (where upper(span) < now() and coalesce(status,'') not in ('completed','done','fulfilled','cancelled','no_show'))
      into v_total, v_upcoming, v_inprog, v_done, v_noshow, v_overdue
      from biz_appointments
     where client_email = v_tenant and span && tstzrange(v_from, v_to) and coalesce(status,'') <> 'cancelled';
  exception when undefined_table then
    return jsonb_build_object('ready', false, 'note', 'scheduling engine not installed (biz_appointments missing)');
  end;

  return jsonb_build_object(
    'ready', true,
    'window', jsonb_build_object('from', v_from, 'to', v_to),
    'stats', jsonb_build_object('total', v_total, 'upcoming', v_upcoming, 'in_progress', v_inprog,
                                'done', v_done, 'no_show', v_noshow, 'overdue', v_overdue),
    'jobs', v_jobs
  );
end $$;

-- ── ops_set_status(secret,email,id,status) → boolean ──────────────────────────
-- Advance ONE job's status from the board. Tenant-guarded: only the caller's own rows.
-- Allowed: booked | in_progress | completed | no_show | cancelled.
create or replace function public.ops_set_status(p_secret text, p_email text, p_id uuid, p_status text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email)); v_st text := lower(trim(coalesce(p_status,''))); v_id uuid;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' or p_id is null then return false; end if;
  if v_st not in ('booked','in_progress','completed','no_show','cancelled') then raise exception 'bad status' using errcode = '22023'; end if;
  update biz_appointments set status = v_st where id = p_id and client_email = v_tenant returning id into v_id;
  return v_id is not null;
end $$;

grant execute on function public.ops_board(text,text,timestamptz,timestamptz) to anon;
grant execute on function public.ops_set_status(text,text,uuid,text)          to anon;

-- PROOF:
-- select public.ops_board('glo_ing_7f3da9c2b4e8','natura@guileoai.com');   -- {ready,stats,jobs[...]}
-- select public.ops_set_status('glo_ing_7f3da9c2b4e8','natura@guileoai.com','<job-uuid>','in_progress'); -- true
