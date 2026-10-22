-- GUILEO DESK v5 · SALAS E EQUIPAMENTOS QUE O SERVIÇO EXIGE (2026-10-05). Aplicado pela migração desk_v5_1_salas.
--
-- O QUE MUDA: um serviço pode exigir uma sala/aparelho ALÉM da profissional. "Massagem 60" precisa de qualquer
-- sala de massagem livre; "Laser" precisa da máquina de laser. A lista fica em biz_services.config->'recursos' =
-- [ids de biz_professionals com kind 'room' ou 'equipment']; basta UMA delas livre no intervalo inteiro, contando
-- o intervalo antes/depois do serviço. Lista vazia ou ausente = motor EXATAMENTE como antes (mesma resposta, byte a byte).
--
-- POR QUE UMA TABELA À PARTE (biz_appointment_resources) e não uma 2ª linha em biz_appointments:
--   biz_appointments é lida por ~30 funções e pelo JS (lembrete, avaliação, reativação, aniversário, falta, relatórios,
--   fechamento, ficha da cliente, CRM, feed). Uma linha "de sala" ali exigiria filtro em TODAS — e a primeira que
--   esquecesse mandaria lembrete em dobro ou contaria visita fantasma. Na tabela à parte a sala é invisível para tudo
--   isso POR CONSTRUÇÃO, e a constraint de exclusão (gist) garante no banco que a mesma sala nunca fica em dois
--   atendimentos ao mesmo tempo, mesmo com duas marcações simultâneas. (Os filtros `attributes ? 'vinculo_de'` de
--   desk_reports_unidades continuam inofensivos: essas linhas não existem.)
--
-- PEÇAS
--   biz_appointment_resources  → reserva da sala: appointment_id, resource_id, span (com os intervalos), released_at.
--   _biz_res_exige(svc)        → o serviço exige sala? (config.recursos com pelo menos 1 id)
--   _biz_res_livre(...)        → salas da lista livres no intervalo, na ordem do cadastro (a preferida primeiro).
--   _biz_res_ocupa(sala,appt,span) → reservas vivas na sala (o biz_appt_guard usa; DEFINER porque a tabela é fechada).
--   _biz_res_reserve(appt,pref)→ reserva uma sala livre para o agendamento; nenhuma → erro GUI03 'resource_unavailable'.
--   _biz_res_sync() + gatilho  → cancelou/faltou: solta a sala · mudou horário/unidade/serviço ou reabriu: pega de novo
--                                (a mesma sala se ainda servir); sem sala livre → GUI03 e a mudança NÃO acontece.
--   biz_availability           → com recursos: só oferece o horário se uma sala serve; cada vaga traz resource_id/resource.
--   biz_book                   → reserva a sala na MESMA transação; sem sala → {ok:false, reason:'resource_unavailable'}.
--   biz_reschedule, desk_move  → GUI03 vira {ok:false, reason:'resource_unavailable'}.
--   biz_appt_guard             → agendamento/bloqueio feito DIRETO na sala (sala como "profissional", modelo antigo, ou
--                                o bloqueio de manutenção) também respeita as reservas. Para pessoas a conta soma 0.
--   desk_agenda                → cada agendamento com sala traz resource_id/resource; cada serviço com recursos traz recursos.
--   desk_service_save          → aceita service.recursos (só ids de sala/equipamento do próprio negócio).
--
-- O QUE NÃO RESERVA SALA (de propósito): importação (desk_import_appointments) e espelhos externos (MindBody/agenda) —
-- são histórico ou já foram decididos fora. Só biz_book (IA, balcão, página pública) reserva.
-- Limite conhecido: a reserva é exclusiva — serviço em grupo (capacity > 1) que exige sala só cabe um por vez na sala.
-- Texto integral: select pg_get_functiondef(oid) from pg_proc where proname in ('_biz_res_exige','_biz_res_livre',
--   '_biz_res_reserve','_biz_res_sync','biz_availability','biz_book','biz_reschedule','desk_move','biz_appt_guard',
--   'desk_agenda','desk_service_save');

-- ── tabela ───────────────────────────────────────────────────────────────────────────────────
create table if not exists public.biz_appointment_resources (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,
  appointment_id uuid not null references public.biz_appointments(id) on delete cascade,
  resource_id uuid not null references public.biz_professionals(id),
  span tstzrange not null,              -- horário do atendimento + intervalo antes/depois do serviço
  created_at timestamptz not null default now(),
  released_at timestamptz,              -- solta (cancelou, faltou, mudou de horário). Fica como histórico.
  constraint biz_appt_res_sem_choque exclude using gist (resource_id with =, span with &&) where (released_at is null)
);
create unique index if not exists biz_appt_res_uma_viva on public.biz_appointment_resources (appointment_id) where released_at is null;
create index if not exists biz_appt_res_appt on public.biz_appointment_resources (appointment_id);
alter table public.biz_appointment_resources enable row level security;
revoke all on public.biz_appointment_resources from anon, authenticated;

-- ── auxiliares ───────────────────────────────────────────────────────────────────────────────
create or replace function public._biz_res_exige(p_service_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select jsonb_typeof(config->'recursos') = 'array' and jsonb_array_length(config->'recursos') > 0
                     from biz_services where id = p_service_id), false)
$$;

-- Salas da lista do serviço LIVRES em p_span, na ordem do cadastro (p_prefer primeiro). Livre = nenhuma reserva viva
-- cruzando e nenhum agendamento/bloqueio direto na sala cruzando (com os intervalos do serviço dele, como o motor faz).
-- Sala com unidades marcadas só serve nessas unidades; sem unidade marcada serve em todas.
create or replace function public._biz_res_livre(p_email text, p_service_id uuid, p_location_id uuid, p_span tstzrange,
  p_excluir uuid default null, p_prefer uuid default null, p_pular uuid[] default '{}'::uuid[])
returns table(id uuid, name text) language sql stable security definer set search_path to 'public' as $$
  select r.id, r.name
    from biz_services s
    cross join lateral jsonb_array_elements_text(case when jsonb_typeof(s.config->'recursos') = 'array' then s.config->'recursos' else '[]'::jsonb end)
         with ordinality as x(v, ord)
    join biz_professionals r on r.id::text = x.v and r.client_email = p_email and coalesce(r.active, true) and r.kind in ('room', 'equipment')
   where s.id = p_service_id
     and not (r.id = any(coalesce(p_pular, '{}'::uuid[])))
     and (p_location_id is null
          or not exists (select 1 from biz_pro_locations pl where pl.pro_id = r.id)
          or exists (select 1 from biz_pro_locations pl where pl.pro_id = r.id and pl.location_id = p_location_id))
     and not exists (select 1 from biz_appointment_resources z join biz_appointments a on a.id = z.appointment_id
                      where z.resource_id = r.id and z.released_at is null and z.span && p_span
                        and a.id is distinct from p_excluir and a.status not in ('cancelled', 'canceled', 'no_show')
                        and (a.expires_at is null or a.expires_at > now()))
     and not exists (select 1 from biz_appointments a left join biz_services asv on asv.id = a.service_id
                      where a.pro_id = r.id and a.status <> 'cancelled' and a.id is distinct from p_excluir
                        and (a.expires_at is null or a.expires_at > now())
                        and tstzrange(lower(a.span) - make_interval(mins => coalesce(asv.buffer_before_min, 0)),
                                      upper(a.span) + make_interval(mins => coalesce(asv.buffer_after_min, 0))) && p_span)
   order by (r.id = p_prefer) desc nulls last, x.ord
$$;

-- Quantas reservas vivas cruzam p_span nesta sala (para o biz_appt_guard). SECURITY DEFINER porque o guard roda com o
-- papel de quem escreve em biz_appointments, e a tabela de reservas é fechada para anon/authenticated.
create or replace function public._biz_res_ocupa(p_resource uuid, p_excluir uuid, p_span tstzrange)
returns int language sql stable security definer set search_path to 'public' as $$
  select count(*)::int from biz_appointment_resources z join biz_appointments h on h.id = z.appointment_id
   where z.resource_id = p_resource and z.released_at is null and z.appointment_id is distinct from p_excluir and z.span && p_span
     and h.status not in ('cancelled', 'canceled', 'no_show') and (h.expires_at is null or h.expires_at > now())
$$;

-- Reserva uma sala para o agendamento. Serviço sem recursos → null, sem tocar em nada.
-- Corrida: trava a sala escolhida (mesma chave que o biz_appt_guard usa para "profissional"), confere de novo e insere;
-- se outra transação levou a sala no meio (exclusion_violation), tenta a próxima. Nenhuma → GUI03.
create or replace function public._biz_res_reserve(p_appt uuid, p_prefer uuid default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare a biz_appointments; v_bb int; v_ba int; v_span tstzrange; v_room uuid; v_pular uuid[] := '{}'::uuid[];
begin
  select * into a from biz_appointments where id = p_appt;
  if a.id is null or a.service_id is null or a.status in ('cancelled', 'canceled', 'no_show', 'blocked') then return null; end if;
  if not public._biz_res_exige(a.service_id) then return null; end if;
  select coalesce(buffer_before_min, 0), coalesce(buffer_after_min, 0) into v_bb, v_ba from biz_services where id = a.service_id;
  v_span := tstzrange(lower(a.span) - make_interval(mins => v_bb), upper(a.span) + make_interval(mins => v_ba));
  -- reserva de "segurar" vencido não segura sala
  update biz_appointment_resources z set released_at = now() from biz_appointments h
   where h.id = z.appointment_id and z.client_email = a.client_email and z.released_at is null
     and h.status = 'hold' and h.expires_at is not null and h.expires_at < now();
  loop
    select l.id into v_room from public._biz_res_livre(a.client_email, a.service_id, a.location_id, v_span, a.id, p_prefer, v_pular) l limit 1;
    if v_room is null then raise exception 'resource_unavailable' using errcode = 'GUI03'; end if;
    perform pg_advisory_xact_lock(hashtextextended(v_room::text, 0));
    if not exists (select 1 from public._biz_res_livre(a.client_email, a.service_id, a.location_id, v_span, a.id, null, v_pular) l where l.id = v_room) then
      v_pular := v_pular || v_room; continue;
    end if;
    begin
      insert into biz_appointment_resources (client_email, appointment_id, resource_id, span) values (a.client_email, a.id, v_room, v_span);
      return v_room;
    exception when exclusion_violation then v_pular := v_pular || v_room;
    end;
  end loop;
end $$;

-- Gatilho: a sala acompanha o agendamento. Sem reserva (todo serviço sem recursos) → sai na 1ª linha.
create or replace function public._biz_res_sync()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare r biz_appointment_resources;
begin
  select * into r from biz_appointment_resources where appointment_id = new.id order by (released_at is null) desc, created_at desc limit 1;
  if r.id is null then return null; end if;
  if new.status in ('cancelled', 'canceled', 'no_show') then
    update biz_appointment_resources set released_at = now() where appointment_id = new.id and released_at is null;
    return null;
  end if;
  if r.released_at is null and new.span is not distinct from old.span and new.location_id is not distinct from old.location_id
     and new.service_id is not distinct from old.service_id then
    return null;
  end if;
  -- mudou de horário/unidade/serviço, ou foi reaberto: solta e pega de novo (a mesma sala, se ainda servir)
  update biz_appointment_resources set released_at = now() where appointment_id = new.id and released_at is null;
  perform public._biz_res_reserve(new.id, r.resource_id);
  return null;
end $$;

drop trigger if exists biz_appt_res_sync_trg on public.biz_appointments;
create trigger biz_appt_res_sync_trg after update of status, span, location_id, service_id on public.biz_appointments
  for each row execute function public._biz_res_sync();

revoke all on function public._biz_res_exige(uuid) from public, anon, authenticated;
revoke all on function public._biz_res_livre(text, uuid, uuid, tstzrange, uuid, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public._biz_res_reserve(uuid, uuid) from public, anon, authenticated;
revoke all on function public._biz_res_sync() from public, anon, authenticated;
-- _biz_res_ocupa fica com o grant padrão: o biz_appt_guard (não-DEFINER) a chama com o papel de quem escreve.

-- ── guarda do motor: agendamento DIRETO na sala respeita as reservas (para pessoas soma 0) ────────
CREATE OR REPLACE FUNCTION public.biz_appt_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare cap int; cnt int; v_tz text; v_day date; sp biz_special_dates; v_start_min int; v_end_min int;
begin
  if new.status = 'cancelled' then return new; end if;
  if TG_OP = 'INSERT' or new.span is distinct from old.span then
    select coalesce((select tz from biz_locations where id = new.location_id), (select tz from biz_locations where client_email = new.client_email and active order by created_at limit 1), 'America/New_York') into v_tz;
    v_day := (lower(new.span) at time zone v_tz)::date;
    sp := _biz_special_for(new.client_email, v_day);
    if sp.id is not null then
      if sp.closed then raise exception 'closed_date' using errcode='GUI02';
      else
        v_start_min := extract(hour from (lower(new.span) at time zone v_tz))::int * 60 + extract(minute from (lower(new.span) at time zone v_tz))::int;
        v_end_min := v_start_min + ceil(extract(epoch from (upper(new.span) - lower(new.span)))/60)::int;
        if v_start_min < sp.open_min or v_end_min > sp.close_min then raise exception 'closed_date' using errcode='GUI02'; end if;
      end if;
    end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(new.pro_id::text,'none'),0));
  select coalesce(capacity,1) into cap from biz_services where id = new.service_id; cap := coalesce(cap,1);
  select count(*) into cnt from biz_appointments a where a.pro_id = new.pro_id and a.status <> 'cancelled' and a.id <> new.id and (a.expires_at is null or a.expires_at > now()) and a.span && new.span;
  -- desk_v5_1: reservas de sala (biz_appointment_resources) nesta "profissional" — só existem quando ela é uma sala.
  cnt := cnt + public._biz_res_ocupa(new.pro_id, new.id, new.span);
  if cnt >= cap then raise exception 'slot_taken' using errcode='GUI01'; end if;
  return new;
end $function$;

-- ── horários livres ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.biz_availability(p_secret text, p_email text, p_service_id uuid, p_location_id uuid DEFAULT NULL::uuid, p_pro_id uuid DEFAULT NULL::uuid, p_days integer DEFAULT 14, p_limit integer DEFAULT 8)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_dur int; v_bb int; v_ba int; v_notice int; v_cap int;
  rec record; slot timestamptz; day_date date; base timestamptz;
  cand jsonb := '[]'; out_slots jsonb; row_cnt int; earliest timestamptz;
  sp biz_special_dates; eff_start int; eff_end int;
  v_need boolean; v_room record;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  perform biz_release_expired();
  select duration_min, buffer_before_min, buffer_after_min, min_notice_min, coalesce(capacity,1)
    into v_dur, v_bb, v_ba, v_notice, v_cap
    from biz_services where id = p_service_id and client_email = p_email;
  if v_dur is null then return jsonb_build_object('error','service not found'); end if;
  earliest := now() + (v_notice||' min')::interval;
  v_need := public._biz_res_exige(p_service_id);   -- desk_v5_1: o serviço exige sala/aparelho?

  for rec in
    select s.pro_id, s.location_id, s.weekday, s.start_min, s.end_min,
           pr.name as pro_name, l.name as loc_name, coalesce(l.tz,'America/New_York') as tz
    from biz_schedules s
    join biz_professionals pr on pr.id = s.pro_id and pr.active
    join biz_locations l on l.id = s.location_id and l.active
    join biz_pro_services ps on ps.pro_id = s.pro_id and ps.service_id = p_service_id
    where pr.client_email = p_email
      and (p_location_id is null or s.location_id = p_location_id)
      and (p_pro_id is null or s.pro_id = p_pro_id)
  loop
    row_cnt := 0;  -- por LINHA, não global: é o que impedia os outros dias de aparecerem
    for i in 0..p_days loop
      day_date := (now() at time zone rec.tz)::date + i;
      if extract(dow from day_date)::int <> rec.weekday then continue; end if;
      eff_start := rec.start_min; eff_end := rec.end_min;
      sp := _biz_special_for(p_email, day_date);
      if sp.id is not null then
        if sp.closed then continue; end if;
        eff_start := greatest(eff_start, sp.open_min); eff_end := least(eff_end, sp.close_min);
        if eff_start + v_dur > eff_end then continue; end if;
      end if;
      base := ((day_date::text||' 00:00')::timestamp + (eff_start||' min')::interval) at time zone rec.tz;
      slot := base;
      while eff_start + (extract(epoch from (slot - base))/60)::int + v_dur <= eff_end loop
        if slot >= earliest and (
             select count(*) from biz_appointments a
             join biz_services asv on asv.id = a.service_id
             where a.pro_id = rec.pro_id and a.status <> 'cancelled'
               and (a.expires_at is null or a.expires_at > now())
               and tstzrange(lower(a.span) - (coalesce(asv.buffer_before_min,0)||' min')::interval,
                             upper(a.span) + (coalesce(asv.buffer_after_min,0)||' min')::interval)
                   && tstzrange(slot - (v_bb||' min')::interval,
                                slot + ((v_dur+v_ba)||' min')::interval)) < v_cap then
          if not v_need then
            cand := cand || jsonb_build_object('start', slot, 'pro_id', rec.pro_id, 'pro', rec.pro_name,
                                               'location_id', rec.location_id, 'location', rec.loc_name);
            row_cnt := row_cnt + 1;
            exit when row_cnt >= p_limit;
          else
            -- desk_v5_1: só oferece se uma das salas do serviço está livre no intervalo inteiro (com os intervalos).
            select l.id, l.name into v_room
              from public._biz_res_livre(p_email, p_service_id, rec.location_id,
                     tstzrange(slot - make_interval(mins => coalesce(v_bb,0)), slot + make_interval(mins => v_dur + coalesce(v_ba,0)))) l limit 1;
            if v_room.id is not null then
              cand := cand || jsonb_build_object('start', slot, 'pro_id', rec.pro_id, 'pro', rec.pro_name,
                                                 'location_id', rec.location_id, 'location', rec.loc_name,
                                                 'resource_id', v_room.id, 'resource', v_room.name);
              row_cnt := row_cnt + 1;
              exit when row_cnt >= p_limit;
            end if;
          end if;
        end if;
        slot := slot + (v_dur||' min')::interval;
      end loop;
      exit when row_cnt >= p_limit;
    end loop;
  end loop;

  -- AQUI está a correção: ordena no tempo e SÓ ENTÃO corta. Antes, o corte vinha primeiro.
  select coalesce(jsonb_agg(e order by (e->>'start')::timestamptz), '[]'::jsonb)
    into out_slots
    from (select e from jsonb_array_elements(cand) e
          order by (e->>'start')::timestamptz limit p_limit) s;

  return jsonb_build_object(
    'duration_min', v_dur,
    'deposit_cents', (select deposit_cents from biz_services where id = p_service_id),
    'slots', coalesce(out_slots, '[]'::jsonb));
end $function$;

-- ── marcar ─────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.biz_book(p_secret text, p_email text, p_pro_id uuid, p_location_id uuid, p_service_id uuid, p_name text, p_contact text, p_start timestamp with time zone, p_attributes jsonb DEFAULT '{}'::jsonb, p_hold_min integer DEFAULT NULL::integer, p_request_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_dur int; v_id uuid; v_status text; v_exp timestamptz; v_ref text; v_existing record; v_tz text; sp biz_special_dates; v_res uuid;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  if p_request_id is not null and p_request_id <> '' then
    select id, ref, status into v_existing from biz_appointments where client_email=p_email and request_id=p_request_id and status<>'cancelled' limit 1;
    -- valor, não `found`: só é idempotente se existe agendamento DE VERDADE
    if v_existing.id is not null then return jsonb_build_object('ok',true,'appointment_id',v_existing.id,'ref',v_existing.ref,'status',v_existing.status,'idempotent',true); end if;
  end if;
  perform biz_release_expired();
  select duration_min into v_dur from biz_services where id=p_service_id and client_email=p_email;
  if v_dur is null then v_dur := 30; end if;
  if p_hold_min is not null then v_status:='hold'; v_exp:=now()+(p_hold_min||' min')::interval; else v_status:='booked'; end if;
  v_ref := 'GUI-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
  begin
    insert into biz_appointments(client_email,location_id,pro_id,service_id,customer_name,customer_contact,span,status,expires_at,attributes,ref,request_id)
    values (p_email,p_location_id,p_pro_id,p_service_id,p_name,p_contact, tstzrange(p_start,p_start+(v_dur||' min')::interval), v_status, v_exp, coalesce(p_attributes,'{}'::jsonb), v_ref, nullif(p_request_id,'')) returning id into v_id;
    -- desk_v5_1: serviço que exige sala reserva a sala NESTA transação; sem sala livre, o agendamento acima é desfeito.
    v_res := public._biz_res_reserve(v_id);
  exception
    when sqlstate 'GUI01' then return jsonb_build_object('ok',false,'reason','slot_taken');
    when sqlstate 'GUI03' then return jsonb_build_object('ok',false,'reason','resource_unavailable');
    when sqlstate 'GUI02' then
      select coalesce((select tz from biz_locations where id=p_location_id), (select tz from biz_locations where client_email=p_email and active order by created_at limit 1), 'America/New_York') into v_tz;
      sp := _biz_special_for(p_email, (p_start at time zone v_tz)::date);
      return jsonb_build_object('ok',false,'reason','closed_date','date',(p_start at time zone v_tz)::date,'note',coalesce(sp.note,''),'closed',coalesce(sp.closed,true),'open_min',sp.open_min,'close_min',sp.close_min);
    when unique_violation then
      select id, ref, status into v_existing from biz_appointments where client_email=p_email and request_id=p_request_id and status<>'cancelled' limit 1;
      if v_existing.id is not null then
        return jsonb_build_object('ok',true,'appointment_id',v_existing.id,'ref',v_existing.ref,'status',v_existing.status,'idempotent',true);
      end if;
      -- colidiu com um CANCELADO: a pessoa quer remarcar. Insere sem a chave, uma vez só.
      begin
        insert into biz_appointments(client_email,location_id,pro_id,service_id,customer_name,customer_contact,span,status,expires_at,attributes,ref,request_id)
        values (p_email,p_location_id,p_pro_id,p_service_id,p_name,p_contact, tstzrange(p_start,p_start+(v_dur||' min')::interval), v_status, v_exp, coalesce(p_attributes,'{}'::jsonb), v_ref, null) returning id into v_id;
        v_res := public._biz_res_reserve(v_id);
      exception
        when sqlstate 'GUI01' then return jsonb_build_object('ok',false,'reason','slot_taken');
        when sqlstate 'GUI03' then return jsonb_build_object('ok',false,'reason','resource_unavailable');
        when others then return jsonb_build_object('ok',false,'reason','book_failed');
      end;
  end;
  -- rede final: se por qualquer caminho não houver id, isto NÃO é sucesso.
  if v_id is null then return jsonb_build_object('ok',false,'reason','book_failed'); end if;
  return jsonb_build_object('ok',true,'appointment_id',v_id,'ref',v_ref,'status',v_status,'start',p_start,'duration_min',v_dur,'expires_at',v_exp)
         || case when v_res is null then '{}'::jsonb
                 else jsonb_build_object('resource_id', v_res, 'resource', (select name from biz_professionals where id = v_res)) end;
end $function$;

-- ── remarcar (IA / link da cliente) ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.biz_reschedule(p_secret text, p_email text, p_appointment_id uuid, p_new_start timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_dur int; v_svc uuid; v_tz text; sp biz_special_dates;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  perform biz_release_expired();
  select service_id into v_svc from biz_appointments where id=p_appointment_id and client_email=p_email;
  if v_svc is null then return jsonb_build_object('ok',false,'reason','not_found'); end if;
  select duration_min into v_dur from biz_services where id=v_svc; v_dur := coalesce(v_dur,30);
  begin
    update biz_appointments set span = tstzrange(p_new_start, p_new_start+(v_dur||' min')::interval) where id=p_appointment_id and client_email=p_email;
  exception
    when sqlstate 'GUI01' then return jsonb_build_object('ok',false,'reason','slot_taken');
    when sqlstate 'GUI03' then return jsonb_build_object('ok',false,'reason','resource_unavailable');
    when sqlstate 'GUI02' then
      select coalesce((select tz from biz_locations where client_email=p_email and active order by created_at limit 1), 'America/New_York') into v_tz;
      sp := _biz_special_for(p_email, (p_new_start at time zone v_tz)::date);
      return jsonb_build_object('ok',false,'reason','closed_date','date',(p_new_start at time zone v_tz)::date,'note',coalesce(sp.note,''));
  end;
  return jsonb_build_object('ok',true,'start',p_new_start);
end $function$;

-- ── mover no balcão ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.desk_move(p_email text, p_key text, p_id uuid, p_start timestamp with time zone, p_pro_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e text := public._desk_ok(p_email, p_key); a biz_appointments; v_pro uuid; v_dur interval;
begin
  select * into a from biz_appointments where id = p_id and client_email = e;
  if a.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if a.status in ('cancelled', 'completed', 'no_show') then return jsonb_build_object('ok', false, 'reason', 'closed_status'); end if;
  v_pro := coalesce(p_pro_id, a.pro_id);
  if not exists (select 1 from biz_professionals where id = v_pro and client_email = e) then
    return jsonb_build_object('ok', false, 'reason', 'pro_not_found');
  end if;
  v_dur := upper(a.span) - lower(a.span);
  begin
    update biz_appointments set span = tstzrange(p_start, p_start + v_dur), pro_id = v_pro,
           attributes = coalesce(attributes, '{}'::jsonb) || jsonb_build_object('desk_moved_at', now())
     where id = p_id and client_email = e;
  exception
    when sqlstate 'GUI01' then return jsonb_build_object('ok', false, 'reason', 'slot_taken');
    when sqlstate 'GUI02' then return jsonb_build_object('ok', false, 'reason', 'closed_date');
    when sqlstate 'GUI03' then return jsonb_build_object('ok', false, 'reason', 'resource_unavailable');
  end;
  return jsonb_build_object('ok', true, 'id', p_id, 'start', p_start, 'end', p_start + v_dur, 'pro_id', v_pro);
end $function$;

-- ── agenda do balcão: a sala de cada agendamento e os recursos de cada serviço (só quando existem) ──
CREATE OR REPLACE FUNCTION public.desk_agenda(p_email text, p_key text, p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e text := public._desk_ok(p_email, p_key);
        f timestamptz := coalesce(p_from, date_trunc('day', now()));
        t timestamptz := coalesce(p_to, coalesce(p_from, date_trunc('day', now())) + interval '1 day');
begin
  if t <= f or t - f > interval '42 days' then raise exception 'invalid_range' using errcode = '22023'; end if;
  return jsonb_build_object(
    'ok', true, 'from', f, 'to', t,
    'locations', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'address', l.address,
                    'city', l.city, 'phone', l.phone, 'tz', coalesce(l.tz, 'America/New_York')) order by l.created_at)
                  from biz_locations l where l.client_email = e and coalesce(l.active, true)), '[]'::jsonb),
    'pros', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'title', coalesce(p.title, ''),
                    'kind', coalesce(p.kind, 'staff'), 'color', p.config->>'color',
                    'commission_service_pct', coalesce((p.config->>'commission_service_pct')::numeric, 0),
                    'commission_product_pct', coalesce((p.config->>'commission_product_pct')::numeric, 0),
                    'locations', coalesce((select jsonb_agg(pl.location_id) from biz_pro_locations pl where pl.pro_id = p.id), '[]'::jsonb),
                    'services', coalesce((select jsonb_agg(ps.service_id) from biz_pro_services ps where ps.pro_id = p.id), '[]'::jsonb),
                    'hours', coalesce((select jsonb_agg(jsonb_build_object('location_id', s.location_id, 'weekday', s.weekday,
                                'start_min', s.start_min, 'end_min', s.end_min) order by s.weekday, s.start_min)
                              from biz_schedules s where s.pro_id = p.id), '[]'::jsonb)) order by coalesce(p.kind, 'staff') = 'room', p.name)
                  from biz_professionals p where p.client_email = e and coalesce(p.active, true)), '[]'::jsonb),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'duration_min', s.duration_min,
                    'price_cents', s.price_cents, 'deposit_cents', s.deposit_cents, 'capacity', coalesce(s.capacity, 1),
                    'cancel_window_h', s.cancel_window_h, 'noshow_fee_cents', (s.config->>'noshow_fee_cents')::int,
                    'buffer_before_min', coalesce(s.buffer_before_min, 0), 'buffer_after_min', coalesce(s.buffer_after_min, 0),
                    'category', s.config->>'category')
                    || case when public._biz_res_exige(s.id) then jsonb_build_object('recursos', s.config->'recursos') else '{}'::jsonb end
                    order by s.name)
                  from biz_services s where s.client_email = e and coalesce(s.active, true)), '[]'::jsonb),
    'appointments', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'ref', a.ref,
                    'status', case when a.status in ('cancelled', 'no_show', 'blocked', 'hold') then a.status
                                   else coalesce(a.attributes->>'desk_status', a.status) end,
                    'start', lower(a.span), 'end', upper(a.span), 'pro_id', a.pro_id, 'location_id', a.location_id,
                    'service_id', a.service_id, 'customer_name', a.customer_name, 'customer_contact', a.customer_contact,
                    'source', coalesce(a.attributes->>'source', a.source), 'note', a.attributes->>'desk_note',
                    'sale_id', a.attributes->>'sale_id', 'deposit_paid', coalesce((a.attributes->>'deposit_paid')::boolean, false),
                    'reminded', coalesce(a.reminded, false), 'created_at', a.created_at,
                    'alert', (select nullif(concat_ws(' · ', nullif(c.allergies, ''), nullif(c.alerts, '')), '') from desk_clients c
                               where c.client_email = e and c.contact_key = public._desk_ck(a.customer_contact)),
                    'trusted', coalesce((select c.trusted from desk_clients c where c.client_email = e and c.contact_key = public._desk_ck(a.customer_contact)), false))
                    || coalesce((select jsonb_build_object('resource_id', z.resource_id, 'resource', rp.name)
                                   from biz_appointment_resources z join biz_professionals rp on rp.id = z.resource_id
                                  where z.appointment_id = a.id and z.released_at is null limit 1), '{}'::jsonb)
                    order by lower(a.span))
                  from public.vivo_biz_appointments(e) a
                  where a.span && tstzrange(f, t)
                    and (a.expires_at is null or a.expires_at > now() or a.status <> 'hold')), '[]'::jsonb),
    'closed', coalesce((select jsonb_agg(jsonb_build_object('date', d.date, 'closed', d.closed, 'open_min', d.open_min,
                    'close_min', d.close_min, 'note', d.note) order by d.date)
                  from biz_special_dates d where d.client_email = e
                    and d.date between (f at time zone 'UTC')::date - 1 and (t at time zone 'UTC')::date + 1), '[]'::jsonb)
  );
end $function$;

-- ── serviço: + recursos (lista de salas/aparelhos; vazia tira a exigência) ──────────────────────
CREATE OR REPLACE FUNCTION public.desk_service_save(p_email text, p_key text, p_svc jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare e text := public._desk_ok(p_email, p_key); v_id uuid := nullif(p_svc->>'id', '')::uuid; v_rec jsonb := '[]'::jsonb;
begin
  if v_id is not null and not exists (select 1 from biz_services where id = v_id and client_email = e) then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  -- desk_v5_1: só ids de sala/aparelho DESTE negócio, sem repetir, na ordem enviada (a 1ª é a preferida).
  if p_svc ? 'recursos' then
    select coalesce(jsonb_agg(to_jsonb(q.id) order by q.ord), '[]'::jsonb) into v_rec
      from (select r.id, min(x.ord) ord
              from jsonb_array_elements_text(case when jsonb_typeof(p_svc->'recursos') = 'array' then p_svc->'recursos' else '[]'::jsonb end) with ordinality x(v, ord)
              join biz_professionals r on r.id::text = x.v and r.client_email = e and r.kind in ('room', 'equipment')
             group by r.id) q;
  end if;
  if v_id is null then
    if coalesce(trim(p_svc->>'name'), '') = '' then return jsonb_build_object('ok', false, 'reason', 'name_required'); end if;
    insert into biz_services (client_email, name, duration_min, price_cents, active) values (e, left(trim(p_svc->>'name'), 160),
      greatest(coalesce((p_svc->>'duration_min')::int, 60), 5), greatest(coalesce((p_svc->>'price_cents')::int, 0), 0), true) returning id into v_id;
  end if;
  update biz_services set
    name = coalesce(nullif(left(trim(p_svc->>'name'), 160), ''), name),
    duration_min = case when p_svc ? 'duration_min' then greatest((p_svc->>'duration_min')::int, 5) else duration_min end,
    price_cents = case when p_svc ? 'price_cents' then greatest((p_svc->>'price_cents')::int, 0) else price_cents end,
    buffer_before_min = case when p_svc ? 'buffer_before_min' then greatest((p_svc->>'buffer_before_min')::int, 0) else buffer_before_min end,
    buffer_after_min = case when p_svc ? 'buffer_after_min' then greatest((p_svc->>'buffer_after_min')::int, 0) else buffer_after_min end,
    deposit_cents = case when p_svc ? 'deposit_cents' then greatest((p_svc->>'deposit_cents')::int, 0) else deposit_cents end,
    cancel_window_h = case when p_svc ? 'cancel_window_h' then greatest((p_svc->>'cancel_window_h')::int, 0) else cancel_window_h end,
    active = case when p_svc ? 'active' then (p_svc->>'active')::boolean else active end,
    config = (case when p_svc ? 'recursos' then coalesce(config, '{}'::jsonb) - 'recursos' else coalesce(config, '{}'::jsonb) end)
             || case when p_svc ? 'noshow_fee_cents' then jsonb_build_object('noshow_fee_cents', greatest((p_svc->>'noshow_fee_cents')::int, 0)) else '{}'::jsonb end
             || case when p_svc ? 'category' then jsonb_build_object('category', left(p_svc->>'category', 60)) else '{}'::jsonb end
             || case when p_svc ? 'recursos' and jsonb_array_length(v_rec) > 0 then jsonb_build_object('recursos', v_rec) else '{}'::jsonb end,
    updated_at = now()
  where id = v_id and client_email = e;
  return jsonb_build_object('ok', true, 'id', v_id);
end $function$;
