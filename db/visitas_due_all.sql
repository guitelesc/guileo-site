-- 2026-09-28 · Fila de LEMBRETE e de PEDIDO DE AVALIAÇÃO de TODOS os negócios numa consulta só.
-- Por quê: o proactive fazia ~10 chamadas por negócio ANTES de chegar no lembrete; o Worker estoura
-- o teto de subrequests ("Too many subrequests by single Worker invocation") no 4º negócio e os
-- outros 10 recebiam `{}` — lido como "ninguém para lembrar". Resultado medido: max(reminded_at) = null
-- na base inteira; nenhum lembrete saiu na história da plataforma. Com a fila global, a passada
-- gasta chamada só com quem TEM algo vencendo.
-- `tz` = fuso da unidade: o lembrete dizia "Ter 29/09 · 16:00" (UTC, dia em PT) pra um horário de 12:00 em NY.
-- Mesmo portão (_gui_sched_ok) e mesmo formato das irmãs biz_reminders_due / biz_review_due, com `tenant`.
-- Permissões: iguais às irmãs (o proactive chama com a chave anon; o portão é o segredo).
CREATE OR REPLACE FUNCTION public.biz_reminders_due_all(p_secret text, p_hours integer DEFAULT 26, p_limit integer DEFAULT 60)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v jsonb; begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select coalesce(jsonb_agg(x order by x->>'when'), '[]'::jsonb) into v from (
    select jsonb_build_object('tenant', a.client_email, 'id', a.id, 'contact', a.customer_contact, 'name', a.customer_name,
             'service', s.name, 'when', lower(a.span), 'ref', a.ref, 'location', l.name, 'tz', l.tz) x
      from biz_appointments a
      left join biz_services s on s.id = a.service_id
      left join biz_locations l on l.id = a.location_id
     where a.status = 'booked' and not a.reminded
       and lower(a.span) between now() and now() + (greatest(coalesce(p_hours,26),1)||' hours')::interval
     order by lower(a.span)
     limit greatest(coalesce(p_limit,60),1)) q;
  return jsonb_build_object('due', v);
end $function$;

CREATE OR REPLACE FUNCTION public.biz_review_due_all(p_secret text, p_after_hours integer DEFAULT 3, p_max_days integer DEFAULT 7, p_limit integer DEFAULT 60)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v jsonb; begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v from (
    select jsonb_build_object('tenant', a.client_email, 'id', a.id, 'contact', a.customer_contact, 'name', a.customer_name,
             'service', s.name, 'when', upper(a.span), 'ref', a.ref, 'location', l.name, 'tz', l.tz) x
      from biz_appointments a
      left join biz_services s on s.id = a.service_id
      left join biz_locations l on l.id = a.location_id
     where a.status = 'booked' and not a.review_asked
       and upper(a.span) < now() - (greatest(coalesce(p_after_hours,3),0)||' hours')::interval
       and upper(a.span) > now() - (greatest(coalesce(p_max_days,7),1)||' days')::interval
     order by upper(a.span) desc
     limit greatest(coalesce(p_limit,60),1)) q;
  return jsonb_build_object('due', v);
end $function$;

revoke all on function public.biz_reminders_due_all(text, integer, integer) from public;
revoke all on function public.biz_review_due_all(text, integer, integer, integer) from public;
grant execute on function public.biz_reminders_due_all(text, integer, integer) to anon, service_role;
grant execute on function public.biz_review_due_all(text, integer, integer, integer) to anon, service_role;
notify pgrst, 'reload schema';

-- Retorno de orçamento ("me liga de volta"): mesma doença, mesma cura — fila global. Mesmas regras da
-- biz_quotes_due (10 min de espera, 3 tentativas, 4h entre tentativas), com `tenant`.
CREATE OR REPLACE FUNCTION public.biz_quotes_due_all(p_secret text, p_min_idade_min integer DEFAULT 10, p_max_tentativas integer DEFAULT 3, p_limit integer DEFAULT 20)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare out jsonb;
begin
  if not public._gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into out from (
    select jsonb_build_object('tenant', q.client_email, 'id', q.id, 'nome', q.customer_name, 'phone', q.phone, 'servico', q.service_name,
             'canal', q.channel, 'lang', q.lang, 'tentativas', q.attempts) x
      from biz_quote_requests q
     where q.status = 'pendente' and q.responded_at is null and q.phone is not null
       and q.attempts < greatest(coalesce(p_max_tentativas,3), 1)
       and q.created_at < now() - (greatest(coalesce(p_min_idade_min,10),0) || ' minutes')::interval
       and (q.last_attempt_at is null or q.last_attempt_at < now() - interval '4 hours')
     order by q.created_at
     limit greatest(least(coalesce(p_limit,20), 50), 1)) z;
  return jsonb_build_object('ok', true, 'due', out);
end $function$;
revoke all on function public.biz_quotes_due_all(text, integer, integer, integer) from public;
grant execute on function public.biz_quotes_due_all(text, integer, integer, integer) to anon, service_role;
notify pgrst, 'reload schema';
