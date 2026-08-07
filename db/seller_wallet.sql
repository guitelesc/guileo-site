-- ============================================================================
-- GUILEO · CARTEIRA PERMANENTE DO VENDEDOR — cole TUDO no SQL Editor e RUN.
-- Projeto ynihodbknhjirkdogxby · conta smart@guileoai.com. Idempotente.
--
-- Regra de negócio (Luis): o vendedor que cadastra o cliente ASSINA o cliente
-- PRA SEMPRE — binding permanente por seller_email (assigned_seller). Só muda
-- se o cliente pedir troca, e mesmo assim SÓ via admin (SQL/painel) — nenhuma
-- RPC aqui sobrescreve um assigned_seller já gravado.
--
-- SEGURANÇA: mesmo padrão dos "33" — SECURITY DEFINER gated pelo literal INGEST
-- ('glo_ing_c7f2a9e4b8d16350'), RLS on sem policy anon, grant execute to anon.
-- Requer db/onboard_completo.sql já colado (tabela onboard_drafts).
-- ============================================================================

-- ── 1) Colunas novas na onboard_drafts ──────────────────────────────────────
alter table public.onboard_drafts add column if not exists connection_code text;
alter table public.onboard_drafts add column if not exists assigned_seller text;
alter table public.onboard_drafts add column if not exists assigned_at     timestamptz;

-- Backfill: quem já cadastrou fica dono (binding permanente). Nunca sobrescreve
-- um assigned_seller já preenchido (troca é só via admin, manualmente).
update public.onboard_drafts
   set assigned_seller = seller_email,
       assigned_at     = coalesce(assigned_at, created_at)
 where assigned_seller is null and coalesce(seller_email,'') <> '';

-- ── 2) draft_approve_mark — nova assinatura com p_code (persiste o connection
--       code na carteira). Como no biz_book: DROP do overload antigo pra não
--       haver ambiguidade; o default '' mantém compat com chamadas antigas. ──
drop function if exists public.draft_approve_mark(text, uuid, text, text);

create or replace function public.draft_approve_mark(
  p_secret text, p_id uuid, p_agent_id text, p_number text, p_code text default ''
) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  update onboard_drafts
     set status          = 'live',
         agent_id        = nullif(p_agent_id,''),
         number          = nullif(p_number,''),
         -- only fill the code when provided; never blank an existing one
         connection_code = coalesce(nullif(p_code,''), connection_code),
         -- permanent binding: set once, NEVER overwritten (admin-only change)
         assigned_seller = coalesce(assigned_seller, nullif(seller_email,'')),
         assigned_at     = coalesce(assigned_at, now()),
         updated_at      = now()
   where id = p_id;
  return found;
end $$;

-- ── 3) draft_list — inclui os campos novos na listagem leve (compatível: só
--       ADICIONA chaves ao jsonb; consumidores antigos continuam funcionando).
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
      'number', number, 'created_at', created_at,
      'connection_code', connection_code,
      'assigned_seller', assigned_seller,
      'industry', coalesce(payload->'verticals'->>0, left(payload->>'description', 80), '')
    ) as r
    from onboard_drafts
    where status <> 'deleted'
      and (coalesce(trim(p_seller_email),'') = '' or seller_email = lower(trim(p_seller_email)))
  ) s;
  return v;
end $$;

-- ── 4) seller_wallet — a CARTEIRA: todos os clientes assinados pelo vendedor,
--       com o connection_code. p_seller_email='' → admin (todas as linhas,
--       cada uma com seu seller_email). Nunca inclui deletados. ──────────────
create or replace function public.seller_wallet(p_secret text, p_seller_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select coalesce(jsonb_agg(r order by r->>'created_at' desc), '[]'::jsonb) into v
  from (
    select jsonb_build_object(
      'id', id, 'business', business,
      'industry', coalesce(payload->'verticals'->>0, left(payload->>'description', 80), ''),
      'status', status, 'agent_id', agent_id, 'number', number,
      'connection_code', connection_code,
      'client_email', client_email,
      'client_name', coalesce(payload->>'owner_name', payload->'contact'->>'name', ''),
      'seller_email', coalesce(assigned_seller, seller_email),
      -- approved_at only for approved rows — assigned_at also backfills pending drafts (binding date)
      'created_at', created_at, 'approved_at', case when status = 'live' then assigned_at end
    ) as r
    from onboard_drafts
    where status <> 'deleted'
      and (coalesce(trim(p_seller_email),'') = ''
           or coalesce(assigned_seller, seller_email) = lower(trim(p_seller_email)))
  ) s;
  return v;
exception
  when sqlstate '28000' then raise;      -- never swallow the gate (bad secret must be loud)
  when others then return '[]'::jsonb;   -- degrade: an empty wallet, never a 500 to the hub
end $$;

-- ── GRANTS (anon chama via PostgREST; o gate INGEST é a segurança real) ──────
grant execute on function public.draft_approve_mark(text, uuid, text, text, text) to anon;
grant execute on function public.draft_list(text, text) to anon;
grant execute on function public.seller_wallet(text, text) to anon;
