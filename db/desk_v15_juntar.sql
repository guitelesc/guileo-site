-- GUILEO DESK v15 — JUNTAR CLIENTES DUPLICADOS (2026-10-22, Onda 1 item 8 "largar o MindBody")
-- No MindBody, "Merge clients" move tudo da ficha A para a B e APAGA a A — não tem volta. Aqui juntar é um
-- REGISTRO: a ficha que entra vira um APELIDO da principal (desk_client_alias). Nenhuma venda, pacote, vale,
-- agendamento ou formulário muda de dono nem de contato:
--   · saldos ficam exatamente como estavam (o pacote comprado pelo e-mail continua no e-mail — a "Minha conta"
--     da cliente, que entra pelo e-mail, continua achando);
--   · a FICHA (desk_client_card), a BUSCA (desk_client_search) e o SALVAR da ficha (desk_client_save) passam a
--     tratar as duas chaves como uma pessoa — inclusive o que chegar DEPOIS pelo contato antigo;
--   · DESFAZER é exato (desk_merge_undo): apaga o apelido e devolve as duas fichas como eram.
-- O que muda de verdade, e volta no desfazer:
--   1. Perfil (desk_clients): a principal recebe a soma — alergias, alertas e notas SOMAM (nunca apagam),
--      etiquetas unem, telefone/e-mail que faltavam entram, "cliente de confiança" = se era em qualquer uma,
--      "pode marcar online" = o mais restritivo (se uma estava bloqueada, a junta fica bloqueada).
--      A linha do perfil da ficha que entra é guardada no registro e sai da tabela.
--   2. Consentimento (crm_consent_log): o mais restritivo vence, canal por canal. Se o último registro de UMA
--      das fichas diz "não", a outra ganha um registro "não" (fonte 'juntar', com a evidência). O desfazer apaga
--      só esses registros e devolve o espelho do CRM.
-- Regras: só a dona (a rota não deixa recepção nem profissional); uma ficha que já é apelido não entra de novo
-- (já está junta); juntar em cadeia (A←B, depois C←A) re-aponta os apelidos de A para C; desfazer só o mais
-- recente que envolve aquelas fichas (undo_later_first).
-- Sugestões (desk_merge_suggest): mesmo nome completo normalizado (sem acento, sem pontuação, ≥ 2 palavras —
-- "Maria" sozinha casaria com todas as Marias) e "mesma pessoa no cadastro" (uma linha do CRM com o telefone de
-- uma ficha e o e-mail da outra). "Não são a mesma pessoa" tira o grupo da lista (desk_merge_dismiss).
-- Motivos: invalid_contact · same_client · already_merged · client_not_found · not_found · already_undone ·
-- undo_later_first. Idempotente: create if not exists / create or replace / remendos que se reconhecem.

-- ═══ TRAVA: o Desk no ar tem de estar restaurado (desk_v2 rodado de novo em 2026-10-21 voltava a ficha) ═══
do $t$
begin
  if position('_desk_pp_status' in pg_get_functiondef('public.desk_client_card(text,text,text)'::regprocedure)) = 0
     or position('_desk_cupom_aplica' in pg_get_functiondef('public.desk_checkout(text,text,jsonb)'::regprocedure)) = 0 then
    raise exception 'desk_v15: o Desk no ar não está na versão esperada (restauração + v14) — nada foi alterado.';
  end if;
end $t$;

-- ═══ TABELAS ═══════════════════════════════════════════════════════════════════════════════════
create table if not exists public.desk_merges (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,
  main_key text not null,           -- a ficha que fica
  alias_key text not null,          -- a ficha que entrou (vira apelido)
  main_contact text,
  alias_contact text,
  snapshot jsonb not null default '{}'::jsonb,   -- o que o desfazer precisa: perfis de antes, consentimentos criados, apelidos re-apontados
  created_at timestamptz not null default now(),
  undone_at timestamptz
);
create index if not exists desk_merges_tenant on public.desk_merges (client_email, created_at desc);

create table if not exists public.desk_client_alias (
  client_email text not null,
  alias_key text not null,
  main_key text not null,
  merge_id uuid,
  created_at timestamptz not null default now(),
  primary key (client_email, alias_key)
);
create index if not exists desk_client_alias_main on public.desk_client_alias (client_email, main_key);

create table if not exists public.desk_merge_dismiss (
  client_email text not null,
  assinatura text not null,         -- as chaves do grupo, em ordem, separadas por '|'
  at timestamptz not null default now(),
  primary key (client_email, assinatura)
);

alter table public.desk_merges enable row level security;
alter table public.desk_client_alias enable row level security;
alter table public.desk_merge_dismiss enable row level security;
revoke all on public.desk_merges, public.desk_client_alias, public.desk_merge_dismiss from anon, authenticated;

-- ═══ RESOLVER: chave → ficha principal; principal → todas as chaves dela ═══════════════════════════
create or replace function public._desk_ck_main(e text, ck text)
returns text language sql stable security definer set search_path to 'public' as $$
  select case when ck is null then null
              else coalesce((select a.main_key from desk_client_alias a where a.client_email = e and a.alias_key = ck), ck) end
$$;
create or replace function public._desk_keys(e text, main text)
returns text[] language sql stable security definer set search_path to 'public' as $$
  select case when main is null then '{}'::text[]
              else array[main] || coalesce(array(select a.alias_key from desk_client_alias a where a.client_email = e and a.main_key = main order by a.created_at), '{}'::text[]) end
$$;
-- os apelidos de uma principal, para a ficha mostrar "também: …" com o desfazer
create or replace function public._desk_aliases_json(e text, main text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('contact_key', a.alias_key, 'contact', coalesce(m.alias_contact, a.alias_key),
           'merge_id', a.merge_id, 'at', a.created_at) order by a.created_at), '[]'::jsonb)
    from desk_client_alias a left join desk_merges m on m.id = a.merge_id
   where a.client_email = e and a.main_key = main
$$;

-- nome para comparar: minúsculo, sem acento, sem pontuação, espaços únicos
create or replace function public._desk_nome_norm(p text)
returns text language sql immutable as $$
  select nullif(trim(regexp_replace(regexp_replace(lower(translate(coalesce(p, ''),
           'áàâãäåéèêëíìîïóòôõöúùûüçñýÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ', 'aaaaaaeeeeiiiiooooouuuucnyaaaaaaeeeeiiiiooooouuuucny')),
           '[^a-z ]', ' ', 'g'), '\s+', ' ', 'g')), '')
$$;

-- soma de dois textos livres (alergias, alertas, notas): nunca apaga; não repete o que já está lá
create or replace function public._desk_soma_txt(a text, b text)
returns text language sql immutable as $$
  select case when nullif(trim(coalesce(a, '')), '') is null then nullif(trim(coalesce(b, '')), '')
              when nullif(trim(coalesce(b, '')), '') is null then trim(a)
              when position(lower(trim(b)) in lower(a)) > 0 then trim(a)
              when position(lower(trim(a)) in lower(b)) > 0 then trim(b)
              else trim(a) || ' · ' || trim(b) end
$$;

-- a ficha existe neste negócio? (perfil, CRM, agendamento, venda, pacote ou vale)
create or replace function public._desk_ck_existe(e text, ck text)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select ck is not null and (
       exists (select 1 from desk_clients d where d.client_email = e and d.contact_key = ck)
    or exists (select 1 from crm_contacts c where c.client_email = e and (c.phone_key = ck or lower(c.email) = ck))
    or exists (select 1 from biz_appointments a where a.client_email = e and public._desk_ck(a.customer_contact) = ck)
    or exists (select 1 from desk_sales s where s.client_email = e and s.contact_key = ck)
    or exists (select 1 from package_purchases pp where pp.client_email = e and public._desk_ck(pp.contact) = ck)
    or exists (select 1 from gift_cards g where g.client_email = e and (public._desk_ck(g.purchaser_contact) = ck or public._desk_ck(g.recipient_contact) = ck)))
$$;

-- o que uma ficha (com os apelidos dela) carrega: para a prévia lado a lado
create or replace function public._desk_ck_resumo(e text, main text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with ks as (select public._desk_keys(e, main) k)
  select jsonb_build_object(
    'contact_key', main,
    'name', coalesce((select d.name from desk_clients d where d.client_email = e and d.contact_key = main),
                     (select c.full_name from crm_contacts c, ks where c.client_email = e and (c.phone_key = any(ks.k) or lower(c.email) = any(ks.k)) and c.full_name is not null limit 1),
                     (select a.customer_name from biz_appointments a, ks where a.client_email = e and public._desk_ck(a.customer_contact) = any(ks.k) order by a.created_at desc limit 1),
                     (select s.customer_name from desk_sales s, ks where s.client_email = e and s.contact_key = any(ks.k) order by s.created_at desc limit 1)),
    'visits', (select count(*) from biz_appointments a, ks where a.client_email = e and public._desk_ck(a.customer_contact) = any(ks.k) and a.status not in ('blocked', 'cancelled')),
    'sales', (select count(*) from desk_sales s, ks where s.client_email = e and s.contact_key = any(ks.k) and s.status = 'paid'),
    'spend_cents', (select coalesce(sum(s.total_cents - s.tip_cents), 0) from desk_sales s, ks where s.client_email = e and s.contact_key = any(ks.k) and s.status = 'paid'),
    'packages', (select count(*) from package_purchases pp, ks where pp.client_email = e and public._desk_ck(pp.contact) = any(ks.k) and pp.sessions_used < pp.sessions_total),
    'gift_cards', (select count(*) from gift_cards g, ks where g.client_email = e and coalesce(g.active, true) and g.balance_cents > 0
                     and (public._desk_ck(g.purchaser_contact) = any(ks.k) or public._desk_ck(g.recipient_contact) = any(ks.k))),
    'last_visit', (select max(lower(a.span)) from biz_appointments a, ks where a.client_email = e and public._desk_ck(a.customer_contact) = any(ks.k) and a.status not in ('blocked', 'cancelled', 'no_show') and lower(a.span) < now()),
    'aliases', public._desk_aliases_json(e, main),
    'profile', (select to_jsonb(d) - 'client_email' from desk_clients d where d.client_email = e and d.contact_key = main))
$$;

-- o perfil que a principal fica tendo (uma régua só: a prévia mostra exatamente o que o juntar grava)
create or replace function public._desk_perfil_junto(e text, mk text, ak text, m_contact text, a_contact text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with m as (select * from desk_clients where client_email = e and contact_key = mk),
       a as (select * from desk_clients where client_email = e and contact_key = ak),
       r as (select (select to_jsonb(m) from m) mj, (select to_jsonb(a) from a) aj)
  select jsonb_build_object(
    'name', coalesce(r.mj->>'name', r.aj->>'name', (public._desk_ck_resumo(e, mk))->>'name', (public._desk_ck_resumo(e, ak))->>'name'),
    'phone', coalesce(r.mj->>'phone', case when mk not like '%@%' then m_contact end, r.aj->>'phone', case when ak not like '%@%' then a_contact end),
    'email', coalesce(r.mj->>'email', case when mk like '%@%' then mk end, r.aj->>'email', case when ak like '%@%' then ak end),
    'allergies', public._desk_soma_txt(r.mj->>'allergies', r.aj->>'allergies'),
    'alerts', public._desk_soma_txt(r.mj->>'alerts', r.aj->>'alerts'),
    'notes', public._desk_soma_txt(r.mj->>'notes', r.aj->>'notes'),
    'tags', (select coalesce(jsonb_agg(distinct t), '[]'::jsonb) from (
               select jsonb_array_elements_text(coalesce(r.mj->'tags', '[]'::jsonb)) t
               union select jsonb_array_elements_text(coalesce(r.aj->'tags', '[]'::jsonb))) x),
    'trusted', coalesce((r.mj->>'trusted')::boolean, false) or coalesce((r.aj->>'trusted')::boolean, false),
    'can_book_online', coalesce((r.mj->>'can_book_online')::boolean, true) and coalesce((r.aj->>'can_book_online')::boolean, true),
    'source', coalesce(r.mj->>'source', r.aj->>'source', 'desk'))
  from r
$$;

-- consentimento junto, canal por canal: o "não" mais recente de qualquer uma vale para as duas
create or replace function public._desk_consent_junto(e text, m_contact text, a_contact text)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  with um as (select public._consent_ultimo(e, public._contato_chave(m_contact)) j),
       ua as (select public._consent_ultimo(e, public._contato_chave(a_contact)) j)
  select coalesce(jsonb_object_agg(ch, jsonb_build_object('main', um.j->ch, 'alias', ua.j->ch,
           'result', case when (um.j->ch->>'granted') = 'false' or (ua.j->ch->>'granted') = 'false' then false
                          when (um.j->ch->>'granted') = 'true' or (ua.j->ch->>'granted') = 'true' then true end)), '{}'::jsonb)
    from unnest(array['sms', 'call', 'whatsapp', 'email']) ch, um, ua
   where um.j ? ch or ua.j ? ch
$$;

revoke all on function public._desk_ck_main(text, text) from public, anon, authenticated;
revoke all on function public._desk_keys(text, text) from public, anon, authenticated;
revoke all on function public._desk_aliases_json(text, text) from public, anon, authenticated;
revoke all on function public._desk_ck_existe(text, text) from public, anon, authenticated;
revoke all on function public._desk_ck_resumo(text, text) from public, anon, authenticated;
revoke all on function public._desk_perfil_junto(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public._desk_consent_junto(text, text, text) from public, anon, authenticated;

-- ═══ SUGESTÕES ═════════════════════════════════════════════════════════════════════════════════
create or replace function public.desk_merge_suggest(p_email text, p_key text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); v_all jsonb;
begin
  v_all := coalesce((
    with pessoas0 as (
      select coalesce(c.phone_key, lower(c.email)) ck, c.full_name nm, coalesce(c.phone, c.email) ct, c.last_seen_at seen
        from crm_contacts c where c.client_email = e and coalesce(c.phone_key, c.email) is not null
      union all
      select public._desk_ck(a.customer_contact), a.customer_name, a.customer_contact, a.created_at
        from biz_appointments a where a.client_email = e and a.status <> 'blocked' and public._desk_ck(a.customer_contact) is not null
      union all
      select s.contact_key, s.customer_name, s.customer_contact, s.created_at from desk_sales s where s.client_email = e and s.contact_key is not null
      union all
      select d.contact_key, d.name, coalesce(d.phone, d.email), d.updated_at from desk_clients d where d.client_email = e),
    -- uma linha por ficha principal (apelido já juntado não aparece)
    pessoas as (
      select distinct on (ck) ck, nm, ct, seen from pessoas0
       where ck is not null and not exists (select 1 from desk_client_alias x where x.client_email = e and x.alias_key = pessoas0.ck)
       order by ck, (nm is not null) desc, seen desc nulls last),
    por_nome as (
      select 'same_name' reason, public._desk_nome_norm(nm) chave, array_agg(ck order by seen desc nulls last) cks
        from pessoas where position(' ' in coalesce(public._desk_nome_norm(nm), '')) > 0
       group by public._desk_nome_norm(nm) having count(*) between 2 and 6),
    por_crm as (
      select 'same_person' reason, c.id::text chave, array[c.phone_key, lower(c.email)] cks
        from crm_contacts c
       where c.client_email = e and c.phone_key is not null and c.email is not null
         and exists (select 1 from pessoas p where p.ck = c.phone_key) and exists (select 1 from pessoas p where p.ck = lower(c.email))),
    grupos as (
      select reason, chave, cks from por_crm
      union all
      select g.reason, g.chave, g.cks from por_nome g
       where not exists (select 1 from por_crm c where c.cks @> g.cks and g.cks @> c.cks)),
    -- contagens numa passada só (a lista pode ter dezenas de grupos; o resumo completo fica para a prévia)
    visitas as (select public._desk_ck(a.customer_contact) ck, count(*) n, max(lower(a.span)) filter (where lower(a.span) < now()) ult
                  from biz_appointments a where a.client_email = e and a.status not in ('blocked', 'cancelled') group by 1),
    vendas as (select s.contact_key ck, count(*) n from desk_sales s where s.client_email = e and s.status = 'paid' and s.contact_key is not null group by 1),
    grupos_vivos as (
      select g.* from grupos g
       where not exists (select 1 from desk_merge_dismiss dm where dm.client_email = e
                           and dm.assinatura = array_to_string(array(select unnest(g.cks) order by 1), '|')))
    select jsonb_agg(jsonb_build_object('reason', g.reason,
             'assinatura', array_to_string(array(select unnest(g.cks) order by 1), '|'),
             'members', (select jsonb_agg(jsonb_build_object('contact_key', k, 'contact', p.ct, 'name', p.nm,
                                    'visits', coalesce(v.n, 0), 'sales', coalesce(s.n, 0), 'last_visit', v.ult) order by o)
                           from unnest(g.cks) with ordinality u(k, o) left join pessoas p on p.ck = k left join visitas v on v.ck = k left join vendas s on s.ck = k))
             order by g.reason = 'same_person' desc, g.chave)
      from grupos_vivos g), '[]'::jsonb);
  -- a tela mostra os 60 primeiros e diz quantos são no total (juntou uns, aparecem os próximos)
  return jsonb_build_object('ok', true, 'total', jsonb_array_length(v_all),
    'groups', coalesce((select jsonb_agg(x order by i) from jsonb_array_elements(v_all) with ordinality t(x, i) where i <= 60), '[]'::jsonb));
end $$;
revoke all on function public.desk_merge_suggest(text, text) from public;
grant execute on function public.desk_merge_suggest(text, text) to anon, authenticated, service_role;

create or replace function public.desk_merge_dismiss(p_email text, p_key text, p_keys jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); v text;
begin
  if jsonb_typeof(p_keys) is distinct from 'array' or jsonb_array_length(p_keys) < 2 then return jsonb_build_object('ok', false, 'reason', 'invalid_contact'); end if;
  v := array_to_string(array(select x from jsonb_array_elements_text(p_keys) x order by 1), '|');
  insert into desk_merge_dismiss (client_email, assinatura) values (e, left(v, 2000)) on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.desk_merge_dismiss(text, text, jsonb) from public;
grant execute on function public.desk_merge_dismiss(text, text, jsonb) to anon, authenticated, service_role;

-- ═══ PRÉVIA: o que acontece se juntar (nada grava) ═════════════════════════════════════════════════
create or replace function public.desk_merge_preview(p_email text, p_key text, p_keep text, p_drop text)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); mk text := public._desk_ck(p_keep); ak text := public._desk_ck(p_drop);
begin
  if mk is null or ak is null then return jsonb_build_object('ok', false, 'reason', 'invalid_contact'); end if;
  if mk = ak then return jsonb_build_object('ok', false, 'reason', 'same_client'); end if;
  if public._desk_ck_main(e, mk) = public._desk_ck_main(e, ak) then return jsonb_build_object('ok', false, 'reason', 'already_merged'); end if;
  if public._desk_ck_main(e, mk) <> mk or public._desk_ck_main(e, ak) <> ak then return jsonb_build_object('ok', false, 'reason', 'already_merged'); end if;
  if not public._desk_ck_existe(e, mk) or not public._desk_ck_existe(e, ak) then return jsonb_build_object('ok', false, 'reason', 'client_not_found'); end if;
  return jsonb_build_object('ok', true,
    'main', public._desk_ck_resumo(e, mk) || jsonb_build_object('contact', p_keep),
    'alias', public._desk_ck_resumo(e, ak) || jsonb_build_object('contact', p_drop),
    'result', public._desk_perfil_junto(e, mk, ak, p_keep, p_drop),
    'consent', public._desk_consent_junto(e, p_keep, p_drop),
    'different_names', coalesce(public._desk_nome_norm((public._desk_ck_resumo(e, mk))->>'name'), '') <> coalesce(public._desk_nome_norm((public._desk_ck_resumo(e, ak))->>'name'), ''));
end $$;
revoke all on function public.desk_merge_preview(text, text, text, text) from public;
grant execute on function public.desk_merge_preview(text, text, text, text) to anon, authenticated, service_role;

-- ═══ JUNTAR ═════════════════════════════════════════════════════════════════════════════════════
create or replace function public.desk_merge(p_email text, p_key text, p_keep text, p_drop text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); mk text := public._desk_ck(p_keep); ak text := public._desk_ck(p_drop);
        v_perfil jsonb; v_mp jsonb; v_ap jsonb; v_cons jsonb; v_ch text; v_id uuid := gen_random_uuid(); v_log uuid;
        v_ids jsonb := '[]'::jsonb; v_crm jsonb; v_rep jsonb; v_after jsonb; mck text := public._contato_chave(p_keep); ack text := public._contato_chave(p_drop);
begin
  if mk is null or ak is null then return jsonb_build_object('ok', false, 'reason', 'invalid_contact'); end if;
  if mk = ak then return jsonb_build_object('ok', false, 'reason', 'same_client'); end if;
  perform pg_advisory_xact_lock(hashtext('desk_merge:' || e));     -- duas juntadas do mesmo negócio, uma de cada vez
  if public._desk_ck_main(e, mk) <> mk or public._desk_ck_main(e, ak) <> ak then return jsonb_build_object('ok', false, 'reason', 'already_merged'); end if;
  if not public._desk_ck_existe(e, mk) or not public._desk_ck_existe(e, ak) then return jsonb_build_object('ok', false, 'reason', 'client_not_found'); end if;

  -- o que o desfazer precisa, ANTES de mexer
  v_perfil := public._desk_perfil_junto(e, mk, ak, p_keep, p_drop);
  v_cons := public._desk_consent_junto(e, p_keep, p_drop);
  select to_jsonb(d) into v_mp from desk_clients d where d.client_email = e and d.contact_key = mk;
  select to_jsonb(d) into v_ap from desk_clients d where d.client_email = e and d.contact_key = ak;
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'consent_sms', c.consent_sms, 'consent_call', c.consent_call)), '[]'::jsonb) into v_crm
    from crm_contacts c where c.client_email = e and (c.phone_key in (mk, ak, mck, ack) or lower(c.email) in (mk, ak));
  select coalesce(jsonb_agg(alias_key), '[]'::jsonb) into v_rep from desk_client_alias where client_email = e and main_key = ak;

  -- 1. perfil: a principal recebe a soma; a que entra sai da tabela (guardada no registro)
  insert into desk_clients (client_email, contact_key, name, phone, email, allergies, alerts, notes, trusted, can_book_online, tags, source, updated_at)
  values (e, mk, left(v_perfil->>'name', 160), v_perfil->>'phone', v_perfil->>'email', left(v_perfil->>'allergies', 2000), left(v_perfil->>'alerts', 2000),
          left(v_perfil->>'notes', 8000), (v_perfil->>'trusted')::boolean, (v_perfil->>'can_book_online')::boolean, coalesce(v_perfil->'tags', '[]'::jsonb), v_perfil->>'source', now())
  on conflict (client_email, contact_key) do update set
    name = excluded.name, phone = excluded.phone, email = excluded.email, allergies = excluded.allergies, alerts = excluded.alerts,
    notes = excluded.notes, trusted = excluded.trusted, can_book_online = excluded.can_book_online, tags = excluded.tags, updated_at = now();
  delete from desk_clients where client_email = e and contact_key = ak;
  select to_jsonb(d) - 'updated_at' into v_after from desk_clients d where d.client_email = e and d.contact_key = mk;   -- o retrato logo depois: o desfazer sabe se alguém editou

  -- 2. apelidos: os da que entra passam para a principal; a que entra vira apelido
  update desk_client_alias set main_key = mk where client_email = e and main_key = ak;
  insert into desk_client_alias (client_email, alias_key, main_key, merge_id, created_at) values (e, ak, mk, v_id, clock_timestamp());

  -- 3. consentimento: o "não" de qualquer uma vale para as duas (registro com fonte 'juntar')
  for v_ch in select jsonb_object_keys(v_cons) loop
    if (v_cons->v_ch->>'result') = 'false' then
      if coalesce(v_cons->v_ch->'main'->>'granted', 'true') <> 'false' and mck is not null then
        insert into crm_consent_log (client_email, contact_key, channel, granted, source, evidence, at)
          values (e, mck, v_ch, false, 'juntar', left('fichas juntadas: ' || p_drop || ' disse não em ' || coalesce(v_cons->v_ch->'alias'->>'at', '?'), 400), clock_timestamp()) returning id into v_log;
        perform public._consent_espelhar(e, mck, v_ch, false); v_ids := v_ids || to_jsonb(v_log);
      end if;
      if coalesce(v_cons->v_ch->'alias'->>'granted', 'true') <> 'false' and ack is not null then
        insert into crm_consent_log (client_email, contact_key, channel, granted, source, evidence, at)
          values (e, ack, v_ch, false, 'juntar', left('fichas juntadas: ' || p_keep || ' disse não em ' || coalesce(v_cons->v_ch->'main'->>'at', '?'), 400), clock_timestamp()) returning id into v_log;
        perform public._consent_espelhar(e, ack, v_ch, false); v_ids := v_ids || to_jsonb(v_log);
      end if;
    end if;
  end loop;

  -- clock_timestamp: a ordem entre juntadas vale até dentro da mesma transação (o desfazer depende dela)
  insert into desk_merges (id, client_email, main_key, alias_key, main_contact, alias_contact, snapshot, created_at)
  values (v_id, e, mk, ak, left(p_keep, 160), left(p_drop, 160),
          jsonb_build_object('main_profile', v_mp, 'alias_profile', v_ap, 'main_after', v_after, 'consent_ids', v_ids, 'crm', v_crm, 'repointed', v_rep,
                             'consent_keys', jsonb_build_array(mck, ack)), clock_timestamp());
  return jsonb_build_object('ok', true, 'merge_id', v_id, 'main_key', mk, 'alias_key', ak, 'consent_records', jsonb_array_length(v_ids),
                            'card', public._desk_ck_resumo(e, mk));
end $$;
revoke all on function public.desk_merge(text, text, text, text) from public;
grant execute on function public.desk_merge(text, text, text, text) to anon, authenticated, service_role;

-- ═══ DESFAZER ═══════════════════════════════════════════════════════════════════════════════════
-- Devolve as duas fichas. Se a principal foi editada DEPOIS de juntar, a edição fica (nunca perde o que a
-- recepção escreveu) e o perfil da que entrou volta como era — a resposta diz kept_edits:true.
create or replace function public.desk_merge_undo(p_email text, p_key text, p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare e text := public._desk_ok(p_email, p_key); m desk_merges; v_kept boolean := false; v_k text; v_ch text; v_ult jsonb; r jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('desk_merge:' || e));
  select * into m from desk_merges where id = p_id and client_email = e for update;
  if m.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if m.undone_at is not null then return jsonb_build_object('ok', false, 'reason', 'already_undone'); end if;
  if exists (select 1 from desk_merges x where x.client_email = e and x.undone_at is null and x.created_at > m.created_at
               and (x.main_key in (m.main_key, m.alias_key) or x.alias_key in (m.main_key, m.alias_key))) then
    return jsonb_build_object('ok', false, 'reason', 'undo_later_first');
  end if;

  -- apelidos
  delete from desk_client_alias where client_email = e and alias_key = m.alias_key and merge_id = m.id;
  update desk_client_alias set main_key = m.alias_key
   where client_email = e and main_key = m.main_key and alias_key in (select jsonb_array_elements_text(coalesce(m.snapshot->'repointed', '[]'::jsonb)));

  -- perfis
  if exists (select 1 from desk_clients d where d.client_email = e and d.contact_key = m.main_key and (to_jsonb(d) - 'updated_at') is distinct from m.snapshot->'main_after') then
    v_kept := true;
  else
    delete from desk_clients where client_email = e and contact_key = m.main_key;
    if m.snapshot->'main_profile' is not null and jsonb_typeof(m.snapshot->'main_profile') = 'object' then
      insert into desk_clients select * from jsonb_populate_record(null::desk_clients, m.snapshot->'main_profile');
    end if;
  end if;
  if m.snapshot->'alias_profile' is not null and jsonb_typeof(m.snapshot->'alias_profile') = 'object' then
    insert into desk_clients select * from jsonb_populate_record(null::desk_clients, m.snapshot->'alias_profile')
    on conflict (client_email, contact_key) do nothing;
  end if;

  -- consentimento: some só o que o juntar criou; o espelho do CRM volta ao último registro que sobrou (ou ao de antes)
  delete from crm_consent_log where client_email = e and id in (select (x)::uuid from jsonb_array_elements_text(coalesce(m.snapshot->'consent_ids', '[]'::jsonb)) x);
  for r in select * from jsonb_array_elements(coalesce(m.snapshot->'crm', '[]'::jsonb)) loop
    update crm_contacts set consent_sms = coalesce((r->>'consent_sms')::boolean, consent_sms), consent_call = coalesce((r->>'consent_call')::boolean, consent_call)
     where id = (r->>'id')::uuid and client_email = e;
  end loop;
  for v_k in select jsonb_array_elements_text(coalesce(m.snapshot->'consent_keys', '[]'::jsonb)) loop
    v_ult := public._consent_ultimo(e, v_k);
    foreach v_ch in array array['sms', 'call'] loop
      if v_ult ? v_ch and (v_ult->v_ch->>'at')::timestamptz > m.created_at then
        perform public._consent_espelhar(e, v_k, v_ch, (v_ult->v_ch->>'granted')::boolean);   -- o que a cliente disse depois vale
      end if;
    end loop;
  end loop;

  update desk_merges set undone_at = now() where id = m.id;
  return jsonb_build_object('ok', true, 'id', m.id, 'main_key', m.main_key, 'alias_key', m.alias_key, 'kept_edits', v_kept);
end $$;
revoke all on function public.desk_merge_undo(text, text, uuid) from public;
grant execute on function public.desk_merge_undo(text, text, uuid) to anon, authenticated, service_role;

-- ═══ A FICHA, A BUSCA E O SALVAR enxergam os apelidos (remendos textuais; rodam uma vez) ═══════════════
do $p$
declare d text := pg_get_functiondef('public.desk_client_card(text,text,text)'::regprocedure); n text; k int;
begin
  if position('_desk_keys' in d) > 0 then return; end if;
  n := replace(d, E'ck text := public._desk_ck(p_contact);',
                  E'ck text := public._desk_ck_main(e, public._desk_ck(p_contact)); ks text[] := public._desk_keys(e, public._desk_ck_main(e, public._desk_ck(p_contact)));');
  if n = d then raise exception 'desk_v15: declaração não encontrada em desk_client_card — nada alterado'; end if;
  d := n;
  k := (length(d) - length(replace(d, ' = ck', ''))) / length(' = ck');
  if k <> 13 then raise exception 'desk_v15: esperava 13 comparações "= ck" em desk_client_card, achei % — nada alterado', k; end if;
  d := replace(d, ' = ck', ' = any(ks)');
  d := replace(d, 'd.contact_key = any(ks)', 'd.contact_key = ck');                     -- o perfil é o da principal (já somado)
  n := replace(d, E'(c.phone_key = any(ks) or lower(c.email) = any(ks)) limit 1',
                  E'(c.phone_key = any(ks) or lower(c.email) = any(ks)) order by (c.phone_key = ck or lower(c.email) = ck) desc limit 1');
  if n = d then raise exception 'desk_v15: leitura do CRM não encontrada em desk_client_card — nada alterado'; end if;
  d := n;
  n := replace(d, E'jsonb_build_object(\'ok\', true, \'contact_key\', ck,', E'jsonb_build_object(\'ok\', true, \'contact_key\', ck, \'aliases\', public._desk_aliases_json(e, ck),');
  if n = d then raise exception 'desk_v15: resposta não encontrada em desk_client_card — nada alterado'; end if;
  execute n;
end $p$;

do $p$
declare d text := pg_get_functiondef('public.desk_client_search(text,text,text)'::regprocedure); n text;
begin
  if position('_desk_ck_main' in d) > 0 then return; end if;
  n := replace(d, E'select distinct on (ck) jsonb_build_object(\'contact_key\', ck, \'name\', nm, \'contact\', ct) x, ck from (',
                  E'select distinct on (mk) jsonb_build_object(\'contact_key\', mk, \'name\', nm, \'contact\', ct) x, mk from (');
  if n = d then raise exception 'desk_v15: seleção não encontrada em desk_client_search — nada alterado'; end if;
  d := n;
  n := replace(d, E') u where ck is not null order by ck, seen desc nulls last limit 40) z)',
                  E') u cross join lateral (select public._desk_ck_main(e, u.ck) mk) m where u.ck is not null order by mk, (u.ck = mk) desc, seen desc nulls last limit 40) z)');
  if n = d then raise exception 'desk_v15: ordem não encontrada em desk_client_search — nada alterado'; end if;
  execute n;
end $p$;

do $p$
declare d text := pg_get_functiondef('public.desk_client_save(text,text,text,jsonb)'::regprocedure); n text;
begin
  if position('_desk_ck_main' in d) > 0 then return; end if;
  n := replace(d, E'ck text := public._desk_ck(p_contact);', E'ck text := public._desk_ck_main(e, public._desk_ck(p_contact));');
  if n = d then raise exception 'desk_v15: declaração não encontrada em desk_client_save — nada alterado'; end if;
  execute n;
end $p$;

-- ═══ CHECAGEM: tem de devolver aplicado = true ══════════════════════════════════════════════════
select position('_desk_keys' in pg_get_functiondef('public.desk_client_card(text,text,text)'::regprocedure)) > 0
   and position('_desk_pp_status' in pg_get_functiondef('public.desk_client_card(text,text,text)'::regprocedure)) > 0
   and position('_desk_ck_main' in pg_get_functiondef('public.desk_client_search(text,text,text)'::regprocedure)) > 0
   and position('_desk_ck_main' in pg_get_functiondef('public.desk_client_save(text,text,text,jsonb)'::regprocedure)) > 0
   and to_regprocedure('public.desk_merge(text,text,text,text)') is not null
   and to_regprocedure('public.desk_merge_undo(text,text,uuid)') is not null
   and to_regprocedure('public.desk_merge_preview(text,text,text,text)') is not null
   and to_regprocedure('public.desk_merge_suggest(text,text)') is not null
   and to_regclass('public.desk_client_alias') is not null
   as aplicado;
