-- ============================================================================
-- Guileo · CRÉDITO NA MÃO DO DONO — admin_grant_credits  (cole no Supabase → Run)
-- Projeto ynihodbknhjirkdogxby (smart@guileoai.com). Idempotente, pode colar 2×.
-- ----------------------------------------------------------------------------
-- POR QUE EXISTE: o Painel de Comando acusa "N cliente(s) com crédito negativo —
-- cobrar ou recarregar" e não oferecia NENHUM botão. Recarregar era SQL na mão, no
-- editor do Supabase, sem rastro de quem fez nem por quê. Acusação sem ação treina
-- o dono a ignorar a linha inteira.
--
-- CONTRATO (igual aos vizinhos: db/cx_settings.sql, db/credit_idempotency.sql):
--   • SECURITY DEFINER, search_path=public, portão por LITERAL do INGEST
--     ('glo_ing_c7f2a9e4b8d16350') — o endpoint /api/admin-comando confere a senha
--     do /admin ANTES (_admin_ok) e só então usa o segredo do servidor.
--   • IDEMPOTENTE por request-id opcional: o mesmo id nunca credita duas vezes
--     (clique duplo / retry de rede não vira dinheiro dobrado). Sem id, credita.
--   • RASTRO: grava client_events type='ops_alert' "crédito ajustado: +N (motivo)".
--     NÃO grava type='payment' — isso entraria na receita_30d do painel e inventaria
--     faturamento que não existe. Ajuste de crédito não é venda.
--   • MOTIVO OBRIGATÓRIO: crédito sem motivo é dinheiro sem história.
-- ============================================================================

-- ── 1) Registro de idempotência dos ajustes (também é o log de auditoria) ────
create table if not exists public.admin_credit_grants (
  request_id   text primary key,
  client_email text not null,
  amount       int  not null,
  reason       text not null default '',
  saldo_depois int,
  created_at   timestamptz not null default now()
);
alter table public.admin_credit_grants enable row level security;  -- sem policy anon: só a RPC toca

-- ── 2) A RPC ────────────────────────────────────────────────────────────────
-- p_amount pode ser NEGATIVO (estorno de crédito dado por engano) — o motivo continua
-- obrigatório. Devolve o saldo NOVO: "ok" sem comprovante é promessa sem lastro.
create or replace function public.admin_grant_credits(
  p_secret     text,
  p_email      text,
  p_amount     int,
  p_reason     text,
  p_request_id text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_reason text := trim(coalesce(p_reason, ''));
  v_req    text := nullif(trim(coalesce(p_request_id, '')), '');
  v_ins    int;
  v_saldo  int;
  v_ja     admin_credit_grants%rowtype;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'client_email obrigatorio' using errcode = '22023';
  end if;
  if coalesce(p_amount, 0) = 0 then
    raise exception 'amount tem que ser diferente de zero' using errcode = '22023';
  end if;
  if v_reason = '' then
    raise exception 'motivo obrigatorio' using errcode = '22023';
  end if;

  -- PORTÃO DE IDEMPOTÊNCIA ANTES DO DINHEIRO. Com request-id, a 2ª chamada devolve o
  -- MESMO resultado da 1ª (e diz `repetido`), nunca credita de novo.
  if v_req is not null then
    insert into admin_credit_grants (request_id, client_email, amount, reason)
    values (v_req, v_email, p_amount, left(v_reason, 200))
    on conflict (request_id) do nothing;
    get diagnostics v_ins = row_count;
    if v_ins = 0 then
      select * into v_ja from admin_credit_grants where request_id = v_req;
      return jsonb_build_object('ok', true, 'repetido', true, 'email', v_ja.client_email,
                                'amount', v_ja.amount, 'saldo', v_ja.saldo_depois, 'reason', v_ja.reason);
    end if;
  end if;

  -- O ajuste em si: UPDATE atômico (nunca read-then-write).
  -- ⚠️ UPDATE, NÃO UPSERT, DE PROPÓSITO: um e-mail digitado errado criaria uma carteira nova, e
  -- essa linha fantasma entraria em `clientes_reais` — o painel ganharia um cliente inventado
  -- exatamente ao lado do botão (é a lição da métrica honesta). Sem carteira, a resposta é "esse
  -- cliente não existe", não um cliente novo.
  update client_credits
     set credits = credits + p_amount, updated_at = now()
   where client_email = v_email
  returning credits into v_saldo;

  if v_saldo is null then
    -- Devolve o request-id ao pool: a tentativa não moveu dinheiro, então não pode "queimar" o id.
    if v_req is not null then delete from admin_credit_grants where request_id = v_req; end if;
    raise exception 'sem carteira para %  — confira o e-mail (o cliente precisa existir)', v_email using errcode = '22023';
  end if;

  if v_req is not null then
    update admin_credit_grants set saldo_depois = v_saldo where request_id = v_req;
  end if;

  -- Rastro no feed do cliente. Best-effort: falha de auditoria não desfaz o crédito,
  -- mas também não some — o retorno diz se o evento entrou.
  begin
    insert into client_events (client_email, type, channel, summary, amount, payload)
    values (v_email, 'ops_alert', 'system',
            left(format('crédito ajustado: %s%s (%s)', case when p_amount > 0 then '+' else '' end, p_amount, v_reason), 300),
            0,
            jsonb_build_object('kind', 'admin_credit_grant', 'amount', p_amount,
                               'reason', v_reason, 'saldo', v_saldo, 'request_id', coalesce(v_req, '')));
  exception when others then
    return jsonb_build_object('ok', true, 'email', v_email, 'amount', p_amount,
                              'saldo', v_saldo, 'auditoria', false, 'nota', SQLERRM);
  end;

  return jsonb_build_object('ok', true, 'email', v_email, 'amount', p_amount,
                            'saldo', v_saldo, 'auditoria', true);
end $$;

grant execute on function public.admin_grant_credits(text, text, int, text, text) to anon;

-- ✅ Pronto. O botão "➕ Créditos" do /admin (Painel de Comando) passa a funcionar,
--    com motivo obrigatório, saldo novo na tela e rastro no feed do cliente.
