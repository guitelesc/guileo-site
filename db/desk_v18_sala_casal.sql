-- GUILEO DESK v18 — SALA DE CASAL COMPARTILHADA (2026-10-27, Onda 1 item 1b "largar o MindBody")
-- O Natura tem a "Couples Room": o casal faz a massagem lado a lado, NA MESMA SALA. Desde o desk_v9 o casal é
-- um pedido só (biz_book_group, tudo ou nada), mas cada pessoa reservava a sala do SEU serviço — duas salas
-- presas para um casal, e numa casa com uma sala de casal só, o segundo da dupla ficava sem sala.
--
-- REGRA
--   · Sala tem LUGARES (biz_professionals.config.lugares, 1 a 6; sem a chave = 1 = como sempre).
--   · Só divide sala quem é do MESMO grupo (o mesmo pedido de casal/grupo), até os lugares. Estranho NUNCA divide:
--     uma pessoa sozinha numa sala de 2 lugares ocupa a sala inteira para os outros.
--   · Ordem da escolha: o grupo prefere a sala de quem do grupo já está lá no horário; depois as salas com mais de
--     1 lugar. A pessoa sozinha prefere as salas de 1 lugar (guarda a de casal para o casal). Sem nenhuma sala com
--     lugares > 1, a ordem é EXATAMENTE a de antes (a do cadastro do serviço).
--
-- ONDE MORA A GARANTIA
--   · No BANCO: a exclusão biz_appt_res_sem_choque ganha um 3º termo — (sala =, horário &&, grupo <>). O Postgres só
--     recusa quando TODOS batem: mesma sala, horário cruzando e grupo DIFERENTE. Sem grupo, o "grupo" é o próprio
--     agendamento (único) → dois sozinhos se chocam como antes. Estranho nunca entra, nem com duas marcações
--     simultâneas. (btree_gist já está ligado: a exclusão de antes já usava uuid.)
--   · Os LUGARES (quantos do mesmo grupo) são contados em _biz_res_livre, sob a trava da sala
--     (pg_advisory_xact_lock em _biz_res_reserve) — a mesma serialização que já protegia a reserva.
--
-- DE ONDE VEM O GRUPO (e por que NÃO de attributes.grupo sozinho)
--   O agent-schedule junta `b.attributes` no agendamento: qualquer um que chegue ao motor poderia inventar um
--   `grupo` e sentar na sala de outro casal. Então o grupo da SALA só vale quando:
--     (a) quem marca é o biz_book_group, NESTA transação (set_config('guileo.grupo', …, true) — local, como o
--         extra_min do desk_v17), e o attributes.grupo do agendamento é esse mesmo; ou
--     (b) a última reserva de sala DESTE agendamento já tinha o grupo (remarcar/mudar de horário mantém).
--   Casal marcado antes do v18 não tem (b): segue em salas separadas, como foi marcado.
--
-- PEÇAS
--   biz_appointment_resources.grupo  → coluna nova (null = sozinho).
--   _biz_res_livre(…, p_grupo)       → +1 parâmetro (default null): conta lugares e muda a ordem. Sem p_grupo e sem
--                                      sala com lugares > 1 = mesma resposta de antes.
--   _biz_res_reserve                 → descobre o grupo confiável, prefere a sala do grupo, grava o grupo.
--   biz_book_group (remendo)         → liga guileo.grupo durante as marcações e desliga no fim (e na recusa).
--   desk_staff_save (remendo)        → aceita `lugares` (1–6). desk_agenda (remendo) → pros[].lugares.
-- Idempotente: create or replace + remendos que se reconhecem; trava no começo; nada muda pela metade.

-- ═══ TRAVA: o que está no ar tem de ser o v10/v11/v16 ═══════════════════════════════════════════
do $t$
begin
  if to_regprocedure('public._biz_res_livre(text,uuid,uuid,tstzrange,uuid,uuid,uuid[])') is null
     and to_regprocedure('public._biz_res_livre(text,uuid,uuid,tstzrange,uuid,uuid,uuid[],uuid)') is null then
    raise exception 'desk_v18: _biz_res_livre não encontrada (desk_v5) — nada foi alterado.';
  end if;
  if position('_biz_eff' in pg_get_functiondef('public._biz_res_reserve(uuid,uuid)'::regprocedure)) = 0 then
    raise exception 'desk_v18: _biz_res_reserve não está na versão do desk_v10 — nada foi alterado.';
  end if;
  if position('addons' in pg_get_functiondef('public.biz_book_group(text,text,uuid,jsonb,jsonb,text)'::regprocedure)) = 0 then
    raise exception 'desk_v18: biz_book_group não está na versão do desk_v11 — nada foi alterado.';
  end if;
  if position('''online''' in pg_get_functiondef('public.desk_staff_save(text,text,jsonb)'::regprocedure)) = 0
     or position('''online''' in pg_get_functiondef('public.desk_agenda(text,text,timestamptz,timestamptz)'::regprocedure)) = 0 then
    raise exception 'desk_v18: equipe/agenda não estão na versão do desk_v16 — nada foi alterado.';
  end if;
end $t$;

-- ═══ TABELA + A GARANTIA DO BANCO ═══════════════════════════════════════════════════════════════
alter table public.biz_appointment_resources add column if not exists grupo uuid;

do $c$
begin
  if position('grupo' in coalesce((select pg_get_constraintdef(oid) from pg_constraint where conname = 'biz_appt_res_sem_choque'), '')) = 0 then
    alter table public.biz_appointment_resources drop constraint if exists biz_appt_res_sem_choque;
    alter table public.biz_appointment_resources add constraint biz_appt_res_sem_choque
      exclude using gist (resource_id with =, span with &&, (coalesce(grupo, appointment_id)) with <>) where (released_at is null);
  end if;
end $c$;

-- ═══ SALAS LIVRES (agora com lugares e grupo) ═══════════════════════════════════════════════════
-- Assinatura nova (+p_grupo). A antiga sai antes: com as duas, uma chamada de 7 argumentos ficaria ambígua.
drop function if exists public._biz_res_livre(text, uuid, uuid, tstzrange, uuid, uuid, uuid[]);
create or replace function public._biz_res_livre(p_email text, p_service_id uuid, p_location_id uuid, p_span tstzrange,
  p_excluir uuid default null, p_prefer uuid default null, p_pular uuid[] default '{}'::uuid[], p_grupo uuid default null)
returns table(id uuid, name text) language sql stable security definer set search_path to 'public' as $$
  select r.id, r.name
    from biz_services s
    cross join lateral jsonb_array_elements_text(case when jsonb_typeof(s.config->'recursos') = 'array' then s.config->'recursos' else '[]'::jsonb end)
         with ordinality as x(v, ord)
    join biz_professionals r on r.id::text = x.v and r.client_email = p_email and coalesce(r.active, true) and r.kind in ('room', 'equipment')
    cross join lateral (select least(greatest(coalesce(case when r.config->>'lugares' ~ '^[0-9]+$' then (r.config->>'lugares')::int end, 1), 1), 6) as lugares) cap
   where s.id = p_service_id
     and not (r.id = any(coalesce(p_pular, '{}'::uuid[])))
     and (p_location_id is null
          or not exists (select 1 from biz_pro_locations pl where pl.pro_id = r.id)
          or exists (select 1 from biz_pro_locations pl where pl.pro_id = r.id and pl.location_id = p_location_id))
     -- ninguém de FORA do grupo na sala nesse intervalo (sem grupo: ninguém, como antes)
     and not exists (select 1 from biz_appointment_resources z join biz_appointments a on a.id = z.appointment_id
                      where z.resource_id = r.id and z.released_at is null and z.span && p_span
                        and a.id is distinct from p_excluir and a.status not in ('cancelled', 'canceled', 'no_show')
                        and (a.expires_at is null or a.expires_at > now())
                        and (p_grupo is null or z.grupo is distinct from p_grupo))
     -- do grupo, menos gente que os lugares
     and (p_grupo is null
          or (select count(*) from biz_appointment_resources z join biz_appointments a on a.id = z.appointment_id
               where z.resource_id = r.id and z.released_at is null and z.span && p_span and z.grupo = p_grupo
                 and a.id is distinct from p_excluir and a.status not in ('cancelled', 'canceled', 'no_show')
                 and (a.expires_at is null or a.expires_at > now())) < cap.lugares)
     and not exists (select 1 from biz_appointments a left join biz_services asv on asv.id = a.service_id
                      where a.pro_id = r.id and a.status <> 'cancelled' and a.id is distinct from p_excluir
                        and (a.expires_at is null or a.expires_at > now())
                        and tstzrange(lower(a.span) - make_interval(mins => coalesce(asv.buffer_before_min, 0)),
                                      upper(a.span) + make_interval(mins => coalesce(asv.buffer_after_min, 0))) && p_span)
   order by (r.id = p_prefer) desc nulls last,
            case when p_grupo is null then cap.lugares = 1 else cap.lugares > 1 end desc,
            x.ord
$$;
revoke all on function public._biz_res_livre(text, uuid, uuid, tstzrange, uuid, uuid, uuid[], uuid) from public, anon, authenticated;

-- ═══ RESERVAR A SALA (grupo confiável + preferir a sala do grupo) ═══════════════════════════════
create or replace function public._biz_res_reserve(p_appt uuid, p_prefer uuid default null)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare a biz_appointments; v_bb int; v_ba int; v_span tstzrange; v_room uuid; v_pular uuid[] := '{}'::uuid[];
  v_grupo uuid; v_pref uuid := p_prefer;
begin
  select * into a from biz_appointments where id = p_appt;
  if a.id is null or a.service_id is null or a.status in ('cancelled', 'canceled', 'no_show', 'blocked') then return null; end if;
  if not public._biz_res_exige(a.service_id) then return null; end if;
  select e.bb, e.ba into v_bb, v_ba from public._biz_eff(a.pro_id, a.service_id) e;
  v_span := tstzrange(lower(a.span) - make_interval(mins => coalesce(v_bb, 0)), upper(a.span) + make_interval(mins => coalesce(v_ba, 0)));
  -- desk_v18: o grupo da sala só vale se veio do biz_book_group nesta transação, ou da última reserva deste agendamento.
  if coalesce(a.attributes->>'grupo', '') <> '' and a.attributes->>'grupo' = nullif(current_setting('guileo.grupo', true), '') then
    v_grupo := (a.attributes->>'grupo')::uuid;
  else
    select z.grupo into v_grupo from biz_appointment_resources z where z.appointment_id = a.id order by z.created_at desc limit 1;
  end if;
  if v_grupo is not null and v_pref is null then
    select z.resource_id into v_pref from biz_appointment_resources z
     where z.client_email = a.client_email and z.grupo = v_grupo and z.released_at is null and z.span && v_span and z.appointment_id <> a.id
     order by z.created_at limit 1;
  end if;
  update biz_appointment_resources z set released_at = now() from biz_appointments h
   where h.id = z.appointment_id and z.client_email = a.client_email and z.released_at is null
     and h.status = 'hold' and h.expires_at is not null and h.expires_at < now();
  loop
    select l.id into v_room from public._biz_res_livre(a.client_email, a.service_id, a.location_id, v_span, a.id, v_pref, v_pular, v_grupo) l limit 1;
    if v_room is null then raise exception 'resource_unavailable' using errcode = 'GUI03'; end if;
    perform pg_advisory_xact_lock(hashtextextended(v_room::text, 0));
    if not exists (select 1 from public._biz_res_livre(a.client_email, a.service_id, a.location_id, v_span, a.id, null, v_pular, v_grupo) l where l.id = v_room) then
      v_pular := v_pular || v_room; continue;
    end if;
    begin
      insert into biz_appointment_resources (client_email, appointment_id, resource_id, span, grupo) values (a.client_email, a.id, v_room, v_span, v_grupo);
      return v_room;
    exception when exclusion_violation then v_pular := v_pular || v_room;
    end;
  end loop;
end $function$;

-- ═══ biz_book_group liga o grupo durante as marcações — roda uma vez ═══════════════════════════════
do $p$
declare d text := pg_get_functiondef('public.biz_book_group(text,text,uuid,jsonb,jsonb,text)'::regprocedure); n text;
begin
  if position('guileo.grupo' in d) > 0 then return; end if;
  n := replace(d, E'\n  begin\n    for i in 0 .. n - 1 loop',
                  E'\n  perform set_config(\'guileo.grupo\', v_gid::text, true);   -- desk_v18: a sala de casal confia neste grupo\n  begin\n    for i in 0 .. n - 1 loop');
  n := replace(n, E'    end loop;\n  exception when sqlstate \'GUI09\' then\n',
                  E'    end loop;\n    perform set_config(\'guileo.grupo\', \'\', true);\n  exception when sqlstate \'GUI09\' then\n    perform set_config(\'guileo.grupo\', \'\', true);\n');
  if (length(n) - length(replace(n, 'guileo.grupo', ''))) / length('guileo.grupo') <> 3 then
    raise exception 'desk_v18: blocos do biz_book_group não encontrados — nada alterado';
  end if;
  execute n;
end $p$;

-- ═══ LUGARES no salvar da equipe — roda uma vez ═════════════════════════════════════════════════
do $p$
declare d text := pg_get_functiondef('public.desk_staff_save(text,text,jsonb)'::regprocedure); n text; ancora text;
begin
  if position('''lugares''' in d) > 0 then return; end if;
  ancora := E'             || case when p_pro ? \'online\' then jsonb_build_object(\'online\', coalesce((p_pro->>\'online\')::boolean, true)) else \'{}\'::jsonb end   -- desk_v16: false = não marca pelo site';
  n := replace(d, ancora, ancora || E'\n' ||
    E'             || case when p_pro ? \'lugares\' then jsonb_build_object(\'lugares\', least(greatest(coalesce(nullif(p_pro->>\'lugares\', \'\')::int, 1), 1), 6)) else \'{}\'::jsonb end   -- desk_v18: sala de casal');
  if n = d then raise exception 'desk_v18: bloco do online não encontrado em desk_staff_save — nada alterado'; end if;
  execute n;
end $p$;

-- ═══ a agenda devolve pros[].lugares — roda uma vez ═════════════════════════════════════════════
do $p$
declare d text := pg_get_functiondef('public.desk_agenda(text,text,timestamptz,timestamptz)'::regprocedure); n text; k int;
  ancora text := '''online'', coalesce((p.config->>''online'')::boolean, true),';
begin
  if position('''lugares''' in d) > 0 then return; end if;
  k := (length(d) - length(replace(d, ancora, ''))) / length(ancora);
  if k <> 1 then raise exception 'desk_v18: esperava 1 "online" dos profissionais em desk_agenda, achei % — nada alterado', k; end if;
  n := replace(d, ancora, ancora || ' ''lugares'', least(greatest(coalesce(case when p.config->>''lugares'' ~ ''^[0-9]+$'' then (p.config->>''lugares'')::int end, 1), 1), 6),');
  execute n;
end $p$;

-- ═══ CHECAGEM: tem de devolver aplicado = true ══════════════════════════════════════════════════
select position('grupo' in (select pg_get_constraintdef(oid) from pg_constraint where conname = 'biz_appt_res_sem_choque')) > 0
   and to_regprocedure('public._biz_res_livre(text,uuid,uuid,tstzrange,uuid,uuid,uuid[],uuid)') is not null
   and to_regprocedure('public._biz_res_livre(text,uuid,uuid,tstzrange,uuid,uuid,uuid[])') is null
   and position('guileo.grupo' in pg_get_functiondef('public._biz_res_reserve(uuid,uuid)'::regprocedure)) > 0
   and position('guileo.grupo' in pg_get_functiondef('public.biz_book_group(text,text,uuid,jsonb,jsonb,text)'::regprocedure)) > 0
   and position('''lugares''' in pg_get_functiondef('public.desk_staff_save(text,text,jsonb)'::regprocedure)) > 0
   and position('''lugares''' in pg_get_functiondef('public.desk_agenda(text,text,timestamptz,timestamptz)'::regprocedure)) > 0
   as aplicado;
