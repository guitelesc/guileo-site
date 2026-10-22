-- GUILEO DESK v7.6 — ESTORNO feito no Stripe PRÓPRIO do negócio (2026-10-05)
-- Aplicado como desk_v7_6_estorno_proprio. Só ACRESCENTA (colunas novas, tabela nova, funções novas);
-- nenhuma função existente muda. Idempotente.
--
-- POR QUÊ: a conta Stripe PRÓPRIA do negócio não manda webhook para nós. Um estorno feito no painel do
-- Stripe dele num pedido da LOJA (kind 'loja'), num PACOTE ou num VALE-PRESENTE vendido online nunca
-- chegava: o estoque não voltava e o pacote / vale ficava com saldo. A conferência de hora em hora
-- (/api/venda-online-reconcile → lib/vendaOnlineNegocio.js · conferirEstornos) agora também pergunta ao
-- Stripe do negócio, para as vendas ENTREGUES nos últimos 30 dias, se a cobrança foi estornada.
--
-- O QUE ACONTECE (venda_online_refund_mark_svc, uma vez por sessão, trava 'venda_online:' || sessão):
--   · estorno TOTAL de pedido da loja → a MESMA product_sale_refund_loja do webhook (db/loja.sql), pelo
--     prefixo "<payment_intent>:" (o ref de cada venda, lib/loja.js · refDaVenda). Devolve as peças.
--   · estorno TOTAL de pacote / vale → NADA é anulado aqui, de propósito: o pacote pode já ter sessões
--     usadas e o vale pode já ter sido gasto. O JS escreve UMA linha no feed do dono ("estornado no
--     Stripe — conferir o pacote/vale no Balcão").
--   · estorno PARCIAL → não diz quais peças/sessões voltaram: marca 'parcial' uma vez (o JS avisa uma
--     vez) e continua olhando — se virar total, é tratado como total.
--   · tratado = refund_handled_at preenchido → nunca repete.
-- O "uma vez" é do banco: o JS só escreve no feed quando esta função responde acao 'total_novo' ou
-- 'parcial_novo'.
--
-- AVISO DE PERMISSÃO (venda_online_refund_aviso_svc): a chave restrita do negócio pode não ter
-- "Charges: Read" — sem ela não dá para ver estorno. Isso vira UM aviso por negócio (não um por hora);
-- quando a leitura volta a funcionar, a marca some e um novo problema avisa de novo.
--
-- PORTA: só service_role. O segredo (INGEST_SECRET) vem do servidor como parâmetro.

alter table public.venda_online_sessions add column if not exists payment_intent text;
alter table public.venda_online_sessions add column if not exists refund_checked_at timestamptz;
alter table public.venda_online_sessions add column if not exists refund_state text;
alter table public.venda_online_sessions add column if not exists refund_handled_at timestamptz;
alter table public.venda_online_sessions add column if not exists refund_result jsonb;
alter table public.venda_online_sessions drop constraint if exists venda_online_sessions_refund_state_check,
  add constraint venda_online_sessions_refund_state_check check (refund_state is null or refund_state in ('parcial', 'total'));
create index if not exists venda_online_sessions_estorno on public.venda_online_sessions (refund_checked_at nulls first, done_at desc)
  where done_at is not null and refund_handled_at is null;

create table if not exists public.venda_online_refund_avisos (
  client_email text not null,
  motivo       text not null,
  created_at   timestamptz not null default now(),
  primary key (client_email, motivo)
);
alter table public.venda_online_refund_avisos enable row level security;
revoke all on table public.venda_online_refund_avisos from anon, authenticated;

-- Vendas ENTREGUES nos últimos 30 dias, ainda sem estorno tratado, de negócio que AINDA tem a chave
-- própria. A menos conferida primeiro (lote limitado; o cron de hora em hora vai rodando a lista).
create or replace function public.venda_online_refund_candidates_svc(p_limit int default 40)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(x order by x.ord), '[]'::jsonb) from (
    select row_number() over (order by s.refund_checked_at nulls first, s.done_at desc) as ord,
           s.client_email as tenant, s.session_id as session, s.kind, s.payment_intent, s.refund_state,
           coalesce((s.result->>'cents')::int, s.cents) as cents, s.result->>'code' as code,
           s.result->>'package' as package, s.done_at
      from venda_online_sessions s
     where s.done_at is not null and s.refund_handled_at is null
       and s.done_at > now() - interval '30 days'
       and not (coalesce(s.result, '{}'::jsonb) ? 'error')
       and exists (select 1 from client_integrations i where i.client_email = s.client_email and i.provider = 'stripe_own')
     order by s.refund_checked_at nulls first, s.done_at desc
     limit least(greatest(coalesce(p_limit, 40), 1), 100)
  ) x
$$;

-- Resultado de UMA conferência. p_estado: 'nada' | 'parcial' | 'total'.
--   → { ok, acao:'nada' | 'parcial_novo' | 'parcial_ja' | 'total_novo' | 'ja_tratado', kind, estoque? }
--   → { ok:false, reason } (nada marcado como tratado: a próxima conferência tenta de novo)
create or replace function public.venda_online_refund_mark_svc(
  p_secret text, p_tenant text, p_session text, p_payment_intent text, p_estado text, p_refunded_cents int, p_total_cents int)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  e text := lower(trim(coalesce(p_tenant, ''))); r venda_online_sessions%rowtype;
  v_pi text := nullif(trim(coalesce(p_payment_intent, '')), ''); v_est jsonb := null; v_res jsonb;
begin
  if coalesce(p_session, '') !~ '^cs_(live|test)_[A-Za-z0-9]{10,200}$' or e !~ '@' or coalesce(p_estado, '') not in ('nada', 'parcial', 'total')
     or (v_pi is not null and v_pi !~ '^pi_[A-Za-z0-9_]{6,200}$') then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  perform pg_advisory_xact_lock(hashtext('venda_online:' || p_session));
  select * into r from venda_online_sessions where session_id = p_session;
  if not found or r.client_email <> e then return jsonb_build_object('ok', false, 'reason', 'sessao_de_outro'); end if;
  if r.done_at is null then return jsonb_build_object('ok', false, 'reason', 'nao_entregue'); end if;
  if r.refund_handled_at is not null then return jsonb_build_object('ok', true, 'acao', 'ja_tratado', 'kind', r.kind); end if;

  update venda_online_sessions set refund_checked_at = now(), payment_intent = coalesce(v_pi, payment_intent) where session_id = p_session;

  if p_estado = 'nada' then return jsonb_build_object('ok', true, 'acao', 'nada', 'kind', r.kind); end if;

  if p_estado = 'parcial' then
    if r.refund_state = 'parcial' then return jsonb_build_object('ok', true, 'acao', 'parcial_ja', 'kind', r.kind); end if;
    update venda_online_sessions set refund_state = 'parcial',
      refund_result = jsonb_build_object('refunded_cents', p_refunded_cents, 'total_cents', p_total_cents, 'em', now())
     where session_id = p_session;
    return jsonb_build_object('ok', true, 'acao', 'parcial_novo', 'kind', r.kind);
  end if;

  -- TOTAL
  if r.kind = 'loja' then
    -- mesmo prefixo que a entrega gravou: "<payment_intent>:" (ou "<sessão>:" quando a sessão veio sem pi)
    begin
      v_est := public.product_sale_refund_loja(p_secret, e, coalesce(v_pi, r.payment_intent, p_session) || ':');
    exception when others then
      return jsonb_build_object('ok', false, 'reason', 'estorno_loja_falhou', 'detalhe', left(sqlerrm, 160));
    end;
    if coalesce((v_est->>'ok')::boolean, false) is not true then
      return jsonb_build_object('ok', false, 'reason', 'estorno_loja_falhou', 'detalhe', v_est->>'reason');
    end if;
  end if;
  v_res := jsonb_build_object('refunded_cents', p_refunded_cents, 'total_cents', p_total_cents, 'em', now(), 'estoque', v_est);
  update venda_online_sessions set refund_state = 'total', refund_handled_at = now(), refund_result = v_res where session_id = p_session;
  return jsonb_build_object('ok', true, 'acao', 'total_novo', 'kind', r.kind, 'estoque', v_est);
end $$;

-- Aviso de permissão, uma vez por negócio. p_ativo=true → { novo:true } só na primeira vez;
-- p_ativo=false → a leitura voltou: apaga a marca (um problema futuro avisa de novo).
create or replace function public.venda_online_refund_aviso_svc(p_tenant text, p_motivo text, p_ativo boolean)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := lower(trim(coalesce(p_tenant, ''))); m text := left(coalesce(p_motivo, ''), 60); n int;
begin
  if e !~ '@' or m = '' then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  if p_ativo then
    insert into venda_online_refund_avisos (client_email, motivo) values (e, m) on conflict do nothing;
    get diagnostics n = row_count;
    return jsonb_build_object('ok', true, 'novo', n > 0);
  end if;
  delete from venda_online_refund_avisos where client_email = e and motivo = m;
  return jsonb_build_object('ok', true, 'novo', false);
end $$;

-- ═══ PORTA: só service_role ════════════════════════════════════════════════════════════════════
do $g$
declare f text;
begin
  foreach f in array array[
    'venda_online_refund_candidates_svc(integer)',
    'venda_online_refund_mark_svc(text,text,text,text,text,integer,integer)',
    'venda_online_refund_aviso_svc(text,text,boolean)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $g$;

notify pgrst, 'reload schema';
