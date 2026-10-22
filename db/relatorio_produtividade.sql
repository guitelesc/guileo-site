-- ============================================================================
-- Guileo · RELATÓRIO DE PRODUTIVIDADE  (aplicar via MCP / SQL Editor — idempotente)
-- Project: ynihodbknhjirkdogxby
--
-- O QUE RESPONDE: num período escolhido, quais PROFISSIONAIS e quais SERVIÇOS mais venderam
-- (e, de brinde, quais UNIDADES). Uma RPC só, leitura pura: `biz_productivity`.
-- Chamada por functions/api/relatorio-produtividade.js (portão do tenant: e-mail + chave) e
-- desenhada por src/portal/Productivity.jsx.
--
-- ── O QUE CONTA COMO "VISITA" ───────────────────────────────────────────────────────────────
-- Status reais de biz_appointments.status (lidos no SQL de db/, não chutados):
--   'booked'     — padrão de biz_book (agendamento firme). NÃO existe status de "concluído":
--                  nenhuma função grava 'completed'. Visita passada = 'booked' com o fim no passado.
--   'hold'       — reserva provisória com expires_at (depósito/tentativa). Não é venda → FORA.
--                  Hold que expira vira 'cancelled' mantendo expires_at (holds_release.sql) e
--                  também fica FORA: não é cancelamento de cliente, é reserva que não fechou.
--   'cancelled'  — cancelado → contado à parte em `cancelled`, fora de visitas e receita.
--   'no_show'    — faltou → contado à parte em `no_shows`, fora de visitas e receita
--                  (contar o preço de tabela de quem não veio inflaria a receita).
--   ('completed','done','fulfilled','confirmed' aparecem só em leituras defensivas de
--    operations.sql / integrity_check.sql / xray.sql; se um dia forem gravados, contam como visita.)
-- Visita do período = o FIM do agendamento (upper(span)) caiu em [from, to) e o status não é
-- cancelled / no_show / hold. O `to` é limitado a now(): agendamento que ainda não terminou não
-- "vendeu" nada — o período devolvido em `period.to` é o efetivo.
--
-- ── RECEITA É PREÇO DE TABELA ───────────────────────────────────────────────────────────────
-- biz_appointments NÃO guarda valor cobrado. `revenue_cents` = soma de biz_services.price_cents
-- do serviço de cada visita (`revenue_basis: "list_price"`). Serviço sem preço (price_cents NULL,
-- ou visita sem serviço) soma zero e entra em `services_without_price` — o dono fica sabendo que
-- a receita está SUBESTIMADA. Desconto, pacote, gorjeta e cobrança real não entram aqui.
--
-- ── TENANT E ENTRADA EM OPERAÇÃO ────────────────────────────────────────────────────────────
-- Tudo é escopado por client_email = lower(trim(p_email)), inclusive os joins de nome/preço.
-- A fonte é `vivo_biz_appointments(email)` (db/live_desde.sql): agendamento criado antes do
-- `live_desde` do cliente é teste de pré-lançamento e não aparece — nem como visita do período,
-- nem como "visita anterior" que tornaria alguém cliente recorrente.
-- DEPENDE de db/live_desde.sql já aplicado (tenant_live_desde + vivo_biz_appointments).
--
-- ── SEGURANÇA ───────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER, search_path fixo, portão pelo literal INGEST (o mesmo de
-- db/recurring_revenue.sql). EXECUTE só para service_role: o navegador nunca chama esta função;
-- quem chama é o endpoint, depois de provar e-mail + chave do tenant.
-- ============================================================================

create or replace function public.biz_productivity(
  p_secret text,
  p_email  text,
  p_from   timestamptz,
  p_to     timestamptz,
  p_preset text default null
) returns jsonb
language plpgsql stable security definer set search_path to public as $fn$
declare
  v_email  text        := lower(trim(coalesce(p_email, '')));
  v_agora  timestamptz := now();
  v_to     timestamptz := coalesce(p_to, v_agora);
  v_from   timestamptz := coalesce(p_from, date_trunc('month', v_agora at time zone 'UTC') at time zone 'UTC');
  v_capped boolean     := false;
  v_out    jsonb;
  -- O MÊS É O DO NEGÓCIO, NÃO O DE LONDRES (revisão 2026-09-30). Com o mês em UTC, o atendimento
  -- das 20h do último dia do mês em Nova York (00h UTC do dia 1) caía no mês seguinte. `p_preset`
  -- monta o período no fuso da primeira unidade ativa do negócio; from/to ficam para período livre.
  v_tz     text        := 'America/New_York';
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    return jsonb_build_object('ok', false, 'error', 'email_required');
  end if;
  begin
    select coalesce(nullif(trim(l.tz), ''), v_tz) into v_tz
      from public.biz_locations l where l.client_email = v_email and l.active order by l.created_at limit 1;
    perform v_agora at time zone v_tz;
  exception when others then v_tz := 'America/New_York';
  end;
  v_tz := coalesce(v_tz, 'America/New_York');
  if p_preset = 'this_month' then
    v_from := date_trunc('month', v_agora at time zone v_tz) at time zone v_tz;
    v_to   := v_agora;
  elsif p_preset = 'last_month' then
    v_to   := date_trunc('month', v_agora at time zone v_tz) at time zone v_tz;
    v_from := (date_trunc('month', v_agora at time zone v_tz) - interval '1 month') at time zone v_tz;
  elsif p_preset = 'last_30_days' then
    v_from := v_agora - interval '30 days';
    v_to   := v_agora;
  end if;
  if v_to <= v_from then
    return jsonb_build_object('ok', false, 'error', 'bad_period');
  end if;

  -- teto de 400 dias: mantém o início pedido e encurta o fim
  if v_to - v_from > interval '400 days' then
    v_to := v_from + interval '400 days';
    v_capped := true;
  end if;
  -- só conta o que JÁ terminou
  if v_to > v_agora then v_to := v_agora; end if;

  begin
    with base as (
      select a.pro_id, a.service_id, a.location_id,
             coalesce(a.status, 'booked') as status,
             nullif(public._contato_chave(a.customer_contact), '') as contact,
             s.price_cents,
             (coalesce(a.status, 'booked') not in ('cancelled', 'canceled', 'no_show')) as is_visit
        from public.vivo_biz_appointments(v_email) a
        left join public.biz_services s
               on s.id = a.service_id and s.client_email = v_email
       where a.client_email = v_email
         and coalesce(a.status, 'booked') <> 'hold'
         -- hold que nunca virou agendamento (expirou → 'cancelled' com expires_at preenchido;
         -- biz_confirm zera expires_at ao confirmar) não é cancelamento de cliente
         and not (a.status in ('cancelled', 'canceled') and a.expires_at is not null)
         and upper(a.span) >= v_from
         and upper(a.span) <  v_to
    ),
    -- quem já tinha uma visita (não cancelada, não falta, não hold) com este tenant ANTES do período
    anteriores as (
      select distinct nullif(public._contato_chave(a.customer_contact), '') as contact
        from public.vivo_biz_appointments(v_email) a
       where a.client_email = v_email
         and coalesce(a.status, 'booked') not in ('cancelled', 'canceled', 'no_show', 'hold')
         and upper(a.span) < v_from
         and nullif(trim(coalesce(a.customer_contact, '')), '') is not null
    ),
    b as (
      select base.*,
             (base.contact is not null
              and exists (select 1 from anteriores x where x.contact = base.contact)) as is_returning
        from base
    ),
    tot as (
      select count(*) filter (where is_visit)                                   as bookings,
             count(*) filter (where status in ('cancelled', 'canceled'))                       as cancelled,
             count(*) filter (where status = 'no_show')                         as no_shows,
             coalesce(sum(price_cents) filter (where is_visit), 0)::bigint      as revenue_cents,
             count(*) filter (where is_visit and price_cents is null)           as services_without_price,
             count(distinct contact) filter (where is_visit)                    as customers,
             count(distinct contact) filter (where is_visit and is_returning)   as returning_customers
        from b
    ),
    g_pro as (
      select pro_id as gid,
             count(*) filter (where is_visit)                                   as bookings,
             count(*) filter (where status in ('cancelled', 'canceled'))                       as cancelled,
             count(*) filter (where status = 'no_show')                         as no_shows,
             coalesce(sum(price_cents) filter (where is_visit), 0)::bigint      as revenue_cents,
             count(*) filter (where is_visit and price_cents is null)           as services_without_price,
             count(distinct contact) filter (where is_visit)                    as customers,
             count(distinct contact) filter (where is_visit and is_returning)   as returning_customers
        from b group by pro_id
    ),
    g_svc as (
      select service_id as gid,
             count(*) filter (where is_visit)                                   as bookings,
             count(*) filter (where status in ('cancelled', 'canceled'))                       as cancelled,
             count(*) filter (where status = 'no_show')                         as no_shows,
             coalesce(sum(price_cents) filter (where is_visit), 0)::bigint      as revenue_cents,
             count(*) filter (where is_visit and price_cents is null)           as services_without_price,
             count(distinct contact) filter (where is_visit)                    as customers,
             count(distinct contact) filter (where is_visit and is_returning)   as returning_customers
        from b group by service_id
    ),
    g_loc as (
      select location_id as gid,
             count(*) filter (where is_visit)                                   as bookings,
             count(*) filter (where status in ('cancelled', 'canceled'))                       as cancelled,
             count(*) filter (where status = 'no_show')                         as no_shows,
             coalesce(sum(price_cents) filter (where is_visit), 0)::bigint      as revenue_cents,
             count(*) filter (where is_visit and price_cents is null)           as services_without_price,
             count(distinct contact) filter (where is_visit)                    as customers,
             count(distinct contact) filter (where is_visit and is_returning)   as returning_customers
        from b group by location_id
    )
    select jsonb_build_object(
      'ok', true,
      'revenue_basis', 'list_price',
      'period', jsonb_build_object(
        'from', v_from, 'to', v_to,
        'requested_from', p_from, 'requested_to', p_to,
        'capped_400_days', v_capped, 'tz', v_tz, 'preset', p_preset,
        'live_since', public.tenant_live_desde(v_email)),
      'totals', (select jsonb_build_object(
        'bookings', t.bookings, 'cancelled', t.cancelled, 'no_shows', t.no_shows,
        'revenue_cents', t.revenue_cents, 'revenue_basis', 'list_price',
        'services_without_price', t.services_without_price,
        'customers', t.customers, 'returning_customers', t.returning_customers) from tot t),
      'by_professional', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', g.gid, 'name', p.name, 'title', p.title,
                 'bookings', g.bookings, 'cancelled', g.cancelled, 'no_shows', g.no_shows,
                 'revenue_cents', g.revenue_cents, 'revenue_basis', 'list_price',
                 'services_without_price', g.services_without_price,
                 'customers', g.customers, 'returning_customers', g.returning_customers)
               order by g.revenue_cents desc, g.bookings desc, p.name nulls last)
          from g_pro g
          left join public.biz_professionals p on p.id = g.gid and p.client_email = v_email
      ), '[]'::jsonb),
      'by_service', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', g.gid, 'name', s.name, 'price_cents', s.price_cents,
                 'bookings', g.bookings, 'cancelled', g.cancelled, 'no_shows', g.no_shows,
                 'revenue_cents', g.revenue_cents, 'revenue_basis', 'list_price',
                 'services_without_price', g.services_without_price,
                 'customers', g.customers, 'returning_customers', g.returning_customers)
               order by g.revenue_cents desc, g.bookings desc, s.name nulls last)
          from g_svc g
          left join public.biz_services s on s.id = g.gid and s.client_email = v_email
      ), '[]'::jsonb),
      'by_location', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', g.gid, 'name', l.name, 'city', l.city,
                 'bookings', g.bookings, 'cancelled', g.cancelled, 'no_shows', g.no_shows,
                 'revenue_cents', g.revenue_cents, 'revenue_basis', 'list_price',
                 'services_without_price', g.services_without_price,
                 'customers', g.customers, 'returning_customers', g.returning_customers)
               order by g.revenue_cents desc, g.bookings desc, l.name nulls last)
          from g_loc g
          left join public.biz_locations l on l.id = g.gid and l.client_email = v_email
      ), '[]'::jsonb)
    ) into v_out;
  exception when undefined_table or undefined_function or undefined_column then
    -- motor de agenda / live_desde ainda não aplicados neste banco: diz isso, não devolve zero.
    return jsonb_build_object('ok', false, 'error', 'not_ready', 'detail', sqlerrm);
  end;

  return v_out;
end $fn$;

-- só o servidor (service_role) executa; o navegador nunca chama esta função direto
revoke all on function public.biz_productivity(text, text, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.biz_productivity(text, text, timestamptz, timestamptz, text) to service_role;

notify pgrst, 'reload schema';

-- PROVA (rodar depois de aplicar, trocando o e-mail):
--   select public.biz_productivity('glo_ing_c7f2a9e4b8d16350', 'e2e-test@guileoai.com',
--                                  now() - interval '30 days', now());
--   → { ok:true, period:{…}, totals:{…}, by_professional:[…], by_service:[…], by_location:[…] }
--   select public.biz_productivity('errado', 'e2e-test@guileoai.com', now() - interval '30 days', now());
--   → ERROR: unauthorized
