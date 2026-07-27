-- ============================================================================
-- CHURN RISK — detecta cliente fiel prestes a sumir e devolve a ação certa.
-- Roda sobre o cérebro unificado (crm_contacts). Lê /api/growth-intel action:"churn".
--
-- CONFIANÇA ANTES DE GRITAR: só pontua quem tem PADRÃO real — >=3 visitas (>=2 intervalos)
-- E >=14 dias de histórico. Sem isso, cliente novo (2 visitas coladas) viraria falso-positivo
-- (cadência ~0 → qualquer gap = risco 100). Um modelo que só fala quando tem base vale mais
-- que um que chora lobo. Cadência = tenure/(visitas-1), com piso de 7 dias.
--   risco 0-100 = (dias desde a última visita) / (cadência habitual) * 35, capado em 100.
--   ação sugerida: call (>=80) · sms (>=55) · watch (<55).
--
-- Gate: literal INGEST (SECURITY DEFINER), RLS já ligado em crm_contacts. Idempotente.
-- ============================================================================

create or replace function public.churn_risk_scan(p_secret text, p_email text, p_limit int default 25)
returns json language plpgsql security definer set search_path=public as $$
declare v_tenant text := lower(trim(coalesce(p_email,'')));
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode='28000'; end if;

  -- pontua só quem tem histórico confiável
  update crm_contacts c set churn_risk = sub.score, updated_at = now()
  from (
    select id,
      least(100, greatest(0, round(
        ( extract(epoch from (now()-last_seen_at))/86400.0 )
        / greatest( extract(epoch from (last_seen_at-first_seen_at))/86400.0 / (visit_count-1), 7 )
        * 35
      )))::int as score
    from crm_contacts
    where client_email=v_tenant and visit_count>=3 and last_seen_at is not null and first_seen_at is not null
      and extract(epoch from (last_seen_at-first_seen_at))/86400.0 >= 14
      and coalesce(lifecycle,'') not in ('churned','lost','blocked')
  ) sub where c.id=sub.id;

  -- zera o risco de quem não tem base confiável (evita score velho preso no perfil)
  update crm_contacts set churn_risk=0
  where client_email=v_tenant and (visit_count<3 or first_seen_at is null or last_seen_at is null
    or extract(epoch from (last_seen_at-first_seen_at))/86400.0 < 14);

  return coalesce((
    select json_agg(json_build_object(
      'name', coalesce(nullif(full_name,''),phone,email,'Cliente'),
      'phone',phone,'contact_email',email,'risk',churn_risk,
      'days_since_visit', round(extract(epoch from (now()-last_seen_at))/86400.0)::int,
      'usual_cadence_days', round(extract(epoch from (last_seen_at-first_seen_at))/86400.0/(visit_count-1))::int,
      'visits',visit_count,'ltv',round(ltv_cents/100.0,2),
      'suggested_action', case when churn_risk>=80 then 'call' when churn_risk>=55 then 'sms' else 'watch' end
    ) order by churn_risk desc, ltv_cents desc)
    from crm_contacts
    where client_email=v_tenant and visit_count>=3 and churn_risk>=50
      and coalesce(lifecycle,'') not in ('churned','lost','blocked')
    limit greatest(1, least(p_limit,100))
  ), '[]'::json);
exception when others then return json_build_object('error',SQLERRM); end $$;

grant execute on function public.churn_risk_scan(text,text,int) to anon;

-- ── Autonomia: candidatos de reativação por EMAIL (o proactive.js manda a Gui reativar sozinha) ──
-- Refresca os scores do tenant e devolve quem: risco>=55, TEM email válido, e NÃO foi reativado
-- nos últimos 30d (dedup por client_events type='winback' + payload->>'contact'=email). Email-only,
-- TCPA-safe (nunca auto-disca — igual proactive). O proactive envia o reengageEmail e loga o winback
-- (que fecha o dedup da próxima varredura). Phone-only fica pro cockpit 1-clique / SMS quando A2P ligar.
create or replace function public.churn_reengage_candidates(p_secret text, p_email text, p_limit int default 15)
returns json language plpgsql security definer set search_path=public as $$
declare v_tenant text := lower(trim(coalesce(p_email,'')));
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode='28000'; end if;
  -- refresca os scores (mesma regra confiante do scan)
  perform public.churn_risk_scan('glo_ing_7f3da9c2b4e8', v_tenant, 100);
  return coalesce((
    select json_agg(json_build_object(
      'name', coalesce(nullif(full_name,''),email,'Cliente'),
      'email', lower(email), 'risk', churn_risk,
      'suggested_action', case when churn_risk>=80 then 'call' when churn_risk>=55 then 'sms' else 'watch' end
    ) order by churn_risk desc, ltv_cents desc)
    from crm_contacts c
    where c.client_email=v_tenant and c.visit_count>=3 and c.churn_risk>=55
      and c.email is not null and position('@' in c.email)>1
      and coalesce(c.lifecycle,'') not in ('churned','lost','blocked')
      and not exists (
        select 1 from client_events e
        where e.client_email=v_tenant and e.type='winback'
          and lower(e.payload->>'contact')=lower(c.email)
          and e.created_at > now() - interval '30 days'
      )
    limit greatest(1, least(p_limit,50))
  ), '[]'::json);
exception when others then return json_build_object('error',SQLERRM); end $$;
grant execute on function public.churn_reengage_candidates(text,text,int) to anon;
