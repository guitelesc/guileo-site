-- 2026-09-30 · FEEDBACK PRIVADO DA VISITA — o canal "algo não foi bem? fale direto com a gente".
-- Por quê: o cliente insatisfeito hoje só tem um lugar para falar — o Google. Com este canal ele
-- fala com o negócio primeiro, a dona é avisada na hora e pode resolver.
-- 🚨 ISTO NÃO É "REVIEW GATING". O e-mail de avaliação mostra o link do Google para TODOS, e este
-- canal é um segundo botão, igual para todos. Ninguém é desviado nem deixa de receber o link por
-- estar insatisfeito — condicionar o convite à satisfação viola a política do Google e pode derrubar
-- a ficha do negócio (ver o aviso no reviewRequestEmail). A página de feedback continua mostrando o
-- link de avaliação depois do envio.
-- Idempotente. Portão _gui_sched_ok. Só service_role: quem chama é /api/visita, no servidor.
alter table biz_appointments add column if not exists feedback text;
alter table biz_appointments add column if not exists feedback_at timestamptz;

-- p_comment NULL → só LÊ (para montar a página). Com texto → grava e diz se foi a primeira vez.
-- A visita tem que ser do tenant: uuid sozinho nunca autoriza nada.
CREATE OR REPLACE FUNCTION public.biz_visit_feedback(p_secret text, p_email text, p_id uuid, p_comment text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_t text := lower(trim(coalesce(p_email,''))); r record; v_primeira boolean := false; v_txt text := nullif(trim(coalesce(p_comment,'')), '');
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select a.id, a.customer_name, a.customer_contact, a.ref, a.feedback_at, upper(a.span) as fim,
         s.name as servico, l.name as unidade, l.tz
    into r
    from biz_appointments a
    left join biz_services s on s.id = a.service_id
    left join biz_locations l on l.id = a.location_id
   where a.id = p_id and a.client_email = v_t;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_txt is not null then
    v_primeira := r.feedback_at is null;
    update biz_appointments set feedback = left(v_txt, 1000), feedback_at = now() where id = p_id and client_email = v_t;
  end if;
  return jsonb_build_object('ok', true, 'first', v_primeira, 'saved', v_txt is not null,
    'name', r.customer_name, 'contact', r.customer_contact, 'ref', r.ref,
    'service', r.servico, 'location', r.unidade, 'tz', r.tz, 'when', r.fim);
end $function$;
revoke all on function public.biz_visit_feedback(text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.biz_visit_feedback(text, text, uuid, text) to service_role;
notify pgrst, 'reload schema';
