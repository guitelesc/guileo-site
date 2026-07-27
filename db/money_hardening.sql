-- ============================================================================
-- Guileo · MONEY HARDENING — revenue-ledger idempotency for voice payments
-- Paste in Supabase → SQL Editor → Run. Twilio RETRIES the <Pay> result callback on
-- non-2xx/timeouts — the caller's card was charged ONCE, so it must be ledgered ONCE.
-- revenue_record_once dedups on the charge's confirmation code / CallSid, then delegates
-- to the existing public.revenue_record. Gated by the existing _gui_sched_ok secret
-- (same SCHED_SECRET the callbacks already send).
-- BACKWARD-COMPATIBLE: /api/twilio-pay and /api/pay-result work before this is pasted
-- (the RPC 404s and they fall back to the legacy plain revenue_record write, exactly as
-- before); after pasting, a retried callback can never double-count revenue.
-- ============================================================================

create table if not exists public.gui_revenue_idem (
  dedupe_key  text primary key,
  email       text,
  created_at  timestamptz default now()
);
alter table public.gui_revenue_idem enable row level security;

-- revenue_record_once → records the revenue the FIRST time this dedupe key is seen and
-- returns true; returns false (recording NOTHING) if already seen. Atomic via ON CONFLICT.
-- Delegates to public.revenue_record so the ledger row itself is identical to a plain write.
create or replace function public.revenue_record_once(
  p_secret text, p_email text, p_category text, p_amount_cents bigint,
  p_ref text default null, p_source text default null, p_meta jsonb default '{}'::jsonb,
  p_dedupe text default null
) returns boolean language plpgsql security definer set search_path = public as $$
declare v_ins int;
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  if p_dedupe is not null and p_dedupe <> '' then
    insert into public.gui_revenue_idem(dedupe_key, email)
      values (p_dedupe, lower(trim(coalesce(p_email,''))))
      on conflict (dedupe_key) do nothing;
    get diagnostics v_ins = row_count;
    if v_ins = 0 then return false; end if; -- already ledgered — never double-count
  end if; -- no dedupe key → can't dedup, record it (same as the legacy path)
  perform public.revenue_record(p_secret, p_email, p_category, p_amount_cents, p_ref, p_source, p_meta);
  return true;
end $$;

grant execute on function public.revenue_record_once(text,text,text,bigint,text,text,jsonb,text) to anon;

-- ✅ Done. Voice-payment callbacks now ledger each charge at most once, atomically.
-- NOTE: assumes the live revenue_record signature is (secret, email, category, amount_cents,
-- ref, source, meta) — the exact shape the Pages Functions already call it with. If the
-- inner call errors at runtime, run: select proname, pg_get_function_arguments(oid)
-- from pg_proc where proname = 'revenue_record';  and adjust the perform line to match.
