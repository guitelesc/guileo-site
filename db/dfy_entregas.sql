-- ============================================================================
-- GUILEO · ENTREGAS DONE-FOR-YOU (Website Upgrade + módulos) — cole TUDO no SQL Editor.
-- Projeto ynihodbknhjirkdogxby · conta smart@guileoai.com. Idempotente.
--
-- POR QUE EXISTE (2026-08-21): o Website Upgrade é a única linha de produto cuja
-- entrega NÃO nasce sozinha — site, número, encaminhamento e módulos são trabalho
-- humano. Sem uma lista viva, a venda vira um e-mail perdido e o cliente fica
-- esperando um site que ninguém começou. Aqui cada pagamento vira uma ENTREGA com
-- os passos da ROTA-FECHAMENTO já marcados, e o /admin mostra o que falta.
--
-- SEGURANÇA (padrão da casa): SECURITY DEFINER gated pelo literal INGEST
-- ('glo_ing_c7f2a9e4b8d16350' = env INGEST_SECRET), RLS on SEM policy anon, grant
-- execute to anon (as RPCs são o único acesso). Tudo escopado por client_email.
-- ============================================================================

create table if not exists public.dfy_deliveries (
  id           uuid primary key default gen_random_uuid(),
  client_email text not null,
  produto      text not null,                 -- 'website_upgrade' | 'modulo'
  slug         text,                          -- pulse | voice | quote | ...
  leg          text,                          -- BRAIN | AD | BUILD
  amount_cents integer not null default 0,
  stripe_ref   text unique,                   -- session/invoice id — dedup natural
  status       text not null default 'aberta',-- aberta | entregue | cancelada
  steps        jsonb not null default '{}'::jsonb,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists dfy_deliveries_email_idx  on public.dfy_deliveries (client_email);
create index if not exists dfy_deliveries_status_idx on public.dfy_deliveries (status, created_at desc);
alter table public.dfy_deliveries enable row level security;

-- Os passos vêm da ROTA-FECHAMENTO (IMPLEMENTACAO.md). Guardados como jsonb pra
-- a lista poder crescer sem migração — o /admin desenha o que estiver aqui.
create or replace function public.dfy_default_steps(p_produto text)
returns jsonb language sql immutable as $$
  select case when p_produto = 'website_upgrade' then
    jsonb_build_object(
      'contrato', false, 'cadastro', false, 'numero', false,
      'encaminhamento', false, 'site_no_ar', false, 'painel', false)
  else
    jsonb_build_object('contrato', false, 'configurado', false, 'provado', false)
  end
$$;

-- Nasce a entrega a partir do pagamento. Idempotente por stripe_ref: o webhook da
-- Stripe pode reentregar o mesmo evento sem criar duas entregas.
create or replace function public.dfy_upsert_from_payment(
  p_secret text, p_email text, p_produto text, p_slug text default null,
  p_leg text default null, p_amount_cents integer default 0, p_ref text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized'; end if;
  if coalesce(trim(p_email), '') = '' then raise exception 'email obrigatorio'; end if;

  insert into public.dfy_deliveries (client_email, produto, slug, leg, amount_cents, stripe_ref, steps)
  values (lower(trim(p_email)), coalesce(p_produto, 'modulo'), p_slug, p_leg,
          coalesce(p_amount_cents, 0), nullif(p_ref, ''), public.dfy_default_steps(p_produto))
  on conflict (stripe_ref) do update set updated_at = now()
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.dfy_list(p_secret text, p_status text default null)
returns setof public.dfy_deliveries language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized'; end if;
  return query
    select * from public.dfy_deliveries
    where p_status is null or status = p_status
    order by (status = 'aberta') desc, created_at desc
    limit 200;
end $$;

-- Marca/desmarca um passo. O passo tem que EXISTIR no jsonb — assim um typo no
-- front não inventa etapa nova e some com a lista real.
create or replace function public.dfy_step_set(
  p_secret text, p_id uuid, p_step text, p_done boolean
) returns public.dfy_deliveries language plpgsql security definer set search_path = public as $$
declare v_row public.dfy_deliveries;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized'; end if;
  select * into v_row from public.dfy_deliveries where id = p_id;
  if not found then raise exception 'entrega inexistente'; end if;
  if not (v_row.steps ? p_step) then raise exception 'passo desconhecido: %', p_step; end if;

  update public.dfy_deliveries
     set steps = jsonb_set(steps, array[p_step], to_jsonb(coalesce(p_done, false))),
         -- fecha sozinha quando todo passo está feito: a lista diz a verdade sem
         -- alguém precisar lembrar de marcar "entregue".
         status = case when (select bool_and(value::boolean)
                               from jsonb_each(jsonb_set(steps, array[p_step], to_jsonb(coalesce(p_done, false)))))
                       then 'entregue' else 'aberta' end,
         updated_at = now()
   where id = p_id
   returning * into v_row;
  return v_row;
end $$;

grant execute on function public.dfy_upsert_from_payment(text,text,text,text,text,integer,text) to anon;
grant execute on function public.dfy_list(text,text) to anon;
grant execute on function public.dfy_step_set(text,uuid,text,boolean) to anon;
grant execute on function public.dfy_default_steps(text) to anon;

-- PROVA (rode depois de colar):
--   select public.dfy_upsert_from_payment('glo_ing_c7f2a9e4b8d16350','teste@x.com','website_upgrade',null,'BUILD',50000,'sess_teste');
--   select public.dfy_upsert_from_payment('glo_ing_c7f2a9e4b8d16350','teste@x.com','website_upgrade',null,'BUILD',50000,'sess_teste'); -- mesma linha (idempotente)
--   select id, status, steps from public.dfy_list('glo_ing_c7f2a9e4b8d16350', null);
--   select public.dfy_step_set('glo_ing_c7f2a9e4b8d16350','<id>','cadastro',true);
--   select public.dfy_step_set('glo_ing_c7f2a9e4b8d16350','<id>','inexistente',true); -- deve dar erro
--   delete from public.dfy_deliveries where stripe_ref = 'sess_teste';
