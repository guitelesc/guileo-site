-- GUILEO DESK v6 — VENDA ONLINE DE PACOTE E VALE-PRESENTE no Stripe DO NEGÓCIO (2026-10-05)
-- Aplicado como desk_v6_3_venda_online + desk_v6_3_venda_online_falha_final. Só ACRESCENTA; nenhuma função existente muda. Idempotente.
--
-- POR QUÊ: o link de venda de pacote / vale-presente (/api/packages buy, /api/giftcards buy) saía na
-- plataforma Stripe da Guileo, que é BR e não repassa para negócio dos EUA. Com a chave restrita do
-- próprio negócio (stripe_own_save), a sessão nasce na conta DELE — e o webhook da plataforma não fica
-- sabendo. Quem entrega o que foi pago é a volta da cliente (/api/venda-paga) e a conferência de hora
-- em hora (/api/venda-online-reconcile), as duas lendo a SESSÃO no Stripe com a chave do negócio.
--
-- O QUE ENTREGA: as MESMAS funções que o webhook da plataforma chama (stripe-webhook.js, ramo
-- "RECURRING-REVENUE FULFILL") — package_purchase_record / giftcard_create / revenue_record. Aqui elas
-- rodam DENTRO de venda_online_fulfill_svc, numa transação só, com trava por sessão: a volta e a
-- conferência podem ver a mesma sessão ao mesmo tempo e o pacote / vale nasce UMA vez.
-- Os segredos (INGEST_SECRET / SCHED_SECRET) vêm do servidor como parâmetro e são repassados às funções
-- antigas — nenhum segredo fica escrito aqui.
--
-- PORTA: TODAS as funções daqui são só service_role. Nada é alcançável pelo navegador. Nunca credita
-- créditos da Guileo nem provisiona nada para quem pagou: só grava no negócio (client_email = p_tenant).

create table if not exists public.venda_online_sessions (
  session_id text primary key,
  client_email text not null,
  kind text not null check (kind in ('package', 'giftcard')),
  item_id uuid,                                   -- pacote (packages.id); nulo no vale-presente
  cents int,                                      -- valor pedido na criação (a entrega usa o valor PAGO)
  recipient_contact text,
  purchaser_contact text,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  result jsonb
);
create index if not exists venda_online_sessions_pend on public.venda_online_sessions (created_at) where done_at is null;
alter table public.venda_online_sessions enable row level security;
revoke all on table public.venda_online_sessions from anon, authenticated;

-- Registro na criação do link (para a conferência de hora em hora achar quem fechou a aba).
create or replace function public.venda_online_session_add_svc(p_tenant text, p_session text, p_kind text, p_item_id uuid, p_cents int, p_recipient text, p_purchaser text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := lower(trim(p_tenant));
begin
  if coalesce(p_session, '') !~ '^cs_(live|test)_[A-Za-z0-9]{10,200}$' or p_kind not in ('package', 'giftcard') or e !~ '@' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if p_kind = 'package' and not exists (select 1 from packages p where p.id = p_item_id and p.client_email = e) then
    return jsonb_build_object('ok', false, 'reason', 'package_not_found');
  end if;
  insert into venda_online_sessions (session_id, client_email, kind, item_id, cents, recipient_contact, purchaser_contact)
  values (p_session, e, p_kind, case when p_kind = 'package' then p_item_id end, p_cents, left(nullif(trim(coalesce(p_recipient, '')), ''), 160), left(nullif(trim(coalesce(p_purchaser, '')), ''), 160))
  on conflict (session_id) do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- ENTREGA — uma vez por sessão. Chamada SÓ depois que o Stripe do negócio disse payment_status = paid.
--   já entregue          → { ok, already:true, result }   (nada é criado de novo)
--   sessão de outro dono → { ok:false, reason:'sessao_de_outro' }
--   pacote de outro dono → { ok:false, reason:'package_not_found' }
create or replace function public.venda_online_fulfill_svc(
  p_secret text, p_sched_secret text, p_tenant text, p_session text, p_kind text, p_item_id uuid,
  p_cents int, p_buyer text, p_recipient text, p_purchaser text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  e text := lower(trim(p_tenant)); r venda_online_sessions%rowtype; v_res jsonb; v_pp uuid; v_sessions int; v_name text;
  v_card jsonb; v_amt int := greatest(coalesce(p_cents, 0), 0);
begin
  if coalesce(p_session, '') !~ '^cs_(live|test)_[A-Za-z0-9]{10,200}$' or p_kind not in ('package', 'giftcard') or e !~ '@' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  perform pg_advisory_xact_lock(hashtext('venda_online:' || p_session));
  select * into r from venda_online_sessions where session_id = p_session;
  if found then
    if r.client_email <> e or r.kind <> p_kind then return jsonb_build_object('ok', false, 'reason', 'sessao_de_outro'); end if;
    if r.done_at is not null then
      -- falha FINAL já registrada (ex.: pacote apagado antes da entrega) — não tenta de novo, não finge
      if r.result ? 'error' then return jsonb_build_object('ok', false, 'already', true, 'reason', r.result->>'error'); end if;
      return jsonb_build_object('ok', true, 'already', true, 'kind', r.kind, 'result', r.result);
    end if;
  else
    -- link criado sem registro (registro falhou na hora): a sessão lida no Stripe do negócio prova a venda
    insert into venda_online_sessions (session_id, client_email, kind, item_id, cents, recipient_contact, purchaser_contact)
    values (p_session, e, p_kind, case when p_kind = 'package' then p_item_id end, v_amt,
            left(nullif(trim(coalesce(p_recipient, '')), ''), 160), left(nullif(trim(coalesce(p_purchaser, '')), ''), 160));
  end if;

  if p_kind = 'package' then
    -- o pacote é do NEGÓCIO e o número de sessões sai do CADASTRO (nunca do metadado)
    select p.sessions, p.name into v_sessions, v_name from packages p where p.id = p_item_id and p.client_email = e;
    if not found then
      -- falha final: fecha a sessão (a conferência não repete o alarme a cada hora); o JS avisa o dono uma vez
      update venda_online_sessions set done_at = now(), result = jsonb_build_object('error', 'package_not_found') where session_id = p_session;
      return jsonb_build_object('ok', false, 'reason', 'package_not_found');
    end if;
    v_pp := public.package_purchase_record(p_secret, e, p_item_id, coalesce(p_buyer, ''), coalesce(v_sessions, 0), p_session);
    v_res := jsonb_build_object('kind', 'package', 'purchase_id', v_pp, 'package_id', p_item_id, 'package', v_name, 'sessions', coalesce(v_sessions, 0), 'cents', v_amt);
  else
    -- vale-presente ancorado no valor PAGO (igual ao webhook: cupom encolhe o vale, não cria valor cheio)
    if v_amt <= 0 then return jsonb_build_object('ok', false, 'reason', 'amount_missing'); end if;
    v_card := public.giftcard_create(p_secret, e, jsonb_build_object('amount_cents', v_amt,
                'recipient_contact', coalesce(p_recipient, ''), 'purchaser_contact', coalesce(nullif(p_purchaser, ''), p_buyer, '')));
    v_res := jsonb_build_object('kind', 'giftcard', 'gift_card_id', v_card->>'id', 'code', v_card->>'code', 'cents', v_amt);
  end if;

  -- receita do negócio (mesmo lançamento do webhook; secret errado = só não lança, não desfaz a entrega)
  if v_amt > 0 then
    v_res := v_res || jsonb_build_object('revenue', public.revenue_record(p_sched_secret, e, p_kind, v_amt::bigint, p_session, 'stripe-own-link', jsonb_build_object('payer', coalesce(p_buyer, ''))));
  end if;

  update venda_online_sessions set done_at = now(), result = v_res where session_id = p_session;
  return jsonb_build_object('ok', true, 'already', false, 'kind', p_kind, 'result', v_res);
end $$;

-- Pendentes dos últimos 3 dias, só de negócio que AINDA tem a chave própria.
create or replace function public.venda_online_pending_svc()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('tenant', s.client_email, 'session', s.session_id, 'kind', s.kind) order by s.created_at), '[]'::jsonb)
    from venda_online_sessions s
   where s.done_at is null and s.created_at > now() - interval '3 days'
     and exists (select 1 from client_integrations i where i.client_email = s.client_email and i.provider = 'stripe_own')
$$;

-- ═══ PORTA: só service_role ════════════════════════════════════════════════════════════════════
do $g$
declare f text;
begin
  foreach f in array array[
    'venda_online_session_add_svc(text,text,text,uuid,integer,text,text)',
    'venda_online_fulfill_svc(text,text,text,text,text,uuid,integer,text,text,text)',
    'venda_online_pending_svc()'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $g$;
