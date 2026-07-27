-- ============================================================================
-- GUILEO · DATAS ESPECIAIS (férias, feriados, horário reduzido) — cole TUDO e RUN.
-- ADITIVO + idempotente: NÃO quebra o motor v1–v5. Mesmo gate _gui_sched_ok.
-- O problema que isto fecha: o dono viaja / é Thanksgiving e o Gui continuava
-- marcando como se fosse uma terça normal. Agora:
--   • biz_special_dates guarda os dias fechados OU com horário reduzido;
--   • biz_availability PULA dias fechados e RECORTA os de horário reduzido;
--   • a trava biz_appt_guard (roda em TODO insert/update) rejeita agendamento
--     em dia fechado/fora do horário reduzido com o erro GUI02 'closed_date' —
--     então NENHUM caminho (book, reschedule, recurring, hold) fura a data;
--   • biz_book / biz_reschedule capturam GUI02 e devolvem reason='closed_date'
--     + a nota (ex: "Feriado — Ação de Graças") pro Gui falar com o cliente.
-- Fonte da verdade das funções reescritas: scheduling_engine_v2.sql (availability,
-- guard, reschedule) + idempotency_biz_book.sql (biz_book). Só o que muda é o
-- respeito às datas especiais — o resto é idêntico, linha a linha.
-- ============================================================================

-- ── TABELA ──────────────────────────────────────────────────────────────────
create table if not exists biz_special_dates (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,
  date date not null,
  closed boolean not null default true,               -- true = fechado o dia todo
  open_min int check (open_min between 0 and 1440),   -- horário reduzido (closed=false)
  close_min int check (close_min between 0 and 1440),
  note text,                                          -- ex: 'Feriado — Ação de Graças'
  created_at timestamptz not null default now(),
  unique (client_email, date),
  check (closed or (open_min is not null and close_min is not null and open_min < close_min))
);
create index if not exists idx_biz_special_email on biz_special_dates(client_email, date);
alter table biz_special_dates enable row level security;  -- trancado; só SECURITY DEFINER acessa

-- helper interno (SEM security definer: só funciona chamado de dentro das funções
-- definer abaixo; chamado direto pelo anon, o RLS devolve vazio)
create or replace function _biz_special_for(p_email text, p_date date)
returns biz_special_dates language sql stable as $$
  select * from biz_special_dates where client_email = p_email and date = p_date limit 1;
$$;

-- ── RPC · GRAVAR/REMOVER uma data especial (upsert por dia; p_remove=true apaga) ─
create or replace function biz_set_special_date(
  p_secret text, p_email text, p_date date,
  p_closed boolean default true, p_open_min int default null, p_close_min int default null,
  p_note text default null, p_remove boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  if p_remove then
    delete from biz_special_dates where client_email=p_email and date=p_date;
    return jsonb_build_object('ok',true,'removed',true,'date',p_date);
  end if;
  if not p_closed and (p_open_min is null or p_close_min is null or p_open_min >= p_close_min) then
    return jsonb_build_object('ok',false,'reason','bad_hours');
  end if;
  insert into biz_special_dates(client_email,date,closed,open_min,close_min,note)
    values (p_email, p_date, coalesce(p_closed,true),
            case when p_closed then null else p_open_min end,
            case when p_closed then null else p_close_min end,
            nullif(trim(coalesce(p_note,'')),''))
  on conflict (client_email,date) do update
    set closed = excluded.closed, open_min = excluded.open_min,
        close_min = excluded.close_min, note = excluded.note
  returning id into v_id;
  return jsonb_build_object('ok',true,'id',v_id,'date',p_date);
end $$;

-- ── RPC · LISTAR as datas especiais futuras (o cockpit e o Gui leem daqui) ───
create or replace function biz_list_special_dates(p_secret text, p_email text, p_days int default 180)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'date',date,'closed',closed,'open_min',open_min,'close_min',close_min,'note',note
    ) order by date),'[]'::jsonb)
    into v from biz_special_dates
    where client_email=p_email and date >= (now() at time zone 'UTC')::date - 1
      and date <= (now() at time zone 'UTC')::date + greatest(coalesce(p_days,180),1);
  return jsonb_build_object('dates', coalesce(v,'[]'::jsonb));
end $$;

-- ── TRAVA · biz_appt_guard reescrita EM CHEIO (v2 + datas especiais) ─────────
-- Comportamento novo (só o bloco "DATAS ESPECIAIS"): se o dia local do início do
-- agendamento estiver FECHADO, ou o agendamento não couber inteiro no horário
-- REDUZIDO daquele dia, levanta GUI02 'closed_date'. Todo o resto = v2 idêntico.
create or replace function biz_appt_guard() returns trigger language plpgsql as $$
declare cap int; cnt int; v_tz text; v_day date; sp biz_special_dates; v_start_min int; v_end_min int;
begin
  if new.status = 'cancelled' then return new; end if;
  -- DATAS ESPECIAIS: só quando o HORÁRIO nasce/muda (insert ou span alterado) — updates
  -- administrativos (reminded, confirm de hold, atributos) em booking já existente passam.
  if TG_OP = 'INSERT' or new.span is distinct from old.span then
    -- resolve o fuso da unidade (fallback: primeira unidade do negócio / NY)
    select coalesce(
      (select tz from biz_locations where id = new.location_id),
      (select tz from biz_locations where client_email = new.client_email and active order by created_at limit 1),
      'America/New_York') into v_tz;
    v_day := (lower(new.span) at time zone v_tz)::date;
    sp := _biz_special_for(new.client_email, v_day);
    if sp.id is not null then
      if sp.closed then
        raise exception 'closed_date' using errcode='GUI02';
      else
        v_start_min := extract(hour from (lower(new.span) at time zone v_tz))::int * 60
                     + extract(minute from (lower(new.span) at time zone v_tz))::int;
        v_end_min   := v_start_min + ceil(extract(epoch from (upper(new.span) - lower(new.span)))/60)::int;
        if v_start_min < sp.open_min or v_end_min > sp.close_min then
          raise exception 'closed_date' using errcode='GUI02';
        end if;
      end if;
    end if;
  end if;
  -- (daqui pra baixo: idêntico ao v2 — capacidade + anti-overbook race-safe)
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

-- ── DISPONIBILIDADE reescrita EM CHEIO (v2 + datas especiais) ────────────────
-- Só muda o bloco "DATAS ESPECIAIS" dentro do loop de dias: dia fechado é PULADO;
-- dia reduzido tem a janela recortada (interseção com o horário normal do pro).
create or replace function biz_availability(
  p_secret text, p_email text, p_service_id uuid,
  p_location_id uuid default null, p_pro_id uuid default null,
  p_days int default 14, p_limit int default 8
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_dur int; v_bb int; v_ba int; v_notice int; v_cap int;
  rec record; slot timestamptz; day_date date; base timestamptz;
  out_slots jsonb := '[]'; cnt int := 0; earliest timestamptz;
  sp biz_special_dates; eff_start int; eff_end int;
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
      -- DATAS ESPECIAIS: fechado → pula o dia; reduzido → recorta a janela
      eff_start := rec.start_min; eff_end := rec.end_min;
      sp := _biz_special_for(p_email, day_date);
      if sp.id is not null then
        if sp.closed then continue; end if;
        eff_start := greatest(eff_start, sp.open_min);
        eff_end := least(eff_end, sp.close_min);
        if eff_start + v_dur > eff_end then continue; end if;
      end if;
      base := ((day_date::text||' 00:00')::timestamp + (eff_start||' min')::interval) at time zone rec.tz;
      slot := base;
      while eff_start + (extract(epoch from (slot - base))/60)::int + v_dur <= eff_end loop
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

-- ── biz_book reescrita EM CHEIO (idempotency_biz_book.sql + captura GUI02) ───
-- Só muda: o exception handler agora captura GUI02 e devolve reason='closed_date'
-- + a nota da data (pro Gui explicar: "estamos fechados — feriado"). Resto idêntico.
create or replace function biz_book(
  p_secret text, p_email text, p_pro_id uuid, p_location_id uuid, p_service_id uuid,
  p_name text, p_contact text, p_start timestamptz,
  p_attributes jsonb default '{}'::jsonb, p_hold_min int default null, p_request_id text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_dur int; v_id uuid; v_status text; v_exp timestamptz; v_ref text; v_existing record;
  v_tz text; sp biz_special_dates;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  if p_request_id is not null and p_request_id <> '' then
    select id, ref, status into v_existing from biz_appointments
      where client_email=p_email and request_id=p_request_id and status<>'cancelled' limit 1;
    if found then
      return jsonb_build_object('ok',true,'appointment_id',v_existing.id,'ref',v_existing.ref,'status',v_existing.status,'idempotent',true);
    end if;
  end if;
  perform biz_release_expired();
  select duration_min into v_dur from biz_services where id=p_service_id and client_email=p_email;
  if v_dur is null then v_dur := 30; end if;
  if p_hold_min is not null then v_status:='hold'; v_exp:=now()+(p_hold_min||' min')::interval; else v_status:='booked'; end if;
  v_ref := 'GUI-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
  begin
    insert into biz_appointments(client_email,location_id,pro_id,service_id,customer_name,customer_contact,span,status,expires_at,attributes,ref,request_id)
    values (p_email,p_location_id,p_pro_id,p_service_id,p_name,p_contact,
            tstzrange(p_start,p_start+(v_dur||' min')::interval), v_status, v_exp, coalesce(p_attributes,'{}'::jsonb), v_ref, nullif(p_request_id,''))
    returning id into v_id;
  exception
    when sqlstate 'GUI01' then return jsonb_build_object('ok',false,'reason','slot_taken');
    when sqlstate 'GUI02' then
      -- dia fechado / fora do horário reduzido → devolve a data local + nota pro agente falar
      select coalesce((select tz from biz_locations where id=p_location_id),
                      (select tz from biz_locations where client_email=p_email and active order by created_at limit 1),
                      'America/New_York') into v_tz;
      sp := _biz_special_for(p_email, (p_start at time zone v_tz)::date);
      return jsonb_build_object('ok',false,'reason','closed_date',
        'date',(p_start at time zone v_tz)::date,'note',coalesce(sp.note,''),
        'closed',coalesce(sp.closed,true),'open_min',sp.open_min,'close_min',sp.close_min);
    when unique_violation then
      select id, ref, status into v_existing from biz_appointments
        where client_email=p_email and request_id=p_request_id and status<>'cancelled' limit 1;
      return jsonb_build_object('ok',true,'appointment_id',v_existing.id,'ref',v_existing.ref,'status',v_existing.status,'idempotent',true);
  end;
  return jsonb_build_object('ok',true,'appointment_id',v_id,'ref',v_ref,'status',v_status,'start',p_start,'duration_min',v_dur,'expires_at',v_exp);
end $$;

-- ── biz_reschedule reescrita EM CHEIO (v2 + captura GUI02) ───────────────────
create or replace function biz_reschedule(p_secret text, p_email text, p_appointment_id uuid, p_new_start timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_dur int; v_svc uuid; v_tz text; sp biz_special_dates;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  perform biz_release_expired();
  select service_id into v_svc from biz_appointments where id=p_appointment_id and client_email=p_email;
  if v_svc is null then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  select duration_min into v_dur from biz_services where id=v_svc;
  v_dur := coalesce(v_dur,30);
  begin
    update biz_appointments set span = tstzrange(p_new_start, p_new_start+(v_dur||' min')::interval)
     where id=p_appointment_id and client_email=p_email;
  exception
    when sqlstate 'GUI01' then return jsonb_build_object('ok',false,'reason','slot_taken');
    when sqlstate 'GUI02' then
      select coalesce((select tz from biz_locations where client_email=p_email and active order by created_at limit 1),
                      'America/New_York') into v_tz;
      sp := _biz_special_for(p_email, (p_new_start at time zone v_tz)::date);
      return jsonb_build_object('ok',false,'reason','closed_date',
        'date',(p_new_start at time zone v_tz)::date,'note',coalesce(sp.note,''));
  end;
  return jsonb_build_object('ok',true,'start',p_new_start);
end $$;

-- ✅ Pronto. Teste rápido (troque o email):
--   select biz_set_special_date('gss_7Kx2mQ9vR4tZ8nL','dono@negocio.com','2026-11-26',true,null,null,'Feriado — Ação de Graças');
--   select biz_list_special_dates('gss_7Kx2mQ9vR4tZ8nL','dono@negocio.com');
--   -- biz_availability não devolve mais slots em 2026-11-26; biz_book nesse dia → reason='closed_date'.
