-- GUILEO DESK v5 — CARTÃO SALVO, TAXA DE FALTA E ASSINATURA DA CLIENTE, no Stripe DO NEGÓCIO (2026-10-05)
-- Aplicado como desk_v5_3_cartao. Só ACRESCENTA; nenhuma função existente muda. Idempotente.
--
-- POR QUÊ NO STRIPE DO NEGÓCIO: a plataforma Stripe da Guileo é BR e não repassa para conta dos EUA.
-- O negócio cola uma chave restrita (stripe_own_save); quem cobra é a conta DELE. Ver ATIVACOES.md
-- "NATURA · Stripe próprio" → permissões extras para cartão salvo, taxa de falta e assinatura.
--
-- PORTA: TODAS as funções daqui são só service_role. Quem chama é /api/desk-pagamentos, que primeiro
-- prova e-mail + chave de conexão (desk_agenda) e só então chama com p_tenant = o e-mail provado;
-- e /api/sinal-pago + /api/sinal-reconcile, que só gravam o que a SESSÃO do Stripe (lida com a chave
-- do negócio) diz. Nada daqui é alcançável pelo navegador. UUID sozinho nunca autoriza: toda escrita
-- confere client_email.
--
-- O QUE NUNCA SAI DAQUI PARA O NAVEGADOR: cus_… e pm_… (o /api/desk-pagamentos devolve só bandeira,
-- 4 últimos dígitos e validade).

-- ═══ TABELAS ═══════════════════════════════════════════════════════════════════════════════════
-- Um cartão por cliente (contact_key = _desk_ck) por negócio. O último salvo vale.
create table if not exists public.desk_saved_cards (
  client_email text not null,
  contact_key text not null,
  stripe_customer_id text not null,
  payment_method_id text not null,
  brand text,
  last4 text,
  exp_month int,
  exp_year int,
  livemode boolean not null default false,       -- cartão de chave rk_test_ não serve para chave rk_live_
  source text not null default 'setup',          -- deposit | setup | membership
  session_id text,
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (client_email, contact_key)
);
alter table public.desk_saved_cards enable row level security;
revoke all on table public.desk_saved_cards from anon, authenticated;

-- Sessões do Checkout que NÃO são sinal (salvar cartão, assinatura) — para a conferência de hora em
-- hora pegar quem pagou e fechou a aba antes de voltar.
create table if not exists public.desk_stripe_sessions (
  session_id text primary key,
  client_email text not null,
  kind text not null,                            -- card_setup | membership
  contact text,
  membership_id uuid,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  result jsonb
);
create index if not exists desk_stripe_sessions_pend on public.desk_stripe_sessions (created_at) where done_at is null;
alter table public.desk_stripe_sessions enable row level security;
revoke all on table public.desk_stripe_sessions from anon, authenticated;

-- ═══ CARTÃO SALVO ══════════════════════════════════════════════════════════════════════════════
create or replace function public.desk_card_get_svc(p_tenant text, p_contact text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object('ok', public._desk_ck(p_contact) is not null, 'contact_key', public._desk_ck(p_contact),
    'card', (select jsonb_build_object('customer', c.stripe_customer_id, 'payment_method', c.payment_method_id, 'brand', c.brand,
                    'last4', c.last4, 'exp_month', c.exp_month, 'exp_year', c.exp_year, 'livemode', c.livemode,
                    'source', c.source, 'saved_at', c.saved_at)
               from desk_saved_cards c where c.client_email = lower(trim(p_tenant)) and c.contact_key = public._desk_ck(p_contact)))
$$;

-- p_contact vazio → usa o contato do agendamento (o sinal sabe o agendamento, não o contato).
create or replace function public.desk_card_save_svc(p_tenant text, p_contact text, p_appointment_id uuid, p_card jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := lower(trim(p_tenant)); ck text; cus text := p_card->>'customer'; pm text := p_card->>'payment_method';
begin
  ck := public._desk_ck(nullif(trim(coalesce(p_contact, '')), ''));
  if ck is null and p_appointment_id is not null then
    select public._desk_ck(a.customer_contact) into ck from biz_appointments a where a.id = p_appointment_id and a.client_email = e;
  end if;
  if ck is null then return jsonb_build_object('ok', false, 'reason', 'no_contact'); end if;
  if coalesce(cus, '') !~ '^cus_[A-Za-z0-9]{6,80}$' or coalesce(pm, '') !~ '^(pm|card)_[A-Za-z0-9]{6,80}$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_card');
  end if;
  insert into desk_saved_cards (client_email, contact_key, stripe_customer_id, payment_method_id, brand, last4, exp_month, exp_year, livemode, source, session_id)
  values (e, ck, cus, pm, left(p_card->>'brand', 20), left(regexp_replace(coalesce(p_card->>'last4', ''), '\D', '', 'g'), 4),
          nullif(p_card->>'exp_month', '')::int, nullif(p_card->>'exp_year', '')::int, coalesce((p_card->>'livemode')::boolean, false),
          coalesce(nullif(p_card->>'source', ''), 'setup'), left(p_card->>'session_id', 120))
  on conflict (client_email, contact_key) do update set
    stripe_customer_id = excluded.stripe_customer_id, payment_method_id = excluded.payment_method_id, brand = excluded.brand,
    last4 = excluded.last4, exp_month = excluded.exp_month, exp_year = excluded.exp_year, livemode = excluded.livemode,
    source = excluded.source, session_id = excluded.session_id, saved_at = now(), updated_at = now();
  return jsonb_build_object('ok', true, 'contact_key', ck);
end $$;

-- ═══ TAXA DE FALTA ═════════════════════════════════════════════════════════════════════════════
-- Valor da taxa = CADASTRO do serviço (config.noshow_fee_cents). Nunca do pedido.
create or replace function public.desk_noshow_info_svc(p_tenant text, p_id uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce((select jsonb_build_object('ok', true, 'id', a.id, 'status', a.status, 'customer_name', a.customer_name,
            'customer_contact', a.customer_contact, 'start', lower(a.span), 'service', s.name,
            'fee_cents', coalesce((s.config->>'noshow_fee_cents')::int, 0),
            'fee', a.attributes->'noshow_fee',
            'charged', coalesce(a.attributes->'noshow_fee'->>'status', '') = 'paid',
            'card', (select jsonb_build_object('customer', c.stripe_customer_id, 'payment_method', c.payment_method_id, 'brand', c.brand,
                            'last4', c.last4, 'livemode', c.livemode)
                       from desk_saved_cards c where c.client_email = a.client_email and c.contact_key = public._desk_ck(a.customer_contact)))
          from biz_appointments a left join biz_services s on s.id = a.service_id
         where a.id = p_id and a.client_email = lower(trim(p_tenant))),
         jsonb_build_object('ok', false, 'reason', 'not_found'))
$$;

-- Grava o resultado da cobrança no agendamento. Um 'paid' nunca é sobrescrito por uma tentativa pior.
create or replace function public.desk_noshow_fee_mark_svc(p_tenant text, p_id uuid, p_result jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  update biz_appointments set attributes = coalesce(attributes, '{}'::jsonb) || jsonb_build_object('noshow_fee',
           coalesce(p_result, '{}'::jsonb) || jsonb_build_object('at', now()))
   where id = p_id and client_email = lower(trim(p_tenant))
     and (coalesce(attributes->'noshow_fee'->>'status', '') <> 'paid' or coalesce(p_result->>'status', '') = 'paid');
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n = 1);
end $$;

-- ═══ SESSÕES PENDENTES (salvar cartão, assinatura) ═════════════════════════════════════════════
create or replace function public.desk_stripe_session_add_svc(p_tenant text, p_session text, p_kind text, p_contact text, p_membership_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(p_session, '') !~ '^cs_(live|test)_[A-Za-z0-9]{10,200}$' or p_kind not in ('card_setup', 'membership') then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if p_membership_id is not null and not exists (select 1 from memberships m where m.id = p_membership_id and m.client_email = lower(trim(p_tenant))) then
    return jsonb_build_object('ok', false, 'reason', 'membership_not_found');
  end if;
  insert into desk_stripe_sessions (session_id, client_email, kind, contact, membership_id)
  values (p_session, lower(trim(p_tenant)), p_kind, left(p_contact, 160), p_membership_id)
  on conflict (session_id) do nothing;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.desk_stripe_session_done_svc(p_tenant text, p_session text, p_result jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  update desk_stripe_sessions set done_at = now(), result = p_result
   where session_id = p_session and client_email = lower(trim(p_tenant)) and done_at is null;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'updated', n);
end $$;

create or replace function public.desk_stripe_pending_svc()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('tenant', s.client_email, 'session', s.session_id, 'kind', s.kind) order by s.created_at), '[]'::jsonb)
    from desk_stripe_sessions s
   where s.done_at is null and s.created_at > now() - interval '3 days'
     and exists (select 1 from client_integrations i where i.client_email = s.client_email and i.provider = 'stripe_own')
$$;

-- ═══ ASSINATURA DA CLIENTE (reusa memberships / membership_subscribers) ═════════════════════════
create or replace function public.desk_membership_list_svc(p_tenant text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'price_cents', m.price_cents,
           'interval', case when m.interval = 'year' then 'year' else 'month' end, 'perks', m.perks,
           'subscribers', (select count(*) from membership_subscribers ms where ms.membership_id = m.id and ms.status = 'active'))
           order by m.created_at), '[]'::jsonb)
    from memberships m where m.client_email = lower(trim(p_tenant)) and coalesce(m.active, true)
$$;

-- Assinatura confirmada pela sessão do Stripe. A assinatura TEM de ser deste negócio; uma por stripe_sub_id.
create or replace function public.desk_membership_record_svc(p_tenant text, p_membership_id uuid, p_contact text, p_sub_id text, p_status text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := lower(trim(p_tenant)); v uuid; st text := case when p_status in ('active', 'trialing') then 'active' else coalesce(nullif(left(p_status, 20), ''), 'active') end;
begin
  if not exists (select 1 from memberships m where m.id = p_membership_id and m.client_email = e) then
    return jsonb_build_object('ok', false, 'reason', 'membership_not_found');
  end if;
  if coalesce(p_sub_id, '') !~ '^sub_[A-Za-z0-9]{6,80}$' then return jsonb_build_object('ok', false, 'reason', 'invalid_subscription'); end if;
  perform pg_advisory_xact_lock(hashtext('desk_membership:' || p_sub_id));
  select id into v from membership_subscribers where stripe_sub_id = p_sub_id and client_email = e limit 1;
  if v is not null then
    update membership_subscribers set status = st where id = v;
    return jsonb_build_object('ok', true, 'id', v, 'new', false);
  end if;
  insert into membership_subscribers (client_email, membership_id, contact, status, stripe_sub_id)
  values (e, p_membership_id, nullif(left(trim(coalesce(p_contact, '')), 160), ''), st, p_sub_id) returning id into v;
  return jsonb_build_object('ok', true, 'id', v, 'new', true);
end $$;

-- ═══ PORTA: só service_role ════════════════════════════════════════════════════════════════════
do $g$
declare f text;
begin
  foreach f in array array[
    'desk_card_get_svc(text,text)', 'desk_card_save_svc(text,text,uuid,jsonb)',
    'desk_noshow_info_svc(text,uuid)', 'desk_noshow_fee_mark_svc(text,uuid,jsonb)',
    'desk_stripe_session_add_svc(text,text,text,text,uuid)', 'desk_stripe_session_done_svc(text,text,jsonb)', 'desk_stripe_pending_svc()',
    'desk_membership_list_svc(text)', 'desk_membership_record_svc(text,uuid,text,text,text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $g$;
