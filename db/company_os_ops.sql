-- ============================================================================
-- COMPANY OS · OPS — Sales e Support GANHAM AÇÃO (visão-dona cross-tenant, /admin).
-- O painel Company OS deixa de ser só KPI: Sales vira um pipeline VIVO (mover deal,
-- Gui dá follow-up) e Support reusa os RPCs de ticket que já existem (ver db/support.sql).
--
-- SEGURANÇA: tudo gated pelo literal INGEST (SECURITY DEFINER), só chamado pelo endpoint
-- /api/company-os (admin blitz_stats + sameOrigin). O move afeta APENAS o deal pontual e
-- loga no timeline do PRÓPRIO tenant do deal — sem vazamento cross-tenant. Idempotente.
-- ============================================================================

-- 💼 SALES — pipeline aberto de TODOS os tenants, agrupado por estágio + a lista de deals.
create or replace function public.company_sales_pipeline(p_secret text)
returns json language plpgsql security definer set search_path=public as $$
declare v_stages json; v_deals json;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode='28000'; end if;
  if to_regclass('public.crm_deals') is null then return json_build_object('ready', false); end if;

  select coalesce(json_agg(row_to_json(s) order by s.ord), '[]'::json) into v_stages from (
    select st.stage,
           st.ord,
           count(d.id)                     as count,
           coalesce(sum(d.value_cents),0)  as value_cents
    from (values ('inquiry',1),('quoted',2),('booked',3),('won',4),('lost',5)) st(stage,ord)
    left join crm_deals d on d.stage = st.stage and d.status='open'
    group by st.stage, st.ord
  ) s;

  select coalesce(json_agg(row_to_json(x) order by x.updated_at desc), '[]'::json) into v_deals from (
    select d.id, d.client_email as tenant, coalesce(nullif(d.title,''),'(sem título)') as title,
           d.value_cents, d.stage, d.status, d.updated_at,
           round(extract(epoch from (now()-d.updated_at))/86400.0)::int as days_stale,
           coalesce(nullif(c.full_name,''), c.phone, c.email, '—') as contact
    from crm_deals d
    left join crm_contacts c on c.id = d.contact_id
    where d.status='open'
    order by d.updated_at desc
    limit 120
  ) x;

  return json_build_object('ready', true, 'stages', v_stages, 'deals', v_deals);
exception when others then return json_build_object('error', SQLERRM); end $$;
grant execute on function public.company_sales_pipeline(text) to anon;

-- 💼 SALES — mover um deal de estágio (o "→" do board). Loga stage_change no timeline do tenant dono.
create or replace function public.company_deal_move(p_secret text, p_deal_id uuid, p_stage text)
returns json language plpgsql security definer set search_path=public as $$
declare v_tenant text; v_old text; v_new_status text;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode='28000'; end if;
  if p_stage not in ('inquiry','quoted','booked','won','lost') then raise exception 'invalid stage'; end if;
  select client_email, stage into v_tenant, v_old from crm_deals where id=p_deal_id;
  if v_tenant is null then raise exception 'deal not found'; end if;
  v_new_status := case when p_stage='won' then 'won' when p_stage='lost' then 'lost' else 'open' end;
  update crm_deals set stage=p_stage, status=v_new_status, updated_at=now() where id=p_deal_id;
  -- rastro no timeline do PRÓPRIO tenant do deal (contact_id herdado do deal)
  insert into crm_timeline_events(client_email, contact_id, event_type, channel, summary, payload)
    select v_tenant, contact_id, 'stage_change', 'company-os',
           'Pipeline: ' || v_old || ' → ' || p_stage, jsonb_build_object('deal_id', p_deal_id, 'from', v_old, 'to', p_stage)
    from crm_deals where id=p_deal_id;
  return json_build_object('ok', true, 'id', p_deal_id, 'tenant', v_tenant, 'stage', p_stage, 'status', v_new_status);
exception when others then return json_build_object('error', SQLERRM); end $$;
grant execute on function public.company_deal_move(text,uuid,text) to anon;

-- 💼 SALES — Gui dá follow-up num deal: devolve o contato pro endpoint mandar o email + loga o rastro.
create or replace function public.company_deal_followup(p_secret text, p_deal_id uuid)
returns json language plpgsql security definer set search_path=public as $$
declare v_tenant text; v_title text; v_name text; v_email text; v_phone text; v_cid uuid;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode='28000'; end if;
  select d.client_email, coalesce(nullif(d.title,''),'oportunidade'), d.contact_id,
         c.full_name, c.email, c.phone
    into v_tenant, v_title, v_cid, v_name, v_email, v_phone
    from crm_deals d left join crm_contacts c on c.id=d.contact_id where d.id=p_deal_id;
  if v_tenant is null then raise exception 'deal not found'; end if;
  insert into crm_timeline_events(client_email, contact_id, event_type, channel, summary, payload)
    values (v_tenant, v_cid, 'automation', 'company-os',
      'Gui follow-up no deal: ' || v_title, jsonb_build_object('deal_id', p_deal_id, 'kind', 'deal-followup'));
  return json_build_object('ok', true, 'tenant', v_tenant, 'title', v_title,
    'contact_name', coalesce(v_name,'there'), 'contact_email', v_email, 'contact_phone', v_phone);
exception when others then return json_build_object('error', SQLERRM); end $$;
grant execute on function public.company_deal_followup(text,uuid) to anon;

-- ============================================================================
-- COMPANY OS · CENTRO DE COMANDO — "o que precisa de atenção AGORA" + ação em Growth/Operations.
-- Nível 2026: o painel deixa de listar métrica e passa a dizer O QUE FAZER, com 1 clique.
-- Tudo INGEST-gated, cross-tenant (visão-dona), mutação sempre logada no tenant dono.
-- ============================================================================

-- 🧭 BRIEF — os actionables cruzando os departamentos (só leitura, seguro).
create or replace function public.company_os_brief(p_secret text)
returns json language plpgsql security definer set search_path=public as $$
declare v_stale_n bigint:=0; v_stale_v bigint:=0; v_tickets bigint:=0; v_churn bigint:=0; v_appts bigint:=0; v_leads bigint:=0;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode='28000'; end if;
  begin select count(*), coalesce(sum(value_cents),0) into v_stale_n, v_stale_v from crm_deals
        where status='open' and updated_at < now()-interval '5 days'; exception when others then null; end;
  begin select count(*) into v_tickets from support_tickets where status in ('open','resolving','escalated'); exception when others then null; end;
  begin select count(*) into v_churn from crm_contacts where churn_risk>=55 and coalesce(lifecycle,'') not in ('churned','lost','blocked'); exception when others then null; end;
  begin select count(*) into v_appts from biz_appointments where status<>'cancelled' and lower(span) between now() and now()+interval '24 hours'; exception when others then null; end;
  begin select count(*) into v_leads from crm_contacts where lifecycle='lead' and last_seen_at > now()-interval '2 days'; exception when others then null; end;
  return json_build_object('ready',true,
    'stale_deals', json_build_object('count',v_stale_n,'value_cents',v_stale_v),
    'open_tickets', v_tickets, 'churn_risk', v_churn, 'appts_24h', v_appts, 'new_leads_48h', v_leads);
exception when others then return json_build_object('error',SQLERRM); end $$;
grant execute on function public.company_os_brief(text) to anon;

-- 🚀 GROWTH — fila cross-tenant de clientes em risco COM email (a Gui reativa por email, real hoje).
create or replace function public.company_growth_queue(p_secret text, p_limit int default 40)
returns json language plpgsql security definer set search_path=public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode='28000'; end if;
  return coalesce((
    select json_agg(json_build_object(
      'contact_id', id, 'tenant', client_email, 'name', coalesce(nullif(full_name,''),email,'Cliente'),
      'email', lower(email), 'risk', churn_risk,
      'days_since', round(extract(epoch from (now()-last_seen_at))/86400.0)::int,
      'ltv', round(ltv_cents/100.0,2)
    ) order by churn_risk desc, ltv_cents desc)
    from crm_contacts
    where visit_count>=3 and churn_risk>=55 and email is not null and position('@' in email)>1
      and coalesce(lifecycle,'') not in ('churned','lost','blocked')
      and not exists (select 1 from client_events e where e.client_email=crm_contacts.client_email
        and e.type='winback' and lower(e.payload->>'contact')=lower(crm_contacts.email) and e.created_at>now()-interval '30 days')
    limit greatest(1, least(p_limit,80))
  ), '[]'::json);
exception when others then return json_build_object('error',SQLERRM); end $$;
grant execute on function public.company_growth_queue(text,int) to anon;

-- 🚀 GROWTH — Gui reativa 1 contato: devolve o email pro endpoint mandar + loga winback (fecha dedup).
create or replace function public.company_growth_reengage(p_secret text, p_contact_id uuid)
returns json language plpgsql security definer set search_path=public as $$
declare v_tenant text; v_name text; v_email text; v_risk int;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode='28000'; end if;
  select client_email, coalesce(nullif(full_name,''),email,'Cliente'), lower(email), churn_risk
    into v_tenant, v_name, v_email, v_risk from crm_contacts where id=p_contact_id;
  if v_tenant is null then raise exception 'contact not found'; end if;
  return json_build_object('ok',true,'tenant',v_tenant,'contact_name',v_name,'contact_email',v_email,'risk',v_risk);
exception when others then return json_build_object('error',SQLERRM); end $$;
grant execute on function public.company_growth_reengage(text,uuid) to anon;

-- ⚙️ OPERATIONS — agendamentos próximos (24-48h) cross-tenant com o contato.
create or replace function public.company_ops_upcoming(p_secret text, p_hours int default 48, p_limit int default 60)
returns json language plpgsql security definer set search_path=public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode='28000'; end if;
  if to_regclass('public.biz_appointments') is null then return json_build_object('ready',false); end if;
  return json_build_object('ready',true,'appointments', coalesce((
    select json_agg(json_build_object(
      'id', a.id, 'tenant', a.client_email, 'customer', coalesce(nullif(a.customer_name,''),'—'),
      'contact', a.customer_contact, 'when', lower(a.span),
      'hours_until', round(extract(epoch from (lower(a.span)-now()))/3600.0,1)
    ) order by lower(a.span) asc)
    from biz_appointments a
    where a.status<>'cancelled' and lower(a.span) between now() and now()+(p_hours||' hours')::interval
    limit greatest(1, least(p_limit,120))
  ), '[]'::json));
exception when others then return json_build_object('error',SQLERRM); end $$;
grant execute on function public.company_ops_upcoming(text,int,int) to anon;

-- ⚙️ OPERATIONS — Gui lembra 1 agendamento: devolve contato+quando pro endpoint mandar o email.
create or replace function public.company_ops_remind(p_secret text, p_appt_id uuid)
returns json language plpgsql security definer set search_path=public as $$
declare v_tenant text; v_cust text; v_contact text; v_when timestamptz;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode='28000'; end if;
  select client_email, coalesce(nullif(customer_name,''),'there'), customer_contact, lower(span)
    into v_tenant, v_cust, v_contact, v_when from biz_appointments where id=p_appt_id;
  if v_tenant is null then raise exception 'appointment not found'; end if;
  return json_build_object('ok',true,'tenant',v_tenant,'customer',v_cust,'contact',v_contact,'when',v_when);
exception when others then return json_build_object('error',SQLERRM); end $$;
grant execute on function public.company_ops_remind(text,uuid) to anon;

-- ============================================================================
-- COMPANY OS · Marketing + CRM ganham AÇÃO (fecha os 8 deptos). INGEST-gated, email-only.
-- Intelligence NÃO tem RPC aqui — reusa /api/agent-eval (QualityPanel) direto na UI.
-- ============================================================================

-- 📣 MARKETING — leads recentes cross-tenant COM email, ainda não nutridos em 14d.
create or replace function public.company_marketing_leads(p_secret text, p_limit int default 40)
returns json language plpgsql security definer set search_path=public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode='28000'; end if;
  return coalesce((
    select json_agg(json_build_object(
      'contact_id', id, 'tenant', client_email, 'name', coalesce(nullif(full_name,''),email,'Lead'),
      'email', lower(email), 'source', coalesce(nullif(lead_source,''),'—'),
      'days_old', round(extract(epoch from (now()-first_seen_at))/86400.0)::int
    ) order by first_seen_at desc)
    from crm_contacts
    where lifecycle='lead' and email is not null and position('@' in email)>1
      and not exists (select 1 from client_events e where e.client_email=crm_contacts.client_email
        and e.type='nurture' and lower(e.payload->>'contact')=lower(crm_contacts.email) and e.created_at>now()-interval '14 days')
    limit greatest(1, least(p_limit,80))
  ), '[]'::json);
exception when others then return json_build_object('error',SQLERRM); end $$;
grant execute on function public.company_marketing_leads(text,int) to anon;

-- 📣 MARKETING — Gui nutre 1 lead: devolve contato pro endpoint mandar proposalEmail.
create or replace function public.company_marketing_nurture(p_secret text, p_contact_id uuid)
returns json language plpgsql security definer set search_path=public as $$
declare v_tenant text; v_name text; v_email text;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode='28000'; end if;
  select client_email, coalesce(nullif(full_name,''),email,'Lead'), lower(email) into v_tenant, v_name, v_email from crm_contacts where id=p_contact_id;
  if v_tenant is null then raise exception 'lead not found'; end if;
  return json_build_object('ok',true,'tenant',v_tenant,'contact_name',v_name,'contact_email',v_email);
exception when others then return json_build_object('error',SQLERRM); end $$;
grant execute on function public.company_marketing_nurture(text,uuid) to anon;

-- 🗂️ CRM — VIPs cross-tenant: maior LTV, saudáveis (não em risco), COM email, não agradecidos em 60d.
create or replace function public.company_crm_vips(p_secret text, p_limit int default 30)
returns json language plpgsql security definer set search_path=public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode='28000'; end if;
  return coalesce((
    select json_agg(json_build_object(
      'contact_id', id, 'tenant', client_email, 'name', coalesce(nullif(full_name,''),email,'Cliente'),
      'email', lower(email), 'ltv', round(ltv_cents/100.0,2), 'visits', visit_count, 'lifecycle', lifecycle
    ) order by ltv_cents desc)
    from crm_contacts
    where ltv_cents>0 and visit_count>=3 and coalesce(churn_risk,0)<55
      and email is not null and position('@' in email)>1
      and coalesce(lifecycle,'') not in ('churned','lost','blocked')
      and not exists (select 1 from client_events e where e.client_email=crm_contacts.client_email
        and e.type='loyalty' and lower(e.payload->>'contact')=lower(crm_contacts.email) and e.created_at>now()-interval '60 days')
    limit greatest(1, least(p_limit,60))
  ), '[]'::json);
exception when others then return json_build_object('error',SQLERRM); end $$;
grant execute on function public.company_crm_vips(text,int) to anon;

-- 🗂️ CRM — Gui agradece 1 VIP: devolve contato pro endpoint mandar loyaltyMilestoneEmail.
create or replace function public.company_crm_thank(p_secret text, p_contact_id uuid)
returns json language plpgsql security definer set search_path=public as $$
declare v_tenant text; v_name text; v_email text; v_visits int;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode='28000'; end if;
  select client_email, coalesce(nullif(full_name,''),email,'Cliente'), lower(email), visit_count into v_tenant, v_name, v_email, v_visits from crm_contacts where id=p_contact_id;
  if v_tenant is null then raise exception 'contact not found'; end if;
  return json_build_object('ok',true,'tenant',v_tenant,'contact_name',v_name,'contact_email',v_email,'visits',v_visits);
exception when others then return json_build_object('error',SQLERRM); end $$;
grant execute on function public.company_crm_thank(text,uuid) to anon;

-- ============================================================================
-- COMPANY OS · AUTO-BRIEF — o "sua empresa se operou hoje" do DONO (cron diário).
-- Junta o brief (o que precisa de atenção) + o que a Gui fez sozinha nas últimas 24h
-- (winback/nurture/loyalty logados pelos motores). INGEST-gated, só leitura, cross-tenant.
-- ============================================================================
create or replace function public.company_os_autobrief(p_secret text)
returns json language plpgsql security definer set search_path=public as $$
declare v_stale_n bigint:=0; v_stale_v bigint:=0; v_tickets bigint:=0; v_churn bigint:=0; v_appts bigint:=0; v_leads bigint:=0;
        v_react bigint:=0; v_nurt bigint:=0; v_thank bigint:=0; v_book bigint:=0; v_since timestamptz := now()-interval '24 hours';
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode='28000'; end if;
  -- precisa de você (needs)
  begin select count(*), coalesce(sum(value_cents),0) into v_stale_n, v_stale_v from crm_deals where status='open' and updated_at < now()-interval '5 days'; exception when others then null; end;
  begin select count(*) into v_tickets from support_tickets where status in ('open','resolving','escalated'); exception when others then null; end;
  begin select count(*) into v_churn from crm_contacts where churn_risk>=55 and coalesce(lifecycle,'') not in ('churned','lost','blocked'); exception when others then null; end;
  begin select count(*) into v_appts from biz_appointments where status<>'cancelled' and lower(span) between now() and now()+interval '24 hours'; exception when others then null; end;
  begin select count(*) into v_leads from crm_contacts where lifecycle='lead' and last_seen_at > now()-interval '2 days'; exception when others then null; end;
  -- o que a Gui fez sozinha (did, últimas 24h)
  begin select count(*) into v_react from client_events where type='winback' and created_at>=v_since; exception when others then null; end;
  begin select count(*) into v_nurt  from client_events where type='nurture' and created_at>=v_since; exception when others then null; end;
  begin select count(*) into v_thank from client_events where type='loyalty' and created_at>=v_since; exception when others then null; end;
  begin select count(*) into v_book  from biz_appointments where created_at>=v_since; exception when others then null; end;
  return json_build_object('ready',true,
    'needs', json_build_object('stale_deals_count',v_stale_n,'stale_deals_value_cents',v_stale_v,'open_tickets',v_tickets,'churn_risk',v_churn,'appts_24h',v_appts,'new_leads_48h',v_leads),
    'did', json_build_object('reactivated',v_react,'nurtured',v_nurt,'thanked',v_thank,'booked',v_book));
exception when others then return json_build_object('error',SQLERRM); end $$;
grant execute on function public.company_os_autobrief(text) to anon;

-- ============================================================================
-- COMPANY OS · PRODUTO — o cockpit dos 8 departamentos do PRÓPRIO CLIENTE (/portal).
-- Mesma cara do painel-dono, mas TUDO escopado por client_email (o cliente só vê o dele).
-- Gate: literal INGEST (o endpoint /api/my-company-os valida email↔key com get_client_data ANTES).
-- ============================================================================
create or replace function public.my_company_os(p_secret text, p_email text)
returns json language plpgsql security definer set search_path=public as $$
declare v_email text := lower(trim(coalesce(p_email,''))); v_out jsonb := '[]'::jsonb; v_n bigint; v_n2 bigint; v_amt numeric; v_txt text;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode='28000'; end if;

  -- 💰 finance — receita coletada nos últimos 30d (client_events.amount em dólares, type payment/order/booking)
  begin
    select coalesce(sum(amount),0) into v_amt from client_events where client_email=v_email and type in ('payment','order','booking') and created_at>now()-interval '30 days';
    v_out := v_out || jsonb_build_object('key','finance','label','Finanças','icon','💰','accent','#3E9468','kpi_value','$'||to_char(round(v_amt,2),'FM999G999G990D00'),'kpi_label','receita coletada (30d)','ready',true);
  exception when others then v_out := v_out || jsonb_build_object('key','finance','label','Finanças','icon','💰','accent','#3E9468','kpi_value','—','kpi_label','aguardando dados','ready',false); end;
  -- 🗂️ crm
  begin
    select count(*), coalesce(sum(ltv_cents),0) into v_n, v_n2 from crm_contacts where client_email=v_email;
    v_out := v_out || jsonb_build_object('key','crm','label','Clientes','icon','🗂️','accent','#5B8DEF','kpi_value',to_char(v_n,'FM999G999G990'),'kpi_label','contatos · $'||to_char(v_n2/100.0,'FM999G999G990')||' LTV','ready',true);
  exception when others then v_out := v_out || jsonb_build_object('key','crm','label','Clientes','icon','🗂️','accent','#5B8DEF','kpi_value','—','kpi_label','aguardando dados','ready',false); end;
  -- 💼 sales
  begin
    select count(*) filter (where status='open'), coalesce(sum(value_cents) filter (where status='open'),0) into v_n, v_n2 from crm_deals where client_email=v_email;
    v_out := v_out || jsonb_build_object('key','sales','label','Vendas','icon','💼','accent','#c8623c','kpi_value','$'||to_char(v_n2/100.0,'FM999G999G990'),'kpi_label',v_n||' no pipeline','ready',true);
  exception when others then v_out := v_out || jsonb_build_object('key','sales','label','Vendas','icon','💼','accent','#c8623c','kpi_value','—','kpi_label','aguardando dados','ready',false); end;
  -- 📣 marketing
  begin
    select count(*) into v_n from crm_contacts where client_email=v_email and lifecycle='lead';
    select lead_source into v_txt from crm_contacts where client_email=v_email and lead_source is not null and lead_source<>'' group by lead_source order by count(*) desc limit 1;
    v_out := v_out || jsonb_build_object('key','marketing','label','Marketing','icon','📣','accent','#E0855F','kpi_value',to_char(v_n,'FM999G999G990'),'kpi_label','leads · '||coalesce(v_txt,'—'),'ready',true);
  exception when others then v_out := v_out || jsonb_build_object('key','marketing','label','Marketing','icon','📣','accent','#E0855F','kpi_value','—','kpi_label','aguardando dados','ready',false); end;
  -- ⚙️ operations
  begin
    select count(*) into v_n from biz_appointments where client_email=v_email and status<>'cancelled' and lower(span)>=now();
    v_out := v_out || jsonb_build_object('key','operations','label','Operações','icon','⚙️','accent','#6B7B8C','kpi_value',to_char(v_n,'FM999G999G990'),'kpi_label','agendamentos futuros','ready',true);
  exception when others then v_out := v_out || jsonb_build_object('key','operations','label','Operações','icon','⚙️','accent','#6B7B8C','kpi_value','—','kpi_label','aguardando dados','ready',false); end;
  -- 🚀 growth
  begin
    select count(*) into v_n from crm_contacts where client_email=v_email and churn_risk>=55 and coalesce(lifecycle,'') not in ('churned','lost','blocked');
    v_out := v_out || jsonb_build_object('key','growth','label','Crescimento','icon','🚀','accent','#B8524A','kpi_value',to_char(v_n,'FM999G999G990'),'kpi_label','clientes em risco','ready',true);
  exception when others then v_out := v_out || jsonb_build_object('key','growth','label','Crescimento','icon','🚀','accent','#B8524A','kpi_value','—','kpi_label','aguardando dados','ready',false); end;
  -- 🎧 support
  begin
    select count(*) into v_n from support_tickets where client_email=v_email and status in ('open','resolving','escalated');
    v_out := v_out || jsonb_build_object('key','support','label','Suporte','icon','🎧','accent','#C99A3B','kpi_value',to_char(v_n,'FM999G999G990'),'kpi_label','tickets abertos','ready',true);
  exception when others then v_out := v_out || jsonb_build_object('key','support','label','Suporte','icon','🎧','accent','#C99A3B','kpi_value','—','kpi_label','aguardando dados','ready',false); end;
  -- 📊 intelligence — atendimentos da Gui nos últimos 30d (sinal de atividade real do cérebro)
  begin
    select count(*) into v_n from client_events where client_email=v_email and created_at>now()-interval '30 days';
    v_out := v_out || jsonb_build_object('key','intelligence','label','Inteligência','icon','📊','accent','#7E6BD6','kpi_value',to_char(v_n,'FM999G999G990'),'kpi_label','ações da Gui (30d)','ready',true);
  exception when others then v_out := v_out || jsonb_build_object('key','intelligence','label','Inteligência','icon','📊','accent','#7E6BD6','kpi_value','—','kpi_label','aguardando dados','ready',false); end;

  return v_out::json;
exception when others then return json_build_object('error',SQLERRM); end $$;
grant execute on function public.my_company_os(text,text) to anon;
