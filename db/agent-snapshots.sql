-- ══════════════════════════════════════════════════════════════════════════════════════════
-- REFERÊNCIA-OURO DO AGENTE — a memória do que estava CERTO.
-- Motivo (Luis, 2026-08-19): "não posso mais voltar aqui pela mesma coisa". Toda vez que
-- mexemos no agente e piora, não havia como voltar: a config vivia só na ElevenLabs e a
-- versão boa se perdia. Aqui a config inteira é gravada ANTES de cada mudança, e a última
-- boa pode ser reaplicada com um comando.
-- Idempotente: rodar duas vezes não duplica nada.
-- ══════════════════════════════════════════════════════════════════════════════════════════

create table if not exists public.agent_snapshots (
  id          uuid primary key default gen_random_uuid(),
  agent_id    text        not null,
  criado_em   timestamptz not null default now(),
  rotulo      text        not null default '',
  aprovado    boolean     not null default false,  -- true = REFERÊNCIA-OURO (ouvida e aprovada)
  padrao_nota int,                                 -- 0..17 do ?padrao=1 no momento do snapshot
  config      jsonb       not null
);

create index if not exists agent_snapshots_agent_idx  on public.agent_snapshots (agent_id, criado_em desc);
create index if not exists agent_snapshots_ouro_idx   on public.agent_snapshots (agent_id, criado_em desc) where aprovado;

alter table public.agent_snapshots enable row level security;  -- sem policy: anon não lê nem escreve

-- porta de serviço: mesmo literal do ingest usado pelo sync (ver ARQUITETURA.md)
create or replace function public._gui_snap_ok(p_secret text) returns boolean
language sql immutable as $$ select p_secret = 'glo_ing_c7f2a9e4b8d16350' $$;

-- grava um snapshot. `p_aprovado` marca como referência-ouro.
create or replace function public.agent_snapshot_save(
  p_secret text, p_agent_id text, p_config jsonb,
  p_rotulo text default '', p_aprovado boolean default false, p_nota int default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public._gui_snap_ok(p_secret) then raise exception 'unauthorized'; end if;
  if p_agent_id is null or length(trim(p_agent_id)) = 0 then raise exception 'agent_id required'; end if;
  if p_config is null or jsonb_typeof(p_config) <> 'object' then raise exception 'config must be an object'; end if;
  insert into public.agent_snapshots (agent_id, config, rotulo, aprovado, padrao_nota)
  values (trim(p_agent_id), p_config, coalesce(p_rotulo,''), coalesce(p_aprovado,false), p_nota)
  returning id into v_id;
  return v_id;
end $$;

-- devolve a ÚLTIMA referência-ouro (ou o último snapshot, se nunca houve ouro).
create or replace function public.agent_snapshot_last(
  p_secret text, p_agent_id text, p_somente_ouro boolean default true
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not public._gui_snap_ok(p_secret) then raise exception 'unauthorized'; end if;
  select jsonb_build_object('id', s.id, 'criado_em', s.criado_em, 'rotulo', s.rotulo,
                            'aprovado', s.aprovado, 'padrao_nota', s.padrao_nota, 'config', s.config)
    into v
    from public.agent_snapshots s
   where s.agent_id = trim(p_agent_id)
     and (not coalesce(p_somente_ouro,true) or s.aprovado)
   order by s.criado_em desc
   limit 1;
  return v;  -- null quando não existe: quem chama trata, NUNCA finge que voltou
end $$;

revoke all on function public.agent_snapshot_save(text,text,jsonb,text,boolean,int) from anon, public;
revoke all on function public.agent_snapshot_last(text,text,boolean)                 from anon, public;
grant execute on function public.agent_snapshot_save(text,text,jsonb,text,boolean,int) to service_role;
grant execute on function public.agent_snapshot_last(text,text,boolean)                to service_role;
