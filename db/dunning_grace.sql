-- ─────────────────────────────────────────────────────────────────────────────
-- DUNNING GRACE-PERIOD — the delinquency sweep's two data primitives.
-- Problem it solves: today a client whose card fails keeps their Gui + phone
-- number + monthly cost FOREVER (stripe-webhook explicitly never touches
-- provisioning — grace is "a business decision for Luis"). This gives that
-- decision a spine: find who's past grace, and dedupe the nudge/pause so a
-- 15-min cron never spams or double-pauses.
--
-- Sits ON TOP of the events the Stripe webhook already writes — no schema change
-- to client_events, no new state on the tenant:
--   • a FAILED charge  = client_events row  type='billing',
--       payload->>'kind' = 'invoice.payment_failed'  (summary '⚠️ Pagamento falhou…')
--   • a SUCCESSFUL pay  = client_events row  type='payment'  (any successful charge)
-- "Unresolved" = a billing-failure with NO 'payment' event after it. The streak
-- start (min unresolved failure) is the anchor → days_overdue is monotonic and
-- resets the instant the client pays.
--
-- INGEST-gated SECURITY DEFINER; RLS on with NO anon policies; grant execute to
-- anon (PostgREST role). Paste in the Supabase SQL Editor (project
-- ynihodbknhjirkdogxby, account smart@guileoai.com). Until pasted, /api/dunning-
-- sweep still runs but reports candidatesReady:false and does nothing — it lights
-- up on the paste. Every block degrades (returns empty / false), never 500s.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1) CANDIDATES — clients past the grace window with an unresolved failure ──
-- Returns one row per delinquent tenant, oldest-delinquent first. days_overdue is
-- measured from the FIRST unresolved failure (the streak start), so the sweep can
-- split stage-1 (>= grace) from stage-2 (>= grace*2) purely off this number.
-- Read-only. Filters to first_failed_at older than p_grace_days so a fresh failure
-- (Stripe is still retrying) is never surfaced.
create or replace function public.dunning_candidates(p_secret text, p_grace_days int default 10)
returns table(
  client_email    text,
  business_name   text,
  first_failed_at timestamptz,
  days_overdue    int,
  last_amount     text,
  attempts        int
)
language plpgsql
security definer
set search_path = public
as $$
declare g int := greatest(1, coalesce(p_grace_days, 10));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  begin
  return query
  with fails as (
    -- every payment-failure billing event; match on the structured payload kind
    -- (canonical) OR the summary prefix (belt-and-suspenders if an older row lacks the kind)
    select lower(trim(e.client_email)) as em, e.created_at as at,
           coalesce(nullif(e.summary, ''), '') as summ
    from client_events e
    where e.type = 'billing'
      and (e.payload->>'kind' = 'invoice.payment_failed'
           or e.summary ilike '⚠️ pagamento falhou%')
  ),
  pays as (
    -- last time each tenant actually paid — a payment CLEARS every earlier failure
    select lower(trim(e.client_email)) as em, max(e.created_at) as last_pay
    from client_events e
    where e.type = 'payment'
    group by 1
  ),
  unresolved as (
    select f.em, f.at, f.summ
    from fails f
    left join pays p on p.em = f.em
    where f.at > coalesce(p.last_pay, '-infinity'::timestamptz)
  ),
  agg as (
    select u.em,
           min(u.at)                                as first_failed_at,
           count(*)                                 as attempts,
           (array_agg(u.summ order by u.at desc))[1] as last_summ
    from unresolved u
    group by u.em
  )
  select a.em,
         -- best-effort business name from the latest live/draft intake; falls back to the email
         coalesce(
           nullif((select d.business from onboard_drafts d
                    where lower(trim(d.client_email)) = a.em and d.status <> 'deleted'
                    order by d.created_at desc limit 1), ''),
           a.em
         ) as business_name,
         a.first_failed_at,
         floor(extract(epoch from (now() - a.first_failed_at)) / 86400)::int as days_overdue,
         -- surface the "$49.00"-style amount out of the last failure summary (for the email)
         coalesce(substring(a.last_summ from '\$[0-9]+(?:\.[0-9]{2})?'), '') as last_amount,
         a.attempts::int
  from agg a
  where a.first_failed_at < now() - make_interval(days => g)
  order by a.first_failed_at asc;
  exception when others then
    -- degrade to "no candidates": empty set is the SAFE direction (never wrongly pause),
    -- and a missing client_events/onboard_drafts table can never 500 the cron. The auth
    -- check above stays OUTSIDE this block so an unauthorized call still raises 28000.
    return;
  end;
end
$$;

grant execute on function public.dunning_candidates(text, int) to anon;

-- ── 2) CLAIM — atomic 7-day dedupe per (client_email, kind) ───────────────────
-- Sibling of health_claim (db/health_claims.sql), separate table so a dunning nudge
-- never collides with a health ops_alert. kinds used by /api/dunning-sweep:
--   'dunning_email' (stage 1 last-call reminder) · 'dunning_pause' (stage 2).
-- dunning-sweep calls this BEFORE emailing/pausing; true = "you own it, act now",
-- false = "already done this week, skip". Degrades to false → never act on an
-- uncertain claim (no spam, no double-pause), never 500s the sweep.
create table if not exists public.ops_dunning_claims (
  client_email text not null,
  kind         text not null,
  claimed_at   timestamptz not null default now(),
  primary key (client_email, kind)
);

-- Lock the table down — anon/PostgREST get zero rows; only the RPC below touches it.
alter table public.ops_dunning_claims enable row level security;

create or replace function public.dunning_claim(p_secret text, p_email text, p_kind text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_email text;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  begin
    insert into ops_dunning_claims (client_email, kind, claimed_at)
    values (lower(trim(p_email)), lower(trim(coalesce(p_kind, 'generic'))), now())
    on conflict (client_email, kind) do update
      set claimed_at = now()
      where ops_dunning_claims.claimed_at < now() - interval '7 days'
    returning client_email into v_email;
    return v_email is not null;
  exception when others then
    return false; -- degrade: never act on an uncertain claim, never 500 the sweep
  end;
end
$$;

grant execute on function public.dunning_claim(text, text, text) to anon;

-- ✅ Done. /api/dunning-sweep can now (a) list delinquent tenants past grace and
--    (b) dedupe its stage-1 email / stage-2 pause to at most once per client+kind
--    per 7 days. It STILL runs dry-run until DUNNING_ENFORCE='1' is set.
