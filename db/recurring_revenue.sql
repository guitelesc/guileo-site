-- ============================================================================
-- Guileo · RECEITA RECORRENTE  (paste in Supabase → SQL Editor → Run)
-- Project: ynihodbknhjirkdogxby (smart@guileoai.com)
-- THESIS: "motor de crescimento PERSONALIZADO" — receita recorrente é a alavanca
-- mais valiosa. Cada cliente vende, do próprio painel e com a SUA marca:
--   • PACOTES de sessões (compre N, use N) — Stripe mode=payment
--   • ASSINATURAS / clubes (mensal|anual) — Stripe mode=subscription
--   • VALES-PRESENTE (gift cards) com saldo — Stripe mode=payment
-- Este arquivo é o LADO DADOS: 6 tabelas + RPCs. Tudo INGEST-gated (o MESMO literal
-- que o pipeline de ingest / cupons usa), security definer, granted to anon. RLS on,
-- SEM policies para anon (só as funções SECURITY DEFINER acessam). Client-scoped por
-- p_client_email — nenhum tenant enxerga a receita recorrente de outro.
-- Idempotente (pode rodar de novo).
-- ============================================================================

-- ── PACOTES DE SESSÕES ───────────────────────────────────────────────────────
create table if not exists public.packages (
  id           uuid primary key default gen_random_uuid(),
  client_email text not null,
  name         text not null,                                -- "Pacote 10 sessões", "Combo massagem"…
  service      text,                                         -- serviço ao qual o pacote dá direito
  sessions     int  not null default 1,                      -- quantas sessões inclui
  price_cents  int  not null default 0,                      -- preço total do pacote (centavos)
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists packages_tenant on public.packages (client_email, created_at desc);

-- uma compra = N sessões de um pacote por um cliente (decrementadas em cada uso)
create table if not exists public.package_purchases (
  id                uuid primary key default gen_random_uuid(),
  client_email      text not null,
  package_id        uuid,
  contact           text,                                    -- email/telefone de quem comprou
  sessions_total    int  not null default 0,
  sessions_used     int  not null default 0,
  purchased_at      timestamptz not null default now(),
  stripe_session_id text                                     -- checkout.session.id (idempotência do fulfill)
);
create index if not exists package_purchases_tenant  on public.package_purchases (client_email, purchased_at desc);
create index if not exists package_purchases_package on public.package_purchases (package_id);
-- fulfill idempotente: uma sessão Stripe vira UMA compra
create unique index if not exists package_purchases_stripe on public.package_purchases (stripe_session_id) where stripe_session_id is not null;

-- ── ASSINATURAS / CLUBES ─────────────────────────────────────────────────────
create table if not exists public.memberships (
  id           uuid primary key default gen_random_uuid(),
  client_email text not null,
  name         text not null,                                -- "Clube VIP", "Assinatura mensal"…
  price_cents  int  not null default 0,
  interval     text not null default 'month',                -- month | year
  perks        text,                                         -- benefícios (texto livre)
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists memberships_tenant on public.memberships (client_email, created_at desc);

create table if not exists public.membership_subscribers (
  id            uuid primary key default gen_random_uuid(),
  client_email  text not null,
  membership_id uuid,
  contact       text,                                        -- email/telefone do assinante
  status        text not null default 'active',              -- active | canceled | past_due
  started_at    timestamptz not null default now(),
  stripe_sub_id text                                         -- subscription id (idempotência)
);
create index if not exists membership_subscribers_tenant     on public.membership_subscribers (client_email, started_at desc);
create index if not exists membership_subscribers_membership on public.membership_subscribers (membership_id);
create unique index if not exists membership_subscribers_stripe on public.membership_subscribers (stripe_sub_id) where stripe_sub_id is not null;

-- ── VALES-PRESENTE (GIFT CARDS) ──────────────────────────────────────────────
create table if not exists public.gift_cards (
  id                uuid primary key default gen_random_uuid(),
  client_email      text not null,
  code              text not null,
  amount_cents      int  not null default 0,                 -- valor de face (emissão)
  balance_cents     int  not null default 0,                 -- saldo restante
  purchaser_contact text,
  recipient_contact text,
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);
-- um código vivo por (tenant, CÓDIGO em maiúsculas)
create unique index if not exists gift_cards_tenant_code on public.gift_cards (client_email, upper(code));
create index if not exists gift_cards_tenant on public.gift_cards (client_email, created_at desc);

-- ── RLS: tudo trancado; só as funções SECURITY DEFINER acessam ───────────────
alter table public.packages               enable row level security;
alter table public.package_purchases      enable row level security;
alter table public.memberships            enable row level security;
alter table public.membership_subscribers enable row level security;
alter table public.gift_cards             enable row level security;

-- ── PACOTES ──────────────────────────────────────────────────────────────────

-- upsert (cria ou atualiza pelo id do jsonb, se vier). Retorna o id.
create or replace function public.package_upsert(p_secret text, p_client_email text, p_package jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_client_email));
  v_id     uuid := nullif(p_package->>'id','')::uuid;
  v_name   text := nullif(trim(coalesce(p_package->>'name','')),'');
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_name is null then raise exception 'name required'; end if;
  if v_id is not null then
    update public.packages set
      name        = v_name,
      service     = coalesce(p_package->>'service', service),
      sessions    = coalesce((p_package->>'sessions')::int, sessions),
      price_cents = coalesce((p_package->>'price_cents')::int, price_cents),
      active      = coalesce((p_package->>'active')::boolean, active)
    where id = v_id and client_email = v_tenant;
    return v_id;
  end if;
  insert into public.packages (client_email, name, service, sessions, price_cents, active)
  values (
    v_tenant, v_name,
    p_package->>'service',
    coalesce((p_package->>'sessions')::int, 1),
    coalesce((p_package->>'price_cents')::int, 0),
    coalesce((p_package->>'active')::boolean, true)
  )
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.package_list(p_secret text, p_client_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'service', p.service, 'sessions', p.sessions,
      'price_cents', p.price_cents, 'active', p.active, 'created_at', p.created_at,
      -- quantas compras vivas (com saldo de sessões) existem deste pacote
      'purchases', coalesce((
        select count(*) from public.package_purchases pp
        where pp.package_id = p.id and pp.sessions_used < pp.sessions_total
      ), 0)
    ) order by p.created_at desc)
    from public.packages p where p.client_email = lower(trim(p_client_email))
  ), '[]'::jsonb);
end $$;

create or replace function public.package_delete(p_secret text, p_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  delete from public.packages where id = p_id;
  return found;
end $$;

-- registra uma COMPRA de pacote (o fulfill do webhook Stripe chama aqui). Idempotente
-- pelo stripe_session_id (o webhook re-tenta em erro; a sessão vira UMA compra só).
create or replace function public.package_purchase_record(
  p_secret text, p_client_email text, p_package_id uuid, p_contact text,
  p_sessions int, p_stripe_session_id text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_client_email));
  v_id     uuid;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  -- idempotência: se essa sessão Stripe já virou compra, devolve a existente.
  if p_stripe_session_id is not null and length(trim(p_stripe_session_id)) > 0 then
    select id into v_id from public.package_purchases where stripe_session_id = p_stripe_session_id limit 1;
    if v_id is not null then return v_id; end if;
  end if;
  insert into public.package_purchases (client_email, package_id, contact, sessions_total, sessions_used, stripe_session_id)
  values (
    v_tenant, p_package_id,
    nullif(trim(coalesce(p_contact,'')),''),
    greatest(coalesce(p_sessions, 0), 0), 0,
    nullif(trim(coalesce(p_stripe_session_id,'')),'')
  )
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.package_purchases_list(p_secret text, p_client_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', pp.id, 'package_id', pp.package_id, 'contact', pp.contact,
      'sessions_total', pp.sessions_total, 'sessions_used', pp.sessions_used,
      'sessions_left', greatest(pp.sessions_total - pp.sessions_used, 0),
      'package_name', p.name, 'purchased_at', pp.purchased_at
    ) order by pp.purchased_at desc)
    from public.package_purchases pp
    left join public.packages p on p.id = pp.package_id
    where pp.client_email = lower(trim(p_client_email))
  ), '[]'::jsonb);
end $$;

-- USO ATÔMICO: decrementa uma sessão só se ainda houver saldo (guarda no UPDATE),
-- e devolve {ok:true, sessions_left, purchase} — ou {ok:false, reason}.
create or replace function public.package_use(p_secret text, p_purchase_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  update public.package_purchases set sessions_used = sessions_used + 1
    where id = p_purchase_id
      and sessions_used < sessions_total
    returning * into v;
  if v.id is null then
    select * into v from public.package_purchases where id = p_purchase_id limit 1;
    if v.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
    return jsonb_build_object('ok', false, 'reason', 'exhausted', 'sessions_left', 0);
  end if;
  return jsonb_build_object('ok', true, 'sessions_left', greatest(v.sessions_total - v.sessions_used, 0), 'purchase', to_jsonb(v));
end $$;

-- ── ASSINATURAS ──────────────────────────────────────────────────────────────

create or replace function public.membership_upsert(p_secret text, p_client_email text, p_membership jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_client_email));
  v_id     uuid := nullif(p_membership->>'id','')::uuid;
  v_name   text := nullif(trim(coalesce(p_membership->>'name','')),'');
  v_int    text := lower(coalesce(nullif(trim(p_membership->>'interval'),''),'month'));
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_name is null then raise exception 'name required'; end if;
  if v_int not in ('month','year') then v_int := 'month'; end if;
  if v_id is not null then
    update public.memberships set
      name        = v_name,
      price_cents = coalesce((p_membership->>'price_cents')::int, price_cents),
      interval    = v_int,
      perks       = coalesce(p_membership->>'perks', perks),
      active      = coalesce((p_membership->>'active')::boolean, active)
    where id = v_id and client_email = v_tenant;
    return v_id;
  end if;
  insert into public.memberships (client_email, name, price_cents, interval, perks, active)
  values (
    v_tenant, v_name,
    coalesce((p_membership->>'price_cents')::int, 0),
    v_int,
    p_membership->>'perks',
    coalesce((p_membership->>'active')::boolean, true)
  )
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.membership_list(p_secret text, p_client_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id, 'name', m.name, 'price_cents', m.price_cents, 'interval', m.interval,
      'perks', m.perks, 'active', m.active, 'created_at', m.created_at,
      'subscribers', coalesce((
        select count(*) from public.membership_subscribers ms
        where ms.membership_id = m.id and ms.status = 'active'
      ), 0)
    ) order by m.created_at desc)
    from public.memberships m where m.client_email = lower(trim(p_client_email))
  ), '[]'::jsonb);
end $$;

create or replace function public.membership_delete(p_secret text, p_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  delete from public.memberships where id = p_id;
  return found;
end $$;

-- registra um ASSINANTE (o fulfill do webhook Stripe chama aqui). Idempotente pelo
-- stripe_sub_id: se a subscription já foi gravada, apenas atualiza o status.
create or replace function public.membership_subscriber_record(
  p_secret text, p_client_email text, p_membership_id uuid, p_contact text,
  p_status text default 'active', p_stripe_sub_id text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_client_email));
  v_id     uuid;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if p_stripe_sub_id is not null and length(trim(p_stripe_sub_id)) > 0 then
    select id into v_id from public.membership_subscribers where stripe_sub_id = p_stripe_sub_id limit 1;
    if v_id is not null then
      update public.membership_subscribers set status = coalesce(nullif(trim(p_status),''), status) where id = v_id;
      return v_id;
    end if;
  end if;
  insert into public.membership_subscribers (client_email, membership_id, contact, status, stripe_sub_id)
  values (
    v_tenant, p_membership_id,
    nullif(trim(coalesce(p_contact,'')),''),
    coalesce(nullif(trim(p_status),''),'active'),
    nullif(trim(coalesce(p_stripe_sub_id,'')),'')
  )
  returning id into v_id;
  return v_id;
end $$;

-- ── VALES-PRESENTE ───────────────────────────────────────────────────────────

-- cria um gift card. Se não vier código, gera um curto e único no tenant. balance = amount.
create or replace function public.giftcard_create(p_secret text, p_client_email text, p_card jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_client_email));
  v_code   text := upper(nullif(trim(coalesce(p_card->>'code','')),''));
  v_amt    int  := greatest(coalesce((p_card->>'amount_cents')::int, 0), 0);
  v_id     uuid;
  v_try    int  := 0;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_amt <= 0 then raise exception 'amount_cents required'; end if;
  -- gera código único no tenant se necessário (até 6 tentativas).
  while v_code is null loop
    v_code := 'GC' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 8));
    if exists (select 1 from public.gift_cards where client_email = v_tenant and upper(code) = v_code) then
      v_code := null; v_try := v_try + 1;
      if v_try > 6 then raise exception 'could not generate a unique code'; end if;
    end if;
  end loop;
  insert into public.gift_cards (client_email, code, amount_cents, balance_cents, purchaser_contact, recipient_contact, active)
  values (
    v_tenant, v_code, v_amt, v_amt,
    nullif(trim(coalesce(p_card->>'purchaser_contact','')),''),
    nullif(trim(coalesce(p_card->>'recipient_contact','')),''),
    coalesce((p_card->>'active')::boolean, true)
  )
  on conflict (client_email, upper(code)) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.gift_cards where client_email = v_tenant and upper(code) = v_code limit 1;
  end if;
  return jsonb_build_object('id', v_id, 'code', v_code, 'amount_cents', v_amt, 'balance_cents', v_amt);
end $$;

create or replace function public.giftcard_list(p_secret text, p_client_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'code', code, 'amount_cents', amount_cents, 'balance_cents', balance_cents,
      'purchaser_contact', purchaser_contact, 'recipient_contact', recipient_contact,
      'active', active, 'created_at', created_at
    ) order by created_at desc)
    from public.gift_cards where client_email = lower(trim(p_client_email))
  ), '[]'::jsonb);
end $$;

-- valida um código → {valid, card}. Checa active + saldo.
create or replace function public.giftcard_validate(p_secret text, p_client_email text, p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select * into v from public.gift_cards
    where client_email = lower(trim(p_client_email))
      and upper(code) = upper(trim(coalesce(p_code,'')))
    limit 1;
  if v.id is null then return jsonb_build_object('valid', false, 'reason', 'not_found'); end if;
  if not v.active then return jsonb_build_object('valid', false, 'reason', 'inactive', 'card', to_jsonb(v)); end if;
  if v.balance_cents <= 0 then return jsonb_build_object('valid', false, 'reason', 'empty', 'card', to_jsonb(v)); end if;
  return jsonb_build_object('valid', true, 'card', to_jsonb(v));
end $$;

-- RESGATE ATÔMICO: subtrai do saldo só se houver saldo suficiente (guard >= 0 no UPDATE).
-- Devolve {ok:true, balance_cents, redeemed_cents, card} — ou {ok:false, reason}.
create or replace function public.gift_card_redeem(p_secret text, p_client_email text, p_code text, p_amount_cents int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v      record;
  v_amt  int := greatest(coalesce(p_amount_cents, 0), 0);
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_amt <= 0 then return jsonb_build_object('ok', false, 'reason', 'bad_amount'); end if;
  -- atomic gate: só debita quando ativo E o saldo cobre o valor pedido.
  update public.gift_cards set balance_cents = balance_cents - v_amt
    where client_email = lower(trim(p_client_email))
      and upper(code) = upper(trim(coalesce(p_code,'')))
      and active
      and balance_cents >= v_amt
    returning * into v;
  if v.id is null then
    select * into v from public.gift_cards
      where client_email = lower(trim(p_client_email)) and upper(code) = upper(trim(coalesce(p_code,''))) limit 1;
    if v.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
    if not v.active then return jsonb_build_object('ok', false, 'reason', 'inactive'); end if;
    return jsonb_build_object('ok', false, 'reason', 'insufficient', 'balance_cents', v.balance_cents);
  end if;
  return jsonb_build_object('ok', true, 'balance_cents', v.balance_cents, 'redeemed_cents', v_amt, 'card', to_jsonb(v));
end $$;

-- ── GRANTS (anon; a segurança é o literal INGEST dentro de cada função) ───────
grant execute on function public.package_upsert(text,text,jsonb)                         to anon;
grant execute on function public.package_list(text,text)                                 to anon;
grant execute on function public.package_delete(text,uuid)                               to anon;
grant execute on function public.package_purchase_record(text,text,uuid,text,int,text)   to anon;
grant execute on function public.package_purchases_list(text,text)                       to anon;
grant execute on function public.package_use(text,uuid)                                  to anon;
grant execute on function public.membership_upsert(text,text,jsonb)                      to anon;
grant execute on function public.membership_list(text,text)                              to anon;
grant execute on function public.membership_delete(text,uuid)                            to anon;
grant execute on function public.membership_subscriber_record(text,text,uuid,text,text,text) to anon;
grant execute on function public.giftcard_create(text,text,jsonb)                        to anon;
grant execute on function public.giftcard_list(text,text)                                to anon;
grant execute on function public.giftcard_validate(text,text,text)                       to anon;
grant execute on function public.gift_card_redeem(text,text,text,int)                    to anon;

-- ✅ Done. /api/packages + /api/giftcards chamam estas RPCs.
-- NOTE p/ o webhook (stripe-webhook.js): no checkout.session.completed, ler
-- session.metadata.guileo ∈ {package|membership|giftcard} + client_email + id e
-- chamar package_purchase_record / membership_subscriber_record / (giftcard já criado).
