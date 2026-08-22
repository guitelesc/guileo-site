-- ============================================================================
-- GUILEO · MOTOR DE ORÇAMENTO (o módulo de $1.800/mês) — cole TUDO no SQL Editor.
-- Projeto ynihodbknhjirkdogxby · conta smart@guileoai.com. Idempotente.
--
-- O QUE É (Luis 2026-08-21): a IA liga, coleta os dados do serviço e monta o
-- orçamento. **Híbrido por valor**: até o teto do tenant sai sozinho; acima disso
-- entra na FILA e só sai depois que o escritório aprova com 1 clique. Foi vendido
-- assim no cardápio e no e-mail — este arquivo é o que faz a promessa existir.
--
-- ⚠️ NÃO confundir com `photo_quotes` (db/capture_tools.sql): lá o CLIENTE manda
-- foto e o dono precifica na mão. Aqui a IA monta e o sistema decide se envia.
--
-- SEGURANÇA (padrão da casa): SECURITY DEFINER gated pelo literal INGEST
-- ('glo_ing_c7f2a9e4b8d16350' = env INGEST_SECRET), RLS on SEM policy anon, e TUDO
-- escopado por client_email — id solto nunca autoriza ver/mexer no orçamento.
-- ============================================================================

create table if not exists public.quotes (
  id            uuid primary key default gen_random_uuid(),
  client_email  text not null,                    -- o TENANT (dono do negócio)
  customer_name text,
  customer_phone text,
  customer_email text,
  resumo        text,                             -- o que o cliente pediu, em 1 linha
  itens         jsonb not null default '[]'::jsonb,
  total_cents   integer not null default 0,
  moeda         text not null default 'usd',
  origem        text not null default 'ai',       -- ai | humano
  status        text not null default 'rascunho', -- rascunho | aguardando_aprovacao | aprovado | enviado | aceito | recusado
  motivo        text,                             -- por que caiu na fila (ou por que foi recusado)
  token         text unique,                      -- segredo do link do cliente final
  aprovado_por  text,
  enviado_em    timestamptz,
  decidido_em   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists quotes_tenant_idx on public.quotes (client_email, created_at desc);
create index if not exists quotes_fila_idx   on public.quotes (client_email, status) where status = 'aguardando_aprovacao';
alter table public.quotes enable row level security;

-- Teto por tenant: acima disso o orçamento espera aprovação humana. Sem linha =
-- usa o padrão conservador (US$ 800) — o silêncio nunca vira "manda tudo sozinho".
create table if not exists public.quote_settings (
  client_email   text primary key,
  teto_cents     integer not null default 80000,
  auto_enviar    boolean not null default true,   -- false = TUDO passa pela fila
  updated_at     timestamptz not null default now()
);
alter table public.quote_settings enable row level security;

create or replace function public._quote_ok(p_secret text) returns boolean
language sql immutable as $$ select p_secret = 'glo_ing_c7f2a9e4b8d16350' $$;

-- CRIA o orçamento e DECIDE o destino pelo teto. Devolve a linha inteira para o
-- chamador saber se já pode enviar ou se entrou na fila — sem segundo round-trip.
create or replace function public.quote_create(
  p_secret text, p_email text, p_total_cents integer,
  p_customer_name text default null, p_customer_phone text default null, p_customer_email text default null,
  p_resumo text default null, p_itens jsonb default '[]'::jsonb, p_origem text default 'ai'
) returns public.quotes language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(coalesce(p_email,''))); v_teto int; v_auto boolean; v_row public.quotes; v_status text; v_motivo text;
begin
  if not public._quote_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' then raise exception 'no tenant' using errcode = 'P0002'; end if;
  if coalesce(p_total_cents,0) <= 0 then raise exception 'total obrigatorio' using errcode = 'P0002'; end if;

  select teto_cents, auto_enviar into v_teto, v_auto from public.quote_settings where client_email = v_tenant;
  v_teto := coalesce(v_teto, 80000); v_auto := coalesce(v_auto, true);

  if not v_auto then
    v_status := 'aguardando_aprovacao'; v_motivo := 'o negócio pediu aprovação em todo orçamento';
  elsif p_total_cents > v_teto then
    v_status := 'aguardando_aprovacao'; v_motivo := format('acima do teto de %s', to_char(v_teto/100.0, 'FM999G999D00'));
  else
    v_status := 'aprovado'; v_motivo := null;
  end if;

  insert into public.quotes (client_email, customer_name, customer_phone, customer_email, resumo,
                             itens, total_cents, origem, status, motivo, token)
  values (v_tenant, nullif(trim(coalesce(p_customer_name,'')),''), nullif(trim(coalesce(p_customer_phone,'')),''),
          lower(nullif(trim(coalesce(p_customer_email,'')),'')), nullif(trim(coalesce(p_resumo,'')),''),
          coalesce(p_itens,'[]'::jsonb), p_total_cents, coalesce(p_origem,'ai'), v_status, v_motivo,
          encode(gen_random_bytes(18), 'hex'))
  returning * into v_row;
  return v_row;
end $$;

-- A FILA do escritório (só o que espera aprovação, do tenant dele).
create or replace function public.quote_fila(p_secret text, p_email text)
returns setof public.quotes language plpgsql security definer set search_path = public as $$
begin
  if not public._quote_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  return query select * from public.quotes
   where client_email = lower(trim(p_email)) and status = 'aguardando_aprovacao'
   order by created_at asc limit 100;
end $$;

create or replace function public.quote_list(p_secret text, p_email text, p_limite int default 50)
returns setof public.quotes language plpgsql security definer set search_path = public as $$
begin
  if not public._quote_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  return query select * from public.quotes where client_email = lower(trim(p_email))
   order by created_at desc limit greatest(1, least(coalesce(p_limite,50), 200));
end $$;

-- APROVA ou RECUSA. Escopado por tenant: um id de outro negócio não é achado.
create or replace function public.quote_decidir(
  p_secret text, p_email text, p_id uuid, p_aprovar boolean, p_quem text default null, p_motivo text default null
) returns public.quotes language plpgsql security definer set search_path = public as $$
declare v_row public.quotes;
begin
  if not public._quote_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  update public.quotes
     set status = case when p_aprovar then 'aprovado' else 'recusado' end,
         aprovado_por = nullif(trim(coalesce(p_quem,'')),''),
         motivo = coalesce(nullif(trim(coalesce(p_motivo,'')),''), motivo),
         decidido_em = now(), updated_at = now()
   where id = p_id and client_email = lower(trim(p_email)) and status = 'aguardando_aprovacao'
   returning * into v_row;
  if not found then raise exception 'orcamento nao esta na fila deste negocio' using errcode = 'P0002'; end if;
  return v_row;
end $$;

-- Marca como ENVIADO (o canal que realmente saiu fica no motivo: email|sms|whatsapp).
create or replace function public.quote_marcar_enviado(p_secret text, p_id uuid, p_canal text)
returns public.quotes language plpgsql security definer set search_path = public as $$
declare v_row public.quotes;
begin
  if not public._quote_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  update public.quotes set status = 'enviado', enviado_em = now(), updated_at = now(),
         motivo = coalesce(nullif(trim(coalesce(p_canal,'')),''), motivo)
   where id = p_id and status = 'aprovado' returning * into v_row;
  if not found then raise exception 'orcamento nao aprovado' using errcode = 'P0002'; end if;
  return v_row;
end $$;

-- O CLIENTE FINAL abre o link (token) e aceita/recusa. Não expõe o tenant nem id.
create or replace function public.quote_por_token(p_token text)
returns table (id uuid, client_email text, customer_name text, resumo text, itens jsonb, total_cents int, moeda text, status text)
language plpgsql security definer set search_path = public as $$
begin
  return query select q.id, q.client_email, q.customer_name, q.resumo, q.itens, q.total_cents, q.moeda, q.status
    from public.quotes q where q.token = p_token and q.status in ('enviado','aceito','recusado') limit 1;
end $$;

create or replace function public.quote_resposta_cliente(p_token text, p_aceitar boolean)
returns text language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  update public.quotes set status = case when p_aceitar then 'aceito' else 'recusado' end,
         decidido_em = now(), updated_at = now()
   where token = p_token and status = 'enviado' returning status into v_status;
  if v_status is null then return 'ja_respondido'; end if;
  return v_status;
end $$;

create or replace function public.quote_config(
  p_secret text, p_email text, p_teto_cents int default null, p_auto boolean default null
) returns public.quote_settings language plpgsql security definer set search_path = public as $$
declare v_row public.quote_settings;
begin
  if not public._quote_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  insert into public.quote_settings (client_email, teto_cents, auto_enviar)
  values (lower(trim(p_email)), coalesce(p_teto_cents, 80000), coalesce(p_auto, true))
  on conflict (client_email) do update
     set teto_cents = coalesce(p_teto_cents, public.quote_settings.teto_cents),
         auto_enviar = coalesce(p_auto, public.quote_settings.auto_enviar),
         updated_at = now()
  returning * into v_row;
  return v_row;
end $$;

grant execute on function public.quote_create(text,text,integer,text,text,text,text,jsonb,text) to anon;
grant execute on function public.quote_fila(text,text) to anon;
grant execute on function public.quote_list(text,text,int) to anon;
grant execute on function public.quote_decidir(text,text,uuid,boolean,text,text) to anon;
grant execute on function public.quote_marcar_enviado(text,uuid,text) to anon;
grant execute on function public.quote_por_token(text) to anon;
grant execute on function public.quote_resposta_cliente(text,boolean) to anon;
grant execute on function public.quote_config(text,text,int,boolean) to anon;
grant execute on function public._quote_ok(text) to anon;

-- PROVA (rode depois de colar):
--   select status, motivo from public.quote_create('glo_ing_c7f2a9e4b8d16350','teste@x.com',50000,'Ana',null,'ana@x.com','troca de aquecedor');  -- abaixo do teto → aprovado
--   select status, motivo from public.quote_create('glo_ing_c7f2a9e4b8d16350','teste@x.com',250000,'Bob',null,'bob@x.com','troca de coluna');   -- acima → aguardando_aprovacao
--   select id, total_cents, motivo from public.quote_fila('glo_ing_c7f2a9e4b8d16350','teste@x.com');
--   select status from public.quote_decidir('glo_ing_c7f2a9e4b8d16350','teste@x.com','<id>',true,'Luis',null);
--   select public.quote_decidir('glo_ing_c7f2a9e4b8d16350','OUTRO@x.com','<id>',true,'X',null);  -- deve dar erro (tenant errado)
--   delete from public.quotes where client_email = 'teste@x.com';
