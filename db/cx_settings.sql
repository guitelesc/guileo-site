-- ============================================================================
-- Guileo · XM ACTIVE-SURVEY SETTINGS + CANDIDATES  (paste in Supabase → Run)
-- Project ynihodbknhjirkdogxby (smart@guileoai.com). Sits on top of db/experience.sql.
-- ----------------------------------------------------------------------------
-- Backs the ACTIVE side of the XM engine: Gui automatically asks a client's OWN
-- customers "how was it?" (NPS/CSAT/CES) after a recent visit — but ONLY when the
-- tenant leaves it ON. Luis's rule: ACTIVE BY DEFAULT, the client can turn it OFF
-- whenever they want (absent row = enabled). functions/api/cx-survey.js (the daily
-- cron sweep) reads cx_settings, lists cx_survey_candidates, claims each (30-day
-- window via cx_survey_claim in db/experience.sql), and emails the 1-tap survey.
--
-- CONTRACT: every RPC INGEST-gated on 'glo_ing_7f3da9c2b4e8', SECURITY DEFINER,
-- search_path=public, tenant-scoped by client_email, idempotent. RLS ON, no anon
-- policy. Safe to paste twice.
-- ============================================================================

-- ── TABLE: cx_settings — one row per tenant that has TOUCHED the toggle. ──────
-- No row = enabled (default ON). A tenant only gets a row once they flip it.
create table if not exists public.cx_settings (
  client_email    text primary key,
  survey_enabled  boolean not null default true,
  updated_at      timestamptz not null default now()
);
alter table public.cx_settings enable row level security;

-- ── cx_settings_get — returns the tenant's XM prefs (absent → enabled ON). ────
create or replace function public.cx_settings_get(p_secret text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email)); v_on boolean;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' then raise exception 'tenant required' using errcode = '22023'; end if;
  select survey_enabled into v_on from cx_settings where client_email = v_tenant;
  return jsonb_build_object('survey_enabled', coalesce(v_on, true));  -- absent = ON by default
end $$;

-- ── cx_settings_set — the toggle. Upsert survey_enabled for this tenant. ──────
create or replace function public.cx_settings_set(p_secret text, p_email text, p_enabled boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email));
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' then raise exception 'tenant required' using errcode = '22023'; end if;
  insert into cx_settings (client_email, survey_enabled, updated_at)
  values (v_tenant, coalesce(p_enabled, true), now())
  on conflict (client_email) do update set survey_enabled = excluded.survey_enabled, updated_at = now();
  return jsonb_build_object('survey_enabled', coalesce(p_enabled, true));
end $$;

-- ── cx_survey_candidates — recent customers WITH an email who haven't been
-- surveyed inside the window. The sweep still calls cx_survey_claim per row (the
-- real atomic guard); this query just narrows the set so the sweep is cheap and
-- never re-lists someone already claimed. Tenant-scoped; email-only (TCPA-safe).
--   p_since_hours: only customers last seen within this window (default 72h = fresh visit)
--   p_window_hours: skip anyone claimed within this window (default 720h = 30 days)
create or replace function public.cx_survey_candidates(
  p_secret text, p_email text,
  p_since_hours int default 72, p_window_hours int default 720, p_limit int default 50
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_email));
  v_since  interval := (greatest(1, coalesce(p_since_hours, 72))::text || ' hours')::interval;
  v_win    interval := (greatest(1, coalesce(p_window_hours, 720))::text || ' hours')::interval;
  v_lim    int := greatest(1, least(200, coalesce(p_limit, 50)));
  v_out    jsonb := '[]'::jsonb;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' then raise exception 'tenant required' using errcode = '22023'; end if;
  begin
    select coalesce(jsonb_agg(row_to_json(d)), '[]'::jsonb) into v_out
      from (
        select lower(c.email) as contact_ref, c.full_name as name
          from crm_contacts c
          left join cx_survey_claims s
                 on s.client_email = v_tenant and s.contact_ref = lower(c.email)
                and s.claimed_at > now() - v_win
         where c.client_email = v_tenant
           and nullif(trim(coalesce(c.email, '')), '') is not null
           and c.last_seen_at >= now() - v_since
           and s.contact_ref is null                       -- not claimed inside the window
         order by c.last_seen_at desc
         limit v_lim
      ) d;
  exception when others then v_out := '[]'::jsonb;          -- crm_contacts absent → nothing to survey
  end;
  return v_out;
end $$;

grant execute on function public.cx_settings_get(text,text)                       to anon;
grant execute on function public.cx_settings_set(text,text,boolean)               to anon;
grant execute on function public.cx_survey_candidates(text,text,int,int,int)      to anon;

-- PROOF:
-- select public.cx_settings_get('glo_ing_7f3da9c2b4e8','natura@guileoai.com');            -- {survey_enabled:true}
-- select public.cx_settings_set('glo_ing_7f3da9c2b4e8','natura@guileoai.com',false);      -- {survey_enabled:false}
-- select public.cx_survey_candidates('glo_ing_7f3da9c2b4e8','natura@guileoai.com',72,720,50);  -- recent emailed customers
