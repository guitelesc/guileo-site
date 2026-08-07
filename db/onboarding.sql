-- ============================================================================
-- ONBOARDING MACHINE — the 7-step "yes → kickoff" chain + FUNNEL INSTRUMENTATION.
-- One row per client tracks where they are in the go-live funnel; each step is a
-- timestamp so status() doubles as a conversion dashboard (how many reached each step).
--
-- THE 7 STEPS (step int + steps jsonb key → timestamp):
--   1 contract  · yes → contract sent (recorded by onboard_start)
--   2 welcome   · contract signed → welcome packet email
--   3 invoice   · welcome → first invoice (Stripe checkout already exists)
--   4 access    · invoice paid → portal access ON (auto-provision fires this)
--   5 kickoff   · access → kickoff booking + AI kickoff brief
--   6 report    · monthly (1st) → ROI report writes+sends itself
--   7 checkin   · day 30/60/90 → one-question check-in (sentiment captured here)
--
-- "Automate the sending, never the deciding": these RPCs only STAMP progress and let
-- the app fire pre-approved emails. No price/fire/refund decision lives here.
--
-- SECURITY: gate = INGEST literal (SECURITY DEFINER, fixed search_path), every RPC
-- EXCEPTION-wrapped (never throws to the caller) and IDEMPOTENT (a step never re-stamps,
-- so a re-run never double-fires the downstream email). RLS ON, NO anon policy → PostgREST
-- sees zero rows; only these RPCs (definer) touch the table.
-- ============================================================================

create table if not exists public.onboarding_state (
  client_email text primary key,
  step         int  not null default 0,           -- highest step reached (0..7)
  steps        jsonb not null default '{}'::jsonb, -- {contract,welcome,invoice,access,kickoff,report,checkin: ts}
  meta         jsonb not null default '{}'::jsonb, -- brand + intake facts captured at start (for the AI brief)
  sentiment    text,                               -- latest check-in read: warm | lukewarm | cold
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Lock it down — anon/PostgREST get zero rows; only the definer RPCs below read/write.
alter table public.onboarding_state enable row level security;

-- step name → ordinal (kept in ONE place so status/advance agree).
create or replace function public._onb_ord(p_step text)
returns int language sql immutable as $$
  select case lower(coalesce(p_step,''))
    when 'contract' then 1 when 'welcome' then 2 when 'invoice' then 3
    when 'access' then 4 when 'kickoff' then 5 when 'report' then 6
    when 'checkin' then 7 else 0 end;
$$;

-- ── onboard_start: kick the chain. Upsert the row, stamp step 1 (contract), stash brand+intake
-- meta for the AI brief. Idempotent: an existing contract timestamp is NEVER overwritten and the
-- meta is merged (new keys win) so a re-run can't reset the funnel or lose captured facts.
create or replace function public.onboard_start(p_secret text, p_email text, p_meta jsonb default '{}'::jsonb)
returns json language plpgsql security definer set search_path=public as $$
declare v_email text := lower(trim(coalesce(p_email,''))); v_row public.onboarding_state;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode='28000'; end if;
  if v_email = '' or position('@' in v_email) = 0 then return json_build_object('ok', false, 'error', 'bad email'); end if;

  insert into public.onboarding_state (client_email, step, steps, meta)
    values (v_email, 1, jsonb_build_object('contract', to_jsonb(now())), coalesce(p_meta,'{}'::jsonb))
  on conflict (client_email) do update set
    steps = case when public.onboarding_state.steps ? 'contract'
                 then public.onboarding_state.steps
                 else public.onboarding_state.steps || jsonb_build_object('contract', to_jsonb(now())) end,
    meta = public.onboarding_state.meta || coalesce(p_meta,'{}'::jsonb),
    step = greatest(public.onboarding_state.step, 1),
    updated_at = now();

  select * into v_row from public.onboarding_state where client_email = v_email;
  return json_build_object('ok', true, 'step', v_row.step, 'steps', v_row.steps);
exception when others then return json_build_object('ok', false, 'error', SQLERRM); end $$;

-- ── onboard_advance: move the funnel to p_step. Stamps that step's timestamp ONLY if not already
-- set (idempotent — the app uses the returned `fired` flag to decide whether to send the email, so
-- a double-call never double-sends). Bumps the step int to the max reached.
create or replace function public.onboard_advance(p_secret text, p_email text, p_step text)
returns json language plpgsql security definer set search_path=public as $$
declare v_email text := lower(trim(coalesce(p_email,''))); v_ord int := public._onb_ord(p_step);
        v_already boolean; v_row public.onboarding_state;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode='28000'; end if;
  if v_email = '' or position('@' in v_email) = 0 then return json_build_object('ok', false, 'error', 'bad email'); end if;
  if v_ord = 0 then return json_build_object('ok', false, 'error', 'unknown step'); end if;

  -- ensure a row exists (advance can arrive before start, e.g. stripe pay before contract record)
  insert into public.onboarding_state (client_email) values (v_email) on conflict (client_email) do nothing;

  select (steps ? lower(p_step)) into v_already from public.onboarding_state where client_email = v_email;

  update public.onboarding_state set
    steps = case when steps ? lower(p_step) then steps else steps || jsonb_build_object(lower(p_step), to_jsonb(now())) end,
    step = greatest(step, v_ord),
    updated_at = now()
  where client_email = v_email;

  select * into v_row from public.onboarding_state where client_email = v_email;
  -- fired = true only on the FIRST time this step is stamped → caller sends the email exactly once.
  return json_build_object('ok', true, 'fired', not coalesce(v_already,false), 'step', v_row.step, 'steps', v_row.steps);
exception when others then return json_build_object('ok', false, 'error', SQLERRM); end $$;

-- ── onboard_status: the 7-step progress for a client — powers the portal progress bar AND the
-- funnel/conversion dashboard. Returns per-step timestamps, booleans, count done, and pct.
create or replace function public.onboard_status(p_secret text, p_email text)
returns json language plpgsql security definer set search_path=public as $$
declare v_email text := lower(trim(coalesce(p_email,''))); v_row public.onboarding_state; v_done int;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode='28000'; end if;
  select * into v_row from public.onboarding_state where client_email = v_email;
  if not found then
    return json_build_object('ok', true, 'found', false, 'step', 0, 'done', 0, 'pct', 0,
      'steps', json_build_object('contract',false,'welcome',false,'invoice',false,'access',false,'kickoff',false,'report',false,'checkin',false));
  end if;
  v_done := (select count(*) from (values ('contract'),('welcome'),('invoice'),('access'),('kickoff'),('report'),('checkin')) s(k)
             where v_row.steps ? s.k);
  return json_build_object(
    'ok', true, 'found', true, 'client_email', v_row.client_email,
    'step', v_row.step, 'done', v_done, 'pct', round(v_done * 100.0 / 7)::int,
    'sentiment', v_row.sentiment, 'created_at', v_row.created_at, 'updated_at', v_row.updated_at,
    'meta', v_row.meta,
    'timestamps', v_row.steps,
    'steps', json_build_object(
      'contract', v_row.steps ? 'contract', 'welcome', v_row.steps ? 'welcome',
      'invoice',  v_row.steps ? 'invoice',  'access',  v_row.steps ? 'access',
      'kickoff',  v_row.steps ? 'kickoff',  'report',  v_row.steps ? 'report',
      'checkin',  v_row.steps ? 'checkin'));
exception when others then return json_build_object('ok', false, 'error', SQLERRM); end $$;

-- ── onboard_sentiment: record the one-question check-in read + stamp the checkin step. Idempotent
-- on the step stamp; sentiment always updates to the latest read so a "cold" answer overrides earlier.
create or replace function public.onboard_sentiment(p_secret text, p_email text, p_val text)
returns json language plpgsql security definer set search_path=public as $$
declare v_email text := lower(trim(coalesce(p_email,''))); v_val text := lower(trim(coalesce(p_val,'')));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode='28000'; end if;
  if v_val not in ('warm','lukewarm','cold') then return json_build_object('ok', false, 'error', 'bad value'); end if;
  insert into public.onboarding_state (client_email, sentiment, step, steps)
    values (v_email, v_val, 7, jsonb_build_object('checkin', to_jsonb(now())))
  on conflict (client_email) do update set
    sentiment = v_val,
    steps = case when public.onboarding_state.steps ? 'checkin' then public.onboarding_state.steps
                 else public.onboarding_state.steps || jsonb_build_object('checkin', to_jsonb(now())) end,
    step = greatest(public.onboarding_state.step, 7),
    updated_at = now()
  where public.onboarding_state.client_email = v_email;
  return json_build_object('ok', true, 'sentiment', v_val, 'lukewarm', v_val <> 'warm');
exception when others then return json_build_object('ok', false, 'error', SQLERRM); end $$;

-- ── CRON DRIVERS (steps 6 monthly + 7 day-30/60/90). Both ATOMIC-CLAIM so a daily/hourly cron
-- re-run never double-sends: the milestone/month is recorded in meta the moment it's returned.

-- onboard_checkin_due: clients who just crossed a 30/60/90-day milestone (since access, fallback
-- created_at) and haven't been checked-in for that milestone yet. Claims it (appends to
-- meta.checkins_sent) so the next sweep skips them. Returns [{client_email, day, lang, name}].
create or replace function public.onboard_checkin_due(p_secret text, p_limit int default 100)
returns json language plpgsql security definer set search_path=public as $$
declare v_out json;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode='28000'; end if;
  -- SINGLE atomic statement: pick the (limited) due set and claim EXACTLY that set in one UPDATE,
  -- so a milestone is never stamped-sent without being returned to the caller (no silent skip).
  with pick as (
    select client_email,
      (select max(m) from (values (30),(60),(90)) v(m)
        where floor(extract(epoch from (now()-coalesce((steps->>'access')::timestamptz,created_at)))/86400.0)::int >= v.m
          and not (coalesce(meta->'checkins_sent','[]'::jsonb) @> to_jsonb(v.m))) as day,
      coalesce(meta->>'lang','') as lang,
      coalesce(meta->>'name', meta#>>'{brand,contactName}','') as name
    from public.onboarding_state
    where steps ? 'access'
  ), due as (
    select client_email, day, lang, name from pick where day is not null
    limit greatest(1, least(p_limit,200))
  ), upd as (
    update public.onboarding_state o set
      meta = jsonb_set(o.meta,'{checkins_sent}', coalesce(o.meta->'checkins_sent','[]'::jsonb) || to_jsonb(d.day)),
      step = greatest(o.step, 7), updated_at = now()
    from due d where o.client_email = d.client_email
    returning d.client_email, d.day, d.lang, d.name
  )
  select coalesce(json_agg(json_build_object('client_email',client_email,'day',day,'lang',lang,'name',name)),'[]'::json)
    into v_out from upd;
  return v_out;
exception when others then return json_build_object('error', SQLERRM); end $$;

-- onboard_report_due: onboarded clients who haven't had this calendar month's ROI report yet.
-- Claims the month (meta.last_report_month = 'YYYY-MM') so a same-month re-run skips them.
create or replace function public.onboard_report_due(p_secret text, p_limit int default 100)
returns json language plpgsql security definer set search_path=public as $$
declare v_month text := to_char(now(),'YYYY-MM'); v_out json;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode='28000'; end if;
  select json_agg(json_build_object('client_email',client_email,
           'lang',coalesce(meta->>'lang',''),
           'name',coalesce(meta->>'name', meta#>>'{brand,contactName}','')))
    into v_out
    from public.onboarding_state
   where steps ? 'access' and coalesce(meta->>'last_report_month','') <> v_month
   limit greatest(1, least(p_limit,200));
  update public.onboarding_state set
    meta = jsonb_set(meta,'{last_report_month}', to_jsonb(v_month)),
    steps = case when steps ? 'report' then steps else steps || jsonb_build_object('report', to_jsonb(now())) end,
    step = greatest(step, 6), updated_at = now()
   where steps ? 'access' and coalesce(meta->>'last_report_month','') <> v_month;
  return coalesce(v_out, '[]'::json);
exception when others then return json_build_object('error', SQLERRM); end $$;

grant execute on function public.onboard_start(text, text, jsonb) to anon;
grant execute on function public.onboard_advance(text, text, text) to anon;
grant execute on function public.onboard_status(text, text)        to anon;
grant execute on function public.onboard_sentiment(text, text, text) to anon;
grant execute on function public.onboard_checkin_due(text, int)    to anon;
grant execute on function public.onboard_report_due(text, int)     to anon;
grant execute on function public._onb_ord(text)                    to anon;

-- SET META — stash name/lang/business so the cron nurture (check-in/report, which fire off the
-- 'access' stamp) can greet the client by name in their language. Called at access time by
-- stripe-webhook (onboard_start, which normally stashes this, isn't in the paid flow). Merge-only,
-- blank incoming values are ignored (never blanks an existing value). Idempotent, secret-gated.
create or replace function public.onboard_set_meta(p_secret text, p_email text, p_meta jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_email text := lower(trim(coalesce(p_email,'')));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then return false; end if;
  if v_email='' or position('@' in v_email)=0 then return false; end if;
  insert into public.onboarding_state (client_email) values (v_email) on conflict (client_email) do nothing;
  update public.onboarding_state
     set meta = coalesce(meta,'{}'::jsonb) || (select coalesce(jsonb_object_agg(k, v),'{}'::jsonb)
                                               from jsonb_each(coalesce(p_meta,'{}'::jsonb)) as e(k,v)
                                               where nullif(trim(both '"' from v::text),'') is not null),
         updated_at = now()
   where client_email = v_email;
  return true;
exception when others then return false;
end $$;
grant execute on function public.onboard_set_meta(text,text,jsonb) to anon;
