-- SMS / WHATSAPP PRONTOS PARA O DIA DA APROVAÇÃO (2026-09-30)
-- ============================================================================
-- Duas peças que faltavam no banco para o canal de texto fechar o ciclo:
--
-- 1. remove_dnc — "START" não tirava ninguém da lista de não-contato. O código respondia "você
--    voltou" e o número continuava bloqueado para sempre. Só desfaz o que a PRÓPRIA pessoa fez
--    (reason = 'opt_out'): bloqueio por reclamação, fraude ou ordem do dono não sai com um START.
--
-- 2. biz_confirm_by_phone — a resposta "C" / "confirm" / "1" ao lembrete. A RPC antiga
--    (booking_reply) olha `client_bookings`, tabela que a agenda de verdade não usa mais: a
--    confirmação por texto nunca encontrava o horário. Esta acha o PRÓXIMO horário da pessoa
--    naquele negócio (pela chave do telefone, mesma régua do resto) e registra a confirmação em
--    `attributes` — o status NÃO muda, porque as filas de lembrete e de avaliação leem
--    status='booked' e um "confirmed" sairia delas.
-- Idempotente. Execução só do service_role.
-- ============================================================================
create or replace function public.remove_dnc(p_secret text, p_phone text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int; v_phone text := regexp_replace(coalesce(p_phone,''),'[^0-9+]','','g');
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_phone = '' then return false; end if;
  delete from do_not_contact where phone = v_phone and coalesce(reason,'opt_out') = 'opt_out';
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.remove_dnc(text,text) from public, anon, authenticated;
grant execute on function public.remove_dnc(text,text) to service_role;

create or replace function public.biz_confirm_by_phone(p_secret text, p_email text, p_phone text, p_via text default 'sms')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_key   text := public._gui_phone_key(p_phone);
  a record;
begin
  if not public._gui_sched_ok(p_secret) then return jsonb_build_object('ok', false, 'reason', 'unauthorized'); end if;
  if v_key is null or length(v_key) < 8 then return jsonb_build_object('ok', false, 'reason', 'bad_phone'); end if;
  select x.id, x.ref, lower(x.span) as inicio, s.name as service, l.name as location, l.tz,
         (x.attributes ? 'confirmed_at') as ja
    into a
    from biz_appointments x
    left join biz_services s on s.id = x.service_id
    left join biz_locations l on l.id = x.location_id
   where x.client_email = v_email and x.status in ('booked','confirmed')
     and lower(x.span) > now() and lower(x.span) < now() + interval '14 days'
     and public._gui_phone_key(x.customer_contact) = v_key
   order by lower(x.span) asc limit 1;
  if a.id is null then return jsonb_build_object('ok', true, 'found', false); end if;
  if not a.ja then
    update biz_appointments
       set attributes = coalesce(attributes,'{}'::jsonb) || jsonb_build_object('confirmed_at', now(), 'confirmed_via', left(coalesce(p_via,'sms'), 16))
     where id = a.id and client_email = v_email;
  end if;
  return jsonb_build_object('ok', true, 'found', true, 'already', a.ja, 'id', a.id, 'ref', a.ref,
                            'when', a.inicio, 'service', a.service, 'location', a.location, 'tz', a.tz);
end $$;
revoke all on function public.biz_confirm_by_phone(text,text,text,text) from public, anon, authenticated;
grant execute on function public.biz_confirm_by_phone(text,text,text,text) to service_role;
notify pgrst, 'reload schema';
