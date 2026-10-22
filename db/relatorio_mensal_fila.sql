-- RELATÓRIO MENSAL DE VALOR — a fila do MÊS QUE FECHOU (2026-09-30)
-- ============================================================================
-- POR QUE EXISTE
-- O e-mail "o que a Gui recuperou no seu mês" era montado dentro do laço por-negócio do
-- /api/proactive e tinha quatro defeitos, todos medidos:
--   1. reservava o mês no PRIMEIRO dia em que houvesse qualquer dado — o relatório de setembro saía
--      no dia 1 ou 2, com um ou dois dias de números, e o mês ficava carimbado como "enviado";
--   2. não respeitava o `live_desde`: a Natura recebeu os relatórios de 08 e 09/2026 feitos com as
--      NOSSAS ligações de teste (todas anteriores à entrada em operação de 28/09);
--   3. "fora do horário" era calculado em UTC — uma ligação das 15h em Nova York contava como fora
--      do horário;
--   4. "agendamentos" contava eventos do tipo 'booking', que a agenda de voz não grava (a Natura
--      tinha 0 com agendamentos de verdade na tabela).
-- Aqui: o período é o mês de calendário ANTERIOR, no fuso do negócio; só entra o que aconteceu
-- depois do `live_desde`; e a fila devolve quem ainda não recebeu aquele mês. O carimbo
-- (marketing_date_claim, kind='value_report') continua sendo gravado pelo servidor — depois do envio.
--
-- "Fora do horário" = antes das 9h, depois das 18h (hora local) ou domingo. É uma régua única e
-- declarada; não existe tabela de horário de funcionamento para consultar.
-- Idempotente. Gated por _gui_sched_ok; execução só do service_role.
-- ============================================================================
create or replace function public.value_report_due_all(
  p_secret text, p_limit int default 8, p_so_tenant text default null, p_agora timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v jsonb;
  v_t   text := nullif(lower(trim(coalesce(p_so_tenant,''))),'');
  v_now timestamptz := coalesce(p_agora, now());
  v_lim int := greatest(1, least(coalesce(p_limit,8), 50));
begin
  if not public._gui_sched_ok(p_secret) then return jsonb_build_object('ok', false, 'reason', 'unauthorized'); end if;
  with t as (
    select c.client_email as tenant,
           coalesce((select nullif(trim(l.tz),'') from biz_locations l
                      where l.client_email = c.client_email and l.active order by l.created_at limit 1), 'America/New_York') as tz
      from client_credits c
     where c.client_email like '%@%'
       and ((v_t is not null and c.client_email = v_t) or (v_t is null and coalesce(c.internal, false) = false))
  ), j as (
    select t.tenant, t.tz,
           to_char(date_trunc('month', v_now at time zone t.tz) - interval '1 month', 'YYYY-MM') as periodo,
           ((date_trunc('month', v_now at time zone t.tz) - interval '1 month') at time zone t.tz) as ini,
           (date_trunc('month', v_now at time zone t.tz) at time zone t.tz) as fim
      from t
  ), k as (
    select j.*, greatest(j.ini, coalesce(public.tenant_live_desde(j.tenant), '-infinity'::timestamptz)) as desde
      from j
     where not exists (select 1 from biz_marketing_sent ms
                        where ms.client_email = j.tenant and ms.kind = 'value_report' and ms.ref = 'owner' and ms.period = j.periodo)
     order by j.tenant
     limit v_lim
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'tenant', k.tenant, 'period', k.periodo, 'tz', k.tz, 'from', k.desde, 'to', k.fim,
    'collected_cents', (select coalesce(sum(r.amount_cents),0)::bigint from client_revenue r
                         where r.client_email = k.tenant and r.ts >= k.desde and r.ts < k.fim and r.amount_cents > 0
                           and coalesce(lower(r.meta->>'status'),'') not in ('cancelled','canceled','no_show','no-show','noshow','void','voided','refunded','refund')),
    'bookings', (select count(*) from biz_appointments a
                  where a.client_email = k.tenant and a.created_at >= k.desde and a.created_at < k.fim
                    and coalesce(a.status,'booked') not in ('cancelled','canceled','hold')),
    'reminders', (select count(*) from biz_appointments a
                   where a.client_email = k.tenant and a.reminded_at >= k.desde and a.reminded_at < k.fim),
    'calls', (select count(*) from client_events e
               where e.client_email = k.tenant and e.type = 'call' and e.created_at >= k.desde and e.created_at < k.fim),
    'calls_after_hours', (select count(*) from client_events e
               where e.client_email = k.tenant and e.type = 'call' and e.created_at >= k.desde and e.created_at < k.fim
                 and ( extract(dow from (e.created_at at time zone k.tz)) = 0
                    or extract(hour from (e.created_at at time zone k.tz)) < 9
                    or extract(hour from (e.created_at at time zone k.tz)) >= 18 ))
  )), '[]'::jsonb) into v from k;
  return jsonb_build_object('ok', true, 'due', v);
end $$;
revoke all on function public.value_report_due_all(text,int,text,timestamptz) from public, anon, authenticated;
grant execute on function public.value_report_due_all(text,int,text,timestamptz) to service_role;
notify pgrst, 'reload schema';
