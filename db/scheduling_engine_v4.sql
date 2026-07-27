-- GUILEO MOTOR v4 — número de referência (confirmação) em todo agendamento. Cole e RUN. Aditivo.

-- nº de referência curto e humano (ex: GUI-7QK2) que o cliente guarda e cita
alter table biz_appointments add column if not exists ref text;

-- biz_book v4: gera o ref no booking e devolve (pra confirmação) — resto igual ao v2/v3
create or replace function biz_book(
  p_secret text, p_email text, p_pro_id uuid, p_location_id uuid, p_service_id uuid,
  p_name text, p_contact text, p_start timestamptz,
  p_attributes jsonb default '{}'::jsonb, p_hold_min int default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_dur int; v_id uuid; v_status text; v_exp timestamptz; v_ref text;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  perform biz_release_expired();
  select duration_min into v_dur from biz_services where id=p_service_id and client_email=p_email;
  if v_dur is null then v_dur := 30; end if;
  if p_hold_min is not null then v_status:='hold'; v_exp:=now()+(p_hold_min||' min')::interval; else v_status:='booked'; end if;
  v_ref := 'GUI-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
  begin
    insert into biz_appointments(client_email,location_id,pro_id,service_id,customer_name,customer_contact,span,status,expires_at,attributes,ref)
    values (p_email,p_location_id,p_pro_id,p_service_id,p_name,p_contact,
            tstzrange(p_start,p_start+(v_dur||' min')::interval), v_status, v_exp, coalesce(p_attributes,'{}'::jsonb), v_ref)
    returning id into v_id;
  exception when sqlstate 'GUI01' then return jsonb_build_object('ok',false,'reason','slot_taken');
  end;
  return jsonb_build_object('ok',true,'appointment_id',v_id,'ref',v_ref,'status',v_status,'start',p_start,'duration_min',v_dur,'expires_at',v_exp);
end $$;

-- biz_find_appointments v4: inclui o ref (pra cliente citar e o Gui achar)
create or replace function biz_find_appointments(p_secret text, p_email text, p_contact text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'ref',a.ref,'service',s.name,'pro',p.name,'location',l.name,'start',lower(a.span),'status',a.status) order by lower(a.span)),'[]'::jsonb)
    into v from biz_appointments a
    left join biz_services s on s.id=a.service_id
    left join biz_professionals p on p.id=a.pro_id
    left join biz_locations l on l.id=a.location_id
    where a.client_email=p_email and a.customer_contact=p_contact and a.status<>'cancelled' and lower(a.span) > now();
  return jsonb_build_object('appointments', coalesce(v,'[]'::jsonb));
end $$;
