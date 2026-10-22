-- ─────────────────────────────────────────────────────────────────────────────
-- FILA DE APROVAÇÃO DAS RESPOSTAS A AVALIAÇÕES DO GOOGLE (2026-09-30)
--
-- POR QUE EXISTE: até aqui o cron (functions/api/review-responder.js) gerava a resposta com IA
-- e fazia o PUT direto no Google — em PÚBLICO, no perfil do cliente, sem ninguém aprovar. A
-- chave "aprovar antes de enviar" do painel existia e nada a lia.
-- AGORA: o cron só RASCUNHA (linha com status 'draft' aqui). Publicar é outra ação, do painel,
-- do dono, que só anda a partir de 'approved'. Nenhuma configuração pula esta fila.
--
-- CICLO:  draft ──(dono aprova)──▶ approved ──(PUT no Google ok)──▶ published
--           │  ▲                       │
--           │  └──(dono edita)─────────┤──(Google recusou/caiu)──▶ failed ──(dono aprova de novo)──▶ approved
--           └──(dono rejeita)──▶ rejected
--
-- SEGURANÇA
--   • Tabela com RLS ligada e NENHUMA policy: anon/authenticated não leem nem escrevem.
--   • Só as RPCs abaixo tocam a tabela: SECURITY DEFINER, search_path fixo, portão pelo MESMO
--     literal das RPCs de db/google_business.sql, tudo escopado por client_email.
--   • EXECUTE só para service_role (o servidor chama com SUPABASE_SERVICE_ROLE via sb.js).
--     O literal está no repositório e a chave anon é pública: sem este revoke, qualquer um
--     leria a fila de qualquer cliente.
--   • Toda mutação é (client_email, id): UUID sozinho não autoriza nada.
-- Idempotente: pode rodar duas vezes. NÃO altera nada que já existia em google_business.sql.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.gbp_reply_queue (
  id                  uuid        primary key default gen_random_uuid(),
  client_email        text        not null,
  account_id          text        not null default '',
  location_id         text        not null,            -- ficha do Google (locations/{id})
  biz_location_id     uuid,                            -- unidade do tenant (biz_locations.id), se casada
  location_label      text,
  review_id           text        not null,            -- reviewId do Google
  stars               smallint    check (stars between 1 and 5),   -- null = o Google não informou
  reviewer            text,
  review_text         text,                            -- fotografia do texto no momento do rascunho
  review_created_at   timestamptz,
  review_updated_at   timestamptz,
  draft_text          text        not null,            -- o texto que será publicado
  origin              text        not null default 'ai' check (origin in ('ai','owner')),
  edited              boolean     not null default false,           -- o dono mexeu no texto
  status              text        not null default 'draft'
                      check (status in ('draft','approved','published','rejected','failed')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  decided_by          text,                            -- quem aprovou/rejeitou
  decided_at          timestamptz,
  publish_started_at  timestamptz,                     -- trava contra clique duplo
  publish_attempts    int         not null default 0,
  published_at        timestamptz,
  google_state        text,                            -- reviewReplyState devolvido (PENDING/APPROVED/REJECTED)
  google_response     jsonb,                           -- o ReviewReply que o Google devolveu
  google_error        text,                            -- o motivo do Google quando falhou
  constraint gbp_reply_queue_uma_por_avaliacao unique (client_email, review_id)
);
create index if not exists idx_gbp_reply_queue_tenant on public.gbp_reply_queue (client_email, status, created_at desc);
alter table public.gbp_reply_queue enable row level security;
revoke all on table public.gbp_reply_queue from public, anon, authenticated;

-- ── formato de saída de uma linha (um lugar só) ──────────────────────────────
create or replace function public._gbp_fila_row(q public.gbp_reply_queue)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', q.id, 'location_id', q.location_id, 'account_id', q.account_id,
    'biz_location_id', q.biz_location_id, 'location_label', q.location_label,
    'review_id', q.review_id, 'stars', q.stars, 'reviewer', q.reviewer, 'review_text', q.review_text,
    'review_created_at', q.review_created_at, 'review_updated_at', q.review_updated_at,
    'draft_text', q.draft_text, 'origin', q.origin, 'edited', q.edited, 'status', q.status,
    'created_at', q.created_at, 'updated_at', q.updated_at,
    'decided_by', q.decided_by, 'decided_at', q.decided_at,
    'publish_attempts', q.publish_attempts, 'published_at', q.published_at,
    'google_state', q.google_state, 'google_error', q.google_error);
$$;
revoke all on function public._gbp_fila_row(public.gbp_reply_queue) from public, anon, authenticated;
grant execute on function public._gbp_fila_row(public.gbp_reply_queue) to service_role;

-- ── 1) RASCUNHO do cron: insere SE AINDA NÃO EXISTE linha para esta avaliação. Nunca sobrescreve
--       — nem rascunho editado pelo dono, nem rejeitado, nem publicado. ──
create or replace function public.gbp_fila_draft(p_secret text, p_email text, p_row jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email)); v_id uuid;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' or coalesce(trim(p_row->>'review_id'), '') = '' or coalesce(trim(p_row->>'location_id'), '') = ''
     or coalesce(trim(p_row->>'draft_text'), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_fields');
  end if;
  insert into gbp_reply_queue (client_email, account_id, location_id, biz_location_id, location_label, review_id,
                               stars, reviewer, review_text, review_created_at, review_updated_at, draft_text, origin)
  values (v_tenant, coalesce(p_row->>'account_id', ''), p_row->>'location_id',
          nullif(p_row->>'biz_location_id', '')::uuid, left(p_row->>'location_label', 200), p_row->>'review_id',
          case when (p_row->>'stars') ~ '^[1-5]$' then (p_row->>'stars')::smallint else null end,
          left(p_row->>'reviewer', 200), left(p_row->>'review_text', 6000),
          nullif(p_row->>'review_created_at', '')::timestamptz, nullif(p_row->>'review_updated_at', '')::timestamptz,
          left(p_row->>'draft_text', 4096), 'ai')
  on conflict (client_email, review_id) do nothing
  returning id into v_id;
  return jsonb_build_object('ok', true, 'created', v_id is not null, 'id', v_id);
end $$;

-- ── 2) O DONO ESCREVE (do zero, ou reescreve): cria a linha ou volta a existente para 'draft'
--       com o texto dele. Recusa enquanto uma publicação está em andamento. ──
create or replace function public.gbp_fila_write(p_secret text, p_email text, p_row jsonb, p_by text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email)); v_row gbp_reply_queue;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' or coalesce(trim(p_row->>'review_id'), '') = '' or coalesce(trim(p_row->>'location_id'), '') = ''
     or coalesce(trim(p_row->>'draft_text'), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_fields');
  end if;
  insert into gbp_reply_queue (client_email, account_id, location_id, biz_location_id, location_label, review_id,
                               stars, reviewer, review_text, review_created_at, review_updated_at, draft_text, origin, edited)
  values (v_tenant, coalesce(p_row->>'account_id', ''), p_row->>'location_id',
          nullif(p_row->>'biz_location_id', '')::uuid, left(p_row->>'location_label', 200), p_row->>'review_id',
          case when (p_row->>'stars') ~ '^[1-5]$' then (p_row->>'stars')::smallint else null end,
          left(p_row->>'reviewer', 200), left(p_row->>'review_text', 6000),
          nullif(p_row->>'review_created_at', '')::timestamptz, nullif(p_row->>'review_updated_at', '')::timestamptz,
          left(p_row->>'draft_text', 4096), 'owner', true)
  on conflict (client_email, review_id) do update
    set draft_text = excluded.draft_text, origin = 'owner', edited = true, status = 'draft',
        decided_by = null, decided_at = null, google_error = null, updated_at = now()
    where gbp_reply_queue.publish_started_at is null
       or gbp_reply_queue.publish_started_at < now() - interval '2 minutes'
  returning * into v_row;
  if v_row.id is null then return jsonb_build_object('ok', false, 'error', 'publish_in_flight'); end if;
  return jsonb_build_object('ok', true, 'row', _gbp_fila_row(v_row));
end $$;

-- ── 3) LISTAR a fila do tenant (com contagem por status). ──
create or replace function public.gbp_fila_list(p_secret text, p_email text, p_status text default null, p_limit int default 100)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email)); v_rows jsonb; v_counts jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  select coalesce(jsonb_agg(_gbp_fila_row(q) order by q.created_at desc), '[]'::jsonb) into v_rows
  from gbp_reply_queue q
  where q.client_email = v_tenant
    and q.id in (select i.id from gbp_reply_queue i
                 where i.client_email = v_tenant and (p_status is null or i.status = p_status)
                 order by i.created_at desc limit least(greatest(coalesce(p_limit, 100), 1), 300));
  select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) into v_counts
  from (select status, count(*)::int as n from gbp_reply_queue where client_email = v_tenant group by status) c;
  return jsonb_build_object('ok', true, 'rows', v_rows, 'counts', v_counts);
end $$;

-- ── 4) IDS já na fila (qualquer status) — o cron não rascunha duas vezes a mesma avaliação. ──
create or replace function public.gbp_fila_ids(p_secret text, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email));
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  return jsonb_build_object('ok', true, 'ids',
    coalesce((select jsonb_agg(review_id) from gbp_reply_queue where client_email = v_tenant), '[]'::jsonb));
end $$;

-- ── 5) EDITAR o texto (volta para 'draft': texto novo precisa de aprovação nova). ──
create or replace function public.gbp_fila_edit(p_secret text, p_email text, p_id uuid, p_text text, p_by text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email)); v_row gbp_reply_queue;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if coalesce(trim(p_text), '') = '' then return jsonb_build_object('ok', false, 'error', 'empty_text'); end if;
  update gbp_reply_queue
     set draft_text = left(p_text, 4096), edited = true, status = 'draft',
         decided_by = null, decided_at = null, google_error = null, updated_at = now()
   where client_email = v_tenant and id = p_id
     and status in ('draft', 'approved', 'failed', 'rejected')
     and (publish_started_at is null or publish_started_at < now() - interval '2 minutes')
  returning * into v_row;
  if v_row.id is null then
    if exists (select 1 from gbp_reply_queue where client_email = v_tenant and id = p_id)
      then return jsonb_build_object('ok', false, 'error', 'bad_status');
      else return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  end if;
  return jsonb_build_object('ok', true, 'row', _gbp_fila_row(v_row));
end $$;

-- ── 6) DECIDIR: 'approved' (de draft/failed) ou 'rejected' (de draft/failed/approved). ──
create or replace function public.gbp_fila_decide(p_secret text, p_email text, p_id uuid, p_decision text, p_by text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email)); v_row gbp_reply_queue;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if p_decision not in ('approved', 'rejected') then return jsonb_build_object('ok', false, 'error', 'bad_decision'); end if;
  update gbp_reply_queue
     set status = p_decision, decided_by = left(coalesce(p_by, ''), 200), decided_at = now(), updated_at = now(),
         publish_started_at = null
   where client_email = v_tenant and id = p_id
     and ((p_decision = 'approved' and status in ('draft', 'failed'))
       or (p_decision = 'rejected' and status in ('draft', 'failed', 'approved')))
     and (publish_started_at is null or publish_started_at < now() - interval '2 minutes')
  returning * into v_row;
  if v_row.id is null then
    if exists (select 1 from gbp_reply_queue where client_email = v_tenant and id = p_id)
      then return jsonb_build_object('ok', false, 'error', 'bad_status');
      else return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  end if;
  return jsonb_build_object('ok', true, 'row', _gbp_fila_row(v_row));
end $$;

-- ── 7) RESERVAR para publicar: só anda se está 'approved' e ninguém está publicando agora.
--       UPDATE atômico com guarda (nunca ler-depois-gravar): clique duplo → um PUT só. ──
create or replace function public.gbp_fila_claim(p_secret text, p_email text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email)); v_row gbp_reply_queue; v_status text;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  update gbp_reply_queue
     set publish_started_at = now(), publish_attempts = publish_attempts + 1, updated_at = now()
   where client_email = v_tenant and id = p_id and status = 'approved'
     and (publish_started_at is null or publish_started_at < now() - interval '2 minutes')
  returning * into v_row;
  if v_row.id is null then
    select status into v_status from gbp_reply_queue where client_email = v_tenant and id = p_id;
    if v_status is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
    if v_status <> 'approved' then return jsonb_build_object('ok', false, 'error', 'not_approved', 'status', v_status); end if;
    return jsonb_build_object('ok', false, 'error', 'publish_in_flight');
  end if;
  return jsonb_build_object('ok', true, 'row', _gbp_fila_row(v_row));
end $$;

-- ── 8) RESULTADO do PUT: 'published' (com o que o Google devolveu) ou 'failed' (com o motivo). ──
create or replace function public.gbp_fila_result(
  p_secret text, p_email text, p_id uuid, p_ok boolean,
  p_google jsonb default null, p_state text default null, p_error text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(p_email)); v_row gbp_reply_queue;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  update gbp_reply_queue
     set status = case when p_ok then 'published' else 'failed' end,
         published_at = case when p_ok then now() else published_at end,
         google_response = coalesce(p_google, google_response),
         google_state = case when p_ok then left(p_state, 60) else google_state end,
         google_error = case when p_ok then null else left(coalesce(p_error, 'unknown'), 600) end,
         publish_started_at = null, updated_at = now()
   where client_email = v_tenant and id = p_id and status = 'approved'
  returning * into v_row;
  if v_row.id is null then return jsonb_build_object('ok', false, 'error', 'not_found_or_not_approved'); end if;
  return jsonb_build_object('ok', true, 'row', _gbp_fila_row(v_row));
end $$;

-- ── EXECUTE: só service_role. (As funções nascem com EXECUTE para PUBLIC — por isso o revoke.) ──
revoke all on function public.gbp_fila_draft(text, text, jsonb)                                from public, anon, authenticated;
revoke all on function public.gbp_fila_write(text, text, jsonb, text)                          from public, anon, authenticated;
revoke all on function public.gbp_fila_list(text, text, text, int)                             from public, anon, authenticated;
revoke all on function public.gbp_fila_ids(text, text)                                         from public, anon, authenticated;
revoke all on function public.gbp_fila_edit(text, text, uuid, text, text)                      from public, anon, authenticated;
revoke all on function public.gbp_fila_decide(text, text, uuid, text, text)                    from public, anon, authenticated;
revoke all on function public.gbp_fila_claim(text, text, uuid)                                 from public, anon, authenticated;
revoke all on function public.gbp_fila_result(text, text, uuid, boolean, jsonb, text, text)    from public, anon, authenticated;
grant execute on function public.gbp_fila_draft(text, text, jsonb)                             to service_role;
grant execute on function public.gbp_fila_write(text, text, jsonb, text)                       to service_role;
grant execute on function public.gbp_fila_list(text, text, text, int)                          to service_role;
grant execute on function public.gbp_fila_ids(text, text)                                      to service_role;
grant execute on function public.gbp_fila_edit(text, text, uuid, text, text)                   to service_role;
grant execute on function public.gbp_fila_decide(text, text, uuid, text, text)                 to service_role;
grant execute on function public.gbp_fila_claim(text, text, uuid)                              to service_role;
grant execute on function public.gbp_fila_result(text, text, uuid, boolean, jsonb, text, text) to service_role;

notify pgrst, 'reload schema';

-- ✅ Pronto. gbp_reply_queue = a fila; gbp_fila_* = as únicas portas. O cron só chama
--    gbp_fila_draft / gbp_fila_ids. Publicar exige approved + claim, e só o painel do dono chega lá.
