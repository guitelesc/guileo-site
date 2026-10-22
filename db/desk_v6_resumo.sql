-- GUILEO DESK v6 · "☀️ Um resumo para você, toda manhã" (2026-10-05). Promessa da apresentação do Natura.
-- Aplicado pela migração desk_v6_2_resumo_manha. Só ACRESCENTA; nenhuma função ou tabela existente muda.
--
-- O QUE É: um e-mail OPT-IN para a dona do negócio, por volta das 7h NO FUSO DO NEGÓCIO, com a agenda de
-- hoje por unidade, clientes com alerta (alergia etc.), sinais pendentes, os números de ontem, a fila de
-- espera e o link para abrir o Desk. Quem manda: functions/api/resumo-manha.js (cron-tick, bloco da hora).
--
-- 🚨 PADRÃO = DESLIGADO PARA TODO MUNDO. Linha ausente em desk_avisos = não recebe. Esta migração não
-- liga para ninguém — só a própria dona liga, na tela Equipe e serviços → "Avisos para você".
--
-- HONESTIDADE: desk_resumo_dados_svc devolve NULL/lista vazia onde não há dado — o e-mail OMITE a seção.
-- Zero só aparece quando é medida de verdade (ex.: houve agenda ontem e ninguém faltou).
--
-- IDEMPOTÊNCIA: desk_resumo_envios tem índice único (client_email, dia_local) para tipo='auto'. Quem ganha
-- a reserva manda; o resto não. Falhou → estado 'falhou' e a mesma hora pode tentar de novo (até 3 vezes).
-- "Enviado" só com o id da Resend (desk_resumo_marcar_svc recusa 'enviado' sem resend_id).
--
-- PORTAS: desk_avisos_get / desk_avisos_set / desk_resumo_teste_reservar → _desk_ok (e-mail + chave),
-- grant anon/authenticated/service_role como o resto do Desk. *_svc → SÓ service_role (devolvem dado de
-- cliente final de qualquer tenant e não pedem chave).

-- ═══ TABELAS ═══════════════════════════════════════════════════════════════════════════════════
create table if not exists public.desk_avisos (
  client_email text primary key,
  resumo_manha boolean not null default false,
  hora int not null default 7 check (hora between 0 and 23),
  email_destino text check (email_destino is null or email_destino ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  lang text check (lang is null or lang in ('pt', 'en', 'es', 'hi')),
  updated_at timestamptz not null default now()
);

create table if not exists public.desk_resumo_envios (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,
  dia_local date not null,
  tipo text not null check (tipo in ('auto', 'teste')),
  estado text not null default 'reservado' check (estado in ('reservado', 'enviado', 'falhou')),
  tentativas int not null default 1,
  para text,
  resend_id text,
  motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists desk_resumo_envios_auto_dia on public.desk_resumo_envios (client_email, dia_local) where tipo = 'auto';
create index if not exists desk_resumo_envios_email_at on public.desk_resumo_envios (client_email, created_at desc);

alter table public.desk_avisos enable row level security;
alter table public.desk_resumo_envios enable row level security;
revoke all on public.desk_avisos, public.desk_resumo_envios from anon, authenticated;

-- fuso do negócio = fuso da 1ª unidade ativa (a mesma regra da tela do Desk); sem unidade, Nova York.
create or replace function public._desk_tz(p_email text)
returns text language sql stable security definer set search_path to 'public' as $$
  select coalesce((select nullif(l.tz, '') from biz_locations l where l.client_email = lower(trim(p_email)) and coalesce(l.active, true)
                    order by l.created_at limit 1), 'America/New_York')
$$;
revoke all on function public._desk_tz(text) from public, anon, authenticated;

-- ═══ LER / GRAVAR A ESCOLHA DA DONA (porta _desk_ok) ═══════════════════════════════════════════
create or replace function public.desk_avisos_get(p_email text, p_key text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); v desk_avisos; u desk_resumo_envios;
begin
  select * into v from desk_avisos where client_email = e;
  select * into u from desk_resumo_envios where client_email = e order by created_at desc limit 1;
  return jsonb_build_object('ok', true,
    'resumo_manha', coalesce(v.resumo_manha, false), 'hora', coalesce(v.hora, 7), 'email_destino', v.email_destino,
    'email_padrao', e, 'lang', v.lang, 'tz', public._desk_tz(e),
    'ultimo', case when u.id is null then null else jsonb_build_object('tipo', u.tipo, 'estado', u.estado, 'dia', u.dia_local,
                'para', u.para, 'at', u.updated_at, 'motivo', u.motivo) end);
end $$;

create or replace function public.desk_avisos_set(p_email text, p_key text, p_resumo boolean, p_hora int, p_email_destino text, p_lang text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key);
        d text := nullif(lower(trim(coalesce(p_email_destino, ''))), '');
        l text := case when p_lang in ('pt', 'en', 'es', 'hi') then p_lang else null end;
begin
  if p_hora is null or p_hora < 0 or p_hora > 23 then return jsonb_build_object('ok', false, 'reason', 'invalid_hour'); end if;
  if d is not null and d !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then return jsonb_build_object('ok', false, 'reason', 'invalid_email'); end if;
  insert into desk_avisos (client_email, resumo_manha, hora, email_destino, lang, updated_at)
  values (e, coalesce(p_resumo, false), p_hora, d, l, now())
  on conflict (client_email) do update set resumo_manha = excluded.resumo_manha, hora = excluded.hora,
    email_destino = excluded.email_destino, lang = coalesce(excluded.lang, desk_avisos.lang), updated_at = now();
  return jsonb_build_object('ok', true, 'resumo_manha', coalesce(p_resumo, false), 'hora', p_hora, 'email_destino', d);
end $$;

-- "Mandar um de teste agora": no máximo 3 por hora por negócio. Devolve o id para marcar depois.
create or replace function public.desk_resumo_teste_reservar(p_email text, p_key text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); n int; v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('desk_resumo_teste:' || e));
  select count(*) into n from desk_resumo_envios where client_email = e and tipo = 'teste' and created_at > now() - interval '1 hour';
  if n >= 3 then return jsonb_build_object('ok', false, 'reason', 'rate_limited'); end if;
  insert into desk_resumo_envios (client_email, dia_local, tipo) values (e, (now() at time zone public._desk_tz(e))::date, 'teste')
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

grant execute on function public.desk_avisos_get(text, text) to anon, authenticated, service_role;
grant execute on function public.desk_avisos_set(text, text, boolean, int, text, text) to anon, authenticated, service_role;
grant execute on function public.desk_resumo_teste_reservar(text, text) to anon, authenticated, service_role;

-- ═══ O REMETENTE (SÓ service_role) ═════════════════════════════════════════════════════════════
-- Quem LIGOU o resumo, com fuso, hora escolhida e o último dia já enviado (ou reservado). A escolha
-- "é a hora dela agora?" fica no JS (lib/resumoManha.js, testada); a trava de verdade é a reserva abaixo.
create or replace function public.desk_resumo_candidatos_svc(p_limit int default 200)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('client_email', a.client_email, 'hora', a.hora, 'tz', public._desk_tz(a.client_email),
           'email_destino', a.email_destino, 'lang', coalesce(a.lang, (select tokens->>'lang' from client_integrations ci
                                 where ci.client_email = a.client_email and ci.provider = 'profile' limit 1)),
           'ultimo_dia', (select max(r.dia_local) from desk_resumo_envios r where r.client_email = a.client_email and r.tipo = 'auto'
                            and r.estado in ('enviado', 'reservado'))) order by a.client_email), '[]'::jsonb)
    from (select * from desk_avisos where resumo_manha order by client_email limit greatest(1, least(coalesce(p_limit, 200), 500))) a
$$;

-- Reserva o dia (local) do negócio. true = pode mandar; null = alguém já mandou/está mandando.
-- Falhou antes? reabre a mesma linha (até 3 tentativas) — reserva que nunca reabre é resumo que some.
create or replace function public.desk_resumo_reservar_svc(p_email text, p_dia date)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare e text := lower(trim(coalesce(p_email, ''))); v_id uuid;
begin
  if p_dia is null or e = '' then return null; end if;
  insert into desk_resumo_envios (client_email, dia_local, tipo) values (e, p_dia, 'auto')
  on conflict (client_email, dia_local) where tipo = 'auto' do update
     set estado = 'reservado', tentativas = desk_resumo_envios.tentativas + 1, motivo = null, updated_at = now()
   where desk_resumo_envios.estado = 'falhou' and desk_resumo_envios.tentativas < 3
  returning id into v_id;
  return v_id;
end $$;

-- Marca o resultado. 'enviado' SEM resend_id é recusado: "ok" sem comprovante é promessa.
create or replace function public.desk_resumo_marcar_svc(p_id uuid, p_estado text, p_para text, p_resend_id text, p_motivo text)
returns boolean language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  if p_estado not in ('enviado', 'falhou') then return false; end if;
  if p_estado = 'enviado' and coalesce(p_resend_id, '') = '' then return false; end if;
  update desk_resumo_envios set estado = p_estado, para = left(p_para, 200), resend_id = nullif(p_resend_id, ''),
         motivo = left(p_motivo, 300), updated_at = now()
   where id = p_id and estado = 'reservado';
  get diagnostics n = row_count;
  return n = 1;
end $$;

-- OS DADOS DO RESUMO. Agendamentos de vivo_biz_appointments (teste de antes da entrada em operação não
-- conta), sem bloqueio, sem a linha de sala vinculada, sem reserva provisória vencida.
-- Hoje por unidade é o "hoje" no fuso DAQUELA unidade; ontem/alertas/fila usam o fuso do negócio.
create or replace function public.desk_resumo_dados_svc(p_email text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := lower(trim(coalesce(p_email, '')));
        v_tz text := public._desk_tz(e);
        v_hoje date := (now() at time zone public._desk_tz(e))::date;
        h0 timestamptz; h1 timestamptz; o0 timestamptz;
begin
  if not exists (select 1 from client_credits where client_email = e) then return jsonb_build_object('ok', false, 'reason', 'tenant_not_found'); end if;
  h0 := v_hoje::timestamp at time zone v_tz;
  h1 := (v_hoje + 1)::timestamp at time zone v_tz;
  o0 := (v_hoje - 1)::timestamp at time zone v_tz;
  return (
  with ap as (
    select a.*, public._desk_ck(a.customer_contact) ck, coalesce(a.attributes->>'desk_status', a.status) st
      from public.vivo_biz_appointments(e) a
     where a.status <> 'blocked' and not (coalesce(a.attributes, '{}'::jsonb) ? 'vinculo_de')
       and not (a.status = 'hold' and a.expires_at is not null and a.expires_at <= now())
  ),
  vale as (select * from ap where status not in ('cancelled', 'no_show', 'hold')),
  primeira as (select ck, min(lower(span)) primeira from ap where ck is not null and status <> 'cancelled' group by ck),
  ontem as (select * from ap where lower(span) >= o0 and lower(span) < h0),
  vendas as (select s.* from desk_sales s where s.client_email = e and s.status = 'paid' and s.created_at >= o0 and s.created_at < h0)
  select jsonb_build_object('ok', true, 'tenant', e, 'tz', v_tz, 'hoje', v_hoje, 'agora', now(),
    'business', coalesce((select nullif(tokens->>'business_name', '') from client_integrations where client_email = e and provider = 'profile' limit 1), ''),
    'lang', coalesce((select lang from desk_avisos where client_email = e),
                     (select tokens->>'lang' from client_integrations where client_email = e and provider = 'profile' limit 1)),
    -- HOJE, por unidade (no fuso de cada uma)
    'unidades', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'tz', coalesce(l.tz, v_tz),
                    'count', x.n, 'first', x.primeiro, 'confirmed', x.conf, 'unconfirmed', x.n - x.conf) order by l.created_at)
                  from biz_locations l
                  cross join lateral (select (now() at time zone coalesce(l.tz, v_tz))::date d) dd
                  cross join lateral (select count(*) n, min(lower(a.span)) primeiro,
                                             count(*) filter (where a.st in ('confirmed', 'in_progress', 'completed')) conf
                                        from vale a where a.location_id = l.id
                                         and lower(a.span) >= dd.d::timestamp at time zone coalesce(l.tz, v_tz)
                                         and lower(a.span) < (dd.d + 1)::timestamp at time zone coalesce(l.tz, v_tz)) x
                 where l.client_email = e and coalesce(l.active, true)), '[]'::jsonb),
    -- agendamento de hoje sem unidade (raro: importado/antigo) — conta à parte para o total não mentir
    'sem_unidade', (select jsonb_build_object('count', count(*), 'first', min(lower(a.span)),
                      'confirmed', count(*) filter (where a.st in ('confirmed', 'in_progress', 'completed')))
                      from vale a where (a.location_id is null or not exists (select 1 from biz_locations l where l.id = a.location_id and coalesce(l.active, true)))
                       and lower(a.span) >= h0 and lower(a.span) < h1),
    -- clientes de HOJE com alergia/alerta na ficha
    'alertas', coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(nullif(a.customer_name, ''), c.name), 'start', lower(a.span),
                    'alert', concat_ws(' · ', nullif(c.allergies, ''), nullif(c.alerts, '')),
                    'tz', coalesce((select l.tz from biz_locations l where l.id = a.location_id), v_tz)) order by lower(a.span))
                  from vale a join desk_clients c on c.client_email = e and c.contact_key = a.ck
                 where lower(a.span) >= h0 and lower(a.span) < h1
                   and (coalesce(c.allergies, '') <> '' or coalesce(c.alerts, '') <> '')), '[]'::jsonb),
    -- SINAL PENDENTE: próximos 7 dias, serviço pede sinal, não pago, cliente não é "de confiança"
    'sinais', (select jsonb_build_object('count', count(*), 'cents', coalesce(sum(s.deposit_cents), 0),
                 'itens', coalesce(jsonb_agg(jsonb_build_object('name', a.customer_name, 'start', lower(a.span), 'service', s.name,
                            'cents', s.deposit_cents, 'tz', coalesce((select l.tz from biz_locations l where l.id = a.location_id), v_tz))
                            order by lower(a.span)), '[]'::jsonb))
                 from vale a join biz_services s on s.id = a.service_id
                where a.status = 'booked' and coalesce(s.deposit_cents, 0) > 0
                  and not coalesce((a.attributes->>'deposit_paid')::boolean, false)
                  and lower(a.span) >= now() and lower(a.span) < now() + interval '7 days'
                  and not coalesce((select c.trusted from desk_clients c where c.client_email = e and c.contact_key = a.ck), false)),
    -- ONTEM (no fuso do negócio). null = não houve agenda ontem → a seção some.
    'ontem', case when not exists (select 1 from ontem) then null else (select jsonb_build_object(
                 'booked', count(*) filter (where status not in ('cancelled', 'hold')),
                 'visits', count(*) filter (where status not in ('cancelled', 'no_show', 'hold') and upper(span) <= now()),
                 'no_show', count(*) filter (where status = 'no_show'),
                 'cancelled', count(*) filter (where status = 'cancelled'),
                 'new_clients', (select count(distinct o.ck) from ontem o join primeira f on f.ck = o.ck
                                  where o.status not in ('cancelled', 'no_show', 'hold') and f.primeira >= o0 and f.primeira < h0))
               from ontem) end,
    -- CAIXA de ontem (desk_day_close: dinheiro que ENTROU = cash/card/other). null = nenhuma venda ontem.
    'caixa_ontem', case when not exists (select 1 from vendas) then null else jsonb_build_object(
                 'sales', (select count(*) from vendas),
                 'collected_cents', (select coalesce(sum(p.amount_cents), 0) from desk_payments p join vendas s on s.id = p.sale_id
                                      where p.method in ('cash', 'card', 'other')),
                 'tip_cents', (select coalesce(sum(tip_cents), 0) from vendas)) end,
    -- FILA DE ESPERA: quem ainda espera (não foi avisada)
    'fila', (select count(*) from biz_waitlist w where w.client_email = e and not coalesce(w.notified, false))
  ));
end $$;

revoke all on function public.desk_resumo_candidatos_svc(int) from public, anon, authenticated;
revoke all on function public.desk_resumo_reservar_svc(text, date) from public, anon, authenticated;
revoke all on function public.desk_resumo_marcar_svc(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.desk_resumo_dados_svc(text) from public, anon, authenticated;
grant execute on function public.desk_resumo_candidatos_svc(int) to service_role;
grant execute on function public.desk_resumo_reservar_svc(text, date) to service_role;
grant execute on function public.desk_resumo_marcar_svc(uuid, text, text, text, text) to service_role;
grant execute on function public.desk_resumo_dados_svc(text) to service_role;
