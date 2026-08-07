-- ============================================================================
-- GUILEO · CADASTRO COMPLETO — cole TUDO no SQL Editor e RUN (idempotente).
-- Projeto ynihodbknhjirkdogxby · conta smart@guileoai.com.
--
-- Dá suporte ao fluxo "cadastro completo": o vendedor (/vendedor) preenche UM
-- intake completo do negócio + TODOS os canais e salva um DRAFT; o Luis aprova
-- com 1 clique no /admin → o provisionador existente (functions/api/onboard-client.js)
-- dá à luz o agente dedicado do cliente.
--
-- SEGURANÇA: mesmo padrão dos "33" — funções SECURITY DEFINER com o MESMO literal
-- de gate INGEST ('glo_ing_c7f2a9e4b8d16350' = env INGEST_SECRET). RLS ligado, SEM
-- policies anon: as RPCs são o ÚNICO acesso. `grant execute ... to anon`.
-- ============================================================================

-- ── DRAFTS do cadastro completo ─────────────────────────────────────────────
create table if not exists public.onboard_drafts (
  id           uuid primary key default gen_random_uuid(),
  seller_email text,
  client_email text,
  business     text,
  payload      jsonb,
  status       text default 'draft',   -- draft | live | deleted
  agent_id     text,
  number       text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists idx_onboard_drafts_seller on public.onboard_drafts(seller_email, created_at desc);
create index if not exists idx_onboard_drafts_status on public.onboard_drafts(status, created_at desc);

-- RLS ligado, SEM policies: só as RPCs SECURITY DEFINER abaixo tocam a tabela.
alter table public.onboard_drafts enable row level security;

-- ── EXTRAS do perfil do cliente (logo, cor de marca, nome/voz do agente, canais,
--    links sociais/suporte) — bits que a RPC base de perfil não carrega. Guardado
--    numa tabela companheira dedicada (não altera o schema da tabela de perfil já
--    existente em prod) keyed por client_email. Lido pela cockpit p/ renderizar a
--    marca do cliente no widget. ────────────────────────────────────────────────
create table if not exists public.client_profile_extras (
  client_email text primary key,
  extras       jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);
alter table public.client_profile_extras enable row level security;

create or replace function public.profile_extras_set(p_secret text, p_email text, p_extras jsonb)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  insert into client_profile_extras (client_email, extras, updated_at)
  values (lower(trim(p_email)), coalesce(p_extras, '{}'::jsonb), now())
  on conflict (client_email) do update
    set extras = coalesce(excluded.extras, '{}'::jsonb), updated_at = now();
  return true;
end $$;

-- Leitura dos extras (para a cockpit) — devolve o jsonb ou null.
create or replace function public.profile_extras_get(p_secret text, p_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return (select extras from client_profile_extras where client_email = lower(trim(p_email)) limit 1);
end $$;

-- ── DRAFT RPCs ──────────────────────────────────────────────────────────────

-- SAVE: insere um novo draft; devolve o id.
create or replace function public.draft_save(
  p_secret text, p_seller_email text, p_client_email text, p_business text, p_payload jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  insert into onboard_drafts (seller_email, client_email, business, payload, status)
  values (lower(trim(p_seller_email)), lower(trim(coalesce(p_client_email,''))), p_business, coalesce(p_payload,'{}'::jsonb), 'draft')
  returning id into v_id;
  return v_id;
end $$;

-- LIST: p_seller_email='' → TODOS (admin); senão só os do vendedor. Nunca os deletados.
-- Devolve linhas leves (sem o payload inteiro) para a listagem.
create or replace function public.draft_list(p_secret text, p_seller_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select coalesce(jsonb_agg(r order by r->>'created_at' desc), '[]'::jsonb) into v
  from (
    select jsonb_build_object(
      'id', id, 'business', business, 'client_email', client_email,
      'seller_email', seller_email, 'status', status, 'agent_id', agent_id,
      'number', number, 'created_at', created_at
    ) as r
    from onboard_drafts
    where status <> 'deleted'
      and (coalesce(trim(p_seller_email),'') = '' or seller_email = lower(trim(p_seller_email)))
  ) s;
  return v;
end $$;

-- GET: payload completo de um draft. p_seller_email='' → admin (sem restrição);
-- senão exige que o draft seja daquele vendedor (senão devolve null).
create or replace function public.draft_get(p_secret text, p_id uuid, p_seller_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select jsonb_build_object(
    'id', id, 'seller_email', seller_email, 'client_email', client_email,
    'business', business, 'payload', payload, 'status', status,
    'agent_id', agent_id, 'number', number, 'created_at', created_at
  ) into v
  from onboard_drafts
  where id = p_id and status <> 'deleted'
    and (coalesce(trim(p_seller_email),'') = '' or seller_email = lower(trim(p_seller_email)))
  limit 1;
  return v;
end $$;

-- APPROVE MARK: após provisionar, marca o draft como 'live' e grava o que nasceu.
create or replace function public.draft_approve_mark(p_secret text, p_id uuid, p_agent_id text, p_number text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  update onboard_drafts
     set status = 'live', agent_id = nullif(p_agent_id,''), number = nullif(p_number,''), updated_at = now()
   where id = p_id;
  return found;
end $$;

-- DELETE (soft): admin (p_seller_email='') ou o vendedor dono. Marca status='deleted'.
create or replace function public.draft_delete(p_secret text, p_id uuid, p_seller_email text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  update onboard_drafts
     set status = 'deleted', updated_at = now()
   where id = p_id
     and (coalesce(trim(p_seller_email),'') = '' or seller_email = lower(trim(p_seller_email)));
  return found;
end $$;

-- ── GRANTS (anon chama via PostgREST; o gate INGEST é a segurança real) ───────
grant execute on function public.profile_extras_set(text, text, jsonb) to anon;
grant execute on function public.profile_extras_get(text, text)        to anon;
grant execute on function public.draft_save(text, text, text, text, jsonb) to anon;
grant execute on function public.draft_list(text, text)                to anon;
grant execute on function public.draft_get(text, uuid, text)           to anon;
grant execute on function public.draft_approve_mark(text, uuid, text, text) to anon;
grant execute on function public.draft_delete(text, uuid, text)        to anon;
