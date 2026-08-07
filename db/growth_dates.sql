-- ============================================================================
-- GUILEO · MOTOR DE DATAS + ALAVANCAS DE CRESCIMENTO (paste TUDO no SQL Editor → RUN).
-- Project ynihodbknhjirkdogxby (smart@guileoai.com). ADITIVO + idempotente: pode rodar
-- de novo, não quebra nada. Tese: "motor de crescimento PERSONALIZADO" — cada negócio
-- com seu próprio Gui que NÃO esquece de nenhuma data e enche a agenda sozinho.
--
-- O que este arquivo liga (backend já wired; vira no-op gracioso até o paste):
--   1) DATAS — aniversário do cliente (crm_contacts.birth_date) + datas comemorativas
--      por-cliente (biz_marketing_dates: Dia das Mães, Natal, Black Friday…) que DISPARAM
--      marketing, não só fecham o calendário. Dedup atômico via biz_marketing_sent.
--   2) REBOOKING — depois de um serviço concluído, convida pra próxima (cadência por serviço).
--   3) WAITLIST AUTO-FILL — no cancelamento, oferece a vaga pro próximo da lista de espera.
--   4) SLOW-DAY PROMO — dia com baixa ocupação nas próximas 48-72h → flash promo (OPT-IN).
--
-- GATES (dois segredos, como no resto do banco):
--   • INGEST literal 'glo_ing_c7f2a9e4b8d16350'  → RPCs de datas/marketing/opt-in (grant anon).
--   • _gui_sched_ok('gss_Kp9mX4vR2tZ7nQ5wL8bc')   → RPCs que tocam agenda (biz_*): rebook/waitlist/slow-day.
-- ============================================================================

-- ── 1a) ANIVERSÁRIO no contato (a tabela que crm_upsert_contact escreve) ─────
alter table if exists public.crm_contacts add column if not exists birth_date date;
create index if not exists crm_contacts_tenant_birthmd
  on public.crm_contacts (client_email, (extract(month from birth_date)::int), (extract(day from birth_date)::int))
  where birth_date is not null;

-- ── 1b) DATAS COMEMORATIVAS por-cliente (configuráveis no cockpit) ───────────
create table if not exists public.biz_marketing_dates (
  id           uuid primary key default gen_random_uuid(),
  client_email text not null,
  kind         text not null default 'holiday'          -- 'birthday' | 'holiday' | 'anniversary'
                 check (kind in ('birthday','holiday','anniversary')),
  label        text,                                     -- "Dia das Mães", "Black Friday", "Natal"
  month        int  not null check (month between 1 and 12),
  day          int  not null check (day   between 1 and 31),
  message      text,                                     -- corpo da mensagem que o Gui manda
  offer        text,                                     -- "20% no primeiro serviço", "brinde", etc.
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists idx_biz_mkt_dates_md on public.biz_marketing_dates (client_email, month, day) where active;
alter table public.biz_marketing_dates enable row level security;   -- trancado; só SECURITY DEFINER lê

-- ── 1c) DEDUP atômico — "já mandei isto?" (padrão drip_claim/silent_claim) ───
-- PK (client_email, kind, ref, period). Um INSERT ON CONFLICT DO NOTHING race-safe:
-- se dois runs colidem, exatamente um leva a linha → true; o outro → false (não manda).
create table if not exists public.biz_marketing_sent (
  client_email text not null,
  kind         text not null,          -- 'birthday' | 'holiday' | 'anniversary' | 'rebook' | 'slowday' | 'waitlist'
  ref          text not null,          -- o "o quê": id da data / id do contato / id do agendamento
  period       text not null,          -- o "quando/pra quem": ano, ano:contato, etc.
  sent_at      timestamptz not null default now(),
  primary key (client_email, kind, ref, period)
);
alter table public.biz_marketing_sent enable row level security;

create or replace function public.marketing_date_claim(
  p_secret text, p_client_email text, p_kind text, p_ref text, p_period text
) returns boolean language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  insert into biz_marketing_sent (client_email, kind, ref, period)
  values (lower(trim(p_client_email)), lower(trim(p_kind)), coalesce(nullif(trim(p_ref),''),'-'), coalesce(nullif(trim(p_period),''),'-'))
  on conflict (client_email, kind, ref, period) do nothing
  returning client_email into v_email;
  return v_email is not null;
end $$;

-- ── 1d) CRUD das datas comemorativas (cockpit gerencia) — INGEST-gated ───────
create or replace function public.marketing_dates_set(
  p_secret text, p_client_email text, p_kind text, p_label text,
  p_month int, p_day int, p_message text default null, p_offer text default null,
  p_active boolean default true, p_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_kind text := lower(coalesce(nullif(trim(p_kind),''),'holiday'));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_kind not in ('birthday','holiday','anniversary') then v_kind := 'holiday'; end if;
  if p_month is null or p_month < 1 or p_month > 12 or p_day is null or p_day < 1 or p_day > 31 then
    return jsonb_build_object('ok', false, 'reason', 'bad_date');
  end if;
  if p_id is not null then
    update biz_marketing_dates set
      kind = v_kind, label = nullif(trim(coalesce(p_label,'')),''), month = p_month, day = p_day,
      message = nullif(trim(coalesce(p_message,'')),''), offer = nullif(trim(coalesce(p_offer,'')),''),
      active = coalesce(p_active, true)
    where id = p_id and client_email = lower(trim(p_client_email))
    returning id into v_id;
    if v_id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  else
    insert into biz_marketing_dates (client_email, kind, label, month, day, message, offer, active)
    values (lower(trim(p_client_email)), v_kind, nullif(trim(coalesce(p_label,'')),''), p_month, p_day,
            nullif(trim(coalesce(p_message,'')),''), nullif(trim(coalesce(p_offer,'')),''), coalesce(p_active, true))
    returning id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.marketing_dates_list(p_secret text, p_client_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'kind', kind, 'label', label, 'month', month, 'day', day,
      'message', message, 'offer', offer, 'active', active
    ) order by month, day), '[]'::jsonb)
    into v from biz_marketing_dates where client_email = lower(trim(p_client_email));
  return jsonb_build_object('dates', coalesce(v, '[]'::jsonb));
end $$;

create or replace function public.marketing_dates_delete(p_secret text, p_client_email text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  delete from biz_marketing_dates where id = p_id and client_email = lower(trim(p_client_email));
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n > 0);
end $$;

-- Datas ATIVAS que caem HOJE (mês/dia = hoje, UTC) — o sweep diário lê daqui.
create or replace function public.marketing_dates_today(p_secret text, p_client_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb; d date := (now() at time zone 'UTC')::date;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'kind', kind, 'label', label, 'message', message, 'offer', offer
    )), '[]'::jsonb)
    into v from biz_marketing_dates
    where client_email = lower(trim(p_client_email)) and active
      and month = extract(month from d)::int and day = extract(day from d)::int;
  return jsonb_build_object('dates', coalesce(v, '[]'::jsonb));
end $$;

-- ── 1e) LEITURAS de contatos p/ o sweep de marketing (INGEST-gated) ──────────
-- Contatos com ANIVERSÁRIO hoje (mês/dia = hoje, UTC) — só os que dá pra alcançar (têm email).
create or replace function public.crm_birthday_contacts(p_secret text, p_client_email text, p_limit int default 200)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb; d date := (now() at time zone 'UTC')::date;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'name', full_name, 'email', email, 'phone', phone
    )), '[]'::jsonb)
    into v from (
      select id, full_name, email, phone from crm_contacts
      where client_email = lower(trim(p_client_email)) and birth_date is not null
        and extract(month from birth_date)::int = extract(month from d)::int
        and extract(day   from birth_date)::int = extract(day   from d)::int
      order by last_seen_at desc
      limit greatest(1, least(coalesce(p_limit,200), 1000))
    ) t;
  return jsonb_build_object('contacts', coalesce(v, '[]'::jsonb));
exception when undefined_table or undefined_column then
  return jsonb_build_object('contacts', '[]'::jsonb);   -- crm_spine/birth_date não pasteado ainda → no-op
end $$;

-- Destinatários de um "blast" (datas comemorativas / slow-day): contatos com email, vistos nos
-- últimos p_days dias (recentes o suficiente pra não ser spam a base morta). Segmento simples.
create or replace function public.crm_marketing_recipients(
  p_secret text, p_client_email text, p_days int default 180, p_limit int default 400
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'name', full_name, 'email', email, 'phone', phone, 'lifecycle', lifecycle
    )), '[]'::jsonb)
    into v from (
      select id, full_name, email, phone, lifecycle from crm_contacts
      where client_email = lower(trim(p_client_email))
        and email is not null and email <> ''
        and lifecycle is distinct from 'churned'
        and last_seen_at >= now() - (greatest(coalesce(p_days,180),1) || ' days')::interval
      order by last_seen_at desc
      limit greatest(1, least(coalesce(p_limit,400), 2000))
    ) t;
  return jsonb_build_object('contacts', coalesce(v, '[]'::jsonb));
exception when undefined_table or undefined_column then
  return jsonb_build_object('contacts', '[]'::jsonb);
end $$;

grant execute on function public.marketing_date_claim(text,text,text,text,text) to anon;
grant execute on function public.marketing_dates_set(text,text,text,text,int,int,text,text,boolean,uuid) to anon;
grant execute on function public.marketing_dates_list(text,text) to anon;
grant execute on function public.marketing_dates_delete(text,text,uuid) to anon;
grant execute on function public.marketing_dates_today(text,text) to anon;
grant execute on function public.crm_birthday_contacts(text,text,int) to anon;
grant execute on function public.crm_marketing_recipients(text,text,int,int) to anon;

-- ── 2) REBOOKING — agendamentos concluídos ~cadência atrás, sem próxima marcada ─
-- Cadência por-serviço: biz_services.config->>'rebook_days' (default 28). Só a ÚLTIMA visita
-- concluída de cada contato entra, e só se ele NÃO tem nenhum horário futuro. Janela de captura
-- de 7 dias (rebook_days .. rebook_days+7) — o claim (kind='rebook', ref=appointment_id) garante 1x.
-- Per-tenant (o /api/proactive itera cliente a cliente). SCHED-gated (toca biz_appointments).
create or replace function public.crm_rebook_due(
  p_secret text, p_client_email text, p_default_days int default 28, p_limit int default 100
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb; v_email text := lower(trim(p_client_email)); v_def int := greatest(coalesce(p_default_days,28),1);
begin
  if not public._gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'appointment_id', a.id, 'name', a.customer_name, 'contact', a.customer_contact,
      'service', s.name, 'service_id', a.service_id
    )), '[]'::jsonb)
    into v
    from biz_appointments a
    join biz_services s on s.id = a.service_id
    where a.client_email = v_email
      and a.status <> 'cancelled'
      and a.customer_contact is not null and a.customer_contact <> ''
      and upper(a.span) < now() - (coalesce((s.config->>'rebook_days')::int, v_def) || ' days')::interval
      and upper(a.span) > now() - ((coalesce((s.config->>'rebook_days')::int, v_def) + 7) || ' days')::interval
      -- somente a ÚLTIMA visita concluída daquele contato (não cutuca visitas antigas)
      and a.id = (
        select a2.id from biz_appointments a2
        where a2.client_email = v_email and a2.customer_contact = a.customer_contact
          and a2.status <> 'cancelled' and upper(a2.span) < now()
        order by upper(a2.span) desc limit 1
      )
      -- e apenas se NÃO existe nenhum horário futuro pra esse contato
      and not exists (
        select 1 from biz_appointments f
        where f.client_email = v_email and f.customer_contact = a.customer_contact
          and f.status <> 'cancelled' and upper(f.span) > now()
      )
    limit greatest(1, least(coalesce(p_limit,100), 500));
  return jsonb_build_object('due', coalesce(v, '[]'::jsonb));
exception when undefined_table or undefined_column then
  return jsonb_build_object('due', '[]'::jsonb);
end $$;
grant execute on function public.crm_rebook_due(text,text,int,int) to anon;

-- ── 3) WAITLIST AUTO-FILL — no cancelamento, puxa o próximo da lista de espera ─
-- Lê o serviço/unidade do agendamento cancelado, pega o 1º waitlist não-notificado que casa
-- (mesmo serviço, unidade compatível), marca notified=true (dedup embutido) e devolve os dados
-- pra função HTTP notificar (email/WhatsApp). SCHED-gated. Best-effort: nunca trava o cancel.
create or replace function public.biz_waitlist_fill_on_cancel(
  p_secret text, p_email text, p_appointment_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(p_email)); v_svc uuid; v_loc uuid; v_svc_name text; w record;
begin
  if not public._gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select service_id, location_id into v_svc, v_loc
    from biz_appointments where id = p_appointment_id and client_email = v_email;
  if v_svc is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  select name into v_svc_name from biz_services where id = v_svc;
  select id, contact, name into w
    from biz_waitlist
    where client_email = v_email and service_id = v_svc and not notified
      and (v_loc is null or location_id is null or location_id = v_loc)
    order by created_at asc limit 1;
  if w.id is null then return jsonb_build_object('ok', true, 'filled', false); end if;
  update biz_waitlist set notified = true where id = w.id;
  return jsonb_build_object('ok', true, 'filled', true,
    'contact', w.contact, 'name', w.name, 'service', v_svc_name, 'service_id', v_svc);
exception when undefined_table then
  return jsonb_build_object('ok', true, 'filled', false);  -- waitlist não pasteado ainda → no-op
end $$;
grant execute on function public.biz_waitlist_fill_on_cancel(text,text,uuid) to anon;

-- ── 4) SLOW-DAY PROMO — OPT-IN (default OFF), padrão collections_auto ─────────
-- Flag guardada em client_integrations(provider='slowday_auto'). Sem opt-in → o sweep é no-op.
create or replace function public.slowday_set_auto(p_secret text, p_email text, p_on boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  insert into client_integrations (client_email, provider, tokens)
  values (lower(trim(p_email)), 'slowday_auto', jsonb_build_object('on', case when p_on then '1' else '0' end))
  on conflict (client_email, provider) do update set tokens = excluded.tokens, updated_at = now();
  return true;
end $$;

create or replace function public.slowday_auto_enabled(p_secret text, p_email text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select tokens->>'on' = '1' from client_integrations
    where client_email = lower(trim(p_email)) and provider = 'slowday_auto' limit 1
  ), false);
end $$;

create or replace function public.slowday_auto_list(p_secret text)
returns table(client_email text) language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return query
    select ci.client_email from client_integrations ci
    where ci.provider = 'slowday_auto' and ci.tokens->>'on' = '1';
end $$;

grant execute on function public.slowday_set_auto(text,text,boolean) to anon;
grant execute on function public.slowday_auto_enabled(text,text) to anon;
grant execute on function public.slowday_auto_list(text) to anon;

-- Dias FRACOS nas próximas p_hours horas: por unidade, capacidade (minutos de agenda naquele
-- dia-da-semana) vs minutos já reservados → ocupação. Retorna dias abaixo de p_max_occ, pulando
-- datas fechadas (biz_special_dates). SCHED-gated. O sweep decide encher com uma flash promo.
create or replace function public.slowday_candidates(
  p_secret text, p_email text, p_hours int default 72, p_max_occ numeric default 0.4, p_limit int default 8
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email)); v_days int := greatest(1, ceil(greatest(coalesce(p_hours,72),1)/24.0)::int);
  out_days jsonb := '[]'; cnt int := 0;
  rec record; d date; cap_min int; booked_min int; occ numeric; v_closed boolean;
begin
  if not public._gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  for rec in
    select l.id as loc_id, l.name as loc_name, coalesce(l.tz,'America/New_York') as tz
    from biz_locations l where l.client_email = v_email and l.active
  loop
    for i in 0..v_days loop
      d := (now() at time zone rec.tz)::date + i;
      if ((d::text || ' 23:59')::timestamp at time zone rec.tz) <= now() then continue; end if;  -- dia já passou
      -- data fechada? pula
      v_closed := null;
      begin
        select closed into v_closed from biz_special_dates where client_email = v_email and date = d limit 1;
        if coalesce(v_closed, false) then continue; end if;
      exception when undefined_table then null; end;
      -- capacidade do dia = soma dos minutos de agenda dos pros dessa unidade nesse dia-da-semana
      select coalesce(sum(s.end_min - s.start_min), 0) into cap_min
        from biz_schedules s
        join biz_professionals pr on pr.id = s.pro_id and pr.active
        where pr.client_email = v_email and s.location_id = rec.loc_id
          and s.weekday = extract(dow from d)::int;
      if cap_min <= 0 then continue; end if;   -- unidade não abre nesse dia
      -- minutos já reservados nesse dia (qualquer serviço, não cancelado)
      select coalesce(sum(ceil(extract(epoch from (upper(a.span) - lower(a.span)))/60)::int), 0) into booked_min
        from biz_appointments a
        where a.client_email = v_email and a.location_id = rec.loc_id and a.status <> 'cancelled'
          and (lower(a.span) at time zone rec.tz)::date = d;
      occ := round(booked_min::numeric / cap_min::numeric, 3);
      if occ < coalesce(p_max_occ, 0.4) then
        out_days := out_days || jsonb_build_object(
          'location_id', rec.loc_id, 'location', rec.loc_name, 'day', d, 'tz', rec.tz,
          'booked_min', booked_min, 'capacity_min', cap_min, 'occ', occ);
        cnt := cnt + 1;
        exit when cnt >= greatest(1, least(coalesce(p_limit,8), 30));
      end if;
    end loop;
    exit when cnt >= greatest(1, least(coalesce(p_limit,8), 30));
  end loop;
  return jsonb_build_object('days', out_days);
exception when undefined_table then
  return jsonb_build_object('days', '[]'::jsonb);  -- motor de agenda não pasteado → no-op
end $$;
grant execute on function public.slowday_candidates(text,text,int,numeric,int) to anon;

-- ✅ Pronto. Testes rápidos (troque o email):
--   select marketing_dates_set('glo_ing_c7f2a9e4b8d16350','dono@negocio.com','holiday','Dia das Mães',5,11,'Feliz Dia das Mães 💚','20% em qualquer serviço');
--   select marketing_dates_list('glo_ing_c7f2a9e4b8d16350','dono@negocio.com');
--   select marketing_dates_today('glo_ing_c7f2a9e4b8d16350','dono@negocio.com');
--   select crm_birthday_contacts('glo_ing_c7f2a9e4b8d16350','dono@negocio.com');
--   select crm_rebook_due('gss_Kp9mX4vR2tZ7nQ5wL8bc','dono@negocio.com');
--   select slowday_set_auto('glo_ing_c7f2a9e4b8d16350','dono@negocio.com',true);
--   select slowday_candidates('gss_Kp9mX4vR2tZ7nQ5wL8bc','dono@negocio.com');
