-- ============================================================================
-- Guileo · INTEGRITY CHECK — "THE DATA CANNOT LIE" cross-department auditor.
-- Paste in Supabase → SQL Editor → Run. Project ynihodbknhjirkdogxby. Idempotent.
-- ============================================================================
-- WHY: every department (CRM, scheduling, money, ops) writes into the SAME graph.
-- If those writes are correct, a set of INVARIANTS must hold ACROSS departments:
-- a Won deal implies cash, a completed paid booking implies a payment record, credits
-- are never negative, every payment grants a credit, inventory never goes below zero.
-- This RPC READS ONLY and returns every place the data contradicts itself — so a
-- "paid-but-nothing" or a lost-revenue drift is caught by a nightly sweep instead of
-- by a customer's money-back request. It writes NOTHING and touches no other tenant.
--
-- CONTRACT:
--   integrity_check(secret, email) -> jsonb ARRAY of violations, each:
--       { kind, ref, detail, severity }   severity ∈ 'high' | 'medium' | 'low'
--   integrity_summary(secret)       -> jsonb { by_kind:{...}, total, high, tenants_scanned }
--       (platform-wide counts by kind, for the /admin QualityPanel)
--
-- SAFETY / HONESTY:
--   • INGEST-gated (the same literal every data RPC uses) + SECURITY DEFINER + STABLE.
--   • Tenant-scoped: integrity_check only ever reads rows WHERE ... = the passed email.
--   • DEGRADES GRACEFULLY: each check runs in its own BEGIN/EXCEPTION block; a table or
--     column that doesn't exist yet (undefined_table / undefined_column) SKIPS that
--     check instead of failing the audit. Adding a department later just lights up more.
--   • Read-only: no INSERT/UPDATE/DELETE anywhere. Safe to run as often as you like.
-- ============================================================================

-- ── integrity_check(secret, email) → jsonb[] of this tenant's invariant violations ──
create or replace function public.integrity_check(p_secret text, p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant text := lower(trim(coalesce(p_email, '')));
  v_out    jsonb := '[]'::jsonb;
  v_rows   jsonb;
  v_pay_count    bigint;
  v_credit_count bigint;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_tenant = '' then
    raise exception 'tenant required' using errcode = '22023';
  end if;

  -- ── (a) Won deal with NO revenue trace for its contact ─────────────────────────
  -- A crm_deal marked won/closed with value > 0 should have at least one payment
  -- event on that contact's timeline. None = revenue claimed but no cash recorded.
  begin
    select coalesce(jsonb_agg(jsonb_build_object(
             'kind',     'won_deal_without_revenue',
             'ref',      d.id::text,
             'detail',   'Deal "' || coalesce(d.title, '(untitled)') || '" is won ('
                         || (coalesce(d.value_cents, 0) / 100.0)::numeric(12,2)
                         || ' USD) but no payment event exists on its contact timeline',
             'severity', 'high'
           )), '[]'::jsonb)
      into v_rows
      from crm_deals d
     where d.client_email = v_tenant
       and d.status = 'won'
       and coalesce(d.value_cents, 0) > 0
       and d.contact_id is not null
       and not exists (
             select 1 from crm_timeline_events e
              where e.client_email = v_tenant
                and e.contact_id = d.contact_id
                and e.event_type = 'payment'
           );
    v_out := v_out || v_rows;
  exception when undefined_table or undefined_column then null; -- department not installed → skip
  end;

  -- ── (b) Completed booking WITH a price but NO payment/revenue event ─────────────
  -- A finished appointment whose service has a price, where no payment event ties to
  -- that customer, is a revenue leak candidate. severity=medium: it may legitimately
  -- be cash-in-person that was never logged — worth a look, not an alarm.
  begin
    select coalesce(jsonb_agg(jsonb_build_object(
             'kind',     'completed_booking_without_payment',
             'ref',      a.id::text,
             'detail',   'Completed "' || coalesce(s.name, 'service') || '" priced '
                         || (s.price_cents / 100.0)::numeric(12,2)
                         || ' USD has no payment event (unlogged cash? or lost revenue) for '
                         || coalesce(nullif(a.customer_contact, ''), '(no contact)'),
             'severity', 'medium'
           )), '[]'::jsonb)
      into v_rows
      from biz_appointments a
      join biz_services s
        on s.id = a.service_id and s.client_email = v_tenant
     where a.client_email = v_tenant
       and coalesce(a.status, '') in ('completed', 'done', 'fulfilled')
       and coalesce(s.price_cents, 0) > 0
       and not exists (
             select 1
               from crm_timeline_events e
               join crm_contacts c
                 on c.id = e.contact_id and c.client_email = v_tenant
              where e.client_email = v_tenant
                and e.event_type = 'payment'
                and (
                      c.phone = a.customer_contact
                   or lower(coalesce(c.email, '')) = lower(coalesce(a.customer_contact, ''))
                    )
           );
    v_out := v_out || v_rows;
  exception when undefined_table or undefined_column then null;
  end;

  -- ── (c) client_credits with NEGATIVE credits ───────────────────────────────────
  -- Money law: a balance is NEVER negative. If this ever fires, an unguarded deduct
  -- slipped past the clamp — an atomicity bug, not a business condition. severity=high.
  begin
    select coalesce(jsonb_agg(jsonb_build_object(
             'kind',     'negative_credit_balance',
             'ref',      cc.client_email,
             'detail',   'client_credits balance is ' || cc.credits || ' (must never be < 0)',
             'severity', 'high'
           )), '[]'::jsonb)
      into v_rows
      from client_credits cc
     where cc.client_email = v_tenant
       and coalesce(cc.credits, 0) < 0;
    v_out := v_out || v_rows;
  exception when undefined_table or undefined_column then null;
  end;

  -- ── (d) 'payment' client_event with no matching credit grant (paid_but_uncredited) ─
  -- Every credited Stripe payment writes a gui_credit_idem claim. If this tenant has
  -- MORE payment events than credit claims, money came in that never granted service
  -- credit → the customer paid for nothing. Aggregate (per-row keys differ by channel),
  -- matching how money_reconcile already frames the drift. severity=high.
  begin
    select count(*) into v_pay_count
      from client_events ce
     where ce.client_email = v_tenant
       and ce.type = 'payment';

    select count(*) into v_credit_count
      from gui_credit_idem gi
     where gi.email = v_tenant;

    if coalesce(v_pay_count, 0) > coalesce(v_credit_count, 0) then
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'kind',     'paid_but_uncredited',
        'ref',      v_tenant,
        'detail',   coalesce(v_pay_count, 0) || ' payment event(s) but only '
                    || coalesce(v_credit_count, 0) || ' credit grant(s) — '
                    || (coalesce(v_pay_count, 0) - coalesce(v_credit_count, 0))
                    || ' payment(s) may have credited nothing',
        'severity', 'high'
      ));
    end if;
  exception when undefined_table or undefined_column then null;
  end;

  -- ── (e) ops_inventory_items on_hand < 0  (CANARY) ──────────────────────────────
  -- Atomic stock decrements can never drop below zero; a negative on_hand means the
  -- guard was bypassed. Impossible-if-correct, so any hit is a high-severity canary.
  -- The ops tables are tenant-scoped by tenant_id per db/company-os/operations.md;
  -- if the column/table isn't present yet the whole check simply skips.
  begin
    select coalesce(jsonb_agg(jsonb_build_object(
             'kind',     'negative_inventory',
             'ref',      i.id::text,
             'detail',   'Inventory "' || coalesce(i.name, i.sku, i.id::text)
                         || '" on_hand = ' || i.on_hand || ' (< 0 is impossible if atomic)',
             'severity', 'high'
           )), '[]'::jsonb)
      into v_rows
      from ops_inventory_items i
     where i.tenant_id = v_tenant
       and coalesce(i.on_hand, 0) < 0;
    v_out := v_out || v_rows;
  exception when undefined_table or undefined_column then null;
  end;

  return v_out;
end;
$$;

grant execute on function public.integrity_check(text, text) to anon;


-- ── integrity_summary(secret) → platform-wide counts by kind, for /admin ───────────
-- Runs the SAME invariants across ALL tenants and returns counts by kind + a high-
-- severity total, so the QualityPanel can show one honest "data integrity" number
-- without leaking any single tenant's rows. Read-only, INGEST-gated. Each check
-- degrades independently, exactly like integrity_check.
create or replace function public.integrity_summary(p_secret text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_by_kind jsonb := '{}'::jsonb;
  v_total   bigint := 0;
  v_high    bigint := 0;
  v_tenants bigint := 0;
  v_n       bigint;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  -- rough count of distinct tenants seen (best-effort; from client_credits which every
  -- billed tenant has a row in). Purely informational for the panel header.
  begin
    select count(distinct client_email) into v_tenants from client_credits;
  exception when undefined_table then v_tenants := 0;
  end;

  -- (a) won deals without revenue
  begin
    select count(*) into v_n
      from crm_deals d
     where d.status = 'won' and coalesce(d.value_cents, 0) > 0 and d.contact_id is not null
       and not exists (
             select 1 from crm_timeline_events e
              where e.client_email = d.client_email
                and e.contact_id = d.contact_id
                and e.event_type = 'payment');
    v_by_kind := v_by_kind || jsonb_build_object('won_deal_without_revenue', v_n);
    v_total := v_total + v_n; v_high := v_high + v_n;
  exception when undefined_table or undefined_column then null;
  end;

  -- (b) completed priced bookings without payment
  begin
    select count(*) into v_n
      from biz_appointments a
      join biz_services s on s.id = a.service_id and s.client_email = a.client_email
     where coalesce(a.status,'') in ('completed','done','fulfilled')
       and coalesce(s.price_cents,0) > 0
       and not exists (
             select 1 from crm_timeline_events e
               join crm_contacts c on c.id = e.contact_id and c.client_email = a.client_email
              where e.client_email = a.client_email and e.event_type = 'payment'
                and (c.phone = a.customer_contact
                     or lower(coalesce(c.email,'')) = lower(coalesce(a.customer_contact,''))));
    v_by_kind := v_by_kind || jsonb_build_object('completed_booking_without_payment', v_n);
    v_total := v_total + v_n;
  exception when undefined_table or undefined_column then null;
  end;

  -- (c) negative credit balances
  begin
    select count(*) into v_n from client_credits where coalesce(credits,0) < 0;
    v_by_kind := v_by_kind || jsonb_build_object('negative_credit_balance', v_n);
    v_total := v_total + v_n; v_high := v_high + v_n;
  exception when undefined_table or undefined_column then null;
  end;

  -- (d) paid_but_uncredited (tenants where payment events outnumber credit grants)
  begin
    select count(*) into v_n from (
      select ce.client_email
        from client_events ce
       where ce.type = 'payment'
       group by ce.client_email
      having count(*) > coalesce(
               (select count(*) from gui_credit_idem gi where gi.email = ce.client_email), 0)
    ) q;
    v_by_kind := v_by_kind || jsonb_build_object('paid_but_uncredited', v_n);
    v_total := v_total + v_n; v_high := v_high + v_n;
  exception when undefined_table or undefined_column then null;
  end;

  -- (e) negative inventory canary
  begin
    select count(*) into v_n from ops_inventory_items where coalesce(on_hand,0) < 0;
    v_by_kind := v_by_kind || jsonb_build_object('negative_inventory', v_n);
    v_total := v_total + v_n; v_high := v_high + v_n;
  exception when undefined_table or undefined_column then null;
  end;

  return jsonb_build_object(
    'by_kind',         v_by_kind,
    'total',           v_total,
    'high',            v_high,
    'tenants_scanned', v_tenants,
    'checked_at',      now()
  );
end;
$$;

grant execute on function public.integrity_summary(text) to anon;

-- ── PROVE (round-trip, read-only) ─────────────────────────────────────────────────
--   select integrity_check('glo_ing_7f3da9c2b4e8','eval-sandbox@guileoai.com'); -- [] on clean data
--   select integrity_summary('glo_ing_7f3da9c2b4e8');                           -- {by_kind,total,high,...}
-- To force-fire (a) on the sandbox (then roll back), in a transaction:
--   begin;
--     insert into crm_contacts (client_email, phone, full_name)
--       values ('eval-sandbox@guileoai.com','+13475559999','Integrity Canary') returning id; -- note the id
--     insert into crm_deals (client_email, contact_id, title, value_cents, stage, status)
--       values ('eval-sandbox@guileoai.com','<that id>','Canary deal', 9900, 'won', 'won');
--     select integrity_check('glo_ing_7f3da9c2b4e8','eval-sandbox@guileoai.com'); -- shows won_deal_without_revenue
--   rollback;
-- ✅ Done. Two read-only auditors: per-tenant violations + platform summary. No new
--    table, no anon-writable door, safe to paste twice.
