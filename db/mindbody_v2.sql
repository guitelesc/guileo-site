-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- MINDBODY v2 — o banco da integração reescrita (functions/lib/mindbody*.js, scheduleAdapter.js,
-- functions/api/mindbody.js). Projeto ynihodbknhjirkdogxby. IDEMPOTENTE: pode rodar de novo.
--
-- PRÉ-REQUISITOS (já no ar): client_integrations + índice único (client_email, provider);
-- biz_* (db/scheduling_engine*.sql); biz_appointments.external_ref (db/schedule_adapter.sql);
-- crm_contacts.phone_key + _gui_phone_key (db/crm_phone_identity.sql). O bloco 0 confere e PARA
-- com uma frase clara se faltar — melhor que criar metade.
--
-- O QUE MUDA
--   1) mb_creds_lookup deixa de ser executável por anon. O blob guardado contém a SENHA do login
--      MindBody do cliente, e a chave anon é pública (está no bundle do site) — o único portão era
--      um literal que também está no repositório. Agora só o service_role lê.
--   2) O MAPA Guileo↔MindBody ganha TABELA PRÓPRIA (mb_mapping), fora do blob de credenciais.
--      POR QUE TABELA E NÃO UM CAMPO DENTRO DE tokens:
--        · reconectar regrava o blob (mb_creds_store faz `tokens = excluded.tokens`): o mapa
--          sumiria em silêncio e toda reserva voltaria a "a recepção confirma";
--        · o mapa é lido pela tela do cliente; o blob tem a senha. Separados, nenhuma leitura de
--          tela passa perto do segredo;
--        · o mapa tem ciclo de vida próprio (ativo/pausado, última sincronização).
--   3) Espelho com atributos (site, ids do MindBody) — sem isso cancelar/remarcar não acha o
--      agendamento de volta, e num cliente com dois sites o id sozinho é ambíguo.
--   4) Importação de clientes para o CRM + índice local (telefone → Client.Id do MindBody): a
--      busca da API (`searchText`) só cobre nome e e-mail segundo a documentação; é o índice que
--      deixa achar quem liga pelo TELEFONE sem criar cadastro duplicado no sistema do spa.
--
-- SEGURANÇA — igual em todas as funções abaixo: SECURITY DEFINER, `set search_path = public`,
-- portão pelo MESMO literal das RPCs MindBody existentes (INGEST), escopo por client_email,
-- e execução SÓ para service_role (revoke de public/anon/authenticated).
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- ── 0. pré-requisitos ───────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='crm_contacts' and column_name='phone_key') then
    raise exception 'mindbody_v2: falta crm_contacts.phone_key — aplique db/crm_phone_identity.sql antes';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='biz_appointments' and column_name='external_ref') then
    raise exception 'mindbody_v2: falta biz_appointments.external_ref — aplique db/schedule_adapter.sql antes';
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='client_integrations') then
    raise exception 'mindbody_v2: falta a tabela client_integrations';
  end if;
end $$;

alter table public.biz_appointments add column if not exists attributes jsonb not null default '{}'::jsonb;
alter table public.crm_contacts add column if not exists birth_date date;

-- ── 1. tabelas ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.mb_mapping (
  client_email text primary key,
  mapping      jsonb not null default '{}'::jsonb,   -- forma em functions/lib/mindbodyMapa.js
  updated_at   timestamptz not null default now(),
  synced_at    timestamptz                            -- última sincronização de volta que RODOU
);
alter table public.mb_mapping enable row level security;          -- sem policy: só as funções abaixo

create table if not exists public.mb_client_index (
  client_email text not null,
  site_id      text not null,
  mb_client_id text not null,                        -- Client.Id do MindBody (o que AddAppointment pede)
  phone_key    text,
  email        text,
  full_name    text,
  updated_at   timestamptz not null default now(),
  primary key (client_email, site_id, mb_client_id)
);
create index if not exists mb_client_index_fone  on public.mb_client_index (client_email, site_id, phone_key) where phone_key is not null;
create index if not exists mb_client_index_email on public.mb_client_index (client_email, site_id, lower(email)) where email is not null;
alter table public.mb_client_index enable row level security;

-- ── 2. credenciais ──────────────────────────────────────────────────────────────────────────
create or replace function public.mb_creds_lookup(p_secret text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return (select tokens from client_integrations where client_email = lower(trim(p_email)) and provider = 'mindbody' limit 1);
end $$;

-- Grava credenciais SOMANDO ao que já existe (nunca substitui o blob inteiro). Senha/usuário em
-- branco no patch NÃO apagam o que está gravado. `sites` e `logins` são fundidos chave a chave.
create or replace function public.mb_creds_save(p_secret text, p_email text, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_email,''))); v_old jsonb; v_new jsonb; v_patch jsonb := coalesce(p_patch,'{}'::jsonb);
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_email = '' or position('@' in v_email) < 2 then return jsonb_build_object('ok', false, 'motivo', 'sem_tenant'); end if;
  select tokens into v_old from client_integrations where client_email = v_email and provider = 'mindbody';
  v_old := coalesce(v_old, '{}'::jsonb);
  if coalesce(v_patch->>'source_name','') = ''     then v_patch := v_patch - 'source_name'; end if;
  if coalesce(v_patch->>'source_password','') = '' then v_patch := v_patch - 'source_password'; end if;
  v_new := v_old || (v_patch - 'sites' - 'logins' - 'site_ids');
  if jsonb_typeof(v_patch->'sites') = 'object'  then v_new := jsonb_set(v_new, '{sites}',  coalesce(v_old->'sites','{}'::jsonb)  || (v_patch->'sites')); end if;
  if jsonb_typeof(v_patch->'logins') = 'object' then v_new := jsonb_set(v_new, '{logins}', coalesce(v_old->'logins','{}'::jsonb) || (v_patch->'logins')); end if;
  if jsonb_typeof(v_patch->'site_ids') = 'array' then
    v_new := jsonb_set(v_new, '{site_ids}', (
      select coalesce(jsonb_agg(distinct x), '[]'::jsonb)
      from jsonb_array_elements_text(coalesce(v_old->'site_ids','[]'::jsonb) || (v_patch->'site_ids')) x where x <> ''));
  end if;
  insert into client_integrations (client_email, provider, tokens) values (v_email, 'mindbody', v_new)
  on conflict (client_email, provider) do update set tokens = excluded.tokens, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- Uma leitura só para o servidor: credenciais + mapa.
create or replace function public.mb_config(p_secret text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_email,''))); v_c jsonb; v_m jsonb; v_u timestamptz; v_s timestamptz;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select tokens into v_c from client_integrations where client_email = v_email and provider = 'mindbody' limit 1;
  select mapping, updated_at, synced_at into v_m, v_u, v_s from mb_mapping where client_email = v_email;
  return jsonb_build_object('creds', v_c, 'mapping', v_m, 'mapping_updated_at', v_u, 'synced_at', v_s);
end $$;

-- ── 3. mapa ─────────────────────────────────────────────────────────────────────────────────
create or replace function public.mb_mapping_save(p_secret text, p_email text, p_mapping jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_email,'')));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_email = '' or position('@' in v_email) < 2 then return jsonb_build_object('ok', false, 'motivo', 'sem_tenant'); end if;
  if jsonb_typeof(p_mapping) is distinct from 'object' then return jsonb_build_object('ok', false, 'motivo', 'mapa_invalido'); end if;
  insert into mb_mapping (client_email, mapping, updated_at) values (v_email, p_mapping, now())
  on conflict (client_email) do update set mapping = excluded.mapping, updated_at = now();
  return jsonb_build_object('ok', true, 'updated_at', now());
end $$;

-- Quem tem a integração LIGADA (mapa salvo e ativo) — a sincronização de volta percorre esta lista.
create or replace function public.mb_tenants(p_secret text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(m.client_email order by m.synced_at nulls first)
    from mb_mapping m
    where (m.mapping->>'ativo') = 'true'
      and exists (select 1 from client_integrations c where c.client_email = m.client_email and c.provider = 'mindbody')
  ), '[]'::jsonb);
end $$;

-- O catálogo da Guileo DESTE tenant, para a tela de mapa (ids + nomes + fuso da unidade).
create or replace function public.mb_guileo_catalog(p_secret text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_email,'')));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return jsonb_build_object(
    'locations', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'tz', tz) order by name)
                           from biz_locations where client_email = v_email and active), '[]'::jsonb),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'duration_min', duration_min) order by name)
                          from biz_services where client_email = v_email and active), '[]'::jsonb),
    'professionals', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name,
        'services',  (select coalesce(jsonb_agg(ps.service_id), '[]'::jsonb)  from biz_pro_services ps  where ps.pro_id = p.id),
        'locations', (select coalesce(jsonb_agg(pl.location_id), '[]'::jsonb) from biz_pro_locations pl where pl.pro_id = p.id)) order by p.name)
      from biz_professionals p where p.client_email = v_email and p.active), '[]'::jsonb));
end $$;

-- ── 4. espelho (biz_appointments, source = 'mindbody') ──────────────────────────────────────
-- external_ref = '<site_id>:<AppointmentId>' — o id do MindBody só é único DENTRO do site.
-- pro_id fica NULL (não disputa a EXCLUDE da agenda interna; quem deconflita é o MindBody).
-- service_id/location_id só entram se forem DESTE tenant.
create or replace function public.mb_mirror_upsert(
  p_secret text, p_email text, p_external_ref text, p_service_id uuid, p_location_id uuid,
  p_start timestamptz, p_end timestamptz, p_name text, p_contact text, p_attributes jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_email,''))); v_ref text := nullif(trim(coalesce(p_external_ref,'')), '');
        v_svc uuid; v_loc uuid; v_id uuid; v_end timestamptz := coalesce(p_end, p_start + interval '60 minutes');
        v_attr jsonb := coalesce(p_attributes, '{}'::jsonb);
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_email = '' or v_ref is null or p_start is null or v_end <= p_start then return jsonb_build_object('ok', false, 'motivo', 'pedido_incompleto'); end if;
  select id into v_svc from biz_services  where id = p_service_id  and client_email = v_email;
  select id into v_loc from biz_locations where id = p_location_id and client_email = v_email;

  update biz_appointments
     set span = tstzrange(p_start, v_end, '[)'),
         service_id = coalesce(v_svc, service_id), location_id = coalesce(v_loc, location_id),
         customer_name = coalesce(nullif(p_name,''), customer_name),
         customer_contact = coalesce(nullif(p_contact,''), customer_contact),
         attributes = coalesce(attributes, '{}'::jsonb) || v_attr,
         status = 'booked'
   where client_email = v_email and source = 'mindbody' and external_ref = v_ref
   returning id into v_id;
  if v_id is not null then return jsonb_build_object('ok', true, 'id', v_id, 'novo', false); end if;

  insert into biz_appointments (client_email, location_id, pro_id, service_id, customer_name, customer_contact, span, status, source, external_ref, attributes)
  values (v_email, v_loc, null, v_svc, nullif(p_name,''), nullif(p_contact,''), tstzrange(p_start, v_end, '[)'), 'booked', 'mindbody', v_ref, v_attr)
  on conflict (client_email, source, external_ref) where external_ref is not null
  do update set span = excluded.span, status = 'booked', attributes = coalesce(biz_appointments.attributes, '{}'::jsonb) || excluded.attributes
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'novo', true);
end $$;

-- Um agendamento DESTE tenant é espelho do MindBody? Devolve o que cancelar/remarcar precisam.
create or replace function public.mb_mirror_get(p_secret text, p_email text, p_appointment_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_email,''))); r record;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select a.id, a.source, a.external_ref, a.service_id, a.location_id, a.status, lower(a.span) as ini, upper(a.span) as fim,
         a.customer_name, a.customer_contact, coalesce(a.attributes, '{}'::jsonb) as attributes
    into r from biz_appointments a
   where a.id = p_appointment_id and a.client_email = v_email;
  if not found then return jsonb_build_object('ok', true, 'found', false); end if;
  return jsonb_build_object('ok', true, 'found', true, 'id', r.id, 'source', r.source, 'external_ref', r.external_ref,
    'service_id', r.service_id, 'location_id', r.location_id, 'status', r.status, 'start', r.ini, 'end', r.fim,
    'customer_name', r.customer_name, 'customer_contact', r.customer_contact, 'attributes', r.attributes);
end $$;

-- Espelhos que ainda importam para a sincronização: não cancelados, de 2 dias atrás em diante.
create or replace function public.mb_mirror_pending(p_secret text, p_email text, p_limit int default 500)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_email,'')));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(x order by x->>'start') from (
      select jsonb_build_object('id', a.id, 'external_ref', a.external_ref, 'status', a.status,
                                'start', lower(a.span), 'end', upper(a.span)) as x
        from biz_appointments a
       where a.client_email = v_email and a.source = 'mindbody' and a.external_ref is not null
         and a.status <> 'cancelled' and upper(a.span) > now() - interval '2 days'
       order by lower(a.span)
       limit greatest(1, least(coalesce(p_limit, 500), 2000))
    ) s), '[]'::jsonb);
end $$;

-- A sincronização grava o que o MindBody disse. p_status: 'cancelled' | 'no_show' | 'booked'.
-- p_start/p_end (opcionais) movem o espelho quando o horário mudou lá.
create or replace function public.mb_mirror_mark(
  p_secret text, p_email text, p_external_ref text, p_status text,
  p_start timestamptz default null, p_end timestamptz default null, p_mb_status text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_email,''))); n int;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if p_status not in ('cancelled', 'no_show', 'booked') then return jsonb_build_object('ok', false, 'motivo', 'status_invalido'); end if;
  update biz_appointments
     set status = p_status,
         span = case when p_start is not null and p_end is not null and p_end > p_start then tstzrange(p_start, p_end, '[)') else span end,
         attributes = coalesce(attributes, '{}'::jsonb) || jsonb_build_object('mb_status', coalesce(p_mb_status, p_status), 'mb_synced_at', now())
   where client_email = v_email and source = 'mindbody' and external_ref = p_external_ref;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', n > 0, 'linhas', n);
end $$;

create or replace function public.mb_sync_done(p_secret text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  update mb_mapping set synced_at = now() where client_email = lower(trim(coalesce(p_email,'')));
  return jsonb_build_object('ok', true);
end $$;

-- ── 5. índice local de clientes do MindBody ─────────────────────────────────────────────────
create or replace function public.mb_client_ids(p_secret text, p_email text, p_site_id text, p_phone text, p_contact_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_email,''))); v_key text := public._gui_phone_key(p_phone);
        v_mail text := nullif(lower(trim(coalesce(p_contact_email,''))), '');
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_key is not null and length(v_key) < 7 then v_key := null; end if;
  if v_key is null and v_mail is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(distinct i.mb_client_id) from mb_client_index i
     where i.client_email = v_email and i.site_id = p_site_id
       and ((v_key is not null and i.phone_key = v_key) or (v_mail is not null and lower(i.email) = v_mail))
  ), '[]'::jsonb);
end $$;

create or replace function public.mb_client_put(p_secret text, p_email text, p_site_id text, p_mb_client_id text, p_phone text, p_contact_email text, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_email,''))); v_key text := public._gui_phone_key(p_phone);
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_email = '' or coalesce(p_site_id,'') = '' or coalesce(p_mb_client_id,'') = '' then return jsonb_build_object('ok', false, 'motivo', 'pedido_incompleto'); end if;
  insert into mb_client_index (client_email, site_id, mb_client_id, phone_key, email, full_name)
  values (v_email, p_site_id, p_mb_client_id, v_key, nullif(lower(trim(coalesce(p_contact_email,''))), ''), nullif(trim(coalesce(p_name,'')), ''))
  on conflict (client_email, site_id, mb_client_id) do update
    set phone_key = coalesce(excluded.phone_key, mb_client_index.phone_key),
        email     = coalesce(excluded.email, mb_client_index.email),
        full_name = coalesce(excluded.full_name, mb_client_index.full_name),
        updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- ── 6. importação de clientes → CRM ─────────────────────────────────────────────────────────
-- p_rows = [{ mb_id, nome, telefone, email, nascimento (YYYY-MM-DD), ativo, aceita_sms, aceita_email }]
-- REGRAS
--   · acha o contato por (client_email, phone_key); sem telefone, por (client_email, lower(email));
--   · NUNCA troca um nome ou nascimento que existe por um vazio (coalesce do valor novo com o atual);
--   · e-mail/telefone só PREENCHEM o que está vazio — não trocam o que o CRM já tem;
--   · contato NOVO entra com consent_call = false e consent_sms = o que a pessoa marcou no
--     MindBody: quem só existe porque foi importado não autorizou ligação automática da Guileo;
--   · contato que já existia NÃO tem consentimento alterado;
--   · sem telefone E sem e-mail → não entra (não há como falar com a pessoa nem deduplicar);
--   · cada linha roda no seu próprio bloco: uma linha ruim não derruba o lote, e é CONTADA.
create or replace function public.mb_import_clients(p_secret text, p_email text, p_site_id text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_email,'')));
        r jsonb; v_id uuid; v_phone text; v_key text; v_mail text; v_name text; v_birth date; v_digits text;
        n_new int := 0; n_upd int := 0; n_skip int := 0; n_err int := 0; n_idx int := 0; v_first_err text := null;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_email = '' or position('@' in v_email) < 2 then return jsonb_build_object('ok', false, 'motivo', 'sem_tenant'); end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then return jsonb_build_object('ok', false, 'motivo', 'lote_invalido'); end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      v_digits := regexp_replace(coalesce(r->>'telefone',''), '[^0-9]', '', 'g');
      v_key := public._gui_phone_key(r->>'telefone');
      if v_key is not null and length(v_key) < 7 then v_key := null; end if;
      v_phone := case when v_key is null then null
                      when trim(coalesce(r->>'telefone','')) like '+%' then '+' || v_digits
                      when length(v_key) = 10 then '+1' || v_key
                      else v_digits end;
      v_mail := nullif(lower(trim(coalesce(r->>'email',''))), '');
      if v_mail is not null and v_mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then v_mail := null; end if;
      v_name := nullif(trim(coalesce(r->>'nome','')), '');
      v_birth := null;
      if coalesce(r->>'nascimento','') ~ '^\d{4}-\d{2}-\d{2}$' then
        begin v_birth := (r->>'nascimento')::date; exception when others then v_birth := null; end;
        if v_birth is not null and (v_birth < date '1900-01-01' or v_birth > current_date) then v_birth := null; end if;
      end if;

      -- índice local: entra mesmo quando o contato não vai para o CRM
      if coalesce(r->>'mb_id','') <> '' and coalesce(p_site_id,'') <> '' and (v_key is not null or v_mail is not null) then
        insert into mb_client_index (client_email, site_id, mb_client_id, phone_key, email, full_name)
        values (v_email, p_site_id, r->>'mb_id', v_key, v_mail, v_name)
        on conflict (client_email, site_id, mb_client_id) do update
          set phone_key = excluded.phone_key, email = excluded.email,
              full_name = coalesce(excluded.full_name, mb_client_index.full_name), updated_at = now();
        n_idx := n_idx + 1;
      end if;

      if v_key is null and v_mail is null then n_skip := n_skip + 1; continue; end if;

      v_id := null;
      if v_key is not null then
        select id into v_id from crm_contacts where client_email = v_email and phone_key = v_key limit 1;
      end if;
      if v_id is null and v_mail is not null then
        select id into v_id from crm_contacts where client_email = v_email and lower(email) = v_mail limit 1;
      end if;

      if v_id is null then
        insert into crm_contacts (client_email, phone, email, full_name, lifecycle, lead_source, visit_count, consent_sms, consent_call, birth_date, tags)
        values (v_email, v_phone, v_mail, v_name, 'active', 'mindbody', 0,
                coalesce((r->>'aceita_sms')::boolean, false), false, v_birth, '["mindbody"]'::jsonb);
        n_new := n_new + 1;
      else
        update crm_contacts c set
          full_name  = coalesce(v_name, c.full_name),
          birth_date = coalesce(v_birth, c.birth_date),
          phone = case when c.phone is null and v_phone is not null
                        and not exists (select 1 from crm_contacts o where o.client_email = v_email and o.id <> c.id and o.phone_key = v_key)
                       then v_phone else c.phone end,
          email = case when coalesce(c.email,'') = '' and v_mail is not null
                        and not exists (select 1 from crm_contacts o where o.client_email = v_email and o.id <> c.id and lower(o.email) = v_mail)
                       then v_mail else c.email end,
          tags = case when coalesce(c.tags, '[]'::jsonb) @> '["mindbody"]'::jsonb then c.tags else coalesce(c.tags, '[]'::jsonb) || '["mindbody"]'::jsonb end,
          updated_at = now()
        where c.id = v_id;
        n_upd := n_upd + 1;
      end if;
    exception when others then
      n_err := n_err + 1;
      if v_first_err is null then v_first_err := left(sqlerrm, 160); end if;
    end;
  end loop;
  return jsonb_build_object('ok', true, 'novos', n_new, 'atualizados', n_upd, 'sem_contato', n_skip, 'erros', n_err,
                            'indice', n_idx, 'primeiro_erro', v_first_err);
end $$;

-- ── 7. permissões: NADA para anon/authenticated/public; só service_role ─────────────────────
do $$
declare f text;
begin
  foreach f in array array[
    'public.mb_creds_lookup(text, text)',
    'public.mb_creds_save(text, text, jsonb)',
    'public.mb_config(text, text)',
    'public.mb_mapping_save(text, text, jsonb)',
    'public.mb_tenants(text)',
    'public.mb_guileo_catalog(text, text)',
    'public.mb_mirror_upsert(text, text, text, uuid, uuid, timestamptz, timestamptz, text, text, jsonb)',
    'public.mb_mirror_get(text, text, uuid)',
    'public.mb_mirror_pending(text, text, int)',
    'public.mb_mirror_mark(text, text, text, text, timestamptz, timestamptz, text)',
    'public.mb_sync_done(text, text)',
    'public.mb_client_ids(text, text, text, text, text)',
    'public.mb_client_put(text, text, text, text, text, text, text)',
    'public.mb_import_clients(text, text, text, jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
  -- o gravador antigo (substitui o blob inteiro) também sai do alcance do anon, se existir
  if to_regprocedure('public.mb_creds_store(text, text, jsonb)') is not null then
    execute 'revoke all on function public.mb_creds_store(text, text, jsonb) from public, anon, authenticated';
    execute 'grant execute on function public.mb_creds_store(text, text, jsonb) to service_role';
  end if;
end $$;
revoke all on table public.mb_mapping, public.mb_client_index from public, anon, authenticated;

-- ── PROVA (rodar depois de aplicar; nada aqui escreve) ──────────────────────────────────────
--   -- 1) anon não executa mais a leitura de credenciais (tem que voltar 0 linhas):
--   select grantee from information_schema.routine_privileges
--    where routine_schema='public' and routine_name like 'mb\_%' and grantee in ('anon','authenticated','PUBLIC');
--   -- 2) service_role executa todas (tem que listar as 14 + mb_creds_store):
--   select routine_name from information_schema.routine_privileges
--    where routine_schema='public' and routine_name like 'mb\_%' and grantee='service_role' order by 1;

notify pgrst, 'reload schema';
