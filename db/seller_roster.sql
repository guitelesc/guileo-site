-- ============================================================================
-- GUILEO · ROSTER DE VENDEDORES NO BANCO — cole TUDO no SQL Editor e RUN.
-- Projeto ynihodbknhjirkdogxby · conta smart@guileoai.com. Idempotente.
--
-- Mata o env var SELLER_ROSTER + o furo do team-code: os vendedores viram
-- linhas no banco, geridas pelo /admin (SellerManager). Cada vendedor tem um
-- código PESSOAL (GUI-XXXX-9999) — quem entra com ele é roster:true (chave de
-- cliente COMPLETA na carteira). O team-code segue como fallback mascarado.
--
-- SEGURANÇA: mesmo padrão dos "33" — SECURITY DEFINER gated pelo literal INGEST
-- ('glo_ing_7f3da9c2b4e8' = env INGEST_SECRET), RLS on SEM policy anon, grant
-- execute to anon (as RPCs são o ÚNICO acesso). seller_list devolve TUDO (só o
-- admin chama pelo /api/seller-admin, atrás do gate blitz_stats). seller_upsert
-- devolve SÓ a linha do vendedor mexido — NUNCA códigos de outros.
-- ============================================================================

-- ── TABELA de vendedores ─────────────────────────────────────────────────────
create table if not exists public.sellers (
  id             uuid primary key default gen_random_uuid(),
  email          text unique not null,
  name           text,
  ref_slug       text unique,
  personal_code  text,
  active         boolean not null default true,
  commission_pct numeric not null default 10,
  created_at     timestamptz not null default now()
);
-- RECONCILE with a pre-existing `sellers` table (db/sellers.sql target-shape had `code`
-- NOT NULL and `ref` instead of `ref_slug`) — `create table if not exists` does NOT
-- reconcile columns, so without these ALTERs a stale table breaks seller_upsert.
alter table public.sellers add column if not exists name           text;
alter table public.sellers add column if not exists ref_slug       text;
alter table public.sellers add column if not exists personal_code  text;
alter table public.sellers add column if not exists active         boolean not null default true;
alter table public.sellers add column if not exists commission_pct numeric not null default 10;
alter table public.sellers add column if not exists created_at     timestamptz not null default now();
do $$ begin
  -- legacy `code text not null` would break inserts that don't supply it
  begin alter table public.sellers alter column code drop not null; exception when others then null; end;
  -- ref_slug must be unique for attribution; add constraint only if missing
  begin alter table public.sellers add constraint sellers_ref_slug_key unique (ref_slug); exception when others then null; end;
end $$;

create index if not exists idx_sellers_active on public.sellers(active);

-- RLS ligado, SEM policies: só as RPCs SECURITY DEFINER abaixo tocam a tabela.
alter table public.sellers enable row level security;

-- ── UPSERT: cria/atualiza um vendedor. Gera personal_code GUI-XXXX-9999 quando
--    vazio (mantém o existente se o caller não passar um). Deduplica ref_slug.
--    Devolve APENAS a linha deste vendedor (nunca códigos de outros). ──────────
create or replace function public.seller_upsert(
  p_secret text, p_email text, p_name text default '', p_ref text default '',
  p_code text default '', p_commission_pct numeric default 10
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_email    text := lower(trim(coalesce(p_email,'')));
  v_ref      text := nullif(trim(both '-' from regexp_replace(lower(trim(coalesce(p_ref,''))), '[^a-z0-9]+', '-', 'g')), '');
  v_code     text := nullif(trim(coalesce(p_code,'')), '');
  v_existing text;
  v_row      public.sellers%rowtype;
  i          int;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_email = '' or position('@' in v_email) = 0 then raise exception 'bad email' using errcode = '22023'; end if;

  -- derive the ref slug from the email local-part when none was supplied
  if v_ref is null then v_ref := regexp_replace(split_part(v_email, '@', 1), '[^a-z0-9]+', '-', 'g'); end if;
  v_ref := left(trim(both '-' from v_ref), 40);
  if v_ref = '' then v_ref := 'seller'; end if;
  -- keep ref_slug unique across DIFFERENT emails (own row may already hold it)
  while exists (select 1 from sellers where ref_slug = v_ref and email <> v_email) loop
    v_ref := left(v_ref, 36) || '-' || substr(md5(random()::text), 1, 2);
  end loop;

  -- keep the existing personal_code when the caller didn't pass one; else mint a fresh
  -- GUI-XXXX-9999 (4 unambiguous letters/digits + 4 digits — no O/0/I/1 confusion)
  select personal_code into v_existing from sellers where email = v_email;
  if v_code is null then v_code := v_existing; end if;
  if v_code is null then
    v_code := 'GUI-';
    for i in 1..4 loop
      v_code := v_code || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1);
    end loop;
    v_code := v_code || '-' || lpad(floor(random() * 10000)::int::text, 4, '0');
  end if;

  insert into sellers (email, name, ref_slug, personal_code, commission_pct, active)
  values (v_email, nullif(trim(coalesce(p_name,'')), ''), v_ref, v_code,
          greatest(0, least(100, coalesce(p_commission_pct, 10))), true)
  on conflict (email) do update
    set name           = coalesce(nullif(trim(coalesce(p_name,'')), ''), sellers.name),
        ref_slug       = excluded.ref_slug,
        personal_code  = excluded.personal_code,
        commission_pct = coalesce(p_commission_pct, sellers.commission_pct),
        active         = true
  returning * into v_row;

  return json_build_object(
    'email', v_row.email, 'name', v_row.name, 'ref', v_row.ref_slug,
    'personal_code', v_row.personal_code, 'active', v_row.active,
    'commission_pct', v_row.commission_pct, 'created_at', v_row.created_at
  );
end $$;

-- ── LIST: TODOS os vendedores, incl. personal_code. SÓ o admin chama (o gate
--    blitz_stats no /api/seller-admin é a barreira; aqui é o gate INGEST). ─────
create or replace function public.seller_list(p_secret text)
returns json
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select json_agg(json_build_object(
      'email', email, 'name', name, 'ref', ref_slug, 'personal_code', personal_code,
      'active', active, 'commission_pct', commission_pct, 'created_at', created_at
    ) order by created_at desc)
    from sellers
  ), '[]'::json);
exception
  when sqlstate '28000' then raise;    -- gate errado tem que ser barulhento
  when others then return '[]'::json;  -- degrada: lista vazia, nunca 500
end $$;

-- ── DISABLE / RE-ENABLE: p_active default false desativa; true reativa (o toggle
--    do SellerManager usa os dois). Mantém o nome do contrato. ─────────────────
create or replace function public.seller_disable(
  p_secret text, p_email text, p_active boolean default false
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  update sellers set active = coalesce(p_active, false) where email = lower(trim(coalesce(p_email,'')));
  return found;
end $$;

-- ── AUTH CHECK: valida email+code ATIVOS → {ok,name,ref}. Chamado (best-effort)
--    por seller-login.js e onboard-draft.js ANTES do roster env/team-code. ─────
create or replace function public.seller_auth_check(
  p_secret text, p_email text, p_code text
) returns json
language plpgsql security definer set search_path = public as $$
declare v_row public.sellers%rowtype;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select * into v_row from sellers
   where email = lower(trim(coalesce(p_email,'')))
     and personal_code = trim(coalesce(p_code,''))
     and active
   limit 1;
  if not found then return json_build_object('ok', false); end if;
  return json_build_object('ok', true, 'name', v_row.name, 'ref', v_row.ref_slug);
exception
  when sqlstate '28000' then raise;
  when others then return json_build_object('ok', false);  -- degrada: cai no fluxo env/team-code
end $$;

-- ── GRANTS (anon chama via PostgREST; o gate INGEST é a segurança real) ───────
grant execute on function public.seller_upsert(text, text, text, text, text, numeric) to anon;
grant execute on function public.seller_list(text)                                    to anon;
grant execute on function public.seller_disable(text, text, boolean)                  to anon;
grant execute on function public.seller_auth_check(text, text, text)                  to anon;

-- ✅ Done. /admin → SellerManager lista/adiciona/desativa vendedores; o código
--    pessoal gerado dá acesso roster:true (chave completa) no /vendedor.
