-- Demo Engine — persistence for the personalized-demo motor (functions/api/demo.js).
-- A prospect's REAL brand kit is saved under an OPAQUE token so the demo becomes a shareable
-- public page (/demo/:token), and every view/lead is captured for CRM/analytics.
-- Gated by the INGEST literal, SECURITY DEFINER set search_path=public, EXCEPTION-wrapped,
-- idempotent. RLS ON, NO anon policy → the tables are reachable only through these RPCs.

-- ── tables ────────────────────────────────────────────────────────────────────

create table if not exists public.demo_saved (
  demo_token    text primary key,
  client_email  text,                                   -- nullable: prospect not yet a client
  brand         jsonb not null default '{}'::jsonb,      -- the extracted brand kit
  created_at    timestamptz not null default now()
);
alter table public.demo_saved enable row level security; -- no anon policy → locked

create table if not exists public.demo_events (
  id            bigint generated always as identity primary key,
  demo_token    text,
  kind          text not null,                           -- 'view' | 'lead'
  product       text,
  contact       jsonb not null default '{}'::jsonb,      -- {name,email,contact,brand} for leads
  created_at    timestamptz not null default now()
);
alter table public.demo_events enable row level security; -- no anon policy → locked

create index if not exists demo_events_token_idx on public.demo_events (demo_token, created_at desc);

-- ── RPCs ──────────────────────────────────────────────────────────────────────

-- SAVE: persist a brand kit, return a fresh opaque token. Idempotent per call (new token each).
-- Uses core pg_catalog gen_random_uuid (gen_random_bytes lives in the `extensions` schema on
-- Supabase and is invisible under search_path=public). 64 hex chars.
create or replace function public.demo_save(p_secret text, p_brand jsonb)
returns text
language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then return null; end if;
  v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  insert into public.demo_saved(demo_token, brand)
  values (v_token, coalesce(p_brand, '{}'::jsonb));
  return v_token;
exception when others then return null;
end $$;

-- GET: return a saved brand kit by token (for the public /demo/:token page). null if unknown.
create or replace function public.demo_get(p_secret text, p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_brand jsonb;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then return null; end if;
  select brand into v_brand from public.demo_saved where demo_token = p_token;
  return v_brand;  -- null when no row matched
exception when others then return null;
end $$;

-- EVENT: log a demo view or lead. Best-effort analytics; never throws to the caller.
create or replace function public.demo_event(p_secret text, p_token text, p_kind text, p_product text, p_contact jsonb)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then return false; end if;
  -- funnel kinds: view → lead → checkout_start (clicked buy) → checkout_done (Stripe paid).
  if coalesce(p_kind,'') not in ('view','lead','checkout_start','checkout_done') then return false; end if;
  insert into public.demo_events(demo_token, kind, product, contact)
  values (nullif(p_token,''), p_kind, nullif(p_product,''), coalesce(p_contact, '{}'::jsonb));
  return true;
exception when others then return false;
end $$;

-- STATS: aggregate the demo funnel. p_token='' → global (admin view); a token → that demo only
-- (seller view). Returns only COUNTS (no PII) so it's safe marketing analytics. Secret-gated.
create or replace function public.demo_stats(p_secret text, p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then return null; end if;
  select jsonb_build_object(
    'totals', coalesce((
      select jsonb_object_agg(kind, c) from (
        select kind, count(*) c from public.demo_events
        where (nullif(p_token,'') is null or demo_token = p_token)
        group by kind
      ) x
    ), '{}'::jsonb),
    'by_product', coalesce((
      select jsonb_agg(row_to_json(y)) from (
        select product,
          count(*) filter (where kind='view')           as views,
          count(*) filter (where kind='lead')           as leads,
          count(*) filter (where kind='checkout_start') as checkout_start,
          count(*) filter (where kind='checkout_done')  as checkout_done
        from public.demo_events
        where (nullif(p_token,'') is null or demo_token = p_token) and product is not null
        group by product
        order by count(*) filter (where kind='checkout_done') desc, count(*) desc
      ) y
    ), '[]'::jsonb)
  ) into v;
  return coalesce(v, '{}'::jsonb);
exception when others then return null;
end $$;

-- Reachable only via these SECURITY DEFINER RPCs; the anon role has no table policy.
grant execute on function public.demo_save(text, jsonb)               to anon;
grant execute on function public.demo_get(text, text)                 to anon;
grant execute on function public.demo_event(text, text, text, text, jsonb) to anon;
grant execute on function public.demo_stats(text, text)               to anon;
