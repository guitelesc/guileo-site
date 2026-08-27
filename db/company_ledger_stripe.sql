-- ============================================================================
-- Guileo · RECEITA REAL NO RAZÃO DA COMPANHIA  (cole no Supabase → Run)
-- Projeto ynihodbknhjirkdogxby (smart@guileoai.com). Idempotente, pode colar 2×.
-- ----------------------------------------------------------------------------
-- POR QUE EXISTE: o razão da própria Guileo (company_ledger) é 100% digitado à mão.
-- Despesa a gente lembra de lançar; receita, não — então o cartão "Receita" mostrava
-- um número menor que a verdade, ao lado de despesas completas. Razão com um lado
-- completo e o outro pela metade é pior que razão vazia: parece prejuízo.
--
-- O QUE FAZ: dá ao company_ledger uma CHAVE EXTERNA (`ext_ref`) e um `add` idempotente
-- por essa chave, para o /admin espelhar as invoices PAGAS do Stripe como `revenue`
-- sem nunca duplicar — rodar a sincronização 10× lança uma vez só.
--
-- ⚠️ NÃO TOCA NO stripe-webhook (outro fluxo, outro dono). O espelho é PUXADO da API
--    do Stripe pelo /api/company-finance quando o dono clica — o webhook segue igual.
-- ⚠️ NÃO grava client_events type='payment': isso entra na receita_30d do Painel de
--    Comando e a mesma venda apareceria duas vezes na mesma página.
--
-- CONTRATO: SECURITY DEFINER, search_path=public, portão por LITERAL do INGEST
-- (o mesmo dos company_ledger_* já aplicados), grant execute to anon.
-- ============================================================================

-- ── 1) A chave externa + a trava de duplicidade ──────────────────────────────
alter table public.company_ledger add column if not exists ext_ref text;
-- UNIQUE parcial: só as linhas COM ext_ref participam da trava; os lançamentos
-- manuais (ext_ref null) continuam livres para repetir (dois cafés no mesmo dia são
-- dois cafés). Índice único parcial é o que faz o ON CONFLICT abaixo funcionar.
create unique index if not exists company_ledger_ext_ref_uniq
  on public.company_ledger (ext_ref) where ext_ref is not null;

-- ── 2) O add idempotente ────────────────────────────────────────────────────
-- Devolve o id do lançamento e se ele é NOVO — "ok" sem dizer o que criou não prova
-- nada. `criado=false` significa "essa invoice já estava no razão", que é sucesso.
create or replace function public.company_ledger_add_ext(
  p_secret      text,
  p_ext_ref     text,
  p_department  text,
  p_kind        text,
  p_category    text,
  p_vendor      text,
  p_description text,
  p_amount_cents bigint,
  p_entry_date  date default null,
  p_notes       text default ''
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_ref text := nullif(trim(coalesce(p_ext_ref, '')), '');
        v_id uuid;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_ref is null then
    raise exception 'ext_ref obrigatorio (sem ele nao ha idempotencia)' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_description, '')), '') is null then
    raise exception 'description required' using errcode = '22023';
  end if;

  insert into company_ledger (entry_date, department, kind, category, vendor, description,
                              amount_cents, recurring, notes, ext_ref)
  values (coalesce(p_entry_date, current_date),
          coalesce(nullif(trim(p_department), ''), 'finance'),
          coalesce(nullif(trim(p_kind), ''), 'revenue'),
          coalesce(nullif(trim(p_category), ''), 'assinatura'),
          coalesce(p_vendor, ''), left(trim(p_description), 240),
          coalesce(p_amount_cents, 0), '', coalesce(p_notes, ''), v_ref)
  on conflict (ext_ref) where ext_ref is not null do nothing
  returning id into v_id;

  if v_id is not null then
    return jsonb_build_object('ok', true, 'criado', true, 'id', v_id, 'ext_ref', v_ref);
  end if;
  select id into v_id from company_ledger where ext_ref = v_ref limit 1;
  return jsonb_build_object('ok', true, 'criado', false, 'id', v_id, 'ext_ref', v_ref);
end $$;

grant execute on function public.company_ledger_add_ext(text, text, text, text, text, text, text, bigint, date, text) to anon;

-- ✅ Pronto. O botão "🔄 Sincronizar receita Stripe" do /admin pode rodar quantas
--    vezes quiser: cada invoice paga entra no razão UMA vez, pela chave in_xxx.
