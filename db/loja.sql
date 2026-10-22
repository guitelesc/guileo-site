-- LOJA DA VITRINE — estorno devolve ao estoque (2026-10-04)
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- Colar no Supabase (SQL editor) DEPOIS de db/produtos.sql. Idempotente: pode colar de novo.
--
-- POR QUE EXISTE: a venda da loja online nasce PAGA (stripe-webhook.js, ramo guileo:"loja", via
-- product_sale_record com status 'paid'). product_sale_set_status só fecha venda 'reserved' — de
-- propósito, para o balcão nunca devolver estoque duas vezes. Então um ESTORNO da loja não tinha
-- como voltar a peça para a prateleira: o estoque ficava a menos para sempre.
--
-- A REGRA
--   • só toca venda da LOJA (source = 'loja'), PAGA, DESTE tenant, cujo ref começa com o prefixo
--     do pagamento ("pi_...:" — o webhook grava ref = "<payment_intent>:<produto>");
--   • paid → cancelled uma única vez (a segunda chamada acha zero linhas: nada volta duas vezes);
--   • devolve a quantidade ao estoque só quando o estoque é controlado e o produto ainda existe;
--   • prefixo vazio ou fora do formato NÃO cancela nada (nunca "todas as vendas do salão").
-- Comparação por left(ref, n) = prefixo, e não LIKE: "pi_" tem "_", que no LIKE é coringa.

create or replace function public.product_sale_refund_loja(p_secret text, p_email text, p_ref_prefix text)
returns jsonb
language plpgsql security definer set search_path to public as $$
declare
  v_tenant  text := lower(trim(coalesce(p_email,'')));
  v_prefix  text := coalesce(p_ref_prefix,'');
  v_sale    public.biz_product_sales%rowtype;
  v_n       integer := 0;
  v_volta   integer := 0;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_prefix !~ '^(pi|cs|ch)_[A-Za-z0-9_]{6,120}:$' then return jsonb_build_object('ok', false, 'reason', 'bad_prefix'); end if;
  if v_tenant = '' then return jsonb_build_object('ok', false, 'reason', 'bad_tenant'); end if;

  for v_sale in
    select * from public.biz_product_sales
     where client_email = v_tenant and source = 'loja' and status = 'paid'
       and left(ref, length(v_prefix)) = v_prefix
     for update
  loop
    update public.biz_product_sales set status = 'cancelled' where id = v_sale.id and client_email = v_tenant;
    v_n := v_n + 1;
    if v_sale.product_id is not null then
      update public.biz_products set stock = stock + v_sale.qty, updated_at = now()
       where id = v_sale.product_id and client_email = v_tenant and stock is not null;
      if found then v_volta := v_volta + v_sale.qty; end if;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'cancelled', v_n, 'restocked_units', v_volta);
end $$;

revoke all on function public.product_sale_refund_loja(text,text,text) from public, anon, authenticated;
grant execute on function public.product_sale_refund_loja(text,text,text) to service_role;
notify pgrst, 'reload schema';

-- PROVA (no tenant de teste — NUNCA na conta de um cliente):
--   select public.product_upsert('glo_ing_c7f2a9e4b8d16350','e2e-test@guileoai.com','{"name":"Creme loja","price_cents":2000,"stock":5}'::jsonb);  -- guarde o id
--   select public.product_sale_record('glo_ing_c7f2a9e4b8d16350','e2e-test@guileoai.com','<id>'::uuid, 2, 'pi_TESTE123:<id>', 'Teste', null, 'paid', 'loja');  -- stock 3
--   select public.product_sale_refund_loja('glo_ing_c7f2a9e4b8d16350','e2e-test@guileoai.com','pi_TESTE123:');  -- cancelled 1, restocked 2 → stock 5
--   select public.product_sale_refund_loja('glo_ing_c7f2a9e4b8d16350','e2e-test@guileoai.com','pi_TESTE123:');  -- cancelled 0 (não devolve duas vezes)
--   select public.product_sale_refund_loja('glo_ing_c7f2a9e4b8d16350','e2e-test@guileoai.com','');             -- bad_prefix
--   delete from public.biz_product_sales where client_email='e2e-test@guileoai.com' and ref like 'pi_TESTE123:%';
