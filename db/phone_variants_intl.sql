-- =============================================================================
-- RECONHECIMENTO DE CLIENTE POR TELEFONE — INTERNACIONAL
-- Aplicado em 2026-08-03 (migrations: phone_variants_br_ninth_digit,
--                                     crm_caller_context_intl_phone_match)
--
-- O BUG (descoberto ao ligar o WhatsApp Cloud da Med Mundo):
--   A Graph API devolveu
--       input: "5565992890367"   (13 digitos, como o cliente digita)
--       wa_id: "556592890367"    (12 digitos, o identificador real)
--   Celulares brasileiros ganharam o nono digito em 2012, mas contas antigas de
--   WhatsApp seguem registradas no formato velho. Ou seja: o MESMO cliente chega
--   com telefone diferente dependendo do canal (WhatsApp x ligacao x formulario).
--
--   crm_caller_context so tentava o numero cru e uma variante sem "+1" (EUA).
--   Resultado: cliente brasileiro que falava por WhatsApp NUNCA era reconhecido —
--   a Gui tratava como desconhecido, perdia historico e nao chamava pelo nome.
--   Falha silenciosa: nada quebrava, so a memoria do cliente sumia.
--
-- A CORRECAO:
--   1) phone_variants(text) -> text[]  gera todas as formas equivalentes
--      (com/sem nono digito BR, com/sem "1" dos EUA, com/sem "+").
--   2) crm_caller_context casa com = any(variants) e, como rede, pelos ultimos
--      8 digitos (estaveis entre os dois formatos BR), sempre DENTRO do tenant.
--
-- PROVA (2026-08-03): contato gravado sem o 9 foi reconhecido consultando com e
-- sem o 9; consulta de outro tenant devolveu {} (sem vazamento).
-- =============================================================================

create or replace function public.phone_variants(p_phone text)
returns text[]
language sql
immutable
as $$
  with d as (
    select nullif(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'),'') as n
  ),
  v as (
    select n from d where n is not null
    union select substr(n,2) from d where n ~ '^1[0-9]{10}$'
    union select '55'||substr(n,3,2)||substr(n,6) from d where n ~ '^55[0-9]{2}9[0-9]{8}$'
    union select '55'||substr(n,3,2)||'9'||substr(n,5) from d where n ~ '^55[0-9]{2}[0-9]{8}$'
  )
  select coalesce(array_agg(distinct x), '{}'::text[])
  from (select n as x from v union all select '+'||n from v) s;
$$;

revoke all on function public.phone_variants(text) from public, anon, authenticated;

create or replace function public.crm_caller_context(p_secret text, p_email text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant text := lower(trim(p_email));
  v_phone  text := nullif(regexp_replace(coalesce(p_phone,''),'[^0-9+]','','g'),'');
  v_vars   text[];
  v_tail   text;
  v_id uuid; v_name text; v_last timestamptz; v_visits int;
  v_service text := ''; v_summary text := '';
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350','glo_ing_c7f2a9e4b8d16350') then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_phone is null then return '{}'::jsonb; end if;

  v_vars := public.phone_variants(v_phone);
  v_tail := right(regexp_replace(v_phone,'[^0-9]','','g'), 8);

  select c.id, c.full_name, c.last_seen_at, c.visit_count
    into v_id, v_name, v_last, v_visits
    from crm_contacts c
   where c.client_email = v_tenant
     and (c.phone = any(v_vars)
          or (length(v_tail) = 8
              and regexp_replace(coalesce(c.phone,''),'[^0-9]','','g') like ('%' || v_tail)))
   order by c.last_seen_at desc nulls last
   limit 1;

  if v_id is null then return '{}'::jsonb; end if;

  if length(coalesce(v_tail,'')) = 8 then
    begin
      select coalesce(s.name,'') into v_service
        from biz_appointments a
        left join biz_services s on s.id = a.service_id
       where a.client_email = v_tenant
         and regexp_replace(coalesce(a.customer_contact,''),'[^0-9]','','g') like ('%' || v_tail)
       order by lower(a.span) desc nulls last
       limit 1;
    exception when undefined_table then v_service := ''; end;
  end if;

  begin
    select coalesce(e.summary,'') into v_summary
      from crm_timeline_events e
     where e.client_email = v_tenant and e.contact_id = v_id
     order by e.occurred_at desc limit 1;
  exception when undefined_table then v_summary := ''; end;

  return jsonb_build_object(
    'name', coalesce(v_name,''),
    'last_visit', v_last,
    'visits_count', coalesce(v_visits,0),
    'last_service', coalesce(v_service,''),
    'summary', coalesce(v_summary,''));
end $function$;

revoke all on function public.crm_caller_context(text,text,text) from public, anon, authenticated;
