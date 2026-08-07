-- ============================================================================
-- Guileo · EXPERIENCE (XM) DATA FOUNDATION  (paste in Supabase → SQL Editor → Run)
-- Project: ynihodbknhjirkdogxby (smart@guileoai.com)
-- ----------------------------------------------------------------------------
-- WHAT LAYER IS THIS? This is the XM (experience-management) layer = the CLIENT's
-- business measuring ITS OWN customers (the customer-of-the-customer). It is NOT
-- Guileo measuring its tenants — that is the separate db/nps.sql / functions/api/
-- nps.js layer (Guileo's own quarterly NPS from paying tenants). This file lives
-- BESIDE that one and REUSES its patterns (INGEST-gated RPCs, atomic claim,
-- upsert-latest vote) but never touches nps_surveys / nps_votes.
--
-- WHAT IT DOES: unifies every experience signal a client's business already
-- generates — call sentiment (passive), Google reviews (passive), and active
-- surveys (NPS/CSAT/CES) — into ONE append-only, tenant-scoped table (cx_signals)
-- and computes CX metrics over it (CX score, NPS, CSAT%, sentiment mix, drivers,
-- open detractors to close-loop).
--
-- CONTRACT (same as db/crm.js / db/revenue.js / db/growth_intel.sql):
--   • Every RPC is INGEST-gated on the literal 'glo_ing_c7f2a9e4b8d16350'
--     (the same secret the ingest/crm/coupons pipeline uses), SECURITY DEFINER,
--     search_path=public, and granted to anon (the RPC is the ONLY door).
--   • Every row and every read is scoped by client_email (the TENANT). A UUID
--     alone never authorizes; no tenant can ever read another tenant's rows.
--   • RLS ON, NO anon policy → PostgREST sees zero rows; only these functions touch
--     the tables. Idempotent — safe to paste twice.
--   • HONEST: metrics return the real sample size n; small samples still return
--     (the UI decides to show "amostra pequena"). Missing joined tables degrade to
--     empty/0 inside EXCEPTION blocks instead of throwing. Nothing is invented.
-- ============================================================================

-- ── TABLE: cx_signals ─────────────────────────────────────────────────────────
-- Append-only unified experience signal. One row per customer touch that carries a
-- score. `score` is ALWAYS normalized 0–100 so metrics can average across sources:
--   • NPS 0–10        → raw * 10           (0→0 … 10→100)
--   • CSAT 1–5        → (raw-1)/4 * 100     (1→0, 3→50, 5→100)
--   • CES 1–7         → (raw-1)/6 * 100     (1→0 … 7→100; higher = easier = better)
--   • review 1–5★     → (raw-1)/4 * 100     (same shape as CSAT)
--   • call sentiment  → positive 90 / neutral 60 / negative 20
-- `raw_score` keeps the untouched original (e.g. '4', '9', 'positive') for display.
create table if not exists public.cx_signals (
  id             uuid primary key default gen_random_uuid(),
  client_email   text not null,                              -- the TENANT (which business owns this signal)
  contact_id     uuid,                                       -- → crm_contacts.id (nullable; not a hard FK so a signal survives contact cleanup)
  source         text not null,                              -- 'call' | 'review' | 'survey'
  score          numeric not null check (score >= 0 and score <= 100), -- normalized 0–100
  raw_score      text,                                       -- original value as received ('9', '4', 'positive', '5')
  sentiment      text,                                       -- 'positive' | 'neutral' | 'negative'
  theme          text,                                       -- short driver tag (nullable): 'wait_time', 'staff', 'price' …
  comment        text,                                       -- the customer's own words (nullable, PII-light)
  ref            text,                                       -- dedupe key: 'call:<convId>' | 'review:<gbpId>' | 'survey:<token>:<metric>'
  occurred_at    timestamptz not null default now(),         -- when the experience happened
  handled_at     timestamptz,                                -- set by cx_close_loop when a detractor is recovered
  handled_action text,                                       -- what the business did to close the loop
  created_at     timestamptz not null default now()
);

-- Idempotent ingest: at most one signal per (tenant, ref) when ref is present.
-- Passive re-deliveries (same call/review webhook fired twice) collapse to one row.
create unique index if not exists cx_signals_ref
  on public.cx_signals (client_email, ref) where ref is not null;
-- Read paths: metrics scan by tenant + time; detractor queue scans unhandled recents.
create index if not exists cx_signals_tenant_time on public.cx_signals (client_email, occurred_at desc);
create index if not exists cx_signals_open on public.cx_signals (client_email, occurred_at desc) where handled_at is null;
create index if not exists cx_signals_contact on public.cx_signals (client_email, contact_id) where contact_id is not null;

-- ── TABLE: cx_survey_claims ───────────────────────────────────────────────────
-- Atomic dedupe so ONE customer isn't surveyed twice in the same visit-window.
-- Keyed by (tenant, contact_ref) — mirrors db/nps.sql's nps_surveys claim idea but
-- per-customer-of-the-client and with a caller-chosen window (default 168h = 7 days).
create table if not exists public.cx_survey_claims (
  client_email text not null,
  contact_ref  text not null,                                -- phone/email/token of the customer being surveyed
  claimed_at   timestamptz not null default now(),
  primary key (client_email, contact_ref)
);

-- Lock everything down — anon/PostgREST get zero rows; only the SECURITY DEFINER RPCs touch these.
alter table public.cx_signals       enable row level security;
alter table public.cx_survey_claims enable row level security;

-- ── helper: normalized score → sentiment bucket (kept consistent everywhere) ──
--   ≥67 positive · 41–66 neutral · ≤40 negative  (aligns with call 90/60/20 mapping)
create or replace function public._cx_sentiment(p_score numeric)
returns text language sql immutable set search_path = public as $$
  select case when p_score >= 67 then 'positive'
              when p_score <= 40 then 'negative'
              else 'neutral' end;
$$;

-- ── RPC: cx_signal_upsert ─────────────────────────────────────────────────────
-- The ONE write door every signal funnels through — passive (call/review) AND the
-- active survey path (cx_vote calls this pattern internally too). Idempotent on ref:
-- returns TRUE when a new row was inserted, FALSE when it was a duplicate (ref seen).
-- If sentiment is null it is derived from the normalized score.
create or replace function public.cx_signal_upsert(
  p_secret      text,
  p_email       text,
  p_contact_id  uuid,
  p_source      text,
  p_score       numeric,
  p_raw_score   text,
  p_sentiment   text,
  p_theme       text,
  p_comment     text,
  p_ref         text,
  p_occurred_at timestamptz
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_tenant    text := lower(trim(p_email));
  v_score     numeric := greatest(0, least(100, coalesce(p_score, 0)));
  v_sentiment text := coalesce(nullif(trim(coalesce(p_sentiment, '')), ''), public._cx_sentiment(greatest(0, least(100, coalesce(p_score, 0)))));
  v_id        uuid;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' or v_tenant is null then raise exception 'tenant required' using errcode = '22023'; end if;
  if p_source not in ('call','review','survey') then raise exception 'bad source' using errcode = '22023'; end if;

  insert into cx_signals (client_email, contact_id, source, score, raw_score, sentiment, theme, comment, ref, occurred_at)
  values (v_tenant, p_contact_id, p_source, v_score, p_raw_score, v_sentiment,
          nullif(trim(coalesce(p_theme, '')), ''), nullif(p_comment, ''), nullif(trim(coalesce(p_ref, '')), ''),
          coalesce(p_occurred_at, now()))
  on conflict (client_email, ref) where ref is not null do nothing
  returning id into v_id;

  return v_id is not null;  -- true = inserted, false = duplicate ref (already ingested)
end
$$;

-- ── RPC: cx_survey_claim ──────────────────────────────────────────────────────
-- Atomic "may I survey this customer now?" — returns TRUE (and stamps the claim) only
-- when (tenant, contact_ref) hasn't been claimed within p_window_hours. FALSE means
-- "already surveyed this visit-window, skip". Two racing senders can't double-survey.
create or replace function public.cx_survey_claim(
  p_secret       text,
  p_email        text,
  p_contact_ref  text,
  p_window_hours int default 168
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_email));
  v_ref    text := nullif(trim(coalesce(p_contact_ref, '')), '');
  v_win    interval := (greatest(1, coalesce(p_window_hours, 168))::text || ' hours')::interval;
  v_hit    text;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' or v_ref is null then return false; end if;

  insert into cx_survey_claims (client_email, contact_ref, claimed_at)
  values (v_tenant, v_ref, now())
  on conflict (client_email, contact_ref) do update
    set claimed_at = now()
    where cx_survey_claims.claimed_at < now() - v_win
  returning client_email into v_hit;

  return v_hit is not null;
end
$$;

-- ── RPC: cx_vote ──────────────────────────────────────────────────────────────
-- The active-survey landing: a customer taps NPS/CSAT/CES. Normalizes raw→0–100,
-- derives sentiment + segment, and inserts a 'survey' cx_signal with a stable ref
-- so a re-tap REVISES the same answer (idempotent / re-tappable). Returns
-- {ok, score, segment}. segment: NPS → promoter/passive/detractor; CSAT/CES →
-- satisfied/neutral/unsatisfied.
create or replace function public.cx_vote(
  p_secret      text,
  p_email       text,
  p_contact_ref text,
  p_metric      text,
  p_raw         int,
  p_comment     text default null,
  p_theme       text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant  text := lower(trim(p_email));
  v_ref     text := nullif(trim(coalesce(p_contact_ref, '')), '');
  v_metric  text := lower(trim(coalesce(p_metric, '')));
  v_score   numeric;
  v_segment text;
  v_sig_ref text;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' or v_ref is null then raise exception 'tenant/contact required' using errcode = '22023'; end if;
  if v_metric not in ('nps','csat','ces') then raise exception 'bad metric' using errcode = '22023'; end if;

  -- normalize raw → 0–100 (and clamp raw to its own valid domain first)
  if v_metric = 'nps' then
    v_score   := least(10, greatest(0, coalesce(p_raw, 0))) * 10;
    v_segment := case when p_raw >= 9 then 'promoter' when p_raw >= 7 then 'passive' else 'detractor' end;
  elsif v_metric = 'csat' then
    v_score   := (least(5, greatest(1, coalesce(p_raw, 1))) - 1) / 4.0 * 100;
    v_segment := case when p_raw >= 4 then 'satisfied' when p_raw = 3 then 'neutral' else 'unsatisfied' end;
  else -- ces (1–5, LOWER effort = better → invert: raw 1 = effortless = 100)
    v_score   := (5 - least(5, greatest(1, coalesce(p_raw, 1)))) / 4.0 * 100;
    v_segment := case when p_raw <= 2 then 'satisfied' when p_raw = 3 then 'neutral' else 'unsatisfied' end;
  end if;

  -- one stable signal per (tenant, contact, metric) — a re-tap updates the answer
  v_sig_ref := 'survey:' || v_ref || ':' || v_metric;

  insert into cx_signals (client_email, source, score, raw_score, sentiment, theme, comment, ref, occurred_at)
  values (v_tenant, 'survey', v_score, coalesce(p_raw, 0)::text, public._cx_sentiment(v_score),
          nullif(trim(coalesce(p_theme, '')), ''), nullif(p_comment, ''), v_sig_ref, now())
  on conflict (client_email, ref) where ref is not null do update
    set score = excluded.score, raw_score = excluded.raw_score, sentiment = excluded.sentiment,
        theme = coalesce(excluded.theme, cx_signals.theme),
        comment = coalesce(excluded.comment, cx_signals.comment),
        occurred_at = now();

  return jsonb_build_object('ok', true, 'score', round(v_score)::int, 'segment', v_segment);
end
$$;

-- ── RPC: cx_summary ───────────────────────────────────────────────────────────
-- The headline CX panel, tenant-scoped, over `since` (default last 90 days). Honest:
-- always returns n (sample size) even when tiny; percentages are null when their base
-- is 0 (nothing to divide). NPS is computed from survey NPS votes only (score→0–10
-- band). cx_score is the avg normalized score across ALL sources.
create or replace function public.cx_summary(
  p_secret text,
  p_email  text,
  p_since  timestamptz default (now() - interval '90 days')
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_email));
  v_since  timestamptz := coalesce(p_since, now() - interval '90 days');
  v_n int := 0;
  v_cx numeric;
  v_pos int := 0; v_neu int := 0; v_neg int := 0;
  v_call int := 0; v_review int := 0; v_survey int := 0;
  v_prom int := 0; v_pass int := 0; v_det int := 0; v_nps_n int := 0; v_nps int;
  v_csat_sat int := 0; v_csat_n int := 0; v_csat numeric;
  v_now30 numeric; v_prev30 numeric;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' then raise exception 'tenant required' using errcode = '22023'; end if;

  select count(*), round(avg(score))::int,
         count(*) filter (where sentiment = 'positive'),
         count(*) filter (where sentiment = 'neutral'),
         count(*) filter (where sentiment = 'negative'),
         count(*) filter (where source = 'call'),
         count(*) filter (where source = 'review'),
         count(*) filter (where source = 'survey')
    into v_n, v_cx, v_pos, v_neu, v_neg, v_call, v_review, v_survey
    from cx_signals
   where client_email = v_tenant and occurred_at >= v_since;

  -- NPS from survey NPS votes only (ref '...:nps'); score band 0–100 → 0–10 semantics.
  select count(*),
         count(*) filter (where score >= 90),                    -- 9–10 promoters
         count(*) filter (where score >= 70 and score < 90),     -- 7–8 passives
         count(*) filter (where score < 70)                      -- 0–6 detractors
    into v_nps_n, v_prom, v_pass, v_det
    from cx_signals
   where client_email = v_tenant and source = 'survey' and occurred_at >= v_since and ref like 'survey:%:nps';
  v_nps := case when v_nps_n > 0 then round((v_prom - v_det) * 100.0 / v_nps_n)::int else null end;

  -- CSAT% from survey CSAT votes (score ≥ 75 = 4–5★ = satisfied).
  select count(*), count(*) filter (where score >= 75)
    into v_csat_n, v_csat_sat
    from cx_signals
   where client_email = v_tenant and source = 'survey' and occurred_at >= v_since and ref like 'survey:%:csat';
  v_csat := case when v_csat_n > 0 then round(v_csat_sat * 100.0 / v_csat_n)::int else null end;

  -- trend: this-30d avg score vs prior-30d avg score (delta, null if either side empty).
  select round(avg(score) filter (where occurred_at >= now() - interval '30 days')),
         round(avg(score) filter (where occurred_at >= now() - interval '60 days' and occurred_at < now() - interval '30 days'))
    into v_now30, v_prev30
    from cx_signals
   where client_email = v_tenant and occurred_at >= now() - interval '60 days';

  return jsonb_build_object(
    'ready', true,
    'n', v_n,
    'nps', v_nps,
    'nps_n', v_nps_n,
    'csat_pct', v_csat,
    'csat_n', v_csat_n,
    'cx_score', coalesce(v_cx, 0),
    'sentiment', jsonb_build_object('positive', v_pos, 'neutral', v_neu, 'negative', v_neg),
    'by_source', jsonb_build_object('call', v_call, 'review', v_review, 'survey', v_survey),
    'trend', case when v_now30 is not null and v_prev30 is not null then (v_now30 - v_prev30)::int else null end,
    'promoters', v_prom,
    'passives', v_pass,
    'detractors', v_det
  );
end
$$;

-- ── RPC: cx_drivers ───────────────────────────────────────────────────────────
-- Top themes driving experience, tenant-scoped over `since`, split love (avg ≥ 60)
-- vs fix (avg < 60). Empty array when no themed signals. Drives the "what customers
-- love / what to fix" board.
create or replace function public.cx_drivers(
  p_secret text,
  p_email  text,
  p_since  timestamptz default (now() - interval '90 days')
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_email));
  v_since  timestamptz := coalesce(p_since, now() - interval '90 days');
  v_out    jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' then raise exception 'tenant required' using errcode = '22023'; end if;

  select coalesce(jsonb_agg(row_to_json(d) order by d.count desc), '[]'::jsonb)
    into v_out
    from (
      select theme,
             count(*)                    as count,
             round(avg(score))::int      as avg_score,
             case when avg(score) >= 60 then 'love' else 'fix' end as polarity
        from cx_signals
       where client_email = v_tenant and occurred_at >= v_since and nullif(trim(coalesce(theme, '')), '') is not null
       group by theme
       order by count(*) desc
       limit 20
    ) d;

  return coalesce(v_out, '[]'::jsonb);
end
$$;

-- ── RPC: cx_detractors ────────────────────────────────────────────────────────
-- The loop-close queue: open (unhandled) negative signals from the last 30 days —
-- score ≤ 40 OR sentiment 'negative' — joined to crm_contacts for name/phone/email
-- (tenant-scoped; a contact from another tenant can never appear). The crm_contacts
-- join is guarded so a missing table degrades to null name/contact instead of 500.
create or replace function public.cx_detractors(
  p_secret text,
  p_email  text,
  p_limit  int default 25
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_email));
  v_lim    int  := greatest(1, least(200, coalesce(p_limit, 25)));
  v_out    jsonb := '[]'::jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' then raise exception 'tenant required' using errcode = '22023'; end if;

  begin
    select coalesce(jsonb_agg(row_to_json(d) order by d.occurred_at desc), '[]'::jsonb)
      into v_out
      from (
        select s.id,
               s.contact_id,
               c.full_name                              as name,
               coalesce(c.phone, c.email)               as contact,
               s.source,
               round(s.score)::int                      as score,
               s.comment,
               s.occurred_at,
               false                                    as handled
          from cx_signals s
          left join crm_contacts c
                 on c.id = s.contact_id and c.client_email = v_tenant   -- tenant-scoped join
         where s.client_email = v_tenant
           and s.handled_at is null
           and s.occurred_at >= now() - interval '30 days'
           and (s.score <= 40 or s.sentiment = 'negative')
         order by s.occurred_at desc
         limit v_lim
      ) d;
  exception when others then
    -- crm_contacts absent → fall back to signals-only (still tenant-scoped), never crash.
    select coalesce(jsonb_agg(row_to_json(d) order by d.occurred_at desc), '[]'::jsonb)
      into v_out
      from (
        select s.id, s.contact_id, null::text as name, null::text as contact,
               s.source, round(s.score)::int as score, s.comment, s.occurred_at, false as handled
          from cx_signals s
         where s.client_email = v_tenant
           and s.handled_at is null
           and s.occurred_at >= now() - interval '30 days'
           and (s.score <= 40 or s.sentiment = 'negative')
         order by s.occurred_at desc
         limit v_lim
      ) d;
  end;

  return coalesce(v_out, '[]'::jsonb);
end
$$;

-- ── RPC: cx_close_loop ────────────────────────────────────────────────────────
-- Mark a detractor signal handled so it drops off cx_detractors. Tenant-scoped:
-- the WHERE client_email guard means a caller can only ever touch THEIR OWN rows —
-- a signal_id from another tenant matches nothing and returns false. Idempotent.
create or replace function public.cx_close_loop(
  p_secret    text,
  p_email     text,
  p_signal_id uuid,
  p_action    text
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_email));
  v_id     uuid;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' or p_signal_id is null then return false; end if;

  update cx_signals
     set handled_at = now(),
         handled_action = nullif(trim(coalesce(p_action, '')), '')
   where id = p_signal_id and client_email = v_tenant   -- tenant guard: only this client's rows
   returning id into v_id;

  return v_id is not null;
end
$$;

-- ── GRANTS: the RPC is the only door (anon executes; RLS blocks direct table reads) ──
grant execute on function public._cx_sentiment(numeric)                                             to anon;
grant execute on function public.cx_signal_upsert(text,text,uuid,text,numeric,text,text,text,text,text,timestamptz) to anon;
grant execute on function public.cx_survey_claim(text,text,text,int)                                to anon;
grant execute on function public.cx_vote(text,text,text,text,int,text,text)                         to anon;
grant execute on function public.cx_summary(text,text,timestamptz)                                  to anon;
grant execute on function public.cx_drivers(text,text,timestamptz)                                  to anon;
grant execute on function public.cx_detractors(text,text,int)                                       to anon;
grant execute on function public.cx_close_loop(text,text,uuid,text)                                 to anon;

-- ============================================================================
-- PROOF — run AFTER paste (replace the email with a real tenant, e.g. natura@guileoai.com)
-- ============================================================================
-- -- 1) tables + RLS exist, no anon policy:
-- select relname, relrowsecurity from pg_class where relname in ('cx_signals','cx_survey_claims');
-- select count(*) as anon_policies from pg_policies where tablename in ('cx_signals','cx_survey_claims');  -- expect 0
--
-- -- 2) passive ingest is idempotent (2nd call on same ref → false):
-- select public.cx_signal_upsert('glo_ing_c7f2a9e4b8d16350','demo@guileoai.com',null,'call',90,'positive','positive','staff','Atendimento ótimo','call:conv_TEST1',now());  -- true
-- select public.cx_signal_upsert('glo_ing_c7f2a9e4b8d16350','demo@guileoai.com',null,'call',90,'positive','positive','staff','Atendimento ótimo','call:conv_TEST1',now());  -- false (dup)
-- select public.cx_signal_upsert('glo_ing_c7f2a9e4b8d16350','demo@guileoai.com',null,'review',20,'1','negative','wait_time','Esperei demais','review:gbp_TEST1',now()-interval '2 days'); -- true (open detractor)
--
-- -- 3) survey claim (2nd within window → false) + vote (re-tap revises):
-- select public.cx_survey_claim('glo_ing_c7f2a9e4b8d16350','demo@guileoai.com','+15551230000',168);  -- true
-- select public.cx_survey_claim('glo_ing_c7f2a9e4b8d16350','demo@guileoai.com','+15551230000',168);  -- false
-- select public.cx_vote('glo_ing_c7f2a9e4b8d16350','demo@guileoai.com','+15551230000','nps',10,'Amei','wow');    -- {ok,score:100,segment:promoter}
-- select public.cx_vote('glo_ing_c7f2a9e4b8d16350','demo@guileoai.com','+15551230000','csat',5,null,null);       -- {ok,score:100,segment:satisfied}
-- select public.cx_vote('glo_ing_c7f2a9e4b8d16350','demo@guileoai.com','+15551230001','nps',3,'Faltou rapidez','wait_time'); -- detractor
--
-- -- 4) metrics:
-- select public.cx_summary('glo_ing_c7f2a9e4b8d16350','demo@guileoai.com');    -- n>0, nps, csat_pct, cx_score, sentiment, by_source, trend
-- select public.cx_drivers('glo_ing_c7f2a9e4b8d16350','demo@guileoai.com');    -- [{theme,count,avg_score,polarity}]
-- select public.cx_detractors('glo_ing_c7f2a9e4b8d16350','demo@guileoai.com'); -- open negatives (review + nps 3), handled:false
--
-- -- 5) close-loop drops it off the queue (and cross-tenant guard returns false):
-- --    grab an id from cx_detractors above, then:
-- -- select public.cx_close_loop('glo_ing_c7f2a9e4b8d16350','demo@guileoai.com','<that-id>','Liguei e ofereci retorno');  -- true
-- -- select public.cx_close_loop('glo_ing_c7f2a9e4b8d16350','OTHER@guileoai.com','<that-id>','x');                        -- false (not their row)
-- -- select public.cx_detractors('glo_ing_c7f2a9e4b8d16350','demo@guileoai.com');  -- the closed one is gone
--
-- -- 6) tenant isolation: another tenant sees nothing of demo's data:
-- select public.cx_summary('glo_ing_c7f2a9e4b8d16350','someoneelse@guileoai.com');  -- n:0, everything empty/null
--
-- -- cleanup (optional):
-- -- delete from cx_signals where client_email='demo@guileoai.com';
-- -- delete from cx_survey_claims where client_email='demo@guileoai.com';
-- ============================================================================
