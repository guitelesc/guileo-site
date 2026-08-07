-- ============================================================================
-- PIX DO CLIENTE (tenant collect) — aplicado 2026-08-03
-- migrations: pix_tenant_collect + pix_collect_record_conflict_predicate
--
-- POR QUE: todo o "fecha e cobra" da plataforma era Stripe-only. No Brasil isso é
-- beco sem saída — Stripe Connect mal existe pro pequeno negócio, e ninguém paga
-- serviço local por checkout de redirect: paga PIX copia-e-cola, em 10s, ainda na
-- conversa. Sem isto, todo cliente BR caía em "connect Stripe to collect".
--
-- LEI: este caminho NUNCA credita crédito Guileo. Plano da Guileo e cobrança do
-- cliente são fluxos FISICAMENTE separados (endpoints e RPCs distintos), porque os
-- valores em BRL se parecem (um spa cobra R$799; o plano Essential custa R$799).
-- O external_reference "cli:<tenant>|<pedido>" é a barreira, e o webhook de planos
-- rejeita qualquer ref que comece com "cli:" ANTES de olhar valor — necessário
-- porque "cli:spa@x.com" PASSA num teste ingênuo de e-mail (o ":" é válido antes do @).
--
-- PROVA (2026-08-03): grava 1× e ignora reentrega mesmo com valor diferente
-- (R$123,45 gravado, R$999,99 reentregue → 1 linha, valor intacto); valor 0 recusado;
-- segredo errado → 28000; as 3 RPCs negadas a anon E authenticated.
-- ============================================================================

create or replace function public.mp_tenant_connect(
  p_secret text, p_email text, p_token text, p_label text default ''
) returns boolean
language plpgsql security definer set search_path to 'public'
as $$
begin
  if p_secret <> 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode='28000'; end if;
  if coalesce(trim(p_email),'')='' or coalesce(trim(p_token),'')='' then return false; end if;
  insert into client_integrations (client_email, provider, tokens, updated_at)
  values (lower(trim(p_email)),'mercadopago',
          jsonb_build_object('access_token',trim(p_token),'label',coalesce(p_label,''),'connected_at',now()::text), now())
  on conflict (client_email, provider) do update
    set tokens = client_integrations.tokens || excluded.tokens, updated_at = now();
  return true;
end $$;

create or replace function public.mp_tenant_lookup(p_secret text, p_email text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare v jsonb;
begin
  if p_secret <> 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode='28000'; end if;
  select tokens into v from client_integrations
   where client_email = lower(trim(p_email)) and provider='mercadopago' limit 1;
  if v is null or coalesce(v->>'access_token','')='' then return jsonb_build_object('ready',false); end if;
  return jsonb_build_object('ready',true,'access_token',v->>'access_token','label',coalesce(v->>'label',''));
end $$;

-- Idempotência da receita: índice PARCIAL, e por isso o ON CONFLICT abaixo repete o
-- predicado (sem isso o Postgres não casa o índice — erro 42P10).
create unique index if not exists client_revenue_tenant_ref_uidx
  on client_revenue (client_email, ref) where ref is not null;

create or replace function public.pix_collect_record(
  p_secret text, p_email text, p_ref text, p_amount_cents bigint, p_meta jsonb default '{}'::jsonb
) returns boolean language plpgsql security definer set search_path to 'public'
as $$
declare v_new integer := 0;
begin
  if p_secret <> 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode='28000'; end if;
  if coalesce(trim(p_email),'')='' or coalesce(trim(p_ref),'')='' then return false; end if;
  if coalesce(p_amount_cents,0) <= 0 then return false; end if;
  insert into client_revenue (client_email, ts, category, amount_cents, currency, settled, source, ref, meta)
  values (lower(trim(p_email)), now(), 'sale', p_amount_cents, 'BRL', true, 'pix', trim(p_ref), coalesce(p_meta,'{}'::jsonb))
  on conflict (client_email, ref) where ref is not null do nothing;
  get diagnostics v_new = row_count;
  return v_new > 0;
end $$;

revoke all on function public.mp_tenant_connect(text,text,text,text) from public, anon, authenticated;
revoke all on function public.mp_tenant_lookup(text,text)            from public, anon, authenticated;
revoke all on function public.pix_collect_record(text,text,text,bigint,jsonb) from public, anon, authenticated;
notify pgrst, 'reload schema';
