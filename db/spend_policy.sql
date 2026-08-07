-- ============================================================================
-- Guileo · SPEND POLICY — defense-in-depth on money (per-tenant spend limits +
-- daily cap + human-in-the-loop threshold + anomaly signal).
-- Paste in Supabase (project ynihodbknhjirkdogxby) → SQL Editor → Run.
-- Idempotent (create or replace / if not exists) — safe to paste twice.
--
-- WHY: agent-action.js can mint a real pay link / bridge a card charge on a call.
-- MAX_CHARGE_USD is a single global ceiling. This adds a PER-TENANT policy that is
-- checked BEFORE any charge: a single-charge cap, a rolling-DAY cap, a threshold
-- over which a human must approve, and an anomaly signal (>6× the tenant's median
-- charge in the last 30d) that also forces a human. All amounts in CENTS.
--
-- TENANT LAW: every read/mutation is scoped by client_email. A row for tenant A
-- never affects tenant B. INGEST-gated (same literal as ingest_client_event /
-- add_client_credits); the RPC is the only door (RLS on, no anon policy).
-- ============================================================================

-- ── policy table (per-tenant, sane defaults, owner-overridable) ─────────────
create table if not exists public.spend_policy (
  client_email             text primary key,
  max_single_cents         int  not null default 500000,   -- $5,000 per single charge
  max_day_cents            int  not null default 2000000,  -- $20,000 charged per rolling day
  require_human_over_cents int  not null default 100000,   -- >$1,000 → a human must approve
  updated_at               timestamptz not null default now()
);

alter table public.spend_policy enable row level security;
-- No anon policy on purpose: the SECURITY DEFINER RPCs below are the ONLY door.

-- fast per-tenant "today's charges" scan over the money event types
create index if not exists client_events_tenant_money_idx
  on public.client_events (client_email, type, created_at desc)
  where type in ('payment', 'sale', 'order', 'invoice', 'deposit');

-- ── GET: return the tenant's policy, or the sane defaults if none set ────────
create or replace function public.spend_policy_get(p_secret text, p_email text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_row public.spend_policy%rowtype;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if p_email is null or length(trim(p_email)) = 0 then raise exception 'email required' using errcode = '22023'; end if;
  select * into v_row from public.spend_policy where lower(client_email) = lower(p_email);
  if not found then
    return jsonb_build_object(
      'client_email', lower(p_email),
      'max_single_cents', 500000,
      'max_day_cents', 2000000,
      'require_human_over_cents', 100000,
      'is_default', true
    );
  end if;
  return jsonb_build_object(
    'client_email', v_row.client_email,
    'max_single_cents', v_row.max_single_cents,
    'max_day_cents', v_row.max_day_cents,
    'require_human_over_cents', v_row.require_human_over_cents,
    'updated_at', v_row.updated_at,
    'is_default', false
  );
end $$;

-- ── SET: upsert the tenant's policy (nulls keep the current/default value) ───
create or replace function public.spend_policy_set(
  p_secret text, p_email text,
  p_max_single_cents int default null,
  p_max_day_cents int default null,
  p_require_human_over_cents int default null
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare v_row public.spend_policy%rowtype;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if p_email is null or length(trim(p_email)) = 0 then raise exception 'email required' using errcode = '22023'; end if;
  -- guard: no negative limits ever (money law: never negative)
  if coalesce(p_max_single_cents, 0) < 0 or coalesce(p_max_day_cents, 0) < 0 or coalesce(p_require_human_over_cents, 0) < 0 then
    raise exception 'limits must be >= 0' using errcode = '22023';
  end if;
  insert into public.spend_policy as sp (client_email, max_single_cents, max_day_cents, require_human_over_cents, updated_at)
  values (
    lower(p_email),
    coalesce(p_max_single_cents, 500000),
    coalesce(p_max_day_cents, 2000000),
    coalesce(p_require_human_over_cents, 100000),
    now()
  )
  on conflict (client_email) do update set
    max_single_cents         = coalesce(p_max_single_cents, sp.max_single_cents),
    max_day_cents            = coalesce(p_max_day_cents, sp.max_day_cents),
    require_human_over_cents = coalesce(p_require_human_over_cents, sp.require_human_over_cents),
    updated_at               = now()
  returning * into v_row;
  return jsonb_build_object(
    'client_email', v_row.client_email,
    'max_single_cents', v_row.max_single_cents,
    'max_day_cents', v_row.max_day_cents,
    'require_human_over_cents', v_row.require_human_over_cents,
    'updated_at', v_row.updated_at
  );
end $$;

-- ── CHECK: the gate the charge path calls BEFORE minting a link/bridging a card
-- Returns {allow, needs_human, reason, ...diagnostics}. All amounts in CENTS.
--   reject  (allow=false) if amount > max_single_cents
--   reject  (allow=false) if today's charges + amount > max_day_cents
--   flag    (needs_human) if amount > require_human_over_cents
--   flag    (needs_human) ANOMALY: amount > 6× the tenant's 30d median charge
-- Tenant-scoped: "today" and "median" are computed only over THIS tenant's rows.
create or replace function public.spend_check(p_secret text, p_email text, p_amount_cents bigint)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_email        text := lower(coalesce(p_email, ''));
  v_amt          bigint := coalesce(p_amount_cents, 0);
  v_single       int := 500000;
  v_day          int := 2000000;
  v_human        int := 100000;
  v_today_cents  bigint := 0;
  v_median_cents bigint := null;
  v_hist_n       int := 0;
  v_allow        boolean := true;
  v_needs_human  boolean := false;
  v_reason       text := 'ok';
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if length(v_email) = 0 then raise exception 'email required' using errcode = '22023'; end if;

  -- nothing chargeable → allow, no human needed (never block on a $0/invalid amount)
  if v_amt <= 0 then
    return jsonb_build_object('allow', true, 'needs_human', false, 'reason', 'no_amount',
      'amount_cents', v_amt, 'today_cents', 0, 'max_single_cents', v_single,
      'max_day_cents', v_day, 'require_human_over_cents', v_human, 'median_cents', null);
  end if;

  -- policy row or sane defaults
  select max_single_cents, max_day_cents, require_human_over_cents
    into v_single, v_day, v_human
    from public.spend_policy where lower(client_email) = v_email;
  if not found then v_single := 500000; v_day := 2000000; v_human := 100000; end if;

  -- today's already-charged total for THIS tenant (best-effort; table may be absent)
  begin
    select coalesce(round(sum(amount) * 100)::bigint, 0)
      into v_today_cents
      from public.client_events
     where lower(client_email) = v_email
       and type in ('payment', 'sale', 'order', 'invoice', 'deposit')
       and amount > 0
       and created_at >= date_trunc('day', now());
  exception when others then v_today_cents := 0;
  end;

  -- 30d median charge for THIS tenant (anomaly baseline; null until enough history)
  begin
    select percentile_cont(0.5) within group (order by amount * 100)::bigint, count(*)
      into v_median_cents, v_hist_n
      from public.client_events
     where lower(client_email) = v_email
       and type in ('payment', 'sale', 'order', 'invoice', 'deposit')
       and amount > 0
       and created_at >= now() - interval '30 days';
  exception when others then v_median_cents := null; v_hist_n := 0;
  end;

  -- ── HARD REJECTS (allow=false) ──
  if v_amt > v_single then
    v_allow := false; v_reason := 'over_single_limit';
  elsif v_today_cents + v_amt > v_day then
    v_allow := false; v_reason := 'over_day_limit';
  end if;

  -- ── HUMAN-IN-THE-LOOP flags (needs_human=true; do NOT auto-charge) ──
  if v_amt > v_human then
    v_needs_human := true;
    if v_reason = 'ok' then v_reason := 'over_human_threshold'; end if;
  end if;
  -- anomaly: >6× the tenant's own median, once there's a real baseline (>=4 charges)
  if v_median_cents is not null and v_median_cents > 0 and v_hist_n >= 4 and v_amt > 6 * v_median_cents then
    v_needs_human := true;
    if v_reason = 'ok' or v_reason = 'over_human_threshold' then v_reason := 'anomaly_6x_median'; end if;
  end if;

  return jsonb_build_object(
    'allow', v_allow,
    'needs_human', v_needs_human,
    'reason', v_reason,
    'amount_cents', v_amt,
    'today_cents', v_today_cents,
    'max_single_cents', v_single,
    'max_day_cents', v_day,
    'require_human_over_cents', v_human,
    'median_cents', v_median_cents,
    'history_count', v_hist_n
  );
end $$;

grant execute on function public.spend_policy_get(text, text)              to anon;
grant execute on function public.spend_policy_set(text, text, int, int, int) to anon;
grant execute on function public.spend_check(text, text, bigint)           to anon;

-- ✅ Prove it (round-trip):
--   select public.spend_policy_get('glo_ing_c7f2a9e4b8d16350', 'natura@guileoai.com');           -- defaults
--   select public.spend_policy_set('glo_ing_c7f2a9e4b8d16350', 'natura@guileoai.com', 300000, null, 50000);
--   select public.spend_check('glo_ing_c7f2a9e4b8d16350', 'natura@guileoai.com', 40000);  -- {allow:true,needs_human:false}
--   select public.spend_check('glo_ing_c7f2a9e4b8d16350', 'natura@guileoai.com', 60000);  -- needs_human (>$500)
--   select public.spend_check('glo_ing_c7f2a9e4b8d16350', 'natura@guileoai.com', 400000); -- allow:false over_single_limit
