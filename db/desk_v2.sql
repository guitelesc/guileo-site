-- GUILEO DESK v2 — caixa, ficha da cliente, equipe, bloqueios, fechamento, formulário público,
-- importação do MindBody. (2026-10-05) Só ACRESCENTA; nenhuma função existente muda.
-- Porta: e-mail + chave de conexão (_desk_ok, db/desk_v1.sql). Idempotente.
--
-- 🚨 SITUAÇÃO DO BALCÃO ≠ SITUAÇÃO DO MOTOR (achado de 2026-10-05)
-- Lembrete (biz_reminders_due*) e pedido de avaliação (biz_review_due*) só saem para status='booked'.
-- O desk v1 gravava confirmed/in_progress/completed no status → a cliente que a recepção confirmava
-- deixava de receber lembrete, e quem passava no caixa nunca recebia pedido de avaliação.
-- Agora: confirmou / chegou / concluiu vão em attributes.desk_status; status só muda para o que o
-- motor precisa saber de verdade: cancelled, no_show, blocked.
--
-- 🧱 BLOQUEIO / FOLGA = linha em biz_appointments com status='blocked' e contato NULO.
-- O gatilho biz_appt_guard e o biz_availability só ignoram 'cancelled' → bloqueio já impede marcar
-- por cima, sem tocar em função compartilhada. Lembrete/avaliação filtram 'booked' e contato → ignoram.

-- ── chave de contato: telefone = últimos 10 dígitos; e-mail = minúsculo ─────────────────────────
create or replace function public._desk_ck(p text)
returns text language sql immutable as $$
  select case when coalesce(p, '') like '%@%' then lower(trim(p))
              when length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) >= 7 then right(regexp_replace(p, '\D', '', 'g'), 10)
              else null end
$$;

-- ═══ TABELAS ═══════════════════════════════════════════════════════════════════════════════════
create table if not exists public.desk_sales (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,
  number text,
  location_id uuid,
  appointment_id uuid,
  customer_name text,
  customer_contact text,
  contact_key text,
  subtotal_cents bigint not null default 0,
  discount_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  tip_cents bigint not null default 0,
  total_cents bigint not null default 0,
  status text not null default 'paid',          -- paid | void
  note text,
  receipt_to text,
  receipt_sent_at timestamptz,
  receipt_id text,
  request_id text,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  void_reason text
);
create index if not exists desk_sales_tenant on public.desk_sales (client_email, created_at desc);
create index if not exists desk_sales_contact on public.desk_sales (client_email, contact_key);
create unique index if not exists desk_sales_request on public.desk_sales (client_email, request_id) where request_id is not null;

create table if not exists public.desk_sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.desk_sales(id) on delete cascade,
  client_email text not null,
  kind text not null,                 -- service | product | package | giftcard | tip | custom
  ref_id uuid,
  name text not null,
  qty int not null default 1,
  unit_cents bigint not null default 0,
  discount_cents bigint not null default 0,
  total_cents bigint not null default 0,
  pro_id uuid,
  commission_cents bigint not null default 0,
  meta jsonb not null default '{}'::jsonb
);
create index if not exists desk_lines_sale on public.desk_sale_lines (sale_id);
create index if not exists desk_lines_tenant_pro on public.desk_sale_lines (client_email, pro_id);

create table if not exists public.desk_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.desk_sales(id) on delete cascade,
  client_email text not null,
  method text not null,               -- cash | card | gift_card | package | other
  amount_cents bigint not null,
  ref text,
  created_at timestamptz not null default now()
);
create index if not exists desk_payments_sale on public.desk_payments (sale_id);

create table if not exists public.desk_clients (
  client_email text not null,
  contact_key text not null,
  name text,
  phone text,
  email text,
  allergies text,
  alerts text,
  notes text,
  trusted boolean not null default false,       -- isenta de sinal / taxa de falta
  can_book_online boolean not null default true,
  tags jsonb not null default '[]'::jsonb,
  source text,
  updated_at timestamptz not null default now(),
  primary key (client_email, contact_key)
);

alter table public.desk_sales enable row level security;
alter table public.desk_sale_lines enable row level security;
alter table public.desk_payments enable row level security;
alter table public.desk_clients enable row level security;
revoke all on public.desk_sales, public.desk_sale_lines, public.desk_payments, public.desk_clients from anon, authenticated;

-- ═══ SITUAÇÃO DO BALCÃO (substitui a de v1) ════════════════════════════════════════════════════
create or replace function public.desk_set_status(p_email text, p_key text, p_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); s text := lower(coalesce(p_status, '')); n int;
begin
  if s = 'arrived' then s := 'in_progress'; end if;
  if s not in ('booked', 'confirmed', 'in_progress', 'completed', 'no_show', 'cancelled') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_status');
  end if;
  if s in ('no_show', 'cancelled') then
    update biz_appointments set status = s,
           attributes = coalesce(attributes, '{}'::jsonb) || jsonb_build_object('desk_status', s, 'desk_status_at', now())
     where id = p_id and client_email = e and status <> 'hold';
  else
    -- confirmou/chegou/concluiu: só o balcão fica sabendo; o motor continua vendo 'booked'
    -- (e por isso continua mandando lembrete e, depois, o pedido de avaliação).
    update biz_appointments set
           status = case when status in ('no_show', 'cancelled') and s = 'booked' then 'booked' else status end,
           attributes = coalesce(attributes, '{}'::jsonb) || jsonb_build_object('desk_status', s, 'desk_status_at', now())
     where id = p_id and client_email = e and status not in ('hold', 'blocked');
  end if;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n = 1, 'id', p_id, 'status', s);
end $$;

-- Linhas antigas do v1 (gravadas no status) voltam a 'booked' com a situação no atributo.
update biz_appointments set attributes = coalesce(attributes, '{}'::jsonb) || jsonb_build_object('desk_status', status), status = 'booked'
 where status in ('in_progress', 'completed') and attributes ? 'desk_status_at';

-- ═══ AGENDA (substitui a de v1): situação do balcão, bloqueios, cartões já pagos ══════════════
create or replace function public.desk_agenda(p_email text, p_key text, p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key);
        f timestamptz := coalesce(p_from, date_trunc('day', now()));
        t timestamptz := coalesce(p_to, coalesce(p_from, date_trunc('day', now())) + interval '1 day');
begin
  if t <= f or t - f > interval '42 days' then raise exception 'invalid_range' using errcode = '22023'; end if;
  return jsonb_build_object(
    'ok', true, 'from', f, 'to', t,
    'locations', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'address', l.address,
                    'city', l.city, 'phone', l.phone, 'tz', coalesce(l.tz, 'America/New_York')) order by l.created_at)
                  from biz_locations l where l.client_email = e and coalesce(l.active, true)), '[]'::jsonb),
    'pros', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'title', coalesce(p.title, ''),
                    'kind', coalesce(p.kind, 'staff'), 'color', p.config->>'color',
                    'commission_service_pct', coalesce((p.config->>'commission_service_pct')::numeric, 0),
                    'commission_product_pct', coalesce((p.config->>'commission_product_pct')::numeric, 0),
                    'locations', coalesce((select jsonb_agg(pl.location_id) from biz_pro_locations pl where pl.pro_id = p.id), '[]'::jsonb),
                    'services', coalesce((select jsonb_agg(ps.service_id) from biz_pro_services ps where ps.pro_id = p.id), '[]'::jsonb),
                    'hours', coalesce((select jsonb_agg(jsonb_build_object('location_id', s.location_id, 'weekday', s.weekday,
                                'start_min', s.start_min, 'end_min', s.end_min) order by s.weekday, s.start_min)
                              from biz_schedules s where s.pro_id = p.id), '[]'::jsonb)) order by coalesce(p.kind, 'staff') = 'room', p.name)
                  from biz_professionals p where p.client_email = e and coalesce(p.active, true)), '[]'::jsonb),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'duration_min', s.duration_min,
                    'price_cents', s.price_cents, 'deposit_cents', s.deposit_cents, 'capacity', coalesce(s.capacity, 1),
                    'cancel_window_h', s.cancel_window_h, 'noshow_fee_cents', (s.config->>'noshow_fee_cents')::int,
                    'buffer_before_min', coalesce(s.buffer_before_min, 0), 'buffer_after_min', coalesce(s.buffer_after_min, 0),
                    'category', s.config->>'category') order by s.name)
                  from biz_services s where s.client_email = e and coalesce(s.active, true)), '[]'::jsonb),
    'appointments', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'ref', a.ref,
                    'status', case when a.status in ('cancelled', 'no_show', 'blocked', 'hold') then a.status
                                   else coalesce(a.attributes->>'desk_status', a.status) end,
                    'start', lower(a.span), 'end', upper(a.span), 'pro_id', a.pro_id, 'location_id', a.location_id,
                    'service_id', a.service_id, 'customer_name', a.customer_name, 'customer_contact', a.customer_contact,
                    'source', coalesce(a.attributes->>'source', a.source), 'note', a.attributes->>'desk_note',
                    'sale_id', a.attributes->>'sale_id', 'deposit_paid', coalesce((a.attributes->>'deposit_paid')::boolean, false),
                    'reminded', coalesce(a.reminded, false), 'created_at', a.created_at,
                    'alert', (select nullif(concat_ws(' · ', nullif(c.allergies, ''), nullif(c.alerts, '')), '') from desk_clients c
                               where c.client_email = e and c.contact_key = public._desk_ck(a.customer_contact)),
                    'trusted', coalesce((select c.trusted from desk_clients c where c.client_email = e and c.contact_key = public._desk_ck(a.customer_contact)), false))
                    order by lower(a.span))
                  from public.vivo_biz_appointments(e) a
                  where a.span && tstzrange(f, t)
                    and (a.expires_at is null or a.expires_at > now() or a.status <> 'hold')), '[]'::jsonb),
    'closed', coalesce((select jsonb_agg(jsonb_build_object('date', d.date, 'closed', d.closed, 'open_min', d.open_min,
                    'close_min', d.close_min, 'note', d.note) order by d.date)
                  from biz_special_dates d where d.client_email = e
                    and d.date between (f at time zone 'UTC')::date - 1 and (t at time zone 'UTC')::date + 1), '[]'::jsonb)
  );
end $$;

-- ═══ CATÁLOGO DO CAIXA: produtos, pacotes, vale-presente ═══════════════════════════════════════
create or replace function public.desk_catalog(p_email text, p_key text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key);
begin
  return jsonb_build_object('ok', true,
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'brand', brand, 'price_cents', price_cents,
                  'stock', stock, 'location_id', location_id) order by name) from biz_products where client_email = e and coalesce(active, true)), '[]'::jsonb),
    'packages', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'service', service, 'sessions', sessions,
                  'price_cents', price_cents) order by name) from packages where client_email = e and coalesce(active, true)), '[]'::jsonb));
end $$;

-- ═══ CAIXA: uma venda inteira numa transação ═══════════════════════════════════════════════════
-- p_sale = { appointment_id?, location_id?, customer_name, customer_contact, discount_cents?, tax_cents?,
--            note?, receipt_to?, request_id?,
--            lines: [{kind:service|product|package|giftcard|tip|custom, ref_id?, name?, qty?, unit_cents?, discount_cents?, pro_id?}],
--            payments: [{method:cash|card|gift_card|package|other, amount_cents, ref?}] }
-- Regras: preço de serviço/produto/pacote vem do CADASTRO (o caixa só pode dar desconto, nunca
-- inventar preço); a soma dos pagamentos tem de fechar com o total; vale-presente e pacote são
-- debitados aqui, com trava de linha, e uma falha desfaz a venda inteira.
create or replace function public.desk_checkout(p_email text, p_key text, p_sale jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key);
        v_id uuid; l jsonb; pg jsonb; v_kind text; v_qty int; v_unit bigint; v_disc bigint; v_tot bigint; v_name text;
        v_sub bigint := 0; v_tip bigint := 0; v_paid bigint := 0; v_total bigint; v_comm bigint; v_pct numeric;
        v_svc biz_services; v_prod biz_products; v_pkg packages; v_gc gift_cards; v_pp package_purchases;
        v_ck text := public._desk_ck(p_sale->>'customer_contact'); v_code text; v_num text; v_req text := nullif(p_sale->>'request_id', '');
        v_appt uuid := nullif(p_sale->>'appointment_id', '')::uuid; v_meta jsonb; v_out jsonb := '[]'::jsonb;
begin
  if v_req is not null then
    select id into v_id from desk_sales where client_email = e and request_id = v_req;
    if v_id is not null then return jsonb_build_object('ok', true, 'sale_id', v_id, 'idempotent', true); end if;
  end if;
  if jsonb_typeof(p_sale->'lines') is distinct from 'array' or jsonb_array_length(p_sale->'lines') = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_lines');
  end if;
  if v_appt is not null and not exists (select 1 from biz_appointments where id = v_appt and client_email = e) then
    return jsonb_build_object('ok', false, 'reason', 'appointment_not_found');
  end if;
  v_num := to_char(now() at time zone 'UTC', 'YYMMDD') || '-' || upper(substr(md5(random()::text), 1, 4));
  insert into desk_sales (client_email, number, location_id, appointment_id, customer_name, customer_contact, contact_key,
                          discount_cents, tax_cents, note, receipt_to, request_id)
  values (e, v_num, nullif(p_sale->>'location_id', '')::uuid, v_appt, left(p_sale->>'customer_name', 160),
          left(p_sale->>'customer_contact', 160), v_ck, greatest(coalesce((p_sale->>'discount_cents')::bigint, 0), 0),
          greatest(coalesce((p_sale->>'tax_cents')::bigint, 0), 0), left(p_sale->>'note', 1000), left(p_sale->>'receipt_to', 200), v_req)
  returning id into v_id;

  for l in select * from jsonb_array_elements(p_sale->'lines') loop
    v_kind := lower(coalesce(l->>'kind', '')); v_qty := greatest(coalesce((l->>'qty')::int, 1), 1);
    v_disc := greatest(coalesce((l->>'discount_cents')::bigint, 0), 0); v_meta := '{}'::jsonb; v_comm := 0; v_name := null; v_unit := 0;
    if v_kind = 'service' then
      select * into v_svc from biz_services where id = (l->>'ref_id')::uuid and client_email = e;
      if v_svc.id is null then raise exception 'service_not_found' using errcode = 'GUI10'; end if;
      v_name := v_svc.name; v_unit := coalesce(v_svc.price_cents, 0);
      -- serviço com preço "sob consulta" (0 no cadastro) aceita o valor do balcão; os outros, nunca.
      if v_unit = 0 and l ? 'unit_cents' then v_unit := greatest((l->>'unit_cents')::bigint, 0); end if;
    elsif v_kind = 'product' then
      select * into v_prod from biz_products where id = (l->>'ref_id')::uuid and client_email = e for update;
      if v_prod.id is null then raise exception 'product_not_found' using errcode = 'GUI10'; end if;
      if v_prod.stock is not null and v_prod.stock < v_qty then raise exception 'out_of_stock:%', v_prod.name using errcode = 'GUI11'; end if;
      v_name := v_prod.name; v_unit := coalesce(v_prod.price_cents, 0);
      if v_prod.stock is not null then update biz_products set stock = stock - v_qty, updated_at = now() where id = v_prod.id; end if;
      insert into biz_product_sales (client_email, product_id, product_name, qty, unit_price_cents, ref, customer_name, customer_contact, status, source)
        values (e, v_prod.id, v_prod.name, v_qty, v_unit, 'desk:' || v_id, p_sale->>'customer_name', p_sale->>'customer_contact', 'paid', 'desk');   -- a tabela só aceita reserved|paid|cancelled
    elsif v_kind = 'package' then
      select * into v_pkg from packages where id = (l->>'ref_id')::uuid and client_email = e;
      if v_pkg.id is null then raise exception 'package_not_found' using errcode = 'GUI10'; end if;
      if v_ck is null then raise exception 'package_needs_contact' using errcode = 'GUI12'; end if;
      v_name := v_pkg.name; v_unit := coalesce(v_pkg.price_cents, 0);
      insert into package_purchases (client_email, package_id, contact, sessions_total, sessions_used)
        values (e, v_pkg.id, p_sale->>'customer_contact', v_pkg.sessions * v_qty, 0) returning id into v_pp.id;
      v_meta := jsonb_build_object('purchase_id', v_pp.id);
    elsif v_kind = 'giftcard' then
      v_unit := greatest(coalesce((l->>'unit_cents')::bigint, 0), 0);
      if v_unit < 100 then raise exception 'giftcard_amount' using errcode = 'GUI12'; end if;
      v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
      insert into gift_cards (client_email, code, amount_cents, balance_cents, purchaser_contact, recipient_contact, active)
        values (e, v_code, v_unit, v_unit, p_sale->>'customer_contact', nullif(l->>'recipient', ''), true);
      v_name := coalesce(nullif(l->>'name', ''), 'Gift card') || ' ' || v_code; v_qty := 1;
      v_meta := jsonb_build_object('code', v_code);
    elsif v_kind = 'tip' then
      v_unit := greatest(coalesce((l->>'unit_cents')::bigint, 0), 0); v_qty := 1; v_disc := 0;
      v_name := 'Tip'; v_tip := v_tip + v_unit;
    elsif v_kind = 'custom' then
      v_unit := greatest(coalesce((l->>'unit_cents')::bigint, 0), 0); v_name := coalesce(nullif(left(l->>'name', 120), ''), 'Item');
    else
      raise exception 'invalid_line_kind' using errcode = 'GUI10';
    end if;
    v_tot := greatest(v_unit * v_qty - v_disc, 0);
    if v_kind <> 'tip' then v_sub := v_sub + v_tot; end if;
    -- comissão: % da profissional sobre serviço / produto; gorjeta é 100% dela (não entra aqui).
    if nullif(l->>'pro_id', '') is not null and v_kind in ('service', 'product') then
      select case when v_kind = 'service' then coalesce((config->>'commission_service_pct')::numeric, 0)
                  else coalesce((config->>'commission_product_pct')::numeric, 0) end into v_pct
        from biz_professionals where id = (l->>'pro_id')::uuid and client_email = e;
      v_comm := round(v_tot * coalesce(v_pct, 0) / 100.0);
    end if;
    insert into desk_sale_lines (sale_id, client_email, kind, ref_id, name, qty, unit_cents, discount_cents, total_cents, pro_id, commission_cents, meta)
      values (v_id, e, v_kind, nullif(l->>'ref_id', '')::uuid, v_name, v_qty, v_unit, v_disc, v_tot, nullif(l->>'pro_id', '')::uuid, v_comm, v_meta);
    v_out := v_out || jsonb_build_array(jsonb_build_object('kind', v_kind, 'name', v_name, 'total_cents', v_tot) || v_meta);
  end loop;

  v_total := greatest(v_sub - coalesce((p_sale->>'discount_cents')::bigint, 0), 0) + coalesce((p_sale->>'tax_cents')::bigint, 0) + v_tip;

  for pg in select * from jsonb_array_elements(coalesce(p_sale->'payments', '[]'::jsonb)) loop
    if lower(coalesce(pg->>'method', '')) not in ('cash', 'card', 'gift_card', 'package', 'other') then
      raise exception 'invalid_payment_method' using errcode = 'GUI10';
    end if;
    if (pg->>'amount_cents')::bigint < 0 then raise exception 'negative_payment' using errcode = 'GUI10'; end if;
    if lower(pg->>'method') = 'gift_card' then
      select * into v_gc from gift_cards where client_email = e and upper(code) = upper(pg->>'ref') and coalesce(active, true) for update;
      if v_gc.id is null then raise exception 'giftcard_not_found' using errcode = 'GUI13'; end if;
      if v_gc.balance_cents < (pg->>'amount_cents')::bigint then raise exception 'giftcard_balance:%', v_gc.balance_cents using errcode = 'GUI13'; end if;
      update gift_cards set balance_cents = balance_cents - (pg->>'amount_cents')::bigint where id = v_gc.id;
    elsif lower(pg->>'method') = 'package' then
      select * into v_pp from package_purchases where id = (pg->>'ref')::uuid and client_email = e for update;
      if v_pp.id is null or v_pp.sessions_used >= v_pp.sessions_total then raise exception 'package_empty' using errcode = 'GUI13'; end if;
      update package_purchases set sessions_used = sessions_used + 1 where id = v_pp.id;
    end if;
    insert into desk_payments (sale_id, client_email, method, amount_cents, ref) values (v_id, e, lower(pg->>'method'), (pg->>'amount_cents')::bigint, left(pg->>'ref', 80));
    v_paid := v_paid + (pg->>'amount_cents')::bigint;
  end loop;
  if v_paid <> v_total then raise exception 'payment_mismatch:%/%', v_paid, v_total using errcode = 'GUI14'; end if;

  update desk_sales set subtotal_cents = v_sub, tip_cents = v_tip, total_cents = v_total where id = v_id;
  if v_appt is not null then
    update biz_appointments set attributes = coalesce(attributes, '{}'::jsonb) || jsonb_build_object('desk_status', 'completed', 'desk_status_at', now(), 'sale_id', v_id)
     where id = v_appt and client_email = e and status not in ('cancelled', 'blocked');
  end if;
  -- ficha da cliente: gasto e visita (só o que é do próprio negócio)
  if v_ck is not null then
    update crm_contacts set ltv_cents = coalesce(ltv_cents, 0) + greatest((select coalesce(sum(amount_cents), 0) from desk_payments where sale_id = v_id and method in ('cash', 'card', 'other')) - v_tip, 0), visit_count = coalesce(visit_count, 0) + 1, last_seen_at = now(), updated_at = now()
     where client_email = e and (phone_key = v_ck or lower(email) = v_ck);
  end if;
  return jsonb_build_object('ok', true, 'sale_id', v_id, 'number', v_num, 'subtotal_cents', v_sub, 'tip_cents', v_tip, 'total_cents', v_total, 'lines', v_out);
exception
  when sqlstate 'GUI10' or sqlstate 'GUI11' or sqlstate 'GUI12' or sqlstate 'GUI13' or sqlstate 'GUI14' then
    return jsonb_build_object('ok', false, 'reason', split_part(sqlerrm, ':', 1), 'detail', nullif(split_part(sqlerrm, ':', 2), ''));
end $$;

-- ═══ ESTORNO NO BALCÃO (anular a venda): devolve estoque, saldo do vale e sessão do pacote ══════
-- O estorno no cartão é feito na maquininha/Stripe; aqui fica o registro e o que é nosso.
create or replace function public.desk_void_sale(p_email text, p_key text, p_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); s desk_sales; r record;
begin
  select * into s from desk_sales where id = p_id and client_email = e for update;
  if s.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if s.status = 'void' then return jsonb_build_object('ok', false, 'reason', 'already_void'); end if;
  -- não devolve o dinheiro de pacote já usado nem de vale já gasto (a cliente ficaria com os dois)
  if exists (select 1 from desk_sale_lines l join package_purchases pp on pp.id = (l.meta->>'purchase_id')::uuid
              where l.sale_id = s.id and l.kind = 'package' and pp.sessions_used > 0) then
    return jsonb_build_object('ok', false, 'reason', 'package_used');
  end if;
  if exists (select 1 from desk_sale_lines l join gift_cards g on g.client_email = e and upper(g.code) = upper(l.meta->>'code')
              where l.sale_id = s.id and l.kind = 'giftcard' and g.balance_cents < g.amount_cents) then
    return jsonb_build_object('ok', false, 'reason', 'giftcard_used');
  end if;
  for r in select * from desk_sale_lines where sale_id = s.id loop
    if r.kind = 'product' then update biz_products set stock = stock + r.qty where id = r.ref_id and client_email = e and stock is not null;
      update biz_product_sales set status = 'cancelled' where client_email = e and ref = 'desk:' || s.id and product_id = r.ref_id;
    elsif r.kind = 'giftcard' then update gift_cards set active = false where client_email = e and upper(code) = upper(r.meta->>'code');
    elsif r.kind = 'package' then delete from package_purchases where id = (r.meta->>'purchase_id')::uuid and client_email = e and sessions_used = 0;
    end if;
  end loop;
  for r in select * from desk_payments where sale_id = s.id loop
    if r.method = 'gift_card' then update gift_cards set balance_cents = balance_cents + r.amount_cents where client_email = e and upper(code) = upper(r.ref);
    elsif r.method = 'package' then update package_purchases set sessions_used = greatest(sessions_used - 1, 0) where id = r.ref::uuid and client_email = e;
    end if;
  end loop;
  update desk_sales set status = 'void', voided_at = now(), void_reason = left(p_reason, 300) where id = s.id;
  if s.contact_key is not null then
    update crm_contacts set ltv_cents = greatest(coalesce(ltv_cents, 0) - (s.total_cents - s.tip_cents), 0)
     where client_email = e and (phone_key = s.contact_key or lower(email) = s.contact_key);
  end if;
  if s.appointment_id is not null then
    update biz_appointments set attributes = (coalesce(attributes, '{}'::jsonb) - 'sale_id') || jsonb_build_object('desk_status', 'in_progress')
     where id = s.appointment_id and client_email = e;
  end if;
  return jsonb_build_object('ok', true, 'id', s.id);
end $$;

create or replace function public.desk_sale_get(p_email text, p_key text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key);
begin
  return (select jsonb_build_object('ok', true, 'sale', to_jsonb(s) - 'client_email',
            'lines', coalesce((select jsonb_agg(to_jsonb(l) - 'client_email' order by l.kind = 'tip', l.name) from desk_sale_lines l where l.sale_id = s.id), '[]'::jsonb),
            'payments', coalesce((select jsonb_agg(to_jsonb(p) - 'client_email' order by p.created_at) from desk_payments p where p.sale_id = s.id), '[]'::jsonb),
            'business', coalesce((select tokens->>'business_name' from client_integrations where client_email = e and provider = 'profile' limit 1), ''),
            'location', (select jsonb_build_object('name', name, 'address', address, 'city', city, 'phone', phone, 'tz', tz) from biz_locations where id = s.location_id))
          from desk_sales s where s.id = p_id and s.client_email = e);
end $$;

create or replace function public.desk_receipt_mark(p_email text, p_key text, p_id uuid, p_to text, p_receipt_id text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); n int;
begin
  update desk_sales set receipt_to = left(p_to, 200), receipt_sent_at = now(), receipt_id = left(p_receipt_id, 80) where id = p_id and client_email = e;
  get diagnostics n = row_count; return jsonb_build_object('ok', n = 1);
end $$;

-- ═══ FICHA DA CLIENTE ══════════════════════════════════════════════════════════════════════════
create or replace function public.desk_client_search(p_email text, p_key text, p_q text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); q text := lower(trim(coalesce(p_q, ''))); qd text := regexp_replace(coalesce(p_q, ''), '\D', '', 'g');
begin
  if length(q) < 2 then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(x) from (
    select distinct on (ck) jsonb_build_object('contact_key', ck, 'name', nm, 'contact', ct) x, ck from (
      select coalesce(c.phone_key, lower(c.email)) ck, c.full_name nm, coalesce(c.phone, c.email) ct, c.last_seen_at seen
        from crm_contacts c where c.client_email = e and coalesce(c.phone_key, c.email) is not null
         and (lower(coalesce(c.full_name, '')) like '%' || q || '%' or lower(coalesce(c.email, '')) like '%' || q || '%' or (length(qd) >= 3 and coalesce(c.phone_key, '') like '%' || qd || '%'))
      union all
      select public._desk_ck(a.customer_contact), a.customer_name, a.customer_contact, a.created_at
        from public.vivo_biz_appointments(e) a where public._desk_ck(a.customer_contact) is not null
         and (lower(coalesce(a.customer_name, '')) like '%' || q || '%' or (length(qd) >= 3 and regexp_replace(coalesce(a.customer_contact, ''), '\D', '', 'g') like '%' || qd || '%'))
      union all
      -- quem só passou no caixa (sem agendamento nem cadastro) também tem que ser achado
      select s.contact_key, s.customer_name, s.customer_contact, s.created_at from desk_sales s
       where s.client_email = e and s.contact_key is not null
         and (lower(coalesce(s.customer_name, '')) like '%' || q || '%' or (length(qd) >= 3 and s.contact_key like '%' || qd || '%'))
      union all
      select d.contact_key, d.name, coalesce(d.phone, d.email), d.updated_at from desk_clients d
       where d.client_email = e and (lower(coalesce(d.name, '')) like '%' || q || '%' or d.contact_key like '%' || coalesce(nullif(qd, ''), q) || '%')
    ) u where ck is not null order by ck, seen desc nulls last limit 40) z), '[]'::jsonb);
end $$;

create or replace function public.desk_client_card(p_email text, p_key text, p_contact text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); ck text := public._desk_ck(p_contact);
begin
  if ck is null then return jsonb_build_object('ok', false, 'reason', 'invalid_contact'); end if;
  return jsonb_build_object('ok', true, 'contact_key', ck,
    'profile', (select to_jsonb(d) - 'client_email' from desk_clients d where d.client_email = e and d.contact_key = ck),
    'crm', (select jsonb_build_object('name', c.full_name, 'phone', c.phone, 'email', c.email, 'birth_date', c.birth_date,
              'lifecycle', c.lifecycle, 'lead_source', c.lead_source, 'first_seen_at', c.first_seen_at, 'consent_sms', c.consent_sms)
            from crm_contacts c where c.client_email = e and (c.phone_key = ck or lower(c.email) = ck) limit 1),
    'visits', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'start', lower(a.span), 'service', s.name, 'pro', p.name,
                'status', case when a.status in ('cancelled', 'no_show') then a.status else coalesce(a.attributes->>'desk_status', a.status) end,
                'note', a.attributes->>'desk_note', 'name', a.customer_name) order by lower(a.span) desc)
              from public.vivo_biz_appointments(e) a left join biz_services s on s.id = a.service_id left join biz_professionals p on p.id = a.pro_id
             where public._desk_ck(a.customer_contact) = ck and a.status <> 'blocked'), '[]'::jsonb),
    'sales', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'number', s.number, 'at', s.created_at, 'total_cents', s.total_cents,
                'tip_cents', s.tip_cents, 'status', s.status,
                'items', (select string_agg(l.name, ', ') from desk_sale_lines l where l.sale_id = s.id and l.kind <> 'tip')) order by s.created_at desc)
              from desk_sales s where s.client_email = e and s.contact_key = ck), '[]'::jsonb),
    'packages', coalesce((select jsonb_agg(jsonb_build_object('id', pp.id, 'name', pk.name, 'left', pp.sessions_total - pp.sessions_used,
                'total', pp.sessions_total, 'purchased_at', pp.purchased_at) order by pp.purchased_at desc)
              from package_purchases pp left join packages pk on pk.id = pp.package_id
             where pp.client_email = e and public._desk_ck(pp.contact) = ck), '[]'::jsonb),
    'gift_cards', coalesce((select jsonb_agg(jsonb_build_object('code', g.code, 'balance_cents', g.balance_cents, 'amount_cents', g.amount_cents, 'active', g.active))
              from gift_cards g where g.client_email = e and (public._desk_ck(g.purchaser_contact) = ck or public._desk_ck(g.recipient_contact) = ck)), '[]'::jsonb),
    'forms', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'form', f.name, 'at', i.created_at, 'signed', i.answers ? 'signature') order by i.created_at desc)
              from intake_submissions i left join intake_forms f on f.id = i.form_id
             where i.client_email = e and (public._desk_ck(i.contact->>'phone') = ck or public._desk_ck(i.contact->>'email') = ck)), '[]'::jsonb),
    'totals', (select jsonb_build_object(
                'visits', count(*) filter (where a.status not in ('cancelled', 'no_show', 'blocked') and upper(a.span) < now()),
                'no_shows', count(*) filter (where a.status = 'no_show'),
                'cancellations', count(*) filter (where a.status = 'cancelled'),
                'last_visit', max(lower(a.span)) filter (where a.status not in ('cancelled', 'no_show', 'blocked') and upper(a.span) < now()),
                'next_visit', min(lower(a.span)) filter (where a.status not in ('cancelled', 'no_show', 'blocked') and lower(a.span) > now()),
                'spend_cents', (select greatest(coalesce(sum(p.amount_cents) filter (where p.method in ('cash', 'card', 'other')), 0)
                                          - coalesce((select sum(tip_cents) from desk_sales where client_email = e and contact_key = ck and status = 'paid'), 0), 0)
                                from desk_payments p join desk_sales s on s.id = p.sale_id where s.client_email = e and s.contact_key = ck and s.status = 'paid'))
              from public.vivo_biz_appointments(e) a where public._desk_ck(a.customer_contact) = ck));
end $$;

create or replace function public.desk_client_save(p_email text, p_key text, p_contact text, p_data jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); ck text := public._desk_ck(p_contact);
begin
  if ck is null then return jsonb_build_object('ok', false, 'reason', 'invalid_contact'); end if;
  insert into desk_clients (client_email, contact_key, name, phone, email, allergies, alerts, notes, trusted, can_book_online, tags, source)
  values (e, ck, left(p_data->>'name', 160), case when ck like '%@%' then null else p_contact end, case when ck like '%@%' then ck else nullif(lower(p_data->>'email'), '') end,
          left(p_data->>'allergies', 1000), left(p_data->>'alerts', 1000), left(p_data->>'notes', 4000),
          coalesce((p_data->>'trusted')::boolean, false), coalesce((p_data->>'can_book_online')::boolean, true),
          coalesce(p_data->'tags', '[]'::jsonb), coalesce(p_data->>'source', 'desk'))
  on conflict (client_email, contact_key) do update set
    name = coalesce(excluded.name, desk_clients.name),
    allergies = case when p_data ? 'allergies' then excluded.allergies else desk_clients.allergies end,
    alerts = case when p_data ? 'alerts' then excluded.alerts else desk_clients.alerts end,
    notes = case when p_data ? 'notes' then excluded.notes else desk_clients.notes end,
    trusted = case when p_data ? 'trusted' then excluded.trusted else desk_clients.trusted end,
    can_book_online = case when p_data ? 'can_book_online' then excluded.can_book_online else desk_clients.can_book_online end,
    tags = case when p_data ? 'tags' then excluded.tags else desk_clients.tags end,
    email = coalesce(excluded.email, desk_clients.email),
    updated_at = now();
  return jsonb_build_object('ok', true, 'contact_key', ck);
end $$;

-- Para a página pública e a IA: esta pessoa pode marcar sozinha? (falso só quando a recepção bloqueou)
create or replace function public.desk_can_book_online(p_tenant text, p_contact text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select coalesce((select can_book_online from desk_clients where client_email = lower(trim(p_tenant)) and contact_key = public._desk_ck(p_contact)), true)
$$;

-- ═══ EQUIPE, HORÁRIOS, SERVIÇOS, PRODUTOS ══════════════════════════════════════════════════════
create or replace function public.desk_staff_save(p_email text, p_key text, p_pro jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); v_id uuid := nullif(p_pro->>'id', '')::uuid; v uuid;
begin
  if v_id is not null and not exists (select 1 from biz_professionals where id = v_id and client_email = e) then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  if v_id is null then
    if coalesce(trim(p_pro->>'name'), '') = '' then return jsonb_build_object('ok', false, 'reason', 'name_required'); end if;
    insert into biz_professionals (client_email, name, title, active, kind, config)
      values (e, left(trim(p_pro->>'name'), 120), left(p_pro->>'title', 120), true, coalesce(nullif(p_pro->>'kind', ''), 'staff'), '{}'::jsonb)
      returning id into v_id;
  end if;
  update biz_professionals set
    name = coalesce(nullif(left(trim(p_pro->>'name'), 120), ''), name),
    title = case when p_pro ? 'title' then left(p_pro->>'title', 120) else title end,
    active = case when p_pro ? 'active' then (p_pro->>'active')::boolean else active end,
    kind = case when p_pro ? 'kind' and p_pro->>'kind' in ('staff', 'room', 'equipment', 'table', 'bay', 'agent') then p_pro->>'kind' else kind end,
    config = coalesce(config, '{}'::jsonb)
             || case when p_pro ? 'color' then jsonb_build_object('color', left(p_pro->>'color', 16)) else '{}'::jsonb end
             || case when p_pro ? 'commission_service_pct' then jsonb_build_object('commission_service_pct', least(greatest((p_pro->>'commission_service_pct')::numeric, 0), 100)) else '{}'::jsonb end
             || case when p_pro ? 'commission_product_pct' then jsonb_build_object('commission_product_pct', least(greatest((p_pro->>'commission_product_pct')::numeric, 0), 100)) else '{}'::jsonb end
  where id = v_id and client_email = e;
  if jsonb_typeof(p_pro->'services') = 'array' then
    delete from biz_pro_services where pro_id = v_id;
    insert into biz_pro_services (pro_id, service_id)
      select v_id, s.id from biz_services s where s.client_email = e and s.id::text in (select jsonb_array_elements_text(p_pro->'services'));
  end if;
  if jsonb_typeof(p_pro->'locations') = 'array' then
    delete from biz_pro_locations where pro_id = v_id;
    insert into biz_pro_locations (pro_id, location_id)
      select v_id, l.id from biz_locations l where l.client_email = e and l.id::text in (select jsonb_array_elements_text(p_pro->'locations'));
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- Horário semanal de UMA profissional numa unidade: substitui tudo daquela unidade.
-- p_hours = [{weekday 0-6 (domingo=0), start_min, end_min}] — mais de um intervalo por dia = pausa de almoço.
create or replace function public.desk_hours_set(p_email text, p_key text, p_pro_id uuid, p_location_id uuid, p_hours jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); h jsonb; n int := 0;
begin
  if not exists (select 1 from biz_professionals where id = p_pro_id and client_email = e) then return jsonb_build_object('ok', false, 'reason', 'pro_not_found'); end if;
  if not exists (select 1 from biz_locations where id = p_location_id and client_email = e) then return jsonb_build_object('ok', false, 'reason', 'location_not_found'); end if;
  for h in select * from jsonb_array_elements(coalesce(p_hours, '[]'::jsonb)) loop
    if (h->>'weekday')::int not between 0 and 6 or (h->>'start_min')::int < 0 or (h->>'end_min')::int > 1440 or (h->>'start_min')::int >= (h->>'end_min')::int then
      return jsonb_build_object('ok', false, 'reason', 'invalid_hours', 'row', h);
    end if;
  end loop;
  delete from biz_schedules where pro_id = p_pro_id and location_id = p_location_id;
  insert into biz_schedules (pro_id, location_id, weekday, start_min, end_min)
    select p_pro_id, p_location_id, (x.v->>'weekday')::int, (x.v->>'start_min')::int, (x.v->>'end_min')::int from jsonb_array_elements(coalesce(p_hours, '[]'::jsonb)) as x(v);
  get diagnostics n = row_count;
  if not exists (select 1 from biz_pro_locations where pro_id = p_pro_id and location_id = p_location_id) then
    insert into biz_pro_locations (pro_id, location_id) values (p_pro_id, p_location_id);
  end if;
  return jsonb_build_object('ok', true, 'rows', n);
end $$;

-- Folga / bloqueio / almoço avulso. Vira linha 'blocked'; o motor recusa marcar por cima.
create or replace function public.desk_block(p_email text, p_key text, p_pro_id uuid, p_location_id uuid, p_start timestamptz, p_end timestamptz, p_reason text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); v_id uuid;
begin
  if p_end <= p_start or p_end - p_start > interval '31 days' then return jsonb_build_object('ok', false, 'reason', 'invalid_range'); end if;
  if not exists (select 1 from biz_professionals where id = p_pro_id and client_email = e) then return jsonb_build_object('ok', false, 'reason', 'pro_not_found'); end if;
  begin
    insert into biz_appointments (client_email, location_id, pro_id, service_id, customer_name, customer_contact, span, status, source, attributes)
      values (e, p_location_id, p_pro_id, null, coalesce(nullif(left(p_reason, 120), ''), 'Blocked'), null, tstzrange(p_start, p_end), 'blocked', 'desk',
              jsonb_build_object('source', 'desk', 'block', true))
      returning id into v_id;
  exception when sqlstate 'GUI01' then
    return jsonb_build_object('ok', false, 'reason', 'slot_taken',
      'conflicts', (select jsonb_agg(jsonb_build_object('id', a.id, 'start', lower(a.span), 'name', a.customer_name))
                      from biz_appointments a where a.client_email = e and a.pro_id = p_pro_id and a.status <> 'cancelled' and a.span && tstzrange(p_start, p_end)));
  end;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.desk_service_save(p_email text, p_key text, p_svc jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); v_id uuid := nullif(p_svc->>'id', '')::uuid;
begin
  if v_id is not null and not exists (select 1 from biz_services where id = v_id and client_email = e) then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_id is null then
    if coalesce(trim(p_svc->>'name'), '') = '' then return jsonb_build_object('ok', false, 'reason', 'name_required'); end if;
    insert into biz_services (client_email, name, duration_min, price_cents, active) values (e, left(trim(p_svc->>'name'), 160),
      greatest(coalesce((p_svc->>'duration_min')::int, 60), 5), greatest(coalesce((p_svc->>'price_cents')::int, 0), 0), true) returning id into v_id;
  end if;
  update biz_services set
    name = coalesce(nullif(left(trim(p_svc->>'name'), 160), ''), name),
    duration_min = case when p_svc ? 'duration_min' then greatest((p_svc->>'duration_min')::int, 5) else duration_min end,
    price_cents = case when p_svc ? 'price_cents' then greatest((p_svc->>'price_cents')::int, 0) else price_cents end,
    buffer_before_min = case when p_svc ? 'buffer_before_min' then greatest((p_svc->>'buffer_before_min')::int, 0) else buffer_before_min end,
    buffer_after_min = case when p_svc ? 'buffer_after_min' then greatest((p_svc->>'buffer_after_min')::int, 0) else buffer_after_min end,
    deposit_cents = case when p_svc ? 'deposit_cents' then greatest((p_svc->>'deposit_cents')::int, 0) else deposit_cents end,
    cancel_window_h = case when p_svc ? 'cancel_window_h' then greatest((p_svc->>'cancel_window_h')::int, 0) else cancel_window_h end,
    active = case when p_svc ? 'active' then (p_svc->>'active')::boolean else active end,
    config = coalesce(config, '{}'::jsonb)
             || case when p_svc ? 'noshow_fee_cents' then jsonb_build_object('noshow_fee_cents', greatest((p_svc->>'noshow_fee_cents')::int, 0)) else '{}'::jsonb end
             || case when p_svc ? 'category' then jsonb_build_object('category', left(p_svc->>'category', 60)) else '{}'::jsonb end,
    updated_at = now()
  where id = v_id and client_email = e;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.desk_product_save(p_email text, p_key text, p_prod jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); v_id uuid := nullif(p_prod->>'id', '')::uuid;
begin
  if v_id is not null and not exists (select 1 from biz_products where id = v_id and client_email = e) then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if v_id is null then
    if coalesce(trim(p_prod->>'name'), '') = '' then return jsonb_build_object('ok', false, 'reason', 'name_required'); end if;
    insert into biz_products (client_email, name, price_cents, stock, active) values (e, left(trim(p_prod->>'name'), 160),
      greatest(coalesce((p_prod->>'price_cents')::int, 0), 0), nullif(p_prod->>'stock', '')::int, true) returning id into v_id;
  end if;
  update biz_products set
    name = coalesce(nullif(left(trim(p_prod->>'name'), 160), ''), name),
    brand = case when p_prod ? 'brand' then left(p_prod->>'brand', 120) else brand end,
    price_cents = case when p_prod ? 'price_cents' then greatest((p_prod->>'price_cents')::int, 0) else price_cents end,
    stock = case when p_prod ? 'stock' then nullif(p_prod->>'stock', '')::int else stock end,
    active = case when p_prod ? 'active' then (p_prod->>'active')::boolean else active end,
    updated_at = now()
  where id = v_id and client_email = e;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- ═══ FECHAMENTO DO DIA (ou de qualquer período até 92 dias) ════════════════════════════════════
create or replace function public.desk_day_close(p_email text, p_key text, p_from timestamptz, p_to timestamptz, p_location_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key);
begin
  if p_to <= p_from or p_to - p_from > interval '92 days' then return jsonb_build_object('ok', false, 'reason', 'invalid_range'); end if;
  return jsonb_build_object('ok', true, 'from', p_from, 'to', p_to,
    'sales', (select jsonb_build_object('count', count(*), 'gross_cents', coalesce(sum(subtotal_cents), 0), 'discount_cents', coalesce(sum(discount_cents), 0),
              'tax_cents', coalesce(sum(tax_cents), 0), 'tip_cents', coalesce(sum(tip_cents), 0), 'total_cents', coalesce(sum(total_cents), 0),
              'avg_ticket_cents', coalesce(round(avg(total_cents - tip_cents)), 0))
            from desk_sales where client_email = e and status = 'paid' and created_at >= p_from and created_at < p_to and (p_location_id is null or location_id = p_location_id)),
    -- dinheiro que ENTROU x pré-pago RESGATADO: o pacote/vale já entrou no dia em que foi vendido
    'collected_cents', (select coalesce(sum(p.amount_cents), 0) from desk_payments p join desk_sales s on s.id = p.sale_id
              where s.client_email = e and s.status = 'paid' and p.method in ('cash', 'card', 'other') and s.created_at >= p_from and s.created_at < p_to and (p_location_id is null or s.location_id = p_location_id)),
    'redeemed_cents', (select coalesce(sum(p.amount_cents), 0) from desk_payments p join desk_sales s on s.id = p.sale_id
              where s.client_email = e and s.status = 'paid' and p.method in ('gift_card', 'package') and s.created_at >= p_from and s.created_at < p_to and (p_location_id is null or s.location_id = p_location_id)),
    'voided', (select count(*) from desk_sales where client_email = e and status = 'void' and created_at >= p_from and created_at < p_to and (p_location_id is null or location_id = p_location_id)),
    'by_method', coalesce((select jsonb_object_agg(method, cents) from (select p.method, sum(p.amount_cents) cents from desk_payments p join desk_sales s on s.id = p.sale_id
              where s.client_email = e and s.status = 'paid' and s.created_at >= p_from and s.created_at < p_to and (p_location_id is null or s.location_id = p_location_id) group by p.method) m), '{}'::jsonb),
    'by_kind', coalesce((select jsonb_object_agg(kind, cents) from (select l.kind, sum(l.total_cents) cents from desk_sale_lines l join desk_sales s on s.id = l.sale_id
              where s.client_email = e and s.status = 'paid' and s.created_at >= p_from and s.created_at < p_to and (p_location_id is null or s.location_id = p_location_id) group by l.kind) k), '{}'::jsonb),
    'by_pro', coalesce((select jsonb_agg(jsonb_build_object('pro_id', pro_id, 'name', (select name from biz_professionals where id = pro_id),
                'services_cents', coalesce(sv, 0), 'products_cents', coalesce(pr, 0), 'tips_cents', coalesce(tp, 0), 'commission_cents', coalesce(cm, 0)) order by coalesce(sv, 0) + coalesce(pr, 0) desc)
              from (select l.pro_id, sum(l.total_cents) filter (where l.kind = 'service') sv, sum(l.total_cents) filter (where l.kind = 'product') pr,
                           sum(l.total_cents) filter (where l.kind = 'tip') tp, sum(l.commission_cents) cm
                      from desk_sale_lines l join desk_sales s on s.id = l.sale_id
                     where s.client_email = e and s.status = 'paid' and s.created_at >= p_from and s.created_at < p_to and l.pro_id is not null
                       and (p_location_id is null or s.location_id = p_location_id) group by l.pro_id) x), '[]'::jsonb),
    'appointments', (select jsonb_build_object(
                'booked', count(*) filter (where a.status <> 'blocked'),
                'completed', count(*) filter (where a.attributes->>'desk_status' = 'completed'),
                'no_show', count(*) filter (where a.status = 'no_show'),
                'cancelled', count(*) filter (where a.status = 'cancelled'),
                'unpaid_completed', count(*) filter (where a.attributes->>'desk_status' = 'completed' and not (a.attributes ? 'sale_id')),
                'booked_minutes', coalesce(sum(extract(epoch from upper(a.span) - lower(a.span)) / 60) filter (where a.status not in ('cancelled', 'blocked', 'no_show')), 0))
              from public.vivo_biz_appointments(e) a where a.span && tstzrange(p_from, p_to) and (p_location_id is null or a.location_id = p_location_id)),
    'list', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'number', s.number, 'at', s.created_at, 'customer', s.customer_name, 'total_cents', s.total_cents,
                'tip_cents', s.tip_cents, 'status', s.status,
                'methods', (select string_agg(distinct p.method, '+') from desk_payments p where p.sale_id = s.id)) order by s.created_at desc)
              from desk_sales s where s.client_email = e and s.created_at >= p_from and s.created_at < p_to and (p_location_id is null or s.location_id = p_location_id)), '[]'::jsonb));
end $$;

-- ═══ FORMULÁRIO PÚBLICO (/f/<id>): o cliente final vê nome e campos — nada mais ═══════════════
create or replace function public.intake_form_public(p_form_id uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object('ok', true, 'id', f.id, 'name', f.name, 'fields', coalesce(f.fields, '[]'::jsonb),
           'business', coalesce((select tokens->>'business_name' from client_integrations where client_email = f.client_email and provider = 'profile' limit 1), ''))
    from intake_forms f where f.id = p_form_id and coalesce(f.active, true)
$$;

-- ═══ IMPORTAÇÃO DO MINDBODY / BOOKER (planilhas que a própria dona exporta) ════════════════════
-- Clientes: [{name, phone, email, birthday, notes, allergies}] → crm_contacts + desk_clients. Não apaga nada.
create or replace function public.desk_import_clients(p_email text, p_key text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); r jsonb; ck text; ph text; em text; novos int := 0; atual int := 0; pulados int := 0; v_id uuid;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) > 5000 then return jsonb_build_object('ok', false, 'reason', 'too_many_rows'); end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    ph := nullif(regexp_replace(coalesce(r->>'phone', ''), '\D', '', 'g'), ''); em := nullif(lower(trim(coalesce(r->>'email', ''))), '');
    if em is not null and em not like '%@%' then em := null; end if;
    if ph is not null and length(ph) < 7 then ph := null; end if;
    ck := coalesce(public._desk_ck(ph), em);
    if ck is null then pulados := pulados + 1; continue; end if;
    v_id := null;   -- sem isto, uma linha sem par herdava o contato da linha anterior
    select id into v_id from crm_contacts where client_email = e and ((ph is not null and phone_key = right(ph, 10)) or (em is not null and lower(email) = em)) limit 1;
    if v_id is null then
      begin
        insert into crm_contacts (client_email, phone, email, full_name, lifecycle, lead_source, birth_date, first_seen_at, created_at, updated_at)
          values (e, case when ph is null then null when length(ph) = 10 then '+1' || ph else '+' || ph end, em, left(r->>'name', 160), 'customer', 'mindbody_import',
                  (nullif(r->>'birthday', ''))::date, now(), now(), now());
        novos := novos + 1;
      -- ⚠️ phone_key é coluna GERADA pelo banco: gravá-la à mão falhava e, engolida aqui, pulava
      -- TODA cliente da importação em silêncio (achado no teste de 2026-10-05).
      exception when others then pulados := pulados + 1; continue;
      end;
    else
      begin
        update crm_contacts set full_name = coalesce(full_name, left(r->>'name', 160)), email = coalesce(email, em),
               birth_date = coalesce(birth_date, (nullif(r->>'birthday', ''))::date), updated_at = now() where id = v_id;
      exception when others then null;   -- e-mail já usado por outro contato: mantém o que havia
      end;
      atual := atual + 1;
    end if;
    if coalesce(r->>'notes', '') <> '' or coalesce(r->>'allergies', '') <> '' then
      perform public.desk_client_save(p_email, p_key, coalesce(ph, em),
        jsonb_strip_nulls(jsonb_build_object('name', r->>'name', 'email', em, 'notes', nullif(r->>'notes', ''), 'allergies', nullif(r->>'allergies', ''), 'source', 'mindbody_import')));
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'created', novos, 'updated', atual, 'skipped', pulados);
end $$;

-- Agenda futura: [{start (ISO com fuso), end?, service, pro, location?, name, contact, external_ref?}]
-- Casa nome de serviço/profissional/unidade com o cadastro (sem diferenciar maiúscula). O que não
-- casa volta na lista 'unmatched' para a recepção resolver — nunca entra pela metade.
create or replace function public.desk_import_appointments(p_email text, p_key text, p_rows jsonb, p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); r jsonb; v_svc biz_services; v_pro uuid; v_loc uuid; v_ini timestamptz; v_fim timestamptz;
        ok int := 0; dup int := 0; choque int := 0; fora jsonb := '[]'::jsonb; v_ref text;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) > 5000 then return jsonb_build_object('ok', false, 'reason', 'too_many_rows'); end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    begin v_ini := (r->>'start')::timestamptz; exception when others then v_ini := null; end;
    v_svc := null; v_pro := null; v_loc := null;
    select * into v_svc from biz_services where client_email = e and lower(trim(name)) = lower(trim(coalesce(r->>'service', ''))) limit 1;
    select id into v_pro from biz_professionals where client_email = e and lower(trim(name)) = lower(trim(coalesce(r->>'pro', ''))) limit 1;
    select id into v_loc from biz_locations where client_email = e and (coalesce(r->>'location', '') = '' or lower(trim(name)) = lower(trim(r->>'location'))) order by created_at limit 1;
    if v_ini is null or v_svc.id is null or v_pro is null then
      fora := fora || jsonb_build_array(r || jsonb_build_object('why', concat_ws(',', case when v_ini is null then 'start' end, case when v_svc.id is null then 'service' end, case when v_pro is null then 'pro' end)));
      continue;
    end if;
    v_fim := coalesce(nullif(r->>'end', '')::timestamptz, v_ini + make_interval(mins => coalesce(v_svc.duration_min, 60)));
    v_ref := coalesce(nullif(r->>'external_ref', ''), md5(lower(coalesce(r->>'contact', '')) || v_ini::text || v_pro::text));
    if exists (select 1 from biz_appointments where client_email = e and source = 'mindbody' and external_ref = v_ref) then dup := dup + 1; continue; end if;
    if p_dry_run then
      if exists (select 1 from biz_appointments a where a.client_email = e and a.pro_id = v_pro and a.status <> 'cancelled' and a.span && tstzrange(v_ini, v_fim)) then choque := choque + 1;
      else ok := ok + 1; end if;
      continue;
    end if;
    begin
      insert into biz_appointments (client_email, location_id, pro_id, service_id, customer_name, customer_contact, span, status, source, external_ref, attributes)
        values (e, v_loc, v_pro, v_svc.id, left(r->>'name', 160), left(r->>'contact', 160), tstzrange(v_ini, v_fim), 'booked', 'mindbody', v_ref,
                jsonb_build_object('source', 'mindbody', 'imported_at', now()));
      ok := ok + 1;
    exception when sqlstate 'GUI01' or sqlstate 'GUI02' then choque := choque + 1;
    end;
  end loop;
  return jsonb_build_object('ok', true, 'dry_run', p_dry_run, 'imported', ok, 'duplicates', dup, 'conflicts', choque, 'unmatched', fora);
end $$;

-- ═══ PERMISSÕES ════════════════════════════════════════════════════════════════════════════════
do $g$
declare f text;
begin
  foreach f in array array[
    'desk_set_status(text,text,uuid,text)', 'desk_agenda(text,text,timestamptz,timestamptz)', 'desk_catalog(text,text)',
    'desk_checkout(text,text,jsonb)', 'desk_void_sale(text,text,uuid,text)', 'desk_sale_get(text,text,uuid)',
    'desk_receipt_mark(text,text,uuid,text,text)', 'desk_client_search(text,text,text)', 'desk_client_card(text,text,text)',
    'desk_client_save(text,text,text,jsonb)', 'desk_staff_save(text,text,jsonb)', 'desk_hours_set(text,text,uuid,uuid,jsonb)',
    'desk_block(text,text,uuid,uuid,timestamptz,timestamptz,text)', 'desk_service_save(text,text,jsonb)', 'desk_product_save(text,text,jsonb)',
    'desk_day_close(text,text,timestamptz,timestamptz,uuid)', 'desk_import_clients(text,text,jsonb)', 'desk_import_appointments(text,text,jsonb,boolean)'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
  end loop;
  execute 'revoke all on function public.intake_form_public(uuid) from public';
  execute 'grant execute on function public.intake_form_public(uuid) to anon, authenticated, service_role';
  execute 'revoke all on function public.desk_can_book_online(text,text) from public, anon, authenticated';
  execute 'grant execute on function public.desk_can_book_online(text,text) to service_role';
  execute 'revoke all on function public._desk_ck(text) from public, anon, authenticated';
end $g$;

-- ═══ SINAL (depósito) PAGO PELO STRIPE DO NEGÓCIO ══════════════════════════════════════════════
-- O link nasce em /api/desk action "deposit_link" (valor do CADASTRO do serviço); o webhook do
-- Stripe (metadata guileo=desk_deposit) chama desk_deposit_mark com a chave do servidor.
create or replace function public.desk_deposit_mark(p_tenant text, p_appointment_id uuid, p_session text, p_cents bigint)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  update biz_appointments set attributes = coalesce(attributes, '{}'::jsonb) || jsonb_build_object('deposit_paid', true, 'deposit_cents', p_cents,
         'deposit_session', left(p_session, 120), 'deposit_paid_at', now())
   where id = p_appointment_id and client_email = lower(trim(p_tenant));
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n = 1);
end $$;
revoke all on function public.desk_deposit_mark(text, uuid, text, bigint) from public, anon, authenticated;
grant execute on function public.desk_deposit_mark(text, uuid, text, bigint) to service_role;

create or replace function public.desk_deposit_info(p_email text, p_key text, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key);
begin
  return coalesce((select jsonb_build_object('ok', true, 'id', a.id, 'customer_name', a.customer_name, 'customer_contact', a.customer_contact,
            'start', lower(a.span), 'service', s.name, 'deposit_cents', coalesce(nullif(s.deposit_cents, 0), round(coalesce(s.price_cents, 0) * coalesce(s.deposit_pct, 0) / 100.0)::int, 0),
            'noshow_fee_cents', (s.config->>'noshow_fee_cents')::int, 'deposit_paid', coalesce((a.attributes->>'deposit_paid')::boolean, false),
            'trusted', coalesce((select c.trusted from desk_clients c where c.client_email = e and c.contact_key = public._desk_ck(a.customer_contact)), false))
          from biz_appointments a left join biz_services s on s.id = a.service_id where a.id = p_id and a.client_email = e),
         jsonb_build_object('ok', false, 'reason', 'not_found'));
end $$;
revoke all on function public.desk_deposit_info(text, text, uuid) from public;
grant execute on function public.desk_deposit_info(text, text, uuid) to anon, authenticated, service_role;

-- ═══ SINAL PEDIDO PELA IA (2026-10-05) ═════════════════════════════════════════════════════════
-- Quando a Lilian marca um serviço com sinal, o servidor gera o link e manda (lib/sinal.js).
create or replace function public.desk_deposit_info_svc(p_tenant text, p_id uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce((select jsonb_build_object('ok', true, 'id', a.id, 'customer_name', a.customer_name, 'customer_contact', a.customer_contact,
            'start', lower(a.span), 'service', s.name, 'status', a.status,
            'deposit_cents', coalesce(nullif(s.deposit_cents, 0), round(coalesce(s.price_cents, 0) * coalesce(s.deposit_pct, 0) / 100.0)::int, 0),
            'deposit_paid', coalesce((a.attributes->>'deposit_paid')::boolean, false),
            'deposit_link_sent_at', a.attributes->>'deposit_link_sent_at',
            'trusted', coalesce((select c.trusted from desk_clients c where c.client_email = a.client_email and c.contact_key = public._desk_ck(a.customer_contact)), false))
          from biz_appointments a left join biz_services s on s.id = a.service_id
         where a.id = p_id and a.client_email = lower(trim(p_tenant))),
         jsonb_build_object('ok', false, 'reason', 'not_found'))
$$;
revoke all on function public.desk_deposit_info_svc(text, uuid) from public, anon, authenticated;
grant execute on function public.desk_deposit_info_svc(text, uuid) to service_role;

create or replace function public.desk_deposit_link_mark(p_tenant text, p_id uuid, p_canal text, p_envio text, p_session text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  update biz_appointments set attributes = coalesce(attributes, '{}'::jsonb) || jsonb_build_object('deposit_link_sent_at', now(),
         'deposit_link_canal', left(p_canal, 20), 'deposit_link_envio', left(p_envio, 120), 'deposit_link_session', left(p_session, 120))
   where id = p_id and client_email = lower(trim(p_tenant));
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n = 1);
end $$;
revoke all on function public.desk_deposit_link_mark(text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.desk_deposit_link_mark(text, uuid, text, text, text) to service_role;

-- ═══ STRIPE PRÓPRIO DO NEGÓCIO (2026-10-05) — aplicado como desk_v2_13_stripe_proprio ═══════════
-- Plataforma Stripe da Guileo = BR; o Stripe não repassa de BR para conta nos EUA. O negócio cola uma
-- chave RESTRITA; só o SINAL usa (lib/contaDoCliente.js contaParaSinal). Definições completas:
-- stripe_own_save(email,key,secret_key,meta) · stripe_own_status(email,key) [nunca devolve a chave] ·
-- stripe_own_lookup_svc(tenant) [só service_role] · desk_deposit_pending_svc() [só service_role].
-- (texto integral no histórico de migrações do Supabase: desk_v2_13_stripe_proprio)

-- ═══ PARALELO COM O MINDBODY E DESATIVADOS (2026-10-05) — desk_v2_14 ═══════════════════════════
-- desk_import_appointments passou a gravar reminded=true, review_asked=true e reminders_by='mindbody'
-- (o MindBody ainda manda o lembrete dele; a cliente não recebe dois).
create or replace function public.desk_take_over_reminders(p_email text, p_key text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); n int;
begin
  update biz_appointments set reminded = false, review_asked = false,
         attributes = (coalesce(attributes, '{}'::jsonb) - 'reminders_by') || jsonb_build_object('reminders_taken_over_at', now())
   where client_email = e and attributes->>'reminders_by' = 'mindbody' and lower(span) > now() and status = 'booked';
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'appointments', n);
end $$;
revoke all on function public.desk_take_over_reminders(text, text) from public;
grant execute on function public.desk_take_over_reminders(text, text) to anon, authenticated, service_role;

create or replace function public.desk_inactive(p_email text, p_key text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key);
begin
  return jsonb_build_object('ok', true,
    'pros', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'title', title, 'kind', coalesce(kind, 'staff')) order by name) from biz_professionals where client_email = e and active is false), '[]'::jsonb),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'duration_min', duration_min, 'price_cents', price_cents) order by name) from biz_services where client_email = e and active is false), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'price_cents', price_cents, 'stock', stock) order by name) from biz_products where client_email = e and active is false), '[]'::jsonb));
end $$;
revoke all on function public.desk_inactive(text, text) from public;
grant execute on function public.desk_inactive(text, text) to anon, authenticated, service_role;
