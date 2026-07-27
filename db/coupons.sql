-- ============================================================================
-- Guileo · CUPONS + CAMPANHAS  (paste in Supabase → SQL Editor → Run)
-- Project: ynihodbknhjirkdogxby (smart@guileoai.com)
-- THESIS: "motor de crescimento PERSONALIZADO" — cada cliente (ou o vendedor dele)
-- cria cupons/promos/campanhas do próprio painel, com a SUA marca (logo/cor/nome).
-- Este arquivo é o LADO DADOS: 3 tabelas + RPCs. Tudo INGEST-gated (mesmo literal
-- que o pipeline de ingest / crm usa), security definer, granted to anon. RLS on,
-- SEM policies para anon (só as funções SECURITY DEFINER acessam). Client-scoped por
-- p_client_email — nenhum tenant enxerga cupons/campanhas de outro.
-- Idempotente (pode rodar de novo).
-- ============================================================================

-- ── TABELAS ─────────────────────────────────────────────────────────────────
create table if not exists public.coupons (
  id              uuid primary key default gen_random_uuid(),
  client_email    text not null,
  code            text not null,
  kind            text not null default 'percent',          -- bogo | percent | amount | freebie
  value           numeric,                                   -- % (percent) | $ (amount) | null
  label           text,                                      -- "20% OFF", "Compre 1 Leve 2"…
  terms           text,
  active          boolean not null default true,
  starts_at       timestamptz,
  expires_at      timestamptz,
  max_redemptions int,                                       -- null = ilimitado
  redeemed        int not null default 0,
  created_at      timestamptz not null default now()
);
-- um código vivo por (tenant, CÓDIGO em maiúsculas)
create unique index if not exists coupons_tenant_code on public.coupons (client_email, upper(code));
create index if not exists coupons_tenant_active on public.coupons (client_email, created_at desc);

create table if not exists public.coupon_redemptions (
  id           uuid primary key default gen_random_uuid(),
  coupon_id    uuid,
  client_email text,
  contact      text,                                         -- email/telefone de quem resgatou
  redeemed_at  timestamptz not null default now()
);
create index if not exists coupon_redemptions_coupon on public.coupon_redemptions (coupon_id, redeemed_at desc);

create table if not exists public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  client_email  text not null,
  name          text,
  kind          text,                                        -- promo | news | coupon
  audience      text,                                        -- all | active | lapsed | vip | loyal | leads
  template      text,                                        -- promo | coupon | news (qual builder branded usar)
  subject       text,
  body          text,
  coupon_id     uuid,
  status        text not null default 'draft',               -- draft | scheduled | sent
  scheduled_at  timestamptz,
  sent_count    int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists campaigns_tenant on public.campaigns (client_email, created_at desc);

-- ── RLS: tudo trancado; só as funções SECURITY DEFINER acessam ───────────────
alter table public.coupons            enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.campaigns          enable row level security;

-- ── CUPONS ───────────────────────────────────────────────────────────────────

-- upsert (cria ou atualiza pelo id do jsonb, se vier). Retorna o id.
create or replace function public.coupon_upsert(p_secret text, p_client_email text, p_coupon jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_client_email));
  v_id     uuid := nullif(p_coupon->>'id','')::uuid;
  v_code   text := nullif(trim(coalesce(p_coupon->>'code','')),'');
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_code is null then raise exception 'code required'; end if;
  if v_id is not null then
    update public.coupons set
      code            = v_code,
      kind            = coalesce(nullif(p_coupon->>'kind',''), kind),
      value           = coalesce((p_coupon->>'value')::numeric, value),
      label           = coalesce(p_coupon->>'label', label),
      terms           = coalesce(p_coupon->>'terms', terms),
      active          = coalesce((p_coupon->>'active')::boolean, active),
      starts_at       = coalesce((p_coupon->>'starts_at')::timestamptz, starts_at),
      expires_at      = coalesce((p_coupon->>'expires_at')::timestamptz, expires_at),
      max_redemptions = coalesce((p_coupon->>'max_redemptions')::int, max_redemptions)
    where id = v_id and client_email = v_tenant;
    return v_id;
  end if;
  insert into public.coupons (client_email, code, kind, value, label, terms, active, starts_at, expires_at, max_redemptions)
  values (
    v_tenant, v_code,
    coalesce(nullif(p_coupon->>'kind',''),'percent'),
    (p_coupon->>'value')::numeric,
    p_coupon->>'label',
    p_coupon->>'terms',
    coalesce((p_coupon->>'active')::boolean, true),
    (p_coupon->>'starts_at')::timestamptz,
    (p_coupon->>'expires_at')::timestamptz,
    (p_coupon->>'max_redemptions')::int
  )
  on conflict (client_email, upper(code)) do update set
    kind            = excluded.kind,
    value           = excluded.value,
    label           = excluded.label,
    terms           = excluded.terms,
    active          = excluded.active,
    starts_at       = excluded.starts_at,
    expires_at      = excluded.expires_at,
    max_redemptions = excluded.max_redemptions
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.coupon_list(p_secret text, p_client_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'code', code, 'kind', kind, 'value', value, 'label', label, 'terms', terms,
      'active', active, 'starts_at', starts_at, 'expires_at', expires_at,
      'max_redemptions', max_redemptions, 'redeemed', redeemed, 'created_at', created_at
    ) order by created_at desc)
    from public.coupons where client_email = lower(trim(p_client_email))
  ), '[]'::jsonb);
end $$;

create or replace function public.coupon_delete(p_secret text, p_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  delete from public.coupons where id = p_id;
  return found;
end $$;

-- valida um código para um tenant → {valid, coupon}. Checa active + janela + limite.
create or replace function public.coupon_validate(p_secret text, p_client_email text, p_code text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select * into v from public.coupons
    where client_email = lower(trim(p_client_email))
      and upper(code) = upper(trim(coalesce(p_code,'')))
    limit 1;
  if v.id is null then return jsonb_build_object('valid', false, 'reason', 'not_found'); end if;
  if not v.active then return jsonb_build_object('valid', false, 'reason', 'inactive', 'coupon', to_jsonb(v)); end if;
  if v.starts_at is not null and now() < v.starts_at then return jsonb_build_object('valid', false, 'reason', 'not_started', 'coupon', to_jsonb(v)); end if;
  if v.expires_at is not null and now() > v.expires_at then return jsonb_build_object('valid', false, 'reason', 'expired', 'coupon', to_jsonb(v)); end if;
  if v.max_redemptions is not null and v.redeemed >= v.max_redemptions then return jsonb_build_object('valid', false, 'reason', 'exhausted', 'coupon', to_jsonb(v)); end if;
  return jsonb_build_object('valid', true, 'coupon', to_jsonb(v));
end $$;

-- resgate ATÔMICO: incrementa redeemed só se abaixo do limite (guarda no UPDATE),
-- registra a redemption e devolve {ok:true, redeemed, coupon} — ou {ok:false, reason}.
create or replace function public.coupon_redeem(p_secret text, p_id uuid, p_contact text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v record;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  -- atomic gate: só incrementa quando ativo, dentro da janela e sob o limite.
  update public.coupons set redeemed = redeemed + 1
    where id = p_id
      and active
      and (starts_at is null or now() >= starts_at)
      and (expires_at is null or now() <= expires_at)
      and (max_redemptions is null or redeemed < max_redemptions)
    returning * into v;
  if v.id is null then
    -- descobre o porquê (best-effort) sem reabrir corrida.
    select * into v from public.coupons where id = p_id limit 1;
    if v.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
    if not v.active then return jsonb_build_object('ok', false, 'reason', 'inactive'); end if;
    if v.expires_at is not null and now() > v.expires_at then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
    if v.max_redemptions is not null and v.redeemed >= v.max_redemptions then return jsonb_build_object('ok', false, 'reason', 'exhausted'); end if;
    return jsonb_build_object('ok', false, 'reason', 'not_redeemable');
  end if;
  insert into public.coupon_redemptions (coupon_id, client_email, contact)
  values (v.id, v.client_email, nullif(trim(coalesce(p_contact,'')),''));
  return jsonb_build_object('ok', true, 'redeemed', v.redeemed, 'coupon', to_jsonb(v));
end $$;

-- ── CAMPANHAS ────────────────────────────────────────────────────────────────

create or replace function public.campaign_upsert(p_secret text, p_client_email text, p_campaign jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_client_email));
  v_id     uuid := nullif(p_campaign->>'id','')::uuid;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_id is not null then
    update public.campaigns set
      name         = coalesce(p_campaign->>'name', name),
      kind         = coalesce(p_campaign->>'kind', kind),
      audience     = coalesce(p_campaign->>'audience', audience),
      template     = coalesce(p_campaign->>'template', template),
      subject      = coalesce(p_campaign->>'subject', subject),
      body         = coalesce(p_campaign->>'body', body),
      coupon_id    = coalesce(nullif(p_campaign->>'coupon_id','')::uuid, coupon_id),
      status       = coalesce(nullif(p_campaign->>'status',''), status),
      scheduled_at = coalesce((p_campaign->>'scheduled_at')::timestamptz, scheduled_at)
    where id = v_id and client_email = v_tenant;
    return v_id;
  end if;
  insert into public.campaigns (client_email, name, kind, audience, template, subject, body, coupon_id, status, scheduled_at)
  values (
    v_tenant,
    p_campaign->>'name',
    p_campaign->>'kind',
    coalesce(nullif(p_campaign->>'audience',''),'all'),
    p_campaign->>'template',
    p_campaign->>'subject',
    p_campaign->>'body',
    nullif(p_campaign->>'coupon_id','')::uuid,
    coalesce(nullif(p_campaign->>'status',''),'draft'),
    (p_campaign->>'scheduled_at')::timestamptz
  )
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.campaign_list(p_secret text, p_client_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'kind', kind, 'audience', audience, 'template', template,
      'subject', subject, 'body', body, 'coupon_id', coupon_id, 'status', status,
      'scheduled_at', scheduled_at, 'sent_count', sent_count, 'created_at', created_at
    ) order by created_at desc)
    from public.campaigns where client_email = lower(trim(p_client_email))
  ), '[]'::jsonb);
end $$;

create or replace function public.campaign_mark_sent(p_secret text, p_id uuid, p_count int)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  update public.campaigns
     set status = 'sent', sent_count = coalesce(p_count, 0)
   where id = p_id;
  return found;
end $$;

-- resolve a AUDIÊNCIA de uma campanha em uma lista de contatos (email) do tenant.
-- Best-effort + graceful: se crm_contacts não existir ainda, cai pra biz_appointments
-- (customer_contact que pareça email). Segmentos: all|active|lapsed|vip|loyal|leads.
create or replace function public.campaign_audience(p_secret text, p_client_email text, p_segment text, p_limit int default 500)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant text := lower(trim(p_client_email));
  v_seg    text := lower(coalesce(nullif(trim(p_segment),''),'all'));
  v_lim    int  := greatest(1, least(coalesce(p_limit,500), 2000));
  v_out    jsonb := '[]'::jsonb;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode = '28000'; end if;
  begin
    select coalesce(jsonb_agg(jsonb_build_object('name', full_name, 'email', email)), '[]'::jsonb)
      into v_out
      from (
        select full_name, email
          from public.crm_contacts c
          where c.client_email = v_tenant
            and c.email is not null and position('@' in c.email) > 1
            and (
              v_seg = 'all'
              or (v_seg = 'active' and c.lifecycle in ('active','loyal','vip'))
              or (v_seg = 'lapsed' and c.lifecycle in ('lapsed','churned'))
              or (v_seg = 'vip'    and c.lifecycle = 'vip')
              or (v_seg = 'loyal'  and c.lifecycle in ('loyal','vip'))
              or (v_seg = 'leads'  and c.lifecycle = 'lead')
            )
          order by c.last_seen_at desc
          limit v_lim
      ) q;
  exception when undefined_table then
    -- CRM não pasteado ainda → fallback: emails distintos de agendamentos.
    begin
      select coalesce(jsonb_agg(jsonb_build_object('name', customer_name, 'email', customer_contact)), '[]'::jsonb)
        into v_out
        from (
          select distinct on (lower(customer_contact)) customer_name, customer_contact
            from public.biz_appointments
            where client_email = v_tenant
              and customer_contact is not null and position('@' in customer_contact) > 1
            order by lower(customer_contact), created_at desc
            limit v_lim
        ) q;
    exception when undefined_table then v_out := '[]'::jsonb; end;
  end;
  return coalesce(v_out, '[]'::jsonb);
end $$;

-- ── GRANTS (anon; a segurança é o literal INGEST dentro de cada função) ───────
grant execute on function public.coupon_upsert(text,text,jsonb)     to anon;
grant execute on function public.coupon_list(text,text)             to anon;
grant execute on function public.coupon_delete(text,uuid)           to anon;
grant execute on function public.coupon_validate(text,text,text)    to anon;
grant execute on function public.coupon_redeem(text,uuid,text)      to anon;
grant execute on function public.campaign_upsert(text,text,jsonb)   to anon;
grant execute on function public.campaign_list(text,text)           to anon;
grant execute on function public.campaign_mark_sent(text,uuid,int)  to anon;
grant execute on function public.campaign_audience(text,text,text,int) to anon;

-- ✅ Done. /api/coupons chama estas RPCs (cupons + campanhas + audiência branded).
