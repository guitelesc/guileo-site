-- ============================================================================
-- Guileo · Money guardrails — RECONCILIATION (prove Stripe total = ledger total)
-- Paste in Supabase → SQL Editor → Run. Idempotent (create or replace / if not exists).
-- INGEST-gated (same literal as add_client_credits / ingest_client_event); read-only.
--
-- Why: every credited payment writes a client_events row (type='payment', p_amount = USD)
-- and every credit grant claims a row in gui_credit_idem (db/credit_idempotency.sql).
-- money_reconcile aggregates both so /admin (or a curl) can prove, for any window:
--   Stripe payouts total  ==  payments_usd − refunds_usd     (amounts)
--   every paid session credited exactly once                 (claims vs payment events)
-- and lists the anomaly events (failure/paid_but_uncredited/non_usd_payment) that the
-- webhook now emits instead of dropping money silently.
-- ============================================================================

-- fast window scans over the money event types (no-op if it already exists)
create index if not exists client_events_money_idx
  on public.client_events (type, created_at desc)
  where type in ('payment', 'refund', 'failure');

create or replace function public.money_reconcile(p_secret text, p_days int default 30)
returns json
language plpgsql stable security definer set search_path = public as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, coalesce(p_days, 30)));
  v_out json;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select json_build_object(
    'window_days', greatest(1, coalesce(p_days, 30)),
    'since', v_since,
    -- money in: every credited/ledgered Stripe payment (plans, topups, tenant fulfils)
    'payments_usd', coalesce((select round(sum(amount)::numeric, 2) from public.client_events
                               where type = 'payment' and created_at >= v_since), 0),
    'payments_count', coalesce((select count(*) from public.client_events
                                 where type = 'payment' and created_at >= v_since), 0),
    -- money out: refunds/disputes ledgered as negative amounts by the webhook
    'refunds_usd', coalesce((select round(sum(amount)::numeric, 2) from public.client_events
                              where type = 'refund' and created_at >= v_since), 0),
    'refunds_count', coalesce((select count(*) from public.client_events
                                where type = 'refund' and created_at >= v_since), 0),
    'net_usd', coalesce((select round(sum(amount)::numeric, 2) from public.client_events
                          where type in ('payment', 'refund') and created_at >= v_since), 0),
    -- credit claims: one row per credited session/invoice (gui_credit_idem). A claim count
    -- far below the GUILEO payment count = paid-but-uncredited drift; far above = double-credit.
    'credit_claims', coalesce((select count(*) from public.gui_credit_idem
                                where created_at >= v_since), 0),
    -- loud anomalies the webhook emits instead of dropping money (paid_but_uncredited,
    -- non_usd_payment, zero_amount_checkout, credit_storage_failed, async_payment_failed…)
    'anomalies', coalesce((select json_agg(json_build_object(
                              'at', e.created_at, 'summary', e.summary) order by e.created_at desc)
                            from (select created_at, summary from public.client_events
                                   where type = 'failure' and created_at >= v_since
                                   order by created_at desc limit 50) e), '[]'::json)
  ) into v_out;
  return v_out;
end $$;

grant execute on function public.money_reconcile(text, int) to anon;

-- ✅ Done. Reconcile any window with:
--   select public.money_reconcile('glo_ing_7f3da9c2b4e8', 30);
