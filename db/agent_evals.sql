-- ============================================================================
-- Guileo · AGENT EVALS — the memory of every eval run (paste in Supabase → Run).
-- ----------------------------------------------------------------------------
-- FUNDAÇÃO 2: medir se a Gui é BOA, não só se roda. functions/api/agent-eval.js
-- roda o golden set (src/data/agentEvalCases.js) contra o cérebro REAL, um JUIZ
-- (cadeia de modelos) pontua cada resposta pela rubrica, e o resultado é gravado
-- AQUI. O histórico é o que revela REGRESSÃO: se um agente piora numa rubrica de
-- safety/preço/tom entre dois deploys, aparece nesta tabela ANTES do cliente ver.
--
-- SEGURANÇA (padrão do repo):
--   • RLS ON, SEM policy anon → ninguém lê a tabela direto pelo PostgREST.
--   • Escrita/leitura só via RPC SECURITY DEFINER gated pelo literal INGEST
--     ('glo_ing_c7f2a9e4b8d16350' = env INGEST_SECRET). grant execute to anon (a RPC
--     é o único portão). Idempotente: pode rodar este arquivo quantas vezes quiser.
--   • NÃO guarda PII de cliente-final: só o texto do CASE (sintético) + a nota do
--     juiz. Nenhum dado de tenant cruza aqui.
-- ============================================================================

create table if not exists public.agent_evals (
  id              uuid primary key default gen_random_uuid(),
  run_at          timestamptz not null default now(),
  run_id          text not null,                    -- agrupa uma batelada (um disparo do harness)
  agent           text not null,                    -- voice | support | review
  case_id         text not null,                    -- src/data/agentEvalCases.js → case.id
  adversarial     boolean not null default false,   -- era um caso de ataque (injection / cross-tenant)?
  score           int  not null default 0,          -- overall 0-100 (o número que rankeia)
  score_accuracy  int,                              -- acurácia (preço/feature certos) 0-100
  score_tone      int,                              -- tom (empatia, calor, não-defensivo) 0-100
  score_safety    int,                              -- safety (sem promessa/vazamento/injection) 0-100
  score_resolution int,                             -- resolução (levou a um próximo passo útil) 0-100
  passed          boolean not null default false,   -- honrou TODOS os "never"? (um "never" quebrado = false)
  judge_notes     text,                             -- 1-2 frases do juiz: por que passou/reprovou
  model           text,                             -- modelo que gerou a resposta avaliada
  judge_model     text,                             -- modelo que julgou
  created_at      timestamptz not null default now()
);

create index if not exists agent_evals_run    on public.agent_evals (run_id, agent, case_id);
create index if not exists agent_evals_recent  on public.agent_evals (agent, run_at desc);
create index if not exists agent_evals_regress on public.agent_evals (agent, case_id, run_at desc);

alter table public.agent_evals enable row level security;
-- (deliberadamente SEM create policy → PostgREST anon não enxerga linhas; só as RPCs abaixo.)

-- ── Gate helper (idempotente; mesmo literal INGEST do resto do pipeline de dados). ──
create or replace function public._agent_eval_ok(p_secret text)
returns boolean language sql immutable as $$ select p_secret is not distinct from 'glo_ing_c7f2a9e4b8d16350' $$;

-- ── GRAVA um resultado de caso (o harness chama 1x por caso, exceto em dry-run). ──
create or replace function public.agent_eval_record(
  p_secret text, p_run_id text, p_agent text, p_case_id text,
  p_adversarial boolean, p_score int,
  p_accuracy int, p_tone int, p_safety int, p_resolution int,
  p_passed boolean, p_notes text, p_model text, p_judge_model text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public._agent_eval_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  insert into agent_evals(run_id, agent, case_id, adversarial, score,
      score_accuracy, score_tone, score_safety, score_resolution, passed, judge_notes, model, judge_model)
  values (left(coalesce(p_run_id,'run'),64), left(coalesce(p_agent,'?'),32), left(coalesce(p_case_id,'?'),80),
      coalesce(p_adversarial,false), greatest(0, least(coalesce(p_score,0),100)),
      p_accuracy, p_tone, p_safety, p_resolution, coalesce(p_passed,false),
      left(coalesce(p_notes,''),1000), left(coalesce(p_model,''),60), left(coalesce(p_judge_model,''),60))
  returning id into v_id;
  return v_id;
end $$;

-- ── LÊ os N resultados mais recentes (view de histórico / regressão no /admin ou curl). ──
create or replace function public.agent_evals_recent(p_secret text, p_limit int default 200)
returns table(run_at timestamptz, run_id text, agent text, case_id text, adversarial boolean,
              score int, score_accuracy int, score_tone int, score_safety int, score_resolution int,
              passed boolean, judge_notes text, model text, judge_model text)
language plpgsql security definer set search_path = public as $$
begin
  if not public._agent_eval_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  return query
    select e.run_at, e.run_id, e.agent, e.case_id, e.adversarial,
           e.score, e.score_accuracy, e.score_tone, e.score_safety, e.score_resolution,
           e.passed, e.judge_notes, e.model, e.judge_model
    from agent_evals e
    order by e.run_at desc
    limit greatest(1, least(coalesce(p_limit,200), 2000));
end $$;

-- ── RESUMO por agente da ÚLTIMA batelada de cada agente (nota média + taxa de PASS + falhas). ──
-- É o "placar" pra decidir GO/NO-GO: se pass_rate < 100% nos adversariais → não sobe.
create or replace function public.agent_evals_summary(p_secret text)
returns table(agent text, run_id text, run_at timestamptz, cases int,
              avg_score numeric, avg_safety numeric, passed int, failed int, adversarial_failed int)
language plpgsql security definer set search_path = public as $$
begin
  if not public._agent_eval_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  return query
  with latest as (
    -- a run_id mais recente de cada agente
    select distinct on (e.agent) e.agent, e.run_id, e.run_at
    from agent_evals e
    order by e.agent, e.run_at desc
  )
  select l.agent, l.run_id, l.run_at,
         count(*)::int,
         round(avg(e.score)::numeric, 1),
         round(avg(e.score_safety)::numeric, 1),
         count(*) filter (where e.passed)::int,
         count(*) filter (where not e.passed)::int,
         count(*) filter (where not e.passed and e.adversarial)::int
  from latest l
  join agent_evals e on e.agent = l.agent and e.run_id = l.run_id
  group by l.agent, l.run_id, l.run_at
  order by l.agent;
end $$;

grant execute on function public.agent_eval_record(text,text,text,text,boolean,int,int,int,int,int,boolean,text,text,text) to anon;
grant execute on function public.agent_evals_recent(text,int) to anon;
grant execute on function public.agent_evals_summary(text) to anon;
