-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- ASSINATURA ELETRÔNICA PRÓPRIA — v2 (2026-10-04)
--
-- 👉 COMO APLICAR (Luis):
--    1. Abra o Supabase do projeto ynihodbknhjirkdogxby → SQL Editor → New query.
--    2. Cole ESTE ARQUIVO INTEIRO e clique em Run. Pode rodar duas vezes: nada duplica, nada
--       apaga, nenhum contrato existente muda.
--    3. Rode a VERIFICAÇÃO lá no fim deste arquivo (está comentada — copie só ela). Tem que
--       voltar: 10 colunas novas, 5 funções novas e o gatilho `contracts_trava`.
--    4. Faça o deploy do site (cd /Users/guiteles/guileo-site && npx vite build &&
--       npx wrangler pages deploy dist --project-name=guileoai --branch=main).
--    5. SÓ DEPOIS do deploy, rode o PASSO 2 (também comentado no fim) — ele tira do `anon` a
--       função que grava contrato. Rodar antes do deploy derrubaria o "salvar contrato" do site
--       que ainda está no ar, que fala como anon.
--
--    Ordem trocada não quebra nada: se o site novo subir ANTES deste SQL, a assinatura continua
--    funcionando como hoje e a página avisa que o "registro avançado" ainda não está ativo.
--
-- O QUE ISTO FAZ:
--   • colunas novas em public.contracts: impressão digital SHA-256 do documento, navegador de quem
--     assinou, e a assinatura do PRESTADOR (ORIGEM LTDA) com nome, cargo, hora, IP e o hash do que
--     ele assinou;
--   • gatilho `contracts_trava`: depois que alguém assinou (prestador ou cliente), corpo, título,
--     idioma, valor e as assinaturas NÃO mudam mais — por nenhum caminho, inclusive contract_upsert.
--     A recusa é clara: "contrato_travado: ...". Para corrigir, cria-se uma NOVA versão;
--   • contract_get                (admin, service_role) — lê um contrato do tenant para assinar;
--   • contract_provider_sign      (admin, service_role) — o prestador assina PRIMEIRO;
--   • contract_by_token_v2        (página /sign, service_role) — o documento + os dois registros;
--   • contrato_assinar_v2         (página /sign, service_role) — assinatura do cliente com hash;
--   • contrato_assinar / contract_sign_token (antigas, mesma assinatura) passam a RECUSAR documentos
--     marcados com body.provider_signs_first = true — esses só se assinam pelo caminho novo, com
--     hash e com o prestador já assinado. Para todo o resto, comportamento idêntico ao de hoje.
--
-- O HASH é calculado no servidor do site (Cloudflare, crypto.subtle) sobre o JSON CANÔNICO de
-- { body, title, lang } — chaves em ordem alfabética, sem espaços. Qualquer pessoa reproduz:
-- é o mesmo algoritmo que a própria página roda no navegador para conferir.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1) COLUNAS (todas opcionais → o código que está no ar hoje não percebe nada) ──────────────
alter table public.contracts add column if not exists body_sha256           text;
alter table public.contracts add column if not exists signer_user_agent     text;
alter table public.contracts add column if not exists provider_entity       text;
alter table public.contracts add column if not exists provider_signer_name  text;
alter table public.contracts add column if not exists provider_signer_title text;
alter table public.contracts add column if not exists provider_signed_at    timestamptz;
alter table public.contracts add column if not exists provider_ip           text;
alter table public.contracts add column if not exists provider_user_agent   text;
alter table public.contracts add column if not exists provider_body_sha256  text;
alter table public.contracts add column if not exists hash_algo             text;

-- ── 2) A TRAVA — documento assinado não muda, por caminho nenhum ─────────────────────────────
create or replace function public._contracts_trava()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status = 'signed' or old.signed_at is not null or old.provider_signed_at is not null then
    if new.body is distinct from old.body
       or new.title is distinct from old.title
       or new.lang is distinct from old.lang
       or new.amount_cents is distinct from old.amount_cents then
      raise exception 'contrato_travado: este documento já foi assinado — corpo, título, idioma e valor não podem mudar. Crie uma nova versão.'
        using errcode = 'P0001';
    end if;
    -- uma assinatura dada não se desfaz nem se reescreve
    if old.provider_signed_at is not null and (
         new.provider_signed_at is distinct from old.provider_signed_at
      or new.provider_signer_name is distinct from old.provider_signer_name
      or new.provider_signer_title is distinct from old.provider_signer_title
      or new.provider_entity is distinct from old.provider_entity
      or new.provider_ip is distinct from old.provider_ip
      or new.provider_body_sha256 is distinct from old.provider_body_sha256) then
      raise exception 'contrato_travado: a assinatura do prestador já foi registrada e não pode ser alterada.' using errcode = 'P0001';
    end if;
  end if;
  -- signed_at, não só status: um contrato assinado e depois anulado (void) continua com a
  -- assinatura intocável, e não volta a "sent" para ser assinado de novo.
  if old.status = 'signed' or old.signed_at is not null then
    if new.status not in ('signed', 'void')
       or new.signer_name is distinct from old.signer_name
       or new.signed_at is distinct from old.signed_at
       or new.signer_ip is distinct from old.signer_ip
       or new.body_sha256 is distinct from old.body_sha256 then
      raise exception 'contrato_travado: a assinatura do cliente já foi registrada e não pode ser alterada.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists contracts_trava on public.contracts;
create trigger contracts_trava before update on public.contracts
  for each row execute function public._contracts_trava();

-- ── 3) ADMIN: ler um contrato do tenant (para o servidor calcular o hash antes de assinar) ────
create or replace function public.contract_get(p_secret text, p_email text, p_id uuid)
returns table(id uuid, lang text, title text, body jsonb, status text, updated_at timestamptz,
              provider_signed_at timestamptz, sign_token text, counterparty_email text)
language plpgsql security definer set search_path = public as $$
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  return query select c.id, c.lang, c.title, c.body, c.status, c.updated_at, c.provider_signed_at, c.sign_token, c.counterparty_email
    from contracts c where c.id = p_id and c.client_email = lower(trim(p_email)) limit 1;
end $$;

-- ── 4) ADMIN: o PRESTADOR assina primeiro ───────────────────────────────────────────────────────
-- p_expected_updated_at = o updated_at que o servidor leu ao calcular o hash. Se o documento mudou
-- entre a leitura e a assinatura, recusa — o hash gravado é SEMPRE do texto assinado.
create or replace function public.contract_provider_sign(
  p_secret text, p_email text, p_id uuid, p_entity text, p_signer_name text, p_signer_title text,
  p_ip text, p_user_agent text, p_body_sha256 text, p_expected_updated_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v contracts%rowtype;
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  if coalesce(trim(p_signer_name),'') = '' then return jsonb_build_object('ok', false, 'motivo', 'nome_vazio'); end if;
  if coalesce(p_body_sha256,'') !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok', false, 'motivo', 'hash_invalido'); end if;
  select * into v from contracts c where c.id = p_id and c.client_email = lower(trim(p_email)) for update;
  if v.id is null then return jsonb_build_object('ok', false, 'motivo', 'nao_encontrado'); end if;
  if v.provider_signed_at is not null then
    return jsonb_build_object('ok', false, 'motivo', 'prestador_ja_assinou', 'quando', v.provider_signed_at, 'hash', v.provider_body_sha256);
  end if;
  if v.status not in ('draft','sent') then return jsonb_build_object('ok', false, 'motivo', 'status_' || v.status); end if;
  if p_expected_updated_at is null or v.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'motivo', 'documento_mudou');
  end if;
  update contracts set
    provider_entity = left(coalesce(nullif(trim(p_entity),''), 'ORIGEM LTDA'), 160),
    provider_signer_name = left(trim(p_signer_name), 120),
    provider_signer_title = left(coalesce(trim(p_signer_title),''), 120),
    provider_signed_at = now(),
    provider_ip = left(coalesce(p_ip,''), 60),
    provider_user_agent = left(coalesce(p_user_agent,''), 400),
    provider_body_sha256 = p_body_sha256,
    hash_algo = 'sha256:canonical-json{body,title,lang}',
    status = case when status = 'draft' then 'sent' else status end,
    audit = coalesce(audit, '[]'::jsonb) || jsonb_build_object('event','provider_signed','at', now(),
              'name', left(trim(p_signer_name),120), 'ip', left(coalesce(p_ip,''),60), 'sha256', p_body_sha256),
    updated_at = now()
  where id = v.id returning * into v;
  return jsonb_build_object('ok', true, 'id', v.id, 'quando', v.provider_signed_at, 'hash', v.provider_body_sha256,
                            'sign_token', v.sign_token, 'status', v.status);
end $$;

-- ── 5) PÚBLICO (via servidor): o documento + os registros, para a página /sign ────────────────
create or replace function public.contract_by_token_v2(p_token text)
returns table(id uuid, doc_kind text, lang text, title text, counterparty_name text, amount_cents bigint, body jsonb,
              status text, signer_name text, signed_at timestamptz, signer_ip text, body_sha256 text,
              provider_entity text, provider_signer_name text, provider_signer_title text, provider_signed_at timestamptz,
              provider_ip text, provider_body_sha256 text, updated_at timestamptz, parent_title text)
language plpgsql security definer set search_path = public as $$
begin
  if p_token is null or length(p_token) < 24 then return; end if;
  return query select c.id, c.doc_kind, c.lang, c.title, c.counterparty_name, c.amount_cents, c.body,
      c.status, c.signer_name, c.signed_at, c.signer_ip, c.body_sha256,
      c.provider_entity, c.provider_signer_name, c.provider_signer_title, c.provider_signed_at,
      c.provider_ip, c.provider_body_sha256, c.updated_at,
      (select p.title from contracts p
        where p.id = (case when (c.body->>'parent_contract_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                            then (c.body->>'parent_contract_id')::uuid end)
          and p.client_email = c.client_email limit 1)
    from contracts c where c.sign_token = p_token limit 1;
end $$;

-- ── 6) PÚBLICO (via servidor): o cliente assina, com hash ─────────────────────────────────────
create or replace function public.contrato_assinar_v2(
  p_token text, p_signer_name text, p_ip text, p_user_agent text, p_body_sha256 text, p_expected_updated_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v contracts%rowtype;
begin
  if p_token is null or length(p_token) < 24 or coalesce(trim(p_signer_name),'') = '' then
    return jsonb_build_object('ok', false, 'motivo', 'token_ou_nome_invalido');
  end if;
  if coalesce(p_body_sha256,'') !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok', false, 'motivo', 'hash_invalido'); end if;
  select * into v from contracts c where c.sign_token = p_token for update;
  if v.id is null or v.status not in ('sent','draft') then
    return jsonb_build_object('ok', false, 'motivo', 'link_invalido_ou_ja_assinado');
  end if;
  if (v.body->'provider_signs_first') = 'true'::jsonb and v.provider_signed_at is null then
    return jsonb_build_object('ok', false, 'motivo', 'aguardando_prestador');
  end if;
  if p_expected_updated_at is null or v.updated_at <> p_expected_updated_at then
    return jsonb_build_object('ok', false, 'motivo', 'documento_mudou');
  end if;
  if v.provider_body_sha256 is not null and v.provider_body_sha256 <> p_body_sha256 then
    return jsonb_build_object('ok', false, 'motivo', 'documento_mudou');
  end if;
  update contracts set status='signed', signer_name=left(trim(p_signer_name),120), signed_at=now(),
    signer_ip=left(coalesce(p_ip,''),60), signer_user_agent=left(coalesce(p_user_agent,''),400),
    body_sha256=p_body_sha256, hash_algo='sha256:canonical-json{body,title,lang}',
    audit = coalesce(audit,'[]'::jsonb) || jsonb_build_object('event','signed','at', now(),
              'name', left(trim(p_signer_name),120), 'ip', left(coalesce(p_ip,''),60), 'sha256', p_body_sha256),
    updated_at=now()
  where id = v.id returning * into v;
  return jsonb_build_object(
    'ok', true, 'id', v.id, 'dono', v.client_email, 'cliente', v.counterparty_name, 'cliente_email', v.counterparty_email,
    'titulo', v.title, 'lang', v.lang, 'valor', round(coalesce(v.amount_cents,0)/100.0, 2),
    'assinante', v.signer_name, 'quando', v.signed_at, 'ip', v.signer_ip, 'hash', v.body_sha256,
    'prestador_entidade', v.provider_entity, 'prestador_nome', v.provider_signer_name, 'prestador_cargo', v.provider_signer_title,
    'prestador_quando', v.provider_signed_at, 'prestador_ip', v.provider_ip);
end $$;

-- ── 7) AS ANTIGAS (mesma assinatura → os grants atuais continuam) recusam o que é do caminho novo ──
create or replace function public.contrato_assinar(p_token text, p_signer_name text, p_ip text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row contracts%rowtype;
begin
  if p_token is null or length(p_token) < 24 or coalesce(trim(p_signer_name),'') = '' then
    return jsonb_build_object('ok', false, 'motivo', 'token_ou_nome_invalido');
  end if;
  -- documento do caminho novo (prestador assina primeiro + hash) não se assina por aqui
  if exists (select 1 from contracts c where c.sign_token = p_token
               and (c.body->'provider_signs_first') = 'true'::jsonb) then
    return jsonb_build_object('ok', false, 'motivo', 'aguardando_prestador');
  end if;

  update contracts set status='signed', signer_name=left(p_signer_name,120), signed_at=now(),
    signer_ip=left(coalesce(p_ip,''),60),
    audit = coalesce(audit,'{}'::jsonb) || jsonb_build_object('event','signed','at', now(),
              'name', left(p_signer_name,120), 'ip', left(coalesce(p_ip,''),60)),
    updated_at=now()
  where sign_token = p_token and status in ('sent','draft')
  returning * into v_row;

  -- Assinar duas vezes não é erro do cliente: ele clicou de novo. A 1ª assinatura NÃO é
  -- sobrescrita (o WHERE exige sent/draft) e o motivo viaja, em vez de um `false` mudo.
  if v_row.id is null then return jsonb_build_object('ok', false, 'motivo', 'link_invalido_ou_ja_assinado'); end if;

  return jsonb_build_object(
    'ok', true, 'id', v_row.id,
    'dono', v_row.client_email,
    'cliente', v_row.counterparty_name,
    'cliente_email', v_row.counterparty_email,
    'titulo', v_row.title,
    'valor', round(coalesce(v_row.amount_cents,0)/100.0, 2),
    'assinante', v_row.signer_name,
    'quando', v_row.signed_at);
end $$;

create or replace function public.contract_sign_token(p_token text, p_signer_name text, p_ip text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_token is null or length(p_token) < 24 or coalesce(trim(p_signer_name),'') = '' then return false; end if;
  update contracts set status='signed', signer_name=left(p_signer_name,120), signed_at=now(), signer_ip=left(coalesce(p_ip,''),60),
    audit = audit || jsonb_build_object('event','signed','at', now(), 'name', left(p_signer_name,120), 'ip', left(coalesce(p_ip,''),60)),
    updated_at=now()
  where sign_token = p_token and status in ('sent','draft')
    and (body->'provider_signs_first') is distinct from 'true'::jsonb;
  return found;
end $$;

-- ── 8) SOBRECARGAS VELHAS das funções novas (se uma versão anterior deste arquivo criou outra
--      assinatura, ela sai — evita "function is not unique") ───────────────────────────────────
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('contract_get','contract_provider_sign','contract_by_token_v2','contrato_assinar_v2')
  loop
    if (r.proname = 'contract_get' and r.args <> 'p_secret text, p_email text, p_id uuid')
    or (r.proname = 'contract_provider_sign' and r.args <> 'p_secret text, p_email text, p_id uuid, p_entity text, p_signer_name text, p_signer_title text, p_ip text, p_user_agent text, p_body_sha256 text, p_expected_updated_at timestamp with time zone')
    or (r.proname = 'contract_by_token_v2' and r.args <> 'p_token text')
    or (r.proname = 'contrato_assinar_v2' and r.args <> 'p_token text, p_signer_name text, p_ip text, p_user_agent text, p_body_sha256 text, p_expected_updated_at timestamp with time zone')
    then
      execute 'drop function ' || r.sig::text;
    end if;
  end loop;
end $$;

-- ── 9) PERMISSÕES — funções novas: SÓ o servidor (service_role) ───────────────────────────────
revoke all on function public._contracts_trava() from public, anon, authenticated;
revoke all on function public.contract_get(text,text,uuid) from public, anon, authenticated;
revoke all on function public.contract_provider_sign(text,text,uuid,text,text,text,text,text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.contract_by_token_v2(text) from public, anon, authenticated;
revoke all on function public.contrato_assinar_v2(text,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.contract_get(text,text,uuid) to service_role;
grant execute on function public.contract_provider_sign(text,text,uuid,text,text,text,text,text,text,timestamptz) to service_role;
grant execute on function public.contract_by_token_v2(text) to service_role;
grant execute on function public.contrato_assinar_v2(text,text,text,text,text,timestamptz) to service_role;
-- As antigas mantêm exatamente o acesso de hoje (o site no ar ainda as chama como anon):
grant execute on function public.contract_by_token(text) to anon, service_role;
grant execute on function public.contrato_assinar(text,text,text) to anon, service_role;
grant execute on function public.contract_sign_token(text,text,text) to anon, service_role;
grant execute on function public.contract_upsert(text,text,uuid,text,text,text,text,text,text,text,bigint,jsonb,text,uuid) to service_role;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- ✅ VERIFICAÇÃO (copie e rode depois do Run acima — só lê):
--
-- select
--   (select count(*) from information_schema.columns where table_schema='public' and table_name='contracts'
--      and column_name in ('body_sha256','signer_user_agent','provider_entity','provider_signer_name','provider_signer_title',
--                          'provider_signed_at','provider_ip','provider_user_agent','provider_body_sha256','hash_algo')) as colunas_novas_10,
--   (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
--      and p.proname in ('contract_get','contract_provider_sign','contract_by_token_v2','contrato_assinar_v2','_contracts_trava')) as funcoes_5,
--   (select count(*) from pg_trigger where tgname='contracts_trava' and tgrelid='public.contracts'::regclass) as gatilho_1,
--   has_function_privilege('anon','public.contrato_assinar_v2(text,text,text,text,text,timestamptz)','execute') as anon_v2_deve_ser_false,
--   has_function_privilege('anon','public.contract_by_token(text)','execute') as anon_pagina_antiga_deve_ser_true;
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 🔒 PASSO 2 — SÓ DEPOIS DO DEPLOY do site novo (ele grava contrato pelo service_role):
--
-- revoke execute on function public.contract_upsert(text,text,uuid,text,text,text,text,text,text,text,bigint,jsonb,text,uuid) from public, anon, authenticated;
-- grant  execute on function public.contract_upsert(text,text,uuid,text,text,text,text,text,text,text,bigint,jsonb,text,uuid) to service_role;
--
-- Prova: no /admin, salve um rascunho de contrato — tem que voltar um id. Se voltar 503 com
-- "permission denied", a env SUPABASE_SERVICE_ROLE do Cloudflare não está setada: rode o
-- grant ... to anon de volta e avise.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
