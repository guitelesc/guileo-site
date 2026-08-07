-- ============================================================================
-- GUILEO · SELLER FOLLOW-UP (o CRM PESSOAL do vendedor)  — paste in Supabase → SQL Editor → Run
-- Project: ynihodbknhjirkdogxby (smart@guileoai.com) · Idempotent (pode rodar de novo).
--
-- THESIS: the seller works LEADS before they become clients. This is their private pipeline —
-- who they approached, where each one is (abordado→conversa→demo→proposta→fechado/perdido), the
-- next touch, and a quick note. Once a prospect is 'fechado' the seller cadastra them in the
-- ➕ Add client tab (that's where the real onboarding draft lives) — this table is the CHASE.
--
-- SECURITY: every RPC is SECURITY DEFINER, INGEST-gated by the same literal the ingest pipeline
-- uses ('glo_ing_c7f2a9e4b8d16350' — see db/marketplace_leads.sql / db/coupons.sql), granted to anon,
-- and SELLER-SCOPED by p_seller_email — a seller NEVER sees, edits, or deletes another seller's
-- prospect. The HTTP layer (functions/api/seller-prospects.js) always passes the AUTHENTICATED
-- seller_email, never the one from the body. Table has RLS ON with NO anon policies, so only the
-- definer funcs reach it.
-- ============================================================================

-- ── TABLE ────────────────────────────────────────────────────────────────────
create table if not exists public.seller_prospects (
  id            uuid primary key default gen_random_uuid(),
  seller_email  text not null,
  business      text,                                  -- the target business name
  contact_name  text,                                  -- the person the seller talks to
  phone         text,                                  -- normalized (digits and +)
  email         text,
  stage         text not null default 'abordado',      -- abordado|conversa|demo|proposta|fechado|perdido
  note          text,
  next_at       timestamptz,                           -- next planned touch (drives "needs you today")
  market        text not null default 'us',            -- us | br
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_seller_prospects_owner on public.seller_prospects (seller_email, updated_at desc);
create index if not exists idx_seller_prospects_next  on public.seller_prospects (seller_email, next_at);

-- ── RLS: trancado; só as funções SECURITY DEFINER acessam ────────────────────
alter table public.seller_prospects enable row level security;

-- ── GATE helper (same literal as the ingest pipeline) ─────────────────────────
create or replace function public._sp_ok(p_secret text) returns boolean
language sql immutable as $$ select p_secret = 'glo_ing_c7f2a9e4b8d16350' $$;

-- Normalizers kept inline so a stage/market typo can never poison the pipeline.
--   stage  → one of the 6 canonical values, default 'abordado'
--   market → 'us' | 'br', default 'us'

-- ── UPSERT (seller-scoped): insert when p_id is empty, else update ONLY the row that
--    belongs to this seller. Returns the full row as jsonb (or null when an update
--    matched nothing — e.g. someone else's id). ───────────────────────────────
create or replace function public.sp_upsert(
  p_secret text, p_seller_email text, p_id text default null,
  p_business text default null, p_contact_name text default null,
  p_phone text default null, p_email text default null,
  p_stage text default null, p_note text default null,
  p_next_at text default null, p_market text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_seller  text := lower(trim(coalesce(p_seller_email,'')));
  v_stage   text := case when lower(coalesce(p_stage,'')) in ('abordado','conversa','demo','proposta','fechado','perdido')
                         then lower(p_stage) else 'abordado' end;
  v_market  text := case when lower(coalesce(p_market,'')) = 'br' then 'br' else 'us' end;
  v_phone   text := nullif(regexp_replace(coalesce(p_phone,''), '[^0-9+]', '', 'g'), '');
  v_email   text := nullif(lower(trim(coalesce(p_email,''))), '');
  v_biz     text := nullif(left(trim(coalesce(p_business,'')), 160), '');
  v_contact text := nullif(left(trim(coalesce(p_contact_name,'')), 120), '');
  v_note    text := nullif(left(trim(coalesce(p_note,'')), 1200), '');
  v_next    timestamptz := null;
  v_id      uuid;
  v_row     public.seller_prospects%rowtype;
begin
  if not public._sp_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_seller = '' then raise exception 'no seller' using errcode = 'P0002'; end if;
  -- tolerate a bad/empty date string — never fail the save over it
  begin v_next := nullif(trim(coalesce(p_next_at,'')), '')::timestamptz; exception when others then v_next := null; end;

  if coalesce(trim(p_id),'') = '' then
    insert into public.seller_prospects (seller_email, business, contact_name, phone, email, stage, note, next_at, market)
    values (v_seller, v_biz, v_contact, v_phone, v_email, v_stage, v_note, v_next, v_market)
    returning * into v_row;
  else
    begin v_id := p_id::uuid; exception when others then raise exception 'bad id' using errcode = 'P0001'; end;
    update public.seller_prospects set
      business = v_biz, contact_name = v_contact, phone = v_phone, email = v_email,
      stage = v_stage, note = v_note, next_at = v_next, market = v_market, updated_at = now()
    where id = v_id and seller_email = v_seller   -- SCOPE: only my own row
    returning * into v_row;
    if not found then return null; end if;
  end if;

  return jsonb_build_object(
    'id', v_row.id, 'seller_email', v_row.seller_email, 'business', v_row.business,
    'contact_name', v_row.contact_name, 'phone', v_row.phone, 'email', v_row.email,
    'stage', v_row.stage, 'note', v_row.note, 'next_at', v_row.next_at,
    'market', v_row.market, 'created_at', v_row.created_at, 'updated_at', v_row.updated_at
  );
end $$;

-- ── LIST (seller-scoped): ordered by next_at NULLS LAST, then updated_at desc ──
create or replace function public.sp_list(p_secret text, p_seller_email text, p_limit int default 500)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_seller text := lower(trim(coalesce(p_seller_email,''))); v_lim int := greatest(1, least(coalesce(p_limit,500), 1000));
begin
  if not public._sp_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_seller = '' then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'business', p.business, 'contact_name', p.contact_name,
             'phone', p.phone, 'email', p.email, 'stage', p.stage, 'note', p.note,
             'next_at', p.next_at, 'market', p.market,
             'created_at', p.created_at, 'updated_at', p.updated_at
           ) order by (p.next_at is null), p.next_at asc, p.updated_at desc)
    from (select * from public.seller_prospects
           where seller_email = v_seller order by (next_at is null), next_at asc, updated_at desc limit v_lim) p
  ), '[]'::jsonb);
end $$;

-- ── DELETE (seller-scoped hard delete of the seller's own prospect) ───────────
create or replace function public.sp_delete(p_secret text, p_seller_email text, p_id text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_seller text := lower(trim(coalesce(p_seller_email,''))); v_id uuid; v_ok boolean := false;
begin
  if not public._sp_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_seller = '' then return false; end if;
  begin v_id := p_id::uuid; exception when others then return false; end;
  delete from public.seller_prospects where id = v_id and seller_email = v_seller returning true into v_ok;
  return coalesce(v_ok, false);
end $$;

-- ── STATS (seller-scoped): count per stage → the pipeline chips ───────────────
create or replace function public.sp_stats(p_secret text, p_seller_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_seller text := lower(trim(coalesce(p_seller_email,'')));
begin
  if not public._sp_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_seller = '' then return '{}'::jsonb; end if;
  return coalesce((
    select jsonb_object_agg(stage, n) from (
      select stage, count(*)::int as n from public.seller_prospects
       where seller_email = v_seller group by stage
    ) s
  ), '{}'::jsonb);
end $$;

-- ── GRANTS (anon reaches ONLY the gated definer funcs — table stays RLS-locked) ─
grant execute on function public._sp_ok(text)                                                             to anon;
grant execute on function public.sp_upsert(text,text,text,text,text,text,text,text,text,text,text)        to anon;
grant execute on function public.sp_list(text,text,int)                                                   to anon;
grant execute on function public.sp_delete(text,text,text)                                                to anon;
grant execute on function public.sp_stats(text,text)                                                      to anon;

-- ✅ Done. /api/seller-prospects (sellerAuthFull) → sp_* → the seller's personal follow-up CRM.
