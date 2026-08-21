-- ============================================================================
-- GUILEO · PAINEL + RANKING DO VENDEDOR — cole TUDO no SQL Editor e RUN.
-- Projeto ynihodbknhjirkdogxby · conta smart@guileoai.com. Idempotente.
--
-- Alimenta a aba "📊 Painel" do /vendedor (via /api/seller-dashboard):
--   • seller_dashboard  → KPIs do próprio vendedor (clientes/leads/convertidos/$).
--   • seller_leaderboard→ ranking ANONIMIZADO entre vendedores (privacidade: só
--     primeiro nome/ref, clientes e $ pago — NUNCA email nem personal_code).
--
-- SEGURANÇA: mesmo padrão dos outros — SECURITY DEFINER gated pelo literal INGEST
-- ('glo_ing_c7f2a9e4b8d16350' = env INGEST_SECRET), RLS já ligada nas tabelas base,
-- grant execute to anon (as RPCs são o ÚNICO acesso). READ-only.
-- Requer db/onboard_completo.sql (onboard_drafts) + db/seller_wallet.sql
-- (assigned_seller) + db/seller_roster.sql (sellers.ref_slug/commission_pct).
-- Degrada em silêncio (bloco EXCEPTION) — nunca um 500 pro hub.
-- ============================================================================

-- ── seller_dashboard — KPIs do PRÓPRIO vendedor. p_ref é o slug de atribuição
--    (?ref=); se vazio, cai pro sellers.ref_slug do email. Espelha a mesma lógica
--    de leads/conversões do seller_conversions.sql, só que agregada num jsonb. ──
create or replace function public.seller_dashboard(
  p_secret text, p_seller_email text, p_ref text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email     text    := lower(trim(coalesce(p_seller_email, '')));
  v_ref       text    := nullif(trim(coalesce(p_ref, '')), '');
  v_total     int     := 0;
  v_live      int     := 0;
  v_draft     int     := 0;
  v_leads     int     := 0;
  v_converted int     := 0;
  v_paid      numeric := 0;
  v_conv_mo   int     := 0;
  v_pct       numeric := 10;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_email = '' or position('@' in v_email) = 0 then
    return jsonb_build_object('clients', jsonb_build_object('total', 0, 'live', 0, 'draft', 0),
      'leads_30d', 0, 'converted', 0, 'paid', 0, 'commission_pct', 10, 'ref', '');
  end if;

  -- ref slug + commission come from the roster; the passed ref is a fallback (localStorage)
  select coalesce(nullif(ref_slug, ''), v_ref), coalesce(commission_pct, 10)
    into v_ref, v_pct
  from sellers where email = v_email limit 1;
  -- SELECT INTO with no matching seller row nulls the targets → restore sane fallbacks
  if v_ref is null then v_ref := nullif(trim(coalesce(p_ref, '')), ''); end if;
  v_pct := coalesce(v_pct, 10);

  -- clients from the PERMANENT wallet (assigned_seller binding, fallback seller_email)
  select count(*),
         count(*) filter (where status = 'live'),
         count(*) filter (where status <> 'live')
    into v_total, v_live, v_draft
  from onboard_drafts
  where status <> 'deleted'
    and coalesce(assigned_seller, seller_email) = v_email;

  -- leads in the last 30 days attributed to this seller's ?ref= (gui_actions '👤ref:<slug>')
  -- + all-time conversions/paid (same join as seller_conversions.sql)
  if v_ref is not null and v_ref <> '' then
    select count(distinct lower(trim(g.contact)))
      into v_leads
    from gui_actions g
    where g.action = 'lead'
      and g.contact like '%@%'
      and substring(g.details from '👤ref:([^\s·]+)') = v_ref
      and g.created_at >= now() - interval '30 days';

    with leads as (
      -- path 1: lead forms carrying 👤ref:<slug> (Growth Partner links)
      select distinct lower(trim(g.contact)) as email
      from gui_actions g
      where g.action = 'lead' and g.contact like '%@%'
        and substring(g.details from '👤ref:([^\s·]+)') = v_ref
      union
      -- path 2: checkouts carrying seller_ref (attribution client_event)
      select distinct lower(trim(e2.client_email)) as email
      from client_events e2
      where e2.type = 'attribution' and e2.payload->>'seller_ref' = v_ref
    ),
    pays as (
      select e.client_email, sum(coalesce(e.amount, 0)) as paid
      from client_events e
      join leads l on lower(trim(e.client_email)) = l.email
      where e.type = 'payment'
      group by e.client_email
    )
    select count(*), coalesce(sum(paid), 0) into v_converted, v_paid from pays;

    -- month-scoped conversions — feeds the "Meta do mês" bar honestly (resets monthly)
    with leads as (
      select distinct lower(trim(g.contact)) as email
      from gui_actions g
      where g.action = 'lead' and g.contact like '%@%'
        and substring(g.details from '👤ref:([^\s·]+)') = v_ref
      union
      select distinct lower(trim(e2.client_email)) as email
      from client_events e2
      where e2.type = 'attribution' and e2.payload->>'seller_ref' = v_ref
    )
    select count(distinct e.client_email) into v_conv_mo
    from client_events e
    join leads l on lower(trim(e.client_email)) = l.email
    where e.type = 'payment'
      and date_trunc('month', e.created_at) = date_trunc('month', now());
  end if;

  return jsonb_build_object(
    'clients', jsonb_build_object('total', v_total, 'live', v_live, 'draft', v_draft),
    'leads_30d', v_leads,
    'converted', v_converted,
    'converted_month', v_conv_mo,
    'paid', v_paid,
    'commission_pct', v_pct,
    'ref', coalesce(v_ref, '')
  );
exception
  when sqlstate '28000' then raise;      -- never swallow the gate (bad secret must be loud)
  when others then return jsonb_build_object('clients', jsonb_build_object('total', 0, 'live', 0, 'draft', 0),
    'leads_30d', 0, 'converted', 0, 'paid', 0, 'commission_pct', 10, 'ref', '');
end $$;

-- ── seller_leaderboard — ranking ENTRE vendedores, ANONIMIZADO. Devolve só o
--    primeiro nome (ou ref), clientes e $ pago, ordenado por pago desc. Inclui
--    ref (slug) apenas pro /api/seller-dashboard marcar "sou eu" e removê-lo
--    ANTES de responder — o browser nunca vê email/code de outro vendedor. ─────
create or replace function public.seller_leaderboard(p_secret text)
returns json
language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select json_agg(row_to_json(x) order by x.paid desc, x.clients desc, x.name asc)
    from (
      select
        coalesce(nullif(split_part(coalesce(s.name, ''), ' ', 1), ''), s.ref_slug, 'Vendedor') as name,
        s.ref_slug as ref,
        (select count(*) from onboard_drafts d
           where d.status <> 'deleted'
             and coalesce(d.assigned_seller, d.seller_email) = s.email) as clients,
        coalesce((
          with leads as (
            select distinct lower(trim(g.contact)) as email
            from gui_actions g
            where g.action = 'lead' and g.contact like '%@%'
              and substring(g.details from '👤ref:([^\s·]+)') = s.ref_slug
            union
            select distinct lower(trim(e2.client_email)) as email
            from client_events e2
            where e2.type = 'attribution' and e2.payload->>'seller_ref' = s.ref_slug
          )
          select sum(coalesce(e.amount, 0))
          from client_events e
          join leads l on lower(trim(e.client_email)) = l.email
          where e.type = 'payment'
        ), 0) as paid
      from sellers s
      where s.active and coalesce(s.ref_slug, '') <> ''
    ) x
  ), '[]'::json);
exception
  when sqlstate '28000' then raise;
  when others then return '[]'::json;   -- degrade: empty board, never a 500
end $$;

-- ── GRANTS (anon chama via PostgREST; o gate INGEST é a segurança real) ──────
grant execute on function public.seller_dashboard(text, text, text) to anon;
grant execute on function public.seller_leaderboard(text)           to anon;

-- ✅ Done. A aba "📊 Painel" do /vendedor mostra KPIs reais + o ranking do time.
