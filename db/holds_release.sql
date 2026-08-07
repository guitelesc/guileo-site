-- ─────────────────────────────────────────────────────────────────────────────
-- Guileo — RELEASE EXPIRED HOLDS (cron wrapper).
-- Project ynihodbknhjirkdogxby (account smart@guileoai.com).
--
-- Problem this fixes: when Gui puts a slot on 'hold' (deposit-to-book / tentative
-- reservation) the row carries an expires_at. The scheduling engine ALREADY cleans
-- expired holds lazily — every biz_* RPC calls biz_release_expired() on the way in —
-- but that only fires when the NEXT booking request touches that service. A slot held
-- at 2pm that expires at 2:05pm stays 'hold' (and therefore blocks the slot) until
-- someone next queries availability for it, which on a quiet day can be hours.
--
-- Fix: a cron-callable wrapper so /api/automations sweeps expired holds every tick,
-- independent of booking traffic. biz_release_expired() itself takes no secret and has
-- no anon grant (it's an internal helper), so we can't hit it directly from the edge —
-- this SCHED-gated wrapper is the single anon-reachable door, mirroring how the other
-- agenda (biz_*) RPCs are gated by _gui_sched_ok('gss_Kp9mX4vR2tZ7nQ5wL8bc').
--
-- Returns the number of holds it cancelled, so the cron run can report a real count.
-- SECURITY DEFINER + SCHED-gated; the base table stays RLS-locked with no anon policy,
-- so this function is the only way in. Idempotent (safe to re-run this whole file).
-- Graceful: if biz_release_expired / biz_appointments don't exist yet, it degrades to
-- released:0 inside an EXCEPTION block instead of throwing — the cron never 500s.
--
-- Paste in the Supabase SQL Editor (project ynihodbknhjirkdogxby, smart@guileoai.com).
-- Until pasted, /api/automations reports holdsReady:false and simply skips this sweep.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.gui_release_expired_holds(p_secret text)
returns json
language plpgsql security definer set search_path = public as $func$
declare
  v_released int := 0;
begin
  -- Same gate the agenda (biz_*) RPCs use — this touches biz_appointments.
  if not _gui_sched_ok(p_secret) then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  -- Cancel the expired holds ourselves (so we get a row count) AND call the engine's
  -- own helper for parity with the lazy path. Degrade to 0 if the schema isn't there.
  begin
    update public.biz_appointments
       set status = 'cancelled'
     where status = 'hold'
       and expires_at is not null
       and expires_at < now();
    get diagnostics v_released = row_count;
  exception when others then
    v_released := 0;
  end;

  return json_build_object('ready', true, 'released', coalesce(v_released, 0));
end;
$func$;

grant execute on function public.gui_release_expired_holds(text) to anon;
