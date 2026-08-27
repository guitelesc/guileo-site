-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- LISTA DE LIGAÇÃO — o prospect que JÁ TEM NOSSO E-MAIL NA CAIXA vem primeiro
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- Luis, 25/08, olhando o hub antes de ligar: «falta a parte dos enviados».
--
-- O QUE ESTAVA ERRADO: `lista_de_ligacao` ordenava só por DOR MEDIDA. Dor medida é um bom sinal
-- de que o negócio precisa da gente — e um sinal fraco de que ele COMPRA. Pior: dois termos do
-- score empurravam ativamente o negócio forte para baixo:
--     avaliações < 25  → +10     (um dentista de 8 avaliações passava na frente de um salão de 1.282)
--     sem e-mail       → +5      (ou seja: ter conseguido o e-mail dele PIORAVA a posição)
-- O resultado é que os 9 prospects que receberam e-mail da gente — e cuja entrega foi CONFIRMADA
-- pelo provedor — não apareciam no topo de "Where to start". O vendedor abria a tela pra decidir
-- por onde começar e ela escondia justamente as portas que já estavam entreabertas.
--
-- O QUE MUDA: um sinal novo, `contatado`, lido da própria nota do prospect (o carimbo ✉️ que o
-- envio grava lá). Ele vale +60 — mais que qualquer dor — porque «o dono já tem nosso e-mail na
-- caixa» é o sinal de compra mais forte do conjunto inteiro: a ligação deixa de ser fria.
-- Os outros termos do score ficam INTOCADOS de propósito: mexer na régua de dor é decisão de
-- produto do Luis, não efeito colateral de um conserto de ordenação.
--
-- Idempotente: create or replace. Prova no fim do arquivo.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

create or replace function public.lista_de_ligacao(p_secret text, p_seller text default null::text, p_limit integer default 30)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode='28000'; end if;

  with base as (
    select
      regexp_replace(coalesce(p.phone,''), '\D', '', 'g') as fone_chave,
      p.business, p.phone, nullif(p.email,'') email, p.seller_email,
      e.id relatorio, e.site site_real,
      e.payload->'minha_ficha'->>'nota' nota_google,
      e.payload->'minha_ficha'->>'avaliacoes' avaliacoes,
      e.payload->'minha_ficha'->>'categoria' categoria,
      e.payload->>'lang' idioma_relatorio,
      ach->>'titulo' dor_titulo,
      left(coalesce(ach->>'evidencia',''), 180) dor_evidencia,
      ach->>'gui' resposta_gui,
      -- ── O SINAL NOVO ────────────────────────────────────────────────────────────────────────
      -- O envio carimba a nota com "✉️ <data> — ... enviado a <email> (id ...)". Ler dali é o
      -- jeito honesto: se o carimbo não existe, ninguém falou com ele, e a tela não pode fingir.
      (p.note like '%✉️%') as contatado,
      substring(p.note from '✉️ (\d{4}-\d{2}-\d{2})') as contatado_em,
      -- o site reconstruído, quando existe: é o que o vendedor manda por SMS durante a ligação
      substring(p.note from 'Site novo: (\S+)') as site_novo,
      substring(p.note from '(https://guileoai\.com/presente/\S+)') as presente,
        (case when p.note like '%✉️%' then 60 else 0 end)
      + (case when ach->>'id' = 'fora_horario' then 40 else 0 end)
      + (case when ach->>'gravidade' = 'alta' then 20 else 0 end)
      + (case when coalesce((e.payload->'minha_ficha'->>'nota')::numeric, 5) < 4.2 then 15 else 0 end)
      + (case when coalesce((e.payload->'minha_ficha'->>'avaliacoes')::int, 999) < 25 then 10 else 0 end)
      + greatest(0, 10 - coalesce((e.payload->>'score_geral')::numeric, 10))
      + (case when coalesce(p.email,'') = '' then 5 else 0 end) as prioridade
    from seller_prospects p
    left join business_evaluations e
      on e.id = nullif(substring(p.note from 'apresentacao/([0-9a-f-]{36})'), '')::uuid
      or e.site = nullif(substring(p.note from 'https?://(?!guileoai)[^\s"]+'), '')
    left join lateral (
      select a from jsonb_array_elements(coalesce(e.payload->'achados','[]'::jsonb)) a
       order by (case when a->>'gravidade'='alta' then 0 else 1 end) limit 1
    ) t(ach) on true
    where coalesce(p.phone,'') <> '' and p.stage = 'new'
      and (p_seller is null or p.seller_email = lower(trim(p_seller)))
  ), unico as (
    select distinct on (fone_chave) * from base
     order by fone_chave, prioridade desc, (relatorio is not null) desc, dor_titulo nulls last
  )
  select coalesce(jsonb_agg(to_jsonb(u) - 'fone_chave' order by u.prioridade desc), '[]'::jsonb)
    into v from (select * from unico order by prioridade desc limit greatest(least(coalesce(p_limit,30), 100), 1)) u;
  return v;
end $function$;

-- ── PROVA (rode junto): os contatados têm que subir ao topo ────────────────────────────────────
--   select x->>'business', (x->>'contatado')::bool, x->>'contatado_em', x->>'prioridade'
--     from jsonb_array_elements(public.lista_de_ligacao('glo_ing_c7f2a9e4b8d16350','luistelesc@gmail.com',12)) x;
