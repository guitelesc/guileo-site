-- ─────────────────────────────────────────────────────────────────────────────
-- Guileo — MONEY RECONCILIATION ("prove Stripe = ledger").
-- Project ynihodbknhjirkdogxby (account smart@guileoai.com).
--
-- The daily cron /api/money-reconcile pulls the window's Stripe events
-- (checkout.session.completed + invoice.paid) straight from the Stripe API, sums
-- the cents, and compares against what OUR ledger recorded for the same window:
--   • client_events type='payment' channel='stripe' (written by stripe-webhook.js
--     via ingest_client_event for plans, topups and recurring fulfills), PLUS
--   • the tenant revenue ledger rows written by revenue_record with
--     source='stripe-link' and category='invoice' (the close&collect client_charge
--     branch writes ONLY revenue_record, never a client_event — counting both
--     sides without overlap: package/membership/giftcard write BOTH a client_event
--     AND a revenue row, so on the revenue side we count ONLY category='invoice').
-- Every run lands in money_reconcile_runs; a CFO can open the table and see, for
-- every day, Stripe总 vs ledger总 and the exact mismatch list when they differ.
--
-- SECURITY: both RPCs are gated by the INGEST shared literal (same as the other
-- server-side write RPCs) and SECURITY DEFINER; the base table is RLS-locked with
-- NO anon policies, so the only doors are these gated functions. Idempotent
-- (safe to re-run this whole file); one row per (window_start, window_end).
--
-- Paste in the Supabase SQL Editor (project ynihodbknhjirkdogxby, smart@guileoai.com).
-- Until pasted, /api/money-reconcile returns a graceful { ready:false } — nothing breaks.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.money_reconcile_runs (
  id              bigint generated always as identity primary key,
  ran_at          timestamptz not null default now(),
  window_start    timestamptz not null,
  window_end      timestamptz not null,
  stripe_cents    bigint not null default 0,
  ledger_cents    bigint not null default 0,
  credited_events int    not null default 0,
  ledgered_events int    not null default 0,
  mismatches      jsonb  not null default '[]'::jsonb,
  ok              boolean not null default false
);
alter table public.money_reconcile_runs enable row level security; -- no policies → anon can't touch it directly
create unique index if not exists money_reconcile_runs_window
  on public.money_reconcile_runs (window_start, window_end);

-- 1) reconcile_ledger_window(p_secret, p_from, p_to) → what OUR ledger says the window earned.
--    Returns json:
--      { ready:true, payment_cents, payment_count,      -- client_events 'payment' side
--        revenue_cents, revenue_count, revenue_ready,   -- revenue-ledger client_charge side
--        ledger_cents, ledger_count }                   -- the combined number to compare
--    The tenant revenue ledger was created by a paste outside this repo, so its table name
--    isn't guaranteed here: we probe the known candidates and read the first that exists,
--    inside EXCEPTION blocks — a missing/renamed table degrades to revenue_ready:false
--    instead of breaking the run (the endpoint then reconciles the client_events side only).
create or replace function public.reconcile_ledger_window(p_secret text, p_from timestamptz, p_to timestamptz)
returns json
language plpgsql stable security definer set search_path = public as $func$
declare
  v_pay_cents bigint := 0;
  v_pay_count int := 0;
  v_rev_cents bigint := 0;
  v_rev_count int := 0;
  v_rev_ready boolean := false;
  v_tbl text;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;

  -- client_events payment side (plans, topups, package/membership/giftcard fulfills).
  -- amount is stored in DOLLARS (webhook writes p_amount = cents/100) → back to cents.
  begin
    select coalesce(round(sum(e.amount) * 100)::bigint, 0), count(*)::int
      into v_pay_cents, v_pay_count
      from public.client_events e
     where e.channel = 'stripe' and e.type = 'payment' and e.amount > 0
       and e.created_at >= p_from and e.created_at < p_to;
  exception when others then v_pay_cents := 0; v_pay_count := 0;
  end;

  -- tenant revenue ledger side — ONLY category='invoice' + source='stripe-link'
  -- (the close&collect client_charge branch), to avoid double-counting the recurring
  -- fulfills that already appear as client_events payments above.
  foreach v_tbl in array array['gui_revenue', 'revenue_ledger', 'biz_revenue', 'crm_revenue'] loop
    exit when v_rev_ready;
    if to_regclass('public.' || v_tbl) is not null then
      begin
        execute format(
          'select coalesce(sum(amount_cents),0)::bigint, count(*)::int from public.%I '
          || 'where source = ''stripe-link'' and category = ''invoice'' and created_at >= $1 and created_at < $2',
          v_tbl) into v_rev_cents, v_rev_count using p_from, p_to;
        v_rev_ready := true;
      exception when others then v_rev_cents := 0; v_rev_count := 0; -- wrong shape → keep probing
      end;
    end if;
  end loop;

  return json_build_object(
    'ready', true,
    'payment_cents', v_pay_cents, 'payment_count', v_pay_count,
    'revenue_cents', v_rev_cents, 'revenue_count', v_rev_count, 'revenue_ready', v_rev_ready,
    'ledger_cents', v_pay_cents + v_rev_cents, 'ledger_count', v_pay_count + v_rev_count
  );
end;
$func$;
grant execute on function public.reconcile_ledger_window(text, timestamptz, timestamptz) to anon;

-- 2) reconcile_run_record(...) → upsert the run for its window (idempotent: re-running the
--    same window updates the same row instead of stacking duplicates) and tell the caller
--    whether THIS window had already been recorded and with what ok-state, so the endpoint
--    alerts the owner ONCE per broken window, not on every cron retry.
--    Returns json { id, was_new, prev_ok }.
create or replace function public.reconcile_run_record(
  p_secret text, p_window_start timestamptz, p_window_end timestamptz,
  p_stripe_cents bigint, p_ledger_cents bigint,
  p_credited_events int, p_ledgered_events int,
  p_mismatches jsonb, p_ok boolean
) returns json
language plpgsql security definer set search_path = public as $func$
declare
  v_id bigint;
  v_prev_ok boolean;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;

  select ok into v_prev_ok from public.money_reconcile_runs
   where window_start = p_window_start and window_end = p_window_end;

  insert into public.money_reconcile_runs
    (window_start, window_end, stripe_cents, ledger_cents, credited_events, ledgered_events, mismatches, ok)
  values
    (p_window_start, p_window_end, p_stripe_cents, p_ledger_cents, p_credited_events, p_ledgered_events,
     coalesce(p_mismatches, '[]'::jsonb), coalesce(p_ok, false))
  on conflict (window_start, window_end) do update set
    ran_at = now(), stripe_cents = excluded.stripe_cents, ledger_cents = excluded.ledger_cents,
    credited_events = excluded.credited_events, ledgered_events = excluded.ledgered_events,
    mismatches = excluded.mismatches, ok = excluded.ok
  returning id into v_id;

  return json_build_object('id', v_id, 'was_new', v_prev_ok is null, 'prev_ok', coalesce(v_prev_ok, false));
end;
$func$;
grant execute on function public.reconcile_run_record(text, timestamptz, timestamptz, bigint, bigint, int, int, jsonb, boolean) to anon;
