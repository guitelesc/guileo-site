-- ─────────────────────────────────────────────────────────────────────────────
-- SILENT-CLIENT ALERT CLAIM — idempotency guard for the 🔇 silent-client sweep.
-- /api/health-monitor flags clients that are PROVISIONED (agent + number) but had ZERO
-- call/booking/message events for ≥ SILENT_DAYS (default 5). Before ingesting the
-- 'ops_alert' event it calls silent_claim: an ATOMIC 7-day claim, so the same client is
-- never re-alerted within 7 days even if two cron runs race. INGEST-gated.
-- Paste in the Supabase SQL Editor (project ynihodbknhjirkdogxby, account smart@guileoai.com).
-- Until pasted, the sweep still REPORTS silent clients in its JSON but ingests nothing
-- (no idempotency guard → no alert spam). Turns on automatically after the paste.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.ops_silent_alerts (
  client_email text primary key,
  alerted_at   timestamptz not null default now()
);

-- Lock the table down — anon/PostgREST get zero rows; only the RPC below touches it.
alter table public.ops_silent_alerts enable row level security;

-- ATOMIC claim: returns true (and stamps alerted_at) ONLY when this client hasn't been
-- silent-alerted in the last 7 days. The sweep calls this BEFORE ingesting the ops_alert —
-- false means "another run already alerted them this week, skip".
create or replace function public.silent_claim(p_secret text, p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_email text;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  insert into ops_silent_alerts (client_email, alerted_at)
  values (lower(trim(p_email)), now())
  on conflict (client_email) do update
    set alerted_at = now()
    where ops_silent_alerts.alerted_at < now() - interval '7 days'
  returning client_email into v_email;
  return v_email is not null;
end
$$;

grant execute on function public.silent_claim(text, text) to anon;

-- ✅ Done. /api/health-monitor's silent sweep starts alerting (🔇 ops_alert events → /admin card)
--    on its next weekly cron run, at most once per client per 7 days.
