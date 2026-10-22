-- customer_memory_get v2 (2026-09-30) — RECONHECER NO CHAT COMO NO TELEFONE.
-- ============================================================================
-- POR QUE: a v1 casava o telefone só por igualdade (`c.phone = v_phone` ou sem o +1). O telefone
-- (crm_caller_context) já tinha aprendido que o mesmo número mora no CRM em vários formatos
-- ("+19295350191", "19295350191", "9295350191") e casa por `phone_variants` + cauda de 8 dígitos.
-- Resultado da diferença: o Luis era reconhecido ligando e seria um estranho escrevendo o MESMO
-- número no chat. Agora as duas portas usam a mesma régua. Nada mais muda (mesma assinatura, mesmo
-- retorno, mesmo portão INGEST).
-- Idempotente: create or replace.
create or replace function public.customer_memory_get(
  p_secret text, p_email text, p_phone text default null, p_contact_email text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tenant   text := lower(trim(p_email));
  v_phone    text := nullif(regexp_replace(coalesce(p_phone,''),'[^0-9+]','','g'),'');
  v_cemail   text := nullif(lower(trim(coalesce(p_contact_email,''))),'');
  v_vars     text[] := '{}';
  v_tail     text := '';
  v_id       uuid;
  v_name     text;
  v_last     timestamptz;
  v_first    timestamptz;
  v_visits   int;
  v_life     text;
  v_ltv      bigint;
  v_service  text := '';
  v_summary  text := '';
  v_noshows  int  := 0;
  v_channels jsonb := '[]'::jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_phone is null and v_cemail is null then return jsonb_build_object('known', false); end if;
  if v_phone is not null then
    v_vars := public.phone_variants(v_phone);
    v_tail := right(regexp_replace(v_phone,'[^0-9]','','g'), 8);
    if length(v_tail) < 8 then v_tail := ''; end if;   -- menos de 8 dígitos não identifica ninguém
  end if;

  select c.id, c.full_name, c.last_seen_at, c.first_seen_at, c.visit_count, c.lifecycle, c.ltv_cents
    into v_id, v_name, v_last, v_first, v_visits, v_life, v_ltv
    from crm_contacts c
    where c.client_email = v_tenant
      and ( (v_phone is not null and (c.phone = any(v_vars)
               or (v_tail <> '' and regexp_replace(coalesce(c.phone,''),'[^0-9]','','g') like ('%' || v_tail))))
         or (v_cemail is not null and lower(c.email) = v_cemail) )
    order by c.last_seen_at desc nulls last limit 1;
  if v_id is null then return jsonb_build_object('known', false); end if;

  begin
    select coalesce(s.name,'')
      into v_service
      from biz_appointments a
      left join biz_services s on s.id = a.service_id
      where a.client_email = v_tenant
        and ( (v_tail <> '' and regexp_replace(coalesce(a.customer_contact,''),'[^0-9]','','g') like ('%' || v_tail))
           or (v_cemail is not null and lower(a.customer_contact) = v_cemail) )
      order by lower(a.span) desc nulls last limit 1;

    select count(*)::int
      into v_noshows
      from biz_appointments a
      where a.client_email = v_tenant
        and a.status = 'no_show'
        and ( (v_tail <> '' and regexp_replace(coalesce(a.customer_contact,''),'[^0-9]','','g') like ('%' || v_tail))
           or (v_cemail is not null and lower(a.customer_contact) = v_cemail) );
  exception when undefined_table then v_service := ''; v_noshows := 0; end;

  begin
    select coalesce(e.summary,'')
      into v_summary
      from crm_timeline_events e
      where e.client_email = v_tenant and e.contact_id = v_id
      order by e.occurred_at desc limit 1;

    select coalesce(jsonb_agg(distinct ch), '[]'::jsonb)
      into v_channels
      from (
        select nullif(trim(e.channel),'') as ch
        from crm_timeline_events e
        where e.client_email = v_tenant and e.contact_id = v_id and nullif(trim(e.channel),'') is not null
      ) q;
  exception when undefined_table then v_summary := ''; v_channels := '[]'::jsonb; end;

  return jsonb_build_object(
    'known',        true,
    'id',           v_id,
    'name',         coalesce(v_name,''),
    'lifecycle',    coalesce(v_life,'lead'),
    'visits_count', coalesce(v_visits,0),
    'ltv_cents',    coalesce(v_ltv,0),
    'last_visit',   v_last,
    'first_seen',   v_first,
    'last_service', coalesce(v_service,''),
    'last_summary', coalesce(v_summary,''),
    'no_shows',     coalesce(v_noshows,0),
    'channels',     v_channels
  );
end $$;

grant execute on function public.customer_memory_get(text,text,text,text) to anon, service_role;
notify pgrst, 'reload schema';
