-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- MEDIANA DE EVAL — separar DEFEITO de RUÍDO (2026-08-18)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Por que existe: rodei o MESMO conjunto duas vezes seguidas, sem mudar nada, e as notas oscilaram
-- até 85 pontos (hvac 90→5, law 93→30, dental 35→96). A diferença entre duas VERSÕES de lição foi
-- 1,2 ponto. Ou seja: com amostra de 1, "melhorou" e "piorou" são a mesma medição — e eu cheguei a
-- reportar ao Luis um ganho de lição (salon 15→94) que não sobreviveu ao segundo sorteio.
--
-- A regra que sai disto: NENHUMA decisão de lição sai de uma amostra. Mediana de 3, e junto com ela
-- a AMPLITUDE — porque é a amplitude que diz se o número é sobre o agente ou sobre o sorteio.
--
-- ⚠️ MEDIANA, NÃO MÉDIA. Um 5 solitário afunda a média de um caso que vai bem em 2 de 3 vezes; a
-- mediana ignora o outlier, que é exatamente o que ele é. Foi a diferença entre "hvac está quebrado"
-- (verdade: mediana 5) e "salon está ótimo" (mentira: mediana 75, não os 94 de uma amostra).
create or replace function public.eval_mediana(p_secret text, p_run_id text default null, p_min_amostras integer default 2)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare alvo text; out jsonb;
begin
  if p_secret not in ('glo_ing_c7f2a9e4b8d16350') then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  alvo := coalesce(nullif(trim(coalesce(p_run_id,'')),''),
                   (select run_id from agent_evals order by run_at desc limit 1));

  select coalesce(jsonb_agg(x order by (x->>'mediana')::int asc), '[]'::jsonb) into out from (
    select jsonb_build_object(
      'caso', case_id,
      'agente', min(agent),
      'amostras', count(*),
      'mediana', percentile_cont(0.5) within group (order by score)::int,
      'pior', min(score), 'melhor', max(score),
      'amplitude', max(score) - min(score),
      -- CONFIÁVEL = amostras suficientes E baixa dispersão. Só o que é confiável pode virar lição:
      -- lição escrita em cima de ruído é lição que incha o prompt sem consertar nada.
      'confiavel', (count(*) >= p_min_amostras and (max(score) - min(score)) <= 20),
      'exemplo_do_juiz', min(judge_notes)
    ) as x
    from agent_evals where run_id = alvo group by case_id
  ) t;

  return jsonb_build_object('ok', true, 'run_id', alvo, 'casos', out);
end $$;

grant execute on function public.eval_mediana(text, text, integer) to anon;
