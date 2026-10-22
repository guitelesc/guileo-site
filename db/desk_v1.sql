-- GUILEO DESK v1 — a agenda do balcão (2026-10-04)
-- O substituto do MindBody começa pela tela que a recepção abre o dia inteiro: a agenda por
-- profissional. Este arquivo só ACRESCENTA funções; nenhuma tabela ou função existente muda.
--
-- PORTA: a mesma da Central — e-mail + chave de conexão (client_credits.access_key), igual a
-- biz_team_list. Errou a chave → 28000 'unauthorized'. Todo dado sai filtrado por client_email.
-- LEITURA: agendamentos vêm de vivo_biz_appointments (db/live_desde.sql) — teste de antes da
-- entrada em operação não aparece na agenda do cliente.
-- ESCRITA: o gatilho biz_appt_guard continua sendo o juiz de horário (choque, capacidade, dia
-- fechado). Nada aqui contorna ele: mover para um horário ocupado volta 'slot_taken'.
-- Idempotente: create or replace.

create or replace function public._desk_ok(p_email text, p_key text)
returns text language plpgsql stable security definer set search_path to 'public' as $$
declare v record; e text := lower(trim(coalesce(p_email, '')));
begin
  select * into v from client_credits where client_email = e;
  if v is null or v.access_key is distinct from p_key or coalesce(p_key, '') = '' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  return e;
end $$;
revoke all on function public._desk_ok(text, text) from public, anon, authenticated;

-- ── LEITURA: tudo que a tela do balcão precisa para um intervalo (dia ou semana) ─────────────
create or replace function public.desk_agenda(p_email text, p_key text, p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key);
        f timestamptz := coalesce(p_from, date_trunc('day', now()));
        t timestamptz := coalesce(p_to, coalesce(p_from, date_trunc('day', now())) + interval '1 day');
begin
  if t <= f or t - f > interval '42 days' then raise exception 'invalid_range' using errcode = '22023'; end if;
  return jsonb_build_object(
    'ok', true,
    'from', f, 'to', t,
    'locations', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'address', l.address,
                    'city', l.city, 'phone', l.phone, 'tz', coalesce(l.tz, 'America/New_York')) order by l.created_at)
                  from biz_locations l where l.client_email = e and coalesce(l.active, true)), '[]'::jsonb),
    'pros', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'title', coalesce(p.title, ''),
                    'kind', coalesce(p.kind, 'staff'), 'color', p.config->>'color',
                    'locations', coalesce((select jsonb_agg(pl.location_id) from biz_pro_locations pl where pl.pro_id = p.id), '[]'::jsonb),
                    'services', coalesce((select jsonb_agg(ps.service_id) from biz_pro_services ps where ps.pro_id = p.id), '[]'::jsonb),
                    'hours', coalesce((select jsonb_agg(jsonb_build_object('location_id', s.location_id, 'weekday', s.weekday,
                                'start_min', s.start_min, 'end_min', s.end_min) order by s.weekday, s.start_min)
                              from biz_schedules s where s.pro_id = p.id), '[]'::jsonb)) order by p.name)
                  from biz_professionals p where p.client_email = e and coalesce(p.active, true)), '[]'::jsonb),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'duration_min', s.duration_min,
                    'price_cents', s.price_cents, 'deposit_cents', s.deposit_cents, 'capacity', coalesce(s.capacity, 1),
                    'buffer_before_min', coalesce(s.buffer_before_min, 0), 'buffer_after_min', coalesce(s.buffer_after_min, 0),
                    'category', s.config->>'category') order by s.name)
                  from biz_services s where s.client_email = e and coalesce(s.active, true)), '[]'::jsonb),
    'appointments', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'ref', a.ref, 'status', a.status,
                    'start', lower(a.span), 'end', upper(a.span), 'pro_id', a.pro_id, 'location_id', a.location_id,
                    'service_id', a.service_id, 'customer_name', a.customer_name, 'customer_contact', a.customer_contact,
                    'source', coalesce(a.attributes->>'source', a.source), 'note', a.attributes->>'desk_note', 'reminded', coalesce(a.reminded, false),
                    'created_at', a.created_at) order by lower(a.span))
                  from public.vivo_biz_appointments(e) a
                  where a.span && tstzrange(f, t)
                    and (a.expires_at is null or a.expires_at > now() or a.status <> 'hold')), '[]'::jsonb),
    'closed', coalesce((select jsonb_agg(jsonb_build_object('date', d.date, 'closed', d.closed, 'open_min', d.open_min,
                    'close_min', d.close_min, 'note', d.note) order by d.date)
                  from biz_special_dates d where d.client_email = e
                    and d.date between (f at time zone 'UTC')::date - 1 and (t at time zone 'UTC')::date + 1), '[]'::jsonb)
  );
end $$;
revoke all on function public.desk_agenda(text, text, timestamptz, timestamptz) from public;
grant execute on function public.desk_agenda(text, text, timestamptz, timestamptz) to anon, authenticated, service_role;

-- ── ESCRITA: mover (outro horário e/ou outra profissional) ───────────────────────────────────
-- Duração preservada. O gatilho decide se cabe; a resposta diz o motivo quando não cabe.
create or replace function public.desk_move(p_email text, p_key text, p_id uuid, p_start timestamptz, p_pro_id uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
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
  end;
  return jsonb_build_object('ok', true, 'id', p_id, 'start', p_start, 'end', p_start + v_dur, 'pro_id', v_pro);
end $$;
revoke all on function public.desk_move(text, text, uuid, timestamptz, uuid) from public;
grant execute on function public.desk_move(text, text, uuid, timestamptz, uuid) to anon, authenticated, service_role;

-- ── ESCRITA: estado do atendimento (o ciclo do balcão) ───────────────────────────────────────
-- booked → confirmed → arrived (chegou) → completed; ou no_show / cancelled.
-- 'arrived' é gravado como in_progress (o estado que o quadro do dia já entende).
create or replace function public.desk_set_status(p_email text, p_key text, p_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); s text := lower(coalesce(p_status, '')); n int;
begin
  if s = 'arrived' then s := 'in_progress'; end if;
  if s not in ('booked', 'confirmed', 'in_progress', 'completed', 'no_show', 'cancelled') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_status');
  end if;
  update biz_appointments set status = s,
         attributes = coalesce(attributes, '{}'::jsonb) || jsonb_build_object('desk_status_at', now(), 'desk_status', s)
   where id = p_id and client_email = e and status <> 'hold';
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n = 1, 'id', p_id, 'status', s);
end $$;
revoke all on function public.desk_set_status(text, text, uuid, text) from public;
grant execute on function public.desk_set_status(text, text, uuid, text) to anon, authenticated, service_role;

-- ── ESCRITA: nota do balcão no agendamento ───────────────────────────────────────────────────
create or replace function public.desk_note(p_email text, p_key text, p_id uuid, p_note text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); n int;
begin
  update biz_appointments set attributes = coalesce(attributes, '{}'::jsonb) || jsonb_build_object('desk_note', left(coalesce(p_note, ''), 1000))
   where id = p_id and client_email = e;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n = 1);
end $$;
revoke all on function public.desk_note(text, text, uuid, text) from public;
grant execute on function public.desk_note(text, text, uuid, text) to anon, authenticated, service_role;
