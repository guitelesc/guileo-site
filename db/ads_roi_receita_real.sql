-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- ads_roi v2 — RECEITA REAL, e HONESTA sobre de onde ela veio.
--
-- O DEFEITO QUE ISTO CONSERTA (2026-08-11)
-- A v1 media receita por `biz_services.price_cents` — o PREÇO DE TABELA do serviço. Quem cobra
-- valor combinado na hora, quem dá desconto, quem tem serviço sem preço cadastrado: tudo isso
-- entrava como ZERO. E zero silencioso vira veredicto: o motor de reinvestimento manda REDUZIR o
-- orçamento de uma campanha que está dando lucro. É o mesmo mecanismo da chave de telefone com
-- "+" que me enganou hoje — não dá erro, dá um número calmo e errado.
--
-- A HIERARQUIA DE VERDADE (e o motor DIZ qual usou):
--   1. 'recebido'  → dinheiro lançado contra AQUELA pessoa (crm_timeline_events.amount_cents)
--   2. 'tabela'    → sem lançamento; caiu no preço de tabela do serviço. É ESTIMATIVA e vai
--                    rotulada, porque decidir orçamento com estimativa é legítimo — decidir sem
--                    saber que é estimativa, não.
--   3. 'sem_valor' → agendou e não há nem lançamento nem preço. NÃO entra como zero: sai contado
--                    em `agendamentos_sem_valor`, para o dono ver que a medição está cega ali em
--                    vez de ler "esta campanha não deu retorno".
--
-- POR PESSOA, NUNCA POR AGENDAMENTO. Se somasse o dinheiro da pessoa a cada agendamento dela,
-- quem marcou duas vezes contaria a receita em dobro — e campanha superestimada é PIOR que
-- subestimada, porque faz o dono colocar mais dinheiro em cima. Por isso `por_pessoa` resolve o
-- valor de cada pessoa UMA vez, e só depois agrega por campanha.
--
-- Mesma assinatura da v1 (CREATE OR REPLACE é atômico) → zero downtime, quem chama não muda.
-- Campos novos são acréscimo; nenhum campo antigo mudou de nome ou de sentido.
--
-- ── ⚠️ 2026-08-11 · ESTE ARQUIVO JÁ ESTEVE ATRÁS DA PRODUÇÃO, E ERA UMA BOMBA ARMADA ──────────
-- Auditoria repo × pg_proc encontrou DUAS coisas vivas no banco que nunca voltaram para cá:
--
--   1. `dias_com_gasto` (count distinct day em ad_spend). `functions/api/ads.js` lê esse campo
--      para calcular o ORÇAMENTO/DIA da campanha; sem ele cai no fallback `|| dias`, que é a
--      JANELA DO SELETOR. Campanha de 5 dias a $60/dia vista na janela de 30 vira "$10/dia", e o
--      motor anuncia "sobe de $10 para $15 (+50%)" — quem seguisse CORTARIA 75% do orçamento da
--      melhor campanha lendo na tela que estava escalando.
--   2. o filtro `e.event_type = any(_gui_ads_dinheiro_tipos())` na CTE `dinheiro`. Sem ele,
--      QUALQUER evento de timeline com `amount_cents` (orçamento enviado, estimativa, nota de
--      valor) entra como receita de anúncio — receita inflada manda SUBIR verba.
--
-- Como o arquivo é idempotente e documentado como "cole no Supabase", a próxima pessoa que o
-- colasse — para reinstalar, para restaurar, para subir um ambiente novo — desfaria as duas
-- correções em silêncio, com `create or replace` bem-sucedido e zero erro. Arquivo atrasado não
-- é documentação desatualizada: é um rollback esperando alguém apertar o botão.
--
-- REGRA DAQUI PARA A FRENTE: mudou a RPC no banco, o arquivo vem junto no MESMO commit.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- A lista branca de eventos que contam como DINHEIRO (definida também em db/ads_alertas.sql, e é
-- de propósito a MESMA função: mudar o que conta como receita tem que mudar os dois motores de
-- uma vez, senão o painel e o e-mail semanal passam a discordar sobre a mesma campanha).
create or replace function public._gui_ads_dinheiro_tipos()
returns text[] language sql immutable as $$ select array['booking']::text[] $$;

create or replace function public.ads_roi(p_secret text, p_email text, p_days integer default 30)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_tenant text := lower(trim(p_email)); v_desde timestamptz; v_out jsonb;
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350') then raise exception 'unauthorized' using errcode='28000'; end if;
  v_desde := now() - make_interval(days => greatest(1, least(365, coalesce(p_days,30))));

  return (
  with gasto as (
    select source, campaign, sum(spend_cents)::bigint as spend_cents,
           sum(clicks)::int as clicks, sum(impressions)::int as impressions,
           -- OS DIAS EM QUE A CAMPANHA REALMENTE GASTOU. É o denominador do orçamento/dia; usar
           -- a janela do seletor no lugar dele faz o motor mandar cortar dizendo que sobe.
           count(distinct day)::int as dias_com_gasto
      from ad_spend
     where client_email = v_tenant and day >= v_desde::date
     group by 1,2
  ),
  pessoas as (
    select a.source, a.campaign, a.phone_key
      from lead_attribution a
     where a.client_email = v_tenant and a.first_seen_at >= v_desde
  ),
  -- A PESSOA É UMA SÓ: casamos pela CHAVE CANÔNICA, nunca pelo texto do telefone. Uma tentativa
  -- anterior comparava "+1 929…" com "9295350191" como string — nunca casaria, e a receita de
  -- TODA campanha sairia zero com cara de "anúncio não deu retorno". Hoje a coluna phone_key tem
  -- CHECK que recusa formato não-canônico (db/lead_attribution_chave_canonica.sql).
  agend as (
    select p.source, p.campaign, p.phone_key, ap.id as appt_id,
           coalesce(s.price_cents, 0) as tabela_cents
      from pessoas p
      join biz_appointments ap
        on ap.client_email = v_tenant
       and ap.status <> 'cancelled'
       and lower(ap.span) >= v_desde
       and public._gui_phone_key(ap.customer_contact) = p.phone_key
      left join biz_services s on s.id = ap.service_id
  ),
  -- dinheiro DE VERDADE, resolvido uma única vez por pessoa (ver nota do double-count acima)
  dinheiro as (
    select c.phone_key, sum(e.amount_cents)::bigint as recebido_cents
      from crm_timeline_events e
      join crm_contacts c on c.id = e.contact_id and c.client_email = v_tenant
     where e.client_email = v_tenant
       and e.amount_cents is not null and e.amount_cents > 0
       and e.occurred_at >= v_desde
       and c.phone_key is not null
       -- SÓ O QUE É DINHEIRO. `amount_cents` aparece em evento que não é cobrança (orçamento
       -- enviado, estimativa); sem esta lista branca a receita de anúncio infla sozinha.
       and e.event_type = any(public._gui_ads_dinheiro_tipos())
     group by 1
  ),
  por_pessoa as (
    select a.source, a.campaign, a.phone_key,
           count(distinct a.appt_id)              as agendamentos,
           max(d.recebido_cents)                  as recebido_cents,
           sum(a.tabela_cents)::bigint            as tabela_cents
      from agend a
      left join dinheiro d on d.phone_key = a.phone_key
     group by 1,2,3
  ),
  valorada as (
    select source, campaign, agendamentos,
           case when recebido_cents is not null then recebido_cents
                when tabela_cents > 0           then tabela_cents
                else 0 end                                                as valor_cents,
           case when recebido_cents is not null then 'recebido'
                when tabela_cents > 0           then 'tabela'
                else 'sem_valor' end                                      as base
      from por_pessoa
  ),
  receita as (
    select source, campaign,
           sum(agendamentos)                                              as agendamentos,
           coalesce(sum(valor_cents),0)::bigint                           as receita_cents,
           count(*) filter (where base = 'recebido')                      as pessoas_recebido,
           count(*) filter (where base = 'tabela')                        as pessoas_tabela,
           coalesce(sum(agendamentos) filter (where base = 'sem_valor'),0) as agend_sem_valor
      from valorada group by 1,2
  ),
  leads_por_campanha as (
    select source, campaign, count(*) as leads from pessoas group by 1,2
  ),
  linhas as (
    select
      coalesce(g.source, l.source)     as canal,
      coalesce(g.campaign, l.campaign) as campanha,
      g.spend_cents, g.clicks, g.impressions,
      coalesce(g.dias_com_gasto, 0)    as dias_com_gasto,
      coalesce(l.leads, 0)             as leads,
      coalesce(r.agendamentos, 0)      as agendamentos,
      coalesce(r.receita_cents, 0)     as receita_cents,
      coalesce(r.pessoas_recebido, 0)  as pessoas_recebido,
      coalesce(r.pessoas_tabela, 0)    as pessoas_tabela,
      coalesce(r.agend_sem_valor, 0)   as agend_sem_valor
    from gasto g
    full outer join leads_por_campanha l on l.source = g.source and l.campaign = g.campaign
    left join receita r on r.source = coalesce(g.source, l.source) and r.campaign = coalesce(g.campaign, l.campaign)
  )
  select jsonb_build_object(
    'desde', v_desde,
    'campanhas', coalesce(jsonb_agg(jsonb_build_object(
      'canal', canal, 'campanha', campanha,
      'gasto_cents', spend_cents, 'cliques', clicks, 'impressoes', impressions,
      'dias_com_gasto', dias_com_gasto,
      'leads', leads, 'agendamentos', agendamentos, 'receita_cents', receita_cents,
      -- DE ONDE VEIO O NÚMERO. Sem isto, "receita" é uma palavra que às vezes quer dizer
      -- "entrou no caixa" e às vezes "é o que custaria na tabela" — e quem decide orçamento
      -- precisa saber a diferença.
      'receita_base', case when pessoas_recebido > 0 and pessoas_tabela > 0 then 'misto'
                           when pessoas_recebido > 0 then 'recebido'
                           when pessoas_tabela   > 0 then 'tabela'
                           else 'sem_valor' end,
      'pessoas_recebido', pessoas_recebido,
      'pessoas_tabela', pessoas_tabela,
      'agendamentos_sem_valor', agend_sem_valor,
      'custo_por_lead_cents', case when spend_cents is null or leads = 0 then null
                                   else round(spend_cents::numeric / leads) end,
      'custo_por_cliente_cents', case when spend_cents is null or agendamentos = 0 then null
                                      else round(spend_cents::numeric / agendamentos) end,
      'retorno', case when spend_cents is null or spend_cents = 0 then null
                      else round((receita_cents::numeric / spend_cents), 2) end,
      'porque_sem_retorno', case
          when spend_cents is null then 'gasto desta campanha nao foi lancado'
          when spend_cents = 0 then 'gasto lancado como zero'
          -- ESTE RAMO É NOVO e é o coração do conserto: antes, agendamento sem valor virava
          -- "nao gerou agendamento" — uma mentira que custava orçamento.
          when receita_cents = 0 and agend_sem_valor > 0 then
            'trouxe ' || agend_sem_valor || ' agendamento(s), mas sem valor registrado: '
            || 'cadastre o preco do servico ou registre a cobranca pela Gui para medir o retorno'
          when receita_cents = 0 and leads > 0 then 'trouxe lead mas ainda nao gerou agendamento'
          when leads = 0 then 'nenhum lead atribuido a esta campanha ainda'
          else null end
    ) order by coalesce(receita_cents,0) desc, coalesce(spend_cents,0) desc), '[]'::jsonb),
    'total_gasto_cents', (select coalesce(sum(spend_cents),0) from ad_spend where client_email=v_tenant and day>=v_desde::date),
    'total_leads', (select count(*) from lead_attribution where client_email=v_tenant and first_seen_at>=v_desde)
  ) from linhas);
end $function$;

revoke all on function public.ads_roi(text,text,integer) from anon;
