-- ============================================================================
-- GUILEO · AGENDAMENTO NO FEED DA CENTRAL — evento `booking`, UMA vez por reserva.
-- Projeto ynihodbknhjirkdogxby. Idempotente. Aplicado via MCP em 2026-09-28
-- (migration `booking_event_once`).
--
-- POR QUE EXISTE (incidente 2026-09-28): a Central conta agendamentos pelos
-- client_events de type='booking'. O motor de agenda (functions/api/agent-schedule.js)
-- só gravava a reserva na trilha do CRM (crm_log_event) — NUNCA no feed. Resultado:
-- KPI de agendamentos sempre 0, com reservas reais no banco (2 eventos `booking`
-- na plataforma inteira, ambos de junho).
--
-- POR QUE NÃO USAR ingest_client_event DIRETO: ela não tem trava de repetição. A
-- ElevenLabs re-tenta a ferramenta quando a resposta demora, e a vitrine re-envia
-- no duplo clique — cada retry viraria um agendamento a mais no KPI. Aqui a trava
-- é do BANCO (índice único parcial), não de um "já existe?" lido antes de gravar.
--
-- DINHEIRO: esta função NÃO toca em client_credits (agendar não custa crédito — o
-- `booking` também custa 0 em ingest_client_event) e grava amount = 0 de propósito:
-- my_company_os soma `amount` de booking como "receita COLETADA", e reserva feita
-- não é dinheiro recebido. O preço do serviço vai em payload.price_cents.
--
-- SEGURANÇA: SECURITY DEFINER, portão INGEST (mesma família ingest_*), escopo por
-- client_email. Só o servidor chama: anon/authenticated NÃO executam.
-- ============================================================================
create unique index if not exists client_events_booking_once_uq
  on public.client_events (client_email, (payload->>'dedupe'))
  where type = 'booking' and payload ? 'dedupe';

create or replace function public.ingest_booking_event(
  p_secret text, p_email text, p_dedupe text,
  p_channel text default 'voice', p_summary text default '', p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $function$
declare v_tenant text := lower(trim(coalesce(p_email, '')));
        v_key text := nullif(trim(coalesce(p_dedupe, '')), '');
        v_id uuid;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode = '28000'; end if;
  if v_tenant = '' or position('@' in v_tenant) < 2 then return jsonb_build_object('ok', false, 'motivo', 'sem_tenant'); end if;
  -- sem chave não há como garantir "uma vez": recusa em vez de gravar evento repetível.
  if v_key is null then return jsonb_build_object('ok', false, 'motivo', 'sem_dedupe'); end if;

  insert into public.client_events (client_email, type, channel, summary, amount, payload)
  values (v_tenant, 'booking', coalesce(nullif(trim(p_channel), ''), 'voice'), left(coalesce(p_summary, ''), 400), 0,
          coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('dedupe', v_key))
  on conflict (client_email, (payload->>'dedupe')) where type = 'booking' and payload ? 'dedupe'
  do nothing
  returning id into v_id;

  if v_id is not null then return jsonb_build_object('ok', true, 'novo', true, 'id', v_id); end if;

  select id into v_id from public.client_events
   where client_email = v_tenant and type = 'booking' and payload->>'dedupe' = v_key
   limit 1;
  return jsonb_build_object('ok', v_id is not null, 'novo', false, 'id', v_id);
end $function$;

revoke all on function public.ingest_booking_event(text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_booking_event(text, text, text, text, text, jsonb) to service_role;
