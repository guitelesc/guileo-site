-- ─────────────────────────────────────────────────────────────────────────────
-- Guileo · REVENUE_MONTH — the ROI proof reads the REAL money spine.
-- Project ynihodbknhjirkdogxby (account smart@guileoai.com). Paste in the SQL Editor.
--
-- WHY: the weekly value block was summing `client_events` (dollars, marketing feed),
-- so `totalMonth` came out ~0 for almost every client — the money the agent actually
-- collects/books is written to the LEDGER `public.client_revenue` (revenue_record) and
-- to `public.crm_timeline_events`, NOT to client_events. This RPC sums the ledger first
-- (the truth) and gap-fills from the timeline, in integer CENTS.
--
-- DEDUPE RULE (documented, no double-count):
--   • `client_revenue` is AUTHORITATIVE for money charged — every qualifying row counts.
--   • A `crm_timeline_events` revenue event is counted ONLY for a category the ledger has
--     NOTHING for in this window (i.e. "timeline booking only when there is no corresponding
--     ledger row"). A booking that was charged appears in BOTH tables → the ledger wins and
--     the timeline copy is ignored, so it is never counted twice.
--
-- EXCLUDES cancelled / no-show / voided / refunded on BOTH sides (meta.status / payload.status),
-- and only positive amounts. Everything summed in integer cents (amount_cents / amount_cents).
--
-- SECURITY: gated by the INGEST shared literal `glo_ing_7f3da9c2b4e8` (= INGEST_SECRET,
-- same door as the other server-side read RPCs), SECURITY DEFINER, granted to anon. The base
-- tables are RLS-locked with no anon policies, so this gated function is the only door.
-- DEFENSIVE: each table read is wrapped in EXCEPTION so a missing/renamed table degrades to a
-- partial (or zero) result instead of failing; the whole body degrades to {total_cents:0}.
-- Idempotent (create or replace). Until pasted, client-report.js falls back to the legacy
-- client_events sum — nothing breaks.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.revenue_month(
  p_secret text,
  p_email  text,
  p_since  timestamptz
) returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_email  text        := lower(trim(coalesce(p_email, '')));
  v_since  timestamptz := coalesce(p_since, now() - interval '30 days');
  v_ledger jsonb  := '{}'::jsonb;   -- category    -> cents  (the money truth)
  v_tl     jsonb  := '{}'::jsonb;   -- event_type  -> cents  (timeline gap-fill)
  v_tlc    jsonb  := '{}'::jsonb;   -- event_type  -> row count
  v_by     jsonb  := '{}'::jsonb;
  v_total  bigint := 0;
  v_count  int    := 0;
  v_key    text;
  v_val    bigint;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  -- 1) LEDGER (public.client_revenue) — source of truth for money actually charged/booked.
  --    Sum positive cents per category; skip rows flagged cancelled/no-show/void/refund in meta.
  begin
    select coalesce(jsonb_object_agg(t.category, t.cents), '{}'::jsonb),
           coalesce(sum(t.cnt), 0)::int
      into v_ledger, v_count
    from (
      select coalesce(nullif(r.category, ''), 'other') as category,
             sum(r.amount_cents)::bigint               as cents,
             count(*)::int                             as cnt
        from public.client_revenue r
       where r.client_email = v_email
         and r.ts >= v_since
         and r.amount_cents > 0
         and coalesce(lower(r.meta->>'status'), '') not in
             ('cancelled','canceled','no_show','no-show','noshow','void','voided','refunded','refund')
       group by 1
    ) t;
  exception when others then
    v_ledger := '{}'::jsonb; v_count := 0;
  end;

  -- 2) TIMELINE (public.crm_timeline_events) — gap-fill only. Same exclusions, positive only.
  begin
    select coalesce(jsonb_object_agg(t.bucket, t.cents), '{}'::jsonb),
           coalesce(jsonb_object_agg(t.bucket, t.cnt),   '{}'::jsonb)
      into v_tl, v_tlc
    from (
      select e.event_type                    as bucket,
             sum(e.amount_cents)::bigint      as cents,
             count(*)::int                    as cnt
        from public.crm_timeline_events e
       where e.client_email = v_email
         and e.occurred_at >= v_since
         and e.amount_cents > 0
         and e.event_type in ('booking','sale','invoice','deposit','order','payment')
         and coalesce(lower(e.payload->>'status'), '') not in
             ('cancelled','canceled','no_show','no-show','noshow','void','voided','refunded','refund')
       group by 1
    ) t;
  exception when others then
    v_tl := '{}'::jsonb; v_tlc := '{}'::jsonb;
  end;

  -- 3) MERGE — ledger first (truth); add a timeline bucket ONLY when the ledger has none for it.
  v_by := v_ledger;
  for v_key, v_val in select key, (value)::bigint from jsonb_each_text(v_tl) loop
    if not (v_by ? v_key) then
      v_by    := v_by || jsonb_build_object(v_key, v_val);
      v_count := v_count + coalesce((v_tlc->>v_key)::int, 0);
    end if;
  end loop;

  -- 4) total_cents = sum of the merged buckets.
  select coalesce(sum((value)::bigint), 0) into v_total from jsonb_each_text(v_by);

  return jsonb_build_object('total_cents', v_total, 'by_type', v_by, 'count', v_count);
exception when others then
  return jsonb_build_object('total_cents', 0, 'by_type', '{}'::jsonb, 'count', 0);
end;
$fn$;

grant execute on function public.revenue_month(text, text, timestamptz) to anon;

-- ✅ Done. client-report.js reads revenue_month for the month-to-date value block; the ROI
--    proof now reflects the real ledger instead of a near-zero client_events sum.
