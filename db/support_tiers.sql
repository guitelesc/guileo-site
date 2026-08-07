-- ============================================================================
-- GUILEO · MOTOR DE SUPORTE EM 2 NÍVEIS + MOTOR DE MARKETING/ADS
-- Aplicado via MCP 2026-07-30; commitado pra auditoria/reprodução. Projeto ynihodbknhjirkdogxby.
--
-- tier 'atendimento' = PRIMEIRA LINHA, no hub do VENDEDOR (ele atende o cliente que assinou)
-- tier 'tecnico'     = equipe de DEV, no hub interno /equipe (bug/backend/frontend/integração)
-- Escalação nos dois sentidos, com quem escalou e por quê registrado no thread do chamado.
-- marketing_hub_stats = números REAIS da empresa (ou da carteira de 1 vendedor): eventos por
-- canal, leads, agendamentos, créditos e performance por cliente.
-- Todas as RPCs são SERVICE_ROLE-ONLY (revoke anon) e gated pelo literal INGEST.
-- HTTP: functions/api/support-hub.js (3 níveis de auth: vendedor · time técnico · marketing/admin).
-- ============================================================================
alter table public.support_tickets add column if not exists tier text not null default 'atendimento';
create index if not exists idx_support_tickets_tier on public.support_tickets (tier, status, created_at desc);

update public.support_tickets set tier = 'tecnico'
 where tier = 'atendimento'
   and (lower(coalesce(category,'')) ~ '(bug|tecn|tech|api|integra|backend|frontend|erro|falha|down)');

create or replace function public._sup_ok(p_secret text) returns boolean
language sql immutable as $$ select p_secret = 'glo_ing_c7f2a9e4b8d16350' $$;
-- (corpo completo das RPCs support_queue_tech / support_queue_seller / support_escalate /
--  support_tech_stats / marketing_hub_stats aplicado via MCP — ver histórico da sessão 2026-07-30)
