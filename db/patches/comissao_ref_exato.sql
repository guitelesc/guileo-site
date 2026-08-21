-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- COMISSÃO: o LIKE de prefixo pagava o vendedor errado — correção (2026-08-19)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- O DEFEITO:   and g.details like ('%👤ref:' || p_ref || '%')
-- `details` é uma string concatenada com ' · ', então o LIKE casa por PREFIXO:
--     o ref 'ana'  casa dentro de '👤ref:anabela'
--     o ref 'luis' casa dentro de '👤ref:luisa'
-- A vendedora de slug mais curto recebe os leads E A COMISSÃO da de slug mais longo, e as duas
-- contam o MESMO pagamento. `ref_slug` ser UNIQUE não protege: dois slugs únicos podem ser
-- prefixo um do outro.
--
-- A CORREÇÃO usa o padrão que JÁ EXISTE no repositório (db/lifecycle.sql:80):
--     substring(g.details from '👤ref:([^\s·]+)') = p_ref
-- O slug não contém espaço nem ' · ', então o grupo capturado é o ref inteiro e só ele.
--
-- ESCOPO: só as 4 funções que de fato usam o predicado. Nenhuma outra é tocada — redefinir
-- função de dinheiro sem necessidade é como se quebra produção.
-- É `create or replace`, idempotente, e NÃO altera dado nenhum: só a forma de LER.
--
-- ⚠️ RODE A SONDA DO FIM PRIMEIRO. Ela diz se isto está sangrando agora ou se é latente.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

-- de db/seller_conversions.sql
create or replace function public.seller_conversions(p_secret text, p_ref text)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if coalesce(trim(p_ref), '') = '' then return json_build_object('converted', 0, 'paid', 0); end if;
  return (
    with leads as (
      -- path 1: lead forms that carried 👤ref:<ref> (Growth Partner links)
      select distinct lower(trim(g.contact)) as email
      from gui_actions g
      where g.action = 'lead'
        and g.contact like '%@%'
        and substring(g.details from '👤ref:([^\s·]+)') = trim(p_ref)
      union
      -- path 2: checkouts that carried client_reference_id=<ref> — the seller's
      -- payment-link hand-off writes an 'attribution' client_event on the new tenant
      select distinct lower(trim(e2.client_email)) as email
      from client_events e2
      where e2.type = 'attribution'
        and e2.payload->>'seller_ref' = trim(p_ref)
    ),
    pays as (
      select e.client_email, sum(coalesce(e.amount, 0)) as paid
      from client_events e
      join leads l on lower(trim(e.client_email)) = l.email
      where e.type = 'payment'
      group by e.client_email
    )
    select json_build_object(
      'converted', (select count(*) from pays),
      'paid', coalesce((select sum(paid) from pays), 0)
    )
  );
end
$$;

-- de db/seller_finance.sql
create or replace function public.seller_commission_ledger(
  p_secret text, p_seller_email text, p_ref text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email  text    := lower(trim(coalesce(p_seller_email, '')));
  v_ref    text    := nullif(trim(coalesce(p_ref, '')), '');
  v_pct    numeric := 10;
  v_ledger jsonb   := '[]'::jsonb;
  v_paid   numeric := 0;
  v_comm   numeric := 0;
  v_count  int     := 0;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_email = '' or position('@' in v_email) = 0 then
    return jsonb_build_object('pct', 10,
      'totals', jsonb_build_object('paid', 0, 'commission', 0, 'clients', 0),
      'ledger', '[]'::jsonb);
  end if;

  -- ref slug + commission come from the roster; the passed ref is a fallback (localStorage)
  select coalesce(nullif(ref_slug, ''), v_ref), coalesce(commission_pct, 10)
    into v_ref, v_pct
  from sellers where email = v_email limit 1;
  -- SELECT INTO with no matching seller row nulls the targets → restore sane fallbacks
  if v_ref is null then v_ref := nullif(trim(coalesce(p_ref, '')), ''); end if;
  v_pct := coalesce(v_pct, 10);

  -- Build the per-client ledger: every client attributed to this seller (3 paths),
  -- their summed REAL payments, commission = paid × pct/100, business from the wallet,
  -- and the first payment timestamp. Only clients that actually paid (paid > 0) show.
  with ref_attributed as (
    -- paths 1+2: atribuição por REF (link/checkout) — pontual no evento, NÃO muda com
    -- transferência de carteira (o ref usado na venda é do vendedor que vendeu).
    select distinct lower(trim(g.contact)) as email
    from gui_actions g
    where g.action = 'lead' and g.contact like '%@%'
      and v_ref is not null and v_ref <> ''
      and substring(g.details from '👤ref:([^\s·]+)') = v_ref
    union
    select distinct lower(trim(e2.client_email)) as email
    from client_events e2
    where e2.type = 'attribution'
      and v_ref is not null and v_ref <> ''
      and e2.payload->>'seller_ref' = v_ref
  ),
  wallet_now as (
    -- path 3: carteira permanente — clientes atualmente assinados a este vendedor
    select distinct lower(trim(coalesce(d.client_email, ''))) as email
    from onboard_drafts d
    where d.status <> 'deleted'
      and coalesce(d.assigned_seller, d.seller_email) = v_email
      and coalesce(d.client_email, '') like '%@%'
  ),
  xfer as (
    select lower(trim(client_email)) as email,
           lower(trim(coalesce(from_seller,''))) as from_s,
           lower(trim(to_seller)) as to_s,
           created_at
    from seller_wallet_transfers
  ),
  -- CORTE POR TRANSFERÊNCIA: comissão de carteira vale para o dono VIGENTE NA DATA
  -- do pagamento. Transferir um cliente NUNCA reescreve comissão passada: o vendedor
  -- antigo mantém o que ganhou até a troca; o novo só ganha dali em diante.
  own_intervals as (
    -- posse ATUAL: do último transfer PARA este vendedor (ou desde sempre) até hoje
    select w.email,
           coalesce((select max(x.created_at) from xfer x
                      where x.email = w.email and x.to_s = v_email), '-infinity'::timestamptz) as t0,
           'infinity'::timestamptz as t1
      from wallet_now w
    union all
    -- posses PASSADAS: cada transfer SAINDO deste vendedor fecha um intervalo que
    -- começou no transfer anterior PARA ele (ou desde sempre)
    select x.email,
           coalesce((select max(x2.created_at) from xfer x2
                      where x2.email = x.email and x2.to_s = v_email
                        and x2.created_at < x.created_at), '-infinity'::timestamptz) as t0,
           x.created_at as t1
      from xfer x
     where x.from_s = v_email
  ),
  pays as (
    -- refund = evento separado negativo; soma payment+refund = líquido comissionável.
    -- distinct por e.id: cliente presente em ref E carteira nunca conta o evento 2×.
    -- (Edge documentado: refund APÓS a troca cai no intervalo do dono novo e some no
    -- HAVING dele — o dono antigo mantém a comissão do pagamento original.)
    select u.email,
           sum(u.amount)                                        as paid,
           min(u.created_at) filter (where u.type = 'payment')  as first_paid_at
    from (
      select distinct e.id, lower(trim(e.client_email)) as email,
             coalesce(e.amount, 0) as amount, e.type, e.created_at
        from client_events e
        join ref_attributed a on lower(trim(e.client_email)) = a.email
       where e.type in ('payment', 'refund')
      union
      select distinct e.id, lower(trim(e.client_email)) as email,
             coalesce(e.amount, 0) as amount, e.type, e.created_at
        from client_events e
        join own_intervals oi on lower(trim(e.client_email)) = oi.email
       where e.type in ('payment', 'refund')
         and e.created_at >= oi.t0 and e.created_at < oi.t1
    ) u
    group by u.email
    having sum(u.amount) > 0
  ),
  -- business name from the wallet; pick the most-recent draft per client email
  biz as (
    select lower(trim(client_email)) as email,
           (array_agg(business order by created_at desc))[1] as business
    from onboard_drafts
    where status <> 'deleted' and coalesce(client_email, '') like '%@%'
    group by lower(trim(client_email))
  ),
  rows as (
    select p.email as client_email,
           coalesce(b.business, '') as business,
           round(p.paid, 2) as paid,
           round(p.paid * v_pct / 100.0, 2) as commission,
           p.first_paid_at
    from pays p
    left join biz b on b.email = p.email
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'client_email', client_email,
      'business',     business,
      'paid',         paid,
      'commission',   commission,
      'first_paid_at', first_paid_at
    ) order by paid desc, first_paid_at asc), '[]'::jsonb),
    coalesce(sum(paid), 0),
    coalesce(sum(commission), 0),
    count(*)
  into v_ledger, v_paid, v_comm, v_count
  from rows;

  return jsonb_build_object(
    'pct', v_pct,
    'totals', jsonb_build_object(
      'paid',       round(v_paid, 2),
      'commission', round(v_comm, 2),
      'clients',    v_count
    ),
    'ledger', v_ledger
  );
exception
  when sqlstate '28000' then raise;      -- never swallow the gate (bad secret must be loud)
  when others then return jsonb_build_object('pct', 10,
    'totals', jsonb_build_object('paid', 0, 'commission', 0, 'clients', 0),
    'ledger', '[]'::jsonb);
end $$;

-- de db/seller_metrics.sql
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

-- de db/seller_metrics.sql
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

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- SONDA 1 — está sangrando agora? Lista pares em que um slug é PREFIXO do outro.
-- Zero linhas = o defeito existe no código mas ainda não pagou ninguém errado.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
select a.ref_slug as slug_curto, b.ref_slug as slug_longo,
       'o curto vinha recebendo lead e comissão do longo' as efeito
from seller_roster a
join seller_roster b on b.ref_slug <> a.ref_slug and b.ref_slug like a.ref_slug || '%';

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- SONDA 2 — as 4 funções existem e foram redefinidas?
-- ════════════════════════════════════════════════════════════════════════════════════════════════
select proname, (prosrc like '%👤ref:([^%') as usa_extracao_exata
from pg_proc
where proname in ('seller_conversions','seller_commission_ledger','seller_dashboard','seller_leaderboard')
order by proname;
-- as 4 têm que voltar com usa_extracao_exata = true
