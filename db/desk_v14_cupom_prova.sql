-- PROVA do desk_v14 (cupom no caixa) na conta e2e-test — TUDO DESFEITO no fim (raise exception).
-- Rodar no SQL Editor DEPOIS do desk_v14_cupom.sql. O resultado esperado é um ERRO cuja mensagem começa com
-- "PROVA (desfeita): 25/25 ok". Qualquer "FALHOU passo N" diz o que quebrou. Nada fica gravado.
-- TRAVA: a prova NÃO pode rodar na mesma aba/execução do desk_v14_cupom.sql — o erro final da prova desfaria o arquivo junto
-- (aconteceu em 2026-10-22: "24/24" na tela e nada no banco). Se a função foi criada nesta mesma transação, para aqui.
do $t$
begin
  if to_regprocedure('public._desk_cupom_aplica(text,uuid,jsonb)') is null then
    raise exception 'PROVA NÃO RODOU: o desk_v14_cupom.sql não está no banco. Rode-o SOZINHO numa aba e confira "aplicado = t"; depois rode esta prova noutra aba.';
  end if;
  if (select xmin from pg_proc where oid = to_regprocedure('public._desk_cupom_aplica(text,uuid,jsonb)')) = pg_current_xact_id()::xid then
    raise exception 'PROVA NÃO RODOU e NADA FOI APLICADO: o desk_v14_cupom.sql e esta prova estão na mesma execução. Rode o desk_v14_cupom.sql SOZINHO numa aba (tem de dar "aplicado = t") e a prova noutra aba.';
  end if;
end $t$;

do $prova$
declare e text := 'e2e-test@guileoai.com'; k text; s biz_services; p bigint; r jsonb; r2 jsonb; n int; c coupons;
        log text := ''; ok int := 0; v_sale uuid; v_one uuid; ct text := 'prova-cupom@example.com';
  -- uma venda: 1 serviço (+ vale opcional), cupom, desconto manual e um pagamento em dinheiro
begin
  select access_key into k from client_credits where client_email = e;
  select * into s from biz_services where client_email = e and price_cents >= 2000 order by price_cents limit 1;
  if k is null or s.id is null then raise exception 'FALHOU passo 0: conta e2e sem chave ou sem serviço com preço'; end if;
  p := s.price_cents;
  insert into coupons (client_email, code, kind, value, label) values
    (e, 'PROVAP20', 'pct', 20, '20% off'), (e, 'PROVAA25', 'amount', 25, '$25 off'), (e, 'PROVAA9K', 'amount', 9000, '$9000 off'),
    (e, 'PROVAB1', 'bogo', null, 'Buy 1 get 1'), (e, 'PROVAONE', 'percent', 10, 'one use');
  update coupons set max_redemptions = 1 where client_email = e and code = 'PROVAONE';
  insert into coupons (client_email, code, kind, value, label, expires_at) values (e, 'PROVAEXP', 'pct', 10, 'expired', now() - interval '1 day');
  insert into coupons (client_email, code, kind, value, label, starts_at) values (e, 'PROVAFUT', 'pct', 10, 'future', now() + interval '1 day');
  insert into coupons (client_email, code, kind, value, label, active) values (e, 'PROVAOFF', 'pct', 10, 'off', false);
  insert into coupons (client_email, code, kind, value, label) values ('outro-negocio-prova@example.com', 'PROVAOUTRO', 'pct', 50, 'de outro negócio');

  -- 1. prévia percent
  r := public.desk_coupon_check(e, k, 'PROVAP20', p);
  if not coalesce((r->>'ok' = 'true' and (r->>'discount_cents')::bigint = round(p * 0.2)), false) then raise exception 'FALHOU passo 1: %', r; end if;
  ok := ok + 1; log := log || ' 1.prévia20%=' || (r->>'discount_cents');
  -- 2. prévia sem diferenciar maiúscula e com espaço
  r := public.desk_coupon_check(e, k, '  provap20 ', p);
  if not coalesce((r->>'ok' = 'true'), false) then raise exception 'FALHOU passo 2: %', r; end if; ok := ok + 1;
  -- 3. venda com 20%: total = p − 20%
  r := public.desk_checkout(e, k, jsonb_build_object('customer_name', 'Prova Cupom', 'customer_contact', ct, 'coupon_code', 'provap20', 'request_id', 'prova-cupom-3',
        'lines', jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', s.id)),
        'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_cents', p - round(p * 0.2)))));
  if not coalesce((r->>'ok' = 'true' and (r->>'total_cents')::bigint = p - round(p * 0.2) and (r->'coupon'->>'discount_cents')::bigint = round(p * 0.2)), false) then raise exception 'FALHOU passo 3: %', r; end if;
  v_sale := (r->>'sale_id')::uuid; ok := ok + 1; log := log || ' 3.venda=' || (r->>'total_cents');
  -- 4. a venda gravou o cupom; desconto total = desconto do cupom
  if not exists (select 1 from desk_sales where id = v_sale and coupon_code = 'PROVAP20' and coupon_discount_cents = round(p * 0.2) and discount_cents = round(p * 0.2)) then
    raise exception 'FALHOU passo 4: venda sem o cupom gravado'; end if; ok := ok + 1;
  -- 5. o cupom contou 1 uso e o resgate tem a venda e o contato
  select * into c from coupons where client_email = e and code = 'PROVAP20';
  if not coalesce((c.redeemed = 1 and exists (select 1 from coupon_redemptions where coupon_id = c.id and sale_id = v_sale and contact = ct)), false) then raise exception 'FALHOU passo 5: redeemed=%', c.redeemed; end if;
  ok := ok + 1;
  -- 6. repetir o mesmo pedido não gasta o cupom de novo
  r := public.desk_checkout(e, k, jsonb_build_object('customer_contact', ct, 'coupon_code', 'PROVAP20', 'request_id', 'prova-cupom-3',
        'lines', jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', s.id)), 'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_cents', 1))));
  select redeemed into n from coupons where id = c.id;
  if not coalesce((r->>'idempotent' = 'true' and n = 1), false) then raise exception 'FALHOU passo 6: % redeemed=%', r, n; end if; ok := ok + 1;
  -- 7. venda recusada (pagamento errado) não gasta o cupom
  r := public.desk_checkout(e, k, jsonb_build_object('customer_contact', ct, 'coupon_code', 'PROVAP20', 'request_id', 'prova-cupom-7',
        'lines', jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', s.id)), 'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_cents', p))));
  select redeemed into n from coupons where id = c.id;
  if not coalesce((r->>'reason' = 'payment_mismatch' and n = 1 and not exists (select 1 from desk_sales where client_email = e and request_id = 'prova-cupom-7')), false) then raise exception 'FALHOU passo 7: % redeemed=%', r, n; end if;
  ok := ok + 1;
  -- 8. vale-presente não leva desconto: serviço + vale 50,00 com $25 off → desconto = min(2500, p) (limitado à base), vale pago inteiro
  r := public.desk_checkout(e, k, jsonb_build_object('customer_contact', ct, 'coupon_code', 'PROVAA25', 'request_id', 'prova-cupom-8',
        'lines', jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', s.id), jsonb_build_object('kind', 'giftcard', 'unit_cents', 5000)),
        'payments', jsonb_build_array(jsonb_build_object('method', 'card', 'amount_cents', p + 5000 - least(2500, p)))));
  if not coalesce((r->>'ok' = 'true' and (r->'coupon'->>'discount_cents')::bigint = least(2500, p)), false) then raise exception 'FALHOU passo 8: %', r; end if;
  ok := ok + 1; log := log || ' 8.vale+25off=' || (r->>'total_cents');
  -- 9. valor maior que a base fica limitado à base: $9000 off com vale → desconto = p, o vale (5000) é pago inteiro
  r := public.desk_coupon_check(e, k, 'PROVAA9K', p);
  if not coalesce(((r->>'discount_cents')::bigint = p), false) then raise exception 'FALHOU passo 9 (prévia): %', r; end if;
  r := public.desk_checkout(e, k, jsonb_build_object('customer_contact', ct, 'coupon_code', 'PROVAA9K', 'request_id', 'prova-cupom-9',
        'lines', jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', s.id), jsonb_build_object('kind', 'giftcard', 'unit_cents', 5000)),
        'payments', jsonb_build_array(jsonb_build_object('method', 'card', 'amount_cents', 5000))));
  if not coalesce((r->>'ok' = 'true' and (r->>'total_cents')::bigint = 5000), false) then raise exception 'FALHOU passo 9: %', r; end if; ok := ok + 1;
  -- 10. só vale-presente + cupom % → recusa (não tem em que descontar)
  r := public.desk_checkout(e, k, jsonb_build_object('customer_contact', ct, 'coupon_code', 'PROVAP20', 'request_id', 'prova-cupom-10',
        'lines', jsonb_build_array(jsonb_build_object('kind', 'giftcard', 'unit_cents', 5000)), 'payments', jsonb_build_array(jsonb_build_object('method', 'card', 'amount_cents', 5000))));
  if not coalesce((r->>'reason' = 'coupon_no_base'), false) then raise exception 'FALHOU passo 10: %', r; end if; ok := ok + 1;
  r := public.desk_coupon_check(e, k, 'PROVAP20', 0);
  if not coalesce((r->>'reason' = 'coupon_no_base'), false) then raise exception 'FALHOU passo 10b: %', r; end if; ok := ok + 1;
  -- 11. bogo sem desconto digitado → recusa; com o desconto digitado → conta o cupom com aquele valor
  r := public.desk_checkout(e, k, jsonb_build_object('customer_contact', ct, 'coupon_code', 'PROVAB1', 'request_id', 'prova-cupom-11a',
        'lines', jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', s.id)), 'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_cents', p))));
  if not coalesce((r->>'reason' = 'coupon_needs_amount'), false) then raise exception 'FALHOU passo 11a: %', r; end if; ok := ok + 1;
  r := public.desk_coupon_check(e, k, 'PROVAB1', p);
  if not coalesce((r->>'ok' = 'true' and r->'discount_cents' = 'null'::jsonb and r->>'automatic' = 'false'), false) then raise exception 'FALHOU passo 11b: %', r; end if; ok := ok + 1;
  r := public.desk_checkout(e, k, jsonb_build_object('customer_contact', ct, 'coupon_code', 'PROVAB1', 'discount_cents', 1000, 'request_id', 'prova-cupom-11c',
        'lines', jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', s.id)), 'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_cents', p - 1000))));
  if not coalesce((r->>'ok' = 'true' and (r->'coupon'->>'discount_cents')::bigint = 1000
          and exists (select 1 from desk_sales where id = (r->>'sale_id')::uuid and discount_cents = 1000 and coupon_discount_cents = 1000)), false) then raise exception 'FALHOU passo 11c: %', r; end if;
  ok := ok + 1;
  -- 12. desconto manual soma com o do cupom; passar da base → recusa com a base no detalhe
  r := public.desk_checkout(e, k, jsonb_build_object('customer_contact', ct, 'coupon_code', 'PROVAP20', 'discount_cents', 500, 'request_id', 'prova-cupom-12a',
        'lines', jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', s.id)), 'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_cents', p - round(p * 0.2) - 500))));
  if not coalesce((r->>'ok' = 'true' and exists (select 1 from desk_sales where id = (r->>'sale_id')::uuid and discount_cents = round(p * 0.2) + 500 and coupon_discount_cents = round(p * 0.2))), false) then
    raise exception 'FALHOU passo 12a: %', r; end if; ok := ok + 1;
  r := public.desk_checkout(e, k, jsonb_build_object('customer_contact', ct, 'coupon_code', 'PROVAP20', 'discount_cents', p, 'request_id', 'prova-cupom-12b',
        'lines', jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', s.id)), 'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_cents', 0))));
  if not coalesce((r->>'reason' = 'discount_over_base' and (r->>'detail')::bigint = p), false) then raise exception 'FALHOU passo 12b: %', r; end if; ok := ok + 1;
  -- 13. vencido / ainda não começou / desligado / não existe / de outro negócio
  r := public.desk_coupon_check(e, k, 'PROVAEXP', p); if not coalesce((r->>'reason' = 'coupon_expired' and r->>'detail' ~ '^\d{4}-\d{2}-\d{2}$'), false) then raise exception 'FALHOU passo 13a: %', r; end if;
  r := public.desk_coupon_check(e, k, 'PROVAFUT', p); if not coalesce((r->>'reason' = 'coupon_not_started'), false) then raise exception 'FALHOU passo 13b: %', r; end if;
  r := public.desk_coupon_check(e, k, 'PROVAOFF', p); if not coalesce((r->>'reason' = 'coupon_inactive'), false) then raise exception 'FALHOU passo 13c: %', r; end if;
  r := public.desk_coupon_check(e, k, 'PROVANAOEXISTE', p); if not coalesce((r->>'reason' = 'coupon_not_found' and not (r ? 'coupon')), false) then raise exception 'FALHOU passo 13d: %', r; end if;
  r := public.desk_coupon_check(e, k, 'PROVAOUTRO', p); if not coalesce((r->>'reason' = 'coupon_not_found'), false) then raise exception 'FALHOU passo 13e: %', r; end if;
  r := public.desk_checkout(e, k, jsonb_build_object('customer_contact', ct, 'coupon_code', 'PROVAEXP', 'request_id', 'prova-cupom-13f',
        'lines', jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', s.id)), 'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_cents', p - round(p * 0.1)))));
  if not coalesce((r->>'reason' = 'coupon_expired' and r->>'detail' ~ '^\d{4}-\d{2}-\d{2}$' and not exists (select 1 from desk_sales where client_email = e and request_id = 'prova-cupom-13f')), false) then raise exception 'FALHOU passo 13f: %', r; end if;
  ok := ok + 1; log := log || ' 13.recusas ok';
  -- 14. limite de 1 uso: 1ª venda passa, 2ª recusa "esgotado"
  r := public.desk_checkout(e, k, jsonb_build_object('customer_contact', ct, 'coupon_code', 'PROVAONE', 'request_id', 'prova-cupom-14a',
        'lines', jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', s.id)), 'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_cents', p - round(p * 0.1)))));
  if not coalesce((r->>'ok' = 'true'), false) then raise exception 'FALHOU passo 14a: %', r; end if;
  v_one := (r->>'sale_id')::uuid; ok := ok + 1;
  r2 := public.desk_checkout(e, k, jsonb_build_object('customer_contact', ct, 'coupon_code', 'PROVAONE', 'request_id', 'prova-cupom-14b',
        'lines', jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', s.id)), 'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_cents', p - round(p * 0.1)))));
  if not coalesce((r2->>'reason' = 'coupon_exhausted' and r2->>'detail' = '1'), false) then raise exception 'FALHOU passo 14b: %', r2; end if; ok := ok + 1;
  -- 15. estorno devolve o uso (redeemed 1 → 0, resgate apagado) e o cupom volta a passar
  r := public.desk_void_sale(e, k, v_one, 'prova');
  select * into c from coupons where client_email = e and code = 'PROVAONE';
  if not coalesce((r->>'ok' = 'true' and c.redeemed = 0 and not exists (select 1 from coupon_redemptions where sale_id = v_one)), false) then raise exception 'FALHOU passo 15: % redeemed=%', r, c.redeemed; end if;
  ok := ok + 1;
  r := public.desk_coupon_check(e, k, 'PROVAONE', p); if not coalesce((r->>'ok' = 'true'), false) then raise exception 'FALHOU passo 15b: %', r; end if; ok := ok + 1;
  -- 16. venda SEM cupom continua como antes (desconto manual livre, nenhum campo de cupom)
  r := public.desk_checkout(e, k, jsonb_build_object('customer_contact', ct, 'discount_cents', 300, 'request_id', 'prova-cupom-16',
        'lines', jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', s.id)), 'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_cents', p - 300))));
  if not coalesce((r->>'ok' = 'true' and not (r ? 'coupon') and exists (select 1 from desk_sales where id = (r->>'sale_id')::uuid and discount_cents = 300 and coupon_id is null and coupon_discount_cents = 0)), false) then
    raise exception 'FALHOU passo 16: %', r; end if; ok := ok + 1;
  -- 17. o fechamento traz os cupons do período (só vendas pagas) e o cupom em cada venda da lista
  r := public.desk_day_close(e, k, now() - interval '1 hour', now() + interval '1 hour', null);
  if not coalesce((exists (select 1 from jsonb_array_elements(r->'coupons') x where x->>'code' = 'PROVAP20' and (x->>'uses')::int = 2)
          and not exists (select 1 from jsonb_array_elements(r->'coupons') x where x->>'code' = 'PROVAONE')
          and exists (select 1 from jsonb_array_elements(r->'list') x where (x->>'id')::uuid = v_sale and x->>'coupon' = 'PROVAP20' and (x->>'coupon_discount_cents')::bigint = round(p * 0.2))), false)
  then raise exception 'FALHOU passo 17: %', r->'coupons'; end if;
  ok := ok + 1;
  -- 18. a venda lida pela tela (recibo) traz o cupom
  r := public.desk_sale_get(e, k, v_sale);
  if not coalesce((r->'sale'->>'coupon_code' = 'PROVAP20' and (r->'sale'->>'coupon_discount_cents')::bigint = round(p * 0.2)), false) then raise exception 'FALHOU passo 18: %', r->'sale'; end if;
  ok := ok + 1;
  -- 19. chave errada não lê cupom
  begin
    r := public.desk_coupon_check(e, 'chave-errada', 'PROVAP20', p);
    raise exception 'FALHOU passo 19: chave errada passou';
  exception when sqlstate '28000' then ok := ok + 1;
  end;
  raise exception 'PROVA (desfeita): %/25 ok · serviço % (%) ·%', ok, s.name, p, log;
end $prova$;
