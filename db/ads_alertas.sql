-- ═════════════════════════════════════════════════════════════════════════════════════════════
-- ads_alertas — O VIGIA. A varredura que o cron de segunda transforma em e-mail para o cliente.
--
-- ── POR QUE ESTE ARQUIVO NASCEU EM 2026-08-11 ────────────────────────────────────────────────
-- Ele não existia. A função estava VIVA em produção e não tinha uma linha no repositório: quem
-- fosse revisar a regra que manda "pausar a campanha" no e-mail semanal do cliente não tinha
-- onde ler. Motor sem arquivo é motor que ninguém audita — e este decide dinheiro de anúncio.
--
-- ── O DEFEITO QUE ELE CONSERTA (mesma data) ──────────────────────────────────────────────────
-- A v1 media receita SÓ pelo preço de tabela do serviço (`biz_services.price_cents`) — a mesma
-- cegueira que o `ads_roi` já tinha corrigido em db/ads_roi_receita_real.sql e que o vigia nunca
-- recebeu. Duas verdades sobre a MESMA campanha, e a que ninguém abre é a que sai por e-mail.
--
-- Cenário provado no tenant sim@guileoai.com (campanha `prova-a1-sem-preco`):
--   gasto $400 · 5 leads · 5 agendamentos · serviço sem preço cadastrado, cobrança fora da Gui
--   v1 →  gravidade ALTA, "revisar publico/palavra-chave ou PAUSAR; hoje sai mais do que entra"
--   v2 →  gravidade 'medir', "trouxe 5 agendamento(s) sem valor registrado: cadastre o preco…"
-- Ou seja: o e-mail automático mandava pausar a campanha que trouxe cinco clientes. Não dava
-- erro — dava um alarme bem escrito, com número plausível, em cima de uma medição cega.
--
-- ── AS REGRAS ────────────────────────────────────────────────────────────────────────────────
-- 1. RECEITA COM PROCEDÊNCIA, igual ao ads_roi: 'recebido' (dinheiro lançado contra a pessoa) >
--    'tabela' (preço de tabela, ESTIMATIVA) > 'sem_valor'. Resolvido POR PESSOA, nunca por
--    agendamento — quem marcou duas vezes contaria a receita em dobro.
-- 2. CEGO NÃO É RUIM. `agend_sem_valor > 0 and receita = 0` sai como gravidade 'medir' e é
--    testado ANTES do ramo de prejuízo. Zero por falta de medição não é zero por falta de
--    resultado, e só uma dessas duas coisas justifica pausar campanha.
-- 3. ALARME EXIGE AMOSTRA: sem gasto lançado não há alerta; "está saindo mais do que entra"
--    exige ≥5 leads. Alarme falso queima a confiança em todos os outros.
-- 4. 'medir' NÃO VAI NO E-MAIL do cliente (functions/api/ads-vigia.js separa) — o corpo só tem
--    dois blocos, "Precisa de atenção" e "Vale investir mais", e enfiar "não consigo medir"
--    debaixo de um verde "vale investir mais" seria trocar uma mentira por outra. Ele aparece
--    no cockpit, onde tem lugar próprio.
--
-- Idempotente. `_gui_ads_dinheiro_tipos()` é a mesma lista branca de tipos de evento que o
-- ads_roi usa — mudar a receita dos dois motores é mudar UMA função.
-- ═════════════════════════════════════════════════════════════════════════════════════════════

-- A lista branca de eventos que contam como DINHEIRO. Fora daqui, `amount_cents` num evento de
-- timeline é outra coisa (orçamento, estimativa, nota) e não pode virar receita de anúncio.
create or replace function public._gui_ads_dinheiro_tipos()
returns text[] language sql immutable as $$ select array['booking']::text[] $$;

create or replace function public.ads_alertas(p_secret text, p_days integer default 14)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_desde timestamptz; v_out jsonb;
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350') then raise exception 'unauthorized' using errcode='28000'; end if;
  v_desde := now() - make_interval(days => greatest(3, least(90, coalesce(p_days,14))));

  with gasto as (
    select client_email, source, campaign, sum(spend_cents)::bigint spend_cents, sum(clicks)::int clicks
      from ad_spend where day >= v_desde::date group by 1,2,3
  ),
  pessoas as (
    select client_email, source, campaign, phone_key
      from lead_attribution where first_seen_at >= v_desde
  ),
  leads as (select client_email, source, campaign, count(*) n from pessoas group by 1,2,3),
  agend as (
    select p.client_email, p.source, p.campaign, p.phone_key, ap.id as appt_id,
           coalesce(s.price_cents,0) as tabela_cents
      from pessoas p
      join biz_appointments ap
        on ap.client_email = p.client_email and ap.status <> 'cancelled'
       and lower(ap.span) >= v_desde
       and public._gui_phone_key(ap.customer_contact) = p.phone_key
      left join biz_services s on s.id = ap.service_id
  ),
  dinheiro as (
    select c.client_email, c.phone_key, sum(e.amount_cents)::bigint recebido_cents
      from crm_timeline_events e
      join crm_contacts c on c.id = e.contact_id and c.client_email = e.client_email
     where e.amount_cents is not null and e.amount_cents > 0
       and e.occurred_at >= v_desde
       and c.phone_key is not null
       and e.event_type = any(public._gui_ads_dinheiro_tipos())
     group by 1,2
  ),
  por_pessoa as (
    select a.client_email, a.source, a.campaign, a.phone_key,
           count(distinct a.appt_id) agendamentos,
           max(d.recebido_cents) recebido_cents,
           sum(a.tabela_cents)::bigint tabela_cents
      from agend a
      left join dinheiro d on d.client_email = a.client_email and d.phone_key = a.phone_key
     group by 1,2,3,4
  ),
  valorada as (
    select client_email, source, campaign, agendamentos,
           case when recebido_cents is not null then recebido_cents
                when tabela_cents > 0 then tabela_cents else 0 end as valor_cents,
           case when recebido_cents is not null then 'recebido'
                when tabela_cents > 0 then 'tabela' else 'sem_valor' end as base
      from por_pessoa
  ),
  receita as (
    select client_email, source, campaign,
           sum(agendamentos) agendamentos,
           coalesce(sum(valor_cents),0)::bigint receita_cents,
           count(*) filter (where base='recebido') pessoas_recebido,
           count(*) filter (where base='tabela')   pessoas_tabela,
           coalesce(sum(agendamentos) filter (where base='sem_valor'),0) agend_sem_valor
      from valorada group by 1,2,3
  ),
  linhas as (
    select g.client_email, g.source, g.campaign, g.spend_cents, g.clicks,
           coalesce(l.n,0) leads, coalesce(r.agendamentos,0) agendamentos,
           coalesce(r.receita_cents,0) receita_cents,
           coalesce(r.pessoas_recebido,0) pessoas_recebido,
           coalesce(r.pessoas_tabela,0) pessoas_tabela,
           coalesce(r.agend_sem_valor,0) agend_sem_valor
      from gasto g
      left join leads l on l.client_email=g.client_email and l.source=g.source and l.campaign=g.campaign
      left join receita r on r.client_email=g.client_email and r.source=g.source and r.campaign=g.campaign
     where g.spend_cents > 0                       -- sem gasto nao ha alerta: nao da para saber
  )
  select coalesce(jsonb_agg(x order by x->>'gravidade' desc, (x->>'gasto_cents')::bigint desc), '[]'::jsonb)
  into v_out
  from (
    select jsonb_build_object(
      'cliente', client_email, 'canal', source, 'campanha', campaign,
      'gasto_cents', spend_cents, 'cliques', clicks, 'leads', leads,
      'agendamentos', agendamentos, 'receita_cents', receita_cents,
      'agendamentos_sem_valor', agend_sem_valor,
      -- A PROCEDÊNCIA VIAJA JUNTO: quem decide orçamento precisa saber se o número é dinheiro
      -- que entrou ou preço de tabela. Sem o rótulo, estimativa vira fato no caminho.
      'receita_base', case when pessoas_recebido > 0 and pessoas_tabela > 0 then 'misto'
                           when pessoas_recebido > 0 then 'recebido'
                           when pessoas_tabela   > 0 then 'tabela'
                           else 'sem_valor' end,
      'retorno', round(receita_cents::numeric / spend_cents, 2),
      'motivo', motivo, 'gravidade', gravidade, 'o_que_fazer', o_que_fazer
    ) x
    from (
      select *,
        case
          -- DINHEIRO SAINDO E NINGUÉM DEIXANDO CONTATO: o tráfego chegou, então o anúncio
          -- funciona — quem não funciona é a página. O caso mais caro e o mais consertável.
          when leads = 0 and clicks >= 80 then 'trafego_sem_lead'
          -- CEGO NÃO É RUIM — e vem ANTES do ramo de prejuízo de propósito.
          when agend_sem_valor > 0 and receita_cents = 0 then 'sem_medicao'
          when leads >= 5 and receita_cents < spend_cents then 'gastando_mais_do_que_traz'
          -- Oportunidade vai junto do problema: só avisar de prejuízo deixa dinheiro na mesa.
          when leads >= 5 and receita_cents >= spend_cents * 3 then 'vale_investir_mais'
          else null
        end as motivo,
        case
          when leads = 0 and clicks >= 80 then 'alta'
          when agend_sem_valor > 0 and receita_cents = 0 then 'medir'
          when leads >= 5 and receita_cents < spend_cents then 'alta'
          when leads >= 5 and receita_cents >= spend_cents * 3 then 'oportunidade'
          else null
        end as gravidade,
        case
          when leads = 0 and clicks >= 80 then 'a pagina de destino nao esta convertendo — revisar oferta/formulario antes de mexer no anuncio'
          when agend_sem_valor > 0 and receita_cents = 0 then
            'trouxe ' || agend_sem_valor || ' agendamento(s) sem valor registrado: cadastre o preco do servico ou registre a cobranca pela Gui — sem isso nao da para dizer se esta campanha paga'
          when leads >= 5 and receita_cents < spend_cents then 'revisar publico/palavra-chave ou pausar; hoje sai mais do que entra'
          when leads >= 5 and receita_cents >= spend_cents * 3 then 'aumentar orcamento — esta campanha esta pagando bem'
          else null
        end as o_que_fazer
      from linhas
    ) y where motivo is not null
  ) z;

  return jsonb_build_object('desde', v_desde, 'alertas', v_out);
end $function$;

-- Varredura ENTRE CLIENTES: nunca para o anon. Só o servidor (service_role) chama.
revoke all on function public.ads_alertas(text,integer) from anon, public;
