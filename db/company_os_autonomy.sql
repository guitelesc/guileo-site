-- ============================================================================
-- COMPANY OS · AUTONOMIA + SELF-HEALING (nível 2026). INGEST-gated, idempotente.
--   • autonomia por tenant: off | safe | full. 'safe' (default) = a Gui age sozinha só nas
--     ações SEGURAS (email: reativar/nutrir/lembrar/agradecer). 'off' = a Gui NÃO age sozinha
--     (o dono pausou aquele cliente). 'full' = libera canais além do email (voz/SMS) — só acende
--     quando A2P/consentimento existir; DINHEIRO/risco NUNCA é automático em nenhum nível.
--   • self-healing: detecta agentes de cliente mal-configurados (sem nome próprio / sem KB) —
--     a raiz do bug "atendeu como Gui". Surge no brief do dono; re-sync fica 1-clique (sync-agent).
-- ============================================================================

create table if not exists public.company_os_autonomy (
  client_email text primary key,
  level        text not null default 'safe',   -- off | safe | full
  updated_at   timestamptz not null default now()
);
alter table public.company_os_autonomy enable row level security;

-- get 1 tenant (default 'safe' se nunca setado)
create or replace function public.autonomy_get(p_secret text, p_email text)
returns text language plpgsql security definer set search_path=public as $$
declare v text;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode='28000'; end if;
  select level into v from company_os_autonomy where client_email=lower(trim(p_email));
  return coalesce(v,'safe');
end $$;
grant execute on function public.autonomy_get(text,text) to anon;

-- set (upsert, valida o nível)
create or replace function public.autonomy_set(p_secret text, p_email text, p_level text)
returns json language plpgsql security definer set search_path=public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode='28000'; end if;
  if p_level not in ('off','safe','full') then raise exception 'invalid level'; end if;
  insert into company_os_autonomy(client_email, level, updated_at)
    values (lower(trim(p_email)), p_level, now())
    on conflict (client_email) do update set level=excluded.level, updated_at=now();
  return json_build_object('ok',true,'client_email',lower(trim(p_email)),'level',p_level);
exception when others then return json_build_object('error',SQLERRM); end $$;
grant execute on function public.autonomy_set(text,text,text) to anon;

-- lista todos os overrides (o que NÃO for 'safe') — o proactive lê 1x pra pular os 'off'.
create or replace function public.autonomy_all(p_secret text)
returns json language plpgsql security definer set search_path=public as $$
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode='28000'; end if;
  return coalesce((select json_agg(json_build_object('client_email',client_email,'level',level) order by client_email)
    from company_os_autonomy), '[]'::json);
exception when others then return json_build_object('error',SQLERRM); end $$;
grant execute on function public.autonomy_all(text) to anon;

-- 📊 SELF-HEALING — agentes de cliente mal-configurados (tem agente mas sem nome próprio, OU sem KB).
create or replace function public.company_agents_health(p_secret text)
returns json language plpgsql security definer set search_path=public as $$
declare v_unhealthy json := '[]'::json; v_count bigint := 0;
begin
  if p_secret is distinct from 'glo_ing_7f3da9c2b4e8' then raise exception 'unauthorized' using errcode='28000'; end if;
  if to_regclass('public.gui_pending_onboarding') is null then return json_build_object('ready',false,'count',0,'unhealthy','[]'::json); end if;
  select coalesce(json_agg(json_build_object('email',email,'business',business,
           'reason', case when nullif(agent_name,'') is null then 'sem nome próprio'
                          when kb_ct = 0 then 'sem knowledge base' else 'ok' end) order by email), '[]'::json), count(*)
    into v_unhealthy, v_count
  from (
    select g.email, g.business, g.agent_name,
           coalesce((select count(*) from client_kb k where k.client_email=g.email), 0) as kb_ct
    from gui_pending_onboarding g
    where g.agent_id is not null                         -- já tem agente provisionado
      and (nullif(g.agent_name,'') is null               -- mas sem nome próprio (bug "atendeu como Gui")
        or coalesce((select count(*) from client_kb k where k.client_email=g.email),0) = 0)  -- ou sem KB
  ) sub;
  return json_build_object('ready',true,'count',v_count,'unhealthy',v_unhealthy);
exception when others then return json_build_object('error',SQLERRM,'count',0,'unhealthy','[]'::json); end $$;
grant execute on function public.company_agents_health(text) to anon;
