-- LEITURA (não altera nada) — item 7, cupom no caixa. Rode e baixe o resultado: Export → Download CSV.
select 'fn:' || p.proname as k, pg_get_functiondef(p.oid) as v
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('desk_checkout', 'desk_void_sale', 'desk_sale_get', 'desk_day_close', 'coupon_validate', 'coupon_redeem', 'coupon_list')
union all
select 'cols:' || table_name, string_agg(column_name || ' ' || data_type || coalesce(' default ' || column_default, ''), ', ' order by ordinal_position)
  from information_schema.columns
 where table_schema = 'public' and table_name in ('desk_sales', 'desk_sale_lines', 'desk_payments', 'coupons', 'coupon_redemptions')
 group by table_name
union all
select 'e2e:cupons', coalesce(jsonb_agg(jsonb_build_object('code', code, 'kind', kind, 'value', value, 'active', active, 'redeemed', redeemed))::text, '[]')
  from coupons where client_email = 'e2e-test@guileoai.com'
order by 1;
