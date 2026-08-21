-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- RESYNC AUTOMÁTICO DO AGENTE — "o dono mudou, quem atende sabe" (2026-08-17)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- O incidente que pariu isto: o catálogo do Natura foi corrigido às 18h e a Lilian seguiu cotando
-- $118 AO TELEFONE — porque o cérebro de voz é um RETRATO (prompt sincronizado), não uma janela
-- viva. O conserto existia no banco e não chegava em quem atende.
--
-- O motor já existia: agent-evolve chama `agentes_atrasados` e re-sincroniza quem está para trás.
-- Mas "para trás" só significava VERSÃO DE LIÇÃO. Preço novo, KB nova? Invisíveis. Esta versão
-- compara também max(biz_services.updated_at) e max(client_kb.updated_at) contra brain_synced_at —
-- e na primeira rodada achou 3 agentes que o critério antigo jurava estarem em dia.
--
-- ⚠️ biz_services NÃO TINHA updated_at. A coluna + trigger abaixo são o pré-requisito: sem carimbo,
-- não há como saber que o catálogo mudou. (client_kb já tinha.)
--
-- ⚠️ `create or replace` NÃO PODE remover default de parâmetro (42P13). Se mudar a assinatura,
-- DROP FUNCTION antes — e preserve `p_limite default 50`, porque agent-evolve.js chama com e sem.
--
-- Cadência: agent-evolve saiu do bloco diário (13h UTC) para o bloco HORÁRIO do cron-tick.
-- Distância máxima entre "mudou" e "a agente sabe": 60 min, não 24 h. No-op barato sem atrasados.

alter table public.biz_services add column if not exists updated_at timestamptz not null default now();

create or replace function public._carimba_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_biz_services_updated on public.biz_services;
create trigger trg_biz_services_updated before update on public.biz_services
  for each row execute function public._carimba_updated_at();

create or replace function public.agentes_atrasados(p_secret text, p_versao integer, p_limite integer default 50)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_lista jsonb; v_total int;
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350') then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  with base as (
    select a.client_email, a.agent_id, coalesce(a.brain_version,0) as versao, a.brain_synced_at,
           (select max(s.updated_at) from biz_services s where s.client_email = a.client_email) as cat,
           (select max(k.updated_at) from client_kb k where k.client_email = a.client_email and k.active is true) as kb
      from client_agents a
     where coalesce(a.agent_id,'') <> ''
  ), marcado as (
    select b.*,
           (b.versao < p_versao) as por_versao,
           (b.cat is not null and (b.brain_synced_at is null or b.cat > b.brain_synced_at)) as por_catalogo,
           (b.kb  is not null and (b.brain_synced_at is null or b.kb  > b.brain_synced_at)) as por_kb
      from base b
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'cliente', client_email, 'agente', agent_id, 'versao', versao,
           'motivo', concat_ws('+', case when por_versao then 'licao' end,
                                    case when por_catalogo then 'catalogo' end,
                                    case when por_kb then 'conhecimento' end)
         ) order by versao asc, client_email asc), '[]'::jsonb),
         (select count(*) from marcado where por_versao or por_catalogo or por_kb)
    into v_lista, v_total
    from (select * from marcado where por_versao or por_catalogo or por_kb
           order by versao asc, client_email asc
           limit greatest(1, least(500, coalesce(p_limite,50)))) t;

  return jsonb_build_object('ok', true, 'versao_alvo', p_versao, 'total_atrasados', coalesce(v_total,0), 'lista', v_lista);
end $$;

grant execute on function public.agentes_atrasados(text, integer, integer) to anon;

-- PROVA (2026-08-17): 1ª rodada listou 3 agentes (Natura = catalogo+conhecimento) que a versão
-- antiga considerava em dia; o cron das 23h UTC re-sincronizou os 3 sozinho (brain_synced_at 19:01 NY)
-- e a bateria adversarial da Lilian passou de novo — unhas, orçamento sem preço e preço por unidade.
