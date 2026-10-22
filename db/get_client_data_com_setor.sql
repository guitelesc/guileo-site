-- A CENTRAL NÃO SABIA O RAMO DO CLIENTE (2026-09-28, aplicado por MCP no mesmo dia)
-- Quem chegava pelo link de acesso pulava o assistente (certo: já é cliente) — e o assistente era
-- o ÚNICO lugar que definia o ramo. Dona de spa abria o painel com menu de RESTAURANTE.
-- O ramo já existia no perfil (client_integrations provider='profile') e no cadastro; só não
-- viajava no feed. ADITIVO: acrescenta `sector` em `identity`. O texto é livre ("hair salon",
-- "dental clinic"…) — quem traduz para um ramo da Central é src/portal/setor.js.
--
-- A JANELA DE 200 EVENTOS ERA INVISÍVEL (2026-09-28, migration `get_client_data_events_total`)
-- O feed devolve só os 200 eventos mais recentes e NADA dizia isso. A Central somava KPI em cima
-- da janela como se fosse o histórico inteiro: cliente com 1.400 eventos via "200" e lia como
-- total. ADITIVO: acrescenta `events_total` (quantos eventos VISÍVEIS o tenant tem — mesmo
-- filtro de tipo do feed) e `events_window` (o tamanho da janela, 200). Nenhuma outra chave
-- muda: credits, plan, events e identity saem byte a byte como antes (provado por md5).
create or replace function public.get_client_data(p_email text, p_key text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_creds record; v_events jsonb; v_ident jsonb; e text := lower(trim(p_email)); v_total bigint;
        v_desde timestamptz;  -- db/live_desde.sql
begin
  select * into v_creds from client_credits where client_email = e;
  if v_creds is null or v_creds.access_key is distinct from p_key then raise exception 'unauthorized' using errcode = '28000'; end if;
  v_desde := coalesce(public.tenant_live_desde(e), '-infinity'::timestamptz);

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'created_at', created_at, 'type', type, 'channel', channel,
    'summary', summary, 'amount', amount, 'payload', payload) order by created_at desc), '[]'::jsonb)
  into v_events
  from (
    select * from client_events
    where client_email = e
      and type not in ('ops_alert', 'failure', 'attribution')
      and created_at >= v_desde
    order by created_at desc limit 200
  ) ev;

  select count(*) into v_total
    from client_events
   where client_email = e
     and type not in ('ops_alert', 'failure', 'attribution')
      and created_at >= v_desde;

  select jsonb_strip_nulls(jsonb_build_object(
           'business',   nullif(d.business, ''),
           'agent_name', nullif(coalesce(x.extras->>'agent_name', d.payload->'agent'->>'name', ''), ''),
           'logo',       nullif(coalesce(x.extras->>'logo_url', ''), ''),
           'accent',     nullif(coalesce(x.extras->>'accent', ''), ''),
           'site',       nullif(coalesce(x.extras->>'site', ''), ''),
           'lang',       nullif(coalesce(d.payload->>'lang', ''), ''),
           'live_since', nullif(coalesce(pf.tokens->>'live_desde', ''), ''),
           'sector',     nullif(coalesce(pf.tokens->>'industry', d.payload->>'industry', d.payload->'verticals'->>0, ''), ''),
           'number',     nullif(coalesce(a.number, ''), '')))
    into v_ident
    from (select 1) one
    left join onboard_drafts d on d.client_email = e
    left join client_profile_extras x on x.client_email = e
    left join client_agents a on a.client_email = e
    left join client_integrations pf on pf.client_email = e and pf.provider = 'profile'
   order by d.created_at desc nulls last
   limit 1;

  return jsonb_build_object(
    'credits', v_creds.credits, 'plan', v_creds.plan, 'events', v_events,
    'identity', coalesce(v_ident, '{}'::jsonb),
    'events_total', v_total, 'events_window', 200);
end $function$;
