-- GUILEO DESK · ACESSO DA RECEPÇÃO (2026-10-05). Código próprio da recepcionista, em vez da chave da dona.
-- Regras completas: functions/lib/deskAcesso.js. Este arquivo só ACRESCENTA (tabela nova + 4 funções).
--   · Guarda só o SHA-256 do código (o código cru aparece UMA vez, para a dona, na criação).
--   · desk_acessos_list / desk_acesso_criar / desk_acesso_revogar → porta _desk_ok (só a DONA).
--   · desk_acesso_entrar_svc → SÓ service_role: o /api/desk troca o código pela chave da dona do lado do
--     servidor, depois de conferir a ação na lista do papel. O _desk_ok NÃO muda: o código da recepção
--     não abre nenhuma função desk_* direto pelo PostgREST.
-- Idempotente.

create table if not exists public.desk_acessos (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,
  nome text not null,
  papel text not null default 'recepcao' check (papel in ('recepcao')),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  criado_em timestamptz not null default now(),
  revogado_em timestamptz,
  ultimo_uso timestamptz
);
create index if not exists desk_acessos_email_idx on public.desk_acessos (client_email);
alter table public.desk_acessos enable row level security;
revoke all on public.desk_acessos from public, anon, authenticated;

create or replace function public.desk_acessos_list(p_email text, p_key text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key);
begin
  return jsonb_build_object('ok', true, 'acessos', coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'papel', a.papel, 'criado_em', a.criado_em,
             'ultimo_uso', a.ultimo_uso, 'revogado_em', a.revogado_em) order by a.revogado_em nulls first, a.criado_em desc)
    from desk_acessos a where a.client_email = e), '[]'::jsonb));
end $$;

create or replace function public.desk_acesso_criar(p_email text, p_key text, p_nome text, p_hash text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); n text := left(trim(coalesce(p_nome, '')), 60); v uuid;
begin
  if n = '' then return jsonb_build_object('ok', false, 'reason', 'name_required'); end if;
  if coalesce(p_hash, '') !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok', false, 'reason', 'bad_code'); end if;
  if (select count(*) from desk_acessos where client_email = e and revogado_em is null) >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'too_many');
  end if;
  insert into desk_acessos (client_email, nome, code_hash) values (e, n, p_hash) returning id into v;
  return jsonb_build_object('ok', true, 'id', v, 'nome', n);
end $$;

create or replace function public.desk_acesso_revogar(p_email text, p_key text, p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); c int;
begin
  update desk_acessos set revogado_em = now() where id = p_id and client_email = e and revogado_em is null;
  get diagnostics c = row_count;
  return jsonb_build_object('ok', c = 1, 'reason', case when c = 1 then null else 'not_found' end);
end $$;

-- Só o servidor. Código revogado/errado/de outro negócio → {ok:false, reason:'unauthorized'} (sem dizer qual).
create or replace function public.desk_acesso_entrar_svc(p_email text, p_hash text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := lower(trim(coalesce(p_email, ''))); a record; k text;
begin
  select * into a from desk_acessos where code_hash = p_hash and client_email = e and revogado_em is null;
  if a is null then return jsonb_build_object('ok', false, 'reason', 'unauthorized'); end if;
  select access_key into k from client_credits where client_email = e;
  if coalesce(k, '') = '' then return jsonb_build_object('ok', false, 'reason', 'unauthorized'); end if;
  -- "último uso" com folga de 5 min: a agenda recarrega o tempo todo e não precisa de uma escrita por chamada.
  if a.ultimo_uso is null or a.ultimo_uso < now() - interval '5 minutes' then
    update desk_acessos set ultimo_uso = now() where id = a.id;
  end if;
  return jsonb_build_object('ok', true, 'id', a.id, 'nome', a.nome, 'papel', a.papel, 'chave', k);
end $$;

revoke all on function public.desk_acessos_list(text, text) from public;
revoke all on function public.desk_acesso_criar(text, text, text, text) from public;
revoke all on function public.desk_acesso_revogar(text, text, uuid) from public;
revoke all on function public.desk_acesso_entrar_svc(text, text) from public, anon, authenticated;
grant execute on function public.desk_acessos_list(text, text) to anon, authenticated, service_role;
grant execute on function public.desk_acesso_criar(text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.desk_acesso_revogar(text, text, uuid) to anon, authenticated, service_role;
grant execute on function public.desk_acesso_entrar_svc(text, text) to service_role;

-- ── v7.7 · AGENDA DA PROFISSIONAL (2026-10-05) ─────────────────────────────────────────────────
-- Papel 'profissional' preso a UMA profissional (pro_id). O /api/desk filtra a agenda para ela, tira o
-- contato das clientes e só deixa nota / chegou / terminou nos agendamentos DELA (desk_appt_pro_svc).
alter table public.desk_acessos add column if not exists pro_id uuid;
alter table public.desk_acessos drop constraint if exists desk_acessos_papel_check;
alter table public.desk_acessos add constraint desk_acessos_papel_check check (papel in ('recepcao', 'profissional'));
alter table public.desk_acessos drop constraint if exists desk_acessos_pro_check;
alter table public.desk_acessos add constraint desk_acessos_pro_check check ((papel = 'profissional') = (pro_id is not null));

create or replace function public.desk_acesso_criar_v2(p_email text, p_key text, p_nome text, p_hash text, p_papel text, p_pro_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); n text := left(trim(coalesce(p_nome, '')), 60); v uuid;
        pap text := coalesce(nullif(p_papel, ''), 'recepcao');
begin
  if pap not in ('recepcao', 'profissional') then return jsonb_build_object('ok', false, 'reason', 'bad_role'); end if;
  if pap = 'profissional' and not exists (select 1 from biz_professionals where id = p_pro_id and client_email = e and coalesce(kind, 'staff') <> 'room') then
    return jsonb_build_object('ok', false, 'reason', 'pro_not_found');
  end if;
  if n = '' then return jsonb_build_object('ok', false, 'reason', 'name_required'); end if;
  if coalesce(p_hash, '') !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok', false, 'reason', 'bad_code'); end if;
  if (select count(*) from desk_acessos where client_email = e and revogado_em is null) >= 40 then
    return jsonb_build_object('ok', false, 'reason', 'too_many');
  end if;
  insert into desk_acessos (client_email, nome, code_hash, papel, pro_id)
  values (e, n, p_hash, pap, case when pap = 'profissional' then p_pro_id end) returning id into v;
  return jsonb_build_object('ok', true, 'id', v, 'nome', n, 'papel', pap);
end $$;

create or replace function public.desk_acessos_list(p_email text, p_key text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key);
begin
  return jsonb_build_object('ok', true, 'acessos', coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'nome', a.nome, 'papel', a.papel, 'pro_id', a.pro_id, 'criado_em', a.criado_em,
             'ultimo_uso', a.ultimo_uso, 'revogado_em', a.revogado_em) order by a.revogado_em nulls first, a.criado_em desc)
    from desk_acessos a where a.client_email = e), '[]'::jsonb));
end $$;

create or replace function public.desk_acesso_entrar_svc(p_email text, p_hash text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := lower(trim(coalesce(p_email, ''))); a record; k text;
begin
  select * into a from desk_acessos where code_hash = p_hash and client_email = e and revogado_em is null;
  if a is null then return jsonb_build_object('ok', false, 'reason', 'unauthorized'); end if;
  -- profissional desativada/apagada → o acesso dela para de abrir
  if a.papel = 'profissional' and not exists (select 1 from biz_professionals where id = a.pro_id and client_email = e and coalesce(active, true)) then
    return jsonb_build_object('ok', false, 'reason', 'unauthorized');
  end if;
  select access_key into k from client_credits where client_email = e;
  if coalesce(k, '') = '' then return jsonb_build_object('ok', false, 'reason', 'unauthorized'); end if;
  if a.ultimo_uso is null or a.ultimo_uso < now() - interval '5 minutes' then
    update desk_acessos set ultimo_uso = now() where id = a.id;
  end if;
  return jsonb_build_object('ok', true, 'id', a.id, 'nome', a.nome, 'papel', a.papel, 'pro_id', a.pro_id, 'chave', k);
end $$;

-- De quem é o agendamento (só o servidor): o /api/desk confere antes de deixar a profissional mexer.
create or replace function public.desk_appt_pro_svc(p_email text, p_id uuid)
returns uuid language sql stable security definer set search_path to 'public' as $$
  select a.pro_id from biz_appointments a where a.id = p_id and a.client_email = lower(trim(coalesce(p_email, '')))
$$;

revoke all on function public.desk_acesso_criar_v2(text, text, text, text, text, uuid) from public;
grant execute on function public.desk_acesso_criar_v2(text, text, text, text, text, uuid) to anon, authenticated, service_role;
revoke all on function public.desk_appt_pro_svc(text, uuid) from public, anon, authenticated;
grant execute on function public.desk_appt_pro_svc(text, uuid) to service_role;
