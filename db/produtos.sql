-- ============================================================================
-- Guileo · CATÁLOGO DE PRODUTOS (varejo)   (paste in Supabase → SQL Editor → Run)
-- Project: ynihodbknhjirkdogxby (smart@guileoai.com)
--
-- O QUE É: o negócio de SERVIÇO que também vende coisa de prateleira — o spa que vende creme,
-- shampoo, óleo. O dono lista o produto com preço de venda e, se quiser, o estoque. `biz_services`
-- continua sendo o catálogo de serviços (o que se AGENDA); isto é o que se LEVA PRA CASA.
--
-- ESTE ARQUIVO É O LADO DADOS: 2 tabelas + 5 RPCs. NÃO há pagamento aqui — `product_sale_record`
-- só REGISTRA uma venda que alguém já cobrou (e baixa o estoque na mesma transação).
--
-- PORTÃO: literal INGEST dentro de cada função (o MESMO de db/recurring_revenue.sql) + execução
-- só do service_role (anon/authenticated/public revogados no fim). RLS ligada, SEM policy: nenhuma
-- leitura direta da tabela, só pelas funções SECURITY DEFINER.
-- TENANT: toda instrução é escopada por client_email = lower(trim(p_email)). UUID sozinho nunca
-- autoriza nada — um id de outro tenant se comporta exatamente como um id que não existe.
-- ESTOQUE: NULL = não controlado (vende sempre). Número = controlado; nunca fica negativo
-- (guarda no UPDATE + CHECK na tabela: as duas, porque uma é regra e a outra é prova).
-- Idempotente (pode rodar de novo).
-- ============================================================================

-- ── TABELAS ──────────────────────────────────────────────────────────────────
create table if not exists public.biz_products (
  id           uuid primary key default gen_random_uuid(),
  client_email text not null,
  name         text not null,
  brand        text,
  description  text,
  price_cents  integer not null check (price_cents >= 0),
  stock        integer check (stock is null or stock >= 0),      -- NULL = estoque não controlado
  active       boolean not null default true,
  location_id  uuid null references public.biz_locations(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- um nome por tenant, sem diferenciar maiúscula ("Argan Oil" = "argan oil")
create unique index if not exists biz_products_tenant_nome on public.biz_products (client_email, lower(name));
create index        if not exists biz_products_tenant      on public.biz_products (client_email, active);

-- Uma venda registrada. `product_name` e `unit_price_cents` são a FOTO do momento da venda: o
-- histórico continua legível depois que o produto muda de preço, de nome ou é apagado
-- (product_id vira NULL no delete — a venda NÃO some junto com o produto).
create table if not exists public.biz_product_sales (
  id               uuid primary key default gen_random_uuid(),
  client_email     text not null,
  product_id       uuid references public.biz_products(id) on delete set null,
  product_name     text,
  qty              integer not null check (qty > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  ref              text not null,                                -- chave de idempotência de quem vendeu
  -- QUEM e COMO (revisão 2026-09-30): a agente RESERVA o produto para a cliente buscar e pagar no
  -- balcão. Sem o nome e o contato, a recepção veria "1 creme vendido" sem saber para quem separar.
  -- status: 'reserved' (separado, ainda NÃO pago) | 'paid' | 'cancelled'. Reserva não é receita.
  customer_name    text,
  customer_contact text,
  status           text not null default 'reserved' check (status in ('reserved','paid','cancelled')),
  source           text,
  created_at       timestamptz not null default now(),
  unique (client_email, ref)
);
create index if not exists biz_product_sales_tenant on public.biz_product_sales (client_email, created_at desc);

-- ── RLS: tudo trancado; só as funções SECURITY DEFINER acessam ───────────────
alter table public.biz_products      enable row level security;
alter table public.biz_product_sales enable row level security;

-- ── LISTAR ───────────────────────────────────────────────────────────────────
create or replace function public.product_list(p_secret text, p_email text, p_only_active boolean default true)
returns jsonb
language plpgsql security definer set search_path to public as $$
declare
  v_tenant text := lower(trim(coalesce(p_email,'')));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'brand', p.brand, 'description', p.description,
      'price_cents', p.price_cents, 'stock', p.stock, 'active', p.active,
      'location_id', p.location_id, 'created_at', p.created_at, 'updated_at', p.updated_at
    ) order by lower(p.name))
    from public.biz_products p
    where p.client_email = v_tenant
      and (not coalesce(p_only_active, true) or p.active)
  ), '[]'::jsonb);
end $$;

-- ── CRIAR / ATUALIZAR ────────────────────────────────────────────────────────
-- Sem id → INSERT. Com id → UPDATE só se o id for DESTE tenant; id de outro tenant (ou apagado)
-- levanta `not_found` — nunca vira um INSERT calado nem toca a linha alheia.
-- No UPDATE, chave AUSENTE no jsonb preserva o valor; chave presente com null LIMPA o campo
-- (é assim que `stock: null` desliga o controle de estoque).
-- Erros com nome estável (o endpoint traduz): name_required · name_too_long · price_invalid ·
-- stock_invalid · invalid_location · not_found · duplicate_name.
create or replace function public.product_upsert(p_secret text, p_email text, p_product jsonb)
returns jsonb
language plpgsql security definer set search_path to public as $$
declare
  v_tenant text := lower(trim(coalesce(p_email,'')));
  v_p      jsonb := coalesce(p_product, '{}'::jsonb);
  v_id     uuid;
  v_name   text := nullif(trim(coalesce(v_p->>'name','')),'');
  v_price  integer;
  v_stock  integer;
  v_loc    uuid;
  v_row    public.biz_products%rowtype;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' then raise exception 'unauthorized' using errcode = '28000'; end if;

  v_id := nullif(v_p->>'id','')::uuid;

  if v_name is not null and length(v_name) > 120 then raise exception 'name_too_long' using errcode = '22023'; end if;
  if v_p ? 'price_cents' and v_p->>'price_cents' is not null then
    if (v_p->>'price_cents') !~ '^\d{1,8}$' then raise exception 'price_invalid' using errcode = '22023'; end if;
    v_price := (v_p->>'price_cents')::integer;
    if v_price > 10000000 then raise exception 'price_invalid' using errcode = '22023'; end if;
  end if;
  if v_p ? 'stock' and v_p->>'stock' is not null then
    if (v_p->>'stock') !~ '^\d{1,7}$' then raise exception 'stock_invalid' using errcode = '22023'; end if;
    v_stock := (v_p->>'stock')::integer;
    if v_stock > 1000000 then raise exception 'stock_invalid' using errcode = '22023'; end if;
  end if;
  -- a unidade, se vier, tem que ser DESTE tenant
  if v_p ? 'location_id' and nullif(v_p->>'location_id','') is not null then
    v_loc := (v_p->>'location_id')::uuid;
    if not exists (select 1 from public.biz_locations l where l.id = v_loc and lower(l.client_email) = v_tenant) then
      raise exception 'invalid_location' using errcode = '22023';
    end if;
  end if;

  begin
    if v_id is not null then
      update public.biz_products set
        name        = coalesce(v_name, name),
        brand       = case when v_p ? 'brand'       then nullif(trim(coalesce(v_p->>'brand','')),'')       else brand end,
        description = case when v_p ? 'description' then nullif(trim(coalesce(v_p->>'description','')),'') else description end,
        price_cents = coalesce(v_price, price_cents),
        stock       = case when v_p ? 'stock'       then v_stock else stock end,
        active      = coalesce((v_p->>'active')::boolean, active),
        location_id = case when v_p ? 'location_id' then v_loc   else location_id end,
        updated_at  = now()
      where id = v_id and client_email = v_tenant
      returning * into v_row;
      if v_row.id is null then raise exception 'not_found' using errcode = 'P0002'; end if;
    else
      if v_name  is null then raise exception 'name_required' using errcode = '22023'; end if;
      if v_price is null then raise exception 'price_invalid' using errcode = '22023'; end if;
      insert into public.biz_products (client_email, name, brand, description, price_cents, stock, active, location_id)
      values (
        v_tenant, v_name,
        nullif(trim(coalesce(v_p->>'brand','')),''),
        nullif(trim(coalesce(v_p->>'description','')),''),
        v_price, v_stock,
        coalesce((v_p->>'active')::boolean, true),
        v_loc
      )
      returning * into v_row;
    end if;
  exception when unique_violation then
    raise exception 'duplicate_name' using errcode = '23505';
  end;

  return to_jsonb(v_row);
end $$;

-- ── APAGAR ───────────────────────────────────────────────────────────────────
-- Tenant-bound: o DELETE casa (client_email, id). As vendas já registradas ficam (product_id → NULL).
create or replace function public.product_delete(p_secret text, p_email text, p_id uuid)
returns boolean
language plpgsql security definer set search_path to public as $$
declare
  v_tenant text := lower(trim(coalesce(p_email,'')));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  delete from public.biz_products where id = p_id and client_email = v_tenant;
  return found;
end $$;

-- ── REGISTRAR VENDA (e baixar estoque, na MESMA transação) ───────────────────
-- Idempotente por (tenant, p_ref): a segunda chamada com o mesmo ref não muda NADA e devolve
-- { ok:true, duplicate:true } com a venda original. Estoque controlado insuficiente → recusa
-- { ok:false, reason:'out_of_stock', stock } sem gravar venda nenhuma.
-- Ordem que fecha as corridas:
--   1. trava a linha do produto (FOR UPDATE) — duas vendas do mesmo produto entram em fila;
--   2. só DEPOIS da trava confere o ref (uma repetição concorrente espera e enxerga a primeira);
--   3. grava a venda com ON CONFLICT DO NOTHING (o índice único é o juiz final do ref);
--   4. baixa o estoque com a guarda no próprio UPDATE (`stock >= qty`). Se a guarda falhar aqui,
--      levanta exceção e a venda do passo 3 é desfeita junto — nunca venda sem baixa.
create or replace function public.product_sale_record(p_secret text, p_email text, p_product_id uuid, p_qty integer, p_ref text,
  p_customer_name text default null, p_customer_contact text default null, p_status text default 'reserved', p_source text default null)
returns jsonb
language plpgsql security definer set search_path to public as $$
declare
  v_tenant text := lower(trim(coalesce(p_email,'')));
  v_ref    text := nullif(trim(coalesce(p_ref,'')),'');
  v_qty    integer := coalesce(p_qty, 0);
  v_prod   public.biz_products%rowtype;
  v_sale   public.biz_product_sales%rowtype;
  v_left   integer;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_ref is null or length(v_ref) > 200 then return jsonb_build_object('ok', false, 'reason', 'bad_ref'); end if;
  if v_qty < 1 or v_qty > 1000000 then return jsonb_build_object('ok', false, 'reason', 'bad_qty'); end if;

  -- 1. trava o produto DESTE tenant
  select * into v_prod from public.biz_products
   where id = p_product_id and client_email = v_tenant
   for update;

  -- 2. repetição do mesmo ref → devolve a venda original, sem tocar em nada
  select * into v_sale from public.biz_product_sales where client_email = v_tenant and ref = v_ref limit 1;
  if v_sale.id is not null then
    return jsonb_build_object('ok', true, 'duplicate', true, 'sale_id', v_sale.id,
      'product_id', v_sale.product_id, 'name', v_sale.product_name, 'qty', v_sale.qty,
      'unit_price_cents', v_sale.unit_price_cents, 'total_cents', v_sale.unit_price_cents::bigint * v_sale.qty,
      'stock', (select p.stock from public.biz_products p where p.id = v_sale.product_id and p.client_email = v_tenant));
  end if;

  if v_prod.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not v_prod.active then return jsonb_build_object('ok', false, 'reason', 'inactive'); end if;
  if v_prod.stock is not null and v_prod.stock < v_qty then
    return jsonb_build_object('ok', false, 'reason', 'out_of_stock', 'stock', v_prod.stock);
  end if;

  -- 3. grava a venda (foto do nome e do preço de agora)
  insert into public.biz_product_sales (client_email, product_id, product_name, qty, unit_price_cents, ref, customer_name, customer_contact, status, source)
  values (v_tenant, v_prod.id, v_prod.name, v_qty, v_prod.price_cents, v_ref,
          nullif(left(trim(coalesce(p_customer_name,'')), 120), ''), nullif(left(trim(coalesce(p_customer_contact,'')), 160), ''),
          case when p_status in ('reserved','paid') then p_status else 'reserved' end, nullif(left(trim(coalesce(p_source,'')), 40), ''))
  on conflict (client_email, ref) do nothing
  returning * into v_sale;
  if v_sale.id is null then
    -- outra transação gravou este ref entre o passo 2 e aqui (mesmo ref, outro produto)
    select * into v_sale from public.biz_product_sales where client_email = v_tenant and ref = v_ref limit 1;
    return jsonb_build_object('ok', true, 'duplicate', true, 'sale_id', v_sale.id,
      'product_id', v_sale.product_id, 'name', v_sale.product_name, 'qty', v_sale.qty,
      'unit_price_cents', v_sale.unit_price_cents, 'total_cents', v_sale.unit_price_cents::bigint * v_sale.qty,
      'stock', v_prod.stock);
  end if;

  -- 4. baixa atômica, só quando o estoque é controlado
  v_left := null;
  if v_prod.stock is not null then
    update public.biz_products set stock = stock - v_qty, updated_at = now()
     where id = v_prod.id and client_email = v_tenant
       and stock is not null and stock >= v_qty
    returning stock into v_left;
    if not found then raise exception 'stock_guard_failed' using errcode = 'P0001'; end if;
  end if;

  return jsonb_build_object('ok', true, 'duplicate', false, 'sale_id', v_sale.id,
    'product_id', v_prod.id, 'name', v_prod.name, 'qty', v_qty,
    'unit_price_cents', v_prod.price_cents, 'total_cents', v_prod.price_cents::bigint * v_qty,
    'stock', v_left);
end $$;

-- ── VENDAS RECENTES (a tela do painel lê daqui) ──────────────────────────────
-- Lei do `live_desde` (db/live_desde.sql): leitura de histórico do tenant só mostra o que
-- aconteceu da entrada em operação em diante. Sem data marcada, mostra tudo. Esconde, não apaga.
create or replace function public.product_sales_list(p_secret text, p_email text, p_limit integer default 100)
returns jsonb
language plpgsql security definer set search_path to public as $$
declare
  v_tenant text := lower(trim(coalesce(p_email,'')));
  v_lim    integer := least(greatest(coalesce(p_limit, 100), 1), 100);
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', x.id, 'product_id', x.product_id, 'product_name', x.product_name, 'qty', x.qty,
      'unit_price_cents', x.unit_price_cents, 'total_cents', x.unit_price_cents::bigint * x.qty,
      'customer_name', x.customer_name, 'customer_contact', x.customer_contact, 'status', x.status, 'source', x.source,
      'ref', x.ref, 'created_at', x.created_at
    ) order by x.created_at desc)
    from (
      select s.* from public.biz_product_sales s
       where s.client_email = v_tenant
         and s.created_at >= coalesce(public.tenant_live_desde(v_tenant), '-infinity'::timestamptz)
       order by s.created_at desc
       limit v_lim
    ) x
  ), '[]'::jsonb);
end $$;

-- ── PORTAS: só o service_role. anon, authenticated e public não executam nada disto. ─────────
revoke all on function public.product_list(text,text,boolean)                    from public, anon, authenticated;
revoke all on function public.product_upsert(text,text,jsonb)                    from public, anon, authenticated;
revoke all on function public.product_delete(text,text,uuid)                     from public, anon, authenticated;
revoke all on function public.product_sale_record(text,text,uuid,integer,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.product_sales_list(text,text,integer)              from public, anon, authenticated;

grant execute on function public.product_list(text,text,boolean)                  to service_role;
grant execute on function public.product_upsert(text,text,jsonb)                  to service_role;
grant execute on function public.product_delete(text,text,uuid)                   to service_role;
grant execute on function public.product_sale_record(text,text,uuid,integer,text,text,text,text,text) to service_role;
grant execute on function public.product_sales_list(text,text,integer)            to service_role;

notify pgrst, 'reload schema';

-- PROVA (rodar depois do paste, no tenant de teste — NUNCA na conta de um cliente):
--   select public.product_upsert('glo_ing_c7f2a9e4b8d16350','e2e-test@guileoai.com',
--     '{"name":"Creme de teste","brand":"Marca","price_cents":2550,"stock":2}'::jsonb);        -- devolve a linha (guarde o id)
--   select public.product_list('glo_ing_c7f2a9e4b8d16350','e2e-test@guileoai.com', false);
--   select public.product_sale_record('glo_ing_c7f2a9e4b8d16350','e2e-test@guileoai.com','<id>'::uuid, 1, 'prova-1');  -- ok, stock 1
--   select public.product_sale_record('glo_ing_c7f2a9e4b8d16350','e2e-test@guileoai.com','<id>'::uuid, 1, 'prova-1');  -- duplicate:true, stock 1
--   select public.product_sale_record('glo_ing_c7f2a9e4b8d16350','e2e-test@guileoai.com','<id>'::uuid, 5, 'prova-2');  -- out_of_stock, stock 1
--   select public.product_sale_record('glo_ing_c7f2a9e4b8d16350','outro@tenant.com','<id>'::uuid, 1, 'prova-3');       -- not_found (tenant errado)
--   select public.product_sales_list('glo_ing_c7f2a9e4b8d16350','e2e-test@guileoai.com');
--   select public.product_delete('glo_ing_c7f2a9e4b8d16350','e2e-test@guileoai.com','<id>'::uuid);                     -- true; a venda fica
--   delete from public.biz_product_sales where client_email='e2e-test@guileoai.com' and ref like 'prova-%';

-- ── RESERVA → PAGA / CANCELADA (revisão 2026-09-30) ────────────────────────────────────────────
-- A agente reserva; quem fecha é o balcão. `paid` = a cliente buscou e pagou. `cancelled` = não
-- veio buscar: a unidade VOLTA para o estoque (só quando o estoque é controlado e o produto ainda
-- existe). Só sai de 'reserved' — uma venda paga ou cancelada não muda mais (nada de devolver
-- estoque duas vezes). Tudo numa transação, escopado pelo negócio.
create or replace function public.product_sale_set_status(p_secret text, p_email text, p_sale_id uuid, p_status text)
returns jsonb
language plpgsql security definer set search_path to public as $$
declare
  v_tenant text := lower(trim(coalesce(p_email,'')));
  v_sale   public.biz_product_sales%rowtype;
  v_stock  integer;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if p_status not in ('paid','cancelled') then return jsonb_build_object('ok', false, 'reason', 'bad_status'); end if;
  select * into v_sale from public.biz_product_sales where id = p_sale_id and client_email = v_tenant for update;
  if v_sale.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_sale.status <> 'reserved' then return jsonb_build_object('ok', false, 'reason', 'already_closed', 'status', v_sale.status); end if;
  update public.biz_product_sales set status = p_status where id = v_sale.id and client_email = v_tenant;
  if p_status = 'cancelled' and v_sale.product_id is not null then
    update public.biz_products set stock = stock + v_sale.qty, updated_at = now()
     where id = v_sale.product_id and client_email = v_tenant and stock is not null
    returning stock into v_stock;
  end if;
  return jsonb_build_object('ok', true, 'sale_id', v_sale.id, 'status', p_status, 'stock', v_stock);
end $$;
revoke all on function public.product_sale_set_status(text,text,uuid,text) from public, anon, authenticated;
grant execute on function public.product_sale_set_status(text,text,uuid,text) to service_role;
notify pgrst, 'reload schema';
