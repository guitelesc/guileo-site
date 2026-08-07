-- ─────────────────────────────────────────────────────────────────────────────
-- QUARTERLY NPS ENGINE — the DB half of /api/nps (functions/api/nps.js).
-- Two RPCs, both INGEST-gated, same style as db/silent_claim.sql:
--   nps_claim(p_secret, p_email)          → atomic 90-day claim BEFORE sending the survey
--                                           email, so a client is never surveyed twice a
--                                           quarter even if two cron runs race.
--   nps_vote(p_secret, p_email, p_score)  → stores the 0–10 vote, upserting the LATEST
--                                           score per client per calendar quarter (tapping
--                                           a second button just updates the answer).
-- Paste in the Supabase SQL Editor (project ynihodbknhjirkdogxby, account smart@guileoai.com).
-- Until pasted, /api/nps reports ready:false and sends NOTHING (no dedup guard → no spam).
-- Turns on automatically after the paste.
-- ─────────────────────────────────────────────────────────────────────────────

-- Survey-send claims: one row per client, stamped each time we send them the NPS email.
create table if not exists public.nps_surveys (
  client_email text primary key,
  surveyed_at  timestamptz not null default now()
);

-- Votes: latest score per client per quarter ('2026Q3' style key).
create table if not exists public.nps_votes (
  client_email text not null,
  quarter      text not null,
  score        int  not null check (score between 0 and 10),
  voted_at     timestamptz not null default now(),
  primary key (client_email, quarter)
);

-- Lock both tables down — anon/PostgREST get zero rows; only the RPCs below touch them.
alter table public.nps_surveys enable row level security;
alter table public.nps_votes  enable row level security;

-- ATOMIC claim: returns true (and stamps surveyed_at) ONLY when this client hasn't been
-- surveyed in the last 90 days. /api/nps calls this BEFORE sending the email — false means
-- "already surveyed this quarter, skip"; the endpoint treats a missing RPC (null) as not-ready.
create or replace function public.nps_claim(p_secret text, p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_email text;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  insert into nps_surveys (client_email, surveyed_at)
  values (lower(trim(p_email)), now())
  on conflict (client_email) do update
    set surveyed_at = now()
    where nps_surveys.surveyed_at < now() - interval '90 days'
  returning client_email into v_email;
  return v_email is not null;
end
$$;

-- Vote upsert: keeps the LATEST 0–10 score per client per calendar quarter. Idempotent and
-- re-tappable — a second tap on a different number simply revises this quarter's answer.
create or replace function public.nps_vote(p_secret text, p_email text, p_score int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if p_score is null or p_score < 0 or p_score > 10 then raise exception 'bad score' using errcode = '22023'; end if;
  insert into nps_votes (client_email, quarter, score, voted_at)
  values (lower(trim(p_email)), to_char(now(), 'YYYY"Q"Q'), p_score, now())
  on conflict (client_email, quarter) do update
    set score = excluded.score, voted_at = now();
  return true;
end
$$;

grant execute on function public.nps_claim(text, text)     to anon;
grant execute on function public.nps_vote(text, text, int) to anon;

-- ✅ Done. /api/nps starts surveying on its next cron run (max 30 emails/run, one survey per
--    client per 90 days) and every 0–10 tap lands as an '⭐ NPS n' client_event + nps_votes row.
