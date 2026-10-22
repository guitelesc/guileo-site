-- GUILEO DESK v5 — "MINHA CONTA" DA CLIENTE DO NEGÓCIO (2026-10-05). Migrações `desk_v5_2_minha_conta` +
-- `desk_v5_2b_minha_conta_passado` (visita passada sem baixa no balcão NÃO vira "concluída": sai o status do motor).
-- Só ACRESCENTA; nenhuma função existente muda.
--
-- O QUE É: a área da cliente final (como o app de cliente do MindBody/Booksy): próximos horários,
-- visitas passadas, saldo de pacote e de vale-presente. Sem senha: a cliente digita o e-mail em
-- /minha-conta?t=<negócio>, o servidor (/api/minha-conta "pedir") manda um link assinado
-- (lib/visita.js contaUrl, propósito "conta", vale 7 dias) — e SÓ manda se o e-mail for cliente
-- DESTE negócio. A resposta da página é sempre a mesma, para não revelar quem é cliente.
--
-- PORTA: as duas funções abaixo são SÓ service_role (sem anon, sem authenticated). Quem confere o link
-- é o servidor; o banco confia no tenant + e-mail que o servidor manda, como desk_self_get_svc.
--
-- QUEM É A CLIENTE: a chave de contato (_desk_ck, db/desk_v2.sql) do e-mail digitado + os telefones
-- que o PRÓPRIO negócio já ligou a esse e-mail (crm_contacts e desk_clients na mesma linha). Assim quem
-- marcou por telefone e deu o e-mail uma vez vê também os horários marcados pelo telefone.
-- ⚠️ phone_key do CRM é _gui_phone_key (número inteiro fora dos EUA); _desk_ck é os últimos 10
-- dígitos. Por isso a ligação usa _desk_ck(c.phone), nunca c.phone_key.
--
-- LIVE_DESDE: agendamentos e contatos do CRM saem das fontes vivas (vivo_biz_appointments,
-- vivo_crm_contacts, db/live_desde.sql) — teste de pré-lançamento não aparece para a cliente.

create or replace function public._conta_chaves(p_tenant text, p_email text)
returns text[] language sql stable security definer set search_path to 'public' as $$
  with e as (select lower(trim(coalesce(p_tenant, ''))) t, lower(trim(coalesce(p_email, ''))) m)
  select case when (select m from e) !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then array[]::text[] else
    array(select distinct k from (
        select (select m from e) k
        union all select public._desk_ck(c.phone) from public.vivo_crm_contacts((select t from e)) c
                   where lower(trim(coalesce(c.email, ''))) = (select m from e)
        union all select d.contact_key from desk_clients d, e where d.client_email = e.t and lower(trim(coalesce(d.email, ''))) = e.m
        union all select public._desk_ck(d.phone) from desk_clients d, e where d.client_email = e.t and lower(trim(coalesce(d.email, ''))) = e.m
      ) x where k is not null and k <> '')
  end
$$;

-- Existe como cliente DESTE negócio? Só o e-mail conta (o link vai para ele): CRM, ficha do balcão,
-- agendamento com esse e-mail, pacote ou vale com esse e-mail.
create or replace function public.desk_conta_existe_svc(p_tenant text, p_email text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare t text := lower(trim(coalesce(p_tenant, ''))); m text := lower(trim(coalesce(p_email, ''))); v_nome text; v_existe boolean;
begin
  if t !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or m !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    return jsonb_build_object('ok', true, 'existe', false);
  end if;
  v_existe := exists(select 1 from public.vivo_crm_contacts(t) c where lower(trim(coalesce(c.email, ''))) = m)
    or exists(select 1 from desk_clients d where d.client_email = t and (d.contact_key = m or lower(trim(coalesce(d.email, ''))) = m))
    or exists(select 1 from public.vivo_biz_appointments(t) a where a.status <> 'blocked' and public._desk_ck(a.customer_contact) = m)
    or exists(select 1 from package_purchases pp where pp.client_email = t and public._desk_ck(pp.contact) = m)
    or exists(select 1 from gift_cards g where g.client_email = t and (public._desk_ck(g.purchaser_contact) = m or public._desk_ck(g.recipient_contact) = m));
  if not v_existe then return jsonb_build_object('ok', true, 'existe', false); end if;
  v_nome := coalesce(
    (select nullif(trim(d.name), '') from desk_clients d where d.client_email = t and (d.contact_key = m or lower(trim(coalesce(d.email, ''))) = m) limit 1),
    (select nullif(trim(c.full_name), '') from public.vivo_crm_contacts(t) c where lower(trim(coalesce(c.email, ''))) = m limit 1),
    (select nullif(trim(a.customer_name), '') from public.vivo_biz_appointments(t) a where public._desk_ck(a.customer_contact) = m order by a.created_at desc limit 1));
  return jsonb_build_object('ok', true, 'existe', true, 'name', v_nome,
    'business', coalesce((select tokens->>'business_name' from client_integrations where client_email = t and provider = 'profile' limit 1), ''));
end $$;

-- O que a cliente vê. Nada de nota interna, alergia, comissão, telefone de outra pessoa ou código
-- inteiro de vale (só os 4 últimos — o balcão acha o vale pela ficha).
create or replace function public.desk_conta_ver_svc(p_tenant text, p_email text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare t text := lower(trim(coalesce(p_tenant, ''))); ks text[] := public._conta_chaves(p_tenant, p_email); v_ex jsonb;
begin
  v_ex := public.desk_conta_existe_svc(p_tenant, p_email);
  if coalesce((v_ex->>'existe')::boolean, false) is not true or coalesce(array_length(ks, 1), 0) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  return jsonb_build_object('ok', true, 'name', v_ex->>'name',
    'business', jsonb_build_object(
      'name', v_ex->>'business',
      'slug', (select s.slug from client_sites s where s.client_email = t and s.published = true order by s.updated_at desc nulls last limit 1),
      'locations', coalesce((select jsonb_agg(jsonb_build_object('name', l.name, 'address', l.address, 'phone', l.phone, 'tz', coalesce(l.tz, 'America/New_York')) order by l.created_at)
                    from biz_locations l where l.client_email = t and coalesce(l.active, true)), '[]'::jsonb)),
    'upcoming', coalesce((select jsonb_agg(x.j order by x.ini) from (
        select lower(a.span) ini, jsonb_build_object('id', a.id, 'ref', a.ref, 'start', lower(a.span), 'end', upper(a.span),
          'status', coalesce(a.attributes->>'desk_status', a.status), 'service_id', a.service_id, 'service', s.name,
          'duration_min', s.duration_min, 'pro', p.name, 'location', l.name, 'address', l.address, 'phone', l.phone,
          'tz', coalesce(l.tz, 'America/New_York'), 'cancel_window_h', coalesce(s.cancel_window_h, 0),
          'deposit_paid', coalesce((a.attributes->>'deposit_paid')::boolean, false)) j
          from public.vivo_biz_appointments(t) a
          left join biz_services s on s.id = a.service_id left join biz_professionals p on p.id = a.pro_id left join biz_locations l on l.id = a.location_id
         where public._desk_ck(a.customer_contact) = any(ks) and lower(a.span) > now()
           and a.status not in ('cancelled', 'canceled', 'no_show', 'blocked')
           and not (a.status = 'hold' and a.expires_at is not null and a.expires_at < now())
         order by lower(a.span) limit 20) x), '[]'::jsonb),
    'past', coalesce((select jsonb_agg(x.j order by x.ini desc) from (
        select lower(a.span) ini, jsonb_build_object('id', a.id, 'start', lower(a.span),
          'status', case when a.status = 'no_show' then 'no_show' else coalesce(a.attributes->>'desk_status', a.status) end,
          'service_id', a.service_id, 'service', s.name, 'pro', p.name, 'location', l.name, 'tz', coalesce(l.tz, 'America/New_York'),
          'service_active', coalesce(s.active, false)) j
          from public.vivo_biz_appointments(t) a
          left join biz_services s on s.id = a.service_id left join biz_professionals p on p.id = a.pro_id left join biz_locations l on l.id = a.location_id
         where public._desk_ck(a.customer_contact) = any(ks) and lower(a.span) <= now()
           and a.status not in ('cancelled', 'canceled', 'blocked', 'hold')
         order by lower(a.span) desc limit 30) x), '[]'::jsonb),
    'packages', coalesce((select jsonb_agg(jsonb_build_object('name', pk.name, 'service', pk.service,
                'left', greatest(pp.sessions_total - pp.sessions_used, 0), 'total', pp.sessions_total, 'purchased_at', pp.purchased_at)
                order by (pp.sessions_total - pp.sessions_used > 0) desc, pp.purchased_at desc)
              from package_purchases pp left join packages pk on pk.id = pp.package_id
             where pp.client_email = t and public._desk_ck(pp.contact) = any(ks)), '[]'::jsonb),
    'gift_cards', coalesce((select jsonb_agg(jsonb_build_object('last4', right(g.code, 4), 'balance_cents', g.balance_cents,
                'amount_cents', g.amount_cents, 'active', g.active,
                'role', case when public._desk_ck(g.recipient_contact) = any(ks) then 'received' else 'bought' end)
                order by g.active desc, g.created_at desc)
              from gift_cards g where g.client_email = t
               and (public._desk_ck(g.recipient_contact) = any(ks) or public._desk_ck(g.purchaser_contact) = any(ks))), '[]'::jsonb));
end $$;

revoke all on function public._conta_chaves(text, text) from public, anon, authenticated;
revoke all on function public.desk_conta_existe_svc(text, text) from public, anon, authenticated;
revoke all on function public.desk_conta_ver_svc(text, text) from public, anon, authenticated;
grant execute on function public.desk_conta_existe_svc(text, text) to service_role;
grant execute on function public.desk_conta_ver_svc(text, text) to service_role;
