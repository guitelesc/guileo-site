-- ============================================================================
-- GUILEO · 🌀 HURRICANE MODE  (paste in Supabase → SQL Editor → Run)
-- Project: ynihodbknhjirkdogxby (smart@guileoai.com)
-- MIAMI THESIS: a storm is coming → the owner taps ONE button and Gui handles it:
--   • the calendar CLOSES for the window (rides the existing biz_special_dates
--     engine from db/special_dates.sql — biz_availability skips the days, the
--     biz_appt_guard trigger rejects books with reason='closed_date', and the
--     agent SPEAKS the closed note to callers — zero new voice plumbing);
--   • every already-booked appointment inside the window surfaces so the API
--     can notify + rebook them;
--   • when it passes, "Reabrir agora" clears the remaining closed days and
--     fires ONE reopen blast (idempotent — reopen_blast_sent latches).
-- Este arquivo é o LADO DADOS: 1 tabela + RPCs. Tudo INGEST-gated (mesmo literal
-- que o pipeline de ingest / coupons / crm usa), security definer, granted to
-- anon. RLS on, SEM policies para anon (só as funções SECURITY DEFINER acessam).
-- Client-scoped por p_email — nenhum tenant enxerga a tempestade de outro.
-- Idempotente (pode rodar de novo).
-- ============================================================================

-- ── TABELA ──────────────────────────────────────────────────────────────────
create table if not exists public.storm_modes (
  id                uuid primary key default gen_random_uuid(),
  client_email      text not null,
  starts_on         date not null,                       -- primeiro dia FECHADO
  reopen_on         date not null,                       -- primeiro dia ABERTO de novo
  message           text,                                -- o que o Gui fala / o email diz
  status            text not null default 'active',      -- active | reopened | canceled
  notified          int  not null default 0,             -- quantos afetados já avisados (dedup/cap)
  reopen_blast_sent boolean not null default false,      -- trava do blast "estamos de volta" (1x)
  created_at        timestamptz not null default now(),
  check (status in ('active','reopened','canceled')),
  check (reopen_on > starts_on)
);
create index if not exists storm_modes_tenant on public.storm_modes (client_email, created_at desc);
alter table public.storm_modes enable row level security;  -- trancado; só SECURITY DEFINER acessa

-- ── RPC · ATIVAR — 1 botão: grava a tempestade + FECHA o calendário na janela ─
-- Fecha [starts_on .. reopen_on-1] inserindo em biz_special_dates (a MESMA tabela
-- do special_dates.sql — availability/guard/biz_book já respeitam; o agente já
-- fala a nota de fechado). Nota prefixada com '🌀' para o reopen só limpar o que
-- a tempestade criou (feriados marcados à mão ficam intactos). Idempotente:
-- reativar com a MESMA janela devolve a tempestade existente.
create or replace function public.storm_activate(
  p_secret text, p_email text, p_starts_on date, p_reopen_on date, p_message text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_existing storm_modes;
  v_id uuid; v_note text; v_days int; v_affected int; d date;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if p_starts_on is null or p_reopen_on is null then return jsonb_build_object('ok',false,'reason','bad_dates'); end if;
  if p_reopen_on <= p_starts_on then return jsonb_build_object('ok',false,'reason','bad_dates'); end if;
  if p_reopen_on - p_starts_on > 30 then return jsonb_build_object('ok',false,'reason','window_too_long'); end if;

  -- idempotência: já existe uma tempestade ATIVA deste tenant?
  select * into v_existing from storm_modes
    where client_email = v_email and status = 'active'
    order by created_at desc limit 1;
  if v_existing.id is not null then
    if v_existing.starts_on = p_starts_on and v_existing.reopen_on = p_reopen_on then
      return jsonb_build_object('ok',true,'id',v_existing.id,'starts_on',v_existing.starts_on,
        'reopen_on',v_existing.reopen_on,'notified',v_existing.notified,'idempotent',true);
    end if;
    return jsonb_build_object('ok',false,'reason','already_active','id',v_existing.id,
      'starts_on',v_existing.starts_on,'reopen_on',v_existing.reopen_on);
  end if;

  v_note := '🌀 ' || coalesce(nullif(trim(coalesce(p_message,'')),''), 'Fechado temporariamente — tempestade / Temporarily closed — storm');
  insert into storm_modes(client_email, starts_on, reopen_on, message)
    values (v_email, p_starts_on, p_reopen_on, nullif(trim(coalesce(p_message,'')),''))
    returning id into v_id;

  -- fecha cada dia da janela (reopen_on é o primeiro dia aberto → exclusivo)
  v_days := 0; d := p_starts_on;
  while d < p_reopen_on loop
    insert into biz_special_dates(client_email, date, closed, note)
      values (v_email, d, true, left(v_note, 200))
    on conflict (client_email, date) do update
      set closed = true, open_min = null, close_min = null, note = excluded.note;
    v_days := v_days + 1; d := d + 1;
  end loop;

  -- quantos agendamentos vivos caem dentro da janela (o API notifica cada um)
  select count(*) into v_affected from biz_appointments a
    where a.client_email = v_email and a.status <> 'cancelled'
      and (a.expires_at is null or a.expires_at > now())
      and lower(a.span)::date >= p_starts_on and lower(a.span)::date < p_reopen_on;

  return jsonb_build_object('ok',true,'id',v_id,'starts_on',p_starts_on,'reopen_on',p_reopen_on,
    'days_closed',v_days,'affected',coalesce(v_affected,0));
end $$;

-- ── RPC · STATUS — a tempestade ativa (se houver) + histórico recente ────────
create or replace function public.storm_status(p_secret text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_active storm_modes; v_affected int := 0; v_history jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select * into v_active from storm_modes
    where client_email = v_email and status = 'active'
    order by created_at desc limit 1;
  if v_active.id is not null then
    select count(*) into v_affected from biz_appointments a
      where a.client_email = v_email and a.status <> 'cancelled'
        and (a.expires_at is null or a.expires_at > now())
        and lower(a.span)::date >= v_active.starts_on and lower(a.span)::date < v_active.reopen_on;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',id,'starts_on',starts_on,'reopen_on',reopen_on,'status',status,
      'notified',notified,'reopen_blast_sent',reopen_blast_sent,'created_at',created_at
    ) order by created_at desc),'[]'::jsonb)
    into v_history from (
      select * from storm_modes where client_email = v_email order by created_at desc limit 10
    ) t;
  return jsonb_build_object(
    'active', case when v_active.id is null then null else jsonb_build_object(
      'id',v_active.id,'starts_on',v_active.starts_on,'reopen_on',v_active.reopen_on,
      'message',v_active.message,'notified',v_active.notified,
      'reopen_blast_sent',v_active.reopen_blast_sent,'created_at',v_active.created_at
    ) end,
    'affected', coalesce(v_affected,0),
    'history', coalesce(v_history,'[]'::jsonb));
end $$;

-- ── RPC · REABRIR / CANCELAR — limpa os dias fechados restantes + marca status ─
-- Reabrindo CEDO (a tempestade passou antes do previsto): limpa de HOJE em diante,
-- só as linhas '🌀%' que a própria tempestade criou. `blast` sai true só na PRIMEIRA
-- reabertura real (p_canceled=false) — a trava reopen_blast_sent garante 1 blast.
create or replace function public.storm_reopen(p_secret text, p_email text, p_canceled boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v storm_modes; v_cleared int; v_blast boolean := false;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select * into v from storm_modes
    where client_email = v_email and status = 'active'
    order by created_at desc limit 1;
  if v.id is null then return jsonb_build_object('ok',false,'reason','no_active_storm'); end if;

  delete from biz_special_dates
    where client_email = v_email and note like '🌀%'
      and date >= greatest((now() at time zone 'UTC')::date, v.starts_on)
      and date < v.reopen_on;
  get diagnostics v_cleared = row_count;

  v_blast := (not p_canceled) and (not v.reopen_blast_sent);
  update storm_modes
    set status = case when p_canceled then 'canceled' else 'reopened' end,
        reopen_blast_sent = reopen_blast_sent or v_blast
    where id = v.id;

  return jsonb_build_object('ok',true,'id',v.id,'status',case when p_canceled then 'canceled' else 'reopened' end,
    'cleared',coalesce(v_cleared,0),'blast',v_blast);
end $$;

-- ── RPC · AFETADOS — agendamentos vivos dentro da janela (nome/contato/serviço/quando) ─
-- Usa a tempestade mais recente (ativa primeiro; senão a última — o blast de reabertura
-- roda DEPOIS do status virar 'reopened' e ainda precisa da lista).
create or replace function public.storm_affected_appointments(p_secret text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v storm_modes; v_appts jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select * into v from storm_modes
    where client_email = v_email
    order by (status = 'active') desc, created_at desc limit 1;
  if v.id is null then return jsonb_build_object('storm_id',null,'appointments','[]'::jsonb); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',t.id,'name',t.customer_name,'contact',t.customer_contact,'service',t.service,
      'starts_at',t.starts_at,'ref',t.ref,'status',t.status
    ) order by t.starts_at),'[]'::jsonb)
    into v_appts from (
      select a.id, a.customer_name, a.customer_contact, s.name as service,
             lower(a.span) as starts_at, a.ref, a.status
      from biz_appointments a
      left join biz_services s on s.id = a.service_id
      where a.client_email = v_email and a.status <> 'cancelled'
        and (a.expires_at is null or a.expires_at > now())
        and lower(a.span)::date >= v.starts_on and lower(a.span)::date < v.reopen_on
      order by lower(a.span) limit 300
    ) t;
  return jsonb_build_object('storm_id',v.id,'starts_on',v.starts_on,'reopen_on',v.reopen_on,
    'appointments',coalesce(v_appts,'[]'::jsonb));
end $$;

-- ── RPC · MARCAR NOTIFICADOS — dedup/cap do lado do API (nunca decresce) ─────
create or replace function public.storm_mark_notified(p_secret text, p_email text, p_id uuid, p_count int)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  update storm_modes set notified = greatest(notified, coalesce(p_count,0))
    where id = p_id and client_email = lower(trim(p_email));
  return found;
end $$;

grant execute on function public.storm_activate(text,text,date,date,text) to anon;
grant execute on function public.storm_status(text,text) to anon;
grant execute on function public.storm_reopen(text,text,boolean) to anon;
grant execute on function public.storm_affected_appointments(text,text) to anon;
grant execute on function public.storm_mark_notified(text,text,uuid,int) to anon;

-- ✅ Pronto. Teste rápido (troque o email):
--   select storm_activate('glo_ing_c7f2a9e4b8d16350','dono@negocio.com', current_date, current_date + 3, 'Fechados pelo furacão — reabrimos quinta.');
--   select storm_status('glo_ing_c7f2a9e4b8d16350','dono@negocio.com');
--   select storm_affected_appointments('glo_ing_c7f2a9e4b8d16350','dono@negocio.com');
--   -- biz_availability não devolve slots na janela; biz_book → reason='closed_date' + a nota 🌀 (o Gui fala).
--   select storm_reopen('glo_ing_c7f2a9e4b8d16350','dono@negocio.com');   -- blast=true só na 1ª vez
