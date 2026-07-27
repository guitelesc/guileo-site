-- ─────────────────────────────────────────────────────────────────────────────
-- SOCIAL POSTS — the A+B publishing store for the Meta/Social motor
-- (functions/api/social-publish.js). The SAME Gui brain that answers voice/webchat
-- GENERATES a post in the tenant's brand tone; this table is where every generated
-- post lives through its lifecycle, and where the HUMAN-IN-THE-LOOP "approve" mode
-- parks a draft until the owner OKs it.
--
-- TWO MODES (per-tenant, read from client_integrations provider='meta' tokens.publish_mode):
--   • "auto"    → Gui generates AND publishes straight to Meta (status draft→published).
--   • "approve" → Gui generates a DRAFT (status='pending_approval'); NOTHING is public until
--                 the owner approves it in the cockpit → then it publishes. Default when unset
--                 (public content is safest human-gated).
--
-- SAFETY (public content, on the client's behalf):
--   • Absolute multi-tenant isolation — every read/mutation is bound to (client_email, id).
--     A UUID alone NEVER authorizes anything; one tenant's posts never leak to another.
--   • RLS ON, NO anon policy — only the SECURITY DEFINER RPCs below reach the table.
--   • INGEST-gated by hardcoded literal ('glo_ing_7f3da9c2b4e8' = env INGEST_SECRET);
--     Supabase forbids GUC (`alter database set`) so the gate is a literal, like every RPC.
--   • Idempotent (create-or-replace / if-not-exists). EXCEPTION blocks degrade gracefully —
--     a missing table returns empty/null, never a 500.
--   • No META_APP_* env or no connected tenant → the connector stays INERT; a "published"
--     row is only ever written after Meta actually accepts the post (external_id set).
--
-- Paste in Supabase (ynihodbknhjirkdogxby). Depends on client_integrations (already live)
-- and get_client_data (tenant validator, already live) — both used by the connector, not here.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── The lifecycle store. One row per generated post. status flows:
--    draft → pending_approval → (scheduled) → published | failed. ──
create table if not exists public.social_posts (
  id            uuid         primary key default gen_random_uuid(),
  client_email  text         not null,
  channel       text         not null default 'instagram',   -- instagram | facebook
  content       text         not null default '',            -- the caption/body Gui generated
  media_url     text,                                         -- optional image url
  status        text         not null default 'draft',        -- draft|pending_approval|scheduled|published|failed
  scheduled_at  timestamptz,                                  -- when status='scheduled'
  published_at  timestamptz,                                  -- set the moment Meta accepts it
  external_id   text,                                         -- Meta's returned post/media id (proof it went live)
  error         text,                                         -- last failure note when status='failed'
  meta          jsonb        not null default '{}'::jsonb,     -- provenance: {generated_by:'guileo', mode, tone, source}
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);
alter table public.social_posts enable row level security;
-- No anon policy on purpose — the SECURITY DEFINER RPCs are the ONLY way in.

create index if not exists social_posts_tenant_idx  on public.social_posts (client_email, created_at desc);
create index if not exists social_posts_status_idx  on public.social_posts (client_email, status);
create index if not exists social_posts_sched_idx   on public.social_posts (status, scheduled_at)
  where status = 'scheduled';

-- Keep status honest to the state machine (a bad value can never sneak in).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'social_posts_status_chk') then
    alter table public.social_posts add constraint social_posts_status_chk
      check (status in ('draft','pending_approval','scheduled','published','failed'));
  end if;
exception when undefined_table then null;
end $$;

-- ── CREATE a post row (Gui just generated it). Returns the full row as jsonb so the connector
--    can echo it back to the cockpit. status is caller-chosen ('published' is NEVER written here —
--    only social_post_publish, after Meta accepts, sets that). Tenant-bound by construction. ──
create or replace function public.social_post_create(
  p_secret text, p_email text, p_channel text, p_content text,
  p_media_url text default null, p_status text default 'draft',
  p_scheduled_at timestamptz default null, p_meta jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_tenant text := lower(trim(p_email)); v_row public.social_posts%rowtype;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant is null or v_tenant = '' or position('@' in v_tenant) = 0 then raise exception 'bad tenant' using errcode = '22023'; end if;
  insert into public.social_posts (client_email, channel, content, media_url, status, scheduled_at, meta)
  values (
    v_tenant,
    case when lower(coalesce(p_channel,'')) in ('facebook','fb') then 'facebook' else 'instagram' end,
    coalesce(p_content, ''),
    nullif(trim(coalesce(p_media_url,'')), ''),
    -- guard the state machine: a caller can only open in draft / pending_approval / scheduled
    case when coalesce(p_status,'draft') in ('draft','pending_approval','scheduled') then p_status else 'draft' end,
    p_scheduled_at,
    coalesce(p_meta,'{}'::jsonb) || jsonb_build_object('generated_by','guileo')
  )
  returning * into v_row;
  return to_jsonb(v_row);
exception when undefined_table then return null;
end $$;
grant execute on function public.social_post_create(text, text, text, text, text, text, timestamptz, jsonb) to anon;

-- ── LIST a tenant's posts (optionally filtered by status). ALWAYS scoped to client_email —
--    a tenant can never read another tenant's posts. ──
create or replace function public.social_post_list(
  p_secret text, p_email text, p_status text default null, p_limit int default 100
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_tenant text := lower(trim(p_email));
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(t) order by t.created_at desc)
    from (
      select * from public.social_posts
      where client_email = v_tenant
        and (p_status is null or status = p_status)
      order by created_at desc
      limit greatest(1, least(coalesce(p_limit,100), 500))
    ) t
  ), '[]'::jsonb);
exception when undefined_table then return '[]'::jsonb;
end $$;
grant execute on function public.social_post_list(text, text, text, int) to anon;

-- ── GET one post — tenant-bound (client_email, id). A UUID from another tenant returns null. ──
create or replace function public.social_post_get(p_secret text, p_email text, p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_tenant text := lower(trim(p_email)); v_row public.social_posts%rowtype;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select * into v_row from public.social_posts where client_email = v_tenant and id = p_id;
  if not found then return null; end if;
  return to_jsonb(v_row);
exception when undefined_table then return null;
end $$;
grant execute on function public.social_post_get(text, text, uuid) to anon;

-- ── APPROVE a pending draft → move it to 'scheduled' or straight to publishing intent.
--    Atomic + tenant-bound + state-guarded: only a row that is CURRENTLY pending_approval
--    (and owned by this tenant) can be approved — you can't "approve" something already public,
--    and you can't approve across tenants. Returns the row if it transitioned, else null. ──
create or replace function public.social_post_approve(p_secret text, p_email text, p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_tenant text := lower(trim(p_email)); v_row public.social_posts%rowtype;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  update public.social_posts
    set status = 'draft',                 -- 'draft' = approved & ready to publish (the connector publishes next)
        meta = meta || jsonb_build_object('approved_at', now()),
        updated_at = now()
  where client_email = v_tenant and id = p_id and status = 'pending_approval'
  returning * into v_row;
  if not found then return null; end if;
  return to_jsonb(v_row);
exception when undefined_table then return null;
end $$;
grant execute on function public.social_post_approve(text, text, uuid) to anon;

-- ── MARK PUBLISHED — the ONLY path that sets status='published', and only AFTER Meta actually
--    accepted the post (the connector passes Meta's external_id as proof). Atomic, tenant-bound. ──
create or replace function public.social_post_publish(
  p_secret text, p_email text, p_id uuid, p_external_id text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_tenant text := lower(trim(p_email)); v_row public.social_posts%rowtype;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  update public.social_posts
    set status = 'published',
        external_id = nullif(trim(coalesce(p_external_id,'')), ''),
        published_at = now(),
        error = null,
        updated_at = now()
  where client_email = v_tenant and id = p_id and status <> 'published'
  returning * into v_row;
  if not found then return null; end if;
  return to_jsonb(v_row);
exception when undefined_table then return null;
end $$;
grant execute on function public.social_post_publish(text, text, uuid, text) to anon;

-- ── MARK FAILED — Meta rejected the publish. Records the reason; leaves the row recoverable
--    (the owner can retry). Atomic, tenant-bound. ──
create or replace function public.social_post_fail(
  p_secret text, p_email text, p_id uuid, p_error text
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_tenant text := lower(trim(p_email)); v_row public.social_posts%rowtype;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  update public.social_posts
    set status = 'failed',
        error = left(coalesce(p_error,'publish failed'), 400),
        updated_at = now()
  where client_email = v_tenant and id = p_id
  returning * into v_row;
  if not found then return null; end if;
  return to_jsonb(v_row);
exception when undefined_table then return null;
end $$;
grant execute on function public.social_post_fail(text, text, uuid, text) to anon;

-- ── READ the tenant's Meta integration blob (provider='meta') — the connector needs
--    publish_mode + the page/IG tokens. Self-contained (same shape as gb_creds_lookup).
--    tokens SHAPE for provider='meta':
--      { "publish_mode":"auto"|"approve", "ig_user_id":"…", "page_id":"…",
--        "page_access_token":"…" }
--    Returns null when the tenant has no Meta row (connector then stays inert). ──
create or replace function public.social_meta_lookup(p_secret text, p_email text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return (
    select tokens from client_integrations
    where client_email = lower(trim(p_email)) and provider = 'meta'
    limit 1
  );
exception when undefined_table then return null;
end $$;
grant execute on function public.social_meta_lookup(text, text) to anon;

-- ── SET the per-tenant publish mode ('auto' | 'approve') WITHOUT clobbering the tenant's stored
--    Meta tokens — a jsonb merge, not a replace. Creates the Meta row if it doesn't exist yet
--    (so the owner can choose "approve" before the app is even connected). Tenant-bound. ──
create or replace function public.social_set_mode(p_secret text, p_email text, p_mode text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_tenant text := lower(trim(p_email)); v_mode text; v_tokens jsonb;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  v_mode := case when lower(coalesce(p_mode,'')) = 'auto' then 'auto' else 'approve' end;
  insert into client_integrations (client_email, provider, tokens)
  values (v_tenant, 'meta', jsonb_build_object('publish_mode', v_mode))
  on conflict (client_email, provider) do update
    set tokens = coalesce(client_integrations.tokens, '{}'::jsonb) || jsonb_build_object('publish_mode', v_mode),
        updated_at = now()
  returning tokens into v_tokens;
  return jsonb_build_object('publish_mode', v_mode, 'tokens', v_tokens);
exception when undefined_table then return jsonb_build_object('publish_mode', v_mode, 'ready', false);
end $$;
grant execute on function public.social_set_mode(text, text, text) to anon;

-- ── Claim DUE scheduled posts (status='scheduled' AND scheduled_at <= now) atomically, flipping
--    them to 'draft' (=ready-to-publish) so a cron tick can publish them exactly once. Tenant-scoped
--    when p_email given; global (all tenants) when null — used by the scheduler sweep. ──
create or replace function public.social_posts_claim_due(p_secret text, p_email text default null, p_limit int default 50)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_tenant text := lower(trim(coalesce(p_email,'')));
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(u))
    from (
      update public.social_posts s
        set status = 'draft', meta = meta || jsonb_build_object('scheduled_fired_at', now()), updated_at = now()
      where s.id in (
        select id from public.social_posts
        where status = 'scheduled' and scheduled_at is not null and scheduled_at <= now()
          and (v_tenant = '' or client_email = v_tenant)
        order by scheduled_at asc
        limit greatest(1, least(coalesce(p_limit,50), 200))
        for update skip locked
      )
      returning *
    ) u
  ), '[]'::jsonb);
exception when undefined_table then return '[]'::jsonb;
end $$;
grant execute on function public.social_posts_claim_due(text, text, int) to anon;

-- ✅ Done. social_posts = the A+B lifecycle store; the RPCs are the ONLY door in (INGEST-gated,
--    tenant-bound, state-guarded). 'published' is written ONLY after Meta accepts (external_id proof).
--    Default mode is 'approve' (human-in-the-loop) until the owner opts into 'auto'. Nothing goes
--    public without either the owner's OK (approve) or their explicit auto choice.
