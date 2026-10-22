-- GUILEO DESK v8 — "Exportar tudo" (2026-10-21)
-- A promessa pública do /desk ("Exporte suas clientes quando quiser, de graça. Sem taxa de saída.") não tinha
-- tela nem rota. O MindBody cobra ~US$ 500 e só entrega no cancelamento; aqui é um botão, a qualquer hora,
-- inclusive com a assinatura cancelada (lib/deskTrava.js deixa `export` passar no plano 'nenhum').
--
-- PORTA: _desk_ok (chave da dona). A recepção e a profissional não chegam aqui: `export` não está na
-- lista do papel em lib/deskAcesso.js → 403 role_forbidden antes da leitura.
-- SÓ LÊ. Nada muda em tabela nenhuma.
--
-- desk_export(email, key, what, offset, limit) → { ok, what, total, offset, rows[] }
--   what = 'clients'      uma linha por cliente (a MESMA união da busca do balcão: CRM, agenda, caixa, ficha)
--          'appointments' todos os agendamentos (sem bloqueios de horário), do mais antigo ao mais novo
--          'sales'        uma linha por item vendido, com a venda e as formas de pagamento repetidas
--          'balances'     saldos que valem dinheiro: pacotes, vales-presente, assinaturas
--   Página de até 5000 linhas; a tela pede de novo com offset até completar `total`.
-- Idempotente: create or replace.

create or replace function public.desk_export(p_email text, p_key text, p_what text, p_offset int default 0, p_limit int default 5000)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key);
        o int := greatest(coalesce(p_offset, 0), 0);
        l int := least(greatest(coalesce(p_limit, 5000), 1), 5000);
        n bigint; r jsonb;
begin
  if p_what = 'clients' then
    with chaves as (
      select c.phone_key ck from crm_contacts c where c.client_email = e and c.phone_key is not null
      union select lower(c.email) from crm_contacts c where c.client_email = e and c.phone_key is null and c.email is not null
      union select public._desk_ck(a.customer_contact) from public.vivo_biz_appointments(e) a where a.status <> 'blocked'
      union select s.contact_key from desk_sales s where s.client_email = e
      union select d.contact_key from desk_clients d where d.client_email = e
    ), todas as (select ck from chaves where ck is not null)
    select count(*) into n from todas;
    with chaves as (
      select c.phone_key ck from crm_contacts c where c.client_email = e and c.phone_key is not null
      union select lower(c.email) from crm_contacts c where c.client_email = e and c.phone_key is null and c.email is not null
      union select public._desk_ck(a.customer_contact) from public.vivo_biz_appointments(e) a where a.status <> 'blocked'
      union select s.contact_key from desk_sales s where s.client_email = e
      union select d.contact_key from desk_clients d where d.client_email = e
    ), pagina as (select ck from chaves where ck is not null order by ck offset o limit l),
    ag as (
      select public._desk_ck(a.customer_contact) ck, max(a.customer_name) nome,
             count(*) filter (where a.status not in ('cancelled', 'no_show') and upper(a.span) < now()) visitas,
             count(*) filter (where a.status = 'no_show') faltas,
             count(*) filter (where a.status = 'cancelled') cancelamentos,
             max(lower(a.span)) filter (where a.status not in ('cancelled', 'no_show') and upper(a.span) < now()) ultima,
             min(lower(a.span)) filter (where a.status not in ('cancelled', 'no_show') and lower(a.span) > now()) proxima
        from public.vivo_biz_appointments(e) a where a.status <> 'blocked' and public._desk_ck(a.customer_contact) in (select ck from pagina)
       group by 1),
    gasto as (  -- mesma régua da ficha: só dinheiro novo (dinheiro/cartão/outro), sem gorjeta
      select s.contact_key ck,
             greatest(coalesce(sum(p.amount_cents) filter (where p.method in ('cash', 'card', 'other')), 0)
                      - coalesce((select sum(s2.tip_cents) from desk_sales s2 where s2.client_email = e and s2.contact_key = s.contact_key and s2.status = 'paid'), 0), 0) cents
        from desk_sales s join desk_payments p on p.sale_id = s.id
       where s.client_email = e and s.status = 'paid' and s.contact_key in (select ck from pagina)
       group by s.contact_key)
    select coalesce(jsonb_agg(jsonb_build_object(
             'contact_key', pg.ck,
             'name', coalesce(d.name, c.full_name, ag.nome),
             'phone', coalesce(d.phone, c.phone, case when pg.ck !~ '@' then pg.ck end),
             'email', coalesce(d.email, c.email, case when pg.ck ~ '@' then pg.ck end),
             'birth_date', c.birth_date,
             'allergies', d.allergies, 'alerts', d.alerts, 'notes', d.notes,
             'tags', coalesce(d.tags, c.tags),
             'trusted', d.trusted, 'can_book_online', d.can_book_online,
             'lead_source', c.lead_source, 'first_seen_at', c.first_seen_at,
             'visits', coalesce(ag.visitas, 0), 'no_shows', coalesce(ag.faltas, 0), 'cancellations', coalesce(ag.cancelamentos, 0),
             'last_visit', ag.ultima, 'next_visit', ag.proxima,
             'spend_cents', coalesce(gasto.cents, 0)) order by pg.ck), '[]'::jsonb)
      into r
      from pagina pg
      left join desk_clients d on d.client_email = e and d.contact_key = pg.ck
      left join lateral (select * from crm_contacts c where c.client_email = e and (c.phone_key = pg.ck or lower(c.email) = pg.ck)
                          order by c.last_seen_at desc nulls last limit 1) c on true
      left join ag on ag.ck = pg.ck
      left join gasto on gasto.ck = pg.ck;

  elsif p_what = 'appointments' then
    select count(*) into n from public.vivo_biz_appointments(e) a where a.status <> 'blocked';
    select coalesce(jsonb_agg(x order by (x->>'start')), '[]'::jsonb) into r from (
      select jsonb_build_object(
               'id', a.id, 'ref', a.ref,
               'start', lower(a.span), 'end', upper(a.span), 'timezone', loc.tz, 'location', loc.name,
               'professional', p.name, 'service', s.name, 'price_cents', s.price_cents,
               'customer_name', a.customer_name, 'customer_contact', a.customer_contact,
               'status', case when a.status in ('cancelled', 'no_show') then a.status else coalesce(a.attributes->>'desk_status', a.status) end,
               'source', coalesce(a.attributes->>'source', a.source),
               'note', a.attributes->>'desk_note',
               'deposit_paid', coalesce((a.attributes->>'deposit_paid')::boolean, false),
               'cancelled_at', a.attributes->>'cancelled_at', 'cancelled_by', a.attributes->>'cancelled_by',
               'created_at', a.created_at) x
        from public.vivo_biz_appointments(e) a
        left join biz_services s on s.id = a.service_id
        left join biz_professionals p on p.id = a.pro_id
        left join biz_locations loc on loc.id = a.location_id
       where a.status <> 'blocked'
       order by lower(a.span), a.id offset o limit l) z;

  elsif p_what = 'sales' then
    select count(*) into n from desk_sale_lines li join desk_sales s on s.id = li.sale_id where s.client_email = e;
    select coalesce(jsonb_agg(x order by (x->>'sold_at'), (x->>'sale_number')), '[]'::jsonb) into r from (
      select jsonb_build_object(
               'sale_number', s.number, 'sold_at', s.created_at, 'sale_status', s.status, 'location', loc.name,
               'customer_name', s.customer_name, 'customer_contact', s.customer_contact,
               'item_kind', li.kind, 'item', li.name, 'qty', li.qty, 'unit_cents', li.unit_cents,
               'item_discount_cents', li.discount_cents, 'item_total_cents', li.total_cents,
               'professional', p.name, 'commission_cents', li.commission_cents,
               'sale_total_cents', s.total_cents, 'sale_tax_cents', s.tax_cents, 'sale_tip_cents', s.tip_cents,
               'payments', (select string_agg(pg.method || ':' || pg.amount_cents, ' ; ' order by pg.created_at) from desk_payments pg where pg.sale_id = s.id),
               'voided_at', s.voided_at, 'void_reason', s.void_reason) x
        from desk_sale_lines li
        join desk_sales s on s.id = li.sale_id and s.client_email = e
        left join biz_professionals p on p.id = li.pro_id
        left join biz_locations loc on loc.id = s.location_id
       order by s.created_at, s.number, li.id offset o limit l) z;

  elsif p_what = 'balances' then
    with saldos as (
      select 'package' as tipo, pp.contact as contato, pk.name as item, null::text as code,
             pp.sessions_total as total_sessoes, pp.sessions_used as usadas, pp.sessions_total - pp.sessions_used as restantes,
             null::bigint as valor, null::bigint as saldo, null::text as status, pp.purchased_at as desde
        from package_purchases pp left join packages pk on pk.id = pp.package_id where pp.client_email = e
      union all
      select 'gift_card', coalesce(g.recipient_contact, g.purchaser_contact), 'Gift card', g.code,
             null, null, null, g.amount_cents, g.balance_cents, case when g.active then 'active' else 'inactive' end, g.created_at
        from gift_cards g where g.client_email = e
      union all
      select 'membership', ms.contact, m.name, null, null, null, null, m.price_cents, null, ms.status, ms.started_at
        from membership_subscribers ms left join memberships m on m.id = ms.membership_id where ms.client_email = e
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'type', tipo, 'contact', contato, 'item', item, 'code', code,
             'sessions_total', total_sessoes, 'sessions_used', usadas, 'sessions_left', restantes,
             'amount_cents', valor, 'balance_cents', saldo, 'status', status, 'since', desde) order by tipo, desde), '[]'::jsonb)
      into r
      from (select * from saldos order by tipo, desde offset o limit l) pg;
    select count(*) into n from (
      select 1 from package_purchases where client_email = e
      union all select 1 from gift_cards where client_email = e
      union all select 1 from membership_subscribers where client_email = e) t;

  else
    return jsonb_build_object('ok', false, 'reason', 'invalid_export');
  end if;

  return jsonb_build_object('ok', true, 'what', p_what, 'total', n, 'offset', o, 'rows', coalesce(r, '[]'::jsonb));
end $$;

revoke all on function public.desk_export(text, text, text, int, int) from public;
grant execute on function public.desk_export(text, text, text, int, int) to anon, authenticated, service_role;
