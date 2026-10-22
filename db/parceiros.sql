-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- ACESSO NOMINAL DE PARCEIRO — CR-03 (2026-10-13). Scale Pods entra na Central com usuário próprio.
--
-- Como funciona: o parceiro tem um usuário Supabase Auth (e-mail + senha, criado pelo admin). Para
-- agir numa conta de cliente ele escolhe o cliente, recebe um código de 6 dígitos no e-mail dele,
-- confirma, e só então o servidor entrega a chave de conexão daquele cliente ao navegador dele.
-- Tudo fica registrado (quem, quando, qual cliente). Revogar apaga o usuário e trava a linha.
--
-- Padrões da casa: idempotente, RLS ligada sem policy, RPC SECURITY DEFINER, admin gated por
-- _gui_sched_ok(p_secret) (SCHED_SECRET), EXECUTE só para service_role (o servidor é a porta).
-- ════════════════════════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

create table if not exists public.parceiros (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  email         text unique not null,
  empresa       text not null default 'Scale Pods',
  tenants       text[] not null default '{}',
  auth_uid      uuid,
  criado_em     timestamptz not null default now(),
  revogado_em   timestamptz,
  ultimo_uso    timestamptz,
  ultimo_tenant text
);

create table if not exists public.parceiro_otps (
  id          uuid primary key default gen_random_uuid(),
  parceiro_id uuid not null references public.parceiros(id) on delete cascade,
  tenant      text not null,
  otp_hash    text not null,
  expira_em   timestamptz not null,
  usado_em    timestamptz,
  tentativas  int not null default 0,
  criado_em   timestamptz not null default now()
);
create index if not exists parceiro_otps_vivos on public.parceiro_otps (parceiro_id) where usado_em is null;

create table if not exists public.parceiro_eventos (
  id          bigserial primary key,
  parceiro_id uuid references public.parceiros(id) on delete set null,
  acao        text not null,        -- criado, revogado, tenants, otp_enviado, entrou, otp_errado, otp_expirado
  tenant      text,
  detalhe     text,
  criado_em   timestamptz not null default now()
);

alter table public.parceiros        enable row level security;
alter table public.parceiro_otps    enable row level security;
alter table public.parceiro_eventos enable row level security;
revoke all on public.parceiros, public.parceiro_otps, public.parceiro_eventos from anon, authenticated;
revoke all on sequence public.parceiro_eventos_id_seq from anon, authenticated;

-- ── ADMIN (Luis): listar · criar · revogar · tenants ─────────────────────────────────────────────
create or replace function public.parceiro_admin(p_secret text, p_acao text, p_dados jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v public.parceiros;
  v_tenants text[];
  v_ruins text[];
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;

  if p_acao = 'listar' then
    return jsonb_build_object('ok', true, 'parceiros', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.criado_em desc) from (
        select p.id, p.nome, p.email, p.empresa, p.tenants, p.auth_uid, p.criado_em, p.revogado_em, p.ultimo_uso, p.ultimo_tenant,
               (select count(*) from public.parceiro_eventos e where e.parceiro_id = p.id and e.acao = 'entrou') as entradas
        from public.parceiros p) x), '[]'::jsonb));
  end if;

  if p_acao = 'criar' then
    v_tenants := coalesce((select array_agg(lower(trim(t))) from jsonb_array_elements_text(coalesce(p_dados->'tenants', '[]'::jsonb)) t), '{}');
    -- só clientes que existem de verdade (a chave vem de client_credits)
    select array_agg(t) into v_ruins from unnest(v_tenants) t where not exists (select 1 from public.client_credits c where c.client_email = t);
    if v_ruins is not null then return jsonb_build_object('ok', false, 'erro', 'tenant', 'detalhe', array_to_string(v_ruins, ',')); end if;
    if length(trim(coalesce(p_dados->>'nome', ''))) = 0 or position('@' in coalesce(p_dados->>'email', '')) = 0 then
      return jsonb_build_object('ok', false, 'erro', 'dados');
    end if;
    insert into public.parceiros (nome, email, empresa, tenants, auth_uid)
    values (left(trim(p_dados->>'nome'), 80), lower(trim(p_dados->>'email')), coalesce(nullif(trim(p_dados->>'empresa'), ''), 'Scale Pods'), v_tenants, nullif(p_dados->>'auth_uid', '')::uuid)
    on conflict (email) do update set nome = excluded.nome, tenants = excluded.tenants, auth_uid = coalesce(excluded.auth_uid, parceiros.auth_uid), revogado_em = null
    returning * into v;
    insert into public.parceiro_eventos (parceiro_id, acao, detalhe) values (v.id, 'criado', array_to_string(v.tenants, ','));
    return jsonb_build_object('ok', true, 'parceiro', to_jsonb(v));
  end if;

  select * into v from public.parceiros where id = nullif(p_dados->>'id', '')::uuid;
  if not found then return jsonb_build_object('ok', false, 'erro', 'parceiro'); end if;

  if p_acao = 'revogar' then
    update public.parceiros set revogado_em = now() where id = v.id;
    update public.parceiro_otps set usado_em = now() where parceiro_id = v.id and usado_em is null;
    insert into public.parceiro_eventos (parceiro_id, acao) values (v.id, 'revogado');
    return jsonb_build_object('ok', true, 'auth_uid', v.auth_uid);
  end if;

  if p_acao = 'tenants' then
    v_tenants := coalesce((select array_agg(lower(trim(t))) from jsonb_array_elements_text(coalesce(p_dados->'tenants', '[]'::jsonb)) t), '{}');
    select array_agg(t) into v_ruins from unnest(v_tenants) t where not exists (select 1 from public.client_credits c where c.client_email = t);
    if v_ruins is not null then return jsonb_build_object('ok', false, 'erro', 'tenant', 'detalhe', array_to_string(v_ruins, ',')); end if;
    update public.parceiros set tenants = v_tenants where id = v.id;
    insert into public.parceiro_eventos (parceiro_id, acao, detalhe) values (v.id, 'tenants', array_to_string(v_tenants, ','));
    return jsonb_build_object('ok', true);
  end if;

  return jsonb_build_object('ok', false, 'erro', 'acao');
end $$;

-- ── PARCEIRO: quem sou (lista de clientes permitidos) ────────────────────────────────────────────
create or replace function public.parceiro_me_svc(p_email text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('ok', true, 'id', p.id, 'nome', p.nome, 'empresa', p.empresa, 'tenants', p.tenants,
           'nomes', (select jsonb_object_agg(c.client_email, coalesce(nullif(c.plan, ''), c.client_email)) from public.client_credits c where c.client_email = any(p.tenants)))
          from public.parceiros p where p.email = lower(trim(p_email)) and p.revogado_em is null),
         jsonb_build_object('ok', false, 'erro', 'parceiro'));
$$;

-- ── OTP: emitir (invalida os anteriores) ─────────────────────────────────────────────────────────
create or replace function public.parceiro_otp_emitir_svc(p_email text, p_tenant text, p_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.parceiros;
begin
  select * into v from public.parceiros where email = lower(trim(p_email)) and revogado_em is null;
  if not found then return jsonb_build_object('ok', false, 'erro', 'parceiro'); end if;
  if not (lower(trim(p_tenant)) = any(v.tenants)) then return jsonb_build_object('ok', false, 'erro', 'tenant'); end if;
  update public.parceiro_otps set usado_em = now() where parceiro_id = v.id and usado_em is null;
  insert into public.parceiro_otps (parceiro_id, tenant, otp_hash, expira_em) values (v.id, lower(trim(p_tenant)), p_hash, now() + interval '10 minutes');
  insert into public.parceiro_eventos (parceiro_id, acao, tenant) values (v.id, 'otp_enviado', lower(trim(p_tenant)));
  return jsonb_build_object('ok', true, 'nome', v.nome);
end $$;

-- ── OTP: conferir e entregar a chave do cliente ──────────────────────────────────────────────────
create or replace function public.parceiro_otp_conferir_svc(p_email text, p_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.parceiros; o public.parceiro_otps; v_key text;
begin
  select * into v from public.parceiros where email = lower(trim(p_email)) and revogado_em is null;
  if not found then return jsonb_build_object('ok', false, 'erro', 'parceiro'); end if;
  select * into o from public.parceiro_otps where parceiro_id = v.id and usado_em is null order by criado_em desc limit 1 for update;
  if not found then return jsonb_build_object('ok', false, 'erro', 'otp'); end if;
  if o.expira_em < now() then
    update public.parceiro_otps set usado_em = now() where id = o.id;
    insert into public.parceiro_eventos (parceiro_id, acao, tenant) values (v.id, 'otp_expirado', o.tenant);
    return jsonb_build_object('ok', false, 'erro', 'expirado');
  end if;
  if o.otp_hash <> p_hash then
    update public.parceiro_otps set tentativas = tentativas + 1, usado_em = case when tentativas + 1 >= 5 then now() end where id = o.id;
    insert into public.parceiro_eventos (parceiro_id, acao, tenant) values (v.id, 'otp_errado', o.tenant);
    return jsonb_build_object('ok', false, 'erro', 'otp');
  end if;
  update public.parceiro_otps set usado_em = now() where id = o.id;
  select access_key into v_key from public.client_credits where client_email = o.tenant;
  if v_key is null then return jsonb_build_object('ok', false, 'erro', 'chave'); end if;
  update public.parceiros set ultimo_uso = now(), ultimo_tenant = o.tenant where id = v.id;
  insert into public.parceiro_eventos (parceiro_id, acao, tenant) values (v.id, 'entrou', o.tenant);
  return jsonb_build_object('ok', true, 'tenant', o.tenant, 'nome', v.nome, 'empresa', v.empresa, 'key', v_key);
end $$;

revoke all on function public.parceiro_admin(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.parceiro_me_svc(text) from public, anon, authenticated;
revoke all on function public.parceiro_otp_emitir_svc(text, text, text) from public, anon, authenticated;
revoke all on function public.parceiro_otp_conferir_svc(text, text) from public, anon, authenticated;
grant execute on function public.parceiro_admin(text, text, jsonb) to service_role;
grant execute on function public.parceiro_me_svc(text) to service_role;
grant execute on function public.parceiro_otp_emitir_svc(text, text, text) to service_role;
grant execute on function public.parceiro_otp_conferir_svc(text, text) to service_role;

select 'parceiros' as tabela, count(*) from public.parceiros;
