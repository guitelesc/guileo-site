-- ─────────────────────────────────────────────────────────────────────────────
-- Guileo · REVENUE_SERIES — a REAL per-day revenue series for the cockpit chart.
-- Project ynihodbknhjirkdogxby (account smart@guileoai.com). Paste in the SQL Editor.
--
-- WHY: the GuileoImpact "Growth" chart was drawing DEMO data (V.revenue) even in real mode.
-- The LEI is: in real mode show real data or hide — never fabricate. This RPC returns the
-- authoritative money ledger `public.client_revenue` bucketed by DAY (integer cents), for the
-- window [p_since → now]. /api/revenue reshapes it into a dense per-day array; the headline
-- total still comes from revenue_month (this is only the chart's shape). Until this file is
-- pasted, /api/revenue returns series:[] and the chart is simply HIDDEN — nothing breaks.
--
-- Ledger-only by design: client_revenue is the source of truth for money charged. We do NOT
-- gap-fill from the timeline here (that dedupe is a per-category concern handled by
-- revenue_month for the TOTAL; a daily chart from the authoritative ledger is honest on its own).
-- Excludes cancelled/no-show/void/refunded, positive cents only — same exclusions as revenue_month.
--
-- SECURITY: INGEST-gated (`glo_ing_7f3da9c2b4e8` = INGEST_SECRET, same door as revenue_month),
-- SECURITY DEFINER, granted to anon; base table stays RLS-locked with no anon policy. Every read
-- is wrapped in EXCEPTION so a missing/renamed table degrades to {series:[]} instead of 500.
-- Idempotent (create or replace).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.revenue_series(
  p_secret text,
  p_email  text,
  p_since  timestamptz
) returns jsonb
language plpgsql stable security definer set search_path = public as $fn$
declare
  v_email  text        := lower(trim(coalesce(p_email, '')));
  v_since  timestamptz := coalesce(p_since, date_trunc('month', now()));
  v_series jsonb        := '[]'::jsonb;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  begin
    select coalesce(
             jsonb_agg(
               jsonb_build_object('d', to_char(t.day, 'YYYY-MM-DD'), 'cents', t.cents)
               order by t.day
             ),
             '[]'::jsonb)
      into v_series
    from (
      select date_trunc('day', r.ts)   as day,
             sum(r.amount_cents)::bigint as cents
        from public.client_revenue r
       where r.client_email = v_email
         and r.ts >= v_since
         and r.amount_cents > 0
         and coalesce(lower(r.meta->>'status'), '') not in
             ('cancelled','canceled','no_show','no-show','noshow','void','voided','refunded','refund')
       group by 1
    ) t;
  exception when others then
    v_series := '[]'::jsonb;
  end;

  return jsonb_build_object('series', v_series);
exception when others then
  return jsonb_build_object('series', '[]'::jsonb);
end;
$fn$;

grant execute on function public.revenue_series(text, text, timestamptz) to anon;

-- ✅ Done. /api/revenue now returns a real daily series; the GuileoImpact chart draws the ledger.
