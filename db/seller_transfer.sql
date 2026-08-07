-- ============================================================================
-- GUILEO · TRANSFERÊNCIA DE CARTEIRA (com auditoria) — cole TUDO no SQL Editor.
-- Projeto ynihodbknhjirkdogxby · conta smart@guileoai.com. Idempotente.
--
-- Regra de negócio (Luis): o cliente é do vendedor PRA SEMPRE. A carteira só
-- muda se o CLIENTE desejar — e mesmo assim SÓ o admin executa a troca, com um
-- MOTIVO obrigatório, e cada troca deixa uma trilha permanente. Nenhum fluxo de
-- vendedor sobrescreve assigned_seller: só esta RPC (gated INGEST), chamada
-- exclusivamente pelo /api/seller-transfer atrás do gate admin (blitz_stats).
--
-- SEGURANÇA: mesmo padrão dos "33" — SECURITY DEFINER gated pelo literal INGEST
-- ('glo_ing_c7f2a9e4b8d16350' = env INGEST_SECRET), RLS on SEM policy anon, grant
-- execute to anon (as RPCs são o ÚNICO acesso). TENANT-bound: a troca é SEMPRE
-- por client_email — um id/uuid solto NUNCA autoriza mexer no dono.
-- Requer db/onboard_completo.sql + db/seller_wallet.sql (onboard_drafts com
-- assigned_seller) e db/seller_roster.sql (tabela sellers) já colados.
-- ============================================================================

-- ── 1) TRILHA PERMANENTE — cada troca vira uma linha imutável (append-only) ──
create table if not exists public.seller_wallet_transfers (
  id           uuid primary key default gen_random_uuid(),
  client_email text not null,
  from_seller  text,                       -- pode ser null (cliente sem dono anterior)
  to_seller    text not null,
  reason       text not null,              -- MOTIVO obrigatório (regra do Luis)
  created_at   timestamptz not null default now()
);
create index if not exists idx_wallet_transfers_client on public.seller_wallet_transfers(client_email);
create index if not exists idx_wallet_transfers_at     on public.seller_wallet_transfers(created_at desc);

-- RLS ligado, SEM policies: só as RPCs SECURITY DEFINER abaixo tocam a trilha.
alter table public.seller_wallet_transfers enable row level security;

-- ── 2) RPC de TRANSFERÊNCIA — grava a auditoria ANTES, depois reatribui o
--    tenant por client_email. Valida: motivo não-vazio + vendedor destino
--    existe e está ativo. No-op honesto se o cliente já for do destino. ───────
create or replace function public.seller_wallet_transfer(
  p_secret text, p_client_email text, p_to_seller_email text, p_reason text
) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_client text := lower(trim(coalesce(p_client_email,'')));
  v_to     text := lower(trim(coalesce(p_to_seller_email,'')));
  v_reason text := nullif(trim(coalesce(p_reason,'')), '');
  v_from   text;
  v_rows   int;
begin
  -- gate INGEST (loud) — a segurança real; o /api/seller-transfer já é admin-gated.
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_client = '' or position('@' in v_client) = 0 then raise exception 'bad client_email' using errcode = '22023'; end if;
  if v_to = '' or position('@' in v_to) = 0 then raise exception 'bad to_seller' using errcode = '22023'; end if;
  -- MOTIVO obrigatório — a troca NUNCA acontece sem justificativa (trilha auditável).
  if v_reason is null then raise exception 'reason required' using errcode = '22023'; end if;

  -- vendedor destino tem que EXISTIR e estar ATIVO (nunca mandar cliente pra um fantasma).
  -- lower(trim()) dos dois lados: e-mail com caixa mista no roster não vira falso-negativo.
  if not exists (select 1 from sellers where lower(trim(email)) = v_to and active) then
    raise exception 'to_seller not found or inactive' using errcode = '22023';
  end if;

  -- o cliente tem que EXISTIR na carteira ANTES de qualquer trilha — sem isso a
  -- auditoria registraria uma "transferência fantasma" de um cliente inexistente.
  if not exists (select 1 from onboard_drafts
                  where lower(trim(client_email)) = v_client and status <> 'deleted') then
    raise exception 'client not found in wallet' using errcode = '22023';
  end if;

  -- dono atual do tenant (por client_email; coalesce = mesma leitura da carteira).
  select coalesce(assigned_seller, seller_email) into v_from
    from onboard_drafts
   where lower(trim(client_email)) = v_client and status <> 'deleted'
   order by created_at asc
   limit 1;

  -- No-op honesto SÓ quando TODOS os drafts do cliente já apontam pro destino —
  -- se algum draft divergir, a troca roda e alinha todo mundo.
  if not exists (select 1 from onboard_drafts
                  where lower(trim(client_email)) = v_client and status <> 'deleted'
                    and lower(trim(coalesce(assigned_seller, seller_email, ''))) is distinct from v_to) then
    return json_build_object('ok', true, 'from', v_from, 'to', v_to, 'noop', true);
  end if;

  -- AUDITORIA na MESMA transação da mutação (rollback conjunto se algo falhar).
  insert into seller_wallet_transfers (client_email, from_seller, to_seller, reason)
  values (v_client, v_from, v_to, v_reason);

  -- reatribui o tenant — SEMPRE por client_email, NUNCA por id/uuid solto.
  update onboard_drafts
     set assigned_seller = v_to,
         assigned_at     = now(),
         updated_at      = now()
   where lower(trim(client_email)) = v_client and status <> 'deleted';
  get diagnostics v_rows = row_count;

  return json_build_object('ok', true, 'from', v_from, 'to', v_to, 'moved', v_rows);
end $$;

-- ── 3) HISTÓRICO — a trilha de trocas de UM cliente (mais recente primeiro). ──
create or replace function public.seller_wallet_transfer_history(p_secret text, p_client_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb; v_client text := lower(trim(coalesce(p_client_email,'')));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'from', from_seller, 'to', to_seller, 'reason', reason, 'at', created_at
         ) order by created_at desc), '[]'::jsonb) into v
    from seller_wallet_transfers
   where lower(trim(client_email)) = v_client;
  return v;
exception
  when sqlstate '28000' then raise;      -- nunca engole o gate
  when others then return '[]'::jsonb;   -- degrada: histórico vazio, nunca 500
end $$;

-- ── GRANTS (anon chama via PostgREST; o gate INGEST é a segurança real) ──────
grant execute on function public.seller_wallet_transfer(text, text, text, text) to anon;
grant execute on function public.seller_wallet_transfer_history(text, text) to anon;
