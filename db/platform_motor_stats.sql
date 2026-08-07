-- ============================================================================
-- GUILEO · PLATFORM MOTOR STATS — one admin-only read-only aggregate across the systems built in the
-- 2026-07-29/30 cycle (email suppression/campaigns + client & seller lead activity), so Luis can
-- monitor the new motors from /admin (SellerManager "⚙️ Motores · plataforma" panel, via
-- /api/seller-leads action=motors, admin-gated by blitz_stats). service_role only, INGEST-gated.
-- Applied via MCP 2026-07-30. Project ynihodbknhjirkdogxby. Idempotent.
-- ============================================================================
create or replace function public.platform_motor_stats(p_secret text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v jsonb;
begin
  if p_secret is distinct from 'glo_ing_c7f2a9e4b8d16350' then raise exception 'unauthorized' using errcode='28000'; end if;
  select jsonb_build_object(
    'suppressions',           (select count(*) from public.email_suppressions),
    'suppressed_clients',     (select count(distinct client_email) from public.email_suppressions),
    'campaigns_sent',         (select count(distinct campaign_id) from public.campaign_recipient_log),
    'campaign_emails',        (select count(*) from public.campaign_recipient_log),
    'clients_working_leads',  (select count(distinct client_email) from public.client_lead_status),
    'client_leads_worked',    (select count(*) from public.client_lead_status),
    'client_leads_closed',    (select count(*) from public.client_lead_status where status='fechado'),
    'sellers_working_leads',  (select count(distinct seller_email) from public.seller_lead_crm),
    'seller_leads_closed',    (select count(*) from public.seller_lead_crm where status='fechado')
  ) into v;
  return v;
end $$;
revoke all on function public.platform_motor_stats(text) from public;
revoke all on function public.platform_motor_stats(text) from anon;
grant execute on function public.platform_motor_stats(text) to service_role;
