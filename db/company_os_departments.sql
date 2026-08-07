-- ============================================================================
-- COMPANY OS · DEPARTAMENTOS — o rollup vivo dos 8 departamentos da PRÓPRIA Guileo.
-- Uma RPC lê o KPI real de cada departamento a partir de tabelas que JÁ EXISTEM no
-- cérebro unificado. Cross-tenant (visão-dona: o livro inteiro da Guileo), read-only.
--
-- HONESTIDADE: cada departamento é calculado dentro do SEU próprio BEGIN/EXCEPTION
-- + guarda to_regclass — se a fonte não existir nesta base, AQUELE card volta
-- {ready:false, kpi_value:"—", kpi_label:"aguardando dados"} sem derrubar os outros 7.
--
-- Fontes reais (verificadas em db/ + functions/):
--   💰 finance      → company_ledger (net do mês; mesma tabela do CompanyFinance)
--   🗂️ crm          → crm_contacts (contagem + LTV total)               [db/crm_spine.sql]
--   💼 sales        → crm_deals (pipeline aberto)                        [db/crm_phase2.sql]
--   📣 marketing    → crm_contacts.lead_source (leads + top canal)       [db/crm_spine.sql]
--   ⚙️ operations   → biz_appointments (agendamentos futuros)            [db/scheduling_engine.sql]
--   🚀 growth       → crm_contacts.churn_risk (em risco ≥55)             [db/churn_risk.sql]
--   🎧 support      → support_tickets (abertos)                          [db/support.sql]
--   📊 intelligence → agent_evals (score médio da última batelada 30d)   [db/agent_evals.sql]
--
-- Gate: literal INGEST (SECURITY DEFINER). RLS já ligado nas tabelas-fonte.
-- Idempotente (create or replace). grant execute to anon (só a RPC entra).
-- ============================================================================

create or replace function public.company_os_departments(p_secret text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_out    jsonb := '[]'::jsonb;
  v_n      bigint;
  v_n2     bigint;
  v_txt    text;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  -- 💰 FINANCE — net do mês corrente (receita − despesa) do razão da própria Guileo.
  begin
    if to_regclass('public.company_ledger') is null then raise exception 'no source'; end if;
    select coalesce(sum(case when kind = 'revenue' then amount_cents
                             when kind = 'expense' then -amount_cents else 0 end), 0)
      into v_n
      from public.company_ledger
     where created_at >= date_trunc('month', now());
    v_out := v_out || jsonb_build_object(
      'key','finance','label','Finance','icon','💰','accent','#3E9468',
      'kpi_value', (case when v_n < 0 then '−$' else '$' end) || to_char(abs(v_n)/100.0,'FM999G999G990D00'),
      'kpi_label','net do mês (receita − despesa)','ready', true);
  exception when others then
    v_out := v_out || jsonb_build_object('key','finance','label','Finance','icon','💰','accent','#3E9468',
      'kpi_value','—','kpi_label','aguardando dados','ready', false);
  end;

  -- 🗂️ CRM — contatos no spine + LTV total acumulado.
  begin
    if to_regclass('public.crm_contacts') is null then raise exception 'no source'; end if;
    select count(*), coalesce(sum(ltv_cents),0) into v_n, v_n2 from public.crm_contacts;
    v_out := v_out || jsonb_build_object(
      'key','crm','label','CRM','icon','🗂️','accent','#5B8DEF',
      'kpi_value', to_char(v_n,'FM999G999G990'),
      'kpi_label','contatos · $' || to_char(v_n2/100.0,'FM999G999G990') || ' LTV total','ready', true);
  exception when others then
    v_out := v_out || jsonb_build_object('key','crm','label','CRM','icon','🗂️','accent','#5B8DEF',
      'kpi_value','—','kpi_label','aguardando dados','ready', false);
  end;

  -- 💼 SALES — pipeline aberto (soma do valor dos deals status='open').
  begin
    if to_regclass('public.crm_deals') is null then raise exception 'no source'; end if;
    select count(*) filter (where status = 'open'),
           coalesce(sum(value_cents) filter (where status = 'open'),0)
      into v_n, v_n2 from public.crm_deals;
    v_out := v_out || jsonb_build_object(
      'key','sales','label','Sales','icon','💼','accent','#c8623c',
      'kpi_value','$' || to_char(v_n2/100.0,'FM999G999G990'),
      'kpi_label', v_n || ' deals abertos no pipeline','ready', true);
  exception when others then
    v_out := v_out || jsonb_build_object('key','sales','label','Sales','icon','💼','accent','#c8623c',
      'kpi_value','—','kpi_label','aguardando dados','ready', false);
  end;

  -- 📣 MARKETING — leads capturados + canal de topo (crm_contacts.lead_source).
  begin
    if to_regclass('public.crm_contacts') is null then raise exception 'no source'; end if;
    select count(*) into v_n from public.crm_contacts where lifecycle = 'lead';
    select lead_source into v_txt from public.crm_contacts
     where lead_source is not null and lead_source <> ''
     group by lead_source order by count(*) desc limit 1;
    v_out := v_out || jsonb_build_object(
      'key','marketing','label','Marketing','icon','📣','accent','#E0855F',
      'kpi_value', to_char(v_n,'FM999G999G990'),
      'kpi_label','leads · top canal: ' || coalesce(v_txt,'—'),'ready', true);
  exception when others then
    v_out := v_out || jsonb_build_object('key','marketing','label','Marketing','icon','📣','accent','#E0855F',
      'kpi_value','—','kpi_label','aguardando dados','ready', false);
  end;

  -- ⚙️ OPERATIONS — agendamentos futuros ainda ativos (não cancelados).
  begin
    if to_regclass('public.biz_appointments') is null then raise exception 'no source'; end if;
    select count(*) into v_n from public.biz_appointments
     where status <> 'cancelled' and lower(span) >= now();
    v_out := v_out || jsonb_build_object(
      'key','operations','label','Operations','icon','⚙️','accent','#6B7B8C',
      'kpi_value', to_char(v_n,'FM999G999G990'),
      'kpi_label','agendamentos futuros na agenda','ready', true);
  exception when others then
    v_out := v_out || jsonb_build_object('key','operations','label','Operations','icon','⚙️','accent','#6B7B8C',
      'kpi_value','—','kpi_label','aguardando dados','ready', false);
  end;

  -- 🚀 GROWTH — contatos em risco de churn (score persistido ≥55).
  begin
    if to_regclass('public.crm_contacts') is null then raise exception 'no source'; end if;
    select count(*) into v_n from public.crm_contacts
     where churn_risk >= 55 and coalesce(lifecycle,'') not in ('churned','lost','blocked');
    v_out := v_out || jsonb_build_object(
      'key','growth','label','Growth','icon','🚀','accent','#B8524A',
      'kpi_value', to_char(v_n,'FM999G999G990'),
      'kpi_label','clientes em risco (churn ≥55)','ready', true);
  exception when others then
    v_out := v_out || jsonb_build_object('key','growth','label','Growth','icon','🚀','accent','#B8524A',
      'kpi_value','—','kpi_label','aguardando dados','ready', false);
  end;

  -- 🎧 SUPPORT — tickets abertos na fila.
  begin
    if to_regclass('public.support_tickets') is null then raise exception 'no source'; end if;
    select count(*) into v_n from public.support_tickets
     where status in ('open','resolving','escalated');
    v_out := v_out || jsonb_build_object(
      'key','support','label','Support','icon','🎧','accent','#C99A3B',
      'kpi_value', to_char(v_n,'FM999G999G990'),
      'kpi_label','tickets abertos na fila','ready', true);
  exception when others then
    v_out := v_out || jsonb_build_object('key','support','label','Support','icon','🎧','accent','#C99A3B',
      'kpi_value','—','kpi_label','aguardando dados','ready', false);
  end;

  -- 📊 INTELLIGENCE — score médio dos agentes na última batelada (30d).
  begin
    if to_regclass('public.agent_evals') is null then raise exception 'no source'; end if;
    select round(avg(score))::int into v_n from public.agent_evals
     where run_at >= now() - interval '30 days';
    if v_n is null then raise exception 'no rows'; end if;
    v_out := v_out || jsonb_build_object(
      'key','intelligence','label','Intelligence','icon','📊','accent','#7E6BD6',
      'kpi_value', v_n || '/100',
      'kpi_label','score médio dos agentes (30d)','ready', true);
  exception when others then
    v_out := v_out || jsonb_build_object('key','intelligence','label','Intelligence','icon','📊','accent','#7E6BD6',
      'kpi_value','—','kpi_label','aguardando dados','ready', false);
  end;

  return v_out::json;
exception when others then
  return json_build_object('error', SQLERRM);
end $$;

grant execute on function public.company_os_departments(text) to anon;
