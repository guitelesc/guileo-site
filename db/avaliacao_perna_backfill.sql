-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- BACKFILL: a PERNA (Brain · AD · Build) em cada passo da estratégia já gravada — 2026-08-18
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- POR QUÊ: o Growth Report (/apresentacao/:id) passou a AGRUPAR o plano pelas três pernas
-- («dividir a Fase 1 e a Fase 2 por GUILEO — o que cada perna vai fazer», Luis, 2026-08-18).
-- O motor (functions/lib/avaliacao.js → PERNA_POR_PRODUTO / pernaDoPasso) já emite `perna` em
-- TODO passo novo, do mesmo jeito que emite `fase`. Este arquivo acerta o que já está no banco.
--
-- ⚠️ A PÁGINA NÃO DEPENDE DESTE SQL. Ela resolve a perna em duas camadas: `s.perna` do payload
-- e, quando ele não existe, `pilarDoPasso(produto_id)` lendo o CATÁLOGO
-- (src/data/productSystem.js). Rodar isto não muda o que a Lilian vê hoje — muda o payload, que
-- é o contrato lido por qualquer outra superfície (e-mail, PDF, vendedor, export). Fazer o dado
-- e a tela concordarem é o ponto; deixar a tela "consertando" o dado para sempre é dívida.
--
-- ⚠️ A ATRIBUIÇÃO É A DO CATÁLOGO ("QUEM EXECUTA", não "para que serve"), byte a byte igual à
-- PERNA_POR_PRODUTO do motor. `close_collect` fica em BRAIN mesmo falando de dinheiro: quem cota,
-- fecha e cobra é a AGENTE, e a linha do pilar Brain na landing diz exatamente isso ("answers,
-- books, quotes, closes and collects"). `catalog` é BUILD: é a fundação de dados de onde a agente
-- tira o preço para nunca inventar valor.
--
-- IDEMPOTENTE: reescreve `perna` sempre com o mesmo valor; rodar 2×, 10× dá o mesmo resultado.
-- SEM DDL, SEM RPC NOVA: é um UPDATE de jsonb. Reversível com o bloco comentado no fim.
--
-- Aplicar via MCP (apply_migration ou execute_sql). NÃO foi aplicado.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

-- ── 1. ANTES: veja o que vai mudar (rode sozinho primeiro) ──────────────────────────────────────
select
  e.id,
  e.business,
  p ->> 'produto_id'                        as produto_id,
  p ->> 'fase'                              as fase,
  p ->> 'perna'                             as perna_hoje,
  case p ->> 'produto_id'
    when 'answering'       then 'brain' when 'agenda'          then 'brain'
    when 'widget_whatsapp' then 'brain' when 'speedlead'       then 'brain'
    when 'close_collect'   then 'brain' when 'reactivation'    then 'brain'
    when 'pulse'           then 'brain' when 'multilingual'    then 'brain'
    when 'reputation'      then 'ad'    when 'marketing_ads'   then 'ad'
    when 'content'         then 'ad'    when 'social_manage'   then 'ad'
    when 'crm_email'       then 'ad'    when 'seo_aeo'         then 'ad'
    when 'catalog'         then 'build' when 'websites'        then 'build'
    when 'apps'            then 'build' when 'ecommerce'       then 'build'
    when 'automation'      then 'build'
    else null                                     -- chave desconhecida → fica SEM perna, de
  end                                       as perna_nova   -- propósito: a página desenha o passo
from public.business_evaluations e                          -- fora dos grupos em vez de chutar
cross join lateral jsonb_array_elements(e.payload -> 'estrategia') p
where e.id in (
  'a276494b-e09d-4ade-ad96-7b112eb0d663',   -- Natura Spa — link curto /natura
  '3cce61e3-5974-4ef0-bfaa-93f88e405799'    -- Natura Spa — link antigo que o Luis já mandou
);

-- ── 2. O BACKFILL ───────────────────────────────────────────────────────────────────────────────
-- jsonb_agg preserva a ORDEM do array (with ordinality), que aqui é a ordem do plano: os passos
-- estão numerados na tela por essa ordem, e embaralhar renumeraria o plano da cliente em silêncio.
update public.business_evaluations e
set payload = jsonb_set(
      e.payload,
      '{estrategia}',
      (
        select coalesce(jsonb_agg(
                 case
                   when perna is null then passo - 'perna'   -- desconhecido: remove, não inventa
                   else passo || jsonb_build_object('perna', perna)
                 end
                 order by ord
               ), '[]'::jsonb)
        from (
          select
            p.value as passo,
            p.ordinality as ord,
            case p.value ->> 'produto_id'
              when 'answering'       then 'brain' when 'agenda'          then 'brain'
              when 'widget_whatsapp' then 'brain' when 'speedlead'       then 'brain'
              when 'close_collect'   then 'brain' when 'reactivation'    then 'brain'
              when 'pulse'           then 'brain' when 'multilingual'    then 'brain'
              when 'reputation'      then 'ad'    when 'marketing_ads'   then 'ad'
              when 'content'         then 'ad'    when 'social_manage'   then 'ad'
              when 'crm_email'       then 'ad'    when 'seo_aeo'         then 'ad'
              when 'catalog'         then 'build' when 'websites'        then 'build'
              when 'apps'            then 'build' when 'ecommerce'       then 'build'
              when 'automation'      then 'build'
              else null
            end as perna
          from jsonb_array_elements(e.payload -> 'estrategia') with ordinality p(value, ordinality)
        ) t
      )
    )
where e.id in (
  'a276494b-e09d-4ade-ad96-7b112eb0d663',
  '3cce61e3-5974-4ef0-bfaa-93f88e405799'
)
and jsonb_typeof(e.payload -> 'estrategia') = 'array';

-- ── 3. A PROVA (rode depois; "ok" sem comprovante é promessa sem lastro) ─────────────────────────
-- Esperado para a Natura: answering/widget_whatsapp/speedlead → brain · catalog → build (fase 1);
-- close_collect/reactivation → brain · marketing_ads → ad (fase 2). Nenhuma linha com perna null.
select
  e.id, p ->> 'fase' as fase, p ->> 'produto_id' as produto_id, p ->> 'perna' as perna
from public.business_evaluations e
cross join lateral jsonb_array_elements(e.payload -> 'estrategia') p
where e.id in (
  'a276494b-e09d-4ade-ad96-7b112eb0d663',
  '3cce61e3-5974-4ef0-bfaa-93f88e405799'
)
order by e.id, (p ->> 'prioridade')::int;

-- ── 4. DESFAZER, se precisar ────────────────────────────────────────────────────────────────────
-- update public.business_evaluations e
-- set payload = jsonb_set(e.payload, '{estrategia}', (
--   select coalesce(jsonb_agg(p.value - 'perna' order by p.ordinality), '[]'::jsonb)
--   from jsonb_array_elements(e.payload -> 'estrategia') with ordinality p(value, ordinality)))
-- where e.id in ('a276494b-e09d-4ade-ad96-7b112eb0d663','3cce61e3-5974-4ef0-bfaa-93f88e405799');
