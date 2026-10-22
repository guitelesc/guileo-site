-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- GUILEO DIRECT · O FUNIL MEDIDO  (idempotente — pode rodar de novo). Depende de db/meta_comment_dm.sql.
--
-- POR QUE (2026-10-04): o Direct tinha UM número de verdade — "DM enviado", em meta_comment_sends.
-- Todo o resto (casou, segurado e por quê, falhou e por quê, idioma, resposta pública) virava FRASE
-- com emoji no feed do dono (client_events). Frase é pra humano ler; ela muda de redação, e uma
-- contagem que parseia emoji passa a mentir no dia em que alguém melhora um texto. Métrica precisa
-- de coluna com nome fixo — por isso esta tabela existe ao lado do feed, e não em cima dele.
--
-- O FUNIL, na ordem em que a pessoa anda:
--   comentario → casou → (segurado | dm_enviado | dm_falhou) → publica_ok/falhou
--              → [clique no link → lead]  (lead_attribution, medium='direct', campaign=<id>)
--              → [ela escreve no Direct]  (dm_recebida da MESMA pessoa depois do DM = conversa aberta)
-- E o lado da conversa: dm_recebida → dm_respondida | dm_nao_entregue | standby.
--
-- ⚓ MESMA PESSOA NOS DOIS LADOS (conferido nos dados, não suposto): o `from.id` do comentário é o
-- mesmo id que escreve no Direct — o comentarista 1838527607521702 da Chigo é o participante da
-- conversa 337791 no Blotato. É isso que permite ligar comentário → conversa sem adivinhar.
--
-- SEGURANÇA: SECURITY DEFINER, gated por _meta_cc_ok (literal INGEST), RLS ON sem policy, e
-- execute SÓ para service_role — o projeto está fechando o anon (ingest_client_event já não aceita).
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

create table if not exists public.meta_direct_eventos (
  id          bigserial primary key,
  client_email text not null,
  ig_id       text,
  campaign_id uuid,
  pessoa      text,
  comment_id  text,
  media_id    text,
  etapa       text not null,
  motivo      text,          -- por que segurou / por que falhou / por qual nó saiu / quem respondeu
  palavra     text,          -- a palavra-chave que casou
  lang        text,
  lang_via    text,          -- escrita | palavra | padrao — a diferença entre consertar em 1 min ou numa tarde
  ms          int,           -- quanto tempo NOSSO entre receber e entregar
  origem      text not null default 'ao_vivo',   -- 'ao_vivo' | 'historico' (carga única, abaixo)
  created_at  timestamptz not null default now()
);

do $$ begin
  alter table public.meta_direct_eventos add constraint meta_direct_eventos_etapa_ck check (etapa in (
    'comentario','casou','segurado','dm_enviado','dm_falhou','publica_ok','publica_falhou',
    'dm_recebida','dm_respondida','dm_nao_entregue','standby'));
exception when duplicate_object then null; end $$;

create index if not exists idx_mde_tenant_tempo  on public.meta_direct_eventos (client_email, created_at desc);
create index if not exists idx_mde_tenant_etapa  on public.meta_direct_eventos (client_email, etapa, created_at desc);
create index if not exists idx_mde_pessoa        on public.meta_direct_eventos (client_email, ig_id, pessoa, created_at desc);
alter table public.meta_direct_eventos enable row level security;

-- ── GRAVAR UMA ETAPA ───────────────────────────────────────────────────────────────────────────
-- Nunca levanta exceção: medir não pode derrubar o envio. Devolve false quando não gravou, e quem
-- chama decide se isso merece barulho (o webhook não faz barulho — o funil é diagnóstico, não produto).
create or replace function public.direct_evento(
  p_secret text, p_email text, p_etapa text,
  p_ig_id text default null, p_campaign_id uuid default null, p_pessoa text default null,
  p_comment_id text default null, p_media_id text default null, p_motivo text default null,
  p_palavra text default null, p_lang text default null, p_lang_via text default null, p_ms int default null
) returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public._meta_cc_ok(p_secret) or coalesce(p_email,'') = '' then return false; end if;
  insert into public.meta_direct_eventos
    (client_email, etapa, ig_id, campaign_id, pessoa, comment_id, media_id, motivo, palavra, lang, lang_via, ms)
  values (lower(trim(p_email)), p_etapa, nullif(p_ig_id,''), p_campaign_id, nullif(p_pessoa,''),
          nullif(p_comment_id,''), nullif(p_media_id,''), left(p_motivo, 240), left(p_palavra, 60),
          left(p_lang, 8), left(p_lang_via, 16), p_ms);
  return true;
exception when others then return false;
end $$;

-- ── DE ONDE ESTA PESSOA VEIO (pra Gui não atender às cegas) ────────────────────────────────────
-- Quem recebeu o DM de um comentário e responde no Direct está no MEIO de uma conversa que a Gui
-- começou — sobre o post X, na palavra Y. Sem isto ela recebe "e pra 2 pessoas?" sem saber 2 de quê.
-- Janela de 7 dias: é a mesma janela em que a Meta deixa o private reply abrir conversa.
create or replace function public.direct_contexto_pessoa(
  p_secret text, p_email text, p_ig_id text, p_pessoa text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public._meta_cc_ok(p_secret) then return null; end if;
  select e.created_at, e.palavra, e.media_id, e.lang, c.nome as campanha
    into r
    from public.meta_direct_eventos e
    left join public.meta_comment_campaigns c on c.id = e.campaign_id
   where e.client_email = lower(trim(p_email)) and e.pessoa = p_pessoa
     and (p_ig_id is null or e.ig_id = p_ig_id)
     and e.etapa = 'casou' and e.created_at > now() - interval '7 days'
   order by e.created_at desc limit 1;
  if not found then return null; end if;
  return jsonb_build_object('quando', r.created_at, 'palavra', r.palavra, 'media_id', r.media_id,
                            'lang', r.lang, 'campanha', r.campanha);
exception when others then return null;
end $$;

-- ── AS MÉTRICAS (o painel do dono lê só isto) ──────────────────────────────────────────────────
create or replace function public.direct_metricas(p_secret text, p_email text, p_dias int default 30)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_desde timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_dias, 30), 365)));
  v jsonb;
begin
  if not public._meta_cc_ok(p_secret) or v_email = '' then return '{}'::jsonb; end if;

  with ev as (
    select * from public.meta_direct_eventos where client_email = v_email and created_at > v_desde
  ),
  enviados as (select * from ev where etapa = 'dm_enviado'),
  -- conversa aberta: a pessoa que recebeu o DM do comentário ESCREVEU no Direct depois dele (≤7 dias)
  conversas as (
    select distinct d.campaign_id, d.pessoa
      from enviados d
     where exists (select 1 from public.meta_direct_eventos r
                    where r.client_email = v_email and r.etapa = 'dm_recebida' and r.pessoa = d.pessoa
                      and r.created_at > d.created_at and r.created_at < d.created_at + interval '7 days')
  ),
  leads as (
    select campaign from public.lead_attribution
     where client_email = v_email and lower(coalesce(medium,'')) = 'direct' and first_seen_at > v_desde
  )
  select jsonb_build_object(
    'dias', extract(day from now() - v_desde)::int,
    'medindo_desde', (select min(created_at) from public.meta_direct_eventos where client_email = v_email and origem = 'ao_vivo'),
    'historico_desde', (select min(created_at) from public.meta_direct_eventos where client_email = v_email),
    'funil', jsonb_build_object(
      'comentarios',    (select count(*) from ev where etapa = 'comentario'),
      'casou',          (select count(*) from ev where etapa = 'casou'),
      'segurado',       (select count(*) from ev where etapa = 'segurado'),
      'dm_enviado',     (select count(*) from enviados),
      'dm_falhou',      (select count(*) from ev where etapa = 'dm_falhou'),
      'publica_ok',     (select count(*) from ev where etapa = 'publica_ok'),
      'publica_falhou', (select count(*) from ev where etapa = 'publica_falhou'),
      'pessoas',        (select count(distinct pessoa) from enviados),
      'conversas',      (select count(distinct pessoa) from conversas),
      'leads',          (select count(*) from leads)
    ),
    'segurado_por_motivo', coalesce((select jsonb_object_agg(motivo, n) from
        (select coalesce(motivo,'?') motivo, count(*) n from ev where etapa = 'segurado' group by 1) q), '{}'::jsonb),
    'falhas', coalesce((select jsonb_agg(jsonb_build_object('motivo', motivo, 'n', n) order by n desc) from
        (select left(coalesce(motivo,'?'), 90) motivo, count(*) n from ev where etapa in ('dm_falhou','publica_falhou','dm_nao_entregue')
          group by 1 order by 2 desc limit 5) q), '[]'::jsonb),
    'por_idioma', coalesce((select jsonb_object_agg(lang, n) from
        (select coalesce(lang,'?') lang, count(*) n from enviados group by 1) q), '{}'::jsonb),
    'idioma_via', coalesce((select jsonb_object_agg(lang_via, n) from
        (select coalesce(lang_via,'?') lang_via, count(*) n from enviados group by 1) q), '{}'::jsonb),
    'tempo_ms_mediano', (select percentile_cont(0.5) within group (order by ms)::int from enviados where ms is not null),
    'por_campanha', coalesce((select jsonb_agg(x order by (x->>'enviados')::int desc) from (
        select jsonb_build_object(
          'id', c.id, 'nome', c.nome, 'ig_id', c.ig_id, 'ativa', c.active, 'tem_link', coalesce(c.link_url,'') <> '',
          'casou',     (select count(*) from ev where etapa = 'casou' and campaign_id = c.id),
          'enviados',  (select count(*) from enviados where campaign_id = c.id),
          'falhou',    (select count(*) from ev where etapa = 'dm_falhou' and campaign_id = c.id),
          'segurado',  (select count(*) from ev where etapa = 'segurado' and campaign_id = c.id),
          'conversas', (select count(*) from conversas where campaign_id = c.id),
          'leads',     (select count(*) from leads where campaign = c.id::text)
        ) x
        from public.meta_comment_campaigns c where c.client_email = v_email) q), '[]'::jsonb),
    'conversa', jsonb_build_object(
      'recebidas',      (select count(*) from ev where etapa = 'dm_recebida'),
      'respondidas',    (select count(*) from ev where etapa = 'dm_respondida'),
      'nao_entregues',  (select count(*) from ev where etapa = 'dm_nao_entregue'),
      'standby',        (select count(*) from ev where etapa = 'standby'),
      'pessoas',        (select count(distinct pessoa) from ev where etapa = 'dm_recebida' and pessoa is not null),
      -- QUEM respondeu: "elevenlabs" = o agente do cliente, com o KB e os preços dele; "anthropic" =
      -- a reserva; "frase_segura" = os dois falharam e saiu o "a equipe te confirma". Muita frase
      -- segura é o KB/agente quebrado — e sem esta linha isso parecia "a Gui respondeu" no painel.
      -- DMs cuja CONTA não se sabe (histórico de cliente com 2+ contas). Sem este número a saúde por
      -- conta diria "nunca recebeu DM" de uma conta que recebeu — medido na Guileo em 04/10: 11 DMs
      -- em 28/09, duas contas, nenhuma das duas sabendo que eram suas.
      'sem_conta',      (select count(*) from ev where etapa = 'dm_recebida' and ig_id is null),
      'quem_respondeu', coalesce((select jsonb_object_agg(motivo, n) from
          (select coalesce(motivo,'?') motivo, count(*) n from ev where etapa = 'dm_respondida' group by 1) q), '{}'::jsonb),
      'resposta_ms_mediana', (select percentile_cont(0.5) within group (order by ms)::int from ev where etapa = 'dm_respondida' and ms is not null)
    ),
    -- SAÚDE POR CONTA: "a última DM chegou há 30 dias" numa conta que recebe comentário é o sinal
    -- do alerta "Confirmar acesso às mensagens do Instagram" — que calou a Chigo e a MedMundo em
    -- silêncio. Sem esta coluna, conta muda e conta sem cliente parecem a mesma coisa.
    'contas', coalesce((select jsonb_agg(jsonb_build_object(
          'ig_id', a.ig_id, 'usuario', a.ig_username, 'pagina', a.business_name,
          'ultima_dm_recebida', (select max(created_at) from public.meta_direct_eventos e where e.client_email = v_email and e.etapa = 'dm_recebida' and e.ig_id = a.ig_id),
          'ultimo_comentario',  (select max(created_at) from public.meta_direct_eventos e where e.client_email = v_email and e.etapa in ('comentario','casou') and e.ig_id = a.ig_id),
          'ultimo_dm_enviado',  (select max(created_at) from public.meta_direct_eventos e where e.client_email = v_email and e.etapa = 'dm_enviado' and e.ig_id = a.ig_id)
        ) order by a.created_at) from public.meta_accounts a where a.client_email = v_email), '[]'::jsonb),
    'serie', coalesce((select jsonb_agg(jsonb_build_object('dia', d, 'casou', casou, 'enviados', env, 'recebidas', rec) order by d) from (
        select date_trunc('day', created_at)::date d,
               count(*) filter (where etapa = 'casou') casou,
               count(*) filter (where etapa = 'dm_enviado') env,
               count(*) filter (where etapa = 'dm_recebida') rec
          from ev group by 1) s), '[]'::jsonb)
  ) into v;
  return coalesce(v, '{}'::jsonb);
exception when others then
  -- ⚠️ ERRO NÃO VIRA ZERO: devolve o motivo. Um painel de funil cheio de zeros por causa de uma
  -- consulta quebrada é o diagnóstico falso que este projeto já pagou cinco vezes num dia.
  return jsonb_build_object('erro', left(sqlerrm, 160));
end $$;

revoke all on function public.direct_evento(text,text,text,text,uuid,text,text,text,text,text,text,text,int) from public, anon, authenticated;
revoke all on function public.direct_contexto_pessoa(text,text,text,text) from public, anon, authenticated;
revoke all on function public.direct_metricas(text,text,int) from public, anon, authenticated;
grant execute on function public.direct_evento(text,text,text,text,uuid,text,text,text,text,text,text,text,int) to service_role;
grant execute on function public.direct_contexto_pessoa(text,text,text,text) to service_role;
grant execute on function public.direct_metricas(text,text,int) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- CARGA DO HISTÓRICO (uma vez, refazível). Contador começa no VALOR, não no zero: um painel que
-- estreia dizendo "0 DMs" para a Chigo, que já mandou 3, é mentira na primeira tela.
-- Só entra o que é CERTO: os envios (tabela estruturada), as DMs vistas (dedup estruturado) e as
-- frases do feed cujo formato é fixo no código desde agosto. Tudo marcado origem='historico', e o
-- painel diz desde quando mede AO VIVO. Apaga-e-recarrega: rodar de novo não duplica.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
delete from public.meta_direct_eventos where origem = 'historico';

insert into public.meta_direct_eventos (client_email, etapa, ig_id, campaign_id, pessoa, comment_id, origem, created_at)
select s.client_email, 'dm_enviado', s.ig_id, s.campaign_id, s.pessoa, s.comment_id, 'historico', s.created_at
  from public.meta_comment_sends s;

insert into public.meta_direct_eventos (client_email, etapa, origem, created_at)
select m.client_email, 'dm_recebida', 'historico', m.seen_at from public.meta_msg_seen m;

-- frases do feed: "<pessoa>: 💬 comentou "..." → casou com "<palavra>""
insert into public.meta_direct_eventos (client_email, etapa, pessoa, palavra, origem, created_at)
select e.client_email, 'casou', split_part(e.summary, ':', 1),
       substring(e.summary from '→ casou com "([^"]+)"'), 'historico', e.created_at
  from public.client_events e
 where e.channel = 'Instagram' and e.summary like '%💬 comentou "%→ casou com "%';

-- "<pessoa>: ⏸️ comentário "..." casou com "x" mas o DM foi segurado (<motivo>)"
insert into public.meta_direct_eventos (client_email, etapa, pessoa, motivo, origem, created_at)
select e.client_email, 'segurado', split_part(e.summary, ':', 1),
       substring(e.summary from 'segurado \(([a-z_:]+)\)'), 'historico', e.created_at
  from public.client_events e
 where e.channel = 'Instagram' and e.summary like '%⏸️ comentário%segurado (%';

-- "⚠️ Gui: ⚠️ DM NÃO entregue (<motivo>) 🌐xx — texto: ..."
insert into public.meta_direct_eventos (client_email, etapa, motivo, origem, created_at)
-- o feed CORTA a frase longa: o erro do Graph de 27/08 nunca chega ao " 🌐". Sem a 2ª leitura o
-- motivo virava "?" — exatamente o "não entregue sem dizer por quê" que este arquivo combate.
select e.client_email, 'dm_falhou',
       coalesce(substring(e.summary from 'DM NÃO entregue \((.{1,200}?)\) 🌐'),
                substring(e.summary from 'DM NÃO entregue \((.{1,120})')), 'historico', e.created_at
  from public.client_events e
 where e.channel = 'Instagram' and e.summary like '%⚠️ DM NÃO entregue (%';

-- CONTA NO HISTÓRICO, SÓ ONDE ELA É CERTA. Cliente com UMA conta: a DM antiga só pode ter sido
-- dela, e sem isso a coluna de saúde "última DM recebida" nasce vazia justo na Chigo — a conta que
-- calou. Cliente com DUAS contas fica sem: chutar a conta seria inventar o dado que a coluna mede.
update public.meta_direct_eventos e set ig_id = a.ig_id
  from (select client_email, min(ig_id) ig_id from public.meta_accounts group by 1 having count(*) = 1) a
 where e.origem = 'historico' and e.ig_id is null and e.client_email = a.client_email;

-- Mesma regra para a campanha: conta com UMA campanha só → o "casou"/"segurado" antigo é dela.
update public.meta_direct_eventos e set campaign_id = c.id
  from (select client_email, ig_id, min(id::text)::uuid id from public.meta_comment_campaigns group by 1, 2 having count(*) = 1) c
 where e.origem = 'historico' and e.campaign_id is null and e.etapa in ('casou','segurado','dm_falhou')
   and e.client_email = c.client_email and e.ig_id = c.ig_id;
