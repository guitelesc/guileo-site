-- ─────────────────────────────────────────────────────────────────────────────
-- META INTEGRATION — per-tenant Instagram/Messenger creds + page→tenant map + mid dedup.
-- Powers functions/api/meta-webhook.js (IG DM + FB Messenger → the same Gui replies).
--
-- Three pieces, all INGEST-gated (hardcoded literal — Supabase forbids GUC), RLS on with NO
-- anon policy (only the SECURITY DEFINER RPCs reach the tables), idempotent DDL, EXCEPTION-safe:
--   1. client_integrations (provider='meta') — the per-tenant credential row (tokens jsonb):
--        { page_id, ig_id, page_access_token, refresh_token, business_name }
--      Reuses the EXISTING client_integrations table (same as mindbody/square/google_business).
--   2. meta_page_map — fast index page_id|ig_id → client_email (a tenant maps BOTH its FB page id
--      and its IG business id to itself, so a DM to either resolves to the right tenant).
--   3. meta_msg_seen — one row per (tenant, mid) so a re-delivered Meta message is answered once.
--
-- SAFETY: an unknown page_id resolves to NOTHING (RPC returns null) → the webhook IGNORES it →
-- Gui NEVER answers as the wrong tenant. Multi-tenant isolation is by construction.
-- Paste in Supabase (ynihodbknhjirkdogxby). Owner: smart@guileoai.com.
-- ─────────────────────────────────────────────────────────────────────────────

-- ══ 1) page_id / ig_id → tenant map ═══════════════════════════════════════════════════════════
-- One row per Meta business surface (a FB page id AND an IG business id both point at the same
-- client_email). page_id is the PK so a page can belong to exactly one tenant (no cross-tenant
-- ambiguity). kind is just a label ('page' | 'ig') for observability.
create table if not exists public.meta_page_map (
  page_id      text         not null primary key,
  client_email text         not null,
  kind         text         not null default 'page',
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);
alter table public.meta_page_map enable row level security;
create index if not exists ix_meta_page_map_email on public.meta_page_map(client_email);

-- ══ 2) mid dedup store ════════════════════════════════════════════════════════════════════════
-- Exactly-once: (client_email, mid) primary key. Tiny + tenant-scoped. RLS on, no anon policy.
create table if not exists public.meta_msg_seen (
  client_email text         not null,
  mid          text         not null,
  seen_at      timestamptz  not null default now(),
  primary key (client_email, mid)
);
alter table public.meta_msg_seen enable row level security;

-- ══ 3) tenant discovery by page/ig id ─────────────────────────────────────────────────────────
-- Returns { client_email, page_id, ig_id, page_access_token, business_name } for the tenant that
-- owns p_page_id — joining the map to that tenant's client_integrations('meta') credential row.
-- NULL when the page is not mapped (→ webhook ignores → never a wrong-tenant reply). INGEST-gated.
create or replace function public.meta_tenant_for_page(p_secret text, p_page_id text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_email text;
  v_tokens jsonb;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if p_page_id is null or trim(p_page_id) = '' then return null; end if;

  select client_email into v_email
  from meta_page_map
  where page_id = trim(p_page_id)
  limit 1;
  if v_email is null then return null; end if;   -- unknown page → no tenant → webhook ignores

  select tokens into v_tokens
  from client_integrations
  where client_email = v_email and provider = 'meta'
  limit 1;
  v_tokens := coalesce(v_tokens, '{}'::jsonb);

  return jsonb_build_object(
    'client_email',      v_email,
    'page_id',           coalesce(v_tokens->>'page_id', trim(p_page_id)),
    'ig_id',             v_tokens->>'ig_id',
    'page_access_token', v_tokens->>'page_access_token',
    'business_name',     v_tokens->>'business_name'
  );
exception when others then
  return null;   -- degrade honest: any error → treat as unmapped (never guess a tenant)
end $$;
grant execute on function public.meta_tenant_for_page(text, text) to anon;

-- ══ 4) mid dedup RPC ──────────────────────────────────────────────────────────────────────────
-- Returns TRUE the first time this (tenant, mid) is seen (caller proceeds to reply), FALSE if it
-- was already handled (caller stops — no double reply). ON CONFLICT DO NOTHING makes the insert
-- the atomic claim. INGEST-gated. Best-effort: on any unexpected error returns TRUE (fail-open —
-- a genuine message is never silently dropped by a dedup hiccup).
create or replace function public.meta_mark_seen(p_secret text, p_email text, p_mid text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_ins   integer;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_email = '' or p_mid is null or trim(p_mid) = '' then return true; end if;

  insert into meta_msg_seen (client_email, mid)
  values (v_email, trim(p_mid))
  on conflict (client_email, mid) do nothing;
  get diagnostics v_ins = row_count;
  return v_ins > 0;   -- 1 = first time (proceed) · 0 = duplicate (stop)
exception when others then
  return true;   -- fail-open: never drop a real message on a dedup error
end $$;
grant execute on function public.meta_mark_seen(text, text, text) to anon;

-- ══ 5) convenience writer — store a tenant's Meta creds + map its page/ig ids in one call ──────
-- The connect flow (once META_APP_* is approved) will call this; it also lets Luis paste a
-- tenant's Meta creds directly in SQL. Upserts BOTH the credential row AND the page/ig map rows so
-- meta_tenant_for_page resolves immediately. Same INGEST gate. Idempotent.
--   tokens shape: { page_id, ig_id, page_access_token, refresh_token, business_name }
-- Example:
--   select public.meta_creds_store('glo_ing_7f3da9c2b4e8', 'natura@guileoai.com',
--     jsonb_build_object(
--       'page_id','1122334455', 'ig_id','1789900011',
--       'page_access_token','EAAG…', 'business_name','Natura Spa'
--     ));
create or replace function public.meta_creds_store(p_secret text, p_email text, p_tokens jsonb)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_page  text;
  v_ig    text;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_email = '' then return false; end if;

  insert into client_integrations (client_email, provider, tokens)
  values (v_email, 'meta', coalesce(p_tokens, '{}'::jsonb))
  on conflict (client_email, provider) do update
    set tokens = excluded.tokens, updated_at = now();

  v_page := nullif(trim(coalesce(p_tokens->>'page_id','')), '');
  v_ig   := nullif(trim(coalesce(p_tokens->>'ig_id','')),   '');

  -- Map the FB page id → tenant (page_id is PK: re-point it to THIS tenant on conflict).
  if v_page is not null then
    insert into meta_page_map (page_id, client_email, kind)
    values (v_page, v_email, 'page')
    on conflict (page_id) do update set client_email = excluded.client_email, kind = 'page', updated_at = now();
  end if;
  -- Map the IG business id → tenant (same table, kind='ig').
  if v_ig is not null then
    insert into meta_page_map (page_id, client_email, kind)
    values (v_ig, v_email, 'ig')
    on conflict (page_id) do update set client_email = excluded.client_email, kind = 'ig', updated_at = now();
  end if;

  return true;
end $$;
grant execute on function public.meta_creds_store(text, text, jsonb) to anon;
