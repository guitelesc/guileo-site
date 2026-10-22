-- ENTRADA EM OPERAÇÃO POR CLIENTE — `live_desde`  (2026-09-28, aplicado por MCP no mesmo dia)
--
-- O DEFEITO: tudo na conta do Natura era teste NOSSO de pré-lançamento (4 agendamentos "TESTE QA /
-- Luis / Louise", leads com telefone 555, 62 ligações de prova) — e o painel mostrava com o selo
-- "LIVE — REAL DATA". O "melhor cliente" do spa era "Luis, 14 visitas".
--
-- A MARCAÇÃO: o perfil do cliente (client_integrations provider='profile') ganha `live_desde`.
-- As leituras do painel mostram só o que aconteceu dali em diante. NADA É APAGADO.
--   ligar:    select set_client_profile('<ingest>','<email>', jsonb_build_object('live_desde','2026-09-28T19:39:19Z'));
--   desligar: update client_integrations set tokens = tokens - 'live_desde' where client_email='<email>' and provider='profile';
-- Sem `live_desde` a função devolve NULL e todas as leituras ficam EXATAMENTE como eram.
--
-- LEITURAS COBERTAS: get_client_data (feed + events_total + identity.live_since), get_call_logs,
-- crm_list_contacts (pelo ÚLTIMO contato: quem era teste e voltar a ligar reaparece),
-- crm_leads_today, cx_summary, cx_drivers, cx_detractors.
-- NÃO COBERTAS — E O NATURA TEM TESTE NELAS (medido em 2026-09-28, corrigindo o que eu tinha
-- escrito aqui sem medir): 6 agendamentos, 3 negócios, 55 eventos de linha do tempo, 1 intenção de
-- agendamento. 37 funções leem essas tabelas sem o corte — 25 alimentam telas (agenda, negócios,
-- caixa de entrada, receita, Company OS, follow-ups) e 12 escolhem destinatários de automação
-- (lembrete, reativação, aniversário, pesquisa). Lista e plano no fim deste arquivo.
--
-- ⚠️ LIMITE CONHECIDO: a data esconde o ANTES. Teste feito DEPOIS dela aparece como dado real.
-- Depois do lançamento, teste se faz no tenant e2e-test@guileoai.com ou na linha de demonstração.
create or replace function public.tenant_live_desde(p_email text)
returns timestamptz language sql stable security definer set search_path to 'public' as $$
  select case when (tokens->>'live_desde') ~ '^\d{4}-\d{2}-\d{2}' then (tokens->>'live_desde')::timestamptz else null end
    from client_integrations where client_email = lower(trim(p_email)) and provider = 'profile' limit 1
$$;
revoke all on function public.tenant_live_desde(text) from public, anon, authenticated;
grant execute on function public.tenant_live_desde(text) to service_role;

-- get_client_data, get_call_logs, crm_list_contacts e crm_leads_today: a definição vigente está no
-- banco (pg_get_functiondef). Em cada uma o filtro é UMA condição:
--   and <coluna de data> >= coalesce(public.tenant_live_desde(<email>), '-infinity'::timestamptz)
-- A versão completa de get_client_data fica em db/get_client_data_com_setor.sql.

-- cx_summary / cx_drivers: leem `v_since`, calculada no DECLARE. O remendo ajusta ESSA variável.
-- (A 1ª tentativa ajustava `p_since` — compilou, rodou e não filtrava: criar ≠ executar.)
do $do$
declare r record; v_def text; v_novo text;
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
            where n.nspname='public' and p.proname in ('cx_summary','cx_drivers') loop
    v_def := pg_get_functiondef(r.oid);
    if position('tenant_live_desde' in v_def) > 0 then continue; end if;
    v_novo := regexp_replace(v_def, E'\nbegin\n',
      E'\nbegin\n  if public.tenant_live_desde(p_email) is not null then\n    v_since := greatest(v_since, public.tenant_live_desde(p_email));\n  end if;\n');
    if v_novo = v_def then raise exception 'não achei o begin de %', r.proname; end if;
    execute v_novo;
  end loop;
  select pg_get_functiondef(p.oid) into v_def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='cx_detractors';
  if position('tenant_live_desde' in v_def) = 0 then
    v_novo := replace(v_def, E'and s.occurred_at >= now() - interval ''30 days''',
      E'and s.occurred_at >= greatest(now() - interval ''30 days'', coalesce(public.tenant_live_desde(v_tenant), ''-infinity''::timestamptz))');
    if v_novo = v_def then raise exception 'não achei a janela do cx_detractors'; end if;
    execute v_novo;
  end if;
end $do$;


-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- FONTES VIVAS (aplicado em 2026-09-28, migração `vivo_fontes_por_tabela`) — INERTES: nada as usa.
-- Uma por tabela; devolvem só as linhas do cliente a partir de `live_desde`. Sem data → tudo.
-- Provado: 17 de 17 clientes sem data idênticos à tabela; Natura 6→0, 6→0, 3→0, 55→0, 274→0, 62→0.
-- `returns setof public.<tabela>` acompanha colunas novas (uma view congelaria as colunas).
-- ═══════════════════════════════════════════════════════════════════════════════════════════
do $do$
declare r record;
begin
  for r in select * from (values
      ('biz_appointments',    'c.created_at'),
      ('crm_contacts',        'coalesce(c.last_seen_at, c.created_at)'),
      ('crm_deals',           'c.created_at'),
      ('crm_timeline_events', 'c.occurred_at'),
      ('client_events',       'c.created_at'),
      ('call_logs',           'c.created_at'),
      ('booking_intents',     'c.created_at'),
      ('crm_invoices',        'c.created_at')
    ) as v(tab, col) loop
    execute format($f$
      create or replace function public.vivo_%1$s(p_email text)
      returns setof public.%1$s language sql stable as $body$
        select c.* from public.%1$s c
         where c.client_email = lower(trim(p_email))
           and coalesce(%2$s >= (select public.tenant_live_desde(p_email)), true)
      $body$;
      revoke all on function public.vivo_%1$s(text) from public, anon, authenticated;
      grant execute on function public.vivo_%1$s(text) to service_role;
    $f$, r.tab, r.col);
  end loop;
end $do$;

-- PENDENTE DE DECISÃO DO LUIS — trocar a fonte nas 37 leituras (`from <tabela>` → `from vivo_<tabela>(email)`).
-- NÃO aplicado: é reescrita em massa de funções compartilhadas por todos os clientes.
-- Telas (25): biz_list_appointments, crm_deals_list, crm_timeline, inbox_threads, inbox_thread,
--   _inbox_events, my_company_os, revenue_month, ops_board, call_outcome_truth, crm_ltv, crm_forecast,
--   crm_lead_sources, crm_leads_recent, crm_segment_count, churn_risk_scan, booking_intents_abandoned,
--   noshow_risk, contract_performance, client_events_since, returns_breakdown_window,
--   refund_total_window, ads_roi, crm_invoices_list, finance_overdue_list.
-- Automações (12): biz_dormant_customers, biz_due_reminders, biz_reminders_due, biz_rebook_due,
--   biz_review_due, churn_reengage_candidates, crm_birthday_contacts, crm_marketing_recipients,
--   crm_rebook_due, cx_survey_candidates, campaign_audience, slowday_candidates.
-- Já verificado nas 37: mesmo dono, sem sobrecarga, sem `delete from`, sem `for update`, sem SQL dinâmico.
-- NÃO entram (operação precisa enxergar tudo): biz_book, biz_availability, biz_reschedule,
--   crm_upsert_contact, crm_caller_context, customer_memory_get, spend_check, ingest_booking_event.
