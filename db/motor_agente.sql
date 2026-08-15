-- MOTOR DE AGENTE — o carimbo de versão e a busca pelos atrasados.
-- ══════════════════════════════════════════════════════════════════════════════════════════════
-- POR QUE ISTO EXISTE
-- functions/lib/licoes.js guarda o que todo agente precisa saber. Mas saber no CÓDIGO não é saber
-- no AGENTE: o cérebro de cada agente vive na ElevenLabs, e só muda quando alguém roda o sync
-- daquele cliente. Sem um carimbo, descobrir quem está atrasado exigiria reconstruir o cérebro dos
-- N clientes e comparar texto — caro, lento e frágil. Com o carimbo, vira comparar dois números.
--
-- O QUE ESTE ARQUIVO NÃO FAZ: não guarda o cérebro. Só a VERSÃO. O texto tem uma fonte só
-- (licoes.js + buildGuiPrompt), e duplicá-lo no banco criaria duas verdades que divergem na
-- primeira vez que alguém retocar uma delas.
--
-- IDEMPOTENTE: pode rodar quantas vezes quiser.

alter table public.client_agents
  add column if not exists brain_version int not null default 0,
  add column if not exists brain_synced_at timestamptz;

comment on column public.client_agents.brain_version is
  'Versão de licoes.js que ESTE agente carrega. 0 = nasceu antes do motor. Menor que a atual = atrasado.';

-- ── QUEM ESTÁ PARA TRÁS ────────────────────────────────────────────────────────────────────────
-- Devolve os agentes cuja versão é menor que a corrente. Ordena pelos mais atrasados primeiro
-- porque a varredura tem teto por rodada: se ela parar no meio, tem que ter atualizado quem estava
-- pior, não quem estava por acaso no topo do alfabeto.
create or replace function public.agentes_atrasados(p_secret text, p_versao int, p_limite int default 50)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_lista jsonb;
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350') then
    raise exception 'unauthorized' using errcode = '28000';
  end if;

  select coalesce(jsonb_agg(x order by x->>'versao', x->>'cliente'), '[]'::jsonb) into v_lista
  from (
    select jsonb_build_object(
             'cliente', client_email,
             'agente',  agent_id,
             'versao',  brain_version
           ) as x
    from public.client_agents
    where coalesce(brain_version, 0) < p_versao
      and coalesce(agent_id, '') <> ''          -- sem agente não há o que atualizar
    order by coalesce(brain_version, 0) asc, client_email asc
    limit greatest(1, least(500, p_limite))
  ) s;

  return jsonb_build_object(
    'ok', true,
    'versao_alvo', p_versao,
    -- `total_atrasados` conta TODOS, não só os que couberam no limite. Sem isso a varredura
    -- reportaria "3 atualizados" numa frota com 300 atrasados e pareceria trabalho concluído.
    'total_atrasados', (select count(*) from public.client_agents
                        where coalesce(brain_version,0) < p_versao and coalesce(agent_id,'') <> ''),
    'lista', v_lista
  );
end $$;

-- ── CARIMBAR ───────────────────────────────────────────────────────────────────────────────────
-- Só é chamado DEPOIS que o sync confirmou que a ElevenLabs aceitou o cérebro novo. Carimbar antes
-- seria mentir: o banco diria "atualizado" e o agente continuaria falando errado — e, pior, a
-- varredura nunca mais tentaria de novo, porque ele já não apareceria como atrasado.
create or replace function public.agente_carimbar(p_secret text, p_email text, p_versao int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tenant text := lower(trim(coalesce(p_email, ''))); v_n int;
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350') then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_tenant = '' then raise exception 'tenant required' using errcode = '22023'; end if;

  update public.client_agents
     set brain_version = p_versao, brain_synced_at = now()
   where client_email = v_tenant;
  get diagnostics v_n = row_count;

  -- Devolve o que MUDOU, não um "ok" seco: um carimbo que não achou linha nenhuma é uma falha
  -- silenciosa (cliente sem registro de agente), e quem chamou precisa saber para não contar
  -- esse cliente como atualizado.
  return jsonb_build_object('ok', v_n > 0, 'linhas', v_n, 'versao', p_versao);
end $$;

revoke all on function public.agentes_atrasados(text, int, int) from anon, authenticated;
revoke all on function public.agente_carimbar(text, text, int) from anon, authenticated;
