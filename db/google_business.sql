-- ─────────────────────────────────────────────────────────────────────────────
-- GOOGLE BUSINESS PROFILE — per-tenant creds (OAuth refresh_token + account_id + location_id) so
-- the connector (functions/api/google-business.js) can read REAL reviews, reply to them, and post,
-- plus a light dedup table so Gui NEVER replies to the same review twice.
--
-- Creds are WRITTEN by the connector's "connect" action via the generic store_integration RPC
-- (client_integrations, provider='google_business', already live in prod); this file READS them
-- (gb_creds_lookup) and adds a convenience writer (gb_creds_store) + the dedup store.
-- INGEST-gated (hardcoded literal — Supabase forbids GUC). Idempotent. RLS on, no anon policy —
-- only the SECURITY DEFINER RPCs touch the tables. Paste in Supabase (ynihodbknhjirkdogxby).
--
-- HONEST: no GOOGLE_BUSINESS_* env OR no creds row → the connector returns { ready:false } and
-- nothing runs. Guileo never invents a review or a reply.
--
-- ── tokens (jsonb) SHAPE (client_integrations.tokens for provider='google_business') ──
--   {
--     "account_id":    "123456789",   -- Business Profile account id (accounts.locations.reviews parent)
--     "location_id":   "987654321",   -- the verified location id (the Maps/Search listing)
--     "refresh_token": "1//0g…"       -- OAuth refresh_token (scope business.manage) → access_token
--   }
-- ─────────────────────────────────────────────────────────────────────────────

-- ── READ a tenant's stored Google Business tokens (same as capture_tools.sql; kept here so this
--    file is self-contained). Idempotent create-or-replace. ──
create or replace function public.gb_creds_lookup(p_secret text, p_email text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return (
    select tokens
    from client_integrations
    where client_email = lower(trim(p_email)) and provider = 'google_business'
    limit 1
  );
exception when undefined_table then return null;
end $$;
grant execute on function public.gb_creds_lookup(text, text) to anon;

-- ── OPTIONAL convenience writer — lets Luis paste a tenant's Google Business creds directly in SQL
--    (the connector's "connect" action already stores them via store_integration; this is the
--    no-HTTP path). Same INGEST gate. Same tokens shape above.
-- Example:
--   select public.gb_creds_store('glo_ing_c7f2a9e4b8d16350', 'natura@guileoai.com',
--     jsonb_build_object('account_id','1234','location_id','5678','refresh_token','1//0g…'));
create or replace function public.gb_creds_store(p_secret text, p_email text, p_tokens jsonb)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  insert into client_integrations (client_email, provider, tokens)
  values (lower(trim(p_email)), 'google_business', coalesce(p_tokens, '{}'::jsonb))
  on conflict (client_email, provider) do update
    set tokens = excluded.tokens, updated_at = now();
  return true;
end $$;
grant execute on function public.gb_creds_store(text, text, jsonb) to anon;

-- ── DEDUP STORE — one row per (tenant, review) once Gui has handled it. Prevents a second reply to
--    the same review. Tiny by design; RLS on, no anon policy (only the RPCs below reach it). ──
create table if not exists public.gbp_reviews_seen (
  client_email text        not null,
  review_id    text        not null,
  replied      boolean      not null default false,
  reply_text   text,
  first_seen   timestamptz  not null default now(),
  replied_at   timestamptz,
  primary key (client_email, review_id)
);
alter table public.gbp_reviews_seen enable row level security;

-- ── list the review ids this tenant already handled (connector filters unseen-only against this). ──
create or replace function public.gbp_seen_ids(p_secret text, p_email text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_tenant text := lower(trim(p_email));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(review_id)
    from gbp_reviews_seen
    where client_email = v_tenant
  ), '[]'::jsonb);
exception when undefined_table then return '[]'::jsonb;
end $$;
grant execute on function public.gbp_seen_ids(text, text) to anon;

-- ── mark a review handled (idempotent; upgrades to replied=true on the reply). Returns true if this
--    was the FIRST time we handled this review (useful for "new vs already-answered" logic). ──
create or replace function public.gbp_mark_seen(
  p_secret text, p_email text, p_review_id text,
  p_replied boolean default false, p_reply_text text default null
) returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_tenant text := lower(trim(p_email)); v_new boolean := false;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if p_review_id is null or length(trim(p_review_id)) = 0 then return false; end if;
  insert into gbp_reviews_seen (client_email, review_id, replied, reply_text, replied_at)
  values (v_tenant, p_review_id, coalesce(p_replied, false), p_reply_text,
          case when p_replied then now() else null end)
  on conflict (client_email, review_id) do update set
    replied    = gbp_reviews_seen.replied or excluded.replied,
    reply_text = coalesce(excluded.reply_text, gbp_reviews_seen.reply_text),
    replied_at = case when excluded.replied and gbp_reviews_seen.replied_at is null
                      then now() else gbp_reviews_seen.replied_at end;
  get diagnostics v_new = row_count;  -- 1 on insert
  return v_new;
end $$;
grant execute on function public.gbp_mark_seen(text, text, text, boolean, text) to anon;

-- ✅ Done. gb_creds_lookup/store = per-tenant Google Business OAuth creds; gbp_reviews_seen +
--    gbp_seen_ids/gbp_mark_seen = the reply dedup. Connector stays INERT until GOOGLE_BUSINESS_*
--    env + a connected tenant. Never a fake review, never a double reply.
