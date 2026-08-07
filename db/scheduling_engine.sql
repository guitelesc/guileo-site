-- ============================================================================
-- GUILEO · MOTOR DE AGENDA (scheduling engine)  — cole TUDO no SQL Editor e RUN.
-- Idempotente (pode rodar de novo). Dá ao Gui o "saber" (unidades, profissionais,
-- serviços, horários) e o "decidir" (slots livres reais, sem furar / sem duplo).
--
-- SEGURANÇA: as funções são SECURITY DEFINER e EXIGEM um segredo dedicado guardado
-- numa GUC do banco. FECHADAS por padrão: sem a GUC certa, retornam 'unauthorized'.
-- >>> RODE ESTA LINHA UMA VEZ (já vem com o valor certo) para LIGAR o motor: <<<
--     alter database postgres set app.gui_sched_secret = 'gss_Kp9mX4vR2tZ7nQ5wL8bc';
-- (Esse mesmo valor está no segredo SCHED_SECRET da Cloudflare, que o Gui usa.)
-- ============================================================================

create extension if not exists btree_gist;

-- ── TABELAS ────────────────────────────────────────────────────────────────
create table if not exists biz_locations (
  id uuid primary key default gen_random_uuid(),
  client_email text not null, name text not null,
  address text, city text, phone text,
  tz text not null default 'America/New_York',
  active boolean not null default true, created_at timestamptz not null default now()
);
create index if not exists idx_biz_locations_email on biz_locations(client_email) where active;

create table if not exists biz_professionals (
  id uuid primary key default gen_random_uuid(),
  client_email text not null, name text not null, title text,
  active boolean not null default true, created_at timestamptz not null default now()
);
create index if not exists idx_biz_pros_email on biz_professionals(client_email) where active;

create table if not exists biz_services (
  id uuid primary key default gen_random_uuid(),
  client_email text not null, name text not null,
  duration_min int not null default 30, price_cents int,
  active boolean not null default true, created_at timestamptz not null default now()
);
create index if not exists idx_biz_services_email on biz_services(client_email) where active;

create table if not exists biz_pro_services (
  pro_id uuid not null references biz_professionals(id) on delete cascade,
  service_id uuid not null references biz_services(id) on delete cascade,
  primary key (pro_id, service_id)
);
create table if not exists biz_pro_locations (
  pro_id uuid not null references biz_professionals(id) on delete cascade,
  location_id uuid not null references biz_locations(id) on delete cascade,
  primary key (pro_id, location_id)
);
create table if not exists biz_schedules (
  id uuid primary key default gen_random_uuid(),
  pro_id uuid not null references biz_professionals(id) on delete cascade,
  location_id uuid not null references biz_locations(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),    -- 0=domingo
  start_min int not null check (start_min between 0 and 1440),
  end_min int not null check (end_min between 0 and 1440)
);
create index if not exists idx_biz_sched_pro on biz_schedules(pro_id, weekday);

create table if not exists biz_appointments (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,
  location_id uuid references biz_locations(id),
  pro_id uuid references biz_professionals(id),
  service_id uuid references biz_services(id),
  customer_name text, customer_contact text,
  span tstzrange not null, status text not null default 'booked',
  source text default 'gui', created_at timestamptz not null default now(),
  exclude using gist (pro_id with =, span with &&) where (status <> 'cancelled')
);
create index if not exists idx_biz_appt_email on biz_appointments(client_email, created_at desc);

-- ── RLS: tudo trancado; só as funções SECURITY DEFINER acessam ───────────────
alter table biz_locations enable row level security;
alter table biz_professionals enable row level security;
alter table biz_services enable row level security;
alter table biz_pro_services enable row level security;
alter table biz_pro_locations enable row level security;
alter table biz_schedules enable row level security;
alter table biz_appointments enable row level security;

-- guard compartilhado: FECHADO por padrão (GUC ausente => nega).
create or replace function _gui_sched_ok(p_secret text)
returns boolean language sql stable as $$
  select coalesce(current_setting('app.gui_sched_secret', true),'') <> ''
     and p_secret = current_setting('app.gui_sched_secret', true);
$$;

-- ── FUNÇÃO 1 · CONSULTAR: o "menu" do negócio que o Gui lê ───────────────────
create or replace function biz_lookup(p_secret text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select jsonb_build_object(
    'locations', coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'city',city,'address',address)) from biz_locations where client_email=p_email and active),'[]'),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'duration_min',duration_min,'price_cents',price_cents)) from biz_services where client_email=p_email and active),'[]'),
    'professionals', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'title',p.title,
        'services',(select coalesce(jsonb_agg(ps.service_id),'[]') from biz_pro_services ps where ps.pro_id=p.id),
        'locations',(select coalesce(jsonb_agg(pl.location_id),'[]') from biz_pro_locations pl where pl.pro_id=p.id)))
      from biz_professionals p where p.client_email=p_email and p.active),'[]')
  ) into v;
  return v;
end $$;

-- ── FUNÇÃO 2 · CHECAR DISPONIBILIDADE: slots livres reais (próximos p_days dias) ─
create or replace function biz_availability(
  p_secret text, p_email text, p_service_id uuid,
  p_location_id uuid default null, p_pro_id uuid default null,
  p_days int default 14, p_limit int default 8
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_dur int; rec record; slot timestamptz; day_date date;
  out_slots jsonb := '[]'; cnt int := 0;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select duration_min into v_dur from biz_services where id=p_service_id and client_email=p_email;
  if v_dur is null then return jsonb_build_object('error','service not found'); end if;
  for rec in
    select s.pro_id, s.location_id, s.weekday, s.start_min, s.end_min,
           pr.name as pro_name, l.name as loc_name, coalesce(l.tz,'America/New_York') as tz
    from biz_schedules s
    join biz_professionals pr on pr.id=s.pro_id and pr.active
    join biz_locations l on l.id=s.location_id and l.active
    join biz_pro_services ps on ps.pro_id=s.pro_id and ps.service_id=p_service_id
    where pr.client_email=p_email
      and (p_location_id is null or s.location_id=p_location_id)
      and (p_pro_id is null or s.pro_id=p_pro_id)
  loop
    for i in 0..p_days loop
      day_date := (now() at time zone rec.tz)::date + i;
      if extract(dow from day_date)::int <> rec.weekday then continue; end if;
      slot := ((day_date::text || ' 00:00')::timestamp + (rec.start_min || ' min')::interval) at time zone rec.tz;
      while (rec.start_min + (extract(epoch from (slot - (((day_date::text||' 00:00')::timestamp + (rec.start_min||' min')::interval) at time zone rec.tz)))/60)::int) + v_dur <= rec.end_min loop
        if slot > now() and not exists (
          select 1 from biz_appointments a
          where a.pro_id=rec.pro_id and a.status<>'cancelled'
            and a.span && tstzrange(slot, slot + (v_dur||' min')::interval)
        ) then
          out_slots := out_slots || jsonb_build_object('start',slot,'pro_id',rec.pro_id,'pro',rec.pro_name,'location_id',rec.location_id,'location',rec.loc_name);
          cnt := cnt + 1;
          exit when cnt >= p_limit;
        end if;
        slot := slot + (v_dur||' min')::interval;
      end loop;
      exit when cnt >= p_limit;
    end loop;
    exit when cnt >= p_limit;
  end loop;
  return jsonb_build_object('duration_min',v_dur,'slots',out_slots);
end $$;

-- ── FUNÇÃO 3 · MARCAR: grava o agendamento (EXCLUDE impede o duplo) ───────────
create or replace function biz_book(
  p_secret text, p_email text, p_pro_id uuid, p_location_id uuid, p_service_id uuid,
  p_name text, p_contact text, p_start timestamptz
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_dur int; v_id uuid;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select duration_min into v_dur from biz_services where id=p_service_id and client_email=p_email;
  if v_dur is null then v_dur := 30; end if;
  begin
    insert into biz_appointments(client_email,location_id,pro_id,service_id,customer_name,customer_contact,span)
    values (p_email,p_location_id,p_pro_id,p_service_id,p_name,p_contact,tstzrange(p_start,p_start+(v_dur||' min')::interval))
    returning id into v_id;
  exception when exclusion_violation then
    return jsonb_build_object('ok',false,'reason','slot_taken');
  end;
  return jsonb_build_object('ok',true,'appointment_id',v_id,'start',p_start,'duration_min',v_dur);
end $$;
