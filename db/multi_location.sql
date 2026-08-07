-- ============================================================================
-- GUILEO · MULTI-UNIDADE (cockpit CRUD de unidades) — cole TUDO e RUN.
-- ADITIVO + idempotente: NÃO quebra o motor v1–v5 nem special_dates. Mesmo gate
-- _gui_sched_ok (scheduling_engine.sql). O problema que isto fecha: biz_locations
-- só nascia pelo biz_admin_import (insert em massa; replace=true APAGA o negócio
-- inteiro) — o dono não tinha como adicionar/editar/desativar UMA unidade pelo
-- cockpit. Agora:
--   • biz_locations_admin_list → todas as unidades (ativas E inativas) + volume
--     de hoje por unidade (no fuso DA unidade), pro cockpit mostrar mini-stats;
--   • biz_location_set → upsert pontual (sem id = cria; com id = edita/ativa/
--     desativa), com trava: NUNCA deixa desativar a última unidade ativa (o
--     motor de agenda precisa de ao menos uma pra resolver fuso e horários).
-- Chamado por functions/api/agent-schedule.js (actions loc_list / loc_set),
-- gate por-tenant no servidor (email + connection key via get_client_data).
-- ============================================================================

-- ── RPC · LISTAR as unidades do negócio (cockpit lê daqui; inclui inativas) ──
create or replace function biz_locations_admin_list(p_secret text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'name', l.name, 'address', l.address, 'city', l.city,
      'phone', l.phone, 'tz', l.tz, 'active', l.active,
      'today', coalesce(t.n, 0), 'upcoming', coalesce(u.n, 0)
    ) order by l.created_at), '[]'::jsonb)
    into v
    from biz_locations l
    left join lateral (
      select count(*)::int as n from biz_appointments a
      where a.location_id = l.id and a.status <> 'cancelled'
        and (lower(a.span) at time zone l.tz)::date = (now() at time zone l.tz)::date
    ) t on true
    left join lateral (
      select count(*)::int as n from biz_appointments a
      where a.location_id = l.id and a.status <> 'cancelled' and lower(a.span) > now()
    ) u on true
    where l.client_email = p_email;
  return jsonb_build_object('locations', coalesce(v, '[]'::jsonb));
end $$;

-- ── RPC · CRIAR/EDITAR/(DES)ATIVAR uma unidade (upsert pontual por id) ───────
-- Sem p_id: cria (p_name obrigatório; tz default NY). Com p_id: atualiza só os
-- campos enviados (null = mantém). Trava 'last_location' ao desativar a última
-- ativa; 'bad_tz' se o fuso não existir no Postgres.
create or replace function biz_location_set(
  p_secret text, p_email text, p_id uuid default null,
  p_name text default null, p_address text default null, p_city text default null,
  p_phone text default null, p_tz text default null, p_active boolean default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text; v_actives int;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  -- valida o fuso ANTES de gravar (senão biz_availability quebraria em runtime)
  if p_tz is not null and trim(p_tz) <> '' then
    begin
      perform now() at time zone p_tz;
    exception when others then
      return jsonb_build_object('ok', false, 'reason', 'bad_tz');
    end;
  end if;
  if p_id is null then
    v_name := nullif(trim(coalesce(p_name, '')), '');
    if v_name is null then return jsonb_build_object('ok', false, 'reason', 'name_required'); end if;
    insert into biz_locations(client_email, name, address, city, phone, tz, active)
      values (p_email, left(v_name, 80), nullif(trim(coalesce(p_address,'')),''), nullif(trim(coalesce(p_city,'')),''),
              nullif(trim(coalesce(p_phone,'')),''), coalesce(nullif(trim(coalesce(p_tz,'')),''), 'America/New_York'),
              coalesce(p_active, true))
      returning id into v_id;
    return jsonb_build_object('ok', true, 'id', v_id, 'created', true);
  end if;
  -- edição pontual: a unidade tem que ser DESTE negócio (gate por-tenant)
  if not exists (select 1 from biz_locations where id = p_id and client_email = p_email) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  -- trava: nunca desativar a última unidade ativa (o motor precisa de uma)
  if p_active is false then
    select count(*) into v_actives from biz_locations where client_email = p_email and active;
    if v_actives <= 1 and (select active from biz_locations where id = p_id) then
      return jsonb_build_object('ok', false, 'reason', 'last_location');
    end if;
  end if;
  update biz_locations set
      name    = coalesce(left(nullif(trim(coalesce(p_name,'')),''), 80), name),
      address = coalesce(nullif(trim(coalesce(p_address,'')),''), address),
      city    = coalesce(nullif(trim(coalesce(p_city,'')),''), city),
      phone   = coalesce(nullif(trim(coalesce(p_phone,'')),''), phone),
      tz      = coalesce(nullif(trim(coalesce(p_tz,'')),''), tz),
      active  = coalesce(p_active, active)
    where id = p_id and client_email = p_email;
  return jsonb_build_object('ok', true, 'id', p_id, 'created', false);
end $$;

-- ✅ Pronto. Teste rápido (troque o email):
--   select biz_location_set('gss_Kp9mX4vR2tZ7nQ5wL8bc','dono@negocio.com',null,'Filial Centro','Av. Central 100','Miami',null,'America/New_York',true);
--   select biz_locations_admin_list('gss_Kp9mX4vR2tZ7nQ5wL8bc','dono@negocio.com');
--   -- desativar a ÚNICA unidade ativa → {"ok":false,"reason":"last_location"}.
