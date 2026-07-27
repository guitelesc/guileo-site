-- ═════════════════════════════════════════════════════════════════════════════
-- cx_platform_pulse — a PUBLIC, aggregate-only CX pulse for the landing (Guileo Pulse
-- section). Returns ONLY platform-wide aggregates (avg CX, # businesses measuring, #
-- signals) — NEVER any per-tenant row, comment, contact or business name. Safe to expose
-- anonymously (no secret): there is no PII and no way to attribute a number to a client.
-- HONESTY FLOOR: `ready` is true only once the number is backed by enough real data
-- (≥3 businesses AND ≥25 signals in 90d), so the landing never shows a misleading average
-- computed from one business. Below the floor the component keeps its static copy.
-- ═════════════════════════════════════════════════════════════════════════════
create or replace function public.cx_platform_pulse()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_avg int := 0;
  v_biz int := 0;
  v_signals int := 0;
  v_ready boolean := false;
  v_since timestamptz := now() - interval '90 days';
begin
  begin
    select coalesce(round(avg(score))::int, 0),
           count(distinct client_email),
           count(*)
      into v_avg, v_biz, v_signals
      from public.cx_signals
     where occurred_at >= v_since and score is not null;
  exception when others then
    return jsonb_build_object('ready', false, 'avg_cx', 0, 'businesses', 0, 'signals', 0);
  end;
  v_ready := (coalesce(v_biz, 0) >= 3 and coalesce(v_signals, 0) >= 25);
  return jsonb_build_object(
    'ready', v_ready,
    'avg_cx', (case when v_ready then coalesce(v_avg, 0) else 0 end),  -- never emit an avg below the floor
    'businesses', coalesce(v_biz, 0),
    'signals', coalesce(v_signals, 0)
  );
end $$;

grant execute on function public.cx_platform_pulse() to anon;

-- Prove: select public.cx_platform_pulse();  -- {ready:bool, avg_cx, businesses, signals} — aggregates only
