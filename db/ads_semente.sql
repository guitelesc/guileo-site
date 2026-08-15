-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- ads_semente — QUEM REALMENTE COMPROU, para virar o público do próximo anúncio.
--
-- Devolve os contatos (telefone ou e-mail, como o cliente digitou) das pessoas com agendamento
-- NÃO cancelado no período. `functions/api/ads.js` (action `reinvestir`) hasheia em SHA-256 antes
-- de devolver — a lista de clientes do cliente nunca sai daqui em texto puro. É a base do público
-- semelhante: em vez de mirar "interesse em spa", mira gente parecida com quem já pagou.
--
-- POR QUE ESTE ARQUIVO NASCEU EM 2026-08-11: ele não existia. A função rodava em produção sem uma
-- linha no repositório, e o próprio ads.js dizia ao usuário "aplique db/ads_semente.sql?" quando
-- ela falhava — apontando para um arquivo que ninguém tinha. Capturada do banco sem alteração de
-- comportamento; o que mudou foi passar a existir onde dá para revisar.
--
-- `no_show`/`expired` ficam de fora de propósito: semear o público com quem não apareceu ensina a
-- plataforma a trazer mais gente que não aparece.
-- Idempotente.
-- ═════════════════════════════════════════════════════════════════════════════════════════════
create or replace function public.ads_semente(p_secret text, p_email text, p_days integer default 30)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_tenant text := lower(trim(coalesce(p_email,''))); v_desde timestamptz; v jsonb;
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350') then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_tenant = '' then raise exception 'tenant required' using errcode = '22023'; end if;
  v_desde := now() - (greatest(1, least(365, coalesce(p_days,30))) || ' days')::interval;

  select coalesce(jsonb_agg(distinct c), '[]'::jsonb) into v
  from (
    select nullif(trim(lower(a.customer_contact)), '') as c
    from biz_appointments a
    where a.client_email = v_tenant
      and a.created_at >= v_desde
      and coalesce(a.status,'') not in ('cancelled','canceled','no_show','expired')
      and coalesce(a.customer_contact,'') <> ''
  ) s
  where c is not null;

  return jsonb_build_object('ok', true, 'contatos', v,
    'quantos', coalesce(jsonb_array_length(v), 0), 'desde', v_desde);
end $function$;

revoke all on function public.ads_semente(text,text,integer) from anon, public;
