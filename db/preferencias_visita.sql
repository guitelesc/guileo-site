-- 2026-10-05 · PREFERÊNCIAS ANTES DA VISITA — "como você prefere?" (functions/api/preferencias.js)
-- A cliente abre o link assinado do e-mail de confirmação/lembrete e escolhe conversa, pressão,
-- temperatura, aroma, foco, alergias. Fica gravado NA VISITA e a dona recebe por e-mail.
-- A ALERGIA vai além da visita: entra na ficha da cliente no balcão (desk_clients.allergies), que a
-- agenda do Desk já mostra como alerta em todo horário dela — a recepção vê sem tela nova.
--   • soma ao que a recepção já anotou, nunca apaga; se o texto já está lá, não repete;
--   • a validação dos valores mora em functions/lib/preferencias.js; aqui só um teto de tamanho.
-- Idempotente. Portão _gui_sched_ok. Só service_role (quem chama é o servidor).
alter table biz_appointments add column if not exists prefs jsonb;
alter table biz_appointments add column if not exists prefs_at timestamptz;

-- p_prefs NULL → só LÊ (para montar a página). Com objeto → grava (se a visita ainda não passou).
-- A visita tem que ser do tenant: uuid sozinho nunca autoriza nada.
CREATE OR REPLACE FUNCTION public.biz_visit_prefs(p_secret text, p_email text, p_id uuid, p_prefs jsonb DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_t text := lower(trim(coalesce(p_email,'')));
  r record;
  v_primeira boolean := false;
  v_fechada boolean;
  v_al text;
  v_ck text;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  select a.id, a.customer_name, a.customer_contact, a.ref, a.status, a.prefs, a.prefs_at, lower(a.span) as inicio,
         s.name as servico, l.name as unidade, l.tz
    into r
    from biz_appointments a
    left join biz_services s on s.id = a.service_id
    left join biz_locations l on l.id = a.location_id
   where a.id = p_id and a.client_email = v_t;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  -- depois que a visita começou (ou foi cancelada) não há o que preparar
  v_fechada := r.inicio < now() or lower(coalesce(r.status,'')) in ('cancelled','canceled','no_show','noshow');

  if p_prefs is not null then
    if v_fechada then return jsonb_build_object('ok', false, 'reason', 'closed'); end if;
    if jsonb_typeof(p_prefs) <> 'object' or pg_column_size(p_prefs) > 4000 then return jsonb_build_object('ok', false, 'reason', 'bad_prefs'); end if;
    v_primeira := r.prefs_at is null;
    update biz_appointments set prefs = p_prefs, prefs_at = now() where id = p_id and client_email = v_t;

    v_al := nullif(left(trim(coalesce(p_prefs->>'allergies','')), 300), '');
    v_ck := case when coalesce(r.customer_contact,'') <> '' then _desk_ck(r.customer_contact) end;
    if v_al is not null and v_ck is not null and v_ck <> '' then
      insert into desk_clients (client_email, contact_key, name, phone, email, allergies, updated_at)
      values (v_t, v_ck, r.customer_name,
              case when r.customer_contact like '%@%' then null else r.customer_contact end,
              case when r.customer_contact like '%@%' then lower(r.customer_contact) end,
              v_al, now())
      on conflict (client_email, contact_key) do update set
        allergies = case
          when coalesce(trim(desk_clients.allergies),'') = '' then excluded.allergies
          when position(lower(excluded.allergies) in lower(desk_clients.allergies)) > 0 then desk_clients.allergies
          else left(desk_clients.allergies || ' · ' || excluded.allergies, 600) end,
        updated_at = now();
    end if;
  end if;

  return jsonb_build_object('ok', true, 'first', v_primeira, 'saved', p_prefs is not null, 'closed', v_fechada,
    'name', r.customer_name, 'contact', r.customer_contact, 'ref', r.ref,
    'service', r.servico, 'location', r.unidade, 'tz', r.tz, 'start', r.inicio,
    'prefs', case when p_prefs is not null then p_prefs else r.prefs end);
end $function$;
revoke all on function public.biz_visit_prefs(text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.biz_visit_prefs(text, text, uuid, jsonb) to service_role;
notify pgrst, 'reload schema';
