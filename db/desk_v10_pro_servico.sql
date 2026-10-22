-- GUILEO DESK v10 — Profissional × serviço: duração, preparo, limpeza e pagamento POR PROFISSIONAL (2026-10-21, Onda 1 item 3)
-- No MindBody (StaffSessionType) cada profissional tem, para cada serviço, a SUA duração, PrepTime, FinishTime e
-- o pagamento (percentual, fixo ou nada). Aqui a ligação biz_pro_services (quem faz o quê) ganha essas colunas.
-- NULL = usa o do serviço (duração, buffer_before/after) ou o % geral da profissional (comissão). Nada muda para
-- quem não preencher: provado por md5 da disponibilidade antes/depois.
--
-- ONDE O MOTOR LÊ (uma regra só, _biz_eff): biz_book (duração do agendamento), biz_availability (vagas por
-- profissional + o bloqueio de preparo/limpeza dos agendamentos existentes), _biz_res_reserve (sala presa
-- durante preparo e limpeza). O gatilho biz_appt_guard segue como sempre: julga só o choque do atendimento
-- em si — preparo/limpeza continuam "macios" (a disponibilidade não oferece em cima, a tela mostra a faixa
-- hachurada, mas o balcão pode marcar colado se quiser). desk_move mantém a duração que foi marcada.
-- CAIXA: _desk_comissao decide a comissão da linha: serviço com regra própria (%, fixo ou nada) > % geral.
-- Idempotente: create or replace; alter ... if not exists; o patch do desk_checkout só roda se ainda não rodou.

alter table biz_pro_services add column if not exists duration_min int;
alter table biz_pro_services add column if not exists prep_min int;
alter table biz_pro_services add column if not exists finish_min int;
alter table biz_pro_services add column if not exists pay_type text;
alter table biz_pro_services add column if not exists pay_amount numeric;
do $c$ begin
  if not exists (select 1 from pg_constraint where conname = 'biz_pro_services_pay_type_chk') then
    alter table biz_pro_services add constraint biz_pro_services_pay_type_chk check (pay_type is null or pay_type in ('pct', 'flat', 'none'));
  end if;
end $c$;

-- Duração, preparo e limpeza EFETIVOS de (profissional, serviço).
create or replace function public._biz_eff(p_pro uuid, p_svc uuid)
returns table(dur int, bb int, ba int) language sql stable security definer set search_path to 'public' as $$
  select coalesce(ps.duration_min, s.duration_min, 30), coalesce(ps.prep_min, s.buffer_before_min, 0), coalesce(ps.finish_min, s.buffer_after_min, 0)
    from biz_services s left join biz_pro_services ps on ps.service_id = s.id and ps.pro_id = p_pro
   where s.id = p_svc
$$;
revoke all on function public._biz_eff(uuid, uuid) from public, anon, authenticated;

-- biz_book: igual ao de antes, só a duração passa a vir de _biz_eff (profissional × serviço).
create or replace function public.biz_book(p_secret text, p_email text, p_pro_id uuid, p_location_id uuid, p_service_id uuid, p_name text, p_contact text, p_start timestamptz, p_attributes jsonb default '{}'::jsonb, p_hold_min integer default null, p_request_id text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_dur int; v_id uuid; v_status text; v_exp timestamptz; v_ref text; v_existing record; v_tz text; sp biz_special_dates; v_res uuid;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  if p_request_id is not null and p_request_id <> '' then
    select id, ref, status into v_existing from biz_appointments where client_email=p_email and request_id=p_request_id and status<>'cancelled' limit 1;
    if v_existing.id is not null then return jsonb_build_object('ok',true,'appointment_id',v_existing.id,'ref',v_existing.ref,'status',v_existing.status,'idempotent',true); end if;
  end if;
  perform biz_release_expired();
  -- desk_v10: a duração é da profissional para este serviço (se ela tiver a sua), senão a do serviço.
  select e.dur into v_dur from public._biz_eff(p_pro_id, p_service_id) e;
  if v_dur is null or not exists (select 1 from biz_services where id=p_service_id and client_email=p_email) then v_dur := coalesce(v_dur, 30); end if;
  if p_hold_min is not null then v_status:='hold'; v_exp:=now()+(p_hold_min||' min')::interval; else v_status:='booked'; end if;
  v_ref := 'GUI-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
  begin
    insert into biz_appointments(client_email,location_id,pro_id,service_id,customer_name,customer_contact,span,status,expires_at,attributes,ref,request_id)
    values (p_email,p_location_id,p_pro_id,p_service_id,p_name,p_contact, tstzrange(p_start,p_start+(v_dur||' min')::interval), v_status, v_exp, coalesce(p_attributes,'{}'::jsonb), v_ref, nullif(p_request_id,'')) returning id into v_id;
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
  if v_id is null then return jsonb_build_object('ok',false,'reason','book_failed'); end if;
  return jsonb_build_object('ok',true,'appointment_id',v_id,'ref',v_ref,'status',v_status,'start',p_start,'duration_min',v_dur,'expires_at',v_exp)
         || case when v_res is null then '{}'::jsonb
                 else jsonb_build_object('resource_id', v_res, 'resource', (select name from biz_professionals where id = v_res)) end;
end $function$;

-- biz_availability: igual ao de antes, mas duração/preparo/limpeza por PROFISSIONAL (a dela para as vagas e a de
-- cada agendamento existente para o bloqueio). Cada vaga também diz a sua duration_min.
create or replace function public.biz_availability(p_secret text, p_email text, p_service_id uuid, p_location_id uuid default null, p_pro_id uuid default null, p_days integer default 14, p_limit integer default 8)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_dur int; v_notice int; v_cap int; v_d int; v_bb int; v_ba int;
  rec record; slot timestamptz; day_date date; base timestamptz;
  cand jsonb := '[]'; out_slots jsonb; row_cnt int; earliest timestamptz;
  sp biz_special_dates; eff_start int; eff_end int;
  v_need boolean; v_room record;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  perform biz_release_expired();
  select duration_min, min_notice_min, coalesce(capacity,1) into v_dur, v_notice, v_cap
    from biz_services where id = p_service_id and client_email = p_email;
  if v_dur is null then return jsonb_build_object('error','service not found'); end if;
  earliest := now() + (v_notice||' min')::interval;
  v_need := public._biz_res_exige(p_service_id);

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
    select e.dur, e.bb, e.ba into v_d, v_bb, v_ba from public._biz_eff(rec.pro_id, p_service_id) e;
    row_cnt := 0;
    for i in 0..p_days loop
      day_date := (now() at time zone rec.tz)::date + i;
      if extract(dow from day_date)::int <> rec.weekday then continue; end if;
      eff_start := rec.start_min; eff_end := rec.end_min;
      sp := _biz_special_for(p_email, day_date);
      if sp.id is not null then
        if sp.closed then continue; end if;
        eff_start := greatest(eff_start, sp.open_min); eff_end := least(eff_end, sp.close_min);
        if eff_start + v_d > eff_end then continue; end if;
      end if;
      base := ((day_date::text||' 00:00')::timestamp + (eff_start||' min')::interval) at time zone rec.tz;
      slot := base;
      while eff_start + (extract(epoch from (slot - base))/60)::int + v_d <= eff_end loop
        if slot >= earliest and (
             select count(*) from biz_appointments a
             cross join lateral public._biz_eff(a.pro_id, a.service_id) ae
             where a.pro_id = rec.pro_id and a.status <> 'cancelled'
               and (a.expires_at is null or a.expires_at > now())
               and tstzrange(lower(a.span) - (ae.bb||' min')::interval, upper(a.span) + (ae.ba||' min')::interval)
                   && tstzrange(slot - (v_bb||' min')::interval, slot + ((v_d+v_ba)||' min')::interval)) < v_cap then
          if not v_need then
            cand := cand || jsonb_build_object('start', slot, 'pro_id', rec.pro_id, 'pro', rec.pro_name,
                                               'location_id', rec.location_id, 'location', rec.loc_name, 'duration_min', v_d);
            row_cnt := row_cnt + 1;
            exit when row_cnt >= p_limit;
          else
            select l.id, l.name into v_room
              from public._biz_res_livre(p_email, p_service_id, rec.location_id,
                     tstzrange(slot - make_interval(mins => v_bb), slot + make_interval(mins => v_d + v_ba))) l limit 1;
            if v_room.id is not null then
              cand := cand || jsonb_build_object('start', slot, 'pro_id', rec.pro_id, 'pro', rec.pro_name,
                                                 'location_id', rec.location_id, 'location', rec.loc_name,
                                                 'resource_id', v_room.id, 'resource', v_room.name, 'duration_min', v_d);
              row_cnt := row_cnt + 1;
              exit when row_cnt >= p_limit;
            end if;
          end if;
        end if;
        slot := slot + (v_d||' min')::interval;
      end loop;
      exit when row_cnt >= p_limit;
    end loop;
  end loop;

  select coalesce(jsonb_agg(e order by (e->>'start')::timestamptz), '[]'::jsonb)
    into out_slots
    from (select e from jsonb_array_elements(cand) e order by (e->>'start')::timestamptz limit p_limit) s;

  return jsonb_build_object(
    'duration_min', v_dur,
    'deposit_cents', (select deposit_cents from biz_services where id = p_service_id),
    'slots', coalesce(out_slots, '[]'::jsonb));
end $function$;

-- _biz_res_reserve: a sala fica presa durante preparo e limpeza DA PROFISSIONAL (antes: os do serviço).
create or replace function public._biz_res_reserve(p_appt uuid, p_prefer uuid default null)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare a biz_appointments; v_bb int; v_ba int; v_span tstzrange; v_room uuid; v_pular uuid[] := '{}'::uuid[];
begin
  select * into a from biz_appointments where id = p_appt;
  if a.id is null or a.service_id is null or a.status in ('cancelled', 'canceled', 'no_show', 'blocked') then return null; end if;
  if not public._biz_res_exige(a.service_id) then return null; end if;
  select e.bb, e.ba into v_bb, v_ba from public._biz_eff(a.pro_id, a.service_id) e;
  v_span := tstzrange(lower(a.span) - make_interval(mins => coalesce(v_bb, 0)), upper(a.span) + make_interval(mins => coalesce(v_ba, 0)));
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
end $function$;

-- Comissão de uma linha do caixa: serviço com regra própria (%, fixo por unidade, nada) > % geral da profissional.
create or replace function public._desk_comissao(p_email text, p_pro uuid, p_kind text, p_ref uuid, p_total bigint, p_qty int)
returns bigint language plpgsql stable security definer set search_path to 'public' as $$
declare r biz_pro_services; v_pct numeric;
begin
  if p_pro is null or p_kind not in ('service', 'product') then return 0; end if;
  if p_kind = 'service' and p_ref is not null then
    select * into r from biz_pro_services where pro_id = p_pro and service_id = p_ref;
    if r.pay_type = 'none' then return 0; end if;
    if r.pay_type = 'flat' then return round(coalesce(r.pay_amount, 0) * greatest(coalesce(p_qty, 1), 1)); end if;
    if r.pay_type = 'pct' then return round(p_total * coalesce(r.pay_amount, 0) / 100.0); end if;
  end if;
  select case when p_kind = 'service' then coalesce((config->>'commission_service_pct')::numeric, 0)
              else coalesce((config->>'commission_product_pct')::numeric, 0) end into v_pct
    from biz_professionals where id = p_pro and client_email = p_email;
  return round(p_total * coalesce(v_pct, 0) / 100.0);
end $$;
revoke all on function public._desk_comissao(text, uuid, text, uuid, bigint, int) from public, anon, authenticated;

-- desk_checkout: troca SÓ o bloco da comissão pela chamada a _desk_comissao (patch textual, roda uma vez).
do $p$
declare d text := pg_get_functiondef('public.desk_checkout(text,text,jsonb)'::regprocedure); n text;
begin
  if position('_desk_comissao' in d) > 0 then return; end if;
  n := replace(d,
    E'      select case when v_kind = \'service\' then coalesce((config->>\'commission_service_pct\')::numeric, 0)\n' ||
    E'                  else coalesce((config->>\'commission_product_pct\')::numeric, 0) end into v_pct\n' ||
    E'        from biz_professionals where id = (l->>\'pro_id\')::uuid and client_email = e;\n' ||
    E'      v_comm := round(v_tot * coalesce(v_pct, 0) / 100.0);',
    E'      v_comm := public._desk_comissao(e, (l->>\'pro_id\')::uuid, v_kind, nullif(l->>\'ref_id\', \'\')::uuid, v_tot, v_qty);');
  if n = d then raise exception 'desk_v10: bloco da comissão não encontrado em desk_checkout — nada alterado'; end if;
  execute n;
end $p$;

-- desk_staff_save: `services` (ids) continua ligando quem faz o quê, mas agora PRESERVA as regras já salvas;
-- `service_rules` [{service_id, duration_min?, prep_min?, finish_min?, pay_type?, pay_amount?}] grava a regra
-- (null/"" = volta ao padrão). Regra de serviço que ela não faz é ignorada.
create or replace function public.desk_staff_save(p_email text, p_key text, p_pro jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare e text := public._desk_ok(p_email, p_key); v_id uuid := nullif(p_pro->>'id', '')::uuid; r jsonb; v_sid uuid; v_pt text; v_pa numeric;
begin
  if v_id is not null and not exists (select 1 from biz_professionals where id = v_id and client_email = e) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_id is null then
    if coalesce(trim(p_pro->>'name'), '') = '' then return jsonb_build_object('ok', false, 'reason', 'name_required'); end if;
    insert into biz_professionals (client_email, name, title, active, kind, config)
      values (e, left(trim(p_pro->>'name'), 120), left(p_pro->>'title', 120), true, coalesce(nullif(p_pro->>'kind', ''), 'staff'), '{}'::jsonb)
      returning id into v_id;
  end if;
  update biz_professionals set
    name = coalesce(nullif(left(trim(p_pro->>'name'), 120), ''), name),
    title = case when p_pro ? 'title' then left(p_pro->>'title', 120) else title end,
    active = case when p_pro ? 'active' then (p_pro->>'active')::boolean else active end,
    kind = case when p_pro ? 'kind' and p_pro->>'kind' in ('staff', 'room', 'equipment', 'table', 'bay', 'agent') then p_pro->>'kind' else kind end,
    config = coalesce(config, '{}'::jsonb)
             || case when p_pro ? 'color' then jsonb_build_object('color', left(p_pro->>'color', 16)) else '{}'::jsonb end
             || case when p_pro ? 'commission_service_pct' then jsonb_build_object('commission_service_pct', least(greatest((p_pro->>'commission_service_pct')::numeric, 0), 100)) else '{}'::jsonb end
             || case when p_pro ? 'commission_product_pct' then jsonb_build_object('commission_product_pct', least(greatest((p_pro->>'commission_product_pct')::numeric, 0), 100)) else '{}'::jsonb end
  where id = v_id and client_email = e;
  if jsonb_typeof(p_pro->'services') = 'array' then
    delete from biz_pro_services where pro_id = v_id and service_id::text not in (select jsonb_array_elements_text(p_pro->'services'));
    insert into biz_pro_services (pro_id, service_id)
      select v_id, s.id from biz_services s where s.client_email = e and s.id::text in (select jsonb_array_elements_text(p_pro->'services'))
      on conflict (pro_id, service_id) do nothing;
  end if;
  if jsonb_typeof(p_pro->'service_rules') = 'array' then
    for r in select * from jsonb_array_elements(p_pro->'service_rules') loop
      v_sid := nullif(r->>'service_id', '')::uuid;
      if v_sid is null or not exists (select 1 from biz_pro_services ps join biz_services s on s.id = ps.service_id where ps.pro_id = v_id and ps.service_id = v_sid and s.client_email = e) then continue; end if;
      v_pt := case when r->>'pay_type' in ('pct', 'flat', 'none') then r->>'pay_type' else null end;
      v_pa := case when v_pt = 'pct' then least(greatest(coalesce(nullif(r->>'pay_amount', '')::numeric, 0), 0), 100)
                   when v_pt = 'flat' then greatest(coalesce(nullif(r->>'pay_amount', '')::numeric, 0), 0)
                   else null end;
      update biz_pro_services set
        duration_min = case when r ? 'duration_min' then (case when nullif(r->>'duration_min', '') is null then null else greatest((r->>'duration_min')::int, 5) end) else duration_min end,
        prep_min     = case when r ? 'prep_min'     then (case when nullif(r->>'prep_min', '')     is null then null else least(greatest((r->>'prep_min')::int, 0), 240) end) else prep_min end,
        finish_min   = case when r ? 'finish_min'   then (case when nullif(r->>'finish_min', '')   is null then null else least(greatest((r->>'finish_min')::int, 0), 240) end) else finish_min end,
        pay_type     = case when r ? 'pay_type' then v_pt else pay_type end,
        pay_amount   = case when r ? 'pay_type' then v_pa else pay_amount end
      where pro_id = v_id and service_id = v_sid;
    end loop;
  end if;
  if jsonb_typeof(p_pro->'locations') = 'array' then
    delete from biz_pro_locations where pro_id = v_id;
    insert into biz_pro_locations (pro_id, location_id)
      select v_id, l.id from biz_locations l where l.client_email = e and l.id::text in (select jsonb_array_elements_text(p_pro->'locations'));
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $function$;

-- As regras do negócio (só as linhas com algo preenchido). O /api/desk junta na agenda como `pro_rules`.
create or replace function public.desk_pro_rules(p_email text, p_key text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('pro_id', ps.pro_id, 'service_id', ps.service_id, 'duration_min', ps.duration_min,
            'prep_min', ps.prep_min, 'finish_min', ps.finish_min, 'pay_type', ps.pay_type, 'pay_amount', ps.pay_amount))
     from biz_pro_services ps join biz_professionals p on p.id = ps.pro_id
    where p.client_email = e and (ps.duration_min is not null or ps.prep_min is not null or ps.finish_min is not null or ps.pay_type is not null)), '[]'::jsonb);
end $$;

revoke all on function public.desk_pro_rules(text, text) from public;
grant execute on function public.desk_pro_rules(text, text) to anon, authenticated, service_role;
