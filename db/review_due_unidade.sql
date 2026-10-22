-- 2026-09-28 · biz_review_due passa a devolver a UNIDADE (`location`) de cada visita.
-- Por quê: a Natura tem 3 fichas no Google (Astoria 1.007 avaliações, UES Salon 269, UES Med Spa 18).
-- Pedir avaliação sempre no mesmo link mandava o cliente da Med Spa avaliar Astoria — a unidade que
-- mais precisa de avaliação nunca recebia nenhuma. Com a unidade, o proactive escolhe o link dela
-- (profile_extras.review_links[nome da unidade]) e cai no review_link geral quando não houver.
-- Mesma assinatura, mesmo portão (_gui_sched_ok) — só um campo a mais; idempotente.
CREATE OR REPLACE FUNCTION public.biz_review_due(p_secret text, p_email text, p_after_hours integer DEFAULT 3, p_max_days integer DEFAULT 7, p_limit integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v jsonb; begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'contact', a.customer_contact, 'name', a.customer_name,
           'service', s.name, 'when', upper(a.span), 'ref', a.ref, 'location', l.name) order by upper(a.span) desc), '[]'::jsonb)
    into v
    from biz_appointments a
    left join biz_services s on s.id = a.service_id
    left join biz_locations l on l.id = a.location_id
   where a.client_email = p_email
     and a.status = 'booked'
     and not a.review_asked
     and upper(a.span) < now() - (greatest(coalesce(p_after_hours,3),0)||' hours')::interval
     and upper(a.span) > now() - (greatest(coalesce(p_max_days,7),1)||' days')::interval
   limit greatest(coalesce(p_limit,50),1);
  return jsonb_build_object('due', coalesce(v,'[]'::jsonb));
end $function$;
-- ⚠️ SEM revoke/grant de propósito: o proactive.js chama esta RPC com a chave ANON (o portão é o
-- _gui_sched_ok). CREATE OR REPLACE preserva as permissões atuais; revogar o anon aqui mataria o motor.
notify pgrst, 'reload schema';
