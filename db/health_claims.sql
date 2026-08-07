-- ─────────────────────────────────────────────────────────────────────────────
-- HEALTH CONFIG-ALERT CLAIM — idempotency guard for /api/health-monitor's
-- broken-config alerts (agent-without-number, number-without-agent,
-- approved-draft-without-agent). Sibling of db/silent_claim.sql, but keyed per
-- (client_email, kind) so different problem kinds alert independently while each
-- kind stays deduped to once per 7 days — cron retries never spam /admin.
-- INGEST-gated SECURITY DEFINER; RLS on with NO anon policies.
-- Paste in the Supabase SQL Editor (project ynihodbknhjirkdogxby, smart@guileoai.com).
-- Until pasted, health-monitor still REPORTS broken configs in its JSON
-- (configClaimReady:false) but ingests no ops_alert — turns on after the paste.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.ops_health_claims (
  client_email text not null,
  kind         text not null,
  alerted_at   timestamptz not null default now(),
  primary key (client_email, kind)
);

-- Lock the table down — anon/PostgREST get zero rows; only the RPC below touches it.
alter table public.ops_health_claims enable row level security;

-- ATOMIC claim: returns true (and stamps alerted_at) ONLY when this (client, kind) hasn't
-- alerted in the last 7 days. health-monitor calls this BEFORE ingesting the ops_alert —
-- false means "another run already alerted this week, skip". Degrades to false on any error.
create or replace function public.health_claim(p_secret text, p_email text, p_kind text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_email text;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  begin
    insert into ops_health_claims (client_email, kind, alerted_at)
    values (lower(trim(p_email)), lower(trim(coalesce(p_kind, 'generic'))), now())
    on conflict (client_email, kind) do update
      set alerted_at = now()
      where ops_health_claims.alerted_at < now() - interval '7 days'
    returning client_email into v_email;
    return v_email is not null;
  exception when others then
    return false; -- degrade: never alert on an uncertain claim (no spam), never 500 the sweep
  end;
end
$$;

grant execute on function public.health_claim(text, text, text) to anon;

-- ✅ Done. /api/health-monitor starts ingesting broken-config ops_alert events
--    (📵 no_number · 🤖 no_agent · ⚠️ approved_no_agent) at most once per client+kind per 7 days.
