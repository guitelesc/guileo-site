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
