-- GUILEO DESK v7 — LOJA DA VITRINE no Stripe DO NEGÓCIO (2026-10-05)
-- Aplicado como desk_v7_1_loja_online. Só ACRESCENTA: nenhuma função existente muda. Idempotente.
--
-- POR QUÊ: a sacola da vitrine (functions/api/loja-checkout.js) abria o Checkout na plataforma Stripe da
-- Guileo, que é BR e não repassa para negócio dos EUA. Com a chave restrita do próprio negócio
-- (stripe_own_save), o Checkout nasce na conta DELE — e o webhook da plataforma (ramo guileo:"loja")
-- não fica sabendo. Quem registra o pedido pago é a volta da cliente (/api/venda-paga?loja=<slug>) e a
-- conferência de hora em hora (/api/venda-online-reconcile), as duas lendo a SESSÃO no Stripe com a
-- chave do negócio (lib/vendaOnlineNegocio.js · conferirVendaOnline → ramo "loja").
--
-- POR QUE A MESMA TABELA (venda_online_sessions) e não uma irmã:
--   · a conferência de hora em hora JÁ lê venda_online_pending_svc e já roda no cron — uma linha
--     kind='loja' entra no mesmo laço, sem cron novo e sem segunda lista de pendentes;
--   · a trava por sessão é a MESMA chave (pg_advisory_xact_lock('venda_online:' || sessão)): volta e
--     conferência vendo a mesma sessão ao mesmo tempo entram em fila, e o pedido é registrado UMA vez;
--   · a sessão é única no Stripe do negócio — um id não pode ser pacote numa tabela e loja na outra.
-- O que muda na tabela: o check de `kind` passa a aceitar 'loja' (só alarga) e entra a coluna `itens`
-- (o "id:qtd,..." pedido na criação, só para auditoria — a entrega lê os itens da SESSÃO paga).
--
-- O QUE REGISTRA: exatamente o que o webhook da plataforma registra no ramo "loja" (stripe-webhook.js):
--   · product_sale_record por item, ref "<payment_intent>:<produto>" (o mesmo refDaVenda de lib/loja.js),
--     status 'paid', source 'loja' — baixa o estoque e o estorno da loja acha pelo prefixo;
--   · revenue_record categoria 'loja' com o valor PAGO (source 'stripe-own-link', igual à venda online
--     de pacote/vale — distingue no relatório o dinheiro que entrou direto na conta do negócio).
-- O feed do dono (ingest_client_event) e o aviso ao salão (lib/lojaAviso.js) saem do JS, UMA vez, só
-- quando esta função responde already:false.
-- Item que falha (esgotou entre a sacola e o pagamento, produto apagado) NÃO desfaz os outros: cada
-- item roda num bloco próprio; o resultado diz qual falhou e o JS acorda alguém (loja_pago_sem_registro).
-- A sessão fecha mesmo com item falho — falha de item é final (o JS alarma uma vez, não de hora em hora).
-- Queda de rede / banco fora = nada é gravado (transação inteira) e a próxima conferência tenta de novo.
--
-- PORTA: só service_role. Os segredos (INGEST / SCHED) vêm do servidor como parâmetro.

alter table public.venda_online_sessions drop constraint if exists venda_online_sessions_kind_check,
  add constraint venda_online_sessions_kind_check check (kind in ('package', 'giftcard', 'loja'));
alter table public.venda_online_sessions add column if not exists itens text;

-- Registro na criação do Checkout (para a conferência de hora em hora achar quem fechou a aba).
create or replace function public.loja_online_session_add_svc(p_tenant text, p_session text, p_cents int, p_itens text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := lower(trim(p_tenant));
begin
  if coalesce(p_session, '') !~ '^cs_(live|test)_[A-Za-z0-9]{10,200}$' or e !~ '@' then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  insert into venda_online_sessions (session_id, client_email, kind, cents, itens)
  values (p_session, e, 'loja', p_cents, left(nullif(trim(coalesce(p_itens, '')), ''), 600))
  on conflict (session_id) do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- ENTREGA — uma vez por sessão. Chamada SÓ depois que o Stripe do negócio disse payment_status = paid.
--   p_ref_base = payment_intent da sessão (ou o id da sessão, se não veio) — o ref de cada venda é
--                "<p_ref_base>:<produto>", o mesmo formato do webhook.
--   p_itens    = [{ "id": uuid, "qtd": int }] lidos do metadado da SESSÃO paga.
--   já registrada        → { ok, already:true, result }
--   sessão de outro dono → { ok:false, reason:'sessao_de_outro' }
create or replace function public.loja_online_fulfill_svc(
  p_secret text, p_sched_secret text, p_tenant text, p_session text, p_ref_base text, p_itens jsonb,
  p_cents int, p_customer_name text, p_customer_contact text, p_entrega text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  e text := lower(trim(p_tenant)); r venda_online_sessions%rowtype; v_amt int := greatest(coalesce(p_cents, 0), 0);
  it jsonb; v_id uuid; v_qtd int; v_sale jsonb; v_lista jsonb := '[]'::jsonb; v_rev jsonb := null; v_prob int := 0; v_res jsonb;
begin
  if coalesce(p_session, '') !~ '^cs_(live|test)_[A-Za-z0-9]{10,200}$' or e !~ '@'
     or coalesce(p_ref_base, '') !~ '^(pi|cs)_[A-Za-z0-9_]{6,200}$' or jsonb_typeof(coalesce(p_itens, 'null'::jsonb)) <> 'array'
     or jsonb_array_length(p_itens) > 12 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  perform pg_advisory_xact_lock(hashtext('venda_online:' || p_session));
  select * into r from venda_online_sessions where session_id = p_session;
  if found then
    if r.client_email <> e or r.kind <> 'loja' then return jsonb_build_object('ok', false, 'reason', 'sessao_de_outro'); end if;
    if r.done_at is not null then return jsonb_build_object('ok', true, 'already', true, 'kind', 'loja', 'result', r.result); end if;
  else
    -- Checkout criado sem registro (o registro falhou na hora): a sessão lida no Stripe do negócio prova a venda
    insert into venda_online_sessions (session_id, client_email, kind, cents) values (p_session, e, 'loja', v_amt);
  end if;

  if jsonb_array_length(p_itens) = 0 then v_prob := v_prob + 1; end if;
  for it in select * from jsonb_array_elements(p_itens) loop
    begin
      v_id := (it->>'id')::uuid;
      v_qtd := (it->>'qtd')::int;
      v_sale := public.product_sale_record(p_secret, e, v_id, v_qtd, p_ref_base || ':' || v_id::text,
                  nullif(left(trim(coalesce(p_customer_name, '')), 120), ''), nullif(left(trim(coalesce(p_customer_contact, '')), 160), ''), 'paid', 'loja');
    exception when others then
      -- bloco próprio: um item que explode (estoque, segredo, id torto) não desfaz os outros
      v_sale := jsonb_build_object('ok', false, 'reason', 'erro', 'detalhe', left(sqlerrm, 160));
    end;
    if coalesce((v_sale->>'ok')::boolean, false) is not true then v_prob := v_prob + 1; end if;
    v_lista := v_lista || jsonb_build_array(jsonb_build_object('id', it->>'id', 'qtd', it->'qtd', 'ok', coalesce((v_sale->>'ok')::boolean, false),
      'reason', v_sale->>'reason', 'detalhe', v_sale->>'detalhe', 'name', v_sale->>'name', 'sale_id', v_sale->>'sale_id', 'duplicate', coalesce((v_sale->>'duplicate')::boolean, false)));
  end loop;

  -- receita do negócio (mesmo lançamento do webhook; segredo errado = só não lança, não desfaz o pedido)
  if v_amt > 0 then
    begin
      v_rev := public.revenue_record(p_sched_secret, e, 'loja', v_amt::bigint, p_session, 'stripe-own-link',
                 jsonb_build_object('payer', coalesce(p_customer_contact, ''), 'entrega', coalesce(p_entrega, '')));
    exception when others then v_rev := jsonb_build_object('error', left(sqlerrm, 160));
    end;
    if v_rev ? 'error' then v_prob := v_prob + 1; end if;
  end if;

  v_res := jsonb_build_object('kind', 'loja', 'itens', v_lista, 'revenue', v_rev, 'problemas', v_prob, 'cents', v_amt, 'entrega', coalesce(p_entrega, ''));
  update venda_online_sessions set done_at = now(), result = v_res where session_id = p_session;
  return jsonb_build_object('ok', true, 'already', false, 'kind', 'loja', 'result', v_res);
end $$;

-- ═══ PORTA: só service_role ════════════════════════════════════════════════════════════════════
do $g$
declare f text;
begin
  foreach f in array array[
    'loja_online_session_add_svc(text,text,integer,text)',
    'loja_online_fulfill_svc(text,text,text,text,text,jsonb,integer,text,text,text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $g$;

notify pgrst, 'reload schema';
