-- ============================================================================
-- GUILEO · GOOGLE ADS — DONE-FOR-YOU SERVICE REQUEST  (paste in Supabase → SQL Editor → Run)
-- Project: ynihodbknhjirkdogxby (smart@guileoai.com) · Idempotente (pode rodar de novo).
--
-- DECISÃO (Luis): NÃO integramos a Google Ads API (complexa demais). Isto é um
-- PEDIDO DE SERVIÇO: o cliente (ou a Gui, no lugar dele) diz "quero anúncios no Google"
-- → capturamos orçamento/objetivo/público/região aqui → o TIME Guileo cria e gerencia
-- as campanhas MANUALMENTE. O status reflete o trabalho humano real — NUNCA finge que
-- um anúncio está rodando.
--   requested  → pedido recebido, o time vai montar
--   building   → o time está montando a campanha
--   active     → campanha no ar (marcada à mão pelo time no /admin)
--   paused     → pausada (orçamento/temporada)
--   completed  → encerrada
--   cancelled  → cancelada
--
-- SEGURANÇA: RLS ON sem policy anon → só as funções SECURITY DEFINER tocam a tabela.
-- Gate = mesmo literal INGEST do resto do pipeline ('glo_ing_c7f2a9e4b8d16350', ver
-- db/collections_optin.sql / db/marketplace_leads.sql). Tudo escopado por client_email:
-- nenhum tenant lê/escreve o pedido de outro. O set_status admin casa (email, id) juntos.
-- ============================================================================

-- ── TABLE ────────────────────────────────────────────────────────────────────
create table if not exists public.ads_requests (
  id            uuid primary key default gen_random_uuid(),
  client_email  text not null,
  budget_cents  bigint not null default 0,     -- orçamento MENSAL desejado, em centavos
  goal          text,                          -- "mais ligações", "agendamentos", "tráfego"…
  area          text,                          -- público/região ("Miami 15mi", "spa perto de mim")
  notes         text,                          -- observações livres do cliente
  status        text not null default 'requested',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_ads_requests_tenant on public.ads_requests (client_email, created_at desc);
create index if not exists idx_ads_requests_status on public.ads_requests (status, created_at desc);

-- ── RLS: trancado; só as funções SECURITY DEFINER acessam ────────────────────
alter table public.ads_requests enable row level security;

-- ── GATE helper (mesmo literal do pipeline de ingest) ────────────────────────
create or replace function public._ads_ok(p_secret text) returns boolean
language sql immutable as $$ select p_secret = 'glo_ing_c7f2a9e4b8d16350' $$;

-- normaliza status para um dos estados válidos (default seguro = 'requested')
create or replace function public._ads_norm_status(p_status text) returns text
language sql immutable as $$
  select case lower(coalesce(p_status,''))
    when 'building'  then 'building'
    when 'active'    then 'active'
    when 'paused'    then 'paused'
    when 'completed' then 'completed'
    when 'cancelled' then 'cancelled'
    when 'canceled'  then 'cancelled'
    else 'requested'
  end
$$;

-- ── CREATE (idempotente contra double-submit): um pedido ABERTO idêntico criado
--    nos últimos 2 min é reaproveitado, em vez de duplicar. Retorna jsonb do pedido. ──
create or replace function public.ads_request_create(
  p_secret text, p_email text,
  p_budget_cents bigint default 0, p_goal text default null,
  p_area text default null, p_notes text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_email));
  v_budget bigint := greatest(0, least(coalesce(p_budget_cents, 0), 100000000)); -- teto $1M/mês
  v_goal   text := nullif(left(trim(coalesce(p_goal,'')),  200), '');
  v_area   text := nullif(left(trim(coalesce(p_area,'')),  200), '');
  v_notes  text := nullif(left(trim(coalesce(p_notes,'')), 2000), '');
  v_row    ads_requests%rowtype;
begin
  if not _ads_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  if position('@' in v_tenant) = 0 then raise exception 'bad email' using errcode = '22023'; end if;

  -- dedupe: mesmo tenant + mesmo orçamento + mesmo objetivo, ainda 'requested', nos últimos 2 min
  select * into v_row from ads_requests
   where client_email = v_tenant and status = 'requested'
     and budget_cents = v_budget and coalesce(goal,'') = coalesce(v_goal,'')
     and created_at > now() - interval '2 minutes'
   order by created_at desc limit 1;
  if found then
    return jsonb_build_object('id', v_row.id, 'status', v_row.status,
      'budget_cents', v_row.budget_cents, 'created_at', v_row.created_at, 'duplicate', true);
  end if;

  insert into ads_requests (client_email, budget_cents, goal, area, notes)
  values (v_tenant, v_budget, v_goal, v_area, v_notes)
  returning * into v_row;

  return jsonb_build_object('id', v_row.id, 'status', v_row.status,
    'budget_cents', v_row.budget_cents, 'created_at', v_row.created_at, 'duplicate', false);
end $$;

-- ── STATUS (tenant): todos os pedidos DESTE tenant, mais recente primeiro.
--    Honesto — o status é o trabalho humano real do time, nunca "anúncio rodando" fake. ──
create or replace function public.ads_request_status(p_secret text, p_email text)
returns table(id uuid, budget_cents bigint, goal text, area text, notes text,
              status text, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not _ads_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  return query
    select r.id, r.budget_cents, r.goal, r.area, r.notes, r.status, r.created_at, r.updated_at
    from ads_requests r
    where r.client_email = lower(trim(p_email))
    order by r.created_at desc
    limit 50;
end $$;

-- ── ADMIN LIST: todos os pedidos (fila do time Guileo no /admin). INGEST-gated;
--    o endpoint já verificou o ADMIN_TOKEN antes de chegar aqui. ──
create or replace function public.ads_request_list(p_secret text, p_status text default null)
returns table(id uuid, client_email text, budget_cents bigint, goal text, area text,
              notes text, status text, created_at timestamptz, updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_filter text := nullif(lower(trim(coalesce(p_status,''))), '');
begin
  if not _ads_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  return query
    select r.id, r.client_email, r.budget_cents, r.goal, r.area, r.notes, r.status, r.created_at, r.updated_at
    from ads_requests r
    where v_filter is null or r.status = v_filter
    order by r.created_at desc
    limit 500;
end $$;

-- ── ADMIN SET STATUS: o time atualiza o estado real do pedido. Casa (email, id)
--    juntos (belt-and-suspenders) — nunca muda o pedido de outro tenant por id solto. ──
create or replace function public.ads_request_set_status(
  p_secret text, p_email text, p_id uuid, p_status text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_new text := _ads_norm_status(p_status); v_row ads_requests%rowtype;
begin
  if not _ads_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  update ads_requests
     set status = v_new, updated_at = now()
   where id = p_id and client_email = lower(trim(p_email))
   returning * into v_row;
  if not found then return jsonb_build_object('ok', false, 'note', 'not found'); end if;
  return jsonb_build_object('ok', true, 'id', v_row.id, 'status', v_row.status);
end $$;

grant execute on function public.ads_request_create(text,text,bigint,text,text,text) to anon;
grant execute on function public.ads_request_status(text,text) to anon;
grant execute on function public.ads_request_list(text,text) to anon;
grant execute on function public.ads_request_set_status(text,text,uuid,text) to anon;

-- ✅ Done. Fluxo: cliente/Gui pede em /api/google-ads (action:"request") → linha aqui em
--    status 'requested' → aparece na fila do /admin (action:"list") → o time monta e marca
--    'building'/'active'/'paused' à mão. O cliente vê o estado REAL em action:"status".
