-- ─────────────────────────────────────────────────────────────────────────────
-- SOCIAL SWEEP — o que faltava para um post APROVADO realmente sair.
--
-- O QUE ESTAVA QUEBRADO (achado por revisão adversarial 2026-08-11):
--   db/social_posts.sql já tinha `social_posts_claim_due` (vira 'scheduled' vencido em 'draft'),
--   e o rodapé de functions/api/social-publish.js DESCREVIA a varredura que publica. Mas a
--   varredura existia só nesse COMENTÁRIO: `social_posts_claim_due` não tinha nenhum chamador em
--   todo o repo, e functions/api/cron-tick.js não tinha uma linha de social. Consequência real:
--     • post agendado ficava 'scheduled' para sempre — nunca virava 'draft', nunca publicava;
--     • post aprovado no cockpit com o app Meta ainda inerte virava 'draft' e MORRIA ali, mesmo
--       depois de a Meta entrar no ar — enquanto a tela prometia ao dono, em letras claras,
--       "sai no instante em que o Meta estiver no ar".
--   Este arquivo dá à varredura a trava atômica que faltava; o chamador é a action `sweep` de
--   functions/api/social-publish.js (DIGEST-gated), ligada no cron-tick.
--
-- A TRAVA (por que não publica duas vezes): Instagram/Facebook NÃO aceitam chave de idempotência,
-- então a única defesa é RESERVAR ANTES DE ENVIAR. `social_posts_claim_publish` faz isso num
-- ÚNICO update atômico: carimba meta.publish_claim_at e devolve só as linhas que ELE ganhou.
-- Dois ticks concorrentes → um leva a linha, o outro leva zero. Linha com external_id (já publicada)
-- nunca é reservada. A re-reserva só volta a ser possível depois de 30 min, e mesmo assim a linha
-- publicada de verdade já saiu de 'draft'.
--
-- Também corrige aqui: `meta_creds_get`, que functions/api/meta-connect.js (action:"status") chama
-- desde sempre e NUNCA existiu no banco — o painel do admin respondia `ok:true, connected:false`
-- para páginas que estavam perfeitamente conectadas.
--
-- INGEST-gated por literal (Supabase proíbe GUC), SECURITY DEFINER, idempotente, EXCEPTION-safe.
-- ─────────────────────────────────────────────────────────────────────────────

-- ══ 1) RESERVAR para publicar — a trava anti-post-duplicado ═══════════════════════════════════
-- Reserva atomicamente as linhas 'draft' (= aprovadas e prontas) desta/de todas as tenants.
-- 'draft' é o estado que social_post_approve produz e o que o modo auto cria; ambos significam
-- "pode ir ao ar". Devolve as linhas RESERVADAS (jsonb array) — só quem recebeu a linha publica.
--   • external_id not null  → já está na Meta, nunca reserva (nem depois dos 30 min).
--   • publish_claim_at < now()-30min → reserva de novo (um tick que morreu no meio não trava o post
--     para sempre). Janela de risco assumida e documentada: se o processo cair DEPOIS de a Meta
--     aceitar e ANTES de gravar o external_id, a linha volta a ser elegível em 30 min. Por isso o
--     conector, ao falhar em gravar o sucesso, marca a linha como 'failed' com o external_id no
--     texto do erro — em vez de deixá-la 'draft' e republicável.
create or replace function public.social_posts_claim_publish(
  p_secret text, p_email text default null, p_limit int default 25
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_tenant text := lower(trim(coalesce(p_email,''))); v_out jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  -- FORMA OBRIGATÓRIA. Um UPDATE ... RETURNING só pode viver numa CTE, e essa CTE tem de ser o
  -- NÍVEL MAIS ALTO do comando (`with ... select ... into`). Envolvê-la num `return coalesce((...))`
  -- compila e explode em tempo de execução com "WITH clause containing a data-modifying statement
  -- must be at the top level" — foi exatamente assim que social_posts_claim_due passou pela revisão
  -- e nunca funcionou (provado chamando a função em 2026-08-11). Compilar não é funcionar.
  with claimed as (
    update public.social_posts s
      set meta = coalesce(s.meta,'{}'::jsonb) || jsonb_build_object('publish_claim_at', now()),
          updated_at = now()
    where s.id in (
      select id from public.social_posts
      where status = 'draft'
        and external_id is null
        and (v_tenant = '' or client_email = v_tenant)
        and (
          meta->>'publish_claim_at' is null
          or (meta->>'publish_claim_at')::timestamptz < now() - interval '30 minutes'
        )
      order by created_at asc
      limit greatest(1, least(coalesce(p_limit,25), 100))
      for update skip locked
    )
    returning *
  )
  select jsonb_agg(to_jsonb(claimed)) into v_out from claimed;
  return coalesce(v_out, '[]'::jsonb);
exception when undefined_table then return '[]'::jsonb;
end $$;
grant execute on function public.social_posts_claim_publish(text, text, int) to anon;

-- ══ 2) LER (sem reservar) — o modo seco da varredura ══════════════════════════════════════════
-- `?seco=1` precisa mostrar EXATAMENTE o que publicaria sem mudar uma vírgula no banco. Reservar
-- em modo seco carimbaria as linhas e faria a run real seguinte pular tudo por 30 min — um dry-run
-- que estraga a run de verdade é pior que não ter dry-run.
create or replace function public.social_posts_pending_publish(
  p_secret text, p_email text default null, p_limit int default 25
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_tenant text := lower(trim(coalesce(p_email,'')));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(t) order by t.created_at asc)
    from (
      select * from public.social_posts
      where status = 'draft' and external_id is null
        and (v_tenant = '' or client_email = v_tenant)
      order by created_at asc
      limit greatest(1, least(coalesce(p_limit,25), 100))
    ) t
  ), '[]'::jsonb);
exception when undefined_table then return '[]'::jsonb;
end $$;
grant execute on function public.social_posts_pending_publish(text, text, int) to anon;

-- ══ 2a) LER os agendados vencidos, sem liberar ═══════════════════════════════════════════════
-- Gêmeo de leitura de social_posts_claim_due, pelo mesmo motivo do item 2: em `?seco=1` a
-- varredura precisa dizer quantos posts agendados ESTÃO vencidos sem virá-los em 'draft'.
create or replace function public.social_posts_due_scheduled(
  p_secret text, p_email text default null, p_limit int default 50
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_tenant text := lower(trim(coalesce(p_email,'')));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(t) order by t.scheduled_at asc)
    from (
      select * from public.social_posts
      where status = 'scheduled' and scheduled_at is not null and scheduled_at <= now()
        and (v_tenant = '' or client_email = v_tenant)
      order by scheduled_at asc
      limit greatest(1, least(coalesce(p_limit,50), 200))
    ) t
  ), '[]'::jsonb);
exception when undefined_table then return '[]'::jsonb;
end $$;
grant execute on function public.social_posts_due_scheduled(text, text, int) to anon;

-- ══ 2b) CONSERTO de social_posts_claim_due (mora em db/social_posts.sql, mas está QUEBRADA) ═══
-- A função existe no banco e NUNCA funcionou: seu corpo é `return coalesce(( with claimed as
-- (update…) select … ), '[]')`, e o Postgres recusa isso em tempo de EXECUÇÃO —
--   ERROR 0A000: WITH clause containing a data-modifying statement must be at the top level.
-- Ou seja: a varredura de posts agendados não só não tinha chamador (o defeito conhecido) — se
-- alguém a tivesse chamado, ela teria estourado. Provado chamando a função direto no banco
-- (2026-08-11). Consertada aqui porque a action `sweep` deste motor depende dela; a correção é a
-- mesma forma `with … select … into`. Comportamento e assinatura idênticos, só a forma muda.
create or replace function public.social_posts_claim_due(p_secret text, p_email text default null, p_limit int default 50)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_tenant text := lower(trim(coalesce(p_email,''))); v_out jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  with claimed as (
    update public.social_posts s
      set status = 'draft',
          meta = coalesce(s.meta,'{}'::jsonb) || jsonb_build_object('scheduled_fired_at', now()),
          updated_at = now()
    where s.id in (
      select id from public.social_posts
      where status = 'scheduled' and scheduled_at is not null and scheduled_at <= now()
        and (v_tenant = '' or client_email = v_tenant)
      order by scheduled_at asc
      limit greatest(1, least(coalesce(p_limit,50), 200))
      for update skip locked
    )
    returning *
  )
  select jsonb_agg(to_jsonb(claimed)) into v_out from claimed;
  return coalesce(v_out, '[]'::jsonb);
exception when undefined_table then return '[]'::jsonb;
end $$;
grant execute on function public.social_posts_claim_due(text, text, int) to anon;

-- ══ 2c) AGENDAR UMA VEZ SÓ — idempotência derivada do CONTEÚDO ════════════════════════════════
-- `action:"schedule"` chamava social_post_create direto: dois cliques (ou um retry depois de um
-- timeout) criavam DUAS linhas 'scheduled' idênticas. Até hoje isso era inofensivo, porque nada
-- publicava post agendado. Com a varredura ligada, as duas linhas viram DOIS posts iguais no perfil
-- do cliente — o defeito que a onda anterior fechou no aprovar-editado, entrando pela outra porta.
-- A chave de dedupe é o BODY (tenant + canal + hash do conteúdo + horário), NUNCA um timestamp de
-- chegada: é o retry que repete o corpo, então é o corpo que tem de decidir.
create unique index if not exists social_posts_agendado_unico
  on public.social_posts (client_email, channel, md5(content), scheduled_at)
  where status in ('scheduled','pending_approval','draft');

create or replace function public.social_post_schedule_once(
  p_secret text, p_email text, p_channel text, p_content text,
  p_media_url text default null, p_scheduled_at timestamptz default null, p_meta jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_tenant text := lower(trim(p_email)); v_ch text; v_row public.social_posts%rowtype;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant is null or v_tenant = '' or position('@' in v_tenant) = 0 then raise exception 'bad tenant' using errcode = '22023'; end if;
  v_ch := case when lower(coalesce(p_channel,'')) in ('facebook','fb') then 'facebook' else 'instagram' end;

  insert into public.social_posts (client_email, channel, content, media_url, status, scheduled_at, meta)
  values (v_tenant, v_ch, coalesce(p_content,''), nullif(trim(coalesce(p_media_url,'')),''), 'scheduled', p_scheduled_at,
          coalesce(p_meta,'{}'::jsonb) || jsonb_build_object('generated_by','guileo'))
  on conflict do nothing
  returning * into v_row;

  if found then return to_jsonb(v_row) || jsonb_build_object('_duplicado', false); end if;

  -- Já existia uma linha VIVA idêntica: devolve ELA. Um agendamento repetido não é erro para o
  -- dono — é o mesmo post, e ele precisa ver o mesmo id, não uma segunda cópia.
  select * into v_row from public.social_posts
   where client_email = v_tenant and channel = v_ch and md5(content) = md5(coalesce(p_content,''))
     and scheduled_at is not distinct from p_scheduled_at
     and status in ('scheduled','pending_approval','draft')
   limit 1;
  if not found then return null; end if;
  return to_jsonb(v_row) || jsonb_build_object('_duplicado', true);
exception when undefined_table then return null;
end $$;
grant execute on function public.social_post_schedule_once(text, text, text, text, text, timestamptz, jsonb) to anon;

-- ══ 3) meta_creds_get — a RPC que o /admin chamava e não existia ══════════════════════════════
-- functions/api/meta-connect.js action:"status" chama `meta_creds_get` desde que foi escrito. A
-- função nunca foi criada: o PostgREST devolvia 404, o código lia `r.ok=false` e respondia
-- `{ ok:true, connected:false }` — o painel afirmando "não conectado" sobre uma página conectada.
-- Um `ok:true` em cima de uma leitura que falhou é o mesmo defeito de sempre: sucesso sem lastro.
-- Devolve o blob de tokens SEM o page_access_token (segredo nunca sai do banco por leitura de status).
create or replace function public.meta_creds_get(p_secret text, p_email text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_tokens jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select tokens into v_tokens from client_integrations
  where client_email = lower(trim(p_email)) and provider = 'meta' limit 1;
  if v_tokens is null then return jsonb_build_object(); end if;
  return jsonb_build_object(
    'page_id',        v_tokens->>'page_id',
    'ig_id',          v_tokens->>'ig_id',
    'business_name',  v_tokens->>'business_name',
    'publish_mode',   coalesce(v_tokens->>'publish_mode','approve'),
    'has_token',      (nullif(trim(coalesce(v_tokens->>'page_access_token','')),'') is not null)
  );
exception when undefined_table then return jsonb_build_object();
end $$;
grant execute on function public.meta_creds_get(text, text) to anon;

-- ══ 4) meta_creds_store — MERGE, não REPLACE ═════════════════════════════════════════════════
-- A versão anterior fazia `set tokens = excluded.tokens`: reconectar a página no /admin APAGAVA o
-- `publish_mode` que o dono tinha escolhido em social_set_mode (mesma linha de client_integrations,
-- provider='meta'). O dono que escolheu "aprovar antes" continuava vendo "aprovar antes" na tela
-- (o cockpit guarda a escolha localmente) enquanto o banco tinha voltado ao default. Merge preserva
-- o que o outro dono do mesmo registro escreveu; as chaves novas continuam vencendo.
create or replace function public.meta_creds_store(p_secret text, p_email text, p_tokens jsonb)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_page  text;
  v_ig    text;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_email = '' then return false; end if;

  insert into client_integrations (client_email, provider, tokens)
  values (v_email, 'meta', coalesce(p_tokens, '{}'::jsonb))
  on conflict (client_email, provider) do update
    set tokens = coalesce(client_integrations.tokens, '{}'::jsonb) || coalesce(excluded.tokens, '{}'::jsonb),
        updated_at = now();

  v_page := nullif(trim(coalesce(p_tokens->>'page_id','')), '');
  v_ig   := nullif(trim(coalesce(p_tokens->>'ig_id','')),   '');

  if v_page is not null then
    insert into meta_page_map (page_id, client_email, kind)
    values (v_page, v_email, 'page')
    on conflict (page_id) do update set client_email = excluded.client_email, kind = 'page', updated_at = now();
  end if;
  if v_ig is not null then
    insert into meta_page_map (page_id, client_email, kind)
    values (v_ig, v_email, 'ig')
    on conflict (page_id) do update set client_email = excluded.client_email, kind = 'ig', updated_at = now();
  end if;

  return true;
end $$;
grant execute on function public.meta_creds_store(text, text, jsonb) to anon;

-- ✅ Done. A varredura agora TEM onde reservar (claim_publish), o modo seco tem onde OLHAR sem
--    reservar (pending_publish), o /admin tem a RPC de status que chamava no vazio (meta_creds_get)
--    e reconectar uma página não apaga mais a escolha "aprovar antes" do dono.
