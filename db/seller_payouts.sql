-- ============================================================================
-- GUILEO · REPASSES (PAYOUTS) DE COMISSÃO — cole TUDO no SQL Editor e RUN.
-- Projeto ynihodbknhjirkdogxby · conta smart@guileoai.com. Idempotente.
--
-- Fecha o ciclo do dinheiro do vendedor de ponta a ponta:
--   seller_commission_ledger (db/seller_finance.sql) = quanto ELE JÁ GANHOU
--   (comissão refund-net, em USD).  Este arquivo registra quanto JÁ FOI PAGO
--   a ele (repasses) e calcula o SALDO DEVIDO = ganho − pago.
--
--   • seller_payout_record  → o admin lança um repasse (IDEMPOTENTE — ver abaixo)
--   • seller_payouts_list   → histórico de repasses de UM vendedor
--   • seller_balance        → {commission_cents, paid_out_cents, due_cents}
--
-- ⚠️ DINHEIRO: repasse duplo é PERDA REAL. A idempotência é uma UNIQUE
--   (seller_email, dedupe_key) + `on conflict do nothing`: reenviar o MESMO
--   repasse (mesmo vendedor + mesma dedupe_key) NÃO cria uma 2ª linha — devolve
--   a existente com duplicate:true. A chave NUNCA deriva de timestamp (o retry
--   do cliente/rede repetiria com timestamp novo e pagaria de novo); deriva do
--   CORPO (vendedor+período+valor por default, ou uma chave explícita do admin).
--
--   commission_cents = comissão do ledger (em USD) × 100, arredondado — a lógica
--   refund-net NÃO é reimplementada: chamamos seller_commission_ledger por dentro.
--
-- SEGURANÇA: mesmo padrão dos irmãos — SECURITY DEFINER gated pelo literal INGEST
-- ('glo_ing_c7f2a9e4b8d16350' = env INGEST_SECRET), RLS on SEM policy anon, grant
-- execute to anon (as RPCs são o ÚNICO acesso). O escopo é SEMPRE por
-- seller_email — nunca devolve repasse de outro vendedor. Requer db/seller_finance.sql.
-- ============================================================================

-- ── TABELA de repasses ───────────────────────────────────────────────────────
create table if not exists public.seller_payouts (
  id           uuid primary key default gen_random_uuid(),
  seller_email text not null,
  amount_cents integer not null check (amount_cents > 0),   -- valor pago, em centavos USD (> 0)
  note         text,
  period       text,
  dedupe_key   text not null,                               -- chave de idempotência (deriva do corpo)
  created_at   timestamptz not null default now(),
  created_by   text not null default 'admin'
);
-- RECONCILE se a tabela já existir com shape antigo (create table if not exists NÃO reconcilia colunas)
alter table public.seller_payouts add column if not exists note       text;
alter table public.seller_payouts add column if not exists period     text;
alter table public.seller_payouts add column if not exists dedupe_key text;
alter table public.seller_payouts add column if not exists created_by text not null default 'admin';

-- idempotência: um (vendedor, dedupe_key) = no MÁXIMO uma linha. É a barreira anti-repasse-duplo.
create unique index if not exists uq_seller_payouts_dedupe on public.seller_payouts(seller_email, dedupe_key);
-- listagem rápida por vendedor, mais recente primeiro
create index if not exists idx_seller_payouts_seller on public.seller_payouts(seller_email, created_at desc);

-- RLS ligado, SEM policies: só as RPCs SECURITY DEFINER abaixo tocam a tabela.
alter table public.seller_payouts enable row level security;

-- ── RECORD: lança um repasse. IDEMPOTENTE por (seller_email, dedupe_key). ──────
--    p_amount_cents inteiro > 0 (validado). Se p_dedupe_key vier vazio, deriva do
--    CORPO (vendedor+período+valor) — nunca de timestamp. Reenvio do MESMO repasse
--    devolve {duplicate:true} com a linha original, SEM criar 2ª (sem perda de $).
--    Escrita de dinheiro: erros NÃO são engolidos (sobem como não-200). ──────────
create or replace function public.seller_payout_record(
  p_secret text, p_seller_email text, p_amount_cents integer,
  p_note text default '', p_period text default '', p_dedupe_key text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email text    := lower(trim(coalesce(p_seller_email, '')));
  v_amt   integer := coalesce(p_amount_cents, 0);
  v_key   text    := nullif(trim(coalesce(p_dedupe_key, '')), '');
  v_row   public.seller_payouts%rowtype;
  v_dup   boolean := false;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_email = '' or position('@' in v_email) = 0 then raise exception 'bad email' using errcode = '22023'; end if;
  if v_amt <= 0 then raise exception 'amount_cents must be a positive integer' using errcode = '22023'; end if;

  -- dedupe_key deriva do CORPO quando não é passada (jamais de timestamp): mesmo
  -- vendedor + mesmo período + mesmo valor = MESMO repasse = bloqueado como duplicado.
  if v_key is null then
    v_key := 'auto:' || md5(v_email || ':' || coalesce(trim(p_period), '') || ':' || v_amt::text);
  end if;

  insert into seller_payouts (seller_email, amount_cents, note, period, dedupe_key, created_by)
  values (v_email, v_amt, nullif(trim(coalesce(p_note, '')), ''),
          nullif(trim(coalesce(p_period, '')), ''), v_key, 'admin')
  on conflict (seller_email, dedupe_key) do nothing
  returning * into v_row;

  -- conflito (repasse já existe) → não inseriu; devolve a linha ORIGINAL, duplicate:true
  if not found then
    v_dup := true;
    select * into v_row from seller_payouts where seller_email = v_email and dedupe_key = v_key limit 1;
  end if;

  return jsonb_build_object(
    'ok', true, 'duplicate', v_dup,
    'payout', jsonb_build_object(
      'id', v_row.id, 'seller_email', v_row.seller_email, 'amount_cents', v_row.amount_cents,
      'note', v_row.note, 'period', v_row.period, 'created_at', v_row.created_at, 'created_by', v_row.created_by
    )
  );
end $$;
-- NOTA: sem bloco EXCEPTION catch-all de propósito — numa ESCRITA de dinheiro, uma
-- falha real precisa subir (não-200), nunca virar um {ok:true} silencioso e mentiroso.

-- ── LIST: histórico de repasses de UM vendedor (escopo por seller_email). ──────
create or replace function public.seller_payouts_list(p_secret text, p_seller_email text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_seller_email, '')));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'amount_cents', amount_cents, 'note', note,
      'period', period, 'created_at', created_at, 'created_by', created_by
    ) order by created_at desc)
    from seller_payouts where seller_email = v_email
  ), '[]'::jsonb);
exception
  when sqlstate '28000' then raise;      -- gate errado tem que ser barulhento
  when others then return '[]'::jsonb;   -- degrada: lista vazia, nunca 500
end $$;

-- ── BALANCE: saldo devido. REUSA seller_commission_ledger (mesma lógica refund-net,
--    NÃO reimplementa) para o ganho, subtrai a soma dos repasses. Em centavos. ───
create or replace function public.seller_balance(p_secret text, p_seller_email text, p_ref text default '')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email      text   := lower(trim(coalesce(p_seller_email, '')));
  v_ledger     jsonb;
  v_comm_cents bigint := 0;
  v_paid_cents bigint := 0;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_email = '' or position('@' in v_email) = 0 then
    return jsonb_build_object('commission_cents', 0, 'paid_out_cents', 0, 'due_cents', 0);
  end if;

  -- ganho = comissão refund-net do MESMO ledger (única fonte da verdade de comissão);
  -- vem em USD (dólares) → centavos = × 100 arredondado.
  v_ledger := public.seller_commission_ledger(p_secret, v_email, coalesce(p_ref, ''));
  v_comm_cents := round(coalesce((v_ledger -> 'totals' ->> 'commission')::numeric, 0) * 100)::bigint;

  select coalesce(sum(amount_cents), 0) into v_paid_cents
    from seller_payouts where seller_email = v_email;

  return jsonb_build_object(
    'commission_cents', v_comm_cents,
    'paid_out_cents',   v_paid_cents,
    'due_cents',        v_comm_cents - v_paid_cents
  );
exception
  when sqlstate '28000' then raise;
  when others then return jsonb_build_object('commission_cents', 0, 'paid_out_cents', 0, 'due_cents', 0);
end $$;

-- ── GRANTS (anon chama via PostgREST; o gate INGEST é a segurança real) ────────
grant execute on function public.seller_payout_record(text, text, integer, text, text, text) to anon;
grant execute on function public.seller_payouts_list(text, text)                              to anon;
grant execute on function public.seller_balance(text, text, text)                             to anon;

-- ✅ Done. O admin lança repasses (idempotentes) e o /vendedor vê saldo devido +
--    histórico honesto na seção "💸 Repasses" da aba Financeiro.
