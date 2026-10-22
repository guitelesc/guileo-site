-- GUILEO DESK v13 — Validade e ativação dos pacotes; serviço que debita mais de uma sessão (2026-10-21, Onda 1 item 6)
-- No MindBody a "pricing option" tem Count, ActiveDate/ExpirationDate, ativação na compra ou na 1ª visita e, por
-- serviço, NumDeducted (quantas sessões uma visita desconta). O Desk tinha só sessions_total/sessions_used.
--
--   1. PACOTE (packages): valid_days (null = não vence) e activation ('purchase' | 'first_visit').
--   2. COMPRA (package_purchases): RETRATO valid_days/activation + activated_at/expires_at. Um gatilho BEFORE INSERT
--      carimba a compra venha de onde vier (caixa, link Stripe, importação): ativa na hora se activation='purchase'.
--      Mudar o pacote depois NÃO mexe no que a cliente já comprou.
--   3. RESGATE (desk_checkout, pagamento method='package'): vencido → package_expired (detail = data); ainda não
--      ativado → ativa agora (1ª visita) e calcula expires_at; debita N sessões do serviço pago (pagamento traz
--      service_id; N = biz_services.config.pkg_sessions, padrão 1); faltam sessões → package_short (detail = restam/precisa).
--      package_use (link público / API) ganha as mesmas regras.
--   4. SERVIÇO: desk_service_save aceita pkg_sessions (1..20) em config; a agenda devolve services[].pkg_sessions.
--   5. desk_package_edit(email,key,id,{expires_at}) — só a dona: estende/encurta a validade de UMA compra (null = sem vencimento).
--   6. Ficha (desk_client_card.packages[]), catálogo (desk_catalog.packages[]) e exportação (balances) mostram
--      activation, activated_at, expires_at e status ('active' | 'not_activated' | 'expired' | 'exhausted').
-- Idempotente: add column if not exists / create or replace / patches textuais que se reconhecem.

alter table packages add column if not exists valid_days int check (valid_days is null or (valid_days >= 1 and valid_days <= 3650));
alter table packages add column if not exists activation text not null default 'purchase' check (activation in ('purchase', 'first_visit'));
alter table package_purchases add column if not exists valid_days int;
alter table package_purchases add column if not exists activation text;
alter table package_purchases add column if not exists activated_at timestamptz;
alter table package_purchases add column if not exists expires_at timestamptz;

-- Compras antigas: tudo era "ativa na compra, sem vencimento".
update package_purchases set activation = 'purchase', activated_at = coalesce(activated_at, purchased_at, now()) where activation is null;

-- Estado de uma compra, com a mesma régua em toda parte.
create or replace function public._desk_pp_status(pp package_purchases)
returns text language sql stable as $$
  select case
    when pp.expires_at is not null and pp.expires_at < now() then 'expired'
    when pp.sessions_used >= pp.sessions_total then 'exhausted'
    when pp.activated_at is null then 'not_activated'
    else 'active' end
$$;
revoke all on function public._desk_pp_status(package_purchases) from public, anon, authenticated;

-- Gatilho: toda compra nova herda validade e ativação do pacote (retrato) e, se ativa na compra, já nasce ativada.
create or replace function public._desk_pp_before_insert()
returns trigger language plpgsql as $$
declare pk packages;
begin
  select * into pk from packages where id = new.package_id;
  if new.valid_days is null and pk.id is not null then new.valid_days := pk.valid_days; end if;
  if new.activation is null then new.activation := coalesce(pk.activation, 'purchase'); end if;
  if new.activation = 'purchase' and new.activated_at is null then new.activated_at := coalesce(new.purchased_at, now()); end if;
  if new.activated_at is not null and new.expires_at is null and new.valid_days is not null then
    new.expires_at := new.activated_at + make_interval(days => new.valid_days);
  end if;
  return new;
end $$;
drop trigger if exists desk_pp_before_insert on package_purchases;
create trigger desk_pp_before_insert before insert on package_purchases for each row execute function public._desk_pp_before_insert();

-- Resgate: a régua única (vencido? ativa agora? faltam sessões?) usada pelo caixa e pelo package_use.
-- Devolve a compra já debitada; lança GUI13 com a razão no texto (quem chama traduz, como as outras).
create or replace function public._desk_pp_redeem(p_email text, p_id uuid, p_n int)
returns package_purchases language plpgsql as $$
declare v package_purchases; n int := greatest(coalesce(p_n, 1), 1);
begin
  select * into v from package_purchases where id = p_id and client_email = p_email for update;
  if v.id is null then raise exception 'package_empty' using errcode = 'GUI13'; end if;
  if v.expires_at is not null and v.expires_at < now() then
    raise exception 'package_expired:%', to_char(v.expires_at at time zone 'UTC', 'YYYY-MM-DD') using errcode = 'GUI13';
  end if;
  if v.sessions_used >= v.sessions_total then raise exception 'package_empty' using errcode = 'GUI13'; end if;
  if v.sessions_total - v.sessions_used < n then
    raise exception 'package_short:%/%', v.sessions_total - v.sessions_used, n using errcode = 'GUI13';
  end if;
  update package_purchases set sessions_used = sessions_used + n,
    activated_at = coalesce(activated_at, now()),
    expires_at = case when activated_at is null and valid_days is not null then now() + make_interval(days => valid_days) else expires_at end
    where id = v.id returning * into v;
  return v;
end $$;
revoke all on function public._desk_pp_redeem(text, uuid, int) from public, anon, authenticated;

-- desk_checkout: troca SÓ o bloco do resgate (patch textual, roda uma vez). O pagamento pode trazer service_id;
-- N = config.pkg_sessions daquele serviço (padrão 1). Sem service_id, debita 1 como antes.
do $p$
declare d text := pg_get_functiondef('public.desk_checkout(text,text,jsonb)'::regprocedure); n text;
begin
  if position('_desk_pp_redeem' in d) > 0 then return; end if;
  n := replace(d,
    E'      select * into v_pp from package_purchases where id = (pg->>\'ref\')::uuid and client_email = e for update;\n' ||
    E'      if v_pp.id is null or v_pp.sessions_used >= v_pp.sessions_total then raise exception \'package_empty\' using errcode = \'GUI13\'; end if;\n' ||
    E'      update package_purchases set sessions_used = sessions_used + 1 where id = v_pp.id;',
    E'      v_pp := public._desk_pp_redeem(e, (pg->>\'ref\')::uuid, coalesce((select (s.config->>\'pkg_sessions\')::int from biz_services s\n' ||
    E'                where s.id = nullif(pg->>\'service_id\', \'\')::uuid and s.client_email = e), 1));');
  if n = d then raise exception 'desk_v13: bloco do resgate não encontrado em desk_checkout — nada alterado'; end if;
  execute n;
end $p$;

-- package_use (link público / API de pacotes): mesma régua, 1 sessão.
create or replace function public.package_use(p_secret text, p_client_email text, p_purchase_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v package_purchases; e text := lower(trim(p_client_email));
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350','glo_ing_c7f2a9e4b8d16350') then raise exception 'unauthorized' using errcode = '28000'; end if;
  begin
    v := public._desk_pp_redeem(e, p_purchase_id, 1);
  exception when sqlstate 'GUI13' then
    select * into v from package_purchases where id = p_purchase_id and client_email = e limit 1;
    if v.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
    return jsonb_build_object('ok', false, 'reason', case when split_part(sqlerrm, ':', 1) = 'package_expired' then 'expired' else 'exhausted' end,
      'sessions_left', greatest(v.sessions_total - v.sessions_used, 0), 'expires_at', v.expires_at);
  end;
  return jsonb_build_object('ok', true, 'sessions_left', greatest(v.sessions_total - v.sessions_used, 0), 'purchase', to_jsonb(v));
end $function$;

-- Pacote: cadastro ganha valid_days e activation (API de pacotes / Recorrente).
create or replace function public.package_upsert(p_secret text, p_client_email text, p_package jsonb)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare v_tenant text := lower(trim(p_client_email)); v_id uuid := nullif(p_package->>'id','')::uuid; v_name text := nullif(trim(coalesce(p_package->>'name','')),'');
        v_days int := case when p_package ? 'valid_days' then nullif(p_package->>'valid_days', '')::int end;
        v_act text := case when p_package ? 'activation' then p_package->>'activation' end;
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350','glo_ing_c7f2a9e4b8d16350') then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_name is null then raise exception 'name required'; end if;
  if v_days is not null and (v_days < 1 or v_days > 3650) then raise exception 'invalid_valid_days' using errcode = 'GUI12'; end if;
  if v_act is not null and v_act not in ('purchase', 'first_visit') then raise exception 'invalid_activation' using errcode = 'GUI12'; end if;
  if v_id is not null then
    update public.packages set name=v_name, service=coalesce(p_package->>'service',service), sessions=coalesce((p_package->>'sessions')::int,sessions),
      price_cents=coalesce((p_package->>'price_cents')::int,price_cents), active=coalesce((p_package->>'active')::boolean,active),
      valid_days = case when p_package ? 'valid_days' then v_days else valid_days end,
      activation = coalesce(v_act, activation)
      where id=v_id and client_email=v_tenant;
    return v_id;
  end if;
  insert into public.packages (client_email, name, service, sessions, price_cents, active, valid_days, activation)
    values (v_tenant, v_name, p_package->>'service', coalesce((p_package->>'sessions')::int,1), coalesce((p_package->>'price_cents')::int,0),
            coalesce((p_package->>'active')::boolean,true), v_days, coalesce(v_act, 'purchase')) returning id into v_id;
  return v_id;
end $function$;

create or replace function public.package_list(p_secret text, p_client_email text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350','glo_ing_c7f2a9e4b8d16350') then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'service',p.service,'sessions',p.sessions,'price_cents',p.price_cents,
    'active',p.active,'created_at',p.created_at,'valid_days',p.valid_days,'activation',p.activation,
    'purchases',coalesce((select count(*) from public.package_purchases pp where pp.package_id=p.id and public._desk_pp_status(pp) in ('active','not_activated')),0)) order by p.created_at desc)
    from public.packages p where p.client_email = lower(trim(p_client_email))), '[]'::jsonb);
end $function$;

-- desk_catalog: packages[] ganha valid_days e activation (patch textual, roda uma vez).
do $p$
declare d text := pg_get_functiondef('public.desk_catalog(text,text)'::regprocedure); n text;
begin
  if position('''valid_days'', valid_days' in d) > 0 then return; end if;
  n := replace(d, E'''price_cents'', price_cents) order by name) from packages', E'''price_cents'', price_cents, ''valid_days'', valid_days, ''activation'', activation) order by name) from packages');
  if n = d then raise exception 'desk_v13: packages do catálogo não encontrado em desk_catalog — nada alterado'; end if;
  execute n;
end $p$;

-- desk_client_card: packages[] ganha activation, activated_at, expires_at, status (patch textual, roda uma vez).
do $p$
declare d text := pg_get_functiondef('public.desk_client_card(text,text,text)'::regprocedure); n text;
begin
  if position('_desk_pp_status' in d) > 0 then return; end if;
  n := replace(d, E'''total'', pp.sessions_total, ''purchased_at'', pp.purchased_at) order by pp.purchased_at desc)',
    E'''total'', pp.sessions_total, ''purchased_at'', pp.purchased_at, ''activation'', pp.activation, ''activated_at'', pp.activated_at,\n' ||
    E'                ''expires_at'', pp.expires_at, ''status'', public._desk_pp_status(pp)) order by pp.purchased_at desc)');
  if n = d then raise exception 'desk_v13: packages da ficha não encontrado em desk_client_card — nada alterado'; end if;
  execute n;
end $p$;

-- desk_export (balances): status real do pacote + datas (patch textual, roda uma vez).
do $p$
declare d text := pg_get_functiondef('public.desk_export(text,text,text,integer,integer)'::regprocedure); n text;
begin
  if position('_desk_pp_status' in d) > 0 then return; end if;
  n := replace(d, E'null::bigint as valor, null::bigint as saldo, null::text as status, pp.purchased_at as desde',
    E'null::bigint as valor, null::bigint as saldo, public._desk_pp_status(pp) as status, pp.purchased_at as desde, pp.activated_at as ativado_em, pp.expires_at as vence_em');
  if n = d then raise exception 'desk_v13: saldos de pacote não encontrados em desk_export — nada alterado'; end if;
  n := replace(n, E'null, null, null, g.amount_cents, g.balance_cents, case when g.active then ''active'' else ''inactive'' end, g.created_at',
    E'null, null, null, g.amount_cents, g.balance_cents, case when g.active then ''active'' else ''inactive'' end, g.created_at, null::timestamptz, null::timestamptz');
  n := replace(n, E'select ''membership'', ms.contact, m.name, null, null, null, null, m.price_cents, null, ms.status, ms.started_at',
    E'select ''membership'', ms.contact, m.name, null, null, null, null, m.price_cents, null, ms.status, ms.started_at, null::timestamptz, null::timestamptz');
  n := replace(n, E'''amount_cents'', valor, ''balance_cents'', saldo, ''status'', status, ''since'', desde) order by tipo, desde)',
    E'''amount_cents'', valor, ''balance_cents'', saldo, ''status'', status, ''since'', desde, ''activated_at'', ativado_em, ''expires_at'', vence_em) order by tipo, desde)');
  if position('vence_em) order by' in n) = 0 then raise exception 'desk_v13: linha de saída dos saldos não encontrada em desk_export — nada alterado'; end if;
  execute n;
end $p$;

-- desk_agenda: services[] ganha pkg_sessions (patch textual, roda uma vez).
do $p$
declare d text := pg_get_functiondef('public.desk_agenda(text,text,timestamptz,timestamptz)'::regprocedure); n text;
begin
  if position('pkg_sessions' in d) > 0 then return; end if;
  n := replace(d, E'''category'', s.config->>''category'')\n', E'''category'', s.config->>''category'', ''pkg_sessions'', greatest(coalesce((s.config->>''pkg_sessions'')::int, 1), 1))\n');
  if n = d then raise exception 'desk_v13: services da agenda não encontrado em desk_agenda — nada alterado'; end if;
  execute n;
end $p$;

-- desk_service_save: aceita pkg_sessions (1..20) em config (patch textual, roda uma vez).
do $p$
declare d text := pg_get_functiondef('public.desk_service_save(text,text,jsonb)'::regprocedure); n text;
begin
  if position('pkg_sessions' in d) > 0 then return; end if;
  n := replace(d, E'             || case when p_svc ? ''addon'' then jsonb_build_object(''addon'', v_addon) else ''{}''::jsonb end,',
    E'             || case when p_svc ? ''addon'' then jsonb_build_object(''addon'', v_addon) else ''{}''::jsonb end\n' ||
    E'             || case when p_svc ? ''pkg_sessions'' then jsonb_build_object(''pkg_sessions'', least(greatest(coalesce((p_svc->>''pkg_sessions'')::int, 1), 1), 20)) else ''{}''::jsonb end,');
  if n = d then raise exception 'desk_v13: bloco do config não encontrado em desk_service_save — nada alterado'; end if;
  execute n;
end $p$;

-- Estender / encurtar a validade de uma compra (só a dona; null = sem vencimento). Não mexe em sessões.
create or replace function public.desk_package_edit(p_email text, p_key text, p_id uuid, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare e text := public._desk_ok(p_email, p_key); v package_purchases; v_exp timestamptz;
begin
  select * into v from package_purchases where id = p_id and client_email = e for update;
  if v.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if not (p_patch ? 'expires_at') then return jsonb_build_object('ok', false, 'reason', 'nothing_to_change'); end if;
  if nullif(p_patch->>'expires_at', '') is not null then
    begin v_exp := (p_patch->>'expires_at')::timestamptz; exception when others then return jsonb_build_object('ok', false, 'reason', 'invalid_date'); end;
  end if;
  update package_purchases set expires_at = v_exp,
    -- dar validade a uma compra ainda não ativada = ativar agora (senão a data não teria de onde contar)
    activated_at = case when v_exp is not null then coalesce(activated_at, now()) else activated_at end
    where id = v.id returning * into v;
  return jsonb_build_object('ok', true, 'id', v.id, 'expires_at', v.expires_at, 'activated_at', v.activated_at, 'status', public._desk_pp_status(v));
end $function$;
revoke all on function public.desk_package_edit(text, text, uuid, jsonb) from public;
grant execute on function public.desk_package_edit(text, text, uuid, jsonb) to anon, authenticated, service_role;
