-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- GUILEO · SELLER INBOUND LEADS — "os leads que CHEGARAM pra mim" (2026-08-20)
-- Projeto ynihodbknhjirkdogxby (smart@guileoai.com) · idempotente (roda de novo sem dor).
--
-- O BURACO QUE ISTO TAPA: lead entra por 3 portas (/raio-x público, formulários do site,
-- speed-to-lead) e TODAS param em `gui_actions` (+ CRM spine). Só o /admin enxergava. O vendedor
-- trabalhava às cegas — e lead pago em anúncio que ninguém trabalha é receita descartada.
--
-- ⚠️ A ATRIBUIÇÃO É POR EXTRAÇÃO EXATA, NUNCA `like '%👤ref:' || ref || '%'`:
--       substring(g.details from '👤ref:([^\s·]+)')  =  o ref do vendedor
--    O prefixo casava `ana` dentro de `👤ref:anabela` e pagava comissão pra pessoa errada
--    (6 ocorrências corrigidas no banco em 2026-08-20). O jeito certo está em db/lifecycle.sql
--    e nas 4 funções de comissão. NÃO reintroduza o LIKE de prefixo.
--    Única flexibilização: comparação CASE-INSENSITIVE (`lower(...) = lower(...)`). Continua
--    exata — só reconhece que existem 2 leads reais gravados com `👤ref:Luis` (L maiúsculo) e o
--    ref cadastrado do vendedor é `luis`. Casar caixa diferente é correto; casar prefixo não é.
--
-- GATE: INGEST literal ('glo_ing_c7f2a9e4b8d16350' = env INGEST_SECRET — Supabase proíbe GUC,
-- gate é sempre literal na função). SECURITY DEFINER. **NÃO é concedida ao anon**: só o nosso
-- servidor (service_role, via svcJson em functions/lib/sb.js) chama. gui_actions continua fechada.
--
-- NUNCA transforma erro em vazio: qualquer falha inesperada devolve {ok:false, motivo:"..."} —
-- lista vazia por erro lê como "você não tem lead nenhum" e o vendedor para de abrir a tela.
-- Contagem que não dá pra cruzar com precisão volta `null` + `motivo`, nunca um número duvidoso.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

-- gui_actions é varrida por (action, created_at) aqui e no /admin — índice barato, idempotente.
create index if not exists idx_gui_actions_lead_recente on public.gui_actions (action, created_at desc);

create or replace function public.seller_inbound_leads(
  p_secret text,
  p_ref    text,
  p_dias   int default 30,
  p_limit  int default 200
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ref          text := nullif(trim(coalesce(p_ref, '')), '');
  v_dias         int  := greatest(1, least(coalesce(p_dias, 30), 365));
  v_lim          int  := greatest(1, least(coalesce(p_limit, 200), 500));
  v_desde        timestamptz;
  v_seller_email text;
  v_rows         jsonb;
  v_total        int;
  v_24h          int;
  v_no_funil     int;
  v_funil_motivo text := null;
begin
  if coalesce(p_secret, '') <> 'glo_ing_c7f2a9e4b8d16350' then
    raise exception 'unauthorized' using errcode = '28000';
  end if;
  if v_ref is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem ref do vendedor');
  end if;
  v_desde := now() - make_interval(days => v_dias);

  -- Quem é o dono deste ref? Precisamos do e-mail para cruzar com o funil pessoal
  -- (seller_prospects). Sem ele a contagem "já no funil" não é confiável → devolve null + motivo.
  select s.email into v_seller_email
    from public.sellers s
   where lower(trim(coalesce(s.ref_slug, ''))) = lower(v_ref)
   limit 1;
  if v_seller_email is null then
    v_funil_motivo := 'nao achei vendedor com ref_slug=' || v_ref || ' na tabela sellers — sem e-mail nao da pra cruzar com o funil';
  end if;

  with meus as (
    select g.*
      from public.gui_actions g
     where g.action = 'lead'
       and g.details like '%👤ref:%'                                   -- só um filtro barato
       and lower(substring(g.details from '👤ref:([^\s·]+)')) = lower(v_ref)  -- ATRIBUIÇÃO EXATA
       and g.created_at >= v_desde
  ),
  funil as (   -- o CRM pessoal do vendedor (sp_list lê a mesma tabela) → "já puxei este lead?"
    select nullif(lower(trim(coalesce(p.email, ''))), '')                       as email,
           nullif(right(regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g'), 10), '') as fone10
      from public.seller_prospects p
     where v_seller_email is not null
       and p.seller_email = lower(trim(v_seller_email))
  ),
  enriquecido as (
    select m.id,
           m.created_at,
           nullif(trim(coalesce(m.name, '')), '')     as nome,
           nullif(trim(coalesce(m.contact, '')), '')  as contato,
           case when coalesce(m.contact, '') like '%@%' then 'email'
                when length(regexp_replace(coalesce(m.contact, ''), '[^0-9]', '', 'g')) >= 8 then 'telefone'
                else 'outro' end                      as contato_tipo,
           nullif(trim(coalesce(m.source, '')), '')   as canal,
           nullif(trim(coalesce(m.business, '')), '') as negocio,
           nullif(trim(coalesce(m.industry, '')), '') as setor,
           -- resumo legível: tira as etiquetas técnicas que viajam dentro do details
           nullif(trim(both ' ·' from regexp_replace(
             regexp_replace(coalesce(m.details, ''), '👤ref:[^\s·]+', '', 'g'),
             '🌐lang:[a-z]{2}', '', 'g')), '')        as resumo,
           substring(coalesce(m.details, '') from '🌐lang:([a-z]{2})') as idioma,
           -- o X-Ray daquele lead: 1º do próprio details (o /raio-x grava o link),
           -- 2º a avaliação gravada com o MESMO contato (o vendedor gerou pra ele).
           coalesce(
             substring(coalesce(m.details, '') from '/apresentacao/([0-9a-fA-F-]{36})'),
             (select be.id::text from public.business_evaluations be
               where nullif(trim(coalesce(be.contato, '')), '') is not null
                 and lower(trim(be.contato)) = lower(trim(coalesce(m.contact, '')))
               order by be.created_at desc limit 1)
           )                                           as avaliacao_id,
           exists (
             select 1 from funil f
              where (f.email is not null and f.email = lower(trim(coalesce(m.contact, ''))))
                 or (f.fone10 is not null
                     and length(regexp_replace(coalesce(m.contact, ''), '[^0-9]', '', 'g')) >= 8
                     and f.fone10 = right(regexp_replace(coalesce(m.contact, ''), '[^0-9]', '', 'g'), 10))
           )                                           as no_funil
      from meus m
  ),
  limitado as (select * from enriquecido order by created_at desc limit v_lim)
  select
    coalesce((select jsonb_agg(jsonb_build_object(
        'id', l.id, 'quando', l.created_at, 'nome', l.nome, 'contato', l.contato,
        'contato_tipo', l.contato_tipo, 'canal', l.canal, 'negocio', l.negocio,
        'setor', l.setor, 'resumo', l.resumo, 'idioma', l.idioma,
        'avaliacao_id', l.avaliacao_id, 'no_funil', l.no_funil
      ) order by l.created_at desc) from limitado l), '[]'::jsonb),
    (select count(*)::int from enriquecido),
    (select count(*)::int from enriquecido where created_at >= now() - interval '24 hours'),
    case when v_seller_email is null then null
         else (select count(*)::int from enriquecido where no_funil) end
  into v_rows, v_total, v_24h, v_no_funil;

  return jsonb_build_object(
    'ok', true,
    'ref', v_ref,
    'dias', v_dias,
    'seller_email', v_seller_email,           -- null = ref sem cadastro em sellers
    'rows', v_rows,
    'contagens', jsonb_build_object(
      'total', v_total,
      'ultimas_24h', v_24h,
      'no_funil', v_no_funil,                                                   -- null quando não dá pra cruzar
      'soltos', case when v_no_funil is null then null else v_total - v_no_funil end,
      'motivo', v_funil_motivo,
      'truncado', v_total > v_lim                                               -- rows cortadas pelo p_limit
    )
  );
exception
  when sqlstate '28000' then raise;
  when others then
    -- erro NUNCA vira lista vazia: quem chamou precisa poder dizer "falhou", não "você não tem lead".
    return jsonb_build_object('ok', false, 'motivo', left(coalesce(sqlerrm, 'erro desconhecido'), 200));
end $$;

-- SEM anon de propósito: só o servidor (service_role, via svcRpc) chama.
-- ⚠️ Não basta "não conceder": no Postgres toda função nasce com EXECUTE para PUBLIC, e o anon
-- herda por PUBLIC. Sem o revoke abaixo a função ficava aberta — comprovado com curl anon (200)
-- antes do revoke e 42501 "permission denied" depois.
revoke all on function public.seller_inbound_leads(text, text, int, int) from public;
revoke all on function public.seller_inbound_leads(text, text, int, int) from anon;
revoke all on function public.seller_inbound_leads(text, text, int, int) from authenticated;
grant execute on function public.seller_inbound_leads(text, text, int, int) to service_role;

-- ✅ Pronto. POST /api/seller-leads {action:"inbound"} → esta RPC → a caixa de entrada do vendedor.
