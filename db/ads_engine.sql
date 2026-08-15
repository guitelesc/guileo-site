-- db/ads_engine.sql — O MOTOR DE ANÚNCIOS: DO DINHEIRO GASTO AO DINHEIRO GANHO.
-- ═════════════════════════════════════════════════════════════════════════════════════════════
--
-- POR QUE ISTO É O CORAÇÃO E NÃO MAIS UM RELATÓRIO
--
-- O Google e a Meta sabem CLIQUES. O dono do salão sabe FATURAMENTO. Ninguém liga os dois, porque
-- o elo do meio é o TELEFONE — e nenhuma plataforma de anúncio enxerga uma ligação. É por isso que
-- todo dono de negócio local diz a mesma frase: "gastei em anúncio e não sei se voltou".
--
-- A Guileo é dona exatamente desse elo que falta. Ela atende a ligação, marca, cobra. Ligar
-- GASTO → LEAD → LIGAÇÃO → AGENDAMENTO → RECEITA é uma conta que o Google não consegue fazer
-- sozinho, por mais dados que tenha. Esta é a vantagem estrutural, não um gráfico bonito.
--
-- ── AS TRÊS REGRAS QUE ESTE ARQUIVO OBEDECE ─────────────────────────────────────────────────
--
-- 1. NÚMERO SEM LASTRO NÃO EXISTE. Se o gasto não foi informado, o retorno é NULL com o motivo —
--    nunca zero. "ROAS 0" e "não sei o gasto" são coisas opostas, e mostrar a primeira quando a
--    verdade é a segunda faz o cliente cortar a campanha que estava funcionando.
--
-- 2. PRIMEIRO CLIQUE VENCE, POR 90 DIAS. Quem clica no anúncio hoje e liga na quinta continua
--    sendo daquele anúncio. Atribuir ao "último toque" premiaria o canal errado — normalmente a
--    busca pelo nome do negócio, que só existe porque o anúncio criou a lembrança.
--
-- 3. A PESSOA É UMA SÓ. A atribuição é ancorada na `phone_key` (a chave canônica de telefone
--    criada em db/crm_phone_identity.sql), não no formato do número. Sem isso o mesmo cliente
--    vira duas pessoas e o mesmo anúncio é contado duas vezes — inflando o resultado justamente
--    do lado que interessa vender.
--
-- Idempotente: pode rodar quantas vezes quiser.

-- ── 1. O GASTO ───────────────────────────────────────────────────────────────────────────────
-- Uma linha por dia × plataforma × campanha. Vem da mão (o time lança) ou de importação; a
-- estrutura é a mesma, então o dia em que a API do Google entrar nada aqui muda.
create table if not exists public.ad_spend (
  id            uuid primary key default gen_random_uuid(),
  client_email  text not null,
  day           date not null,
  source        text not null,                 -- google | meta | tiktok | outro
  campaign      text not null default '(sem campanha)',
  spend_cents   bigint not null default 0 check (spend_cents >= 0),
  clicks        integer not null default 0 check (clicks >= 0),
  impressions   integer not null default 0 check (impressions >= 0),
  updated_at    timestamptz not null default now()
);
-- Regravar o mesmo dia SUBSTITUI em vez de somar: importação roda de novo o tempo todo, e gasto
-- duplicado é o erro mais caro deste arquivo — ele faz uma campanha lucrativa parecer perdedora.
create unique index if not exists ad_spend_dia_unico
  on public.ad_spend (client_email, day, source, campaign);

-- ── 2. DE QUAL ANÚNCIO VEIO ESTA PESSOA ──────────────────────────────────────────────────────
create table if not exists public.lead_attribution (
  id             uuid primary key default gen_random_uuid(),
  client_email   text not null,
  phone_key      text,                          -- chave canônica (mesma do CRM)
  contact_email  text,
  source         text,                          -- google | meta | ... (utm_source)
  medium         text,
  campaign       text,
  term           text,
  content        text,
  gclid          text,
  fbclid         text,
  landing        text,
  first_seen_at  timestamptz not null default now()
);
-- PRIMEIRO TOQUE VENCE: um índice único por pessoa impede que a segunda visita (normalmente
-- "google/orgânico", a busca pelo nome do negócio) roube o crédito do anúncio que a trouxe.
create unique index if not exists lead_attr_pessoa_unica
  on public.lead_attribution (client_email, phone_key) where phone_key is not null;
-- ⚠️ O ÍNDICE ACIMA É PARCIAL, e por isso não bastava. Lead que chega SÓ COM E-MAIL (formulário
-- sem campo de telefone) tem phone_key null, escapa dele, e cada nova submissão da MESMA pessoa
-- insere OUTRA linha. Como `leads_por_campanha` conta LINHAS, a mesma pessoa vira 3 leads: o
-- custo por lead cai 3× sem nada ter melhorado, e o motor manda subir orçamento em cima disso.
-- Fechado em 2026-08-11, com ZERO linhas afetadas na base — que é quando fechar sai barato.
create unique index if not exists lead_attr_email_unico
  on public.lead_attribution (client_email, contact_email)
  where phone_key is null and contact_email is not null;
create index if not exists lead_attr_campanha
  on public.lead_attribution (client_email, source, campaign);

alter table public.ad_spend          enable row level security;
alter table public.lead_attribution  enable row level security;
-- Sem policy para anon de propósito: só as RPCs SECURITY DEFINER abaixo enxergam estas tabelas.

-- ── 3. GRAVAR A ATRIBUIÇÃO (primeiro toque vence) ────────────────────────────────────────────
create or replace function public.ads_attr_record(
  p_secret text, p_email text, p_phone text default null, p_contact_email text default null,
  p_source text default null, p_medium text default null, p_campaign text default null,
  p_term text default null, p_content text default null,
  p_gclid text default null, p_fbclid text default null, p_landing text default null
) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_tenant text := lower(trim(p_email)); v_key text; v_mail text; v_id uuid;
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350') then raise exception 'unauthorized' using errcode='28000'; end if;
  if v_tenant = '' or v_tenant is null then return jsonb_build_object('ok', false, 'reason', 'sem tenant'); end if;

  v_key  := public._gui_phone_key(p_phone);
  v_mail := nullif(lower(trim(coalesce(p_contact_email,''))),'');

  -- Sem NADA de origem não gravamos linha nenhuma: uma atribuição vazia polui a contagem de leads
  -- por campanha e faz "(sem campanha)" parecer o melhor canal do cliente.
  if coalesce(nullif(p_source,''), nullif(p_campaign,''), nullif(p_gclid,''), nullif(p_fbclid,'')) is null then
    return jsonb_build_object('ok', false, 'reason', 'visita sem origem de anuncio');
  end if;

  -- SEM IDENTIDADE NÃO É LEAD. Sem telefone e sem e-mail não há como saber se é a mesma pessoa de
  -- ontem, então cada visita viraria um "lead" novo e o custo por lead do cliente despencaria por
  -- contagem, não por resultado. Recusa explícita, com o motivo — o padrão desta casa.
  if v_key is null and v_mail is null then
    return jsonb_build_object('ok', false, 'reason', 'sem telefone nem e-mail — nao da para contar como pessoa');
  end if;

  -- DOIS CAMINHOS porque são DOIS índices parciais: `on conflict` precisa apontar para o índice
  -- que de fato existe naquele caso. Um caminho só (o de telefone) era exatamente o que deixava a
  -- pessoa sem telefone duplicar em silêncio.
  if v_key is not null then
    insert into lead_attribution (client_email, phone_key, contact_email, source, medium, campaign,
                                  term, content, gclid, fbclid, landing)
    values (v_tenant, v_key, v_mail,
            nullif(p_source,''), nullif(p_medium,''), coalesce(nullif(p_campaign,''), '(sem campanha)'),
            nullif(p_term,''), nullif(p_content,''), nullif(p_gclid,''), nullif(p_fbclid,''), nullif(p_landing,''))
    on conflict (client_email, phone_key) where phone_key is not null
    do update set contact_email = coalesce(lead_attribution.contact_email, excluded.contact_email)
    returning id into v_id;
  else
    insert into lead_attribution (client_email, phone_key, contact_email, source, medium, campaign,
                                  term, content, gclid, fbclid, landing)
    values (v_tenant, null, v_mail,
            nullif(p_source,''), nullif(p_medium,''), coalesce(nullif(p_campaign,''), '(sem campanha)'),
            nullif(p_term,''), nullif(p_content,''), nullif(p_gclid,''), nullif(p_fbclid,''), nullif(p_landing,''))
    on conflict (client_email, contact_email) where phone_key is null and contact_email is not null
    do update set contact_email = lead_attribution.contact_email   -- no-op: primeiro toque vence
    returning id into v_id;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'primeiro_toque_mantido', true);
end $$;

-- ── 4. LANÇAR GASTO ──────────────────────────────────────────────────────────────────────────
create or replace function public.ads_spend_set(
  p_secret text, p_email text, p_day date, p_source text, p_campaign text,
  p_spend_cents bigint, p_clicks integer default 0, p_impressions integer default 0
) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_tenant text := lower(trim(p_email)); v_id uuid;
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350') then raise exception 'unauthorized' using errcode='28000'; end if;
  if v_tenant is null or v_tenant = '' or p_day is null then
    return jsonb_build_object('ok', false, 'reason', 'tenant e dia sao obrigatorios');
  end if;
  if coalesce(p_spend_cents,0) < 0 then return jsonb_build_object('ok', false, 'reason', 'gasto negativo'); end if;

  insert into ad_spend (client_email, day, source, campaign, spend_cents, clicks, impressions, updated_at)
  values (v_tenant, p_day, lower(coalesce(nullif(p_source,''),'outro')),
          coalesce(nullif(p_campaign,''),'(sem campanha)'),
          coalesce(p_spend_cents,0), coalesce(p_clicks,0), coalesce(p_impressions,0), now())
  on conflict (client_email, day, source, campaign)
  do update set spend_cents = excluded.spend_cents, clicks = excluded.clicks,
                impressions = excluded.impressions, updated_at = now()
  returning id into v_id;

  -- Devolve o ID: "ok" sem identificador é promessa sem lastro (lição de 2026-08-07).
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- ── 5. O NÚMERO QUE DECIDE: GASTOU X, VOLTOU Y ───────────────────────────────────────────────
-- ⚠️ ESTA É A v1 E ESTÁ SUPERADA. A versão que roda em produção é a de db/ads_roi_receita_real.sql
-- (receita com procedência recebido/tabela/sem_valor + `dias_com_gasto`). Este bloco continua aqui
-- porque é a instalação inicial do motor; se você colar ESTE arquivo depois daquele, cole
-- db/ads_roi_receita_real.sql EM SEGUIDA — senão o `create or replace` daqui reverte a v2 sem
-- erro nenhum e o painel volta a chamar de "sem retorno" a campanha que só não tem preço
-- cadastrado. Ordem certa: ads_engine.sql → ads_roi_receita_real.sql → ads_alertas.sql.
-- Por campanha: gasto, leads, ligações atendidas, agendamentos, receita agendada, e as contas
-- (custo por lead, custo por cliente, retorno). NULL onde não há lastro — nunca zero de mentira.
create or replace function public.ads_roi(p_secret text, p_email text, p_days integer default 30)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_tenant text := lower(trim(p_email)); v_desde date; v_out jsonb;
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350') then raise exception 'unauthorized' using errcode='28000'; end if;
  v_desde := (now() at time zone 'America/New_York')::date - greatest(1, least(365, coalesce(p_days,30)));

  with gasto as (
    select source, campaign, sum(spend_cents)::bigint as spend_cents,
           sum(clicks)::int as clicks, sum(impressions)::int as impressions
      from ad_spend
     where client_email = v_tenant and day >= v_desde
     group by 1,2
  ),
  -- As pessoas que aquele anúncio trouxe, dentro da janela.
  pessoas as (
    select a.source, a.campaign, a.phone_key, a.contact_email
      from lead_attribution a
     where a.client_email = v_tenant and a.first_seen_at >= v_desde
  ),
  -- RECEITA = agendamentos NÃO cancelados dessas pessoas × preço do serviço. Usamos o que foi
  -- efetivamente marcado, não uma projeção: prometer receita futura num painel de anúncio é
  -- exatamente como as agências enganam o cliente.
  receita as (
    select p.source, p.campaign,
           count(distinct p.phone_key) filter (where p.phone_key is not null) as leads,
           count(distinct ap.id)                                              as agendamentos,
           coalesce(sum(coalesce(s.price_cents,0)), 0)::bigint                as receita_cents
      from pessoas p
      left join crm_contacts c
        on c.client_email = v_tenant and c.phone_key = p.phone_key
      left join biz_appointments ap
        on ap.client_email = v_tenant
       and ap.status <> 'cancelled'
       and lower(ap.customer_contact) is not distinct from lower(coalesce(c.phone, ''))
       and lower(ap.span::text) >= v_desde::text
      left join biz_services s on s.id = ap.service_id
     group by 1,2
  ),
  -- Contagem de leads independente da receita (uma pessoa sem agendamento continua sendo lead).
  leads_por_campanha as (
    select source, campaign, count(*) as leads from pessoas group by 1,2
  ),
  linhas as (
    select
      coalesce(g.source, l.source)     as canal,
      coalesce(g.campaign, l.campaign) as campanha,
      g.spend_cents, g.clicks, g.impressions,
      coalesce(l.leads, 0)             as leads,
      coalesce(r.agendamentos, 0)      as agendamentos,
      coalesce(r.receita_cents, 0)     as receita_cents
    from gasto g
    full outer join leads_por_campanha l on l.source = g.source and l.campaign = g.campaign
    left join receita r on r.source = coalesce(g.source, l.source) and r.campaign = coalesce(g.campaign, l.campaign)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'canal', canal, 'campanha', campanha,
    'gasto_cents', spend_cents, 'cliques', clicks, 'impressoes', impressions,
    'leads', leads, 'agendamentos', agendamentos, 'receita_cents', receita_cents,
    -- As três contas que o dono do negócio realmente lê. NULL = não dá para calcular, e o
    -- motivo vem junto para o painel não ter que adivinhar como explicar o vazio.
    'custo_por_lead_cents', case when spend_cents is null then null
                                 when leads = 0 then null
                                 else round(spend_cents::numeric / leads) end,
    'custo_por_cliente_cents', case when spend_cents is null then null
                                    when agendamentos = 0 then null
                                    else round(spend_cents::numeric / agendamentos) end,
    'retorno', case when spend_cents is null or spend_cents = 0 then null
                    else round((receita_cents::numeric / spend_cents), 2) end,
    'porque_sem_retorno', case
        when spend_cents is null then 'gasto desta campanha nao foi lancado'
        when spend_cents = 0 then 'gasto lancado como zero'
        when receita_cents = 0 and leads > 0 then 'trouxe lead mas ainda nao gerou agendamento'
        when leads = 0 then 'nenhum lead atribuido a esta campanha ainda'
        else null end
  ) order by coalesce(receita_cents,0) desc, coalesce(spend_cents,0) desc), '[]'::jsonb)
  into v_out from linhas;

  return jsonb_build_object(
    'desde', v_desde,
    'campanhas', v_out,
    -- Totais só somam o que TEM lastro dos dois lados; misturar campanha sem gasto no total
    -- inflaria o retorno geral e é como se mente com verdade.
    'total_gasto_cents', (select coalesce(sum(spend_cents),0) from ad_spend where client_email=v_tenant and day>=v_desde),
    'total_leads', (select count(*) from lead_attribution where client_email=v_tenant and first_seen_at>=v_desde)
  );
end $$;

revoke all on function public.ads_attr_record(text,text,text,text,text,text,text,text,text,text,text,text) from public;
revoke all on function public.ads_spend_set(text,text,date,text,text,bigint,integer,integer) from public;
revoke all on function public.ads_roi(text,text,integer) from public;
grant execute on function public.ads_attr_record(text,text,text,text,text,text,text,text,text,text,text,text) to anon;
grant execute on function public.ads_spend_set(text,text,date,text,text,bigint,integer,integer) to anon;
grant execute on function public.ads_roi(text,text,integer) to anon;
