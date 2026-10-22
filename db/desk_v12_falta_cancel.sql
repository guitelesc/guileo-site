-- GUILEO DESK v12 — Falta automática, "cancelou em cima da hora", concluir pelo caixa (2026-10-21, Onda 1 item 5)
-- No Natura (MindBody, 21/10 às 15h30): 6 "Arrived", 0 "Completed", 5 "No Show" — a recepção não fecha o ciclo.
-- O MindBody marca NoShow 10 min depois do início se ninguém marcou chegada nem cancelou.
--
--   1. FALTA AUTOMÁTICA — regra por negócio em desk_regras.auto_noshow_min (0 = desligado; sem linha = 30 min,
--      mais tolerante que os 10 do MindBody). desk_auto_noshow_sweep(secret, email?) marca 'no_show' com
--      attributes.noshow_auto=true/noshow_auto_at em quem passou do horário sem "chegou"/"concluiu". Roda quando a
--      agenda é lida (balcão aberto = varredura viva) e a cada 15 min no cron-tick (pano de fundo). Nunca cobra:
--      a taxa continua sendo um botão da recepção. Reversível: desk_noshow_undo = "Chegou afinal".
--   2. CANCELOU EM CIMA DA HORA — o gatilho _biz_appt_cancelled_at também carimba attributes.late_cancelled
--      (cancelado dentro da janela cancel_window_h do serviço), venha de onde vier (balcão, link da cliente, IA).
--      A agenda mostra como estado próprio; a taxa de cancelamento já existia (cobrar_cancelamento).
--   3. CONCLUIR PELO CAIXA — já existia (desk_checkout → desk_status 'completed' + sale_id; estorno volta a
--      'in_progress'). Aqui só ganha prova no smoke. Nada muda.
--   desk_flags(email,key,from,to) entrega late_cancelled / noshow_auto à agenda (o /api/desk junta).
-- Idempotente: create or replace / if not exists.

create table if not exists desk_regras (
  client_email text primary key,
  auto_noshow_min int not null default 30 check (auto_noshow_min >= 0 and auto_noshow_min <= 240),
  updated_at timestamptz not null default now()
);
alter table desk_regras enable row level security;

create or replace function public.desk_regras_get(p_email text, p_key text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); r desk_regras;
begin
  select * into r from desk_regras where client_email = e;
  return jsonb_build_object('ok', true, 'auto_noshow_min', coalesce(r.auto_noshow_min, 30), 'padrao', r.client_email is null);
end $$;

create or replace function public.desk_regras_set(p_email text, p_key text, p jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); v int := coalesce((p->>'auto_noshow_min')::int, 30);
begin
  if v < 0 or v > 240 then return jsonb_build_object('ok', false, 'reason', 'invalid_minutes'); end if;
  insert into desk_regras (client_email, auto_noshow_min) values (e, v)
  on conflict (client_email) do update set auto_noshow_min = excluded.auto_noshow_min, updated_at = now();
  return jsonb_build_object('ok', true, 'auto_noshow_min', v);
end $$;

-- A varredura. Só quem está 'booked' no motor (marcado/confirmado) e ainda não "chegou"/"concluiu" pelo balcão.
create or replace function public.desk_auto_noshow_sweep(p_secret text, p_email text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error', 'unauthorized'); end if;
  with alvo as (
    select a.id from biz_appointments a
    left join desk_regras r on r.client_email = a.client_email
    where (p_email is null or a.client_email = p_email)
      and a.status = 'booked'
      and coalesce(a.attributes->>'desk_status', 'booked') in ('booked', 'confirmed')
      and coalesce(r.auto_noshow_min, 30) > 0
      and lower(a.span) + make_interval(mins => coalesce(r.auto_noshow_min, 30)) < now()
      and lower(a.span) > now() - interval '3 days'   -- não revira o passado antigo de uma conta importada
  )
  update biz_appointments a set status = 'no_show',
         attributes = coalesce(a.attributes, '{}'::jsonb) || jsonb_build_object('desk_status', 'no_show', 'desk_status_at', now(), 'noshow_auto', true, 'noshow_auto_at', now())
    from alvo where a.id = alvo.id;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'marcados', n);
end $$;

-- "Chegou afinal": desfaz a falta (automática ou não) e volta a ocupar o horário; o gatilho recusa se alguém já pegou.
create or replace function public.desk_noshow_undo(p_email text, p_key text, p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); a biz_appointments;
begin
  select * into a from biz_appointments where id = p_id and client_email = e;
  if a.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if a.status <> 'no_show' then return jsonb_build_object('ok', false, 'reason', 'not_no_show'); end if;
  begin
    update biz_appointments set status = 'booked',
           attributes = (coalesce(attributes, '{}'::jsonb) - 'noshow_auto' - 'noshow_auto_at') || jsonb_build_object('desk_status', 'in_progress', 'desk_status_at', now())
     where id = p_id and client_email = e;
  exception
    when sqlstate 'GUI01' then return jsonb_build_object('ok', false, 'reason', 'slot_taken');
    when sqlstate 'GUI03' then return jsonb_build_object('ok', false, 'reason', 'resource_unavailable');
  end;
  return jsonb_build_object('ok', true, 'id', p_id, 'status', 'in_progress');
end $$;

-- Cancelamento: carimba quem/quando (como antes) e, agora, se foi EM CIMA DA HORA (dentro da janela do serviço).
create or replace function public._biz_appt_cancelled_at()
returns trigger language plpgsql as $function$
declare v_win int;
begin
  begin
    select cancel_window_h into v_win from biz_services where id = new.service_id;
    new.attributes := coalesce(new.attributes, '{}'::jsonb) || jsonb_build_object(
      'cancelled_at', case when new.attributes->'cancelled_at' is not null
                            and new.attributes->'cancelled_at' is distinct from old.attributes->'cancelled_at'
                           then new.attributes->'cancelled_at' else to_jsonb(now()) end,
      'cancelled_by', case when new.attributes->'cancelled_by' is not null
                            and new.attributes->'cancelled_by' is distinct from old.attributes->'cancelled_by'
                           then new.attributes->'cancelled_by'
                           when old.status = 'hold' then to_jsonb('expirou'::text)
                           else to_jsonb('desconhecido'::text) end,
      'late_cancelled', (old.status <> 'hold' and coalesce(v_win, 0) > 0 and now() > lower(new.span) - make_interval(hours => v_win)));
  exception when others then
    null;   -- nunca bloqueia um cancelamento
  end;
  return new;
end $function$;

-- Para a agenda: o que o status sozinho não diz.
create or replace function public.desk_flags(p_email text, p_key text, p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id,
            'late_cancelled', coalesce((a.attributes->>'late_cancelled')::boolean, false),
            'noshow_auto', coalesce((a.attributes->>'noshow_auto')::boolean, false),
            'noshow_auto_at', a.attributes->>'noshow_auto_at'))
     from public.vivo_biz_appointments(e) a
    where a.span && tstzrange(coalesce(p_from, now() - interval '1 day'), coalesce(p_to, now() + interval '1 day'))
      and (coalesce((a.attributes->>'late_cancelled')::boolean, false) or coalesce((a.attributes->>'noshow_auto')::boolean, false))), '[]'::jsonb);
end $$;

do $g$ declare f text; begin
  foreach f in array array['desk_regras_get(text,text)', 'desk_regras_set(text,text,jsonb)', 'desk_noshow_undo(text,text,uuid)',
                           'desk_flags(text,text,timestamptz,timestamptz)', 'desk_auto_noshow_sweep(text,text)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
  end loop;
end $g$;
