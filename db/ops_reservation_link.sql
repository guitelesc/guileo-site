-- ═════════════════════════════════════════════════════════════════════════════
-- ops_reservation_link.sql — tie an atomic reservation to its appointment, so a
-- later CANCEL can give the stock/capacity back without knowing the original ref.
-- Additive to db/ops_atomic.sql. Idempotent, SCHED-gated (literal), tenant-scoped.
-- ═════════════════════════════════════════════════════════════════════════════

-- 1) carry the appointment id on the reservation row (nullable; only set when a
--    booking that consumed stock actually committed).
alter table if exists public.ops_reservations
  add column if not exists appointment_id uuid;
create index if not exists ops_reservations_appt_idx
  on public.ops_reservations (client_email, appointment_id);

-- 2) ops_reservation_link — stamp appointment_id onto the reservation for a ref.
--    Best-effort: no row / already linked → clean no-op. SCHED-gated.
create or replace function public.ops_reservation_link(
  p_secret text, p_email text, p_ref text, p_appointment_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $func$
begin
  if not _ops_sched_ok(p_secret) then return jsonb_build_object('ok', false, 'reason', 'unauthorized'); end if;
  if p_email is null or p_email = '' or p_ref is null or p_ref = '' or p_appointment_id is null then
    return jsonb_build_object('ok', false, 'reason', 'bad_request');
  end if;
  update public.ops_reservations
     set appointment_id = p_appointment_id
   where client_email = p_email and ref = p_ref;
  return jsonb_build_object('ok', true, 'linked', found);
end $func$;
grant execute on function public.ops_reservation_link(text,text,text,uuid) to anon;

-- 3) rpc_reserve_release_by_appt — resolve the ref from the appointment id and
--    delegate to rpc_reserve_release (which reverses stock+capacity exactly once,
--    idempotently). Cancel/no-show returns the reserved units to the shelf.
create or replace function public.rpc_reserve_release_by_appt(
  p_secret text, p_email text, p_appointment_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $func$
declare v_ref text;
begin
  if not _ops_sched_ok(p_secret) then return jsonb_build_object('ok', false, 'reason', 'unauthorized'); end if;
  if p_email is null or p_email = '' or p_appointment_id is null then
    return jsonb_build_object('ok', false, 'reason', 'bad_request');
  end if;
  select ref into v_ref from public.ops_reservations
    where client_email = p_email and appointment_id = p_appointment_id
    order by created_at desc nulls last limit 1;
  if v_ref is null then
    return jsonb_build_object('ok', true, 'released', false, 'note', 'no_reservation_for_appt');
  end if;
  return public.rpc_reserve_release(p_secret, p_email, v_ref);
end $func$;
grant execute on function public.rpc_reserve_release_by_appt(text,text,uuid) to anon;
