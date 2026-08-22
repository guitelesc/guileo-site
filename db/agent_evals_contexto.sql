-- ═════════════════════════════════════════════════════════════════════════════
-- AGENT_EVALS: cada rodada passa a dizer O QUE ELA MEDIU (2026-08-22)
-- ═════════════════════════════════════════════════════════════════════════════
-- O BURACO QUE ISTO FECHA — descoberto na marra hoje:
--   A tabela guardava nota, motivo do juiz, modelo e modelo-juiz. Não guardava as
--   duas coisas que decidem se DUAS RODADAS SÃO COMPARÁVEIS:
--     • `licoes_versao` — qual versão de functions/lib/licoes.js o agente tinha.
--       Sem isto, "o agente reprovou 8/17" não diz de QUAL agente se fala. A rodada
--       de 18/08 media um cérebro sem as lições de 21/08 e 22/08, e a única forma
--       de descobrir foi `git log -L` no arquivo. Comparação que exige arqueologia
--       não é histórico.
--     • `tenant` — contra QUE NEGÓCIO o caso rodou. Os 13 verticais rodaram meses
--        contra um sandbox de spa (db/eval_sandbox_verticais.sql conserta), e isso
--        era invisível no histórico. Gravando, a era errada fica marcada e nunca
--        volta em silêncio.
--
-- Colunas anuláveis: linha antiga fica NULL e NULL aqui significa "não sei", que é
-- a verdade — não vou preencher retroativamente com palpite.
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.agent_evals add column if not exists licoes_versao int;
alter table public.agent_evals add column if not exists tenant text;

-- A assinatura muda, então DROP antes: `create or replace` com parâmetros novos criaria
-- uma SEGUNDA função e o PostgREST ficaria ambíguo entre as duas.
drop function if exists public.agent_eval_record(text,text,text,text,boolean,int,int,int,int,int,boolean,text,text,text);

create or replace function public.agent_eval_record(
  p_secret text, p_run_id text, p_agent text, p_case_id text,
  p_adversarial boolean, p_score int,
  p_accuracy int, p_tone int, p_safety int, p_resolution int,
  p_passed boolean, p_notes text, p_model text, p_judge_model text,
  p_licoes_versao int default null, p_tenant text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public._agent_eval_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  insert into agent_evals(run_id, agent, case_id, adversarial, score,
      score_accuracy, score_tone, score_safety, score_resolution, passed, judge_notes, model, judge_model,
      licoes_versao, tenant)
  values (left(coalesce(p_run_id,'run'),64), left(coalesce(p_agent,'?'),32), left(coalesce(p_case_id,'?'),80),
      coalesce(p_adversarial,false), greatest(0, least(coalesce(p_score,0),100)),
      p_accuracy, p_tone, p_safety, p_resolution, coalesce(p_passed,false),
      left(coalesce(p_notes,''),1000), left(coalesce(p_model,''),60), left(coalesce(p_judge_model,''),60),
      p_licoes_versao, left(coalesce(p_tenant,''),120))
  returning id into v_id;
  return v_id;
end $$;

-- A leitura tem que devolver o contexto também, senão gravar não adianta.
drop function if exists public.agent_evals_recent(text,int);

create or replace function public.agent_evals_recent(p_secret text, p_limit int default 200)
returns table(run_at timestamptz, run_id text, agent text, case_id text, adversarial boolean,
              score int, score_accuracy int, score_tone int, score_safety int, score_resolution int,
              passed boolean, judge_notes text, model text, judge_model text,
              licoes_versao int, tenant text)
language plpgsql security definer set search_path = public as $$
begin
  if not public._agent_eval_ok(p_secret) then raise exception 'unauthorized' using errcode = '28000'; end if;
  return query
    select e.run_at, e.run_id, e.agent, e.case_id, e.adversarial,
           e.score, e.score_accuracy, e.score_tone, e.score_safety, e.score_resolution,
           e.passed, e.judge_notes, e.model, e.judge_model, e.licoes_versao, e.tenant
    from public.agent_evals e
    order by e.run_at desc
    limit greatest(1, least(coalesce(p_limit,200), 2000));
end $$;

grant execute on function public.agent_eval_record(text,text,text,text,boolean,int,int,int,int,int,boolean,text,text,text,int,text) to anon;
grant execute on function public.agent_evals_recent(text,int) to anon;

-- PROVA (o gate tem que recusar e a leitura tem que trazer as colunas novas):
--   select * from public.agent_evals_recent('errado', 1);            -- deve dar unauthorized
--   select case_id, licoes_versao, tenant from public.agent_evals_recent('glo_ing_c7f2a9e4b8d16350', 5);
