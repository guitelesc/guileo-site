-- ============================================================================
-- GUILEO · MOTOR DE AGENDA v2 (universal, todos os setores) — cole tudo e RUN.
-- ADITIVO + idempotente: NÃO quebra o v1 (a clínica de teste continua funcionando).
-- Baseado na pesquisa (Cal.com EventType, Fresha, Cronofy, ServiceTitan, NexHealth).
-- Núcleo tipado + JSONB flexível. Trava anti-overbook por CAPACIDADE (1=exclusivo, N=assentos).
-- ============================================================================

-- 1) SERVICES — campos que cada setor precisa (buffers, antecedência, depósito, capacidade, config)
alter table biz_services add column if not exists buffer_before_min int  not null default 0;  -- prep/setup
alter table biz_services add column if not exists buffer_after_min  int  not null default 0;  -- limpeza/deslocamento
alter table biz_services add column if not exists min_notice_min    int  not null default 0;  -- antecedência mínima
alter table biz_services add column if not exists capacity          int  not null default 1;  -- assentos/slot (1=exclusivo)
alter table biz_services add column if not exists deposit_cents     int;                       -- sinal fixo
alter table biz_services add column if not exists deposit_pct       numeric;                   -- ou % do preço
alter table biz_services add column if not exists cancel_window_h   int  not null default 0;   -- janela p/ cancelar sem taxa
alter table biz_services add column if not exists config            jsonb not null default '{}'::jsonb;
-- config exemplos por setor: {"party_size":true} restaurante · {"requires_address":true} serviço externo
--   {"intake":["alergias","convênio"]} clínica · {"addons":["barba"]} salão · {"property":true} imobiliária

-- 2) RESOURCES (biz_professionals generalizado) — tipo + config (mesa/sala/baia/equipamento/corretor)
alter table biz_professionals add column if not exists kind   text  not null default 'staff';  -- staff|table|room|bay|equipment|agent
alter table biz_professionals add column if not exists config jsonb not null default '{}'::jsonb; -- ex mesa: {"seats":4}

-- 3) APPOINTMENTS — atributos flexíveis + hold com expiração
alter table biz_appointments add column if not exists attributes jsonb not null default '{}'::jsonb; -- party_size, endereço, intake...
alter table biz_appointments add column if not exists expires_at timestamptz;  -- holds expiram (NULL = booking firme)

-- 4) TROCAR a trava EXCLUDE (exclusiva) por uma GUARD por CAPACIDADE (cobre 1 e N) + race-safe
do $$
declare c text;
begin
  select conname into c from pg_constraint where conrelid='biz_appointments'::regclass and contype='x' limit 1;
  if c is not null then execute format('alter table biz_appointments drop constraint %I', c); end if;
end $$;

create or replace function biz_appt_guard() returns trigger language plpgsql as $$
declare cap int; cnt int;
begin
  if new.status = 'cancelled' then return new; end if;
  -- serializa por recurso (sem furo sob concorrência)
  perform pg_advisory_xact_lock(hashtextextended(coalesce(new.pro_id::text,'none'),0));
  select coalesce(capacity,1) into cap from biz_services where id = new.service_id;
  cap := coalesce(cap,1);
  select count(*) into cnt from biz_appointments a
    where a.pro_id = new.pro_id and a.status <> 'cancelled' and a.id <> new.id
      and (a.expires_at is null or a.expires_at > now())
      and a.span && new.span;
  if cnt >= cap then raise exception 'slot_taken' using errcode='GUI01'; end if;
  return new;
end $$;
drop trigger if exists biz_appt_guard_trg on biz_appointments;
create trigger biz_appt_guard_trg before insert or update on biz_appointments
  for each row execute function biz_appt_guard();

-- limpa holds expirados (chamado preguiçosamente pelas RPCs; sem cron)
create or replace function biz_release_expired() returns void language sql security definer set search_path=public as $$
  update biz_appointments set status='cancelled'
   where status='hold' and expires_at is not null and expires_at < now();
$$;

-- ── DISPONIBILIDADE v2: respeita buffers + antecedência mínima + capacidade ──
create or replace function biz_availability(
  p_secret text, p_email text, p_service_id uuid,
  p_location_id uuid default null, p_pro_id uuid default null,
  p_days int default 14, p_limit int default 8
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_dur int; v_bb int; v_ba int; v_notice int; v_cap int;
  rec record; slot timestamptz; day_date date; base timestamptz;
  out_slots jsonb := '[]'; cnt int := 0; earliest timestamptz;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  perform biz_release_expired();
  select duration_min, buffer_before_min, buffer_after_min, min_notice_min, coalesce(capacity,1)
    into v_dur, v_bb, v_ba, v_notice, v_cap
    from biz_services where id=p_service_id and client_email=p_email;
  if v_dur is null then return jsonb_build_object('error','service not found'); end if;
  earliest := now() + (v_notice||' min')::interval;
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
      base := ((day_date::text||' 00:00')::timestamp + (rec.start_min||' min')::interval) at time zone rec.tz;
      slot := base;
      while rec.start_min + (extract(epoch from (slot - base))/60)::int + v_dur <= rec.end_min loop
        if slot >= earliest and (
          select count(*) from biz_appointments a
          join biz_services asv on asv.id = a.service_id
          where a.pro_id=rec.pro_id and a.status<>'cancelled'
            and (a.expires_at is null or a.expires_at > now())
            and tstzrange(lower(a.span) - (coalesce(asv.buffer_before_min,0)||' min')::interval,
                          upper(a.span) + (coalesce(asv.buffer_after_min,0)||' min')::interval)
              && tstzrange(slot - (v_bb||' min')::interval, slot + ((v_dur+v_ba)||' min')::interval)
        ) < v_cap then
          out_slots := out_slots || jsonb_build_object('start',slot,'pro_id',rec.pro_id,'pro',rec.pro_name,'location_id',rec.location_id,'location',rec.loc_name);
          cnt := cnt + 1; exit when cnt >= p_limit;
        end if;
        slot := slot + (v_dur||' min')::interval;
      end loop;
      exit when cnt >= p_limit;
    end loop;
    exit when cnt >= p_limit;
  end loop;
  return jsonb_build_object('duration_min',v_dur,'deposit_cents',(select deposit_cents from biz_services where id=p_service_id),'slots',out_slots);
end $$;

-- ── MARCAR v2: aceita atributos + hold (status/expiração); guard reforça capacidade ──
create or replace function biz_book(
  p_secret text, p_email text, p_pro_id uuid, p_location_id uuid, p_service_id uuid,
  p_name text, p_contact text, p_start timestamptz,
  p_attributes jsonb default '{}'::jsonb, p_hold_min int default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_dur int; v_id uuid; v_status text; v_exp timestamptz;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  perform biz_release_expired();
  select duration_min into v_dur from biz_services where id=p_service_id and client_email=p_email;
  if v_dur is null then v_dur := 30; end if;
  if p_hold_min is not null then v_status:='hold'; v_exp:=now()+(p_hold_min||' min')::interval; else v_status:='booked'; end if;
  begin
    insert into biz_appointments(client_email,location_id,pro_id,service_id,customer_name,customer_contact,span,status,expires_at,attributes)
    values (p_email,p_location_id,p_pro_id,p_service_id,p_name,p_contact,
            tstzrange(p_start,p_start+(v_dur||' min')::interval), v_status, v_exp, coalesce(p_attributes,'{}'::jsonb))
    returning id into v_id;
  exception when sqlstate 'GUI01' then return jsonb_build_object('ok',false,'reason','slot_taken');
  end;
  return jsonb_build_object('ok',true,'appointment_id',v_id,'status',v_status,'start',p_start,'duration_min',v_dur,'expires_at',v_exp);
end $$;

-- ── HOLD: trava o slot ~5min enquanto o Gui confirma (atalho do book) ──
create or replace function biz_hold(
  p_secret text, p_email text, p_pro_id uuid, p_location_id uuid, p_service_id uuid,
  p_name text, p_contact text, p_start timestamptz, p_minutes int default 5
) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  return biz_book(p_secret,p_email,p_pro_id,p_location_id,p_service_id,p_name,p_contact,p_start,'{}'::jsonb,p_minutes);
end $$;

-- confirma um hold (vira booking firme)
create or replace function biz_confirm(p_secret text, p_email text, p_appointment_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare n int;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  update biz_appointments set status='booked', expires_at=null
   where id=p_appointment_id and client_email=p_email and status='hold';
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n>0);
end $$;

-- ── REMARCAR: move o horário (guard re-checa conflito) ──
create or replace function biz_reschedule(p_secret text, p_email text, p_appointment_id uuid, p_new_start timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_dur int; v_svc uuid;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  perform biz_release_expired();
  select service_id into v_svc from biz_appointments where id=p_appointment_id and client_email=p_email;
  if v_svc is null then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  select duration_min into v_dur from biz_services where id=v_svc;
  v_dur := coalesce(v_dur,30);
  -- recria via guard: marca o novo, se livre cancela o antigo
  begin
    update biz_appointments set span = tstzrange(p_new_start, p_new_start+(v_dur||' min')::interval)
     where id=p_appointment_id and client_email=p_email;
  exception when sqlstate 'GUI01' then return jsonb_build_object('ok',false,'reason','slot_taken');
  end;
  return jsonb_build_object('ok',true,'start',p_new_start);
end $$;
-- (a trava biz_appt_guard agora roda em INSERT e UPDATE, então o reschedule é protegido contra conflito)

-- ── CANCELAR ──
create or replace function biz_cancel(p_secret text, p_email text, p_appointment_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare n int;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  update biz_appointments set status='cancelled' where id=p_appointment_id and client_email=p_email;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n>0);
end $$;
