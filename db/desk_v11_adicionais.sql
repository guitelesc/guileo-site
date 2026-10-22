-- GUILEO DESK v11 — Adicionais (add-ons) na marcação e no caixa (2026-10-21, Onda 1 item 4)
-- No MindBody um AddOn é um serviço "extra" vendido junto com outro (barba, aromaterapia, upgrade de pedra quente),
-- com minutos próprios (até 0 = só venda, não ocupa tempo) e preço próprio. Aqui:
--   · o serviço ganha a marca config.addon = true (desk_service_save aceita `addon`); adicional pode ter 0 min.
--   · biz_book lê p_attributes->'addons' (ids) → valida (mesmo negócio, ativo, addon) → grava um RETRATO
--     [{service_id, name, duration_min, price_cents}] em attributes.addons e SOMA os minutos à duração.
--     Quem chama (balcão, Lilian, site) não muda de assinatura: basta mandar addons nos atributos.
--   · biz_book_group passa `addons` de cada pessoa.
--   · desk_addons_set troca os adicionais de um agendamento aberto e refaz o fim do horário (o gatilho julga o
--     choque; a sala acompanha pelo _biz_res_sync).
--   · desk_addons devolve, para a agenda, quais serviços são adicionais e os adicionais de cada agendamento.
--   · Caixa: nada novo — o adicional é uma linha kind 'service' com ref_id do adicional (preço do cadastro,
--     comissão pela regra profissional × serviço). A tela pré-preenche a partir de attributes.addons.
-- Idempotente: create or replace.

-- Retrato validado dos adicionais pedidos + minutos que eles somam.
create or replace function public._biz_addons_snapshot(p_email text, p_ids jsonb)
returns table(snapshot jsonb, minutos int) language sql stable security definer set search_path to 'public' as $$
  with ids as (select distinct x.v::uuid id from jsonb_array_elements_text(case when jsonb_typeof(p_ids) = 'array' then p_ids else '[]'::jsonb end) x(v)
               where x.v ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
       svc as (select s.id, s.name, coalesce(s.duration_min, 0) dur, coalesce(s.price_cents, 0) price
                 from biz_services s join ids on ids.id = s.id
                where s.client_email = p_email and coalesce(s.active, true) and coalesce((s.config->>'addon')::boolean, false))
  select coalesce((select jsonb_agg(jsonb_build_object('service_id', id, 'name', name, 'duration_min', dur, 'price_cents', price) order by name) from svc), '[]'::jsonb),
         coalesce((select sum(dur)::int from svc), 0)
$$;
revoke all on function public._biz_addons_snapshot(text, jsonb) from public, anon, authenticated;

-- biz_book: igual ao desk_v10, mais os adicionais (retrato em attributes.addons; minutos somados à duração).
create or replace function public.biz_book(p_secret text, p_email text, p_pro_id uuid, p_location_id uuid, p_service_id uuid, p_name text, p_contact text, p_start timestamptz, p_attributes jsonb default '{}'::jsonb, p_hold_min integer default null, p_request_id text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_dur int; v_id uuid; v_status text; v_exp timestamptz; v_ref text; v_existing record; v_tz text; sp biz_special_dates; v_res uuid;
        v_attrs jsonb := coalesce(p_attributes, '{}'::jsonb); v_snap jsonb; v_extra int := 0;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  if p_request_id is not null and p_request_id <> '' then
    select id, ref, status into v_existing from biz_appointments where client_email=p_email and request_id=p_request_id and status<>'cancelled' limit 1;
    if v_existing.id is not null then return jsonb_build_object('ok',true,'appointment_id',v_existing.id,'ref',v_existing.ref,'status',v_existing.status,'idempotent',true); end if;
  end if;
  perform biz_release_expired();
  select e.dur into v_dur from public._biz_eff(p_pro_id, p_service_id) e;
  if v_dur is null or not exists (select 1 from biz_services where id=p_service_id and client_email=p_email) then v_dur := coalesce(v_dur, 30); end if;
  -- desk_v11: adicionais pedidos → retrato validado + minutos somados. Pedido sem adicional válido fica sem a chave.
  if v_attrs ? 'addons' then
    select s.snapshot, s.minutos into v_snap, v_extra from public._biz_addons_snapshot(p_email, v_attrs->'addons') s;
    v_attrs := v_attrs - 'addons' || case when jsonb_array_length(v_snap) > 0 then jsonb_build_object('addons', v_snap) else '{}'::jsonb end;
    v_dur := v_dur + coalesce(v_extra, 0);
  end if;
  if p_hold_min is not null then v_status:='hold'; v_exp:=now()+(p_hold_min||' min')::interval; else v_status:='booked'; end if;
  v_ref := 'GUI-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
  begin
    insert into biz_appointments(client_email,location_id,pro_id,service_id,customer_name,customer_contact,span,status,expires_at,attributes,ref,request_id)
    values (p_email,p_location_id,p_pro_id,p_service_id,p_name,p_contact, tstzrange(p_start,p_start+(v_dur||' min')::interval), v_status, v_exp, v_attrs, v_ref, nullif(p_request_id,'')) returning id into v_id;
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
        values (p_email,p_location_id,p_pro_id,p_service_id,p_name,p_contact, tstzrange(p_start,p_start+(v_dur||' min')::interval), v_status, v_exp, v_attrs, v_ref, null) returning id into v_id;
        v_res := public._biz_res_reserve(v_id);
      exception
        when sqlstate 'GUI01' then return jsonb_build_object('ok',false,'reason','slot_taken');
        when sqlstate 'GUI03' then return jsonb_build_object('ok',false,'reason','resource_unavailable');
        when others then return jsonb_build_object('ok',false,'reason','book_failed');
      end;
  end;
  if v_id is null then return jsonb_build_object('ok',false,'reason','book_failed'); end if;
  return jsonb_build_object('ok',true,'appointment_id',v_id,'ref',v_ref,'status',v_status,'start',p_start,'duration_min',v_dur,'expires_at',v_exp)
         || case when v_snap is not null and jsonb_array_length(v_snap) > 0 then jsonb_build_object('addons', v_snap) else '{}'::jsonb end
         || case when v_res is null then '{}'::jsonb
                 else jsonb_build_object('resource_id', v_res, 'resource', (select name from biz_professionals where id = v_res)) end;
end $function$;

-- biz_book_group: igual ao desk_v9, mais `addons` por pessoa (vai nos atributos; biz_book valida e soma).
create or replace function public.biz_book_group(p_secret text, p_email text, p_location_id uuid, p_items jsonb,
  p_attributes jsonb default '{}'::jsonb, p_request_id text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  n int := coalesce(jsonb_array_length(p_items), 0);
  v_gid uuid := gen_random_uuid();
  v_rot text := case when coalesce(jsonb_array_length(p_items), 0) = 2 then 'casal' else 'grupo' end;
  it jsonb; i int; r jsonb; v_out jsonb := '[]'::jsonb; v_falha jsonb; v_idem int := 0;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error', 'unauthorized'); end if;
  if jsonb_typeof(p_items) is distinct from 'array' or n < 2 or n > 6 then
    return jsonb_build_object('ok', false, 'reason', 'group_size');
  end if;
  if p_location_id is null or not exists (select 1 from biz_locations where id = p_location_id and client_email = p_email) then
    return jsonb_build_object('ok', false, 'reason', 'location_not_found');
  end if;
  for i in 0 .. n - 1 loop
    it := p_items -> i;
    if not exists (select 1 from biz_professionals where id = (it->>'pro_id')::uuid and client_email = p_email)
       or not exists (select 1 from biz_services where id = (it->>'service_id')::uuid and client_email = p_email)
       or coalesce(trim(it->>'name'), '') = '' or (it->>'start') is null then
      return jsonb_build_object('ok', false, 'reason', 'invalid_item', 'index', i + 1);
    end if;
  end loop;
  if coalesce(p_request_id, '') <> '' then
    select (a.attributes->>'grupo')::uuid into v_gid from biz_appointments a
     where a.client_email = p_email and a.request_id = p_request_id || ':1' and a.status <> 'cancelled' and a.attributes ? 'grupo' limit 1;
    if v_gid is null then v_gid := gen_random_uuid(); end if;
  end if;

  begin
    for i in 0 .. n - 1 loop
      it := p_items -> i;
      r := public.biz_book(p_secret, p_email, (it->>'pro_id')::uuid, p_location_id, (it->>'service_id')::uuid,
             left(trim(it->>'name'), 120), left(coalesce(it->>'contact', ''), 120), (it->>'start')::timestamptz,
             coalesce(p_attributes, '{}'::jsonb)
               || jsonb_build_object('grupo', v_gid, 'grupo_n', i + 1, 'grupo_total', n, 'grupo_rotulo', v_rot)
               || case when coalesce(it->>'note', '') <> '' then jsonb_build_object('desk_note', left(it->>'note', 1000)) else '{}'::jsonb end
               || case when jsonb_typeof(it->'addons') = 'array' then jsonb_build_object('addons', it->'addons') else '{}'::jsonb end,
             null, case when coalesce(p_request_id, '') <> '' then p_request_id || ':' || (i + 1) else null end);
      if coalesce((r->>'ok')::boolean, false) is not true or (r->>'appointment_id') is null then
        v_falha := jsonb_build_object('ok', false, 'reason', coalesce(r->>'reason', r->>'error', 'book_failed'), 'index', i + 1,
                     'name', it->>'name', 'pro_id', it->>'pro_id', 'start', it->>'start');
        raise exception 'group_item_failed' using errcode = 'GUI09';
      end if;
      if coalesce((r->>'idempotent')::boolean, false) then v_idem := v_idem + 1; end if;
      v_out := v_out || (jsonb_build_object('index', i + 1, 'appointment_id', r->>'appointment_id', 'ref', r->>'ref', 'name', it->>'name')
               || case when r ? 'resource' then jsonb_build_object('resource', r->>'resource') else '{}'::jsonb end
               || case when r ? 'addons' then jsonb_build_object('addons', r->'addons') else '{}'::jsonb end);
    end loop;
  exception when sqlstate 'GUI09' then
    return v_falha || jsonb_build_object('booked', 0);
  end;

  return jsonb_build_object('ok', true, 'grupo', v_gid, 'rotulo', v_rot, 'total', n, 'appointments', v_out, 'idempotent', v_idem = n);
end $$;

-- Trocar os adicionais de um agendamento ABERTO: refaz o fim do horário (duração dela + adicionais); o gatilho julga.
create or replace function public.desk_addons_set(p_email text, p_key text, p_id uuid, p_addons jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); a biz_appointments; v_snap jsonb; v_extra int; v_dur int;
begin
  select * into a from biz_appointments where id = p_id and client_email = e;
  if a.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if a.status in ('cancelled', 'completed', 'no_show', 'blocked') then return jsonb_build_object('ok', false, 'reason', 'closed_status'); end if;
  select s.snapshot, s.minutos into v_snap, v_extra from public._biz_addons_snapshot(e, p_addons) s;
  select x.dur into v_dur from public._biz_eff(a.pro_id, a.service_id) x;
  v_dur := coalesce(v_dur, 30) + coalesce(v_extra, 0);
  begin
    update biz_appointments set
      span = tstzrange(lower(span), lower(span) + make_interval(mins => v_dur)),
      attributes = (coalesce(attributes, '{}'::jsonb) - 'addons') || case when jsonb_array_length(v_snap) > 0 then jsonb_build_object('addons', v_snap) else '{}'::jsonb end
     where id = p_id and client_email = e;
  exception
    when sqlstate 'GUI01' then return jsonb_build_object('ok', false, 'reason', 'slot_taken');
    when sqlstate 'GUI02' then return jsonb_build_object('ok', false, 'reason', 'closed_date');
    when sqlstate 'GUI03' then return jsonb_build_object('ok', false, 'reason', 'resource_unavailable');
  end;
  return jsonb_build_object('ok', true, 'id', p_id, 'addons', v_snap, 'start', lower(a.span), 'end', lower(a.span) + make_interval(mins => v_dur), 'duration_min', v_dur);
end $$;

-- Para a agenda: quais serviços são adicionais, e os adicionais de cada agendamento do intervalo.
create or replace function public.desk_addons(p_email text, p_key text, p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key);
begin
  return jsonb_build_object('ok', true,
    'addon_ids', coalesce((select jsonb_agg(s.id) from biz_services s where s.client_email = e and coalesce((s.config->>'addon')::boolean, false)), '[]'::jsonb),
    'appointments', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'addons', a.attributes->'addons'))
       from public.vivo_biz_appointments(e) a
      where jsonb_typeof(a.attributes->'addons') = 'array' and jsonb_array_length(a.attributes->'addons') > 0
        and a.span && tstzrange(coalesce(p_from, now() - interval '1 day'), coalesce(p_to, now() + interval '1 day'))), '[]'::jsonb));
end $$;

-- desk_service_save: igual ao de antes, mais `addon` (config.addon) e duração mínima 0 para adicional (só venda).
create or replace function public.desk_service_save(p_email text, p_key text, p_svc jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare e text := public._desk_ok(p_email, p_key); v_id uuid := nullif(p_svc->>'id', '')::uuid; v_rec jsonb := '[]'::jsonb;
        v_addon boolean := coalesce((p_svc->>'addon')::boolean, false); v_min int;
begin
  if v_id is not null and not exists (select 1 from biz_services where id = v_id and client_email = e) then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if p_svc ? 'recursos' then
    select coalesce(jsonb_agg(to_jsonb(q.id) order by q.ord), '[]'::jsonb) into v_rec
      from (select r.id, min(x.ord) ord
              from jsonb_array_elements_text(case when jsonb_typeof(p_svc->'recursos') = 'array' then p_svc->'recursos' else '[]'::jsonb end) with ordinality x(v, ord)
              join biz_professionals r on r.id::text = x.v and r.client_email = e and r.kind in ('room', 'equipment')
             group by r.id) q;
  end if;
  -- adicional pode ter 0 min (só venda); serviço comum continua com o mínimo de 5
  v_min := case when (p_svc ? 'addon' and v_addon) or (not (p_svc ? 'addon') and v_id is not null and exists (select 1 from biz_services where id = v_id and coalesce((config->>'addon')::boolean, false))) then 0 else 5 end;
  if v_id is null then
    if coalesce(trim(p_svc->>'name'), '') = '' then return jsonb_build_object('ok', false, 'reason', 'name_required'); end if;
    insert into biz_services (client_email, name, duration_min, price_cents, active) values (e, left(trim(p_svc->>'name'), 160),
      greatest(coalesce((p_svc->>'duration_min')::int, 60), v_min), greatest(coalesce((p_svc->>'price_cents')::int, 0), 0), true) returning id into v_id;
  end if;
  update biz_services set
    name = coalesce(nullif(left(trim(p_svc->>'name'), 160), ''), name),
    duration_min = case when p_svc ? 'duration_min' then greatest((p_svc->>'duration_min')::int, v_min) else duration_min end,
    price_cents = case when p_svc ? 'price_cents' then greatest((p_svc->>'price_cents')::int, 0) else price_cents end,
    buffer_before_min = case when p_svc ? 'buffer_before_min' then greatest((p_svc->>'buffer_before_min')::int, 0) else buffer_before_min end,
    buffer_after_min = case when p_svc ? 'buffer_after_min' then greatest((p_svc->>'buffer_after_min')::int, 0) else buffer_after_min end,
    deposit_cents = case when p_svc ? 'deposit_cents' then greatest((p_svc->>'deposit_cents')::int, 0) else deposit_cents end,
    cancel_window_h = case when p_svc ? 'cancel_window_h' then greatest((p_svc->>'cancel_window_h')::int, 0) else cancel_window_h end,
    active = case when p_svc ? 'active' then (p_svc->>'active')::boolean else active end,
    config = (case when p_svc ? 'recursos' then coalesce(config, '{}'::jsonb) - 'recursos' else coalesce(config, '{}'::jsonb) end)
             || case when p_svc ? 'noshow_fee_cents' then jsonb_build_object('noshow_fee_cents', greatest((p_svc->>'noshow_fee_cents')::int, 0)) else '{}'::jsonb end
             || case when p_svc ? 'category' then jsonb_build_object('category', left(p_svc->>'category', 60)) else '{}'::jsonb end
             || case when p_svc ? 'recursos' and jsonb_array_length(v_rec) > 0 then jsonb_build_object('recursos', v_rec) else '{}'::jsonb end
             || case when p_svc ? 'addon' then jsonb_build_object('addon', v_addon) else '{}'::jsonb end,
    updated_at = now()
  where id = v_id and client_email = e;
  return jsonb_build_object('ok', true, 'id', v_id);
end $function$;

revoke all on function public.desk_addons_set(text, text, uuid, jsonb) from public;
grant execute on function public.desk_addons_set(text, text, uuid, jsonb) to anon, authenticated, service_role;
revoke all on function public.desk_addons(text, text, timestamptz, timestamptz) from public;
grant execute on function public.desk_addons(text, text, timestamptz, timestamptz) to anon, authenticated, service_role;
