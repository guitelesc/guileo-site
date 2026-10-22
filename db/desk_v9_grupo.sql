-- GUILEO DESK v9 — Marcação de casal e de grupo (2026-10-21, Onda 1 item 2)
-- No MindBody o Natura tem o serviço "60' Couples Massage / Please book twice!": a recepção marca duas vezes
-- à mão e torce para a segunda caber. Aqui é UM pedido, TUDO OU NADA: ou as 2 (até 6) pessoas ficam marcadas,
-- ou nenhuma fica e a resposta diz qual pessoa não coube e por quê.
--
-- REGRA ÚNICA: cada pessoa passa pelo MESMO biz_book da Lilian e do site (choque, capacidade, dia fechado,
-- sala). Nada aqui contorna o gatilho biz_appt_guard. Se a pessoa N falha, levanto GUI09 dentro do bloco e o
-- Postgres desfaz as pessoas 1..N-1 — inclusive as salas que elas reservaram.
-- Cada agendamento leva attributes.grupo (uuid), grupo_n, grupo_total, grupo_rotulo ('casal' | 'grupo').
-- IDEMPOTENTE: request_id do grupo + ':' + n. Repetir o pedido devolve o mesmo grupo (idempotent:true).
-- SALA DE CASAL COMPARTILHADA (uma sala para as duas) NÃO está aqui: cada pessoa reserva a sala do seu
-- serviço. Fica no escopo como próximo passo (REVERSE/mindbody/03-escopo-desk.md).
--
-- desk_grupos(email, key, from, to) → [{id, grupo, n, total, rotulo}] — o /api/desk junta isso na agenda,
-- sem reescrever desk_agenda.
-- Idempotente: create or replace.

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
  -- Tudo do mesmo negócio, antes de gravar qualquer coisa (UUID sozinho não autoriza nada).
  for i in 0 .. n - 1 loop
    it := p_items -> i;
    if not exists (select 1 from biz_professionals where id = (it->>'pro_id')::uuid and client_email = p_email)
       or not exists (select 1 from biz_services where id = (it->>'service_id')::uuid and client_email = p_email)
       or coalesce(trim(it->>'name'), '') = '' or (it->>'start') is null then
      return jsonb_build_object('ok', false, 'reason', 'invalid_item', 'index', i + 1);
    end if;
  end loop;
  -- Repetição do mesmo pedido: devolve o grupo que já existe.
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
               || case when coalesce(it->>'note', '') <> '' then jsonb_build_object('desk_note', left(it->>'note', 1000)) else '{}'::jsonb end,
             null, case when coalesce(p_request_id, '') <> '' then p_request_id || ':' || (i + 1) else null end);
      if coalesce((r->>'ok')::boolean, false) is not true or (r->>'appointment_id') is null then
        v_falha := jsonb_build_object('ok', false, 'reason', coalesce(r->>'reason', r->>'error', 'book_failed'), 'index', i + 1,
                     'name', it->>'name', 'pro_id', it->>'pro_id', 'start', it->>'start');
        raise exception 'group_item_failed' using errcode = 'GUI09';
      end if;
      if coalesce((r->>'idempotent')::boolean, false) then v_idem := v_idem + 1; end if;
      -- parênteses: sem eles, `lista || objeto || objeto` acrescenta o 2º objeto como item à parte.
      v_out := v_out || (jsonb_build_object('index', i + 1, 'appointment_id', r->>'appointment_id', 'ref', r->>'ref', 'name', it->>'name')
               || case when r ? 'resource' then jsonb_build_object('resource', r->>'resource') else '{}'::jsonb end);
    end loop;
  exception when sqlstate 'GUI09' then
    -- Tudo que foi marcado neste bloco já foi desfeito pelo Postgres. Nada ficou pela metade.
    return v_falha || jsonb_build_object('booked', 0);
  end;

  return jsonb_build_object('ok', true, 'grupo', v_gid, 'rotulo', v_rot, 'total', n, 'appointments', v_out, 'idempotent', v_idem = n);
end $$;

create or replace function public.desk_grupos(p_email text, p_key text, p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'grupo', a.attributes->>'grupo',
            'n', (a.attributes->>'grupo_n')::int, 'total', (a.attributes->>'grupo_total')::int, 'rotulo', a.attributes->>'grupo_rotulo'))
     from public.vivo_biz_appointments(e) a
    where a.attributes ? 'grupo' and a.span && tstzrange(coalesce(p_from, now() - interval '1 day'), coalesce(p_to, now() + interval '1 day'))), '[]'::jsonb);
end $$;

revoke all on function public.biz_book_group(text, text, uuid, jsonb, jsonb, text) from public;
grant execute on function public.biz_book_group(text, text, uuid, jsonb, jsonb, text) to anon, authenticated, service_role;
revoke all on function public.desk_grupos(text, text, timestamptz, timestamptz) from public;
grant execute on function public.desk_grupos(text, text, timestamptz, timestamptz) to anon, authenticated, service_role;
