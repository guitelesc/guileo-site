-- RESTAURAÇÃO (2026-10-21, ~23:55) — o db/desk_v2.sql foi rodado de novo no SQL Editor e trocou 7 funções
-- do balcão pela versão de 05/10. Prova ao vivo antes desta restauração: catalog.packages sem valid_days/activation,
-- services da agenda sem pkg_sessions. Este arquivo devolve cada uma ao estado de antes, NA ORDEM ORIGINAL:
--   desk_v5_salas (agenda com salas) → desk_v10 (equipe com regra por serviço + comissão no caixa)
--   → desk_v11 (serviço adicional) → desk_v13 (pacotes: validade, ativação, débito de N sessões)
--   → desk_v13_1 (estorno devolve as N sessões).
-- Funções inteiras são cópia literal dos arquivos; os remendos são os MESMOS blocos (cada um se reconhece e
-- roda uma vez; se o texto esperado não existir, para com erro e NADA muda).
-- O que o desk_v2 também fez e NÃO precisa voltar: criar tabelas "if not exists" (nada), permissões (iguais),
-- e um update de linhas antigas do v1 (status in_progress/completed) que hoje não existem mais.
-- Rodar no SQL Editor do projeto ynihodbknhjirkdogxby. Última linha: tem de devolver restaurado = true.

begin;


-- ═══ 1. desk_agenda (desk_v5_salas.sql) ═══
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

-- ═══ 2. desk_staff_save (desk_v10_pro_servico.sql) ═══
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

-- ═══ 3. desk_checkout: comissão pela regra (desk_v10) ═══
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

-- ═══ 4. desk_service_save (desk_v11_adicionais.sql) ═══
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

-- ═══ desk_v13 · desk_checkout: resgate de pacote com N sessões ═══
do $p$
declare d text := pg_get_functiondef('public.desk_checkout(text,text,jsonb)'::regprocedure); n text;
begin
  if position('_desk_pp_redeem' in d) > 0 then return; end if;
  n := replace(d,
    E'      select * into v_pp from package_purchases where id = (pg->>\'ref\')::uuid and client_email = e for update;\n' ||
    E'      if v_pp.id is null or v_pp.sessions_used >= v_pp.sessions_total then raise exception \'package_empty\' using errcode = \'GUI13\'; end if;\n' ||
    E'      update package_purchases set sessions_used = sessions_used + 1 where id = v_pp.id;',
    E'      v_pp := public._desk_pp_redeem(e, (pg->>\'ref\')::uuid, coalesce((select (s.config->>\'pkg_sessions\')::int from biz_services s\n' ||
    E'                where s.id = nullif(pg->>\'service_id\', \'\')::uuid and s.client_email = e), 1));');
  if n = d then raise exception 'desk_v13: bloco do resgate não encontrado em desk_checkout — nada alterado'; end if;
  execute n;
end $p$;

-- ═══ desk_v13 · desk_catalog: validade/ativação ═══
do $p$
declare d text := pg_get_functiondef('public.desk_catalog(text,text)'::regprocedure); n text;
begin
  if position('''valid_days'', valid_days' in d) > 0 then return; end if;
  n := replace(d, E'''price_cents'', price_cents) order by name) from packages', E'''price_cents'', price_cents, ''valid_days'', valid_days, ''activation'', activation) order by name) from packages');
  if n = d then raise exception 'desk_v13: packages do catálogo não encontrado em desk_catalog — nada alterado'; end if;
  execute n;
end $p$;

-- ═══ desk_v13 · desk_client_card: situação do pacote ═══
do $p$
declare d text := pg_get_functiondef('public.desk_client_card(text,text,text)'::regprocedure); n text;
begin
  if position('_desk_pp_status' in d) > 0 then return; end if;
  n := replace(d, E'''total'', pp.sessions_total, ''purchased_at'', pp.purchased_at) order by pp.purchased_at desc)',
    E'''total'', pp.sessions_total, ''purchased_at'', pp.purchased_at, ''activation'', pp.activation, ''activated_at'', pp.activated_at,\n' ||
    E'                ''expires_at'', pp.expires_at, ''status'', public._desk_pp_status(pp)) order by pp.purchased_at desc)');
  if n = d then raise exception 'desk_v13: packages da ficha não encontrado em desk_client_card — nada alterado'; end if;
  execute n;
end $p$;

-- ═══ desk_v13 · desk_agenda: pkg_sessions ═══
do $p$
declare d text := pg_get_functiondef('public.desk_agenda(text,text,timestamptz,timestamptz)'::regprocedure); n text;
begin
  if position('pkg_sessions' in d) > 0 then return; end if;
  n := replace(d, E'''category'', s.config->>''category'')\n', E'''category'', s.config->>''category'', ''pkg_sessions'', greatest(coalesce((s.config->>''pkg_sessions'')::int, 1), 1))\n');
  if n = d then raise exception 'desk_v13: services da agenda não encontrado em desk_agenda — nada alterado'; end if;
  execute n;
end $p$;

-- ═══ desk_v13 · desk_service_save: pkg_sessions ═══
do $p$
declare d text := pg_get_functiondef('public.desk_service_save(text,text,jsonb)'::regprocedure); n text;
begin
  if position('pkg_sessions' in d) > 0 then return; end if;
  n := replace(d, E'             || case when p_svc ? ''addon'' then jsonb_build_object(''addon'', v_addon) else ''{}''::jsonb end,',
    E'             || case when p_svc ? ''addon'' then jsonb_build_object(''addon'', v_addon) else ''{}''::jsonb end\n' ||
    E'             || case when p_svc ? ''pkg_sessions'' then jsonb_build_object(''pkg_sessions'', least(greatest(coalesce((p_svc->>''pkg_sessions'')::int, 1), 1), 20)) else ''{}''::jsonb end,');
  if n = d then raise exception 'desk_v13: bloco do config não encontrado em desk_service_save — nada alterado'; end if;
  execute n;
end $p$;

-- ═══ desk_v13_1 · estorno devolve as N sessões ═══
alter table desk_payments add column if not exists sessions int;

do $p$
declare d text := pg_get_functiondef('public.desk_checkout(text,text,jsonb)'::regprocedure); n text;
begin
  if position('client_email, method, amount_cents, ref, sessions)' in d) > 0 then return; end if;
  n := replace(d,
    E'insert into desk_payments (sale_id, client_email, method, amount_cents, ref) values (v_id, e, lower(pg->>\'method\'), (pg->>\'amount_cents\')::bigint, left(pg->>\'ref\', 80));',
    E'insert into desk_payments (sale_id, client_email, method, amount_cents, ref, sessions) values (v_id, e, lower(pg->>\'method\'), (pg->>\'amount_cents\')::bigint, left(pg->>\'ref\', 80),\n' ||
    E'      case when lower(pg->>\'method\') = \'package\' then greatest(coalesce((select (s.config->>\'pkg_sessions\')::int from biz_services s\n' ||
    E'                where s.id = nullif(pg->>\'service_id\', \'\')::uuid and s.client_email = e), 1), 1) end);');
  if n = d then raise exception 'desk_v13_1: insert do pagamento não encontrado em desk_checkout — nada alterado'; end if;
  execute n;
end $p$;

do $p$
declare d text := pg_get_functiondef('public.desk_void_sale(text,text,uuid,text)'::regprocedure); n text;
begin
  if position('coalesce(r.sessions, 1)' in d) > 0 then return; end if;
  n := replace(d, 'set sessions_used = greatest(sessions_used - 1, 0) where id = r.ref::uuid',
                  'set sessions_used = greatest(sessions_used - coalesce(r.sessions, 1), 0) where id = r.ref::uuid');
  if n = d then raise exception 'desk_v13_1: devolução de sessão não encontrada em desk_void_sale — nada alterado'; end if;
  execute n;
end $p$;

commit;

-- ═══ CHECAGEM: cada marca de cada versão de volta no lugar ═══
select position('_biz_res_exige' in pg_get_functiondef('public.desk_agenda(text,text,timestamptz,timestamptz)'::regprocedure)) > 0
   and position('pkg_sessions' in pg_get_functiondef('public.desk_agenda(text,text,timestamptz,timestamptz)'::regprocedure)) > 0
   and position('service_rules' in pg_get_functiondef('public.desk_staff_save(text,text,jsonb)'::regprocedure)) > 0
   and position('v_addon' in pg_get_functiondef('public.desk_service_save(text,text,jsonb)'::regprocedure)) > 0
   and position('pkg_sessions' in pg_get_functiondef('public.desk_service_save(text,text,jsonb)'::regprocedure)) > 0
   and position('''valid_days'', valid_days' in pg_get_functiondef('public.desk_catalog(text,text)'::regprocedure)) > 0
   and position('_desk_pp_status' in pg_get_functiondef('public.desk_client_card(text,text,text)'::regprocedure)) > 0
   and position('_desk_comissao' in pg_get_functiondef('public.desk_checkout(text,text,jsonb)'::regprocedure)) > 0
   and position('_desk_pp_redeem' in pg_get_functiondef('public.desk_checkout(text,text,jsonb)'::regprocedure)) > 0
   and position('ref, sessions)' in pg_get_functiondef('public.desk_checkout(text,text,jsonb)'::regprocedure)) > 0
   and position('coalesce(r.sessions, 1)' in pg_get_functiondef('public.desk_void_sale(text,text,uuid,text)'::regprocedure)) > 0
   and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'desk_payments' and column_name = 'sessions')
   as restaurado;
