-- GUILEO DESK v14 — CUPOM NO CAIXA (2026-10-21, Onda 1 item 7 "largar o MindBody")
-- No MindBody a recepção digita o código da promoção no checkout. Aqui o cupom é o MESMO da tela
-- Cupons & Campanhas (db/coupons.sql: tabela coupons, unique por negócio + upper(code)).
--
-- REGRAS
--   1. O caixa (desk_checkout) aceita sale.coupon_code. Validar + resgatar + gravar acontecem DENTRO da
--      transação da venda: a venda recusada não gasta o cupom; o último uso não sai duas vezes (a linha
--      do cupom fica travada com FOR UPDATE até a venda terminar).
--   2. percent (pct, percent, firstvisit) e amount: quem calcula o desconto é o SERVIDOR, com a mesma
--      função que a tela usa para mostrar o número antes de cobrar (desk_coupon_check). Desconto mostrado
--      = desconto cobrado.
--      BASE do cupom = linhas que não são gorjeta nem vale-presente, já com o desconto de cada linha.
--      Vale-presente é crédito da loja: nunca leva desconto. amount é limitado à base.
--   3. bogo, birthday, referral, freebie: não há valor automático. A recepção digita o desconto
--      (sale.discount_cents) e o cupom é contado igual. Desconto 0 com esses cupons é recusado
--      (coupon_needs_amount): cupom gasto sem efeito na conta é erro de digitação.
--   4. Com cupom, desconto do cupom + desconto manual não passa da base (discount_over_base, detail = base).
--      Sem cupom, o caixa continua exatamente como antes.
--   5. A venda grava coupon_id, coupon_code, coupon_discount_cents; desk_sales.discount_cents passa a ser o
--      desconto TOTAL (cupom + manual), então o fechamento continua somando certo. coupon_redemptions ganha
--      sale_id e o contato da cliente.
--   6. Estorno (desk_void_sale) devolve o uso: redeemed − 1 e apaga o resgate daquela venda.
--   7. Fechamento (desk_day_close): `coupons` [{code, uses, discount_cents}] e cada venda da lista traz o cupom.
-- Motivos (todos com prefixo coupon_, porque not_found no Desk já quer dizer "agendamento"):
--   coupon_not_found · coupon_inactive · coupon_not_started (detail = YYYY-MM-DD) · coupon_expired (detail = YYYY-MM-DD)
--   · coupon_exhausted (detail = limite) · coupon_no_base · coupon_needs_amount · discount_over_base (detail = base)
-- Idempotente: add column if not exists, create or replace, remendos textuais que se reconhecem e param
-- com erro (nada muda) se não acharem o texto esperado.

-- ═══ TRAVA: o caixa no ar tem de estar com v10 + v13 + v13_1 (em 2026-10-21 o desk_v2.sql foi rodado de novo
-- e voltou o caixa para 05/10; a volta é db/desk_restaura_pos_v2.sql). Sem isso, nada deste arquivo roda. ═══
do $t$
begin
  if position('_desk_pp_redeem' in pg_get_functiondef('public.desk_checkout(text,text,jsonb)'::regprocedure)) = 0
     or position('coalesce(r.sessions, 1)' in pg_get_functiondef('public.desk_void_sale(text,text,uuid,text)'::regprocedure)) = 0 then
    raise exception 'desk_v14: o caixa no ar está na versão antiga — rode antes db/desk_restaura_pos_v2.sql. Nada foi alterado.';
  end if;
end $t$;

-- ═══ COLUNAS ═══════════════════════════════════════════════════════════════════════════════════
alter table public.desk_sales add column if not exists coupon_id uuid;
alter table public.desk_sales add column if not exists coupon_code text;
alter table public.desk_sales add column if not exists coupon_discount_cents bigint not null default 0;
alter table public.coupon_redemptions add column if not exists sale_id uuid;
create index if not exists coupon_redemptions_sale on public.coupon_redemptions (sale_id) where sale_id is not null;
create index if not exists desk_sales_coupon on public.desk_sales (client_email, coupon_id) where coupon_id is not null;

-- ═══ A RÉGUA (uma só, usada pela prévia da tela e pelo caixa) ═════════════════════════════════════
-- Tipo de cálculo: 'percent' | 'amount' | 'manual'. A tela de Cupons grava pct/firstvisit; os presets da API, percent.
create or replace function public._desk_cupom_tipo(p_kind text)
returns text language sql immutable as $$
  select case when lower(coalesce(p_kind, '')) in ('percent', 'pct', 'firstvisit') then 'percent'
              when lower(coalesce(p_kind, '')) = 'amount' then 'amount'
              else 'manual' end
$$;

-- Por que o cupom não vale agora (null = vale). Mesma ordem do coupon_validate.
create or replace function public._desk_cupom_motivo(c public.coupons)
returns text language sql stable as $$
  select case when c.id is null then 'coupon_not_found'
              when not c.active then 'coupon_inactive'
              when c.starts_at is not null and now() < c.starts_at then 'coupon_not_started'
              when c.expires_at is not null and now() > c.expires_at then 'coupon_expired'
              when c.max_redemptions is not null and c.redeemed >= c.max_redemptions then 'coupon_exhausted'
              end
$$;

-- Desconto do cupom sobre a base, em centavos. null = cupom sem valor automático (bogo, brinde…).
-- percent: value = % (0–100); amount: value = valor na moeda (25 = 25,00). Nunca passa da base.
create or replace function public._desk_cupom_valor(c public.coupons, p_base bigint)
returns bigint language sql immutable as $$
  select case public._desk_cupom_tipo(c.kind)
           when 'percent' then least(round(greatest(coalesce(p_base, 0), 0) * least(greatest(coalesce(c.value, 0), 0), 100) / 100.0)::bigint, greatest(coalesce(p_base, 0), 0))
           when 'amount'  then least(round(greatest(coalesce(c.value, 0), 0) * 100)::bigint, greatest(coalesce(p_base, 0), 0))
         end
$$;

-- O que a tela pode mostrar do cupom (sem client_email, sem ids de outros).
create or replace function public._desk_cupom_json(c public.coupons)
returns jsonb language sql stable as $$
  select jsonb_build_object('id', c.id, 'code', c.code, 'kind', c.kind, 'tipo', public._desk_cupom_tipo(c.kind),
           'value', c.value, 'label', c.label, 'terms', c.terms, 'starts_at', c.starts_at, 'expires_at', c.expires_at,
           'max_redemptions', c.max_redemptions, 'redeemed', c.redeemed)
$$;

revoke all on function public._desk_cupom_tipo(text) from public, anon, authenticated;
revoke all on function public._desk_cupom_motivo(public.coupons) from public, anon, authenticated;
revoke all on function public._desk_cupom_valor(public.coupons, bigint) from public, anon, authenticated;
revoke all on function public._desk_cupom_json(public.coupons) from public, anon, authenticated;

-- ═══ PRÉVIA: a tela pergunta "quanto este cupom desconta nesta conta?" ════════════════════════════
-- p_base_cents = a base que a tela calculou (linhas sem gorjeta e sem vale-presente, já com desconto de linha).
-- Só lê. A venda refaz tudo com a base que o próprio banco somar.
create or replace function public.desk_coupon_check(p_email text, p_key text, p_code text, p_base_cents bigint)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); c coupons; v_motivo text; v_desc bigint; v_base bigint := greatest(coalesce(p_base_cents, 0), 0);
begin
  select * into c from coupons where client_email = e and upper(code) = upper(trim(coalesce(p_code, ''))) limit 1;
  v_motivo := public._desk_cupom_motivo(c);
  if v_motivo is not null then
    return jsonb_build_object('ok', false, 'reason', v_motivo,
      'detail', case v_motivo when 'coupon_expired' then to_char(c.expires_at at time zone 'UTC', 'YYYY-MM-DD')
                              when 'coupon_not_started' then to_char(c.starts_at at time zone 'UTC', 'YYYY-MM-DD')
                              when 'coupon_exhausted' then c.max_redemptions::text end)
      || case when c.id is null then '{}'::jsonb else jsonb_build_object('coupon', public._desk_cupom_json(c)) end;
  end if;
  v_desc := public._desk_cupom_valor(c, v_base);
  if v_desc is not null and v_desc <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'coupon_no_base', 'coupon', public._desk_cupom_json(c), 'base_cents', v_base);
  end if;
  return jsonb_build_object('ok', true, 'coupon', public._desk_cupom_json(c), 'base_cents', v_base,
                            'discount_cents', v_desc, 'automatic', v_desc is not null);
end $$;
revoke all on function public.desk_coupon_check(text, text, text, bigint) from public;
grant execute on function public.desk_coupon_check(text, text, text, bigint) to anon, authenticated, service_role;

-- ═══ NO CAIXA: valida, resgata e grava — chamado DE DENTRO do desk_checkout ═══════════════════════
-- Erros saem com GUI12 → o próprio desk_checkout devolve {ok:false, reason, detail} e desfaz a venda inteira
-- (inclusive o resgate). Devolve null quando a venda não tem cupom.
create or replace function public._desk_cupom_aplica(e text, p_sale_id uuid, p_sale jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_code text := nullif(upper(trim(coalesce(p_sale->>'coupon_code', ''))), '');
        c coupons; v_motivo text; v_base bigint; v_cup bigint;
        v_manual bigint := greatest(coalesce((p_sale->>'discount_cents')::bigint, 0), 0);
begin
  if v_code is null then return null; end if;
  select coalesce(sum(total_cents), 0) into v_base from desk_sale_lines where sale_id = p_sale_id and kind not in ('tip', 'giftcard');
  select * into c from coupons where client_email = e and upper(code) = v_code limit 1 for update;
  v_motivo := public._desk_cupom_motivo(c);
  -- detail sem ':' (o desk_checkout corta o motivo no primeiro ':'): data YYYY-MM-DD, como o package_expired
  if v_motivo = 'coupon_expired' then raise exception 'coupon_expired:%', to_char(c.expires_at at time zone 'UTC', 'YYYY-MM-DD') using errcode = 'GUI12';
  elsif v_motivo = 'coupon_not_started' then raise exception 'coupon_not_started:%', to_char(c.starts_at at time zone 'UTC', 'YYYY-MM-DD') using errcode = 'GUI12';
  elsif v_motivo = 'coupon_exhausted' then raise exception 'coupon_exhausted:%', c.max_redemptions using errcode = 'GUI12';
  elsif v_motivo is not null then raise exception '%', v_motivo using errcode = 'GUI12';
  end if;
  v_cup := public._desk_cupom_valor(c, v_base);
  if v_cup is null then
    -- sem valor automático: o desconto que a recepção digitou É o desconto do cupom
    if v_manual <= 0 then raise exception 'coupon_needs_amount' using errcode = 'GUI12'; end if;
    v_cup := v_manual; v_manual := 0;
  elsif v_cup <= 0 then
    raise exception 'coupon_no_base' using errcode = 'GUI12';
  end if;
  if v_cup + v_manual > v_base then raise exception 'discount_over_base:%', v_base using errcode = 'GUI12'; end if;
  update coupons set redeemed = redeemed + 1 where id = c.id;
  insert into coupon_redemptions (coupon_id, client_email, contact, sale_id)
    values (c.id, e, nullif(left(trim(coalesce(p_sale->>'customer_contact', '')), 160), ''), p_sale_id);
  update desk_sales set discount_cents = v_cup + v_manual, coupon_id = c.id, coupon_code = c.code, coupon_discount_cents = v_cup
   where id = p_sale_id and client_email = e;
  return jsonb_build_object('discount_cents', v_cup + v_manual,
    'coupon', jsonb_build_object('id', c.id, 'code', c.code, 'label', c.label, 'kind', c.kind, 'tipo', public._desk_cupom_tipo(c.kind), 'discount_cents', v_cup));
end $$;
revoke all on function public._desk_cupom_aplica(text, uuid, jsonb) from public, anon, authenticated;

-- ═══ desk_checkout: 3 remendos (declaração, total, resposta) — roda uma vez ══════════════════════
do $p$
declare d text := pg_get_functiondef('public.desk_checkout(text,text,jsonb)'::regprocedure); n text;
begin
  if position('_desk_cupom_aplica' in d) > 0 then return; end if;
  n := replace(d, E'v_meta jsonb; v_out jsonb := \'[]\'::jsonb;', E'v_meta jsonb; v_out jsonb := \'[]\'::jsonb; v_cup jsonb;');
  if n = d then raise exception 'desk_v14: declaração não encontrada em desk_checkout — nada alterado'; end if;
  d := n;
  n := replace(d,
    E'  v_total := greatest(v_sub - coalesce((p_sale->>\'discount_cents\')::bigint, 0), 0) + coalesce((p_sale->>\'tax_cents\')::bigint, 0) + v_tip;',
    E'  -- cupom (desk_v14): valida, resgata e grava DENTRO desta transação; o desconto do cupom vem do servidor.\n' ||
    E'  v_cup := public._desk_cupom_aplica(e, v_id, p_sale);\n' ||
    E'  v_total := greatest(v_sub - coalesce((v_cup->>\'discount_cents\')::bigint, coalesce((p_sale->>\'discount_cents\')::bigint, 0)), 0) + coalesce((p_sale->>\'tax_cents\')::bigint, 0) + v_tip;');
  if n = d then raise exception 'desk_v14: cálculo do total não encontrado em desk_checkout — nada alterado'; end if;
  d := n;
  n := replace(d, E'\'total_cents\', v_total, \'lines\', v_out);', E'\'total_cents\', v_total, \'lines\', v_out) || coalesce(v_cup, \'{}\'::jsonb);');
  if n = d then raise exception 'desk_v14: resposta não encontrada em desk_checkout — nada alterado'; end if;
  execute n;
end $p$;

-- ═══ desk_void_sale: o estorno devolve o uso do cupom — roda uma vez ═════════════════════════════
do $p$
declare d text := pg_get_functiondef('public.desk_void_sale(text,text,uuid,text)'::regprocedure); n text;
begin
  if position('coupon_redemptions' in d) > 0 then return; end if;
  n := replace(d,
    E'  update desk_sales set status = \'void\', voided_at = now(), void_reason = left(p_reason, 300) where id = s.id;',
    E'  -- cupom (desk_v14): o uso volta para o cupom\n' ||
    E'  if s.coupon_id is not null then\n' ||
    E'    update coupons set redeemed = greatest(redeemed - 1, 0) where id = s.coupon_id and client_email = e;\n' ||
    E'    delete from coupon_redemptions where sale_id = s.id;\n' ||
    E'  end if;\n' ||
    E'  update desk_sales set status = \'void\', voided_at = now(), void_reason = left(p_reason, 300) where id = s.id;');
  if n = d then raise exception 'desk_v14: anulação não encontrada em desk_void_sale — nada alterado'; end if;
  execute n;
end $p$;

-- ═══ desk_day_close: cupons do período + cupom em cada venda da lista — roda uma vez ═══════════════
do $p$
declare d text := pg_get_functiondef('public.desk_day_close(text,text,timestamptz,timestamptz,uuid)'::regprocedure); n text;
begin
  if position('coupon_code' in d) > 0 then return; end if;
  n := replace(d, E'\'tip_cents\', s.tip_cents, \'status\', s.status,',
                  E'\'tip_cents\', s.tip_cents, \'status\', s.status, \'coupon\', s.coupon_code, \'coupon_discount_cents\', s.coupon_discount_cents,');
  if n = d then raise exception 'desk_v14: lista de vendas não encontrada em desk_day_close — nada alterado'; end if;
  d := n;
  n := replace(d, E'\n    \'appointments\', (select jsonb_build_object(',
    E'\n    -- cupons usados no período (desk_v14): só vendas pagas\n' ||
    E'    \'coupons\', coalesce((select jsonb_agg(jsonb_build_object(\'code\', code, \'uses\', uses, \'discount_cents\', cents) order by cents desc)\n' ||
    E'              from (select max(coupon_code) code, count(*) uses, sum(coupon_discount_cents) cents from desk_sales\n' ||
    E'                     where client_email = e and status = \'paid\' and coupon_id is not null and created_at >= p_from and created_at < p_to\n' ||
    E'                       and (p_location_id is null or location_id = p_location_id) group by coupon_id) k), \'[]\'::jsonb),\n' ||
    E'    \'appointments\', (select jsonb_build_object(');
  if n = d then raise exception 'desk_v14: bloco de agendamentos não encontrado em desk_day_close — nada alterado'; end if;
  execute n;
end $p$;

-- ═══ CHECAGEM: tem de devolver aplicado = true ══════════════════════════════════════════════════
select position('_desk_cupom_aplica' in pg_get_functiondef('public.desk_checkout(text,text,jsonb)'::regprocedure)) > 0
   and position('_desk_comissao' in pg_get_functiondef('public.desk_checkout(text,text,jsonb)'::regprocedure)) > 0
   and position('_desk_pp_redeem' in pg_get_functiondef('public.desk_checkout(text,text,jsonb)'::regprocedure)) > 0
   and position('coupon_redemptions' in pg_get_functiondef('public.desk_void_sale(text,text,uuid,text)'::regprocedure)) > 0
   and position('coalesce(r.sessions, 1)' in pg_get_functiondef('public.desk_void_sale(text,text,uuid,text)'::regprocedure)) > 0
   and position('coupon_code' in pg_get_functiondef('public.desk_day_close(text,text,timestamptz,timestamptz,uuid)'::regprocedure)) > 0
   and to_regprocedure('public.desk_coupon_check(text,text,text,bigint)') is not null
   and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'desk_sales' and column_name = 'coupon_discount_cents')
   and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'coupon_redemptions' and column_name = 'sale_id')
   as aplicado;
