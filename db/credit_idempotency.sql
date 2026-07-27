-- ============================================================================
-- Guileo · Credit idempotency (defense-in-depth on the money path)
-- Paste in Supabase → SQL Editor → Run. Guarantees a Stripe event credits a client
-- AT MOST ONCE, even if mark_webhook_seen ever races or the same event is delivered twice.
-- Self-contained: own table + own RPC, gated by the existing _gui_pend_ok secret.
-- BACKWARD-COMPATIBLE: the webhook works before this is pasted (it just falls back to
-- the existing dedup); after pasting, crediting is atomically idempotent by event id.
-- ============================================================================

create table if not exists public.gui_credit_idem (
  event_id    text primary key,
  email       text,
  created_at  timestamptz default now()
);
alter table public.gui_credit_idem enable row level security;

-- claim_credit_event → TRUE the first time this event id is seen (proceed to credit),
-- FALSE if it was already claimed (skip — never double-credit). Atomic via ON CONFLICT.
create or replace function public.claim_credit_event(p_secret text, p_event_id text, p_email text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_ins int;
begin
  if not public._gui_pend_ok(p_secret) then raise exception 'unauthorized'; end if;
  if p_event_id is null or p_event_id = '' then return true; end if; -- no id → can't dedup, let it through
  insert into public.gui_credit_idem(event_id, email)
    values (p_event_id, lower(trim(coalesce(p_email,''))))
    on conflict (event_id) do nothing;
  get diagnostics v_ins = row_count;
  return v_ins > 0;
end $$;

grant execute on function public.claim_credit_event(text,text,text) to anon;

-- ✅ Done. The Stripe webhook now credits each event at most once, atomically.
