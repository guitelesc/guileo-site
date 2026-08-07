-- ============================================================================
-- Guileo · GROWTH INTELLIGENCE  (paste in Supabase → SQL Editor → Run)
-- Project: ynihodbknhjirkdogxby (smart@guileoai.com)
-- THESIS: "motor de crescimento PERSONALIZADO" — cada negócio recupera o cliente
-- que quase agendou, sabe quanto vale cada cliente (LTV), de onde eles vêm
-- (atribuição) e o que vem pela frente (forecast). Recorrência é a maior alavanca.
--
-- LADO DADOS: 2 tabelas (booking_intents + intent_recovery_claims) + RPCs de
-- inteligência (LTV / atribuição / forecast) que LEEM crm_contacts + biz_appointments.
-- Tudo INGEST-gated (mesmo literal 'glo_ing_c7f2a9e4b8d16350' que o pipeline de ingest/
-- crm/coupons usa), security definer, granted to anon. RLS on, SEM policies para anon
-- (só as funções SECURITY DEFINER acessam). Client-scoped por p_client_email —
-- nenhum tenant enxerga dados de outro. As leituras de crm_contacts/biz_appointments
-- ficam em blocos EXCEPTION: se a tabela não existir ainda, degrada (0) em vez de 500.
-- Idempotente (pode rodar de novo).
-- ============================================================================

-- ── TABELAS ──────────────────────────────────────────────────────────────────
-- Um "intent" = alguém começou a agendar (abriu o fluxo / o widget capturou contato)
-- mas ainda não fechou. A varredura de recuperação pega os 'started' antigos sem
-- 'completed' e deixa o Gui chamar de volta. Recorrência começa aqui.
create table if not exists public.booking_intents (
  id            uuid primary key default gen_random_uuid(),
  client_email  text not null,                              -- o TENANT (qual negócio)
  contact       text,                                       -- telefone/email de quem tentou agendar
  name          text,
  service       text,
  source        text,                                       -- widget | webchat | call | landing …
  status        text not null default 'started',            -- started | completed | recovered
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);
-- um intent VIVO por (tenant, contato): re-abrir o fluxo atualiza o mesmo started.
create unique index if not exists booking_intents_open
  on public.booking_intents (client_email, contact) where status = 'started' and contact is not null;
create index if not exists booking_intents_tenant on public.booking_intents (client_email, created_at desc);
create index if not exists booking_intents_sweep on public.booking_intents (client_email, status, created_at);

-- Dedup da varredura de recuperação: um claim por intent, então dois sweeps
-- concorrentes (ou dois cron ticks) nunca chamam o mesmo lead duas vezes.
create table if not exists public.intent_recovery_claims (
  intent_id    uuid primary key references public.booking_intents(id) on delete cascade,
  client_email text,
  claimed_at   timestamptz not null default now()
);

alter table public.booking_intents        enable row level security;
alter table public.intent_recovery_claims enable row level security;

-- ── INTENTS ──────────────────────────────────────────────────────────────────

-- START/upsert: marca (ou reabre) um intent 'started' para (tenant, contato).
-- Chamado pelo front-end de agendamento / widget quando o fluxo começa.
create or replace function public.booking_intent_start(
  p_secret text, p_client_email text, p_contact text,
  p_name text default null, p_service text default null, p_source text default 'widget'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_tenant  text := lower(trim(p_client_email));
  v_contact text := nullif(trim(coalesce(p_contact,'')),'');
  v_id      uuid;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' then raise exception 'client_email required'; end if;

  if v_contact is not null then
    -- reabre o intent vivo do mesmo contato (enriquece nome/serviço se vierem)
    select id into v_id from public.booking_intents
      where client_email = v_tenant and contact = v_contact and status = 'started' limit 1;
    if v_id is not null then
      update public.booking_intents set
        name    = coalesce(nullif(trim(coalesce(p_name,'')),''), name),
        service = coalesce(nullif(trim(coalesce(p_service,'')),''), service),
        source  = coalesce(nullif(trim(coalesce(p_source,'')),''), source),
        created_at = now()
        where id = v_id;
      return v_id;
    end if;
  end if;

  insert into public.booking_intents (client_email, contact, name, service, source, status)
    values (v_tenant, v_contact,
            nullif(trim(coalesce(p_name,'')),''),
            nullif(trim(coalesce(p_service,'')),''),
            coalesce(nullif(trim(coalesce(p_source,'')),''),'widget'), 'started')
    returning id into v_id;
  return v_id;
end $$;

-- COMPLETE: o contato fechou o agendamento → marca o intent como completed
-- (por id se vier, senão o started mais recente daquele contato).
create or replace function public.booking_intent_complete(
  p_secret text, p_client_email text, p_contact text default null, p_intent_id uuid default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_tenant  text := lower(trim(p_client_email));
  v_contact text := nullif(trim(coalesce(p_contact,'')),'');
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if p_intent_id is not null then
    update public.booking_intents set status = 'completed', completed_at = now()
      where id = p_intent_id and client_email = v_tenant and status <> 'completed';
    return found;
  end if;
  if v_contact is null then return false; end if;
  update public.booking_intents set status = 'completed', completed_at = now()
    where id = (
      select id from public.booking_intents
        where client_email = v_tenant and contact = v_contact and status = 'started'
        order by created_at desc limit 1
    );
  return found;
end $$;

-- ABANDONED: intents 'started' com > N min sem completar — a fila de recuperação.
create or replace function public.booking_intents_abandoned(
  p_secret text, p_client_email text, p_older_min int default 30, p_limit int default 50
) returns table(
  id uuid, contact text, name text, service text, source text,
  created_at timestamptz, minutes_ago int, claimed boolean
) language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_client_email));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return query
  select bi.id, bi.contact, bi.name, bi.service, bi.source, bi.created_at,
         floor(extract(epoch from (now() - bi.created_at)) / 60.0)::int as minutes_ago,
         (rc.intent_id is not null) as claimed
  from public.booking_intents bi
  left join public.intent_recovery_claims rc on rc.intent_id = bi.id
  where bi.client_email = v_tenant
    and bi.status = 'started'
    and bi.created_at < now() - make_interval(mins => greatest(1, coalesce(p_older_min,30)))
  order by bi.created_at asc
  limit greatest(1, least(coalesce(p_limit,50), 200));
end $$;

-- CLAIM: reivindica um intent para recuperação (dedup). true = eu peguei agora;
-- false = já estava reivindicado (outro sweep pegou). Marca o intent 'recovered'.
create or replace function public.intent_recovery_claim(
  p_secret text, p_client_email text, p_intent_id uuid
) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_client_email)); v_got boolean := false;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  -- só reivindica intents que pertencem ao tenant e ainda estão 'started'
  if not exists (select 1 from public.booking_intents
                   where id = p_intent_id and client_email = v_tenant and status = 'started') then
    return false;
  end if;
  insert into public.intent_recovery_claims (intent_id, client_email)
    values (p_intent_id, v_tenant)
    on conflict (intent_id) do nothing;
  get diagnostics v_got = row_count;
  if v_got then
    update public.booking_intents set status = 'recovered' where id = p_intent_id and client_email = v_tenant;
  end if;
  return v_got;
end $$;

-- ── EXISTÊNCIA DE TENANT (para o endpoint público booking-intent gatekeep) ─────
-- true se o email já aparece em qualquer footprint conhecido (clients / crm_contacts
-- / booking_intents). Impede que randoms encham a tabela para emails inexistentes.
create or replace function public.gi_tenant_known(p_secret text, p_email text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email)); v_hit boolean := false;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' then return false; end if;
  begin
    select exists(select 1 from public.clients where lower(email) = v_tenant) into v_hit;
  exception when others then v_hit := false; end;
  if v_hit then return true; end if;
  begin
    select exists(select 1 from public.crm_contacts where client_email = v_tenant limit 1) into v_hit;
  exception when others then v_hit := false; end;
  if v_hit then return true; end if;
  begin
    select exists(select 1 from public.booking_intents where client_email = v_tenant limit 1) into v_hit;
  exception when others then v_hit := false; end;
  return v_hit;
end $$;

-- ── LTV + ATRIBUIÇÃO + FORECAST ───────────────────────────────────────────────

-- LTV: valor por cliente (top) + agregados. Base = crm_contacts.ltv_cents (o spine já
-- acumula dinheiro). Cruza com receita de agendamentos realizados como sanity-check.
-- Cada leitura de tabela em bloco EXCEPTION → degrada honesto se a tabela não existe.
create or replace function public.crm_ltv(p_secret text, p_client_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant   text := lower(trim(p_client_email));
  v_total    bigint := 0;      -- soma ltv_cents
  v_count    int := 0;         -- nº de contatos
  v_paying   int := 0;         -- contatos com ltv > 0
  v_appt_rev bigint := 0;      -- receita de agendamentos realizados (cross-check)
  v_top      jsonb := '[]'::jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;

  begin
    select coalesce(sum(ltv_cents),0), count(*), count(*) filter (where ltv_cents > 0)
      into v_total, v_count, v_paying
    from public.crm_contacts where client_email = v_tenant;
  exception when others then v_total := 0; v_count := 0; v_paying := 0; end;

  begin
    select coalesce(jsonb_agg(t), '[]'::jsonb) into v_top from (
      select coalesce(nullif(trim(full_name),''), phone, email, 'Cliente') as name,
             lifecycle, visit_count, ltv_cents
      from public.crm_contacts
      where client_email = v_tenant and ltv_cents > 0
      order by ltv_cents desc limit 10
    ) t;
  exception when others then v_top := '[]'::jsonb; end;

  -- receita realizada por agendamento (status pago/realizado no passado) × preço do serviço
  begin
    select coalesce(sum(coalesce(s.price_cents,0)),0) into v_appt_rev
    from public.biz_appointments a
    left join public.biz_services s on s.id = a.service_id
    where a.client_email = v_tenant
      and a.status not in ('cancelled','no_show')
      and upper(a.span) < now();
  exception when others then v_appt_rev := 0; end;

  return jsonb_build_object(
    'total_ltv_cents', v_total,
    'contact_count',   v_count,
    'paying_count',    v_paying,
    'avg_ltv_cents',   case when v_paying > 0 then round(v_total::numeric / v_paying) else 0 end,
    'appt_revenue_cents', v_appt_rev,
    'top', v_top
  );
end $$;

-- ATRIBUIÇÃO: de onde vêm os clientes. Contagem + conversão por lead_source nos
-- últimos N dias (conversão = virou active/loyal/vip). Simples e honesto.
create or replace function public.crm_lead_sources(
  p_secret text, p_client_email text, p_days int default 90
) returns table(source text, total int, converted int, conv_pct int)
language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_client_email)); v_days int := greatest(1, coalesce(p_days,90));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  begin
    return query
    select coalesce(nullif(trim(lead_source),''), 'direto') as source,
           count(*)::int as total,
           count(*) filter (where lifecycle in ('active','loyal','vip'))::int as converted,
           case when count(*) > 0
                then round(100.0 * count(*) filter (where lifecycle in ('active','loyal','vip')) / count(*))::int
                else 0 end as conv_pct
    from public.crm_contacts
    where client_email = v_tenant
      and created_at >= now() - make_interval(days => v_days)
    group by 1
    order by total desc;
  exception when others then return; end;
end $$;

-- FORECAST: próximos 7 dias esperados a partir da média das últimas 4 semanas.
-- bookings esperados = agendamentos (não cancelados) criados nos últimos 28 dias / 4.
-- receita esperada = receita desses agendamentos / 4. Matemática simples e honesta.
create or replace function public.crm_forecast(p_secret text, p_client_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant   text := lower(trim(p_client_email));
  v_bk4w     int := 0;         -- bookings nas últimas 4 semanas
  v_rev4w    bigint := 0;      -- receita nas últimas 4 semanas
  v_upcoming int := 0;         -- já agendados p/ os próximos 7 dias (piso do forecast)
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;

  begin
    select count(*),
           coalesce(sum(coalesce(s.price_cents,0)),0)
      into v_bk4w, v_rev4w
    from public.biz_appointments a
    left join public.biz_services s on s.id = a.service_id
    where a.client_email = v_tenant
      and a.status <> 'cancelled'
      and a.created_at >= now() - interval '28 days';
  exception when others then v_bk4w := 0; v_rev4w := 0; end;

  begin
    select count(*) into v_upcoming
    from public.biz_appointments a
    where a.client_email = v_tenant
      and a.status = 'booked'
      and lower(a.span) >= now()
      and lower(a.span) < now() + interval '7 days';
  exception when others then v_upcoming := 0; end;

  return jsonb_build_object(
    'weeks',              4,
    'bookings_4w',        v_bk4w,
    'revenue_4w_cents',   v_rev4w,
    'expected_bookings_7d', greatest(v_upcoming, round(v_bk4w / 4.0)::int),
    'expected_revenue_7d_cents', round(v_rev4w / 4.0)::bigint,
    'already_booked_7d',  v_upcoming
  );
end $$;

-- ── GRANTS (anon; o gate é o literal INGEST dentro de cada função) ────────────
grant execute on function public.booking_intent_start(text,text,text,text,text,text) to anon;
grant execute on function public.booking_intent_complete(text,text,text,uuid) to anon;
grant execute on function public.booking_intents_abandoned(text,text,int,int) to anon;
grant execute on function public.intent_recovery_claim(text,text,uuid) to anon;
grant execute on function public.gi_tenant_known(text,text) to anon;
grant execute on function public.crm_ltv(text,text) to anon;
grant execute on function public.crm_lead_sources(text,text,int) to anon;
grant execute on function public.crm_forecast(text,text) to anon;

-- ✅ Done. /api/booking-intent grava start/complete; /api/growth-intel lê
-- ltv / sources / forecast / abandoned para o cockpit (aba "Inteligência").
