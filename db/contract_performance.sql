-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- QUAL CAMPANHA VIROU CONTRATO ASSINADO — a leitura que fechava o ciclo do dinheiro (2026-08-17)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Pedido do Luis: "o contrato e o orçamento têm que proteger a nós 1000%, até porque vamos usar os
-- dados para performance."
--
-- O DADO JÁ EXISTIA TODO. `lead_attribution` guarda source/medium/campaign/gclid/fbclid/landing e o
-- `first_seen_at`; `contracts` guarda valor, status, `signed_at` e `contact_id`. O que não existia
-- era a JUNÇÃO: ninguém conseguia responder "qual campanha virou assinatura, por quanto, em quantos
-- dias". Sem essa resposta o motor de anúncio otimiza por LEAD — e lead é métrica de meio de funil.
-- Duas campanhas com o mesmo custo por lead podem ter taxa de fechamento 5× diferente; sem esta RPC
-- o reinvestimento aposta na errada com dado verdadeiro na mão.
--
-- ⚠️ ATRIBUIÇÃO DE PRIMEIRO TOQUE, DECLARADA. Um contato pode ter várias linhas de atribuição (voltou
-- por outro anúncio). `distinct on (d.id) ... order by la.first_seen_at asc` escolhe o PRIMEIRO
-- toque — quem trouxe a pessoa, não quem estava por perto quando ela assinou. Sem o `distinct on` o
-- join multiplicaria a linha do contrato e o mesmo valor assinado seria contado 2× ou 3×: relatório
-- de dinheiro inflado, que é pior que relatório nenhum.
--
-- ⚠️ `sem_atribuicao` SAI SEPARADO, NUNCA DILUÍDO. Assinatura cuja origem não foi capturada (venda do
-- vendedor na rua, indicação, contrato criado à mão) não pode entrar num canal chamado "orgânico" —
-- isso vira crédito falso para um canal que não trabalhou. Ela aparece com nome próprio: "não sei de
-- onde veio". É a mesma regra do CINZA do painel de simulação: separar `false` de "não deu para
-- provar" (ver feedback_fallback_esconde_erro).
--
-- Idempotente. Portão: _gui_sched_ok (mesmo literal das outras contract_*). RLS não muda.

create or replace function public.contract_performance(p_secret text, p_email text, p_days int default 90)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e text := lower(trim(coalesce(p_email, '')));
  d int  := greatest(1, least(coalesce(p_days, 90), 730));
  out jsonb;
begin
  if not public._gui_sched_ok(p_secret) then raise exception 'unauthorized'; end if;
  if e = '' then raise exception 'email required'; end if;

  with docs as (
    select c.id, c.status, c.signed_at, c.created_at,
           coalesce(c.amount_cents, 0) as amount_cents,
           ct.phone_key, ct.email as contato_email, ct.lead_source, ct.first_seen_at
      from contracts c
      left join crm_contacts ct on ct.id = c.contact_id
     where c.client_email = e
       and c.created_at > now() - (d || ' days')::interval
  ),
  -- PRIMEIRO TOQUE por documento (ver o aviso acima sobre multiplicar linha de dinheiro)
  comattr as (
    select distinct on (dd.id)
           dd.*, la.source, la.medium, la.campaign, la.landing,
           la.gclid, la.fbclid, la.first_seen_at as attr_em
      from docs dd
      left join lead_attribution la
        on la.client_email = e
       and ( (dd.phone_key is not null and la.phone_key = dd.phone_key)
          or (dd.contato_email is not null and la.contact_email is not null
              and lower(la.contact_email) = lower(dd.contato_email)) )
     order by dd.id, la.first_seen_at asc nulls last
  ),
  marcado as (
    select ca.*,
           (ca.status = 'signed' or ca.signed_at is not null) as assinado,
           -- o canal é o mais específico que existir; NULL vira nome próprio, não "orgânico"
           nullif(trim(coalesce(ca.campaign, ca.source, ca.lead_source, '')), '') as canal,
           -- dias do PRIMEIRO contato conhecido até o aceite
           case when ca.signed_at is not null
                then extract(epoch from (ca.signed_at - coalesce(ca.attr_em, ca.first_seen_at, ca.created_at))) / 86400.0
           end as dias_para_fechar
      from comattr ca
  ),
  por_canal as (
    select coalesce(canal, '(origem não capturada)') as canal,
           count(*)                                             as propostas,
           count(*) filter (where assinado)                      as assinadas,
           sum(amount_cents) filter (where assinado)             as valor_assinado_cents,
           round(percentile_cont(0.5) within group (order by dias_para_fechar)::numeric, 1) as dias_mediano,
           bool_or(canal is null)                                as inclui_sem_origem
      from marcado group by 1
  )
  select jsonb_build_object(
    'ok', true,
    'janela_dias', d,
    'modelo', 'primeiro toque (lead_attribution.first_seen_at mais antigo do contato)',
    'total', (select jsonb_build_object(
        'propostas', count(*),
        'assinadas', count(*) filter (where assinado),
        'valor_assinado_cents', coalesce(sum(amount_cents) filter (where assinado), 0),
        'dias_mediano', round(percentile_cont(0.5) within group (order by dias_para_fechar)::numeric, 1)
      ) from marcado),
    -- A HONESTIDADE DO RELATÓRIO: quantas assinaturas não têm origem conhecida. Se este número for
    -- alto, a leitura por canal vale pouco — e quem lê precisa saber disso ANTES de reinvestir.
    'sem_atribuicao', (select jsonb_build_object(
        'propostas', count(*), 'assinadas', count(*) filter (where assinado)
      ) from marcado where canal is null),
    'canais', coalesce((select jsonb_agg(jsonb_build_object(
        'canal', canal, 'propostas', propostas, 'assinadas', assinadas,
        'taxa_pct', case when propostas > 0 then round(100.0 * assinadas / propostas, 1) else 0 end,
        'valor_assinado_cents', coalesce(valor_assinado_cents, 0),
        'dias_mediano', dias_mediano
      ) order by coalesce(valor_assinado_cents, 0) desc) from por_canal), '[]'::jsonb)
  ) into out;

  return out;
end $$;

grant execute on function public.contract_performance(text, text, int) to anon;
revoke all on function public.contract_performance(text, text, int) from public;
