-- ============================================================================
-- GUILEO · COMENTÁRIO → DM no INSTAGRAM  (cole no Supabase → SQL Editor → Run)
-- Projeto: ynihodbknhjirkdogxby (smart@guileoai.com) · Idempotente (pode rodar de novo).
--
-- TESE: alguém comenta "PREÇO" no reel do cliente e recebe o preço no direct um segundo
-- depois. O direct abre a conversa; a Gui (functions/api/meta-webhook.js, que JÁ responde DM)
-- conduz dali em diante. Um cérebro, mais um canal — não um sistema paralelo.
--
-- POR QUE AQUI DENTRO E NÃO NUM APP SEPARADO: um app Meta tem UMA callback URL de Instagram.
-- Apontar essa URL pra outro serviço tira a Gui do ar no direct. E assinar `messages` em dois
-- apps entrega o MESMO DM duas vezes → o cliente recebe resposta dobrada. Com o comentário
-- morando no mesmo webhook, isso é impossível por construção.
--
-- SEGURANÇA: toda RPC é SECURITY DEFINER, gated pelo literal INGEST canônico
-- ('glo_ing_c7f2a9e4b8d16350' — o MESMO de db/marketplace_leads.sql e outros 437 usos;
-- ⚠️ NÃO é o que a tabela de portões do ARQUITETURA.md mostra, que está desatualizada),
-- granted to anon, e escopada por p_email. Tabelas com RLS ON e ZERO policy anon: só as
-- funções definer alcançam. Nenhum tenant lê campanha de outro.
--
-- ANTI-SPAM (a parte que protege a conta DO CLIENTE): três travas, todas no banco porque só
-- o banco é atômico entre invocações concorrentes do Worker —
--   1. exatamente-uma-vez por comentário  (unique index em (client_email, comment_id))
--   2. freio por PESSOA                    (espera mínima + teto por janela de 24h)
--   3. teto por CONTA                      (750 private replies/hora, limite documentado da Meta)
-- A trava 2 é a que o dedup por comentário NÃO cobre: a mesma pessoa comentando a palavra em
-- quatro fotos gera quatro comentários DIFERENTES — e quatro direct idênticos são a definição
-- operacional de spam pra Meta. Quem apanha é a conta do cliente, não a nossa.
-- ============================================================================

-- ── TABELA: as campanhas que o dono cria no cockpit ──────────────────────────
create table if not exists public.meta_comment_campaigns (
  id            uuid primary key default gen_random_uuid(),
  client_email  text not null,
  ig_id         text not null,                       -- a conta do Instagram que recebe
  nome          text not null default 'Campanha',    -- rótulo pro dono se achar
  media_id      text,                                -- NULL = vale pra TODOS os posts
  keywords      text[] not null default '{}',        -- como o dono digitou (com acento)
  match_mode    text not null default 'palavra',     -- palavra | contem
  dm_text       text not null,                       -- aceita {nome}
  public_reply  text,                                -- resposta pública opcional sob o comentário
  link_url      text,                                -- speed-to-lead ou link do negócio
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint meta_cc_modo_ok check (match_mode in ('palavra','contem'))
);
create index if not exists idx_meta_cc_conta on public.meta_comment_campaigns (client_email, ig_id, active);

-- ── TABELA: o registro de envio (é ELE que faz as três travas funcionarem) ───
create table if not exists public.meta_comment_sends (
  id            uuid primary key default gen_random_uuid(),
  client_email  text not null,
  ig_id         text not null,
  pessoa        text not null,          -- id do Instagram de quem comentou
  comment_id    text not null,
  campaign_id   uuid,
  created_at    timestamptz not null default now()
);
-- A trava 1 é ESTE índice, não um `if exists` no código: duas invocações do Worker no mesmo
-- milissegundo passam as duas por um `select`, mas só uma sobrevive a um unique index.
create unique index if not exists uq_meta_cs_comment on public.meta_comment_sends (client_email, comment_id);
create index if not exists idx_meta_cs_pessoa on public.meta_comment_sends (client_email, ig_id, pessoa, created_at desc);
create index if not exists idx_meta_cs_conta  on public.meta_comment_sends (client_email, ig_id, created_at desc);

alter table public.meta_comment_campaigns enable row level security;
alter table public.meta_comment_sends     enable row level security;

-- ── PORTÃO (literal canônico, igual ao resto do sistema) ─────────────────────
create or replace function public._meta_cc_ok(p_secret text) returns boolean
language sql immutable as $$ select p_secret = 'glo_ing_c7f2a9e4b8d16350' $$;

-- ── LEITURA do webhook: as campanhas ativas desta conta de Instagram ─────────
create or replace function public.meta_campanhas_ativas(
  p_secret text, p_email text, p_ig_id text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not public._meta_cc_ok(p_secret) then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc), '[]'::jsonb) into v
    from public.meta_comment_campaigns c
   where c.client_email = p_email and c.ig_id = p_ig_id and c.active = true;
  return v;
exception when others then return '[]'::jsonb;  -- degrade honesto: sem campanha, nada dispara
end $$;

-- ── A RESERVA ATÔMICA: pode mandar DM pra esta pessoa por este comentário? ───
-- Devolve {ok:true, id} ou {ok:false, motivo:'...'}. O MOTIVO é o produto: "não mandou" sem
-- dizer por quê não se investiga, e foi exatamente assim que 13 ligações "com sucesso"
-- esconderam um agente que nunca chamou a ferramenta.
create or replace function public.meta_comment_claim(
  p_secret text, p_email text, p_ig_id text, p_pessoa text, p_comment_id text,
  p_campaign_id uuid,
  p_espera_min int default 10, p_max_janela int default 3,
  p_janela_horas int default 24, p_teto_hora int default 750
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_n int; v_ult timestamptz;
begin
  if not public._meta_cc_ok(p_secret) then return jsonb_build_object('ok', false, 'motivo', 'forbidden'); end if;
  if coalesce(p_email,'') = '' or coalesce(p_comment_id,'') = '' or coalesce(p_pessoa,'') = '' then
    return jsonb_build_object('ok', false, 'motivo', 'dados_faltando');
  end if;

  -- Serializa POR PESSOA dentro da transação. Sem isso, dois comentários diferentes da mesma
  -- pessoa chegando juntos passam os dois pelas contagens abaixo (read-then-write clássico) e
  -- o freio anti-spam não freia nada justamente na rajada, que é quando ele precisa existir.
  perform pg_advisory_xact_lock(hashtext(p_email || '|' || p_ig_id || '|' || p_pessoa));

  -- trava 1 (PRIMEIRO — corrigido 2026-08-27 pela prova de round-trip): já tratamos este
  -- comentário? A Meta reentrega por ROTINA. Com esta pergunta depois da janela por pessoa, a
  -- reentrega voltava como 'muito_cedo' e o feed do cockpit registrava "o DM foi segurado" para
  -- um não-evento — o dono lendo que o freio está barrando lead quando nada aconteceu.
  perform 1 from public.meta_comment_sends
   where client_email = p_email and comment_id = p_comment_id;
  if found then return jsonb_build_object('ok', false, 'motivo', 'duplicado'); end if;

  -- trava 3: teto da conta (750/h da Meta). Estourar não é multa, é bloqueio da conta do cliente.
  select count(*) into v_n from public.meta_comment_sends
   where client_email = p_email and ig_id = p_ig_id and created_at > now() - interval '1 hour';
  if v_n >= p_teto_hora then return jsonb_build_object('ok', false, 'motivo', 'teto_hora'); end if;

  -- trava 2: freio por pessoa
  select count(*), max(created_at) into v_n, v_ult from public.meta_comment_sends
   where client_email = p_email and ig_id = p_ig_id and pessoa = p_pessoa
     and created_at > now() - make_interval(hours => p_janela_horas);
  if v_ult is not null and v_ult > now() - make_interval(mins => p_espera_min) then
    return jsonb_build_object('ok', false, 'motivo', 'muito_cedo');
  end if;
  if v_n >= p_max_janela then return jsonb_build_object('ok', false, 'motivo', 'limite_pessoa'); end if;

  -- o índice único continua sendo o árbitro final da corrida entre invocações concorrentes
  insert into public.meta_comment_sends (client_email, ig_id, pessoa, comment_id, campaign_id)
       values (p_email, p_ig_id, p_pessoa, p_comment_id, p_campaign_id)
  on conflict (client_email, comment_id) do nothing
    returning id into v_id;
  if v_id is null then return jsonb_build_object('ok', false, 'motivo', 'duplicado'); end if;

  return jsonb_build_object('ok', true, 'id', v_id);
exception when others then
  -- ⚠️ FALHA AQUI É FAIL-CLOSED, ao contrário do dedup de DM (meta_mark_seen, que abre).
  -- Lá o pior caso é uma resposta repetida; aqui é mandar direct SEM nenhum freio de taxa —
  -- ou seja, rajada na conta do cliente. Na dúvida, não manda.
  return jsonb_build_object('ok', false, 'motivo', 'erro:' || left(sqlerrm, 80));
end $$;

-- ── CRUD do cockpit (o endpoint autentica o tenant ANTES e passa o e-mail) ───
create or replace function public.meta_campanhas_listar(
  p_secret text, p_email text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not public._meta_cc_ok(p_secret) then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc), '[]'::jsonb) into v
    from public.meta_comment_campaigns c where c.client_email = p_email;
  return v;
exception when others then return '[]'::jsonb;
end $$;

create or replace function public.meta_campanha_salvar(
  p_secret text, p_email text, p_id uuid, p_ig_id text, p_nome text, p_media_id text,
  p_keywords text[], p_match_mode text, p_dm_text text, p_public_reply text,
  p_link_url text, p_active boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public._meta_cc_ok(p_secret) then return jsonb_build_object('ok', false, 'motivo','forbidden'); end if;
  if coalesce(p_email,'') = '' or coalesce(p_ig_id,'') = '' or coalesce(p_dm_text,'') = '' then
    return jsonb_build_object('ok', false, 'motivo', 'dados_faltando');
  end if;
  if p_id is null then
    insert into public.meta_comment_campaigns
      (client_email, ig_id, nome, media_id, keywords, match_mode, dm_text, public_reply, link_url, active)
      values (p_email, p_ig_id, coalesce(nullif(p_nome,''),'Campanha'), nullif(p_media_id,''),
              coalesce(p_keywords,'{}'), coalesce(nullif(p_match_mode,''),'palavra'), p_dm_text,
              nullif(p_public_reply,''), nullif(p_link_url,''), coalesce(p_active, true))
      returning id into v_id;
  else
    -- Escopo do tenant no WHERE, nunca só pelo id: UUID sozinho NÃO autoriza nada.
    update public.meta_comment_campaigns set
      ig_id = p_ig_id, nome = coalesce(nullif(p_nome,''),'Campanha'), media_id = nullif(p_media_id,''),
      keywords = coalesce(p_keywords,'{}'), match_mode = coalesce(nullif(p_match_mode,''),'palavra'),
      dm_text = p_dm_text, public_reply = nullif(p_public_reply,''), link_url = nullif(p_link_url,''),
      active = coalesce(p_active, true), updated_at = now()
     where id = p_id and client_email = p_email
     returning id into v_id;
    if v_id is null then return jsonb_build_object('ok', false, 'motivo', 'nao_encontrada'); end if;
  end if;
  -- Devolve o ID do que foi criado: "ok" sem comprovante é promessa sem lastro.
  return jsonb_build_object('ok', true, 'id', v_id);
exception when others then
  return jsonb_build_object('ok', false, 'motivo', 'erro:' || left(sqlerrm, 80));
end $$;

create or replace function public.meta_campanha_apagar(
  p_secret text, p_email text, p_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not public._meta_cc_ok(p_secret) then return jsonb_build_object('ok', false, 'motivo','forbidden'); end if;
  delete from public.meta_comment_campaigns where id = p_id and client_email = p_email;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', v_n > 0, 'apagadas', v_n);
exception when others then return jsonb_build_object('ok', false, 'motivo', 'erro:' || left(sqlerrm, 80));
end $$;

-- ── ESTATÍSTICA pro cockpit: quantos DM saíram e por quê alguns não saíram ───
create or replace function public.meta_comment_stats(
  p_secret text, p_email text, p_dias int default 30
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not public._meta_cc_ok(p_secret) then return '{}'::jsonb; end if;
  select jsonb_build_object(
    'enviados', count(*),
    'pessoas', count(distinct pessoa),
    'por_campanha', coalesce((select jsonb_object_agg(coalesce(campaign_id::text,'-'), n)
        from (select campaign_id, count(*) n from public.meta_comment_sends
               where client_email = p_email and created_at > now() - make_interval(days => p_dias)
               group by campaign_id) q), '{}'::jsonb)
  ) into v from public.meta_comment_sends
   where client_email = p_email and created_at > now() - make_interval(days => p_dias);
  return coalesce(v, '{}'::jsonb);
exception when others then return '{}'::jsonb;
end $$;

grant execute on function public.meta_campanhas_ativas(text,text,text)                       to anon;
grant execute on function public.meta_comment_claim(text,text,text,text,text,uuid,int,int,int,int) to anon;
grant execute on function public.meta_campanhas_listar(text,text)                            to anon;
grant execute on function public.meta_campanha_salvar(text,text,uuid,text,text,text,text[],text,text,text,text,boolean) to anon;
grant execute on function public.meta_campanha_apagar(text,text,uuid)                        to anon;
grant execute on function public.meta_comment_stats(text,text,int)                           to anon;
