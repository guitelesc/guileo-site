-- ============================================================================
-- GUILEO · FINANCEIRO DO VENDEDOR — cole TUDO no SQL Editor e RUN.
-- Projeto ynihodbknhjirkdogxby · conta smart@guileoai.com. Idempotente.
--
-- Alimenta a aba "💰 Financeiro" do /vendedor (via /api/seller-finance):
--   seller_commission_ledger → o EXTRATO honesto de comissão do vendedor.
--   Para cada cliente atribuído a ele soma os pagamentos REAIS (client_events
--   type='payment', amount) e aplica a comissão = paid × pct/100, onde pct vem
--   de sellers.commission_pct (default 10). O nome do negócio vem da carteira
--   (onboard_drafts, assigned_seller). Devolve totais + linhas por cliente.
--
-- ATRIBUIÇÃO — a MESMA lógica já provada em seller_conversions/seller_metrics:
--   • path 1: leads que carregaram 👤ref:<slug> (gui_actions, Growth Partner);
--   • path 2: checkouts que carregaram seller_ref (client_events 'attribution');
--   • path 3: a carteira permanente (onboard_drafts.assigned_seller = vendedor),
--     para clientes assinados que pagaram mesmo sem lead/attribution registrado.
--   Um cliente que pagou por QUALQUER um dos caminhos entra no extrato uma vez.
--
-- SEGURANÇA: mesmo padrão dos outros — SECURITY DEFINER gated pelo literal INGEST
-- ('glo_ing_c7f2a9e4b8d16350' = env INGEST_SECRET), RLS já ligada nas tabelas base,
-- grant execute to anon (as RPCs são o ÚNICO acesso). READ-only. NUNCA devolve
-- personal_code nem email de OUTRO vendedor — só o extrato do vendedor escopado.
-- Degrada em silêncio (bloco EXCEPTION) — nunca um 500 pro hub.
-- Requer db/onboard_completo.sql + db/seller_wallet.sql + db/seller_roster.sql.
-- ============================================================================

-- ── seller_commission_ledger — extrato de comissão do PRÓPRIO vendedor.
--    p_seller_email = email do vendedor AUTENTICADO (escopo da carteira/pct);
--    p_ref = slug de atribuição (?ref=); se vazio, resolve do sellers.ref_slug.
--    O endpoint SEMPRE passa o vendedor autenticado — o email do body nunca é
--    usado como escopo. Espelha a atribuição de seller_conversions.sql. ────────
-- o ledger consulta a trilha de transferências (corte de posse). Cria defensivamente
-- se db/seller_transfer.sql ainda não foi colado (mesmo schema, idempotente).
create table if not exists public.seller_wallet_transfers (
  id           uuid primary key default gen_random_uuid(),
  client_email text not null,
  from_seller  text,
  to_seller    text not null,
  reason       text not null,
  created_at   timestamptz not null default now()
);
alter table public.seller_wallet_transfers enable row level security;

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

-- ── GRANT (anon chama via PostgREST; o gate INGEST é a segurança real) ───────
grant execute on function public.seller_commission_ledger(text, text, text) to anon;

-- ✅ Done. A aba "💰 Financeiro" do /vendedor mostra o extrato real de comissão
--    (totais + linha por cliente) do vendedor autenticado, sem vazar nada de outros.
