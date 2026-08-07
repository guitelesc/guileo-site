-- ─────────────────────────────────────────────────────────────────────────────
-- Guileo — MONEY RECONCILIATION, CHARGE TRACK (close&collect direct charges).
-- Project ynihodbknhjirkdogxby (account smart@guileoai.com).
--
-- Companion to db/money_reconcile.sql. The main reconcile_ledger_window proves the
-- CHECKOUT/INVOICE money path (subscriptions, top-ups, package/membership/giftcard) —
-- i.e. checkout.session.* + invoice.paid. This file proves the SECOND money path:
-- DIRECT CHARGES the agent collects on the call / by pay-link (Gui "Fecha & Cobra"):
--   • source='gui-voice-pay' — Twilio Pay collected live on the voice call,
--   • source='phone'         — a phone/manual charge the agent takes,
--   • source='stripe-link'   — a Stripe payment-link the customer paid.
-- On Stripe these land as charge.succeeded (net of charge.refunded), carrying
-- metadata.guileo='client_charge' (the tenant's customer paying the tenant — never a
-- Guileo SaaS subscription, which this deliberately excludes). /api/money-reconcile
-- pulls those charges and compares the platform-account total against what THIS RPC
-- reports the tenant revenue ledger recorded for the same window.
--
-- SECURITY: INGEST-gated (same door as reconcile_ledger_window — this reads the tenant
-- revenue ledger), SECURITY DEFINER, STABLE. The revenue table name isn't guaranteed in
-- this repo (created by a paste outside it), so we probe the known candidates inside
-- EXCEPTION blocks: a missing/renamed table degrades to ready:false (the endpoint then
-- simply skips the charge track) instead of breaking the run. Idempotent — re-runnable.
--
-- Paste in the Supabase SQL Editor (project ynihodbknhjirkdogxby, smart@guileoai.com).
-- Until pasted, /api/money-reconcile reports charge_ready:false and skips this track.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.reconcile_charges_window(p_secret text, p_from timestamptz, p_to timestamptz)
returns json
language plpgsql stable security definer set search_path = public as $func$
declare
  v_cents bigint := 0;
  v_count int := 0;
  v_ready boolean := false;
  v_tbl text;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;

  -- Tenant revenue ledger — the close&collect direct-charge sources. Sum amount_cents
  -- as-is so refund rows (negative) net out, mirroring the Stripe net (succeeded − refunded).
  -- client_revenue FIRST — it is the actual ledger revenue_record writes to (see db/revenue_month.sql)
  foreach v_tbl in array array['client_revenue', 'gui_revenue', 'revenue_ledger', 'biz_revenue', 'crm_revenue'] loop
    exit when v_ready;
    if to_regclass('public.' || v_tbl) is not null then
      -- timestamp column differs by table: client_revenue uses ts, others created_at
      declare v_ts text;
      begin
        foreach v_ts in array array['ts', 'created_at'] loop
          exit when v_ready;
          begin
            execute format(
              'select coalesce(sum(amount_cents),0)::bigint, count(*)::int from public.%I '
              || 'where source in (''gui-voice-pay'',''phone'',''stripe-link'') '
              || 'and %I >= $1 and %I < $2',
              v_tbl, v_ts, v_ts) into v_cents, v_count using p_from, p_to;
            v_ready := true;
          exception when others then v_cents := 0; v_count := 0; -- wrong shape → keep probing
          end;
        end loop;
      end;
    end if;
  end loop;

  return json_build_object(
    'ready', v_ready,
    'charge_cents', v_cents, 'charge_count', v_count
  );
end;
$func$;
grant execute on function public.reconcile_charges_window(text, timestamptz, timestamptz) to anon;
