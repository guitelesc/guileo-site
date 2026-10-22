-- FILA DE RELACIONAMENTO (2026-09-30) — a volta no tempo certo de cada serviço, e o aniversário.
-- ============================================================================
-- POR QUE EXISTE
-- O "lembrete de volta" (crm_rebook_due) e o aniversário (crm_birthday_contacts) rodavam DENTRO do
-- laço por-negócio do /api/proactive, que gasta ~20 chamadas por negócio e estoura o teto de
-- subrequests do Worker no 3º — o mesmo defeito que deixou o lembrete de horário sem mandar um
-- e-mail na história da plataforma (corrigido em 28/09 com biz_reminders_due_all). Além disso:
--   1. nada gravava `rebook_days`, então todo serviço usava 28 dias — Botox e corte de cabelo no
--      mesmo relógio;
--   2. só olhava a ÚLTIMA visita da pessoa (de qualquer serviço): quem fez facial e depois um corte
--      nunca era chamada de volta para o facial;
--   3. janela de 7 dias: uma rodada perdida e a pessoa saía da fila para sempre;
--   4. quem marcou por TELEFONE era pulado — o agendamento guarda o número, e o motor só mandava
--      para quem tinha e-mail no campo de contato. Quase toda reserva de voz ficava de fora;
--   5. não respeitava o `live_desde`: teste de antes da entrada em operação virava "cliente";
--   6. o aniversário ignorava o botão e a mensagem que o dono configura na tela de Datas.
-- Aqui a fila é UMA consulta para todos os negócios, já com o e-mail resolvido pelo CRM.
--
-- REGRAS DA VOLTA
--   • só serviço com `config.rebook_days` > 0 (ciclo EXPLÍCITO — 0 ou ausente = nunca lembrar;
--     consulta grátis e pacote fechado não têm "volta");
--   • vale a última visita da pessoa NAQUELE serviço, vencida há no máximo 21 dias;
--   • quem já tem horário futuro marcado não recebe (a pessoa já está voltando);
--   • um lembrete por visita (mesma trava de sempre: biz_marketing_sent kind='rebook', ref=id) e
--     no máximo um por pessoa a cada 14 dias, mesmo com vários serviços vencendo.
--
-- Idempotente. Tudo gated por literal (_gui_sched_ok) e concedido só ao service_role: são chamadas
-- de servidor (functions/api/proactive.js, ciclo-retorno.js, aniversario.js).
-- ============================================================================

-- A chave que identifica a MESMA pessoa entre agendamentos: telefone normalizado ou e-mail.
create or replace function public._contato_chave(p_contact text)
returns text language sql immutable as $$
  select case when coalesce(p_contact,'') like '%@%' then lower(trim(p_contact))
              else coalesce(public._gui_phone_key(p_contact), lower(trim(coalesce(p_contact,'')))) end
$$;

-- O e-mail de quem marcou: o próprio contato, se for e-mail; senão o do CRM para aquele telefone.
create or replace function public._contato_email(p_tenant text, p_contact text)
returns text language sql stable security definer set search_path = public as $$
  select case
    when coalesce(p_contact,'') ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then lower(trim(p_contact))
    else (select lower(trim(c.email)) from crm_contacts c
           where c.client_email = lower(trim(p_tenant))
             and c.phone_key is not null and c.phone_key = public._gui_phone_key(p_contact)
             and c.email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'
           order by c.last_seen_at desc nulls last limit 1)
  end
$$;
revoke all on function public._contato_email(text,text) from public, anon, authenticated;
grant execute on function public._contato_email(text,text) to service_role;

-- O ciclo de um serviço, em dias. Texto que não é número vira 0 (nunca lembrar) em vez de erro.
create or replace function public._ciclo_dias(p_config jsonb)
returns int language sql immutable as $$
  select case when (p_config->>'rebook_days') ~ '^[0-9]{1,3}$' then (p_config->>'rebook_days')::int else 0 end
$$;

-- ── A FILA ─────────────────────────────────────────────────────────────────────
-- p_so_tenant: restringe a um negócio (prova em tenant de teste). p_agora: relógio da prova.
create or replace function public.relacionamento_due_all(
  p_secret text, p_limit int default 60, p_so_tenant text default null, p_agora timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_reb jsonb; v_bd jsonb;
  v_lim int := greatest(1, least(coalesce(p_limit,60), 200));
  v_t   text := nullif(lower(trim(coalesce(p_so_tenant,''))),'');
  v_now timestamptz := coalesce(p_agora, now());
begin
  if not public._gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;

  with visitas as (
    select a.id, a.client_email as tenant, a.customer_name, a.customer_contact, a.service_id, a.location_id,
           upper(a.span) as fim, public._contato_chave(a.customer_contact) as ckey
      from biz_appointments a
     where a.status in ('booked','confirmed','completed','done')
       and upper(a.span) < v_now
       and coalesce(trim(a.customer_contact),'') <> ''
       and a.service_id is not null
       and (v_t is null or a.client_email = v_t)
       and a.created_at >= coalesce(public.tenant_live_desde(a.client_email), '-infinity'::timestamptz)
  ),
  ultima as (   -- a ÚLTIMA visita de cada pessoa em cada serviço
    select distinct on (tenant, ckey, service_id) *
      from visitas order by tenant, ckey, service_id, fim desc
  ),
  vencida as (
    select u.*, s.name as service, public._ciclo_dias(s.config) as ciclo
      from ultima u
      join biz_services s on s.id = u.service_id and s.client_email = u.tenant
     where public._ciclo_dias(s.config) > 0
       and u.fim <= v_now - (public._ciclo_dias(s.config) || ' days')::interval
       and u.fim >  v_now - ((public._ciclo_dias(s.config) + 21) || ' days')::interval
  ),
  livre as (
    select v.*, public._contato_email(v.tenant, v.customer_contact) as email
      from vencida v
     where not exists (   -- já tem horário futuro: está voltando
             select 1 from biz_appointments f
              where f.client_email = v.tenant and f.status in ('booked','confirmed','hold')
                and lower(f.span) > v_now and public._contato_chave(f.customer_contact) = v.ckey)
       and not exists (   -- esta visita já foi lembrada
             select 1 from biz_marketing_sent ms
              where ms.client_email = v.tenant and ms.kind = 'rebook' and ms.ref = v.id::text)
       and not exists (   -- esta pessoa recebeu um lembrete de volta nos últimos 14 dias
             select 1 from biz_marketing_sent ms
               join biz_appointments a3 on a3.id::text = ms.ref and a3.client_email = ms.client_email
              where ms.client_email = v.tenant and ms.kind = 'rebook'
                and ms.sent_at > v_now - interval '14 days'
                and public._contato_chave(a3.customer_contact) = v.ckey)
  ),
  uma as (      -- um lembrete por pessoa por rodada: o da visita mais recente
    select distinct on (tenant, ckey) * from livre order by tenant, ckey, fim desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind','rebook', 'tenant', u.tenant, 'ref', u.id::text, 'period', '-',
           'name', u.customer_name, 'email', u.email, 'tem_email', u.email is not null,
           'service', u.service, 'ciclo', u.ciclo, 'when', u.fim,
           'location', l.name, 'tz', l.tz) order by u.fim), '[]'::jsonb)
    into v_reb
    from (select * from uma order by fim limit v_lim) u
    left join biz_locations l on l.id = u.location_id;

  -- ANIVERSÁRIO: só do negócio que LIGOU o botão na tela de Datas (linha kind='birthday' ativa),
  -- com a mensagem que o dono escreveu. "Hoje" é o dia no fuso do negócio. 29/02 cai em 28/02
  -- nos anos que não são bissextos.
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind','birthday', 'tenant', c.client_email, 'ref', c.id::text, 'period', to_char(z.hoje,'YYYY'),
           'name', c.full_name, 'email', lower(trim(c.email)), 'tem_email', true,
           'message', md.message, 'offer', md.offer)), '[]'::jsonb)
    into v_bd
    from crm_contacts c
    join lateral (select m.message, m.offer from biz_marketing_dates m
                   where m.client_email = c.client_email and m.kind = 'birthday' and m.active
                   order by m.created_at desc limit 1) md on true
    join lateral (select (v_now at time zone coalesce(
                    (select l.tz from biz_locations l where l.client_email = c.client_email and l.active order by l.created_at limit 1),
                    'America/New_York'))::date as hoje) z on true
   where c.birth_date is not null
     and c.email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'
     and (v_t is null or c.client_email = v_t)
     and ( to_char(c.birth_date,'MM-DD') = to_char(z.hoje,'MM-DD')
        or (to_char(c.birth_date,'MM-DD') = '02-29' and to_char(z.hoje,'MM-DD') = '02-28'
            and extract(day from (date_trunc('year', z.hoje) + interval '2 months' - interval '1 day')) = 28) )
     and not exists (select 1 from biz_marketing_sent ms
                      where ms.client_email = c.client_email and ms.kind = 'birthday'
                        and ms.ref = c.id::text and ms.period = to_char(z.hoje,'YYYY'));

  return jsonb_build_object('due', v_reb || v_bd, 'voltas', jsonb_array_length(v_reb), 'aniversarios', jsonb_array_length(v_bd));
end $$;
revoke all on function public.relacionamento_due_all(text,int,text,timestamptz) from public, anon, authenticated;
grant execute on function public.relacionamento_due_all(text,int,text,timestamptz) to service_role;

-- ── O CICLO DE CADA SERVIÇO (tela do dono) ─────────────────────────────────────
create or replace function public.biz_service_cycles(p_secret text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb; v_email text := lower(trim(p_email));
begin
  if not public._gui_sched_ok(p_secret) then return jsonb_build_object('ok', false, 'reason', 'unauthorized'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name,
           'days', case when s.config ? 'rebook_days' then public._ciclo_dias(s.config) else null end) order by s.name), '[]'::jsonb)
    into v from biz_services s where s.client_email = v_email and s.active;
  return jsonb_build_object('ok', true, 'services', v);
end $$;
revoke all on function public.biz_service_cycles(text,text) from public, anon, authenticated;
grant execute on function public.biz_service_cycles(text,text) to service_role;

-- p_cycles = [{"id":"<uuid do serviço>","days":28}, …]. days 0 = nunca lembrar. Só mexe em serviço
-- DESTE negócio; id de outro negócio simplesmente não casa (e não conta em `changed`).
create or replace function public.biz_service_cycles_set(p_secret text, p_email text, p_cycles jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(p_email)); v_n int := 0;
begin
  if not public._gui_sched_ok(p_secret) then return jsonb_build_object('ok', false, 'reason', 'unauthorized'); end if;
  if jsonb_typeof(p_cycles) is distinct from 'array' then return jsonb_build_object('ok', false, 'reason', 'cycles_must_be_array'); end if;
  with novo as (
    select (x->>'id')::uuid as id, (x->>'days')::int as days
      from jsonb_array_elements(p_cycles) x
     where (x->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       and (x->>'days') ~ '^[0-9]{1,3}$' and (x->>'days')::int between 0 and 730
  ), feito as (
    update biz_services s
       set config = coalesce(s.config,'{}'::jsonb) || jsonb_build_object('rebook_days', n.days), updated_at = now()
      from novo n
     where s.id = n.id and s.client_email = v_email
    returning 1
  )
  select count(*) into v_n from feito;
  return jsonb_build_object('ok', true, 'changed', v_n);
end $$;
revoke all on function public.biz_service_cycles_set(text,text,jsonb) from public, anon, authenticated;
grant execute on function public.biz_service_cycles_set(text,text,jsonb) to service_role;

-- ── O ANIVERSÁRIO QUE A PRÓPRIA CLIENTE INFORMA ────────────────────────────────
-- Chamado pela página assinada /api/aniversario (o link vai no e-mail de confirmação). Guarda só
-- DIA e MÊS — o ano fica 1904 (bissexto, para caber 29/02): ninguém precisa dizer a idade para
-- ganhar um parabéns. A pessoa é achada pelo contato DAQUELE agendamento, dentro do mesmo negócio.
create or replace function public.crm_birthday_set(p_secret text, p_email text, p_appointment_id uuid, p_month int, p_day int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_contact text; v_name text; v_data date; v_id uuid; v_key text;
begin
  if not public._gui_sched_ok(p_secret) then return jsonb_build_object('ok', false, 'reason', 'unauthorized'); end if;
  begin v_data := make_date(1904, p_month, p_day);
  exception when others then return jsonb_build_object('ok', false, 'reason', 'invalid_date'); end;
  select a.customer_contact, a.customer_name into v_contact, v_name
    from biz_appointments a where a.id = p_appointment_id and a.client_email = v_email;
  if coalesce(trim(v_contact),'') = '' then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  if v_contact like '%@%' then
    select c.id into v_id from crm_contacts c
     where c.client_email = v_email and lower(c.email) = lower(trim(v_contact)) order by c.last_seen_at desc nulls last limit 1;
  else
    v_key := public._gui_phone_key(v_contact);
    select c.id into v_id from crm_contacts c
     where c.client_email = v_email and v_key is not null and c.phone_key = v_key order by c.last_seen_at desc nulls last limit 1;
  end if;

  if v_id is null then
    insert into crm_contacts (client_email, phone, email, full_name, lead_source, birth_date)
    values (v_email, case when v_contact like '%@%' then null else v_contact end,
            case when v_contact like '%@%' then lower(trim(v_contact)) else null end,
            nullif(trim(coalesce(v_name,'')),''), 'booking', v_data)
    returning id into v_id;
  else
    update crm_contacts set birth_date = v_data, updated_at = now() where id = v_id and client_email = v_email;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'month', p_month, 'day', p_day);
end $$;
revoke all on function public.crm_birthday_set(text,text,uuid,int,int) from public, anon, authenticated;
grant execute on function public.crm_birthday_set(text,text,uuid,int,int) to service_role;

notify pgrst, 'reload schema';
