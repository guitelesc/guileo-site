-- GUILEO MOTOR v3 — onboarding em massa + achar agendamento por contato. Cole tudo e RUN.

-- IMPORT: cadastra um negócio inteiro de uma vez a partir de um JSON (os 33 médicos numa tacada).
-- payload: { "replace": true|false,
--   "locations":[{"name","city","address","phone","tz"}],
--   "services":[{"name","duration_min","price_cents","buffer_before_min","buffer_after_min","min_notice_min","capacity","deposit_cents","config"}],
--   "professionals":[{"name","title","kind","config","services":["<nome>"],"locations":["<nome>"],
--                     "schedule":[{"location":"<nome>","weekday":0-6,"start_min":540,"end_min":1020}]}] }
create or replace function biz_admin_import(p_secret text, p_email text, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare loc jsonb; svc jsonb; pro jsonb; sch jsonb;
  loc_map jsonb := '{}'::jsonb; svc_map jsonb := '{}'::jsonb;
  lid uuid; sid uuid; pid uuid; nloc int:=0; nsvc int:=0; npro int:=0;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  if coalesce(p_payload->>'replace','false') = 'true' then
    delete from biz_appointments where client_email=p_email;
    delete from biz_schedules where pro_id in (select id from biz_professionals where client_email=p_email);
    delete from biz_pro_services where pro_id in (select id from biz_professionals where client_email=p_email);
    delete from biz_pro_locations where pro_id in (select id from biz_professionals where client_email=p_email);
    delete from biz_professionals where client_email=p_email;
    delete from biz_services where client_email=p_email;
    delete from biz_locations where client_email=p_email;
  end if;
  for loc in select value from jsonb_array_elements(coalesce(p_payload->'locations','[]'::jsonb)) loop
    insert into biz_locations(client_email,name,city,address,phone,tz)
      values(p_email, loc->>'name', loc->>'city', loc->>'address', loc->>'phone', coalesce(loc->>'tz','America/New_York'))
      returning id into lid;
    loc_map := loc_map || jsonb_build_object(loc->>'name', lid::text); nloc:=nloc+1;
  end loop;
  for svc in select value from jsonb_array_elements(coalesce(p_payload->'services','[]'::jsonb)) loop
    insert into biz_services(client_email,name,duration_min,price_cents,buffer_before_min,buffer_after_min,min_notice_min,capacity,deposit_cents,config)
      values(p_email, svc->>'name', coalesce((svc->>'duration_min')::int,30), (svc->>'price_cents')::int,
             coalesce((svc->>'buffer_before_min')::int,0), coalesce((svc->>'buffer_after_min')::int,0),
             coalesce((svc->>'min_notice_min')::int,0), coalesce((svc->>'capacity')::int,1),
             (svc->>'deposit_cents')::int, coalesce(svc->'config','{}'::jsonb))
      returning id into sid;
    svc_map := svc_map || jsonb_build_object(svc->>'name', sid::text); nsvc:=nsvc+1;
  end loop;
  for pro in select value from jsonb_array_elements(coalesce(p_payload->'professionals','[]'::jsonb)) loop
    insert into biz_professionals(client_email,name,title,kind,config)
      values(p_email, pro->>'name', pro->>'title', coalesce(pro->>'kind','staff'), coalesce(pro->'config','{}'::jsonb))
      returning id into pid;
    npro:=npro+1;
    if pro ? 'services' then
      insert into biz_pro_services(pro_id,service_id)
        select pid, (svc_map->>x)::uuid from jsonb_array_elements_text(pro->'services') x where svc_map ? x;
    end if;
    if pro ? 'locations' then
      insert into biz_pro_locations(pro_id,location_id)
        select pid, (loc_map->>x)::uuid from jsonb_array_elements_text(pro->'locations') x where loc_map ? x;
    end if;
    if pro ? 'schedule' then
      for sch in select value from jsonb_array_elements(pro->'schedule') loop
        insert into biz_schedules(pro_id,location_id,weekday,start_min,end_min)
          values(pid, (loc_map->>(sch->>'location'))::uuid, (sch->>'weekday')::int, (sch->>'start_min')::int, (sch->>'end_min')::int);
      end loop;
    end if;
  end loop;
  return jsonb_build_object('ok',true,'locations',nloc,'services',nsvc,'professionals',npro);
end $$;

-- FIND: agendamentos futuros de um cliente pelo telefone/email (pra remarcar/cancelar por voz)
create or replace function biz_find_appointments(p_secret text, p_email text, p_contact text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'service',s.name,'pro',p.name,'location',l.name,'start',lower(a.span),'status',a.status) order by lower(a.span)),'[]'::jsonb)
    into v from biz_appointments a
    left join biz_services s on s.id=a.service_id
    left join biz_professionals p on p.id=a.pro_id
    left join biz_locations l on l.id=a.location_id
    where a.client_email=p_email and a.customer_contact=p_contact and a.status<>'cancelled' and lower(a.span) > now();
  return jsonb_build_object('appointments', coalesce(v,'[]'::jsonb));
end $$;
