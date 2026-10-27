-- GUILEO DESK v17 — ADICIONAIS NO /agendar (2026-10-23, ponta solta da Onda 1)
-- O motor já marca com adicionais (desk_v11: biz_book lê attributes.addons, valida, grava o retrato e SOMA os minutos).
-- Faltava a página pública: (1) a lista de adicionais que o site pode oferecer e (2) horários que CABEM com os
-- minutos a mais — sem isso o site ofereceria 15:00 para 60 min e o gatilho recusaria os 70.
--   1. vitrine_addons(tenant) — só service_role: adicionais ativos {id, name, duration_min, price_cents}.
--   2. biz_availability ganha um "tempo a mais" OPCIONAL, lido de uma configuração da TRANSAÇÃO (guileo.extra_min).
--      Sem ela (todo chamador de hoje: balcão, Lilian, site), o tempo a mais é 0 e o resultado é IDÊNTICO —
--      este arquivo PROVA isso: calcula a assinatura md5 de TODAS as vagas de TODOS os negócios antes e depois do
--      remendo e desfaz tudo se uma vaga mudar. O passo entre vagas continua o da duração do serviço.
--   3. biz_availability_x(…, p_extra_min) — mesmo portão (_gui_sched_ok): liga o tempo a mais só nesta chamada.
-- Idempotente: remendos que se reconhecem e param com erro (nada muda pela metade).

-- ═══ 1. a lista do site ════════════════════════════════════════════════════════════════════════
create or replace function public.vitrine_addons(p_tenant text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'duration_min', coalesce(s.duration_min, 0),
           'price_cents', s.price_cents) order by s.name), '[]'::jsonb)
    from biz_services s
   where s.client_email = lower(trim(coalesce(p_tenant, ''))) and coalesce(s.active, true)
     and coalesce((s.config->>'addon')::boolean, false)
$$;
revoke all on function public.vitrine_addons(text) from public, anon, authenticated;
grant execute on function public.vitrine_addons(text) to service_role;

-- ═══ 2. biz_availability: tempo a mais opcional + PROVA md5 de que, sem ele, nada muda ═══════════════
do $p$
declare d text := pg_get_functiondef('public.biz_availability(text,text,uuid,uuid,uuid,integer,integer)'::regprocedure);
        n text; v_sec text := coalesce(current_setting('app.gui_sched_secret', true), ''); antes text; depois text; vagas int;
  function_sig text := $q$
    select md5(coalesce(string_agg(x, '|' order by x), '')), coalesce(sum(n), 0)::int from (
      select s.client_email || ':' || s.id || ':' || coalesce(v::text, '') x, coalesce(jsonb_array_length(v->'slots'), 0) n
        from biz_services s cross join lateral (select public.biz_availability($1, s.client_email, s.id, null, null, 14, 40) v) a
       where coalesce(s.active, true)) q $q$;
begin
  if position('guileo.extra_min' in d) > 0 then return; end if;
  if v_sec = '' then raise exception 'desk_v17: esta sessão não enxerga app.gui_sched_secret — sem ele não dá para provar que a disponibilidade não muda. Nada foi alterado.'; end if;
  execute function_sig into antes, vagas using v_sec;
  n := d;
  n := replace(n, 'v_need boolean; v_room record;', 'v_need boolean; v_room record; v_x int := 0;');
  n := replace(n, E'    select e.dur, e.bb, e.ba into v_d, v_bb, v_ba from public._biz_eff(rec.pro_id, p_service_id) e;',
                  E'    select e.dur, e.bb, e.ba into v_d, v_bb, v_ba from public._biz_eff(rec.pro_id, p_service_id) e;\n' ||
                  E'    -- desk_v17: tempo a mais (adicionais da página pública) — só existe dentro de biz_availability_x; sem ele, 0\n' ||
                  E'    v_x := greatest(coalesce(nullif(current_setting(\'guileo.extra_min\', true), \'\')::int, 0), 0);');
  n := replace(n, 'if eff_start + v_d > eff_end then continue; end if;', 'if eff_start + v_d + v_x > eff_end then continue; end if;');
  n := replace(n, '(extract(epoch from (slot - base))/60)::int + v_d <= eff_end', '(extract(epoch from (slot - base))/60)::int + v_d + v_x <= eff_end');
  n := replace(n, 'slot + ((v_d+v_ba)||'' min'')::interval', 'slot + ((v_d+v_x+v_ba)||'' min'')::interval');
  n := replace(n, 'slot + make_interval(mins => v_d + v_ba)', 'slot + make_interval(mins => v_d + v_x + v_ba)');
  n := replace(n, '''duration_min'', v_d)', '''duration_min'', v_d + v_x)');
  -- cada trecho tem de ter entrado: conta as marcas novas
  if (length(n) - length(replace(n, 'v_x', ''))) / 3 <> 8 then
    raise exception 'desk_v17: a disponibilidade no ar não tem o texto esperado (achei % usos de v_x, esperava 8) — nada alterado', (length(n) - length(replace(n, 'v_x', ''))) / 3;
  end if;
  execute n;
  execute function_sig into depois, vagas using v_sec;
  if antes is distinct from depois then raise exception 'desk_v17: a disponibilidade MUDOU sem tempo a mais (md5 % → %) — nada alterado', antes, depois; end if;
  raise notice 'desk_v17: disponibilidade idêntica antes e depois (md5 %, % vagas)', antes, vagas;
end $p$;

-- ═══ 3. o tempo a mais, só nesta chamada (mesmo portão do motor) ═══════════════════════════════════
create or replace function public.biz_availability_x(p_secret text, p_email text, p_service_id uuid, p_location_id uuid default null,
  p_pro_id uuid default null, p_days integer default 14, p_limit integer default 8, p_extra_min integer default 0)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v jsonb;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error', 'unauthorized'); end if;
  perform set_config('guileo.extra_min', greatest(least(coalesce(p_extra_min, 0), 240), 0)::text, true);
  v := public.biz_availability(p_secret, p_email, p_service_id, p_location_id, p_pro_id, p_days, p_limit);
  perform set_config('guileo.extra_min', '0', true);
  return v || jsonb_build_object('extra_min', greatest(least(coalesce(p_extra_min, 0), 240), 0));
end $$;
revoke all on function public.biz_availability_x(text, text, uuid, uuid, uuid, integer, integer, integer) from public;
grant execute on function public.biz_availability_x(text, text, uuid, uuid, uuid, integer, integer, integer) to anon, authenticated, service_role;

-- ═══ CHECAGEM: tem de devolver aplicado = true ══════════════════════════════════════════════════
select to_regprocedure('public.vitrine_addons(text)') is not null
   and to_regprocedure('public.biz_availability_x(text,text,uuid,uuid,uuid,integer,integer,integer)') is not null
   and position('guileo.extra_min' in pg_get_functiondef('public.biz_availability(text,text,uuid,uuid,uuid,integer,integer)'::regprocedure)) > 0
   as aplicado;
