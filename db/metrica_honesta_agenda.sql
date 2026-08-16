-- MÉTRICA HONESTA DA LIGAÇÃO — intenção de agendar × agendamento que existe. 2026-08-16.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- POR QUE ISTO EXISTE
-- O painel media `call_logs.success`. Esse campo vem da ElevenLabs e significa "a conversa terminou
-- normalmente" — NÃO "o negócio aconteceu". Resultado medido em 2026-08-16 no Natura Spa:
--
--     14 ligações reais · 14 marcadas "success" · 4 com intenção clara de agendar · 0 agendamentos
--
-- Ou seja: o painel reportava 100% de sucesso enquanto a receita era zero. Um dono olhando aquele
-- número concluiria que o produto funciona e que o problema é o volume de ligações — e compraria
-- mais anúncio para alimentar um funil furado. Métrica errada não é só imprecisa: ela manda o
-- dinheiro para o lado errado com confiança.
--
-- O QUE ESTA RPC MEDE
-- Só duas coisas, e as duas são verificáveis:
--   • QUANTOS QUERIAM MARCAR — pela intenção que o provedor extraiu e pelo resumo da conversa.
--   • QUANTOS SAÍRAM MARCADOS — por um agendamento que EXISTE na tabela, não por uma flag.
-- A ponte é `call_bookings` (ligação ↔ agendamento). Quando ela não foi escrita, cai para uma
-- janela de tempo: agendamento criado durante ou logo após a ligação, no mesmo tenant. É um
-- casamento por aproximação e está marcado como tal — nunca inflar é mais importante que acertar
-- todos, porque um número otimista aqui reconstrói exatamente o problema que a RPC veio matar.
--
-- IDEMPOTENTE: pode colar quantas vezes quiser.

create or replace function public.call_outcome_truth(
  p_secret text, p_email text, p_days integer default 30
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare v jsonb; v_desde timestamptz;
begin
  if not _gui_sched_ok(p_secret) then return jsonb_build_object('error','unauthorized'); end if;
  v_desde := now() - (greatest(coalesce(p_days,30), 1) || ' days')::interval;

  with ligacoes as (
    select c.conversation_id, c.created_at, c.duration_secs,
           -- INTENÇÃO DE AGENDAR: o provedor já classifica em `intent`; o resumo é a segunda
           -- rede, para as ligações antigas em que `intent` veio null (aconteceu 2 de 14).
           (coalesce(c.intent,'') ~* '(book|schedul|appoint|agend|marcar|reserv|cita)'
            or coalesce(c.summary,'') ~* '(book|schedul|appoint|agend|marcar|reserv)') as queria_marcar
      from call_logs c
     where c.client_email = p_email and c.created_at >= v_desde
  ),
  fechadas as (
    select l.*,
      -- 1ª PROVA (forte): a ponte explícita ligação → agendamento.
      exists (select 1 from call_bookings b
               where b.client_email = p_email and b.conversation_id = l.conversation_id) as tem_ponte,
      -- 2ª PROVA (fraca, por aproximação): agendamento nascido durante a ligação ou até 5 minutos
      -- depois. Janela curta de propósito: larga demais, ela captura agendamento feito pelo balcão
      -- e devolve o mesmo otimismo mentiroso do `success`.
      exists (select 1 from biz_appointments a
               where a.client_email = p_email and a.status <> 'cancelled'
                 and a.created_at between l.created_at - interval '1 minute'
                                     and l.created_at + interval '5 minutes') as tem_janela
      from ligacoes l
  )
  select jsonb_build_object(
    'desde', v_desde,
    'dias', greatest(coalesce(p_days,30), 1),
    'ligacoes', count(*),
    -- O NÚMERO QUE MENTIA fica no relatório, do lado do verdadeiro. Tirar ele esconde o tamanho do
    -- engano; deixar lado a lado é o que faz alguém acreditar no número novo.
    'marcadas_success', count(*) filter (where exists (
        select 1 from call_logs c where c.client_email = p_email
         and c.conversation_id = fechadas.conversation_id and c.success = 'success')),
    'queriam_marcar', count(*) filter (where queria_marcar),
    'viraram_agendamento', count(*) filter (where queria_marcar and (tem_ponte or tem_janela)),
    'provado_pela_ponte', count(*) filter (where queria_marcar and tem_ponte),
    'so_por_aproximacao', count(*) filter (where queria_marcar and not tem_ponte and tem_janela),
    'perdidas', count(*) filter (where queria_marcar and not tem_ponte and not tem_janela),
    'taxa_pct', case when count(*) filter (where queria_marcar) = 0 then null
                     else round(100.0 * count(*) filter (where queria_marcar and (tem_ponte or tem_janela))
                                / count(*) filter (where queria_marcar), 1) end
  ) into v from fechadas;

  return v;
end $function$;

revoke all on function public.call_outcome_truth(text, text, integer) from anon, public;
